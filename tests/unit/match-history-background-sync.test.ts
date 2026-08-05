import { describe, expect, it } from 'vitest'
import { getBackgroundSyncCoalesceCause } from '../../src/main/services/match-history/background-sync.ts'
import {
  BACKGROUND_INITIAL_CURRENT_MATCH_LIMIT,
  BACKGROUND_MATCHED_MATCH_LIMIT,
  BACKGROUND_MATCHED_PLAYER_LIMIT,
  BACKGROUND_REFRESH_CURRENT_MATCH_LIMIT,
  getBackgroundCurrentMatchLimit,
} from '../../src/main/services/match-history/collection-policy.ts'

describe('match-history background sync scheduling', () => {
  it('coalesces concurrent and closely repeated startup/phase triggers', () => {
    expect(getBackgroundSyncCoalesceCause({
      inFlight: true,
      lastCompletedAt: 0,
      now: 100,
    })).toBe('in-flight')

    expect(getBackgroundSyncCoalesceCause({
      inFlight: false,
      lastCompletedAt: 1_000,
      now: 12_999,
      minimumGapMs: 60_000,
    })).toBe('minimum-gap')
  })

  it('allows a new batch after the minimum interval', () => {
    expect(getBackgroundSyncCoalesceCause({
      inFlight: false,
      lastCompletedAt: 1_000,
      now: 61_000,
      minimumGapMs: 60_000,
    })).toBeNull()
  })

  it('uses a shallow current-player refresh to spend the budget on player coverage', () => {
    expect(getBackgroundCurrentMatchLimit(null)).toBe(BACKGROUND_INITIAL_CURRENT_MATCH_LIMIT)
    expect(getBackgroundCurrentMatchLimit(Date.now())).toBe(BACKGROUND_REFRESH_CURRENT_MATCH_LIMIT)
    expect(BACKGROUND_MATCHED_PLAYER_LIMIT).toBe(2)
    expect(BACKGROUND_MATCHED_MATCH_LIMIT).toBe(20)
  })
})
