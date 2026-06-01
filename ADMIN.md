# Admin Panel — Feature Guide

This guide covers every feature available in the admin panel at `/admin`, including which features are available to each role.

---

## Roles Overview

There are four privileged roles in the platform. Access to the admin panel requires at least one of the first three.

| Role | Admin panel access | Content editing | Analytics | User management | Notes |
|---|---|---|---|---|---|
| **Admin** | Full | Full | All facilities | Full — all users | Unrestricted access to everything |
| **Contributor** | Full | Full | All facilities | Full — all users | Same as admin for most features; cannot remove admin roles |
| **Facility User** | Limited | None | Own facility only | Own facility users only | Facility-scoped staff account |
| **Tester** | None | None | None | None | Uses the app as a regular user; excluded from analytics data |

---

## Admin Navigation

The admin panel is accessible via the **Admin** link in the main navigation bar (visible only to users with admin panel access). The sidebar or top navigation within the admin panel links to each section.

**Facility Users** are redirected to the Users page when they access `/admin` — they skip the content management home and land directly on user management.

---

## Content Management — `/admin/`

*Accessible to: Admin, Contributor*
*Facility Users are redirected away from this page.*

The content management home is the main workspace for building and maintaining the content library.

### Categories

- **View all categories** — a full list of every category in the library, with their content items nested underneath
- **Reorder categories** — drag and drop to change the order categories appear on the public site
- **Toggle published / draft** — categories in draft mode are hidden from users; published categories are live
- **Add a new category** — opens the category editor (see below)
- **Edit a category** — pencil icon on each category card opens the editor
- **Preview a live category** — external link icon opens the category on the public site in a new tab

### Content Items (within each category)

- **Reorder items** — drag and drop within a category to change the order items appear
- **Toggle published / draft** — individual items can be hidden without affecting the rest of the category
- **Quick-edit title** — inline editing of item titles directly on the home page
- **Add a new item** — opens the item editor
- **Edit an item** — opens the item editor for an existing item
- **Delete items** — single delete or bulk delete with confirmation

---

## Category & Content Editor — `/admin/category/$id`

*Accessible to: Admin, Contributor*

Each category has a dedicated editor page for managing its settings and all its content items.

### Category Settings

- **Name** (English and Spanish) — the title shown on the home page and category page
- **Slug** — the URL path for the category (e.g., `/category/recovery-resources`)
- **Tagline** (English and Spanish) — the short description shown on the home page card
- **Description** (English and Spanish) — the longer description shown at the top of the category page
- **Icon** — choose from hundreds of icons to represent the category
- **Icon color** — customize the icon's accent color
- **AI-generate copy** — a Sparkles button uses AI to generate a suggested name, tagline, and description based on the category's content
- **Facility restrictions** — optionally restrict a category so it only appears to users from specific facilities; leave unrestricted to show to everyone
- **Published / Draft toggle** — controls whether the category is visible on the public site

### Content Items (within the editor)

Each content item has its own form with:

- **Title** (English and Spanish)
- **Type** — Video, Audio, Podcast, PDF, Image, Link, Worksheet, Article, Guide, Resource, Information, or any custom type added by an admin. New types can be created directly from the type dropdown — type a name and press Enter or click Add. New types are automatically assigned a unique color in the Icons & Badges settings.
- **URL** — external link or uploaded file URL
- **File upload** — drag-and-drop or click to upload a file directly to Supabase Storage; the uploader shows real-time progress as the file uploads
- **Duration** — estimated length (used for display and PDF reading time estimates)
- **Description** (English and Spanish) — shown on the category page below the title
- **Source** — attribution or source name
- **AI-generate description** — Sparkles button generates a suggested description based on the item's title and type
- **Facility restrictions** — restrict individual items to specific facilities independent of the category
- **Published / Draft toggle**
- **Translation status badge** — shows whether Spanish translations are complete, partial, or missing

### Translation Tracking

A translation status indicator on each item and category shows at a glance which content has complete Spanish translations, which is partial, and which is missing them entirely — useful for ensuring the Spanish-language experience is complete.

### File Management

When uploading a replacement file for an existing content item, the old file is automatically deleted from storage so orphaned files don't accumulate.

---

## Users — `/admin/users`

*Accessible to: Admin, Contributor, Facility User*
*Facility Users see only users at their own facility.*

### User Sections

The users page is divided into sections:

- **Admins & Contributors** — accounts with admin panel access (hidden from Facility Users)
- **Testers** — accounts with the tester role (hidden from Facility Users)
- **Facility Staff** — other Facility User accounts
- **Registered Users** — regular user accounts, filterable by facility

### Search & Filter

