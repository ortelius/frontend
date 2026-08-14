import React from 'react'
import type { Metadata } from 'next'
import { SidebarProvider } from '@/context/SidebarContext' 
import { ThemeProvider } from '@/context/ThemeContext'
import { ExportProvider } from '@/context/ExportContext'
import { OrgProvider } from '@/context/OrgContext'
import { AuthProvider } from '@/context/AuthContext' 
import ExportManager from '@/components/ExportManager'
import TopNavigation from '@/components/TopNavigation'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Ortelius - Post-Deployment Vulnerability Dashboard',
    template: '%s | Ortelius'
  },
  description: 'Track and manage open-source vulnerabilities across deployed endpoints and releases.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#3b82f6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://app.ortelius.io" />
        <link rel="dns-prefetch" href="https://app.ortelius.io" />
        {/* FIX: script now removes 'dark' class if theme is light */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('ortelius_theme');
                  const isDark = theme === 'dark';
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  // Set the background color directly via inline style so the
                  // correct pixel is painted immediately, even if the
                  // stylesheet defining .dark's CSS variables hasn't finished
                  // loading yet — a class alone does nothing until its CSS
                  // rule is parsed, which is what causes a white flash in
                  // that gap.
                  document.documentElement.style.backgroundColor = isDark ? '#0d1117' : '#ffffff';
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ExportProvider>
              <OrgProvider>
                <SidebarProvider>
                  <div className="flex flex-col h-screen">
                    <TopNavigation />
                    <div className="flex flex-1 min-h-0">
                      <ExportManager />
                      {children}
                    </div>
                  </div>
                </SidebarProvider>
              </OrgProvider>
            </ExportProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}