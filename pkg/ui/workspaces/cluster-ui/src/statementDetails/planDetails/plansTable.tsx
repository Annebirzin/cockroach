// Copyright 2022 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { cockroach } from "@cockroachlabs/crdb-protobuf-client";
import { Tooltip } from "@cockroachlabs/ui-components";
import React, { ReactNode } from "react";

import { ColumnDescriptor, SortedTable } from "src/sortedtable";

import { Anchor } from "../../anchor";
import { IndexStatsLink } from "../../components/links/indexStatsLink";
import { Timestamp, Timezone } from "../../timestamp";
import {
  Duration,
  formatNumberForDisplay,
  longToInt,
  TimestampToMoment,
  RenderCount,
  DATE_FORMAT,
  explainPlan,
  limitText,
  Count,
  intersperse,
} from "../../util";

export type PlanHashStats =
  cockroach.server.serverpb.StatementDetailsResponse.ICollectedStatementGroupedByPlanHash;
export const PlansSortedTable = SortedTable<PlanHashStats>;

const planDetailsColumnLabels = {
  avgExecTime: "Average Execution Time",
  avgRowsRead: "Average Rows Read",
  generic: "Generic Query Plan",
  stmtHints: "Statement Hints",
  distSQL: "Distributed",
  execCount: "Execution Count",
  fullScan: "Full Scan",
  insights: "Insights",
  indexes: "Used Indexes",
  lastExecTime: "Last Execution Time",
  latencyMax: "Max Latency",
  latencyMin: "Min Latency",
  planGist: "Plan Gist",
  vectorized: "Vectorized",
};
export type PlanDetailsTableColumnKeys = keyof typeof planDetailsColumnLabels;

type PlanDetailsTableTitleType = {
  [key in PlanDetailsTableColumnKeys]: () => JSX.Element;
};

export const planDetailsTableTitles: PlanDetailsTableTitleType = {
  planGist: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={
          <p>
            The Gist of the{" "}
            <Anchor href={explainPlan} target="_blank">
              Explain Plan.
            </Anchor>
          </p>
        }
      >
        {planDetailsColumnLabels.planGist}
      </Tooltip>
    );
  },
  lastExecTime: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"The last time this Explain Plan was executed."}
      >
        <>
          {planDetailsColumnLabels.lastExecTime} <Timezone />
        </>
      </Tooltip>
    );
  },
  avgExecTime: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"The average execution time for this Explain Plan."}
      >
        {planDetailsColumnLabels.avgExecTime}
      </Tooltip>
    );
  },
  latencyMin: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={
          "The lowest latency value for all statement executions with this Explain Plan."
        }
      >
        {planDetailsColumnLabels.latencyMin}
      </Tooltip>
    );
  },
  latencyMax: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={
          "The highest latency value for all statement executions with this Explain Plan."
        }
      >
        {planDetailsColumnLabels.latencyMax}
      </Tooltip>
    );
  },
  execCount: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"The execution count for this Explain Plan."}
      >
        {planDetailsColumnLabels.execCount}
      </Tooltip>
    );
  },
  avgRowsRead: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"The average of rows read by this Explain Plan."}
      >
        {planDetailsColumnLabels.avgRowsRead}
      </Tooltip>
    );
  },
  fullScan: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"If the Explain Plan executed a full scan."}
      >
        {planDetailsColumnLabels.fullScan}
      </Tooltip>
    );
  },
  generic: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"If the Explain Plan was generic."}
      >
        {planDetailsColumnLabels.generic}
      </Tooltip>
    );
  },
  stmtHints: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"If hints from statement_hints were applied."}
      >
        {planDetailsColumnLabels.stmtHints}
      </Tooltip>
    );
  },
  distSQL: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"If the Explain Plan was distributed."}
      >
        {planDetailsColumnLabels.distSQL}
      </Tooltip>
    );
  },
  vectorized: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"If the Explain Plan was vectorized."}
      >
        {planDetailsColumnLabels.vectorized}
      </Tooltip>
    );
  },
  insights: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"The amount of insights for the Explain Plan."}
      >
        {planDetailsColumnLabels.insights}
      </Tooltip>
    );
  },
  indexes: () => {
    return (
      <Tooltip
        style="tableTitle"
        placement="bottom"
        content={"Indexes used by the Explain Plan."}
      >
        {planDetailsColumnLabels.indexes}
      </Tooltip>
    );
  },
};

