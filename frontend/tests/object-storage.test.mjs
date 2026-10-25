import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkbookStorage} from '../server/object-storage.mjs';

const bytes=Buffer.from('504b030473796e746865746963','hex');
const input={submissionId:'submission-one',company:'TTPL',period:'August 2026',version:1,fileName:'August original.xlsx',uploadedBy:'TTPL Finance',fileBase64:bytes.toString('base64')};
function setup(){
 const objects=new Map();let unavailable=false;
 const client={async send(command){if(unavailable)throw new Error('private provider details');const {Key,Body}=command.input;if(command.constructor.name==='PutObjectCommand'){assert.equal(command.input.IfNoneMatch,'*');assert.ok(!objects.has(Key));objects.set(Key,Buffer.from(Body));return {};}
 if(command.constructor.name==='GetObjectCommand'){if(!objects.has(Key))throw new Error('missing');return {Body:{transformToByteArray:async()=>objects.get(Key)}};}return {};}};
 const config={endpoint:'http://127.0.0.1:9000',bucket:'financial-submissions',accessKey:'local-test-user',secretKey:'local-test-secret',signingKey:Buffer.alloc(48,9),client};
 return {storage:createWorkbookStorage(config),config,objects,offline:()=>{unavailable=true;}};
}
test('submission versions and simultaneous uploads keep separate original objects',async()=>{
 const {storage,objects}=setup();const [v1,v2,concurrent]=await Promise.all([storage.save(input),storage.save({...input,submissionId:'correction',version:2}),storage.save(input)]);
 assert.equal(objects.size,3);assert.notEqual(v1.key,v2.key);assert.notEqual(v1.key,concurrent.key);assert.match(v2.key,/\/v2\//);
 for(const receipt of [v1,v2]){const result=await storage.read(receipt);assert.deepEqual(result.bytes,bytes);assert.equal(result.record.fileName,input.fileName);}
});
test('signed receipt survives adapter restart and rejects substituted versions and forged access',async()=>{
 const {storage,config}=setup(),receipt=await storage.save(input);const restarted=createWorkbookStorage(config);
 assert.deepEqual((await restarted.read(receipt,input)).bytes,bytes);
 await assert.rejects(restarted.read(receipt,{...input,version:2}),{status:409});
 await assert.rejects(restarted.read({...receipt,id:'another-object'}),{status:403});
 await assert.rejects(restarted.read({...receipt,accessToken:'forged.signature'}),{status:403});
 await assert.rejects(restarted.read({}),{status:403});
});
test('changed object bytes fail integrity checks',async()=>{
 const {storage,objects}=setup(),receipt=await storage.save(input);objects.set(receipt.key,Buffer.from('changed'));
 await assert.rejects(storage.read(receipt),{status:502});
});
test('storage failure blocks success and does not expose provider details',async()=>{
 const {storage,offline}=setup();offline();await assert.rejects(storage.save(input),error=>error.status===503&&!error.message.includes('private provider'));
 await assert.rejects(createWorkbookStorage({}).save(input),{status:503});
});
test('invalid filenames, versions, bytes, and empty submissions never create objects',async()=>{
 const {storage,objects}=setup();
 for(const changed of [{fileName:'report.pdf'},{version:0},{fileBase64:''},{fileBase64:'%%%%'},{fileBase64:Buffer.from('not an archive').toString('base64')},{company:''}])await assert.rejects(storage.save({...input,...changed}));
 assert.equal(objects.size,0);
});
