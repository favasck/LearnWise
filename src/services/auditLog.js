// ============================================================
// LearnWise Academy — Audit Log Service
// src/services/auditLog.js
// ============================================================
// Provides a single logAction() function that inserts a row
// into the audit_logs table.
//
// USAGE:
//   import { logAction } from "./services/auditLog";
//   import { AUDIT_ACTION } from "./config/roles";
//
//   await logAction({
//     profile,                          // current user's profile object
//     action: AUDIT_ACTION.EDIT_INVOICE,
//     tableName: "invoices",
//     recordId: invoice.id,
//     oldData: originalInvoice,         // snapshot before change
//     newData: updatedInvoice,          // snapshot after change
//     reason: "Correcting amount",      // required for sensitive actions
//     module: "payments",
//     severity: "warning",              // "info" | "warning" | "critical"
//   });
//
// RULES:
//   - Never throws — failures are logged to console only so they
//     never block the main operation from completing.
//   - Reason is required for admin_tutor sensitive actions.
//     The UI enforces this before calling logAction, but we
//     also record whatever reason is passed here.
//   - audit_logs has no UPDATE or DELETE RLS policy, so rows
//     are permanently immutable once inserted.
// ============================================================

import { supabase } from "../supabaseClient";

/**
 * Insert one row into audit_logs.
 *
 * @param {Object} params
 * @param {Object}  params.profile    - Current user's profile ({ id, role })
 * @param {string}  params.action     - Action constant from AUDIT_ACTION
 * @param {string}  [params.tableName] - DB table affected
 * @param {string}  [params.recordId]  - UUID of the affected record
 * @param {Object}  [params.oldData]   - Snapshot before the change
 * @param {Object}  [params.newData]   - Snapshot after the change
 * @param {string}  [params.reason]    - Reason text (required for sensitive ops)
 * @param {string}  [params.module]    - Feature area e.g. "payments"
 * @param {string}  [params.severity]  - "info" | "warning" | "critical"
 * @returns {Promise<void>}
 */
export async function logAction({
  profile,
  action,
  tableName = null,
  recordId  = null,
  oldData   = null,
  newData   = null,
  reason    = null,
  module    = null,
  severity  = "info",
}) {
  if (!profile?.id || !action) {
    console.warn("[auditLog] logAction called without profile or action — skipped.");
    return;
  }

  try {
    const { error } = await supabase.from("audit_logs").insert({
      actor_user_id: profile.id,
      actor_role:    profile.role,
      action,
      table_name:    tableName,
      record_id:     recordId   || null,
      old_data:      oldData    ? JSON.parse(JSON.stringify(oldData))   : null,
      new_data:      newData    ? JSON.parse(JSON.stringify(newData))   : null,
      reason,
      module,
      severity,
    });

    if (error) {
      // Don't throw — log to console so the main operation still completes
      console.warn("[auditLog] Failed to write audit log:", error.message);
    }
  } catch (err) {
    console.warn("[auditLog] Unexpected error writing audit log:", err);
  }
}


/**
 * Convenience wrapper for "info" severity actions.
 * Use for routine creates and edits.
 */
export async function logInfo(params) {
  return logAction({ ...params, severity: "info" });
}

/**
 * Convenience wrapper for "warning" severity actions.
 * Use for edits that require a reason, deactivations, voids.
 */
export async function logWarning(params) {
  return logAction({ ...params, severity: "warning" });
}

/**
 * Convenience wrapper for "critical" severity actions.
 * Use for permanent deletes, role changes, system setting changes.
 */
export async function logCritical(params) {
  return logAction({ ...params, severity: "critical" });
}


// ============================================================
// PRE-BUILT LOG HELPERS FOR COMMON ACTIONS
// These wrap logAction with the correct tableName, module,
// and severity already set — less boilerplate at call sites.
// ============================================================

// ── Students ─────────────────────────────────────────────────

export const auditCreateStudent = (profile, newStudent) =>
  logInfo({ profile, action: "create_student", tableName: "students",
            recordId: newStudent?.id, newData: newStudent, module: "students" });

export const auditEditStudent = (profile, oldStudent, newStudent, reason) =>
  logInfo({ profile, action: "edit_student", tableName: "students",
            recordId: newStudent?.id, oldData: oldStudent, newData: newStudent,
            reason, module: "students" });

export const auditDeactivateStudent = (profile, student, reason) =>
  logWarning({ profile, action: "deactivate_student", tableName: "students",
               recordId: student?.id, oldData: student,
               newData: { ...student, status: "Inactive" },
               reason, module: "students" });

// ── Parents ──────────────────────────────────────────────────

export const auditCreateParent = (profile, newParent) =>
  logInfo({ profile, action: "create_parent", tableName: "parents",
            recordId: newParent?.id, newData: newParent, module: "parents" });