function formatInsights(recommendations: string[]): string {
  if (!recommendations || recommendations.length === 0) {
    return "None";
  }
  if (recommendations.length === 1) {
    return "1 Insight";
  }
  return `${recommendations.length} Insights`;
}

export function formatIndexes(indexes: string[], database: string): ReactNode {
  if (indexes.length === 0) {
    return <></>;
  }
  const indexMap: Map<string, Array<string>> = new Map<string, Array<string>>();
  let droppedCount = 0;
  let tableName: string;
  let idxName;
  let indexInfo;
  for (let i = 0; i < indexes.length; i++) {
    if (indexes[i] === "dropped") {
      droppedCount++;
      continue;
    }
    if (!indexes[i].includes("@")) {
      continue;
    }
    indexInfo = indexes[i].split("@");
    tableName = indexInfo[0];
    idxName = indexInfo[1];
    if (indexMap.has(tableName)) {
      indexMap.set(tableName, indexMap.get(tableName).concat(idxName));
    } else {
      indexMap.set(tableName, [idxName]);
    }
  }

  let newLine;
  const list = Array.from(indexMap).map((value, i) => {
    const table = value[0];
    newLine = i > 0 ? <br /> : "";
    const indexesList = intersperse<ReactNode>(
      value[1].map((idx, i) => {
        return (
          <IndexStatsLink
            key={`index-${i}`}
            dbName={database}
            escSchemaQualifiedTableName={tableName}
            indexName={idx}
          />
        );
      }),
      ", ",
    );
    return (
      <span key={table}>
        {newLine}
        {table}: {indexesList}
      </span>
    );
  });
  newLine = list.length > 0 ? <br /> : "";
  if (droppedCount === 1) {
    list.push(<span key={`dropped`}>{newLine}[dropped index]</span>);
  } else if (droppedCount > 1) {
    list.push(
      <span key={`dropped`}>
        {newLine}[{droppedCount} dropped indexes]
      </span>,
    );
  }

  return intersperse<ReactNode>(list, ",");
}

