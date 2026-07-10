import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { LooseRecord, Unsubscribe } from '../../shared/ipc-contract.ts'
import { electronAPI } from '../native/electron-api.js'
import { trackAnalyticsEvent } from '../services/analytics.ts'

interface StatusMessage {
  type: string
  message: string
}

interface PostGamePoster extends LooseRecord {
  status?: string
  result?: string
  stats?: {
    kills?: unknown
    deaths?: unknown
    assists?: unknown
    [key: string]: unknown
  }
  champion?: { id?: string | number; [key: string]: unknown }
  augments?: unknown[]
}

interface PosterRequestOptions {
  openOnReady?: boolean
  refresh?: boolean
  silent?: boolean
  analyticsTrigger?: string
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function hasPostGameStats(poster: PostGamePoster | null): boolean {
  const stats = poster?.stats
  if (!stats) return false

  return [stats.kills, stats.deaths, stats.assists].every((value) => {
    if (value == null || (typeof value === 'string' && !value.trim())) return false
    return Number.isFinite(Number(value))
  })
}

function asPoster(value: unknown): PostGamePoster | null {
  return value && typeof value === 'object' ? value as PostGamePoster : null
}

export function usePostGameShare(statusSink: Ref<StatusMessage | null>) {
  const showPostGameShare = ref(false)
  const postGamePoster = ref<PostGamePoster | null>(null)
  const postGameShareLoading = ref(false)
  let postGameShareTimer: ReturnType<typeof setTimeout> | null = null
  const subscriptions: Unsubscribe[] = []

  const shouldShowPostGameFloatingShare = computed(() => hasPostGameStats(postGamePoster.value))
  const postGameShareFloatingLabel = computed(() =>
    postGameShareLoading.value ? '生成中' : '分享战报')

  const getAnalyticsParams = (
    poster = postGamePoster.value,
    extra: Record<string, string | number | boolean | null | undefined> = {},
  ) => ({
    status: poster?.status || 'unknown',
    result: poster?.result || 'unknown',
    champion_id: poster?.champion?.id ?? null,
    augment_count: Array.isArray(poster?.augments) ? poster.augments.length : 0,
    has_stats: hasPostGameStats(poster),
    ...extra,
  })

  const trackShareEvent = (
    name: string,
    params: Record<string, string | number | boolean | null | undefined> = {},
  ) => {
    try {
      trackAnalyticsEvent(name, getAnalyticsParams(postGamePoster.value, params))
    } catch (error) {
      console.warn('Failed to track post-game share event:', error)
    }
  }

  const closePostGameShare = () => {
    showPostGameShare.value = false
  }

  const applyPostGamePoster = (value: unknown, openOnReady = true): boolean => {
    const poster = asPoster(value)
    if (!poster || poster.status === 'unavailable') return false

    const canSharePoster = hasPostGameStats(poster)
    postGamePoster.value = poster
    if (openOnReady && canSharePoster) {
      showPostGameShare.value = true
    }
    return canSharePoster
  }

  const requestPostGameSharePoster = async ({
    openOnReady = true,
    refresh = false,
    silent = false,
    analyticsTrigger = '',
  }: PosterRequestOptions = {}) => {
    if (postGameShareLoading.value) return

    postGameShareLoading.value = true
    try {
      const result = refresh
        ? await electronAPI.postGameShare.refresh()
        : await electronAPI.postGameShare.getLatest()

      if (applyPostGamePoster(result.data, openOnReady)) {
        if (openOnReady && analyticsTrigger) {
          trackShareEvent('post_game_share_modal_open', { trigger: analyticsTrigger })
        }
        return
      }

      if (!silent) {
        statusSink.value = {
          type: 'info',
          message: result.error
            ? `赛后海报暂不可用：${result.error}`
            : '暂未捕获到可分享的最近对局。',
        }
      }
    } catch (error) {
      console.warn('Failed to request post-game share poster:', error)
      if (!silent) {
        statusSink.value = {
          type: 'error',
          message: `生成赛后海报失败：${getErrorMessage(error)}`,
        }
      }
    } finally {
      postGameShareLoading.value = false
    }
  }

  const openPostGameShareFromFloatingButton = () => {
    trackShareEvent('post_game_share_button_click', { button: 'floating_share' })
    void requestPostGameSharePoster({ openOnReady: true, analyticsTrigger: 'floating_share' })
  }

  const createMockPostGameSharePoster = async () => {
    if (postGameShareLoading.value) return

    trackShareEvent('post_game_share_button_click', { button: 'mock_generate' })
    postGameShareLoading.value = true
    try {
      const result = await electronAPI.postGameShare.createMock()
      const poster = asPoster(result.data)
      if (applyPostGamePoster(poster, true)) {
        trackAnalyticsEvent('post_game_share_mock_success', getAnalyticsParams(poster, {
          trigger: 'mock_generate',
        }))
        return
      }
      throw new Error(result.error || '模拟海报生成失败')
    } catch (error) {
      console.warn('Failed to create mock post-game share poster:', error)
      trackShareEvent('post_game_share_mock_failure', {
        error_message: getErrorMessage(error),
      })
      statusSink.value = {
        type: 'error',
        message: `模拟生成失败：${getErrorMessage(error)}`,
      }
    } finally {
      postGameShareLoading.value = false
    }
  }

  const schedulePostGameSharePosterRequest = () => {
    if (postGameShareTimer) clearTimeout(postGameShareTimer)
    postGameShareTimer = setTimeout(() => {
      postGameShareTimer = null
      void requestPostGameSharePoster({ openOnReady: true, silent: true })
    }, 1200)
  }

  onMounted(() => {
    subscriptions.push(
      electronAPI.events.on('post-game-share-ready', (poster) => applyPostGamePoster(poster, true)),
      electronAPI.events.on('game-ended', schedulePostGameSharePosterRequest),
      electronAPI.events.on('end-of-game', schedulePostGameSharePosterRequest),
    )
    void requestPostGameSharePoster({ openOnReady: false, silent: true })
  })

  onBeforeUnmount(() => {
    if (postGameShareTimer) {
      clearTimeout(postGameShareTimer)
      postGameShareTimer = null
    }
    subscriptions.splice(0).forEach((unsubscribe) => unsubscribe())
  })

  return {
    showPostGameShare,
    postGamePoster,
    postGameShareLoading,
    shouldShowPostGameFloatingShare,
    postGameShareFloatingLabel,
    closePostGameShare,
    openPostGameShareFromFloatingButton,
    createMockPostGameSharePoster,
    requestPostGameSharePoster,
  }
}
