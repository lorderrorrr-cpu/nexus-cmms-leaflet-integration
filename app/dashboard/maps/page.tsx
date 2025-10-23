'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TicketMap from '@/components/maps/TicketMap';
import LocationMap from '@/components/maps/LocationMap';
import GPSVerification from '@/components/maps/GPSVerification';
import { MapPin, Activity, Map, Navigation, AlertTriangle, RefreshCw } from 'lucide-react';

// Mock data for demonstration
const mockLocations = [
    {
        id: '1',
        tid: '160001',
        name: 'Jakarta Central Branch',
        address: 'Jl. Sudirman No. 123',
        city: 'Jakarta',
        province: 'DKI Jakarta',
        latitude: -6.229728,
        longitude: 106.829500,
        status: 'active' as const,
        locationType: 'branch' as const,
        serviceLevel: 'premium' as const,
        region: 'Jakarta',
        area: 'Central Jakarta',
        assetCount: 12,
        assets: [
            { id: '1', name: 'UPS System 1', category: 'UPS', status: 'operational', criticality: 'high' },
            { id: '2', name: 'CCTV Camera 1', category: 'CCTV', status: 'operational', criticality: 'medium' },
        ],
    },
    {
        id: '2',
        tid: '160002',
        name: 'Surabaya East Branch',
        address: 'Jl. Ahmad Yani No. 456',
        city: 'Surabaya',
        province: 'East Java',
        latitude: -7.257472,
        longitude: 112.752090,
        status: 'active' as const,
        locationType: 'branch' as const,
        serviceLevel: 'standard' as const,
        region: 'East Java',
        area: 'Surabaya',
        assetCount: 8,
    },
    {
        id: '3',
        tid: '160003',
        name: 'Bandung Data Center',
        address: 'Jl. Gatot Subroto No. 789',
        city: 'Bandung',
        province: 'West Java',
        latitude: -6.917474,
        longitude: 107.619123,
        status: 'active' as const,
        locationType: 'datacenter' as const,
        serviceLevel: 'enterprise' as const,
        region: 'West Java',
        area: 'Bandung',
        assetCount: 45,
    },
    {
        id: '4',
        tid: '160004',
        name: 'Medan Office',
        address: 'Jl. Merdeka No. 321',
        city: 'Medan',
        province: 'North Sumatra',
        latitude: 3.595196,
        longitude: 98.672223,
        status: 'active' as const,
        locationType: 'office' as const,
        serviceLevel: 'standard' as const,
        region: 'Sumatra',
        area: 'Medan',
        assetCount: 5,
    },
];

const mockTickets = [
    {
        id: '1',
        ticketNumber: 'CM-20241023-1234',
        title: 'UPS Battery Replacement Needed',
        category: 'cm' as const,
        status: 'assigned' as const,
        priorityLevel: 2,
        locationId: '1',
        location: mockLocations[0],
        asset: mockLocations[0].assets?.[0],
        assignedTo: { id: 'tech1', name: 'Ahmad Technician' },
        createdAt: '2024-10-23T08:30:00Z',
        slaStatus: 'at_risk' as const,
    },
    {
        id: '2',
        ticketNumber: 'PM-20241023-5678',
        title: 'Monthly PM Check - UPS Systems',
        category: 'pm' as const,
        status: 'on_progress' as const,
        priorityLevel: 3,
        locationId: '3',
        location: mockLocations[2],
        assignedTo: { id: 'tech2', name: 'Budi Technician' },
        createdAt: '2024-10-23T07:00:00Z',
        slaStatus: 'on_time' as const,
    },
    {
        id: '3',
        ticketNumber: 'CM-20241023-9012',
        title: 'Network Connectivity Issues',
        category: 'cm' as const,
        status: 'open' as const,
        priorityLevel: 1,
        locationId: '2',
        location: mockLocations[1],
        createdAt: '2024-10-23T09:15:00Z',
        slaStatus: 'breached' as const,
    },
];

