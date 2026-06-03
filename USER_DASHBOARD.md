# User Dashboard — Feature Guide

This guide explains everything available to a regular user on their personal dashboard at `/dashboard`.

---

## Getting There

After signing in, users are taken to their dashboard automatically. The dashboard is always accessible by tapping their name or the dashboard link in the navigation.

---

## Four Tabs

The dashboard has four sections accessible via tabs at the top:

- **My Progress** — the primary view showing learning activity and content
- **Saved** — bookmarked resources saved for later
- **Achievements** — milestones earned across the learning journey
- **My Account** — profile information and account security settings

---

## My Progress Tab

Sections appear in this order:

1. **Pick Up Where You Left Off** — resume card (shown only if applicable)
2. **Overall Progress Ring** — weighted completion across all categories
3. **Stat Cards** — four key metrics at a glance
4. **Monthly Summary** — collapsible activity card for the current month
5. **Engagement Level** — facility ranking (shown only when available)
6. **Category Progress** — full category accordion list

---

### Pick Up Where You Left Off

If the user has any started-but-not-completed content, a resume card appears at the very top of the My Progress tab. It shows:

- An enlarged **category icon** for visual context
- The **item title** and a brief progress note (e.g., percentage watched for video/audio, estimated minutes read for PDF)
- The label **"Pick Up Where You Left Off"** with an arrow on the right side
- Tapping the card navigates directly to that category page and scrolls to the item

The card shows the single most recently engaged-with item. It disappears once all items in the library are completed. Video and audio items resume playback from exactly where the user stopped.

---

### Overall Progress Ring

A large circular progress ring shows the user's overall completion across every category they have access to.

The ring uses **weighted progress** — a video watched 50% contributes 50%, a completed item 100%, an unopened item 0%. At 100% completion the ring fills solid and displays a checkmark icon instead of the percentage. Below the ring is a summary line: **"X of Y items completed"** showing fully completed items. **Exempt items** are excluded from both numbers.

---

### Stat Cards

Four cards appear below the ring:

| Card | What It Shows |
|---|---|
| **Items Completed** | Total content items fully completed, out of all available items |
| **Categories Completed** | Number of full categories finished, out of all available |
| **Time Spent** | Total accumulated real session time |
| **Day Streak** | Number of consecutive days logged in |

---

### Monthly Summary

A collapsible card below the stat cards shows activity for the current calendar month:

- **Items completed this month** — with a delta label comparing to last month (e.g., "↑ 3 more than last month")
- **Time spent this month** — real session time with a month-over-month comparison
- **Achievements earned this month** — badge icons for milestones earned this month; hovering shows the achievement name and description

A rotating motivational message appears at the bottom when expanded. The card is collapsed by default and only appears for months with at least some activity. Exempt items are excluded from the monthly item count.

---

### Engagement Level

If the user's facility has enough active users (10+) to calculate meaningful rankings, an engagement level card appears:

- **Tier label** — one of: Top Reader, Active Reader, Getting Started, or Just Joined
- **Percentile** — e.g., "top 12% of readers at your facility" (shown for facilities with 10+ users)
- The number of items completed and items started
- When the ranking was last updated (updates nightly)

This gives users context on where they stand relative to peers at the same facility.

---

### Category Progress

A list of every content category the user has access to, each as a collapsible accordion row:

**In the header:**
- A **circular progress ring** showing weighted completion for that category (same weighted logic as the overall ring; exempt items excluded)
- The **category name**
- A "New content added" badge if items have been added recently
- **"X of Y items · Xm spent"** — items completed out of total trackable items, and total time spent. Exempt items are excluded from the Y count.

**When expanded:**
- A list of every content item in that category
- Each item shows its type (Video, PDF, Worksheet, etc.), estimated duration, and an action badge

---

### Content Item Action Badges

Each content item in the expanded category view has a badge showing its current status. The badge behavior depends on content type:

**Video / Audio**
- Not started → dimmed badge with a tooltip prompting the user to watch
- In progress (5–94% watched) → a progress fill badge showing the exact percentage watched (e.g., "52% watched") — cannot be manually marked
- Completed → "Watched" or "Listened" badge

**PDF**
- Not yet opened → dimmed badge
- In progress → a progress fill badge showing reading percentage
- Completed → "Read" badge (or "Read manually at X%" if the user marked it complete before finishing)

**Image**
- Opens and auto-marks complete when viewed

