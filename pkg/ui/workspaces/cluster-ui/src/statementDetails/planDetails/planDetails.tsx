// Copyright 2022 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { ArrowLeft } from "@cockroachlabs/icons";
import { Col, Row } from "antd";
import classNames from "classnames/bind";
import Long from "long";
import React, { useContext, useState, useCallback } from "react";
import { Helmet } from "react-helmet";
import { useLocation } from "react-router-dom";

import { Button } from "../../button";
import { CockroachCloudContext } from "../../contexts";
import { InsightRecommendation, InsightType } from "../../insights";
import {
  InsightsSortedTable,
  makeInsightsColumns,
} from "../../insightsTable/insightsTable";
import { SortSetting } from "../../sortedtable";
import { SqlBox, SqlBoxSize } from "../../sql";
import { SummaryCard, SummaryCardItem } from "../../summaryCard";
import { Timestamp } from "../../timestamp";
import {
  Count,
  DATE_FORMAT_24_TZ,
  Duration,
  formatNumberForDisplay,
  longToInt,
  RenderCount,
  TimestampToMoment,
} from "../../util";
import styles from "../statementDetails.module.scss";

import {
  formatIndexes,
  PlansSortedTable,
  makeExplainPlanColumns,
  PlanHashStats,
} from "./plansTable";
import { PinPlanModal, usePinPlanModal } from "../../pinnedPlans/pinPlanModal";

const cx = classNames.bind(styles);

// Mock plan pinning configuration per fingerprint ID.
// Each entry defines which gists are pinned, the coverage % each has, the
// per-pinned-plan execution count, and the fingerprint-total execution count.
// Coverage = 0 means the pin isn't being used at all (was previously the
// "Invalid pin" signal); coverage between 0 and 100 means the pin only
// sticks for some executions. Values mirror mockPinnedPlans / mockTotalExecutions
// in pinnedPlansPage.tsx so the dashboard and detail page agree.
const MOCK_PIN_CONFIG: Record<string, {
  // Extra mock gists to add (beyond the real one from the API)
  extraGists: string[];
  // Which gists should appear as pinned (by index: 0=real, 1+=mock)
  pinnedIndices: number[];
  // Coverage % per pinned index
  coverageByIndex: Record<number, number>;
  // Per-pinned-plan execution count
  execsByIndex: Record<number, number>;
  // Fingerprint-total execution count (denominator for "X of Y" coverage cell)
  totalExecs: number;
}> = {
  // INSERT INTO rides — 2 pinned, both well-utilized
  "5193222733586324267": {
    extraGists: ["AiAC2AEC", "AiAC2AED"],
    pinnedIndices: [0, 1],
    coverageByIndex: { 0: 77, 1: 23 },
    execsByIndex: { 0: 507, 1: 152 },
    totalExecs: 660,
  },
  // SELECT count(*) FROM user_promo_codes — partial coverage on plan 1, broken on plan 3
  "7562955041576980258": {
    extraGists: ["AgHeAQIABwIAAAUADAYD", "AgHeAQIABwIAAAUADAYE"],
    pinnedIndices: [0, 2],
    coverageByIndex: { 0: 60, 2: 0 },
    execsByIndex: { 0: 120, 2: 0 },
    totalExecs: 200,
  },
  // SELECT city, id FROM vehicles — one stale (0%) + one fully used (100%)
  "3350546850174482743": {
    extraGists: ["AgHWAQQAAwIAAAYF", "AgHWAQQAAwIAAAYG"],
    pinnedIndices: [0, 1],
    coverageByIndex: { 0: 0, 1: 100 },
    execsByIndex: { 0: 0, 1: 8934 },
    totalExecs: 8934,
  },
  // UPSERT INTO vehicle_location_histories — 2 pinned, split coverage
  "7442192024002430332": {
    extraGists: ["AgICCgUOMCLaAQAxBQQUBQ==", "AgICCgUOMCLaAQAxBQQUBg=="],
    pinnedIndices: [0, 1],
    coverageByIndex: { 0: 77, 1: 23 },
    execsByIndex: { 0: 12378, 1: 3710 },
    totalExecs: 16088,
  },
  // INSERT INTO user_promo_codes — 2 pinned, split coverage
  "3939633309730011619": {
    extraGists: ["AiAC3gEC", "AiAC3gED"],
    pinnedIndices: [0, 1],
    coverageByIndex: { 0: 77, 1: 23 },
    execsByIndex: { 0: 116, 1: 34 },
    totalExecs: 150,
  },
};