- **Search by name, username, or email** — real-time filtering across the user list
- **Filter by facility** — narrow the list to users from a specific facility (Admin/Contributor only)
- **Bulk select and delete** — select multiple users and delete them in one action (Admin/Contributor only)

### Per-User Actions

For each user, the following actions are available:

| Action | Admin | Contributor | Facility User |
|---|---|---|---|
| View profile details | ✓ | ✓ | ✓ (own facility) |
| Create new regular user | ✓ | ✓ | ✓ (own facility) |
| Create facility staff account | ✓ | ✓ | ✓ (own facility) |
| Create tester account | ✓ | ✓ | — |
| Edit user's email address | ✓ | ✓ | — |
| Set user's password manually | ✓ | ✓ | — |
| Send password reset email | ✓ | ✓ | ✓ (own facility) |
| Resend email verification | ✓ | ✓ | — |
| Reset security questions | ✓ | ✓ | ✓ (own facility) |
| Change user role | ✓ | ✓ | — |
| Delete single user | ✓ | ✓ | — |
| Bulk delete users | ✓ | ✓ | — |

**Facility User restriction:** A Facility User can only perform actions on users registered at their own facility. They cannot view or manage users at other facilities. They also cannot view admin, contributor, or tester accounts.

**Self-protection:** No admin can delete their own account or remove their own admin role from within the panel.

---

## Analytics — `/admin/analytics`

*Accessible to: Admin, Contributor, Facility User*
*Facility Users see data scoped to their own facility only.*

The analytics page has three tabs: **Overall**, **By Facility**, and **Users**.

### Overall Tab

#### Summary Cards
Five top-level metrics for the selected time range (Last 7 days, 30 days, 90 days, All time):
- **Completion rate** — percentage of content opens that resulted in completion
- **Time spent** — total accumulated real session time across all users
- **Visits** — category page views
- **Opens** — content item clicks/opens
- **Users** — total registered users

#### Category List
Every category shown as an expandable accordion row. Each row shows:
- Visits, opens, completion rate, avg depth (items completed per user), and time spent for that category
- When expanded: each content item with its open count, completion rate, drop-off count, average time spent, helpful rating count, not-helpful rating count, and bookmark count

#### Most & Least Engaged Content
Automatically surfaces the top 5 and bottom 5 content items by completion rate (among items with sufficient data). Directly actionable for content improvement decisions.

#### Content Type Preference
A table breaking down engagement by content format (Video, PDF, Worksheet, etc.) — opens, completions, completion rate, and time spent per type.

#### Category Completion
Per-category table showing how many users started each category versus how many completed every item in it.

#### User Retention
Three cards showing 7-day, 30-day, and 60-day return rates — the percentage of users who came back after signing up.

#### Growth
A 12-week chart showing new signups and active users per week.

#### Facility Comparison *(Admin/Contributor only)*
All facilities ranked by average completion rate. Columns include users, active user counts, participation rate, items completed, time spent, total bookmarks, total helpful ratings, and total not-helpful ratings. The table scrolls horizontally and is exportable as CSV.

### By Facility Tab *(Admin/Contributor only)*

Select a specific facility to view its usage report — same summary cards, category list, and content breakdown as the Overall tab but scoped to that facility's users. Also shows the facility's ranking among all facilities.

### Users Tab

Select a facility (or all facilities) to see a list of registered users with signup date, last login, and engagement tier. Click any user to open their individual progress report, which shows:

- Total items and categories completed
- Time spent, day streak, last login
- Engagement tier and facility percentile
- Per-category breakdown with weighted completion ring and time spent
- Per-item detail including read status, completion date, media progress percentage, time spent, whether the item was bookmarked, and the user's rating (Helpful / Not Helpful / none)

All views are exportable as CSV, including a user progress CSV with full per-item detail.

---

## Messages — `/admin/messages`

*Accessible to: Admin, Contributor, Facility User*
*Facility Users can only edit the message for their own facility.*

Two types of messages can be set:

**Site-wide message** — shown to all users on the home page as a dismissible banner. Admins and Contributors can set and clear this message. Supports English and Spanish.

**Facility messages** — a separate message per facility, shown only to users from that facility. Admins and Contributors can set messages for any facility. Facility Users can only set the message for their own facility.

Messages include a **Spanish translation field** and an AI-assisted **Regenerate** option that rewrites the message in Spanish automatically.

---

## Facilities — `/admin/facilities`

*Accessible to: Admin, Contributor (full); Facility User (read-only for own facility)*

### Admin / Contributor

