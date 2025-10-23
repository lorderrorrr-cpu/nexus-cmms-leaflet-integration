// Main schema export file for Nexus CMMS
export * from "./auth";
export * from "./master-data";
export * from "./ticketing";
export * from "./workflow";
export * from "./forms";

// Import all schemas for type checking and relations
import { user, session, account, verification } from "./auth";
import { locations, assets, assetCategories, priorities, roles } from "./master-data";
import { tickets, pmSchedules, pmTemplates, ticketStatusHistory, ticketAttachments, ticketComments } from "./ticketing";
import { workflowStates, workflowTransitions, approvalWorkflows, approvalRequests, approvalSteps, rejectionHistory, notificationTemplates, notifications } from "./workflow";
import { formTemplates, formFields, formSubmissions, formAttachments, formTemplateCategories, formTemplateHistory, formFieldValues } from "./forms";

// Schema exports for Drizzle
export const schema = {
    // Auth schemas
    user,
    session,
    account,
    verification,

    // Master data schemas
    locations,
    assets,
    assetCategories,
    priorities,
    roles,

    // Ticketing schemas
    tickets,
    pmSchedules,
    pmTemplates,
    ticketStatusHistory,
    ticketAttachments,
    ticketComments,

    // Workflow schemas
    workflowStates,
    workflowTransitions,
    approvalWorkflows,
    approvalRequests,
    approvalSteps,
    rejectionHistory,
    notificationTemplates,
    notifications,

    // Forms schemas
    formTemplates,
    formFields,
    formSubmissions,
    formAttachments,
    formTemplateCategories,
    formTemplateHistory,
    formFieldValues,
};

// Export types for TypeScript usage
export type AuthSchema = typeof schema.user | typeof schema.session | typeof schema.account | typeof schema.verification;
export type MasterDataSchema = typeof schema.locations | typeof schema.assets | typeof schema.assetCategories | typeof schema.priorities | typeof schema.roles;
export type TicketingSchema = typeof schema.tickets | typeof schema.pmSchedules | typeof schema.pmTemplates | typeof schema.ticketStatusHistory | typeof schema.ticketAttachments | typeof schema.ticketComments;
export type WorkflowSchema = typeof schema.workflowStates | typeof schema.workflowTransitions | typeof schema.approvalWorkflows | typeof schema.approvalRequests | typeof schema.approvalSteps | typeof schema.rejectionHistory | typeof schema.notificationTemplates | typeof schema.notifications;
export type FormsSchema = typeof schema.formTemplates | typeof schema.formFields | typeof schema.formSubmissions | typeof schema.formAttachments | typeof schema.formTemplateCategories | typeof schema.formTemplateHistory | typeof schema.formFieldValues;

// All tables enum for reference
export const ALL_TABLES = [
    // Auth
    'user', 'session', 'account', 'verification',

    // Master Data
    'locations', 'assets', 'assetCategories', 'priorities', 'roles',

    // Ticketing
    'tickets', 'pmSchedules', 'pmTemplates', 'ticketStatusHistory', 'ticketAttachments', 'ticketComments',

    // Workflow
    'workflowStates', 'workflowTransitions', 'approvalWorkflows', 'approvalRequests', 'approvalSteps', 'rejectionHistory', 'notificationTemplates', 'notifications',

    // Forms
    'formTemplates', 'formFields', 'formSubmissions', 'formAttachments', 'formTemplateCategories', 'formTemplateHistory', 'formFieldValues',
] as const;

export type TableName = typeof ALL_TABLES[number];