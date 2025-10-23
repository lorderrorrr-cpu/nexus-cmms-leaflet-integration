import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { locations, assets } from '@/db/schema';
import { eq, ilike, and, desc, asc, or, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Validation schemas
const locationCreateSchema = z.object({
    tid: z.string().min(1, 'TID is required').max(10, 'TID must be 10 characters or less'),
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    address: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().max(10, 'Postal code too long').optional(),
    country: z.string().max(50).default('Indonesia'),
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
    status: z.enum(['active', 'inactive', 'under_construction', 'decommissioned']).default('active'),
    locationType: z.string().min(1, 'Location type is required'),
    serviceLevel: z.enum(['standard', 'premium', 'enterprise']).default('standard'),
    notes: z.string().optional(),
});

const locationUpdateSchema = locationCreateSchema.partial();

const locationQuerySchema = z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive().default(1)),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100).default(20)),
    search: z.string().optional(),
    status: z.enum(['active', 'inactive', 'under_construction', 'decommissioned']).optional(),
    region: z.string().optional(),
    area: z.string().optional(),
    locationType: z.string().optional(),
    serviceLevel: z.enum(['standard', 'premium', 'enterprise']).optional(),
    sortBy: z.enum(['name', 'tid', 'city', 'province', 'createdAt', 'updatedAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    parentLocationId: z.string().uuid().optional(),
    includeAssetCount: z.string().transform(Boolean).pipe(z.boolean().default(false)),
});

// Helper function to check permissions
async function checkPermission(action: 'create' | 'read' | 'update' | 'delete', request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session?.user) {
        return { authorized: false, error: 'Unauthorized' };
    }

    // For now, allow all authenticated users to read locations
    // Write operations require admin or supervisor role
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

// GET - List locations with filtering and pagination
export async function GET(request: NextRequest) {
    try {
        const permission = await checkPermission('read', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = locationQuerySchema.parse(Object.fromEntries(searchParams));

        // Build the query
        let conditions = [];

        if (query.search) {
            conditions.push(
                or(
                    ilike(locations.tid, `%${query.search}%`),
                    ilike(locations.name, `%${query.search}%`),
                    ilike(locations.address, `%${query.search}%`),
                    ilike(locations.city, `%${query.search}%`),
                    ilike(locations.province, `%${query.search}%`)
                )
            );
        }

        if (query.status) {
            conditions.push(eq(locations.status, query.status));
        }

        if (query.region) {
            conditions.push(eq(locations.region, query.region));
        }

        if (query.area) {
            conditions.push(eq(locations.area, query.area));
        }

        if (query.locationType) {
            conditions.push(eq(locations.locationType, query.locationType));
        }

        if (query.serviceLevel) {
            conditions.push(eq(locations.serviceLevel, query.serviceLevel));
        }

        if (query.parentLocationId) {
            conditions.push(eq(locations.parentLocationId, query.parentLocationId));
        } else if (searchParams.get('includeRoot') === 'true') {
            // Include root locations (those without parent)
            conditions.push(isNull(locations.parentLocationId));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const totalCountResult = await db
            .select({ count: locations.id })
            .from(locations)
            .where(whereClause);
        const totalCount = totalCountResult.length;

        // Calculate pagination
        const offset = (query.page - 1) * query.limit;
        const totalPages = Math.ceil(totalCount / query.limit);

        // Build the main query
        let selectQuery = db.select().from(locations).where(whereClause);

        // Add ordering
        const orderByColumn = locations[query.sortBy as keyof typeof locations];
        const orderDirection = query.sortOrder === 'asc' ? asc : desc;
        selectQuery = selectQuery.orderBy(orderDirection(orderByColumn));

        // Add pagination
        selectQuery = selectQuery.limit(query.limit).offset(offset);

        const locationsData = await selectQuery;

        // Include asset count if requested
        let result = locationsData;
        if (query.includeAssetCount) {
            result = await Promise.all(
                locationsData.map(async (location) => {
                    const assetCount = await db
                        .select({ count: assets.id })
                        .from(assets)
                        .where(eq(assets.locationId, location.id));

                    return {
                        ...location,
                        assetCount: assetCount.length,
                    };
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
        console.error('Error fetching locations:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid query parameters',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to fetch locations'
        }, { status: 500 });
    }
}

// POST - Create new location
export async function POST(request: NextRequest) {
    try {
        const permission = await checkPermission('create', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = locationCreateSchema.parse(body);

        // Check if TID already exists
        const existingLocation = await db
            .select()
            .from(locations)
            .where(eq(locations.tid, validatedData.tid))
            .limit(1);

        if (existingLocation.length > 0) {
            return NextResponse.json({
                error: 'TID already exists'
            }, { status: 409 });
        }

        // Validate parent location if provided
        if (validatedData.parentLocationId) {
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

        // Create the location
        const newLocation = {
            ...validatedData,
            createdBy: permission.user.id,
            updatedBy: permission.user.id,
        };

        const result = await db
            .insert(locations)
            .values(newLocation)
            .returning();

        return NextResponse.json({
            message: 'Location created successfully',
            data: result[0],
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating location:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid request data',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to create location'
        }, { status: 500 });
    }
}