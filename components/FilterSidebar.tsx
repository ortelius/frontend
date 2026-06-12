'use client'

interface FilterSidebarProps {
  filters: {
    vulnerabilityScore: string[]
    openssfScore: string[]
    name: string
    status?: string[]
    environment?: string[]
    endpointType?: string[]
    orgVisibility?: string[]  // 'myOrgs' | 'public'
  }
  setFilters: (filters: any) => void
  selectedCategory: string
  isLoggedIn?: boolean
}

export default function FilterSidebar({ filters, setFilters, selectedCategory, isLoggedIn }: FilterSidebarProps) {
  const handleCheckboxChange = (category: 'vulnerabilityScore' | 'openssfScore' | 'status' | 'environment' | 'endpointType' | 'orgVisibility', value: string) => {
    setFilters((prev: any) => {
      const currentValues = prev[category] || []
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v: string) => v !== value)
        : [...currentValues, value]

      return {
        ...prev,
        [category]: newValues,
      }
    })
  }

  const handleNameChange = (value: string) => {
    setFilters((prev: any) => ({
      ...prev,
      name: value,
    }))
  }

  const clearFilters = () => {
    setFilters({
      vulnerabilityScore: [],
      openssfScore: [],
      name: '',
      status: [],
      environment: [],
      endpointType: [],
      orgVisibility: ['myOrgs', 'public'],
    })
  }

  const hasActiveFilters = 
    filters.vulnerabilityScore.length > 0 || 
    filters.openssfScore.length > 0 || 
    filters.name !== '' ||
    (filters.status && filters.status.length > 0) ||
    (filters.environment && filters.environment.length > 0) ||
    (filters.endpointType && filters.endpointType.length > 0)

  const orgVisibility = filters.orgVisibility ?? ['myOrgs', 'public']

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Org visibility — only shown on the orgs page */}
        {selectedCategory === 'orgs' && (
          <div className="mb-5">
            <h4 className="text-sm font-medium text-gray-700 mb-2">View</h4>
            <div className="space-y-2">
              {isLoggedIn && (
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={orgVisibility.includes('myOrgs')}
                    onChange={() => handleCheckboxChange('orgVisibility', 'myOrgs')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">My Orgs</span>
                </label>
              )}
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={orgVisibility.includes('public')}
                  onChange={() => handleCheckboxChange('orgVisibility', 'public')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Public</span>
              </label>
            </div>
          </div>
        )}

        <div className="mb-5">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Name</h4>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Filter by name..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Synced Endpoints specific filters */}
        {selectedCategory === 'image' && (
          <>
            <div className="mb-5">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Status</h4>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.status?.includes('active') || false}
                    onChange={() => handleCheckboxChange('status', 'active')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Active</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.status?.includes('inactive') || false}
                    onChange={() => handleCheckboxChange('status', 'inactive')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Inactive</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.status?.includes('error') || false}
                    onChange={() => handleCheckboxChange('status', 'error')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Error</span>
                </label>
              </div>
            </div>

            <div className="mb-5">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Environment</h4>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.environment?.includes('production') || false}
                    onChange={() => handleCheckboxChange('environment', 'production')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Production</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.environment?.includes('staging') || false}
                    onChange={() => handleCheckboxChange('environment', 'staging')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Staging</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.environment?.includes('development') || false}
                    onChange={() => handleCheckboxChange('environment', 'development')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Development</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.environment?.includes('test') || false}
                    onChange={() => handleCheckboxChange('environment', 'test')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Test</span>
                </label>
              </div>
            </div>

            <div className="mb-5">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Endpoint Type</h4>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.endpointType?.includes('kubernetes') || false}
                    onChange={() => handleCheckboxChange('endpointType', 'kubernetes')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Kubernetes</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.endpointType?.includes('docker') || false}
                    onChange={() => handleCheckboxChange('endpointType', 'docker')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Docker</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.endpointType?.includes('vm') || false}
                    onChange={() => handleCheckboxChange('endpointType', 'vm')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">VM</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.endpointType?.includes('serverless') || false}
                    onChange={() => handleCheckboxChange('endpointType', 'serverless')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Serverless</span>
                </label>
              </div>
            </div>
          </>
        )}

        {/* Project Releases, Vulnerabilities, and Mitigations filters */}
        {(selectedCategory === 'all' || selectedCategory === 'plugin' || selectedCategory === 'mitigations') && (
          <>
            <div className="mb-5">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Vulnerability Score</h4>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.vulnerabilityScore.includes('critical')}
                    onChange={() => handleCheckboxChange('vulnerabilityScore', 'critical')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Critical</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.vulnerabilityScore.includes('high')}
                    onChange={() => handleCheckboxChange('vulnerabilityScore', 'high')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">High</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.vulnerabilityScore.includes('medium')}
                    onChange={() => handleCheckboxChange('vulnerabilityScore', 'medium')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Medium</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.vulnerabilityScore.includes('low')}
                    onChange={() => handleCheckboxChange('vulnerabilityScore', 'low')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Low</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.vulnerabilityScore.includes('clean')}
                    onChange={() => handleCheckboxChange('vulnerabilityScore', 'clean')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Clean</span>
                </label>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">OpenSSF Score</h4>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.openssfScore.includes('high')}
                    onChange={() => handleCheckboxChange('openssfScore', 'high')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">High (8.0+)</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.openssfScore.includes('medium')}
                    onChange={() => handleCheckboxChange('openssfScore', 'medium')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Medium (6.0-7.9)</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.openssfScore.includes('low')}
                    onChange={() => handleCheckboxChange('openssfScore', 'low')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Low (&lt;6.0)</span>
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}