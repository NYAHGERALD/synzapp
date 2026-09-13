import React from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileUp,
  Info,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  Move,
  Pencil,
  Search,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import {
  addRailsEvidenceLibrary,
  deleteRailsEvidenceLibrary,
  downloadRailsEvidenceBlob,
  fileToDataUrl,
  listRailsEvidenceLibrary,
  updateRailsEvidenceLibrary,
  type RailsEvidence,
  type RailsEvidenceInput
} from './railsApi';
import { ImageEvidenceEditor } from './RailsWorkspace';

const TOP_NAV_OFFSET = 56;
const WINDOW_MARGIN = 14;
const DEFAULT_WINDOW_WIDTH = 1040;
const DEFAULT_WINDOW_HEIGHT = 680;
const MIN_WINDOW_WIDTH = 720;
const MIN_WINDOW_HEIGHT = 520;

type EvidenceViewStyle = 'grid' | 'list';
type ResizeEdge = 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface EvidenceLibraryWindowProps {
  currentUserDisplayName?: string | null;
  currentUserProfilePhotoUrl?: string | null;
  currentUserUid?: string | null;
  isOpen: boolean;
  linkedEvidenceIds?: string[];
  onClose: () => void;
  onLinkEvidence?: (evidence: RailsEvidence[]) => void;
  resolveProfilePhotoUrl?: (url: string) => Promise<string>;
  selectionTargetLabel?: string;
  subtitle?: string;
  title?: string;
  users?: EvidenceLibraryUserSummary[];
}

interface EvidenceLibraryUserSummary {
  departmentName?: string | null;
  displayName: string;
  profilePhotoCacheKey?: string | null;
  profilePhotoUrl?: string | null;
  roleName?: string | null;
  uid: string;
}

interface LibraryRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface EvidenceHintState {
  evidenceId: string;
  left: number;
  top: number;
  width: number;
}

interface EvidenceDeleteState {
  evidenceId: string;
  label: string;
}

interface EvidenceContextMenuState {
  evidenceId: string;
  left: number;
  top: number;
}

