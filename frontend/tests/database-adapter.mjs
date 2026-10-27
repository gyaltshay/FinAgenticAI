import {spawn} from 'node:child_process';
import {python,root} from '../scripts/python-runtime.mjs';
export {databaseConfig} from './database-settings.mjs';
export function createDatabase({connection,pool}){
 function call(operation,input={}){
  return new Promise((resolve,reject)=>{
   const child=spawn(python,['-m','backend.manage',operation],{cwd:root,env:{...process.env,PGDATABASE:connection.database},windowsHide:true,stdio:['pipe','pipe','pipe']});
   let output='';child.stdout.setEncoding('utf8');child.stdout.on('data',part=>{output+=part;});
   child.on('error',reject);child.on('close',code=>{try{const result=JSON.parse(output);if(code||result.error)reject(Object.assign(new Error(result.error||'Native database check failed.'),{status:result.status}));else resolve(result.result);}catch{reject(new Error('The native database QA adapter returned an invalid response.'));}});
   child.stdin.end(JSON.stringify(input));
  });
 }
 return {read:()=>call('read-test-records'),save:input=>call('save-test-records',input),close:()=>pool.end()};
}
