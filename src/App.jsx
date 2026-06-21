import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard, Users, GraduationCap, UserCircle, CalendarDays, ClipboardCheck,
  BookOpenCheck, Wallet, FileBarChart, Settings, LogOut, Search, Plus, X, ChevronRight,
  Clock, MapPin, Video, CheckCircle2, XCircle, AlertCircle, FileText, Download,
  TrendingUp, Mail, Phone, Home as HomeIcon, ArrowLeft, BookOpen, Award, Target, Shield,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { supabase } from "./supabaseClient";

/* ============================================================
   LearnWise Academy — Tutoring Management Platform (MVP)
   Single-file React demo. In-memory state, placeholder data.
   Structure mirrors the intended Supabase schema for later wiring.
   ============================================================ */

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap";

const tokens = {
  paper: "#FAF8F3",
  ink: "#1F2A2E",
  slate: "#5B6B70",
  teal: "#2C5F63",
  tealDeep: "#1E4448",
  coral: "#D97757",
  coralSoft: "#FBEAE2",
  gold: "#C9A24B",
  line: "#E7E1D6",
  cardBg: "#FFFFFF",
  tealSoft: "#E4EEEC",
  successBg: "#E7F3E9",
  success: "#3F8255",
  warnBg: "#FBF2DF",
  warn: "#B8862E",
  dangerBg: "#FBEAE6",
  danger: "#C4583B",
};

/* ---------------------- Mock Data Layer ---------------------- */

const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Computer Science", "Economics"];
const CURRICULA = ["IGCSE", "Edexcel", "Cambridge", "School Curriculum"];

let initialTutors = [
  { id: "t1", name: "Sarah Whitfield", email: "sarah.w@learnwise.edu", phone: "+974 5512 3344", subjects: ["Mathematics", "Physics"], curriculum: ["IGCSE", "Edexcel"], rate: 45, status: "Active", notes: "Excellent with exam technique coaching." },
  { id: "t2", name: "Daniel Okafor", email: "daniel.o@learnwise.edu", phone: "+974 5598 7712", subjects: ["Chemistry", "Biology"], curriculum: ["Cambridge", "IGCSE"], rate: 40, status: "Active", notes: "Strong lab-concept visualizer." },
  { id: "t3", name: "Priya Nair", email: "priya.n@learnwise.edu", phone: "+974 5523 9981", subjects: ["English", "Economics"], curriculum: ["Edexcel", "School Curriculum"], rate: 38, status: "Active", notes: "Specializes in essay structuring." },
];

let initialParents = [
  { id: "p1", name: "Mariam Al-Sayed", phone: "+974 5511 2233", email: "mariam.alsayed@gmail.com", address: "West Bay, Doha", studentIds: ["s1", "s2"], paymentStatus: "Pending" },
  { id: "p2", name: "James Carter", phone: "+974 5566 7788", email: "j.carter@gmail.com", address: "The Pearl, Doha", studentIds: ["s3"], paymentStatus: "Paid" },
  { id: "p3", name: "Fatima Hassan", phone: "+974 5544 9911", email: "fatima.h@outlook.com", address: "Al Waab, Doha", studentIds: ["s4"], paymentStatus: "Partially Paid" },
];

let initialStudents = [
  { id: "s1", name: "Yusuf Al-Sayed", age: 15, grade: "Year 10", school: "DESS Doha", curriculum: "IGCSE", subjects: ["Mathematics", "Physics"], tutorIds: ["t1"], parentId: "p1", strengths: "Quick with algebra, logical thinker", weakAreas: "Word problems, time management in exams", goals: "Achieve A* in IGCSE Maths", status: "Active" },
  { id: "s2", name: "Layla Al-Sayed", age: 12, grade: "Year 7", school: "DESS Doha", curriculum: "IGCSE", subjects: ["English"], tutorIds: ["t3"], parentId: "p1", strengths: "Creative writing, vocabulary", weakAreas: "Grammar consistency", goals: "Build confidence in essay writing", status: "Active" },
  { id: "s3", name: "Oliver Carter", age: 16, grade: "Year 11", school: "Compass International", curriculum: "Edexcel", subjects: ["Chemistry", "Biology"], tutorIds: ["t2"], parentId: "p2", strengths: "Strong memorization, diagrams", weakAreas: "Applying theory to new scenarios", goals: "Secure top grades for medicine pathway", status: "Active" },
  { id: "s4", name: "Noor Hassan", age: 14, grade: "Year 9", school: "Qatar Academy", curriculum: "Cambridge", subjects: ["Mathematics", "Economics"], tutorIds: ["t1", "t3"], parentId: "p3", strengths: "Analytical, persistent", weakAreas: "Confidence under timed conditions", goals: "Move up a learning set by next term", status: "Active" },
];

let initialClasses = [
  { id: "c1", studentId: "s1", tutorId: "t1", subject: "Mathematics", topic: "Quadratic Equations", date: "2026-06-21", start: "16:00", end: "17:00", duration: 60, mode: "Online", link: "meet.learnwise.edu/c1", location: "", status: "Scheduled", attendance: "—", payment: "Pending" },
  { id: "c2", studentId: "s3", tutorId: "t2", subject: "Chemistry", topic: "Organic Reactions", date: "2026-06-21", start: "18:00", end: "19:00", duration: 60, mode: "Offline", link: "", location: "Student's home, The Pearl", status: "Scheduled", attendance: "—", payment: "Paid" },
  { id: "c3", studentId: "s2", tutorId: "t3", subject: "English", topic: "Descriptive Writing", date: "2026-06-19", start: "15:00", end: "16:00", duration: 60, mode: "Online", link: "meet.learnwise.edu/c3", location: "", status: "Completed", attendance: "Present", payment: "Paid" },
  { id: "c4", studentId: "s4", tutorId: "t1", subject: "Mathematics", topic: "Linear Graphs", date: "2026-06-18", start: "17:00", end: "18:00", duration: 60, mode: "Online", link: "meet.learnwise.edu/c4", location: "", status: "Completed", attendance: "Present", payment: "Partially Paid" },
  { id: "c5", studentId: "s4", tutorId: "t3", subject: "Economics", topic: "Demand & Supply", date: "2026-06-23", start: "16:30", end: "17:30", duration: 60, mode: "Online", link: "meet.learnwise.edu/c5", location: "", status: "Scheduled", attendance: "—", payment: "Pending" },
  { id: "c6", studentId: "s1", tutorId: "t1", subject: "Physics", topic: "Forces & Motion", date: "2026-06-16", start: "16:00", end: "17:00", duration: 60, mode: "Online", link: "meet.learnwise.edu/c6", location: "", status: "Cancelled", attendance: "Cancelled", payment: "—" },
];

let initialNotes = [
  { id: "n1", classId: "c3", topic: "Descriptive Writing", understanding: "Good", strengths: "Vivid vocabulary, strong imagery", improvement: "Sentence variety, punctuation in long sentences", recommendation: "Practice 3 short paragraphs weekly", summary: "Today we covered descriptive writing techniques. Layla used vivid imagery confidently and is building a strong vocabulary. We'll focus next on varying sentence length and punctuation. No homework concerns — she's progressing well." },
  { id: "n2", classId: "c4", topic: "Linear Graphs", understanding: "Fair", strengths: "Plots accurately, reads gradients well", improvement: "Word problems, time pressure", recommendation: "Timed practice sets before next session", summary: "Today we covered algebra basics and simple equations. Noor understood the main concept well but needs more practice with word problems. Homework has been assigned for the next class." },
];

