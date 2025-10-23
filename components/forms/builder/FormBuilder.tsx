"use client"

import React, { useState, useCallback } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Save,
  Copy,
  ArrowUp,
  ArrowDown,
  Type,
  Hash,
  RadioIcon,
  CheckSquare,
  Calendar,
  Camera,
  MapPin,
  PenTool,
  Star,
  File
} from "lucide-react"

import { FormFieldConfig } from "../fields"

// Field type definitions
const FIELD_TYPES = [
  { value: "text", label: "Text Input", icon: Type, category: "Input" },
  { value: "number", label: "Number", icon: Hash, category: "Input" },
  { value: "select", label: "Dropdown", icon: Type, category: "Selection" },
  { value: "radio", label: "Radio Group", icon: RadioIcon, category: "Selection" },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare, category: "Selection" },
  { value: "date", label: "Date/Time", icon: Calendar, category: "Input" },
  { value: "photo", label: "Photo Upload", icon: Camera, category: "Media" },
  { value: "gps", label: "GPS Location", icon: MapPin, category: "Location" },
  { value: "signature", label: "Signature", icon: PenTool, category: "Input" },
  { value: "rating", label: "Rating", icon: Star, category: "Selection" },
  { value: "file", label: "File Upload", icon: File, category: "Media" },
]

// Form validation schema
const formBuilderSchema = z.object({
  name: z.string().min(1, "Form name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  requirePhotos: z.boolean().default(false),
  requireGPS: z.boolean().default(true),
  requireSignature: z.boolean().default(false),
  allowOfflineMode: z.boolean().default(true),
  estimatedDurationMinutes: z.number().min(1).default(30),
  tags: z.string().optional(),
  fields: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string().min(1, "Field label is required"),
    placeholder: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().default(false),
    readonly: z.boolean().default(false),
    defaultValue: z.any().optional(),
    width: z.enum(["full", "half", "third", "quarter"]).default("full"),
    section: z.string().optional(),
    validation: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
      message: z.string().optional(),
    }).optional(),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
      description: z.string().optional(),
    })).optional(),
    conditional: z.object({
      field: z.string(),
      operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than"]),
      value: z.any(),
    }).optional(),
  })),
})

type FormBuilderValues = z.infer<typeof formBuilderSchema>

interface FormBuilderProps {
  initialData?: Partial<FormBuilderValues>
  onSave?: (data: FormBuilderValues) => void
  onPreview?: (data: FormBuilderValues) => void
  mode?: "create" | "edit"
}

