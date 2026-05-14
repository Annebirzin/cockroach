// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

// Shared types for the pin/unpin flow. Kept in a small dedicated file so
// hooks, helpers, and components can share them without circular imports.

export type PinAction = "pin" | "unpin";

// onConfirm may return a string to signal failure; the modal then shows an
// inline error and stays open so the user can retry. Returning void/undefined
// keeps existing call sites working unchanged — the modal closes on success.
export type PinConfirmCallback = () => string | void | Promise<string | void>;

// Demo-only state machine for the prototype. Production replaces this with
// state derived from API responses + privilege checks.
export type PinDemoState =
  | "ok"
  | "fail-action"
  | "fail-modal"
  | "fail-load"
  | "no-permission";
