import React,{useEffect,useState} from 'react';
import {NextLesson} from './DashboardActions';
import {useFamilySelection} from './FamilySelection';

export default function FamilyUpcoming({students,onNavigate,service}){
  const {childId}=useFamilySelection();
  const [state,setState]=useState({loading:true,classes:[],error:''});
  useEffect(()=>{let active=true;setState({loading:true,classes:[],error:''});
    const selected=students.filter(student=>!student.deleted_at&&(!childId||student.id===childId));
    (async()=>{try{const results=await Promise.all(selected.map(student=>service.getUpcomingClasses({studentId:student.id,limit:5})));if(!active)return;const failure=results.find(result=>result.error);setState({loading:false,classes:results.flatMap(result=>result.data||[]),error:failure?'Your upcoming lessons could not be loaded. Open Lessons to retry.':''});}catch{if(active)setState({loading:false,classes:[],error:'Your upcoming lessons could not be loaded. Open Lessons to retry.'});}})();
    return()=>{active=false;};
  },[students,childId,service]);
  if(!students.some(student=>!student.deleted_at))return null;
  if(state.loading)return <p role="status">Loading upcoming family lessons…</p>;
  if(state.error)return <p role="alert">{state.error}</p>;
  return <NextLesson classes={state.classes} section="classes" onNavigate={onNavigate}/>;
}
