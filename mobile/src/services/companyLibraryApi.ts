import { getSynzappApiBaseUrl, normalizeSynzappApiUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

export type CompanyLibraryVisibility = 'private' | 'public';

export interface CompanyLibraryItem {
  contentType: string | null;
  evidenceId: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  fileUrl: string | null;
  label: string;
  libraryScopes: string[];
  note: string;
  sourceArea: string | null;
  sourceId: string | null;
  sourceLabel: string | null;
  /** Poster frame for a video, served by the backend. */
  thumbnailUrl: string | null;
  uploadedAtIso: string | null;
  uploadedByDepartmentName: string | null;
  uploadedByName: string | null;
  uploadedByProfilePhotoUrl: string | null;
  uploadedByRoleName: string | null;
  uploadedByUid: string | null;
  visibility: CompanyLibraryVisibility;
}

interface CompanyLibraryResponse {
  evidence?: CompanyLibraryItem[];
}

export async function listCompanyLibrary(idToken: string): Promise<CompanyLibraryItem[]> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/rails/evidence-library`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...deviceHeaders
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getCompanyLibraryResponseErrorMessage(response));
  }

  const body = await response.json() as CompanyLibraryResponse;

  return (body.evidence || []).map(normalizeCompanyLibraryItem);
}

function normalizeCompanyLibraryItem(item: CompanyLibraryItem): CompanyLibraryItem {
  const sourceArea = typeof item.sourceArea === 'string' ? item.sourceArea.trim() : '';
  const sourceId = typeof item.sourceId === 'string' ? item.sourceId.trim() : '';
  const sourceLabel = typeof item.sourceLabel === 'string' ? item.sourceLabel.trim() : '';

  return {
    contentType: item.contentType || null,
    evidenceId: item.evidenceId,
    fileName: item.fileName || null,
    fileSizeBytes: typeof item.fileSizeBytes === 'number' ? item.fileSizeBytes : null,
    fileUrl: normalizeSynzappApiUrl(item.fileUrl) || null,
    label: item.label || item.fileName || 'Library item',
    libraryScopes: Array.isArray(item.libraryScopes)
      ? item.libraryScopes.filter((scope): scope is string => typeof scope === 'string' && Boolean(scope.trim()))
      : [],
    note: item.note || '',
    sourceArea: sourceArea || null,
    sourceId: sourceId || null,
    sourceLabel: sourceLabel || null,
    thumbnailUrl: normalizeSynzappApiUrl(item.thumbnailUrl) || null,
    uploadedAtIso: item.uploadedAtIso || null,
    uploadedByDepartmentName: item.uploadedByDepartmentName || null,
    uploadedByName: item.uploadedByName || null,
    uploadedByProfilePhotoUrl: item.uploadedByProfilePhotoUrl || null,
    uploadedByRoleName: item.uploadedByRoleName || null,
    uploadedByUid: item.uploadedByUid || null,
    visibility: item.visibility === 'private' ? 'private' : 'public'
  };
}

async function getCompanyLibraryResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string; error?: string };
    return body.message || body.error || `Library could not be loaded (${response.status}).`;
  } catch {
    return `Library could not be loaded (${response.status}).`;
  }
}
