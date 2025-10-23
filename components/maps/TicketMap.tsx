'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import BaseMap from './BaseMap';
import ClusteredMarkerLayer from './ClusteredMarkerLayer';
import { LatLngExpression } from 'leaflet';

// Icon components
import { MapPin, Filter, RefreshCw, Eye, EyeOff, Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// Types
interface Ticket {
    id: string;
    ticketNumber: string;
    title: string;
    category: 'pm' | 'cm';
    status: string;
    priorityLevel: number;
    locationId: string;
    assetId?: string;
    location: {
        id: string;
        tid: string;
        name: string;
        address?: string;
        city?: string;
        latitude?: number;
        longitude?: number;
    };
    asset?: {
        id: string;
        name: string;
        category: string;
    };
    assignedTo?: {
        id: string;
        name: string;
    };
    createdAt: string;
    slaStatus: 'on_time' | 'at_risk' | 'breached';
}

interface TicketMapProps {
    tickets: Ticket[];
    height?: string | number;
    showControls?: boolean;
    onTicketClick?: (ticket: Ticket) => void;
    onLocationClick?: (locationId: string) => void;
    onRefresh?: () => void;
    loading?: boolean;
}

const PRIORITY_COLORS = {
    1: '#DC2626', // Critical - Red
    2: '#F97316', // High - Orange
    3: '#EAB308', // Medium - Yellow
    4: '#22C55E', // Low - Green
};

const STATUS_COLORS = {
    'open': '#3B82F6',      // Blue
    'assigned': '#8B5CF6',  // Purple
    'acknowledged': '#06B6D4', // Cyan
    'on_progress': '#F59E0B', // Amber
    'pending_review': '#EC4899', // Pink
    'approved': '#10B981', // Green
    'closed': '#059669',   // Dark Green
    'rejected': '#EF4444', // Red
    'cancelled': '#6B7280', // Gray
};

const SLA_STATUS_COLORS = {
    'on_time': '#22C55E',
    'at_risk': '#EAB308',
    'breached': '#DC2626',
};

function createCustomIcon(color: string, count: number = 1) {
    if (typeof window === 'undefined') return undefined;

    const isDarkMode = document.documentElement.classList.contains('dark');

    return new (window as any).L.DivIcon({
        html: `
            <div class="relative flex items-center justify-center">
                <div class="absolute w-8 h-8 rounded-full border-2 border-white shadow-lg" style="background-color: ${color};">
                    <div class="w-full h-full rounded-full flex items-center justify-center text-white text-xs font-bold">
                        ${count > 1 ? count : ''}
                    </div>
                </div>
                ${count === 1 ? `
                    <div class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'}" style="background-color: ${color};"></div>
                ` : ''}
            </div>
        `,
        className: 'custom-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
    });
}

export default function TicketMap({
    tickets,
    height = 600,
    showControls = true,
    onTicketClick,
    onLocationClick,
    onRefresh,
    loading = false,
}: TicketMapProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedPriority, setSelectedPriority] = useState<string>('all');
    const [selectedSlaStatus, setSelectedSlaStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showTechnicians, setShowTechnicians] = useState(true);
    const [mapType, setMapType] = useState<'clusters' | 'individual'>('clusters');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [mapCenter, setMapCenter] = useState<LatLngExpression>([-6.229728, 106.829500]);
    const [mapZoom, setMapZoom] = useState(10);

    // Filter tickets based on current filters
    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            // Category filter
            if (selectedCategory !== 'all' && ticket.category !== selectedCategory) {
                return false;
            }

            // Status filter
            if (selectedStatus !== 'all' && ticket.status !== selectedStatus) {
                return false;
            }

            // Priority filter
            if (selectedPriority !== 'all' && ticket.priorityLevel !== parseInt(selectedPriority)) {
                return false;
            }

            // SLA status filter
            if (selectedSlaStatus !== 'all' && ticket.slaStatus !== selectedSlaStatus) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    ticket.ticketNumber.toLowerCase().includes(searchLower) ||
                    ticket.title.toLowerCase().includes(searchLower) ||
                    ticket.location.name.toLowerCase().includes(searchLower) ||
                    ticket.location.tid.toLowerCase().includes(searchLower) ||
                    ticket.assignedTo?.name.toLowerCase().includes(searchLower) ||
                    ticket.asset?.name.toLowerCase().includes(searchLower)
                );
            }

            // Only show tickets with valid coordinates
            return ticket.location.latitude && ticket.location.longitude;
        });
    }, [tickets, selectedCategory, selectedStatus, selectedPriority, selectedSlaStatus, searchTerm]);

    // Group tickets by location for clustering
    const ticketsByLocation = useMemo(() => {
        const groups: Record<string, Ticket[]> = {};

        filteredTickets.forEach(ticket => {
            const key = `${ticket.location.latitude},${ticket.location.longitude}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(ticket);
        });

        return groups;
    }, [filteredTickets]);

    // Prepare markers for the map
    const markers = useMemo(() => {
        const result = [];

        if (mapType === 'clusters') {
            // Cluster markers by location
            Object.entries(ticketsByLocation).forEach(([coordsKey, locationTickets]) => {
                const [lat, lng] = coordsKey.split(',').map(Number);
                const highestPriority = Math.min(...locationTickets.map(t => t.priorityLevel));
                const criticalTickets = locationTickets.filter(t => t.slaStatus === 'breached' || t.slaStatus === 'at_risk');
                const color = criticalTickets.length > 0 ? '#DC2626' : PRIORITY_COLORS[highestPriority as keyof typeof PRIORITY_COLORS];

                result.push({
                    id: coordsKey,
                    position: [lat, lng] as LatLngExpression,
                    icon: createCustomIcon(color, locationTickets.length),
                    popup: (
                        <div className="p-3 min-w-64">
                            <div className="font-semibold text-sm mb-2">
                                {locationTickets[0].location.name}
                            </div>
                            <div className="text-xs text-gray-600 mb-2">
                                {locationTickets[0].location.tid} • {locationTickets.length} ticket{locationTickets.length > 1 ? 's' : ''}
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {locationTickets.map(ticket => (
                                    <div
                                        key={ticket.id}
                                        className="p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => {
                                            setSelectedTicket(ticket);
                                            if (onTicketClick) onTicketClick(ticket);
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium truncate flex-1">
                                                {ticket.ticketNumber}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-xs ml-2"
                                                style={{ borderColor: PRIORITY_COLORS[ticket.priorityLevel as keyof typeof PRIORITY_COLORS] }}
                                            >
                                                P{ticket.priorityLevel}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-gray-600 truncate mt-1">
                                            {ticket.title}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-xs">
                                                {ticket.category.toUpperCase()}
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                                style={{ borderColor: SLA_STATUS_COLORS[ticket.slaStatus] }}
                                            >
                                                {ticket.slaStatus.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ),
                    onClick: () => {
                        if (locationTickets.length === 1) {
                            setSelectedTicket(locationTickets[0]);
                            if (onTicketClick) onTicketClick(locationTickets[0]);
                        }
                    },
                });
            });
        } else {
            // Individual markers for each ticket
            filteredTickets.forEach(ticket => {
                const color = ticket.slaStatus === 'breached' || ticket.slaStatus === 'at_risk'
                    ? '#DC2626'
                    : PRIORITY_COLORS[ticket.priorityLevel as keyof typeof PRIORITY_COLORS];

                result.push({
                    id: ticket.id,
                    position: [ticket.location.latitude!, ticket.location.longitude!] as LatLngExpression,
                    icon: createCustomIcon(color),
                    popup: (
                        <div className="p-3 min-w-64">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm">
                                    {ticket.ticketNumber}
                                </span>
                                <Badge
                                    variant="outline"
                                    className="text-xs"
                                    style={{ borderColor: PRIORITY_COLORS[ticket.priorityLevel as keyof typeof PRIORITY_COLORS] }}
                                >
                                    P{ticket.priorityLevel}
                                </Badge>
                            </div>
                            <div className="text-sm font-medium mb-1">{ticket.title}</div>
                            <div className="text-xs text-gray-600 mb-2">
                                {ticket.location.name} ({ticket.location.tid})
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="text-xs">
                                    {ticket.category.toUpperCase()}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="text-xs"
                                    style={{
                                        backgroundColor: STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS] + '20',
                                        borderColor: STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS],
                                    }}
                                >
                                    {ticket.status.replace('_', ' ')}
                                </Badge>
                            </div>
                            {ticket.assignedTo && (
                                <div className="text-xs text-gray-600 mb-2">
                                    Assigned to: {ticket.assignedTo.name}
                                </div>
                            )}
                            <Button
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                    setSelectedTicket(ticket);
                                    if (onTicketClick) onTicketClick(ticket);
                                }}
                            >
                                View Details
                            </Button>
                        </div>
                    ),
                    onClick: () => {
                        setSelectedTicket(ticket);
                        if (onTicketClick) onTicketClick(ticket);
                    },
                });
            });
        }

        return result;
    }, [mapType, ticketsByLocation, filteredTickets, onTicketClick]);

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
            total: filteredTickets.length,
            pm: filteredTickets.filter(t => t.category === 'pm').length,
            cm: filteredTickets.filter(t => t.category === 'cm').length,
            critical: filteredTickets.filter(t => t.priorityLevel === 1).length,
            high: filteredTickets.filter(t => t.priorityLevel === 2).length,
            breached: filteredTickets.filter(t => t.slaStatus === 'breached').length,
            atRisk: filteredTickets.filter(t => t.slaStatus === 'at_risk').length,
            open: filteredTickets.filter(t => ['open', 'assigned', 'acknowledged', 'on_progress'].includes(t.status)).length,
            pendingReview: filteredTickets.filter(t => t.status === 'pending_review').length,
        };
    }, [filteredTickets]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Live Ticket Map
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-96">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Live Ticket Map
                        <Badge variant="secondary">{stats.total} tickets</Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {onRefresh && (
                            <Button variant="outline" size="sm" onClick={onRefresh}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {showControls && (
                    <div className="mb-4 space-y-4">
                        {/* Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                                <div className="text-xs text-gray-600">Total</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{stats.pm}</div>
                                <div className="text-xs text-gray-600">PM</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-orange-600">{stats.cm}</div>
                                <div className="text-xs text-gray-600">CM</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">{stats.breached}</div>
                                <div className="text-xs text-gray-600">Breached</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-600">{stats.atRisk}</div>
                                <div className="text-xs text-gray-600">At Risk</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{stats.pendingReview}</div>
                                <div className="text-xs text-gray-600">Pending</div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2 min-w-32">
                                <Label htmlFor="search">Search:</Label>
                                <Input
                                    id="search"
                                    placeholder="Ticket number, title, location..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-48"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="category">Category:</Label>
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="pm">PM</SelectItem>
                                        <SelectItem value="cm">CM</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="priority">Priority:</Label>
                                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="1">Critical</SelectItem>
                                        <SelectItem value="2">High</SelectItem>
                                        <SelectItem value="3">Medium</SelectItem>
                                        <SelectItem value="4">Low</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="sla">SLA:</Label>
                                <Select value={selectedSlaStatus} onValueChange={setSelectedSlaStatus}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="on_time">On Time</SelectItem>
                                        <SelectItem value="at_risk">At Risk</SelectItem>
                                        <SelectItem value="breached">Breached</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="mapType">View:</Label>
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
                        </div>
                    </div>
                )}

                {/* Map */}
                <BaseMap
                    height={height}
                    bounds={mapBounds}
                    className="border rounded-lg"
                    onMapReady={(map) => {
                        // Add layer controls, scale, etc.
                        new (window as any).L.control.scale().addTo(map);
                    }}
                >
                    <ClusteredMarkerLayer
                        markers={markers}
                        onMarkerClick={(marker) => {
                            // Handle marker click
                        }}
                    />
                </BaseMap>

                {/* Selected Ticket Detail */}
                {selectedTicket && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">
                                {selectedTicket.ticketNumber} - {selectedTicket.title}
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTicket(null)}
                            >
                                ×
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Location:</span>
                                <div className="font-medium">{selectedTicket.location.name}</div>
                                <div className="text-xs text-gray-500">{selectedTicket.location.tid}</div>
                            </div>
                            <div>
                                <span className="text-gray-600">Status:</span>
                                <div className="font-medium">{selectedTicket.status.replace('_', ' ')}</div>
                            </div>
                            <div>
                                <span className="text-gray-600">Priority:</span>
                                <div className="font-medium">P{selectedTicket.priorityLevel}</div>
                            </div>
                            <div>
                                <span className="text-gray-600">SLA:</span>
                                <div className="font-medium">{selectedTicket.slaStatus.replace('_', ' ')}</div>
                            </div>
                        </div>
                        <div className="mt-3">
                            <Button size="sm" onClick={() => onTicketClick?.(selectedTicket)}>
                                View Full Details
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}