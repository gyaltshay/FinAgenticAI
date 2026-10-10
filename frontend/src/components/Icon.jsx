import React from 'react';
const paths={
 dashboard:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
 upload:<><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></>,
 history:<><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7"/></>,
 monitoring:<><path d="M4 5h16v15H4zM8 3v4m8-4v4M4 10h16M8 14h2m4 0h2M8 17h2"/></>,
 readiness:<><path d="M4 4h6v6H4zM14 4h6v6h-6zM9 16h6v5H9zM7 10v3h10v-3m-5 3v3"/></>,
 analysis:<><path d="M4 3v18h17M8 17v-5m5 5V7m5 10V4"/></>,
 ai:<><path d="M4 17 9 12l4 3 7-10M16 5h4v4M4 21h16"/></>,
 management:<><path d="M5 3h11l4 4v14H5zM15 3v5h5M8 12h8m-8 4h5"/></>,
 companies:<><path d="M4 21V8h8v13m0-18h8v18M2 21h20M7 11h2m-2 4h2m-2 4h2m6-12h2m-2 4h2m-2 4h2"/></>,
 users:<><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/></>,
 periods:<><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M7 3v4m10-4v4M3 10h18M7 14h3m4 0h3m-10 4h3"/></>,
 notifications:<><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zm5 3h4"/></>,
 approved:<><circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/></>,
 logout:<><path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4"/></>,
 menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>,
 ledger:<><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M8 3v18M8 9h13M12 14h5m-5 3h5"/></>,
};
export default function Icon({name='ledger',className=''}){return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.ledger}</svg>}
