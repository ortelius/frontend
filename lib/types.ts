// lib/types.ts

// --- Dashboard & MTTR Metrics ---

export interface DetailedSeverityMetrics {
  severity: string

  // A. Remediation Effectiveness
  mttr: number
  mttr_post_deployment: number
  fixed_within_sla_pct: number

  // B. Active Risk Exposure
  mean_open_age: number
  mean_open_age_post_deploy: number
  oldest_open_days: number

  // C. SLA Compliance
  open_beyond_sla_pct: number
  open_beyond_sla_count: number

  // D. Volume & Flow
  new_detected: number
  remediated: number
  backlog_count: number
  open_count: number
}

export interface ExecutiveSummary {
  total_new_cves: number
  total_fixed_cves: number
  post_deployment_cves: number
  mttr_all: number
  mttr_post_deployment: number
  mean_open_age_all: number
  mean_open_age_post_deploy: number
  open_cves_beyond_sla_pct: number
  oldest_open_critical_days: number
  backlog_delta: number
  fixed_within_sla_pct?: number
}

export interface EndpointImpactCount {
  type: string
  count: number
}

export interface EndpointImpactMetrics {
  affected_endpoints_count: number
  post_deployment_cves_by_type: EndpointImpactCount[]
}

export interface MTTRAnalysis {
  executive_summary: ExecutiveSummary
  by_severity: DetailedSeverityMetrics[]
  endpoint_impact: EndpointImpactMetrics
}

export interface GetMTTRAnalysisResponse {
  dashboardMTTR: MTTRAnalysis
}

export interface VulnerabilityTrend {
  date: string
  critical: number
  high: number
  medium: number
  low: number
}

export interface GetVulnerabilityTrendResponse {
  dashboardVulnerabilityTrend: VulnerabilityTrend[]
}

export interface SeverityMetric {
  count: number
  delta: number
}

export interface DashboardGlobalStatus {
  critical: SeverityMetric
  high: SeverityMetric
  medium: SeverityMetric
  low: SeverityMetric
  total_count: number
  total_delta: number
  high_risk_backlog: number
  high_risk_delta: number
}

export interface GetDashboardGlobalStatusResponse {
  dashboardGlobalStatus: DashboardGlobalStatus
}

// --- Application Core Types ---

export interface Vulnerability {
  cve_id: string
  summary?: string
  severity_score?: number
  severity_rating: string
  package: string
  affected_version?: string
  fixed_in?: string[]
  full_purl?: string
}

export interface SyncedEndpoint {
  endpoint_name: string
  endpoint_url: string
  endpoint_type: string
  environment: string
  last_sync: string
  status: string
  release_count?: number
  total_vulnerabilities: {
    critical: number
    high: number
    medium: number
    low: number
  }
  releases?: Array<{ release_name: string, release_version: string }>
}

export interface Release {
  key?: string
  name: string
  version: string
  project_type?: string
  content_sha?: string
  dependency_count: number
  vulnerabilities: Vulnerability[]
  openssf_scorecard_score?: number
  synced_endpoint_count?: number
  synced_endpoints?: SyncedEndpoint[]

  // Detailed fields for Build/Source info
  sbom?: { content: string }
  git_commit?: string
  git_branch?: string
  git_tag?: string
  git_repo?: string
  git_org?: string
  git_url?: string
  git_repo_project?: string
  docker_repo?: string
  docker_tag?: string
  docker_sha?: string
  basename?: string
  git_verify_commit?: boolean
  git_signed_off_by?: string
  git_commit_timestamp?: string
  git_commit_authors?: string
  git_committerscnt?: string
  git_total_committerscnt?: string
  git_contrib_percentage?: string
  git_lines_added?: string
  git_lines_deleted?: string
  git_lines_total?: string
  git_prev_comp_commit?: string
  build_date?: string
  build_id?: string
  build_num?: string
  build_url?: string
  scorecard_result?: {
    Score: number
    Scorecard: { Version: string }
    Checks: Array<{ Name: string, Score: number, Reason: string }>
  }
}

export interface GetReleaseResponse {
  release: Release
}

export interface AffectedRelease {
  cve_id: string
  summary?: string
  severity_score?: number
  severity_rating: string
  package: string
  affected_version?: string
  fixed_in?: string[]
  release_name: string
  release_version: string
  project_type?: string
  openssf_scorecard_score?: number
  dependency_count: number
  synced_endpoint_count?: number
  vulnerability_count?: number
  vulnerability_count_delta?: number
  modified: string
  published?: string
  version_count?: number
  is_latest: boolean
}

export interface GetAffectedReleasesResponse {
  affectedReleases: AffectedRelease[]
}

export interface AffectedEndpoint {
  endpoint_name: string
  endpoint_url: string
  endpoint_type: string
  environment: string
  last_sync: string
  status: string
  total_vulnerabilities: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

export interface GetAffectedEndpointsResponse {
  affectedEndpoints: AffectedEndpoint[]
}

export interface GetSyncedEndpointsResponse {
  syncedEndpoints: SyncedEndpoint[]
}

export interface Mitigation {
  cve_id: string
  summary: string
  severity_score: number
  severity_rating: string
  package: string
  affected_version?: string
  fixed_in?: string[]
  affected_releases?: number
  affected_endpoints?: number
  full_purl?: string
}

export interface GetVulnerabilitiesResponse {
  vulnerabilities: Mitigation[]
}

export interface ImageData {
  name: string
  version: string
  releaseDate: string
  publisher: string
  description: string
  pulls: string
  updated: string
  verified: boolean
  official: boolean
  tags: string[]
  longDescription?: string
  vulnerabilities: {
    critical: number
    high: number
    medium: number
    low: number
  }
  dependency_count: number
  signed: boolean
  openssfScore: number
  syncedEndpoints: number
  version_count: number
  total_vulnerabilities: number
  vulnerability_count_delta: number
  is_latest: boolean
}

// --- Org Aggregation Types ---

export interface OrgAggregatedRelease {
  org_name: string
  total_releases: number
  total_versions: number
  total_vulnerabilities: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  max_severity_score: number
  avg_scorecard_score?: number
  total_dependencies: number
  synced_endpoint_count: number
  vulnerability_count_delta?: number
}

export interface GetOrgAggregatedReleasesResponse {
  orgAggregatedReleases: OrgAggregatedRelease[]
}

export interface ReleaseTimelineEntry {
  version: string
  build_date: string | null
  endpoint_count: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  total_cves: number
  content_sha: string
  is_latest: boolean
}

export interface GetReleaseTimelineResponse {
  releaseTimeline: ReleaseTimelineEntry[]
}

 export interface OrgAggregatedRelease {
   org_name: string
   total_releases: number
   total_versions: number
   total_vulnerabilities: number
   critical_count: number
   high_count: number
   medium_count: number
   low_count: number
   max_severity_score: number | null
   avg_scorecard_score: number | null
   total_dependencies: number
   synced_endpoint_count: number
   vulnerability_count_delta: number | null
   pending_scan?: boolean   // ← ADD THIS
 }