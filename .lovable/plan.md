
## Goal
Add a public regular-user signup flow (no email), a user dashboard, and split the admin Users page into "Admin Users" and "Users" sections.

## Database (migration)

1. Add `'user'` to the `app_role` enum.
2. Create `public.user_profiles`:
   - `user_id uuid PK references auth.users on delete cascade`
   - `username text unique not null` (lowercased)
   - `facility text not null` (e.g. `pennington_sd`, `campbell_ky`)
   - `created_at`, `updated_at`
   - RLS: users can read/update their own row; admins manage all.
3. RLS allow username uniqueness lookup via a `SECURITY DEFINER` function `public.username_exists(text)` so the signup form can validate without exposing the table publicly.

## Server functions

`src/lib/user-signup.functions.ts` (no auth middleware, uses `supabaseAdmin`):

- `getSignupChallenge()` — returns `{ token, a, b }`. Token = base64(`${a}:${b}:${expiresAt}:${hmac}`) signed with `SIGNUP_CHALLENGE_SECRET` (auto-generated fallback). Used as math captcha.
- `signupUser({ username, password, facility, challengeToken, challengeAnswer, honeypot })`:
  - Reject if honeypot non-empty.
  - Verify HMAC token, expiry (<5 min), and that `a+b === answer`.
  - Rate limit: max 3 signups per IP per hour via `user_signup_ips` lookup.
  - Validate username `^[a-z0-9_]{3,32}$`, password 8–72.
  - Create auth user with synthetic email `${username}@users.local`, `email_confirm: true`.
  - Insert `user_profiles` row.
  - Assign `user` role.
  - Record signup IP.
  - Return `{ email }` so client can immediately `signInWithPassword`.

Update `src/lib/users.functions.ts`:

- `listUsers` now also returns each user's `profile: { username, facility } | null`.

## Frontend

### `/signup` route (public)
- Form: username, password, facility `<Select>` (Pennington, SD / Campbell, KY), math captcha ("What is {a} + {b}?"), hidden honeypot input.
- On submit: call `signupUser`, then `supabase.auth.signInWithPassword({ email: synthetic, password })`, then `navigate({ to: '/dashboard' })`.
- Includes link to `/signup` toggle for "already have an account? sign in" → same form in sign-in mode (username → synthetic email lookup, then password sign-in).

### `/dashboard` route (auth-required, user role)
- Shows account info: username, facility (pretty name), join date.
- Loaded via server function reading the current user's profile.

### `SiteHeader`
- New `isUser` helper from `useAuth` (already has roles).
- If signed in as plain `user` role: show `Dashboard` link (instead of `Admin`) + `Sign out`.
- Show `Sign up` link for everyone (visible publicly) pointing to `/signup`.
- Existing admin `Sign in` link stays gated by IP allowlist as it is today.

### `/admin/users`
- Split list into two sections: **Admin Users** (anyone with admin or contributor role) and **Users** (role = `user` or no role). Each section reuses `UserItem`. Users section displays `username` and facility instead of email when available.

## Tech details / files

New:
- `supabase/migrations/...` via migration tool
- `src/lib/user-signup.functions.ts`
- `src/routes/signup.tsx`
- `src/routes/dashboard.tsx`

Modified:
- `src/lib/users.functions.ts` (listUsers includes profile)
- `src/routes/admin.users.tsx` (split sections, show username/facility)
- `src/components/SiteHeader.tsx` (Dashboard + public Sign up link)
- `src/hooks/use-auth.ts` (expose `isUser`)

## Anti-spam summary
1. Honeypot hidden field.
2. Server-issued HMAC-signed math challenge with 5-minute expiry.
3. Per-IP rate limit (3 signups/hour) via `user_signup_ips`.
4. Strict username regex + password length.
