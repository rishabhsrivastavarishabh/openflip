

## Plan: Content Calendar, Navigation Restructure & Cleanup

### Summary
Three focused changes: (1) Add a Content Calendar to Creator Dashboard, (2) Merge Search/Explore into one page and restructure the bottom nav, (3) Add a create-post button to the Profile header.

---

### 1. Content Calendar Component
**New file**: `src/components/creator/ContentCalendar.tsx`
- Calendar view (month grid) using `date-fns` for date manipulation
- Each day cell shows scheduled/published post indicators (colored dots)
- Click a day to see posts published that day (fetched from `posts` table filtered by `user_id` and `created_at` date range)
- "Plan Post" button per day that navigates to `/create` with a date query param
- Uses existing Shadcn Calendar component for the date picker portion
- Mobile-responsive: stacked layout on small screens

**Edit**: `src/components/creator/CreatorDashboard.tsx`
- Add "Content Calendar" to `menuItems` array with section `'calendar'`
- Render `ContentCalendar` when `onOpenSection('calendar')` is triggered

### 2. Merge Search & Explore — Single Page
**Edit**: `src/pages/Explore.tsx`
- Merge the search functionality from `Search.tsx` into `Explore.tsx`
- When no search query: show the existing Explore grid (trending posts, reels)
- When user types a query: show search results (users, posts, reels, hashtags) with tabs, same as current Search page
- Include search history functionality currently in Search.tsx

**Edit**: `src/App.tsx`
- Remove the `/search` route (redirect `/search` to `/explore` or remove entirely)
- Keep `/explore` as the unified discovery page

**Edit**: `src/components/layout/MobileNav.tsx`
- Remove `Search` from nav items (currently goes to `/search`)
- Remove `PlusSquare` (Create) from nav items
- Change `Search` icon item to point to `/explore` (keep the Search icon for Explore)
- Replace the `User` icon with user's avatar photo (fetch from `useAuth().profile`)
- Final nav order: **Home, Explore (Search icon), Reels, Messages, Profile (user photo)**

**Edit**: `src/components/layout/Sidebar.tsx`
- Mirror the same changes: merge Search into Explore link, remove standalone Create from nav
- Profile item shows user avatar instead of generic User icon

### 3. Create Post Button on Profile Header
**Edit**: `src/pages/Profile.tsx`
- For own profile (`isOwnProfile`): add a `PlusSquare` icon button in the header row (next to "Edit profile" and Settings)
- Links to `/create`

### 4. Navigation Cleanup
- Remove or keep `src/pages/Search.tsx` as a redirect to `/explore` for backward compatibility
- Update any `Link to="/search"` references across the app to point to `/explore`

---

### Technical Notes
- No database changes needed — Content Calendar reads from existing `posts` table
- No new backend functions required
- The Explore/Search merge preserves all existing search history and trending logic
- Profile avatar in nav uses `profile.avatar_url` from AuthContext (already available)

