import {useEffect,useRef,useState} from 'react';
import {completedCycle} from '../services/completedCycle';
import {prepareCycleResults} from '../services/agentGeneration';
import {findScopedInsights,saveScopedInsights} from '../services/scopedInsightStore';
import {saveManagementReport} from '../services/managementReports';

const key='finagenticai.automatic-generation.v1';
function failures(){try{const rows=JSON.parse(localStorage.getItem(key)||'{}');return rows&&typeof rows==='object'&&!Array.isArray(rows)?rows:{};}catch{return {};}}
function remember(id,error){const rows=failures();if(error)rows[id]=error;else delete rows[id];try{localStorage.setItem(key,JSON.stringify(rows));}catch{/* Workspace storage errors are surfaced separately. */}}
export function useAutomaticGeneration({w,period,session,database,mutate}){
 const cycle=completedCycle(w,period),id=cycle?.id;
 const latest=useRef();latest.current={w,period,session,database,mutate};
 const [status,setStatus]=useState(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let stopped=false;const userId=session?.userId;
  if(!id||session?.role!=='admin'||database.loading||['Unavailable','Not saved'].includes(database.status)){setStatus(null);return;}
  const prior=failures()[id];if(prior){setStatus({id,state:'paused',...prior});return;}
  const current=()=>!stopped&&latest.current.session?.userId===userId&&latest.current.session?.role==='admin'&&!latest.current.database.loading&&!['Unavailable','Not saved'].includes(latest.current.database.status)&&completedCycle(latest.current.w,latest.current.period)?.id===id;
  async function run(){
   if(!current())return;let progress={completed:0};setStatus({id,state:'running',...progress});
   try{
    const result=await prepareCycleResults({cycle,isCurrent:current,getWorkspace:()=>latest.current.w,findInsights:findScopedInsights,saveInsights:saveScopedInsights,
     saveReport:(payload,file)=>{const next=latest.current.mutate(old=>saveManagementReport(old,payload,file,latest.current.session));if(next)latest.current.w=next;return next;},
     onProgress:next=>{progress=next;if(current())setStatus({id,state:'running',...next});}});
    if(current()&&!result.cancelled){remember(id,null);setStatus({id,state:'complete',...result});}
   }catch(error){if(current()){const failure={...progress,error:error.message};remember(id,failure);setStatus({id,state:'paused',...failure});}}
  }
  // Web Locks prevent two admin tabs in the same browser generating the same cycle.
  const locked=()=>navigator.locks?navigator.locks.request('finagenticai-agents:'+id,run):run();
  locked().catch(error=>{if(current())setStatus({id,state:'paused',error:error.message});});
  return ()=>{stopped=true;};
 },[id,session?.userId,session?.role,database.loading,database.status==='Unavailable',database.status==='Not saved',retry]);
 return {status:status?.id===id?status:null,resume:()=>{if(id){remember(id,null);setRetry(n=>n+1);}}};
}
