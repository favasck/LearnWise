/**
 * LearnWise Academy — Supabase Data Service
 * ==========================================
 * All database access goes through this file.
 * Every function returns { data, error } so callers
 * can handle both success and failure uniformly.
 *
 * Import pattern:
 *   import * as db from "../services/supabaseData";
 *   const { data, error } = await db.getStudents();
 *
 * Role-based data isolation is enforced by Supabase RLS policies,
 * not by this layer. Functions here query broadly; the DB will
 * automatically filter based on the signed-in user's role.
 */

import { supabase } from "../supabaseClient";

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

/**
 * Wraps any Supabase query in a try/catch.
 * Normalises network errors into the same { data, error } shape.
 */
async function run(queryFn) {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.error("[supabaseData]", error.message, error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error("[supabaseData] unexpected error:", err);
    return { data: null, error: { message: err.message || "Unexpected error" } };
  }
}

/** Returns today's date as a local ISO string "YYYY-MM-DD". */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the first moment of the current calendar month. */
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}


// ─────────────────────────────────────────────
// PROFILES
// ─────────────────────────────────────────────

/** Fetch all profiles (admin only — RLS enforces this). */
export const getProfiles = () =>
  run(() => supabase.from("profiles").select("*").order("created_at", { ascending: false }));

/** Fetch a single profile by auth user id. */
export const getProfileById = (userId) =>
  run(() => supabase.from("profiles").select("*").eq("id", userId).maybeSingle());

/** Update role or status for a profile. */
export const updateProfile = (userId, updates) =>
  run(() => supabase.from("profiles").update(updates).eq("id", userId).select().single());


// ─────────────────────────────────────────────
// TUTORS
// ─────────────────────────────────────────────

/** Fetch all tutors. Admin gets all; tutor gets their own row via RLS. */
export const getTutors = () =>
  run(() =>
    supabase
      .from("tutors")
      .select("*")
      .order("full_name")
  );

/** Fetch a single tutor by their tutors.id (not user_id). */
export const getTutorById = (tutorId) =>
  run(() =>
    supabase.from("tutors").select("*").eq("id", tutorId).maybeSingle()
  );

/**
 * Fetch the tutors table row for the currently signed-in user.
 * Used to bootstrap the Tutor portal.
 */
export const getMyTutorProfile = (userId) =>
  run(() =>
    supabase.from("tutors").select("*").eq("user_id", userId).maybeSingle()
  );

/** Create a new tutor record (admin). */
export const createTutor = (tutorData) =>
  run(() =>
    supabase.from("tutors").insert(tutorData).select().single()
  );

/** Update a tutor record. */
export const updateTutor = (tutorId, updates) =>
  run(() =>
    supabase.from("tutors").update(updates).eq("id", tutorId).select().single()
  );

/**
 * Link a Supabase auth user to a tutor record.
 * Called by admin after a tutor signs up.
 */
export const linkTutorAccount = (tutorId, userId) =>
  run(() =>
    supabase.from("tutors").update({ user_id: userId }).eq("id", tutorId).select().single()
  );

/** Soft-delete: set tutor status to Inactive. */
export const deactivateTutor = (tutorId) =>
  run(() =>
    supabase.from("tutors").update({ status: "Inactive" }).eq("id", tutorId).select().single()
  );


// ─────────────────────────────────────────────
// PARENTS
// ─────────────────────────────────────────────

/** Fetch all parents. */
export const getParents = () =>
  run(() =>
    supabase.from("parents").select("*").order("full_name")
  );

/** Fetch a single parent by parents.id. */
export const getParentById = (parentId) =>
  run(() =>
    supabase.from("parents").select("*").eq("id", parentId).maybeSingle()
  );

/**
 * Fetch the parents table row for the currently signed-in user.
 * Used to bootstrap the Parent portal.
 */
export const getMyParentProfile = (userId) =>
  run(() =>
    supabase.from("parents").select("*").eq("user_id", userId).maybeSingle()
  );

/** Create a new parent record (admin). */
export const createParent = (parentData) =>
  run(() =>
    supabase.from("parents").insert(parentData).select().single()
  );

/** Update a parent record. */
export const updateParent = (parentId, updates) =>
  run(() =>
    supabase.from("parents").update(updates).eq("id", parentId).select().single()
  );

/** Link a Supabase auth user to a parent record. */
export const linkParentAccount = (parentId, userId) =>
  run(() =>
    supabase.from("parents").update({ user_id: userId }).eq("id", parentId).select().single()
  );