let initialHomework = [
  { id: "h1", classId: "c3", studentId: "s2", tutorId: "t3", title: "Descriptive Paragraph: 'A Stormy Night'", description: "Write a 200-word descriptive paragraph using at least 5 sensory details.", due: "2026-06-23", status: "Submitted", file: "stormy_night_draft.docx" },
  { id: "h2", classId: "c4", studentId: "s4", tutorId: "t1", title: "Linear Graphs Worksheet 3", description: "Complete questions 1–12, show all working.", due: "2026-06-22", status: "Pending", file: "" },
  { id: "h3", classId: "c1", studentId: "s1", tutorId: "t1", title: "Quadratic Equations Practice", description: "Factorisation and completing the square, Q1-10.", due: "2026-06-24", status: "Pending", file: "" },
  { id: "h4", classId: "c2", studentId: "s3", tutorId: "t2", title: "Organic Reactions Summary Sheet", description: "Summarize addition vs substitution reactions with 2 examples each.", due: "2026-06-25", status: "Reviewed", file: "organic_summary.pdf" },
];

let initialPayments = [
  { id: "pay1", studentId: "s1", parentId: "p1", tutorId: "t1", classId: "c6", hours: 1, rate: 45, total: 45, paid: 0, balance: 45, method: "—", status: "Pending", date: "2026-06-16" },
  { id: "pay2", studentId: "s4", parentId: "p3", tutorId: "t1", classId: "c4", hours: 1, rate: 45, total: 45, paid: 25, balance: 20, method: "Bank Transfer", status: "Partially Paid", date: "2026-06-18" },
  { id: "pay3", studentId: "s2", parentId: "p1", tutorId: "t3", classId: "c3", hours: 1, rate: 38, total: 38, paid: 38, balance: 0, method: "Online", status: "Paid", date: "2026-06-19" },
  { id: "pay4", studentId: "s3", parentId: "p2", tutorId: "t2", classId: "c2", hours: 1, rate: 40, total: 40, paid: 40, balance: 0, method: "Card", status: "Paid", date: "2026-06-21" },
];

const findStudent = (id) => initialStudents.find((s) => s.id === id);
const findTutor = (id) => initialTutors.find((t) => t.id === id);
const findParent = (id) => initialParents.find((p) => p.id === id);

const statusColors = {
  Scheduled: { bg: tokens.tealSoft, fg: tokens.tealDeep },
  Completed: { bg: tokens.successBg, fg: tokens.success },
  Cancelled: { bg: tokens.dangerBg, fg: tokens.danger },
  Rescheduled: { bg: tokens.warnBg, fg: tokens.warn },
  Present: { bg: tokens.successBg, fg: tokens.success },
  Absent: { bg: tokens.dangerBg, fg: tokens.danger },
  Paid: { bg: tokens.successBg, fg: tokens.success },
  Pending: { bg: tokens.warnBg, fg: tokens.warn },
  "Partially Paid": { bg: tokens.coralSoft, fg: tokens.coral },
  Submitted: { bg: tokens.tealSoft, fg: tokens.tealDeep },
  Reviewed: { bg: tokens.successBg, fg: tokens.success },
  Incomplete: { bg: tokens.dangerBg, fg: tokens.danger },
  Active: { bg: tokens.successBg, fg: tokens.success },
  "—": { bg: "#F0EEE7", fg: tokens.slate },
};

function Pill({ value }) {
  const c = statusColors[value] || statusColors["—"];
  return (
    <span style={{ background: c.bg, color: c.fg, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: tokens.cardBg, border: `1px solid ${tokens.line}`, borderRadius: 16, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: accent || tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={tokens.tealDeep} />
      </div>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, color: tokens.ink }}>{value}</div>
      <div style={{ fontSize: 13, color: tokens.slate }}>{label}</div>
    </Card>
  );
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
      <div>
        {eyebrow && <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.coral, fontWeight: 700, marginBottom: 4 }}>{eyebrow}</div>}
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, color: tokens.ink }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

