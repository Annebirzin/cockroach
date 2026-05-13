// Copyright 2025 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { InlineAlert, Tooltip } from "@cockroachlabs/ui-components";
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet";

import { Pagination, ResultsPerPageLabel } from "../pagination";
import {
  PinPermissionGate,
  PinPlanModal,
  runPinAction,
  usePinDemoState,
  usePinPlanModal,
} from "./pinPlanModal";

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

// Total executions per statement fingerprint. Used to render the
// "Pin applied" cell as `% (X of Y)` where Y is the fingerprint total.
// All pinned plans for a fingerprint share the same Y.
const mockTotalExecutions: Record<string, number> = {
  "5193222733586324267": 660,     // INSERT INTO rides
  "7562955041576980258": 200,     // SELECT count(*) FROM user_promo_codes
  "3350546850174482743": 8934,    // SELECT city, id FROM vehicles
  "7442192024002430332": 16088,   // UPSERT INTO vehicle_location_histories
  "3939633309730011619": 150,     // INSERT INTO user_promo_codes
  "8211045892001823341": 24502,   // SELECT * FROM users WHERE city = $1 AND id = $2
  "1872834451029384720": 1428,    // UPDATE users SET name = $1 WHERE city = $2 AND id = $3
  "6204918273645501982": 9421,    // SELECT id, owner_id FROM vehicles WHERE city = $1 ORDER BY id LIMIT $2
  "3091827364502938471": 472,     // DELETE FROM rides WHERE city = $1 AND id = $2
  "5128374650192837465": 33108,   // UPSERT INTO rides VALUES (...)
  "9182736450192837461": 880,     // SELECT vehicle_city, vehicle_id, count(*) FROM rides ...
  "7384650192837465019": 215,     // INSERT INTO promo_codes ...
  "4019283746501928374": 5610,    // SELECT * FROM rides WHERE rider_id = $1 ORDER BY start_time DESC LIMIT $2
  "6502938471650293847": 304,     // UPDATE vehicles SET status = $1 WHERE city = $2 AND id = $3
  "1029384756102938475": 2087,    // SELECT count(*) FROM users WHERE city = $1
  "8475610293847561029": 612,     // INSERT INTO users (id, city, name, address, credit_card) VALUES (...)
  "2938475610293847561": 12089,   // SELECT description FROM promo_codes WHERE code = $1
  "3847561029384756102": 178,     // SELECT distinct city FROM users
  "5610293847561029384": 4421,    // SELECT * FROM vehicle_location_histories WHERE city = $1 AND ride_id = $2
  "9384756102938475610": 711,     // SELECT name FROM users WHERE city = $1 ORDER BY creation_time DESC LIMIT $2
  "1561029384756102938": 6203,    // SELECT id, owner_id, type FROM vehicles WHERE city = $1 AND status = 'available' LIMIT $2
  "7102938475610293847": 1834,    // SELECT (sum(revenue)) FROM rides WHERE city = $1 AND start_time > $2
  "4756102938475610293": 92,      // INSERT INTO user_promo_codes (city, user_id, code, ...) VALUES (...)
  "6029384756102938475": 51284,   // SELECT id FROM vehicle_location_histories WHERE city = $1 AND ride_id = $2 ORDER BY timestamp DESC LIMIT $3
  "2837465019283746501": 7891,    // SELECT email FROM users WHERE city = $1 AND id = $2
  "9203847561029384756": 1102,    // UPDATE rides SET end_time = $1 WHERE city = $2 AND id = $3
  "4029384756102938475": 8420,    // SELECT count(*) FROM rides WHERE rider_id = $1
  "8102938475610293847": 502,     // INSERT INTO vehicles (id, city, type, owner_id, status) VALUES ($1, $2, $3, $4, $5)
  "5293847561029384756": 14982,   // SELECT id, code FROM promo_codes WHERE creation_time > $1 LIMIT $2
  "6840291837465019283": 33,      // DELETE FROM user_promo_codes WHERE city = $1 AND user_id = $2 AND code = $3
  "7561029384756102938": 920,     // SELECT max(timestamp) FROM vehicle_location_histories WHERE city = $1 AND ride_id = $2
  "3650192837465019283": 410,     // SELECT id FROM users WHERE city = $1 LIMIT $2 OFFSET $3
  "4109283746501928374": 27340,   // SELECT * FROM vehicles WHERE id = $1
};

