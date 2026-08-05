import { describe, expect, it } from 'vitest'
import { queueGameForUpload } from '../../src/main/services/match-history/upload-outbox.ts'
import type { LocalMatchHistoryData, StoredMatchHistoryGame } from '../../src/main/services/match-history/types.ts'

function createData(): LocalMatchHistoryData {
  return {
    schemaVersion: 2,
    updatedAt: 0,
    activePlatformId: 'HN10',
    currentPlayerKey: null,
    players: {},
    games: {},
    uploadOutbox: {},
  }
}

function createGame(overrides: Partial<StoredMatchHistoryGame> = {}): StoredMatchHistoryGame {
  return {
    gameKey: 'HN10:123',
    platformId: 'HN10',
    gameId: 123,
    gameCreation: 1,
    gameDuration: 900,
    gameMode: 'ARAM',
    gameModeMutators: [],
    gameType: 'MATCHED_GAME',
    gameVersion: '16.15',
    mapId: 12,
    queueId: 450,
    endOfGameResult: 'GameComplete',
    participants: [],
    collectedAt: 100,
    ...overrides,
  }
}

describe('match-history upload outbox', () => {
  it('deduplicates a re-read game by platform + game ID instead of its page index', () => {
    const data = createData()
    const game = createGame()

    queueGameForUpload(data, game)
    const entry = data.uploadOutbox['match-history:v1:HN10:123']
    entry.status = 'uploaded'
    queueGameForUpload(data, { ...game, collectedAt: 999 })

    expect(Object.keys(data.uploadOutbox)).toEqual(['match-history:v1:HN10:123'])
    expect(data.uploadOutbox['match-history:v1:HN10:123']).toMatchObject({
      status: 'uploaded',
      gameId: 123,
      platformId: 'HN10',
    })
  })

  it('migrates the legacy LCU source key without creating a second outbox record', () => {
    const data = createData()
    const game = createGame()
    queueGameForUpload(data, game)
    const current = data.uploadOutbox['match-history:v1:HN10:123']
    delete data.uploadOutbox[current.sourceKey]
    data.uploadOutbox['lcu-match-history:v1:HN10:123'] = {
      ...current,
      sourceKey: 'lcu-match-history:v1:HN10:123',
      status: 'uploaded',
    }

    queueGameForUpload(data, game)

    expect(Object.keys(data.uploadOutbox)).toEqual(['match-history:v1:HN10:123'])
    expect(data.uploadOutbox['match-history:v1:HN10:123']).toMatchObject({
      sourceKey: 'match-history:v1:HN10:123',
      status: 'uploaded',
    })
  })

  it('updates one source record when a completed game payload changes instead of enqueuing a duplicate', () => {
    const data = createData()
    const game = createGame()
    queueGameForUpload(data, game)
    const firstIdempotencyKey = data.uploadOutbox['match-history:v1:HN10:123'].idempotencyKey

    queueGameForUpload(data, { ...game, gameVersion: '16.15.1' })

    expect(Object.keys(data.uploadOutbox)).toHaveLength(1)
    expect(data.uploadOutbox['match-history:v1:HN10:123']).toMatchObject({ status: 'pending' })
    expect(data.uploadOutbox['match-history:v1:HN10:123'].idempotencyKey).not.toBe(firstIdempotencyKey)
  })
})
