import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { tickets, locations, assets, priorities, users, workflowStates } from '@/db/schema';
import { eq, ilike, and, desc, asc, or, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Validation schemas
const ticketCreateSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    description: z.string().min(1, 'Description is required'),
    category: z.enum(['pm', 'cm'], {
        errorMap: (issue, ctx) => ({
            message: 'Category must be either "pm" (Preventive Maintenance) or "cm" (Corrective Maintenance)',
        }),
    }),
    priorityLevel: z.number().int().min(1).max(4, 'Priority level must be between 1 and 4'),
    locationId: z.string().uuid('Invalid location ID'),
    assetId: z.string().uuid().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),

    // Requester information
    requesterName: z.string().min(1, 'Requester name is required'),
    requesterPhone: z.string().max(20).optional(),
    requesterEmail: z.string().email().optional(),

    // PM specific fields
    pmScheduleId: z.string().uuid().optional(),
    pmTemplateId: z.string().uuid().optional(),
    pmDueDate: z.string().datetime().optional(),

    // CM specific fields
    cmIncidentType: z.enum(['hardware_failure', 'software_issue', 'network_problem', 'power_issue', 'other']).optional(),
    cmImpactAssessment: z.string().optional(),
    cmAffectedServices: z.string().optional(), // JSON array
    cmBusinessImpact: z.enum(['low', 'medium', 'high', 'critical']).optional(),

    // Assignment
    assignedToId: z.string().uuid().optional(),
    assignedToName: z.string().optional(),

    // Notes and metadata
    tags: z.string().optional(), // JSON array
    metadata: z.string().optional(), // JSON object
});

const ticketUpdateSchema = ticketCreateSchema.partial();

const ticketQuerySchema = z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive().default(1)),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100).default(20)),
    search: z.string().optional(),
    category: z.enum(['pm', 'cm']).optional(),
    status: z.string().optional(),
    priorityLevel: z.number().int().min(1).max(4).optional(),
    locationId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().optional(),
    requesterId: z.string().uuid().optional(),
    slaStatus: z.enum(['on_time', 'at_risk', 'breached']).optional(),
    workflowState: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    sortBy: z.enum(['ticketNumber', 'title', 'createdAt', 'updatedAt', 'priorityLevel', 'slaStatus', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    includeLocation: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    includeAsset: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    includePriority: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    includeAssignedTo: z.string().transform(Boolean).pipe(z.boolean().default(false)),
    includeRequester: z.string().transform(Boolean).pipe(z.boolean().default(false)),
});

// Helper function to generate ticket number
function generateTicketNumber(category: 'pm' | 'cm'): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = String(date.getTime()).slice(-4);

    return `${category.toUpperCase()}-${year}${month}${day}-${time}`;
}

// Helper function to calculate SLA times
function calculateSLATimes(priorityLevel: number) {
    const slaMatrix = {
        1: { response: 1, resolution: 4 },    // Critical
        2: { response: 2, resolution: 8 },    // High
        3: { response: 4, resolution: 24 },   // Medium
        4: { response: 8, resolution: 48 },   // Low
    };

    const sla = slaMatrix[priorityLevel as keyof typeof slaMatrix];
    const now = new Date();

    return {
        responseTime: new Date(now.getTime() + sla.response * 60 * 60 * 1000),
        resolutionTime: new Date(now.getTime() + sla.resolution * 60 * 60 * 1000),
    };
}

// Helper function to check permissions
async function checkPermission(action: 'create' | 'read' | 'update' | 'delete', request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session?.user) {
        return { authorized: false, error: 'Unauthorized' };
    }

    // For now, allow all authenticated users to read and create tickets
    if (action === 'read' || action === 'create') {
        return { authorized: true, user: session.user };
    }

    if (action === 'update' || action === 'delete') {
        // TODO: Implement proper role-based authorization
        // For now, allow all authenticated users
        return { authorized: true, user: session.user };
    }

    return { authorized: false, error: 'Insufficient permissions' };
}

