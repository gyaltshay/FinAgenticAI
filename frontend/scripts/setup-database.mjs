import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {databaseConfig} from '../server/database-config.mjs';

const config=await databaseConfig(),{values,connection}=config;
if(!config.configured||!values.PGADMIN_PASSWORD||values.PGADMIN_PASSWORD.startsWith('replace-with-'))throw new Error('Complete .env.database.local before running setup.');
if(!/^[a-z][a-z0-9_]{2,50}$/.test(connection.database)||!/^[a-z][a-z0-9_]{2,50}$/.test(connection.user)||connection.user===(values.PGADMIN_USER||'postgres'))throw new Error('Use a dedicated database and application role.');
const admin=new pg.Client({...connection,database:'postgres',user:values.PGADMIN_USER||'postgres',password:values.PGADMIN_PASSWORD});
try{
 await admin.connect();
 if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[connection.user])).rowCount){const sql=(await admin.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', $1::text,$2::text) AS sql",[connection.user,connection.password])).rows[0].sql;await admin.query(sql);}
 const existing=(await admin.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1',[connection.database])).rows[0];
 if(existing&&existing.owner!==connection.user)throw new Error('The existing database belongs to another role; setup will not alter it.');
 if(!existing){const sql=(await admin.query("SELECT format('CREATE DATABASE %I OWNER %I', $1::text,$2::text) AS sql",[connection.database,connection.user])).rows[0].sql;await admin.query(sql);}
}catch(error){console.error('Database provisioning failed ('+(error.code||'setup')+'). Check the private administrator settings and PostgreSQL service.');process.exitCode=1;}finally{await admin.end();}
if(!process.exitCode){
 const app=new pg.Client(connection);
 try{await app.connect();await app.query('BEGIN');await app.query(await readFile(new URL('../server/migrations/001-core.sql',import.meta.url),'utf8'));await app.query('COMMIT');console.log('FinAgenticAI database initialized with a dedicated non-superuser application role. Existing records were preserved.');}
 catch(error){await app.query('ROLLBACK').catch(()=>{});console.error('Database schema setup failed ('+(error.code||'setup')+'). No application records were imported.');process.exitCode=1;}finally{await app.end();}
}
