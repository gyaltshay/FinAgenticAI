export function validateJsonSchema(value,schema,path='$') {
  const errors=[];
  if(schema.type){
    const types=Array.isArray(schema.type)?schema.type:[schema.type];
    const matches=type=>type==='null'?value===null:type==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):type==='array'?Array.isArray(value):type==='integer'?Number.isInteger(value):type==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===type;
    if(!types.some(matches))return [`${path} has an invalid type.`];
  }
  if(schema.enum&&!schema.enum.some(option=>Object.is(option,value)))errors.push(`${path} is outside its allowed enum.`);
  if(typeof value==='string'){
    if(schema.minLength!==undefined&&value.length<schema.minLength)errors.push(`${path} is shorter than its minimum length.`);
    if(schema.maxLength!==undefined&&value.length>schema.maxLength)errors.push(`${path} is longer than its maximum length.`);
  }
  if(Array.isArray(value)){
    if(schema.minItems!==undefined&&value.length<schema.minItems)errors.push(`${path} has fewer than its minimum items.`);
    if(schema.maxItems!==undefined&&value.length>schema.maxItems)errors.push(`${path} has more than its maximum items.`);
    if(schema.items)value.forEach((item,index)=>errors.push(...validateJsonSchema(item,schema.items,`${path}[${index}]`)));
  }
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    for(const key of schema.required||[])if(!Object.hasOwn(value,key))errors.push(`${path}.${key} is required.`);
    for(const [key,item] of Object.entries(value)){
      const child=schema.properties?.[key];
      if(!child){if(schema.additionalProperties===false)errors.push(`${path}.${key} is not allowed.`);continue;}
      errors.push(...validateJsonSchema(item,child,`${path}.${key}`));
    }
  }
  return errors;
}

const inputFields=['revenue','expenses','profit','plannedRevenue','previousRevenue','priorYearRevenue'];
const numeric=value=>typeof value==='number'&&Number.isFinite(value);
const labels={
  revenue:{aliases:['revenue','revenues','total revenue'],role:'actual'},
  expenses:{aliases:['expenses','expense','total expenses','total expense'],role:'actual'},
  profit:{aliases:['net profit after tax','profit after tax','pat'],role:'actual'},
  plannedRevenue:{aliases:['revenue','revenues','total revenue'],role:'plan'},
  previousRevenue:{aliases:['revenue','revenues','total revenue'],role:'previous_month'},
  priorYearRevenue:{aliases:['revenue','revenues','total revenue'],role:'prior_year'}
};
const normalize=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,'');

export function mapValidatedFinancialValues(validation) {
  const evidence=(validation?.checks||[]).filter(check=>check.rule_id==='SOURCE-EVIDENCE').map(check=>check.actual_value||{});
  return Object.fromEntries(Object.entries(labels).map(([field,{aliases,role}])=>{
    const accepted=new Set(aliases.map(normalize));
    const matches=evidence.filter(item=>accepted.has(normalize(item.original_label))&&item.column_role===role&&numeric(item.parsed_value));
    return [field,matches.length===1?matches[0].parsed_value:null];
  }));
}

export function computeFinancialMetrics(records) {
  const mapped=records.map(record=>mapValidatedFinancialValues(record.validation));
  const totals=Object.fromEntries(inputFields.map(field=>[
    field,mapped.length&&mapped.every(values=>numeric(values[field]))
      ?mapped.reduce((sum,values)=>sum+values[field],0):null
  ]));
  const pct=(current,base)=>numeric(current)&&numeric(base)&&base!==0?(current-base)/Math.abs(base)*100:null;
  const variance=numeric(totals.revenue)&&numeric(totals.plannedRevenue)?totals.revenue-totals.plannedRevenue:null;
  return {...totals,revenueGrowthPct:pct(totals.revenue,totals.previousRevenue),revenueYearOverYearPct:pct(totals.revenue,totals.priorYearRevenue),profitMarginPct:numeric(totals.profit)&&numeric(totals.revenue)&&totals.revenue!==0?totals.profit/totals.revenue*100:null,varianceFromPlan:variance,variancePct:numeric(variance)&&numeric(totals.plannedRevenue)&&totals.plannedRevenue!==0?variance/Math.abs(totals.plannedRevenue)*100:null,efficiencyPct:numeric(totals.expenses)&&numeric(totals.revenue)&&totals.revenue!==0?totals.expenses/totals.revenue*100:null};
}

export function collectValidationEvidence(records) {
  const references=[],findings=[];
  for(const record of records){
    const validation=record.validation;
    for(const check of validation.checks||[]){
      const sheet=check.sheet||check.source_evidence?.sheet;
      const cell=check.cell||check.source_evidence?.cell;
      const file=check.source_evidence?.workbook||validation.workbook?.filename;
      const sourceReference=sheet&&cell?`${record.company}: ${file||'workbook'} · ${sheet}!${cell}`:null;
      if(sourceReference)references.push(sourceReference);
      if(check.requires_human_review||['WARNING','ERROR','CRITICAL'].includes(check.severity))findings.push({company:record.company,rule_id:check.rule_id,severity:check.severity,message:check.message,source_reference:sourceReference});
    }
  }
  return {references:[...new Set(references)],findings};
}

export function validateInsightResult(result,schema,{metrics={},references=[],findings=[]}={}) {
  const errors=validateJsonSchema(result,schema);
  if(errors.length)return errors;
  if(!Array.isArray(result.insights))return ['$.insights must be an array.'];
  for(let index=0;index<result.insights.length;index++){
    const insight=result.insights[index];
    if(!Array.isArray(insight.evidence)||insight.evidence.length===0)errors.push(`$.insights[${index}].evidence must include supporting evidence.`);
    if(!insight.requires_human_review)errors.push(`$.insights[${index}].requires_human_review must be true for unreviewed AI insights.`);
    for(const [evidenceIndex,evidence] of (insight.evidence||[]).entries()){
      const metricKey=Object.keys(metrics).find(key=>key.toLowerCase()===String(evidence.metric).toLowerCase());
      const finding=findings.find(item=>item.rule_id===evidence.metric&&item.message===evidence.value);
      if(metricKey&&(!numeric(evidence.value)||!Object.is(evidence.value,metrics[metricKey])))errors.push(`$.insights[${index}].evidence[${evidenceIndex}].value does not match a numeric backend metric ${metricKey}.`);
      if(!metricKey&&!finding)errors.push(`$.insights[${index}].evidence[${evidenceIndex}] does not identify a supplied metric or validation finding.`);
      if(evidence.source_reference&&!references.includes(evidence.source_reference))errors.push(`$.insights[${index}].evidence[${evidenceIndex}].source_reference is not a supplied source reference.`);
    }
    for(const [referenceIndex,reference] of insight.source_references.entries())if(!references.includes(reference))errors.push(`$.insights[${index}].source_references[${referenceIndex}] is not a supplied source reference.`);
  }
  return errors;
}
