// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import React from "react";

import { tokens } from "./pinnedPlans.tokens";

/** Format a duration in seconds for the Avg latency / drift latency columns. */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  if (seconds < 0.001) return `${(seconds * 1e6).toFixed(0)} µs`;
  if (seconds < 1) return `${(seconds * 1e3).toFixed(1)} ms`;
  return `${seconds.toFixed(2)} s`;
}

/**
 * Compact integer formatter. Keeps small counts readable with commas, then
 * switches to k/M abbreviations once values get long enough to bloat the
 * "Pin applied" / "Override rate" cells (e.g. 16,088 → "16k").
 */
export function abbrev(n: number): string {
  if (n < 10000) return n.toLocaleString();
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  if (n < 10000000) return `${(n / 1000000).toFixed(1)}M`;
  return `${Math.round(n / 1000000)}M`;
}

/** Inline "Pinned" pill badge used in the pin-status column. */
export function PlanPinBadge(): React.ReactElement {
  return (
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
        backgroundColor: tokens.primaryBlueAlert,
        color: tokens.primaryBlueDark,
      }}
    >
      Pinned
    </span>
  );
}