function Button({ children, variant = "primary", onClick, style, icon: Icon, type = "button" }) {
  const base = { border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", transition: "opacity .15s" };
  const variants = {
    primary: { background: tokens.teal, color: "#fff" },
    secondary: { background: tokens.tealSoft, color: tokens.tealDeep },
    ghost: { background: "transparent", color: tokens.slate, border: `1px solid ${tokens.line}` },
    danger: { background: tokens.dangerBg, color: tokens.danger },
  };
  return (
    <button type={type} onClick={onClick} style={{ ...base, ...variants[variant], ...style }} onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.85)} onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}>
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function Table({ columns, rows, onRowClick }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} style={{ textAlign: "left", padding: "10px 14px", color: tokens.slate, fontWeight: 600, borderBottom: `1px solid ${tokens.line}`, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} onClick={() => onRowClick && onRowClick(r)} style={{ cursor: onRowClick ? "pointer" : "default" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FBFAF7")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {r.cells.map((cell, j) => (
                <td key={j} style={{ padding: "12px 14px", borderBottom: `1px solid ${tokens.line}`, color: tokens.ink }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,46,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: tokens.cardBg, borderRadius: 18, width: wide ? 640 : 460, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: tokens.slate }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: tokens.slate, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${tokens.line}`, fontSize: 13.5, fontFamily: "Inter, sans-serif", boxSizing: "border-box", color: tokens.ink, background: "#FCFBF8" };

/* ---------------------- Nav Configs ---------------------- */

const NAV = {
  admin: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "users", label: "All Users", icon: Shield },
    { key: "students", label: "Students", icon: GraduationCap },
    { key: "parents", label: "Parents", icon: UserCircle },
    { key: "tutors", label: "Tutors", icon: Users },
    { key: "classes", label: "Classes", icon: CalendarDays },
    { key: "attendance", label: "Attendance", icon: ClipboardCheck },
    { key: "homework", label: "Homework", icon: BookOpenCheck },
    { key: "payments", label: "Payments", icon: Wallet },
    { key: "reports", label: "Reports", icon: FileBarChart },
    { key: "settings", label: "Settings", icon: Settings },
  ],
  tutor: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "myclasses", label: "My Classes", icon: CalendarDays },
    { key: "mystudents", label: "My Students", icon: GraduationCap },
    { key: "classnotes", label: "Class Notes", icon: FileText },
    { key: "homework", label: "Homework", icon: BookOpenCheck },
    { key: "materials", label: "Materials", icon: BookOpen },
  ],
  parent: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "mychild", label: "My Child", icon: GraduationCap },
    { key: "classes", label: "Classes", icon: CalendarDays },
    { key: "homework", label: "Homework", icon: BookOpenCheck },
    { key: "progress", label: "Progress", icon: TrendingUp },
    { key: "payments", label: "Payments", icon: Wallet },
  ],
  student: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "myclasses", label: "My Classes", icon: CalendarDays },
    { key: "homework", label: "Homework", icon: BookOpenCheck },
    { key: "materials", label: "Materials", icon: BookOpen },
    { key: "progress", label: "Progress", icon: Target },
  ],
};

const ROLE_LABEL = { admin: "Main Admin", tutor: "Tutor", parent: "Parent", student: "Student" };

/* ---------------------- Login ---------------------- */

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div style={{ minHeight: "100vh", background: tokens.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 20 }}>
      <div style={{ width: 420, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: tokens.teal, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <GraduationCap size={26} color="#fff" />
          </div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, color: tokens.ink }}>LearnWise Academy</div>
          <div style={{ color: tokens.coral, fontSize: 13, fontWeight: 600, marginTop: 4, letterSpacing: "0.02em" }}>Smart Guidance. Better Learning.</div>
        </div>
        <Card style={{ padding: 24 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: tokens.slate, marginBottom: 16 }}>{subtitle}</div>}
          {children}
        </Card>
        {footer}
      </div>
    </div>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return <div style={{ background: tokens.dangerBg, color: tokens.danger, fontSize: 12.5, padding: "9px 12px", borderRadius: 9, marginBottom: 14 }}>{message}</div>;
}

function SignIn({ onGoSignUp, onGoStaff }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back — sign in to your portal."
      footer={
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <div style={{ fontSize: 12.5, color: tokens.slate }}>
            New here? <span onClick={onGoSignUp} style={{ color: tokens.teal, fontWeight: 600, cursor: "pointer" }}>Create an account</span>
          </div>
          <div onClick={onGoStaff} style={{ textAlign: "center", fontSize: 11, color: tokens.line, marginTop: 18, cursor: "pointer", userSelect: "none" }}>·</div>
        </div>
      }
    >
      <form onSubmit={submit}>
        <ErrorNote message={error} />
        <Field label="Email"><input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Password"><input style={inputStyle} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
        <Button type="submit" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>{loading ? "Signing in..." : "Sign in"}</Button>
      </form>
    </AuthShell>
  );
}

function SignUp({ onGoSignIn }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const roles = [
    { key: "tutor", label: "Tutor", icon: Users },
    { key: "parent", label: "Parent", icon: UserCircle },
    { key: "student", label: "Student", icon: GraduationCap },
  ];

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signUp({ email, password, fullName, role });
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  if (done) {
    return (
      <AuthShell title="Check your inbox" subtitle="">
        <div style={{ fontSize: 13.5, color: tokens.ink, lineHeight: 1.6 }}>
          We've sent a confirmation link to <strong>{email}</strong>. Confirm your email, then sign in to reach your {ROLE_LABEL[role]} portal.
        </div>
        <Button variant="secondary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} onClick={onGoSignIn}>Back to sign in</Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle="Sign up as a tutor, parent, or student."
      footer={
        <div style={{ textAlign: "center", fontSize: 12.5, color: tokens.slate, marginTop: 16 }}>
          Already have an account? <span onClick={onGoSignIn} style={{ color: tokens.teal, fontWeight: 600, cursor: "pointer" }}>Sign in</span>
        </div>
      }
    >
      <form onSubmit={submit}>
        <ErrorNote message={error} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {roles.map((r) => (
            <div key={r.key} onClick={() => setRole(r.key)} style={{ border: `1.5px solid ${role === r.key ? tokens.teal : tokens.line}`, background: role === r.key ? tokens.tealSoft : "#fff", borderRadius: 12, padding: "10px 8px", cursor: "pointer", textAlign: "center" }}>
              <r.icon size={17} color={role === r.key ? tokens.tealDeep : tokens.slate} style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: tokens.ink }}>{r.label}</div>
            </div>
          ))}
        </div>
        <Field label="Full Name"><input style={inputStyle} required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" /></Field>
        <Field label="Email"><input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Password"><input style={inputStyle} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></Field>
        <Button type="submit" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>{loading ? "Creating account..." : "Create account"}</Button>
      </form>
    </AuthShell>
  );
}

function StaffLogin({ onBack }) {
  const { signIn, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error } = await signIn({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (prof?.role !== "admin") {
      await supabase.auth.signOut();
      setError("This account doesn't have admin access.");
    }
  };

  return (
    <AuthShell title="Staff Access" subtitle="Restricted — administrators only" footer={
      <div onClick={onBack} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: tokens.slate, marginTop: 16, cursor: "pointer" }}>
        <ArrowLeft size={13} /> Back to portal sign in
      </div>
    }>
      <form onSubmit={submit}>
        <ErrorNote message={error} />
        <Field label="Admin Email"><input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@learnwise.edu" /></Field>
        <Field label="Password"><input style={inputStyle} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
        <Button type="submit" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>{loading ? "Signing in..." : "Sign in"}</Button>
      </form>
    </AuthShell>
  );
}

/* ---------------------- Shell ---------------------- */

function Shell({ role, current, setCurrent, onLogout, children, who }) {
  const nav = NAV[role];
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: tokens.paper, fontFamily: "Inter, sans-serif" }}>
      <div style={{ width: 232, flexShrink: 0, borderRight: `1px solid ${tokens.line}`, padding: "22px 14px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 26 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: tokens.teal, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <GraduationCap size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 14.5, color: tokens.ink, lineHeight: 1.1 }}>LearnWise</div>
            <div style={{ fontSize: 10.5, color: tokens.coral, fontWeight: 600 }}>Academy</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {nav.map((n) => (
            <div key={n.key} onClick={() => setCurrent(n.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, cursor: "pointer", background: current === n.key ? tokens.tealSoft : "transparent", color: current === n.key ? tokens.tealDeep : tokens.slate, fontWeight: current === n.key ? 700 : 500, fontSize: 13.5 }}>
              <n.icon size={16} />
              {n.label}
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${tokens.line}`, paddingTop: 14, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: tokens.coralSoft, display: "flex", alignItems: "center", justifyContent: "center", color: tokens.coral, fontWeight: 700, fontSize: 12.5 }}>
              {who.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: tokens.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</div>
              <div style={{ fontSize: 11, color: tokens.slate }}>{ROLE_LABEL[role]}</div>
            </div>
          </div>
          <div onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, cursor: "pointer", color: tokens.slate, fontSize: 13 }}>
            <LogOut size={15} /> Sign out
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "26px 32px", minWidth: 0 }}>{children}</div>
    </div>
  );
}

/* ---------------------- Admin Views ---------------------- */

