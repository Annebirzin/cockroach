// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { message } from "antd";

import { PinAction, PinDemoState } from "./pinTypes";

// Wraps a base apply function with the standard toast + modal-error
// behavior. Surfaces call this from inside their PinPlanModal onConfirm
// callback so every pin/unpin attempt produces consistent user-visible
// feedback regardless of which surface initiated it.
//
// Returns a string when the operation fails in a way the user should see
// inside the modal; the shared modal then keeps itself open and surfaces
// the message via InlineAlert. Returns void on success / silent failure.
//
// Production wiring: replace `demoState` with the equivalent fail-state
// derived from the API response, and replace the toast copy with
// localized strings if/when DB Console adopts i18n.
export function runPinAction(
  action: PinAction,
  gist: string,
  apply: () => void,
  demoState: PinDemoState,
): string | void {
  if (demoState === "fail-modal") {
    return action === "pin"
      ? `Couldn't pin plan ${gist}. The plan is no longer valid (an index it references was dropped).`
      : `Couldn't unpin plan ${gist}. The optimizer hint store is unreachable. Try again in a moment.`;
  }
  if (demoState === "fail-action") {
    message.error(
      action === "pin"
        ? `Couldn't pin plan ${gist}. Try again or check permissions.`
        : `Couldn't unpin plan ${gist}. Try again or check permissions.`,
    );
    return;
  }
  apply();
  message.success(action === "pin" ? "Plan pinned." : "Plan unpinned.");
}
