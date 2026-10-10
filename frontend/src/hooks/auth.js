import {createContext,useContext} from 'react';
export const AuthContext=createContext(null);
export const useAuth=()=>useContext(AuthContext);
export const companyRoutes=['dashboard','upload','history','validation','approved','notifications'];
export function canOpen(role,page){return role==='admin'?page!=='approved'&&page!=='upload':role==='subsidiary'&&companyRoutes.includes(page);}
