import type { ThemeName } from './theme'
import type { PlaybackMode } from './types'

export interface TaskVizEmbedProps {
  /** URL to a `.jsonl` file served by the host site. */
  jsonlPath?: string
  /** Inline JSONL content. When provided, it takes precedence over `jsonlPath`. */
  jsonlText?: string
  /** Optional label shown in the embed chrome. */
  fileLabel?: string
  /** Initial visual theme for the embedded player. */
  theme?: ThemeName
  /** Whether playback starts in `preview` or `reveal` mode. */
  defaultMode?: PlaybackMode
  /** Start playback automatically after the component becomes visible in the viewport. */
  autoplayWhenVisible?: boolean
  /** CSS height for the embedded player container, e.g. `720px` or `70vh`. */
  height?: string
  /** Show the header/timeline/inspector chrome for an interactive embed. */
  showChrome?: boolean
  /** Show the theme picker in the embed chrome. Ignored when `showChrome` is `false`. */
  showThemePicker?: boolean
  /** Show the close button in the top-right chrome. Ignored when `showChrome` is `false`. */
  showCloseButton?: boolean
}
