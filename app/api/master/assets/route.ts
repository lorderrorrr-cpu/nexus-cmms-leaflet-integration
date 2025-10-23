import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { assets, locations, assetCategories, priorities } from '@/db/schema';
import { eq, ilike, and, desc, asc, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Validation schemas
const assetCreateSchema = z.object({
    assetTag: z.string().min(1, 'Asset tag is required').max(50, 'Asset tag too long'),
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    categoryId: z.string().uuid('Invalid category ID'),
    locationId: z.string().uuid('Invalid location ID'),
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
    status: z.enum(['operational', 'down', 'under_maintenance', 'retired', 'decommissioned']).default('operational'),
    healthScore: z.number().int().min(0).max(100).default(100),
    lastMaintenanceDate: z.string().datetime().optional(),
    nextMaintenanceDate: z.string().datetime().optional(),
    room: z.string().optional(),
    rack: z.string().optional(),
    position: z.string().optional(),
    criticality: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
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
    monitoringEnabled: z.boolean().default(true),
    alertThresholds: z.string().optional(),
    lastHealthCheck: z.string().datetime().optional(),
    notes: z.string().optional(),
});

const assetUpdateSchema = assetCreateSchema.partial();

const assetQuerySchema = z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive().default(1)),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100).default(20)),
    search: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    status: z.enum(['operational', 'down', 'under_maintenance', 'retired', 'decommissioned']).optional(),
    criticality: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    sortBy: z.enum(['name', 'assetTag', 'serialNumber', 'purchaseDate', 'lastMaintenanceDate', 'healthScore', 'createdAt', 'updatedAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    includeLocation: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    includeCategory: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    includeMaintenanceInfo: z.string().transform(Boolean).pipe(z.boolean().default(false)),
});

// Helper function to check permissions
async function checkPermission(action: 'create' | 'read' | 'update' | 'delete', request: NextRequest) {
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

    if (action === 'create' || action === 'update' || action === 'delete') {
        // TODO: Implement proper role-based authorization
        // For now, allow all authenticated users
        return { authorized: true, user: session.user };
    }

    return { authorized: false, error: 'Insufficient permissions' };
}

// GET - List assets with filtering and pagination
export async function GET(request: NextRequest) {
    try {
        const permission = await checkPermission('read', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = assetQuerySchema.parse(Object.fromEntries(searchParams));

        // Build the query
        let conditions = [];

        if (query.search) {
            conditions.push(
                or(
                    ilike(assets.assetTag, `%${query.search}%`),
                    ilike(assets.name, `%${query.search}%`),
                    ilike(assets.serialNumber, `%${query.search}%`),
                    ilike(assets.brand, `%${query.search}%`),
                    ilike(assets.model, `%${query.search}%`),
                    ilike(assets.partNumber, `%${query.search}%`)
                )
            );
        }

        if (query.categoryId) {
            conditions.push(eq(assets.categoryId, query.categoryId));
        }

        if (query.locationId) {
            conditions.push(eq(assets.locationId, query.locationId));
        }

        if (query.status) {
            conditions.push(eq(assets.status, query.status));
        }

        if (query.criticality) {
            conditions.push(eq(assets.criticality, query.criticality));
        }

        if (query.brand) {
            conditions.push(eq(assets.brand, query.brand));
        }

        if (query.model) {
            conditions.push(eq(assets.model, query.model));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const totalCountResult = await db
            .select({ count: assets.id })
            .from(assets)
            .where(whereClause);
        const totalCount = totalCountResult.length;

        // Calculate pagination
        const offset = (query.page - 1) * query.limit;
        const totalPages = Math.ceil(totalCount / query.limit);

        // Build the main query
        let selectQuery = db.select().from(assets).where(whereClause);

        // Add ordering
        const orderByColumn = assets[query.sortBy as keyof typeof assets];
        const orderDirection = query.sortOrder === 'asc' ? asc : desc;
        selectQuery = selectQuery.orderBy(orderDirection(orderByColumn));

        // Add pagination
        selectQuery = selectQuery.limit(query.limit).offset(offset);

        const assetsData = await selectQuery;

        // Include related data if requested
        let result = assetsData;
        if (query.includeLocation || query.includeCategory || query.includeMaintenanceInfo) {
            result = await Promise.all(
                assetsData.map(async (asset) => {
                    let enrichedAsset = { ...asset };

                    if (query.includeLocation) {
                        const locationData = await db
                            .select()
                            .from(locations)
                            .where(eq(locations.id, asset.locationId))
                            .limit(1);

                        enrichedAsset.location = locationData[0] || null;
                    }

                    if (query.includeCategory) {
                        const categoryData = await db
                            .select()
                            .from(assetCategories)
                            .where(eq(assetCategories.id, asset.categoryId))
                            .limit(1);

                        enrichedAsset.category = categoryData[0] || null;
                    }

                    if (query.includeMaintenanceInfo) {
                        // Add maintenance related information
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
                            contractStatus: asset.contractEndDate
                                ? new Date() > new Date(asset.contractEndDate) ? 'expired' : 'active'
                                : 'unknown',
                        };

                        enrichedAsset.maintenanceInfo = maintenanceInfo;
                    }

                    return enrichedAsset;
                })
            );
        }

        // Response headers for pagination
        const headers = new Headers({
            'X-Total-Count': totalCount.toString(),
            'X-Total-Pages': totalPages.toString(),
            'X-Current-Page': query.page.toString(),
            'X-Per-Page': query.limit.toString(),
        });

        return NextResponse.json({
            data: result,
            pagination: {
                currentPage: query.page,
                totalPages,
                totalCount,
                perPage: query.limit,
                hasNextPage: query.page < totalPages,
                hasPreviousPage: query.page > 1,
            },
        }, { headers });

    } catch (error) {
        console.error('Error fetching assets:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid query parameters',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to fetch assets'
        }, { status: 500 });
    }
}

// POST - Create new asset
export async function POST(request: NextRequest) {
    try {
        const permission = await checkPermission('create', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = assetCreateSchema.parse(body);

        // Check if asset tag already exists
        const existingAsset = await db
            .select()
            .from(assets)
            .where(eq(assets.assetTag, validatedData.assetTag))
            .limit(1);

        if (existingAsset.length > 0) {
            return NextResponse.json({
                error: 'Asset tag already exists'
            }, { status: 409 });
        }

        // Validate category exists
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

        // Validate location exists
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

        // Create the asset
        const newAsset = {
            ...validatedData,
            createdBy: permission.user.id,
            updatedBy: permission.user.id,
        };

        const result = await db
            .insert(assets)
            .values(newAsset)
            .returning();

        return NextResponse.json({
            message: 'Asset created successfully',
            data: result[0],
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating asset:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid request data',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to create asset'
        }, { status: 500 });
    }
}