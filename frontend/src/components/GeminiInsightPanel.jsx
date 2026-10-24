import {download} from '../services/reports';
import React,{useState} from 'react';
import {Notice} from './UI';
import {productText} from './productText';
import {findInsightResult,saveInsightResult} from '../services/insightStore';

export default function GeminiInsightPanel({period,scope,records,reportId,fallback}){
 const liveEligible=records?.length>0&&records.every(r=>r.validation);
 const [result,setResult]=useState(()=>findInsightResult(reportId,period)),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function generate(){
  setLoading(true);setError('');
  try{
   const response=await fetch(import.meta.env.BASE_URL+'api/gemini/insights',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reportId,period,scope,records})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error([payload.error,payload.providerMessage].filter(Boolean).join(' ')||'Gemini could not generate insights.');
   setResult(payload);
   try{saveInsightResult(payload);}catch{setError('Insights were generated, but could not be saved for the Reporting Agent. Download the JSON and import it there.');}
  }catch(reason){setError(reason.message||'Could not connect to Gemini.');}
  finally{setLoading(false);}
 }
 function printReport(){
  const previousTitle=document.title;
  const filePart=`${scope}-${period}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  document.title=`${filePart}-financial-insights`;
  window.print();
  window.setTimeout(()=>{document.title=previousTitle;},1000);
 }
 return <section className="insight-panel insight-document">
  <div className="insight-report-heading"><span className="eyebrow">FINANCIAL INSIGHTS REPORT</span><p className="insight-report-meta">{scope} · {period} · Generated {result?.generated_at?new Date(result.generated_at).toLocaleString():''}</p></div>
  <span className="eyebrow">GEMINI FINANCIAL INSIGHTS</span>
  <h2>{scope} observations</h2>
  <p>{result?.overall_summary||productText(fallback.narrative||'Review the financial figures for this scope.')}</p>
  {result? <>
   <p className="helper">Review status: {result.review_status.replaceAll('_',' ')} · Insights require finance-officer review.</p>
   <div className="summary-list">{result.insights.map(item=><article key={item.id}>
    <h3>{item.title} <small>{item.severity}</small></h3>
    <p>{item.interpretation}</p>
    {item.evidence?.map((evidence,index)=><p className="helper" key={index}><b>{evidence.metric}:</b> {String(evidence.value)}{evidence.unit?` ${evidence.unit}`:''}{evidence.comparison?` · ${evidence.comparison}`:''}</p>)}
    <p><b>Follow-up:</b> {item.suggested_action}</p>
    {item.source_references.length>0&&<p className="helper">Sources: {item.source_references.join('; ')}</p>}
   </article>)}</div>
   {result.limitations.length>0&&<><h3>Limitations</h3><ul className="summary-list">{result.limitations.map((item,index)=><li key={index}>{item}</li>)}</ul></>}
  </>:<ul className="summary-list">{(fallback.summary||[]).map((item,index)=><li key={index}>{productText(item)}</li>)}</ul>}
  <div className="form-actions insight-actions"><button className="secondary" onClick={generate} disabled={loading||!liveEligible}>{loading?'Generating…':result?'Regenerate with Gemini':'Generate with Gemini'}</button></div>
  {!liveEligible&&<p className="helper insight-screen-only">Prepared company records support this frontend cycle. Upload validated workbooks to generate live insights.</p>}
  {result&&<div className="form-actions insight-actions"><button className="secondary" onClick={()=>download('financial-insights.json',JSON.stringify(result,null,2),'application/json')}>Download insights JSON</button><button className="primary" onClick={printReport}>Print / Save as PDF</button></div>}
  <p className="helper">The local backend computes metrics from this scope’s validated submission records before sending metrics and validation references to Google Gemini. Review AI explanations before relying on them.</p>
  {error&&<Notice type="error">{productText(error)}</Notice>}
 </section>;
}
