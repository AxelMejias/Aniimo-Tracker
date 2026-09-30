export interface AniimoApi {
  readonly appName: string
}

export function buildExposedApi(): Readonly<AniimoApi> {
  return Object.freeze({
    appName: 'Aniimo Team Tracker'
  })
}
