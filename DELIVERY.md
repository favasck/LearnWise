# LearnWise Academy — Final Delivery

**Live URL:** https://learn-wise-umber.vercel.app  
**Build:** `npm run build` ✓ Zero errors  

---

## Changed Files

| File | What changed |
|---|---|
| `src/App.jsx` | Complete rewrite across all 12 steps. 3,189 lines. |
| `src/services/supabaseData.js` | New file. 80 Supabase query functions. |
| `src/AuthContext.jsx` | Unchanged (already correct from audit). |
| `src/supabaseClient.js` | Unchanged. |
| `src/main.jsx` | Unchanged. |
| `index.html` | Google Fonts moved here (was incorrectly in React tree). |
| `vercel.json` | SPA rewrite rule (already present, confirmed). |

---

## Supabase Setup Steps

### 1. Create a Supabase project
Go to https://supabase.com → New Project → choose a region close to Qatar.

### 2. Run the schema
In your Supabase project → SQL Editor → paste and run `supabase_setup.sql`.

This creates:
- 12 tables: `profiles`, `tutors`, `parents`, `students`, `student_tutors`, `classes`, `class_notes`, `homework`, `invoices`, `payments`, `materials`, `assessment_requests`
- Row-Level Security (RLS) on all tables
- `is_admin()` helper function (JWT-based, avoids recursion)
- Triggers for `updated_at` on all tables
- Indexes for common queries

### 3. Set Supabase Site URL
Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://learn-wise-umber.vercel.app`
- **Redirect URLs:** add `https://learn-wise-umber.vercel.app/**`

### 4. Create your admin account
1. Sign up at the app using the normal signup flow (choose any role)
2. In Supabase → Table Editor → `profiles` → find your row → set `role = admin`
3. Sign in again via the hidden dot (·) on the login screen → Staff Access

---

## Local Run Steps

```bash
# 1. Clone / copy project files
cd learnwise-academy

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env and add your real Supabase credentials:
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGc...

# 4. Run dev server
npm run dev
# Opens at http://localhost:5173

# 5. Build for production
npm run build
```

---

## Vercel Deployment Steps

### First deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment variables in Vercel
Dashboard → Your Project → Settings → Environment Variables:

| Key | Value | Environment |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Production ✓ |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Production ✓ |

> **Important:** Set both to **Production** scope. After adding, redeploy.

### GitHub auto-deploy
Push to `main` → Vercel auto-deploys. No extra config needed (vercel.json is already committed).

---

## What's Built

### Public website (8 pages)
- **Home** — Hero, features, how it works, testimonials, CTAs
- **About** — Mission, approach, tutor info
- **Subjects** — All 9 subjects with descriptions
- **IGCSE / Edexcel** — Curriculum support detail, exam prep approach
- **Online Tuition** — How online sessions work
- **Book Assessment** — Form saves to `assessment_requests` table
- **Contact** — Contact details + message form
- **Login** — Portal entry (via nav button)

### Admin portal (12 sections, real Supabase data)
Dashboard · All Users (with link profiles) · Students · Parents · Tutors · Classes · Attendance · Homework · Payments & Invoices · Assessment Requests · Reports · Settings

### Tutor portal (real Supabase data, scoped to tutor)
Dashboard · My Students · My Classes (with attendance) · Class Notes (CRUD, share flags) · Homework (CRUD, review) · Materials (CRUD, file links)

### Parent portal (real Supabase data, read-only)
Dashboard · My Child · Classes · Homework · Progress (tutor notes shared with parent) · Payments (invoices + payment history)

### Student portal (real Supabase data, read-only, no payments)
Dashboard · My Classes · Homework (with tutor feedback) · Materials (grouped by subject) · Progress (notes shared with student)

### Reports (5 types with aggregation)
1. Monthly Revenue — totals by student, full payment list
2. Pending Payments — unpaid invoices with balances
3. Attendance — present/absent/cancelled counts per student
4. Tutor Performance — completion rates per tutor
5. Student Progress — notes and profile per student

All reports have a **Print / Save PDF** button (browser print → Save as PDF).

---

## User Linking Workflow

1. Tutor/parent/student signs up via the public signup form
2. Admin goes to **All Users** → finds the new account
3. Clicks **Link** → selects the matching profile record (created in Tutors/Parents/Students section)
4. User signs in again → portal is now live with their real data

If no link exists, the user sees: *"Your account is active, but it has not yet been linked to a profile. Please contact the admin."*

---

## Remaining Limitations

| Item | Status | Notes |
|---|---|---|
| File uploads | Not built | Materials/homework file URLs must be pasted manually. Supabase Storage integration is Phase 5. |
| Email notifications | Not built | No automated emails on new homework/class/invoice. |
| Invoice PDF generation | Browser print only | `window.print()` → Save as PDF. A proper PDF library (jspdf) can be added if needed. |
| Messaging | Not built | No in-app tutor↔parent messaging. |
| Parent portal — mock data cleanup | Complete | All 6 parent sections now use real Supabase data. |
| Recurring class scheduling | Not built | Classes must be created individually. |
| Supabase Storage | Not configured | File upload UI exists in Materials; needs Supabase Storage bucket + policy. |
| RLS in production | Needs verification | Schema includes RLS policies. Verify with real multi-role accounts before go-live. |

---

## Key Architecture Notes

- **Single-file React app** (`App.jsx`) — no React Router, state-based navigation
- **Auth:** Supabase Auth. Hidden admin login via unlabeled `·` dot on sign-in card
- **Role isolation:** Enforced by Supabase RLS on every table. Frontend filtering is secondary
- **QAR throughout:** All monetary values use `fmt(n)` = `QAR X,XXX`
- **Mock data:** Still present for internal reference but only used by legacy functions that are no longer reachable in production (admin/tutor/parent/student portals all use real data)
- **Chunk size warning:** Expected for a single-file SPA of this size. Not an error
