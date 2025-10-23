"use client"

import React from "react"
import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

interface DateFieldProps {
  config: FormFieldConfig & {
    includeTime?: boolean
    minDate?: Date
    maxDate?: Date
    dateFormat?: string
  }
}

export function DateField({ config }: DateFieldProps) {
  const dateFormat = config.dateFormat || (config.includeTime ? "PPpp" : "PPP")

  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "This field is required" : false,
      }}
      defaultValue={config.defaultValue || null}
      render={({ field, fieldState }) => (
        <FormFieldBase config={config}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !field.value && "text-muted-foreground",
                  fieldState.error && "border-destructive"
                )}
                disabled={config.readonly}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {field.value ? (
                  format(new Date(field.value), dateFormat)
                ) : (
                  <span>{config.placeholder || "Select date"}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value ? new Date(field.value) : undefined}
                onSelect={(date) => {
                  if (date) {
                    field.onChange(config.includeTime ? date.toISOString() : date.toISOString().split('T')[0])
                  } else {
                    field.onChange(null)
                  }
                }}
                disabled={(date) => {
                  if (config.minDate && date < config.minDate) return true
                  if (config.maxDate && date > config.maxDate) return true
                  return false
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </FormFieldBase>
      )}
    />
  )
}

// Alternative date field using native input for better mobile support
export function NativeDateField({ config }: DateFieldProps) {
  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "This field is required" : false,
      }}
      defaultValue={config.defaultValue || ""}
      render={({ field, fieldState }) => (
        <FormFieldBase config={config}>
          <Input
            {...field}
            type={config.includeTime ? "datetime-local" : "date"}
            placeholder={config.placeholder}
            readOnly={config.readonly}
            className={fieldState.error ? "border-destructive" : ""}
            value={field.value || ""}
            onChange={(e) => {
              field.onChange(e.target.value || null)
            }}
          />
        </FormFieldBase>
      )}
    />
  )
}

export default DateField