// Create mock plan entries based on a real plan, with varied stats.
function createMockPlans(
  realPlans: PlanHashStats[],
  fingerprintID: string,
): PlanHashStats[] {
  const config = MOCK_PIN_CONFIG[fingerprintID];
  if (!config || !realPlans?.length) return realPlans || [];

  const basePlan = realPlans[0];
  const baseStats = basePlan.stats;
  const baseMeta = basePlan.metadata;

  const mockPlans = config.extraGists.map((gist, i) => {
    // Vary the stats to make each plan look different
    const countMultiplier = [0.3, 0.1][i] || 0.2;
    const latencyMultiplier = [1.4, 0.7][i] || 1.0;
    const baseCount = longToInt(baseStats?.count || Long.ZERO);
    const mockCount = Math.max(1, Math.round(baseCount * countMultiplier));

    return {
      metadata: {
        ...baseMeta,
        total_count: Long.fromNumber(mockCount),
        full_scan_count: Long.fromNumber(
          Math.round(mockCount * (i === 0 ? 0.1 : 0.8)),
        ),
        dist_sql_count: Long.fromNumber(mockCount),
        vec_count: Long.fromNumber(mockCount),
        databases: baseMeta?.databases || ["movr"],
        query: baseMeta?.query || "",
      },
      stats: {
        ...baseStats,
        plan_gists: [gist],
        count: Long.fromNumber(mockCount),
        first_attempt_count: Long.fromNumber(mockCount),
        run_lat: {
          mean: (baseStats?.run_lat?.mean || 0.002) * latencyMultiplier,
          squared_diffs: 0,
        },
        rows_read: {
          mean: (baseStats?.rows_read?.mean || 1) * (i === 0 ? 2.5 : 0.5),
          squared_diffs: 0,
        },
        rows_written: baseStats?.rows_written || { mean: 0, squared_diffs: 0 },
        latency_info: {
          min: (baseStats?.run_lat?.mean || 0.002) * latencyMultiplier * 0.5,
          max: (baseStats?.run_lat?.mean || 0.002) * latencyMultiplier * 3.0,
          p50: (baseStats?.run_lat?.mean || 0.002) * latencyMultiplier * 0.9,
          p99: (baseStats?.run_lat?.mean || 0.002) * latencyMultiplier * 2.5,
        },
        last_exec_timestamp: {
          seconds: Long.fromNumber(
            Math.floor(Date.now() / 1000) - (i + 1) * 1800,
          ),
          nanos: 0,
        },
        indexes: baseStats?.indexes || [],
        index_recommendations: i === 0
          ? ["creation : CREATE INDEX ON rides (start_time)"]
          : [],
        generic_count: Long.fromNumber(0),
        stmt_hints_count: Long.fromNumber(0),
      },
      explain_plan: `Plan Gist: ${gist}\n\n• scan\n  table: ${baseMeta?.query?.match(/(?:FROM|INTO)\s+(\w+)/i)?.[1] || "table"}@primary\n  spans: ALL`,
      plan_hash: Long.fromNumber(1000 + i),
      index_recommendations: [],
    } as PlanHashStats;
  });

  return [...realPlans, ...mockPlans];
}

interface PlanDetailsProps {
  plans: PlanHashStats[];
  statementFingerprintID: string;
  hasAdminRole: boolean;
}

