import React,{useState} from 'react';
import {Notice} from './UI';
import {productText} from './productText';

export default function GeminiInsightPanel({period,scope,data,fallback}){
 const [result,setResult]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function generate(){
  setLoading(true);setError('');
  try{
   const response=await fetch(import.meta.env.BASE_URL+'api/gemini/insights',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({period,scope,metrics:{revenue:data.revenue,expenses:data.expenses,profit:data.profit,revenueGrowthPct:data.growth,profitMarginPct:data.margin,varianceFromPlan:data.variance,variancePct:data.variancePercent,efficiencyPct:data.efficiency}})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error([payload.error,payload.providerMessage].filter(Boolean).join(' ')||'Gemini could not generate insights.');
   setResult(payload);
  }catch(reason){setError(reason.message||'Could not connect to Gemini.');}
  finally{setLoading(false);}
 }
 return <section className="insight-panel">
  <span className="eyebrow">GEMINI FINANCIAL INSIGHTS</span>
  <h2>{scope} observations</h2>
  <p>{result?.summary||productText(fallback.narrative)}</p>
  <ul className="summary-list">{(result?.insights||fallback.summary).map((item,index)=><li key={index}>{productText(item)}</li>)}</ul>
  <div className="form-actions"><button className="secondary" onClick={generate} disabled={loading}>{loading?'Generating…':result?'Regenerate with Gemini':'Generate with Gemini'}</button></div>
  <p className="helper">Generating sends this scope’s aggregate financial metrics to Google Gemini. Review all AI output before relying on it.</p>
  {error&&<Notice type="error">{productText(error)}</Notice>}
 </section>;
}
