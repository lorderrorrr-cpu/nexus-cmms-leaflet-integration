"use client"

import React from "react"
import { FormRenderer } from "@/components/forms"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, Share, Save, BarChart3 } from "lucide-react"

// Sample form template for demonstration
const sampleFormTemplate = {
  id: "template_1",
  name: "UPS Monthly Inspection Checklist",
  description: "Complete monthly inspection for UPS systems including voltage checks, battery capacity, and overall condition assessment.",
  schema: {
    fields: [
      {
        id: "asset_tag",
        type: "text",
        label: "Asset Tag",
        placeholder: "Enter asset tag or scan barcode",
        description: "Asset identification number",
        required: true,
        width: "half"
      },
      {
        id: "location_gps",
        type: "gps",
        label: "Location Verification",
        description: "Verify you are at the correct service location",
        required: true,
        width: "half"
      },
      {
        id: "before_photos",
        type: "photo",
        label: "Before Photos",
        description: "Take photos of the UPS system before inspection",
        required: true,
        maxFiles: 3,
        maxFileSize: 10,
        width: "full"
      },
      {
        id: "input_voltage",
        type: "number",
        label: "Input Voltage (V)",
        placeholder: "Measured input voltage",
        required: true,
        unit: "V",
        width: "half",
        validation: {
          min: 100,
          max: 500,
          message: "Input voltage should be between 100-500V"
        }
      },
      {
        id: "output_voltage",
        type: "number",
        label: "Output Voltage (V)",
        placeholder: "Measured output voltage",
        required: true,
        unit: "V",
        width: "half",
        validation: {
          min: 100,
          max: 500,
          message: "Output voltage should be between 100-500V"
        }
      },
      {
        id: "battery_capacity",
        type: "number",
        label: "Battery Capacity (%)",
        placeholder: "Current battery capacity",
        required: true,
        unit: "%",
        width: "third",
        validation: {
          min: 0,
          max: 100,
          message: "Battery capacity must be 0-100%"
        }
      },
      {
        id: "load_percentage",
        type: "number",
        label: "Load Percentage (%)",
        placeholder: "Current load on UPS",
        required: true,
        unit: "%",
        width: "third",
        validation: {
          min: 0,
          max: 100,
          message: "Load must be 0-100%"
        }
      },
      {
        id: "temperature",
        type: "number",
        label: "Temperature (°C)",
        placeholder: "Operating temperature",
        required: false,
        unit: "°C",
        width: "third",
        validation: {
          min: 0,
          max: 60,
          message: "Temperature should be reasonable"
        }
      },
      {
        id: "indicator_status",
        type: "radio",
        label: "Indicator Status",
        description: "Status of UPS indicator lights",
        required: true,
        width: "half",
        options: [
          { label: "Normal (Green)", value: "normal", description: "All systems operating normally" },
          { label: "Warning (Yellow)", value: "warning", description: "Minor issues detected" },
          { label: "Error (Red)", value: "error", description: "Critical issues detected" }
        ]
      },
      {
        id: "components_checked",
        type: "checkbox",
        label: "Components Inspected",
        description: "Select all components that were checked",
        required: true,
        width: "half",
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
        width: "full",
        scale: 5
      },
      {
        id: "inspection_notes",
        type: "text",
        label: "Inspection Notes",
        placeholder: "Additional observations or issues found",
        description: "Enter any notes about the inspection",
        required: false,
        multiline: true,
        rows: 4,
        width: "full"
      },
      {
        id: "maintenance_required",
        type: "radio",
        label: "Maintenance Required",
        description: "Is any maintenance required?",
        required: true,
        width: "full",
        options: [
          { label: "No maintenance required", value: "none" },
          { label: "Minor maintenance needed", value: "minor" },
          { label: "Major maintenance needed", value: "major" },
          { label: "Immediate service required", value: "immediate" }
        ]
      },
      {
        id: "after_photos",
        type: "photo",
        label: "After Photos",
        description: "Take photos after completing inspection",
        required: true,
        maxFiles: 3,
        maxFileSize: 10,
        width: "full"
      },
      {
        id: "technician_signature",
        type: "signature",
        label: "Technician Signature",
        description: "Sign to confirm inspection completion",
        required: true,
        width: "full"
      }
    ],
    settings: {
      requirePhotos: true,
      requireGPS: true,
      requireSignature: true,
      allowOfflineMode: true,
      estimatedDurationMinutes: 30
    }
  }
}

export default function FormRendererPage() {
  const handleFormSubmit = async (data: Record<string, any>) => {
    console.log("Form submitted:", data)

    // Here you would make an API call to submit the form
    try {
      const response = await fetch('/api/forms/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: sampleFormTemplate.id,
          formData: data,
          submissionMetadata: {
            deviceInfo: navigator.userAgent,
            appVersion: '1.0.0',
            userAgent: navigator.userAgent
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log("Submission successful:", result)
        alert("Form submitted successfully!")
      } else {
        throw new Error("Submission failed")
      }
    } catch (error) {
      console.error("Error submitting form:", error)
      alert("Error submitting form. Please try again.")
    }
  }

  const handleFormSave = async (data: Record<string, any>) => {
    console.log("Form saved as draft:", data)

    // Here you would save the form as draft
    try {
      // For demo purposes, just save to localStorage
      localStorage.setItem('form_draft', JSON.stringify(data))
      console.log("Form draft saved successfully")
    } catch (error) {
      console.error("Error saving draft:", error)
    }
  }

  const handleDownload = () => {
    // Create a sample report
    const reportData = {
      template: sampleFormTemplate.name,
      description: sampleFormTemplate.description,
      completedAt: new Date().toISOString(),
      // Would include actual form data here
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ups-inspection-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleShare = () => {
    const shareData = {
      title: 'UPS Inspection Form',
      text: 'Complete UPS inspection checklist',
      url: window.location.href
    }

    if (navigator.share) {
      navigator.share(shareData)
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href)
      alert("Form URL copied to clipboard!")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div>
                <h1 className="text-xl font-semibold text-gray-900">UPS Monthly Inspection</h1>
                <p className="text-sm text-gray-500">Preventive Maintenance Checklist</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="flex items-center">
                <BarChart3 className="w-3 h-3 mr-1" />
                PM Template
              </Badge>

              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>

              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Renderer */}
      <div className="max-w-4xl mx-auto">
        <FormRenderer
          template={sampleFormTemplate}
          initialData={{}}
          onSave={handleFormSave}
          onSubmit={handleFormSubmit}
          mode="create"
          readonly={false}
          showProgress={true}
          multiStep={false}
          autoSave={true}
          autoSaveInterval={30000} // 30 seconds
        />
      </div>
    </div>
  )
}