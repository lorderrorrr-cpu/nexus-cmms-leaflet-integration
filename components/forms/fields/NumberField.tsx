"use client"

import React from "react"
import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"

interface NumberFieldProps {
  config: FormFieldConfig & {
    min?: number
    max?: number
    step?: number
    precision?: number
  }
}

export function NumberField({ config }: NumberFieldProps) {
  const handleInputChange = (value: string) => {
    // Convert empty string to undefined
    if (value === "") return undefined

    // Parse as float to handle decimal values
    const num = parseFloat(value)

    // Validate min/max constraints
    if (config.min !== undefined && num < config.min) return config.min
    if (config.max !== undefined && num > config.max) return config.max

    // Apply precision
    if (config.precision !== undefined) {
      return parseFloat(num.toFixed(config.precision))
    }

    return num
  }

  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "This field is required" : false,
        min: config.validation?.min
          ? {
              value: config.validation.min,
              message: `Minimum value is ${config.validation.min}`,
            }
          : config.min
          ? {
              value: config.min,
              message: `Minimum value is ${config.min}`,
            }
          : undefined,
        max: config.validation?.max
          ? {
              value: config.validation.max,
              message: `Maximum value is ${config.validation.max}`,
            }
          : config.max
          ? {
              value: config.max,
              message: `Maximum value is ${config.max}`,
            }
          : undefined,
      }}
      defaultValue={config.defaultValue || 0}
      render={({ field, fieldState }) => (
        <FormFieldBase config={config}>
          <Input
            {...field}
            type="number"
            placeholder={config.placeholder}
            min={config.min}
            max={config.max}
            step={config.step || "any"}
            readOnly={config.readonly}
            className={fieldState.error ? "border-destructive" : ""}
            onChange={(e) => {
              const value = e.target.value
              const processedValue = handleInputChange(value)
              field.onChange(processedValue !== undefined ? processedValue : value)
            }}
            onBlur={(e) => {
              // Format on blur to ensure proper precision
              const value = e.target.value
              const processedValue = handleInputChange(value)
              field.onChange(processedValue !== undefined ? processedValue : value)
              field.onBlur()
            }}
          />
        </FormFieldBase>
      )}
    />
  )
}

export default NumberField