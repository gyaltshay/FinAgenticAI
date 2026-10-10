import {useState,useEffect,useRef} from 'react';
import {loadCycleWorkspace,saveCycleWorkspace,initialCycleWorkspace,readiness,currentFinalValid,beginProcessing,advanceProcessing,validateVersion,event} from '../services/cycle';
export function useReportingCycle(){
 const [workspace,setWorkspace]=useState(()=>{const w=loadCycleWorkspace();return {...w,reports:w.reports.map(r=>r.validationStatus==='Validating'?{...r,status:'Pending',validationStatus:'Pending'}:r)};});
 const [error,setError]=useState(''),[storageError,setStorageError]=useState(false);const timers=useRef(new Map()),latest=useRef(workspace);latest.current=workspace;
 function commit(operation){const next=operation(latest.current);latest.current=next;setWorkspace(next);return next;}
 useEffect(()=>{setStorageError(!saveCycleWorkspace(workspace));},[workspace]);
 useEffect(()=>()=>{for(const timer of timers.current.values())clearTimeout(timer);},[]);
 useEffect(()=>{
  for(const r of workspace.reports.filter(r=>r.validationStatus==='Validating')){const key=`validate:${r.id}`;if(!timers.current.has(key))timers.current.set(key,setTimeout(()=>{timers.current.delete(key);commit(w=>validateVersion(w,r.id))},1400));}
  for(const p of workspace.periods){const gate=readiness(workspace,p.id),cycle=workspace.cycles[p.id];if(gate.ready&&!currentFinalValid(workspace,p.id)&&cycle?.phase!=='Processing'){commit(w=>beginProcessing(w,p.id));continue;}
   if(gate.ready&&cycle?.phase==='Processing'){const key=`stage:${p.id}:${cycle.signature}:${cycle.stage}`;if(!timers.current.has(key))timers.current.set(key,setTimeout(()=>{timers.current.delete(key);commit(w=>advanceProcessing(w,p.id,cycle.signature))},650));}
  }
 },[workspace]);
 function mutate(operation){setError('');try{return commit(operation)}catch(e){setError(e.message);return null;}}
 function change(action,detail,operation){return mutate(w=>event(operation(w),action,detail));}
 function reset(){for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();commit(()=>initialCycleWorkspace());}
 return {workspace,mutate,change,reset,error,setError,storageError};
}
