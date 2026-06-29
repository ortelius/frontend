'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

import Sidebar from '@/components/Sidebar'
import { getRelativeTime } from '@/lib/dataTransform'
import { graphqlQuery, GET_ENDPOINT_DETAILS } from '@/lib/graphql'

// --- Material UI Icon Imports ---
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import StarIcon from '@mui/icons-material/Star'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import NotificationsIcon from '@mui/icons-material/Notifications'
import WarningIcon from '@mui/icons-material/Warning'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

// --- Local SVG Icon Imports ---
import { Bomb } from '@/components/icons'

interface EndpointRelease {
  release_name: string
  release_version: string
  openssf_scorecard_score?: number
  vulnerability_count: number
  vulnerability_count_delta?: number
  dependency_count: number
  last_sync: string
  vulnerabilities: Array<{
    cve_id: string
    severity_rating: string
    severity_score: number
    package: string
    affected_version: string
    fixed_in: string[]
    full_purl?: string
  }>
}

interface EndpointDetails {
  endpoint_name: string
  endpoint_url: string
  endpoint_type: string
  environment: string
  status: string
  last_sync: string
  total_vulnerabilities: {
    critical: number
    high: number
    medium: number
    low: number
  }
  vulnerability_count_delta?: number
  releases: EndpointRelease[]
}

interface GetEndpointDetailsResponse {
  endpointDetails: EndpointDetails
}

