import type { TaskStatus } from './types'

export const theme = {
  bg: {
    base: '#000000',
    raised: '#0d0d14',
    surface: '#141420',
    overlay: '#1a1a28',
    hover: '#22223a',
  },
  fg: {
    primary: '#e0e0e8',
    secondary: '#9090a8',
    dim: '#606078',
    muted: '#44445c',
  },
  border: {
    subtle: '#1e1e32',
    default: '#2a2a44',
    bright: '#3a3a58',
  },
  accent: '#6c8cff',
  font: {
    mono: "'JetBrains Mono', monospace",
  },
  fontSize: {
    xs: 10,
    sm: 11,
    md: 13,
    lg: 15,
    xl: 18,
    hero: 28,
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
  },
} as const

export const statusColors: Record<TaskStatus, string> = {
  completed: '#34d399',
  failed: '#f87171',
  running: '#60a5fa',
  pending: '#6b7280',
  skipped: '#4b5563',
}

export const statusBgColors: Record<TaskStatus, string> = {
  completed: '#064e3b',
  failed: '#7f1d1d',
  running: '#1e3a5f',
  pending: '#1f2937',
  skipped: '#1a1a2e',
}

export function alpha(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}
