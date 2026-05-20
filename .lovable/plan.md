## Feature: Security Questions for User Password Reset

Adds a self-service password reset flow for regular users (the `user` role) based on two security questions chosen at signup. Admins are unaffected.

### 1. Question bank

A fixed pool of ~10 simple questions, e.g.:
- What was the name of your first pet?
- What city were you born in?
- What is your mother's maiden name?
- What was the make of your first car?
- What was the name of your elementary school?
- What is your favorite food?
- What was your childhood nickname?
- What street did you grow up on?
- What is your favorite color?
- What is your favorite movie?

On each signup the form randomly picks 3 from the bank and asks the user to pick any 2 and answer them (so users aren't locked into a single pair). Both question + answer are stored. Questions are also translated to Spanish via the existing i18n system.

### 2. Database

New table `user_security_answers`:
- `user_id` (uuid, FK to auth.users, cascade delete)
- `question_key` (text, e.g. `first_pet`)
- `answer_hash` (text, bcrypt-style hash of lowercased+trimmed answer)
- `created_at`, `updated_at`
- Unique on `(user_id, question_key)`; each user has exactly 2 rows.

RLS:
- Users can view/insert/update/delete their own rows (via `auth.uid()`).
- Admins can manage all.
- Reset flow itself runs server-side via `supabaseAdmin` (no row exposure to anon).

Plus a small `password_reset_attempts` table keyed by IP+username for rate limiting (5 failed attempts/hour → block 1 hour).

### 3. Server functions (`src/lib/password-reset.functions.ts`)

- `getResetQuestions({ username })` → returns the user's 2 `question_key`s (or generic error to avoid username enumeration leaking detail; always return 2 fake keys on miss, but the next step will fail).
- `resetPassword({ username, answers: [{key, value}, {key, value}], newPassword })` → admin-side: looks up user, verifies both answer hashes, rate-limits, then `supabaseAdmin.auth.admin.updateUserById(id, { password })`. Returns `{ email }` so the client can immediately sign in.
- `updateSecurityAnswers({ answers: [...] })` (auth-required) → replaces the signed-in user's 2 rows.
- Signup flow extended: `signupUser` accepts `securityAnswers: [{key,value},{key,value}]` and writes hashes alongside profile creation. Signup is rejected if not exactly 2 distinct keys provided.

Hashing: use Web Crypto SHA-256 with a per-row random salt (workerd-compatible, no native bcrypt). Salt stored in the hash string as `salt$hex`.

### 4. Frontend

**`/signup`** — add a "Security questions" section after Facility:
- Show 3 random question dropdowns (from bank) with answer inputs; client must fill at least 2. If all 3 are filled, take the first 2. Validation: answers ≥ 2 chars.

**`/signup` (sign-in mode)** — add a "Forgot password?" link → opens a small inline flow:
1. Enter username → fetch questions.
2. Answer both questions + enter new password (min 8) → submit.
3. On success, auto sign-in and redirect to `/dashboard`.

**`/dashboard`** — add a "Security questions" card:
- Shows current 2 questions (not answers).
- "Update questions" button reveals the same 3-random-question selector + answer inputs to replace both rows. Submitting calls `updateSecurityAnswers`.

All new strings added to `src/lib/i18n.tsx` for EN + ES.

### Technical notes

- Question keys are stable identifiers; labels come from i18n (`security.q.first_pet`, etc.) so they translate automatically.
- Answers normalized before hashing: `value.trim().toLowerCase()`.
- Rate limit and answer comparison both use constant-time compare.
- No email is exposed; reset uses synthetic `{username}@users.local` internally.
- Existing users with no security answers: dashboard prompts them to set 2 the next time they sign in; reset flow returns generic error.

### Files

New:
- `src/lib/password-reset.functions.ts`
- `src/lib/security-questions.ts` (shared question bank + key list)
- `supabase/migrations/<ts>_security_questions.sql`

Edited:
- `src/lib/user-signup.functions.ts` (accept + store answers on signup)
- `src/routes/signup.tsx` (signup question selector + forgot-password flow)
- `src/routes/dashboard.tsx` (manage questions card)
- `src/lib/i18n.tsx` (EN/ES strings for questions + UI labels)
