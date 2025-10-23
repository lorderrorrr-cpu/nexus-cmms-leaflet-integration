import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { tickets, locations, assets, priorities, users, ticketStatusHistory, ticketAttachments, ticketComments } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

const ticketUpdateSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
    description: z.string().min(1, 'Description is required').optional(),
    priorityLevel: z.number().int().min(1).max(4).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assignedToId: z.string().uuid().optional(),
    assignedToName: z.string().optional(),
    status: z.enum(['draft', 'open', 'assigned', 'acknowledged', 'on_progress', 'pending_review', 'rejected', 'approved', 'closed', 'cancelled']).optional(),
    workflowState: z.string().optional(),

    // CM specific updates
    cmIncidentType: z.enum(['hardware_failure', 'software_issue', 'network_problem', 'power_issue', 'other']).optional(),
    cmImpactAssessment: z.string().optional(),
    cmRootCause: z.string().optional(),
    cmResolutionSteps: z.string().optional(),
    cmAffectedServices: z.string().optional(),
    cmBusinessImpact: z.enum(['low', 'medium', 'high', 'critical']).optional(),

    // PM specific updates
    pmChecklistResults: z.string().optional(),
    pmCompletedDate: z.string().datetime().optional(),

    // Work completion
    workLocationLat: z.number().refine(val => val >= -90 && val <= 90).optional(),
    workLocationLng: z.number().refine(val => val >= -180 && val <= 180).optional(),
    workLocationAccuracy: z.number().min(0).optional(),
    locationVerified: z.boolean().optional(),
    locationVerificationMethod: z.enum(['gps', 'manual', 'admin_override']).optional(),
    beforePhotos: z.string().optional(),
    afterPhotos: z.string().optional(),
    additionalPhotos: z.string().optional(),
    technicianNotes: z.string().optional(),
    technicianFindings: z.string().optional(),
    technicianRecommendations: z.string().optional(),
    technicianSignature: z.string().optional(),
    technicianSignedAt: z.string().datetime().optional(),

    // Cost and materials
    laborCost: z.number().min(0).optional(),
    materialCost: z.number().min(0).optional(),
    sparePartsUsed: z.string().optional(),
    sparePartsCost: z.number().min(0).optional(),
    partsRemoved: z.string().optional(),

    // Customer feedback
    customerSatisfaction: z.number().int().min(1).max(5).optional(),
    customerFeedback: z.string().optional(),
    customerSignature: z.string().optional(),
    customerSignedAt: z.string().datetime().optional(),

    // Metadata
    tags: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
});

// Status transition validation
const validTransitions: Record<string, string[]> = {
    'draft': ['open', 'cancelled'],
    'open': ['assigned', 'cancelled'],
    'assigned': ['acknowledged', 'reassigned', 'cancelled'],
    'acknowledged': ['on_progress', 'rejected', 'cancelled'],
    'on_progress': ['pending_review', 'cancelled'],
    'pending_review': ['approved', 'rejected'],
    'rejected': ['acknowledged', 'cancelled'],
    'approved': ['closed'],
    'closed': [], // End state - can only reopen via special logic
    'cancelled': [], // End state
};

// Helper function to check permissions
async function checkPermission(action: 'read' | 'update' | 'delete', request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session?.user) {
        return { authorized: false, error: 'Unauthorized' };
    }

    // For now, allow all authenticated users to read tickets
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

// Helper function to add status history
async function addStatusHistory(
    ticketId: string,
    fromStatus: string | null,
    toStatus: string,
    changedBy: string,
    changedByName: string,
    reason?: string,
    comments?: string
) {
    await db.insert(ticketStatusHistory).values({
        ticketId,
        fromStatus,
        toStatus,
        reason,
        changedById: changedBy,
        changedByName,
        comments,
        changedAt: new Date(),
    });
}

