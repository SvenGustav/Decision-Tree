/**
 * Professional color theme for RiskTree
 * Corporate light theme — clean, neutral, data-focused
 */

// Base palette
export const palette = {
  // Backgrounds
  canvas: '#f1f5f9',           // Light slate canvas
  canvasGrid: '#cbd5e1',       // Subtle grid lines
  panel: '#ffffff',
  panelDark: '#f8fafc',

  // Node colors — clean, corporate
  decision: {
    base: '#EFF6FF',           // Light blue fill
    optimal: '#1d4ed8',        // Royal blue (optimal)
    border: '#93c5fd',         // Medium blue border
    borderActive: '#1d4ed8',
    text: '#1e3a8a',           // Dark navy text
    subtle: '#bfdbfe',
  },
  chance: {
    base: '#ECFDF5',           // Light green fill
    optimal: '#047857',        // Dark green (optimal)
    border: '#6ee7b7',
    borderActive: '#047857',
    text: '#064e3b',
    subtle: '#a7f3d0',
  },
  terminal: {
    positive: {
      base: '#FFFBEB',         // Light amber fill
      optimal: '#d97706',
      border: '#fcd34d',
      borderActive: '#d97706',
      text: '#78350f',
    },
    negative: {
      base: '#FEF2F2',         // Light red fill
      border: '#fca5a5',
      borderActive: '#dc2626',
      text: '#7f1d1d',
    },
  },

  // Semantic colors
  success: '#047857',
  warning: '#d97706',
  error: '#dc2626',
  info: '#1d4ed8',

  // Grayscale
  gray: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },

  // Analysis colors
  analysis: {
    primary: '#1d4ed8',
    secondary: '#7c3aed',
    positive: '#047857',
    negative: '#dc2626',
    neutral: '#64748b',
  },
}

// Node styling tokens
export const nodeTheme = {
  decision: {
    bg: palette.decision.base,
    bgOptimal: '#dbeafe',
    border: palette.decision.border,
    borderOptimal: palette.decision.borderActive,
    text: palette.decision.text,
    textSecondary: '#3b82f6',
    shadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    shadowOptimal: '0 0 0 3px rgba(29,78,216,0.15), 0 1px 3px rgba(0,0,0,0.1)',
    glow: '0 0 0 3px rgba(29,78,216,0.25)',
  },
  chance: {
    bg: palette.chance.base,
    bgOptimal: '#d1fae5',
    border: palette.chance.border,
    borderOptimal: palette.chance.borderActive,
    text: palette.chance.text,
    textSecondary: '#059669',
    shadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    shadowOptimal: '0 0 0 3px rgba(4,120,87,0.15), 0 1px 3px rgba(0,0,0,0.1)',
    glow: '0 0 0 3px rgba(4,120,87,0.25)',
  },
  terminal: {
    bgPositive: palette.terminal.positive.base,
    bgPositiveOptimal: '#fef3c7',
    bgNegative: palette.terminal.negative.base,
    borderPositive: palette.terminal.positive.border,
    borderPositiveActive: palette.terminal.positive.borderActive,
    borderNegative: palette.terminal.negative.border,
    borderNegativeActive: palette.terminal.negative.borderActive,
    textPositive: palette.terminal.positive.text,
    textNegative: palette.terminal.negative.text,
    text: palette.terminal.positive.text,
    textSecondary: '#92400e',
    shadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    shadowOptimal: '0 0 0 3px rgba(217,119,6,0.2), 0 1px 3px rgba(0,0,0,0.1)',
    glow: '0 0 0 3px rgba(217,119,6,0.3)',
  },
}

// Edge styling
export const edgeTheme = {
  normal: {
    stroke: palette.gray[400],
    strokeWidth: 1.5,
  },
  optimal: {
    stroke: palette.decision.borderActive,
    strokeWidth: 2.5,
  },
  selected: {
    stroke: palette.warning,
    strokeWidth: 2.5,
  },
}

// Panel styling
export const panelTheme = {
  bg: palette.panel,
  border: palette.gray[200],
  sectionBg: palette.gray[50],
  headerBg: palette.gray[100],
  textPrimary: palette.gray[900],
  textSecondary: palette.gray[600],
  textMuted: palette.gray[400],
}

// Toolbar styling
export const toolbarTheme = {
  bg: '#ffffff',
  border: palette.gray[200],
  text: palette.gray[700],
  textMuted: palette.gray[400],
  accent: {
    decision: '#1d4ed8',
    chance: '#047857',
    terminal: '#d97706',
  },
}
