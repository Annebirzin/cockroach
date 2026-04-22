// Copyright 2025 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { Tooltip } from "@cockroachlabs/ui-components";
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet";

import { PinPlanModal, usePinPlanModal } from "./pinPlanModal";

// Font family matching the DB Console SortedTable
const fontFamily = "SourceSansPro-Regular, Source Sans Pro, sans-serif";

// Table styles matching the SortedTable / statement fingerprint table
const tableStyle: React.CSSProperties = {
  width: "fit-content",
  minWidth: "100%",
  borderCollapse: "collapse",
  fontFamily,
  fontWeight: 400,
  lineHeight: "22px",
  fontSize: "14px",
  color: "#394455",
};

const thStyle: React.CSSProperties = {
  padding: "11px 16px 11px 8px",
  textAlign: "left",
  fontSize: "14px",
  color: "#475872",
  backgroundColor: "#ffffff",
  borderBottom: "1px solid #d6dbe7",
  whiteSpace: "nowrap",
  fontFamily: "SourceSansPro-SemiBold, Source Sans Pro, sans-serif",
  fontWeight: "normal",
};

// First column header gets extra left padding
const thFirstStyle: React.CSSProperties = { ...thStyle, paddingLeft: "24px" };

const tdStyle: React.CSSProperties = {
  padding: "8px",
  border: "none",
  fontFamily,
  fontWeight: 300,
  fontSize: "14px",
  lineHeight: "22px",
  letterSpacing: "0.3px",
  color: "#394455",
  verticalAlign: "middle",
};

// First column cells get extra left padding
const tdFirstStyle: React.CSSProperties = { ...tdStyle, paddingLeft: "24px" };

const rowStyle: React.CSSProperties = {
  height: "70px",
  borderTop: "1px solid transparent",
  borderBottom: "1px solid #d6dbe7",
  backgroundColor: "#ffffff",
};

