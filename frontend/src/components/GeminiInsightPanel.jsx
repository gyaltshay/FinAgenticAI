import React,{useState} from 'react';
import {Notice} from './UI';
import {productText} from './productText';

export default function GeminiInsightPanel({period,scope,records,reportId,fallback}){
 const [result,setResult]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function generate(){
  setLoading(true);setError('');
  try{
   const response=await fetch(import.meta.env.BASE_URL+'api/gemini/insights',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reportId,period,scope,records})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error([payload.error,payload.providerMessage].filter(Boolean).join(' ')||'Gemini could not generate insights.');
   setResult(payload);
  }catch(reason){setError(reason.message||'Could not connect to Gemini.');}
  finally{setLoading(false);}
 }
 return <section className="insight-panel">
  <span className="eyebrow">GEMINI FINANCIAL INSIGHTS</span>
  <h2>{scope} observations</h2>
  <p>{result?.overall_summary||productText(fallback.narrative)}</p>
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
  </>:<ul className="summary-list">{fallback.summary.map((item,index)=><li key={index}>{productText(item)}</li>)}</ul>}
  <div className="form-actions"><button className="secondary" onClick={generate} disabled={loading}>{loading?'Generating…':result?'Regenerate with Gemini':'Generate with Gemini'}</button></div>
  <p className="helper">The local backend computes metrics from this scope’s validated submission records before sending metrics and validation references to Google Gemini. Review AI explanations before relying on them.</p>
  {error&&<Notice type="error">{productText(error)}</Notice>}
 </section>;
}
