'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LatLngExpression, MarkerClusterGroupOptions } from 'leaflet';

// Dynamically import to avoid SSR issues
const MarkerClusterGroup = dynamic(
    () => import('react-leaflet').then((mod) => (mod as any).MarkerClusterGroup),
    { ssr: false }
) as any;

// Import marker cluster CSS
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface ClusteredMarkerLayerProps {
    markers: Array<{
        id: string;
        position: LatLngExpression;
        popup?: React.ReactNode;
        icon?: any;
        title?: string;
        onClick?: () => void;
    }>;
    clusterOptions?: MarkerClusterGroupOptions;
    onClusterClick?: (cluster: any) => void;
    onMarkerClick?: (marker: any) => void;
    className?: string;
}

export default function ClusteredMarkerLayer({
    markers,
    clusterOptions,
    onClusterClick,
    onMarkerClick,
    className,
}: ClusteredMarkerLayerProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const defaultClusterOptions: MarkerClusterGroupOptions = {
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 15,
        iconCreateFunction: (cluster) => {
            const childCount = cluster.getChildCount();
            let c = ' marker-cluster-';
            if (childCount < 10) {
                c += 'small';
            } else if (childCount < 100) {
                c += 'medium';
            } else {
                c += 'large';
            }

            return new (window as any).L.DivIcon({
                html: `<div><span>${childCount}</span></div>`,
                className: `marker-cluster${c}`,
                iconSize: new (window as any).L.Point(40, 40),
            });
        },
        ...clusterOptions,
    };

    if (!isClient || markers.length === 0) {
        return null;
    }

    return (
        <MarkerClusterGroup
            options={defaultClusterOptions}
            eventHandlers={{
                clusterclick: onClusterClick,
            }}
        >
            {markers.map((marker) => (
                <MarkerComponent
                    key={marker.id}
                    position={marker.position}
                    popup={marker.popup}
                    icon={marker.icon}
                    title={marker.title}
                    onClick={() => {
                        if (marker.onClick) {
                            marker.onClick();
                        }
                        if (onMarkerClick) {
                            onMarkerClick(marker);
                        }
                    }}
                />
            ))}
        </MarkerClusterGroup>
    );
}

// Individual marker component
const MarkerComponent = dynamic(
    () => import('react-leaflet').then((mod) => {
        const Marker = mod.Marker;
        const Popup = mod.Popup;

        return function MarkerComponent({
            position,
            popup,
            icon,
            title,
            onClick,
        }: {
            position: LatLngExpression;
            popup?: React.ReactNode;
            icon?: any;
            title?: string;
            onClick?: () => void;
        }) {
            return (
                <Marker
                    position={position}
                    icon={icon}
                    title={title}
                    eventHandlers={{
                        click: onClick,
                    }}
                >
                    {popup && <Popup>{popup}</Popup>}
                </Marker>
            );
        };
    }),
    { ssr: false }
);