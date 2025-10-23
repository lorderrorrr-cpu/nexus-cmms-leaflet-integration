"use client"

import React, { createContext, useContext, useCallback, useEffect, useState } from "react"

export interface OfflineFormData {
  id: string
  templateId: string
  ticketId?: string
  formData: Record<string, any>
  metadata: {
    createdAt: Date
    lastModified: Date
    deviceInfo: string
    userId: string
    version: number
  }
  syncStatus: "pending" | "syncing" | "synced" | "failed"
  syncAttempts: number
  lastSyncAttempt?: Date
  syncError?: string
}

export interface SyncQueueItem {
  id: string
  type: "create_submission" | "update_submission" | "upload_file"
  data: any
  priority: "low" | "medium" | "high"
  createdAt: Date
  retryCount: number
  maxRetries: number
  nextRetryAt?: Date
}

interface OfflineSyncContextType {
  // State
  isOnline: boolean
  isOfflineCapable: boolean
  offlineData: OfflineFormData[]
  syncQueue: SyncQueueItem[]
  syncProgress: {
    total: number
    completed: number
    failed: number
    inProgress: boolean
  }

  // Offline data management
  saveOfflineData: (templateId: string, formData: Record<string, any>, ticketId?: string) => Promise<string>
  getOfflineData: (templateId?: string) => OfflineFormData[]
  deleteOfflineData: (dataId: string) => Promise<void>
  clearOfflineData: () => Promise<void>

  // Sync management
  syncOfflineData: () => Promise<void>
  forceSync: () => Promise<void>
  retryFailedItems: () => Promise<void>
  clearSyncQueue: () => Promise<void>

  // Utilities
  getStorageStats: () => { used: number; available: number; total: number }
  cleanupOldData: (daysOld?: number) => Promise<void>
  exportOfflineData: () => Promise<string>
  importOfflineData: (data: string) => Promise<void>
}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null)

export const useOfflineSync = () => {
  const context = useContext(OfflineSyncContext)
  if (!context) {
    throw new Error("useOfflineSync must be used within an OfflineSyncProvider")
  }
  return context
}

interface OfflineSyncProviderProps {
  children: React.ReactNode
  syncEndpoint?: string
  autoSync?: boolean
  syncInterval?: number
  maxStorageSize?: number // in MB
}