// ─────────────────────────────────────────────
// STUDENTS
// ─────────────────────────────────────────────

/**
 * Fetch all students, joined with their parent's name.
 * Admin gets all; tutor gets only assigned students via RLS.
 */
export const getStudents = () =>
  run(() =>
    supabase
      .from("students")
      .select("*, parent:parents(id, full_name, email, phone)")
      .order("full_name")
  );

/** Fetch a single student with parent info and assigned tutors. */
export const getStudentById = (studentId) =>
  run(() =>
    supabase
      .from("students")
      .select(`
        *,
        parent:parents(id, full_name, email, phone),
        student_tutors(
          id, subjects, is_active,
          tutor:tutors(id, full_name, subjects, rate_qar)
        )
      `)
      .eq("id", studentId)
      .maybeSingle()
  );

/**
 * Fetch the students table row for the currently signed-in user.
 * Used to bootstrap the Student portal.
 */
export const getMyStudentProfile = (userId) =>
  run(() =>
    supabase
      .from("students")
      .select(`
        *,
        parent:parents(id, full_name),
        student_tutors(
          id, subjects,
          tutor:tutors(id, full_name)
        )
      `)
      .eq("user_id", userId)
      .maybeSingle()
  );

/** Fetch all students belonging to a specific parent. */
export const getStudentsByParent = (parentId) =>
  run(() =>
    supabase
      .from("students")
      .select("*, student_tutors(tutor:tutors(id, full_name))")
      .eq("parent_id", parentId)
      .order("full_name")
  );

/** Fetch all students assigned to a specific tutor. */
export const getStudentsByTutor = (tutorId) =>
  run(() =>
    supabase
      .from("students")
      .select("*, parent:parents(id, full_name, phone)")
      .in(
        "id",
        supabase
          .from("student_tutors")
          .select("student_id")
          .eq("tutor_id", tutorId)
          .eq("is_active", true)
      )
      .order("full_name")
  );

/** Create a new student (admin). */
export const createStudent = (studentData) =>
  run(() =>
    supabase.from("students").insert(studentData).select().single()
  );

/** Update a student record. */
export const updateStudent = (studentId, updates) =>
  run(() =>
    supabase.from("students").update(updates).eq("id", studentId).select().single()
  );

/** Link a Supabase auth user to a student record. */
export const linkStudentAccount = (studentId, userId) =>
  run(() =>
    supabase.from("students").update({ user_id: userId }).eq("id", studentId).select().single()
  );


// ─────────────────────────────────────────────
// STUDENT_TUTORS  (assignments)
// ─────────────────────────────────────────────

/** Fetch all student–tutor assignments (optionally filter by student or tutor). */
export const getStudentTutors = ({ studentId, tutorId } = {}) => {
  const query = supabase
    .from("student_tutors")
    .select(`
      *,
      student:students(id, full_name, grade, curriculum),
      tutor:tutors(id, full_name, subjects, rate_qar)
    `);
  if (studentId) query.eq("student_id", studentId);
  if (tutorId)   query.eq("tutor_id", tutorId);
  return run(() => query.order("assigned_at", { ascending: false }));
};

/** Assign a tutor to a student (admin). */
export const assignTutorToStudent = (studentId, tutorId, subjects = []) =>
  run(() =>
    supabase
      .from("student_tutors")
      .insert({ student_id: studentId, tutor_id: tutorId, subjects })
      .select()
      .single()
  );

/** Update the subjects taught in an assignment. */
export const updateStudentTutor = (assignmentId, updates) =>
  run(() =>
    supabase
      .from("student_tutors")
      .update(updates)
      .eq("id", assignmentId)
      .select()
      .single()
  );

/** Remove a tutor–student assignment (hard delete). */
export const removeStudentTutor = (assignmentId) =>
  run(() =>
    supabase.from("student_tutors").delete().eq("id", assignmentId)
  );


// ─────────────────────────────────────────────
// CLASSES
// ─────────────────────────────────────────────

/**
 * Fetch classes with student and tutor names joined.
 * Pass filters to narrow results.
 */
