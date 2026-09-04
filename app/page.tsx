'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Toast from '@/components/Toast'
import { graphqlQuery, GET_ORG_AGGREGATED_RELEASES } from '@/lib/graphql'
import { GetOrgAggregatedReleasesResponse, OrgAggregatedRelease } from '@/lib/types'
import { useOrg } from '@/context/OrgContext'
import { useAuth } from '@/context/AuthContext'
import MainLayoutWrapper from '@/components/MainLayoutWrapper'
import { fetchFavoriteOrgs, toggleFavoriteOrgOnServer } from '@/lib/favorites'

// Icons
import BusinessIcon from '@mui/icons-material/Business'
import SecurityIcon from '@mui/icons-material/Security'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import HubIcon from '@mui/icons-material/Hub'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import SettingsIcon from '@mui/icons-material/Settings'

// endpoint_type_counts is supplied by the backend once the scanner fix lands.
// Each entry is { label: string, count: number } e.g. { label: "kubernetes", count: 12 }.

// ── Org card ─────────────────────────────────────────────────────────────────

function OrgCard({
  org,
  onClick,
  isFavorite,
  onToggleFavorite,
  onSettingsClick,
}: {
  org: OrgAggregatedRelease
  onClick: () => void
  isFavorite: boolean
  onToggleFavorite: (orgName: string) => void
  onSettingsClick?: (orgName: string) => void
}) {
  const isPending = org.pending_scan === true
  const endpointPills = org.endpoint_type_counts ?? []

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border shadow-sm p-6 transition-shadow flex flex-col ${
        isPending
          ? 'border-blue-200 opacity-75 cursor-default'
          : 'border-gray-200 hover:shadow-md cursor-pointer'
      }`}
    >
      {/* ── Card header ── */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${isPending ? 'bg-blue-50 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <BusinessIcon />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-lg truncate">{org.org_name || 'Library'}</h3>
            <p className="text-sm text-gray-500">
              {isPending ? 'Queued for scan' : `${org.total_releases} Releases`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {!isPending && org.avg_scorecard_score != null && (
            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100 mr-1">
              <SecurityIcon sx={{ fontSize: 16 }} className="text-green-600" />
              <span className="text-sm font-semibold text-gray-700">{org.avg_scorecard_score.toFixed(1)}</span>
            </div>
          )}
          {/* Org settings — only for non-pending orgs with a settings handler */}
          {!isPending && onSettingsClick && (
            <button
              onClick={(e) => { e.stopPropagation(); onSettingsClick(org.org_name) }}
              title="Org settings"
              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </button>
          )}
          {/* Favorite toggle — requires login; gated in the parent's handler */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(org.org_name) }}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className="p-1 rounded hover:bg-yellow-50 transition-colors"
          >
            {isFavorite ? (
              <StarIcon sx={{ fontSize: 20 }} className="text-yellow-500" />
            ) : (
              <StarBorderIcon sx={{ fontSize: 20 }} className="text-gray-300 hover:text-yellow-400" />
            )}
          </button>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 w-fit">
            <HourglassEmptyIcon sx={{ fontSize: 14 }} className="text-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-700">Awaiting first scan</span>
          </div>
          <p className="text-xs text-gray-400">
            The scanner will pick up this repository within the next scan cycle (~10 min).
            Vulnerability data will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4 flex-1">
          {/* Vulnerability severity pills */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Vulnerabilities</p>
            <div className="flex flex-wrap gap-2">
              {org.critical_count > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">{org.critical_count} Critical</span>
              )}
              {org.high_count > 0 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-bold">{org.high_count} High</span>
              )}
              {org.medium_count > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">{org.medium_count} Med</span>
              )}
              {org.low_count > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">{org.low_count} Low</span>
              )}
              {org.total_vulnerabilities === 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">Clean</span>
              )}
            </div>
          </div>

          {/* Endpoint type badges */}
          {endpointPills.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Endpoint Types</p>
              <div className="flex flex-wrap gap-1.5">
                {endpointPills.map((pill) => (
                  <span
                    key={pill.label}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-medium"
                  >
                    {pill.label}
                    <span className="text-gray-400">x{pill.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 mt-auto">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <HubIcon sx={{ fontSize: 14 }} />
                Synced Endpoints
              </div>
              <p className="font-semibold text-gray-900">{org.synced_endpoint_count}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <Inventory2Icon sx={{ fontSize: 14 }} />
                Dependencies
              </div>
              <p className="font-semibold text-gray-900">{org.total_dependencies}</p>
            </div>
          </div>

          {/* Contextual delta */}
          {org.vulnerability_count_delta != null && org.vulnerability_count_delta !== 0 && (
            <div className="pt-1">
              <span className={`text-xs font-medium ${org.vulnerability_count_delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {org.vulnerability_count_delta > 0 ? '↑' : '↓'}{' '}
                {Math.abs(org.vulnerability_count_delta)} new CVEs this week
                {(org.critical_count + org.high_count) > 0 && (
                  <span className="text-gray-500 font-normal">
                    {' '}— {org.critical_count + org.high_count} affecting production endpoints
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()
  const { setSelectedOrg } = useOrg()
  const { user } = useAuth()
  const [data, setData] = useState<OrgAggregatedRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    vulnerabilityScore: [] as string[],
    openssfScore: [] as string[],
    name: '',
    orgVisibility: ['myOrgs', 'favorites', 'public'] as string[],
  })

  const isLoggedIn = !!user

  // Clear the org selection on arrival here, not on the way out via
  // TopNavigation's "Switch Org" link. Clearing it there fired while
  // Dashboard was still mounted, re-triggering its selectedOrg-dependent
  // fetch effects with a null/empty org -- the most expensive query shape
  // on the backend (scans across all orgs instead of one). This page's own
  // fetch below depends on [user], not selectedOrg, so resetting it here is
  // safe and has no equivalent side effect.
  useEffect(() => {
    setSelectedOrg(null)
  }, [])

  // Load the user's favorites from the backend once logged in.
  // Logged-out users have no favorites to load — leave the list empty
  // rather than calling an endpoint that requires auth.
  useEffect(() => {
    if (!isLoggedIn) {
      setFavorites([])
      return
    }
    fetchFavoriteOrgs().then(setFavorites)
  }, [isLoggedIn])

  const handleToggleFavorite = async (orgName: string) => {
    if (!isLoggedIn) {
      setToastMessage('Sign in to save favorites')
      return
    }

    // Optimistic update — flip locally first, then confirm with the server.
    const wasFavorited = favorites.includes(orgName)
    setFavorites(prev =>
      wasFavorited ? prev.filter(o => o !== orgName) : [...prev, orgName]
    )

    try {
      const serverFavorites = await toggleFavoriteOrgOnServer(orgName)
      setFavorites(serverFavorites)
    } catch (err) {
      console.error('Failed to update favorite:', err)
      // Roll back the optimistic change on failure
      setFavorites(prev =>
        wasFavorited ? [...prev, orgName] : prev.filter(o => o !== orgName)
      )
      setToastMessage('Could not save favorite — please try again')
    }
  }

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        const response = await graphqlQuery<GetOrgAggregatedReleasesResponse>(
          GET_ORG_AGGREGATED_RELEASES,
          { severity: 'NONE' }
        )
        setData(response.orgAggregatedReleases)
      } catch (err) {
        console.error('Error fetching projects:', err)
        setError('Failed to load projects')
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [user])

  const handleOrgClick = (orgName: string, isPending: boolean) => {
    if (isPending) return
    setSelectedOrg(orgName)
    router.push('/dashboard')
  }

  const showMyOrgs = filters.orgVisibility.includes('myOrgs')
  const showFavorites = filters.orgVisibility.includes('favorites')
  const showPublic = filters.orgVisibility.includes('public')

  const filteredData = data.filter(org => {
    const isPending = org.pending_scan === true
    const isMyOrg = (user?.orgs?.includes(org.org_name) || isPending)
    const isFavorited = favorites.includes(org.org_name)
    const isPublicOnly = !isMyOrg

    // Additive (OR) match — an org shows once if it matches ANY checked filter.
    const visibilityMatch =
      (isMyOrg && showMyOrgs) ||
      (isFavorited && showFavorites) ||
      (isPublicOnly && showPublic)

    if (!visibilityMatch) return false

    if (filters.name && !org.org_name.toLowerCase().includes(filters.name.toLowerCase())) {
      return false
    }

    if (filters.vulnerabilityScore.length > 0) {
      const hasNoVulnerabilities = org.total_vulnerabilities === 0
      const matchesSeverity = filters.vulnerabilityScore.some(sev => {
        if (sev === 'clean') return hasNoVulnerabilities
        if (sev === 'critical') return org.critical_count > 0
        if (sev === 'high') return org.high_count > 0
        if (sev === 'medium') return org.medium_count > 0
        if (sev === 'low') return org.low_count > 0
        return false
      })
      if (!matchesSeverity) return false
    }

    return true
  })

  // No views checked at all (My Orgs / Favorites / Public all unchecked) is a
  // distinct empty state from "views are checked, but nothing matched" —
  // the former needs the user to pick a view, the latter needs them to relax
  // a filter or go add a favorite.
  const noViewsSelected = !showMyOrgs && !showFavorites && !showPublic

  return (
    <div className="flex w-full">
      <Sidebar
        filters={filters}
        setFilters={setFilters}
        selectedCategory="orgs"
        isLoggedIn={isLoggedIn}
      />
      <MainLayoutWrapper>
        <div className="px-6 py-6 bg-gray-50 min-h-full">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
            <p className="text-gray-600 mt-1">Select an organization to view vulnerability details</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-800 rounded-lg">
              {error}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <BusinessIcon className="mx-auto h-12 w-12 text-gray-300" />
              {noViewsSelected ? (
                <>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No views selected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose My Orgs, Favorites, or Public to see organizations.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No organizations match your filters</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try a different name search or enable another view. Add public repos to Favorites from your profile to keep their vulnerability data fresh.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {filteredData.map((org, idx) => (
                <OrgCard
                  key={idx}
                  org={org}
                  onClick={() => handleOrgClick(org.org_name, org.pending_scan === true)}
                  isFavorite={favorites.includes(org.org_name)}
                  onToggleFavorite={handleToggleFavorite}
                  onSettingsClick={user?.orgs?.includes(org.org_name) ? (name) => router.push(`/orgs/${name}`) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </MainLayoutWrapper>

      {toastMessage && (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
          actionLabel={!isLoggedIn ? 'Sign In' : undefined}
          onAction={!isLoggedIn ? () => router.push('/') : undefined}
        />
      )}
    </div>
  )
}