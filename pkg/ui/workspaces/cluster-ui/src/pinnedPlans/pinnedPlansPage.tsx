// Copyright 2025 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { InlineAlert, Tooltip } from "@cockroachlabs/ui-components";
import classNames from "classnames/bind";
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet";

import { SortSetting } from "../sortedtable";

import { PinPermissionGate } from "./pinPermissionGate";
import {
  mockAuditLog,
  mockDriftAlerts,
  mockPinnedPlans,
  mockTotalExecutions,
  PinnedPlan,
} from "./pinnedPlans.fixture";
import { PinPlanModal, usePinPlanModal } from "./pinPlanModal";
import { fontFamily, tokens } from "./pinnedPlans.tokens";
import { PinnedPlansTable } from "./pinnedPlansTable";
import {
  abbrev,
  formatDuration,
  PlanPinBadge,
} from "./pinnedPlans.utils";
import { runPinAction } from "./runPinAction";
import styles from "./pinnedPlansPage.module.scss";
import { usePinDemoState } from "./usePinDemoState";

// Table styles matching the SortedTable / statement fingerprint table
const tableStyle: React.CSSProperties = {
  width: "fit-content",
  minWidth: "100%",
  borderCollapse: "collapse",
  fontFamily,
  fontWeight: 400,
  lineHeight: "22px",
  fontSize: "14px",
  color: tokens.neutral7,
};

const thStyle: React.CSSProperties = {
  padding: "11px 16px 11px 8px",
  textAlign: "left",
  fontSize: "14px",
  color: tokens.neutral6,
  backgroundColor: tokens.white,
  borderBottom: `1px solid ${tokens.neutral3}`,
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
  color: tokens.neutral7,
  verticalAlign: "middle",
};

// First column cells get extra left padding
const tdFirstStyle: React.CSSProperties = { ...tdStyle, paddingLeft: "24px" };

const rowStyle: React.CSSProperties = {
  height: "70px",
  borderTop: "1px solid transparent",
  borderBottom: `1px solid ${tokens.neutral3}`,
  backgroundColor: tokens.white,
};




// === V1 SCOPE FLAG ===========================================================
// Drift Analysis is out of scope for v1 (see spec.md §2.3). The tab, mock
// data, and rendering code are all kept in this file so the work isn't lost
// — flip this flag to `true` to bring drift back when the underlying
// optimizer "what-would-have-been-chosen" hooks ship. When flipped on:
//   - the tab appears in the tabs row and is navigable
//   - the drift table renders, including its pin/unpin actions which are
//     already wired to the shared error-state helpers
// Nothing else needs to change to re-enable the feature.
const DRIFT_ENABLED = false;

type TabType = "overview" | "drift" | "audit";

interface SortConfig {
  column: string;
  ascending: boolean;
}

