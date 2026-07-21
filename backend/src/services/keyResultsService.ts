import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { buildAuthSession } from './authSessionService.js';

interface FirebaseDateLike {
  seconds?: number;
  toMillis?: () => number;
}

interface OrganizationRecord {
  keyResults?: Partial<CompanyKeyResultsConfig>;
  status?: string;
  tenantId?: string;
}

interface TenantContext {
  permissions: string[];
  role: string;
  tenantId: string;
  uid: string;
}

export interface KeyResultUnit {
  icon: string;
  label: string;
  sortOrder: number;
  status: string;
  suffix: string;
  unitId: string;
}

export interface KeyResultMetric {
  key: string;
  metricId: string;
  sortOrder: number;
  status: string;
  unitId: string;
  value: string;
}

export interface KeyResultGroup {
  groupId: string;
  metrics: KeyResultMetric[];
  name: string;
  sortOrder: number;
  status: string;
}

export interface CompanyKeyResultsConfig {
  groups: KeyResultGroup[];
  units: KeyResultUnit[];
  updatedAt: string | null;
  updatedByUid: string | null;
}

export interface KeyResultMetricInput {
  key?: string;
  metricId?: string;
  sortOrder?: number;
  status?: string;
  unitId?: string;
  value?: string;
}

export interface KeyResultGroupInput {
  groupId?: string;
  metrics?: KeyResultMetricInput[];
  name?: string;
  sortOrder?: number;
  status?: string;
}

export interface CompanyKeyResultsInput {
  groups?: KeyResultGroupInput[];
  units?: Array<Partial<KeyResultUnit>>;
}

const defaultUnits: KeyResultUnit[] = [
  { icon: 'hash', label: 'Number', sortOrder: 1000, status: 'ACTIVE', suffix: '', unitId: 'unit_number' },
  { icon: 'bar-chart-2', label: 'Million', sortOrder: 2000, status: 'ACTIVE', suffix: 'Million', unitId: 'unit_million' },
  { icon: 'calendar', label: 'Per Month', sortOrder: 3000, status: 'ACTIVE', suffix: '/Month', unitId: 'unit_per_month' },
  { icon: 'clock', label: 'Per Day', sortOrder: 4000, status: 'ACTIVE', suffix: '/Day', unitId: 'unit_per_day' },
  { icon: 'calendar', label: 'Per Year', sortOrder: 5000, status: 'ACTIVE', suffix: '/Year', unitId: 'unit_per_year' }
];

export async function getCompanyKeyResultsForAdmin(
  decodedToken: DecodedIdToken
): Promise<CompanyKeyResultsConfig> {
  const context = await requireCompanyAdmin(decodedToken);

  return getCompanyKeyResultsForTenant(context.tenantId);
}

export async function getCompanyKeyResultsForCurrentUser(
  decodedToken: DecodedIdToken
): Promise<CompanyKeyResultsConfig> {
  const context = await requireActiveTenantUser(decodedToken);

  return getCompanyKeyResultsForTenant(context.tenantId);
}

export async function updateCompanyKeyResults(
  decodedToken: DecodedIdToken,
  input: CompanyKeyResultsInput
): Promise<CompanyKeyResultsConfig> {
  const context = await requireCompanyAdmin(decodedToken);
  const normalizedConfig = normalizeKeyResultsConfig(input);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const snapshot = await organizationRef.get();

  if (!snapshot.exists) {
    throw notFoundError('Company key results were not found.');
  }

  const organization = snapshot.data() as OrganizationRecord;

  if (organization.status !== 'ACTIVE') {
    throw authorizationError('Your company profile is not active.');
  }

  await organizationRef.set({
    keyResults: {
      groups: normalizedConfig.groups,
      units: normalizedConfig.units,
      updatedAt: fieldValue.serverTimestamp(),
      updatedByUid: context.uid
    },
    updatedAt: fieldValue.serverTimestamp(),
    updatedBy: context.uid
  }, { merge: true });

  const refreshedSnapshot = await organizationRef.get();

  if (!refreshedSnapshot.exists) {
    throw notFoundError('Company key results were not found.');
  }

  return mapCompanyKeyResults(refreshedSnapshot.data() as OrganizationRecord);
}

async function getCompanyKeyResultsForTenant(tenantId: string): Promise<CompanyKeyResultsConfig> {
  const snapshot = await firestore.collection('organizations').doc(tenantId).get();

  if (!snapshot.exists) {
    throw notFoundError('Company key results were not found.');
  }

  const organization = snapshot.data() as OrganizationRecord;

  if (organization.status !== 'ACTIVE') {
    throw authorizationError('Your company profile is not active.');
  }

  return mapCompanyKeyResults(organization);
}

