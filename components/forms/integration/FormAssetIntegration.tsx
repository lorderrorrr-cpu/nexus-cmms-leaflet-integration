"use client"

import React, { createContext, useContext, useCallback, useEffect, useState } from "react"

export interface AssetCategoryForm {
  id: string
  assetCategoryId: string
  formTemplateId: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  settings: {
    autoFields: boolean
    requireAssetSelection: boolean
    allowMultipleAssets: boolean
    inheritAssetProperties: boolean
  }
}

export interface TicketFormIntegration {
  ticketId?: string
  formTemplateId: string
  autoCreateTicket: boolean
  syncFormData: boolean
  mapping: Record<string, string> // Maps form fields to ticket fields
}

interface FormAssetIntegrationContextType {
  // Asset category mappings
  assetFormMappings: AssetCategoryForm[]
  loadingMappings: boolean

  // Actions
  loadAssetFormMappings: () => Promise<void>
  createAssetFormMapping: (mapping: Omit<AssetCategoryForm, "id" | "createdAt" | "updatedAt">) => Promise<AssetCategoryForm>
  updateAssetFormMapping: (id: string, updates: Partial<AssetCategoryForm>) => Promise<AssetCategoryForm>
  deleteAssetFormMapping: (id: string) => Promise<void>
  setDefaultMapping: (assetCategoryId: string, formTemplateId: string) => Promise<void>

  // Form-asset operations
  getFormForAsset: (assetCategoryId: string) => AssetCategoryForm | null
  getAssetsForForm: (formTemplateId: string) => Promise<any[]>
  createTicketFromSubmission: (submissionId: string, mapping: TicketFormIntegration) => Promise<any>
  syncSubmissionToTicket: (submissionId: string, ticketId: string, mapping: TicketFormIntegration) => Promise<void>

  // Auto-generation utilities
  generateFormFromAsset: (asset: any, fieldType: 'pm' | 'cm' | 'safety') => Promise<any>
  generateFieldsFromAssetSpecs: (assetSpecs: any) => any[]
}

const FormAssetIntegrationContext = createContext<FormAssetIntegrationContextType | null>(null)

export const useFormAssetIntegration = () => {
  const context = useContext(FormAssetIntegrationContext)
  if (!context) {
    throw new Error("useFormAssetIntegration must be used within a FormAssetIntegrationProvider")
  }
  return context
}

interface FormAssetIntegrationProviderProps {
  children: React.ReactNode
}

