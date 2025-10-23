"use client"

import React, { createContext, useContext, useCallback, useState } from "react"

export interface FormVersion {
  id: string
  templateId: string
  version: number
  name: string
  description?: string
  schema: any
  changeDescription: string
  changeType: "created" | "updated" | "field_added" | "field_removed" | "field_modified" | "settings_changed"
  createdBy: string
  createdAt: Date
  isActive: boolean
  isPublished: boolean
  metadata: {
    fieldCount: number
    requiredFields: number
    estimatedDuration: number
    lastModified: Date
  }
}

export interface FormDiff {
  fieldId: string
  fieldName: string
  changeType: "added" | "removed" | "modified" | "moved"
  oldValue?: any
  newValue?: any
  oldIndex?: number
  newIndex?: number
  changedProperties?: string[]
}

interface FormVersioningContextType {
  // Version management
  versions: FormVersion[]
  currentVersion: FormVersion | null
  loading: boolean

  // Actions
  createVersion: (templateId: string, schema: any, changeData: Partial<FormVersion>) => Promise<FormVersion>
  activateVersion: (versionId: string) => Promise<void>
  publishVersion: (versionId: string) => Promise<void>
  deleteVersion: (versionId: string) => Promise<void>
  loadVersions: (templateId: string) => Promise<void>

  // Version comparison
  compareVersions: (version1Id: string, version2Id: string) => FormDiff[]
  getChangesSince: (fromVersionId: string) => FormDiff[]

  // Utilities
  getVersionNumber: (templateId: string) => Promise<number>
  rollbackToVersion: (versionId: string) => Promise<void>
  duplicateVersion: (versionId: string, newName: string) => Promise<FormVersion>
}

const FormVersioningContext = createContext<FormVersioningContextType | null>(null)

export const useFormVersioning = () => {
  const context = useContext(FormVersioningContext)
  if (!context) {
    throw new Error("useFormVersioning must be used within a FormVersioningProvider")
  }
  return context
}

interface FormVersioningProviderProps {
  children: React.ReactNode
  templateId?: string
}

