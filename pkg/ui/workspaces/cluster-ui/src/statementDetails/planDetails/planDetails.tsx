// Copyright 2022 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { ArrowLeft } from "@cockroachlabs/icons";
import { Col, Row } from "antd";
import classNames from "classnames/bind";
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

const cx = classNames.bind(styles);

interface PlanDetailsProps {
  plans: PlanHashStats[];
  statementFingerprintID: string;
  hasAdminRole: boolean;
}

export function PlanDetails({
  plans,
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
  // Mock pinned fingerprint IDs matching pinnedPlansPage.tsx mock data.
  const PINNED_FINGERPRINT_IDS = new Set([
    "5193222733586324267",  // INSERT INTO rides
    "7562955041576980258",  // SELECT count(*) FROM user_promo_codes
    "3350546850174482743",  // SELECT city, id FROM vehicles
    "7442192024002430332",  // UPSERT INTO vehicle_location_histories
    "3939633309730011619",  // INSERT INTO user_promo_codes
  ]);

  const initPinnedGists = React.useMemo(() => {
    const hasPins = PINNED_FINGERPRINT_IDS.has(statementFingerprintID);
    if (hasPins && plans?.length > 0) {
      const firstGist = plans[0]?.stats?.plan_gists?.[0];
      if (firstGist) return new Set([firstGist]);
    }
    return new Set<string>();
  }, [statementFingerprintID, plans]);

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

  const handlePin = useCallback((gist: string) => {
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

  const handleUnpin = useCallback((gist: string) => {
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

  const handleDetails = (plan: PlanHashStats): void => {
    setPlan(plan);
  };
  const backToPlanTable = (): void => {
    setPlan(null);
  };

  if (plan) {
    return (
      <ExplainPlan
        plan={plan}
        statementFingerprintID={statementFingerprintID}
        backToPlanTable={backToPlanTable}
        sortSetting={insightsSortSetting}
        onChangeSortSetting={setInsightsSortSetting}
        hasAdminRole={hasAdminRole}
        pinnedGists={pinnedGists}
        onPin={handlePin}
        onUnpin={handleUnpin}
      />
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
            onPin={handlePin}
            onUnpin={handleUnpin}
          />
        </div>
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
  onPin?: (gist: string) => void;
  onUnpin?: (gist: string) => void;
}

function PlanTable({
  plans,
  handleDetails,
  sortSetting,
  onChangeSortSetting,
  pinnedGists,
  onPin,
  onUnpin,
}: PlanTableProps): React.ReactElement {
  const columns = makeExplainPlanColumns(handleDetails, pinnedGists, onPin, onUnpin);
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
  onPin,
  onUnpin,
}: ExplainPlanProps): React.ReactElement {
  const gist = plan.stats.plan_gists?.[0] || "";
  const isPinned = pinnedGists?.has(gist) || false;
  const INVALID_FINGERPRINTS = new Set(["3350546850174482743"]);
  const isInvalidPin = isPinned && INVALID_FINGERPRINTS.has(statementFingerprintID);
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
          {isPinned && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "3px",
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "20px",
                whiteSpace: "nowrap",
                backgroundColor: isInvalidPin ? "#ffe9eb" : "#e1ecff",
                color: isInvalidPin ? "#cd2939" : "#0037a5",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill="currentColor" />
              </svg>
              {isInvalidPin ? "Invalid plan pin" : "Plan pinned"}
            </span>
          )}
          <button
            onClick={() => isPinned ? onUnpin?.(gist) : onPin?.(gist)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
              lineHeight: "20px",
              border: "1px solid #c0c6d9",
              borderRadius: "4px",
              backgroundColor: "white",
              color: isPinned ? "#0055ff" : "#394455",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 17v5" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={isPinned ? "currentColor" : "none"} />
            </svg>
            {isPinned ? "Unpin" : "Pin"}
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
  const [showDrift, setShowDrift] = useState(false);

  // Mock data aligned with pinnedPlansPage.tsx
  const MOCK_PINNED_DATA: Record<string, { executions: number; overridden: number; status: string }> = {
    "5193222733586324267": { executions: 507, overridden: 61, status: "active" },
    "7562955041576980258": { executions: 120, overridden: 8, status: "active" },
    "3350546850174482743": { executions: 0, overridden: 0, status: "invalid" },
    "7442192024002430332": { executions: 12378, overridden: 1856, status: "active" },
    "3939633309730011619": { executions: 116, overridden: 0, status: "active" },
  };

  // Use real execution data from plans, with mock overridden from pinned plans page
  const totalExecutions = plans.reduce((sum, p) => sum + longToInt(p.stats.count), 0);
  const pinnedExecutions = plans
    .filter(p => pinnedGists.has(p.stats.plan_gists?.[0] || ""))
    .reduce((sum, p) => sum + longToInt(p.stats.count), 0);
  const pinnedPct = totalExecutions > 0 ? Math.round((pinnedExecutions / totalExecutions) * 100) : 0;

  // Pull overridden count from mock data to align with Pinned Plans page
  const mockData = MOCK_PINNED_DATA[statementFingerprintID];
  const wouldHaveChosenDifferent = mockData?.overridden || 0;
  const isInvalid = mockData?.status === "invalid";
  const fallbackExecutions = 0;

  // Mock drift data: for each unpinned plan, show it as a "candidate" the optimizer would pick
  const driftCandidates = pinnedCount > 0
    ? plans
        .filter(p => !pinnedGists.has(p.stats.plan_gists?.[0] || ""))
        .map(p => ({
          gist: p.stats.plan_gists?.[0] || "",
          wouldHaveExecuted: Math.round(longToInt(p.stats.count) * 0.3),
          lastWouldHaveExecuted: TimestampToMoment(p.stats.last_exec_timestamp),
          avgLatency: p.stats.run_lat?.mean || 0,
        }))
    : [];

  // Invalid pins: use status from mock data
  const invalidPins = isInvalid
    ? [{ gist: Array.from(pinnedGists)[0], reason: "Referenced index 'vehicles@idx_city_status' was dropped" }]
    : [];

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {driftCandidates.length > 0 && (
            <button
              onClick={() => setShowDrift(!showDrift)}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 500,
                border: "1px solid #c0c6d9",
                borderRadius: "4px",
                backgroundColor: "white",
                color: "#394455",
                cursor: "pointer",
              }}
            >
              {showDrift ? "Hide" : "Show"} Drift Analysis ({driftCandidates.length})
            </button>
          )}
        </div>
      </div>


      {/* Drift Analysis */}
      {showDrift && driftCandidates.length > 0 && (
        <div
          style={{
            marginBottom: "16px",
            border: "1px solid #e7ecf3",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 16px",
              backgroundColor: "#f5f7fa",
              borderBottom: "1px solid #e7ecf3",
              fontSize: "13px",
              fontWeight: 600,
              color: "#394455",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Plan Drift Analysis</span>
            <span style={{ fontSize: "12px", fontWeight: 400, color: "#7b8794" }}>
              Plans the optimizer would have chosen instead of the pinned plan
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th style={{ padding: "8px 16px", textAlign: "left", fontWeight: 600, color: "#394455", borderBottom: "1px solid #e7ecf3" }}>Candidate Plan Gist</th>
                  <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: 600, color: "#394455", borderBottom: "1px solid #e7ecf3" }}>Would-Have-Executed Count</th>
                  <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: 600, color: "#394455", borderBottom: "1px solid #e7ecf3" }}>Avg Latency</th>
                  <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: 600, color: "#394455", borderBottom: "1px solid #e7ecf3" }}>Last Would-Have-Executed</th>
                  <th style={{ padding: "8px 16px", textAlign: "center", fontWeight: 600, color: "#394455", borderBottom: "1px solid #e7ecf3" }}>Assessment</th>
                </tr>
              </thead>
              <tbody>
                {driftCandidates.map((candidate, i) => {
                  // Mock assessment: compare latency
                  const pinnedPlan = plans.find(p => pinnedGists.has(p.stats.plan_gists?.[0] || ""));
                  const pinnedLatency = pinnedPlan?.stats.run_lat?.mean || 0;
                  const isBetter = candidate.avgLatency < pinnedLatency * 0.9;
                  const isWorse = candidate.avgLatency > pinnedLatency * 1.1;
                  return (
                    <tr key={i} style={{ borderBottom: i < driftCandidates.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: "12px" }}>
                        {candidate.gist.length > 30 ? candidate.gist.slice(0, 30) + "..." : candidate.gist}
                      </td>
                      <td style={{ padding: "8px 16px", textAlign: "right" }}>{candidate.wouldHaveExecuted}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right" }}>{Duration(candidate.avgLatency * 1e9)}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right" }}>{candidate.lastWouldHaveExecuted.format("MMM D, YYYY HH:mm")}</td>
                      <td style={{ padding: "8px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "3px",
                            fontSize: "12px",
                            fontWeight: 600,
                            backgroundColor: isBetter ? "#e3f5e0" : isWorse ? "#ffe9eb" : "#e7ecf3",
                            color: isBetter ? "#237300" : isWorse ? "#cd2939" : "#394455",
                          }}
                        >
                          {isBetter ? "Potential Improvement" : isWorse ? "Regression Risk" : "Comparable"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
