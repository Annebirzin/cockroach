// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { Tooltip } from "@cockroachlabs/ui-components";
import classNames from "classnames/bind";
import React from "react";
import { Link } from "react-router-dom";

import { Pagination, ResultsPerPageLabel } from "../pagination";
import { ColumnDescriptor, SortedTable, SortSetting } from "../sortedtable";

import { PinPermissionGate } from "./pinPermissionGate";
import styles from "./pinnedPlansPage.module.scss";
import { PinnedPlan } from "./pinnedPlans.types";
import { fontFamily, tokens } from "./pinnedPlans.tokens";
import {
  abbrev,
  formatDuration,
  PlanPinBadge,
} from "./pinnedPlans.utils";
import { PinAction } from "./pinTypes";

const cx = classNames.bind(styles);

/**
 * Builds the column descriptors for the All Pinned Plans table. Extracted into
 * a factory so the cell renderers close over the page-level state (which rows
 * have been unpinned in this session, the no-permission flag, the modal
 * trigger) without dragging the whole table back into the page file.
 */
function makeColumns(
  unpinnedOverview: Set<string>,
  noPermission: boolean,
  onPinClick: (action: PinAction, gist: string) => void,
  totalExecutionsByFingerprint: Record<string, number>,
): ColumnDescriptor<PinnedPlan>[] {
  return [
    {
      name: "pinStatus",
      title: "Plan pin status",
      cell: (plan: PinnedPlan) => {
        const isUnpinned = unpinnedOverview.has(plan.gist);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <PinPermissionGate noPermission={noPermission}>
              <button
                onClick={() => {
                  if (noPermission) return;
                  onPinClick(isUnpinned ? "pin" : "unpin", plan.gist);
                }}
                disabled={noPermission}
                title={noPermission ? undefined : (isUnpinned ? "Pin" : "Unpin")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px",
                  border: `1px solid ${noPermission ? tokens.disabledBorder : tokens.neutral4}`,
                  borderRadius: "4px",
                  backgroundColor: noPermission ? tokens.disabledBg : tokens.white,
                  color: noPermission
                    ? tokens.neutral4
                    : (isUnpinned ? tokens.neutral7 : tokens.primaryBlue3),
                  cursor: noPermission ? "not-allowed" : "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 17v5" />
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={isUnpinned || noPermission ? "none" : "currentColor"} />
                </svg>
              </button>
            </PinPermissionGate>
            {isUnpinned ? (
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "0 8px",
                borderRadius: "3px", fontSize: "12px", fontWeight: 600, height: "28px",
                whiteSpace: "nowrap", backgroundColor: tokens.unpinnedBadgeBg, color: tokens.neutral6,
              }}>
                Unpinned
              </span>
            ) : (
              <PlanPinBadge />
            )}
          </div>
        );
      },
    },
    {
      name: "gist",
      title: "Plan gist",
      sort: (plan: PinnedPlan) => plan.gist,
      cell: (plan: PinnedPlan) => (
        <Link to={`/statement/${encodeURIComponent(plan.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className={cx("pp-link")}>
          {plan.gist.length > 24 ? plan.gist.slice(0, 24) + "..." : plan.gist}
        </Link>
      ),
    },
    {
      name: "statement",
      title: "Statement",
      sort: (plan: PinnedPlan) => plan.statementFingerprint,
      cell: (plan: PinnedPlan) => (
        <Link to={`/statement/${encodeURIComponent(plan.fingerprintID)}?appNames=movr&from=pinned-plans`} className={cx("pp-link-mono")}>
          {plan.statementFingerprint}
        </Link>
      ),
    },
    {
      name: "coverage",
      title: (
        <Tooltip
          style="tableTitle"
          placement="bottom"
          content={
            <span style={{ fontWeight: 400 }}>
              Percentage of fingerprint executions where the optimizer used this pinned plan. 0% means the pin isn't sticking. The optimizer is choosing a different plan every time.
            </span>
          }
        >
          Pin applied rate
        </Tooltip>
      ),
      sort: (plan: PinnedPlan) => plan.coverage,
      cell: (plan: PinnedPlan) => {
        const total = totalExecutionsByFingerprint[plan.fingerprintID] ?? plan.executions;
        const inner = (
          <>
            <span style={{ fontWeight: 600 }}>{plan.coverage}%</span>
            <span style={{ color: plan.coverage === 0 ? tokens.functionalRed : tokens.neutral5 }}>
              {" "}({abbrev(plan.executions)} of {abbrev(total)})
            </span>
          </>
        );
        if (plan.coverage === 0) {
          return (
            <Tooltip
              placement="top"
              content={
                <span style={{ fontSize: "14px", fontWeight: 400 }}>
                  This pinned plan is not being used. The optimizer is choosing a different plan for every execution.
                </span>
              }
            >
              <span style={{
                display: "inline-block", padding: "2px 8px", borderRadius: "3px",
                backgroundColor: tokens.functionalRedLight, color: tokens.functionalRed, cursor: "help",
              }}>
                <span style={{ borderBottom: `1px dashed ${tokens.functionalRed}` }}>{inner}</span>
              </span>
            </Tooltip>
          );
        }
        return <span style={{ whiteSpace: "nowrap" }}>{inner}</span>;
      },
    },
    {
      name: "overrideRate",
      title: (
        <Tooltip
          style="tableTitle"
          placement="bottom"
          content={
            <span style={{ fontWeight: 400 }}>
              Percentage of pinned-plan executions where the pin overrode the optimizer's choice. Higher means the pin is actively protecting against drift. 0% means the optimizer would have picked this plan anyway (the pin is redundant).
            </span>
          }
        >
          Pin override rate
        </Tooltip>
      ),
      // Rows with no executions sort to the bottom in either direction by
      // returning -1 — the rate is undefined for them.
      sort: (plan: PinnedPlan) => (plan.executions > 0 ? plan.overridden / plan.executions : -1),
      cell: (plan: PinnedPlan) => {
        if (plan.executions === 0) {
          return <span style={{ color: tokens.neutral4 }}>—</span>;
        }
        const rate = Math.round((plan.overridden / plan.executions) * 100);
        return (
          <span style={{ whiteSpace: "nowrap", color: tokens.neutral7 }}>
            <span style={{ fontWeight: 600 }}>{rate}%</span>
            <span style={{ color: tokens.neutral5 }}>
              {" "}({abbrev(plan.overridden)} of {abbrev(plan.executions)})
            </span>
          </span>
        );
      },
    },
    {
      name: "avgLatency",
      title: "Avg latency",
      titleAlign: "right",
      sort: (plan: PinnedPlan) => plan.avgLatency,
      cell: (plan: PinnedPlan) => (
        <span style={{ display: "block", textAlign: "right" }}>{formatDuration(plan.avgLatency)}</span>
      ),
    },
    {
      name: "pinnedBy",
      title: "Pinned by",
      sort: (plan: PinnedPlan) => plan.pinnedBy,
      cell: (plan: PinnedPlan) => plan.pinnedBy,
    },
    {
      name: "pinnedAt",
      title: "Pinned at",
      sort: (plan: PinnedPlan) => plan.pinnedAt.getTime(),
      cell: (plan: PinnedPlan) =>
        plan.pinnedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    },
    {
      name: "lastExecTime",
      title: "Last executed",
      titleAlign: "right",
      sort: (plan: PinnedPlan) => plan.lastExecTime.getTime(),
      cell: (plan: PinnedPlan) => (
        <span style={{ display: "block", textAlign: "right" }}>
          {plan.lastExecTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
          {plan.lastExecTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
  ];
}

export interface PinnedPlansTableProps {
  data: PinnedPlan[];
  /**
   * Per-fingerprint total execution counts, used as the denominator in the
   * "Pin applied" cell's `(X of Y)` parenthetical. In production this would
   * be returned alongside each PinnedPlan; in the prototype it lives in a
   * separate fixture map.
   */
  totalExecutionsByFingerprint: Record<string, number>;
  sortSetting: SortSetting;
  onChangeSortSetting: (next: SortSetting) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number, size?: number) => void;
  onPageSizeChange: (page: number, size: number) => void;
  /** Set of plan_gists the user has unpinned this session (mock state). */
  unpinnedOverview: Set<string>;
  noPermission: boolean;
  /** Opens the shared confirmation modal. Surface argument is fixed to "overview". */
  onPinClick: (action: PinAction, gist: string) => void;
}

/**
 * The All Pinned Plans table — a SortedTable<PinnedPlan> with a count line
 * above and a Pagination control below. Rendered by PinnedPlansPage when the
 * "All pinned plans" tab is active and the list-load state is healthy.
 */
export function PinnedPlansTable(props: PinnedPlansTableProps): React.ReactElement {
  const {
    data,
    totalExecutionsByFingerprint,
    sortSetting,
    onChangeSortSetting,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    unpinnedOverview,
    noPermission,
    onPinClick,
  } = props;

  const columns = makeColumns(
    unpinnedOverview,
    noPermission,
    onPinClick,
    totalExecutionsByFingerprint,
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontSize: "14px", color: tokens.neutral6, marginBottom: "12px", fontFamily }}>
        <ResultsPerPageLabel
          pagination={{ pageSize, current: page, total: data.length }}
          pageName="pinned plans"
        />
      </div>
      <SortedTable<PinnedPlan>
        data={data}
        sortSetting={sortSetting}
        onChangeSortSetting={onChangeSortSetting}
        pagination={{ current: page, pageSize }}
        columns={columns}
      />
      <div className={cx("pp-pager")}>
        <Pagination
          pageSize={pageSize}
          current={page}
          total={data.length}
          onChange={onPageChange}
          onShowSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
