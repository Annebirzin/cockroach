// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import React, { useCallback, useState } from "react";

import { Modal } from "../modal";

export type PinAction = "pin" | "unpin";

interface PinPlanModalState {
  visible: boolean;
  action: PinAction;
  gist: string;
  onConfirm: () => void;
}

const INITIAL_STATE: PinPlanModalState = {
  visible: false,
  action: "pin",
  gist: "",
  onConfirm: () => undefined,
};

export interface UsePinPlanModalResult {
  state: PinPlanModalState;
  requestPin: (gist: string, onConfirm: () => void) => void;
  requestUnpin: (gist: string, onConfirm: () => void) => void;
  handleConfirm: () => void;
  handleCancel: () => void;
}

// Shared confirmation flow for pinning / unpinning a plan. Any surface that
// has a pin or unpin button should route its click through this hook so users
// always see the same confirmation copy and side-effects fire only on confirm.
export function usePinPlanModal(): UsePinPlanModalResult {
  const [state, setState] = useState<PinPlanModalState>(INITIAL_STATE);

  const requestPin = useCallback((gist: string, onConfirm: () => void) => {
    setState({ visible: true, action: "pin", gist, onConfirm });
  }, []);

  const requestUnpin = useCallback((gist: string, onConfirm: () => void) => {
    setState({ visible: true, action: "unpin", gist, onConfirm });
  }, []);

  const handleConfirm = useCallback(() => {
    state.onConfirm();
    setState(prev => ({ ...prev, visible: false }));
  }, [state]);

  const handleCancel = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
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
  return (
    <>
      <style>{`
        .pp-pin-modal .crdb-ant-modal-close { top: 16px; right: 16px; }
        .pp-pin-modal .crdb-ant-modal-close-x { width: 40px; height: 40px; line-height: 40px; }
        .pp-pin-modal .crdb-ant-modal-header { display: flex; align-items: center; }
        .pp-pin-modal .crdb-ant-modal-header h3 { font-weight: 600; }
      `}</style>
      <Modal
        visible={state.visible}
        onOk={onConfirm}
        onCancel={onCancel}
        okText={state.action === "pin" ? "Pin plan" : "Unpin plan"}
        cancelText="Cancel"
        title={state.action === "pin" ? "Pin this plan" : "Unpin this plan"}
        className="pp-pin-modal"
      >
        <p style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: "#394455" }}>
          {state.action === "pin"
            ? "Pinning a plan forces the optimizer to use this specific execution plan for the statement. Other potentially better plans will be ignored until this pin is removed."
            : "Unpinning this plan allows the optimizer to choose the best execution plan automatically. If the optimizer selects a worse plan, you may see a performance regression."}
        </p>
      </Modal>
    </>
  );
}
