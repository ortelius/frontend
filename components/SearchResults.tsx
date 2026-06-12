'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/context/OrgContext'

import {
  graphqlQuery,
  GET_AFFECTED_RELEASES,
  GET_SYNCED_ENDPOINTS,
  GET_VULNERABILITIES,
} from '@/lib/graphql'
import {
  GetAffectedReleasesResponse,
  GetSyncedEndpointsResponse,
  GetVulnerabilitiesResponse,
  ImageData,
  SyncedEndpoint,
  Mitigation,
} from '@/lib/types'
import { transformAffectedReleasesToImageData, getRelativeTime } from '@/lib/dataTransform'

export type SearchCategory = 'image' | 'all' | 'mitigations' | 'plugin';

interface SearchResultsProps {
  query: string
  category: SearchCategory
  filters: {
    vulnerabilityScore: string[]
    openssfScore: string[]
    name: string
    status?: string[]
    environment?: string[]
    endpointType?: string[]
  }
}

const mockMitigations: Mitigation[] = [
  {
    cve_id: 'GHSA-f82v-jwr5-mffw',
    summary: 'Authorization Bypass in Next.js Middleware',
    severity_score: 9.1,
    severity_rating: 'CRITICAL',
    package: 'pkg:npm/next',
    affected_version: '14.2.5',
    full_purl: 'pkg:npm/next@14.2.5',
    fixed_in: ['14.2.25'],
    affected_releases: 12,
    affected_endpoints: 45,
  },
  {
    cve_id: 'GHSA-gp8f-8m3g-qvj9',
    summary: 'Next.js Cache Poisoning',
    severity_score: 8.7,
    severity_rating: 'HIGH',
    package: 'pkg:npm/next',
    affected_version: '14.2.5',
    full_purl: 'pkg:npm/next@14.2.5',
    fixed_in: ['14.2.10'],
    affected_releases: 8,
    affected_endpoints: 32,
  },
  {
    cve_id: 'GHSA-7gfc-8cq8-jh5f',
    summary: 'Next.js authorization bypass vulnerability',
    severity_score: 7.5,
    severity_rating: 'HIGH',
    package: 'pkg:npm/next',
    affected_version: '14.2.5',
    full_purl: 'pkg:npm/next@14.2.5',
    fixed_in: ['14.2.15'],
    affected_releases: 15,
    affected_endpoints: 58,
  },
]

