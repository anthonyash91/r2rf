# Reentry to Recovery — Analytics & Tracking Reference

This document describes every analytics and data tracking feature built into the platform. It is intended for grant writing, funding applications, and program reporting purposes.

---

## What Gets Tracked

### 1. Session Time (All Content Types)

Every time a user opens a piece of content, the platform starts a real-time session timer. The timer:

- Runs in the background while the content is open
- Detects inactivity (scrolling, clicking, typing) — stops counting after 90 seconds of no activity
- Writes to the database every 5 seconds of confirmed active engagement
- Always saves on close, even for very short sessions

This gives an accurate measure of how long users actually spend with content — not an estimate. The data is stored per user, per content item, cumulatively across all sessions.

**Practical meaning for funders:** "Users spent an average of 47 minutes in the Reentry Resources program" is based on real measured time, not the admin-estimated duration fields.

---

### 2. Video & Audio Playback Progress

For video and audio content hosted on the platform:

- The furthest point the user reached is tracked (e.g., "watched to 6:42 of 9:15")
- Progress is expressed as a percentage (e.g., "73% watched")
- If a user leaves and returns, playback resumes from where they left off
- Content is automatically marked complete when the user reaches 95% of the total duration

This data is visible on the category page (per item), the user dashboard, the admin user report, and in CSV exports.

---

### 3. PDF Reading Progress

For PDF documents:

- Time spent in the PDF viewer is tracked against the estimated reading time (derived from word count)
- Progress is expressed as a percentage (e.g., "42% read")
- The platform auto-marks the PDF complete when estimated reading time is 95% consumed
- If a user manually marks a PDF complete before finishing, the system records the percentage at which they did so (e.g., "Clicked complete at 27%")

---

### 4. Content Completion

Each content item can be marked complete. The method depends on content type:

| Content Type | How Completion Is Recorded |
|---|---|
| Video / Audio | Auto-marked at 95% playback |
| PDF | Auto-marked at 95% reading time, or manually |
| Image | Auto-marked when opened |
| External Link | Auto-marked when clicked |
| Worksheet | Manually marked by the user |
| Meeting / Call | Manually marked as "Attended" |
| Article / Guide / Resource | Manually marked by the user |

Completion data is stored with a timestamp so the exact date each item was completed is available in reports and CSV exports.

---

### 5. Category Completion (Weighted Progress Rings)

Each category displays a circular progress ring. Unlike a simple completed/not-completed count, the ring uses **weighted progress**:

- A completed item counts as 100%
- A video watched 50% counts as 50%
- A PDF read 80% counts as 80%
- An item not opened counts as 0%

This gives a more honest picture of engagement — a user who has watched 8 out of 10 videos halfway through shows meaningful progress rather than 0%.

Rings appear on the user dashboard (per category and overall) and on the category page itself.

---

### 6. Program Completion Rate

Program completion goes beyond individual item completion. For each category (program), the platform tracks:

- **Users who started**: opened at least one item in the category
- **Users who completed**: finished every published item in the category
- **Program completion rate**: completions / starters × 100

This is a key outcome metric for grant reporting. Example: "43% of users who began the Substance Abuse Recovery program completed all 10 resources."

This data is visible in the admin analytics page under the Program Completion section and in CSV exports.

---

### 7. Category Depth

Category depth measures how far users go inside a program — not just whether they visited, but how many items they consumed on average.

- **Avg depth**: average number of items completed per user who engaged with the category
- A depth of 7.2 out of 10 items means users who enter the program typically complete 7 of 10 resources

This reveals whether users explore the full catalog or drop off after a few items — useful for identifying which programs hold attention throughout.

---

### 8. Drop-Off Rate

For each content item, the platform tracks:

- **Openers**: unique users who opened the item
- **Completers**: unique users who completed the item
- **Drop-offs**: openers who did not complete (openers − completers)
- **Completion rate**: completers / openers × 100

Drop-off counts appear in the expanded item list in the admin usage report. Items with high drop-offs are candidates for content improvement or replacement.

---

### 9. Content Type Preference

The platform aggregates engagement data by content format across all items:

| Metric | Per type (Video, PDF, Audio, Worksheet, etc.) |
|---|---|
| Total items | How many items of this type exist |
| Opens | How many times items of this type were opened |
| Completions | How many times items of this type were completed |
| Completion rate | Completions / opens × 100 |
| Time spent | Total accumulated time across all users and items |

This reveals which formats resonate with the population. Example: "Users complete 78% of videos but only 38% of worksheets, informing our content production strategy."

---

### 10. User Engagement Tier

Each user is ranked within their facility based on total time spent:

| Tier | Percentile |
|---|---|
| Top Reader | Top 20% of facility |
| Active Reader | Top 50% |
| Getting Started | Top 80% |
| Just Joined | Bottom 20% |

For facilities with 10+ users, the exact percentile is shown (e.g., "top 12% of readers"). Tiers update nightly and appear on the user's dashboard, in admin user reports, and in CSV exports.

---