function AdminDashboard() {
  const today = "2026-06-21";
  const todayClasses = initialClasses.filter((c) => c.date === today);
  const upcoming = initialClasses.filter((c) => c.date > today && c.status === "Scheduled");
  const completed = initialClasses.filter((c) => c.status === "Completed");
  const pendingPay = initialPayments.filter((p) => p.status !== "Paid");
  const revenue = initialPayments.reduce((sum, p) => sum + p.paid, 0);

  return (
    <div>
      <SectionTitle eyebrow="Overview" title="Admin Dashboard" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 26 }}>
        <StatCard icon={GraduationCap} label="Total Students" value={initialStudents.length} />
        <StatCard icon={Users} label="Total Tutors" value={initialTutors.length} />
        <StatCard icon={UserCircle} label="Total Parents" value={initialParents.length} />
        <StatCard icon={CalendarDays} label="Today's Classes" value={todayClasses.length} />
        <StatCard icon={Clock} label="Upcoming Classes" value={upcoming.length} />
        <StatCard icon={Wallet} label="Monthly Revenue" value={`$${revenue}`} accent={tokens.coralSoft} />
        <StatCard icon={AlertCircle} label="Pending Payments" value={pendingPay.length} accent={tokens.warnBg} />
        <StatCard icon={CheckCircle2} label="Completed Classes" value={completed.length} accent={tokens.successBg} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>Today's Class Schedule</div>
          {todayClasses.length === 0 && <div style={{ color: tokens.slate, fontSize: 13 }}>No classes scheduled for today.</div>}
          {todayClasses.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${tokens.line}` }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{findStudent(c.studentId).name} · {c.subject}</div>
                <div style={{ fontSize: 12, color: tokens.slate }}>{c.start}–{c.end} with {findTutor(c.tutorId).name}</div>
              </div>
              <Pill value={c.status} />
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>Pending Payments</div>
          {pendingPay.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${tokens.line}` }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{findStudent(p.studentId).name}</div>
                <div style={{ fontSize: 12, color: tokens.slate }}>Balance ${p.balance}</div>
              </div>
              <Pill value={p.status} />
            </div>
          ))}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>Recent Tutor Activity</div>
          {initialClasses.filter((c) => c.status === "Completed").slice(0, 4).map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${tokens.line}`, fontSize: 13 }}>
              <div>{findTutor(c.tutorId).name} completed <strong>{c.topic}</strong> with {findStudent(c.studentId).name}</div>
              <div style={{ color: tokens.slate }}>{c.date}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function StudentProfile({ student, onBack }) {
  const tutorNames = student.tutorIds.map((id) => findTutor(id).name).join(", ");
  const parent = findParent(student.parentId);
  const history = initialClasses.filter((c) => c.studentId === student.id);
  const hw = initialHomework.filter((h) => h.studentId === student.id);
  const notes = initialNotes.filter((n) => history.some((c) => c.id === n.classId));
  const pay = initialPayments.filter((p) => p.studentId === student.id);

  return (
    <div>
      <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: tokens.slate, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
        <ArrowLeft size={14} /> Back to Students
      </div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 700, color: tokens.tealDeep }}>
            {student.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 21, fontWeight: 600 }}>{student.name}</div>
            <div style={{ color: tokens.slate, fontSize: 13 }}>{student.grade} · Age {student.age} · {student.school}</div>
          </div>
          <Pill value={student.status} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 20 }}>
          <Field label="Curriculum"><div style={{ fontSize: 13.5 }}>{student.curriculum}</div></Field>
          <Field label="Subjects"><div style={{ fontSize: 13.5 }}>{student.subjects.join(", ")}</div></Field>
          <Field label="Assigned Tutor(s)"><div style={{ fontSize: 13.5 }}>{tutorNames}</div></Field>
          <Field label="Parent"><div style={{ fontSize: 13.5 }}>{parent?.name}</div></Field>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Learning Goals</div>
          <div style={{ fontSize: 13.5, color: tokens.ink, marginBottom: 12 }}>{student.goals}</div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: tokens.success, marginBottom: 4 }}>Strengths</div>
              <div style={{ fontSize: 13, color: tokens.slate }}>{student.strengths}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: tokens.coral, marginBottom: 4 }}>Weak Areas</div>
              <div style={{ fontSize: 13, color: tokens.slate }}>{student.weakAreas}</div>
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Payment Summary</div>
          {pay.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${tokens.line}`, fontSize: 13 }}>
              <div>{p.date} · ${p.total}</div>
              <Pill value={p.status} />
            </div>
          ))}
          {pay.length === 0 && <div style={{ fontSize: 13, color: tokens.slate }}>No payment records yet.</div>}
        </Card>
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Class History</div>
        <Table columns={["Date", "Subject", "Topic", "Tutor", "Status", "Attendance"]} rows={history.map((c) => ({ cells: [c.date, c.subject, c.topic, findTutor(c.tutorId).name, <Pill value={c.status} />, <Pill value={c.attendance} />] }))} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Homework</div>
          {hw.map((h) => (
            <div key={h.id} style={{ padding: "9px 0", borderBottom: `1px solid ${tokens.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{h.title}</div>
                <Pill value={h.status} />
              </div>
              <div style={{ fontSize: 12, color: tokens.slate }}>Due {h.due}</div>
            </div>
          ))}
          {hw.length === 0 && <div style={{ fontSize: 13, color: tokens.slate }}>No homework on record.</div>}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Progress Notes</div>
          {notes.map((n) => (
            <div key={n.id} style={{ padding: "9px 0", borderBottom: `1px solid ${tokens.line}` }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{n.topic}</div>
              <div style={{ fontSize: 12.5, color: tokens.slate, marginTop: 2 }}>{n.summary}</div>
            </div>
          ))}
          {notes.length === 0 && <div style={{ fontSize: 13, color: tokens.slate }}>No progress notes yet.</div>}
        </Card>
      </div>
    </div>
  );
}

function AdminUsers() {
  const { profile: myProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const updateRole = async (id, role) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (!error) loadUsers();
  };

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (!error) loadUsers();
  };

  const filtered = filter === "all" ? users : users.filter((u) => u.role === filter);
  const counts = { admin: 0, tutor: 0, parent: 0, student: 0, ...Object.fromEntries(["admin", "tutor", "parent", "student"].map((r) => [r, users.filter((u) => u.role === r).length])) };

  return (
    <div>
      <SectionTitle eyebrow="Account Management" title="All Users" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
        <StatCard icon={Shield} label="Admins" value={counts.admin} />
        <StatCard icon={Users} label="Tutors" value={counts.tutor} />
        <StatCard icon={UserCircle} label="Parents" value={counts.parent} />
        <StatCard icon={GraduationCap} label="Students" value={counts.student} />
      </div>

      {error && <ErrorNote message={error} />}

      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "admin", "tutor", "parent", "student"].map((f) => (
          <div key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: filter === f ? tokens.teal : tokens.tealSoft, color: filter === f ? "#fff" : tokens.tealDeep, textTransform: "capitalize" }}>
            {f}
          </div>
        ))}
      </Card>

      <Card>
        {loading ? (
          <div style={{ fontSize: 13, color: tokens.slate, padding: 8 }}>Loading users...</div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: tokens.slate, padding: 8 }}>No users in this category yet.</div>
        ) : (
          <Table
            columns={["Name", "Email", "Role", "Status", "Joined", "Actions"]}
            rows={filtered.map((u) => ({
              cells: [
                u.full_name,
                u.email,
                <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} disabled={u.id === myProfile?.id} style={{ ...inputStyle, padding: "5px 8px", width: 110 }}>
                  {["admin", "tutor", "parent", "student"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>,
                <Pill value={u.status === "Active" ? "Active" : "Pending"} />,
                new Date(u.created_at).toLocaleDateString(),
                <Button variant={u.status === "Active" ? "danger" : "secondary"} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => updateStatus(u.id, u.status === "Active" ? "Suspended" : "Active")} disabled={u.id === myProfile?.id}>
                  {u.status === "Active" ? "Suspend" : "Reactivate"}
                </Button>,
              ],
            }))}
          />
        )}
      </Card>
      <div style={{ fontSize: 11.5, color: tokens.slate, marginTop: 10 }}>Role and status changes apply immediately. You can't change your own role or status from here.</div>
    </div>
  );
}

function AdminStudents() {
  const [students, setStudents] = useState(initialStudents);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", age: "", grade: "", school: "", curriculum: CURRICULA[0], subjects: "", parentId: initialParents[0].id, tutorIds: [initialTutors[0].id] });
  const [search, setSearch] = useState("");

  if (selected) return <StudentProfile student={selected} onBack={() => setSelected(null)} />;

  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const addStudent = () => {
    const id = "s" + (students.length + 1) + Math.floor(Math.random() * 100);
    const newStu = { id, name: form.name || "Unnamed Student", age: Number(form.age) || 0, grade: form.grade, school: form.school, curriculum: form.curriculum, subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean), tutorIds: form.tutorIds, parentId: form.parentId, strengths: "", weakAreas: "", goals: "", status: "Active" };
    setStudents([newStu, ...students]);
    setShowAdd(false);
    setForm({ name: "", age: "", grade: "", school: "", curriculum: CURRICULA[0], subjects: "", parentId: initialParents[0].id, tutorIds: [initialTutors[0].id] });
  };

  return (
    <div>
      <SectionTitle title="Student Management" action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Add Student</Button>} />
      <Card style={{ marginBottom: 16, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={16} color={tokens.slate} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..." style={{ border: "none", outline: "none", fontSize: 13.5, flex: 1, background: "transparent" }} />
      </Card>
      <Card>
        <Table
          columns={["Name", "Grade", "Curriculum", "Subjects", "Tutor(s)", "Status", ""]}
          rows={filtered.map((s) => ({
            cells: [s.name, s.grade, s.curriculum, s.subjects.join(", "), s.tutorIds.map((id) => findTutor(id).name).join(", "), <Pill value={s.status} />, <ChevronRight size={15} color={tokens.slate} />],
            onClick: s,
          }))}
          onRowClick={(r) => setSelected(students.find((s) => s.name === r.cells[0]))}
        />
      </Card>

      {showAdd && (
        <Modal title="Add Student" onClose={() => setShowAdd(false)}>
          <Field label="Student Name"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Age"><input style={inputStyle} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></Field>
            <Field label="Grade / Year"><input style={inputStyle} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. Year 10" /></Field>
          </div>
          <Field label="School Name"><input style={inputStyle} value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} /></Field>
          <Field label="Curriculum / Syllabus">
            <select style={inputStyle} value={form.curriculum} onChange={(e) => setForm({ ...form, curriculum: e.target.value })}>
              {CURRICULA.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Subjects (comma separated)"><input style={inputStyle} value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Mathematics, Physics" /></Field>
          <Field label="Assign Parent">
            <select style={inputStyle} value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              {initialParents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Assign Tutor">
            <select style={inputStyle} value={form.tutorIds[0]} onChange={(e) => setForm({ ...form, tutorIds: [e.target.value] })}>
              {initialTutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={addStudent}>Save Student</Button>
        </Modal>
      )}
    </div>
  );
}

function AdminParents() {
  const [parents] = useState(initialParents);
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div>
      <SectionTitle title="Parent Management" action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Add Parent</Button>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {parents.map((p) => (
          <Card key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
              <Pill value={p.paymentStatus} />
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, fontSize: 12.5, color: tokens.slate }}><Phone size={13} /> {p.phone}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5, fontSize: 12.5, color: tokens.slate }}><Mail size={13} /> {p.email}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5, fontSize: 12.5, color: tokens.slate }}><HomeIcon size={13} /> {p.address}</div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${tokens.line}`, fontSize: 12.5 }}>
              <strong>Linked students:</strong> {p.studentIds.map((id) => findStudent(id).name).join(", ")}
            </div>
          </Card>
        ))}
      </div>
      {showAdd && (
        <Modal title="Add Parent" onClose={() => setShowAdd(false)}>
          <Field label="Parent Name"><input style={inputStyle} placeholder="Full name" /></Field>
          <Field label="Phone Number"><input style={inputStyle} placeholder="+974 ..." /></Field>
          <Field label="Email"><input style={inputStyle} placeholder="email@example.com" /></Field>
          <Field label="Address"><input style={inputStyle} placeholder="Area, City" /></Field>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => setShowAdd(false)}>Save Parent</Button>
        </Modal>
      )}
    </div>
  );
}

