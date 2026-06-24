import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import { buildAuthSession } from './authSessionService.js';

interface CompanyProfileInput {
  companyAddress: string;
  companyName: string;
  calendarYearStartDate?: string;
}

interface CompanyLogoInput {
  companyLogoDataUrl: string;
}

interface TenantAdminContext {
  permissions: string[];
  tenantId: string;
  uid: string;
}

interface OrganizationRecord {
  calendarYear?: {
    startDate?: string;
    startDay?: number;
    startMonth?: number;
    startYear?: number;
    weekOneStartsOn?: string;
  };
  companyAddress?: string;
  companyLogoContentType?: string | null;
  companyLogoStoragePath?: string | null;
  companyLogoUrl?: string | null;
  companyLogoVersion?: number | null;
  companyName?: string;
  companySlug?: string;
  createdAt?: FirebaseDateLike;
  createdBy?: string;
  retentionPolicy?: string;
  securityMode?: string;
  status?: string;
  tenantId?: string;
  updatedAt?: FirebaseDateLike;
}

interface FirebaseDateLike {
  toMillis?: () => number;
  seconds?: number;
}

export interface CompanyProfileResponse {
  calendarYearStartDate: string;
  calendarYearStartDay: number;
  calendarYearStartMonth: number;
  calendarYearStartYear: number;
  calendarYearWeekOneStartsOn: string;
  companyAddress: string;
  companyLogoCacheKey: string | null;
  companyLogoUrl: string | null;
  companyName: string;
  companySlug: string;
  createdAt: string | null;
  retentionPolicy: string;
  securityMode: string;
  status: string;
  tenantId: string;
  updatedAt: string | null;
}

export interface CompanyLogoResponse {
  cacheKey: string;
  contentType: string;
  file: ReturnType<typeof storageBucket.file>;
}

export async function getCompanyProfile(
  decodedToken: DecodedIdToken
): Promise<CompanyProfileResponse> {
  const context = await requireCompanyAdmin(decodedToken);
  const organizationSnapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .get();

  if (!organizationSnapshot.exists) {
    throw notFoundError('Company profile was not found.');
  }

  return mapCompanyProfile(
    organizationSnapshot.data() as OrganizationRecord,
    organizationSnapshot.id
  );
}