export function makeExplainPlanColumns(
  handleDetails: (plan: PlanHashStats) => void,
  pinnedGists?: Set<string>,
  invalidGists?: Set<string>,
  onPin?: (gist: string) => void,
  onUnpin?: (gist: string) => void,
): ColumnDescriptor<PlanHashStats>[] {
  const duration = (v: number) => Duration(v * 1e9);
  const count = (v: number) => v.toFixed(1);
  const pinned = pinnedGists || new Set<string>();
  const invalid = invalidGists || new Set<string>();
  return [
    {
      name: "pin",
      title: (<span style={{ whiteSpace: "nowrap" }}>Plan pin status</span>),
      cell: (item: PlanHashStats) => {
        const gist = item.stats.plan_gists?.[0] || "";
        const isPinned = pinned.has(gist);
        const isInvalid = isPinned && invalid.has(gist);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isPinned) {
                  onUnpin?.(gist);
                } else {
                  onPin?.(gist);
                }
              }}
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
                backgroundColor: isPinned ? (isInvalid ? "#ffe9eb" : "#e1ecff") : "#f0f2f5",
                color: isPinned ? (isInvalid ? "#cd2939" : "#0037a5") : "#475872",
              }}
            >
              {isPinned ? (isInvalid ? "Invalid pin" : "Pinned") : "Unpinned"}
            </span>
          </div>
        );
      },
      alwaysShow: true,
    },
    {
      name: "planGist",
      title: planDetailsTableTitles.planGist(),
      cell: (item: PlanHashStats) => {
        const gist = item.stats.plan_gists?.[0] || "";
        return (
          <Tooltip placement="bottom" content={gist}>
            <a onClick={() => handleDetails(item)}>
              {limitText(gist, 25)}
            </a>
          </Tooltip>
        );
      },
      sort: (item: PlanHashStats) => item.stats.plan_gists[0],
      alwaysShow: true,
    },
    {
      name: "indexes",
      title: planDetailsTableTitles.indexes(),
      cell: (item: PlanHashStats) =>
        formatIndexes(item.stats.indexes, item.metadata.databases[0]),
      sort: (item: PlanHashStats) => item.stats.indexes?.join(""),
    },
    {
      name: "insights",
      title: planDetailsTableTitles.insights(),
      cell: (item: PlanHashStats) =>
        formatInsights(item.stats.index_recommendations),
      sort: (item: PlanHashStats) => item.stats.index_recommendations?.length,
    },
    {
      name: "lastExecTime",
      title: planDetailsTableTitles.lastExecTime(),
      cell: (item: PlanHashStats) => (
        <Timestamp
          time={TimestampToMoment(item.stats.last_exec_timestamp)}
          format={DATE_FORMAT}
        />
      ),
      sort: (item: PlanHashStats) =>
        TimestampToMoment(item.stats.last_exec_timestamp).unix(),
    },
    {
      name: "avgExecTime",
      title: planDetailsTableTitles.avgExecTime(),
      cell: (item: PlanHashStats) =>
        formatNumberForDisplay(item.stats.run_lat.mean, duration),
      sort: (item: PlanHashStats) => item.stats.run_lat.mean,
    },
    {
      name: "execCount",
      title: planDetailsTableTitles.execCount(),
      cell: (item: PlanHashStats) => Count(longToInt(item.stats.count)),
      sort: (item: PlanHashStats) => longToInt(item.stats.count),
    },
    {
      name: "avgRowsRead",
      title: planDetailsTableTitles.avgRowsRead(),
      cell: (item: PlanHashStats) =>
        formatNumberForDisplay(item.stats.rows_read.mean, count),
      sort: (item: PlanHashStats) =>
        formatNumberForDisplay(item.stats.rows_read.mean, count),
    },
    {
      name: "fullScan",
      title: planDetailsTableTitles.fullScan(),
      cell: (item: PlanHashStats) =>
        RenderCount(item.metadata.full_scan_count, item.metadata.total_count),
      sort: (item: PlanHashStats) =>
        RenderCount(item.metadata.full_scan_count, item.metadata.total_count),
    },
    {
      name: "latencyMin",
      title: planDetailsTableTitles.latencyMin(),
      cell: (item: PlanHashStats) =>
        formatNumberForDisplay(item.stats.latency_info.min, duration),
      sort: (item: PlanHashStats) => item.stats.latency_info.min,
    },
    {
      name: "latencyMax",
      title: planDetailsTableTitles.latencyMax(),
      cell: (item: PlanHashStats) =>
        formatNumberForDisplay(item.stats.latency_info.max, duration),
      sort: (item: PlanHashStats) => item.stats.latency_info.max,
    },
    {
      name: "generic",
      title: planDetailsTableTitles.generic(),
      cell: (item: PlanHashStats) =>
        RenderCount(item.stats.generic_count, item.stats.count),
      sort: (item: PlanHashStats) =>
        RenderCount(item.stats.generic_count, item.stats.count),
    },
    {
      name: "stmtHints",
      title: planDetailsTableTitles.stmtHints(),
      cell: (item: PlanHashStats) =>
        RenderCount(item.stats.stmt_hints_count, item.stats.count),
      sort: (item: PlanHashStats) =>
        RenderCount(item.stats.stmt_hints_count, item.stats.count),
    },
    {
      name: "distSQL",
      title: planDetailsTableTitles.distSQL(),
      cell: (item: PlanHashStats) =>
        RenderCount(item.metadata.dist_sql_count, item.metadata.total_count),
      sort: (item: PlanHashStats) =>
        RenderCount(item.metadata.dist_sql_count, item.metadata.total_count),
    },
    {
      name: "vectorized",
      title: planDetailsTableTitles.vectorized(),
      cell: (item: PlanHashStats) =>
        RenderCount(item.metadata.vec_count, item.metadata.total_count),
      sort: (item: PlanHashStats) =>
        RenderCount(item.metadata.vec_count, item.metadata.total_count),
    },
  ];
}