export function FormBuilder({ initialData, onSave, onPreview, mode = "create" }: FormBuilderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

  const form = useForm<FormBuilderValues>({
    resolver: zodResolver(formBuilderSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      subcategory: "",
      requirePhotos: false,
      requireGPS: true,
      requireSignature: false,
      allowOfflineMode: true,
      estimatedDurationMinutes: 30,
      tags: "",
      fields: [],
      ...initialData
    }
  })

  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: "fields"
  })

  const addField = useCallback((fieldType: string) => {
    const newField: any = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: fieldType,
      label: `New ${FIELD_TYPES.find(t => t.value === fieldType)?.label}`,
      placeholder: "",
      description: "",
      required: false,
      readonly: false,
      width: "full",
      section: "",
      validation: {},
      options: [],
      conditional: undefined,
    }

    // Add type-specific defaults
    switch (fieldType) {
      case "select":
      case "radio":
      case "checkbox":
        newField.options = [
          { label: "Option 1", value: "opt1" },
          { label: "Option 2", value: "opt2" }
        ]
        break
      case "number":
        newField.validation = { min: 0, max: 100 }
        break
      case "text":
        newField.validation = { minLength: 1, maxLength: 255 }
        break
    }

    append(newField)
    setSelectedFieldId(newField.id)
  }, [append])

  const duplicateField = useCallback((fieldIndex: number) => {
    const fieldToDuplicate = fields[fieldIndex]
    const duplicatedField = {
      ...fieldToDuplicate,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `${fieldToDuplicate.label} (Copy)`
    }
    append(duplicatedField)
    setSelectedFieldId(duplicatedField.id)
  }, [fields, append])

  const moveField = useCallback((fromIndex: number, toIndex: number) => {
    move(fromIndex, toIndex)
  }, [move])

  const updateField = useCallback((fieldId: string, updates: Partial<any>) => {
    const fieldIndex = fields.findIndex(f => f.id === fieldId)
    if (fieldIndex !== -1) {
      update(fieldIndex, updates)
    }
  }, [fields, update])

  const removeField = useCallback((fieldId: string) => {
    const fieldIndex = fields.findIndex(f => f.id === fieldId)
    if (fieldIndex !== -1) {
      remove(fieldIndex)
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null)
      }
    }
  }, [fields, remove, selectedFieldId])

  const handleSave = useCallback((data: FormBuilderValues) => {
    onSave?.(data)
  }, [onSave])

  const selectedField = fields.find(f => f.id === selectedFieldId)

  return (
    <div className="h-screen flex">
      {/* Field Types Sidebar */}
      <div className="w-64 border-r bg-gray-50 p-4">
        <h3 className="font-semibold mb-4">Field Types</h3>
        <div className="space-y-2">
          {FIELD_TYPES.map((fieldType) => {
            const IconComponent = fieldType.icon
            return (
              <Button
                key={fieldType.value}
                variant="outline"
                className="w-full justify-start h-auto p-3"
                onClick={() => addField(fieldType.value)}
              >
                <IconComponent className="w-4 h-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">{fieldType.label}</div>
                  <div className="text-xs text-muted-foreground">{fieldType.category}</div>
                </div>
              </Button>
            )
          })}
        </div>
      </div>

      {/* Main Form Builder Area */}
      <div className="flex-1 flex">
        {/* Form Canvas */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <Input
              {...form.register("name")}
              placeholder="Form Name"
              className="text-2xl font-bold border-0 p-0 h-auto"
            />
            <Textarea
              {...form.register("description")}
              placeholder="Form Description"
              className="mt-2 border-0 p-0 text-muted-foreground"
              rows={2}
            />
          </div>

          {/* Form Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Form Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select onValueChange={(value) => form.setValue("category", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pm">Preventive Maintenance</SelectItem>
                      <SelectItem value="cm">Corrective Maintenance</SelectItem>
                      <SelectItem value="safety">Safety Check</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estimated Duration (minutes)</Label>
                  <Input
                    type="number"
                    {...form.register("estimatedDurationMinutes", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    {...form.register("requirePhotos")}
                    onCheckedChange={(checked) => form.setValue("requirePhotos", checked)}
                  />
                  <Label>Require Photos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    {...form.register("requireGPS")}
                    onCheckedChange={(checked) => form.setValue("requireGPS", checked)}
                  />
                  <Label>Require GPS</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    {...form.register("requireSignature")}
                    onCheckedChange={(checked) => form.setValue("requireSignature", checked)}
                  />
                  <Label>Require Signature</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    {...form.register("allowOfflineMode")}
                    onCheckedChange={(checked) => form.setValue("allowOfflineMode", checked)}
                  />
                  <Label>Allow Offline</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Fields */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Form Fields</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onPreview?.(form.getValues())}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button type="button" onClick={form.handleSubmit(handleSave)}>
                <Save className="w-4 h-4 mr-2" />
                Save Form
              </Button>
            </div>
          </div>

          <div className="space-y-3 min-h-[200px] p-4 border-2 border-dashed border-gray-300 rounded-lg">
            {fields.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Type className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No fields added yet.</p>
                <p className="text-sm">Add fields from sidebar to get started.</p>
              </div>
            ) : (
              fields.map((field, index) => {
                const fieldConfig = FIELD_TYPES.find(t => t.value === field.type)
                const IconComponent = fieldConfig?.icon || Type
                const isSelected = field.id === selectedFieldId

                return (
                  <Card
                    key={field.id}
                    className={`cursor-pointer transition-all ${
                      isSelected ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedFieldId(field.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <IconComponent className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{field.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {fieldConfig?.label}
                              {field.required && <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveField(index, Math.max(0, index - 1))
                            }}
                            disabled={index === 0}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveField(index, Math.min(fields.length - 1, index + 1))
                            }}
                            disabled={index === fields.length - 1}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              duplicateField(index)
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeField(field.id)
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>

        {/* Field Properties Panel */}
        {selectedField && (
          <div className="w-80 border-l bg-gray-50 p-4">
            <h3 className="font-semibold mb-4">Field Properties</h3>
            <ScrollArea className="h-[calc(100vh-8rem)]">
              <div className="space-y-4">
                <div>
                  <Label>Label</Label>
                  <Input
                    value={selectedField.label}
                    onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                    placeholder="Field label"
                  />
                </div>

                <div>
                  <Label>Placeholder</Label>
                  <Input
                    value={selectedField.placeholder || ""}
                    onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                    placeholder="Placeholder text"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={selectedField.description || ""}
                    onChange={(e) => updateField(selectedField.id, { description: e.target.value })}
                    placeholder="Field description"
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={selectedField.required || false}
                    onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })}
                  />
                  <Label>Required Field</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={selectedField.readonly || false}
                    onCheckedChange={(checked) => updateField(selectedField.id, { readonly: checked })}
                  />
                  <Label>Read Only</Label>
                </div>

                <div>
                  <Label>Width</Label>
                  <Select
                    value={selectedField.width || "full"}
                    onValueChange={(value) => updateField(selectedField.id, { width: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Width</SelectItem>
                      <SelectItem value="half">Half Width</SelectItem>
                      <SelectItem value="third">Third Width</SelectItem>
                      <SelectItem value="quarter">Quarter Width</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Type-specific properties */}
                {(selectedField.type === "select" || selectedField.type === "radio" || selectedField.type === "checkbox") && (
                  <div>
                    <Label>Options</Label>
                    <div className="space-y-2 mt-2">
                      {selectedField.options?.map((option: any, index: number) => (
                        <div key={index} className="flex space-x-2">
                          <Input
                            value={option.label}
                            onChange={(e) => {
                              const newOptions = [...(selectedField.options || [])]
                              newOptions[index] = { ...option, label: e.target.value }
                              updateField(selectedField.id, { options: newOptions })
                            }}
                            placeholder="Option label"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newOptions = selectedField.options?.filter((_: any, i: number) => i !== index)
                              updateField(selectedField.id, { options: newOptions })
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newOptions = [...(selectedField.options || []), { label: "New Option", value: `opt_${Date.now()}` }]
                          updateField(selectedField.id, { options: newOptions })
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Option
                      </Button>
                    </div>
                  </div>
                )}

                {/* Validation properties for text/number fields */}
                {(selectedField.type === "text" || selectedField.type === "number") && (
                  <div className="space-y-3">
                    <Label>Validation</Label>
                    {selectedField.type === "text" && (
                      <>
                        <div>
                          <Label className="text-sm">Min Length</Label>
                          <Input
                            type="number"
                            value={selectedField.validation?.minLength || ""}
                            onChange={(e) => updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                minLength: e.target.value ? parseInt(e.target.value) : undefined
                              }
                            })}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Max Length</Label>
                          <Input
                            type="number"
                            value={selectedField.validation?.maxLength || ""}
                            onChange={(e) => updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                maxLength: e.target.value ? parseInt(e.target.value) : undefined
                              }
                            })}
                          />
                        </div>
                      </>
                    )}
                    {selectedField.type === "number" && (
                      <>
                        <div>
                          <Label className="text-sm">Min Value</Label>
                          <Input
                            type="number"
                            value={selectedField.validation?.min || ""}
                            onChange={(e) => updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                min: e.target.value ? parseFloat(e.target.value) : undefined
                              }
                            })}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Max Value</Label>
                          <Input
                            type="number"
                            value={selectedField.validation?.max || ""}
                            onChange={(e) => updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                max: e.target.value ? parseFloat(e.target.value) : undefined
                              }
                            })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}

export default FormBuilder