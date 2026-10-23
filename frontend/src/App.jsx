import ReportingAgentPanel from './components/ReportingAgentPanel';
import React,{useState,useEffect} from 'react';
import Icon from './components/Icon';
import {Brand,Logo,Notice,Panel,Field,Empty,CatalogContext} from './components/UI';
import {useReportingCycle} from './hooks/useReportingCycle';
import {AuthContext,canOpen} from './hooks/auth';
import {submitVersion,saveValidationResult,failValidation,saveGeminiExplanation,reviewValidation,reviewFinal,generateFinal,configurePeriod,completeDemoReports} from './services/cycle';
import {CycleDashboard,Monitoring,ReadinessPage,VersionHistory,CycleValidation,CycleUpload,ApprovedResults,AnalysisPage,FinalReportReview,NotificationsPage} from './pages/CyclePages';
import {CompanyAdministration,UserAdministration,PeriodAdministration} from './pages/AdministrationPages';
import {AuditPage} from './pages/WorkspacePages';

const titles={dashboard:'Dashboard',upload:'Upload monthly report',history:'My submissions',validation:'Validation result',approved:'Approved results',monitoring:'Submission monitoring',readiness:'Consolidation readiness',analysis:'Financial Analysis & Insights',management:'Management reports',companies:'Companies & sectors',users:'Users',periods:'Reporting periods',notifications:'Notifications',settings:'Workspace settings',audit:'Audit trail'};
const companyNav=[['dashboard','▦','Dashboard'],['upload','↑','Upload Report'],['history','▤','My Submissions'],['approved','✓','Approved Results'],['notifications','◷','Notifications']];
const adminNav=[['dashboard','▦','Dashboard'],['monitoring','▤','Submission Monitoring'],['readiness','⇄','Consolidation Readiness'],['analysis','▥','Analysis & Insights'],['management','▧','Management Reports'],['companies','◈','Companies & Sectors'],['users','♙','Users'],['periods','▣','Reporting Periods']];
function getRoute(){const [page,id]=location.hash.slice(1).split('/');let decoded=null;try{decoded=id?decodeURIComponent(id):null}catch{}return {page:page||'dashboard',id:decoded}}
function readSession(){try{return JSON.parse(sessionStorage.getItem('finagenticai.session.v3'))}catch{return null}}
function Login({w,onLogin}){
 const [role,setRole]=useState('admin'),[company,setCompany]=useState('TTPL'),[username,setUsername]=useState('finance@demo.dhi'),[password,setPassword]=useState(''),[show,setShow]=useState(false),[error,setError]=useState('');
 const eligible=w.users.filter(u=>u.active&&u.role===role&&(role==='admin'||u.company===company));
 const companies=w.companies.filter(c=>c.reporting&&w.users.some(u=>u.active&&u.role==='subsidiary'&&u.company===c.id));
 function choose(nextRole,nextCompany){setRole(nextRole);setCompany(nextCompany);setUsername(w.users.find(u=>u.active&&u.role===nextRole&&(nextRole==='admin'||u.company===nextCompany))?.email||'');setError('');}
 return <main className="login-layout"><section className="login-story"><div className="login-brand"><Brand/><div className="dhi-lockup"><Logo large/><span>DRUK HOLDING & INVESTMENTS<small>Group finance workspace</small></span></div></div><div className="login-story-copy"><span className="eyebrow light">DRUK HOLDING & INVESTMENTS</span><h1>Financial clarity,<br/>at your fingertips.</h1><p>Bring every monthly submission together, track reviews, and explore the financial picture across the DHI group.</p></div><div className="login-art" aria-hidden="true"><div className="art-orbit"/><div className="art-income"><span>Group performance</span><strong>Financial overview</strong><div className="art-line"><i/><i/><i/><i/><i/><i/><i/></div><small>Monthly reporting · DHI</small></div><div className="art-bars"><span>Reporting progress</span><div><i/><i/><i/><i/><i/><i/></div><small>Submission status</small></div><div className="art-transaction"><span className="art-dot">↗</span><div><strong>Reports in review</strong><small>Finance workspace</small></div><b>Active</b></div></div><div className="login-story-foot">MONTHLY FINANCIAL REPORTING <span>·</span> DHI GROUP</div></section><section className="login-form"><div className="login-card"><span className="login-kicker">DHI FINANCE WORKSPACE</span><h2>Welcome back</h2><p className="login-subtitle">Sign in to continue to your financial workspace.</p><form onSubmit={e=>{e.preventDefault();const user=eligible.find(u=>u.email.toLowerCase()===username.trim().toLowerCase());if(!user||!password.trim()){setError('Enter an active account email and password.');return;}onLogin(user);setPassword('')}} noValidate><Field label="Workspace role"><select value={role} onChange={e=>choose(e.target.value,company)}><option value="admin">DHI Finance Officer/Admin</option><option value="subsidiary">Company Finance Officer</option></select></Field>{role==='subsidiary'&&<Field label="Company"><select value={company} onChange={e=>choose(role,e.target.value)}>{companies.map(c=><option key={c.id}>{c.id}</option>)}</select></Field>}<Field label="Account"><select value={username} onChange={e=>setUsername(e.target.value)}>{eligible.map(u=><option key={u.id} value={u.email}>{u.name} — {u.email}</option>)}</select></Field><Field label="Email/username"><input autoComplete="username" value={username} onChange={e=>{setUsername(e.target.value);setError('')}}/></Field><Field label="Password"><div className="password-field"><input aria-label="Password" type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>{setPassword(e.target.value);setError('')}} placeholder="Enter your password"/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?'Hide':'Show'}</button></div></Field>{error&&<Notice type="error">{error}</Notice>}<button className="primary full">Sign in →</button></form></div><div className="login-form-foot">© Druk Holding & Investments</div></section></main>;
}