function mapCompanyKeyResults(record: OrganizationRecord): CompanyKeyResultsConfig {
  const keyResults = record.keyResults || {};
  const units = Array.isArray(keyResults.units) ? keyResults.units : undefined;
  const normalized = normalizeKeyResultsConfig({
    groups: keyResults.groups || [],
    units
  });

  return {
    ...normalized,
    updatedAt: dateLikeToIso(keyResults.updatedAt as FirebaseDateLike | undefined),
    updatedByUid: typeof keyResults.updatedByUid === 'string' ? keyResults.updatedByUid : null
  };
}

function normalizeKeyResultsConfig(input: CompanyKeyResultsInput): CompanyKeyResultsConfig {
  const normalizedUnits = normalizeKeyResultUnits(input.units);
  const unitIds = new Set(normalizedUnits.map((unit) => unit.unitId));
  const fallbackUnitId = normalizedUnits[0]?.unitId || 'unit_number';
  const normalizedGroups = (input.groups || [])
    .filter((group) => (group.status || 'ACTIVE') === 'ACTIVE')
    .map((group, index) => normalizeKeyResultGroup(group, index, unitIds, fallbackUnitId))
    .filter((group) => group.name || group.metrics.length > 0)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name));

  return {
    groups: normalizedGroups,
    units: normalizedUnits,
    updatedAt: null,
    updatedByUid: null
  };
}

function normalizeKeyResultUnits(units: Array<Partial<KeyResultUnit>> | undefined): KeyResultUnit[] {
  if (!units) {
    return defaultUnits;
  }

  const normalized = (units || [])
    .filter((unit) => (unit.status || 'ACTIVE') === 'ACTIVE')
    .map((unit, index) => ({
      icon: getLimitedString(unit.icon, 48) || 'hash',
      label: getLimitedString(unit.label, 80) || 'Number',
      sortOrder: normalizeSortOrder(unit.sortOrder, (index + 1) * 1000),
      status: 'ACTIVE',
      suffix: getLimitedString(unit.suffix, 32),
      unitId: getRecordId(unit.unitId, `unit_${index + 1}`)
    }))
    .sort((first, second) => first.sortOrder - second.sortOrder || first.label.localeCompare(second.label));

  return normalized;
}

function normalizeKeyResultGroup(
  group: KeyResultGroupInput,
  index: number,
  unitIds: Set<string>,
  fallbackUnitId: string
): KeyResultGroup {
  return {
    groupId: getRecordId(group.groupId, `group_${index + 1}`),
    metrics: normalizeKeyResultMetrics(group.metrics, unitIds, fallbackUnitId),
    name: getLimitedString(group.name, 120),
    sortOrder: normalizeSortOrder(group.sortOrder, (index + 1) * 1000),
    status: 'ACTIVE'
  };
}

function normalizeKeyResultMetrics(
  metrics: KeyResultMetricInput[] | undefined,
  unitIds: Set<string>,
  fallbackUnitId: string
): KeyResultMetric[] {
  return (metrics || [])
    .filter((metric) => (metric.status || 'ACTIVE') === 'ACTIVE')
    .map((metric, index) => {
      const unitId = getRecordId(metric.unitId, fallbackUnitId);

      return {
        key: getLimitedString(metric.key, 160),
        metricId: getRecordId(metric.metricId, `metric_${index + 1}`),
        sortOrder: normalizeSortOrder(metric.sortOrder, (index + 1) * 1000),
        status: 'ACTIVE',
        unitId: unitIds.has(unitId) ? unitId : fallbackUnitId,
        value: getLimitedString(metric.value, 80)
      };
    })
    .filter((metric) => metric.key || metric.value)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.key.localeCompare(second.key));
}

async function requireCompanyAdmin(decodedToken: DecodedIdToken): Promise<TenantContext> {
  const context = await requireActiveTenantUser(decodedToken);

  if (context.role !== 'ORG_ADMIN' || !context.permissions.includes('tenant.update')) {
    throw authorizationError('You do not have permission to manage company key results.');
  }

  return context;
}

async function requireActiveTenantUser(decodedToken: DecodedIdToken): Promise<TenantContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your session is not active.');
  }

  return {
    permissions,
    role: role || '',
    tenantId,
    uid: decodedToken.uid
  };
}

function getRecordId(value: string | undefined, fallback: string): string {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';

  if (/^[A-Za-z0-9_-]{4,128}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
}

function getLimitedString(value: string | undefined, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeSortOrder(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1_000_000_000, Math.round(value)))
    : fallback;
}

function dateLikeToIso(dateLike?: FirebaseDateLike): string | null {
  const milliseconds = dateLike?.toMillis?.() || ((dateLike?.seconds || 0) * 1000);

  return milliseconds ? new Date(milliseconds).toISOString() : null;
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}
