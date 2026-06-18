'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SearchIcon from '@mui/icons-material/Search'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import GitHubIcon from '@mui/icons-material/GitHub'
import LockIcon from '@mui/icons-material/Lock'
import PublicIcon from '@mui/icons-material/Public'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

interface TrackedRepo {
  key: string
  provider: string
  owner: string
  name: string
}

interface GitHubAppRepo {
  id: number
  name: string
  full_name: string
  description: string
  html_url: string
  private: boolean
}

export default function WelcomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { isDark } = useTheme()

  const [trackedRepos, setTrackedRepos] = useState<TrackedRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(true)

  const [repoQuery, setRepoQuery] = useState('')
  const [repoProvider, setRepoProvider] = useState<'github' | 'gitlab'>('github')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [trackingKey, setTrackingKey] = useState<string | null>(null)
  const [searchMsg, setSearchMsg] = useState<{ msg: string; ok: boolean } | null>(null)

  // GitHub App connect + onboard state
  const [githubConnected, setGithubConnected] = useState(false)
  const [loadingGithubStatus, setLoadingGithubStatus] = useState(true)
  const [githubRepos, setGithubRepos] = useState<GitHubAppRepo[]>([])
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())
  const [importedRepos, setImportedRepos] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (user === null) router.push('/')
  }, [user, router])

  const getEndpoint = async () => {
    const res = await fetch('/config')
    const cfg = await res.json()
    return cfg.restEndpoint || 'http://localhost:3000/api/v1'
  }

  const fetchTrackedRepos = async () => {
    setLoadingRepos(true)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/tracked-repos`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setTrackedRepos(data.repos ?? [])
      }
    } catch (e) {
      console.error('Failed to fetch favorites', e)
    } finally {
      setLoadingRepos(false)
    }
  }

  // Probing /github/repos doubles as an "is the App connected" check — a
  // non-OK response (e.g. "GitHub App not connected") just means show the
  // connect button instead of the picker.
  const fetchGithubStatus = async () => {
    setLoadingGithubStatus(true)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/github/repos`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setGithubConnected(true)
        setGithubRepos(Array.isArray(data) ? data : [])
      } else {
        setGithubConnected(false)
      }
    } catch (e) {
      console.error('Failed to check GitHub status', e)
      setGithubConnected(false)
    } finally {
      setLoadingGithubStatus(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchTrackedRepos()
      fetchGithubStatus()
    }
  }, [user])

  const handleConnectGithub = async () => {
    const endpoint = await getEndpoint()
    // return_to tells the backend to send the user back here (instead of the
    // default /profile) once the GitHub App install + authorize flow completes.
    window.location.href = `${endpoint}/auth/github/login?return_to=/welcome`
  }

  const toggleRepoSelection = (fullName: string) => {
    setSelectedRepos(prev => {
      const next = new Set(prev)
      if (next.has(fullName)) next.delete(fullName)
      else next.add(fullName)
      return next
    })
  }

  const handleImportSelected = async () => {
    if (selectedRepos.size === 0) return
    setImporting(true)
    setImportMsg(null)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/github/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repos: Array.from(selectedRepos) }),
      })
      const data = await res.json()
      if (res.ok) {
        setImportedRepos(prev => new Set([...prev, ...selectedRepos]))
        setImportMsg({ msg: data.message || `Imported ${selectedRepos.size} repo(s)`, ok: true })
        setSelectedRepos(new Set())
      } else {
        setImportMsg({ msg: data.error || 'Failed to import selected repos', ok: false })
      }
    } catch (e) {
      setImportMsg({ msg: 'Network error', ok: false })
    } finally {
      setImporting(false)
    }
  }

  const searchRepos = async () => {
    if (!repoQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    setSearchMsg(null)
    try {
      const endpoint = await getEndpoint()
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

  const handleAddFavorite = async (result: any) => {
    const key = `${result.owner}/${result.name}`
    setTrackingKey(key)
    setSearchMsg(null)
    try {
      const endpoint = await getEndpoint()
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
        setSearchMsg({ msg: `Added ${key} to Favorites`, ok: true })
        setSearchResults(prev => prev.filter(r => `${r.owner}/${r.name}` !== key))
        fetchTrackedRepos()
      } else {
        setSearchMsg({ msg: data.error || 'Failed to add favorite', ok: false })
      }
    } catch (e) {
      setSearchMsg({ msg: 'Network error', ok: false })
    } finally {
      setTrackingKey(null)
    }
  }

  if (!user) return null

  const pageBg = isDark ? 'bg-[#0d1117]' : 'bg-gray-50'
  const cardStyle = {
    backgroundColor: isDark ? '#161b22' : '#ffffff',
    borderColor: isDark ? '#30363d' : '#e5e7eb',
  }
  const headingClass = isDark ? 'text-[#f0f6fc]' : 'text-gray-900'
  const mutedClass = isDark ? 'text-[#8b949e]' : 'text-gray-500'
  const textClass = isDark ? 'text-[#e6edf3]' : 'text-gray-900'
  const inputStyle = {
    backgroundColor: isDark ? '#0d1117' : '#ffffff',
    borderColor: isDark ? '#30363d' : '#d1d5db',
    color: isDark ? '#e6edf3' : '#111827',
  }

  return (
    <div className={`flex-1 overflow-y-auto ${pageBg}`}>
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

        {/* Header */}
        <div className="text-center">
          <h1 className={`text-3xl font-bold ${headingClass}`}>Welcome to Ortelius, {user.username}!</h1>
          <p className={`mt-2 text-sm ${mutedClass}`}>
            Let's get your vulnerability dashboard set up. This only takes a minute.
          </p>
        </div>

        {/* Step 1 — default favorites already added */}
        <div className="p-6 rounded-xl border shadow-sm" style={cardStyle}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircleIcon sx={{ fontSize: 20 }} className="text-green-600" />
            <h2 className={`text-lg font-semibold ${headingClass}`}>You're already set up</h2>
          </div>
          <p className={`text-sm mb-4 ${mutedClass}`}>
            We've added a few popular public repos to your Favorites so you have real vulnerability data to explore right away.
          </p>

          {loadingRepos ? (
            <p className={`text-sm ${mutedClass}`}>Loading your favorites…</p>
          ) : trackedRepos.length === 0 ? (
            <p className={`text-sm ${mutedClass}`}>No default favorites found yet — search for one below to get started.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {trackedRepos.map(repo => (
                <span
                  key={repo.key}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                    isDark ? 'bg-[#0d1117] border-[#30363d] text-[#e6edf3]' : 'bg-gray-50 border-gray-200 text-gray-800'
                  }`}
                >
                  <GitHubIcon sx={{ fontSize: 14 }} className={mutedClass} />
                  {repo.owner}/{repo.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Step 2 — connect GitHub App to pick from repos you actually work with */}
        <div className="p-6 rounded-xl border shadow-sm" style={cardStyle}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <h2 className={`text-lg font-semibold ${headingClass}`}>
              Connect GitHub <span className={`text-sm font-normal ${mutedClass}`}>(recommended)</span>
            </h2>
            {githubConnected && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                isDark ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-green-100 text-green-800 border-green-200'
              }`}>
                <CheckCircleIcon sx={{ fontSize: 14 }} /> Connected
              </span>
            )}
          </div>
          <p className={`text-sm mb-4 ${mutedClass}`}>
            Install the GitHub App to pick repos you already have access to — including private ones — instead of searching one at a time.
          </p>

          {loadingGithubStatus ? (
            <p className={`text-sm ${mutedClass}`}>Checking GitHub connection…</p>
          ) : !githubConnected ? (
            <button
              onClick={handleConnectGithub}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isDark ? 'bg-[#238636] text-white hover:bg-[#2ea043]' : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              <GitHubIcon sx={{ fontSize: 18 }} />
              Connect GitHub Account
            </button>
          ) : githubRepos.length === 0 ? (
            <p className={`text-sm ${mutedClass}`}>
              No repositories found for this installation.{' '}
              <a href="https://github.com/settings/installations" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                Grant access to repos on GitHub <OpenInNewIcon sx={{ fontSize: 12 }} />
              </a>
            </p>
          ) : (
            <>
              <div className={`rounded-md border divide-y max-h-64 overflow-y-auto mb-3 ${isDark ? 'border-[#30363d] divide-[#30363d]' : 'border-gray-200 divide-gray-100'}`}>
                {githubRepos.map(repo => {
                  const alreadyImported = importedRepos.has(repo.full_name)
                  return (
                    <label
                      key={repo.id}
                      className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${isDark ? 'bg-[#161b22]' : 'bg-white'} ${alreadyImported ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRepos.has(repo.full_name)}
                        disabled={alreadyImported}
                        onChange={() => toggleRepoSelection(repo.full_name)}
                        className="shrink-0"
                      />
                      {repo.private ? (
                        <LockIcon sx={{ fontSize: 14 }} className={mutedClass} />
                      ) : (
                        <PublicIcon sx={{ fontSize: 14 }} className={mutedClass} />
                      )}
                      <span className={`font-medium truncate ${textClass}`}>{repo.full_name}</span>
                      {alreadyImported ? (
                        <span className="ml-auto text-xs font-semibold text-green-600 dark:text-green-400 shrink-0">Imported</span>
                      ) : repo.description ? (
                        <span className={`text-xs truncate ${mutedClass}`}>{repo.description}</span>
                      ) : null}
                    </label>
                  )
                })}
              </div>

              <button
                onClick={handleImportSelected}
                disabled={importing || selectedRepos.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {importing ? 'Importing…' : `Import ${selectedRepos.size || ''} Selected`}
              </button>

              {importMsg && (
                <p className={`text-sm mt-2 ${importMsg.ok ? (isDark ? 'text-green-400' : 'text-green-700') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                  {importMsg.msg}
                </p>
              )}
            </>
          )}
        </div>

        {/* Step 3 — optional repo search */}
        <div className="p-6 rounded-xl border shadow-sm" style={cardStyle}>
          <h2 className={`text-lg font-semibold mb-1 ${headingClass}`}>
            Or favorite a public repo by name <span className={`text-sm font-normal ${mutedClass}`}>(optional)</span>
          </h2>
          <p className={`text-sm mb-4 ${mutedClass}`}>
            Search for something you actually run in production — e.g. <strong>nginx</strong>, <strong>curl</strong>, <strong>redis</strong> — and we'll start scanning it for CVEs. Useful for public repos you don't have GitHub access to.
          </p>

          <div className="flex gap-2 flex-wrap mb-3">
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
            <input
              type="text"
              value={repoQuery}
              onChange={e => setRepoQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchRepos()}
              placeholder="Search name or owner/repo — e.g. curl/curl"
              style={inputStyle}
              className="flex-1 min-w-[200px] text-sm px-3 py-1.5 rounded-md border outline-none"
            />
            <button
              onClick={searchRepos}
              disabled={searching || !repoQuery.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              <SearchIcon sx={{ fontSize: 16 }} />
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className={`rounded-md border divide-y max-h-56 overflow-y-auto mb-3 ${isDark ? 'border-[#30363d] divide-[#30363d]' : 'border-gray-200 divide-gray-100'}`}>
              {searchResults.map((r, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${isDark ? 'bg-[#161b22]' : 'bg-white'}`}>
                  <div className="min-w-0">
                    <span className={`font-semibold ${textClass}`}>{r.owner}/{r.name}</span>
                    {r.description && <p className={`text-xs truncate mt-0.5 ${mutedClass}`}>{r.description}</p>}
                  </div>
                  <button
                    onClick={() => handleAddFavorite(r)}
                    disabled={trackingKey === `${r.owner}/${r.name}`}
                    className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium transition-colors ml-3 shrink-0"
                  >
                    {trackingKey === `${r.owner}/${r.name}` ? '…' : 'Add to Favorites'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchMsg && (
            <p className={`text-sm ${searchMsg.ok ? (isDark ? 'text-green-400' : 'text-green-700') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
              {searchMsg.msg}
            </p>
          )}
        </div>

        {/* Step 4 — deployment-location question, stubbed pending item 10 (Helm/GitOps scanner support) */}
        <div className="p-6 rounded-xl border shadow-sm opacity-60" style={cardStyle}>
          <h2 className={`text-lg font-semibold mb-1 ${headingClass}`}>
            How is this deployed? <span className={`text-sm font-normal ${mutedClass}`}>(coming soon)</span>
          </h2>
          <p className={`text-sm ${mutedClass}`}>
            We'll soon ask whether a repo ships its own software, is a GitOps config repo, or deploys via Helm — so we can
            pick up deployments our scanner can't detect automatically yet. No action needed here for now.
          </p>
        </div>

        {/* Step 5 — continue to org selection */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            Go to Organizations
            <ArrowForwardIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    </div>
  )
}