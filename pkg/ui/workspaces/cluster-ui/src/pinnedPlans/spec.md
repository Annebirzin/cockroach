# Plan Pinning — DB Console Engineering Specification

**Overview:** Plan pinning allows SREs and DBAs to lock execution plans for critical queries, preventing optimizer regressions. This spec documents the DB Console UI surfaces prototyped for managing, monitoring, and analyzing pinned plans — covering the Pinned Plans tab under SQL Activity, plan pin status on statement tables and detail pages, drift analysis, and audit logging.

| | |
|---|---|
| **Outcome Brief** | [Plan Pinning](https://docs.google.com/document/d/1WlRl5wwYEeTpqjy1qljpViR5Gvr4cZPLdJl11DFY1dQ/edit) |
| **Figma** | [Plan Pinning Figma Screens](https://www.figma.com/design/xVVNu8htiiw2KWuGnMiPnA/) |
| **Prototype Branch** | [`anne/plan-pinning-prototype`](https://github.com/Annebirzin/cockroach/tree/anne/plan-pinning-prototype) |
| **Source Code** | `pkg/ui/workspaces/cluster-ui/src/pinnedPlans/` |
| **Target Location** | `pkg/ui/workspaces/cluster-ui/src/` (cluster-ui) + `pkg/ui/workspaces/db-console/src/views/sqlActivity/` |
| **Date** | 2026-04-22 (updated) |

### Running the Prototype

```bash
git fetch origin anne/plan-pinning-prototype && git checkout anne/plan-pinning-prototype
cd pkg/ui/workspaces/cluster-ui/src/pinnedPlans && ./start-dev.sh
# View at: http://localhost:3333/#/sql-activity?tab=Plan+pinning
```

`start-dev.sh` starts CockroachDB demo (movr data), a continuous workload, builds cluster-ui, and launches the dev server on port 3333.

> **Note:** The prototype uses hardcoded mock data for all pinning state.

> **V1 Scope:** **Drift Analysis is out of scope for V1.** All sections and flows referencing drift analysis (the Drift analysis sub-tab, Flow 2, Flow 3, and §2.3) are documented here for completeness and future iteration but should not be implemented in the V1 release.

---

## 1. User Flows & Testing

### Flow 1: View all pinned plans across the cluster

1. Navigate to **SQL Activity** page
2. Click **Pinned plans** tab
3. **All pinned plans** sub-tab is selected by default
4. Table shows all pinned plan gists across all statement fingerprints

- **Validation:** Table displays plan pin status, gist, statement, pinned by, pinned at, executions, overridden, avg latency, last executed for each pinned plan
- **Validation:** Clicking a plan gist navigates to the statement detail explain plan tab
- **Validation:** Clicking a statement navigates to the statement detail overview

### Flow 2: Identify and assess plan drift *(out of scope for V1)*

1. Click **Drift analysis** sub-tab (pill tab with count badge)
2. Review candidate plans the optimizer would have chosen
3. Check assessment badges to understand drift severity
4. Compare pinned vs candidate latency and latency delta

- **Validation:** Green latency delta indicates candidate is faster (potential improvement)
- **Validation:** Red latency delta indicates candidate is slower (regression risk)
- **Validation:** "Would-have-executed" count shows frequency of drift

### Flow 3: Pin a candidate plan from drift analysis *(out of scope for V1)*

1. On drift analysis tab, find a candidate with "Potential improvement" or "Invalid pin" assessment
2. Click the pin icon button in the **Candidate plan gist** column
3. Confirmation modal appears: "Pin this plan" with explanation text
4. Click "Pin plan" to confirm
5. "Pinned" badge appears next to the pin button; pin icon fills and turns blue

- **Validation:** Pin button appears in candidate column for "Potential improvement" and "Invalid pin" rows (not for "Regression risk")
- **Validation:** No "Unpinned" badge shown before pinning — just pin button + gist link
- **Validation:** "Pinned" badge appears only after confirming via modal
- **Validation:** Hovering assessment badges shows explanatory tooltip

### Flow 4: Unpin a plan from the All pinned plans table

1. On All pinned plans tab, click the pin button on a pinned plan
2. Confirmation modal appears: "Unpin this plan" with explanation text
3. Click "Unpin plan" to confirm
4. Badge changes from "Pinned" (blue) to "Unpinned" (grey)
5. Pin icon becomes outline and turns grey

- **Validation:** Plan remains in table (with Unpinned status) after unpinning
- **Validation:** Clicking pin button again opens "Pin this plan" modal to re-pin

### Flow 5: Review audit log for compliance

1. Click **Audit log** sub-tab
2. Review chronological history of pin/unpin actions
3. Click a plan gist to navigate to its explain plan
4. Click a statement to navigate to statement detail

- **Validation:** Each entry shows action (Pinned/Unpinned), gist, statement, user, timestamp
- **Validation:** Links navigate to correct statement detail pages

### Flow 6: Check pin status from the Statements list

1. Navigate to **SQL Activity → Statements** tab
2. Locate the **Plan pin status** column
3. Statements with pinned plans show "Pinned (N)" and/or "Invalid pin (N)" badges
4. Statements without pins show em-dash (—)

- **Validation:** Badge counts match the number of pinned/invalid plans for that fingerprint
- **Validation:** Clicking into a statement with pins shows pin status in the summary card

### Flow 7: View pin status on statement detail page

1. Click into a statement fingerprint from the Statements table
2. In the right summary card, find "Plan pin status" row (above Failure count)
3. Badges show "Pinned (N)" and/or "Invalid pin (N)" with counts

- **Validation:** Counts match the explain plan table's pin column
- **Validation:** Click "Explain plans" tab to see per-plan pin status

### Flow 8: Pin/unpin plans from the explain plan table

1. On statement detail, click **Explain plans** tab
2. Plan table shows "Plan pin status" as first column
3. Click pin icon to toggle pin state
4. Confirmation modal appears: "Pin this plan" or "Unpin this plan" with explanation text
5. Click "Pin plan" / "Unpin plan" to confirm
6. Badge updates: Pinned (blue), Unpinned (grey), or Invalid pin (red)
7. Audit log entry recorded only after confirmation

- **Validation:** Cancelling the modal leaves pin state unchanged and writes no audit entry
- **Validation:** Pin state persists while navigating between plan table and plan detail views
- **Validation:** Clicking into a plan detail view shows matching pin status
- **Validation:** Pin/unpin from the plan detail view (top-right button) also opens the same confirmation modal

---

## 2. Feature Specifications

This section documents what's implemented in the prototype. All features below are functional in the prototype with mock data.

### 2.1 Pinned Plans Tab (SQL Activity)

A new **"Pinned plans"** tab added to the SQL Activity page alongside Statements, Transactions, and Sessions.

- [x] Tab appears as the 4th tab in SQL Activity, labeled "Plan pinning" (sentence case)
- [x] Tab uses the same Ant Design `Tabs` component as the parent SQL Activity tabs
- [x] Three pill-style sub-tabs within: **All pinned plans**, **Drift analysis** *(out of scope for V1)*, **Audit log**
- [x] Pill sub-tabs use rounded style (`border-radius: 20px`) to visually distinguish from parent underline tabs
- [x] Drift analysis pill tab shows a count badge (blue circle) when alerts exist *(out of scope for V1)*

### 2.2 All Pinned Plans Table

A table listing every pinned plan across all statement fingerprints.

- [x] **Plan pin status** column (first column) — icon-only pin/unpin toggle button + status badge
  - Pin button: 14px pin SVG icon, `6px` padding, `1px solid #c0c6d9` border, `4px` border-radius
  - Pin button color: `#0055ff` (blue) when pinned, `#394455` (grey) when unpinned
  - Pin icon: filled when pinned, outline when unpinned
  - Badge states: "Pinned" (blue), "Invalid pin" (red), "Unpinned" (grey)
  - Clicking pin/unpin opens a **confirmation modal** before toggling state (see 2.5)
- [x] **Plan gist** column — truncated to 24 chars with tooltip showing full gist
  - Links to statement detail explain plan tab (`?tab=explain-plan&appNames=<app>`)
- [x] **Statement** column — monospace font, truncated with ellipsis at `max-width: 250px`
  - Links to statement detail overview (`?appNames=<app>`)
- [x] **Pinned by** column — username who created the pin
- [x] **Pinned at** column — date formatted as "MMM D, YYYY"
- [x] **Executions** column — right-aligned, locale-formatted number
- [x] **Overridden** column — right-aligned, blue text (`#0037a5`) when > 0
  - Count of executions where optimizer would have chosen a different plan
- [x] **Avg latency** column — right-aligned, formatted as duration (us/ms/s)
- [x] **Last executed** column — right-aligned, "MMM D HH:MM AM/PM"
- [x] All columns sortable (ascending/descending toggle with arrow indicators)
- [x] Row count display: "1-N of N pinned plans"

### 2.3 Drift Analysis Table *(out of scope for V1)*

> **V1 Scope:** This entire section is **out of scope for V1**. Documented for future iteration; do not implement in the V1 release.

Surfaces alternative plans the optimizer would have chosen absent pinning.

- [x] **Assessment** column (first column) — color-coded badge (28px tall, matches Pin badge) with tooltip:
  - "Potential improvement" — green (`#e3f5e0` bg, `#237300` text). Tooltip: "The candidate plan has lower latency than the pinned plan. The optimizer may have found a better execution path. Consider testing and pinning the candidate."
  - "Regression risk" — red (`#ffe9eb` bg, `#cd2939` text). Tooltip: "The candidate plan has higher latency than the pinned plan. The pin is protecting against a regression. Investigate why the optimizer prefers a worse plan."
  - "Invalid pin" — red (`#ffe9eb` bg, `#cd2939` text — matches the "Invalid pin" badge used elsewhere). Tooltip: "Pinned plan is invalid (e.g., schema change). The optimizer fell back to the candidate plan. Pin it to make it the active plan, or unpin to let the optimizer choose freely."
  - Tooltips render via `Tooltip` component, `placement="bottom"`, `max-width: 280px`
- [x] **Pinned plan gist** column — pin/unpin toggle button + "Pinned"/"Unpinned" badge + gist link
  - Pin button and badge styling matches All Pinned Plans table
  - Clicking pin/unpin opens a **confirmation modal** before toggling state (see 2.5)
  - Links to statement detail explain plan tab
- [x] **Candidate plan gist** column — pin button + gist link
  - Pin button appears for "Potential improvement" and "Invalid pin" rows (not for "Regression risk", since pinning a worse plan defeats the safeguard)
  - "Pinned" badge shown only after pinning; **no "Unpinned" badge** when not pinned (just pin button + gist link)
  - Clicking pin opens a **confirmation modal** before pinning (see 2.5)
  - Links to statement detail explain plan tab
- [x] **Statement** column — monospace, links to statement detail
- [x] **Pinned latency** / **Candidate latency** columns — right-aligned duration
- [x] **Latency delta** column — green for negative (improvement), red for positive (regression), bold
- [x] **Would-have-executed** column — count of times optimizer would have picked this plan
- [x] **Last would-have-executed** column — timestamp
- [x] **Action** column — "Test plan" button (secondary style), only shown for "Potential improvement" rows (**TBD** — functionality and scope still to be determined)
- [x] All columns sortable
- [x] Row count display: "1-N of N drift alerts"

### 2.4 Audit Log Table

History of all pin/unpin actions for governance and compliance.

- [x] **Action** column — badge showing "Pinned" (blue) or "Unpinned" (grey)
- [x] **Plan gist** column — clickable, links to explain plan tab
- [x] **Statement** column — monospace, clickable, links to statement detail
- [x] **User** column — username who performed the action
- [x] **Timestamp** column — "MMM D, YYYY HH:MM AM/PM"
- [x] All columns sortable
- [x] Row count display: "1-N of N audit log entries"

### 2.5 Pin/Unpin Confirmation Modal

All pin and unpin actions across the prototype — Pinned Plans page, Explain Plan table, and Explain Plan detail view — require confirmation via a shared modal dialog.

- [x] Implemented as a shared component `PinPlanModal` + `usePinPlanModal()` hook in `cluster-ui/src/pinnedPlans/pinPlanModal.tsx`
- [x] Any surface with a pin/unpin button calls `requestPin(gist, onConfirm)` or `requestUnpin(gist, onConfirm)`; the side-effect (state mutation, audit log entry) only fires after the user confirms
- [x] Uses the production `Modal` component from cluster-ui
- [x] **Pin modal**: Title "Pin this plan", body explains pinning forces the optimizer to use the specific plan
- [x] **Unpin modal**: Title "Unpin this plan", body explains unpinning allows optimizer to choose automatically
- [x] Action buttons: "Cancel" (secondary) and "Pin plan" / "Unpin plan" (primary)
- [x] Modal class: `pp-pin-modal` with custom close button positioning (`top: 16px`, `right: 16px`) and 40×40 click target
- [x] Cancelling closes the modal with no state change and writes no audit entry
- [x] Pin targets covered: Pinned Plans page (`overview`; `drift` and `candidate` *out of scope for V1*), Explain Plans table, Explain Plan detail view

### 2.6 Statement Fingerprint Detail Page

Pin status integrated into the existing statement detail page.

- [x] **Plan pin status** row in right summary card (positioned above "Failure count")
  - Shows aggregated badges with counts: "Pinned (2)", "Invalid pin (1)"
  - Badges always include count even when count is 1
  - Badge font weight: 400 (lighter than table badges)
  - Only appears for statements that have pinned plans

### 2.7 Explain Plan Table (Plan Details)

Pin status column added to the plan gist table within statement details.

- [x] **Plan pin status** column (first column) — icon-only pin/unpin button + badge
  - Same styling as Pinned Plans page pin column
  - Badge font weight: 600 (matches table context)
  - Badge height: 28px (matches pin button height)
  - Shows all three states: Pinned, Unpinned, Invalid pin
- [x] Clicking pin/unpin opens the shared **confirmation modal** (see 2.5) before applying the change
- [x] Audit log entry written only after the user confirms in the modal
- [x] Mock plans injected per fingerprint (2-3 plan gists per statement) via `MOCK_PIN_CONFIG`

### 2.8 Explain Plan Detail View

Pin status shown when viewing a single plan's explain plan.

- [x] Pin/unpin button + status badge in top-right corner (opposite "All Plans" back button)
- [x] Badge font weight: 400 (non-table context)
- [x] Badge height: 28px
- [x] Shows all three states: Pinned, Unpinned, Invalid pin
- [x] Clicking pin/unpin opens the shared **confirmation modal** (see 2.5) before applying the change

### 2.9 Statements List Table

Pin status column added to the main SQL Activity Statements table.

- [x] **Plan pin status** column — aggregated badges with counts
  - "Pinned (2)" blue badge, "Invalid pin (1)" red badge
  - Badge height: 24px
  - Shows em-dash (—) for statements without pinned plans
- [x] Column sortable (pinned statements sort above unpinned)

---

## 3. Visual Design Specifications

### Typography

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| Table header | SourceSansPro-SemiBold | 14px | normal | `#475872` |
| Table cell | SourceSansPro-Regular | 14px | 300 | `#394455` |
| Statement fingerprint (mono) | RobotoMono-Medium | 12px | 500 | `#242A35` |
| Pill tab (selected) | SourceSansPro-Regular | 13px | 600 | `#0037a5` |
| Pill tab (unselected) | SourceSansPro-Regular | 13px | 400 | `#475872` |
| Row count text | SourceSansPro-Regular | 14px | 400 | `#475872` |
| Badge text | SourceSansPro-Regular | 12px | 600 (table) / 400 (detail) | varies |
| Duration values | SourceSansPro-Regular | 14px | 300 | `#394455` |

### Colors

| Token | Hex | Usage |
|---|---|---|
| neutral-0 | `#ffffff` | Row background, button background |
| neutral-2 | `#d6dbe7` | Table row borders |
| neutral-4 | `#c0c6d9` | Button border, sort arrow inactive |
| neutral-6 | `#475872` | Header text, secondary text, unpinned badge text |
| neutral-7 | `#394455` | Cell text, unpinned pin icon |
| primary-blue-3 | `#0055ff` | Active sort arrow, pinned pin icon, links on hover, drift count badge bg |
| primary-blue-4 | `#0037a5` | Pinned badge text, active pill tab text, overridden count text |
| primary-blue-alert | `#e1ecff` | Pinned badge background, active pill tab background |
| neutral-1 | `#f0f2f5` | Unpinned badge background, pill tab hover |
| danger-bg | `#ffe9eb` | Invalid pin badge background, Regression risk + Invalid pin assessment background |
| danger-text | `#cd2939` | Invalid pin badge text, Regression risk + Invalid pin assessment text, positive latency delta |
| success-bg | `#e3f5e0` | Potential improvement badge background |
| success-text | `#237300` | Potential improvement badge text, negative latency delta |

### Component Specifications

| Component | Height | Padding | Border Radius | Notes |
|---|---|---|---|---|
| Pin button (icon-only) | 28px (computed) | `6px` all sides | `4px` | 14px SVG icon, `1px solid #c0c6d9` border |
| Status badge (table) | `28px` | `0 8px` | `3px` | Font weight 600 |
| Status badge (detail) | `28px` | `0 8px` | `3px` | Font weight 400 |
| Status badge (statement card) | `24px` | `0 8px` | `3px` | Font weight 400 |
| Assessment badge | auto | `2px 8px` | `3px` | Font weight 600, `line-height: 20px`, tooltip on hover |
| Pill tab | auto | `6px 16px` | `20px` | Transition: `all 0.15s ease` |
| Drift count badge | `18px` | — | `50%` (circle) | `11px` font, always blue, `top: -1px` for centering |
| Test plan button | auto | `4px 8px` | `4px` | `1px solid #c0c6d9`, font weight 600 |
| Confirmation modal | auto | `24px` | default | Uses production `Modal` component, class `pp-pin-modal`. Close X positioned `top: 16px, right: 16px` with 40×40 click target |
| Table row | `70px` | — | — | `1px solid #d6dbe7` bottom border |

### Icons

| Icon | Size | Location | Color |
|---|---|---|---|
| Pin (SVG) | 14x14px | Pin button in all tables + detail view | `#0055ff` pinned, `#394455` unpinned |
| Sort arrows (up/down triangles) | 6x4px each | All sortable column headers | `#0055ff` active, `#c0c6d9` inactive |

### Table Layout

- First column left padding: `24px`
- Cell padding: `8px`
- Header padding: `11px 16px 11px 8px`
- Numeric columns: right-aligned
- Statement column: `max-width: 250px`, `overflow: hidden`, `text-overflow: ellipsis`
- Table width: `fit-content` with `min-width: 100%`
- Horizontal scroll via `overflow-x: auto` wrapper

### Hover States

- Links: `#394455` → `#0055ff` + underline on hover
- Monospace links: `#242A35` → `#0055ff` + underline on hover
- Pill tabs (unselected): background `#f0f2f5` on hover
- Pin button: standard cursor pointer (no explicit hover style)
