'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import BaseMap from './BaseMap';
import ClusteredMarkerLayer from './ClusteredMarkerLayer';
import { LatLngExpression } from 'leaflet';

// Icon components
import { MapPin, Filter, Search, Building, Warehouse, Server, Plus, Eye, Settings, Layers } from 'lucide-react';

// Types
interface Asset {
    id: string;
    name: string;
    category: string;
    status: string;
    criticality: string;
}

interface Location {
    id: string;
    tid: string;
    name: string;
    address?: string;
    city?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
    status: 'active' | 'inactive' | 'under_construction' | 'decommissioned';
    locationType: 'branch' | 'warehouse' | 'datacenter' | 'office' | 'other';
    serviceLevel: 'standard' | 'premium' | 'enterprise';
    region?: string;
    area?: string;
    assetCount?: number;
    assets?: Asset[];
    childLocations?: Location[];
}

interface LocationMapProps {
    locations: Location[];
    height?: string | number;
    showControls?: boolean;
    onLocationClick?: (location: Location) => void;
    onLocationSelect?: (location: Location) => void;
    onAddLocation?: (lat: number, lng: number) => void;
    selectedLocationId?: string;
    multiSelect?: boolean;
    selectedLocationIds?: string[];
    className?: string;
    editable?: boolean;
}

const LOCATION_TYPE_COLORS = {
    branch: '#3B82F6',    // Blue
    warehouse: '#10B981', // Green
    datacenter: '#8B5CF6', // Purple
    office: '#F59E0B',    // Amber
    other: '#6B7280',     // Gray
};

const STATUS_COLORS = {
    active: '#22C55E',
    inactive: '#6B7280',
    under_construction: '#F59E0B',
    decommissioned: '#EF4444',
};

const SERVICE_LEVEL_ICONS = {
    standard: '⭐',
    premium: '⭐⭐',
    enterprise: '⭐⭐⭐',
};

function createLocationIcon(
    locationType: string,
    status: string,
    serviceLevel: string,
    assetCount: number = 0
) {
    if (typeof window === 'undefined') return undefined;

    const color = LOCATION_TYPE_COLORS[locationType as keyof typeof LOCATION_TYPE_COLORS] || '#6B7280';
    const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#6B7280';
    const serviceIcon = SERVICE_LEVEL_ICONS[serviceLevel as keyof typeof SERVICE_LEVEL_ICONS] || '⭐';

    return new (window as any).L.DivIcon({
        html: `
            <div class="relative flex items-center justify-center">
                <div class="relative">
                    <div class="w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs"
                         style="background-color: ${color};">
                        ${locationType === 'datacenter' ? '🖥️' :
                          locationType === 'warehouse' ? '📦' :
                          locationType === 'office' ? '🏢' :
                          locationType === 'branch' ? '📍' : '🏛️'}
                    </div>
                    <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full border border-white text-xs flex items-center justify-center"
                         style="background-color: ${statusColor};">
                        ${serviceIcon}
                    </div>
                    ${assetCount > 0 ? `
                        <div class="absolute -bottom-1 -left-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                            ${assetCount > 99 ? '99+' : assetCount}
                        </div>
                    ` : ''}
                </div>
            </div>
        `,
        className: 'custom-location-marker',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -24],
    });
}

