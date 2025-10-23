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
    primaryKey,
    jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Import user from auth schema for relations
import { user } from "./auth";
import { assetCategories } from "./master-data";
import { tickets } from "./ticketing";

// Form Templates Table - Master template for dynamic forms
export const formTemplates = pgTable("form_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    // Template Classification
    category: varchar("category", { length: 50 }).notNull(), // pm, cm, safety, custom
    subcategory: varchar("subcategory", { length: 50 }), // ups_maintenance, network_check, etc.

    // Version Control
    version: integer("version").notNull().default(1),
    parentTemplateId: uuid("parent_template_id"), // For versioning and cloning
    isActiveVersion: boolean("is_active_version").notNull().default(true),

    // Asset Type Binding
    assetCategoryId: uuid("asset_category_id").references(() => assetCategories.id),

    // Form Schema Definition
    schema: jsonb("schema").notNull(), // JSON schema defining form structure
    validationRules: jsonb("validation_rules"), // Advanced validation rules
    conditionalLogic: jsonb("conditional_logic"), // Conditional logic rules

    // Template Settings
    requirePhotos: boolean("require_photos").notNull().default(false),
    requireGPS: boolean("require_gps").notNull().default(true),
    requireSignature: boolean("require_signature").notNull().default(false),
    allowOfflineMode: boolean("allow_offline_mode").notNull().default(true),

    // Auto-assignment Rules
    autoAssignToRoleId: uuid("auto_assign_to_role_id"),
    priorityOverride: varchar("priority_override", { length: 20 }), // critical, high, medium, low

    // Metadata
    tags: text("tags"), // Comma-separated tags for searchability
    estimatedDurationMinutes: integer("estimated_duration_minutes").default(30),

    // Audit and Control
    createdBy: uuid("created_by").notNull().references(() => user.id),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at"),

    // Status
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, active, archived, deprecated

    // Metadata
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    nameIdx: index("idx_form_templates_name").on(table.name),
    categoryIdx: index("idx_form_templates_category").on(table.category),
    assetCategoryIdx: index("idx_form_templates_asset_category").on(table.assetCategoryId),
    versionIdx: index("idx_form_templates_version").on(table.parentTemplateId, table.version),
    statusIdx: index("idx_form_templates_status").on(table.status),
    createdByIdx: index("idx_form_templates_created_by").on(table.createdBy),
}));

// Form Fields Table - Individual field definitions
export const formFields = pgTable("form_fields", {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => formTemplates.id),

    // Field Identification
    fieldKey: varchar("field_key", { length: 100 }).notNull(), // Unique key within template
    label: text("label").notNull(),
    placeholder: text("placeholder"),
    description: text("description"),

    // Field Configuration
    fieldType: varchar("field_type", { length: 50 }).notNull(), // text, number, radio, checkbox, select, photo, signature, gps, date, time, file, rating

    // Field Properties
    required: boolean("required").notNull().default(false),
    readonly: boolean("readonly").notNull().default(false),
    defaultValue: text("default_value"),

    // Validation Rules
    minLength: integer("min_length"),
    maxLength: integer("max_length"),
    min: decimal("min"),
    max: decimal("max"),
    pattern: text("pattern"), // Regex pattern for validation
    validationMessage: text("validation_message"),

    // Field Options (for select, radio, checkbox)
    options: jsonb("options"), // JSON array of options: [{label: "Option 1", value: "opt1"}, ...]

    // Conditional Display
    displayConditions: jsonb("display_conditions"), // JSON rules for when to show/hide this field

    // Layout and Position
    order: integer("order").notNull(),
    width: varchar("width", { length: 20 }).default("full"), // full, half, third, quarter
    section: varchar("section", { length: 100 }), // Group fields into sections

    // Advanced Configuration
    unit: varchar("unit", { length: 20 }), // Unit for numeric fields (e.g., "V", "%", "°C")
    precision: integer("precision").default(2), // Decimal places for numeric fields

    // Media Configuration
    maxFileSize: integer("max_file_size"), // In MB
    allowedFileTypes: text("allowed_file_types"), // Comma-separated MIME types
    multipleFiles: boolean("multiple_files").notNull().default(false),

    // GPS Configuration
    gpsRadiusMeters: integer("gps_radius_meters"), // For GPS verification

    // Rating Configuration
    ratingScale: integer("rating_scale").default(5), // 5-star or 10-star rating

    // Metadata
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    templateIdx: index("idx_form_fields_template").on(table.templateId),
    fieldKeyIdx: index("idx_form_fields_field_key").on(table.templateId, table.fieldKey),
    orderIdx: index("idx_form_fields_order").on(table.templateId, table.order),
    typeIdx: index("idx_form_fields_type").on(table.fieldType),
}));

