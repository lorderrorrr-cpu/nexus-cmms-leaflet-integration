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
    primaryKey
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Master Locations Table - TID based location hierarchy
export const locations = pgTable("locations", {
    id: uuid("id").primaryKey().defaultRandom(),
    tid: varchar("tid", { length: 10 }).notNull().unique(), // TID: Terminal ID (e.g., 160001)
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    province: text("province"),
    postalCode: varchar("postal_code", { length: 10 }),
    country: varchar("country", { length: 50 }).default("Indonesia"),

    // GPS Coordinates
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    gpsAccuracy: decimal("gps_accuracy", { precision: 8, scale: 2 }), // in meters

    // Hierarchical Structure
    region: text("region"), // Regional level
    area: text("area"), // Area level
    siteType: text("site_type"), // Site type classification
    parentLocationId: uuid("parent_location_id").references(() => locations.id),

    // Operational Metadata
    operationalHours: text("operational_hours"), // e.g., "08:00-17:00"
    picName: text("pic_name"), // Person in Charge
    picPhone: varchar("pic_phone", { length: 20 }),
    picEmail: text("pic_email"),
    emergencyContact: text("emergency_contact"),
    emergencyPhone: varchar("emergency_phone", { length: 20 }),

    // Status and Classification
    status: text("status").notNull().default("active"), // active, inactive, under_construction, decommissioned
    locationType: text("location_type").notNull(), // branch, warehouse, datacenter, office, etc.
    serviceLevel: text("service_level").notNull().default("standard"), // standard, premium, enterprise

    // Metadata
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    tidIdx: index("idx_locations_tid").on(table.tid),
    gpsIdx: index("idx_locations_gps").on(table.latitude, table.longitude),
    statusIdx: index("idx_locations_status").on(table.status),
    regionIdx: index("idx_locations_region").on(table.region),
    parentIdx: index("idx_locations_parent").on(table.parentLocationId),
}));

// Asset Categories Table - Hierarchical taxonomy
export const assetCategories = pgTable("asset_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }).notNull().unique(), // e.g., "UPS", "CCTV", "NTW"
    description: text("description"),

    // Hierarchy
    parentCategoryId: uuid("parent_category_id").references(() => assetCategories.id),
    level: integer("level").notNull().default(1), // 1: Main category, 2: Sub-category, 3: Sub-sub-category
    path: text("path").notNull(), // e.g., "Power/UPS/Online"

    // Template and Checklist Binding
    checklistTemplateId: uuid("checklist_template_id"), // Reference to checklist template
    maintenancePlanTemplateId: uuid("maintenance_plan_template_id"),

    // Spare Parts Configuration
    standardSpareParts: text("standard_spare_parts"), // JSON array of standard parts
    consumables: text("consumables"), // JSON array of consumables

    // Technical Specifications
    technicalParameters: text("technical_parameters"), // JSON object of technical specs
    warrantyPeriodMonths: integer("warranty_period_months").default(12),
    expectedLifecycleYears: integer("expected_lifecycle_years").default(5),

    // Status
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    codeIdx: index("idx_asset_categories_code").on(table.code),
    parentIdx: index("idx_asset_categories_parent").on(table.parentCategoryId),
    levelIdx: index("idx_asset_categories_level").on(table.level),
    pathIdx: index("idx_asset_categories_path").on(table.path),
}));

// Master Assets Table - Complete asset lifecycle management
export const assets = pgTable("assets", {
    id: uuid("id").primaryKey().defaultRandom(),
    assetTag: varchar("asset_tag", { length: 50 }).notNull().unique(), // Unique asset identifier
    name: text("name").notNull(),

    // Asset Classification
    categoryId: uuid("category_id").notNull().references(() => assetCategories.id),
    locationId: uuid("location_id").notNull().references(() => locations.id),

    // Brand and Model Information
    brand: text("brand"),
    model: text("model"),
    serialNumber: varchar("serial_number", { length: 100 }),
    partNumber: varchar("part_number", { length: 100 }),
    firmwareVersion: varchar("firmware_version", { length: 50 }),

    // Installation and Warranty Information
    installationDate: timestamp("installation_date"),
    warrantyStartDate: timestamp("warranty_start_date"),
    warrantyEndDate: timestamp("warranty_end_date"),
    supplier: text("supplier"),
    supplierContact: text("supplier_contact"),

    // Technical Specifications
    specifications: text("specifications"), // JSON object of technical specs
    capacity: text("capacity"), // e.g., "2000VA", "16TB", "1Gbps"
    voltage: varchar("voltage", { length: 20 }), // e.g., "220V", "380V"

    // Asset Lifecycle
    purchaseDate: timestamp("purchase_date"),
    purchaseCost: decimal("purchase_cost", { precision: 15, scale: 2 }),
    currentValue: decimal("current_value", { precision: 15, scale: 2 }),
    depreciationRate: decimal("depreciation_rate", { precision: 5, scale: 2 }), // annual percentage

    // Operational Status
    status: text("status").notNull().default("operational"), // operational, down, under_maintenance, retired, decommissioned
    healthScore: integer("health_score").default(100), // 0-100 health score
    lastMaintenanceDate: timestamp("last_maintenance_date"),
    nextMaintenanceDate: timestamp("next_maintenance_date"),

    // Physical Location Details
    room: text("room"), // Specific room or area within location
    rack: text("rack"), // Rack number (if applicable)
    position: text("position"), // Position within rack

    // Criticality and Impact
    criticality: text("criticality").notNull().default("medium"), // critical, high, medium, low
    businessImpact: text("business_impact"), // Description of business impact if failed
    redundancy: text("redundancy"), // none, n+1, 2n, 2n+1

    // Documentation
    manualBookUrl: text("manual_book_url"),
    wiringDiagramUrl: text("wiring_diagram_url"),
    configurationUrl: text("configuration_url"),
    photos: text("photos"), // JSON array of photo URLs

    // Maintenance Contract
    contractProvider: text("contract_provider"),
    contractNumber: varchar("contract_number", { length: 50 }),
    contractStartDate: timestamp("contract_start_date"),
    contractEndDate: timestamp("contract_end_date"),
    contractType: text("contract_type"), // standard, premium, custom

    // Monitoring and Alerting
    monitoringEnabled: boolean("monitoring_enabled").notNull().default(true),
    alertThresholds: text("alert_thresholds"), // JSON object of alert thresholds
    lastHealthCheck: timestamp("last_health_check"),

    // Metadata
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    assetTagIdx: index("idx_assets_asset_tag").on(table.assetTag),
    categoryIdx: index("idx_assets_category").on(table.categoryId),
    locationIdx: index("idx_assets_location").on(table.locationId),
    statusIdx: index("idx_assets_status").on(table.status),
    serialIdx: index("idx_assets_serial").on(table.serialNumber),
    warrantyIdx: index("idx_assets_warranty").on(table.warrantyEndDate),
    maintenanceIdx: index("idx_assets_maintenance").on(table.nextMaintenanceDate),
    criticalityIdx: index("idx_assets_criticality").on(table.criticality),
}));

