"use client"

import React from "react"
import { Controller } from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"
import { Label } from "@/components/ui/label"

interface CheckboxFieldProps {
  config: FormFieldConfig & {
    options?: Array<{ label: string; value: string; description?: string }>
    orientation?: "horizontal" | "vertical"
  }
}

export function CheckboxField({ config }: CheckboxFieldProps) {
  const isMultiple = config.options && config.options.length > 1
  const orientation = config.orientation || "vertical"

  if (isMultiple) {
    return (
      <Controller
        name={config.id}
        rules={{
          required: config.required ? "Please select at least one option" : false,
          validate: (value) => {
            if (config.required && (!value || value.length === 0)) {
              return "Please select at least one option"
            }
            return true
          },
        }}
        defaultValue={config.defaultValue || []}
        render={({ field, fieldState }) => (
          <FormFieldBase config={config}>
            <div className={`space-y-2 ${orientation === "horizontal" ? "flex flex-wrap gap-4" : ""}`}>
              {config.options!.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${config.id}-${option.value}`}
                    checked={(field.value || []).includes(option.value)}
                    onCheckedChange={(checked) => {
                      const currentValue = field.value || []
                      if (checked) {
                        field.onChange([...currentValue, option.value])
                      } else {
                        field.onChange(currentValue.filter((v: string) => v !== option.value))
                      }
                    }}
                    disabled={config.readonly}
                  />
                  <div className="flex flex-col">
                    <Label
                      htmlFor={`${config.id}-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    {option.description && (
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </FormFieldBase>
        )}
      />
    )
  }

  // Single checkbox (for boolean/confirmation)
  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "This field must be checked" : false,
        validate: (value) => {
          if (config.required && !value) {
            return "This field must be checked"
          }
          return true
        },
      }}
      defaultValue={config.defaultValue || false}
      render={({ field, fieldState }) => (
        <FormFieldBase config={config}>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={config.id}
              checked={field.value || false}
              onCheckedChange={field.onChange}
              disabled={config.readonly}
            />
            <Label htmlFor={config.id} className="text-sm font-normal cursor-pointer">
              {config.label}
              {config.required && <span className="text-destructive ml-1">*</span>}
            </Label>
          </div>
        </FormFieldBase>
      )}
    />
  )
}

export default CheckboxField