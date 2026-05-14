// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

// Mock fixtures for the Plan Pinning prototype.
//
// In production these go away — the page reads pinned plan data from
// /api/v2/pinned_plans and audit log entries from a similar endpoint.
// Type definitions live in pinnedPlans.types.ts (the BE↔FE contract).

import { AuditLogEntry, DriftAlert, PinnedPlan } from "./pinnedPlans.types";

// Re-export for convenience so existing imports `from "./pinnedPlans.fixture"`
// don't break. New code should import types from `./pinnedPlans.types` directly.
export { AuditLogEntry, DriftAlert, PinnedPlan };

// Total executions per statement fingerprint. Used to render the
// "Pin applied" cell as `% (X of Y)` where Y is the fingerprint total.
// All pinned plans for a fingerprint share the same Y.
export const mockTotalExecutions: Record<string, number> = {
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
export const mockPinnedPlans: PinnedPlan[] = [
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

export const mockDriftAlerts: DriftAlert[] = [
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

export const mockAuditLog: AuditLogEntry[] = [
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
