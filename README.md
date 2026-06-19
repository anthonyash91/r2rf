# Reentry to Recovery — Content Library

A platform for incarcerated individuals to access educational resources organized into topic categories such as health, recovery, employment, family, and legal navigation. The platform tracks real engagement (not estimates), supports bilingual content in English and Spanish, and provides detailed analytics for facility staff and program administrators.

---

## Table of Contents

1. [Main Page](#1-main-page)
2. [User Dashboard](#2-user-dashboard)
3. [Admin Panel](#3-admin-panel)

---

# 1. Main Page

The main page (`/`) is the content library home — accessible to anyone who visits the platform, with additional features unlocked after signing in.

---

## Navigation Bar

A sticky top bar present on every page of the platform. Contains:

- **Logo / site name** — always links back to the home page, preserving the active facility and PIN context in the URL so the user isn't dropped out of their facility's session
- **Categories** — navigates back to the main content home
- **My Dashboard** — visible only to signed-in regular users; links to the personal progress dashboard
- **Admin** — visible only to admin, contributor, and facility user accounts
- **Sign In / Sign Out** — sign in opens the account creation and login flow; sign out ends the session and redirects to the facility URL (preserving `?site=` and `?user=` so the next person picking up the shared tablet must re-authenticate)
- **Language toggle (EN / ES)** — switches the entire interface between English and Spanish instantly, including navigation labels, category names, descriptions, content text, and action badges where translations have been provided. The selected language persists across sessions via localStorage.

The navigation bar is fully responsive — on mobile it collapses into a hamburger menu.

---

## Message Banners

Up to two dismissible announcement banners can appear directly below the navigation bar:

- **Site-wide message** — set by platform administrators, shown to all users regardless of facility
- **Facility message** — set per facility, shown only to users from that specific facility. Logged-in users have their facility auto-detected; anonymous visitors on a facility-specific URL see the facility's message based on the URL slug.

**Dismissal behavior:** Each banner can be dismissed individually. For signed-in users, the dismissal is stored in the database so it persists across devices and sessions. For anonymous visitors, dismissal is stored in sessionStorage and resets when the browser tab is closed. If an administrator updates the message content, the banner reappears to all users — including those who previously dismissed it.

Banners support English and Spanish translations. Facility messages can be authored and translated using the AI-assisted translation feature in the admin Messages page.

---

## Hero Section

The top area of the home page features a customizable hero block with:

- An eyebrow label (short intro phrase)
- A headline
- A subheading

All three fields are editable by administrators via the Home Page Editor and support English and Spanish versions.

---

## Search

A full-text search bar sits on the same line as the category grid heading. Features:

- Activates after two or more characters are typed
- Searches across all content item **titles and descriptions** within categories the user is permitted to see (facility restrictions are respected)
- Results replace the category grid and show as a flat card grid with: category icon, category name, content type badge, item title, and bookmark button (for signed-in users)
- Clearing the search field restores the normal category grid
- Available to all visitors — sign-in is not required to search

---

## Categories / Items Counter

A summary line above the category grid shows **"X Categories / Y Items"** — the total number of published categories and content items visible to the current user. Both numbers respect facility restrictions and update when content is added or removed. Fully translated in Spanish.

---

## Category Grid

The main content of the home page — a responsive grid of category cards (4 columns on large screens, narrowing to 1 on mobile). Each card represents a program or topic area.

### Each Card Shows:

**Icon** — a colored icon in a rounded tile with a matching background tint, selected by the administrator.

**Category name** — the topic title, displayed in the user's active language.

**Tagline** — a short description below the name; also translatable.

**Item count badge** — the number of content items in this category that are visible to the current user (facility-restricted items hidden for users outside that facility).

**"New content" badge** — appears when items have been added to the category within the last 7 days that the user has not yet opened. Disappears once those items are opened or engaged with.

**Progress bar** *(signed-in users only)* — a thin bar at the bottom of the card showing how many items the user has completed out of the total trackable items. Exempt (informational) items are excluded from the denominator. Updates in real time as the user works through content.

Tapping a card opens that category's full content page.

---

## Category Page

The category page (`/category/[slug]`) opens when a user taps a category card from the home page.

### Search

A search bar above the content list lets users filter items within that category by title or description. Filtering is instant and respects the active language — searching in Spanish mode matches against Spanish translations when they exist. The search bar is always visible, regardless of whether the type filter appears.

### Type Filter

When a category contains more than one content type (e.g. Video and Article), a type filter dropdown appears alongside the search bar. Selecting a type narrows the list to only that type; selecting "All" restores the full list. The type filter and search bar work together — both filters are applied simultaneously.

### Responsive Layout

On small screens the heading, search bar, and type filter each occupy their own full-width line. On `sm+` screens the search bar and type filter sit in a row to the right of the heading.

### Item Count

The heading above the list always reflects the number of items visible after both filters are applied. When search returns no matches the list is replaced with a contextual message: `No results for "[query]"` when a search is active, or the generic empty-state message when the category has no content.

---

## Facility-Scoped Visibility

Users only see categories and items available to their facility. Categories and items can be restricted to specific facilities by administrators — users outside the target facility simply don't see those items. No special action is needed from the user.

---

## Facility-Specific Home Pages

Users who access the platform via a facility URL (`/facility/[site-id]` or `/?site=[site-id]`) see a home page scoped to that facility. A facility-specific message banner is shown, and category/item visibility is filtered to that facility's content.

---

## Sign Up & Sign In

The sign-up and login flow (`/signup`) serves both new account creation and returning user sign-in from the same page.

### Sign Up

**Access requirement:** Sign-up is only available from a facility device — the URL must contain `?site=facilityId&user=PIN`. Users without this context see only an error message.

**Inmate PIN pre-fill:** If the PIN is present in the URL, the form reads it automatically from session storage — users do not type their PIN.

**Consent:** Before signing up, users must expand a collapsible disclosure (tap to read) explaining what data is collected, why, and who can see it. An acknowledgment checkbox must be checked before the Create Account button activates.

**On-screen keyboard:** On mobile devices (coarse pointer + viewport ≤900px), a custom on-screen keyboard replaces the native system keyboard for all sign-up, sign-in, and password-reset fields. This prevents the native keyboard from resizing the page or obscuring inputs on shared tablets. The keyboard supports English and Spanish layouts — Spanish adds ñ to the letter rows and replaces a symbol row with accented vowels (á é í ó ú ü) and inverted punctuation (¿ ¡). The Shift key works in all layouts including symbol mode. The keyboard stays pinned to the bottom of the screen while the page scrolls, and the page bottom is padded by the keyboard height so every field can be scrolled into view above it.

**Anti-bot protection:** A simple math captcha (e.g., "What is 4 + 7?") is generated server-side, signed with HMAC-SHA256, and verified using timing-safe comparison. Stale tokens (older than 5 minutes) are rejected. A hidden honeypot field catches basic bots.

**Security questions:** Users choose 2 security questions and provide answers during sign-up. Answers are hashed server-side before storage. The dashboard is locked until security questions are set up.

**Rate limiting:** IP-based rate limiting is intentionally not applied to sign-up — all inmates at a facility share one external IP. The PIN acts as the hard gate (one account per PIN). The math captcha still blocks bots.

### Sign In

**Shared device security:** After Supabase verifies credentials, the platform checks that the signed-in user's facility and PIN match the `?site=` and `?user=` values in the current session. A mismatch immediately signs the user out with an explanatory error — preventing one inmate from using another inmate's session on a shared tablet.

**Username enumeration prevention:** All error messages use a generic phrase ("Incorrect username or password") regardless of the failure reason.

**Nav freeze during check:** The navigation stays in its unauthenticated state during the post-auth check to prevent a flash of the signed-in interface before a potential rejection.

### Password Reset

Security questions replace email in the reset flow. If a username doesn't exist, fake (but stable) question keys are returned derived deterministically from the username — making the response indistinguishable from a real user. All reset errors use a generic message. Two separate rate limits apply: 30 probing attempts per IP per hour, and 8 reset submissions per IP per hour. The reset attempt check uses a Postgres advisory lock to prevent concurrent requests from racing past the limit.

---

## Footer

Present on every page:

- **© [Year] Reentry to Recovery**
- **Privacy** — links to the Privacy Policy
- **Terms of Service** — links to the Terms of Service
- **Crisis line** — "If you are in crisis, call or text 988"

---

# 2. User Dashboard

The user dashboard (`/dashboard`) is the personal progress center for regular users. It has four tabs, each with an icon: **My Progress** (book), **Saved** (bookmark), **Achievements** (trophy), and **My Account** (user). Tester accounts see a fifth **Testing** tab (clipboard). On narrow screens where not all tabs fit, a **More** dropdown appears — the active tab always stays visible in the primary row.

---

## My Progress Tab

Sections appear in this order:

1. **Pick Up Where You Left Off** — resume card (shown only when applicable)
2. **Overall Progress Ring**
3. **Stat Cards**
4. **Monthly Summary**
5. **Engagement Level**
6. **Category Progress**

---

### Pick Up Where You Left Off

When the user has started but not finished any content, a resume card appears at the very top of the My Progress tab:

- An enlarged **category icon** for the item's category
- The **item title** and a brief progress note — percentage watched for video/audio, estimated minutes read for PDF
- The label **"Pick Up Where You Left Off"** with an arrow on the right
- Tapping the card navigates to that category page and scrolls to the item

The card shows the single most recently engaged-with item. It disappears once all content is complete. Video and audio resume from exactly where playback stopped.

---

### Overall Progress Ring

A large circular ring shows total completion across every category the user can access.

**Weighted progress:** A completed item counts as 100%. A video watched 50% counts as 50%. An unopened item counts as 0%. This gives a more honest picture than a simple completed/not-completed count.

At 100% completion, the ring fills solid and displays a **checkmark icon** instead of the percentage. Below the ring: **"X of Y items completed"** with the raw count of fully completed items. Exempt items are excluded from both numbers.

---

### Stat Cards

Four cards below the ring:

| Card | What It Shows |
|---|---|
| **Items Completed** | Fully completed items out of all trackable items |
| **Categories Completed** | Full categories finished out of all available |
| **Time Spent** | Accumulated real session time (not estimated) |
| **Day Streak** | Consecutive login days |

---

### Monthly Summary

A collapsible card showing activity for the current calendar month:

- **Items completed this month** — with a delta label vs. last month ("↑ 3 more than last month", "Same as last month", etc.)
- **Time spent this month** — real session time with month-over-month comparison
- **Achievements earned this month** — badge icons for milestones earned this month, each with a tooltip

A rotating motivational message appears at the bottom when expanded. Collapsed by default. Does not appear for months with zero activity. Exempt items are excluded from the item count.

---

### Engagement Level

If the user's facility has 10 or more registered users:

- **Tier label** — Top Reader, Active Reader, Getting Started, or Just Joined
- **Percentile** — e.g., "top 12% of readers at your facility"
- Items completed and items started
- Date of last update (nightly)

Tiers are based on total time spent relative to other users at the same facility.

---

### Category Progress

A list of every category the user can access, each as a collapsible accordion row.

**Header row shows:**
- **Circular progress ring** — weighted category completion (same logic as the overall ring; exempt items excluded)
- **Category name** — on wider screens, a "New content" badge sits inline beside the name
- **Completion + time pills** — connected horizontal control on desktop; stacks vertically with the New badge on mobile, all right-aligned
- The action/bookmark/rating badges on expanded items occupy a right-side column that never overlaps the type badge or duration on the left

**When expanded, each item shows:**

| Content Type | Action / Status |
|---|---|
| **Video / Audio** | Not started (dimmed) → In progress ("52% watched" fill badge) → Completed ("Watched"/"Listened") |
| **PDF** | Not started (dimmed) → In progress (reading % fill badge) → Completed ("Read") |
| **Image** | Auto-marks complete on view |
| **External Link** | Auto-marks complete on click |
| **Worksheet / Article / Guide** | "Mark as read" button — manually marked |
| **Exempt (informational)** | "Acknowledge" → "Acknowledged" + disclaimer |

**Additional per-item elements:**
- **New badge** — shown for items added within 7 days that the user hasn't opened yet; disappears once engaged
- **Read date** — completed items show when they were read
- **Ratings** — after completing an item, a thumbs-up / thumbs-down pill appears. Tapping records or toggles the rating. Ratings are anonymous.
- **Bookmarks** — a bookmark icon saves the item to the Saved tab. Tapping again removes it.
- **Rating/bookmark indicators on the dashboard** — the collapsed accordion row also shows filled rating and bookmark icons as read-only status indicators.
- **Exempt item info (ⓘ)** — an info icon next to the title opens a tooltip explaining the item is informational and does not count toward progress.

---

### Category Completion Celebration

When a user completes the final item in a category, a modal automatically appears:

- **Headline:** "You completed [Category Name]"
- A congratulatory message acknowledging the effort
- **"Keep going"** button to dismiss

The modal appears once per category completion. It is only shown on the dashboard, not on the category page itself.

---

### Playback Resume

For video and audio content, the platform stores the furthest point reached. Reopening the content resumes from that exact position — users never lose their place across sessions or devices.

---

## Saved Tab

Shows all bookmarked content items. Each shows:

- Category icon and name
- Content title (tapping navigates to the item on the category page)
- Content type badge
- Bookmark button to remove from Saved

A count badge on the tab trigger shows the number of saved items. Empty state prompts the user to use the bookmark icon on any resource.

---

## Achievements Tab

Shows all 13 earnable milestones organized into four groups.

**First Steps**
- First Resource — complete your first item
- Explorer — start your first category

**Completion**
- 10 / 25 / 50 / 100 Resources — complete that many items
- Category Graduate — finish every item in a category
- 5 Categories Finished — complete all items in 5 categories

**Streaks**
- 7-Day Streak — log in 7 consecutive days
- 30-Day Streak — log in 30 consecutive days

**Time Spent**
- 5 / 10 / 50 Hours In — accumulate that much active learning time

**Display:** All 13 badges are always visible. Earned badges show in full color with the earned date. Unearned badges are dimmed. A count ("4 of 13 earned") appears at the top of the tab.

**Toast notifications:** When an achievement is unlocked, a toast appears immediately in the user's active language with the achievement name and description. Achievements are checked in real time after each item completion.

All achievement text is fully translated into English and Spanish.

---

## My Account Tab

### Profile Information

- Username, full name, facility, and join date

### Security Questions

- Shows which 2 security questions are currently set
- Users can update their questions and answers at any time
- If questions are not set, the Progress tab (and all content access) is locked with a prompt to set them up

### Forced Password Reset

Tester and facility staff accounts can be set to require a password change on first sign-in. If this flag is active, the account tab shows a password reset form before granting access to content. Completing it clears the flag atomically on the server — the flag cannot be bypassed.

---

# 3. Admin Panel

The admin panel (`/admin`) is accessible to admin, contributor, and facility user accounts. Access for each section depends on role — see the Role Summary table at the end of this section.

---

## User Roles

| Role | Who They Are | Admin Access |
|---|---|---|
| **Regular User** | Incarcerated individuals using the library | None |
| **Tester** | QA accounts with a role switcher to simulate any account type. Lands on the regular user dashboard with an embedded Testing tab for QA runs. Excluded from analytics by default; can enable analytics tracking via the Role Switcher to appear in facility-scoped reports for testing. The Role Switcher is a fixed bottom-left widget with a solid background, always visible above page content and footer. | None (user dashboard + Testing tab only) |
| **Contributor** | Content editors | Content editing only |
| **Facility User** | Facility staff (counselors, administrators) | Analytics + user management for their own facility |
| **Admin** | Platform administrators | Full unrestricted access |

**Enforcement:** Access is enforced at two independent layers. Route guards check the role on the client side before the page loads. Server functions independently verify the caller's role using the service-role Supabase client — server functions are the real security boundary.

---

## Content Management — `/admin/`

*Admin, Contributor*

### Categories

The main workspace for organizing the content library.

- **View all categories** — full list with drag handles, publication status, item count, facility badges, translation status badges, and custom content badges. Item counts update in real time as items are added or removed — no page reload required.
- **Reorder** — drag and drop to change display order on the main page
- **Toggle published / draft** — draft categories are hidden from all users
- **Add category** — opens the new category form (name, slug, tagline, description, icon, color, facilities, Spanish translation, published toggle)
- **Edit** — opens the full category editor
- **Preview** — external link icon opens the live category page
- **Delete** — single or bulk delete with confirmation. Bulk delete uses the edit mode toggle. In edit mode a **Select all** / **Deselect all** button selects every visible item at once (respects the active search filter).
- **Search** — filters the list in real time; drag-and-drop is disabled while searching
- **AI-generate copy** — one click generates a suggested tagline and description from the category name using Claude
- **Icon generator** — generates a unique icon and color automatically, optionally guided by keywords

### Content Items (within each category)

Each category on the admin home shows its items nested inline. The full item editor is at `/admin/category/$id`.

**Item fields:**
- Title (English and Spanish)
- Type — built-in types (Video, Audio, Podcast, PDF, Image, Link, Worksheet, Article, Guide) plus any custom types added by admins. Custom types can be created directly from the type dropdown and deleted from the Icons & Badges page.
- URL — external link or uploaded file URL
- File upload — click or drop; shows a real-time progress bar with the upload percentage
- Duration — estimated length (used for display and PDF reading time auto-detection)
- Description (English and Spanish)
- Source — attribution or provider name
- Facility restrictions — restrict an item to specific facilities independently of its category
- Published / Draft toggle
- **Exempt from tracking** — marks the item as informational. Exempt items show an "Acknowledge" button to users instead of the normal completion button. They are excluded from all progress tracking, analytics, achievement counts, and pre-computed statistics. See [Analytics Tracking](#analytics-tracking) below.
- Translation status badge — complete, partial, or missing Spanish

**Per-item AI features:**
- **AI-generate description** — drafts a description from the title and content type
- **AI-translate** — translates all English fields to Spanish in one click; also available at the category level to translate all category metadata

**File management:** When uploading a replacement file, the old file is automatically deleted from storage. The file uploader uses XHR (not fetch) to report real byte-level upload progress.

**PDF reading time estimation:** When a PDF file is uploaded, the server reads the PDF, counts words across all pages, and calculates an estimated reading time at 120 words per minute (calibrated for a 6th-grade reading level). Image-only / scanned PDFs fall back to 1.5 minutes per page.

---

## Users — `/admin/users`

*Admin (all users), Facility User (own facility only)*

### User Sections

- **Admins & Contributors** — platform staff accounts (hidden from Facility Users)
- **Testers** — QA accounts (hidden from Facility Users)
- **Facility Staff** — other Facility User accounts
- **Registered Users** — regular user accounts, paginated, filterable by facility and searchable by name/username/PIN

### Per-User Actions

| Action | Admin | Facility User |
|---|---|---|
| View profile | ✓ | ✓ (own facility) |
| Set password manually | ✓ | ✓ (own facility) |
| Send password reset email | ✓ | ✓ (own facility) |
| Resend verification email | ✓ | ✓ (own facility) |
| Clear security questions | ✓ | ✓ (own facility) |
| Edit email address | ✓ | — |
| Change role | ✓ | — |
| Create user (any type) | ✓ | — |
| Delete user | ✓ | — |
| Bulk delete users | ✓ | — |

**New user badge:** The admin nav shows a badge count for users who signed up since the admin last visited the Users page. The badge clears when the page is opened.

**Single-role invariant:** Each account can only hold one role at a time. Assigning a new role removes all others automatically.

**Self-protection:** Admins cannot delete their own account or revoke their own admin role.

---

## Analytics — `/admin/analytics`

*Admin (all facilities), Facility User (own facility only)*

The analytics page has three tabs: **Overall**, **By Facility**, and **Users**.

---

### What Gets Tracked

| Signal | Method |
|---|---|
| **Session time** | Real-time timer; counts active engagement (pauses after 90s of no activity); writes every 5 seconds and on close |
| **Video/audio progress** | Furthest playback position; 95% = auto-complete |
| **PDF progress** | Session time vs. estimated reading time; 95% = auto-complete |
| **Content opens** | Click/open events per item and category |
| **Category visits** | Page view events per category |
| **Bookmarks** | Toggle events; per-item and per-user |
| **Ratings** | Thumbs up / thumbs down; per-item and per-user |
| **Login dates** | One record per user per day; used for streaks and retention |
| **Achievement unlocks** | Checked after each item completion; 13 possible achievements |

**Exempt items** — items flagged "exempt from tracking" are excluded from every metric: progress rings, completion rates, monthly summaries, achievement counts, and all pre-computed nightly statistics.

**Excluded from analytics:** Admin accounts, contributor accounts, facility user accounts, and synthetic/test profiles. Tester accounts are excluded by default (`is_synthetic = true`); when a tester enables analytics tracking via the Role Switcher toggle, their engagement appears in facility-scoped reports only — not in the Overall tab. This lets testers verify facility report behavior without permanently polluting global stats.

---

### Overall Tab

**Summary cards** — five top-level metrics for the selected time range (Last month, Last 7 days, Last 30 days, Last 90 days, All time):
- Completion rate, time spent, visits, opens, total registered users

**Category list** — every category as an expandable accordion showing visits, opens, completion rate, avg depth, and time spent. Expanded view shows per-item stats: open count, completion rate, drop-off count, avg time on item, helpful ratings, not-helpful ratings, and bookmark count. Exempt items are excluded.

**Most & Least Engaged Content** — tabbed section with Top 5 and Bottom 5 items by completion rate (among items with sufficient data). Useful for identifying high-performing content and content that needs improvement.

**Content Type Preference** — engagement breakdown by format (Video, PDF, Audio, Worksheet, etc.) showing opens, completions, completion rate, and total time.

**Category Completion** — per-category table: users who started vs. users who completed every item, with a completion rate percentage.

**User Retention** — 7-day, 30-day, and 60-day return rates (pre-computed nightly).

**Weekly Growth** — a 12-week chart of new signups and active users per week.

**Facility Comparison** *(Admin only)* — all facilities ranked by average completion rate, with user counts, active users (7d/30d), participation rate, items completed, time spent, total bookmarks, helpful ratings, and not-helpful ratings. Exportable as CSV.

**Manual Refresh** *(Admin only)* — a button triggers the nightly analytics job immediately without waiting for the 2am UTC schedule.

---

### By Facility Tab

Select a facility to view its full usage report scoped to that facility's users. Shows the same metrics as the Overall tab filtered to that facility. Also shows where the facility ranks in the Facility Comparison table.

---

### Users Tab

Select a facility to see its registered user list with signup date, last login, and engagement tier. Click any user to open their **Individual User Progress Report**.

#### Individual User Progress Report

Sections appear in the same order as the user dashboard:

1. **Stat cards** — items completed, categories completed, time spent, day streak, last login
2. **Monthly summary** — items and time this month vs. last month, achievements earned this month
3. **Engagement tier** — facility percentile ranking (shown only when available)
4. **Achievements** — all 13 badges displayed in a row; earned in accent color, unearned dimmed; hovering shows the achievement name and description
5. **Category list** — per-category weighted completion ring and time spent; expandable to show per-item detail including read/acknowledged status, completion date, media progress, time spent, bookmark status, and rating (Helpful / Not Helpful / none)

Exempt items appear in the per-item list with "Acknowledge/Acknowledged" badge and a disclaimer ("Doesn't count toward this user's progress") but are not counted in totals or rings.

The report shows the user's PIN next to their name for identification.

---

### CSV Exports

| Export | Contents |
|---|---|
| **Usage report** | Summary metrics, content type breakdown, per-category and per-item detail: completion rate, drop-offs, openers, completions, avg time, helpful/not-helpful ratings, bookmark count |
| **Facility comparison** | All facilities: user counts, active counts, participation rate, avg completion %, items completed, time spent, total bookmarks, helpful ratings, not-helpful ratings |
| **Individual user progress** | Per-user CSV with category summary rows and individual item rows. Columns: Category, Item Title, Read, Read On, Progress, Time Spent, Bookmarked, Rating. Category name appears once per group (on the summary row); item rows leave that column blank. |
| **Facility users list** | All users in a facility with signup date, last login, engagement tier, percentile |
| **Bulk facility progress** | All users × all items for a selected facility — one row per user+item. Columns: First Name, Last Name, Username, PIN, Last Login, Items Completed, Time Spent (hrs), Category, Item Title, Completed, Completed On, Progress %, Time on Item (min), Bookmarked, Rating. Items are grouped by category in display order. User fields and the Category column are shown only on the first row of each user/category group; subsequent rows leave them blank to keep the sheet readable. Requires a specific facility to be selected — "all facilities" is not supported. |

---

### How Data Updates

| Data | Frequency |
|---|---|
| Session time, completion status, media progress | Real-time (within 5 seconds of activity) |
| Visit and click counts | Real-time via database trigger |
| Engagement tier, facility percentile | Nightly at 2am UTC |
| Retention rates | Nightly at 2am UTC |
| Weekly growth | Nightly at 2am UTC |
| Facility comparison stats | Nightly at 2am UTC |
| Content item aggregate stats | Nightly at 2am UTC |

---

## Messages — `/admin/messages`

*Admin (all facilities), Facility User (own facility only)*

**Site-wide message** *(Admin only)* — a dismissible banner shown to all users on the home page. Supports English and Spanish. Enabled/disabled with a toggle.

**Facility messages** — one configurable message per facility. Admins can set messages for any facility. Facility Users see only their own facility's editor. Includes:
- Enable/disable toggle
- English and Spanish message fields
- AI-assisted "Regenerate" translation button
- Auto-expands the Spanish section when a translation already exists

When a message is updated, it reappears to all users who previously dismissed it — dismissal is tied to the message version (last updated timestamp).

---

## Facilities — `/admin/facilities`

*Admin only*

- **View all facilities** — list with site ID, user count, assigned categories, custom content items, and active message preview
- **Add facilities** — label and Site ID per facility; value (URL slug) is derived automatically from the Site ID. Bulk import supported.
- **Edit** — change label and/or Site ID
- **Delete** — single or bulk delete
- **Reorder** — drag to change dropdown sort order

**Site ID system:** Each facility's Site ID generates a public URL (`/?site=siteId`) for automatic facility association at sign-up and for shared-device login context.

---

## Audit Log — `/admin/audit-log`

*Admin only*

A read-only chronological log of sensitive admin actions:

- User creation, deletion
- Password resets
- Role grants and revocations
- Security question clears

Each entry shows: action type, actor (name + email), affected user (name + email), timestamp, IP address, user agent, and any relevant details. Free-text search across all fields. Facility Users can view the audit log scoped to their facility's users.

---

## Error Log — `/admin/errors`

*Admin only*

Server and client-side errors caught by the platform's global error boundary:

- Filter by source (server / client) and date
- Errors include: message, stack trace, route, user, IP address, user agent
- Clear options: entries older than N days, or all at once

---

## Home Page Editor — `/admin/home`

*Admin only*

Edit the main hero section — eyebrow label, headline, and subheading — in English and Spanish. Changes go live immediately.

---

## Certificate Page Editor — `/admin/certificate`

*Admin only*

Edit the hero section of the certificate program landing page — headline and subheading in English and Spanish.

---

## Privacy Policy & Terms of Service

`/admin/privacy` and `/admin/terms` — *Admin, Contributor*

Rich text editors for the platform's legal pages. Both support English and Spanish with AI-assisted translation.

---

## Icons & Badges — `/admin/icons-badges`

*Admin only*

Visual design tool for customizing the platform's badge and icon appearance:

**Badge variants** — customize the palette color for every status badge: New, Draft, Exempt, Admin, Contributor, Facility User, Tester, Category, Translation, and others.

**Content type badges** — customize the color and icon for each content type (both built-in types and custom types added by admins). New custom types appear here automatically when created, assigned a unique palette color. Unused custom types can be deleted — all items using that type are reassigned to "Article" automatically.

**Category icons** — assign a specific icon and accent color to each published category. A "Generate" option automatically picks an icon and color based on the category name, avoiding duplicates.

Save Changes must be clicked to persist any badge/icon changes.

---

## IP Allowlist — `/admin/ip-allowlist`

*Admin only*

Controls which IP addresses can access the platform.

**Allowlist** — add IP addresses with optional labels. Supports individual entry or bulk import (one IP per line, optionally `IP,Label`).

**Restriction toggle** — when enabled, only IPs on the allowlist can reach the site. When disabled, the site is open to all IPs. Changes take effect within ~30 seconds (module-level cache TTL).

**Blocked page:** Users from non-allowlisted IPs see a plain "Access restricted" page with their IP address shown — they cannot access any content.

**Important for deployments:** Each facility typically shares one outgoing IP. Admins must add a facility's IP to the allowlist before the facility goes live. The admin can also add separate IP restrictions per custom home page slug.

---

## Seed Content — `/admin/seed`

*Admin only*

Bulk import tool for adding many content items at once via CSV upload:

- Required columns: `category_slug`, `title`
- Optional columns: `type`, `url`, `source`, `sort_order`
- Shows a preview table with row-level validation errors before importing
- Valid rows are inserted in one batch; sort order is appended after existing items in each category

---

## Test Results — `/admin/test-results`

*Admin only*

A read-only dashboard showing every QA test run submitted by tester accounts.

**Run list** — table of all runs across all testers showing: run label, tester username, date, in-progress/completed status, a progress bar (actioned/248), and pass ✓ / fail ✗ / blocked ⊘ counts.

**Run detail view** — click any run to open the full detail. A 64px progress ring shows the overall pass rate at a glance. Section accordions each show a per-section pass/fail count. Expanded sections show each test with its status icon, ID, a connected badge pill (priority → status → role badges), title, description, tester notes in a bordered input-style box, and a **View screenshot** button if the tester attached one.

**Failures panel** — when any tests are marked Failed, they surface at the very top of the detail view (highlighted in red) showing ID, title, notes, and a screenshot button — giving the dev team an immediate triage list without scrolling.

**Filters** — status and priority controls apply across all section accordions simultaneously. On screens ≥1024px wide these render as connected icon+label pill groups; on narrower screens they become two Select dropdowns to prevent overflow.

---

## Role Summary by Page

| Page | Admin | Contributor | Facility User |
|---|---|---|---|
| Content home (`/admin/`) | ✓ Full | ✓ Full | — |
| Category & item editor | ✓ Full | ✓ Full | — |
| Users | ✓ All | — | Own facility |
| Analytics | ✓ All facilities | — | Own facility |
| Messages | ✓ All facilities | — | Own facility |
| Facilities | ✓ Full | — | — |
| Audit log | ✓ | — | Scoped |
| Error log | ✓ | — | — |
| Home page editor | ✓ | — | — |
| Certificate editor | ✓ | — | — |
| Privacy / Terms | ✓ | ✓ | — |
| Icons & Badges | ✓ | — | — |
| IP Allowlist | ✓ | — | — |
| Seed content | ✓ | — | — |
| Test Results | ✓ | — | — |

---

## Security Architecture

**Authentication:** Username-based login (no email required for regular users). Internally, a synthetic email format (`username@users.local`) is used so the Supabase auth system functions normally.

**Authorization — two independent layers:**
1. **Route guards (client-side):** Each admin route has a `beforeLoad` hook that checks the session and role before the page renders. Unauthorized users are redirected.
2. **Server functions (server-side):** Every data-fetching and mutation function re-checks the caller's role using the service-role Supabase client. Route guards can be bypassed — server functions cannot.

**Row-Level Security:** All user data tables have RLS enabled in Supabase. Users can only read/write their own data. Service-role access is used only for privileged server-side logic.

**Facility User scoping:** Every server function that a Facility User can call enforces their facility scope server-side — the function reads the caller's facility from the database and ignores any client-supplied facility value that doesn't match.

**Password hashing (security questions):** New answers use bcrypt (12 rounds, salted). Legacy sha256 hashes are still verified for backward compatibility and silently upgraded when the user re-enrolls.

**Timing-safe comparisons:** Security question verification uses `timingSafeEqual` to prevent timing attacks that could reveal partial hash information.

---

---

## Automated Tests

Tests live in `src/lib/__tests__/` and use [Vitest](https://vitest.dev/).

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with v8 coverage report
```

### What is tested

| File | Coverage |
|---|---|
| `server-auth.test.ts` | `assertAnalyticsAdmin` and `isFacilityScoped` — every role combination, admin short-circuit, tester dual-role edge case |
| `reports-scope-guards.test.ts` | Facility scope guard logic for all three analytics handlers — admin pass-through, facilityUser own-facility allow, cross-facility reject, no-facility-assigned reject |

### Adding tests

- Unit tests for pure functions go directly in `src/lib/__tests__/`.
- Mock `supabaseAdmin` using `vi.hoisted()` + `vi.mock("@/integrations/supabase/client.server", ...)`. See `server-auth.test.ts` for the chainable mock pattern.
- Server function handlers cannot be called directly (they require TanStack Start middleware context). Extract and test the business logic functions they depend on instead.

## Additional Documentation

| File | Description |
|---|---|
| [ANALYTICS.md](ANALYTICS.md) | Complete analytics and data tracking reference — every metric tracked, how it's measured, and what it means for grant reporting |
| [USER_DASHBOARD.md](USER_DASHBOARD.md) | Full feature guide for the user-facing dashboard — all tabs, sections, badges, and behaviors |
| [ADMIN.md](ADMIN.md) | Detailed admin panel feature guide — every page and action available to admin, contributor, and facility user accounts |
| [USER_ROLES.md](USER_ROLES.md) | Full role and permission breakdown — what each role can do, where access is enforced, and how facility scoping works |
| [MAIN_PAGE.md](MAIN_PAGE.md) | Feature guide for the public home page — category grid, search, banners, and signed-in vs. anonymous differences |
| [SIGNUP_AND_LOGIN.md](SIGNUP_AND_LOGIN.md) | Security reference for the sign-up and login flow — captcha, PIN gating, rate limiting, and password reset |
| [PRIVACY_POLICY.md](PRIVACY_POLICY.md) | Platform privacy policy |
| [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md) | Platform terms of service |
