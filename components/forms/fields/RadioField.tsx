"use client"

import React from "react"
import { Controller } from "react-hook-form"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"
import { Label } from "@/components/ui/label"

interface RadioFieldProps {
  config: FormFieldConfig & {
    options: Array<{ label: string; value: string; description?: string }>
    orientation?: "horizontal" | "vertical"
  }
}

export function RadioField({ config }: RadioFieldProps) {
  const orientation = config.orientation || "vertical"

  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "Please select an option" : false,
      }}
      defaultValue={config.defaultValue || ""}
      render={({ field, fieldState }) => (
        <FormFieldBase config={config}>
          <RadioGroup
            value={field.value || ""}
            onValueChange={field.onChange}
            disabled={config.readonly}
            className={`gap-3 ${
              orientation === "horizontal" ? "flex flex-row" : "flex flex-col"
            }`}
          >
            {config.options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${config.id}-${option.value}`} />
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
          </RadioGroup>
        </FormFieldBase>
      )}
    />
  )
}

export default RadioField