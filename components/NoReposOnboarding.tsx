'use client'

/**
 * NoReposOnboarding
 *
 * Shown on the dashboard/releases page when the user is authenticated but
 * their org(s) have no watched repos yet. Guides them to watch their first
 * public GitHub or GitLab repo.
 *
 * Usage:
 *   import NoReposOnboarding from '@/components/NoReposOnboarding'
 *   ...
 *   {releases.length === 0 && <NoReposOnboarding orgs={user.orgs} />}
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/context/ThemeContext'
import GitHubIcon from '@mui/icons-material/GitHub'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

interface Props {
  /** The user's org list — links to the first org's settings page */
  orgs: string[]
  /** Optional: override the call-to-action destination */
  ctaHref?: string
}

export default function NoReposOnboarding({ orgs, ctaHref }: Props) {
  const router = useRouter()
  const { isDark } = useTheme()

  const destination = ctaHref ?? (orgs.length > 0 ? `/orgs/${orgs[0]}` : null)

  const border = isDark ? 'border-[#30363d]' : 'border-gray-200'
  const bg = isDark ? 'bg-[#161b22]' : 'bg-white'
  const text = isDark ? 'text-[#e6edf3]' : 'text-gray-900'
  const muted = isDark ? 'text-[#8b949e]' : 'text-gray-500'
  const accentBg = isDark ? 'bg-blue-900/20' : 'bg-blue-50'
  const accentBorder = isDark ? 'border-blue-800/50' : 'border-blue-200'
  const accentText = isDark ? 'text-blue-300' : 'text-blue-700'

  return (
    <div className={`rounded-xl border ${border} ${bg} p-10 flex flex-col items-center text-center gap-6 max-w-xl mx-auto mt-16`}>
      {/* Icon cluster */}
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className={`absolute inset-0 rounded-full ${accentBg} ${accentBorder} border`} />
        <GitHubIcon sx={{ fontSize: 32 }} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
      </div>

      {/* Heading */}
      <div>
        <h2 className={`text-xl font-semibold mb-2 ${text}`}>Nothing watched yet</h2>
        <p className={`text-sm leading-relaxed ${muted}`}>
          Watch a repo you deploy and we'll show you exactly which CVEs are running in production — not just in your code.
        </p>
      </div>

      {/* Steps */}
      <div className={`w-full rounded-lg border ${accentBorder} ${accentBg} p-4 text-left`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${accentText}`}>How it works</p>
        <ol className={`space-y-2 text-sm ${accentText}`}>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">1.</span>
            <span>Search for a repo you deploy — e.g. <strong>nginx</strong>, <strong>curl</strong>, <strong>redis</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">2.</span>
            <span>Click <strong>Watch</strong> — we'll scan it for known CVEs within ~10 minutes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">3.</span>
            <span>Come back and you'll see which versions have issues and which of your endpoints are running them</span>
          </li>
        </ol>
      </div>

      {/* CTA */}
      {destination ? (
        <button
          onClick={() => router.push(destination)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
          Watch your first repo
          <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </button>
      ) : (
        <p className={`text-sm ${muted}`}>
          Ask your org owner to watch repositories from the org settings page.
        </p>
      )}

      {/* Multi-org hint */}
      {orgs.length > 1 && (
        <div className={`flex flex-wrap gap-2 justify-center`}>
          {orgs.map(org => (
            <button
              key={org}
              onClick={() => router.push(`/orgs/${org}`)}
              className={`text-xs px-3 py-1 rounded-full border ${border} ${muted} hover:${text} transition-colors`}
            >
              {org}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}