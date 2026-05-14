// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { Tooltip } from "@cockroachlabs/ui-components";
import React from "react";

// Wraps a pin/unpin button so users without the MANAGEPLAN privilege see a
// disabled control with an explanatory Tooltip instead of a clickable
// button. Surfaces remain responsible for rendering the disabled visual
// state on the button itself; this component only adds the tooltip wrapper.
//
// Used by every pin/unpin surface (All Pinned Plans table, Drift Analysis,
// Explain Plan table, Plan Detail header). Production swaps the hardcoded
// MANAGEPLAN copy for the actual privilege name once the backend defines it.
export function PinPermissionGate({
  noPermission,
  children,
}: {
  noPermission: boolean;
  children: React.ReactElement;
}): React.ReactElement {
  if (!noPermission) return children;
  return (
    <Tooltip
      placement="right"
      content={
        <span style={{ fontWeight: 400 }}>
          You need the MANAGEPLAN system privilege to pin or unpin plans.
          Contact your cluster admin.
        </span>
      }
    >
      {children}
    </Tooltip>
  );
}
