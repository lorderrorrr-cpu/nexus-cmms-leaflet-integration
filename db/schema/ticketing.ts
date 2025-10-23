import {
    pgTable,
    text,
    integer,
    decimal,
    timestamp,
    boolean,
    varchar,
    uuid,
    index,
    jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Tickets Table - Main ticketing entity for both PM and CM
export const tickets = pgTable("tickets", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: varchar("ticket_number", { length: 20 }).notNull().unique(),

    // Basic Information
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 20 }).notNull(), // pm, cm

    // Priority and Classification
    priorityId: uuid("priority_id").notNull(),
    priorityLevel: integer("priority_level").notNull(), // Denormalized for performance
    severity: varchar("severity", { length: 20 }), // low, medium, high, critical

    // Location and Asset Information
    locationId: uuid("location_id").notNull(),
    assetId: uuid("asset_id"), // Can be null for location-based issues

    // Requester Information
    requesterId: uuid("requester_id").notNull(),
    requesterName: text("requester_name").notNull(),
    requesterPhone: varchar("requester_phone", { length: 20 }),
    requesterEmail: text("requester_email"),

    // Assignment Information
    assignedToId: uuid("assigned_to_id"),
    assignedToName: text("assigned_to_name"),
    assignedAt: timestamp("assigned_at"),
    acknowledgedAt: timestamp("acknowledged_at"),

    // Status Management
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    previousStatus: varchar("previous_status", { length: 20 }),
    statusChangedAt: timestamp("status_changed_at"),
    statusChangedById: uuid("status_changed_by_id"),

    // SLA Tracking
    slaStatus: varchar("sla_status", { length: 20 }).notNull().default("on_time"), // on_time, at_risk, breached
    slaResponseTime: timestamp("sla_response_time"),
    slaResolutionTime: timestamp("sla_resolution_time"),
    actualResponseTime: timestamp("actual_response_time"),
    actualResolutionTime: timestamp("actual_resolution_time"),
    responseTimeMinutes: integer("response_time_minutes"),
    resolutionTimeMinutes: integer("resolution_time_minutes"),

    // Workflow and Approval
    workflowState: varchar("workflow_state", { length: 50 }).notNull().default("draft"),
    currentApprovalId: uuid("current_approval_id"),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    approvalStatus: varchar("approval_status", { length: 20 }), // pending, approved, rejected

    // PM Specific Fields
    pmScheduleId: uuid("pm_schedule_id"), // Reference to maintenance schedule
    pmTemplateId: uuid("pm_template_id"), // Reference to PM template
    pmDueDate: timestamp("pm_due_date"),
    pmCompletedDate: timestamp("pm_completed_date"),
    pmChecklistResults: text("pm_checklist_results"), // JSON of checklist responses

    // CM Specific Fields
    cmIncidentType: varchar("cm_incident_type", { length: 50 }), // hardware_failure, software_issue, network_problem, power_issue
    cmImpactAssessment: text("cm_impact_assessment"),
    cmRootCause: text("cm_root_cause"),
    cmResolutionSteps: text("cm_resolution_steps"), // JSON array of steps taken
    cmAffectedServices: text("cm_affected_services"), // JSON array of affected services
    cmBusinessImpact: varchar("cm_business_impact", { length: 20 }), // low, medium, high, critical

    // Timing Information
    reportedAt: timestamp("reported_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    closedAt: timestamp("closed_at"),
    onSiteAt: timestamp("on_site_at"),
    offSiteAt: timestamp("off_site_at"),

    // Duration Tracking (in minutes)
    travelTimeMinutes: integer("travel_time_minutes"),
    onSiteTimeMinutes: integer("on_site_time_minutes"),
    totalDowntimeMinutes: integer("total_downtime_minutes"),

    // Location Verification
    workLocationLat: decimal("work_location_lat", { precision: 10, scale: 8 }),
    workLocationLng: decimal("work_location_lng", { precision: 11, scale: 8 }),
    workLocationAccuracy: decimal("work_location_accuracy", { precision: 8, scale: 2 }), // GPS accuracy in meters
    locationVerified: boolean("location_verified").notNull().default(false),
    locationVerificationMethod: varchar("location_verification_method", { length: 20 }), // gps, manual, admin_override

    // Media and Documentation
    beforePhotos: text("before_photos"), // JSON array of photo URLs
    afterPhotos: text("after_photos"), // JSON array of photo URLs
    additionalPhotos: text("additional_photos"), // JSON array of additional photo URLs
    videos: text("videos"), // JSON array of video URLs
    documents: text("documents"), // JSON array of document URLs

    // Spare Parts (for CM)
    sparePartsUsed: text("spare_parts_used"), // JSON array of parts used
    sparePartsCost: decimal("spare_parts_cost", { precision: 15, scale: 2 }),
    partsRemoved: text("parts_removed"), // JSON array of parts that were replaced

    // Cost Information
    laborCost: decimal("labor_cost", { precision: 15, scale: 2 }),
    materialCost: decimal("material_cost", { precision: 15, scale: 2 }),
    totalCost: decimal("total_cost", { precision: 15, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("IDR"),

    // Customer/Client Information
    customerSatisfaction: integer("customer_satisfaction"), // 1-5 rating
    customerFeedback: text("customer_feedback"),
    customerSignature: text("customer_signature"), // Base64 encoded signature
    customerSignedAt: timestamp("customer_signed_at"),

    // Technician Information
    technicianNotes: text("technician_notes"),
    technicianSignature: text("technician_signature"), // Base64 encoded signature
    technicianSignedAt: timestamp("technician_signed_at"),
    technicianFindings: text("technician_findings"),
    technicianRecommendations: text("technician_recommendations"),

    // Jobcard Generation
    jobcardGenerated: boolean("jobcard_generated").notNull().default(false),
    jobcardGeneratedAt: timestamp("jobcard_generated_at"),
    jobcardUrl: text("jobcard_url"),
    jobcardNumber: varchar("jobcard_number", { length: 20 }),

    // Quality Control
    qualityScore: integer("quality_score"), // 0-100
    qualityCheckPassed: boolean("quality_check_passed"),
    qualityCheckedBy: uuid("quality_checked_by"),
    qualityCheckedAt: timestamp("quality_checked_at"),
    qualityNotes: text("quality_notes"),

    // Rejection and Resubmission
    rejectionCount: integer("rejection_count").notNull().default(0),
    lastRejectionAt: timestamp("last_rejection_at"),
    lastRejectionReason: text("last_rejection_reason"),

    // Metadata
    tags: text("tags"), // JSON array of tags
    metadata: jsonb("metadata"), // Additional flexible data
    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    ticketNumberIdx: index("idx_tickets_ticket_number").on(table.ticketNumber),
    categoryIdx: index("idx_tickets_category").on(table.category),
    statusIdx: index("idx_tickets_status").on(table.status),
    priorityIdx: index("idx_tickets_priority").on(table.priorityLevel),
    locationIdx: index("idx_tickets_location").on(table.locationId),
    assetIdx: index("idx_tickets_asset").on(table.assetId),
    requesterIdx: index("idx_tickets_requester").on(table.requesterId),
    assignedToIdx: index("idx_tickets_assigned_to").on(table.assignedToId),
    slaStatusIdx: index("idx_tickets_sla_status").on(table.slaStatus),
    workflowStateIdx: index("idx_tickets_workflow_state").on(table.workflowState),
    reportedIdx: index("idx_tickets_reported_at").on(table.reportedAt),
    completedIdx: index("idx_tickets_completed_at").on(table.completedAt),
    pmScheduleIdx: index("idx_tickets_pm_schedule").on(table.pmScheduleId),
    approvalIdx: index("idx_tickets_approval").on(table.currentApprovalId),
    jobcardIdx: index("idx_tickets_jobcard").on(table.jobcardGenerated),
}));