export function PlanDetails({
  plans: rawPlans,
  statementFingerprintID,
  hasAdminRole,
}: PlanDetailsProps): React.ReactElement {
  const location = useLocation();
  const [plan, setPlan] = useState<PlanHashStats | null>(null);
  const [autoSelectedGist, setAutoSelectedGist] = useState(false);
  const [plansSortSetting, setPlansSortSetting] = useState<SortSetting>({
    ascending: false,
    columnTitle: "lastExecTime",
  });
  const [insightsSortSetting, setInsightsSortSetting] = useState<SortSetting>({
    ascending: false,
    columnTitle: "insights",
  });

  // Inject mock plans so each fingerprint has 3+ plan gists
  const plans = React.useMemo(
    () => createMockPlans(rawPlans, statementFingerprintID),
    [rawPlans, statementFingerprintID],
  );

  const config = MOCK_PIN_CONFIG[statementFingerprintID];

  const initPinnedGists = React.useMemo(() => {
    if (!config || !plans?.length) return new Set<string>();
    const pinned = new Set<string>();
    for (const idx of config.pinnedIndices) {
      const gist = plans[idx]?.stats?.plan_gists?.[0];
      if (gist) pinned.add(gist);
    }
    return pinned;
  }, [statementFingerprintID, plans]);

  // Map from pinned gist → coverage % (0–100). Drives the Coverage column
  // and the red "0%" warning treatment in the Explain plans table.
  const coverageByGist = React.useMemo(() => {
    const map = new Map<string, number>();
    if (!config || !plans?.length) return map;
    for (const [idxStr, cov] of Object.entries(config.coverageByIndex)) {
      const idx = Number(idxStr);
      const gist = plans[idx]?.stats?.plan_gists?.[0];
      if (gist) map.set(gist, cov);
    }
    return map;
  }, [statementFingerprintID, plans]);

  // Per-pinned-gist execution count, used as numerator in the "Pin applied"
  // cell ("60% (X of Y)").
  const execsByGist = React.useMemo(() => {
    const map = new Map<string, number>();
    if (!config || !plans?.length) return map;
    for (const [idxStr, count] of Object.entries(config.execsByIndex)) {
      const idx = Number(idxStr);
      const gist = plans[idx]?.stats?.plan_gists?.[0];
      if (gist) map.set(gist, count);
    }
    return map;
  }, [statementFingerprintID, plans]);

  // Fingerprint-total executions (denominator for the "Pin applied" cell).
  const fingerprintTotalExecs = config?.totalExecs ?? 0;

  const [pinnedGists, setPinnedGists] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [auditLog, setAuditLog] = useState<Array<{
    action: string;
    gist: string;
    timestamp: Date;
    user: string;
  }>>([]);

  // Sync initial pinned gists once plans load
  React.useEffect(() => {
    if (!initialized && initPinnedGists.size > 0) {
      setPinnedGists(initPinnedGists);
      setInitialized(true);
    }
  }, [initPinnedGists, initialized]);

  // Auto-select a plan gist if specified in URL (e.g. ?gist=AiAC2AEB)
  React.useEffect(() => {
    if (autoSelectedGist || !plans?.length) return;
    const params = new URLSearchParams(location.search);
    const targetGist = params.get("gist");
    if (!targetGist) return;
    const matchingPlan = plans.find(
      p => p.stats?.plan_gists?.[0] === targetGist,
    );
    if (matchingPlan) {
      setPlan(matchingPlan);
      setAutoSelectedGist(true);
    }
  }, [plans, location.search, autoSelectedGist]);

  const pinModal = usePinPlanModal();

  const applyPin = useCallback((gist: string) => {
    setPinnedGists(prev => {
      const next = new Set(prev);
      next.add(gist);
      return next;
    });
    setAuditLog(prev => [{
      action: "Pinned",
      gist,
      timestamp: new Date(),
      user: "root",
    }, ...prev]);
  }, []);

  const applyUnpin = useCallback((gist: string) => {
    setPinnedGists(prev => {
      const next = new Set(prev);
      next.delete(gist);
      return next;
    });
    setAuditLog(prev => [{
      action: "Unpinned",
      gist,
      timestamp: new Date(),
      user: "root",
    }, ...prev]);
  }, []);

  const handlePin = useCallback((gist: string) => {
    pinModal.requestPin(gist, () => applyPin(gist));
  }, [pinModal, applyPin]);

  const handleUnpin = useCallback((gist: string) => {
    pinModal.requestUnpin(gist, () => applyUnpin(gist));
  }, [pinModal, applyUnpin]);

  const handleDetails = (plan: PlanHashStats): void => {
    setPlan(plan);
  };
  const backToPlanTable = (): void => {
    setPlan(null);
  };

  const modal = (
    <PinPlanModal
      state={pinModal.state}
      onConfirm={pinModal.handleConfirm}
      onCancel={pinModal.handleCancel}
    />
  );

  if (plan) {
    return (
      <>
        <ExplainPlan
          plan={plan}
          statementFingerprintID={statementFingerprintID}
          backToPlanTable={backToPlanTable}
          sortSetting={insightsSortSetting}
          onChangeSortSetting={setInsightsSortSetting}
          hasAdminRole={hasAdminRole}
          pinnedGists={pinnedGists}
          coverageByGist={coverageByGist}
          execsByGist={execsByGist}
          fingerprintTotalExecs={fingerprintTotalExecs}
          onPin={handlePin}
          onUnpin={handleUnpin}
        />
        {modal}
      </>
    );
  } else {
    return (
      <div>
        <PlanPinningControls
          pinnedCount={pinnedGists.size}
          totalPlans={plans?.length || 0}
          auditLog={auditLog}
          plans={plans}
          pinnedGists={pinnedGists}
          statementFingerprintID={statementFingerprintID}
        />
        <div className={cx("table-area")}>
          <PlanTable
            plans={plans}
            handleDetails={handleDetails}
            sortSetting={plansSortSetting}
            onChangeSortSetting={setPlansSortSetting}
            pinnedGists={pinnedGists}
            coverageByGist={coverageByGist}
            execsByGist={execsByGist}
            fingerprintTotalExecs={fingerprintTotalExecs}
            onPin={handlePin}
            onUnpin={handleUnpin}
          />
        </div>
        {modal}
      </div>
    );
  }
}

