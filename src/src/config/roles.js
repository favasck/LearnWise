// ============================================================
// LearnWise Academy — Central Role Configuration
// src/config/roles.js
// ============================================================
// Single source of truth for:
//   - Role constants
//   - Role display labels
//   - Permission checks
//   - Navigation definitions per role
//   - Actions that require a reason (admin_tutor sensitive ops)
// ============================================================

// ── Role constants ────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN:  "super_admin",
  ADMIN_TUTOR:  "admin_tutor",
  TUTOR:        "tutor",
  PARENT:       "parent",
  STUDENT:      "student",
};

// ── Display labels ────────────────────────────────────────────
export const ROLE_LABEL = {
  super_admin: "Super Admin",
  admin_tutor: "Admin Tutor",
  tutor:       "Tutor",
  parent:      "Parent",
  student:     "Student",
};

// ── Staff roles (can log into admin-style portals) ────────────
export const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_TUTOR];

// ── All valid roles ───────────────────────────────────────────
export const ALL_ROLES = Object.values(ROLES);

// ── Roles shown in the signup form ───────────────────────────
export const SIGNUP_ROLES = [ROLES.TUTOR, ROLES.PARENT, ROLES.STUDENT];

// ── Roles that require a linked profile record ────────────────
// (admin_tutor is staff — no separate tutor record needed unless they
//  also teach, in which case an admin links them manually)
export const LINKED_ROLES = [ROLES.TUTOR, ROLES.PARENT, ROLES.STUDENT];


// ============================================================
// PERMISSION HELPERS
// All take a profile object (or role string) as argument.
// ============================================================

// Get role string safely from a profile object or raw string
const r = (profileOrRole) =>
  typeof profileOrRole === "string" ? profileOrRole : profileOrRole?.role;

export const isSuperAdmin  = (p) => r(p) === ROLES.SUPER_ADMIN;
export const isAdminTutor  = (p) => r(p) === ROLES.ADMIN_TUTOR;
export const isStaff       = (p) => STAFF_ROLES.includes(r(p));
export const isTutor       = (p) => r(p) === ROLES.TUTOR;
export const isParent      = (p) => r(p) === ROLES.PARENT;
export const isStudent     = (p) => r(p) === ROLES.STUDENT;

// Academic management — both staff roles
export const canManageAcademic  = (p) => isStaff(p);

// Payment management — both staff roles (with audit logging for admin_tutor)
export const canManagePayments  = (p) => isStaff(p);

// Dangerous actions — super_admin only
export const canDelete          = (p) => isSuperAdmin(p);
export const canChangeRoles     = (p) => isSuperAdmin(p);
export const canAccessSettings  = (p) => isSuperAdmin(p);
export const canViewAuditLogs   = (p) => isSuperAdmin(p);
export const canPermanentDelete = (p) => isSuperAdmin(p);

// Tutor assignment — both staff roles
export const canAssignTutors    = (p) => isStaff(p);


// ============================================================
// ACTIONS REQUIRING A REASON (admin_tutor sensitive ops)
// Used to show a reason modal before proceeding.
// Super admin is exempt — they can act without a reason,
// but a reason is still recommended for audit clarity.
// ============================================================
export const REASON_REQUIRED_ACTIONS = {
  EDIT_INVOICE:          "edit_invoice",
  VOID_INVOICE:          "void_invoice",
  EDIT_PAYMENT:          "edit_payment",
  PAYMENT_CORRECTION:    "payment_correction",
  PAYMENT_REVERSAL:      "payment_reversal",
  DEACTIVATE_STUDENT:    "deactivate_student",
  DEACTIVATE_PARENT:     "deactivate_parent",
  DEACTIVATE_TUTOR:      "deactivate_tutor",
  CHANGE_TUTOR_ASSIGN:   "change_tutor_assignment",
  CANCEL_SCHEDULED_CLASS:"cancel_scheduled_class",
};

// Returns true if this action requires a reason from admin_tutor
export const requiresReason = (profile, action) => {
  if (isSuperAdmin(profile)) return false; // super_admin never blocked
  if (!isAdminTutor(profile)) return false; // non-staff don't reach this check
  return Object.values(REASON_REQUIRED_ACTIONS).includes(action);
};


