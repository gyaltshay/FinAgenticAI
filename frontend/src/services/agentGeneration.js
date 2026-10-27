import {buildScopePackage,importInsightFile,scopeOptions,signature} from '../../shared/scopedReports.mjs';
import {managementReportCurrent} from './managementReports.js';

const inFlight=new Map();
async function request(key,path,body){
 if(inFlight.has(key))return inFlight.get(key);
 const task=(async()=>{const response=await fetch(import.meta.env.BASE_URL+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Agent generation failed.');return result;})();
 inFlight.set(key,task);try{return await task;}finally{inFlight.delete(key);}
}
export async function generateScopeInsights(cycle,scope){const pkg=buildScopePackage(cycle,scope);const file=await request('insights:'+pkg.input.input_signature,'api/scoped/insights',{cycle,scope});importInsightFile(file,cycle);return file;}
export async function generateScopeReport(cycle,insightFile){importInsightFile(insightFile,cycle);return request('report:'+signature(insightFile),'api/scoped/report',{cycle,insightFile});}
export function cycleScopes(cycle){return ['company','sector','group'].flatMap(type=>scopeOptions(cycle,type).map(id=>({type,id})));}
export function latestScopeReport(w,cycle,scope){return (w.managementReports||[]).filter(e=>e.report.period===cycle.period&&e.report.scope.type===scope.type&&e.report.scope.id===scope.id&&managementReportCurrent(w,e)).sort((a,b)=>b.version-a.version)[0]||null;}

// Each saved artifact is a checkpoint. Resume only missing work; approval stays manual.
export async function prepareCycleResults({cycle,isCurrent,getWorkspace,findInsights,saveInsights,saveReport,insights=generateScopeInsights,report=generateScopeReport,onProgress=()=>{}}){
 const scopes=cycleScopes(cycle);let completed=0;
 for(const scope of scopes){
  if(!isCurrent())return {cancelled:true,completed,total:scopes.length};
  onProgress({scope,stage:'Checking saved results',completed,total:scopes.length});
  let file=findInsights(cycle,scope);
  if(!file){
   onProgress({scope,stage:'Generating insights',completed,total:scopes.length});file=await insights(cycle,scope);
   if(!isCurrent())return {cancelled:true,completed,total:scopes.length};
   saveInsights(file,cycle);
  }
  if(!latestScopeReport(getWorkspace(),cycle,scope)){
   onProgress({scope,stage:'Generating report',completed,total:scopes.length});const payload=await report(cycle,file);
   if(!isCurrent())return {cancelled:true,completed,total:scopes.length};
   if(!saveReport(payload,file))throw new Error('The generated report could not be saved.');
  }
  completed++;onProgress({scope,stage:'Prepared',completed,total:scopes.length});
 }
 return {completed,total:scopes.length};
}
