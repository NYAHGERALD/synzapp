import { randomUUID } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { buildAuthSession } from './authSessionService.js';

export type AiUsageFeatureId =
  | 'chat_translation'
  | 'interpreter_realtime'
  | 'interpreter_segment_translation'
  | 'interpreter_spoken_summary'
  | 'interpreter_summary'
  | 'interpreter_transcript_audio'
  | 'interpreter_voice_preview'
  | 'lsw_ai'
  | 'rails_ai'
  | 'rca_ai';

export type AiUsageStatus = 'blocked' | 'cancelled' | 'failed' | 'succeeded';
export type AiUsageErrorCategory =
  | 'department_ai_disabled'
  | 'employee_ai_disabled'
  | 'feature_ai_disabled'
  | 'none'
  | 'provider_auth_error'
  | 'provider_credit_exhausted'
  | 'provider_model_unavailable'
  | 'provider_rate_limited'
  | 'provider_timeout'
  | 'request_invalid'
  | 'tenant_ai_disabled'
  | 'tenant_budget_reached'
  | 'unknown';

export interface AiUsageContext {
  actorDepartmentId?: string | null;
  actorDepartmentName?: string | null;
  actorDisplayName?: string | null;
  actorUid: string;
  companyName?: string | null;
  tenantId: string;
}

export interface AiUsageEventInput extends Partial<AiUsageContext> {
  audioInputTokens?: number;
  audioOutputTokens?: number;
  audioSeconds?: number;
  cachedAudioInputTokens?: number;
  cachedInputTokens?: number;
  correlationId?: string | null;
  durationMs?: number;
  errorCategory?: AiUsageErrorCategory;
  estimatedCostUsd?: number;
  featureId: AiUsageFeatureId;
  inputTokens?: number;
  model?: string | null;
  operationId: string;
  operationLabel: string;
  outputTokens?: number;
  pricingVersionId?: string | null;
  provider?: 'openai' | 'synzapp' | string;
  providerRequestId?: string | null;
  requestEndedAtIso?: string;
  requestStartedAtIso?: string;
  resourceId?: string | null;
  resourceType?: string | null;
  status: AiUsageStatus;
}

export interface AiUsageSummary {
  budget: {
    hardLimitEnabled: boolean;
    monthlyBudgetUsd: number | null;
    remainingBudgetUsd: number | null;
    softWarningPercent: number;
  };
  generatedAudioSeconds: number;
  period: {
    endDate: string;
    label: string;
    month: string;
    startDate: string;
  };
  status: 'ai_disabled' | 'approaching_budget' | 'budget_reached' | 'healthy';
  totals: {
    audioInputTokens: number;
    audioOutputTokens: number;
    estimatedCostUsd: number;
    failedRequests: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
    successfulRequests: number;
  };
}

export interface AiUsageBreakdownRow {
  enabled?: boolean;
  estimatedCostUsd: number;
  id: string;
  label: string;
  requestCount: number;
  status?: string;
}

interface TenantUserRecord {
  departmentId?: string | null;
  departmentName?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  roleName?: string | null;
  status?: string | null;
  tenantId?: string | null;
}

interface OrganizationRecord {
  companyName?: string | null;
  name?: string | null;
  tenantId?: string | null;
}

interface AiUsageEventRecord extends AiUsageEventInput {
  actorDepartmentId: string | null;
  actorDepartmentName: string | null;
  actorDisplayName: string | null;
  actorUid: string;
  audioInputTokens: number;
  audioOutputTokens: number;
  audioSeconds: number;
  cachedAudioInputTokens: number;
  cachedInputTokens: number;
  companyName: string | null;
  correlationId: string;
  createdAt: FirebaseFirestore.FieldValue;
  createdAtIso: string;
  durationMs: number;
  errorCategory: AiUsageErrorCategory;
  estimatedCostUsd: number;
  eventId: string;
  inputTokens: number;
  model: string | null;
  outputTokens: number;
  pricingVersionId: string | null;
  provider: string;
  providerRequestId: string | null;
  requestEndedAtIso: string;
  requestStartedAtIso: string;
  resourceId: string | null;
  resourceType: string | null;
  tenantId: string;
}