- **View all facilities** — list of every facility with their site ID and custom slug
- **Add a new facility** — create a new facility with a label, value, and optional Site ID
- **Edit a facility** — change the label, site ID, or custom slug
- **Delete facilities** — single or bulk delete with confirmation
- **Reorder facilities** — drag to change the order facilities appear in dropdowns

### Site ID System

Each facility can have a Site ID (e.g., `S002001041`) that generates a public URL users can visit to be automatically associated with that facility on sign-up. Custom slugs can also be set to create shorter, branded URLs.

### Facility User

Facility Users can view their own facility's details but cannot create, edit, or delete facilities.

---

## Audit Log — `/admin/audit-log`

*Accessible to: Admin, Contributor, Facility User*
*Facility Users see only actions affecting users at their own facility.*

A read-only log of sensitive admin actions performed through the platform — password changes, user deletions, role changes, and similar operations. Each entry shows the action, the actor, the affected user, timestamp, and additional context. Paginated and searchable.

---

## Error Log — `/admin/errors`

*Accessible to: Admin, Contributor, Facility User*

A log of server and client errors caught by the platform. Useful for diagnosing issues. Errors can be cleared individually, in bulk (older than 30 days), or all at once. Displays error message, stack trace, URL, timestamp, and user agent.

---

## Home Page Editor — `/admin/home`

*Accessible to: Admin, Contributor, Facility User*

Edit the hero section of the main public home page — the eyebrow label, headline, and subheading. Both English and Spanish versions can be set. Changes take effect immediately.

---

## Certificate Page Editor — `/admin/certificate`

*Accessible to: Admin, Contributor, Facility User*

Edit the hero section of the certificate program landing page — headline and subheading in English and Spanish.

---

## Privacy Policy — `/admin/privacy`

*Accessible to: Admin, Contributor, Facility User*

A rich text editor for the platform's Privacy Policy page. The policy can be written in both English and Spanish. Changes are reflected immediately on the public `/privacy` page.

---

## Icons & Badges — `/admin/icons-badges`

*Accessible to: Admin, Contributor, Facility User*

A visual design tool for customizing the appearance of the platform:

- **Badge variants** — edit the colors and labels of status badges (New, Draft, etc.)
- **Content type badges** — customize the color and icon for each content type. New custom types created in the content editor appear here automatically and are assigned a unique palette color that doesn't conflict with any existing badge or icon color across the entire app. Admins can cycle or regenerate any color and save changes globally.
- **Category icons** — browse the full icon library and assign icons to categories; each icon can be individually colored

All sections are listed alphabetically. Changes here affect how content appears across the entire platform. Save Changes must be clicked to persist updates to the database.

---

## IP Allowlist — `/admin/ip-allowlist`

*Accessible to: Admin, Contributor, Facility User*

Manage IP address access control for the platform:

- **Allowlist** — add specific IP addresses or ranges that are always permitted access
- **Blocklist** — block specific IPs from accessing the platform
- **IP restriction mode** — optionally restrict the entire platform to allowlisted IPs only (useful for facility network lockdown)

Each entry can be labeled with a description and shows when it was added.

---

## Seed Content — `/admin/seed`

*Accessible to: Admin, Contributor, Facility User*

A bulk content import tool for adding many content items at once via CSV. The CSV format supports:
- Category slug (must match an existing category)
- Title, type, URL, source, sort order

A preview table shows the parsed data before importing, with validation errors flagged per row. Successfully parsed rows are imported as draft items.

---

## Role Summary by Page

| Page | Admin | Contributor | Facility User |
|---|---|---|---|
| Content home (`/admin/`) | ✓ Full | ✓ Full | — (redirected) |
| Category editor | ✓ Full | ✓ Full | — (redirected) |
| Users | ✓ All users | ✓ All users | Own facility only |
| Analytics | ✓ All facilities | ✓ All facilities | Own facility only |
| Messages | ✓ All facilities | ✓ All facilities | Own facility only |
| Facilities | ✓ Full | ✓ Full | Read-only (own) |
| Audit log | ✓ All | ✓ All | Own facility only |
| Error log | ✓ | ✓ | ✓ |
| Home page editor | ✓ | ✓ | ✓ |
| Certificate editor | ✓ | ✓ | ✓ |
| Privacy policy | ✓ | ✓ | ✓ |
| Icons & Badges | ✓ | ✓ | ✓ |
| IP Allowlist | ✓ | ✓ | ✓ |
| Seed content | ✓ | ✓ | ✓ |

---

## Tester Role

Users with the **Tester** role do not have admin panel access. They use the platform exactly like regular users — they can browse content, mark items complete, track progress, and use their dashboard. The key distinction is that tester activity is **excluded from all analytics reports and pre-computed statistics**, so testing the platform does not skew engagement data for real users.
