"use client"

import React from "react"
import { Controller } from "react-hook-form"
import { FormFieldBase, FormFieldConfig } from "./FormFieldBase"
import { Star, StarHalf } from "lucide-react"

interface RatingFieldProps {
  config: FormFieldConfig & {
    scale?: 5 | 10
    allowHalf?: boolean
    showLabels?: boolean
    customLabels?: string[]
    color?: string
    readonly?: boolean
  }
}

interface RatingLabel {
  value: number
  label: string
}

const defaultLabels5: RatingLabel[] = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Good" },
  { value: 4, label: "Very Good" },
  { value: 5, label: "Excellent" }
]

const defaultLabels10: RatingLabel[] = [
  { value: 1, label: "Very Poor" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Below Average" },
  { value: 4, label: "Average" },
  { value: 5, label: "Good" },
  { value: 6, label: "Above Average" },
  { value: 7, label: "Very Good" },
  { value: 8, label: "Excellent" },
  { value: 9, label: "Outstanding" },
  { value: 10, label: "Perfect" }
]

export function RatingField({ config }: RatingFieldProps) {
  const scale = config.scale || 5
  const allowHalf = config.allowHalf || false
  const showLabels = config.showLabels || false
  const customColor = config.color || "#fbbf24" // amber-400

  // Get labels based on scale and custom labels
  const getLabels = (): RatingLabel[] => {
    if (config.customLabels && config.customLabels.length === scale) {
      return config.customLabels.map((label, index) => ({
        value: index + 1,
        label
      }))
    }
    return scale === 5 ? defaultLabels5 : defaultLabels10
  }

  const labels = getLabels()

  // Render star with optional half-star support
  const renderStar = (
    type: "full" | "half" | "empty",
    index: number,
    isSelected: boolean,
    isHovered: boolean
  ) => {
    const color = isSelected || isHovered ? customColor : "#d1d5db" // gray-300
    const size = scale === 10 ? "w-6 h-6" : "w-8 h-8"

    if (type === "half") {
      return (
        <div className="relative" style={{ width: "24px", height: "24px" }}>
          {/* Empty background star */}
          <Star
            className={`absolute inset-0 ${size}`}
            fill="#d1d5db"
            stroke="#d1d5db"
          />
          {/* Half-filled star */}
          <svg
            className={`absolute inset-0 ${size}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <defs>
              <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="50%" stopColor={color} />
                <stop offset="50%" stopColor="#d1d5db" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#gradient-${index})`}
              stroke={color}
              strokeWidth="2"
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        </div>
      )
    }

    return (
      <Star
        key={`${type}-${index}`}
        className={`${size} transition-colors duration-200 ${
          isSelected || isHovered ? "fill-current" : ""
        }`}
        style={{ color: isSelected || isHovered ? color : "#d1d5db" }}
        fill={isSelected || isHovered ? color : "#d1d5db"}
        stroke={isSelected || isHovered ? color : "#d1d5db"}
      />
    )
  }

  return (
    <Controller
      name={config.id}
      rules={{
        required: config.required ? "Rating is required" : false,
        min: {
          value: 1,
          message: "Rating is required"
        }
      }}
      defaultValue={config.defaultValue || 0}
      render={({ field, fieldState }) => {
        const [hoveredValue, setHoveredValue] = React.useState(0)
        const [hoveredHalf, setHoveredHalf] = React.useState(false)

        const handleStarClick = (value: number, isHalf: boolean = false) => {
          if (config.readonly) return

          const actualValue = isHalf && allowHalf ? value - 0.5 : value
          field.onChange(actualValue)
        }

        const handleStarHover = (value: number, isHalf: boolean = false) => {
          if (config.readonly) return

          setHoveredValue(value)
          setHoveredHalf(isHalf)
        }

        const handleMouseLeave = () => {
          setHoveredValue(0)
          setHoveredHalf(false)
        }

        const currentValue = field.value || 0
        const displayValue = hoveredValue || currentValue
        const isHalfStar = hoveredValue ? hoveredHalf : (allowHalf && currentValue % 1 !== 0)

        return (
          <FormFieldBase config={config}>
            <div className="space-y-4">
              {/* Star rating */}
              <div
                className="flex flex-col items-center space-y-2"
                onMouseLeave={handleMouseLeave}
              >
                <div className="flex items-center space-x-1">
                  {[...Array(scale)].map((_, index) => {
                    const starValue = index + 1
                    const isSelected = currentValue >= starValue
                    const isHovered = hoveredValue >= starValue
                    const showHalf = isHalfStar && starValue === Math.ceil(displayValue) && displayValue < starValue

                    return (
                      <button
                        key={index}
                        type="button"
                        className={`p-1 rounded-lg transition-all duration-200 ${
                          config.readonly
                            ? "cursor-default"
                            : "cursor-pointer hover:scale-110"
                        }`}
                        onClick={() => handleStarClick(starValue, false)}
                        onMouseEnter={() => handleStarHover(starValue, false)}
                        disabled={config.readonly}
                        aria-label={`Rate ${starValue} out of ${scale}`}
                      >
                        {showHalf ? (
                          renderStar("half", index, false, false)
                        ) : (
                          renderStar(
                            isSelected || isHovered ? "full" : "empty",
                            index,
                            isSelected,
                            isHovered
                          )
                        )}
                      </button>
                    )
                  })}

                  {/* Half-star option if enabled */}
                  {allowHalf && !config.readonly && (
                    <div className="flex items-center space-x-1">
                      {[...Array(scale)].map((_, index) => {
                        const starValue = index + 1
                        const isHalfSelected = currentValue === starValue - 0.5
                        const isHalfHovered = hoveredValue === starValue - 0.5

                        return (
                          <button
                            key={`half-${index}`}
                            type="button"
                            className={`p-1 rounded-lg transition-all duration-200 opacity-50 hover:opacity-100 hover:scale-110 cursor-pointer`}
                            onClick={() => handleStarClick(starValue, true)}
                            onMouseEnter={() => {
                              setHoveredValue(starValue)
                              setHoveredHalf(true)
                            }}
                            disabled={config.readonly}
                            aria-label={`Rate ${starValue - 0.5} out of ${scale}`}
                          >
                            <div className="relative">
                              <Star
                                className="w-8 h-8"
                                style={{ color: isHalfSelected || isHalfHovered ? customColor : "#d1d5db" }}
                                fill="none"
                                stroke={isHalfSelected || isHalfHovered ? customColor : "#d1d5db"}
                              />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Numeric display */}
                <div className="text-2xl font-bold text-center" style={{ color: customColor }}>
                  {displayValue > 0 ? (
                    <span>
                      {displayValue}
                      <span className="text-lg text-muted-foreground">/{scale}</span>
                    </span>
                  ) : (
                    <span className="text-lg text-muted-foreground">Not rated</span>
                  )}
                </div>
              </div>

              {/* Labels */}
              {showLabels && (
                <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  {labels.map((label) => (
                    <span
                      key={label.value}
                      className={`px-2 py-1 rounded ${
                        currentValue >= label.value
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-gray-50"
                      }`}
                    >
                      {label.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {config.description && (
                <div className="text-sm text-muted-foreground text-center">
                  {config.description}
                </div>
              )}
            </div>
          </FormFieldBase>
        )
      }}
    />
  )
}

export default RatingField