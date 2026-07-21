import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const railsService = readFileSync(resolve(backendRoot, 'src', 'services', 'railsService.ts'), 'utf8');
const railsRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'railsRoutes.ts'), 'utf8');
const notificationService = readFileSync(resolve(backendRoot, 'src', 'services', 'notificationService.ts'), 'utf8');
const webRoot = resolve(backendRoot, '..', 'web');
const railsApi = readFileSync(resolve(webRoot, 'src', 'railsApi.ts'), 'utf8');
const railsWorkspace = readFileSync(resolve(webRoot, 'src', 'RailsWorkspace.tsx'), 'utf8');

describe('RAILS enterprise readiness foundation', () => {
  it('persists structured tenant and loop-scoped audit events', () => {
    assert.match(railsService, /const RAILS_AUDIT_EVENTS_COLLECTION = 'railsAuditEvents'/);
    assert.match(railsService, /const RAILS_ITEM_ACTIVITY_COLLECTION = 'activity'/);
    assert.match(railsService, /function writeRailsAuditEvent/);
    assert.match(railsService, /export async function listRailsItemActivity/);
    assert.match(railsService, /context\.organizationRef\.collection\(RAILS_AUDIT_EVENTS_COLLECTION\)/);
    assert.match(railsService, /itemRef\.collection\(RAILS_ITEM_ACTIVITY_COLLECTION\)/);
    assert.match(railsRoutes, /railsRouter\.get\('\/items\/:itemId\/activity'/);
  });

  it('writes audit events for each current RAILS mutation service', () => {
    [
      'RAILS_CREATED',
      'RAILS_UPDATED',
      'RAILS_STATUS_CHANGED',
      'RAILS_STANDARDIZATION_UPDATED',
      'RAILS_STANDARDIZATION_VERIFIED',
      'RAILS_ARCHIVED',
      'RAILS_CANCELLED',
      'RAILS_REOPENED',
      'RAILS_COLLABORATOR_ADDED',
      'RAILS_COLLABORATOR_REMOVED',
      'RAILS_ACTION_ADDED',
      'RAILS_ACTION_UPDATED',
      'RAILS_EVIDENCE_ADDED',
      'RAILS_EVIDENCE_UPDATED',
      'RAILS_COMMENT_ADDED'
    ].forEach((eventType) => {
      assert.match(railsService, new RegExp(`'${eventType}'`), `${eventType} is not represented in the RAILS audit model.`);
    });

    assert.ok((railsService.match(/writeRailsAuditEvent\(\{/g) || []).length >= 7, 'Expected RAILS mutations to write audit events.');
  });

  it('keeps controlled reopen reason available to the backend patch validator', () => {
    assert.match(railsRoutes, /const railsItemPatchSchema = z\.object\(\{[\s\S]*reopenReason: z\.string\(\)\.trim\(\)\.max\(500\)\.optional\(\)/);
  });

  it('enforces backend approval eligibility for enterprise approvals', () => {
    assert.match(railsService, /function isRailsHighRisk/);
    assert.match(railsService, /async function assertRailsApproverEligible/);
    assert.match(railsService, /accountable owner cannot approve their own RAILS loop/);
    assert.match(railsService, /High-risk RAILS loops require an Org Admin, Department Admin, or System Admin approver/);
    assert.match(railsService, /Department Admin approvers can only approve high-risk loops in their own department/);
    assert.match(railsService, /patch\.status === 'Approved'[\s\S]*await assertRailsApproverEligible/);
  });

  it('exposes secured enterprise report, history, and export APIs', () => {
    assert.match(railsService, /export async function getRailsReport/);
    assert.match(railsService, /export async function listRailsHistory/);
    assert.match(railsService, /export async function exportRailsHistoryCsv/);
    assert.match(railsService, /export async function exportRailsHistoryJson/);
    assert.match(railsService, /function matchesRailsHistoryQuery/);
    assert.match(railsService, /function buildRailsCsv/);
    assert.match(railsService, /'RAILS_EXPORT_CREATED'/);
    assert.match(railsService, /writeRailsTenantAuditEvent\(\{[\s\S]*type: 'RAILS_EXPORT_CREATED'/);
    assert.match(railsRoutes, /railsRouter\.get\('\/report'/);
    assert.match(railsRoutes, /railsRouter\.get\('\/history'/);
    assert.match(railsRoutes, /railsRouter\.get\('\/export'/);
    assert.match(railsRoutes, /railsRouter\.get\('\/export\/json'/);
  });

  it('wires manager report, history search, and CSV export into the frontend', () => {
    assert.match(railsApi, /export async function getRailsReport/);
    assert.match(railsApi, /export async function getRailsHistory/);
    assert.match(railsApi, /export async function exportRailsCsv/);
    assert.match(railsApi, /export async function exportRailsJson/);
    assert.match(railsWorkspace, /type RailsWorkspaceView = 'board' \| 'report' \| 'history'/);
    assert.match(railsWorkspace, /setWorkspaceView\(view\)/);
    assert.match(railsWorkspace, /Enterprise Report/);
    assert.match(railsWorkspace, /History and Archive/);
    assert.match(railsWorkspace, /handleExportHistory/);
  });

  it('sources the visible loop log from immutable audit activity events', () => {
    assert.match(railsApi, /export async function getRailsItemActivity/);
    assert.match(railsWorkspace, /const \[activeActivity, setActiveActivity\]/);
    assert.match(railsWorkspace, /loadRailsActivity\(activeItemId\)/);
    assert.match(railsWorkspace, /activeActivity\.length \? activeActivity\.map/);
    assert.match(railsWorkspace, /formatAuditEventType\(event\.type\)/);
  });

  it('keeps standardization proof versioned and downloadable', () => {
    assert.match(railsService, /standardizationDocumentVersions/);
    assert.match(railsService, /function buildStandardizationDocumentVersion/);
    assert.match(railsService, /export async function getRailsStandardizationDocumentVersionFile/);
    assert.match(railsRoutes, /standardization-documents\/:versionId/);
    assert.match(railsApi, /interface RailsStandardizationDocumentVersion/);
    assert.match(railsWorkspace, /Document versions/);
    assert.match(railsWorkspace, /handleOpenStandardizationVersion/);
  });

  it('supports audited bulk manager workflows and centralized notification hooks', () => {
    assert.match(railsService, /export async function bulkUpdateRailsItems/);
    assert.match(railsService, /collaboratorUid/);
    assert.match(railsService, /'RAILS_BULK_ACTION_COMPLETED'/);
    assert.match(railsService, /function queueRailsWorkflowNotifications/);
    assert.match(railsService, /async function recordRailsEscalations/);
    assert.match(railsService, /'RAILS_ESCALATED'/);
    assert.match(railsService, /'RAILS_OVERDUE_ESCALATED'/);
    assert.match(railsService, /const RAILS_NOTIFICATIONS_COLLECTION = 'railsNotificationQueue'/);
    assert.match(railsService, /async function queueRailsNotification/);
    assert.match(railsService, /sendRailsPushNotification/);
    assert.match(notificationService, /export async function sendRailsPushNotification/);
    assert.match(notificationService, /channel: 'rails'/);
    assert.match(notificationService, /rails-updates/);
    assert.match(railsRoutes, /railsRouter\.post\('\/items\/bulk-update'/);
    assert.match(railsApi, /export async function bulkUpdateRailsItems/);
    assert.match(railsWorkspace, /Apply bulk update/);
    assert.match(railsWorkspace, /Bulk category/);
    assert.match(railsWorkspace, /Bulk collaborator/);
    assert.match(railsWorkspace, /Archive reason/);
  });
});