export const auditEditParent = (profile, oldParent, newParent) =>
  logInfo({ profile, action: "edit_parent", tableName: "parents",
            recordId: newParent?.id, oldData: oldParent, newData: newParent,
            module: "parents" });

// ── Tutors ───────────────────────────────────────────────────

export const auditCreateTutor = (profile, newTutor) =>
  logInfo({ profile, action: "create_tutor", tableName: "tutors",
            recordId: newTutor?.id, newData: newTutor, module: "tutors" });

export const auditEditTutor = (profile, oldTutor, newTutor) =>
  logInfo({ profile, action: "edit_tutor", tableName: "tutors",
            recordId: newTutor?.id, oldData: oldTutor, newData: newTutor,
            module: "tutors" });

export const auditAssignTutor = (profile, assignment, reason) =>
  logWarning({ profile, action: "assign_tutor", tableName: "student_tutors",
               recordId: assignment?.id, newData: assignment,
               reason, module: "tutors" });

// ── Classes ──────────────────────────────────────────────────

export const auditCreateClass = (profile, newClass) =>
  logInfo({ profile, action: "create_class", tableName: "classes",
            recordId: newClass?.id, newData: newClass, module: "classes" });

export const auditEditClass = (profile, oldClass, newClass) =>
  logInfo({ profile, action: "edit_class", tableName: "classes",
            recordId: newClass?.id, oldData: oldClass, newData: newClass,
            module: "classes" });

export const auditCancelClass = (profile, cls, reason) =>
  logWarning({ profile, action: "cancel_class", tableName: "classes",
               recordId: cls?.id, oldData: cls,
               newData: { ...cls, status: "Cancelled" },
               reason, module: "classes" });

// ── Invoices ─────────────────────────────────────────────────

export const auditCreateInvoice = (profile, newInvoice) =>
  logInfo({ profile, action: "create_invoice", tableName: "invoices",
            recordId: newInvoice?.id, newData: newInvoice, module: "payments" });

export const auditEditInvoice = (profile, oldInvoice, newInvoice, reason) =>
  logWarning({ profile, action: "edit_invoice", tableName: "invoices",
               recordId: newInvoice?.id, oldData: oldInvoice, newData: newInvoice,
               reason, module: "payments" });

export const auditVoidInvoice = (profile, invoice, reason) =>
  logWarning({ profile, action: "void_invoice", tableName: "invoices",
               recordId: invoice?.id, oldData: invoice,
               newData: { ...invoice, status: "Voided" },
               reason, module: "payments" });

// ── Payments ─────────────────────────────────────────────────
// Note: record_payment goes through the Supabase RPC which logs
// automatically. These helpers are for other payment actions.

export const auditPaymentCorrection = (profile, originalPayment, correctionPayment, reason) =>
  logWarning({ profile, action: "payment_correction", tableName: "payments",
               recordId: correctionPayment?.id,
               oldData: originalPayment, newData: correctionPayment,
               reason, module: "payments", severity: "warning" });

export const auditPaymentReversal = (profile, originalPayment, reversalPayment, reason) =>
  logWarning({ profile, action: "payment_reversal", tableName: "payments",
               recordId: reversalPayment?.id,
               oldData: originalPayment, newData: reversalPayment,
               reason, module: "payments", severity: "warning" });

// ── User / Role management ────────────────────────────────────

export const auditChangeRole = (profile, targetProfile, oldRole, newRole) =>
  logCritical({ profile, action: "change_role", tableName: "profiles",
                recordId: targetProfile?.id,
                oldData: { role: oldRole }, newData: { role: newRole },
                module: "users" });

export const auditChangeUserStatus = (profile, targetProfile, oldStatus, newStatus, reason) =>
  logWarning({ profile, action: "change_user_status", tableName: "profiles",
               recordId: targetProfile?.id,
               oldData: { status: oldStatus }, newData: { status: newStatus },
               reason, module: "users" });

export const auditLinkUser = (profile, targetProfile, linkedTable, linkedId) =>
  logInfo({ profile, action: "link_user", tableName: "profiles",
            recordId: targetProfile?.id,
            newData: { linked_table: linkedTable, linked_id: linkedId },
            module: "users" });

// ── Deletes (super_admin only) ────────────────────────────────

export const auditDeleteRecord = (profile, tableName, record) =>
  logCritical({ profile, action: "delete_record", tableName,
                recordId: record?.id, oldData: record,
                module: tableName, severity: "critical" });

// ── Settings ─────────────────────────────────────────────────

export const auditSettingsChange = (profile, oldSettings, newSettings) =>
  logCritical({ profile, action: "settings_change", tableName: "settings",
                oldData: oldSettings, newData: newSettings,
                module: "settings" });
