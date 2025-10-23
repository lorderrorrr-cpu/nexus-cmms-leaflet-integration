"use client"

import React from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Save,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Clock,
  MapPin,
  Camera,
  File,
  Star,
  Info
} from "lucide-react"

import {
  FormFieldBase,
  TextField,
  NumberField,
  SelectField,
  RadioField,
  CheckboxField,
  DateField,
  PhotoField,
  GPSField,
  SignatureField,
  RatingField,
  FileField,
  FormFieldConfig
} from "../fields"

interface FormRendererProps {
  template: {
    id: string
    name: string
    description?: string
    schema: {
      fields: FormFieldConfig[]
      settings: {
        requirePhotos?: boolean
        requireGPS?: boolean
        requireSignature?: boolean
        allowOfflineMode?: boolean
        estimatedDurationMinutes?: number
        sections?: Array<{
          id: string
          title: string
          description?: string
          order: number
        }>
      }
    }
  }
  initialData?: Record<string, any>
  onSave?: (data: Record<string, any>) => void
  onNext?: (data: Record<string, any>) => void
  onPrevious?: () => void
  onSubmit?: (data: Record<string, any>) => void
  mode?: "create" | "edit" | "view"
  readonly?: boolean
  showProgress?: boolean
  multiStep?: boolean
  currentStep?: number
  totalSteps?: number
  autoSave?: boolean
  autoSaveInterval?: number // in milliseconds
}

