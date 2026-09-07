// Tracks org names (repo owners) that were just favorited or imported via
// the Add Project flow but haven't shown up in the backend's aggregated org
// list yet. The import job that creates that backend record runs on a ~15
// minute cycle, so for a while after "I'm Done" the org may not exist there
// at all — not even as a `pending_scan` row. This is purely a client-side
// bridge over that gap: the org list reads it to render a "Waiting on
// import..." placeholder, and clears each entry once the real org shows up.

const STORAGE_KEY = 'ortelius:pendingOrgImports:v1'

// Imports run roughly every 15 minutes — give it one extra cycle of buffer
// before we stop showing the placeholder, so a slow cycle doesn't just make
// the card silently disappear.
const TTL_MS = 30 * 60 * 1000

interface PendingEntry {
  name: string
  addedAt: number
}

function readAll(): PendingEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: PendingEntry[] = JSON.parse(raw)
    const now = Date.now()
    return parsed.filter(e => now - e.addedAt < TTL_MS)
  } catch {
    return []
  }
}

function writeAll(entries: PendingEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or unavailable — the placeholder is a nice-to-have, so
    // just skip persisting rather than surfacing an error.
  }
}

/** Record org names that were just favorited/imported. */
export function addPendingOrgImports(names: string[]): void {
  const clean = names.map(n => n.trim()).filter(Boolean)
  if (clean.length === 0) return

  const existing = readAll()
  const now = Date.now()
  const merged = new Map(existing.map(e => [e.name.toLowerCase(), e]))
  clean.forEach(n => {
    const key = n.toLowerCase()
    if (!merged.has(key)) merged.set(key, { name: n, addedAt: now })
  })
  writeAll(Array.from(merged.values()))
}

/** Org names still pending (not yet expired). */
export function getPendingOrgImports(): string[] {
  return readAll().map(e => e.name)
}

/** Clear one entry once the real org shows up in the aggregated org list. */
export function clearPendingOrgImport(name: string): void {
  const remaining = readAll().filter(e => e.name.toLowerCase() !== name.toLowerCase())
  writeAll(remaining)
}