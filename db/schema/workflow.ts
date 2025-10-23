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

// Workflow States Configuration
export const workflowStates = pgTable("workflow_states", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    displayName: text("display_name").notNull(),
    description: text("description"),

    // State Configuration
    category: text("category").notNull(), // pm, cm, both
    order: integer("order").notNull(), // 1=draft, 10=closed

    // State Properties
    isStartState: boolean("is_start_state").notNull().default(false),
    isEndState: boolean("is_end_state").notNull().default(false),
    requiresAction: boolean("requires_action").notNull().default(false),

    // Permissions
    canTransitionFrom: text("can_transition_from").notNull(), // JSON array of state names
    canTransitionTo: text("can_transition_to").notNull(), // JSON array of state names
    allowedRoles: text("allowed_roles").notNull(), // JSON array of role names

    // Business Rules
    allowReopening: boolean("allow_reopening").notNull().default(false),
    requireCompletionData: boolean("require_completion_data").notNull().default(false),
    timeLimitHours: decimal("time_limit_hours", { precision: 8, scale: 2 }),

    // SLA Impact
    isSlaRunning: boolean("is_sla_running").notNull().default(true),
    pauseSla: boolean("pause_sla").notNull().default(false),

    // UI Configuration
    color: varchar("color", { length: 7 }), // Hex color code
    icon: varchar("icon", { length: 50 }), // Icon name

    // Metadata
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    nameIdx: index("idx_workflow_states_name").on(table.name),
    categoryIdx: index("idx_workflow_states_category").on(table.category),
    orderIdx: index("idx_workflow_states_order").on(table.order),
}));

// Workflow Transitions Configuration
export const workflowTransitions = pgTable("workflow_transitions", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    fromState: varchar("from_state", { length: 50 }).notNull(),
    toState: varchar("to_state", { length: 50 }).notNull(),

    // Transition Configuration
    category: text("category").notNull(), // pm, cm, both
    trigger: text("trigger").notNull(), // manual, auto, system, api

    // Conditions (JSON object)
    conditions: text("conditions"), // JSON: {"field": "status", "operator": "equals", "value": "completed"}

    // Actions (JSON object)
    actions: text("actions"), // JSON: [{"type": "send_notification", "config": {...}}, ...]

    // Role Requirements
    allowedRoles: text("allowed_roles"), // JSON array of role names
    requiredRole: varchar("required_role", { length: 50 }), // Minimum role required

    // Validation Rules
    requireComment: boolean("require_comment").notNull().default(false),
    requireAttachments: boolean("require_attachments").notNull().default(false),
    requireApproval: boolean("require_approval").notNull().default(false),

    // Time Constraints
    allowAfterHours: boolean("allow_after_hours").notNull().default(true),
    businessDaysOnly: boolean("business_days_only").notNull().default(false),

    // Metadata
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    fromToIdx: index("idx_workflow_transitions_from_to").on(table.fromState, table.toState),
    categoryIdx: index("idx_workflow_transitions_category").on(table.category),
    triggerIdx: index("idx_workflow_transitions_trigger").on(table.trigger),
}));

// Approval Workflows Configuration
export const approvalWorkflows = pgTable("approval_workflows", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    category: text("category").notNull(), // pm_completion, cm_completion, expense, etc.
    description: text("description"),

    // Workflow Configuration
    isActive: boolean("is_active").notNull().default(true),
    priority: integer("priority").notNull().default(1), // Lower number = higher priority

    // Approval Steps (JSON array of steps)
    steps: text("steps").notNull(), // JSON: [{"step": 1, "role": "supervisor", "required": true, "timeout": 24}, ...]

    // Conditions for triggering
    triggerConditions: text("trigger_conditions"), // JSON: {"priority": "critical", "cost": {"gt": 1000}}

    // Escalation Configuration
    escalationRule: text("escalation_rule"), // JSON: {"timeout": 48, "escalateTo": "manager", "notify": ["admin"]}

    // Notification Configuration
    notificationConfig: text("notification_config"), // JSON: {"channels": ["email", "push"], "template": "approval_required"}

    // Metadata
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    nameIdx: index("idx_approval_workflows_name").on(table.name),
    categoryIdx: index("idx_approval_workflows_category").on(table.category),
    priorityIdx: index("idx_approval_workflows_priority").on(table.priority),
}));

