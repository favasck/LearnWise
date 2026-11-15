# Tutor command workspace

The student-only milestone below is superseded by the [expanded task command workspace](TASK-COMMANDS.md), covering people, teaching operations, requests, calendar entries and reports.

Status: first local implementation, 15 November 2026. Student search and staff-authorized creation are implemented; the remaining workflows below are a specification. No deployment or external messaging integration is included.

## First implementation

`StudentCommandBox.jsx` is mounted in the portal for staff and tutors and resets on account/role changes. Supported inputs include “Find student Naila” and “Add student Naila, Year 8, maths”. Labelled subject/curriculum details are supported. Interpretation is a bounded local parser, not a general AI assistant; unsupported details or multiple tasks are rejected before writing.

Staff receive editable previews, matching-name warnings and a deliberate same-name-person choice. Tutors search their assigned students and can prepare an unsaved student draft; creation remains staff-only under current policies. Student creation uses the existing service and server permissions, supplies one UUID per preview and retains it across retries to recover a committed record after a lost response. Fields freeze after an attempted save so a retry cannot silently change the intended payload. Reopening a new preview is a new action, not a persistent cross-session idempotency guarantee. Browser refresh does not currently preserve drafts.

Creation does not assign a tutor, invite a parent or create a login. The preview explains optional automatic parent-placeholder setup. Search results expose compact student details without writing anything. No production records were created for testing.

Validation: the production-based release passes all 175 tests, including the four command/unit and DOM interaction tests and existing PostgreSQL authorization/automatic-parent tests. Production build and built-artifact public/sign-in render checks pass. The broader working checkout also passes all 194 tests. No production records were created for testing. Live authenticated creation and native visual review remain unverified.

## Product outcome

Tutors can type a task in ordinary language, review the interpreted action, and complete it without re-entering known details. Existing buttons remain available and use the same validated operations. The workspace reduces typing, screen changes, coordination and follow-up across the entire lesson cycle.

## Entry point and interaction

Add a labelled “Tell LearnWise what to do” input to the portal workspace, with contextual entry points in student and lesson details. Mobile uses a full-width composer; desktop may also offer Ctrl/Cmd+K. Example placeholder: “Add student Naila, or assign homework…” Never rely on placeholder text as the label.

Suggested actions: Add student; Record attendance; Write lesson update; Assign homework; Find a student; Change a lesson. Show only actions available to the current user.

States: Ready → Interpreting → Clarification or Preview → Saving → Completed. Include recoverable failure, unsupported task and permission-denied states. Preserve the command and edited fields after failure. Announce status changes, return focus predictably and support keyboard-only operation.

## First journey: Add student Naila

1. Tutor enters “Add student Naila”.
2. Resolve create-student intent and name=Naila. Search for possible duplicates only within the actor's permitted scope; never expose another tutor's records.
3. Show a compact editable card containing the name and permitted defaults. Ask only for fields required by the actual create contract. Do not invent grade, curriculum, parent contact or subject.
4. Label the action “Create student record”. Show any parent records or links that the existing creation operation will also generate before execution.
5. Check authorization on the server. If tutors cannot create students under the current permission model, offer the existing authorized route or a clearly labelled request draft. Do not silently expand tutor permissions or claim a draft is a saved student.
6. On success, show the actual created record and actions: Add learning details; Link parent; Plan lessons. Creating a login, linking an existing parent and sending an invitation are distinct operations.
7. Retrying the same submission must not create a second student. A matching name alone is not proof of a duplicate; let the tutor distinguish people with the same name.

Example preview:

> Create student record
> Name: Naila
> Tutor: current tutor, when assignment is authorized
> No invitation will be sent by this action.
> Create student record | Edit

## Initial supported tasks

| Input | Required resolution | Result |
|---|---|---|
| Add student Naila, Year 8, maths | Actor authority, required student fields, duplicate candidates | Editable creation preview |
| Find Naila | Accessible identity candidates | Student record or disambiguation |
| Naila attended today's maths lesson | Student and exact Qatar-date lesson | Attendance preview and saved result |
| We covered fractions; division needs practice | Explicit lesson context or clarification | Class-note draft; no invented understanding rating |
| Give Naila fractions practice, due Sunday | Student, task content, exact due date | Homework preview; match an existing resource only when found |
| Show homework waiting for review | Actor scope | Filtered review queue |

Launch writes with compact previews. A later explicit quick-save preference may allow narrow reversible updates after reliable resolution. Undo is offered only when a real authorized inverse operation exists and no conflicting later edit would be overwritten.

## Context and clarification rules

- Pass explicit page context: actor, selected student and selected lesson IDs. Show the resolved student/lesson in every write preview.
- A named student in the command overrides page context only after identity resolution; show the change visibly.
- Ask one focused question when an identity, lesson, resource or date has multiple valid interpretations. Retain all previously supplied details.
- Interpret academy dates in Asia/Qatar. Display absolute dates and times in previews; clarify ambiguous “next Monday” or “at 5” when needed.
- Do not automatically mark attendance, understanding or homework review from elapsed time or a template.
- Unsupported commands explain the limitation and offer a relevant existing action; they never return a fictional success.

