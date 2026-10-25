// Only administrative records and upload metadata cross the database boundary.
// Financial values, validation findings, insights, reports and approvals stay local.
const pick=(value,fields)=>Object.fromEntries(fields.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
const companyFields=['id','name','sector','group','active','reporting','ownership','logo'];
const userFields=['id','name','email','role','company','active'];
const periodFields=['id','period','openDate','deadline','state','requiredCompanyIds','assignments','frozenAt'];
const reportFields=['id','company','period','file','date','revision','status','validationStatus','submittedAt','uploadedBy','frontendFixture'];
const originalFields=['id','bucket','key','submissionId','company','period','version','fileName','size','sha256','uploadedBy','uploadedAt','accessToken'];
export function projectDatabaseRecords(w){
 const periods=(w.periods||[]).map(p=>({...pick(p,periodFields),assignments:(p.assignments||[]).map(a=>pick(a,['id','sector','group']))}));
 const submissions=(w.reports||[]).map(r=>({...pick(r,reportFields),...(r.originalWorkbook?{originalWorkbook:pick(r.originalWorkbook,originalFields)}:{})}));
 return {companies:(w.companies||[]).map(c=>pick(c,companyFields)),users:(w.users||[]).map(u=>pick(u,userFields)),periods,submissions};
}
export function validateDatabaseRecords(records){
 const fail=message=>{throw Object.assign(new Error(message),{status:400});};
 if(!records||typeof records!=='object')fail('Provide the administrative records.');
 for(const name of ['companies','users','periods','submissions']){
  if(!Array.isArray(records[name])||records[name].length>10000)fail('Invalid '+name+' records.');
  const ids=new Set();for(const row of records[name]){if(typeof row?.id!=='string'||!row.id||row.id.length>160||ids.has(row.id))fail('Invalid or duplicate record identity.');ids.add(row.id);}
 }
 if(!records.companies.length||!records.periods.length||!records.users.some(u=>u.active&&u.role==='admin'))fail('Keep companies, a reporting period and an active administrator.');
 const companies=new Set(records.companies.map(c=>c.id));
 for(const c of records.companies)if(!c.name||!c.sector||!c.group||typeof c.active!=='boolean'||typeof c.reporting!=='boolean')fail('Invalid company details.');
 const emails=new Set();for(const u of records.users){if(!u.name||typeof u.email!=='string'||!/^\S+@\S+\.\S+$/.test(u.email)||emails.has(u.email.toLowerCase())||!['admin','subsidiary'].includes(u.role)||typeof u.active!=='boolean'||(u.role==='subsidiary'&&!companies.has(u.company)))fail('Invalid user or company assignment.');emails.add(u.email.toLowerCase());}
 const labels=new Set();for(const p of records.periods){if(typeof p.period!=='string'||labels.has(p.period)||!/^\d{4}-\d{2}-\d{2}$/.test(p.openDate)||!/^\d{4}-\d{2}-\d{2}$/.test(p.deadline)||p.openDate>p.deadline||!['Open','Closed'].includes(p.state)||!Array.isArray(p.requiredCompanyIds)||!Array.isArray(p.assignments)||p.requiredCompanyIds.some(id=>!companies.has(id)))fail('Invalid reporting period.');labels.add(p.period);}
 const versions=new Set();for(const r of records.submissions){const key=JSON.stringify([r.company,r.period,r.revision]);if(!companies.has(r.company)||typeof r.period!=='string'||!Number.isSafeInteger(r.revision)||r.revision<1||!r.file||versions.has(key))fail('Invalid or duplicate submission version.');versions.add(key);
  if(r.originalWorkbook&&['submissionId','company','period','version'].some((key,index)=>r.originalWorkbook[key]!==[r.id,r.company,r.period,r.revision][index]))fail('The original workbook must match its submission version.');
 }
 return projectDatabaseRecords({companies:records.companies,users:records.users,periods:records.periods,reports:records.submissions});
}
export function mergeDatabaseRecords(local,records){
 const existing=new Map(local.reports.map(r=>[r.id,r]));
 const reports=records.submissions.map(meta=>{const old=existing.get(meta.id);return {...(old||{approval:'Not yet available',issues:[],data:{},validationResult:null,geminiExplanation:null}),...meta};});
 return {...local,companies:records.companies,users:records.users,periods:records.periods,reports,currentPeriod:records.periods.some(p=>p.id===local.currentPeriod)?local.currentPeriod:records.periods[0]?.id};
}
