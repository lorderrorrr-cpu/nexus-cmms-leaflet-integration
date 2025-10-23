import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { locations, assets } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';

const locationUpdateSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().max(10, 'Postal code too long').optional(),
    country: z.string().max(50).optional(),
    latitude: z.number().refine(val => val >= -90 && val <= 90, 'Latitude must be between -90 and 90').optional(),
    longitude: z.number().refine(val => val >= -180 && val <= 180, 'Longitude must be between -180 and 180').optional(),
    gpsAccuracy: z.number().min(0).optional(),
    region: z.string().optional(),
    area: z.string().optional(),
    siteType: z.string().optional(),
    parentLocationId: z.string().uuid().optional(),
    operationalHours: z.string().optional(),
    picName: z.string().optional(),
    picPhone: z.string().max(20).optional(),
    picEmail: z.string().email().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().max(20).optional(),
    status: z.enum(['active', 'inactive', 'under_construction', 'decommissioned']).optional(),
    locationType: z.string().optional(),
    serviceLevel: z.enum(['standard', 'premium', 'enterprise']).optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
});

// Helper function to check permissions
async function checkPermission(action: 'read' | 'update' | 'delete', request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session?.user) {
        return { authorized: false, error: 'Unauthorized' };
    }

    // For now, allow all authenticated users to read locations
    if (action === 'read') {
        return { authorized: true, user: session.user };
    }

    if (action === 'update' || action === 'delete') {
        // TODO: Implement proper role-based authorization
        // For now, allow all authenticated users
        return { authorized: true, user: session.user };
    }

    return { authorized: false, error: 'Insufficient permissions' };
}

// GET - Get single location by ID
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('read', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const locationId = params.id;

        // Validate UUID
        try {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(locationId)) {
                return NextResponse.json({
                    error: 'Invalid location ID format'
                }, { status: 400 });
            }
        } catch (error) {
            return NextResponse.json({
                error: 'Invalid location ID format'
            }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const includeAssets = searchParams.get('includeAssets') === 'true';
        const includeChildLocations = searchParams.get('includeChildLocations') === 'true';
        const includeAssetCount = searchParams.get('includeAssetCount') === 'true';

        // Get the location
        const locationResult = await db
            .select()
            .from(locations)
            .where(eq(locations.id, locationId))
            .limit(1);

        if (locationResult.length === 0) {
            return NextResponse.json({
                error: 'Location not found'
            }, { status: 404 });
        }

        const location = locationResult[0];

        // Build the response with additional data if requested
        let response = { ...location };

        if (includeAssetCount) {
            const assetCount = await db
                .select({ count: assets.id })
                .from(assets)
                .where(eq(assets.locationId, locationId));

            response.assetCount = assetCount.length;
        }

        if (includeAssets) {
            const assetsData = await db
                .select()
                .from(assets)
                .where(eq(assets.locationId, locationId));

            response.assets = assetsData;
        }

        if (includeChildLocations) {
            const childLocations = await db
                .select()
                .from(locations)
                .where(eq(locations.parentLocationId, locationId));

            response.childLocations = childLocations;
        }

        return NextResponse.json({
            data: response
        });

    } catch (error) {
        console.error('Error fetching location:', error);
        return NextResponse.json({
            error: 'Failed to fetch location'
        }, { status: 500 });
    }
}

// PUT - Update location
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('update', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const locationId = params.id;
        const body = await request.json();
        const validatedData = locationUpdateSchema.parse(body);

        // Check if location exists
        const existingLocation = await db
            .select()
            .from(locations)
            .where(eq(locations.id, locationId))
            .limit(1);

        if (existingLocation.length === 0) {
            return NextResponse.json({
                error: 'Location not found'
            }, { status: 404 });
        }

        // Validate parent location if provided
        if (validatedData.parentLocationId) {
            // Prevent self-reference
            if (validatedData.parentLocationId === locationId) {
                return NextResponse.json({
                    error: 'Location cannot be its own parent'
                }, { status: 400 });
            }

            const parentLocation = await db
                .select()
                .from(locations)
                .where(eq(locations.id, validatedData.parentLocationId))
                .limit(1);

            if (parentLocation.length === 0) {
                return NextResponse.json({
                    error: 'Parent location not found'
                }, { status: 400 });
            }
        }

        // Update the location
        const updateData = {
            ...validatedData,
            updatedBy: permission.user.id,
            updatedAt: new Date(),
        };

        const result = await db
            .update(locations)
            .set(updateData)
            .where(eq(locations.id, locationId))
            .returning();

        return NextResponse.json({
            message: 'Location updated successfully',
            data: result[0],
        });

    } catch (error) {
        console.error('Error updating location:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid request data',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to update location'
        }, { status: 500 });
    }
}

// DELETE - Delete location
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('delete', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const locationId = params.id;

        // Check if location exists
        const existingLocation = await db
            .select()
            .from(locations)
            .where(eq(locations.id, locationId))
            .limit(1);

        if (existingLocation.length === 0) {
            return NextResponse.json({
                error: 'Location not found'
            }, { status: 404 });
        }

        // Check if location has associated assets
        const assetCount = await db
            .select({ count: assets.id })
            .from(assets)
            .where(eq(assets.locationId, locationId));

        if (assetCount.length > 0) {
            return NextResponse.json({
                error: 'Cannot delete location with associated assets',
                assetCount: assetCount.length,
                suggestion: 'Please reassign or delete the assets first'
            }, { status: 409 });
        }

        // Check if location has child locations
        const childCount = await db
            .select({ count: locations.id })
            .from(locations)
            .where(eq(locations.parentLocationId, locationId));

        if (childCount.length > 0) {
            return NextResponse.json({
                error: 'Cannot delete location with child locations',
                childCount: childCount.length,
                suggestion: 'Please reassign or delete the child locations first'
            }, { status: 409 });
        }

        // Soft delete by setting isActive to false
        const result = await db
            .update(locations)
            .set({
                isActive: false,
                status: 'decommissioned',
                updatedBy: permission.user.id,
                updatedAt: new Date(),
            })
            .where(eq(locations.id, locationId))
            .returning();

        return NextResponse.json({
            message: 'Location deleted successfully',
            data: result[0],
        });

    } catch (error) {
        console.error('Error deleting location:', error);
        return NextResponse.json({
            error: 'Failed to delete location'
        }, { status: 500 });
    }
}