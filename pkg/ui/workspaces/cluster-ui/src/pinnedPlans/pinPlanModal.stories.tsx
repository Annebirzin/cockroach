// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { storiesOf } from "@storybook/react";
import React from "react";

import { PinPlanModal } from "./pinPlanModal";
import { PinAction } from "./pinTypes";

// Stories cover the four user-visible states an FE eng / designer might
// want to eyeball without standing up the full app:
//
//   1. Pin — base       (Pin this plan, normal CTA "Pin plan")
//   2. Pin — error      (Pin this plan + InlineAlert + CTA "Try pinning again")
//   3. Unpin — base     (Unpin this plan, normal CTA "Unpin plan")
//   4. Unpin — error    (Unpin this plan + InlineAlert + CTA "Try unpinning again")
//
// In production the modal is opened via usePinPlanModal(); here we hand-
// construct the state prop directly so each story renders in isolation.

const SAMPLE_GIST = "AiAC3gECAQQ=";

function makeState(action: PinAction, error: string | null = null) {
  return {
    visible: true,
    action,
    gist: SAMPLE_GIST,
    onConfirm: () => undefined,
    error,
  };
}

const noop = () => {
  /* story interactions are not wired */
};

storiesOf("PinPlanModal", module)
  .add("Pin — base", () => (
    <PinPlanModal state={makeState("pin")} onConfirm={noop} onCancel={noop} />
  ))
  .add("Pin — inline error", () => (
    <PinPlanModal
      state={makeState(
        "pin",
        `Couldn't pin plan ${SAMPLE_GIST}. The plan is no longer valid (an index it references was dropped).`,
      )}
      onConfirm={noop}
      onCancel={noop}
    />
  ))
  .add("Unpin — base", () => (
    <PinPlanModal state={makeState("unpin")} onConfirm={noop} onCancel={noop} />
  ))
  .add("Unpin — inline error", () => (
    <PinPlanModal
      state={makeState(
        "unpin",
        `Couldn't unpin plan ${SAMPLE_GIST}. The optimizer hint store is unreachable. Try again in a moment.`,
      )}
      onConfirm={noop}
      onCancel={noop}
    />
  ));
