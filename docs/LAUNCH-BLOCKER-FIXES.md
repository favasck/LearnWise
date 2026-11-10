# Branch rework following the 10 November production report

**BLOCKED FOR MERGE/DEPLOYMENT.** Only `fix/launch-blockers` is changed. No production SQL, migrations, account changes, exploit tests, connection requests or deployment changes are authorized. Site and signups remain open for team testing. Earlier release instructions are superseded.

## Evidence assessment

| Reported point | Assessment |
|---|---|
| Production allows five canonical roles, not `admin`; staff counts are 2 Super Admin + 1 Tutor Admin | Owner-reported, independently unverified. Source `src/config/roles.js` agrees with the five-role model. Earlier migrations/tests used an incompatible legacy model; that source defect is verified. |
| Production helper functions recognize both staff roles | Owner-reported, independently unverified. Candidates do not overwrite those existing helpers. |
| Notes column exists and class link is nullable; only date of birth is missing | Owner-reported, independently unverified. Reconciliation now adds only `students.date_of_birth`; old missing-note claims were withdrawn. |
| Permission audit table/RPC absent | Owner-reported, independently unverified. The revised candidate creates the audit/RPC for active stored Super Admins. |
| Own-row safe update prevents self-promotion | Owner-reported. Reproduced only in a synthetic local policy with equivalent described intent, not the actual production policy text. |
| JWT user-metadata admin policy permits escalation | Inferred for production from the supplied description. A synthetic equivalent is exploitable locally; the revised candidate removes that named policy and blocks the local attack. No production attack was attempted. Supabase's RLS docs confirm user metadata is unsuitable for authorization. |
| Tutor Admin update policy is uncorrelated | Owner-reported text supports that inference. Candidate is own-row-only pending scope review; actual predicate/grants are still needed. |
| Legacy 10-argument security-definer payment function remains callable | Its existence/arguments are owner-reported, actual types/body/grants unverified. Earlier branch only added an overload; that source defect is verified. New candidate enumerates every existing `record_payment` overload and revokes public/anonymous/authenticated execution before enabling only `(uuid,jsonb)`. Inherited residual execution aborts the migration. |
| Blanket policy replacement removes staff access | Verified source defect in the old candidate, with production impact inferred from reported roles. The entire rewrite is withdrawn and its generator disabled. The replacement is not claimed complete. |

## Revised candidate behavior

- Role selectors, routing and the empty-project reference use the five real roles. No legacy account mapping occurs. The existing database must never be bootstrapped from this reference.
- Profile repair drops only the known unsafe JWT policy and the named uncorrelated Tutor Admin update policy. It adds stored Super Admin read authority, own-row Tutor Admin safe edits, restricted column UPDATE grants and an atomic audited permission RPC. Other application policies are preserved.
- Invoice/payment creation checks the caller's stored active staff role and derives audit actor identity from `auth.uid()`. Both Super Admins and Tutor Admin retain these operations. The caller cannot supply actor identity/role. Amount, relationship, retry, invoice locking and atomic audit controls remain.
- Old payment overloads are retained as database objects for review but application roles lose EXECUTE; signatures are discovered from PostgreSQL metadata rather than guessed. Trusted owners/service roles remain outside the ordinary client threat model. Export/review is required to identify other privileged write paths.
- Cancellation by Tutor Admin is withheld pending decision. Payment corrections/reversals are not implemented. Tutor Admin non-self safe profile-edit scope also needs a decision.
- No protected-view frontend adapter is active. Private-field disclosure is an OPEN issue. The prior privacy migration now fails immediately without modifying anything; do not include it in any future migration sequence.

## Test evidence and limits

The reconstructed fixture has the reported five-role constraint, eight profiles (including both Super Admins and Tutor Admin), three students, three parents, four tutors, two classes, two invoices and two payments. Records are synthetic. Policy definitions and legacy function types/body are explicitly synthetic wherever the owner summary lacks exact SQL. This is NOT the requested exact production fixture; that work remains blocked on the metadata export.

Tests cover all three staff accounts retaining access after profile and billing candidates; unrelated policies remaining unchanged; local metadata-forgery rejection; own-row Tutor Admin updates; Super Admin-only permission changes; audit rollback/immutability; disabled legacy payment overloads; stored audit actors; atomic/idempotent billing and withheld cancellation. Older tests asserting legacy `admin` compatibility were replaced, not counted as production evidence.

Actual production policies, function bodies/grants, private-field rules, Supabase advisors, real API behavior and concurrent-session behavior remain unverified. No live fixes are claimed. The PR remains draft. See `scripts/production-role-export.sql` and `ROLE-PERMISSIONS.md`.

Reference: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
