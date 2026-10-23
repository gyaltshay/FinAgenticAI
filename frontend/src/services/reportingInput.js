// Adapter for the current validation-agent output. Keep the insights contract independent.
const aliases={revenue:['revenue','revenues','totalrevenue'],expenses:['expenses','expense','totalexpenses','totalexpense'],profit:['netprofitaftertax','profitaftertax','pat'],headcount:['headcount','totalheadcount']};
export function submissionSignature(report){const text=JSON.stringify({id:report.id,revision:report.revision,period:report.period,validation:report.schemaValidationResult,review:report.humanReview||null});let hash=14695981039346656037n;for(let i=0;i<text.length;i++)hash=BigInt.asUintN(64,(hash^BigInt(text.charCodeAt(i)))*1099511628211n);return `submission-v1-${hash.toString(16)}`;}
export function reportingSignature(report,{scale,currency}){return `${submissionSignature(report)}:${scale}:${currency}`;}
export function buildReportingInput(report,{scale,currency,insights=null}){
 const validation=report.schemaValidationResult;if(!validation)throw new Error('A completed workbook validation result is required.');
 const captures=(validation.checks||[]).filter(c=>c.rule_id==='SOURCE-EVIDENCE'&&c.sheet==='Month Financials');
 const records=[],sources=[];
 for(const [metric,names] of Object.entries(aliases))for(const role of ['actual','plan','previous_month','prior_year']){
  const matches=captures.filter(c=>names.includes(String(c.actual_value?.original_label||'').toLowerCase().replace(/[^a-z0-9]/g,''))&&c.actual_value?.column_role===role&&typeof c.actual_value?.parsed_value==='number'&&Number.isFinite(c.actual_value.parsed_value));
  if(matches.length>1)throw new Error(`Ambiguous ${metric} ${role} mapping. Resolve the source mapping first.`);
  if(!matches.length)continue;const c=matches[0],id=`${metric}-${role}`;
  const raw=String(c.actual_value.parsed_value);if(!/^-?\d{1,18}(\.\d{1,12})?$/.test(raw))throw new Error(`Confirm decimal precision for ${metric} at ${c.sheet}!${c.cell} before reporting.`);
  records.push({id,label:metric==='profit'?'Reported net profit/(loss)':metric[0].toUpperCase()+metric.slice(1),entity_id:report.company,period:report.period,metric,time_basis:'month',role:role==='previous_month'?'prior_month':role,value:raw,unit:metric==='headcount'?'count':'currency',scale:metric==='headcount'?'units':scale,source_refs:['src-'+id]});
  sources.push({id:'src-'+id,document:c.source_evidence?.workbook||report.file,location:`${c.sheet}!${c.cell}`});
 }
 if(!records.length)throw new Error('No supported monthly financial records were captured. Supply mapped reporting JSON through the API for other layouts.');
 return {schema_version:'1.0',snapshot_id:report.id,input_signature:reportingSignature(report,{scale,currency}),scope:{type:'company',id:report.company},period:report.period,validation:{status:validation.validation_status,reviewer:report.humanReview?.reviewer||null,reason:report.humanReview?.reason||null},currency,units_confirmed:true,consolidated:false,records,sources,insights};
}
