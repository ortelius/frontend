import { AffectedRelease, ImageData, Vulnerability } from './types'

// Helper to count vulnerabilities by severity
export function countVulnerabilitiesBySeverity (vulnerabilities: Vulnerability[]): { critical: number, high: number, medium: number, low: number } {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  }

  vulnerabilities.forEach(vuln => {
    const rating = vuln.severity_rating?.toLowerCase()
    if (rating === 'critical') counts.critical++
    else if (rating === 'high') counts.high++
    else if (rating === 'medium') counts.medium++
    else if (rating === 'low') counts.low++
  })

  return counts
}

// Helper to check if a Date object is valid and not the Unix epoch
function isValidDate (date: Date): boolean {
  return !isNaN(date.getTime()) && date.getTime() > 86400000 // after Jan 2 1970
}

// Helper to format relative time
export function getRelativeTime (dateString: string): string {
  try {
    if (!dateString) return 'unknown'

    const date = new Date(dateString)
    if (!isValidDate(date)) return 'unknown'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()

    // Guard against future dates or epoch-like values
    if (diffMs < 0) return 'unknown'

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`

    return `${Math.floor(diffDays / 365)} years ago`
  } catch {
    return 'unknown'
  }
}

// Transform GraphQL AffectedRelease data to ImageData format for UI
export function transformAffectedReleasesToImageData (
  affectedReleases: AffectedRelease[]
): ImageData[] {
  // Group by release name only — one card per release, showing the latest version
  const releaseMap = new Map<string, AffectedRelease[]>()

  affectedReleases.forEach(ar => {
    const key = String(ar.release_name)
    if (!releaseMap.has(key)) {
      releaseMap.set(key, [])
    }
    const releases = releaseMap.get(key)
    if (releases !== undefined) {
      releases.push(ar)
    }
  })

  // Transform each release group into ImageData
  const imageDataList: ImageData[] = []

  releaseMap.forEach((releases, key) => {
    // Pick the is_latest row as representative — it has the correct latest version,
    // vulnerability_count, synced_endpoint_count, and other card metadata.
    const firstRelease = releases.find(r => r.is_latest) ?? releases[0]

    // Count vulnerabilities from rows matching the latest version only
    const latestVersion = firstRelease.release_version
    const latestRows = releases.filter(r => r.release_version === latestVersion)

    const vulnCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    latestRows.forEach(r => {
      const rating = r.severity_rating?.toLowerCase()
      if (rating === 'critical') vulnCounts.critical++
      else if (rating === 'high') vulnCounts.high++
      else if (rating === 'medium') vulnCounts.medium++
      else if (rating === 'low') vulnCounts.low++
    })

    // Get the most recent modified date, falling back to published date
    const mostRecentDate = latestRows.reduce((latest, r) => {
      // Try modified first, then published
      const dateStr = r.modified || r.published
      if (!dateStr) return latest
      const date = new Date(dateStr)
      if (!isValidDate(date)) return latest
      return date > latest ? date : latest
    }, new Date(0))

    // Calculate total vulnerabilities from vulnerability_count field
    // Fix: Use nullish coalescing operator (??) to handle nullable number safely
    const totalVulnerabilities = firstRelease.vulnerability_count ?? 0

    // Get vulnerability count delta (can be positive, negative, zero, or null)
    const vulnerabilityCountDelta = firstRelease.vulnerability_count_delta !== undefined
      ? firstRelease.vulnerability_count_delta
      : 0

    imageDataList.push({
      name: firstRelease.release_name,
      version: firstRelease.release_version,
      releaseDate: firstRelease.published ?? new Date().toISOString(),
      publisher: firstRelease.project_type === 'docker' ? 'Docker Official Image' : 'Community',
      description: `${firstRelease.project_type ?? 'Unknown'} release with ${String(firstRelease.dependency_count)} dependencies`,
      pulls: firstRelease.dependency_count > 100 ? '1B+' : firstRelease.dependency_count > 50 ? '500M+' : '100M+',
      updated: isValidDate(mostRecentDate) ? getRelativeTime(mostRecentDate.toISOString()) : 'unknown',
      verified: false,
      official: false,
      tags: ['latest', firstRelease.release_version, firstRelease.project_type ?? 'unknown'],
      longDescription: `${String(firstRelease.release_name)} version ${String(firstRelease.release_version)}`,
      vulnerabilities: vulnCounts,
      dependency_count: firstRelease.dependency_count,
      signed: false,
      openssfScore: firstRelease.openssf_scorecard_score ?? 0,
      syncedEndpoints: firstRelease.synced_endpoint_count ?? 0,
      version_count: firstRelease.version_count ?? 1,
      total_vulnerabilities: totalVulnerabilities,
      vulnerability_count_delta: vulnerabilityCountDelta,
      is_latest: firstRelease.is_latest ?? true
    })
  })

  return imageDataList
}

// Extract unique tags from a release
export function extractTags (release: any): string[] {
  const tags: string[] = ['latest']

  if (typeof release.version === 'string') {
    tags.push(release.version)
  }

  if (typeof release.docker_tag === 'string') {
    tags.push(release.docker_tag)
  }

  if (typeof release.project_type === 'string') {
    tags.push(release.project_type)
  }

  return [...new Set(tags)]
}

// Get pull count based on various factors (simplified)
export function estimatePullCount (dependencies: number, isOfficial: boolean): string {
  if (isOfficial) {
    if (dependencies > 200) return '10B+'
    if (dependencies > 100) return '5B+'
    return '1B+'
  }

  if (dependencies > 200) return '500M+'
  if (dependencies > 100) return '100M+'
  return '10M+'
}