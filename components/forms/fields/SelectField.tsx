"use client"

import React from "react"
import { Controller } from "react-hook-form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"

interface SelectFieldProps {
  config: FormFieldConfig & {
    options: Array<{ label: string; value: string; disabled?: boolean }>
    searchable?: boolean
    placeholder?: string
  }
}

export function SelectField({ config }: SelectFieldProps) {
  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "Please select an option" : false,
      }}
      defaultValue={config.defaultValue || ""}
      render={({ field, fieldState }) => (
        <FormFieldBase config={config}>
          <Select
            value={field.value || ""}
            onValueChange={field.onChange}
            disabled={config.readonly}
          >
            <SelectTrigger className={fieldState.error ? "border-destructive" : ""}>
              <SelectValue placeholder={config.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {config.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormFieldBase>
      )}
    />
  )
}

export default SelectField