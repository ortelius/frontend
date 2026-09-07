'use client'

import React, { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import SearchResults from '@/components/SearchResults'
import Sidebar from '@/components/Sidebar'

function ReleasesContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const [filters, setFilters] = useState({
    vulnerabilityScore: [] as string[],
    openssfScore: [] as string[],
    name: '',
    status: [] as string[],
    environment: [] as string[],
    endpointType: [] as string[],
    packageFilter: '',
    searchCVE: '',
  })

  return (
    <>
      <Sidebar filters={filters} setFilters={setFilters} selectedCategory="all" />
      <SearchResults 
        query={query} 
        category="all"
        filters={filters}
      />
    </>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-600">Loading releases...</div>}>
      <ReleasesContent />
    </Suspense>
  )
}