interface PlanTableProps {
  plans: PlanHashStats[];
  handleDetails: (plan: PlanHashStats) => void;
  sortSetting: SortSetting;
  onChangeSortSetting: (ss: SortSetting) => void;
  pinnedGists?: Set<string>;
  coverageByGist?: Map<string, number>;
  execsByGist?: Map<string, number>;
  fingerprintTotalExecs?: number;
  onPin?: (gist: string) => void;
  onUnpin?: (gist: string) => void;
}

function PlanTable({
  plans,
  handleDetails,
  sortSetting,
  onChangeSortSetting,
  pinnedGists,
  coverageByGist,
  execsByGist,
  fingerprintTotalExecs,
  onPin,
  onUnpin,
}: PlanTableProps): React.ReactElement {
  const columns = makeExplainPlanColumns(
    handleDetails,
    pinnedGists,
    coverageByGist,
    execsByGist,
    fingerprintTotalExecs,
    onPin,
    onUnpin,
  );
  return (
    <PlansSortedTable
      columns={columns}
      data={plans}
      className="statements-table"
      sortSetting={sortSetting}
      onChangeSortSetting={onChangeSortSetting}
    />
  );
}

interface ExplainPlanProps {
  plan: PlanHashStats;
  statementFingerprintID: string;
  backToPlanTable: () => void;
  sortSetting: SortSetting;
  onChangeSortSetting: (ss: SortSetting) => void;
  hasAdminRole: boolean;
  pinnedGists?: Set<string>;
  coverageByGist?: Map<string, number>;
  execsByGist?: Map<string, number>;
  fingerprintTotalExecs?: number;
  onPin?: (gist: string) => void;
  onUnpin?: (gist: string) => void;
}