export async function getAiUsageContext(
  decodedToken: DecodedIdToken,
  options: { requireAdmin?: boolean } = { requireAdmin: true }
): Promise<AiUsageContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId, uid } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your AI usage session is not active.');
  }

  if (
    options.requireAdmin !== false &&
    role !== 'ORG_ADMIN' &&
    !permissions.includes('tenant.update') &&
    !permissions.includes('security.manage')
  ) {
    throw authorizationError('You do not have permission to view AI usage.');
  }

  const [organizationSnapshot, userSnapshot] = await Promise.all([
    firestore.collection('organizations').doc(tenantId).get(),
    firestore.collection('identityDirectory').doc(uid).get()
  ]);
  const organization = organizationSnapshot.exists
    ? (organizationSnapshot.data() as OrganizationRecord)
    : null;
  const user = userSnapshot.exists
    ? (userSnapshot.data() as TenantUserRecord)
    : null;

  return {
    actorDepartmentId: user?.departmentId || session.user.departmentId || null,
    actorDepartmentName: user?.departmentName || null,
    actorDisplayName: getUserDisplayName(user) || null,
    actorUid: uid,
    companyName: organization?.companyName || organization?.name || null,
    tenantId
  };
}

export async function writeAiUsageEvent(input: AiUsageEventInput): Promise<AiUsageEventRecord> {
  const tenantId = input.tenantId;

  if (!tenantId) {
    throw new Error('AI usage event requires a tenant id.');
  }

  const nowIso = new Date().toISOString();
  const eventId = `ai_evt_${randomUUID()}`;
  const record: AiUsageEventRecord = {
    actorDepartmentId: input.actorDepartmentId || null,
    actorDepartmentName: input.actorDepartmentName || null,
    actorDisplayName: input.actorDisplayName || null,
    actorUid: input.actorUid || 'unknown',
    audioInputTokens: normalizeCount(input.audioInputTokens),
    audioOutputTokens: normalizeCount(input.audioOutputTokens),
    audioSeconds: normalizeCount(input.audioSeconds),
    cachedAudioInputTokens: normalizeCount(input.cachedAudioInputTokens),
    cachedInputTokens: normalizeCount(input.cachedInputTokens),
    companyName: input.companyName || null,
    correlationId: input.correlationId || randomUUID(),
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    durationMs: normalizeCount(input.durationMs),
    errorCategory: input.errorCategory || 'none',
    estimatedCostUsd: normalizeCurrency(input.estimatedCostUsd),
    eventId,
    featureId: input.featureId,
    inputTokens: normalizeCount(input.inputTokens),
    model: input.model || null,
    operationId: input.operationId,
    operationLabel: input.operationLabel,
    outputTokens: normalizeCount(input.outputTokens),
    pricingVersionId: input.pricingVersionId || null,
    provider: input.provider || 'openai',
    providerRequestId: input.providerRequestId || null,
    requestEndedAtIso: input.requestEndedAtIso || nowIso,
    requestStartedAtIso: input.requestStartedAtIso || nowIso,
    resourceId: input.resourceId || null,
    resourceType: input.resourceType || null,
    status: input.status,
    tenantId
  };

  await firestore.collection('tenantAiUsageEvents').doc(eventId).set(record);
  return record;
}

export async function getTenantAiUsageSummary(input: {
  month?: string;
  policy: {
    companyAiEnabled: boolean;
    hardLimitEnabled: boolean;
    monthlyBudgetUsd: number | null;
    softWarningPercent: number;
  };
  tenantId: string;
}): Promise<AiUsageSummary> {
  const period = getMonthPeriod(input.month);
  const events = await listTenantAiUsageEvents(input.tenantId, period.startIso, period.endIso);
  const totals = summarizeEvents(events);
  const remainingBudgetUsd = input.policy.monthlyBudgetUsd === null
    ? null
    : Math.max(0, input.policy.monthlyBudgetUsd - totals.estimatedCostUsd);
  const budgetUsedPercent = input.policy.monthlyBudgetUsd && input.policy.monthlyBudgetUsd > 0
    ? (totals.estimatedCostUsd / input.policy.monthlyBudgetUsd) * 100
    : 0;

  return {
    budget: {
      hardLimitEnabled: input.policy.hardLimitEnabled,
      monthlyBudgetUsd: input.policy.monthlyBudgetUsd,
      remainingBudgetUsd,
      softWarningPercent: input.policy.softWarningPercent
    },
    generatedAudioSeconds: events.reduce((total, event) => total + normalizeCount(event.audioSeconds), 0),
    period: {
      endDate: period.endDate,
      label: 'Current month',
      month: period.month,
      startDate: period.startDate
    },
    status: !input.policy.companyAiEnabled
      ? 'ai_disabled'
      : input.policy.monthlyBudgetUsd !== null && input.policy.hardLimitEnabled && totals.estimatedCostUsd >= input.policy.monthlyBudgetUsd
        ? 'budget_reached'
        : input.policy.monthlyBudgetUsd !== null && budgetUsedPercent >= input.policy.softWarningPercent
          ? 'approaching_budget'
          : 'healthy',
    totals
  };
}