// Priority Matrix Table - SLA Configuration
export const priorities = pgTable("priorities", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(), // critical, high, medium, low
    level: integer("level").notNull().unique(), // 1=critical, 4=low
    description: text("description"),
    color: varchar("color", { length: 7 }).notNull(), // Hex color code

    // SLA Timeframes (in hours)
    responseTimeHours: decimal("response_time_hours", { precision: 5, scale: 2 }).notNull(),
    resolutionTimeHours: decimal("resolution_time_hours", { precision: 5, scale: 2 }).notNull(),

    // Escalation Configuration
    escalationIntervalHours: decimal("escalation_interval_hours", { precision: 5, scale: 2 }),
    maxEscalationLevel: integer("max_escalation_level").default(3),

    // Notification Configuration
    notificationChannels: text("notification_channels").notNull(), // JSON: ["email", "sms", "push"]
    notificationFrequency: text("notification_frequency"), // real_time, hourly, daily

    // Auto-Assignment Rules
    autoAssignToRole: text("auto_assign_to_role"), // supervisor, senior_technician
    requireManagerApproval: boolean("require_manager_approval").notNull().default(false),

    // Business Hours Configuration
    businessHoursOnly: boolean("business_hours_only").notNull().default(true),
    weekendSupport: boolean("weekend_support").notNull().default(false),

    // Metadata
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    nameIdx: index("idx_priorities_name").on(table.name),
    levelIdx: index("idx_priorities_level").on(table.level),
}));

// User Roles and Permissions
export const roles = pgTable("roles", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull().unique(), // admin, supervisor, technician, viewer
    displayName: text("display_name").notNull(),
    description: text("description"),
    level: integer("level").notNull().unique(), // 1=admin, 4=viewer

    // Permissions (JSON object with boolean flags)
    permissions: text("permissions").notNull(), // JSON: {"canCreateTicket": true, "canApprove": false, ...}

    // Data Access Scope
    dataAccessScope: text("data_access_scope").notNull().default("own"), // all, region, team, own

    // Approval Limits
    canApproveTickets: boolean("can_approve_tickets").notNull().default(false),
    canApproveExpenses: boolean("can_approve_expenses").notNull().default(false),
    maxApprovalAmount: decimal("max_approval_amount", { precision: 15, scale: 2 }),

    // Working Hours
    workingHoursStart: varchar("working_hours_start", { length: 5 }), // e.g., "08:00"
    workingHoursEnd: varchar("working_hours_end", { length: 5 }), // e.g., "17:00"
    workingDays: text("working_days").notNull().default("monday,tuesday,wednesday,thursday,friday"),

    // GPS and Location Tracking
    gpsTrackingRequired: boolean("gps_tracking_required").notNull().default(false),
    maxWorkingRadiusKm: decimal("max_working_radius_km", { precision: 8, scale: 2 }),

    // Metadata
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    nameIdx: index("idx_roles_name").on(table.name),
    levelIdx: index("idx_roles_level").on(table.level),
}));

// Import user from auth schema
import { user as users } from "./auth";

// Relations
export const locationsRelations = relations(locations, ({ one, many }) => ({
    parentLocation: one(locations, {
        fields: [locations.parentLocationId],
        references: [locations.id],
    }),
    childLocations: many(locations),
    assets: many(assets),
}));

export const assetCategoriesRelations = relations(assetCategories, ({ one, many }) => ({
    parentCategory: one(assetCategories, {
        fields: [assetCategories.parentCategoryId],
        references: [assetCategories.id],
    }),
    childCategories: many(assetCategories),
    assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
    category: one(assetCategories, {
        fields: [assets.categoryId],
        references: [assetCategories.id],
    }),
    location: one(locations, {
        fields: [assets.locationId],
        references: [locations.id],
    }),
    createdByUser: one(users, {
        fields: [assets.createdBy],
        references: [users.id],
    }),
    updatedByUser: one(users, {
        fields: [assets.updatedBy],
        references: [users.id],
    }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
    users: many(users),
}));