import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorageMock = vi.hoisted(() => ({
  values: new Map<string, string>()
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStorageMock.values.get(key) || null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStorageMock.values.set(key, value);
    })
  }
}));

import {
  dismissGuidedSetupJourney,
  loadGuidedSetupJourneyState,
  markGuidedSetupJourneyCompleted,
  saveGuidedSetupJourneyStep
} from './guidedSetupCoach';

const scope = {
  ownerUid: 'owner-1',
  role: 'ORG_ADMIN',
  tenantId: 'tenant-1'
};

describe('guidedSetupCoach', () => {
  beforeEach(() => {
    asyncStorageMock.values.clear();
  });

  it('starts a new journey as active', async () => {
    await expect(loadGuidedSetupJourneyState(scope)).resolves.toMatchObject({
      completedAt: null,
      dismissedAt: null,
      lastStepId: null,
      status: 'active',
      version: 1
    });
  });

  it('stores the last active step by tenant, user, and role', async () => {
    await saveGuidedSetupJourneyStep(scope, 'department');

    await expect(loadGuidedSetupJourneyState(scope)).resolves.toMatchObject({
      lastStepId: 'department',
      status: 'active'
    });
  });

  it('persists dismissed and completed terminal states', async () => {
    await dismissGuidedSetupJourney(scope);
    await expect(loadGuidedSetupJourneyState(scope)).resolves.toMatchObject({
      completedAt: null,
      status: 'dismissed'
    });

    await markGuidedSetupJourneyCompleted(scope);
    await expect(loadGuidedSetupJourneyState(scope)).resolves.toMatchObject({
      dismissedAt: null,
      status: 'completed'
    });
  });
});
