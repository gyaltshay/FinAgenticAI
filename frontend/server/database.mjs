import pg from 'pg';
import {validateDatabaseRecords} from '../shared/database-records.mjs';

const fail=(message,status)=>Object.assign(new Error(message),{status});
export function createDatabase({configured,connection,pool:providedPool}){
 const pool=providedPool||(configured?new pg.Pool(connection):null);
 function required(){if(!configured)throw fail('PostgreSQL is not configured.',503);}
 async function health(){required();try{await pool.query('SELECT revision FROM finagenticai.workspace_revision WHERE id=1');return {configured:true,available:true};}catch{throw fail('PostgreSQL is unavailable or its schema is not initialized. Check Docker and run npm run database:setup.',503);}}
 async function readWith(client){
  const revision=(await client.query('SELECT revision FROM finagenticai.workspace_revision WHERE id=1')).rows[0].revision;
  if(revision===0)return {revision,records:null};
  const records={};for(const [name,table] of [['companies','companies'],['users','users'],['periods','reporting_periods'],['submissions','submissions']])records[name]=(await client.query(`SELECT record FROM finagenticai.${table} ORDER BY ordinal,id`)).rows.map(r=>r.record);
  return {revision,records};
 }
 async function read(){required();const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const result=await readWith(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 async function save(input){
  required();if(!Number.isSafeInteger(input?.revision)||input.revision<0)throw fail('Provide the database revision.',400);
  const records=validateDatabaseRecords(input.records),client=await pool.connect();
  try{
   await client.query('BEGIN');const revision=(await client.query('SELECT revision FROM finagenticai.workspace_revision WHERE id=1 FOR UPDATE')).rows[0].revision;
   if(revision!==input.revision)throw fail('Database records changed in another tab or browser. Reload before making further changes.',409);
   const existing=await readWith(client);
   if(existing.records){
    for(const name of ['companies','users','periods','submissions']){const incoming=new Map(records[name].map(r=>[r.id,r]));for(const old of existing.records[name]){
     const row=incoming.get(old.id);if(!row)throw fail('Existing database records cannot be removed by a browser reset. Reload to restore the records.',409);
     if(name==='submissions'&&(['company','period','revision','file'].some(field=>old[field]!==row[field])||(old.originalWorkbook&&old.originalWorkbook.accessToken!==row.originalWorkbook?.accessToken)))throw fail('An existing submission version and its original workbook cannot be replaced.',409);
    }}
   }
   for(const [ordinal,c] of records.companies.entries())await client.query('INSERT INTO finagenticai.companies(id,name,sector,active,reporting,record,ordinal) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,sector=EXCLUDED.sector,active=EXCLUDED.active,reporting=EXCLUDED.reporting,record=EXCLUDED.record,ordinal=EXCLUDED.ordinal',[c.id,c.name,c.sector,c.active,c.reporting,c,ordinal]);
   for(const [ordinal,u] of records.users.entries())await client.query('INSERT INTO finagenticai.users(id,email,name,role,company_id,active,record,ordinal) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,role=EXCLUDED.role,company_id=EXCLUDED.company_id,active=EXCLUDED.active,record=EXCLUDED.record,ordinal=EXCLUDED.ordinal',[u.id,u.email,u.name,u.role,u.role==='admin'?null:u.company,u.active,u,ordinal]);
   for(const [ordinal,p] of records.periods.entries())await client.query('INSERT INTO finagenticai.reporting_periods(id,label,open_date,deadline,state,record,ordinal) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET label=EXCLUDED.label,open_date=EXCLUDED.open_date,deadline=EXCLUDED.deadline,state=EXCLUDED.state,record=EXCLUDED.record,ordinal=EXCLUDED.ordinal',[p.id,p.period,p.openDate,p.deadline,p.state,p,ordinal]);
   for(const [ordinal,r] of records.submissions.entries())await client.query('INSERT INTO finagenticai.submissions(id,company_id,period_label,revision,filename,validation_status,original_workbook,record,ordinal) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET validation_status=EXCLUDED.validation_status,original_workbook=EXCLUDED.original_workbook,record=EXCLUDED.record,ordinal=EXCLUDED.ordinal',[r.id,r.company,r.period,r.revision,r.file,r.validationStatus||null,r.originalWorkbook||null,r,ordinal]);
   await client.query('UPDATE finagenticai.workspace_revision SET revision=revision+1,updated_at=now() WHERE id=1');await client.query('COMMIT');return {revision:revision+1,records};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 return {configured,health,read,save,close:()=>pool?.end()};
}