export function EvidenceLibraryWindow({
  currentUserDisplayName,
  currentUserProfilePhotoUrl,
  currentUserUid,
  isOpen,
  linkedEvidenceIds = [],
  onClose,
  onLinkEvidence,
  resolveProfilePhotoUrl,
  selectionTargetLabel,
  subtitle = 'Upload evidence once. RCA and RAILS workflows can link visible evidence records from this shared library.',
  title = 'Evidence Library',
  users = []
}: EvidenceLibraryWindowProps) {
  const [evidence, setEvidence] = React.useState<RailsEvidence[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewStyle, setViewStyle] = React.useState<EvidenceViewStyle>('grid');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [imageThumbUrls, setImageThumbUrls] = React.useState<Record<string, string>>({});
  const [preview, setPreview] = React.useState<{ fileName?: string; label: string; url: string } | null>(null);
  const [hint, setHint] = React.useState<EvidenceHintState | null>(null);
  const [deleteState, setDeleteState] = React.useState<EvidenceDeleteState | null>(null);
  const [contextMenu, setContextMenu] = React.useState<EvidenceContextMenuState | null>(null);
  const [editorEvidenceId, setEditorEvidenceId] = React.useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = React.useState<Set<string>>(() => new Set());
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [isUploadDragActive, setIsUploadDragActive] = React.useState(false);
  const [isWindowDragActive, setIsWindowDragActive] = React.useState(false);
  /**
   * Depth, not a boolean.
   *
   * dragenter and dragleave fire for every child the pointer crosses, so a flag
   * set on enter is cleared again the moment the cursor moves from the header
   * onto a card. Counting enters against leaves is what survives a window with
   * this many children.
   */
  const windowDragDepthRef = React.useRef(0);
  const [draftFiles, setDraftFiles] = React.useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [fullscreenRect, setFullscreenRect] = React.useState<{ height: number; left: number; top: number; width: number } | null>(null);
  const [rect, setRect] = React.useState<LibraryRect>(() => getInitialWindowRect());
  const [hintUploaderPhotoUrl, setHintUploaderPhotoUrl] = React.useState<string | null>(null);
  const windowRef = React.useRef<HTMLDivElement | null>(null);
  const hintRef = React.useRef<HTMLDivElement | null>(null);
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const usersByUid = React.useMemo(() => {
    const nextUsersByUid = new Map<string, EvidenceLibraryUserSummary>();

    users.forEach((user) => {
      if (user.uid) {
        nextUsersByUid.set(user.uid, user);
      }
    });

    if (currentUserUid && !nextUsersByUid.has(currentUserUid)) {
      nextUsersByUid.set(currentUserUid, {
        departmentName: null,
        displayName: currentUserDisplayName || 'You',
        profilePhotoCacheKey: null,
        profilePhotoUrl: currentUserProfilePhotoUrl || null,
        roleName: null,
        uid: currentUserUid
      });
    }

    return nextUsersByUid;
  }, [currentUserDisplayName, currentUserProfilePhotoUrl, currentUserUid, users]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    void refreshEvidence();
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedEvidenceIds(new Set());
    }
  }, [isOpen, selectionTargetLabel]);

  React.useEffect(() => {
    const objectUrls: string[] = [];
    const activeEvidence = evidence.filter((item) => item.status === 'Attached' && item.fileUrl && isEvidenceImageFile(item));
    let cancelled = false;

    void Promise.all(activeEvidence.map(async (item) => {
      try {
        const blob = await downloadRailsEvidenceBlob(item.fileUrl || '');
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.push(objectUrl);
        return [item.evidenceId, objectUrl] as const;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (cancelled) {
        return;
      }

      const nextThumbUrls = entries.reduce<Record<string, string>>((urls, entry) => {
        if (entry) {
          urls[entry[0]] = entry[1];
        }
        return urls;
      }, {});
      setImageThumbUrls(nextThumbUrls);
    });

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [evidence]);

  React.useEffect(() => {
    if (!hint) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (hintRef.current?.contains(event.target as Node)) {
        return;
      }

      setHint(null);
    }

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
  }, [hint]);

  React.useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setContextMenu(null);
    }

    function handleClose() {
      setContextMenu(null);
    }

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  React.useEffect(() => {
    function handleResize() {
      setRect((currentRect) => clampWindowRect(currentRect));
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function refreshEvidence() {
    try {
      setIsLoading(true);
      setErrorMessage('');
      setEvidence(await listRailsEvidenceLibrary());
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function handleHeaderPointerDown(event: React.PointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (isFullscreen || target.closest('button')) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = rect;

    function handlePointerMove(moveEvent: PointerEvent) {
      setRect(clampWindowRect({
        ...startRect,
        left: startRect.left + moveEvent.clientX - startX,
        top: startRect.top + moveEvent.clientY - startY
      }));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>, edge: ResizeEdge) {
    if (isFullscreen) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = rect;

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const nextRect = { ...startRect };

      if (edge.includes('right')) {
        nextRect.width = startRect.width + deltaX;
      }

      if (edge.includes('left')) {
        nextRect.left = startRect.left + deltaX;
        nextRect.width = startRect.width - deltaX;
      }

      if (edge.includes('bottom')) {
        nextRect.height = startRect.height + deltaY;
      }

      if (edge.includes('top')) {
        nextRect.top = startRect.top + deltaY;
        nextRect.height = startRect.height - deltaY;
      }

      setRect(clampWindowRect(nextRect));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  /**
   * Whether a drag is carrying files, rather than selected text or a link.
   *
   * Without this the whole window lights up when somebody drags a word across
   * it, and the drop does nothing because there was never a file in it.
   */
  function isFileDrag(event: React.DragEvent<HTMLElement>): boolean {
    return Array.from(event.dataTransfer.types || []).includes('Files');
  }

  function handleWindowDragEnter(event: React.DragEvent<HTMLElement>) {
    if (!isFileDrag(event) || isSaving) {
      return;
    }

    event.preventDefault();
    windowDragDepthRef.current += 1;
    setIsWindowDragActive(true);
  }

  function handleWindowDragLeave(event: React.DragEvent<HTMLElement>) {
    if (!isFileDrag(event)) {
      return;
    }

    event.preventDefault();
    windowDragDepthRef.current = Math.max(0, windowDragDepthRef.current - 1);

    if (!windowDragDepthRef.current) {
      setIsWindowDragActive(false);
    }
  }

  /**
   * Dropping anywhere on the library opens the upload panel with the files in it.
   *
   * Somebody dragging a file at a library means to add it there; making them
   * find the upload button first and drop a second time is a step that exists
   * only because of how the screen is built.
   */
  function handleWindowDrop(event: React.DragEvent<HTMLElement>) {
    if (!isFileDrag(event) || isSaving) {
      return;
    }

    event.preventDefault();
    windowDragDepthRef.current = 0;
    setIsWindowDragActive(false);

    if (!event.dataTransfer.files.length) {
      return;
    }

    setIsUploadModalOpen(true);
    handleUploadFiles(event.dataTransfer.files);
  }

  function handleUploadFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) {
      return;
    }

    /**
     * Said here rather than after the upload.
     *
     * The server has the same limit, but reaching it means encoding the file
     * and sending several megabytes first, only to be turned away. Checking the
     * size the browser already knows costs nothing and names the file, which
     * the server's answer cannot do once several were sent together.
     */
    const oversized = nextFiles.filter((file) => file.size > MAX_EVIDENCE_FILE_BYTES);

    if (oversized.length) {
      setErrorMessage(oversized.length === 1
        ? `${oversized[0].name} is ${formatFileSize(oversized[0].size)}. Evidence files must be under ${MAX_EVIDENCE_FILE_LABEL}.`
        : `${oversized.length} files are over ${MAX_EVIDENCE_FILE_LABEL} and were not added.`);
    }

    const acceptedFiles = nextFiles.filter((file) => file.size <= MAX_EVIDENCE_FILE_BYTES);

    if (!acceptedFiles.length) {
      return;
    }

    setDraftFiles((currentFiles) => [...currentFiles, ...acceptedFiles]);
  }

  function handleUploadPaste(event: React.ClipboardEvent<HTMLElement>) {
    const pastedFiles = Array.from(event.clipboardData.files);
    if (!pastedFiles.length) {
      return;
    }

    event.preventDefault();
    handleUploadFiles(pastedFiles);
  }

  async function handleUploadEvidence() {
    if (!draftFiles.length || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setUploadProgress(0);
      setErrorMessage('');

      for (const [index, file] of draftFiles.entries()) {
        setUploadProgress(Math.round((index / draftFiles.length) * 100));
        await addRailsEvidenceLibrary({
          dataUrl: await fileToDataUrl(file),
          fileName: file.name,
          label: file.name,
          status: 'Attached',
          visibility: 'public'
        });
        setUploadProgress(Math.round(((index + 1) / draftFiles.length) * 100));
      }

      setDraftFiles([]);
      setIsUploadModalOpen(false);
      await refreshEvidence();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  }

  async function handleOpenEvidenceFile(item: RailsEvidence) {
    if (!item.fileUrl || isSaving) {
      return;
    }

    try {
      const blob = await downloadRailsEvidenceBlob(item.fileUrl);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  function handleOpenEvidenceContextMenu(event: React.MouseEvent<HTMLElement>, item: RailsEvidence) {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 210;
    const menuHeight = 92;
    setHint(null);
    setContextMenu({
      evidenceId: item.evidenceId,
      left: Math.max(12, Math.min(window.innerWidth - menuWidth - 12, event.clientX)),
      top: Math.max(TOP_NAV_OFFSET + 8, Math.min(window.innerHeight - menuHeight - 12, event.clientY))
    });
  }

  async function handleRenameEvidenceFromEditor(evidenceId: string, draftValue: string): Promise<boolean> {
    if (isSaving) {
      return false;
    }

    const item = evidence.find((entry) => entry.evidenceId === evidenceId);
    if (!item) {
      return false;
    }

    const nextLabel = buildEvidenceLabelWithLockedExtension(item, draftValue);
    const currentLabel = item.label.trim();

    if (!nextLabel) {
      setErrorMessage('Evidence name is required.');
      return false;
    }

    if (nextLabel.toLowerCase() === currentLabel.toLowerCase() || nextLabel === currentLabel) {
      return true;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedEvidence = await updateRailsEvidenceLibrary(evidenceId, {
        evidenceId,
        label: nextLabel,
        note: item.note,
        purpose: item.purpose,
        status: item.status,
        visibility: item.visibility || 'public'
      });
      setEvidence((currentEvidence) => mergeEvidence([updatedEvidence], currentEvidence.filter((entry) => entry.evidenceId !== evidenceId)));
      void refreshEvidence();
      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReplaceEvidenceWithEditedImage(evidenceId: string, dataUrl: string) {
    if (isSaving) {
      return;
    }

    const item = evidence.find((entry) => entry.evidenceId === evidenceId);
    if (!item) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const input: RailsEvidenceInput = {
        dataUrl,
        evidenceId,
        fileName: item.fileName || `${item.label}.png`,
        label: item.label,
        note: item.note,
        purpose: item.purpose,
        status: 'Attached',
        visibility: item.visibility || 'public'
      };
      const updatedEvidence = await updateRailsEvidenceLibrary(evidenceId, input);
      setEvidence((currentEvidence) => mergeEvidence([updatedEvidence], currentEvidence.filter((entry) => entry.evidenceId !== evidenceId)));
      setEditorEvidenceId('');
      void refreshEvidence();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleVisibility(item: RailsEvidence) {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const nextVisibility = item.visibility === 'private' ? 'public' : 'private';
      const updatedEvidence = await updateRailsEvidenceLibrary(item.evidenceId, {
        evidenceId: item.evidenceId,
        label: item.label,
        note: item.note,
        purpose: item.purpose,
        status: item.status,
        visibility: nextVisibility
      });
      setEvidence((currentEvidence) => mergeEvidence([updatedEvidence], currentEvidence.filter((entry) => entry.evidenceId !== item.evidenceId)));
      setHint(null);
      void refreshEvidence();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDeleteEvidence() {
    if (!deleteState || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      await deleteRailsEvidenceLibrary(deleteState.evidenceId);
      setEvidence((currentEvidence) => currentEvidence.filter((entry) => entry.evidenceId !== deleteState.evidenceId));
      setDeleteState(null);
      setHint((currentHint) => currentHint?.evidenceId === deleteState.evidenceId ? null : currentHint);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  React.useLayoutEffect(() => {
    if (!isFullscreen) {
      setFullscreenRect(null);

      return undefined;
    }

    const surface = document.querySelector('[data-workspace-surface="true"]');

    if (!surface) {
      setFullscreenRect(null);

      return undefined;
    }

    const measure = () => {
      const area = surface.getBoundingClientRect();

      setFullscreenRect({
        height: area.height,
        left: area.left,
        top: area.top,
        width: area.width
      });
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(surface);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isFullscreen]);

  const searchText = searchQuery.trim().toLowerCase();
  const filteredEvidence = searchText
    ? evidence.filter((item) => getEvidenceSearchText(item).includes(searchText))
    : evidence;
  const isSelectionMode = Boolean(onLinkEvidence);
  const linkedEvidenceIdSet = React.useMemo(() => new Set(linkedEvidenceIds), [linkedEvidenceIds]);
  const selectedEvidenceItems = evidence.filter((item) => selectedEvidenceIds.has(item.evidenceId) && !linkedEvidenceIdSet.has(item.evidenceId));
  /**
   * Full screen means the workspace surface, measured — not the viewport.
   *
   * Working it out from a nav offset and a margin cannot know where the surface
   * actually is: the side panel collapses, the window resizes, and the app
   * footer sits below the surface. The surface already stops short of all three,
   * so covering exactly it is the whole requirement. The constants stay as a
   * fallback for any workspace that publishes no surface.
   */
  const windowStyle = isFullscreen
    ? fullscreenRect
      ? {
          height: `${fullscreenRect.height}px`,
          left: `${fullscreenRect.left}px`,
          top: `${fullscreenRect.top}px`,
          width: `${fullscreenRect.width}px`
        }
      : {
          height: `calc(100vh - ${TOP_NAV_OFFSET + WINDOW_MARGIN}px)`,
          left: `${WINDOW_MARGIN}px`,
          top: `${TOP_NAV_OFFSET}px`,
          width: `calc(100vw - ${WINDOW_MARGIN * 2}px)`
        }
    : {
        height: `${rect.height}px`,
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`
      };
  const hintEvidence = hint ? evidence.find((item) => item.evidenceId === hint.evidenceId) || null : null;
  const hintUploader = hintEvidence ? resolveEvidenceUploader(hintEvidence, usersByUid, {
    departmentName: null,
    displayName: currentUserDisplayName || 'You',
    profilePhotoCacheKey: null,
    profilePhotoUrl: currentUserProfilePhotoUrl || null,
    roleName: null,
    uid: currentUserUid || ''
  }) : null;
  const canManageHintEvidence = Boolean(currentUserUid && hintEvidence?.uploadedByUid === currentUserUid);
  const contextMenuEvidence = contextMenu ? evidence.find((item) => item.evidenceId === contextMenu.evidenceId) || null : null;
  const editorEvidence = editorEvidenceId ? evidence.find((item) => item.evidenceId === editorEvidenceId) || null : null;
  const editorImageUrl = editorEvidence ? imageThumbUrls[editorEvidence.evidenceId] || '' : '';

  React.useEffect(() => {
    let isMounted = true;
    let objectUrlToRevoke: string | null = null;
    const sourceUrl = hintUploader?.profilePhotoUrl || '';

    if (!sourceUrl) {
      setHintUploaderPhotoUrl(null);
      return undefined;
    }

    if (!resolveProfilePhotoUrl) {
      setHintUploaderPhotoUrl(sourceUrl);
      return undefined;
    }

    void resolveProfilePhotoUrl(sourceUrl).then((resolvedUrl) => {
      objectUrlToRevoke = resolvedUrl;
      if (isMounted) {
        setHintUploaderPhotoUrl(resolvedUrl);
      } else {
        URL.revokeObjectURL(resolvedUrl);
      }
    }).catch(() => {
      if (isMounted) {
        setHintUploaderPhotoUrl(null);
      }
    });

    return () => {
      isMounted = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [hintUploader?.profilePhotoCacheKey, hintUploader?.profilePhotoUrl, resolveProfilePhotoUrl]);

  React.useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return undefined;
    }

    /**
     * Swallows file drops that miss the library.
     *
     * A browser's default for a dropped file is to open it, which navigates away
     * from the workspace and loses everything unsaved in it. Nothing guarded
     * against that before; it mattered less when the app never invited a drag.
     * Now that the library lights up and asks for one, a near miss is likely.
     *
     * The library's own handlers sit below this on the path and have already
     * run, so this only ever catches what they did not.
     */
    function swallowStrayFileDrop(event: DragEvent) {
      if (!Array.from(event.dataTransfer?.types || []).includes('Files')) {
        return;
      }

      event.preventDefault();
    }

    window.addEventListener('dragover', swallowStrayFileDrop);
    window.addEventListener('drop', swallowStrayFileDrop);

    return () => {
      window.removeEventListener('dragover', swallowStrayFileDrop);
      window.removeEventListener('drop', swallowStrayFileDrop);
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <section
        aria-label={title}
        className={`shared-evidence-library-window ${isFullscreen ? 'is-fullscreen' : ''}`}
        onDragEnter={handleWindowDragEnter}
        onDragLeave={handleWindowDragLeave}
        onDragOver={(event) => {
          if (isFileDrag(event)) {
            event.preventDefault();
          }
        }}
        onDrop={handleWindowDrop}
        ref={windowRef}
        style={windowStyle}
      >
        {isWindowDragActive ? (
          <div aria-hidden="true" className="shared-evidence-library-dropveil">
            <span><UploadCloud size={30} /></span>
            <strong>Drop files to add them to the library</strong>
          </div>
        ) : null}
        <header className="shared-evidence-library-header" onPointerDown={handleHeaderPointerDown}>
          <span className="shared-evidence-drag-handle" aria-hidden="true">
            <Move size={15} />
          </span>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
            {isSelectionMode && selectionTargetLabel ? (
              <p className="shared-evidence-link-target">Linking to {selectionTargetLabel}</p>
            ) : null}
          </div>
          <div className="shared-evidence-library-header-actions">
            <button
              aria-label={isFullscreen ? 'Restore evidence library' : 'Maximize evidence library'}
              onClick={() => setIsFullscreen((isOpenFullscreen) => !isOpenFullscreen)}
              title={isFullscreen ? 'Restore' : 'Maximize'}
              type="button"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button aria-label="Close evidence library" onClick={onClose} title="Close" type="button">
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="shared-evidence-library-toolbar">
          <label className="shared-evidence-library-search">
            <Search aria-hidden="true" size={15} />
            <input
              aria-label="Search evidence library"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search evidence by name, upload date, time, or file type"
              type="search"
              value={searchQuery}
            />
            {searchQuery ? (
              <button aria-label="Clear evidence search" onClick={() => setSearchQuery('')} type="button">
                <X aria-hidden="true" size={14} />
              </button>
            ) : null}
          </label>
          <div className="shared-evidence-view-toggle" aria-label="Evidence view style">
            <button
              aria-label="List evidence view"
              aria-pressed={viewStyle === 'list'}
              className={viewStyle === 'list' ? 'is-active' : ''}
              onClick={() => setViewStyle('list')}
              type="button"
            >
              <List aria-hidden="true" size={15} />
            </button>
            <button
              aria-label="Grid evidence view"
              aria-pressed={viewStyle === 'grid'}
              className={viewStyle === 'grid' ? 'is-active' : ''}
              onClick={() => setViewStyle('grid')}
              type="button"
            >
              <LayoutGrid aria-hidden="true" size={15} />
            </button>
          </div>
        </div>

        <div className={`shared-evidence-library-list is-${viewStyle}${isSelectionMode ? ' is-linking' : ''}${filteredEvidence.length ? '' : ' is-empty'}`}>
          {isLoading && !filteredEvidence.length ? (
            <div className="shared-evidence-library-empty">
              <UploadCloud aria-hidden="true" size={22} />
              <span>Loading shared evidence.</span>
            </div>
          ) : null}
          {!isLoading && !filteredEvidence.length ? (
            <div className="shared-evidence-library-empty">
              <Search aria-hidden="true" size={22} />
              <span>{searchQuery ? 'No evidence matches this search.' : 'No shared evidence has been uploaded yet.'}</span>
            </div>
          ) : null}
          {filteredEvidence.map((item) => {
            const imageThumbUrl = imageThumbUrls[item.evidenceId];
            const thumbUrl = getEvidenceThumbnailUrl(item, imageThumbUrl);
            const isImage = Boolean(imageThumbUrl && isEvidenceImageFile(item));
            const visibility = item.visibility === 'private' ? 'private' : 'public';

            return (
              <article
                className={`shared-evidence-library-item is-${visibility} ${
                  isSelectionMode ? 'is-selectable' : ''
                } ${
                  selectedEvidenceIds.has(item.evidenceId) ? 'is-selected' : ''
                } ${
                  linkedEvidenceIdSet.has(item.evidenceId) ? 'is-linked' : ''
                }`}
                key={item.evidenceId}
                onContextMenu={(event) => handleOpenEvidenceContextMenu(event, item)}
              >
                {isSelectionMode ? (
                  <button
                    aria-label={linkedEvidenceIdSet.has(item.evidenceId) ? `${item.label} is already attached` : `Select ${item.label}`}
                    aria-pressed={selectedEvidenceIds.has(item.evidenceId)}
                    className="shared-evidence-library-select-button"
                    disabled={linkedEvidenceIdSet.has(item.evidenceId)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedEvidenceIds((currentIds) => {
                        const nextIds = new Set(currentIds);

                        if (nextIds.has(item.evidenceId)) {
                          nextIds.delete(item.evidenceId);
                        } else {
                          nextIds.add(item.evidenceId);
                        }

                        return nextIds;
                      });
                    }}
                    title={linkedEvidenceIdSet.has(item.evidenceId) ? 'Already attached to this node' : 'Select evidence'}
                    type="button"
                  >
                    {linkedEvidenceIdSet.has(item.evidenceId) || selectedEvidenceIds.has(item.evidenceId) ? (
                      <CheckCircle2 aria-hidden="true" size={15} />
                    ) : null}
                  </button>
                ) : null}
                <button
                  aria-label={`Show ${item.label} details`}
                  className="shared-evidence-library-hint-button"
                  onClick={(event) => {
                    const buttonRect = event.currentTarget.getBoundingClientRect();
                    const width = Math.min(360, Math.max(300, window.innerWidth - 24));
                    const left = Math.max(12, Math.min(window.innerWidth - width - 12, buttonRect.left));
                    const preferredHeight = 360;
                    const belowTop = buttonRect.bottom + 8;
                    const top = belowTop + preferredHeight < window.innerHeight
                      ? belowTop
                      : Math.max(TOP_NAV_OFFSET + 8, buttonRect.top - preferredHeight - 8);

                    setHint((currentHint) => currentHint?.evidenceId === item.evidenceId ? null : {
                      evidenceId: item.evidenceId,
                      left,
                      top,
                      width
                    });
                  }}
                  type="button"
                >
                  <Info aria-hidden="true" size={13} />
                </button>
                <button
                  aria-label={`Open ${item.label}`}
                  className="shared-evidence-library-thumb-button"
                  onClick={() => {
                    if (isImage) {
                      setPreview({ fileName: item.fileName || undefined, label: item.label, url: thumbUrl });
                      return;
                    }

                    void handleOpenEvidenceFile(item);
                  }}
                  type="button"
                >
                  <img alt="" src={thumbUrl} />
                </button>
                <div className="shared-evidence-library-main">
                  <span>Evidence label</span>
                  <button
                    aria-label={`Open ${item.label}`}
                    onClick={() => {
                      if (isImage) {
                        setPreview({ fileName: item.fileName || undefined, label: item.label, url: thumbUrl });
                        return;
                      }

                      void handleOpenEvidenceFile(item);
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                  {shouldShowEvidenceFileName(item.label, item.fileName) ? <small>{item.fileName}</small> : null}
                </div>
                <span className={`shared-evidence-library-visibility is-${visibility}`}>
                  {linkedEvidenceIdSet.has(item.evidenceId) ? 'attached' : visibility}
                </span>
              </article>
            );
          })}
        </div>

        {isSelectionMode ? (
          <div className="shared-evidence-link-footer">
            <span>
              {selectedEvidenceItems.length
                ? `${selectedEvidenceItems.length} selected`
                : 'Select one or more evidence records'}
            </span>
            <button
              disabled={!selectedEvidenceItems.length || isSaving}
              onClick={() => onLinkEvidence?.(selectedEvidenceItems)}
              type="button"
            >
              Add to node
            </button>
          </div>
        ) : null}

        {/*
          * Shown while linking too. Somebody attaching evidence to a node is
          * exactly the person most likely to find the file is not in here yet,
          * and hiding the button sent them out of the flow to add it.
          * Lifted clear of the link footer, which draws above it.
          */}
        <button
          aria-label="Upload evidence"
          className={`shared-evidence-library-upload-fab ${isSelectionMode ? 'is-above-footer' : ''}`}
          disabled={isSaving}
          onClick={() => setIsUploadModalOpen(true)}
          type="button"
        >
          <UploadCloud aria-hidden="true" size={21} />
        </button>

        {!isFullscreen ? (
          <>
            {(['top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as ResizeEdge[]).map((edge) => (
              <div
                aria-hidden="true"
                className={`shared-evidence-resize-handle is-${edge}`}
                key={edge}
                onPointerDown={(event) => handleResizePointerDown(event, edge)}
              />
            ))}
          </>
        ) : null}
      </section>

      {hint && hintEvidence ? (
        <div
          className="shared-evidence-hint-popover"
          ref={hintRef}
          style={{ left: `${hint.left}px`, top: `${hint.top}px`, width: `${hint.width}px` }}
        >
          <header>
            <div>
              <h3>Evidence details</h3>
              <p>{hintEvidence.label}</p>
            </div>
            <span className={`shared-evidence-hint-visibility-pill is-${hintEvidence.visibility === 'private' ? 'private' : 'public'}`}>
              {hintEvidence.visibility === 'private' ? 'Private' : 'Public'}
            </span>
          </header>
          <div className="shared-evidence-hint-uploader">
            {hintUploaderPhotoUrl ? (
              <img alt="" src={hintUploaderPhotoUrl} />
            ) : (
              <span>{getInitials(hintUploader?.displayName || 'User')}</span>
            )}
            <div>
              <strong>{hintUploader?.displayName || 'Synzapp user'}</strong>
              {hintUploader?.roleName || hintUploader?.departmentName ? (
                <em>{[hintUploader?.roleName, hintUploader?.departmentName].filter(Boolean).join(', ')}</em>
              ) : null}
              <small>{hintEvidence.uploadedAtIso ? formatDateTimeStamp(hintEvidence.uploadedAtIso) : 'Upload date unavailable'}</small>
            </div>
          </div>
          <dl>
            <div>
              <dt>File name</dt>
              <dd>{hintEvidence.fileName || hintEvidence.label}</dd>
            </div>
            <div>
              <dt>File type</dt>
              <dd>{hintEvidence.contentType || inferEvidenceTypeLabel(hintEvidence.fileName)}</dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>{formatFileSize(hintEvidence.fileSizeBytes)}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{hintEvidence.visibility === 'private' ? 'Private to records owned by the uploader.' : 'Available for RCA and RAILS evidence linking.'}</dd>
            </div>
          </dl>
          <button
            className={`shared-evidence-visibility-switch is-${hintEvidence.visibility === 'private' ? 'private' : 'public'}`}
            disabled={!canManageHintEvidence || isSaving}
            onClick={() => {
              if (canManageHintEvidence) {
                void handleToggleVisibility(hintEvidence);
              }
            }}
            title={canManageHintEvidence ? 'Change evidence visibility' : 'Only the uploader can change evidence visibility'}
            type="button"
          >
            {hintEvidence.visibility === 'private' ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
            <span>{hintEvidence.visibility === 'private' ? 'Private visibility' : 'Public visibility'}</span>
            <i aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {contextMenu && contextMenuEvidence ? (
        <div
          className="shared-evidence-context-menu"
          ref={contextMenuRef}
          style={{ left: `${contextMenu.left}px`, top: `${contextMenu.top}px` }}
        >
          <button
            disabled={!isEvidenceImageFile(contextMenuEvidence) || !imageThumbUrls[contextMenuEvidence.evidenceId] || isSaving}
            onClick={() => {
              setEditorEvidenceId(contextMenuEvidence.evidenceId);
              setContextMenu(null);
            }}
            type="button"
          >
            <Pencil aria-hidden="true" size={14} />
            Edit evidence
          </button>
          <button
            className="is-danger"
            disabled={!currentUserUid || contextMenuEvidence.uploadedByUid !== currentUserUid || isSaving}
            onClick={() => {
              setDeleteState({ evidenceId: contextMenuEvidence.evidenceId, label: contextMenuEvidence.label });
              setContextMenu(null);
            }}
            title={currentUserUid && contextMenuEvidence.uploadedByUid === currentUserUid ? 'Delete evidence' : 'Only the uploader can delete this evidence'}
            type="button"
          >
            <Trash2 aria-hidden="true" size={14} />
            Delete evidence
          </button>
        </div>
      ) : null}

      {editorEvidence && editorImageUrl ? (
        <ImageEvidenceEditor
          disabled={isSaving}
          evidence={editorEvidence}
          imageUrl={editorImageUrl}
          onClose={() => setEditorEvidenceId('')}
          onRename={(nextLabel) => handleRenameEvidenceFromEditor(editorEvidence.evidenceId, nextLabel)}
          onSave={(dataUrl) => void handleReplaceEvidenceWithEditedImage(editorEvidence.evidenceId, dataUrl)}
        />
      ) : null}

      {preview ? (
        <div className="shared-evidence-preview-overlay" role="dialog" aria-modal="true" aria-label={preview.label}>
          <button aria-label="Close evidence preview" onClick={() => setPreview(null)} type="button">
            <X aria-hidden="true" size={18} />
          </button>
          <figure>
            <img alt={preview.label} src={preview.url} />
            <figcaption>{preview.fileName || preview.label}</figcaption>
          </figure>
        </div>
      ) : null}

      {isUploadModalOpen ? (
        <div className="shared-evidence-upload-overlay" role="dialog" aria-modal="true" aria-label="Upload evidence">
          <section className="shared-evidence-upload-card" onPaste={handleUploadPaste}>
            <header>
              <div>
                <span>Shared Evidence Library</span>
                <h2>Upload evidence</h2>
                <p>Drag files here, paste from the clipboard, or choose files from this device.</p>
              </div>
              <button
                aria-label="Close evidence upload"
                disabled={isSaving}
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setDraftFiles([]);
                }}
                type="button"
              >
                <X aria-hidden="true" size={17} />
              </button>
            </header>
            <button
              className={`shared-evidence-upload-dropzone ${isUploadDragActive ? 'is-dragging' : ''}`}
              onClick={() => uploadInputRef.current?.click()}
              onDragEnter={(event) => {
                if (isFileDrag(event)) {
                  event.preventDefault();
                  setIsUploadDragActive(true);
                }
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) {
                  setIsUploadDragActive(false);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setIsUploadDragActive(false);
                handleUploadFiles(event.dataTransfer.files);
              }}
              type="button"
            >
              <input
                multiple
                onChange={(event) => {
                  if (event.target.files) {
                    handleUploadFiles(event.target.files);
                    event.target.value = '';
                  }
                }}
                ref={uploadInputRef}
                type="file"
              />
              <span><FileUp aria-hidden="true" size={24} /></span>
              <strong>Drop, paste, or choose files</strong>
              <small>Files are stored in the shared evidence library and start as public evidence.</small>
            </button>
            {draftFiles.length ? (
              <div className="shared-evidence-upload-files">
                {draftFiles.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`}>
                    <span>{file.name}</span>
                    <small>{formatFileSize(file.size)}</small>
                    <button
                      aria-label={`Remove ${file.name}`}
                      disabled={isSaving}
                      onClick={() => setDraftFiles((currentFiles) => currentFiles.filter((_, fileIndex) => fileIndex !== index))}
                      type="button"
                    >
                      <X aria-hidden="true" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <footer>
              <button disabled={isSaving} onClick={() => setDraftFiles([])} type="button">Clear</button>
              <button disabled={!draftFiles.length || isSaving} onClick={() => void handleUploadEvidence()} type="button">
                {isSaving ? 'Uploading' : 'Upload'}
              </button>
            </footer>
            {isSaving ? (
              <div className="shared-evidence-upload-progress" aria-live="polite">
                <div>
                  <UploadCloud aria-hidden="true" size={24} />
                  <strong>Uploading evidence</strong>
                  <span>{uploadProgress}%</span>
                  <i><b style={{ width: `${uploadProgress}%` }} /></i>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {deleteState ? (
        <div className="shared-evidence-delete-overlay" role="dialog" aria-modal="true" aria-label="Delete evidence">
          <section>
            <span><AlertTriangle aria-hidden="true" size={22} /></span>
            <div>
              <p>Controlled delete</p>
              <h2>Delete this evidence?</h2>
              <p>
                This will delete "{deleteState.label}" from the shared Evidence Library and unlink it from every RCA or RAILS record that uses it.
              </p>
            </div>
            <footer>
              <button disabled={isSaving} onClick={() => setDeleteState(null)} type="button">Keep evidence</button>
              <button disabled={isSaving} onClick={() => void handleConfirmDeleteEvidence()} type="button">
                {isSaving ? 'Deleting' : 'Delete evidence'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="shared-evidence-error-overlay" role="alertdialog" aria-modal="true" aria-label="Evidence library error">
          <section>
            <span><AlertTriangle aria-hidden="true" size={22} /></span>
            <div>
              <p>Evidence Library needs attention</p>
              <h2>Action needs attention</h2>
              <p>{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage('')} type="button">Close</button>
          </section>
        </div>
      ) : null}
    </>,
    document.body
  );
}

function getInitialWindowRect(): LibraryRect {
  if (typeof window === 'undefined') {
    return {
      height: DEFAULT_WINDOW_HEIGHT,
      left: 64,
      top: TOP_NAV_OFFSET + 24,
      width: DEFAULT_WINDOW_WIDTH
    };
  }

  const width = Math.min(DEFAULT_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, window.innerWidth - 72));
  const height = Math.min(DEFAULT_WINDOW_HEIGHT, Math.max(MIN_WINDOW_HEIGHT, window.innerHeight - TOP_NAV_OFFSET - 48));

  return {
    height,
    left: Math.max(WINDOW_MARGIN, Math.round((window.innerWidth - width) / 2)),
    top: TOP_NAV_OFFSET + 24,
    width
  };
}

function clampWindowRect(rect: LibraryRect): LibraryRect {
  if (typeof window === 'undefined') {
    return rect;
  }

  const maxWidth = window.innerWidth - WINDOW_MARGIN * 2;
  const maxHeight = window.innerHeight - TOP_NAV_OFFSET - WINDOW_MARGIN;
  const width = Math.min(maxWidth, Math.max(Math.min(MIN_WINDOW_WIDTH, maxWidth), rect.width));
  const height = Math.min(maxHeight, Math.max(Math.min(MIN_WINDOW_HEIGHT, maxHeight), rect.height));
  const left = Math.min(window.innerWidth - width - WINDOW_MARGIN, Math.max(WINDOW_MARGIN, rect.left));
  const top = Math.min(window.innerHeight - height - WINDOW_MARGIN, Math.max(TOP_NAV_OFFSET, rect.top));

  return { height, left, top, width };
}

function mergeEvidence(primaryEvidence: RailsEvidence[], secondaryEvidence: RailsEvidence[]): RailsEvidence[] {
  const evidenceById = new Map<string, RailsEvidence>();

  [...primaryEvidence, ...secondaryEvidence].forEach((item) => {
    if (!evidenceById.has(item.evidenceId)) {
      evidenceById.set(item.evidenceId, item);
    }
  });

  return Array.from(evidenceById.values()).sort((leftItem, rightItem) => (
    new Date(rightItem.uploadedAtIso || 0).getTime() - new Date(leftItem.uploadedAtIso || 0).getTime()
  ));
}

function resolveEvidenceUploader(
  evidence: RailsEvidence,
  usersByUid: Map<string, EvidenceLibraryUserSummary>,
  currentUser: EvidenceLibraryUserSummary
): EvidenceLibraryUserSummary {
  if (evidence.uploadedByUid && usersByUid.has(evidence.uploadedByUid)) {
    const knownUser = usersByUid.get(evidence.uploadedByUid) as EvidenceLibraryUserSummary;

    return {
      departmentName: knownUser.departmentName || evidence.uploadedByDepartmentName || null,
      displayName: knownUser.displayName || evidence.uploadedByName || 'Synzapp user',
      profilePhotoCacheKey: knownUser.profilePhotoCacheKey || evidence.uploadedByProfilePhotoCacheKey || null,
      profilePhotoUrl: knownUser.profilePhotoUrl || evidence.uploadedByProfilePhotoUrl || null,
      roleName: knownUser.roleName || evidence.uploadedByRoleName || null,
      uid: knownUser.uid
    };
  }

  if (evidence.uploadedByUid && currentUser.uid && evidence.uploadedByUid === currentUser.uid) {
    return {
      departmentName: currentUser.departmentName || evidence.uploadedByDepartmentName || null,
      displayName: currentUser.displayName || evidence.uploadedByName || 'You',
      profilePhotoCacheKey: currentUser.profilePhotoCacheKey || evidence.uploadedByProfilePhotoCacheKey || null,
      profilePhotoUrl: currentUser.profilePhotoUrl || evidence.uploadedByProfilePhotoUrl || null,
      roleName: currentUser.roleName || evidence.uploadedByRoleName || null,
      uid: currentUser.uid
    };
  }

  if (evidence.uploadedByName || evidence.uploadedByProfilePhotoUrl) {
    return {
      departmentName: evidence.uploadedByDepartmentName || null,
      displayName: evidence.uploadedByName || 'Synzapp user',
      profilePhotoCacheKey: evidence.uploadedByProfilePhotoCacheKey || null,
      profilePhotoUrl: evidence.uploadedByProfilePhotoUrl || null,
      roleName: evidence.uploadedByRoleName || null,
      uid: evidence.uploadedByUid || 'unknown'
    };
  }

  return {
    departmentName: null,
    displayName: 'Synzapp user',
    profilePhotoCacheKey: null,
    profilePhotoUrl: null,
    roleName: null,
    uid: evidence.uploadedByUid || 'unknown'
  };
}

function getEvidenceSearchText(evidence: RailsEvidence): string {
  return [
    evidence.label,
    evidence.fileName,
    evidence.contentType,
    inferEvidenceTypeLabel(evidence.fileName),
    evidence.visibility || 'public',
    evidence.uploadedAtIso ? formatDateTimeStamp(evidence.uploadedAtIso) : '',
    evidence.uploadedAtIso ? new Date(evidence.uploadedAtIso).toLocaleDateString() : '',
    evidence.uploadedAtIso ? new Date(evidence.uploadedAtIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const evidenceImageExtensions = new Set(['avif', 'bmp', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'tif', 'tiff', 'webp']);

function isEvidenceImageFile(evidence: Pick<RailsEvidence, 'contentType' | 'fileName'>): boolean {
  const contentType = (evidence.contentType || '').toLowerCase();
  const extension = getEvidenceExtension(evidence.fileName);

  return contentType.startsWith('image/') || evidenceImageExtensions.has(extension);
}

function getEvidenceThumbnailUrl(evidence: Pick<RailsEvidence, 'contentType' | 'fileName'>, imageThumbUrl?: string): string {
  if (imageThumbUrl && isEvidenceImageFile(evidence)) {
    return imageThumbUrl;
  }

  const contentType = (evidence.contentType || '').toLowerCase();
  const extension = getEvidenceExtension(evidence.fileName);

  if (contentType.includes('pdf') || extension === 'pdf') {
    return '/assets/pdf-thumnail.png';
  }

  if (contentType.includes('spreadsheet') || contentType.includes('excel') || ['xls', 'xlsx', 'xlsm', 'xlsb'].includes(extension)) {
    return '/assets/Excel-Thumnail.png';
  }

  if (contentType.includes('word') || ['doc', 'docx', 'docm'].includes(extension)) {
    return '/assets/word-thumnail.png';
  }

  if (contentType.includes('presentation') || contentType.includes('powerpoint') || ['ppt', 'pptx', 'pptm'].includes(extension)) {
    return '/assets/PowerPoint-Thumnail.png';
  }

  if (contentType.includes('csv') || extension === 'csv') {
    return '/assets/csv-thumnail.png';
  }

  if (contentType.includes('json') || extension === 'json') {
    return '/assets/JSON-Thumnail.png';
  }

  if (contentType.startsWith('text/') || extension === 'txt') {
    return '/assets/txt-thumnail.png';
  }

  return '/assets/Document-Thumnail.png';
}

function getEvidenceExtension(fileName?: string | null): string {
  return (fileName || '').split('.').pop()?.toLowerCase() || '';
}

function getEvidenceFileExtension(evidence: Pick<RailsEvidence, 'fileName' | 'label'>): string {
  const sourceName = (evidence.fileName || evidence.label || '').trim();
  const extensionMatch = sourceName.match(/(\.[A-Za-z0-9]{1,12})$/);

  return extensionMatch?.[1] || '';
}

function buildEvidenceLabelWithLockedExtension(evidence: Pick<RailsEvidence, 'fileName' | 'label'>, draftValue: string): string {
  const extension = getEvidenceFileExtension(evidence);
  const normalizedBaseName = draftValue.replace(/\s+/g, ' ').trim();

  if (!normalizedBaseName) {
    return '';
  }

  return extension ? `${normalizedBaseName.replace(new RegExp(`\\${extension}$`, 'i'), '')}${extension}` : normalizedBaseName;
}

function shouldShowEvidenceFileName(label: string, fileName?: string | null): boolean {
  const safeFileName = fileName?.trim();

  return Boolean(safeFileName && safeFileName.toLowerCase() !== label.trim().toLowerCase());
}

/**
 * The same ceiling rcaService and railsService enforce.
 *
 * Kept in step with MAX_RCA_EVIDENCE_BYTES and MAX_RAILS_EVIDENCE_BYTES. It is
 * the raw file size, not what it costs encoded — the body limit is set to cover
 * the base64 expansion so this number is the one people actually meet.
 */
const MAX_EVIDENCE_FILE_BYTES = 4 * 1024 * 1024;
const MAX_EVIDENCE_FILE_LABEL = '4 MB';

function formatFileSize(sizeBytes?: number | null): string {
  if (!sizeBytes || sizeBytes <= 0) {
    return 'Size unavailable';
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTimeStamp(dateIso: string): string {
  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function inferEvidenceTypeLabel(fileName?: string | null): string {
  if (!fileName) {
    return 'File type unavailable';
  }

  const extension = fileName.split('.').pop()?.toUpperCase();
  return extension ? `${extension} file` : 'File';
}

function getInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
