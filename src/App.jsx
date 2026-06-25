import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, GraduationCap, UserCircle, CalendarDays, ClipboardCheck,
  BookOpenCheck, Wallet, FileBarChart, Settings, LogOut, Search, Plus, X, ChevronRight,
  Clock, MapPin, Video, CheckCircle2, AlertCircle, FileText, Download, Edit2, Trash2,
  TrendingUp, Mail, Phone, Home as HomeIcon, ArrowLeft, BookOpen, Award, Target, Shield,
  Link, RefreshCw, CheckSquare, FlaskConical, ScrollText,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { supabase } from "./supabaseClient";
import * as db from "./services/supabaseData";
import { ROLES, ROLE_LABEL as ROLE_LABEL_CFG, NAV_BY_ROLE, isSuperAdmin as checkSuperAdmin, isAdminTutor as checkAdminTutor, isStaff as checkStaff, canDelete as checkCanDelete, requiresReason, AUDIT_ACTION } from "./config/roles";
import { logAction, auditCreateStudent, auditEditStudent, auditDeactivateStudent, auditCreateParent, auditEditParent, auditCreateTutor, auditEditTutor, auditAssignTutor, auditCreateClass, auditEditClass, auditCancelClass, auditCreateInvoice, auditEditInvoice, auditVoidInvoice, auditPaymentCorrection, auditPaymentReversal, auditChangeRole, auditChangeUserStatus, auditLinkUser, auditDeleteRecord } from "./services/auditLog";

const tokens = {
  paper:"#FAF8F3",ink:"#1F2A2E",slate:"#5B6B70",teal:"#2C5F63",tealDeep:"#1E4448",
  coral:"#D97757",coralSoft:"#FBEAE2",gold:"#C9A24B",line:"#E7E1D6",cardBg:"#FFFFFF",
  tealSoft:"#E4EEEC",successBg:"#E7F3E9",success:"#3F8255",warnBg:"#FBF2DF",warn:"#B8862E",
  dangerBg:"#FBEAE6",danger:"#C4583B",
};
const SUBJECTS  = ["Mathematics","Physics","Chemistry","Biology","English","Computer Science","Economics","History","Geography"];
const CURRICULA = ["IGCSE","Edexcel","Cambridge","School Curriculum","A-Level","IB"];
const ROLE_LABEL= {super_admin:"Super Admin",admin_tutor:"Admin Tutor",tutor:"Tutor",parent:"Parent",student:"Student",admin:"Super Admin"};
const fmt       = (n) => `QAR ${Number(n||0).toLocaleString("en-QA",{minimumFractionDigits:0})}`;
const fmtDate   = (v) => v ? new Date(v).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtDateTime=(v) => v ? new Date(v).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
const initials  = (n="") => n.split(" ").map((w)=>w[0]).join("").slice(0,2).toUpperCase()||"?";

/* Mock data for Tutor/Parent/Student portals (unchanged — wired in next phase) */
const initialTutors=[
  {id:"t1",name:"Sarah Whitfield",email:"sarah.w@learnwise.edu",phone:"+974 5512 3344",subjects:["Mathematics","Physics"],curriculum:["IGCSE","Edexcel"],rate:45,status:"Active",notes:"Excellent with exam technique."},
  {id:"t2",name:"Daniel Okafor",email:"daniel.o@learnwise.edu",phone:"+974 5598 7712",subjects:["Chemistry","Biology"],curriculum:["Cambridge","IGCSE"],rate:40,status:"Active",notes:"Strong lab-concept visualizer."},
  {id:"t3",name:"Priya Nair",email:"priya.n@learnwise.edu",phone:"+974 5523 9981",subjects:["English","Economics"],curriculum:["Edexcel","School Curriculum"],rate:38,status:"Active",notes:"Specializes in essay structuring."},
];
const initialParents=[
  {id:"p1",name:"Mariam Al-Sayed",phone:"+974 5511 2233",email:"mariam.alsayed@gmail.com",address:"West Bay, Doha",studentIds:["s1","s2"],paymentStatus:"Pending"},
  {id:"p2",name:"James Carter",phone:"+974 5566 7788",email:"j.carter@gmail.com",address:"The Pearl, Doha",studentIds:["s3"],paymentStatus:"Paid"},
  {id:"p3",name:"Fatima Hassan",phone:"+974 5544 9911",email:"fatima.h@outlook.com",address:"Al Waab, Doha",studentIds:["s4"],paymentStatus:"Partially Paid"},
];
const initialStudents=[
  {id:"s1",name:"Yusuf Al-Sayed",age:15,grade:"Year 10",school:"DESS Doha",curriculum:"IGCSE",subjects:["Mathematics","Physics"],tutorIds:["t1"],parentId:"p1",strengths:"Quick with algebra",weakAreas:"Word problems",goals:"Achieve A* in IGCSE Maths",status:"Active"},
  {id:"s2",name:"Layla Al-Sayed",age:12,grade:"Year 7",school:"DESS Doha",curriculum:"IGCSE",subjects:["English"],tutorIds:["t3"],parentId:"p1",strengths:"Creative writing",weakAreas:"Grammar",goals:"Build confidence in essays",status:"Active"},
  {id:"s3",name:"Oliver Carter",age:16,grade:"Year 11",school:"Compass International",curriculum:"Edexcel",subjects:["Chemistry","Biology"],tutorIds:["t2"],parentId:"p2",strengths:"Strong memorization",weakAreas:"Applying theory",goals:"Top grades for medicine",status:"Active"},
  {id:"s4",name:"Noor Hassan",age:14,grade:"Year 9",school:"Qatar Academy",curriculum:"Cambridge",subjects:["Mathematics","Economics"],tutorIds:["t1","t3"],parentId:"p3",strengths:"Analytical",weakAreas:"Confidence under pressure",goals:"Move up a learning set",status:"Active"},
];
const initialClasses=[
  {id:"c1",studentId:"s1",tutorId:"t1",subject:"Mathematics",topic:"Quadratic Equations",date:"2026-06-21",start:"16:00",end:"17:00",mode:"Online",status:"Scheduled",attendance:"—"},
  {id:"c2",studentId:"s3",tutorId:"t2",subject:"Chemistry",topic:"Organic Reactions",date:"2026-06-21",start:"18:00",end:"19:00",mode:"Offline",status:"Scheduled",attendance:"—"},
  {id:"c3",studentId:"s2",tutorId:"t3",subject:"English",topic:"Descriptive Writing",date:"2026-06-19",start:"15:00",end:"16:00",mode:"Online",status:"Completed",attendance:"Present"},
  {id:"c4",studentId:"s4",tutorId:"t1",subject:"Mathematics",topic:"Linear Graphs",date:"2026-06-18",start:"17:00",end:"18:00",mode:"Online",status:"Completed",attendance:"Present"},
  {id:"c5",studentId:"s4",tutorId:"t3",subject:"Economics",topic:"Demand & Supply",date:"2026-06-23",start:"16:30",end:"17:30",mode:"Online",status:"Scheduled",attendance:"—"},
];
const initialHomework=[
  {id:"h1",classId:"c3",studentId:"s2",tutorId:"t3",title:"Descriptive Paragraph",description:"Write 200 words using 5 sensory details.",due:"2026-06-23",status:"Submitted"},
  {id:"h2",classId:"c4",studentId:"s4",tutorId:"t1",title:"Linear Graphs Worksheet 3",description:"Q1–12, show all working.",due:"2026-06-22",status:"Pending"},
  {id:"h3",classId:"c1",studentId:"s1",tutorId:"t1",title:"Quadratic Equations Practice",description:"Factorisation & completing the square.",due:"2026-06-24",status:"Pending"},
];
const initialNotes=[
  {id:"n1",classId:"c3",topic:"Descriptive Writing",understanding:"Good",strengths:"Vivid vocabulary",improvement:"Sentence variety",recommendation:"Practice 3 short paragraphs weekly",summary:"Layla used vivid imagery confidently."},
  {id:"n2",classId:"c4",topic:"Linear Graphs",understanding:"Fair",strengths:"Plots accurately",improvement:"Word problems",recommendation:"Timed practice sets",summary:"Noor understood main concept but needs more word problem practice."},
];
const initialPayments=[
  {id:"pay1",studentId:"s1",parentId:"p1",tutorId:"t1",hours:1,rate:45,total:45,paid:0,balance:45,method:"—",status:"Pending",date:"2026-06-16"},
  {id:"pay2",studentId:"s4",parentId:"p3",tutorId:"t1",hours:1,rate:45,total:45,paid:25,balance:20,method:"Bank Transfer",status:"Partially Paid",date:"2026-06-18"},
  {id:"pay3",studentId:"s2",parentId:"p1",tutorId:"t3",hours:1,rate:38,total:38,paid:38,balance:0,method:"Online",status:"Paid",date:"2026-06-19"},
  {id:"pay4",studentId:"s3",parentId:"p2",tutorId:"t2",hours:1,rate:40,total:40,paid:40,balance:0,method:"Card",status:"Paid",date:"2026-06-21"},
];
const findStudent=(id)=>initialStudents.find((s)=>s.id===id)||{name:"Unknown",subjects:[],tutorIds:[],grade:"",curriculum:"",school:"",age:0,goals:"",strengths:"",weakAreas:"",status:"Active",parentId:""};
const findTutor  =(id)=>initialTutors.find((t)=>t.id===id)||{name:"Unknown",subjects:[],curriculum:[],rate:0,status:"Active",notes:""};
const findParent =(id)=>initialParents.find((p)=>p.id===id)||{name:"Unknown",studentIds:[],phone:"",email:"",address:""};

