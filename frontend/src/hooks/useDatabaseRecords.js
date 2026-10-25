import {useEffect,useRef,useState} from 'react';
import {projectDatabaseRecords,mergeDatabaseRecords} from '../../shared/database-records.mjs';

export function useDatabaseRecords(workspace,commit){
 const latest=useRef(workspace);latest.current=workspace;
 const state=useRef({ready:false,revision:0,last:'',busy:false,stopped:false,flush:()=>{}});
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[status,setStatus]=useState('Connecting');
 useEffect(()=>{
  let disposed=false,retry;const db=state.current;db.stopped=false;
  async function request(method,body){
   const response=await fetch(import.meta.env.BASE_URL+'api/database/records',{method,headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
   // Static hosting has no database API. Retain the browser-only prototype there.
   if(method==='GET'&&response.status===404)return {configured:false};
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw Object.assign(new Error(payload.error||'The local database API is unavailable.'),{status:response.status});
   return payload;
  }
  async function flush(){
   if(disposed||!db.ready||db.busy||db.stopped)return;
   db.busy=true;
   try{
    while(!disposed){
     const records=projectDatabaseRecords(latest.current),text=JSON.stringify(records);if(text===db.last)break;
     setStatus('Saving');const result=await request('PUT',{revision:db.revision,records});
     if(!result.configured)throw new Error('The database connection was disabled. Reload before continuing.');
     db.revision=result.revision;db.last=text;
    }
    if(!disposed){setError('');setStatus('Connected');}
   }catch(reason){
    if(!disposed){setError(reason.message+' Changes remain in this browser until synchronized.');setStatus('Not saved');if(reason.status===409)db.stopped=true;else retry=setTimeout(flush,5000);}
   }finally{db.busy=false;}
  }
  db.flush=flush;
  async function initialize(){
   try{
    let payload=await request('GET');if(disposed)return;
    if(!payload.configured){setStatus('Browser storage');setLoading(false);return;}
    if(!payload.records)payload=await request('PUT',{revision:payload.revision,records:projectDatabaseRecords(latest.current)});
    if(disposed)return;
    const merged=mergeDatabaseRecords(latest.current,payload.records);
    db.revision=payload.revision;db.last=JSON.stringify(projectDatabaseRecords(merged));db.ready=true;
    commit(()=>merged);setError('');setStatus('Connected');setLoading(false);
   }catch(reason){if(!disposed){setError(reason.message+' Current records remain in browser storage.');setStatus('Unavailable');setLoading(false);retry=setTimeout(initialize,5000);}}
  }
  initialize();
  return ()=>{disposed=true;clearTimeout(retry);db.ready=false;db.flush=()=>{};};
 },[]);
 useEffect(()=>{state.current.flush();},[workspace]);
 return {loading,error,status};
}