export default function MapsDashboard() {
    const [activeTab, setActiveTab] = useState('tickets');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [gpsVerified, setGpsVerified] = useState(false);

    const handleRefresh = async () => {
        setIsLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsLoading(false);
    };

    const handleTicketClick = (ticket: any) => {
        setSelectedTicket(ticket);
        console.log('Ticket clicked:', ticket);
    };

    const handleLocationClick = (location: any) => {
        setSelectedLocation(location);
        console.log('Location clicked:', location);
    };

    const handleLocationVerified = (verified: boolean, location: { lat: number; lng: number; accuracy: number }) => {
        setGpsVerified(verified);
        setGpsLocation(location);
        console.log('Location verified:', verified, location);
    };

    const handleAddLocation = (lat: number, lng: number) => {
        console.log('Add location at:', lat, lng);
        // This would open a dialog to create a new location
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Maps Dashboard</h1>
                    <p className="text-gray-600">Geographic visualization and GPS features for Nexus CMMS</p>
                </div>
                <Button onClick={handleRefresh} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Alert about Leaflet integration */}
            <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                    This dashboard demonstrates the Leaflet Maps integration with real-time ticket tracking,
                    location management, and GPS verification features. All map components are fully responsive
                    and support clustering, filtering, and interactive controls.
                </AlertDescription>
            </Alert>

            {/* Main Dashboard Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="tickets" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Live Tickets
                    </TabsTrigger>
                    <TabsTrigger value="locations" className="flex items-center gap-2">
                        <Map className="h-4 w-4" />
                        Locations
                    </TabsTrigger>
                    <TabsTrigger value="gps" className="flex items-center gap-2">
                        <Navigation className="h-4 w-4" />
                        GPS Verification
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Analytics
                    </TabsTrigger>
                </TabsList>

                {/* Live Tickets Map */}
                <TabsContent value="tickets" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-3">
                            <TicketMap
                                tickets={mockTickets}
                                height={700}
                                onTicketClick={handleTicketClick}
                                onRefresh={handleRefresh}
                                loading={isLoading}
                            />
                        </div>
                        <div className="space-y-4">
                            {/* Selected Ticket Details */}
                            {selectedTicket && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Selected Ticket</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div>
                                            <div className="text-sm text-gray-600">Ticket Number</div>
                                            <div className="font-medium">{selectedTicket.ticketNumber}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Title</div>
                                            <div className="font-medium">{selectedTicket.title}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Location</div>
                                            <div className="font-medium">{selectedTicket.location.name}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Status</div>
                                            <Badge variant="secondary">{selectedTicket.status}</Badge>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Priority</div>
                                            <Badge variant="outline">P{selectedTicket.priorityLevel}</Badge>
                                        </div>
                                        {selectedTicket.assignedTo && (
                                            <div>
                                                <div className="text-sm text-gray-600">Assigned To</div>
                                                <div className="font-medium">{selectedTicket.assignedTo.name}</div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Quick Stats */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Quick Stats</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Total Tickets</span>
                                        <Badge variant="secondary">{mockTickets.length}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">PM Tickets</span>
                                        <Badge variant="secondary">
                                            {mockTickets.filter(t => t.category === 'pm').length}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">CM Tickets</span>
                                        <Badge variant="secondary">
                                            {mockTickets.filter(t => t.category === 'cm').length}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Critical Priority</span>
                                        <Badge variant="destructive">
                                            {mockTickets.filter(t => t.priorityLevel === 1).length}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">SLA Breached</span>
                                        <Badge variant="destructive">
                                            {mockTickets.filter(t => t.slaStatus === 'breached').length}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Locations Map */}
                <TabsContent value="locations" className="space-y-6">
                    <LocationMap
                        locations={mockLocations}
                        height={700}
                        onLocationClick={handleLocationClick}
                        onAddLocation={handleAddLocation}
                        editable={true}
                    />

                    {/* Selected Location Details */}
                    {selectedLocation && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Selected Location Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <h3 className="font-semibold mb-3">Basic Information</h3>
                                        <div className="space-y-2 text-sm">
                                            <div><span className="text-gray-600">TID:</span> {selectedLocation.tid}</div>
                                            <div><span className="text-gray-600">Name:</span> {selectedLocation.name}</div>
                                            <div><span className="text-gray-600">Address:</span> {selectedLocation.address}</div>
                                            <div><span className="text-gray-600">City:</span> {selectedLocation.city}</div>
                                            <div><span className="text-gray-600">Province:</span> {selectedLocation.province}</div>
                                            <div><span className="text-gray-600">Type:</span> {selectedLocation.locationType}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-3">Status & Service</h3>
                                        <div className="space-y-2 text-sm">
                                            <div><span className="text-gray-600">Status:</span> <Badge variant="secondary">{selectedLocation.status}</Badge></div>
                                            <div><span className="text-gray-600">Service Level:</span> {selectedLocation.serviceLevel}</div>
                                            <div><span className="text-gray-600">Region:</span> {selectedLocation.region}</div>
                                            <div><span className="text-gray-600">Area:</span> {selectedLocation.area}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-3">Assets</h3>
                                        <div className="space-y-2 text-sm">
                                            <div><span className="text-gray-600">Total Assets:</span> {selectedLocation.assetCount}</div>
                                            {selectedLocation.assets && (
                                                <div className="space-y-1">
                                                    {selectedLocation.assets.slice(0, 3).map(asset => (
                                                        <div key={asset.id} className="p-2 bg-gray-50 rounded">
                                                            <div className="font-medium">{asset.name}</div>
                                                            <div className="text-xs text-gray-600">{asset.category} • {asset.status}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* GPS Verification */}
                <TabsContent value="gps" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <GPSVerification
                            expectedLocation={mockLocations[0]}
                            onLocationVerified={handleLocationVerified}
                            onLocationUpdate={(location) => {
                                console.log('Location updated:', location);
                            }}
                            required={true}
                            toleranceMeters={50}
                        />

                        {/* GPS Status */}
                        <Card>
                            <CardHeader>
                                <CardTitle>GPS Verification Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h3 className="font-semibold mb-2">Verification Result</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span>Status:</span>
                                            <Badge variant={gpsVerified ? "default" : "secondary"}>
                                                {gpsVerified ? "Verified" : "Not Verified"}
                                            </Badge>
                                        </div>
                                        {gpsLocation && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span>Latitude:</span>
                                                    <span className="font-mono text-sm">{gpsLocation.lat.toFixed(6)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Longitude:</span>
                                                    <span className="font-mono text-sm">{gpsLocation.lng.toFixed(6)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Accuracy:</span>
                                                    <span>±{gpsLocation.accuracy.toFixed(0)}m</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold mb-2">GPS Features</h3>
                                    <div className="space-y-1 text-sm text-gray-600">
                                        <div>✅ Real-time location tracking</div>
                                        <div>✅ High accuracy GPS positioning</div>
                                        <div>✅ Distance calculation from expected location</div>
                                        <div>✅ Configurable tolerance settings</div>
                                        <div>✅ Location verification workflow</div>
                                        <div>✅ Mobile-optimized interface</div>
                                    </div>
                                </div>

                                <Alert>
                                    <Navigation className="h-4 w-4" />
                                    <AlertDescription>
                                        GPS verification ensures technicians are actually on-site when completing work.
                                        This prevents fraud and improves service quality.
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Analytics */}
                <TabsContent value="analytics" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Map Features</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                        <span>Interactive clustering</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <span>Real-time updates</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                        <span>Advanced filtering</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                        <span>GPS verification</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <span>SLA visualization</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Technical Stack</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div><strong>Mapping:</strong> Leaflet.js</div>
                                    <div><strong>React Integration:</strong> React-Leaflet</div>
                                    <div><strong>Clustering:</strong> Leaflet.markercluster</div>
                                    <div><strong>Tiles:</strong> OpenStreetMap</div>
                                    <div><strong>Geolocation:</strong> Browser GPS API</div>
                                    <div><strong>Distance:</strong> Haversine formula</div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Use Cases</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div>📍 Live ticket tracking</div>
                                    <div>🏢 Location management</div>
                                    <div>🔧 Technician dispatch</div>
                                    <div>📊 Geographic analytics</div>
                                    <div>🎯 GPS verification</div>
                                    <div>📱 Mobile field operations</div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Implementation Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose max-w-none">
                                <p>
                                    The Leaflet Maps integration provides comprehensive geographic visualization capabilities for Nexus CMMS:
                                </p>
                                <ul>
                                    <li><strong>Live Ticket Map:</strong> Real-time visualization of all maintenance tickets with clustering, priority-based coloring, and SLA status indicators.</li>
                                    <li><strong>Location Management:</strong> Interactive map for managing all service locations with asset counts, status indicators, and hierarchical organization.</li>
                                    <li><strong>GPS Verification:</strong> Mobile-optimized component for verifying technician location with configurable tolerance and distance calculations.</li>
                                    <li><strong>Performance Optimized:</strong> Efficient clustering for large datasets, lazy loading, and responsive design for all device sizes.</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}