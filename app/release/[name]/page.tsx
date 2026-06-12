'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

// --- Component Imports ---
import Sidebar from '@/components/Sidebar'
import SyncedEndpoints from '@/components/SyncedEndpoints'
import { graphqlQuery, GET_RELEASE, GET_RELEASE_TIMELINE } from '@/lib/graphql'
import { GetReleaseResponse, Release, ReleaseTimelineEntry, GetReleaseTimelineResponse } from '@/lib/types'
import { getRelativeTime } from '@/lib/dataTransform'
 
// --- Material UI Icon Imports ---
import SecurityIcon from '@mui/icons-material/Security'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import DownloadIcon from '@mui/icons-material/Download'
import WarningIcon from '@mui/icons-material/Warning'
import StarIcon from '@mui/icons-material/Star'
import LinkIcon from '@mui/icons-material/Link'
import BuildIcon from '@mui/icons-material/Build'
import AltRouteIcon from '@mui/icons-material/AltRoute'
import HistoryIcon from '@mui/icons-material/History'
import ConstructionIcon from '@mui/icons-material/Construction'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import NotificationsIcon from '@mui/icons-material/Notifications'
import { Bomb, ThreatIntelligence } from '@/components/icons'


export default function ReleaseVersionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEndpointsModalOpen, setIsEndpointsModalOpen] = useState(false)
  const [timeline, setTimeline] = useState<ReleaseTimelineEntry[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  
  const releaseVersion = params.name as string
  const version = searchParams.get('version') || 'latest'

  const [vulnerabilities, setVulnerabilities] = useState<Release['vulnerabilities']>([])
  const [packages, setPackages] = useState<Array<{ name: string; version: string; purl?: string }>>([])

  // --- Filter State ---
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(['critical', 'high', 'medium', 'low', 'clean'])
  const [packageFilter, setPackageFilter] = useState('')
  const [searchCVE, setSearchCVE] = useState('')

  useEffect(() => {
    const fetchRelease = async () => {
      try {
        setLoading(true)
        setError(null)

        let response = await graphqlQuery<GetReleaseResponse>(GET_RELEASE, { name: releaseVersion, version })
        let releaseData = response.release

        if (!releaseData) {
          setError('Version ' + version + ' not found')
          return
        }

        setRelease(releaseData)
        setVulnerabilities(releaseData.vulnerabilities)

        let pkgData: Array<{ name: string; version: string; purl?: string }> = []
        try {
          if (releaseData.sbom?.content) {
            const sbomData = JSON.parse(releaseData.sbom.content)
            const components = sbomData.components || []
            pkgData = components
              .filter((c: any) => c.type !== 'file')
              .map((c: any) => {
                let identifier = c.purl || c['bom-ref'] || c.name
                if (identifier) {
                  if (identifier.includes('/') && !identifier.startsWith('pkg:')) {
                    identifier = identifier.split('/').pop() || identifier
                  }
                  identifier = identifier.replace(/@[^@]*$/, '')
                }
                return {
                  name: identifier,
                  version: c.version || 'unknown',
                  purl: c.purl || identifier
                }
              })
          }
        } catch (e) {
          console.error('Failed to parse SBOM:', e)
        }
        setPackages(pkgData)
      } catch (err) {
        console.error('Error fetching release:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch release data')
      } finally {
        setLoading(false)
      }
    }

    if (releaseVersion) fetchRelease()
  }, [releaseVersion, version])

  // Fetch timeline separately — only needs release name, not version
  useEffect(() => {
    const fetchTimeline = async () => {
      if (!releaseVersion) return
      try {
        setTimelineLoading(true)
        const response = await graphqlQuery<GetReleaseTimelineResponse>(
          GET_RELEASE_TIMELINE,
          { name: decodeURIComponent(releaseVersion) }
        )
        setTimeline(response.releaseTimeline || [])
      } catch (err) {
        console.error('Failed to fetch release timeline:', err)
      } finally {
        setTimelineLoading(false)
      }
    }
    fetchTimeline()
  }, [releaseVersion])

  const handleFilterChange = (updater: any) => {
    const currentFilters = {
      vulnerabilityScore: selectedSeverities,
      openssfScore: [],
      name: '',
      packageFilter: packageFilter,
      searchCVE: searchCVE
    }

    let newFilters;
    if (typeof updater === 'function') {
      newFilters = updater(currentFilters)
    } else {
      newFilters = updater
    }

    if (newFilters.vulnerabilityScore) setSelectedSeverities(newFilters.vulnerabilityScore)
    if (newFilters.packageFilter !== undefined) setPackageFilter(newFilters.packageFilter)
    if (newFilters.searchCVE !== undefined) setSearchCVE(newFilters.searchCVE)
  }


  // Close popover when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const root = document.getElementById('version-popover-root')
      if (root && !root.contains(e.target as Node)) {
        const el = document.getElementById('version-popover')
        if (el) el.style.display = 'none'
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleTimelineVersionSelect = (selectedVersion: string) => {
    // releaseVersion from params.name is already decoded by Next.js — encode once
    router.push(`/release/${encodeURIComponent(decodeURIComponent(releaseVersion))}?version=${encodeURIComponent(selectedVersion)}`)
  }

  const renderLayout = (content: React.ReactNode) => (
    <div className="flex overflow-hidden bg-white w-full">
      <Sidebar 
        filters={{
          vulnerabilityScore: selectedSeverities,
          openssfScore: [],
          name: '',
          packageFilter: packageFilter,
          searchCVE: searchCVE
        }}
        setFilters={handleFilterChange}
        selectedCategory="release-detail"
      />
      <div className="flex-1 overflow-y-auto">
        {content}
      </div>
    </div>
  )

  if (loading) return renderLayout(
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading release details...</p>
      </div>
    </div>
  )

  if (error || !release) return renderLayout(
    <div className="py-12 px-6">
      <h1 className="text-2xl font-bold">Release not found</h1>
      <p className="mt-2 text-gray-600">{error || 'The requested release could not be found.'}</p>
      <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:text-blue-700">← Back to search</button>
    </div>
  )

  const combinedData: Array<{
    cve_id: string
    osv_id?: string
    severity: string
    score: number
    package: string
    version: string
    fixed_in: string
    full_purl?: string
  }> = []

  vulnerabilities
    .filter(v => selectedSeverities.includes(v.severity_rating?.toLowerCase() || 'unknown'))
    .filter(v => !searchCVE || v.cve_id.includes(searchCVE))
    .forEach(v => {
      const packageName = v.package
      if (packageFilter && !packageName.toLowerCase().includes(packageFilter.toLowerCase())) {
        return
      }
      
      combinedData.push({
        cve_id: v.cve_id,
        osv_id: v.id,
        severity: v.severity_rating?.toLowerCase() || 'unknown',
        score: v.severity_score ?? 0,
        package: packageName,
        version: v.affected_version || 'unknown',
        fixed_in: v.fixed_in?.join(', ') || '—',
        full_purl: v.full_purl
      })
    })

  if (selectedSeverities.includes('clean')) {
    packages.forEach(pkg => {
      if (packageFilter && !pkg.name.toLowerCase().includes(packageFilter.toLowerCase())) {
        return
      }

      const isVulnerable = vulnerabilities.some(v => {
        if (v.full_purl && pkg.purl) {
          const basePkgPurl = pkg.purl.split('@')[0]
          const baseVulnPurl = v.full_purl.split('@')[0]
          if (basePkgPurl === baseVulnPurl) {
            return v.affected_version === pkg.version
          }
        }
        const vulnPackageName = v.package.split('@')[0]
        return vulnPackageName === pkg.name && v.affected_version === pkg.version
      })

      if (!isVulnerable) {
        combinedData.push({
          cve_id: '—',
          severity: 'clean',
          score: 0,
          package: pkg.name,
          version: pkg.version,
          fixed_in: '—',
          full_purl: pkg.purl
        })
      }
    })
  }

  combinedData.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.package.localeCompare(b.package)
  })

  const downloadSBOM = () => {
    if (!release.sbom?.content) return
    const blob = new Blob([release.sbom.content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${release.name}-${release.version}-sbom.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const openssfScore = release.openssf_scorecard_score ?? 'N/A'
  const syncedEndpoints = release.synced_endpoint_count || 0
  const syncedEndpointsList = release.synced_endpoints || []
  const dependencyCount = release.dependency_count ?? 0

  return (
    <div className="flex overflow-hidden bg-white w-full">
      <Sidebar 
        filters={{
          vulnerabilityScore: selectedSeverities,
          openssfScore: [], 
          name: '', 
          packageFilter: packageFilter,
          searchCVE: searchCVE
        }}
        setFilters={handleFilterChange}
        selectedCategory="release-detail" 
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <SyncedEndpoints isOpen={isEndpointsModalOpen} onClose={() => setIsEndpointsModalOpen(false)} releaseName={release.name} releaseVersion={release.version} />

        <main className="p-6 space-y-6">
          
          {/* HEADER ROW — name + timeline side by side */}
          <div className="flex items-start gap-6">
            {/* Left: back + title */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <button
                onClick={() => router.back()}
                className="flex items-center text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium"
                aria-label="Go back to previous page"
              >
                <ArrowBackIcon sx={{ width: 16, height: 16 }} />
                <span className="ml-1">Back</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                {release.name} <span className="text-gray-500 font-normal">({release.version})</span>
              </h1>
            </div>

            {/* Right: version history popover */}
            {!timelineLoading && timeline.length > 1 && (
              <div className="relative flex-shrink-0" id="version-popover-root">
                <button
                  onClick={(e) => {
                    const el = document.getElementById('version-popover')
                    if (!el) return
                    if (el.style.display !== 'none') {
                      el.style.display = 'none'
                    } else {
                      const btn = e.currentTarget as HTMLButtonElement
                      const rect = btn.getBoundingClientRect()
                      el.style.top = (rect.bottom + 4) + 'px'
                      const leftPos = rect.right - 480
                      el.style.left = Math.max(8, leftPos) + 'px'
                      el.style.display = 'block'
                    }
                  }}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {timeline.length} versions
                </button>

                <div
                  id="version-popover"
                  style={{ display: 'none', position: 'fixed', zIndex: 9999, width: '480px' }}
                  className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                >
                  <div className="grid text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100 px-3 py-2" style={{ gridTemplateColumns: '1fr 72px 36px 36px 36px 36px 52px' }}>
                    <span>Version</span>
                    <span>Built</span>
                    <span className="text-red-600 text-center">Crit</span>
                    <span className="text-orange-500 text-center">High</span>
                    <span className="text-yellow-600 text-center">Med</span>
                    <span className="text-blue-600 text-center">Low</span>
                    <span className="text-right">Endpoints</span>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
                    {timeline.map((entry) => {
                      const isSelected = entry.version === version
                      return (
                        <div
                          key={entry.version}
                          onClick={() => {
                            handleTimelineVersionSelect(entry.version)
                            const el = document.getElementById('version-popover')
                            if (el) el.style.display = 'none'
                          }}
                          className={`grid items-center px-3 py-2 cursor-pointer text-xs border-b border-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          style={{ gridTemplateColumns: '1fr 72px 36px 36px 36px 36px 52px' }}
                        >
                          <span className="flex items-center gap-1.5 font-medium truncate pr-2" style={{ color: isSelected ? '#185FA5' : 'inherit' }}>
                            {isSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#185FA5', flexShrink: 0 }} />}
                            <span className="truncate">{entry.version}</span>
                            {entry.is_latest && <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1 py-0.5 rounded flex-shrink-0">LATEST</span>}
                          </span>
                          <span className="text-gray-400 text-[11px]">
                            {entry.build_date ? new Date(entry.build_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '-'}
                          </span>
                          <span className={`text-center font-medium ${entry.critical_count > 0 ? 'text-red-600' : 'text-gray-300'}`}>{entry.critical_count || '-'}</span>
                          <span className={`text-center font-medium ${entry.high_count > 0 ? 'text-orange-500' : 'text-gray-300'}`}>{entry.high_count || '-'}</span>
                          <span className={`text-center font-medium ${entry.medium_count > 0 ? 'text-yellow-600' : 'text-gray-300'}`}>{entry.medium_count || '-'}</span>
                          <span className={`text-center font-medium ${entry.low_count > 0 ? 'text-blue-500' : 'text-gray-300'}`}>{entry.low_count || '-'}</span>
                          <span className="text-right text-gray-500">{entry.endpoint_count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* SUMMARY GRID - ADDED export-card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm export-card">
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1">
                <ThreatIntelligence size={16} color="rgb(185, 28, 28)" />
                Vulnerabilities
              </p>
              <p className="font-medium text-lg text-gray-900">{vulnerabilities.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1"><SecurityIcon sx={{ width: 16, height: 16, color: 'rgb(22, 163, 74)' }} /> OpenSSF Score</p>
              <p className="font-medium text-lg text-gray-900">{openssfScore}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1"><LinkIcon sx={{ width: 16, height: 16, color: 'rgb(37, 99, 235)' }} /> Synced Endpoints</p>
              <p className="font-medium text-lg text-gray-900">{syncedEndpoints}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 flex justify-center items-center gap-1"><Inventory2Icon sx={{ width: 16, height: 16, color: 'rgb(107, 114, 128)' }} /> Packages</p>
              <p className="font-medium text-lg text-gray-900">{dependencyCount}</p>
            </div>
            
            {release.sbom?.content && (
              <div className="flex flex-col items-center justify-center">
                  <p className="text-xs text-gray-600 flex justify-center items-center gap-1">
                      <DownloadIcon sx={{ width: 16, height: 16, color: 'rgb(37, 99, 235)' }} /> SBOM
                  </p>
                  <button
                    onClick={downloadSBOM}
                    className="font-medium text-lg text-gray-900 text-blue-600 hover:text-blue-800 transition-colors bg-transparent border-none p-0 cursor-pointer"
                  >
                      Download
                  </button>
              </div>
            )}
          </div>

          {/* SYNCED ENDPOINTS SECTION - ADDED export-card */}
          <section className="mt-6 p-4 border rounded-lg bg-white shadow-sm export-card">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <LinkIcon sx={{ width: 20, height: 20, color: 'rgb(37, 99, 235)' }} /> 
              Synced Endpoints ({syncedEndpointsList.length})
            </h3>
            <div className="overflow-x-auto border rounded-lg bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[150px]">Endpoint Name</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-32">Environment</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-40">Last Sync Time</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {syncedEndpointsList.length > 0 ? (
                    syncedEndpointsList.map((endpoint, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 align-top whitespace-normal text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                          {endpoint.endpoint_name}
                        </td>
                        <td className="px-4 py-2 align-top whitespace-nowrap text-sm text-gray-700">
                          {endpoint.environment}
                        </td>
                        <td className="px-4 py-2 align-top whitespace-nowrap text-sm text-gray-700">
                          {endpoint.last_sync ? getRelativeTime(endpoint.last_sync) : '—'}
                        </td>
                        <td className="px-4 py-2 align-top whitespace-nowrap text-sm text-gray-700">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                              endpoint.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            } w-fit`}>
                            {endpoint.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center bg-white">
                        <p className="text-gray-500 font-medium text-lg">No synced endpoints found for this release.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* VULNERABILITY TABLE - ADDED export-card */}
          <div className="overflow-auto border rounded-lg max-h-96 bg-white export-card"> 
            {combinedData.length > 0 ? (
              <table className="w-full table-auto min-w-[700px]">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left border-b text-xs font-bold text-gray-700 uppercase tracking-wider">CVE ID</th>
                    <th className="px-4 py-2 text-left border-b text-xs font-bold text-gray-700 uppercase tracking-wider">Severity</th>
                    <th className="px-4 py-2 text-left border-b text-xs font-bold text-gray-700 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-2 text-left border-b text-xs font-bold text-gray-700 uppercase tracking-wider">Package</th>
                    <th className="px-4 py-2 text-left border-b text-xs font-bold text-gray-700 uppercase tracking-wider">Version</th>
                    <th className="px-4 py-2 text-left border-b text-xs font-bold text-gray-700 uppercase tracking-wider">Fixed In</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedData.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-sm">
                        {row.cve_id !== '—' ? (
                          <a
                            href={`https://osv.dev/vulnerability/${row.osv_id ?? row.cve_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {row.cve_id}
                          </a>
                        ) : '—'}
                      </td>
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
                      <td className="px-4 py-2 text-sm">{row.score > 0 ? row.score : '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 break-all">{row.package}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.version}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.fixed_in}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full table-auto min-w-[700px]">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left border-b">CVE ID</th>
                    <th className="px-4 py-2 text-left border-b">Severity</th>
                    <th className="px-4 py-2 text-left border-b">Score</th>
                    <th className="px-4 py-2 text-left border-b">Package</th>
                    <th className="px-4 py-2 text-left border-b">Version</th>
                    <th className="px-4 py-2 text-left border-b">Fixed In</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center bg-white">
                      <p className="text-gray-500 font-medium text-lg">No data found matching current filters.</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* SOURCE & BUILD SECTION - ADDED export-card */}
          <section className="mt-6 p-4 border rounded-lg bg-white shadow-sm export-card">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <BuildIcon sx={{ width: 20, height: 20, color: 'rgb(100, 116, 139)' }} />
                Source & Build Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1 text-sm text-gray-700">
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 mt-2 mb-1 flex items-center gap-2">
                    <AltRouteIcon sx={{ width: 16, height: 16, color: 'rgb(59, 130, 246)' }} />
                    Source Control
                </h4>
                <ul className="space-y-1">
                  <li><span className="font-medium">Commit:</span> {release.git_commit?.substring(0,8) || '—'}</li>
                  <li><span className="font-medium">Branch:</span> {release.git_branch || '—'}</li>
                  <li><span className="font-medium">Tag:</span> {release.git_tag || '—'}</li>
                  <li><span className="font-medium">Repo:</span> {release.git_repo || '—'}</li>
                  <li><span className="font-medium">Org:</span> {release.git_org || '—'}</li>
                  <li><span className="font-medium">Project:</span> {release.git_repo_project || '—'}</li>
                  <li className="flex gap-1 min-w-0"><span className="font-medium shrink-0">URL:</span> <a href={release.git_url || '#'} className="text-blue-600 truncate">{release.git_url || '—'}</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 mt-2 mb-1 flex items-center gap-2">
                    <Inventory2Icon sx={{ width: 16, height: 16, color: 'rgb(20, 184, 166)' }} />
                    Container Artifacts
                </h4>
                <ul className="space-y-1">
                  <li><span className="font-medium">Content SHA:</span> {release.content_sha?.substring(0,12) || '—'}</li>
                  <li><span className="font-medium">Docker Repo:</span> {release.docker_repo || '—'}</li>
                  <li><span className="font-medium">Docker Tag:</span> {release.docker_tag || '—'}</li>
                  <li><span className="font-medium">Docker SHA:</span> {release.docker_sha?.substring(0,12) || '—'}</li>
                  <li><span className="font-medium">Basename:</span> {release.basename || '—'}</li>
                  <li><span className="font-medium">Commit Verified:</span> {release.git_verify_commit !== undefined ? (release.git_verify_commit ? 'Yes' : 'No') : '—'}</li>
                  <li><span className="font-medium">Signed Off By:</span> {release.git_signed_off_by || '—'}</li>
                </ul>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 mt-2 mb-1 flex items-center gap-2">
                    <HistoryIcon sx={{ width: 16, height: 16, color: 'rgb(124, 58, 237)' }} />
                    Metrics & Timestamps
                </h4>
                <ul className="space-y-1">
                  <li><span className="font-medium">Commit Timestamp:</span> {release.git_commit_timestamp || '—'}</li>
                  <li><span className="font-medium">Commit Authors:</span> {release.git_commit_authors || '—'}</li>
                  <li><span className="font-medium">Committers Count:</span> {release.git_committerscnt || '—'}</li>
                  <li><span className="font-medium">Total Committers Count:</span> {release.git_total_committerscnt || '—'}</li>
                  <li><span className="font-medium">Contrib Percentage:</span> {release.git_contrib_percentage || '—'}</li>
                  <li><span className="font-medium">Lines Added:</span> {release.git_lines_added || '—'}</li>
                  <li><span className="font-medium">Lines Deleted:</span> {release.git_lines_deleted || '—'}</li>
                  <li><span className="font-medium">Lines Total:</span> {release.git_lines_total || '—'}</li>
                  <li><span className="font-medium">Prev Component Commit:</span> {release.git_prev_comp_commit?.substring(0,8) || '—'}</li>
                </ul>
              </div>

              <div className="lg:col-span-3 pt-4">
                <h4 className="text-md font-semibold text-gray-900 mt-2 mb-1 flex items-center gap-2">
                    <ConstructionIcon sx={{ width: 16, height: 16, color: 'rgb(249, 115, 22)' }} />
                    Build Environment
                </h4>
                <ul className="space-y-1 grid grid-cols-2 md:grid-cols-4">
                  <li><span className="font-medium">Build Date:</span> {release.build_date || '—'}</li>
                  <li><span className="font-medium">Build ID:</span> {release.build_id || '—'}</li>
                  <li><span className="font-medium">Build Number:</span> {release.build_num || '—'}</li>
                  <li><span className="font-medium">Build URL:</span> <a href={release.build_url || '#'} className="text-blue-600">{release.build_url || '—'}</a></li>
                </ul>
              </div>

            </div>
          </section>

          {/* OPENSSF SCORECARD SECTION - ADDED export-card */}
          <section className="mt-6 p-4 border rounded-lg bg-white shadow-sm export-card">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <SecurityIcon sx={{ width: 20, height: 20, color: 'rgb(22, 163, 74)' }} />
              OpenSSF Scorecard
            </h3>
            
            {release.scorecard_result ? (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  Aggregate Score: <span className="font-medium text-gray-900">{release.scorecard_result.Score || '—'}</span> (Version: {release.scorecard_result.Scorecard.Version})
                </p>
                
                <div className="overflow-x-auto border rounded-lg mt-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[150px]">Check Name</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-16">Score</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {release.scorecard_result.Checks.map((check, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 align-top whitespace-normal text-sm text-gray-900">
                            {check.Name}
                          </td>
                          <td className="px-4 py-2 align-top whitespace-nowrap text-sm text-gray-700">
                            {check.Score}
                          </td>
                          <td className="px-4 py-2 align-top text-sm text-gray-700 break-words max-w-sm">
                            {check.Reason ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-gray-500 font-medium text-lg">No OpenSSF Scorecard data available for this release.</p>
              </div>
            )}
          </section>

        </main>
      </div>
    </div>
  )
}