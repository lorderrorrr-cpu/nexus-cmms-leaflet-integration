import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { assetCategories, assets } from '@/db/schema';
import { eq, ilike, and, desc, asc, or, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Validation schemas
const categoryCreateSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or less'),
    description: z.string().optional(),
    parentCategoryId: z.string().uuid().optional(),
    level: z.number().int().min(1).max(3).default(1),
    path: z.string().min(1, 'Path is required'),
    checklistTemplateId: z.string().uuid().optional(),
    maintenancePlanTemplateId: z.string().uuid().optional(),
    standardSpareParts: z.string().optional(),
    consumables: z.string().optional(),
    technicalParameters: z.string().optional(),
    warrantyPeriodMonths: z.number().int().min(0).default(12),
    expectedLifecycleYears: z.number().int().min(1).default(5),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

const categoryQuerySchema = z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive().default(1)),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100).default(20)),
    search: z.string().optional(),
    level: z.number().int().min(1).max(3).optional(),
    parentCategoryId: z.string().uuid().optional(),
    includeRootCategories: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    includeChildCategories: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    includeAssetCount: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    sortBy: z.enum(['name', 'code', 'level', 'path', 'createdAt', 'updatedAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Helper function to check permissions
async function checkPermission(action: 'create' | 'read' | 'update' | 'delete', request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session?.user) {
        return { authorized: false, error: 'Unauthorized' };
    }

    // For now, allow all authenticated users to read categories
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

// GET - List asset categories with filtering and pagination
export async function GET(request: NextRequest) {
    try {
        const permission = await checkPermission('read', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = categoryQuerySchema.parse(Object.fromEntries(searchParams));

        // Build the query
        let conditions = [];

        if (query.search) {
            conditions.push(
                or(
                    ilike(assetCategories.name, `%${query.search}%`),
                    ilike(assetCategories.code, `%${query.search}%`),
                    ilike(assetCategories.description, `%${query.search}%`),
                    ilike(assetCategories.path, `%${query.search}%`)
                )
            );
        }

        if (query.level) {
            conditions.push(eq(assetCategories.level, query.level));
        }

        if (query.parentCategoryId) {
            conditions.push(eq(assetCategories.parentCategoryId, query.parentCategoryId));
        } else if (query.includeRootCategories) {
            // Include only root categories (those without parent)
            conditions.push(isNull(assetCategories.parentCategoryId));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const totalCountResult = await db
            .select({ count: assetCategories.id })
            .from(assetCategories)
            .where(whereClause);
        const totalCount = totalCountResult.length;

        // Calculate pagination
        const offset = (query.page - 1) * query.limit;
        const totalPages = Math.ceil(totalCount / query.limit);

        // Build the main query
        let selectQuery = db.select().from(assetCategories).where(whereClause);

        // Add ordering
        const orderByColumn = assetCategories[query.sortBy as keyof typeof assetCategories];
        const orderDirection = query.sortOrder === 'asc' ? asc : desc;
        selectQuery = selectQuery.orderBy(orderDirection(orderByColumn));

        // Add pagination
        selectQuery = selectQuery.limit(query.limit).offset(offset);

        const categoriesData = await selectQuery;

        // Include additional data if requested
        let result = categoriesData;
        if (query.includeAssetCount || query.includeChildCategories) {
            result = await Promise.all(
                categoriesData.map(async (category) => {
                    let enrichedCategory = { ...category };

                    if (query.includeAssetCount) {
                        const assetCount = await db
                            .select({ count: assets.id })
                            .from(assets)
                            .where(eq(assets.categoryId, category.id));

                        enrichedCategory.assetCount = assetCount.length;
                    }

                    if (query.includeChildCategories) {
                        const childCategories = await db
                            .select()
                            .from(assetCategories)
                            .where(eq(assetCategories.parentCategoryId, category.id));

                        enrichedCategory.childCategories = childCategories;
                        enrichedCategory.childCount = childCategories.length;
                    }

                    return enrichedCategory;
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
        console.error('Error fetching asset categories:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid query parameters',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to fetch asset categories'
        }, { status: 500 });
    }
}

// POST - Create new asset category
export async function POST(request: NextRequest) {
    try {
        const permission = await checkPermission('create', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = categoryCreateSchema.parse(body);

        // Check if code already exists
        const existingCategory = await db
            .select()
            .from(assetCategories)
            .where(eq(assetCategories.code, validatedData.code))
            .limit(1);

        if (existingCategory.length > 0) {
            return NextResponse.json({
                error: 'Category code already exists'
            }, { status: 409 });
        }

        // Validate parent category if provided
        if (validatedData.parentCategoryId) {
            const parentCategory = await db
                .select()
                .from(assetCategories)
                .where(eq(assetCategories.id, validatedData.parentCategoryId))
                .limit(1);

            if (parentCategory.length === 0) {
                return NextResponse.json({
                    error: 'Parent category not found'
                }, { status: 400 });
            }

            // Validate level (child must be one level deeper than parent)
            const parentLevel = parentCategory[0].level;
            if (validatedData.level !== parentLevel + 1) {
                return NextResponse.json({
                    error: `Child category must be level ${parentLevel + 1}`,
                    parentLevel,
                    providedLevel: validatedData.level
                }, { status: 400 });
            }

            // Validate path format
            const expectedPath = `${parentCategory[0].path}/${validatedData.name}`;
            if (validatedData.path !== expectedPath) {
                return NextResponse.json({
                    error: 'Invalid path format',
                    expectedPath,
                    providedPath: validatedData.path
                }, { status: 400 });
            }
        } else {
            // Root category must be level 1
            if (validatedData.level !== 1) {
                return NextResponse.json({
                    error: 'Root categories must be level 1'
                }, { status: 400 });
            }

            // Validate path for root category
            if (validatedData.path !== validatedData.name) {
                return NextResponse.json({
                    error: 'Root category path must match name',
                    expectedPath: validatedData.name,
                    providedPath: validatedData.path
                }, { status: 400 });
            }
        }

        // Create the category
        const newCategory = {
            ...validatedData,
            createdBy: permission.user.id,
            updatedBy: permission.user.id,
        };

        const result = await db
            .insert(assetCategories)
            .values(newCategory)
            .returning();

        return NextResponse.json({
            message: 'Asset category created successfully',
            data: result[0],
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating asset category:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid request data',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to create asset category'
        }, { status: 500 });
    }
}