import React from 'react';
export default function StatusMark({type}){
 const symbols={
  success:<><circle cx="10" cy="10" r="8"/><path d="m6.2 10 2.6 2.5 5-5.3"/></>,
  approved:<><path d="m10 1.5 7 3v5.2c0 4.2-7 8.7-7 8.7s-7-4.5-7-8.7V4.5z"/><path d="m6.4 9.6 2.4 2.4 4.8-5"/></>,
  error:<><path d="m6.6 2 6.8 0 4.6 4.6v6.8L13.4 18H6.6L2 13.4V6.6z"/><path d="m7.2 7.2 5.6 5.6m0-5.6-5.6 5.6"/></>,
  waiting:<><circle cx="10" cy="10" r="8"/><path d="M10 5.2v5.2l3.4 2.1"/></>,
  empty:<><circle cx="10" cy="10" r="8" strokeDasharray="3 3"/><path d="M6.7 10h6.6"/></>,
  progress:<><circle cx="10" cy="10" r="8" opacity=".2"/><path d="M10 2a8 8 0 0 1 8 8"/></>,
  neutral:<><rect x="3" y="3" width="14" height="14" rx="3"/><path d="M7 10h6"/></>,
 };
 return <svg className={`status-mark mark-${type}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{symbols[type]||symbols.neutral}</svg>;
}
