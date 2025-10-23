import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  formTemplates,
  formFields,
  formTemplateHistory,
  formSubmissions,
  users
} from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const templateId = params.id;

    // Get template with fields and related data
    const [template] = await db
      .select({
        id: formTemplates.id,
        name: formTemplates.name,
        description: formTemplates.description,
        category: formTemplates.category,
        subcategory: formTemplates.subcategory,
        version: formTemplates.version,
        parentTemplateId: formTemplates.parentTemplateId,
        isActiveVersion: formTemplates.isActiveVersion,
        assetCategoryId: formTemplates.assetCategoryId,
        schema: formTemplates.schema,
        validationRules: formTemplates.validationRules,
        conditionalLogic: formTemplates.conditionalLogic,
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
        createdByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        approvedByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(formTemplates)
      .leftJoin(users, eq(formTemplates.createdBy, users.id))
      .leftJoin(users.as('approver'), eq(formTemplates.approvedBy, approver.id))
      .where(eq(formTemplates.id, templateId));

    if (!template) {
      return NextResponse.json(
        { error: 'Form template not found', success: false },
        { status: 404 }
      );
    }

    // Get fields for this template
    const fields = await db
      .select()
      .from(formFields)
      .where(eq(formFields.templateId, templateId))
      .orderBy(asc(formFields.order));

    // Get recent submissions count
    const [submissionStats] = await db
      .select({
        totalSubmissions: { count: formSubmissions.id },
        recentSubmissions: { count: formSubmissions.id },
      })
      .from(formSubmissions)
      .where(eq(formSubmissions.templateId, templateId));

    // Get version history
    const versionHistory = await db
      .select({
        id: formTemplateHistory.id,
        version: formTemplateHistory.version,
        changeType: formTemplateHistory.changeType,
        changeDescription: formTemplateHistory.changeDescription,
        changedBy: formTemplateHistory.changedBy,
        createdAt: formTemplateHistory.createdAt,
      })
      .from(formTemplateHistory)
      .where(eq(formTemplateHistory.templateId, templateId))
      .orderBy(desc(formTemplateHistory.createdAt))
      .limit(10);

    // Parse JSON fields
    const templateWithParsedData = {
      ...template,
      schema: JSON.parse(template.schema || '{}'),
      fields: fields.map(field => ({
        ...field,
        options: field.options ? JSON.parse(field.options) : null,
        validation: {
          minLength: field.minLength,
          maxLength: field.maxLength,
          min: field.min,
          max: field.max,
          pattern: field.pattern,
          message: field.validationMessage,
        },
        conditional: field.displayConditions ? JSON.parse(field.displayConditions) : null,
      })),
      stats: {
        totalSubmissions: submissionStats?.totalSubmissions || 0,
        recentSubmissions: submissionStats?.recentSubmissions || 0,
      },
      versionHistory,
    };

    return NextResponse.json({
      data: templateWithParsedData,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching form template:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const templateId = params.id;
    const body = await request.json();

    // Check if template exists
    const [existingTemplate] = await db
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.id, templateId));

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Form template not found', success: false },
        { status: 404 }
      );
    }

    // Validate the request body (simplified validation)
    const updateData = {
      name: body.name,
      description: body.description,
      category: body.category,
      subcategory: body.subcategory,
      assetCategoryId: body.assetCategoryId,
      requirePhotos: body.requirePhotos,
      requireGPS: body.requireGPS,
      requireSignature: body.requireSignature,
      allowOfflineMode: body.allowOfflineMode,
      autoAssignToRoleId: body.autoAssignToRoleId,
      priorityOverride: body.priorityOverride,
      estimatedDurationMinutes: body.estimatedDurationMinutes,
      tags: body.tags,
      status: body.status,
      isPublished: body.isPublished,
      schema: JSON.stringify(body.schema),
      validationRules: JSON.stringify(body.validationRules || {}),
      conditionalLogic: JSON.stringify(body.conditionalLogic || {}),
      updatedAt: new Date(),
    };

    // Update the template
    const [updatedTemplate] = await db
      .update(formTemplates)
      .set(updateData)
      .where(eq(formTemplates.id, templateId))
      .returning();

    // Update fields if provided
    if (body.schema?.fields) {
      // Delete existing fields
      await db.delete(formFields).where(eq(formFields.templateId, templateId));

      // Insert new fields
      if (body.schema.fields.length > 0) {
        const fieldData = body.schema.fields.map((field: any, index: number) => ({
          templateId,
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
    }

    // Record in history if there are changes
    if (body.changeDescription || body.changeType) {
      await db.insert(formTemplateHistory).values({
        templateId,
        version: existingTemplate.version + 1,
        changeType: body.changeType || 'updated',
        changeDescription: body.changeDescription || 'Template updated',
        previousSchema: JSON.stringify(existingTemplate),
        newSchema: JSON.stringify(body.schema || {}),
        changedBy: session.user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });
    }

    return NextResponse.json({
      data: updatedTemplate,
      success: true,
      message: 'Form template updated successfully',
    });
  } catch (error) {
    console.error('Error updating form template:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const templateId = params.id;

    // Check if template exists
    const [existingTemplate] = await db
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.id, templateId));

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Form template not found', success: false },
        { status: 404 }
      );
    }

    // Check if template has any submissions
    const [submissionCount] = await db
      .select({ count: formSubmissions.id })
      .from(formSubmissions)
      .where(eq(formSubmissions.templateId, templateId));

    if (submissionCount.count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete template with existing submissions. Consider archiving instead.',
          success: false,
        },
        { status: 400 }
      );
    }

    // Delete related fields first
    await db.delete(formFields).where(eq(formFields.templateId, templateId));

    // Delete the template
    await db.delete(formTemplates).where(eq(formTemplates.id, templateId));

    return NextResponse.json({
      success: true,
      message: 'Form template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting form template:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}