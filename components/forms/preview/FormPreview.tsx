"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  X,
  Eye,
  Smartphone,
  Tablet,
  Monitor,
  Check,
  AlertCircle
} from "lucide-react"

import FormRenderer from "../renderer/FormRenderer"

interface FormPreviewProps {
  template: any
  isOpen: boolean
  onClose: () => void
  initialData?: Record<string, any>
}

type PreviewDevice = "mobile" | "tablet" | "desktop"

const deviceSizes = {
  mobile: "w-full max-w-sm",
  tablet: "w-full max-w-2xl",
  desktop: "w-full max-w-4xl"
}

export function FormPreview({ template, isOpen, onClose, initialData = {} }: FormPreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>("mobile")
  const [formData, setFormData] = useState<Record<string, any>>(initialData)

  const handleFormSubmit = async (data: Record<string, any>) => {
    console.log("Form submitted in preview:", data)
    // In preview mode, just log the data
    alert("Form submitted! Check console for data.")
  }

  const handleFormSave = async (data: Record<string, any>) => {
    setFormData(data)
    console.log("Form saved in preview:", data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-semibold">Form Preview</h2>
              <Badge variant="outline">Template: {template.name}</Badge>
            </div>

            <div className="flex items-center space-x-2">
              {/* Device selector */}
              <div className="flex border rounded-md">
                <Button
                  variant={device === "mobile" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDevice("mobile")}
                  className="rounded-r-none"
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
                <Button
                  variant={device === "tablet" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDevice("tablet")}
                  className="rounded-none border-x"
                >
                  <Tablet className="w-4 h-4" />
                </Button>
                <Button
                  variant={device === "desktop" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDevice("desktop")}
                  className="rounded-l-none"
                >
                  <Monitor className="w-4 h-4" />
                </Button>
              </div>

              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Info */}
          <div className="mt-3 flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              Preview Mode
            </div>
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              Test form functionality
            </div>
            <div className="flex items-center">
              <Check className="w-4 h-4 mr-1" />
              Data will be logged to console
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          <ScrollArea className="h-full">
            <div className="p-6 flex justify-center">
              <div className={`w-full ${deviceSizes[device]} transition-all duration-300`}>
                {/* Device frame */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {/* Device header */}
                  <div className="bg-gray-100 p-3 border-b flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <span className="text-xs text-gray-600 font-medium">
                      {device === "mobile" ? "Mobile" : device === "tablet" ? "Tablet" : "Desktop"}
                    </span>
                    <div className="w-16"></div>
                  </div>

                  {/* Form renderer */}
                  <div className={`${
                    device === "mobile" ? "h-[600px]" :
                    device === "tablet" ? "h-[700px]" :
                    "h-[800px]"
                  } overflow-hidden`}>
                    <FormRenderer
                      template={template}
                      initialData={formData}
                      onSave={handleFormSave}
                      onSubmit={handleFormSubmit}
                      mode="create"
                      readonly={false}
                      showProgress={true}
                      autoSave={true}
                      autoSaveInterval={15000} // 15 seconds for preview
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Footer with form summary */}
        <div className="border-t p-4 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Form Summary */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm mb-2">Form Summary</h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>Fields: {template.schema?.fields?.length || 0}</div>
                  <div>Required: {template.schema?.fields?.filter((f: any) => f.required)?.length || 0}</div>
                  <div>Estimated: {template.schema?.settings?.estimatedDurationMinutes || 0} min</div>
                </div>
              </CardContent>
            </Card>

            {/* Device Info */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm mb-2">Device Preview</h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>Device: {device}</div>
                  <div>
                    Size: {
                      device === "mobile" ? "~375px" :
                      device === "tablet" ? "~768px" :
                      "~1200px"
                    }
                  </div>
                  <div>Responsive: Yes</div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm mb-2">Test Actions</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setFormData({})}
                  >
                    Clear Form Data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      console.log("Current form data:", formData)
                      console.log("Form template:", template)
                    }}
                  >
                    Debug Console
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FormPreview