export const OfflineSyncProvider: React.FC<OfflineSyncProviderProps> = ({
  children,
  syncEndpoint = "/api/forms/sync",
  autoSync = true,
  syncInterval = 30000, // 30 seconds
  maxStorageSize = 50 // 50MB
}) => {
  const [isOnline, setIsOnline] = useState(true)
  const [isOfflineCapable, setIsOfflineCapable] = useState(false)
  const [offlineData, setOfflineData] = useState<OfflineFormData[]>([])
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([])
  const [syncProgress, setSyncProgress] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false
  })

  // Check if browser supports required APIs
  useEffect(() => {
    const checkCapabilities = () => {
      const hasStorage = typeof localStorage !== "undefined"
      const hasIndexDB = "indexedDB" in window
      const hasServiceWorker = "serviceWorker" in navigator

      setIsOfflineCapable(hasStorage && (hasIndexDB || hasServiceWorker))
    }

    checkCapabilities()
  }, [])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Check initial status
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Auto-sync when online
  useEffect(() => {
    if (!autoSync || !isOnline || syncQueue.length === 0) return

    const interval = setInterval(() => {
      if (isOnline && syncQueue.length > 0) {
        syncOfflineData()
      }
    }, syncInterval)

    return () => clearInterval(interval)
  }, [autoSync, isOnline, syncQueue.length, syncInterval])

  // Storage key
  const STORAGE_KEYS = {
    OFFLINE_DATA: "nexus_forms_offline_data",
    SYNC_QUEUE: "nexus_forms_sync_queue",
    USER_PREFERENCES: "nexus_forms_user_preferences"
  }

  // Get storage stats
  const getStorageStats = useCallback((): { used: number; available: number; total: number } => {
    if (typeof localStorage === "undefined") {
      return { used: 0, available: maxStorageSize * 1024 * 1024, total: maxStorageSize * 1024 * 1024 }
    }

    let used = 0
    for (const key in localStorage) {
      if (key.startsWith("nexus_forms_")) {
        used += localStorage.getItem(key)?.length || 0
      }
    }

    const total = maxStorageSize * 1024 * 1024 // Convert MB to bytes
    const available = total - used

    return { used, available, total }
  }, [maxStorageSize])

  // Save offline data
  const saveOfflineData = useCallback(async (
    templateId: string,
    formData: Record<string, any>,
    ticketId?: string
  ): Promise<string> => {
    const dataId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const offlineFormData: OfflineFormData = {
      id: dataId,
      templateId,
      ticketId,
      formData,
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        deviceInfo: navigator.userAgent,
        userId: "current_user", // Would come from auth context
        version: 1
      },
      syncStatus: "pending",
      syncAttempts: 0
    }

    // Save to localStorage
    const existingData = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA) || "[]")
    const updatedData = [...existingData, offlineFormData]

    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(updatedData))
      setOfflineData(updatedData)

      // Add to sync queue
      const queueItem: SyncQueueItem = {
        id: `sync_${date.now()}`,
        type: ticketId ? "update_submission" : "create_submission",
        data: offlineFormData,
        priority: "medium",
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3
      }

      const existingQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || "[]")
      const updatedQueue = [...existingQueue, queueItem]
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(updatedQueue))
      setSyncQueue(updatedQueue)

      return dataId
    } catch (error) {
      console.error("Failed to save offline data:", error)
      throw new Error("Storage quota exceeded or storage not available")
    }
  }, [])

  // Get offline data
  const getOfflineData = useCallback((templateId?: string): OfflineFormData[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA)
      const allData: OfflineFormData[] = stored ? JSON.parse(stored) : []

      if (templateId) {
        return allData.filter(item => item.templateId === templateId)
      }

      return allData
    } catch (error) {
      console.error("Failed to get offline data:", error)
      return []
    }
  }, [])

  // Delete offline data
  const deleteOfflineData = useCallback(async (dataId: string): Promise<void> => {
    try {
      const existingData = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA) || "[]")
      const updatedData = existingData.filter((item: OfflineFormData) => item.id !== dataId)

      localStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(updatedData))
      setOfflineData(updatedData)

      // Remove from sync queue if pending
      const existingQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || "[]")
      const updatedQueue = existingQueue.filter((item: SyncQueueItem) =>
        !(item.type === "create_submission" && item.data.id === dataId)
      )

      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(updatedQueue))
      setSyncQueue(updatedQueue)
    } catch (error) {
      console.error("Failed to delete offline data:", error)
      throw error
    }
  }, [])

  // Clear all offline data
  const clearOfflineData = useCallback(async (): Promise<void> => {
    try {
      localStorage.removeItem(STORAGE_KEYS.OFFLINE_DATA)
      localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE)
      setOfflineData([])
      setSyncQueue([])
    } catch (error) {
      console.error("Failed to clear offline data:", error)
      throw error
    }
  }, [])

  // Sync offline data
  const syncOfflineData = useCallback(async (): Promise<void> => {
    if (!isOnline || syncQueue.length === 0) return

    setSyncProgress(prev => ({ ...prev, inProgress: true }))

    try {
      const queueToProcess = [...syncQueue]
      const processedItems: string[] = []
      let completed = 0
      let failed = 0

      for (const item of queueToProcess) {
        try {
          const response = await fetch(syncEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              type: item.type,
              data: item.data
            })
          })

          if (response.ok) {
            processedItems.push(item.id)
            completed++

            // Update offline data status
            if (item.type === "create_submission" || item.type === "update_submission") {
              const offlineItem = item.data as OfflineFormData
              offlineItem.syncStatus = "synced"
              offlineItem.lastSyncAttempt = new Date()

              const existingData = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA) || "[]")
              const updatedData = existingData.map((d: OfflineFormData) =>
                d.id === offlineItem.id ? offlineItem : d
              )
              localStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(updatedData))
            }
          } else {
            throw new Error(`Sync failed: ${response.statusText}`)
          }
        } catch (error) {
          console.error("Sync item failed:", error)
          failed++

          // Retry logic
          item.retryCount++
          if (item.retryCount < item.maxRetries) {
            item.nextRetryAt = new Date(Date.now() + Math.pow(2, item.retryCount) * 60000) // Exponential backoff
          } else {
            // Mark as failed
            if (item.type === "create_submission" || item.type === "update_submission") {
              const offlineItem = item.data as OfflineFormData
              offlineItem.syncStatus = "failed"
              offlineItem.syncError = error instanceof Error ? error.message : "Unknown error"
              offlineItem.lastSyncAttempt = new Date()

              const existingData = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA) || "[]")
              const updatedData = existingData.map((d: OfflineFormData) =>
                d.id === offlineItem.id ? offlineItem : d
              )
              localStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(updatedData))
            }
            processedItems.push(item.id)
          }
        }
      }

      // Update sync queue
      const remainingQueue = queueToProcess.filter(item => !processedItems.some(id => id === item.id))
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(remainingQueue))
      setSyncQueue(remainingQueue)

      // Update progress
      setSyncProgress({
        total: queueToProcess.length,
        completed,
        failed,
        inProgress: false
      })
    } catch (error) {
      console.error("Sync failed:", error)
      setSyncProgress(prev => ({ ...prev, inProgress: false }))
    }
  }, [isOnline, syncQueue, syncEndpoint])

  // Force sync (retry all items)
  const forceSync = useCallback(async (): Promise<void> => {
    const allOfflineData = getOfflineData()
    const pendingData = allOfflineData.filter(item => item.syncStatus !== "synced")

    // Add all pending items to sync queue
    const newQueueItems: SyncQueueItem[] = pendingData.map(item => ({
      id: `force_sync_${item.id}`,
      type: "create_submission" as const,
      data: item,
      priority: "high",
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 5
    }))

    const existingQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || "[]")
    const updatedQueue = [...newQueueItems, ...existingQueue]
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(updatedQueue))
    setSyncQueue(updatedQueue)

    await syncOfflineData()
  }, [getOfflineData, syncOfflineData])

  // Retry failed items
  const retryFailedItems = useCallback(async (): Promise<void> => {
    const failedData = offlineData.filter(item => item.syncStatus === "failed")

    // Reset sync status and add to queue
    const resetData = failedData.map(item => ({
      ...item,
      syncStatus: "pending" as const,
      syncAttempts: 0,
      syncError: undefined
    }))

    const existingData = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA) || "[]")
    const updatedData = existingData.map((item: OfflineFormData) => {
      const resetItem = resetData.find(ri => ri.id === item.id)
      return resetItem || item
    })
    localStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(updatedData))

    // Add to sync queue
    const newQueueItems: SyncQueueItem[] = resetData.map(item => ({
      id: `retry_${item.id}`,
      type: "create_submission" as const,
      data: item,
      priority: "high",
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    }))

    const existingQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || "[]")
    const updatedQueue = [...newQueueItems, ...existingQueue]
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(updatedQueue))
    setSyncQueue(updatedQueue)

    await syncOfflineData()
  }, [offlineData, syncOfflineData])

  // Clear sync queue
  const clearSyncQueue = useCallback(async (): Promise<void> => {
    try {
      localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE)
      setSyncQueue([])
      setSyncProgress({ total: 0, completed: 0, failed: 0, inProgress: false })
    } catch (error) {
      console.error("Failed to clear sync queue:", error)
      throw error
    }
  }, [])

  // Cleanup old data
  const cleanupOldData = useCallback(async (daysOld: number = 30): Promise<void> => {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

      // Clean offline data
      const existingData = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA) || "[]")
      const filteredData = existingData.filter((item: OfflineFormData) =>
        new Date(item.metadata.createdAt) > cutoffDate || item.syncStatus === "failed"
      )
      localStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(filteredData))

      // Clean sync queue
      const existingQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || "[]")
      const filteredQueue = existingQueue.filter((item: SyncQueueItem) =>
        new Date(item.createdAt) > cutoffDate
      )
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(filteredQueue))

      setOfflineData(filteredData)
      setSyncQueue(filteredQueue)
    } catch (error) {
      console.error("Failed to cleanup old data:", error)
      throw error
    }
  }, [])

  // Export offline data
  const exportOfflineData = useCallback(async (): Promise<string> => {
    try {
      const exportData = {
        offlineData,
        syncQueue,
        exportedAt: new Date().toISOString(),
        version: "1.0"
      }

      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      console.error("Failed to export offline data:", error)
      throw error
    }
  }, [offlineData, syncQueue])

  // Import offline data
  const importOfflineData = useCallback(async (data: string): Promise<void> => {
    try {
      const importData = JSON.parse(data)

      if (!importData.offlineData || !Array.isArray(importData.offlineData)) {
        throw new Error("Invalid import data format")
      }

      // Merge with existing data
      const existingData = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA) || "[]")
      const mergedData = [...existingData, ...importData.offlineData]

      localStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(mergedData))
      setOfflineData(mergedData)

      // Merge sync queue
      if (importData.syncQueue && Array.isArray(importData.syncQueue)) {
        const existingQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || "[]")
        const mergedQueue = [...existingQueue, ...importData.syncQueue]
        localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(mergedQueue))
        setSyncQueue(mergedQueue)
      }
    } catch (error) {
      console.error("Failed to import offline data:", error)
      throw error
    }
  }, [])

  // Load initial data
  useEffect(() => {
    const loadData = () => {
      try {
        const storedData = localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA)
        const storedQueue = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE)

        setOfflineData(storedData ? JSON.parse(storedData) : [])
        setSyncQueue(storedQueue ? JSON.parse(storedQueue) : [])
      } catch (error) {
        console.error("Failed to load offline data:", error)
        setOfflineData([])
        setSyncQueue([])
      }
    }

    loadData()
  }, [])

  const value = {
    isOnline,
    isOfflineCapable,
    offlineData,
    syncQueue,
    syncProgress,
    saveOfflineData,
    getOfflineData,
    deleteOfflineData,
    clearOfflineData,
    syncOfflineData,
    forceSync,
    retryFailedItems,
    clearSyncQueue,
    getStorageStats,
    cleanupOldData,
    exportOfflineData,
    importOfflineData
  }

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  )
}

export default OfflineSyncProvider