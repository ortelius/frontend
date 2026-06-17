'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Mitigation } from '@/lib/types'
import { graphqlQuery, GET_VULNERABILITIES } from '@/lib/graphql'
import { useOrg } from '@/context/OrgContext'

interface GetVulnerabilitiesResponse {
  vulnerabilities: Mitigation[]
}

export default function VulnerabilitiesPage() {
  const router = useRouter()
  const { selectedOrg } = useOrg()
  
  const [filters, setFilters] = useState({
    vulnerabilityScore: [] as string[],
    openssfScore: [] as string[],
    name: '',
    status: [] as string[],
    environment: [] as string[],
    endpointType: [] as string[],
  })

  const [vulnerabilities, setVulnerabilities] = useState<Mitigation[]>([])
  const [filteredVulnerabilities, setFilteredVulnerabilities] = useState<Mitigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVulnerabilities = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await graphqlQuery<GetVulnerabilitiesResponse>(
          GET_VULNERABILITIES,
          { limit: 1000, org: selectedOrg || "" }
        )

        setVulnerabilities(response.vulnerabilities)
        setFilteredVulnerabilities(response.vulnerabilities)
      } catch (err) {
        console.error('Error fetching vulnerabilities:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch vulnerabilities')
      } finally {
        setLoading(false)
      }
    }

    fetchVulnerabilities()
  }, [selectedOrg])

  useEffect(() => {
    let filtered = vulnerabilities

    if (filters.vulnerabilityScore.length > 0) {
      const selectedSeverities = filters.vulnerabilityScore.filter(s => s !== 'clean')
      
      if (selectedSeverities.length > 0) {
        filtered = filtered.filter(vuln => 
          selectedSeverities.some(f => vuln.severity_rating.toLowerCase() === f.toLowerCase())
        )
      }
    }

    if (filters.name) {
      const q = filters.name.toLowerCase()
      filtered = filtered.filter(vuln => 
        vuln.cve_id.toLowerCase().includes(q) || 
        vuln.summary?.toLowerCase().includes(q) ||
        vuln.package?.toLowerCase().includes(q)
      )
    }
    
    setFilteredVulnerabilities(filtered)
  }, [filters, vulnerabilities])

  // "No matches for an active filter" needs a different nudge than
  // "there's truly nothing tracked yet" — the latter points at Favorites.
  const isFiltered = filters.vulnerabilityScore.length > 0 || filters.name !== ''

  const getSeverityColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <>
        <Sidebar filters={filters} setFilters={setFilters} selectedCategory="plugin" />
        <div className="flex-1 flex items-center justify-center p-6 bg-white">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading vulnerabilities...</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Sidebar filters={filters} setFilters={setFilters} selectedCategory="plugin" />
        <div className="flex-1 p-6 bg-white">
          <div className="max-w-7xl mx-auto py-12">
            <h1 className="text-2xl font-bold text-red-600">Error loading vulnerabilities</h1>
            <p className="mt-2 text-gray-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Sidebar 
        filters={filters} 
        setFilters={setFilters} 
        selectedCategory="plugin" 
      />

      {/* Removed 'container mx-auto max-w-7xl' to remove the large left gap */}
      <div className="flex-1 px-6 py-6 overflow-y-auto bg-white">
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Vulnerabilities</h1>
          <p className="text-gray-600 mt-2">Security threats across your infrastructure</p>
          <p className="text-xs text-gray-400 mt-1">
            Showing {filteredVulnerabilities.length} result{filteredVulnerabilities.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {filteredVulnerabilities.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900">
              {isFiltered ? 'No vulnerabilities match your filters' : 'No vulnerabilities yet'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {isFiltered
                ? 'Try a different search term or clearing a filter.'
                : 'Favorite a repo from your profile to start tracking its CVEs.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVulnerabilities.map((vuln) => (
              <div key={`${vuln.cve_id}-${vuln.package}`} className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-400 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base font-semibold text-blue-600 hover:underline cursor-pointer">
                      {vuln.cve_id}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${getSeverityColor(vuln.severity_rating)}`}>
                      {vuln.severity_rating.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 line-clamp-2" title={vuln.summary}>
                    {vuln.summary || 'No summary available.'}
                  </p>
                  <div className="text-xs text-gray-600 border-t pt-3 mt-auto">
                    <div><span className="font-medium">Package:</span> <span className="break-all">{vuln.package}</span></div>
                    {vuln.affected_version && <div><span className="font-medium">Version:</span> {vuln.affected_version}</div>}
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}