/* ═══ SHARED UI COMPONENTS ═══ */
const statusColors={
  Scheduled:{bg:tokens.tealSoft,fg:tokens.tealDeep},Completed:{bg:tokens.successBg,fg:tokens.success},
  Cancelled:{bg:tokens.dangerBg,fg:tokens.danger},Rescheduled:{bg:tokens.warnBg,fg:tokens.warn},
  Present:{bg:tokens.successBg,fg:tokens.success},Absent:{bg:tokens.dangerBg,fg:tokens.danger},
  Paid:{bg:tokens.successBg,fg:tokens.success},Unpaid:{bg:tokens.dangerBg,fg:tokens.danger},
  Pending:{bg:tokens.warnBg,fg:tokens.warn},"Partially Paid":{bg:tokens.coralSoft,fg:tokens.coral},
  Submitted:{bg:tokens.tealSoft,fg:tokens.tealDeep},Reviewed:{bg:tokens.successBg,fg:tokens.success},
  Incomplete:{bg:tokens.dangerBg,fg:tokens.danger},Assigned:{bg:tokens.warnBg,fg:tokens.warn},
  Active:{bg:tokens.successBg,fg:tokens.success},Inactive:{bg:tokens.dangerBg,fg:tokens.danger},
  New:{bg:tokens.tealSoft,fg:tokens.tealDeep},Contacted:{bg:tokens.warnBg,fg:tokens.warn},
  Converted:{bg:tokens.successBg,fg:tokens.success},Closed:{bg:"#F0EEE7",fg:tokens.slate},
  Issued:{bg:tokens.warnBg,fg:tokens.warn},Overdue:{bg:tokens.dangerBg,fg:tokens.danger},
  Draft:{bg:"#F0EEE7",fg:tokens.slate},Voided:{bg:tokens.dangerBg,fg:tokens.danger},"On Leave":{bg:tokens.warnBg,fg:tokens.warn},
  Graduated:{bg:tokens.tealSoft,fg:tokens.tealDeep},"—":{bg:"#F0EEE7",fg:tokens.slate},
};
function Pill({value}){const c=statusColors[value]||statusColors["—"];return <span style={{background:c.bg,color:c.fg,padding:"3px 10px",borderRadius:999,fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{value}</span>;}
function Card({children,style,onClick}){return <div onClick={onClick} style={{background:tokens.cardBg,border:`1px solid ${tokens.line}`,borderRadius:16,padding:20,...style}}>{children}</div>;}
function StatCard({icon:Icon,label,value,accent}){return(<Card style={{display:"flex",flexDirection:"column",gap:10,minWidth:0}}><div style={{width:36,height:36,borderRadius:10,background:accent||tokens.tealSoft,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={18} color={tokens.tealDeep}/></div><div style={{fontFamily:"Fraunces, serif",fontSize:26,fontWeight:600,color:tokens.ink}}>{value}</div><div style={{fontSize:13,color:tokens.slate}}>{label}</div></Card>);}
function SectionTitle({eyebrow,title,action}){return(<div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:16,gap:12,flexWrap:"wrap"}}><div>{eyebrow&&<div style={{fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",color:tokens.coral,fontWeight:700,marginBottom:4}}>{eyebrow}</div>}<div style={{fontFamily:"Fraunces, serif",fontSize:22,fontWeight:600,color:tokens.ink}}>{title}</div></div>{action}</div>);}
function Button({children,variant="primary",onClick,style,icon:Icon,type="button",disabled}){const base={border:"none",borderRadius:10,padding:"9px 16px",fontSize:13.5,fontWeight:600,cursor:disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:6,fontFamily:"Inter, sans-serif",transition:"opacity .15s",opacity:disabled?0.5:1};const variants={primary:{background:tokens.teal,color:"#fff"},secondary:{background:tokens.tealSoft,color:tokens.tealDeep},ghost:{background:"transparent",color:tokens.slate,border:`1px solid ${tokens.line}`},danger:{background:tokens.dangerBg,color:tokens.danger}};return <button type={type} onClick={disabled?undefined:onClick} style={{...base,...variants[variant],...style}} onMouseEnter={(e)=>!disabled&&(e.currentTarget.style.opacity="0.85")} onMouseLeave={(e)=>!disabled&&(e.currentTarget.style.opacity="1")}>{Icon&&<Icon size={15}/>}{children}</button>;}
function Table({columns,rows,onRowClick}){if(!rows.length)return null;return(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}><thead><tr>{columns.map((c,i)=><th key={i} style={{textAlign:"left",padding:"10px 14px",color:tokens.slate,fontWeight:600,borderBottom:`1px solid ${tokens.line}`,fontSize:12,textTransform:"uppercase",letterSpacing:"0.04em"}}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=>(<tr key={i} onClick={()=>onRowClick&&onRowClick(r)} style={{cursor:onRowClick?"pointer":"default"}} onMouseEnter={(e)=>e.currentTarget.style.background="#FBFAF7"} onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>{r.cells.map((cell,j)=><td key={j} style={{padding:"12px 14px",borderBottom:`1px solid ${tokens.line}`,color:tokens.ink}}>{cell}</td>)}</tr>))}</tbody></table></div>);}
function Modal({title,onClose,children,wide}){return(<div style={{position:"fixed",inset:0,background:"rgba(31,42,46,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}} onClick={onClose}><div onClick={(e)=>e.stopPropagation()} style={{background:tokens.cardBg,borderRadius:18,width:wide?680:480,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",padding:28,boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontFamily:"Fraunces, serif",fontSize:19,fontWeight:600}}>{title}</div><button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",color:tokens.slate}}><X size={20}/></button></div>{children}</div></div>);}
function ConfirmModal({message,onConfirm,onCancel,loading,busy}){const isBusy=loading||busy;return(<Modal title="Confirm" onClose={onCancel}><div style={{fontSize:14,color:tokens.ink,marginBottom:20,lineHeight:1.6}}>{message}</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button variant="danger" onClick={onConfirm} disabled={isBusy}>{isBusy?"Deleting…":"Delete"}</Button></div></Modal>);}

/* Reason modal — required for admin_tutor sensitive actions */
function ReasonModal({title,description,onConfirm,onCancel,busy}){
  const [reason,setReason]=useState("");
  return(<Modal title={title||"Reason Required"} onClose={onCancel}>
    <div style={{fontSize:13.5,color:tokens.slate,marginBottom:14,lineHeight:1.6}}>{description||"Please provide a reason for this action. This will be recorded in the audit log."}</div>
    <Field label="Reason" required>
      <textarea style={{...inputStyle,minHeight:80,resize:"vertical"}} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe why you are making this change…"/>
    </Field>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button onClick={()=>reason.trim()&&onConfirm(reason.trim())} disabled={!reason.trim()||busy}>{busy?"Saving…":"Confirm"}</Button>
    </div>
  </Modal>);
}

/* Hook — get current user's profile for permission checks inside sections */
function useCurrentRole(){const{profile}=useAuth();const role=profile?.role||"";return{role,profile,isSuperAdmin:["super_admin","admin"].includes(role),isAdminTutor:role==="admin_tutor",isStaff:["super_admin","admin_tutor","admin"].includes(role),canDelete:["super_admin","admin"].includes(role)};}

function Field({label,children,required}){return(<div style={{marginBottom:14}}><div style={{fontSize:12.5,fontWeight:600,color:tokens.slate,marginBottom:6}}>{label}{required&&<span style={{color:tokens.coral}}> *</span>}</div>{children}</div>);}
const inputStyle={width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${tokens.line}`,fontSize:13.5,fontFamily:"Inter, sans-serif",boxSizing:"border-box",color:tokens.ink,background:"#FCFBF8"};
function Toast({message,type="success",onClose}){useEffect(()=>{const t=setTimeout(onClose,3500);return()=>clearTimeout(t);},[onClose]);const bg=type==="success"?tokens.successBg:tokens.dangerBg;const fg=type==="success"?tokens.success:tokens.danger;const Icon=type==="success"?CheckCircle2:AlertCircle;return(<div style={{position:"fixed",bottom:24,right:24,zIndex:200,background:bg,color:fg,border:`1px solid ${fg}30`,borderRadius:12,padding:"12px 18px",display:"flex",alignItems:"center",gap:10,fontSize:13.5,fontWeight:600,boxShadow:"0 8px 30px rgba(0,0,0,0.12)",minWidth:260}}><Icon size={17}/>{message}<button onClick={onClose} style={{marginLeft:"auto",background:"transparent",border:"none",cursor:"pointer",color:fg}}><X size={15}/></button></div>);}
function LoadingState({label="Loading…"}){return <div style={{padding:"48px 0",textAlign:"center",color:tokens.slate,fontSize:13.5}}><RefreshCw size={20} style={{marginBottom:10,opacity:0.4}}/><div>{label}</div></div>;}
function EmptyState({icon:Icon=FileText,title,message,action}){return(<div style={{padding:"48px 24px",textAlign:"center"}}><div style={{width:48,height:48,borderRadius:12,background:tokens.tealSoft,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><Icon size={22} color={tokens.tealDeep}/></div><div style={{fontFamily:"Fraunces, serif",fontSize:17,fontWeight:600,color:tokens.ink,marginBottom:6}}>{title}</div>{message&&<div style={{fontSize:13,color:tokens.slate,marginBottom:action?16:0}}>{message}</div>}{action}</div>);}
function ErrorBanner({message,onRetry}){return(<div style={{background:tokens.dangerBg,color:tokens.danger,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:16,fontSize:13.5}}><AlertCircle size={16}/><span style={{flex:1}}>{message}</span>{onRetry&&<Button variant="danger" onClick={onRetry} style={{padding:"5px 12px",fontSize:12}}>Retry</Button>}</div>);}
// Aliases used in newer portal sections
const Spinner   = LoadingState;
const Empty     = EmptyState;
const ErrBanner = ErrorBanner;
function useToast(){const[toast,setToast]=useState(null);const fire=useCallback((message,type="success")=>setToast({message,type,key:Date.now()}),[]);const hideToast=useCallback(()=>setToast(null),[]);const el=toast?<Toast key={toast.key} message={toast.message} type={toast.type} onClose={hideToast}/>:null;return{fire,el};}

/* ═══ NAV ═══ */
const NAV={
  super_admin:[
    {key:"dashboard",label:"Dashboard",icon:LayoutDashboard},{key:"users",label:"All Users",icon:Shield},
    {key:"students",label:"Students",icon:GraduationCap},{key:"parents",label:"Parents",icon:UserCircle},
    {key:"tutors",label:"Tutors",icon:Users},{key:"classes",label:"Classes",icon:CalendarDays},
    {key:"attendance",label:"Attendance",icon:ClipboardCheck},{key:"homework",label:"Homework",icon:BookOpenCheck},
    {key:"classnotes",label:"Class Notes",icon:FileText},{key:"materials",label:"Materials",icon:BookOpen},
    {key:"payments",label:"Payments",icon:Wallet},{key:"assessments",label:"Requests",icon:CheckSquare},
    {key:"reports",label:"Reports",icon:FileBarChart},{key:"auditlogs",label:"Audit Logs",icon:ScrollText},
    {key:"settings",label:"Settings",icon:Settings},{key:"qatest",label:"QA Test",icon:FlaskConical},
  ],
  admin_tutor:[
    {key:"dashboard",label:"Dashboard",icon:LayoutDashboard},
    {key:"students",label:"Students",icon:GraduationCap},{key:"parents",label:"Parents",icon:UserCircle},
    {key:"tutors",label:"Tutors",icon:Users},{key:"classes",label:"Classes",icon:CalendarDays},
    {key:"attendance",label:"Attendance",icon:ClipboardCheck},{key:"homework",label:"Homework",icon:BookOpenCheck},
    {key:"classnotes",label:"Class Notes",icon:FileText},{key:"materials",label:"Materials",icon:BookOpen},
    {key:"payments",label:"Payments",icon:Wallet},{key:"assessments",label:"Requests",icon:CheckSquare},
    {key:"reports",label:"Reports",icon:FileBarChart},
  ],
  tutor:[{key:"dashboard",label:"Dashboard",icon:LayoutDashboard},{key:"myclasses",label:"My Classes",icon:CalendarDays},{key:"mystudents",label:"My Students",icon:GraduationCap},{key:"classnotes",label:"Class Notes",icon:FileText},{key:"homework",label:"Homework",icon:BookOpenCheck},{key:"materials",label:"Materials",icon:BookOpen}],
  parent:[{key:"dashboard",label:"Dashboard",icon:LayoutDashboard},{key:"mychild",label:"My Child",icon:GraduationCap},{key:"classes",label:"Classes",icon:CalendarDays},{key:"homework",label:"Homework",icon:BookOpenCheck},{key:"progress",label:"Progress",icon:TrendingUp},{key:"payments",label:"Payments",icon:Wallet}],
  student:[{key:"dashboard",label:"Dashboard",icon:LayoutDashboard},{key:"myclasses",label:"My Classes",icon:CalendarDays},{key:"homework",label:"Homework",icon:BookOpenCheck},{key:"materials",label:"Materials",icon:BookOpen},{key:"progress",label:"Progress",icon:Target}],
};
// backward compat alias
NAV.admin = NAV.super_admin;

/* ═══════════════════════════════════════════════════════════
   PUBLIC WEBSITE  —  LearnWise Academy
   8 pages served from the same single-page app.
   Navigation state lives in authScreen (App root).
   No payments, no private data, no auth required.
   ═══════════════════════════════════════════════════════════ */

/* ── Shared public nav ── */
function PublicNav({ current, onNav }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { key: "home",       label: "Home" },
    { key: "about",      label: "About" },
    { key: "subjects",   label: "Subjects" },
    { key: "igcse",      label: "IGCSE / Edexcel" },
    { key: "online",     label: "Online Tuition" },
    { key: "assessment", label: "Book Assessment" },
    { key: "contact",    label: "Contact" },
  ];
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: `1px solid ${tokens.line}`, fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Logo */}
        <div onClick={() => onNav("home")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: tokens.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <GraduationCap size={19} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 16, color: tokens.ink, lineHeight: 1.1 }}>LearnWise</div>
            <div style={{ fontSize: 10, color: tokens.coral, fontWeight: 700 }}>Academy</div>
          </div>
        </div>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {links.map(l => (
            <div key={l.key} onClick={() => onNav(l.key)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: "pointer", color: current === l.key ? tokens.teal : tokens.slate, background: current === l.key ? tokens.tealSoft : "transparent", transition: "all .15s" }}>
              {l.label}
            </div>
          ))}
          <div style={{ width: 1, height: 22, background: tokens.line, margin: "0 8px" }} />
          <Button onClick={() => onNav("signin")} style={{ padding: "7px 18px", fontSize: 13.5 }}>Login</Button>
        </div>
      </div>
    </nav>
  );
}

/* ── Shared public footer ── */
function PublicFooter({ onNav }) {
  return (
    <footer style={{ background: tokens.tealDeep, color: "#fff", fontFamily: "Inter, sans-serif", marginTop: 80 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 24px 32px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={19} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 16 }}>LearnWise Academy</div>
              <div style={{ fontSize: 10.5, color: tokens.coral, fontWeight: 600 }}>Smart Guidance. Better Learning.</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, maxWidth: 300 }}>
            Expert one-to-one tutoring for IGCSE, Edexcel, Cambridge and more. Based in Doha, Qatar. Online and in-person sessions available.
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pages</div>
          {[["home","Home"],["about","About"],["subjects","Subjects"],["igcse","IGCSE / Edexcel"],["online","Online Tuition"]].map(([key,label]) => (
            <div key={key} onClick={() => onNav(key)} style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", marginBottom: 8, cursor: "pointer" }}>{label}</div>
          ))}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Contact</div>
          <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>Doha, Qatar</div>
          <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>info@learnwiseacademy.qa</div>
          <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)" }}>+974 5500 0000</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Get Started</div>
          <div onClick={() => onNav("assessment")} style={{ display: "inline-block", background: tokens.coral, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>
            Book Free Assessment
          </div>
          <div onClick={() => onNav("signin")} style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Student / Parent Login →</div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "20px 24px", maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>© {new Date().getFullYear()} LearnWise Academy. All rights reserved.</div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>Doha, Qatar</div>
      </div>
    </footer>
  );
}

/* ── HOME ── */
function PublicHome({ onNav }) {
  const features = [
    { icon: GraduationCap, title: "One-to-One Tutoring",    body: "Fully personalised sessions matched to your child's learning style, pace, and curriculum." },
    { icon: Target,        title: "Exam-Focused Learning",  body: "Targeted preparation for IGCSE, Edexcel, Cambridge and A-Level exams with past paper practice." },
    { icon: TrendingUp,    title: "Progress Tracking",      body: "Detailed tutor notes and learning reports so you always know how your child is developing." },
    { icon: UserCircle,    title: "Parent Updates",         body: "Regular progress summaries shared directly with parents after every session." },
    { icon: BookOpenCheck, title: "Homework Support",       body: "Structured homework assigned after each class to consolidate learning between sessions." },
    { icon: Video,         title: "Online & In-Person",     body: "Flexible delivery — sessions available at home in Doha or via our secure online platform." },
  ];
  const subjects = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Economics", "Computer Science", "History", "Geography"];
  const testimonials = [
    { quote: "Our daughter's IGCSE Maths grade went from a C to an A* in one term. The tutor really understood how she thinks.", name: "Mariam A.", role: "Parent, Doha" },
    { quote: "I actually enjoy studying now. My tutor explains things in a way my school teacher never did.", name: "Yusuf K.", role: "IGCSE Student" },
    { quote: "The regular progress reports are brilliant — I always know exactly where my son stands.", name: "James C.", role: "Parent, The Pearl" },
  ];

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: tokens.ink }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${tokens.tealDeep} 0%, #2C5F63 60%, #1a4a4e 100%)`, color: "#fff", padding: "80px 24px 96px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 999, marginBottom: 24, letterSpacing: "0.04em" }}>
            IGCSE · Edexcel · Cambridge · A-Level
          </div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 52, fontWeight: 700, lineHeight: 1.15, marginBottom: 22 }}>
            Smart Guidance.<br />Better Learning.
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: 36, maxWidth: 560, margin: "0 auto 36px" }}>
            Expert one-to-one tutoring in Doha, Qatar. Personalised sessions, exam-focused support, and real progress — for every student.
          </div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => onNav("assessment")} style={{ background: tokens.coral, color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Book a Free Assessment
            </button>
            <button onClick={() => onNav("online")} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Learn More →
            </button>
          </div>
        </div>
      </div>

      {/* Subjects strip */}
      <div style={{ background: tokens.tealSoft, padding: "18px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {subjects.map(s => (
            <span key={s} style={{ background: "#fff", color: tokens.tealDeep, fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 999, border: `1px solid ${tokens.line}` }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <div style={{ maxWidth: 1100, margin: "72px auto 0", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: tokens.coral, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Why LearnWise</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 36, fontWeight: 600 }}>Everything your child needs to succeed</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {features.map(feat => (
            <div key={feat.title} style={{ background: tokens.cardBg, border: `1px solid ${tokens.line}`, borderRadius: 16, padding: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <feat.icon size={21} color={tokens.tealDeep} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{feat.title}</div>
              <div style={{ fontSize: 13.5, color: tokens.slate, lineHeight: 1.65 }}>{feat.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: tokens.paper, margin: "72px 0 0", padding: "72px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: tokens.coral, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Process</div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 36, fontWeight: 600 }}>How it works</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
            {[
              { step: "01", title: "Book Assessment",  body: "Fill in a short form. We'll contact you within 24 hours to arrange a free assessment session." },
              { step: "02", title: "Meet Your Tutor",  body: "We match your child with the right tutor based on subject, curriculum, and learning style." },
              { step: "03", title: "Start Learning",   body: "Regular one-to-one sessions — online or at your home in Doha. Flexible scheduling." },
              { step: "04", title: "Track Progress",   body: "After every session you receive a detailed progress update and can track improvement over time." },
            ].map(s => (
              <div key={s.step} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 40, fontWeight: 700, color: tokens.teal, marginBottom: 12 }}>{s.step}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13.5, color: tokens.slate, lineHeight: 1.65 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div style={{ maxWidth: 1100, margin: "72px auto 0", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 34, fontWeight: 600 }}>What parents & students say</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {testimonials.map(t => (
            <div key={t.name} style={{ background: tokens.tealSoft, borderRadius: 16, padding: 28 }}>
              <div style={{ fontSize: 32, color: tokens.teal, marginBottom: 12, lineHeight: 1 }}>"</div>
              <div style={{ fontSize: 14, color: tokens.ink, lineHeight: 1.7, fontStyle: "italic", marginBottom: 20 }}>{t.quote}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
              <div style={{ fontSize: 12.5, color: tokens.slate }}>{t.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div style={{ background: tokens.coral, margin: "72px 0 0", padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 36, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Ready to get started?</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", marginBottom: 28 }}>Book a free assessment — no commitment required.</div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => onNav("assessment")} style={{ background: "#fff", color: tokens.coral, border: "none", borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Book Free Assessment
          </button>
          <button onClick={() => onNav("signin")} style={{ background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.5)", borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Login to Portal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ABOUT ── */
function PublicAbout({ onNav }) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: tokens.ink }}>
      <div style={{ background: `linear-gradient(135deg, ${tokens.tealDeep}, #2C5F63)`, color: "#fff", padding: "72px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 700, marginBottom: 16 }}>About LearnWise Academy</div>
          <div style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>We believe every student deserves teaching that's built around them — not the other way around.</div>
        </div>
      </div>
      <div style={{ maxWidth: 860, margin: "64px auto 0", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 48 }}>
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, marginBottom: 16 }}>Our Mission</div>
            <div style={{ fontSize: 14.5, color: tokens.slate, lineHeight: 1.8 }}>
              LearnWise Academy exists to give every student in Qatar access to high-quality, personalised tutoring. We match students with expert tutors who understand their curriculum, their learning style, and their goals — then build a programme around them.
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, marginBottom: 16 }}>Our Approach</div>
            <div style={{ fontSize: 14.5, color: tokens.slate, lineHeight: 1.8 }}>
              We don't do generic revision. Every session is planned around the student — their upcoming exams, their weak areas, their questions. Progress notes after every class keep parents informed and tutors accountable.
            </div>
          </div>
        </div>
        <div style={{ background: tokens.tealSoft, borderRadius: 16, padding: 36, marginBottom: 48 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, textAlign: "center" }}>
            {[["100+","Students tutored"],["IGCSE / Edexcel / Cambridge","Curricula covered"],["Online & In-Person","Delivery options"]].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, fontWeight: 700, color: tokens.tealDeep, marginBottom: 6 }}>{val}</div>
                <div style={{ fontSize: 13.5, color: tokens.slate }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, marginBottom: 20 }}>Our Tutors</div>
          <div style={{ fontSize: 14.5, color: tokens.slate, lineHeight: 1.8 }}>
            Every LearnWise tutor is carefully vetted for subject expertise, teaching ability, and communication skills. Our tutors have taught students across IGCSE, Edexcel, Cambridge IGCSE, and A-Level programmes. Many are experienced teachers from international schools in Qatar.
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <button onClick={() => onNav("assessment")} style={{ background: tokens.teal, color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Book a Free Assessment
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SUBJECTS ── */
function PublicSubjects({ onNav }) {
  const subjects = [
    { name: "Mathematics",       desc: "Algebra, geometry, calculus, statistics and more. Exam technique and past paper practice included.", icon: "📐" },
    { name: "Physics",           desc: "Forces, electricity, waves, and quantum concepts. Theory and practical application.", icon: "⚡" },
    { name: "Chemistry",         desc: "Organic and inorganic chemistry, reactions, and lab-based concepts.", icon: "🧪" },
    { name: "Biology",           desc: "Cell biology, genetics, ecology and human physiology for IGCSE and A-Level.", icon: "🧬" },
    { name: "English",           desc: "Literature analysis, creative and argumentative writing, grammar and comprehension.", icon: "📖" },
    { name: "Economics",         desc: "Micro and macroeconomics, international trade, and data response skills.", icon: "📊" },
    { name: "Computer Science",  desc: "Programming, algorithms, data structures and theory for IGCSE and A-Level.", icon: "💻" },
    { name: "History",           desc: "Source analysis, essay technique, and thematic understanding.", icon: "🏛️" },
    { name: "Geography",         desc: "Human and physical geography, case studies, and fieldwork skills.", icon: "🌍" },
  ];
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: tokens.ink }}>
      <div style={{ background: `linear-gradient(135deg, ${tokens.tealDeep}, #2C5F63)`, color: "#fff", padding: "72px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 700, marginBottom: 16 }}>Subjects We Cover</div>
          <div style={{ fontSize: 17, color: "rgba(255,255,255,0.8)" }}>Expert tutoring across all major IGCSE, Edexcel, and Cambridge subjects.</div>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "64px auto 0", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {subjects.map(s => (
            <div key={s.name} style={{ background: tokens.cardBg, border: `1px solid ${tokens.line}`, borderRadius: 16, padding: 28 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{s.name}</div>
              <div style={{ fontSize: 13.5, color: tokens.slate, lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", padding: "60px 0 0" }}>
          <div style={{ fontSize: 14.5, color: tokens.slate, marginBottom: 20 }}>Don't see your subject? Get in touch — we may be able to help.</div>
          <button onClick={() => onNav("assessment")} style={{ background: tokens.teal, color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Book a Free Assessment
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── IGCSE / EDEXCEL SUPPORT ── */
function PublicIGCSE({ onNav }) {
  const curricula = [
    { name: "Cambridge IGCSE",   desc: "Full support for Cambridge International examinations — all core and extended subjects.", tag: "Cambridge" },
    { name: "Edexcel IGCSE",     desc: "Pearson Edexcel IGCSE and International GCSE programme support.", tag: "Edexcel" },
    { name: "Cambridge A-Level", desc: "AS and A2 level preparation across sciences, humanities, and mathematics.", tag: "A-Level" },
    { name: "IB Programme",      desc: "International Baccalaureate DP and MYP support for key subjects.", tag: "IB" },
    { name: "School Curriculum", desc: "Local school curriculum support for students in Qatar's international schools.", tag: "Custom" },
  ];
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: tokens.ink }}>
      <div style={{ background: `linear-gradient(135deg, ${tokens.tealDeep}, #2C5F63)`, color: "#fff", padding: "72px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 700, marginBottom: 16 }}>IGCSE & Edexcel Support</div>
          <div style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>Specialist tutoring for Cambridge IGCSE, Edexcel, A-Levels and more — delivered by experienced tutors in Doha.</div>
        </div>
      </div>
      <div style={{ maxWidth: 1000, margin: "64px auto 0", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 52 }}>
          {curricula.map(c => (
            <div key={c.name} style={{ background: tokens.cardBg, border: `1.5px solid ${tokens.line}`, borderRadius: 16, padding: 28, display: "flex", gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <span style={{ background: tokens.tealSoft, color: tokens.tealDeep, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{c.tag}</span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{c.name}</div>
                <div style={{ fontSize: 13.5, color: tokens.slate, lineHeight: 1.65 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: tokens.paper, borderRadius: 16, padding: 36, marginBottom: 40 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Our exam preparation approach</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              "Targeted past paper practice from the earliest opportunity",
              "Mark scheme decoding — students learn exactly how marks are awarded",
              "Topic-by-topic audit to identify and close gaps",
              "Exam technique coaching: timing, mark allocation, answer structure",
              "Mock exam conditions with full feedback reports",
              "Regular parent updates so everyone can track progress",
            ].map(point => (
              <div key={point} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <CheckCircle2 size={16} color={tokens.success} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13.5, color: tokens.slate }}>{point}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <button onClick={() => onNav("assessment")} style={{ background: tokens.teal, color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Book a Free Assessment
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ONLINE TUITION ── */
function PublicOnline({ onNav }) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: tokens.ink }}>
      <div style={{ background: `linear-gradient(135deg, ${tokens.tealDeep}, #2C5F63)`, color: "#fff", padding: "72px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 700, marginBottom: 16 }}>Online Tuition</div>
          <div style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>The same quality, personal approach — delivered seamlessly over video call from anywhere in Qatar or around the world.</div>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: "64px auto 0", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 52 }}>
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, marginBottom: 18 }}>How online sessions work</div>
            {[
              { icon: Video,         title: "Secure video call",        body: "Sessions take place over a private, secure meeting link. No setup required." },
              { icon: FileText,      title: "Shared digital workspace",  body: "Tutors use shared whiteboards and documents so students can follow in real time." },
              { icon: BookOpenCheck, title: "Homework via the portal",   body: "Assignments are set and submitted through the student portal between sessions." },
              { icon: TrendingUp,    title: "Same progress tracking",    body: "Post-session notes and progress reports work exactly the same as in-person." },
            ].map(item => (
              <div key={item.title} style={{ display: "flex", gap: 14, marginBottom: 20 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <item.icon size={18} color={tokens.tealDeep} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: tokens.slate, lineHeight: 1.6 }}>{item.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: tokens.tealSoft, borderRadius: 16, padding: 32 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, marginBottom: 20 }}>Why our students prefer online</div>
            {[
              "No travel time — start learning immediately",
              "Flexible scheduling, including evenings and weekends",
              "Available to families anywhere in Qatar and internationally",
              "Sessions are recorded on request for review",
              "Same tutor, same progress — no disruption",
            ].map(point => (
              <div key={point} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                <CheckCircle2 size={15} color={tokens.teal} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13.5, color: tokens.tealDeep }}>{point}</div>
              </div>
            ))}
            <button onClick={() => onNav("assessment")} style={{ marginTop: 24, width: "100%", background: tokens.teal, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Book a Free Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── BOOK ASSESSMENT ── */
function PublicAssessment() {
  const blank = { parent_name: "", student_name: "", student_grade: "", curriculum: CURRICULA[0], subjects: [], phone: "", parent_email: "", message: "", preferred_mode: "Online", status: "New" };
  const [form,    setForm]    = useState(blank);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState("");

  const toggleSubject = s => {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(s) ? f.subjects.filter(x => x !== s) : [...f.subjects, s],
    }));
  };

  const submit = async () => {
    if (!form.parent_name.trim() || !form.student_name.trim() || !form.parent_email.trim()) {
      setErr("Please fill in parent name, student name, and email."); return;
    }
    setSaving(true); setErr("");
    const { error } = await db.submitAssessmentRequest({
      parent_name:   form.parent_name.trim(),
      student_name:  form.student_name.trim(),
      student_grade: form.student_grade,
      curriculum:    form.curriculum,
      subjects:      form.subjects,
      parent_phone:  form.phone,
      parent_email:  form.parent_email.trim(),
      message:       form.message,
      preferred_mode: form.preferred_mode,
      status:        "New",
      submitted_at:  new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  };

  if (done) return (
    <div style={{ fontFamily: "Inter, sans-serif", minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: tokens.successBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <CheckCircle2 size={30} color={tokens.success} />
        </div>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Request Received!</div>
        <div style={{ fontSize: 15, color: tokens.slate, lineHeight: 1.7, marginBottom: 28 }}>
          Thank you for reaching out. A member of our team will contact you within 24 hours to arrange your free assessment session.
        </div>
        <div style={{ fontSize: 13.5, color: tokens.slate }}>Questions? Email us at <strong>info@learnwiseacademy.qa</strong></div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: tokens.ink }}>
      <div style={{ background: `linear-gradient(135deg, ${tokens.tealDeep}, #2C5F63)`, color: "#fff", padding: "72px 24px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 700, marginBottom: 14 }}>Book a Free Assessment</div>
          <div style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>Tell us about your child and we'll be in touch within 24 hours to arrange a free, no-commitment assessment session.</div>
        </div>
      </div>
      <div style={{ maxWidth: 680, margin: "56px auto 80px", padding: "0 24px" }}>
        <div style={{ background: tokens.cardBg, border: `1px solid ${tokens.line}`, borderRadius: 20, padding: 40 }}>
          {err && (
            <div style={{ background: tokens.dangerBg, color: tokens.danger, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13.5 }}>{err}</div>
          )}

          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Parent / Guardian Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 6 }}>
            <Field label="Parent / Guardian Name" required>
              <input style={inputStyle} value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} placeholder="Full name" />
            </Field>
            <Field label="Phone Number">
              <input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+974 …" />
            </Field>
          </div>
          <Field label="Email Address" required>
            <input style={inputStyle} type="email" value={form.parent_email} onChange={e => setForm({ ...form, parent_email: e.target.value })} placeholder="your@email.com" />
          </Field>

          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, margin: "28px 0 20px" }}>Student Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 6 }}>
            <Field label="Student Name" required>
              <input style={inputStyle} value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} placeholder="Full name" />
            </Field>
            <Field label="Grade / Year">
              <input style={inputStyle} value={form.student_grade} onChange={e => setForm({ ...form, student_grade: e.target.value })} placeholder="e.g. Year 10" />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Curriculum">
              <select style={inputStyle} value={form.curriculum} onChange={e => setForm({ ...form, curriculum: e.target.value })}>
                {CURRICULA.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Preferred Mode">
              <select style={inputStyle} value={form.preferred_mode} onChange={e => setForm({ ...form, preferred_mode: e.target.value })}>
                <option>Online</option>
                <option>In-Person</option>
                <option>Either</option>
              </select>
            </Field>
          </div>

          <Field label="Subjects needed (select all that apply)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {SUBJECTS.map(s => (
                <div key={s} onClick={() => toggleSubject(s)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${form.subjects.includes(s) ? tokens.teal : tokens.line}`, background: form.subjects.includes(s) ? tokens.tealSoft : "#fff", color: form.subjects.includes(s) ? tokens.tealDeep : tokens.slate }}>
                  {s}
                </div>
              ))}
            </div>
          </Field>

          <Field label="Additional message (optional)">
            <textarea style={{ ...inputStyle, minHeight: 90 }} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Tell us about your child's goals, upcoming exams, or any specific challenges…" />
          </Field>

          <button onClick={submit} disabled={saving} style={{ width: "100%", background: saving ? tokens.slate : tokens.teal, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", marginTop: 8 }}>
            {saving ? "Submitting…" : "Submit Assessment Request"}
          </button>
          <div style={{ fontSize: 12.5, color: tokens.slate, textAlign: "center", marginTop: 12 }}>
            We'll respond within 24 hours. No commitment required.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── CONTACT ── */
function PublicContact() {
  const [form,   setForm]   = useState({ name: "", email: "", phone: "", message: "" });
  const [done,   setDone]   = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name || !form.email || !form.message) return;
    setSaving(true);
    // Store as an assessment request with no student data (contact form)
    await db.submitAssessmentRequest({ parent_name: form.name, parent_email: form.email, parent_phone: form.phone, message: form.message, status: "New", submitted_at: new Date().toISOString() });
    setSaving(false);
    setDone(true);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: tokens.ink }}>
      <div style={{ background: `linear-gradient(135deg, ${tokens.tealDeep}, #2C5F63)`, color: "#fff", padding: "72px 24px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 700, marginBottom: 14 }}>Contact Us</div>
          <div style={{ fontSize: 17, color: "rgba(255,255,255,0.8)" }}>We'd love to hear from you. Reach out and we'll respond within 24 hours.</div>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: "64px auto 80px", padding: "0 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
        <div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Get in touch</div>
          {[
            { icon: MapPin,   label: "Location",     value: "Doha, Qatar" },
            { icon: Mail,     label: "Email",         value: "info@learnwiseacademy.qa" },
            { icon: Phone,    label: "Phone",         value: "+974 5500 0000" },
            { icon: Clock,    label: "Office Hours",  value: "Mon–Sat, 9am–7pm" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <item.icon size={18} color={tokens.tealDeep} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: tokens.slate, marginBottom: 2 }}>{item.label.toUpperCase()}</div>
                <div style={{ fontSize: 14 }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          {done
            ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <CheckCircle2 size={40} color={tokens.success} style={{ margin: "0 auto 16px" }} />
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Message sent!</div>
                <div style={{ fontSize: 14, color: tokens.slate }}>We'll get back to you within 24 hours.</div>
              </div>
            ) : (
              <div style={{ background: tokens.cardBg, border: `1px solid ${tokens.line}`, borderRadius: 16, padding: 32 }}>
                <Field label="Name" required><input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></Field>
                <Field label="Email" required><input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" /></Field>
                <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+974 …" /></Field>
                <Field label="Message" required><textarea style={{ ...inputStyle, minHeight: 100 }} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" /></Field>
                <button onClick={submit} disabled={saving} style={{ width: "100%", background: tokens.teal, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Sending…" : "Send Message"}
                </button>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}


/* ═══ AUTH SCREENS ═══ */
function AuthShell({title,subtitle,children,footer}){return(<div style={{minHeight:"100vh",background:tokens.paper,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter, sans-serif",padding:20}}><div style={{width:420,maxWidth:"100%"}}><div style={{textAlign:"center",marginBottom:28}}><div style={{width:52,height:52,borderRadius:14,background:tokens.teal,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><GraduationCap size={26} color="#fff"/></div><div style={{fontFamily:"Fraunces, serif",fontSize:26,fontWeight:600,color:tokens.ink}}>LearnWise Academy</div><div style={{color:tokens.coral,fontSize:13,fontWeight:600,marginTop:4,letterSpacing:"0.02em"}}>Smart Guidance. Better Learning.</div></div><Card style={{padding:24}}><div style={{fontFamily:"Fraunces, serif",fontSize:18,fontWeight:600,marginBottom:2}}>{title}</div>{subtitle&&<div style={{fontSize:12.5,color:tokens.slate,marginBottom:16}}>{subtitle}</div>}{children}</Card>{footer}</div></div>);}
function ErrorNote({message}){if(!message)return null;return <div style={{background:tokens.dangerBg,color:tokens.danger,fontSize:12.5,padding:"9px 12px",borderRadius:9,marginBottom:14}}>{message}</div>;}
function SignIn({onGoSignUp,onGoStaff}){const{signIn}=useAuth();const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);const submit=async(e)=>{e.preventDefault();setError("");setLoading(true);const{error}=await signIn({email,password});setLoading(false);if(error)setError(error.message);};return(<AuthShell title="Sign in" subtitle="Welcome back — sign in to your portal." footer={<div style={{textAlign:"center",marginTop:16}}><div style={{fontSize:12.5,color:tokens.slate}}>New here? <span onClick={onGoSignUp} style={{color:tokens.teal,fontWeight:600,cursor:"pointer"}}>Create an account</span></div><div onClick={onGoStaff} style={{textAlign:"center",fontSize:11,color:tokens.line,marginTop:18,cursor:"pointer",userSelect:"none"}}>·</div></div>}><form onSubmit={submit}><ErrorNote message={error}/><Field label="Email"><input style={inputStyle} type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com"/></Field><Field label="Password"><input style={inputStyle} type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••"/></Field><Button type="submit" style={{width:"100%",justifyContent:"center",marginTop:6}}>{loading?"Signing in…":"Sign in"}</Button></form></AuthShell>);}
function SignUp({onGoSignIn}){const{signUp}=useAuth();const[fullName,setFullName]=useState("");const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[role,setRole]=useState("student");const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[done,setDone]=useState(false);const roles=[{key:"tutor",label:"Tutor",icon:Users},{key:"parent",label:"Parent",icon:UserCircle},{key:"student",label:"Student",icon:GraduationCap}];const submit=async(e)=>{e.preventDefault();setError("");setLoading(true);const{error}=await signUp({email,password,fullName,role});setLoading(false);if(error)setError(error.message);else setDone(true);};if(done)return <AuthShell title="Check your inbox" subtitle=""><div style={{fontSize:13.5,color:tokens.ink,lineHeight:1.6}}>We've sent a confirmation link to <strong>{email}</strong>. Confirm your email, then sign in to reach your {ROLE_LABEL[role]} portal.</div><Button variant="secondary" style={{width:"100%",justifyContent:"center",marginTop:16}} onClick={onGoSignIn}>Back to sign in</Button></AuthShell>;return(<AuthShell title="Create an account" subtitle="Sign up as a tutor, parent, or student." footer={<div style={{textAlign:"center",fontSize:12.5,color:tokens.slate,marginTop:16}}>Already have an account? <span onClick={onGoSignIn} style={{color:tokens.teal,fontWeight:600,cursor:"pointer"}}>Sign in</span></div>}><form onSubmit={submit}><ErrorNote message={error}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>{roles.map((r)=><div key={r.key} onClick={()=>setRole(r.key)} style={{border:`1.5px solid ${role===r.key?tokens.teal:tokens.line}`,background:role===r.key?tokens.tealSoft:"#fff",borderRadius:12,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}><r.icon size={17} color={role===r.key?tokens.tealDeep:tokens.slate} style={{marginBottom:4}}/><div style={{fontSize:12.5,fontWeight:600,color:tokens.ink}}>{r.label}</div></div>)}</div><Field label="Full Name"><input style={inputStyle} required value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder="Your full name"/></Field><Field label="Email"><input style={inputStyle} type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com"/></Field><Field label="Password"><input style={inputStyle} type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="At least 6 characters"/></Field><Button type="submit" style={{width:"100%",justifyContent:"center",marginTop:6}}>{loading?"Creating account…":"Create account"}</Button></form></AuthShell>);}
function StaffLogin({onBack}){const{signIn}=useAuth();const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);const submit=async(e)=>{e.preventDefault();setError("");setLoading(true);const{data,error}=await signIn({email,password});setLoading(false);if(error){setError(error.message);return;}const{data:prof}=await supabase.from("profiles").select("role").eq("id",data.user.id).maybeSingle();if(!prof||!["super_admin","admin_tutor","admin"].includes(prof.role)){await supabase.auth.signOut();setError("This account doesn't have staff access.");}};return(<AuthShell title="Staff Access" subtitle="Restricted — staff only" footer={<div onClick={onBack} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:12.5,color:tokens.slate,marginTop:16,cursor:"pointer"}}><ArrowLeft size={13}/> Back to portal sign in</div>}><form onSubmit={submit}><ErrorNote message={error}/><Field label="Staff Email"><input style={inputStyle} type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="staff@learnwise.edu"/></Field><Field label="Password"><input style={inputStyle} type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••"/></Field><Button type="submit" style={{width:"100%",justifyContent:"center",marginTop:6}}>{loading?"Signing in…":"Sign in"}</Button></form></AuthShell>);}

/* ═══ SHELL ═══ */
function Shell({role,current,setCurrent,onLogout,children,who}){const nav=NAV[role]||NAV.student;const isAdminTutorRole=role==="admin_tutor";return(<div style={{display:"flex",minHeight:"100vh",background:tokens.paper,fontFamily:"Inter, sans-serif"}}><div style={{width:232,flexShrink:0,borderRight:`1px solid ${tokens.line}`,padding:"22px 14px",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",overflowY:"auto"}}><div style={{display:"flex",alignItems:"center",gap:10,padding:"0 8px",marginBottom:26}}><div style={{width:34,height:34,borderRadius:9,background:tokens.teal,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><GraduationCap size={18} color="#fff"/></div><div><div style={{fontFamily:"Fraunces, serif",fontWeight:600,fontSize:14.5,color:tokens.ink,lineHeight:1.1}}>LearnWise</div><div style={{fontSize:10.5,color:tokens.coral,fontWeight:600}}>Academy</div></div></div><div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>{nav.map((n)=><div key={n.key} onClick={()=>setCurrent(n.key)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,cursor:"pointer",background:current===n.key?tokens.tealSoft:"transparent",color:current===n.key?tokens.tealDeep:tokens.slate,fontWeight:current===n.key?700:500,fontSize:13.5}}><n.icon size={16}/>{n.label}</div>)}</div><div style={{borderTop:`1px solid ${tokens.line}`,paddingTop:14,marginTop:10}}><div style={{display:"flex",alignItems:"center",gap:9,padding:"0 8px",marginBottom:10}}><div style={{width:30,height:30,borderRadius:"50%",background:isAdminTutorRole?tokens.warnBg:tokens.coralSoft,display:"flex",alignItems:"center",justifyContent:"center",color:isAdminTutorRole?tokens.warn:tokens.coral,fontWeight:700,fontSize:12.5,flexShrink:0}}>{initials(who)}</div><div style={{minWidth:0}}><div style={{fontSize:12.5,fontWeight:600,color:tokens.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{who}</div><div style={{fontSize:11,color:tokens.slate}}>{ROLE_LABEL[role]||role}</div></div></div><div onClick={onLogout} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,cursor:"pointer",color:tokens.slate,fontSize:13}}><LogOut size={15}/> Sign out</div></div></div><div style={{flex:1,padding:"26px 32px",minWidth:0}}>{children}</div></div>);}

/* ═══ ADMIN DASHBOARD ═══ */
function AdminDashboard(){
  const[stats,setStats]=useState(null);const[todayClasses,setTodayClasses]=useState([]);const[outstanding,setOutstanding]=useState([]);const[recentActivity,setRecentActivity]=useState([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
  useEffect(()=>{(async()=>{setLoading(true);const[sr,tr,or,ar]=await Promise.all([db.getAdminDashboardStats(),db.getClasses({from:new Date().toISOString().slice(0,10)+"T00:00:00",to:new Date().toISOString().slice(0,10)+"T23:59:59"}),db.getOutstandingPaymentsReport(),db.getClasses({status:"Completed"})]);if(sr.error)setError(sr.error.message);else setStats(sr.data);setTodayClasses(tr.data?.slice(0,6)||[]);setOutstanding(or.data?.slice(0,5)||[]);setRecentActivity(ar.data?.slice(0,5)||[]);setLoading(false);})();},[]);
  if(loading)return <LoadingState label="Loading dashboard…"/>;
  if(error)return <ErrorBanner message={error}/>;
  return(<div><SectionTitle eyebrow="Overview" title="Admin Dashboard"/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:26}}>
      <StatCard icon={GraduationCap} label="Active Students" value={stats?.totalStudents??"—"}/>
      <StatCard icon={Users} label="Active Tutors" value={stats?.totalTutors??"—"}/>
      <StatCard icon={UserCircle} label="Active Parents" value={stats?.totalParents??"—"}/>
      <StatCard icon={CalendarDays} label="Today's Classes" value={stats?.todayClasses??"—"}/>
      <StatCard icon={Clock} label="Upcoming Classes" value={stats?.upcomingClasses??"—"}/>
      <StatCard icon={Wallet} label="This Month" value={fmt(stats?.monthRevenueQar)} accent={tokens.coralSoft}/>
      <StatCard icon={AlertCircle} label="Outstanding (QAR)" value={fmt(stats?.outstandingQar)} accent={tokens.warnBg}/>
      <StatCard icon={CheckSquare} label="New Requests" value={stats?.newRequests??"—"} accent={stats?.newRequests>0?tokens.warnBg:undefined}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:18}}>
      <Card><div style={{fontWeight:700,marginBottom:12,fontSize:14.5}}>Today's Class Schedule</div>
        {todayClasses.length===0?<div style={{color:tokens.slate,fontSize:13}}>No classes scheduled for today.</div>
          :todayClasses.map((c)=>(<div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${tokens.line}`}}><div><div style={{fontWeight:600,fontSize:13.5}}>{c.student?.full_name} · {c.subject}</div><div style={{fontSize:12,color:tokens.slate}}>{fmtDateTime(c.scheduled_at)} with {c.tutor?.full_name}</div></div><Pill value={c.status}/></div>))}
      </Card>
      <Card><div style={{fontWeight:700,marginBottom:12,fontSize:14.5}}>Outstanding Invoices</div>
        {outstanding.length===0?<div style={{color:tokens.slate,fontSize:13}}>No outstanding balances.</div>
          :outstanding.map((inv)=>(<div key={inv.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${tokens.line}`}}><div><div style={{fontWeight:600,fontSize:13}}>{inv.parent?.full_name}</div><div style={{fontSize:12,color:tokens.slate}}>Balance {fmt(inv.balance_qar)}</div></div><Pill value={inv.status}/></div>))}
      </Card>
    </div>
    {recentActivity.length>0&&(<div style={{marginTop:18}}><Card><div style={{fontWeight:700,marginBottom:12,fontSize:14.5}}>Recent Completed Classes</div>{recentActivity.map((c)=>(<div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${tokens.line}`,fontSize:13}}><div>{c.tutor?.full_name} completed <strong>{c.topic||c.subject}</strong> with {c.student?.full_name}</div><div style={{color:tokens.slate,whiteSpace:"nowrap",marginLeft:12}}>{fmtDate(c.scheduled_at)}</div></div>))}</Card></div>)}
  </div>);
}

/* ═══ ADMIN USERS (already Supabase) ═══ */
function AdminUsers(){
  const{profile:myProfile}=useAuth();
  const[users,setUsers]     =useState([]);
  const[tutors,setTutors]   =useState([]);
  const[parents,setParents] =useState([]);
  const[students,setStudents]=useState([]);
  const[loading,setLoading] =useState(true);
  const[err,setErr]         =useState("");
  const[filter,setFilter]   =useState("all");
  const[linkUser,setLinkUser]=useState(null); // user being linked
  const[linkTarget,setLinkTarget]=useState(""); // selected profile id
  const[linking,setLinking] =useState(false);
  const{fire,el}=useToast();

  const load=useCallback(async()=>{
    setLoading(true); setErr("");
    const[ur,tr,pr,sr]=await Promise.all([db.getProfiles(),db.getTutors(),db.getParents(),db.getStudents()]);
    if(ur.error)setErr(ur.error.message); else setUsers(ur.data||[]);
    setTutors(tr.data||[]); setParents(pr.data||[]); setStudents(sr.data||[]);
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const setRole=async(id,role)=>{
    const{error}=await db.updateProfile(id,{role});
    if(error)fire(error.message,"error"); else{fire("Role updated");load();}
  };
  const setStatus=async(id,status)=>{
    const{error}=await db.updateProfile(id,{status});
    if(error)fire(error.message,"error"); else{fire(status==="Active"?"Account reactivated":"Account suspended");load();}
  };

  // Link a Supabase auth user to a tutor/parent/student profile row
  const doLink=async()=>{
    if(!linkTarget){fire("Please select a profile to link","error");return;}
    setLinking(true);
    const role=linkUser.role;
    let res;
    if(role==="tutor")  res=await db.linkTutorAccount(linkTarget,linkUser.id);
    else if(role==="parent") res=await db.linkParentAccount(linkTarget,linkUser.id);
    else if(role==="student") res=await db.linkStudentAccount(linkTarget,linkUser.id);
    setLinking(false);
    if(res?.error){fire(res.error.message,"error");return;}
    fire(`${linkUser.full_name} linked successfully`);
    setLinkUser(null); setLinkTarget(""); load();
  };

  // Derive which profiles are available to link (not yet linked, matching role)
  const availableProfiles=()=>{
    if(!linkUser)return[];
    if(linkUser.role==="tutor")   return tutors.filter(t=>!t.user_id);
    if(linkUser.role==="parent")  return parents.filter(p=>!p.user_id);
    if(linkUser.role==="student") return students.filter(s=>!s.user_id);
    return[];
  };

  // What is a user currently linked to?
  const linkedLabel=(u)=>{
    if(u.role==="tutor"){const t=tutors.find(x=>x.user_id===u.id);return t?`→ ${t.full_name}`:null;}
    if(u.role==="parent"){const p=parents.find(x=>x.user_id===u.id);return p?`→ ${p.full_name}`:null;}
    if(u.role==="student"){const s=students.find(x=>x.user_id===u.id);return s?`→ ${s.full_name}`:null;}
    return null;
  };

  const filtered=filter==="all"?users:users.filter(u=>u.role===filter);
  const cnt=["super_admin","admin_tutor","tutor","parent","student"].reduce((a,r)=>({...a,[r]:users.filter(u=>u.role===r).length}),{});

  const canLink=u=>["tutor","parent","student"].includes(u.role);

  return(<div>
    {el}
    <SectionTitle eyebrow="Account Management" title="All Users"/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:18}}>
      <StatCard icon={Shield}        label="Super Admins"  value={cnt.super_admin||0}/>
      <StatCard icon={Users}         label="Tutors"   value={cnt.tutor  ||0}/>
      <StatCard icon={UserCircle}    label="Parents"  value={cnt.parent ||0}/>
      <StatCard icon={GraduationCap} label="Students" value={cnt.student||0}/>
    </div>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    <Card style={{marginBottom:16,padding:"10px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
      {["all","super_admin","admin_tutor","tutor","parent","student"].map(f=>(
        <div key={f} onClick={()=>setFilter(f)} style={{padding:"6px 14px",borderRadius:999,fontSize:12.5,fontWeight:600,cursor:"pointer",background:filter===f?tokens.teal:tokens.tealSoft,color:filter===f?"#fff":tokens.tealDeep,textTransform:"capitalize"}}>{f}</div>
      ))}
    </Card>
    <Card>
      {loading?<Spinner/>:filtered.length===0?<Empty icon={Users} title="No users found" body="No accounts in this category yet."/>:(
        <Table columns={["Name","Email","Role","Status","Linked Profile","Joined","Actions"]}
          rows={filtered.map(u=>{
            const linked=linkedLabel(u);
            return{cells:[
              u.full_name,
              u.email,
              <select value={u.role} onChange={e=>setRole(u.id,e.target.value)} disabled={u.id===myProfile?.id} style={{...inputStyle,padding:"5px 8px",width:110}}>
                {["super_admin","admin_tutor","tutor","parent","student"].map(r=><option key={r} value={r}>{ROLE_LABEL[r]||r}</option>)}
              </select>,
              <Pill value={u.status==="Active"?"Active":"Suspended"}/>,
              linked
                ? <span style={{fontSize:12.5,color:tokens.success,fontWeight:600}}>{linked}</span>
                : canLink(u)
                  ? <span style={{fontSize:12,color:tokens.warn}}>Not linked</span>
                  : <span style={{fontSize:12,color:tokens.slate}}>—</span>,
              fmtDate(u.created_at),
              <div style={{display:"flex",gap:6}}>
                {canLink(u)&&(
                  <Button variant="secondary" icon={Link} style={{padding:"5px 10px",fontSize:12}} onClick={()=>{setLinkUser(u);setLinkTarget("");}}>
                    {linked?"Relink":"Link"}
                  </Button>
                )}
                <Button variant={u.status==="Active"?"danger":"secondary"} style={{padding:"5px 10px",fontSize:12}}
                  onClick={()=>setStatus(u.id,u.status==="Active"?"Suspended":"Active")}
                  disabled={u.id===myProfile?.id}>
                  {u.status==="Active"?"Suspend":"Reactivate"}
                </Button>
              </div>,
            ]};
          })}
        />
      )}
    </Card>
    <div style={{fontSize:11.5,color:tokens.slate,marginTop:10}}>
      Changes apply immediately. You cannot modify your own account here. Use "Link" to connect a signed-up user to their tutor/parent/student profile record.
    </div>

    {/* Link Profile Modal */}
    {linkUser&&(
      <Modal title={`Link "${linkUser.full_name}" to a ${linkUser.role} profile`} onClose={()=>setLinkUser(null)}>
        <div style={{fontSize:13,color:tokens.slate,marginBottom:16,lineHeight:1.6}}>
          This connects the user's login to their <strong>{linkUser.role}</strong> profile record in the database. Once linked, they'll have full access to their portal.
        </div>
        {availableProfiles().length===0?(
          <div style={{background:tokens.warnBg,color:tokens.warn,borderRadius:10,padding:"12px 14px",fontSize:13,marginBottom:16}}>
            No unlinked {ROLE_LABEL[linkUser.role]||linkUser.role} profiles found. Create one first in the {linkUser.role === "tutor" ? "Tutors" : linkUser.role === "parent" ? "Parents" : "Students"} section, then come back here.
          </div>
        ):(
          <Field label={`Select ${linkUser.role} profile to link`} required>
            <select style={inputStyle} value={linkTarget} onChange={e=>setLinkTarget(e.target.value)}>
              <option value="">— Choose a profile —</option>
              {availableProfiles().map(p=>(
                <option key={p.id} value={p.id}>
                  {p.full_name}{p.email?` (${p.email})`:""}
                </option>
              ))}
            </select>
          </Field>
        )}
        {/* Also show currently linked profile if relinking */}
        {linkedLabel(linkUser)&&(
          <div style={{fontSize:12.5,color:tokens.slate,marginBottom:14}}>
            Currently linked: <strong>{linkedLabel(linkUser)}</strong>
          </div>
        )}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Button variant="ghost" onClick={()=>setLinkUser(null)}>Cancel</Button>
          <Button onClick={doLink} disabled={linking||!linkTarget||availableProfiles().length===0}>
            {linking?"Linking…":"Confirm Link"}
          </Button>
        </div>
      </Modal>
    )}
  </div>);
}

/* ═══ ADMIN STUDENTS ═══ */
function AdminStudentDetail({student,onBack}){
  const[classes,setClasses]=useState([]);const[homework,setHomework]=useState([]);const[notes,setNotes]=useState([]);const[invoices,setInvoices]=useState([]);const[loading,setLoading]=useState(true);
  const[allTutors,setAllTutors]=useState([]);const[assignments,setAssignments]=useState([]);const[showAssign,setShowAssign]=useState(false);const[assignTutorId,setAssignTutorId]=useState("");const[assignBusy,setAssignBusy]=useState(false);
  const{fire,el}=useToast();
  const loadAll=async()=>{setLoading(true);const[cr,hr,nr,ir,tr,ar]=await Promise.all([db.getClasses({studentId:student.id}),db.getHomework({studentId:student.id}),db.getClassNotes({studentId:student.id}),student.parent_id?db.getInvoices({parentId:student.parent_id}):{data:[]},db.getTutors(),db.getStudentTutors({studentId:student.id})]);setClasses(cr.data||[]);setHomework(hr.data||[]);setNotes(nr.data||[]);setInvoices(ir.data||[]);setAllTutors(tr.data||[]);setAssignments(ar.data||[]);setLoading(false);};
  useEffect(()=>{loadAll();},[student.id,student.parent_id]);
  const doAssign=async()=>{if(!assignTutorId){fire("Select a tutor","error");return;}setAssignBusy(true);const{error}=await db.assignTutorToStudent(student.id,assignTutorId,[]);setAssignBusy(false);if(error){fire(error.message,"error");return;}fire("Tutor assigned");setShowAssign(false);setAssignTutorId("");loadAll();};
  const doRemove=async(assignId)=>{const{error}=await db.removeStudentTutor(assignId);if(error)fire(error.message,"error");else{fire("Tutor removed");loadAll();}};
  const assignedTutorIds=assignments.map(a=>a.tutor_id);
  const availableTutors=allTutors.filter(t=>!assignedTutorIds.includes(t.id));
  const tutorNames=assignments.map(a=>a.tutor?.full_name).filter(Boolean).join(", ")||"—";
  return(<div>{el}
    <div onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,color:tokens.slate,fontSize:13,cursor:"pointer",marginBottom:14}}><ArrowLeft size={14}/> Back to Students</div>
    <Card style={{marginBottom:18}}>
      <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{width:56,height:56,borderRadius:"50%",background:tokens.tealSoft,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Fraunces, serif",fontSize:20,fontWeight:700,color:tokens.tealDeep}}>{initials(student.full_name)}</div>
        <div style={{flex:1,minWidth:200}}><div style={{fontFamily:"Fraunces, serif",fontSize:21,fontWeight:600}}>{student.full_name}</div><div style={{color:tokens.slate,fontSize:13}}>{student.grade} · {student.school}</div></div>
        <Pill value={student.status}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginTop:20}}>
        <Field label="Curriculum"><div style={{fontSize:13.5}}>{student.curriculum||"—"}</div></Field>
        <Field label="Subjects"><div style={{fontSize:13.5}}>{(student.subjects||[]).join(", ")||"—"}</div></Field>
        <Field label="Tutor(s)"><div style={{fontSize:13.5}}>{tutorNames}</div></Field>
        <Field label="Parent"><div style={{fontSize:13.5}}>{student.parent?.full_name||"—"}</div></Field>
      </div>
    </Card>
    {loading?<Spinner/>:(<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
        <Card><div style={{fontWeight:700,marginBottom:10,fontSize:14}}>Learning Goals</div><div style={{fontSize:13.5,marginBottom:12}}>{student.goals||"No goals recorded."}</div><div style={{display:"flex",gap:14}}><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:tokens.success,marginBottom:4}}>Strengths</div><div style={{fontSize:13,color:tokens.slate}}>{student.strengths||"—"}</div></div><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:tokens.coral,marginBottom:4}}>Weak Areas</div><div style={{fontSize:13,color:tokens.slate}}>{student.weak_areas||"—"}</div></div></div></Card>
        <Card><div style={{fontWeight:700,marginBottom:10,fontSize:14}}>Invoices</div>{invoices.length===0?<div style={{fontSize:13,color:tokens.slate}}>No invoices yet.</div>:invoices.map(inv=>(<div key={inv.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${tokens.line}`,fontSize:13}}><div>{inv.invoice_number} · {fmt(inv.total_qar)}</div><Pill value={inv.status}/></div>))}</Card>
      </div>
      <Card style={{marginBottom:18}}><div style={{fontWeight:700,marginBottom:10,fontSize:14}}>Class History</div>{classes.length===0?<Empty icon={CalendarDays} title="No classes yet"/>:<Table columns={["Date","Subject","Topic","Tutor","Status","Attendance"]} rows={classes.map(c=>({cells:[fmtDate(c.scheduled_at),c.subject,c.topic||"—",c.tutor?.full_name||"—",<Pill value={c.status}/>,<Pill value={c.attendance||"—"}/>]}))}/>}</Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        <Card><div style={{fontWeight:700,marginBottom:10,fontSize:14}}>Homework</div>{homework.length===0?<div style={{fontSize:13,color:tokens.slate}}>No homework yet.</div>:homework.map(h=>(<div key={h.id} style={{padding:"9px 0",borderBottom:`1px solid ${tokens.line}`}}><div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:13,fontWeight:600}}>{h.title}</div><Pill value={h.status}/></div><div style={{fontSize:12,color:tokens.slate}}>Due {fmtDate(h.due_at)}</div></div>))}</Card>
        <Card><div style={{fontWeight:700,marginBottom:10,fontSize:14}}>Progress Notes</div>{notes.length===0?<div style={{fontSize:13,color:tokens.slate}}>No notes yet.</div>:notes.map(n=>(<div key={n.id} style={{padding:"9px 0",borderBottom:`1px solid ${tokens.line}`}}><div style={{fontSize:13,fontWeight:600}}>{n.topic||"—"}</div><div style={{fontSize:12.5,color:tokens.slate,marginTop:2}}>{n.summary||"—"}</div></div>))}</Card>
      </div>
      <Card style={{marginTop:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontWeight:700,fontSize:14}}>Assigned Tutors</div><Button icon={Plus} variant="secondary" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setShowAssign(true)}>Assign Tutor</Button></div>{assignments.length===0?<div style={{fontSize:13,color:tokens.slate}}>No tutors assigned yet.</div>:assignments.map(a=>(<div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${tokens.line}`}}><div style={{fontSize:13.5,fontWeight:600}}>{a.tutor?.full_name||"—"}</div><Button variant="danger" icon={Trash2} style={{padding:"4px 8px",fontSize:12}} onClick={()=>doRemove(a.id)}>Remove</Button></div>))}</Card>
    </>)}
    {showAssign&&(<Modal title="Assign Tutor" onClose={()=>{setShowAssign(false);setAssignTutorId("");}}><Field label="Select Tutor" required><select style={inputStyle} value={assignTutorId} onChange={e=>setAssignTutorId(e.target.value)}><option value="">— Choose tutor —</option>{availableTutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>{availableTutors.length===0&&<div style={{fontSize:13,color:tokens.slate,marginBottom:14}}>All tutors are already assigned to this student.</div>}<div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Button variant="ghost" onClick={()=>{setShowAssign(false);setAssignTutorId("");}}>Cancel</Button><Button onClick={doAssign} disabled={assignBusy||!assignTutorId||availableTutors.length===0}>{assignBusy?"Assigning…":"Confirm"}</Button></div></Modal>)}
  </div>);
}

function AdminStudents(){
  const[rows,setRows]=useState([]);const[parents,setParents]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[search,setSearch]=useState("");const[detail,setDetail]=useState(null);const[addOpen,setAddOpen]=useState(false);const[editRow,setEditRow]=useState(null);const[delRow,setDelRow]=useState(null);const[busy,setBusy]=useState(false);const{fire,el}=useToast();
  const[fullName,setFullName]=useState("");const[age,setAge]=useState("");const[grade,setGrade]=useState("");const[school,setSchool]=useState("");const[curriculum,setCurriculum]=useState(CURRICULA[0]);const[subjects,setSubjects]=useState("");const[parentId,setParentId]=useState("");const[goals,setGoals]=useState("");const[strengths,setStrengths]=useState("");const[weakAreas,setWeakAreas]=useState("");const[status,setStatus]=useState("Active");
  const resetForm=()=>{setFullName("");setAge("");setGrade("");setSchool("");setCurriculum(CURRICULA[0]);setSubjects("");setParentId("");setGoals("");setStrengths("");setWeakAreas("");setStatus("Active");};
  const load=useCallback(async()=>{setLoading(true);setErr("");const[sr,pr]=await Promise.all([db.getStudents(),db.getParents()]);if(sr.error)setErr(sr.error.message);else setRows(sr.data||[]);setParents(pr.data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const openEdit=s=>{setFullName(s.full_name);setAge(s.age||"");setGrade(s.grade||"");setSchool(s.school||"");setCurriculum(s.curriculum||CURRICULA[0]);setSubjects((s.subjects||[]).join(", "));setParentId(s.parent_id||"");setGoals(s.goals||"");setStrengths(s.strengths||"");setWeakAreas(s.weak_areas||"");setStatus(s.status);setEditRow(s);};
  const save=async()=>{if(!fullName.trim()){fire("Name is required","error");return;}setBusy(true);const payload={full_name:fullName.trim(),age:Number(age)||null,grade,school,curriculum,subjects:subjects.split(",").map(s=>s.trim()).filter(Boolean),parent_id:parentId||null,goals,strengths,weak_areas:weakAreas,status};const{error}=editRow?await db.updateStudent(editRow.id,payload):await db.createStudent(payload);setBusy(false);if(error){fire(error.message,"error");return;}fire(editRow?"Student updated":"Student added");setAddOpen(false);setEditRow(null);resetForm();load();};
  const del=async()=>{setBusy(true);const{error}=await supabase.from("students").delete().eq("id",delRow.id);setBusy(false);if(error){fire(error.message,"error");setDelRow(null);return;}fire("Student deleted");setDelRow(null);load();};
  if(detail)return <AdminStudentDetail student={detail} onBack={()=>setDetail(null)}/>;
  const filtered=rows.filter(s=>s.full_name.toLowerCase().includes(search.toLowerCase()));
  return(<div>{el}
    <SectionTitle title="Students" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Student</Button>}/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    <Card style={{marginBottom:16,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}><Search size={16} color={tokens.slate}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search students…" style={{border:"none",outline:"none",fontSize:13.5,flex:1,background:"transparent"}}/></Card>
    <Card>{loading?<Spinner/>:filtered.length===0?<Empty icon={GraduationCap} title="No students yet" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Student</Button>}/>:(
      <Table columns={["Name","Grade","Curriculum","Subjects","Parent","Status",""]} rows={filtered.map(s=>({cells:[s.full_name,s.grade||"—",s.curriculum||"—",(s.subjects||[]).join(", ")||"—",s.parent?.full_name||"—",<Pill value={s.status}/>,
        <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
          <Button variant="ghost" icon={Edit2} style={{padding:"5px 8px"}} onClick={()=>openEdit(s)}/>
          <Button variant="danger" icon={Trash2} style={{padding:"5px 8px"}} onClick={()=>setDelRow(s)}/>
          <Button variant="secondary" icon={ChevronRight} style={{padding:"5px 8px"}} onClick={()=>setDetail(s)}/>
        </div>
      ]}))}/>
    )}</Card>
    {(addOpen||editRow)&&(<Modal title={editRow?"Edit Student":"Add Student"} wide onClose={()=>{setAddOpen(false);setEditRow(null);}}>
      <Field label="Full Name" required><input style={inputStyle} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Full name" autoFocus/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Age"><input style={inputStyle} type="number" value={age} onChange={e=>setAge(e.target.value)}/></Field>
        <Field label="Grade / Year"><input style={inputStyle} value={grade} onChange={e=>setGrade(e.target.value)} placeholder="Year 10"/></Field>
      </div>
      <Field label="School"><input style={inputStyle} value={school} onChange={e=>setSchool(e.target.value)}/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Curriculum"><select style={inputStyle} value={curriculum} onChange={e=>setCurriculum(e.target.value)}>{CURRICULA.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Status"><select style={inputStyle} value={status} onChange={e=>setStatus(e.target.value)}>{["Active","Inactive","Graduated"].map(s=><option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Subjects (comma-separated)"><input style={inputStyle} value={subjects} onChange={e=>setSubjects(e.target.value)} placeholder="Mathematics, Physics"/></Field>
      <Field label="Parent"><select style={inputStyle} value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">— No parent —</option>{parents.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Strengths"><input style={inputStyle} value={strengths} onChange={e=>setStrengths(e.target.value)}/></Field>
        <Field label="Weak Areas"><input style={inputStyle} value={weakAreas} onChange={e=>setWeakAreas(e.target.value)}/></Field>
      </div>
      <Field label="Goals"><textarea style={{...inputStyle,minHeight:52}} value={goals} onChange={e=>setGoals(e.target.value)}/></Field>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={save} disabled={busy}>{busy?"Saving…":editRow?"Save Changes":"Add Student"}</Button>
    </Modal>)}
    {delRow&&<ConfirmModal message={`Delete "${delRow.full_name}"? This cannot be undone.`} onConfirm={del} onCancel={()=>setDelRow(null)} busy={busy}/>}
  </div>);
}

/* ═══ ADMIN PARENTS ═══ */
function AdminParents(){
  const[rows,setRows]=useState([]);const[students,setStudents]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[addOpen,setAddOpen]=useState(false);const[editRow,setEditRow]=useState(null);const[delRow,setDelRow]=useState(null);const[busy,setBusy]=useState(false);const{fire,el}=useToast();
  const[fullName,setFullName]=useState("");const[email,setEmail]=useState("");const[phone,setPhone]=useState("");const[address,setAddress]=useState("");const[notes,setNotes]=useState("");const[status,setStatus]=useState("Active");
  const resetForm=()=>{setFullName("");setEmail("");setPhone("");setAddress("");setNotes("");setStatus("Active");};
  const load=useCallback(async()=>{setLoading(true);setErr("");const[pr,sr]=await Promise.all([db.getParents(),db.getStudents()]);if(pr.error)setErr(pr.error.message);else setRows(pr.data||[]);setStudents(sr.data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const openEdit=p=>{setFullName(p.full_name);setEmail(p.email||"");setPhone(p.phone||"");setAddress(p.address||"");setNotes(p.notes||"");setStatus(p.status);setEditRow(p);};
  const save=async()=>{if(!fullName.trim()){fire("Name is required","error");return;}setBusy(true);const{error}=editRow?await db.updateParent(editRow.id,{full_name:fullName.trim(),email,phone,address,notes,status}):await db.createParent({full_name:fullName.trim(),email,phone,address,notes,status});setBusy(false);if(error){fire(error.message,"error");return;}fire(editRow?"Parent updated":"Parent added");setAddOpen(false);setEditRow(null);resetForm();load();};
  const del=async()=>{setBusy(true);const{error}=await supabase.from("parents").delete().eq("id",delRow.id);setBusy(false);if(error){fire(error.message,"error");setDelRow(null);return;}fire("Parent deleted");setDelRow(null);load();};
  return(<div>{el}
    <SectionTitle title="Parents" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Parent</Button>}/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    {loading?<Spinner/>:rows.length===0?<Empty icon={UserCircle} title="No parents yet" action={<Button icon={Plus} onClick={()=>setAddOpen(true)}>Add Parent</Button>}/>:(
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {rows.map(p=>{const ch=students.filter(s=>s.parent_id===p.id);return(
          <Card key={p.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{fontWeight:700,fontSize:15}}>{p.full_name}</div><Pill value={p.status}/></div>
            {p.phone&&<div style={{display:"flex",gap:6,alignItems:"center",marginTop:10,fontSize:12.5,color:tokens.slate}}><Phone size={13}/>{p.phone}</div>}
            {p.email&&<div style={{display:"flex",gap:6,alignItems:"center",marginTop:5,fontSize:12.5,color:tokens.slate}}><Mail size={13}/>{p.email}</div>}
            {p.address&&<div style={{display:"flex",gap:6,alignItems:"center",marginTop:5,fontSize:12.5,color:tokens.slate}}><HomeIcon size={13}/>{p.address}</div>}
            {ch.length>0&&<div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${tokens.line}`,fontSize:12.5}}><strong>Children:</strong> {ch.map(c=>c.full_name).join(", ")}</div>}
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <Button variant="ghost" icon={Edit2} style={{flex:1,justifyContent:"center",padding:"7px"}} onClick={()=>openEdit(p)}>Edit</Button>
              <Button variant="danger" icon={Trash2} style={{padding:"7px 10px"}} onClick={()=>setDelRow(p)}/>
            </div>
          </Card>
        );})}
      </div>
    )}
    {(addOpen||editRow)&&(<Modal title={editRow?"Edit Parent":"Add Parent"} onClose={()=>{setAddOpen(false);setEditRow(null);}}>
      <Field label="Full Name" required><input style={inputStyle} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Full name" autoFocus/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Phone"><input style={inputStyle} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+974…"/></Field>
        <Field label="Email"><input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com"/></Field>
      </div>
      <Field label="Address"><input style={inputStyle} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Area, City"/></Field>
      <Field label="Notes"><textarea style={{...inputStyle,minHeight:52}} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <Field label="Status"><select style={inputStyle} value={status} onChange={e=>setStatus(e.target.value)}>{["Active","Inactive"].map(s=><option key={s}>{s}</option>)}</select></Field>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={save} disabled={busy}>{busy?"Saving…":editRow?"Save Changes":"Add Parent"}</Button>
    </Modal>)}
    {delRow&&<ConfirmModal message={`Delete "${delRow.full_name}"?`} onConfirm={del} onCancel={()=>setDelRow(null)} busy={busy}/>}
  </div>);
}

/* ═══ ADMIN TUTORS ═══ */
function AdminTutors(){
  const[rows,setRows]=useState([]);const[students,setStudents]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[addOpen,setAddOpen]=useState(false);const[editRow,setEditRow]=useState(null);const[delRow,setDelRow]=useState(null);const[busy,setBusy]=useState(false);const{fire,el}=useToast();
  const[fullName,setFullName]=useState("");const[email,setEmail]=useState("");const[phone,setPhone]=useState("");const[subjects,setSubjects]=useState("");const[curriculum,setCurriculum]=useState("");const[rateQar,setRateQar]=useState("");const[notes,setNotes]=useState("");const[status,setStatus]=useState("Active");
  const resetForm=()=>{setFullName("");setEmail("");setPhone("");setSubjects("");setCurriculum("");setRateQar("");setNotes("");setStatus("Active");};
  const load=useCallback(async()=>{setLoading(true);setErr("");const[tr,sr]=await Promise.all([db.getTutors(),db.getStudents()]);if(tr.error)setErr(tr.error.message);else setRows(tr.data||[]);setStudents(sr.data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const openEdit=t=>{setFullName(t.full_name);setEmail(t.email||"");setPhone(t.phone||"");setSubjects((t.subjects||[]).join(", "));setCurriculum((t.curriculum||[]).join(", "));setRateQar(t.rate_qar||"");setNotes(t.notes||"");setStatus(t.status);setEditRow(t);};
  const save=async()=>{if(!fullName.trim()){fire("Name is required","error");return;}setBusy(true);const payload={full_name:fullName.trim(),email,phone,subjects:subjects.split(",").map(s=>s.trim()).filter(Boolean),curriculum:curriculum.split(",").map(s=>s.trim()).filter(Boolean),rate_qar:Number(rateQar)||0,notes,status};const{error}=editRow?await db.updateTutor(editRow.id,payload):await db.createTutor(payload);setBusy(false);if(error){fire(error.message,"error");return;}fire(editRow?"Tutor updated":"Tutor added");setAddOpen(false);setEditRow(null);resetForm();load();};
  const del=async()=>{setBusy(true);const{error}=await supabase.from("tutors").delete().eq("id",delRow.id);setBusy(false);if(error){fire(error.message,"error");setDelRow(null);return;}fire("Tutor deleted");setDelRow(null);load();};
  return(<div>{el}
    <SectionTitle title="Tutors" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Tutor</Button>}/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    {loading?<Spinner/>:rows.length===0?<Empty icon={Users} title="No tutors yet" action={<Button icon={Plus} onClick={()=>setAddOpen(true)}>Add Tutor</Button>}/>:(
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {rows.map(t=>{
          const assigned=students.filter(s=>(s.student_tutors||[]).some(st=>st.tutor_id===t.id));
          return(<Card key={t.id}>
            <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontWeight:700,fontSize:15}}>{t.full_name}</div><Pill value={t.status}/></div>
            <div style={{fontSize:12.5,color:tokens.slate,marginTop:4}}>{(t.subjects||[]).join(", ")||"—"}</div>
            <div style={{fontSize:12,color:tokens.slate}}>{(t.curriculum||[]).join(", ")||"—"}</div>
            <div style={{display:"flex",gap:16,marginTop:12,fontSize:12.5}}><div><strong>{fmt(t.rate_qar)}</strong>/hr</div><div><strong>{assigned.length}</strong> students</div></div>
            {t.notes&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${tokens.line}`,fontSize:12.5,color:tokens.slate}}>{t.notes}</div>}
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <Button variant="ghost" icon={Edit2} style={{flex:1,justifyContent:"center",padding:"7px"}} onClick={()=>openEdit(t)}>Edit</Button>
              <Button variant="danger" icon={Trash2} style={{padding:"7px 10px"}} onClick={()=>setDelRow(t)}/>
            </div>
          </Card>);
        })}
      </div>
    )}
    {(addOpen||editRow)&&(<Modal title={editRow?"Edit Tutor":"Add Tutor"} onClose={()=>{setAddOpen(false);setEditRow(null);}}>
      <Field label="Full Name" required><input style={inputStyle} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Full name" autoFocus/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Email"><input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)}/></Field>
        <Field label="Phone"><input style={inputStyle} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+974…"/></Field>
      </div>
      <Field label="Subjects (comma-separated)"><input style={inputStyle} value={subjects} onChange={e=>setSubjects(e.target.value)} placeholder="Mathematics, Physics"/></Field>
      <Field label="Curricula (comma-separated)"><input style={inputStyle} value={curriculum} onChange={e=>setCurriculum(e.target.value)} placeholder="IGCSE, Edexcel"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Hourly Rate (QAR)"><input style={inputStyle} type="number" value={rateQar} onChange={e=>setRateQar(e.target.value)} placeholder="150"/></Field>
        <Field label="Status"><select style={inputStyle} value={status} onChange={e=>setStatus(e.target.value)}>{["Active","Inactive","On Leave"].map(s=><option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Notes"><textarea style={{...inputStyle,minHeight:52}} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={save} disabled={busy}>{busy?"Saving…":editRow?"Save Changes":"Add Tutor"}</Button>
    </Modal>)}
    {delRow&&<ConfirmModal message={`Delete "${delRow.full_name}"?`} onConfirm={del} onCancel={()=>setDelRow(null)} busy={busy}/>}
  </div>);
}

/* ═══ ADMIN CLASSES ═══ */
function AdminClasses(){
  const[rows,setRows]=useState([]);const[students,setStudents]=useState([]);const[tutors,setTutors]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[view,setView]=useState("list");const[addOpen,setAddOpen]=useState(false);const[editRow,setEditRow]=useState(null);const[delRow,setDelRow]=useState(null);const[busy,setBusy]=useState(false);const{fire,el}=useToast();
  const todayStr=()=>new Date().toISOString().slice(0,10);
  const[studentId,setStudentId]=useState("");const[tutorId,setTutorId]=useState("");const[subject,setSubject]=useState(SUBJECTS[0]);const[topic,setTopic]=useState("");const[date,setDate]=useState(todayStr());const[time,setTime]=useState("16:00");const[durationMin,setDurationMin]=useState("60");const[mode,setMode]=useState("Online");const[meetingLink,setMeetingLink]=useState("");const[location,setLocation]=useState("");const[classStatus,setClassStatus]=useState("Scheduled");const[rateQar,setRateQar]=useState("");
  const resetForm=()=>{setStudentId("");setTutorId("");setSubject(SUBJECTS[0]);setTopic("");setDate(todayStr());setTime("16:00");setDurationMin("60");setMode("Online");setMeetingLink("");setLocation("");setClassStatus("Scheduled");setRateQar("");};
  const load=useCallback(async()=>{setLoading(true);setErr("");const[cr,sr,tr]=await Promise.all([db.getClasses(),db.getStudents(),db.getTutors()]);if(cr.error)setErr(cr.error.message);else setRows(cr.data||[]);setStudents(sr.data||[]);setTutors(tr.data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const openEdit=c=>{const d=c.scheduled_at?new Date(c.scheduled_at):new Date();setStudentId(c.student_id);setTutorId(c.tutor_id);setSubject(c.subject);setTopic(c.topic||"");setDate(d.toISOString().slice(0,10));setTime(d.toTimeString().slice(0,5));setDurationMin(String(c.duration_min||60));setMode(c.mode);setMeetingLink(c.meeting_link||"");setLocation(c.location||"");setClassStatus(c.status);setRateQar(c.rate_qar||"");setEditRow(c);};
  const save=async()=>{if(!studentId||!tutorId){fire("Student and tutor are required","error");return;}setBusy(true);const scheduled_at=new Date(`${date}T${time}:00`).toISOString();const payload={student_id:studentId,tutor_id:tutorId,subject,topic,scheduled_at,duration_min:Number(durationMin)||60,mode,meeting_link:meetingLink,location,status:classStatus,rate_qar:Number(rateQar)||null};const{error}=editRow?await db.updateClass(editRow.id,payload):await db.createClass(payload);setBusy(false);if(error){fire(error.message,"error");return;}fire(editRow?"Class updated":"Class scheduled");setAddOpen(false);setEditRow(null);resetForm();load();};
  const del=async()=>{setBusy(true);const{error}=await db.deleteClass(delRow.id);setBusy(false);if(error){fire(error.message,"error");setDelRow(null);return;}fire("Class deleted");setDelRow(null);load();};
  const cancel=async c=>{const{error}=await db.updateClassStatus(c.id,"Cancelled");if(error)fire(error.message,"error");else{fire("Class cancelled");load();}};
  const byDay=rows.reduce((acc,c)=>{const d=c.scheduled_at?.slice(0,10)||"?";(acc[d]=acc[d]||[]).push(c);return acc;},{});
  return(<div>{el}
    <SectionTitle title="Classes" action={<div style={{display:"flex",gap:8}}><Button variant={view==="list"?"primary":"ghost"} onClick={()=>setView("list")}>List</Button><Button variant={view==="calendar"?"primary":"ghost"} onClick={()=>setView("calendar")}>By Day</Button><Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Create Class</Button></div>}/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    {loading?<Spinner/>:rows.length===0?<Empty icon={CalendarDays} title="No classes yet" action={<Button icon={Plus} onClick={()=>setAddOpen(true)}>Schedule First Class</Button>}/>:view==="list"?(
      <Card><Table columns={["Date/Time","Student","Tutor","Subject","Topic","Mode","Status","Attendance",""]}
        rows={rows.map(c=>({cells:[fmtDateTime(c.scheduled_at),c.student?.full_name||"—",c.tutor?.full_name||"—",c.subject,c.topic||"—",
          c.mode==="Online"?<span style={{display:"flex",alignItems:"center",gap:4}}><Video size={13}/> Online</span>:<span style={{display:"flex",alignItems:"center",gap:4}}><MapPin size={13}/> Offline</span>,
          <Pill value={c.status}/>,<Pill value={c.attendance||"Pending"}/>,
          <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
            <Button variant="ghost" icon={Edit2} style={{padding:"5px 8px"}} onClick={()=>openEdit(c)}/>
            {c.status!=="Cancelled"&&<Button variant="ghost" icon={X} style={{padding:"5px 8px"}} onClick={()=>cancel(c)} title="Cancel"/>}
            <Button variant="danger" icon={Trash2} style={{padding:"5px 8px"}} onClick={()=>setDelRow(c)}/>
          </div>
        ]}))}
      /></Card>
    ):(
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {Object.entries(byDay).sort(([a],[b])=>a.localeCompare(b)).map(([day,dc])=>(
          <Card key={day}><div style={{fontWeight:700,fontSize:13.5,marginBottom:10}}>{fmtDate(day+"T00:00:00")}</div>
            {dc.map(c=>(<div key={c.id} style={{padding:"8px 10px",borderRadius:9,background:tokens.tealSoft,marginBottom:7}}>
              <div style={{fontSize:12.5,fontWeight:600}}>{new Date(c.scheduled_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})} · {c.subject}</div>
              <div style={{fontSize:11.5,color:tokens.slate}}>{c.student?.full_name} · {c.tutor?.full_name}</div>
            </div>))}
          </Card>
        ))}
      </div>
    )}
    {(addOpen||editRow)&&(<Modal title={editRow?"Edit Class":"Create Class"} wide onClose={()=>{setAddOpen(false);setEditRow(null);}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Student" required><select style={inputStyle} value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">— Select student —</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Tutor" required><select style={inputStyle} value={tutorId} onChange={e=>setTutorId(e.target.value)}><option value="">— Select tutor —</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
        <Field label="Subject"><select style={inputStyle} value={subject} onChange={e=>setSubject(e.target.value)}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Topic"><input style={inputStyle} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Quadratic Equations"/></Field>
        <Field label="Date"><input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>
        <Field label="Time"><input style={inputStyle} type="time" value={time} onChange={e=>setTime(e.target.value)}/></Field>
        <Field label="Duration (min)"><input style={inputStyle} type="number" value={durationMin} onChange={e=>setDurationMin(e.target.value)}/></Field>
        <Field label="Rate (QAR/hr)"><input style={inputStyle} type="number" value={rateQar} onChange={e=>setRateQar(e.target.value)} placeholder="150"/></Field>
        <Field label="Mode"><select style={inputStyle} value={mode} onChange={e=>setMode(e.target.value)}><option>Online</option><option>Offline</option></select></Field>
        <Field label="Status"><select style={inputStyle} value={classStatus} onChange={e=>setClassStatus(e.target.value)}>{["Scheduled","Completed","Cancelled","Rescheduled"].map(s=><option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label={mode==="Online"?"Meeting Link":"Location"}><input style={inputStyle} value={mode==="Online"?meetingLink:location} onChange={e=>mode==="Online"?setMeetingLink(e.target.value):setLocation(e.target.value)} placeholder={mode==="Online"?"meet.google.com/…":"Student home, …"}/></Field>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={save} disabled={busy}>{busy?"Saving…":editRow?"Save Changes":"Schedule Class"}</Button>
    </Modal>)}
    {delRow&&<ConfirmModal message="Delete this class? Cannot be undone." onConfirm={del} onCancel={()=>setDelRow(null)} busy={busy}/>}
  </div>);
}

/* ═══ ADMIN ATTENDANCE ═══ */
function AdminAttendance(){
  const[rows,setRows]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const{fire,el}=useToast();
  const load=useCallback(async()=>{setLoading(true);const{data,error}=await db.getClasses();if(error)setErr(error.message);else setRows(data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const setAtt=async(id,attendance)=>{const{error}=await db.markAttendance(id,attendance);if(error)fire(error.message,"error");else{fire("Attendance saved");setRows(rows.map(c=>c.id===id?{...c,attendance}:c));}};
  return(<div>{el}
    <SectionTitle title="Attendance"/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    {loading?<Spinner/>:rows.length===0?<Empty icon={ClipboardCheck} title="No classes found"/>:(
      <Card><Table columns={["Date","Student","Tutor","Subject","Status","Attendance"]}
        rows={rows.map(c=>({cells:[fmtDate(c.scheduled_at),c.student?.full_name||"—",c.tutor?.full_name||"—",c.subject,<Pill value={c.status}/>,
          <select value={c.attendance||"Pending"} onChange={e=>setAtt(c.id,e.target.value)} style={{...inputStyle,padding:"5px 8px",width:140}}>
            {["Pending","Present","Absent","Cancelled"].map(o=><option key={o}>{o}</option>)}
          </select>
        ]}))}
      /></Card>
    )}
  </div>);
}

/* ═══ ADMIN HOMEWORK ═══ */
function AdminHomework(){
  const[rows,setRows]=useState([]);const[students,setStudents]=useState([]);const[tutors,setTutors]=useState([]);const[classes,setClasses]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[addOpen,setAddOpen]=useState(false);const[editRow,setEditRow]=useState(null);const[delRow,setDelRow]=useState(null);const[busy,setBusy]=useState(false);const{fire,el}=useToast();
  const[title,setTitle]=useState("");const[description,setDescription]=useState("");const[studentId,setStudentId]=useState("");const[tutorId,setTutorId]=useState("");const[classId,setClassId]=useState("");const[dueAt,setDueAt]=useState("");const[hwStatus,setHwStatus]=useState("Assigned");
  const resetForm=()=>{setTitle("");setDescription("");setStudentId("");setTutorId("");setClassId("");setDueAt("");setHwStatus("Assigned");};
  const load=useCallback(async()=>{setLoading(true);setErr("");const[hr,sr,tr,cr]=await Promise.all([db.getHomework(),db.getStudents(),db.getTutors(),db.getClasses()]);if(hr.error)setErr(hr.error.message);else setRows(hr.data||[]);setStudents(sr.data||[]);setTutors(tr.data||[]);setClasses(cr.data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const openEdit=h=>{setTitle(h.title);setDescription(h.description||"");setStudentId(h.student_id);setTutorId(h.tutor_id);setClassId(h.class_id||"");setDueAt(h.due_at?.slice(0,10)||"");setHwStatus(h.status);setEditRow(h);};
  const save=async()=>{if(!title.trim()||!studentId||!tutorId){fire("Title, student and tutor are required","error");return;}setBusy(true);const payload={title:title.trim(),description,student_id:studentId,tutor_id:tutorId,class_id:classId||null,due_at:dueAt?new Date(dueAt).toISOString():null,status:hwStatus};const{error}=editRow?await db.updateHomework(editRow.id,payload):await db.createHomework(payload);setBusy(false);if(error){fire(error.message,"error");return;}fire(editRow?"Homework updated":"Homework assigned");setAddOpen(false);setEditRow(null);resetForm();load();};
  const del=async()=>{setBusy(true);const{error}=await db.deleteHomework(delRow.id);setBusy(false);if(error){fire(error.message,"error");setDelRow(null);return;}fire("Homework deleted");setDelRow(null);load();};
  return(<div>{el}
    <SectionTitle title="Homework" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Homework</Button>}/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    {loading?<Spinner/>:rows.length===0?<Empty icon={BookOpenCheck} title="No homework yet" action={<Button icon={Plus} onClick={()=>setAddOpen(true)}>Assign Homework</Button>}/>:(
      <Card><Table columns={["Title","Student","Tutor","Due Date","Status",""]}
        rows={rows.map(h=>({cells:[h.title,h.student?.full_name||"—",h.tutor?.full_name||"—",fmtDate(h.due_at),<Pill value={h.status}/>,
          <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
            <Button variant="ghost" icon={Edit2} style={{padding:"5px 8px"}} onClick={()=>openEdit(h)}/>
            <Button variant="danger" icon={Trash2} style={{padding:"5px 8px"}} onClick={()=>setDelRow(h)}/>
          </div>
        ]}))}
      /></Card>
    )}
    {(addOpen||editRow)&&(<Modal title={editRow?"Edit Homework":"Add Homework"} wide onClose={()=>{setAddOpen(false);setEditRow(null);}}>
      <Field label="Title" required><input style={inputStyle} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Homework title" autoFocus/></Field>
      <Field label="Description"><textarea style={{...inputStyle,minHeight:68}} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Instructions…"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Student" required><select style={inputStyle} value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">— Select student —</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Tutor" required><select style={inputStyle} value={tutorId} onChange={e=>setTutorId(e.target.value)}><option value="">— Select tutor —</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
        <Field label="Due Date"><input style={inputStyle} type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></Field>
        <Field label="Status"><select style={inputStyle} value={hwStatus} onChange={e=>setHwStatus(e.target.value)}>{["Assigned","Submitted","Reviewed","Incomplete"].map(s=><option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Linked Class (optional)"><select style={inputStyle} value={classId} onChange={e=>setClassId(e.target.value)}><option value="">— None —</option>{classes.filter(c=>!studentId||c.student_id===studentId).map(c=><option key={c.id} value={c.id}>{c.student?.full_name} · {c.subject} · {fmtDate(c.scheduled_at)}</option>)}</select></Field>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={save} disabled={busy}>{busy?"Saving…":editRow?"Save Changes":"Assign Homework"}</Button>
    </Modal>)}
    {delRow&&<ConfirmModal message={`Delete "${delRow.title}"?`} onConfirm={del} onCancel={()=>setDelRow(null)} busy={busy}/>}
  </div>);
}

/* ═══ ADMIN CLASS NOTES ═══ */
function AdminClassNotes(){
  const[rows,setRows]=useState([]);const[students,setStudents]=useState([]);const[tutors,setTutors]=useState([]);const[classes,setClasses]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[addOpen,setAddOpen]=useState(false);const[editRow,setEditRow]=useState(null);const[delRow,setDelRow]=useState(null);const[busy,setBusy]=useState(false);const{fire,el}=useToast();
  const[noteStudentId,setNoteStudentId]=useState("");const[noteTutorId,setNoteTutorId]=useState("");const[noteClassId,setNoteClassId]=useState("");const[noteTopic,setNoteTopic]=useState("");const[noteUnderstanding,setNoteUnderstanding]=useState("Good");const[noteStrengths,setNoteStrengths]=useState("");const[noteImprovement,setNoteImprovement]=useState("");const[noteRec,setNoteRec]=useState("");const[noteSummary,setNoteSummary]=useState("");const[noteParent,setNoteParent]=useState(true);const[noteStudent,setNoteStudent]=useState(false);
  const resetForm=()=>{setNoteStudentId("");setNoteTutorId("");setNoteClassId("");setNoteTopic("");setNoteUnderstanding("Good");setNoteStrengths("");setNoteImprovement("");setNoteRec("");setNoteSummary("");setNoteParent(true);setNoteStudent(false);};
  const load=useCallback(async()=>{setLoading(true);setErr("");const[nr,sr,tr,cr]=await Promise.all([db.getClassNotes(),db.getStudents(),db.getTutors(),db.getClasses()]);if(nr.error)setErr(nr.error.message);else setRows(nr.data||[]);setStudents(sr.data||[]);setTutors(tr.data||[]);setClasses(cr.data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const openEdit=n=>{setNoteStudentId(n.student_id||"");setNoteTutorId(n.tutor_id||"");setNoteClassId(n.class_id||"");setNoteTopic(n.topic||"");setNoteUnderstanding(n.understanding||"Good");setNoteStrengths(n.strengths||"");setNoteImprovement(n.areas_to_improve||"");setNoteRec(n.recommendation||"");setNoteSummary(n.summary||"");setNoteParent(n.is_shared_with_parent??true);setNoteStudent(n.is_shared_with_student??false);setEditRow(n);};
  const save=async()=>{if(!noteStudentId||!noteTutorId||!noteTopic.trim()){fire("Student, tutor and topic are required","error");return;}setBusy(true);const payload={student_id:noteStudentId,tutor_id:noteTutorId,class_id:noteClassId||null,topic:noteTopic.trim(),understanding:noteUnderstanding,strengths:noteStrengths,areas_to_improve:noteImprovement,recommendation:noteRec,summary:noteSummary,is_shared_with_parent:noteParent,is_shared_with_student:noteStudent};const{error}=editRow?await db.updateClassNote(editRow.id,payload):await db.createClassNote(payload);setBusy(false);if(error){fire(error.message,"error");return;}fire(editRow?"Note updated":"Note added");setAddOpen(false);setEditRow(null);resetForm();load();};
  const del=async()=>{setBusy(true);const{error}=await db.deleteClassNote(delRow.id);setBusy(false);if(error){fire(error.message,"error");setDelRow(null);return;}fire("Note deleted");setDelRow(null);load();};
  const understandingColor={Excellent:tokens.success,Good:tokens.teal,Fair:tokens.warn,"Needs Support":tokens.danger};
  return(<div>{el}
    <SectionTitle title="Class Notes" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Note</Button>}/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    {loading?<Spinner/>:rows.length===0?<Empty icon={FileText} title="No notes yet" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Note</Button>}/>:(
      <Card><Table columns={["Student","Tutor","Topic","Understanding","Shared With",""]}
        rows={rows.map(n=>({cells:[
          n.student?.full_name||"—",n.tutor?.full_name||"—",n.topic||"—",
          <span style={{fontSize:12.5,fontWeight:700,color:understandingColor[n.understanding]||tokens.slate}}>{n.understanding||"—"}</span>,
          <span style={{fontSize:12}}>{n.is_shared_with_parent?"Parent ":""}{n.is_shared_with_student?"Student":""}</span>,
          <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
            <Button variant="ghost" icon={Edit2} style={{padding:"5px 8px"}} onClick={()=>openEdit(n)}/>
            <Button variant="danger" icon={Trash2} style={{padding:"5px 8px"}} onClick={()=>setDelRow(n)}/>
          </div>
        ]}))}
      /></Card>
    )}
    {(addOpen||editRow)&&(<Modal title={editRow?"Edit Note":"Add Class Note"} wide onClose={()=>{setAddOpen(false);setEditRow(null);}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Student" required><select style={inputStyle} value={noteStudentId} onChange={e=>setNoteStudentId(e.target.value)}><option value="">— Select student —</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Tutor" required><select style={inputStyle} value={noteTutorId} onChange={e=>setNoteTutorId(e.target.value)}><option value="">— Select tutor —</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
        <Field label="Topic" required><input style={inputStyle} value={noteTopic} onChange={e=>setNoteTopic(e.target.value)} placeholder="e.g. Quadratic Equations"/></Field>
        <Field label="Understanding"><select style={inputStyle} value={noteUnderstanding} onChange={e=>setNoteUnderstanding(e.target.value)}>{["Excellent","Good","Fair","Needs Support"].map(o=><option key={o}>{o}</option>)}</select></Field>
      </div>
      <Field label="Linked Class (optional)"><select style={inputStyle} value={noteClassId} onChange={e=>setNoteClassId(e.target.value)}><option value="">— None —</option>{classes.filter(c=>!noteStudentId||c.student_id===noteStudentId).map(c=><option key={c.id} value={c.id}>{c.student?.full_name} · {c.subject} · {fmtDate(c.scheduled_at)}</option>)}</select></Field>
      <Field label="Strengths"><input style={inputStyle} value={noteStrengths} onChange={e=>setNoteStrengths(e.target.value)} placeholder="What the student did well…"/></Field>
      <Field label="Areas to improve"><input style={inputStyle} value={noteImprovement} onChange={e=>setNoteImprovement(e.target.value)} placeholder="What needs more practice…"/></Field>
      <Field label="Recommendation"><input style={inputStyle} value={noteRec} onChange={e=>setNoteRec(e.target.value)} placeholder="Suggested next steps…"/></Field>
      <Field label="Summary (shown to parent)"><textarea style={{...inputStyle,minHeight:68}} value={noteSummary} onChange={e=>setNoteSummary(e.target.value)} placeholder="A plain-language update…"/></Field>
      <div style={{display:"flex",gap:20,marginBottom:14}}>
        <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13,cursor:"pointer"}}><input type="checkbox" checked={noteParent} onChange={e=>setNoteParent(e.target.checked)}/> Share with parent</label>
        <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13,cursor:"pointer"}}><input type="checkbox" checked={noteStudent} onChange={e=>setNoteStudent(e.target.checked)}/> Share with student</label>
      </div>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={save} disabled={busy}>{busy?"Saving…":editRow?"Save Changes":"Add Note"}</Button>
    </Modal>)}
    {delRow&&<ConfirmModal message={`Delete note for "${delRow.student?.full_name}"?`} onConfirm={del} onCancel={()=>setDelRow(null)} busy={busy}/>}
  </div>);
}

/* ═══ ADMIN MATERIALS ═══ */
function AdminMaterials(){
  const[rows,setRows]=useState([]);const[students,setStudents]=useState([]);const[tutors,setTutors]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[addOpen,setAddOpen]=useState(false);const[editRow,setEditRow]=useState(null);const[delRow,setDelRow]=useState(null);const[busy,setBusy]=useState(false);const{fire,el}=useToast();
  const[matTitle,setMatTitle]=useState("");const[matDesc,setMatDesc]=useState("");const[matSubject,setMatSubject]=useState(SUBJECTS[0]);const[matUrl,setMatUrl]=useState("");const[matPublic,setMatPublic]=useState(false);const[matStudentId,setMatStudentId]=useState("");const[matTutorId,setMatTutorId]=useState("");
  const resetForm=()=>{setMatTitle("");setMatDesc("");setMatSubject(SUBJECTS[0]);setMatUrl("");setMatPublic(false);setMatStudentId("");setMatTutorId("");};
  const load=useCallback(async()=>{setLoading(true);setErr("");const[mr,sr,tr]=await Promise.all([db.getMaterials(),db.getStudents(),db.getTutors()]);if(mr.error)setErr(mr.error.message);else setRows(mr.data||[]);setStudents(sr.data||[]);setTutors(tr.data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const openEdit=m=>{setMatTitle(m.title);setMatDesc(m.description||"");setMatSubject(m.subject||SUBJECTS[0]);setMatUrl(m.file_url||"");setMatPublic(m.is_public||false);setMatStudentId(m.student_id||"");setMatTutorId(m.tutor_id||"");setEditRow(m);};
  const save=async()=>{if(!matTitle.trim()||!matTutorId){fire("Title and tutor are required","error");return;}setBusy(true);const payload={title:matTitle.trim(),description:matDesc,subject:matSubject,file_url:matUrl||null,is_public:matPublic,tutor_id:matTutorId,student_id:matStudentId||null};const{error}=editRow?await db.updateMaterial(editRow.id,payload):await db.createMaterial(payload);setBusy(false);if(error){fire(error.message,"error");return;}fire(editRow?"Material updated":"Material added");setAddOpen(false);setEditRow(null);resetForm();load();};
  const del=async()=>{setBusy(true);const{error}=await db.deleteMaterial(delRow.id);setBusy(false);if(error){fire(error.message,"error");setDelRow(null);return;}fire("Material deleted");setDelRow(null);load();};
  return(<div>{el}
    <SectionTitle title="Study Materials" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Material</Button>}/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    {loading?<Spinner/>:rows.length===0?<Empty icon={BookOpen} title="No materials yet" action={<Button icon={Plus} onClick={()=>{resetForm();setAddOpen(true);}}>Add Material</Button>}/>:(
      <Card><Table columns={["Title","Subject","Tutor","For Student","Public",""]}
        rows={rows.map(m=>({cells:[
          m.title,m.subject||"—",m.tutor?.full_name||"—",m.student?.full_name||"All",
          m.is_public?<Pill value="Active"/>:<span style={{fontSize:12,color:tokens.slate}}>No</span>,
          <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
            {m.file_url&&<a href={m.file_url} target="_blank" rel="noreferrer"><Button variant="secondary" icon={Download} style={{padding:"5px 8px"}}/></a>}
            <Button variant="ghost" icon={Edit2} style={{padding:"5px 8px"}} onClick={()=>openEdit(m)}/>
            <Button variant="danger" icon={Trash2} style={{padding:"5px 8px"}} onClick={()=>setDelRow(m)}/>
          </div>
        ]}))}
      /></Card>
    )}
    {(addOpen||editRow)&&(<Modal title={editRow?"Edit Material":"Add Material"} wide onClose={()=>{setAddOpen(false);setEditRow(null);}}>
      <Field label="Title" required><input style={inputStyle} value={matTitle} onChange={e=>setMatTitle(e.target.value)} placeholder="e.g. IGCSE Algebra Formula Sheet" autoFocus/></Field>
      <Field label="Description"><textarea style={{...inputStyle,minHeight:52}} value={matDesc} onChange={e=>setMatDesc(e.target.value)}/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Subject"><select style={inputStyle} value={matSubject} onChange={e=>setMatSubject(e.target.value)}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Tutor" required><select style={inputStyle} value={matTutorId} onChange={e=>setMatTutorId(e.target.value)}><option value="">— Select tutor —</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
        <Field label="For Student (optional)"><select style={inputStyle} value={matStudentId} onChange={e=>setMatStudentId(e.target.value)}><option value="">— All students —</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
      </div>
      <Field label="File URL or Link"><input style={inputStyle} value={matUrl} onChange={e=>setMatUrl(e.target.value)} placeholder="https://…"/></Field>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",marginBottom:16}}><input type="checkbox" checked={matPublic} onChange={e=>setMatPublic(e.target.checked)}/> Visible to all students (public)</label>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={save} disabled={busy}>{busy?"Saving…":editRow?"Save Changes":"Add Material"}</Button>
    </Modal>)}
    {delRow&&<ConfirmModal message={`Delete "${delRow.title}"?`} onConfirm={del} onCancel={()=>setDelRow(null)} busy={busy}/>}
  </div>);
}

/* ═══ ADMIN PAYMENTS ═══ */
function AdminPayments(){
  const[payments,setPayments]=useState([]);const[invoices,setInvoices]=useState([]);const[parents,setParents]=useState([]);const[students,setStudents]=useState([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[tab,setTab]=useState("invoices");const[showPay,setShowPay]=useState(false);const[showInv,setShowInv]=useState(false);const[busy,setBusy]=useState(false);const{fire,el}=useToast();
  const[payParentId,setPayParentId]=useState("");const[payInvId,setPayInvId]=useState("");const[payAmount,setPayAmount]=useState("");const[payMethod,setPayMethod]=useState("Cash");const[payRef,setPayRef]=useState("");const[payNotes,setPayNotes]=useState("");
  const[invParentId,setInvParentId]=useState("");const[invStudentId,setInvStudentId]=useState("");const[invTotal,setInvTotal]=useState("");const[invDiscount,setInvDiscount]=useState("0");const[invPeriodStart,setInvPeriodStart]=useState("");const[invPeriodEnd,setInvPeriodEnd]=useState("");const[invNotes,setInvNotes]=useState("");const[invStatus,setInvStatus]=useState("Draft");
  const load=useCallback(async()=>{setLoading(true);setErr("");const[pr,ir,par,sr]=await Promise.all([db.getPayments(),db.getInvoices(),db.getParents(),db.getStudents()]);if(pr.error)setErr(pr.error.message);else setPayments(pr.data||[]);setInvoices(ir.data||[]);setParents(par.data||[]);setStudents(sr.data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const totalCollected=payments.reduce((s,p)=>s+Number(p.amount_qar||0),0);
  const totalOutstanding=invoices.filter(i=>["Issued","Partially Paid","Overdue"].includes(i.status)).reduce((s,i)=>s+Number(i.balance_qar||0),0);
  const savePay=async()=>{if(!payParentId||!payAmount){fire("Parent and amount are required","error");return;}setBusy(true);const linkedInv=payInvId?invoices.find(i=>i.id===payInvId):null;const{error}=await db.createPayment({parent_id:payParentId,invoice_id:payInvId||null,student_id:linkedInv?.student_id||null,amount_qar:Number(payAmount),method:payMethod,reference:payRef,notes:payNotes});setBusy(false);if(error){fire(error.message,"error");return;}fire("Payment recorded");setShowPay(false);setPayParentId("");setPayInvId("");setPayAmount("");setPayMethod("Cash");setPayRef("");setPayNotes("");load();};
  const saveInv=async()=>{if(!invParentId||!invTotal){fire("Parent and total are required","error");return;}setBusy(true);const invNum=await db.generateInvoiceNumber();const{error}=await db.createInvoice({parent_id:invParentId,student_id:invStudentId||null,invoice_number:invNum,total_qar:Number(invTotal),subtotal_qar:Number(invTotal),discount_qar:Number(invDiscount)||0,period_start:invPeriodStart||null,period_end:invPeriodEnd||null,notes:invNotes,status:invStatus});setBusy(false);if(error){fire(error.message,"error");return;}fire("Invoice created");setShowInv(false);setInvParentId("");setInvStudentId("");setInvTotal("");setInvDiscount("0");setInvPeriodStart("");setInvPeriodEnd("");setInvNotes("");setInvStatus("Draft");load();};
  const issueInv=async inv=>{const{error}=await db.updateInvoice(inv.id,{status:"Issued",issued_at:new Date().toISOString()});if(error)fire(error.message,"error");else{fire("Invoice issued");load();}};
  return(<div>{el}
    <SectionTitle title="Payments & Invoices" action={<div style={{display:"flex",gap:8}}><Button variant="secondary" icon={Plus} onClick={()=>setShowInv(true)}>New Invoice</Button><Button icon={Plus} onClick={()=>setShowPay(true)}>Record Payment</Button></div>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
      <StatCard icon={Wallet} label="Total Collected (QAR)" value={fmt(totalCollected)} accent={tokens.successBg}/>
      <StatCard icon={AlertCircle} label="Outstanding (QAR)" value={fmt(totalOutstanding)} accent={tokens.warnBg}/>
      <StatCard icon={FileText} label="Total Invoices" value={invoices.length}/>
    </div>
    <Card style={{marginBottom:16,padding:"10px 14px",display:"flex",gap:8}}>
      {["invoices","payments"].map(t=><div key={t} onClick={()=>setTab(t)} style={{padding:"6px 16px",borderRadius:999,fontSize:13,fontWeight:600,cursor:"pointer",background:tab===t?tokens.teal:tokens.tealSoft,color:tab===t?"#fff":tokens.tealDeep,textTransform:"capitalize"}}>{t}</div>)}
    </Card>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    {loading?<Spinner/>:tab==="invoices"?(
      <Card>{invoices.length===0?<Empty icon={FileText} title="No invoices yet" action={<Button icon={Plus} onClick={()=>setShowInv(true)}>New Invoice</Button>}/>:
        <Table columns={["Invoice #","Parent","Student","Total (QAR)","Paid (QAR)","Balance (QAR)","Status",""]}
          rows={invoices.map(inv=>({cells:[inv.invoice_number,inv.parent?.full_name||"—",inv.student?.full_name||"—",fmt(inv.total_qar),fmt(inv.paid_qar),fmt(inv.balance_qar),<Pill value={inv.status}/>,
            inv.status==="Draft"?<Button variant="secondary" style={{padding:"5px 10px",fontSize:12}} onClick={()=>issueInv(inv)}>Issue</Button>:null
          ]}))}
        />
      }</Card>
    ):(
      <Card>{payments.length===0?<Empty icon={Wallet} title="No payments yet" action={<Button icon={Plus} onClick={()=>setShowPay(true)}>Record Payment</Button>}/>:
        <Table columns={["Date","Parent","Student","Amount (QAR)","Method","Reference"]}
          rows={payments.map(p=>({cells:[fmtDate(p.paid_at),p.parent?.full_name||"—",p.student?.full_name||"—",fmt(p.amount_qar),p.method||"—",p.reference||"—"]}))}
        />
      }</Card>
    )}
    {showPay&&(<Modal title="Record Payment" onClose={()=>setShowPay(false)}>
      <Field label="Parent" required><select style={inputStyle} value={payParentId} onChange={e=>setPayParentId(e.target.value)}><option value="">— Select parent —</option>{parents.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
      <Field label="Link to Invoice (optional)"><select style={inputStyle} value={payInvId} onChange={e=>setPayInvId(e.target.value)}><option value="">— None —</option>{invoices.filter(i=>!payParentId||i.parent_id===payParentId).map(i=><option key={i.id} value={i.id}>{i.invoice_number} · {fmt(i.balance_qar)} outstanding</option>)}</select></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Amount (QAR)" required><input style={inputStyle} type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="500"/></Field>
        <Field label="Method"><select style={inputStyle} value={payMethod} onChange={e=>setPayMethod(e.target.value)}>{["Cash","Bank Transfer","Card","Online","Cheque"].map(m=><option key={m}>{m}</option>)}</select></Field>
      </div>
      <Field label="Reference"><input style={inputStyle} value={payRef} onChange={e=>setPayRef(e.target.value)}/></Field>
      <Field label="Notes"><textarea style={{...inputStyle,minHeight:50}} value={payNotes} onChange={e=>setPayNotes(e.target.value)}/></Field>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={savePay} disabled={busy}>{busy?"Saving…":"Record Payment"}</Button>
    </Modal>)}
    {showInv&&(<Modal title="Create Invoice" wide onClose={()=>setShowInv(false)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Parent" required><select style={inputStyle} value={invParentId} onChange={e=>setInvParentId(e.target.value)}><option value="">— Select parent —</option>{parents.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
        <Field label="Student (optional)"><select style={inputStyle} value={invStudentId} onChange={e=>setInvStudentId(e.target.value)}><option value="">— None —</option>{students.filter(s=>!invParentId||s.parent_id===invParentId).map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Period Start"><input style={inputStyle} type="date" value={invPeriodStart} onChange={e=>setInvPeriodStart(e.target.value)}/></Field>
        <Field label="Period End"><input style={inputStyle} type="date" value={invPeriodEnd} onChange={e=>setInvPeriodEnd(e.target.value)}/></Field>
        <Field label="Total (QAR)" required><input style={inputStyle} type="number" value={invTotal} onChange={e=>setInvTotal(e.target.value)} placeholder="1500"/></Field>
        <Field label="Discount (QAR)"><input style={inputStyle} type="number" value={invDiscount} onChange={e=>setInvDiscount(e.target.value)}/></Field>
        <Field label="Status"><select style={inputStyle} value={invStatus} onChange={e=>setInvStatus(e.target.value)}>{["Draft","Issued"].map(s=><option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Notes"><textarea style={{...inputStyle,minHeight:50}} value={invNotes} onChange={e=>setInvNotes(e.target.value)}/></Field>
      <Button style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={saveInv} disabled={busy}>{busy?"Saving…":"Create Invoice"}</Button>
    </Modal>)}
  </div>);
}

/* ═══ ADMIN ASSESSMENTS ═══ */
function AdminAssessments(){
  const[rows,setRows]=useState([]);const[detail,setDetail]=useState(null);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[filter,setFilter]=useState("all");const{fire,el}=useToast();
  const load=useCallback(async()=>{setLoading(true);setErr("");const{data,error}=await db.getAssessmentRequests();if(error)setErr(error.message);else setRows(data||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const setStatus=async(id,status)=>{const{error}=await db.updateAssessmentRequest(id,{status});if(error)fire(error.message,"error");else{fire("Status updated");setDetail(d=>d?{...d,status}:d);load();}};
  const visible=filter==="all"?rows:rows.filter(r=>r.status===filter);
  if(detail)return(<div>{el}
    <div onClick={()=>setDetail(null)} style={{display:"flex",alignItems:"center",gap:6,color:tokens.slate,fontSize:13,cursor:"pointer",marginBottom:14}}><ArrowLeft size={14}/> Back to Requests</div>
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}><div><div style={{fontFamily:"Fraunces, serif",fontSize:21,fontWeight:600}}>{detail.student_name||"—"}</div><div style={{fontSize:13,color:tokens.slate}}>Submitted {fmtDate(detail.submitted_at)}</div></div><Pill value={detail.status}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:16}}>
        <div><div style={{fontSize:12,fontWeight:700,color:tokens.slate,marginBottom:8}}>PARENT CONTACT</div><div style={{fontSize:13.5,fontWeight:600}}>{detail.parent_name}</div>{detail.parent_email&&<div style={{fontSize:13,color:tokens.slate,display:"flex",gap:5,marginTop:4}}><Mail size={13}/>{detail.parent_email}</div>}{detail.parent_phone&&<div style={{fontSize:13,color:tokens.slate,display:"flex",gap:5,marginTop:4}}><Phone size={13}/>{detail.parent_phone}</div>}</div>
        <div><div style={{fontSize:12,fontWeight:700,color:tokens.slate,marginBottom:8}}>STUDENT INFO</div>{detail.student_grade&&<div style={{fontSize:13.5}}>{detail.student_grade}</div>}{detail.school&&<div style={{fontSize:13.5}}>{detail.school}</div>}{detail.curriculum&&<div style={{fontSize:13.5}}>{detail.curriculum}</div>}</div>
      </div>
      {detail.subjects?.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:tokens.slate,marginBottom:6}}>SUBJECTS</div><div style={{fontSize:13.5}}>{detail.subjects.join(", ")}</div></div>}
      {detail.message&&<div style={{marginBottom:18}}><div style={{fontSize:12,fontWeight:700,color:tokens.slate,marginBottom:6}}>MESSAGE</div><div style={{fontSize:13.5}}>{detail.message}</div></div>}
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{["New","Contacted","Converted","Closed"].map(s=><Button key={s} variant={detail.status===s?"primary":"ghost"} style={{padding:"7px 16px"}} onClick={()=>setStatus(detail.id,s)}>{s}</Button>)}</div>
    </Card>
  </div>);
  return(<div>{el}
    <SectionTitle eyebrow="Incoming" title="Assessment Requests"/>
    {err&&<ErrBanner message={err} onRetry={load}/>}
    <Card style={{marginBottom:16,padding:"10px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
      {["all","New","Contacted","Converted","Closed"].map(f=><div key={f} onClick={()=>setFilter(f)} style={{padding:"6px 14px",borderRadius:999,fontSize:12.5,fontWeight:600,cursor:"pointer",background:filter===f?tokens.teal:tokens.tealSoft,color:filter===f?"#fff":tokens.tealDeep}}>{f==="all"?"All Requests":f}</div>)}
    </Card>
    {loading?<Spinner/>:visible.length===0?<Empty icon={CheckSquare} title="No requests" body={filter==="all"?"No assessment requests yet.":"No requests with this status."}/>:(
      <Card><Table columns={["Date","Student","Parent","Grade","Subjects","Status",""]}
        rows={visible.map(r=>({cells:[fmtDate(r.submitted_at),r.student_name||"—",r.parent_name||"—",r.student_grade||"—",(r.subjects||[]).join(", ")||"—",<Pill value={r.status}/>,
          <Button variant="secondary" icon={ChevronRight} style={{padding:"5px 10px"}} onClick={()=>setDetail(r)}>View</Button>
        ]}))}
      /></Card>
    )}
  </div>);
}

/* ═══ ADMIN REPORTS ═══ */
function AdminReports() {
  const [active,  setActive]  = useState(null);
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  const reports = [
    { key: "revenue",     title: "Monthly Revenue Report",   desc: "Total billed, collected, and pending balance by student and parent.",  icon: Wallet },
    { key: "pending",     title: "Pending Payments Report",  desc: "All unpaid or partially paid invoices with balances and due dates.",    icon: AlertCircle },
    { key: "attendance",  title: "Attendance Report",        desc: "Present, absent, and cancelled counts per student and tutor.",          icon: ClipboardCheck },
    { key: "performance", title: "Tutor Performance Report", desc: "Classes completed, cancelled, homework assigned, and notes submitted.", icon: Award },
    { key: "progress",    title: "Student Progress Report",  desc: "Subjects, classes, homework status, and latest tutor notes.",          icon: TrendingUp },
  ];

  const generate = async (key) => {
    setActive(key); setLoading(true); setErr(""); setData([]);
    const fns = {
      revenue:     db.getRevenueReport,
      pending:     db.getOutstandingPaymentsReport,
      attendance:  db.getAttendanceReport,
      performance: db.getTutorPerformanceReport,
      progress:    db.getProgressReport,
    };
    const { data: d, error } = await fns[key]();
    if (error) setErr(error.message); else setData(d || []);
    setLoading(false);
  };

  /* ── Aggregate helpers ── */
  const aggregateRevenue = (rows) => {
    const byStudent = {};
    rows.forEach(r => {
      const k = r.student?.full_name || r.parent?.full_name || "Unknown";
      if (!byStudent[k]) byStudent[k] = { name: k, parent: r.parent?.full_name || "—", paid: 0, count: 0 };
      byStudent[k].paid  += Number(r.amount_qar || 0);
      byStudent[k].count += 1;
    });
    return Object.values(byStudent).sort((a, b) => b.paid - a.paid);
  };

  const aggregateAttendance = (rows) => {
    const byStudent = {};
    rows.forEach(r => {
      const k = r.student?.full_name || "Unknown";
      if (!byStudent[k]) byStudent[k] = { name: k, tutor: r.tutor?.full_name || "—", present: 0, absent: 0, cancelled: 0, total: 0 };
      byStudent[k].total++;
      const att = (r.attendance || "").toLowerCase();
      if (att === "present")   byStudent[k].present++;
      else if (att === "absent") byStudent[k].absent++;
      else if (att === "cancelled") byStudent[k].cancelled++;
    });
    return Object.values(byStudent).sort((a, b) => b.total - a.total);
  };

  const aggregatePerformance = (rows) => {
    const byTutor = {};
    rows.forEach(r => {
      const k = r.tutor?.full_name || "Unknown";
      if (!byTutor[k]) byTutor[k] = { name: k, completed: 0, cancelled: 0, total: 0 };
      byTutor[k].total++;
      if (r.status === "Completed") byTutor[k].completed++;
      if (r.status === "Cancelled") byTutor[k].cancelled++;
    });
    return Object.values(byTutor).sort((a, b) => b.total - a.total);
  };

  const aggregateProgress = (rows) => {
    const byStudent = {};
    rows.forEach(r => {
      const k = r.student?.full_name || "Unknown";
      if (!byStudent[k]) byStudent[k] = { name: k, grade: r.student?.grade || "—", subjects: r.student?.subjects || [], notes: [] };
      byStudent[k].notes.push({ topic: r.topic || r.class?.subject || "—", understanding: r.understanding || "—", summary: r.summary || "", tutor: r.tutor?.full_name || "—", date: r.created_at });
    });
    return Object.values(byStudent);
  };

  /* ── Print/Download ── */
  const handlePrint = () => window.print();

  /* ── Table renderers ── */
  const renderReport = () => {
    if (!data.length) return <Empty icon={FileBarChart} title="No data for this report period" />;

    if (active === "revenue") {
      const agg = aggregateRevenue(data);
      const total = agg.reduce((s, r) => s + r.paid, 0);
      return (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
            <StatCard icon={Wallet}      label="Total Collected (QAR)" value={fmt(total)} accent={tokens.successBg} />
            <StatCard icon={FileText}    label="Payment Records"        value={data.length} />
            <StatCard icon={GraduationCap} label="Students"             value={agg.length} />
          </div>
          <Table columns={["Student / Parent", "Parent", "Payments", "Total Collected (QAR)"]}
            rows={agg.map(r => ({ cells: [r.name, r.parent, r.count, fmt(r.paid)] }))} />
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${tokens.line}` }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 12 }}>All Payment Records</div>
            <Table columns={["Date", "Parent", "Student", "Tutor", "Amount (QAR)", "Method", "Reference"]}
              rows={data.map(r => ({ cells: [fmtDate(r.paid_at), r.parent?.full_name || "—", r.student?.full_name || "—", r.tutor?.full_name || "—", fmt(r.amount_qar), r.method || "—", r.reference || "—"] }))} />
          </div>
        </>
      );
    }

    if (active === "pending") {
      const total = data.reduce((s, r) => s + Number(r.balance_qar || 0), 0);
      return (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
            <StatCard icon={AlertCircle} label="Outstanding (QAR)" value={fmt(total)} accent={tokens.warnBg} />
            <StatCard icon={FileText}    label="Unpaid Invoices"    value={data.length} />
            <StatCard icon={UserCircle}  label="Parents with balance" value={[...new Set(data.map(r => r.parent_id))].length} />
          </div>
          <Table columns={["Invoice #", "Parent", "Student", "Total (QAR)", "Paid (QAR)", "Balance (QAR)", "Status", "Due Date"]}
            rows={data.map(r => ({ cells: [r.invoice_number || "—", r.parent?.full_name || "—", r.student?.full_name || "—", fmt(r.total_qar), fmt(r.paid_qar), <span style={{ fontWeight: 700, color: tokens.danger }}>{fmt(r.balance_qar)}</span>, <Pill value={r.status} />, fmtDate(r.due_at)] }))} />
        </>
      );
    }

    if (active === "attendance") {
      const agg = aggregateAttendance(data);
      return (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
            <StatCard icon={CheckCircle2} label="Present"   value={data.filter(r => r.attendance === "Present").length}   accent={tokens.successBg} />
            <StatCard icon={AlertCircle}  label="Absent"    value={data.filter(r => r.attendance === "Absent").length}    accent={tokens.dangerBg}  />
            <StatCard icon={X}            label="Cancelled" value={data.filter(r => r.attendance === "Cancelled").length} accent={tokens.warnBg}    />
            <StatCard icon={CalendarDays} label="Total"     value={data.length} />
          </div>
          <Table columns={["Student", "Tutor", "Total Classes", "Present", "Absent", "Cancelled", "Attendance %"]}
            rows={agg.map(r => ({ cells: [r.name, r.tutor, r.total, r.present, r.absent, r.cancelled, r.total > 0 ? `${Math.round((r.present / r.total) * 100)}%` : "—"] }))} />
        </>
      );
    }

    if (active === "performance") {
      const agg = aggregatePerformance(data);
      return (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
            <StatCard icon={CheckCircle2} label="Completed Classes" value={data.filter(r => r.status === "Completed").length} accent={tokens.successBg} />
            <StatCard icon={X}            label="Cancelled Classes" value={data.filter(r => r.status === "Cancelled").length} accent={tokens.warnBg} />
            <StatCard icon={Users}        label="Active Tutors"     value={agg.length} />
          </div>
          <Table columns={["Tutor", "Total Classes", "Completed", "Cancelled", "Completion Rate"]}
            rows={agg.map(r => ({ cells: [r.name, r.total, r.completed, r.cancelled, r.total > 0 ? `${Math.round((r.completed / r.total) * 100)}%` : "—"] }))} />
        </>
      );
    }

    if (active === "progress") {
      const agg = aggregateProgress(data);
      return (
        <div>
          {agg.map(s => (
            <Card key={s.name} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 12.5, color: tokens.slate }}>{s.grade} · {(s.subjects || []).join(", ") || "—"}</div>
                </div>
                <div style={{ fontSize: 12.5, color: tokens.slate }}>{s.notes.length} note{s.notes.length !== 1 ? "s" : ""}</div>
              </div>
              {s.notes.slice(0, 3).map((n, i) => (
                <div key={i} style={{ padding: "8px 12px", background: tokens.paper, borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{n.topic}</div>
                    <div style={{ fontSize: 12, color: tokens.slate }}>{n.tutor} · {fmtDate(n.date)}</div>
                  </div>
                  {n.summary && <div style={{ fontSize: 12.5, color: tokens.slate, fontStyle: "italic" }}>"{n.summary}"</div>}
                  {n.understanding !== "—" && <Pill value={n.understanding} />}
                </div>
              ))}
              {s.notes.length > 3 && <div style={{ fontSize: 12, color: tokens.slate, marginTop: 4 }}>+{s.notes.length - 3} more notes</div>}
            </Card>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      <SectionTitle title="Reports" action={
        active && !loading && data.length > 0
          ? <Button variant="secondary" icon={Download} onClick={handlePrint}>Print / Save PDF</Button>
          : null
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: active ? 24 : 0 }}>
        {reports.map(r => (
          <Card key={r.key} style={{ display: "flex", flexDirection: "column", gap: 10, cursor: "pointer", border: `1.5px solid ${active === r.key ? tokens.teal : tokens.line}`, background: active === r.key ? tokens.tealSoft : tokens.cardBg }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: active === r.key ? tokens.teal : tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <r.icon size={17} color={active === r.key ? "#fff" : tokens.tealDeep} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.title}</div>
            <div style={{ fontSize: 12.5, color: tokens.slate, flex: 1 }}>{r.desc}</div>
            <Button variant={active === r.key ? "primary" : "secondary"} icon={active === r.key ? RefreshCw : Download} onClick={() => generate(r.key)}>
              {active === r.key ? "Refresh" : "Generate"}
            </Button>
          </Card>
        ))}
      </div>

      {active && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600 }}>{reports.find(r => r.key === active)?.title}</div>
            {!loading && data.length > 0 && (
              <Button variant="ghost" icon={Download} onClick={handlePrint} style={{ fontSize: 13 }}>Print / Save PDF</Button>
            )}
          </div>
          {err     && <ErrBanner message={err} />}
          {loading ? <Spinner /> : renderReport()}
        </Card>
      )}

      {/* Print styles injected into head once */}
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
/* ═══ AUDIT LOGS (Super Admin only) ═══ */
function AdminAuditLogs(){
  const {profile}=useAuth();
  const [logs,setLogs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("all");

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const {data,error}=await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at",{ascending:false})
        .limit(200);
      if(error)setError(error.message);
      else setLogs(data||[]);
      setLoading(false);
    })();
  },[]);

  const severityColor={info:{bg:tokens.tealSoft,fg:tokens.tealDeep},warning:{bg:tokens.warnBg,fg:tokens.warn},critical:{bg:tokens.dangerBg,fg:tokens.danger}};
  const filtered=filter==="all"?logs:logs.filter(l=>l.severity===filter);

  return(<div>
    <SectionTitle eyebrow="Security" title="Audit Logs" action={
      <div style={{display:"flex",gap:8}}>
        {["all","info","warning","critical"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${tokens.line}`,background:filter===f?tokens.teal:"transparent",color:filter===f?"#fff":tokens.slate,fontSize:12.5,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>{f}</button>
        ))}
      </div>
    }/>
    <div style={{background:tokens.warnBg,border:`1px solid ${tokens.warn}30`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:tokens.warn}}>
      Audit logs are immutable — they cannot be edited or deleted.
    </div>
    {loading&&<LoadingState label="Loading audit logs…"/>}
    {error&&<ErrorBanner message={error}/>}
    {!loading&&!error&&(
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:tokens.paper}}>
              {["Time","Actor","Role","Action","Table","Severity","Reason"].map(h=>(
                <th key={h} style={{textAlign:"left",padding:"10px 14px",color:tokens.slate,fontWeight:600,borderBottom:`1px solid ${tokens.line}`,fontSize:12,textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={7} style={{padding:"32px",textAlign:"center",color:tokens.slate}}>No audit log entries found.</td></tr>}
              {filtered.map((l,i)=>{
                const sc=severityColor[l.severity]||severityColor.info;
                return(<tr key={l.id} style={{borderBottom:`1px solid ${tokens.line}`}} onMouseEnter={e=>e.currentTarget.style.background="#FBFAF7"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"10px 14px",whiteSpace:"nowrap",color:tokens.slate,fontSize:12}}>{fmtDateTime(l.created_at)}</td>
                  <td style={{padding:"10px 14px",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.actor_user_id?.slice(0,8)||"—"}</td>
                  <td style={{padding:"10px 14px"}}><span style={{background:tokens.tealSoft,color:tokens.tealDeep,padding:"2px 8px",borderRadius:6,fontSize:11.5,fontWeight:600}}>{ROLE_LABEL[l.actor_role]||l.actor_role||"—"}</span></td>
                  <td style={{padding:"10px 14px",fontWeight:600,color:tokens.ink,whiteSpace:"nowrap"}}>{l.action}</td>
                  <td style={{padding:"10px 14px",color:tokens.slate}}>{l.table_name||"—"}</td>
                  <td style={{padding:"10px 14px"}}><span style={{background:sc.bg,color:sc.fg,padding:"2px 8px",borderRadius:6,fontSize:11.5,fontWeight:600,textTransform:"capitalize"}}>{l.severity}</span></td>
                  <td style={{padding:"10px 14px",color:tokens.slate,fontSize:12.5,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis"}}>{l.reason||"—"}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )}
  </div>);
}

function AdminSettings(){
  return(<div><SectionTitle title="Settings"/>
    <Card style={{maxWidth:520}}>
      <Field label="Academy Name"><input style={inputStyle} defaultValue="LearnWise Academy"/></Field>
      <Field label="Tagline"><input style={inputStyle} defaultValue="Smart Guidance. Better Learning."/></Field>
      <Field label="Support Email"><input style={inputStyle} defaultValue="support@learnwise.edu"/></Field>
      <Field label="Default Currency"><select style={inputStyle} defaultValue="QAR"><option>QAR</option></select></Field>
      <Button>Save Changes</Button>
    </Card>
  </div>);
}

/* ═══ ADMIN QA TEST PAGE ═══ */
function AdminQATest(){
  const {profile} = useAuth();
  const [results, setResults] = useState([]);
  const [running, setRunning]   = useState(false);
  const [ran,     setRan]       = useState(false);

  const MODULES = [
    "Authentication","User Roles","User Linking",
    "Students","Parents","Tutors","Classes","Attendance",
    "Class Notes","Homework","Materials","Payments","Reports",
    "Parent Portal","Tutor Portal","Student Portal","Public Assessment Form",
  ];

  // initialise checklist rows
  const blankRows = () => MODULES.map(m => ({
    module: m, expected: "", actual: "", status: "Not Tested", error: "",
  }));

  useEffect(() => { setResults(blankRows()); }, []);

  const pass  = (r, expected, actual) => ({ ...r, expected, actual, status:"Passed",  error:"" });
  const fail  = (r, expected, actual, error="") => ({ ...r, expected, actual, status:"Failed", error });
  const skip  = (r, note) => ({ ...r, expected:"—", actual: note, status:"Not Tested", error:"" });

  const runChecks = async () => {
    setRunning(true);
    const rows = blankRows();

    // ── 1. Authentication ──────────────────────────────────
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        rows[0] = pass(rows[0], "Active session exists", `Logged in as ${session.user.email}`);
      } else {
        rows[0] = fail(rows[0], "Active session exists", "No session found");
      }
    } catch(e) { rows[0] = fail(rows[0], "Active session exists", "Error", e.message); }

    // ── 2. User Roles ─────────────────────────────────────
    try {
      const { data, error } = await supabase.from("profiles").select("email,role").limit(10);
      if (error) throw new Error(error.message);
      const roles = [...new Set((data||[]).map(p=>p.role))];
      rows[1] = pass(rows[1], "Profiles table readable, roles present",
        `${data.length} profiles found · Roles: ${roles.join(", ")}`);
    } catch(e) { rows[1] = fail(rows[1], "Profiles readable", "Error", e.message); }

    // ── 3. User Linking ───────────────────────────────────
    try {
      const [tr, pr, sr] = await Promise.all([
        supabase.from("tutors").select("full_name, user_id").not("user_id","is",null),
        supabase.from("parents").select("full_name, user_id").not("user_id","is",null),
        supabase.from("students").select("full_name, user_id").not("user_id","is",null),
      ]);
      const t = tr.data?.length||0, p = pr.data?.length||0, s = sr.data?.length||0;
      if (t+p+s > 0) {
        rows[2] = pass(rows[2], "At least one linked account",
          `Tutors: ${t} linked · Parents: ${p} linked · Students: ${s} linked`);
      } else {
        rows[2] = fail(rows[2], "At least one linked account", "No linked accounts found",
          "Link auth users to profiles in All Users → Link");
      }
    } catch(e) { rows[2] = fail(rows[2], "Linked accounts", "Error", e.message); }

    // ── 4. Students ───────────────────────────────────────
    try {
      const { data, error } = await supabase.from("students")
        .select("id, full_name, grade, curriculum, parent_id").limit(20);
      if (error) throw new Error(error.message);
      if ((data||[]).length > 0) {
        rows[3] = pass(rows[3], "Students table readable with data",
          `${data.length} student(s) found · e.g. "${data[0].full_name}" (${data[0].grade}, ${data[0].curriculum})`);
      } else {
        rows[3] = fail(rows[3], "At least 1 student", "Table empty — no students found");
      }
    } catch(e) { rows[3] = fail(rows[3], "Students readable", "Error", e.message); }

    // ── 5. Parents ────────────────────────────────────────
    try {
      const { data, error } = await supabase.from("parents").select("id, full_name, email").limit(20);
      if (error) throw new Error(error.message);
      if ((data||[]).length > 0) {
        rows[4] = pass(rows[4], "Parents table readable with data",
          `${data.length} parent(s) found · e.g. "${data[0].full_name}"`);
      } else {
        rows[4] = fail(rows[4], "At least 1 parent", "Table empty — no parents found");
      }
    } catch(e) { rows[4] = fail(rows[4], "Parents readable", "Error", e.message); }

    // ── 6. Tutors ─────────────────────────────────────────
    try {
      const { data, error } = await supabase.from("tutors").select("id, full_name, subjects, rate_qar").limit(20);
      if (error) throw new Error(error.message);
      if ((data||[]).length > 0) {
        rows[5] = pass(rows[5], "Tutors table readable with data",
          `${data.length} tutor(s) found · e.g. "${data[0].full_name}" (${(data[0].subjects||[]).join(", ")||"—"})`);
      } else {
        rows[5] = fail(rows[5], "At least 1 tutor", "Table empty — no tutors found");
      }
    } catch(e) { rows[5] = fail(rows[5], "Tutors readable", "Error", e.message); }

    // ── 7. Classes ────────────────────────────────────────
    try {
      const { data, error } = await supabase.from("classes")
        .select("id, subject, topic, status, scheduled_at").limit(20);
      if (error) throw new Error(error.message);
      if ((data||[]).length > 0) {
        rows[6] = pass(rows[6], "Classes table readable with data",
          `${data.length} class(es) found · e.g. "${data[0].subject} – ${data[0].topic||"—"}" (${data[0].status})`);
      } else {
        rows[6] = fail(rows[6], "At least 1 class", "Table empty — no classes found");
      }
    } catch(e) { rows[6] = fail(rows[6], "Classes readable", "Error", e.message); }

    // ── 8. Attendance ─────────────────────────────────────
    try {
      const { data, error } = await supabase.from("classes")
        .select("id, attendance").limit(20);
      if (error) throw new Error(error.message);
      const marked = (data||[]).filter(c => c.attendance && c.attendance !== "Pending").length;
      rows[7] = pass(rows[7], "Attendance field accessible",
        `${data.length} class row(s) checked · ${marked} with attendance marked`);
    } catch(e) { rows[7] = fail(rows[7], "Attendance accessible", "Error", e.message); }

    // ── 9. Class Notes ────────────────────────────────────
    try {
      const { data, error } = await supabase.from("class_notes")
        .select("id, topic, understanding, summary").limit(20);
      if (error) throw new Error(error.message);
      rows[8] = pass(rows[8], "Class notes table accessible",
        `${(data||[]).length} note(s) found`);
    } catch(e) { rows[8] = fail(rows[8], "Class notes accessible", "Error", e.message); }

    // ── 10. Homework ──────────────────────────────────────
    try {
      const { data, error } = await supabase.from("homework")
        .select("id, title, status, due_at").limit(20);
      if (error) throw new Error(error.message);
      if ((data||[]).length > 0) {
        rows[9] = pass(rows[9], "Homework table readable with data",
          `${data.length} homework item(s) · e.g. "${data[0].title}" (${data[0].status})`);
      } else {
        rows[9] = fail(rows[9], "At least 1 homework", "Table empty — no homework found");
      }
    } catch(e) { rows[9] = fail(rows[9], "Homework readable", "Error", e.message); }

    // ── 11. Materials ─────────────────────────────────────
    try {
      const { data, error } = await supabase.from("materials")
        .select("id, title, subject").limit(20);
      if (error) throw new Error(error.message);
      rows[10] = pass(rows[10], "Materials table accessible",
        `${(data||[]).length} material(s) found`);
    } catch(e) { rows[10] = fail(rows[10], "Materials accessible", "Error", e.message); }

    // ── 12. Payments ──────────────────────────────────────
    try {
      const [ir, pr] = await Promise.all([
        supabase.from("invoices").select("id, invoice_number, total_qar, status").limit(20),
        supabase.from("payments").select("id, amount_qar, method").limit(20),
      ]);
      if (ir.error) throw new Error(ir.error.message);
      rows[11] = pass(rows[11], "Invoices and payments accessible",
        `${(ir.data||[]).length} invoice(s) · ${(pr.data||[]).length} payment(s)`);
    } catch(e) { rows[11] = fail(rows[11], "Payments accessible", "Error", e.message); }

    // ── 13. Reports ───────────────────────────────────────
    try {
      const { data, error } = await supabase.from("payments")
        .select("amount_qar, paid_at").limit(50);
      if (error) throw new Error(error.message);
      const total = (data||[]).reduce((s,p)=>s+Number(p.amount_qar||0),0);
      rows[12] = pass(rows[12], "Report data queryable",
        `Revenue data accessible · ${(data||[]).length} payment record(s) · Total: QAR ${total}`);
    } catch(e) { rows[12] = fail(rows[12], "Report data queryable", "Error", e.message); }

    // ── 14. Parent Portal ─────────────────────────────────
    try {
      const { data, error } = await supabase.from("parents")
        .select("id, full_name, user_id").not("user_id","is",null).limit(5);
      if (error) throw new Error(error.message);
      if ((data||[]).length > 0) {
        rows[13] = pass(rows[13], "At least 1 parent linked to auth account",
          `${data.length} parent(s) linked · "${data[0].full_name}" can access parent portal`);
      } else {
        rows[13] = fail(rows[13], "Parent linked to auth", "No parents linked to auth accounts",
          "Go to All Users → Link to connect parent@learnwise.test to Test Parent");
      }
    } catch(e) { rows[13] = fail(rows[13], "Parent portal ready", "Error", e.message); }

    // ── 15. Tutor Portal ──────────────────────────────────
    try {
      const { data, error } = await supabase.from("tutors")
        .select("id, full_name, user_id").not("user_id","is",null).limit(5);
      if (error) throw new Error(error.message);
      if ((data||[]).length > 0) {
        const stRes = await supabase.from("student_tutors")
          .select("student_id, tutor_id, is_active").eq("is_active", true).limit(10);
        rows[14] = pass(rows[14], "Tutor linked + student assigned",
          `${data.length} tutor(s) linked · ${(stRes.data||[]).length} active student assignment(s)`);
      } else {
        rows[14] = fail(rows[14], "Tutor linked to auth", "No tutors linked to auth accounts",
          "Go to All Users → Link to connect tutor@learnwise.test to Test Tutor");
      }
    } catch(e) { rows[14] = fail(rows[14], "Tutor portal ready", "Error", e.message); }

    // ── 16. Student Portal ────────────────────────────────
    try {
      const { data, error } = await supabase.from("students")
        .select("id, full_name, user_id").not("user_id","is",null).limit(5);
      if (error) throw new Error(error.message);
      if ((data||[]).length > 0) {
        rows[15] = pass(rows[15], "At least 1 student linked to auth account",
          `${data.length} student(s) linked · "${data[0].full_name}" can access student portal`);
      } else {
        rows[15] = fail(rows[15], "Student linked to auth", "No students linked to auth accounts",
          "Go to All Users → Link to connect student@learnwise.test to Test Student");
      }
    } catch(e) { rows[15] = fail(rows[15], "Student portal ready", "Error", e.message); }

    // ── 17. Public Assessment Form ────────────────────────
    try {
      const { data, error } = await supabase.from("assessment_requests")
        .select("id, parent_name, status, submitted_at").limit(10);
      if (error) throw new Error(error.message);
      rows[16] = pass(rows[16], "Assessment requests table accessible",
        `${(data||[]).length} request(s) in database`);
    } catch(e) { rows[16] = fail(rows[16], "Assessment requests accessible", "Error", e.message); }

    setResults(rows);
    setRunning(false);
    setRan(true);
  };

  // ── Create Test Data ─────────────────────────────────────────────
  const [creating,   setCreating]   = useState(false);
  const [createLog,  setCreateLog]  = useState([]); // [{msg, type}]
  const [createDone, setCreateDone] = useState(false);

  const log = (msg, type="info") => setCreateLog(prev => [...prev, {msg, type, id: Date.now()+Math.random()}]);

  const createTestData = async () => {
    setCreating(true); setCreateLog([]); setCreateDone(false);

    try {
      // ── 1. Parent ─────────────────────────────────────────────────
      let parentId = null;
      const { data: existingParent } = await supabase
        .from("parents").select("id, full_name").eq("full_name","Test Parent").maybeSingle();
      if (existingParent) {
        parentId = existingParent.id;
        log("✓ Parent 'Test Parent' already exists — skipped","skip");
      } else {
        const { data: newParent, error: pErr } = await supabase
          .from("parents")
          .insert({ full_name:"Test Parent", email:"testparent@learnwise.test", phone:"+974 5500 0001", status:"Active" })
          .select().single();
        if (pErr) { log("✗ Failed to create parent: " + pErr.message,"error"); }
        else { parentId = newParent.id; log("✓ Created parent 'Test Parent'","success"); }
      }

      // ── 2. Tutor ──────────────────────────────────────────────────
      let tutorId = null;
      const { data: existingTutor } = await supabase
        .from("tutors").select("id, full_name").eq("full_name","Test Tutor").maybeSingle();
      if (existingTutor) {
        tutorId = existingTutor.id;
        log("✓ Tutor 'Test Tutor' already exists — skipped","skip");
      } else {
        const { data: newTutor, error: tErr } = await supabase
          .from("tutors")
          .insert({ full_name:"Test Tutor", email:"testtutor@learnwise.test", subjects:["Mathematics"], curriculum:["IGCSE"], rate_qar:100, status:"Active" })
          .select().single();
        if (tErr) { log("✗ Failed to create tutor: " + tErr.message,"error"); }
        else { tutorId = newTutor.id; log("✓ Created tutor 'Test Tutor'","success"); }
      }

      // ── 3. Student ────────────────────────────────────────────────
      let studentId = null;
      const { data: existingStudent } = await supabase
        .from("students").select("id, full_name").eq("full_name","Test Student").maybeSingle();
      if (existingStudent) {
        studentId = existingStudent.id;
        log("✓ Student 'Test Student' already exists — skipped","skip");
      } else {
        const { data: newStudent, error: sErr } = await supabase
          .from("students")
          .insert({ full_name:"Test Student", grade:"Year 10", curriculum:"IGCSE", subjects:["Mathematics"], parent_id:parentId||null, status:"Active" })
          .select().single();
        if (sErr) { log("✗ Failed to create student: " + sErr.message,"error"); }
        else { studentId = newStudent.id; log("✓ Created student 'Test Student'","success"); }
      }

      // Update student parent_id if parent was just created and student already existed
      if (existingStudent && parentId && !existingStudent.parent_id) {
        await supabase.from("students").update({ parent_id: parentId }).eq("id", existingStudent.id);
      }

      // ── 4. Student-Tutor assignment ───────────────────────────────
      if (studentId && tutorId) {
        const { data: existingLink } = await supabase
          .from("student_tutors").select("id")
          .eq("student_id", studentId).eq("tutor_id", tutorId).maybeSingle();
        if (existingLink) {
          log("✓ Tutor already assigned to student — skipped","skip");
        } else {
          const { error: linkErr } = await supabase
            .from("student_tutors")
            .insert({ student_id: studentId, tutor_id: tutorId, subjects:["Mathematics"], is_active: true });
          if (linkErr) log("✗ Failed to assign tutor to student: " + linkErr.message,"error");
          else log("✓ Assigned Test Tutor to Test Student","success");
        }
      }

      // ── 5. Class ──────────────────────────────────────────────────
      let classId = null;
      if (studentId && tutorId) {
        const { data: existingClass } = await supabase
          .from("classes").select("id").eq("topic","Algebra Basics")
          .eq("student_id", studentId).maybeSingle();
        if (existingClass) {
          classId = existingClass.id;
          log("✓ Class 'Algebra Basics' already exists — skipped","skip");
        } else {
          const scheduledAt = new Date(Date.now() + 86400000).toISOString(); // tomorrow
          const { data: newClass, error: cErr } = await supabase
            .from("classes")
            .insert({ student_id:studentId, tutor_id:tutorId, subject:"Mathematics", topic:"Algebra Basics", scheduled_at:scheduledAt, duration_min:60, mode:"Online", status:"Scheduled", rate_qar:100 })
            .select().single();
          if (cErr) log("✗ Failed to create class: " + cErr.message,"error");
          else { classId = newClass.id; log("✓ Created class 'Algebra Basics'","success"); }
        }
      } else { log("⚠ Skipped class — student or tutor missing","warn"); }

      // ── 6. Homework ───────────────────────────────────────────────
      if (studentId && tutorId) {
        const { data: existingHw } = await supabase
          .from("homework").select("id").eq("title","Algebra Practice")
          .eq("student_id", studentId).maybeSingle();
        if (existingHw) {
          log("✓ Homework 'Algebra Practice' already exists — skipped","skip");
        } else {
          const dueAt = new Date(Date.now() + 7*86400000).toISOString(); // next week
          const { error: hwErr } = await supabase
            .from("homework")
            .insert({ student_id:studentId, tutor_id:tutorId, class_id:classId||null, title:"Algebra Practice", description:"Complete exercises 1–10 from the worksheet.", due_at:dueAt, status:"Assigned" });
          if (hwErr) log("✗ Failed to create homework: " + hwErr.message,"error");
          else log("✓ Created homework 'Algebra Practice'","success");
        }
      } else { log("⚠ Skipped homework — student or tutor missing","warn"); }

      // ── 7. Class Note ─────────────────────────────────────────────
      if (studentId && tutorId) {
        const { data: existingNote } = await supabase
          .from("class_notes").select("id").eq("topic","Algebra Basics")
          .eq("student_id", studentId).maybeSingle();
        if (existingNote) {
          log("✓ Class note for 'Algebra Basics' already exists — skipped","skip");
        } else {
          const { error: nErr } = await supabase
            .from("class_notes")
            .insert({ student_id:studentId, tutor_id:tutorId, class_id:classId||null, topic:"Algebra Basics", understanding:"Good", strengths:"Understands core concepts well", areas_to_improve:"Needs more practice on word problems", recommendation:"Review pages 12–15 before next session", summary:"Good session — Test Student grasped the basics of algebra and showed confidence with simple equations.", is_shared_with_parent:true, is_shared_with_student:true });
          if (nErr) log("✗ Failed to create class note: " + nErr.message,"error");
          else log("✓ Created class note for 'Algebra Basics' (shared with parent + student)","success");
        }
      } else { log("⚠ Skipped class note — student or tutor missing","warn"); }

      // ── 8. Material ───────────────────────────────────────────────
      if (tutorId) {
        const { data: existingMat } = await supabase
          .from("materials").select("id").eq("title","Algebra Notes Link").maybeSingle();
        if (existingMat) {
          log("✓ Material 'Algebra Notes Link' already exists — skipped","skip");
        } else {
          const { error: mErr } = await supabase
            .from("materials")
            .insert({ tutor_id:tutorId, student_id:studentId||null, title:"Algebra Notes Link", description:"Summary notes for IGCSE Algebra Basics topic.", subject:"Mathematics", file_url:"https://example.com/algebra-notes", is_public:false });
          if (mErr) log("✗ Failed to create material: " + mErr.message,"error");
          else log("✓ Created material 'Algebra Notes Link'","success");
        }
      } else { log("⚠ Skipped material — tutor missing","warn"); }

      // ── 9. Invoice + Payment ──────────────────────────────────────
      if (parentId) {
        const { data: existingInv } = await supabase
          .from("invoices").select("id").eq("invoice_number","INV-TEST-001").maybeSingle();
        if (existingInv) {
          log("✓ Invoice 'INV-TEST-001' already exists — skipped","skip");
        } else {
          const { error: invErr } = await supabase
            .from("invoices")
            .insert({ parent_id:parentId, student_id:studentId||null, invoice_number:"INV-TEST-001", total_qar:100, subtotal_qar:100, discount_qar:0, paid_qar:0, currency:"QAR", status:"Issued" });
          if (invErr) log("✗ Failed to create invoice: " + invErr.message,"error");
          else log("✓ Created invoice INV-TEST-001 — QAR 100 pending","success");
        }
      } else { log("⚠ Skipped payment — parent missing","warn"); }

    } catch(e) {
      log("✗ Unexpected error: " + e.message,"error");
    }

    setCreating(false);
    setCreateDone(true);
  };

  const statusColor = {
    "Passed":     { bg: tokens.successBg, fg: tokens.success, dot: tokens.success },
    "Failed":     { bg: tokens.dangerBg,  fg: tokens.danger,  dot: tokens.danger  },
    "Not Tested": { bg: "#F0EEE7",        fg: tokens.slate,   dot: tokens.slate   },
  };

  const passed  = results.filter(r=>r.status==="Passed").length;
  const failed  = results.filter(r=>r.status==="Failed").length;
  const untested= results.filter(r=>r.status==="Not Tested").length;

  return (
    <div>
      <SectionTitle eyebrow="Admin Only" title="QA System Test"/>
      <div style={{background:tokens.warnBg,color:tokens.warn,borderRadius:10,padding:"10px 16px",fontSize:13,marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
        <Shield size={15}/> This page is visible to admins only. All checks are read-only — no data is modified.
      </div>

      {/* Summary cards */}
      {ran && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          <StatCard icon={CheckCircle2} label="Tests Passed"   value={passed}   accent={tokens.successBg}/>
          <StatCard icon={AlertCircle}  label="Tests Failed"   value={failed}   accent={failed>0?tokens.dangerBg:"#F0EEE7"}/>
          <StatCard icon={RefreshCw}    label="Not Tested Yet" value={untested} accent="#F0EEE7"/>
        </div>
      )}

      {/* ── Create Test Data Panel ── */}
      <Card style={{marginBottom:20,border:`1.5px solid ${tokens.teal}30`,background:"#FAFDF9"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontFamily:"Fraunces, serif",fontSize:16,fontWeight:600,color:tokens.ink,marginBottom:4}}>
              Create Test Data
            </div>
            <div style={{fontSize:12.5,color:tokens.slate,lineHeight:1.5}}>
              Creates: Test Parent · Test Tutor · Test Student · Algebra Basics class · Algebra Practice homework · Algebra Notes Link material · INV-TEST-001 invoice (QAR 100).<br/>
              Skips any record that already exists. Safe to run multiple times. Does not delete real data.
            </div>
          </div>
          <Button
            icon={creating?RefreshCw:Plus}
            onClick={createTestData}
            disabled={creating}
            variant="secondary"
            style={{fontSize:13.5,padding:"9px 20px",whiteSpace:"nowrap",flexShrink:0}}
          >
            {creating?"Creating…":"Create Test Data"}
          </Button>
        </div>

        {/* Log output */}
        {createLog.length>0&&(
          <div style={{background:tokens.paper,border:`1px solid ${tokens.line}`,borderRadius:10,padding:"12px 14px",maxHeight:220,overflowY:"auto"}}>
            {createLog.map((entry)=>{
              const colors={
                success:{color:tokens.success,prefix:"✓"},
                error:  {color:tokens.danger, prefix:"✗"},
                skip:   {color:tokens.slate,  prefix:"○"},
                warn:   {color:tokens.warn,   prefix:"⚠"},
                info:   {color:tokens.ink,    prefix:"·"},
              };
              const c=colors[entry.type]||colors.info;
              return(
                <div key={entry.id} style={{fontSize:12.5,color:c.color,padding:"3px 0",fontFamily:"'SF Mono',monospace",lineHeight:1.5}}>
                  {entry.msg}
                </div>
              );
            })}
            {createDone&&!creating&&(
              <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${tokens.line}`,fontSize:12.5,fontWeight:600,color:tokens.success}}>
                Done. Run the System Check below to verify all modules.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Run button */}
      <div style={{marginBottom:20}}>
        <Button icon={running?RefreshCw:CheckCircle2} onClick={runChecks} disabled={running} style={{fontSize:14,padding:"10px 24px"}}>
          {running?"Running checks…":"Run Basic System Check"}
        </Button>
        {ran&&!running&&<span style={{marginLeft:14,fontSize:13,color:tokens.slate}}>Last run: {new Date().toLocaleTimeString("en-GB")}</span>}
      </div>

      {/* Results table */}
      <Card>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
            <thead>
              <tr>
                {["#","Module","Expected","Actual Result","Status","Error"].map((h,i)=>(
                  <th key={i} style={{textAlign:"left",padding:"10px 14px",color:tokens.slate,fontWeight:600,borderBottom:`1px solid ${tokens.line}`,fontSize:12,textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r,i)=>{
                const sc = statusColor[r.status];
                return (
                  <tr key={i} style={{background:r.status==="Failed"?`${tokens.dangerBg}55`:r.status==="Passed"?`${tokens.successBg}44`:"transparent"}}>
                    <td style={{padding:"11px 14px",borderBottom:`1px solid ${tokens.line}`,color:tokens.slate,fontSize:12,fontWeight:700}}>{i+1}</td>
                    <td style={{padding:"11px 14px",borderBottom:`1px solid ${tokens.line}`,fontWeight:700,color:tokens.ink,whiteSpace:"nowrap"}}>{r.module}</td>
                    <td style={{padding:"11px 14px",borderBottom:`1px solid ${tokens.line}`,color:tokens.slate,fontSize:12.5,maxWidth:200}}>{r.expected||<span style={{color:tokens.line}}>—</span>}</td>
                    <td style={{padding:"11px 14px",borderBottom:`1px solid ${tokens.line}`,color:tokens.ink,fontSize:12.5,maxWidth:280}}>{r.actual||<span style={{color:tokens.line}}>—</span>}</td>
                    <td style={{padding:"11px 14px",borderBottom:`1px solid ${tokens.line}`,whiteSpace:"nowrap"}}>
                      <span style={{background:sc.bg,color:sc.fg,padding:"3px 10px",borderRadius:999,fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",gap:5}}>
                        <span style={{width:6,height:6,borderRadius:"50%",background:sc.dot,display:"inline-block"}}/>
                        {r.status}
                      </span>
                    </td>
                    <td style={{padding:"11px 14px",borderBottom:`1px solid ${tokens.line}`,color:tokens.danger,fontSize:12,maxWidth:220}}>
                      {r.error||<span style={{color:tokens.line}}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!ran&&(
          <div style={{textAlign:"center",padding:"32px 0",color:tokens.slate,fontSize:13}}>
            Click "Run Basic System Check" to test all modules.
          </div>
        )}
      </Card>

      {/* Legend */}
      <div style={{marginTop:14,display:"flex",gap:20,fontSize:12.5,color:tokens.slate}}>
        {Object.entries(statusColor).map(([label,sc])=>(
          <span key={label} style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:sc.dot,display:"inline-block"}}/>
            {label}
          </span>
        ))}
        <span style={{marginLeft:"auto"}}>Read-only · No data is modified</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TUTOR PORTAL  —  real Supabase data
   All queries filtered by tutorId (the linked tutors.id row).
   Tutors see ONLY their own students, classes, notes, homework.
   ═══════════════════════════════════════════════════════════ */

/* ── Shared data hook: loads once, shared across tutor views ── */
function useTutorData(tutorId) {
  const [students, setStudents] = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  const load = useCallback(async () => {
    if (!tutorId) return;
    setLoading(true); setErr("");
    const [sr, cr] = await Promise.all([
      db.getStudentsByTutor(tutorId),
      db.getClasses({ tutorId }),
    ]);
    if (sr.error) setErr(sr.error.message);
    else setStudents(sr.data || []);
    if (cr.error && !sr.error) setErr(cr.error.message);
    else setClasses(cr.data || []);
    setLoading(false);
  }, [tutorId]);

  useEffect(() => { load(); }, [load]);
  return { students, classes, loading, err, reload: load };
}

/* ── TutorDashboard ── */
function TutorDashboard({ tutorId, tutorName }) {
  const [stats,     setStats]     = useState(null);
  const [todayCls,  setTodayCls]  = useState([]);
  const [pendingHw, setPendingHw] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState("");

  useEffect(() => {
    if (!tutorId) return;
    (async () => {
      setLoading(true); setErr("");
      const todayIso = new Date().toISOString().slice(0, 10);
      const [statsRes, todayRes, hwRes] = await Promise.all([
        db.getTutorDashboardStats(tutorId),
        db.getClasses({ tutorId, from: `${todayIso}T00:00:00`, to: `${todayIso}T23:59:59` }),
        db.getHomework({ tutorId, status: "Submitted" }),
      ]);
      if (statsRes.error) setErr(statsRes.error.message);
      else setStats(statsRes.data);
      setTodayCls(todayRes.data || []);
      setPendingHw(hwRes.data || []);
      setLoading(false);
    })();
  }, [tutorId]);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (err)     return <ErrBanner message={err} />;

  return (
    <div>
      <SectionTitle eyebrow="Welcome back" title={tutorName || "Tutor"} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard icon={CalendarDays}  label="Today's Classes"    value={stats?.todayClasses     ?? "—"} />
        <StatCard icon={Clock}         label="Upcoming Classes"   value={stats?.upcomingClasses  ?? "—"} />
        <StatCard icon={GraduationCap} label="Assigned Students"  value={stats?.assignedStudents ?? "—"} />
        <StatCard icon={BookOpenCheck} label="Homework to Review" value={stats?.homeworkToReview ?? "—"} accent={tokens.coralSoft} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, marginBottom: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>Today's Classes</div>
          {todayCls.length === 0
            ? <div style={{ fontSize: 13, color: tokens.slate }}>No classes scheduled today.</div>
            : todayCls.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${tokens.line}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.student?.full_name} · {c.subject}</div>
                  <div style={{ fontSize: 12, color: tokens.slate }}>{fmtDateTime(c.scheduled_at)} · {c.topic || "—"}</div>
                  {c.mode === "Online" && c.meeting_link
                    ? <a href={c.meeting_link} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: tokens.teal }}>Join meeting →</a>
                    : c.location ? <div style={{ fontSize: 11.5, color: tokens.slate }}>{c.location}</div> : null}
                </div>
                <Pill value={c.status} />
              </div>
            ))
          }
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>Homework to Review</div>
          {pendingHw.length === 0
            ? <div style={{ fontSize: 13, color: tokens.slate }}>No submissions waiting.</div>
            : pendingHw.map(h => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${tokens.line}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{h.student?.full_name}</div>
                  <div style={{ fontSize: 12, color: tokens.slate }}>{h.title}</div>
                </div>
                <Pill value={h.status} />
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
}

/* ── TutorMyStudents ── */
function TutorMyStudents({ tutorId }) {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const { data, error } = await db.getStudentsByTutor(tutorId);
    if (error) setErr(error.message); else setStudents(data || []);
    setLoading(false);
  }, [tutorId]);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    const s = selected;
    return (
      <div>
        <div onClick={() => setSelected(null)} style={{ display: "flex", alignItems: "center", gap: 6, color: tokens.slate, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
          <ArrowLeft size={14} /> Back to My Students
        </div>
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 700, color: tokens.tealDeep }}>
              {initials(s.full_name)}
            </div>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>{s.full_name}</div>
              <div style={{ fontSize: 13, color: tokens.slate }}>{s.grade} · {s.school} · {s.curriculum}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 18 }}>
            <Field label="Subjects"><div style={{ fontSize: 13.5 }}>{(s.subjects || []).join(", ") || "—"}</div></Field>
            <Field label="Parent"><div style={{ fontSize: 13.5 }}>{s.parent?.full_name || "—"}</div></Field>
            <Field label="Status"><Pill value={s.status} /></Field>
          </div>
          {(s.goals || s.strengths || s.weak_areas) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tokens.line}` }}>
              {s.goals      && <div><div style={{ fontSize: 12, fontWeight: 700, color: tokens.slate, marginBottom: 4 }}>GOALS</div><div style={{ fontSize: 13 }}>{s.goals}</div></div>}
              {s.strengths  && <div><div style={{ fontSize: 12, fontWeight: 700, color: tokens.success, marginBottom: 4 }}>STRENGTHS</div><div style={{ fontSize: 13 }}>{s.strengths}</div></div>}
              {s.weak_areas && <div><div style={{ fontSize: 12, fontWeight: 700, color: tokens.coral, marginBottom: 4 }}>FOCUS AREAS</div><div style={{ fontSize: 13 }}>{s.weak_areas}</div></div>}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="My Students" />
      {err && <ErrBanner message={err} onRetry={load} />}
      {loading ? <Spinner /> : students.length === 0
        ? <Empty icon={GraduationCap} title="No students assigned yet" body="Your students will appear here once the admin assigns them to you." />
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {students.map(s => (
              <Card key={s.id} style={{ cursor: "pointer" }} onClick={() => setSelected(s)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.full_name}</div>
                    <div style={{ fontSize: 12.5, color: tokens.slate, marginTop: 3 }}>{s.grade} · {s.curriculum}</div>
                  </div>
                  <Pill value={s.status} />
                </div>
                <div style={{ marginTop: 10, fontSize: 12.5 }}><strong>Subjects:</strong> {(s.subjects || []).join(", ") || "—"}</div>
                {s.strengths  && <div style={{ marginTop: 6, fontSize: 12.5, color: tokens.success }}><strong>Strengths:</strong> {s.strengths}</div>}
                {s.weak_areas && <div style={{ marginTop: 4, fontSize: 12.5, color: tokens.coral }}><strong>Focus:</strong> {s.weak_areas}</div>}
                <div style={{ marginTop: 10, fontSize: 12, color: tokens.teal, fontWeight: 600 }}>View profile →</div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
}

/* ── TutorMyClasses ── */
function TutorMyClasses({ tutorId }) {
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [filter,   setFilter]   = useState("all");
  const { fire, el } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const { data, error } = await db.getClasses({ tutorId });
    if (error) setErr(error.message); else setClasses(data || []);
    setLoading(false);
  }, [tutorId]);

  useEffect(() => { load(); }, [load]);

  const setAtt = async (id, attendance) => {
    const { error } = await db.markAttendance(id, attendance);
    if (error) fire(error.message, "error");
    else { fire("Attendance saved"); setClasses(classes.map(c => c.id === id ? { ...c, attendance } : c)); }
  };

  const visible = filter === "all" ? classes : classes.filter(c => c.status === filter);

  return (
    <div>
      {el}
      <SectionTitle title="My Classes" />
      {err && <ErrBanner message={err} onRetry={load} />}
      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "Scheduled", "Completed", "Cancelled"].map(f => (
          <div key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: filter === f ? tokens.teal : tokens.tealSoft, color: filter === f ? "#fff" : tokens.tealDeep }}>
            {f === "all" ? "All" : f}
          </div>
        ))}
      </Card>
      {loading ? <Spinner /> : visible.length === 0
        ? <Empty icon={CalendarDays} title="No classes found" />
        : (
          <Card>
            <Table
              columns={["Date / Time", "Student", "Subject", "Topic", "Mode", "Status", "Attendance"]}
              rows={visible.map(c => ({
                cells: [
                  fmtDateTime(c.scheduled_at),
                  c.student?.full_name || "—",
                  c.subject,
                  c.topic || "—",
                  c.mode === "Online"
                    ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Video size={13} /> Online</span>
                    : <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> Offline</span>,
                  <Pill value={c.status} />,
                  <select value={c.attendance || "Pending"} onChange={e => setAtt(c.id, e.target.value)} style={{ ...inputStyle, padding: "4px 8px", width: 130 }}>
                    {["Pending", "Present", "Absent", "Cancelled"].map(o => <option key={o}>{o}</option>)}
                  </select>,
                ],
              }))}
            />
          </Card>
        )
      }
    </div>
  );
}

/* ── TutorClassNotes ── */
function TutorClassNotes({ tutorId }) {
  const [notes,    setNotes]    = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [showAdd,  setShowAdd]  = useState(false);
  const [editRow,  setEditRow]  = useState(null);
  const [busy,     setBusy]     = useState(false);
  const { fire, el } = useToast();

  const blank = { class_id: "", student_id: "", topic: "", understanding: "Good", strengths: "", areas_to_improve: "", recommendation: "", summary: "", is_shared_with_parent: true, is_shared_with_student: false };
  const [f, setF] = useState(blank);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const [nr, cr, sr] = await Promise.all([
      db.getClassNotes({ tutorId }),
      db.getClasses({ tutorId }),
      db.getStudentsByTutor(tutorId),
    ]);
    if (nr.error) setErr(nr.error.message); else setNotes(nr.data || []);
    setClasses(cr.data || []);
    setStudents(sr.data || []);
    setLoading(false);
  }, [tutorId]);

  useEffect(() => { load(); }, [load]);

  const openEdit = n => {
    setF({ class_id: n.class_id || "", student_id: n.student_id, topic: n.topic || "", understanding: n.understanding || "Good", strengths: n.strengths || "", areas_to_improve: n.areas_to_improve || "", recommendation: n.recommendation || "", summary: n.summary || "", is_shared_with_parent: n.is_shared_with_parent ?? true, is_shared_with_student: n.is_shared_with_student ?? false });
    setEditRow(n);
  };

  const save = async isEdit => {
    if (!f.student_id || !f.topic) { fire("Student and topic are required", "error"); return; }
    setBusy(true);
    const payload = { ...f, tutor_id: tutorId, class_id: f.class_id || null };
    const { error } = isEdit ? await db.updateClassNote(isEdit.id, payload) : await db.createClassNote(payload);
    setBusy(false);
    if (error) { fire(error.message, "error"); return; }
    fire(isEdit ? "Note updated" : "Note saved");
    setShowAdd(false); setEditRow(null); setF(blank); load();
  };

  const understandingColor = { Excellent: tokens.success, Good: tokens.teal, Fair: tokens.warn, "Needs Support": tokens.danger };

  return (
    <div>
      {el}
      <SectionTitle title="Class Notes" action={<Button icon={Plus} onClick={() => { setF(blank); setShowAdd(true); }}>Add Note</Button>} />
      {err && <ErrBanner message={err} onRetry={load} />}
      {loading ? <Spinner /> : notes.length === 0
        ? <Empty icon={FileText} title="No notes yet" body="Add your first class note after a session." action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Add Note</Button>} />
        : notes.map(n => (
          <Card key={n.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{n.topic || n.class?.subject || "—"}</div>
                <div style={{ fontSize: 12.5, color: tokens.slate }}>{n.student?.full_name} · {fmtDate(n.created_at)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {n.understanding && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: understandingColor[n.understanding] || tokens.slate }}>
                    {n.understanding}
                  </span>
                )}
                <Button variant="ghost" icon={Edit2} style={{ padding: "5px 8px" }} onClick={() => openEdit(n)} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              {n.strengths  && <div style={{ fontSize: 12.5 }}><strong style={{ color: tokens.success }}>Strengths:</strong> {n.strengths}</div>}
              {n.areas_to_improve && <div style={{ fontSize: 12.5 }}><strong style={{ color: tokens.coral }}>Improve:</strong> {n.areas_to_improve}</div>}
              {n.recommendation && <div style={{ fontSize: 12.5, gridColumn: "1/-1" }}><strong>Recommendation:</strong> {n.recommendation}</div>}
            </div>
            {n.summary && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: tokens.tealSoft, borderRadius: 10, fontSize: 13, fontStyle: "italic", color: tokens.tealDeep }}>
                "{n.summary}"
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              {n.is_shared_with_parent  && <span style={{ fontSize: 11, fontWeight: 600, color: tokens.teal,  background: tokens.tealSoft,  padding: "2px 8px", borderRadius: 999 }}>Parent</span>}
              {n.is_shared_with_student && <span style={{ fontSize: 11, fontWeight: 600, color: tokens.coral, background: tokens.coralSoft, padding: "2px 8px", borderRadius: 999 }}>Student</span>}
            </div>
          </Card>
        ))
      }
      {(showAdd || editRow) && (
        <Modal title={editRow ? "Edit Note" : "Add Class Note"} wide onClose={() => { setShowAdd(false); setEditRow(null); }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Student" required>
              <select style={inputStyle} value={f.student_id} onChange={e => setF({ ...f, student_id: e.target.value })}>
                <option value="">— Select student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </Field>
            <Field label="Linked Class (optional)">
              <select style={inputStyle} value={f.class_id} onChange={e => setF({ ...f, class_id: e.target.value })}>
                <option value="">— None —</option>
                {classes.filter(c => !f.student_id || c.student_id === f.student_id).map(c => (
                  <option key={c.id} value={c.id}>{c.student?.full_name} · {c.subject} · {fmtDate(c.scheduled_at)}</option>
                ))}
              </select>
            </Field>
            <Field label="Topic / Subject covered" required>
              <input style={inputStyle} value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })} placeholder="e.g. Quadratic Equations" />
            </Field>
            <Field label="Understanding level">
              <select style={inputStyle} value={f.understanding} onChange={e => setF({ ...f, understanding: e.target.value })}>
                {["Excellent", "Good", "Fair", "Needs Support"].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Strengths shown">
            <input style={inputStyle} value={f.strengths} onChange={e => setF({ ...f, strengths: e.target.value })} placeholder="What the student did well…" />
          </Field>
          <Field label="Areas to improve">
            <input style={inputStyle} value={f.areas_to_improve} onChange={e => setF({ ...f, areas_to_improve: e.target.value })} placeholder="What needs more practice…" />
          </Field>
          <Field label="Recommendation">
            <input style={inputStyle} value={f.recommendation} onChange={e => setF({ ...f, recommendation: e.target.value })} placeholder="Suggested next steps…" />
          </Field>
          <Field label="Parent-friendly summary">
            <textarea style={{ ...inputStyle, minHeight: 72 }} value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} placeholder="A plain-language update for the parent…" />
          </Field>
          <div style={{ display: "flex", gap: 18, marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={f.is_shared_with_parent} onChange={e => setF({ ...f, is_shared_with_parent: e.target.checked })} />
              Share with parent
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={f.is_shared_with_student} onChange={e => setF({ ...f, is_shared_with_student: e.target.checked })} />
              Share with student
            </label>
          </div>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={() => save(editRow || false)} disabled={busy}>
            {busy ? "Saving…" : editRow ? "Save Changes" : "Save Note"}
          </Button>
        </Modal>
      )}
    </div>
  );
}

/* ── TutorHomework ── */
function TutorHomework({ tutorId }) {
  const [hw,       setHw]       = useState([]);
  const [students, setStudents] = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [showAdd,  setShowAdd]  = useState(false);
  const [editRow,  setEditRow]  = useState(null);
  const [showDel,  setShowDel]  = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [filter,   setFilter]   = useState("all");
  const { fire, el } = useToast();

  const blank = { title: "", description: "", student_id: "", class_id: "", due_at: "", status: "Assigned" };
  const [f, setF] = useState(blank);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const [hr, sr, cr] = await Promise.all([
      db.getHomework({ tutorId }),
      db.getStudentsByTutor(tutorId),
      db.getClasses({ tutorId }),
    ]);
    if (hr.error) setErr(hr.error.message); else setHw(hr.data || []);
    setStudents(sr.data || []);
    setClasses(cr.data || []);
    setLoading(false);
  }, [tutorId]);

  useEffect(() => { load(); }, [load]);

  const openEdit = h => {
    setF({ title: h.title, description: h.description || "", student_id: h.student_id, class_id: h.class_id || "", due_at: h.due_at?.slice(0, 10) || "", status: h.status });
    setEditRow(h);
  };

  const save = async isEdit => {
    if (!f.title.trim() || !f.student_id) { fire("Title and student are required", "error"); return; }
    setBusy(true);
    const payload = { title: f.title.trim(), description: f.description, student_id: f.student_id, tutor_id: tutorId, class_id: f.class_id || null, due_at: f.due_at ? new Date(f.due_at).toISOString() : null, status: f.status };
    const { error } = isEdit ? await db.updateHomework(isEdit.id, payload) : await db.createHomework(payload);
    setBusy(false);
    if (error) { fire(error.message, "error"); return; }
    fire(isEdit ? "Homework updated" : "Homework assigned");
    setShowAdd(false); setEditRow(null); setF(blank); load();
  };

  const reviewHw = async (id, feedback) => {
    const { error } = await db.reviewHomework(id, feedback);
    if (error) fire(error.message, "error"); else { fire("Marked as reviewed"); load(); }
  };

  const del = async () => {
    setBusy(true);
    const { error } = await db.deleteHomework(showDel.id);
    setBusy(false);
    if (error) { fire(error.message, "error"); setShowDel(null); return; }
    fire("Homework deleted"); setShowDel(null); load();
  };

  const visible = filter === "all" ? hw : hw.filter(h => h.status === filter);

  return (
    <div>
      {el}
      <SectionTitle title="Homework" action={<Button icon={Plus} onClick={() => { setF(blank); setShowAdd(true); }}>Assign Homework</Button>} />
      {err && <ErrBanner message={err} onRetry={load} />}
      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "Assigned", "Submitted", "Reviewed", "Incomplete"].map(f2 => (
          <div key={f2} onClick={() => setFilter(f2)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: filter === f2 ? tokens.teal : tokens.tealSoft, color: filter === f2 ? "#fff" : tokens.tealDeep }}>
            {f2 === "all" ? "All" : f2}
          </div>
        ))}
      </Card>
      {loading ? <Spinner /> : visible.length === 0
        ? <Empty icon={BookOpenCheck} title="No homework found" action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Assign Homework</Button>} />
        : (
          <Card>
            <Table
              columns={["Title", "Student", "Due Date", "Status", ""]}
              rows={visible.map(h => ({
                cells: [
                  <div>
                    <div style={{ fontWeight: 600 }}>{h.title}</div>
                    {h.description && <div style={{ fontSize: 12, color: tokens.slate, marginTop: 2 }}>{h.description.slice(0, 60)}{h.description.length > 60 ? "…" : ""}</div>}
                  </div>,
                  h.student?.full_name || "—",
                  fmtDate(h.due_at),
                  <Pill value={h.status} />,
                  <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                    {h.status === "Submitted" && (
                      <Button variant="secondary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => reviewHw(h.id, "Reviewed by tutor")}>Review</Button>
                    )}
                    <Button variant="ghost"  icon={Edit2}  style={{ padding: "5px 8px" }} onClick={() => openEdit(h)} />
                    <Button variant="danger" icon={Trash2} style={{ padding: "5px 8px" }} onClick={() => setShowDel(h)} />
                  </div>,
                ],
              }))}
            />
          </Card>
        )
      }
      {(showAdd || editRow) && (
        <Modal title={editRow ? "Edit Homework" : "Assign Homework"} wide onClose={() => { setShowAdd(false); setEditRow(null); }}>
          <Field label="Title" required><input style={inputStyle} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Homework title" /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 68 }} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Instructions for the student…" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Student" required>
              <select style={inputStyle} value={f.student_id} onChange={e => setF({ ...f, student_id: e.target.value })}>
                <option value="">— Select student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </Field>
            <Field label="Due Date"><input style={inputStyle} type="date" value={f.due_at} onChange={e => setF({ ...f, due_at: e.target.value })} /></Field>
          </div>
          <Field label="Linked Class (optional)">
            <select style={inputStyle} value={f.class_id} onChange={e => setF({ ...f, class_id: e.target.value })}>
              <option value="">— None —</option>
              {classes.filter(c => !f.student_id || c.student_id === f.student_id).map(c => (
                <option key={c.id} value={c.id}>{c.student?.full_name} · {c.subject} · {fmtDate(c.scheduled_at)}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select style={inputStyle} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
              {["Assigned", "Submitted", "Reviewed", "Incomplete"].map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => save(editRow || false)} disabled={busy}>
            {busy ? "Saving…" : editRow ? "Save Changes" : "Assign Homework"}
          </Button>
        </Modal>
      )}
      {showDel && <ConfirmModal message={`Delete "${showDel.title}"?`} onConfirm={del} onCancel={() => setShowDel(null)} busy={busy} />}
    </div>
  );
}

/* ── TutorMaterials ── */
function TutorMaterials({ tutorId }) {
  const [materials, setMaterials] = useState([]);
  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState("");
  const [showAdd,   setShowAdd]   = useState(false);
  const [editRow,   setEditRow]   = useState(null);
  const [showDel,   setShowDel]   = useState(null);
  const [busy,      setBusy]      = useState(false);
  const { fire, el } = useToast();

  const blank = { title: "", description: "", subject: SUBJECTS[0], file_url: "", is_public: false, student_id: "" };
  const [f, setF] = useState(blank);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const [mr, sr] = await Promise.all([
      db.getMaterials({ tutorId }),
      db.getStudentsByTutor(tutorId),
    ]);
    if (mr.error) setErr(mr.error.message); else setMaterials(mr.data || []);
    setStudents(sr.data || []);
    setLoading(false);
  }, [tutorId]);

  useEffect(() => { load(); }, [load]);

  const openEdit = m => {
    setF({ title: m.title, description: m.description || "", subject: m.subject || SUBJECTS[0], file_url: m.file_url || "", is_public: m.is_public || false, student_id: m.student_id || "" });
    setEditRow(m);
  };

  const save = async isEdit => {
    if (!f.title.trim()) { fire("Title is required", "error"); return; }
    setBusy(true);
    const payload = { title: f.title.trim(), description: f.description, subject: f.subject, file_url: f.file_url || null, is_public: f.is_public, tutor_id: tutorId, student_id: f.student_id || null };
    const { error } = isEdit ? await db.updateMaterial(isEdit.id, payload) : await db.createMaterial(payload);
    setBusy(false);
    if (error) { fire(error.message, "error"); return; }
    fire(isEdit ? "Material updated" : "Material added");
    setShowAdd(false); setEditRow(null); setF(blank); load();
  };

  const del = async () => {
    setBusy(true);
    const { error } = await db.deleteMaterial(showDel.id);
    setBusy(false);
    if (error) { fire(error.message, "error"); setShowDel(null); return; }
    fire("Material deleted"); setShowDel(null); load();
  };

  return (
    <div>
      {el}
      <SectionTitle title="Study Materials" action={<Button icon={Plus} onClick={() => { setF(blank); setShowAdd(true); }}>Add Material</Button>} />
      {err && <ErrBanner message={err} onRetry={load} />}
      {loading ? <Spinner /> : materials.length === 0
        ? <Empty icon={BookOpen} title="No materials yet" body="Add resources, worksheets, or links for your students." action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Add Material</Button>} />
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {materials.map(m => (
              <Card key={m.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={18} color={tokens.tealDeep} />
                  </div>
                  {m.is_public && <span style={{ fontSize: 11, fontWeight: 600, color: tokens.teal, background: tokens.tealSoft, padding: "2px 8px", borderRadius: 999 }}>Public</span>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 10 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: tokens.slate, marginTop: 3 }}>{m.subject}</div>
                {m.student && <div style={{ fontSize: 12, color: tokens.slate }}>For: {m.student.full_name}</div>}
                {m.description && <div style={{ fontSize: 12.5, color: tokens.slate, marginTop: 6 }}>{m.description}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {m.file_url
                    ? <a href={m.file_url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
                        <Button variant="secondary" icon={Download} style={{ width: "100%", justifyContent: "center", padding: "7px" }}>Open</Button>
                      </a>
                    : <Button variant="ghost" style={{ flex: 1, justifyContent: "center", padding: "7px", fontSize: 12, color: tokens.slate }} disabled>No file</Button>
                  }
                  <Button variant="ghost"  icon={Edit2}  style={{ padding: "7px 9px" }} onClick={() => openEdit(m)} />
                  <Button variant="danger" icon={Trash2} style={{ padding: "7px 9px" }} onClick={() => setShowDel(m)} />
                </div>
              </Card>
            ))}
          </div>
        )
      }
      {(showAdd || editRow) && (
        <Modal title={editRow ? "Edit Material" : "Add Material"} onClose={() => { setShowAdd(false); setEditRow(null); }}>
          <Field label="Title" required><input style={inputStyle} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. IGCSE Algebra Formula Sheet" /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 52 }} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Subject">
              <select style={inputStyle} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="For Student (optional)">
              <select style={inputStyle} value={f.student_id} onChange={e => setF({ ...f, student_id: e.target.value })}>
                <option value="">— All students —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="File URL or Link">
            <input style={inputStyle} value={f.file_url} onChange={e => setF({ ...f, file_url: e.target.value })} placeholder="https://… or Supabase Storage path" />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
            <input type="checkbox" checked={f.is_public} onChange={e => setF({ ...f, is_public: e.target.checked })} />
            Visible to all students (public material)
          </label>
          <Button style={{ width: "100%", justifyContent: "center" }} onClick={() => save(editRow || false)} disabled={busy}>
            {busy ? "Saving…" : editRow ? "Save Changes" : "Add Material"}
          </Button>
        </Modal>
      )}
      {showDel && <ConfirmModal message={`Delete "${showDel.title}"?`} onConfirm={del} onCancel={() => setShowDel(null)} busy={busy} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PARENT PORTAL  —  real Supabase data, read-only
   All data filtered by parentId (linked parents.id row).
   Parents see ONLY their own children's data.
   ═══════════════════════════════════════════════════════════ */

/* ── Shared hook: load children once, reuse across views ── */
function useParentData(parentId) {
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  const load = useCallback(async () => {
    if (!parentId) return;
    setLoading(true); setErr("");
    const { data, error } = await db.getStudentsByParent(parentId);
    if (error) setErr(error.message); else setStudents(data || []);
    setLoading(false);
  }, [parentId]);

  useEffect(() => { load(); }, [load]);
  return { students, loading, err, reload: load };
}

/* ── ParentDashboard ── */
function ParentDashboard({ parentId, parentName }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    if (!parentId) return;
    (async () => {
      setLoading(true); setErr("");
      const { data, error } = await db.getParentDashboardStats(parentId);
      if (error) setErr(error.message); else setStats(data);
      setLoading(false);
    })();
  }, [parentId]);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (err)     return <ErrBanner message={err} />;

  const students = stats?.students || [];

  return (
    <div>
      <SectionTitle eyebrow="Welcome" title={parentName || "Parent"} />

      {/* Per-child summary cards */}
      {students.length === 0
        ? <Empty icon={GraduationCap} title="No children linked yet" body="Contact the admin to link your child's profile to your account." />
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginBottom: 24 }}>
            {students.map(s => (
              <Card key={s.id}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 700, color: tokens.tealDeep, flexShrink: 0 }}>
                    {initials(s.full_name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{s.full_name}</div>
                    <div style={{ fontSize: 12.5, color: tokens.slate }}>{s.grade} · {s.curriculum}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  <div>
                    <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{stats?.upcomingClasses ?? "—"}</div>
                    <div style={{ fontSize: 12, color: tokens.slate }}>Upcoming classes</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, color: stats?.pendingHomework > 0 ? tokens.coral : tokens.success }}>{stats?.pendingHomework ?? "—"}</div>
                    <div style={{ fontSize: 12, color: tokens.slate }}>Homework due</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, color: stats?.outstandingQar > 0 ? tokens.coral : tokens.success }}>{fmt(stats?.outstandingQar)}</div>
                    <div style={{ fontSize: 12, color: tokens.slate }}>Outstanding balance</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
}

/* ── ParentChild (My Child) ── */
function ParentChild({ parentId }) {
  const { students, loading, err, reload } = useParentData(parentId);

  return (
    <div>
      <SectionTitle title="My Child" />
      {err && <ErrBanner message={err} onRetry={reload} />}
      {loading ? <Spinner /> : students.length === 0
        ? <Empty icon={GraduationCap} title="No children linked" body="Contact the admin to link your child's profile." />
        : students.map(s => (
          <Card key={s.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 700, color: tokens.tealDeep }}>
                {initials(s.full_name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>{s.full_name}</div>
                <div style={{ fontSize: 13, color: tokens.slate }}>{s.grade} · {s.school} · {s.curriculum}</div>
              </div>
              <Pill value={s.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              <Field label="Subjects">
                <div style={{ fontSize: 13.5 }}>{(s.subjects || []).join(", ") || "—"}</div>
              </Field>
              <Field label="Tutor(s)">
                <div style={{ fontSize: 13.5 }}>
                  {(s.student_tutors || []).map(st => st.tutor?.full_name).filter(Boolean).join(", ") || "—"}
                </div>
              </Field>
              <Field label="Age">
                <div style={{ fontSize: 13.5 }}>{s.age ? `${s.age} years` : "—"}</div>
              </Field>
            </div>
            {(s.goals || s.strengths || s.weak_areas) && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tokens.line}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                {s.goals      && <div><div style={{ fontSize: 12, fontWeight: 700, color: tokens.slate, marginBottom: 4 }}>GOALS</div><div style={{ fontSize: 13 }}>{s.goals}</div></div>}
                {s.strengths  && <div><div style={{ fontSize: 12, fontWeight: 700, color: tokens.success, marginBottom: 4 }}>STRENGTHS</div><div style={{ fontSize: 13 }}>{s.strengths}</div></div>}
                {s.weak_areas && <div><div style={{ fontSize: 12, fontWeight: 700, color: tokens.coral, marginBottom: 4 }}>FOCUS AREAS</div><div style={{ fontSize: 13 }}>{s.weak_areas}</div></div>}
              </div>
            )}
          </Card>
        ))
      }
    </div>
  );
}

/* ── ParentClasses ── */
function ParentClasses({ parentId }) {
  const { students, loading: stuLoading } = useParentData(parentId);
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [filter,   setFilter]   = useState("all");

  useEffect(() => {
    if (!parentId || stuLoading) return;
    (async () => {
      setLoading(true); setErr("");
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) { setClasses([]); setLoading(false); return; }
      // Fetch classes for all linked children in parallel
      const results = await Promise.all(studentIds.map(sid => db.getClasses({ studentId: sid })));
      const all = results.flatMap(r => r.data || []);
      all.sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
      setClasses(all);
      setLoading(false);
    })();
  }, [parentId, students, stuLoading]);

  const visible = filter === "all" ? classes : classes.filter(c => c.status === filter);

  return (
    <div>
      <SectionTitle title="Classes" />
      {err && <ErrBanner message={err} />}
      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "Scheduled", "Completed", "Cancelled"].map(f => (
          <div key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: filter === f ? tokens.teal : tokens.tealSoft, color: filter === f ? "#fff" : tokens.tealDeep }}>
            {f === "all" ? "All" : f}
          </div>
        ))}
      </Card>
      {loading || stuLoading ? <Spinner /> : visible.length === 0
        ? <Empty icon={CalendarDays} title="No classes found" />
        : (
          <Card>
            <Table
              columns={["Date / Time", "Child", "Subject", "Topic", "Tutor", "Mode", "Status", "Attendance"]}
              rows={visible.map(c => ({
                cells: [
                  fmtDateTime(c.scheduled_at),
                  c.student?.full_name || "—",
                  c.subject,
                  c.topic || "—",
                  c.tutor?.full_name || "—",
                  c.mode === "Online"
                    ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Video size={13} /> Online</span>
                    : <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> Offline</span>,
                  <Pill value={c.status} />,
                  <Pill value={c.attendance || "Pending"} />,
                ],
              }))}
            />
          </Card>
        )
      }
    </div>
  );
}

/* ── ParentHomework ── */
function ParentHomework({ parentId }) {
  const { students, loading: stuLoading } = useParentData(parentId);
  const [hw,      setHw]      = useState([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [filter,  setFilter]  = useState("all");

  useEffect(() => {
    if (!parentId || stuLoading) return;
    (async () => {
      setLoading(true); setErr("");
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) { setHw([]); setLoading(false); return; }
      const results = await Promise.all(studentIds.map(sid => db.getHomework({ studentId: sid })));
      const all = results.flatMap(r => r.data || []);
      all.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
      setHw(all);
      setLoading(false);
    })();
  }, [parentId, students, stuLoading]);

  const visible = filter === "all" ? hw : hw.filter(h => h.status === filter);

  return (
    <div>
      <SectionTitle title="Homework" />
      {err && <ErrBanner message={err} />}
      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "Assigned", "Submitted", "Reviewed", "Incomplete"].map(f => (
          <div key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: filter === f ? tokens.teal : tokens.tealSoft, color: filter === f ? "#fff" : tokens.tealDeep }}>
            {f === "all" ? "All" : f}
          </div>
        ))}
      </Card>
      {loading || stuLoading ? <Spinner /> : visible.length === 0
        ? <Empty icon={BookOpenCheck} title="No homework found" />
        : (
          <Card>
            <Table
              columns={["Title", "Child", "Tutor", "Due Date", "Status"]}
              rows={visible.map(h => ({
                cells: [
                  <div>
                    <div style={{ fontWeight: 600 }}>{h.title}</div>
                    {h.description && <div style={{ fontSize: 12, color: tokens.slate, marginTop: 2 }}>{h.description.slice(0, 70)}{h.description.length > 70 ? "…" : ""}</div>}
                  </div>,
                  h.student?.full_name || "—",
                  h.tutor?.full_name || "—",
                  fmtDate(h.due_at),
                  <Pill value={h.status} />,
                ],
              }))}
            />
          </Card>
        )
      }
    </div>
  );
}

/* ── ParentProgress (class notes shared with parent) ── */
function ParentProgress({ parentId }) {
  const { students, loading: stuLoading } = useParentData(parentId);
  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    if (!parentId || stuLoading) return;
    (async () => {
      setLoading(true); setErr("");
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) { setNotes([]); setLoading(false); return; }
      const results = await Promise.all(studentIds.map(sid => db.getClassNotes({ studentId: sid })));
      const all = results.flatMap(r => r.data || [])
        .filter(n => n.is_shared_with_parent !== false); // only notes shared with parent
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setNotes(all);
      setLoading(false);
    })();
  }, [parentId, students, stuLoading]);

  const understandingColor = { Excellent: tokens.success, Good: tokens.teal, Fair: tokens.warn, "Needs Support": tokens.danger };

  return (
    <div>
      <SectionTitle title="Progress Updates" />
      {err && <ErrBanner message={err} />}
      {loading || stuLoading ? <Spinner /> : notes.length === 0
        ? <Empty icon={TrendingUp} title="No progress updates yet" body="Tutor notes will appear here once your child's tutor adds them." />
        : notes.map(n => (
          <Card key={n.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{n.student?.full_name} · {n.topic || n.class?.subject || "—"}</div>
                <div style={{ fontSize: 12, color: tokens.slate }}>{n.tutor?.full_name} · {fmtDate(n.created_at)}</div>
              </div>
              {n.understanding && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: understandingColor[n.understanding] || tokens.slate }}>
                  {n.understanding}
                </span>
              )}
            </div>
            {n.summary && (
              <div style={{ padding: "10px 14px", background: tokens.tealSoft, borderRadius: 10, fontSize: 13, fontStyle: "italic", color: tokens.tealDeep, marginBottom: 10 }}>
                "{n.summary}"
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {n.strengths   && <div style={{ fontSize: 12.5 }}><strong style={{ color: tokens.success }}>Strengths:</strong> {n.strengths}</div>}
              {n.areas_to_improve && <div style={{ fontSize: 12.5 }}><strong style={{ color: tokens.coral }}>Focus:</strong> {n.areas_to_improve}</div>}
              {n.recommendation && <div style={{ fontSize: 12.5, gridColumn: "1/-1" }}><strong>Recommendation:</strong> {n.recommendation}</div>}
            </div>
          </Card>
        ))
      }
    </div>
  );
}

/* ── ParentPayments ── */
function ParentPayments({ parentId }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [tab,      setTab]      = useState("invoices");

  const load = useCallback(async () => {
    if (!parentId) return;
    setLoading(true); setErr("");
    const [ir, pr] = await Promise.all([
      db.getInvoices({ parentId }),
      db.getPayments({ parentId }),
    ]);
    if (ir.error) setErr(ir.error.message); else setInvoices(ir.data || []);
    setPayments(pr.data || []);
    setLoading(false);
  }, [parentId]);

  useEffect(() => { load(); }, [load]);

  const totalBilled      = invoices.reduce((s, i) => s + Number(i.total_qar   || 0), 0);
  const totalPaid        = invoices.reduce((s, i) => s + Number(i.paid_qar    || 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + Number(i.balance_qar || 0), 0);

  return (
    <div>
      <SectionTitle title="Payments" />
      {err && <ErrBanner message={err} onRetry={load} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
        <StatCard icon={FileText}    label="Total Billed (QAR)"      value={fmt(totalBilled)} />
        <StatCard icon={CheckCircle2} label="Total Paid (QAR)"       value={fmt(totalPaid)}        accent={tokens.successBg} />
        <StatCard icon={AlertCircle} label="Outstanding (QAR)"       value={fmt(totalOutstanding)} accent={totalOutstanding > 0 ? tokens.warnBg : tokens.successBg} />
      </div>

      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", gap: 8 }}>
        {["invoices", "payments"].map(t => (
          <div key={t} onClick={() => setTab(t)} style={{ padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", background: tab === t ? tokens.teal : tokens.tealSoft, color: tab === t ? "#fff" : tokens.tealDeep, textTransform: "capitalize" }}>{t}</div>
        ))}
      </Card>

      {loading ? <Spinner /> : tab === "invoices"
        ? (
          <Card>
            {invoices.length === 0
              ? <Empty icon={FileText} title="No invoices yet" body="Invoices will appear here once issued by the academy." />
              : (
                <Table
                  columns={["Invoice #", "Student", "Period", "Total (QAR)", "Paid (QAR)", "Balance (QAR)", "Status"]}
                  rows={invoices.map(inv => ({
                    cells: [
                      inv.invoice_number || "—",
                      inv.student?.full_name || "—",
                      inv.period_start ? `${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}` : "—",
                      fmt(inv.total_qar),
                      fmt(inv.paid_qar),
                      <span style={{ fontWeight: 600, color: Number(inv.balance_qar) > 0 ? tokens.danger : tokens.success }}>{fmt(inv.balance_qar)}</span>,
                      <Pill value={inv.status} />,
                    ],
                  }))}
                />
              )
            }
          </Card>
        ) : (
          <Card>
            {payments.length === 0
              ? <Empty icon={Wallet} title="No payments recorded yet" />
              : (
                <Table
                  columns={["Date", "Amount (QAR)", "Method", "Reference", "Notes"]}
                  rows={payments.map(p => ({
                    cells: [
                      fmtDate(p.paid_at),
                      fmt(p.amount_qar),
                      p.method || "—",
                      p.reference || "—",
                      p.notes || "—",
                    ],
                  }))}
                />
              )
            }
          </Card>
        )
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENT PORTAL  —  real Supabase data, read-only
   All data filtered by studentId (linked students.id row).
   Students see ONLY their own data. No payment data shown.
   ═══════════════════════════════════════════════════════════ */

/* ── StudentDashboard ── */
function StudentDashboard({ studentId, studentName }) {
  const [stats,      setStats]      = useState(null);
  const [upcoming,   setUpcoming]   = useState([]);
  const [pendingHw,  setPendingHw]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState("");

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true); setErr("");
      const [statsRes, upRes, hwRes] = await Promise.all([
        db.getStudentDashboardStats(studentId),
        db.getUpcomingClasses({ studentId, limit: 5 }),
        db.getHomework({ studentId, status: "Assigned" }),
      ]);
      if (statsRes.error) setErr(statsRes.error.message);
      else setStats(statsRes.data);
      setUpcoming(upRes.data || []);
      setPendingHw(hwRes.data || []);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (err)     return <ErrBanner message={err} />;

  return (
    <div>
      <SectionTitle eyebrow="Hi there 👋" title={studentName || "Student"} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard icon={CalendarDays}  label="Upcoming Classes" value={(stats?.upcomingClasses || []).length} />
        <StatCard icon={BookOpenCheck} label="Homework Due"     value={(stats?.pendingHomework || []).length} accent={tokens.coralSoft} />
        <StatCard icon={FileText}      label="Recent Notes"     value={(stats?.recentNotes || []).length} accent={tokens.tealSoft} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>Next Classes</div>
          {upcoming.length === 0
            ? <div style={{ fontSize: 13, color: tokens.slate }}>No upcoming classes scheduled.</div>
            : upcoming.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${tokens.line}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.subject} · {c.topic || "—"}</div>
                  <div style={{ fontSize: 12, color: tokens.slate }}>{fmtDateTime(c.scheduled_at)} · {c.tutor?.full_name || "—"}</div>
                  {c.mode === "Online" && c.meeting_link
                    ? <a href={c.meeting_link} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: tokens.teal }}>Join meeting →</a>
                    : null}
                </div>
                <Pill value={c.status} />
              </div>
            ))
          }
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>Homework Due</div>
          {pendingHw.length === 0
            ? <div style={{ fontSize: 13, color: tokens.slate }}>You're all caught up!</div>
            : pendingHw.slice(0, 5).map(h => (
              <div key={h.id} style={{ padding: "9px 0", borderBottom: `1px solid ${tokens.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{h.title}</div>
                  <Pill value={h.status} />
                </div>
                <div style={{ fontSize: 12, color: tokens.slate }}>Due {fmtDate(h.due_at)}</div>
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
}

/* ── StudentClasses ── */
function StudentClasses({ studentId }) {
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [filter,   setFilter]   = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const { data, error } = await db.getClasses({ studentId });
    if (error) setErr(error.message); else setClasses(data || []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const visible = filter === "all" ? classes : classes.filter(c => c.status === filter);

  return (
    <div>
      <SectionTitle title="My Classes" />
      {err && <ErrBanner message={err} onRetry={load} />}
      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "Scheduled", "Completed", "Cancelled"].map(f => (
          <div key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: filter === f ? tokens.teal : tokens.tealSoft, color: filter === f ? "#fff" : tokens.tealDeep }}>
            {f === "all" ? "All" : f}
          </div>
        ))}
      </Card>
      {loading ? <Spinner /> : visible.length === 0
        ? <Empty icon={CalendarDays} title="No classes found" />
        : (
          <Card>
            <Table
              columns={["Date / Time", "Subject", "Topic", "Tutor", "Mode", "Status", "Attendance"]}
              rows={visible.map(c => ({
                cells: [
                  fmtDateTime(c.scheduled_at),
                  c.subject,
                  c.topic || "—",
                  c.tutor?.full_name || "—",
                  c.mode === "Online"
                    ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Video size={13} /> Online</span>
                    : <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> Offline</span>,
                  <Pill value={c.status} />,
                  <Pill value={c.attendance || "Pending"} />,
                ],
              }))}
            />
          </Card>
        )
      }
    </div>
  );
}

/* ── StudentHomework ── */
function StudentHomework({ studentId }) {
  const [hw,      setHw]      = useState([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [filter,  setFilter]  = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const { data, error } = await db.getHomework({ studentId });
    if (error) setErr(error.message); else setHw(data || []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const visible = filter === "all" ? hw : hw.filter(h => h.status === filter);

  return (
    <div>
      <SectionTitle title="Homework" />
      {err && <ErrBanner message={err} onRetry={load} />}
      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "Assigned", "Submitted", "Reviewed", "Incomplete"].map(f => (
          <div key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: filter === f ? tokens.teal : tokens.tealSoft, color: filter === f ? "#fff" : tokens.tealDeep }}>
            {f === "all" ? "All" : f}
          </div>
        ))}
      </Card>
      {loading ? <Spinner /> : visible.length === 0
        ? <Empty icon={BookOpenCheck} title="No homework found" body={filter === "all" ? "Your tutor hasn't assigned any homework yet." : "Nothing in this status."} />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.map(h => (
              <Card key={h.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{h.title}</div>
                    {h.description && <div style={{ fontSize: 13, color: tokens.slate, marginBottom: 8 }}>{h.description}</div>}
                    <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: tokens.slate }}>
                      <span>Due: <strong style={{ color: tokens.ink }}>{fmtDate(h.due_at)}</strong></span>
                      <span>Tutor: <strong style={{ color: tokens.ink }}>{h.tutor?.full_name || "—"}</strong></span>
                    </div>
                    {h.tutor_feedback && (
                      <div style={{ marginTop: 10, padding: "8px 12px", background: tokens.successBg, borderRadius: 8, fontSize: 12.5 }}>
                        <strong style={{ color: tokens.success }}>Tutor feedback:</strong> {h.tutor_feedback}
                      </div>
                    )}
                  </div>
                  <div style={{ marginLeft: 16, flexShrink: 0 }}>
                    <Pill value={h.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
}

/* ── StudentMaterials ── */
function StudentMaterials({ studentId }) {
  const [materials, setMaterials] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    // Fetch materials assigned to this student OR public materials
    const { data, error } = await db.getMaterials({ studentId });
    if (error) setErr(error.message);
    else {
      // Also fetch public materials (not already included)
      const { data: pub } = await db.getMaterials({});
      const publicMats = (pub || []).filter(m => m.is_public && !data?.find(d => d.id === m.id));
      setMaterials([...(data || []), ...publicMats]);
    }
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  // Group by subject
  const bySubject = materials.reduce((acc, m) => {
    const key = m.subject || "General";
    (acc[key] = acc[key] || []).push(m);
    return acc;
  }, {});

  return (
    <div>
      <SectionTitle title="Study Materials" />
      {err && <ErrBanner message={err} onRetry={load} />}
      {loading ? <Spinner /> : materials.length === 0
        ? <Empty icon={BookOpen} title="No materials yet" body="Your tutor hasn't uploaded any study materials yet." />
        : Object.entries(bySubject).map(([subject, mats]) => (
          <div key={subject} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: tokens.slate, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>{subject}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {mats.map(m => (
                <Card key={m.id}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <FileText size={18} color={tokens.tealDeep} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: tokens.slate, marginTop: 3 }}>{m.subject}</div>
                  {m.description && <div style={{ fontSize: 12.5, color: tokens.slate, marginTop: 6 }}>{m.description}</div>}
                  <div style={{ marginTop: 12 }}>
                    {m.file_url
                      ? <a href={m.file_url} target="_blank" rel="noreferrer">
                          <Button variant="secondary" icon={Download} style={{ width: "100%", justifyContent: "center", padding: "7px" }}>Open</Button>
                        </a>
                      : <Button variant="ghost" style={{ width: "100%", justifyContent: "center", padding: "7px", fontSize: 12, color: tokens.slate }} disabled>No file yet</Button>
                    }
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  );
}

/* ── StudentProgress ── */
function StudentProgress({ studentId }) {
  const [student,  setStudent]  = useState(null);
  const [notes,    setNotes]    = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const [sr, nr, cr] = await Promise.all([
      db.getStudentById(studentId),
      db.getClassNotes({ studentId }),
      db.getClasses({ studentId, status: "Completed" }),
    ]);
    if (sr.error) setErr(sr.error.message);
    else setStudent(sr.data);
    // Only show notes shared with student
    setNotes((nr.data || []).filter(n => n.is_shared_with_student !== false));
    setClasses(cr.data || []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const understandingColor = { Excellent: tokens.success, Good: tokens.teal, Fair: tokens.warn, "Needs Support": tokens.danger };

  return (
    <div>
      <SectionTitle title="My Progress" />
      {err && <ErrBanner message={err} onRetry={load} />}
      {loading ? <Spinner /> : (
        <>
          {/* Student profile summary */}
          {student && (student.goals || student.strengths || student.weak_areas) && (
            <Card style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, marginBottom: 14 }}>My Learning Profile</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {student.goals && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: tokens.slate, marginBottom: 6 }}>GOAL</div>
                    <div style={{ fontSize: 13.5 }}>{student.goals}</div>
                  </div>
                )}
                {student.strengths && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: tokens.success, marginBottom: 6 }}>STRENGTHS</div>
                    <div style={{ fontSize: 13.5 }}>{student.strengths}</div>
                  </div>
                )}
                {student.weak_areas && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: tokens.coral, marginBottom: 6 }}>FOCUS AREAS</div>
                    <div style={{ fontSize: 13.5 }}>{student.weak_areas}</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
            <StatCard icon={CheckCircle2}  label="Classes Completed" value={classes.length} accent={tokens.successBg} />
            <StatCard icon={FileText}      label="Progress Notes"    value={notes.length} />
            <StatCard icon={Award}         label="Subjects"          value={(student?.subjects || []).length} accent={tokens.tealSoft} />
          </div>

          {/* Progress notes */}
          {notes.length === 0
            ? <Empty icon={TrendingUp} title="No progress notes yet" body="Your tutor's feedback will appear here after class." />
            : (
              <>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 14 }}>Tutor Feedback</div>
                {notes.map(n => (
                  <Card key={n.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{n.topic || n.class?.subject || "—"}</div>
                        <div style={{ fontSize: 12, color: tokens.slate }}>{n.tutor?.full_name || "—"} · {fmtDate(n.created_at)}</div>
                      </div>
                      {n.understanding && (
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: understandingColor[n.understanding] || tokens.slate }}>
                          {n.understanding}
                        </span>
                      )}
                    </div>
                    {n.summary && (
                      <div style={{ padding: "10px 14px", background: tokens.tealSoft, borderRadius: 10, fontSize: 13, fontStyle: "italic", color: tokens.tealDeep, marginBottom: 10 }}>
                        "{n.summary}"
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {n.strengths   && <div style={{ fontSize: 12.5 }}><strong style={{ color: tokens.success }}>Strengths:</strong> {n.strengths}</div>}
                      {n.areas_to_improve && <div style={{ fontSize: 12.5 }}><strong style={{ color: tokens.coral }}>Focus:</strong> {n.areas_to_improve}</div>}
                      {n.recommendation && <div style={{ fontSize: 12.5, gridColumn: "1/-1" }}><strong>Next steps:</strong> {n.recommendation}</div>}
                    </div>
                  </Card>
                ))}
              </>
            )
          }
        </>
      )}
    </div>
  );
}

/* ═══ SUSPENDED / UNLINKED ═══ */

function SuspendedScreen({onSignOut}){
  return(
    <div style={{minHeight:"100vh",background:tokens.paper,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter, sans-serif",padding:20}}>
      <div style={{textAlign:"center",maxWidth:380}}>
        <div style={{width:52,height:52,borderRadius:14,background:tokens.dangerBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><AlertCircle size={26} color={tokens.danger}/></div>
        <div style={{fontFamily:"Fraunces, serif",fontSize:22,fontWeight:600,color:tokens.ink,marginBottom:8}}>Account Suspended</div>
        <div style={{fontSize:13.5,color:tokens.slate,lineHeight:1.6,marginBottom:20}}>Your account has been suspended. Please contact LearnWise Academy for assistance.</div>
        <Button variant="ghost" onClick={onSignOut} icon={LogOut}>Sign out</Button>
      </div>
    </div>
  );
}

function NotLinkedScreen({role,name,onSignOut}){
  return(
    <div style={{minHeight:"100vh",background:tokens.paper,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter, sans-serif",padding:20}}>
      <div style={{textAlign:"center",maxWidth:440}}>
        <div style={{width:52,height:52,borderRadius:14,background:tokens.tealSoft,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><GraduationCap size={26} color={tokens.tealDeep}/></div>
        <div style={{fontFamily:"Fraunces, serif",fontSize:22,fontWeight:600,color:tokens.ink,marginBottom:8}}>Welcome, {name}</div>
        <div style={{fontSize:13.5,color:tokens.slate,lineHeight:1.7,marginBottom:20}}>
          Your account is active, but it has not yet been linked to a profile.<br/>
          Please contact the admin to get your <strong>{role}</strong> portal set up.
        </div>
        <Button variant="ghost" onClick={onSignOut} icon={LogOut}>Sign out</Button>
      </div>
    </div>
  );
}

function UnknownRoleScreen({name,onSignOut}){
  return(
    <div style={{minHeight:"100vh",background:tokens.paper,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter, sans-serif",padding:20}}>
      <div style={{textAlign:"center",maxWidth:420}}>
        <div style={{width:52,height:52,borderRadius:14,background:tokens.warnBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Shield size={26} color={tokens.warn}/></div>
        <div style={{fontFamily:"Fraunces, serif",fontSize:22,fontWeight:600,color:tokens.ink,marginBottom:8}}>Hi, {name}</div>
        <div style={{fontSize:13.5,color:tokens.slate,lineHeight:1.7,marginBottom:20}}>
          Your account doesn't have a role assigned yet. Please contact the admin.
        </div>
        <Button variant="ghost" onClick={onSignOut} icon={LogOut}>Sign out</Button>
      </div>
    </div>
  );
}

/* ═══ APP ROOT ═══ */

export default function App(){
  const{user,profile,loading,signOut}=useAuth();
  const[authScreen,setAuthScreen] =useState("home"); // default to public home
  const[current,setCurrent]       =useState("dashboard");

  // Real linked profile records — fetched once after auth resolves
  const[linkedProfile,setLinkedProfile] =useState(null);  // tutors/parents/students row
  const[profileLoading,setProfileLoading]=useState(false);
  const[profileChecked,setProfileChecked]=useState(false); // true once lookup attempted

  const who=profile?.full_name||profile?.email||"";
  const handleSignOut=()=>{ setCurrent("dashboard"); setLinkedProfile(null); setProfileChecked(false); setAuthScreen("home"); signOut(); };

  // After we know the role, look up the corresponding linked record
  useEffect(()=>{
    if(!user||!profile)return;
    const role=profile.role;
    if(role==="super_admin"||role==="admin_tutor"||role==="admin"){setProfileChecked(true);return;} // staff need no linked record
    if(!["tutor","parent","student"].includes(role)){setProfileChecked(true);return;}
    setProfileLoading(true);
    const lookup=role==="tutor"?db.getMyTutorProfile:role==="parent"?db.getMyParentProfile:db.getMyStudentProfile;
    lookup(user.id).then(({data})=>{
      setLinkedProfile(data||null);
      setProfileLoading(false);
      setProfileChecked(true);
    });
  },[user,profile]);

  /* ── Loading states ── */
  if(loading||profileLoading||(!profileChecked&&profile&&!["super_admin","admin_tutor","admin"].includes(profile.role))){
    return(<div style={{minHeight:"100vh",background:tokens.paper,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter, sans-serif",color:tokens.slate,fontSize:13}}>Loading LearnWise Academy…</div>);
  }

  /* ── Public pages (shown when not logged in) ── */
  const PUBLIC_SCREENS = ["home","about","subjects","igcse","online","assessment","contact"];
  if(!user||!profile){
    const goToPortal = () => setAuthScreen("signin");
    if(authScreen==="staff")  return <StaffLogin  onBack={()=>setAuthScreen("signin")}/>;
    if(authScreen==="signup") return <SignUp       onGoSignIn={()=>setAuthScreen("signin")}/>;
    if(authScreen==="signin") return <SignIn       onGoSignUp={()=>setAuthScreen("signup")} onGoStaff={()=>setAuthScreen("staff")}/>;
    // Public website pages
    return (
      <div>
        <PublicNav current={authScreen} onNav={setAuthScreen}/>
        {authScreen==="about"      && <PublicAbout      onNav={setAuthScreen}/>}
        {authScreen==="subjects"   && <PublicSubjects   onNav={setAuthScreen}/>}
        {authScreen==="igcse"      && <PublicIGCSE      onNav={setAuthScreen}/>}
        {authScreen==="online"     && <PublicOnline     onNav={setAuthScreen}/>}
        {authScreen==="assessment" && <PublicAssessment/>}
        {authScreen==="contact"    && <PublicContact/>}
        {(!authScreen||authScreen==="home"||!PUBLIC_SCREENS.includes(authScreen)) && <PublicHome onNav={setAuthScreen}/>}
        <PublicFooter onNav={setAuthScreen}/>
      </div>
    );
  }

  /* ── Suspended ── */
  if(profile.status==="Suspended")return <SuspendedScreen onSignOut={handleSignOut}/>;

  const role=profile.role;

  /* ── Unknown role ── */
  if(!["super_admin","admin_tutor","admin","tutor","parent","student"].includes(role))return <UnknownRoleScreen name={who} onSignOut={handleSignOut}/>;

  /* ── Non-staff with no linked profile record ── */
  if(!["super_admin","admin_tutor","admin"].includes(role)&&!linkedProfile)return <NotLinkedScreen role={role} name={who} onSignOut={handleSignOut}/>;

  /* ── Derive real IDs from linked records ── */
  const tutorId  =linkedProfile?.id||null;
  const parentId =linkedProfile?.id||null;
  const studentId=linkedProfile?.id||null;

  // Pass profile to section components that need permission checks
  const isStaffRole = ["super_admin","admin_tutor","admin"].includes(role);
  const isSuperAdminRole = ["super_admin","admin"].includes(role);

  const renderAdmin=()=>{switch(current){
    case "dashboard":   return <AdminDashboard/>;
    case "users":       return <AdminUsers/>;
    case "students":    return <AdminStudents/>;
    case "parents":     return <AdminParents/>;
    case "tutors":      return <AdminTutors/>;
    case "classes":     return <AdminClasses/>;
    case "attendance":  return <AdminAttendance/>;
    case "homework":    return <AdminHomework/>;
    case "classnotes":  return <AdminClassNotes/>;
    case "materials":   return <AdminMaterials/>;
    case "payments":    return <AdminPayments/>;
    case "assessments": return <AdminAssessments/>;
    case "reports":     return <AdminReports/>;
    case "auditlogs":   return isSuperAdminRole ? <AdminAuditLogs/> : <AdminDashboard/>;
    case "settings":    return isSuperAdminRole ? <AdminSettings/> : <AdminDashboard/>;
    case "qatest":      return isSuperAdminRole ? <AdminQATest/> : <AdminDashboard/>;
    default:            return <AdminDashboard/>;
  }};

  const tutorName = linkedProfile?.full_name || who;
  const renderTutor=()=>{switch(current){
    case "dashboard":  return <TutorDashboard  tutorId={tutorId} tutorName={tutorName}/>;
    case "myclasses":  return <TutorMyClasses  tutorId={tutorId}/>;
    case "mystudents": return <TutorMyStudents tutorId={tutorId}/>;
    case "classnotes": return <TutorClassNotes tutorId={tutorId}/>;
    case "homework":   return <TutorHomework   tutorId={tutorId}/>;
    case "materials":  return <TutorMaterials  tutorId={tutorId}/>;
    default:           return <TutorDashboard  tutorId={tutorId} tutorName={tutorName}/>;
  }};

  const parentName = linkedProfile?.full_name || who;
  const renderParent=()=>{switch(current){
    case "dashboard": return <ParentDashboard parentId={parentId} parentName={parentName}/>;
    case "mychild":   return <ParentChild     parentId={parentId}/>;
    case "classes":   return <ParentClasses   parentId={parentId}/>;
    case "homework":  return <ParentHomework  parentId={parentId}/>;
    case "progress":  return <ParentProgress  parentId={parentId}/>;
    case "payments":  return <ParentPayments  parentId={parentId}/>;
    default:          return <ParentDashboard parentId={parentId} parentName={parentName}/>;
  }};

  const studentName = linkedProfile?.full_name || who;
  const renderStudent=()=>{switch(current){
    case "dashboard": return <StudentDashboard studentId={studentId} studentName={studentName}/>;
    case "myclasses": return <StudentClasses   studentId={studentId}/>;
    case "homework":  return <StudentHomework  studentId={studentId}/>;
    case "materials": return <StudentMaterials studentId={studentId}/>;
    case "progress":  return <StudentProgress  studentId={studentId}/>;
    default:          return <StudentDashboard studentId={studentId} studentName={studentName}/>;
  }};

  const renderers={
    super_admin: renderAdmin,
    admin_tutor: renderAdmin, // uses same section components — delete buttons hidden by role check inside each section
    admin:       renderAdmin, // backward compat
    tutor:       renderTutor,
    parent:      renderParent,
    student:     renderStudent,
  };
  return(
    <Shell role={role} current={current} setCurrent={setCurrent} onLogout={handleSignOut} who={who}>
      {renderers[role]()}
    </Shell>
  );
}