// Approval Requests (actual approval instances)
export const approvalRequests = pgTable("approval_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => approvalWorkflows.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // ticket, expense, etc.
    entityId: uuid("entity_id").notNull(), // Reference to the entity needing approval

    // Request Details
    title: text("title").notNull(),
    description: text("description"),
    requestorId: uuid("requestor_id").notNull(),
    currentStep: integer("current_step").notNull().default(1),

    // Status
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, rejected, expired, cancelled
    finalStatus: varchar("final_status", { length: 20 }), // approved, rejected

    // Timing
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    dueAt: timestamp("due_at"),
    completedAt: timestamp("completed_at"),

    // Data Snapshot (JSON of entity data at time of request)
    requestData: text("request_data").notNull(), // JSON snapshot of entity data

    // Metadata
    metadata: jsonb("metadata"), // Additional data as JSON
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    workflowIdx: index("idx_approval_requests_workflow").on(table.workflowId),
    entityIdx: index("idx_approval_requests_entity").on(table.entityType, table.entityId),
    requestorIdx: index("idx_approval_requests_requestor").on(table.requestorId),
    statusIdx: index("idx_approval_requests_status").on(table.status),
    dueIdx: index("idx_approval_requests_due").on(table.dueAt),
}));

// Approval Steps (individual steps in approval workflow)
export const approvalSteps = pgTable("approval_steps", {
    id: uuid("id").primaryKey().defaultRandom(),
    approvalRequestId: uuid("approval_request_id").notNull().references(() => approvalRequests.id),
    stepNumber: integer("step_number").notNull(),

    // Step Configuration
    name: varchar("name", { length: 100 }).notNull(),
    roleRequired: varchar("role_required", { length: 50 }),
    userId: uuid("user_id"), // Specific user if required

    // Approval Configuration
    approverId: uuid("approver_id"), // Who actually approved/rejected
    isRequired: boolean("is_required").notNull().default(true),
    canSkip: boolean("can_skip").notNull().default(false),

    // Status
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, rejected, skipped, expired

    // Decision Details
    decision: varchar("decision", { length: 20 }), // approve, reject, skip
    comments: text("comments"),

    // Timing
    assignedAt: timestamp("assigned_at"),
    decidedAt: timestamp("decided_at"),
    dueAt: timestamp("due_at"),

    // Approval Data (JSON of relevant data for this step)
    approvalData: text("approval_data"),

    // Metadata
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    requestIdx: index("idx_approval_steps_request").on(table.approvalRequestId),
    stepIdx: index("idx_approval_steps_step").on(table.approvalRequestId, table.stepNumber),
    approverIdx: index("idx_approval_steps_approver").on(table.approverId),
    statusIdx: index("idx_approval_steps_status").on(table.status),
    dueIdx: index("idx_approval_steps_due").on(table.dueAt),
}));

// Rejection and Resubmission Tracking
export const rejectionHistory = pgTable("rejection_history", {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    approvalRequestId: uuid("approval_request_id").references(() => approvalRequests.id),

    // Rejection Details
    rejectionReason: varchar("rejection_reason", { length: 100 }).notNull(), // Predefined reason
    rejectionComments: text("rejection_comments").notNull(),
    rejectedById: uuid("rejected_by_id").notNull(),
    rejectedAt: timestamp("rejected_at").notNull().defaultNow(),

    // Issue Tracking
    issuesIdentified: text("issues_identified"), // JSON array of specific issues
    fieldsRequiringCorrection: text("fields_requiring_correction"), // JSON array of field names

    // Photo/Document Rejection
    rejectedPhotos: text("rejected_photos"), // JSON array of photo URLs that need to be re-uploaded
    rejectedDocuments: text("rejected_documents"), // JSON array of document URLs

    // GPS/Location Issues
    gpsMismatch: boolean("gps_mismatch").notNull().default(false),
    gpsExpectedLat: decimal("gps_expected_lat", { precision: 10, scale: 8 }),
    gpsExpectedLng: decimal("gps_expected_lng", { precision: 11, scale: 8 }),
    gpsActualLat: decimal("gps_actual_lat", { precision: 10, scale: 8 }),
    gpsActualLng: decimal("gps_actual_lng", { precision: 11, scale: 8 }),
    gpsDistanceMeters: decimal("gps_distance_meters", { precision: 8, scale: 2 }),

    // Resolution
    resubmissionId: uuid("resubmission_id"), // Reference to the resubmission record
    resolvedAt: timestamp("resolved_at"),
    resolvedById: uuid("resolved_by_id"),
    resolutionNotes: text("resolution_notes"),

    // Metadata
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    entityIdx: index("idx_rejection_history_entity").on(table.entityType, table.entityId),
    rejectionIdx: index("idx_rejection_history_rejection").on(table.rejectedById, table.rejectedAt),
    resolutionIdx: index("idx_rejection_history_resolution").on(table.resolvedAt),
}));