export function FormRenderer({
  template,
  initialData = {},
  onSave,
  onNext,
  onPrevious,
  onSubmit,
  mode = "create",
  readonly = false,
  showProgress = true,
  multiStep = false,
  currentStep = 1,
  totalSteps = 1,
  autoSave = false,
  autoSaveInterval = 30000 // 30 seconds default
}: FormRendererProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isAutoSaving, setIsAutoSaving] = React.useState(false)
  const [startTime] = React.useState(new Date())
  const [currentTime, setCurrentTime] = React.useState(new Date())
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)

  // Update current time every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-save functionality
  React.useEffect(() => {
    if (!autoSave || readonly) return

    const interval = setInterval(() => {
      const form = getFormValues()
      if (form) {
        setIsAutoSaving(true)
        onSave?.(form)
        setTimeout(() => setIsAutoSaving(false), 1000)
        setHasUnsavedChanges(false)
      }
    }, autoSaveInterval)

    return () => clearInterval(interval)
  }, [autoSave, autoSaveInterval, readonly, onSave])

  // Create form validation schema
  const createValidationSchema = () => {
    const schemaFields: Record<string, z.ZodTypeAny> = {}

    template.schema.fields.forEach((field) => {
      let fieldSchema: z.ZodTypeAny = z.any()

      switch (field.type) {
        case "text":
          fieldSchema = z.string()
          if (field.validation?.minLength) {
            fieldSchema = fieldSchema.min(field.validation.minLength, `Minimum ${field.validation.minLength} characters required`)
          }
          if (field.validation?.maxLength) {
            fieldSchema = fieldSchema.max(field.validation.maxLength, `Maximum ${field.validation.maxLength} characters allowed`)
          }
          break

        case "number":
          fieldSchema = z.number()
          if (field.validation?.min !== undefined) {
            fieldSchema = fieldSchema.min(field.validation.min, `Minimum value is ${field.validation.min}`)
          }
          if (field.validation?.max !== undefined) {
            fieldSchema = fieldSchema.max(field.validation.max, `Maximum value is ${field.validation.max}`)
          }
          break

        case "select":
        case "radio":
        case "checkbox":
          fieldSchema = z.string()
          break

        case "date":
          fieldSchema = z.string()
          break

        case "photo":
        case "file":
          fieldSchema = z.array(z.any())
          break

        case "gps":
          fieldSchema = z.object({
            latitude: z.number(),
            longitude: z.number(),
            accuracy: z.number()
          })
          break

        case "signature":
          fieldSchema = z.object({
            data: z.string(),
            timestamp: z.string()
          })
          break

        case "rating":
          fieldSchema = z.number()
          break

        default:
          fieldSchema = z.any()
      }

      if (field.required) {
        fieldSchema = fieldSchema ? fieldSchema : z.string().min(1, "This field is required")
      }

      schemaFields[field.id] = fieldSchema
    })

    return z.object(schemaFields)
  }

  const form = useForm({
    resolver: zodResolver(createValidationSchema()),
    defaultValues: initialData,
    mode: "onBlur"
  })

  const getFormValues = () => {
    try {
      return form.getValues()
    } catch {
      return null
    }
  }

  // Track form changes
  React.useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true)
    })
    return () => subscription.unsubscribe()
  }, [form])

  const calculateProgress = () => {
    const values = form.getValues()
    const totalFields = template.schema.fields.length
    let completedFields = 0

    template.schema.fields.forEach((field) => {
      const value = values[field.id]
      if (value !== undefined && value !== null && value !== "") {
        if (Array.isArray(value)) {
          if (value.length > 0) completedFields++
        } else {
          completedFields++
        }
      }
    })

    return (completedFields / totalFields) * 100
  }

  const calculateDuration = () => {
    const diff = currentTime.getTime() - startTime.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const renderField = (field: FormFieldConfig) => {
    const fieldProps = {
      config: { ...field, readonly: readonly || field.readonly },
      key: field.id
    }

    switch (field.type) {
      case "text":
        return <TextField {...fieldProps} />
      case "number":
        return <NumberField {...fieldProps} />
      case "select":
        return <SelectField {...fieldProps} />
      case "radio":
        return <RadioField {...fieldProps} />
      case "checkbox":
        return <CheckboxField {...fieldProps} />
      case "date":
        return <DateField {...fieldProps} />
      case "photo":
        return <PhotoField {...fieldProps} />
      case "gps":
        return <GPSField {...fieldProps} />
      case "signature":
        return <SignatureField {...fieldProps} />
      case "rating":
        return <RatingField {...fieldProps} />
      case "file":
        return <FileField {...fieldProps} />
      default:
        return (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Unknown field type: {field.type}</AlertDescription>
          </Alert>
        )
    }
  }

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      if (onSubmit) {
        await onSubmit(data)
      } else if (onSave) {
        await onSave(data)
      }
    } catch (error) {
      console.error("Form submission error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      const data = form.getValues()
      if (onSave) {
        await onSave(data)
      }
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error("Form save error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const progress = calculateProgress()
  const progressPercentage = Math.round(progress)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {multiStep && onPrevious && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevious}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
            )}
            <div>
              <h1 className="text-lg font-semibold">{template.name}</h1>
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {autoSave && (
              <div className="text-sm text-muted-foreground flex items-center">
                {isAutoSaving ? (
                  <>
                    <div className="animate-spin w-4 h-4 mr-2">⏳</div>
                    Auto-saving...
                  </>
                ) : hasUnsavedChanges ? (
                  <>
                    <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                    Unsaved changes
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    Saved
                  </>
                )}
              </div>
            )}

            {!readonly && onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSubmitting}
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            )}

            {multiStep && onNext && (
              <Button
                size="sm"
                onClick={() => onNext(form.getValues())}
                disabled={isSubmitting}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}

        {/* Multi-step indicator */}
        {multiStep && totalSteps > 1 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Step</span>
            <span className="font-medium">{currentStep}</span>
            <span className="text-muted-foreground">of {totalSteps}</span>
          </div>
        )}
      </div>

      {/* Form Content */}
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Form Requirements */}
              {template.schema.settings && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {template.schema.settings.requirePhotos && (
                        <Badge variant="outline" className="flex items-center">
                          <Camera className="w-3 h-3 mr-1" />
                          Photos Required
                        </Badge>
                      )}
                      {template.schema.settings.requireGPS && (
                        <Badge variant="outline" className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          GPS Required
                        </Badge>
                      )}
                      {template.schema.settings.requireSignature && (
                        <Badge variant="outline" className="flex items-center">
                          <File className="w-3 h-3 mr-1" />
                          Signature Required
                        </Badge>
                      )}
                      {template.schema.settings.estimatedDurationMinutes && (
                        <Badge variant="outline" className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          ~{template.schema.settings.estimatedDurationMinutes} min
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {template.schema.fields.map((field) => (
                  <div
                    key={field.id}
                    className={
                      field.width === "half" ? "md:col-span-1" :
                      field.width === "third" ? "md:col-span-1 lg:col-span-1" :
                      field.width === "quarter" ? "md:col-span-1 lg:col-span-3" :
                      "md:col-span-2 lg:col-span-3"
                    }
                  >
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground flex items-center space-x-4">
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {calculateDuration()}
                </span>
                <span>{template.schema.fields.length} fields</span>
                <span>{Math.round(progressPercentage)}% complete</span>
              </div>

              <div className="flex space-x-2">
                {!multiStep && onSave && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSave}
                    disabled={isSubmitting}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </Button>
                )}

                {onSubmit && !readonly && (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Form"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}

export default FormRenderer