// ============================================================
// NAVIGATION DEFINITIONS
// Each role has its own nav array.
// Icons are passed as strings and mapped in App.jsx
// (to avoid importing lucide-react here).
// ============================================================

export const NAV_KEYS = {
  // Shared
  DASHBOARD:    "dashboard",

  // Super admin / Admin Tutor
  USERS:        "users",
  STUDENTS:     "students",
  PARENTS:      "parents",
  TUTORS:       "tutors",
  CLASSES:      "classes",
  ATTENDANCE:   "attendance",
  HOMEWORK:     "homework",
  CLASSNOTES:   "classnotes",
  MATERIALS:    "materials",
  PAYMENTS:     "payments",
  ASSESSMENTS:  "assessments",
  REPORTS:      "reports",
  AUDIT_LOGS:   "auditlogs",
  SETTINGS:     "settings",
  QA_TEST:      "qatest",

  // Tutor
  MY_CLASSES:   "myclasses",
  MY_STUDENTS:  "mystudents",

  // Parent
  MY_CHILD:     "mychild",
  PROGRESS:     "progress",

  // Student
  MY_CLASSES_S: "myclasses",
};

// Super Admin — full access including settings, audit logs, delete
export const NAV_SUPER_ADMIN = [
  { key: "dashboard",   label: "Dashboard",         icon: "LayoutDashboard" },
  { key: "users",       label: "All Users",          icon: "Shield"          },
  { key: "students",    label: "Students",           icon: "GraduationCap"   },
  { key: "parents",     label: "Parents",            icon: "UserCircle"      },
  { key: "tutors",      label: "Tutors",             icon: "Users"           },
  { key: "classes",     label: "Classes",            icon: "CalendarDays"    },
  { key: "attendance",  label: "Attendance",         icon: "ClipboardCheck"  },
  { key: "homework",    label: "Homework",           icon: "BookOpenCheck"   },
  { key: "classnotes",  label: "Class Notes",        icon: "FileText"        },
  { key: "materials",   label: "Materials",          icon: "BookOpen"        },
  { key: "payments",    label: "Payments",           icon: "Wallet"          },
  { key: "assessments", label: "Requests",           icon: "CheckSquare"     },
  { key: "reports",     label: "Reports",            icon: "FileBarChart"    },
  { key: "auditlogs",   label: "Audit Logs",         icon: "ScrollText"      },
  { key: "settings",    label: "Settings",           icon: "Settings"        },
  { key: "qatest",      label: "QA Test",            icon: "FlaskConical"    },
];

// Admin Tutor — no settings, no audit logs, no delete actions
export const NAV_ADMIN_TUTOR = [
  { key: "dashboard",   label: "Dashboard",         icon: "LayoutDashboard" },
  { key: "students",    label: "Students",           icon: "GraduationCap"   },
  { key: "parents",     label: "Parents",            icon: "UserCircle"      },
  { key: "tutors",      label: "Tutors",             icon: "Users"           },
  { key: "classes",     label: "Classes",            icon: "CalendarDays"    },
  { key: "attendance",  label: "Attendance",         icon: "ClipboardCheck"  },
  { key: "homework",    label: "Homework",           icon: "BookOpenCheck"   },
  { key: "classnotes",  label: "Class Notes",        icon: "FileText"        },
  { key: "materials",   label: "Materials",          icon: "BookOpen"        },
  { key: "payments",    label: "Payments",           icon: "Wallet"          },
  { key: "assessments", label: "Requests",           icon: "CheckSquare"     },
  { key: "reports",     label: "Reports",            icon: "FileBarChart"    },
];

// Tutor — own data only
export const NAV_TUTOR = [
  { key: "dashboard",   label: "Dashboard",   icon: "LayoutDashboard" },
  { key: "myclasses",   label: "My Classes",  icon: "CalendarDays"    },
  { key: "mystudents",  label: "My Students", icon: "GraduationCap"   },
  { key: "classnotes",  label: "Class Notes", icon: "FileText"        },
  { key: "homework",    label: "Homework",    icon: "BookOpenCheck"   },
  { key: "materials",   label: "Materials",   icon: "BookOpen"        },
];

