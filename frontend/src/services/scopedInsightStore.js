import {importInsightFile,buildScopePackage} from '../../shared/scopedReports.mjs';
const key='finagenticai.scoped-insights.v2';
export function readScopedInsights(){try{const rows=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(rows)?rows:[];}catch{return [];}}
export function saveScopedInsights(file,cycle){importInsightFile(file,cycle);localStorage.setItem(key,JSON.stringify([file,...readScopedInsights().filter(f=>f?.input_signature!==file.input_signature)].slice(0,100)));if(typeof window!=='undefined')window.dispatchEvent(new Event('finagenticai-insights-changed'));}
export function findScopedInsights(cycle,scope){try{const signature=buildScopePackage(cycle,scope).input.input_signature;const file=readScopedInsights().find(f=>f?.input_signature===signature);if(file){importInsightFile(file,cycle);return file;}}catch{}return null;}