export const getClasses = ({ studentId, tutorId, status, from, to } = {}) => {
  let q = supabase
    .from("classes")
    .select(`
      *,
      student:students(id, full_name, grade),
      tutor:tutors(id, full_name)
    `)
    .order("scheduled_at", { ascending: false });

  if (studentId) q = q.eq("student_id", studentId);
  if (tutorId)   q = q.eq("tutor_id", tutorId);
  if (status)    q = q.eq("status", status);
  if (from)      q = q.gte("scheduled_at", from);
  if (to)        q = q.lte("scheduled_at", to);

  return run(() => q);
};

/** Fetch a single class with full related data. */
export const getClassById = (classId) =>
  run(() =>
    supabase
      .from("classes")
      .select(`
        *,
        student:students(id, full_name, grade, curriculum),
        tutor:tutors(id, full_name, rate_qar),
        class_notes(*),
        homework(*)
      `)
      .eq("id", classId)
      .maybeSingle()
  );

/** Fetch today's classes for a tutor. */
export const getTodaysClasses = (tutorId) => {
  const start = `${today()}T00:00:00`;
  const end   = `${today()}T23:59:59`;
  return run(() =>
    supabase
      .from("classes")
      .select("*, student:students(id, full_name), tutor:tutors(id, full_name)")
      .eq("tutor_id", tutorId)
      .gte("scheduled_at", start)
      .lte("scheduled_at", end)
      .order("scheduled_at")
  );
};

/** Fetch upcoming scheduled classes (after now). */
export const getUpcomingClasses = ({ tutorId, studentId, limit = 20 } = {}) => {
  let q = supabase
    .from("classes")
    .select("*, student:students(id, full_name), tutor:tutors(id, full_name)")
    .eq("status", "Scheduled")
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(limit);

  if (tutorId)   q = q.eq("tutor_id", tutorId);
  if (studentId) q = q.eq("student_id", studentId);
  return run(() => q);
};

/** Create a new class (admin or tutor). */
export const createClass = (classData) =>
  run(() =>
    supabase.from("classes").insert(classData).select().single()
  );

/** Update a class (reschedule, mark status, update attendance). */
export const updateClass = (classId, updates) =>
  run(() =>
    supabase.from("classes").update(updates).eq("id", classId).select().single()
  );

/** Mark attendance for a class. Convenience wrapper around updateClass. */
export const markAttendance = (classId, attendance) =>
  updateClass(classId, { attendance });

/** Update class status (Completed / Cancelled / Rescheduled). */
export const updateClassStatus = (classId, status) =>
  updateClass(classId, { status });

/** Delete a class (admin only in practice, RLS enforces). */
export const deleteClass = (classId) =>
  run(() => supabase.from("classes").delete().eq("id", classId));


// ─────────────────────────────────────────────
// CLASS NOTES
// ─────────────────────────────────────────────