// Helper function to validate GPS coordinates
function validateGPSLocation(
    ticketLat: number | null,
    ticketLng: number | null,
    actualLat: number | undefined,
    actualLng: number | undefined,
    accuracy: number | undefined = 50
): { isValid: boolean; distance?: number; reason?: string } {
    if (!ticketLat || !ticketLng || !actualLat || !actualLng) {
        return { isValid: false, reason: 'Missing GPS coordinates' };
    }

    // Calculate distance using Haversine formula
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (ticketLat * Math.PI) / 180;
    const φ2 = (actualLat * Math.PI) / 180;
    const Δφ = ((actualLat - ticketLat) * Math.PI) / 180;
    const Δλ = ((actualLng - ticketLng) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters

    return {
        isValid: distance <= accuracy,
        distance,
        reason: distance > accuracy ? `Location too far (${Math.round(distance)}m > ${accuracy}m)` : undefined,
    };
}

// GET - Get single ticket by ID
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('read', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const ticketId = params.id;

        // Validate UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(ticketId)) {
            return NextResponse.json({
                error: 'Invalid ticket ID format'
            }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const includeLocation = searchParams.get('includeLocation') === 'true';
        const includeAsset = searchParams.get('includeAsset') === 'true';
        const includePriority = searchParams.get('includePriority') === 'true';
        const includeAssignedTo = searchParams.get('includeAssignedTo') === 'true';
        const includeRequester = searchParams.get('includeRequester') === 'true';
        const includeStatusHistory = searchParams.get('includeStatusHistory') === 'true';
        const includeAttachments = searchParams.get('includeAttachments') === 'true';
        const includeComments = searchParams.get('includeComments') === 'true';

        // Get the ticket
        const ticketResult = await db
            .select()
            .from(tickets)
            .where(eq(tickets.id, ticketId))
            .limit(1);

        if (ticketResult.length === 0) {
            return NextResponse.json({
                error: 'Ticket not found'
            }, { status: 404 });
        }

        const ticket = ticketResult[0];

        // Build the response with additional data if requested
        let response = { ...ticket };

        if (includeLocation) {
            const locationData = await db
                .select()
                .from(locations)
                .where(eq(locations.id, ticket.locationId))
                .limit(1);

            response.location = locationData[0] || null;
        }

        if (includeAsset && ticket.assetId) {
            const assetData = await db
                .select()
                .from(assets)
                .where(eq(assets.id, ticket.assetId))
                .limit(1);

            response.asset = assetData[0] || null;
        }

        if (includePriority) {
            const priorityData = await db
                .select()
                .from(priorities)
                .where(eq(priorities.level, ticket.priorityLevel))
                .limit(1);

            response.priority = priorityData[0] || null;
        }

        if (includeAssignedTo && ticket.assignedToId) {
            const userData = await db
                .select()
                .from(users)
                .where(eq(users.id, ticket.assignedToId))
                .limit(1);

            response.assignedTo = userData[0] || null;
        }

        if (includeRequester) {
            const userData = await db
                .select()
                .from(users)
                .where(eq(users.id, ticket.requesterId))
                .limit(1);

            response.requester = userData[0] || null;
        }

        if (includeStatusHistory) {
            const statusHistory = await db
                .select()
                .from(ticketStatusHistory)
                .where(eq(ticketStatusHistory.ticketId, ticketId))
                .orderBy(desc(ticketStatusHistory.changedAt));

            response.statusHistory = statusHistory;
        }

        if (includeAttachments) {
            const attachments = await db
                .select()
                .from(ticketAttachments)
                .where(eq(ticketAttachments.ticketId, ticketId))
                .orderBy(desc(ticketAttachments.createdAt));

            response.attachments = attachments;
        }

        if (includeComments) {
            const comments = await db
                .select()
                .from(ticketComments)
                .where(eq(ticketComments.ticketId, ticketId))
                .orderBy(desc(ticketComments.createdAt));

            response.comments = comments;
        }

        // Add computed information
        const computedInfo = {
            // SLA calculations
            responseTimeRemaining: ticket.slaResponseTime && ticket.actualResponseTime
                ? null
                : ticket.slaResponseTime
                    ? Math.floor((new Date(ticket.slaResponseTime).getTime() - Date.now()) / (1000 * 60 * 60))
                    : null,
            resolutionTimeRemaining: ticket.slaResolutionTime && ticket.actualResolutionTime
                ? null
                : ticket.slaResolutionTime
                    ? Math.floor((new Date(ticket.slaResolutionTime).getTime() - Date.now()) / (1000 * 60 * 60))
                    : null,

            // Duration calculations
            totalOpenHours: ticket.reportedAt
                ? Math.floor((Date.now() - new Date(ticket.reportedAt).getTime()) / (1000 * 60 * 60))
                : null,

            // Status validation
            canReopen: ['closed', 'cancelled'].includes(ticket.status),
            canClose: ['approved', 'on_progress', 'pending_review'].includes(ticket.status),
            requiresApproval: ticket.status === 'pending_review',

            // Location verification
            locationVerificationStatus: ticket.workLocationLat && ticket.workLocationLng
                ? validateGPSLocation(
                    response.location?.latitude ? Number(response.location.latitude) : null,
                    response.location?.longitude ? Number(response.location.longitude) : null,
                    Number(ticket.workLocationLat),
                    Number(ticket.workLocationLng),
                    ticket.workLocationAccuracy ? Number(ticket.workLocationAccuracy) : 50
                )
                : null,
        };

        response.computedInfo = computedInfo;

        return NextResponse.json({
            data: response
        });

    } catch (error) {
        console.error('Error fetching ticket:', error);
        return NextResponse.json({
            error: 'Failed to fetch ticket'
        }, { status: 500 });
    }
}

// PUT - Update ticket
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('update', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const ticketId = params.id;
        const body = await request.json();
        const validatedData = ticketUpdateSchema.parse(body);

        // Check if ticket exists
        const existingTicket = await db
            .select()
            .from(tickets)
            .where(eq(tickets.id, ticketId))
            .limit(1);

        if (existingTicket.length === 0) {
            return NextResponse.json({
                error: 'Ticket not found'
            }, { status: 404 });
        }

        const ticket = existingTicket[0];
        const previousStatus = ticket.status;
        let newStatus = validatedData.status || previousStatus;

        // Validate status transition
        if (validatedData.status && validatedData.status !== previousStatus) {
            const allowedTransitions = validTransitions[previousStatus] || [];
            if (!allowedTransitions.includes(validatedData.status)) {
                return NextResponse.json({
                    error: `Invalid status transition from "${previousStatus}" to "${validatedData.status}"`,
                    allowedTransitions,
                    currentStatus: previousStatus,
                    requestedStatus: validatedData.status,
                }, { status: 400 });
            }
        }

        // Handle assignment changes
        if (validatedData.assignedToId && validatedData.assignedToId !== ticket.assignedToId) {
            if (!validatedData.assignedToName) {
                return NextResponse.json({
                    error: 'Assigned to name is required when changing assignment'
                }, { status: 400 });
            }

            // Auto-update status if ticket is open
            if (ticket.status === 'open') {
                newStatus = 'assigned';
            }
        }

        // Validate location verification if provided
        if (validatedData.workLocationLat && validatedData.workLocationLng) {
            // Get location coordinates for validation
            const locationData = await db
                .select()
                .from(locations)
                .where(eq(locations.id, ticket.locationId))
                .limit(1);

            if (locationData.length > 0) {
                const location = locationData[0];
                const validation = validateGPSLocation(
                    location.latitude ? Number(location.latitude) : null,
                    location.longitude ? Number(location.longitude) : null,
                    validatedData.workLocationLat,
                    validatedData.workLocationLng,
                    validatedData.workLocationAccuracy
                );

                if (!validation.isValid && validatedData.locationVerified !== false) {
                    return NextResponse.json({
                        error: 'Location verification failed',
                        validation,
                    }, { status: 400 });
                }
            }
        }

        // Handle completion workflow
        if (validatedData.status === 'pending_review' && previousStatus !== 'pending_review') {
            // Validate that required completion data is provided
            const requiredFields = [];
            if (!validatedData.beforePhotos) requiredFields.push('beforePhotos');
            if (!validatedData.afterPhotos) requiredFields.push('afterPhotos');
            if (!validatedData.technicianNotes) requiredFields.push('technicianNotes');
            if (!validatedData.technicianSignature) requiredFields.push('technicianSignature');
            if (!validatedData.technicianSignedAt) requiredFields.push('technicianSignedAt');

            if (requiredFields.length > 0) {
                return NextResponse.json({
                    error: 'Missing required completion data',
                    requiredFields,
                }, { status: 400 });
            }
        }

        // Build update data
        const updateData: any = {
            ...validatedData,
            updatedBy: permission.user.id,
            updatedAt: new Date(),
        };

        // Auto-calculate totals
        if (validatedData.laborCost !== undefined || validatedData.materialCost !== undefined) {
            const laborCost = validatedData.laborCost !== undefined ? validatedData.laborCost : (ticket.laborCost || 0);
            const materialCost = validatedData.materialCost !== undefined ? validatedData.materialCost : (ticket.materialCost || 0);
            const sparePartsCost = validatedData.sparePartsCost !== undefined ? validatedData.sparePartsCost : (ticket.sparePartsCost || 0);

            updateData.totalCost = laborCost + materialCost + sparePartsCost;
        }

        // Handle timing updates
        if (validatedData.status === 'assigned' && previousStatus === 'open') {
            updateData.assignedAt = new Date();
        } else if (validatedData.status === 'acknowledged' && previousStatus === 'assigned') {
            updateData.acknowledgedAt = new Date();
        } else if (validatedData.status === 'on_progress' && previousStatus === 'acknowledged') {
            updateData.startedAt = new Date();
        } else if (validatedData.status === 'pending_review' && previousStatus === 'on_progress') {
            updateData.completedAt = new Date();
        } else if (validatedData.status === 'closed' && previousStatus === 'approved') {
            updateData.closedAt = new Date();
            updateData.jobcardGenerated = true;
            updateData.jobcardGeneratedAt = new Date();
            // TODO: Generate actual jobcard
            updateData.jobcardNumber = `JC-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        }

        // Update the ticket
        const result = await db
            .update(tickets)
            .set(updateData)
            .where(eq(tickets.id, ticketId))
            .returning();

        // Add status history if status changed
        if (validatedData.status && validatedData.status !== previousStatus) {
            await addStatusHistory(
                ticketId,
                previousStatus,
                validatedData.status,
                permission.user.id,
                permission.user.name || 'Unknown',
                validatedData.status === 'rejected' ? 'Work rejected by reviewer' : 'Status updated',
                validatedData.technicianNotes
            );
        }

        // TODO: Send notifications for status changes
        // TODO: Update related records (PM schedules, etc.)

        return NextResponse.json({
            message: 'Ticket updated successfully',
            data: result[0],
        });

    } catch (error) {
        console.error('Error updating ticket:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid request data',
                details: error.errors
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to update ticket'
        }, { status: 500 });
    }
}

// DELETE - Soft delete ticket
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const permission = await checkPermission('delete', request);
        if (!permission.authorized) {
            return NextResponse.json({ error: permission.error }, { status: 401 });
        }

        const ticketId = params.id;

        // Check if ticket exists
        const existingTicket = await db
            .select()
            .from(tickets)
            .where(eq(tickets.id, ticketId))
            .limit(1);

        if (existingTicket.length === 0) {
            return NextResponse.json({
                error: 'Ticket not found'
            }, { status: 404 });
        }

        const ticket = existingTicket[0];

        // Prevent deletion of active tickets
        if (['open', 'assigned', 'acknowledged', 'on_progress'].includes(ticket.status)) {
            return NextResponse.json({
                error: 'Cannot delete active ticket',
                currentStatus: ticket.status,
                suggestion: 'Cancel the ticket instead of deleting'
            }, { status: 409 });
        }

        // Soft delete by setting isActive to false
        const result = await db
            .update(tickets)
            .set({
                isActive: false,
                updatedBy: permission.user.id,
                updatedAt: new Date(),
            })
            .where(eq(tickets.id, ticketId))
            .returning();

        return NextResponse.json({
            message: 'Ticket deleted successfully',
            data: result[0],
        });

    } catch (error) {
        console.error('Error deleting ticket:', error);
        return NextResponse.json({
            error: 'Failed to delete ticket'
        }, { status: 500 });
    }
}