// Mock data for the pinned plans dashboard
const mockPinnedPlans = [
  // INSERT INTO rides — 2 pinned (both active)
  {
    statementFingerprint:
      "INSERT INTO rides VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)",
    fingerprintID: "5193222733586324267",
    database: "movr",
    gist: "AiAC2AEB",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-27T14:30:00"),
    status: "active" as const,
    executions: 507,
    overridden: 61,
    avgLatency: 0.0029,
    lastExecTime: new Date("2026-04-03T13:04:00"),
  },
  {
    statementFingerprint:
      "INSERT INTO rides VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)",
    fingerprintID: "5193222733586324267",
    database: "movr",
    gist: "AiAC2AEC",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-25T10:00:00"),
    status: "active" as const,
    executions: 152,
    overridden: 23,
    avgLatency: 0.0041,
    lastExecTime: new Date("2026-04-02T09:15:00"),
  },
  // SELECT count(*) FROM user_promo_codes — 1 active + 1 invalid
  {
    statementFingerprint:
      "SELECT count(*) FROM user_promo_codes WHERE ((city = $1) AND (user_id = $2)) AND (code = $3)",
    fingerprintID: "7562955041576980258",
    database: "movr",
    gist: "AgHeAQIABwIAAAUADAYC",
    pinnedBy: "dba_admin",
    pinnedAt: new Date("2026-03-26T09:15:00"),
    status: "active" as const,
    executions: 120,
    overridden: 8,
    avgLatency: 0.0026,
    lastExecTime: new Date("2026-04-03T13:04:00"),
  },
  {
    statementFingerprint:
      "SELECT count(*) FROM user_promo_codes WHERE ((city = $1) AND (user_id = $2)) AND (code = $3)",
    fingerprintID: "7562955041576980258",
    database: "movr",
    gist: "AgHeAQIABwIAAAUADAYE",
    pinnedBy: "dba_admin",
    pinnedAt: new Date("2026-03-24T11:30:00"),
    status: "invalid" as const,
    invalidReason: "Statistics stale: table schema changed since pin was created",
    executions: 0,
    overridden: 0,
    avgLatency: 0,
    lastExecTime: new Date("2026-03-24T16:00:00"),
  },
  // SELECT city, id FROM vehicles — 1 invalid + 1 active
  {
    statementFingerprint:
      "SELECT city, id FROM vehicles WHERE city = $1",
    fingerprintID: "3350546850174482743",
    database: "movr",
    gist: "AgHWAQQAAwIAAAYE",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-25T11:00:00"),
    status: "invalid" as const,
    invalidReason: "Referenced index 'vehicles@idx_city_status' was dropped",
    executions: 0,
    overridden: 0,
    avgLatency: 0,
    lastExecTime: new Date("2026-03-25T16:30:00"),
  },
  {
    statementFingerprint:
      "SELECT city, id FROM vehicles WHERE city = $1",
    fingerprintID: "3350546850174482743",
    database: "movr",
    gist: "AgHWAQQAAwIAAAYF",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-26T08:00:00"),
    status: "active" as const,
    executions: 8934,
    overridden: 412,
    avgLatency: 0.0011,
    lastExecTime: new Date("2026-04-03T13:05:00"),
  },
  // UPSERT INTO vehicle_location_histories — 2 pinned (both active)
  {
    statementFingerprint:
      "UPSERT INTO vehicle_location_histories VALUES ($1, $2, now(), $3, $4)",
    fingerprintID: "7442192024002430332",
    database: "movr",
    gist: "AgICCgUOMCLaAQAxBQQUBdgBAgQBKg==",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-03-24T08:45:00"),
    status: "active" as const,
    executions: 12378,
    overridden: 1856,
    avgLatency: 0.0008,
    lastExecTime: new Date("2026-04-03T13:05:00"),
  },
  {
    statementFingerprint:
      "UPSERT INTO vehicle_location_histories VALUES ($1, $2, now(), $3, $4)",
    fingerprintID: "7442192024002430332",
    database: "movr",
    gist: "AgICCgUOMCLaAQAxBQQUBQ==",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-03-22T14:30:00"),
    status: "active" as const,
    executions: 3710,
    overridden: 540,
    avgLatency: 0.0012,
    lastExecTime: new Date("2026-04-02T22:10:00"),
  },
  // INSERT INTO user_promo_codes — 2 pinned (both active)
  {
    statementFingerprint:
      "INSERT INTO user_promo_codes VALUES ($1, $2, $3, now(), $4)",
    fingerprintID: "3939633309730011619",
    database: "movr",
    gist: "AiAC3gEB",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-20T15:20:00"),
    status: "active" as const,
    executions: 116,
    overridden: 0,
    avgLatency: 0.0041,
    lastExecTime: new Date("2026-04-03T13:04:00"),
  },
  {
    statementFingerprint:
      "INSERT INTO user_promo_codes VALUES ($1, $2, $3, now(), $4)",
    fingerprintID: "3939633309730011619",
    database: "movr",
    gist: "AiAC3gEC",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-18T09:45:00"),
    status: "active" as const,
    executions: 34,
    overridden: 0,
    avgLatency: 0.0058,
    lastExecTime: new Date("2026-04-01T11:20:00"),
  },
];

const mockDriftAlerts = [
  {
    fingerprintID: "5193222733586324267",
    statement:
      "INSERT INTO rides VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)",
    pinnedGist: "AiAC2AEB",
    candidateGist: "AiAC2AEC",
    wouldHaveExecuted: 342,
    lastWouldHaveExecuted: new Date("2026-03-27T19:58:00"),
    assessment: "potential-improvement" as const,
    latencyDelta: -0.0004,
    pinnedLatency: 0.0029,
    candidateLatency: 0.0025,
  },
  {
    fingerprintID: "7442192024002430332",
    statement:
      "UPSERT INTO vehicle_location_histories VALUES ($1, $2, now(), $3, $4)",
    pinnedGist: "AgICCgUOMCLaAQAxBQQUBdgBAgQBKQ==",
    candidateGist: "AgICCgUOMCLaAQAxBQQUBdgBAgQBKg==",
    wouldHaveExecuted: 1203,
    lastWouldHaveExecuted: new Date("2026-03-27T20:02:00"),
    assessment: "regression-risk" as const,
    latencyDelta: 0.0012,
    pinnedLatency: 0.0008,
    candidateLatency: 0.002,
  },
  {
    fingerprintID: "7562955041576980258",
    statement:
      "SELECT count(*) FROM user_promo_codes WHERE ((city = $1) AND (user_id = $2)) AND (code = $3)",
    pinnedGist: "AgHeAQIABwIAAAUADAYC",
    candidateGist: "AgHeAQIABwIAAAUADAYD",
    wouldHaveExecuted: 18,
    lastWouldHaveExecuted: new Date("2026-03-27T18:30:00"),
    assessment: "pin-invalid" as const,
    latencyDelta: 0.0031,
    pinnedLatency: 0.0026,
    candidateLatency: 0.0057,
  },
];

