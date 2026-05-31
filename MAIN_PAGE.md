# Main App Page — Feature Guide

This guide explains every feature on the main page of the Reentry to Recovery content library — the home screen users see when they arrive at the platform.

---

## Navigation Bar

The navigation bar appears at the top of every page. It contains:

- **Reentry to Recovery logo / name** — clicking it always returns to the home page
- **Categories** — link back to the main content library from any page
- **Privacy Policy** — link to the platform's privacy policy
- **My Dashboard** — link to the user's personal progress dashboard (only visible when signed in)
- **Sign In / Sign Out** — sign in takes new or returning users to the signup/login flow; sign out ends the current session
- **Language toggle (EN / ES)** — switches the entire interface between English and Spanish instantly, including all navigation labels, category names, descriptions, and content item text where translations have been provided

The navigation bar is fully responsive — on smaller screens it collapses into a mobile menu.

---

## Message Banners

Below the navigation bar, up to two announcement banners may appear:

- **Site-wide message** — a general announcement set by the platform administrator, shown to all users
- **Facility message** — a message specific to the user's enrolled facility, shown only to users from that facility

Both banners can be dismissed individually by the user. Once dismissed, a banner does not reappear unless the administrator updates the message content. Banners support English and Spanish translations.

---

## Hero Section

The top of the page features a hero section with:

- A short eyebrow label (e.g., "A library for the road back")
- A headline introducing the platform
- A subheading describing what users will find

The hero content is managed by the platform administrator and can be customized. It also supports English and Spanish translations.

---

## Category Grid

The main content of the home page is a grid of **category cards** — each card represents a program or topic area (e.g., Substance Abuse Recovery, Employment Skills, Family & Parenting). The grid is responsive: 4 columns on large screens, 3 on medium, 2 on small, 1 on mobile.

### Each Category Card Shows:

**Icon**
A colored icon representing the topic, displayed in a rounded tile with a matching background tint.

**Category name**
The title of the program or topic area. Displays in Spanish when the language is set to ES.

**Tagline**
A short description of what the category covers, shown in muted text below the name. Also translatable.

**Item count badge**
Shows how many content items are in the category (e.g., "8 items"). Only counts items the user is permitted to see based on their facility.

**New content badge**
If any items have been added to the category within the last 7 days and the user hasn't opened them yet, a "New content added" badge appears on the card. Once the user has opened those items, the badge disappears.

**Progress bar** *(signed-in users only)*
For users who are logged in, a thin progress bar appears at the bottom of each card showing how many items in that category they have completed (e.g., "3 of 8 items"). This updates as they work through the content.

Clicking anywhere on a category card takes the user into that category's content page.

---

## Facility-Scoped Visibility

Users only see categories and content items that are available to their facility. Categories and items restricted to specific facilities are automatically hidden from users not enrolled in those facilities — no special action is needed from the user.

---

## Facility-Specific Home Pages

Users who access the platform through a facility-specific URL (e.g., `/facility/your-facility-id`) see a customized version of the home page configured specifically for that facility. These custom pages may show a different set of categories, a different hero message, and facility-specific announcements, all managed by the platform administrator.

---

## Sign In / Sign Up

Users who are not signed in can still browse the home page and category list, but cannot mark items complete, track progress, or access their dashboard. The sign-in link in the navigation takes them to the account creation and login flow.

If a user arrives via a facility link with an inmate PIN in the URL (e.g., `?user=123456`), the PIN is pre-filled in the sign-up form so they do not have to enter it manually.

---

## Footer

The footer appears at the bottom of every page and includes:

- The platform name and branding
- A link to the Privacy Policy
- Copyright information

---

## What Changes When Signed In

When a user signs in, the main page gains additional features:

| Feature | Not signed in | Signed in |
|---|---|---|
| Browse categories | ✓ | ✓ |
| See item counts | ✓ | ✓ |
| See "New content" badges | ✓ | ✓ |
| See progress bars on cards | — | ✓ |
| Access My Dashboard | — | ✓ |
| Track content completion | — | ✓ |
| See facility-specific messages | — | ✓ |
| Sign out | — | ✓ |