// Form Submissions Table - Submitted form data
export const formSubmissions = pgTable("form_submissions", {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => formTemplates.id),
    ticketId: uuid("ticket_id").references(() => tickets.id), // Link to related ticket (if any)

    // Submission Metadata
    submissionReference: varchar("submission_reference", { length: 50 }).notNull().unique(), // Auto-generated unique reference

    // Form Data
    formData: jsonb("form_data").notNull(), // Complete form data as JSON object
    fieldValues: jsonb("field_values").notNull(), // Individual field values for easy querying

    // Location and Time Information
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    gpsAccuracy: decimal("gps_accuracy", { precision: 8, scale: 2 }),

    // Submission Context
    durationMinutes: integer("duration_minutes"), // Time spent filling the form
    deviceInfo: jsonb("device_info"), // Device and browser information
    appVersion: varchar("app_version", { length: 20 }),

    // Submission Status
    status: varchar("status", { length: 20 }).notNull().default("submitted"), // submitted, pending_review, approved, rejected

    // Quality Metrics
    completionPercentage: integer("completion_percentage").notNull().default(100), // Percentage of required fields completed
    photoCount: integer("photo_count").default(0),
    attachmentCount: integer("attachment_count").default(0),

    // Offline Sync Information
    isOfflineSubmission: boolean("is_offline_submission").notNull().default(false),
    syncedAt: timestamp("synced_at"),

    // People
    submittedBy: uuid("submitted_by").notNull().references(() => user.id),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at"),

    // Review Information
    reviewNotes: text("review_notes"),
    rejectionReason: text("rejection_reason"),

    // Metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    templateIdx: index("idx_form_submissions_template").on(table.templateId),
    ticketIdx: index("idx_form_submissions_ticket").on(table.ticketId),
    referenceIdx: index("idx_form_submissions_reference").on(table.submissionReference),
    submittedByIdx: index("idx_form_submissions_submitted_by").on(table.submittedBy),
    statusIdx: index("idx_form_submissions_status").on(table.status),
    submittedAtIdx: index("idx_form_submissions_submitted_at").on(table.submittedAt),
    gpsIdx: index("idx_form_submissions_gps").on(table.latitude, table.longitude),
}));

// Form Attachments Table - Files uploaded through forms
export const formAttachments = pgTable("form_attachments", {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id").notNull().references(() => formSubmissions.id),
    fieldKey: varchar("field_key", { length: 100 }).notNull(), // Which field this attachment belongs to

    // File Information
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    storedFileName: varchar("stored_file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(), // In bytes
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileHash: varchar("file_hash", { length: 64 }), // SHA-256 hash for integrity

    // File Properties
    width: integer("width"), // Image width in pixels
    height: integer("height"), // Image height in pixels
    duration: integer("duration"), // Video/audio duration in seconds

    // Metadata
    caption: text("caption"), // User-provided caption
    tags: text("tags"), // Comma-separated tags
    isPrimary: boolean("is_primary").notNull().default(false), // For multi-photo fields

    // Location Information (for photos with EXIF GPS data)
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    takenAt: timestamp("taken_at"), // EXIF creation date

    // Processed Information
    thumbnailPath: varchar("thumbnail_path", { length: 500 }), // Path to generated thumbnail
    processedAt: timestamp("processed_at"),

    // Metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    submissionIdx: index("idx_form_attachments_submission").on(table.submissionId),
    fieldKeyIdx: index("idx_form_attachments_field_key").on(table.fieldKey),
    mimeTypeIdx: index("idx_form_attachments_mime_type").on(table.mimeType),
    fileHashIdx: index("idx_form_attachments_file_hash").on(table.fileHash),
    gpsIdx: index("idx_form_attachments_gps").on(table.latitude, table.longitude),
}));

// Form Template Categories Table - Categorize form templates
export const formTemplateCategories = pgTable("form_template_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 50 }), // Icon name or emoji
    color: varchar("color", { length: 7 }), // Hex color code
    order: integer("order").notNull().default(0),
    parentCategoryId: uuid("parent_category_id").references(() => formTemplateCategories.id),

    // Category Configuration
    defaultTemplate: boolean("default_template").notNull().default(false),
    requireApproval: boolean("require_approval").notNull().default(false),
    allowCustomFields: boolean("allow_custom_fields").notNull().default(true),

    // Metadata
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    nameIdx: index("idx_form_template_categories_name").on(table.name),
    parentIdx: index("idx_form_template_categories_parent").on(table.parentCategoryId),
    orderIdx: index("idx_form_template_categories_order").on(table.order),
}));

