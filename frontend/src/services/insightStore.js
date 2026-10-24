const storageKey='finagenticai.insight-results.v1';

function readAll(){
 try{const items=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(items)?items.filter(item=>item?.result?.report_id&&typeof item?.result?.reporting_period==='string'):[];}
 catch{return [];}
}

export function findInsightResult(submissionId,period){
 return readAll().find(item=>item.result.report_id===submissionId&&item.result.reporting_period===period)?.result||null;
}

export function saveInsightResult(result){
 if(!result?.report_id||!result?.reporting_period)throw new Error('Insight JSON must identify a submission and reporting period.');
 const rest=readAll().filter(item=>item.result.report_id!==result.report_id||item.result.reporting_period!==result.reporting_period);
 localStorage.setItem(storageKey,JSON.stringify([{saved_at:new Date().toISOString(),result},...rest].slice(0,100)));
}