// Mock data for the pinned plans dashboard.
// `coverage` = % of fingerprint executions that used this pinned plan.
//   100 = pin always wins. 0 = pin never used (e.g. plan no longer applicable).
//   Anything in between = pin only sticks for some executions.
const mockPinnedPlans = [
  // INSERT INTO rides — 2 pinned plans, both well-utilized
  {
    statementFingerprint:
      "INSERT INTO rides VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)",
    fingerprintID: "5193222733586324267",
    database: "movr",
    gist: "AiAC2AEB",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-27T14:30:00"),
    executions: 507,
    overridden: 61,
    coverage: 77,
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
    executions: 152,
    overridden: 23,
    coverage: 23,
    avgLatency: 0.0041,
    lastExecTime: new Date("2026-04-02T09:15:00"),
  },
  // SELECT count(*) FROM user_promo_codes —
  // plan 1 only sticks ~60% of the time (the "partial coverage" case);
  // plan 2 never gets used (Coverage 0% — was previously the "Invalid pin" signal)
  {
    statementFingerprint:
      "SELECT count(*) FROM user_promo_codes WHERE ((city = $1) AND (user_id = $2)) AND (code = $3)",
    fingerprintID: "7562955041576980258",
    database: "movr",
    gist: "AgHeAQIABwIAAAUADAYC",
    pinnedBy: "dba_admin",
    pinnedAt: new Date("2026-03-26T09:15:00"),
    executions: 120,
    overridden: 8,
    coverage: 60,
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
    executions: 0,
    overridden: 0,
    coverage: 0,
    avgLatency: 0,
    lastExecTime: new Date("2026-03-24T16:00:00"),
  },
  // SELECT city, id FROM vehicles — one stale pin (0%) + one fully utilized (100%)
  {
    statementFingerprint:
      "SELECT city, id FROM vehicles WHERE city = $1",
    fingerprintID: "3350546850174482743",
    database: "movr",
    gist: "AgHWAQQAAwIAAAYE",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-25T11:00:00"),
    executions: 0,
    overridden: 0,
    coverage: 0,
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
    executions: 8934,
    overridden: 412,
    coverage: 100,
    avgLatency: 0.0011,
    lastExecTime: new Date("2026-04-03T13:05:00"),
  },
  // UPSERT INTO vehicle_location_histories — split coverage between two pins
  {
    statementFingerprint:
      "UPSERT INTO vehicle_location_histories VALUES ($1, $2, now(), $3, $4)",
    fingerprintID: "7442192024002430332",
    database: "movr",
    gist: "AgICCgUOMCLaAQAxBQQUBdgBAgQBKg==",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-03-24T08:45:00"),
    executions: 12378,
    overridden: 1856,
    coverage: 77,
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
    executions: 3710,
    overridden: 540,
    coverage: 23,
    avgLatency: 0.0012,
    lastExecTime: new Date("2026-04-02T22:10:00"),
  },
  // INSERT INTO user_promo_codes — pins are exhaustive but optimizer agrees
  // (Overridden = 0 means pin is redundant, not broken)
  {
    statementFingerprint:
      "INSERT INTO user_promo_codes VALUES ($1, $2, $3, now(), $4)",
    fingerprintID: "3939633309730011619",
    database: "movr",
    gist: "AiAC3gEB",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-20T15:20:00"),
    executions: 116,
    overridden: 0,
    coverage: 77,
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
    executions: 34,
    overridden: 0,
    coverage: 23,
    avgLatency: 0.0058,
    lastExecTime: new Date("2026-04-01T11:20:00"),
  },

  // SELECT * FROM users WHERE city = $1 AND id = $2 — hot lookup, healthy pin
  {
    statementFingerprint: "SELECT * FROM users WHERE (city = $1) AND (id = $2)",
    fingerprintID: "8211045892001823341",
    database: "movr",
    gist: "AgHuAQQAAwIAAAYG",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-12T16:20:00"),
    executions: 22841,
    overridden: 4112,
    coverage: 93,
    avgLatency: 0.0007,
    lastExecTime: new Date("2026-05-13T16:48:00"),
  },
  {
    statementFingerprint: "SELECT * FROM users WHERE (city = $1) AND (id = $2)",
    fingerprintID: "8211045892001823341",
    database: "movr",
    gist: "AgHuAQQAAwIAAAYH",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-04T11:00:00"),
    executions: 1661,
    overridden: 22,
    coverage: 7,
    avgLatency: 0.0011,
    lastExecTime: new Date("2026-05-13T16:30:00"),
  },

  // UPDATE users SET name — single pin, heavily overridden by optimizer (broken)
  {
    statementFingerprint: "UPDATE users SET name = $1 WHERE (city = $2) AND (id = $3)",
    fingerprintID: "1872834451029384720",
    database: "movr",
    gist: "BAEC3wEDAAQDAA==",
    pinnedBy: "dba_admin",
    pinnedAt: new Date("2026-02-28T10:30:00"),
    executions: 0,
    overridden: 0,
    coverage: 0,
    avgLatency: 0,
    lastExecTime: new Date("2026-03-02T09:00:00"),
  },

  // SELECT id, owner_id FROM vehicles ORDER BY id LIMIT — paged scan, partial coverage
  {
    statementFingerprint: "SELECT id, owner_id FROM vehicles WHERE city = $1 ORDER BY id LIMIT $2",
    fingerprintID: "6204918273645501982",
    database: "movr",
    gist: "AgHWAQQABwIAAAYK",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-04-30T14:10:00"),
    executions: 6204,
    overridden: 1841,
    coverage: 66,
    avgLatency: 0.0014,
    lastExecTime: new Date("2026-05-13T15:55:00"),
  },
  {
    statementFingerprint: "SELECT id, owner_id FROM vehicles WHERE city = $1 ORDER BY id LIMIT $2",
    fingerprintID: "6204918273645501982",
    database: "movr",
    gist: "AgHWAQQABwIAAAYL",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-04-22T09:00:00"),
    executions: 3217,
    overridden: 980,
    coverage: 34,
    avgLatency: 0.0017,
    lastExecTime: new Date("2026-05-13T15:48:00"),
  },

  // DELETE FROM rides — rare path, single healthy pin
  {
    statementFingerprint: "DELETE FROM rides WHERE (city = $1) AND (id = $2)",
    fingerprintID: "3091827364502938471",
    database: "movr",
    gist: "BgEC2AECAAQDAA==",
    pinnedBy: "migration_tool",
    pinnedAt: new Date("2026-05-09T08:00:00"),
    executions: 472,
    overridden: 472,
    coverage: 100,
    avgLatency: 0.0009,
    lastExecTime: new Date("2026-05-13T13:42:00"),
  },

  // UPSERT INTO rides — three plans across two cities
  {
    statementFingerprint: "UPSERT INTO rides VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)",
    fingerprintID: "5128374650192837465",
    database: "movr",
    gist: "AiAC2AECAQQDBA==",
    pinnedBy: "root",
    pinnedAt: new Date("2026-04-15T18:45:00"),
    executions: 18420,
    overridden: 2710,
    coverage: 56,
    avgLatency: 0.0012,
    lastExecTime: new Date("2026-05-13T16:50:00"),
  },
  {
    statementFingerprint: "UPSERT INTO rides VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)",
    fingerprintID: "5128374650192837465",
    database: "movr",
    gist: "AiAC2AECAQQDBQ==",
    pinnedBy: "root",
    pinnedAt: new Date("2026-04-15T18:46:00"),
    executions: 11288,
    overridden: 1612,
    coverage: 34,
    avgLatency: 0.0015,
    lastExecTime: new Date("2026-05-13T16:51:00"),
  },
  {
    statementFingerprint: "UPSERT INTO rides VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)",
    fingerprintID: "5128374650192837465",
    database: "movr",
    gist: "AiAC2AECAQQDBg==",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-29T12:00:00"),
    executions: 3400,
    overridden: 410,
    coverage: 10,
    avgLatency: 0.0019,
    lastExecTime: new Date("2026-05-13T16:38:00"),
  },

  // GROUP BY query — analyst pin, redundant (override 0)
  {
    statementFingerprint:
      "SELECT vehicle_city, vehicle_id, count(*) FROM rides WHERE end_time > $1 GROUP BY vehicle_city, vehicle_id",
    fingerprintID: "9182736450192837461",
    database: "movr",
    gist: "BgQA2AEDAQUEAg==",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-03-04T10:00:00"),
    executions: 880,
    overridden: 0,
    coverage: 100,
    avgLatency: 0.043,
    lastExecTime: new Date("2026-05-13T11:00:00"),
  },

  // INSERT INTO promo_codes — small write, healthy
  {
    statementFingerprint: "INSERT INTO promo_codes VALUES ($1, $2, $3, $4, $5)",
    fingerprintID: "7384650192837465019",
    database: "movr",
    gist: "AiAC4AEB",
    pinnedBy: "marketing_app",
    pinnedAt: new Date("2026-05-01T09:30:00"),
    executions: 215,
    overridden: 188,
    coverage: 100,
    avgLatency: 0.0021,
    lastExecTime: new Date("2026-05-13T16:32:00"),
  },

  // SELECT * FROM rides WHERE rider_id — hot read path, two pins splitting load
  {
    statementFingerprint:
      "SELECT * FROM rides WHERE rider_id = $1 ORDER BY start_time DESC LIMIT $2",
    fingerprintID: "4019283746501928374",
    database: "movr",
    gist: "AgEC2AEEAAcCAAYM",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-08T15:15:00"),
    executions: 4189,
    overridden: 998,
    coverage: 75,
    avgLatency: 0.0024,
    lastExecTime: new Date("2026-05-13T16:42:00"),
  },
  {
    statementFingerprint:
      "SELECT * FROM rides WHERE rider_id = $1 ORDER BY start_time DESC LIMIT $2",
    fingerprintID: "4019283746501928374",
    database: "movr",
    gist: "AgEC2AEEAAcCAAYN",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-08T15:16:00"),
    executions: 1421,
    overridden: 320,
    coverage: 25,
    avgLatency: 0.0026,
    lastExecTime: new Date("2026-05-13T16:35:00"),
  },

  // UPDATE vehicles SET status — single broken pin
  {
    statementFingerprint: "UPDATE vehicles SET status = $1 WHERE (city = $2) AND (id = $3)",
    fingerprintID: "6502938471650293847",
    database: "movr",
    gist: "BAECdgEEAAQDAA==",
    pinnedBy: "dba_admin",
    pinnedAt: new Date("2026-02-12T13:00:00"),
    executions: 0,
    overridden: 0,
    coverage: 0,
    avgLatency: 0,
    lastExecTime: new Date("2026-02-15T10:00:00"),
  },

  // SELECT count(*) FROM users — analyst, fully utilized
  {
    statementFingerprint: "SELECT count(*) FROM users WHERE city = $1",
    fingerprintID: "1029384756102938475",
    database: "movr",
    gist: "BgEC7gEDAQUEAg==",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-03-19T11:30:00"),
    executions: 2087,
    overridden: 1992,
    coverage: 100,
    avgLatency: 0.0034,
    lastExecTime: new Date("2026-05-13T14:18:00"),
  },

  // INSERT INTO users — split coverage
  {
    statementFingerprint:
      "INSERT INTO users (id, city, name, address, credit_card) VALUES ($1, $2, $3, $4, $5)",
    fingerprintID: "8475610293847561029",
    database: "movr",
    gist: "AiAC7gEFAAQE",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-04-02T08:45:00"),
    executions: 408,
    overridden: 102,
    coverage: 67,
    avgLatency: 0.0018,
    lastExecTime: new Date("2026-05-13T16:11:00"),
  },
  {
    statementFingerprint:
      "INSERT INTO users (id, city, name, address, credit_card) VALUES ($1, $2, $3, $4, $5)",
    fingerprintID: "8475610293847561029",
    database: "movr",
    gist: "AiAC7gEFAAQF",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-04-02T08:46:00"),
    executions: 204,
    overridden: 51,
    coverage: 33,
    avgLatency: 0.0022,
    lastExecTime: new Date("2026-05-13T15:48:00"),
  },

  // SELECT description FROM promo_codes — code lookup, very hot
  {
    statementFingerprint: "SELECT description FROM promo_codes WHERE code = $1",
    fingerprintID: "2938475610293847561",
    database: "movr",
    gist: "AgEC4AEDAAQCAA==",
    pinnedBy: "root",
    pinnedAt: new Date("2026-03-30T16:00:00"),
    executions: 11842,
    overridden: 8019,
    coverage: 98,
    avgLatency: 0.0006,
    lastExecTime: new Date("2026-05-13T16:52:00"),
  },

  // SELECT distinct city — admin query, redundant pin
  {
    statementFingerprint: "SELECT DISTINCT city FROM users",
    fingerprintID: "3847561029384756102",
    database: "movr",
    gist: "BgIC7gEAAQA=",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-02-22T14:00:00"),
    executions: 178,
    overridden: 0,
    coverage: 100,
    avgLatency: 0.0058,
    lastExecTime: new Date("2026-05-12T09:15:00"),
  },

  // SELECT * FROM vehicle_location_histories — partial coverage
  {
    statementFingerprint:
      "SELECT * FROM vehicle_location_histories WHERE (city = $1) AND (ride_id = $2)",
    fingerprintID: "5610293847561029384",
    database: "movr",
    gist: "AgEC2gEEAAQDAA==",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-25T17:30:00"),
    executions: 3201,
    overridden: 1100,
    coverage: 72,
    avgLatency: 0.0011,
    lastExecTime: new Date("2026-05-13T16:46:00"),
  },
  {
    statementFingerprint:
      "SELECT * FROM vehicle_location_histories WHERE (city = $1) AND (ride_id = $2)",
    fingerprintID: "5610293847561029384",
    database: "movr",
    gist: "AgEC2gEEAAQDAQ==",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-25T17:31:00"),
    executions: 1220,
    overridden: 380,
    coverage: 28,
    avgLatency: 0.0013,
    lastExecTime: new Date("2026-05-13T16:40:00"),
  },

  // SELECT name FROM users ORDER BY creation_time
  {
    statementFingerprint:
      "SELECT name FROM users WHERE city = $1 ORDER BY creation_time DESC LIMIT $2",
    fingerprintID: "9384756102938475610",
    database: "movr",
    gist: "AgEC7gEEAAcCAA==",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-04-19T09:00:00"),
    executions: 711,
    overridden: 64,
    coverage: 100,
    avgLatency: 0.0073,
    lastExecTime: new Date("2026-05-13T15:30:00"),
  },

  // SELECT vehicles WHERE status = available — split + redundant + broken
  {
    statementFingerprint:
      "SELECT id, owner_id, type FROM vehicles WHERE (city = $1) AND (status = $2) LIMIT $3",
    fingerprintID: "1561029384756102938",
    database: "movr",
    gist: "AgEC1gEEAAcCAAYO",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-05-04T10:30:00"),
    executions: 4181,
    overridden: 612,
    coverage: 67,
    avgLatency: 0.0015,
    lastExecTime: new Date("2026-05-13T16:49:00"),
  },
  {
    statementFingerprint:
      "SELECT id, owner_id, type FROM vehicles WHERE (city = $1) AND (status = $2) LIMIT $3",
    fingerprintID: "1561029384756102938",
    database: "movr",
    gist: "AgEC1gEEAAcCAAYP",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-04-28T10:30:00"),
    executions: 1422,
    overridden: 0,
    coverage: 23,
    avgLatency: 0.0017,
    lastExecTime: new Date("2026-05-13T16:31:00"),
  },
  {
    statementFingerprint:
      "SELECT id, owner_id, type FROM vehicles WHERE (city = $1) AND (status = $2) LIMIT $3",
    fingerprintID: "1561029384756102938",
    database: "movr",
    gist: "AgEC1gEEAAcCAAYQ",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-04-10T10:30:00"),
    executions: 600,
    overridden: 100,
    coverage: 10,
    avgLatency: 0.0021,
    lastExecTime: new Date("2026-05-13T15:11:00"),
  },

  // Aggregate revenue query — analyst, partial coverage with broken sibling
  {
    statementFingerprint:
      "SELECT sum(revenue) FROM rides WHERE (city = $1) AND (start_time > $2)",
    fingerprintID: "7102938475610293847",
    database: "movr",
    gist: "BgEC2AEEAQUEAA==",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-04-26T13:30:00"),
    executions: 1834,
    overridden: 1422,
    coverage: 100,
    avgLatency: 0.012,
    lastExecTime: new Date("2026-05-13T15:00:00"),
  },
  {
    statementFingerprint:
      "SELECT sum(revenue) FROM rides WHERE (city = $1) AND (start_time > $2)",
    fingerprintID: "7102938475610293847",
    database: "movr",
    gist: "BgEC2AEEAQUEAQ==",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-03-12T13:30:00"),
    executions: 0,
    overridden: 0,
    coverage: 0,
    avgLatency: 0,
    lastExecTime: new Date("2026-03-15T09:00:00"),
  },

  // INSERT INTO user_promo_codes — fresh pin, working
  {
    statementFingerprint:
      "INSERT INTO user_promo_codes (city, user_id, code, timestamp, usage_count) VALUES ($1, $2, $3, now(), $4)",
    fingerprintID: "4756102938475610293",
    database: "movr",
    gist: "AiAC3gECAQQ=",
    pinnedBy: "marketing_app",
    pinnedAt: new Date("2026-05-11T10:00:00"),
    executions: 92,
    overridden: 88,
    coverage: 100,
    avgLatency: 0.0019,
    lastExecTime: new Date("2026-05-13T16:05:00"),
  },

  // High-volume location lookup — split across 4 plans
  {
    statementFingerprint:
      "SELECT id FROM vehicle_location_histories WHERE (city = $1) AND (ride_id = $2) ORDER BY timestamp DESC LIMIT $3",
    fingerprintID: "6029384756102938475",
    database: "movr",
    gist: "AgEC2gEEAAcCAAYR",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-06T16:00:00"),
    executions: 28102,
    overridden: 4180,
    coverage: 55,
    avgLatency: 0.0008,
    lastExecTime: new Date("2026-05-13T16:52:00"),
  },
  {
    statementFingerprint:
      "SELECT id FROM vehicle_location_histories WHERE (city = $1) AND (ride_id = $2) ORDER BY timestamp DESC LIMIT $3",
    fingerprintID: "6029384756102938475",
    database: "movr",
    gist: "AgEC2gEEAAcCAAYS",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-04-06T16:01:00"),
    executions: 14201,
    overridden: 2104,
    coverage: 28,
    avgLatency: 0.0009,
    lastExecTime: new Date("2026-05-13T16:50:00"),
  },
  {
    statementFingerprint:
      "SELECT id FROM vehicle_location_histories WHERE (city = $1) AND (ride_id = $2) ORDER BY timestamp DESC LIMIT $3",
    fingerprintID: "6029384756102938475",
    database: "movr",
    gist: "AgEC2gEEAAcCAAYT",
    pinnedBy: "root",
    pinnedAt: new Date("2026-04-30T11:00:00"),
    executions: 6810,
    overridden: 1009,
    coverage: 13,
    avgLatency: 0.0011,
    lastExecTime: new Date("2026-05-13T16:48:00"),
  },
  {
    statementFingerprint:
      "SELECT id FROM vehicle_location_histories WHERE (city = $1) AND (ride_id = $2) ORDER BY timestamp DESC LIMIT $3",
    fingerprintID: "6029384756102938475",
    database: "movr",
    gist: "AgEC2gEEAAcCAAYU",
    pinnedBy: "root",
    pinnedAt: new Date("2026-04-30T11:01:00"),
    executions: 2171,
    overridden: 380,
    coverage: 4,
    avgLatency: 0.0012,
    lastExecTime: new Date("2026-05-13T16:30:00"),
  },

  // SELECT email FROM users — 3 plans across cities, healthy mix
  {
    statementFingerprint: "SELECT email FROM users WHERE (city = $1) AND (id = $2)",
    fingerprintID: "2837465019283746501",
    database: "movr",
    gist: "AgEC7gEEAAQDAAYV",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-05-08T11:00:00"),
    executions: 5403,
    overridden: 803,
    coverage: 68,
    avgLatency: 0.0009,
    lastExecTime: new Date("2026-05-13T16:50:00"),
  },
  {
    statementFingerprint: "SELECT email FROM users WHERE (city = $1) AND (id = $2)",
    fingerprintID: "2837465019283746501",
    database: "movr",
    gist: "AgEC7gEEAAQDAAYW",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-04-21T11:00:00"),
    executions: 1980,
    overridden: 220,
    coverage: 25,
    avgLatency: 0.0011,
    lastExecTime: new Date("2026-05-13T16:42:00"),
  },
  {
    statementFingerprint: "SELECT email FROM users WHERE (city = $1) AND (id = $2)",
    fingerprintID: "2837465019283746501",
    database: "movr",
    gist: "AgEC7gEEAAQDAAYX",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-03-30T11:00:00"),
    executions: 508,
    overridden: 60,
    coverage: 7,
    avgLatency: 0.0013,
    lastExecTime: new Date("2026-05-13T16:21:00"),
  },

  // UPDATE rides SET end_time — small but hot path
  {
    statementFingerprint: "UPDATE rides SET end_time = $1 WHERE (city = $2) AND (id = $3)",
    fingerprintID: "9203847561029384756",
    database: "movr",
    gist: "BAEC2AEEAAQDBA==",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-05-02T15:00:00"),
    executions: 1102,
    overridden: 988,
    coverage: 100,
    avgLatency: 0.0014,
    lastExecTime: new Date("2026-05-13T16:50:00"),
  },

  // SELECT count(*) FROM rides — analyst, partial coverage + broken
  {
    statementFingerprint: "SELECT count(*) FROM rides WHERE rider_id = $1",
    fingerprintID: "4029384756102938475",
    database: "movr",
    gist: "BgEC2AEEAQUEAg==",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-04-14T10:30:00"),
    executions: 5210,
    overridden: 1300,
    coverage: 62,
    avgLatency: 0.0048,
    lastExecTime: new Date("2026-05-13T16:33:00"),
  },
  {
    statementFingerprint: "SELECT count(*) FROM rides WHERE rider_id = $1",
    fingerprintID: "4029384756102938475",
    database: "movr",
    gist: "BgEC2AEEAQUEAw==",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-03-09T10:30:00"),
    executions: 0,
    overridden: 0,
    coverage: 0,
    avgLatency: 0,
    lastExecTime: new Date("2026-03-12T09:00:00"),
  },

  // INSERT INTO vehicles — onboarding flow
  {
    statementFingerprint:
      "INSERT INTO vehicles (id, city, type, owner_id, status) VALUES ($1, $2, $3, $4, $5)",
    fingerprintID: "8102938475610293847",
    database: "movr",
    gist: "AiAC1gEFAAQE",
    pinnedBy: "app_user",
    pinnedAt: new Date("2026-05-06T13:00:00"),
    executions: 502,
    overridden: 480,
    coverage: 100,
    avgLatency: 0.0023,
    lastExecTime: new Date("2026-05-13T15:55:00"),
  },

  // SELECT id, code FROM promo_codes — 2 pins, both heavily used
  {
    statementFingerprint:
      "SELECT id, code FROM promo_codes WHERE creation_time > $1 LIMIT $2",
    fingerprintID: "5293847561029384756",
    database: "movr",
    gist: "AgEC4AEEAAcCAAYY",
    pinnedBy: "marketing_app",
    pinnedAt: new Date("2026-04-17T09:30:00"),
    executions: 9842,
    overridden: 1502,
    coverage: 66,
    avgLatency: 0.0011,
    lastExecTime: new Date("2026-05-13T16:48:00"),
  },
  {
    statementFingerprint:
      "SELECT id, code FROM promo_codes WHERE creation_time > $1 LIMIT $2",
    fingerprintID: "5293847561029384756",
    database: "movr",
    gist: "AgEC4AEEAAcCAAYZ",
    pinnedBy: "marketing_app",
    pinnedAt: new Date("2026-04-17T09:31:00"),
    executions: 5140,
    overridden: 798,
    coverage: 34,
    avgLatency: 0.0013,
    lastExecTime: new Date("2026-05-13T16:36:00"),
  },

  // DELETE FROM user_promo_codes — cleanup task, broken pin
  {
    statementFingerprint:
      "DELETE FROM user_promo_codes WHERE (city = $1) AND (user_id = $2) AND (code = $3)",
    fingerprintID: "6840291837465019283",
    database: "movr",
    gist: "BgEC3gEEAAQDAA==",
    pinnedBy: "migration_tool",
    pinnedAt: new Date("2026-02-04T08:00:00"),
    executions: 0,
    overridden: 0,
    coverage: 0,
    avgLatency: 0,
    lastExecTime: new Date("2026-02-07T15:00:00"),
  },

  // SELECT max(timestamp) — telemetry query
  {
    statementFingerprint:
      "SELECT max(timestamp) FROM vehicle_location_histories WHERE (city = $1) AND (ride_id = $2)",
    fingerprintID: "7561029384756102938",
    database: "movr",
    gist: "BgEC2gEEAQUEAg==",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-05-10T16:00:00"),
    executions: 920,
    overridden: 510,
    coverage: 100,
    avgLatency: 0.0009,
    lastExecTime: new Date("2026-05-13T16:51:00"),
  },

  // SELECT id FROM users LIMIT/OFFSET — paged scan, partial
  {
    statementFingerprint: "SELECT id FROM users WHERE city = $1 LIMIT $2 OFFSET $3",
    fingerprintID: "3650192837465019283",
    database: "movr",
    gist: "AgEC7gEEAAcCAAYa",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-04-09T14:30:00"),
    executions: 308,
    overridden: 92,
    coverage: 75,
    avgLatency: 0.0029,
    lastExecTime: new Date("2026-05-13T14:18:00"),
  },
  {
    statementFingerprint: "SELECT id FROM users WHERE city = $1 LIMIT $2 OFFSET $3",
    fingerprintID: "3650192837465019283",
    database: "movr",
    gist: "AgEC7gEEAAcCAAYb",
    pinnedBy: "analyst",
    pinnedAt: new Date("2026-04-09T14:31:00"),
    executions: 102,
    overridden: 28,
    coverage: 25,
    avgLatency: 0.0033,
    lastExecTime: new Date("2026-05-13T13:55:00"),
  },

  // SELECT * FROM vehicles WHERE id — primary key lookup, 3 plans
  {
    statementFingerprint: "SELECT * FROM vehicles WHERE id = $1",
    fingerprintID: "4109283746501928374",
    database: "movr",
    gist: "AgEC1gEDAAQCAAYc",
    pinnedBy: "root",
    pinnedAt: new Date("2026-04-25T11:00:00"),
    executions: 18241,
    overridden: 2810,
    coverage: 67,
    avgLatency: 0.0006,
    lastExecTime: new Date("2026-05-13T16:52:00"),
  },
  {
    statementFingerprint: "SELECT * FROM vehicles WHERE id = $1",
    fingerprintID: "4109283746501928374",
    database: "movr",
    gist: "AgEC1gEDAAQCAAYd",
    pinnedBy: "root",
    pinnedAt: new Date("2026-04-25T11:01:00"),
    executions: 6840,
    overridden: 1020,
    coverage: 25,
    avgLatency: 0.0007,
    lastExecTime: new Date("2026-05-13T16:50:00"),
  },
  {
    statementFingerprint: "SELECT * FROM vehicles WHERE id = $1",
    fingerprintID: "4109283746501928374",
    database: "movr",
    gist: "AgEC1gEDAAQCAAYe",
    pinnedBy: "sre_oncall",
    pinnedAt: new Date("2026-05-03T11:00:00"),
    executions: 2259,
    overridden: 312,
    coverage: 8,
    avgLatency: 0.0008,
    lastExecTime: new Date("2026-05-13T16:38:00"),
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

// Compact integer formatter. Keeps small counts readable with commas, then
// switches to k/M abbreviations once values get long enough to bloat the
// "Pin applied" / "Override rate" cells (e.g. 16,088 \u2192 "16k").
function abbrev(n: number): string {
  if (n < 10000) return n.toLocaleString();
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  if (n < 10000000) return `${(n / 1000000).toFixed(1)}M`;
  return `${Math.round(n / 1000000)}M`;
}

function PlanPinBadge(): React.ReactElement {
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
        backgroundColor: "#e1ecff",
        color: "#0037a5",
      }}
    >
      Pinned
    </span>
  );
}

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
        borderBottom: tooltip ? "1px dashed #475872" : undefined,
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
  const [overviewSort, setOverviewSort] = useState<SortConfig | null>({
    column: "pinnedAt",
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

  // Sort wrapper for the overview table that also resets pagination to page 1
  // so the user always lands on the first page after re-sorting.
  const setOverviewSortAndResetPage: React.Dispatch<React.SetStateAction<SortConfig | null>> = (s) => {
    setOverviewSort(s);
    setOverviewPage(1);
  };

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
    color: visibleActiveTab === tab ? "#0037a5" : "#475872",
    backgroundColor: visibleActiveTab === tab ? "#e1ecff" : "transparent",
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
      <style>{`
        .pp-link { color: #394455; text-decoration: none; }
        .pp-link:hover { color: #0055ff; text-decoration: underline; }
        .pp-link-mono { font-family: RobotoMono-Medium, Roboto Mono, monospace; font-size: 12px; color: #242A35; white-space: nowrap; text-decoration: none; display: block; max-width: 250px; overflow: hidden; text-overflow: ellipsis; }
        .pp-link-mono:hover { color: #0055ff; text-decoration: underline; }
        /* Vertically center the antd page-size selector with the page buttons. */
        .pp-pager .ant-pagination { display: inline-flex; align-items: center; }
        .pp-pager .ant-pagination-options { margin-left: 8px; }
        .pp-pager .ant-pagination-options-size-changer.ant-select { vertical-align: middle; margin-top: 0; }
        .pp-pill-tab:hover { background-color: #f0f2f5; }
      `}</style>

      {/* Tabs */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "6px", alignItems: "center" }}>
        {([
          { key: "overview" as TabType, label: "All pinned plans" },
          { key: "drift" as TabType, label: "Drift analysis", badge: mockDriftAlerts.length > 0 ? mockDriftAlerts.length : undefined },
          { key: "audit" as TabType, label: "Audit log" },
        ]).filter(tab => tabKeys.includes(tab.key)).map(tab => (
          <button key={tab.key} style={tabBtnStyle(tab.key)} className={visibleActiveTab !== tab.key ? "pp-pill-tab" : ""} onClick={() => setActiveTab(tab.key)}>
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
                  style={{ color: "#0055ff" }}
                >
                  Retry
                </a>
              </span>
            }
          />
        </div>
      )}
      {visibleActiveTab === "overview" && !loadFailed && (() => {
        const sorted = sortData(mockPinnedPlans, overviewSort, {
          statement: p => p.statementFingerprint,
          gist: p => p.gist,
          pinnedBy: p => p.pinnedBy,
          pinnedAt: p => p.pinnedAt.getTime(),
          coverage: p => p.coverage,
          // Sort by override rate (overridden / executions). Rows with no
          // executions sort to the bottom in either direction by returning
          // -1 — the rate is undefined for them.
          overrideRate: p => (p.executions > 0 ? p.overridden / p.executions : -1),
          avgLatency: p => p.avgLatency,
          lastExecTime: p => p.lastExecTime.getTime(),
        });
        const total = sorted.length;
        const totalPages = Math.max(1, Math.ceil(total / overviewPageSize));
        const page = Math.min(Math.max(1, overviewPage), totalPages);
        const start = (page - 1) * overviewPageSize;
        const end = Math.min(start + overviewPageSize, total);
        const slice = sorted.slice(start, end);
        return (
        <div style={{ overflowX: "auto" }}>
        <div style={{ fontSize: "14px", color: "#475872", marginBottom: "12px", fontFamily }}>
          <ResultsPerPageLabel
            pagination={{ pageSize: overviewPageSize, current: page, total }}
            pageName="pinned plans"
          />
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, paddingLeft: "24px" }}>Plan pin status</th>
              <SortableHeader label="Plan gist" column="gist" sortConfig={overviewSort} onSort={handleSort(setOverviewSortAndResetPage)} />
              <SortableHeader label="Statement" column="statement" sortConfig={overviewSort} onSort={handleSort(setOverviewSortAndResetPage)} />
              <SortableHeader
                label="Pin applied rate"
                column="coverage"
                sortConfig={overviewSort}
                onSort={handleSort(setOverviewSortAndResetPage)}
                tooltip={
                  <span style={{ fontWeight: 400 }}>
                    Percentage of fingerprint executions where the optimizer used this pinned plan. 0% means the pin isn't sticking. The optimizer is choosing a different plan every time.
                  </span>
                }
              />
              <SortableHeader
                label="Pin override rate"
                column="overrideRate"
                sortConfig={overviewSort}
                onSort={handleSort(setOverviewSortAndResetPage)}
                tooltip={
                  <span style={{ fontWeight: 400 }}>
                    Percentage of pinned-plan executions where the pin overrode the optimizer's choice. Higher means the pin is actively protecting against drift. 0% means the optimizer would have picked this plan anyway (the pin is redundant).
                  </span>
                }
              />
              <SortableHeader label="Avg latency" column="avgLatency" sortConfig={overviewSort} onSort={handleSort(setOverviewSortAndResetPage)} style={{ textAlign: "right" }} />
              <SortableHeader label="Pinned by" column="pinnedBy" sortConfig={overviewSort} onSort={handleSort(setOverviewSortAndResetPage)} />
              <SortableHeader label="Pinned at" column="pinnedAt" sortConfig={overviewSort} onSort={handleSort(setOverviewSortAndResetPage)} />
              <SortableHeader label="Last executed" column="lastExecTime" sortConfig={overviewSort} onSort={handleSort(setOverviewSortAndResetPage)} style={{ textAlign: "right" }} />
            </tr>
          </thead>
          <tbody>
            {slice.map((plan, i) => (
              <tr key={i} style={rowStyle}>
                <td style={tdFirstStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {(() => {
                      const isUnpinned = unpinnedOverview.has(plan.gist);
                      return (
                        <PinPermissionGate noPermission={noPermission}>
                          <button
                            onClick={() => {
                              if (noPermission) return;
                              showPinModal(isUnpinned ? "pin" : "unpin", plan.gist, "overview");
                            }}
                            disabled={noPermission}
                            title={noPermission ? undefined : (isUnpinned ? "Pin" : "Unpin")}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "6px",
                              border: `1px solid ${noPermission ? "#e7eaf2" : "#c0c6d9"}`,
                              borderRadius: "4px",
                              backgroundColor: noPermission ? "#f6f7f9" : "white",
                              color: noPermission
                                ? "#c0c6d9"
                                : (isUnpinned ? "#394455" : "#0055ff"),
                              cursor: noPermission ? "not-allowed" : "pointer",
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 17v5" />
                              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" fill={isUnpinned || noPermission ? "none" : "currentColor"} />
                            </svg>
                          </button>
                        </PinPermissionGate>
                      );
                    })()}
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
                      <PlanPinBadge />
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
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {(() => {
                    const total = mockTotalExecutions[plan.fingerprintID] ?? plan.executions;
                    const inner = (
                      <>
                        <span style={{ fontWeight: 600 }}>{plan.coverage}%</span>
                        <span style={{ color: plan.coverage === 0 ? "#cd2939" : "#7e89a9" }}>
                          {" "}({abbrev(plan.executions)} of {abbrev(total)})
                        </span>
                      </>
                    );
                    // 0% cells render the content as a red pill badge (rather
                    // than washing the whole cell red). The dashed underline
                    // sits on the text inside the badge as a tooltip cue.
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
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "3px",
                              backgroundColor: "#ffe9eb",
                              color: "#cd2939",
                              cursor: "help",
                            }}
                          >
                            <span style={{ borderBottom: "1px dashed #cd2939" }}>
                              {inner}
                            </span>
                          </span>
                        </Tooltip>
                      );
                    }
                    return inner;
                  })()}
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#394455" }}>
                  {plan.executions === 0 ? (
                    <span style={{ color: "#c0c6d9" }}>—</span>
                  ) : (
                    (() => {
                      const rate = Math.round((plan.overridden / plan.executions) * 100);
                      return (
                        <>
                          <span style={{ fontWeight: 600 }}>{rate}%</span>
                          <span style={{ color: "#7e89a9" }}>
                            {" "}({abbrev(plan.overridden)} of {abbrev(plan.executions)})
                          </span>
                        </>
                      );
                    })()
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{formatDuration(plan.avgLatency)}</td>
                <td style={tdStyle}>{plan.pinnedBy}</td>
                <td style={tdStyle}>
                  {plan.pinnedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {plan.lastExecTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                  {plan.lastExecTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pp-pager">
          <Pagination
            pageSize={overviewPageSize}
            current={page}
            total={total}
            onChange={(current, pageSize) => {
              setOverviewPage(current);
              if (pageSize) setOverviewPageSize(pageSize);
            }}
            onShowSizeChange={(current, pageSize) => {
              setOverviewPage(current);
              setOverviewPageSize(pageSize);
            }}
          />
        </div>
        </div>
        );
      })()}

      {/* === Drift Analysis === (gated: out of scope for v1, see DRIFT_ENABLED) */}
      {DRIFT_ENABLED && activeTab === "drift" && (
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
                        backgroundColor: drift.assessment === "potential-improvement" ? "#e3f5e0" : "#ffe9eb",
                        color: drift.assessment === "potential-improvement" ? "#237300" : "#cd2939",
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
                            border: `1px solid ${noPermission ? "#e7eaf2" : "#c0c6d9"}`,
                            borderRadius: "4px",
                            backgroundColor: noPermission ? "#f6f7f9" : "white",
                            color: noPermission
                              ? "#c0c6d9"
                              : (unpinnedDrift.has(drift.pinnedGist) ? "#394455" : "#0055ff"),
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
                            backgroundColor: "#f0f2f5",
                            color: "#475872",
                          }}
                        >
                          Unpinned
                        </span>
                      ) : (
                        <PlanPinBadge />
                      )}
                      <Link to={`/statement/${encodeURIComponent(drift.fingerprintID)}?tab=explain-plan&appNames=movr&from=pinned-plans`} className="pp-link">
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
                            border: `1px solid ${noPermission ? "#e7eaf2" : "#c0c6d9"}`,
                            borderRadius: "4px",
                            backgroundColor: noPermission ? "#f6f7f9" : "white",
                            color: noPermission
                              ? "#c0c6d9"
                              : (pinnedCandidates.has(drift.candidateGist) ? "#0055ff" : "#394455"),
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
      {visibleActiveTab === "audit" && (
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
