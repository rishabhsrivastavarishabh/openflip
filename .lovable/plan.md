## Goal

Roll a bolder version of the Messages refresh across every page: stronger gradients, glassmorphism, softer motion, tighter typography, and rounded card surfaces — while keeping structure and business logic untouched.

## Design language (locked across all phases)

- **Surfaces**: `rounded-2xl` / `rounded-3xl` cards, subtle 1px borders, `backdrop-blur-xl` on floating chrome, layered soft shadows.
- **Headers**: gradient logo wordmark, sticky glass top bars with blurred backdrop, floating segmented tabs.
- **Accents**: blue→purple gradient tokens already in the theme, tinted unread/active states, gradient badges and CTAs.
- **Motion**: `transition-all` on interactive surfaces, subtle scale-on-press for buttons, fade/slide-in for lists (Tailwind + existing animate utilities — no new libs).
- **Icons**: keep the modernized Lucide set (House, Clapperboard, etc.).
- **Type**: heavier tracking on section titles, muted-foreground metadata, larger touch targets on mobile.

New shared primitives added in phase 1 and reused everywhere:

- `GlassHeader` — sticky blurred page header with title/back-button/actions slots.
- `SectionCard` — rounded, bordered, hoverable content card.
- `GradientBadge` — pill for counts/unread/status.
- `EmptyState` — icon + copy + optional CTA.

## Phase 1 (this turn) — Feed + Profile

**Feed (`src/pages/Feed.tsx` and its section components)**
- New sticky glass top bar with gradient "openflip" wordmark, notification + messages icons.
- Stories row: pill container with gradient rings on unseen stories, smoother horizontal scroll.
- Post cards: `rounded-3xl`, thin border, elevated on hover, gradient action row.
- `SuggestedUsers` and `SuggestedPosts`: retitled section headers, horizontal snap carousel with rounded avatars/thumbnails.
- Modern empty state when feed is empty.

**Profile (`src/pages/Profile.tsx`)**
- Gradient cover strip behind avatar, larger avatar with gradient ring for verified/live status.
- Stats row as three rounded tiles with tap targets.
- Action buttons (Follow / Message / Share) as gradient pill row.
- Tabs (Posts / Reels / Tagged / Saved) as floating segmented control.
- Grid tiles with rounded corners and hover overlay for like/comment counts.

No changes to hooks, queries, RLS, routing, or data shapes — visuals only.

## Phase 2 (next turn) — Settings + Auth

- Restyle `SettingsLayout` sidebar and every subpage (Account, Security, Privacy, Notifications, Appearance, 2FA, More) using `SectionCard` + `GlassHeader`.
- Security checklist becomes a progress ring + tinted rows.
- Auth pages (Sign in / Sign up / Reset / MFA challenge) get the gradient hero panel and glass card treatment.

## Phase 3 (following turn) — Explore, Notifications, Reels, misc.

- Explore: trending grid as bento layout, search bar as glass pill, category chips.
- Notifications: grouped cards, gradient unread indicator, swipe-friendly rows.
- Reels overlay chrome: cleaner gradient scrims, rounded action rail.
- Sweep remaining pages (Followers/Following, Highlights, Billing, etc.) for consistency.

## Out of scope

- No backend, RLS, schema, routing, or business-logic changes.
- No new dependencies.
- No changes to Messages/Conversation (already done).

## Technical notes

- All colors via existing semantic tokens in `index.css` / `tailwind.config.ts`. No hardcoded hex in components.
- New primitives live in `src/components/ui/` (project-local, not shadcn overrides).
- Verify each phase with a Playwright screenshot pass on Feed/Profile at mobile viewport before closing the turn.
