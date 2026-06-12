'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

// Icons
import BusinessIcon from '@mui/icons-material/Business'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import EmailIcon from '@mui/icons-material/Email'
import PersonIcon from '@mui/icons-material/Person'
import GitHubIcon from '@mui/icons-material/GitHub'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SettingsIcon from '@mui/icons-material/Settings'

export default function ProfilePage() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const router = useRouter()
  
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  
  const [githubConnected, setGithubConnected] = useState(false)
  const [isGithubExpanded, setIsGithubExpanded] = useState(false)
  const [repos, setRepos] = useState<any[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)

  // Inline repo tracking — keyed by org name
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [repoQuery, setRepoQuery] = useState('')
  const [repoProvider, setRepoProvider] = useState<'github' | 'gitlab'>('github')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [trackingRepo, setTrackingRepo] = useState<string | null>(null)
  const [trackMsg, setTrackMsg] = useState<{ org: string; msg: string; ok: boolean } | null>(null)

  // System-level tracked repos list
  const [trackedRepos, setTrackedRepos] = useState<any[]>([])
  const [loadingTracked, setLoadingTracked] = useState(false)
  const [untrackingKey, setUntrackingKey] = useState<string | null>(null)

  const fetchTrackedRepos = async () => {
    setLoadingTracked(true)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/tracked-repos`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setTrackedRepos(data.repos ?? [])
      }
    } catch (e) {
      console.error('Failed to fetch tracked repos', e)
    } finally {
      setLoadingTracked(false)
    }
  }

  const handleUntrackRepo = async (repo: any) => {
    setUntrackingKey(repo.key)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/tracked-repos/${repo.key}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        setTrackedRepos(prev => prev.filter(r => r.key !== repo.key))
      } else {
        // Show conflict message inline
        setTrackMsg({ org: 'system', msg: data.error || 'Failed to remove repo', ok: false })
      }
    } catch (e) {
      setTrackMsg({ org: 'system', msg: 'Network error', ok: false })
    } finally {
      setUntrackingKey(null)
    }
  }

  useEffect(() => {
    if (user === null) {
       router.push('/')
    } else {
        fetchProfile()
    }
  }, [user, router])

  const fetchProfile = async () => {
      try {
          const configRes = await fetch('/config')
          const config = await configRes.json()
          const restEndpoint = config.restEndpoint || 'http://localhost:3000/api/v1'
          
          const res = await fetch(`${restEndpoint}/auth/me`, { credentials: 'include' })
          if (res.ok) {
              const data = await res.json()
              let isConnected = !!data.github_connected
              
              if (isConnected) {
                  try {
                      const reposRes = await fetch(`${restEndpoint}/github/repos`, { credentials: 'include' })
                      if (reposRes.ok) {
                          const reposData = await reposRes.json()
                          if (reposData.error || (Array.isArray(reposData) && reposData.length === 0)) {
                              isConnected = false
                          } else {
                              setRepos(reposData)
                          }
                      } else {
                          isConnected = false
                      }
                  } catch (e) {
                      isConnected = false
                  }
              }
              setGithubConnected(isConnected)
          }
      } catch (e) {
          console.error("Failed to fetch profile", e)
          setGithubConnected(false)
      }
  }

  const getEndpoint = async () => {
    const res = await fetch('/config')
    const cfg = await res.json()
    return cfg.restEndpoint || 'http://localhost:3000/api/v1'
  }

  // Parse "owner/repo" or full GitHub/GitLab URL into { owner, name }
  const parseRepoInput = (input: string): { owner: string; name: string } | null => {
    input = input.trim()
    // Full URL: https://github.com/owner/repo or https://gitlab.com/owner/repo
    const urlMatch = input.match(/(?:github\.com|gitlab\.com)\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/)
    if (urlMatch) return { owner: urlMatch[1], name: urlMatch[2] }
    // Short form: owner/repo
    const shortMatch = input.match(/^([^/\s]+)\/([^/\s]+)$/)
    if (shortMatch) return { owner: shortMatch[1], name: shortMatch[2] }
    return null
  }

  const searchRepos = async () => {
    if (!repoQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    setTrackMsg(null)
    try {
      const endpoint = await getEndpoint()
      // If input looks like owner/repo or a full URL, verify it exists via the backend
      // before showing it as a result — prevents phantom cards for typos.
      const parsed = parseRepoInput(repoQuery)
      if (parsed) {
        const res = await fetch(
          `${endpoint}/github/repo?owner=${encodeURIComponent(parsed.owner)}&name=${encodeURIComponent(parsed.name)}&provider=${repoProvider}`,
          { credentials: 'include' }
        )
        if (res.ok) {
          const data = await res.json()
          setSearchResults([{
            provider: repoProvider,
            owner: parsed.owner,
            name: parsed.name,
            full_name: `${parsed.owner}/${parsed.name}`,
            description: data.description || '',
            stars: data.stargazers_count ?? data.star_count ?? 0,
            private: false,
          }])
        } else {
          const data = await res.json().catch(() => ({}))
          setTrackMsg({ org: '', msg: data.error || `${parsed.owner}/${parsed.name} not found on ${repoProvider}`, ok: false })
        }
        return
      }
      // Full-text search fallback
      const res = await fetch(
        `${endpoint}/github/search?q=${encodeURIComponent(repoQuery)}&provider=${repoProvider}`,
        { credentials: 'include' }
      )
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results || [])
      }
    } catch (e) {
      console.error('Search failed', e)
    } finally {
      setSearching(false)
    }
  }

  const handleTrackRepo = async (_orgName: string, result: any) => {
    const key = `${result.owner}/${result.name}`
    setTrackingRepo(key)
    setTrackMsg(null)
    try {
      const endpoint = await getEndpoint()
      // POST to system-level endpoint — not org-scoped.
      // The repo's native owner (curl, kubernetes, etc.) becomes its org in the dashboard.
      const res = await fetch(`${endpoint}/tracked-repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: result.provider,
          owner: result.owner,
          name: result.name,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTrackMsg({ org: _orgName, msg: `Now tracking ${key}`, ok: true })
        setSearchResults(prev => prev.filter(r => `${r.owner}/${r.name}` !== key))
        fetchTrackedRepos() // refresh the tracked list
      } else {
        setTrackMsg({ org: _orgName, msg: data.error || 'Failed to track repo', ok: false })
      }
    } catch (e) {
      setTrackMsg({ org: _orgName, msg: 'Network error', ok: false })
    } finally {
      setTrackingRepo(null)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setStatus('error')
      setMessage("New passwords do not match")
      return
    }

    setStatus('submitting')
    try {
      const configRes = await fetch('/config')
      const config = await configRes.json()
      const restEndpoint = config.restEndpoint || 'http://localhost:3000/api/v1'

      const res = await fetch(`${restEndpoint}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          old_password: passwordData.oldPassword,
          new_password: passwordData.newPassword
        }),
      })

      if (res.ok) {
        setStatus('success')
        setMessage("Password updated successfully")
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update password')
      }
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  const handleConnectGitHub = async (e: React.MouseEvent) => {
      e.stopPropagation()
      const configRes = await fetch('/config')
      const config = await configRes.json()
      const restEndpoint = config.restEndpoint || 'http://localhost:3000/api/v1'
      window.location.href = `${restEndpoint}/auth/github/login`
  }

  const fetchRepos = async () => {
      setLoadingRepos(true)
      try {
          const configRes = await fetch('/config')
          const config = await configRes.json()
          const restEndpoint = config.restEndpoint || 'http://localhost:3000/api/v1'
          
          const res = await fetch(`${restEndpoint}/github/repos`, { credentials: 'include' })
          if (res.ok) {
              const data = await res.json()
              if (!data.error) setRepos(data)
          }
      } catch (e) {
          console.error(e)
      } finally {
          setLoadingRepos(false)
      }
  }

  if (!user) return null

  const pageBackground = isDark ? 'bg-[#0d1117]' : 'bg-gray-50'
  const cardStyle = {
    backgroundColor: isDark ? '#161b22' : '#ffffff',
    borderColor: isDark ? '#30363d' : '#e5e7eb',
  }
  const inputStyle = {
    backgroundColor: isDark ? '#0d1117' : '#ffffff',
    borderColor: isDark ? '#30363d' : '#d1d5db',
    color: isDark ? '#e6edf3' : '#111827'
  }
  const textClass = isDark ? "text-[#e6edf3]" : "text-gray-900"
  const labelClass = isDark ? "text-[#8b949e]" : "text-gray-600"
  const headingClass = isDark ? "text-[#f0f6fc]" : "text-gray-900"
  const mutedClass = isDark ? "text-[#8b949e]" : "text-gray-500"

  return (
    <div className="flex overflow-hidden w-full" style={{ backgroundColor: isDark ? '#0d1117' : '#ffffff' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className={`px-8 pt-8 pb-16 ${pageBackground}`}>
          <h1 className={`text-3xl font-bold mb-8 ${headingClass}`}>User Profile</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 auto-rows-auto">
            
            {/* 1. Account Details */}
            <div className="p-6 rounded-xl border shadow-sm transition-colors flex flex-col" style={cardStyle}>
              <h2 className={`text-xl font-semibold mb-6 ${headingClass}`}>Account Details</h2>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold uppercase shadow-sm">
                  {user.username.charAt(0)}
                </div>
                <div>
                  <p className={`text-lg font-medium ${textClass}`}>{user.username}</p>
                  <p className={`text-sm ${mutedClass}`}>{user.email}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <PersonIcon className={mutedClass} sx={{ fontSize: 20, marginTop: '2px' }} />
                  <div>
                    <label className={`text-xs uppercase font-semibold tracking-wider block mb-0.5 ${labelClass}`}>Username</label>
                    <p className={`text-base font-medium ${textClass}`}>{user.username}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <EmailIcon className={mutedClass} sx={{ fontSize: 20, marginTop: '2px' }} />
                  <div>
                    <label className={`text-xs uppercase font-semibold tracking-wider block mb-0.5 ${labelClass}`}>Email Address</label>
                    <p className={`text-base font-medium ${textClass}`}>{user.email || 'No email provided'}</p>
                  </div>
                </div>

                <div className={`border-t my-4 ${isDark ? 'border-[#30363d]' : 'border-gray-100'}`}></div>

                <div>
                  <label className={`text-xs uppercase font-semibold tracking-wider block mb-3 ${labelClass}`}>
                    Organizations & Access
                  </label>

                  {/* Top-level Track Repos panel — above org list */}
                  {(user.role === 'owner' || user.role === 'admin') && user.orgs && user.orgs.length > 0 && (
                    <div className={`mb-3 rounded-lg border overflow-hidden ${isDark ? 'border-[#30363d]' : 'border-gray-200'}`}>
                      {/* Header row */}
                      <button
                        onClick={() => {
                          const opening = !expandedOrg
                          setExpandedOrg(opening ? 'open' : null)
                          setRepoQuery('')
                          setSearchResults([])
                          setTrackMsg(null)
                          if (opening) fetchTrackedRepos()
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
                          isDark ? 'bg-[#161b22] hover:bg-[#1c2128] text-[#e6edf3]' : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <SettingsIcon sx={{ fontSize: 16 }} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                          <span>Track Public Repositories</span>
                        </div>
                        {expandedOrg ? <KeyboardArrowUpIcon sx={{ fontSize: 18 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
                      </button>

                      {expandedOrg && (
                        <div className={`border-t p-4 space-y-3 ${isDark ? 'border-[#30363d] bg-[#0d1117]/60' : 'border-gray-200 bg-white'}`}>

                          {/* Explanation */}
                          <p className={`text-xs ${mutedClass}`}>
                            The repo's native org is preserved — <code className="font-mono">curl/curl</code> releases group under <code className="font-mono">curl</code> in the dashboard.
                            Any authenticated user can add a public repo. Removal is blocked while the repo is actively deployed to endpoints.
                          </p>

                          {/* Ortelius org selector + provider toggle */}
                          <div className="flex gap-2 flex-wrap">
                            {/* Provider toggle */}
                            <div className={`flex rounded-md border overflow-hidden text-xs font-medium ${isDark ? 'border-[#30363d]' : 'border-gray-200'}`}>
                              {(['github', 'gitlab'] as const).map(p => (
                                <button
                                  key={p}
                                  onClick={() => { setRepoProvider(p); setSearchResults([]) }}
                                  className={`px-3 py-1.5 capitalize transition-colors ${
                                    repoProvider === p
                                      ? isDark ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white'
                                      : isDark ? 'bg-[#161b22] text-[#8b949e] hover:text-white' : 'bg-gray-50 text-gray-500 hover:text-gray-800'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>

                            {/* Search input */}
                            <input
                              type="text"
                              value={repoQuery}
                              onChange={e => setRepoQuery(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && searchRepos()}
                              placeholder="Search name or paste URL — e.g. curl/curl"
                              className={`flex-1 min-w-0 text-sm px-3 py-1.5 rounded-md border outline-none transition-colors ${
                                isDark
                                  ? 'bg-[#0d1117] border-[#30363d] text-[#e6edf3] placeholder-[#484f58] focus:border-blue-600'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                              }`}
                            />
                            <button
                              onClick={searchRepos}
                              disabled={searching || !repoQuery.trim()}
                              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                            >
                              {searching ? '…' : 'Search'}
                            </button>
                          </div>

                          {/* Results */}
                          {searchResults.length > 0 && (
                            <div className={`rounded-md border divide-y max-h-56 overflow-y-auto ${
                              isDark ? 'border-[#30363d] divide-[#30363d]' : 'border-gray-200 divide-gray-100'
                            }`}>
                              {searchResults.map((r, i) => (
                                <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${isDark ? 'bg-[#161b22]' : 'bg-white'}`}>
                                  <div className="min-w-0">
                                    <span className={`font-semibold ${textClass}`}>{r.owner}/{r.name}</span>
                                    {r.description && (
                                      <p className={`text-xs truncate mt-0.5 ${mutedClass}`}>{r.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 ml-3 shrink-0">
                                    {r.stars > 0 && (
                                      <span className={`text-xs ${mutedClass}`}>★ {r.stars.toLocaleString()}</span>
                                    )}
                                    <button
                                      onClick={() => handleTrackRepo(
                                        expandedOrg === 'open' ? user.orgs[0] : expandedOrg,
                                        r
                                      )}
                                      disabled={trackingRepo === `${r.owner}/${r.name}`}
                                      className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                                    >
                                      {trackingRepo === `${r.owner}/${r.name}` ? '…' : '+ Track'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Feedback */}
                          {trackMsg && (
                            <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md border text-sm font-medium ${
                              trackMsg.ok
                                ? isDark
                                  ? 'bg-green-900/20 border-green-800 text-green-300'
                                  : 'bg-green-50 border-green-300 text-green-800'
                                : isDark
                                  ? 'bg-red-900/20 border-red-800 text-red-300'
                                  : 'bg-red-50 border-red-300 text-red-700'
                            }`}>
                              <span>{trackMsg.msg}</span>
                            </div>
                          )}

                          {/* Currently tracked repos */}
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-[#8b949e]' : 'text-gray-500'}`}>
                              Currently Tracked
                            </p>
                            {loadingTracked ? (
                              <p className={`text-xs ${mutedClass}`}>Loading…</p>
                            ) : trackedRepos.length === 0 ? (
                              <p className={`text-xs ${mutedClass}`}>No public repos tracked yet.</p>
                            ) : (
                              <div className={`rounded-md border divide-y max-h-48 overflow-y-auto ${isDark ? 'border-[#30363d] divide-[#30363d]' : 'border-gray-200 divide-gray-100'}`}>
                                {trackedRepos.map((r, i) => (
                                  <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${isDark ? 'bg-[#161b22]' : 'bg-white'}`}>
                                    <div className="min-w-0">
                                      <span className={`font-semibold ${textClass}`}>{r.owner}/{r.name}</span>
                                      <span className={`ml-2 text-xs ${mutedClass}`}>{r.provider}</span>
                                      {r.active_sync_count > 0 && (
                                        <span className={`ml-2 text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                          {r.active_sync_count} endpoint{r.active_sync_count !== 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleUntrackRepo(r)}
                                      disabled={untrackingKey === r.key}
                                      title={r.active_sync_count > 0 ? `Deployed to ${r.active_sync_count} endpoint(s) — remove syncs first` : 'Stop tracking'}
                                      className={`ml-3 shrink-0 text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                                        isDark
                                          ? 'border-red-800 text-red-400 hover:bg-red-900/30'
                                          : 'border-red-200 text-red-600 hover:bg-red-50'
                                      }`}
                                    >
                                      {untrackingKey === r.key ? '…' : 'Untrack'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Org list — read-only, shows role */}
                  {user.orgs && user.orgs.length > 0 ? (
                    <div className="space-y-2">
                      {user.orgs.map((org, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <BusinessIcon className={isDark ? 'text-blue-400' : 'text-blue-600'} sx={{ fontSize: 20 }} />
                            <span className={`font-medium ${textClass}`}>{org}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <VerifiedUserIcon className={isDark ? 'text-green-400' : 'text-green-600'} sx={{ fontSize: 16 }} />
                            <span className={`text-xs uppercase font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                              {user.role}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`p-4 rounded-lg border border-dashed text-center ${isDark ? 'border-[#30363d] bg-[#0d1117]' : 'border-gray-300 bg-gray-50'}`}>
                      <p className={`text-sm ${mutedClass}`}>No organizations assigned</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Change Password */}
            <div className="p-6 rounded-xl border shadow-sm transition-colors flex flex-col" style={cardStyle}>
              <h2 className={`text-xl font-semibold mb-6 ${headingClass}`}>Change Password</h2>
              
              <form onSubmit={handlePasswordChange} className="space-y-4 flex-1">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${labelClass}`}>Current Password</label>
                  <input
                    type="password"
                    required
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})}
                    style={inputStyle}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${labelClass}`}>New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    style={inputStyle}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${labelClass}`}>Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    style={inputStyle}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {message && (
                  <div className={`p-3 rounded-md text-sm font-medium ${
                    status === 'success'
                      ? (isDark ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'bg-green-50 text-green-700 border border-green-200')
                      : (isDark ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'bg-red-50 text-red-700 border border-red-200')
                  }`}>
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {status === 'submitting' ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>

            {/* 3. GitHub Integration */}
            <div className={`rounded-xl border shadow-sm transition-colors flex flex-col lg:col-span-2 w-full overflow-hidden ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-gray-200'}`}>
              <div
                onClick={() => setIsGithubExpanded(!isGithubExpanded)}
                className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <GitHubIcon sx={{ fontSize: 28 }} className={isDark ? "text-white" : "text-gray-900"} />
                  <h2 className={`text-xl font-semibold ${headingClass}`}>GitHub Integration</h2>
                </div>
                
                <div className="flex items-center gap-4">
                  {!githubConnected ? (
                    <button
                      onClick={handleConnectGitHub}
                      className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                        isDark ? 'bg-[#238636] text-white hover:bg-[#2ea043]' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      Connect GitHub Account
                    </button>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      isDark ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-green-100 text-green-800 border-green-200'
                    }`}>
                      Connected
                    </span>
                  )}
                  {isGithubExpanded ? (
                    <KeyboardArrowUpIcon className={mutedClass} />
                  ) : (
                    <KeyboardArrowDownIcon className={mutedClass} />
                  )}
                </div>
              </div>

              {isGithubExpanded && (
                <div className="px-6 pb-6">
                  {githubConnected ? (
                    <div className="space-y-6 pt-2 border-t border-gray-100 dark:border-[#30363d]">
                      <div className={`mt-4 p-4 rounded-lg text-sm border flex flex-col gap-2 ${isDark ? 'bg-blue-900/20 border-blue-800 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                        <div className="flex items-center gap-2 font-semibold">
                          <OpenInNewIcon sx={{ fontSize: 18 }} />
                          How to add more repositories
                        </div>
                        <p className="opacity-90">
                          To grant Ortelius access to additional repositories, configure the installation on GitHub directly.
                          To track public repos across any org, use <strong>Org Settings</strong> on your org card above.
                        </p>
                        <a
                          href="https://github.com/settings/installations"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-sm font-bold hover:underline w-fit"
                        >
                          Open GitHub App Settings &rarr;
                        </a>
                      </div>

                      {repos.length === 0 && !loadingRepos && (
                        <button onClick={fetchRepos} className="text-blue-600 hover:underline text-sm font-medium">
                          Refresh Repository List
                        </button>
                      )}
                      {loadingRepos && <div className="text-sm text-gray-500">Loading repositories...</div>}
                      {repos.length > 0 && (
                        <div>
                          <h3 className={`text-sm font-semibold mb-2 ${textClass}`}>Connected Repositories:</h3>
                          <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto" style={{ borderColor: isDark ? '#30363d' : '#e5e7eb' }}>
                            {repos.map(repo => (
                              <div key={repo.id} className="p-3 flex items-center gap-3 border-b last:border-0 border-gray-100 dark:border-[#30363d]">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <p className={`text-sm font-medium ${textClass}`}>{repo.full_name}</p>
                                {repo.private && <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 rounded ml-2">Private</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-gray-100 dark:border-[#30363d] text-center">
                      <p className={`text-sm ${mutedClass}`}>
                        Connect your GitHub account using the button above to sync repositories.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}