import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {computeFinancialMetrics,mapValidatedFinancialValues,collectValidationEvidence,validateInsightResult} from '../server/financial-insight.mjs';

const schema=JSON.parse(await readFile(new URL('../../.agents/skills/financial-insight-agent/schemas/insight-result.schema.json',import.meta.url),'utf8'));

test('insight calculations are deterministic and use complete inputs only',()=>{
  const sourceValues=({revenue,expenses,profit,plannedRevenue,previousRevenue,priorYearRevenue})=>({checks:[...[[revenue,'Revenue','actual'],[expenses,'Expenses','actual'],[profit,'Net Profit After Tax','actual'],[plannedRevenue,'Revenue','plan'],[previousRevenue,'Revenue','previous_month'],[priorYearRevenue,'Revenue','prior_year']].map(([parsed_value,original_label,column_role])=>({rule_id:'SOURCE-EVIDENCE',actual_value:{parsed_value,original_label,column_role}}))]});
  const records=[{validation:sourceValues({revenue:120,expenses:80,profit:40,plannedRevenue:100,previousRevenue:100,priorYearRevenue:90})},{validation:sourceValues({revenue:180,expenses:120,profit:60,plannedRevenue:200,previousRevenue:150,priorYearRevenue:150})}];
  const metrics=computeFinancialMetrics(records);
  assert.equal(metrics.revenue,300);assert.equal(metrics.expenses,200);assert.equal(metrics.profit,100);
  assert.equal(metrics.varianceFromPlan,0);assert.equal(metrics.revenueGrowthPct,20);assert.equal(metrics.revenueYearOverYearPct,25);assert.ok(Math.abs(metrics.profitMarginPct-100/3)<1e-12);
  assert.equal(computeFinancialMetrics([{validation:records[0].validation},{validation:sourceValues({revenue:180,expenses:120,profit:null,plannedRevenue:200,previousRevenue:150,priorYearRevenue:150})}]).profit,null);
  const ambiguous=sourceValues({revenue:50,expenses:5,profit:2,plannedRevenue:0,previousRevenue:0,priorYearRevenue:0});ambiguous.checks.push({rule_id:'SOURCE-EVIDENCE',actual_value:{parsed_value:51,original_label:'Revenue',column_role:'actual'}});assert.equal(mapValidatedFinancialValues(ambiguous).revenue,null);
});

test('validation evidence is preserved as source references and review findings',()=>{
  const evidence=collectValidationEvidence([{company:'TTPL',validation:{checks:[{rule_id:'COMP-003',severity:'WARNING',message:'Missing value',requires_human_review:true,sheet:'Monthly PPR',cell:'C11',source_evidence:{workbook:'August.xlsx',sheet:'Monthly PPR',cell:'C11'}}]}}]);
  assert.deepEqual(evidence.references,['TTPL: August.xlsx · Monthly PPR!C11']);
  assert.equal(evidence.findings[0].rule_id,'COMP-003');
});

test('insight output must match schema and include evidence and human review',()=>{
  const result={report_id:'r1',reporting_period:'August 2026',overall_summary:'Revenue was below plan.',insights:[{id:'i1',type:'variance',severity:'MEDIUM',title:'Revenue below plan',evidence:[{metric:'Revenue',value:90,unit:'Nu.',comparison:'Plan: 100',source_reference:'TTPL: August.xlsx · Month Financials!C11'}],interpretation:'Revenue was below plan; the figures do not establish why.',suggested_action:'Ask which business lines drove the variance.',source_references:['TTPL: August.xlsx · Month Financials!C11'],requires_human_review:true}],limitations:[],review_status:'REVIEW_REQUIRED'};
  const context={metrics:{revenue:90},references:['TTPL: August.xlsx · Month Financials!C11']};
  assert.deepEqual(validateInsightResult(result,schema,context),[]);
  assert.match(validateInsightResult({...result,extra:'not allowed'},schema,context)[0],/not allowed/);
  assert.match(validateInsightResult({...result,insights:[{...result.insights[0],evidence:[]}]},schema,context)[0],/supporting evidence/);
  assert.match(validateInsightResult({...result,insights:[{...result.insights[0],requires_human_review:false}]},schema,context)[0],/must be true/);
  assert.match(validateInsightResult({...result,insights:[{...result.insights[0],evidence:[{...result.insights[0].evidence[0],value:91}]}]},schema,context)[0],/does not match a numeric backend metric/);
});