// Parent — own children only
export const NAV_PARENT = [
  { key: "dashboard",   label: "Dashboard",  icon: "LayoutDashboard" },
  { key: "mychild",     label: "My Child",   icon: "GraduationCap"   },
  { key: "classes",     label: "Classes",    icon: "CalendarDays"    },
  { key: "homework",    label: "Homework",   icon: "BookOpenCheck"   },
  { key: "progress",    label: "Progress",   icon: "TrendingUp"      },
  { key: "payments",    label: "Payments",   icon: "Wallet"          },
];

// Student — own data only
export const NAV_STUDENT = [
  { key: "dashboard",   label: "Dashboard",  icon: "LayoutDashboard" },
  { key: "myclasses",   label: "My Classes", icon: "CalendarDays"    },
  { key: "homework",    label: "Homework",   icon: "BookOpenCheck"   },
  { key: "materials",   label: "Materials",  icon: "BookOpen"        },
  { key: "progress",    label: "Progress",   icon: "Target"          },
];

// Combined nav map for Shell lookup
export const NAV_BY_ROLE = {
  super_admin: NAV_SUPER_ADMIN,
  admin_tutor: NAV_ADMIN_TUTOR,
  tutor:       NAV_TUTOR,
  parent:      NAV_PARENT,
  student:     NAV_STUDENT,
};

// Default landing page per role after login
export const DEFAULT_PAGE = {
  super_admin: "dashboard",
  admin_tutor: "dashboard",
  tutor:       "dashboard",
  parent:      "dashboard",
  student:     "dashboard",
};


// ============================================================
// SOFT-DELETE STATUS VALUES
// Used to populate dropdowns and validate status changes.
// ============================================================
export const STATUS = {
  student:  ["Active", "Inactive", "Graduated"],
  parent:   ["Active", "Inactive"],
  tutor:    ["Active", "Inactive", "On Leave"],
  class:    ["Scheduled", "Completed", "Cancelled", "Rescheduled"],
  invoice:  ["Draft", "Issued", "Partially Paid", "Paid", "Overdue", "Voided", "Cancelled"],
  payment:  ["Recorded", "Corrected", "Reversed"],
  homework: ["Assigned", "Submitted", "Reviewed", "Incomplete"],
  material: ["Active", "Archived"],
  profile:  ["Active", "Suspended"],
};


// ============================================================
// AUDIT ACTION CONSTANTS
// Used in logAction() calls throughout the app.
// ============================================================
export const AUDIT_ACTION = {
  // Students
  CREATE_STUDENT:        "create_student",
  EDIT_STUDENT:          "edit_student",
  DEACTIVATE_STUDENT:    "deactivate_student",

  // Parents
  CREATE_PARENT:         "create_parent",
  EDIT_PARENT:           "edit_parent",

  // Tutors
  CREATE_TUTOR:          "create_tutor",
  EDIT_TUTOR:            "edit_tutor",
  ASSIGN_TUTOR:          "assign_tutor",
  CHANGE_TUTOR_ASSIGN:   "change_tutor_assignment",

  // Classes
  CREATE_CLASS:          "create_class",
  EDIT_CLASS:            "edit_class",
  CANCEL_CLASS:          "cancel_class",
  RESCHEDULE_CLASS:      "reschedule_class",

  // Homework
  CREATE_HOMEWORK:       "create_homework",
  EDIT_HOMEWORK:         "edit_homework",

  // Materials
  CREATE_MATERIAL:       "create_material",
  EDIT_MATERIAL:         "edit_material",

  // Class Notes
  CREATE_CLASS_NOTE:     "create_class_note",
  EDIT_CLASS_NOTE:       "edit_class_note",

  // Invoices
  CREATE_INVOICE:        "create_invoice",
  EDIT_INVOICE:          "edit_invoice",
  VOID_INVOICE:          "void_invoice",

  // Payments
  RECORD_PAYMENT:        "record_payment",
  EDIT_PAYMENT:          "edit_payment",
  PAYMENT_CORRECTION:    "payment_correction",
  PAYMENT_REVERSAL:      "payment_reversal",

  // User management
  CHANGE_ROLE:           "change_role",
  CHANGE_USER_STATUS:    "change_user_status",
  LINK_USER:             "link_user",

  // System
  SETTINGS_CHANGE:       "settings_change",
  DELETE_RECORD:         "delete_record",
};
