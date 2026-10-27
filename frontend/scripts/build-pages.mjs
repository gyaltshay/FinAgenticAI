import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {cp,writeFile,readdir,unlink,realpath} from 'node:fs/promises';
const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const project=resolve(frontend,'..');
const result=spawnSync(process.execPath,[resolve(frontend,'node_modules/vite/bin/vite.js'),'build'],{cwd:frontend,env:{...process.env,VITE_BASE_PATH:'/FinAgenticAI/'},stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
for(const file of ['index.html','assets','logos'])await cp(resolve(frontend,'dist',file),resolve(project,file),{recursive:true});
// Remove only obsolete generated chunks in this project's own assets directory.
const assets=resolve(project,'assets');
if(await realpath(assets)!==assets)throw new Error('Refusing to clean an assets directory outside the project.');
const current=new Set(await readdir(resolve(frontend,'dist/assets')));
for(const file of await readdir(assets,{withFileTypes:true}))if(file.isFile()&&!current.has(file.name)&&/^(?:index-[\w-]+\.(?:js|css)|InterVariable-[\w-]+\.woff2)$/.test(file.name))await unlink(resolve(assets,file.name));
await writeFile(resolve(project,'.nojekyll'),'');
console.log('GitHub Pages files prepared at the repository root.');
