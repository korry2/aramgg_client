import { createHash } from 'node:crypto'
import type {
  LocalMatchHistoryData,
  StoredMatchHistoryGame,
} from './types.ts'

export function getGameKey(platformId: string, gameId: number): string {
  return `${platformId}:${gameId}`
}

export function getUploadSourceKey(game: StoredMatchHistoryGame): string {
  return `match-history:v1:${game.platformId}:${game.gameId}`
}

function getLegacyLcuSourceKey(game: StoredMatchHistoryGame): string {
  return `lcu-match-history:v1:${game.platformId}:${game.gameId}`
}

function getGamePayloadHash(game: StoredMatchHistoryGame): string {
  const { collectedAt: _collectedAt, ...payload } = game
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function getIdempotencyKey(sourceKey: string, payloadHash: string): string {
  return createHash('sha256').update(`${sourceKey}:${payloadHash}`).digest('hex')
}

/**
 * The entry is keyed by region + game ID, never by page offset. Re-reading a
 * shifted match-history page therefore cannot create a duplicate upload.
 */
export function queueGameForUpload(data: LocalMatchHistoryData, game: StoredMatchHistoryGame): void {
  const sourceKey = getUploadSourceKey(game)
  const legacySourceKey = getLegacyLcuSourceKey(game)
  const payloadHash = getGamePayloadHash(game)
  const existing = data.uploadOutbox[sourceKey] || data.uploadOutbox[legacySourceKey]
  if (legacySourceKey !== sourceKey) {
    delete data.uploadOutbox[legacySourceKey]
  }
  if (existing?.payloadHash === payloadHash) {
    data.uploadOutbox[sourceKey] = {
      ...existing,
      sourceKey,
      idempotencyKey: getIdempotencyKey(sourceKey, payloadHash),
      status: existing.status === 'uploading' ? 'pending' : existing.status,
    }
    return
  }

  data.uploadOutbox[sourceKey] = {
    sourceKey,
    idempotencyKey: getIdempotencyKey(sourceKey, payloadHash),
    payloadHash,
    platformId: game.platformId,
    gameId: game.gameId,
    status: 'pending',
    attempts: existing?.attempts || 0,
    queuedAt: existing?.queuedAt || Date.now(),
    lastAttemptAt: null,
    uploadedAt: null,
  }
}
