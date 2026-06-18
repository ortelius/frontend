'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

interface InvitationDetails {
  username: string
  email: string
  role: string
}

export default function InvitationPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { isDark } = useTheme()

  const token = decodeURIComponent(params.name as string)

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'submitting' | 'accepted'>('loading')
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const getEndpoint = async () => {
    const res = await fetch('/config')
    const cfg = await res.json()
    return cfg.restEndpoint || 'http://localhost:3000/api/v1'
  }

  // Already logged in? This link doesn't apply — send them on, don't make
  // them re-accept an invite they've already used.
  useEffect(() => {
    if (user) router.push('/dashboard')
  }, [user, router])

  useEffect(() => {
    if (user || !token) return

    const fetchInvitation = async () => {
      try {
        const endpoint = await getEndpoint()
        const res = await fetch(`${endpoint}/invitation/${encodeURIComponent(token)}`)
        if (res.ok) {
          setInvitation(await res.json())
          setStatus('valid')
        } else {
          const data = await res.json().catch(() => ({}))
          setErrorMsg(data.error || 'This invitation link is invalid or has expired.')
          setStatus('invalid')
        }
      } catch {
        setErrorMsg('Could not reach the server. Please try again.')
        setStatus('invalid')
      }
    }

    fetchInvitation()
  }, [user, token])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== passwordConfirm) {
      setErrorMsg('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long')
      return
    }

    setStatus('submitting')
    setErrorMsg('')

    try {
      const endpoint = await getEndpoint()
      const res = await fetch(`${endpoint}/invitation/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, password_confirm: passwordConfirm, token }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('accepted')
        // Full reload so AuthContext re-initializes from the new auth_token cookie,
        // then land on the existing onboarding page.
        setTimeout(() => { window.location.href = '/welcome' }, 1200)
      } else {
        setErrorMsg(data.error || 'Failed to activate account')
        setStatus('valid')
      }
    } catch {
      setErrorMsg('Network error — please try again')
      setStatus('valid')
    }
  }

  const pageBg = isDark ? 'bg-[#0d1117]' : 'bg-gray-50'
  const cardStyle = { backgroundColor: isDark ? '#161b22' : '#ffffff', borderColor: isDark ? '#30363d' : '#e5e7eb' }
  const inputStyle = { backgroundColor: isDark ? '#0d1117' : '#ffffff', borderColor: isDark ? '#30363d' : '#d1d5db', color: isDark ? '#e6edf3' : '#111827' }
  const headingClass = isDark ? 'text-[#f0f6fc]' : 'text-gray-900'
  const mutedClass = isDark ? 'text-[#8b949e]' : 'text-gray-500'

  if (user) return null // redirecting

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${pageBg}`}>
      <div className="max-w-md w-full p-8 rounded-xl border shadow-sm" style={cardStyle}>

        {status === 'loading' && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className={`mt-4 text-sm ${mutedClass}`}>Checking your invitation…</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="text-center py-8">
            <ErrorOutlineIcon sx={{ fontSize: 40 }} className="text-red-500 mb-2" />
            <h2 className={`text-lg font-semibold ${headingClass}`}>Invitation not valid</h2>
            <p className={`text-sm mt-2 ${mutedClass}`}>{errorMsg}</p>
            <p className={`text-sm mt-4 ${mutedClass}`}>
              Ask your administrator to resend the invitation, or{' '}
              <a href="/" className="text-blue-600 hover:underline">sign in</a> if you already have an account.
            </p>
          </div>
        )}

        {status === 'accepted' && (
          <div className="text-center py-8">
            <CheckCircleIcon sx={{ fontSize: 40 }} className="text-green-600 mb-2" />
            <h2 className={`text-lg font-semibold ${headingClass}`}>Account activated!</h2>
            <p className={`text-sm mt-2 ${mutedClass}`}>Taking you to your dashboard…</p>
          </div>
        )}

        {(status === 'valid' || status === 'submitting') && invitation && (
          <>
            <h2 className={`text-2xl font-bold mb-1 ${headingClass}`}>Welcome, {invitation.username}!</h2>
            <p className={`text-sm mb-6 ${mutedClass}`}>
              Set a password for <strong>{invitation.email}</strong> ({invitation.role}) to activate your account.
            </p>

            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${mutedClass}`}>Password</label>
                <input type="password" required minLength={8} value={password}
                  onChange={e => setPassword(e.target.value)} style={inputStyle}
                  className="w-full px-3 py-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${mutedClass}`}>Confirm Password</label>
                <input type="password" required minLength={8} value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)} style={inputStyle}
                  className="w-full px-3 py-2 border rounded-md outline-none" />
              </div>

              {errorMsg && (
                <div className="text-red-600 text-xs p-3 rounded bg-red-50 dark:bg-[rgba(248,81,73,0.15)] border border-red-200 dark:border-[rgba(248,81,73,0.5)]">
                  {errorMsg}
                </div>
              )}

              <button type="submit" disabled={status === 'submitting'}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50">
                {status === 'submitting' ? 'Activating…' : 'Activate Account & Sign In'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}