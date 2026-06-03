# Admin Panel — Feature Guide

This guide covers every feature available in the admin panel at `/admin`. For a complete breakdown of all roles and how access is enforced at both the route and server-function level, see [USER_ROLES.md](USER_ROLES.md).

---

## Roles Overview

| Role | Admin panel access | Content editing | Analytics & Reports | User management |
|---|---|---|---|---|
| **Admin** | Full | Full | All facilities | Full |
| **Contributor** | Content editing only | Full | None | None |
| **Facility User** | Limited | None | Own facility only | Own facility only |
| **Tester** | None | None | None | None |

---

## Admin Navigation

The admin panel is accessible via the **Admin** link in the main navigation bar (visible only to users with admin panel access).

**Facility Users** are directed to the Analytics page when they access `/admin` — they skip the content management home.

---

## Content Management — `/admin/`

*Accessible to: Admin, Contributor*

The content management home is the main workspace for building and maintaining the content library.

### Categories

- **View all categories** — a full list with content items nested underneath
- **Reorder categories** — drag and drop to change display order
- **Toggle published / draft** — draft categories are hidden from users
- **Add a new category** — opens the category editor
- **Edit a category** — pencil icon opens the editor
- **Preview a live category** — external link icon opens the category on the public site

### Content Items (within each category)

- **Reorder items** — drag and drop within a category
- **Toggle published / draft** — individual items can be hidden
- **Quick-edit title** — inline editing directly on the home page
- **Add a new item** — opens the item editor
- **Edit an item** — opens the item editor for an existing item
- **Delete items** — single delete or bulk delete with confirmation

---

## Category & Content Editor — `/admin/category/$id`

*Accessible to: Admin, Contributor*

### Category Settings

- **Name** (English and Spanish)
- **Slug** — URL path (e.g., `/category/recovery-resources`)
- **Tagline** (English and Spanish)
- **Description** (English and Spanish)
- **Icon** — choose from hundreds of icons
- **Icon color** — customize the accent color
- **AI-generate copy** — generates a suggested name, tagline, and description
- **Facility restrictions** — restrict a category to specific facilities
- **Published / Draft toggle**

### Content Items (within the editor)

Each content item has its own form with:

- **Title** (English and Spanish)
- **Type** — Video, Audio, Podcast, PDF, Image, Link, Worksheet, Article, Guide, Resource, Information, or any custom type. New types can be created directly from the type dropdown.
- **URL** — external link or uploaded file URL
- **File upload** — drag-and-drop or click; shows real-time upload progress
- **Duration** — estimated length (used for display and PDF reading time estimates)
- **Description** (English and Spanish)
- **Source** — attribution or source name
- **AI-generate description** — generates a suggested description
- **Facility restrictions** — restrict individual items independently of the category
- **Published / Draft toggle**
- **Exempt from tracking** — marks the item as informational so it does not count toward user progress, completion rates, achievements, or any analytics. Users see an "Acknowledge" button with a disclaimer instead of the normal completion button. See [USER_ROLES.md](USER_ROLES.md) for full details.
- **Translation status badge** — shows whether Spanish translations are complete, partial, or missing

### File Management

When uploading a replacement file, the old file is automatically deleted from storage.

---

## Users — `/admin/users`

*Accessible to: Admin, Facility User*
*Facility Users see only users at their own facility.*

### User Sections

- **Admins & Contributors** — accounts with admin panel access (hidden from Facility Users)
- **Testers** — accounts with the tester role (hidden from Facility Users)
- **Facility Staff** — other Facility User accounts
- **Registered Users** — regular user accounts, filterable by facility

### Per-User Actions

| Action | Admin | Facility User |
|---|---|---|
| View profile details | ✓ | ✓ (own facility) |
| Create new regular user | ✓ | — |
| Create facility staff account | ✓ | — |
| Create tester account | ✓ | — |
| Edit user's email address | ✓ | — |
| Set user's password manually | ✓ | ✓ (own facility) |
| Send password reset email | ✓ | ✓ (own facility) |
| Resend email verification | ✓ | ✓ (own facility) |
| Reset security questions | ✓ | ✓ (own facility) |
| Change user role | ✓ | — |
| Delete single user | ✓ | — |
| Bulk delete users | ✓ | — |

**Facility User restriction:** A Facility User can only perform actions on regular users registered at their own facility. They cannot view or manage users at other facilities, and cannot manage admin, contributor, or tester accounts.

**Self-protection:** No admin can delete their own account or remove their own admin role from within the panel.

---

## Analytics — `/admin/analytics`

