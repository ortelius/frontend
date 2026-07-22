'use client'

/**
 * OrgMembers — org membership management card for the Org Settings page.
 *
 * Backed by the GitOps member endpoints:
 *   GET    /api/v1/orgs/:org/members             — members + pending invitations
 *   POST   /api/v1/orgs/:org/members             — invite new user / add existing
 *   PATCH  /api/v1/orgs/:org/members/:username   — change role
 *   DELETE /api/v1/orgs/:org/members/:username   — remove member
 *   POST   /api/v1/invitation/:token/resend      — resend a pending invitation
 *
 * Every mutation is committed to rbac.yaml by the backend before being
 * applied, so expect a ~1-3s round trip (clone + push) on writes.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/context/ThemeContext'

import GroupIcon from '@mui/icons-material/Group'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import DeleteIcon from '@mui/icons-material/Delete'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'

interface OrgMember {
  username: string
  email: string
  role: string
  status: string
  is_active: boolean
  created_at: string
}

interface PendingInvitation {
  username: string
  email: string
  role: string
  expires_at: string
  resend_count: number
  token?: string
}

interface OrgMembersProps {
  orgName: string
  /** true when the viewer holds the owner or admin role */
  isOwner: boolean
  /** the viewer's own username — used to guard self-removal */
  currentUsername?: string
}

const ROLES = ['viewer', 'editor', 'admin', 'owner'] as const

const getRestEndpoint = async (): Promise<string> => {
  try {
    const res = await fetch('/config')
    const config = await res.json()
    return config.restEndpoint || 'http://localhost:3000/api/v1'
  } catch {
    return 'http://localhost:3000/api/v1'
  }
}