const mockAuditLog = [
  {
    action: "Pinned",
    gist: "AiAC2AEB",
    fingerprintID: "5193222733586324267",
    user: "root",
    timestamp: new Date("2026-03-27T14:30:00"),
    statement: "INSERT INTO rides VALUES ($1, $2, ...)",
  },
  {
    action: "Pinned",
    gist: "AgHWAQQAAwIAAAYF",
    fingerprintID: "3350546850174482743",
    user: "root",
    timestamp: new Date("2026-03-26T08:00:00"),
    statement: "SELECT city, id FROM vehicles...",
  },
  {
    action: "Pinned",
    gist: "AgHeAQIABwIAAAUADAYC",
    fingerprintID: "7562955041576980258",
    user: "dba_admin",
    timestamp: new Date("2026-03-26T09:15:00"),
    statement: "SELECT count(*) FROM user_promo_codes...",
  },
  {
    action: "Pinned",
    gist: "AiAC2AEC",
    fingerprintID: "5193222733586324267",
    user: "root",
    timestamp: new Date("2026-03-25T10:00:00"),
    statement: "INSERT INTO rides VALUES ($1, $2, ...)",
  },
  {
    action: "Pinned",
    gist: "AgHWAQQAAwIAAAYE",
    fingerprintID: "3350546850174482743",
    user: "root",
    timestamp: new Date("2026-03-25T11:00:00"),
    statement: "SELECT city, id FROM vehicles...",
  },
  {
    action: "Unpinned",
    gist: "AgHWAQQAAwIAAAYE",
    fingerprintID: "3350546850174482743",
    user: "root",
    timestamp: new Date("2026-03-25T10:55:00"),
    statement: "SELECT city, id FROM vehicles...",
  },
  {
    action: "Pinned",
    gist: "AgHeAQIABwIAAAUADAYE",
    fingerprintID: "7562955041576980258",
    user: "dba_admin",
    timestamp: new Date("2026-03-24T11:30:00"),
    statement: "SELECT count(*) FROM user_promo_codes...",
  },
  {
    action: "Pinned",
    gist: "AgICCgUOMCLaAQAxBQQUBdgBAgQBKg==",
    fingerprintID: "7442192024002430332",
    user: "sre_oncall",
    timestamp: new Date("2026-03-24T08:45:00"),
    statement: "UPSERT INTO vehicle_location_histories...",
  },
  {
    action: "Pinned",
    gist: "AgICCgUOMCLaAQAxBQQUBQ==",
    fingerprintID: "7442192024002430332",
    user: "sre_oncall",
    timestamp: new Date("2026-03-22T14:30:00"),
    statement: "UPSERT INTO vehicle_location_histories...",
  },
  {
    action: "Pinned",
    gist: "AiAC3gEB",
    fingerprintID: "3939633309730011619",
    user: "root",
    timestamp: new Date("2026-03-20T15:20:00"),
    statement: "INSERT INTO user_promo_codes VALUES...",
  },
  {
    action: "Pinned",
    gist: "AiAC3gEC",
    fingerprintID: "3939633309730011619",
    user: "root",
    timestamp: new Date("2026-03-18T09:45:00"),
    statement: "INSERT INTO user_promo_codes VALUES...",
  },
];