export async function updateCompanyProfile(
  decodedToken: DecodedIdToken,
  input: CompanyProfileInput
): Promise<CompanyProfileResponse> {
  const context = await requireCompanyAdmin(decodedToken);
  const companyName = input.companyName.trim();
  const companyAddress = input.companyAddress.trim();
  const calendarYearStart = input.calendarYearStartDate
    ? parseCalendarYearStartDate(input.calendarYearStartDate)
    : undefined;

  if (companyName.length < 2) {
    throw validationError('Enter a company name.');
  }

  if (companyAddress.length < 5) {
    throw validationError('Enter a company address.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const nextCompanySlug = slugifyCompanyName(companyName);
  let previousCompanySlug = '';

  await firestore.runTransaction(async (transaction) => {
    const organizationSnapshot = await transaction.get(organizationRef);

    if (!organizationSnapshot.exists) {
      throw notFoundError('Company profile was not found.');
    }

    const organization = organizationSnapshot.data() as OrganizationRecord;

    if (organization.status !== 'ACTIVE') {
      throw authorizationError('Your company profile is not active.');
    }

    previousCompanySlug = organization.companySlug || slugifyCompanyName(organization.companyName || '');

    if (previousCompanySlug !== nextCompanySlug) {
      const nextNameRef = firestore.collection('organizationNameDirectory').doc(nextCompanySlug);
      const nextNameSnapshot = await transaction.get(nextNameRef);

      if (nextNameSnapshot.exists && nextNameSnapshot.data()?.tenantId !== context.tenantId) {
        throw conflictError('This company name needs review before it can be used.');
      }

      transaction.set(nextNameRef, {
        companyName,
        createdAt: fieldValue.serverTimestamp(),
        status: 'ACTIVE',
        tenantId: context.tenantId,
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true });

      if (previousCompanySlug) {
        const previousNameRef = firestore.collection('organizationNameDirectory').doc(previousCompanySlug);

        transaction.set(previousNameRef, {
          replacedBySlug: nextCompanySlug,
          status: 'RENAMED',
          updatedAt: fieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    const organizationUpdate: Record<string, unknown> = {
      companyAddress,
      companyName,
      companySlug: nextCompanySlug,
      updatedAt: fieldValue.serverTimestamp(),
      updatedBy: context.uid
    };

    if (calendarYearStart) {
      organizationUpdate.calendarYear = {
        startDate: calendarYearStart.startDate,
        startDay: calendarYearStart.startDay,
        startMonth: calendarYearStart.startMonth,
        startYear: calendarYearStart.startYear,
        updatedAt: fieldValue.serverTimestamp(),
        updatedByUid: context.uid,
        weekOneStartsOn: 'CALENDAR_YEAR_START'
      };
    }

    transaction.set(organizationRef, organizationUpdate, { merge: true });
  });

  const refreshedSnapshot = await organizationRef.get();

  if (!refreshedSnapshot.exists) {
    throw notFoundError('Company profile was not found.');
  }

  return mapCompanyProfile(refreshedSnapshot.data() as OrganizationRecord, refreshedSnapshot.id);
}

export async function updateCompanyLogo(
  decodedToken: DecodedIdToken,
  input: CompanyLogoInput
): Promise<CompanyProfileResponse> {
  const context = await requireCompanyAdmin(decodedToken);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const organizationSnapshot = await organizationRef.get();

  if (!organizationSnapshot.exists) {
    throw notFoundError('Company profile was not found.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;

  if (organization.status !== 'ACTIVE') {
    throw authorizationError('Your company profile is not active.');
  }

  const uploadedLogo = await uploadCompanyLogo(context.tenantId, input.companyLogoDataUrl);
  const companyLogoVersion = Date.now();

  await organizationRef.set({
    companyLogoContentType: uploadedLogo.contentType,
    companyLogoStoragePath: uploadedLogo.storagePath,
    companyLogoVersion,
    updatedAt: fieldValue.serverTimestamp(),
    updatedBy: context.uid
  }, { merge: true });

  const refreshedSnapshot = await organizationRef.get();

  if (!refreshedSnapshot.exists) {
    throw notFoundError('Company profile was not found.');
  }

  return mapCompanyProfile(refreshedSnapshot.data() as OrganizationRecord, refreshedSnapshot.id);
}

export async function getCompanyLogo(
  decodedToken: DecodedIdToken
): Promise<CompanyLogoResponse> {
  const context = await requireCompanyAdmin(decodedToken);
  const organizationSnapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .get();

  if (!organizationSnapshot.exists) {
    throw notFoundError('Company logo was not found.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;
  const storagePath = organization.companyLogoStoragePath;

  if (!storagePath) {
    throw notFoundError('Company logo was not found.');
  }

  const file = storageBucket.file(storagePath);

  try {
    const [exists] = await file.exists();

    if (!exists) {
      throw notFoundError('Company logo was not found.');
    }
  } catch (error) {
    if (isMissingStorageBucketError(error)) {
      throw notFoundError('Company logo storage is not ready yet.');
    }

    throw error;
  }

  return {
    cacheKey: buildCompanyLogoCacheKey(context.tenantId, organization.companyLogoVersion),
    contentType: organization.companyLogoContentType || 'image/jpeg',
    file
  };
}

async function requireCompanyAdmin(decodedToken: DecodedIdToken): Promise<TenantAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your admin session is not active.');
  }

  if (role !== 'ORG_ADMIN' || !permissions.includes('tenant.update')) {
    throw authorizationError('You do not have permission to manage company settings.');
  }

  return {
    permissions,
    tenantId,
    uid: decodedToken.uid
  };
}

function mapCompanyProfile(
  record: OrganizationRecord,
  fallbackTenantId: string
): CompanyProfileResponse {
  const calendarYear = mapCalendarYearSettings(record);

  return {
    calendarYearStartDate: calendarYear.startDate,
    calendarYearStartDay: calendarYear.startDay,
    calendarYearStartMonth: calendarYear.startMonth,
    calendarYearStartYear: calendarYear.startYear,
    calendarYearWeekOneStartsOn: calendarYear.weekOneStartsOn,
    companyAddress: record.companyAddress || '',
    companyLogoCacheKey: record.companyLogoStoragePath
      ? buildCompanyLogoCacheKey(record.tenantId || fallbackTenantId, record.companyLogoVersion)
      : null,
    companyLogoUrl: getCompanyLogoUrl(record.companyLogoStoragePath, record.companyLogoVersion),
    companyName: record.companyName || '',
    companySlug: record.companySlug || '',
    createdAt: dateLikeToIso(record.createdAt),
    retentionPolicy: record.retentionPolicy || 'Not set',
    securityMode: record.securityMode || 'Not set',
    status: record.status || 'ACTIVE',
    tenantId: record.tenantId || fallbackTenantId,
    updatedAt: dateLikeToIso(record.updatedAt)
  };
}

function mapCalendarYearSettings(record: OrganizationRecord): {
  startDate: string;
  startDay: number;
  startMonth: number;
  startYear: number;
  weekOneStartsOn: string;
} {
  const startMonth = Number.isInteger(record.calendarYear?.startMonth)
    ? record.calendarYear?.startMonth || 1
    : 1;
  const startDay = Number.isInteger(record.calendarYear?.startDay)
    ? record.calendarYear?.startDay || 1
    : 1;
  const currentYear = new Date().getUTCFullYear();
  const startYear = Number.isInteger(record.calendarYear?.startYear)
    ? record.calendarYear?.startYear || currentYear
    : currentYear;
  const normalizedStartMonth = startMonth >= 1 && startMonth <= 12 ? startMonth : 1;
  const normalizedStartDay = startDay >= 1 && startDay <= 31 ? startDay : 1;
  const normalizedStartYear = startYear >= 1900 && startYear <= 2100 ? startYear : currentYear;
  const fallbackStartDate = `${String(normalizedStartYear).padStart(4, '0')}-${String(normalizedStartMonth).padStart(2, '0')}-${String(normalizedStartDay).padStart(2, '0')}`;
  const parsedStoredStartDate = record.calendarYear?.startDate
    ? tryParseCalendarYearStartDate(record.calendarYear.startDate)
    : null;
  const parsedFallbackStartDate = tryParseCalendarYearStartDate(fallbackStartDate) ||
    tryParseCalendarYearStartDate(`${currentYear}-01-01`);

  return {
    startDate: parsedStoredStartDate?.startDate || parsedFallbackStartDate?.startDate || `${currentYear}-01-01`,
    startDay: parsedStoredStartDate?.startDay || parsedFallbackStartDate?.startDay || 1,
    startMonth: parsedStoredStartDate?.startMonth || parsedFallbackStartDate?.startMonth || 1,
    startYear: parsedStoredStartDate?.startYear || parsedFallbackStartDate?.startYear || currentYear,
    weekOneStartsOn: record.calendarYear?.weekOneStartsOn || 'CALENDAR_YEAR_START'
  };
}

async function uploadCompanyLogo(
  tenantId: string,
  dataUrl: string
): Promise<{ contentType: string; storagePath: string }> {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);

  if (!match) {
    throw validationError('Company logo must be a JPEG, PNG, or WebP image.');
  }

  const contentType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const bytes = Buffer.from(match[2], 'base64');

  if (bytes.length > 1 * 1024 * 1024) {
    throw validationError('Company logo must be smaller than 1 MB.');
  }

  const extension = contentType === 'image/png'
    ? 'png'
    : contentType === 'image/webp'
      ? 'webp'
      : 'jpg';
  const storagePath = `organizations/${tenantId}/company/logo/company-logo.${extension}`;

  await storageBucket.file(storagePath).save(bytes, {
    contentType,
    metadata: {
      cacheControl: 'private, max-age=3600',
      metadata: {
        tenantId
      }
    },
    resumable: false
  });

  return {
    contentType,
    storagePath
  };
}

function getCompanyLogoUrl(storagePath?: string | null, version?: number | null): string | null {
  if (!storagePath) {
    return null;
  }

  return `/api/admin/company-profile/logo?v=${encodeURIComponent(String(version || 1))}`;
}

function buildCompanyLogoCacheKey(tenantId: string, version?: number | null): string {
  return `company-logo-${tenantId}-${version || 1}`;
}

function isMissingStorageBucketError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: number | string }).code
    : undefined;
  const message = getErrorMessage(error);

  return (
    code === 404 &&
    /bucket|storage|not found|does not exist/i.test(message)
  ) || /specified bucket does not exist/i.test(message);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function slugifyCompanyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || `company-${Date.now()}`;
}

function parseCalendarYearStartDate(value: string): {
  startDate: string;
  startDay: number;
  startMonth: number;
  startYear: number;
} {
  const parsed = tryParseCalendarYearStartDate(value);

  if (!parsed) {
    throw validationError('Select a valid company calendar year start date.');
  }

  return parsed;
}

function tryParseCalendarYearStartDate(value: string): {
  startDate: string;
  startDay: number;
  startMonth: number;
  startYear: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);
  const date = new Date(Date.UTC(startYear, startMonth - 1, startDay));

  if (
    date.getUTCFullYear() !== startYear ||
    date.getUTCMonth() !== startMonth - 1 ||
    date.getUTCDate() !== startDay ||
    startYear < 1900 ||
    startYear > 2100
  ) {
    return null;
  }

  return {
    startDate: `${String(startYear).padStart(4, '0')}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
    startDay,
    startMonth,
    startYear
  };
}

function dateLikeToIso(dateLike?: FirebaseDateLike): string | null {
  const milliseconds = dateLike?.toMillis?.() || ((dateLike?.seconds || 0) * 1000);

  if (!milliseconds) {
    return null;
  }

  return new Date(milliseconds).toISOString();
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function conflictError(message: string): Error {
  const error = new Error(message);
  error.name = 'ConflictError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
