import type { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import {
  AiUsageFeatureId,
  AiUsageSummary,
  getAiFeatureLabel,
  getAiUsageContext,
  getTenantAiUsageBreakdowns,
  getTenantAiUsageSummary,
  listTenantAiUsageEvents,
  writeAiUsageEvent
} from './aiUsageLedgerService.js';
import { buildAuthSession } from './authSessionService.js';

export interface TenantAiFeaturePolicy {
  enabled: boolean;
  featureId: AiUsageFeatureId;
  hardLimitEnabled: boolean;
  monthlyBudgetUsd: number | null;
  updatedAtIso: string | null;
  updatedByUid: string | null;
}

export interface TenantAiScopePolicy {
  enabled: boolean;
  hardLimitEnabled: boolean;
  monthlyBudgetUsd: number | null;
  updatedAtIso: string | null;
  updatedByUid: string | null;
}

export interface TenantAiPolicy {
  companyAiEnabled: boolean;
  createdAtIso: string;
  departmentPolicies: Record<string, TenantAiScopePolicy>;
  disabledReason: string | null;
  employeePolicies: Record<string, TenantAiScopePolicy>;
  featurePolicies: Record<string, TenantAiFeaturePolicy>;
  hardLimitEnabled: boolean;
  monthlyBudgetUsd: number | null;
  softWarningPercent: number;
  tenantId: string;
  updatedAtIso: string;
  updatedByUid: string | null;
}

export interface TenantAiUsageDashboard {
  breakdowns: Awaited<ReturnType<typeof getTenantAiUsageBreakdowns>>;
  policy: TenantAiPolicy;
  summary: AiUsageSummary;
}

export interface TenantAiAllowedInput {
  departmentId?: string | null;
  employeeUid?: string | null;
  featureId: AiUsageFeatureId;
  operationId: string;
  operationLabel: string;
  resourceId?: string | null;
  resourceType?: string | null;
}

const AI_FEATURE_IDS: AiUsageFeatureId[] = [
  'interpreter_realtime',
  'interpreter_summary',
  'interpreter_spoken_summary',
  'interpreter_transcript_audio',
  'interpreter_segment_translation',
  'interpreter_voice_preview',
  'chat_translation',
  'rails_ai',
  'rca_ai',
  'lsw_ai'
];

export async function getTenantAiPolicy(decodedToken: DecodedIdToken): Promise<TenantAiPolicy> {
  const context = await getAiUsageContext(decodedToken);
  return getOrCreateTenantAiPolicy(context.tenantId, context.actorUid);
}

export async function getTenantAiUsageDashboard(input: {
  decodedToken: DecodedIdToken;
  month?: string;
}): Promise<TenantAiUsageDashboard> {
  const context = await getAiUsageContext(input.decodedToken);
  const policy = await getOrCreateTenantAiPolicy(context.tenantId, context.actorUid);
  const [summary, breakdowns] = await Promise.all([
    getTenantAiUsageSummary({
      month: input.month,
      policy,
      tenantId: context.tenantId
    }),
    getTenantAiUsageBreakdowns({
      month: input.month,
      tenantId: context.tenantId
    })
  ]);

  return { breakdowns, policy, summary };
}

export async function updateTenantCompanyAiPolicy(input: {
  decodedToken: DecodedIdToken;
  enabled: boolean;
  reason?: string | null;
}): Promise<TenantAiPolicy> {
  const context = await getAiUsageContext(input.decodedToken);
  const policy = await getOrCreateTenantAiPolicy(context.tenantId, context.actorUid);
  const nowIso = new Date().toISOString();
  const nextPolicy: TenantAiPolicy = {
    ...policy,
    companyAiEnabled: input.enabled,
    disabledReason: input.enabled ? null : input.reason?.trim() || 'Disabled by organization admin',
    updatedAtIso: nowIso,
    updatedByUid: context.actorUid
  };

  await saveTenantAiPolicy(nextPolicy);
  return nextPolicy;
}

export async function updateTenantAiBudgetPolicy(input: {
  decodedToken: DecodedIdToken;
  hardLimitEnabled: boolean;
  monthlyBudgetUsd: number | null;
  softWarningPercent: number;
}): Promise<TenantAiPolicy> {
  const context = await getAiUsageContext(input.decodedToken);
  const policy = await getOrCreateTenantAiPolicy(context.tenantId, context.actorUid);
  const nowIso = new Date().toISOString();
  const nextPolicy: TenantAiPolicy = {
    ...policy,
    hardLimitEnabled: input.hardLimitEnabled,
    monthlyBudgetUsd: input.monthlyBudgetUsd === null ? null : Math.max(0, input.monthlyBudgetUsd),
    softWarningPercent: Math.min(100, Math.max(50, Math.round(input.softWarningPercent))),
    updatedAtIso: nowIso,
    updatedByUid: context.actorUid
  };

  await saveTenantAiPolicy(nextPolicy);
  return nextPolicy;
}

export async function updateTenantAiFeaturePolicy(input: {
  decodedToken: DecodedIdToken;
  enabled: boolean;
  featureId: AiUsageFeatureId;
  hardLimitEnabled?: boolean;
  monthlyBudgetUsd?: number | null;
}): Promise<TenantAiPolicy> {
  const context = await getAiUsageContext(input.decodedToken);
  const policy = await getOrCreateTenantAiPolicy(context.tenantId, context.actorUid);
  const nowIso = new Date().toISOString();
  const existing = policy.featurePolicies[input.featureId] || defaultFeaturePolicy(input.featureId);
  const nextPolicy: TenantAiPolicy = {
    ...policy,
    featurePolicies: {
      ...policy.featurePolicies,
      [input.featureId]: {
        ...existing,
        enabled: input.enabled,
        hardLimitEnabled: input.hardLimitEnabled ?? existing.hardLimitEnabled,
        monthlyBudgetUsd: input.monthlyBudgetUsd === undefined ? existing.monthlyBudgetUsd : input.monthlyBudgetUsd,
        updatedAtIso: nowIso,
        updatedByUid: context.actorUid
      }
    },
    updatedAtIso: nowIso,
    updatedByUid: context.actorUid
  };

  await saveTenantAiPolicy(nextPolicy);
  return nextPolicy;
}

export async function updateTenantAiDepartmentPolicy(input: {
  decodedToken: DecodedIdToken;
  departmentId: string;
  enabled: boolean;
  hardLimitEnabled?: boolean;
  monthlyBudgetUsd?: number | null;
}): Promise<TenantAiPolicy> {
  const context = await getAiUsageContext(input.decodedToken);
  const policy = await getOrCreateTenantAiPolicy(context.tenantId, context.actorUid);
  const nowIso = new Date().toISOString();
  const existing = policy.departmentPolicies[input.departmentId] || defaultScopePolicy();
  const nextPolicy: TenantAiPolicy = {
    ...policy,
    departmentPolicies: {
      ...policy.departmentPolicies,
      [input.departmentId]: {
        ...existing,
        enabled: input.enabled,
        hardLimitEnabled: input.hardLimitEnabled ?? existing.hardLimitEnabled,
        monthlyBudgetUsd: input.monthlyBudgetUsd === undefined ? existing.monthlyBudgetUsd : input.monthlyBudgetUsd,
        updatedAtIso: nowIso,
        updatedByUid: context.actorUid
      }
    },
    updatedAtIso: nowIso,
    updatedByUid: context.actorUid
  };

  await saveTenantAiPolicy(nextPolicy);
  return nextPolicy;
}

export async function updateTenantAiEmployeePolicy(input: {
  decodedToken: DecodedIdToken;
  employeeUid: string;
  enabled: boolean;
  hardLimitEnabled?: boolean;
  monthlyBudgetUsd?: number | null;
}): Promise<TenantAiPolicy> {
  const context = await getAiUsageContext(input.decodedToken);
  const policy = await getOrCreateTenantAiPolicy(context.tenantId, context.actorUid);
  const nowIso = new Date().toISOString();
  const existing = policy.employeePolicies[input.employeeUid] || defaultScopePolicy();
  const nextPolicy: TenantAiPolicy = {
    ...policy,
    employeePolicies: {
      ...policy.employeePolicies,
      [input.employeeUid]: {
        ...existing,
        enabled: input.enabled,
        hardLimitEnabled: input.hardLimitEnabled ?? existing.hardLimitEnabled,
        monthlyBudgetUsd: input.monthlyBudgetUsd === undefined ? existing.monthlyBudgetUsd : input.monthlyBudgetUsd,
        updatedAtIso: nowIso,
        updatedByUid: context.actorUid
      }
    },
    updatedAtIso: nowIso,
    updatedByUid: context.actorUid
  };

  await saveTenantAiPolicy(nextPolicy);
  return nextPolicy;
}

export async function assertTenantAiAllowed(
  decodedToken: DecodedIdToken,
  input: TenantAiAllowedInput
): Promise<void> {
  const context = await getAiUsageContext(decodedToken, { requireAdmin: false });
  const session = await buildAuthSession(decodedToken);
  const policy = await getOrCreateTenantAiPolicy(context.tenantId, context.actorUid);
  const departmentId = input.departmentId ?? context.actorDepartmentId ?? null;
  const employeeUid = input.employeeUid ?? context.actorUid;
  const featurePolicy = policy.featurePolicies[input.featureId] || defaultFeaturePolicy(input.featureId);
  const departmentPolicy = departmentId ? policy.departmentPolicies[departmentId] : null;
  const employeePolicy = employeeUid ? policy.employeePolicies[employeeUid] : null;
  const usageSummary = await getTenantAiUsageSummary({
    policy,
    tenantId: context.tenantId
  });
  const needsScopeUsage =
    (featurePolicy.hardLimitEnabled && featurePolicy.monthlyBudgetUsd !== null) ||
    (departmentPolicy?.hardLimitEnabled && departmentPolicy.monthlyBudgetUsd !== null) ||
    (employeePolicy?.hardLimitEnabled && employeePolicy.monthlyBudgetUsd !== null);
  const scopeUsage = needsScopeUsage
    ? await getCurrentMonthScopeUsage(context.tenantId, {
        departmentId,
        employeeUid,
        featureId: input.featureId
      })
    : { departmentCostUsd: 0, employeeCostUsd: 0, featureCostUsd: 0 };
  const denial = !policy.companyAiEnabled
    ? { category: 'tenant_ai_disabled' as const, message: buildTenantAiDeniedMessage(session.user.role, context.actorDisplayName) }
    : !featurePolicy.enabled
      ? { category: 'feature_ai_disabled' as const, message: buildTenantAiDeniedMessage(session.user.role, context.actorDisplayName) }
      : departmentPolicy && departmentPolicy.enabled === false
        ? { category: 'department_ai_disabled' as const, message: buildTenantAiDeniedMessage(session.user.role, context.actorDisplayName) }
        : employeePolicy && employeePolicy.enabled === false
          ? { category: 'employee_ai_disabled' as const, message: buildTenantAiDeniedMessage(session.user.role, context.actorDisplayName) }
          : policy.hardLimitEnabled && policy.monthlyBudgetUsd !== null && usageSummary.totals.estimatedCostUsd >= policy.monthlyBudgetUsd
            ? { category: 'tenant_budget_reached' as const, message: buildTenantAiCreditMessage(session.user.role, context.actorDisplayName) }
            : featurePolicy.hardLimitEnabled && featurePolicy.monthlyBudgetUsd !== null && scopeUsage.featureCostUsd >= featurePolicy.monthlyBudgetUsd
              ? { category: 'tenant_budget_reached' as const, message: buildTenantAiCreditMessage(session.user.role, context.actorDisplayName) }
              : departmentPolicy?.hardLimitEnabled && departmentPolicy.monthlyBudgetUsd !== null && scopeUsage.departmentCostUsd >= departmentPolicy.monthlyBudgetUsd
                ? { category: 'tenant_budget_reached' as const, message: buildTenantAiCreditMessage(session.user.role, context.actorDisplayName) }
                : employeePolicy?.hardLimitEnabled && employeePolicy.monthlyBudgetUsd !== null && scopeUsage.employeeCostUsd >= employeePolicy.monthlyBudgetUsd
                  ? { category: 'tenant_budget_reached' as const, message: buildTenantAiCreditMessage(session.user.role, context.actorDisplayName) }
                  : null;

  if (!denial) {
    return;
  }

  await writeAiUsageEvent({
    ...context,
    errorCategory: denial.category,
    featureId: input.featureId,
    operationId: input.operationId,
    operationLabel: input.operationLabel,
    resourceId: input.resourceId || null,
    resourceType: input.resourceType || null,
    status: 'blocked'
  }).catch(() => undefined);

  const error = new Error(denial.message);
  error.name = 'AiPolicyDeniedError';
  throw error;
}

export function listTenantAiFeatureCatalog(): Array<{ featureId: AiUsageFeatureId; label: string }> {
  return AI_FEATURE_IDS.map((featureId) => ({ featureId, label: getAiFeatureLabel(featureId) }));
}

async function getOrCreateTenantAiPolicy(tenantId: string, actorUid: string): Promise<TenantAiPolicy> {
  const ref = firestore.collection('tenantAiPolicies').doc(tenantId);
  const snapshot = await ref.get();

  if (snapshot.exists) {
    return normalizePolicy(snapshot.data() || {}, tenantId);
  }

  const nowIso = new Date().toISOString();
  const policy: TenantAiPolicy = {
    companyAiEnabled: true,
    createdAtIso: nowIso,
    departmentPolicies: {},
    disabledReason: null,
    employeePolicies: {},
    featurePolicies: Object.fromEntries(AI_FEATURE_IDS.map((featureId) => [featureId, defaultFeaturePolicy(featureId)])),
    hardLimitEnabled: false,
    monthlyBudgetUsd: null,
    softWarningPercent: 80,
    tenantId,
    updatedAtIso: nowIso,
    updatedByUid: actorUid
  };

  await ref.set({
    ...policy,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return policy;
}

async function saveTenantAiPolicy(policy: TenantAiPolicy): Promise<void> {
  await firestore.collection('tenantAiPolicies').doc(policy.tenantId).set({
    ...policy,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

function normalizePolicy(data: FirebaseFirestore.DocumentData, tenantId: string): TenantAiPolicy {
  const nowIso = new Date().toISOString();
  const featurePolicies = { ...(data.featurePolicies || {}) } as Record<string, TenantAiFeaturePolicy>;

  AI_FEATURE_IDS.forEach((featureId) => {
    featurePolicies[featureId] = {
      ...defaultFeaturePolicy(featureId),
      ...(featurePolicies[featureId] || {}),
      featureId
    };
  });

  return {
    companyAiEnabled: data.companyAiEnabled !== false,
    createdAtIso: typeof data.createdAtIso === 'string' ? data.createdAtIso : nowIso,
    departmentPolicies: normalizeScopePolicies(data.departmentPolicies),
    disabledReason: typeof data.disabledReason === 'string' ? data.disabledReason : null,
    employeePolicies: normalizeScopePolicies(data.employeePolicies),
    featurePolicies,
    hardLimitEnabled: data.hardLimitEnabled === true,
    monthlyBudgetUsd: Number.isFinite(data.monthlyBudgetUsd) ? Number(data.monthlyBudgetUsd) : null,
    softWarningPercent: Number.isFinite(data.softWarningPercent) ? Number(data.softWarningPercent) : 80,
    tenantId,
    updatedAtIso: typeof data.updatedAtIso === 'string' ? data.updatedAtIso : nowIso,
    updatedByUid: typeof data.updatedByUid === 'string' ? data.updatedByUid : null
  };
}

function normalizeScopePolicies(value: unknown): Record<string, TenantAiScopePolicy> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(Object.entries(value as Record<string, Partial<TenantAiScopePolicy>>).map(([id, policy]) => [
    id,
    {
      ...defaultScopePolicy(),
      ...policy,
      enabled: policy.enabled !== false,
      monthlyBudgetUsd: Number.isFinite(policy.monthlyBudgetUsd) ? Number(policy.monthlyBudgetUsd) : null
    }
  ]));
}

function defaultFeaturePolicy(featureId: AiUsageFeatureId): TenantAiFeaturePolicy {
  return {
    enabled: true,
    featureId,
    hardLimitEnabled: false,
    monthlyBudgetUsd: null,
    updatedAtIso: null,
    updatedByUid: null
  };
}

function defaultScopePolicy(): TenantAiScopePolicy {
  return {
    enabled: true,
    hardLimitEnabled: false,
    monthlyBudgetUsd: null,
    updatedAtIso: null,
    updatedByUid: null
  };
}

async function getCurrentMonthScopeUsage(
  tenantId: string,
  input: {
    departmentId: string | null;
    employeeUid: string | null;
    featureId: AiUsageFeatureId;
  }
): Promise<{
  departmentCostUsd: number;
  employeeCostUsd: number;
  featureCostUsd: number;
}> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const events = await listTenantAiUsageEvents(tenantId, start.toISOString(), end.toISOString());

  return events.reduce((totals, event) => ({
    departmentCostUsd: totals.departmentCostUsd + (
      input.departmentId && event.actorDepartmentId === input.departmentId ? event.estimatedCostUsd : 0
    ),
    employeeCostUsd: totals.employeeCostUsd + (
      input.employeeUid && event.actorUid === input.employeeUid ? event.estimatedCostUsd : 0
    ),
    featureCostUsd: totals.featureCostUsd + (
      event.featureId === input.featureId ? event.estimatedCostUsd : 0
    )
  }), {
      departmentCostUsd: 0,
      employeeCostUsd: 0,
      featureCostUsd: 0
  });
}

function buildTenantAiDeniedMessage(role: string | undefined, displayName?: string | null): string {
  if (isOrgAdminRole(role)) {
    return 'AI access is currently unavailable. Please check AI credit usage and tenant AI settings.';
  }

  return [
    `Sorry${displayName ? `, ${displayName}` : ''}.`,
    'You do not currently have access to use this AI feature.',
    'Please contact your Company Administrator or the Human Resources department for access.'
  ].join(' ');
}

function buildTenantAiCreditMessage(role: string | undefined, displayName?: string | null): string {
  if (isOrgAdminRole(role)) {
    return 'AI access is currently unavailable. Please check AI credit usage, monthly budget limits, and tenant AI settings.';
  }

  return [
    `Sorry${displayName ? `, ${displayName}` : ''}.`,
    'This AI feature is not available at the moment.',
    'Please contact your Company Administrator or the Human Resources department for access.'
  ].join(' ');
}

function isOrgAdminRole(role: string | undefined): boolean {
  return role === 'ORG_ADMIN' || role === 'SYSTEM_ADMIN';
}
