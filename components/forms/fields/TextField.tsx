"use client"

import React from "react"
import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"

interface TextFieldProps {
  config: FormFieldConfig & {
    multiline?: boolean
    rows?: number
  }
}

export function TextField({ config }: TextFieldProps) {
  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "This field is required" : false,
        minLength: config.validation?.minLength
          ? {
              value: config.validation.minLength,
              message: `Minimum ${config.validation.minLength} characters required`,
            }
          : undefined,
        maxLength: config.validation?.maxLength
          ? {
              value: config.validation.maxLength,
              message: `Maximum ${config.validation.maxLength} characters allowed`,
            }
          : undefined,
        pattern: config.validation?.pattern
          ? {
              value: new RegExp(config.validation.pattern),
              message: config.validation.message || "Invalid format",
            }
          : undefined,
      }}
      defaultValue={config.defaultValue || ""}
      render={({ field, fieldState }) => (
        <FormFieldBase config={config}>
          {config.multiline ? (
            <Textarea
              {...field}
              placeholder={config.placeholder}
              rows={config.rows || 4}
              readOnly={config.readonly}
              className={fieldState.error ? "border-destructive" : ""}
            />
          ) : (
            <Input
              {...field}
              type="text"
              placeholder={config.placeholder}
              readOnly={config.readonly}
              className={fieldState.error ? "border-destructive" : ""}
            />
          )}
        </FormFieldBase>
      )}
    />
  )
}

export default TextField