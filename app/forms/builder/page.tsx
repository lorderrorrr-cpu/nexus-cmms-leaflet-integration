"use client"

import React, { useState } from "react"
import { FormBuilder } from "@/components/forms"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FormPreview } from "@/components/forms"
import {
  Save,
  Eye,
  Plus,
  FileText,
  Settings,
  BarChart3
} from "lucide-react"

// Sample form data for demonstration
const sampleForm = {
  name: "UPS Monthly Inspection",
  description: "Comprehensive monthly inspection checklist for UPS systems",
  category: "pm",
  subcategory: "electrical",
  requirePhotos: true,
  requireGPS: true,
  requireSignature: true,
  allowOfflineMode: true,
  estimatedDurationMinutes: 30,
  tags: "ups, monthly, electrical, pm",
  fields: [
    {
      id: "asset_info",
      type: "text",
      label: "Asset Information",
      placeholder: "Enter asset tag or serial number",
      description: "Scan or enter the asset identifier",
      required: true,
      readonly: false,
      width: "full",
      validation: {
        minLength: 1,
        maxLength: 50
      }
    },
    {
      id: "location_verification",
      type: "gps",
      label: "Location Verification",
      description: "Confirm you are at the correct location",
      required: true,
      width: "full",
      validation: {
        radiusMeters: 50,
        accuracyThreshold: 100
      }
    },
    {
      id: "before_photos",
      type: "photo",
      label: "Before Photos",
      description: "Take photos of the equipment before inspection",
      required: true,
      maxFiles: 3,
      maxFileSize: 10,
      width: "full",
      validation: {
        requireGPS: true
      }
    },
    {
      id: "input_voltage",
      type: "number",
      label: "Input Voltage (V)",
      placeholder: "Enter measured input voltage",
      required: true,
      unit: "V",
      width: "half",
      validation: {
        min: 100,
        max: 500
      }
    },
    {
      id: "output_voltage",
      type: "number",
      label: "Output Voltage (V)",
      placeholder: "Enter measured output voltage",
      required: true,
      unit: "V",
      width: "half",
      validation: {
        min: 100,
        max: 500
      }
    },
    {
      id: "battery_capacity",
      type: "number",
      label: "Battery Capacity (%)",
      placeholder: "Enter battery capacity percentage",
      required: true,
      unit: "%",
      width: "third",
      validation: {
        min: 0,
        max: 100
      }
    },
    {
      id: "indicators_status",
      type: "radio",
      label: "Indicator Status",
      description: "Check the status of all indicator lights",
      required: true,
      width: "third",
      options: [
        { label: "Normal (Green)", value: "normal" },
        { label: "Warning (Yellow)", value: "warning" },
        { label: "Error (Red)", value: "error" }
      ]
    },
    {
      id: "components_checked",
      type: "checkbox",
      label: "Components Checked",
      description: "Select all components that were inspected",
      required: true,
      width: "third",
      options: [
        { label: "Battery terminals", value: "battery_terminals" },
        { label: "Fan operation", value: "fan_operation" },
        { label: "Display panel", value: "display_panel" },
        { label: "Circuit breakers", value: "circuit_breakers" },
        { label: "Input connections", value: "input_connections" },
        { label: "Output connections", value: "output_connections" }
      ]
    },
    {
      id: "overall_condition",
      type: "rating",
      label: "Overall Condition",
      description: "Rate the overall condition of the UPS system",
      required: true,
      width: "half",
      validation: {
        scale: 5,
        customLabels: ["Poor", "Fair", "Good", "Very Good", "Excellent"]
      }
    },
    {
      id: "inspection_notes",
      type: "text",
      label: "Inspection Notes",
      placeholder: "Enter any additional notes or observations",
      required: false,
      multiline: true,
      rows: 4,
      width: "half"
    },
    {
      id: "after_photos",
      type: "photo",
      label: "After Photos",
      description: "Take photos of the equipment after maintenance",
      required: true,
      maxFiles: 3,
      maxFileSize: 10,
      width: "full"
    },
    {
      id: "technician_signature",
      type: "signature",
      label: "Technician Signature",
      description: "Sign to confirm completion of inspection",
      required: true,
      width: "full"
    }
  ]
}

export default function FormBuilderPage() {
  const [currentForm, setCurrentForm] = useState(sampleForm)
  const [showPreview, setShowPreview] = useState(false)

  const handleSave = async (formData: any) => {
    console.log("Saving form:", formData)
    // Here you would make an API call to save the form
    try {
      const response = await fetch('/api/forms/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const result = await response.json()
        console.log("Form saved successfully:", result)
        setCurrentForm(result.data)
      }
    } catch (error) {
      console.error("Error saving form:", error)
    }
  }

  const handlePreview = (formData: any) => {
    setCurrentForm(formData)
    setShowPreview(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Dynamic Form Builder</h1>
                  <p className="text-sm text-gray-500">Create custom forms with drag-and-drop simplicity</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="flex items-center">
                <BarChart3 className="w-3 h-3 mr-1" />
                Beta
              </Badge>

              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>

              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Form
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Features Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Drag & Drop Builder</CardTitle>
              <div className="h-4 w-4 text-muted-foreground">🎯</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12+</div>
              <p className="text-xs text-muted-foreground">Field types available</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mobile Optimized</CardTitle>
              <div className="h-4 w-4 text-muted-foreground">📱</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">100%</div>
              <p className="text-xs text-muted-foreground">Mobile responsive design</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline Support</CardTitle>
              <div className="h-4 w-4 text-muted-foreground">📡</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">✓</div>
              <p className="text-xs text-muted-foreground">Work offline, sync later</p>
            </CardContent>
          </Card>
        </div>

        {/* Form Builder */}
        <Card className="h-[600px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Form Builder</CardTitle>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(currentForm)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button size="sm" onClick={() => handleSave(currentForm)}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-80px)]">
            <FormBuilder
              initialData={currentForm}
              onSave={handleSave}
              onPreview={handlePreview}
              mode="edit"
            />
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      <FormPreview
        template={currentForm}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        initialData={{}}
      />
    </div>
  )
}