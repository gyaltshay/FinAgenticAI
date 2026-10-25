import {S3Client,PutObjectCommand,GetObjectCommand,HeadBucketCommand} from '@aws-sdk/client-s3';
import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

export const workbookType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function storageSigningKey(path){
 await mkdir(dirname(path),{recursive:true});
 try{await writeFile(path,randomBytes(48),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
 const key=await readFile(path);if(key.length<32)throw new Error('Storage receipt signing key is invalid.');return key;
}

export function createWorkbookStorage({endpoint,bucket,accessKey,secretKey,signingKey,client}){
 const configured=Boolean(endpoint&&bucket&&accessKey&&secretKey&&signingKey);
 const s3=client||(configured?new S3Client({endpoint,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:accessKey,secretAccessKey:secretKey},maxAttempts:2,requestHandler:{connectionTimeout:5000,requestTimeout:20000}}):null);
 function requireStorage(){if(!configured)throw failure('Workbook storage is not configured. Start MinIO and configure .env.storage.local.',503);}
 function sign(value){return createHmac('sha256',signingKey).update(value).digest('base64url');}
 function verify(receipt){
  requireStorage();if(typeof receipt?.accessToken!=='string'||receipt.accessToken.length>5000)throw failure('A valid original-workbook receipt is required.',403);
  const [payload,signature,...extra]=receipt.accessToken.split('.');
  if(!payload||!signature||extra.length)throw failure('Original-workbook access denied.',403);
  const actual=Buffer.from(signature),expected=Buffer.from(sign(payload));
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw failure('Original-workbook access denied.',403);
  let record;try{record=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw failure('Original-workbook access denied.',403);}
  if(record.bucket!==bucket||record.id!==receipt.id||!record.key?.startsWith('originals/'))throw failure('Original-workbook access denied.',403);
  return record;
 }
 async function health(){requireStorage();try{await s3.send(new HeadBucketCommand({Bucket:bucket}));return {configured:true,available:true};}catch{throw failure('Workbook storage is unavailable. Check Docker, MinIO, and the upload bucket.',503);}}
 async function save(input){
  requireStorage();
  for(const field of ['submissionId','company','period','uploadedBy'])if(typeof input[field]!=='string'||!input[field].trim()||input[field].length>160)throw failure('Provide submission, company, period, and uploader details.');
  if(!Number.isSafeInteger(input.version)||input.version<1)throw failure('Provide a positive submission version.');
  if(typeof input.fileName!=='string'||input.fileName.length>240||/[\x00-\x1f]/.test(input.fileName)||!input.fileName.toLowerCase().endsWith('.xlsx'))throw failure('Choose an .xlsx workbook with a valid filename.');
  if(typeof input.fileBase64!=='string'||!input.fileBase64.length||input.fileBase64.length>27_962_028||/[^A-Za-z0-9+/=]/.test(input.fileBase64))throw failure('The workbook data is invalid or exceeds 20 MB.');
  const bytes=Buffer.from(input.fileBase64,'base64');if(!bytes.length||bytes.length>20*1024*1024)throw failure('Choose a non-empty workbook up to 20 MB.',413);
  if(bytes.toString('base64')!==input.fileBase64)throw failure('The workbook encoding is invalid.');
  if(bytes.length<4||bytes.readUInt32LE(0)!==0x04034b50)throw failure('The selected file is not an XLSX archive.');
  const id=randomUUID(),segment=value=>encodeURIComponent(value.trim());
  const record={id,bucket,key:`originals/${segment(input.company)}/${segment(input.period)}/${segment(input.submissionId)}/v${input.version}/${id}/original.xlsx`,submissionId:input.submissionId,company:input.company,period:input.period,version:input.version,fileName:input.fileName.split(/[\\/]/).pop(),size:bytes.length,sha256:hash(bytes),uploadedBy:input.uploadedBy,uploadedAt:new Date().toISOString()};
  try{await s3.send(new PutObjectCommand({Bucket:bucket,Key:record.key,Body:bytes,ContentType:workbookType,IfNoneMatch:'*',Metadata:{'submission-id':encodeURIComponent(record.submissionId),company:encodeURIComponent(record.company),period:encodeURIComponent(record.period),version:String(record.version),'original-filename':encodeURIComponent(record.fileName),'uploaded-by':encodeURIComponent(record.uploadedBy),'uploaded-at':record.uploadedAt,sha256:record.sha256}}));}
  catch{throw failure('The original workbook could not be stored. Check that MinIO is running, then submit again.',503);}
  const payload=Buffer.from(JSON.stringify(record)).toString('base64url');return {...record,accessToken:payload+'.'+sign(payload)};
 }
 async function read(receipt,expected){
  const record=verify(receipt);
  if(expected&&['submissionId','company','period','version'].some(field=>record[field]!==expected[field]))throw failure('The stored workbook belongs to a different submission version.',409);
  let bytes;try{const result=await s3.send(new GetObjectCommand({Bucket:bucket,Key:record.key}));bytes=Buffer.from(await result.Body.transformToByteArray());}catch{throw failure('The original workbook is unavailable. Check MinIO and try again.',503);}
  if(bytes.length!==record.size||hash(bytes)!==record.sha256)throw failure('The stored workbook failed its integrity check.',502);
  return {record,bytes};
 }
 return {configured,health,save,read};
}
