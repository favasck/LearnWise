# Role permissions

| Intended role | Intended authority | Baseline mismatch |
|---|---|---|
| super_admin | Platform administration, roles, settings, authorized deletion, audit | Not accepted by SQL role constraint/helper |
| admin_tutor | Authorized academic/tuition operations; no unrestricted roles/deletion | Frontend shares unguarded admin mutation components; SQL does not recognize role |
| tutor | Assigned students/classes, owned academic records, limited attendance | SQL permits broad owned-row writes and lacks assignment validation for content |
| parent | Linked children's permitted academic and financial views | Row scopes exist; column disclosure/recursion/revocation need verification |
| student | Own permitted academic data and homework submission | UI is read-only; submission SQL grants whole-row update |
| legacy admin | Existing SQL administrative authority | Requires ownership inventory before canonical mapping |

Batch 1 preserves the actual baseline role model. Ordinary authenticated users can edit only full_name/phone on rows allowed by existing RLS. Permission changes require active legacy admin via RPC and cannot target the actor themselves. No canonical role is granted by this migration.

Next authorization review must decide legacy account mapping, Tutor Admin scope, organization ownership, self-service field policy and sensitive-action reasons. Then implement separate DB capabilities and test each role/action/relationship pair, including suspended sessions and revoked assignments.
