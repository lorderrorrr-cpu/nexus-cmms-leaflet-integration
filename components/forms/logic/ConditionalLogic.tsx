"use client"

import React, { createContext, useContext, useCallback, useMemo } from "react"

export interface ConditionalRule {
  field: string
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty"
  value?: any
  logic?: "and" | "or"
  rules?: ConditionalRule[]
}

export interface FieldCondition {
  id: string
  rules: ConditionalRule[]
  action: "show" | "hide" | "enable" | "disable" | "require" | "optional"
}

interface ConditionalLogicContextType {
  evaluateCondition: (condition: FieldCondition, formData: Record<string, any>) => boolean
  evaluateRules: (rules: ConditionalRule[], formData: Record<string, any>) => boolean
  getFieldVisibility: (fieldId: string, formData: Record<string, any>, conditions: FieldCondition[]) => boolean
  getFieldEnabled: (fieldId: string, formData: Record<string, any>, conditions: FieldCondition[]) => boolean
  getFieldRequired: (fieldId: string, formData: Record<string, any>, conditions: FieldCondition[]) => boolean
}

const ConditionalLogicContext = createContext<ConditionalLogicContextType | null>(null)

export const useConditionalLogic = () => {
  const context = useContext(ConditionalLogicContext)
  if (!context) {
    throw new Error("useConditionalLogic must be used within a ConditionalLogicProvider")
  }
  return context
}

interface ConditionalLogicProviderProps {
  children: React.ReactNode
  conditions?: FieldCondition[]
}

export const ConditionalLogicProvider: React.FC<ConditionalLogicProviderProps> = ({
  children,
  conditions = []
}) => {
  const evaluateRules = useCallback((rules: ConditionalRule[], formData: Record<string, any>): boolean => {
    if (!rules || rules.length === 0) return true

    const results = rules.map(rule => {
      const fieldValue = formData[rule.field]
      let result = false

      switch (rule.operator) {
        case "equals":
          result = fieldValue === rule.value
          break
        case "not_equals":
          result = fieldValue !== rule.value
          break
        case "contains":
          if (Array.isArray(fieldValue)) {
            result = fieldValue.includes(rule.value)
          } else if (typeof fieldValue === "string") {
            result = fieldValue.toLowerCase().includes(String(rule.value).toLowerCase())
          }
          break
        case "greater_than":
          result = Number(fieldValue) > Number(rule.value)
          break
        case "less_than":
          result = Number(fieldValue) < Number(rule.value)
          break
        case "is_empty":
          result = (
            fieldValue === undefined ||
            fieldValue === null ||
            fieldValue === "" ||
            (Array.isArray(fieldValue) && fieldValue.length === 0)
          )
          break
        case "is_not_empty":
          result = !(
            fieldValue === undefined ||
            fieldValue === null ||
            fieldValue === "" ||
            (Array.isArray(fieldValue) && fieldValue.length === 0)
          )
          break
        default:
          result = false
      }

      return result
    })

    // Handle nested rules with logic operators
    if (rules.length === 1 && !rules[0].rules) {
      return results[0]
    }

    // If there are nested rules, evaluate them with the specified logic
    for (const rule of rules) {
      if (rule.rules) {
        const nestedResults = evaluateRules(rule.rules, formData)
        const logic = rule.logic || "and"

        if (logic === "and") {
          // For AND logic, all nested rules must be true
          if (!nestedResults) return false
        } else {
          // For OR logic, at least one nested rule must be true
          if (nestedResults) return true
        }
      }
    }

    // If we have multiple top-level rules, use AND logic by default
    return results.every(result => result)
  }, [])

  const evaluateCondition = useCallback((condition: FieldCondition, formData: Record<string, any>): boolean => {
    const result = evaluateRules(condition.rules, formData)

    // Apply the action based on the result
    switch (condition.action) {
      case "show":
        return result
      case "hide":
        return !result
      case "enable":
        return result
      case "disable":
        return !result
      case "require":
        return result
      case "optional":
        return !result
      default:
        return result
    }
  }, [evaluateRules])

  const getFieldVisibility = useCallback((
    fieldId: string,
    formData: Record<string, any>,
    conditions: FieldCondition[]
  ): boolean => {
    const fieldConditions = conditions.filter(condition => condition.id === fieldId)

    if (fieldConditions.length === 0) return true

    // If any condition says to hide, the field is hidden
    const hideConditions = fieldConditions.filter(c => c.action === "hide")
    if (hideConditions.length > 0) {
      return !hideConditions.some(c => evaluateRules(c.rules, formData))
    }

    // If any condition says to show, the field is shown
    const showConditions = fieldConditions.filter(c => c.action === "show")
    if (showConditions.length > 0) {
      return showConditions.some(c => evaluateRules(c.rules, formData))
    }

    return true
  }, [evaluateRules])

  const getFieldEnabled = useCallback((
    fieldId: string,
    formData: Record<string, any>,
    conditions: FieldCondition[]
  ): boolean => {
    const fieldConditions = conditions.filter(condition => condition.id === fieldId)

    if (fieldConditions.length === 0) return true

    // If any condition says to disable, the field is disabled
    const disableConditions = fieldConditions.filter(c => c.action === "disable")
    if (disableConditions.length > 0) {
      return !disableConditions.some(c => evaluateRules(c.rules, formData))
    }

    // If any condition says to enable, the field is enabled
    const enableConditions = fieldConditions.filter(c => c.action === "enable")
    if (enableConditions.length > 0) {
      return enableConditions.some(c => evaluateRules(c.rules, formData))
    }

    return true
  }, [evaluateRules])

  const getFieldRequired = useCallback((
    fieldId: string,
    formData: Record<string, any>,
    conditions: FieldCondition[]
  ): boolean => {
    const fieldConditions = conditions.filter(condition => condition.id === fieldId)

    if (fieldConditions.length === 0) return false

    // If any condition says to require, the field is required
    const requireConditions = fieldConditions.filter(c => c.action === "require")
    if (requireConditions.length > 0) {
      return requireConditions.some(c => evaluateRules(c.rules, formData))
    }

    // If any condition says to make optional, the field is optional
    const optionalConditions = fieldConditions.filter(c => c.action === "optional")
    if (optionalConditions.length > 0) {
      return !optionalConditions.some(c => evaluateRules(c.rules, formData))
    }

    return false
  }, [evaluateRules])

  const value = useMemo(() => ({
    evaluateCondition,
    evaluateRules,
    getFieldVisibility,
    getFieldEnabled,
    getFieldRequired
  }), [evaluateCondition, evaluateRules, getFieldVisibility, getFieldEnabled, getFieldRequired])

  return (
    <ConditionalLogicContext.Provider value={value}>
      {children}
    </ConditionalLogicContext.Provider>
  )
}