function AdminTutors() {
  const [tutors] = useState(initialTutors);
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div>
      <SectionTitle title="Tutor Management" action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Add Tutor</Button>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {tutors.map((t) => {
          const assigned = initialStudents.filter((s) => s.tutorIds.includes(t.id));
          const completed = initialClasses.filter((c) => c.tutorId === t.id && c.status === "Completed").length;
          const upcoming = initialClasses.filter((c) => c.tutorId === t.id && c.status === "Scheduled").length;
          return (
            <Card key={t.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                <Pill value={t.status} />
              </div>
              <div style={{ fontSize: 12.5, color: tokens.slate, marginTop: 4 }}>{t.subjects.join(", ")}</div>
              <div style={{ fontSize: 12, color: tokens.slate }}>{t.curriculum.join(", ")}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12.5 }}>
                <div><strong>${t.rate}</strong>/hr</div>
                <div><strong>{assigned.length}</strong> students</div>
                <div><strong>{completed}</strong> completed</div>
                <div><strong>{upcoming}</strong> upcoming</div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${tokens.line}`, fontSize: 12.5, color: tokens.slate }}>{t.notes}</div>
            </Card>
          );
        })}
      </div>
      {showAdd && (
        <Modal title="Add Tutor" onClose={() => setShowAdd(false)}>
          <Field label="Tutor Name"><input style={inputStyle} placeholder="Full name" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Email"><input style={inputStyle} placeholder="email@example.com" /></Field>
            <Field label="Phone"><input style={inputStyle} placeholder="+974 ..." /></Field>
          </div>
          <Field label="Subjects (comma separated)"><input style={inputStyle} placeholder="Mathematics, Physics" /></Field>
          <Field label="Hourly Rate ($)"><input style={inputStyle} placeholder="45" /></Field>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => setShowAdd(false)}>Save Tutor</Button>
        </Modal>
      )}
    </div>
  );
}

function AdminClasses() {
  const [classes] = useState(initialClasses);
  const [view, setView] = useState("list");
  const [showAdd, setShowAdd] = useState(false);

  const days = [...new Set(classes.map((c) => c.date))].sort();

  return (
    <div>
      <SectionTitle title="Class Scheduling" action={
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant={view === "list" ? "primary" : "ghost"} onClick={() => setView("list")}>List</Button>
          <Button variant={view === "calendar" ? "primary" : "ghost"} onClick={() => setView("calendar")}>Calendar</Button>
          <Button icon={Plus} onClick={() => setShowAdd(true)}>Create Class</Button>
        </div>
      } />
      {view === "list" ? (
        <Card>
          <Table
            columns={["Date", "Student", "Tutor", "Subject", "Topic", "Time", "Mode", "Status", "Payment"]}
            rows={classes.map((c) => ({ cells: [c.date, findStudent(c.studentId).name, findTutor(c.tutorId).name, c.subject, c.topic, `${c.start}–${c.end}`, c.mode === "Online" ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Video size={13} /> Online</span> : <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> Offline</span>, <Pill value={c.status} />, <Pill value={c.payment} />] }))}
          />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {days.map((d) => (
            <Card key={d}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>{d}</div>
              {classes.filter((c) => c.date === d).map((c) => (
                <div key={c.id} style={{ padding: "8px 10px", borderRadius: 9, background: tokens.tealSoft, marginBottom: 7 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.start} · {c.subject}</div>
                  <div style={{ fontSize: 11.5, color: tokens.slate }}>{findStudent(c.studentId).name} · {findTutor(c.tutorId).name}</div>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
      {showAdd && (
        <Modal title="Create Class" wide onClose={() => setShowAdd(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Student"><select style={inputStyle}>{initialStudents.map((s) => <option key={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Tutor"><select style={inputStyle}>{initialTutors.map((t) => <option key={t.id}>{t.name}</option>)}</select></Field>
            <Field label="Subject"><select style={inputStyle}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Topic"><input style={inputStyle} placeholder="e.g. Algebraic fractions" /></Field>
            <Field label="Date"><input style={inputStyle} type="date" defaultValue="2026-06-22" /></Field>
            <Field label="Duration (min)"><input style={inputStyle} placeholder="60" /></Field>
            <Field label="Start Time"><input style={inputStyle} type="time" defaultValue="16:00" /></Field>
            <Field label="End Time"><input style={inputStyle} type="time" defaultValue="17:00" /></Field>
            <Field label="Mode"><select style={inputStyle}><option>Online</option><option>Offline</option></select></Field>
            <Field label="Meeting Link / Location"><input style={inputStyle} placeholder="meet.learnwise.edu/..." /></Field>
          </div>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => setShowAdd(false)}>Schedule Class</Button>
        </Modal>
      )}
    </div>
  );
}

function AdminAttendance() {
  const [classes, setClasses] = useState(initialClasses);
  const setAtt = (id, val) => setClasses(classes.map((c) => (c.id === id ? { ...c, attendance: val } : c)));
  const options = ["Present", "Absent", "Cancelled", "Rescheduled"];
  return (
    <div>
      <SectionTitle title="Attendance" />
      <Card>
        <Table
          columns={["Date", "Student", "Tutor", "Subject", "Attendance"]}
          rows={classes.map((c) => ({
            cells: [c.date, findStudent(c.studentId).name, findTutor(c.tutorId).name, c.subject,
              <select value={c.attendance === "—" ? "" : c.attendance} onChange={(e) => setAtt(c.id, e.target.value)} style={{ ...inputStyle, padding: "5px 8px", width: 150 }}>
                <option value="">— Select —</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>],
          }))}
        />
      </Card>
    </div>
  );
}

function AdminHomework() {
  const [hw, setHw] = useState(initialHomework);
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div>
      <SectionTitle title="Homework" action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Add Homework</Button>} />
      <Card>
        <Table
          columns={["Title", "Student", "Tutor", "Due Date", "Status", "File"]}
          rows={hw.map((h) => ({ cells: [h.title, findStudent(h.studentId).name, findTutor(h.tutorId).name, h.due, <Pill value={h.status} />, h.file ? <span style={{ display: "flex", alignItems: "center", gap: 4, color: tokens.teal }}><FileText size={13} /> {h.file}</span> : "—"] }))}
        />
      </Card>
      {showAdd && (
        <Modal title="Add Homework" onClose={() => setShowAdd(false)}>
          <Field label="Title"><input style={inputStyle} placeholder="Homework title" /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 70 }} placeholder="Instructions..." /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Student"><select style={inputStyle}>{initialStudents.map((s) => <option key={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Due Date"><input style={inputStyle} type="date" /></Field>
          </div>
          <Field label="Attach file or link"><input style={inputStyle} placeholder="Paste a link or filename" /></Field>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => setShowAdd(false)}>Save Homework</Button>
        </Modal>
      )}
    </div>
  );
}

function AdminPayments() {
  const [payments] = useState(initialPayments);
  const [showAdd, setShowAdd] = useState(false);
  const revenue = payments.reduce((s, p) => s + p.paid, 0);
  const pending = payments.reduce((s, p) => s + p.balance, 0);
  return (
    <div>
      <SectionTitle title="Payment Management" action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Record Payment</Button>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
        <StatCard icon={Wallet} label="Total Collected" value={`$${revenue}`} accent={tokens.successBg} />
        <StatCard icon={AlertCircle} label="Outstanding Balance" value={`$${pending}`} accent={tokens.warnBg} />
        <StatCard icon={FileText} label="Invoices Issued" value={payments.length} />
      </div>
      <Card>
        <Table
          columns={["Date", "Student", "Parent", "Tutor", "Hours", "Rate", "Total", "Paid", "Balance", "Method", "Status", ""]}
          rows={payments.map((p) => ({ cells: [p.date, findStudent(p.studentId).name, findParent(p.parentId).name, findTutor(p.tutorId).name, p.hours, `$${p.rate}`, `$${p.total}`, `$${p.paid}`, `$${p.balance}`, p.method, <Pill value={p.status} />, <Button variant="ghost" icon={Download} onClick={() => {}}>Invoice</Button>] }))}
        />
      </Card>
      {showAdd && (
        <Modal title="Record Payment" onClose={() => setShowAdd(false)}>
          <Field label="Student"><select style={inputStyle}>{initialStudents.map((s) => <option key={s.id}>{s.name}</option>)}</select></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Hours"><input style={inputStyle} placeholder="1" /></Field>
            <Field label="Rate ($)"><input style={inputStyle} placeholder="45" /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Amount Paid ($)"><input style={inputStyle} placeholder="45" /></Field>
            <Field label="Method"><select style={inputStyle}><option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Online</option></select></Field>
          </div>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => setShowAdd(false)}>Save Payment</Button>
        </Modal>
      )}
    </div>
  );
}

function AdminReports() {
  const reports = [
    { title: "Student Progress Report", desc: "Understanding levels and tutor recommendations across all students.", icon: TrendingUp },
    { title: "Attendance Report", desc: "Presence, absence and rescheduling patterns by student and tutor.", icon: ClipboardCheck },
    { title: "Monthly Income Report", desc: "Revenue collected by subject, tutor and payment method.", icon: Wallet },
    { title: "Pending Payment Report", desc: "Outstanding balances grouped by parent and due date.", icon: AlertCircle },
    { title: "Tutor Performance Report", desc: "Completed classes, ratings and student outcomes per tutor.", icon: Award },
    { title: "Class Completion Report", desc: "Scheduled vs completed vs cancelled classes over time.", icon: CheckCircle2 },
    { title: "Subject-wise Report", desc: "Enrolment and performance breakdown across every subject.", icon: BookOpen },
  ];
  return (
    <div>
      <SectionTitle title="Reports" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {reports.map((r) => (
          <Card key={r.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: tokens.tealSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><r.icon size={17} color={tokens.tealDeep} /></div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.title}</div>
            <div style={{ fontSize: 12.5, color: tokens.slate, flex: 1 }}>{r.desc}</div>
            <Button variant="secondary" icon={Download}>Generate</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminSettings() {
  return (
    <div>
      <SectionTitle title="Settings" />
      <Card style={{ maxWidth: 520 }}>
        <Field label="Academy Name"><input style={inputStyle} defaultValue="LearnWise Academy" /></Field>
        <Field label="Tagline"><input style={inputStyle} defaultValue="Smart Guidance. Better Learning." /></Field>
        <Field label="Support Email"><input style={inputStyle} defaultValue="support@learnwise.edu" /></Field>
        <Field label="Default Currency"><select style={inputStyle}><option>USD ($)</option><option>QAR</option><option>GBP (£)</option></select></Field>
        <Button>Save Changes</Button>
      </Card>
    </div>
  );
}

/* ---------------------- Tutor Views ---------------------- */

function TutorDashboard({ tutorId }) {
  const myClasses = initialClasses.filter((c) => c.tutorId === tutorId);
  const today = myClasses.filter((c) => c.date === "2026-06-21");
  const upcoming = myClasses.filter((c) => c.date > "2026-06-21" && c.status === "Scheduled");
  const completed = myClasses.filter((c) => c.status === "Completed");
  const myStudentIds = [...new Set(myClasses.map((c) => c.studentId))];
  const pendingHw = initialHomework.filter((h) => h.tutorId === tutorId && h.status === "Submitted");

  return (
    <div>
      <SectionTitle eyebrow="Welcome back" title={findTutor(tutorId).name} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard icon={CalendarDays} label="Today's Classes" value={today.length} />
        <StatCard icon={Clock} label="Upcoming Classes" value={upcoming.length} />
        <StatCard icon={GraduationCap} label="Assigned Students" value={myStudentIds.length} />
        <StatCard icon={BookOpenCheck} label="Homework to Review" value={pendingHw.length} accent={tokens.coralSoft} />
      </div>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>Today's Classes</div>
        {today.length === 0 && <div style={{ fontSize: 13, color: tokens.slate }}>No classes today — enjoy the breather.</div>}
        {today.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${tokens.line}` }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{findStudent(c.studentId).name} · {c.subject}</div>
              <div style={{ fontSize: 12, color: tokens.slate }}>{c.start}–{c.end} · {c.topic}</div>
            </div>
            <Pill value={c.status} />
          </div>
        ))}
      </Card>
    </div>
  );
}