function formatDuration(seconds: number): string {
  if (seconds === 0) return "\u2014";
  if (seconds < 0.001) return `${(seconds * 1e6).toFixed(0)} \u00B5s`;
  if (seconds < 1) return `${(seconds * 1e3).toFixed(1)} ms`;
  return `${seconds.toFixed(2)} s`;
}

function PlanPinBadge({
  status,
  reason,
}: {
  status: "active" | "invalid";
  reason?: string;
}): React.ReactElement {
  const isInvalid = status === "invalid";
  return (
    <span
      title={reason}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0 8px",
        borderRadius: "3px",
        fontSize: "12px",
        fontWeight: 600,
        height: "28px",
        whiteSpace: "nowrap",
        backgroundColor: isInvalid ? "#ffe9eb" : "#e1ecff",
        color: isInvalid ? "#cd2939" : "#0037a5",
        cursor: reason ? "help" : "default",
      }}
    >
      {isInvalid ? "Invalid pin" : "Pinned"}
    </span>
  );
}

type TabType = "overview" | "drift" | "audit";

interface SortConfig {
  column: string;
  ascending: boolean;
}

function SortArrows({ column, sortConfig }: { column: string; sortConfig: SortConfig | null }): React.ReactElement {
  const isActive = sortConfig?.column === column;
  const upColor = isActive && sortConfig?.ascending ? "#0055ff" : "#c0c6d9";
  const downColor = isActive && !sortConfig?.ascending ? "#0055ff" : "#c0c6d9";
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: "6px", verticalAlign: "middle", gap: "2px" }}>
      <span style={{ width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderBottom: `4px solid ${upColor}` }} />
      <span style={{ width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: `4px solid ${downColor}` }} />
    </span>
  );
}

function SortableHeader({
  label,
  column,
  sortConfig,
  onSort,
  style,
}: {
  label: string;
  column: string;
  sortConfig: SortConfig | null;
  onSort: (column: string) => void;
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <th
      style={{ ...thStyle, ...style, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(column)}
    >
      {label}
      <SortArrows column={column} sortConfig={sortConfig} />
    </th>
  );
}

function sortData<T>(data: T[], sortConfig: SortConfig | null, getters: Record<string, (item: T) => string | number | Date>): T[] {
  if (!sortConfig) return data;
  const getter = getters[sortConfig.column];
  if (!getter) return data;
  return [...data].sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    let cmp = 0;
    if (va < vb) cmp = -1;
    else if (va > vb) cmp = 1;
    return sortConfig.ascending ? cmp : -cmp;
  });
}

