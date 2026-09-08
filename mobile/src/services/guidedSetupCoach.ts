import AsyncStorage from '@react-native-async-storage/async-storage';

export const ORG_ADMIN_COMPANY_SETUP_JOURNEY_ID = 'ORG_ADMIN_COMPANY_SETUP_V1';

export type GuidedSetupJourneyStatus = 'active' | 'completed' | 'dismissed';

export interface GuidedSetupScope {
  ownerUid: string;
  role: string;
  tenantId: string;
}

export interface GuidedSetupJourneyState {
  completedAt: string | null;
  dismissedAt: string | null;
  journeyId: string;
  lastStepId: string | null;
  status: GuidedSetupJourneyStatus;
  updatedAt: string;
  version: 1;
}

const GUIDED_SETUP_KEY_PREFIX = 'synzapp.guidedSetup.v1:';

export async function loadGuidedSetupJourneyState(
  scope: GuidedSetupScope | null | undefined,
  journeyId = ORG_ADMIN_COMPANY_SETUP_JOURNEY_ID
): Promise<GuidedSetupJourneyState> {
  if (!isValidScope(scope)) {
    return createDefaultGuidedSetupJourneyState(journeyId);
  }

  const storedValue = await AsyncStorage.getItem(getGuidedSetupJourneyKey(scope, journeyId)).catch(() => null);
  if (!storedValue) {
    return createDefaultGuidedSetupJourneyState(journeyId);
  }

  try {
    return normalizeGuidedSetupJourneyState(JSON.parse(storedValue), journeyId);
  } catch {
    return createDefaultGuidedSetupJourneyState(journeyId);
  }
}

export async function saveGuidedSetupJourneyStep(
  scope: GuidedSetupScope,
  stepId: string,
  journeyId = ORG_ADMIN_COMPANY_SETUP_JOURNEY_ID
): Promise<GuidedSetupJourneyState> {
  return saveGuidedSetupJourneyState(scope, {
    lastStepId: stepId,
    status: 'active'
  }, journeyId);
}

export async function markGuidedSetupJourneyCompleted(
  scope: GuidedSetupScope,
  journeyId = ORG_ADMIN_COMPANY_SETUP_JOURNEY_ID
): Promise<GuidedSetupJourneyState> {
  const nowIso = new Date().toISOString();

  return saveGuidedSetupJourneyState(scope, {
    completedAt: nowIso,
    dismissedAt: null,
    status: 'completed'
  }, journeyId);
}

export async function dismissGuidedSetupJourney(
  scope: GuidedSetupScope,
  journeyId = ORG_ADMIN_COMPANY_SETUP_JOURNEY_ID
): Promise<GuidedSetupJourneyState> {
  const nowIso = new Date().toISOString();

  return saveGuidedSetupJourneyState(scope, {
    completedAt: null,
    dismissedAt: nowIso,
    status: 'dismissed'
  }, journeyId);
}

function createDefaultGuidedSetupJourneyState(journeyId: string): GuidedSetupJourneyState {
  return {
    completedAt: null,
    dismissedAt: null,
    journeyId,
    lastStepId: null,
    status: 'active',
    updatedAt: '',
    version: 1
  };
}

async function saveGuidedSetupJourneyState(
  scope: GuidedSetupScope,
  patch: Partial<GuidedSetupJourneyState>,
  journeyId: string
): Promise<GuidedSetupJourneyState> {
  if (!isValidScope(scope)) {
    throw new Error('Cannot save guided setup state without a company scope.');
  }

  const currentState = await loadGuidedSetupJourneyState(scope, journeyId);
  const nextState = normalizeGuidedSetupJourneyState({
    ...currentState,
    ...patch,
    journeyId,
    updatedAt: new Date().toISOString(),
    version: 1
  }, journeyId);

  await AsyncStorage.setItem(getGuidedSetupJourneyKey(scope, journeyId), JSON.stringify(nextState));

  return nextState;
}

function normalizeGuidedSetupJourneyState(input: Partial<GuidedSetupJourneyState>, journeyId: string): GuidedSetupJourneyState {
  const status = input.status === 'completed' || input.status === 'dismissed'
    ? input.status
    : 'active';

  return {
    completedAt: typeof input.completedAt === 'string' ? input.completedAt : null,
    dismissedAt: typeof input.dismissedAt === 'string' ? input.dismissedAt : null,
    journeyId,
    lastStepId: typeof input.lastStepId === 'string' ? input.lastStepId : null,
    status,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : '',
    version: 1
  };
}

function getGuidedSetupJourneyKey(scope: GuidedSetupScope, journeyId: string): string {
  return `${GUIDED_SETUP_KEY_PREFIX}${encodeURIComponent(scope.tenantId)}:${encodeURIComponent(scope.ownerUid)}:${encodeURIComponent(scope.role)}:${journeyId}`;
}

function isValidScope(scope: GuidedSetupScope | null | undefined): scope is GuidedSetupScope {
  return Boolean(scope?.ownerUid && scope.tenantId && scope.role);
}
