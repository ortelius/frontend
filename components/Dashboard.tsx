'use client'

import React, { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts'
import { useOrg } from '@/context/OrgContext'

import { 
  graphqlQuery, 
  GET_DASHBOARD_VULNERABILITY_TREND,
  GET_MTTR_ANALYSIS,
  GET_DASHBOARD_GLOBAL_STATUS
} from '@/lib/graphql'
import { 
  GetVulnerabilityTrendResponse, 
  VulnerabilityTrend,
  GetMTTRAnalysisResponse,
  MTTRAnalysis,
  GetDashboardGlobalStatusResponse,
  DashboardGlobalStatus
} from '@/lib/types'

// --- Icons ---
import ScheduleIcon from '@mui/icons-material/Schedule'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import BugReportIcon from '@mui/icons-material/BugReport'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import RouterIcon from '@mui/icons-material/Router'
import TimerIcon from '@mui/icons-material/Timer'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

// --- Constants ---
const COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  NONE: '#9ca3af'
}

// ─────────────────────────────────────────────────────────────────────────────
// Small Multiples — panel definitions
// ─────────────────────────────────────────────────────────────────────────────
const SM_PANELS = [
  {
    key: 'critical' as keyof VulnerabilityTrend,
    label: 'CRITICAL',
    color: '#dc2626',
    gradientId: 'smGradCritical',
    panelBg: 'rgba(220,38,38,0.03)',
    borderColor: 'rgba(220,38,38,0.4)',
    labelColor: '#dc2626',
    strokeWidth: 2,
    height: 76,
    glowFilter: 'drop-shadow(0 0 3px rgba(220,38,38,0.6))',
  },
  {
    key: 'high' as keyof VulnerabilityTrend,
    label: 'HIGH',
    color: '#f97316',
    gradientId: 'smGradHigh',
    panelBg: 'transparent',
    borderColor: 'rgba(249,115,22,0.25)',
    labelColor: '#f97316',
    strokeWidth: 1.5,
    height: 76,
    glowFilter: 'none',
  },
  {
    key: 'medium' as keyof VulnerabilityTrend,
    label: 'MEDIUM',
    color: '#eab308',
    gradientId: 'smGradMedium',
    panelBg: 'transparent',
    borderColor: 'rgba(234,179,8,0.25)',
    labelColor: '#ca8a04',
    strokeWidth: 1.5,
    height: 76,
    glowFilter: 'none',
  },
  {
    key: 'low' as keyof VulnerabilityTrend,
    label: 'LOW',
    color: '#3b82f6',
    gradientId: 'smGradLow',
    panelBg: 'transparent',
    borderColor: 'rgba(59,130,246,0.25)',
    labelColor: '#3b82f6',
    strokeWidth: 1.5,
    height: 76,
    glowFilter: 'none',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Custom tooltip for small multiples
// ─────────────────────────────────────────────────────────────────────────────
const SmTooltip = ({ active, payload, label, color, severity }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${color}55`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 6,
      padding: '5px 10px',
      fontSize: 11,
      fontFamily: 'ui-monospace, monospace',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      lineHeight: 1.6,
    }}>
      <div style={{ color, fontWeight: 700 }}>{severity}: {payload[0]?.value ?? 0}</div>
      <div style={{ color: '#94a3b8' }}>
        {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single small-multiple panel
// ─────────────────────────────────────────────────────────────────────────────
const SmPanel = ({
  panel,
  data,
  formatDate,
  isLast,
}: {
  panel: typeof SM_PANELS[number]
  data: VulnerabilityTrend[]
  formatDate: (d: string) => string
  isLast: boolean
}) => {
  const maxVal = Math.max(...data.map(d => (d[panel.key] as number) ?? 0), 1)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      borderLeft: `3px solid ${panel.borderColor}`,
      background: panel.panelBg,
      borderRadius: '0 4px 4px 0',
      marginBottom: isLast ? 0 : 4,
      overflow: 'hidden',
    }}>
      {/* Label column */}
      <div style={{
        width: 60,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: '6px 8px 6px 4px',
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: panel.labelColor,
          lineHeight: 1,
        }}>
          {panel.label}
        </span>
        <span style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 8,
          color: '#94a3b8',
          lineHeight: 1,
        }}>
          {maxVal}
        </span>
        <span style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 8,
          color: '#cbd5e1',
          lineHeight: 1,
        }}>
          0
        </span>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={panel.height}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 6, left: 0, bottom: isLast ? 14 : 2 }}
          >
            <defs>
              <linearGradient id={panel.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={panel.color}
                  stopOpacity={panel.key === 'critical' ? 0.45 : 0.25}
                />
                <stop offset="100%" stopColor={panel.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="2 6"
              vertical={false}
              stroke={panel.key === 'critical' ? 'rgba(220,38,38,0.07)' : '#f1f5f9'}
            />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}
              axisLine={false}
              tickLine={false}
              minTickGap={44}
              hide={!isLast}
            />

            <YAxis
              tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}
              axisLine={false}
              tickLine={false}
              width={28}
              domain={[0, maxVal]}
              ticks={[0, maxVal]}
              tickFormatter={(v: number) => v === 0 ? '0' : v.toLocaleString()}
            />

            <Tooltip
              content={<SmTooltip color={panel.color} severity={panel.label} />}
              cursor={{ stroke: panel.color, strokeWidth: 1, strokeOpacity: 0.25, strokeDasharray: '3 3' }}
            />

            <Area
              type="monotone"
              dataKey={panel.key as string}
              stroke={panel.color}
              strokeWidth={panel.strokeWidth}
              fill={`url(#${panel.gradientId})`}
              dot={false}
              activeDot={{
                r: 3.5,
                fill: panel.color,
                stroke: '#ffffff',
                strokeWidth: 1.5,
              }}
              style={panel.key === 'critical' ? { filter: panel.glowFilter } : {}}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { selectedOrg } = useOrg()

  const [trendData, setTrendData] = useState<VulnerabilityTrend[]>([])
  const [loadingTrend, setLoadingTrend] = useState(true)
  
  const [mttrData, setMttrData] = useState<MTTRAnalysis | null>(null)
  const [loadingMttr, setLoadingMttr] = useState(true)
  
  const [globalStatus, setGlobalStatus] = useState<DashboardGlobalStatus | null>(null)
  const [loadingGlobalStatus, setLoadingGlobalStatus] = useState(true)
  
  const [error, setError] = useState<string | null>(null)

  // View mode: 'deployed' uses post-deployment-clocked metrics, 'released' uses
  // View mode: 'deployed' uses post-deployment-clocked metrics, 'released' uses
  // release-clocked metrics (root_introduced_at).
  // Auto-defaults to 'released' when no synced endpoints exist.
  // Auto-defaults to 'released' once we know there are no synced endpoints, so
  // projects like curl/jenkins (released but never deployed by maintainers) don't
  // just show a wall of misleading zeros.
  const [viewMode, setViewMode] = useState<'deployed' | 'released'>('deployed')
  const [viewModeTouched, setViewModeTouched] = useState(false)

  // 1. Fetch Metrics (MTTR) - Depends on selectedOrg
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoadingMttr(true)
        setMttrData(null)  // Clear immediately so cards don't show stale org data
        const response = await graphqlQuery<GetMTTRAnalysisResponse>(
          GET_MTTR_ANALYSIS, 
          { days: 180, org: selectedOrg || "" }
        )
        setMttrData(response.dashboardMTTR)
      } catch (err) {
        console.error('Error fetching dashboard metrics:', err)
        setError('Failed to load dashboard metrics')
      } finally {
        setLoadingMttr(false)
      }
    }
    fetchMetrics()
  }, [selectedOrg])

  // 2. Fetch Global Status - Depends on selectedOrg
  useEffect(() => {
    const fetchGlobalStatus = async () => {
      try {
        setLoadingGlobalStatus(true)
        setGlobalStatus(null)  // Clear immediately so status cards don't show stale org data
        const response = await graphqlQuery<GetDashboardGlobalStatusResponse>(
          GET_DASHBOARD_GLOBAL_STATUS,
          { org: selectedOrg || "" }
        )
        setGlobalStatus(response.dashboardGlobalStatus)
      } catch (err) {
        console.error('Error fetching global status:', err)
      } finally {
        setLoadingGlobalStatus(false)
      }
    }
    fetchGlobalStatus()
  }, [selectedOrg])

  // 3. Fetch Trend - Depends on selectedOrg
  useEffect(() => {
    const fetchTrend = async () => {
      try {
        setLoadingTrend(true)
        setTrendData([])  // Clear immediately so chart doesn't show stale org data
        const response = await graphqlQuery<GetVulnerabilityTrendResponse>(
          GET_DASHBOARD_VULNERABILITY_TREND,
          { days: 180, org: selectedOrg || "" }
        )
        
        const rawData = response.dashboardVulnerabilityTrend
        
        const firstActiveIndex = rawData.findIndex(d => 
          (d.critical + d.high + d.medium + d.low) > 0
        )

        if (firstActiveIndex > 0) {
          const startIndex = Math.max(0, firstActiveIndex - 1)
          setTrendData(rawData.slice(startIndex))
        } else {
          setTrendData(rawData)
        }

      } catch (err) {
        console.error('Error fetching trend:', err)
      } finally {
        setLoadingTrend(false)
      }
    }
    fetchTrend()
  }, [selectedOrg])

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  const noDeployedEndpoints = (mttrData?.release_impact?.deployed_releases_count ?? mttrData?.endpoint_impact?.affected_endpoints_count ?? 0) === 0

  // Auto-default to the release-based view the first time we learn this project
  // has no synced endpoints, unless the user has already picked a tab themselves.
  useEffect(() => {
    if (!viewModeTouched && mttrData && noDeployedEndpoints) {
      setViewMode('released')
    }
  }, [noDeployedEndpoints, viewModeTouched, mttrData])

  const handleViewModeChange = (mode: 'deployed' | 'released') => {
    setViewModeTouched(true)
    setViewMode(mode)
  }

  const ExecutiveCard = ({ title, value, subValue, icon: Icon, colorClass, tooltip, compliance }: any) => (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
          <Icon className={colorClass} />
        </div>
        {compliance && (
          <div className="text-[10px] text-gray-400 text-right leading-tight">
            {compliance}
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {subValue && <span className="text-xs text-gray-500">{subValue}</span>}
      </div>
      {tooltip && (
        <div className="mt-auto pt-3 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
          {tooltip}
        </div>
      )}
    </div>
  )

  if (loadingMttr || loadingGlobalStatus) {
    return (
      <div className="flex-1 p-6 bg-gray-50 h-full flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !mttrData) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg inline-block">
          <h3 className="font-bold">Error Loading Dashboard</h3>
          <p>{error || 'No data available'}</p>
        </div>
      </div>
    )
  }

  const { executive_summary, by_severity } = mttrData

  const volumeChartData = by_severity.map(s => ({
    name: s.severity,
    New: s.new_detected,
    Fixed: s.remediated
  }))

  return (
    <div className="flex h-full relative">
      <div className="flex-1 p-6 bg-gray-50 h-full space-y-8 font-sans overflow-y-auto">
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Post-Deployment OSS Vulnerability Dashboard</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold border border-blue-200">Rolling 180 Days</span>
              
              <div className="relative group">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-semibold border border-purple-200 cursor-help flex items-center gap-1">
                  <span>NIST Recommended SLA Policy</span>
                  <span className="w-1 h-1 rounded-full bg-purple-400"></span>
                  <span className="font-normal opacity-80">Crit 15d • High 30d • Med 90d • Low 365d</span>
                </span>
                
                <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-200 shadow-xl rounded-lg p-4 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <ScheduleIcon fontSize="small" className="text-purple-600" />
                    <h4 className="font-bold text-gray-900 text-sm">NIST Recommended Remediation Targets</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <div className="col-span-1 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Severity</div>
                    <div className="col-span-1 text-right font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Standard SLA</div>

                    <div className="col-span-1 font-bold text-gray-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-600"></span> Critical
                    </div>
                    <div className="col-span-1 text-right text-gray-600">15 days</div>

                    <div className="col-span-1 font-bold text-gray-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span> High
                    </div>
                    <div className="col-span-1 text-right text-gray-600">30 days</div>

                    <div className="col-span-1 font-medium text-gray-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Medium
                    </div>
                    <div className="col-span-1 text-right text-gray-600">90 days</div>

                    <div className="col-span-1 font-medium text-gray-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Low
                    </div>
                    <div className="col-span-1 text-right text-gray-600">365 days</div>
                  </div>
                  
                  <div className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400 italic">
                    Per NIST SP 800-40 Rev. 4. Clock starts at first detection on a deployed endpoint.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('deployed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === 'deployed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <RouterIcon style={{ fontSize: 14 }} />
              Deployed
            </button>
            <button
              onClick={() => handleViewModeChange('released')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === 'released' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <TimerIcon style={{ fontSize: 14 }} />
              Released
            </button>
          </div>
        </div>

        {noDeployedEndpoints && (
          <div className="flex items-center gap-2 -mt-4 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <WarningAmberIcon style={{ fontSize: 14 }} className="text-blue-500" />
            <span>
              {mttrData.release_impact ? (
                <>{mttrData.release_impact.deployed_releases_count} of {mttrData.release_impact.total_releases_count} tracked releases have synced endpoints.</>
              ) : (
                <>0 of these releases have synced endpoints.</>
              )}{' '}
              Showing release-based metrics — clock starts at <em>root_introduced_at</em>, the release a CVE first appeared in, not deployment date.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <ExecutiveCard 
            title="Total New CVEs" 
            value={executive_summary.total_new_cves}
            subValue="in period"
            icon={BugReportIcon}
            colorClass="text-red-600"
            compliance={<a href="#nist-800-218-rv1" className="text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.1</a>}
            tooltip={
              <span>
                Total vulnerabilities detected within the rolling 180-day window.<br/>
                <strong>Calculation:</strong> Σ CVEs where <em>Detected Date</em> is within last 180 days.
              </span>
            }
          />
          {viewMode !== 'released' ? (
            <ExecutiveCard 
              title="Post-Deploy CVEs" 
              value={executive_summary.post_deployment_cves}
              subValue="active open"
              icon={RouterIcon}
              colorClass="text-orange-600"
              compliance={<a href="#nist-800-218-rv1" className="text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.1</a>}
              tooltip={
                <span>
                  Currently open vulnerabilities affecting deployed endpoints.<br/>
                  <strong>Calculation:</strong> Σ Open CVEs where <em>Disclosure Date</em> &gt; <em>Deployment Date</em>.
                </span>
              }
            />
          ) : (
            <ExecutiveCard 
              title="Open at Release" 
              value={executive_summary.open_cves_release}
              subValue="active open"
              icon={RouterIcon}
              colorClass="text-orange-600"
              compliance={<a href="#nist-800-218-rv1" className="text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.1</a>}
              tooltip={
                <span>
                  Currently open vulnerabilities present in published releases, regardless of whether any release has been deployed.<br/>
                  <strong>Calculation:</strong> Total New CVEs − Total Fixed CVEs, within the rolling 180-day window.
                </span>
              }
            />
          )}
          {viewMode !== 'released' && (
            <ExecutiveCard 
              title="MTTR (Pre + Post Deploy)" 
              value={`${executive_summary.mttr_all.toFixed(1)}d`}
              subValue="avg remediation"
              icon={ScheduleIcon}
              colorClass="text-blue-600"
              compliance={<><a href="#nist-800-218-rv2" className="text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.2</a><br/><a href="#nist-800-53-si2" className="text-blue-600 underline hover:text-blue-800">NIST 800-53 SI-2</a></>}
              tooltip={
                <span>
                  Mean Time To Remediate for all endpoint CVEs (pre- and post-deployment) fixed in the last 180 days.<br/>
                  <strong>Calculation:</strong> Σ(<em>Fix Date</em> - <em>First Introduced Date</em>) / Total Fixed CVEs.<br/>
                  Clock starts at <em>root_introduced_at</em> — the first known version where the CVE was present, not re-detection on upgrade.
                </span>
              }
            />
          )}
          {viewMode === 'released' && (
            <ExecutiveCard 
              title="MTTR (Release)" 
              value={`${executive_summary.mttr_all.toFixed(1)}d`}
              subValue="avg remediation"
              icon={ScheduleIcon}
              colorClass="text-purple-600"
              compliance={<><a href="#nist-800-218-rv2" className="text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.2</a><br/><a href="#nist-800-53-si2" className="text-blue-600 underline hover:text-blue-800">NIST 800-53 SI-2</a></>}
              tooltip={
                <span>
                  Mean Time To Remediate clocked from the release a CVE was first introduced in, independent of whether it was ever deployed.<br/>
                  <strong>Calculation:</strong> Σ(<em>Fix Date</em> - <em>First Introduced Date</em>) / Total Fixed CVEs.<br/>
                  Clock starts at <em>root_introduced_at</em> — the release where the CVE first appeared.
                </span>
              }
            />
          )}
          {viewMode !== 'released' && (
            <ExecutiveCard 
              title="MTTR (Post-Deploy)" 
              value={`${executive_summary.mttr_post_deployment.toFixed(1)}d`}
              subValue=""
              icon={AccessTimeIcon}
              colorClass="text-indigo-600"
              compliance={<><a href="#nist-800-218-rv2" className="text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.2</a><br/><a href="#nist-800-190-s33" className="text-blue-600 underline hover:text-blue-800">NIST 800-190 §3.3</a></>}
              tooltip={
                <span>
                  Mean Time To Remediate for Post-Deployment CVEs only.<br/>
                  <strong>Calculation:</strong> Σ(<em>Fix Date</em> - <em>First Introduced Date</em>) / Total Fixed Post-Deploy CVEs.<br/>
                  Clock starts at <em>root_introduced_at</em> — the first known version where the CVE was present, not re-detection on upgrade.
                </span>
              }
            />
          )}
          <ExecutiveCard 
            title="% Open > SLA" 
            value={`${(viewMode === 'released' ? executive_summary.open_cves_beyond_sla_pct_release : executive_summary.open_cves_beyond_sla_pct).toFixed(1)}%`}
            subValue="compliance risk"
            icon={WarningAmberIcon}
            colorClass="text-yellow-600"
            compliance={<><a href="#nist-800-218-rv2" className="text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.2</a><br/><a href="#nist-800-190-s32" className="text-blue-600 underline hover:text-blue-800">NIST 800-190 §3.2</a></>}
            tooltip={
              <span>
                Percentage of open CVEs exceeding their severity-based SLA.<br/>
                <strong>Calculation:</strong> (Count of Open CVEs &gt; SLA Days / Total Open CVEs) * 100.<br/>
                {viewMode === 'released' && <span>Clock basis: release date (<em>root_introduced_at</em>), since no endpoints are deployed for this project.</span>}
              </span>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '400px' }}>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">Severity Breakdown & SLA Compliance</h2>
                <a href="#nist-800-218-rv2" className="text-xs text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.2</a>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-500 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3 text-center">
                      <div>{viewMode === 'released' ? 'MTTR (Release)' : 'MTTR (Days)'}</div>
                      <div className="text-xs font-normal text-gray-400 mt-1">Σ(Fix - Detect) / Fixed</div>
                    </th>
                    {viewMode !== 'released' && (
                      <th className="px-6 py-3 text-center">
                        <div>MTTR (Post)</div>
                        <div className="text-xs font-normal text-gray-400 mt-1">Σ(Fix - Detect) / Post-deploy fixed</div>
                      </th>
                    )}
                    <th className="px-6 py-3 text-center">
                      <div>% Fixed in SLA</div>
                      <div className="text-xs font-normal text-gray-400 mt-1">(Fixed ≤ SLA / Total) × 100</div>
                    </th>
                    <th className="px-6 py-3 text-center">
                      <div>Mean Age</div>
                      <div className="text-xs font-normal text-gray-400 mt-1">Σ(Now - Detect) / Open</div>
                    </th>
                    <th className="px-6 py-3 text-center">
                      <div>Oldest</div>
                      <div className="text-xs font-normal text-gray-400 mt-1">Max open age</div>
                    </th>
                    <th className="px-6 py-3 text-center text-red-600">
                      <div>% &gt; SLA</div>
                      <div className="text-xs font-normal text-gray-400 mt-1">(Open &gt; SLA / Total) × 100</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {by_severity.map((row) => (
                    <tr key={row.severity} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[row.severity as keyof typeof COLORS] || COLORS.NONE }}></span>
                        {row.severity}
                      </td>
                      <td className="px-6 py-4 text-center">{row.mttr.toFixed(1)}</td>
                      {viewMode !== 'released' && (
                        <td className="px-6 py-4 text-center font-medium text-gray-900">{row.mttr_post_deployment.toFixed(1)}</td>
                      )}
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.fixed_within_sla_pct >= 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {row.fixed_within_sla_pct.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">{(viewMode === 'released' ? row.mean_open_age_release : row.mean_open_age).toFixed(1)}d</td>
                      <td className="px-6 py-4 text-center text-gray-500">{(viewMode === 'released' ? row.oldest_open_days_release : row.oldest_open_days).toFixed(0)}d</td>
                      <td className="px-6 py-4 text-center font-bold text-red-600">
                        {(viewMode === 'released' ? row.open_beyond_sla_pct_release : row.open_beyond_sla_pct).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col" style={{ minHeight: '400px' }}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-gray-900">Volume & Flow</h2>
              <span className="text-xs text-gray-400">
                <a href="#nist-800-218-rv1" className="text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.1</a>, 
                <a href="#nist-800-218-rv2" className="text-blue-600 underline hover:text-blue-800 ml-1">RV.2</a>
              </span>
            </div>
            
            <div className="flex items-center justify-between mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div>
                <p className="text-sm text-blue-800 font-bold">Backlog Delta</p>
                <p className="text-xs text-blue-600">New - Fixed</p>
              </div>
              <div className={`text-3xl font-bold ${(viewMode === 'released' ? executive_summary.backlog_delta_release : executive_summary.backlog_delta) > 0 ? 'text-red-600' : 'text-green-600'} flex items-center`}>
                {(viewMode === 'released' ? executive_summary.backlog_delta_release : executive_summary.backlog_delta) > 0 ? <TrendingUpIcon className="mr-1"/> : <TrendingDownIcon className="mr-1"/>}
                {Math.abs(viewMode === 'released' ? executive_summary.backlog_delta_release : executive_summary.backlog_delta)}
              </div>
            </div>

            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                  <Bar dataKey="New" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Fixed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── VULNERABILITY TREND: SMALL MULTIPLES ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div
            className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col"
            style={{ minHeight: '420px' }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Vulnerability Trend (180 Days)</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">
                  Each severity band scaled independently
                </p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                <a href="#nist-800-218-rv1" className="text-blue-600 underline hover:text-blue-800">
                  NIST 800-218 RV.1
                </a>
                {' • '}
                <a href="#nist-800-137" className="text-blue-600 underline hover:text-blue-800">
                  NIST 800-137
                </a>
              </span>
            </div>

            {/* Panels */}
            <div className="flex-1 flex flex-col justify-between">
              {loadingTrend ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Loading trend...
                </div>
              ) : (
                SM_PANELS.map((panel, idx) => (
                  <SmPanel
                    key={panel.key as string}
                    panel={panel}
                    data={trendData}
                    formatDate={formatDate}
                    isLast={idx === SM_PANELS.length - 1}
                  />
                ))
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 pt-4 border-t border-gray-100 flex-wrap">
              {SM_PANELS.map(panel => (
                <div key={panel.key as string} className="flex items-center gap-1.5">
                  <div style={{
                    width: 18,
                    height: 2.5,
                    borderRadius: 2,
                    background: panel.color,
                    boxShadow: panel.key === 'critical' ? `0 0 5px ${panel.color}88` : 'none',
                  }} />
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'ui-monospace, monospace',
                    color: panel.key === 'critical' ? panel.color : '#6b7280',
                    fontWeight: panel.key === 'critical' ? 700 : 400,
                    letterSpacing: '0.04em',
                  }}>
                    {panel.label}
                  </span>
                </div>
              ))}
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontFamily: 'ui-monospace, monospace',
                color: '#9ca3af',
                fontStyle: 'italic',
              }}>
                Y-axis independent per severity
              </span>
            </div>
          </div>

          {/* Security Velocity — unchanged */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col" style={{ minHeight: '420px' }}>
            <div className="mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Security Velocity & Impact Metrics</h2>
                <p className="text-xs text-gray-500 mt-1">Remediation effectiveness and exposure trends</p>
              </div>
              <a href="#nist-800-218-rv2" className="text-xs text-blue-600 underline hover:text-blue-800">NIST 800-218 RV.2</a>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1">
              
              <ExecutiveCard
                title="Fix Velocity"
                value={(by_severity.reduce((acc, s) => acc + (s.remediated || 0), 0) / 26).toFixed(1)}
                subValue="CVEs Fixed/Week"
                icon={TrendingUpIcon}
                colorClass="text-emerald-600"
                tooltip={
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>Last 180 days:</span>
                      <span className="font-medium text-gray-900 ml-2">
                        {by_severity.reduce((acc, s) => acc + (s.remediated || 0), 0)} total
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      <strong>Calculation:</strong> Σ Remediated / 26 weeks
                    </div>
                  </div>
                }
              />
              
               <ExecutiveCard
                title="High-Risk Backlog"
                value={globalStatus?.high_risk_backlog ?? 
                       by_severity.filter(s => s.severity === 'Critical' || s.severity === 'High')
                       .reduce((acc, s) => acc + (s.open_count || 0), 0)}
                subValue="Critical + High Open"
                icon={WarningAmberIcon}
                colorClass="text-rose-600"
                tooltip={
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>Past SLA:</span>
                      <span className="font-medium text-rose-600 ml-2">
                        {by_severity.filter(s => s.severity === 'Critical' || s.severity === 'High')
                         .reduce((acc, s) => acc + (s.open_beyond_sla_count || 0), 0)} CVEs
                      </span>
                    </div>
                    {globalStatus?.high_risk_delta !== undefined && globalStatus.high_risk_delta !== 0 && (
                      <div className="flex justify-between items-center">
                        <span>30d Change:</span>
                        <span className={`font-medium ml-2 ${globalStatus.high_risk_delta > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {globalStatus.high_risk_delta > 0 ? '+' : ''}{globalStatus.high_risk_delta}
                        </span>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400">
                      <strong>Calculation:</strong> Σ Open (Critical + High)
                    </div>
                  </div>
                }
              />

              <ExecutiveCard
                title="Shift-Left Success"
                value={executive_summary.total_new_cves > 0 
                       ? ((1 - (executive_summary.post_deployment_cves / executive_summary.total_new_cves)) * 100).toFixed(1) + '%'
                       : '0.0%'}
                subValue="Caught Pre-Deploy"
                icon={CheckCircleIcon}
                colorClass="text-indigo-600"
                tooltip={
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>Pre-Deploy:</span>
                      <span className="font-medium text-gray-900 ml-2">
                        {executive_summary.total_new_cves - executive_summary.post_deployment_cves} CVEs
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      <strong>Calculation:</strong> (1 - Post-Deploy / Total) × 100
                    </div>
                  </div>
                }
              />

              <ExecutiveCard
                title="SLA Burn Rate"
                value={(() => {
                  const criticalSLA = 15;
                  const highSLA = 30;
                  const mediumSLA = 90;
                  const lowSLA = 365;
                  
                  let approaching = 0;
                  by_severity.forEach(s => {
                    const sla = s.severity === 'Critical' ? criticalSLA : 
                                s.severity === 'High' ? highSLA :
                                s.severity === 'Medium' ? mediumSLA : lowSLA;
                    const meanAge = s.mean_open_age || 0;
                    const openCount = s.open_count || 0;
                    if (meanAge >= sla - 30 && meanAge < sla) {
                      approaching += openCount;
                    }
                  });
                  return approaching;
                })()}
                subValue="Breach in 30d"
                icon={TimerIcon}
                colorClass="text-amber-600"
                tooltip={
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>Already Past:</span>
                      <span className="font-medium text-amber-600 ml-2">
                        {by_severity.reduce((acc, s) => acc + (s.open_beyond_sla_count || 0), 0)} CVEs
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      <strong>Calculation:</strong> Σ Open where (SLA - Age) ≤ 30d
                    </div>
                  </div>
                }
              />
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div className="flex flex-col">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {(by_severity.reduce((acc, s) => acc + (s.open_count || 0) * (s.mean_open_age || 0), 0) / 1000).toFixed(1)}k
                  </div>
                  <div className="text-xs font-medium uppercase text-gray-500 tracking-wide">CVE-Days Exposure</div>
                  <div className="text-xs text-gray-400 mt-1">Σ(Open × Mean Age)</div>
                </div>
                <div className="flex flex-col">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {(() => {
                      const weeklyVelocity = by_severity.reduce((acc, s) => acc + (s.remediated || 0), 0) / 26;
                      const totalOpen = by_severity.reduce((acc, s) => acc + (s.open_count || 0), 0);
                      return weeklyVelocity > 0 ? (totalOpen / weeklyVelocity).toFixed(1) : '∞';
                    })()}
                  </div>
                  <div className="text-xs font-medium uppercase text-gray-500 tracking-wide">Weeks to Clear</div>
                  <div className="text-xs text-gray-400 mt-1">Open / Weekly Velocity</div>
                </div>
                <div className="flex flex-col">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {by_severity.reduce((acc, s) => {
                      const criticalWeight = s.severity === 'Critical' ? 4 : s.severity === 'High' ? 3 : s.severity === 'Medium' ? 2 : 1;
                      return acc + (s.open_count || 0) * criticalWeight;
                    }, 0)}
                  </div>
                  <div className="text-xs font-medium uppercase text-gray-500 tracking-wide">Risk Score</div>
                  <div className="text-xs text-gray-400 mt-1">Weighted Open (C:4 H:3 M:2 L:1)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-200">
                📋 Compliance Framework Documentation
            </h2>
            <div className="space-y-8">
            <div id="nist-800-53">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded text-sm font-semibold">NIST SP 800-53 Rev. 5</span>
                Security and Privacy Controls for Information Systems
              </h3>
              <p className="text-sm text-gray-600 mb-4 italic">
                Published: December 2020 (Updated) | 
                <a href="https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  Official Source ↗
                </a>
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 border-l-4 border-indigo-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Purpose:</strong> Provides a catalog of security and privacy controls for federal information systems and organizations to protect operations, assets, individuals, and the Nation from diverse threats including hostile attacks, human errors, and natural disasters.
                </p>
              </div>
              <div className="space-y-4 ml-4">
                <div id="nist-800-53-si2" className="border-l-2 border-indigo-400 pl-4">
                  <h4 className="font-bold text-gray-800 mb-2">
                    <a href="#nist-800-53-si2" className="text-indigo-700 hover:underline">SI-2</a>: Flaw Remediation (System and Information Integrity)
                  </h4>
                  <div className="bg-indigo-50 p-3 rounded text-sm text-gray-700 mb-3">
                    <p className="mb-2"><strong>Control Requirements:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>(a)</strong> Identify, report, and correct system flaws</li>
                      <li><strong>(b)</strong> Test software and firmware updates for effectiveness and potential side effects before installation</li>
                      <li><strong>(c)</strong> Install security-relevant software and firmware updates within organization-defined time periods</li>
                      <li><strong>(d)</strong> Incorporate flaw remediation into organizational configuration management process</li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-700 mt-3"><strong>Dashboard Implementation:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li><strong>MTTR Metrics:</strong> Demonstrate time-based flaw remediation tracking</li>
                    <li><strong>SLA Compliance:</strong> Shows adherence to organization-defined time periods for remediation</li>
                  </ul>
                </div>
              </div>
            </div>

            <div id="nist-800-40" className="pt-6 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded text-sm font-semibold">NIST SP 800-40 Rev. 4</span>
                Guide to Enterprise Patch Management Planning
              </h3>
              <p className="text-sm text-gray-600 mb-4 italic">
                Published: April 2022 | 
                <a href="https://csrc.nist.gov/pubs/sp/800/40/r4/final" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  Official Source ↗
                </a>
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 border-l-4 border-purple-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Purpose:</strong> Assists organizations in understanding the importance of patch management and in developing, implementing, and maintaining an effective enterprise patch management program, including recommended remediation timelines by severity.
                </p>
              </div>
              <div className="space-y-4 ml-4">
                <div className="border-l-2 border-purple-400 pl-4">
                  <h4 className="font-bold text-gray-800 mb-2">Recommended Remediation Timelines (Table 4-1)</h4>
                  <div className="bg-purple-50 p-3 rounded text-sm text-gray-700 mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-purple-200">
                          <th className="text-left py-1 font-semibold">Severity</th>
                          <th className="text-left py-1 font-semibold">Recommended SLA</th>
                          <th className="text-left py-1 font-semibold">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="space-y-1">
                        <tr><td className="py-1 font-bold text-red-700">Critical</td><td className="py-1">15 days</td><td className="py-1 text-gray-500">Emergency patching</td></tr>
                        <tr><td className="py-1 font-bold text-orange-700">High</td><td className="py-1">30 days</td><td className="py-1 text-gray-500">Urgent patching</td></tr>
                        <tr><td className="py-1 font-medium text-yellow-700">Medium</td><td className="py-1">90 days</td><td className="py-1 text-gray-500">Standard patching cycle</td></tr>
                        <tr><td className="py-1 font-medium text-blue-700">Low</td><td className="py-1">365 days</td><td className="py-1 text-gray-500">Next annual cycle</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-gray-700 mt-3"><strong>Dashboard Implementation:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li>All SLA thresholds (Critical: 15d, High: 30d, Medium: 90d, Low: 365d) are sourced directly from this publication</li>
                    <li><strong>% Fixed in SLA</strong> and <strong>% Open &gt; SLA</strong> metrics are calculated against these thresholds</li>
                    <li><strong>SLA Burn Rate</strong> card projects upcoming SLA breaches within 30 days</li>
                  </ul>
                </div>
              </div>
            </div>

            <div id="nist-800-137" className="pt-6 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded text-sm font-semibold">NIST SP 800-137</span>
                Information Security Continuous Monitoring (ISCM)
              </h3>
              <p className="text-sm text-gray-600 mb-4 italic">
                Published: September 2011 | 
                <a href="https://csrc.nist.gov/pubs/sp/800/137/final" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  Official Source ↗
                </a>
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 border-l-4 border-teal-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Purpose:</strong> Assists organizations in developing a continuous monitoring strategy and implementing a continuous monitoring program that provides visibility into organizational assets, awareness of threats and vulnerabilities, and visibility into the effectiveness of deployed security controls.
                </p>
              </div>
              <div className="space-y-4 ml-4">
                <div className="border-l-2 border-teal-400 pl-4">
                  <h4 className="font-bold text-gray-800 mb-2">Core ISCM Concepts</h4>
                  <div className="bg-teal-50 p-3 rounded text-sm text-gray-700 mb-3">
                    <p className="mb-2"><strong>ISCM Definition:</strong></p>
                    <p className="italic mb-3">"Maintaining ongoing awareness of information security, vulnerabilities, and threats to support organizational risk management decisions."</p>
                    <p className="mb-2"><strong>Key Principles:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Ensures deployed security controls continue to be effective over time</li>
                      <li>Supports risk-based security decisions with timely, relevant, and accurate information</li>
                      <li>Maintains operations within stated organizational risk tolerances</li>
                      <li>Facilitates prioritized security response actions when controls are inadequate</li>
                      <li>Provides ongoing assurance that planned security controls are aligned with organizational risk tolerance</li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-700 mt-3"><strong>Dashboard Implementation:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li><strong>Vulnerability Trend (Small Multiples):</strong> Each severity on its own scale ensures critical CVEs are always visible, directly supporting ISCM continuous awareness requirements</li>
                    <li><strong>Real-time Metrics:</strong> Supports risk-based decision making with current security status information</li>
                    <li><strong>SLA Monitoring:</strong> Ensures security controls (remediation timelines) remain effective and within risk tolerance</li>
                    <li><strong>Severity-Based Tracking:</strong> Enables prioritization of security response actions based on risk</li>
                  </ul>
                </div>
              </div>
            </div>

            <div id="nist-800-190" className="pt-6 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded text-sm font-semibold">NIST SP 800-190</span>
                Application Container Security Guide
              </h3>
              <p className="text-sm text-gray-600 mb-4 italic">
                Published: September 2017 | 
                <a href="https://csrc.nist.gov/pubs/sp/800/190/final" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  Official Source ↗
                </a>
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 border-l-4 border-cyan-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Purpose:</strong> Explains potential security concerns associated with container technologies and provides recommendations for addressing these concerns across the container technology stack.
                </p>
              </div>
              <div className="space-y-4 ml-4">
                <div id="nist-800-190-s32" className="border-l-2 border-cyan-400 pl-4">
                  <h4 className="font-bold text-gray-800 mb-2">
                    <a href="#nist-800-190-s32" className="text-cyan-700 hover:underline">Section 3.2</a>: Registry Risks & Image Risks
                  </h4>
                  <p className="text-sm text-gray-700 mt-3"><strong>Dashboard Implementation:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li>Severity-based vulnerability tracking and SLA compliance</li>
                    <li>% Open &gt; SLA metric for container vulnerability risk assessment</li>
                  </ul>
                </div>
                <div id="nist-800-190-s33" className="border-l-2 border-cyan-400 pl-4">
                  <h4 className="font-bold text-gray-800 mb-2">
                    <a href="#nist-800-190-s33" className="text-cyan-700 hover:underline">Section 3.3</a>: Orchestrator Risks & Runtime Monitoring
                  </h4>
                  <p className="text-sm text-gray-700 mt-3"><strong>Dashboard Implementation:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li><strong>MTTR (Post-Deploy):</strong> Tracks remediation time specifically for runtime container vulnerabilities</li>
                    <li><strong>Post-Deploy CVE Monitoring:</strong> Identifies vulnerabilities in deployed container environments</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div id="nist-800-218" className="pt-6 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold">NIST SP 800-218</span>
                Secure Software Development Framework (SSDF)
              </h3>
              <p className="text-sm text-gray-600 mb-4 italic">
                Published: February 2022 | 
                <a href="https://csrc.nist.gov/pubs/sp/800/218/final" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  Official Source ↗
                </a>
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 border-l-4 border-blue-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Purpose:</strong> Provides a core set of high-level secure software development practices that can be integrated into any SDLC to help reduce vulnerabilities in released software, mitigate exploitation impact, and address root causes.
                </p>
              </div>
              <div className="space-y-6 ml-4">
                <div id="nist-800-218-rv1" className="border-l-2 border-green-400 pl-4">
                  <h4 className="font-bold text-gray-800 mb-2">
                    <a href="#nist-800-218-rv1" className="text-green-700 hover:underline">RV.1</a>: Identify and Confirm Vulnerabilities on an Ongoing Basis
                  </h4>
                  <div className="bg-green-50 p-3 rounded text-sm text-gray-700 mb-3">
                    <p className="mb-2"><strong>Official Practice Description:</strong></p>
                    <p className="italic">"Help ensure that vulnerabilities are identified more quickly so that they can be remediated more quickly in accordance with risk, reducing the window of opportunity for attackers."</p>
                  </div>
                  <p className="text-sm text-gray-700 mb-2"><strong>Tasks Include:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li><strong>RV.1.1:</strong> Gather information from software acquirers, users, and public sources on potential vulnerabilities</li>
                    <li><strong>RV.1.2:</strong> Review, analyze, and/or test the software's code to identify or confirm the presence of vulnerabilities</li>
                    <li><strong>RV.1.3:</strong> Have a policy that addresses vulnerability disclosure and remediation</li>
                  </ul>
                  <p className="text-sm text-gray-700 mt-3"><strong>Dashboard Implementation:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li><strong>Total New CVEs:</strong> Tracks ongoing vulnerability identification within 180-day rolling window</li>
                    <li><strong>Post-Deploy CVEs:</strong> Monitors vulnerabilities discovered in deployed systems (continuous monitoring)</li>
                    <li><strong>Vulnerability Trend (Small Multiples):</strong> Visualizes detection over time with each severity on its own axis — critical CVEs at 1–2 count remain fully visible alongside high/medium/low counts in the hundreds</li>
                  </ul>
                </div>

                <div id="nist-800-218-rv2" className="border-l-2 border-purple-400 pl-4">
                  <h4 className="font-bold text-gray-800 mb-2">
                    <a href="#nist-800-218-rv2" className="text-purple-700 hover:underline">RV.2</a>: Assess, Prioritize, and Remediate Vulnerabilities
                  </h4>
                  <div className="bg-purple-50 p-3 rounded text-sm text-gray-700 mb-3">
                    <p className="mb-2"><strong>Official Practice Description:</strong></p>
                    <p className="italic">"Help ensure that vulnerabilities are remediated in accordance with risk to reduce the window of opportunity for attackers."</p>
                  </div>
                  <p className="text-sm text-gray-700 mb-2"><strong>Tasks Include:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li><strong>RV.2.1:</strong> Analyze each vulnerability to gather sufficient information about risk to plan its remediation</li>
                    <li><strong>RV.2.2:</strong> Plan and implement risk responses for vulnerabilities (including SLA-based prioritization)</li>
                  </ul>
                  <p className="text-sm text-gray-700 mt-3"><strong>Dashboard Implementation:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li><strong>MTTR (Pre + Post Deploy):</strong> Measures average time to remediate all endpoint CVEs (180-day window)</li>
                    <li><strong>MTTR (Post-Deploy):</strong> Tracks remediation time for mission-critical post-deployment vulnerabilities</li>
                    <li><strong>% Fixed in SLA:</strong> Demonstrates adherence to severity-based remediation timelines</li>
                    <li><strong>% Open &gt; SLA:</strong> Identifies at-risk vulnerabilities exceeding SLA thresholds</li>
                    <li><strong>Severity Breakdown Table:</strong> Prioritizes vulnerabilities by severity with corresponding SLAs</li>
                  </ul>
                </div>

                <div id="nist-800-218-rv3" className="border-l-2 border-amber-400 pl-4">
                  <h4 className="font-bold text-gray-800 mb-2">
                    <a href="#nist-800-218-rv3" className="text-amber-700 hover:underline">RV.3</a>: Analyze Vulnerabilities to Identify Their Root Causes
                  </h4>
                  <div className="bg-amber-50 p-3 rounded text-sm text-gray-700 mb-3">
                    <p className="mb-2"><strong>Official Practice Description:</strong></p>
                    <p className="italic">"Help reduce the frequency of vulnerabilities in the future."</p>
                  </div>
                  <p className="text-sm text-gray-700 mb-2"><strong>Tasks Include:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li><strong>RV.3.1:</strong> Analyze identified vulnerabilities to determine their root causes</li>
                    <li><strong>RV.3.2:</strong> Analyze root causes over time to identify patterns</li>
                    <li><strong>RV.3.3:</strong> Review software for similar vulnerabilities to eradicate entire classes of vulnerabilities</li>
                    <li><strong>RV.3.4:</strong> Review and update the SDLC process to prevent recurrence</li>
                  </ul>
                  <p className="text-sm text-gray-700 mt-3 italic">
                    <strong>Note:</strong> Root cause analysis metrics are not currently tracked in this dashboard but represent a future enhancement opportunity.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Additional Compliance Context</h3>
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                  <strong>Executive Order 14028:</strong> This dashboard supports compliance with <a href="https://www.govinfo.gov/app/details/DCPD-202100401" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">EO 14028 "Improving the Nation's Cybersecurity"</a> (May 2021), which mandates federal agencies to implement secure software development practices aligned with <a href="#nist-800-218" className="text-blue-600 hover:underline">NIST SP 800-218</a>.
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>DoD Continuous ATO:</strong> MTTR and vulnerability tracking metrics align with Department of Defense Continuous Authorization to Operate (cATO) requirements for continuous monitoring and risk management as outlined in <a href="https://dodcio.defense.gov/Portals/0/Documents/Library/SoftwareDevSecurityClearinghouse.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">DoD Enterprise DevSecOps Reference Design</a>.
                </p>
              </div>
            </div>

            </div>
        </div>

      </div>
    </div>
  )
}