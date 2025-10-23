'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import BaseMap from './BaseMap';
import { MapPin, Navigation, AlertTriangle, CheckCircle, RefreshCw, Crosshair } from 'lucide-react';
import { LatLngExpression } from 'leaflet';

// Types
interface Location {
    id: string;
    name: string;
    tid: string;
    address?: string;
    latitude?: number;
    longitude?: number;
}

interface GPSVerificationProps {
    expectedLocation: Location;
    onLocationVerified: (verified: boolean, location: { lat: number; lng: number; accuracy: number }) => void;
    onLocationUpdate?: (location: { lat: number; lng: number; accuracy: number }) => void;
    className?: string;
    required?: boolean;
    toleranceMeters?: number;
    initialLocation?: { lat: number; lng: number; accuracy?: number };
    disabled?: boolean;
}

interface GPSPosition {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export default function GPSVerification({
    expectedLocation,
    onLocationVerified,
    onLocationUpdate,
    className = '',
    required = false,
    toleranceMeters = 50,
    initialLocation,
    disabled = false,
}: GPSVerificationProps) {
    const [currentLocation, setCurrentLocation] = useState<GPSPosition | null>(
        initialLocation ? {
            ...initialLocation,
            accuracy: initialLocation.accuracy || 0,
            timestamp: Date.now(),
        } : null
    );
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string>('');
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed' | 'warning'>('pending');
    const [distance, setDistance] = useState<number | null>(null);
    const [watchId, setWatchId] = useState<number | null>(null);
    const [mapCenter, setMapCenter] = useState<LatLngExpression>([-6.229728, 106.829500]);
    const locationUpdateTimeoutRef = useRef<NodeJS.Timeout>();

    // Calculate distance between two GPS coordinates using Haversine formula
    function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    // Verify location when GPS position is updated
    useEffect(() => {
        if (currentLocation && expectedLocation.latitude && expectedLocation.longitude) {
            const calculatedDistance = calculateDistance(
                expectedLocation.latitude,
                expectedLocation.longitude,
                currentLocation.latitude,
                currentLocation.longitude
            );

            setDistance(calculatedDistance);

            const isVerified = calculatedDistance <= toleranceMeters;
            let status: 'verified' | 'failed' | 'warning' = isVerified ? 'verified' : 'failed';

            // Consider accuracy for warning status
            if (currentLocation.accuracy > toleranceMeters) {
                status = 'warning';
            }

            setVerificationStatus(status);
            onLocationVerified(isVerified, {
                lat: currentLocation.latitude,
                lng: currentLocation.longitude,
                accuracy: currentLocation.accuracy,
            });

            // Update map center to show both points
            const bounds = [
                [expectedLocation.latitude, expectedLocation.longitude],
                [currentLocation.latitude, currentLocation.longitude],
            ] as [LatLngExpression, LatLngExpression];

            // Center map between the two points
            const centerLat = (expectedLocation.latitude + currentLocation.latitude) / 2;
            const centerLng = (expectedLocation.longitude + currentLocation.longitude) / 2;
            setMapCenter([centerLat, centerLng]);
        }
    }, [currentLocation, expectedLocation, toleranceMeters, onLocationVerified]);

    // Get current GPS position
    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by this browser');
            return;
        }

