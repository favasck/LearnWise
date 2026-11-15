# Master calendar

Route: `/portal/calendar`, available as **Master Calendar** in every portal. Added 15 November 2026.

## Calendar layers and filters

Month and agenda views combine scoped classes, student exams, pending/proposed booking occurrences, homework deadlines, manually entered tasks/dates, and a sourced master-date catalogue. Type checkboxes support any combination or one category at a time: Classes, Exam dates, Qatar holidays & dates, Tasks & homework, Booking requests, Other dates. Additional filters cover exam board, subject/paper/title/series search, month, task status and retained removals. The exam-board filter only narrows exam events; selected classes/tasks remain visible. Multi-day windows appear throughout their inclusive date range. Day cells show three entries and a button to view the rest.

Operational records keep their existing database scope. Master event controls do not move/cancel classes, alter booking approvals, edit homework or replace a student's registered exam. Detail actions open the appropriate existing portal section. Unlinked active accounts may view general shared dates; database policies still prevent reading other families' operational records.

## Published reference dates

`src/data/masterCalendarDates.json` contains factual paper/date/session/duration/source-page tuples checked on 2026-11-15 against official final timetables:

| Board/series | Coverage | Entries | Source |
| --- | --- | ---: | --- |
| Cambridge November 2026 | IGCSE / IGCSE (9–1), Zone 3 | 196 | [Official timetable](https://www.cambridgeinternational.org/Images/757648-november-2026-zone-3-timetable.pdf) |
| Cambridge June 2027 | IGCSE / IGCSE (9–1), Zone 3 | 242 | [Official timetable](https://www.cambridgeinternational.org/Images/766281-june-2027-zone-3-timetable.pdf) |
| Pearson Edexcel November 2026 | International GCSE, standard papers | 78 | [Official timetable](https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-Edexcel-International-GCSE/intgcse-nov-2026-final.pdf) |
| Pearson Edexcel Summer 2027 | International GCSE, standard non-R papers | 113 | [Official timetable](https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-Edexcel-International-GCSE/int-gcse-summer-2027-final.pdf) |

There are 629 preloaded paper/window entries. Practical windows repeated across multiple weekdays in Pearson's weekly view are combined into one range. Cambridge windows and syllabus entries come from the corresponding IGCSE sections; O Level and A Level are excluded. The calendar now links all six Cambridge administrative zones for November 2026 and June 2027, plus Pearson Summer 2027 regional R papers and the November 2027 provisional timetable. Those additional sources are explicitly labelled **source only** until their paper/date rows are imported. The exam-zone/variant filter narrows loaded entries, and selecting a linked-but-unloaded zone shows the official sources and prompts a tutor to add the centre's exact dates. No dates are inferred across zones or series. Results dates and entry deadlines remain out of scope. Every preloaded row links to its PDF and source page; all official timetable links are listed inside the calendar.

No Qatar start time is inferred from AM/PM or a published UK session. Reference exams are date-only entries with the board's session label; exact local time, zone and paper eligibility must be confirmed with the exam centre. A practical/speaking window is not a guaranteed sitting on every date. These master references do not enrol students or block all tutoring sessions. The existing student-specific exam records continue to prevent overlapping booking confirmations.

Qatar dates are generated for the year currently displayed. National Day (18 December) and National Sports Day (second Tuesday in February) follow the [Council of Ministers' official holiday rules](https://www.cm.gov.qa/en/Pages/official_holidays.aspx). Eid holiday ranges and Ramadan's first day are **provisional projections**, converted with the runtime's Islamic Umm al-Qura calendar. They are explicitly labelled estimated and may differ from Qatar announcements. Ramadan is labelled an observance, not a public holiday. A tutor can replace a projected date when an official announcement is available.

## Tutor control and privacy

Active Tutor, Admin Tutor and Super Admin accounts can add/edit/remove shared master dates. Changes to shared dates affect all active accounts and are labelled accordingly in the editor and remove button. A tutor's personal preparation tasks default to **private**, visible only to the author and Super Admin. Families can read shared master dates but cannot author or alter them.

Published reference dates remain a versioned source catalogue. Editing/removing one writes a single `calendar_entries.catalog_key` override; the original date/source remains available for comparison. Removal is retained through `deleted_at`; tutors can enable the removed-entry filter and restore it. Custom entries use the same retained deletion. The unique catalogue key prevents duplicate overrides, and optimistic `version` matching rejects stale updates. Tutor changes are marked Tutor entered / Provisional / Centre confirmed instead of claiming to be a new official timetable publication.

All reads and writes use RLS. Authenticated column grants prevent forged ownership, identity, version and audit metadata; permanent DELETE is not granted. Only the author or Super Admin may change an existing entry's visibility. The server authors version/edit metadata and general audit history. Shared factual dates never include a student foreign key. Do not put private student details in a shared master event.

## Deployment and validation

Database source: `docs/sql/master_calendar.sql`, applied after scoped teams and recurring booking support as Supabase migration `20261115093641_master_calendar_entries_and_tutor_overrides`. The local Supabase CLI package is unavailable, so the connected migration tool generated and recorded the version. No live test events or student records were inserted.

All 167 local tests pass. New tests cover source/date integrity, unique IDs, known paper dates, provisional holiday flags, combined filters, time boundaries, scoped/private reads, family write denial, tutor shared edits, immutable identity, stale versions, retained removal/restoration/audit, UI retries and operational navigation. Production build and built-application render checks pass. The calendar and its date catalogue load in a separate JavaScript chunk. Authenticated browser and mobile visual acceptance have not been performed.

The catalogue is a dated snapshot, not an automatic feed. Review official revisions and future series before updating the JSON; preserve catalogue keys so tutor overrides/removals survive refreshes. Keep AM/PM labels date-only until the centre confirms local times.

