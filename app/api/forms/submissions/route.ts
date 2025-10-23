import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  formSubmissions,
  formTemplates,
  formAttachments,
  formFieldValues,
  tickets,
  users
} from '@/db/schema';
import { eq, ilike, and, desc, asc, or, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Validation schemas
const submissionCreateSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
  ticketId: z.string().uuid('Invalid ticket ID').optional(),
  formData: z.record(z.any()),
  submissionMetadata: z.object({
    deviceInfo: z.string().optional(),
    appVersion: z.string().optional(),
    userAgent: z.string().optional(),
  }).optional(),
});

const submissionQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive().default(1)),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100).default(20)),
  templateId: z.string().uuid().optional(),
  ticketId: z.string().uuid().optional(),
  status: z.enum(['submitted', 'pending_review', 'approved', 'rejected']).optional(),
  submittedById: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['submittedAt', 'updatedAt', 'status', 'templateName']).default('submittedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeAttachments: z.string().transform(val => val === 'true').default(false),
  includeFieldValues: z.string().transform(val => val === 'true').default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = submissionQuerySchema.parse(Object.fromEntries(searchParams));

    // Build base query
    let whereConditions = [];

    // Add template filter
    if (query.templateId) {
      whereConditions.push(eq(formSubmissions.templateId, query.templateId));
    }

    // Add ticket filter
    if (query.ticketId) {
      whereConditions.push(eq(formSubmissions.ticketId, query.ticketId));
    }

    // Add status filter
    if (query.status) {
      whereConditions.push(eq(formSubmissions.status, query.status));
    }

    // Add submitted by filter
    if (query.submittedById) {
      whereConditions.push(eq(formSubmissions.submittedBy, query.submittedById));
    }

    // Add date range filter
    if (query.startDate && query.endDate) {
      whereConditions.push(
        and(
          eq(formSubmissions.submittedAt, query.startDate),
          eq(formSubmissions.submittedAt, query.endDate)
        )
      );
    }

    // Add search conditions
    if (query.search) {
      whereConditions.push(
        or(
          ilike(formSubmissions.submissionReference, `%${query.search}%`),
          // Add more searchable fields as needed
        )
      );
    }

    // Combine all conditions
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Build order by clause
    let orderBy;
    const sortColumn = {
      submittedAt: formSubmissions.submittedAt,
      updatedAt: formSubmissions.updatedAt,
      status: formSubmissions.status,
    }[query.sortBy];

    orderBy = query.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);

    // Execute query with pagination
    const submissions = await db
      .select({
        id: formSubmissions.id,
        templateId: formSubmissions.templateId,
        ticketId: formSubmissions.ticketId,
        submissionReference: formSubmissions.submissionReference,
        formData: formSubmissions.formData,
        fieldValues: formSubmissions.fieldValues,
        submittedAt: formSubmissions.submittedAt,
        latitude: formSubmissions.latitude,
        longitude: formSubmissions.longitude,
        gpsAccuracy: formSubmissions.gpsAccuracy,
        durationMinutes: formSubmissions.durationMinutes,
        deviceInfo: formSubmissions.deviceInfo,
        appVersion: formSubmissions.appVersion,
        isOfflineSubmission: formSubmissions.isOfflineSubmission,
        syncedAt: formSubmissions.syncedAt,
        status: formSubmissions.status,
        completionPercentage: formSubmissions.completionPercentage,
        photoCount: formSubmissions.photoCount,
        attachmentCount: formSubmissions.attachmentCount,
        submittedBy: formSubmissions.submittedBy,
        reviewedBy: formSubmissions.reviewedBy,
        reviewedAt: formSubmissions.reviewedAt,
        reviewNotes: formSubmissions.reviewNotes,
        rejectionReason: formSubmissions.rejectionReason,
        createdAt: formSubmissions.createdAt,
        updatedAt: formSubmissions.updatedAt,
        // Include related data
        template: {
          id: formTemplates.id,
          name: formTemplates.name,
          category: formTemplates.category,
        },
        submittedByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        reviewedByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(formSubmissions)
      .leftJoin(formTemplates, eq(formSubmissions.templateId, formTemplates.id))
      .leftJoin(users, eq(formSubmissions.submittedBy, users.id))
      .leftJoin(users.as('reviewer'), eq(formSubmissions.reviewedBy, reviewer.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: formSubmissions.id })
      .from(formSubmissions)
      .leftJoin(formTemplates, eq(formSubmissions.templateId, formTemplates.id))
      .leftJoin(users, eq(formSubmissions.submittedBy, users.id))
      .leftJoin(users.as('reviewer'), eq(formSubmissions.reviewedBy, reviewer.id))
      .where(whereClause);

    const totalCount = totalCountResult.length;

    // Get attachments if requested
    if (query.includeAttachments && submissions.length > 0) {
      const submissionIds = submissions.map(s => s.id);
      const attachments = await db
        .select()
        .from(formAttachments)
        .where(eq(formAttachments.submissionId, submissionIds[0])); // Simplified - would need adjustment for multiple

      // Attach to submissions (simplified)
      if (attachments.length > 0) {
        (submissions as any)[0].attachments = attachments;
      }
    }

    // Get field values if requested
    if (query.includeFieldValues && submissions.length > 0) {
      const submissionIds = submissions.map(s => s.id);
      const fieldValues = await db
        .select()
        .from(formFieldValues)
        .where(eq(formFieldValues.submissionId, submissionIds[0])); // Simplified

      // Attach to submissions (simplified)
      if (fieldValues.length > 0) {
        (submissions as any)[0].fieldValues = fieldValues;
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / query.limit);
    const hasNextPage = query.page < totalPages;
    const hasPreviousPage = query.page > 1;

    return NextResponse.json({
      data: submissions,
      pagination: {
        currentPage: query.page,
        totalPages,
        totalCount,
        limit: query.limit,
        hasNextPage,
        hasPreviousPage,
      },
      success: true,
    });
  } catch (error) {
    console.error('Error fetching form submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = submissionCreateSchema.parse(body);

    // Generate unique submission reference
    const submissionReference = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create form submission
    const [newSubmission] = await db.insert(formSubmissions).values({
      templateId: validatedData.templateId,
      ticketId: validatedData.ticketId,
      submissionReference,
      formData: JSON.stringify(validatedData.formData),
      fieldValues: JSON.stringify(validatedData.formData), // Denormalized for easy querying
      submittedAt: new Date(),
      latitude: validatedData.formData.gps?.latitude,
      longitude: validatedData.formData.gps?.longitude,
      gpsAccuracy: validatedData.formData.gps?.accuracy,
      deviceInfo: validatedData.submissionMetadata?.deviceInfo || JSON.stringify({
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for'),
      }),
      appVersion: validatedData.submissionMetadata?.appVersion,
      isOfflineSubmission: false, // Would be set to true for offline submissions
      status: 'submitted',
      submittedBy: session.user.id,
      // Calculate metrics
      completionPercentage: 100, // Would be calculated based on required fields
      photoCount: Object.values(validatedData.formData).filter(
        (value: any) => Array.isArray(value) && value.some((item: any) => item.type === 'photo' || item.file)
      ).length,
      attachmentCount: Object.values(validatedData.formData).filter(
        (value: any) => Array.isArray(value) && value.some((item: any) => item.type === 'file')
      ).length,
    }).returning();

    // Store individual field values for easy querying
    const fieldValuesData = Object.entries(validatedData.formData).map(([fieldKey, value]) => ({
      submissionId: newSubmission.id,
      templateId: validatedData.templateId,
      fieldKey,
      fieldType: Array.isArray(value) ? 'array' : typeof value,
      textValue: typeof value === 'string' ? value : null,
      numberValue: typeof value === 'number' ? value : null,
      booleanValue: typeof value === 'boolean' ? value : null,
      jsonValue: typeof value === 'object' ? JSON.stringify(value) : null,
      latitude: validatedData.formData.gps?.latitude,
      longitude: validatedData.formData.gps?.longitude,
      gpsAccuracy: validatedData.formData.gps?.accuracy,
      isValid: true, // Would be calculated based on validation
    }));

    if (fieldValuesData.length > 0) {
      await db.insert(formFieldValues).values(fieldValuesData);
    }

    // Process and store attachments if any
    const attachments = [];
    Object.entries(validatedData.formData).forEach(([fieldKey, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item: any, index: number) => {
          if (item.file || item.data) {
            attachments.push({
              submissionId: newSubmission.id,
              fieldKey,
              originalFileName: item.name || `attachment_${index}`,
              storedFileName: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              filePath: item.path || '', // Would be the actual stored file path
              fileSize: item.size || 0,
              mimeType: item.type || 'application/octet-stream',
              fileHash: item.hash || '',
              width: item.width,
              height: item.height,
              duration: item.duration,
              caption: item.caption,
              tags: item.tags,
              isPrimary: item.isPrimary || false,
              latitude: item.latitude,
              longitude: item.longitude,
              takenAt: item.takenAt,
            });
          }
        });
      }
    });

    if (attachments.length > 0) {
      await db.insert(formAttachments).values(attachments);
    }

    return NextResponse.json({
      data: newSubmission,
      success: true,
      message: 'Form submission created successfully',
    });
  } catch (error) {
    console.error('Error creating form submission:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors, success: false },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}