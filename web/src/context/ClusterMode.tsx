import { createContext, useContext } from 'react'

export type ClusterMode = 'simple' | 'full'

export const ClusterModeContext = createContext<ClusterMode>('full')

export const useClusterMode = () => useContext(ClusterModeContext)
