import React, { useEffect, useState } from 'react';
import { getBookingRequests } from '../services/supabaseData';
import { NavLink } from './navigation';

export default function BookingNotice({role,onOpen}) {
  const [count,setCount]=useState(0);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{
      if(document.hidden)return;
      const {data,error}=await getBookingRequests();
      if(active&&!error)setCount((data||[]).filter(r=>r.status===(['parent','student'].includes(role)?'Proposed':'Pending')).length);
    };
    refresh();const timer=setInterval(refresh,60000);
    window.addEventListener('focus',refresh);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[role]);
  return count>0?<p role="status" className="booking-notice"><NavLink to="/portal/bookings" onNavigate={onOpen}>{count} booking {count===1?'request needs':'requests need'} your response →</NavLink></p>:null;
}