export async function getTenantAiUsageBreakdowns(input: {
  month?: string;
  tenantId: string;
}): Promise<{
  departments: AiUsageBreakdownRow[];
  employees: AiUsageBreakdownRow[];
  failures: AiUsageBreakdownRow[];
  features: AiUsageBreakdownRow[];
  meetings: AiUsageBreakdownRow[];
}> {
  const period = getMonthPeriod(input.month);
  const events = await listTenantAiUsageEvents(input.tenantId, period.startIso, period.endIso);

  return {
    departments: buildBreakdown(events, (event) => ({
      id: event.actorDepartmentId || 'unknown_department',
      label: event.actorDepartmentName || 'Unassigned department'
    })),
    employees: buildBreakdown(events, (event) => ({
      id: event.actorUid || 'unknown_employee',
      label: event.actorDisplayName || 'Unknown employee'
    })),
    failures: buildBreakdown(
      events.filter((event) => event.status === 'blocked' || event.status === 'failed'),
      (event) => ({ id: event.errorCategory || 'unknown', label: humanizeId(event.errorCategory || 'unknown') })
    ),
    features: buildBreakdown(events, (event) => ({
      id: event.featureId,
      label: getAiFeatureLabel(event.featureId)
    })),
    meetings: buildBreakdown(
      events.filter((event) => event.resourceType === 'interpreter_meeting' && Boolean(event.resourceId)),
      (event) => ({ id: event.resourceId || 'unknown_meeting', label: event.resourceId || 'Unknown meeting' })
    )
  };
}

export async function listTenantAiUsageEvents(
  tenantId: string,
  startIso: string,
  endIso: string
): Promise<AiUsageEventRecord[]> {
  let snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;

  try {
    snapshot = await firestore
      .collection('tenantAiUsageEvents')
      .where('tenantId', '==', tenantId)
      .where('createdAtIso', '>=', startIso)
      .where('createdAtIso', '<=', endIso)
      .limit(2500)
      .get();
  } catch (error) {
    if (!isMissingFirestoreCompositeIndexError(error)) {
      throw error;
    }

    console.warn('AI usage dashboard is using tenant-scan fallback while Firestore index is building.');
    snapshot = await firestore
      .collection('tenantAiUsageEvents')
      .where('tenantId', '==', tenantId)
      .limit(5000)
      .get();
  }

  return snapshot.docs
    .map((doc) => doc.data() as AiUsageEventRecord)
    .filter((event) => event.createdAtIso >= startIso && event.createdAtIso <= endIso)
    .sort((first, second) => first.createdAtIso.localeCompare(second.createdAtIso));
}

export function estimateOpenAiCostUsd(input: {
  audioInputTokens?: number;
  audioOutputTokens?: number;
  cachedAudioInputTokens?: number;
  cachedInputTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  perMinuteUsd?: number | null;
  seconds?: number;
  textInputPerMillionUsd?: number;
  textOutputPerMillionUsd?: number;
  audioInputPerMillionUsd?: number;
  audioOutputPerMillionUsd?: number;
}): number {
  const tokenCost =
    (normalizeCount(input.inputTokens) / 1_000_000) * (input.textInputPerMillionUsd ?? 4) +
    (normalizeCount(input.cachedInputTokens) / 1_000_000) * 0.4 +
    (normalizeCount(input.outputTokens) / 1_000_000) * (input.textOutputPerMillionUsd ?? 24) +
    (normalizeCount(input.audioInputTokens) / 1_000_000) * (input.audioInputPerMillionUsd ?? 32) +
    (normalizeCount(input.cachedAudioInputTokens) / 1_000_000) * 0.4 +
    (normalizeCount(input.audioOutputTokens) / 1_000_000) * (input.audioOutputPerMillionUsd ?? 64);
  const minuteCost = input.perMinuteUsd
    ? Math.ceil(normalizeCount(input.seconds) / 60) * input.perMinuteUsd
    : 0;

  return normalizeCurrency(tokenCost + minuteCost);
}

