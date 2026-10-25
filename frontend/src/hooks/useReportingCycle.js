import {useState,useEffect,useRef} from 'react';
import {loadCycleWorkspace,saveCycleWorkspace,initialCycleWorkspace,readiness,currentFinalValid,beginProcessing,advanceProcessing,event,failValidation,cycleStorageKey} from '../services/cycle';
import {useDatabaseRecords} from './useDatabaseRecords';
import {projectDatabaseRecords,mergeDatabaseRecords} from '../../shared/database-records.mjs';
export function useReportingCycle(){
 const [workspace,setWorkspace]=useState(()=>{const w=loadCycleWorkspace();return {...w,reports:w.reports.map(r=>r.validationStatus==='Validating'?{...r,status:'Validation Unavailable',validationStatus:'Validation Unavailable',validationError:'The browser session ended before deterministic validation completed. Submit the workbook again.'}:r)};});
 const [sessionTick,setSessionTick]=useState(0);
 const [error,setError]=useState(''),[storageError,setStorageError]=useState(false);const timers=useRef(new Map()),latest=useRef(workspace);latest.current=workspace;
 function commit(operation){const next=operation(latest.current);latest.current=next;setWorkspace(next);return next;}
 const database=useDatabaseRecords(workspace,commit);
 useEffect(()=>{setStorageError(!saveCycleWorkspace(workspace));},[workspace]);
 useEffect(()=>{
  const authChanged=()=>setSessionTick(value=>value+1);
  const storageChanged=event=>{if(event.key!==cycleStorageKey||!event.newValue)return;try{const next=JSON.parse(event.newValue);if(next.version!==3||!Array.isArray(next.reports)||!Array.isArray(next.periods)||!Array.isArray(next.finalReports)||!Array.isArray(next.users)||!Array.isArray(next.companies))return;if(JSON.stringify(latest.current)===event.newValue)return;for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();latest.current=next;setWorkspace(next);}catch{}};
  window.addEventListener('storage',storageChanged);window.addEventListener('finagenticai-session-changed',authChanged);
  return ()=>{window.removeEventListener('storage',storageChanged);window.removeEventListener('finagenticai-session-changed',authChanged);};
 },[]);
 function activeAdmin(){try{const id=JSON.parse(sessionStorage.getItem('finagenticai.session.v3'))?.userId;return latest.current.users.some(u=>u.id===id&&u.active&&u.role==='admin');}catch{return false;}}

 useEffect(()=>()=>{for(const timer of timers.current.values())clearTimeout(timer);},[]);
 useEffect(()=>{
  if(database.loading||database.status==='Unavailable'||!activeAdmin()){for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();return;}
  for(const p of workspace.periods){const gate=readiness(workspace,p.id),cycle=workspace.cycles[p.id];if(gate.ready&&!currentFinalValid(workspace,p.id)&&cycle?.phase!=='Processing'){commit(w=>beginProcessing(w,p.id));continue;}
   if(gate.ready&&cycle?.phase==='Processing'){const key=`stage:${p.id}:${cycle.signature}:${cycle.stage}`;if(!timers.current.has(key))timers.current.set(key,setTimeout(()=>{timers.current.delete(key);if(!activeAdmin())return;commit(w=>advanceProcessing(w,p.id,cycle.signature))},650));}
  }
 },[workspace,sessionTick,database.loading,database.status]);
 function mutate(operation){setError('');if(database.status==='Unavailable'){setError('Database records could not be loaded. Restore the database connection before changing records.');return null;}try{return commit(operation)}catch(e){setError(e.message);return null;}}
 function change(action,detail,operation){return mutate(w=>event(operation(w),action,detail));}
 function reset(){for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();if(database.status!=='Browser storage'){commit(old=>mergeDatabaseRecords({...initialCycleWorkspace(),reports:[]},projectDatabaseRecords(old)));}else commit(()=>initialCycleWorkspace());}
 return {workspace,mutate,change,reset,error,setError,storageError,database};
}
