import logger from '../../modules/logger.ts'
import { getLCUServiceInstance } from '../lcu/lcu-service.ts'
import { logMatchHistoryDev } from './dev-diagnostics.ts'
import { getLocalMatchHistoryService } from './local-match-history-service.ts'

const BACKGROUND_SYNC_INTERVAL_MS = 5 * 60 * 1000
const BACKGROUND_SYNC_START_DELAY_MS = 15 * 1000
const BACKGROUND_SYNC_MIN_GAP_MS = 60 * 1000

let backgroundSyncTimer: NodeJS.Timeout | null = null
let backgroundSyncStartTimer: NodeJS.Timeout | null = null
let backgroundSyncRequestTimer: NodeJS.Timeout | null = null
let backgroundSyncInFlight = false
let lastBackgroundSyncCompletedAt = 0
let backgroundSyncUpdatedCallback: ((updatedAt: number) => void) | null = null

export function getBackgroundSyncCoalesceCause(params: {
  inFlight: boolean
  lastCompletedAt: number
  now: number
  minimumGapMs?: number
}): 'in-flight' | 'minimum-gap' | null {
  if (params.inFlight) {
    return 'in-flight'
  }
  const minimumGapMs = params.minimumGapMs ?? BACKGROUND_SYNC_MIN_GAP_MS
  return params.lastCompletedAt > 0 && params.now - params.lastCompletedAt < minimumGapMs
    ? 'minimum-gap'
    : null
}

async function runBackgroundSync(reason: string): Promise<void> {
  const now = Date.now()
  const coalesceCause = getBackgroundSyncCoalesceCause({
    inFlight: backgroundSyncInFlight,
    lastCompletedAt: lastBackgroundSyncCompletedAt,
    now,
  })
  if (coalesceCause) {
    logMatchHistoryDev('background trigger coalesced', {
      reason,
      cause: coalesceCause,
      elapsedMs: lastBackgroundSyncCompletedAt ? now - lastBackgroundSyncCompletedAt : null,
      minimumGapMs: BACKGROUND_SYNC_MIN_GAP_MS,
    })
    return
  }

  backgroundSyncInFlight = true
  const startedAt = Date.now()
  try {
    const lcuService = getLCUServiceInstance()
    const phase = await lcuService.getGameflowPhase()
    if (phase !== 'None' && phase !== 'Lobby') {
      logMatchHistoryDev('background trigger skipped for gameflow phase', { reason, phase })
      return
    }

    const service = getLocalMatchHistoryService(lcuService)
    const summary = await service.runBackgroundBatch()
    lastBackgroundSyncCompletedAt = Date.now()
    backgroundSyncUpdatedCallback?.(summary.updatedAt)
    logger.debug('[match-history] background batch completed', {
      reason,
      platformId: summary.overview.platformId,
      gameCount: summary.overview.gameCount,
      pendingUploadCount: summary.overview.pendingUploadCount,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    logger.debug('[match-history] background batch skipped:', {
      reason,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    })
  } finally {
    backgroundSyncInFlight = false
  }
}

/**
 * Runs only when `LocalMatchHistoryService` sees LCU in None/Lobby. It reads
 * SGP SUMMARY batches from index zero and stores new games in an idempotent outbox.
 */
export function startLocalMatchHistoryBackgroundSync(
  onUpdated?: (updatedAt: number) => void,
): void {
  backgroundSyncUpdatedCallback = onUpdated ?? null
  if (backgroundSyncTimer) {
    return
  }

  backgroundSyncStartTimer = setTimeout(() => {
    backgroundSyncStartTimer = null
    void runBackgroundSync('startup')
  }, BACKGROUND_SYNC_START_DELAY_MS)
  backgroundSyncTimer = setInterval(() => {
    void runBackgroundSync('interval')
  }, BACKGROUND_SYNC_INTERVAL_MS)
  logger.info('[match-history] background sync scheduled', {
    intervalMs: BACKGROUND_SYNC_INTERVAL_MS,
    startDelayMs: BACKGROUND_SYNC_START_DELAY_MS,
    minimumGapMs: BACKGROUND_SYNC_MIN_GAP_MS,
  })
}

/** Queue an immediate, still phase-gated batch after returning to Lobby/None. */
export function requestLocalMatchHistoryBackgroundSync(reason: string): void {
  if (!backgroundSyncTimer || backgroundSyncRequestTimer) {
    return
  }

  backgroundSyncRequestTimer = setTimeout(() => {
    backgroundSyncRequestTimer = null
    void runBackgroundSync(reason)
  }, 0)
}

export function stopLocalMatchHistoryBackgroundSync(): void {
  if (backgroundSyncRequestTimer) {
    clearTimeout(backgroundSyncRequestTimer)
    backgroundSyncRequestTimer = null
  }
  if (backgroundSyncStartTimer) {
    clearTimeout(backgroundSyncStartTimer)
    backgroundSyncStartTimer = null
  }
  if (backgroundSyncTimer) {
    clearInterval(backgroundSyncTimer)
    backgroundSyncTimer = null
  }
  lastBackgroundSyncCompletedAt = 0
  backgroundSyncUpdatedCallback = null
}