function ExplainPlan({
  plan,
  statementFingerprintID,
  backToPlanTable,
  sortSetting,
  onChangeSortSetting,
  hasAdminRole,
  pinnedGists,
  coverageByGist,
  execsByGist,
  fingerprintTotalExecs,
  onPin,
  onUnpin,
}: ExplainPlanProps): React.ReactElement {
  const gist = plan.stats.plan_gists?.[0] || "";
  const isPinned = pinnedGists?.has(gist) || false;
  const coverage = isPinned ? (coverageByGist?.get(gist) ?? 100) : null;
  const planExecs = isPinned ? (execsByGist?.get(gist) ?? 0) : 0;
  const totalExecs = fingerprintTotalExecs ?? 0;
  const explainPlan =
    `Plan Gist: ${gist} \n\n` +
    (plan.explain_plan === "" ? "unavailable" : plan.explain_plan);
  const hasInsights = plan.stats.index_recommendations?.length > 0;
  const duration = (v: number) => Duration(v * 1e9);
  const count = (v: number) => v.toFixed(1);
  return (
    <div>
      <Helmet title="Plan Details" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <Button
          onClick={backToPlanTable}
          type="unstyled-link"
          size="small"
          icon={<ArrowLeft fontSize={"10px"} />}
          iconPosition="left"
          className="small-margin"
        >
          All Plans
        </Button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0 8px",
              borderRadius: "3px",
              fontSize: "12px",
              fontWeight: 400,
              height: "28px",
              whiteSpace: "nowrap",
              backgroundColor: isPinned ? "#e1ecff" : "#f0f2f5",
              color: isPinned ? "#0037a5" : "#475872",
            }}
          >
            {isPinned ? "Pinned" : "Unpinned"}
          </span>
          {isPinned && coverage !== null && (
            <span
              title={
                coverage === 0
                  ? "This pinned plan is not being used. The optimizer is selecting a different plan for every execution."
                  : coverage < 100
                  ? `Pin sticks for ${coverage}% of executions; the optimizer falls back for the remaining ${100 - coverage}%.`
                  : "Pin sticks for every execution of this fingerprint."
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                fontWeight: coverage === 0 ? 600 : 400,
                color: coverage === 0 ? "#cd2939" : "#475872",
                padding: coverage === 0 ? "2px 6px" : 0,
                borderRadius: coverage === 0 ? "3px" : 0,
                backgroundColor: coverage === 0 ? "#ffe9eb" : undefined,
                cursor: "help",
              }}
            >
              Pin applied: {coverage}%
              {totalExecs > 0 && (
                <span style={{ color: coverage === 0 ? "#cd2939" : "#7e89a9" }}>
                  {" "}({planExecs.toLocaleString()} of {totalExecs.toLocaleString()})
                </span>
              )}
            </span>
          )}
          <button
            onClick={() => isPinned ? onUnpin?.(gist) : onPin?.(gist)}
            title={isPinned ? "Unpin" : "Pin"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px",
              border: "1px solid #c0c6d9",
              borderRadius: "4px",
              backgroundColor: "white",
              color: isPinned ? "#0055ff" : "#394455",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 17v5" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={isPinned ? "currentColor" : "none"} />
            </svg>
          </button>
        </div>
      </div>
      <SqlBox value={explainPlan} size={SqlBoxSize.CUSTOM} />
      <Row gutter={24} className={cx("margin-left-neg", "margin-bottom")}>
        <Col className="gutter-row" span={12}>
          <SummaryCard className={cx("summary-card")}>
            <SummaryCardItem
              label="Last Execution Time"
              value={
                <Timestamp
                  time={TimestampToMoment(plan.stats.last_exec_timestamp)}
                  format={DATE_FORMAT_24_TZ}
                />
              }
            />
            <SummaryCardItem
              label="Average Execution Time"
              value={formatNumberForDisplay(plan.stats.run_lat?.mean, duration)}
            />
            <SummaryCardItem
              label="Execution Count"
              value={Count(longToInt(plan.stats.count))}
            />
            <SummaryCardItem
              label="Average Rows Read"
              value={formatNumberForDisplay(plan.stats.rows_read?.mean, count)}
            />
          </SummaryCard>
        </Col>
        <Col className="gutter-row" span={12}>
          <SummaryCard className={cx("summary-card")}>
            <SummaryCardItem
              label="Full Scan"
              value={RenderCount(
                plan.metadata.full_scan_count,
                plan.metadata.total_count,
              )}
            />
            <SummaryCardItem
              label="Generic Query Plan"
              value={RenderCount(plan.stats.generic_count, plan.stats.count)}
            />
            <SummaryCardItem
              label="Statement Hints"
              value={RenderCount(plan.stats.stmt_hints_count, plan.stats.count)}
            />
            <SummaryCardItem
              label="Distributed"
              value={RenderCount(
                plan.metadata.dist_sql_count,
                plan.metadata.total_count,
              )}
            />
            <SummaryCardItem
              label="Vectorized"
              value={RenderCount(
                plan.metadata.vec_count,
                plan.metadata.total_count,
              )}
            />
            <SummaryCardItem
              label="Used Indexes"
              value={formatIndexes(
                plan.stats.indexes,
                plan.metadata.databases[0],
              )}
            />
          </SummaryCard>
        </Col>
      </Row>
      {hasInsights && (
        <Insights
          idxRecommendations={plan.stats.index_recommendations}
          database={plan.metadata.databases[0]}
          query={plan.metadata.query}
          implicitTxn={plan.metadata.implicit_txn}
          statementFingerprintID={statementFingerprintID}
          sortSetting={sortSetting}
          onChangeSortSetting={onChangeSortSetting}
          hasAdminRole={hasAdminRole}
        />
      )}
    </div>
  );
}

