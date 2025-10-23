import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { assets, locations, assetCategories, tickets } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

const assetUpdateSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
    categoryId: z.string().uuid('Invalid category ID').optional(),
    locationId: z.string().uuid('Invalid location ID').optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    serialNumber: z.string().max(100).optional(),
    partNumber: z.string().max(100).optional(),
    firmwareVersion: z.string().max(50).optional(),
    installationDate: z.string().datetime().optional(),
    warrantyStartDate: z.string().datetime().optional(),
    warrantyEndDate: z.string().datetime().optional(),
    supplier: z.string().optional(),
    supplierContact: z.string().optional(),
    specifications: z.string().optional(),
    capacity: z.string().optional(),
    voltage: z.string().max(20).optional(),
    purchaseDate: z.string().datetime().optional(),
    purchaseCost: z.number().min(0).optional(),
    currentValue: z.number().min(0).optional(),
    depreciationRate: z.number().min(0).max(100).optional(),
    status: z.enum(['operational', 'down', 'under_maintenance', 'retired', 'decommissioned']).optional(),
    healthScore: z.number().int().min(0).max(100).optional(),
    lastMaintenanceDate: z.string().datetime().optional(),
    nextMaintenanceDate: z.string().datetime().optional(),
    room: z.string().optional(),
    rack: z.string().optional(),
    position: z.string().optional(),
    criticality: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    businessImpact: z.string().optional(),
    redundancy: z.enum(['none', 'n+1', '2n', '2n+1']).optional(),
    manualBookUrl: z.string().url().optional(),
    wiringDiagramUrl: z.string().url().optional(),
    configurationUrl: z.string().url().optional(),
    photos: z.string().optional(),
    contractProvider: z.string().optional(),
    contractNumber: z.string().max(50).optional(),
    contractStartDate: z.string().datetime().optional(),
    contractEndDate: z.string().datetime().optional(),
    contractType: z.string().optional(),
    monitoringEnabled: z.boolean().optional(),
    alertThresholds: z.string().optional(),
    lastHealthCheck: z.string().datetime().optional(),
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

    // For now, allow all authenticated users to read assets
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

