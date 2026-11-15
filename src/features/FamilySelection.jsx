import React, { createContext, useContext, useEffect } from 'react';
import { Field } from '../ui';
import {useViewPreference} from './navigation';

const FamilyContext=createContext({childId:'',setChildId:()=>{}});
export function FamilySelectionProvider({children}) {
  const [childId,setChildId]=useViewPreference('child','');
  return <FamilyContext.Provider value={{childId,setChildId}}>{children}</FamilyContext.Provider>;
}
export function useFamilySelection(){return useContext(FamilyContext);}
export function FamilySelector({students=[]}) {
  const {childId,setChildId}=useFamilySelection();
  const active=students.filter(s=>!s.deleted_at);
  useEffect(()=>{if(childId&&active.length&&!active.some(s=>s.id===childId))setChildId('');},[childId,students]);
  if(active.length<2)return null;
  return <div className="family-selector"><Field label="Show learning for"><select value={active.some(s=>s.id===childId)?childId:''} onChange={event=>setChildId(event.target.value)}><option value="">All children</option>{active.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field><p>Your choice follows you through children, lessons, homework and progress. Billing always shows the family account.</p></div>;
}
