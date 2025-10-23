import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { priorities } from '@/db/schema';
import { eq, ilike, desc, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Validation schemas
const priorityCreateSchema = z.object({
    name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
    level: z.number().int().min(1).max(10, 'Level must be between 1 and 10'),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color code'),
    responseTimeHours: z.number().min(0, 'Response time must be positive'),
    resolutionTimeHours: z.number().min(0, 'Resolution time must be positive'),
    escalationIntervalHours: z.number().min(0, 'Escalation interval must be positive').optional(),
    maxEscalationLevel: z.number().int().min(1).default(3),
    notificationChannels: z.string().min(1, 'Notification channels are required'),
    notificationFrequency: z.enum(['real_time', 'hourly', 'daily']).optional(),
    autoAssignToRole: z.string().optional(),
    requireManagerApproval: z.boolean().default(false),
    businessHoursOnly: z.boolean().default(true),
    weekendSupport: z.boolean().default(false),
});

const priorityUpdateSchema = priorityCreateSchema.partial();

const priorityQuerySchema = z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive().default(1)),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100).default(20)),
    search: z.string().optional(),
    isActive: z.string().transform(Boolean).pipe(z.boolean().default(true)),
    sortBy: z.enum(['name', 'level', 'responseTimeHours', 'resolutionTimeHours', 'createdAt', 'updatedAt']).default('level'),
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

    // For now, allow all authenticated users to read priorities
    if (action === 'read') {
        return { authorized: true, user: session.user };
    }

    if (action === 'create' || action === 'update' || action === 'delete') {
        // TODO: Implement proper role-based authorization (require admin or supervisor)
        // For now, allow all authenticated users
        return { authorized: true, user: session.user };
    }

    return { authorized: false, error: 'Insufficient permissions' };
}

// GET - List priorities with filtering and pagination
export async function GET(request: NextRequest) {
    try {
        const permission = await checkPermission('read', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = priorityQuerySchema.parse(Object.fromEntries(searchParams));

        // Build the query
        let conditions = [];

        // Always filter by active status unless explicitly requested
        conditions.push(eq(priorities.isActive, query.isActive));

        if (query.search) {
            conditions.push(
                ilike(priorities.name, `%${query.search}%`)
            );
        }

        const whereClause = conditions.length > 0 ? conditions.reduce((acc, condition) => acc && condition) : undefined;

        // Get total count
        const totalCountResult = await db
            .select({ count: priorities.id })
            .from(priorities)
            .where(whereClause);
        const totalCount = totalCountResult.length;

        // Calculate pagination
        const offset = (query.page - 1) * query.limit;
        const totalPages = Math.ceil(totalCount / query.limit);

        // Build the main query
        let selectQuery = db.select().from(priorities).where(whereClause);

        // Add ordering
        const orderByColumn = priorities[query.sortBy as keyof typeof priorities];
        const orderDirection = query.sortOrder === 'asc' ? asc : desc;
        selectQuery = selectQuery.orderBy(orderDirection(orderByColumn));

        // Add pagination
        selectQuery = selectQuery.limit(query.limit).offset(offset);

        const prioritiesData = await selectQuery;

        // Parse notification channels for each priority
        const result = prioritiesData.map(priority => ({
            ...priority,
            notificationChannels: JSON.parse(priority.notificationChannels || '[]'),
        }));

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
        console.error('Error fetching priorities:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid query parameters',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to fetch priorities'
        }, { status: 500 });
    }
}

// POST - Create new priority
export async function POST(request: NextRequest) {
    try {
        const permission = await checkPermission('create', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = priorityCreateSchema.parse(body);

        // Validate notification channels JSON
        try {
            const channels = JSON.parse(validatedData.notificationChannels);
            if (!Array.isArray(channels) || channels.length === 0) {
                return NextResponse.json({
                    error: 'Notification channels must be a non-empty array'
                }, { status: 400 });
            }

            const validChannels = ['email', 'sms', 'push'];
            const invalidChannels = channels.filter(channel => !validChannels.includes(channel));
            if (invalidChannels.length > 0) {
                return NextResponse.json({
                    error: 'Invalid notification channels',
                    invalidChannels,
                    validChannels
                }, { status: 400 });
            }
        } catch (error) {
            return NextResponse.json({
                error: 'Notification channels must be valid JSON array'
            }, { status: 400 });
        }

        // Check if name already exists
        const existingPriority = await db
            .select()
            .from(priorities)
            .where(eq(priorities.name, validatedData.name))
            .limit(1);

        if (existingPriority.length > 0) {
            return NextResponse.json({
                error: 'Priority name already exists'
            }, { status: 409 });
        }

        // Check if level already exists
        const existingLevel = await db
            .select()
            .from(priorities)
            .where(eq(priorities.level, validatedData.level))
            .limit(1);

        if (existingLevel.length > 0) {
            return NextResponse.json({
                error: 'Priority level already exists'
            }, { status: 409 });
        }

        // Validate time relationships
        if (validatedData.responseTimeHours > validatedData.resolutionTimeHours) {
            return NextResponse.json({
                error: 'Response time cannot be greater than resolution time',
                responseTimeHours: validatedData.responseTimeHours,
                resolutionTimeHours: validatedData.resolutionTimeHours
            }, { status: 400 });
        }

        // Create the priority
        const newPriority = {
            ...validatedData,
            notificationChannels: validatedData.notificationChannels,
            createdBy: permission.user.id,
            updatedBy: permission.user.id,
        };

        const result = await db
            .insert(priorities)
            .values(newPriority)
            .returning();

        return NextResponse.json({
            message: 'Priority created successfully',
            data: {
                ...result[0],
                notificationChannels: JSON.parse(result[0].notificationChannels),
            },
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating priority:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid request data',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to create priority'
        }, { status: 500 });
    }
}