function TutorMyClasses({ tutorId }) {
  const myClasses = initialClasses.filter((c) => c.tutorId === tutorId);
  return (
    <div>
      <SectionTitle title="My Classes" />
      <Card>
        <Table columns={["Date", "Student", "Subject", "Topic", "Time", "Mode", "Status"]} rows={myClasses.map((c) => ({ cells: [c.date, findStudent(c.studentId).name, c.subject, c.topic, `${c.start}–${c.end}`, c.mode, <Pill value={c.status} />] }))} />
      </Card>
    </div>
  );
}

function TutorMyStudents({ tutorId }) {
  const myStudents = initialStudents.filter((s) => s.tutorIds.includes(tutorId));
  return (
    <div>
      <SectionTitle title="My Students" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {myStudents.map((s) => (
          <Card key={s.id}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
            <div style={{ fontSize: 12.5, color: tokens.slate, marginTop: 3 }}>{s.grade} · {s.curriculum}</div>
            <div style={{ marginTop: 10, fontSize: 12.5 }}><strong>Subjects:</strong> {s.subjects.join(", ")}</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: tokens.success }}><strong>Strengths:</strong> {s.strengths}</div>
            <div style={{ marginTop: 4, fontSize: 12.5, color: tokens.coral }}><strong>Focus areas:</strong> {s.weakAreas}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TutorClassNotes({ tutorId }) {
  const [notes, setNotes] = useState(initialNotes);
  const [showAdd, setShowAdd] = useState(false);
  const myClasses = initialClasses.filter((c) => c.tutorId === tutorId);
  return (
    <div>
      <SectionTitle title="Class Notes" action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Add Note</Button>} />
      {notes.filter((n) => myClasses.some((c) => c.id === n.classId)).map((n) => {
        const cls = myClasses.find((c) => c.id === n.classId);
        return (
          <Card key={n.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{n.topic}</div>
              <div style={{ fontSize: 12, color: tokens.slate }}>{cls?.date}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div style={{ fontSize: 12.5 }}><strong>Understanding:</strong> {n.understanding}</div>
              <div style={{ fontSize: 12.5 }}><strong>Strengths:</strong> {n.strengths}</div>
              <div style={{ fontSize: 12.5 }}><strong>To improve:</strong> {n.improvement}</div>
              <div style={{ fontSize: 12.5 }}><strong>Recommendation:</strong> {n.recommendation}</div>
            </div>
            <div style={{ marginTop: 10, padding: 12, background: tokens.tealSoft, borderRadius: 10, fontSize: 12.5, fontStyle: "italic" }}>"{n.summary}"</div>
          </Card>
        );
      })}
      {showAdd && (
        <Modal title="Add Progress Note" wide onClose={() => setShowAdd(false)}>
          <Field label="Class"><select style={inputStyle}>{myClasses.map((c) => <option key={c.id}>{findStudent(c.studentId).name} — {c.topic}</option>)}</select></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Student Understanding"><select style={inputStyle}><option>Excellent</option><option>Good</option><option>Fair</option><option>Needs Support</option></select></Field>
            <Field label="Topic Covered"><input style={inputStyle} placeholder="Topic" /></Field>
          </div>
          <Field label="Strengths Shown"><input style={inputStyle} placeholder="..." /></Field>
          <Field label="Areas Needing Improvement"><input style={inputStyle} placeholder="..." /></Field>
          <Field label="Tutor Recommendation"><input style={inputStyle} placeholder="..." /></Field>
          <Field label="Parent-Friendly Summary"><textarea style={{ ...inputStyle, minHeight: 70 }} placeholder="A plain-language summary for parents..." /></Field>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => setShowAdd(false)}>Save Note</Button>
        </Modal>
      )}
    </div>
  );
}

function TutorHomework({ tutorId }) {
  const [hw] = useState(initialHomework.filter((h) => h.tutorId === tutorId));
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div>
      <SectionTitle title="Homework" action={<Button icon={Plus} onClick={() => setShowAdd(true)}>Assign Homework</Button>} />
      <Card>
        <Table columns={["Title", "Student", "Due", "Status"]} rows={hw.map((h) => ({ cells: [h.title, findStudent(h.studentId).name, h.due, <Pill value={h.status} />] }))} />
      </Card>
      {showAdd && (
        <Modal title="Assign Homework" onClose={() => setShowAdd(false)}>
          <Field label="Title"><input style={inputStyle} /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 60 }} /></Field>
          <Field label="Due Date"><input style={inputStyle} type="date" /></Field>
          <Button style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => setShowAdd(false)}>Assign</Button>
        </Modal>
      )}
    </div>
  );
}

