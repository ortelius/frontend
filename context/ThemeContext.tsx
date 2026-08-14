'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Function to get initial theme from localStorage (only runs on client)
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const stored = localStorage.getItem('ortelius_theme')
    return stored === 'dark'
  } catch {
    return false
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with localStorage value to match the blocking script
  const [isDark, setIsDark] = useState(getInitialTheme)
  const [mounted, setMounted] = useState(false)

  // Sync with localStorage changes and ensure DOM is updated
  useEffect(() => {
    const stored = localStorage.getItem('ortelius_theme')
    const shouldBeDark = stored === 'dark'
    
    // Update state if it doesn't match localStorage
    if (shouldBeDark !== isDark) {
      setIsDark(shouldBeDark)
    }
    
    // Ensure the DOM class matches the state
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Only now is it safe to render isDark-conditional JSX: any component
    // reading `isDark` from context (vs. Tailwind's dark: variant, which is
    // CSS-driven and safe from the very first paint) computes its styling
    // in JS at render time. During SSR that JS always sees isDark=false
    // (no localStorage on the server), so that content is baked into the
    // HTML wrong and flashes light until this effect runs and re-renders.
    // Holding off on `children` until here — and showing a dark:-class-based
    // shell in the meantime, which IS safe pre-hydration — closes that gap.
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setIsDark((prev) => {
      const newState = !prev
      localStorage.setItem('ortelius_theme', newState ? 'dark' : 'light')
      if (newState) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return newState
    })
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {mounted ? children : <div className="min-h-screen bg-white dark:bg-[#0d1117]" />}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}