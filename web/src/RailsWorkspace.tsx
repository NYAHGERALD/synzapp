import React from 'react';
import { createPortal } from 'react-dom';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  CircleHelp,
  ClipboardList,
  Clock3,
  Crop,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileCheck2,
  Filter,
  Info,
  LayoutGrid,
  Link2,
  List,
  Maximize2,
  MessageSquareText,
  Minus,
  Move,
  Network,
  Paperclip,
  PanelLeftClose,
  PanelRightClose,
  Pin,
  Plus,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingUp,
  Type,
  UserRoundCheck,
  Trash2,
  UploadCloud,
  UsersRound,
  X
} from 'lucide-react';
import 'react-day-picker/style.css';
import { useAppLoading } from './appLoading';
import {
  addRailsAction,
  addRailsCollaborator,
  addRailsComment,
  addRailsEvidence,
  askRailsKnowledge,
  bulkUpdateRailsItems,
  createRailsItem,
  deleteRailsAction,
  deleteRailsEvidence,
  downloadRailsEvidenceBlob,
  exportRailsCsv,
  exportRailsJson,
  fileToDataUrl,
  getRailsAuthenticatedObjectUrl,
  getRailsHistory,
  getRailsItemActivity,
  getRailsReport,
  getRailsWorkspace,
  listRailsLswCandidates,
  listRailsRcaCandidates,
  removeRailsCollaborator,
  reorderRailsAction,
  requestRailsRcaTriage,
  updateRailsRcaTriageRequest,
  convertRailsRcaTriageToIncident,
  updateRailsAction,
  updateRailsItem,
  type RailsAction,
  type RailsAuditActivity,
  type RailsCategory,
  type RailsItem,
  type RailsKnowledgeAnswer,
  type RailsLswSourceCandidate,
  type RailsReportResponse,
  type RailsPriority,
  type RailsRcaLinkCandidate,
  type RailsStandardizationType,
  type RailsStatus,
  type RailsUserSummary,
  type RailsWorkspaceContext
} from './railsApi';

const railsStatuses: RailsStatus[] = ['New', 'Triaged', 'Reopened', 'In Progress', 'Verification', 'Approved', 'Closed'];
const railsStandardizationTypes: RailsStandardizationType[] = ['SOP', 'Checklist', 'LSW Audit', 'Training', 'PM Task', 'Visual Control', 'Work Instruction', 'Other'];
const railsStageFilters: Array<{
  Icon: typeof ClipboardList;
  description: string;
  label: string;
  status: RailsStatus | 'All';
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}> = [
  { Icon: BarChart3, description: 'Every active workflow lane', label: 'All stages', status: 'All', tone: 'slate' },
  { Icon: ClipboardList, description: 'Intake captured, triage pending', label: 'New', status: 'New', tone: 'blue' },
  { Icon: CircleDot, description: 'Owner, RCA link, and requirements confirmed', label: 'Triaged', status: 'Triaged', tone: 'blue' },
  { Icon: RefreshCw, description: 'Returned from closure for controlled follow-up', label: 'Reopened', status: 'Reopened', tone: 'amber' },
  { Icon: TrendingUp, description: 'Action plan moving with progress updates', label: 'In Progress', status: 'In Progress', tone: 'amber' },
  { Icon: BadgeCheck, description: 'Evidence and results under verification', label: 'Verification', status: 'Verification', tone: 'green' },
  { Icon: ShieldCheck, description: 'Approved for controlled closure', label: 'Approved', status: 'Approved', tone: 'green' },
  { Icon: FileCheck2, description: 'Completed and retained in audit history', label: 'Closed', status: 'Closed', tone: 'slate' }
];
type RailsActionStatus = 'Open' | 'In Progress' | 'Blocked' | 'Done';
type RailsDetailPage = 'overview' | 'actions' | 'verification' | 'standardization' | 'closure';
type RailsDetailPanelTab = 'details' | 'evidence' | 'log';
type RailsLeftPanelMode = 'controls' | 'filters' | 'assistant';
type RailsPanelKind = 'left' | 'right';
type RailsPanelResizeEdge = 'bottom' | 'left' | 'right';
type RailsWorkspaceView = 'board' | 'report' | 'history';
interface RailsDetailReadinessTask {
  complete: boolean;
  key: string;
  label: string;
}

interface RailsAssistantMessage {
  answerSource?: RailsKnowledgeAnswer['source'];
  body: string;
  createdAtIso: string;
  id: string;
  role: 'assistant' | 'user';
}

interface RailsActionContextMenuState {
  actionId: string;
  left: number;
  top: number;
}

interface RailsEvidenceContextMenuState {
  evidenceId: string;
  left: number;
  top: number;
}

interface RailsEvidenceLinkWarningState {
  actionId: string;
  evidenceId: string;
  left: number;
  top: number;
  width: number;
}

interface RailsEvidenceHintState {
  evidenceId: string;
  left: number;
  top: number;
  width: number;
}
const RAILS_LEFT_PANEL_DEFAULT_WIDTH = 280;
const RAILS_RIGHT_PANEL_DEFAULT_WIDTH = 520;
const RAILS_PANEL_TOP_LIMIT = 60;
const RAILS_PANEL_VIEWPORT_MARGIN = 8;
const RAILS_PANEL_MIN_HEIGHT = 260;
const railsDetailPages: Array<{
  key: RailsDetailPage;
  label: string;
}> = [
  { key: 'overview', label: 'Overview' },
  { key: 'actions', label: 'Actions' },
  { key: 'verification', label: 'Verify' },
  { key: 'standardization', label: 'Standardize' },
  { key: 'closure', label: 'Close' }
];

interface RailsPanelState {
  detached: boolean;
  height: number;
  open: boolean;
  width: number;
  x: number;
  y: number;
}

const priorityRank: Record<RailsPriority, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1
};

