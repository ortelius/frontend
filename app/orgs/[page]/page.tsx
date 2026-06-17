'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

// Icons
import GitHubIcon from '@mui/icons-material/GitHub'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import ErrorIcon from '@mui/icons-material/Error'
import HelpIcon from '@mui/icons-material/Help'
import AddIcon from '@mui/icons-material/Add'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import SearchIcon from '@mui/icons-material/Search'
import LockIcon from '@mui/icons-material/Lock'
import PublicIcon from '@mui/icons-material/Public'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import KeyIcon from '@mui/icons-material/Key'
import StorageIcon from '@mui/icons-material/Storage'

interface WatchedRepo {
  provider: string
  owner: string
  name: string
  private: boolean
  added_by?: string
  added_at?: string
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
}

interface SearchResult {
  provider: string
  owner: string
  name: string
  full_name: string
  description: string
  html_url: string
  stars: number
  private: boolean
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
  const { user, hasRole } = useAuth()
  const { isDark } = useTheme()

  const orgName = typeof params.org === 'string' ? params.org.toLowerCase() : ''

  const [orgStatus, setOrgStatus] = useState<OrgStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Credential management
  const [credProvider, setCredProvider] = useState<'github' | 'gitlab'>('github')
  const [credToken, setCredToken] = useState('')
  const [credStatus, setCredStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [credMessage, setCredMessage] = useState('')

  // Repo search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchProvider, setSearchProvider] = useState<'github' | 'gitlab'>('github')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Watch/hide actions
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')

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
    if (user) fetchOrgStatus()
    else if (user === null) router.push('/')
  }, [user, fetchOrgStatus, router])

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credToken.trim()) return
    setCredStatus('saving')
    setCredMessage('')
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: credProvider, token: credToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setCredStatus('success')
      setCredMessage(`${credProvider} token saved (${data.token_masked}) — status: ${data.token_status}`)
      setCredToken('')
      fetchOrgStatus()
    } catch (err: any) {
      setCredStatus('error')
      setCredMessage(err.message)
    }
  }

  const handleDeleteCredential = async (provider: string) => {
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/credentials/${provider}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to remove credential')
      fetchOrgStatus()
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchResults([])
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(
        `${endpoint}/github/search?q=${encodeURIComponent(searchQuery)}&provider=${searchProvider}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setSearchResults(data.results || [])
    } catch (err: any) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const handleWatchRepo = async (repo: SearchResult) => {
    const key = `${repo.provider}/${repo.owner}/${repo.name}`
    setActionLoading(key)
    setActionMessage('')
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/tracked-repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: repo.provider,
          owner: repo.owner,
          name: repo.name,
          private: repo.private,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add favorite')
      setActionMessage(`✅ Added ${repo.full_name} to Favorites`)
      fetchOrgStatus()
    } catch (err: any) {
      setActionMessage(`❌ ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleHideRepo = async (repo: WatchedRepo) => {
    const key = `hide:${repo.provider}/${repo.owner}/${repo.name}`
    setActionLoading(key)
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/hidden-repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: repo.provider, owner: repo.owner, name: repo.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to hide')
      setActionMessage(`👁 ${repo.owner}/${repo.name} hidden from view`)
      fetchOrgStatus()
    } catch (err: any) {
      setActionMessage(`❌ ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const isRepoWatched = (result: SearchResult) =>
    orgStatus?.tracked_repos.some(
      r => r.provider === result.provider && r.owner === result.owner && r.name === result.name
    ) ?? false

  const card = {
    backgroundColor: isDark ? '#161b22' : '#ffffff',
    borderColor: isDark ? '#30363d' : '#e5e7eb',
  }
  const textPrimary = isDark ? '#f0f6fc' : '#111827'
  const textSecondary = isDark ? '#8b949e' : '#6b7280'
  const inputStyle = {
    backgroundColor: isDark ? '#0d1117' : '#ffffff',
    borderColor: isDark ? '#30363d' : '#d1d5db',
    color: isDark ? '#e6edf3' : '#111827',
  }

  const GitHubStatusBadge = () => {
    if (!orgStatus) return null
    const { github_status, token_status, token_last_validated } = orgStatus
    const configs = {
      app_connected: { label: 'App Connected', icon: CheckCircleIcon, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-900/50' },
      pat_only: { label: 'PAT Only', icon: WarningIcon, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900/50' },
      not_connected: { label: 'Not Connected', icon: ErrorIcon, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700' },
    }
    const cfg = configs[github_status]
    const Icon = cfg.icon
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${cfg.bg} ${cfg.color}`}>
        <Icon sx={{ fontSize: 16 }} />
        <span>{cfg.label}</span>
        {token_status && github_status !== 'app_connected' && (
          <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${
            token_status === 'valid' ? 'bg-green-200 dark:bg-green-900/40 text-green-800 dark:text-green-300' :
            token_status === 'expired' ? 'bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-300' :
            'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}>
            {token_status}
          </span>
        )}
      </div>
    )
  }

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
          <GitHubStatusBadge />
        </div>

        <div className="space-y-6 max-w-4xl">

          {/* ── GitHub Connection Status ── */}
          <div className="p-6 rounded-xl border shadow-sm" style={card}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: textPrimary }}>
              <GitHubIcon sx={{ fontSize: 22 }} />
              GitHub Connection
            </h2>

            {orgStatus?.github_app_connected ? (
              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/40">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  ✅ GitHub App is installed — all public and private repos are accessible. No PAT needed.
                </p>
                <a
                  href="https://github.com/settings/installations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                >
                  Manage installation on GitHub →
                </a>
              </div>
            ) : (
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/40 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Connect the GitHub App for full private + public repo access. A PAT is only needed for private repos without the app.
                </p>
              </div>
            )}

            {/* PAT Management */}
            {isOwner && (
              <div className="mt-4 space-y-4">
                <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>Personal Access Tokens (private repos)</h3>

                {/* Existing tokens */}
                <div className="flex flex-wrap gap-3">
                  {orgStatus?.github_pat_present && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm" style={card}>
                      <GitHubIcon sx={{ fontSize: 16 }} />
                      <span style={{ color: textPrimary }}>GitHub PAT</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        orgStatus.token_status === 'valid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {orgStatus.token_status || 'unverified'}
                      </span>
                      <button
                        onClick={() => handleDeleteCredential('github')}
                        className="text-red-500 hover:text-red-700 ml-1"
                        title="Remove token"
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </button>
                    </div>
                  )}
                  {orgStatus?.gitlab_pat_present && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm" style={card}>
                      <StorageIcon sx={{ fontSize: 16 }} />
                      <span style={{ color: textPrimary }}>GitLab PAT</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        orgStatus.token_status === 'valid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {orgStatus.token_status || 'unverified'}
                      </span>
                      <button
                        onClick={() => handleDeleteCredential('gitlab')}
                        className="text-red-500 hover:text-red-700 ml-1"
                        title="Remove token"
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Add token form */}
                <form onSubmit={handleSaveCredential} className="flex gap-3 items-end flex-wrap">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Provider</label>
                    <select
                      value={credProvider}
                      onChange={e => setCredProvider(e.target.value as 'github' | 'gitlab')}
                      style={inputStyle}
                      className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="github">GitHub</option>
                      <option value="gitlab">GitLab</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>
                      Personal Access Token
                    </label>
                    <input
                      type="password"
                      value={credToken}
                      onChange={e => setCredToken(e.target.value)}
                      placeholder={credProvider === 'github' ? 'ghp_...' : 'glpat-...'}
                      style={inputStyle}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={credStatus === 'saving' || !credToken}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                  >
                    <KeyIcon sx={{ fontSize: 16 }} />
                    {credStatus === 'saving' ? 'Saving...' : 'Save Token'}
                  </button>
                </form>

                {credMessage && (
                  <p className={`text-xs mt-1 ${credStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {credMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Repo Search & Favorites ── */}
          <div className="p-6 rounded-xl border shadow-sm" style={card}>
            <h2 className="text-lg font-semibold mb-1" style={{ color: textPrimary }}>Favorite Public Repositories</h2>
            <p className="text-sm mb-4" style={{ color: textSecondary }}>
              Search for a repo you deploy — e.g. <strong>nginx</strong>, <strong>curl</strong>, <strong>redis</strong>. Add it to Favorites and we’ll keep its vulnerability data fresh. Private repos require credentials configured above.
            </p>

            <form onSubmit={handleSearch} className="flex gap-3 items-end flex-wrap mb-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Provider</label>
                <select
                  value={searchProvider}
                  onChange={e => setSearchProvider(e.target.value as 'github' | 'gitlab')}
                  style={inputStyle}
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. nginx, curl/curl, grafana/grafana"
                  style={inputStyle}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
              >
                <SearchIcon sx={{ fontSize: 16 }} />
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {searchError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{searchError}</p>}

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {searchResults.map(result => {
                  const watched = isRepoWatched(result)
                  const loadKey = `${result.provider}/${result.owner}/${result.name}`
                  return (
                    <div
                      key={loadKey}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{ borderColor: isDark ? '#30363d' : '#e5e7eb', backgroundColor: isDark ? '#0d1117' : '#f9fafb' }}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={result.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate"
                          >
                            {result.full_name}
                          </a>
                          {result.private ? (
                            <LockIcon sx={{ fontSize: 12 }} className="text-gray-400 flex-shrink-0" />
                          ) : (
                            <PublicIcon sx={{ fontSize: 12 }} className="text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-xs text-gray-400">⭐ {result.stars.toLocaleString()}</span>
                        </div>
                        {result.description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: textSecondary }}>
                            {result.description}
                          </p>
                        )}
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => handleWatchRepo(result)}
                          disabled={watched || actionLoading === loadKey}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            watched
                              ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-default'
                              : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                          }`}
                        >
                          {watched ? (
                            <><CheckCircleIcon sx={{ fontSize: 14 }} /> In Favorites</>
                          ) : actionLoading === loadKey ? (
                            'Adding...'
                          ) : (
                            <><AddIcon sx={{ fontSize: 14 }} /> Add to Favorites</>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {actionMessage && (
              <p className="text-sm mt-3" style={{ color: textSecondary }}>{actionMessage}</p>
            )}
          </div>

          {/* ── Favorite Repos ── */}
          <div className="p-6 rounded-xl border shadow-sm" style={card}>
            <h2 className="text-lg font-semibold mb-1" style={{ color: textPrimary }}>
              Favorite Repositories ({orgStatus?.tracked_repos.length ?? 0})
            </h2>
            <p className="text-sm mb-4" style={{ color: textSecondary }}>
              Favorites are scanned for CVEs automatically. "Hide" removes a repo from your view but keeps it scanning.
            </p>

            {!orgStatus?.tracked_repos.length ? (
              <div className="text-center py-8 border border-dashed rounded-lg" style={{ borderColor: isDark ? '#30363d' : '#d1d5db' }}>
                <p className="text-sm" style={{ color: textSecondary }}>No favorite repos yet. Search above to add one.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orgStatus.tracked_repos.map(repo => {
                  const repoKey = `${repo.provider}/${repo.owner}/${repo.name}`
                  const hideKey = `hide:${repoKey}`
                  return (
                    <div
                      key={repoKey}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{ borderColor: isDark ? '#30363d' : '#e5e7eb', backgroundColor: isDark ? '#0d1117' : '#f9fafb' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          repo.provider === 'github'
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        }`}>
                          {repo.provider}
                        </span>
                        <span className="text-sm font-medium truncate" style={{ color: textPrimary }}>
                          {repo.owner}/{repo.name}
                        </span>
                        {repo.private ? (
                          <LockIcon sx={{ fontSize: 12 }} className="text-gray-400 flex-shrink-0" />
                        ) : (
                          <PublicIcon sx={{ fontSize: 12 }} className="text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => handleHideRepo(repo)}
                          disabled={actionLoading === hideKey}
                          title="Hide from UI (keeps scanning)"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                          <VisibilityOffIcon sx={{ fontSize: 14 }} />
                          {actionLoading === hideKey ? 'Hiding...' : 'Hide'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Hidden Repos ── */}
          {orgStatus?.hidden_repos && orgStatus.hidden_repos.length > 0 && (
            <div className="p-6 rounded-xl border shadow-sm" style={card}>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: textSecondary }}>
                <VisibilityOffIcon sx={{ fontSize: 16 }} />
                Hidden Repos — still scanned, not shown in results ({orgStatus.hidden_repos.length})
              </h2>
              <div className="space-y-1">
                {orgStatus.hidden_repos.map(key => (
                  <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: isDark ? '#0d1117' : '#f9fafb' }}>
                    <span style={{ color: textSecondary }}>{key}</span>
                    <span className="text-xs" style={{ color: textSecondary }}>
                      Search for it above to add it to Favorites again
                    </span>
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