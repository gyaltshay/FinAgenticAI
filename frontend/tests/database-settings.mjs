// Private connection settings used only by database QA scripts.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const repositoryRoot=fileURLToPath(new URL('../../',import.meta.url));
export async function databaseConfig(){
 const values={};
 try{for(const line of (await readFile(resolve(repositoryRoot,'.env.database.local'),'utf8')).split(/\r?\n/)){const match=line.match(/^\s*((?:PG|POSTGRES_)[A-Z_]+)\s*=\s*(.*?)\s*$/);if(match)values[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');}}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const name of ['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGADMIN_USER','PGADMIN_PASSWORD'])if(process.env[name])values[name]=process.env[name];
 const configured=process.env.FINAGENTIC_DATABASE_DISABLED!=='1'&&Boolean(values.PGHOST&&values.PGDATABASE&&values.PGUSER&&values.PGPASSWORD&&!values.PGPASSWORD.startsWith('replace-with-'));
 return {configured,values,connection:{host:values.PGHOST,port:Number(values.PGPORT||5432),database:values.PGDATABASE,user:values.PGUSER,password:values.PGPASSWORD,connectionTimeoutMillis:5000,statement_timeout:15000,max:5}};
}
