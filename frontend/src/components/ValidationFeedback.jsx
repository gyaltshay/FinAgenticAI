import React,{useState} from 'react';
import {Notice,Status} from './UI';
import {rawValidation,validationFindings,findingValue} from '../services/validationFeedback';

function FindingsTable({findings}){
 return <div className="table-scroll"><table><thead><tr><th>Check</th><th>What needs attention</th><th>Source</th></tr></thead><tbody>{findings.map((check,index)=><tr key={`${check.rule_id}-${index}`}><td><strong>{check.rule_id}</strong><small>{check.field||'Workbook check'}</small><Status status={check.failed?'Failed':'Review Required'}/></td><td><p>{check.message}</p>{[check.expected_value,check.actual_value,check.recomputed_value,check.difference].some(value=>value!==null&&value!==undefined)&&<details><summary>View values</summary><dl className="validation-values">{[['Expected',check.expected_value],['Actual',check.actual_value],['Recomputed',check.recomputed_value],['Difference',check.difference]].filter(([,value])=>value!==undefined&&value!==null).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{findingValue(value)}</dd></div>)}</dl></details>}</td><td>{check.location}</td></tr>)}</tbody></table></div>;
}

export default function ValidationFeedback({report,onExplain,onRecheck}){
 const [rechecking,setRechecking]=useState(false);
 const validation=rawValidation(report),findings=validationFindings(report),failed=findings.filter(f=>f.failed),review=findings.filter(f=>!f.failed);
 const explanation=report.geminiExplanation,busy=explanation?.status==='pending',validating=report.validationStatus==='Validating';
 async function recheck(){setRechecking(true);try{await onRecheck(report);}finally{setRechecking(false);}}
 const heading=busy?'Preparing Gemini explanation…':explanation?.status==='complete'?'Explanation of findings':explanation?.status==='not_requested'?'Gemini explanation not requested':explanation?.status==='unavailable'||explanation?.status==='error'?'Gemini explanation unavailable':'Explain these findings';
 return <div className="validation-feedback">
  {validation&&<section aria-labelledby="validation-findings-title"><h3 id="validation-findings-title">Validation findings</h3><p>{failed.length} failed {failed.length===1?'check':'checks'} · {review.length} requiring review</p>{failed.length>0&&<FindingsTable findings={failed}/>} {review.length>0&&<details className="validation-review-details" open={!failed.length}><summary>Checks requiring review ({review.length})</summary><FindingsTable findings={review}/></details>}{!findings.length&&<p>No failed checks or review findings were returned for this workbook.</p>}</section>}
  {!validation&&!validating&&<Notice>{report.issues?.length>0?<><strong>Reported issues</strong><ul>{report.issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul></>:report.frontendFixture?'This prepared record has no uploaded workbook validation findings.':'Detailed findings are not available in this browser.'}{report.originalWorkbook&&onRecheck&&<><p>Recheck the stored original to load its validation findings.</p><button className="secondary" disabled={rechecking} onClick={recheck}>{rechecking?'Checking stored workbook…':'Recheck stored workbook'}</button></>}</Notice>}
  {validation&&<section className="insight-panel" aria-label="Gemini explanation"><span className="eyebrow">GEMINI EXPLANATION</span><h3 aria-live="polite">{heading}</h3>{explanation?.summary&&<p>{explanation.summary}</p>}{explanation?.explanations?.map((item,index)=><p key={`${item.rule_id}-${index}`}><b>{item.rule_id}</b> — {item.explanation}</p>)}{!busy&&onExplain&&<button className="secondary" onClick={()=>onExplain(report)} disabled={validating}>{explanation?.status==='complete'?'Refresh Gemini explanation':'Explain findings with Gemini'}</button>}<p className="helper">The explanation uses the validation findings and their cell references. The validation result remains unchanged.</p></section>}
 </div>;
}
