"use client"

import React, { createContext, useContext, useCallback, useMemo } from "react"
import { z, ZodSchema, ZodError } from "zod"

export interface ValidationRule {
  type: "required" | "minLength" | "maxLength" | "min" | "max" | "pattern" | "custom"
  value?: any
  message?: string
  validator?: (value: any) => boolean | string
}

export interface FieldValidation {
  fieldId: string
  fieldName: string
  rules: ValidationRule[]
  isValid: boolean
  errors: string[]
  warnings: string[]
  isTouched: boolean
  isDirty: boolean
}

export interface FormValidationState {
  fields: Record<string, FieldValidation>
  isValid: boolean
  errors: string[]
  warnings: string[]
  isSubmitting: boolean
  submittedAt?: Date
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  fieldResults: Record<string, {
    isValid: boolean
    errors: string[]
    warnings: string[]
  }>
}

interface FormValidationContextType {
  // State
  validationState: FormValidationState

  // Actions
  validateField: (fieldId: string, value: any, rules: ValidationRule[]) => FieldValidation
  validateForm: (formData: Record<string, any>, schema?: Record<string, ValidationRule[]>) => ValidationResult
  clearFieldErrors: (fieldId: string) => void
  clearAllErrors: () => void
  markFieldTouched: (fieldId: string) => void
  markFieldDirty: (fieldId: string) => void
  setSubmitting: (isSubmitting: boolean) => void

  // Utilities
  createValidationSchema: (fieldRules: Record<string, ValidationRule[]>) => ZodSchema
  getFieldValidation: (fieldId: string) => FieldValidation | null
  hasErrors: () => boolean
  hasWarnings: () => boolean
  getErrorCount: () => number
  getWarningCount: () => number
}

const FormValidationContext = createContext<FormValidationContextType | null>(null)

export const useFormValidation = () => {
  const context = useContext(FormValidationContext)
  if (!context) {
    throw new Error("useFormValidation must be used within a FormValidationProvider")
  }
  return context
}

interface FormValidationProviderProps {
  children: React.ReactNode
  initialSchema?: Record<string, ValidationRule[]>
  onSubmit?: (data: Record<string, any>) => void | Promise<void>
}

