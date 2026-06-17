'use client'

import React, { useEffect } from 'react'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

interface ToastProps {
  message: string
  onDismiss: () => void
  durationMs?: number
  actionLabel?: string
  onAction?: () => void
}

/**
 * Lightweight, self-dismissing toast. Fixed to the bottom-center of the
 * viewport so it works regardless of which page mounts it. Intentionally
 * has no queueing/stacking logic — only one toast is expected on screen
 * at a time for the current use cases (e.g. "sign in to favorite").
 */
export default function Toast({ message, onDismiss, durationMs = 4000, actionLabel, onAction }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(timer)
  }, [onDismiss, durationMs])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-fadeIn">
      <div className="flex items-center gap-3 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-sm">
        <InfoOutlinedIcon sx={{ fontSize: 18 }} className="text-blue-300 flex-shrink-0" />
        <span className="flex-1">{message}</span>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-blue-300 font-semibold hover:text-blue-200 flex-shrink-0 whitespace-nowrap"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}