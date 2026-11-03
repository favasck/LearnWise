# Product specification

LearnWise Academy: Smart Guidance. Better Learning. Qatar tutoring and exam preparation, initially Pearson Edexcel International GCSE, with future GCC/international expansion. Separate product and data domain from Schome.

Delivery order: secure existing tuition operations; complete scheduling, attendance and billing; add curriculum resources and academic assessment; then integrations and independent-tutor marketplace. Preserve existing workflows and avoid duplicate implementations.

Canonical intended roles are super_admin, admin_tutor, tutor, parent and student. Actual authorization must be enforced by the database. Legacy admin ownership is unresolved and must not be automatically converted.

Default operating timezone is Asia/Qatar; store instants with timezone. Money uses exact decimal values with documented rounding. No live payment gateway, paid messaging, production deployment or copyrighted resource redistribution without the necessary authorization.

Scheduling must support recurrence with individual exceptions, tutor/student views, transactional conflict protection, cancellation and make-up policies. Billing must preserve correction history, prevent duplicate posting and connect charges to classes/packages. Academic content follows board → qualification → subject → specification → unit → topic → objective; resources need rights metadata and protected files. Mastery must derive from documented real assessment evidence.

Done means working UI and persistence, database authorization, validation/error handling, required audit events, passing relevant automated tests, end-to-end verification where applicable, preserved existing behavior and current documentation. No fixed delivery deadlines are assumed.