// Form Version History Table - Track template changes
export const formTemplateHistory = pgTable("form_template_history", {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => formTemplates.id),
    version: integer("version").notNull(),

    // Change Information
    changeType: varchar("change_type", { length: 20 }).notNull(), // created, updated, field_added, field_removed, field_modified
    changeDescription: text("change_description"),

    // State Snapshots
    previousSchema: jsonb("previous_schema"),
    newSchema: jsonb("new_schema"),
    changedFields: jsonb("changed_fields"), // Array of field keys that changed

    // Metadata
    changedBy: uuid("changed_by").notNull().references(() => user.id),
    changeReason: text("change_reason"),

    // System Information
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    templateIdx: index("idx_form_template_history_template").on(table.templateId),
    versionIdx: index("idx_form_template_history_version").on(table.templateId, table.version),
    changedByIdx: index("idx_form_template_history_changed_by").on(table.changedBy),
    changeTypeIdx: index("idx_form_template_history_change_type").on(table.changeType),
    createdAtIdx: index("idx_form_template_history_created_at").on(table.createdAt),
}));

// Form Field Values Table - Denormalized field values for easy querying
export const formFieldValues = pgTable("form_field_values", {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id").notNull().references(() => formSubmissions.id),
    templateId: uuid("template_id").notNull().references(() => formTemplates.id),

    // Field Information
    fieldKey: varchar("field_key", { length: 100 }).notNull(),
    fieldType: varchar("field_type", { length: 50 }).notNull(),

    // Value Storage (multiple types for efficient querying)
    textValue: text("text_value"),
    numberValue: decimal("number_value", { precision: 15, scale: 6 }),
    booleanValue: boolean("boolean_value"),
    dateValue: timestamp("date_value"),
    jsonValue: jsonb("json_value"), // For complex data like arrays or objects

    // Location Information (for GPS fields)
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    gpsAccuracy: decimal("gps_accuracy", { precision: 8, scale: 2 }),

    // Validation Information
    isValid: boolean("is_valid").notNull().default(true),
    validationErrors: text("validation_errors"),

    // Metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    submissionIdx: index("idx_form_field_values_submission").on(table.submissionId),
    templateIdx: index("idx_form_field_values_template").on(table.templateId),
    fieldKeyIdx: index("idx_form_field_values_field_key").on(table.fieldKey),
    fieldTypeIdx: index("idx_form_field_values_type").on(table.fieldType),
    textValueIdx: index("idx_form_field_values_text").on(table.textValue),
    numberValueIdx: index("idx_form_field_values_number").on(table.numberValue),
    gpsIdx: index("idx_form_field_values_gps").on(table.latitude, table.longitude),
}));

// Relations
export const formTemplatesRelations = relations(formTemplates, ({ one, many }) => ({
    parentTemplate: one(formTemplates, {
        fields: [formTemplates.parentTemplateId],
        references: [formTemplates.id],
    }),
    childTemplates: many(formTemplates),
    assetCategory: one(assetCategories, {
        fields: [formTemplates.assetCategoryId],
        references: [assetCategories.id],
    }),
    fields: many(formFields),
    submissions: many(formSubmissions),
    history: many(formTemplateHistory),
    createdByUser: one(user, {
        fields: [formTemplates.createdBy],
        references: [user.id],
    }),
    approvedByUser: one(user, {
        fields: [formTemplates.approvedBy],
        references: [user.id],
    }),
}));

export const formFieldsRelations = relations(formFields, ({ one, many }) => ({
    template: one(formTemplates, {
        fields: [formFields.templateId],
        references: [formTemplates.id],
    }),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one, many }) => ({
    template: one(formTemplates, {
        fields: [formSubmissions.templateId],
        references: [formTemplates.id],
    }),
    ticket: one(tickets, {
        fields: [formSubmissions.ticketId],
        references: [tickets.id],
    }),
    submittedByUser: one(user, {
        fields: [formSubmissions.submittedBy],
        references: [user.id],
    }),
    reviewedByUser: one(user, {
        fields: [formSubmissions.reviewedBy],
        references: [user.id],
    }),
    attachments: many(formAttachments),
    fieldValues: many(formFieldValues),
}));

export const formAttachmentsRelations = relations(formAttachments, ({ one }) => ({
    submission: one(formSubmissions, {
        fields: [formAttachments.submissionId],
        references: [formSubmissions.id],
    }),
}));

export const formTemplateCategoriesRelations = relations(formTemplateCategories, ({ one, many }) => ({
    parentCategory: one(formTemplateCategories, {
        fields: [formTemplateCategories.parentCategoryId],
        references: [formTemplateCategories.id],
    }),
    childCategories: many(formTemplateCategories),
}));

export const formTemplateHistoryRelations = relations(formTemplateHistory, ({ one }) => ({
    template: one(formTemplates, {
        fields: [formTemplateHistory.templateId],
        references: [formTemplates.id],
    }),
    changedByUser: one(user, {
        fields: [formTemplateHistory.changedBy],
        references: [user.id],
    }),
}));

export const formFieldValuesRelations = relations(formFieldValues, ({ one }) => ({
    submission: one(formSubmissions, {
        fields: [formFieldValues.submissionId],
        references: [formSubmissions.id],
    }),
    template: one(formTemplates, {
        fields: [formFieldValues.templateId],
        references: [formTemplates.id],
    }),
}));