*Accessible to: Admin, Facility User*
*Facility Users see data scoped to their own facility only. Contributors have no access to analytics.*

The analytics page has three tabs: **Overall**, **By Facility**, and **Users**.

### Overall Tab

#### Summary Cards
Five top-level metrics for the selected time range (Last month, Last 7 days, Last 30 days, Last 90 days, All time):
- **Completion rate** — percentage of content opens that resulted in completion
- **Time spent** — total real session time
- **Visits** — category page views
- **Opens** — content item clicks/opens
- **Users** — total registered users

#### Category List
Every category as an expandable accordion row showing visits, opens, completion rate, avg depth, and time spent. When expanded: each content item with its open count, completion rate, drop-off count, avg time spent, helpful rating count, not-helpful rating count, and bookmark count. Exempt items do not appear in this list.

#### Most & Least Engaged Content
Top 5 and bottom 5 content items by completion rate (among items with sufficient data).

#### Content Type Preference
Engagement breakdown by content format — opens, completions, completion rate, and time spent per type.

#### Category Completion
Per-category table showing users started vs. users who completed every item.

#### User Retention
7-day, 30-day, and 60-day return rates.

#### Growth
A 12-week chart of new signups and active users per week.

#### Facility Comparison *(Admin only)*
All facilities ranked by average completion rate. Includes user counts, active users, participation rate, items completed, time spent, total bookmarks, helpful ratings, and not-helpful ratings. Exportable as CSV.

### By Facility Tab

Select a specific facility to view its usage report scoped to that facility's users. Also shows the facility's ranking. *(Admin sees all facilities; Facility Users see their own facility only.)*

### Users Tab

Select a facility to see registered users with signup date, last login, and engagement tier. Click any user to open their individual progress report showing sections in this order:

1. **Stat cards** — items completed, categories completed, time spent, day streak, last login
2. **Monthly summary** — collapsible card showing items and time this month vs. last month, plus achievements earned this month
3. **Engagement tier** — facility percentile ranking (shown only when a tier is available)
4. **Achievements** — all 13 achievement badges; earned shown in accent color, unearned dimmed
5. **Category list** — per-category breakdown with weighted completion ring and time spent; each category expands to show per-item detail including read/acknowledged status, completion date, media progress, time spent, bookmark status, and rating

Exempt items appear in the per-item list with an "Acknowledge/Acknowledged" badge and a disclaimer noting they don't count toward this user's progress.

All views exportable as CSV, including:
- **Export CSV** — the user list with signup date, last login, and engagement tier
- **Export All Progress (CSV)** — a flat CSV with one row per user × item, covering every published item visible to the facility for every user. Columns: First Name, Last Name, Username, PIN, Last Login, Items Completed, Time Spent, Category, Item Title, Completed, Completed On, Progress %, Time on Item, Bookmarked, Rating. Items are grouped by category; repeated user and category values are shown only once. Useful for program reviews, parole documentation, and grant reporting. Only available when a specific facility is selected, not in the "all facilities" view.

#### Manual Refresh *(Admin only)*
A refresh button triggers the nightly analytics job on demand. Only admins can trigger this.

---

## Messages — `/admin/messages`

*Accessible to: Admin, Facility User*
*Facility Users can only edit the message for their own facility.*

**Site-wide message** *(Admin only)* — shown to all users on the home page as a dismissible banner. Supports English and Spanish.

**Facility messages** — a separate message per facility. Admins can set messages for any facility. Facility Users see only their own facility's message editor and cannot edit messages for other facilities.

Messages include a Spanish translation field and an AI-assisted Regenerate option.

---

## Facilities — `/admin/facilities`

*Accessible to: Admin only*

- **View all facilities** — list with site ID and custom slug
- **Add a new facility** — label, value, and optional Site ID
- **Edit a facility** — change label, site ID, or custom slug
- **Delete facilities** — single or bulk delete
- **Reorder facilities** — drag to change dropdown order

### Site ID System
Each facility can have a Site ID that generates a public URL for automatic facility association at sign-up. Custom slugs create shorter branded URLs.

---

## Audit Log — `/admin/audit-log`

*Accessible to: Admin only*

A read-only log of sensitive admin actions — password changes, user deletions, role changes, and similar operations. Each entry shows the action, actor, affected user, timestamp, and context. Paginated.

---

## Error Log — `/admin/errors`

*Accessible to: Admin only*

Server and client errors caught by the platform. Errors can be cleared individually, in bulk (older than 30 days), or all at once.

---

## Home Page Editor — `/admin/home`

