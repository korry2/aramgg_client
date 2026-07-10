import type { ElectronAPI } from '../../shared/ipc-contract.ts'

export function hasElectronAPI(): boolean
export function requireElectronAPI(): ElectronAPI
export const electronAPI: ElectronAPI
