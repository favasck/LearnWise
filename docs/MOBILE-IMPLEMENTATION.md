# Applied mobile interface

Status: implemented in the working application; local release candidate, not deployed. This follows the three-journey prototype and extends the existing authenticated portal. Other booking, master-calendar, automatic-parent, QA and tutor-command edits in the shared checkout were retained.

## Implemented

| Area | Working behavior |
|---|---|
| Student navigation | Mobile Home, Lessons, Homework, Progress and More; desktop sidebar retained |
| Parent navigation | Mobile Home, Lessons, Learning and More; Learning groups Homework, Feedback and Children |
| Tutor navigation | Mobile Today, Lessons, Students and More; administrative roles retain grouped drawer navigation |
| More and keyboard | More opens the native modal drawer, returns focus to its opener, and exposes remaining authorised destinations. Bottom navigation hides when the visual viewport indicates a keyboard over an editable field |
| Lesson journey | Lesson list opens a full-page detail state using the lesson query parameter; preparation and real meeting links are visible; browser Back, direct links and refresh work; cancelled sessions have no join action |
| Parent context | Selected child follows learning screens and is encoded in the URL for refresh/deep links. Portal section navigation preserves the selection. The next-lesson panel loads the selected child’s actual upcoming sessions; billing remains the family account |
| Homework | Students and parents use full instructions and feedback cards, ordered by due date, rather than a wide parent table or truncated instructions |
| Tutor attendance | Mobile starts with teaching agenda cards, labelled attendance controls, in-flight protection, explicit failure and success outcomes, and a link to feedback for the exact lesson |
| Tutor feedback | Linked lesson preselects its learner and opens an existing note when present. The form reviews the summary, next step and audience before saving. Failures retain inputs; saves are guarded against double clicks. No rating is fabricated: unassessed understanding is stored as null, supported by the existing nullable column |
| Calendar | Both the shared session calendar and master calendar start in agenda on small screens; month remains available. Confirmed sessions and pending requests retain different labels |
| Billing | Mobile invoice cards open persisted invoice details; payment cards show recorded date/method/reference. Desktop tables remain available. Failed loads cannot masquerade as successful zero balances |
| Forms and spacing | Wider touch targets, 16px inputs, safe-area spacing, navigation-aware toast placement, full-screen wide forms on mobile and reading-focused homework layouts |
| Public assessment | Mobile still explains what happens after an assessment request, rather than hiding the expectation-setting note |

## Data and save semantics

The interface reuses existing scoped data services and existing role routing. No new permission grant, schema migration, payment operation, email delivery or messaging integration was introduced.

Attendance and lesson notes remain separate saved operations; the feedback review says so explicitly. A saved note is visible according to its existing sharing flags. A note save does not imply an email was delivered. Feedback inputs survive a failed save and edit/review transitions while the form is mounted; this release does not store real student feedback drafts in browser storage or promise draft recovery after refreshing the form.

The new URL parameters hold record selections and display state, not note text or credentials. Backend authorisation remains responsible for access to every record. Invalid or unavailable lesson selections show a recovery action instead of fetching broadly accessible records.

## Verification

- Full repository run: 203 tests passed, 0 failed.
- After the final child-selection refresh change: 40 affected mobile, dashboard and public interaction tests passed again.
- Production build and existing seven-public-page/sign-in built render checks passed.
- Prototype standalone build and its three-role zero-network render check passed; the prototype remains separate from the working portal.
- `git diff --check` passed.

`tests/mobile-portal.test.js` covers role navigation, More/focus return, visual-viewport keyboard state, full-page lesson Back/refresh/filter recovery, agenda default and pending states, attendance failure/retry, feedback review/failure/payload, family Learning, invoice cards, and child-specific upcoming sessions after refresh.

The browser automation host was unavailable and the earlier native-browser navigation attempt was blocked by URL verification. This release does not claim pixel inspection or real iPhone/Android keyboard and accessibility verification. These remain release checks, together with representative user task testing and staging authorisation/persistence checks against the existing backend. No production deployment was performed.

## Manual acceptance before rollout

Use 360px, 390px and 430px widths, enlarged text, portrait/landscape, Android Chrome and iPhone Safari. Check bottom safe areas, native drawer focus/Escape, keyboard visibility, long names/instructions, slow/error states and return from a meeting app. Exercise:

1. Student: Home → lesson details → meeting link → return → earliest homework.
2. Parent: select a child → Lessons → Learning homework/feedback → refresh → family invoice.
3. Tutor: agenda → attendance → linked lesson feedback → review audience → failed save/retry → saved note.

Record completion without help, task time and confusion about confirmations or sharing. The implemented design is a testable candidate; no measured usability uplift is asserted without participant evidence.
