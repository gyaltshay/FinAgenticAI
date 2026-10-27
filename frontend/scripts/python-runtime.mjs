import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const python=process.env.FINAGENTIC_PYTHON||resolve(root,'backend/.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
export function runPython(args){
 if(!existsSync(python)&&!process.env.FINAGENTIC_PYTHON){console.error('Set up the FastAPI environment first. See backend/README.md.');process.exit(1);}
 const child=spawn(python,args,{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
 child.on('error',()=>{console.error('The backend Python process could not start.');process.exitCode=1;});
 child.on('exit',code=>{process.exitCode=code??1;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 return child;
}
