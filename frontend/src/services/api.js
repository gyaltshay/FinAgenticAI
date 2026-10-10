// Future backend boundary. Unused in demo mode: no upload or message leaves the browser.
export function createApiClient(baseUrl,fetcher=fetch){
 async function request(path,options={}){const response=await fetcher(`${baseUrl.replace(/\/$/,'')}${path}`,{credentials:'include',...options});if(!response.ok)throw new Error(`Request failed (${response.status})`);return response.status===204?null:response.json();}
 const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {
  login:body=>request('/auth/login',json('POST',body)),logout:()=>request('/auth/logout',{method:'POST'}),getSession:()=>request('/auth/me'),
  listCompanies:()=>request('/companies'),saveCompany:(id,body)=>request(id?`/companies/${encodeURIComponent(id)}`:'/companies',json(id?'PUT':'POST',body)),
  listUsers:()=>request('/users'),saveUser:(id,body)=>request(id?`/users/${encodeURIComponent(id)}`:'/users',json(id?'PUT':'POST',body)),
  listPeriods:()=>request('/periods'),savePeriod:(id,body)=>request(id?`/periods/${encodeURIComponent(id)}`:'/periods',json(id?'PUT':'POST',body)),
  listReports:()=>request('/reports'),uploadReport:formData=>request('/reports',{method:'POST',body:formData}),getReport:id=>request(`/reports/${encodeURIComponent(id)}`),
  getReadiness:id=>request(`/periods/${encodeURIComponent(id)}/readiness`),getProcessing:id=>request(`/periods/${encodeURIComponent(id)}/processing`),
  getConsolidation:period=>request(`/consolidation?period=${encodeURIComponent(period)}`),
  listFinalReports:id=>request(`/periods/${encodeURIComponent(id)}/management-reports`),regenerateFinal:id=>request(`/management-reports/${encodeURIComponent(id)}/regenerate`,{method:'POST'}),
  // Approval must publish included company snapshots atomically on the backend.
  reviewFinal:(id,body)=>request(`/management-reports/${encodeURIComponent(id)}/review`,json('POST',body)),
  getApprovedResults:()=>request('/me/approved-results'),listNotifications:()=>request('/notifications'),markNotificationRead:id=>request(`/notifications/${encodeURIComponent(id)}/read`,{method:'POST'}),
  queueReminder:body=>request('/reminders',json('POST',body)),getAudit:()=>request('/audit')
 };
}
