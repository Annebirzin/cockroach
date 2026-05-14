// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

// =============================================================================
// API contract for the Plan Pinning feature.
// =============================================================================
//
// This file is the FE↔BE contract. Backend implementation must honor these
// response shapes; FE hooks (currently mocked via pinnedPlans.fixture.ts) read
// these shapes. When the backend lands, replace the fixtures with real fetches
// and the FE wiring stays unchanged.
//
// All endpoints sit under the existing /api/v2 namespace (see
// pkg/ui/workspaces/cluster-ui/src/api/ for peer endpoint clients).
//
// Authorization: all writes require the new MANAGEPLAN system privilege. Reads
// require the standard table-level privilege on the underlying statement
// stats system tables. A 403 from any endpoint is rendered as the
// "Permission denied" UI state (see spec.md §2.10.4).
//
// Time handling: the BE returns RFC3339 strings; the FE parses them into
// Date objects at the SWR/saga boundary. Existing cluster-ui pattern.
// =============================================================================

// -----------------------------------------------------------------------------
// Domain types
// -----------------------------------------------------------------------------

/**
 * A single pinned plan, representing one row in the All Pinned Plans table.
 * Backed server-side by the new system.statement_activity_pinned_plans table
 * joined against statement_activity for the rate computations.
 */
export interface PinnedPlan {
  /** Statement fingerprint (parameterized SQL string). */
  statementFingerprint: string;
  /** Stable hash for this fingerprint; links to the statement detail page. */
  fingerprintID: string;
  /** Database the plan was created in. */
  database: string;
  /** plan_gist — opaque hash identifying this specific execution plan. */
  gist: string;
  /** Username of the actor who pinned the plan. */
  pinnedBy: string;
  /** When the pin was created. */
  pinnedAt: Date;
  /**
   * Total executions of THIS pinned plan in the time window. Computed by
   * counting rows in statement_activity where plan_gist matches.
   */
  executions: number;
  /**
   * Subset of executions where the pin overrode the optimizer's choice
   * (i.e., the optimizer would have picked a different plan_gist absent
   * the pin). Drives the Pin override rate column.
   */
  overridden: number;
  /**
   * Pin applied rate, 0–100. Percentage of fingerprint executions that used
   * this plan. Computed as (executions of this gist) / (total executions of
   * the fingerprint) * 100. Drives the Pin applied rate column.
   */
  coverage: number;
  /** Average per-execution latency in seconds. */
  avgLatency: number;
  /** Most recent execution of this pinned plan. */
  lastExecTime: Date;
}

/**
 * Audit log entry — every pin/unpin action is recorded for compliance.
 * Backed server-side by the new system.pinned_plan_audit_log table (or
 * piggy-backed onto an existing audit log mechanism if one exists).
 */
export interface AuditLogEntry {
  action: "Pinned" | "Unpinned";
  /** plan_gist that was pinned or unpinned. */
  gist: string;
  fingerprintID: string;
  /** Username of the actor who performed the action. */
  user: string;
  /** When the action occurred. */
  timestamp: Date;
  /** Statement fingerprint (parameterized SQL string). */
  statement: string;
}

/**
 * Drift Analysis row. **Out of scope for V1** — gated behind DRIFT_ENABLED.
 * Documented here so the BE side knows what would eventually be computed.
 *
 * "Drift" = the optimizer's preferred plan diverges from the pinned plan.
 * Computing this requires the optimizer to record what it would have chosen
 * absent the pin; that telemetry doesn't exist yet.
 */
export interface DriftAlert {
  fingerprintID: string;
  statement: string;
  /** plan_gist of the currently-pinned plan. */
  pinnedGist: string;
  /** plan_gist of the plan the optimizer would have chosen instead. */
  candidateGist: string;
  /** Number of executions where the pin overrode the candidate. */
  wouldHaveExecuted: number;
  /** Most recent execution where the pin overrode the candidate. */
  lastWouldHaveExecuted: Date;
  /** Whether the candidate would have been faster (improvement) or slower (risk). */
  assessment: "potential-improvement" | "regression-risk";
  /** candidateLatency - pinnedLatency, in seconds (negative = candidate is faster). */
  latencyDelta: number;
  /** Avg per-execution latency of the pinned plan, in seconds. */
  pinnedLatency: number;
  /** Avg per-execution latency of the candidate plan, in seconds. */
  candidateLatency: number;
}

// -----------------------------------------------------------------------------
// Endpoint: GET /api/v2/pinned_plans
// -----------------------------------------------------------------------------
//
// Lists all pinned plans visible to the current user. Time range narrows the
// rate computations (`coverage`, `overridden` are computed over executions in
// [from_ts, to_ts]). The list of pinned plans themselves is independent of
// the time range — a pin that's never executed in the window still appears
// with executions=0 and coverage=0.
//
// Query params:
//   from_ts  RFC3339 (optional) — defaults to now() - 1h
//   to_ts    RFC3339 (optional) — defaults to now()
//
// Errors:
//   403  user lacks read access to statement statistics
//   500  underlying query failed → renders as the page-level InlineAlert (§2.10.3)

export interface ListPinnedPlansResponse {
  pinnedPlans: PinnedPlan[];
}

// -----------------------------------------------------------------------------
// Endpoint: POST /api/v2/pinned_plans
// -----------------------------------------------------------------------------
//
// Pins a specific plan_gist for a fingerprint. The optimizer will honor this
// hint on subsequent executions (subject to the plan still being valid —
// see VALIDATION error below).
//
// Errors:
//   400 VALIDATION       plan_gist references columns/indexes that no longer
//                        exist → renders as the modal inline error (§2.10.2).
//   403 PERMISSION_DENIED user lacks MANAGEPLAN → never expected; FE disables
//                        the button up front (§2.10.4). If it does occur,
//                        renders as the action toast (§2.10.1).
//   409 STALE            another user already changed the pin state for this
//                        fingerprint → renders as the modal inline error.
//   503 UNAVAILABLE      hint store unreachable → renders as the modal
//                        inline error.

export interface PinPlanRequest {
  fingerprintID: string;
  gist: string;
}

export interface PinPlanResponse {
  pinnedPlan: PinnedPlan;
}

// -----------------------------------------------------------------------------
// Endpoint: DELETE /api/v2/pinned_plans/:gist
// -----------------------------------------------------------------------------
//
// Unpins a previously-pinned plan. Returns the timestamp of the unpin so the
// FE can update the audit log without a refetch.
//
// Errors: same as POST.

export interface UnpinPlanResponse {
  /** When the unpin was committed (RFC3339 → Date at the FE boundary). */
  unpinnedAt: Date;
}

// -----------------------------------------------------------------------------
// Endpoint: GET /api/v2/pinned_plans/audit
// -----------------------------------------------------------------------------
//
// Returns the audit log entries within a time window. Pagination via cursor
// to be added if entry counts grow large.

export interface ListAuditLogResponse {
  entries: AuditLogEntry[];
}

// -----------------------------------------------------------------------------
// Error envelope
// -----------------------------------------------------------------------------
//
// All write endpoints return errors in this shape so the FE can dispatch
// the right error pattern (toast vs modal inline alert vs disabled state).
// Read errors don't need the discriminator — any failure routes to the
// page-level InlineAlert.

export type PinnedPlansApiErrorCode =
  | "VALIDATION"
  | "PERMISSION_DENIED"
  | "STALE"
  | "UNAVAILABLE"
  | "INTERNAL";

export interface PinnedPlansApiError {
  code: PinnedPlansApiErrorCode;
  /** Human-readable message — surfaced verbatim in the InlineAlert. */
  message: string;
}
