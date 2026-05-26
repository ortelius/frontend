// lib/graphql.ts

// We use a variable instead of a const so we can update it dynamically
let activeGraphqlEndpoint: string | null = null

// Helper to get the endpoint.
async function getGraphqlEndpoint (): Promise<string> {
  if (activeGraphqlEndpoint !== null) {
    return activeGraphqlEndpoint
  }

  try {
    // 1. Updated to match the app/config/route.ts location
    const res = await fetch('/config')

    // 2. Safety check: ensure the response is valid JSON
    const contentType = res.headers.get('content-type')
    const isJson = contentType?.includes('application/json') === true

    if (!res.ok || !isJson) {
      console.warn(`Failed to fetch /config (Status: ${res.status}). Falling back to default.`)
      return 'http://localhost:3000/api/v1/graphql'
    }

    const data = await res.json()

    // 3. Explicitly extract graphqlEndpoint as the response now contains two endpoints
    if (typeof data.graphqlEndpoint === 'string') {
      activeGraphqlEndpoint = data.graphqlEndpoint
      return activeGraphqlEndpoint as string
    }
  } catch (error) {
    console.error('Error fetching GraphQL config:', error)
  }
  // Default fallback if config fails
  return 'http://localhost:3000/api/v1/graphql'
}

export async function graphqlQuery<T> (query: string, variables?: Record<string, any>): Promise<T> {
  const endpoint = await getGraphqlEndpoint()

  // [SECURE] We rely on the browser to send the HttpOnly cookie via credentials: 'include'.
  // We do NOT manually attach an Authorization header.

  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Ensure cookies are sent with the request
      body: JSON.stringify({
        query,
        variables
      })
    })
  } catch (error) {
    // Catch network errors (like "Failed to fetch") and log the endpoint being attempted
    console.error(`GraphQL Network Error: Failed to connect to ${endpoint}`, error)
    throw error
  }

  if (!response.ok) {
    // If endpoint is incorrect (e.g. results in a 404 HTML page), this throws the "Not Found" error
    throw new Error(`GraphQL request failed: ${response.statusText} (${response.status})`)
  }

  const json = await response.json()

  if ((json.errors != null) && json.errors.length > 0) {
    throw new Error((json.errors[0]?.message != null) ? json.errors[0].message : 'GraphQL query failed')
  }

  return json.data
}

// ------------------ QUERIES ------------------

export const GET_RELEASE = `
  query GetRelease($name: String!, $version: String!) {
    release(name: $name, version: $version) {
      key
      name
      version
      project_type
      content_sha
      dependency_count
      
      # Source Control Details
      git_commit
      git_branch
      git_tag
      git_repo
      git_org
      git_url
      git_repo_project
      git_verify_commit
      git_signed_off_by
      
      # Git Metrics
      git_commit_timestamp
      git_commit_authors
      git_committerscnt
      git_total_committerscnt
      git_contrib_percentage
      git_lines_added
      git_lines_deleted
      git_lines_total
      git_prev_comp_commit
      
      # Container Artifacts
      docker_repo
      docker_tag
      docker_sha
      basename
      
      # Build Environment
      build_date
      build_id
      build_num
      build_url
      
      # SBOM Content
      sbom {
        content
      }

      vulnerabilities {
        cve_id
        summary
        severity_score
        severity_rating
        package
        affected_version
        fixed_in
        full_purl
      }
      
      openssf_scorecard_score
      scorecard_result {
        Score
        Scorecard {
          Version
        }
        Checks {
          Name
          Score
          Reason
        }
      }
      
      synced_endpoint_count
      synced_endpoints {
        endpoint_name
        endpoint_url
        endpoint_type
        environment
        last_sync
        status
      }
    }
  }
`

export const GET_AFFECTED_RELEASES = `
  query GetAffectedReleases($severity: Severity!, $limit: Int, $org: String) {
    affectedReleases(severity: $severity, limit: $limit, org: $org) {
      cve_id
      summary
      severity_score
      severity_rating
      package
      affected_version
      fixed_in
      release_name
      release_version
      project_type
      openssf_scorecard_score
      dependency_count
      synced_endpoint_count
      vulnerability_count
      vulnerability_count_delta
      modified
      published
    }
  }
`

