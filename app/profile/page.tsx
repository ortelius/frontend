'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { fetchFavoriteOrgs, toggleFavoriteOrgOnServer } from '@/lib/favorites'

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
import CloudIcon from '@mui/icons-material/Cloud'
import SyncIcon from '@mui/icons-material/Sync'

export default function ProfilePage() {
  const { user, hasRole } = useAuth()
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

  // Inline repo favoriting — backed by the existing tracked-repos API
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [repoQuery, setRepoQuery] = useState('')
  const [repoProvider, setRepoProvider] = useState<'github' | 'gitlab'>('github')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [trackingRepo, setTrackingRepo] = useState<string | null>(null)
  const [trackMsg, setTrackMsg] = useState<{ org: string; msg: string; ok: boolean } | null>(null)

  // User favorite repos list — backed by the existing tracked-repos API
  const [trackedRepos, setTrackedRepos] = useState<any[]>([])
  const [favoriteOrgs, setFavoriteOrgs] = useState<string[]>([])
  const [loadingTracked, setLoadingTracked] = useState(false)
  const [untrackingKey, setUntrackingKey] = useState<string | null>(null)

  // Per-org scanner config (PAT) — org rows expand to reveal this
  const [expandedOrgRow, setExpandedOrgRow] = useState<string | null>(null)
  const [scannerSectionOpen, setScannerSectionOpen] = useState<Record<string, boolean>>({})
  const [orgCredProvider, setOrgCredProvider] = useState<Record<string, 'github' | 'gitlab'>>({})
  const [orgCredToken, setOrgCredToken] = useState<Record<string, string>>({})
  const [orgCredStatus, setOrgCredStatus] = useState<Record<string, 'idle' | 'saving' | 'success' | 'error'>>({})
  const [orgCredMessage, setOrgCredMessage] = useState<Record<string, string>>({})
  const [orgStatusMap, setOrgStatusMap] = useState<Record<string, any>>({})
  const [orgStatusError, setOrgStatusError] = useState<Record<string, string>>({})
  const [loadingOrgStatus, setLoadingOrgStatus] = useState<Record<string, boolean>>({})

  // Per-org repo search + tracked repos (scanned under that org's PAT/App connection)
  const [orgRepoQuery, setOrgRepoQuery] = useState<Record<string, string>>({})
  const [orgRepoSearchResults, setOrgRepoSearchResults] = useState<Record<string, any[]>>({})
  const [orgRepoSearching, setOrgRepoSearching] = useState<Record<string, boolean>>({})
  const [orgRepoTracking, setOrgRepoTracking] = useState<string | null>(null)
  const [orgRepoHiding, setOrgRepoHiding] = useState<string | null>(null)
  const [orgRepoMsg, setOrgRepoMsg] = useState<Record<string, string>>({})

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
      console.error('Failed to fetch favorite repos', e)
    } finally {
      setLoadingTracked(false)
    }
  }

  const getRepoOwner = (repo: any) => {
    if (repo.owner) return repo.owner
    if (repo.full_name?.includes('/')) return repo.full_name.split('/')[0]
    if (repo.key?.includes('/')) return repo.key.split('/')[0]
    return ''
  }

  const favoriteTrackedRepos = trackedRepos.filter(repo => favoriteOrgs.includes(getRepoOwner(repo)))

  const ensureFavoriteOrg = async (orgName: string) => {
    if (!orgName || favoriteOrgs.includes(orgName)) return favoriteOrgs

    const updatedFavorites = await toggleFavoriteOrgOnServer(orgName)
    setFavoriteOrgs(updatedFavorites)
    return updatedFavorites
  }

  const removeFavoriteOrg = async (orgName: string) => {
    if (!orgName || !favoriteOrgs.includes(orgName)) return favoriteOrgs

    const updatedFavorites = await toggleFavoriteOrgOnServer(orgName)
    setFavoriteOrgs(updatedFavorites)
    return updatedFavorites
  }

  const handleUntrackRepo = async (repo: any) => {
    setUntrackingKey(repo.key)
    setTrackMsg(null)

    const owner = getRepoOwner(repo)

    try {
      // Favorites drive the user-visible list and org-card stars.
      // The tracked-repos backend remains the scanning implementation behind the scenes.
      await removeFavoriteOrg(owner)
      setTrackedRepos(prev => prev.filter(r => r.key !== repo.key))
      setTrackMsg({ org: 'system', msg: `Removed ${repo.owner}/${repo.name} from favorites`, ok: true })

      try {
        const endpoint = await getEndpoint()
        await fetch(`${endpoint}/tracked-repos/${repo.key}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      } catch (e) {
        console.warn('Favorite removed, but tracked repo cleanup failed', e)
      }
    } catch (e) {
      setTrackMsg({ org: 'system', msg: 'Could not remove favorite', ok: false })
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

  useEffect(() => {
    if (!user) return

    fetchFavoriteOrgs()
      .then(setFavoriteOrgs)
      .catch((e) => console.error('Failed to fetch favorites', e))
  }, [user])

  // Prefetch scan status for every org up front so collapsed rows can show
  // at-a-glance status badges (GKE Active / PAT configured) without expanding.
  useEffect(() => {
    if (!user?.orgs?.length) return
    user.orgs.forEach((orgName: string) => {
      if (!orgStatusMap[orgName] && !loadingOrgStatus[orgName]) {
        fetchOrgScanStatus(orgName)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.orgs])

  const fetchProfile = async () => {
      try {
          const configRes = await fetch('/config')
          const config = await configRes.json()
          const restEndpoint = config.restEndpoint || 'http://localhost:3000/api/v1'

          const res = await fetch(`${restEndpoint}/auth/me`, { credentials: 'include' })
          if (res.ok) {
              const data = await res.json()
              // github_connected from /auth/me is the source of truth for whether a
              // GitHub App/OAuth connection exists. The /github/repos call below is
              // only used to populate the repo list for display — an empty or failed
              // repos fetch (e.g. no repos granted to the App yet, transient API error)
              // does NOT mean the connection itself is gone, so it must not downgrade
              // the connection status.
              const isConnected = !!data.github_connected
              setGithubConnected(isConnected)

              if (isConnected) {
                  try {
                      const reposRes = await fetch(`${restEndpoint}/github/repos`, { credentials: 'include' })
                      if (reposRes.ok) {
                          const reposData = await reposRes.json()
                          if (!reposData.error) {
                              setRepos(Array.isArray(reposData) ? reposData : [])
                          } else {
                              console.warn('GitHub repos fetch returned an error, connection status unaffected:', reposData.error)
                              setRepos([])
                          }
                      } else {
                          console.warn(`GitHub repos fetch failed (${reposRes.status}), connection status unaffected`)
                          setRepos([])
                      }
                  } catch (e) {
                      console.warn('GitHub repos fetch threw, connection status unaffected', e)
                      setRepos([])
                  }
              }
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

  // Per-org scanner config helpers — mirrors the old org-settings credential flow,
  // scoped per org row instead of a single page.
  const fetchOrgScanStatus = async (orgName: string) => {
    setLoadingOrgStatus(prev => ({ ...prev, [orgName]: true }))
    setOrgStatusError(prev => ({ ...prev, [orgName]: '' }))
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/orgs/${encodeURIComponent(orgName)}/status`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setOrgStatusMap(prev => ({ ...prev, [orgName]: data }))
      } else {
        const data = await res.json().catch(() => ({}))
        setOrgStatusError(prev => ({ ...prev, [orgName]: data.error || `Failed to load scan status (${res.status})` }))
      }
    } catch (e: any) {
      console.error(`Failed to fetch scan status for ${orgName}`, e)
      setOrgStatusError(prev => ({ ...prev, [orgName]: 'Network error — could not load scan status' }))
    } finally {
      setLoadingOrgStatus(prev => ({ ...prev, [orgName]: false }))
    }
  }

  const handleToggleOrgRow = (orgName: string) => {
    const opening = expandedOrgRow !== orgName
    setExpandedOrgRow(opening ? orgName : null)
    if (opening && !orgStatusMap[orgName]) {
      fetchOrgScanStatus(orgName)
    }
  }

  const handleSaveOrgCredential = async (orgName: string, e: React.FormEvent) => {
    e.preventDefault()
    const token = orgCredToken[orgName]?.trim()
    if (!token) return
    const provider = orgCredProvider[orgName] || 'github'
    setOrgCredStatus(prev => ({ ...prev, [orgName]: 'saving' }))
    setOrgCredMessage(prev => ({ ...prev, [orgName]: '' }))
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/orgs/${encodeURIComponent(orgName)}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setOrgCredStatus(prev => ({ ...prev, [orgName]: 'success' }))
      setOrgCredMessage(prev => ({ ...prev, [orgName]: `${provider} token saved — status: ${data.token_status}` }))
      setOrgCredToken(prev => ({ ...prev, [orgName]: '' }))
      fetchOrgScanStatus(orgName)
    } catch (err: any) {
      setOrgCredStatus(prev => ({ ...prev, [orgName]: 'error' }))
      setOrgCredMessage(prev => ({ ...prev, [orgName]: err.message }))
    }
  }

  const handleDeleteOrgCredential = async (orgName: string, provider: string) => {
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/orgs/${encodeURIComponent(orgName)}/credentials/${encodeURIComponent(provider)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to remove credential')
      fetchOrgScanStatus(orgName)
    } catch (err: any) {
      setOrgCredMessage(prev => ({ ...prev, [orgName]: `Error: ${err.message}` }))
    }
  }

  const handleOrgRepoSearch = async (orgName: string) => {
    const query = orgRepoQuery[orgName]?.trim()
    if (!query) return
    const provider = orgCredProvider[orgName] || 'github'
    setOrgRepoSearching(prev => ({ ...prev, [orgName]: true }))
    setOrgRepoMsg(prev => ({ ...prev, [orgName]: '' }))
    setOrgRepoSearchResults(prev => ({ ...prev, [orgName]: [] }))
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(
        `${endpoint}/github/search?q=${encodeURIComponent(query)}&provider=${provider}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setOrgRepoSearchResults(prev => ({ ...prev, [orgName]: data.results || [] }))
    } catch (err: any) {
      setOrgRepoMsg(prev => ({ ...prev, [orgName]: err.message }))
    } finally {
      setOrgRepoSearching(prev => ({ ...prev, [orgName]: false }))
    }
  }

  const handleOrgWatchRepo = async (orgName: string, repo: any) => {
    const key = `${repo.provider}/${repo.owner}/${repo.name}`
    setOrgRepoTracking(key)
    setOrgRepoMsg(prev => ({ ...prev, [orgName]: '' }))
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/orgs/${encodeURIComponent(orgName)}/tracked-repos`, {
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
      if (!res.ok) throw new Error(data.error || 'Failed to add repo')
      setOrgRepoMsg(prev => ({ ...prev, [orgName]: `Added ${repo.full_name}` }))
      setOrgRepoSearchResults(prev => ({
        ...prev,
        [orgName]: (prev[orgName] || []).filter(r => `${r.provider}/${r.owner}/${r.name}` !== key),
      }))
      fetchOrgScanStatus(orgName)
    } catch (err: any) {
      setOrgRepoMsg(prev => ({ ...prev, [orgName]: err.message }))
    } finally {
      setOrgRepoTracking(null)
    }
  }

  const handleOrgHideRepo = async (orgName: string, repo: any) => {
    const key = `hide:${repo.provider}/${repo.owner}/${repo.name}`
    setOrgRepoHiding(key)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/orgs/${encodeURIComponent(orgName)}/hidden-repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: repo.provider, owner: repo.owner, name: repo.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to hide')
      setOrgRepoMsg(prev => ({ ...prev, [orgName]: `${repo.owner}/${repo.name} hidden` }))
      fetchOrgScanStatus(orgName)
    } catch (err: any) {
      setOrgRepoMsg(prev => ({ ...prev, [orgName]: err.message }))
    } finally {
      setOrgRepoHiding(null)
    }
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
      // UI calls this adding a favorite. The existing tracked-repos backend
      // ensures the repo is watched/scanned behind the scenes.
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
        await ensureFavoriteOrg(result.owner)
        setTrackMsg({ org: _orgName, msg: `Added ${key} to favorites`, ok: true })
        setSearchResults(prev => prev.filter(r => `${r.owner}/${r.name}` !== key))
        fetchTrackedRepos() // refresh the favorites list
      } else {
        setTrackMsg({ org: _orgName, msg: data.error || 'Failed to add favorite', ok: false })
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

  // Mirrors backend route gating: credentials + tracked-repos require owner;
  // hidden-repos allows owner or admin.
  const canManageOrgCredentials = hasRole(['owner'])
  const canHideOrgRepos = hasRole(['owner', 'admin'])

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

                  {/* Top-level Favorite Repos panel — above org list */}
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
                          <span>Favorite Public Repositories</span>
                        </div>
                        {expandedOrg ? <KeyboardArrowUpIcon sx={{ fontSize: 18 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
                      </button>

                      {expandedOrg && (
                        <div className={`border-t p-4 space-y-3 ${isDark ? 'border-[#30363d] bg-[#0d1117]/60' : 'border-gray-200 bg-white'}`}>

                          {/* Explanation */}
                          <p className={`text-xs ${mutedClass}`}>
                            The repo's native org is preserved — <code className="font-mono">curl/curl</code> releases group under <code className="font-mono">curl</code> in the dashboard.
                            Favoriting a public repo automatically keeps it watched and scanned behind the scenes. Removing a favorite only removes it from your list; removal may be blocked while the repo is actively deployed to endpoints.
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
                                      {trackingRepo === `${r.owner}/${r.name}` ? '…' : 'Add to Favorites'}
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

                          {/* Favorite repos */}
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-[#8b949e]' : 'text-gray-500'}`}>
                              Favorites
                            </p>
                            {loadingTracked ? (
                              <p className={`text-xs ${mutedClass}`}>Loading…</p>
                            ) : favoriteTrackedRepos.length === 0 ? (
                              <p className={`text-xs ${mutedClass}`}>No favorite public repos yet.</p>
                            ) : (
                              <div className={`rounded-md border divide-y max-h-48 overflow-y-auto ${isDark ? 'border-[#30363d] divide-[#30363d]' : 'border-gray-200 divide-gray-100'}`}>
                                {favoriteTrackedRepos.map((r, i) => (
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
                                      title={r.active_sync_count > 0 ? `Deployed to ${r.active_sync_count} endpoint(s) — remove syncs first` : 'Remove from favorites'}
                                      className={`ml-3 shrink-0 text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                                        isDark
                                          ? 'border-red-800 text-red-400 hover:bg-red-900/30'
                                          : 'border-red-200 text-red-600 hover:bg-red-50'
                                      }`}
                                    >
                                      {untrackingKey === r.key ? '…' : 'Remove'}
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

                  {/* Org list — expandable per row for per-org scanner (PAT) config */}
                  {user.orgs && user.orgs.length > 0 ? (
                    <div className="space-y-2">
                      {user.orgs.map((org, idx) => {
                        const isRowOpen = expandedOrgRow === org
                        const orgStatus = orgStatusMap[org]
                        const provider = orgCredProvider[org] || 'github'
                        const status = orgCredStatus[org]
                        const msg = orgCredMessage[org]
                        const gkeActive = (orgStatus?.gke_endpoints?.length ?? 0) > 0
                        const isScannerOpen = scannerSectionOpen[org] !== undefined ? scannerSectionOpen[org] : !gkeActive
                        // Repos visible via the globally-connected GitHub App that belong to this org —
                        // separate from orgStatus.tracked_repos (manually added via PAT/search), but both
                        // represent "being scanned via PAT/App" from the user's point of view.
                        const appRepos = githubConnected
                          ? repos.filter((r: any) => r.full_name?.split('/')[0]?.toLowerCase() === org.toLowerCase())
                          : []
                        const trackedKeys = new Set((orgStatus?.tracked_repos ?? []).map((r: any) => `${r.owner}/${r.name}`.toLowerCase()))
                        const appOnlyRepos = appRepos.filter((r: any) => !trackedKeys.has(r.full_name?.toLowerCase()))
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg border overflow-hidden ${
                              isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <button
                              onClick={() => handleToggleOrgRow(org)}
                              className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                                isDark ? 'hover:bg-[#161b22]' : 'hover:bg-gray-100'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <BusinessIcon className={isDark ? 'text-blue-400' : 'text-blue-600'} sx={{ fontSize: 20 }} />
                                <span className={`font-medium ${textClass}`}>{org}</span>
                                {/* At-a-glance status badges — avoids needing to expand every row to check setup */}
                                {orgStatus?.gke_endpoints?.length > 0 && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${isDark ? 'bg-green-900/30 text-green-400 border border-green-900/50' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                    <CloudIcon sx={{ fontSize: 10 }} />
                                    GKE Active
                                  </span>
                                )}
                                {orgStatus?.github_app_connected ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${isDark ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                    App Connected
                                  </span>
                                ) : (orgStatus?.github_pat_present || orgStatus?.gitlab_pat_present) ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${isDark ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-900/50' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'}`}>
                                    PAT Configured
                                  </span>
                                ) : orgStatus && !orgStatus?.gke_endpoints?.length ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${isDark ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                    Not Connected
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <VerifiedUserIcon className={isDark ? 'text-green-400' : 'text-green-600'} sx={{ fontSize: 16 }} />
                                  <span className={`text-xs uppercase font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                    {user.role}
                                  </span>
                                </div>
                                {isRowOpen ? (
                                  <KeyboardArrowUpIcon sx={{ fontSize: 18 }} className={mutedClass} />
                                ) : (
                                  <KeyboardArrowDownIcon sx={{ fontSize: 18 }} className={mutedClass} />
                                )}
                              </div>
                            </button>

                            {isRowOpen && (
                              <div className={`border-t p-4 space-y-3 ${isDark ? 'border-[#30363d] bg-[#0d1117]/60' : 'border-gray-200 bg-white'}`}>

                                {/* GKE Audit Log status — informs scanner setup whether deployments already sync via GKE, independent of PAT/App connection */}
                                {!loadingOrgStatus[org] && !orgStatusError[org] && orgStatus?.gke_endpoints?.length > 0 && (
                                  <div className={`p-3 rounded-lg border border-l-4 text-xs ${isDark ? 'bg-[#161b22] border-[#30363d] border-l-green-600' : 'bg-gray-50 border-gray-200 border-l-green-500'}`}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <CloudIcon sx={{ fontSize: 16 }} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                                      <span className={`font-semibold ${textClass}`}>GKE Audit Log Integration</span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${isDark ? 'bg-green-900/30 text-green-400 border border-green-900/50' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                        <SyncIcon sx={{ fontSize: 10 }} />
                                        Active
                                      </span>
                                    </div>
                                    <p className={`mb-2 ${mutedClass}`}>
                                      Deployments for this org already sync from the GKE audit log collector — PAT/App scanning below is optional and only needed for repos not covered by that pipeline.
                                    </p>
                                    <div className="space-y-1">
                                      {orgStatus.gke_endpoints.map((ep: any) => (
                                        <div key={ep.name} className={`flex items-center justify-between px-2 py-1.5 rounded text-[11px] ${isDark ? 'bg-[#0d1117]' : 'bg-white'}`}>
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <CloudIcon sx={{ fontSize: 12 }} className={isDark ? 'text-blue-400' : 'text-blue-500'} />
                                            <span className={`font-mono truncate ${textClass}`}>{ep.name}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                              {ep.endpoint_type || 'cluster'}
                                            </span>
                                          </div>
                                          {ep.last_sync && (
                                            <span className={`shrink-0 ml-2 ${mutedClass}`}>
                                              last sync {new Date(ep.last_sync).toLocaleString()}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className={`p-3 rounded-lg border border-l-4 ${isDark ? 'bg-[#161b22] border-[#30363d] border-l-purple-600' : 'bg-gray-50 border-gray-200 border-l-purple-500'}`}>
                                <button
                                  onClick={() => setScannerSectionOpen(prev => ({ ...prev, [org]: !isScannerOpen }))}
                                  className="w-full flex items-center justify-between text-left"
                                >
                                  <span className={`text-xs font-semibold uppercase tracking-wider ${mutedClass}`}>
                                    Scanner Connection — {org}
                                    {gkeActive && !isScannerOpen && (
                                      <span className="ml-1.5 font-normal normal-case">(optional — GKE already covers this org)</span>
                                    )}
                                  </span>
                                  {isScannerOpen ? (
                                    <KeyboardArrowUpIcon sx={{ fontSize: 16 }} className={mutedClass} />
                                  ) : (
                                    <KeyboardArrowDownIcon sx={{ fontSize: 16 }} className={mutedClass} />
                                  )}
                                </button>

                                {isScannerOpen && (
                                <div className="mt-3 space-y-3">
                                {loadingOrgStatus[org] ? (
                                  <p className={`text-xs ${mutedClass}`}>Loading connection status…</p>
                                ) : orgStatusError[org] ? (
                                  <div className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-red-900/10 border-red-900/40 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                    {orgStatusError[org]}
                                    <button
                                      onClick={() => fetchOrgScanStatus(org)}
                                      className="ml-2 underline font-medium"
                                    >
                                      Retry
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    {orgStatus?.github_app_connected ? (
                                      <div className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-green-900/10 border-green-900/40 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                        GitHub App installed — all public and private repos are accessible for this org. No PAT needed.
                                      </div>
                                    ) : (
                                      <div className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-blue-900/10 border-blue-900/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                        Connect the GitHub App for full private + public repo access on this org. A PAT below is only needed for private repos without the app.
                                      </div>
                                    )}

                                    {/* Existing PAT badges */}
                                    <div className="flex flex-wrap gap-2">
                                      {orgStatus?.github_pat_present && (
                                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-gray-200'}`}>
                                          <GitHubIcon sx={{ fontSize: 14 }} />
                                          <span className={textClass}>GitHub PAT</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                            orgStatus.token_status === 'valid'
                                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                          }`}>
                                            {orgStatus.token_status || 'unverified'}
                                          </span>
                                          {canManageOrgCredentials && (
                                            <button
                                              onClick={() => handleDeleteOrgCredential(org, 'github')}
                                              className="text-red-500 hover:text-red-700"
                                              title="Remove token"
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {orgStatus?.gitlab_pat_present && (
                                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-gray-200'}`}>
                                          <span className={textClass}>GitLab PAT</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                            orgStatus.token_status === 'valid'
                                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                          }`}>
                                            {orgStatus.token_status || 'unverified'}
                                          </span>
                                          {canManageOrgCredentials && (
                                            <button
                                              onClick={() => handleDeleteOrgCredential(org, 'gitlab')}
                                              className="text-red-500 hover:text-red-700"
                                              title="Remove token"
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* PAT form — owners only, mirrors backend RequireRole("owner") */}
                                    {canManageOrgCredentials && (
                                      <form onSubmit={(e) => handleSaveOrgCredential(org, e)} className="flex gap-2 items-end flex-wrap">
                                        <div>
                                          <label className={`block text-xs font-medium mb-1 ${labelClass}`}>Provider</label>
                                          <select
                                            value={provider}
                                            onChange={e => setOrgCredProvider(prev => ({ ...prev, [org]: e.target.value as 'github' | 'gitlab' }))}
                                            style={inputStyle}
                                            className="px-2 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          >
                                            <option value="github">GitHub</option>
                                            <option value="gitlab">GitLab</option>
                                          </select>
                                        </div>
                                        <div className="flex-1 min-w-[160px]">
                                          <label className={`block text-xs font-medium mb-1 ${labelClass}`}>Personal Access Token</label>
                                          <input
                                            type="password"
                                            value={orgCredToken[org] || ''}
                                            onChange={e => setOrgCredToken(prev => ({ ...prev, [org]: e.target.value }))}
                                            placeholder={provider === 'github' ? 'ghp_...' : 'glpat-...'}
                                            style={inputStyle}
                                            className="w-full px-2.5 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoComplete="off"
                                            data-lpignore="true"
                                            data-1p-ignore="true"
                                          />
                                        </div>
                                        <button
                                          type="submit"
                                          disabled={status === 'saving' || !orgCredToken[org]?.trim()}
                                          className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                                        >
                                          {status === 'saving' ? 'Saving…' : 'Save Token'}
                                        </button>
                                      </form>
                                    )}

                                    {msg && (
                                      <p className={`text-xs ${status === 'success' ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                        {msg}
                                      </p>
                                    )}

                                    {/* Repo search — find repos to scan under this org's PAT/App connection. Owners only, mirrors backend RequireRole("owner") on TrackRepo. */}
                                    {canManageOrgCredentials && (
                                      <div className={`pt-3 border-t ${isDark ? 'border-[#30363d]' : 'border-gray-200'}`}>
                                        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${mutedClass}`}>
                                          Add a Repo to Scan
                                          <span className={`ml-1.5 font-normal normal-case ${isDark ? 'text-[#8b949e]' : 'text-gray-500'}`}>
                                            (searching {provider === 'github' ? 'GitHub' : 'GitLab'})
                                          </span>
                                        </p>
                                        <div className="flex gap-2 items-end flex-wrap">
                                          <input
                                            type="text"
                                            value={orgRepoQuery[org] || ''}
                                            onChange={e => setOrgRepoQuery(prev => ({ ...prev, [org]: e.target.value }))}
                                            onKeyDown={e => e.key === 'Enter' && handleOrgRepoSearch(org)}
                                            placeholder="e.g. nginx, curl/curl"
                                            style={inputStyle}
                                            className="flex-1 min-w-[160px] px-2.5 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                          <button
                                            onClick={() => handleOrgRepoSearch(org)}
                                            disabled={orgRepoSearching[org] || !orgRepoQuery[org]?.trim()}
                                            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                                          >
                                            {orgRepoSearching[org] ? '…' : 'Search'}
                                          </button>
                                        </div>

                                        {(orgRepoSearchResults[org]?.length ?? 0) > 0 && (
                                          <div className={`mt-2 rounded-md border divide-y max-h-48 overflow-y-auto ${isDark ? 'border-[#30363d] divide-[#30363d]' : 'border-gray-200 divide-gray-100'}`}>
                                            {orgRepoSearchResults[org].map((r: any, i: number) => {
                                              const rKey = `${r.provider}/${r.owner}/${r.name}`
                                              return (
                                                <div key={i} className={`flex items-center justify-between px-3 py-2 text-xs ${isDark ? 'bg-[#161b22]' : 'bg-white'}`}>
                                                  <div className="min-w-0">
                                                    <span className={`font-semibold ${textClass}`}>{r.owner}/{r.name}</span>
                                                    {r.description && (
                                                      <p className={`truncate mt-0.5 ${mutedClass}`}>{r.description}</p>
                                                  )}
                                                </div>
                                                <button
                                                  onClick={() => handleOrgWatchRepo(org, r)}
                                                  disabled={orgRepoTracking === rKey}
                                                  className="ml-3 shrink-0 px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                                                >
                                                  {orgRepoTracking === rKey ? '…' : 'Add'}
                                                </button>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    )}

                                    {/* Tracked repos for this org — scanned under this org's connection, plus repos visible via the connected GitHub App */}
                                    <div>
                                      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${mutedClass}`}>
                                        Repos Scanned via PAT/App ({(orgStatus?.tracked_repos?.length ?? 0) + appOnlyRepos.length})
                                      </p>
                                      {!orgStatus?.tracked_repos?.length && appOnlyRepos.length === 0 ? (
                                        <p className={`text-xs ${mutedClass}`}>
                                          No repos being scanned via PAT/App for this org yet.
                                          {orgStatus?.gke_endpoints?.length > 0 && ' GKE-synced deployments above are tracked separately.'}
                                        </p>
                                      ) : (
                                        <div className={`rounded-md border divide-y max-h-56 overflow-y-auto ${isDark ? 'border-[#30363d] divide-[#30363d]' : 'border-gray-200 divide-gray-100'}`}>
                                          {appOnlyRepos.map((r: any) => (
                                            <div key={`app-${r.full_name}`} className={`flex items-center justify-between px-3 py-2 text-xs ${isDark ? 'bg-[#161b22]' : 'bg-white'}`}>
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                                                  via App
                                                </span>
                                                <span className={`font-medium truncate ${textClass}`}>{r.full_name}</span>
                                                {r.private && (
                                                  <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 rounded">Private</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                          {orgStatus?.tracked_repos?.map((r: any, i: number) => {
                                            const hideKey = `hide:${r.provider}/${r.owner}/${r.name}`
                                            return (
                                              <div key={i} className={`flex items-center justify-between px-3 py-2 text-xs ${isDark ? 'bg-[#161b22]' : 'bg-white'}`}>
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                    r.provider === 'github'
                                                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                                                  }`}>
                                                    {r.provider}
                                                  </span>
                                                  <span className={`font-medium truncate ${textClass}`}>{r.owner}/{r.name}</span>
                                                </div>
                                                {canHideOrgRepos && (
                                                  <button
                                                    onClick={() => handleOrgHideRepo(org, r)}
                                                    disabled={orgRepoHiding === hideKey}
                                                    title="Hide from view (keeps scanning)"
                                                    className={`ml-3 shrink-0 px-2 py-1 rounded text-xs transition-colors disabled:opacity-50 ${
                                                      isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
                                                    }`}
                                                  >
                                                    {orgRepoHiding === hideKey ? '…' : 'Hide'}
                                                  </button>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                                </div>
                                )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
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
                          To add public repos to Favorites across any org, use <strong>Favorite Public Repositories</strong> on your org card above.
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