function SortArrows({ column, sortConfig }: { column: string; sortConfig: SortConfig | null }): React.ReactElement {
  const isActive = sortConfig?.column === column;
  const upColor = isActive && sortConfig?.ascending ? tokens.primaryBlue3 : tokens.neutral4;
  const downColor = isActive && !sortConfig?.ascending ? tokens.primaryBlue3 : tokens.neutral4;
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
  tooltip,
}: {
  label: string;
  column: string;
  sortConfig: SortConfig | null;
  onSort: (column: string) => void;
  style?: React.CSSProperties;
  // When provided, renders the label with a dashed underline + hover popover.
  // Mirrors the standard cluster-ui pattern: Tooltip style="tableTitle" wraps
  // a label whose dashed underline comes from the consumer (the SortedTable
  // applies it via a CSS module; this prototype applies it inline).
  tooltip?: React.ReactNode;
}): React.ReactElement {
  // Sort arrows live in their own auto-width slot; the label fills the rest
  // and aligns to the right when the th is right-aligned. Without this
  // flex wrapper, the Tooltip's inline-block child can wrap the arrows
  // onto a second line in narrow columns.
  const isRightAligned = (style as React.CSSProperties | undefined)?.textAlign === "right";
  const labelInner = (
    <span
      style={{
        // Reserve the dashed underline only when there's a tooltip — otherwise
        // plain headers stay flush.
        borderBottom: tooltip ? `1px dashed ${tokens.neutral6}` : undefined,
        // Match the dashed line's width to the text, not the cell.
        display: "inline",
      }}
    >
      {label}
    </span>
  );
  const labelEl = tooltip ? (
    <Tooltip style="tableTitle" placement="bottom" content={tooltip}>
      {labelInner}
    </Tooltip>
  ) : (
    labelInner
  );
  return (
    <th
      style={{ ...thStyle, ...style, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(column)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0,
          justifyContent: isRightAligned ? "flex-end" : "flex-start",
          width: "100%",
        }}
      >
        {labelEl}
        <SortArrows column={column} sortConfig={sortConfig} />
      </span>
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
  // Overview sort is driven by SortedTable, which uses cluster-ui's SortSetting
  // shape. Drift and audit tabs continue to use the local SortConfig pattern
  // for now; they'd migrate similarly when this prototype is fully refactored.
  const [overviewSort, setOverviewSort] = useState<SortSetting>({
    columnTitle: "pinnedAt",
    ascending: false,
  });
  const [driftSort, setDriftSort] = useState<SortConfig | null>(null);
  const [auditSort, setAuditSort] = useState<SortConfig | null>(null);
  // Pagination for the All pinned plans table. Matches the Statements page
  // (antd Pagination wrapper + ResultsPerPageLabel, default page size 50).
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewPageSize, setOverviewPageSize] = useState(50);
  const [pinnedCandidates, setPinnedCandidates] = useState<Set<string>>(new Set());
  // Track which plans have been "unpinned" on the overview table (mock interaction)
  const [unpinnedOverview, setUnpinnedOverview] = useState<Set<string>>(new Set());
  const [unpinnedDrift, setUnpinnedDrift] = useState<Set<string>>(new Set());

  const pinModal = usePinPlanModal();

  // Error-state plumbing — demo flag drives the prototype; production
  // wiring substitutes API/privilege state. See pinPlanModal.tsx for the
  // shared helpers and spec.md §2.10 for the full pattern catalog.
  const demoState = usePinDemoState();
  const noPermission = demoState === "no-permission";
  const loadFailed = demoState === "fail-load";

  const showPinModal = useCallback(
    (action: "pin" | "unpin", gist: string, target: "overview" | "drift" | "candidate") => {
      const apply = () => {
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
      const onConfirm = (): string | void =>
        runPinAction(action, gist, apply, demoState);
      if (action === "pin") pinModal.requestPin(gist, onConfirm);
      else pinModal.requestUnpin(gist, onConfirm);
    },
    [pinModal, demoState],
  );

  const handleSort = (setter: React.Dispatch<React.SetStateAction<SortConfig | null>>) => (column: string) => {
    setter(prev => {
      if (prev?.column === column) {
        return { column, ascending: !prev.ascending };
      }
      return { column, ascending: true };
    });
  };

  // SortedTable invokes this with the new SortSetting whenever the user
  // clicks a header. We piggy-back to reset pagination to page 1 so the
  // user always lands on the first page after re-sorting.
  const handleOverviewSortChange = useCallback((next: SortSetting) => {
    setOverviewSort(next);
    setOverviewPage(1);
  }, []);

  // Filter out drift in v1; clamp activeTab back to overview if the user
   // arrived via a stale deep link to ?tab=drift.
  const tabKeys: TabType[] = DRIFT_ENABLED
    ? ["overview", "drift", "audit"]
    : ["overview", "audit"];
  const visibleActiveTab: TabType = !DRIFT_ENABLED && activeTab === "drift"
    ? "overview"
    : activeTab;
  const tabBtnStyle = (tab: TabType): React.CSSProperties => ({
    padding: "6px 16px",
    fontSize: "13px",
    fontWeight: visibleActiveTab === tab ? 600 : 400,
    color: visibleActiveTab === tab ? tokens.primaryBlueDark : tokens.neutral6,
    backgroundColor: visibleActiveTab === tab ? tokens.primaryBlueAlert : "transparent",
    border: visibleActiveTab === tab ? "none" : "1px solid transparent",
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

      {/* Tabs */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "6px", alignItems: "center" }}>
        {([
          { key: "overview" as TabType, label: "All pinned plans" },
          { key: "drift" as TabType, label: "Drift analysis", badge: mockDriftAlerts.length > 0 ? mockDriftAlerts.length : undefined },
          { key: "audit" as TabType, label: "Audit log" },
        ]).filter(tab => tabKeys.includes(tab.key)).map(tab => (
          <button key={tab.key} style={tabBtnStyle(tab.key)} className={cx({ "pp-pill-tab": visibleActiveTab !== tab.key })} onClick={() => setActiveTab(tab.key)}>
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
                backgroundColor: tokens.primaryBlue3,
                color: tokens.white,
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
      {visibleActiveTab === "overview" && loadFailed && (
        <div style={{ marginTop: "12px" }}>
          <InlineAlert
            intent="danger"
            title="Failed to load pinned plans"
            description={
              <span>
                The cluster returned an error while fetching pinned plans.{" "}
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    window.location.reload();
                  }}
                  style={{ color: tokens.primaryBlue3 }}
                >
                  Retry
                </a>
              </span>
            }
          />
        </div>
      )}
      {visibleActiveTab === "overview" && !loadFailed && (
        <PinnedPlansTable
          data={mockPinnedPlans}
          totalExecutionsByFingerprint={mockTotalExecutions}
          sortSetting={overviewSort}
          onChangeSortSetting={handleOverviewSortChange}
          page={overviewPage}
          pageSize={overviewPageSize}
          onPageChange={(current, size) => {
            setOverviewPage(current);
            if (size) setOverviewPageSize(size);
          }}
          onPageSizeChange={(current, size) => {
            setOverviewPage(current);
            setOverviewPageSize(size);
          }}
          unpinnedOverview={unpinnedOverview}
          noPermission={noPermission}
          onPinClick={(action, gist) => showPinModal(action, gist, "overview")}
        />
      )}


      {/* === Drift Analysis === (gated: out of scope for v1, see DRIFT_ENABLED) */}
      {DRIFT_ENABLED && activeTab === "drift" && (
        <div style={{ overflowX: "auto" }}>
          <p style={{ fontSize: "14px", color: tokens.neutral6, margin: "0 0 12px 0", lineHeight: "22px", fontFamily }}>
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
                            : "The candidate plan has higher latency than the pinned plan. The pin is protecting against a regression. Investigate why the optimizer prefers a worse plan."}
                        </p>
                      }
                    >
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
                        cursor: "default",
                        backgroundColor: drift.assessment === "potential-improvement" ? tokens.functionalGreenLight : tokens.functionalRedLight,
                        color: drift.assessment === "potential-improvement" ? tokens.functionalGreen : tokens.functionalRed,
                      }}
                    >
                      {drift.assessment === "potential-improvement" ? "Potential improvement" : "Regression risk"}
                    </span>
                    </Tooltip>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <PinPermissionGate noPermission={noPermission}>
                        <button
                          onClick={() => {
                            if (noPermission) return;
                            showPinModal(
                              unpinnedDrift.has(drift.pinnedGist) ? "pin" : "unpin",
                              drift.pinnedGist,
                              "drift",
                            );
                          }}
                          disabled={noPermission}
                          title={noPermission ? undefined : (unpinnedDrift.has(drift.pinnedGist) ? "Pin" : "Unpin")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "6px",
                            border: `1px solid ${noPermission ? tokens.disabledBorder : tokens.neutral4}`,
                            borderRadius: "4px",
                            backgroundColor: noPermission ? tokens.disabledBg : "white",
                            color: noPermission
                              ? tokens.neutral4
                              : (unpinnedDrift.has(drift.pinnedGist) ? tokens.neutral7 : tokens.primaryBlue3),
                            cursor: noPermission ? "not-allowed" : "pointer",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 17v5" />
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={unpinnedDrift.has(drift.pinnedGist) || noPermission ? "none" : "currentColor"} />
                          </svg>
                        </button>
                      </PinPermissionGate>
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
                            backgroundColor: tokens.unpinnedBadgeBg,
                            color: tokens.neutral6,
                          }}
                        >
                          Unpinned
                        </span>
                      ) : (
                        <PlanPinBadge />
                      )}
                      <Link to={`/statement/${encodeURIComponent(drift.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className={cx("pp-link")}>
                        {drift.pinnedGist.length > 24 ? drift.pinnedGist.slice(0, 24) + "..." : drift.pinnedGist}
                      </Link>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {drift.assessment !== "regression-risk" && (
                      <PinPermissionGate noPermission={noPermission}>
                        <button
                          onClick={() => {
                            if (noPermission) return;
                            showPinModal(
                              pinnedCandidates.has(drift.candidateGist) ? "unpin" : "pin",
                              drift.candidateGist,
                              "candidate",
                            );
                          }}
                          disabled={noPermission}
                          title={noPermission ? undefined : (pinnedCandidates.has(drift.candidateGist) ? "Unpin candidate" : "Pin this candidate plan")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "6px",
                            border: `1px solid ${noPermission ? tokens.disabledBorder : tokens.neutral4}`,
                            borderRadius: "4px",
                            backgroundColor: noPermission ? tokens.disabledBg : "white",
                            color: noPermission
                              ? tokens.neutral4
                              : (pinnedCandidates.has(drift.candidateGist) ? tokens.primaryBlue3 : tokens.neutral7),
                            cursor: noPermission ? "not-allowed" : "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 17v5" />
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={pinnedCandidates.has(drift.candidateGist) && !noPermission ? "currentColor" : "none"} />
                          </svg>
                        </button>
                      </PinPermissionGate>
                      )}
                      {drift.assessment !== "regression-risk" &&
                        pinnedCandidates.has(drift.candidateGist) && (
                          <PlanPinBadge />
                        )}
                      <Link to={`/statement/${encodeURIComponent(drift.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className={cx("pp-link")}>
                        {drift.candidateGist.length > 24 ? drift.candidateGist.slice(0, 24) + "..." : drift.candidateGist}
                      </Link>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <Link to={`/statement/${encodeURIComponent(drift.fingerprintID)}?appNames=movr&from=pinned-plans`} className={cx("pp-link-mono")}>
                      {drift.statement}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatDuration(drift.pinnedLatency)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatDuration(drift.candidateLatency)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: drift.latencyDelta < 0 ? tokens.functionalGreen : tokens.functionalRed, fontWeight: 600 }}>
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
                      style={{ padding: "4px 8px", fontSize: "12px", fontWeight: 600, border: `1px solid ${tokens.neutral4}`, borderRadius: "4px", backgroundColor: tokens.white, color: tokens.neutral7, cursor: "pointer", fontFamily, whiteSpace: "nowrap", lineHeight: "20px" }}
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
      {visibleActiveTab === "audit" && (
        <div style={{ overflowX: "auto" }}>
          <p style={{ fontSize: "14px", color: tokens.neutral6, margin: "0 0 12px 0", lineHeight: "22px", fontFamily }}>
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
                        backgroundColor: entry.action === "Pinned" ? tokens.primaryBlueAlert : tokens.unpinnedBadgeBg,
                        color: entry.action === "Pinned" ? tokens.primaryBlueDark : tokens.neutral6,
                      }}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <Link to={`/statement/${encodeURIComponent(entry.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className={cx("pp-link")}>
                      {entry.gist.length > 24 ? entry.gist.slice(0, 24) + "..." : entry.gist}
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <Link to={`/statement/${encodeURIComponent(entry.fingerprintID)}?appNames=movr&from=pinned-plans`} className={cx("pp-link-mono")}>
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
