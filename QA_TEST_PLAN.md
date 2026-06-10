# Reentry to Recovery — QA Test Plan

**Purpose:** End-to-end manual testing guide covering every user-facing and administrative feature of the platform. Tests are grouped by functional area and ordered from most critical to least critical within each section.

**Priority scale:**
- 🔴 **Critical** — broken functionality blocks core user flows or exposes a security vulnerability
- 🟠 **High** — significant feature degradation; most users would notice
- 🟡 **Medium** — partial degradation or edge case; workaround exists
- 🟢 **Low** — cosmetic, copy, or minor UX issue

**Test accounts needed before starting:**

| Account type | Used for |
|---|---|
| Admin | Full admin panel access |
| Contributor | Content editing only |
| Facility User (Facility A) | Facility-scoped analytics + user management |
| Facility User (Facility B) | Cross-facility isolation tests |
| Regular User (Facility A) | User-facing flows |
| Regular User (Facility B) | Cross-facility isolation |
| Tester | Analytics exclusion verification |

---

## Section 1 — Sign-Up Flow

### 1.1 — Access gate (no facility URL)
🔴 **Critical**
 **Role:** Signed Out
Navigate to `/signup` without a `?site=` parameter in the URL. Verify that no sign-up form fields are shown, and an error message appears explaining that sign-up requires the facility device link. The sign-in form should still be accessible.

### 1.2 — Access gate (facility URL, no PIN)
🔴 **Critical**
 **Role:** Signed Out
Navigate to `/?site=validSiteId` (valid facility, no `?user=` PIN). Then navigate to `/signup`. Verify sign-up is blocked with a "no PIN" error. Sign-in should still work normally.

### 1.3 — Access gate (PIN already registered)
🔴 **Critical**
 **Role:** Signed Out
Navigate to `/?site=validSiteId&user=PINWHICHHASACCOUNT`. Navigate to `/signup`. Verify the page shows a "PIN already registered" error and only shows a sign-in prompt — no sign-up form.

### 1.4 — Disclosure must be expanded before reading
🟡 **Medium**
 **Role:** Signed Out
With a valid facility + PIN URL, open the sign-up page. Verify the consent disclosure is collapsed by default. Expand it. Verify it shows the full data collection explanation with links to Privacy Policy and Terms of Service.

### 1.5 — Create account button disabled without checkbox
🟠 **High**
 **Role:** Signed Out
On the sign-up form, fill in all fields correctly but leave the acknowledgment checkbox unchecked. Verify the Create Account button is disabled or does nothing when clicked.

### 1.6 — Username validation
🟠 **High**
 **Role:** Signed Out
Try the following usernames and verify the behavior:
- Less than 3 characters → invalid (shown inline)
- More than 32 characters → invalid
- Special characters other than `_` (e.g., `user@name`, `user-name`) → invalid
- Valid format (`john_doe_92`) → "checking availability" indicator appears, then "available" or "taken"
- Already-taken username → "That username is already taken" shown before form submission

### 1.7 — Password strength meter
🟢 **Low**
 **Role:** Signed Out
Enter passwords of varying complexity and verify the 4-segment strength meter updates correctly:
- Short password (<8 chars) → 1 red segment (Too short)
- 8+ chars, lowercase only → Weak
- Mixed case + digits → Fair/Good
- Mixed case + digits + symbol → Strong

### 1.8 — Password mismatch
🟠 **High**
 **Role:** Signed Out
Enter a password and a different confirmation password. Click Create Account. Verify an error toast appears and no account is created.

### 1.9 — Math captcha must be answered correctly
🔴 **Critical**
 **Role:** Signed Out
On the sign-up form, intentionally enter an incorrect answer to the math captcha (e.g., if shown "4 + 7", enter 10). Click Create Account. Verify a "Captcha failed" error appears and no account is created.

### 1.10 — Math captcha expires
🟡 **Medium**
 **Role:** Signed Out
Open the sign-up form and wait more than 5 minutes without submitting. Then submit. Verify the captcha is rejected as expired and a new one is requested.

### 1.11 — Honeypot field is hidden
🟡 **Medium**
 **Role:** Signed Out
Inspect the sign-up form HTML. Verify a hidden input field exists. Verify that the field is not visible to the user. (Do not fill it in — filling it should cause rejection, but inspecting it is the test.)

### 1.12 — Security questions required
🟠 **High**
 **Role:** Signed Out → Regular User
Complete sign-up. Verify you are directed to the Account tab on the dashboard. Verify the Progress tab (and categories) are locked with a prompt to set up security questions. Set up 2 questions. Verify the lock clears and content becomes accessible.

### 1.13 — Must choose two different questions
🟠 **High**
 **Role:** Signed Out
In the security questions form (during sign-up or update), try selecting the same question twice. Verify the second dropdown greys out the already-chosen question, preventing duplicates.

### 1.14 — Successful sign-up → redirect
🟠 **High**
 **Role:** Signed Out
Complete a valid sign-up. Verify the user is redirected to `/dashboard?tab=account` (not the home page) and sees their new profile.

### 1.15 — Facility is pre-selected from URL
🟡 **Medium**
 **Role:** Signed Out
Navigate to `/?site=validSiteId&user=newPin`. Open sign-up. Verify the facility is pre-selected and the user cannot change it to another facility.

### 1.16 — PIN is pre-filled and hidden
🟡 **Medium**
 **Role:** Signed Out
Navigate to the sign-up page via a facility URL with `?user=123456`. Verify the inmate PIN field does not require manual entry — the PIN from the URL is submitted automatically.

---

## Section 2 — Sign-In Flow

### 2.1 — Successful sign-in (regular user, correct facility/PIN)
🔴 **Critical**
 **Role:** Regular User
From `/?site=correctSiteId&user=correctPin`, sign in with valid credentials. Verify redirect to `/dashboard`.

### 2.2 — Facility mismatch rejection
🔴 **Critical**
 **Role:** Regular User
Sign in as a user whose facility is Facility A, but from a URL with `?site=FacilityB_siteId`. Verify the user is immediately signed out and shown a "wrong link" error message. Verify the user does not reach the dashboard.

### 2.3 — PIN mismatch rejection
🔴 **Critical**
 **Role:** Regular User
Sign in as a user from Facility A using the correct `?site=` but with `?user=WRONGPIN` (a PIN belonging to a different user). Verify sign-in is rejected with an error. Verify the user cannot access the dashboard.

### 2.4 — Generic error message (wrong password)
🔴 **Critical**
 **Role:** Signed Out
Enter a valid username but wrong password. Verify the error says "Incorrect username or password" — not "Password is wrong" or anything that reveals the username exists.

### 2.5 — Generic error message (nonexistent username)
🔴 **Critical**
 **Role:** Signed Out
Enter a username that does not exist. Verify the error says "Incorrect username or password" — identical to the wrong-password error. Verify timing is similar (no measurable delay difference that leaks information).

### 2.6 — Admin/contributor bypass facility check
🟠 **High**
 **Role:** Admin
Sign in as an admin from a facility URL (`?site=...&user=...`). Verify the admin is not subjected to the facility+PIN match check and is redirected to `/admin` normally.

### 2.7 — Facility User bypass facility check
🟠 **High**
 **Role:** Facility User
Sign in as a Facility User account from a facility URL. Verify the facility check does not block them and they are redirected to `/admin`.

### 2.8 — Nav freeze during post-auth check
🟡 **Medium**
 **Role:** Regular User
