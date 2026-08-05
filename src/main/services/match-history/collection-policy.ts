export const BACKGROUND_INITIAL_CURRENT_MATCH_LIMIT = 50
export const BACKGROUND_REFRESH_CURRENT_MATCH_LIMIT = 10
export const BACKGROUND_MATCHED_PLAYER_LIMIT = 2
export const BACKGROUND_MATCHED_MATCH_LIMIT = 20
export const BACKGROUND_REQUEST_PACING_MS = 250

export function getBackgroundCurrentMatchLimit(historyCollectedAt: number | null | undefined): number {
  return historyCollectedAt
    ? BACKGROUND_REFRESH_CURRENT_MATCH_LIMIT
    : BACKGROUND_INITIAL_CURRENT_MATCH_LIMIT
}