export default function OrgMembers({ orgName, isOwner, currentUsername }: OrgMembersProps) {
  const { isDark } = useTheme()

  const [members, setMembers] = useState<OrgMember[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Invite form
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('viewer')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [inviteMessage, setInviteMessage] = useState('')

  // Row actions
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')

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
  const rowBg = { backgroundColor: isDark ? '#0d1117' : '#f9fafb' }

  const fetchMembers = useCallback(async () => {
    if (!orgName) return
    try {
      setLoading(true)
      setLoadError('')
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/members`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to load members (${res.status})`)
      setMembers(data.members || [])
      setInvitations(data.invitations || [])
    } catch (err: any) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orgName])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const pendingByUsername = new Map(invitations.map(i => [i.username, i]))

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteUsername.trim()) return
    setInviteStatus('saving')
    setInviteMessage('')
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: inviteUsername.trim(),
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation')
      setInviteStatus('success')
      setInviteMessage(data.message || 'Invitation sent')
      setInviteUsername('')
      setInviteEmail('')
      setInviteRole('viewer')
      fetchMembers()
    } catch (err: any) {
      setInviteStatus('error')
      setInviteMessage(err.message)
    }
  }

  const handleRoleChange = async (username: string, role: string) => {
    setActionLoading(`role:${username}`)
    setActionMessage('')
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/members/${encodeURIComponent(username)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to change role')
      setActionMessage(`✅ ${data.message}`)
      fetchMembers()
    } catch (err: any) {
      setActionMessage(`❌ ${err.message}`)
      fetchMembers() // reset the select back to the server-side value
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemove = async (username: string) => {
    const isSelf = username === currentUsername
    const prompt = isSelf
      ? `Remove yourself from ${orgName}? You will lose access to this org.`
      : `Remove ${username} from ${orgName}? If this is their only org, their account will be deactivated.`
    if (!window.confirm(prompt)) return

    setActionLoading(`remove:${username}`)
    setActionMessage('')
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/orgs/${orgName}/members/${encodeURIComponent(username)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove member')
      setActionMessage(`✅ ${data.message}`)
      fetchMembers()
    } catch (err: any) {
      setActionMessage(`❌ ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleResend = async (token: string, email: string) => {
    setActionLoading(`resend:${token}`)
    setActionMessage('')
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/invitation/${token}/resend`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to resend invitation')
      setActionMessage(`📧 Invitation resent to ${email}`)
      fetchMembers()
    } catch (err: any) {
      setActionMessage(`❌ ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/invitation/${token}`
    try {
      await navigator.clipboard.writeText(link)
      setActionMessage('🔗 Invite link copied to clipboard')
    } catch {
      setActionMessage(`🔗 Invite link: ${link}`)
    }
  }

  const roleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
      case 'admin':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      case 'editor':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
    }
  }

  return (
    <div className="p-6 rounded-xl border shadow-sm" style={card}>
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2" style={{ color: textPrimary }}>
        <GroupIcon sx={{ fontSize: 22 }} />
        Members
        {!loading && (
          <span className="text-sm font-normal" style={{ color: textSecondary }}>
            ({members.length})
          </span>
        )}
      </h2>
      <p className="text-sm mb-4" style={{ color: textSecondary }}>
        Membership changes are committed to the RBAC configuration repository — updates may take a few seconds.
      </p>

      {loadError && (
        <div className="mb-4 p-3 rounded-lg border text-sm bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm py-4" style={{ color: textSecondary }}>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          Loading members...
        </div>
      ) : (
        <>
          {/* ── Member list ── */}
          <div className="space-y-1.5 mb-6 max-h-96 overflow-y-auto pr-1">
            {members.map(m => {
              const pending = m.status === 'pending' ? pendingByUsername.get(m.username) : undefined
              const isSelf = m.username === currentUsername
              return (
                <div
                  key={m.username}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
                  style={rowBg}
                >
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: textPrimary }}>
                        {m.username}
                      </span>
                      {m.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                          <HourglassEmptyIcon sx={{ fontSize: 12 }} />
                          pending invite
                        </span>
                      )}
                      {m.status === 'removed' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          removed
                        </span>
                      )}
                      {m.status === 'active' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          active
                        </span>
                      )}
                    </div>
                    {m.email && (
                      <div className="text-xs mt-0.5" style={{ color: textSecondary }}>
                        {m.email}
                      </div>
                    )}
                  </div>

                  {/* Role: select for owners, badge for everyone else */}
                  {isOwner && !isSelf ? (
                    <select
                      value={m.role}
                      disabled={actionLoading === `role:${m.username}`}
                      onChange={e => handleRoleChange(m.username, e.target.value)}
                      className="px-2 py-1 rounded-md border text-xs font-medium"
                      style={inputStyle}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${roleBadgeClass(m.role)}`}>
                      {m.role}
                    </span>
                  )}

                  {/* Pending-invite actions */}
                  {isOwner && pending?.token && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleResend(pending.token!, pending.email)}
                        disabled={actionLoading === `resend:${pending.token}`}
                        title="Resend invitation email"
                        className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 disabled:opacity-50"
                      >
                        <MailOutlineIcon sx={{ fontSize: 16 }} />
                      </button>
                      <button
                        onClick={() => handleCopyLink(pending.token!)}
                        title="Copy invite link"
                        className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                        style={{ color: textSecondary }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 16 }} />
                      </button>
                    </div>
                  )}

                  {isOwner && (
                    <button
                      onClick={() => handleRemove(m.username)}
                      disabled={actionLoading === `remove:${m.username}`}
                      title={`Remove ${m.username} from ${orgName}`}
                      className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-50"
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </button>
                  )}
                </div>
              )
            })}
            {members.length === 0 && (
              <p className="text-sm py-2" style={{ color: textSecondary }}>
                No members found for this org.
              </p>
            )}
          </div>

          {/* ── Invite form (owner/admin only) ── */}
          {isOwner && (
            <div className="pt-4 border-t" style={{ borderColor: card.borderColor }}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                <PersonAddIcon sx={{ fontSize: 18 }} />
                Invite a member
              </h3>
              <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: textSecondary }}>
                    Login Handle
                  </label>
                  <input
                    type="text"
                    name="org-invite-identifier-1a2b3c"
                    value={inviteUsername}
                    placeholder="jdoe"
                    onChange={e => setInviteUsername(e.target.value)}
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="px-3 py-2 rounded-lg border text-sm w-40"
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: textSecondary }}>
                    Invitation Address
                  </label>
                  <input
                    type="text"
                    name="org-invite-contact-4d5e6f"
                    value={inviteEmail}
                    placeholder="jdoe@example.com"
                    onChange={e => setInviteEmail(e.target.value)}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="px-3 py-2 rounded-lg border text-sm w-56"
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: textSecondary }}>
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={inputStyle}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviteStatus === 'saving' || !inviteUsername.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  {inviteStatus === 'saving' ? 'Sending...' : 'Send Invite'}
                </button>
              </form>
              <p className="text-xs mt-2" style={{ color: textSecondary }}>
                New users get an email invitation to set their password. Existing users are added to the org immediately — no email needed.
              </p>
              {inviteMessage && (
                <p
                  className={`text-sm mt-2 ${
                    inviteStatus === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {inviteMessage}
                </p>
              )}
            </div>
          )}

          {actionMessage && (
            <p className="text-sm mt-3" style={{ color: textSecondary }}>
              {actionMessage}
            </p>
          )}
        </>
      )}
    </div>
  )
}