// Notification Templates
export const notificationTemplates = pgTable("notification_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    category: varchar("category", { length: 50 }).notNull(), // ticket_created, assigned, completed, approval_required, etc.
    description: text("description"),

    // Template Configuration
    isActive: boolean("is_active").notNull().default(true),
    channels: text("channels").notNull(), // JSON: ["email", "push", "sms"]

    // Template Content
    subjectTemplate: text("subject_template"), // For email notifications
    bodyTemplate: text("body_template").notNull(), // Mustache template
    smsTemplate: text("sms_template"), // SMS-specific template

    // Variables and Conditions
    requiredVariables: text("required_variables"), // JSON array of required variables
    conditions: text("conditions"), // JSON conditions for when to send

    // Delivery Configuration
    priority: varchar("priority", { length: 20 }).notNull().default("normal"), // low, normal, high, urgent
    retryAttempts: integer("retry_attempts").notNull().default(3),
    retryDelayMinutes: integer("retry_delay_minutes").notNull().default(5),

    // Scheduling
    sendImmediately: boolean("send_immediately").notNull().default(true),
    scheduleDelayMinutes: integer("schedule_delay_minutes"),
    businessHoursOnly: boolean("business_hours_only").notNull().default(false),

    // Metadata
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    nameIdx: index("idx_notification_templates_name").on(table.name),
    categoryIdx: index("idx_notification_templates_category").on(table.category),
    activeIdx: index("idx_notification_templates_active").on(table.isActive),
}));

// Notification Queue
export const notifications = pgTable("notifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").references(() => notificationTemplates.id),
    recipientId: uuid("recipient_id").notNull(),

    // Notification Content
    subject: text("subject"),
    message: text("message").notNull(),
    channel: varchar("channel", { length: 20 }).notNull(), // email, push, sms

    // Context Data
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    contextData: jsonb("context_data"), // Additional context for templating

    // Status and Delivery
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, sent, delivered, failed, cancelled
    scheduledAt: timestamp("scheduled_at"),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    readAt: timestamp("read_at"),

    // Error Handling
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    nextRetryAt: timestamp("next_retry_at"),

    // Priority and Classification
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    isRead: boolean("is_read").notNull().default(false),

    // Metadata
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    recipientIdx: index("idx_notifications_recipient").on(table.recipientId),
    entityIdx: index("idx_notifications_entity").on(table.entityType, table.entityId),
    statusIdx: index("idx_notifications_status").on(table.status),
    channelIdx: index("idx_notifications_channel").on(table.channel),
    priorityIdx: index("idx_notifications_priority").on(table.priority),
    scheduledIdx: index("idx_notifications_scheduled").on(table.scheduledAt),
    retryIdx: index("idx_notifications_retry").on(table.nextRetryAt),
}));

// Relations
export const workflowStatesRelations = relations(workflowStates, ({ many }) => ({
    transitions: many(workflowTransitions),
}));

export const workflowTransitionsRelations = relations(workflowTransitions, ({ one }) => ({
    fromState: one(workflowStates, {
        fields: [workflowTransitions.fromState],
        references: [workflowStates.name],
    }),
    toState: one(workflowStates, {
        fields: [workflowTransitions.toState],
        references: [workflowStates.name],
    }),
}));

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({ many }) => ({
    requests: many(approvalRequests),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one, many }) => ({
    workflow: one(approvalWorkflows, {
        fields: [approvalRequests.workflowId],
        references: [approvalWorkflows.id],
    }),
    steps: many(approvalSteps),
    rejections: many(rejectionHistory),
}));

export const approvalStepsRelations = relations(approvalSteps, ({ one }) => ({
    approvalRequest: one(approvalRequests, {
        fields: [approvalSteps.approvalRequestId],
        references: [approvalRequests.id],
    }),
}));

export const rejectionHistoryRelations = relations(rejectionHistory, ({ one }) => ({
    approvalRequest: one(approvalRequests, {
        fields: [rejectionHistory.approvalRequestId],
        references: [approvalRequests.id],
    }),
}));

export const notificationTemplatesRelations = relations(notificationTemplates, ({ many }) => ({
    notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    template: one(notificationTemplates, {
        fields: [notifications.templateId],
        references: [notificationTemplates.id],
    }),
}));