// PM Schedule Table - Preventive Maintenance scheduling
export const pmSchedules = pgTable("pm_schedules", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    // Schedule Configuration
    templateId: uuid("template_id").notNull(),
    locationId: uuid("location_id").notNull(),
    assetId: uuid("asset_id"), // Null for location-based PM

    // Timing Configuration
    recurrencePattern: varchar("recurrence_pattern", { length: 20 }).notNull(), // daily, weekly, monthly, quarterly, yearly
    recurrenceInterval: integer("recurrence_interval").notNull().default(1), // Every X days/weeks/months
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"), // Null for ongoing schedules

    // Schedule Timing
    preferredTime: varchar("preferred_time", { length: 5 }), // HH:MM format
    preferredDays: text("preferred_days"), // JSON array: ["monday", "wednesday", "friday"]
    businessDaysOnly: boolean("business_days_only").notNull().default(true),

    // Assignment Configuration
    preferredTechnicianId: uuid("preferred_technician_id"),
    requiredSkills: text("required_skills"), // JSON array of required skills
    estimatedDurationMinutes: integer("estimated_duration_minutes"),

    // Generation Settings
    autoGenerateDays: integer("auto_generate_days").notNull().default(30), // Generate tickets X days in advance
    generateOnWeekends: boolean("generate_on_weekends").notNull().default(false),
    skipOnHolidays: boolean("skip_on_holidays").notNull().default(true),

    // Status
    isActive: boolean("is_active").notNull().default(true),
    pausedUntil: timestamp("paused_until"),

    // Metadata
    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    templateIdx: index("idx_pm_schedules_template").on(table.templateId),
    locationIdx: index("idx_pm_schedules_location").on(table.locationId),
    assetIdx: index("idx_pm_schedules_asset").on(table.assetId),
    nextRunIdx: index("idx_pm_schedules_next_run").on(table.startDate),
    activeIdx: index("idx_pm_schedules_active").on(table.isActive),
}));