## Entire tutor cycle

| Cycle | Command example | Expected behavior |
|---|---|---|
| Availability | I'm available Sunday to Thursday, 3–8 PM next month | Preview dated windows, exclusions, mode and buffers |
| New schedule | Book Naila Mondays at 5 PM for eight one-hour lessons | Preview all dates; validate every occurrence |
| Confirmation | Confirm Naila's pending request | Identify exact request/version and confirm through existing validated workflow |
| Reschedule | Move Naila's next lesson to Thursday at 6 PM | Show old/new details; send a proposal once confirmed-class negotiation exists |
| Series change | Move future Monday lessons to 6 PM | Ask effective date/scope; preview all affected dates and conflicts |
| Delay | Tell the family I'm ten minutes late | Resolve class/recipient; preview message and delivery channel |
| Cancellation | Cancel tomorrow's lesson; I'm unwell | Confirm exact lesson and reason; apply established cancellation policy |
| Make-up | Find a replacement for the missed lesson | Suggest valid slots; link replacement to original; prevent duplicate obligations |
| Lesson completion | Naila attended; covered fractions | Preview linked attendance and note as separate outcomes |
| Homework | Repeat last week's task, due Sunday | Copy task content, not completion/feedback; preview date and audience |
| Review | Mark this submission reviewed with this feedback… | Require real submission context and supplied feedback |
| Materials | Share my fractions worksheet with Naila | Resolve actual resource and access rights; preview audience |
| Exams/events | Naila has an exam on 20 May at 9 AM | Ask missing duration/details; record event and surface affected classes |
| Parent meeting | Offer Naila's parent a fifteen-minute meeting | Suggest availability; track invitation and acceptance |
| Progress | Prepare Naila's monthly update | Draft from recorded evidence; tutor edits and publishes |
| Weekly wrap-up | What still needs my attention? | Pending proposals, incomplete records, homework and make-up queue |

These are staged capabilities, not claims that every operation currently exists.

## Scheduling and communication behavior

An unchanged agreed series needs no repeated weekly approval. New timing proposals require an explicit response from the designated family decision-maker. Keep the original confirmed time until the change is accepted, unless it is explicitly cancelled. Recheck conflicts at acceptance; pending proposals do not imply a reservation. Show expiration and any actual hold rules clearly.

Recipients, audience, message body and delivery channel appear before a message is sent. An in-portal notice is not an email or WhatsApp delivery. External channels require a working integration and verified delivery handling. Private notes cannot become family-visible merely because a summary is generated.

## Execution contract

Natural-language interpretation produces a structured plan, never executable SQL or unrestricted API calls. Each action has an allowlisted intent, schema-validated fields, resolved record IDs, missing-field list, preview, permission requirement and supported executor. Deterministic parsing may support narrow commands first; describe supported wording honestly. Broader language support uses a server-side interpretation endpoint with credentials kept off the client.

Server operations enforce current actor scope and permissions independently of the interpreter. Resolve names through scoped queries. Reuse existing services where their contracts are sufficient; add backend operations only where genuinely needed. Use request IDs/idempotency for retry safety and version checks for stale edits. Record actor, target, action and actual outcome in the appropriate audit trail without placing private command text in general analytics.

For multi-step commands, show dependencies and each outcome. Example: create student → plan lessons → draft invitation. A failed second step must not recreate the student or be described as complete. Resume from known saved outcomes. Atomic operations are required where partial success would leave inconsistent records.

## Delivery sequence

1. Inspect current permission and student-creation contracts; define supported intents and required fields. Add the composer, clarification, previews and result states. Deliver find-student and authorized student creation first.
2. Add attendance, linked lesson-note drafts and homework creation using the same executor layer as ordinary controls.
3. Add availability and existing booking-review commands; implement confirmed-class negotiation and recurrence exceptions before exposing those commands.
4. Add resource selection, actual submission review, make-up tracking and meeting workflows.
5. Add connected message delivery, evidence-based progress drafts, optional voice input and multi-step orchestration. Voice must have a complete text alternative; explain processing before enabling recording.

## Acceptance and measurement

Verify: duplicate names; missing required fields; unauthorized tutor creation; wrong-student context; Qatar midnight; ambiguous dates; nonexistent resource; double click/retry; stale class edits; save failure with retained draft; partial multi-step success; actual message delivery state; keyboard operation and mobile layout.

For “Add student Naila”, demonstrate that required missing information is requested without restarting, the preview reflects all actual side effects, one authorized record is saved, retries do not duplicate it, and unauthorized users cannot bypass restrictions through typed commands.

Measure task completion, time, typed characters, clarification count, corrections and abandonment against the equivalent button workflow. Do not include names or raw commands in aggregate analytics. Pilot with tutors before setting improvement claims. Initial design targets: zero re-entry of known student/class details; one preview for a fully specified supported task; no repeated confirmation of unchanged schedules.