**External Link**
- Clicks the link and auto-marks complete

**Worksheet / Article / Guide / Resource**
- "Mark as read" button — manually marked by the user

**Article / Guide / Resource / Information**
- "Mark as read" button — manually marked by the user

**Exempt (informational) items**
- Show an "Acknowledge" button before the user has tapped it, and "Acknowledged" after
- A small disclaimer reads "Doesn't count toward your progress" beneath the button
- An info icon (ⓘ) next to the item title explains it is informational
- Acknowledging an exempt item does not count toward any stats, rings, or achievements

**New badge** — items added within the last 7 days that the user hasn't opened yet show a "New" badge. Once opened or engaged with, the badge disappears permanently.

**Read date** — completed items show when they were read (e.g., "on May 15, 2026").

**Ratings (Helpful / Not Helpful)** — once a user has completed a content item, a thumbs-up / thumbs-down pill appears alongside the read status badge. Tapping either thumb records the user's rating. Tapping the same thumb again removes the rating. Ratings are anonymous — no one can see who rated what, only the aggregate counts visible to admins.

**Bookmarks** — a bookmark icon appears alongside the read status and rating controls. Tapping it saves the item to the user's Saved tab. Tapping again removes the bookmark.

**Rating and bookmark status on the dashboard** — the category accordion items on the dashboard also display the user's current rating (filled thumbs-up or thumbs-down) and bookmark status (filled bookmark icon) as read-only indicators. These are display-only on the dashboard; tapping them has no effect — use the category page to change ratings or bookmarks.

### Category Completion Celebration

When a user completes the final item in a category, a celebration modal automatically appears. It shows:

- **"You completed [Category Name]"** — the category name is shown in the headline
- A congratulatory message acknowledging their effort
- A **"Keep going"** button to dismiss the modal

The modal appears once per category completion and does not reappear. It is only shown on the dashboard — not on the category page itself.

---

### Resume Position

For video and audio content, the platform remembers exactly where the user left off. When they reopen the content, playback automatically resumes from their furthest point — they never have to find their place again.

---

## Achievements Tab

The Achievements tab shows all 13 milestones a user can earn, organized into four groups. All text is fully translated into English and Spanish.

### Groups

**First steps**
- **First resource** — Complete your first content item
- **Explorer** — Start your first category

**Completion**
- **10 / 25 / 50 / 100 resources** — Complete that many content items
- **Category graduate** — Finish every item in a category
- **5 categories finished** — Finish every item in 5 categories

**Streaks**
- **7-day streak** — Log in 7 consecutive days
- **30-day streak** — Log in 30 consecutive days

**Time spent**
- **5 / 10 / 50 hours in** — Accumulate that many hours of active learning

### Display

All 13 achievements are always visible. Earned achievements are shown in full color with the icon and the date earned. Locked achievements are dimmed with a lock icon — users can see what they are working toward at all times.

A count badge (e.g. "4 of 13 earned") appears at the top of the tab.

### Toast Notifications

When an achievement is unlocked — after completing an item, accumulating time, or building a login streak — a toast notification appears immediately with the achievement name and description in the user's current language. Achievements are checked in real time after each item completion.

---

## Saved Tab

The Saved tab shows all content items the user has bookmarked across any category. Each saved item displays:

- The category icon and category name
- The content title (tapping navigates directly to that item on the category page)
- The content type badge
- A bookmark button to remove the item from Saved

The Saved tab shows a count badge on the tab trigger when at least one item is saved. If no items are saved, an empty state prompts the user to use the bookmark icon on any resource to save it here.

---

## My Account Tab

### Profile Information

The Account tab shows the user's profile details:

- **Username** — their login name
- **Full name** — first and last name if provided
- **Facility** — the facility they are enrolled at
- **Joined** — the date they created their account

---

### Security Questions

The Account tab also shows the user's current security questions. These are used for account recovery if they forget their password or get locked out. Users can:

- **View** which security questions they currently have set
- **Update** their security questions and answers at any time by clicking the update button

If security questions have not been set up yet, the Progress tab is locked and the user is prompted to set them up before accessing content. This is a one-time setup requirement.

---

## What Users Cannot See or Do

To keep the experience focused and appropriate for the platform's population:

- Users cannot see other users' progress or data
- Users cannot add, edit, or delete content
- Users cannot see admin tools, facility management, or analytics reports
- Facility staff accounts (facilityUser role) have a separate restricted admin view — regular users never see admin interfaces
