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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { setAllOrgVisibilityChecked } from '@/lib/Orgvisibilityfilter'
import { addPendingOrgImports } from '@/lib/pendingImports'

interface GitHubAppRepo {
  id: number
  name: string
  full_name: string
  description: string
  html_url: string
  private: boolean
  // true when the repo is on the user's scan allow-list (already onboarded)
  scanned?: boolean
  // saved mapping for the repo (shown/edited after import)
  mapping?: { artifactNamespace?: string; gitopsEndpoint?: string }
}

// Per-repo mapping collected before import:
//  - artifactNamespace: GitHub org -> artifact/docker namespace (e.g. DeployHubProj -> deployhub)
//  - isGitops + endpointName/endpointNamespace: repo -> runtime endpoint mapping
//    (e.g. us-central-1_deployhub/deployhub) for repos that hold gitops manifests/charts
interface RepoMapping {
  artifactNamespace: string
  isGitops: boolean
  endpointName: string
  endpointNamespace: string
}

const emptyMapping: RepoMapping = { artifactNamespace: '', isGitops: false, endpointName: '', endpointNamespace: '' }

export default function WelcomePage() {
  const router = useRouter()
  const { user, refresh } = useAuth()
  const { isDark } = useTheme()

  const [repoQuery, setRepoQuery] = useState('')
  const [repoProvider, setRepoProvider] = useState<'github' | 'gitlab'>('github')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [trackingKey, setTrackingKey] = useState<string | null>(null)
  const [searchMsg, setSearchMsg] = useState<{ msg: string; ok: boolean } | null>(null)

  // Step-1 completion — derived fresh from the backend on every load, never
  // cached in a cookie or localStorage, so it always reflects real data.
  const [hasFavorites, setHasFavorites] = useState(false)
  const [checkingFavorites, setCheckingFavorites] = useState(true)

  // GitHub App connect + onboard state
  const [githubConnected, setGithubConnected] = useState(false)
  const [loadingGithubStatus, setLoadingGithubStatus] = useState(true)
  const [githubRepos, setGithubRepos] = useState<GitHubAppRepo[]>([])
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())
  const [importedRepos, setImportedRepos] = useState<Set<string>>(new Set())
  // Which repo rows have their mapping section expanded, and the mapping
  // values entered for each repo (keyed by full_name), collected client-side
  // and sent along with the import request.
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set())
  const [repoMappings, setRepoMappings] = useState<Record<string, RepoMapping>>({})
  // Repo owners (= org names) added this session via either path below —
  // handed off to the org list on finish so it can show a "Waiting on
  // import..." placeholder until the backend's import cycle catches up.
  const [addedOrgNames, setAddedOrgNames] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [importMsg, setImportMsg] = useState<{ msg: string; ok: boolean } | null>(null)
  const [removingRepo, setRemovingRepo] = useState<string | null>(null)
  // Mappings as last saved on the server; Cancel restores these and Save diffs against them.
  const [savedMappings, setSavedMappings] = useState<Record<string, RepoMapping>>({})

  useEffect(() => {
    if (user === null) {
      // `refresh()` can race with cookie propagation right after an OAuth
      // redirect and briefly report "logged out" even though the session is
      // valid (seen as a one-off 401 from /auth/me while /auth/status still
      // succeeds). Re-verify before bouncing the user away from this page.
      refresh().then(fresh => {
        if (!fresh) router.push('/')
      })
    }
  }, [user, router, refresh])

  const getEndpoint = async () => {
    const res = await fetch('/config')
    const cfg = await res.json()
    return cfg.restEndpoint || 'http://localhost:3000/api/v1'
  }

  const fetchGithubStatus = async () => {
    setLoadingGithubStatus(true)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/github/repos`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setGithubConnected(true)
        const repos = Array.isArray(data) ? data : []
        setGithubRepos(repos)
        // Repos already onboarded (on the scan allow-list) show as Imported.
        // Only repos that are explicitly imported get scanned, so nothing is
        // pre-selected: the user picks which repos to import.
        setImportedRepos(new Set(repos.filter((r: GitHubAppRepo) => r.scanned).map((r: GitHubAppRepo) => r.full_name)))
        setSelectedRepos(new Set())
        // Prefill the mapping editor with each repo's saved mapping.
        const saved: Record<string, RepoMapping> = {}
        repos.forEach((r: GitHubAppRepo) => {
          if (!r.mapping) return
          const ep = r.mapping.gitopsEndpoint || ''
          const slash = ep.lastIndexOf('/')
          saved[r.full_name] = {
            artifactNamespace: r.mapping.artifactNamespace || '',
            isGitops: ep !== '',
            endpointName: slash > 0 ? ep.slice(0, slash) : ep,
            endpointNamespace: slash > 0 ? ep.slice(slash + 1) : '',
          }
        })
        setRepoMappings(saved)
        setSavedMappings(saved)
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

  // Checks the backend directly for at least one favorited repo — this is the
  // source of truth for whether step 1 is complete, not a flag we set once
  // and remember client-side.
  const fetchFavoritesStatus = async () => {
    setCheckingFavorites(true)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/tracked-repos`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setHasFavorites((data.repos ?? []).length > 0)
      } else {
        setHasFavorites(false)
      }
    } catch (e) {
      console.error('Failed to check favorites status', e)
      setHasFavorites(false)
    } finally {
      setCheckingFavorites(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchGithubStatus()
      fetchFavoritesStatus()
    }
  }, [user])

  const handleConnectGithub = async () => {
    const endpoint = await getEndpoint()
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

  const toggleRepoExpanded = (fullName: string) => {
    setExpandedRepos(prev => {
      const next = new Set(prev)
      if (next.has(fullName)) next.delete(fullName)
      else next.add(fullName)
      return next
    })
  }

  const getMapping = (fullName: string): RepoMapping => repoMappings[fullName] || emptyMapping

  const updateMapping = (fullName: string, patch: Partial<RepoMapping>) => {
    setRepoMappings(prev => ({
      ...prev,
      [fullName]: { ...getMapping(fullName), ...patch },
    }))
  }

  // Normalizes a mapping into what the API stores (empty string = not set).
  const mappingPayload = (m: RepoMapping) => ({
    artifactNamespace: m.artifactNamespace.trim(),
    gitopsEndpoint:
      m.isGitops && m.endpointName.trim() && m.endpointNamespace.trim()
        ? `${m.endpointName.trim()}/${m.endpointNamespace.trim()}`
        : '',
  })

  // Imported repos whose mapping was edited but not saved yet.
  const dirtyImported = githubRepos
    .map(r => r.full_name)
    .filter(fullName => importedRepos.has(fullName))
    .filter(
      fullName =>
        JSON.stringify(mappingPayload(getMapping(fullName))) !==
        JSON.stringify(mappingPayload(savedMappings[fullName] || emptyMapping))
    )
  const hasPending = selectedRepos.size > 0 || dirtyImported.length > 0

  // Save applies every pending change: imports the checked repos (POST
  // /github/onboard) and saves edited mappings of already imported repos
  // (PUT /github/mapping).
  const handleSave = async () => {
    if (!hasPending) return
    setSaving(true)
    setImportMsg(null)
    const parts: string[] = []
    let failed = false
    try {
      const endpoint = await getEndpoint()

      // 1. Import newly selected repos (adds them to the scan list).
      if (selectedRepos.size > 0) {
        const toImport = Array.from(selectedRepos)
        // Only send a mapping entry for repos where the user actually filled
        // something in — an untouched repo just imports with no mapping.
        const mappings: Record<string, { artifactNamespace: string | null; gitopsEndpoint: string | null }> = {}
        toImport.forEach(fullName => {
          const pl = mappingPayload(getMapping(fullName))
          if (pl.artifactNamespace || pl.gitopsEndpoint) {
            mappings[fullName] = {
              artifactNamespace: pl.artifactNamespace || null,
              gitopsEndpoint: pl.gitopsEndpoint || null,
            }
          }
        })

        const res = await fetch(`${endpoint}/github/onboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ repos: toImport, repoMappings: mappings }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          setImportedRepos(prev => new Set([...prev, ...toImport]))
          setAddedOrgNames(prev => {
            const next = new Set(prev)
            toImport.forEach(fullName => next.add(fullName.split('/')[0]))
            return next
          })
          setSavedMappings(prev => {
            const next = { ...prev }
            toImport.forEach(fullName => {
              next[fullName] = getMapping(fullName)
            })
            return next
          })
          setExpandedRepos(prev => {
            const next = new Set(prev)
            toImport.forEach(fullName => next.delete(fullName))
            return next
          })
          setSelectedRepos(new Set())
          parts.push(data.message || `Imported ${toImport.length} repo(s)`)
        } else {
          failed = true
          parts.push(data.error || 'Failed to import selected repos')
        }
      }

      // 2. Save edited mappings of repos that were already imported.
      for (const fullName of dirtyImported) {
        const pl = mappingPayload(getMapping(fullName))
        const res = await fetch(`${endpoint}/github/mapping`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ repo: fullName, ...pl }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          setSavedMappings(prev => ({ ...prev, [fullName]: getMapping(fullName) }))
          setExpandedRepos(prev => {
            const next = new Set(prev)
            next.delete(fullName)
            return next
          })
          parts.push(`Saved mapping for ${fullName}`)
        } else {
          failed = true
          parts.push(
            data.error ||
              (res.status === 404 ? 'Mapping updates are not supported by this backend yet' : `Failed to save mapping for ${fullName}`)
          )
        }
      }
    } catch (e) {
      failed = true
      parts.push('Network error')
    } finally {
      setSaving(false)
    }
    setImportMsg({ msg: parts.join(' · '), ok: !failed })
  }

  // Cancel discards pending changes: unchecks repos, collapses the editors and
  // restores mappings to what was last saved.
  const handleCancel = () => {
    setSelectedRepos(new Set())
    setExpandedRepos(new Set())
    setRepoMappings(savedMappings)
    setImportMsg(null)
  }

  // Stops scanning an onboarded repo: POST /github/remove takes it off the
  // user's scan allow-list (relscanner-job only scans onboarded repos) and drops
  // its mapping. Existing releases/data are kept; the repo stays visible to the
  // GitHub App, so it can be imported again later.
  const handleRemoveRepo = async (fullName: string) => {
    if (
      !window.confirm(
        `Stop scanning ${fullName}?\n\nExisting releases and data are kept. You can import it again later.`
      )
    ) {
      return
    }
    setRemovingRepo(fullName)
    setImportMsg(null)
    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/github/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repos: [fullName] }),
      })
      if (res.ok) {
        setImportedRepos(prev => {
          const next = new Set(prev)
          next.delete(fullName)
          return next
        })
        setGithubRepos(prev => prev.map(r => (r.full_name === fullName ? { ...r, scanned: false } : r)))
        setRepoMappings(prev => {
          const next = { ...prev }
          delete next[fullName]
          return next
        })
        setImportMsg({ msg: `Stopped scanning ${fullName}`, ok: true })
      } else {
        const data = await res.json().catch(() => ({}))
        setImportMsg({
          msg: data.error || (res.status === 404 ? 'Remove is not supported by this backend yet' : `Failed to remove ${fullName}`),
          ok: false,
        })
      }
    } catch (e) {
      setImportMsg({ msg: 'Network error', ok: false })
    } finally {
      setRemovingRepo(null)
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
        setAddedOrgNames(prev => new Set(prev).add(result.owner))
        fetchFavoritesStatus()
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

  const handleFinish = async () => {
    try {
      const endpoint = await getEndpoint()
      await fetch(`${endpoint}/auth/onboarding-complete`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (e) {
      console.error('Failed to mark onboarding complete', e)
    }
    if (addedOrgNames.size > 0) {
      addPendingOrgImports(Array.from(addedOrgNames))
    }
    setAllOrgVisibilityChecked()
    router.push('/')
  }

  return (
    <div className={`flex-1 overflow-y-auto ${pageBg}`}>
      {/* Sticky action bar — the page can run long (GitHub repo lists,
          search results), so the way out shouldn't require scrolling past
          all of it. Mirrors the "Add Project" button placement on the org
          list page: top-right, always visible. */}
      <div
        className={`sticky top-0 z-10 flex justify-end px-6 py-3 border-b backdrop-blur ${
          isDark ? 'bg-[#0d1117]/95 border-[#21262d]' : 'bg-white/95 border-gray-100'
        }`}
      >
        <button
          onClick={handleFinish}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          Save &amp; Go to Organizations
          <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

        {/* Step 1 — connect GitHub App to pick from repos you actually work with (including private ones) */}
        <div className="p-6 rounded-xl border shadow-sm" style={cardStyle}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <h2 className={`text-lg font-semibold ${headingClass}`}>
              Monitor Private Releases for CVEs <span className={`text-sm font-normal ${mutedClass}`}>(recommended)</span>
            </h2>
            {githubConnected && (
              <div className="flex items-center gap-2">
                <a
                  href="https://github.com/settings/installations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                  Add more repos
                  <OpenInNewIcon sx={{ fontSize: 12 }} />
                </a>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                  isDark ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-green-100 text-green-800 border-green-200'
                }`}>
                  <CheckCircleIcon sx={{ fontSize: 14 }} /> Connected
                </span>
              </div>
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
              <button 
                onClick={handleConnectGithub} 
                className="text-blue-600 hover:underline inline-flex items-center gap-0.5 bg-transparent border-none cursor-pointer p-0"
              >
                Grant access to repos on GitHub <OpenInNewIcon sx={{ fontSize: 12 }} />
              </button>
            </p>
          ) : (
            <>
              <div className={`rounded-md border divide-y max-h-64 overflow-y-auto mb-3 ${isDark ? 'border-[#30363d] divide-[#30363d]' : 'border-gray-200 divide-gray-100'}`}>
                {githubRepos.map(repo => {
                  const alreadyImported = importedRepos.has(repo.full_name)
                  const isExpanded = expandedRepos.has(repo.full_name)
                  const mapping = getMapping(repo.full_name)
                  const orgName = repo.full_name.split('/')[0]
                  return (
                    <div
                      key={repo.id}
                      className={`${isDark ? 'bg-[#161b22]' : 'bg-white'} `}
                    >
                      <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
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
                          <>
                            <span className="ml-auto text-xs font-semibold text-green-600 dark:text-green-400 shrink-0">Imported</span>
                            <button
                              type="button"
                              onClick={e => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleRepoExpanded(repo.full_name)
                              }}
                              className={`shrink-0 flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded transition-colors ${
                                isDark ? 'text-[#8b949e] hover:text-white hover:bg-[#21262d]' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                              }`}
                            >
                              Mapping
                              {isExpanded ? <KeyboardArrowUpIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
                            </button>
                            <button
                              type="button"
                              title="Stop scanning this repo"
                              aria-label={`Remove ${repo.full_name} from scanning`}
                              disabled={removingRepo === repo.full_name}
                              onClick={e => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleRemoveRepo(repo.full_name)
                              }}
                              className={`shrink-0 flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 ${
                                isDark ? 'text-[#f85149] hover:bg-[#21262d]' : 'text-red-600 hover:bg-red-50'
                              }`}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                              {removingRepo === repo.full_name ? 'Removing…' : 'Remove'}
                            </button>
                          </>
                        ) : (
                          <>
                            {repo.description && (
                              <span className={`text-xs truncate ${mutedClass}`}>{repo.description}</span>
                            )}
                            <button
                              type="button"
                              onClick={e => {
                                e.preventDefault()
                                toggleRepoExpanded(repo.full_name)
                              }}
                              className={`ml-auto shrink-0 flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded transition-colors ${
                                isDark ? 'text-[#8b949e] hover:text-white hover:bg-[#21262d]' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                              }`}
                            >
                              Mapping
                              {isExpanded ? <KeyboardArrowUpIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
                            </button>
                          </>
                        )}
                      </label>

                      {isExpanded && (
                        <div className={`px-3 pb-3 pt-2 ml-6 space-y-3 border-t ${isDark ? 'border-[#21262d]' : 'border-gray-100'}`}>
                          <div>
                            <label className={`block text-xs font-semibold mb-1 ${textClass}`}>
                              Artifact namespace
                            </label>
                            <p className={`text-xs mb-1.5 ${mutedClass}`}>
                              Map the <code>{orgName}</code> GitHub org to the Docker/artifact namespace it publishes under.
                            </p>
                            <input
                              type="text"
                              value={mapping.artifactNamespace}
                              onChange={e => updateMapping(repo.full_name, { artifactNamespace: e.target.value })}
                              placeholder="e.g. deployhub"
                              style={inputStyle}
                              className="w-full text-sm px-2.5 py-1.5 rounded-md border outline-none"
                            />
                          </div>

                          <div>
                            <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${textClass}`}>
                              <input
                                type="checkbox"
                                checked={mapping.isGitops}
                                onChange={e => updateMapping(repo.full_name, { isGitops: e.target.checked })}
                              />
                              This is a GitOps repo (Helm charts / manifests)
                            </label>
                            {mapping.isGitops && (
                              <>
                                <p className={`text-xs mt-1 mb-1.5 ${mutedClass}`}>
                                  Map it to the runtime endpoint it deploys to, as <code>&lt;endpoint name&gt;/&lt;namespace&gt;</code>.
                                </p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={mapping.endpointName}
                                    onChange={e => updateMapping(repo.full_name, { endpointName: e.target.value })}
                                    placeholder="e.g. us-central-1_deployhub"
                                    style={inputStyle}
                                    className="flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-md border outline-none"
                                  />
                                  <span className={mutedClass}>/</span>
                                  <input
                                    type="text"
                                    value={mapping.endpointNamespace}
                                    onChange={e => updateMapping(repo.full_name, { endpointNamespace: e.target.value })}
                                    placeholder="e.g. deployhub"
                                    style={inputStyle}
                                    className="flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-md border outline-none"
                                  />
                                </div>
                              </>
                            )}
                          </div>

                          {alreadyImported && (
                            <p className={`text-xs ${mutedClass}`}>
                              Changes apply to releases scanned from now on, once you click Save.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !hasPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving || !hasPending}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 ${
                    isDark
                      ? 'border-[#30363d] text-[#c9d1d9] hover:bg-[#21262d]'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                {hasPending && (
                  <span className={`text-xs ${mutedClass}`}>
                    {[
                      selectedRepos.size > 0 ? `${selectedRepos.size} to import` : '',
                      dirtyImported.length > 0 ? `${dirtyImported.length} mapping change(s)` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>

              {importMsg && (
                <p className={`text-sm mt-2 ${importMsg.ok ? (isDark ? 'text-green-400' : 'text-green-700') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                  {importMsg.msg}
                </p>
              )}
            </>
          )}
        </div>

        {/* Step 2 — repo search: the primary way to add public repos */}
        <div className="p-6 rounded-xl border shadow-sm" style={cardStyle}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <h2 className={`text-lg font-semibold ${headingClass}`}>
              Monitor Public Releases for CVEs
            </h2>
            {!checkingFavorites && hasFavorites && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                isDark ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-green-100 text-green-800 border-green-200'
              }`}>
                <CheckCircleIcon sx={{ fontSize: 14 }} /> Done
              </span>
            )}
          </div>
          <p className={`text-sm mb-4 ${mutedClass}`}>
            Search for public software you run in production, such as <strong>nginx</strong>, <strong>curl</strong>, or <strong>redis</strong>, and add it to your dashboard. We&rsquo;ll begin monitoring it for newly discovered CVEs right away. No GitHub connection or repository access is required.
          </p>

          <div className="flex gap-2 flex-wrap mb-3">
            <div className={`flex rounded-md border overflow-hidden text-xs font-medium ${isDark ? 'border-[#30363d]' : 'border-gray-200'}`}>
              {(['github'] as const).map(p => (
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

        {/* Continue to org selection */}
        <div className="flex justify-center pt-2">
          <button
            onClick={handleFinish}
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