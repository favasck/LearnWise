# Five-role candidate — not a production authorization export

The owner-supplied 10 November report says production accepts only `super_admin`, `admin_tutor`, `tutor`, `parent`, `student`. The legacy `admin` role is rejected. No account is remapped by this branch.

| Role | Source-supported authority | Candidate boundary |
|---|---|---|
| Super Admin | Academic/tuition operations, role changes, settings, audit access, permanent deletion | Permission RPC requires an active stored Super Admin; no self-permission changes. Payment records remain immutable. |
| Tutor Admin | Academic operations, tutor assignment, invoice creation and payment recording | No role/status management, settings, audit read or permanent deletion. Invoice cancellation and financial corrections remain pending an owner decision. |
| Tutor | Assigned students/classes and permitted academic work | No staff authority or ledger writes. |
| Parent | Linked children's permitted academic and financial records | Read access follows existing production policies; precise disclosure still requires export/review. |
| Student | Own permitted academic records | No staff or financial writes. |

Evidence for intended capabilities: `src/config/roles.js`. This describes the product's intended split; it does not establish every existing production grant or policy. The empty-project bootstrap is a local reference, not a migration for the existing production database.

The reported Tutor Admin profile-update policy has an uncorrelated comparison. The candidate narrows it to the caller's own name/phone edits. Whether Tutor Admin should edit other users' safe profile fields is unresolved; the conservative candidate must be reviewed against the actual policy export. Other application policies and existing `is_admin`/`is_super_admin`/`is_admin_tutor` helpers are not replaced by the profile/billing candidates.

No claim is made that the full production role matrix has been reproduced. See `LAUNCH-BLOCKER-FIXES.md` for evidence labels and outstanding decisions.