// GET - List tickets with filtering and pagination
export async function GET(request: NextRequest) {
    try {
        const permission = await checkPermission('read', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = ticketQuerySchema.parse(Object.fromEntries(searchParams));

        // Build the query
        let conditions = [];

        if (query.search) {
            conditions.push(
                or(
                    ilike(tickets.ticketNumber, `%${query.search}%`),
                    ilike(tickets.title, `%${query.search}%`),
                    ilike(tickets.description, `%${query.search}%`)
                )
            );
        }

        if (query.category) {
            conditions.push(eq(tickets.category, query.category));
        }

        if (query.status) {
            conditions.push(eq(tickets.status, query.status));
        }

        if (query.priorityLevel) {
            conditions.push(eq(tickets.priorityLevel, query.priorityLevel));
        }

        if (query.locationId) {
            conditions.push(eq(tickets.locationId, query.locationId));
        }

        if (query.assetId) {
            conditions.push(eq(tickets.assetId, query.assetId));
        }

        if (query.assignedToId) {
            conditions.push(eq(tickets.assignedToId, query.assignedToId));
        }

        if (query.requesterId) {
            conditions.push(eq(tickets.requesterId, query.requesterId));
        }

        if (query.slaStatus) {
            conditions.push(eq(tickets.slaStatus, query.slaStatus));
        }

        if (query.workflowState) {
            conditions.push(eq(tickets.workflowState, query.workflowState));
        }

        if (query.dateFrom) {
            conditions.push(
                // Note: Drizzle doesn't have gte operator directly, use custom SQL or date comparison
                // For now, this is simplified
                or(
                    ilike(tickets.createdAt, `%${query.dateFrom}%`)
                )
            );
        }

        // Only show active tickets by default
        conditions.push(eq(tickets.isActive, true));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const totalCountResult = await db
            .select({ count: tickets.id })
            .from(tickets)
            .where(whereClause);
        const totalCount = totalCountResult.length;

        // Calculate pagination
        const offset = (query.page - 1) * query.limit;
        const totalPages = Math.ceil(totalCount / query.limit);

        // Build the main query
        let selectQuery = db.select().from(tickets).where(whereClause);

        // Add ordering
        const orderByColumn = tickets[query.sortBy as keyof typeof tickets];
        const orderDirection = query.sortOrder === 'asc' ? asc : desc;
        selectQuery = selectQuery.orderBy(orderDirection(orderByColumn));

        // Add pagination
        selectQuery = selectQuery.limit(query.limit).offset(offset);

        const ticketsData = await selectQuery;

        // Include related data if requested
        let result = ticketsData;
        if (query.includeLocation || query.includeAsset || query.includePriority ||
            query.includeAssignedTo || query.includeRequester) {
            result = await Promise.all(
                ticketsData.map(async (ticket) => {
                    let enrichedTicket = { ...ticket };

                    if (query.includeLocation) {
                        const locationData = await db
                            .select()
                            .from(locations)
                            .where(eq(locations.id, ticket.locationId))
                            .limit(1);

                        enrichedTicket.location = locationData[0] || null;
                    }

                    if (query.includeAsset && ticket.assetId) {
                        const assetData = await db
                            .select()
                            .from(assets)
                            .where(eq(assets.id, ticket.assetId))
                            .limit(1);

                        enrichedTicket.asset = assetData[0] || null;
                    }

                    if (query.includePriority) {
                        const priorityData = await db
                            .select()
                            .from(priorities)
                            .where(eq(priorities.level, ticket.priorityLevel))
                            .limit(1);

                        enrichedTicket.priority = priorityData[0] || null;
                    }

                    if (query.includeAssignedTo && ticket.assignedToId) {
                        const userData = await db
                            .select()
                            .from(users)
                            .where(eq(users.id, ticket.assignedToId))
                            .limit(1);

                        enrichedTicket.assignedTo = userData[0] || null;
                    }

                    if (query.includeRequester) {
                        const userData = await db
                            .select()
                            .from(users)
                            .where(eq(users.id, ticket.requesterId))
                            .limit(1);

                        enrichedTicket.requester = userData[0] || null;
                    }

                    return enrichedTicket;
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
        console.error('Error fetching tickets:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid query parameters',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to fetch tickets'
        }, { status: 500 });
    }
}

// POST - Create new ticket
export async function POST(request: NextRequest) {
    try {
        const permission = await checkPermission('create', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = ticketCreateSchema.parse(body);

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

        // Validate asset if provided
        if (validatedData.assetId) {
            const assetExists = await db
                .select()
                .from(assets)
                .where(and(
                    eq(assets.id, validatedData.assetId),
                    eq(assets.locationId, validatedData.locationId)
                ))
                .limit(1);

            if (assetExists.length === 0) {
                return NextResponse.json({
                    error: 'Asset not found or does not belong to specified location'
                }, { status: 400 });
            }
        }

        // Validate PM specific fields
        if (validatedData.category === 'pm') {
            if (!validatedData.pmScheduleId && !validatedData.pmTemplateId) {
                return NextResponse.json({
                    error: 'PM tickets must have either schedule ID or template ID'
                }, { status: 400 });
            }
        }

        // Validate CM specific fields
        if (validatedData.category === 'cm') {
            if (!validatedData.cmIncidentType) {
                return NextResponse.json({
                    error: 'CM tickets must specify incident type'
                }, { status: 400 });
            }
        }

        // Generate ticket number and calculate SLA
        const ticketNumber = generateTicketNumber(validatedData.category);
        const slaTimes = calculateSLATimes(validatedData.priorityLevel);

        // Create the ticket
        const newTicket = {
            ticketNumber,
            title: validatedData.title,
            description: validatedData.description,
            category: validatedData.category,
            priorityLevel: validatedData.priorityLevel,
            locationId: validatedData.locationId,
            assetId: validatedData.assetId || null,
            severity: validatedData.severity || null,
            requesterId: permission.user.id,
            requesterName: validatedData.requesterName,
            requesterPhone: validatedData.requesterPhone || null,
            requesterEmail: validatedData.requesterEmail || null,

            // Assignment
            assignedToId: validatedData.assignedToId || null,
            assignedToName: validatedData.assignedToName || null,
            assignedAt: validatedData.assignedToId ? new Date() : null,

            // Status and workflow
            status: validatedData.assignedToId ? 'assigned' : 'open',
            workflowState: validatedData.assignedToId ? 'assigned' : 'open',

            // SLA
            slaResponseTime: slaTimes.responseTime,
            slaResolutionTime: slaTimes.resolutionTime,
            slaStatus: 'on_time',

            // PM specific
            pmScheduleId: validatedData.pmScheduleId || null,
            pmTemplateId: validatedData.pmTemplateId || null,
            pmDueDate: validatedData.pmDueDate ? new Date(validatedData.pmDueDate) : null,

            // CM specific
            cmIncidentType: validatedData.cmIncidentType || null,
            cmImpactAssessment: validatedData.cmImpactAssessment || null,
            cmAffectedServices: validatedData.cmAffectedServices || null,
            cmBusinessImpact: validatedData.cmBusinessImpact || null,

            // Metadata
            tags: validatedData.tags || null,
            metadata: validatedData.metadata || null,

            // Tracking
            reportedAt: new Date(),
            createdBy: permission.user.id,
            updatedBy: permission.user.id,
            isActive: true,
        };

        const result = await db
            .insert(tickets)
            .values(newTicket)
            .returning();

        // TODO: Send notifications to assigned technician if assigned
        // TODO: Update PM schedule if this is a PM ticket

        return NextResponse.json({
            message: `${validatedData.category.toUpperCase()} ticket created successfully`,
            data: result[0],
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating ticket:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid request data',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to create ticket'
        }, { status: 500 });
    }
}