export const FormVersioningProvider: React.FC<FormVersioningProviderProps> = ({
  children,
  templateId
}) => {
  const [versions, setVersions] = useState<FormVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState<FormVersion | null>(null)
  const [loading, setLoading] = useState(false)

  // Load versions for a template
  const loadVersions = useCallback(async (templateIdToLoad: string) => {
    setLoading(true)
    try {
      // In a real implementation, this would be an API call
      const response = await fetch(`/api/forms/templates/${templateIdToLoad}/versions`)
      const data = await response.json()

      setVersions(data.versions || [])

      // Set the active version as current
      const activeVersion = data.versions?.find((v: FormVersion) => v.isActive)
      setCurrentVersion(activeVersion || null)
    } catch (error) {
      console.error("Failed to load form versions:", error)
      setVersions([])
      setCurrentVersion(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Create a new version
  const createVersion = useCallback(async (
    templateIdToCreate: string,
    schema: any,
    changeData: Partial<FormVersion>
  ): Promise<FormVersion> => {
    setLoading(true)
    try {
      // Get the next version number
      const nextVersion = await getVersionNumber(templateIdToCreate)

      const newVersion: FormVersion = {
        id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        templateId: templateIdToCreate,
        version: nextVersion,
        name: changeData.name || `Version ${nextVersion}`,
        description: changeData.description || "",
        schema,
        changeDescription: changeData.changeDescription || "Updated form",
        changeType: changeData.changeType || "updated",
        createdBy: "current_user", // Would come from auth context
        createdAt: new Date(),
        isActive: false, // Will be activated when ready
        isPublished: false,
        metadata: {
          fieldCount: schema.fields?.length || 0,
          requiredFields: schema.fields?.filter((f: any) => f.required)?.length || 0,
          estimatedDuration: schema.settings?.estimatedDurationMinutes || 0,
          lastModified: new Date()
        }
      }

      // In a real implementation, this would be an API call
      const response = await fetch(`/api/forms/templates/${templateIdToCreate}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newVersion)
      })

      if (!response.ok) {
        throw new Error("Failed to create version")
      }

      const savedVersion = await response.json()

      // Update local state
      setVersions(prev => [...prev, savedVersion])

      return savedVersion
    } catch (error) {
      console.error("Failed to create form version:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Get the next version number for a template
  const getVersionNumber = useCallback(async (templateIdForVersion: string): Promise<number> => {
    try {
      // In a real implementation, this would be an API call
      const response = await fetch(`/api/forms/templates/${templateIdForVersion}/next-version`)
      const data = await response.json()
      return data.versionNumber || 1
    } catch (error) {
      console.error("Failed to get version number:", error)
      // Fallback to local calculation
      const maxVersion = Math.max(...versions.map(v => v.version), 0)
      return maxVersion + 1
    }
  }, [versions])

  // Activate a version (make it the current active version)
  const activateVersion = useCallback(async (versionId: string) => {
    setLoading(true)
    try {
      // In a real implementation, this would be an API call
      const response = await fetch(`/api/forms/versions/${versionId}/activate`, {
        method: "POST"
      })

      if (!response.ok) {
        throw new Error("Failed to activate version")
      }

      // Update local state
      setVersions(prev => prev.map(v => ({
        ...v,
        isActive: v.id === versionId
      })))

      const activatedVersion = versions.find(v => v.id === versionId)
      setCurrentVersion(activatedVersion || null)
    } catch (error) {
      console.error("Failed to activate version:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [versions])

  // Publish a version
  const publishVersion = useCallback(async (versionId: string) => {
    setLoading(true)
    try {
      // In a real implementation, this would be an API call
      const response = await fetch(`/api/forms/versions/${versionId}/publish`, {
        method: "POST"
      })

      if (!response.ok) {
        throw new Error("Failed to publish version")
      }

      // Update local state
      setVersions(prev => prev.map(v => ({
        ...v,
        isPublished: v.id === versionId ? true : v.isPublished
      })))
    } catch (error) {
      console.error("Failed to publish version:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Delete a version
  const deleteVersion = useCallback(async (versionId: string) => {
    setLoading(true)
    try {
      // In a real implementation, this would be an API call
      const response = await fetch(`/api/forms/versions/${versionId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        throw new Error("Failed to delete version")
      }

      // Update local state
      setVersions(prev => prev.filter(v => v.id !== versionId))

      if (currentVersion?.id === versionId) {
        setCurrentVersion(null)
      }
    } catch (error) {
      console.error("Failed to delete version:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [currentVersion])

  // Compare two versions
  const compareVersions = useCallback((version1Id: string, version2Id: string): FormDiff[] => {
    const version1 = versions.find(v => v.id === version1Id)
    const version2 = versions.find(v => v.id === version2Id)

    if (!version1 || !version2) {
      return []
    }

    const diffs: FormDiff[] = []
    const schema1 = version1.schema
    const schema2 = version2.schema

    // Compare fields
    const fields1 = schema1.fields || []
    const fields2 = schema2.fields || []

    // Find added fields
    fields2.forEach((field2: any, index2: number) => {
      const field1 = fields1.find((f: any) => f.id === field2.id)
      if (!field1) {
        diffs.push({
          fieldId: field2.id,
          fieldName: field2.label || field2.id,
          changeType: "added",
          newValue: field2,
          newIndex: index2
        })
      }
    })

    // Find removed fields
    fields1.forEach((field1: any, index1: number) => {
      const field2 = fields2.find((f: any) => f.id === field1.id)
      if (!field2) {
        diffs.push({
          fieldId: field1.id,
          fieldName: field1.label || field1.id,
          changeType: "removed",
          oldValue: field1,
          oldIndex: index1
        })
      }
    })

    // Find modified fields
    fields2.forEach((field2: any, index2: number) => {
      const field1 = fields1.find((f: any) => f.id === field2.id)
      if (field1) {
        const index1 = fields1.findIndex((f: any) => f.id === field2.id)
        const changedProperties = []

        // Compare field properties
        const propertiesToCompare = ["label", "type", "required", "placeholder", "description", "options", "validation"]

        for (const prop of propertiesToCompare) {
          if (JSON.stringify(field1[prop]) !== JSON.stringify(field2[prop])) {
            changedProperties.push(prop)
          }
        }

        if (changedProperties.length > 0 || index1 !== index2) {
          diffs.push({
            fieldId: field2.id,
            fieldName: field2.label || field2.id,
            changeType: "modified",
            oldValue: field1,
            newValue: field2,
            oldIndex: index1,
            newIndex: index2,
            changedProperties
          })
        }
      }
    })

    return diffs
  }, [versions])

  // Get changes since a specific version
  const getChangesSince = useCallback((fromVersionId: string): FormDiff[] => {
    if (!currentVersion) {
      return []
    }

    return compareVersions(fromVersionId, currentVersion.id)
  }, [currentVersion, compareVersions])

  // Rollback to a specific version
  const rollbackToVersion = useCallback(async (versionId: string) => {
    const targetVersion = versions.find(v => v.id === versionId)
    if (!targetVersion) {
      throw new Error("Version not found")
    }

    try {
      // Create a new version based on the target version
      const newVersion = await createVersion(
        targetVersion.templateId,
        targetVersion.schema,
        {
          name: `Rollback to v${targetVersion.version}`,
          description: `Rollback form to version ${targetVersion.version}`,
          changeType: "updated",
          changeDescription: `Rollback to version ${targetVersion.version}`
        }
      )

      // Activate the new version
      await activateVersion(newVersion.id)
    } catch (error) {
      console.error("Failed to rollback to version:", error)
      throw error
    }
  }, [versions, createVersion, activateVersion])

  // Duplicate a version
  const duplicateVersion = useCallback(async (versionId: string, newName: string): Promise<FormVersion> => {
    const sourceVersion = versions.find(v => v.id === versionId)
    if (!sourceVersion) {
      throw new Error("Version not found")
    }

    return await createVersion(
      sourceVersion.templateId,
      sourceVersion.schema,
      {
        name: newName,
        description: `Duplicate of ${sourceVersion.name}`,
        changeType: "created",
        changeDescription: `Duplicated from version ${sourceVersion.version}`
      }
    )
  }, [versions, createVersion])

  const value = {
    versions,
    currentVersion,
    loading,
    createVersion,
    activateVersion,
    publishVersion,
    deleteVersion,
    loadVersions,
    compareVersions,
    getChangesSince,
    getVersionNumber,
    rollbackToVersion,
    duplicateVersion
  }

  return (
    <FormVersioningContext.Provider value={value}>
      {children}
    </FormVersioningContext.Provider>
  )
}

export default FormVersioningProvider