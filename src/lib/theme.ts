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
      base: '#171717',
      raised: '#1d1d1d',
      surface: '#242424',
      overlay: '#2b2b2b',
      hover: '#323232',
    },
    fg: {
      primary: '#f2f1ec',
      secondary: '#ddd9ce',
      dim: '#b2ac9f',
      muted: '#827b70',
    },
    border: {
      subtle: '#2f2f2f',
      default: '#494949',
      bright: '#726b60',
    },
    accent: '#d4a24c',
    ...sharedTokens,
  },
  light: {
    bg: {
      base: '#f2f1ec',
      raised: '#f7f6f1',
      surface: '#eae9e1',
      overlay: '#e1ded4',
      hover: '#d9d4c8',
    },
    fg: {
      primary: '#171717',
      secondary: '#2f2c27',
      dim: '#625d54',
      muted: '#8b857a',
    },
    border: {
      subtle: '#e2dfd4',
      default: '#c3beb2',
      bright: '#8b857a',
    },
    accent: '#854d0e',
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

const midnightStatusColors: Record<TaskStatus, string> = {
  completed: '#86c8aa',
  failed: '#f2a3a3',
  running: '#f2c66d',
  pending: '#b8b1a3',
  skipped: '#7c766b',
}

const midnightStatusBgColors: Record<TaskStatus, string> = {
  completed: '#193127',
  failed: '#3b1f1f',
  running: '#3a2c12',
  pending: '#242424',
  skipped: '#1d1d1d',
}

const lightStatusColors: Record<TaskStatus, string> = {
  completed: '#2f6f55',
  failed: '#b93838',
  running: '#8a5a12',
  pending: '#57534e',
  skipped: '#78716c',
}

const lightStatusBgColors: Record<TaskStatus, string> = {
  completed: '#dcecdf',
  failed: '#f9e0e0',
  running: '#f5e8c8',
  pending: '#eae9e1',
  skipped: '#f2f1ec',
}

const statusColorPresets: Record<ThemeName, Record<TaskStatus, string>> = {
  midnight: { ...midnightStatusColors },
  light: { ...lightStatusColors },
  ocean: { ...defaultStatusColors },
  forest: { ...defaultStatusColors },
  sunset: { ...defaultStatusColors },
}

const statusBgColorPresets: Record<ThemeName, Record<TaskStatus, string>> = {
  midnight: { ...midnightStatusBgColors },
  light: { ...lightStatusBgColors },
  ocean: { ...defaultStatusBgColors },
  forest: { ...defaultStatusBgColors },
  sunset: { ...defaultStatusBgColors },
}

const progressColorPresets: Record<ThemeName, string> = {
  midnight: '#d4a24c',
  light: '#854d0e',
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
  const contrastTarget = theme.fg.primary
  return mix(hex, contrastTarget, amount)
}
