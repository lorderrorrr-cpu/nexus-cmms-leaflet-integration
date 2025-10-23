"use client"

import React, { useState, useCallback, useRef } from "react"
import { Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"
import { Upload, X, File, FileText, Download, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface FileFieldProps {
  config: FormFieldConfig & {
    maxFiles?: number
    maxFileSize?: number // in MB
    allowedTypes?: string[]
    multiple?: boolean
    showPreview?: boolean
    autoUpload?: boolean
  }
}

interface UploadedFile {
  file: File
  id: string
  progress: number
  status: "pending" | "uploading" | "completed" | "error"
  error?: string
  url?: string
}

const getFileIcon = (fileName: string, mimeType: string) => {
  if (mimeType.startsWith("image/")) return <File className="h-6 w-6 text-blue-500" />
  if (mimeType.includes("pdf")) return <FileText className="h-6 w-6 text-red-500" />
  if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className="h-6 w-6 text-blue-600" />
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return <FileText className="h-6 w-6 text-green-600" />
  return <File className="h-6 w-6 text-gray-500" />
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function FileField({ config }: FileFieldProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const maxFiles = config.maxFiles || (config.multiple ? 5 : 1)
  const maxFileSize = (config.maxFileSize || 10) * 1024 * 1024 // Convert MB to bytes

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File size must be less than ${maxFileSize / (1024 * 1024)}MB`
    }

    // Check file type
    if (config.allowedTypes && config.allowedTypes.length > 0) {
      const allowedTypes = config.allowedTypes.join(", ")
      if (!config.allowedTypes.includes(file.type)) {
        return `Invalid file type. Allowed types: ${allowedTypes}`
      }
    }

    return null
  }

  const simulateFileUpload = async (uploadedFile: UploadedFile): Promise<void> => {
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 10) {
      uploadedFile.progress = progress
      setUploadedFiles(prev => [...prev])
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Mark as completed (in real implementation, this would happen when upload succeeds)
    uploadedFile.status = "completed"
    uploadedFile.url = URL.createObjectURL(uploadedFile.file)
    setUploadedFiles(prev => [...prev])
  }

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const filesArray = Array.from(files)

    // Check total files limit
    if (uploadedFiles.length + filesArray.length > maxFiles) {
      return
    }

    const newFiles: UploadedFile[] = []

    for (const file of filesArray) {
      // Validate file
      const validationError = validateFile(file)
      if (validationError) {
        newFiles.push({
          file,
          id: Math.random().toString(36).substr(2, 9),
          progress: 0,
          status: "error",
          error: validationError
        })
        continue
      }

      const uploadedFile: UploadedFile = {
        file,
        id: Math.random().toString(36).substr(2, 9),
        progress: 0,
        status: config.autoUpload ? "uploading" : "pending"
      }

      newFiles.push(uploadedFile)
    }

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Start upload simulation if autoUpload is enabled
    if (config.autoUpload) {
      for (const uploadedFile of newFiles.filter(f => f.status === "uploading")) {
        simulateFileUpload(uploadedFile)
      }
    }
  }, [uploadedFiles.length, maxFiles, config.allowedTypes, config.autoUpload, maxFileSize])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id))
  }

  const downloadFile = (file: UploadedFile) => {
    const url = file.url || URL.createObjectURL(file.file)
    const link = document.createElement("a")
    link.href = url
    link.download = file.file.name
    link.click()
    if (!file.url) {
      URL.revokeObjectURL(url)
    }
  }

  const retryUpload = async (file: UploadedFile) => {
    file.status = "uploading"
    file.progress = 0
    file.error = undefined
    setUploadedFiles(prev => [...prev])
    await simulateFileUpload(file)
  }

  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? uploadedFiles.length === 0 ? "At least one file is required" : false : false,
        validate: (value) => {
          if (config.required && (!value || (Array.isArray(value) && value.length === 0))) {
            return "At least one file is required"
          }

          // Check for failed uploads
          const hasFailedUploads = uploadedFiles.some(f => f.status === "error")
          if (hasFailedUploads) {
            return "Some files failed to upload. Please retry or remove them."
          }

          return true
        }
      }}
      defaultValue={[]}
      render={({ field, fieldState }) => {
        // Sync field value with uploaded files
        React.useEffect(() => {
          field.onChange(uploadedFiles.map(f => ({
            id: f.id,
            file: f.file,
            status: f.status,
            url: f.url
          })))
        }, [uploadedFiles, field])

        return (
          <FormFieldBase config={config}>
            <div className="space-y-4">
              {/* File input (hidden) */}
              <input
                ref={fileInputRef}
                type="file"
                accept={config.allowedTypes?.join(",")}
                multiple={config.multiple && maxFiles > 1}
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />

              {/* Drag and drop area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4 text-sm text-gray-600">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadedFiles.length >= maxFiles || config.readonly}
                  >
                    Choose files
                  </Button>
                  <span className="ml-2">or drag and drop</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {config.multiple
                    ? `Upload up to ${maxFiles} files`
                    : "Upload 1 file"
                  }
                  {config.maxFileSize && ` (max ${config.maxFileSize}MB each)`}
                  {config.allowedTypes && (
                    <div className="mt-1">
                      Allowed types: {config.allowedTypes.join(", ")}
                    </div>
                  )}
                </div>
              </div>

              {/* File list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} uploaded
                  </div>

                  {uploadedFiles.map((file) => (
                    <Card key={file.id} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {getFileIcon(file.file.name, file.file.type)}
                          </div>

                          <div className="flex-grow min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {file.file.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatFileSize(file.file.size)}
                            </div>

                            {/* Progress bar */}
                            {file.status === "uploading" && (
                              <Progress value={file.progress} className="mt-2 h-1" />
                            )}

                            {/* Error message */}
                            {file.status === "error" && (
                              <div className="text-xs text-red-600 mt-1">
                                {file.error || "Upload failed"}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Status indicator */}
                            <div className="text-xs">
                              {file.status === "completed" && (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  Completed
                                </Badge>
                              )}
                              {file.status === "uploading" && (
                                <Badge variant="default" className="bg-blue-100 text-blue-800">
                                  {file.progress}%
                                </Badge>
                              )}
                              {file.status === "error" && (
                                <Badge variant="destructive">
                                  Failed
                                </Badge>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex space-x-1">
                              {file.status === "completed" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => downloadFile(file)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}

                              {file.status === "error" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => retryUpload(file)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                              )}

                              {!config.readonly && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(file.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Validation error */}
              {fieldState.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fieldState.error.message}</AlertDescription>
                </Alert>
              )}
            </div>
          </FormFieldBase>
        )
      }}
    />
  )
}

export default FileField