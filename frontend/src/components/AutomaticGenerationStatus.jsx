import React from 'react';
export default function AutomaticGenerationStatus({status,onResume}){
 if(!status)return null;
 const paused=status.state==='paused',complete=status.state==='complete';
 return <section className="agent-progress" aria-label="Automatic results preparation"><div><strong>{complete?'Insights and reports are ready for review':paused?'Automatic preparation paused':'Preparing insights and reports'}</strong><p role="status">{complete?`${status.total} scopes prepared. Select a company, sector or group to view its results. Reports await admin approval.`:`${status.completed||0} of ${status.total||'…'} scopes prepared${status.scope?` · ${status.scope.type}: ${status.scope.id}`:''}${!paused&&status.stage?` · ${status.stage}`:''}`}</p>{paused&&<p role="alert">{status.error} Completed results are saved.</p>}</div>{paused&&<button className="secondary" onClick={onResume}>Retry remaining generation</button>}</section>;
}