function TutorMaterials({ tutorId }) {
  const materials = [
    { title: "IGCSE Algebra Formula Sheet", subject: "Mathematics", type: "PDF" },
    { title: "Organic Chemistry Reaction Map", subject: "Chemistry", type: "PDF" },
    { title: "Essay Structuring Template", subject: "English", type: "Doc" },
  ];
  return (
    <div>
      <SectionTitle title="Study Materials" action={<Button icon={Plus}>Upload Material</Button>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {materials.map((m, i) => (
          <Card key={i}>
            <FileText size={20} color={tokens.teal} />
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 10 }}>{m.title}</div>
            <div style={{ fontSize: 12, color: tokens.slate, marginTop: 4 }}>{m.subject} · {m.type}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------- Parent Views ---------------------- */

function ParentDashboard({ parentId }) {
  const parent = findParent(parentId);
  const children = initialStudents.filter((s) => parent.studentIds.includes(s.id));
  return (
    <div>
      <SectionTitle eyebrow="Welcome" title={parent.name} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {children.map((c) => {
          const upcoming = initialClasses.filter((cl) => cl.studentId === c.id && cl.status === "Scheduled");
          const pay = initialPayments.filter((p) => p.studentId === c.id);
          const balance = pay.reduce((s, p) => s + p.balance, 0);
          return (
            <Card key={c.id}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
              <div style={{ fontSize: 12.5, color: tokens.slate, marginBottom: 10 }}>{c.grade} · {c.curriculum}</div>
              <div style={{ display: "flex", gap: 18 }}>
                <div><div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>{upcoming.length}</div><div style={{ fontSize: 11.5, color: tokens.slate }}>Upcoming</div></div>
                <div><div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: balance > 0 ? tokens.coral : tokens.success }}>${balance}</div><div style={{ fontSize: 11.5, color: tokens.slate }}>Balance</div></div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ParentChild({ parentId }) {
  const parent = findParent(parentId);
  const children = initialStudents.filter((s) => parent.studentIds.includes(s.id));
  return (
    <div>
      <SectionTitle title="My Child" />
      {children.map((c) => (
        <Card key={c.id} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{c.name}</div>
          <div style={{ fontSize: 13, color: tokens.slate, marginBottom: 12 }}>{c.grade} · {c.school} · {c.curriculum}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ fontSize: 13 }}><strong style={{ color: tokens.success }}>Strengths:</strong> {c.strengths}</div>
            <div style={{ fontSize: 13 }}><strong style={{ color: tokens.coral }}>Focus areas:</strong> {c.weakAreas}</div>
          </div>
          <div style={{ marginTop: 10, fontSize: 13 }}><strong>Goal:</strong> {c.goals}</div>
        </Card>
      ))}
    </div>
  );
}

function ParentClasses({ parentId }) {
  const parent = findParent(parentId);
  const classes = initialClasses.filter((c) => parent.studentIds.includes(c.studentId));
  return (
    <div>
      <SectionTitle title="Classes" />
      <Card>
        <Table columns={["Date", "Child", "Subject", "Tutor", "Time", "Mode", "Status"]} rows={classes.map((c) => ({ cells: [c.date, findStudent(c.studentId).name, c.subject, findTutor(c.tutorId).name, `${c.start}–${c.end}`, c.mode, <Pill value={c.status} />] }))} />
      </Card>
    </div>
  );
}

function ParentHomework({ parentId }) {
  const parent = findParent(parentId);
  const hw = initialHomework.filter((h) => parent.studentIds.includes(h.studentId));
  return (
    <div>
      <SectionTitle title="Homework" />
      <Card>
        <Table columns={["Title", "Child", "Due", "Status"]} rows={hw.map((h) => ({ cells: [h.title, findStudent(h.studentId).name, h.due, <Pill value={h.status} />] }))} />
      </Card>
    </div>
  );
}

function ParentProgress({ parentId }) {
  const parent = findParent(parentId);
  const classes = initialClasses.filter((c) => parent.studentIds.includes(c.studentId));
  const notes = initialNotes.filter((n) => classes.some((c) => c.id === n.classId));
  return (
    <div>
      <SectionTitle title="Progress Updates" />
      {notes.map((n) => {
        const cls = classes.find((c) => c.id === n.classId);
        return (
          <Card key={n.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{findStudent(cls.studentId).name} · {n.topic}</div>
              <div style={{ fontSize: 12, color: tokens.slate }}>{cls.date}</div>
            </div>
            <div style={{ marginTop: 10, padding: 12, background: tokens.tealSoft, borderRadius: 10, fontSize: 13, fontStyle: "italic" }}>"{n.summary}"</div>
          </Card>
        );
      })}
      {notes.length === 0 && <div style={{ fontSize: 13, color: tokens.slate }}>No progress updates yet.</div>}
    </div>
  );
}

function ParentPayments({ parentId }) {
  const payments = initialPayments.filter((p) => p.parentId === parentId);
  return (
    <div>
      <SectionTitle title="Payments" />
      <Card>
        <Table columns={["Date", "Child", "Total", "Paid", "Balance", "Status", ""]} rows={payments.map((p) => ({ cells: [p.date, findStudent(p.studentId).name, `$${p.total}`, `$${p.paid}`, `$${p.balance}`, <Pill value={p.status} />, <Button variant="ghost" icon={Download}>Receipt</Button>] }))} />
      </Card>
    </div>
  );
}

/* ---------------------- Student Views ---------------------- */

function StudentDashboard({ studentId }) {
  const s = findStudent(studentId);
  const upcoming = initialClasses.filter((c) => c.studentId === studentId && c.status === "Scheduled");
  const hw = initialHomework.filter((h) => h.studentId === studentId && h.status === "Pending");
  return (
    <div>
      <SectionTitle eyebrow="Hi there" title={s.name} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }}>
        <StatCard icon={CalendarDays} label="Upcoming Classes" value={upcoming.length} />
        <StatCard icon={BookOpenCheck} label="Homework Due" value={hw.length} accent={tokens.coralSoft} />
        <StatCard icon={Target} label="Subjects" value={s.subjects.length} />
      </div>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14.5 }}>Next Up</div>
        {upcoming.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${tokens.line}` }}>
            <div style={{ fontSize: 13.5 }}>{c.subject} · {c.topic}</div>
            <div style={{ fontSize: 12, color: tokens.slate }}>{c.date}, {c.start}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function StudentClasses({ studentId }) {
  const classes = initialClasses.filter((c) => c.studentId === studentId);
  return (
    <div>
      <SectionTitle title="My Classes" />
      <Card><Table columns={["Date", "Subject", "Topic", "Tutor", "Time", "Status"]} rows={classes.map((c) => ({ cells: [c.date, c.subject, c.topic, findTutor(c.tutorId).name, `${c.start}–${c.end}`, <Pill value={c.status} />] }))} /></Card>
    </div>
  );
}

function StudentHomework({ studentId }) {
  const hw = initialHomework.filter((h) => h.studentId === studentId);
  return (
    <div>
      <SectionTitle title="Homework" />
      <Card><Table columns={["Title", "Due", "Status"]} rows={hw.map((h) => ({ cells: [h.title, h.due, <Pill value={h.status} />] }))} /></Card>
    </div>
  );
}

function StudentMaterials() {
  const materials = ["IGCSE Algebra Formula Sheet", "Forces & Motion Recap Notes", "Essay Structuring Template"];
  return (
    <div>
      <SectionTitle title="Study Materials" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {materials.map((m, i) => (
          <Card key={i}><FileText size={20} color={tokens.teal} /><div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 10 }}>{m}</div></Card>
        ))}
      </div>
    </div>
  );
}

function StudentProgress({ studentId }) {
  const s = findStudent(studentId);
  const classes = initialClasses.filter((c) => c.studentId === studentId);
  const notes = initialNotes.filter((n) => classes.some((c) => c.id === n.classId));
  return (
    <div>
      <SectionTitle title="My Progress" />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>Goal</div>
        <div style={{ fontSize: 13.5 }}>{s.goals}</div>
      </Card>
      {notes.map((n) => (
        <Card key={n.id} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{n.topic}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: tokens.slate }}>{n.summary}</div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------------- App Root ---------------------- */

export default function App() {
  const { user, profile, loading, signOut } = useAuth();
  const [authScreen, setAuthScreen] = useState("signin"); // "signin" | "signup" | "staff"
  const [current, setCurrent] = useState("dashboard");

  const who = profile?.full_name || "";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: tokens.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: tokens.slate, fontSize: 13 }}>
        <link rel="stylesheet" href={FONT_LINK} />
        Loading LearnWise Academy...
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <>
        <link rel="stylesheet" href={FONT_LINK} />
        {authScreen === "staff" && <StaffLogin onBack={() => setAuthScreen("signin")} />}
        {authScreen === "signup" && <SignUp onGoSignIn={() => setAuthScreen("signin")} />}
        {authScreen === "signin" && <SignIn onGoSignUp={() => setAuthScreen("signup")} onGoStaff={() => setAuthScreen("staff")} />}
      </>
    );
  }

  const role = profile.role;

  const renderAdmin = () => {
    switch (current) {
      case "dashboard": return <AdminDashboard />;
      case "users": return <AdminUsers />;
      case "students": return <AdminStudents />;
      case "parents": return <AdminParents />;
      case "tutors": return <AdminTutors />;
      case "classes": return <AdminClasses />;
      case "attendance": return <AdminAttendance />;
      case "homework": return <AdminHomework />;
      case "payments": return <AdminPayments />;
      case "reports": return <AdminReports />;
      case "settings": return <AdminSettings />;
      default: return null;
    }
  };
  const renderTutor = () => {
    switch (current) {
      case "dashboard": return <TutorDashboard tutorId="t1" />;
      case "myclasses": return <TutorMyClasses tutorId="t1" />;
      case "mystudents": return <TutorMyStudents tutorId="t1" />;
      case "classnotes": return <TutorClassNotes tutorId="t1" />;
      case "homework": return <TutorHomework tutorId="t1" />;
      case "materials": return <TutorMaterials tutorId="t1" />;
      default: return null;
    }
  };
  const renderParent = () => {
    switch (current) {
      case "dashboard": return <ParentDashboard parentId="p1" />;
      case "mychild": return <ParentChild parentId="p1" />;
      case "classes": return <ParentClasses parentId="p1" />;
      case "homework": return <ParentHomework parentId="p1" />;
      case "progress": return <ParentProgress parentId="p1" />;
      case "payments": return <ParentPayments parentId="p1" />;
      default: return null;
    }
  };
  const renderStudent = () => {
    switch (current) {
      case "dashboard": return <StudentDashboard studentId="s1" />;
      case "myclasses": return <StudentClasses studentId="s1" />;
      case "homework": return <StudentHomework studentId="s1" />;
      case "materials": return <StudentMaterials />;
      case "progress": return <StudentProgress studentId="s1" />;
      default: return null;
    }
  };

  const renderers = { admin: renderAdmin, tutor: renderTutor, parent: renderParent, student: renderStudent };

  return (
    <>
      <link rel="stylesheet" href={FONT_LINK} />
      <Shell role={role} current={current} setCurrent={setCurrent} onLogout={signOut} who={who}>
        {renderers[role]()}
      </Shell>
    </>
  );
}