export function PinnedPlansPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [overviewSort, setOverviewSort] = useState<SortConfig | null>(null);
  const [driftSort, setDriftSort] = useState<SortConfig | null>(null);
  const [auditSort, setAuditSort] = useState<SortConfig | null>(null);
  const [pinnedCandidates, setPinnedCandidates] = useState<Set<string>>(new Set());
  // Track which plans have been "unpinned" on the overview table (mock interaction)
  const [unpinnedOverview, setUnpinnedOverview] = useState<Set<string>>(new Set());
  const [unpinnedDrift, setUnpinnedDrift] = useState<Set<string>>(new Set());

  const pinModal = usePinPlanModal();

  const showPinModal = useCallback(
    (action: "pin" | "unpin", gist: string, target: "overview" | "drift" | "candidate") => {
      const onConfirm = () => {
        if (target === "overview") {
          setUnpinnedOverview(prev => {
            const next = new Set(prev);
            if (action === "unpin") next.add(gist);
            else next.delete(gist);
            return next;
          });
        } else if (target === "drift") {
          setUnpinnedDrift(prev => {
            const next = new Set(prev);
            if (action === "unpin") next.add(gist);
            else next.delete(gist);
            return next;
          });
        } else if (target === "candidate") {
          setPinnedCandidates(prev => {
            const next = new Set(prev);
            if (action === "pin") next.add(gist);
            else next.delete(gist);
            return next;
          });
        }
      };
      if (action === "pin") pinModal.requestPin(gist, onConfirm);
      else pinModal.requestUnpin(gist, onConfirm);
    },
    [pinModal],
  );

  const handleSort = (setter: React.Dispatch<React.SetStateAction<SortConfig | null>>) => (column: string) => {
    setter(prev => {
      if (prev?.column === column) {
        return { column, ascending: !prev.ascending };
      }
      return { column, ascending: true };
    });
  };

  const tabKeys: TabType[] = ["overview", "drift", "audit"];
  const tabBtnStyle = (tab: TabType): React.CSSProperties => ({
    padding: "6px 16px",
    fontSize: "13px",
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "#0037a5" : "#475872",
    backgroundColor: activeTab === tab ? "#e1ecff" : "transparent",
    border: activeTab === tab ? "none" : "1px solid transparent",
    borderRadius: "20px",
    cursor: "pointer",
    fontFamily,
    letterSpacing: "normal",
    lineHeight: "20px",
    transition: "all 0.15s ease",
  });


  return (
    <div style={{ paddingRight: "24px" }}>
      <Helmet title="Plan Pinning" />
      <style>{`
        .pp-link { color: #394455; text-decoration: none; }
        .pp-link:hover { color: #0055ff; text-decoration: underline; }
        .pp-link-mono { font-family: RobotoMono-Medium, Roboto Mono, monospace; font-size: 12px; color: #242A35; white-space: nowrap; text-decoration: none; display: block; max-width: 250px; overflow: hidden; text-overflow: ellipsis; }
        .pp-link-mono:hover { color: #0055ff; text-decoration: underline; }
        .pp-pill-tab:hover { background-color: #f0f2f5; }
      `}</style>

      {/* Tabs */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "6px", alignItems: "center" }}>
        {([
          { key: "overview" as TabType, label: "All pinned plans" },
          { key: "drift" as TabType, label: "Drift analysis", badge: mockDriftAlerts.length > 0 ? mockDriftAlerts.length : undefined },
          { key: "audit" as TabType, label: "Audit log" },
        ]).map(tab => (
          <button key={tab.key} style={tabBtnStyle(tab.key)} className={activeTab !== tab.key ? "pp-pill-tab" : ""} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
            {tab.badge != null && (
              <span style={{
                marginLeft: "6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: "#0055ff",
                color: "#ffffff",
                position: "relative",
                top: "-1px",
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* === All Pinned Plans === */}
      {activeTab === "overview" && (
        <div style={{ overflowX: "auto" }}>
        <div style={{ fontSize: "14px", color: "#475872", marginBottom: "12px", fontFamily }}>
          1-{mockPinnedPlans.length} of {mockPinnedPlans.length} pinned plans
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, paddingLeft: "24px" }}>Plan pin status</th>
              <SortableHeader label="Plan gist" column="gist" sortConfig={overviewSort} onSort={handleSort(setOverviewSort)} />
              <SortableHeader label="Statement" column="statement" sortConfig={overviewSort} onSort={handleSort(setOverviewSort)} />
              <SortableHeader label="Pinned by" column="pinnedBy" sortConfig={overviewSort} onSort={handleSort(setOverviewSort)} />
              <SortableHeader label="Pinned at" column="pinnedAt" sortConfig={overviewSort} onSort={handleSort(setOverviewSort)} />
              <SortableHeader label="Executions" column="executions" sortConfig={overviewSort} onSort={handleSort(setOverviewSort)} style={{ textAlign: "right" }} />
              <SortableHeader label="Overridden" column="overridden" sortConfig={overviewSort} onSort={handleSort(setOverviewSort)} style={{ textAlign: "right" }} />
              <SortableHeader label="Avg latency" column="avgLatency" sortConfig={overviewSort} onSort={handleSort(setOverviewSort)} style={{ textAlign: "right" }} />
              <SortableHeader label="Last executed" column="lastExecTime" sortConfig={overviewSort} onSort={handleSort(setOverviewSort)} style={{ textAlign: "right" }} />
            </tr>
          </thead>
          <tbody>
            {sortData(mockPinnedPlans, overviewSort, {
              statement: p => p.statementFingerprint,
              gist: p => p.gist,
              status: p => p.status,
              pinnedBy: p => p.pinnedBy,
              pinnedAt: p => p.pinnedAt.getTime(),
              executions: p => p.executions,
              overridden: p => p.overridden,
              avgLatency: p => p.avgLatency,
              lastExecTime: p => p.lastExecTime.getTime(),
            }).map((plan, i) => (
              <tr key={i} style={rowStyle}>
                <td style={tdFirstStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={() => showPinModal(
                        unpinnedOverview.has(plan.gist) ? "pin" : "unpin",
                        plan.gist,
                        "overview",
                      )}
                      title={unpinnedOverview.has(plan.gist) ? "Pin" : "Unpin"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px",
                        border: "1px solid #c0c6d9",
                        borderRadius: "4px",
                        backgroundColor: "white",
                        color: unpinnedOverview.has(plan.gist) ? "#394455" : "#0055ff",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 17v5" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={unpinnedOverview.has(plan.gist) ? "none" : "currentColor"} />
                      </svg>
                    </button>
                    {unpinnedOverview.has(plan.gist) ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0 8px",
                          borderRadius: "3px",
                          fontSize: "12px",
                          fontWeight: 600,
                          height: "28px",
                          whiteSpace: "nowrap",
                          backgroundColor: "#f0f2f5",
                          color: "#475872",
                        }}
                      >
                        Unpinned
                      </span>
                    ) : (
                      <PlanPinBadge status={plan.status} reason={(plan as any).invalidReason} />
                    )}
                  </div>
                </td>
                <td style={tdStyle}>
                  <Link to={`/statement/${encodeURIComponent(plan.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className="pp-link">
                    {plan.gist.length > 24 ? plan.gist.slice(0, 24) + "..." : plan.gist}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <Link to={`/statement/${encodeURIComponent(plan.fingerprintID)}?appNames=movr&from=pinned-plans`} className="pp-link-mono">
                    {plan.statementFingerprint}
                  </Link>
                </td>
                <td style={tdStyle}>{plan.pinnedBy}</td>
                <td style={tdStyle}>
                  {plan.pinnedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{plan.executions.toLocaleString()}</td>
                <td style={{ ...tdStyle, textAlign: "right", color: plan.overridden > 0 ? "#0037a5" : "#394455" }}>
                  {plan.overridden.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{formatDuration(plan.avgLatency)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {plan.lastExecTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                  {plan.lastExecTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* === Drift Analysis === */}
      {activeTab === "drift" && (
        <div style={{ overflowX: "auto" }}>
          <p style={{ fontSize: "14px", color: "#475872", margin: "0 0 12px 0", lineHeight: "22px", fontFamily }}>
            1-{mockDriftAlerts.length} of {mockDriftAlerts.length} drift alerts
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <SortableHeader label="Assessment" column="assessment" sortConfig={driftSort} onSort={handleSort(setDriftSort)} style={{ paddingLeft: "24px" }} />
                <SortableHeader label="Pinned plan gist" column="pinnedGist" sortConfig={driftSort} onSort={handleSort(setDriftSort)} />
                <SortableHeader label="Candidate plan gist" column="candidateGist" sortConfig={driftSort} onSort={handleSort(setDriftSort)} />
                <SortableHeader label="Statement" column="statement" sortConfig={driftSort} onSort={handleSort(setDriftSort)} />
                <SortableHeader label="Pinned latency" column="pinnedLatency" sortConfig={driftSort} onSort={handleSort(setDriftSort)} style={{ textAlign: "right" }} />
                <SortableHeader label="Candidate latency" column="candidateLatency" sortConfig={driftSort} onSort={handleSort(setDriftSort)} style={{ textAlign: "right" }} />
                <SortableHeader label="Latency delta" column="latencyDelta" sortConfig={driftSort} onSort={handleSort(setDriftSort)} style={{ textAlign: "right" }} />
                <SortableHeader label="Would-have-executed" column="wouldHaveExecuted" sortConfig={driftSort} onSort={handleSort(setDriftSort)} style={{ textAlign: "right" }} />
                <SortableHeader label="Last would-have-executed" column="lastWouldHaveExecuted" sortConfig={driftSort} onSort={handleSort(setDriftSort)} style={{ textAlign: "right" }} />
                <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortData(mockDriftAlerts, driftSort, {
                statement: d => d.statement,
                pinnedGist: d => d.pinnedGist,
                candidateGist: d => d.candidateGist,
                wouldHaveExecuted: d => d.wouldHaveExecuted,
                pinnedLatency: d => d.pinnedLatency,
                candidateLatency: d => d.candidateLatency,
                latencyDelta: d => d.latencyDelta,
                lastWouldHaveExecuted: d => d.lastWouldHaveExecuted.getTime(),
                assessment: d => d.assessment,
              }).map((drift, i) => (
                <tr key={i} style={rowStyle}>
                  <td style={tdFirstStyle}>
                    <Tooltip
                      placement="bottom"
                      content={
                        <p style={{ margin: 0, maxWidth: "280px" }}>
                          {drift.assessment === "potential-improvement"
                            ? "The candidate plan has lower latency than the pinned plan. The optimizer may have found a better execution path. Consider testing and pinning the candidate."
                            : drift.assessment === "pin-invalid"
                            ? "Pinned plan is invalid (e.g., schema change). The optimizer fell back to the candidate plan. Pin it to make it the active plan, or unpin to let the optimizer choose freely."
                            : "The candidate plan has higher latency than the pinned plan. The pin is protecting against a regression. Investigate why the optimizer prefers a worse plan."}
                        </p>
                      }
                    >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 8px",
                        borderRadius: "3px",
                        fontSize: "12px",
                        fontWeight: 600,
                        lineHeight: "20px",
                        whiteSpace: "nowrap",
                        cursor: "default",
                        backgroundColor: drift.assessment === "potential-improvement" ? "#e3f5e0"
                          : drift.assessment === "pin-invalid" ? "#fff4e1"
                          : "#ffe9eb",
                        color: drift.assessment === "potential-improvement" ? "#237300"
                          : drift.assessment === "pin-invalid" ? "#b26000"
                          : "#cd2939",
                      }}
                    >
                      {drift.assessment === "potential-improvement" ? "Potential improvement"
                        : drift.assessment === "pin-invalid" ? "Pin invalid"
                        : "Regression risk"}
                    </span>
                    </Tooltip>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        onClick={() => showPinModal(
                          unpinnedDrift.has(drift.pinnedGist) ? "pin" : "unpin",
                          drift.pinnedGist,
                          "drift",
                        )}
                        title={unpinnedDrift.has(drift.pinnedGist) ? "Pin" : "Unpin"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "6px",
                          border: "1px solid #c0c6d9",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          color: unpinnedDrift.has(drift.pinnedGist) ? "#394455" : "#0055ff",
                          cursor: "pointer",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 17v5" />
                          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={unpinnedDrift.has(drift.pinnedGist) ? "none" : "currentColor"} />
                        </svg>
                      </button>
                      {unpinnedDrift.has(drift.pinnedGist) ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "0 8px",
                            borderRadius: "3px",
                            fontSize: "12px",
                            fontWeight: 600,
                            height: "28px",
                            whiteSpace: "nowrap",
                            backgroundColor: "#f0f2f5",
                            color: "#475872",
                          }}
                        >
                          Unpinned
                        </span>
                      ) : (
                        <PlanPinBadge
                          status={drift.assessment === "pin-invalid" ? "invalid" : "active"}
                          reason={drift.assessment === "pin-invalid" ? "Plan invalid (e.g., schema change)" : undefined}
                        />
                      )}
                      <Link to={`/statement/${encodeURIComponent(drift.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className="pp-link">
                        {drift.pinnedGist.length > 24 ? drift.pinnedGist.slice(0, 24) + "..." : drift.pinnedGist}
                      </Link>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {drift.assessment !== "regression-risk" && (
                      <button
                        onClick={() => showPinModal(
                          pinnedCandidates.has(drift.candidateGist) ? "unpin" : "pin",
                          drift.candidateGist,
                          "candidate",
                        )}
                        title={pinnedCandidates.has(drift.candidateGist) ? "Unpin candidate" : "Pin this candidate plan"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "6px",
                          border: "1px solid #c0c6d9",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          color: pinnedCandidates.has(drift.candidateGist) ? "#0055ff" : "#394455",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 17v5" />
                          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={pinnedCandidates.has(drift.candidateGist) ? "currentColor" : "none"} />
                        </svg>
                      </button>
                      )}
                      {drift.assessment !== "regression-risk" &&
                        pinnedCandidates.has(drift.candidateGist) && (
                          <PlanPinBadge status="active" />
                        )}
                      <Link to={`/statement/${encodeURIComponent(drift.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className="pp-link">
                        {drift.candidateGist.length > 24 ? drift.candidateGist.slice(0, 24) + "..." : drift.candidateGist}
                      </Link>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <Link to={`/statement/${encodeURIComponent(drift.fingerprintID)}?appNames=movr&from=pinned-plans`} className="pp-link-mono">
                      {drift.statement}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatDuration(drift.pinnedLatency)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatDuration(drift.candidateLatency)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: drift.latencyDelta < 0 ? "#237300" : "#cd2939", fontWeight: 600 }}>
                    {drift.latencyDelta < 0 ? "" : "+"}{formatDuration(Math.abs(drift.latencyDelta))}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{drift.wouldHaveExecuted.toLocaleString()}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {drift.lastWouldHaveExecuted.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    {drift.lastWouldHaveExecuted.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {drift.assessment === "potential-improvement" && (
                    <button
                      style={{ padding: "4px 8px", fontSize: "12px", fontWeight: 600, border: "1px solid #c0c6d9", borderRadius: "4px", backgroundColor: "white", color: "#394455", cursor: "pointer", fontFamily, whiteSpace: "nowrap", lineHeight: "20px" }}
                    >
                      Test plan
                    </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === Audit Log === */}
      {activeTab === "audit" && (
        <div style={{ overflowX: "auto" }}>
          <p style={{ fontSize: "14px", color: "#475872", margin: "0 0 12px 0", lineHeight: "22px", fontFamily }}>
            1-{mockAuditLog.length} of {mockAuditLog.length} audit log entries
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <SortableHeader label="Action" column="action" sortConfig={auditSort} onSort={handleSort(setAuditSort)} style={{ paddingLeft: "24px" }} />
                <SortableHeader label="Plan gist" column="gist" sortConfig={auditSort} onSort={handleSort(setAuditSort)} />
                <SortableHeader label="Statement" column="statement" sortConfig={auditSort} onSort={handleSort(setAuditSort)} />
                <SortableHeader label="User" column="user" sortConfig={auditSort} onSort={handleSort(setAuditSort)} />
                <SortableHeader label="Timestamp" column="timestamp" sortConfig={auditSort} onSort={handleSort(setAuditSort)} />
              </tr>
            </thead>
            <tbody>
              {sortData(mockAuditLog, auditSort, {
                action: e => e.action,
                statement: e => e.statement,
                gist: e => e.gist,
                user: e => e.user,
                timestamp: e => e.timestamp.getTime(),
              }).map((entry, i) => (
                <tr key={i} style={rowStyle}>
                  <td style={tdFirstStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "3px",
                        fontSize: "12px",
                        fontWeight: 600,
                        lineHeight: "20px",
                        backgroundColor: entry.action === "Pinned" ? "#e1ecff" : "#f0f2f5",
                        color: entry.action === "Pinned" ? "#0037a5" : "#475872",
                      }}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <Link to={`/statement/${encodeURIComponent(entry.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className="pp-link">
                      {entry.gist.length > 24 ? entry.gist.slice(0, 24) + "..." : entry.gist}
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <Link to={`/statement/${encodeURIComponent(entry.fingerprintID)}?appNames=movr&from=pinned-plans`} className="pp-link-mono">
                      {entry.statement}
                    </Link>
                  </td>
                  <td style={tdStyle}>{entry.user}</td>
                  <td style={tdStyle}>
                    {entry.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                    {entry.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PinPlanModal
        state={pinModal.state}
        onConfirm={pinModal.handleConfirm}
        onCancel={pinModal.handleCancel}
      />
    </div>
  );
}