export const FormValidationProvider: React.FC<FormValidationProviderProps> = ({
  children,
  initialSchema = {},
  onSubmit
}) => {
  const [validationState, setValidationState] = React.useState<FormValidationState>({
    fields: {},
    isValid: true,
    errors: [],
    warnings: [],
    isSubmitting: false
  })

  // Create Zod schema from validation rules
  const createValidationSchema = useCallback((fieldRules: Record<string, ValidationRule[]>): ZodSchema => {
    const schemaFields: Record<string, z.ZodTypeAny> = {}

    Object.entries(fieldRules).forEach(([fieldId, rules]) => {
      let fieldSchema: z.ZodTypeAny = z.any()

      // Apply validation rules in order
      rules.forEach(rule => {
        switch (rule.type) {
          case "required":
            fieldSchema = z.string().min(1, rule.message || "This field is required")
            break
          case "minLength":
            fieldSchema = z.string().min(rule.value || 1, rule.message || `Minimum ${rule.value} characters required`)
            break
          case "maxLength":
            fieldSchema = z.string().max(rule.value || 255, rule.message || `Maximum ${rule.value} characters allowed`)
            break
          case "min":
            fieldSchema = z.number().min(rule.value || 0, rule.message || `Minimum value is ${rule.value}`)
            break
          case "max":
            fieldSchema = z.number().max(rule.value || 100, rule.message || `Maximum value is ${rule.value}`)
            break
          case "pattern":
            fieldSchema = z.string().regex(new RegExp(rule.value), rule.message || "Invalid format")
            break
          case "custom":
            if (rule.validator) {
              fieldSchema = z.any().refine(
                (value) => {
                  const result = rule.validator!(value)
                  if (typeof result === "boolean") {
                    return result
                  }
                  return false // Custom validators return false for validation, with message in errors
                },
                rule.message || "Validation failed"
              )
            }
            break
        }
      })

      schemaFields[fieldId] = fieldSchema.optional()
    })

    return z.object(schemaFields)
  }, [])

  // Validate a single field
  const validateField = useCallback((
    fieldId: string,
    value: any,
    rules: ValidationRule[]
  ): FieldValidation => {
    const errors: string[] = []
    const warnings: string[] = []

    // Apply each validation rule
    rules.forEach(rule => {
      let isValid = true
      let message = ""

      switch (rule.type) {
        case "required":
          isValid = value !== undefined && value !== null && value !== "" &&
                   (!Array.isArray(value) || value.length > 0)
          if (!isValid) message = rule.message || "This field is required"
          break

        case "minLength":
          if (typeof value === "string") {
            isValid = value.length >= (rule.value || 1)
            if (!isValid) message = rule.message || `Minimum ${rule.value || 1} characters required`
          }
          break

        case "maxLength":
          if (typeof value === "string") {
            isValid = value.length <= (rule.value || 255)
            if (!isValid) message = rule.message || `Maximum ${rule.value || 255} characters allowed`
          }
          break

        case "min":
          if (typeof value === "number") {
            isValid = value >= (rule.value || 0)
            if (!isValid) message = rule.message || `Minimum value is ${rule.value || 0}`
          }
          break

        case "max":
          if (typeof value === "number") {
            isValid = value <= (rule.value || 100)
            if (!isValid) message = rule.message || `Maximum value is ${rule.value || 100}`
          }
          break

        case "pattern":
          if (typeof value === "string") {
            const regex = new RegExp(rule.value || "")
            isValid = regex.test(value)
            if (!isValid) message = rule.message || "Invalid format"
          }
          break

        case "custom":
          if (rule.validator) {
            const result = rule.validator(value)
            if (typeof result === "boolean") {
              isValid = result
            } else {
              isValid = false
              message = result
            }
          }
          break
      }

      if (!isValid && message) {
        if (rule.type === "required") {
          errors.push(message)
        } else {
          warnings.push(message)
        }
      }
    })

    const fieldValidation: FieldValidation = {
      fieldId,
      fieldName: fieldId, // Would be populated from field config
      rules,
      isValid: errors.length === 0,
      errors,
      warnings,
      isTouched: validationState.fields[fieldId]?.isTouched || false,
      isDirty: validationState.fields[fieldId]?.isDirty || false
    }

    // Update state
    setValidationState(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldId]: fieldValidation
      }
    }))

    return fieldValidation
  }, [validationState.fields])

  // Validate entire form
  const validateForm = useCallback((
    formData: Record<string, any>,
    schema: Record<string, ValidationRule[]> = {}
  ): ValidationResult => {
    const fieldResults: Record<string, { isValid: boolean; errors: string[]; warnings: string[] }> = {}
    const allErrors: string[] = []
    const allWarnings: string[] = []

    // Validate each field
    Object.entries(schema).forEach(([fieldId, rules]) => {
      const value = formData[fieldId]
      const fieldValidation = validateField(fieldId, value, rules)

      fieldResults[fieldId] = {
        isValid: fieldValidation.isValid,
        errors: fieldValidation.errors,
        warnings: fieldValidation.warnings
      }

      allErrors.push(...fieldValidation.errors)
      allWarnings.push(...fieldValidation.warnings)
    })

    const isValid = allErrors.length === 0

    // Update global state
    setValidationState(prev => ({
      ...prev,
      isValid,
      errors: allErrors,
      warnings: allWarnings,
      submittedAt: new Date()
    }))

    return {
      isValid,
      errors: allErrors,
      warnings: allWarnings,
      fieldResults
    }
  }, [validateField])

  // Clear field errors
  const clearFieldErrors = useCallback((fieldId: string) => {
    setValidationState(prev => {
      const field = prev.fields[fieldId]
      if (!field) return prev

      const updatedField = {
        ...field,
        isValid: true,
        errors: [],
        warnings: []
      }

      return {
        ...prev,
        fields: {
          ...prev.fields,
          [fieldId]: updatedField
        }
      }
    })
  }, [])

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setValidationState(prev => ({
      ...prev,
      fields: Object.entries(prev.fields).reduce((acc, [fieldId, field]) => {
        acc[fieldId] = {
          ...field,
          isValid: true,
          errors: [],
          warnings: []
        }
        return acc
      }, {} as Record<string, FieldValidation>),
      isValid: true,
      errors: [],
      warnings: []
    }))
  }, [])

  // Mark field as touched
  const markFieldTouched = useCallback((fieldId: string) => {
    setValidationState(prev => {
      const field = prev.fields[fieldId]
      if (!field) return prev

      return {
        ...prev,
        fields: {
          ...prev.fields,
          [fieldId]: {
            ...field,
            isTouched: true
          }
        }
      }
    })
  }, [])

  // Mark field as dirty
  const markFieldDirty = useCallback((fieldId: string) => {
    setValidationState(prev => {
      const field = prev.fields[fieldId]
      if (!field) return prev

      return {
        ...prev,
        fields: {
          ...prev.fields,
          [fieldId]: {
            ...field,
            isDirty: true
          }
        }
      }
    })
  }, [])

  // Set submitting state
  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setValidationState(prev => ({
      ...prev,
      isSubmitting
    }))
  }, [])

  // Get field validation
  const getFieldValidation = useCallback((fieldId: string): FieldValidation | null => {
    return validationState.fields[fieldId] || null
  }, [validationState.fields])

  // Check if form has errors
  const hasErrors = useCallback((): boolean => {
    return validationState.errors.length > 0
  }, [validationState.errors])

  // Check if form has warnings
  const hasWarnings = useCallback((): boolean => {
    return validationState.warnings.length > 0
  }, [validationState.warnings])

  // Get error count
  const getErrorCount = useCallback((): number => {
    return validationState.errors.length
  }, [validationState.errors])

  // Get warning count
  const getWarningCount = useCallback((): number => {
    return validationState.warnings.length
  }, [validationState.warnings])

  const value = useMemo(() => ({
    validationState,
    validateField,
    validateForm,
    clearFieldErrors,
    clearAllErrors,
    markFieldTouched,
    markFieldDirty,
    setSubmitting,
    createValidationSchema,
    getFieldValidation,
    hasErrors,
    hasWarnings,
    getErrorCount,
    getWarningCount
  }), [
    validationState,
    validateField,
    validateForm,
    clearFieldErrors,
    clearAllErrors,
    markFieldTouched,
    markFieldDirty,
    setSubmitting,
    createValidationSchema,
    getFieldValidation,
    hasErrors,
    hasWarnings,
    getErrorCount,
    getWarningCount
  ])

  return (
    <FormValidationContext.Provider value={value}>
      {children}
    </FormValidationContext.Provider>
  )
}

