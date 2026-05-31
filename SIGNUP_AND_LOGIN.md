# Sign Up & Login — Security Reference

This document covers every security measure and feature in the user sign-up and sign-in flow.

---

## Sign Up

### Input Validation (Server-Side)

All sign-up fields are validated server-side before any account is created:

| Field | Rules |
|---|---|
| Username | 3–32 characters, letters/numbers/underscore only (`[a-z0-9_]`), lowercased |
| First name | Required, max 100 characters |
| Last name | Required, max 100 characters |
| Password | 8–72 characters |
| Facility | Required, max 64 characters, must exist in the facilities table |
| Inmate PIN | Numbers only, **required** |
| Security answers | Min 2 characters each, max 200, must choose two different questions |

### Honeypot Bot Detection

A hidden form field is included that real users never see or fill in. If any value is submitted in that field, the request is immediately rejected. Bots that blindly fill all form fields are caught by this check.

### Math Captcha

Before submitting the sign-up form, users must solve a simple math challenge (e.g. "What is 4 + 7?"). The challenge is:

- Generated server-side as a random addition of two single-digit numbers
- Signed with HMAC-SHA256 using a dedicated server secret (`SIGNUP_CHALLENGE_SECRET`) so the answer cannot be forged
- Verified using timing-safe comparison to prevent timing attacks
- Expires after 5 minutes — stale tokens are rejected
- Rate limited: max 10 challenge requests per IP per minute, preventing brute-force of the 81 possible answers

### Username Uniqueness

Before creating the account, the server calls a database function to verify the username is not already taken. This check happens server-side — the client-side availability indicator is a convenience only.

### Facility Validation

The submitted facility value is checked against the `facilities` table. A user cannot assign themselves to a facility that doesn't exist.

### Inmate PIN Uniqueness

If a PIN is included in the sign-up URL (`?user=PIN`), the server checks whether that PIN is already registered at that facility. If it is, the sign-up form is blocked entirely and only an error message is shown — no input fields are displayed, making it clear the user should sign in instead.

### Rate Limiting

IP-based rate limiting for sign-up is intentionally not applied. Every inmate at a facility shares the same external IP address, so a per-IP limit would block an entire facility after only a handful of sign-ups. Instead, the inmate PIN acts as the hard gate — a PIN can only be used once, making scripted account creation impossible regardless of how many requests are made. The captcha still blocks bots that lack a valid PIN.

### Security Questions

Users are required to set up 2 security questions during sign-up (or immediately after). Answers are:
- Trimmed and normalized before hashing
- Hashed using a server-side secret before storage — raw answers are never saved
- Required before the user can access the rest of the app (the dashboard and other tabs are locked until questions are set)

---

## Sign In

### Username Enumeration Prevention

Sign-in errors always return a generic message ("Incorrect username or password") regardless of whether the username exists. An attacker cannot determine which usernames are registered by analyzing error messages.

### Facility + PIN Gate (Shared Device Security)

When a user accesses the app via a URL containing `?site=facilityId&user=PIN`, an additional security check runs after successful authentication:

1. The user enters their username and password
2. Supabase verifies the credentials (standard auth)
3. The server then checks:
   - The authenticated user's `facility` matches the facility in the URL
   - The authenticated user's `inmate_pin` matches the PIN in the URL
4. If either check fails, the user is **immediately signed out** and shown an error — they never reach the dashboard

**Why this order matters:** Checking after auth (not before) prevents username enumeration — an attacker can't probe whether a username exists by watching how the PIN check responds.

**Role exemptions:** Admin, contributor, and facilityUser accounts bypass this check entirely. Staff can sign in from any device regardless of the PIN in the URL.

**Nav freeze:** While the post-auth check is running, the navigation bar stays in its unauthenticated state so users don't see a brief flash of the authenticated interface before a potential rejection.

### Session Storage Cleared for Staff

When an admin, contributor, or facilityUser signs in, the active facility slug and inmate PIN are cleared from session storage. This prevents staff from being inadvertently sent to facility-specific URLs (`/?site=...&user=...`) after signing in or out.

### Sign-Out URL Preservation

When a user signs out, they are redirected back to the full original URL including the facility and PIN parameters (e.g. `/?site=S003007001&user=123456`). This ensures the next person to pick up the tablet must use the correct PIN to sign in — they cannot bypass the PIN gate simply because the URL no longer shows the PIN.

---

## Password Reset

### Username Enumeration Prevention

The "forgot password" flow uses security questions instead of email. When fetching questions for a username:
- If the username does not exist, **fake stable question keys are returned** derived deterministically from the username — the response looks identical to a valid username response
- This prevents an attacker from probing which usernames are registered

### PIN + Facility Verification (Shared Device)

On shared facility devices (where `?site=` and `?user=PIN` are in session), the reset flow adds an additional check at Step 1:

1. The session PIN and facility are sent automatically alongside the username — no extra input is shown to the user
2. The server verifies the entered username has a matching `inmate_pin` AND `facility` in the database
3. If either doesn't match, **fake question keys are returned** — the same response as a non-existent username — so nothing is leaked about which check failed
4. The user appears to advance to Step 2 but will be unable to complete the reset without knowing the real answers

This prevents one inmate from initiating a password reset for another inmate's account on a shared tablet.

### Rate Limiting

Two separate rate limits apply:

| Action | Limit |
|---|---|
| Fetching security questions (probing) | 30 attempts per IP per hour |
| Submitting reset answers + new password | 8 attempts per IP per hour |

The reset attempt check uses a **Postgres advisory lock** (`pg_advisory_xact_lock`) to make the count-check and insert atomic — concurrent requests cannot race past the limit.

### Generic Error Messages

All reset errors ("username not found", "wrong answers", etc.) use the same generic message: *"Username or security answers are incorrect."* This prevents leaking whether the username exists or whether the answers were partially correct.

### Answer Verification

Security question answers are verified using the same server-side hashing used at sign-up. Raw answers are never stored or compared — only hashes.

---

## Shared Security Infrastructure

### Signed Secrets

The math captcha challenge uses HMAC-SHA256 signed with `SIGNUP_CHALLENGE_SECRET` — a dedicated environment variable that must be at least 32 characters. The app hard-fails at startup if this secret is missing, preventing accidental deployment without it.

### IP Detection

Rate limiting uses the `cf-connecting-ip` header set by Cloudflare, which cannot be spoofed by clients when traffic passes through Cloudflare's proxy (the standard deployment configuration).

### Synthetic Email Addresses

Usernames (not email addresses) are the primary login identifier. Internally, accounts use a synthetic email format (`username@users.local`) so the Supabase auth system can function while keeping the username-based experience for users.

### Row-Level Security

All user data tables have Row-Level Security (RLS) enabled in Supabase. Users can only read and write their own data. The server uses a service-role client (`supabaseAdmin`) for admin operations, which bypasses RLS intentionally for privileged server-side logic only.