export default function EndpointDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [endpoint, setEndpoint] = useState<EndpointDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  const endpointName = decodeURIComponent(params.name as string)

  const [filters, setFilters] = useState({
    selectedSeverities: ['critical', 'high', 'medium', 'low', 'clean'],
    packageFilter: '',
    searchCVE: ''
  })

  useEffect(() => {
    const fetchEndpoint = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await graphqlQuery<GetEndpointDetailsResponse>(
          GET_ENDPOINT_DETAILS,
          { name: endpointName }
        )

        setEndpoint(response.endpointDetails)
      } catch (err) {
        console.error('Error fetching endpoint:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch endpoint data')
      } finally {
        setLoading(false)
      }
    }

    if (endpointName) {
      fetchEndpoint()
    }
  }, [endpointName])

  const handleExportPdf = async () => {
    if (!endpoint) return
    setExportingPdf(true)
    try {
      const payload = {
        endpoint_name: endpoint.endpoint_name,
        endpoint_type: endpoint.endpoint_type,
        environment: endpoint.environment,
        last_sync: endpoint.last_sync,
        releases: (endpoint.releases || []).map(r => ({
          release_name: r.release_name,
          release_version: r.release_version,
          vulnerabilities: (r.vulnerabilities || []).map(v => ({
            cve_id: v.cve_id,
            severity_rating: v.severity_rating,
            severity_score: v.severity_score,
            package: v.package,
            affected_version: v.affected_version,
            fixed_in: v.fixed_in || [],
            full_purl: v.full_purl,
          })),
        })),
      }

      const res = await fetch('/pdf/generate-sbom-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(await res.text())

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${endpoint.endpoint_name}-sbom-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF export failed. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === 'active' || statusLower === 'running') return 'bg-green-100 text-green-800'
    if (statusLower === 'inactive' || statusLower === 'stopped') return 'bg-gray-100 text-gray-800'
    if (statusLower === 'error' || statusLower === 'failed') return 'bg-red-100 text-red-800'
    if (statusLower === 'warning') return 'bg-yellow-100 text-yellow-800'
    return 'bg-blue-100 text-blue-800'
  }

  const getEnvironmentColor = (environment: string) => {
    const envLower = environment.toLowerCase()
    if (envLower === 'production' || envLower === 'prod') return 'bg-red-100 text-red-800'
    if (envLower === 'staging' || envLower === 'stage') return 'bg-orange-100 text-orange-800'
    if (envLower === 'development' || envLower === 'dev') return 'bg-blue-100 text-blue-800'
    if (envLower === 'test' || envLower === 'testing') return 'bg-purple-100 text-purple-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <>
        <Sidebar />
        <div className="flex-1 px-6 py-12">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading endpoint details...</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (error || !endpoint) {
    return (
      <>
        <Sidebar />
        <div className="flex-1 px-6 py-12">
          <h1 className="text-2xl font-bold">Endpoint not found</h1>
          <p className="mt-2 text-gray-600">{error || 'The requested endpoint could not be found.'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            ← Back to search
          </button>
        </div>
      </>
    )
  }

  const combinedData: Array<{
    cve_id: string
    severity: string
    score: number
    package: string
    version: string
    fixed_in: string
    release_name: string
    release_version: string
    full_purl?: string
  }> = []

  endpoint.releases?.forEach(release => {
    release.vulnerabilities
      .filter(v => filters.selectedSeverities.includes(v.severity_rating?.toLowerCase() || 'unknown'))
      .filter(v => !filters.searchCVE || v.cve_id.includes(filters.searchCVE))
      .forEach(v => {
        const packageName = v.package
        if (filters.packageFilter && !packageName.toLowerCase().includes(filters.packageFilter.toLowerCase())) {
          return
        }

        combinedData.push({
          cve_id: v.cve_id,
          severity: v.severity_rating?.toLowerCase() || 'unknown',
          score: v.severity_score ?? 0,
          package: packageName,
          version: v.affected_version || 'unknown',
          fixed_in: v.fixed_in?.join(', ') || '—',
          release_name: release.release_name,
          release_version: release.release_version,
          full_purl: v.full_purl
        })
      })
  })

  combinedData.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.package.localeCompare(b.package)
  })

  const totalCount = 
    endpoint.total_vulnerabilities.critical + 
    endpoint.total_vulnerabilities.high + 
    endpoint.total_vulnerabilities.medium + 
    endpoint.total_vulnerabilities.low

  return (
    <div className="flex overflow-hidden bg-white w-full">
      <Sidebar 
        filters={{
          vulnerabilityScore: filters.selectedSeverities,
          openssfScore: [],
          name: '',
          packageFilter: filters.packageFilter,
          searchCVE: filters.searchCVE
        }}
        setFilters={(updater: any) => {
          if (typeof updater === 'function') {
            const currentFilters = {
              vulnerabilityScore: filters.selectedSeverities,
              openssfScore: [],
              name: '',
              packageFilter: filters.packageFilter,
              searchCVE: filters.searchCVE
            }
            const newFilters = updater(currentFilters)
            setFilters({
              selectedSeverities: newFilters.vulnerabilityScore || filters.selectedSeverities,
              packageFilter: newFilters.packageFilter !== undefined ? newFilters.packageFilter : filters.packageFilter,
              searchCVE: newFilters.searchCVE !== undefined ? newFilters.searchCVE : filters.searchCVE
            })
          } else {
            setFilters({
              selectedSeverities: updater.vulnerabilityScore || filters.selectedSeverities,
              packageFilter: updater.packageFilter !== undefined ? updater.packageFilter : filters.packageFilter,
              searchCVE: updater.searchCVE !== undefined ? updater.searchCVE : filters.searchCVE
            })
          }
        }}
        selectedCategory="endpoint-detail"
      />
      <div className="flex-1 px-6 py-6 overflow-y-auto">
        {/* ── Header row: back + name + badges + compliance link + PDF export button ── */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button
            onClick={() => router.back()}
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium"
            aria-label="Go back to previous page"
          >
            <ArrowBackIcon sx={{ width: 16, height: 16 }} />
            <span className="ml-1">Back</span>
          </button>

          <h1 className="text-2xl font-bold text-gray-900">{endpoint.endpoint_name}</h1>

          <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(endpoint.status)}`}>
            {endpoint.status.toUpperCase()}
          </span>
          <span className={`px-3 py-1 rounded text-sm font-medium ${getEnvironmentColor(endpoint.environment)}`}>
            {endpoint.environment.toUpperCase()}
          </span>

          {/* EO 14028 Compliance Reference Link Tag */}
          <a
            href="https://www.gsa.gov/technology/government-it-initiatives/cybersecurity/executive-order-14028"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center px-3 py-1.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors text-xs font-semibold shadow-sm"
            title="View official CISA documentation regarding Executive Order 14028 supply chain requirements"
          >
            EO 14028 Compliance
          </a>

          {/* SBOM PDF export button — right next to the compliance badge */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export aggregated SBOM as PDF"
          >
            <PictureAsPdfIcon sx={{ width: 18, height: 18 }} />
            {exportingPdf ? 'Generating PDF…' : 'Export SBOM PDF'}
          </button>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="mb-6">
            <p className="text-gray-600 mb-2">
              <span className="font-semibold">{endpoint.endpoint_url}</span>
            </p>
            <p className="text-sm text-gray-500">Type: {endpoint.endpoint_type}</p>
            <p className="text-sm text-gray-500">Last synced {getRelativeTime(endpoint.last_sync)}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-center bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1">Critical</p>
              <p className="font-medium text-lg text-red-600">{endpoint.total_vulnerabilities.critical}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1">High</p>
              <p className="font-medium text-lg text-orange-600">{endpoint.total_vulnerabilities.high}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1">Medium</p>
              <p className="font-medium text-lg text-yellow-600">{endpoint.total_vulnerabilities.medium}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1">Low</p>
              <p className="font-medium text-lg text-blue-600">{endpoint.total_vulnerabilities.low}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1">Total CVEs</p>
              <p className="font-medium text-lg text-gray-900">{totalCount}</p>
            </div>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mt-6 mb-3 flex items-center gap-2">Release Versions ({endpoint.releases?.length || 0})</h3>
        
        <div className="overflow-auto border rounded-lg max-h-96 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Release Name</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Version</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">OpenSSF Score</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Vulnerabilities</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Dependencies</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Last Sync</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {endpoint.releases?.map((release, idx) => (
                <tr key={idx} onClick={() => router.push(`/release/${encodeURIComponent(release.release_name)}?version=${encodeURIComponent(release.release_version)}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-2 text-sm text-blue-600">{release.release_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{release.release_version}</td>
                  <td className="px-4 py-2 text-sm text-right">{release.openssf_scorecard_score ?? 'N/A'}</td>
                  <td className="px-4 py-2 text-sm text-right">{release.vulnerability_count}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{release.dependency_count}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{getRelativeTime(release.last_sync)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-auto border rounded-lg max-h-96 mt-6 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">CVE ID</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Severity</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Score</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Release</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Release Version</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Package</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Package Version</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Fixed In</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {combinedData.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-700">{row.cve_id}</td>
                  <td className="px-4 py-2 text-sm">
                    {row.severity === 'clean' ? (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                        <StarIcon sx={{ width: 12, height: 12, color: 'rgb(22, 163, 74)' }} /> CLEAN
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        row.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : row.severity === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : row.severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      } flex items-center gap-1 w-fit`}>
                        {row.severity === 'critical' ? (
                            <Bomb size={12} color="rgb(185, 28, 28)" />
                        ) : 
                          row.severity === 'high' ? <WhatshotIcon sx={{ width: 12, height: 12, color: 'rgb(194, 65, 12)' }} /> : 
                          row.severity === 'medium' ? <NotificationsIcon sx={{ width: 12, height: 12, color: 'rgb(202, 138, 4)' }} /> : 
                          <WarningIcon sx={{ width: 12, height: 12, color: 'rgb(29, 78, 216)' }} />} {row.severity.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.score}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.release_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.release_version}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.package}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.version}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.fixed_in}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}