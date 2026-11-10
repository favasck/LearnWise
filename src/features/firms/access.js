export const PERMISSIONS={view_roster:'View students and parents',manage_roster:'Add and manage students and parents',manage_tutors:'Manage tutors',manage_academic:'Manage lessons and academic work',view_billing:'View billing',issue_invoices:'Create and issue invoices',record_payments:'Record payments',void_invoices:'Void unpaid invoices',correct_payments:'Correct payments with a reason'};
const requirements={students:['view_roster','manage_roster'],parents:['view_roster','manage_roster'],tutors:['view_roster','manage_tutors'],classes:['manage_academic'],attendance:['manage_academic'],homework:['manage_academic'],classnotes:['manage_academic'],materials:['manage_academic'],assessments:['manage_roster'],payments:['view_billing','issue_invoices','record_payments','void_invoices','correct_payments']};
export function allows(context,permission){return context?.role==='super_admin'||context?.permissions?.includes(permission)||false;}
export function visibleSection(context,key){
 if(key==='qatest')return false;
 if(context?.role==='super_admin')return true;
 if(context?.role!=='admin')return !['users','settings','auditlogs'].includes(key);
 if(['users','settings','auditlogs','reports','dashboard'].includes(key))return false;
 return requirements[key]?.some(p=>allows(context,p))||false;
}
export function effectiveRole(context){return context?.role==='admin'?'admin_tutor':context?.role;}