export default function LocationMap({
    locations,
    height = 600,
    showControls = true,
    onLocationClick,
    onLocationSelect,
    onAddLocation,
    selectedLocationId,
    multiSelect = false,
    selectedLocationIds = [],
    className = '',
    editable = false,
}: LocationMapProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedServiceLevel, setSelectedServiceLevel] = useState<string>('all');
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [showAssetCount, setShowAssetCount] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const [mapType, setMapType] = useState<'clusters' | 'individual'>('clusters');
    const [mapCenter, setMapCenter] = useState<LatLngExpression>([-6.229728, 106.829500]);
    const [mapZoom, setMapZoom] = useState(10);

    // Get unique values for filters
    const filterOptions = useMemo(() => {
        const types = [...new Set(locations.map(l => l.locationType))];
        const regions = [...new Set(locations.map(l => l.region).filter(Boolean))];
        const serviceLevels = [...new Set(locations.map(l => l.serviceLevel))];

        return { types, regions, serviceLevels };
    }, [locations]);

    // Filter locations based on current filters
    const filteredLocations = useMemo(() => {
        return locations.filter(location => {
            // Must have coordinates
            if (!location.latitude || !location.longitude) return false;

            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesSearch =
                    location.name.toLowerCase().includes(searchLower) ||
                    location.tid.toLowerCase().includes(searchLower) ||
                    location.address?.toLowerCase().includes(searchLower) ||
                    location.city?.toLowerCase().includes(searchLower) ||
                    location.province?.toLowerCase().includes(searchLower);

                if (!matchesSearch) return false;
            }

            // Type filter
            if (selectedType !== 'all' && location.locationType !== selectedType) {
                return false;
            }

            // Status filter
            if (selectedStatus !== 'all' && location.status !== selectedStatus) {
                return false;
            }

            // Service level filter
            if (selectedServiceLevel !== 'all' && location.serviceLevel !== selectedServiceLevel) {
                return false;
            }

            // Region filter
            if (selectedRegion !== 'all' && location.region !== selectedRegion) {
                return false;
            }

            // Show inactive filter
            if (!showInactive && location.status === 'inactive') {
                return false;
            }

            return true;
        });
    }, [locations, searchTerm, selectedType, selectedStatus, selectedServiceLevel, selectedRegion, showInactive]);

    // Prepare markers for the map
    const markers = useMemo(() => {
        const result = [];

        if (mapType === 'clusters') {
            // Group locations by proximity for clustering
            const clusters: Record<string, Location[]> = {};
            const clusterRadius = 0.001; // Approximate clustering radius in degrees

            filteredLocations.forEach(location => {
                const clusterKey = `${Math.round(location.latitude! / clusterRadius)},${Math.round(location.longitude! / clusterRadius)}`;

                if (!clusters[clusterKey]) {
                    clusters[clusterKey] = [];
                }
                clusters[clusterKey].push(location);
            });

            Object.entries(clusters).forEach(([clusterKey, clusterLocations]) => {
                // Calculate cluster center
                const avgLat = clusterLocations.reduce((sum, loc) => sum + loc.latitude!, 0) / clusterLocations.length;
                const avgLng = clusterLocations.reduce((sum, loc) => sum + loc.longitude!, 0) / clusterLocations.length;

                // Determine cluster properties
                const totalAssets = clusterLocations.reduce((sum, loc) => sum + (loc.assetCount || 0), 0);
                const hasCritical = clusterLocations.some(loc => loc.assets?.some(asset => asset.criticality === 'critical'));
                const primaryType = clusterLocations[0].locationType; // Use first location's type
                const allActive = clusterLocations.every(loc => loc.status === 'active');
                const serviceLevel = clusterLocations[0].serviceLevel;

                result.push({
                    id: clusterKey,
                    position: [avgLat, avgLng] as LatLngExpression,
                    icon: createLocationIcon(primaryType, allActive ? 'active' : 'inactive', serviceLevel, totalAssets),
                    popup: (
                        <div className="p-3 min-w-72">
                            <div className="font-semibold text-sm mb-2">
                                {clusterLocations.length} Location{clusterLocations.length > 1 ? 's' : ''}
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {clusterLocations.map(location => (
                                    <div
                                        key={location.id}
                                        className={`p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors ${
                                            (selectedLocationId === location.id || selectedLocationIds.includes(location.id))
                                                ? 'ring-2 ring-blue-500'
                                                : ''
                                        }`}
                                        onClick={() => {
                                            if (onLocationClick) onLocationClick(location);
                                            if (onLocationSelect) onLocationSelect(location);
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium truncate flex-1">
                                                {location.tid}
                                            </span>
                                            <Badge variant="outline" className="text-xs ml-2">
                                                {location.locationType}
                                            </Badge>
                                        </div>
                                        <div className="text-sm font-medium truncate">{location.name}</div>
                                        {location.city && location.province && (
                                            <div className="text-xs text-gray-600">
                                                {location.city}, {location.province}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge
                                                variant="secondary"
                                                className="text-xs"
                                                style={{
                                                    backgroundColor: STATUS_COLORS[location.status as keyof typeof STATUS_COLORS] + '20',
                                                    borderColor: STATUS_COLORS[location.status as keyof typeof STATUS_COLORS],
                                                }}
                                            >
                                                {location.status.replace('_', ' ')}
                                            </Badge>
                                            {location.assetCount && location.assetCount > 0 && (
                                                <Badge variant="outline" className="text-xs">
                                                    {location.assetCount} assets
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ),
                    onClick: () => {
                        if (clusterLocations.length === 1) {
                            if (onLocationClick) onLocationClick(clusterLocations[0]);
                            if (onLocationSelect) onLocationSelect(clusterLocations[0]);
                        }
                    },
                });
            });
        } else {
            // Individual markers for each location
            filteredLocations.forEach(location => {
                result.push({
                    id: location.id,
                    position: [location.latitude!, location.longitude!] as LatLngExpression,
                    icon: createLocationIcon(
                        location.locationType,
                        location.status,
                        location.serviceLevel,
                        showAssetCount ? (location.assetCount || 0) : 0
                    ),
                    popup: (
                        <div className="p-3 min-w-72">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm">
                                    {location.tid}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                    {location.locationType}
                                </Badge>
                            </div>
                            <div className="text-sm font-medium mb-1">{location.name}</div>
                            {location.address && (
                                <div className="text-xs text-gray-600 mb-1">{location.address}</div>
                            )}
                            {location.city && location.province && (
                                <div className="text-xs text-gray-600 mb-2">
                                    {location.city}, {location.province}
                                </div>
                            )}
                            <div className="flex items-center gap-2 mb-2">
                                <Badge
                                    variant="secondary"
                                    className="text-xs"
                                    style={{
                                        backgroundColor: STATUS_COLORS[location.status as keyof typeof STATUS_COLORS] + '20',
                                        borderColor: STATUS_COLORS[location.status as keyof typeof STATUS_COLORS],
                                    }}
                                >
                                    {location.status.replace('_', ' ')}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                    {location.serviceLevel}
                                </Badge>
                            </div>
                            {location.assetCount && location.assetCount > 0 && (
                                <div className="text-xs text-gray-600 mb-2">
                                    {location.assetCount} asset{location.assetCount > 1 ? 's' : ''}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                        if (onLocationClick) onLocationClick(location);
                                    }}
                                >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                </Button>
                                {onLocationSelect && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onLocationSelect(location)}
                                    >
                                        <Settings className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ),
                    onClick: () => {
                        if (onLocationClick) onLocationClick(location);
                        if (onLocationSelect) onLocationSelect(location);
                    },
                });
            });
        }

        return result;
    }, [mapType, filteredLocations, showAssetCount, selectedLocationId, selectedLocationIds, onLocationClick, onLocationSelect]);

    // Calculate map bounds to fit all markers
    const mapBounds = useMemo(() => {
        if (markers.length === 0) return undefined;

        const bounds = markers.reduce((acc, marker) => {
            const [lat, lng] = marker.position;
            acc.extend([lat, lng]);
            return acc;
        }, new (window as any).L.LatLngBounds());

        return bounds;
    }, [markers]);

    // Statistics
    const stats = useMemo(() => {
        return {
            total: filteredLocations.length,
            active: filteredLocations.filter(l => l.status === 'active').length,
            totalAssets: filteredLocations.reduce((sum, l) => sum + (l.assetCount || 0), 0),
            byType: filterOptions.types.reduce((acc, type) => {
                acc[type] = filteredLocations.filter(l => l.locationType === type).length;
                return acc;
            }, {} as Record<string, number>),
            byServiceLevel: filterOptions.serviceLevels.reduce((acc, level) => {
                acc[level] = filteredLocations.filter(l => l.serviceLevel === level).length;
                return acc;
            }, {} as Record<string, number>),
        };
    }, [filteredLocations, filterOptions]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Location Map
                        <Badge variant="secondary">{stats.total} locations</Badge>
                        {stats.totalAssets > 0 && (
                            <Badge variant="outline">{stats.totalAssets} assets</Badge>
                        )}
                    </CardTitle>
                    {editable && onAddLocation && (
                        <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Location
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {showControls && (
                    <div className="mb-4 space-y-4">
                        {/* Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                                <div className="text-xs text-gray-600">Total</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                                <div className="text-xs text-gray-600">Active</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{stats.totalAssets}</div>
                                <div className="text-xs text-gray-600">Assets</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-orange-600">
                                    {Object.values(stats.byType).reduce((max, count) => Math.max(max, count), 0)}
                                </div>
                                <div className="text-xs text-gray-600">Most Common</div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="search">Search:</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="search"
                                        placeholder="Name, TID, address..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-64 pl-8"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="type">Type:</Label>
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {filterOptions.types.map(type => (
                                            <SelectItem key={type} value={type}>
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="status">Status:</Label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="under_construction">Under Construction</SelectItem>
                                        <SelectItem value="decommissioned">Decommissioned</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {filterOptions.regions.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="region">Region:</Label>
                                    <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                                        <SelectTrigger className="w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            {filterOptions.regions.map(region => (
                                                <SelectItem key={region} value={region}>
                                                    {region}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <Label htmlFor="view">View:</Label>
                                <Select value={mapType} onValueChange={(value: 'clusters' | 'individual') => setMapType(value)}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="clusters">Clusters</SelectItem>
                                        <SelectItem value="individual">Individual</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="showAssets"
                                    checked={showAssetCount}
                                    onCheckedChange={setShowAssetCount}
                                />
                                <Label htmlFor="showAssets">Asset Count</Label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="showInactive"
                                    checked={showInactive}
                                    onCheckedChange={setShowInactive}
                                />
                                <Label htmlFor="showInactive">Show Inactive</Label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Map */}
                <BaseMap
                    height={height}
                    bounds={mapBounds}
                    className="border rounded-lg"
                    onMapReady={(map) => {
                        // Add layer controls
                        new (window as any).L.control.scale().addTo(map);

                        // Add click handler for adding new locations if editable
                        if (editable && onAddLocation) {
                            map.on('click', (e: any) => {
                                if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
                                    onAddLocation(e.latlng.lat, e.latlng.lng);
                                }
                            });
                        }
                    }}
                >
                    <ClusteredMarkerLayer
                        markers={markers}
                        onMarkerClick={(marker) => {
                            // Handle marker click if needed
                        }}
                    />
                </BaseMap>

                {editable && (
                    <div className="mt-2 text-xs text-gray-500">
                        💡 Tip: Ctrl/Cmd + Click on map to add new location
                    </div>
                )}
            </CardContent>
        </Card>
    );
}