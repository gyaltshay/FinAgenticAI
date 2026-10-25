import React,{useState} from 'react';

export default function OriginalWorkbook({report}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const receipt=report?.originalWorkbook;
 if(!receipt)return null;
 async function download(){
  setBusy(true);setError('');
  try{
   const response=await fetch(import.meta.env.BASE_URL+'api/storage/workbooks/download',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({originalWorkbook:receipt})});
   if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error||'The original workbook could not be downloaded.');}
   const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=receipt.fileName;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(reason){setError(reason.message);}finally{setBusy(false);}
 }
 return <span><button className="text-button" disabled={busy} onClick={download}>{busy?'Downloading…':'Download original'}</button>{error&&<small role="alert">{error}</small>}</span>;
}
