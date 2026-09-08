import * as SecureStore from 'expo-secure-store';

export interface CompanyDataSessionScope {
  ownerUid: string;
  tenantId: string;
}

const COMPANY_DATA_SCOPE_STORAGE_KEY = 'synzapp.companyDataScope.v1';

export async function saveCompanyDataSessionScope(input: CompanyDataSessionScope): Promise<void> {
  if (!input.ownerUid || !input.tenantId) {
    return;
  }

  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    return;
  }

  await SecureStore.setItemAsync(
    COMPANY_DATA_SCOPE_STORAGE_KEY,
    JSON.stringify({
      ownerUid: input.ownerUid,
      tenantId: input.tenantId
    })
  );
}

export async function getLastCompanyDataSessionScope(): Promise<CompanyDataSessionScope | null> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    return null;
  }

  const storedValue = await SecureStore.getItemAsync(COMPANY_DATA_SCOPE_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;

    if (isCompanyDataSessionScope(parsedValue)) {
      return parsedValue;
    }
  } catch {
    return null;
  }

  return null;
}

export async function clearCompanyDataSessionScope(): Promise<void> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    return;
  }

  await SecureStore.deleteItemAsync(COMPANY_DATA_SCOPE_STORAGE_KEY).catch(() => undefined);
}

function isCompanyDataSessionScope(value: unknown): value is CompanyDataSessionScope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.ownerUid === 'string' &&
    record.ownerUid.trim().length > 0 &&
    typeof record.tenantId === 'string' &&
    record.tenantId.trim().length > 0;
}