*Accessible to: Admin only*

Edit the hero section of the main public home page — eyebrow label, headline, and subheading. Supports English and Spanish.

---

## Certificate Page Editor — `/admin/certificate`

*Accessible to: Admin only*

Edit the hero section of the certificate program landing page — headline and subheading in English and Spanish.

---

## Privacy Policy — `/admin/privacy`

*Accessible to: Admin, Contributor*

A rich text editor for the platform's Privacy Policy page. Supports English and Spanish with AI-assisted translation.

---

## Terms of Service — `/admin/terms`

*Accessible to: Admin, Contributor*

A rich text editor for the Terms of Service page. Identical in functionality to the Privacy Policy editor.

---

## Icons & Badges — `/admin/icons-badges`

*Accessible to: Admin only*

A visual design tool for customizing the platform's appearance:

- **Badge variants** — edit colors for status badges (New, Draft, Exempt, etc.)
- **Content type badges** — customize color and icon for each content type. New custom types appear here automatically with a unique palette color.
- **Category icons** — assign icons and colors to categories

Changes affect the entire platform. Save Changes must be clicked to persist.

---

## IP Allowlist — `/admin/ip-allowlist`

*Accessible to: Admin only*

Manage IP address access control for the platform:

- **Allowlist** — add IP addresses (with optional labels) that are permitted to access the site. Supports single entry or bulk import (one IP per line, optionally with a label: `192.168.1.1,Office`).
- **IP restriction mode** — when on, only IPs on the allowlist can access the site. When off, the site is open to all IP addresses. Changes take effect within ~30 seconds.

**Important for facility deployments:** Each facility typically shares a single outgoing IP address for all its users. Admins must add a facility's IP to the allowlist before the facility goes live. Users at a non-allowlisted facility will see a plain "access restricted" page with their IP address displayed — they cannot self-provision access.

---

## Seed Content — `/admin/seed`

*Accessible to: Admin only*

A bulk content import tool for adding many content items at once via CSV. Supports category slug, title, type, URL, source, and sort order. Shows a preview table with validation errors before importing.

---

## Test Results — `/admin/test-results`

*Accessible to: Admin only*

A read-only dashboard showing QA test runs submitted by tester accounts.

### Run List

All runs across all testers are shown in a table with:
- **Run label** — the name the tester gave the run (e.g. "Post-deploy June 3")
- **Tester** — the tester's username
- **Date** — when the run was created
- **Status** — In progress or Completed
- **Progress bar** — actioned tests / 248 total
- **Results** — pass ✓ / fail ✗ / blocked ⊘ counts at a glance

Click any row to open the full detail view for that run.

### Run Detail View

Shows all 248 tests organized by section. Each section is a collapsible accordion with a per-section pass/fail count. Within each section, each test shows:

- Status icon and label
- Test ID and title
- Priority (Critical / High / Medium / Low)
- Tester notes (if any)
- **View screenshot** link (if the tester attached a failure screenshot)

**Failures panel** — if any tests are marked Failed, they all appear in a highlighted summary at the top of the detail view, each showing the test ID, title, tester note, and a screenshot link. This gives the dev team an immediate triage view without scrolling.

**Filter** — the status filter (All / Pass / Fail / Blocked / Skipped / Untested) applies across all section accordions, making it easy to see only failures or only untested items.

---

## Role Summary by Page

| Page | Admin | Contributor | Facility User |
|---|---|---|---|
| Content home (`/admin/`) | ✓ Full | ✓ Full | — |
| Category editor | ✓ Full | ✓ Full | — |
| Users | ✓ All users | — | Own facility only |
| Analytics | ✓ All facilities | — | Own facility only |
| Messages | ✓ All facilities | — | Own facility (scoped) |
| Facilities | ✓ Full | — | — |
| Audit log | ✓ | — | — |
| Error log | ✓ | — | — |
| Home page editor | ✓ | — | — |
| Certificate editor | ✓ | — | — |
| Privacy policy | ✓ | ✓ | — |
| Terms of service | ✓ | ✓ | — |
| Icons & Badges | ✓ | — | — |
| IP Allowlist | ✓ | — | — |
| Seed content | ✓ | — | — |
| Test Results | ✓ | — | — |

---

## Tester Role

Users with the **Tester** role have no admin panel access. Instead of the regular user dashboard they see a dedicated **QA Testing** page with an interactive 248-test checklist. Tester activity is **excluded from all analytics reports and statistics**, so testing does not skew engagement data. See [USER_ROLES.md](USER_ROLES.md) for the full tester feature description.
