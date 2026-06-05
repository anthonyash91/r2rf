# User Roles & Permissions

This document describes every role in the Reentry to Recovery platform, what each role can do, and where access is enforced.

---

## Role Overview

| Role | Who they are | Admin panel access |
|---|---|---|
| **Regular User** | Incarcerated individuals using the content library | None |
| **Tester** | QA/testing accounts | None |
| **Contributor** | Content editors and writers | Content editing only |
| **Facility User** | Facility staff (counselors, administrators) | Analytics + user management for their facility |
| **Admin** | Platform administrators | Full unrestricted access |

---

## Regular User

Regular users are the primary audience — incarcerated individuals working through the content library.

**What they can do:**
- Browse all published categories and content items available to their facility
- Track their own progress (completed items, session time, media position)
- Earn achievements as they reach milestones
- Bookmark content items to their Saved tab
- Rate content as Helpful or Not Helpful (after completing an item)
- View their own dashboard — overall progress ring, stat cards, engagement tier, category accordion
- View their own monthly summary (items completed this month vs. last month, time spent, achievements earned)
- Use the account recovery flow (security questions, password reset)
- Clear their own forced-reset password flag (`clearMustResetPassword` — self-service)

**What they cannot do:**
- See any other user's data
- Access any admin page or tool
- Modify content, categories, or settings

**Activity counts in analytics:** Yes — their completions, time, and engagement are included in all reports and statistics.

---

## Tester

Tester accounts are dedicated QA accounts. Rather than seeing the regular user dashboard, testers see an entirely separate **QA Testing interface** — no progress rings, categories, achievements, bookmarks, or account settings.

**The key distinction:** All tester activity is **excluded from every analytics calculation** at the database query level:
- Not counted in completion rates, open counts, or drop-off rates
- Not counted in facility user totals, active user counts, or participation rates
- Not counted in growth charts, retention rates, or program completion stats
- Not included in engagement tier rankings
- Not included in time totals

Testers are marked with `is_synthetic = true` in the database and carry all five roles (`tester`, `user`, `admin`, `contributor`, `facilityUser`) in `user_roles`. The `is_synthetic` flag ensures they are excluded from all analytics regardless of which roles are active.

**Role Switcher:**

A floating **Role Switcher** (flask icon, bottom-left of every page) is visible only to tester accounts. It lets the tester simulate any role without creating additional accounts:

| Simulated role | What the tester sees |
|---|---|
| Regular User | Normal user dashboard, no admin access |
| Admin | Full admin panel |
| Contributor | Content editing admin pages only |
| Facility User | Analytics and user management scoped to CPC Sales facility |

Switching role updates the UI immediately and navigates to the appropriate landing page. The selected role is persisted in `localStorage` so it survives page refreshes. The tester always remains excluded from analytics regardless of the simulated role.

New tester accounts are automatically assigned to the **CPC Sales** facility (`S003007001`) so the Facility User simulation has real data to display. Existing tester accounts can be upgraded to the full role set via the **Upgrade to full role set** button (wrench icon) on the Admin → Users page.

**Engagement debug panel:**

While viewing content as a tester, a debug overlay (top-right corner) shows live engagement tracking data: idle timer countdown, hook active state, session seconds accumulated, base seconds from DB, total that will be saved, and media position for video/audio. This panel is only visible to tester accounts.

**QA Testing interface:**

When a tester signs in they see the **QA Testing** page — a full interactive version of the 248-test QA checklist organized into 18 sections. Features:

