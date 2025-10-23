"use client"

import React from "react"
import { useFormContext } from "react-hook-form"
import {
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { HelpCircle, AlertCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface FormFieldConfig {
  id: string
  type: string
  label: string
  placeholder?: string
  description?: string
  required?: boolean
  readonly?: boolean
  defaultValue?: any
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    message?: string
  }
  options?: Array<{ label: string; value: string }>
  unit?: string
  width?: "full" | "half" | "third" | "quarter"
  section?: string
  conditional?: {
    field: string
    operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than"
    value: any
  }
}

interface FormFieldBaseProps {
  config: FormFieldConfig
  children: React.ReactNode
  className?: string
}

export function FormFieldBase({ config, children, className }: FormFieldBaseProps) {
  const { watch } = useFormContext()
  const formValues = watch()

  // Check conditional visibility
  if (config.conditional) {
    const { field, operator, value } = config.conditional
    const fieldValue = formValues[field]

    let isVisible = false
    switch (operator) {
      case "equals":
        isVisible = fieldValue === value
        break
      case "not_equals":
        isVisible = fieldValue !== value
        break
      case "contains":
        isVisible = Array.isArray(fieldValue)
          ? fieldValue.includes(value)
          : String(fieldValue || "").includes(String(value))
        break
      case "greater_than":
        isVisible = Number(fieldValue) > Number(value)
        break
      case "less_than":
        isVisible = Number(fieldValue) < Number(value)
        break
    }

    if (!isVisible) {
      return null
    }
  }

  const widthClass = {
    full: "col-span-full",
    half: "col-span-1 md:col-span-1",
    third: "col-span-1 md:col-span-1 lg:col-span-1",
    quarter: "col-span-1 md:col-span-1 lg:col-span-2",
  }[config.width || "full"]

  return (
    <FormItem className={`${widthClass} ${className || ""}`}>
      <div className="flex items-center gap-2">
        <FormLabel className="text-sm font-medium">
          {config.label}
          {config.required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
        {config.unit && (
          <Badge variant="secondary" className="text-xs">
            {config.unit}
          </Badge>
        )}
        {config.description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <FormControl>
        {children}
      </FormControl>
      {config.description && (
        <FormDescription className="text-xs">
          {config.description}
        </FormDescription>
      )}
      <FormMessage />
    </FormItem>
  )
}

export default FormFieldBase