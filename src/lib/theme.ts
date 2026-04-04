import { reactive, ref } from 'vue'
import type { TaskStatus } from './types'

export type ThemeName = 'midnight' | 'light' | 'ocean' | 'forest' | 'sunset'

export type ThemeTokens = {
  bg: {
    base: string
    raised: string
    surface: string
    overlay: string
    hover: string
  }
  fg: {
    primary: string
    secondary: string
    dim: string
    muted: string
  }
  border: {
    subtle: string
    default: string
    bright: string
  }
  accent: string
  font: {
    mono: string
  }
  fontSize: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
    hero: number
  }
  radius: {
    sm: number
    md: number
    lg: number
  }
}

const sharedTokens = {
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
} satisfies Pick<ThemeTokens, 'font' | 'fontSize' | 'radius'>

export const themePresets: Record<ThemeName, ThemeTokens> = {
  midnight: {
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
    ...sharedTokens,
  },
  light: {
    bg: {
      base: '#f8fafc',
      raised: '#ffffff',
      surface: '#eef2ff',
      overlay: '#e2e8f0',
      hover: '#dbeafe',
    },
    fg: {
      primary: '#0f172a',
      secondary: '#334155',
      dim: '#64748b',
      muted: '#94a3b8',
    },
    border: {
      subtle: '#dbe4f0',
      default: '#cbd5e1',
      bright: '#94a3b8',
    },
    accent: '#2563eb',
    ...sharedTokens,
  },
  ocean: {
    bg: {
      base: '#061826',
      raised: '#0b2236',
      surface: '#10304b',
      overlay: '#153d5d',
      hover: '#1c4a71',
    },
    fg: {
      primary: '#e0f2fe',
      secondary: '#93c5fd',
      dim: '#60a5fa',
      muted: '#3b82f6',
    },
    border: {
      subtle: '#1d3557',
      default: '#29557e',
      bright: '#3b82b6',
    },
    accent: '#22d3ee',
    ...sharedTokens,
  },
  forest: {
    bg: {
      base: '#081c15',
      raised: '#10261f',
      surface: '#163126',
      overlay: '#1f3d31',
      hover: '#28503f',
    },
    fg: {
      primary: '#ecfdf5',
      secondary: '#a7f3d0',
      dim: '#6ee7b7',
      muted: '#34d399',
    },
    border: {
      subtle: '#214333',
      default: '#2d5a46',
      bright: '#3f7a5f',
    },
    accent: '#84cc16',
    ...sharedTokens,
  },
  sunset: {
    bg: {
      base: '#1a1020',
      raised: '#24142b',
      surface: '#2f1b38',
      overlay: '#3c2347',
      hover: '#4a2c56',
    },
    fg: {
      primary: '#fdf2f8',
      secondary: '#f5c2e7',
      dim: '#f9a8d4',
      muted: '#f472b6',
    },
    border: {
      subtle: '#49263f',
      default: '#6b2d5c',
      bright: '#8b3d73',
    },
    accent: '#fb7185',
    ...sharedTokens,
  },
}

const THEME_STORAGE_KEY = 'taskviz-theme'
const FALLBACK_THEME: ThemeName = 'midnight'

const defaultStatusColors: Record<TaskStatus, string> = {
  completed: '#34d399',
  failed: '#f87171',
  running: '#60a5fa',
  pending: '#9ca3af',
  skipped: '#6b7280',
}

const defaultStatusBgColors: Record<TaskStatus, string> = {
  completed: '#064e3b',
  failed: '#7f1d1d',
  running: '#1e3a5f',
  pending: '#1f2937',
  skipped: '#1a1a2e',
}

const lightStatusColors: Record<TaskStatus, string> = {
  completed: '#047857',
  failed: '#b91c1c',
  running: '#1d4ed8',
  pending: '#475569',
  skipped: '#64748b',
}

const lightStatusBgColors: Record<TaskStatus, string> = {
  completed: '#d1fae5',
  failed: '#fee2e2',
  running: '#dbeafe',
  pending: '#e2e8f0',
  skipped: '#f1f5f9',
}

const statusColorPresets: Record<ThemeName, Record<TaskStatus, string>> = {
  midnight: { ...defaultStatusColors },
  light: { ...lightStatusColors },
  ocean: { ...defaultStatusColors },
  forest: { ...defaultStatusColors },
  sunset: { ...defaultStatusColors },
}

const statusBgColorPresets: Record<ThemeName, Record<TaskStatus, string>> = {
  midnight: { ...defaultStatusBgColors },
  light: { ...lightStatusBgColors },
  ocean: { ...defaultStatusBgColors },
  forest: { ...defaultStatusBgColors },
  sunset: { ...defaultStatusBgColors },
}

const progressColorPresets: Record<ThemeName, string> = {
  midnight: '#c2610a',
  light: '#2563eb',
  ocean: '#0ea5e9',
  forest: '#65a30d',
  sunset: '#ec4899',
}

export const themeOptions: Array<{ value: ThemeName; label: string }> = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'light', label: 'Light' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'forest', label: 'Forest' },
  { value: 'sunset', label: 'Sunset' },
]

function isThemeName(value: string): value is ThemeName {
  return value in themePresets
}

function getInitialThemeName(): ThemeName {
  if (typeof window === 'undefined') return FALLBACK_THEME
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored && isThemeName(stored) ? stored : FALLBACK_THEME
}

export const currentThemeName = ref<ThemeName>(getInitialThemeName())
export const theme = reactive<ThemeTokens>({ ...themePresets[currentThemeName.value] })
export const statusColors = reactive<Record<TaskStatus, string>>({ ...statusColorPresets[currentThemeName.value] })
export const statusBgColors = reactive<Record<TaskStatus, string>>({ ...statusBgColorPresets[currentThemeName.value] })
export const taskProgressColor = ref(progressColorPresets[currentThemeName.value])

function syncThemeDerivedColors(name: ThemeName): void {
  Object.assign(statusColors, statusColorPresets[name])
  Object.assign(statusBgColors, statusBgColorPresets[name])
  taskProgressColor.value = progressColorPresets[name]
}

export function setTheme(name: ThemeName): void {
  const resolvedName = isThemeName(name) ? name : FALLBACK_THEME
  currentThemeName.value = resolvedName
  Object.assign(theme, themePresets[resolvedName])
  syncThemeDerivedColors(resolvedName)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, resolvedName)
  }
}

setTheme(currentThemeName.value)

export function alpha(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

export function mix(hex: string, otherHex: string, amount: number): string {
  const weight = Math.max(0, Math.min(1, amount))
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - weight) + parseInt(otherHex.slice(1, 3), 16) * weight)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - weight) + parseInt(otherHex.slice(3, 5), 16) * weight)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - weight) + parseInt(otherHex.slice(5, 7), 16) * weight)
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`
}

export function emphasize(hex: string, amount = 0.24): string {
  const contrastTarget = currentThemeName.value === 'light' ? '#0f172a' : '#f8fafc'
  return mix(hex, contrastTarget, amount)
}
