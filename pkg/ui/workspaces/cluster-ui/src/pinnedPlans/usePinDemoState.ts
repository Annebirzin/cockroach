// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { useLocation } from "react-router-dom";

import { PinDemoState } from "./pinTypes";

// Reads ?demoState=… from the URL. Returns "ok" when absent or unknown.
//
// Production code should replace this with state derived from API responses
// and user privilege checks (probably a small Redux selector or a SWR hook
// that combines the privilege check with the most recent action's response).
export function usePinDemoState(): PinDemoState {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const v = params.get("demoState");
  if (
    v === "fail-action" ||
    v === "fail-modal" ||
    v === "fail-load" ||
    v === "no-permission"
  ) {
    return v;
  }
  return "ok";
}