// PM Templates Table - Template for PM tasks
export const pmTemplates = pgTable("pm_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    categoryId: uuid("category_id").notNull(),

    // Template Configuration
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),

    // Checklist Configuration
    checklistItems: text("checklist_items").notNull(), // JSON array of checklist items
    requiredPhotos: text("required_photos"), // JSON array of required photo points
    mandatoryItems: text("mandatory_items"), // JSON array of mandatory checklist item IDs

    // Safety and Tools
    safetyRequirements: text("safety_requirements"), // JSON array of safety requirements
    requiredTools: text("required_tools"), // JSON array of required tools
    requiredMaterials: text("required_materials"), // JSON array of required materials

    // Acceptance Criteria
    acceptanceCriteria: text("acceptance_criteria"), // JSON array of acceptance criteria
    completionChecklist: text("completion_checklist"), // JSON array of completion checks

    // Standard Operating Procedures
    procedures: text("procedures"), // JSON array of step-by-step procedures
    troubleshootingGuide: text("troubleshooting_guide"), // JSON array of common issues and solutions

    // Metadata
    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    nameIdx: index("idx_pm_templates_name").on(table.name),
    categoryIdx: index("idx_pm_templates_category").on(table.categoryId),
    activeIdx: index("idx_pm_templates_active").on(table.isActive),
    versionIdx: index("idx_pm_templates_version").on(table.version),
}));

// Ticket Status History
export const ticketStatusHistory = pgTable("ticket_status_history", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").notNull(),

    // Status Change Details
    fromStatus: varchar("from_status", { length: 20 }),
    toStatus: varchar("to_status", { length: 20 }).notNull(),
    reason: text("reason"),

    // Change Information
    changedById: uuid("changed_by_id").notNull(),
    changedByName: text("changed_by_name").notNull(),
    changedAt: timestamp("changed_at").notNull().defaultNow(),

    // Additional Context
    comments: text("comments"),
    attachments: text("attachments"), // JSON array of attachment URLs

    // System Information
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    // Metadata
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    ticketIdx: index("idx_ticket_status_history_ticket").on(table.ticketId),
    statusIdx: index("idx_ticket_status_history_status").on(table.toStatus),
    changedByIdx: index("idx_ticket_status_history_changed_by").on(table.changedById),
    changedAtIdx: index("idx_ticket_status_history_changed_at").on(table.changedAt),
}));

// Ticket Attachments
export const ticketAttachments = pgTable("ticket_attachments", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").notNull(),

    // File Information
    fileName: varchar("file_name", { length: 255 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(), // in bytes
    mimeType: varchar("mime_type", { length: 100 }).notNull(),

    // File Classification
    category: varchar("category", { length: 50 }).notNull(), // before_photo, after_photo, document, video, etc.
    description: text("description"),
    tags: text("tags"), // JSON array of tags

    // File Location
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileUrl: text("file_url").notNull(),
    thumbnailUrl: text("thumbnail_url"), // For images and videos

    // GPS Information (for photos/videos)
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    accuracy: decimal("accuracy", { precision: 8, scale: 2 }), // GPS accuracy in meters
    takenAt: timestamp("taken_at"), // When the photo/video was actually taken

    // Upload Information
    uploadedById: uuid("uploaded_by_id").notNull(),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    ipAddress: varchar("ip_address", { length: 45 }),

    // Processing Status
    processingStatus: varchar("processing_status", { length: 20 }).notNull().default("completed"), // pending, processing, completed, failed
    processingError: text("processing_error"),

    // Metadata
    metadata: jsonb("metadata"), // EXIF data, video duration, etc.
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    ticketIdx: index("idx_ticket_attachments_ticket").on(table.ticketId),
    categoryIdx: index("idx_ticket_attachments_category").on(table.category),
    uploadedByIdx: index("idx_ticket_attachments_uploaded_by").on(table.uploadedById),
    uploadedAtIdx: index("idx_ticket_attachments_uploaded_at").on(table.uploadedAt),
    fileNameIdx: index("idx_ticket_attachments_file_name").on(table.fileName),
}));

