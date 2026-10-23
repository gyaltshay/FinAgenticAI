import schema from '../../../.agents/skills/financial-insight-agent/schemas/insight-result.schema.json' with {type:'json'};
import {computeFinancialMetrics,collectValidationEvidence,validateInsightResult} from '../../server/financial-insight.mjs';
// Adapt the collaborator's native result only after checking it against this submission.
export function adaptInsightResult(result,input,submission){
 if(result.report_id!==input.snapshot_id||result.reporting_period!==input.period)throw new Error('Insights must identify this exact company submission and period. Regenerate company insights for this submission.');
 const records=[{company:submission.company,validation:submission.schemaValidationResult}];
 const context={metrics:computeFinancialMetrics(records),...collectValidationEvidence(records)};
 const errors=validateInsightResult(result,schema,context);if(errors.length)throw new Error(errors[0]);
 const metricRecords={revenue:['revenue-actual'],expenses:['expenses-actual'],profit:['profit-actual'],plannedRevenue:['revenue-plan'],previousRevenue:['revenue-prior_month'],priorYearRevenue:['revenue-prior_year'],revenueGrowthPct:['revenue-actual','revenue-prior_month'],revenueYearOverYearPct:['revenue-actual','revenue-prior_year'],profitMarginPct:['profit-actual','revenue-actual'],varianceFromPlan:['revenue-actual','revenue-plan'],variancePct:['revenue-actual','revenue-plan'],efficiencyPct:['expenses-actual','revenue-actual']};
 const refs=new Set(input.records.map(r=>r.id));
 const sourceId=reference=>input.sources.filter(s=>reference===`${submission.company}: ${s.document} · ${s.location}`).map(s=>s.id);
 const severity={HIGH:'significant',MEDIUM:'attention',LOW:'information',INFO:'information',REVIEW_REQUIRED:'attention'};
 const category={variance:'variance',trend:'trend',anomaly:'anomaly',positive_performance:'opportunity',data_quality_impact:'risk',management_summary:'trend',other:'risk'};
 const findings=result.insights.map(f=>{const record_refs=[...new Set((f.evidence||[]).flatMap(e=>{const key=Object.keys(metricRecords).find(k=>k.toLowerCase()===e.metric.toLowerCase());return key?metricRecords[key]:[];}).filter(id=>refs.has(id)))];const source_refs=[...new Set([...f.source_references,...(f.evidence||[]).map(e=>e.source_reference).filter(Boolean)].flatMap(sourceId))];if(!record_refs.length&&!source_refs.length)throw new Error(`Insight ${f.id} has no evidence mapped to the reporting records. Review its source mapping.`);return {id:f.id,category:category[f.type],severity:severity[f.severity],text:`${f.title}: ${f.interpretation}`,record_refs,source_refs,recommendation:f.suggested_action||null};});
 return {schema_version:'1.0',scope_id:input.scope.id,period:input.period,input_signature:input.input_signature,summary:result.overall_summary||'Insights supplied for finance review.',limitations:[`Upstream review status: ${result.review_status}`,...result.limitations],findings};
}
