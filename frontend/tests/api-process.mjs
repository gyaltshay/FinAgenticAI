import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
export function spawnApi({cwd,env,stdio='ignore'}){
 const python=process.env.FINAGENTIC_PYTHON||resolve(root,'backend/.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 return spawn(python,[resolve(root,'backend/run.py')],{cwd:root,env:{...env,FINAGENTIC_API_PORT:env.GEMINI_PORT||env.FINAGENTIC_API_PORT||'3001'},stdio,windowsHide:true});
}
