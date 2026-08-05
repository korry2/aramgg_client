export const LOCAL_MATCH_HISTORY_SCHEMA_VERSION = 2

export type MatchHistoryCollectionSource = 'current' | 'matched'
export type MatchHistoryUploadStatus = 'pending' | 'uploading' | 'uploaded'

export interface StoredMatchHistoryPlayer {
  playerKey: string
  puuid: string
  platformId: string
  gameName: string
  tagLine: string
  summonerId: number | null
  isCurrentUser: boolean
  /** True only when this player shared a stored match with the local user. */
  isDirectEncounter?: boolean
  firstSeenAt: number
  lastSeenAt: number
  historyCollectedAt: number | null
  lastHistoryScanAt: number | null
  collectionSource: MatchHistoryCollectionSource | null
}

export interface StoredMatchHistoryParticipant {
  participantId: number
  puuid: string | null
  gameName: string
  tagLine: string
  championId: number
  teamId: number
  playerSubteamId: number
  subteamPlacement: number
  win: boolean
  gameEndedInEarlySurrender: boolean
  kills: number
  deaths: number
  assists: number
  items: number[]
  augments: number[]
}

export interface StoredMatchHistoryGame {
  gameKey: string
  platformId: string
  gameId: number
  gameCreation: number
  gameDuration: number
  gameMode: string
  gameModeMutators: string[]
  gameType: string
  gameVersion: string
  mapId: number
  queueId: number
  endOfGameResult: string
  participants: StoredMatchHistoryParticipant[]
  collectedAt: number
}

/**
 * Uploads remain in this local outbox until a server endpoint is explicitly configured.
 * `sourceKey` is the server-side unique key; `idempotencyKey` identifies this exact payload.
 */
export interface MatchHistoryUploadOutboxEntry {
  sourceKey: string
  idempotencyKey: string
  payloadHash: string
  platformId: string
  gameId: number
  status: MatchHistoryUploadStatus
  attempts: number
  queuedAt: number
  lastAttemptAt: number | null
  uploadedAt: number | null
}

export interface LocalMatchHistoryData {
  schemaVersion: typeof LOCAL_MATCH_HISTORY_SCHEMA_VERSION
  updatedAt: number
  activePlatformId: string | null
  currentPlayerKey: string | null
  players: Record<string, StoredMatchHistoryPlayer>
  games: Record<string, StoredMatchHistoryGame>
  uploadOutbox: Record<string, MatchHistoryUploadOutboxEntry>
}