export function RailsWorkspace() {
  const appLoading = useAppLoading();
  const [items, setItems] = React.useState<RailsItem[]>([]);
  const [candidates, setCandidates] = React.useState<RailsUserSummary[]>([]);
  const [rcaCandidates, setRcaCandidates] = React.useState<RailsRcaLinkCandidate[]>([]);
  const [lswCandidates, setLswCandidates] = React.useState<RailsLswSourceCandidate[]>([]);
  const [context, setContext] = React.useState<RailsWorkspaceContext | null>(null);
  const [activeItemId, setActiveItemId] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'All' | RailsPriority | 'Overdue'>('All');
  const [isStageFilterPanelActive, setIsStageFilterPanelActive] = React.useState(false);
  const [leftPanelMode, setLeftPanelMode] = React.useState<RailsLeftPanelMode>('controls');
  const [activeStageFilter, setActiveStageFilter] = React.useState<RailsStatus | 'All'>('All');
  const [boardNameFilter, setBoardNameFilter] = React.useState('');
  const [boardDateFilter, setBoardDateFilter] = React.useState('');
  const [boardPriorityFilter, setBoardPriorityFilter] = React.useState<RailsPriority | 'All'>('All');
  const [boardStatusFilter, setBoardStatusFilter] = React.useState<RailsStatus | 'All'>('All');
  const [workspaceView, setWorkspaceView] = React.useState<RailsWorkspaceView>('board');
  const [railsReport, setRailsReport] = React.useState<RailsReportResponse | null>(null);
  const [historyItems, setHistoryItems] = React.useState<RailsItem[]>([]);
  const [historySearch, setHistorySearch] = React.useState('');
  const [historyStatus, setHistoryStatus] = React.useState<RailsStatus | 'All'>('All');
  const [selectedHistoryItemIds, setSelectedHistoryItemIds] = React.useState<string[]>([]);
  const [bulkOwnerUid, setBulkOwnerUid] = React.useState('');
  const [bulkPriority, setBulkPriority] = React.useState<RailsPriority | ''>('');
  const [bulkCategory, setBulkCategory] = React.useState<RailsCategory | ''>('');
  const [bulkCollaboratorUid, setBulkCollaboratorUid] = React.useState('');
  const [bulkDueDate, setBulkDueDate] = React.useState('');
  const [bulkArchiveReason, setBulkArchiveReason] = React.useState('');
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);
  const [isReportLoading, setIsReportLoading] = React.useState(false);
  const [isAssistantResponding, setIsAssistantResponding] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState('');
  const [draftOwnerUid, setDraftOwnerUid] = React.useState('');
  const [draftActionTitle, setDraftActionTitle] = React.useState('');
  const [draftCollaboratorUid, setDraftCollaboratorUid] = React.useState('');
  const [draftComment, setDraftComment] = React.useState('');
  const [draftAssistantQuestion, setDraftAssistantQuestion] = React.useState('');
  const [draftEvidenceLabel, setDraftEvidenceLabel] = React.useState('');
  const [draftEvidenceFiles, setDraftEvidenceFiles] = React.useState<File[]>([]);
  const [evidenceViewStyle, setEvidenceViewStyle] = React.useState<'list' | 'grid'>('grid');
  const [evidenceSearch, setEvidenceSearch] = React.useState('');
  const [expandedRequiredEvidenceIds, setExpandedRequiredEvidenceIds] = React.useState<Set<string>>(() => new Set());
  const [isEvidenceUploadModalOpen, setIsEvidenceUploadModalOpen] = React.useState(false);
  const [isEvidenceUploading, setIsEvidenceUploading] = React.useState(false);
  const [evidenceUploadProgress, setEvidenceUploadProgress] = React.useState(0);
  const [isEvidenceDragActive, setIsEvidenceDragActive] = React.useState(false);
  const [standardizationDocumentFile, setStandardizationDocumentFile] = React.useState<File | null>(null);
  const [isStandardizationDocumentDragActive, setIsStandardizationDocumentDragActive] = React.useState(false);
  const [draftLifecycleReason, setDraftLifecycleReason] = React.useState('');
  const [standardizationDraft, setStandardizationDraft] = React.useState({
    target: '',
    verification: ''
  });
  const [detailPanelTab, setDetailPanelTab] = React.useState<RailsDetailPanelTab>('details');
  const [activeDetailPage, setActiveDetailPage] = React.useState<RailsDetailPage>('overview');
  const [activeActionRecordId, setActiveActionRecordId] = React.useState('');
  const [actionContextMenu, setActionContextMenu] = React.useState<RailsActionContextMenuState | null>(null);
  const [evidenceContextMenu, setEvidenceContextMenu] = React.useState<RailsEvidenceContextMenuState | null>(null);
  const [actionPendingDeleteId, setActionPendingDeleteId] = React.useState('');
  const [evidencePendingDeleteId, setEvidencePendingDeleteId] = React.useState('');
  const [evidenceLinkWarning, setEvidenceLinkWarning] = React.useState<RailsEvidenceLinkWarningState | null>(null);
  const [evidenceHint, setEvidenceHint] = React.useState<RailsEvidenceHintState | null>(null);
  const [evidenceEditorId, setEvidenceEditorId] = React.useState('');
  const [isCollaboratorMenuOpen, setIsCollaboratorMenuOpen] = React.useState(false);
  const [boardCollaboratorsPopover, setBoardCollaboratorsPopover] = React.useState<{
    itemId: string;
    left: number;
    maxListHeight: number;
    top: number;
    width: number;
  } | null>(null);
  const [boardHintPopover, setBoardHintPopover] = React.useState<{
    itemId: string;
    left: number;
    maxHeight: number;
    top: number;
    width: number;
  } | null>(null);
  const [activeActivity, setActiveActivity] = React.useState<RailsAuditActivity[]>([]);
  const [assistantMessages, setAssistantMessages] = React.useState<RailsAssistantMessage[]>(() => [
    {
      answerSource: 'SYSTEM_GUIDE',
      body: 'Ask me anything about this RAILS workspace. I can explain the current stage, what is blocking the next step, how to link LSW or RCA, what evidence belongs where, and how to move a loop cleanly to closure.',
      createdAtIso: new Date().toISOString(),
      id: 'assistant-welcome',
      role: 'assistant'
    }
  ]);
  const [isActivityLoading, setIsActivityLoading] = React.useState(false);
  const [actionProgressDrafts, setActionProgressDrafts] = React.useState<Record<string, number>>({});
  const [manualExecutionOverrides, setManualExecutionOverrides] = React.useState<Record<string, boolean>>({});
  const [evidencePreview, setEvidencePreview] = React.useState<{
    fileName?: string;
    label: string;
    url: string;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isPanelResizing, setIsPanelResizing] = React.useState(false);
  const [visibleColumnScrollbar, setVisibleColumnScrollbar] = React.useState<RailsStatus | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [leftPanel, setLeftPanel] = React.useState<RailsPanelState>({
    detached: false,
    height: 620,
    open: false,
    width: RAILS_LEFT_PANEL_DEFAULT_WIDTH,
    x: 18,
    y: 110
  });
  const [rightPanel, setRightPanel] = React.useState<RailsPanelState>({
    detached: false,
    height: 720,
    open: false,
    width: getPanelMinWidth('right'),
    x: Math.max(18, window.innerWidth - getPanelMinWidth('right') - 28),
    y: 110
  });
  const [evidenceThumbUrls, setEvidenceThumbUrls] = React.useState<Record<string, string>>({});
  const requestIdRef = React.useRef(0);
  const columnScrollbarTimeoutRef = React.useRef<number | null>(null);
  const boardCollaboratorsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const boardHintMenuRef = React.useRef<HTMLDivElement | null>(null);
  const collaboratorMenuRef = React.useRef<HTMLDivElement | null>(null);
  const actionContextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const evidenceContextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const evidenceLinkWarningRef = React.useRef<HTMLDivElement | null>(null);
  const evidenceHintRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{
    kind: RailsPanelKind;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const resizeRef = React.useRef<{
    edge: RailsPanelResizeEdge;
    kind: RailsPanelKind;
    startHeight: number;
    startPanelX: number;
    startWidth: number;
    startX: number;
    startY: number;
  } | null>(null);

  React.useEffect(() => {
    void loadWorkspace();
  }, []);

  React.useEffect(() => {
    return () => {
      if (columnScrollbarTimeoutRef.current !== null) {
        window.clearTimeout(columnScrollbarTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isCollaboratorMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (collaboratorMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsCollaboratorMenuOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isCollaboratorMenuOpen]);

  React.useEffect(() => {
    if (!boardCollaboratorsPopover) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (boardCollaboratorsMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setBoardCollaboratorsPopover(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', closeBoardCollaboratorsPopover);
    window.addEventListener('scroll', closeBoardCollaboratorsPopover, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', closeBoardCollaboratorsPopover);
      window.removeEventListener('scroll', closeBoardCollaboratorsPopover, true);
    };

    function closeBoardCollaboratorsPopover() {
      setBoardCollaboratorsPopover(null);
    }
  }, [boardCollaboratorsPopover]);

  React.useEffect(() => {
    if (!boardHintPopover) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (boardHintMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setBoardHintPopover(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', closeBoardHintPopover);
    window.addEventListener('scroll', handleWindowScroll, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', closeBoardHintPopover);
      window.removeEventListener('scroll', handleWindowScroll, true);
    };

    function handleWindowScroll(event: Event) {
      if (boardHintMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      closeBoardHintPopover();
    }

    function closeBoardHintPopover() {
      setBoardHintPopover(null);
    }
  }, [boardHintPopover]);

  React.useEffect(() => {
    if (!actionContextMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (actionContextMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setActionContextMenu(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', closeActionContextMenu);
    window.addEventListener('scroll', closeActionContextMenu, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', closeActionContextMenu);
      window.removeEventListener('scroll', closeActionContextMenu, true);
    };

    function closeActionContextMenu() {
      setActionContextMenu(null);
    }
  }, [actionContextMenu]);

  React.useEffect(() => {
    if (!evidenceContextMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (evidenceContextMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setEvidenceContextMenu(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', closeEvidenceContextMenu);
    window.addEventListener('scroll', closeEvidenceContextMenu, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', closeEvidenceContextMenu);
      window.removeEventListener('scroll', closeEvidenceContextMenu, true);
    };

    function closeEvidenceContextMenu() {
      setEvidenceContextMenu(null);
    }
  }, [evidenceContextMenu]);

  React.useEffect(() => {
    if (!evidenceLinkWarning) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (evidenceLinkWarningRef.current?.contains(event.target as Node)) {
        return;
      }

      setEvidenceLinkWarning(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', closeEvidenceLinkWarning);
    window.addEventListener('scroll', closeEvidenceLinkWarning, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', closeEvidenceLinkWarning);
      window.removeEventListener('scroll', closeEvidenceLinkWarning, true);
    };

    function closeEvidenceLinkWarning() {
      setEvidenceLinkWarning(null);
    }
  }, [evidenceLinkWarning]);

  React.useEffect(() => {
    if (!evidenceHint) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (evidenceHintRef.current?.contains(event.target as Node)) {
        return;
      }

      setEvidenceHint(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', closeEvidenceHint);
    window.addEventListener('scroll', closeEvidenceHint, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', closeEvidenceHint);
      window.removeEventListener('scroll', closeEvidenceHint, true);
    };

    function closeEvidenceHint() {
      setEvidenceHint(null);
    }
  }, [evidenceHint]);

  React.useEffect(() => {
    if (workspaceView === 'report') {
      setBoardCollaboratorsPopover(null);
      setBoardHintPopover(null);
      void loadRailsReport();
    }
  }, [workspaceView]);

  React.useEffect(() => {
    if (workspaceView === 'history') {
      setBoardCollaboratorsPopover(null);
      setBoardHintPopover(null);
      void loadRailsHistory();
    }
  }, [workspaceView, historySearch, historyStatus]);

  React.useEffect(() => {
    if (activeItemId && detailPanelTab === 'log') {
      void loadRailsActivity(activeItemId);
    }
  }, [activeItemId, detailPanelTab]);

  React.useEffect(() => {
    setLeftPanel((panel) => ({ ...panel, open: Boolean(activeItemId) }));
    setRightPanel((panel) => ({ ...panel, open: Boolean(activeItemId) }));
    setDetailPanelTab('details');
    setActiveActivity([]);
    setActionProgressDrafts({});
    setDraftLifecycleReason('');
    setEvidencePreview(null);
    setStandardizationDocumentFile(null);
    setIsStandardizationDocumentDragActive(false);
    setActionContextMenu(null);
    setActionPendingDeleteId('');
    setEvidenceContextMenu(null);
    setEvidencePendingDeleteId('');
    setExpandedRequiredEvidenceIds(new Set());
  }, [activeItemId]);

  React.useEffect(() => {
    if (!evidencePreview) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setEvidencePreview(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [evidencePreview]);

  React.useEffect(() => {
    if (!errorMessage) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setErrorMessage('');
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [errorMessage]);

  React.useEffect(() => {
    const nextThumbUrls: Record<string, string> = {};
    let isActive = true;

    void Promise.all(items.flatMap((item) => item.evidence
      .filter((evidence) => evidence.fileUrl && evidence.contentType?.startsWith('image/'))
      .map(async (evidence) => {
        const key = `${item.id}:${evidence.evidenceId}`;

        try {
          const blob = await downloadRailsEvidenceBlob(evidence.fileUrl || '');
          const objectUrl = URL.createObjectURL(blob);

          if (isActive) {
            nextThumbUrls[key] = objectUrl;
          } else {
            URL.revokeObjectURL(objectUrl);
          }
        } catch {
          // Thumbnail loading should not block the manager workflow.
        }
      }))).then(() => {
        if (isActive) {
          setEvidenceThumbUrls((currentUrls) => {
            Object.entries(currentUrls).forEach(([key, objectUrl]) => {
              if (!nextThumbUrls[key]) {
                URL.revokeObjectURL(objectUrl);
              }
            });

            return nextThumbUrls;
          });
        }
      });

    return () => {
      isActive = false;
      Object.values(nextThumbUrls).forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [items]);

  React.useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (dragRef.current) {
        const drag = dragRef.current;
        const nextX = drag.x + event.clientX - drag.startX;
        const nextY = drag.y + event.clientY - drag.startY;

        updatePanel(drag.kind, (panel) => ({
          ...panel,
          height: clamp(panel.height, RAILS_PANEL_MIN_HEIGHT, getPanelMaxHeight(nextY)),
          x: clamp(nextX, RAILS_PANEL_VIEWPORT_MARGIN, window.innerWidth - panel.width - RAILS_PANEL_VIEWPORT_MARGIN),
          y: clamp(nextY, RAILS_PANEL_TOP_LIMIT, getPanelMaxY(panel.height))
        }));
      }

      if (resizeRef.current) {
        const resize = resizeRef.current;
        const deltaX = event.clientX - resize.startX;
        const deltaY = event.clientY - resize.startY;

        updatePanel(resize.kind, (panel) => {
          if (resize.edge === 'bottom') {
            return {
              ...panel,
              height: clamp(resize.startHeight + deltaY, RAILS_PANEL_MIN_HEIGHT, getPanelMaxHeight(panel.y))
            };
          }

          if (resize.edge === 'right') {
            return {
              ...panel,
              width: clamp(resize.startWidth + deltaX, getPanelMinWidth(resize.kind), getPanelMaxWidth())
            };
          }

          const nextWidth = clamp(resize.startWidth - deltaX, getPanelMinWidth(resize.kind), getPanelMaxWidth());
          const widthDelta = resize.startWidth - nextWidth;

          return {
            ...panel,
            width: nextWidth,
            x: panel.detached
              ? clamp(resize.startPanelX + widthDelta, 8, window.innerWidth - nextWidth - 8)
              : panel.x
          };
        });
      }
    }

    function handlePointerUp() {
      dragRef.current = null;
      resizeRef.current = null;
      setIsPanelResizing(false);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const filteredItems = React.useMemo(() => {
    const normalizedNameFilter = boardNameFilter.trim().toLowerCase();
    const scopedStatusFilter = activeStageFilter !== 'All' ? activeStageFilter : boardStatusFilter;

    return items.filter((item) => {
      if (scopedStatusFilter !== 'All' && item.status !== scopedStatusFilter) {
        return false;
      }

      if (boardPriorityFilter !== 'All' && item.priority !== boardPriorityFilter) {
        return false;
      }

      if (boardDateFilter && item.dueDate !== boardDateFilter) {
        return false;
      }

      if (normalizedNameFilter) {
        const searchable = [
          item.title,
          item.problem,
          item.displayId,
          item.owner.displayName,
          item.departmentName || '',
          item.linkedLsw || '',
          item.linkedLswSource?.title || '',
          item.linkedRca || '',
          item.source
        ].join(' ').toLowerCase();

        if (!searchable.includes(normalizedNameFilter)) {
          return false;
        }
      }

      if (activeFilter === 'All') {
        return true;
      }

      if (activeFilter === 'Overdue') {
        return item.escalation.overdue;
      }

      return item.priority === activeFilter;
    });
  }, [activeFilter, activeStageFilter, boardDateFilter, boardNameFilter, boardPriorityFilter, boardStatusFilter, items]);

  const stageScopedItems = React.useMemo(() => {
    const scopedStatusFilter = activeStageFilter !== 'All' ? activeStageFilter : boardStatusFilter;

    return items.filter((item) => {
      if (scopedStatusFilter !== 'All' && item.status !== scopedStatusFilter) {
        return false;
      }

      if (boardPriorityFilter !== 'All' && item.priority !== boardPriorityFilter) {
        return false;
      }

      if (boardDateFilter && item.dueDate !== boardDateFilter) {
        return false;
      }

      return true;
    });
  }, [activeStageFilter, boardDateFilter, boardPriorityFilter, boardStatusFilter, items]);

  const activeItem = items.find((item) => item.id === activeItemId) ?? null;
  const standardizationEvidence = activeItem?.evidence.find((evidence) => evidence.purpose === 'standardization' && evidence.status === 'Attached') || null;
  const activeStandardizationTarget = activeItem ? getStandardizationTargetInputValue(activeItem.standardization) : '';
  const isStandardizationDraftDirty = Boolean(activeItem) && (
    standardizationDraft.target.trim() !== activeStandardizationTarget ||
    standardizationDraft.verification.trim() !== (activeItem?.standardizationVerification || '')
  );
  const standardizationRequirements = activeItem ? getStandardizationRequirements(activeItem, standardizationDraft) : [];
  const standardizationPreVerificationRequirements = standardizationRequirements.filter((requirement) => requirement.key !== 'status');
  const incompleteStandardizationPreVerificationRequirements = standardizationPreVerificationRequirements.filter((requirement) => !requirement.complete);
  const canVerifyStandardizationPlan = activeItem !== null
    && activeItem.standardizationStatus !== 'Verified'
    && incompleteStandardizationPreVerificationRequirements.length === 0;
  const attachedEvidenceCount = activeItem?.evidence.filter((evidence) => evidence.status === 'Attached').length || 0;
  const visibleAttachedEvidenceForActiveItem = activeItem
    ? activeItem.evidence.filter((evidence) => evidence.status === 'Attached' && isRailsEvidenceLinkVisibleForItem(activeItem, evidence))
    : [];
  const requiredVerificationEvidence = activeItem?.evidence.filter((evidence) => evidence.status === 'Required') || [];
  const allRequiredVerificationEvidenceLinked = activeItem
    ? requiredVerificationEvidence.length > 0
      && requiredVerificationEvidence.every((requirement) => isRequiredRailsEvidenceSatisfied(activeItem, requirement, visibleAttachedEvidenceForActiveItem))
    : false;
  const governedActionRequirements = activeItem?.actions.flatMap((action) => {
    const attachedEvidence = activeItem.evidence.filter((evidence) => evidence.status === 'Attached');
    return getActionRequirementState(action, attachedEvidence);
  }) || [];
  const incompleteGovernedActionRequirements = governedActionRequirements.filter((requirement) => !requirement.complete);
  const activeDetailPageIndex = railsDetailPages.findIndex((page) => page.key === activeDetailPage);
  const currentDetailPage = railsDetailPages[Math.max(0, activeDetailPageIndex)] || railsDetailPages[0];
  const previousDetailPage = activeDetailPageIndex > 0 ? railsDetailPages[activeDetailPageIndex - 1] : null;
  const nextDetailPage = activeDetailPageIndex >= 0 && activeDetailPageIndex < railsDetailPages.length - 1
    ? railsDetailPages[activeDetailPageIndex + 1]
    : null;
  const detailReadinessByPage = React.useMemo<Record<RailsDetailPage, RailsDetailReadinessTask[]>>(() => {
    if (!activeItem) {
      return {
        actions: [],
        closure: [],
        overview: [],
        standardization: [],
        verification: []
      };
    }

    const actions = activeItem.actions;
    const attachedEvidence = activeItem.evidence.filter((evidence) => evidence.status === 'Attached' && isRailsEvidenceLinkVisibleForItem(activeItem, evidence));
    const requiredEvidence = activeItem.evidence.filter((evidence) => evidence.status === 'Required');
    const allRequiredEvidenceAttached = requiredEvidence.every((evidence) => isRequiredRailsEvidenceSatisfied(activeItem, evidence, attachedEvidence));
    const allActionsReadyForVerification = actions.length > 0
      && actions.every((action) => {
        const draftProgress = clampProgress(actionProgressDrafts[action.actionId] ?? action.progressPercent);
        return draftProgress === 100 && action.status === 'Done';
      });
    return {
      overview: [
        {
          complete: Boolean(activeItem.owner?.uid),
          key: 'owner',
          label: 'Assign an accountable owner'
        },
        {
          complete: Boolean(activeItem.departmentName),
          key: 'department',
          label: 'Assign the loop to a department'
        },
        {
          complete: Boolean(activeItem.dueDate),
          key: 'dueDate',
          label: 'Set the loop due date'
        },
        {
          complete: Boolean(activeItem.priority),
          key: 'priority',
          label: 'Set the priority'
        },
        {
          complete: Boolean(activeItem.title.trim()),
          key: 'title',
          label: 'Enter a loop title'
        },
        {
          complete: Boolean(activeItem.problem.trim()),
          key: 'problem',
          label: 'Enter the problem statement'
        },
        {
          complete: hasRailsRcaDecision(activeItem),
          key: 'rcaDecision',
          label: 'Make an RCA decision: link RCA, request RCA triage, or mark RCA not required'
        },
        {
          complete: hasRailsEnterpriseOriginDecision(activeItem),
          key: 'originDecision',
          label: 'Link LSW, link RCA, or document a manual enterprise intake source'
        }
      ],
      actions: [
        {
          complete: actions.length > 0,
          key: 'actionExists',
          label: 'Add at least one action plan item'
        },
        {
          complete: actions.length > 0 && actions.every((action) => Boolean(action.title.trim())),
          key: 'actionTitles',
          label: 'Name every action item'
        },
        {
          complete: actions.length > 0 && actions.every((action) => Boolean(action.ownerUid)),
          key: 'actionOwners',
          label: 'Assign an owner to every action'
        },
        {
          complete: actions.length > 0 && actions.every((action) => Boolean(action.dueDate)),
          key: 'actionDueDates',
          label: 'Set a due date for every action'
        },
        {
          complete: actions.some((action) => action.status === 'Open' || action.status === 'In Progress' || clampProgress(actionProgressDrafts[action.actionId] ?? action.progressPercent) > 0),
          key: 'actionExecutionState',
          label: 'Keep at least one action open or in progress'
        }
      ],
      verification: [
        {
          complete: allActionsReadyForVerification,
          key: 'actionsComplete',
          label: 'Complete every action to 100% and mark it Done'
        },
        ...governedActionRequirements.map((requirement, index) => ({
          ...requirement,
          key: `governedAction-${index}-${requirement.label}`
        })),
        {
          complete: allRequiredEvidenceAttached,
          key: 'requiredEvidenceBeforeVerification',
          label: 'Link all required verification evidence from the Evidence Library'
        },
        {
          complete: Boolean(activeItem.verification.trim()),
          key: 'verificationMethod',
          label: 'Define the verification method'
        },
        {
          complete: Boolean(activeItem.approver?.uid),
          key: 'approver',
          label: 'Assign an approver before approval'
        }
      ],
      standardization: standardizationRequirements,
      closure: [
        ...standardizationRequirements,
        {
          complete: activeItem.status === 'Approved' || activeItem.status === 'Closed',
          key: 'approvedForClosure',
          label: 'Advance the workflow to Approved before closing'
        },
        {
          complete: activeItem.status === 'Closed' || (activeItem.status === 'Approved' && activeItem.workflowGate.canAdvance),
          key: 'closureGate',
          label: 'Clear the backend closure gate'
        }
      ]
    };
  }, [
    activeItem,
    actionProgressDrafts,
    attachedEvidenceCount,
    governedActionRequirements,
    standardizationRequirements
  ]);
  const activeDetailReadinessTasks = detailReadinessByPage[activeDetailPage] || [];
  const activeDetailPendingCount = activeDetailReadinessTasks.filter((task) => !task.complete).length;
  const selectedDraftOwner = candidates.find((candidate) => candidate.uid === draftOwnerUid);
  const ownerFieldNameLength = Math.max(
    12,
    selectedDraftOwner?.displayName.length || (candidates.length ? 12 : 'No active users'.length)
  );
  const openItems = items.filter((item) => item.status !== 'Closed').length;
  const verificationItems = items.filter((item) => item.status === 'Verification' || item.status === 'Approved').length;
  const criticalItems = items.filter((item) => item.priority === 'Critical' && item.status !== 'Closed').length;
  const escalatedItems = items.filter((item) => item.escalation.level === 'Critical' || item.escalation.level === 'Overdue').length;
  const completionRate = Math.round(
    items.reduce((total, item) => total + getDisplayRailsItemStageReadinessPercent(item), 0) / Math.max(1, items.length)
  );
  const stageCounts = React.useMemo(() => {
    return railsStatuses.reduce<Record<RailsStatus, number>>((counts, status) => {
      counts[status] = items.filter((item) => item.status === status).length;
      return counts;
    }, {} as Record<RailsStatus, number>);
  }, [items]);
  const hasActiveBoardFilters = (
    activeFilter !== 'All' ||
    activeStageFilter !== 'All' ||
    boardNameFilter.trim() !== '' ||
    boardDateFilter !== '' ||
    boardPriorityFilter !== 'All' ||
    boardStatusFilter !== 'All'
  );

  const clearBoardFilters = React.useCallback(() => {
    setActiveFilter('All');
    setActiveStageFilter('All');
    setBoardNameFilter('');
    setBoardDateFilter('');
    setBoardPriorityFilter('All');
    setBoardStatusFilter('All');
  }, []);

  const closeStageFilterPanel = React.useCallback((shouldClearFilters = false) => {
    if (shouldClearFilters) {
      clearBoardFilters();
    }

    setIsStageFilterPanelActive(false);
    setLeftPanelMode('controls');
  }, [clearBoardFilters]);

  function openRailsAssistantPanel() {
    setIsStageFilterPanelActive(false);
    setLeftPanelMode('assistant');
    updatePanel('left', (panel) => ({ ...panel, open: true }));
  }

  function closeRailsAssistantPanel() {
    setLeftPanelMode('controls');
  }

  React.useEffect(() => {
    if (!activeItem) {
      setStandardizationDraft({ target: '', verification: '' });
      setActiveDetailPage('overview');
      setActiveActionRecordId('');
      setIsCollaboratorMenuOpen(false);
      return;
    }

    setActiveDetailPage('overview');
    setIsCollaboratorMenuOpen(false);
    setActiveActionRecordId(activeItem.actions.find((action) => getRailsActionKind(action) !== 'general')?.actionId || activeItem.actions[0]?.actionId || '');
    setStandardizationDraft({
      target: getStandardizationTargetInputValue(activeItem.standardization),
      verification: activeItem.standardizationVerification || ''
    });
  }, [activeItem?.id, activeItem?.standardization, activeItem?.standardizationVerification]);

  function getDisplayRailsItemStageReadinessPercent(item: RailsItem): number {
    return getRailsItemStageReadinessPercent(
      item,
      item.id === activeItemId ? actionProgressDrafts : {},
      item.id === activeItemId ? standardizationDraft : undefined
    );
  }

  async function loadWorkspace() {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const endLoading = appLoading.beginLoading({
      detail: 'Loading loops, owners, RCA links, and governance gates',
      message: 'Preparing the RAILS command center',
      scope: 'rails',
      title: 'Loading RAILS workspace'
    });
    setIsLoading(true);
    setErrorMessage('');

    try {
      const workspace = await getRailsWorkspace();

      if (requestIdRef.current !== requestId) {
        return;
      }

      setItems(workspace.items);
      setCandidates(workspace.candidates);
      setRcaCandidates(workspace.rcaCandidates || []);
      setLswCandidates(workspace.lswCandidates || []);
      setContext(workspace.context);
      setDraftOwnerUid(workspace.context.user.uid);
      setDraftCollaboratorUid(workspace.candidates.find((candidate) => candidate.uid !== workspace.context.user.uid)?.uid || '');
      setActiveItemId((currentId) => workspace.items.some((item) => item.id === currentId)
        ? currentId
        : ''
      );
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }

  async function loadRailsReport() {
    const endLoading = appLoading.beginLoading({
      detail: 'Generating metrics, aging buckets, owner summaries, and RCA linkage',
      message: 'Refreshing enterprise reporting',
      scope: 'rails',
      title: 'Loading RAILS report'
    });
    setIsReportLoading(true);
    setErrorMessage('');

    try {
      setRailsReport(await getRailsReport());
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      endLoading();
      setIsReportLoading(false);
    }
  }

  async function loadRailsHistory() {
    const endLoading = appLoading.beginLoading({
      detail: 'Searching secured archive records and audit-ready loop history',
      message: 'Refreshing history and archive',
      scope: 'rails',
      title: 'Loading RAILS history'
    });
    setIsHistoryLoading(true);
    setErrorMessage('');

    try {
      const history = await getRailsHistory({
        search: historySearch.trim() || undefined,
        status: historyStatus
      });

      setHistoryItems(history.items);
      setSelectedHistoryItemIds((selectedIds) => selectedIds.filter((itemId) => history.items.some((item) => item.id === itemId)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      endLoading();
      setIsHistoryLoading(false);
    }
  }

  async function loadRailsActivity(itemId: string) {
    const endLoading = appLoading.beginLoading({
      detail: 'Retrieving immutable actions, approvals, evidence, and workflow events',
      message: 'Loading audit activity',
      scope: 'rails',
      title: 'Loading RAILS activity'
    });
    setIsActivityLoading(true);
    setErrorMessage('');

    try {
      setActiveActivity(await getRailsItemActivity(itemId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      endLoading();
      setIsActivityLoading(false);
    }
  }

  async function handleExportHistory(format: 'csv' | 'json') {
    try {
      setIsSaving(true);
      setErrorMessage('');
      const query = {
        search: historySearch.trim() || undefined,
        status: historyStatus
      };
      const exportResult = format === 'json'
        ? await exportRailsJson(query)
        : await exportRailsCsv(query);
      const objectUrl = URL.createObjectURL(exportResult.blob);
      const anchor = document.createElement('a');

      anchor.href = objectUrl;
      anchor.download = exportResult.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function handleHistorySelect(item: RailsItem) {
    setItems((currentItems) => currentItems.some((currentItem) => currentItem.id === item.id)
      ? currentItems.map((currentItem) => currentItem.id === item.id ? item : currentItem)
      : [item, ...currentItems]
    );
    handleCardSelect(item.id);
  }

  async function handleApplyBulkUpdate() {
    const patch = {
      archiveReason: bulkArchiveReason.trim() || undefined,
      category: bulkCategory || undefined,
      dueDate: bulkDueDate || undefined,
      ownerUid: bulkOwnerUid || undefined,
      priority: bulkPriority || undefined,
      status: bulkArchiveReason.trim() ? 'Archived' as RailsStatus : undefined
    };
    const hasPatch = Object.values(patch).some((value) => value !== undefined);

    if (!selectedHistoryItemIds.length || (!hasPatch && !bulkCollaboratorUid) || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const result = await bulkUpdateRailsItems(selectedHistoryItemIds, patch, bulkCollaboratorUid || undefined);
      const updatedItems = result.results
        .map((entry) => entry.item)
        .filter((item): item is RailsItem => Boolean(item));

      updatedItems.forEach((item) => replaceItem(item));
      setHistoryItems((currentItems) => currentItems.map((item) => updatedItems.find((updatedItem) => updatedItem.id === item.id) || item));
      setSelectedHistoryItemIds([]);
      setBulkArchiveReason('');
      setBulkCategory('');
      setBulkCollaboratorUid('');
      setBulkDueDate('');
      setBulkOwnerUid('');
      setBulkPriority('');

      if (result.failed) {
        const failureSummary = result.results
          .filter((entry) => entry.status === 'failed')
          .map((entry) => `${entry.itemId}: ${entry.error || 'Update failed'}`)
          .join(' ');
        setErrorMessage(`Bulk update completed with ${result.succeeded} succeeded and ${result.failed} failed. ${failureSummary}`);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateLoop(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draftTitle.trim();
    if (!title || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const item = await createRailsItem({
        ownerUid: draftOwnerUid || context?.user.uid,
        title
      });

      setItems((currentItems) => [item, ...currentItems]);
      setActiveItemId(item.id);
      setDraftTitle('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAdvanceStatus(item: RailsItem) {
    if (isSaving) {
      return;
    }

    const nextStatus = item.workflowGate.nextStatus;

    if (!nextStatus || !item.workflowGate.canAdvance) {
      setErrorMessage(item.workflowGate.blockers.length
        ? `Complete gate requirements first: ${item.workflowGate.blockers.join(' ')}`
        : 'This RAILS loop cannot advance from its current stage.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await updateRailsItem(item.id, { status: nextStatus });
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePatchItem(item: RailsItem, patch: Parameters<typeof updateRailsItem>[1]) {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await updateRailsItem(item.id, patch);
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRcaDecisionChange(item: RailsItem, value: string) {
    if (value === '__triage_requested') {
      if (isSaving) {
        return;
      }

      try {
        setIsSaving(true);
        setErrorMessage('');
        const updatedItem = await requestRailsRcaTriage(item.id, {
          assignedToUid: item.approver?.uid || item.owner.uid,
          dueDate: item.dueDate || null,
          reason: item.problem || item.title
        });
        replaceItem(updatedItem);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (value === '__not_required') {
      await handlePatchItem(item, {
        linkedRca: 'RCA not required',
        linkedRcaDecisionReason: 'Reviewed during RAILS triage and RCA was not required.',
        linkedRcaId: null
      });
      return;
    }

    await handlePatchItem(item, { linkedRcaId: value || null });
  }

  async function handleConvertRcaTriage(item: RailsItem) {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await convertRailsRcaTriageToIncident(item.id);
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRcaTriageReviewChange(item: RailsItem, status: 'Accepted' | 'Rejected') {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await updateRailsRcaTriageRequest(item.id, {
        reviewNote: status === 'Accepted' ? 'RCA triage accepted for investigation.' : 'RCA triage reviewed and RCA is not required.',
        status
      });
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLswSourceChange(item: RailsItem, value: string) {
    if (!value) {
      await handlePatchItem(item, { linkedLswSourceId: null, linkedLswSourceType: null });
      return;
    }

    const candidate = lswCandidates.find((source) => getLswCandidateValue(source) === value);

    if (!candidate) {
      setErrorMessage('Select a valid LSW source from the backend candidate list.');
      return;
    }

    await handlePatchItem(item, {
      linkedLswSourceId: candidate.sourceId,
      linkedLswSourceType: candidate.sourceType
    });
  }

  async function handleLoadRcaCandidates() {
    try {
      setRcaCandidates(await listRailsRcaCandidates());
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleLoadLswCandidates() {
    try {
      setLswCandidates(await listRailsLswCandidates());
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleAddCollaborator(item: RailsItem) {
    if (!draftCollaboratorUid || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await addRailsCollaborator(item.id, draftCollaboratorUid);
      replaceItem(updatedItem);
      setDraftCollaboratorUid('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveCollaborator(item: RailsItem, userId: string) {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await removeRailsCollaborator(item.id, userId);
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddAction(item: RailsItem) {
    const title = draftActionTitle.trim();
    if (!title || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await addRailsAction(item.id, {
        dueDate: item.dueDate,
        ownerUid: item.owner.uid,
        title
      });
      replaceItem(updatedItem);
      setDraftActionTitle('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateActionStatus(item: RailsItem, actionId: string, status: 'Open' | 'In Progress' | 'Blocked' | 'Done') {
    if (isSaving) {
      return;
    }

    const gateMessage = getBlockedActionMutationMessage(item, status);
    if (gateMessage) {
      setActionProgressDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[actionId];

        return nextDrafts;
      });
      setErrorMessage(gateMessage);
      void refreshWorkspaceSnapshot();
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await updateRailsAction(item.id, actionId, { status });
      replaceItem(updatedItem);
    } catch (error) {
      setActionProgressDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[actionId];

        return nextDrafts;
      });
      setErrorMessage(getErrorMessage(error));
      void refreshWorkspaceSnapshot();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateActionProgress(item: RailsItem, actionId: string, progressPercent: number) {
    if (isSaving) {
      return;
    }

    const nextProgressPercent = clampProgress(progressPercent);
    const gateMessage = getBlockedActionMutationMessage(item, undefined, nextProgressPercent);
    if (gateMessage) {
      setActionProgressDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[actionId];

        return nextDrafts;
      });
      setErrorMessage(gateMessage);
      void refreshWorkspaceSnapshot();
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await updateRailsAction(item.id, actionId, { progressPercent: nextProgressPercent });
      setActionProgressDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[actionId];

        return nextDrafts;
      });
      replaceItem(updatedItem);
    } catch (error) {
      setActionProgressDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[actionId];

        return nextDrafts;
      });
      setErrorMessage(getErrorMessage(error));
      void refreshWorkspaceSnapshot();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateActionDocumentation(
    item: RailsItem,
    actionId: string,
    patch: {
      completedAtCorrectionReason?: string;
      completedAtIso?: string | null;
      completedByExternalName?: string;
      completedByUid?: string | null;
      containmentNote?: string;
      evidenceIds?: string[];
      effectivenessCriteria?: string;
      effectivenessResult?: string;
      implementationNote?: string;
      riskControlled?: string;
      startedAtCorrectionReason?: string;
      startedAtIso?: string | null;
      startedByUid?: string | null;
      standardizationNote?: string;
      verificationNote?: string;
      verifiedByUid?: string | null;
    }
  ) {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await updateRailsAction(item.id, actionId, patch);
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      void refreshWorkspaceSnapshot();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetActionEvidenceLink(item: RailsItem, action: RailsAction, evidenceId: string, shouldLink: boolean) {
    const nextEvidenceIds = new Set(action.evidenceIds || []);
    if (shouldLink) {
      nextEvidenceIds.add(evidenceId);
    } else {
      nextEvidenceIds.delete(evidenceId);
    }

    await handleUpdateActionDocumentation(item, action.actionId, {
      evidenceIds: Array.from(nextEvidenceIds)
    });
    setEvidenceLinkWarning(null);
  }

  async function handleReorderAction(item: RailsItem, actionId: string, direction: 'up' | 'down') {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      setActionContextMenu(null);
      const updatedItem = await reorderRailsAction(item.id, actionId, direction);
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      void refreshWorkspaceSnapshot();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDeleteAction(item: RailsItem, actionId: string) {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      setActionContextMenu(null);
      const updatedItem = await deleteRailsAction(item.id, actionId);
      replaceItem(updatedItem);
      setActionPendingDeleteId('');
      setActiveActionRecordId((currentActionId) => currentActionId === actionId ? '' : currentActionId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      void refreshWorkspaceSnapshot();
    } finally {
      setIsSaving(false);
    }
  }

  function openActionContextMenu(event: React.MouseEvent<HTMLElement>, action: RailsAction, isActionExpanded: boolean) {
    if (isActionExpanded) {
      return;
    }

    event.preventDefault();
    const width = 198;
    const height = 142;
    const left = Math.max(10, Math.min(event.clientX, window.innerWidth - width - 10));
    const top = Math.max(RAILS_PANEL_TOP_LIMIT, Math.min(event.clientY, window.innerHeight - height - 10));

    setActionContextMenu({
      actionId: action.actionId,
      left,
      top
    });
  }

  async function handleAddEvidence(item: RailsItem) {
    if (!draftEvidenceFiles.length || isSaving || isEvidenceUploading) {
      return;
    }

    try {
      let latestItem = item;
      setIsSaving(true);
      setIsEvidenceUploading(true);
      setEvidenceUploadProgress(0);
      setErrorMessage('');

      for (const [index, file] of draftEvidenceFiles.entries()) {
        setEvidenceUploadProgress(Math.round((index / draftEvidenceFiles.length) * 100));
        latestItem = await addRailsEvidence(item.id, {
          dataUrl: await fileToDataUrl(file),
          fileName: file.name,
          label: draftEvidenceLabel.trim() && draftEvidenceFiles.length === 1 ? draftEvidenceLabel.trim() : file.name,
          status: 'Attached'
        });
        setEvidenceUploadProgress(Math.round(((index + 1) / draftEvidenceFiles.length) * 100));
      }

      replaceItem(latestItem);
      setDraftEvidenceLabel('');
      setDraftEvidenceFiles([]);
      setIsEvidenceUploadModalOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsEvidenceUploading(false);
      setIsSaving(false);
    }
  }

  function handleEvidenceFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);

    if (nextFiles.length) {
      setDraftEvidenceFiles((currentFiles) => [...currentFiles, ...nextFiles]);
      setDraftEvidenceLabel((label) => label || (nextFiles.length === 1 ? nextFiles[0].name : ''));
    }
  }

  function handleEvidencePaste(event: React.ClipboardEvent<HTMLElement>) {
    const files = Array.from(event.clipboardData.files);

    if (!files.length) {
      return;
    }

    event.preventDefault();
    handleEvidenceFiles(files);
  }

  function toggleRequiredEvidenceSlot(evidenceId: string) {
    setExpandedRequiredEvidenceIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(evidenceId)) {
        nextIds.delete(evidenceId);
      } else {
        nextIds.add(evidenceId);
      }
      return nextIds;
    });
  }

  async function handleSetRequiredEvidenceLink(item: RailsItem, requirementId: string, sourceEvidenceId: string | null) {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await addRailsEvidence(item.id, {
        evidenceId: requirementId,
        sourceEvidenceId,
        status: 'Required'
      });
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateEvidenceMetadata(
    item: RailsItem,
    evidenceId: string,
    patch: {
      label?: string;
      note?: string;
      visibility?: RailsItem['evidence'][number]['visibility'];
    }
  ) {
    if (isSaving) {
      return;
    }

    const evidence = item.evidence.find((entry) => entry.evidenceId === evidenceId);
    if (!evidence) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await addRailsEvidence(item.id, {
        evidenceId,
        label: patch.label ?? evidence.label,
        note: patch.note ?? evidence.note,
        purpose: evidence.purpose,
        status: evidence.status,
        visibility: patch.visibility ?? evidence.visibility ?? 'public'
      });
      replaceItem(updatedItem);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      void refreshWorkspaceSnapshot();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveEvidenceRename(
    item: RailsItem,
    evidence: RailsItem['evidence'][number],
    draftValue: string
  ): Promise<boolean> {
    if (isSaving) {
      return false;
    }

    const nextLabel = buildEvidenceLabelWithLockedExtension(evidence, draftValue);
    const currentLabel = evidence.label.trim();

    if (!nextLabel) {
      setErrorMessage('Evidence name is required.');
      return false;
    }

    if (nextLabel.toLowerCase() === currentLabel.toLowerCase() || nextLabel === currentLabel) {
      return true;
    }

    await handleUpdateEvidenceMetadata(item, evidence.evidenceId, { label: nextLabel });
    return true;
  }

  async function handleRenameEvidenceFromEditor(evidenceId: string, draftValue: string): Promise<boolean> {
    const item = activeItem;
    if (!item) {
      return false;
    }

    const evidence = item.evidence.find((entry) => entry.evidenceId === evidenceId);
    if (!evidence) {
      return false;
    }

    return handleSaveEvidenceRename(item, evidence, draftValue);
  }

  async function handleReplaceEvidenceWithEditedImage(item: RailsItem, evidenceId: string, dataUrl: string) {
    if (isSaving) {
      return;
    }

    const evidence = item.evidence.find((entry) => entry.evidenceId === evidenceId);
    if (!evidence) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await addRailsEvidence(item.id, {
        dataUrl,
        evidenceId,
        fileName: evidence.fileName || `${evidence.label}.png`,
        label: evidence.label,
        note: evidence.note,
        purpose: evidence.purpose,
        status: 'Attached',
        visibility: evidence.visibility || 'public'
      });
      replaceItem(updatedItem);
      setEvidenceEditorId('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      void refreshWorkspaceSnapshot();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDeleteEvidence(item: RailsItem, evidenceId: string) {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await deleteRailsEvidence(item.id, evidenceId);
      replaceItem(updatedItem);
      setEvidencePendingDeleteId('');
      setEvidenceContextMenu(null);
      setEvidenceHint((currentHint) => currentHint?.evidenceId === evidenceId ? null : currentHint);
      setEvidenceEditorId((currentEvidenceId) => currentEvidenceId === evidenceId ? '' : currentEvidenceId);
      setEvidencePreview((currentPreview) => currentPreview?.label === item.evidence.find((entry) => entry.evidenceId === evidenceId)?.label ? null : currentPreview);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      void refreshWorkspaceSnapshot();
    } finally {
      setIsSaving(false);
    }
  }

  function openEvidenceContextMenu(event: React.MouseEvent<HTMLElement>, evidence: RailsItem['evidence'][number]) {
    event.preventDefault();
    const width = 188;
    const height = 104;
    const left = Math.max(10, Math.min(event.clientX, window.innerWidth - width - 10));
    const top = Math.max(RAILS_PANEL_TOP_LIMIT, Math.min(event.clientY, window.innerHeight - height - 10));

    setEvidenceContextMenu({
      evidenceId: evidence.evidenceId,
      left,
      top
    });
  }

  function handleStandardizationDocumentFiles(files: FileList | File[]) {
    const [file] = Array.from(files);

    if (file) {
      setStandardizationDocumentFile(file);
    }
  }

  function handleStandardizationDocumentPaste(event: React.ClipboardEvent<HTMLElement>) {
    const files = Array.from(event.clipboardData.files);

    if (!files.length) {
      return;
    }

    event.preventDefault();
    handleStandardizationDocumentFiles(files);
  }

  async function handleUploadStandardizationDocument(item: RailsItem) {
    if (!standardizationDocumentFile || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await addRailsEvidence(item.id, {
        dataUrl: await fileToDataUrl(standardizationDocumentFile),
        fileName: standardizationDocumentFile.name,
        label: 'Standardization document',
        note: 'Document used to prove the new standard work, checklist, training, audit, or control is in place.',
        purpose: 'standardization',
        status: 'Attached'
      });
      replaceItem(updatedItem);
      setStandardizationDocumentFile(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenEvidenceFile(evidence: RailsItem['evidence'][number]) {
    if (!evidence.fileUrl || isSaving) {
      return;
    }

    try {
      const blob = await downloadRailsEvidenceBlob(evidence.fileUrl);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleOpenStandardizationVersion(version: RailsItem['standardizationDocumentVersions'][number]) {
    if (!version.fileUrl || isSaving) {
      return;
    }

    try {
      const blob = await downloadRailsEvidenceBlob(version.fileUrl);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleSaveStandardizationPlan(item: RailsItem) {
    if (isSaving) {
      return;
    }

    const target = standardizationDraft.target.trim();
    const verification = standardizationDraft.verification.trim();
    const patch: Parameters<typeof updateRailsItem>[1] = {};

    if (target && target !== getStandardizationTargetInputValue(item.standardization)) {
      patch.standardization = target;
    }

    if (verification !== (item.standardizationVerification || '')) {
      patch.standardizationVerification = verification;
    }

    if (!Object.keys(patch).length) {
      return;
    }

    await handlePatchItem(item, patch);
  }

  async function handleVerifyStandardizationPlan(item: RailsItem) {
    if (isSaving) {
      return;
    }

    const target = standardizationDraft.target.trim();
    const verification = standardizationDraft.verification.trim();
    const blockers = getStandardizationRequirements(item, standardizationDraft)
      .filter((requirement) => !requirement.complete && requirement.key !== 'status')
      .map((requirement) => requirement.label);

    if (blockers.length) {
      setErrorMessage(`Complete standardization requirements first: ${blockers.join(', ')}.`);
      return;
    }

    await handlePatchItem(item, {
      standardization: target,
      standardizationStatus: 'Verified',
      standardizationVerification: verification
    });
  }

  async function handleAddComment(item: RailsItem) {
    const body = draftComment.trim();
    if (!body || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await addRailsComment(item.id, body);
      replaceItem(updatedItem);
      if (detailPanelTab === 'log') {
        await loadRailsActivity(item.id);
      }
      setDraftComment('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAskRailsAssistant(question: string) {
    const prompt = question.trim();
    if (!prompt || isAssistantResponding) {
      return;
    }

    const userMessage: RailsAssistantMessage = {
      body: prompt,
      createdAtIso: new Date().toISOString(),
      id: `user-${Date.now()}`,
      role: 'user'
    };

    setAssistantMessages((currentMessages) => [...currentMessages, userMessage]);
    setDraftAssistantQuestion('');
    setIsAssistantResponding(true);
    setErrorMessage('');

    try {
      const response = await askRailsKnowledge(prompt, activeItem?.id);
      setAssistantMessages((currentMessages) => [
        ...currentMessages,
        {
          answerSource: response.source,
          body: response.answer,
          createdAtIso: new Date().toISOString(),
          id: `assistant-${Date.now()}`,
          role: 'assistant'
        }
      ]);
    } catch (error) {
      const message = getErrorMessage(error);
      setAssistantMessages((currentMessages) => [
        ...currentMessages,
        {
          answerSource: 'SYSTEM_GUIDE',
          body: `I could not answer that yet. ${message}`,
          createdAtIso: new Date().toISOString(),
          id: `assistant-error-${Date.now()}`,
          role: 'assistant'
        }
      ]);
    } finally {
      setIsAssistantResponding(false);
    }
  }

  function replaceItem(updatedItem: RailsItem) {
    setItems((currentItems) => currentItems.map((item) => item.id === updatedItem.id ? updatedItem : item));
    setActiveItemId(updatedItem.id);
  }

  async function refreshWorkspaceSnapshot() {
    const endLoading = appLoading.beginLoading({
      detail: 'Reconciling the latest loop status and backend gate decisions',
      message: 'Refreshing RAILS workspace state',
      scope: 'rails',
      title: 'Syncing RAILS'
    });
    try {
      const workspace = await getRailsWorkspace();
      setItems(workspace.items);
      setCandidates(workspace.candidates);
      setRcaCandidates(workspace.rcaCandidates || []);
      setLswCandidates(workspace.lswCandidates || []);
      setContext(workspace.context);
      setDraftCollaboratorUid((currentUid) => currentUid || workspace.candidates.find((candidate) => candidate.uid !== workspace.context.user.uid)?.uid || '');
      setActiveItemId((currentId) => workspace.items.some((workspaceItem) => workspaceItem.id === currentId)
        ? currentId
        : ''
      );
    } catch {
      // Keep the original gate error visible; the next manual refresh can recover workspace state.
    } finally {
      endLoading();
    }
  }

  function getBlockedActionMutationMessage(
    item: RailsItem,
    nextStatus?: RailsActionStatus,
    nextProgressPercent?: number
  ): string {
    const startsActionWork = nextStatus === 'In Progress' ||
      nextStatus === 'Done' ||
      (nextProgressPercent !== undefined && nextProgressPercent > 0);

    if (item.status === 'New' && startsActionWork) {
      return 'RAILS gate blocked: move from New to Triaged before selecting In Progress.';
    }

    return '';
  }

  function updatePanel(kind: RailsPanelKind, updater: (panel: RailsPanelState) => RailsPanelState) {
    const setter = kind === 'left' ? setLeftPanel : setRightPanel;
    setter((panel) => updater(panel));
  }

  function handleCardSelect(itemId: string) {
    setBoardHintPopover(null);
    setActiveItemId(itemId);
    setLeftPanel((panel) => ({ ...panel, open: true }));
    setRightPanel((panel) => ({ ...panel, open: true }));
  }

  function clearColumnScrollbarTimer() {
    if (columnScrollbarTimeoutRef.current !== null) {
      window.clearTimeout(columnScrollbarTimeoutRef.current);
      columnScrollbarTimeoutRef.current = null;
    }
  }

  function revealColumnScrollbar(status: RailsStatus) {
    clearColumnScrollbarTimer();
    setVisibleColumnScrollbar(status);
    columnScrollbarTimeoutRef.current = window.setTimeout(() => {
      setVisibleColumnScrollbar((currentStatus) => currentStatus === status ? null : currentStatus);
      columnScrollbarTimeoutRef.current = null;
    }, 1800);
  }

  function hideColumnScrollbar(status: RailsStatus) {
    clearColumnScrollbarTimer();
    setVisibleColumnScrollbar((currentStatus) => currentStatus === status ? null : currentStatus);
  }

  function handleColumnBodyMouseMove(status: RailsStatus, event: React.MouseEvent<HTMLDivElement>) {
    const scrollbarActivationWidth = 18;
    const rect = event.currentTarget.getBoundingClientRect();
    const isNearScrollbar = rect.right - event.clientX <= scrollbarActivationWidth;

    if (isNearScrollbar) {
      revealColumnScrollbar(status);
    } else if (visibleColumnScrollbar === status) {
      hideColumnScrollbar(status);
    }
  }

  async function handleLifecycleDisposition(item: RailsItem, status: 'Archived' | 'Cancelled' | 'Reopened') {
    const reason = draftLifecycleReason.trim();

    if (reason.length < 5 || isSaving) {
      const label = status === 'Archived' ? 'archive' : status === 'Reopened' ? 'reopen' : 'cancellation';
      setErrorMessage(`Enter a ${label} reason with at least 5 characters.`);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      const updatedItem = await updateRailsItem(item.id, status === 'Archived'
        ? { archiveReason: reason, status }
        : status === 'Reopened'
          ? { reopenReason: reason, status }
          : { cancelReason: reason, status });
      if (status === 'Archived' || status === 'Cancelled') {
        setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
        setActiveItemId('');
      } else {
        replaceItem(updatedItem);
      }
      setDraftLifecycleReason('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function handlePanelDragStart(kind: RailsPanelKind, event: React.PointerEvent<HTMLElement>) {
    const panel = kind === 'left' ? leftPanel : rightPanel;

    if (!panel.detached) {
      return;
    }

    if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      x: panel.x,
      y: panel.y
    };
  }

  function handlePanelResizeStart(kind: RailsPanelKind, edge: RailsPanelResizeEdge, event: React.PointerEvent<HTMLElement>) {
    const panel = kind === 'left' ? leftPanel : rightPanel;

    if (!panel.detached && kind === 'left' && edge !== 'right') {
      return;
    }

    if (!panel.detached && kind === 'right' && edge !== 'left') {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanelResizing(true);
    resizeRef.current = {
      edge,
      kind,
      startHeight: panel.height,
      startPanelX: panel.x,
      startWidth: panel.width,
      startX: event.clientX,
      startY: event.clientY
    };
  }

  const isLeftPanelVisible = leftPanel.open && (Boolean(activeItem) || isStageFilterPanelActive || leftPanelMode === 'assistant');
  const leftDockWidth = isLeftPanelVisible && !leftPanel.detached ? `${leftPanel.width}px` : '0px';
  const rightDockWidth = activeItem && rightPanel.open && !rightPanel.detached ? `${rightPanel.width}px` : '0px';
  const boardCollaboratorsPopoverItem = boardCollaboratorsPopover
    ? items.find((item) => item.id === boardCollaboratorsPopover.itemId) || null
    : null;
  const boardCollaboratorsPopoverPeople = boardCollaboratorsPopoverItem
    ? getRailsVisibleCollaborators(boardCollaboratorsPopoverItem)
    : [];
  const boardHintPopoverItem = boardHintPopover
    ? items.find((item) => item.id === boardHintPopover.itemId) || null
    : null;
  const boardHintGuidance = boardHintPopoverItem ? getRailsStageGuidance(boardHintPopoverItem) : null;
  const actionContextMenuAction = activeItem && actionContextMenu
    ? activeItem.actions.find((action) => action.actionId === actionContextMenu.actionId) || null
    : null;
  const actionContextMenuIndex = activeItem && actionContextMenuAction
    ? activeItem.actions.findIndex((action) => action.actionId === actionContextMenuAction.actionId)
    : -1;
  const actionPendingDelete = activeItem && actionPendingDeleteId
    ? activeItem.actions.find((action) => action.actionId === actionPendingDeleteId) || null
    : null;
  const pendingDeleteEvidence = activeItem && actionPendingDelete
    ? activeItem.evidence.filter((evidence) => actionPendingDelete.evidenceIds.includes(evidence.evidenceId))
    : [];
  const evidenceLinkWarningAction = activeItem && evidenceLinkWarning
    ? activeItem.actions.find((action) => action.actionId === evidenceLinkWarning.actionId) || null
    : null;
  const evidenceLinkWarningEvidence = activeItem && evidenceLinkWarning
    ? activeItem.evidence.find((evidence) => evidence.evidenceId === evidenceLinkWarning.evidenceId) || null
    : null;
  const evidenceHintItem = activeItem && evidenceHint
    ? activeItem.evidence.find((evidence) => evidence.evidenceId === evidenceHint.evidenceId) || null
    : null;
  const evidenceHintUploader = evidenceHintItem
    ? getRailsUserByUid(activeItem, candidates, evidenceHintItem.uploadedByUid)
    : null;
  const evidenceContextMenuItem = activeItem && evidenceContextMenu
    ? activeItem.evidence.find((evidence) => evidence.evidenceId === evidenceContextMenu.evidenceId) || null
    : null;
  const visibleEvidence = activeItem
    ? activeItem.evidence.filter((evidence) => evidence.status !== 'Required')
    : [];
  const evidenceSearchTerm = evidenceSearch.trim().toLowerCase();
  const filteredEvidence = evidenceSearchTerm
    ? visibleEvidence.filter((evidence) => getEvidenceSearchText(evidence).includes(evidenceSearchTerm))
    : visibleEvidence;
  const evidenceLibraryPanel = activeItem ? (
    <section className="rails-detail-section rails-evidence-library-panel">
      <div className="rails-evidence-library-head">
        <div>
          <h3><Paperclip aria-hidden="true" size={16} /> Evidence Library</h3>
          <p className="rails-evidence-guidance">Upload evidence once. RAILS action, verification, standardization, and closure steps can link or unlink visible evidence with checkboxes.</p>
        </div>
        <div className="rails-evidence-view-toggle" aria-label="Evidence view style">
          <button
            aria-label="List evidence view"
            aria-pressed={evidenceViewStyle === 'list'}
            className={evidenceViewStyle === 'list' ? 'is-active' : ''}
            onClick={() => setEvidenceViewStyle('list')}
            title="List view"
            type="button"
          >
            <List aria-hidden="true" size={15} />
          </button>
          <button
            aria-label="Grid evidence view"
            aria-pressed={evidenceViewStyle === 'grid'}
            className={evidenceViewStyle === 'grid' ? 'is-active' : ''}
            onClick={() => setEvidenceViewStyle('grid')}
            title="Grid view"
            type="button"
          >
            <LayoutGrid aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
      <label className="rails-evidence-search">
        <Search aria-hidden="true" size={15} />
        <input
          aria-label="Search evidence"
          onChange={(event) => setEvidenceSearch(event.target.value)}
          placeholder="Search evidence by name, upload date, time, or file type"
          type="search"
          value={evidenceSearch}
        />
        {evidenceSearch ? (
          <button aria-label="Clear evidence search" onClick={() => setEvidenceSearch('')} type="button">
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </label>
      <div className={`rails-evidence-list is-${evidenceViewStyle}`}>
        {filteredEvidence.length ? filteredEvidence.map((evidence) => {
          const imageEvidenceThumbUrl = evidenceThumbUrls[`${activeItem.id}:${evidence.evidenceId}`];
          const evidenceThumbUrl = getEvidenceThumbnailUrl(evidence, imageEvidenceThumbUrl);
          const isImageEvidence = Boolean(imageEvidenceThumbUrl && evidence.contentType?.startsWith('image/'));
          const visibility = evidence.visibility === 'private' ? 'private' : 'public';
          const isEvidenceOwner = evidence.uploadedByUid === context?.user.uid;
          return (
            <div key={evidence.evidenceId}>
              <div
                className={`rails-evidence is-${visibility}`}
                onContextMenu={(event) => openEvidenceContextMenu(event, evidence)}
              >
                <button
                  aria-label={`Show ${evidence.label} metadata`}
                  className="rails-evidence-hint-button"
                  onClick={(event) => {
                    const buttonRect = event.currentTarget.getBoundingClientRect();
                    const width = Math.min(360, Math.max(300, window.innerWidth - 24));
                    const left = Math.max(12, Math.min(window.innerWidth - width - 12, buttonRect.right - width));
                    const belowTop = buttonRect.bottom + 8;
                    const preferredHeight = 330;
                    const top = belowTop + preferredHeight < window.innerHeight
                      ? belowTop
                      : Math.max(RAILS_PANEL_TOP_LIMIT, buttonRect.top - preferredHeight - 8);

                    setEvidenceHint((currentHint) => currentHint?.evidenceId === evidence.evidenceId ? null : {
                      evidenceId: evidence.evidenceId,
                      left,
                      top,
                      width
                    });
                  }}
                  type="button"
                >
                  <Info aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label={`Open ${evidence.label}`}
                  className={`rails-evidence-thumb-button ${isImageEvidence ? 'is-photo' : 'is-document'}`}
                  onClick={() => {
                    if (isImageEvidence) {
                      setEvidencePreview({
                        fileName: evidence.fileName || undefined,
                        label: evidence.label,
                        url: evidenceThumbUrl
                      });
                      return;
                    }

                    void handleOpenEvidenceFile(evidence);
                  }}
                  type="button"
                >
                  <img alt="" className="rails-evidence-thumb" src={evidenceThumbUrl} />
                </button>
                <div className="rails-evidence-main">
                  <span>Evidence label</span>
                  <button
                    aria-label={`Open ${evidence.label}`}
                    className="rails-evidence-name-button"
                    onClick={() => {
                      if (isImageEvidence) {
                        setEvidencePreview({
                          fileName: evidence.fileName || undefined,
                          label: evidence.label,
                          url: evidenceThumbUrl
                        });
                        return;
                      }

                      void handleOpenEvidenceFile(evidence);
                    }}
                    type="button"
                  >
                    {evidence.label}
                  </button>
                  {shouldShowEvidenceFileName(evidence.label, evidence.fileName) ? <small>{evidence.fileName}</small> : null}
                </div>
                <div className="rails-evidence-actions">
                  <span className={`rails-evidence-visibility-badge is-${visibility}`}>
                    {visibility}
                  </span>
                </div>
              </div>
              {evidencePendingDeleteId === evidence.evidenceId ? (
                <div className="rails-evidence-delete-warning" role="alert">
                  <header>
                    <AlertTriangle aria-hidden="true" size={16} />
                    <span>Delete evidence?</span>
                  </header>
                  <p>
                    This will delete "{evidence.label}" from the centralized Evidence Library and unlink it from every RAILS step that uses it. Only the uploader can complete this action.
                  </p>
                  <footer>
                    <button disabled={isSaving} onClick={() => setEvidencePendingDeleteId('')} type="button">
                      Keep evidence
                    </button>
                    <button
                      disabled={isSaving || !isEvidenceOwner}
                      onClick={() => void handleConfirmDeleteEvidence(activeItem, evidence.evidenceId)}
                      type="button"
                    >
                      {isSaving ? 'Deleting' : 'Delete evidence'}
                    </button>
                  </footer>
                </div>
              ) : null}
            </div>
          );
        }) : (
          <div className="rails-evidence-empty">
            <Search aria-hidden="true" size={16} />
            <span>No evidence matches this search.</span>
          </div>
        )}
      </div>
      <button
        aria-label="Open evidence upload"
        className="rails-evidence-upload-fab"
        disabled={isSaving}
        onClick={() => setIsEvidenceUploadModalOpen(true)}
        type="button"
      >
        <UploadCloud aria-hidden="true" size={20} />
      </button>
    </section>
  ) : null;

  return (
    <section className="rails-workspace" aria-label="RAILS command center">
      {boardCollaboratorsPopover && boardCollaboratorsPopoverItem && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="rails-card-access-dropdown"
            ref={boardCollaboratorsMenuRef}
            role="dialog"
            aria-label={`${boardCollaboratorsPopoverItem.displayId} visibility list`}
            style={{
              left: `${boardCollaboratorsPopover.left}px`,
              top: `${boardCollaboratorsPopover.top}px`,
              width: `${boardCollaboratorsPopover.width}px`
            }}
          >
            <div className="rails-card-access-dropdown-header">
              <span>Can see this RAIL</span>
              <small>{boardCollaboratorsPopoverPeople.length} people</small>
            </div>
            <div className="rails-card-access-list" style={{ maxHeight: `${boardCollaboratorsPopover.maxListHeight}px` }}>
              {boardCollaboratorsPopoverPeople.map((person) => (
                <div className="rails-card-access-person" key={`${boardCollaboratorsPopoverItem.id}-${person.uid}`}>
                  <RailsUserAvatar user={person} />
                  <div>
                    <span>{person.displayName}</span>
                    <small>{person.roleName}{person.departmentName ? `, ${person.departmentName}` : ''}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
        : null}
      {boardHintPopover && boardHintPopoverItem && boardHintGuidance && typeof document !== 'undefined'
        ? createPortal(
          <div
            className={`rails-card-hint-popover is-${getRailsStatusToneClass(boardHintPopoverItem.status)}`}
            ref={boardHintMenuRef}
            role="dialog"
            aria-label={`${boardHintPopoverItem.displayId} stage guidance`}
            style={{
              left: `${boardHintPopover.left}px`,
              maxHeight: `${boardHintPopover.maxHeight}px`,
              top: `${boardHintPopover.top}px`,
              width: `${boardHintPopover.width}px`
            }}
          >
            <div className="rails-card-hint-header">
              <span>{boardHintPopoverItem.status} guidance</span>
              <small>{boardHintPopoverItem.displayId}</small>
            </div>
            <div className="rails-card-hint-body">
              <p>{boardHintGuidance.summary}</p>
              <div className="rails-card-hint-facts">
                <span>Owner: {boardHintPopoverItem.owner.displayName}</span>
                <span>Due: {formatDateLabel(boardHintPopoverItem.dueDate)}</span>
                <span>Stage readiness: {getDisplayRailsItemStageReadinessPercent(boardHintPopoverItem)}%</span>
              </div>
              <section>
                <span>Manager focus</span>
                <ul>
                  {boardHintGuidance.focus.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
              <section>
                <span>Before moving forward</span>
                <ul>
                  {boardHintGuidance.gates.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>,
          document.body
        )
        : null}
      {evidenceLinkWarning && activeItem && evidenceLinkWarningAction && evidenceLinkWarningEvidence && typeof document !== 'undefined'
        ? createPortal(
          <div
            aria-label={`Confirm unlinking ${evidenceLinkWarningEvidence.label}`}
            className="rails-evidence-unlink-warning"
            ref={evidenceLinkWarningRef}
            role="dialog"
            style={{
              left: `${evidenceLinkWarning.left}px`,
              top: `${evidenceLinkWarning.top}px`,
              width: `${evidenceLinkWarning.width}px`
            }}
          >
            <header>
              <AlertTriangle aria-hidden="true" size={16} />
              <span>Confirm evidence unlink</span>
            </header>
            <p>
              "{evidenceLinkWarningEvidence.label}" will be unlinked from "{evidenceLinkWarningAction.title}". The evidence will stay in the centralized Evidence Library.
            </p>
            <footer>
              <button disabled={isSaving} onClick={() => setEvidenceLinkWarning(null)} type="button">
                Keep linked
              </button>
              <button
                disabled={isSaving}
                onClick={() => void handleSetActionEvidenceLink(activeItem, evidenceLinkWarningAction, evidenceLinkWarningEvidence.evidenceId, false)}
                type="button"
              >
                Unlink evidence
              </button>
            </footer>
          </div>,
          document.body
        )
        : null}
      {evidenceHint && activeItem && evidenceHintItem && typeof document !== 'undefined'
        ? createPortal(
          <div
            aria-label={`${evidenceHintItem.label} evidence details`}
            className="rails-evidence-hint-popover"
            ref={evidenceHintRef}
            role="dialog"
            style={{
              left: `${evidenceHint.left}px`,
              top: `${evidenceHint.top}px`,
              width: `${evidenceHint.width}px`
            }}
          >
            <header>
              <span>Evidence details</span>
              <small>{evidenceHintItem.visibility === 'private' ? 'Private' : 'Public'}</small>
            </header>
            <div className="rails-evidence-hint-uploader">
              {evidenceHintUploader ? <RailsUserAvatar user={evidenceHintUploader} /> : <span className="rails-user-avatar">SY</span>}
              <div>
                <span>{evidenceHintUploader?.displayName || 'Synzapp user'}</span>
                <small>{evidenceHintItem.uploadedAtIso ? formatDateTimeStamp(evidenceHintItem.uploadedAtIso) : 'Upload time unavailable'}</small>
              </div>
            </div>
            <dl>
              <div>
                <dt>File name</dt>
                <dd>{evidenceHintItem.fileName || evidenceHintItem.label}</dd>
              </div>
              <div>
                <dt>File type</dt>
                <dd>{evidenceHintItem.contentType || inferEvidenceTypeLabel(evidenceHintItem.fileName)}</dd>
              </div>
              <div>
                <dt>File size</dt>
                <dd>{formatFileSize(evidenceHintItem.fileSizeBytes)}</dd>
              </div>
              <div>
                <dt>Availability</dt>
                <dd>Available for RAILS evidence linking and verification.</dd>
              </div>
            </dl>
            <button
              className={`rails-evidence-visibility-switch ${evidenceHintItem.visibility === 'private' ? 'is-private' : ''}`}
              disabled={isSaving}
              onClick={() => void handleUpdateEvidenceMetadata(activeItem, evidenceHintItem.evidenceId, {
                visibility: evidenceHintItem.visibility === 'private' ? 'public' : 'private'
              })}
              type="button"
            >
              {evidenceHintItem.visibility === 'private' ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
              <span>{evidenceHintItem.visibility === 'private' ? 'Private visibility' : 'Public visibility'}</span>
              <i aria-hidden="true" />
            </button>
          </div>,
          document.body
        )
        : null}
      {evidenceContextMenu && activeItem && evidenceContextMenuItem && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="rails-evidence-context-menu"
            ref={evidenceContextMenuRef}
            role="menu"
            style={{
              left: `${evidenceContextMenu.left}px`,
              top: `${evidenceContextMenu.top}px`
            }}
          >
            <button
              disabled={isSaving || !evidenceContextMenuItem.contentType?.startsWith('image/')}
              onClick={() => {
                setEvidenceEditorId(evidenceContextMenuItem.evidenceId);
                setEvidenceContextMenu(null);
              }}
              role="menuitem"
              type="button"
            >
              <Pencil aria-hidden="true" size={14} />
              Edit evidence
            </button>
            <button
              className="is-danger"
              disabled={isSaving || evidenceContextMenuItem.uploadedByUid !== context?.user.uid}
              onClick={() => {
                setEvidencePendingDeleteId(evidenceContextMenuItem.evidenceId);
                setEvidenceContextMenu(null);
              }}
              role="menuitem"
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} />
              Delete evidence
            </button>
          </div>,
          document.body
        )
        : null}
      {actionContextMenu && activeItem && actionContextMenuAction && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="rails-action-context-menu"
            ref={actionContextMenuRef}
            role="menu"
            style={{
              left: `${actionContextMenu.left}px`,
              top: `${actionContextMenu.top}px`
            }}
          >
            <button
              disabled={isSaving || actionContextMenuIndex <= 0}
              onClick={() => void handleReorderAction(activeItem, actionContextMenuAction.actionId, 'up')}
              role="menuitem"
              type="button"
            >
              <ArrowUp aria-hidden="true" size={14} />
              Move up
            </button>
            <button
              disabled={isSaving || actionContextMenuIndex < 0 || actionContextMenuIndex >= activeItem.actions.length - 1}
              onClick={() => void handleReorderAction(activeItem, actionContextMenuAction.actionId, 'down')}
              role="menuitem"
              type="button"
            >
              <ArrowDown aria-hidden="true" size={14} />
              Move down
            </button>
            <button
              className="is-danger"
              disabled={isSaving || activeItem.actions.length <= 1}
              onClick={() => {
                setActionPendingDeleteId(actionContextMenuAction.actionId);
                setActionContextMenu(null);
              }}
              role="menuitem"
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} />
              Delete action
            </button>
          </div>,
          document.body
        )
        : null}
      {actionPendingDelete && activeItem && typeof document !== 'undefined'
        ? createPortal(
          <div
            aria-labelledby="rails-action-delete-title"
            aria-modal="true"
            className="rails-error-modal rails-action-delete-modal"
            onClick={() => !isSaving ? setActionPendingDeleteId('') : undefined}
            role="dialog"
          >
            <div className="rails-error-modal-card rails-action-delete-card" onClick={(event) => event.stopPropagation()}>
              <div className="rails-error-modal-icon">
                <AlertTriangle aria-hidden="true" size={26} />
              </div>
              <div>
                <span>Controlled delete</span>
                <h2 id="rails-action-delete-title">Delete this action step?</h2>
                <p>
                  This will permanently delete "{actionPendingDelete.title}" from this RAILS loop. Any evidence linked to this action step will also be unlinked. The evidence records will stay in the centralized Evidence Library.
                </p>
                <div className="rails-action-delete-summary">
                  <span>Action status: {actionPendingDelete.status}</span>
                  <span>Progress: {actionPendingDelete.progressPercent}%</span>
                  <span>Linked evidence: {pendingDeleteEvidence.length}</span>
                </div>
                {pendingDeleteEvidence.length ? (
                  <ul className="rails-action-delete-evidence">
                    {pendingDeleteEvidence.map((evidence) => (
                      <li key={evidence.evidenceId}>{evidence.label}{evidence.fileName ? ` - ${evidence.fileName}` : ''}</li>
                    ))}
                  </ul>
                ) : null}
                <p>
                  The backend will log the previous action content, deletion date and time, and the user who initiated the delete.
                </p>
              </div>
              <footer>
                <button disabled={isSaving} onClick={() => setActionPendingDeleteId('')} type="button">
                  Keep action
                </button>
                <button disabled={isSaving} onClick={() => void handleConfirmDeleteAction(activeItem, actionPendingDelete.actionId)} type="button">
                  {isSaving ? 'Deleting' : 'Delete action'}
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )
        : null}
      <header className="rails-command-bar">
        <div className="rails-title-block">
          <div className="rails-module-icon">
            <Network aria-hidden="true" size={22} />
          </div>
          <div>
            <span>{context?.company.companyName || 'Rapid Action and Improvement Looping System'}</span>
            <h1>RAILS Command Center</h1>
          </div>
        </div>

        <div className="rails-view-switch" aria-label="RAILS workspace views">
          {([
            ['board', ClipboardList, 'Board'],
            ['report', BarChart3, 'Report'],
            ['history', Search, 'History']
          ] as const).map(([view, Icon, label]) => (
            <button
              className={workspaceView === view ? 'is-active' : ''}
              key={view}
              onClick={() => setWorkspaceView(view)}
              type="button"
            >
              <Icon aria-hidden="true" size={15} />
              {label}
            </button>
          ))}
        </div>

        <form className="rails-create-loop" onSubmit={handleCreateLoop}>
          <input
            aria-label="New improvement loop title"
            disabled={isSaving}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Create an improvement loop"
            value={draftTitle}
          />
          <RailsFieldSelect
            aria-label="Loop owner"
            disabled={isSaving || !candidates.length}
            onChange={setDraftOwnerUid}
            options={candidates.length ? candidates.map((candidate) => ({
              label: candidate.displayName,
              value: candidate.uid
            })) : [{ label: 'No active users', value: '' }]}
            style={{ '--rails-owner-name-length': ownerFieldNameLength } as React.CSSProperties}
            value={draftOwnerUid}
          />
          <button disabled={isSaving || !draftTitle.trim()} type="submit">
            <Plus aria-hidden="true" size={16} />
            {isSaving ? 'Saving' : 'Add loop'}
          </button>
        </form>
      </header>

      <main
        className={`rails-main ${activeItem ? 'has-active-loop' : ''} ${isLeftPanelVisible ? 'has-left-panel' : ''} ${isPanelResizing ? 'is-resizing' : ''}`}
        style={{
          '--rails-left-width': leftDockWidth,
          '--rails-right-width': rightDockWidth
        } as React.CSSProperties}
      >
        {isLeftPanelVisible ? (
          <RailsPanelShell
            kind="left"
            onClose={() => {
              if (leftPanelMode === 'assistant') {
                closeRailsAssistantPanel();
                return;
              }

              if (isStageFilterPanelActive) {
                closeStageFilterPanel(false);
                return;
              }

              updatePanel('left', (panel) => ({ ...panel, open: false }));
            }}
            onDetachToggle={() => updatePanel('left', (panel) => ({ ...panel, detached: !panel.detached }))}
            onDragStart={handlePanelDragStart}
            onResizeStart={handlePanelResizeStart}
            panel={leftPanel}
            headerActions={(
              <button
                aria-label={leftPanelMode === 'assistant' ? 'Close RAILS AI assistant' : 'Open RAILS AI assistant'}
                aria-pressed={leftPanelMode === 'assistant'}
                className={`rails-ai-panel-trigger ${leftPanelMode === 'assistant' ? 'is-active' : ''}`}
                onClick={() => {
                  if (leftPanelMode === 'assistant') {
                    closeRailsAssistantPanel();
                    return;
                  }

                  openRailsAssistantPanel();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                type="button"
              >
                <Bot aria-hidden="true" size={14} />
              </button>
            )}
            title="RAILS Controls"
          >
            <section className={`rails-left-panel ${isStageFilterPanelActive ? 'is-filter-mode' : ''} ${leftPanelMode === 'assistant' ? 'is-assistant-mode' : ''}`} aria-label="RAILS governance and metrics">
          {leftPanelMode === 'assistant' ? (
            <RailsAssistantPanel
              activeItem={activeItem}
              isResponding={isAssistantResponding}
              messages={assistantMessages}
              onAsk={(question) => void handleAskRailsAssistant(question)}
              onClose={closeRailsAssistantPanel}
              question={draftAssistantQuestion}
              setQuestion={setDraftAssistantQuestion}
            />
          ) : isStageFilterPanelActive ? (
            <div className="rails-stage-filter-panel">
              <div className="rails-stage-filter-scroll">
                <div className="rails-panel-heading">
                  <Filter aria-hidden="true" size={18} />
                  <h2>Stage Filters</h2>
                </div>
                <div className="rails-stage-filter-list" role="list">
                  {railsStageFilters.map(({ Icon, description, label, status, tone }) => {
                    const count = status === 'All' ? items.length : stageCounts[status];
                    const isSelected = activeStageFilter === status;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`rails-stage-filter-card is-${tone} ${isSelected ? 'is-active' : ''}`}
                        key={status}
                        onClick={() => {
                          setActiveStageFilter(status);
                          if (status !== 'All') {
                            setBoardStatusFilter('All');
                          }
                        }}
                        type="button"
                      >
                        <span className="rails-stage-filter-icon">
                          <Icon aria-hidden="true" size={17} />
                        </span>
                        <span>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </span>
                        <span className="rails-stage-filter-state">
                          {isSelected ? (
                            <em>
                              <CheckCircle2 aria-hidden="true" size={12} />
                              Selected
                            </em>
                          ) : null}
                          <b>{count}</b>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="rails-stage-filter-fields" aria-label="Selected stage filters">
                  <div className="rails-stage-filter-fields-header">
                    <span>Filter fields</span>
                    <strong>{stageScopedItems.length} in scope</strong>
                  </div>
                  <label className="rails-stage-filter-field is-wide">
                    <span>Name</span>
                    <div className="rails-stage-filter-input">
                      <Search aria-hidden="true" size={15} />
                      <input
                        onChange={(event) => setBoardNameFilter(event.target.value)}
                        placeholder="Search name, owner, RCA, department"
                        type="search"
                        value={boardNameFilter}
                      />
                    </div>
                  </label>
                  <label className="rails-stage-filter-field">
                    <span>Date</span>
                    <RailsDatePicker onChange={setBoardDateFilter} value={boardDateFilter} />
                  </label>
                  <label className="rails-stage-filter-field">
                    <span>Priority</span>
                    <RailsFieldSelect
                      onChange={(value) => setBoardPriorityFilter(value as RailsPriority | 'All')}
                      options={[
                        { label: 'All priorities', value: 'All' },
                        { label: 'Critical', value: 'Critical' },
                        { label: 'High', value: 'High' },
                        { label: 'Medium', value: 'Medium' },
                        { label: 'Low', value: 'Low' }
                      ]}
                      value={boardPriorityFilter}
                    />
                  </label>
                  <label className="rails-stage-filter-field">
                    <span>Status</span>
                    <RailsFieldSelect
                      disabled={activeStageFilter !== 'All'}
                      onChange={(value) => setBoardStatusFilter(value as RailsStatus | 'All')}
                      options={[
                        { label: 'All statuses', value: 'All' },
                        ...railsStatuses.map((status) => ({ label: status, value: status }))
                      ]}
                      value={activeStageFilter !== 'All' ? activeStageFilter : boardStatusFilter}
                    />
                  </label>
                </div>
              </div>
              <footer className="rails-stage-filter-actions">
                <button disabled={!hasActiveBoardFilters} onClick={clearBoardFilters} type="button">
                  Clear filters
                </button>
                <button onClick={() => closeStageFilterPanel(true)} type="button">
                  Cancel
                </button>
                <button onClick={() => closeStageFilterPanel(false)} type="button">
                  Close
                </button>
              </footer>
            </div>
          ) : (
            <>
              <div className="rails-metric-grid">
                <MetricCard icon={ClipboardList} label="Open loops" value={openItems.toString()} tone="blue" />
                <MetricCard icon={AlertTriangle} label="Critical risk" value={criticalItems.toString()} tone="red" />
                <MetricCard icon={Bell} label="Escalated" value={escalatedItems.toString()} tone="red" />
                <MetricCard icon={BadgeCheck} label="In verification" value={verificationItems.toString()} tone="green" />
                <MetricCard icon={TrendingUp} label="Stage readiness" value={`${completionRate}%`} tone="amber" />
              </div>

              <div className="rails-governance-panel">
                <div className="rails-panel-heading">
                  <ShieldCheck aria-hidden="true" size={18} />
                  <h2>Enterprise Controls</h2>
                </div>
                <ul>
                  <li><CheckCircle2 aria-hidden="true" size={16} /> One accountable owner per loop</li>
                  <li><FileCheck2 aria-hidden="true" size={16} /> Evidence required before closure</li>
                  <li><UserRoundCheck aria-hidden="true" size={16} /> Approval gate for high-risk work</li>
                  <li><Bell aria-hidden="true" size={16} /> Escalation path for overdue loops</li>
                </ul>
              </div>

              <div className="rails-linkage-panel">
                <div className="rails-panel-heading">
                  <Sparkles aria-hidden="true" size={18} />
                  <h2>Synzapp Flow</h2>
                </div>
                <div className="rails-flow-step">
                  <span>LSW</span>
                  <ArrowRight aria-hidden="true" size={16} />
                  <span>RCA</span>
                  <ArrowRight aria-hidden="true" size={16} />
                  <span>RAILS</span>
                </div>
                <p>Observations become root-cause learning, then verified action loops with evidence and audit history.</p>
              </div>
            </>
          )}
            </section>
          </RailsPanelShell>
        ) : null}

        <section className="rails-board-panel" aria-label="RAILS workspace view">
          {workspaceView === 'board' ? (
            <>
              <div className="rails-board-toolbar">
                <div>
                  <h2>Improvement Board</h2>
                  <p>{isLoading ? 'Loading live company loops...' : `${filteredItems.length} loops visible across enterprise workflow stages`}</p>
                </div>
                <div className="rails-filter-group" aria-label="Board filters">
                  <button
                    aria-label={isStageFilterPanelActive ? 'Hide stage filters' : 'Show stage filters'}
                    aria-pressed={isStageFilterPanelActive}
                    className={`rails-filter-toggle ${isStageFilterPanelActive ? 'is-active' : ''}`}
                    onClick={() => {
                      if (isStageFilterPanelActive) {
                        closeStageFilterPanel(false);
                        return;
                      }

                      updatePanel('left', (panel) => ({ ...panel, open: true }));
                      setLeftPanelMode('filters');
                      setIsStageFilterPanelActive(true);
                    }}
                    type="button"
                  >
                    <Filter aria-hidden="true" size={15} />
                  </button>
                  {(['All', 'Critical', 'High', 'Overdue'] as const).map((filter) => (
                    <button
                      className={activeFilter === filter ? 'is-active' : ''}
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      type="button"
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="rails-loading-state">
                  <RefreshCw aria-hidden="true" size={22} />
                  Loading RAILS workspace
                </div>
              ) : items.length ? (
                <div className="rails-board">
                  {railsStatuses.map((status) => {
                    const statusItems = filteredItems
                      .filter((item) => item.status === status)
                      .sort((left, right) => priorityRank[right.priority] - priorityRank[left.priority]);

                    return (
                      <section className={`rails-column is-${getRailsStatusToneClass(status)}`} key={status} aria-label={`${status} RAILS loops`}>
                        <div className="rails-column-header">
                          <span>{status}</span>
                          <strong>{statusItems.length}</strong>
                        </div>

                        <div
                          className={`rails-column-body ${visibleColumnScrollbar === status ? 'is-scrollbar-visible' : ''}`}
                          onMouseLeave={() => hideColumnScrollbar(status)}
                          onMouseMove={(event) => handleColumnBodyMouseMove(status, event)}
                          onScroll={() => {
                            if (visibleColumnScrollbar === status) {
                              revealColumnScrollbar(status);
                            }
                            setBoardCollaboratorsPopover(null);
                          }}
                        >
                          {statusItems.length ? statusItems.map((item) => {
                            const visibleCollaborators = getRailsVisibleCollaborators(item);
                            const isCollaboratorListOpen = boardCollaboratorsPopover?.itemId === item.id;
                            const stageReadinessPercent = getDisplayRailsItemStageReadinessPercent(item);

                            return (
                              <article
                                aria-current={item.id === activeItem?.id ? 'true' : undefined}
                                className={`rails-card ${item.id === activeItem?.id ? 'is-selected' : ''} ${isCollaboratorListOpen ? 'is-access-open' : ''}`}
                                key={item.id}
                              >
                                <button
                                  className="rails-card-main"
                                  onClick={() => handleCardSelect(item.id)}
                                  type="button"
                                >
                                  {item.id === activeItem?.id ? (
                                    <span className="rails-card-selected-marker">
                                      <CheckCircle2 aria-hidden="true" size={13} />
                                      Selected
                                    </span>
                                  ) : null}
                                  <div className="rails-card-topline">
                                    <span className={`rails-priority is-${item.priority.toLowerCase()}`}>{item.priority}</span>
                                    <span>{item.displayId}</span>
                                  </div>
                                  {item.escalation.overdue ? (
                                    <span className={`rails-escalation-badge is-${item.escalation.level.toLowerCase()}`}>
                                      <Bell aria-hidden="true" size={12} />
                                      {item.escalation.level} · {item.escalation.overdueDays}d
                                    </span>
                                  ) : null}
                                  <h3>{item.title}</h3>
                                  <p>{item.problem}</p>
                                  <div className="rails-card-meta">
                                    <span><Clock3 aria-hidden="true" size={14} /> {formatDateLabel(item.dueDate)}</span>
                                    <span><CircleDot aria-hidden="true" size={14} /> {item.category}</span>
                                  </div>
                                  <div className="rails-progress-row">
                                    <div
                                      className="rails-progress-track"
                                      style={getProgressTrackStyle(stageReadinessPercent)}
                                      aria-label={`${stageReadinessPercent}% stage readiness`}
                                    >
                                      <span style={{ width: `${stageReadinessPercent}%` }} />
                                    </div>
                                    <small>{stageReadinessPercent}%</small>
                                  </div>
                                </button>
                                <div className="rails-card-access-menu">
                                  <button
                                    aria-expanded={isCollaboratorListOpen}
                                    aria-label={`${visibleCollaborators.length} people can see ${item.displayId}`}
                                    className={`rails-card-access-badge ${isCollaboratorListOpen ? 'is-open' : ''}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      const badgeRect = event.currentTarget.getBoundingClientRect();
                                      const width = Math.min(284, Math.max(238, window.innerWidth - 24));
                                      const left = Math.max(12, Math.min(window.innerWidth - width - 12, badgeRect.right - width));
                                      const belowTop = badgeRect.bottom + 8;
                                      const belowSpace = window.innerHeight - belowTop - 12;
                                      const preferredHeight = Math.min(260, Math.max(170, visibleCollaborators.length * 52 + 54));
                                      const top = belowSpace >= Math.min(170, preferredHeight)
                                        ? belowTop
                                        : Math.max(RAILS_PANEL_TOP_LIMIT, badgeRect.top - preferredHeight - 8);
                                      const maxListHeight = Math.max(120, Math.min(206, window.innerHeight - top - 68));

                                      setBoardHintPopover(null);
                                      setBoardCollaboratorsPopover((currentPopover) => {
                                        if (currentPopover?.itemId === item.id) {
                                          return null;
                                        }

                                        return {
                                          itemId: item.id,
                                          left,
                                          maxListHeight,
                                          top,
                                          width
                                        };
                                      });
                                    }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    type="button"
                                  >
                                    <UsersRound aria-hidden="true" size={12} />
                                    <span>{visibleCollaborators.length}</span>
                                  </button>
                                </div>
                                <button
                                  aria-expanded={boardHintPopover?.itemId === item.id}
                                  aria-label={`Show ${item.displayId} stage guidance`}
                                  className={`rails-card-hint-button ${boardHintPopover?.itemId === item.id ? 'is-open' : ''}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const buttonRect = event.currentTarget.getBoundingClientRect();
                                    const viewportMargin = 12;
                                    const width = Math.min(380, Math.max(300, window.innerWidth - 24));
                                    const left = Math.max(12, Math.min(window.innerWidth - width - 12, buttonRect.right - width));
                                    const belowTop = buttonRect.bottom + 8;
                                    const aboveBottom = buttonRect.top - 8;
                                    const lowerLimit = window.innerHeight - viewportMargin;
                                    const upperLimit = Math.max(RAILS_PANEL_TOP_LIMIT, viewportMargin);
                                    const belowSpace = lowerLimit - belowTop;
                                    const aboveSpace = aboveBottom - upperLimit;
                                    const preferredHeight = 430;
                                    const minimumUsefulHeight = 240;
                                    const openBelow = belowSpace >= minimumUsefulHeight || belowSpace >= aboveSpace;
                                    const availableHeight = openBelow ? belowSpace : aboveSpace;
                                    const maxHeight = Math.max(180, Math.min(preferredHeight, availableHeight));
                                    const rawTop = openBelow ? belowTop : aboveBottom - maxHeight;
                                    const top = Math.max(upperLimit, Math.min(rawTop, lowerLimit - maxHeight));

                                    setBoardCollaboratorsPopover(null);
                                    setBoardHintPopover((currentPopover) => {
                                      if (currentPopover?.itemId === item.id) {
                                        return null;
                                      }

                                      return {
                                        itemId: item.id,
                                        left,
                                        maxHeight,
                                        top,
                                        width
                                      };
                                    });
                                  }}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  type="button"
                                >
                                  <CircleHelp aria-hidden="true" size={12} />
                                </button>
                              </article>
                            );
                          }) : (
                            <div className="rails-empty-state">No loops</div>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="rails-zero-state">
                  <Network aria-hidden="true" size={28} />
                  <h3>No RAILS loops yet</h3>
                  <p>Create the first improvement loop from the command bar. Owners come from active users in this company.</p>
                </div>
              )}
            </>
          ) : null}

          {workspaceView === 'report' ? (
            <div className="rails-enterprise-view">
              <div className="rails-board-toolbar">
                <div>
                  <h2>Enterprise Report</h2>
                  <p>{railsReport ? `Generated ${formatDateTimeStamp(railsReport.generatedAtIso)}` : 'Loading backend reporting data'}</p>
                </div>
                <button className="rails-secondary-action" disabled={isReportLoading} onClick={() => void loadRailsReport()} type="button">
                  <RefreshCw aria-hidden="true" size={15} />
                  Refresh
                </button>
              </div>

              {isReportLoading || !railsReport ? (
                <div className="rails-loading-state">
                  <RefreshCw aria-hidden="true" size={22} />
                  Loading enterprise report
                </div>
              ) : (
                <>
                  <div className="rails-report-grid">
                    <MetricCard icon={ClipboardList} label="Total loops" meta="All governed RAILS work" value={railsReport.metrics.totalItems.toString()} tone="blue" />
                    <MetricCard icon={BadgeCheck} label="Closure rate" meta="Closed loops vs total" value={`${railsReport.metrics.closureRate}%`} tone="green" />
                    <MetricCard icon={Bell} label="Overdue" meta="Needs escalation attention" value={railsReport.metrics.overdueItems.toString()} tone="red" />
                    <MetricCard icon={TrendingUp} label="Action progress" meta="Average action completion" value={`${railsReport.metrics.actionProgress}%`} tone="amber" />
                    <MetricCard icon={FileCheck2} label="Standardized" meta="Verified prevention plans" value={`${railsReport.metrics.standardizationCompliance}%`} tone="green" />
                    <MetricCard icon={Link2} label="RCA linked" meta="Loops connected to RCA" value={railsReport.metrics.rcaLinkedItems.toString()} tone="blue" />
                  </div>
                  <div className="rails-report-breakdowns">
                    <ReportBreakdown title="By status" rows={railsReport.byStatus} />
                    <ReportBreakdown title="By department" rows={railsReport.byDepartment} />
                    <ReportBreakdown title="Aging" rows={railsReport.agingBuckets} />
                    <ReportBreakdown title="By owner" rows={railsReport.byOwner.slice(0, 6)} />
                  </div>
                </>
              )}
            </div>
          ) : null}

          {workspaceView === 'history' ? (
            <div className="rails-enterprise-view">
              <div className="rails-board-toolbar">
                <div>
                  <h2>History and Archive</h2>
                  <div className="rails-history-header-meta">
                    <p>{isHistoryLoading ? 'Searching secured records...' : `${historyItems.length} records found`}</p>
                    {selectedHistoryItemIds.length ? (
                      <span className="rails-selected-count-badge">
                        <BadgeCheck aria-hidden="true" size={13} />
                        {selectedHistoryItemIds.length} selected
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rails-export-actions">
                  <button className="rails-secondary-action" disabled={isSaving || isHistoryLoading} onClick={() => void handleExportHistory('csv')} type="button">
                    <Download aria-hidden="true" size={15} />
                    CSV
                  </button>
                  <button className="rails-secondary-action" disabled={isSaving || isHistoryLoading} onClick={() => void handleExportHistory('json')} type="button">
                    <Download aria-hidden="true" size={15} />
                    JSON
                  </button>
                </div>
              </div>

              <div className="rails-history-controls">
                <label>
                  <Search aria-hidden="true" size={15} />
                  <input
                    aria-label="Search RAILS history"
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Search title, display ID, owner, RCA, department"
                    value={historySearch}
                  />
                </label>
                <RailsFieldSelect
                  aria-label="History status"
                  onChange={(value) => setHistoryStatus(value as RailsStatus | 'All')}
                  options={(['All', 'New', 'Triaged', 'Reopened', 'In Progress', 'Verification', 'Approved', 'Closed', 'Cancelled', 'Archived'] as const).map((status) => ({
                    label: status,
                    value: status
                  }))}
                  value={historyStatus}
                />
              </div>

              <div className="rails-bulk-toolbar" aria-label="Bulk RAILS actions">
                <RailsFieldSelect
                  aria-label="Bulk owner"
                  onChange={setBulkOwnerUid}
                  options={[
                    { label: 'Owner unchanged', value: '' },
                    ...candidates.map((candidate) => ({ label: candidate.displayName, value: candidate.uid }))
                  ]}
                  value={bulkOwnerUid}
                />
                <RailsFieldSelect
                  aria-label="Bulk priority"
                  onChange={(value) => setBulkPriority(value as RailsPriority | '')}
                  options={[
                    { label: 'Priority unchanged', value: '' },
                    ...(['Critical', 'High', 'Medium', 'Low'] as const).map((priority) => ({ label: priority, value: priority }))
                  ]}
                  value={bulkPriority}
                />
                <RailsFieldSelect
                  aria-label="Bulk category"
                  onChange={(value) => setBulkCategory(value as RailsCategory | '')}
                  options={[
                    { label: 'Category unchanged', value: '' },
                    ...(['Food Safety', 'People Safety', 'Quality', 'Delivery', 'Cost', 'Process'] as const).map((category) => ({ label: category, value: category }))
                  ]}
                  value={bulkCategory}
                />
                <RailsDatePicker
                  disabled={isSaving}
                  onChange={setBulkDueDate}
                  value={bulkDueDate}
                />
                <RailsFieldSelect
                  aria-label="Bulk collaborator"
                  onChange={setBulkCollaboratorUid}
                  options={[
                    { label: 'No collaborator added', value: '' },
                    ...candidates.map((candidate) => ({ label: candidate.displayName, value: candidate.uid }))
                  ]}
                  value={bulkCollaboratorUid}
                />
                <input
                  aria-label="Archive reason"
                  onChange={(event) => setBulkArchiveReason(event.target.value)}
                  placeholder="Archive reason"
                  value={bulkArchiveReason}
                />
                <button
                  disabled={isSaving || !selectedHistoryItemIds.length || (!bulkOwnerUid && !bulkPriority && !bulkCategory && !bulkCollaboratorUid && !bulkDueDate && !bulkArchiveReason.trim())}
                  onClick={() => void handleApplyBulkUpdate()}
                  type="button"
                >
                  Apply bulk update
                </button>
              </div>

              <div className="rails-history-list">
                {isHistoryLoading ? (
                  <div className="rails-loading-state">
                    <RefreshCw aria-hidden="true" size={22} />
                    Loading history
                  </div>
                ) : historyItems.length ? historyItems.map((item) => (
                  <div className={`rails-history-row ${item.id === activeItemId ? 'is-selected' : ''}`} key={item.id}>
                    <input
                      aria-label={`Select ${item.displayId}`}
                      checked={selectedHistoryItemIds.includes(item.id)}
                      onChange={(event) => setSelectedHistoryItemIds((currentIds) => event.target.checked
                        ? [...currentIds, item.id]
                        : currentIds.filter((itemId) => itemId !== item.id)
                      )}
                      type="checkbox"
                    />
                    <button aria-current={item.id === activeItemId ? 'true' : undefined} onClick={() => handleHistorySelect(item)} type="button">
                      <span className={`rails-priority is-${item.priority.toLowerCase()}`}>{item.priority}</span>
                      <div>
                        <strong>{item.displayId} · {item.title}</strong>
                        <p>{item.owner.displayName} · {item.departmentName || 'Unassigned department'} · {formatDateTimeStamp(item.updatedAtIso)}</p>
                      </div>
                      <span>{item.status}</span>
                    </button>
                  </div>
                )) : (
                  <div className="rails-empty-state">No matching records</div>
                )}
              </div>
            </div>
          ) : null}
        </section>

        {activeItem && rightPanel.open ? (
          <RailsPanelShell
            kind="right"
            onClose={() => updatePanel('right', (panel) => ({ ...panel, open: false }))}
            onDetachToggle={() => updatePanel('right', (panel) => ({ ...panel, detached: !panel.detached }))}
            onDragStart={handlePanelDragStart}
            onResizeStart={handlePanelResizeStart}
            panel={rightPanel}
            headerActions={(
              <div className="rails-detail-header-tools">
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button
                      aria-label={`${activeDetailPendingCount} pending task${activeDetailPendingCount === 1 ? '' : 's'} on ${currentDetailPage.label}`}
                      className={`rails-pending-task-trigger ${activeDetailPendingCount ? 'is-pending' : 'is-complete'}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      type="button"
                    >
                      {activeDetailPendingCount ? <AlertTriangle aria-hidden="true" size={13} /> : <CheckCircle2 aria-hidden="true" size={13} />}
                      <span>{activeDetailPendingCount}</span>
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      align="end"
                      className="rails-pending-task-popover"
                      collisionPadding={14}
                      onPointerDown={(event) => event.stopPropagation()}
                      sideOffset={8}
                    >
                      <header>
                        <span>{currentDetailPage.label} readiness</span>
                        <small className={activeDetailPendingCount ? 'is-pending' : 'is-complete'}>{activeDetailPendingCount ? `${activeDetailPendingCount} pending` : 'Complete'}</small>
                      </header>
                      <p>
                        Complete these items before moving this loop forward. The backend gate will continue blocking advancement until the required records are complete.
                      </p>
                      {activeDetailReadinessTasks.length ? (
                        <ul>
                          {activeDetailReadinessTasks.map((task, index) => (
                            <li className={task.complete ? 'is-complete' : ''} key={`${task.key}-${index}`}>
                              {task.complete ? <CheckCircle2 aria-hidden="true" size={13} /> : <AlertCircle aria-hidden="true" size={13} />}
                              <span>{task.label}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="rails-pending-task-complete">
                          <CheckCircle2 aria-hidden="true" size={15} />
                          <span>No pending tasks for this page.</span>
                        </div>
                      )}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              <div
                className="rails-collaborator-menu"
                onPointerDown={(event) => event.stopPropagation()}
                ref={collaboratorMenuRef}
              >
                <button
                  aria-expanded={isCollaboratorMenuOpen}
                  aria-label={`${activeItem.contributors.length} collaborator${activeItem.contributors.length === 1 ? '' : 's'}`}
                  className={`rails-collaborator-trigger ${isCollaboratorMenuOpen ? 'is-active' : ''}`}
                  onClick={() => setIsCollaboratorMenuOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <UsersRound aria-hidden="true" size={14} />
                  <span>{activeItem.contributors.length}</span>
                </button>
                {isCollaboratorMenuOpen ? (
                  <div className="rails-collaborator-dropdown" role="dialog" aria-label="Manage collaborators">
                    <header>
                      <span>Collaborators</span>
                      <small>{activeItem.contributors.length} added</small>
                    </header>
                    <div className="rails-collaborator-add">
                      <RailsFieldSelect
                        disabled={isSaving || !candidates.length}
                        onChange={setDraftCollaboratorUid}
                        options={[
                          { label: 'Select user', value: '' },
                          ...candidates
                          .filter((candidate) => candidate.uid !== activeItem.owner.uid && !activeItem.contributors.some((person) => person.uid === candidate.uid))
                          .map((candidate) => ({ label: candidate.displayName, value: candidate.uid }))
                        ]}
                        value={draftCollaboratorUid}
                      />
                      <button disabled={isSaving || !draftCollaboratorUid} onClick={() => void handleAddCollaborator(activeItem)} type="button">
                        <Plus aria-hidden="true" size={14} />
                        Add
                      </button>
                    </div>
                    <div className="rails-collaborator-list">
                      {activeItem.contributors.length ? activeItem.contributors.map((person) => (
                        <div className="rails-collaborator-row" key={`${activeItem.id}-${person.uid}`}>
                          <RailsUserAvatar user={person} />
                          <div>
                            <strong>{person.displayName}</strong>
                            <small>{person.roleName}{person.departmentName ? `, ${person.departmentName}` : ''}</small>
                          </div>
                          <button
                            aria-label={`Remove ${person.displayName}`}
                            disabled={isSaving}
                            onClick={() => void handleRemoveCollaborator(activeItem, person.uid)}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={13} />
                          </button>
                        </div>
                      )) : (
                        <p>No collaborators added yet.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              </div>
            )}
            tabs={(
              <div aria-label="Loop detail sections" className="rails-panel-tabs" role="tablist">
                <button
                  aria-selected={detailPanelTab === 'details'}
                  className={detailPanelTab === 'details' ? 'is-active' : ''}
                  onClick={() => setDetailPanelTab('details')}
                  role="tab"
                  type="button"
                >
                  Detail
                </button>
                <button
                  aria-selected={detailPanelTab === 'evidence'}
                  className={detailPanelTab === 'evidence' ? 'is-active' : ''}
                  onClick={() => setDetailPanelTab('evidence')}
                  role="tab"
                  type="button"
                >
                  Evidence
                  <span>{attachedEvidenceCount}</span>
                </button>
                <button
                  aria-selected={detailPanelTab === 'log'}
                  className={detailPanelTab === 'log' ? 'is-active' : ''}
                  onClick={() => setDetailPanelTab('log')}
                  role="tab"
                  type="button"
                >
                  Log
                  <span>{activeActivity.length || activeItem.comments.length}</span>
                </button>
              </div>
            )}
            title="Loop Detail"
          >
          <aside className="rails-detail-panel" aria-label="Selected RAILS loop details">
            {detailPanelTab !== 'evidence' ? (
              <>
                <div className="rails-detail-header">
                  <h2>{activeItem.title}</h2>
                  <p>{activeItem.problem}</p>
                </div>

                {activeItem.escalation.overdue ? (
                  <section className={`rails-escalation-panel is-${activeItem.escalation.level.toLowerCase()}`} aria-label="Escalation status">
                    <div>
                      <Bell aria-hidden="true" size={16} />
                      <span>{activeItem.escalation.level} escalation</span>
                      <strong>{activeItem.escalation.overdueDays} day{activeItem.escalation.overdueDays === 1 ? '' : 's'} overdue</strong>
                    </div>
                    <ul>
                      {activeItem.escalation.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <div className="rails-detail-actions">
                  <button disabled={isSaving || !activeItem.workflowGate.canAdvance} onClick={() => void handleAdvanceStatus(activeItem)} type="button">
                    <ArrowRight aria-hidden="true" size={16} />
                    {activeItem.workflowGate.nextStatus ? `Advance to ${activeItem.workflowGate.nextStatus}` : 'No advance'}
                  </button>
                </div>
              </>
            ) : null}

            {detailPanelTab === 'details' ? (
              <>
                <nav className="rails-detail-stepper" aria-label="Loop detail workflow">
                  {railsDetailPages.map((page, index) => {
                    const isActivePage = page.key === activeDetailPage;
                    const pageTasks = detailReadinessByPage[page.key] || [];
                    const pagePendingCount = pageTasks.filter((task) => !task.complete).length;
                    const pageMeta = pageTasks.length
                      ? pagePendingCount
                        ? `${pagePendingCount} pending`
                        : 'Ready'
                      : '';
                    const canOpenPage = index <= activeDetailPageIndex || railsDetailPages
                      .slice(0, index)
                      .every((priorPage) => (detailReadinessByPage[priorPage.key] || []).every((task) => task.complete));

                    return (
                      <button
                        aria-current={isActivePage ? 'step' : undefined}
                        className={`${isActivePage ? 'is-active' : ''} ${pageTasks.length && !pagePendingCount ? 'is-complete' : ''} ${!canOpenPage ? 'is-locked' : ''}`.trim()}
                        disabled={!canOpenPage}
                        key={page.key}
                        onClick={() => canOpenPage ? setActiveDetailPage(page.key) : undefined}
                        type="button"
                      >
                        <span>{index + 1}</span>
                        <span>
                          {page.label}
                          {pageMeta ? <small>{pageMeta}</small> : null}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                <div className="rails-detail-page-shell" data-page={activeDetailPage}>
                <section className="rails-detail-section rails-detail-page rails-detail-page-overview rails-detail-page-controls">
                  <h3><ShieldCheck aria-hidden="true" size={16} /> Loop Controls</h3>
                  <div className="rails-control-grid">
                    <label>
                      Status
                      <RailsFieldSelect
                        disabled={isSaving}
                        onChange={(value) => {
                          const status = value as RailsStatus;
                          if (status === 'Reopened') {
                            setErrorMessage('Use the Reopen loop control with a reason so the audit trail is complete.');
                            return;
                          }

                          void handlePatchItem(activeItem, { status });
                        }}
                        options={railsStatuses.map((status) => ({ label: status, value: status }))}
                        value={activeItem.status}
                      />
                    </label>
                    <label>
                      Priority
                      <RailsFieldSelect
                        disabled={isSaving}
                        onChange={(value) => void handlePatchItem(activeItem, { priority: value as RailsPriority })}
                        options={(['Critical', 'High', 'Medium', 'Low'] as const).map((priority) => ({ label: priority, value: priority }))}
                        value={activeItem.priority}
                      />
                    </label>
                    <label>
                      Owner
                      <RailsFieldSelect
                        disabled={isSaving}
                        onChange={(value) => void handlePatchItem(activeItem, { ownerUid: value })}
                        options={candidates.map((candidate) => ({ label: candidate.displayName, value: candidate.uid }))}
                        value={activeItem.owner.uid}
                      />
                    </label>
                    <label>
                      Due date
                      <RailsDatePicker
                        disabled={isSaving}
                        onChange={(value) => void handlePatchItem(activeItem, { dueDate: value })}
                        value={activeItem.dueDate}
                      />
                    </label>
                    <label>
                      Approver
                      <RailsFieldSelect
                        disabled={isSaving || !candidates.length}
                        onChange={(value) => void handlePatchItem(activeItem, { approverUid: value || null })}
                        options={[
                          { label: 'Select approver', value: '' },
                          ...candidates.map((candidate) => ({ label: candidate.displayName, value: candidate.uid }))
                        ]}
                        value={activeItem.approver?.uid || ''}
                      />
                    </label>
                    <label className="rails-control-wide">
                      Link LSW
                      <RailsFieldSelect
                        disabled={isSaving}
                        onOpen={() => {
                          if (!lswCandidates.length) {
                            void handleLoadLswCandidates();
                          }
                        }}
                        onChange={(value) => void handleLswSourceChange(activeItem, value)}
                        options={[
                          { label: 'Not linked', value: '' },
                          ...lswCandidates.map((candidate) => ({
                            label: candidate.displayLabel,
                            value: getLswCandidateValue(candidate)
                          }))
                        ]}
                        value={getLswSourceValue(activeItem)}
                      />
                    </label>
                    <label className="rails-control-wide">
                      Link RCA
                      <RailsFieldSelect
                        disabled={isSaving}
                        onOpen={() => {
                          if (!rcaCandidates.length) {
                            void handleLoadRcaCandidates();
                          }
                        }}
                        onChange={(value) => void handleRcaDecisionChange(activeItem, value)}
                        options={[
                          { label: 'Not linked', value: '' },
                          { label: 'RCA triage requested', value: '__triage_requested' },
                          { label: 'RCA not required', value: '__not_required' },
                          ...rcaCandidates.map((candidate) => ({
                            label: `${candidate.displayId} - ${candidate.title}`,
                            value: candidate.id
                          }))
                        ]}
                        value={getRcaDecisionValue(activeItem)}
                      />
                    </label>
                    {activeItem.rcaTriageRequest ? (
                      <div className="rails-control-wide rails-rca-triage-card">
                        <div className="rails-rca-triage-head">
                          <span>RCA triage workflow</span>
                          <span>{activeItem.rcaTriageRequest.status}</span>
                        </div>
                        <p>{activeItem.rcaTriageRequest.reason || 'RCA triage requested for this loop.'}</p>
                        <div className="rails-rca-triage-meta">
                          <span>Due {formatDateLabel(activeItem.rcaTriageRequest.dueDate || activeItem.dueDate)}</span>
                          <span>{activeItem.linkedRcaDecision?.status || 'Triage Requested'}</span>
                        </div>
                        <div className="rails-rca-triage-actions">
                          <button
                            disabled={isSaving || activeItem.rcaTriageRequest.status === 'Accepted' || activeItem.rcaTriageRequest.status === 'Converted'}
                            onClick={() => void handleRcaTriageReviewChange(activeItem, 'Accepted')}
                            type="button"
                          >
                            Accept
                          </button>
                          <button
                            disabled={isSaving || activeItem.rcaTriageRequest.status === 'Rejected' || activeItem.rcaTriageRequest.status === 'Converted'}
                            onClick={() => void handleRcaTriageReviewChange(activeItem, 'Rejected')}
                            type="button"
                          >
                            RCA not required
                          </button>
                          <button
                            disabled={isSaving || activeItem.rcaTriageRequest.status === 'Rejected' || activeItem.rcaTriageRequest.status === 'Converted' || Boolean(activeItem.linkedRcaId)}
                            onClick={() => void handleConvertRcaTriage(activeItem)}
                            type="button"
                          >
                            Create RCA
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <label className="rails-control-wide">
                      Manual source justification
                      <input
                        disabled={isSaving}
                        key={`${activeItem.id}-${activeItem.source}`}
                        onBlur={(event) => {
                          if (event.target.value !== activeItem.source) {
                            void handlePatchItem(activeItem, { source: event.target.value });
                          }
                        }}
                        placeholder="Required only when no LSW or RCA source exists"
                        defaultValue={activeItem.source === 'LSW' ? '' : activeItem.source}
                      />
                    </label>
                  </div>
                  <div className="rails-lifecycle-control rails-detail-page rails-detail-page-closure">
                    <label>
                      Disposition reason
                      <textarea
                        disabled={isSaving}
                        onChange={(event) => setDraftLifecycleReason(event.target.value)}
                        placeholder="Required before cancelling, archiving, or reopening this loop"
                        value={draftLifecycleReason}
                      />
                    </label>
                    <div>
                      <button
                        disabled={isSaving || draftLifecycleReason.trim().length < 5 || ['Verification', 'Approved', 'Closed', 'Archived', 'Cancelled'].includes(activeItem.status)}
                        onClick={() => void handleLifecycleDisposition(activeItem, 'Cancelled')}
                        type="button"
                      >
                        Cancel loop
                      </button>
                      <button
                        disabled={isSaving || draftLifecycleReason.trim().length < 5 || !['Approved', 'Closed'].includes(activeItem.status)}
                        onClick={() => void handleLifecycleDisposition(activeItem, 'Archived')}
                        type="button"
                      >
                        Archive loop
                      </button>
                      <button
                        disabled={isSaving || draftLifecycleReason.trim().length < 5 || activeItem.status !== 'Closed'}
                        onClick={() => void handleLifecycleDisposition(activeItem, 'Reopened')}
                        type="button"
                      >
                        Reopen loop
                      </button>
                    </div>
                  </div>
                </section>

                <div className="rails-detail-grid rails-detail-page rails-detail-page-overview">
                  <DetailFact label="Owner" value={`${activeItem.owner.displayName}, ${activeItem.owner.roleName}`} />
                  <DetailFact label="Department" value={activeItem.departmentName || context?.department.name || 'Unassigned'} />
                  <DetailFact label="Due date" value={formatDateLabel(activeItem.dueDate)} />
                  <DetailFact label="Verification" value={activeItem.verification} />
                  <DetailFact label="Linked LSW" value={activeItem.linkedLsw} />
                  <DetailFact label="Linked RCA" value={activeItem.linkedRca} />
                  <DetailFact label="Source" value={getRailsSourceSummary(activeItem)} />
                </div>

                <section className="rails-detail-section rails-detail-page rails-detail-page-actions">
                  <h3><ClipboardList aria-hidden="true" size={16} /> Action Plan</h3>
                  <div className="rails-action-list">
                    {activeItem.actions.map((action) => {
                      const actionKind = getRailsActionKind(action);
                      const isGovernedAction = true;
                      const attachedEvidence = activeItem.evidence.filter((evidence) => evidence.status === 'Attached' && isRailsEvidenceLinkVisibleForItem(activeItem, evidence));
                      const linkedEvidenceIds = new Set(action.evidenceIds || []);
                      const actionRequirements = isGovernedAction ? getActionRequirementState(action, attachedEvidence) : [];
                      const canCompleteAction = !actionRequirements.some((requirement) => !requirement.complete);
                      const isActionExpanded = activeActionRecordId === action.actionId;
                      const showManualExecutionOverride = Boolean(manualExecutionOverrides[action.actionId]);
                      const hasSavedManualExecutionOverride = hasManualExecutionOverride(action);
                      const actionDisplayProgress = clampProgress(actionProgressDrafts[action.actionId] ?? action.progressPercent);

                      return (
                        <article
                          className={`rails-action-item ${isGovernedAction ? 'is-containment' : ''} ${isActionExpanded ? 'is-active-record' : ''}`}
                          key={action.actionId}
                          onContextMenu={(event) => openActionContextMenu(event, action, isActionExpanded)}
                        >
                          <button
                            aria-label={`Mark ${action.title} ${action.status === 'Done' ? 'open' : 'done'}`}
                            className={action.status === 'Done' ? 'is-done' : ''}
                            disabled={isSaving || (isGovernedAction && action.status !== 'Done' && !canCompleteAction)}
                            onClick={() => void handleUpdateActionStatus(activeItem, action.actionId, action.status === 'Done' ? 'Open' : 'Done')}
                            title={isGovernedAction && !canCompleteAction ? 'Complete controlled action documentation and link evidence first' : undefined}
                            type="button"
                          >
                            <CheckCircle2 aria-hidden="true" size={16} />
                          </button>
                          <div>
                            <strong>{action.title}</strong>
                            <span>{action.owner?.displayName || 'Unassigned'} · {formatDateLabel(action.dueDate)} · {action.status}</span>
                            <div className="rails-action-progress-row">
                              <div
                                aria-label={`${action.title} is ${actionDisplayProgress}% complete`}
                                className="rails-action-progress-bar"
                                style={getActionProgressTrackStyle(actionDisplayProgress)}
                              >
                                <span style={{ width: `${actionDisplayProgress}%` }} />
                              </div>
                              <small className="rails-action-progress-value">{actionDisplayProgress}%</small>
                            </div>
                          </div>
                          <button
                            aria-expanded={isActionExpanded}
                            aria-label={`${isActionExpanded ? 'Collapse' : 'Expand'} ${action.title}`}
                            className="rails-action-collapse-toggle"
                            onClick={() => setActiveActionRecordId(isActionExpanded ? '' : action.actionId)}
                            type="button"
                          >
                            {isActionExpanded ? <ChevronDown aria-hidden="true" size={16} /> : <ChevronRight aria-hidden="true" size={16} />}
                          </button>
                          {isActionExpanded ? (
                            <div className="rails-action-controls">
                              <RailsFieldSelect
                                aria-label="Action status"
                                disabled={isSaving}
                                onChange={(value) => void handleUpdateActionStatus(activeItem, action.actionId, value as RailsActionStatus)}
                                options={(['Open', 'In Progress', 'Blocked', 'Done'] as const).map((status) => ({ label: status, value: status }))}
                                value={action.status}
                              />
                              {(action.status === 'In Progress' || action.status === 'Done') ? (
                                <label className="rails-action-progress-control">
                                  <input
                                    aria-label={`${action.title} progress percent`}
                                    disabled={isSaving}
                                    max={100}
                                    min={0}
                                    onChange={(event) => setActionProgressDrafts((drafts) => ({
                                      ...drafts,
                                      [action.actionId]: clampProgress(Number(event.target.value))
                                    }))}
                                    onBlur={(event) => {
                                      const nextProgress = clampProgress(Number(event.target.value));
                                      event.currentTarget.value = String(nextProgress);

                                      if (nextProgress !== clampProgress(action.progressPercent)) {
                                        void handleUpdateActionProgress(activeItem, action.actionId, nextProgress);
                                      } else {
                                        setActionProgressDrafts((drafts) => {
                                          const nextDrafts = { ...drafts };
                                          delete nextDrafts[action.actionId];

                                          return nextDrafts;
                                        });
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.currentTarget.blur();
                                      }
                                    }}
                                    type="number"
                                    value={actionProgressDrafts[action.actionId] ?? clampProgress(action.progressPercent)}
                                  />
                                  <span>%</span>
                                </label>
                              ) : null}
                            </div>
                          ) : null}
                          {isGovernedAction && isActionExpanded ? (
                            <div className="rails-containment-record">
                              <div className="rails-containment-status">
                                <span>{getRailsActionRecordTitle(actionKind)}</span>
                                <small>{canCompleteAction ? 'Ready for completion' : 'Required before Done'}</small>
                              </div>
                              {getRailsActionFields(actionKind).map((field) => (
                                <label key={field.key}>
                                  <span>{field.label}</span>
                                  <textarea
                                    defaultValue={String(action[field.key] || '')}
                                    disabled={isSaving}
                                    onBlur={(event) => {
                                      const value = event.currentTarget.value.trim();
                                      if (value !== String(action[field.key] || '')) {
                                        void handleUpdateActionDocumentation(activeItem, action.actionId, { [field.key]: value });
                                      }
                                    }}
                                    placeholder={field.placeholder}
                                  />
                                </label>
                              ))}
                              <div className="rails-action-execution-control">
                                <div className="rails-action-execution-header">
                                  <div>
                                    <span>Execution control</span>
                                    <small>Automatic system timestamps are the official record.</small>
                                  </div>
                                  <button
                                    aria-label={showManualExecutionOverride ? 'Hide manual timestamp correction fields' : 'Show manual timestamp correction fields'}
                                    aria-pressed={showManualExecutionOverride}
                                    className={`rails-action-execution-switch ${showManualExecutionOverride ? 'is-on' : ''}`}
                                    disabled={isSaving}
                                    onClick={() => setManualExecutionOverrides((overrides) => ({
                                      ...overrides,
                                      [action.actionId]: !showManualExecutionOverride
                                    }))}
                                    type="button"
                                  >
                                    <span aria-hidden="true" />
                                  </button>
                                </div>
                                <div className={`rails-action-auto-stamp ${showManualExecutionOverride ? 'is-muted' : ''}`}>
                                  <CheckCircle2 aria-hidden="true" size={15} />
                                  <span>{showManualExecutionOverride ? 'Manual correction option is visible below.' : 'Use automatic started and completion timestamps'}</span>
                                  {hasSavedManualExecutionOverride ? <small>Saved correction exists</small> : null}
                                </div>
                                {showManualExecutionOverride ? (
                                  <div className="rails-action-manual-execution">
                                    <label>
                                      <span>Started correction reason</span>
                                      <input
                                        defaultValue={action.startedAtCorrectionReason}
                                        disabled={isSaving}
                                        onBlur={(event) => {
                                          const value = event.currentTarget.value.trim();
                                          if (value !== action.startedAtCorrectionReason) {
                                            void handleUpdateActionDocumentation(activeItem, action.actionId, { startedAtCorrectionReason: value });
                                          }
                                        }}
                                        placeholder="Required before manually changing started date/time"
                                      />
                                    </label>
                                    <div className="rails-action-execution-grid">
                                      <label>
                                        <span>Started date/time</span>
                                        <input
                                          disabled={isSaving}
                                          onBlur={(event) => {
                                            const value = dateTimeLocalToIso(event.currentTarget.value);
                                            if (value !== (action.startedAtIso || null)) {
                                              void handleUpdateActionDocumentation(activeItem, action.actionId, { startedAtIso: value });
                                            }
                                          }}
                                          type="datetime-local"
                                          defaultValue={isoToDateTimeLocal(action.startedAtIso)}
                                        />
                                      </label>
                                      <label>
                                        <span>Started by</span>
                                        <RailsFieldSelect
                                          disabled={isSaving}
                                          onChange={(value) => void handleUpdateActionDocumentation(activeItem, action.actionId, {
                                            startedByUid: value || null
                                          })}
                                          options={[
                                            { label: 'System/user not set', value: '' },
                                            ...candidates.map((candidate) => ({ label: candidate.displayName, value: candidate.uid }))
                                          ]}
                                          value={action.startedByUid || ''}
                                        />
                                      </label>
                                    </div>
                                    <label>
                                      <span>Completion correction reason</span>
                                      <input
                                        defaultValue={action.completedAtCorrectionReason}
                                        disabled={isSaving}
                                        onBlur={(event) => {
                                          const value = event.currentTarget.value.trim();
                                          if (value !== action.completedAtCorrectionReason) {
                                            void handleUpdateActionDocumentation(activeItem, action.actionId, { completedAtCorrectionReason: value });
                                          }
                                        }}
                                        placeholder="Required before manually changing completion details"
                                      />
                                    </label>
                                    <div className="rails-action-execution-grid">
                                  <label>
                                    <span>Completion date/time</span>
                                    <input
                                      disabled={isSaving}
                                      onBlur={(event) => {
                                        const value = dateTimeLocalToIso(event.currentTarget.value);
                                        if (value !== (action.completedAtIso || null)) {
                                          void handleUpdateActionDocumentation(activeItem, action.actionId, { completedAtIso: value });
                                        }
                                      }}
                                      type="datetime-local"
                                      defaultValue={isoToDateTimeLocal(action.completedAtIso)}
                                    />
                                  </label>
                                  <label>
                                    <span>Completed by</span>
                                    <RailsFieldSelect
                                      disabled={isSaving}
                                      onChange={(value) => {
                                        if (value === '__manual__') {
                                          void handleUpdateActionDocumentation(activeItem, action.actionId, {
                                            completedByExternalName: action.completedByExternalName || 'External person',
                                            completedByUid: null
                                          });
                                          return;
                                        }

                                        void handleUpdateActionDocumentation(activeItem, action.actionId, {
                                          completedByExternalName: '',
                                          completedByUid: value || null
                                        });
                                      }}
                                      options={[
                                        { label: 'System/user not set', value: '' },
                                        ...candidates.map((candidate) => ({ label: candidate.displayName, value: candidate.uid })),
                                        { label: 'Manual external name', value: '__manual__' }
                                      ]}
                                      value={action.completedByExternalName ? '__manual__' : action.completedByUid || ''}
                                    />
                                  </label>
                                    </div>
                                    {action.completedByExternalName ? (
                                      <label>
                                        <span>Manual completed-by name</span>
                                        <input
                                          defaultValue={action.completedByExternalName}
                                          disabled={isSaving}
                                          onBlur={(event) => {
                                            const value = event.currentTarget.value.trim();
                                            if (value !== action.completedByExternalName) {
                                              void handleUpdateActionDocumentation(activeItem, action.actionId, {
                                                completedByExternalName: value
                                              });
                                            }
                                          }}
                                          placeholder="External contractor, vendor, or non-system user"
                                        />
                                      </label>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <div className="rails-containment-evidence">
                                <span>Linked evidence</span>
                                {attachedEvidence.length ? (
                                  <div className="rails-containment-evidence-scroll">
                                    {attachedEvidence.map((evidence) => {
                                      const imageEvidenceThumbUrl = evidenceThumbUrls[`${activeItem.id}:${evidence.evidenceId}`];
                                      const evidenceThumbUrl = getEvidenceThumbnailUrl(evidence, imageEvidenceThumbUrl);
                                      const isImageEvidence = Boolean(imageEvidenceThumbUrl && evidence.contentType?.startsWith('image/'));

                                      return (
                                        <div className="rails-containment-evidence-row" key={evidence.evidenceId}>
                                          <label aria-label={`Link ${evidence.label} to ${action.title}`}>
                                            <input
                                              checked={linkedEvidenceIds.has(evidence.evidenceId)}
                                              disabled={isSaving}
                                              onChange={(event) => {
                                                if (event.target.checked) {
                                                  void handleSetActionEvidenceLink(activeItem, action, evidence.evidenceId, true);
                                                  return;
                                                }

                                                const checkboxRect = event.currentTarget.getBoundingClientRect();
                                                const width = Math.min(360, Math.max(280, window.innerWidth - 24));
                                                const left = Math.max(12, Math.min(window.innerWidth - width - 12, checkboxRect.left - 10));
                                                const belowTop = checkboxRect.bottom + 8;
                                                const top = belowTop + 180 < window.innerHeight
                                                  ? belowTop
                                                  : Math.max(RAILS_PANEL_TOP_LIMIT, checkboxRect.top - 188);

                                                setEvidenceLinkWarning({
                                                  actionId: action.actionId,
                                                  evidenceId: evidence.evidenceId,
                                                  left,
                                                  top,
                                                  width
                                                });
                                              }}
                                              type="checkbox"
                                            />
                                          </label>
                                          <button
                                            aria-label={`Open ${evidence.label}`}
                                            className={`rails-linked-evidence-open ${isImageEvidence ? 'has-thumbnail' : ''}`}
                                            disabled={isSaving || !evidence.fileUrl}
                                            onClick={() => {
                                              if (isImageEvidence && evidenceThumbUrl) {
                                                setEvidencePreview({
                                                  fileName: evidence.fileName || undefined,
                                                  label: evidence.label,
                                                  url: evidenceThumbUrl
                                                });
                                                return;
                                              }

                                              void handleOpenEvidenceFile(evidence);
                                            }}
                                            type="button"
                                          >
                                            {evidenceThumbUrl ? (
                                              <img alt="" src={evidenceThumbUrl} />
                                            ) : (
                                              <span className="rails-linked-evidence-file-icon">
                                                <FileCheck2 aria-hidden="true" size={15} />
                                              </span>
                                            )}
                                            <span>
                                              <span>{evidence.label}</span>
                                              {shouldShowEvidenceFileName(evidence.label, evidence.fileName) ? <small>{evidence.fileName}</small> : null}
                                            </span>
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p>Attach evidence below, then link it here before marking this action done.</p>
                                )}
                              </div>
                              <ul className="rails-containment-requirements">
                                {actionRequirements.map((requirement) => (
                                  <li className={requirement.complete ? 'is-complete' : ''} key={requirement.label}>
                                    {requirement.complete ? <CheckCircle2 aria-hidden="true" size={13} /> : <AlertCircle aria-hidden="true" size={13} />}
                                    {requirement.label}
                                  </li>
                                ))}
                              </ul>
                              {action.verifiedBy || action.verifiedAtIso ? (
                                <p className="rails-containment-verified">
                                  Verified by {action.verifiedBy?.displayName || 'system'}{action.verifiedAtIso ? ` · ${formatDateTimeStamp(action.verifiedAtIso)}` : ''}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                  <div className="rails-inline-form">
                    <input
                      disabled={isSaving}
                      onChange={(event) => setDraftActionTitle(event.target.value)}
                      placeholder="Add action step"
                      value={draftActionTitle}
                    />
                    <button disabled={isSaving || !draftActionTitle.trim()} onClick={() => void handleAddAction(activeItem)} type="button">
                      <Plus aria-hidden="true" size={14} />
                      Add
                    </button>
                  </div>
                </section>

                <section className="rails-detail-section rails-detail-page rails-detail-page-verification">
                  <h3><BadgeCheck aria-hidden="true" size={16} /> Verification Readiness</h3>
                  <div className="rails-verification-summary">
                    <div>
                      <span>Workflow gate</span>
                      <p>{activeItem.workflowGate.canAdvance ? 'Ready for the next controlled transition.' : 'Blocked until required records are complete.'}</p>
                    </div>
                    <div>
                      <span>Action documentation</span>
                      <p>{incompleteGovernedActionRequirements.length ? `${incompleteGovernedActionRequirements.length} governed action requirement${incompleteGovernedActionRequirements.length === 1 ? '' : 's'} remaining.` : 'Governed action requirements are complete.'}</p>
                    </div>
                    <div>
                      <span>Evidence library</span>
                      <p>{attachedEvidenceCount ? `${attachedEvidenceCount} attached evidence item${attachedEvidenceCount === 1 ? '' : 's'} available for linking.` : 'Attach evidence in the Evidence Library before verification.'}</p>
                    </div>
                  </div>
                  {requiredVerificationEvidence.length ? (
                    <div className={`rails-required-evidence-panel ${allRequiredVerificationEvidenceLinked ? 'is-complete' : ''}`}>
                      <div>
                        <span>Required verification evidence</span>
                        <small>Link existing records from the centralized Evidence Library before verification can clear.</small>
                      </div>
                      {requiredVerificationEvidence.map((requirement) => {
                        const linkedSourceEvidence = visibleAttachedEvidenceForActiveItem.find((evidence) => evidence.evidenceId === requirement.sourceEvidenceId) || null;
                        const isRequirementExpanded = expandedRequiredEvidenceIds.has(requirement.evidenceId);

                        return (
                          <div className={`rails-required-evidence-slot ${isRequirementExpanded ? 'is-expanded' : ''}`} key={requirement.evidenceId}>
                            <button
                              aria-expanded={isRequirementExpanded}
                              className="rails-required-evidence-slot-head"
                              onClick={() => toggleRequiredEvidenceSlot(requirement.evidenceId)}
                              type="button"
                            >
                              <div>
                                <span>Required record</span>
                                <p>{requirement.label}</p>
                                <small>{linkedSourceEvidence ? `Linked to ${linkedSourceEvidence.label}` : 'No Evidence Library item linked yet'}</small>
                              </div>
                              <span>
                                <strong className={linkedSourceEvidence ? 'is-linked' : ''}>{linkedSourceEvidence ? 'Linked' : 'Required'}</strong>
                                <ChevronRight aria-hidden="true" size={15} />
                              </span>
                            </button>
                            {isRequirementExpanded && visibleAttachedEvidenceForActiveItem.length ? (
                              <div className="rails-containment-evidence-scroll rails-required-evidence-picker">
                                {visibleAttachedEvidenceForActiveItem.map((evidence) => {
                                  const imageEvidenceThumbUrl = evidenceThumbUrls[`${activeItem.id}:${evidence.evidenceId}`];
                                  const evidenceThumbUrl = getEvidenceThumbnailUrl(evidence, imageEvidenceThumbUrl);
                                  const isImageEvidence = Boolean(imageEvidenceThumbUrl && evidence.contentType?.startsWith('image/'));
                                  const isLinked = requirement.sourceEvidenceId === evidence.evidenceId;

                                  return (
                                    <div className={`rails-containment-evidence-row ${isLinked ? 'is-linked' : ''}`} key={evidence.evidenceId}>
                                      <label aria-label={`Link ${evidence.label} to ${requirement.label}`}>
                                        <input
                                          checked={isLinked}
                                          disabled={isSaving}
                                          onChange={(event) => void handleSetRequiredEvidenceLink(activeItem, requirement.evidenceId, event.target.checked ? evidence.evidenceId : null)}
                                          type="checkbox"
                                        />
                                      </label>
                                      <button
                                        aria-label={`Open ${evidence.label}`}
                                        className={`rails-linked-evidence-open ${isImageEvidence ? 'has-thumbnail' : ''}`}
                                        disabled={isSaving || !evidence.fileUrl}
                                        onClick={() => {
                                          if (isImageEvidence && evidenceThumbUrl) {
                                            setEvidencePreview({
                                              fileName: evidence.fileName || undefined,
                                              label: evidence.label,
                                              url: evidenceThumbUrl
                                            });
                                            return;
                                          }

                                          void handleOpenEvidenceFile(evidence);
                                        }}
                                        type="button"
                                      >
                                        <img alt="" src={evidenceThumbUrl} />
                                        <span>
                                          <span>{evidence.label}</span>
                                          {shouldShowEvidenceFileName(evidence.label, evidence.fileName) ? <small>{evidence.fileName}</small> : null}
                                        </span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            {isRequirementExpanded && !visibleAttachedEvidenceForActiveItem.length ? (
                              <p>Upload evidence in the Evidence Library, then link it to this required record.</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>

                <section className="rails-detail-section rails-standardization-plan rails-detail-page rails-detail-page-standardization">
                  <h3><FileCheck2 aria-hidden="true" size={16} /> Standardization Plan</h3>
                  <div className="rails-standardization-grid">
                    <label className="rails-control-wide">
                      Standardization target
                      <textarea
                        aria-invalid={!standardizationRequirements.find((requirement) => requirement.key === 'target')?.complete}
                        value={standardizationDraft.target}
                        disabled={isSaving}
                        onChange={(event) => setStandardizationDraft((draft) => ({ ...draft, target: event.target.value }))}
                        placeholder="Define the standard work, control, training, or audit that prevents recurrence"
                      />
                    </label>
                    <label>
                      Type
                      <RailsFieldSelect
                        disabled={isSaving}
                        onChange={(value) => void handlePatchItem(activeItem, {
                          standardizationType: value ? value as RailsStandardizationType : null
                        })}
                        options={[
                          { label: 'Select type', value: '' },
                          ...railsStandardizationTypes.map((type) => ({ label: type, value: type }))
                        ]}
                        value={activeItem.standardizationType || ''}
                      />
                    </label>
                    <label>
                      Owner
                      <RailsFieldSelect
                        disabled={isSaving || !candidates.length}
                        onChange={(value) => void handlePatchItem(activeItem, { standardizationOwnerUid: value || null })}
                        options={[
                          { label: 'Select owner', value: '' },
                          ...candidates.map((candidate) => ({ label: candidate.displayName, value: candidate.uid }))
                        ]}
                        value={activeItem.standardizationOwnerUid || ''}
                      />
                    </label>
                    <label>
                      Due date
                      <RailsDatePicker
                        disabled={isSaving}
                        onChange={(value) => void handlePatchItem(activeItem, { standardizationDueDate: value })}
                        value={activeItem.standardizationDueDate}
                      />
                    </label>
                    <label>
                      Status
                      <div className={`rails-standardization-status is-${activeItem.standardizationStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                        <span>{activeItem.standardizationStatus}</span>
                        {activeItem.standardizationVerifiedAtIso ? (
                          <small>
                            {activeItem.standardizationVerifiedBy?.displayName || 'Verified'} · {formatDateTimeStamp(activeItem.standardizationVerifiedAtIso)}
                          </small>
                        ) : (
                          <small>Requires formal sign-off</small>
                        )}
                      </div>
                    </label>
                    <label className="rails-control-wide">
                      Verification method
                      <textarea
                        aria-invalid={!standardizationRequirements.find((requirement) => requirement.key === 'verification')?.complete}
                        value={standardizationDraft.verification}
                        disabled={isSaving}
                        onChange={(event) => setStandardizationDraft((draft) => ({ ...draft, verification: event.target.value }))}
                        placeholder="Describe the audit, approval, training record, or observation used to verify sustainment"
                      />
                    </label>
                  </div>
                  <div className="rails-standardization-document">
                    <div className="rails-standardization-document-header">
                      <span>Standardization document</span>
                      {standardizationEvidence ? (
                        <button
                          disabled={isSaving}
                          onClick={() => void handleOpenEvidenceFile(standardizationEvidence)}
                          type="button"
                        >
                          Open document
                        </button>
                      ) : null}
                    </div>
                    <label
                      className={`rails-standardization-dropzone ${isStandardizationDocumentDragActive ? 'is-dragging' : ''} ${standardizationDocumentFile ? 'has-file' : ''}`}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setIsStandardizationDocumentDragActive(true);
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        if (event.currentTarget === event.target) {
                          setIsStandardizationDocumentDragActive(false);
                        }
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsStandardizationDocumentDragActive(false);
                        handleStandardizationDocumentFiles(event.dataTransfer.files);
                      }}
                      onPaste={handleStandardizationDocumentPaste}
                      tabIndex={0}
                    >
                      <input
                        disabled={isSaving}
                        onChange={(event) => handleStandardizationDocumentFiles(event.target.files || [])}
                        type="file"
                      />
                      <UploadCloud aria-hidden="true" size={18} />
                      <span>
                        {standardizationDocumentFile
                          ? standardizationDocumentFile.name
                          : standardizationEvidence?.fileName || 'Drop, paste, or browse the standardization document'}
                      </span>
                      <small>SOP, checklist, LSW audit, training record, PM task, visual control, or work instruction</small>
                    </label>
                    <button
                      disabled={isSaving || !standardizationDocumentFile}
                      onClick={() => void handleUploadStandardizationDocument(activeItem)}
                      type="button"
                    >
                      <UploadCloud aria-hidden="true" size={14} />
                      Upload document
                    </button>
                  </div>
                  {activeItem.standardizationDocumentVersions.length ? (
                    <div className="rails-standardization-versions">
                      <span>Document versions</span>
                      {activeItem.standardizationDocumentVersions.map((version) => (
                        <button
                          key={version.versionId}
                          onClick={() => void handleOpenStandardizationVersion(version)}
                          type="button"
                        >
                          <FileCheck2 aria-hidden="true" size={14} />
                          <span>
                            v{version.versionNumber} · {version.fileName}
                            <small>{version.uploaderName || 'Synzapp user'} · {formatDateTimeStamp(version.uploadedAtIso)}</small>
                          </span>
                          {version.versionId === activeItem.standardizationDocumentCurrentVersionId ? <strong>Current</strong> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="rails-standardization-requirements">
                    <div>
                      <span>Closure requirements</span>
                      <button
                        disabled={isSaving || !isStandardizationDraftDirty}
                        onClick={() => void handleSaveStandardizationPlan(activeItem)}
                        type="button"
                      >
                        Save plan
                      </button>
                    </div>
                    <ul>
                      {standardizationRequirements.map((requirement) => (
                        <li className={requirement.complete ? 'is-complete' : ''} key={requirement.key}>
                          <CheckCircle2 aria-hidden="true" size={14} />
                          <span>{requirement.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rails-standardization-summary">
                    <span>{activeItem.standardizationOwner?.displayName || 'No standardization owner'}</span>
                    <span>{activeItem.standardizationDueDate ? formatDateLabel(activeItem.standardizationDueDate) : 'No due date'}</span>
                    <span>{activeItem.standardizationStatus}</span>
                  </div>
                </section>
                </div>
              </>
            ) : null}
            {detailPanelTab === 'evidence' ? evidenceLibraryPanel : null}
            {detailPanelTab === 'log' ? (
              <section className="rails-detail-section rails-log-tab">
                <h3><MessageSquareText aria-hidden="true" size={16} /> Section Log</h3>
                <div className="rails-comment-form">
                  <textarea
                    disabled={isSaving}
                    onChange={(event) => setDraftComment(event.target.value)}
                    placeholder="Post an update, decision, blocker, or verification note"
                    value={draftComment}
                  />
                  <button disabled={isSaving || !draftComment.trim()} onClick={() => void handleAddComment(activeItem)} type="button">
                    Post update
                  </button>
                </div>
                <div className="rails-comment-list">
                  {isActivityLoading ? (
                    <div className="rails-loading-state">
                      <RefreshCw aria-hidden="true" size={18} />
                      Loading immutable activity
                    </div>
                  ) : activeActivity.length ? activeActivity.map((event) => (
                    <article className="rails-comment rails-audit-event" key={event.eventId}>
                      <div className="rails-comment-header">
                        <span className="rails-comment-actor">
                          <RailsUserAvatar user={getRailsAuditActor(event, candidates, activeItem)} />
                          <span>
                            <span className="rails-comment-author">{event.actorDisplayName}</span>
                            <span className="rails-comment-role">{event.actorRole}</span>
                          </span>
                        </span>
                        <span className="rails-comment-time">
                          <span>{formatRelativeDate(event.createdAtIso)}</span>
                          <time dateTime={event.createdAtIso}>{formatDateTimeStamp(event.createdAtIso)}</time>
                        </span>
                      </div>
                      <p>{formatRailsAuditSummary(event, candidates, activeItem)}</p>
                      {getRailsAuditChangeRows(event, candidates).length ? (
                        <dl className="rails-audit-change-list">
                          {getRailsAuditChangeRows(event, candidates).map((change) => (
                            <div key={change.field}>
                              <dt>{change.label}</dt>
                              <dd>
                                <span>{change.before}</span>
                                <ArrowRight aria-hidden="true" size={13} />
                                <span>{change.after}</span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      <small>{formatAuditEventType(event.type)}</small>
                    </article>
                  )) : (
                    <div className="rails-empty-state">No activity yet</div>
                  )}
                </div>
              </section>
            ) : null}
            {detailPanelTab === 'details' ? (
              <footer className="rails-detail-verification-footer">
                <button
                  aria-label="Previous detail page"
                  className="rails-detail-footer-icon-button"
                  disabled={!previousDetailPage}
                  onClick={() => previousDetailPage ? setActiveDetailPage(previousDetailPage.key) : undefined}
                  title="Previous"
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" size={15} strokeWidth={2} />
                </button>
                <div className="rails-detail-footer-status">
                  <span>{currentDetailPage.label}</span>
                  <strong>
                    {activeDetailPage === 'standardization'
                      ? activeItem.standardizationStatus === 'Verified'
                        ? 'Plan verified'
                        : activeDetailPendingCount
                          ? `${activeDetailPendingCount} pending before verification`
                          : 'Ready for verification'
                      : activeDetailPendingCount
                        ? `${activeDetailPendingCount} pending before next page`
                        : nextDetailPage
                          ? `Next: ${nextDetailPage.label}`
                          : 'End of guided workflow'}
                  </strong>
                </div>
                {activeDetailPage === 'standardization' ? (
                  activeItem.standardizationStatus !== 'Verified' ? (
                    <div className="rails-detail-footer-actions">
                      <button
                        disabled={isSaving || !canVerifyStandardizationPlan}
                        onClick={() => void handleVerifyStandardizationPlan(activeItem)}
                        type="button"
                      >
                        Mark standardization verified
                      </button>
                    </div>
                  ) : (
                    <button
                      aria-label="Next detail page"
                      className="rails-detail-footer-icon-button rails-detail-footer-next"
                      disabled={!nextDetailPage || activeDetailPendingCount > 0}
                      onClick={() => nextDetailPage && activeDetailPendingCount === 0 ? setActiveDetailPage(nextDetailPage.key) : undefined}
                      title="Next"
                      type="button"
                    >
                      <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
                    </button>
                  )
                ) : (
                  <button
                    aria-label="Next detail page"
                    className="rails-detail-footer-icon-button rails-detail-footer-next"
                    disabled={!nextDetailPage || activeDetailPendingCount > 0}
                    onClick={() => nextDetailPage && activeDetailPendingCount === 0 ? setActiveDetailPage(nextDetailPage.key) : undefined}
                    title="Next"
                    type="button"
                  >
                    <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
                  </button>
                )}
              </footer>
            ) : null}
          </aside>
          </RailsPanelShell>
        ) : null}
      </main>

      {evidencePreview ? (
        <div
          aria-label="Evidence photo full view"
          aria-modal="true"
          className="rails-evidence-preview"
          onClick={() => setEvidencePreview(null)}
          role="dialog"
        >
          <div className="rails-evidence-preview-card" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>Evidence photo</span>
                <h2>{evidencePreview.label}</h2>
                {evidencePreview.fileName ? <p>{evidencePreview.fileName}</p> : null}
              </div>
              <button aria-label="Close evidence preview" onClick={() => setEvidencePreview(null)} type="button">
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="rails-evidence-preview-stage">
              <img alt={evidencePreview.label} src={evidencePreview.url} />
            </div>
          </div>
        </div>
      ) : null}

      {activeItem && evidenceEditorId ? (() => {
        const evidence = activeItem.evidence.find((entry) => entry.evidenceId === evidenceEditorId);
        const imageUrl = evidence ? evidenceThumbUrls[`${activeItem.id}:${evidence.evidenceId}`] : '';

        return evidence && imageUrl ? (
          <ImageEvidenceEditor
            disabled={isSaving}
            evidence={evidence}
            imageUrl={imageUrl}
            onClose={() => setEvidenceEditorId('')}
            onRename={(nextLabel) => handleRenameEvidenceFromEditor(evidence.evidenceId, nextLabel)}
            onSave={(dataUrl) => void handleReplaceEvidenceWithEditedImage(activeItem, evidence.evidenceId, dataUrl)}
          />
        ) : null;
      })() : null}

      {activeItem && isEvidenceUploadModalOpen ? (
        <div
          aria-labelledby="rails-evidence-upload-title"
          aria-modal="true"
          className="rails-evidence-upload-modal"
          onClick={() => {
            if (!isEvidenceUploading) {
              setDraftEvidenceFiles([]);
              setDraftEvidenceLabel('');
              setIsEvidenceUploadModalOpen(false);
            }
          }}
          role="dialog"
        >
          <div className="rails-evidence-upload-card" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>Evidence Library</span>
                <h2 id="rails-evidence-upload-title">Upload evidence</h2>
                <p>Add photos, screenshots, PDFs, or documents. Uploaded evidence becomes available for linking across this RAILS loop.</p>
              </div>
              <button
                aria-label="Close evidence upload"
                disabled={isEvidenceUploading}
                onClick={() => {
                  setDraftEvidenceFiles([]);
                  setDraftEvidenceLabel('');
                  setIsEvidenceUploadModalOpen(false);
                }}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <label
              className={`rails-evidence-upload-dropzone ${isEvidenceDragActive ? 'is-dragging' : ''} ${draftEvidenceFiles.length ? 'has-files' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsEvidenceDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) {
                  setIsEvidenceDragActive(false);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setIsEvidenceDragActive(false);
                handleEvidenceFiles(event.dataTransfer.files);
              }}
              onPaste={handleEvidencePaste}
              tabIndex={0}
            >
              <input
                disabled={isEvidenceUploading}
                multiple
                onChange={(event) => handleEvidenceFiles(event.target.files || [])}
                type="file"
              />
              <span>
                <UploadCloud aria-hidden="true" size={24} />
              </span>
              <strong>Drop, paste, or browse files</strong>
              <small>Use one upload flow for all evidence records.</small>
            </label>
            {draftEvidenceFiles.length ? (
              <div className="rails-evidence-upload-files">
                <span>{draftEvidenceFiles.length} file{draftEvidenceFiles.length === 1 ? '' : 's'} ready</span>
                <ul>
                  {draftEvidenceFiles.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${index}`}>
                      <FileCheck2 aria-hidden="true" size={14} />
                      <span>{file.name}</span>
                      <small>{formatFileSize(file.size)}</small>
                      <button
                        aria-label={`Remove ${file.name}`}
                        disabled={isEvidenceUploading}
                        onClick={() => setDraftEvidenceFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}
                        type="button"
                      >
                        <X aria-hidden="true" size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <footer>
              <button
                disabled={isEvidenceUploading}
                onClick={() => {
                  setDraftEvidenceFiles([]);
                  setDraftEvidenceLabel('');
                  setIsEvidenceUploadModalOpen(false);
                }}
                type="button"
              >
                Cancel
              </button>
              <button disabled={!draftEvidenceFiles.length || isEvidenceUploading} onClick={() => void handleAddEvidence(activeItem)} type="button">
                <UploadCloud aria-hidden="true" size={15} />
                Upload
              </button>
            </footer>
            {isEvidenceUploading ? (
              <div className="rails-evidence-upload-overlay" aria-live="polite">
                <div>
                  <span>
                    <UploadCloud aria-hidden="true" size={22} />
                  </span>
                  <h3>Uploading evidence</h3>
                  <p>{evidenceUploadProgress}% complete</p>
                  <div className="rails-evidence-upload-progress">
                    <span style={{ width: `${evidenceUploadProgress}%` }} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          aria-labelledby="rails-error-modal-title"
          aria-modal="true"
          className="rails-error-modal"
          onClick={() => setErrorMessage('')}
          role="dialog"
        >
          <div className="rails-error-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="rails-error-modal-icon">
              <AlertTriangle aria-hidden="true" size={22} />
            </div>
            <div>
              <span>Error</span>
              <h2 id="rails-error-modal-title">Action needs attention</h2>
              <p>{errorMessage}</p>
            </div>
            <footer>
              <button onClick={() => setErrorMessage('')} type="button">
                Close
              </button>
              <button onClick={() => void loadWorkspace()} type="button">
                <RefreshCw aria-hidden="true" size={14} />
                Retry
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RailsPanelShell({
  children,
  headerActions,
  kind,
  onClose,
  onDetachToggle,
  onDragStart,
  onResizeStart,
  panel,
  tabs,
  title
}: {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  kind: RailsPanelKind;
  onClose: () => void;
  onDetachToggle: () => void;
  onDragStart: (kind: RailsPanelKind, event: React.PointerEvent<HTMLElement>) => void;
  onResizeStart: (kind: RailsPanelKind, edge: RailsPanelResizeEdge, event: React.PointerEvent<HTMLElement>) => void;
  panel: RailsPanelState;
  tabs?: React.ReactNode;
  title: string;
}) {
  const style = panel.detached
    ? {
        height: panel.height,
        left: panel.x,
        top: panel.y,
        width: panel.width
      }
    : {
        width: panel.width
      };

  return (
    <div
      className={`rails-panel-shell is-${kind} ${panel.detached ? 'is-detached' : 'is-docked'}`}
      style={{
        ...style,
        minWidth: getPanelMinWidth(kind)
      }}
    >
      <div
        className="rails-panel-toolbar"
        onPointerDown={(event) => onDragStart(kind, event)}
      >
        <span
          aria-hidden="true"
          className="rails-panel-drag"
        >
          <Move aria-hidden="true" size={14} />
        </span>
        <span className="rails-panel-title">{title}</span>
        {tabs}
        {headerActions}
        <div className="rails-panel-toolbar-actions">
          <button aria-label={panel.detached ? 'Dock panel' : 'Detach panel'} onClick={onDetachToggle} type="button">
            {panel.detached ? <Pin aria-hidden="true" size={14} /> : <Maximize2 aria-hidden="true" size={14} />}
          </button>
          <button aria-label="Hide panel" onClick={onClose} type="button">
            {kind === 'left' ? <PanelLeftClose aria-hidden="true" size={14} /> : <PanelRightClose aria-hidden="true" size={14} />}
          </button>
        </div>
      </div>
      {children}
      <div
        aria-label={`Resize ${title} from left edge`}
        className="rails-panel-resize-edge is-left-edge"
        onPointerDown={(event) => onResizeStart(kind, 'left', event)}
        role="separator"
      />
      <div
        aria-label={`Resize ${title} from right edge`}
        className="rails-panel-resize-edge is-right-edge"
        onPointerDown={(event) => onResizeStart(kind, 'right', event)}
        role="separator"
      />
      {panel.detached ? (
        <div
          aria-label={`Resize ${title} from bottom edge`}
          className="rails-panel-resize-edge is-bottom-edge"
          onPointerDown={(event) => onResizeStart(kind, 'bottom', event)}
          role="separator"
        />
      ) : null}
    </div>
  );
}

function RailsAssistantPanel({
  activeItem,
  isResponding,
  messages,
  onAsk,
  onClose,
  question,
  setQuestion
}: {
  activeItem: RailsItem | null;
  isResponding: boolean;
  messages: RailsAssistantMessage[];
  onAsk: (question: string) => void;
  onClose: () => void;
  question: string;
  setQuestion: (question: string) => void;
}) {
  const messageListRef = React.useRef<HTMLDivElement | null>(null);
  const shouldFollowMessagesRef = React.useRef(true);
  const previousMessageCountRef = React.useRef(messages.length);
  const [hasUnreadAssistantMessage, setHasUnreadAssistantMessage] = React.useState(false);
  const starterPrompts = activeItem
    ? [
      'What is blocking this loop from moving forward?',
      `Guide me through ${activeItem.status} stage.`,
      'What evidence should I attach next?'
    ]
    : [
      'How do I start a RAILS loop correctly?',
      'Explain the RAILS flow from New to Closed.',
      'When should I link LSW or RCA?'
    ];
  const lastMessage = messages[messages.length - 1] || null;

  React.useLayoutEffect(() => {
    const list = messageListRef.current;
    if (!list) {
      return;
    }

    const messageWasAdded = messages.length > previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (shouldFollowMessagesRef.current) {
      scrollAssistantMessagesToBottom(list, 'auto');
      setHasUnreadAssistantMessage(false);
      return;
    }

    if (messageWasAdded && lastMessage?.role === 'assistant') {
      setHasUnreadAssistantMessage(true);
    }
  }, [isResponding, lastMessage?.role, messages.length]);

  function handleAssistantScroll() {
    const list = messageListRef.current;
    if (!list) {
      return;
    }

    const isNearBottom = isAssistantMessageListNearBottom(list);
    shouldFollowMessagesRef.current = isNearBottom;

    if (isNearBottom) {
      setHasUnreadAssistantMessage(false);
    }
  }

  function jumpToLatestAssistantMessage() {
    const list = messageListRef.current;
    if (!list) {
      return;
    }

    shouldFollowMessagesRef.current = true;
    scrollAssistantMessagesToBottom(list, 'smooth');
    setHasUnreadAssistantMessage(false);
  }

  return (
    <div className="rails-ai-assistant-panel" aria-label="RAILS AI assistant">
      <header className="rails-ai-assistant-header">
        <div className="rails-ai-orb" aria-hidden="true">
          <Bot size={18} />
        </div>
        <div>
          <span>RAILS AI Guide</span>
          <p>{activeItem ? `${activeItem.displayId} context active` : 'Workspace guidance active'}</p>
        </div>
        <button aria-label="Close RAILS AI assistant" onClick={onClose} type="button">
          <X aria-hidden="true" size={15} />
        </button>
      </header>

      <div className="rails-ai-assistant-prompts" aria-label="Suggested RAILS questions">
        {starterPrompts.map((prompt) => (
          <button disabled={isResponding} key={prompt} onClick={() => onAsk(prompt)} type="button">
            <Sparkles aria-hidden="true" size={13} />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      <div className="rails-ai-message-region">
        <div className="rails-ai-message-list" aria-live="polite" onScroll={handleAssistantScroll} ref={messageListRef}>
          {messages.map((message) => (
            <article className={`rails-ai-message is-${message.role}`} key={message.id}>
              <div className="rails-ai-message-meta">
                <span>{message.role === 'assistant' ? 'RAILS Guide' : 'You'}</span>
                {message.answerSource ? <small>{message.answerSource === 'AI' ? 'AI assisted' : 'System guide'}</small> : null}
              </div>
              <div className="rails-ai-message-body">
                {formatAssistantAnswer(message.body).map((line, index) => (
                  <p key={`${message.id}-${index}`}>{line}</p>
                ))}
              </div>
            </article>
          ))}
          {isResponding ? (
            <article className="rails-ai-message is-assistant is-thinking">
              <div className="rails-ai-message-meta">
                <span>RAILS Guide</span>
                <small>Reviewing gates</small>
              </div>
              <div className="rails-ai-thinking-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </article>
          ) : null}
        </div>
        {hasUnreadAssistantMessage ? (
          <button className="rails-ai-jump-latest" onClick={jumpToLatestAssistantMessage} type="button">
            <ArrowDown aria-hidden="true" size={15} />
            <span>New answer</span>
          </button>
        ) : null}
      </div>

      <form
        className="rails-ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onAsk(question);
        }}
      >
        <textarea
          aria-label="Ask the RAILS AI guide"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about the RAILS flow, gates, evidence, actions, LSW, RCA, or closure..."
          rows={3}
          value={question}
        />
        <button disabled={isResponding || !question.trim()} type="submit">
          <Send aria-hidden="true" size={15} />
        </button>
      </form>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  meta,
  tone,
  value
}: {
  icon: React.ComponentType<{ 'aria-hidden': true; size: number }>;
  label: string;
  meta?: string;
  tone: 'amber' | 'blue' | 'green' | 'red';
  value: string;
}) {
  return (
    <article className={`rails-metric-card is-${tone}`}>
      <div className="rails-metric-icon">
        <Icon aria-hidden={true} size={18} />
      </div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {meta ? <small>{meta}</small> : null}
      </div>
    </article>
  );
}

function ReportBreakdown({
  rows,
  title
}: {
  rows: Array<{ label: string; value: number }>;
  title: string;
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  return (
    <section className="rails-report-breakdown">
      <h3>{title}</h3>
      {rows.length ? rows.map((row) => (
        <div className="rails-report-breakdown-row" key={row.label}>
          <div>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
          <div className="rails-report-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(8, Math.round((row.value / maxValue) * 100))}%` }} />
          </div>
        </div>
      )) : (
        <p>No data</p>
      )}
    </section>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rails-detail-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ImageEvidenceEditor({
  disabled,
  evidence,
  imageUrl,
  onClose,
  onRename,
  onSave
}: {
  disabled: boolean;
  evidence: RailsItem['evidence'][number];
  imageUrl: string;
  onClose: () => void;
  onRename: (draftValue: string) => Promise<boolean>;
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const interactionRef = React.useRef<RailsImageEditorInteraction | null>(null);
  const [editorState, setEditorState] = React.useState<RailsImageEditorState>(() => createInitialImageEditorState());
  const [eraserPointer, setEraserPointer] = React.useState<{ size: number; x: number; y: number } | null>(null);
  const [isImageReady, setIsImageReady] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameDraft, setRenameDraft] = React.useState(() => getEvidenceEditableBaseName(evidence));

  React.useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageRef.current = image;
      setIsImageReady(true);
      setEditorState(createInitialImageEditorState());
    };
    image.src = imageUrl;
  }, [imageUrl]);

  React.useEffect(() => {
    setIsRenaming(false);
    setRenameDraft(getEvidenceEditableBaseName(evidence));
  }, [evidence.evidenceId, evidence.label, evidence.fileName]);

  React.useEffect(() => {
    const image = imageRef.current;

    if (!image || !isImageReady) {
      return;
    }

    const interaction = interactionRef.current;
    drawEvidenceEditorCanvas(canvasRef.current, image, editorState, interaction?.kind === 'draw' ? interaction.draft : null, true);
  }, [editorState, isImageReady]);

  React.useEffect(() => {
    function deleteSelectedText(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;

      if (!editorState.selectedTextId || isTypingTarget || (event.key !== 'Delete' && event.key !== 'Backspace')) {
        return;
      }

      event.preventDefault();
      setEditorState((state) => ({
        ...state,
        annotations: state.annotations.filter((annotation) => annotation.id !== state.selectedTextId),
        selectedTextId: null,
        textValue: ''
      }));
    }

    window.addEventListener('keydown', deleteSelectedText);
    return () => window.removeEventListener('keydown', deleteSelectedText);
  }, [editorState.selectedTextId]);

  const activeSizeControl = getActiveImageEditorSizeControl(editorState);
  const activeToolGuidance = getImageEditorToolGuidance(editorState.tool, activeSizeControl.label);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function updateEraserPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const stage = event.currentTarget.parentElement;

    if (!canvas || !stage || editorState.tool !== 'eraser') {
      setEraserPointer(null);
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const isInsideCanvas = event.clientX >= canvasRect.left
      && event.clientX <= canvasRect.right
      && event.clientY >= canvasRect.top
      && event.clientY <= canvasRect.bottom;

    if (!isInsideCanvas) {
      setEraserPointer(null);
      return;
    }

    setEraserPointer({
      size: Math.max(18, editorState.eraserSize * (canvasRect.width / Math.max(1, canvas.width))),
      x: event.clientX - stageRect.left,
      y: event.clientY - stageRect.top
    });
  }

  function redrawWithDraft(draft: RailsImageEditorDraft | null) {
    const image = imageRef.current;
    if (image) {
      drawEvidenceEditorCanvas(canvasRef.current, image, editorState, draft, true);
    }
  }

  function beginCanvasInteraction(event: React.PointerEvent<HTMLCanvasElement>) {
    updateEraserPointer(event);

    const point = getCanvasPoint(event);
    const image = imageRef.current;

    if (!point || !image) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (editorState.tool === 'text') {
      const textHit = findTextAnnotationAtPoint(editorState.annotations, point);
      if (textHit) {
        setEditorState((state) => ({
          ...state,
          color: textHit.color,
          fontSize: textHit.fontSize,
          selectedTextId: textHit.id,
          textValue: textHit.text,
          tool: 'text'
        }));
        interactionRef.current = {
          kind: 'moveText',
          start: point,
          textId: textHit.id,
          textStartX: textHit.x,
          textStartY: textHit.y
        };
        return;
      }

      const text = editorState.textValue.trim();
      if (editorState.selectedTextId) {
        setEditorState((state) => ({ ...state, selectedTextId: null, textValue: '' }));
        return;
      }

      if (text) {
        setEditorState((state) => ({
          ...state,
          annotations: [
            ...state.annotations,
            {
              color: state.color,
              fontSize: state.fontSize,
              id: `txt-${Date.now()}`,
              text,
              type: 'text',
              x: point.x,
              y: point.y
            }
          ]
        }));
      }
      return;
    }

    if (editorState.tool === 'crop') {
      const cropHit = hitTestCropHandle(editorState.crop, point);
      interactionRef.current = {
        cropStart: editorState.crop,
        handle: cropHit,
        kind: 'crop',
        start: point
      };
      return;
    }

    if (editorState.tool === 'pen' || editorState.tool === 'eraser') {
      const draft: RailsImageEditorDraft = {
        color: editorState.color,
        points: [point],
        size: editorState.tool === 'eraser' ? editorState.eraserSize : editorState.strokeSize,
        type: editorState.tool
      };
      interactionRef.current = { draft, kind: 'draw', start: point };
      redrawWithDraft(draft);
      return;
    }

    const draft: RailsImageEditorDraft = {
      color: editorState.color,
      end: point,
      size: editorState.strokeSize,
      start: point,
      type: editorState.tool
    };
    interactionRef.current = { draft, kind: 'draw', start: point };
    redrawWithDraft(draft);
  }

  function continueCanvasInteraction(event: React.PointerEvent<HTMLCanvasElement>) {
    updateEraserPointer(event);

    const point = getCanvasPoint(event);
    const interaction = interactionRef.current;

    if (!point || !interaction) {
      return;
    }

    if (interaction.kind === 'moveText') {
      const deltaX = point.x - interaction.start.x;
      const deltaY = point.y - interaction.start.y;
      setEditorState((state) => ({
        ...state,
        annotations: state.annotations.map((annotation) => annotation.type === 'text' && annotation.id === interaction.textId
          ? { ...annotation, x: interaction.textStartX + deltaX, y: interaction.textStartY + deltaY }
          : annotation)
      }));
      return;
    }

    if (interaction.kind === 'crop') {
      setEditorState((state) => ({
        ...state,
        crop: updateCropRect(interaction.cropStart, interaction.handle, interaction.start, point, getCanvasBounds())
      }));
      return;
    }

    if (interaction.draft.type === 'pen' || interaction.draft.type === 'eraser') {
      interaction.draft = {
        color: interaction.draft.color,
        points: [...interaction.draft.points, point],
        size: interaction.draft.size,
        type: interaction.draft.type
      };
    } else if (interaction.draft.type === 'line' || interaction.draft.type === 'arrow' || interaction.draft.type === 'rect' || interaction.draft.type === 'ellipse') {
      const shapeDraft = interaction.draft;
      interaction.draft = {
        color: shapeDraft.color,
        end: point,
        size: shapeDraft.size,
        start: shapeDraft.start,
        type: shapeDraft.type
      };
    }

    redrawWithDraft(interaction.draft);
  }

  function endCanvasInteraction() {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }

    interactionRef.current = null;

    if (interaction.kind !== 'draw' || !interaction.draft) {
      return;
    }

    const annotation = draftToAnnotation(interaction.draft);
    if (!annotation) {
      redrawWithDraft(null);
      return;
    }

    setEditorState((state) => ({
      ...state,
      annotations: [...state.annotations, annotation]
    }));
  }

  function editTextAnnotation(event: React.MouseEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    const textHit = findTextAnnotationAtPoint(editorState.annotations, point);
    if (!textHit) {
      return;
    }

    setEditorState((state) => ({
      ...state,
      color: textHit.color,
      fontSize: textHit.fontSize,
      selectedTextId: textHit.id,
      textValue: textHit.text,
      tool: 'text'
    }));
  }

  function updateTextDraft(value: string) {
    setEditorState((state) => ({
      ...state,
      annotations: state.selectedTextId
        ? state.annotations.map((annotation) => annotation.type === 'text' && annotation.id === state.selectedTextId
          ? { ...annotation, text: value }
          : annotation)
        : state.annotations,
      textValue: value,
      tool: 'text'
    }));
  }

  function updateTextFontSize(value: number) {
    setEditorState((state) => ({
      ...state,
      annotations: state.selectedTextId
        ? state.annotations.map((annotation) => annotation.type === 'text' && annotation.id === state.selectedTextId
          ? { ...annotation, fontSize: value }
          : annotation)
        : state.annotations,
      fontSize: value
    }));
  }

  function updateAnnotationColor(value: string) {
    setEditorState((state) => ({
      ...state,
      annotations: state.selectedTextId
        ? state.annotations.map((annotation) => annotation.type === 'text' && annotation.id === state.selectedTextId
          ? { ...annotation, color: value }
          : annotation)
        : state.annotations,
      color: value
    }));
  }

  function updateActiveToolSize(value: number) {
    if (editorState.tool === 'text') {
      updateTextFontSize(value);
      return;
    }

    if (editorState.tool === 'eraser') {
      setEditorState((state) => ({ ...state, eraserSize: value }));
      return;
    }

    setEditorState((state) => ({ ...state, strokeSize: value }));
  }

  function getCanvasBounds(): RailsRect {
    const canvas = canvasRef.current;
    return {
      height: canvas?.height || 1,
      width: canvas?.width || 1,
      x: 0,
      y: 0
    };
  }

  function saveEditedImage() {
    const image = imageRef.current;
    if (!image) {
      return;
    }

    const dataUrl = exportEvidenceEditorImage(image, editorState);
    if (dataUrl) {
      onSave(dataUrl);
    }
  }

  async function saveEvidenceRename() {
    const saved = await onRename(renameDraft);
    if (saved) {
      setIsRenaming(false);
    }
  }

  return createPortal(
    <div className="rails-evidence-editor-modal" role="dialog" aria-modal="true" aria-label={`Edit ${evidence.label}`}>
      <div className="rails-evidence-editor-card">
        <header>
          <div>
            <span>Photo evidence editor</span>
            <div className="rails-evidence-editor-title-row">
              {isRenaming ? (
                <div className="rails-evidence-editor-rename-control">
                  <input
                    aria-label={`Rename ${evidence.label}`}
                    autoFocus
                    disabled={disabled}
                    onBlur={() => void saveEvidenceRename()}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void saveEvidenceRename();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setRenameDraft(getEvidenceEditableBaseName(evidence));
                        setIsRenaming(false);
                      }
                    }}
                    value={renameDraft}
                  />
                  {getEvidenceFileExtension(evidence) ? <small>{getEvidenceFileExtension(evidence)}</small> : null}
                </div>
              ) : (
                <>
                  <h2>{evidence.label}</h2>
                  <button
                    aria-label={`Rename ${evidence.label}`}
                    className="rails-evidence-editor-rename-button"
                    disabled={disabled}
                    onClick={() => setIsRenaming(true)}
                    title="Rename evidence"
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </button>
                </>
              )}
            </div>
            <p>Crop and mark the image, then save the edited evidence record.</p>
          </div>
          <button aria-label="Close editor" disabled={disabled} onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="rails-evidence-editor-shell">
          <aside className="rails-evidence-editor-tools" aria-label="Photo editing tools">
            <div className="rails-evidence-tool-group">
              {([
                { Icon: Type, label: 'Text', tool: 'text' },
                { Icon: Crop, label: 'Crop', tool: 'crop' },
                { Icon: Pencil, label: 'Pen', tool: 'pen' },
                { Icon: Eraser, label: 'Eraser', tool: 'eraser' },
                { Icon: Minus, label: 'Line', tool: 'line' },
                { Icon: ArrowUpRight, label: 'Arrow', tool: 'arrow' },
                { Icon: Square, label: 'Rectangle', tool: 'rect' },
                { Icon: CircleDot, label: 'Circle', tool: 'ellipse' }
              ] as const).map(({ Icon, label, tool }) => (
                <button
                  aria-label={label}
                  className={editorState.tool === tool ? 'is-active' : ''}
                  key={tool}
                  onClick={() => setEditorState((state) => ({
                    ...state,
                    selectedTextId: tool === 'text' ? state.selectedTextId : null,
                    tool
                  }))}
                  title={label}
                  type="button"
                >
                  <Icon aria-hidden="true" size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <label>
              <span>Color</span>
              <span className="rails-evidence-inline-control">
                <input
                  aria-label="Annotation color"
                  onChange={(event) => updateAnnotationColor(event.target.value)}
                  type="color"
                  value={editorState.color}
                />
                <small>{editorState.color.toUpperCase()}</small>
              </span>
            </label>
            <label className="is-tool-relevant">
              <span>{activeSizeControl.label}</span>
              <span className="rails-evidence-inline-control">
                <input
                  aria-label={activeSizeControl.label}
                  max={activeSizeControl.max}
                  min={activeSizeControl.min}
                  onChange={(event) => updateActiveToolSize(Number(event.target.value))}
                  type="range"
                  value={activeSizeControl.value}
                />
                <small>{activeSizeControl.percent}%</small>
              </span>
            </label>
            <label>
              <span>{editorState.selectedTextId ? 'Selected text' : 'Text'}</span>
              <textarea
                onChange={(event) => updateTextDraft(event.target.value)}
                placeholder="Type note, then click image"
                rows={3}
                value={editorState.textValue}
              />
            </label>
            <button
              className={editorState.selectedTextId ? 'is-secondary-action' : ''}
              onClick={() => setEditorState((state) => ({
                ...state,
                selectedTextId: null,
                textValue: '',
                tool: 'text'
              }))}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              New text
            </button>
            <button
              disabled={!editorState.annotations.length}
              onClick={() => setEditorState((state) => {
                const removedAnnotation = state.annotations.at(-1);
                return {
                  ...state,
                  annotations: state.annotations.slice(0, -1),
                  selectedTextId: removedAnnotation?.id === state.selectedTextId ? null : state.selectedTextId,
                  textValue: removedAnnotation?.id === state.selectedTextId ? '' : state.textValue
                };
              })}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={16} />
              Undo
            </button>
          </aside>
          <div className="rails-evidence-editor-stage">
            <canvas
              className={editorState.tool === 'eraser' ? 'is-eraser-active' : ''}
              ref={canvasRef}
              onDoubleClick={editTextAnnotation}
              onPointerCancel={() => {
                setEraserPointer(null);
                endCanvasInteraction();
              }}
              onPointerDown={beginCanvasInteraction}
              onPointerEnter={updateEraserPointer}
              onPointerLeave={() => setEraserPointer(null)}
              onPointerMove={continueCanvasInteraction}
              onPointerUp={endCanvasInteraction}
            />
            {eraserPointer && editorState.tool === 'eraser' ? (
              <div
                aria-hidden="true"
                className="rails-evidence-eraser-cursor"
                style={{
                  height: eraserPointer.size,
                  transform: `translate(${eraserPointer.x - eraserPointer.size / 2}px, ${eraserPointer.y - eraserPointer.size / 2}px)`,
                  width: eraserPointer.size
                }}
              >
                <Eraser aria-hidden="true" size={Math.max(12, Math.min(18, eraserPointer.size * 0.42))} />
              </div>
            ) : null}
          </div>
          <aside className="rails-evidence-tool-guidance" aria-live="polite" aria-label="Selected tool guidance">
            <div>
              {activeToolGuidance.Icon ? <activeToolGuidance.Icon aria-hidden="true" size={15} /> : null}
              <span>{activeToolGuidance.title}</span>
            </div>
            <p>{activeToolGuidance.body}</p>
            <ul>
              {activeToolGuidance.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </aside>
        </div>
        <footer>
          <p>{activeToolGuidance.footer}</p>
          <button
            disabled={disabled}
            className={disabled ? 'is-saving' : ''}
            onClick={saveEditedImage}
            type="button"
          >
            {disabled ? <span aria-hidden="true" className="rails-save-spinner" /> : <Save aria-hidden="true" size={15} />}
            {disabled ? 'Saving edit' : 'Save edit'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

type RailsImageEditorTool = 'crop' | 'pen' | 'eraser' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';

interface RailsPoint {
  x: number;
  y: number;
}

interface RailsRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

type RailsImageAnnotation =
  | { color: string; id: string; points: RailsPoint[]; size: number; type: 'pen' | 'eraser' }
  | { color: string; end: RailsPoint; id: string; size: number; start: RailsPoint; type: 'line' | 'arrow' | 'rect' | 'ellipse' }
  | { color: string; fontSize: number; id: string; text: string; type: 'text'; x: number; y: number };

type RailsImageEditorDraft =
  | { color: string; points: RailsPoint[]; size: number; type: 'pen' | 'eraser' }
  | { color: string; end: RailsPoint; size: number; start: RailsPoint; type: 'line' | 'arrow' | 'rect' | 'ellipse' };

interface RailsImageEditorState {
  annotations: RailsImageAnnotation[];
  color: string;
  crop: RailsRect | null;
  eraserSize: number;
  fontSize: number;
  selectedTextId: string | null;
  strokeSize: number;
  textValue: string;
  tool: RailsImageEditorTool;
}

type RailsCropHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'new';

type RailsImageEditorInteraction =
  | { draft: RailsImageEditorDraft; kind: 'draw'; start: RailsPoint }
  | { cropStart: RailsRect | null; handle: RailsCropHandle; kind: 'crop'; start: RailsPoint }
  | { kind: 'moveText'; start: RailsPoint; textId: string; textStartX: number; textStartY: number };

function createInitialImageEditorState(): RailsImageEditorState {
  return {
    annotations: [],
    color: '#dc2626',
    crop: null,
    eraserSize: 28,
    fontSize: 22,
    selectedTextId: null,
    strokeSize: 5,
    textValue: '',
    tool: 'crop'
  };
}

function drawEvidenceEditorCanvas(
  canvas: HTMLCanvasElement | null,
  image: HTMLImageElement,
  state: RailsImageEditorState,
  draft: RailsImageEditorDraft | null,
  includeCropOverlay: boolean
): void {
  if (!canvas) {
    return;
  }

  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context2d = canvas.getContext('2d');

  if (!context2d) {
    return;
  }

  context2d.clearRect(0, 0, canvas.width, canvas.height);
  context2d.drawImage(image, 0, 0, canvas.width, canvas.height);
  const annotationLayer = renderEvidenceAnnotationLayer(canvas.width, canvas.height, state.annotations, draft);
  context2d.drawImage(annotationLayer, 0, 0);
  drawSelectedTextOutline(context2d, state);
  if (includeCropOverlay) {
    drawCropOverlay(context2d, state.crop || { x: 0, y: 0, width: canvas.width, height: canvas.height }, state.tool === 'crop');
  }
}

function renderEvidenceAnnotationLayer(
  width: number,
  height: number,
  annotations: RailsImageAnnotation[],
  draft: RailsImageEditorDraft | null
): HTMLCanvasElement {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const context2d = layer.getContext('2d');

  if (!context2d) {
    return layer;
  }

  annotations.forEach((annotation) => drawEvidenceAnnotation(context2d, annotation));
  if (draft) {
    drawEvidenceDraft(context2d, draft);
  }
  return layer;
}

function drawEvidenceAnnotation(context2d: CanvasRenderingContext2D, annotation: RailsImageAnnotation): void {
  if (annotation.type === 'text') {
    context2d.save();
    context2d.fillStyle = annotation.color;
    context2d.font = `${annotation.fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context2d.textBaseline = 'top';
    annotation.text.split('\n').forEach((line, index) => {
      context2d.fillText(line, annotation.x, annotation.y + index * annotation.fontSize * 1.2);
    });
    context2d.restore();
    return;
  }

  drawEvidenceDraft(context2d, annotation);
}

function drawSelectedTextOutline(context2d: CanvasRenderingContext2D, state: RailsImageEditorState): void {
  if (!state.selectedTextId || state.tool !== 'text') {
    return;
  }

  const selectedText = state.annotations.find((annotation) => annotation.type === 'text' && annotation.id === state.selectedTextId);
  if (!selectedText || selectedText.type !== 'text') {
    return;
  }

  const bounds = getTextAnnotationBounds(selectedText);
  context2d.save();
  context2d.strokeStyle = '#2563eb';
  context2d.lineWidth = 1.5;
  context2d.setLineDash([5, 4]);
  context2d.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  context2d.fillStyle = 'rgba(37, 99, 235, 0.1)';
  context2d.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  context2d.restore();
}

function drawEvidenceDraft(context2d: CanvasRenderingContext2D, draft: RailsImageEditorDraft): void {
  context2d.save();
  context2d.lineCap = 'round';
  context2d.lineJoin = 'round';
  context2d.lineWidth = draft.size;
  context2d.strokeStyle = draft.color;

  if (draft.type === 'eraser') {
    context2d.globalCompositeOperation = 'destination-out';
  }

  if (draft.type === 'pen' || draft.type === 'eraser') {
    context2d.beginPath();
    draft.points.forEach((point, index) => {
      if (index === 0) {
        context2d.moveTo(point.x, point.y);
      } else {
        context2d.lineTo(point.x, point.y);
      }
    });
    context2d.stroke();
    context2d.restore();
    return;
  }

  if (draft.type !== 'line' && draft.type !== 'arrow' && draft.type !== 'rect' && draft.type !== 'ellipse') {
    context2d.restore();
    return;
  }

  const rect = normalizeRectFromPoints(draft.start, draft.end);

  context2d.beginPath();
  if (draft.type === 'line' || draft.type === 'arrow') {
    context2d.moveTo(draft.start.x, draft.start.y);
    context2d.lineTo(draft.end.x, draft.end.y);
  } else if (draft.type === 'rect') {
    context2d.rect(rect.x, rect.y, rect.width, rect.height);
  } else {
    context2d.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, Math.max(1, rect.width / 2), Math.max(1, rect.height / 2), 0, 0, Math.PI * 2);
  }
  context2d.stroke();
  if (draft.type === 'arrow') {
    drawArrowHead(context2d, draft.start, draft.end, draft.size);
  }
  context2d.restore();
}

function drawCropOverlay(context2d: CanvasRenderingContext2D, crop: RailsRect, isActive: boolean): void {
  const canvas = context2d.canvas;
  context2d.save();
  context2d.fillStyle = isActive ? 'rgba(15, 23, 42, 0.28)' : 'rgba(15, 23, 42, 0.1)';
  context2d.fillRect(0, 0, canvas.width, Math.max(0, crop.y));
  context2d.fillRect(0, crop.y + crop.height, canvas.width, Math.max(0, canvas.height - crop.y - crop.height));
  context2d.fillRect(0, crop.y, Math.max(0, crop.x), crop.height);
  context2d.fillRect(crop.x + crop.width, crop.y, Math.max(0, canvas.width - crop.x - crop.width), crop.height);
  context2d.strokeStyle = '#2563eb';
  context2d.lineWidth = 2;
  context2d.setLineDash([7, 5]);
  context2d.strokeRect(crop.x, crop.y, crop.width, crop.height);
  context2d.setLineDash([]);
  getCropHandles(crop).forEach((handle) => {
    context2d.fillStyle = '#ffffff';
    context2d.strokeStyle = '#2563eb';
    context2d.beginPath();
    context2d.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
    context2d.fill();
    context2d.stroke();
  });
  context2d.restore();
}

function drawArrowHead(context2d: CanvasRenderingContext2D, start: RailsPoint, end: RailsPoint, strokeSize: number): void {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = Math.max(14, strokeSize * 4);

  context2d.beginPath();
  context2d.moveTo(end.x, end.y);
  context2d.lineTo(end.x - length * Math.cos(angle - Math.PI / 6), end.y - length * Math.sin(angle - Math.PI / 6));
  context2d.moveTo(end.x, end.y);
  context2d.lineTo(end.x - length * Math.cos(angle + Math.PI / 6), end.y - length * Math.sin(angle + Math.PI / 6));
  context2d.stroke();
}

function exportEvidenceEditorImage(image: HTMLImageElement, state: RailsImageEditorState): string {
  const scale = Math.min(1, 960 / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const crop = clampRect(state.crop || { x: 0, y: 0, width, height }, { x: 0, y: 0, width, height });
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(crop.width));
  output.height = Math.max(1, Math.round(crop.height));
  const context2d = output.getContext('2d');

  if (!context2d) {
    return '';
  }

  context2d.translate(-crop.x, -crop.y);
  context2d.drawImage(image, 0, 0, width, height);
  const annotationLayer = renderEvidenceAnnotationLayer(width, height, state.annotations, null);
  context2d.drawImage(annotationLayer, 0, 0);
  return output.toDataURL('image/png');
}

function draftToAnnotation(draft: RailsImageEditorDraft): RailsImageAnnotation | null {
  if (draft.type === 'pen' || draft.type === 'eraser') {
    if (draft.points.length < 2) {
      return null;
    }
    return { ...draft, id: `ann-${Date.now()}` };
  }

  if (draft.type !== 'line' && draft.type !== 'arrow' && draft.type !== 'rect' && draft.type !== 'ellipse') {
    return null;
  }

  if (Math.abs(draft.end.x - draft.start.x) < 3 && Math.abs(draft.end.y - draft.start.y) < 3) {
    return null;
  }

  return { ...draft, id: `ann-${Date.now()}` };
}

function normalizeRectFromPoints(start: RailsPoint, end: RailsPoint): RailsRect {
  return {
    height: Math.abs(end.y - start.y),
    width: Math.abs(end.x - start.x),
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y)
  };
}

function clampRect(rect: RailsRect, bounds: RailsRect): RailsRect {
  const minSize = 24;
  const width = Math.min(Math.max(rect.width, minSize), bounds.width);
  const height = Math.min(Math.max(rect.height, minSize), bounds.height);
  return {
    height,
    width,
    x: Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.width - width),
    y: Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.height - height)
  };
}

function getCropHandles(crop: RailsRect): Array<{ handle: RailsCropHandle; x: number; y: number }> {
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  return [
    { handle: 'nw', x: crop.x, y: crop.y },
    { handle: 'n', x: centerX, y: crop.y },
    { handle: 'ne', x: crop.x + crop.width, y: crop.y },
    { handle: 'e', x: crop.x + crop.width, y: centerY },
    { handle: 'se', x: crop.x + crop.width, y: crop.y + crop.height },
    { handle: 's', x: centerX, y: crop.y + crop.height },
    { handle: 'sw', x: crop.x, y: crop.y + crop.height },
    { handle: 'w', x: crop.x, y: centerY }
  ];
}

function hitTestCropHandle(crop: RailsRect | null, point: RailsPoint): RailsCropHandle {
  if (!crop) {
    return 'new';
  }

  const hit = getCropHandles(crop).find((handle) => Math.hypot(point.x - handle.x, point.y - handle.y) <= 12);
  if (hit) {
    return hit.handle;
  }

  if (point.x >= crop.x && point.x <= crop.x + crop.width && point.y >= crop.y && point.y <= crop.y + crop.height) {
    return 'move';
  }

  return 'new';
}

function updateCropRect(cropStart: RailsRect | null, handle: RailsCropHandle, start: RailsPoint, current: RailsPoint, bounds: RailsRect): RailsRect {
  if (!cropStart || handle === 'new') {
    return clampRect(normalizeRectFromPoints(start, current), bounds);
  }

  const deltaX = current.x - start.x;
  const deltaY = current.y - start.y;
  let next = { ...cropStart };

  if (handle === 'move') {
    next = { ...next, x: cropStart.x + deltaX, y: cropStart.y + deltaY };
    return clampRect(next, bounds);
  }

  if (handle.includes('w')) {
    next.x = cropStart.x + deltaX;
    next.width = cropStart.width - deltaX;
  }
  if (handle.includes('e')) {
    next.width = cropStart.width + deltaX;
  }
  if (handle.includes('n')) {
    next.y = cropStart.y + deltaY;
    next.height = cropStart.height - deltaY;
  }
  if (handle.includes('s')) {
    next.height = cropStart.height + deltaY;
  }

  if (next.width < 0) {
    next.x += next.width;
    next.width = Math.abs(next.width);
  }
  if (next.height < 0) {
    next.y += next.height;
    next.height = Math.abs(next.height);
  }

  return clampRect(next, bounds);
}

function findTextAnnotationAtPoint(annotations: RailsImageAnnotation[], point: RailsPoint): Extract<RailsImageAnnotation, { type: 'text' }> | null {
  for (const annotation of [...annotations].reverse()) {
    if (annotation.type !== 'text') {
      continue;
    }

    const bounds = getTextAnnotationBounds(annotation);
    if (point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height) {
      return annotation;
    }
  }

  return null;
}

function getTextAnnotationBounds(annotation: Extract<RailsImageAnnotation, { type: 'text' }>): RailsRect {
  const lines = annotation.text.split('\n');
  const longestLine = Math.max(1, ...lines.map((line) => line.length));
  const width = Math.max(80, longestLine * annotation.fontSize * 0.55);
  const lineHeight = annotation.fontSize * 1.2;
  const height = Math.max(annotation.fontSize + 12, lines.length * lineHeight + 12);

  return {
    height,
    width: width + 12,
    x: annotation.x - 6,
    y: annotation.y - 6
  };
}

function getActiveImageEditorSizeControl(state: RailsImageEditorState): {
  label: string;
  max: number;
  min: number;
  percent: number;
  value: number;
} {
  if (state.tool === 'text') {
    return {
      label: 'Text size',
      max: 48,
      min: 12,
      percent: Math.round(((state.fontSize - 12) / (48 - 12)) * 100),
      value: state.fontSize
    };
  }

  if (state.tool === 'eraser') {
    return {
      label: 'Eraser area',
      max: 80,
      min: 8,
      percent: Math.round(((state.eraserSize - 8) / (80 - 8)) * 100),
      value: state.eraserSize
    };
  }

  return {
    label: 'Stroke size',
    max: 20,
    min: 2,
    percent: Math.round(((state.strokeSize - 2) / (20 - 2)) * 100),
    value: state.strokeSize
  };
}

function getImageEditorToolGuidance(
  tool: RailsImageEditorTool,
  sizeLabel: string
): {
  body: string;
  footer: string;
  Icon: React.ElementType;
  tips: string[];
  title: string;
} {
  const sharedColorTip = 'Color picker sets the mark color for new markings and selected text.';
  const sharedSizeTip = `${sizeLabel} slider controls the active tool size in real time.`;

  if (tool === 'crop') {
    return {
      body: 'Use Crop to focus the evidence on the exact area that proves the issue or fix.',
      footer: 'Crop mode: drag a new crop area, pull the handles to resize it, or drag inside the crop area to reposition it before saving.',
      Icon: Crop,
      tips: [
        'Drag across the image to create or reset the crop area.',
        'Use the handles to resize the dotted crop outline.',
        sharedSizeTip
      ],
      title: 'Crop guidance'
    };
  }

  if (tool === 'pen') {
    return {
      body: 'Use Pen for freehand markup when you need to circle damage, trace a hazard, or call out a detail quickly.',
      footer: 'Pen mode: draw directly on the image; color and stroke size apply to each new mark.',
      Icon: Pencil,
      tips: [sharedColorTip, sharedSizeTip, 'Undo removes the most recent mark if the stroke is not useful.'],
      title: 'Pen guidance'
    };
  }

  if (tool === 'eraser') {
    return {
      body: 'Use Eraser to remove markup added in this editor. It will not erase or damage the original evidence image.',
      footer: 'Eraser mode: move the eraser over added markings only; the eraser area slider controls how wide the cleanup area is.',
      Icon: Eraser,
      tips: [sharedSizeTip, 'The floating eraser circle shows the area that will clean added objects.', 'Original evidence remains protected.'],
      title: 'Eraser guidance'
    };
  }

  if (tool === 'text') {
    return {
      body: 'Use Text for inspection notes, pass/fail labels, measurements, or short conclusions on the image.',
      footer: 'Text mode: type a note, click the image to place it, double-click existing text to edit it, and press Delete when selected to remove it.',
      Icon: Type,
      tips: [sharedColorTip, sharedSizeTip, 'Use New text before placing another independent note.'],
      title: 'Text guidance'
    };
  }

  if (tool === 'arrow') {
    return {
      body: 'Use Arrow to point directly at the evidence detail a reviewer must inspect.',
      footer: 'Arrow mode: drag from the starting point toward the item you want the arrow to identify.',
      Icon: ArrowUpRight,
      tips: [sharedColorTip, sharedSizeTip, 'Keep arrows short and direct so the evidence remains readable.'],
      title: 'Arrow guidance'
    };
  }

  if (tool === 'line') {
    return {
      body: 'Use Line for measurement guides, boundaries, separation points, or alignment checks.',
      footer: 'Line mode: drag from start to finish; color and stroke size apply to each new line.',
      Icon: Minus,
      tips: [sharedColorTip, sharedSizeTip, 'Use straight lines for clean review-ready evidence markup.'],
      title: 'Line guidance'
    };
  }

  if (tool === 'rect') {
    return {
      body: 'Use Rectangle to frame a machine guard, product zone, defect area, or controlled work boundary.',
      footer: 'Rectangle mode: drag around the exact area to frame; color and stroke size apply to the outline.',
      Icon: Square,
      tips: [sharedColorTip, sharedSizeTip, 'Leave enough space around the target so reviewers can see context.'],
      title: 'Rectangle guidance'
    };
  }

  return {
    body: 'Use Circle to mark round objects, point hazards, test results, or small visual details.',
    footer: 'Circle mode: drag around the target area; color and stroke size apply to the outline.',
    Icon: CircleDot,
    tips: [sharedColorTip, sharedSizeTip, 'Use circles for focused attention without covering the evidence.'],
    title: 'Circle guidance'
  };
}

function RailsUserAvatar({ user }: { user: RailsUserSummary }) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    if (!user.profilePhotoUrl) {
      setObjectUrl(null);
      return undefined;
    }

    void getRailsAuthenticatedObjectUrl(user.profilePhotoUrl).then((nextObjectUrl) => {
      if (isMounted) {
        setObjectUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }

          return nextObjectUrl;
        });
      } else {
        URL.revokeObjectURL(nextObjectUrl);
      }
    }).catch(() => {
      if (isMounted) {
        setObjectUrl(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user.profilePhotoCacheKey, user.profilePhotoUrl]);

  React.useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  return (
    <span className="rails-user-avatar">
      {objectUrl ? (
        <img alt="" src={objectUrl} />
      ) : (
        user.initials
      )}
    </span>
  );
}

function getRailsVisibleCollaborators(item: RailsItem): RailsUserSummary[] {
  const usersByUid = new Map<string, RailsUserSummary>();

  [
    item.owner,
    item.approver,
    ...item.contributors
  ].forEach((user) => {
    if (user?.uid) {
      usersByUid.set(user.uid, user);
    }
  });

  return Array.from(usersByUid.values());
}

function getRailsUserByUid(
  item: RailsItem | null,
  candidates: RailsUserSummary[],
  uid?: string | null
): RailsUserSummary | null {
  if (!uid) {
    return null;
  }

  return [
    ...(item ? getRailsVisibleCollaborators(item) : []),
    ...candidates
  ].find((user) => user.uid === uid) || null;
}

function getRailsAuditActor(
  event: RailsAuditActivity,
  companyUsers: RailsUserSummary[],
  item: RailsItem
): RailsUserSummary {
  const knownLoopUsers = [
    item.owner,
    item.approver,
    item.archivedBy,
    item.cancelledBy,
    item.reopenedBy,
    item.standardizationOwner,
    item.standardizationVerifiedBy,
    ...item.contributors,
    ...item.actions.flatMap((action) => [
      action.owner,
      action.startedBy,
      action.completedBy,
      action.verifiedBy
    ])
  ].filter((user): user is RailsUserSummary => Boolean(user));
  const resolvedUser = [...companyUsers, ...knownLoopUsers].find((user) => user.uid === event.actorUid);

  if (resolvedUser) {
    return resolvedUser;
  }

  return {
    departmentName: null,
    displayName: event.actorDisplayName || 'Synzapp user',
    initials: getRailsInitials(event.actorDisplayName || 'Synzapp user'),
    profilePhotoCacheKey: null,
    profilePhotoUrl: null,
    roleName: event.actorRole || 'User',
    uid: event.actorUid
  };
}

function getRailsInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'U';
}

function formatRailsAuditSummary(
  event: RailsAuditActivity,
  companyUsers: RailsUserSummary[],
  item: RailsItem
): string {
  if (event.type !== 'RAILS_COLLABORATOR_REMOVED') {
    return event.summary;
  }

  const collaboratorDisplayName = typeof event.metadata.collaboratorDisplayName === 'string'
    ? event.metadata.collaboratorDisplayName.trim()
    : '';
  const collaboratorUid = typeof event.metadata.collaboratorUid === 'string'
    ? event.metadata.collaboratorUid
    : '';
  const knownLoopUsers = [
    item.owner,
    item.approver,
    item.standardizationOwner,
    item.standardizationVerifiedBy,
    item.archivedBy,
    item.cancelledBy,
    item.reopenedBy,
    ...item.contributors,
    ...item.actions.flatMap((action) => [action.owner, action.startedBy, action.completedBy, action.verifiedBy])
  ].filter((user): user is RailsUserSummary => Boolean(user));
  const resolvedUser = [...companyUsers, ...knownLoopUsers].find((user) => user.uid === collaboratorUid);
  const displayName = collaboratorDisplayName || resolvedUser?.displayName || 'a collaborator';

  return `Removed collaborator ${displayName}.`;
}

function getRailsAuditChangeRows(
  event: RailsAuditActivity,
  companyUsers: RailsUserSummary[]
): Array<{ after: string; before: string; field: string; label: string }> {
  const beforeSource = getRailsAuditComparableSource(event.before, event.type);
  const afterSource = getRailsAuditComparableSource(event.after, event.type);

  if (!beforeSource || !afterSource) {
    return [];
  }

  const fields = Array.from(new Set([...Object.keys(beforeSource), ...Object.keys(afterSource)]));

  return fields
    .filter((field) => !railsAuditHiddenFields.has(field))
    .filter((field) => !areRailsAuditValuesEqual(beforeSource[field], afterSource[field]))
    .map((field) => ({
      after: formatRailsAuditValue(field, afterSource[field], companyUsers),
      before: formatRailsAuditValue(field, beforeSource[field], companyUsers),
      field,
      label: formatRailsAuditFieldLabel(field)
    }))
    .slice(0, 8);
}

function getRailsAuditComparableSource(source: Record<string, unknown> | null, eventType: string): Record<string, unknown> | null {
  if (!source) {
    return null;
  }

  if (eventType === 'RAILS_ACTION_UPDATED' && isRailsAuditRecord(source.action)) {
    return source.action;
  }

  return source;
}

function areRailsAuditValuesEqual(before: unknown, after: unknown): boolean {
  return JSON.stringify(before ?? null) === JSON.stringify(after ?? null);
}

function formatRailsAuditValue(
  field: string,
  value: unknown,
  companyUsers: RailsUserSummary[]
): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return field.toLowerCase().includes('percent') ? `${value}%` : String(value);
  }

  if (typeof value === 'string') {
    if (field.endsWith('Uid') || field === 'actorUid') {
      return companyUsers.find((user) => user.uid === value)?.displayName || 'Company user';
    }

    if (/AtIso$/.test(field)) {
      return formatDateTimeStamp(value);
    }

    if (/Date$/.test(field)) {
      return formatDateLabel(value);
    }

    return value;
  }

  if (Array.isArray(value)) {
    if (field === 'evidenceIds') {
      return value.length ? `${value.length} linked` : 'No evidence linked';
    }

    return value.length ? `${value.length} items` : 'None';
  }

  if (isRailsAuditRecord(value)) {
    if (typeof value.displayLabel === 'string') {
      return value.displayLabel;
    }

    if (typeof value.title === 'string') {
      return value.title;
    }

    if (typeof value.status === 'string' && typeof value.reason === 'string') {
      return `${value.status}: ${value.reason || 'No reason'}`;
    }

    if (typeof value.status === 'string') {
      return value.status;
    }
  }

  return 'Updated record';
}

function isRailsAuditRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function formatRailsAuditFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    approverUid: 'Approver',
    category: 'Category',
    completedAtCorrectionReason: 'Completion correction reason',
    completedAtIso: 'Completion timestamp',
    completedByExternalName: 'External completed by',
    completedByUid: 'Completed by',
    containmentNote: 'Containment documentation',
    dueDate: 'Due date',
    effectivenessCriteria: 'Acceptance criteria',
    effectivenessResult: 'Effectiveness result',
    evidenceIds: 'Linked evidence',
    implementationNote: 'Implementation note',
    linkedLsw: 'Linked LSW',
    linkedLswSource: 'Linked LSW source',
    linkedRca: 'Linked RCA',
    linkedRcaDecision: 'RCA decision',
    linkedRcaId: 'RCA project',
    ownerUid: 'Owner',
    priority: 'Priority',
    problem: 'Problem',
    progressPercent: 'Progress',
    rcaTriageRequest: 'RCA triage request',
    riskControlled: 'Risk control',
    source: 'Source',
    standardization: 'Standardization target',
    standardizationDueDate: 'Standardization due date',
    standardizationOwnerUid: 'Standardization owner',
    standardizationStatus: 'Standardization status',
    standardizationType: 'Standardization type',
    standardizationVerification: 'Standardization verification',
    startedAtCorrectionReason: 'Started correction reason',
    startedAtIso: 'Started timestamp',
    startedByUid: 'Started by',
    status: 'Status',
    title: 'Title',
    verification: 'Verification',
    verificationNote: 'Verification note',
    verifiedAtIso: 'Verified timestamp',
    verifiedByUid: 'Verified by'
  };

  return labels[field] || field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}

const railsAuditHiddenFields = new Set([
  'actionId',
  'archivedAtIso',
  'archivedByUid',
  'cancelledAtIso',
  'cancelledByUid',
  'reopenedAtIso',
  'reopenedByUid',
  'standardizationVerifiedAtIso',
  'standardizationVerifiedByUid'
]);

function getStandardizationTargetInputValue(value: string): string {
  return value === 'Define during triage.' ? '' : value;
}

function getRailsStatusToneClass(status: RailsStatus): string {
  return status.toLowerCase().replace(/\s+/g, '-');
}

function getRailsStageGuidance(item: RailsItem): {
  focus: string[];
  gates: string[];
  summary: string;
} {
  const linkedRcaText = item.linkedRcaId ? 'linked RCA project' : item.linkedRca;
  const evidenceCount = item.evidence.filter((evidence) => evidence.status === 'Attached').length;
  const openActions = item.actions.filter((action) => action.status !== 'Done').length;

  switch (item.status) {
    case 'New':
      return {
        summary: 'This loop is an intake record. The manager should confirm ownership, source, urgency, and whether RCA or LSW linkage is required before work starts.',
        focus: [
          `Confirm accountable owner: ${item.owner.displayName}.`,
          `Confirm RCA decision: ${linkedRcaText || 'not selected'}.`,
          'Capture the business reason, hazard, defect, or process gap clearly.'
        ],
        gates: [
          'Owner, department, due date, priority, and problem statement are complete.',
          'LSW source, RCA source, or manual origin decision is documented.',
          'RCA decision is linked, triage requested, or explicitly marked not required.'
        ]
      };
    case 'Triaged':
      return {
        summary: 'This loop has been screened and is ready for controlled action planning. The next step is to define accountable actions and required evidence.',
        focus: [
          'Create action steps that cover containment, correction, and verification.',
          'Assign owners and due dates for every action.',
          'Identify which evidence must prove the work was completed.'
        ],
        gates: [
          'At least one action exists.',
          'Every action has an owner, due date, and clear title.',
          'Work can begin only after the action plan is credible and traceable.'
        ]
      };
    case 'Reopened':
      return {
        summary: 'This loop was returned from closure for controlled follow-up. Treat it as active work with the original audit trail preserved.',
        focus: [
          'Review the reopening reason and the gap that caused follow-up.',
          'Add or update actions tied to the reopened issue.',
          'Keep evidence linked to the specific follow-up action.'
        ],
        gates: [
          'Reopening reason remains documented.',
          'Any new corrective action has owner, due date, and evidence expectations.',
          'The loop cannot close again until verification and standardization are complete.'
        ]
      };
    case 'In Progress':
      return {
        summary: 'This is the execution stage. Managers should monitor action progress, evidence quality, blocker status, and completion timestamps.',
        focus: [
          `${openActions} action${openActions === 1 ? '' : 's'} still require completion.`,
          'Document containment, corrective action, and effectiveness details on each governed action.',
          'Use backend timestamps as the official record; manual corrections require reasons.'
        ],
        gates: [
          'Every action reaches 100% and Done.',
          'Required action documentation is complete.',
          'Implementation and effectiveness evidence are linked before verification.'
        ]
      };
    case 'Verification':
      return {
        summary: 'This stage confirms the work actually solved the issue. Evidence, results, and approval readiness are reviewed before standardization or approval.',
        focus: [
          'Review whether evidence proves the stated problem is controlled.',
          'Confirm effectiveness results match the acceptance criteria.',
          'Make sure the approver is assigned and the verification note is complete.'
        ],
        gates: [
          'All actions are Done with complete documentation.',
          'All required evidence is attached and linked.',
          'Verification method, result, and approver are documented.'
        ]
      };
    case 'Approved':
      return {
        summary: 'The loop is approved for controlled closure. The remaining work is prevention: standardization, verification of the standard, and audit-ready closeout.',
        focus: [
          'Confirm the standardization target and type match the root learning.',
          'Attach the standardization document or controlled record.',
          'Verify that the new standard is usable by the affected team.'
        ],
        gates: [
          'Standardization target, owner, due date, and verification method are saved.',
          'Standardization document is attached.',
          'Standardization plan is verified before closing.'
        ]
      };
    case 'Closed':
      return {
        summary: 'This loop is complete and retained for audit history. Closed records should remain searchable, exportable, and reopenable only with a governed reason.',
        focus: [
          'Use the record as proof of containment, correction, verification, and standardization.',
          `Review the evidence package: ${evidenceCount} attached item${evidenceCount === 1 ? '' : 's'}.`,
          'Reopen only when controlled follow-up is required.'
        ],
        gates: [
          'Closure requirements are complete.',
          'Audit history retains who changed what and when.',
          'Any future change requires a reopen reason and new controlled workflow.'
        ]
      };
    default:
      return {
        summary: 'This RAILS loop is governed by backend workflow gates and audit history.',
        focus: ['Review the current owner, due date, actions, evidence, and approval readiness.'],
        gates: ['Complete the active page requirements before moving forward.']
      };
  }
}

function getStandardizationRequirements(
  item: RailsItem,
  draft: { target: string; verification: string }
): Array<{ complete: boolean; key: string; label: string }> {
  return [
    {
      complete: Boolean(draft.target.trim()),
      key: 'target',
      label: 'Define and save the standardization target'
    },
    {
      complete: Boolean(item.standardizationType),
      key: 'type',
      label: 'Select the standardization type'
    },
    {
      complete: Boolean(item.standardizationOwnerUid),
      key: 'owner',
      label: 'Assign a standardization owner'
    },
    {
      complete: Boolean(item.standardizationDueDate),
      key: 'dueDate',
      label: 'Set the standardization due date'
    },
    {
      complete: Boolean(draft.verification.trim()),
      key: 'verification',
      label: 'Document the standardization verification method'
    },
    {
      complete: item.evidence.some((evidence) => evidence.purpose === 'standardization' && evidence.status === 'Attached' && Boolean(evidence.fileUrl && evidence.fileName)),
      key: 'document',
      label: 'Attach the standardization document'
    },
    {
      complete: item.standardizationStatus === 'Verified',
      key: 'status',
      label: 'Verify the standardization plan'
    }
  ];
}

function getRcaDecisionValue(item: RailsItem): string {
  const linkedRca = item.linkedRca.toLowerCase();

  if (item.linkedRcaId) {
    return item.linkedRcaId;
  }

  if (linkedRca.includes('triage requested')) {
    return '__triage_requested';
  }

  if (linkedRca.includes('not required')) {
    return '__not_required';
  }

  return '';
}

function getLswCandidateValue(candidate: Pick<RailsLswSourceCandidate, 'sourceId' | 'sourceType'>): string {
  return `${candidate.sourceType}:${candidate.sourceId}`;
}

function getLswSourceValue(item: RailsItem): string {
  return item.linkedLswSource ? `${item.linkedLswSource.sourceType}:${item.linkedLswSource.sourceId}` : '';
}

function getRailsSourceSummary(item: RailsItem): string {
  if (item.linkedLswSource) {
    return `LSW ${item.linkedLswSource.sourceTypeLabel}`;
  }

  if (item.linkedRcaId) {
    return 'RCA project';
  }

  return item.source && item.source !== 'Manual intake' ? item.source : 'Manual intake not justified';
}

function shouldShowEvidenceFileName(label: string, fileName?: string | null): boolean {
  const safeFileName = fileName?.trim();

  return Boolean(safeFileName && safeFileName.toLowerCase() !== label.trim().toLowerCase());
}

function getEvidenceFileExtension(evidence: Pick<RailsItem['evidence'][number], 'fileName' | 'label'>): string {
  const sourceName = (evidence.fileName || evidence.label || '').trim();
  const extensionMatch = sourceName.match(/(\.[A-Za-z0-9]{1,12})$/);

  return extensionMatch?.[1] || '';
}

function getEvidenceEditableBaseName(evidence: Pick<RailsItem['evidence'][number], 'fileName' | 'label'>): string {
  const extension = getEvidenceFileExtension(evidence);
  const label = evidence.label.trim();

  return extension && label.toLowerCase().endsWith(extension.toLowerCase())
    ? label.slice(0, -extension.length)
    : label;
}

function buildEvidenceLabelWithLockedExtension(evidence: Pick<RailsItem['evidence'][number], 'fileName' | 'label'>, draftValue: string): string {
  const extension = getEvidenceFileExtension(evidence);
  const normalizedBaseName = draftValue.replace(/\s+/g, ' ').trim();

  if (!normalizedBaseName) {
    return '';
  }

  return extension ? `${normalizedBaseName.replace(new RegExp(`\\${extension}$`, 'i'), '')}${extension}` : normalizedBaseName;
}

function hasRailsRcaDecision(item: RailsItem): boolean {
  return Boolean(item.linkedRcaId || item.linkedRcaDecision?.status || item.rcaTriageRequest);
}

function hasRailsEnterpriseOriginDecision(item: RailsItem): boolean {
  const manualSource = item.source.trim();

  return Boolean(
    item.linkedLswSource ||
    item.linkedRcaId ||
    (manualSource && manualSource !== 'Manual intake')
  );
}

interface RailsFieldSelectOption {
  label: string;
  value: string;
}

function RailsFieldSelect({
  'aria-label': ariaLabel,
  disabled,
  onChange,
  onOpen,
  options,
  style,
  value
}: {
  'aria-label'?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onOpen?: () => void;
  options: RailsFieldSelectOption[];
  style?: React.CSSProperties;
  value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  function handleOpenChange(nextOpen: boolean) {
    if (disabled) {
      setOpen(false);
      return;
    }

    setOpen(nextOpen);
    if (nextOpen) {
      onOpen?.();
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          aria-label={ariaLabel}
          aria-expanded={open}
          className="rails-field-select-trigger"
          disabled={disabled}
          style={style}
          type="button"
        >
          <span>{selectedOption?.label || 'Select'}</span>
          <ChevronDown aria-hidden="true" size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          avoidCollisions={false}
          className="rails-field-select-popover"
          side="bottom"
          sideOffset={6}
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          <div className="rails-field-select-menu" role="listbox">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  aria-selected={isSelected}
                  className={isSelected ? 'is-selected' : ''}
                  disabled={disabled}
                  key={`${option.value}-${option.label}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  <span>{option.label}</span>
                  {isSelected ? <CheckCircle2 aria-hidden="true" size={14} /> : null}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RailsDatePicker({
  disabled,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = parseDateOnly(value);

  function commitDate(date: Date | undefined) {
    if (!date) {
      return;
    }

    onChange(formatDateOnly(date));
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-label="Due date"
          className="rails-date-picker-trigger"
          disabled={disabled}
          type="button"
        >
          <span>{selectedDate ? formatDateInputLabel(selectedDate) : 'mm/dd/yyyy'}</span>
          <CalendarDays aria-hidden="true" size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="rails-date-picker-popover"
          collisionPadding={14}
          sideOffset={8}
        >
          <DayPicker
            defaultMonth={selectedDate || new Date()}
            fixedWeeks
            mode="single"
            onSelect={commitDate}
            selected={selectedDate || undefined}
            showOutsideDays
          />
          <div className="rails-date-picker-actions">
            <button
              disabled={disabled}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              type="button"
            >
              Clear
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                onChange(formatDateOnly(new Date()));
                setOpen(false);
              }}
              type="button"
            >
              Today
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function formatAuditEventType(type: string): string {
  return type
    .replace(/^RAILS_/, '')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateLabel(dateIso: string): string {
  if (!dateIso) {
    return 'Not set';
  }

  const date = new Date(`${dateIso}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short'
  }).format(date);
}

function formatAssistantAnswer(value: string): string[] {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines : ['I do not have enough RAILS context to answer that yet.'];
}

function isAssistantMessageListNearBottom(list: HTMLDivElement): boolean {
  return list.scrollHeight - list.scrollTop - list.clientHeight < 56;
}

function scrollAssistantMessagesToBottom(list: HTMLDivElement, behavior: ScrollBehavior) {
  list.scrollTo({
    behavior,
    top: list.scrollHeight
  });
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateInputLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function getRailsItemStageReadinessPercent(
  item: RailsItem,
  progressDrafts: Record<string, number> = {},
  standardizationDraft?: { target: string; verification: string }
): number {
  const tasks = getRailsItemStageReadinessTasks(item, progressDrafts, standardizationDraft);

  if (!tasks.length) {
    return item.workflowGate.canAdvance || item.status === 'Closed' ? 100 : 0;
  }

  const completedTasks = tasks.filter((task) => task.complete).length;

  return clampProgress((completedTasks / tasks.length) * 100);
}

function getRailsItemStageReadinessTasks(
  item: RailsItem,
  progressDrafts: Record<string, number> = {},
  standardizationDraft?: { target: string; verification: string }
): RailsDetailReadinessTask[] {
  const actions = item.actions || [];
  const attachedEvidence = item.evidence.filter((evidence) => evidence.status === 'Attached' && isRailsEvidenceLinkVisibleForItem(item, evidence));
  const requiredEvidence = item.evidence.filter((evidence) => evidence.status === 'Required');
  const allRequiredEvidenceLinked = requiredEvidence.every((requirement) => isRequiredRailsEvidenceSatisfied(item, requirement, attachedEvidence));
  const allActionsReadyForVerification = actions.length > 0
    && actions.every((action) => {
      const draftProgress = clampProgress(progressDrafts[action.actionId] ?? action.progressPercent);
      return draftProgress === 100 && action.status === 'Done';
    });
  const governedActionRequirements = actions.flatMap((action, actionIndex) => (
    getActionRequirementState(action, attachedEvidence).map((requirement, requirementIndex) => ({
      complete: requirement.complete,
      key: `action-${actionIndex}-${requirementIndex}`,
      label: requirement.label
    }))
  ));
  const standardizationRequirements = getStandardizationRequirements(item, {
    target: standardizationDraft?.target ?? getStandardizationTargetInputValue(item.standardization),
    verification: standardizationDraft?.verification ?? item.standardizationVerification
  });
  const triageTasks: RailsDetailReadinessTask[] = [
    { complete: Boolean(item.owner?.uid), key: 'owner', label: 'Assign an accountable owner' },
    { complete: Boolean(item.departmentName), key: 'department', label: 'Assign the loop to a department' },
    { complete: Boolean(item.dueDate), key: 'dueDate', label: 'Set the loop due date' },
    { complete: Boolean(item.priority), key: 'priority', label: 'Set the priority' },
    { complete: Boolean(item.title.trim()), key: 'title', label: 'Enter a loop title' },
    { complete: Boolean(item.problem.trim()), key: 'problem', label: 'Enter the problem statement' },
    { complete: actions.length > 0, key: 'actionExists', label: 'Add at least one action plan item' },
    { complete: hasRailsRcaDecision(item), key: 'rcaDecision', label: 'Make an RCA decision' },
    { complete: hasRailsEnterpriseOriginDecision(item), key: 'originDecision', label: 'Link LSW, link RCA, or document a manual source' },
    { complete: item.evidence.length > 0, key: 'evidencePlaceholders', label: 'Define required evidence placeholders' }
  ];
  const executionTasks: RailsDetailReadinessTask[] = [
    { complete: actions.length > 0, key: 'executionActionExists', label: 'Add at least one action before work can start' },
    { complete: actions.length > 0 && actions.every((action) => Boolean(action.title.trim())), key: 'actionTitles', label: 'Name every action item' },
    { complete: actions.length > 0 && actions.every((action) => Boolean(action.ownerUid)), key: 'actionOwners', label: 'Assign an owner to every action' },
    { complete: actions.length > 0 && actions.every((action) => Boolean(action.dueDate)), key: 'actionDueDates', label: 'Set a due date for every action' },
    {
      complete: actions.some((action) => action.status === 'Open' || action.status === 'In Progress' || clampProgress(progressDrafts[action.actionId] ?? action.progressPercent) > 0),
      key: 'actionExecutionState',
      label: 'Keep at least one action open or in progress'
    }
  ];
  const verificationTasks: RailsDetailReadinessTask[] = [
    { complete: allActionsReadyForVerification, key: 'actionsComplete', label: 'Complete every action to 100% and mark it Done' },
    ...governedActionRequirements,
    { complete: allRequiredEvidenceLinked, key: 'requiredEvidenceBeforeVerification', label: 'Link all required verification evidence from the Evidence Library' },
    { complete: Boolean(item.verification.trim()), key: 'verificationMethod', label: 'Define the verification method' }
  ];
  const approvalTasks: RailsDetailReadinessTask[] = [
    ...verificationTasks,
    { complete: Boolean(item.approver?.uid), key: 'approver', label: 'Assign an approver before approval' }
  ];

  if (item.status === 'New') {
    return triageTasks;
  }

  if (item.status === 'Triaged' || item.status === 'Reopened') {
    return [...triageTasks, ...executionTasks];
  }

  if (item.status === 'In Progress') {
    return [...executionTasks, ...verificationTasks];
  }

  if (item.status === 'Verification') {
    return approvalTasks;
  }

  if (item.status === 'Approved') {
    return [...approvalTasks, ...standardizationRequirements];
  }

  if (item.status === 'Closed') {
    return [{ complete: true, key: 'closed', label: 'Workflow closed' }];
  }

  return [];
}

function clampProgress(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function getProgressTrackStyle(progressPercent: number): React.CSSProperties {
  const progress = clampProgress(progressPercent);

  return {
    '--rails-progress-fill': getActionProgressFill(progress),
    '--rails-progress-glow': getActionProgressGlow(progress)
  } as React.CSSProperties;
}

function getActionProgressTrackStyle(progressPercent: number): React.CSSProperties {
  const progress = clampProgress(progressPercent);

  return {
    '--rails-action-progress-fill': getActionProgressFill(progress),
    '--rails-action-progress-glow': getActionProgressGlow(progress)
  } as React.CSSProperties;
}

function getActionProgressFill(progress: number): string {
  if (progress <= 0) {
    return '#e2e8f0';
  }

  if (progress >= 100) {
    return 'linear-gradient(90deg, #16a34a 0%, #16a34a 100%)';
  }

  if (progress < 20) {
    return 'linear-gradient(90deg, #dc2626 0%, #dc2626 100%)';
  }

  if (progress === 20) {
    return 'linear-gradient(90deg, #dc2626 0%, #dc2626 92%, #f59e0b 100%)';
  }

  if (progress < 75) {
    const redEnd = Math.min(100, Math.max(0, (20 / progress) * 100));
    const blendStart = Math.max(0, redEnd - 4);
    const blendEnd = Math.min(100, redEnd + 4);

    return `linear-gradient(90deg, #dc2626 0%, #dc2626 ${blendStart}%, #f59e0b ${blendEnd}%, #f59e0b 100%)`;
  }

  const redEnd = Math.min(100, Math.max(0, (20 / progress) * 100));
  const greenStart = Math.min(100, Math.max(0, (75 / progress) * 100));
  const redBlendStart = Math.max(0, redEnd - 3);
  const redBlendEnd = Math.min(100, redEnd + 3);
  const greenBlendStart = Math.max(0, greenStart - 3);
  const greenBlendEnd = Math.min(100, greenStart + 3);

  return `linear-gradient(90deg, #dc2626 0%, #dc2626 ${redBlendStart}%, #f59e0b ${redBlendEnd}%, #f59e0b ${greenBlendStart}%, #16a34a ${greenBlendEnd}%, #16a34a 100%)`;
}

function getActionProgressGlow(progress: number): string {
  if (progress < 20) {
    return 'rgba(220, 38, 38, 0.22)';
  }

  if (progress < 75) {
    return 'rgba(245, 158, 11, 0.24)';
  }

  return 'rgba(22, 163, 74, 0.24)';
}

function formatRelativeDate(dateIso: string): string {
  const dateMs = Date.parse(dateIso);

  if (!Number.isFinite(dateMs)) {
    return 'Recently';
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - dateMs) / 60_000));

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  if (diffMinutes < 1440) {
    return `${Math.round(diffMinutes / 60)} hr ago`;
  }

  return `${Math.round(diffMinutes / 1440)} days ago`;
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

function inferEvidenceTypeLabel(fileName?: string | null): string {
  if (!fileName) {
    return 'File type unavailable';
  }

  const extension = fileName.split('.').pop()?.toUpperCase();
  return extension ? `${extension} file` : 'File';
}

function getEvidenceThumbnailUrl(
  evidence: Pick<RailsItem['evidence'][number], 'contentType' | 'fileName'>,
  imageThumbUrl?: string
): string {
  if (imageThumbUrl && evidence.contentType?.startsWith('image/')) {
    return imageThumbUrl;
  }

  const contentType = (evidence.contentType || '').toLowerCase();
  const extension = (evidence.fileName || '').split('.').pop()?.toLowerCase() || '';

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

function getEvidenceSearchText(evidence: RailsItem['evidence'][number]): string {
  return [
    evidence.label,
    evidence.fileName,
    evidence.contentType,
    inferEvidenceTypeLabel(evidence.fileName),
    evidence.uploadedAtIso ? formatDateTimeStamp(evidence.uploadedAtIso) : '',
    evidence.uploadedAtIso ? new Date(evidence.uploadedAtIso).toLocaleDateString() : '',
    evidence.uploadedAtIso ? new Date(evidence.uploadedAtIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isRailsEvidenceLinkVisibleForItem(item: RailsItem, evidence: RailsItem['evidence'][number]): boolean {
  return (evidence.visibility || 'public') === 'public' || evidence.uploadedByUid === item.owner.uid;
}

function isRequiredRailsEvidenceSatisfied(
  item: RailsItem,
  requirement: RailsItem['evidence'][number],
  visibleAttachedEvidence: RailsItem['evidence']
): boolean {
  if (!requirement.sourceEvidenceId) {
    return false;
  }

  return visibleAttachedEvidence.some((evidence) => (
    evidence.evidenceId === requirement.sourceEvidenceId
    && evidence.status === 'Attached'
    && Boolean(evidence.fileName && evidence.fileUrl)
    && isRailsEvidenceLinkVisibleForItem(item, evidence)
  ));
}

function isoToDateTimeLocal(dateIso: string | null | undefined): string {
  if (!dateIso) {
    return '';
  }

  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function dateTimeLocalToIso(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

type RailsGovernedActionKind = 'containment' | 'corrective' | 'effectiveness' | 'general';
type RailsActionTextFieldKey =
  | 'containmentNote'
  | 'effectivenessCriteria'
  | 'effectivenessResult'
  | 'implementationNote'
  | 'riskControlled'
  | 'standardizationNote'
  | 'verificationNote';

function getRailsActionKind(action: Pick<RailsAction, 'title'>): RailsGovernedActionKind {
  const title = action.title || '';
  if (/\bcontain\b|\bimmediate risk\b/i.test(title)) {
    return 'containment';
  }
  if (/\bcorrective\b|\bcomplete corrective\b/i.test(title)) {
    return 'corrective';
  }
  if (/\beffectiveness\b|\bstandardize\b|\bstandardise\b/i.test(title)) {
    return 'effectiveness';
  }

  return 'general';
}

function getRailsActionRecordTitle(kind: RailsGovernedActionKind): string {
  if (kind === 'containment') {
    return 'Containment record';
  }
  if (kind === 'corrective') {
    return 'Corrective action record';
  }
  if (kind === 'effectiveness') {
    return 'Effectiveness and standardization record';
  }

  return 'Action record';
}

function getRailsActionFields(kind: RailsGovernedActionKind): Array<{
  key: RailsActionTextFieldKey;
  label: string;
  placeholder: string;
}> {
  if (kind === 'containment') {
    return [
      {
        key: 'containmentNote',
        label: 'Action taken',
        placeholder: 'Describe the immediate control used to make the area, product, equipment, or process safe.'
      },
      {
        key: 'riskControlled',
        label: 'Risk controlled',
        placeholder: 'Describe what risk is now controlled and what temporary limit remains in place.'
      },
      {
        key: 'verificationNote',
        label: 'Verification note',
        placeholder: 'Describe how supervision, QA, safety, or maintenance verified the containment.'
      }
    ];
  }

  if (kind === 'corrective') {
    return [
      {
        key: 'implementationNote',
        label: 'Corrective action implemented',
        placeholder: 'Describe the permanent corrective action that was completed.'
      },
      {
        key: 'riskControlled',
        label: 'Failure mode addressed',
        placeholder: 'Describe the root cause, failure mode, or RCA finding this action addresses.'
      },
      {
        key: 'verificationNote',
        label: 'Owner completion confirmation',
        placeholder: 'Describe how the owner confirmed implementation was complete.'
      }
    ];
  }

  if (kind === 'effectiveness') {
    return [
      {
        key: 'effectivenessCriteria',
        label: 'Acceptance criteria',
        placeholder: 'Define the measurable result required to prove the fix is effective.'
      },
      {
        key: 'effectivenessResult',
        label: 'Actual result',
        placeholder: 'Document the observed result, check result, audit result, or measured outcome.'
      },
      {
        key: 'verificationNote',
        label: 'Effectiveness approval note',
        placeholder: 'Document who verified the effectiveness result and approved the result for the next step.'
      }
    ];
  }

  return [
    {
      key: 'containmentNote',
      label: 'Action taken',
      placeholder: 'Describe the action completed for this step.'
    },
    {
      key: 'riskControlled',
      label: 'Risk or gap controlled',
      placeholder: 'Describe the risk, failure mode, or process gap this action controls.'
    },
    {
      key: 'verificationNote',
      label: 'Verification note',
      placeholder: 'Describe how the owner, supervisor, QA, safety, or maintenance verified this action.'
    }
  ];
}

function getActionRequirementState(
  action: RailsAction,
  attachedEvidence: RailsItem['evidence']
): Array<{ complete: boolean; label: string }> {
  const linkedAttachedEvidenceIds = new Set(attachedEvidence.map((evidence) => evidence.evidenceId));
  const actionKind = getRailsActionKind(action);

  if (actionKind === 'corrective') {
    return [
      {
        complete: Boolean(action.implementationNote?.trim()),
        label: 'Corrective action documented'
      },
      {
        complete: Boolean(action.riskControlled?.trim()),
        label: 'Failure mode or RCA link documented'
      },
      {
        complete: Boolean(action.verificationNote?.trim()),
        label: 'Owner completion confirmed'
      },
      {
        complete: (action.evidenceIds || []).some((evidenceId) => linkedAttachedEvidenceIds.has(evidenceId)),
        label: 'Implementation evidence linked'
      }
    ];
  }

  if (actionKind === 'effectiveness') {
    return [
      {
        complete: Boolean(action.effectivenessCriteria?.trim()),
        label: 'Acceptance criteria documented'
      },
      {
        complete: Boolean(action.effectivenessResult?.trim()),
        label: 'Actual effectiveness result documented'
      },
      {
        complete: Boolean(action.verificationNote?.trim()),
        label: 'Effectiveness approval note documented'
      },
      {
        complete: (action.evidenceIds || []).some((evidenceId) => linkedAttachedEvidenceIds.has(evidenceId)),
        label: 'Effectiveness evidence linked'
      }
    ];
  }

  return [
    {
      complete: Boolean(action.containmentNote?.trim()),
      label: 'Containment action documented'
    },
    {
      complete: Boolean(action.riskControlled?.trim()),
      label: 'Controlled risk documented'
    },
    {
      complete: Boolean(action.verificationNote?.trim()),
      label: 'Verification method documented'
    },
    {
      complete: (action.evidenceIds || []).some((evidenceId) => linkedAttachedEvidenceIds.has(evidenceId)),
      label: 'Evidence linked to this action'
    }
  ];
}

function hasManualExecutionOverride(action: RailsAction): boolean {
  return Boolean(
    action.startedAtCorrectionReason ||
    action.startedAtIso ||
    action.startedByUid ||
    action.completedAtCorrectionReason ||
    action.completedAtIso ||
    action.completedByExternalName ||
    action.completedByUid
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The RAILS workspace could not complete that request.';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPanelMinWidth(kind: RailsPanelKind): number {
  const defaultWidth = kind === 'left' ? RAILS_LEFT_PANEL_DEFAULT_WIDTH : RAILS_RIGHT_PANEL_DEFAULT_WIDTH;

  if (typeof window === 'undefined') {
    return defaultWidth;
  }

  return Math.min(defaultWidth, getPanelMaxWidth());
}

function getPanelMaxWidth(): number {
  if (typeof window === 'undefined') {
    return 720;
  }

  return Math.max(240, Math.min(720, window.innerWidth - 32));
}

function getPanelMaxHeight(panelY: number): number {
  if (typeof window === 'undefined') {
    return 760;
  }

  return Math.max(RAILS_PANEL_MIN_HEIGHT, window.innerHeight - panelY - RAILS_PANEL_VIEWPORT_MARGIN);
}

function getPanelMaxY(panelHeight: number): number {
  if (typeof window === 'undefined') {
    return RAILS_PANEL_TOP_LIMIT;
  }

  return Math.max(RAILS_PANEL_TOP_LIMIT, window.innerHeight - Math.min(panelHeight, window.innerHeight - RAILS_PANEL_TOP_LIMIT) - RAILS_PANEL_VIEWPORT_MARGIN);
}
