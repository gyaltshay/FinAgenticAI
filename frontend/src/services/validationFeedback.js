const rawFields=['report_id','reporting_period','currency','scale','scale_status','validation_status','workbook','checks'];
export function rawValidation(report){
 const result=report?.schemaValidationResult||report?.validationResult;
 if(!result?.report_id||!Array.isArray(result.checks))return null;
 return Object.fromEntries(rawFields.filter(key=>result[key]!==undefined).map(key=>[key,result[key]]));
}
export function validationFindings(report){
 const result=rawValidation(report);
 const checks=result?.checks||report?.validationResult?.findings||[];
 const seen=new Set();
 return checks.filter(check=>{
  if(check.rule_id==='SOURCE-EVIDENCE')return false;
  return check.requires_human_review||['FAIL','WARNING','REVIEW_REQUIRED','NOT_CHECKED'].includes(check.status)||['ERROR','CRITICAL','WARNING'].includes(check.severity);
 }).map(check=>({...check,location:check.sheet&&check.cell?`${check.sheet}!${check.cell}`:check.source_location||'Workbook',failed:check.status==='FAIL'||['ERROR','CRITICAL'].includes(check.severity)}))
 .filter(check=>{const key=JSON.stringify([check.rule_id,check.field,check.status,check.severity,check.message,check.location,check.actual_value,check.expected_value]);if(seen.has(key))return false;seen.add(key);return true;})
 .sort((a,b)=>Number(b.failed)-Number(a.failed));
}
export function findingValue(value){
 if(value===undefined||value===null)return 'Not available';
 if(value==='')return 'Blank';
 if(typeof value==='object')return 'raw_value' in value?findingValue(value.raw_value):JSON.stringify(value);
 return String(value);
}
