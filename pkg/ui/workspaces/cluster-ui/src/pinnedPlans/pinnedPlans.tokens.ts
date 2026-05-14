// Copyright 2026 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

// =============================================================================
// Color tokens used in inline JSX styles across the pinned plans surface.
//
// These mirror cluster-ui's design system (src/core/colors.module.scss).
// Class-driven styles in pinnedPlansPage.module.scss reference the SCSS
// tokens directly; this object is for the cell-level inline styles in the
// SortedTable column descriptors and the prototype Drift / Audit tables
// that haven't been moved to CSS modules yet.
//
// Keep these in sync if the design system palette changes. Several entries
// (commented "off-palette") are state-specific colors not yet in the design
// system — they're called out so a designer can either add them upstream or
// substitute the closest token.
// =============================================================================

export const tokens = {
  // Direct palette matches:
  white: "#ffffff",                   // $colors--neutral-0
  neutral2: "#e7ecf3",                // $colors--neutral-2
  neutral3: "#d6dbe7",                // $colors--neutral-3
  neutral4: "#c0c6d9",                // $colors--neutral-4
  neutral5: "#7e89a9",                // $colors--neutral-5
  neutral6: "#475872",                // $colors--neutral-6
  neutral7: "#394455",                // $colors--neutral-7
  primaryBlue3: "#0055ff",            // $colors--primary-blue-3
  primaryBlueAlert: "#e1ecff",        // $colors--primary-blue-alert
  // Off-palette (callouts for the design system):
  disabledBg: "#f6f7f9",              // disabled button bg — close to $colors--neutral-1 (#f5f7fa)
  unpinnedBadgeBg: "#f0f2f5",         // unpinned badge bg — between neutral-1 and neutral-2
  disabledBorder: "#e7eaf2",          // disabled button border — between neutral-2 and neutral-3
  primaryBlueDark: "#0037a5",         // pinned pill text — darker than primary-blue-3
  functionalRed: "#cd2939",           // broken pin foreground — close to functional-red-4 (#c32534)
  functionalRedLight: "#ffe9eb",      // broken pin background
  functionalGreen: "#237300",         // drift "potential improvement" foreground
  functionalGreenLight: "#e3f5e0",    // drift "potential improvement" background
} as const;

// Font family used by the SortedTable cells and the prototype Drift / Audit
// tables. Matches the cluster-ui SCSS $font-family--base value.
export const fontFamily = "SourceSansPro-Regular, Source Sans Pro, sans-serif";
