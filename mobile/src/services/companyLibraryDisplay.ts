import type { CompanyLibraryItem } from '../services/companyLibraryApi';
import type { ImageSourcePropType } from 'react-native';

/**
 * How a Company Library item is described and classified for display.
 *
 * Shared by the Library tab, its preview modals and the chat screen, which is
 * why these are a service rather than travelling with any one component.
 */

export type CompanyLibraryKindFilter = 'all' | 'documents' | 'photos' | 'videos' | 'audio' | 'other';

export const companyLibraryDocumentThumbnailSources: Record<string, ImageSourcePropType> = {
  csv: require('../../assets/library/csv-thumnail.png'),
  doc: require('../../assets/library/word-thumnail.png'),
  docm: require('../../assets/library/word-thumnail.png'),
  docx: require('../../assets/library/word-thumnail.png'),
  document: require('../../assets/library/Document-Thumnail.png'),
  json: require('../../assets/library/JSON-Thumnail.png'),
  pdf: require('../../assets/library/pdf-thumnail.png'),
  ppt: require('../../assets/library/PowerPoint-Thumnail.png'),
  pptm: require('../../assets/library/PowerPoint-Thumnail.png'),
  pptx: require('../../assets/library/PowerPoint-Thumnail.png'),
  txt: require('../../assets/library/txt-thumnail.png'),
  xls: require('../../assets/library/Excel-Thumnail.png'),
  xlsb: require('../../assets/library/Excel-Thumnail.png'),
  xlsm: require('../../assets/library/Excel-Thumnail.png'),
  xlsx: require('../../assets/library/Excel-Thumnail.png')
};

export function normalizeCompanyLibraryBucketValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9:]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A readable name for a Library row.
 *
 * Media captured before the native picker stopped reporting its cache file name
 * is stored with the raw PHAsset identifier glued to the front, e.g.
 * "05A54858-939C-4CCE-A006-AE4F6EDA7029-L0-001-GREEN LIGHT TEST.mp4". New
 * uploads no longer carry that prefix, but the already-stored names still do, so
 * strip it for display rather than showing a user an asset identifier.
 */

export function getCompanyLibraryKind(item: CompanyLibraryItem): CompanyLibraryKindFilter {
  const contentType = (item.contentType || '').toLowerCase();
  const extension = getCompanyLibraryExtension(item);

  if (contentType.startsWith('image/') || ['avif', 'gif', 'heic', 'jpeg', 'jpg', 'png', 'webp'].includes(extension)) {
    return 'photos';
  }

  if (
    contentType.startsWith('audio/') ||
    ['aac', 'aif', 'aiff', 'amr', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav', 'weba', 'wma'].includes(extension)
  ) {
    return 'audio';
  }

  if (contentType.startsWith('video/') || ['mov', 'mp4', 'm4v', 'webm'].includes(extension)) {
    return 'videos';
  }

  if (
    contentType.startsWith('application/') ||
    contentType.startsWith('text/') ||
    [
      'csv',
      'doc',
      'docm',
      'docx',
      'json',
      'pdf',
      'ppt',
      'pptm',
      'pptx',
      'rtf',
      'txt',
      'xls',
      'xlsb',
      'xlsm',
      'xlsx'
    ].includes(extension)
  ) {
    return 'documents';
  }

  return 'other';
}

export function getCompanyLibraryExtension(item: CompanyLibraryItem): string {
  const fileName = item.fileName || item.fileUrl || '';
  const cleanFileName = fileName.split('?')[0] || '';
  const match = cleanFileName.match(/\.([a-z0-9]+)$/i);

  return match ? match[1].toLowerCase() : '';
}

/**
 * A readable name for a Library row.
 *
 * Media captured before the native picker stopped reporting its cache file name
 * is stored with the raw PHAsset identifier glued to the front, e.g.
 * "05A54858-939C-4CCE-A006-AE4F6EDA7029-L0-001-GREEN LIGHT TEST.mp4". New
 * uploads no longer carry that prefix, but the already-stored names still do, so
 * strip it for display rather than showing a user an asset identifier.
 */
export function getCompanyLibraryDisplayName(item: CompanyLibraryItem): string {
  const rawName = (item.label || item.fileName || '').trim();

  if (!rawName) {
    return 'Library item';
  }

  const withoutAssetPrefix = rawName.replace(
    /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}(?:-L\d+)?(?:-\d+)?-/,
    ''
  ).trim();

  return withoutAssetPrefix || rawName;
}

export function getCompanyLibraryPhotoSource(
  uri: string,
  fileHeaders?: Record<string, string>
): ImageSourcePropType {
  if (uri.startsWith('data:') || uri.startsWith('file:')) {
    return { uri };
  }

  return fileHeaders
    ? { headers: fileHeaders, uri }
    : { uri };
}

export function formatCompanyLibraryDate(value?: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/** The heading shown for a Library kind filter. */
export function getCompanyLibraryKindLabel(kind: CompanyLibraryKindFilter): string {
  if (kind === 'photos') {
    return 'Photos';
  }

  if (kind === 'videos') {
    return 'Videos';
  }

  if (kind === 'audio') {
    return 'Audio';
  }

  if (kind === 'documents') {
    return 'Documents';
  }

  if (kind === 'other') {
    return 'Other';
  }

  return 'All';
}
