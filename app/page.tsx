'use client' 

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { graphqlQuery, GET_ORG_AGGREGATED_RELEASES } from '@/lib/graphql'
import { GetOrgAggregatedReleasesResponse, OrgAggregatedRelease } from '@/lib/types'
import { useOrg } from '@/context/OrgContext'
import { useAuth } from '@/context/AuthContext'
import MainLayoutWrapper from '@/components/MainLayoutWrapper'

// Icons
import BusinessIcon from '@mui/icons-material/Business'
import SecurityIcon from '@mui/icons-material/Security'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import HubIcon from '@mui/icons-material/Hub'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'

export default function ProjectsPage() {
  const router = useRouter()
  const { setSelectedOrg } = useOrg()
  const { user } = useAuth()
  const [data, setData] = useState<OrgAggregatedRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    vulnerabilityScore: [],
    openssfScore: [],
    name: '',
    orgVisibility: ['myOrgs', 'public'],
  })

  // ADD THESE TWO LINES TO RESOLVE THE COMPILE ERROR:
  const showMyOrgs = filters.orgVisibility.includes('myOrgs')
  const showPublic = filters.orgVisibility.includes('public')
  
  const isLoggedIn = !!user

  const filteredData = data.filter(org => {
    const isPending = (org as any).pending_scan === true
    const isMyOrg = user?.orgs?.includes(org.org_name) || isPending
    const isPublic = !isMyOrg
    const vis = filters.orgVisibility ?? ['myOrgs', 'public']
    if (isMyOrg && vis.includes('myOrgs')) return true
    if (isPublic && vis.includes('public')) return true
    return false
  }).filter(org =>
    !filters.name || org.org_name.toLowerCase().includes(filters.name.toLowerCase())
  )

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
    if (isPending) return // pending orgs aren't clickable yet
    setSelectedOrg(orgName)
    router.push('/dashboard')
  }

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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No organizations found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {!showMyOrgs && !showPublic
                  ? 'Enable at least one filter above to see organizations.'
                  : 'You are not associated with any organizations that have visible releases.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {filteredData.map((org, idx) => {
                const isPending = (org as any).pending_scan === true

                return (
                  <div
                    key={idx}
                    onClick={() => handleOrgClick(org.org_name, isPending)}
                    className={`bg-white rounded-xl border shadow-sm p-6 transition-shadow ${
                      isPending
                        ? 'border-blue-200 opacity-75 cursor-default'
                        : 'border-gray-200 hover:shadow-md cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isPending ? 'bg-blue-50 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                          <BusinessIcon />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{org.org_name || 'Library'}</h3>
                          <p className="text-sm text-gray-500">
                            {isPending ? 'Queued for scan' : `${org.total_releases} Releases`}
                          </p>
                        </div>
                      </div>
                      {!isPending && org.avg_scorecard_score != null && (
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          <SecurityIcon sx={{ fontSize: 16 }} className="text-green-600" />
                          <span className="text-sm font-semibold text-gray-700">{org.avg_scorecard_score.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {isPending ? (
                      /* Pending state — awaiting first scan cycle */
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 w-fit">
                          <HourglassEmptyIcon sx={{ fontSize: 14 }} className="text-blue-500 animate-pulse" />
                          <span className="text-xs font-medium text-blue-700">Awaiting first scan</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          The relscanner will pick up this repository within the next scan cycle (~10 min).
                          Vulnerability data will appear here automatically.
                        </p>
                      </div>
                    ) : (
                      /* Normal state — has release data */
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Vulnerabilities</p>
                          <div className="flex flex-wrap gap-2">
                            {org.critical_count > 0 && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">
                                {org.critical_count} Critical
                              </span>
                            )}
                            {org.high_count > 0 && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-bold">
                                {org.high_count} High
                              </span>
                            )}
                            {org.medium_count > 0 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">
                                {org.medium_count} Med
                              </span>
                            )}
                            {org.low_count > 0 && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                                {org.low_count} Low
                              </span>
                            )}
                            {org.total_vulnerabilities === 0 && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">
                                Clean
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
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

                        {org.vulnerability_count_delta != null && org.vulnerability_count_delta !== 0 && (
                          <div className="pt-2">
                            <span className={`text-xs font-medium ${org.vulnerability_count_delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {org.vulnerability_count_delta > 0 ? '↑' : '↓'} {Math.abs(org.vulnerability_count_delta)} new vulnerabilities
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </MainLayoutWrapper>
    </div>
  )
}