// Helper component for conditional rendering
interface ConditionalWrapperProps {
  fieldId: string
  conditions: FieldCondition[]
  formData: Record<string, any>
  children: React.ReactNode
  action?: "show" | "hide" | "enable" | "disable"
}

export const ConditionalWrapper: React.FC<ConditionalWrapperProps> = ({
  fieldId,
  conditions,
  formData,
  children,
  action = "show"
}) => {
  const { getFieldVisibility, getFieldEnabled } = useConditionalLogic()

  let isVisible = true
  let isEnabled = true

  if (action === "show" || action === "hide") {
    isVisible = getFieldVisibility(fieldId, formData, conditions)
  }

  if (action === "enable" || action === "disable") {
    isEnabled = getFieldEnabled(fieldId, formData, conditions)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div style={{ opacity: isEnabled ? 1 : 0.5 }}>
      {children}
    </div>
  )
}

// Utility functions for creating conditional rules
export const createRule = (
  field: string,
  operator: ConditionalRule["operator"],
  value?: any
): ConditionalRule => ({
  field,
  operator,
  value
})

export const createAndCondition = (...rules: ConditionalRule[]): ConditionalRule => ({
  field: "",
  operator: "equals",
  rules,
  logic: "and"
})

export const createOrCondition = (...rules: ConditionalRule[]): ConditionalRule => ({
  field: "",
  operator: "equals",
  rules,
  logic: "or"
})

// Preset conditions for common use cases
export const commonConditions = {
  // When a field has a specific value
  whenFieldEquals: (field: string, value: any, targetField: string): FieldCondition => ({
    id: targetField,
    action: "show",
    rules: [createRule(field, "equals", value)]
  }),

  // When a field doesn't equal a specific value
  whenFieldNotEquals: (field: string, value: any, targetField: string): FieldCondition => ({
    id: targetField,
    action: "hide",
    rules: [createRule(field, "equals", value)]
  }),

  // When a field is empty
  whenFieldIsEmpty: (field: string, targetField: string): FieldCondition => ({
    id: targetField,
    action: "hide",
    rules: [createRule(field, "is_empty")]
  }),

  // When a field is not empty
  whenFieldIsNotEmpty: (field: string, targetField: string): FieldCondition => ({
    id: targetField,
    action: "show",
    rules: [createRule(field, "is_not_empty")]
  }),

  // When a field contains a specific value
  whenFieldContains: (field: string, value: any, targetField: string): FieldCondition => ({
    id: targetField,
    action: "show",
    rules: [createRule(field, "contains", value)]
  }),

  // When a field is greater than a value
  whenFieldGreaterThan: (field: string, value: number, targetField: string): FieldCondition => ({
    id: targetField,
    action: "show",
    rules: [createRule(field, "greater_than", value)]
  }),

  // When a field is less than a value
  whenFieldLessThan: (field: string, value: number, targetField: string): FieldCondition => ({
    id: targetField,
    action: "show",
    rules: [createRule(field, "less_than", value)]
  }),

  // Complex conditions with AND logic
  whenAllConditionsMet: (rules: ConditionalRule[], targetField: string): FieldCondition => ({
    id: targetField,
    action: "show",
    rules: [createAndCondition(...rules)]
  }),

  // Complex conditions with OR logic
  whenAnyConditionMet: (rules: ConditionalRule[], targetField: string): FieldCondition => ({
    id: targetField,
    action: "show",
    rules: [createOrCondition(...rules)]
  })
}

export default ConditionalLogicProvider