On a shared-device URL, sign in with valid credentials. Observe the navigation bar during the post-auth check. Verify it stays in its unauthenticated state (shows "Sign In" not the user's name) until the check completes or fails.

### 2.9 — Sign-out preserves facility + PIN URL
🔴 **Critical**
 **Role:** Regular User
From `/?site=siteId&user=123456`, sign in and then sign out. Verify the user is redirected to `/?site=siteId&user=123456` — not to a bare `/`. Verify the next person must enter their own credentials against that PIN.

### 2.10 — Admin redirect after sign-in
🟠 **High**
 **Role:** Admin
Sign in as an admin. Verify redirect goes to `/admin`, not `/dashboard`.

### 2.11 — Contributor redirect after sign-in
🟠 **High**
 **Role:** Contributor
Sign in as a contributor. Verify redirect goes to `/admin`.

### 2.12 — Redirect param is honored
🟠 **High**
 **Role:** Signed Out → Admin
Navigate directly to `/admin/analytics` while signed out. Verify redirect to `/signup?redirect=/admin/analytics`. Sign in as admin. Verify the redirect lands on `/admin/analytics`.

---

## Section 3 — Password Reset

### 3.1 — Username enumeration prevention at Step 1
🔴 **Critical**
 **Role:** Signed Out
Enter a username that does not exist. Verify fake security question keys are returned and Step 2 appears as if it were a real user. Verify the error at Step 2 does not reveal the username doesn't exist — only "Username or security answers are incorrect."

### 3.2 — Correct reset flow
🔴 **Critical**
 **Role:** Signed Out
Enter a valid username → verify the correct two security questions are shown → enter correct answers + new password → verify success toast → verify sign-in works with the new password.

### 3.3 — Wrong answers rejected
🔴 **Critical**
 **Role:** Signed Out
Go through reset Step 1, then submit incorrect answers at Step 2. Verify a generic error appears and the password is not changed.

### 3.4 — PIN + facility verification on shared device
🔴 **Critical**
 **Role:** Signed Out
On a shared-device URL (`?site=A&user=PIN_belonging_to_UserX`), initiate a password reset for a different user's username (UserY). Verify the server returns fake questions — not UserY's real questions — because the PIN doesn't match UserY.

### 3.5 — Rate limiting — question probing
🔴 **Critical**
 **Role:** Signed Out
Submit Step 1 (username lookup) 31 times within one hour from the same IP. Verify the 31st request returns a "Too many requests" error.

### 3.6 — Rate limiting — reset submissions
🔴 **Critical**
 **Role:** Signed Out
Submit a full reset attempt (Step 1 + Step 2) 9 times within one hour from the same IP. Verify the 9th attempt returns a "Too many requests" error.

### 3.7 — New password minimum length
🟠 **High**
 **Role:** Signed Out
At Step 2, enter a new password shorter than 8 characters. Verify the form prevents submission with an appropriate error.

### 3.8 — Password mismatch at reset
🟠 **High**
 **Role:** Signed Out
Enter different values in "New password" and "Confirm password" at Step 2. Verify an error appears and the reset does not proceed.

---

## Section 4 — Main Page & Public Experience

### 4.1 — Category grid loads for anonymous visitor
🟠 **High**
 **Role:** Signed Out
Visit the main page without signing in. Verify all published categories appear in the grid. Verify no progress bars appear on the cards.

### 4.2 — Progress bars appear when signed in
🟠 **High**
 **Role:** Regular User
Sign in as a regular user. Verify each category card shows a progress bar at the bottom reflecting the user's actual completion. Mark an item complete on the category page. Return to the main page. Verify the bar updates.

### 4.3 — Categories / Items counter
🟠 **High**
 **Role:** Admin → Regular User
Verify the "X Categories / Y Items" counter above the grid shows accurate counts. Add a new published category and item in admin. Refresh. Verify both numbers increase.

### 4.4 — Item count on category card respects facility restrictions
🟡 **Medium**
 **Role:** Admin → Regular User
Create an item in Category A restricted to Facility B only. Sign in as a Facility A user. Verify that item does not appear in the item count badge on Category A's card.

### 4.5 — "New content" badge appears and clears
🟡 **Medium**
 **Role:** Admin → Regular User
Add a new item to a category. Sign in as a user who has not opened it. Verify a "New content added" badge appears on the category card. Open the item on the category page. Return to the main page. Verify the badge is gone.

### 4.6 — Search returns correct results
🟠 **High**
 **Role:** Regular User
Type 2+ characters in the search box. Verify results show only items whose title or description contains the search term. Verify results respect facility visibility (restricted items are hidden). Clear the search — verify the grid returns to normal.

### 4.7 — Search with no results
🟡 **Medium**
 **Role:** Regular User
Search for a string that matches no items. Verify a "No results found" message appears. Verify the category grid does not appear alongside the message.

### 4.8 — Site-wide message banner shows and dismisses
🟠 **High**
 **Role:** Admin → Regular User
In admin, enable the site-wide message with a test message. Sign in as a user. Verify the banner appears at the top. Dismiss it. Reload. Verify it does not reappear. Update the message in admin. Reload. Verify the banner reappears.

### 4.9 — Facility message shows for the right facility only
🟠 **High**
 **Role:** Admin → Regular User
Set a message for Facility A. Sign in as a Facility A user. Verify the facility message banner appears. Sign in as a Facility B user. Verify the Facility A banner does not appear.

### 4.10 — Anonymous facility message (via URL)
🟡 **Medium**
 **Role:** Signed Out
Without signing in, visit `/?site=facilityASiteId`. Verify the Facility A message banner appears.

### 4.11 — Language toggle on main page
🟠 **High**
 **Role:** Regular User
Click the EN/ES toggle. Verify all nav labels, category names (if translated), taglines, and UI text switch to Spanish. Reload. Verify the language preference persists. Toggle back. Verify English is restored.

### 4.12 — Facility-specific home page (facilityUser redirect)
🟠 **High**
 **Role:** Facility User
Sign in as a Facility User. Verify they are redirected from `/` to `/facility/[their-site-id]`. Verify they do not see the generic home page.

### 4.13 — /facility/$slug 404 for invalid slug
🟡 **Medium**
 **Role:** Signed Out
Navigate to `/facility/does-not-exist`. Verify a 404 page is shown, not a crash.

### 4.14 — Footer links are present and correct
🟢 **Low**
 **Role:** Signed Out
Verify the footer shows: current year copyright, Privacy link (→ `/privacy`), Terms of Service link (→ `/terms`), and the 988 crisis line text. Verify both links work.

---

## Section 5 — Category Page (User-Facing)

### 5.1 — Category page loads with all published items
🔴 **Critical**
 **Role:** Regular User
Navigate to a category. Verify all published items appear. Verify draft items do not appear. Verify item order matches admin sort order.

### 5.2 — Facility-restricted item hidden from wrong facility user
🔴 **Critical**
 **Role:** Admin → Regular User
Create an item in Category A restricted to Facility B. Sign in as a Facility A user. Navigate to Category A. Verify the restricted item does not appear.

### 5.3 — Facility-restricted item visible to admin
🟠 **High**
 **Role:** Admin
Sign in as an admin. Navigate to a category with facility-restricted items. Verify all items appear (restricted items show a facility badge). Verify no items are hidden from admins.

### 5.4 — Video — opens player dialog
🟠 **High**
 **Role:** Regular User
Click a video item. Verify a modal/dialog opens containing a `<video>` element. Verify the video plays. Verify the title is shown in the dialog.

### 5.5 — Video — progress tracked and auto-completes at 95%
🔴 **Critical**
 **Role:** Regular User
Play a video to exactly 95% of its duration. Verify the item is automatically marked as "Watched" without the user tapping anything. Verify the progress badge updates immediately. Verify the achievement check runs (check for a toast if a milestone is hit).

### 5.6 — Video — resumes from last position
🔴 **Critical**
 **Role:** Regular User
Play a video to ~50%. Close the dialog. Reopen the video. Verify playback resumes from approximately the 50% position rather than from 0:00.

### 5.7 — Video — progress badge shows percentage
🟠 **High**
 **Role:** Regular User
Play a video to ~40%. Close the dialog. Verify the item's action badge shows something like "40% watched" — not "Not watched" and not "Watched."

### 5.8 — Audio — same behavior as video
🟠 **High**
 **Role:** Regular User
Repeat tests 5.4–5.7 for an audio item. Verify "Listened" label instead of "Watched."

### 5.9 — PDF — opens viewer dialog
🟠 **High**
 **Role:** Regular User
Click a PDF item. Verify the in-app PDF viewer opens. Verify the PDF renders. Verify multi-page PDFs show navigation controls (Previous / Next / page count). Verify page navigation works.

### 5.10 — PDF — auto-completes at 95% reading time
🔴 **Critical**
 **Role:** Regular User
Open a PDF and remain on it for 95% of its estimated reading time (check the `duration` field in admin for the estimate). Verify the PDF auto-marks as "Read."

### 5.11 — PDF — manual "Mark as read" before finishing
🟠 **High**
 **Role:** Regular User
Open a PDF briefly (e.g., 10% of reading time). Close it. Verify a "Mark as read" button appears on the item (after the viewer has been opened at least once). Click it. Verify the item is marked read and the badge shows "Read manually at X%."

### 5.12 — Image — opens and auto-marks complete
🟠 **High**
 **Role:** Regular User
Click an image item. Verify the image displays. Close the viewer. Verify the item is immediately marked as "Viewed."

### 5.13 — External link — opens and auto-marks complete
🟠 **High**
 **Role:** Regular User
Click a link-type item. Verify it opens in a new tab. Verify the item is marked as "Clicked" after the click.

### 5.14 — Worksheet/Article — manual mark as read
🟠 **High**
 **Role:** Regular User
Click the action badge on a worksheet or article item. Verify it changes from "Mark as read" to "Read" with the current date. Verify the category progress ring increases.

### 5.15 — Exempt item — Acknowledge button and disclaimer
🔴 **Critical**
 **Role:** Regular User
Verify an exempt item shows:
- An info icon (ⓘ) next to the title
- "Acknowledge" as the action button (not "Mark as read")
- A disclaimer "Doesn't count toward your progress" beneath the button

Click Acknowledge. Verify the badge changes to "Acknowledged." Refresh. Verify it stays "Acknowledged."

### 5.16 — Exempt item — does NOT count toward ring or stats
🔴 **Critical**
 **Role:** Regular User
Before acknowledging an exempt item, note the category progress ring percentage. Acknowledge the item. Verify the ring percentage does NOT change. Verify the overall progress ring on the dashboard does NOT change. Verify the stat card "Items Completed" does NOT increase.

### 5.17 — Exempt item — excluded from denominator
🟠 **High**
 **Role:** Regular User
In a category with 5 items (1 exempt), verify the header shows "X of 4" — not "X of 5." Verify the exempt item is not counted in the denominator.

### 5.18 — Ratings appear after completion
🟠 **High**
 **Role:** Regular User
Complete an item. Verify thumbs-up and thumbs-down buttons appear alongside the badge. Rate the item as Helpful. Verify the thumbs-up is filled/active. Rate it Not Helpful. Verify the thumbs-down fills and the thumbs-up clears. Tap the active rating again. Verify the rating is removed.

### 5.19 — Bookmark toggle
🟠 **High**
 **Role:** Regular User
Tap the bookmark icon on an item. Verify it fills/activates (item is saved). Navigate to the dashboard Saved tab. Verify the item appears. Return to the category page. Tap the bookmark again. Verify it unfills. Navigate to Saved. Verify the item is gone.

### 5.20 — Category completion celebration modal
🟠 **High**
 **Role:** Regular User
Complete the last item in a category. Verify a modal appears with "You completed [Category Name]" and a congratulatory message. Click "Keep going." Verify the modal closes and does not reappear on reload.

### 5.21 — Type filter
🟡 **Medium**
 **Role:** Regular User
On a category with mixed content types, use the type filter dropdown. Select "Video." Verify only video items appear. Select "All." Verify all items return.

### 5.22 — Other categories carousel
🟡 **Medium**
 **Role:** Regular User
Verify the "Other categories" carousel at the bottom of the category page shows other published categories (excluding the current one). Verify clicking a card navigates to that category. Verify carousel navigation arrows work.

### 5.23 — Category 404 for unpublished slug
🟡 **Medium**
 **Role:** Admin → Regular User
Navigate to `/category/draft-category-slug` where the category exists but is unpublished. Verify a 404 page appears.

### 5.24 — Category 404 for nonexistent slug
🟡 **Medium**
 **Role:** Regular User
Navigate to `/category/totally-made-up-slug`. Verify a 404 page appears, not a crash.

### 5.25 — "New" badge on items
🟡 **Medium**
 **Role:** Admin → Regular User
Add a new item to a category (or use an item added in the last 7 days that the current user hasn't opened). Verify a "New" badge appears on that item. Open the item. Verify the "New" badge disappears.

### 5.26 — Session time is tracked during video/audio playback
🟡 **Medium**
 **Role:** Regular User → Admin
Open a video. Play it for ~1 minute without pausing. Close the dialog. Navigate to the individual user report in admin. Verify session time for that item shows approximately 1 minute.

### 5.27 — Language toggle on category page
🟠 **High**
 **Role:** Regular User
On a category that has Spanish translations, toggle to Spanish. Verify category name, tagline, item titles, descriptions, and all action badge labels switch to Spanish. Toggle back. Verify English returns.

---

## Section 6 — User Dashboard

### 6.1 — Dashboard requires authentication
🔴 **Critical**
 **Role:** Signed Out
Navigate to `/dashboard` without being signed in. Verify redirect to `/signup?redirect=/dashboard`.

### 6.2 — Resume card appears for in-progress content
🟠 **High**
 **Role:** Regular User
Partially complete a video (e.g., 40%). Navigate to the dashboard. Verify the "Pick Up Where You Left Off" resume card appears at the top of the My Progress tab showing the video title and progress. Click the card. Verify it navigates to the correct category page and scrolls to that item.

### 6.3 — Resume card disappears when all content completed
🟡 **Medium**
 **Role:** Regular User
Complete every available item. Verify the resume card no longer appears on the dashboard.

### 6.4 — Overall progress ring — weighted calculation
🟠 **High**
 **Role:** Regular User
With a fresh account, open a video and watch to 60%. Verify the overall ring is not 0% — it reflects the partial progress. Complete the video. Verify the ring increases to reflect 100% for that item.

### 6.5 — Overall ring shows checkmark at 100%
🟡 **Medium**
 **Role:** Regular User
Complete every available item. Verify the overall ring is solid and shows a checkmark icon instead of "100%."

### 6.6 — Stat cards — Items Completed
🟠 **High**
 **Role:** Regular User
Note the "Items Completed" stat. Mark an item complete on the category page. Return to the dashboard. Verify the number increased by 1. Exempt items do not count — acknowledge one and verify the number does not change.

### 6.7 — Stat cards — Day Streak
🟡 **Medium**
 **Role:** Regular User
Verify the streak count matches the number of consecutive days the account has been logged in. (If you can simulate a gap by checking login history, do so.)

### 6.8 — Monthly summary — appears with activity
🟠 **High**
 **Role:** Regular User
Complete at least one item this calendar month. Verify the monthly summary card appears (not hidden). Expand it. Verify it shows the correct item count and time spent for this month. Verify the delta label compares to last month's count.

### 6.9 — Monthly summary — hidden with no activity
🟡 **Medium**
 **Role:** Regular User
Use a fresh account with no completions this month. Verify the monthly summary card does not appear.

### 6.10 — Monthly summary — achievements this month
🟡 **Medium**
 **Role:** Regular User
Earn an achievement this month (e.g., complete the first item for "First Resource"). Expand the monthly summary. Verify the achievement icon appears in the third column with a tooltip showing the achievement name.

### 6.11 — Engagement tier — appears only with sufficient users
🟡 **Medium**
 **Role:** Regular User
On a facility with fewer than 10 users, verify the engagement tier card does not appear on the dashboard (or shows no percentile). On a facility with 10+ users, verify the tier and percentile are shown.

### 6.12 — Category accordion — progress rings correct
🟠 **High**
 **Role:** Regular User
Expand a category accordion. Verify the category's circular ring shows the correct weighted progress. Complete an item in that category. Verify the ring updates without a page reload.

### 6.13 — Category accordion — exempt items excluded from count
🔴 **Critical**
 **Role:** Regular User
In a category with 5 items (1 exempt), verify the accordion header shows "X of 4 items" — not "X of 5." Acknowledge the exempt item. Verify the "X of 4" denominator does not change.

### 6.14 — Category completion celebration fires from dashboard
🟠 **High**
 **Role:** Regular User
From the dashboard, click through to a category page (via the category accordion link). Complete the last item. Return to the dashboard. Verify the completion modal fires.

### 6.15 — Saved tab — bookmarked items appear
🟠 **High**
 **Role:** Regular User
Bookmark two items from different categories. Navigate to the Saved tab. Verify both items appear with their category icon and name. Verify clicking an item navigates to the correct category page and item.

### 6.16 — Saved tab — removing a bookmark
🟠 **High**
 **Role:** Regular User
On the Saved tab, click the bookmark icon on an item to remove it. Verify the item disappears from the list immediately (optimistic update). Refresh. Verify it remains gone.

### 6.17 — Saved tab — empty state
🟡 **Medium**
 **Role:** Regular User
Remove all bookmarks. Navigate to the Saved tab. Verify an empty state message appears prompting the user to save resources.

### 6.18 — Achievements tab — all 13 show
🟠 **High**
 **Role:** Regular User
Navigate to the Achievements tab. Verify all 13 achievement badges appear. Verify earned badges are in accent color. Verify unearned badges are dimmed. Verify the "X of 13 earned" count is accurate.

### 6.19 — Achievement unlocks correctly: First Resource
🔴 **Critical**
 **Role:** Regular User
Use a fresh account. Complete the first item. Verify:
- A toast notification appears: "Achievement unlocked: First Resource"
- The Achievements tab count increases by 1
- The "First Resource" badge is now lit up in the Achievements tab

### 6.20 — Achievement: items_10 (10 Resources)
🟠 **High**
 **Role:** Regular User
Complete 10 non-exempt items. Verify the "10 Resources" achievement toast fires after the 10th completion.

### 6.21 — Achievement: program_1 (Category Graduate)
🟠 **High**
 **Role:** Regular User
Complete every item in a category (all non-exempt). Verify the "Category Graduate" achievement fires.

### 6.22 — Achievement: time_5h (5 Hours In)
🟡 **Medium**
 **Role:** Regular User
Accumulate 5 hours of active session time across items. Verify the "5 Hours In" achievement fires.

### 6.23 — Achievement: streak_7 (7-Day Streak)
🟡 **Medium**
 **Role:** Regular User
Log in on 7 consecutive days. Verify the "7-Day Streak" achievement fires.

### 6.24 — Achievements are NOT awarded for exempt items
🔴 **Critical**
 **Role:** Regular User
Acknowledge an exempt item. Verify the "First Resource" achievement does NOT fire (exempt items don't count toward achievement milestones).

### 6.25 — Account tab — profile information
🟡 **Medium**
 **Role:** Regular User
Navigate to the Account tab. Verify username, full name, facility, and join date are shown correctly.

### 6.26 — Account tab — update security questions
🟠 **High**
 **Role:** Regular User
Click "Update security questions." Choose 2 new questions with new answers. Submit. Verify a success toast. Sign out. Go through the password reset flow using the new answers. Verify reset succeeds.

### 6.27 — Account tab — security questions locked until set up
🔴 **Critical**
 **Role:** Regular User
Create a new account and skip security question setup (if possible). Navigate directly to the Progress tab. Verify it is locked with a prompt to set up questions. Verify you cannot access content until questions are configured.

### 6.28 — Forced password reset (tester/facilityUser first login)
🟠 **High**
 **Role:** Regular User
Sign in to an account that has the `must_reset_password` flag set. Verify a password reset form appears before dashboard content is accessible. Complete the reset. Verify the flag is cleared and normal dashboard access is restored.

---

## Section 7 — Admin Access Control

### 7.1 — Unauthenticated access to admin pages
🔴 **Critical**
 **Role:** Signed Out
While signed out, navigate directly to each of the following URLs. Verify each redirects to `/signup?redirect=...`:
- `/admin`
- `/admin/analytics`
- `/admin/users`
- `/admin/messages`
- `/admin/facilities`
- `/admin/ip-allowlist`
- `/admin/audit-log`
- `/admin/errors`

### 7.2 — Regular user cannot access any admin page
🔴 **Critical**
 **Role:** Regular User
Sign in as a regular user. Navigate directly to `/admin`. Verify a redirect or "access required" message — not the admin dashboard. Try all admin URLs listed in 7.1. Verify every attempt fails.

### 7.3 — Contributor — content pages accessible
🔴 **Critical**
 **Role:** Contributor
Sign in as a contributor. Verify access to:
- `/admin/` — categories list ✓
- `/admin/category/$id` — category editor ✓
- `/admin/privacy` — privacy editor ✓
- `/admin/terms` — terms editor ✓

### 7.4 — Contributor — blocked from non-content pages
🔴 **Critical**
 **Role:** Contributor
Sign in as a contributor. Navigate directly to each of these URLs. Verify each is blocked (redirect or error):
- `/admin/analytics`
- `/admin/users`
- `/admin/messages`
- `/admin/facilities`
- `/admin/ip-allowlist`
- `/admin/audit-log`
- `/admin/errors`
- `/admin/home`
- `/admin/icons-badges`
- `/admin/seed`

### 7.5 — Facility User — correct pages accessible
🔴 **Critical**
 **Role:** Facility User
Sign in as a Facility User. Verify access to:
- `/admin/analytics` ✓
- `/admin/users` ✓
- `/admin/messages` ✓

Verify they are redirected away from `/admin/` (categories) to `/admin/users`.

### 7.6 — Facility User — blocked from admin-only pages
🔴 **Critical**
 **Role:** Facility User
Sign in as a Facility User. Navigate directly to:
- `/admin/facilities` → blocked
- `/admin/ip-allowlist` → blocked
- `/admin/audit-log` → blocked
- `/admin/errors` → blocked
- `/admin/home` → blocked
- `/admin/icons-badges` → blocked
- `/admin/seed` → blocked
- `/admin/category/$id` → blocked (redirected to `/admin/users`)

### 7.7 — Facility User — data is scoped to their facility only
🔴 **Critical**
 **Role:** Facility User
Sign in as Facility User A. Verify:
- Analytics shows only Facility A's data
- User list shows only Facility A's users
- Individual user reports show only users at Facility A
- Clicking a user from another facility (if reachable via URL manipulation) is rejected server-side

### 7.8 — Facility User cannot view users at other facilities via URL
🔴 **Critical**
 **Role:** Facility User
Sign in as Facility User A. Obtain a `userId` belonging to Facility B. Open the analytics users tab and try to navigate to or construct a URL that would show Facility B's user report. Verify the server rejects the request with a "Forbidden" error.

### 7.9 — Server functions enforce access independently of route guards
🔴 **Critical**
 **Role:** Regular User
This tests that route guards alone are not the security boundary. Using browser devtools or a REST client, call a server function directly (e.g., `listAdminUsers`) while authenticated as a regular user. Verify the call is rejected with a 403 or "Forbidden" error even though the route guard has been bypassed.

### 7.10 — Admin cannot delete their own account
🟠 **High**
 **Role:** Admin
Sign in as an admin. Navigate to the Users page. Find the current admin's own account. Verify the Delete button is absent or disabled. Verify the "Delete selected" bulk action does not include the current user.

### 7.11 — Admin cannot revoke their own admin role
🟠 **High**
 **Role:** Admin
Sign in as an admin. Find the current user's own account. Verify the role toggle for "Admin" is disabled or that attempting to disable it shows an error.

---

## Section 8 — Admin Content Management

### 8.1 — Create a new category
🟠 **High**
 **Role:** Admin
Click "New category." Fill in name, slug, tagline, description. Click Create. Verify:
- The category appears in the admin list
- The category does NOT appear on the public site yet (if published=false)
- Toggle published. Verify it appears on the public home page.

### 8.2 — Slug is auto-generated from name
🟡 **Medium**
 **Role:** Admin
Type a category name (e.g., "My New Category"). Verify the slug field auto-populates as "my-new-category." Manually edit the slug. Verify it doesn't auto-update after manual editing.

### 8.3 — Duplicate slug is rejected
🟡 **Medium**
 **Role:** Admin
Create a category with a slug that already exists. Verify the form shows an error or the database rejects it with a clear message.

### 8.4 — Category drag-and-drop reorder
🟡 **Medium**
 **Role:** Admin
In the admin category list, drag a category to a new position. Verify the order updates in the list. Refresh the admin page. Verify the order persists. Visit the public home page. Verify the categories appear in the new order.

### 8.5 — Bulk delete categories
🟡 **Medium**
 **Role:** Admin
Enter edit mode. Select 2+ categories. Click "Delete selected." Confirm in the dialog. Verify the categories are removed from both the admin list and the public site.

### 8.6 — Add content item
🟠 **High**
 **Role:** Admin
Within a category editor, click the add item button. Fill in title, type, URL, description, duration. Save. Verify the item appears in the category list and on the public category page (if published).

### 8.7 — Upload a file — progress bar displays
🟡 **Medium**
 **Role:** Admin
Upload a PDF or video file via the file uploader. Verify the button shows a real-time percentage progress bar during upload. Verify the bar fills smoothly and the URL is populated after upload completes.

### 8.8 — Uploading a replacement file deletes the old one
🟡 **Medium**
 **Role:** Admin
Upload a file to an item. Save. Upload a different file to the same item. Verify the old file URL is no longer accessible (or that the admin UI no longer references it) and the new file is used.

### 8.9 — PDF reading time auto-estimation
🟡 **Medium**
 **Role:** Admin
Upload a text-based PDF. Verify the duration field is automatically populated with an estimated reading time (e.g., "5 min read"). Verify the estimate is reasonable relative to the PDF's page count and word density.

### 8.10 — Published / draft toggle
🟠 **High**
 **Role:** Admin
Publish an item. Verify it appears for users on the category page. Toggle it to draft. Verify it disappears from the public category page. Verify it remains visible in the admin editor.

### 8.11 — Item drag-and-drop reorder within category
🟡 **Medium**
 **Role:** Admin
In the category editor, drag an item to a new position. Verify the order changes. Verify the public category page reflects the new order.

### 8.12 — Facility restriction on category
🟠 **High**
 **Role:** Admin → Regular User
Add a category and restrict it to Facility A only. Sign in as a Facility B user. Verify the category does not appear on their home page or category list. Sign in as a Facility A user. Verify the category is visible.

### 8.13 — Facility restriction on individual item
🟠 **High**
 **Role:** Admin → Regular User
Restrict a specific item within a shared category to Facility A only. Sign in as a Facility B user. Navigate to the category. Verify that specific item is not shown. Sign in as a Facility A user. Verify the item appears.

### 8.14 — Exempt from tracking toggle
🔴 **Critical**
 **Role:** Admin → Regular User
Mark an item as "Exempt from tracking." Save. As a user:
- Verify the item shows an "Acknowledge" button (not "Mark as read")
- Verify the disclaimer "Doesn't count toward your progress" appears
- Verify acknowledging does not affect the progress ring, stats, or achievements
- Verify the item does NOT appear in the analytics content engagement section

### 8.15 — Custom content type — create
🟡 **Medium**
 **Role:** Admin
In the type dropdown on an item, type a new type name (e.g., "Workbook") and create it. Verify the new type appears in the dropdown. Verify it appears in the Icons & Badges page with a unique color. Verify it appears as a type filter on the public category page.

### 8.16 — Custom content type — delete
🟡 **Medium**
 **Role:** Admin
Delete a custom type from the Icons & Badges page. Verify all items that used that type are reassigned to "Article." Verify the type no longer appears in the dropdown for new items.

### 8.17 — AI copy generation
🟡 **Medium**
 **Role:** Admin
Enter a category name and click "Auto-generate tagline & description." Verify a suggested tagline and description are filled in within a few seconds. Verify an error is not shown on success.

### 8.18 — AI translation (category)
🟡 **Medium**
 **Role:** Admin
Fill in English fields for a category. Click "Add Spanish translation." Verify the Spanish fields are populated with plausible translations. Verify the English fields are not overwritten.

### 8.19 — AI translation (content item)
🟡 **Medium**
 **Role:** Admin
Fill in English fields for a content item. Click "Add Spanish translation." Verify the Spanish title, description, and source are populated. Verify English fields are unchanged.

### 8.20 — Translation status badge accuracy
🟡 **Medium**
 **Role:** Admin
Verify that the translation badge on a category/item shows:
- "Complete" when all English fields with content have Spanish equivalents
- "Partially translated" when some fields are translated but not all
- "Needs ES" when no Spanish fields are filled despite English content being present

### 8.21 — Seed content CSV import
🟡 **Medium**
 **Role:** Admin
Prepare a CSV with valid `category_slug` and `title` columns. Import via the seed page. Verify the items appear in the correct categories. Verify the preview table with validation is shown before import. Verify rows with missing required fields show errors in the preview without blocking valid rows.

---

## Section 9 — Admin User Management

### 9.1 — User list loads and paginates
🟠 **High**
 **Role:** Admin
Navigate to `/admin/users`. Verify all sections load (Admins, Testers, Facility Staff, Registered Users). Verify the registered users list paginates (10 per page). Verify page navigation works.

### 9.2 — Search filters by name/username/PIN
🟠 **High**
 **Role:** Admin
Type a partial username in the search box. Verify results update after ~300ms (debounced). Verify only matching users appear. Clear the search. Verify all users return.

### 9.3 — Facility filter
🟠 **High**
 **Role:** Admin
Select a specific facility from the facility filter. Verify only users from that facility appear in the list. Select "All." Verify all users return.

### 9.4 — New user badge in navigation
🟡 **Medium**
 **Role:** Regular User → Admin
Sign up a new regular user. Without visiting the Users page, sign in as an admin. Verify the AdminNav shows a badge count next to "Users" indicating new users. Navigate to the Users page. Verify the badge clears on the next visit.

### 9.5 — Set user password
🟠 **High**
 **Role:** Admin
Expand a user's row. Enter a new password for that user (min 8 chars). Save. Sign out. Sign in as that user with the new password. Verify success.

### 9.6 — Send password reset email
🟡 **Medium**
 **Role:** Admin
Click "Send password reset email" for a user with an email address. Verify a success toast appears. (Email delivery is external — verify the API call succeeds, not necessarily that the email arrives.)

### 9.7 — Clear security questions
🟠 **High**
 **Role:** Admin
Clear security questions for a user. Verify a success toast. Verify the password reset flow for that user fails at Step 1 (no real questions → fake questions returned). Verify the user can re-enroll questions from their Account tab.

### 9.8 — Create admin/contributor account
🟠 **High**
 **Role:** Admin
Click "Add user" → select "Admin or Contributor." Enter an email and password. Assign a role. Submit. Verify the account appears in the Admins & Contributors section. Sign in with those credentials. Verify the correct admin panel access.

### 9.9 — Create tester account
🟡 **Medium**
 **Role:** Admin
Create a tester account. Verify it appears in the Testers section. Sign in as the tester. Verify the tester can browse content like a regular user. Verify tester activity does NOT appear in analytics reports.

### 9.10 — Create facility user account
🟠 **High**
 **Role:** Admin → Facility User
Create a facility user account for Facility A. Verify `must_reset_password` is set (the account should prompt for a reset on first sign-in). Sign in as the new facility user. Verify the password reset is required. Complete it. Verify access is scoped to Facility A.

### 9.11 — Role assignment — single role invariant
🟠 **High**
 **Role:** Admin
Find a user with the "Admin" role. Assign the "Contributor" role to them. Verify the "Admin" role is automatically removed. Verify the user now has only "Contributor" access.

### 9.12 — Delete a single user
🟠 **High**
 **Role:** Admin
Delete a regular user. Verify confirmation dialog appears. Confirm deletion. Verify the user no longer appears in the list. Verify the user cannot sign in.

### 9.13 — Bulk delete users
🟡 **Medium**
 **Role:** Admin
Enter edit mode. Select 3 users. Click "Delete selected." Confirm. Verify all 3 are removed from the list. Verify none of them can sign in.

### 9.14 — Facility User can only see their facility's users
🔴 **Critical**
 **Role:** Facility User
Sign in as Facility User A. Navigate to `/admin/users`. Verify only Facility A's regular users appear in the registered users section. Verify Admins and Testers sections are hidden. Verify the facility filter dropdown is locked to Facility A.

### 9.15 — Facility User can set password for their facility's user
🟠 **High**
 **Role:** Facility User
Sign in as Facility User A. Set the password for a Facility A regular user. Verify success. Verify the regular user can sign in with the new password.

### 9.16 — Facility User cannot manage Facility B's users
🔴 **Critical**
 **Role:** Facility User
Sign in as Facility User A. Obtain a `userId` for a Facility B user. Try to call `setUserPassword` via the API (or construct the request directly). Verify the server returns a "Forbidden" error — the action is blocked server-side regardless of client input.

---

## Section 10 — Admin Analytics

### 10.1 — Overall tab loads and shows correct totals
🟠 **High**
 **Role:** Admin
Navigate to the Analytics Overall tab. Verify summary cards show non-zero values (assuming data exists). Verify time range switching (Last 7 days, 30 days, etc.) updates the displayed numbers.

### 10.2 — Category accordion in usage report
🟠 **High**
 **Role:** Admin
Expand a category in the usage report. Verify per-item stats appear: open count, completion rate, avg time, helpful/not-helpful, bookmarks. Verify exempt items are NOT listed.

### 10.3 — Most & Least Engaged Content
🟠 **High**
 **Role:** Admin
Verify the Most/Least Engaged section shows two tabs. Switch between them. Verify the Most Engaged tab shows items with the highest completion rates. Verify the Least Engaged tab shows items with the lowest completion rates. Verify only items with sufficient open data are included.

### 10.4 — By Facility tab — data scoped correctly
🔴 **Critical**
 **Role:** Admin
Select Facility A from the facility picker. Verify all metrics (visits, opens, time, users) reflect only Facility A's users. Switch to Facility B. Verify numbers change to reflect Facility B's data.

### 10.5 — By Facility tab — facility ranking shown
🟡 **Medium**
 **Role:** Admin
Select a specific facility. Verify the facility's ranking in the overall comparison is shown (e.g., "#3 of 5 facilities by completion rate").

### 10.6 — Users tab — user list with engagement data
🟠 **High**
 **Role:** Admin
Select a facility in the Users tab. Verify registered users appear with their last login date and engagement tier. Verify synthetic/tester accounts do not appear in the user list.

### 10.7 — Individual user report — correct section order
🟠 **High**
 **Role:** Admin
Click a user to open their individual report. Verify sections appear in this order: stat cards → monthly summary → engagement tier → achievements → category list. Verify no section appears before stat cards.

### 10.8 — Individual user report — exempt items shown with disclaimer
🟠 **High**
 **Role:** Admin
Open a user report for a user who has acknowledged an exempt item. Verify the exempt item appears in the category list with "Acknowledged" badge and "Doesn't count toward this user's progress" disclaimer. Verify it is NOT counted in "X of Y items completed."

### 10.9 — Individual user report — ratings and bookmarks visible
🟡 **Medium**
 **Role:** Admin
Open a user report for a user who has rated and bookmarked items. Verify ratings ("Helpful" / "Not helpful") appear on the relevant items. Verify bookmarked items show the bookmark indicator.

### 10.10 — Export CSV — Usage report
🟡 **Medium**
 **Role:** Admin
Click Export CSV on the Overall usage report. Verify a CSV file downloads. Open it. Verify the header row is present. Verify category and item data appears. Verify columns match documentation (Category, Item title, opens, completions, etc.).

### 10.11 — Export CSV — Facility comparison
🟡 **Medium**
 **Role:** Admin
Click the CSV export button in the Facility Comparison section. Verify a CSV downloads with one row per facility, containing user counts, completion rate, time spent, bookmarks, and ratings.

### 10.12 — Export CSV — Individual user progress
🟡 **Medium**
 **Role:** Admin
Click "Export CSV" on an individual user report. Verify the CSV downloads. Verify column headers: Category, Item Title, Read, Read On, Progress, Time Spent, Bookmarked, Rating. Verify category appears only on the summary row (not repeated for every item). Verify item rows have blank category column.

### 10.13 — Export CSV — Facility users list
🟡 **Medium**
 **Role:** Admin
Click "Export CSV" on the facility user list. Verify a CSV downloads with one row per user. Verify columns include name, username, PIN, signup date, last login, engagement tier.

### 10.14 — Export CSV — Bulk facility progress
🟠 **High**
 **Role:** Admin
Select a specific facility. Click "Export All Progress (CSV)." Verify a CSV downloads. Verify:
- One row per user × item
- Items are grouped by category in display order
- User-level fields (First Name, Last Name, etc.) appear only on the first row per user — blank for subsequent rows
- Category appears only on the first row per category per user — blank for subsequent items in that category
- Columns: First Name, Last Name, Username, PIN, Last Login, Items Completed, Time Spent (hrs), Category, Item Title, Completed, Completed On, Progress %, Time on Item (min), Bookmarked, Rating

### 10.15 — Bulk progress export — not available for "all facilities"
🟡 **Medium**
 **Role:** Admin
In the Users tab, select "All facilities" (the unscoped view). Verify the "Export All Progress" button is not shown — only "Export CSV" (the user list).

### 10.16 — Manual nightly refresh trigger (admin only)
🟡 **Medium**
 **Role:** Admin → Facility User
Sign in as admin. Click the "Refresh" button in the analytics header. Verify a success toast appears and the refresh timestamp updates. Sign in as a Facility User. Verify the refresh button is not visible.

### 10.17 — Tester data excluded from analytics (tracking off)
🔴 **Critical**
 **Role:** Regular User → Admin
With analytics tracking OFF (default — is_synthetic=true in Role Switcher): Sign in as a tester. Complete several items and spend 10+ minutes in content. Sign in as admin. Verify the tester's completions and time do NOT appear in the Overall analytics totals or the CPC Sales facility usage report.

Note: When the tester enables analytics tracking via the Role Switcher (is_synthetic=false), their engagement intentionally appears in the CPC Sales facility report only — this allows QA testing of the facility analytics. It does not appear in the Overall tab regardless.

### 10.18 — Facility User analytics are facility-scoped server-side
🔴 **Critical**
 **Role:** Facility User
Sign in as Facility User A. Verify the analytics page shows only Facility A's data. Attempt to switch the facility filter to Facility B via browser devtools (modify the request). Verify the server rejects the override and returns Facility A's data regardless.

---

## Section 11 — Admin Messages

### 11.1 — Site-wide message — enable and save
🟠 **High**
 **Role:** Admin → Regular User
Navigate to Messages. Enable the site-wide message. Enter text. Save. Visit the main page as a user. Verify the banner appears. Disable the message. Verify the banner is gone.

### 11.2 — Facility message — Facility User can only edit their own
🔴 **Critical**
 **Role:** Facility User
Sign in as Facility User A. Navigate to Messages. Verify only Facility A's message editor is shown — not a facility picker or any other facility's message. Try to submit with a different facility value via devtools. Verify the server rejects the override.

### 11.3 — Spanish translation field
🟡 **Medium**
 **Role:** Admin → Regular User
Enter a message in English and Spanish. Save. Switch the UI language to Spanish. Verify the Spanish version of the message appears in the banner. Switch to English. Verify the English version appears.

### 11.4 — Updated message re-shows to users who dismissed
🟡 **Medium**
 **Role:** Admin → Regular User
Enable a message. Sign in as a user. Dismiss the banner. Sign in as admin. Update the message text and save. Sign in as the user again. Verify the banner reappears (because the content changed).

### 11.5 — Auto-expand Spanish section when translation exists
🟡 **Medium**
 **Role:** Admin
Save a message that already has a Spanish translation. Reload the Messages page. Verify the Spanish section is automatically expanded (not collapsed).

---

## Section 12 — Admin Facilities

### 12.1 — Create a new facility
🟠 **High**
 **Role:** Admin
Click Add Facility. Enter a label and Site ID. Submit. Verify the facility appears in the list. Verify a public URL (`/?site=[siteId]`) resolves correctly and shows the facility's home page.

### 12.2 — Site ID generates the correct URL slug
🟡 **Medium**
 **Role:** Admin
Create a facility with Site ID "Test Facility 01". Verify the derived slug is "test_facility_01" (lowercased, spaces → underscores, special chars stripped). Verify the URL `/?site=test_facility_01` works.

### 12.3 — Duplicate Site ID is rejected
🟡 **Medium**
 **Role:** Admin
Try to create two facilities with the same Site ID. Verify the second attempt is rejected with an appropriate error.

### 12.4 — Edit facility label
🟡 **Medium**
 **Role:** Admin
Edit a facility's label. Verify the new label appears everywhere the facility name is shown (user dropdown, admin analytics picker, reports, etc.).

### 12.5 — Delete a facility
🟡 **Medium**
 **Role:** Admin
Delete a facility. Verify it no longer appears in facility dropdowns, the analytics picker, or the sign-up form. Verify users previously assigned to that facility still exist but may show a blank facility name.

### 12.6 — Facility list shows user count
🟡 **Medium**
 **Role:** Admin
Verify each facility row in the admin list shows the count of registered users. Create a new user at a facility. Verify the count increases.

---

## Section 13 — Admin System Tools

### 13.1 — Audit log — password reset is logged
🟠 **High**
 **Role:** Admin
Set a user's password from the admin Users page. Navigate to the Audit Log. Verify a `user.password_reset` entry appears with the correct actor, target user, and timestamp.

### 13.2 — Audit log — role grant/revoke is logged
🟠 **High**
 **Role:** Admin
Grant or revoke a role from a user. Verify the audit log shows a `user.role_grant` or `user.role_revoke` entry.

### 13.3 — Audit log — user creation is logged
🟠 **High**
 **Role:** Admin
Create a new admin/contributor account. Verify a `user.create` entry appears in the audit log.

### 13.4 — Audit log — free-text search
🟡 **Medium**
 **Role:** Admin
Enter a username or email in the audit log search box. Verify only entries matching that user (as actor or target) appear.

### 13.5 — Audit log — Facility User sees scoped entries only
🟡 **Medium**
 **Role:** Facility User
Sign in as Facility User A. Navigate to the audit log. Verify only entries involving Facility A's users appear. Verify entries for Facility B's users are not shown.

### 13.6 — Error log — client errors appear
🟡 **Medium**
 **Role:** Admin
Intentionally trigger a JavaScript error (or use the browser console to call `reportError(new Error("test"))`). Navigate to the admin Error Log. Verify a "client" source entry appears with the error message.

### 13.7 — Error log — clear old entries
🟡 **Medium**
 **Role:** Admin
Click "Clear older than 30 days." Verify a success toast. Verify entries newer than 30 days are not deleted. Verify entries older than 30 days are gone.

### 13.8 — Icons & Badges — change variant color
🟡 **Medium**
 **Role:** Admin
Change the color of the "New" badge variant. Click Save Changes. Verify the "New" badge on content items reflects the new color. Verify reloading the admin page shows the saved color.

### 13.9 — Icons & Badges — change content type icon
🟡 **Medium**
 **Role:** Admin
Change the icon for the "Video" content type. Save. Verify Video badges across the platform use the new icon.

### 13.10 — Icons & Badges — category icon assignment
🟡 **Medium**
 **Role:** Admin
Change a category's icon or color from the Icons & Badges page. Save. Verify the category card on the home page and the category accordion on the dashboard reflect the new icon and color.

### 13.11 — IP Allowlist — restriction blocks non-listed IP
🔴 **Critical**
 **Role:** Admin
Enable IP restrictions. Add one IP to the allowlist that is NOT your current IP. Verify the site shows the "Access restricted" page with your IP address displayed. Add your IP. Verify access is restored within ~30 seconds.

### 13.12 — IP Allowlist — toggle disables all checks
🔴 **Critical**
 **Role:** Admin
Enable IP restrictions with a non-matching IP on the list. Verify you are blocked. Toggle restrictions OFF. Verify you can access the site immediately (within the ~30 second cache window).

### 13.13 — IP Allowlist — blocked page shows user's IP
🟡 **Medium**
 **Role:** Admin
While blocked, verify the blocked page displays the visitor's actual IP address. Verify it is not showing `0.0.0.0` or `null`.

---

## Section 14 — Multilingual (EN / ES)

### 14.1 — Language toggle persists across navigation
🟠 **High**
 **Role:** Regular User
Switch to Spanish. Navigate to the home page, then a category, then the dashboard. Verify all pages remain in Spanish throughout the session.

### 14.2 — Language toggle persists across sessions
🟡 **Medium**
 **Role:** Regular User
Switch to Spanish. Sign out. Close and reopen the browser. Navigate to the platform. Verify Spanish is still active (stored in localStorage).

### 14.3 — Language parameter in URL
🟡 **Medium**
 **Role:** Regular User
Navigate to `/?language=es`. Verify the UI switches to Spanish. Navigate to `/?language=en`. Verify it returns to English.

### 14.4 — Content item action badges are translated
🟠 **High**
 **Role:** Regular User
Switch to Spanish. On the category page, verify:
- "Acknowledge" → "Confirmar"
- "Acknowledged" → "Confirmado"
- "Mark as read" → "Marcar como leído"
- "Watched" → "Visto"
- "Listened" → "Escuchado"
- "Doesn't count toward your progress" → "No cuenta para tu progreso"

### 14.5 — Exempt item tooltip is translated
🟡 **Medium**
 **Role:** Regular User
Switch to Spanish. Hover the (ⓘ) icon on an exempt item. Verify the tooltip is in Spanish ("Este elemento es informativo y no cuenta para tu progreso").

### 14.6 — Category names and taglines display in Spanish
🟡 **Medium**
 **Role:** Regular User
Switch to Spanish. Verify that categories with Spanish translations show their translated names on the home page and the category page. Verify categories without Spanish translations still show English names (no blank/missing content).

### 14.7 — Content item titles and descriptions in Spanish
🟡 **Medium**
 **Role:** Regular User
Switch to Spanish for a category with translated items. Verify item titles and descriptions show Spanish text. Verify the fallback to English for items without translations.

### 14.8 — Duration strings are translated
🟡 **Medium**
 **Role:** Regular User
Switch to Spanish. Verify duration strings like "5 min read" become "5 min de lectura", "20 min watch" becomes "20 min de video", etc.

### 14.9 — Achievement toasts are in the user's language
🟡 **Medium**
 **Role:** Regular User
Switch to Spanish. Complete an item that unlocks an achievement. Verify the toast notification text is in Spanish.

### 14.10 — Dashboard and all tabs in Spanish
🟠 **High**
 **Role:** Regular User
Switch to Spanish. Navigate through all dashboard tabs. Verify no English text bleeds through in labels, headings, or button text that has a Spanish translation.

### 14.11 — Sign-up form and errors in Spanish
🟡 **Medium**
 **Role:** Signed Out
Switch to Spanish. Navigate to the sign-up page. Verify all labels, placeholders, and error messages are in Spanish.

---

## Section 15 — Analytics Data Integrity

### 15.1 — Session time is real (not estimated)
🟠 **High**
 **Role:** Regular User → Admin
Open an article item. Actively interact with the page (scroll, click) for exactly 2 minutes. Close the item. Pull the individual user report in admin. Verify the "Time on Item" for that article shows approximately 2 minutes — not 0 and not the admin-estimated duration from the duration field.

### 15.2 — Inactivity stops the timer
🟠 **High**
 **Role:** Regular User → Admin
Open an item. Do nothing for 90+ seconds (no scrolling, clicking, or typing). Then interact for 1 more minute. Close the item. Verify the session time recorded is ~1 minute — not 2.5 minutes.

### 15.3 — Completion rate calculation
🟡 **Medium**
 **Role:** Regular User → Admin
Open an item without completing it. Verify the item's "open count" increases in the analytics report. Complete the item. Verify the "complete count" increases and the completion rate (completions/opens × 100) is correct.

### 15.4 — Exempt items excluded from overall completion rate
🔴 **Critical**
 **Role:** Admin → Regular User
Verify that exempt items are not included in the overall completion rate calculation in the usage report. If you acknowledge an exempt item, verify the overall rate is unaffected.

### 15.5 — Bookmark and rating counts are accurate
🟡 **Medium**
 **Role:** Regular User → Admin
Bookmark an item as User A. Rate it as User B. Pull the usage report. Verify the item shows bookmark_count=1 and thumbs_up=1 (or thumbs_down depending on the rating given).

### 15.6 — Monthly summary counts match actual completions
🟡 **Medium**
 **Role:** Regular User → Admin
Note current month completions from the admin report. Compare to what the user sees on their dashboard monthly summary card. Verify the numbers match.

### 15.7 — Exempt items excluded from monthly summary
🔴 **Critical**
 **Role:** Regular User
Note the monthly summary item count. Acknowledge an exempt item. Verify the monthly summary count does NOT increase.

### 15.8 — Achievements check after exempt item — not triggered
🔴 **Critical**
 **Role:** Regular User
Use a fresh account. Acknowledge an exempt item as the only action. Verify the "First Resource" achievement does NOT fire.

### 15.9 — Progress ring excludes exempt items from denominator
🔴 **Critical**
 **Role:** Regular User
In a category with 10 items (2 exempt), complete 4 trackable items. Verify the ring shows 4/8 = 50% — not 4/10 = 40%.

---

## Section 16 — Mobile & Responsive

### 16.1 — Navigation menu collapses on mobile
🟡 **Medium**
 **Role:** Regular User
On a narrow screen (<768px width), verify the nav links collapse into a hamburger button. Tap the button. Verify the mobile menu opens with all links. Tap a link. Verify the menu closes.

### 16.2 — On-screen keyboard appears on mobile sign-up
🟡 **Medium**
 **Role:** Signed Out
On a touch device (or browser emulation with coarse pointer), open the sign-up page. Tap a text field. Verify the custom on-screen keyboard appears at the bottom of the screen. Verify the native keyboard does NOT appear. Verify typing on the on-screen keyboard inputs text correctly.

### 16.3 — On-screen keyboard — Shift key works
🟡 **Medium**
 **Role:** Signed Out
On the on-screen keyboard, tap Shift. Verify the key highlights. Tap a letter. Verify it is capitalized. Verify Shift auto-releases after one character.

### 16.4 — On-screen keyboard — Enter submits form
🟡 **Medium**
 **Role:** Signed Out
Fill in all sign-up fields using the on-screen keyboard. Tap Enter. Verify the form submits.

### 16.5 — On-screen keyboard — dismiss button
🟡 **Medium**
 **Role:** Signed Out
Tap the X button in the top-right of the on-screen keyboard. Verify the keyboard hides. Tap a field again. Verify the keyboard reappears.

### 16.6 — Home page grid is responsive
🟡 **Medium**
 **Role:** Regular User
Resize the browser from desktop to mobile. Verify the category grid reflows: 4 columns → 3 → 2 → 1 column. Verify no cards are cut off or overflow horizontally.

### 16.7 — Admin panel is usable on tablet
🟡 **Medium**
 **Role:** Admin
On a tablet-sized screen, verify the admin category list, user list, and analytics page are usable without horizontal scrolling (or scroll gracefully where appropriate).

### 16.8 — PDF viewer fits screen
🟡 **Medium**
 **Role:** Regular User
Open a PDF on a mobile screen. Verify the PDF viewer fills the available width without the content overflowing or requiring horizontal scroll. Verify page navigation controls are tappable.

### 16.9 — Category accordion items are tappable
🟡 **Medium**
 **Role:** Regular User
On mobile, expand a category accordion on the dashboard. Verify each item's action badge and bookmark/rating controls are large enough to tap accurately without accidentally triggering adjacent elements.

### 16.10 — Dashboard tab nav: overflow to "More" dropdown
🟡 **Medium**
 **Role:** Regular User
Resize the browser to a narrow width (below ~500px) so all dashboard tabs cannot fit in one row. Verify a "More" button appears at the end of the tab row. Tap "More". Verify the overflow tabs appear in a dropdown. Select a tab from the dropdown. Verify the correct content loads and the active tab is always visible in the primary row (it swaps into view automatically).

✅ Pass: Tabs that don't fit are hidden behind "More". Selecting from the dropdown navigates to that tab. The active tab is always visible in the primary row, never hidden in the dropdown.

### 16.11 — Dashboard tab icons visible at all sizes
🟢 **Low**
 **Role:** Regular User
At all screen sizes, verify each dashboard tab shows an icon alongside its label: My Progress (book), Saved (bookmark), Achievements (trophy), My Account (user), Testing (clipboard, testers only).

✅ Pass: Icons appear at both desktop and mobile widths. In the "More" dropdown, the label text is legible.

### 16.12 — Category accordion header: responsive badge layout
🟡 **Medium**
 **Role:** Regular User
On a desktop-width screen (≥640px), expand the dashboard category list. Verify the "New content added" badge sits inline to the right of the category name. Verify the completion count and time pills are horizontally connected (sharing a border, correct rounded corners on each end). Resize to mobile (<640px). Verify all three badge groups (completion count, time spent, New content) stack vertically on the right side of the accordion header.

✅ Pass: Large screens: New badge is inline with title; completion + time are connected pills. Small screens: all three badges stack vertically on the right; each pill has full rounded corners.

### 16.13 — Category page: action badges don't collide with type badge
🟡 **Medium**
 **Role:** Regular User
On a phone-width screen (375px), open any category page. Scroll through the content list. Verify that for each item, the action badge (read/watched/progress), bookmark button, and ratings buttons do not overlap with the type badge ("Video", "PDF", etc.) or the duration text.

✅ Pass: Type badge and duration sit in their own left column. Action/bookmark/rating controls sit in a separate right column. No overlap occurs at any screen width.

### 16.14 — Dashboard content list: action badges don't collide with type badge
🟡 **Medium**
 **Role:** Regular User
On a phone-width screen, open the dashboard and expand a category accordion. Verify the type badge and duration text do not overlap with the read/bookmark/rating badges for each item.

✅ Pass: The type badge area takes only the space it needs on the left. The action badges sit flush to the right. Neither side overflows into the other.

### 16.15 — QA filter dropdowns appear on narrow admin/tester screens
🟡 **Medium**
 **Role:** Admin, Regular User (Tester)
Resize the browser to below 1024px wide. Navigate to the admin Test Results detail view (or the tester dashboard Testing tab). Verify the status and priority filter pills are replaced by two dropdown menus. Select "Failed" from the status dropdown. Verify only failed tests are shown. Switch back to "All statuses". Verify all tests return.

✅ Pass: Below 1024px, two Select dropdowns replace the connected pill rows. Filtering via dropdown works identically to the pill buttons.

### 16.16 — Role Switcher always visible above footer
🟢 **Low**
 **Role:** Regular User (Tester)
Sign in as a tester. Scroll to the very bottom of any page so the footer is visible. Verify the Role Switcher button in the bottom-left corner is fully visible and not obscured by the footer text.

✅ Pass: The Role Switcher button has a solid background and appears above the footer content. No footer text bleeds through the button.

---

## Section 17 — Security & Edge Cases

### 17.1 — SQL injection in search
🔴 **Critical**
 **Role:** Admin
In the admin user search or the public content search, enter SQL injection strings (e.g., `'; DROP TABLE users; --`, `' OR 1=1 --`). Verify no errors are thrown, no data is leaked, and the database is not affected. Supabase parameterizes queries — verify these inputs are treated as literal text.

### 17.2 — XSS in user-generated content
🔴 **Critical**
 **Role:** Admin → Regular User
In the admin content editor, enter `<script>alert('xss')</script>` in a title or description field. Save. Visit the category page as a user. Verify the script does NOT execute — the text is rendered as escaped HTML, not injected markup.

### 17.3 — PostgREST injection via filter values
🔴 **Critical**
 **Role:** Admin
In any API call that accepts user-supplied values (e.g., the `search` field in user management), attempt to inject PostgREST filter operators (e.g., `ilike.%admin%`). Verify the input is sanitized before embedding in the query (the server strips non-alphanumeric characters from the search term).

### 17.4 — Session expiry
🟠 **High**
 **Role:** Regular User
Sign in. Wait for the Supabase session token to expire (or manually clear the access token from localStorage). Attempt to perform an authenticated action (mark an item read, access the dashboard). Verify the user is prompted to sign in again rather than seeing a cryptic error.

### 17.5 — Server function called without auth header
🔴 **Critical**
 **Role:** Signed Out
Call a protected server function (e.g., `getMyProfile`) without an Authorization header. Verify the function returns a 401 or equivalent rejection — not data.

### 17.6 — Server function called with invalid token
🔴 **Critical**
 **Role:** Signed Out
Call a protected server function with a malformed or expired bearer token. Verify the function rejects the request with "Unauthorized: Invalid token" — not a 500 error and not data.

### 17.7 — Security headers present on responses
🟠 **High**
 **Role:** Signed Out
Open browser devtools → Network. Inspect any page response. Verify these headers are present:
- `strict-transport-security`
- `x-content-type-options: nosniff`
- `referrer-policy: strict-origin-when-cross-origin`
- `content-security-policy` (should restrict sources)

### 17.8 — RLS prevents cross-user data access
🔴 **Critical**
 **Role:** Regular User
As regular User A, attempt to query `user_content_progress` directly via the Supabase JS client (from the browser console: `supabase.from("user_content_progress").select("*")`). Verify only User A's own progress rows are returned — not other users' data.

### 17.9 — Draft category is not accessible via direct URL
🟠 **High**
 **Role:** Admin → Regular User
Unpublish a category. As a regular user, navigate directly to `/category/[the-draft-slug]`. Verify a 404 page is shown — not the category content.

### 17.10 — Draft item is not returned in category query
🟠 **High**
 **Role:** Admin → Regular User
Unpublish a content item. As a user, navigate to the category. Verify the draft item does not appear. Verify it cannot be accessed by guessing a URL.

### 17.11 — Facility-restricted item not accessible to wrong facility via URL manipulation
🔴 **Critical**
 **Role:** Admin → Regular User
Restrict Item X to Facility B. Sign in as Facility A. Try to access Item X by constructing a direct API call or manipulating the category page query. Verify the item is not returned — RLS or server-side facility checks prevent access.

### 17.12 — Rate limiting on log-error endpoint
🟡 **Medium**
 **Role:** Signed Out
Submit 101 POST requests to `/api/public/log-error` from the same IP within one hour. Verify the 101st request returns 204 (silently dropped) — not an error that reveals the limit, and not data written to the database.

### 17.13 — Log-error always returns 204
🟡 **Medium**
 **Role:** Signed Out
POST invalid JSON to `/api/public/log-error`. Verify the response is 204 — not a 400 or 422 that leaks validation details.

### 17.14 — Audit log is append-only
🟠 **High**
 **Role:** Admin
Verify there is no admin UI to delete individual audit log entries. Verify the Supabase RLS for `admin_audit_log` does not allow user-initiated deletes. The only supported operations on audit data are reading and bulk-clearing errors (not audit entries).

### 17.15 — Bookmark toggle is idempotent
🟡 **Medium**
 **Role:** Regular User
Rapidly double-tap the bookmark icon. Verify the item ends in a consistent state (either bookmarked or not). Verify no duplicate database entries are created. Verify no error toast appears.

### 17.16 — Concurrent rating change
🟡 **Medium**
 **Role:** Regular User
Rate an item as Helpful. Immediately rate it as Not Helpful (simulating rapid UI interaction). Verify the final state is "Not Helpful" — not an error state or a corrupted value.

### 17.17 — Category page with 0 published items
🟡 **Medium**
 **Role:** Admin → Regular User
Navigate to a published category that has no published content items. Verify a "No content yet — check back soon" empty state is shown rather than a blank or broken page.

### 17.18 — 404 page preserves facility URL context
🟡 **Medium**
 **Role:** Regular User
From `/?site=siteId`, navigate to a non-existent page. Verify the 404 page's "Go home" link includes `?site=siteId` — the facility context is preserved.

---

## Section 18 — Performance & Stability

### 18.1 — First page load time
🟡 **Medium**
 **Role:** Signed Out
On a fresh browser (no cache), load the main page. Verify it renders within a reasonable time (<3 seconds on a standard connection). Verify no console errors appear on first load.

### 18.2 — PDF viewer lazy loading
🟡 **Medium**
 **Role:** Regular User
Load the category page. Open browser devtools → Network. Verify the pdfjs-dist worker bundle is NOT loaded until a PDF item is opened. Open a PDF. Verify the worker loads only at that point.

### 18.3 — Large category with many items
🟡 **Medium**
 **Role:** Regular User
Navigate to a category with 20+ items. Verify the page renders all items without error. Verify scrolling is smooth. Verify the type filter works with many items.

### 18.4 — Admin category list with many categories
🟡 **Medium**
 **Role:** Admin
If the platform has 15+ categories, verify the admin list renders all of them without performance degradation. Verify drag-and-drop still works.

### 18.5 — Analytics report with large dataset
🟡 **Medium**
 **Role:** Admin
With 100+ users and 1000+ completions in the data, load the analytics Overall tab. Verify the report loads within a reasonable time. Verify no timeout errors. Verify CSV export completes for a facility with many users.

### 18.6 — Bulk facility progress export completeness
🟠 **High**
 **Role:** Admin
Export the bulk progress CSV for a facility. Open it in a spreadsheet app. Verify the row count equals (number of users) × (number of published items visible to that facility). Verify no rows are missing or truncated.

---

## Section 19 — QA Testing Interface (Tester Dashboard)

### 19.1 — Tester sign-in lands on regular dashboard with Testing tab
🔴 **Critical**
 **Role:** Regular User
Sign in as a tester account. Verify the regular user dashboard loads (progress ring, stat cards, category accordion). Verify a "Testing" tab appears alongside the standard dashboard tabs (My Progress, Saved, Achievements, My Account). Click the Testing tab and verify it shows "QA Test Runs" with a "New run" button. Verify the Role Switcher floating button is visible in the bottom-left corner.

### 19.2 — Create a new test run
🔴 **Critical**
 **Role:** Regular User
Click "New run." Type a label (e.g. "Smoke test June 3"). Press Enter or click Create. Verify the run list view is replaced with the active run view showing the label, "In progress" status, a progress ring at 0%, and 0 tests actioned. All 18+ section accordions are visible collapsed.

### 19.3 — Section accordion expands and shows all tests
🟠 **High**
 **Role:** Regular User
Click on any section accordion. Verify it expands to show all tests in that section, each showing its ID, a connected badge pill (priority badge + role badge(s)), title, description, status buttons (Pass/Fail/Blocked/Skipped/Untested), a notes field, and an "Attach screenshot" button.

### 19.4 — Set a test status — Pass
🔴 **Critical**
 **Role:** Regular User
Click the "Pass" status button on any test. Verify: the Pass button highlights in green; the status icon changes to a filled checkmark; the section's progress ring and the overall progress ring both update.

### 19.5 — Set a test status — Fail
🔴 **Critical**
 **Role:** Regular User
Click the "Fail" status button on a test. Verify: the Fail button highlights in red; the test row gets a red tint; the test immediately appears in the failures panel at the top of the run view.

### 19.6 — Failures panel appears and lists all failures
🟠 **High**
 **Role:** Regular User
Mark 3 different tests as Fail across different sections. Verify a red "N failures require attention" panel appears at the top of the active run view listing all 3 failed tests by ID, title, and any notes.

### 19.7 — Add notes to a test
🟠 **High**
 **Role:** Regular User
Open a test item. Click "Add note." Verify the notes textarea appears. Verify the "Save note" button is dimmed and non-interactive before any text is entered. Type a note — verify the button becomes active. Click "Save note." Verify it shows "Saved ✓." Reload the page, reopen the same test, and verify the note is still there.

✅ Pass: Save note button is disabled (dimmed, cursor blocked) when the textarea is empty; becomes clickable once text is present; shows "Saved ✓" after saving; note persists after reload.

### 19.8 — Attach a screenshot to a failed test
🟠 **High**
 **Role:** Regular User
Mark a test as Fail. Click "Attach screenshot." Select a PNG or JPG image. Verify a spinner appears briefly, then the button is replaced by a "View screenshot" link. Verify the link opens the image in a new tab. Verify the link persists after a page reload.

### 19.9 — Remove an attached screenshot
🟡 **Medium**
 **Role:** Regular User
After attaching a screenshot, click the × button next to the "View screenshot" link. Verify the link disappears and the "Attach screenshot" button returns. Reload and confirm the screenshot is gone.

### 19.10 — Status filter shows only matching tests
🟠 **High**
 **Role:** Regular User
Mark several tests as Pass and several as Fail. Click the "Fail" filter button. Verify only Fail-status tests are shown across all sections. Sections with no failures are hidden entirely. Switching to "Pass" shows only passed tests.

### 19.11 — Priority filter shows only matching tests
🟡 **Medium**
 **Role:** Regular User
Click the "Critical" priority filter. Verify only Critical-priority tests are shown across all sections. Switching back to "All priorities" restores all tests.

### 19.12 — Mark run complete — locks editing
🟠 **High**
 **Role:** Regular User
Click the "Mark complete" button. Verify: the button changes to "Reopen"; all status buttons disappear; notes fields become read-only; the "Attach screenshot" button disappears; run status shows "Completed."

### 19.13 — Reopen a completed run
🟡 **Medium**
 **Role:** Regular User
On a completed run, click "Reopen." Verify the status changes back to "In progress" and all editing controls (status buttons, notes, screenshot button) reappear.

### 19.14 — Multiple runs are independent
🟡 **Medium**
 **Role:** Regular User
Create two runs. In Run A, mark test 1.1 as Pass. In Run B, mark test 1.1 as Fail. Switch between runs and verify each shows its own independent results.

### 19.15 — Delete a test run
🟡 **Medium**
 **Role:** Regular User
From the run list, click the trash icon on a run. Verify it disappears from the list and does not appear on the admin Test Results page.

### 19.16 — Progress ring and stats update in real time
🟠 **High**
 **Role:** Regular User
Mark 5 tests as Pass and 2 as Fail. Verify the overall progress ring, the actioned count, and the status breakdown (passed/failed/blocked/skipped/untested) all update after each change.

### 19.17 — Section progress ring shows correct completion
🟡 **Medium**
 **Role:** Regular User
In a section with 10 tests, mark 3 as Pass and 2 as Fail. Verify the section ring shows 50% (5 of 10 actioned, regardless of pass/fail).

### 19.18 — Results persist across page reloads
🔴 **Critical**
 **Role:** Regular User
Set statuses, notes, and a screenshot on several tests. Close the browser tab entirely. Reopen the app and sign back in. Navigate back to the run. Verify all statuses, notes, and screenshot links are intact.

---

## Section 20 — Admin Test Results Page

### 20.1 — Test Results page is admin-only
🔴 **Critical**
 **Role:** Contributor + Facility User
Sign in as a contributor, then as a Facility User. For each, navigate directly to /admin/test-results. Verify both are redirected away — neither sees any test run data.

### 20.2 — All tester runs appear in the run list
🟠 **High**
 **Role:** Admin
Sign in as admin. Navigate to Admin → Test Results. Verify all runs from all tester accounts appear in the table with: run label, tester username, date, in-progress/completed status badge, progress bar, and pass/fail/blocked counts. Runs should be ordered newest first.

### 20.3 — Clicking a run opens the detail view
🟠 **High**
 **Role:** Admin
Click on any run row in the table. Verify the run list is replaced by the detail view showing a "Back to all runs" button, the run label, tester username, date, the failures panel (if applicable), and all 18+ section accordions.

### 20.4 — Section accordion shows correct test results
🟠 **High**
 **Role:** Admin
Expand a section that has a mix of passed, failed, and untested tests. Verify each test row shows the correct status icon, test ID, a connected badge pill (priority → status → role badge(s)), title, description, and any tester notes displayed in a bordered input-style box. The section header shows correct pass ✓ and fail ✗ counts.

### 20.5 — Screenshot link is visible in admin detail view
🔴 **Critical**
 **Role:** Admin
Find a test where the tester attached a screenshot (from 19.8). Expand that section in the admin detail view. Verify a "View screenshot" link with an external link icon appears below the test's notes. Clicking it opens the image in a new tab.

### 20.6 — Screenshots appear in the failures panel
🟠 **High**
 **Role:** Admin
In the admin detail view for a run with failed tests that have screenshots, look at the red failures panel at the top. Verify each failed test in the panel shows its notes AND a "View screenshot" link that opens the correct image.

### 20.7 — Failures panel is absent when no failures
🟠 **High**
 **Role:** Admin
Open the admin detail view for a run where all actioned tests are Pass, Blocked, or Skipped — none are Fail. Verify the red failures panel does not appear at all.

### 20.8 — Status filter in admin detail view
🟡 **Medium**
 **Role:** Admin
In the admin detail view, click the "Fail" filter button. Verify only failed tests are shown across all sections. Sections with no failures are hidden. Clicking "All tests" restores all sections.

### 20.9 — Back navigation returns to run list
🟡 **Medium**
 **Role:** Admin
From the admin detail view, click "Back to all runs." Verify the run list table reappears with all runs and no page reload occurred.

### 20.10 — Completed runs appear correctly in the list
🟡 **Medium**
 **Role:** Admin
Ensure at least one run has been marked complete by a tester. Verify it shows a "Completed" badge (not "In progress") in the Status column of the admin run list.

### 20.11 — Multiple testers' runs are all shown
🟠 **High**
 **Role:** Admin
With runs from two different tester accounts, navigate to the admin Test Results page. Verify runs from both testers appear, each showing the correct tester username.

### 20.12 — Progress bar reflects actioned test count
🟡 **Medium**
 **Role:** Admin
On a run where 50 tests have been actioned, check the progress bar in the admin run list. Verify it is approximately 20% filled and the text shows the correct fraction. The admin detail view's overall summary ring confirms the same count.

---

---

## Section 21 — Tester Role Switcher

### 21.1 — Role Switcher visible only to testers
🔴 **Critical**
 **Role:** Regular User
Sign in as a tester account. Verify a floating button labeled with a flask icon and the current role appears in the bottom-left corner on every page (main site and admin). Sign in as a regular user, admin, or contributor — verify the switcher does NOT appear.

✅ Pass: Role Switcher is visible for tester accounts on all pages. It does not appear for any other account type.

### 21.2 — Switching to Regular User role
🟠 **High**
 **Role:** Regular User
As a tester with the Role Switcher showing, select "Regular User." Verify the page navigates to `/dashboard` and shows the standard user dashboard (progress ring, stat cards, category accordion, Testing tab). Verify no admin navigation is shown. Note: testers always see the regular user dashboard by default — this simulation simply makes it explicit.

✅ Pass: Regular user dashboard is shown with the Testing tab visible. Admin panel links are not visible.

### 21.3 — Switching to Admin role
🟠 **High**
 **Role:** Admin
As a tester, select "Admin" in the Role Switcher. Verify the page navigates to `/admin` and the full admin navigation is shown (Categories, Users, Analytics, Facilities, Icons & Badges, Audit Log, Errors, IP Allowlist, Seed, Certificate). Verify admin-only actions (delete user, create facility, etc.) are accessible.

✅ Pass: Full admin panel is shown with all admin-only pages accessible.

### 21.4 — Switching to Contributor role
🟠 **High**
 **Role:** Contributor
As a tester, select "Contributor" in the Role Switcher. Verify the page navigates to `/admin` and only content-editing pages are shown in the nav (Categories, Privacy, Terms). Verify analytics, users, and other admin-only pages are not accessible.

✅ Pass: Admin panel shows only contributor-accessible pages.

### 21.5 — Switching to Facility User role
🟠 **High**
 **Role:** Facility User
As a tester, select "Facility User" in the Role Switcher. Verify the page navigates to `/admin/users` (facility users land on users, not categories). Verify the analytics and users pages show data scoped to the CPC Sales facility. Verify admin-only pages (Categories, Icons & Badges, etc.) are not accessible.

✅ Pass: Admin panel shows only facility-user-accessible pages. Data is scoped to CPC Sales.

### 21.6 — Simulated role persists across page refreshes
🟡 **Medium**
 **Role:** Admin
Switch to any role other than Regular User. Hard-refresh the page (Cmd+Shift+R). Verify the same role is still active after the reload and the appropriate view is shown.

✅ Pass: The simulated role is preserved in localStorage and restored correctly after a full page reload.

### 21.7 — Upgrade to full role set button
🟠 **High**
 **Role:** Admin
Sign in as admin. Navigate to Admin → Users → Test Users section. For an existing tester account that was created before the role switcher feature, click the wrench icon (Upgrade to full role set). Confirm the dialog explaining the action. Verify a success toast appears. Sign in as that tester and verify the Role Switcher now works for all four role simulations.

✅ Pass: Upgrade grants all five roles and sets the facility to CPC Sales. Role Switcher functions correctly for all simulations after upgrade.

### 21.8 — Tester analytics exclusion (tracking off) holds across all simulated roles
🔴 **Critical**
 **Role:** Admin → Facility User
With analytics tracking OFF (is_synthetic=true, the default): As a tester, simulate Admin role. Complete several items. Check Admin → Analytics Overall tab — verify the tester's completions do not appear. Check the CPC Sales facility report — verify no tester data appears there either. Repeat for Facility User simulation.

Then enable analytics tracking via the Role Switcher toggle (is_synthetic=false). Complete a few items. Verify the activity NOW appears in the CPC Sales facility report (by design, for QA testing), but does NOT appear in the Overall tab.

✅ Pass: With tracking off, tester activity is absent from all analytics. With tracking on, tester activity appears in the CPC Sales facility report only — never in the Overall tab.

---

## Section 22 — Idle Detection & "Are You Still Here?" Prompt

### 22.1 — Idle prompt appears for static content
🟠 **High**
 **Role:** Regular User
Sign in as a regular user (or tester simulating Regular User). Open a PDF, article, or worksheet item. Set it down and do not scroll, click, or type for 90+ seconds. Verify a centered modal appears over the content with a dimmed background, the text "Are you still here?", a countdown timer, and a "Yes, I'm still here" button.

✅ Pass: Modal appears after ~90 seconds of inactivity on static content. Background is dimmed. Countdown from 20 seconds is visible.

### 22.2 — Confirming presence resumes the timer
🟠 **High**
 **Role:** Regular User
When the idle modal appears, tap "Yes, I'm still here" before the countdown reaches zero. Verify the modal dismisses and the session timer resumes.

✅ Pass: Tapping the button dismisses the modal and the timer resumes. The content item dialog stays open.

### 22.3 — Ignoring the prompt pauses time tracking
🟠 **High**
 **Role:** Regular User
When the idle prompt appears, do nothing for 20 seconds. Verify the modal auto-dismisses. Verify the session timer remains paused until the next real scroll or click.

✅ Pass: Modal auto-dismisses after 20 seconds. Timer stays paused. No session time is recorded during the idle window.

### 22.4 — Progressive idle threshold extends after each confirmation
🟡 **Medium**
 **Role:** Regular User
Open a static content item. Go idle to trigger the first prompt (90s). Confirm presence. Go idle again — verify the second prompt appears after ~3 minutes (not 90 seconds). Confirm again. Verify the third prompt appears after ~5 minutes. All subsequent prompts should remain at 5 minutes.

✅ Pass: Idle threshold progresses 90s → 3min → 5min (capped). Each confirmation extends the next window.

### 22.5 — Video and audio items do not show the idle prompt
🟡 **Medium**
 **Role:** Regular User
Open a video or audio content item. Leave it playing without interacting for 90+ seconds. Verify no idle prompt appears. Verify the media playback position continues advancing and is saved correctly.

✅ Pass: Idle prompt is not shown for video or audio items. Media position tracking is unaffected by the idle threshold.

### 22.6 — Engagement debug panel visible only to testers
🟡 **Medium**
 **Role:** Regular User, Tester

**Part A (regular user):** Sign in as a regular user. Open any PDF or article item. Verify no debug overlay appears in the top-right corner. Open DevTools → Elements and search for "Engagement Debug" — confirm the element is absent from the DOM entirely.

**Part B (tester):** Sign in as a tester. Open any PDF or article item. Verify the "⏱ Engagement Debug" overlay appears in the top-right corner. Verify it shows idle time countdown, hook active status, base/session/total seconds, and (for media items) media position and percentage.

✅ Pass: The debug overlay is absent for regular users and all other non-tester account types. It is visible and functional for tester accounts only. No debug timer runs in the browser for non-tester accounts.

---

## Section 23 — Security Hardening Verification

These tests verify the pre-launch audit fixes from the `ca5eccc` commit. Run them once after applying the `20260609000001_atomic_signup_challenge_rate_limit.sql` migration.

### 23.1 — Open redirect is blocked on post-login redirect
🟠 **High**
 **Role:** Signed Out
Navigate to `/signup?redirect=https://evil.com`. Sign in with valid credentials. Verify you land on `/dashboard` (or the role-appropriate default), **not** `https://evil.com`. Repeat with `/signup?redirect=//evil.com` — same result. Then test `/signup?redirect=/admin` — verify you **do** navigate to `/admin` (valid relative paths must still work).

✅ Pass: External URLs in the redirect param are silently ignored. Same-origin relative paths beginning with `/` still work as expected.

### 23.2 — Signup challenge rate limiter is enforced
🟠 **High**
 **Role:** Signed Out
Open the sign-up page. In browser DevTools → Network, watch for the challenge request. Rapidly refresh the page (or call the challenge endpoint directly) more than 10 times within one minute from the same IP. Verify the 11th request returns a "Too many requests" error.

✅ Pass: After 10 challenge requests in 60 seconds, the endpoint returns an error message. Earlier requests succeed normally. The limit resets after 60 seconds.

### 23.3 — Math captcha answer space is 1–100
🟢 **Low**
 **Role:** Signed Out
Open the sign-up page. Inspect the challenge response in DevTools → Network (the GET challenge request). Verify that the `a` and `b` values are in the range 1–100 (not 1–9). Reload several times and confirm the range is consistently 1–100. Entering the correct sum (a + b) still passes. Entering a wrong answer still shows "Captcha failed."

✅ Pass: Both challenge numbers are between 1 and 100 inclusive. Correct answers are accepted; wrong answers are rejected.

### 23.4 — Duplicate PIN is rejected at the server
🟠 **High**
 **Role:** Signed Out
This test requires two browser tabs or two devices. Both must use the same valid `?site=` and `?user=PIN` URL simultaneously. Start the sign-up form in both tabs at the same time and submit within seconds of each other (same facility, same PIN, different usernames). Verify that only one account is created — the second receives an error ("That PIN is already registered at this facility").

✅ Pass: Only one account is created for the shared PIN. The second submission receives a clear error. No orphaned accounts appear in the admin Users page.

### 23.5 — PDF duration estimator rejects non-storage URLs
🟠 **High**
 **Role:** Admin
Sign in as admin. Open a content item editor and upload any PDF to trigger the duration estimator. Then, using the browser DevTools console, manually call the estimatePdfDuration server function with a non-Supabase URL:
```js
// Open any category editor page first, then paste in console:
fetch('/_server/estimatePdfDuration', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
  body: JSON.stringify({ url: 'https://google.com/test.pdf' })
}).then(r => r.text()).then(console.log)
```
Verify the response is an error ("PDF URL must point to this project's storage"), not a successful fetch. Also try `http://169.254.169.254/` — verify it fails with "Only HTTPS URLs are supported."

✅ Pass: Non-Supabase HTTPS URLs and any HTTP URLs are rejected with a clear error. The real Supabase storage URL (from an actual upload) still works and returns a duration.

### 23.6 — `unsafe-eval` is absent from Content-Security-Policy
🟠 **High**
 **Role:** Signed Out
Load any page. Open DevTools → Network → click the document response → Headers tab. Find the `content-security-policy` header. Verify that `unsafe-eval` does **not** appear in the `script-src` directive. Verify the app still works: charts render, toasts appear, forms submit normally.

✅ Pass: `unsafe-eval` is not in `script-src`. All UI functionality works without it.

### 23.7 — Security answer update preserves existing answers on failure
🟡 **Medium**
 **Role:** Regular User
Sign in and navigate to Dashboard → My Account. Note which two security questions are currently set. Update the security questions to two different questions with valid answers. Verify the update succeeds and the new questions are reflected. Then verify (by attempting a password reset) that the new answers work.

For the failure scenario: this requires temporarily causing a DB error on the insert. Skip if not testable in production. The key invariant is: if the insert of new answers fails for any reason, the old answers must still be present and functional.

✅ Pass: On success, new questions/answers are saved and old ones removed. Old answers are not accessible after a successful update.

### 23.8 — X-Frame-Options header is present
🟢 **Low**
 **Role:** Signed Out
Load any page. Open DevTools → Network → click the document response → Headers tab. Verify that the `x-frame-options` header is present with the value `SAMEORIGIN`. Verify that `frame-ancestors 'self'` also appears in the `content-security-policy` header (belt-and-suspenders protection).

✅ Pass: Both `x-frame-options: SAMEORIGIN` and `frame-ancestors 'self'` are present in every page response.

---

## Section 24 — Post-Launch Audit Fixes

These tests verify the "Recommended Fixes After Launch" items from the security audit.

### 24.1 — TESTER_FACILITY is env-var-driven
🟢 **Low**
 **Role:** Admin

In the Render dashboard (or `.env` locally), verify `TESTER_FACILITY` is set. Create a new tester account via Admin → Users → Add Tester. Sign in as that tester and simulate Facility User role via the Role Switcher. Check that the facility shown is the one matching `TESTER_FACILITY`.

✅ Pass: The tester's facility matches the env var value (default `s003007001` / CPC Sales). Changing the env var and redeploying uses the new value without a code change.

---

### 24.2 — Facility user creation rolls back on failure
🟡 **Medium**
 **Role:** Admin

This test requires a way to trigger a profile-insert failure (e.g., temporarily break the `user_profiles` table constraint in a staging environment, or review the rollback code path directly). Verify that if the `user_profiles` insert fails after the auth user is created, the auth user is deleted rather than left as a zombie account.

✅ Pass: No orphaned auth users exist in Supabase Auth after a failed `createFacilityUser` call. The error is surfaced to the admin UI.

---

### 24.3 — IP allowlist serves stale cache on DB error
🟡 **Medium**
 **Role:** Signed Out

With a valid session established (server has cached the allowlist), temporarily revoke or rotate `SUPABASE_SERVICE_ROLE_KEY` to simulate a DB fetch failure. Send a request to the server. Verify the server logs show "Using stale cache after fetch error" and that the request is handled using the previously cached allowlist (not blocked with an empty allowlist error).

✅ Pass: Server continues to serve requests using stale IP allowlist data during a DB outage. First-startup with no cache and no DB still fails closed.

---

### 24.4 — Tester role simulation works across all admin actions
🟡 **Medium**
 **Role:** Tester

Sign in as a tester. Use the Role Switcher to simulate Facility User. Navigate to Admin → Users (facility-scoped view). Verify no PGRST116 error occurs. Open a PDF item as Regular User. Verify engagement tracking works normally. Use the Role Switcher to switch back to Admin — verify the full admin panel loads.

✅ Pass: No "multiple rows returned" errors for tester accounts in any role simulation. All four role simulations (Regular User, Admin, Contributor, Facility User) work without errors.

---

### 24.5 — sessionProgress Map does not grow unboundedly
🟢 **Low**
 **Role:** Regular User

Open a large number of different content items in one session (or verify in code that `SESSION_PROGRESS_MAX = 500`). Confirm that opening the 501st unique item evicts the oldest entry rather than growing the map indefinitely.

✅ Pass: Map size stays at or below 500 entries. No memory growth observed in long sessions with many items.

---

### 24.6 — Generic rate limiter removed (dead code)
🟢 **Low**
 **Role:** Admin

Verify that `src/lib/rate-limit.server.ts` no longer exists in the codebase. Verify that the signup challenge and password reset paths still use their advisory-lock RPCs (`check_and_record_signup_challenge_attempt` and `check_and_record_reset_attempt`).

✅ Pass: `rate-limit.server.ts` is absent. Rate limiting on both signup challenge and password reset continues to function correctly via Postgres advisory-lock RPCs.

---

## Section 25 — Security Audit Fixes (Pre-Launch)

These tests cover the four high/medium severity findings fixed before launch.
**Before running:** apply both SQL migrations in Supabase dashboard → SQL editor:
- `20260610000001_inmate_pin_hmac.sql`
- `20260610000002_atomic_question_probe_rate_limit.sql`
Then run `node migrate-pin-hashes.mjs` to back-fill HMACs for existing records.

### 25.1 — New sign-ups store HMAC for inmate PIN
🔴 **High**
 **Role:** Signed Out

Create a new user account via the sign-up flow with a known inmate PIN. In Supabase Table Editor → `user_profiles`, find the new row. Verify `inmate_pin_hmac` is populated (a 64-character hex string). Verify the sign-in and password-reset flows still work for that user.

✅ Pass: `inmate_pin_hmac` is set for all new sign-ups. Inmate PIN comparison in the password-reset flow uses the HMAC. The plaintext `inmate_pin` column is retained during the migration window and cleared after `migrate-pin-hashes.mjs` runs.

---

### 25.2 — PIN is excluded from user's own profile response
🔴 **High**
 **Role:** Regular User

Sign in as a regular user. Open browser DevTools → Network. Find the `getMyProfile` server function call. Inspect the response JSON. Verify `inmate_pin` is NOT present in the profile object returned.

✅ Pass: The `getMyProfile` response contains `username`, `facility`, `first_name`, `last_name`, `created_at`, and `email` — no `inmate_pin` field.

---

### 25.3 — Storage path traversal is blocked
🔴 **High**
 **Role:** Admin

Sign in as admin. Open browser DevTools → Console. Call the upload URL endpoint with a traversal path:
```js
fetch("/_server/getSignedUploadUrl", {
  method: "POST",
  headers: { "content-type": "application/json", "Authorization": "Bearer YOUR_TOKEN" },
  body: JSON.stringify({ path: "../../secret.pdf" })
}).then(r => r.text()).then(console.log)
```
Verify the response contains an error about path traversal or invalid prefix.

Also try `path: "other-prefix/file.pdf"` (missing `uploads/` prefix) and verify it is rejected.

✅ Pass: Paths containing `..` segments or missing the `uploads/` prefix return an error. Paths like `uploads/valid-file.pdf` succeed.

---

### 25.4 — Question-probe rate limit is race-safe
🟡 **Medium**
 **Role:** Signed Out

Review `src/lib/password-reset.functions.ts` to confirm `getResetQuestions` calls `check_and_record_question_probe` RPC (not the racy count-then-check pattern). Verify the RPC exists in Supabase → Database → Functions.

Functional test: Enter a non-existent username on the "Forgot password?" form more than 30 times within an hour from the same IP. Verify the 31st attempt returns "Too many requests."

✅ Pass: The RPC is used (advisory lock prevents race). The rate limit fires correctly after 30 probes.

---

### 25.5 — Trusted IP header is configurable
🟡 **Medium**
 **Role:** Admin (infra verification)

In Render dashboard → Environment → verify `TRUSTED_IP_HEADER` is documented (can be left unset to use the default `x-forwarded-for` leftmost-entry behavior, which Render guarantees is the real client IP). Review the Render docs for your plan to confirm `x-forwarded-for` leftmost entry is the authoritative client IP and that Render strips client-supplied XFF values.

✅ Pass: The `TRUSTED_IP_HEADER` env var is documented in `render.yaml`. The `getClientIp()` function uses it when set, falls back to `x-forwarded-for` leftmost entry otherwise.

---

## Regression Checklist

Run this checklist after any code deployment to confirm core flows still work:

- [ ] Sign-up with valid credentials creates an account
- [ ] Sign-in with correct credentials + facility URL succeeds
- [ ] Sign-in with wrong facility URL is rejected
- [ ] Category page shows items and progress for signed-in user
- [ ] Marking an item read updates the progress ring immediately
- [ ] Exempt item acknowledge does not affect progress
- [ ] Video playback resumes from last position
- [ ] Dashboard loads with correct data for signed-in user
- [ ] Achievement unlocks after first item completion
- [ ] Admin can create a category and it appears on the public site
- [ ] Analytics Overall tab loads without error
- [ ] Facility User sees only their facility's data
- [ ] CSV export downloads without error
- [ ] Language toggle switches the full UI to Spanish
- [ ] IP allowlist blocks and unblocks correctly
- [ ] Audit log records a password reset action
- [ ] Tester sign-in shows regular user dashboard with Testing tab embedded
- [ ] Tester can create a run, set statuses, and add notes
- [ ] Tester can attach and remove a screenshot on a failed test
- [ ] Admin Test Results page lists all tester runs
- [ ] Admin can open a run detail and see screenshot links
- [ ] Role Switcher visible only for tester accounts
- [ ] Tester simulating Admin sees full admin panel
- [ ] Tester simulating Facility User sees CPC Sales scoped data
- [ ] Tester analytics remain excluded in all simulated roles
- [ ] Idle prompt appears after 90s of inactivity on static content
- [ ] "Yes, I'm still here" dismisses modal and resumes timer
- [ ] Video/audio items do not trigger the idle prompt
- [ ] Dashboard tab nav shows "More" dropdown when tabs don't fit on narrow screens
- [ ] Action/bookmark/rating badges do not collide with type badge on mobile (category page and dashboard)
- [ ] Category accordion header shows connected pills on desktop and stacked badges on mobile
- [ ] Role Switcher button is visible above footer at bottom of page
- [ ] Post-login ?redirect= with external URL lands on dashboard (not external site)
- [ ] Signup challenge rate limiter blocks >10 requests per minute per IP
- [ ] Duplicate PIN at same facility is rejected server-side on signup
- [ ] PDF duration estimator rejects non-Supabase and HTTP URLs
- [ ] content-security-policy header does not contain unsafe-eval
- [ ] x-frame-options: SAMEORIGIN is present on every page response
- [ ] Updating security questions preserves old answers until new insert succeeds
- [ ] Tester role simulation (all four roles) works without PGRST116 errors
- [ ] IP allowlist serves stale cache on DB error (not empty allowlist)
- [ ] createFacilityUser rolls back auth user on profile-insert failure
- [ ] Generic rate-limit.server.ts file is absent from the codebase