/** Fetch notes. Pass tutorId, studentId, or classId to filter. */
export const getClassNotes = ({ tutorId, studentId, classId } = {}) => {
  let q = supabase
    .from("class_notes")
    .select(`
      *,
      class:classes(id, subject, scheduled_at),
      student:students(id, full_name),
      tutor:tutors(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (tutorId)   q = q.eq("tutor_id", tutorId);
  if (studentId) q = q.eq("student_id", studentId);
  if (classId)   q = q.eq("class_id", classId);

  return run(() => q);
};

/** Fetch a single note. */
export const getClassNoteById = (noteId) =>
  run(() =>
    supabase
      .from("class_notes")
      .select("*, class:classes(*), student:students(id, full_name), tutor:tutors(id, full_name)")
      .eq("id", noteId)
      .maybeSingle()
  );

/** Create a post-class note (tutor). */
export const createClassNote = (noteData) =>
  run(() =>
    supabase.from("class_notes").insert(noteData).select().single()
  );

/** Update a class note. */
export const updateClassNote = (noteId, updates) =>
  run(() =>
    supabase.from("class_notes").update(updates).eq("id", noteId).select().single()
  );

/** Delete a class note. */
export const deleteClassNote = (noteId) =>
  run(() => supabase.from("class_notes").delete().eq("id", noteId));


// ─────────────────────────────────────────────
// HOMEWORK
// ─────────────────────────────────────────────

/** Fetch homework. Filter by tutorId, studentId, status, or classId. */
export const getHomework = ({ tutorId, studentId, classId, status } = {}) => {
  let q = supabase
    .from("homework")
    .select(`
      *,
      student:students(id, full_name),
      tutor:tutors(id, full_name),
      class:classes(id, subject, scheduled_at)
    `)
    .order("due_at", { ascending: true });

  if (tutorId)   q = q.eq("tutor_id", tutorId);
  if (studentId) q = q.eq("student_id", studentId);
  if (classId)   q = q.eq("class_id", classId);
  if (status)    q = q.eq("status", status);

  return run(() => q);
};

/** Fetch a single homework item. */
export const getHomeworkById = (homeworkId) =>
  run(() =>
    supabase
      .from("homework")
      .select("*, student:students(id, full_name), tutor:tutors(id, full_name), class:classes(*)")
      .eq("id", homeworkId)
      .maybeSingle()
  );

/** Fetch overdue homework (due_at < now, not yet submitted). */
export const getOverdueHomework = ({ studentId, tutorId } = {}) => {
  let q = supabase
    .from("homework")
    .select("*, student:students(id, full_name)")
    .lt("due_at", new Date().toISOString())
    .in("status", ["Assigned", "Incomplete"])
    .order("due_at");

  if (studentId) q = q.eq("student_id", studentId);
  if (tutorId)   q = q.eq("tutor_id", tutorId);
  return run(() => q);
};

/** Create a homework assignment (tutor or admin). */
export const createHomework = (homeworkData) =>
  run(() =>
    supabase.from("homework").insert(homeworkData).select().single()
  );

/** Update a homework record (change status, add feedback, attach file). */
export const updateHomework = (homeworkId, updates) =>
  run(() =>
    supabase.from("homework").update(updates).eq("id", homeworkId).select().single()
  );

/** Student submits homework (updates status + submission_url). */
export const submitHomework = (homeworkId, submissionUrl = "") =>
  updateHomework(homeworkId, { status: "Submitted", submission_url: submissionUrl });

/** Tutor reviews homework (updates status + feedback). */
export const reviewHomework = (homeworkId, feedback) =>
  updateHomework(homeworkId, { status: "Reviewed", tutor_feedback: feedback });

/** Delete a homework record. */
export const deleteHomework = (homeworkId) =>
  run(() => supabase.from("homework").delete().eq("id", homeworkId));


// ─────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────

/** Fetch invoices. Admin gets all; parent gets their own via RLS. */
export const getInvoices = ({ parentId, status } = {}) => {
  let q = supabase
    .from("invoices")
    .select(`
      *,
      parent:parents(id, full_name, email),
      student:students(id, full_name)
    `)
    .order("issued_at", { ascending: false });

  if (parentId) q = q.eq("parent_id", parentId);
  if (status)   q = q.eq("status", status);

  return run(() => q);
};

/** Fetch a single invoice with all its payments. */
export const getInvoiceById = (invoiceId) =>
  run(() =>
    supabase
      .from("invoices")
      .select(`
        *,
        parent:parents(id, full_name, email, phone),
        student:students(id, full_name),
        payments(*)
      `)
      .eq("id", invoiceId)
      .maybeSingle()
  );

/** Create an invoice (admin). */
export const createInvoice = (invoiceData) =>
  run(() =>
    supabase.from("invoices").insert(invoiceData).select().single()
  );

/** Update an invoice (change status, adjust totals). */
export const updateInvoice = (invoiceId, updates) =>
  run(() =>
    supabase.from("invoices").update(updates).eq("id", invoiceId).select().single()
  );

/** Mark invoice as paid (sets status + paid_qar = total_qar). */
export const markInvoicePaid = (invoiceId, totalQar) =>
  updateInvoice(invoiceId, { status: "Paid", paid_qar: totalQar });

/** Delete a draft invoice. */
export const deleteInvoice = (invoiceId) =>
  run(() => supabase.from("invoices").delete().eq("id", invoiceId));

/**
 * Generate the next invoice number in the format INV-YYYY-NNN.
 * Reads the latest invoice to find the current sequence.
 */
export const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `INV-${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const last = data?.invoice_number ? parseInt(data.invoice_number.split("-")[2], 10) : 0;
  const next = String(last + 1).padStart(3, "0");
  return `INV-${year}-${next}`;
};


// ─────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────

/** Fetch payments. Admin gets all; parent gets their own via RLS. */
export const getPayments = ({ parentId, invoiceId, tutorId } = {}) => {
  let q = supabase
    .from("payments")
    .select(`
      *,
      parent:parents(id, full_name),
      student:students(id, full_name),
      tutor:tutors(id, full_name),
      invoice:invoices(id, invoice_number, total_qar)
    `)
    .order("paid_at", { ascending: false });

  if (parentId)   q = q.eq("parent_id", parentId);
  if (invoiceId)  q = q.eq("invoice_id", invoiceId);
  if (tutorId)    q = q.eq("tutor_id", tutorId);

  return run(() => q);
};

/** Create a payment record and update the linked invoice's paid_qar. */
export const createPayment = async (paymentData) => {
  // 1. Insert the payment row
  const { data: payment, error: payErr } = await run(() =>
    supabase.from("payments").insert(paymentData).select().single()
  );
  if (payErr) return { data: null, error: payErr };

  // 2. Update the linked invoice's paid_qar if an invoice_id was supplied
  if (paymentData.invoice_id) {
    const { data: inv } = await getInvoiceById(paymentData.invoice_id);
    if (inv) {
      const newPaid = Number(inv.paid_qar) + Number(paymentData.amount_qar);
      const newStatus =
        newPaid >= Number(inv.total_qar)
          ? "Paid"
          : newPaid > 0
          ? "Partially Paid"
          : "Issued";
      await updateInvoice(paymentData.invoice_id, {
        paid_qar: newPaid,
        status: newStatus,
      });
    }
  }

  return { data: payment, error: null };
};

/** Update a payment record. */
export const updatePayment = (paymentId, updates) =>
  run(() =>
    supabase.from("payments").update(updates).eq("id", paymentId).select().single()
  );

/** Delete a payment (admin only). */
export const deletePayment = (paymentId) =>
  run(() => supabase.from("payments").delete().eq("id", paymentId));


// ─────────────────────────────────────────────
// MATERIALS
// ─────────────────────────────────────────────

/** Fetch materials. RLS handles tutor/student/parent scoping. */
export const getMaterials = ({ tutorId, studentId, classId, subject } = {}) => {
  let q = supabase
    .from("materials")
    .select("*, tutor:tutors(id, full_name), student:students(id, full_name)")
    .order("created_at", { ascending: false });

  if (tutorId)   q = q.eq("tutor_id", tutorId);
  if (studentId) q = q.eq("student_id", studentId);
  if (classId)   q = q.eq("class_id", classId);
  if (subject)   q = q.eq("subject", subject);

  return run(() => q);
};

/** Fetch a single material. */
export const getMaterialById = (materialId) =>
  run(() =>
    supabase
      .from("materials")
      .select("*, tutor:tutors(id, full_name), student:students(id, full_name)")
      .eq("id", materialId)
      .maybeSingle()
  );

/** Create a material record (tutor or admin). */
export const createMaterial = (materialData) =>
  run(() =>
    supabase.from("materials").insert(materialData).select().single()
  );

/** Update a material record. */
export const updateMaterial = (materialId, updates) =>
  run(() =>
    supabase.from("materials").update(updates).eq("id", materialId).select().single()
  );

/** Delete a material record. */
export const deleteMaterial = (materialId) =>
  run(() => supabase.from("materials").delete().eq("id", materialId));


// ─────────────────────────────────────────────
// ASSESSMENT REQUESTS
// ─────────────────────────────────────────────

/** Fetch all assessment requests (admin only via RLS). */
export const getAssessmentRequests = ({ status } = {}) => {
  let q = supabase
    .from("assessment_requests")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (status) q = q.eq("status", status);
  return run(() => q);
};

/** Fetch a single assessment request. */
export const getAssessmentRequestById = (requestId) =>
  run(() =>
    supabase.from("assessment_requests").select("*").eq("id", requestId).maybeSingle()
  );

/**
 * Submit a new assessment request.
 * This is the only unauthenticated write in the system.
 */
export const submitAssessmentRequest = (requestData) =>
  run(() =>
    supabase.from("assessment_requests").insert(requestData).select().single()
  );

/** Update request status or admin notes (admin only). */
export const updateAssessmentRequest = (requestId, updates) =>
  run(() =>
    supabase
      .from("assessment_requests")
      .update(updates)
      .eq("id", requestId)
      .select()
      .single()
  );


// ─────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────

/**
 * Admin dashboard stats.
 * Returns counts and summaries for the overview cards.
 */
export const getAdminDashboardStats = async () => {
  const [
    studentsRes,
    tutorsRes,
    parentsRes,
    todayClassesRes,
    upcomingClassesRes,
    pendingHomeworkRes,
    unpaidInvoicesRes,
    monthPaymentsRes,
    newRequestsRes,
  ] = await Promise.all([
    run(() => supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "Active")),
    run(() => supabase.from("tutors").select("id", { count: "exact", head: true }).eq("status", "Active")),
    run(() => supabase.from("parents").select("id", { count: "exact", head: true }).eq("status", "Active")),
    run(() =>
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", `${today()}T00:00:00`)
        .lte("scheduled_at", `${today()}T23:59:59`)
    ),
    run(() =>
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("status", "Scheduled")
        .gt("scheduled_at", new Date().toISOString())
    ),
    run(() =>
      supabase
        .from("homework")
        .select("id", { count: "exact", head: true })
        .eq("status", "Submitted")
    ),
    run(() =>
      supabase
        .from("invoices")
        .select("balance_qar")
        .in("status", ["Issued", "Partially Paid", "Overdue"])
    ),
    run(() =>
      supabase
        .from("payments")
        .select("amount_qar")
        .gte("paid_at", startOfMonth())
    ),
    run(() =>
      supabase
        .from("assessment_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "New")
    ),
  ]);

  const outstandingQar = (unpaidInvoicesRes.data || []).reduce(
    (sum, inv) => sum + Number(inv.balance_qar || 0), 0
  );
  const monthRevenueQar = (monthPaymentsRes.data || []).reduce(
    (sum, p) => sum + Number(p.amount_qar || 0), 0
  );

  return {
    data: {
      totalStudents:      studentsRes.data      ?? 0,
      totalTutors:        tutorsRes.data         ?? 0,
      totalParents:       parentsRes.data        ?? 0,
      todayClasses:       todayClassesRes.data   ?? 0,
      upcomingClasses:    upcomingClassesRes.data ?? 0,
      pendingHomework:    pendingHomeworkRes.data ?? 0,
      outstandingQar,
      monthRevenueQar,
      newRequests:        newRequestsRes.data    ?? 0,
    },
    error: null,
  };
};

/**
 * Tutor dashboard stats for a given tutorId.
 */
export const getTutorDashboardStats = async (tutorId) => {
  const [
    todayRes,
    upcomingRes,
    studentsRes,
    pendingHwRes,
  ] = await Promise.all([
    run(() =>
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", tutorId)
        .gte("scheduled_at", `${today()}T00:00:00`)
        .lte("scheduled_at", `${today()}T23:59:59`)
    ),
    run(() =>
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", tutorId)
        .eq("status", "Scheduled")
        .gt("scheduled_at", new Date().toISOString())
    ),
    run(() =>
      supabase
        .from("student_tutors")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", tutorId)
        .eq("is_active", true)
    ),
    run(() =>
      supabase
        .from("homework")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", tutorId)
        .eq("status", "Submitted")
    ),
  ]);

  return {
    data: {
      todayClasses:    todayRes.data     ?? 0,
      upcomingClasses: upcomingRes.data  ?? 0,
      assignedStudents: studentsRes.data ?? 0,
      homeworkToReview: pendingHwRes.data ?? 0,
    },
    error: null,
  };
};

/**
 * Parent dashboard stats for a given parentId.
 */
export const getParentDashboardStats = async (parentId) => {
  const studentsRes = await getStudentsByParent(parentId);
  const students = studentsRes.data || [];
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return {
      data: { students: [], upcomingClasses: 0, pendingHomework: 0, outstandingQar: 0 },
      error: null,
    };
  }

  const [upcomingRes, homeworkRes, invoicesRes] = await Promise.all([
    run(() =>
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .in("student_id", studentIds)
        .eq("status", "Scheduled")
        .gt("scheduled_at", new Date().toISOString())
    ),
    run(() =>
      supabase
        .from("homework")
        .select("id", { count: "exact", head: true })
        .in("student_id", studentIds)
        .in("status", ["Assigned", "Incomplete"])
    ),
    run(() =>
      supabase
        .from("invoices")
        .select("balance_qar")
        .eq("parent_id", parentId)
        .in("status", ["Issued", "Partially Paid", "Overdue"])
    ),
  ]);

  const outstandingQar = (invoicesRes.data || []).reduce(
    (sum, inv) => sum + Number(inv.balance_qar || 0), 0
  );

  return {
    data: {
      students,
      upcomingClasses:  upcomingRes.data  ?? 0,
      pendingHomework:  homeworkRes.data  ?? 0,
      outstandingQar,
    },
    error: null,
  };
};

/**
 * Student dashboard stats for a given studentId.
 */
export const getStudentDashboardStats = async (studentId) => {
  const [upcomingRes, homeworkRes, notesRes] = await Promise.all([
    run(() =>
      supabase
        .from("classes")
        .select("*, tutor:tutors(id, full_name)")
        .eq("student_id", studentId)
        .eq("status", "Scheduled")
        .gt("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(5)
    ),
    run(() =>
      supabase
        .from("homework")
        .select("*")
        .eq("student_id", studentId)
        .in("status", ["Assigned", "Incomplete"])
        .order("due_at")
        .limit(5)
    ),
    run(() =>
      supabase
        .from("class_notes")
        .select("*, class:classes(subject, scheduled_at)")
        .eq("student_id", studentId)
        .eq("is_shared_with_student", true)
        .order("created_at", { ascending: false })
        .limit(3)
    ),
  ]);

  return {
    data: {
      upcomingClasses: upcomingRes.data  || [],
      pendingHomework: homeworkRes.data  || [],
      recentNotes:     notesRes.data     || [],
    },
    error: null,
  };
};


// ─────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────

/**
 * Attendance report: present/absent/cancelled counts per student.
 * Optionally filter by date range or tutorId.
 */
export const getAttendanceReport = ({ tutorId, from, to } = {}) => {
  let q = supabase
    .from("classes")
    .select(`
      attendance,
      student:students(id, full_name, grade),
      tutor:tutors(id, full_name),
      scheduled_at, subject
    `)
    .neq("attendance", "Pending");

  if (tutorId) q = q.eq("tutor_id", tutorId);
  if (from)    q = q.gte("scheduled_at", from);
  if (to)      q = q.lte("scheduled_at", to);

  return run(() => q.order("scheduled_at", { ascending: false }));
};

/**
 * Revenue report: all payments in a date range, grouped with invoice info.
 */
export const getRevenueReport = ({ from, to } = {}) => {
  let q = supabase
    .from("payments")
    .select(`
      *,
      parent:parents(id, full_name),
      student:students(id, full_name),
      tutor:tutors(id, full_name),
      invoice:invoices(id, invoice_number)
    `)
    .order("paid_at", { ascending: false });

  if (from) q = q.gte("paid_at", from);
  if (to)   q = q.lte("paid_at", to);

  return run(() => q);
};

/**
 * Outstanding payments report: invoices not fully paid.
 */
export const getOutstandingPaymentsReport = () =>
  run(() =>
    supabase
      .from("invoices")
      .select(`
        *,
        parent:parents(id, full_name, email, phone),
        student:students(id, full_name)
      `)
      .in("status", ["Issued", "Partially Paid", "Overdue"])
      .order("due_at", { ascending: true })
  );

/**
 * Student progress report: class notes for all students (or one).
 * Returns notes enriched with class and student info.
 */
export const getProgressReport = ({ studentId, tutorId } = {}) => {
  let q = supabase
    .from("class_notes")
    .select(`
      *,
      student:students(id, full_name, grade, curriculum),
      tutor:tutors(id, full_name),
      class:classes(id, subject, scheduled_at)
    `)
    .order("created_at", { ascending: false });

  if (studentId) q = q.eq("student_id", studentId);
  if (tutorId)   q = q.eq("tutor_id", tutorId);

  return run(() => q);
};

/**
 * Tutor performance report: completed class counts and homework
 * review rates per tutor. Returns raw rows for the caller to aggregate.
 */
export const getTutorPerformanceReport = ({ from, to } = {}) => {
  let q = supabase
    .from("classes")
    .select(`
      status, attendance,
      tutor:tutors(id, full_name),
      scheduled_at
    `)
    .order("scheduled_at", { ascending: false });

  if (from) q = q.gte("scheduled_at", from);
  if (to)   q = q.lte("scheduled_at", to);

  return run(() => q);
};

/**
 * Homework completion report: submission and review rates per student.
 */
export const getHomeworkReport = ({ tutorId, studentId, from, to } = {}) => {
  let q = supabase
    .from("homework")
    .select(`
      status,
      due_at,
      student:students(id, full_name, grade),
      tutor:tutors(id, full_name)
    `)
    .order("due_at", { ascending: false });

  if (tutorId)   q = q.eq("tutor_id", tutorId);
  if (studentId) q = q.eq("student_id", studentId);
  if (from)      q = q.gte("due_at", from);
  if (to)        q = q.lte("due_at", to);

  return run(() => q);
};