export default function SearchResults({ query, category, filters }: SearchResultsProps) {
  const router = useRouter()
  const { selectedOrg } = useOrg()
  
  const [results, setResults] = useState<ImageData[]>([])
  const [endpointResults, setEndpointResults] = useState<SyncedEndpoint[]>([])
  const [vulnerabilityResults, setVulnerabilityResults] = useState<Mitigation[]>([])
  const [mockMitigationList, setMockMitigationList] = useState<Mitigation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)
  const [selectedMitigations, setSelectedMitigations] = useState<Set<string>>(new Set())
  const [showActionMenu, setShowActionMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchDataForCategory = async () => {
      try {
        setLoading(true)
        setError(null)

        const orgParam = selectedOrg || ""

        switch (category) {
          case 'all':
            const releasesResponse = await graphqlQuery<GetAffectedReleasesResponse>(
              GET_AFFECTED_RELEASES,
              { severity: 'NONE', limit: 1000, org: orgParam }
            )
            const imageData = transformAffectedReleasesToImageData(releasesResponse.affectedReleases)
            setResults(imageData)
            break

          case 'image':
            const endpointsResponse = await graphqlQuery<GetSyncedEndpointsResponse>(
              GET_SYNCED_ENDPOINTS,
              { limit: 1000, org: orgParam }
            )
            setEndpointResults(endpointsResponse.syncedEndpoints)
            break

          case 'plugin':
            const vulnerabilitiesResponse = await graphqlQuery<GetVulnerabilitiesResponse>(
              GET_VULNERABILITIES, 
              { limit: 1000, org: orgParam }
            )
            setVulnerabilityResults(vulnerabilitiesResponse.vulnerabilities)
            break

          case 'mitigations':
            setMockMitigationList(mockMitigations)
            break
        }
      } catch (err) {
        console.error(`Error fetching ${category} data:`, err)
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchDataForCategory()
  }, [category, selectedOrg])

  useEffect(() => {
    setCurrentPage(1)
    setSelectedMitigations(new Set())
    setShowActionMenu(false)
  }, [query, filters, category, selectedOrg])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowActionMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleMitigation = (cveId: string) => {
    const newSelected = new Set(selectedMitigations)
    if (newSelected.has(cveId)) {
      newSelected.delete(cveId)
    } else {
      newSelected.add(cveId)
    }
    setSelectedMitigations(newSelected)
  }

  const toggleAll = () => {
    const allFilteredMitigations = getFilteredData() as Mitigation[]
    if (selectedMitigations.size === allFilteredMitigations.length) {
      setSelectedMitigations(new Set())
    } else {
      setSelectedMitigations(new Set(allFilteredMitigations.map(m => m.cve_id)))
    }
  }

  const handleAction = (action: string) => {
    setShowActionMenu(false)
    alert(`Successfully created ${selectedMitigations.size} ${action}(s)`)
  }

  const handleTakeAction = () => {
    if (selectedMitigations.size > 0) {
      setShowActionMenu(!showActionMenu)
    }
  }

  const getFilteredData = () => {
    const queryLower = query.toLowerCase()
    const nameLower = filters.name.toLowerCase()

    if (category === 'image') {
      return endpointResults.filter(endpoint => {
        if (query && !endpoint.endpoint_name.toLowerCase().includes(queryLower) && !endpoint.endpoint_url.toLowerCase().includes(queryLower)) return false
        if (filters.name && !endpoint.endpoint_name.toLowerCase().includes(nameLower)) return false
        if (filters.status && filters.status.length > 0 && !filters.status.some(s => endpoint.status.toLowerCase() === s.toLowerCase())) return false
        if (filters.environment && filters.environment.length > 0 && !filters.environment.some(e => endpoint.environment.toLowerCase() === e.toLowerCase())) return false
        if (filters.endpointType && filters.endpointType.length > 0 && !filters.endpointType.some(t => endpoint.endpoint_type.toLowerCase() === t.toLowerCase())) return false
        if (filters.vulnerabilityScore.length > 0) {
          const hasNoVulnerabilities = endpoint.total_vulnerabilities.critical === 0 && endpoint.total_vulnerabilities.high === 0 && endpoint.total_vulnerabilities.medium === 0 && endpoint.total_vulnerabilities.low === 0
          const matchesFilter = filters.vulnerabilityScore.some(filter => {
            if (filter === 'clean') return hasNoVulnerabilities
            if (filter === 'critical') return endpoint.total_vulnerabilities.critical > 0
            if (filter === 'high') return endpoint.total_vulnerabilities.high > 0
            if (filter === 'medium') return endpoint.total_vulnerabilities.medium > 0
            if (filter === 'low') return endpoint.total_vulnerabilities.low > 0
            return false
          })
          if (!matchesFilter) return false
        }
        return true
      })
    }

    if (category === 'plugin') {
      return vulnerabilityResults.filter(vuln => {
        if (query && !vuln.cve_id.toLowerCase().includes(queryLower) && !vuln.summary.toLowerCase().includes(queryLower)) return false
        if (filters.name && !vuln.cve_id.toLowerCase().includes(nameLower)) return false
        if (filters.vulnerabilityScore.length > 0) {
          if (filters.vulnerabilityScore.includes('clean') && filters.vulnerabilityScore.length === 1) return false
          const severities = filters.vulnerabilityScore.filter(f => f !== 'clean')
          if (severities.length > 0 && !severities.some(f => vuln.severity_rating.toLowerCase() === f.toLowerCase())) return false
        }
        return true
      })
    }

    if (category === 'mitigations') {
      return mockMitigationList.filter(mit => {
        if (query && !mit.cve_id.toLowerCase().includes(queryLower) && !mit.summary.toLowerCase().includes(queryLower)) return false
        if (filters.name && !mit.cve_id.toLowerCase().includes(nameLower)) return false
        if (filters.vulnerabilityScore.length > 0) {
          if (filters.vulnerabilityScore.includes('clean')) return false
          if (!filters.vulnerabilityScore.some(f => mit.severity_rating.toLowerCase() === f.toLowerCase())) return false
        }
        return true
      })
    }

    return results.filter(result => {
      if (query && !result.name.toLowerCase().includes(queryLower) && !result.description.toLowerCase().includes(queryLower)) return false
      if (filters.name && !result.name.toLowerCase().includes(nameLower)) return false
      if (filters.vulnerabilityScore.length > 0) {
        const hasNoVulnerabilities = result.vulnerabilities.critical === 0 && result.vulnerabilities.high === 0 && result.vulnerabilities.medium === 0 && result.vulnerabilities.low === 0
        const matchesFilter = filters.vulnerabilityScore.some(filter => {
          if (filter === 'clean') return hasNoVulnerabilities
          if (filter === 'critical') return result.vulnerabilities.critical > 0
          if (filter === 'high') return result.vulnerabilities.high > 0
          if (filter === 'medium') return result.vulnerabilities.medium > 0
          if (filter === 'low') return result.vulnerabilities.low > 0
          return false
        })
        if (!matchesFilter) return false
      }
      if (filters.openssfScore.length > 0) {
        const matchesFilter = filters.openssfScore.some(filter => {
          if (filter === 'high') return result.openssfScore >= 8.0
          if (filter === 'medium') return result.openssfScore >= 6.0 && result.openssfScore < 8.0
          if (filter === 'low') return result.openssfScore < 6.0
          return false
        })
        if (!matchesFilter) return false
      }
      return true
    })
  }

  const filteredData = getFilteredData()
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = filteredData.slice(startIndex, endIndex)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisiblePages = 7
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  const handleCardClick = (item: any) => {
    if (category === 'image') {
      const endpoint = item as SyncedEndpoint
      router.push(`/endpoint/${encodeURIComponent(endpoint.endpoint_name)}`)
    } else if (category === 'all') {
      const release = item as ImageData
      router.push(`/release/${encodeURIComponent(release.name)}?version=${encodeURIComponent(release.version)}`)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getSeverityColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEnvironmentColor = (environment: string) => {
    const envLower = environment.toLowerCase()
    if (envLower === 'production' || envLower === 'prod') return 'bg-red-100 text-red-800'
    if (envLower === 'staging' || envLower === 'stage') return 'bg-orange-100 text-orange-800'
    if (envLower === 'development' || envLower === 'dev') return 'bg-blue-100 text-blue-800'
    if (envLower === 'test' || envLower === 'testing') return 'bg-purple-100 text-purple-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getCategoryTitle = () => {
    if (category === 'image') return 'Synced Endpoints'
    if (category === 'all') return 'Project Releases'
    if (category === 'plugin') return 'Vulnerabilities'
    if (category === 'mitigations') return 'Mitigations'
    return 'Results'
  }

  if (loading) {
    return (
      <div className="px-6 py-6">
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading {getCategoryTitle().toLowerCase()}...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 py-6">
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading data</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 flex-1 overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            {query ? `Search results for "${query}"` : getCategoryTitle()}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredData.length.toLocaleString()} results
            {filteredData.length > itemsPerPage && category !== 'mitigations' && (
              <span className="text-gray-400"> • Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)}</span>
            )}
          </p>
        </div>

        {category !== 'mitigations' && (
          <div className="flex items-center gap-2">
            <label htmlFor="itemsPerPage" className="text-sm text-gray-600">Per page:</label>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={e => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
          </div>
        )}
      </div>

      {category === 'mitigations' && (
        <div className="mb-4 bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMitigations.size === filteredData.length && filteredData.length > 0}
                  onChange={toggleAll}
                  disabled={filteredData.length === 0}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Select all ({filteredData.length})</span>
              </label>
              {selectedMitigations.size > 0 && (
                <span className="text-sm text-gray-600">{selectedMitigations.size} selected</span>
              )}
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleTakeAction}
                disabled={selectedMitigations.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Take Action
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showActionMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-10">
                  <button onClick={() => handleAction('AI Auto-remediation')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                    <span className="font-medium text-gray-900">AI Auto-remediation</span>
                  </button>
                  <button onClick={() => handleAction('Jira Issue')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                    <span className="font-medium text-gray-900">Create Jira Issue</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {filteredData.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* --- Synced Endpoints (category='image') --- */}
            {category === 'image' && (paginatedData as SyncedEndpoint[]).map((endpoint, index) => {
              // FIX: Calculate vulnerability counts the same way as the details page
              // Just use the total_vulnerabilities directly from the endpoint object
              const totalCritical = endpoint.total_vulnerabilities?.critical || 0
              const totalHigh = endpoint.total_vulnerabilities?.high || 0
              const totalMedium = endpoint.total_vulnerabilities?.medium || 0
              const totalLow = endpoint.total_vulnerabilities?.low || 0

              return (
                <div key={index} onClick={() => handleCardClick(endpoint)} className="border border-gray-200 rounded-lg p-5 hover:border-gray-400 hover:shadow-md transition-all cursor-pointer bg-white flex flex-col h-full">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-blue-600 hover:underline break-words">{endpoint.endpoint_name}</h3>
                    <p className="text-sm text-gray-500">{endpoint.endpoint_url || endpoint.endpoint_name}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                     <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                     </svg>
                     <span className="text-sm font-semibold text-gray-700">Vulnerabilities:</span>
                     
                     <div className="flex gap-2 flex-wrap">
                        {totalCritical > 0 && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            {totalCritical} C
                          </span>
                        )}
                        {totalHigh > 0 && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                            {totalHigh} H
                          </span>
                        )}
                        {totalMedium > 0 && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-yellow-600"></span>
                            {totalMedium} M
                          </span>
                        )}
                        {totalLow > 0 && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            {totalLow} L
                          </span>
                        )}
                        {totalCritical === 0 && totalHigh === 0 && totalMedium === 0 && totalLow === 0 && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-green-600"></span>
                            0
                          </span>
                        )}
                     </div>
                  </div>

                  <div className="border-t border-gray-100 my-1"></div>

                  <div className="flex items-center gap-3 mt-3">
                     <div className="flex items-center gap-2">
                       <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                       </svg>
                       <span className="text-sm font-medium text-gray-600">{endpoint.release_count} releases</span>
                     </div>
                     
                     <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(endpoint.status)}`}>
                        {endpoint.status}
                     </span>
                  </div>

                  <div className="mt-4 pt-1">
                    <p className="text-sm text-gray-500">Synced {getRelativeTime(endpoint.last_sync)}</p>
                  </div>
                </div>
              )
            })}

            {category === 'plugin' && (paginatedData as Mitigation[]).map(vuln => (
              <div key={`${vuln.cve_id}-${vuln.package}`} className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 hover:shadow-md transition-all bg-white">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-blue-600">{vuln.cve_id}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold border ${getSeverityColor(vuln.severity_rating)}`}>{vuln.severity_rating.toUpperCase()} {vuln.severity_score.toFixed(1)}</span>
                </div>
                <p className="text-sm text-gray-700 mb-3 line-clamp-2">{vuln.summary}</p>
                <div className="space-y-2 text-xs text-gray-600 mb-3">
                  <div><span className="font-medium">Package:</span> <span className="break-all">{vuln.package}</span></div>
                </div>
              </div>
            ))}

            {category === 'mitigations' && (paginatedData as Mitigation[]).map(mit => (
              <div key={`${mit.cve_id}-${mit.package}`} onClick={() => toggleMitigation(mit.cve_id)} className={`border rounded-lg p-4 transition-all bg-white cursor-pointer ${selectedMitigations.has(mit.cve_id) ? 'bg-blue-50 border-blue-400 shadow-md' : 'border-gray-200 hover:border-gray-400 hover:shadow-md'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedMitigations.has(mit.cve_id)} onChange={(e) => { e.stopPropagation(); toggleMitigation(mit.cve_id) }} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <h3 className="text-base font-semibold text-blue-600">{mit.cve_id}</h3>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold border ${getSeverityColor(mit.severity_rating)}`}>{mit.severity_rating.toUpperCase()}</span>
                </div>
                <p className="text-sm text-gray-700 mb-3 line-clamp-2">{mit.summary}</p>
              </div>
            ))}

            {category === 'all' && (paginatedData as ImageData[]).map((result, index) => (
              <div key={index} onClick={() => handleCardClick(result)} className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 hover:shadow-md transition-all cursor-pointer bg-white flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-blue-600 hover:underline break-words">{result.name}</h3>
                      <span className="text-sm text-gray-500 font-normal">{result.version}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{result.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mb-3 flex-wrap mt-2">
                  {result.vulnerabilities.critical > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold">
                      {result.vulnerabilities.critical} Critical
                    </span>
                  )}
                  {result.vulnerabilities.high > 0 && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-bold">
                      {result.vulnerabilities.high} High
                    </span>
                  )}
                  {result.vulnerabilities.medium > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">
                      {result.vulnerabilities.medium} Medium
                    </span>
                  )}
                  {result.vulnerabilities.low > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                      {result.vulnerabilities.low} Low
                    </span>
                  )}
                  {result.vulnerabilities.critical === 0 && 
                   result.vulnerabilities.high === 0 && 
                   result.vulnerabilities.medium === 0 && 
                   result.vulnerabilities.low === 0 && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-bold">
                      ✓ Clean
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                  <div className="flex flex-col">
                    <span className="text-gray-500">OpenSSF Score</span>
                    <span className="font-semibold text-gray-900">
                      {result.openssfScore > 0 ? result.openssfScore.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500">Dependencies</span>
                    <span className="font-semibold text-gray-900">{result.dependency_count}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500">Endpoints</span>
                    <span className="font-semibold text-gray-900">{result.syncedEndpoints}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
                  <span>Updated {result.updated}</span>
                  {result.vulnerability_count_delta !== undefined && result.vulnerability_count_delta !== 0 && (
                    <span className={`font-medium ${result.vulnerability_count_delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {result.vulnerability_count_delta > 0 ? '↑' : '↓'} {Math.abs(result.vulnerability_count_delta)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-4">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, index) => (
                  typeof page === 'number' ? (
                    <button
                      key={index}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        page === currentPage
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={index} className="px-2 text-gray-400">
                      {page}
                    </span>
                  )
                ))}
              </div>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}