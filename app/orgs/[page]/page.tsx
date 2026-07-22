'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import OrgMembers from '@/components/OrgMembers'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

// Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloudIcon from '@mui/icons-material/Cloud'
import SyncIcon from '@mui/icons-material/Sync'

interface WatchedRepo {
  provider: string
  owner: string
  name: string
  private: boolean
  added_by?: string
  added_at?: string
}

interface GKEEndpoint {
  name: string        // cluster/namespace
  endpoint_type: string
  last_sync: string | null
}

interface OrgStatus {
  org: string
  display_name: string
  github_status: 'app_connected' | 'pat_only' | 'not_connected'
  github_app_connected: boolean
  github_pat_present: boolean
  gitlab_pat_present: boolean
  token_status: string
  token_last_validated: string | null
  tracked_repos: WatchedRepo[]
  hidden_repos: string[]
  gke_endpoints: GKEEndpoint[]
}

const getRestEndpoint = async (): Promise<string> => {
  try {
    const res = await fetch('/config')
    const config = await res.json()
    return config.restEndpoint || 'http://localhost:3000/api/v1'
  } catch {
    return 'http://localhost:3000/api/v1'
  }
}

export default function OrgSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, hasRole, isLoading: authLoading } = useAuth()
  const { isDark } = useTheme()

  const orgName = typeof params.page === 'string' ? params.page.toLowerCase() : ''

  const [orgStatus, setOrgStatus] = useState<OrgStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOwner = hasRole(['owner', 'admin'])

  const fetchOrgStatus = useCallback(async () => {
    try {
      setLoading(true)
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/status`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Failed to fetch org status: ${res.status}`)
      const data = await res.json()
      setOrgStatus(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orgName])

  useEffect(() => {
    if (authLoading) return
    if (user) fetchOrgStatus()
    else router.push('/')
  }, [user, authLoading, fetchOrgStatus, router])

  const card = {
    backgroundColor: isDark ? '#161b22' : '#ffffff',
    borderColor: isDark ? '#30363d' : '#e5e7eb',
  }
  const textPrimary = isDark ? '#f0f6fc' : '#111827'
  const textSecondary = isDark ? '#8b949e' : '#6b7280'

  if (authLoading) return null
  if (!user) return null

  if (loading) return (
    <div className="flex overflow-hidden w-full" style={{ backgroundColor: isDark ? '#0d1117' : '#f9fafb' }}>
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="mt-4" style={{ color: textSecondary }}>Loading org settings...</p>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex overflow-hidden w-full">
      <Sidebar />
      <div className="flex-1 p-8">
        <p className="text-red-600">{error}</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">← Back</button>
      </div>
    </div>
  )

  return (
    <div className="flex overflow-hidden w-full" style={{ backgroundColor: isDark ? '#0d1117' : '#f9fafb' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: textPrimary }}>
              {orgStatus?.display_name || orgName}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: textSecondary }}>Organization Settings</p>
          </div>
        </div>

        <div className="space-y-6 max-w-4xl">

          {/* ── Members (always first) ── */}
          <OrgMembers orgName={orgName} isOwner={isOwner} currentUsername={user?.username} />

          {/* ── GKE Audit Log Status ── */}
          {orgStatus && orgStatus.gke_endpoints.length > 0 && (
            <div className="p-6 rounded-xl border shadow-sm" style={card}>
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2" style={{ color: textPrimary }}>
                <CloudIcon sx={{ fontSize: 22 }} />
                GKE Audit Log Integration
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50">
                  <SyncIcon sx={{ fontSize: 12 }} />
                  Active
                </span>
              </h2>
              <p className="text-sm mb-4" style={{ color: textSecondary }}>
                This org is receiving deployments from the GKE audit log collector. Configuration is managed via Terraform by your platform admin — not editable here.
              </p>
              <div className="space-y-1.5">
                {orgStatus.gke_endpoints.map(ep => (
                  <div key={ep.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: isDark ? '#0d1117' : '#f9fafb' }}>
                    <div className="flex items-center gap-2">
                      <CloudIcon sx={{ fontSize: 14 }} className="text-blue-500" />
                      <span className="font-mono text-xs" style={{ color: textPrimary }}>{ep.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{ep.endpoint_type || 'cluster'}</span>
                    </div>
                    {ep.last_sync && (
                      <span className="text-xs" style={{ color: textSecondary }}>
                        last sync {new Date(ep.last_sync).toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}