// GET - Get single asset by ID
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('read', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const assetId = params.id;

        // Validate UUID
        try {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(assetId)) {
                return NextResponse.json({
                    error: 'Invalid asset ID format'
                }, { status: 400 });
            }
        } catch (error) {
            return NextResponse.json({
                error: 'Invalid asset ID format'
            }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const includeLocation = searchParams.get('includeLocation') === 'true';
        const includeCategory = searchParams.get('includeCategory') === 'true';
        const includeMaintenanceHistory = searchParams.get('includeMaintenanceHistory') === 'true';
        const includeRecentTickets = searchParams.get('includeRecentTickets') === 'true';

        // Get the asset
        const assetResult = await db
            .select()
            .from(assets)
            .where(eq(assets.id, assetId))
            .limit(1);

        if (assetResult.length === 0) {
            return NextResponse.json({
                error: 'Asset not found'
            }, { status: 404 });
        }

        const asset = assetResult[0];

        // Build the response with additional data if requested
        let response = { ...asset };

        if (includeLocation) {
            const locationData = await db
                .select()
                .from(locations)
                .where(eq(locations.id, asset.locationId))
                .limit(1);

            response.location = locationData[0] || null;
        }

        if (includeCategory) {
            const categoryData = await db
                .select()
                .from(assetCategories)
                .where(eq(assetCategories.id, asset.categoryId))
                .limit(1);

            response.category = categoryData[0] || null;
        }

        if (includeMaintenanceHistory) {
            // Get recent maintenance tickets for this asset
            const maintenanceTickets = await db
                .select()
                .from(tickets)
                .where(and(
                    eq(tickets.assetId, assetId),
                    eq(tickets.category, 'pm')
                ))
                .orderBy(desc(tickets.completedAt))
                .limit(10);

            response.maintenanceHistory = maintenanceTickets;
        }

        if (includeRecentTickets) {
            // Get recent tickets (both PM and CM) for this asset
            const recentTickets = await db
                .select()
                .from(tickets)
                .where(eq(tickets.assetId, assetId))
                .orderBy(desc(tickets.createdAt))
                .limit(10);

            response.recentTickets = recentTickets;
        }

        // Add computed maintenance information
        const maintenanceInfo = {
            daysSinceLastMaintenance: asset.lastMaintenanceDate
                ? Math.floor((Date.now() - new Date(asset.lastMaintenanceDate).getTime()) / (1000 * 60 * 60 * 24))
                : null,
            daysUntilNextMaintenance: asset.nextMaintenanceDate
                ? Math.floor((new Date(asset.nextMaintenanceDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null,
            warrantyStatus: asset.warrantyEndDate
                ? new Date() > new Date(asset.warrantyEndDate) ? 'expired' : 'active'
                : 'unknown',
            warrantyDaysRemaining: asset.warrantyEndDate
                ? Math.floor((new Date(asset.warrantyEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null,
            contractStatus: asset.contractEndDate
                ? new Date() > new Date(asset.contractEndDate) ? 'expired' : 'active'
                : 'unknown',
            contractDaysRemaining: asset.contractEndDate
                ? Math.floor((new Date(asset.contractEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null,
            ageInDays: asset.installationDate
                ? Math.floor((Date.now() - new Date(asset.installationDate).getTime()) / (1000 * 60 * 60 * 24))
                : null,
        };

        response.maintenanceInfo = maintenanceInfo;

        return NextResponse.json({
            data: response
        });

    } catch (error) {
        console.error('Error fetching asset:', error);
        return NextResponse.json({
            error: 'Failed to fetch asset'
        }, { status: 500 });
    }
}

// PUT - Update asset
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('update', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const assetId = params.id;
        const body = await request.json();
        const validatedData = assetUpdateSchema.parse(body);

        // Check if asset exists
        const existingAsset = await db
            .select()
            .from(assets)
            .where(eq(assets.id, assetId))
            .limit(1);

        if (existingAsset.length === 0) {
            return NextResponse.json({
                error: 'Asset not found'
            }, { status: 404 });
        }

        // Validate category if provided
        if (validatedData.categoryId) {
            const categoryExists = await db
                .select()
                .from(assetCategories)
                .where(eq(assetCategories.id, validatedData.categoryId))
                .limit(1);

            if (categoryExists.length === 0) {
                return NextResponse.json({
                    error: 'Category not found'
                }, { status: 400 });
            }
        }

        // Validate location if provided
        if (validatedData.locationId) {
            const locationExists = await db
                .select()
                .from(locations)
                .where(eq(locations.id, validatedData.locationId))
                .limit(1);

            if (locationExists.length === 0) {
                return NextResponse.json({
                    error: 'Location not found'
                }, { status: 400 });
            }
        }

        // Check if asset tag conflicts with another asset (if being updated)
        if (validatedData.assetTag) {
            const conflictingAsset = await db
                .select()
                .from(assets)
                .where(and(
                    eq(assets.assetTag, validatedData.assetTag),
                    // Exclude current asset from check
                    // Note: Drizzle doesn't support neq with UUID, so we need to filter in code
                ))
                .limit(1);

            if (conflictingAsset.length > 0 && conflictingAsset[0].id !== assetId) {
                return NextResponse.json({
                    error: 'Asset tag already exists'
                }, { status: 409 });
            }
        }

        // Update the asset
        const updateData = {
            ...validatedData,
            updatedBy: permission.user.id,
            updatedAt: new Date(),
        };

        const result = await db
            .update(assets)
            .set(updateData)
            .where(eq(assets.id, assetId))
            .returning();

        return NextResponse.json({
            message: 'Asset updated successfully',
            data: result[0],
        });

    } catch (error) {
        console.error('Error updating asset:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid request data',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to update asset'
        }, { status: 500 });
    }
}

// DELETE - Delete asset (soft delete)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('delete', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const assetId = params.id;

        // Check if asset exists
        const existingAsset = await db
            .select()
            .from(assets)
            .where(eq(assets.id, assetId))
            .limit(1);

        if (existingAsset.length === 0) {
            return NextResponse.json({
                error: 'Asset not found'
            }, { status: 404 });
        }

        // Check if asset has open tickets
        const openTicketsCount = await db
            .select({ count: tickets.id })
            .from(tickets)
            .where(and(
                eq(tickets.assetId, assetId),
                // Tickets that are not closed or cancelled
                // Note: We would need to check status values like 'open', 'assigned', etc.
            ));

        if (openTicketsCount.length > 0) {
            return NextResponse.json({
                error: 'Cannot delete asset with open tickets',
                openTicketsCount: openTicketsCount.length,
                suggestion: 'Please close or cancel all tickets associated with this asset first'
            }, { status: 409 });
        }

        // Soft delete by setting isActive to false and status to decommissioned
        const result = await db
            .update(assets)
            .set({
                isActive: false,
                status: 'decommissioned',
                updatedBy: permission.user.id,
                updatedAt: new Date(),
            })
            .where(eq(assets.id, assetId))
            .returning();

        return NextResponse.json({
            message: 'Asset deleted successfully',
            data: result[0],
        });

    } catch (error) {
        console.error('Error deleting asset:', error);
        return NextResponse.json({
            error: 'Failed to delete asset'
        }, { status: 500 });
    }
}