interface PlanPinningControlsProps {
  pinnedCount: number;
  totalPlans: number;
  auditLog: Array<{
    action: string;
    gist: string;
    timestamp: Date;
    user: string;
  }>;
  plans: PlanHashStats[];
  pinnedGists: Set<string>;
  statementFingerprintID: string;
}

function PlanPinningControls({
  pinnedCount,
  totalPlans,
  auditLog,
  plans,
  pinnedGists,
  statementFingerprintID,
}: PlanPinningControlsProps): React.ReactElement {
  return (
    <div style={{ marginBottom: "0px", marginTop: "-32px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 0",
        }}
      >
        <span style={{ fontSize: "14px", color: "#475872" }}>
          {totalPlans === 1
            ? "1 plan"
            : totalPlans <= 5
              ? `1-${totalPlans} of ${totalPlans} plans`
              : `1-5 of ${totalPlans} plans`}
        </span>
      </div>

    </div>
  );
}

function formatIdxRecommendations(
  idxRecs: string[],
  database: string,
  query: string,
  implicitTxn?: boolean,
  statementFingerprintID?: string,
): InsightRecommendation[] {
  const recs = [];
  for (let i = 0; i < idxRecs.length; i++) {
    const rec = idxRecs[i];
    let idxType: InsightType;
    if (!rec?.includes(" : ")) {
      continue;
    }
    const t = rec.split(" : ")[0];
    switch (t) {
      case "creation":
        idxType = "CreateIndex";
        break;
      case "replacement":
        idxType = "ReplaceIndex";
        break;
      case "drop":
        idxType = "DropIndex";
        break;
      case "alteration":
        idxType = "AlterIndex";
        break;
    }
    const idxRec: InsightRecommendation = {
      type: idxType,
      database: database,
      query: rec.split(" : ")[1],
      execution: {
        statement: query,
        summary: query.length > 120 ? query.slice(0, 120) + "..." : query,
        fingerprintID: statementFingerprintID,
        implicit: implicitTxn,
      },
    };
    recs.push(idxRec);
  }

  return recs;
}

interface InsightsProps {
  idxRecommendations: string[];
  database: string;
  query: string;
  implicitTxn?: boolean;
  statementFingerprintID?: string;
  sortSetting?: SortSetting;
  onChangeSortSetting?: (ss: SortSetting) => void;
  hasAdminRole: boolean;
}

export function Insights({
  idxRecommendations,
  database,
  query,
  implicitTxn,
  statementFingerprintID,
  sortSetting,
  onChangeSortSetting,
  hasAdminRole,
}: InsightsProps): React.ReactElement {
  const hideAction =
    useContext(CockroachCloudContext) || database?.length === 0;
  const insightsColumns = makeInsightsColumns(hideAction, hasAdminRole, true);
  const data = formatIdxRecommendations(
    idxRecommendations,
    database,
    query,
    implicitTxn,
    statementFingerprintID,
  );
  return (
    <Row gutter={24} className={cx("margin-bottom")}>
      <InsightsSortedTable
        columns={insightsColumns}
        data={data}
        sortSetting={sortSetting}
        onChangeSortSetting={onChangeSortSetting}
      />
    </Row>
  );
}