// Ticket Comments/Notes
export const ticketComments = pgTable("ticket_comments", {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").notNull(),

    // Comment Content
    content: text("content").notNull(),
    commentType: varchar("comment_type", { length: 20 }).notNull().default("comment"), // comment, note, system_update

    // Author Information
    authorId: uuid("author_id").notNull(),
    authorName: text("author_name").notNull(),
    authorRole: varchar("author_role", { length: 50 }),

    // Comment Properties
    isInternal: boolean("is_internal").notNull().default(false), // Internal notes vs customer-visible
    isTechnicianNote: boolean("is_technician_note").notNull().default(false),
    isSystemGenerated: boolean("is_system_generated").notNull().default(false),

    // Visibility
    visibleToCustomer: boolean("visible_to_customer").notNull().default(true),
    visibleToTechnicians: boolean("visible_to_technicians").notNull().default(true),

    // Attachments
    attachments: text("attachments"), // JSON array of attachment URLs

    // Mentions and Notifications
    mentionedUsers: text("mentioned_users"), // JSON array of mentioned user IDs
    sendNotifications: boolean("send_notifications").notNull().default(true),

    // Metadata
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    editedAt: timestamp("edited_at"),
    editedById: uuid("edited_by_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    ticketIdx: index("idx_ticket_comments_ticket").on(table.ticketId),
    authorIdx: index("idx_ticket_comments_author").on(table.authorId),
    createdAtIdx: index("idx_ticket_comments_created_at").on(table.createdAt),
    typeIdx: index("idx_ticket_comments_type").on(table.commentType),
    internalIdx: index("idx_ticket_comments_internal").on(table.isInternal),
}));

// Relations
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
    priority: one(priorities, {
        fields: [tickets.priorityId],
        references: [priorities.id],
    }),
    location: one(locations, {
        fields: [tickets.locationId],
        references: [locations.id],
    }),
    asset: one(assets, {
        fields: [tickets.assetId],
        references: [assets.id],
    }),
    requester: one(users, {
        fields: [tickets.requesterId],
        references: [users.id],
    }),
    assignedTo: one(users, {
        fields: [tickets.assignedToId],
        references: [users.id],
    }),
    pmSchedule: one(pmSchedules, {
        fields: [tickets.pmScheduleId],
        references: [pmSchedules.id],
    }),
    pmTemplate: one(pmTemplates, {
        fields: [tickets.pmTemplateId],
        references: [pmTemplates.id],
    }),
    statusHistory: many(ticketStatusHistory),
    attachments: many(ticketAttachments),
    comments: many(ticketComments),
}));

export const pmSchedulesRelations = relations(pmSchedules, ({ one, many }) => ({
    template: one(pmTemplates, {
        fields: [pmSchedules.templateId],
        references: [pmTemplates.id],
    }),
    location: one(locations, {
        fields: [pmSchedules.locationId],
        references: [locations.id],
    }),
    asset: one(assets, {
        fields: [pmSchedules.assetId],
        references: [assets.id],
    }),
    tickets: many(tickets),
}));

export const pmTemplatesRelations = relations(pmTemplates, ({ one, many }) => ({
    category: one(assetCategories, {
        fields: [pmTemplates.categoryId],
        references: [assetCategories.id],
    }),
    schedules: many(pmSchedules),
    tickets: many(tickets),
}));

export const ticketStatusHistoryRelations = relations(ticketStatusHistory, ({ one }) => ({
    ticket: one(tickets, {
        fields: [ticketStatusHistory.ticketId],
        references: [tickets.id],
    }),
}));

export const ticketAttachmentsRelations = relations(ticketAttachments, ({ one }) => ({
    ticket: one(tickets, {
        fields: [ticketAttachments.ticketId],
        references: [tickets.id],
    }),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
    ticket: one(tickets, {
        fields: [ticketComments.ticketId],
        references: [tickets.id],
    }),
}));

// Import references from other schemas
import { locations, assets, assetCategories, priorities } from "./master-data";
import { user as users } from "./auth";