### 11. User Retention Rates

The platform calculates how many users return after signing up:

- **7-day return rate**: of users who signed up more than 7 days ago, what percentage logged in again within their first 7 days
- **30-day return rate**: same for a 30-day window
- **60-day return rate**: same for a 60-day window

These metrics are pre-computed nightly and are visible in the admin analytics page. They can be scoped to individual facilities.

Example for a grant report: "68% of users returned to the platform within 7 days of signing up, demonstrating sustained engagement with the material."

---

### 12. Growth Over Time

The platform tracks week-by-week growth across the last 12 weeks:

- **New signups**: users who registered in each week
- **Active users**: unique users who opened at least one piece of content that week

Both metrics are pre-computed nightly and shown as a visual bar chart in the admin analytics page. Facility-scoped data is available when viewing a specific facility.

---

### 13. Active User Counts (7-Day and 30-Day)

For each facility, the platform tracks how many registered users were actively engaging in the last 7 days and last 30 days. These appear in the Facility Comparison table.

---

### 14. Facility Participation Rate

For each facility, the platform computes:

**Participation rate** = active users (last 30 days) / total registered users × 100

This distinguishes between facilities where most registered users are actively learning versus facilities where engagement has stalled.

---

### 15. Facility Comparison

The admin analytics page includes a ranked comparison table of all facilities:

| Column | Description |
|---|---|
| Users | Total registered users |
| Active (7d) | Users active in the last 7 days |
| Active (30d) | Users active in the last 30 days |
| Participation | Active (30d) / total users |
| Avg completion | Average item completion rate across all content |
| Items completed | Total items completed by facility users |
| Time spent | Total accumulated session time |

This table is exportable as a CSV and is useful for identifying which facilities are thriving and which may need outreach or support.

---

### 16. Most & Least Engaged Content

The admin analytics page automatically surfaces:

- **Top 5 most engaged** content items (highest completion rate among items with at least 3 openers)
- **Top 5 least engaged** content items (lowest completion rate)

This is directly actionable: low-completion content can be improved, replaced, or repositioned. High-completion content should be promoted.

---

### 17. Visit and Open Counts

The platform tracks:

- **Visits**: how many times a category page was viewed
- **Opens**: how many times a content item was clicked/opened

These are time-range filterable (last 7 days, 30 days, 90 days, all time) and visible in the usage report. They provide a discoverability signal — high opens with low completion points to content that attracts interest but doesn't hold it.

---

### 18. Individual User Progress Reports

Administrators can pull a detailed report for any individual user showing:

- Total items completed and categories completed
- Time spent (all time)
- Day streak (consecutive login days)
- Last login date
- Engagement tier and facility percentile
- Per-category breakdown with weighted completion ring, time spent, and items read
- Per-item detail: read status, date completed, progress percentage, time spent

These reports are exportable as CSV and are suitable for inclusion in individual case notes or program documentation.

---

### 19. Facility User Reports

When viewing a specific facility, administrators can see:

- A list of all registered users with signup date, last login, and engagement tier
- A separate list of facility staff accounts
- The ability to click into any user's individual progress report

The full user list with engagement data is exportable as CSV.

---

## Data Export (CSV)

Every major analytics surface includes a CSV export:

| Export | Contents |
|---|---|
| Usage report | Summary metrics, content type breakdown, per-category and per-item detail including completion rate, drop-offs, openers, completions, avg time spent |
| Facility comparison | All facilities with users, active counts, participation rate, completion rate, time spent |
| User progress | Full per-user report with per-category and per-item breakdown |
| Facility users | User list with signup date, last login, engagement tier, percentile |

CSV exports are suitable for import into spreadsheet tools, grant reporting templates, or program management systems.

---

## How Data Updates

| Data | Frequency |
|---|---|
| Session time, completion status, media progress | Real-time (within 5 seconds of user activity) |
| Visit and click counts (usage report) | Real-time via database trigger |
| Engagement tier, facility percentile | Nightly at 2am UTC |
| Retention rates | Nightly at 2am UTC |
| Weekly growth data | Nightly at 2am UTC |
| Program completion rates | Nightly at 2am UTC |
| Facility comparison stats | Nightly at 2am UTC |
| Content item aggregate stats | Nightly at 2am UTC |
| Raw event cleanup | Nightly at 2:30am UTC (events older than 90 days pruned; aggregate data retained indefinitely) |

---

## What Is Excluded From Analytics

The following are intentionally excluded from all analytics and reporting to ensure data integrity:

- **Admin and staff accounts** — admins marking content, managing users, or testing the platform are excluded from all completion rates, retention calculations, and time totals
- **Facility staff accounts** (`facilityUser` role) — excluded from user-facing metrics
- **Synthetic/test accounts** — accounts flagged as synthetic are excluded from all reports
- **Incomplete tracking windows** — completion rates are only shown when actual click-event data exists for an item; if an item has completions but no tracked opens (e.g., historical data from before analytics was set up), the rate is hidden rather than showing a misleading 100%