export const FormAssetIntegrationProvider: React.FC<FormAssetIntegrationProviderProps> = ({
  children
}) => {
  const [assetFormMappings, setAssetFormMappings] = useState<AssetCategoryForm[]>([])
  const [loadingMappings, setLoadingMappings] = useState(false)

  // Load asset-form mappings
  const loadAssetFormMappings = useCallback(async (): Promise<void> => {
    setLoadingMappings(true)
    try {
      // In a real implementation, this would be an API call
      const response = await fetch('/api/forms/asset-mappings')
      const data = await response.json()

      setAssetFormMappings(data.mappings || [])
    } catch (error) {
      console.error("Failed to load asset-form mappings:", error)
      setAssetFormMappings([])
    } finally {
      setLoadingMappings(false)
    }
  }, [])

  // Create new asset-form mapping
  const createAssetFormMapping = useCallback(async (
    mappingData: Omit<AssetCategoryForm, "id" | "createdAt" | "updatedAt">
  ): Promise<AssetCategoryForm> => {
    try {
      const response = await fetch('/api/forms/asset-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mappingData)
      })

      if (!response.ok) {
        throw new Error('Failed to create asset-form mapping')
      }

      const newMapping = await response.json()

      // Update local state
      setAssetFormMappings(prev => [...prev, newMapping])

      return newMapping
    } catch (error) {
      console.error("Failed to create asset-form mapping:", error)
      throw error
    }
  }, [])

  // Update asset-form mapping
  const updateAssetFormMapping = useCallback(async (
    id: string,
    updates: Partial<AssetCategoryForm>
  ): Promise<AssetCategoryForm> => {
    try {
      const response = await fetch(`/api/forms/asset-mappings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update asset-form mapping')
      }

      const updatedMapping = await response.json()

      // Update local state
      setAssetFormMappings(prev =>
        prev.map(mapping => mapping.id === id ? { ...mapping, ...updatedMapping } : mapping)
      )

      return updatedMapping
    } catch (error) {
      console.error("Failed to update asset-form mapping:", error)
      throw error
    }
  }, [])

  // Delete asset-form mapping
  const deleteAssetFormMapping = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/forms/asset-mappings/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete asset-form mapping')
      }

      // Update local state
      setAssetFormMappings(prev => prev.filter(mapping => mapping.id !== id))
    } catch (error) {
      console.error("Failed to delete asset-form mapping:", error)
      throw error
    }
  }, [])

  // Set default mapping for asset category
  const setDefaultMapping = useCallback(async (
    assetCategoryId: string,
    formTemplateId: string
  ): Promise<void> => {
    try {
      // First, unset any existing default for this asset category
      await Promise.all(
        assetFormMappings
          .filter(m => m.assetCategoryId === assetCategoryId && m.isDefault)
          .map(m => updateAssetFormMapping(m.id, { isDefault: false }))
      )

      // Then set the new default
      const existingMapping = assetFormMappings.find(
        m => m.assetCategoryId === assetCategoryId && m.formTemplateId === formTemplateId
      )

      if (existingMapping) {
        await updateAssetFormMapping(existingMapping.id, { isDefault: true })
      } else {
        await createAssetFormMapping({
          assetCategoryId,
          formTemplateId,
          isDefault: true,
          isActive: true,
          settings: {
            autoFields: true,
            requireAssetSelection: true,
            allowMultipleAssets: false,
            inheritAssetProperties: true
          }
        })
      }
    } catch (error) {
      console.error("Failed to set default mapping:", error)
      throw error
    }
  }, [assetFormMappings, createAssetFormMapping, updateAssetFormMapping])

  // Get form for asset category
  const getFormForAsset = useCallback((assetCategoryId: string): AssetCategoryForm | null => {
    return assetFormMappings.find(m => m.assetCategoryId === assetCategoryId && m.isActive) || null
  }, [assetFormMappings])

  // Get assets for form template
  const getAssetsForForm = useCallback(async (formTemplateId: string): Promise<any[]> => {
    try {
      const response = await fetch(`/api/forms/templates/${formTemplateId}/assets`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets for form')
      }

      const data = await response.json()
      return data.assets || []
    } catch (error) {
      console.error("Failed to get assets for form:", error)
      return []
    }
  }, [])

  // Create ticket from form submission
  const createTicketFromSubmission = useCallback(async (
    submissionId: string,
    mapping: TicketFormIntegration
  ): Promise<any> => {
    try {
      const response = await fetch('/api/forms/submissions/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionId,
          ...mapping
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create ticket from submission')
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to create ticket from submission:", error)
      throw error
    }
  }, [])

  // Sync submission data to existing ticket
  const syncSubmissionToTicket = useCallback(async (
    submissionId: string,
    ticketId: string,
    mapping: TicketFormIntegration
  ): Promise<void> => {
    try {
      const response = await fetch(`/api/forms/submissions/${submissionId}/sync-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticketId,
          mapping
        })
      })

      if (!response.ok) {
        throw new Error('Failed to sync submission to ticket')
      }
    } catch (error) {
      console.error("Failed to sync submission to ticket:", error)
      throw error
    }
  }, [])

  // Generate form from asset specifications
  const generateFormFromAsset = useCallback(async (
    asset: any,
    fieldType: 'pm' | 'cm' | 'safety'
  ): Promise<any> => {
    try {
      const response = await fetch('/api/forms/generate-from-asset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          asset,
          fieldType
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate form from asset')
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to generate form from asset:", error)
      throw error
    }
  }, [])

  // Generate form fields from asset specifications
  const generateFieldsFromAssetSpecs = useCallback((assetSpecs: any): any[] => {
    const fields: any[] = []

    // Asset identification fields
    if (assetSpecs.assetTag) {
      fields.push({
        id: 'asset_tag',
        type: 'text',
        label: 'Asset Tag',
        required: true,
        readonly: true,
        defaultValue: assetSpecs.assetTag,
        width: 'half'
      })
    }

    if (assetSpecs.name) {
      fields.push({
        id: 'asset_name',
        type: 'text',
        label: 'Asset Name',
        required: true,
        readonly: true,
        defaultValue: assetSpecs.name,
        width: 'half'
      })
    }

    // Brand and model
    if (assetSpecs.brand || assetSpecs.model) {
      fields.push({
        id: 'asset_info',
        type: 'text',
        label: 'Brand / Model',
        required: false,
        readonly: true,
        defaultValue: `${assetSpecs.brand || ''} ${assetSpecs.model || ''}`.trim(),
        width: 'full'
      })
    }

    // Serial number
    if (assetSpecs.serialNumber) {
      fields.push({
        id: 'serial_number',
        type: 'text',
        label: 'Serial Number',
        required: false,
        readonly: true,
        defaultValue: assetSpecs.serialNumber,
        width: 'full'
      })
    }

    // Location verification (always required)
    fields.push({
      id: 'location_verification',
      type: 'gps',
      label: 'Location Verification',
      required: true,
      width: 'full'
    })

    // Photo evidence
    fields.push({
      id: 'before_photo',
      type: 'photo',
      label: 'Before Photo',
      required: true,
      maxFiles: 3,
      width: 'full'
    })

    // Condition assessment
    fields.push({
      id: 'overall_condition',
      type: 'select',
      label: 'Overall Condition',
      required: true,
      options: [
        { label: 'Excellent', value: 'excellent' },
        { label: 'Good', value: 'good' },
        { label: 'Fair', value: 'fair' },
        { label: 'Poor', value: 'poor' },
        { label: 'Critical', value: 'critical' }
      ],
      width: 'half'
    })

    // Health score
    fields.push({
      id: 'health_score',
      type: 'number',
      label: 'Health Score (0-100)',
      required: true,
      min: 0,
      max: 100,
      defaultValue: 100,
      width: 'half'
    })

    // Technical specifications based on asset type
    if (assetSpecs.voltage) {
      fields.push({
        id: 'voltage_check',
        type: 'number',
        label: 'Input Voltage (V)',
        required: false,
        unit: 'V',
        defaultValue: assetSpecs.voltage,
        width: 'third'
      })
    }

    if (assetSpecs.capacity) {
      fields.push({
        id: 'capacity_check',
        type: 'text',
        label: 'Capacity Check',
        required: false,
        defaultValue: assetSpecs.capacity,
        width: 'third'
      })
    }

    // Operational status
    fields.push({
      id: 'operational_status',
      type: 'radio',
      label: 'Operational Status',
      required: true,
      options: [
        { label: 'Fully Operational', value: 'operational' },
        { label: 'Partially Operational', value: 'partial' },
        { label: 'Not Operational', value: 'down' },
        { Label: 'Needs Maintenance', value: 'maintenance' }
      ],
      defaultValue: 'operational',
      width: 'full'
    })

    // Work performed
    fields.push({
      id: 'work_performed',
      type: 'textarea',
      label: 'Work Performed',
      required: true,
      rows: 4,
      width: 'full'
    })

    // Issues found
    fields.push({
      id: 'issues_found',
      type: 'textarea',
      label: 'Issues Found',
      required: false,
      rows: 4,
      width: 'full'
    })

    // Recommendations
    fields.push({
      id: 'recommendations',
      type: 'textarea',
      label: 'Recommendations',
      required: false,
      rows: 4,
      width: 'full'
    })

    // After photo
    fields.push({
      id: 'after_photo',
      type: 'photo',
      label: 'After Photo',
      required: true,
      maxFiles: 3,
      width: 'full'
    })

    // Technician signature
    fields.push({
      id: 'technician_signature',
      type: 'signature',
      label: 'Technician Signature',
      required: true,
      width: 'full'
    })

    return fields
  }, [])

  // Load initial data
  useEffect(() => {
    loadAssetFormMappings()
  }, [loadAssetFormMappings])

  const value = {
    assetFormMappings,
    loadingMappings,
    loadAssetFormMappings,
    createAssetFormMapping,
    updateAssetFormMapping,
    deleteAssetFormMapping,
    setDefaultMapping,
    getFormForAsset,
    getAssetsForForm,
    createTicketFromSubmission,
    syncSubmissionToTicket,
    generateFormFromAsset,
    generateFieldsFromAssetSpecs
  }

  return (
    <FormAssetIntegrationContext.Provider value={value}>
      {children}
    </FormAssetIntegrationContext.Provider>
  )
}

export default FormAssetIntegrationProvider