- **Test runs** — create labeled sessions (e.g. "Post-deploy June 3"); each run has independent state; old runs are preserved for comparison
- **Per-test status** — set each test to Pass / Fail / Blocked / Skipped / Untested using icon buttons on each test row
- **Notes** — collapsed by default; an "Add note" button (+ icon) sits on the right of the status buttons row. Clicking it expands a textarea. For Fail and Blocked statuses, the notes section opens automatically since an explanation is expected. The "Add note" button becomes "Remove note" (− icon) when notes are open; clicking it clears the note and collapses the section. The "Save note" button is disabled and dimmed until text is entered in the notes field; once text is present it becomes active. After saving it shows "Saved ✓" and reverts to "Save note" when you start typing again. Notes are not removable for Fail or Blocked — those statuses always keep the notes section open
- **Screenshots** — an "Attach screenshot" button (dashed, image icon) appears below the notes field for Fail, Blocked, and Skipped tests. After upload it becomes a "View screenshot" button. Screenshots are stored in Supabase Storage and linked to the test result
- **Section accordions** — 18 sections, each with a progress ring, pass/fail counts, and expandable item list
- **Filters** — filter by status (All / Pass / Fail / Blocked / Skipped / Untested) and priority (All / Critical / High / Medium / Low), each with a corresponding icon
- **Failures panel** — all failed tests surface at the top of an active run with their notes and screenshot links for quick visibility
- **Progress ring** — shows actioned/total tests with a full status breakdown (passed / failed / blocked / skipped / untested)
- **Complete / Reopen** — mark a run complete to lock it read-only; reopen to continue editing
- Security question setup is not required for tester accounts

**Admin panel access:** Via Role Switcher only. Tester results are visible to admins via `/admin/test-results`.

**"Are you still here?" idle prompt:**

For static content items (articles, worksheets, PDFs, guides, links — not video or audio), the session timer stops after 90 seconds of no interaction (no scrolling, clicking, or typing). A centered modal appears over the content with a 20-second countdown asking "Are you still here?" Tapping **Yes, I'm still here** resets the timer and resumes tracking. If ignored, the modal dismisses and the timer stays paused until the next real interaction.

After each confirmation the idle threshold progressively extends — 90 seconds → 3 minutes → 5 minutes (capped) — so engaged passive readers are interrupted less frequently over time. Video and audio items are unaffected; their time is tracked via media playback position regardless of interaction.

---

## Contributor

Contributors are content editors. Their role is to build and maintain the content library. They have no access to user data or analytics.

**Admin pages accessible:**
- `/admin/category/$id` — full content editing (categories and items)
- `/admin/privacy` — privacy policy editor
- `/admin/terms` — terms of service editor

**What they can do:**
- Create, edit, publish, and delete categories and content items
- Set category and item facility restrictions
- Upload and manage files (images, PDFs, audio, video)
- Use AI to generate content descriptions and Spanish translations
- Edit legal content pages (privacy policy, terms of service)
- Configure the item's "Exempt from tracking" flag

**What they cannot do:**
- Access analytics or any reporting — no usage reports, no user progress reports, no facility comparison
- Access the user management page (`/admin/users`)
- Access messages, facilities, home page editor, icons & badges, IP allowlist, audit log, error log, seed tool, or certificate editor
- Create, delete, or manage user accounts
- Assign or revoke roles

---

## Facility User

Facility Users are staff accounts created by administrators for specific facilities (e.g., a prison counselor). Every action they take is scoped to their assigned facility and enforced server-side — client-side input for the facility value is ignored if it doesn't match their assigned facility.

