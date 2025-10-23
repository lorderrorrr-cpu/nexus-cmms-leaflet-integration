import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  formTemplates,
  formFields,
  formTemplateCategories,
  assetCategories
} from '@/db/schema';
import { eq, ilike, and, desc, asc, or, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Validation schemas
const formTemplateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200, 'Name too long'),
  description: z.string().optional(),
  category: z.enum(['pm', 'cm', 'safety', 'custom'], {
    errorMap: (issue, ctx) => ({
      message: 'Category must be one of: pm, cm, safety, custom',
    }),
  }),
  subcategory: z.string().max(50).optional(),
  assetCategoryId: z.string().uuid().optional(),
  requirePhotos: z.boolean().default(false),
  requireGPS: z.boolean().default(true),
  requireSignature: z.boolean().default(false),
  allowOfflineMode: z.boolean().default(true),
  autoAssignToRoleId: z.string().uuid().optional(),
  priorityOverride: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  estimatedDurationMinutes: z.number().int().min(1).default(30),
  tags: z.string().optional(),
  schema: z.object({
    fields: z.array(z.any()),
    settings: z.object({
      sections: z.array(z.any()).optional(),
    }).optional(),
  }),
  status: z.enum(['draft', 'active', 'archived', 'deprecated']).default('draft'),
});

const formTemplateUpdateSchema = formTemplateCreateSchema.partial();

const formTemplateQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive().default(1)),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100).default(20)),
  search: z.string().optional(),
  category: z.enum(['pm', 'cm', 'safety', 'custom']).optional(),
  status: z.enum(['draft', 'active', 'archived', 'deprecated']).optional(),
  assetCategoryId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'category', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeFields: z.string().transform(val => val === 'true').default(false),
  includeInactive: z.string().transform(val => val === 'true').default(false),
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
    const query = formTemplateQuerySchema.parse(Object.fromEntries(searchParams));

    // Build the base query
    let whereConditions = [];

    // Add search conditions
    if (query.search) {
      whereConditions.push(
        or(
          ilike(formTemplates.name, `%${query.search}%`),
          ilike(formTemplates.description, `%${query.search}%`),
          ilike(formTemplates.tags, `%${query.search}%`)
        )
      );
    }

    // Add category filter
    if (query.category) {
      whereConditions.push(eq(formTemplates.category, query.category));
    }

    // Add status filter
    if (query.status) {
      whereConditions.push(eq(formTemplates.status, query.status));
    }

    // Add asset category filter
    if (query.assetCategoryId) {
      whereConditions.push(eq(formTemplates.assetCategoryId, query.assetCategoryId));
    }

    // Add active filter (unless explicitly including inactive)
    if (!query.includeInactive) {
      whereConditions.push(eq(formTemplates.isActive, true));
    }

    // Combine all conditions
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Build the order by clause
    let orderBy;
    const sortColumn = {
      name: formTemplates.name,
      createdAt: formTemplates.createdAt,
      updatedAt: formTemplates.updatedAt,
      category: formTemplates.category,
      status: formTemplates.status,
    }[query.sortBy];

    orderBy = query.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);

    // Execute query with pagination
    const templates = await db
      .select({
        id: formTemplates.id,
        name: formTemplates.name,
        description: formTemplates.description,
        category: formTemplates.category,
        subcategory: formTemplates.subcategory,
        version: formTemplates.version,
        isActiveVersion: formTemplates.isActiveVersion,
        assetCategoryId: formTemplates.assetCategoryId,
        requirePhotos: formTemplates.requirePhotos,
        requireGPS: formTemplates.requireGPS,
        requireSignature: formTemplates.requireSignature,
        allowOfflineMode: formTemplates.allowOfflineMode,
        autoAssignToRoleId: formTemplates.autoAssignToRoleId,
        priorityOverride: formTemplates.priorityOverride,
        estimatedDurationMinutes: formTemplates.estimatedDurationMinutes,
        tags: formTemplates.tags,
        status: formTemplates.status,
        isPublished: formTemplates.isPublished,
        createdBy: formTemplates.createdBy,
        approvedBy: formTemplates.approvedBy,
        approvedAt: formTemplates.approvedAt,
        createdAt: formTemplates.createdAt,
        updatedAt: formTemplates.updatedAt,
        // Include related data
        assetCategory: {
          id: assetCategories.id,
          name: assetCategories.name,
          code: assetCategories.code,
        },
      })
      .from(formTemplates)
      .leftJoin(assetCategories, eq(formTemplates.assetCategoryId, assetCategories.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: formTemplates.id })
      .from(formTemplates)
      .leftJoin(assetCategories, eq(formTemplates.assetCategoryId, assetCategories.id))
      .where(whereClause);

    const totalCount = totalCountResult.length;

    // Fetch fields if requested
    if (query.includeFields && templates.length > 0) {
      const templateIds = templates.map(t => t.id);
      const fields = await db
        .select()
        .from(formFields)
        .where(eq(formFields.templateId, templateIds[0])) // This would need adjustment for multiple templates
        .orderBy(asc(formFields.order));

      // Attach fields to templates (simplified - would need proper mapping for multiple templates)
      if (fields.length > 0) {
        (templates as any)[0].fields = fields;
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / query.limit);
    const hasNextPage = query.page < totalPages;
    const hasPreviousPage = query.page > 1;

    return NextResponse.json({
      data: templates,
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
    console.error('Error fetching form templates:', error);
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
    const validatedData = formTemplateCreateSchema.parse(body);

    // Create the form template
    const [newTemplate] = await db.insert(formTemplates).values({
      ...validatedData,
      schema: JSON.stringify(validatedData.schema),
      version: 1,
      isActiveVersion: true,
      isPublished: false,
      createdBy: session.user.id,
    }).returning();

    // Create fields if provided
    if (validatedData.schema.fields && validatedData.schema.fields.length > 0) {
      const fieldData = validatedData.schema.fields.map((field: any, index: number) => ({
        templateId: newTemplate.id,
        fieldKey: field.id || `field_${index + 1}`,
        label: field.label,
        placeholder: field.placeholder,
        description: field.description,
        fieldType: field.type,
        required: field.required || false,
        readonly: field.readonly || false,
        defaultValue: field.defaultValue,
        width: field.width || 'full',
        section: field.section,
        order: index + 1,
        minLength: field.validation?.minLength,
        maxLength: field.validation?.maxLength,
        min: field.validation?.min,
        max: field.validation?.max,
        pattern: field.validation?.pattern,
        validationMessage: field.validation?.message,
        options: field.options ? JSON.stringify(field.options) : null,
        displayConditions: field.conditional ? JSON.stringify(field.conditional) : null,
      }));

      await db.insert(formFields).values(fieldData);
    }

    return NextResponse.json({
      data: newTemplate,
      success: true,
      message: 'Form template created successfully',
    });
  } catch (error) {
    console.error('Error creating form template:', error);

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