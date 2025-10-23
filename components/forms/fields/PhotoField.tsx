"use client"

import React, { useState, useRef, useCallback } from "react"
import { Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"
import { Upload, X, Camera, Image as ImageIcon, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface PhotoFieldProps {
  config: FormFieldConfig & {
    maxFiles?: number
    maxFileSize?: number // in MB
    allowedTypes?: string[]
    requireGPS?: boolean
    captureMode?: "camera" | "gallery" | "both"
    multiple?: boolean
  }
}

interface UploadedFile {
  file: File
  preview: string
  metadata?: {
    gps?: {
      latitude: number
      longitude: number
      accuracy: number
    }
    timestamp: string
    deviceInfo: string
  }
}

export function PhotoField({ config }: PhotoFieldProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const maxFiles = config.maxFiles || (config.multiple ? 5 : 1)
  const maxFileSize = (config.maxFileSize || 10) * 1024 * 1024 // Convert MB to bytes

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File size must be less than ${maxFileSize / (1024 * 1024)}MB`
    }

    // Check file type
    const allowedTypes = config.allowedTypes || [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ]

    if (!allowedTypes.includes(file.type)) {
      return `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
    }

    return null
  }

  const extractGPSMetadata = async (file: File): Promise<{
    latitude: number
    longitude: number
    accuracy: number
  } | null> => {
    // In a real implementation, you would use a library like exif-js
    // For now, return null (GPS metadata will be captured from device if needed)
    return null
  }

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setError(null)
    setIsUploading(true)

    try {
      const filesArray = Array.from(files)

      // Check total files limit
      if (uploadedFiles.length + filesArray.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`)
        setIsUploading(false)
        return
      }

      const newFiles: UploadedFile[] = []

      for (const file of filesArray) {
        // Validate file
        const validationError = validateFile(file)
        if (validationError) {
          setError(validationError)
          setIsUploading(false)
          return
        }

        // Create preview
        const preview = URL.createObjectURL(file)

        // Extract GPS metadata if required
        let metadata = {
          timestamp: new Date().toISOString(),
          deviceInfo: navigator.userAgent
        }

        if (config.requireGPS) {
          try {
            // Get current location for metadata
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
              })
            })

            metadata = {
              ...metadata,
              gps: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              }
            }
          } catch (gpsError) {
            setError("GPS location is required but could not be obtained")
            setIsUploading(false)
            URL.revokeObjectURL(preview)
            return
          }
        }

        // Try to extract GPS from image EXIF data
        const exifGPS = await extractGPSMetadata(file)
        if (exifGPS && !metadata.gps) {
          metadata.gps = exifGPS
        }

        newFiles.push({
          file,
          preview,
          metadata
        })
      }

      setUploadedFiles(prev => [...prev, ...newFiles])
    } catch (err) {
      setError("Failed to process files")
      console.error("File processing error:", err)
    } finally {
      setIsUploading(false)
    }
  }, [uploadedFiles.length, maxFiles, config.requireGPS])

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const captureFromCamera = () => {
    // Trigger camera capture
    fileInputRef.current?.click()
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? uploadedFiles.length === 0 ? "At least one photo is required" : false : false,
        validate: (value) => {
          if (config.required && (!value || (Array.isArray(value) && value.length === 0))) {
            return "At least one photo is required"
          }
          return true
        }
      }}
      defaultValue={[]}
      render={({ field, fieldState }) => {
        // Sync field value with uploaded files
        React.useEffect(() => {
          field.onChange(uploadedFiles.map(f => ({
            file: f.file,
            preview: f.preview,
            metadata: f.metadata
          })))
        }, [uploadedFiles, field])

        return (
          <FormFieldBase config={config}>
            <div className="space-y-4">
              {/* File input (hidden) */}
              <input
                ref={fileInputRef}
                type="file"
                accept={config.allowedTypes?.join(",") || "image/*"}
                multiple={config.multiple && maxFiles > 1}
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />

              {/* Upload buttons */}
              <div className="flex flex-wrap gap-2">
                {config.captureMode !== "gallery" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={captureFromCamera}
                    disabled={uploadedFiles.length >= maxFiles || isUploading || config.readonly}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                )}
                {config.captureMode !== "camera" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openFileDialog}
                    disabled={uploadedFiles.length >= maxFiles || isUploading || config.readonly}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {config.multiple ? "Upload Photos" : "Upload Photo"}
                  </Button>
                )}
              </div>

              {/* Error display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* File counter */}
              {config.multiple && (
                <div className="text-sm text-muted-foreground">
                  {uploadedFiles.length} / {maxFiles} files
                </div>
              )}

              {/* Preview grid */}
              {uploadedFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {uploadedFiles.map((file, index) => (
                    <Card key={index} className="relative group">
                      <CardContent className="p-0">
                        <div className="aspect-square relative overflow-hidden rounded-md">
                          <img
                            src={file.preview}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover"
                          />

                          {/* Remove button */}
                          {!config.readonly && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}

                          {/* GPS badge */}
                          {file.metadata?.gps && (
                            <Badge variant="secondary" className="absolute bottom-2 left-2 text-xs">
                              📍 GPS
                            </Badge>
                          )}
                        </div>

                        {/* File info */}
                        <div className="p-2">
                          <div className="text-xs text-muted-foreground truncate">
                            {file.file.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {uploadedFiles.length === 0 && !isUploading && (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-md p-8 text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <div className="mt-4 text-sm text-muted-foreground">
                    {config.multiple
                      ? `Upload up to ${maxFiles} photos`
                      : "Upload a photo"
                    }
                    {config.maxFileSize && ` (max ${config.maxFileSize}MB each)`}
                  </div>
                  {config.requireGPS && (
                    <div className="mt-2 text-xs text-orange-600">
                      GPS location is required for all photos
                    </div>
                  )}
                </div>
              )}
            </div>
          </FormFieldBase>
        )
      }}
    />
  )
}

export default PhotoField