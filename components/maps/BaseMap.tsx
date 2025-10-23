'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LatLngBounds, LatLngExpression } from 'leaflet';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);

const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);

const Marker = dynamic(
    () => import('react-leaflet').then((mod) => mod.Marker),
    { ssr: false }
);

const Popup = dynamic(
    () => import('react-leaflet').then((mod) => mod.Popup),
    { ssr: false }
);

const useMap = dynamic(
    () => import('react-leaflet').then((mod) => mod.useMap),
    { ssr: false }
) as any;

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with webpack
if (typeof window !== 'undefined') {
    delete (window as any).L.Icon.Default.prototype._getIconUrl;
    (window as any).L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
}

interface BaseMapProps {
    center?: LatLngExpression;
    zoom?: number;
    bounds?: LatLngBounds;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    onMapReady?: (map: any) => void;
    onClick?: (e: any) => void;
    onMoveEnd?: (e: any) => void;
    onZoomEnd?: (e: any) => void;
}

// Component to handle map events
function MapEventHandler({
    onMapReady,
    onClick,
    onMoveEnd,
    onZoomEnd,
}: {
    onMapReady?: (map: any) => void;
    onClick?: (e: any) => void;
    onMoveEnd?: (e: any) => void;
    onZoomEnd?: (e: any) => void;
}) {
    const map = useMap();

    useEffect(() => {
        if (onMapReady) {
            onMapReady(map);
        }
    }, [map, onMapReady]);

    useEffect(() => {
        if (onClick) {
            map.on('click', onClick);
            return () => {
                map.off('click', onClick);
            };
        }
    }, [map, onClick]);

    useEffect(() => {
        if (onMoveEnd) {
            map.on('moveend', onMoveEnd);
            return () => {
                map.off('moveend', onMoveEnd);
            };
        }
    }, [map, onMoveEnd]);

    useEffect(() => {
        if (onZoomEnd) {
            map.on('zoomend', onZoomEnd);
            return () => {
                map.off('zoomend', onZoomEnd);
            };
        }
    }, [map, onZoomEnd]);

    return null;
}

export default function BaseMap({
    center = [-6.229728, 106.829500] as LatLngExpression, // Default to Jakarta
    zoom = 10,
    bounds,
    className = '',
    style = { height: '400px', width: '100%' },
    children,
    onMapReady,
    onClick,
    onMoveEnd,
    onZoomEnd,
}: BaseMapProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <div className={`bg-gray-100 animate-pulse rounded-lg ${className}`} style={style}>
                <div className="h-full flex items-center justify-center text-gray-500">
                    Loading map...
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-lg overflow-hidden ${className}`} style={style}>
            <MapContainer
                center={center}
                zoom={zoom}
                bounds={bounds}
                className="h-full w-full"
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    // Alternative tile layers for production:
                    // url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
                    // url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                />
                <MapEventHandler
                    onMapReady={onMapReady}
                    onClick={onClick}
                    onMoveEnd={onMoveEnd}
                    onZoomEnd={onZoomEnd}
                />
                {children}
            </MapContainer>
        </div>
    );
}