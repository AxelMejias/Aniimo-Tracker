import type { AniimoApi } from './api'

declare global {
  interface Window {
    readonly aniimo: Readonly<AniimoApi>
  }
}
