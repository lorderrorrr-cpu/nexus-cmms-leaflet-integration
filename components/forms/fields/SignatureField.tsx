"use client"

import React, { useRef, useState, useEffect } from "react"
import { Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"
import { Pen, RotateCcw, Download, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SignatureFieldProps {
  config: FormFieldConfig & {
    width?: number
    height?: number
    strokeWidth?: number
    strokeColor?: string
    backgroundColor?: string
    showTimestamp?: boolean
    showClearButton?: boolean
    showUndoButton?: boolean
    captureDeviceInfo?: boolean
  }
}

export function SignatureField({ config }: SignatureFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [deviceInfo, setDeviceInfo] = useState<string | null>(null)

  const width = config.width || 400
  const height = config.height || 200
  const strokeWidth = config.strokeWidth || 2
  const strokeColor = config.strokeColor || "#000000"
  const backgroundColor = config.backgroundColor || "#ffffff"

  // Get device information
  useEffect(() => {
    if (config.captureDeviceInfo) {
      setDeviceInfo(
        `${navigator.userAgent.substring(0, 100)}${navigator.userAgent.length > 100 ? "..." : ""}`
      )
    }
  }, [config.captureDeviceInfo])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Set canvas background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // Set drawing styles
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    setIsEmpty(true)
  }, [width, height, strokeWidth, strokeColor, backgroundColor])

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (config.readonly) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return

    const { x, y } = getCoordinates(e)

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setIsEmpty(false)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || config.readonly) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    if (config.readonly) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)
    setIsEmpty(true)
  }

  const undoLastStroke = () => {
    // This is a simplified undo - in a real implementation,
    // you would store stroke history
    if (config.readonly) return
    clearSignature()
  }

  const getSignatureData = (): string => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return ""

    return canvas.toDataURL("image/png")
  }

  const downloadSignature = () => {
    const dataURL = getSignatureData()
    if (!dataURL) return

    const link = document.createElement("a")
    link.download = `signature_${Date.now()}.png`
    link.href = dataURL
    link.click()
  }

  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "Signature is required" : false,
        validate: (value) => {
          if (config.required && !value) {
            return "Signature is required"
          }
          if (value && typeof value === "string" && value.startsWith("data:image")) {
            // Basic validation that it's actually an image
            return true
          }
          return config.required ? "Please provide a valid signature" : true
        }
      }}
      defaultValue=""
      render={({ field, fieldState }) => {
        // Update field value when signature changes
        React.useEffect(() => {
          if (!isEmpty) {
            const signatureData = getSignatureData()
            field.onChange({
              data: signatureData,
              timestamp: new Date().toISOString(),
              deviceInfo: deviceInfo,
              dimensions: { width, height }
            })
          } else {
            field.onChange("")
          }
        }, [isEmpty, field, deviceInfo, width, height])

        return (
          <FormFieldBase config={config}>
            <div className="space-y-4">
              {/* Canvas container */}
              <Card className="w-fit">
                <CardContent className="p-2">
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      className={`border-2 ${
                        fieldState.error
                          ? "border-destructive"
                          : isEmpty && config.required
                          ? "border-orange-300"
                          : "border-gray-300"
                      } rounded cursor-crosshair bg-white`}
                      style={{
                        touchAction: "none", // Prevent touch scrolling while drawing
                        maxWidth: "100%",
                        height: "auto"
                      }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />

                    {/* Empty state overlay */}
                    {isEmpty && !config.readonly && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-gray-400 text-sm">
                          <Pen className="w-8 h-8 mx-auto mb-2" />
                          Sign here
                        </div>
                      </div>
                    )}

                    {/* Readonly overlay */}
                    {config.readonly && (
                      <div className="absolute inset-0 bg-white bg-opacity-0 pointer-events-none" />
                    )}
                  </div>

                  {/* Canvas dimensions info */}
                  <div className="text-xs text-gray-500 text-center mt-1">
                    {width} × {height}px
                  </div>
                </CardContent>
              </Card>

              {/* Control buttons */}
              {!config.readonly && (
                <div className="flex flex-wrap gap-2">
                  {(config.showClearButton !== false) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSignature}
                      disabled={isEmpty}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  )}

                  {(config.showUndoButton !== false) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={undoLastStroke}
                      disabled={isEmpty}
                    >
                      Undo
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadSignature}
                    disabled={isEmpty}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              )}

              {/* Validation error */}
              {fieldState.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fieldState.error.message}</AlertDescription>
                </Alert>
              )}

              {/* Device info */}
              {deviceInfo && (
                <div className="text-xs text-muted-foreground">
                  <strong>Device:</strong> {deviceInfo}
                </div>
              )}

              {/* Timestamp */}
              {!isEmpty && config.showTimestamp && (
                <div className="text-xs text-muted-foreground">
                  <strong>Signed:</strong> {new Date().toLocaleString()}
                </div>
              )}

              {/* Instructions */}
              {isEmpty && !config.readonly && (
                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
                  <Pen className="h-4 w-4 inline mr-2" />
                  Use your mouse or finger to sign in the area above
                  {config.required && <span className="text-orange-600"> (signature is required)</span>}
                </div>
              )}
            </div>
          </FormFieldBase>
        )
      }}
    />
  )
}

export default SignatureField