export const GET_ORG_AGGREGATED_RELEASES = `
  query GetOrgAggregatedReleases($severity: Severity!) {
    orgAggregatedReleases(severity: $severity) {
      org_name
      total_releases
      total_versions
      total_vulnerabilities
      critical_count
      high_count
      medium_count
      low_count
      max_severity_score
      avg_scorecard_score
      total_dependencies
      synced_endpoint_count
      vulnerability_count_delta
    }
  }
`

export const GET_SYNCED_ENDPOINTS = `
  query GetSyncedEndpoints($limit: Int, $org: String) {
    syncedEndpoints(limit: $limit, org: $org) {
      endpoint_name
      endpoint_url
      endpoint_type
      environment
      status
      last_sync
      release_count
      total_vulnerabilities {
        critical
        high
        medium
        low
      }
      releases {
        release_name
        release_version
      }
    }
  }
`

export const GET_AFFECTED_ENDPOINTS = `
  query GetAffectedEndpoints($name: String!, $version: String!) {
    affectedEndpoints(name: $name, version: $version) {
      endpoint_name
      endpoint_url
      endpoint_type
      environment
      last_sync
      status
      total_vulnerabilities {
        critical
        high
        medium
        low
      }
    }
  }
`

export const GET_MITIGATIONS = `
  query GetMitigations($limit: Int) {
    mitigations(limit: $limit) {
      cve_id
      summary
      severity_score
      severity_rating
      package
      affected_version
      fixed_in
      affected_releases
      affected_endpoints
    }
  }
`

export const GET_VULNERABILITIES = `
  query GetVulnerabilities($limit: Int, $org: String) {
    vulnerabilities(limit: $limit, org: $org) {
      cve_id
      summary
      severity_score
      severity_rating
      package
      affected_version
      fixed_in
      affected_releases
      affected_endpoints
      full_purl
    }
  }
`

export const GET_ENDPOINT_DETAILS = `
  query GetEndpointDetails($name: String!) {
    endpointDetails(name: $name) {
      endpoint_name
      endpoint_url
      endpoint_type
      environment
      status
      last_sync
      total_vulnerabilities {
        critical
        high
        medium
        low
      }
      vulnerability_count_delta
      releases {
        release_name
        release_version
        openssf_scorecard_score
        dependency_count
        last_sync
        vulnerability_count
        vulnerability_count_delta
        vulnerabilities {
          cve_id
          summary
          severity_score
          severity_rating
          package
          affected_version
          fixed_in
          full_purl
        }
      }
    }
  }
`

export const GET_DASHBOARD_VULNERABILITY_TREND = `
  query GetDashboardVulnerabilityTrend($days: Int, $org: String) {
    dashboardVulnerabilityTrend(days: $days, org: $org) {
      date
      critical
      high
      medium
      low
    }
  }
`

export const GET_DASHBOARD_GLOBAL_STATUS = `
  query DashboardGlobalStatus($org: String) {
    dashboardGlobalStatus(org: $org) {
      critical { count delta }
      high { count delta }
      medium { count delta }
      low { count delta }
      total_count
      total_delta
      high_risk_backlog
      high_risk_delta
    }
  }
`

export const GET_MTTR_ANALYSIS = `
  query MTTRAnalysis($days: Int!, $org: String) {
    dashboardMTTR(days: $days, org: $org) {
      executive_summary {
        total_new_cves
        total_fixed_cves
        post_deployment_cves
        mttr_all
        mttr_post_deployment
        mean_open_age_all
        mean_open_age_post_deploy
        open_cves_beyond_sla_pct
        oldest_open_critical_days
        backlog_delta
        fixed_within_sla_pct
      }
      by_severity {
        severity
        mttr
        mttr_post_deployment
        fixed_within_sla_pct
        backlog_count
        mean_open_age
        mean_open_age_post_deploy
        oldest_open_days
        open_beyond_sla_pct
        open_beyond_sla_count
        new_detected
        remediated
        open_count
      }
      endpoint_impact {
        affected_endpoints_count
        post_deployment_cves_by_type {
          type
          count
        }
      }
    }
  }
`

export const GET_RELEASE_TIMELINE = `
  query GetReleaseTimeline($name: String!) {
    releaseTimeline(name: $name) {
      version
      build_date
      endpoint_count
      critical_count
      high_count
      medium_count
      low_count
      total_cves
      content_sha
      is_latest
    }
  }
`
