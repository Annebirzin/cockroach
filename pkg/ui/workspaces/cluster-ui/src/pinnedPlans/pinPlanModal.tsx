// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

import { InlineAlert, Tooltip } from "@cockroachlabs/ui-components";
import { message } from "antd";
import React, { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";

import { Modal } from "../modal";

export type PinAction = "pin" | "unpin";

// onConfirm may return a string to signal failure; the modal then shows an
// inline error and stays open so the user can retry. Returning void/undefined
// (the original signature) keeps existing call sites working unchanged — the
// modal closes on success.
export type PinConfirmCallback = () => string | void | Promise<string | void>;

// =====================================================================
// Shared error-state helpers
// =====================================================================
// All pin/unpin surfaces share the same four error patterns (toast,
// modal-level retry, list-load failure, permission-denied). The helpers
// below let every surface pick them up identically. The demo URL flag
// is the prototype trigger; in production these are driven by API state.
// =====================================================================

export type PinDemoState =
  | "ok"
  | "fail-action"
  | "fail-modal"
  | "fail-load"
  | "no-permission";

// Reads ?demoState=… from the URL. Returns "ok" when absent or unknown.
// Production code should replace this with state derived from API responses
// and user privilege checks.
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

// Wraps a base apply function with the standard toast + modal-error
// behavior. Surfaces call this from inside their onConfirm callback so
// every pin/unpin attempt produces consistent user-visible feedback.
//
// Returns a string when the operation fails in a way the user should see
// inside the modal; the shared modal then keeps itself open and surfaces
// the message via InlineAlert. Returns void on success / silent failure.
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

// Wraps a pin/unpin button so users without the MANAGEPLAN privilege see a
// disabled control with an explanatory Tooltip instead of a clickable
// button. Surfaces remain responsible for rendering the disabled visual
// state on the button itself; this component only adds the tooltip wrapper.
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
        okText={hasError
          ? (state.action === "pin" ? "Try pinning again" : "Try unpinning again")
          : (state.action === "pin" ? "Pin plan" : "Unpin plan")}
        cancelText="Cancel"
        title={state.action === "pin" ? "Pin this plan" : "Unpin this plan"}
        className="pp-pin-modal"
      >
        <p style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: "#394455" }}>
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
    </>
  );
}