**Admin pages accessible:**
- `/admin/analytics` — analytics, reports, and user progress for their facility only
- `/admin/users` — user list and management for their facility only
- `/admin/messages` — facility message editor (their facility only; they see only their facility's editor, not others)

**What they can do:**

*Analytics (own facility only):*
- View usage report for their facility
- View growth stats, retention rates, facility-scoped program completion
- View the facility user list with engagement tiers
- View individual user progress reports for users in their facility
- Export all reports as CSV

*User management (own facility's regular users only):*
- View the list of registered users at their facility
- View list of facility staff accounts at their facility
- Set a user's password
- Send a password reset email
- Resend a verification email
- Clear a user's security questions

*Messaging:*
- View and edit their facility's message banner

**What they cannot do:**
- See any data from other facilities
- Manage users at other facilities or any admin/contributor/tester accounts
- Create or delete user accounts
- Assign or revoke roles
- Access content editing, home page, icons & badges, facilities management, audit log, error log, IP allowlist, seed tool, or certificate editor
- Trigger the nightly analytics refresh

**Self-management:** A Facility User can always manage their own account, regardless of facility.

---

## Admin

Admins have unrestricted access to every feature on the platform.

**Admin pages accessible:** All of them.

**What they can do:**
- Everything a Contributor and Facility User can do
- Access analytics for all facilities without scoping
- Create, edit, and delete users of all types (regular users, testers, contributors, facility users)
- Assign and revoke roles
- Create, update, and delete facilities
- Configure the home page and certificate page hero copy
- Configure icons & badges for all content types and variants
- Manage IP allowlist and blocklist
- Bulk-seed content items via CSV
- View the audit log and error log
- Trigger the nightly analytics refresh manually

**Protections:**
- An admin cannot delete their own account
- An admin cannot remove their own admin role

---

## Access Control Architecture

Access is enforced at two independent layers:

**Route level (client-side guard):** Each admin route has a `beforeLoad` guard that checks the user's role before the page loads. A user without the required role is immediately redirected.

| Guard | Roles allowed | Used by |
|---|---|---|
| `requireStrictAdminBeforeLoad` | Admin only | home, icons-badges, facilities, audit-log, errors, ip-allowlist, seed, certificate |
| `requireContentAdminBeforeLoad` | Admin, Contributor | category editor, privacy, terms |
| `requireAnalyticsAdminBeforeLoad` | Admin, Facility User | analytics, messages |
| `requireUserManagementAdminBeforeLoad` | Admin, Facility User | users |

**Server function level (server-side auth):** Every server function independently verifies the caller's role using `supabaseAdmin`. Route guards can be bypassed by a determined user — the server functions are the real security boundary.

| Assertion | Roles checked | Used for |
|---|---|---|
| `assertStrictAdmin` | Admin only | Nightly refresh trigger |
| `assertAnalyticsAdmin` | Admin, Facility User | All analytics and reporting functions |
| `assertUserManagementAdmin` | Admin, Facility User | User list functions |
| `assertCanManageUser` | Admin, Facility User (scoped) | Per-user password and security operations |
| `assertAdmin` (strict) | Admin only | User creation, deletion, role management, facility management |
| `assertAdminOrContributor` | Admin, Contributor | Content AI generation, file storage |

---

## Analytics Exclusions

The following are excluded from all analytics data and pre-computed statistics:

- Admin accounts
- Contributor accounts
- Tester accounts (`tester` role and/or `is_synthetic = true`)
- Facility User accounts
- The placeholder user ID `00000000-0000-0000-0000-000000000000`
- Progress records for items marked **Exempt from tracking** (see below)

---

## Exempt from Tracking (Content Items)

Any content item can be marked **Exempt from tracking** in the content editor. This is intended for informational items that are not educational in the Reentry to Recovery sense — e.g., "How to take this course" or "How to set up payments."

**Effect of exemption:**
- The item still appears in the category list and is accessible to users
- Users see an "Acknowledge" button instead of the normal completion button; after acknowledging, it shows "Acknowledged"
- A disclaimer reads "Doesn't count toward your progress" beneath the button
- An info icon (ⓘ) appears next to the item title explaining it is informational
- The item is **excluded from:**
  - Progress bar denominators (e.g., a category with 10 items and 1 exempt shows "X of 9 completed")
  - Monthly summary item counts
  - All admin analytics and completion rate calculations
  - Achievement milestone counts
  - Engagement tier and percentile calculations
  - The nightly pre-computed statistics (`content_item_stats`, `facility_stats`, `user_stats`, `analytics_program_completion`)
- In admin user progress reports, exempt items are shown in the item list with "Acknowledge/Acknowledged" badge and a disclaimer, but are not counted in the "X of Y items completed" totals or category completion rings
