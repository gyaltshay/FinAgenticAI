// Compatibility boundary: reuse the exact financial contracts shared with React.
// This process has no HTTP server, database access, object-storage client or LLM key.
import {buildScopePackage,makeInsightFile,importInsightFile} from '../frontend/shared/scopedReports.mjs';
import {generateReport,reportMarkdown} from '../frontend/server/reporting.mjs';
import {validateDatabaseRecords} from '../frontend/shared/database-records.mjs';
try{
 let body='';for await(const chunk of process.stdin){body+=chunk;if(body.length>28_000_000)throw Object.assign(new Error('Request is too large.'),{status:413});}
 const {operation,input}=JSON.parse(body);let result;
 if(operation==='scope')result=buildScopePackage(input.cycle,input.scope);
 else if(operation==='insight_file')result=makeInsightFile(input.result,input.package);
 else if(operation==='report'){const pkg=importInsightFile(input.insightFile,input.cycle),report=generateReport(pkg.input);result={report,markdown:reportMarkdown(report)};}
 else if(operation==='database_records')result=validateDatabaseRecords(input);
 else throw new Error('Unknown financial compatibility operation.');
 process.stdout.write(JSON.stringify({result}));
}catch(error){process.stdout.write(JSON.stringify({error:error.message,status:error.status||422}));process.exitCode=1;}
