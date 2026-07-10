import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { AppUpdateState, ClientVersionInfo, Unsubscribe } from '../../shared/ipc-contract.ts'
import { electronAPI } from '../native/electron-api.js'

export function useAppUpdate(versionInfo: Ref<ClientVersionInfo | null>) {
  const appUpdateState = ref<AppUpdateState | null>(null)
  const updateActionPending = ref(false)
  let unsubscribe: Unsubscribe | null = null

  const manualUpdateDownloadUrl = computed(() =>
    appUpdateState.value?.manualDownloadUrl || versionInfo.value?.downloadUrl || '')
  const updatePhase = computed(() => appUpdateState.value?.phase || 'uninitialized')
  const updateDownloadDeferred = computed(() => Boolean(appUpdateState.value?.downloadDeferred))
  const updatePanelClass = computed(() => `phase-${updatePhase.value}`)
  const updateLatestVersion = computed(() =>
    appUpdateState.value?.latestVersion || versionInfo.value?.latestVersion || '')

  const updateTitle = computed(() => {
    const latestVersion = updateLatestVersion.value
    const versionSuffix = latestVersion ? ` v${String(latestVersion).replace(/^v/i, '')}` : ''

    switch (updatePhase.value) {
      case 'checking':
        return '正在检查'
      case 'available':
        return updateDownloadDeferred.value ? `等待下载${versionSuffix}` : `下载中${versionSuffix}`
      case 'downloading':
        return `下载中${versionSuffix}`
      case 'downloaded':
        return `已下载${versionSuffix}`
      case 'installing':
        return '正在安装'
      case 'not-available':
        return '已是最新'
      case 'no-feed':
        return manualUpdateDownloadUrl.value ? '手动下载' : '未配置更新源'
      case 'disabled':
        return '暂未支持自动更新'
      case 'error':
        return '更新异常'
      default:
        return versionInfo.value?.isNewer && latestVersion
          ? `可更新${versionSuffix}`
          : '自动更新'
    }
  })

  const updateIsChecking = computed(() => updatePhase.value === 'checking')
  const canCheckUpdate = computed(() =>
    Boolean(appUpdateState.value?.canCheck) && !updateActionPending.value)
  const canInstallUpdate = computed(() =>
    Boolean(appUpdateState.value?.canInstall) && !updateActionPending.value)
  const showCheckUpdateAction = computed(() =>
    !['downloaded', 'installing'].includes(updatePhase.value))
  const showInstallUpdateAction = computed(() =>
    ['downloaded', 'installing'].includes(updatePhase.value))
  const installUpdateTitle = computed(() =>
    updateActionPending.value || updatePhase.value === 'installing' ? '正在处理' : '重启安装')
  const showManualDownloadLink = computed(() =>
    Boolean(manualUpdateDownloadUrl.value) && !showInstallUpdateAction.value)
  const updateProgressPercent = computed(() => {
    const percent = Number(appUpdateState.value?.progress?.percent)
    return Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0
  })
  const updateProgressWidth = computed(() => `${updateProgressPercent.value}%`)
  const showUpdateProgress = computed(() =>
    updatePhase.value === 'downloading' || updatePhase.value === 'downloaded')

  const formatBytesPerSecond = (value: unknown) => {
    const bytesPerSecond = Number(value)
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
      return ''
    }
    return bytesPerSecond >= 1024 * 1024
      ? `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
      : `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`
  }

  const updateProgressText = computed(() => {
    const speed = formatBytesPerSecond(appUpdateState.value?.progress?.bytesPerSecond)
    return speed ? `${updateProgressPercent.value}% · ${speed}` : `${updateProgressPercent.value}%`
  })

  const applyResultState = (result: { data?: AppUpdateState }) => {
    if (result.data) {
      appUpdateState.value = result.data
    }
  }

  const loadAppUpdateState = async () => {
    try {
      const result = await electronAPI.appUpdate.getState()
      if (result.success) {
        applyResultState(result)
      }
    } catch (error) {
      console.warn('Failed to load app update state:', error)
    }
  }

  const checkAppUpdate = async () => {
    if (!canCheckUpdate.value) return
    updateActionPending.value = true
    try {
      applyResultState(await electronAPI.appUpdate.check())
    } catch (error) {
      console.warn('Failed to check app update:', error)
    } finally {
      updateActionPending.value = false
    }
  }

  const installAppUpdate = async () => {
    if (!canInstallUpdate.value) return
    updateActionPending.value = true
    try {
      const result = await electronAPI.appUpdate.install()
      applyResultState(result)
      if (!result.success) {
        throw new Error(result.error || '重启安装失败')
      }
    } catch (error) {
      updateActionPending.value = false
      console.warn('Failed to install app update:', error)
    }
  }

  onMounted(() => {
    void loadAppUpdateState()
    unsubscribe = electronAPI.events.on('app-update-status-changed', (state) => {
      appUpdateState.value = state
    })
  })

  onBeforeUnmount(() => {
    unsubscribe?.()
    unsubscribe = null
  })

  return {
    appUpdateState,
    manualUpdateDownloadUrl,
    updatePanelClass,
    updateTitle,
    updateIsChecking,
    canCheckUpdate,
    canInstallUpdate,
    showCheckUpdateAction,
    showInstallUpdateAction,
    installUpdateTitle,
    showManualDownloadLink,
    updateProgressWidth,
    showUpdateProgress,
    updateProgressText,
    loadAppUpdateState,
    checkAppUpdate,
    installAppUpdate,
  }
}
