import type { CompanyLibraryItem } from '../../services/companyLibraryApi';
import { CompanyLibraryVideoPreviewContent } from '../../components/companyLibrary/CompanyLibraryPreviews';
import { getCompanyLibraryKind } from '../../services/companyLibraryDisplay';

/**
 * The Library video player.
 *
 * Lifted out of the chat screen unchanged.
 */

/**
 * Full-screen player for a Library video.
 *
 * The file lives behind an authenticated URL, so the same file headers the rest
 * of the Library uses are attached to the video source. Native controls are used
 * rather than a bespoke transport bar - this is a straightforward "tap it and
 * watch it" surface, not the chat media viewer.
 */
export function CompanyLibraryVideoPreviewModal({
  fileHeaders,
  item,
  onClose
}: {
  fileHeaders?: Record<string, string>;
  item: CompanyLibraryItem | null;
  onClose: () => void;
}) {
  if (!item || getCompanyLibraryKind(item) !== 'videos' || !item.fileUrl) {
    return null;
  }

  return (
    <CompanyLibraryVideoPreviewContent
      fileHeaders={fileHeaders}
      item={item}
      onClose={onClose}
    />
  );
}

// Split from the modal above so the player hooks only ever mount for a real
// video. Hooks cannot sit behind the early return in the parent.
