// Shared with components/Sidebar.tsx — keep FILTER_STORAGE_VERSION in sync
// with the constant of the same name there.
const FILTER_STORAGE_VERSION = 1

export const getSidebarFilterStorageKey = (selectedCategory?: string) =>
  `ortelius:sidebar-filters:${selectedCategory ?? 'default'}:v${FILTER_STORAGE_VERSION}`

// Keep this in sync with the 'orgs' page's default filter state in app/page.tsx.
const ALL_CHECKED_ORG_VISIBILITY = ['myOrgs', 'favorites', 'public']

/**
 * Writes "My Orgs / Favorites / Public" all-checked into the saved sidebar
 * filters for the Organizations page.
 *
 * Why this exists: Sidebar.tsx persists/restores orgVisibility to/from
 * localStorage like any other filter, which is what lets a user's manual
 * selection survive a page refresh. But a value saved *before* the user
 * logged in or completed onboarding (e.g. just `['public']`, since that's
 * all an anonymous visitor can see) would otherwise keep getting restored
 * and override the correct "all checked" starting point. Call this once,
 * right when onboarding completes, to seed that starting point explicitly —
 * Sidebar's normal load/save logic takes over unchanged from there, so any
 * selection the user makes afterward persists exactly as it does for every
 * other filter.
 */
export function setAllOrgVisibilityChecked() {
  if (typeof window === 'undefined') return
  try {
    const key = getSidebarFilterStorageKey('orgs')
    const raw = window.localStorage.getItem(key)
    const existing = raw ? JSON.parse(raw) : {}

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...existing, orgVisibility: ALL_CHECKED_ORG_VISIBILITY })
    )
  } catch (error) {
    console.warn('[orgVisibilityFilter] Unable to set org visibility:', error)
  }
}