export default function App(){
 const {workspace:w,mutate,change,reset,error,setError,storageError}=useReportingCycle();const [loginRecord,setLoginRecord]=useState(readSession),[route,setRoute]=useState(getRoute),[periodId,setPeriodId]=useState(w.currentPeriod),[mobileMenu,setMobileMenu]=useState(false),[toast,setToast]=useState(''),[resetConfirm,setResetConfirm]=useState(false);
 const account=w.users.find(u=>u.id===loginRecord?.userId&&u.active);const session=account?{userId:account.id,name:account.name,role:account.role,company:account.company}:null;const period=w.periods.find(p=>p.id===periodId)||w.periods.find(p=>p.id===w.currentPeriod)||w.periods[0];
 useEffect(()=>{const fn=()=>{setRoute(getRoute());setError('')};window.addEventListener('hashchange',fn);return ()=>window.removeEventListener('hashchange',fn)},[]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),4500);return ()=>clearTimeout(t)}},[toast]);
 function navigate(page,id){setMobileMenu(false);setError('');location.hash=`#${page}${id?'/'+encodeURIComponent(id):''}`;setRoute({page,id:id||null});window.scrollTo(0,0)}
 function login(user){setToast('');const record={userId:user.id};setLoginRecord(record);try{sessionStorage.setItem('finagenticai.session.v3',JSON.stringify(record))}catch{}setPeriodId(w.currentPeriod);navigate('dashboard')}
 function logout(){setToast('');setMobileMenu(false);setLoginRecord(null);try{sessionStorage.removeItem('finagenticai.session.v3')}catch{}navigate('dashboard')}
 const catalog=<CatalogContext.Provider value={w.companies}>{!session?<Login w={w} onLogin={login}/>:renderWorkspace()}</CatalogContext.Provider>;
 return <AuthContext.Provider value={{session,login,logout}}>{catalog}</AuthContext.Provider>;
 function renderWorkspace(){
  const requested=route.page==='consolidation'?'readiness':route.page==='insights'?(session.role==='admin'?'analysis':'approved'):route.page==='ai'?'analysis':route.page;
  const allowed=!!titles[requested]&&canOpen(session.role,requested);const page=allowed?requested:'dashboard';const report=w.reports.find(r=>r.id===route.id&&(session.role==='admin'||r.company===session.company));
  const nav=session.role==='admin'?adminNav:companyNav;
  function correct(r){const p=w.periods.find(p=>p.period===r.period);if(p)setPeriodId(p.id);navigate('upload')}
  function saveCompany(c){const copy={...c};delete copy.originalId;change('Company updated',c.id,old=>({...old,companies:old.companies.some(x=>x.id===c.id)?old.companies.map(x=>x.id===c.id?copy:x):[...old.companies,copy]}));setToast('Company saved. Existing period membership is unchanged.');}
  function saveUser(user){change('User updated',user.email,old=>({...old,users:old.users.some(x=>x.id===user.id)?old.users.map(x=>x.id===user.id?user:x):[...old.users,user]}));setToast('User saved.');}
  function savePeriod(p){change('Reporting period configured',p.period,old=>configurePeriod(old,p));setPeriodId(p.id);setToast('Reporting period saved.');}
  async function submitReport(input){
   const next=mutate(old=>submitVersion(old,input,session));if(!next)return;
   const submitted=next.reports.find(r=>r.company===input.company&&r.period===period.period)||next.reports[0];
   const id=submitted.id;navigate('validation',id);
   try{
    const buffer=await input.file.arrayBuffer(),bytes=new Uint8Array(buffer);let binary='';
    for(let offset=0;offset<bytes.length;offset+=32_768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32_768));
    const response=await fetch(import.meta.env.BASE_URL+'api/gemini/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({submissionId:id,version:submitted.revision,company:input.company,period:period.period,fileName:input.file.name,fileBase64:btoa(binary)})});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'The workbook could not be validated.');
    mutate(old=>saveValidationResult(old,id,{validation:payload,gemini:{status:'pending',summary:'Gemini is preparing an advisory explanation of deterministic findings.',explanations:[]}}));
    if(!input.allowGemini){mutate(old=>saveGeminiExplanation(old,id,{status:'not_requested',summary:'Workbook checks completed locally. No explanation was requested.',explanations:[]}));return;}
    try{
     const explanationResponse=await fetch(import.meta.env.BASE_URL+'api/gemini/explain-validation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consent:input.allowGemini,company:input.company,period:period.period,validation:payload})});
     const explanation=await explanationResponse.json().catch(()=>({}));if(!explanationResponse.ok)throw new Error(explanation.error||'Gemini explanation is unavailable.');
     mutate(old=>saveGeminiExplanation(old,id,explanation));
    }catch(reason){mutate(old=>saveGeminiExplanation(old,id,{status:'unavailable',summary:reason.message||'Gemini explanation is unavailable. Deterministic findings remain authoritative.',explanations:[]}));}
   }catch(reason){mutate(old=>failValidation(old,id,reason.message||'Deterministic validation could not complete.'));}
  }
  return <div className="app-layout"><aside className={mobileMenu?'menu-open':''}><Brand/><div className="sidebar-dhi"><Logo/><span>DHI GROUP<small>Financial reporting</small></span></div><div className="workspace-label">{session.role==='admin'?'DHI FINANCE':session.company+' WORKSPACE'}</div><nav aria-label="Main navigation">{nav.map(([key,icon,label])=><button key={key} aria-label={label} className={page===key?'active':''} aria-current={page===key?'page':undefined} onClick={()=>navigate(key)}><Icon name={key}/>{label}</button>)}</nav><div className="sidebar-bottom">{session.role==='admin'&&<button className="logout" onClick={()=>navigate('settings')}>Workspace settings</button>}<button className="logout" onClick={logout}><Icon name="logout"/>Logout</button></div></aside><div className="main-shell"><header><button className="menu-button secondary" aria-label="Toggle navigation" aria-expanded={mobileMenu} onClick={()=>setMobileMenu(!mobileMenu)}><Icon name="menu"/></button><div className="workspace-identity"><Logo id={session.role==='admin'?'DHI':session.company}/><div><strong>{session.role==='admin'?'DHI Finance Officer/Admin':session.company+' · Company Finance Officer'}</strong><small>{session.role==='admin'?'Druk Holding & Investments':w.companies.find(c=>c.id===session.company)?.name}</small></div></div><div className="user"><span className="avatar">{session.name[0]}</span><span>{session.name}<small>{session.role==='admin'?'DHI Finance':session.company}</small></span></div></header><main className="content"><div className="page-heading"><div><h1>{titles[page]}</h1></div><div className="period-switch"><Field label="Workspace reporting period"><select value={period.id} onChange={e=>{setPeriodId(e.target.value);navigate('dashboard')}}>{w.periods.map(p=><option key={p.id} value={p.id}>{p.period} · {p.state}</option>)}</select></Field></div></div>{!allowed&&<Notice type="error">This page is not available to your role.</Notice>}{error&&<Notice type="error">{error}</Notice>}{storageError&&<Notice type="error">Browser storage is unavailable. Changes will not survive refresh.</Notice>}
   {page==='dashboard'&&<CycleDashboard w={w} period={period} session={session} navigate={navigate}/>}
   {page==='monitoring'&&<Monitoring w={w} period={period} navigate={navigate}/>}
   {page==='readiness'&&<ReadinessPage w={w} period={period} onCompleteDemo={()=>mutate(old=>completeDemoReports(old,period.id))}/>}
   {page==='history'&&<VersionHistory w={w} period={period} session={session} navigate={navigate} onCorrection={correct}/>}
   {page==='upload'&&<CycleUpload key={`${period.id}-${session.company}`} w={w} period={period} session={session} onSubmit={submitReport}/>}
   {page==='validation'&&<CycleValidation w={w} report={report} session={session} navigate={navigate} onCorrection={correct} onReview={(id,decision,reason)=>{const next=mutate(old=>reviewValidation(old,id,session,decision,reason));if(next)setToast(decision==='approve'?'Validation findings were recorded as reviewed.':'Validation findings were rejected.')}}/>}
   {page==='approved'&&<ApprovedResults key={route.id||'list'} w={w} session={session} id={route.id}/>}
   {page==='analysis'&&<AnalysisPage key={period.id} w={w} period={period}/>}
   {page==='management'&&<ReportingAgentPanel key={'reporting-'+period.id} w={w} period={period}/>}
   {page==='management'&&<FinalReportReview key={period.id} w={w} period={period} session={session} onReview={(id,action,remark)=>{const next=mutate(old=>reviewFinal(old,id,action,session,remark));if(next)setToast(action==='approve'?'Approved and published to the included company dashboards.':'Revision requested.')}} onRegenerate={id=>mutate(old=>generateFinal(old,id))}/>}
   {page==='companies'&&<CompanyAdministration w={w} onSave={saveCompany}/>}
   {page==='users'&&<UserAdministration w={w} onSave={saveUser}/>}
   {page==='periods'&&<PeriodAdministration w={w} onSave={savePeriod} onSelect={id=>{setPeriodId(id);navigate('dashboard')}}/>}
   {page==='notifications'&&<NotificationsPage w={w} session={session} onRead={id=>mutate(old=>({...old,notifications:old.notifications.map(n=>n.id===id?{...n,readBy:[...new Set([...n.readBy,session.userId])]}:n)}))}/>}
   {page==='audit'&&<AuditPage audit={w.audit}/>}
   {page==='settings'&&<><Panel title="Workspace controls" className="form-panel"><p>Review reporting activity and manage the records in this workspace.</p><button className="secondary" onClick={()=>navigate('audit')}>View audit trail</button></Panel><Panel title="Reset workspace records" className="form-panel spaced"><p>Restore the initial reporting records. Current submissions and approval history will be cleared.</p>{resetConfirm?<div className="form-actions"><button className="danger" onClick={()=>{reset();localStorage.removeItem('finagenticai.reporting-drafts.v1');setResetConfirm(false);logout()}}>Confirm reset</button><button className="secondary" onClick={()=>setResetConfirm(false)}>Cancel</button></div>:<button className="secondary" onClick={()=>setResetConfirm(true)}>Reset workspace</button>}</Panel></>}
   </main></div>{toast&&<div className="toast" role="status">✓ {toast}<button aria-label="Dismiss notification" onClick={()=>setToast('')}>×</button></div>}</div>;
 }
}