// Predefined validation rule creators
export const ValidationRules = {
  required: (message?: string): ValidationRule => ({
    type: "required",
    message
  }),

  minLength: (length: number, message?: string): ValidationRule => ({
    type: "minLength",
    value: length,
    message: message || `Minimum ${length} characters required`
  }),

  maxLength: (length: number, message?: string): ValidationRule => ({
    type: "maxLength",
    value: length,
    message: message || `Maximum ${length} characters allowed`
  }),

  min: (value: number, message?: string): ValidationRule => ({
    type: "min",
    value,
    message: message || `Minimum value is ${value}`
  }),

  max: (value: number, message?: string): ValidationRule => ({
    type: "max",
    value,
    message: message || `Maximum value is ${value}`
  }),

  pattern: (regex: string, message?: string): ValidationRule => ({
    type: "pattern",
    value: regex,
    message: message || "Invalid format"
  }),

  email: (message?: string): ValidationRule => ({
    type: "pattern",
    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: message || "Invalid email address"
  }),

  phone: (message?: string): ValidationRule => ({
    type: "pattern",
    value: /^[\d\s\-\+\(\)]+$/,
    message: message || "Invalid phone number"
  }),

  url: (message?: string): ValidationRule => ({
    type: "pattern",
    value: /^https?:\/\/.+/,
    message: message || "Invalid URL"
  }),

  custom: (validator: (value: any) => boolean | string, message?: string): ValidationRule => ({
    type: "custom",
    validator,
    message
  })
}

export default FormValidationProvider