        setIsGettingLocation(true);
        setLocationError('');

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000, // Accept positions up to 1 minute old
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newPosition: GPSPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp,
                };

                setCurrentLocation(newPosition);
                setIsGettingLocation(false);

                if (onLocationUpdate) {
                    onLocationUpdate({
                        lat: newPosition.latitude,
                        lng: newPosition.longitude,
                        accuracy: newPosition.accuracy,
                    });
                }
            },
            (error) => {
                setIsGettingLocation(false);
                let errorMessage = 'Failed to get location';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please enable location access.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out.';
                        break;
                }

                setLocationError(errorMessage);
            },
            options
        );
    };

    // Start watching position for real-time updates
    const startWatching = () => {
        if (!navigator.geolocation || watchId !== null) return;

        const newWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const newPosition: GPSPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp,
                };

                setCurrentLocation(newPosition);

                // Debounce location updates
                if (locationUpdateTimeoutRef.current) {
                    clearTimeout(locationUpdateTimeoutRef.current);
                }

                locationUpdateTimeoutRef.current = setTimeout(() => {
                    if (onLocationUpdate) {
                        onLocationUpdate({
                            lat: newPosition.latitude,
                            lng: newPosition.longitude,
                            accuracy: newPosition.accuracy,
                        });
                    }
                }, 1000); // 1 second debounce
            },
            (error) => {
                console.error('GPS watch error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000, // Accept positions up to 5 seconds old for watching
            }
        );

        setWatchId(newWatchId);
    };

    // Stop watching position
    const stopWatching = () => {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            setWatchId(null);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopWatching();
            if (locationUpdateTimeoutRef.current) {
                clearTimeout(locationUpdateTimeoutRef.current);
            }
        };
    }, []);

    // Auto-get location on mount if no initial location
    useEffect(() => {
        if (!currentLocation && !disabled) {
            getCurrentLocation();
        }
    }, []);

    const getStatusIcon = () => {
        switch (verificationStatus) {
            case 'verified':
                return <CheckCircle className="h-5 w-5 text-green-600" />;
            case 'failed':
                return <AlertTriangle className="h-5 w-5 text-red-600" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
            default:
                return <Navigation className="h-5 w-5 text-blue-600" />;
        }
    };

    const getStatusColor = () => {
        switch (verificationStatus) {
            case 'verified':
                return 'border-green-200 bg-green-50';
            case 'failed':
                return 'border-red-200 bg-red-50';
            case 'warning':
                return 'border-yellow-200 bg-yellow-50';
            default:
                return 'border-blue-200 bg-blue-50';
        }
    };

    return (
        <Card className={`border-2 ${getStatusColor()} ${className}`}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        GPS Location Verification
                        {required && <span className="text-red-500">*</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        {getStatusIcon()}
                        <Badge variant={verificationStatus === 'verified' ? 'default' : 'secondary'}>
                            {verificationStatus === 'verified' && 'Verified'}
                            {verificationStatus === 'failed' && 'Failed'}
                            {verificationStatus === 'warning' && 'Warning'}
                            {verificationStatus === 'pending' && 'Pending'}
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Expected Location */}
                <div className="text-sm">
                    <div className="font-medium">Expected Location:</div>
                    <div className="text-gray-600">{expectedLocation.name} ({expectedLocation.tid})</div>
                    {expectedLocation.address && (
                        <div className="text-gray-500 text-xs">{expectedLocation.address}</div>
                    )}
                    {expectedLocation.latitude && expectedLocation.longitude && (
                        <div className="text-gray-400 text-xs">
                            GPS: {expectedLocation.latitude.toFixed(6)}, {expectedLocation.longitude.toFixed(6)}
                        </div>
                    )}
                </div>

                {/* Current Location Status */}
                {currentLocation && (
                    <div className="text-sm">
                        <div className="font-medium">Current Location:</div>
                        <div className="text-gray-600">
                            GPS: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                        </div>
                        <div className="text-gray-500 text-xs">
                            Accuracy: ±{currentLocation.accuracy.toFixed(0)}m
                        </div>
                        {distance !== null && (
                            <div className="mt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Distance from expected:</span>
                                    <span className={`text-sm font-bold ${
                                        distance <= toleranceMeters ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {distance.toFixed(0)}m
                                    </span>
                                </div>
                                <Progress
                                    value={Math.min((distance / toleranceMeters) * 100, 100)}
                                    className="mt-1 h-2"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                    Tolerance: ±{toleranceMeters}m
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Error Message */}
                {locationError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{locationError}</AlertDescription>
                    </Alert>
                )}

                {/* Map */}
                {(currentLocation || expectedLocation.latitude) && (
                    <div className="border rounded-lg overflow-hidden">
                        <BaseMap
                            height={300}
                            center={mapCenter}
                            zoom={currentLocation ? 15 : 13}
                            className="h-64"
                        >
                            {/* This would contain markers for expected and current locations */}
                            {/* Implementation would require dynamic import of Marker components */}
                        </BaseMap>
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={getCurrentLocation}
                            disabled={isGettingLocation || disabled}
                        >
                            {isGettingLocation ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Getting Location...
                                </>
                            ) : (
                                <>
                                    <Crosshair className="h-4 w-4 mr-2" />
                                    Get Current Location
                                </>
                            )}
                        </Button>

                        {watchId === null ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={startWatching}
                                disabled={disabled}
                            >
                                <Navigation className="h-4 w-4 mr-2" />
                                Track Location
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={stopWatching}
                                disabled={disabled}
                            >
                                <Navigation className="h-4 w-4 mr-2" />
                                Stop Tracking
                            </Button>
                        )}
                    </div>

                    {currentLocation && (
                        <div className="text-xs text-gray-500">
                            Last updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}
                        </div>
                    )}
                </div>

                {/* Verification Status Message */}
                {verificationStatus !== 'pending' && (
                    <Alert className={verificationStatus === 'verified' ? 'border-green-200 bg-green-50' : ''}>
                        {getStatusIcon()}
                        <AlertDescription>
                            {verificationStatus === 'verified' && (
                                <span className="text-green-800">
                                    Location verified successfully! You are within the acceptable range.
                                </span>
                            )}
                            {verificationStatus === 'failed' && (
                                <span className="text-red-800">
                                    Location verification failed. You are {distance?.toFixed(0)}m away from the expected location (tolerance: ±{toleranceMeters}m).
                                </span>
                            )}
                            {verificationStatus === 'warning' && (
                                <span className="text-yellow-800">
                                    GPS accuracy is low (±{currentLocation?.accuracy.toFixed(0)}m). Location verification may not be reliable.
                                </span>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}