import {useState,useEffect,useRef} from 'react';
import {loadWorkspace,saveWorkspace,initialWorkspace,finishDemoReport} from '../services/reports';
export function useWorkspace(){
 const [workspace,setWorkspace]=useState(()=>{const w=loadWorkspace();return {...w,reports:w.reports.map(r=>r.status==='Processing'?{...r,status:'Pending'}:r)};});
 const [storageError,setStorageError]=useState(false);const timers=useRef([]);
 useEffect(()=>{setStorageError(!saveWorkspace(workspace));},[workspace]);
 useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
 function change(action,detail,update){setWorkspace(old=>({...update(old),audit:[{id:crypto.randomUUID(),time:new Date().toISOString(),action,detail},...old.audit].slice(0,500)}));}
 function updateReport(id,patch,action='Report updated'){change(action,id,w=>({...w,reports:w.reports.map(r=>r.id===id?{...r,...patch}:r),groupDrafts:(w.groupDrafts||[]).map(r=>r.id===id?{...r,...patch}:r)}));}
 function process(record){change('Demo processing started',`${record.company} · ${record.period}`,w=>({...w,reports:[record,...w.reports.filter(r=>r.id!==record.id)]}));const timer=setTimeout(()=>{const done=finishDemoReport(record);updateReport(record.id,done,done.status==='Validated'?'Demo validation passed':'Demo validation failed');},2200);timers.current.push(timer);}
 function reset(){timers.current.forEach(clearTimeout);timers.current=[];setWorkspace(initialWorkspace());}
 return {workspace,change,updateReport,process,reset,storageError};
}