export function getCurrentMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getAiFeatureLabel(featureId: string): string {
  const labels: Record<string, string> = {
    chat_translation: 'Chat Translation',
    interpreter_realtime: 'Live Interpreter',
    interpreter_segment_translation: 'Segment Translation',
    interpreter_spoken_summary: 'Spoken Summary',
    interpreter_summary: 'Interpreter Summary',
    interpreter_transcript_audio: 'Transcript Audio',
    interpreter_voice_preview: 'Voice Preview',
    lsw_ai: 'LSW AI',
    rails_ai: 'RAILS AI',
    rca_ai: 'RCA AI'
  };

  return labels[featureId] || humanizeId(featureId);
}

function summarizeEvents(events: AiUsageEventRecord[]): AiUsageSummary['totals'] {
  return events.reduce<AiUsageSummary['totals']>((totals, event) => ({
    audioInputTokens: totals.audioInputTokens + normalizeCount(event.audioInputTokens),
    audioOutputTokens: totals.audioOutputTokens + normalizeCount(event.audioOutputTokens),
    estimatedCostUsd: normalizeCurrency(totals.estimatedCostUsd + normalizeCurrency(event.estimatedCostUsd)),
    failedRequests: totals.failedRequests + (event.status === 'failed' || event.status === 'blocked' ? 1 : 0),
    inputTokens: totals.inputTokens + normalizeCount(event.inputTokens),
    outputTokens: totals.outputTokens + normalizeCount(event.outputTokens),
    requests: totals.requests + 1,
    successfulRequests: totals.successfulRequests + (event.status === 'succeeded' ? 1 : 0)
  }), {
    audioInputTokens: 0,
    audioOutputTokens: 0,
    estimatedCostUsd: 0,
    failedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    requests: 0,
    successfulRequests: 0
  });
}

function buildBreakdown(
  events: AiUsageEventRecord[],
  getKey: (event: AiUsageEventRecord) => { id: string; label: string }
): AiUsageBreakdownRow[] {
  const rows = new Map<string, AiUsageBreakdownRow>();

  events.forEach((event) => {
    const key = getKey(event);
    const existing = rows.get(key.id) || {
      estimatedCostUsd: 0,
      id: key.id,
      label: key.label,
      requestCount: 0
    };

    existing.estimatedCostUsd = normalizeCurrency(existing.estimatedCostUsd + normalizeCurrency(event.estimatedCostUsd));
    existing.requestCount += 1;
    rows.set(key.id, existing);
  });

  return [...rows.values()].sort((first, second) => second.estimatedCostUsd - first.estimatedCostUsd);
}

function getMonthPeriod(month?: string) {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(month || '') ? month as string : getCurrentMonthKey();
  const [yearText, monthText] = normalizedMonth.split('-');
  const start = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(Number(yearText), Number(monthText), 0, 23, 59, 59, 999));

  return {
    endDate: end.toISOString().slice(0, 10),
    endIso: end.toISOString(),
    month: normalizedMonth,
    startDate: start.toISOString().slice(0, 10),
    startIso: start.toISOString()
  };
}

function getUserDisplayName(user: TenantUserRecord | null): string | null {
  if (!user) {
    return null;
  }

  const displayName = user.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || null;
}

function isMissingFirestoreCompositeIndexError(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error
    ? Number((error as { code?: unknown }).code)
    : null;
  const message = error instanceof Error ? error.message : '';

  return code === 9 && /requires an index/i.test(message);
}

function humanizeId(value: string): string {
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeCount(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

function normalizeCurrency(value: unknown): number {
  return Number.isFinite(value) ? Math.round(Number(value) * 10000) / 10000 : 0;
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}
