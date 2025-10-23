"use client"

import React, { useState, useEffect } from "react"
import { Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"
import { MapPin, RefreshCw, AlertCircle, CheckCircle, Loader2 } from "lucide-react"

interface GPSFieldProps {
  config: FormFieldConfig & {
    radiusMeters?: number
    accuracyThreshold?: number // in meters
    captureMode?: "current" | "watch" | "manual"
    showCoordinates?: boolean
    showMap?: boolean
  }
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
}

export function GPSField({ config }: GPSFieldProps) {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)

  const accuracyThreshold = config.accuracyThreshold || 100 // Default 100 meters
  const radiusMeters = config.radiusMeters || 50 // Default 50 meters

  const getCurrentLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp ? new Date(position.timestamp).toISOString() : new Date().toISOString()
          })
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error("Location permission denied. Please enable location access."))
              break
            case error.POSITION_UNAVAILABLE:
              reject(new Error("Location information is unavailable."))
              break
            case error.TIMEOUT:
              reject(new Error("Location request timed out."))
              break
            default:
              reject(new Error("An unknown error occurred while getting location."))
              break
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000 // Accept locations up to 30 seconds old
        }
      )
    })
  }

  const captureLocation = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const locationData = await getCurrentLocation()

      // Check accuracy threshold
      if (locationData.accuracy > accuracyThreshold) {
        setError(`GPS accuracy (${locationData.accuracy.toFixed(0)}m) exceeds threshold (${accuracyThreshold}m). Please try again in an open area.`)
        return
      }

      setLocation(locationData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture location")
    } finally {
      setIsLoading(false)
    }
  }

  const startWatching = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser")
      return
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp ? new Date(position.timestamp).toISOString() : new Date().toISOString()
        }

        if (locationData.accuracy <= accuracyThreshold) {
          setLocation(locationData)
          setError(null)
        }
      },
      (error) => {
        console.error("GPS watch error:", error)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    )

    setWatchId(id)
  }

  const stopWatching = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }

  const clearLocation = () => {
    setLocation(null)
    setError(null)
  }

  useEffect(() => {
    if (config.captureMode === "watch") {
      startWatching()
    }

    return () => {
      stopWatching()
    }
  }, [config.captureMode])

  useEffect(() => {
    // Auto-capture location if set to current mode
    if (config.captureMode === "current" && !location && !error) {
      captureLocation()
    }
  }, [config.captureMode])

  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "GPS location is required" : false,
        validate: (value) => {
          if (config.required && !value) {
            return "GPS location is required"
          }
          if (value && value.accuracy > accuracyThreshold) {
            return `GPS accuracy exceeds threshold of ${accuracyThreshold}m`
          }
          return true
        }
      }}
      defaultValue={null}
      render={({ field, fieldState }) => {
        // Sync field value with location state
        React.useEffect(() => {
          field.onChange(location)
        }, [location, field])

        return (
          <FormFieldBase config={config}>
            <div className="space-y-4">
              {/* Location status and controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {location ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        Location captured
                      </span>
                      <Badge variant="outline" className="text-xs">
                        ±{location.accuracy.toFixed(0)}m
                      </Badge>
                    </>
                  ) : error ? (
                    <>
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <span className="text-sm font-medium text-destructive">
                        {error}
                      </span>
                    </>
                  ) : isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">
                        Getting location...
                      </span>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        No location captured
                      </span>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                {config.captureMode !== "current" && !config.readonly && (
                  <div className="flex space-x-2">
                    {location && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearLocation}
                      >
                        Clear
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={captureLocation}
                      disabled={isLoading || config.readonly}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      {location ? "Update" : "Capture"} Location
                    </Button>
                  </div>
                )}
              </div>

              {/* Error display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Location details */}
              {location && (
                <div className="space-y-3">
                  {config.showCoordinates && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Latitude:</span>
                        <span className="ml-2 font-mono">{location.latitude.toFixed(8)}</span>
                      </div>
                      <div>
                        <span className="font-medium">Longitude:</span>
                        <span className="ml-2 font-mono">{location.longitude.toFixed(8)}</span>
                      </div>
                      <div>
                        <span className="font-medium">Accuracy:</span>
                        <span className="ml-2">{location.accuracy.toFixed(0)}m</span>
                      </div>
                      <div>
                        <span className="font-medium">Time:</span>
                        <span className="ml-2">
                          {new Date(location.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Accuracy indicator */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Accuracy</span>
                      <span className={location.accuracy <= accuracyThreshold ? "text-green-600" : "text-orange-600"}>
                        {location.accuracy.toFixed(0)}m / {accuracyThreshold}m threshold
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-colors ${
                          location.accuracy <= accuracyThreshold
                            ? "bg-green-600"
                            : "bg-orange-600"
                        }`}
                        style={{
                          width: `${Math.min(100, (location.accuracy / accuracyThreshold) * 100)}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Radius indicator */}
                  {radiusMeters && (
                    <div className="text-xs text-muted-foreground">
                      Verification radius: {radiusMeters}m
                    </div>
                  )}
                </div>
              )}

              {/* Instructions */}
              {!location && !isLoading && (
                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  {config.captureMode === "current"
                    ? "Location will be captured automatically."
                    : "Click 'Capture Location' to get current GPS coordinates."
                  }
                  {accuracyThreshold && (
                    <span className="block mt-1">
                      Accuracy should be within {accuracyThreshold} meters.
                    </span>
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

export default GPSField