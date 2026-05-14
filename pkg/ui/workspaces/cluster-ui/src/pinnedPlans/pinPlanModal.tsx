// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { InlineAlert } from "@cockroachlabs/ui-components";
import classNames from "classnames/bind";
import React, { useCallback, useState } from "react";

import { Modal } from "../modal";

import styles from "./pinPlanModal.module.scss";
import { tokens } from "./pinnedPlans.tokens";
import { PinAction, PinConfirmCallback } from "./pinTypes";

const cx = classNames.bind(styles);

interface PinPlanModalState {
  visible: boolean;
  action: PinAction;
  gist: string;
  onConfirm: PinConfirmCallback;
  error: string | null;
}

const INITIAL_STATE: PinPlanModalState = {
  visible: false,
  action: "pin",
  gist: "",
  onConfirm: () => undefined,
  error: null,
};

export interface UsePinPlanModalResult {
  state: PinPlanModalState;
  requestPin: (gist: string, onConfirm: PinConfirmCallback) => void;
  requestUnpin: (gist: string, onConfirm: PinConfirmCallback) => void;
  handleConfirm: () => void;
  handleCancel: () => void;
}

// Shared confirmation flow for pinning / unpinning a plan. Any surface that
// has a pin or unpin button should route its click through this hook so users
// always see the same confirmation copy and side-effects fire only on confirm.
export function usePinPlanModal(): UsePinPlanModalResult {
  const [state, setState] = useState<PinPlanModalState>(INITIAL_STATE);

  const requestPin = useCallback((gist: string, onConfirm: PinConfirmCallback) => {
    setState({ visible: true, action: "pin", gist, onConfirm, error: null });
  }, []);

  const requestUnpin = useCallback((gist: string, onConfirm: PinConfirmCallback) => {
    setState({ visible: true, action: "unpin", gist, onConfirm, error: null });
  }, []);

  const handleConfirm = useCallback(() => {
    const result = state.onConfirm();
    // Resolve sync and async failure paths to a unified shape.
    Promise.resolve(result).then(maybeError => {
      if (typeof maybeError === "string" && maybeError.length > 0) {
        // Failure: keep modal open, show inline alert.
        setState(prev => ({ ...prev, error: maybeError }));
      } else {
        // Success: close modal.
        setState(prev => ({ ...prev, visible: false, error: null }));
      }
    });
  }, [state]);

  const handleCancel = useCallback(() => {
    setState(prev => ({ ...prev, visible: false, error: null }));
  }, []);

  return { state, requestPin, requestUnpin, handleConfirm, handleCancel };
}

interface PinPlanModalProps {
  state: PinPlanModalState;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PinPlanModal({
  state,
  onConfirm,
  onCancel,
}: PinPlanModalProps): React.ReactElement {
  const hasError = !!state.error;
  return (
    <Modal
      visible={state.visible}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={hasError
        ? (state.action === "pin" ? "Try pinning again" : "Try unpinning again")
        : (state.action === "pin" ? "Pin plan" : "Unpin plan")}
      cancelText="Cancel"
      title={state.action === "pin" ? "Pin this plan" : "Unpin this plan"}
      className={cx("pp-pin-modal")}
    >
        <p style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: tokens.neutral7 }}>
          {state.action === "pin"
            ? "Pinning a plan forces the optimizer to use this specific execution plan for the statement. Other potentially better plans will be ignored until this pin is removed."
            : "Unpinning this plan allows the optimizer to choose the best execution plan automatically. If the optimizer selects a worse plan, you may see a performance regression."}
        </p>
        {hasError && (
          <div style={{ marginTop: "16px" }}>
            <InlineAlert intent="danger" title={state.error} />
          </div>
        )}
    </Modal>
  );
}
