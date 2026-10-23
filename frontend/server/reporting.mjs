import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {validateContract} from './reporting-contract.mjs';
const base=new URL('../../.agents/skills/reporting-agent/schemas/',import.meta.url);
const inputSchema=JSON.parse(await readFile(new URL('reporting-input.schema.json',base),'utf8'));
const outputSchema=JSON.parse(await readFile(new URL('reporting-output.schema.json',base),'utf8'));
export function fingerprint(input){return createHash('sha256').update(JSON.stringify(input)).digest('hex');}
function requireThat(ok,message){if(!ok)throw Object.assign(new Error(message),{status:422});}
function unique(rows,label){const ids=rows.map(x=>x.id);requireThat(new Set(ids).size===ids.length,`Duplicate ${label} IDs.`);return new Set(ids);}
// Exact subtraction of source decimal strings, without binary floating-point arithmetic.
export function difference(a,b){const digits=Math.max((a.split('.')[1]||'').length,(b.split('.')[1]||'').length);const asInt=v=>{const negative=v.startsWith('-');const [whole,fraction='']=v.replace(/^-/,'').split('.');return BigInt(whole+fraction.padEnd(digits,'0'))*(negative?-1n:1n);};const n=asInt(a)-asInt(b),raw=(n<0n?-n:n).toString().padStart(digits+1,'0');return (n<0n?'-':'')+(digits?raw.slice(0,-digits)+'.'+raw.slice(-digits):raw);}
export function generateReport(input){
 const errors=validateContract(input,inputSchema);requireThat(!errors.length,errors[0]);
 requireThat(input.units_confirmed,'Finance must confirm the source currency and scale before report generation.');
 const v=input.validation;requireThat(v.status==='PASS'||(v.status==='NEEDS_REVIEW'&&v.reviewer?.trim()&&v.reason?.trim()),'Only passed or explicitly reviewed submissions can generate reports.');
 requireThat(input.scope.type==='company'||input.consolidated,'A consolidated snapshot is required for sector, group or DHI reports.');
 const records=unique(input.records,'record'),sources=unique(input.sources,'source');
 for(const r of input.records){requireThat(r.period===input.period&&r.entity_id===input.scope.id,'Record scope or period differs from report.');requireThat(r.source_refs.every(id=>sources.has(id)),'Unknown record source reference.');requireThat(r.unit!=='count'||r.scale==='units','Counts must use units.');}
 requireThat(input.records.some(r=>r.role==='actual'),'At least one actual record is required.');
 const findings=input.insights?.findings||[];
 if(input.insights){requireThat(input.insights.scope_id===input.scope.id&&input.insights.period===input.period&&input.insights.input_signature===input.input_signature,'Insights do not match this financial snapshot, scope or period.');unique(findings,'finding');for(const f of findings){requireThat(f.record_refs.length+f.source_refs.length>0,'Insights findings require evidence.');requireThat(f.record_refs.every(id=>records.has(id))&&f.source_refs.every(id=>sources.has(id)),'Unknown insight evidence reference.');}}
 const limitations=['Draft for finance review. No approval or publication has been performed.'];
 for(const limitation of input.insights?.limitations||[])limitations.push(`Insights: ${limitation}`);
 if(!input.insights)limitations.push('Insights have not been supplied; explanations, risks and recommendations are incomplete.');
 if(v.status==='NEEDS_REVIEW')limitations.push(`Validation exceptions accepted by ${v.reviewer}: ${v.reason}`);
 for(const metric of ['revenue','expenses','profit'])if(!input.records.some(r=>r.metric===metric&&r.role==='actual'))limitations.push(`Reported ${metric} is unavailable; no value has been inferred.`);
 if(input.scope.type==='company')limitations.push('Company scope only; no group accounting consolidation has been performed.');
 const item=(text,rs=[],ss=[],fs=[])=>({text,record_refs:rs,source_refs:ss,finding_refs:fs});
 const performance=input.records.filter(r=>r.role==='actual').map(r=>item(`${r.label}: ${r.value} ${r.unit==='count'?'count':input.currency} (${r.scale}; ${r.time_basis}).`,[r.id],r.source_refs));
 const comparisonItems=[];
 for(const r of input.records.filter(r=>r.role==='actual'))for(const role of ['plan','prior_month','prior_year']){const matches=input.records.filter(c=>c.metric===r.metric&&c.time_basis===r.time_basis&&c.role===role);const actuals=input.records.filter(c=>c.metric===r.metric&&c.time_basis===r.time_basis&&c.role==='actual');if(matches.length!==1||actuals.length!==1)continue;const c=matches[0];requireThat(c.scale===r.scale&&c.unit===r.unit,'Comparison units differ.');comparisonItems.push(item(`${r.label}, actual minus ${role.replaceAll('_',' ')}: ${difference(r.value,c.value)} (${r.scale}; ${r.time_basis}).`,[r.id,c.id],[...new Set([...r.source_refs,...c.source_refs])]));}
 const headline=input.records.filter(r=>r.role==='actual'&&['revenue','expenses','profit'].includes(r.metric));
 const summary=headline.length?[item(`For ${input.scope.id}, ${input.period}: `+headline.map(r=>`${r.label.toLowerCase()} was ${r.value} ${input.currency} (${r.scale}; ${r.time_basis})`).join('; ')+'.',headline.map(r=>r.id),[...new Set(headline.flatMap(r=>r.source_refs))])]:[item(`Financial performance for ${input.scope.id}, ${input.period}.`)];
 const sections=[{id:'summary',title:'Executive summary',items:summary},{id:'performance',title:'Financial performance',items:performance},{id:'comparisons',title:'Comparative performance',items:comparisonItems},{id:'insights',title:'Insights and risks',items:findings.map(f=>item(`[${f.severity}; ${f.category}] ${f.text}`,f.record_refs,f.source_refs,[f.id]))},{id:'actions',title:'Proposed management actions',items:findings.filter(f=>f.recommendation).map(f=>item(f.recommendation,f.record_refs,f.source_refs,[f.id]))}];
 const report={schema_version:'1.0',id:randomUUID(),input_hash:fingerprint(input),snapshot_id:input.snapshot_id,input_signature:input.input_signature,scope:input.scope,period:input.period,title:`${input.scope.id} — ${input.period} management report`,generated_at:new Date().toISOString(),generation_status:input.insights&&['revenue','expenses','profit'].every(m=>input.records.some(r=>r.metric===m&&r.role==='actual'))?'draft':'partial',review_status:'Awaiting review',currency:input.currency,records:input.records,sources:input.sources,sections,limitations};
 const outputErrors=validateContract(report,outputSchema);requireThat(!outputErrors.length,outputErrors[0]);return report;
}
const escapeMarkdown=v=>String(v).replace(/[\\`*_{}\[\]<>#!|]/g,'\\$&').replace(/[\r\n]+/g,' ');
export function reportMarkdown(report){requireThat(!validateContract(report,outputSchema).length,'Invalid reporting output.');return [`# ${escapeMarkdown(report.title)}`,`Status: ${report.generation_status} · ${report.review_status}`,`Snapshot: ${escapeMarkdown(report.snapshot_id)} · Input hash: ${report.input_hash}`,...report.sections.flatMap(s=>[`## ${escapeMarkdown(s.title)}`,...s.items.map(i=>`${escapeMarkdown(i.text)}${i.source_refs.length?' [Evidence: '+i.source_refs.map(escapeMarkdown).join(', ')+']':''}`)]),'## Limitations',...report.limitations.map(x=>'- '+escapeMarkdown(x)),'## Evidence',...report.sources.map(s=>`- ${escapeMarkdown(s.id)}: ${escapeMarkdown(s.document)} — ${escapeMarkdown(s.location)}`)].join('\n\n');}
