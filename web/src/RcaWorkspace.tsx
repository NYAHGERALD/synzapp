import React from 'react';
import { createPortal } from 'react-dom';
import * as Y from 'yjs';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  ConnectionLineType,
  ControlButton,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  ViewportPortal,
  getBezierPath,
  useReactFlow,
  useUpdateNodeInternals,
  useViewport,
  type Edge,
  type EdgeProps,
  type Connection,
  type FinalConnectionState,
  type HandleType,
  type EdgeChange,
  type NodeChange,
  type Node as FlowNode,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { HexColorPicker } from 'react-colorful';
import 'react-day-picker/style.css';
import {
  AlignHorizontalSpaceBetween,
  ArrowLeft,
  AlertTriangle,
  Baseline,
  BadgeCheck,
  Bell,
  Bold,
  BookOpen,
  Bot,
  BoxSelect,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardCopy,
  ClipboardPaste,
  Clock3,
  Download,
  Eye,
  FileDown,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FileLock2,
  Flame,
  GitBranch,
  Gauge,
  Grid2X2,
  HandGrab,
  Italic,
  ListChecks,
  Link2,
  Lock,
  Magnet,
  Maximize2,
  Minimize2,
  Moon,
  MousePointer2,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelTopClose,
  PanelTopOpen,
  PackageCheck,
  PaintBucket,
  Palette,
  Plus,
  Presentation,
  RefreshCw,
  Redo2,
  Route,
  Search,
  Send,
  ExternalLink,
  Settings2,
  ShieldCheck,
  Sparkles,
  StickyNote,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
  Type,
  Underline,
  Undo2,
  UploadCloud,
  UserPlus,
  Users,
  Workflow,
  Wrench,
  X,
  type LucideIcon
} from 'lucide-react';
import {
  askRcaKnowledgeBase,
  buildRcaNodeTree,
  createRcaIncident,
  createRcaNode as createRcaNodeHttp,
  createRcaSession,
  deleteRcaIncident,
  deleteRcaNode as deleteRcaNodeHttp,
  downloadRcaEvidenceBlob,
  getRcaAuthenticatedObjectUrl,
  inviteRcaCollaborators,
  listRcaActivityLogs,
  listRcaCollaboratorCandidates,
  listRcaIncidents,
  listRcaNodes,
  listRcaSessions,
  recordRcaActivityLog,
  removeRcaCollaborator,
  updateRcaIncident,
  updateRcaNode as updateRcaNodeHttp,
  uploadRcaEvidenceFile,
  type RcaActivityLog,
  type RcaActivityLogAction,
  type RcaAttachedEvidence,
  type RcaFiveWhysNodeRole,
  type RcaIncident,
  type RcaKnowledgeAskResponse,
  type RcaMethodology,
  type RcaNode,
  type RcaNodeEdgeStyle,
  type RcaNodeInput,
  type RcaNodeVisualStyle,
  type RcaNodeType,
  type RcaSession,
  type RcaSplineArrowHead,
  type RcaSplineLineType,
  type RcaUserSummary,
  type RcaWorkspaceContext,
  type RcaWorkspaceResponse
} from './rcaApi';
import { useAppLoading } from './appLoading';
import {
  decodeRcaRealtimeUpdate,
  rcaRealtimeClient,
  type RcaNodeActivity,
  type RcaRealtimePresenceUser
} from './rcaRealtime';

interface RcaNodeCardData extends Record<string, unknown> {
  activities: RcaNodeActivity[];
  detail?: ReferenceRcaNodeDetail;
  incidentId: string | null;
  isReferenceProject?: boolean;
  isRealtimeReady: boolean;
  methodology: RcaMethodology;
  node: RcaNode;
  nodes: RcaNode[];
  onInspect: (nodeId: string) => void;
  onLabelCommit: (nodeId: string, label: string) => Promise<RcaNode>;
  selected: boolean;
  sessionId: string | null;
}

interface RcaFishboneSpineData extends Record<string, unknown> {
  faultGateId: string;
  selected: boolean;
}

type RcaFlowNode = FlowNode<RcaNodeCardData | RcaFishboneSpineData>;
type RcaCanvasInteractionMode = 'select' | 'pan';
type RcaCanvasTheme = 'dark' | 'light' | 'gray';
type RcaCanvasSubmenuPlacement = 'left' | 'right';
type RcaNodeContextMenuKind = 'category' | 'cause' | 'sticky';
type RcaWorkspaceView = 'dashboard' | 'canvas';
type RcaCanvasConnectionChange = {
  childNodeId: string;
  connectionHandles?: RcaNode['connectionHandles'];
  nodeType: RcaNodeType;
  parentNodeId: string | null;
};
type RcaCanvasDestructiveActionKind = 'CLEAR_CANVAS' | 'DELETE_SELECTION' | 'DELETE_NODE';
type RcaCanvasDestructiveAction = {
  kind: RcaCanvasDestructiveActionKind;
  nodeId?: string;
};
type RcaResolvedSplineStyle = {
  arrowHead: RcaSplineArrowHead;
  color: string;
  lineType: RcaSplineLineType;
  weight: number;
};
type RcaResolvedNodeVisualStyle = {
  backgroundColor: string;
  borderColor: string;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  textColor: string;
};
type RcaNodeEditInput = {
  attachedEvidence?: RcaAttachedEvidence[];
  detailFields?: Record<string, string>;
  fiveWhysNodeRole?: RcaFiveWhysNodeRole;
  isRootCause?: boolean;
  isSuspectedCause?: boolean;
  label?: string;
  nodeType?: RcaNodeType;
  parentNodeId?: string | null;
  whyChain?: string[];
};
type RcaAddNodeRequest = {
  coordinates?: { x: number; y: number };
  fiveWhysNodeRole?: RcaFiveWhysNodeRole;
  nodeType?: RcaNodeType;
  parentNodeId?: string | null;
  skipAutoArrange?: boolean;
};
type RcaInspectorDraft = {
  attachedEvidence: RcaAttachedEvidence[];
  detailFields: Record<string, string>;
  fiveWhysNodeRole: RcaFiveWhysNodeRole;
  isRootCause: boolean;
  isSuspectedCause: boolean;
  label: string;
  nodeType: RcaNodeType;
  parentNodeId: string;
  whyChain: string[];
};

interface RcaSplineEdgeData extends Record<string, unknown> {
  kind?: 'category-spine' | 'sticky-annotation';
  ownerNodeId?: string;
  sourceAnchor?: { x: number; y: number };
  splineStyle?: RcaResolvedSplineStyle;
  spineY?: number;
}

interface RcaAlignmentGuide {
  end: number;
  id: string;
  orientation: 'horizontal' | 'vertical';
  start: number;
  value: number;
}

interface RcaCanvasContextMenuState {
  canvasX: number;
  canvasY: number;
  hasClipboardText?: boolean;
  hasSelectedText?: boolean;
  isCanvasPaneTarget: boolean;
  submenuPlacement: RcaCanvasSubmenuPlacement;
  targetNodeId?: string;
  x: number;
  y: number;
}

interface RcaNodeStyleEditorState {
  nodeId: string;
  x: number;
  y: number;
}

interface RcaSplineStyleEditorState {
  edgeId: string;
  nodeId: string;
  x: number;
  y: number;
}

type RcaCanvasHistorySnapshot = RcaNode[];

const RCA_SOURCE_RIGHT_HANDLE = 'source-right';
const RCA_SOURCE_BOTTOM_HANDLE = 'source-bottom';
const RCA_TARGET_LEFT_HANDLE = 'target-left';
const RCA_TARGET_TOP_HANDLE = 'target-top';
const RCA_FISHBONE_SPINE_Y = 720;
const RCA_FISHBONE_SPINE_CONTROL_HEIGHT = 22;
const RCA_FISHBONE_SPINE_NODE_ID_PREFIX = 'fishbone-spine:';
const RCA_CANVAS_SNAP_GRID: [number, number] = [20, 20];
const RCA_CANVAS_GRID_DEFAULT_SIZE = 18;
const RCA_CANVAS_GRID_MIN_SIZE = 10;
const RCA_CANVAS_GRID_MAX_SIZE = 34;
const RCA_CANVAS_GRID_STEP = 2;
const RCA_CANVAS_COORDINATE_LIMIT = 20000;
const RCA_CANVAS_COORDINATE_EXTENT: [[number, number], [number, number]] = [
  [-RCA_CANVAS_COORDINATE_LIMIT, -RCA_CANVAS_COORDINATE_LIMIT],
  [RCA_CANVAS_COORDINATE_LIMIT, RCA_CANVAS_COORDINATE_LIMIT]
];
const RCA_TOAST_MIN_VISIBLE_MS = 4000;
const RCA_CANVAS_HISTORY_LIMIT = 50;
const RCA_ALIGNMENT_THRESHOLD = 12;
const RCA_INCIDENT_TITLE_MAX_LENGTH = 180;
const RCA_KNOWLEDGE_PANEL_DEFAULT_WIDTH = 430;
const RCA_INSPECTOR_PANEL_DEFAULT_WIDTH = 500;
const RCA_ACTIVITY_PANEL_DEFAULT_WIDTH = 430;
const RCA_CONNECTION_LINE_STYLE: React.CSSProperties = {
  opacity: 0.92,
  stroke: '#0284c7',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 2.4
};
const RCA_DEFAULT_SPLINE_STYLE: RcaResolvedSplineStyle = {
  arrowHead: 'CLOSED_FILLED',
  color: '#0284c7',
  lineType: 'CONTINUOUS',
  weight: 2.4
};
const RCA_SPLINE_ARROW_MARKER_SIZE = 14;
const RCA_SPLINE_ARROW_BASE_X = 4;
const RCA_SPLINE_ARROW_TIP_X = 12;
const RCA_SPLINE_ARROW_TIP_Y = 7;
const RCA_SPLINE_ARROW_STROKE_WIDTH = 3;
const RCA_SPLINE_WEIGHT_OPTIONS = [1.5, 2, 2.4, 3, 4, 5] as const;
const RCA_SPLINE_LINE_TYPE_OPTIONS: Array<{ label: string; value: RcaSplineLineType }> = [
  { label: 'Continuous', value: 'CONTINUOUS' },
  { label: 'Dashed', value: 'DASHED' },
  { label: 'Dotted', value: 'DOTTED' }
];
const RCA_SPLINE_ARROW_HEAD_OPTIONS: Array<{ label: string; value: RcaSplineArrowHead }> = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'Closed + filled', value: 'CLOSED_FILLED' }
];
const RCA_STYLE_COLOR_SWATCHES = [
  '#0284C7',
  '#0891B2',
  '#0F766E',
  '#16A34A',
  '#84CC16',
  '#F59E0B',
  '#EF4444',
  '#BE123C',
  '#7C3AED',
  '#2563EB',
  '#0F172A',
  '#334155',
  '#64748B',
  '#FFFFFF',
  '#ECFEFF',
  '#FEF3C7'
] as const;
const RCA_CAUSE_NODE_WIDTH = 288;
const RCA_CATEGORY_NODE_WIDTH = 224;
const RCA_FAULT_GATE_NODE_WIDTH = 288;
const RCA_STICKY_NOTE_MIN_WIDTH = 196;
const RCA_STICKY_NOTE_MAX_WIDTH = 440;
const RCA_STICKY_NOTE_MIN_HEIGHT = 88;
const RCA_STICKY_NOTE_MAX_HEIGHT = 520;
const RCA_CAUSE_NODE_HEIGHT = 132;
const RCA_CATEGORY_NODE_HEIGHT = 76;
const RCA_FAULT_GATE_NODE_HEIGHT = 112;
const RCA_CAUSE_VERTICAL_GAP = 24;
const RCA_CAUSE_TALL_VERTICAL_GAP = 28;
const RCA_CAUSE_EXTRA_TALL_VERTICAL_GAP = 32;
const RCA_CAUSE_LABEL_CHARS_PER_LINE = 34;
const RCA_CAUSE_DETAIL_CHARS_PER_LINE = 42;
const RCA_FAULT_GATE_LABEL_CHARS_PER_LINE = 34;
const RCA_CATEGORY_HORIZONTAL_GAP = 144;
const RCA_BRANCH_CATEGORY_GAP = 52;
const RCA_CAUSE_CATEGORY_HORIZONTAL_GAP = 96;
const RCA_SUBCAUSE_HORIZONTAL_GAP = 88;
const RCA_FAULT_GATE_HORIZONTAL_GAP = 220;
const RCA_FISHBONE_FIRST_COLUMN_X = 650;
const RCA_FISHBONE_TOP_CATEGORY_Y = 585;
const RCA_FISHBONE_BOTTOM_CATEGORY_Y = 805;
const RCA_FISHBONE_COLUMN_STEP = 470;
const RCA_NODE_FONT_SIZE_OPTIONS = [10, 11, 12, 13, 14, 15, 16, 18] as const;
const RCA_NODE_FONT_SIZE_MIN = RCA_NODE_FONT_SIZE_OPTIONS[0];
const RCA_NODE_FONT_SIZE_MAX = RCA_NODE_FONT_SIZE_OPTIONS[RCA_NODE_FONT_SIZE_OPTIONS.length - 1];
const RCA_DEFAULT_NODE_FONT_FAMILY = 'Inter';
const RCA_FIVE_WHY_LEADING_CONNECTIVE_PATTERNS = [
  /^(?:because of|because|since|as a result of|as|so that|so|therefore|thus|hence|then|and|but|however|although|though|while|whereas|also|additionally|moreover|furthermore|consequently|accordingly|instead)\b[\s,;:.-]*/i,
  /^(?:due to|owing to|caused by|resulting from|resulted from|related to|linked to)\b[\s,;:.-]*/i,
  /^(?:it|this|that|there)\s+(?:is|are|was|were|has|have|had|does|do|did|can|could|may|might|must|should|would)(?:\s+not)?(?:\s+been)?\b[\s,;:.-]*/i,
  /^(?:it|this|that)\s+(?:happened|occurred|resulted)\s*(?:because|when|after|as|from|due to)?\b[\s,;:.-]*/i,
  /^(?:we|they|the team|team|operator|maintenance|qa|production|supervisor)\s+(?:found|observed|confirmed|determined|saw|noticed|reported|identified|verified)\s+(?:that\s+)?/i,
  /^(?:the|a|an)\s+(?:reason|cause|issue|problem|failure|finding)\s+(?:is|are|was|were|has been|had been)\b[\s,;:.-]*/i,
  /^(?:it|this|that)\b[\s,;:.-]*/i,
  /^(?:that|which)\s+/i
] as const;
const RCA_NODE_FONT_FAMILY_OPTIONS: Array<{ css: string; label: string; value: string }> = [
  { css: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', label: 'Inter', value: 'Inter' },
  { css: 'Calibri, "Segoe UI", sans-serif', label: 'Calibri', value: 'Calibri' },
  { css: 'Arial, Helvetica, sans-serif', label: 'Arial', value: 'Arial' },
  { css: 'Georgia, serif', label: 'Georgia', value: 'Georgia' },
  { css: '"Times New Roman", Times, serif', label: 'Times', value: 'Times New Roman' },
  { css: 'Verdana, Geneva, sans-serif', label: 'Verdana', value: 'Verdana' },
  { css: '"Courier New", Courier, monospace', label: 'Courier', value: 'Courier New' }
];
const RCA_DEFAULT_CATEGORY_VISUAL_STYLE: RcaResolvedNodeVisualStyle = {
  backgroundColor: '#ecfeff',
  borderColor: '#a5f3fc',
  fontFamily: RCA_DEFAULT_NODE_FONT_FAMILY,
  fontSize: 16,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  textColor: '#083344'
};
const RCA_DEFAULT_CAUSE_VISUAL_STYLE: RcaResolvedNodeVisualStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  fontFamily: RCA_DEFAULT_NODE_FONT_FAMILY,
  fontSize: 13,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  textColor: '#0f172a'
};
const RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE: RcaResolvedNodeVisualStyle = {
  backgroundColor: '#fef3c7',
  borderColor: '#f59e0b',
  fontFamily: RCA_DEFAULT_NODE_FONT_FAMILY,
  fontSize: 14,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  textColor: '#713f12'
};

const RCA_FISHBONE_CATEGORY_LAYOUTS: Array<{
  id: string;
  lane: 'top' | 'bottom';
  x: number;
  y: number;
}> = [
  { id: 'cat-people', lane: 'top', x: RCA_FISHBONE_FIRST_COLUMN_X, y: RCA_FISHBONE_TOP_CATEGORY_Y },
  { id: 'cat-machine', lane: 'bottom', x: RCA_FISHBONE_FIRST_COLUMN_X, y: RCA_FISHBONE_BOTTOM_CATEGORY_Y },
  { id: 'cat-method', lane: 'top', x: RCA_FISHBONE_FIRST_COLUMN_X + RCA_FISHBONE_COLUMN_STEP, y: RCA_FISHBONE_TOP_CATEGORY_Y },
  { id: 'cat-material', lane: 'bottom', x: RCA_FISHBONE_FIRST_COLUMN_X + RCA_FISHBONE_COLUMN_STEP, y: RCA_FISHBONE_BOTTOM_CATEGORY_Y },
  { id: 'cat-measurement', lane: 'top', x: RCA_FISHBONE_FIRST_COLUMN_X + RCA_FISHBONE_COLUMN_STEP * 2, y: RCA_FISHBONE_TOP_CATEGORY_Y },
  { id: 'cat-environment', lane: 'bottom', x: RCA_FISHBONE_FIRST_COLUMN_X + RCA_FISHBONE_COLUMN_STEP * 2, y: RCA_FISHBONE_BOTTOM_CATEGORY_Y },
  { id: 'cat-management-system', lane: 'top', x: RCA_FISHBONE_FIRST_COLUMN_X + RCA_FISHBONE_COLUMN_STEP * 3, y: RCA_FISHBONE_TOP_CATEGORY_Y }
];

const RCA_DEFAULT_FISHBONE_CATEGORIES = [
  { label: 'People' },
  { label: 'Machine' },
  { label: 'Method' },
  { label: 'Material' },
  { label: 'Measurement' },
  { label: 'Environment' },
  { label: 'Management System' }
] as const;

const RCA_FIVE_WHYS_SCAFFOLD_LAYOUT: Array<{ x: number; y: number }> = [
  { x: 120, y: 120 },
  { x: 520, y: 120 },
  { x: 920, y: 120 }
];

const RCA_FIVE_WHYS_SCAFFOLD: Array<{
  label: string;
  role: RcaFiveWhysNodeRole;
  visualStyle: RcaNodeVisualStyle;
}> = [
  {
    label: 'Incident / Problem Statement',
    role: 'PROBLEM',
    visualStyle: {
      backgroundColor: '#eef6ff',
      borderColor: '#38bdf8',
      fontSize: 15,
      isBold: true,
      textColor: '#0f172a'
    }
  },
  {
    label: '',
    role: 'FIVE_WHYS',
    visualStyle: {
      backgroundColor: '#f8fafc',
      borderColor: '#64748b',
      fontSize: 14,
      textColor: '#0f172a'
    }
  },
  {
    label: '',
    role: 'CAPA',
    visualStyle: {
      backgroundColor: '#ecfdf5',
      borderColor: '#10b981',
      fontSize: 14,
      isBold: true,
      textColor: '#064e3b'
    }
  }
];

const methodologyOptions: Array<{
  icon: typeof ListChecks;
  label: string;
  shortcut: string;
  value: RcaMethodology;
}> = [
  { icon: Workflow, label: 'Main View', shortcut: 'M', value: 'ISHIKAWA' }
];

type RcaCanvasShortcut = {
  action: string;
  description: string;
  group: 'Canvas' | 'Methodology' | 'History';
  key: string;
};

const RCA_CANVAS_SHORTCUTS: RcaCanvasShortcut[] = [
  { action: 'Select nodes', description: 'Use selection mode on the canvas.', group: 'Canvas', key: 'V' },
  { action: 'Pan canvas', description: 'Use hand mode to move around the canvas.', group: 'Canvas', key: 'H' },
  { action: 'Add node', description: 'Create a node in the center of the current view.', group: 'Canvas', key: 'N' },
  { action: 'Rearrange canvas', description: 'Rebuild the methodology layout for the active RCA.', group: 'Canvas', key: 'R' },
  { action: 'Refresh canvas', description: 'Reload the active RCA canvas room.', group: 'Canvas', key: 'Shift+R' },
  { action: 'Toggle grid', description: 'Show or hide the canvas grid.', group: 'Canvas', key: 'G' },
  { action: 'Toggle grid snap', description: 'Turn snap-to-grid on or off.', group: 'Canvas', key: 'S' },
  { action: 'Edit Node', description: 'Open the selected node formatting toolbar.', group: 'Canvas', key: 'E' },
  { action: 'Node Details', description: 'Open the details panel for the selected node.', group: 'Canvas', key: 'D' },
  { action: 'Show shortcuts', description: 'Open this shortcut reference.', group: 'Canvas', key: '?' },
  { action: 'Main View', description: 'Focus the main RCA canvas view.', group: 'Methodology', key: 'M' },
  { action: 'Undo canvas change', description: 'Undo the latest canvas operation.', group: 'History', key: '⌘/Ctrl+Z' },
  { action: 'Redo canvas change', description: 'Redo the latest undone canvas operation.', group: 'History', key: '⌘/Ctrl+Shift+Z' }
];

const RCA_CANVAS_SHORTCUT_GROUPS: RcaCanvasShortcut['group'][] = ['Canvas', 'Methodology', 'History'];

const RCA_CANVAS_THEME_OPTIONS: Array<{
  icon: LucideIcon;
  label: string;
  value: RcaCanvasTheme;
}> = [
  { icon: Moon, label: 'Dark', value: 'dark' },
  { icon: Sun, label: 'Light', value: 'light' },
  { icon: Palette, label: 'Gray', value: 'gray' }
];

const RCA_CANVAS_THEME_STYLES: Record<RcaCanvasTheme, {
  backgroundColor: string;
  gridColor: string;
  sectionClassName: string;
}> = {
  dark: {
    backgroundColor: '#3b3e63',
    gridColor: '#b9c0ff',
    sectionClassName: 'text-slate-50'
  },
  gray: {
    backgroundColor: '#737375',
    gridColor: '#e0e0e6',
    sectionClassName: 'text-slate-950'
  },
  light: {
    backgroundColor: '#d2d2d6',
    gridColor: '#6d6d76',
    sectionClassName: 'text-slate-950'
  }
};

const nodeTypeOptions: Array<{ label: string; value: RcaNodeType }> = [
  { label: 'Why', value: 'WHY' },
  { label: 'Fishbone Category', value: 'ISHIKAWA_CATEGORY' },
  { label: 'Cause', value: 'CAUSE' },
  { label: 'Sub Cause', value: 'SUB_CAUSE' },
  { label: 'Fault Gate', value: 'FAULT_GATE' },
  { label: 'Sticky Note', value: 'STICKY_NOTE' }
];

const RCA_FIVE_WHYS_NODE_ROLE_OPTIONS: Array<{ label: string; value: RcaFiveWhysNodeRole }> = [
  { label: 'Incident', value: 'INCIDENT' },
  { label: 'Incident Details', value: 'INCIDENT_DETAILS' },
  { label: 'Containment', value: 'CONTAINMENT' },
  { label: 'Evidence', value: 'EVIDENCE' },
  { label: 'Problem', value: 'PROBLEM' },
  { label: 'Why', value: 'FIVE_WHYS' },
  { label: 'Answer', value: 'ANSWER' },
  { label: 'Root Cause', value: 'ROOT_CAUSE' },
  { label: 'CAPA', value: 'CAPA' },
  { label: 'Corrective Action', value: 'CORRECTIVE_ACTION' },
  { label: 'Preventive Action', value: 'PREVENTIVE_ACTION' },
  { label: 'Risk Assessment', value: 'RISK_ASSESSMENT' },
  { label: 'Effectiveness', value: 'EFFECTIVENESS' },
  { label: 'Lessons Learned', value: 'LESSONS_LEARNED' },
  { label: 'Approval & Closure', value: 'APPROVAL_CLOSURE' }
];

const RCA_FISHBONE_CATEGORY_LABELS = [
  'People',
  'Machine',
  'Method',
  'Material',
  'Measurement',
  'Environment',
  'Management System'
] as const;

const RCA_ADD_NODE_ROLE_OPTIONS: Array<{ icon: LucideIcon; label: string; value: RcaFiveWhysNodeRole }> = [
  { icon: ClipboardList, label: 'Incident Details', value: 'INCIDENT_DETAILS' },
  { icon: ShieldCheck, label: 'Containment', value: 'CONTAINMENT' },
  { icon: FileLock2, label: 'Evidence', value: 'EVIDENCE' },
  { icon: AlertTriangle, label: 'Problem', value: 'PROBLEM' },
  { icon: ListChecks, label: 'Why', value: 'FIVE_WHYS' },
  { icon: ClipboardCopy, label: 'Answer', value: 'ANSWER' },
  { icon: Gauge, label: 'Root Cause', value: 'ROOT_CAUSE' },
  { icon: PackageCheck, label: 'CAPA', value: 'CAPA' }
];

const RCA_CAPA_NODE_ROLE_OPTIONS: Array<{ icon: LucideIcon; label: string; value: RcaFiveWhysNodeRole }> = [
  { icon: Wrench, label: 'Corrective', value: 'CORRECTIVE_ACTION' },
  { icon: ShieldCheck, label: 'Preventive', value: 'PREVENTIVE_ACTION' },
  { icon: Gauge, label: 'Risk Assessment', value: 'RISK_ASSESSMENT' },
  { icon: BadgeCheck, label: 'Effectiveness', value: 'EFFECTIVENESS' },
  { icon: ClipboardList, label: 'Lessons Learned', value: 'LESSONS_LEARNED' },
  { icon: CheckCircle2, label: 'Approval & Closure', value: 'APPROVAL_CLOSURE' }
];

type RcaNodeDetailFieldType = 'date' | 'datetime-local' | 'number' | 'select' | 'text' | 'textarea' | 'time' | 'url';
type RcaNodeDetailFieldDefinition = {
  key: string;
  label: string;
  options?: string[];
  readOnly?: boolean;
  type: RcaNodeDetailFieldType;
};

const RCA_NODE_DETAIL_SCHEMA: Partial<Record<RcaFiveWhysNodeRole, RcaNodeDetailFieldDefinition[]>> = {
  INCIDENT: [
    { key: 'incidentId', label: 'Incident ID', readOnly: true, type: 'text' },
    { key: 'incidentTitle', label: 'Incident Title', type: 'text' },
    { key: 'incidentCategory', label: 'Incident Category', type: 'select', options: ['Safety', 'Food Safety', 'Quality', 'Equipment', 'Production', 'Warehouse', 'Environmental', 'Customer Complaint', 'Regulatory / Audit', 'Other'] },
    { key: 'department', label: 'Department', type: 'select', options: ['Production', 'Maintenance', 'Quality', 'Safety', 'Warehouse', 'Sanitation', 'Engineering', 'Shipping / Receiving', 'Other'] },
    { key: 'areaLocation', label: 'Area / Location', type: 'text' },
    { key: 'lineMachineProcess', label: 'Line / Machine / Process', type: 'text' },
    { key: 'shift', label: 'Shift', type: 'select', options: ['1st Shift', '2nd Shift', '3rd Shift', 'Weekend', 'Other'] },
    { key: 'dateOfIncident', label: 'Date of Incident', type: 'date' },
    { key: 'timeOfIncident', label: 'Time of Incident', type: 'time' },
    { key: 'reportedBy', label: 'Reported By', type: 'text' },
    { key: 'supervisorOnDuty', label: 'Supervisor on Duty', type: 'text' },
    { key: 'severityLevel', label: 'Severity Level', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'incidentDescription', label: 'Incident Description', type: 'textarea' },
    { key: 'immediateImpact', label: 'Immediate Impact', type: 'textarea' },
    { key: 'productAffected', label: 'Product Affected?', type: 'select', options: ['Yes', 'No', 'Unknown'] },
    { key: 'productNameCode', label: 'Product Name / Code', type: 'text' },
    { key: 'lotNumber', label: 'Lot Number', type: 'text' },
    { key: 'quantityAffected', label: 'Quantity Affected', type: 'text' },
    { key: 'incidentStatus', label: 'Incident Status', type: 'select', options: ['Draft', 'Open', 'Containment', 'Investigation', 'RCA Review', 'CAPA Open', 'Verification', 'Pending Approval', 'Closed', 'Reopened'] }
  ],
  INCIDENT_DETAILS: [
    { key: 'whatHappened', label: 'What Happened?', type: 'textarea' },
    { key: 'whereDidItHappen', label: 'Where Did It Happen?', type: 'text' },
    { key: 'whenDidItHappen', label: 'When Did It Happen?', type: 'datetime-local' },
    { key: 'whoWasInvolved', label: 'Who Was Involved?', type: 'text' },
    { key: 'whoDiscoveredIt', label: 'Who Discovered It?', type: 'text' },
    { key: 'wasAnyoneInjured', label: 'Was Anyone Injured?', type: 'select', options: ['Yes', 'No', 'Unknown'] },
    { key: 'wasProductAffected', label: 'Was Product Affected?', type: 'select', options: ['Yes', 'No', 'Unknown'] },
    { key: 'wasEquipmentAffected', label: 'Was Equipment Affected?', type: 'select', options: ['Yes', 'No', 'Unknown'] },
    { key: 'wasProductionInterrupted', label: 'Was Production Interrupted?', type: 'select', options: ['Yes', 'No'] },
    { key: 'downtimeDuration', label: 'Downtime Duration', type: 'text' },
    { key: 'initialBusinessImpact', label: 'Initial Business Impact', type: 'select', options: ['Safety Risk', 'Food Safety Risk', 'Quality Defect', 'Equipment Downtime', 'Product Loss', 'Customer Impact', 'Regulatory Risk', 'Other'] },
    { key: 'detailedDescription', label: 'Detailed Description', type: 'textarea' }
  ],
  CONTAINMENT: [
    { key: 'containmentTitle', label: 'Containment Title', type: 'text' },
    { key: 'issueStillActive', label: 'Is the Issue Still Active?', type: 'select', options: ['Yes', 'No', 'Unknown'] },
    { key: 'containmentType', label: 'Containment Type', type: 'select', options: ['Stop Production', 'Isolate Equipment', 'Lockout / Tagout', 'Product Hold', 'Quarantine Material', 'Clean Area', 'Block Area', 'Notify Department', 'Temporary Repair', 'Other'] },
    { key: 'productionStopped', label: 'Was Production Stopped?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'timeProductionStopped', label: 'Time Production Stopped', type: 'time' },
    { key: 'equipmentIsolated', label: 'Was Equipment Isolated?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'lockoutTagoutRequired', label: 'Lockout/Tagout Required?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'productOnHold', label: 'Was Product Placed on Hold?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'holdTagNumber', label: 'Hold Tag Number', type: 'text' },
    { key: 'quantityOnHold', label: 'Quantity on Hold', type: 'text' },
    { key: 'qaNotified', label: 'Was QA Notified?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'safetyNotified', label: 'Was Safety Notified?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'maintenanceNotified', label: 'Was Maintenance Notified?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'warehouseNotified', label: 'Was Warehouse Notified?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'temporaryFixApplied', label: 'Temporary Fix Applied?', type: 'select', options: ['Yes', 'No'] },
    { key: 'temporaryFixDescription', label: 'Temporary Fix Description', type: 'textarea' },
    { key: 'containmentOwner', label: 'Containment Owner', type: 'text' },
    { key: 'containmentStatus', label: 'Containment Status', type: 'select', options: ['Open', 'In Progress', 'Completed', 'Escalated'] },
    { key: 'containmentCompletionTime', label: 'Containment Completion Time', type: 'datetime-local' }
  ],
  EVIDENCE: [
    { key: 'evidenceTitle', label: 'Evidence Title', type: 'text' },
    { key: 'evidenceType', label: 'Evidence Type', type: 'select', options: ['Photo', 'Video', 'Interview', 'Maintenance Record', 'PM Record', 'Cleaning Record', 'Production Record', 'Quality Record', 'Warehouse Scan Record', 'Machine Data', 'Sensor Data', 'SOP / Work Instruction', 'Training Record', 'Audit Record', 'Product Hold Record', 'Other'] },
    { key: 'evidenceCategory', label: 'Evidence Category', type: 'select', options: ['People', 'Machine', 'Method', 'Material', 'Environment', 'Measurement', 'Management'] },
    { key: 'evidenceDescription', label: 'Evidence Description', type: 'textarea' },
    { key: 'collectedBy', label: 'Collected By', type: 'text' },
    { key: 'dateCollected', label: 'Date Collected', type: 'date' },
    { key: 'timeCollected', label: 'Time Collected', type: 'time' },
    { key: 'sourceOfEvidence', label: 'Source of Evidence', type: 'text' },
    { key: 'evidenceVerified', label: 'Evidence Verified?', type: 'select', options: ['Yes', 'No', 'Pending Review'] },
    { key: 'verifiedBy', label: 'Verified By', type: 'text' },
    { key: 'verificationNotes', label: 'Verification Notes', type: 'textarea' },
    { key: 'evidenceRelevance', label: 'Evidence Relevance', type: 'select', options: ['Supports Cause', 'Disproves Cause', 'Background Information', 'Needs Review'] }
  ],
  PROBLEM: [
    { key: 'problemStatement', label: 'Problem Statement', type: 'textarea' },
    { key: 'problemType', label: 'Problem Type', type: 'select', options: ['Safety', 'Food Safety', 'Quality', 'Equipment', 'Process', 'Warehouse', 'Environmental', 'Other'] },
    { key: 'problemLocation', label: 'Problem Location', type: 'text' },
    { key: 'problemStartTime', label: 'Problem Start Time', type: 'datetime-local' },
    { key: 'problemDetectedBy', label: 'Problem Detected By', type: 'text' },
    { key: 'problemImpact', label: 'Problem Impact', type: 'textarea' },
    { key: 'knownFacts', label: 'Known Facts', type: 'textarea' },
    { key: 'unknownInformation', label: 'Unknown Information', type: 'textarea' },
    { key: 'problemStatus', label: 'Problem Status', type: 'select', options: ['Open', 'Under Investigation', 'Linked to Cause', 'Resolved', 'Eliminated'] }
  ],
  FIVE_WHYS: [
    { key: 'selectedCause', label: 'Selected Cause', type: 'text' },
    { key: 'whyIsThisCauseLikely', label: 'Why Is This Cause Likely?', type: 'textarea' },
    { key: 'priorityLevel', label: 'Priority Level', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'reasonForDecision', label: 'Reason for Decision', type: 'textarea' }
  ],
  ANSWER: [
    { key: 'answerStatement', label: 'Answer Statement', type: 'textarea' },
    { key: 'evidenceStrength', label: 'Evidence Strength', type: 'select', options: ['Weak', 'Medium', 'Strong'] },
    { key: 'isAnswerVerified', label: 'Is This Answer Verified?', type: 'select', options: ['Yes', 'No', 'Pending'] },
    { key: 'verifiedBy', label: 'Verified By', type: 'text' },
    { key: 'answerType', label: 'Answer Type', type: 'select', options: ['Direct Cause', 'Contributing Cause', 'Assumption', 'Verified Fact', 'Eliminated Cause'] },
    { key: 'answerNotes', label: 'Answer Notes', type: 'textarea' }
  ],
  ROOT_CAUSE: [
    { key: 'rootCauseStatement', label: 'Root Cause Statement', type: 'textarea' },
    { key: 'rootCauseType', label: 'Root Cause Type', type: 'select', options: [...RCA_FISHBONE_CATEGORY_LABELS] },
    { key: 'rootCauseDescription', label: 'Root Cause Description', type: 'textarea' },
    { key: 'wouldFixingPreventRecurrence', label: 'Would Fixing This Prevent Recurrence?', type: 'select', options: ['Yes', 'No', 'Partially', 'Unknown'] },
    { key: 'isSystemFailure', label: 'Is This a System Failure?', type: 'select', options: ['Yes', 'No', 'Partially'] },
    { key: 'isBlamingIndividual', label: 'Is This Blaming an Individual?', type: 'select', options: ['Yes', 'No'] },
    { key: 'otherCausesRuledOut', label: 'Other Causes Ruled Out?', type: 'select', options: ['Yes', 'No', 'In Progress'] },
    { key: 'ruledOutCauseList', label: 'Ruled Out Cause List', type: 'textarea' },
    { key: 'validationStatus', label: 'Validation Status', type: 'select', options: ['Proposed', 'Approved', 'Rejected', 'Needs More Investigation'] },
    { key: 'validatedBy', label: 'Validated By', type: 'text' },
    { key: 'validationDate', label: 'Validation Date', type: 'date' },
    { key: 'validationComments', label: 'Validation Comments', type: 'textarea' }
  ],
  CAPA: [
    { key: 'capaId', label: 'CAPA ID', readOnly: true, type: 'text' },
    { key: 'capaSummary', label: 'CAPA Summary', type: 'textarea' },
    { key: 'capaOwner', label: 'CAPA Owner', type: 'text' },
    { key: 'capaStatus', label: 'CAPA Status', type: 'select', options: ['Draft', 'Open', 'In Progress', 'Pending Verification', 'Completed', 'Overdue', 'Closed'] },
    { key: 'capaDueDate', label: 'CAPA Due Date', type: 'date' },
    { key: 'capaPriority', label: 'CAPA Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] }
  ],
  CORRECTIVE_ACTION: [
    { key: 'correctiveActionTitle', label: 'Corrective Action Title', type: 'text' },
    { key: 'actionDescription', label: 'Action Description', type: 'textarea' },
    { key: 'actionOwner', label: 'Action Owner', type: 'text' },
    { key: 'departmentResponsible', label: 'Department Responsible', type: 'select', options: ['Production', 'Maintenance', 'Quality', 'Safety', 'Warehouse', 'Sanitation', 'Engineering', 'Other'] },
    { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
    { key: 'requiredResources', label: 'Required Resources', type: 'textarea' },
    { key: 'estimatedCost', label: 'Estimated Cost', type: 'number' },
    { key: 'approvalRequired', label: 'Approval Required?', type: 'select', options: ['Yes', 'No'] },
    { key: 'approvedBy', label: 'Approved By', type: 'text' },
    { key: 'actionStatus', label: 'Action Status', type: 'select', options: ['Not Started', 'In Progress', 'Completed', 'Overdue', 'Cancelled'] },
    { key: 'completionDate', label: 'Completion Date', type: 'date' },
    { key: 'completionNotes', label: 'Completion Notes', type: 'textarea' }
  ],
  PREVENTIVE_ACTION: [
    { key: 'preventiveActionTitle', label: 'Preventive Action Title', type: 'text' },
    { key: 'preventiveActionScope', label: 'Preventive Action Scope', type: 'select', options: ['Same Line', 'Same Department', 'Entire Plant', 'Multiple Plants', 'Supplier', 'Warehouse Network', 'Enterprise-Wide'] },
    { key: 'actionDescription', label: 'Action Description', type: 'textarea' },
    { key: 'areaAffected', label: 'Area Affected', type: 'text' },
    { key: 'actionOwner', label: 'Action Owner', type: 'text' },
    { key: 'departmentResponsible', label: 'Department Responsible', type: 'select', options: ['Production', 'Maintenance', 'Quality', 'Safety', 'Warehouse', 'Sanitation', 'Engineering', 'Other'] },
    { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
    { key: 'trainingRequired', label: 'Training Required?', type: 'select', options: ['Yes', 'No'] },
    { key: 'sopUpdateRequired', label: 'SOP Update Required?', type: 'select', options: ['Yes', 'No'] },
    { key: 'pmUpdateRequired', label: 'PM Update Required?', type: 'select', options: ['Yes', 'No'] },
    { key: 'haccpUpdateRequired', label: 'HACCP / Food Safety Plan Update Required?', type: 'select', options: ['Yes', 'No', 'Not Applicable'] },
    { key: 'actionStatus', label: 'Action Status', type: 'select', options: ['Not Started', 'In Progress', 'Completed', 'Overdue', 'Cancelled'] }
  ],
  RISK_ASSESSMENT: [
    { key: 'riskAssessmentId', label: 'Risk Assessment ID', readOnly: true, type: 'text' },
    { key: 'assessmentType', label: 'Assessment Type', type: 'select', options: ['Before CAPA', 'After CAPA', 'Residual Risk Review'] },
    { key: 'severityScore', label: 'Severity Score', type: 'select', options: ['1 Low', '2 Minor', '3 Moderate', '4 High', '5 Critical'] },
    { key: 'occurrenceScore', label: 'Occurrence Score', type: 'select', options: ['1 Rare', '2 Unlikely', '3 Possible', '4 Likely', '5 Frequent'] },
    { key: 'detectionScore', label: 'Detection Score', type: 'select', options: ['1 Easily Detected', '2 Likely Detected', '3 Moderate Detection', '4 Difficult to Detect', '5 Not Detectable'] },
    { key: 'riskJustification', label: 'Risk Justification', type: 'textarea' },
    { key: 'residualRiskAcceptable', label: 'Residual Risk Acceptable?', type: 'select', options: ['Yes', 'No', 'Requires Management Approval'] },
    { key: 'riskApprovedBy', label: 'Risk Approved By', type: 'text' },
    { key: 'riskApprovalComments', label: 'Risk Approval Comments', type: 'textarea' }
  ],
  EFFECTIVENESS: [
    { key: 'verificationId', label: 'Verification ID', readOnly: true, type: 'text' },
    { key: 'verificationMethod', label: 'Verification Method', type: 'select', options: ['Audit', 'Inspection', 'Trend Review', 'Observation', 'Test Run', 'No Repeat Incident', 'KPI Review', 'Product Review', 'PM Audit', 'Warehouse Audit'] },
    { key: 'verificationOwner', label: 'Verification Owner', type: 'text' },
    { key: 'verificationDueDate', label: 'Verification Due Date', type: 'date' },
    { key: 'verificationInterval', label: 'Verification Interval', type: 'select', options: ['30 Days', '60 Days', '90 Days', '180 Days', 'Custom'] },
    { key: 'successCriteria', label: 'Success Criteria', type: 'textarea' },
    { key: 'verificationResult', label: 'Verification Result', type: 'select', options: ['Pass', 'Fail', 'Needs More Time'] },
    { key: 'verificationNotes', label: 'Verification Notes', type: 'textarea' },
    { key: 'reopenRcaIfFailed', label: 'If Failed, Reopen RCA?', type: 'select', options: ['Yes', 'No'] },
    { key: 'reopenedReason', label: 'Reopened Reason', type: 'textarea' }
  ],
  LESSONS_LEARNED: [
    { key: 'lessonLearnedSummary', label: 'Lesson Learned Summary', type: 'textarea' },
    { key: 'whatWentWrong', label: 'What Went Wrong?', type: 'textarea' },
    { key: 'whatWorkedWell', label: 'What Worked Well?', type: 'textarea' },
    { key: 'whatShouldChange', label: 'What Should Change?', type: 'textarea' },
    { key: 'canHappenElsewhere', label: 'Can This Happen Elsewhere?', type: 'select', options: ['Yes', 'No', 'Unknown'] },
    { key: 'otherAreasAffected', label: 'Other Lines / Areas Affected', type: 'text' },
    { key: 'sopUpdateNeeded', label: 'SOP Update Needed?', type: 'select', options: ['Yes', 'No'] },
    { key: 'pmUpdateNeeded', label: 'PM Update Needed?', type: 'select', options: ['Yes', 'No'] },
    { key: 'trainingUpdateNeeded', label: 'Training Update Needed?', type: 'select', options: ['Yes', 'No'] },
    { key: 'shareWithOtherDepartments', label: 'Share With Other Departments?', type: 'select', options: ['Yes', 'No'] },
    { key: 'knowledgeBaseArticleRequired', label: 'Knowledge Base Article Required?', type: 'select', options: ['Yes', 'No'] },
    { key: 'lessonOwner', label: 'Lesson Owner', type: 'text' },
    { key: 'lessonApprovalStatus', label: 'Lesson Approval Status', type: 'select', options: ['Draft', 'Pending Review', 'Approved', 'Rejected'] }
  ],
  APPROVAL_CLOSURE: [
    { key: 'closureReviewId', label: 'Closure Review ID', readOnly: true, type: 'text' },
    { key: 'investigationSummary', label: 'Investigation Summary', type: 'textarea' },
    { key: 'finalCapaSummary', label: 'Final CAPA Summary', type: 'textarea' },
    { key: 'finalRiskLevel', label: 'Final Risk Level', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'effectivenessVerified', label: 'Effectiveness Verified?', type: 'select', options: ['Yes', 'No'] },
    { key: 'allActionsCompleted', label: 'All Actions Completed?', type: 'select', options: ['Yes', 'No'] },
    { key: 'allEvidenceAttached', label: 'All Evidence Attached?', type: 'select', options: ['Yes', 'No'] },
    { key: 'lessonsLearnedCompleted', label: 'Lessons Learned Completed?', type: 'select', options: ['Yes', 'No'] },
    { key: 'closureRecommendation', label: 'Closure Recommendation', type: 'select', options: ['Close', 'Keep Open', 'Reopen Investigation'] },
    { key: 'finalApprover', label: 'Final Approver', type: 'text' },
    { key: 'closureDate', label: 'Closure Date', type: 'date' },
    { key: 'closureComments', label: 'Closure Comments', type: 'textarea' }
  ]
};

const RCA_NODE_PRIMARY_LABEL_FIELD_KEYS: Partial<Record<RcaFiveWhysNodeRole, string>> = {
  ANSWER: 'answerStatement',
  APPROVAL_CLOSURE: 'investigationSummary',
  CAPA: 'capaSummary',
  CONTAINMENT: 'containmentTitle',
  CORRECTIVE_ACTION: 'correctiveActionTitle',
  EFFECTIVENESS: 'successCriteria',
  EVIDENCE: 'evidenceTitle',
  FIVE_WHYS: 'selectedCause',
  INCIDENT: 'incidentTitle',
  INCIDENT_DETAILS: 'whatHappened',
  LESSONS_LEARNED: 'lessonLearnedSummary',
  PREVENTIVE_ACTION: 'preventiveActionTitle',
  PROBLEM: 'problemStatement',
  RISK_ASSESSMENT: 'riskJustification',
  ROOT_CAUSE: 'rootCauseStatement'
};

const RCA_EVIDENCE_FILE_ACCEPT = [
  'image/*',
  'image/heic',
  'image/heif',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/*',
  '.3gp',
  '.aac',
  '.apng',
  '.avif',
  '.csv',
  '.doc',
  '.docx',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.json',
  '.log',
  '.m4a',
  '.mov',
  '.mp3',
  '.mp4',
  '.odp',
  '.ods',
  '.odt',
  '.pdf',
  '.png',
  '.ppt',
  '.pptx',
  '.rtf',
  '.svg',
  '.tif',
  '.tiff',
  '.txt',
  '.wav',
  '.webm',
  '.webp',
  '.xls',
  '.xlsx',
  '.xml',
  '.zip'
].join(',');

function getRcaPrimaryLabelFieldKey(role: RcaFiveWhysNodeRole | null | undefined): string | null {
  return role ? RCA_NODE_PRIMARY_LABEL_FIELD_KEYS[role] || null : null;
}

const RCA_FIVE_WHYS_ROLE_VISUAL_STYLE: Record<RcaFiveWhysNodeRole, RcaNodeVisualStyle> = {
  ANSWER: {
    backgroundColor: '#ffffff',
    borderColor: '#93c5fd',
    fontSize: 14,
    textColor: '#0f172a'
  },
  APPROVAL_CLOSURE: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
    fontSize: 14,
    isBold: true,
    textColor: '#14532d'
  },
  CAPA: {
    backgroundColor: '#ecfdf5',
    borderColor: '#34d399',
    fontSize: 14,
    isBold: true,
    textColor: '#064e3b'
  },
  CONTAINMENT: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
    fontSize: 14,
    isBold: true,
    textColor: '#78350f'
  },
  CORRECTIVE_ACTION: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c',
    fontSize: 14,
    isBold: true,
    textColor: '#7c2d12'
  },
  EFFECTIVENESS: {
    backgroundColor: '#ecfeff',
    borderColor: '#06b6d4',
    fontSize: 14,
    isBold: true,
    textColor: '#155e75'
  },
  EVIDENCE: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0ea5e9',
    fontSize: 14,
    textColor: '#0c4a6e'
  },
  FIVE_WHYS: {
    backgroundColor: '#f8fafc',
    borderColor: '#64748b',
    fontSize: 14,
    textColor: '#0f172a'
  },
  INCIDENT_DETAILS: {
    backgroundColor: '#f8fafc',
    borderColor: '#94a3b8',
    fontSize: 14,
    isBold: true,
    textColor: '#0f172a'
  },
  INCIDENT: {
    backgroundColor: '#eef6ff',
    borderColor: '#0284c7',
    fontSize: 15,
    isBold: true,
    textColor: '#082f49'
  },
  LESSONS_LEARNED: {
    backgroundColor: '#fefce8',
    borderColor: '#eab308',
    fontSize: 14,
    textColor: '#713f12'
  },
  PREVENTIVE_ACTION: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
    fontSize: 14,
    isBold: true,
    textColor: '#14532d'
  },
  PROBLEM: {
    backgroundColor: '#eef6ff',
    borderColor: '#38bdf8',
    fontSize: 15,
    isBold: true,
    textColor: '#0f172a'
  },
  RISK_ASSESSMENT: {
    backgroundColor: '#faf5ff',
    borderColor: '#a855f7',
    fontSize: 14,
    isBold: true,
    textColor: '#581c87'
  },
  ROOT_CAUSE: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    fontSize: 14,
    isBold: true,
    textColor: '#991b1b'
  }
};
interface ReferenceRcaEvidence {
  capturedAt: string;
  fileHash: string;
  fileName: string;
  kind: string;
  source: string;
  uploadedBy: string;
}

interface ReferenceRcaAction {
  action: string;
  dueDate: string;
  owner: string;
  status: 'VERIFIED' | 'SYNCED' | 'CLOSED';
  syncId: string;
  system: string;
}

interface ReferenceRcaNodeDetail {
  actions: ReferenceRcaAction[];
  branch: string;
  evidence: ReferenceRcaEvidence[];
  owner: string;
  verification: string;
  whyChain?: string[];
}

interface ReferenceRcaStep {
  description: string;
  focusNodeId: string;
  id: string;
  label: string;
  status: 'complete' | 'active';
}

interface ReferenceRcaProject {
  auditHash: string;
  incident: RcaIncident;
  nodeDetails: Record<string, ReferenceRcaNodeDetail>;
  problemStatement: string;
  sealedAt: string;
  session: RcaSession;
  signedBy: string;
  steps: ReferenceRcaStep[];
  timeline: Array<{
    at: string;
    event: string;
    owner: string;
  }>;
}

const REFERENCE_PROJECT_INCIDENT_ID = 'reference-fire-under-oven';
const REFERENCE_PROJECT_SESSION_ID = 'reference-fire-under-oven-session';
const REFERENCE_RCA_PROBLEM_STATEMENT = 'A fire was observed under the oven as a result of dust flour accumulation under the oven coming from the Die Cut production line.';

const REFERENCE_RCA_PROJECT: ReferenceRcaProject = {
  auditHash: 'SHA512-7f40e1c77bd8e46a933f0cbeef918ec2dbaea7a3159c2cc718f28a5f9f5e21a9a31e0a1c221c44c6af9dd5cc84e301a9a36f2c9e7a0b5b8ce8125e46f5b40e1',
  incident: {
    activeSessionId: REFERENCE_PROJECT_SESSION_ID,
    assetId: 'Die Cut production line - oven area',
    accessRole: 'OWNER',
    collaborators: [],
    createdAtIso: '2026-06-29T13:42:00.000Z',
    createdByUid: 'plant-manager-reference',
    departmentId: 'operations',
    departmentName: 'Operations',
    displayId: 'RCA-2026-REFIRE',
    id: REFERENCE_PROJECT_INCIDENT_ID,
    owner: null,
    riskFactors: {
      detection: 1,
      occurrence: 3,
      severity: 9
    },
    rpnScore: 27,
    sourceRailsDisplayId: null,
    sourceRailsItemId: null,
    status: 'CLOSED',
    tenantId: 'don-miguel-reference',
    title: 'Fire observed under oven from flour dust accumulation',
    updatedAtIso: '2026-06-29T22:18:00.000Z'
  },
  nodeDetails: {
    'machine-seal-gap': {
      actions: [
        {
          action: 'Replace lower oven pneumatic seal and add stainless shield to close flour ingress path.',
          dueDate: '2026-06-30',
          owner: 'Maintenance Manager',
          status: 'VERIFIED',
          syncId: 'SAP-WO-88912',
          system: 'SAP PM'
        },
        {
          action: 'Add thermal scan of oven underside to weekly predictive maintenance route.',
          dueDate: '2026-07-01',
          owner: 'Reliability Engineer',
          status: 'VERIFIED',
          syncId: 'SAP-PM-44201',
          system: 'SAP PM'
        }
      ],
      branch: 'Machine',
      evidence: [
        {
          capturedAt: '2026-06-29 08:58',
          fileHash: '4df8b61e9517bb3dc6af83e05ecf1a4c83a4a2be3a2e5306ec7654e5ec5f820d',
          fileName: 'oven-lower-seal-gap-photo.jpg',
          kind: 'Photo',
          source: 'Maintenance tablet',
          uploadedBy: 'Maintenance Manager'
        },
        {
          capturedAt: '2026-06-29 09:14',
          fileHash: 'de6ef9ad7cd22736b1f4d0876f3502a1828b1ae8a53a2fa634adbc3118f08f91',
          fileName: 'thermal-scan-oven-underside.png',
          kind: 'Thermal image',
          source: 'FLIR route capture',
          uploadedBy: 'Reliability Engineer'
        },
        {
          capturedAt: '2026-06-29 09:32',
          fileHash: 'a9e1ab61b9272e244cc42238e526523f2c41135c9fbfc2628641ed6f90fe5c8d',
          fileName: 'pm-history-lower-oven-seal.pdf',
          kind: 'Maintenance record',
          source: 'SAP PM export',
          uploadedBy: 'Maintenance Planner'
        }
      ],
      owner: 'Maintenance Manager',
      verification: 'Confirmed root cause. Seal gap created direct path for flour dust to collect against hot underside surfaces.',
      whyChain: [
        'Why was there fire under the oven? Flour dust accumulated near a hot underside surface.',
        'Why did flour dust reach the underside? A lower return-panel seal gap created an open path.',
        'Why was the gap present? The pneumatic seal was worn and not replaced during the last PM.',
        'Why did PM miss it? The route inspected door seals but not lower oven return seals.',
        'Why did the system allow recurrence? The asset strategy did not classify flour ingress under the oven as a combustible-dust risk.'
      ]
    },
    'method-pm-under-oven-missing': {
      actions: [
        {
          action: 'Revise sanitation LSW checklist to require under-oven cavity sweep with photo verification.',
          dueDate: '2026-06-30',
          owner: 'Sanitation Lead',
          status: 'VERIFIED',
          syncId: 'LSW-STD-2048',
          system: 'Synzapp LSW'
        },
        {
          action: 'Add combustible dust trigger to pre-op release gate for Die Cut line.',
          dueDate: '2026-07-02',
          owner: 'QA Manager',
          status: 'CLOSED',
          syncId: 'QMS-CR-7714',
          system: 'QMS'
        }
      ],
      branch: 'Method',
      evidence: [
        {
          capturedAt: '2026-06-29 10:05',
          fileHash: '013c9e03bf29b6ed148f7b9cbb820d173a603f23a9715270e9f0e26233452af7',
          fileName: 'daily-lsw-checklist-before-revision.pdf',
          kind: 'Checklist',
          source: 'Synzapp LSW export',
          uploadedBy: 'Production Supervisor'
        },
        {
          capturedAt: '2026-06-29 10:22',
          fileHash: '803174b621bca10ab6bb75cc5ace4f74733f9dfcebbf7f81d06c4f7eddd89755',
          fileName: 'revised-preop-release-gate.pdf',
          kind: 'Controlled document',
          source: 'QMS document control',
          uploadedBy: 'QA Manager'
        }
      ],
      owner: 'QA Manager',
      verification: 'Confirmed systemic cause. Standard work did not force inspection of the exact hidden accumulation zone.',
      whyChain: [
        'Why was buildup not removed? The standard sweep did not include under-oven access points.',
        'Why was the hidden area excluded? The LSW checklist was copied from a similar line without lower oven geometry.',
        'Why was the checklist not challenged? Prior near-miss reports were not linked to the standard work owner.',
        'Why was that acceptable? The review cadence focused on completion rate, not hazard coverage.',
        'Why is this a root cause? The missing control allowed the hazard to build undetected across shifts.'
      ]
    },
    'material-flour-escape': {
      actions: [
        {
          action: 'Install Die Cut flour applicator containment skirt and validate capture efficiency after changeover.',
          dueDate: '2026-07-01',
          owner: 'Process Engineer',
          status: 'SYNCED',
          syncId: 'ENG-MOC-1187',
          system: 'Engineering MOC'
        },
        {
          action: 'Set flour dust accumulation alert threshold for line release and sanitation escalation.',
          dueDate: '2026-07-03',
          owner: 'Safety Lead',
          status: 'VERIFIED',
          syncId: 'EHS-ACT-3910',
          system: 'EHS'
        }
      ],
      branch: 'Material',
      evidence: [
        {
          capturedAt: '2026-06-29 09:47',
          fileHash: '5e19ba0cc2c61aa7aa62b4c8707761f8b2c77b98d6f5336b88496564109e80cc',
          fileName: 'flour-dust-sample-chain-of-custody.pdf',
          kind: 'Lab chain of custody',
          source: 'QA lab',
          uploadedBy: 'QA Technician'
        },
        {
          capturedAt: '2026-06-29 10:11',
          fileHash: 'c5d191361eb28e32c2820fcb59f0c7fa2cbb5637a0b9c0e44ac6571c23b807e0',
          fileName: 'die-cut-applicator-dust-plume-video.mp4',
          kind: 'Video',
          source: 'Line observation',
          uploadedBy: 'Safety Lead'
        }
      ],
      owner: 'Process Engineer',
      verification: 'Contributing root cause. Flour applicator escape created the combustible fuel source that migrated to the oven underside.',
      whyChain: [
        'Why was combustible fuel present? Flour escaped from the applicator during Die Cut production.',
        'Why did it escape? The containment skirt did not seal after changeover.',
        'Why was the misalignment not detected? Capture efficiency was not validated after format changes.',
        'Why was there no validation? The changeover standard measured yield and speed but not dust control.',
        'Why does this matter? It created repeatable combustible dust loading near ignition sources.'
      ]
    },
    'environment-negative-airflow': {
      actions: [
        {
          action: 'Rebalance airflow around Die Cut discharge and oven intake to prevent under-oven draw path.',
          dueDate: '2026-07-02',
          owner: 'Facilities Engineer',
          status: 'SYNCED',
          syncId: 'MAX-WO-54018',
          system: 'Maximo'
        }
      ],
      branch: 'Environment',
      evidence: [
        {
          capturedAt: '2026-06-29 11:03',
          fileHash: 'bb31682080513d6b87cd7f3ec22517f547cbdbd61fe93e1a5f82bb9706270f87',
          fileName: 'smoke-pencil-airflow-test.mov',
          kind: 'Video',
          source: 'Facilities test',
          uploadedBy: 'Facilities Engineer'
        }
      ],
      owner: 'Facilities Engineer',
      verification: 'Verified contributing condition. Negative airflow moved flour dust from Die Cut discharge toward oven underside.'
    }
  },
  problemStatement: REFERENCE_RCA_PROBLEM_STATEMENT,
  sealedAt: '2026-06-29T22:18:00.000Z',
  session: {
    closedAtIso: '2026-06-29T22:18:00.000Z',
    createdAtIso: '2026-06-29T13:44:00.000Z',
    id: REFERENCE_PROJECT_SESSION_ID,
    incidentId: REFERENCE_PROJECT_INCIDENT_ID,
    leadInvestigatorId: 'plant-manager-reference',
    methodology: 'ISHIKAWA',
    status: 'CLOSED',
    updatedAtIso: '2026-06-29T22:18:00.000Z'
  },
  signedBy: 'Plant Manager / QA Manager / Maintenance Manager',
  steps: [
    {
      description: 'Alert opened the war room at RPN 27 with safety, maintenance, QA, and operations present.',
      focusNodeId: 'event-fire-under-oven',
      id: 'entry',
      label: 'War room opened',
      status: 'complete'
    },
    {
      description: 'Fishbone methodology selected because the event spans people, machine, method, material, measurement, and environment.',
      focusNodeId: 'cat-machine',
      id: 'fishbone',
      label: 'Fishbone built',
      status: 'complete'
    },
    {
      description: 'Evidence records were attached to the exact node they support.',
      focusNodeId: 'machine-seal-gap',
      id: 'evidence',
      label: 'Evidence attached',
      status: 'complete'
    },
    {
      description: 'Three verified root causes were marked and tied to 5 Whys logic.',
      focusNodeId: 'method-pm-under-oven-missing',
      id: 'rootcause',
      label: 'Root causes verified',
      status: 'complete'
    },
    {
      description: 'Corrective actions were synchronized to SAP PM, Maximo, QMS, EHS, and Synzapp LSW.',
      focusNodeId: 'material-flour-escape',
      id: 'capa',
      label: 'CAPA synchronized',
      status: 'complete'
    },
    {
      description: 'Pre-flight passed, e-signature captured, project sealed, and audit package made available.',
      focusNodeId: 'environment-negative-airflow',
      id: 'seal',
      label: 'Audit sealed',
      status: 'active'
    }
  ],
  timeline: [
    { at: '2026-06-29 08:42', event: 'Fire observed under oven. Line stopped and area isolated.', owner: 'Production Supervisor' },
    { at: '2026-06-29 08:49', event: 'RCA war room initialized from dashboard alert.', owner: 'Plant Manager' },
    { at: '2026-06-29 09:14', event: 'Thermal scan and photo evidence uploaded to machine seal node.', owner: 'Maintenance Manager' },
    { at: '2026-06-29 10:22', event: 'LSW and pre-op checklist gap verified by QA.', owner: 'QA Manager' },
    { at: '2026-06-29 11:03', event: 'Airflow test verified dust migration path.', owner: 'Facilities Engineer' },
    { at: '2026-06-29 13:36', event: 'CAPA actions synced to enterprise execution systems.', owner: 'Plant Manager' },
    { at: '2026-06-29 17:48', event: 'Pre-flight audit checklist passed.', owner: 'QA Manager' },
    { at: '2026-06-29 18:18', event: 'Electronic signature applied and RCA sealed.', owner: 'Plant Manager' }
  ]
};

function buildReferenceProjectNodes(): RcaNode[] {
  const createdAtIso = '2026-06-29T13:44:00.000Z';
  const updatedAtIso = '2026-06-29T22:18:00.000Z';
  const nodes: RcaNode[] = [];

  function addNode(input: {
    evidence?: ReferenceRcaEvidence[];
    id: string;
    isRootCause?: boolean;
    label: string;
    nodeType?: RcaNodeType;
    parentNodeId?: string | null;
    x: number;
    y: number;
  }) {
    nodes.push({
      attachedEvidence: (input.evidence || []).map((evidence) => ({
        fileHash: evidence.fileHash,
        fileName: evidence.fileName,
        fileUrl: `audit://${evidence.fileName}`,
        uploadedAtIso: evidence.capturedAt
      })),
      createdAtIso,
      id: input.id,
      isRootCause: Boolean(input.isRootCause),
      isSuspectedCause: Boolean(input.isRootCause || REFERENCE_RCA_PROJECT.nodeDetails[input.id]?.whyChain?.length),
      label: input.label,
      lockedAtIso: null,
      lockedBy: null,
      nodeType: input.nodeType || 'CAUSE',
      parentNodeId: input.parentNodeId || null,
      status: 'ACTIVE',
      uiCoordinates: {
        layoutMethodology: 'ISHIKAWA',
        x: input.x,
        y: input.y
      },
      updatedAtIso,
      whyChain: REFERENCE_RCA_PROJECT.nodeDetails[input.id]?.whyChain || []
    });
  }

  addNode({
    evidence: REFERENCE_RCA_PROJECT.nodeDetails['machine-seal-gap']?.evidence,
    id: 'event-fire-under-oven',
    label: 'Top event: fire observed under oven during Die Cut production run',
    nodeType: 'FAULT_GATE',
    x: 1450,
    y: 430
  });

  const categories = [
    { id: 'cat-people', label: 'People', x: 120, y: 250 },
    { id: 'cat-machine', label: 'Machine', x: 120, y: 625 },
    { id: 'cat-method', label: 'Method', x: 540, y: 250 },
    { id: 'cat-material', label: 'Material', x: 540, y: 625 },
    { id: 'cat-measurement', label: 'Measurement', x: 960, y: 250 },
    { id: 'cat-environment', label: 'Environment', x: 960, y: 625 }
  ];

  categories.forEach((category) => {
    addNode({
      id: category.id,
      label: category.label,
      nodeType: 'ISHIKAWA_CATEGORY',
      parentNodeId: 'event-fire-under-oven',
      x: category.x,
      y: category.y
    });
  });

  [
    {
      id: 'people-handoff-gap',
      label: 'Shift handoff did not escalate flour buildup beneath oven after first minor cleanup delay',
      parentNodeId: 'cat-people',
      x: 0,
      y: 20
    },
    {
      id: 'people-stop-authority-unclear',
      label: 'Operator was unsure whether dust accumulation alone justified stopping Die Cut line',
      parentNodeId: 'cat-people',
      x: 305,
      y: 20
    },
    {
      id: 'people-training-dust-risk',
      label: 'Combustible dust training covered silos and mixers, not hidden oven underside exposure',
      parentNodeId: 'cat-people',
      x: 0,
      y: 140
    },
    {
      id: 'people-supervisor-gemba-miss',
      label: 'Supervisor gemba walk focused on throughput recovery and missed under-oven visual confirmation',
      parentNodeId: 'cat-people',
      x: 305,
      y: 140
    },
    {
      id: 'machine-seal-gap',
      label: 'Lower oven return-panel pneumatic seal gap allowed flour dust to enter hot underside cavity',
      parentNodeId: 'cat-machine',
      isRootCause: true,
      evidence: REFERENCE_RCA_PROJECT.nodeDetails['machine-seal-gap']?.evidence,
      x: 0,
      y: 785
    },
    {
      id: 'machine-conveyor-friction',
      label: 'Conveyor tracking rub point generated localized heat near flour accumulation path',
      parentNodeId: 'cat-machine',
      x: 305,
      y: 785
    },
    {
      id: 'machine-vacuum-nozzle',
      label: 'Vacuum pickup nozzle was misaligned after changeover, reducing flour capture at source',
      parentNodeId: 'cat-machine',
      x: 0,
      y: 915
    },
    {
      id: 'machine-airknife-vector',
      label: 'Air knife vector pushed airborne flour toward oven lower return instead of capture hood',
      parentNodeId: 'cat-machine',
      x: 305,
      y: 915
    },
    {
      id: 'machine-guard-access',
      label: 'Guard geometry blocked direct cleaning access to the underside collection zone',
      parentNodeId: 'machine-seal-gap',
      x: 0,
      y: 1045
    },
    {
      id: 'machine-pm-wear-limit',
      label: 'Seal wear limit was not defined in PM criteria, so degraded seal remained in service',
      parentNodeId: 'machine-seal-gap',
      x: 305,
      y: 1045
    },
    {
      id: 'method-pm-under-oven-missing',
      label: 'PM and sanitation route did not include under-oven cavity inspection or photo verification',
      parentNodeId: 'cat-method',
      isRootCause: true,
      evidence: REFERENCE_RCA_PROJECT.nodeDetails['method-pm-under-oven-missing']?.evidence,
      x: 430,
      y: 20
    },
    {
      id: 'method-lsw-hazard-gap',
      label: 'Daily LSW checklist verified line start readiness but not combustible dust hazard coverage',
      parentNodeId: 'cat-method',
      x: 735,
      y: 20
    },
    {
      id: 'method-hot-surface-trigger',
      label: 'Hot-surface fire-watch trigger was tied to maintenance work, not production dust events',
      parentNodeId: 'cat-method',
      x: 430,
      y: 140
    },
    {
      id: 'method-moc-changeover',
      label: 'Changeover standard validated speed and yield but not flour containment after format change',
      parentNodeId: 'cat-method',
      x: 735,
      y: 140
    },
    {
      id: 'method-nearmiss-trending',
      label: 'Prior dust cleanup near misses were logged separately and not trended into RCA trigger rules',
      parentNodeId: 'method-lsw-hazard-gap',
      x: 735,
      y: 270
    },
    {
      id: 'material-flour-escape',
      label: 'Fine flour escaped the Die Cut applicator and supplied combustible dust to the oven area',
      parentNodeId: 'cat-material',
      isRootCause: true,
      evidence: REFERENCE_RCA_PROJECT.nodeDetails['material-flour-escape']?.evidence,
      x: 430,
      y: 785
    },
    {
      id: 'material-particle-size',
      label: 'Dust particle size and dryness supported airborne migration and rapid ignition risk',
      parentNodeId: 'cat-material',
      x: 735,
      y: 785
    },
    {
      id: 'material-rework-flour',
      label: 'Rework flour had inconsistent flow behavior and increased dusting during feed correction',
      parentNodeId: 'cat-material',
      x: 430,
      y: 915
    },
    {
      id: 'material-threshold-exceeded',
      label: 'Observed accumulation exceeded internal combustible dust response threshold',
      parentNodeId: 'material-flour-escape',
      x: 735,
      y: 915
    },
    {
      id: 'measurement-no-dp',
      label: 'No differential pressure trend existed for applicator enclosure capture performance',
      parentNodeId: 'cat-measurement',
      x: 860,
      y: 20
    },
    {
      id: 'measurement-thermal-route',
      label: 'Thermal scan route excluded oven underside until after this incident',
      parentNodeId: 'cat-measurement',
      x: 1165,
      y: 20
    },
    {
      id: 'measurement-dust-depth',
      label: 'Dust depth was recorded qualitatively, not as a measured release threshold',
      parentNodeId: 'cat-measurement',
      x: 860,
      y: 140
    },
    {
      id: 'measurement-qms-link',
      label: 'Sanitation deviations were not linked to QMS hazard escalation analytics',
      parentNodeId: 'measurement-dust-depth',
      x: 1165,
      y: 140
    },
    {
      id: 'environment-negative-airflow',
      label: 'Negative airflow pulled flour dust from Die Cut discharge toward oven underside',
      parentNodeId: 'cat-environment',
      evidence: REFERENCE_RCA_PROJECT.nodeDetails['environment-negative-airflow']?.evidence,
      x: 860,
      y: 785
    },
    {
      id: 'environment-drain-grate',
      label: 'Floor drain grate trapped flour and released dust during sanitation airflow changes',
      parentNodeId: 'cat-environment',
      x: 1165,
      y: 785
    },
    {
      id: 'environment-humidity',
      label: 'Humidity spike increased clumping on underside surfaces, then dried near hot cavity',
      parentNodeId: 'cat-environment',
      x: 860,
      y: 915
    },
    {
      id: 'environment-access-shadow',
      label: 'Lighting shadow under oven made buildup difficult to see during normal floor checks',
      parentNodeId: 'environment-negative-airflow',
      x: 1165,
      y: 915
    }
  ].forEach(addNode);

  return applyReferenceProjectCanvasLayout(nodes);
}

function applyReferenceProjectCanvasLayout(nodes: RcaNode[]): RcaNode[] {
  return arrangeRcaCanvasNodes(nodes, 'ISHIKAWA', REFERENCE_RCA_PROJECT.nodeDetails);
}

function arrangeRcaCanvasNodes(
  nodes: RcaNode[],
  methodology: RcaMethodology,
  nodeDetails: Record<string, ReferenceRcaNodeDetail> = {}
): RcaNode[] {
  if (methodology === 'ISHIKAWA') {
    return arrangeFishboneCanvasNodes(nodes, nodeDetails);
  }

  if (methodology === '5_WHYS') {
    return arrangeFiveWhysCanvasNodes(nodes);
  }

  return nodes.map((node, index) => withNodeCoordinates(node, getNodePosition(node, nodes, index, methodology), methodology));
}

function arrangeFiveWhysCanvasNodes(nodes: RcaNode[]): RcaNode[] {
  return nodes.map((node, index) => withNodeCoordinates(node, {
    x: getFiveWhysArrangedPosition(node, nodes, index).x,
    y: getFiveWhysArrangedPosition(node, nodes, index).y
  }, '5_WHYS'));
}

function getFiveWhysArrangedPosition(node: RcaNode, nodes: RcaNode[], index: number): { x: number; y: number } {
  if (node.nodeType === 'STICKY_NOTE') {
    return getStickyNoteRearrangedPosition(node, nodes, '5_WHYS');
  }

  return getFiveWhysDefaultPosition(getFiveWhysLayoutIndex(node, nodes, index));
}

function getFiveWhysDefaultPosition(index: number): { x: number; y: number } {
  const layout = RCA_FIVE_WHYS_SCAFFOLD_LAYOUT[index];

  if (layout) {
    return layout;
  }

  return {
    x: 1280 + Math.max(0, index - RCA_FIVE_WHYS_SCAFFOLD_LAYOUT.length + 1) * 340,
    y: 310
  };
}

function getStickyNoteRearrangedPosition(
  stickyNode: RcaNode,
  nodes: RcaNode[],
  methodology: RcaMethodology
): { x: number; y: number } {
  const currentX = sanitizeRcaCanvasCoordinate(stickyNode.uiCoordinates?.x) ?? 120;
  const currentY = sanitizeRcaCanvasCoordinate(stickyNode.uiCoordinates?.y) ?? 120;
  const targetNode = stickyNode.parentNodeId
    ? nodes.find((candidateNode) => candidateNode.id === stickyNode.parentNodeId)
    : null;

  if (!targetNode) {
    return { x: currentX, y: currentY };
  }

  const targetIndex = Math.max(0, nodes.findIndex((candidateNode) => candidateNode.id === targetNode.id));
  const targetPosition = getNodePosition(targetNode, nodes, targetIndex, methodology);
  const targetSize = getRcaNodeSize(targetNode);
  const stickySize = getRcaNodeSize(stickyNode);
  const preferredX = targetPosition.x - stickySize.width - 96;
  const preferredY = targetPosition.y + Math.max(0, (targetSize.height - stickySize.height) / 2);
  const fallbackX = targetPosition.x + targetSize.width + 96;
  const nextX = preferredX >= 40 ? preferredX : fallbackX;

  return {
    x: Math.round(nextX),
    y: Math.round(preferredY)
  };
}

function getFiveWhysLayoutIndex(node: RcaNode, nodes: RcaNode[], fallbackIndex: number): number {
  const role = getFiveWhysNodeRole(node);

  if (role === 'PROBLEM') {
    return 0;
  }

  if (role === 'FIVE_WHYS') {
    return 1;
  }

  if (role === 'CAPA') {
    return 2;
  }

  return RCA_FIVE_WHYS_SCAFFOLD_LAYOUT.length + Math.max(0, fallbackIndex);
}

function isFiveWhysProblemLayoutNode(node: RcaNode, nodes: RcaNode[], fallbackIndex: number): boolean {
  if (getFiveWhysNodeRole(node) === 'PROBLEM') {
    return true;
  }

  if (node.parentNodeId) {
    return false;
  }

  const explicitProblemExists = nodes.some((candidateNode) => getFiveWhysNodeRole(candidateNode) === 'PROBLEM');

  if (explicitProblemExists) {
    return false;
  }

  const rootNodes = nodes
    .map((candidateNode, index) => ({ index, node: candidateNode }))
    .filter((entry) => !entry.node.parentNodeId)
    .sort((leftEntry, rightEntry) => {
      const leftX = sanitizeRcaCanvasCoordinate(leftEntry.node.uiCoordinates?.x) ?? 0;
      const rightX = sanitizeRcaCanvasCoordinate(rightEntry.node.uiCoordinates?.x) ?? 0;
      const leftY = sanitizeRcaCanvasCoordinate(leftEntry.node.uiCoordinates?.y) ?? 0;
      const rightY = sanitizeRcaCanvasCoordinate(rightEntry.node.uiCoordinates?.y) ?? 0;

      return leftX - rightX || leftY - rightY || leftEntry.index - rightEntry.index;
    });

  return rootNodes[0]?.node.id === node.id || fallbackIndex === 0;
}

function arrangeFishboneCanvasNodes(
  nodes: RcaNode[],
  nodeDetails: Record<string, ReferenceRcaNodeDetail> = {}
): RcaNode[] {
  const childrenByParent = new Map<string, RcaNode[]>();

  nodes.forEach((node) => {
    if (!node.parentNodeId || node.nodeType === 'STICKY_NOTE') {
      return;
    }

    const siblings = childrenByParent.get(node.parentNodeId) || [];
    siblings.push(node);
    childrenByParent.set(node.parentNodeId, siblings);
  });

  const coordinatesById = new Map<string, { x: number; y: number }>();
  const faultGate = getFishboneFaultGateNode(nodes);
  const categoryNodes = getOrderedFishboneCategoryNodes(nodes);
  const usedCategorySlotIndexes = new Set<number>();
  const causeOffsetX = RCA_CAUSE_NODE_WIDTH + RCA_CAUSE_CATEGORY_HORIZONTAL_GAP;
  const subCauseOffsetX = RCA_CAUSE_NODE_WIDTH + RCA_SUBCAUSE_HORIZONTAL_GAP;
  const minimumSubCauseX = 40;

  const subtreeHeightByNodeId = new Map<string, number>();
  const categoryAssignments = categoryNodes.map((categoryNode, categoryIndex) => {
    const categoryLayout = getFishboneCategoryLayout(categoryNode, categoryIndex, usedCategorySlotIndexes);
    const branchExtents = getFishboneBranchHorizontalExtents(
      categoryNode,
      childrenByParent,
      causeOffsetX,
      subCauseOffsetX,
      nodeDetails
    );

    return {
      branchExtents,
      categoryLayout,
      categoryNode,
      columnIndex: getFishboneCategoryColumnIndex(categoryLayout.x)
    };
  });
  const columnLayouts = new Map<number, {
    branchMaxOffset: number;
    branchMinOffset: number;
    x: number;
  }>();
  const columnIndexes = [...new Set(categoryAssignments.map((assignment) => assignment.columnIndex))]
    .sort((leftIndex, rightIndex) => leftIndex - rightIndex);
  let previousColumnRight = 0;

  columnIndexes.forEach((columnIndex, index) => {
    const assignments = categoryAssignments.filter((assignment) => assignment.columnIndex === columnIndex);
    const branchMinOffset = Math.min(...assignments.map((assignment) => assignment.branchExtents.min));
    const branchMaxOffset = Math.max(...assignments.map((assignment) => assignment.branchExtents.max));
    const defaultX = RCA_FISHBONE_FIRST_COLUMN_X + index * RCA_FISHBONE_COLUMN_STEP;
    const minimumX = index === 0
      ? minimumSubCauseX - branchMinOffset
      : previousColumnRight + RCA_CATEGORY_HORIZONTAL_GAP - branchMinOffset;
    const x = Math.max(defaultX, minimumX);

    columnLayouts.set(columnIndex, {
      branchMaxOffset,
      branchMinOffset,
      x
    });
    previousColumnRight = x + branchMaxOffset;
  });

  function getSubtreeHeight(node: RcaNode): number {
    const cachedHeight = subtreeHeightByNodeId.get(node.id);

    if (cachedHeight !== undefined) {
      return cachedHeight;
    }

    const childNodes = childrenByParent.get(node.id) || [];
    const childStackHeight = getStackHeight(childNodes.map(getSubtreeHeight));
    const subtreeHeight = Math.max(getRcaNodeSize(node, nodeDetails[node.id]).height, childStackHeight);

    subtreeHeightByNodeId.set(node.id, subtreeHeight);
    return subtreeHeight;
  }

  function placeCauseSubtree(node: RcaNode, x: number, topY: number) {
    const subtreeHeight = getSubtreeHeight(node);
    const nodeSize = getRcaNodeSize(node, nodeDetails[node.id]);
    const childNodes = childrenByParent.get(node.id) || [];
    const childStackHeight = getStackHeight(childNodes.map(getSubtreeHeight));
    let childTopY = topY + (subtreeHeight - childStackHeight) / 2;

    coordinatesById.set(node.id, {
      x: Math.max(minimumSubCauseX, Math.round(x)),
      y: Math.round(topY + (subtreeHeight - nodeSize.height) / 2)
    });

    childNodes.forEach((childNode, childIndex) => {
      const childHeight = getSubtreeHeight(childNode);
      const nextChild = childNodes[childIndex + 1];

      placeCauseSubtree(childNode, x - subCauseOffsetX, childTopY);
      childTopY += childHeight + (nextChild ? getCauseStackGap(childHeight, getSubtreeHeight(nextChild)) : 0);
    });
  }

  if (faultGate) {
    const faultGateSize = getRcaNodeSize(faultGate, nodeDetails[faultGate.id]);
    const lastColumnRight = Math.max(
      0,
      ...[...columnLayouts.values()].map((columnLayout) => columnLayout.x + columnLayout.branchMaxOffset)
    );

    coordinatesById.set(faultGate.id, {
      x: Math.max(2050, lastColumnRight + RCA_FAULT_GATE_HORIZONTAL_GAP),
      y: RCA_FISHBONE_SPINE_Y - faultGateSize.height / 2
    });
  }

  categoryAssignments.forEach((assignment) => {
    const columnLayout = columnLayouts.get(assignment.columnIndex);
    const categoryX = columnLayout?.x ?? assignment.categoryLayout.x;
    const categoryY = assignment.categoryLayout.y;
    const categorySize = getRcaNodeSize(assignment.categoryNode, nodeDetails[assignment.categoryNode.id]);
    const directCauseX = categoryX - causeOffsetX;
    const directCauses = childrenByParent.get(assignment.categoryNode.id) || [];
    const directCauseStackHeight = getStackHeight(directCauses.map(getSubtreeHeight));
    const directCauseStartY = assignment.categoryLayout.lane === 'top'
      ? categoryY - RCA_BRANCH_CATEGORY_GAP - directCauseStackHeight
      : categoryY + categorySize.height + RCA_BRANCH_CATEGORY_GAP;
    let directCauseTopY = directCauseStartY;

    coordinatesById.set(assignment.categoryNode.id, { x: categoryX, y: categoryY });

    directCauses.forEach((directCause, directCauseIndex) => {
      const directCauseHeight = getSubtreeHeight(directCause);
      const nextDirectCause = directCauses[directCauseIndex + 1];

      placeCauseSubtree(directCause, directCauseX, directCauseTopY);
      directCauseTopY += directCauseHeight + (
        nextDirectCause ? getCauseStackGap(directCauseHeight, getSubtreeHeight(nextDirectCause)) : 0
      );
    });
  });

  return nodes.map((node) => {
    const coordinates = coordinatesById.get(node.id);

    if (!coordinates) {
      return node;
    }

    return {
      ...node,
      uiCoordinates: {
        layoutMethodology: 'ISHIKAWA',
        x: coordinates.x,
        y: coordinates.y
      }
    };
  });
}

function withNodeCoordinates(
  node: RcaNode,
  coordinates: { x: number; y: number },
  methodology: RcaMethodology
): RcaNode {
  return {
    ...node,
    uiCoordinates: {
      layoutMethodology: methodology,
      x: Math.round(coordinates.x),
      y: Math.round(coordinates.y)
    }
  };
}

function getFishboneFaultGateNode(nodes: RcaNode[]): RcaNode | undefined {
  return nodes.find((node) => node.nodeType === 'FAULT_GATE') ||
    nodes.find((node) => !node.parentNodeId) ||
    nodes[0];
}

function getOrderedFishboneCategoryNodes(nodes: RcaNode[]): RcaNode[] {
  return nodes
    .filter((node) => node.nodeType === 'ISHIKAWA_CATEGORY')
    .sort((leftNode, rightNode) => (
      getPreferredFishboneSlotIndex(leftNode) - getPreferredFishboneSlotIndex(rightNode) ||
      leftNode.label.localeCompare(rightNode.label)
    ));
}

function shouldEnsureDefaultFishboneScaffold(nodes: RcaNode[]): boolean {
  const hasFaultGate = nodes.some((node) => node.nodeType === 'FAULT_GATE');
  const defaultCategoryLabels = new Set(RCA_DEFAULT_FISHBONE_CATEGORIES.map((category) => (
    normalizeFishboneCategoryName(category.label)
  )));
  const existingDefaultCategoryLabels = new Set(nodes
    .filter((node) => node.nodeType === 'ISHIKAWA_CATEGORY')
    .map((node) => normalizeFishboneCategoryName(node.label))
    .filter((label) => defaultCategoryLabels.has(label)));

  return !hasFaultGate || existingDefaultCategoryLabels.size < RCA_DEFAULT_FISHBONE_CATEGORIES.length;
}

function normalizeFishboneCategoryName(value: string): string {
  return value.trim().toLowerCase();
}

function getFishboneCategoryLayout(
  categoryNode: RcaNode,
  categoryIndex: number,
  usedSlotIndexes: Set<number>
): { lane: 'top' | 'bottom'; x: number; y: number } {
  const preferredSlotIndex = getPreferredFishboneSlotIndex(categoryNode);
  const hasAvailablePreferredSlot = preferredSlotIndex < RCA_FISHBONE_CATEGORY_LAYOUTS.length &&
    !usedSlotIndexes.has(preferredSlotIndex);
  const slotIndex = hasAvailablePreferredSlot
    ? preferredSlotIndex
    : RCA_FISHBONE_CATEGORY_LAYOUTS.findIndex((_, index) => !usedSlotIndexes.has(index));
  const slot = RCA_FISHBONE_CATEGORY_LAYOUTS[slotIndex] ||
    RCA_FISHBONE_CATEGORY_LAYOUTS[categoryIndex];

  if (slot) {
    usedSlotIndexes.add(slotIndex === -1 ? categoryIndex : slotIndex);
    return slot;
  }

  const fallbackColumn = Math.floor(categoryIndex / 2);
  const lane = categoryIndex % 2 === 0 ? 'top' : 'bottom';

  return {
    lane,
    x: 650 + fallbackColumn * 470,
    y: lane === 'top' ? 585 : 805
  };
}

function getStackHeight(heights: number[]): number {
  if (!heights.length) {
    return 0;
  }

  return heights.reduce((totalHeight, height, index) => {
    const previousHeight = heights[index - 1];
    const gapBefore = previousHeight === undefined ? 0 : getCauseStackGap(previousHeight, height);

    return totalHeight + gapBefore + height;
  }, 0);
}

function getCauseStackGap(previousHeight: number, nextHeight: number): number {
  const tallestNeighbor = Math.max(previousHeight, nextHeight);

  if (tallestNeighbor >= RCA_CAUSE_NODE_HEIGHT + 72) {
    return RCA_CAUSE_EXTRA_TALL_VERTICAL_GAP;
  }

  if (tallestNeighbor >= RCA_CAUSE_NODE_HEIGHT + 32) {
    return RCA_CAUSE_TALL_VERTICAL_GAP;
  }

  return RCA_CAUSE_VERTICAL_GAP;
}

function getFishboneBranchHorizontalExtents(
  categoryNode: RcaNode,
  childrenByParent: Map<string, RcaNode[]>,
  causeOffsetX: number,
  subCauseOffsetX: number,
  nodeDetails: Record<string, ReferenceRcaNodeDetail> = {}
): { max: number; min: number } {
  const visitedNodeIds = new Set<string>();
  const extents = {
    max: RCA_CATEGORY_NODE_WIDTH,
    min: 0
  };

  function walk(parentNodeId: string, childXOffset: number) {
    const childNodes = childrenByParent.get(parentNodeId) || [];

    childNodes.forEach((childNode) => {
      if (visitedNodeIds.has(childNode.id)) {
        return;
      }

      visitedNodeIds.add(childNode.id);

      const childWidth = getRcaNodeSize(childNode, nodeDetails[childNode.id]).width;

      extents.min = Math.min(extents.min, childXOffset);
      extents.max = Math.max(extents.max, childXOffset + childWidth);
      walk(childNode.id, childXOffset - subCauseOffsetX);
    });
  }

  walk(categoryNode.id, -causeOffsetX);

  return extents;
}

function getFishboneCategoryColumnIndex(categoryX: number): number {
  return Math.max(0, Math.round((categoryX - RCA_FISHBONE_FIRST_COLUMN_X) / RCA_FISHBONE_COLUMN_STEP));
}

function getPreferredFishboneSlotIndex(categoryNode: RcaNode): number {
  const categoryName = normalizeFishboneSlotKey(`${categoryNode.id} ${categoryNode.label}`);
  const slotIndex = RCA_FISHBONE_CATEGORY_LAYOUTS.findIndex((slot) => (
    categoryName.includes(normalizeFishboneSlotKey(slot.id.replace('cat-', '')))
  ));

  return slotIndex === -1 ? Number.MAX_SAFE_INTEGER : slotIndex;
}

function normalizeFishboneSlotKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function RcaWorkspace() {
  return (
    <ReactFlowProvider>
      <RcaWorkspaceInner />
    </ReactFlowProvider>
  );
}

function useMinimumVisibleDuration(isVisible: boolean, durationMs: number): boolean {
  const [isRendered, setIsRendered] = React.useState(isVisible);
  const visibleSinceRef = React.useRef<number | null>(isVisible ? Date.now() : null);
  const hideTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (isVisible) {
      if (!isRendered) {
        visibleSinceRef.current = Date.now();
        setIsRendered(true);
      } else if (visibleSinceRef.current === null) {
        visibleSinceRef.current = Date.now();
      }

      return undefined;
    }

    if (!isRendered) {
      return undefined;
    }

    const elapsedMs = visibleSinceRef.current === null ? durationMs : Date.now() - visibleSinceRef.current;
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    hideTimeoutRef.current = window.setTimeout(() => {
      visibleSinceRef.current = null;
      hideTimeoutRef.current = null;
      setIsRendered(false);
    }, remainingMs);

    return () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [durationMs, isRendered, isVisible]);

  return isRendered;
}

function RcaWorkspaceInner() {
  const appLoading = useAppLoading();
  const reactFlow = useReactFlow();
  const { zoom: canvasZoom } = useViewport();
  const workspaceRootRef = React.useRef<HTMLElement | null>(null);
  const [workspaceView, setWorkspaceView] = React.useState<RcaWorkspaceView>('dashboard');
  const [workspace, setWorkspace] = React.useState<RcaWorkspaceResponse | null>(null);
  const [isReferenceProjectActive, setIsReferenceProjectActive] = React.useState(true);
  const [referenceMethodology, setReferenceMethodology] = React.useState<RcaMethodology>('ISHIKAWA');
  const [referenceNodesByMethodology, setReferenceNodesByMethodology] = React.useState<Record<RcaMethodology, RcaNode[]>>(() => ({
    '5_WHYS': [],
    FAULT_TREE: [],
    ISHIKAWA: buildReferenceProjectNodes()
  }));
  const [referenceStepId, setReferenceStepId] = React.useState(REFERENCE_RCA_PROJECT.steps[0]?.id || '');
  const [referenceIncidentTitle, setReferenceIncidentTitle] = React.useState(REFERENCE_RCA_PROJECT.incident.title);
  const [selectedIncidentId, setSelectedIncidentId] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<RcaSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [nodes, setNodes] = React.useState<RcaNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [inspectedNodeId, setInspectedNodeId] = React.useState<string | null>(null);
  const [selectedFlowNodeIds, setSelectedFlowNodeIds] = React.useState<Set<string>>(() => new Set());
  const [selectedFlowEdgeIds, setSelectedFlowEdgeIds] = React.useState<Set<string>>(() => new Set());
  const [pendingCanvasDestructiveAction, setPendingCanvasDestructiveAction] = React.useState<RcaCanvasDestructiveAction | null>(null);
  const [canvasInteractionMode, setCanvasInteractionMode] = React.useState<RcaCanvasInteractionMode>('select');
  const [canvasTheme, setCanvasTheme] = React.useState<RcaCanvasTheme>('light');
  const [canvasContextMenu, setCanvasContextMenu] = React.useState<RcaCanvasContextMenuState | null>(null);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = React.useState(false);
  const [isCanvasShortcutListOpen, setIsCanvasShortcutListOpen] = React.useState(false);
  const [nodeStyleEditor, setNodeStyleEditor] = React.useState<RcaNodeStyleEditorState | null>(null);
  const [splineStyleEditor, setSplineStyleEditor] = React.useState<RcaSplineStyleEditorState | null>(null);
  const [isCanvasGridVisible, setIsCanvasGridVisible] = React.useState(true);
  const [canvasGridSize, setCanvasGridSize] = React.useState(RCA_CANVAS_GRID_MAX_SIZE);
  const [isCanvasSnapEnabled, setIsCanvasSnapEnabled] = React.useState(true);
  const [alignmentGuides, setAlignmentGuides] = React.useState<RcaAlignmentGuide[]>([]);
  const [canvasUndoStack, setCanvasUndoStack] = React.useState<RcaCanvasHistorySnapshot[]>([]);
  const [canvasRedoStack, setCanvasRedoStack] = React.useState<RcaCanvasHistorySnapshot[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingSession, setIsLoadingSession] = React.useState(false);
  const [isWorking, setIsWorking] = React.useState(false);
  const [isTitleAutosaving, setIsTitleAutosaving] = React.useState(false);
  const [isCanvasAutosaving, setIsCanvasAutosaving] = React.useState(false);
  const [isIncidentLauncherOpen, setIsIncidentLauncherOpen] = React.useState(false);
  const [isIncidentShelfOpen, setIsIncidentShelfOpen] = React.useState(false);
  const [isCollaboratorInviteOpen, setIsCollaboratorInviteOpen] = React.useState(false);
  const [collaboratorCandidates, setCollaboratorCandidates] = React.useState<RcaUserSummary[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = React.useState<RcaUserSummary[]>([]);
  const [collaboratorSearchQuery, setCollaboratorSearchQuery] = React.useState('');
  const [isLoadingCollaborators, setIsLoadingCollaborators] = React.useState(false);
  const [isSendingCollaboratorInvite, setIsSendingCollaboratorInvite] = React.useState(false);
  const [removingCollaboratorUid, setRemovingCollaboratorUid] = React.useState<string | null>(null);
  const [activityLogs, setActivityLogs] = React.useState<RcaActivityLog[]>([]);
  const [isActivityLogOpen, setIsActivityLogOpen] = React.useState(false);
  const [isLoadingActivityLogs, setIsLoadingActivityLogs] = React.useState(false);
  const [reportIncidentNodeId, setReportIncidentNodeId] = React.useState<string | null>(null);
  const [realtimeParticipants, setRealtimeParticipants] = React.useState<RcaRealtimePresenceUser[]>([]);
  const [realtimeStatus, setRealtimeStatus] = React.useState<'connecting' | 'connected' | 'subscribed' | 'disconnected'>('disconnected');
  const [nodeActivities, setNodeActivities] = React.useState<RcaNodeActivity[]>([]);
  const [liveNodeLabels, setLiveNodeLabels] = React.useState<Map<string, string>>(() => new Map());
  const [measuredFlowNodeSizes, setMeasuredFlowNodeSizes] = React.useState<Map<string, { height: number; width: number }>>(() => new Map());
  const [deleteIncidentCandidate, setDeleteIncidentCandidate] = React.useState<RcaIncident | null>(null);
  const [removedAccessNotice, setRemovedAccessNotice] = React.useState<{
    incident: RcaIncident;
    removedAtIso: string;
    removedByName: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [incidentDraft, setIncidentDraft] = React.useState({
    title: ''
  });
  const nodesRef = React.useRef<RcaNode[]>([]);
  const nodesCanvasKeyRef = React.useRef<string | null>(null);
  const openedCanvasFitViewKeyRef = React.useRef<string | null>(null);
  const fiveWhysScaffoldSessionRef = React.useRef<Set<string>>(new Set());
  const pendingNodePositionUpdatesRef = React.useRef<Map<string, { x: number; y: number }>>(new Map());
  const canvasSaveRequestRef = React.useRef(0);
  const canvasFitViewTimeoutRef = React.useRef<number | null>(null);
  const dragStartNodesRef = React.useRef<RcaNode[] | null>(null);
  const activeDragNodeIdsRef = React.useRef<Set<string>>(new Set());
  const nodeEditHistorySnapshotRef = React.useRef<Map<string, RcaNode[]>>(new Map());
  const nodeStyleHistorySnapshotRef = React.useRef<Set<string>>(new Set());
  const nodeStyleSaveTimeoutsRef = React.useRef<Map<string, number>>(new Map());
  const pendingNodeVisualStylesRef = React.useRef<Map<string, RcaNodeVisualStyle>>(new Map());
  const nodeStyleSaveRequestRef = React.useRef<Map<string, number>>(new Map());
  const splineStyleHistorySnapshotRef = React.useRef<Set<string>>(new Set());
  const splineStyleSaveTimeoutsRef = React.useRef<Map<string, number>>(new Map());
  const pendingSplineEdgeStylesRef = React.useRef<Map<string, RcaNodeEdgeStyle>>(new Map());
  const splineStyleSaveRequestRef = React.useRef<Map<string, number>>(new Map());
  const activeRealtimeCanvasRef = React.useRef<{ incidentId: string; sessionId: string } | null>(null);
  const contextRef = React.useRef<RcaWorkspaceContext | null>(null);
  const lastNonEmptyNodesByCanvasRef = React.useRef<Map<string, RcaNode[]>>(new Map());
  const liveLabelDocsRef = React.useRef<Map<string, Y.Doc>>(new Map());

  const referenceSession = React.useMemo<RcaSession>(() => ({
    ...REFERENCE_RCA_PROJECT.session,
    methodology: referenceMethodology
  }), [referenceMethodology]);
  const referenceIncident = React.useMemo<RcaIncident>(() => ({
    ...REFERENCE_RCA_PROJECT.incident,
    title: referenceIncidentTitle
  }), [referenceIncidentTitle]);
  const referenceNodes = referenceNodesByMethodology[referenceMethodology] || [];
  const setReferenceNodes = React.useCallback((nextNodes: React.SetStateAction<RcaNode[]>) => {
    setReferenceNodesByMethodology((currentStreams) => {
      const currentNodes = currentStreams[referenceMethodology] || [];
      const resolvedNodes = typeof nextNodes === 'function'
        ? nextNodes(currentNodes)
        : nextNodes;

      if (resolvedNodes === currentNodes) {
        return currentStreams;
      }

      return {
        ...currentStreams,
        [referenceMethodology]: resolvedNodes
      };
    });
  }, [referenceMethodology]);
  const selectedIncident = isReferenceProjectActive
    ? referenceIncident
    : workspace?.incidents.find((incident) => incident.id === selectedIncidentId) || null;
  const selectedSession = isReferenceProjectActive
    ? referenceSession
    : sessions.find((session) => (
        session.id === selectedSessionId &&
        session.incidentId === selectedIncidentId
      )) || null;
  const persistedVisibleNodes = isReferenceProjectActive ? referenceNodes : nodes;
  React.useEffect(() => {
    nodesRef.current = nodes;
    const activeCanvasKey = selectedIncidentId && selectedSessionId
      ? getRcaCanvasStateKey(selectedIncidentId, selectedSessionId)
      : null;

    if (!activeCanvasKey || !nodes.length) {
      if (!nodes.length) {
        nodesCanvasKeyRef.current = activeCanvasKey;
      }
      return;
    }

    if (nodesCanvasKeyRef.current !== activeCanvasKey) {
      return;
    }

    lastNonEmptyNodesByCanvasRef.current.set(
      activeCanvasKey,
      cloneRcaNodes(nodes)
    );
  }, [nodes, selectedIncidentId, selectedSessionId]);
  const visibleNodes = React.useMemo(() => {
    if (isReferenceProjectActive || !liveNodeLabels.size) {
      return persistedVisibleNodes;
    }

    return persistedVisibleNodes.map((node) => (
      liveNodeLabels.has(node.id)
        ? { ...node, label: liveNodeLabels.get(node.id) ?? node.label }
        : node
    ));
  }, [isReferenceProjectActive, liveNodeLabels, persistedVisibleNodes]);
  const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId) || null;
  const inspectedNode = visibleNodes.find((node) => node.id === inspectedNodeId) || null;
  const selectedReportIncidentNode = React.useMemo(() => {
    if (isRcaIncidentReportNode(selectedNode, visibleNodes)) {
      return selectedNode;
    }

    const selectedIds = [
      ...selectedFlowNodeIds
    ];

    for (const nodeId of selectedIds) {
      const candidateNode = visibleNodes.find((node) => node.id === nodeId);

      if (isRcaIncidentReportNode(candidateNode, visibleNodes)) {
        return candidateNode;
      }
    }

    return null;
  }, [selectedFlowNodeIds, selectedNode, visibleNodes]);
  const reportIncidentNode = reportIncidentNodeId
    ? visibleNodes.find((node) => node.id === reportIncidentNodeId && isRcaIncidentReportNode(node, visibleNodes)) || null
    : null;
  const activeNodeDetails = React.useMemo(
    () => (isReferenceProjectActive ? REFERENCE_RCA_PROJECT.nodeDetails : {}),
    [isReferenceProjectActive]
  );
  const flowNodes = React.useMemo(
    () => buildFlowNodes(
      visibleNodes,
      selectedNodeId,
      selectedFlowNodeIds,
      selectedSession?.methodology || 'ISHIKAWA',
      setInspectedNodeId,
      activeNodeDetails,
      isReferenceProjectActive,
      isReferenceProjectActive ? null : selectedIncident?.id || null,
      isReferenceProjectActive ? null : selectedSession?.id || null,
      realtimeStatus === 'subscribed',
      nodeActivities,
      measuredFlowNodeSizes,
      handleInlineNodeCommit
    ),
    [activeNodeDetails, isReferenceProjectActive, measuredFlowNodeSizes, nodeActivities, realtimeStatus, selectedFlowNodeIds, selectedIncident?.id, selectedNodeId, selectedSession?.id, selectedSession?.methodology, visibleNodes]
  );
  const flowEdges = React.useMemo(
    () => buildFlowEdges(visibleNodes, selectedSession?.methodology || 'ISHIKAWA', selectedFlowEdgeIds),
    [selectedFlowEdgeIds, selectedSession?.methodology, visibleNodes]
  );
  const canEditCanvasConnections = Boolean(
    selectedIncident &&
    (selectedSession?.methodology === 'ISHIKAWA' || selectedSession?.methodology === '5_WHYS') &&
    !isReferenceProjectActive &&
    !isWorking &&
    !isLoadingSession
  );
  const canRearrangeCanvas = Boolean(
    selectedSession &&
    (selectedSession.methodology === 'ISHIKAWA' || selectedSession.methodology === '5_WHYS') &&
    visibleNodes.length
  );
  const nodeTypes = React.useMemo(() => ({
    rcaFishboneSpine: RcaFishboneSpineNode as React.ComponentType<NodeProps>,
    rcaNode: RcaNodeCard as React.ComponentType<NodeProps>
  }), []);
  const edgeTypes = React.useMemo(() => ({
    rcaSpline: RcaSplineEdge
  }), []);
  const canvasSnapGrid = React.useMemo<[number, number]>(() => [canvasGridSize, canvasGridSize], [canvasGridSize]);
  const canvasThemeStyles = RCA_CANVAS_THEME_STYLES[canvasTheme];
  const canvasGridDotSize = React.useMemo(() => (
    Math.max(1.7, Math.min(5.6, 1.9 / Math.max(canvasZoom, 0.28)))
  ), [canvasZoom]);
  const canFitVisibleProject = workspaceView === 'canvas' && Boolean(selectedSession) && visibleNodes.length > 0;
  const fitVisibleProjectIntoView = React.useCallback((options: {
    delay?: number;
    force?: boolean;
    padding?: number;
  } = {}) => {
    if (!visibleNodes.length) {
      return;
    }

    if (!options.force && !canFitVisibleProject) {
      return;
    }

    if (canvasFitViewTimeoutRef.current !== null) {
      window.clearTimeout(canvasFitViewTimeoutRef.current);
    }

    canvasFitViewTimeoutRef.current = window.setTimeout(() => {
      canvasFitViewTimeoutRef.current = null;
      window.requestAnimationFrame(() => {
        void reactFlow.fitView({
          duration: 560,
          maxZoom: 0.78,
          minZoom: 0.25,
          padding: options.padding ?? 0.14
        });
      });
    }, options.delay ?? 120);
  }, [canFitVisibleProject, reactFlow, visibleNodes.length]);
  const closeCanvasContextMenu = React.useCallback(() => {
    setCanvasContextMenu(null);
  }, []);
  const closeNodeStyleEditor = React.useCallback(() => {
    setNodeStyleEditor(null);
  }, []);
  const closeSplineStyleEditor = React.useCallback(() => {
    setSplineStyleEditor(null);
  }, []);
  const clearPendingNodeStyleSaves = React.useCallback(() => {
    nodeStyleSaveTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    nodeStyleSaveTimeoutsRef.current.clear();
    pendingNodeVisualStylesRef.current.clear();
    nodeStyleSaveRequestRef.current.clear();
    nodeStyleHistorySnapshotRef.current.clear();
    setIsCanvasAutosaving(false);
  }, []);
  const clearPendingSplineStyleSaves = React.useCallback(() => {
    splineStyleSaveTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    splineStyleSaveTimeoutsRef.current.clear();
    pendingSplineEdgeStylesRef.current.clear();
    splineStyleSaveRequestRef.current.clear();
    splineStyleHistorySnapshotRef.current.clear();
    setIsCanvasAutosaving(false);
  }, []);
  const resetCanvasHistory = React.useCallback(() => {
    setCanvasUndoStack([]);
    setCanvasRedoStack([]);
    dragStartNodesRef.current = null;
    nodeEditHistorySnapshotRef.current.clear();
    nodeStyleHistorySnapshotRef.current.clear();
    splineStyleHistorySnapshotRef.current.clear();
  }, []);
  const resetActiveCanvasState = React.useCallback((canvasKey: string | null = null) => {
    setNodes([]);
    setSelectedNodeId(null);
    setInspectedNodeId(null);
    setSelectedFlowNodeIds(new Set());
    setMeasuredFlowNodeSizes(new Map());
    setRealtimeParticipants([]);
    setNodeActivities([]);
    setLiveNodeLabels(new Map());
    liveLabelDocsRef.current.clear();
    nodesRef.current = [];
    nodesCanvasKeyRef.current = canvasKey;
    openedCanvasFitViewKeyRef.current = null;
    resetCanvasHistory();
    closeNodeStyleEditor();
    closeSplineStyleEditor();
  }, [closeNodeStyleEditor, closeSplineStyleEditor, resetCanvasHistory]);
  const recordCanvasHistory = React.useCallback((snapshot: RcaNode[]) => {
    if (isReferenceProjectActive || !selectedIncidentId || !selectedSessionId) {
      return;
    }

    const historySnapshot = cloneRcaNodes(snapshot);

    setCanvasUndoStack((currentStack) => {
      const currentTop = currentStack[currentStack.length - 1];

      if (currentTop && areRcaNodeSnapshotsEqual(currentTop, historySnapshot)) {
        return currentStack;
      }

      return [...currentStack, historySnapshot].slice(-RCA_CANVAS_HISTORY_LIMIT);
    });
    setCanvasRedoStack([]);
  }, [isReferenceProjectActive, selectedIncidentId, selectedSessionId]);
  const openCanvasContextMenu = React.useCallback((
    event: MouseEvent | React.MouseEvent<Element>,
    targetNodeId?: string,
    isCanvasPaneTarget = true
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (workspaceView !== 'canvas') {
      return;
    }

    setSplineStyleEditor(null);
    const bounds = workspaceRootRef.current?.getBoundingClientRect();
    const menuWidth = 196;
    const menuHeight = 262;
    const submenuWidth = 216;
    const menuMargin = 12;
    const rawX = bounds ? event.clientX - bounds.left : event.clientX;
    const rawY = bounds ? event.clientY - bounds.top : event.clientY;
    const maxX = Math.max(menuMargin, (bounds?.width ?? window.innerWidth) - menuWidth - menuMargin);
    const maxY = Math.max(menuMargin, (bounds?.height ?? window.innerHeight) - menuHeight - menuMargin);
    const canvasPosition = reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });
    const submenuPlacement: RcaCanvasSubmenuPlacement =
      event.clientX + menuWidth + submenuWidth + menuMargin > window.innerWidth ? 'left' : 'right';
    const selectedText = getCurrentEditableSelectionText();
    const nextContextMenu: RcaCanvasContextMenuState = {
      canvasX: canvasPosition.x,
      canvasY: canvasPosition.y,
      hasClipboardText: false,
      hasSelectedText: Boolean(selectedText.trim()),
      isCanvasPaneTarget,
      submenuPlacement,
      targetNodeId,
      x: Math.max(menuMargin, Math.min(rawX, maxX)),
      y: Math.max(menuMargin, Math.min(rawY, maxY))
    };

    setCanvasContextMenu(nextContextMenu);

    if (navigator.clipboard?.readText) {
      void navigator.clipboard.readText().then((clipboardText) => {
        setCanvasContextMenu((currentContextMenu) => (
          currentContextMenu &&
          currentContextMenu.x === nextContextMenu.x &&
          currentContextMenu.y === nextContextMenu.y &&
          currentContextMenu.targetNodeId === nextContextMenu.targetNodeId
            ? { ...currentContextMenu, hasClipboardText: Boolean(clipboardText.trim()) }
            : currentContextMenu
        ));
      }).catch(() => {
        setCanvasContextMenu((currentContextMenu) => (
          currentContextMenu &&
          currentContextMenu.x === nextContextMenu.x &&
          currentContextMenu.y === nextContextMenu.y &&
          currentContextMenu.targetNodeId === nextContextMenu.targetNodeId
            ? { ...currentContextMenu, hasClipboardText: false }
            : currentContextMenu
        ));
      });
    }
  }, [reactFlow, workspaceView]);
  const openSplineStyleEditor = React.useCallback((event: React.MouseEvent<Element>, edge: Edge) => {
    event.stopPropagation();

    if (!selectedSession || isReferenceProjectActive) {
      return;
    }

    const nodeId = getRcaSplineOwnerNodeId(edge, selectedSession.methodology);

    if (!visibleNodes.some((node) => node.id === nodeId)) {
      return;
    }

    const bounds = workspaceRootRef.current?.getBoundingClientRect();
    const editorWidth = 520;
    const editorHeight = 46;
    const editorMargin = 12;
    const rawX = bounds ? event.clientX - bounds.left - editorWidth / 2 : event.clientX;
    const rawY = bounds ? event.clientY - bounds.top - editorHeight - 10 : event.clientY;
    const maxX = Math.max(editorMargin, (bounds?.width ?? window.innerWidth) - editorWidth - editorMargin);
    const maxY = Math.max(editorMargin, (bounds?.height ?? window.innerHeight) - editorHeight - editorMargin);

    closeCanvasContextMenu();
    closeNodeStyleEditor();
    setSplineStyleEditor({
      edgeId: edge.id,
      nodeId,
      x: Math.max(editorMargin, Math.min(rawX, maxX)),
      y: Math.max(editorMargin, Math.min(rawY, maxY))
    });
  }, [closeCanvasContextMenu, closeNodeStyleEditor, isReferenceProjectActive, selectedSession, visibleNodes]);
  const openNodeStyleEditor = React.useCallback((nodeId: string) => {
    if (!selectedSession || isReferenceProjectActive) {
      return;
    }

    const nodeIndex = visibleNodes.findIndex((node) => node.id === nodeId);
    const node = nodeIndex >= 0 ? visibleNodes[nodeIndex] : null;

    if (!node) {
      return;
    }

    const bounds = workspaceRootRef.current?.getBoundingClientRect();
    const viewport = reactFlow.getViewport();
    const editorWidth = 520;
    const editorHeight = 46;
    const editorMargin = 12;
    const nodePosition = getNodePosition(node, visibleNodes, nodeIndex, selectedSession.methodology);
    const nodeSize = getRcaNodeSize(node);
    const rawX = nodePosition.x * viewport.zoom + viewport.x + (nodeSize.width * viewport.zoom) / 2 - editorWidth / 2;
    const rawY = nodePosition.y * viewport.zoom + viewport.y - editorHeight - 10;
    const maxX = Math.max(editorMargin, (bounds?.width ?? window.innerWidth) - editorWidth - editorMargin);
    const maxY = Math.max(editorMargin, (bounds?.height ?? window.innerHeight) - editorHeight - editorMargin);

    closeCanvasContextMenu();
    closeSplineStyleEditor();
    setNodeStyleEditor({
      nodeId,
      x: Math.max(editorMargin, Math.min(rawX, maxX)),
      y: Math.max(editorMargin, Math.min(rawY, maxY))
    });
  }, [closeCanvasContextMenu, closeSplineStyleEditor, isReferenceProjectActive, reactFlow, selectedSession, visibleNodes]);

  React.useEffect(() => {
    void loadWorkspace();
  }, []);

  React.useEffect(() => () => {
    if (canvasFitViewTimeoutRef.current !== null) {
      window.clearTimeout(canvasFitViewTimeoutRef.current);
    }

    clearPendingNodeStyleSaves();
    clearPendingSplineStyleSaves();
  }, [clearPendingNodeStyleSaves, clearPendingSplineStyleSaves]);

  React.useEffect(() => {
    resetCanvasHistory();
    clearPendingNodeStyleSaves();
    clearPendingSplineStyleSaves();
  }, [clearPendingNodeStyleSaves, clearPendingSplineStyleSaves, isReferenceProjectActive, referenceMethodology, resetCanvasHistory, selectedIncidentId, selectedSessionId]);

  React.useEffect(() => {
    if (!canvasContextMenu && !nodeStyleEditor && !splineStyleEditor) {
      return;
    }

    function handleMenuKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeCanvasContextMenu();
        closeNodeStyleEditor();
        closeSplineStyleEditor();
      }
    }

    window.addEventListener('keydown', handleMenuKeyDown);
    window.addEventListener('resize', closeCanvasContextMenu);
    window.addEventListener('resize', closeNodeStyleEditor);
    window.addEventListener('resize', closeSplineStyleEditor);

    return () => {
      window.removeEventListener('keydown', handleMenuKeyDown);
      window.removeEventListener('resize', closeCanvasContextMenu);
      window.removeEventListener('resize', closeNodeStyleEditor);
      window.removeEventListener('resize', closeSplineStyleEditor);
    };
  }, [canvasContextMenu, closeCanvasContextMenu, closeNodeStyleEditor, closeSplineStyleEditor, nodeStyleEditor, splineStyleEditor]);

  React.useEffect(() => {
    if (workspaceView !== 'canvas' || isReferenceProjectActive) {
      return;
    }

    if (!workspace?.incidents.length) {
      setSelectedIncidentId(null);
      return;
    }

    if (!selectedIncidentId || !workspace.incidents.some((incident) => incident.id === selectedIncidentId)) {
      setSelectedIncidentId(workspace.incidents[0].id);
    }
  }, [isReferenceProjectActive, selectedIncidentId, workspace?.incidents, workspaceView]);

  React.useEffect(() => {
    if (!selectedIncidentId) {
      setSessions([]);
      setSelectedSessionId(null);
      resetActiveCanvasState(null);
      return;
    }

    if (workspaceView !== 'canvas' || isReferenceProjectActive) {
      return;
    }

    void loadIncidentSessions(selectedIncidentId);
  }, [isReferenceProjectActive, selectedIncidentId, workspaceView]);

  React.useEffect(() => {
    if (
      isReferenceProjectActive ||
      !selectedIncident ||
      !selectedIncident.activeSessionId ||
      selectedSessionId === selectedIncident.activeSessionId
    ) {
      return;
    }

    void loadIncidentSessions(selectedIncident.id);
  }, [isReferenceProjectActive, selectedIncident?.activeSessionId, selectedIncident?.id, selectedSessionId]);

  React.useEffect(() => {
    if (
      workspaceView !== 'canvas' ||
      isReferenceProjectActive ||
      !selectedIncidentId ||
      !selectedSessionId
    ) {
      if (!isReferenceProjectActive) {
        resetActiveCanvasState(null);
      }
      setActivityLogs([]);
      return;
    }

    void loadNodes(selectedIncidentId, selectedSessionId);
    void loadActivityLogs(selectedIncidentId, selectedSessionId);
  }, [isReferenceProjectActive, selectedIncidentId, selectedSessionId, workspaceView]);

  React.useEffect(() => {
    if (
      workspaceView !== 'canvas' ||
      isReferenceProjectActive ||
      isLoadingSession ||
      !selectedIncidentId ||
      !selectedSessionId ||
      !selectedSession ||
      !visibleNodes.length
    ) {
      return undefined;
    }

    const canvasKey = getRcaCanvasStateKey(selectedIncidentId, selectedSessionId);

    if (openedCanvasFitViewKeyRef.current === canvasKey) {
      return undefined;
    }

    openedCanvasFitViewKeyRef.current = canvasKey;
    fitVisibleProjectIntoView({ delay: 220, force: true, padding: 0.2 });

    const finalFitTimeoutId = window.setTimeout(() => {
      fitVisibleProjectIntoView({ delay: 0, force: true, padding: 0.2 });
    }, 680);

    return () => window.clearTimeout(finalFitTimeoutId);
  }, [
    fitVisibleProjectIntoView,
    isLoadingSession,
    isReferenceProjectActive,
    selectedIncidentId,
    selectedSession,
    selectedSessionId,
    visibleNodes.length,
    workspaceView
  ]);

  React.useEffect(() => {
    if (
      workspaceView !== 'canvas' ||
      isReferenceProjectActive ||
      isLoadingSession ||
      isWorking ||
      !selectedIncident ||
      selectedIncident.accessRole !== 'OWNER' ||
      !selectedSession ||
      selectedSession.methodology !== '5_WHYS' ||
      nodes.length
    ) {
      return;
    }

    const canvasKey = getRcaCanvasStateKey(selectedIncident.id, selectedSession.id);

    if (
      nodesCanvasKeyRef.current !== canvasKey ||
      fiveWhysScaffoldSessionRef.current.has(selectedSession.id)
    ) {
      return;
    }

    fiveWhysScaffoldSessionRef.current.add(selectedSession.id);
    setIsWorking(true);
    setErrorMessage('');

    void ensureDefaultFiveWhysScaffold(selectedIncident, selectedSession).then((scaffoldNodes) => {
      if (!scaffoldNodes.length) {
        return;
      }

      const safeScaffoldNodes = arrangeRcaCanvasNodes(scaffoldNodes, '5_WHYS');

      nodesCanvasKeyRef.current = canvasKey;
      lastNonEmptyNodesByCanvasRef.current.set(canvasKey, cloneRcaNodes(safeScaffoldNodes));
      setNodes(safeScaffoldNodes);
      setSelectedNodeId(safeScaffoldNodes[0]?.id || null);
      setSelectedFlowNodeIds(new Set(safeScaffoldNodes[0]?.id ? [safeScaffoldNodes[0].id] : []));
      fitVisibleProjectIntoView({ delay: 160, force: true, padding: 0.18 });
    }).catch((error) => {
      fiveWhysScaffoldSessionRef.current.delete(selectedSession.id);
      setErrorMessage(getErrorMessage(error));
    }).finally(() => {
      setIsWorking(false);
    });
  }, [isLoadingSession, isReferenceProjectActive, isWorking, nodes.length, selectedIncident, selectedSession, workspaceView]);

  React.useEffect(() => {
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

    setSelectedFlowNodeIds((currentSelection) => {
      const nextSelection = new Set([...currentSelection].filter((nodeId) => visibleNodeIds.has(nodeId)));

      return nextSelection.size === currentSelection.size ? currentSelection : nextSelection;
    });

    setSelectedNodeId((currentSelectedNodeId) => (
      currentSelectedNodeId && visibleNodeIds.has(currentSelectedNodeId) ? currentSelectedNodeId : null
    ));

    setNodeStyleEditor((currentEditor) => (
      currentEditor && !visibleNodeIds.has(currentEditor.nodeId) ? null : currentEditor
    ));
    setSplineStyleEditor((currentEditor) => (
      currentEditor && !visibleNodeIds.has(currentEditor.nodeId) ? null : currentEditor
    ));
  }, [visibleNodes]);

  React.useEffect(() => {
    return rcaRealtimeClient.subscribe((event) => {
      if (event.type === 'status') {
        setRealtimeStatus(event.status);
        return;
      }

      if (event.type === 'error') {
        setErrorMessage(event.error);
        return;
      }

      if (event.type === 'presenceUpdated') {
        setRealtimeParticipants(event.participants);
        return;
      }

      if (event.type === 'nodeActivitiesUpdated') {
        setNodeActivities(event.activities);
        return;
      }

      if (event.type === 'incidentMembershipChanged') {
        const currentContext = contextRef.current;
        const currentUid = currentContext?.user.uid || '';
        const normalizedIncident = normalizeRcaIncidentAccessForUser(event.incident, currentUid);
        const removedUserUid = event.removedUser?.uid || '';
        const isCurrentUserRemoved = event.action === 'REMOVED' && removedUserUid === currentUid;
        const isCurrentIncidentDeleted = event.action === 'DELETED';

        setWorkspace((currentWorkspace) => {
          if (!currentWorkspace) {
            return currentWorkspace;
          }

          if (isCurrentUserRemoved || isCurrentIncidentDeleted) {
            return {
              ...currentWorkspace,
              incidents: currentWorkspace.incidents.filter((incident) => incident.id !== normalizedIncident.id)
            };
          }

          const hasIncident = currentWorkspace.incidents.some((incident) => incident.id === normalizedIncident.id);

          return {
            ...currentWorkspace,
            incidents: hasIncident
              ? currentWorkspace.incidents.map((incident) => (
                  incident.id === normalizedIncident.id ? normalizedIncident : incident
                ))
              : [normalizedIncident, ...currentWorkspace.incidents]
          };
        });

        if (event.action === 'INVITED') {
          setCollaboratorCandidates((currentUsers) => currentUsers.filter((user) => (
            !event.invitedUsers.some((invitedUser) => invitedUser.uid === user.uid)
          )));
        }

        if (event.action === 'REMOVED' && event.removedUser) {
          setCollaboratorCandidates((currentUsers) => (
            currentUsers.some((user) => user.uid === event.removedUser?.uid)
              ? currentUsers
              : [...currentUsers, event.removedUser as RcaUserSummary].sort((first, second) => first.displayName.localeCompare(second.displayName))
          ));
        }

        if (isCurrentIncidentDeleted && selectedIncidentId === normalizedIncident.id) {
          rcaRealtimeClient.unsubscribeCanvas();
          activeRealtimeCanvasRef.current = null;
          setWorkspaceView('dashboard');
          setSelectedIncidentId(null);
          setSelectedSessionId(null);
          setSessions([]);
          resetActiveCanvasState(null);
          setErrorMessage(`The RCA project "${normalizedIncident.title}" was deleted and is no longer available.`);
        }

        if (isCurrentUserRemoved) {
          rcaRealtimeClient.unsubscribeCanvas();
          activeRealtimeCanvasRef.current = null;
          setWorkspaceView('dashboard');
          setSelectedIncidentId(null);
          setSelectedSessionId(null);
          setSessions([]);
          resetActiveCanvasState(null);
          setRemovedAccessNotice({
            incident: normalizedIncident,
            removedAtIso: event.removedAtIso || new Date().toISOString(),
            removedByName: normalizedIncident.owner?.displayName || 'The RCA project owner'
          });
        }
        return;
      }

      const activeCanvas = activeRealtimeCanvasRef.current;

      if (
        !activeCanvas ||
        ('incidentId' in event && event.incidentId !== activeCanvas.incidentId) ||
        ('sessionId' in event && event.sessionId !== activeCanvas.sessionId)
      ) {
        return;
      }

      if (event.type === 'activityLogCreated') {
        setActivityLogs((currentLogs) => {
          if (currentLogs.some((log) => log.id === event.log.id)) {
            return currentLogs;
          }

          return [event.log, ...currentLogs].slice(0, 100);
        });
        return;
      }

      if (event.type === 'nodeTextSync' || event.type === 'nodeTextUpdate') {
        if (!event.nodeId || !event.update) {
          return;
        }

        const docKey = `${event.sessionId}:${event.nodeId}`;
        let doc = liveLabelDocsRef.current.get(docKey);

        if (!doc) {
          doc = new Y.Doc();
          liveLabelDocsRef.current.set(docKey, doc);
        }

        Y.applyUpdate(doc, decodeRcaRealtimeUpdate(event.update), 'remote');
        const nextLabel = event.type === 'nodeTextUpdate' && event.label !== null
          ? event.label
          : doc.getText('label').toString();

        setLiveNodeLabels((currentLabels) => {
          const nextLabels = new Map(currentLabels);
          nextLabels.set(event.nodeId, nextLabel);
          return nextLabels;
        });
        return;
      }

      if (event.type === 'nodeLiveLabelUpdated') {
        setLiveNodeLabels((currentLabels) => {
          const nextLabels = new Map(currentLabels);
          nextLabels.set(event.nodeId, event.label);
          return nextLabels;
        });
        return;
      }

      if (event.type === 'canvasSnapshot') {
        const canvasKey = getRcaCanvasStateKey(event.incidentId, event.sessionId);
        const safeSnapshotNodes = sanitizeRcaCanvasNodes(event.nodes);
        const isCurrentlyLoadedCanvas = nodesCanvasKeyRef.current === canvasKey;

        setNodes((currentNodes) => {
          if (!safeSnapshotNodes.length) {
            const lastKnownNodes = lastNonEmptyNodesByCanvasRef.current.get(canvasKey);

            nodesCanvasKeyRef.current = canvasKey;

            if (!isCurrentlyLoadedCanvas) {
              return [];
            }

            if (currentNodes.length && isCurrentlyLoadedCanvas) {
              setErrorMessage('Realtime canvas snapshot was empty, so the current canvas was preserved.');
              return currentNodes;
            }

            if (lastKnownNodes?.length && isCurrentlyLoadedCanvas) {
              setErrorMessage('Realtime canvas snapshot was empty, so the last known canvas was restored.');
              return cloneRcaNodes(lastKnownNodes);
            }

            return currentNodes;
          }

          if (safeSnapshotNodes.length) {
            nodesCanvasKeyRef.current = canvasKey;
            lastNonEmptyNodesByCanvasRef.current.set(canvasKey, cloneRcaNodes(safeSnapshotNodes));
          }

          return safeSnapshotNodes;
        });
        setRealtimeParticipants(event.participants);
        return;
      }

      if (event.type === 'nodeCreated') {
        const safeNode = sanitizeRcaCanvasNode(event.node);

        if (!safeNode) {
          setErrorMessage('Realtime node update contained invalid coordinates and was ignored.');
          return;
        }

        setNodes((currentNodes) => {
          if (currentNodes.some((node) => node.id === safeNode.id)) {
            return currentNodes.map((node) => (node.id === safeNode.id ? safeNode : node));
          }

          return mergeRcaCanvasNodes(currentNodes, [safeNode]);
        });
        return;
      }

      if (event.type === 'nodeUpdated') {
        const safeNode = sanitizeRcaCanvasNode(event.node);

        if (!safeNode) {
          setErrorMessage('Realtime node update contained invalid coordinates and was ignored.');
          return;
        }

        setNodes((currentNodes) => {
          if (!currentNodes.some((node) => node.id === safeNode.id)) {
            return mergeRcaCanvasNodes(currentNodes, [safeNode]);
          }

          return currentNodes.map((node) => (node.id === safeNode.id ? safeNode : node));
        });
        return;
      }

      if (event.type === 'nodeDeleted') {
        setNodes((currentNodes) => currentNodes.filter((node) => node.id !== event.nodeId));
        setSelectedNodeId((currentNodeId) => (currentNodeId === event.nodeId ? null : currentNodeId));
        setInspectedNodeId((currentNodeId) => (currentNodeId === event.nodeId ? null : currentNodeId));
        setSelectedFlowNodeIds((currentNodeIds) => {
          if (!currentNodeIds.has(event.nodeId)) {
            return currentNodeIds;
          }

          const nextNodeIds = new Set(currentNodeIds);
          nextNodeIds.delete(event.nodeId);
          return nextNodeIds;
        });
      }
    });
  }, []);

  React.useEffect(() => {
    rcaRealtimeClient.connect();
    rcaRealtimeClient.subscribeWorkspace();
  }, []);

  React.useEffect(() => {
    if (isReferenceProjectActive || !selectedIncidentId || !selectedSessionId) {
      activeRealtimeCanvasRef.current = null;
      setRealtimeParticipants([]);
      setNodeActivities([]);
      setLiveNodeLabels(new Map());
      liveLabelDocsRef.current.clear();
      setRealtimeStatus('disconnected');
      rcaRealtimeClient.unsubscribeCanvas();
      return;
    }

    activeRealtimeCanvasRef.current = {
      incidentId: selectedIncidentId,
      sessionId: selectedSessionId
    };
    rcaRealtimeClient.connect();
    rcaRealtimeClient.subscribeCanvas(selectedIncidentId, selectedSessionId);

    return () => {
      activeRealtimeCanvasRef.current = null;
      rcaRealtimeClient.unsubscribeCanvas();
    };
  }, [isReferenceProjectActive, selectedIncidentId, selectedSessionId]);

  async function createCollaborativeRcaNode(
    incidentId: string,
    sessionId: string,
    input: RcaNodeInput = {}
  ): Promise<RcaNode> {
    if (rcaRealtimeClient.isReadyForCanvas(incidentId, sessionId)) {
      return rcaRealtimeClient.createNode(incidentId, sessionId, input);
    }

    return createRcaNodeHttp(incidentId, sessionId, input);
  }

  async function updateCollaborativeRcaNode(
    incidentId: string,
    sessionId: string,
    nodeId: string,
    input: RcaNodeInput
  ): Promise<RcaNode> {
    if (rcaRealtimeClient.isReadyForCanvas(incidentId, sessionId)) {
      return rcaRealtimeClient.updateNode(incidentId, sessionId, nodeId, input);
    }

    return updateRcaNodeHttp(incidentId, sessionId, nodeId, input);
  }

  async function handleInlineNodeCommit(nodeId: string, input: RcaNodeInput): Promise<RcaNode> {
    if (!selectedIncident || !selectedSession) {
      throw new Error('Select an RCA project before editing a node.');
    }

    const updatedNode = await updateCollaborativeRcaNode(selectedIncident.id, selectedSession.id, nodeId, input);
    const nextNodes = nodes.map((node) => (
      node.id === updatedNode.id
        ? {
            ...updatedNode,
            uiCoordinates: node.uiCoordinates
          }
        : node
    ));

    setNodes(nextNodes);

    return updatedNode;
  }

  async function deleteCollaborativeRcaNode(
    incidentId: string,
    sessionId: string,
    nodeId: string
  ): Promise<void> {
    if (rcaRealtimeClient.isReadyForCanvas(incidentId, sessionId)) {
      await rcaRealtimeClient.deleteNode(incidentId, sessionId, nodeId);
      return;
    }

    await deleteRcaNodeHttp(incidentId, sessionId, nodeId);
  }

  async function loadWorkspace() {
    const endLoading = appLoading.beginLoading({
      detail: 'Loading project list, ownership, risk status, and collaboration access',
      message: 'Preparing RCA projects',
      scope: 'rca',
      title: 'Loading RCA workspace'
    });
    setIsLoading(true);
    setErrorMessage('');

    try {
      const nextWorkspace = await listRcaIncidents();
      setWorkspace(nextWorkspace);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      endLoading();
      setIsLoading(false);
    }
  }

  async function loadIncidentSessions(incidentId: string) {
    const endLoading = appLoading.beginLoading({
      detail: 'Loading methodology sessions and canvas entry points',
      message: 'Opening RCA investigation',
      scope: 'rca',
      title: 'Loading RCA project'
    });
    setIsLoadingSession(true);
    setErrorMessage('');

    try {
      const response = await listRcaSessions(incidentId);
      const activeIncident = workspace?.incidents.find((incident) => incident.id === incidentId);
      let loadedSessions = response.sessions;
      let mainViewSession = loadedSessions.find((session) => session.methodology === 'ISHIKAWA') || null;

      if (!mainViewSession && activeIncident?.accessRole !== 'INVITED') {
        mainViewSession = await createRcaSession(incidentId, { methodology: 'ISHIKAWA' });
        loadedSessions = [mainViewSession, ...loadedSessions];
      }

      const activeSession = activeIncident?.activeSessionId
        ? loadedSessions.find((session) => session.id === activeIncident.activeSessionId && session.methodology === 'ISHIKAWA')
        : null;

      setSessions(loadedSessions);
      setSelectedSessionId((currentSessionId) => {
        if (currentSessionId && loadedSessions.some((session) => (
          session.id === currentSessionId &&
          session.methodology === 'ISHIKAWA'
        ))) {
          return currentSessionId;
        }

        return mainViewSession?.id || activeSession?.id || loadedSessions.find((session) => session.methodology === 'ISHIKAWA')?.id || null;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSessions([]);
      setSelectedSessionId(null);
    } finally {
      endLoading();
      setIsLoadingSession(false);
    }
  }

  async function loadNodes(incidentId: string, sessionId: string, options: { clearOnError?: boolean } = {}) {
    const shouldClearOnError = options.clearOnError ?? true;
    const endLoading = appLoading.beginLoading({
      detail: 'Loading nodes, evidence links, canvas structure, and collaboration state',
      message: 'Preparing RCA canvas',
      scope: 'rca',
      title: 'Loading RCA canvas'
    });

    setIsLoadingSession(true);
    setErrorMessage('');

    try {
      const response = await listRcaNodes(incidentId, sessionId);
      const safeNodes = sanitizeRcaCanvasNodes(response.nodes);
      const canvasKey = getRcaCanvasStateKey(incidentId, sessionId);
      const isCurrentlyLoadedCanvas = nodesCanvasKeyRef.current === canvasKey;

      if (!safeNodes.length) {
        const lastKnownNodes = lastNonEmptyNodesByCanvasRef.current.get(canvasKey);

        nodesCanvasKeyRef.current = canvasKey;

        if (nodesRef.current.length && isCurrentlyLoadedCanvas) {
          setErrorMessage('Canvas reload returned no nodes, so the current canvas was preserved.');
        } else if (lastKnownNodes?.length && isCurrentlyLoadedCanvas) {
          setErrorMessage('Canvas reload returned no nodes, so the last known canvas was restored.');
          setNodes(cloneRcaNodes(lastKnownNodes));
        } else {
          setNodes([]);
        }
      } else {
        nodesCanvasKeyRef.current = canvasKey;
        lastNonEmptyNodesByCanvasRef.current.set(canvasKey, cloneRcaNodes(safeNodes));
        setNodes(safeNodes);
      }
      resetCanvasHistory();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));

      if (shouldClearOnError) {
        setNodes([]);
      }
    } finally {
      endLoading();
      setIsLoadingSession(false);
    }
  }

  async function loadActivityLogs(incidentId: string, sessionId: string) {
    const endLoading = appLoading.beginLoading({
      detail: 'Loading audit events, collaborator actions, and canvas history',
      message: 'Refreshing RCA activity',
      scope: 'rca',
      title: 'Loading RCA activity'
    });
    setIsLoadingActivityLogs(true);

    try {
      const response = await listRcaActivityLogs(incidentId, sessionId);
      setActivityLogs(response.logs);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setActivityLogs([]);
    } finally {
      endLoading();
      setIsLoadingActivityLogs(false);
    }
  }

  async function recordCanvasActivity(input: {
    action: RcaActivityLogAction;
    nextValue?: string;
    previousValue?: string;
    summary?: string;
  }) {
    if (!selectedIncident || !selectedSession || isReferenceProjectActive) {
      return;
    }

    try {
      const response = await recordRcaActivityLog(selectedIncident.id, selectedSession.id, input);

      setActivityLogs((currentLogs) => (
        currentLogs.some((log) => log.id === response.log.id)
          ? currentLogs
          : [response.log, ...currentLogs].slice(0, 100)
      ));
    } catch {
      // Audit refresh should not block the user's completed canvas action.
    }
  }

  async function handleRefreshCanvas() {
    closeNodeStyleEditor();
    setAlignmentGuides([]);

    if (isReferenceProjectActive) {
      fitVisibleProjectIntoView({ delay: 80, force: true, padding: 0.16 });
      return;
    }

    if (!selectedIncident || !selectedSession) {
      return;
    }

    await Promise.all([
      loadNodes(selectedIncident.id, selectedSession.id, { clearOnError: false }),
      loadActivityLogs(selectedIncident.id, selectedSession.id)
    ]);
    fitVisibleProjectIntoView({ delay: 140, force: true, padding: 0.16 });
  }

  async function handleCreateIncident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isWorking) {
      return;
    }

    setIsWorking(true);
    setErrorMessage('');

    try {
      const incidentTitle = incidentDraft.title.trim().slice(0, RCA_INCIDENT_TITLE_MAX_LENGTH);

      if (!incidentTitle) {
        setErrorMessage('Enter a project title before opening the war room.');
        return;
      }

      const result = await createRcaIncident({
        title: incidentTitle
      });
      const refreshedWorkspace = await listRcaIncidents();
      const nextCanvasKey = result.session ? getRcaCanvasStateKey(result.incident.id, result.session.id) : null;

      resetActiveCanvasState(nextCanvasKey);
      setWorkspace(refreshedWorkspace);
      setSelectedIncidentId(result.incident.id);
      setWorkspaceView('canvas');
      setIncidentDraft({
        title: ''
      });

      if (result.session) {
        setSessions([result.session]);
        setSelectedSessionId(result.session.id);
      }

      setIsReferenceProjectActive(false);
      setIsIncidentLauncherOpen(false);
      setIsIncidentShelfOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateSession() {
    if (!selectedIncident || isReferenceProjectActive || isWorking) {
      return;
    }

    setIsWorking(true);
    setErrorMessage('');

    try {
      const session = await createRcaSession(selectedIncident.id, { methodology: 'ISHIKAWA' });
      resetActiveCanvasState(getRcaCanvasStateKey(selectedIncident.id, session.id));
      setSessions((currentSessions) => [session, ...currentSessions]);
      setSelectedSessionId(session.id);
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMethodologyChange(methodology: RcaMethodology) {
    if (isReferenceProjectActive) {
      setReferenceMethodology(methodology);
      setSelectedNodeId(null);
      setSelectedFlowNodeIds(new Set());
      return;
    }

    if (!selectedIncident || isWorking) {
      return;
    }

    if (selectedSession?.methodology === methodology) {
      return;
    }

    const existingMethodologySession = sessions.find((session) => (
      session.incidentId === selectedIncident.id &&
      session.methodology === methodology
    ));

    setSelectedNodeId(null);
    setSelectedFlowNodeIds(new Set());
    setErrorMessage('');

    if (existingMethodologySession) {
      resetActiveCanvasState(getRcaCanvasStateKey(selectedIncident.id, existingMethodologySession.id));
      setSelectedSessionId(existingMethodologySession.id);
      return;
    }

    setIsWorking(true);

    try {
      const session = await createRcaSession(selectedIncident.id, { methodology });
      resetActiveCanvasState(getRcaCanvasStateKey(selectedIncident.id, session.id));

      setSessions((currentSessions) => {
        if (currentSessions.some((currentSession) => currentSession.id === session.id)) {
          return currentSessions.map((currentSession) => (
            currentSession.id === session.id ? session : currentSession
          ));
        }

        return [session, ...currentSessions];
      });
      setSelectedSessionId(session.id);
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function ensureDefaultFiveWhysScaffold(
    incident: RcaIncident,
    session: RcaSession,
    anchorCoordinates?: { x: number; y: number } | null
  ): Promise<RcaNode[]> {
    const refreshedNodes = sanitizeRcaCanvasNodes((await listRcaNodes(incident.id, session.id)).nodes);

    if (refreshedNodes.length) {
      return refreshedNodes;
    }

    const createdNodes: RcaNode[] = [];
    let parentNodeId: string | null = null;
    const defaultAnchor = getFiveWhysDefaultPosition(0);
    const anchorDelta = anchorCoordinates
      ? {
          x: anchorCoordinates.x - defaultAnchor.x,
          y: anchorCoordinates.y - defaultAnchor.y
        }
      : { x: 0, y: 0 };

    for (const [stageIndex, stage] of RCA_FIVE_WHYS_SCAFFOLD.entries()) {
      const isCapaStage = stage.role === 'CAPA';
      const defaultPosition = getFiveWhysDefaultPosition(stageIndex);
      const createdNode = await createCollaborativeRcaNode(incident.id, session.id, {
        edgeStyle: {
          arrowHead: 'CLOSED_FILLED',
          color: isCapaStage ? '#10b981' : '#64748b',
          lineType: 'CONTINUOUS',
          weight: isCapaStage ? 2.6 : 2
        },
        fiveWhysRole: stage.role,
        isSuspectedCause: false,
        label: stageIndex === 0
          ? incident.title.trim()
          : stage.label,
        nodeType: 'WHY',
        parentNodeId,
        uiCoordinates: {
          layoutMethodology: '5_WHYS',
          x: defaultPosition.x + anchorDelta.x,
          y: defaultPosition.y + anchorDelta.y
        },
        visualStyle: stage.visualStyle,
        whyChain: []
      });
      const safeNode = sanitizeRcaCanvasNode(createdNode);

      if (!safeNode) {
        throw new Error('The 5 Whys scaffold could not be placed on the canvas.');
      }

      createdNodes.push(safeNode);
      parentNodeId = safeNode.id;
    }

    return createdNodes;
  }

  async function handleIncidentTitleChange(title: string) {
    const nextTitle = title.trim();

    if (!selectedIncident || !nextTitle || nextTitle === selectedIncident.title) {
      return;
    }

    if (isReferenceProjectActive) {
      setReferenceIncidentTitle(nextTitle);
      return;
    }

    setErrorMessage('');

    try {
      const updatedIncident = await updateRcaIncident(selectedIncident.id, { title: nextTitle });

      setWorkspace((currentWorkspace) => currentWorkspace
        ? {
            ...currentWorkspace,
            incidents: currentWorkspace.incidents.map((incident) => (
              incident.id === updatedIncident.id ? updatedIncident : incident
            ))
          }
        : currentWorkspace);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    }
  }

  async function ensureDefaultFishboneScaffold(
    currentNodes: RcaNode[],
    preferredFaultGate?: RcaNode
  ): Promise<{ faultGateId: string; nodes: RcaNode[] }> {
    if (!selectedIncident || !selectedSession) {
      throw new Error('Select an RCA project before creating the fishbone.');
    }

    let workingNodes = [...currentNodes];
    let faultGate = preferredFaultGate || workingNodes.find((node) => node.nodeType === 'FAULT_GATE');

    if (!faultGate) {
      const initialFaultGateLabel = selectedIncident.title || '';
      const initialFaultGateSize = getRcaNodeSize({
        attachedEvidence: [],
        createdAtIso: null,
        edgeStyle: undefined,
        id: 'pending-fault-gate',
        isRootCause: false,
        isSuspectedCause: false,
        label: initialFaultGateLabel,
        lockedAtIso: null,
        lockedBy: null,
        nodeType: 'FAULT_GATE',
        parentNodeId: null,
        status: 'ACTIVE',
        uiCoordinates: {
          layoutMethodology: 'ISHIKAWA',
          x: 2050,
          y: 0
        },
        updatedAtIso: null,
        visualStyle: undefined,
        whyChain: []
      });

      faultGate = await createCollaborativeRcaNode(selectedIncident.id, selectedSession.id, {
        label: initialFaultGateLabel,
        nodeType: 'FAULT_GATE',
        parentNodeId: null,
        uiCoordinates: {
          layoutMethodology: 'ISHIKAWA',
          x: 2050,
          y: RCA_FISHBONE_SPINE_Y - initialFaultGateSize.height / 2
        }
      });
      workingNodes = [...workingNodes, faultGate];
    }

    const defaultCategoryLabels = new Set(RCA_DEFAULT_FISHBONE_CATEGORIES.map((category) => (
      normalizeFishboneCategoryName(category.label)
    )));
    const existingDefaultCategoryLabels = new Set(workingNodes
      .filter((node) => node.nodeType === 'ISHIKAWA_CATEGORY')
      .map((node) => normalizeFishboneCategoryName(node.label))
      .filter((label) => defaultCategoryLabels.has(label)));
    const missingCategories = RCA_DEFAULT_FISHBONE_CATEGORIES.filter((category) => (
      !existingDefaultCategoryLabels.has(normalizeFishboneCategoryName(category.label))
    ));
    const createdCategories = await Promise.all(missingCategories.map((category, categoryIndex) => {
      const slot = RCA_FISHBONE_CATEGORY_LAYOUTS[RCA_DEFAULT_FISHBONE_CATEGORIES.findIndex((item) => (
        item.label === category.label
      ))] || RCA_FISHBONE_CATEGORY_LAYOUTS[categoryIndex];

      return createCollaborativeRcaNode(selectedIncident.id, selectedSession.id, {
        label: category.label,
        nodeType: 'ISHIKAWA_CATEGORY',
        parentNodeId: faultGate.id,
        uiCoordinates: {
          layoutMethodology: 'ISHIKAWA',
          x: slot?.x ?? RCA_FISHBONE_FIRST_COLUMN_X,
          y: slot?.y ?? RCA_FISHBONE_TOP_CATEGORY_Y
        }
      });
    }));

    const nodesBeforeScaffoldNormalization = [...workingNodes, ...createdCategories];
    const nodeBeforeScaffoldNormalizationById = new Map(nodesBeforeScaffoldNormalization.map((node) => [node.id, node]));

    workingNodes = nodesBeforeScaffoldNormalization.map((node) => {
      if (node.id === faultGate.id) {
        return {
          ...node,
          nodeType: 'FAULT_GATE',
          parentNodeId: null
        };
      }

      if (
        node.nodeType === 'ISHIKAWA_CATEGORY' &&
        defaultCategoryLabels.has(normalizeFishboneCategoryName(node.label))
      ) {
        return {
          ...node,
          parentNodeId: faultGate.id
        };
      }

      return node;
    });

    const arrangedNodes = arrangeRcaCanvasNodes(workingNodes, 'ISHIKAWA');
    const persistedNodes = await Promise.all(arrangedNodes.map((node) => {
      const nodeBeforeNormalization = nodeBeforeScaffoldNormalizationById.get(node.id);
      const needsParentUpdate = nodeBeforeNormalization?.parentNodeId !== node.parentNodeId;
      const needsCoordinateUpdate = !nodeBeforeNormalization ||
        nodeBeforeNormalization.uiCoordinates.layoutMethodology !== node.uiCoordinates.layoutMethodology ||
        nodeBeforeNormalization.uiCoordinates.x !== node.uiCoordinates.x ||
        nodeBeforeNormalization.uiCoordinates.y !== node.uiCoordinates.y;

      if (!needsParentUpdate && !needsCoordinateUpdate) {
        return Promise.resolve(node);
      }

      return updateCollaborativeRcaNode(selectedIncident.id, selectedSession.id, node.id, {
        parentNodeId: node.parentNodeId,
        uiCoordinates: node.uiCoordinates
      });
    }));
    const persistedNodeById = new Map(persistedNodes.map((node) => [node.id, node]));

    return {
      faultGateId: faultGate.id,
      nodes: arrangedNodes.map((node) => persistedNodeById.get(node.id) || node)
    };
  }

  async function handleAddNode({
    coordinates,
    fiveWhysNodeRole,
    nodeType,
    parentNodeId,
    skipAutoArrange = false
  }: RcaAddNodeRequest = {}) {
    if (!selectedIncident || !selectedSession || isReferenceProjectActive || isWorking) {
      return;
    }

    const isIncidentNodeRequest = fiveWhysNodeRole === 'INCIDENT';
    const hasIncidentNode = nodes.some((node) => getFiveWhysNodeRole(node) === 'INCIDENT');

    if (!isIncidentNodeRequest && !hasIncidentNode) {
      setErrorMessage('Create the Incident node before adding other RCA nodes.');
      return;
    }

    if (isIncidentNodeRequest && hasIncidentNode) {
      setErrorMessage('This RCA canvas already has an Incident node.');
      return;
    }

    setIsWorking(true);
    setErrorMessage('');
    const historySnapshot = cloneRcaNodes(nodes);

    try {
      const workspaceBounds = workspaceRootRef.current?.getBoundingClientRect();
      const visibleCanvasCenter = workspaceBounds
        ? reactFlow.screenToFlowPosition({
          x: workspaceBounds.left + workspaceBounds.width / 2,
          y: workspaceBounds.top + workspaceBounds.height / 2
        })
        : null;
      const placementCoordinates = coordinates || visibleCanvasCenter;
      const isStickyNoteRequest = nodeType === 'STICKY_NOTE';
      const persistedNodeType = isStickyNoteRequest
        ? 'STICKY_NOTE'
        : fiveWhysNodeRole
          ? 'WHY'
          : nodeType || getDefaultNodeType(selectedSession.methodology);
      const resolvedParentNodeId = parentNodeId !== undefined
        ? parentNodeId
        : null;
      const shouldPreserveManualPlacement = isStickyNoteRequest || skipAutoArrange || Boolean(fiveWhysNodeRole);

      if (
        selectedSession.methodology === '5_WHYS' &&
        fiveWhysNodeRole === 'PROBLEM' &&
        nodes.length === 0
      ) {
        const scaffoldNodes = await ensureDefaultFiveWhysScaffold(
          selectedIncident,
          selectedSession,
          placementCoordinates || getFiveWhysDefaultPosition(0)
        );

        if (!scaffoldNodes.length) {
          throw new Error('The 5 Whys structure could not be created.');
        }

        const canvasKey = getRcaCanvasStateKey(selectedIncident.id, selectedSession.id);

        recordCanvasHistory(historySnapshot);
        nodesCanvasKeyRef.current = canvasKey;
        lastNonEmptyNodesByCanvasRef.current.set(canvasKey, cloneRcaNodes(scaffoldNodes));
        fiveWhysScaffoldSessionRef.current.add(selectedSession.id);
        setNodes(scaffoldNodes);
        setSelectedNodeId(scaffoldNodes[0]?.id || null);
        setSelectedFlowNodeIds(new Set(scaffoldNodes[0]?.id ? [scaffoldNodes[0].id] : []));
        fitVisibleProjectIntoView({ delay: 160, force: true, padding: 0.18 });
        return;
      }

      if (
        selectedSession.methodology === 'ISHIKAWA' &&
        !resolvedParentNodeId &&
        !skipAutoArrange &&
        shouldEnsureDefaultFishboneScaffold(nodes)
      ) {
        const scaffold = await ensureDefaultFishboneScaffold(nodes);

        recordCanvasHistory(historySnapshot);
        setNodes(scaffold.nodes);
        setSelectedNodeId(scaffold.faultGateId);
        setSelectedFlowNodeIds(new Set([scaffold.faultGateId]));
        fitVisibleProjectIntoView({ delay: 140, force: true, padding: 0.16 });
        return;
      }

      const createdNode = await createCollaborativeRcaNode(selectedIncident.id, selectedSession.id, {
        detailFields: fiveWhysNodeRole ? buildDefaultRcaNodeDetailFields(fiveWhysNodeRole, selectedIncident) : {},
        fiveWhysRole: fiveWhysNodeRole || null,
        label: fiveWhysNodeRole ? getDefaultRcaNodeRoleLabel(fiveWhysNodeRole, selectedIncident) : '',
        nodeType: persistedNodeType,
        parentNodeId: isStickyNoteRequest || fiveWhysNodeRole ? null : resolvedParentNodeId,
        dimensions: isStickyNoteRequest ? {
          height: RCA_STICKY_NOTE_MIN_HEIGHT,
          width: 248
        } : undefined,
        uiCoordinates: {
          layoutMethodology: selectedSession.methodology,
          x: placementCoordinates?.x ?? 180 + (nodes.length % 4) * 320,
          y: placementCoordinates?.y ?? 120 + Math.floor(nodes.length / 4) * 180
        },
        visualStyle: isStickyNoteRequest ? {
          backgroundColor: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.backgroundColor,
          borderColor: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.borderColor,
          fontFamily: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.fontFamily,
          fontSize: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.fontSize,
          isBold: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.isBold,
          isItalic: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.isItalic,
          isUnderline: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.isUnderline,
          textColor: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.textColor
        } : fiveWhysNodeRole ? RCA_FIVE_WHYS_ROLE_VISUAL_STYLE[fiveWhysNodeRole] : undefined
      });

      const node = sanitizeRcaCanvasNode(createdNode);

      if (!node) {
        throw new Error('The new RCA node could not be placed on the canvas.');
      }

      if (shouldPreserveManualPlacement) {
        recordCanvasHistory(historySnapshot);
        setNodes((currentNodes) => mergeRcaCanvasNodes(currentNodes, [node]));
      } else if (selectedSession.methodology === 'ISHIKAWA') {
        const nodesWithNewCause = [...nodes, node];
        const arrangedNodes = arrangeRcaCanvasNodes(nodesWithNewCause, 'ISHIKAWA');
        const nodeBeforeLayoutById = new Map(nodesWithNewCause.map((currentNode) => [currentNode.id, currentNode]));

        recordCanvasHistory(historySnapshot);
        setNodes(arrangedNodes);

        const persistedNodes = await Promise.all(arrangedNodes.map((arrangedNode) => {
          const previousNode = nodeBeforeLayoutById.get(arrangedNode.id);
          const shouldPersist =
            !previousNode ||
            previousNode.parentNodeId !== arrangedNode.parentNodeId ||
            previousNode.uiCoordinates.layoutMethodology !== arrangedNode.uiCoordinates.layoutMethodology ||
            previousNode.uiCoordinates.x !== arrangedNode.uiCoordinates.x ||
            previousNode.uiCoordinates.y !== arrangedNode.uiCoordinates.y;

          if (!shouldPersist) {
            return Promise.resolve(arrangedNode);
          }

          return updateCollaborativeRcaNode(selectedIncident.id, selectedSession.id, arrangedNode.id, {
            parentNodeId: arrangedNode.parentNodeId,
            uiCoordinates: arrangedNode.uiCoordinates
          });
        }));
        const persistedNodeById = new Map(persistedNodes.map((persistedNode) => [persistedNode.id, persistedNode]));

        setNodes((currentNodes) => currentNodes.map((currentNode) => persistedNodeById.get(currentNode.id) || currentNode));
      } else {
        recordCanvasHistory(historySnapshot);
        setNodes((currentNodes) => mergeRcaCanvasNodes(currentNodes, [node]));
      }

      if (isStickyNoteRequest) {
        setSelectedNodeId(null);
        setSelectedFlowNodeIds(new Set());
      } else {
        setSelectedNodeId(node.id);
        setSelectedFlowNodeIds(new Set([node.id]));
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleAddFishboneStructure() {
    if (!selectedIncident || !selectedSession || selectedSession.methodology !== 'ISHIKAWA' || isReferenceProjectActive || isWorking) {
      return;
    }

    if (!nodes.some((node) => getFiveWhysNodeRole(node) === 'INCIDENT')) {
      setErrorMessage('Create the Incident node before adding the Fishbone structure.');
      return;
    }

    if (!shouldEnsureDefaultFishboneScaffold(nodes)) {
      return;
    }

    setIsWorking(true);
    setErrorMessage('');
    const historySnapshot = cloneRcaNodes(nodes);

    try {
      const scaffold = await ensureDefaultFishboneScaffold(nodes);
      const canvasKey = getRcaCanvasStateKey(selectedIncident.id, selectedSession.id);

      recordCanvasHistory(historySnapshot);
      nodesCanvasKeyRef.current = canvasKey;
      lastNonEmptyNodesByCanvasRef.current.set(canvasKey, cloneRcaNodes(scaffold.nodes));
      setNodes(scaffold.nodes);
      setSelectedNodeId(scaffold.faultGateId);
      setSelectedFlowNodeIds(new Set([scaffold.faultGateId]));
      fitVisibleProjectIntoView({ delay: 140, force: true, padding: 0.16 });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  function handleFlowNodesChange(changes: NodeChange[]) {
    const selectionChanges = changes
      .filter((change): change is NodeChange & { id: string; selected: boolean } => (
        change.type === 'select' &&
        'id' in change &&
        typeof (change as NodeChange & { selected?: unknown }).selected === 'boolean'
      ));
    const positionChanges = changes
      .filter((change): change is NodeChange & { id: string; position: { x: number; y: number } } => (
        change.type === 'position' &&
        Boolean(change.position) &&
        Number.isFinite(change.position?.x) &&
        Number.isFinite(change.position?.y)
      ));
    const dimensionChanges = changes
      .filter((change): change is NodeChange & { dimensions: { height: number; width: number }; id: string; resizing?: boolean } => (
        change.type === 'dimensions' &&
        Boolean((change as NodeChange & { dimensions?: unknown }).dimensions) &&
        Number.isFinite((change as NodeChange & { dimensions?: { height?: number; width?: number } }).dimensions?.height) &&
        Number.isFinite((change as NodeChange & { dimensions?: { height?: number; width?: number } }).dimensions?.width)
      ));

    if (selectionChanges.length) {
      setSelectedFlowNodeIds((currentSelection) => {
        const nextSelection = new Set(currentSelection);

        selectionChanges.forEach((change) => {
          if (change.selected) {
            nextSelection.add(change.id);
            return;
          }

          nextSelection.delete(change.id);
        });

        setSelectedNodeId((currentSelectedNodeId) => {
          if (currentSelectedNodeId && nextSelection.has(currentSelectedNodeId)) {
            return currentSelectedNodeId;
          }

          return [...nextSelection].find((nodeId) => !isFishboneSpineFlowNodeId(nodeId)) || null;
        });
        setSelectedFlowEdgeIds(getSelectedRcaSplineEdgeIdsForNodeSelection(
          visibleNodes,
          selectedSession?.methodology || 'ISHIKAWA',
          nextSelection
        ));

        return nextSelection;
      });
    }

    if (dimensionChanges.length) {
      const dimensionsByNodeId = new Map<string, { height: number; width: number }>();

      dimensionChanges.forEach((change) => {
        const width = Math.max(1, Math.min(1200, Math.round(change.dimensions.width)));
        const height = Math.max(1, Math.min(1200, Math.round(change.dimensions.height)));

        dimensionsByNodeId.set(change.id, { height, width });
      });

      setMeasuredFlowNodeSizes((currentSizes) => {
        let didChange = false;
        const nextSizes = new Map(currentSizes);

        dimensionsByNodeId.forEach((dimensions, nodeId) => {
          const currentDimensions = nextSizes.get(nodeId);

          if (
            currentDimensions?.height !== dimensions.height ||
            currentDimensions.width !== dimensions.width
          ) {
            nextSizes.set(nodeId, dimensions);
            didChange = true;
          }
        });

        return didChange ? nextSizes : currentSizes;
      });
    }

    if (!positionChanges.length || !selectedSession) {
      return;
    }

    const activeDragNodeIds = activeDragNodeIdsRef.current;
    const scopedPositionChanges = activeDragNodeIds.size
      ? positionChanges.filter((change) => activeDragNodeIds.has(change.id))
      : positionChanges;

    if (!scopedPositionChanges.length) {
      return;
    }

    const draggedPositionChanges = scopedPositionChanges.filter((change) => (
      (change as NodeChange & { dragging?: boolean }).dragging
    ));
    const shouldSnapPositions = isCanvasSnapEnabled;
    const shouldShowAlignmentGuides = isCanvasSnapEnabled && draggedPositionChanges.length > 0;
    let nextAlignmentGuides: RcaAlignmentGuide[] = [];
    let adjustedPositionChanges = scopedPositionChanges;

    if (shouldSnapPositions) {
      const movedNodeIds = new Set(scopedPositionChanges.map((change) => change.id));
      const primaryChange = scopedPositionChanges.find((change) => change.id === selectedNodeId) || scopedPositionChanges[0];
      const primarySnap = getSnappedRcaNodePosition(
        primaryChange.id,
        primaryChange.position,
        visibleNodes,
        selectedSession.methodology,
        movedNodeIds,
        canvasGridSize
      );
      const snapDelta = {
        x: primarySnap.position.x - primaryChange.position.x,
        y: primarySnap.position.y - primaryChange.position.y
      };

      nextAlignmentGuides = shouldShowAlignmentGuides ? primarySnap.guides : [];
      adjustedPositionChanges = scopedPositionChanges.map((change) => ({
        ...change,
        position: {
          x: change.position.x + snapDelta.x,
          y: change.position.y + snapDelta.y
        }
      }));
    }

    setAlignmentGuides(nextAlignmentGuides);

    const positionByNodeId = new Map<string, { x: number; y: number }>();

    adjustedPositionChanges.forEach((change) => {
      const x = sanitizeRcaCanvasCoordinate(change.position.x);
      const y = sanitizeRcaCanvasCoordinate(change.position.y);

      if (x === null || y === null) {
        return;
      }

      positionByNodeId.set(change.id, { x, y });
    });

    if (!positionByNodeId.size) {
      return;
    }

    const spinePositionEntries = [...positionByNodeId].filter(([nodeId]) => isFishboneSpineFlowNodeId(nodeId));
    const spineBackedFaultGatePositions = new Map<string, { x: number; y: number }>();

    spinePositionEntries.forEach(([spineNodeId, position]) => {
      const faultGateId = getFishboneSpineFaultGateId(spineNodeId);
      const faultGateNode = visibleNodes.find((node) => node.id === faultGateId && node.nodeType === 'FAULT_GATE');

      if (!faultGateNode) {
        return;
      }

      const faultGateSize = getRcaNodeSize(faultGateNode);
      const nextFaultGateY = sanitizeRcaCanvasCoordinate(position.y + RCA_FISHBONE_SPINE_CONTROL_HEIGHT / 2 - faultGateSize.height / 2);

      if (nextFaultGateY === null) {
        return;
      }

      spineBackedFaultGatePositions.set(faultGateId, {
        x: sanitizeRcaCanvasCoordinate(faultGateNode.uiCoordinates.x) ?? faultGateNode.uiCoordinates.x,
        y: nextFaultGateY
      });
      positionByNodeId.delete(spineNodeId);
    });

    spineBackedFaultGatePositions.forEach((position, faultGateId) => {
      positionByNodeId.set(faultGateId, position);
    });

    if (!positionByNodeId.size) {
      return;
    }

    if (!isReferenceProjectActive) {
      positionByNodeId.forEach((position, nodeId) => {
        pendingNodePositionUpdatesRef.current.set(nodeId, {
          x: position.x,
          y: position.y
        });
      });
    }

    const updateNodePositions = (currentNodes: RcaNode[]) => currentNodes.map((node) => {
      const position = positionByNodeId.get(node.id);

      if (!position) {
        return node;
      }

      return {
        ...node,
        uiCoordinates: {
          layoutMethodology: selectedSession.methodology,
          x: Math.round(position.x),
          y: Math.round(position.y)
        }
      };
    });

    if (isReferenceProjectActive) {
      setReferenceNodes(updateNodePositions);
      return;
    }

    setNodes(updateNodePositions);
  }

  function handleFlowEdgesChange(changes: EdgeChange[]) {
    const selectionChanges = changes
      .filter((change): change is EdgeChange & { id: string; selected: boolean } => (
        change.type === 'select' &&
        'id' in change &&
        typeof (change as EdgeChange & { selected?: unknown }).selected === 'boolean'
      ));

    if (!selectionChanges.length) {
      return;
    }

    setSelectedFlowEdgeIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      selectionChanges.forEach((change) => {
        if (change.selected) {
          nextSelection.add(change.id);
          return;
        }

        nextSelection.delete(change.id);
      });

      return nextSelection;
    });
  }

  function handleNodeDragStart(_: MouseEvent | TouchEvent, flowNode: FlowNode) {
    dragStartNodesRef.current = cloneRcaNodes(isReferenceProjectActive ? referenceNodes : nodes);
    const activeDragNodeIds = selectedFlowNodeIds.has(flowNode.id) && selectedFlowNodeIds.size > 1
      ? new Set(selectedFlowNodeIds)
      : new Set([flowNode.id]);

    activeDragNodeIdsRef.current = activeDragNodeIds;

    if (
      selectedIncident &&
      selectedSession &&
      !isReferenceProjectActive &&
      rcaRealtimeClient.isReadyForCanvas(selectedIncident.id, selectedSession.id)
    ) {
      activeDragNodeIds.forEach((nodeId) => {
        if (isFishboneSpineFlowNodeId(nodeId)) {
          return;
        }

        rcaRealtimeClient.sendNodeActivity(selectedIncident.id, selectedSession.id, nodeId, 'moving');
      });
    }
  }

  async function handleNodeDragStop(_: MouseEvent | TouchEvent, flowNode: FlowNode) {
    setAlignmentGuides([]);
    const activeDragNodeIds = new Set(activeDragNodeIdsRef.current.size ? activeDragNodeIdsRef.current : [flowNode.id]);
    const draggedNodeIds = new Set(activeDragNodeIds);

    if (isReferenceProjectActive) {
      const finalPosition = isCanvasSnapEnabled
        ? getSnappedRcaNodePosition(
            flowNode.id,
            flowNode.position,
            referenceNodes,
            referenceMethodology,
            draggedNodeIds,
            canvasGridSize
          ).position
        : flowNode.position;

      setReferenceNodes((currentNodes) => currentNodes.map((node) => (
        node.id === flowNode.id
          ? {
              ...node,
              uiCoordinates: {
                layoutMethodology: referenceMethodology,
                x: Math.round(finalPosition.x),
                y: Math.round(finalPosition.y)
              }
            }
          : node
      )));
      dragStartNodesRef.current = null;
      activeDragNodeIdsRef.current.clear();
      return;
    }

    if (!selectedIncident || !selectedSession) {
      dragStartNodesRef.current = null;
      activeDragNodeIdsRef.current.clear();
      return;
    }

    const isSpineDrag = isFishboneSpineFlowNodeId(flowNode.id);
    const currentNode = isSpineDrag
      ? nodes.find((node) => node.id === getFishboneSpineFaultGateId(flowNode.id) && node.nodeType === 'FAULT_GATE')
      : nodes.find((node) => node.id === flowNode.id);

    if (!currentNode) {
      dragStartNodesRef.current = null;
      activeDragNodeIdsRef.current.clear();
      return;
    }

    const finalPosition = isCanvasSnapEnabled && !isSpineDrag
      ? getSnappedRcaNodePosition(
          flowNode.id,
          flowNode.position,
          nodes,
          selectedSession.methodology,
          draggedNodeIds,
          canvasGridSize
        ).position
      : flowNode.position;
    const safeFinalX = sanitizeRcaCanvasCoordinate(finalPosition.x);
    const safeFinalY = sanitizeRcaCanvasCoordinate(isSpineDrag
      ? finalPosition.y + RCA_FISHBONE_SPINE_CONTROL_HEIGHT / 2 - getRcaNodeSize(currentNode).height / 2
      : finalPosition.y);

    if (safeFinalX === null || safeFinalY === null) {
      setErrorMessage('The node move was ignored because the final position was invalid.');
      dragStartNodesRef.current = null;
      activeDragNodeIdsRef.current.clear();
      pendingNodePositionUpdatesRef.current.clear();
      return;
    }

    const nextPositionByNodeId = new Map(
      [...pendingNodePositionUpdatesRef.current].filter(([nodeId]) => activeDragNodeIds.has(nodeId))
    );

    pendingNodePositionUpdatesRef.current.clear();
    nodes.forEach((node) => {
      if (!activeDragNodeIds.has(node.id)) {
        return;
      }

      const x = sanitizeRcaCanvasCoordinate(node.uiCoordinates.x);
      const y = sanitizeRcaCanvasCoordinate(node.uiCoordinates.y);

      if (x === null || y === null) {
        return;
      }

      nextPositionByNodeId.set(node.id, { x, y });
    });
    nextPositionByNodeId.set(currentNode.id, { x: isSpineDrag ? currentNode.uiCoordinates.x : safeFinalX, y: safeFinalY });

    const historySnapshot = dragStartNodesRef.current;
    dragStartNodesRef.current = null;
    activeDragNodeIdsRef.current.clear();

    if (historySnapshot && !areRcaNodeSnapshotsEqual(historySnapshot, nodes)) {
      recordCanvasHistory(historySnapshot);
    }

    const movedNodeCenter = {
      x: safeFinalX + getRcaNodeSize(currentNode).width / 2,
      y: safeFinalY + getRcaNodeSize(currentNode).height / 2
    };
    const optimisticallyMovedNodes = nodes.map((node) => (
      nextPositionByNodeId.has(node.id)
        ? {
            ...node,
            uiCoordinates: {
              layoutMethodology: selectedSession.methodology,
              x: nextPositionByNodeId.get(node.id)?.x ?? node.uiCoordinates.x,
              y: nextPositionByNodeId.get(node.id)?.y ?? node.uiCoordinates.y
            }
          }
        : node
    ));

    setNodes(optimisticallyMovedNodes);
    window.requestAnimationFrame(() => {
      ensureRcaCanvasHasLocalVisibleNodes(reactFlow, workspaceRootRef.current, optimisticallyMovedNodes, selectedSession.methodology, movedNodeCenter);
    });

    const saveRequestId = canvasSaveRequestRef.current + 1;
    canvasSaveRequestRef.current = saveRequestId;
    setIsCanvasAutosaving(true);

    try {
      const updatedNodes = await Promise.all([...nextPositionByNodeId].map(([nodeId, position]) => (
        updateCollaborativeRcaNode(selectedIncident.id, selectedSession.id, nodeId, {
          uiCoordinates: {
            layoutMethodology: selectedSession.methodology,
            x: position.x,
            y: position.y
          }
        })
      )));
      const persistedMovedNodes = mergeRcaCanvasNodes(optimisticallyMovedNodes, updatedNodes);

      setNodes((currentNodes) => (
        currentNodes.length
          ? mergeRcaCanvasNodes(currentNodes, updatedNodes)
          : persistedMovedNodes
      ));
      window.requestAnimationFrame(() => {
        ensureRcaCanvasHasLocalVisibleNodes(reactFlow, workspaceRootRef.current, persistedMovedNodes, selectedSession.methodology, movedNodeCenter);
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      if (historySnapshot) {
        setNodes(historySnapshot);
        window.requestAnimationFrame(() => {
          ensureRcaCanvasHasLocalVisibleNodes(reactFlow, workspaceRootRef.current, historySnapshot, selectedSession.methodology, movedNodeCenter);
        });
      }
    } finally {
      if (rcaRealtimeClient.isReadyForCanvas(selectedIncident.id, selectedSession.id)) {
        activeDragNodeIds.forEach((nodeId) => {
          if (isFishboneSpineFlowNodeId(nodeId)) {
            return;
          }

          rcaRealtimeClient.sendNodeActivity(selectedIncident.id, selectedSession.id, nodeId, 'idle');
        });
      }

      if (canvasSaveRequestRef.current === saveRequestId) {
        setIsCanvasAutosaving(false);
      }
    }
  }

  function isValidRcaCanvasConnection(connection: Edge | Connection): boolean {
    if (!selectedSession) {
      return false;
    }

    return Boolean(getRcaCanvasConnectionChange(connection, nodes, selectedSession.methodology));
  }

  async function applyRcaCanvasConnectionChange(
    connectionChange: RcaCanvasConnectionChange,
    auditIntent?: RcaNodeInput['auditIntent']
  ) {
    if (!selectedIncident || !selectedSession || isReferenceProjectActive || isWorking) {
      return;
    }

    const childNode = nodes.find((node) => node.id === connectionChange.childNodeId);

    if (!childNode || (
      childNode.nodeType !== 'STICKY_NOTE' &&
      childNode.nodeType !== 'WHY' &&
      childNode.nodeType !== 'FAULT_GATE' &&
      !isFishboneCauseNode(childNode)
    )) {
      return;
    }

    if (
      childNode.parentNodeId === connectionChange.parentNodeId &&
      childNode.nodeType === connectionChange.nodeType &&
      getRcaConnectionHandleSignature(childNode.connectionHandles) === getRcaConnectionHandleSignature(connectionChange.connectionHandles)
    ) {
      return;
    }

    const historySnapshot = cloneRcaNodes(nodes);
    const previousSelectedNodeId = selectedNodeId;
    const previousSelectedFlowNodeIds = new Set(selectedFlowNodeIds);
    const nextNodes = nodes.map((node) => (
      node.id === connectionChange.childNodeId
        ? syncRootCauseTypeWithParentCategory({
            ...node,
            connectionHandles: normalizeRcaNodeConnectionHandles(connectionChange.connectionHandles),
            nodeType: connectionChange.nodeType,
            parentNodeId: connectionChange.parentNodeId
          }, nodes)
        : node
    ));
    const nextChildNode = nextNodes.find((node) => node.id === connectionChange.childNodeId);

    setIsWorking(true);
    setErrorMessage('');
    setNodes(nextNodes);
    setSelectedNodeId(connectionChange.childNodeId);
    setSelectedFlowNodeIds(new Set([connectionChange.childNodeId]));

    try {
      const updatedNode = await updateCollaborativeRcaNode(selectedIncident.id, selectedSession.id, connectionChange.childNodeId, {
        auditIntent,
        connectionHandles: normalizeRcaNodeConnectionHandles(connectionChange.connectionHandles),
        ...(nextChildNode?.detailFields ? { detailFields: nextChildNode.detailFields } : {}),
        nodeType: connectionChange.nodeType,
        parentNodeId: connectionChange.parentNodeId
      });

      recordCanvasHistory(historySnapshot);
      setNodes((currentNodes) => currentNodes.map((node) => (
        node.id === updatedNode.id
          ? {
              ...updatedNode,
              uiCoordinates: node.uiCoordinates
            }
          : node
      )));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setNodes(historySnapshot);
      setSelectedNodeId(previousSelectedNodeId);
      setSelectedFlowNodeIds(previousSelectedFlowNodeIds);
    } finally {
      setIsWorking(false);
    }
  }

  function handleCanvasConnect(connection: Connection) {
    if (!selectedSession || !canEditCanvasConnections) {
      return;
    }

    const connectionChange = getRcaCanvasConnectionChange(connection, nodes, selectedSession.methodology);

    if (!connectionChange) {
      return;
    }

    void applyRcaCanvasConnectionChange(connectionChange);
  }

  function handleCanvasReconnect(_: Edge, connection: Connection) {
    if (!selectedSession || !canEditCanvasConnections) {
      return;
    }

    const connectionChange = getRcaCanvasConnectionChange(connection, nodes, selectedSession.methodology);

    if (!connectionChange) {
      return;
    }

    void applyRcaCanvasConnectionChange(connectionChange);
  }

  function handleCanvasReconnectEnd(
    _: MouseEvent | TouchEvent,
    edge: Edge,
    handleType: HandleType,
    connectionState: FinalConnectionState
  ) {
    if (
      handleType !== 'target' ||
      connectionState.toNode ||
      !canEditCanvasConnections
    ) {
      return;
    }

    const childNodeId = getRcaSplineOwnerNodeId(edge, selectedSession?.methodology || 'ISHIKAWA');
    const childNode = nodes.find((node) => node.id === childNodeId);

    void applyRcaCanvasConnectionChange({
      childNodeId,
      connectionHandles: {},
      nodeType: childNode?.nodeType || (
        selectedSession?.methodology === '5_WHYS'
          ? 'WHY'
          : 'CAUSE'
      ),
      parentNodeId: null
    });
  }

  function handleNodePreview(input: RcaNodeEditInput) {
    if (!selectedSession || !inspectedNode || isReferenceProjectActive) {
      return;
    }

    if (!nodeEditHistorySnapshotRef.current.has(inspectedNode.id)) {
      const historySnapshot = cloneRcaNodes(nodes);
      nodeEditHistorySnapshotRef.current.set(inspectedNode.id, historySnapshot);
      recordCanvasHistory(historySnapshot);
    }

    setAlignmentGuides([]);
    setNodes((currentNodes) => {
      const hasOtherFaultGate = input.nodeType === 'FAULT_GATE' && currentNodes.some((node) => (
        node.nodeType === 'FAULT_GATE' && node.id !== inspectedNode.id
      ));

      const nextNodes = currentNodes.map((node) => {
        if (node.id !== inspectedNode.id) {
          return node;
        }

        const nextNodeType = hasOtherFaultGate
          ? node.nodeType
          : input.nodeType ?? node.nodeType;

        return {
          ...node,
          attachedEvidence: input.attachedEvidence ?? node.attachedEvidence,
          detailFields: input.detailFields ?? node.detailFields,
          isRootCause: input.isRootCause ?? node.isRootCause,
          isSuspectedCause: input.isSuspectedCause ?? node.isSuspectedCause,
          label: input.label ?? node.label,
          nodeType: nextNodeType,
          parentNodeId: input.parentNodeId === undefined
            ? node.parentNodeId
            : input.parentNodeId,
          whyChain: input.whyChain ?? node.whyChain
        };
      });

      if (selectedSession.methodology === 'ISHIKAWA') {
        return arrangeRcaCanvasNodes(nextNodes, selectedSession.methodology);
      }

      return nextNodes;
    });
  }

  async function handleNodeSave(input: RcaNodeEditInput) {
    if (!selectedIncident || !selectedSession || !inspectedNode || isReferenceProjectActive || isWorking) {
      return;
    }

    if (input.nodeType === 'FAULT_GATE' && nodes.some((node) => (
      node.nodeType === 'FAULT_GATE' && node.id !== inspectedNode.id
    ))) {
      setErrorMessage('This incident already has a Fault Gate. Create a new incident before starting another Fault Gate.');
      return;
    }

    if (input.isRootCause) {
      const candidateWhyChain = input.whyChain ?? inspectedNode.whyChain;

      if (!hasCompletedFiveWhys(candidateWhyChain)) {
        setErrorMessage('Complete the 5 Whys before confirming a root cause.');
        return;
      }
    }

    setIsWorking(true);
    setErrorMessage('');
    const historySnapshot = nodeEditHistorySnapshotRef.current.get(inspectedNode.id) || cloneRcaNodes(nodes);

    try {
      const previewedNode = nodes.find((node) => node.id === inspectedNode.id);
      const { fiveWhysNodeRole, ...nodeInput } = input;
      const normalizedInput = {
        ...nodeInput,
        fiveWhysRole: nodeInput.nodeType === 'WHY'
          ? fiveWhysNodeRole
          : null,
        parentNodeId: nodeInput.parentNodeId,
        ...(previewedNode ? { uiCoordinates: previewedNode.uiCoordinates } : {})
      };
      const updatedNode = await updateCollaborativeRcaNode(selectedIncident.id, selectedSession.id, inspectedNode.id, normalizedInput);

      const nextNodes = nodes.map((node) => (
        node.id === updatedNode.id
          ? {
              ...updatedNode,
              uiCoordinates: node.uiCoordinates
            }
          : node
      ));

      if (
        selectedSession.methodology === 'ISHIKAWA' &&
        updatedNode.nodeType === 'FAULT_GATE' &&
        shouldEnsureDefaultFishboneScaffold(nextNodes)
      ) {
        const scaffold = await ensureDefaultFishboneScaffold(nextNodes, updatedNode);

        recordCanvasHistory(historySnapshot);
        setNodes(scaffold.nodes);
        setSelectedNodeId(scaffold.faultGateId);
        setSelectedFlowNodeIds(new Set([scaffold.faultGateId]));
        fitVisibleProjectIntoView({ delay: 140, force: true, padding: 0.16 });
        return;
      }

      recordCanvasHistory(historySnapshot);
      setNodes(nextNodes);

      if (
        selectedSession.methodology === 'ISHIKAWA' &&
        (input.parentNodeId !== undefined || input.nodeType !== undefined)
      ) {
        fitVisibleProjectIntoView({ delay: 140, force: true, padding: 0.16 });
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      nodeEditHistorySnapshotRef.current.delete(inspectedNode.id);
      setIsWorking(false);
    }
  }

  async function handleCopyNodeText(nodeId?: string | null) {
    if (!nodeId || !navigator.clipboard?.writeText) {
      return;
    }

    const node = nodes.find((candidateNode) => candidateNode.id === nodeId);
    const selectedText = getCurrentEditableSelectionText().trim();
    const textToCopy = selectedText || node?.label || '';

    if (!textToCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handlePasteNodeText(nodeId?: string | null) {
    if (!selectedIncident || !selectedSession || !nodeId || isReferenceProjectActive || isWorking || !navigator.clipboard?.readText) {
      return;
    }

    const targetNode = nodes.find((candidateNode) => candidateNode.id === nodeId);

    if (!targetNode || !isTextEditableRcaNode(targetNode)) {
      return;
    }

    const historySnapshot = cloneRcaNodes(nodes);

    try {
      const clipboardText = (await navigator.clipboard.readText()).trim();

      if (!clipboardText) {
        return;
      }

      const nextLabel = targetNode.label
        ? `${targetNode.label}${targetNode.label.endsWith('\n') ? '' : '\n'}${clipboardText}`
        : clipboardText;

      setIsWorking(true);
      setErrorMessage('');
      setNodes((currentNodes) => currentNodes.map((node) => (
        node.id === nodeId
          ? { ...node, label: nextLabel }
          : node
      )));

      const updatedNode = await updateCollaborativeRcaNode(selectedIncident.id, selectedSession.id, nodeId, {
        label: nextLabel
      });
      const nextNodes = nodes.map((node) => (
        node.id === updatedNode.id
          ? {
              ...updatedNode,
              uiCoordinates: node.uiCoordinates
            }
          : node
      ));

      recordCanvasHistory(historySnapshot);
      setNodes(nextNodes);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setNodes(historySnapshot);
    } finally {
      setIsWorking(false);
    }
  }

  function handleDeleteNode(nodeId?: string | null) {
    if (!nodeId) {
      return;
    }

    setPendingCanvasDestructiveAction({ kind: 'DELETE_NODE', nodeId });
  }

  function handleDeleteSelectedCanvasItems() {
    if (
      !selectedIncident ||
      !selectedSession ||
      isReferenceProjectActive ||
      isWorking ||
      isEditableShortcutTarget(document.activeElement)
    ) {
      return;
    }

    const hasSelection = selectedFlowNodeIds.size > 0 || selectedFlowEdgeIds.size > 0;

    if (!hasSelection) {
      return;
    }

    setPendingCanvasDestructiveAction({ kind: 'DELETE_SELECTION' });
  }

  function handleClearCanvas() {
    if (!selectedIncident || !selectedSession || isReferenceProjectActive || isWorking || !nodes.length) {
      return;
    }

    setPendingCanvasDestructiveAction({ kind: 'CLEAR_CANVAS' });
  }

  async function executeDeleteNode(nodeId?: string | null) {
    if (!selectedIncident || !selectedSession || !nodeId || isReferenceProjectActive || isWorking) {
      return;
    }

    const targetNode = nodes.find((node) => node.id === nodeId);

    if (targetNode && isProtectedFishboneStructureNode(targetNode)) {
      setErrorMessage(getProtectedFishboneStructureDeleteMessage(targetNode));
      return;
    }

    setIsWorking(true);
    setErrorMessage('');
    const historySnapshot = cloneRcaNodes(nodes);

    try {
      await deleteCollaborativeRcaNode(selectedIncident.id, selectedSession.id, nodeId);
      recordCanvasHistory(historySnapshot);
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setSelectedNodeId((currentNodeId) => currentNodeId === nodeId ? null : currentNodeId);
      setInspectedNodeId((currentNodeId) => currentNodeId === nodeId ? null : currentNodeId);
      setSelectedFlowNodeIds((currentNodeIds) => {
        if (!currentNodeIds.has(nodeId)) {
          return currentNodeIds;
        }

        const nextNodeIds = new Set(currentNodeIds);
        nextNodeIds.delete(nodeId);
        return nextNodeIds;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function executeDeleteSelectedCanvasItems() {
    if (
      !selectedIncident ||
      !selectedSession ||
      isReferenceProjectActive ||
      isWorking ||
      isEditableShortcutTarget(document.activeElement)
    ) {
      return;
    }

    const realSelectedNodeIds = new Set(
      [...selectedFlowNodeIds].filter((nodeId) => !isFishboneSpineFlowNodeId(nodeId))
    );
    const protectedSelectedNodes = nodes.filter((node) => (
      realSelectedNodeIds.has(node.id) &&
      isProtectedFishboneStructureNode(node)
    ));
    const canDeleteSelectedStructure = protectedSelectedNodes.length > 0 &&
      isCompleteFishboneStructureSelection(nodes, selectedFlowNodeIds);

    if (!canDeleteSelectedStructure) {
      protectedSelectedNodes.forEach((node) => realSelectedNodeIds.delete(node.id));
    }

    if (protectedSelectedNodes.length && !canDeleteSelectedStructure) {
      setErrorMessage(getProtectedFishboneStructureDeleteMessage(protectedSelectedNodes[0]));
    }
    const selectedEdgeChildNodeIds = getSelectedRcaSplineChildNodeIds(nodes, selectedSession.methodology, selectedFlowEdgeIds)
      .filter((nodeId) => !realSelectedNodeIds.has(nodeId))
      .filter((nodeId) => {
        const node = nodes.find((candidateNode) => candidateNode.id === nodeId);

        return !node ||
          !isProtectedFishboneStructureNode(node) ||
          isFaultGateCapaSplineOwner(node, nodes);
      });
    const selectedSplineAuditDescriptions = getRcaSplineAuditDescriptions(
      nodes,
      selectedSession.methodology,
      selectedEdgeChildNodeIds
    );
    const selectedNodeAuditDescriptions = nodes
      .filter((node) => realSelectedNodeIds.has(node.id))
      .map((node) => getRcaNodeAuditDescriptor(node));

    if (!realSelectedNodeIds.size && !selectedEdgeChildNodeIds.length) {
      return;
    }

    const historySnapshot = cloneRcaNodes(nodes);
    const selectedEdgeChildNodeIdSet = new Set(selectedEdgeChildNodeIds);
    const nextNodes = nodes
      .filter((node) => !realSelectedNodeIds.has(node.id))
      .map((node) => (
        selectedEdgeChildNodeIdSet.has(node.id)
          ? { ...node, parentNodeId: null }
          : node
      ));

    setIsWorking(true);
    setErrorMessage('');
    recordCanvasHistory(historySnapshot);
    setNodes(nextNodes);
    setSelectedNodeId(null);
    setSelectedFlowNodeIds(new Set());
    setSelectedFlowEdgeIds(new Set());
    setInspectedNodeId((currentNodeId) => (
      currentNodeId && realSelectedNodeIds.has(currentNodeId) ? null : currentNodeId
    ));
    closeCanvasContextMenu();
    closeNodeStyleEditor();
    closeSplineStyleEditor();

    try {
      await Promise.all([
        ...[...realSelectedNodeIds].map((nodeId) => deleteCollaborativeRcaNode(selectedIncident.id, selectedSession.id, nodeId)),
        ...selectedEdgeChildNodeIds.map((nodeId) => updateCollaborativeRcaNode(
          selectedIncident.id,
          selectedSession.id,
          nodeId,
          { auditIntent: 'SPLINE_DELETED', parentNodeId: null }
        ))
      ]);
      const previousValue = [
        selectedNodeAuditDescriptions.length
          ? `Nodes deleted:\n${selectedNodeAuditDescriptions.map((description) => `- ${description}`).join('\n')}`
          : '',
        selectedSplineAuditDescriptions.length
          ? `Splines deleted:\n${selectedSplineAuditDescriptions.map((description) => `- ${description}`).join('\n')}`
          : ''
      ].filter(Boolean).join('\n\n') || `${realSelectedNodeIds.size} node${realSelectedNodeIds.size === 1 ? '' : 's'}, ${selectedEdgeChildNodeIds.length} spline${selectedEdgeChildNodeIds.length === 1 ? '' : 's'}`;
      const summaryParts = [
        realSelectedNodeIds.size
          ? `${realSelectedNodeIds.size} node${realSelectedNodeIds.size === 1 ? '' : 's'}`
          : '',
        selectedEdgeChildNodeIds.length
          ? `${selectedEdgeChildNodeIds.length} spline${selectedEdgeChildNodeIds.length === 1 ? '' : 's'}`
          : ''
      ].filter(Boolean);

      void recordCanvasActivity({
        action: 'MULTI_DELETED',
        previousValue,
        summary: `Deleted selected canvas items: ${summaryParts.join(' and ')}`
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setNodes(historySnapshot);
      setSelectedFlowNodeIds(new Set(selectedFlowNodeIds));
      setSelectedFlowEdgeIds(new Set(selectedFlowEdgeIds));
    } finally {
      setIsWorking(false);
    }
  }

  async function executeClearCanvas() {
    if (!selectedIncident || !selectedSession || isReferenceProjectActive || isWorking || !nodes.length) {
      return;
    }

    const historySnapshot = cloneRcaNodes(nodes);

    setIsWorking(true);
    setErrorMessage('');
    recordCanvasHistory(historySnapshot);
    setNodes([]);
    setSelectedNodeId(null);
    setSelectedFlowNodeIds(new Set());
    setSelectedFlowEdgeIds(new Set());
    setInspectedNodeId(null);
    closeCanvasContextMenu();
    closeNodeStyleEditor();
    closeSplineStyleEditor();

    try {
      await Promise.all(nodes.map((node) => deleteCollaborativeRcaNode(selectedIncident.id, selectedSession.id, node.id)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setNodes(historySnapshot);
    } finally {
      setIsWorking(false);
    }
  }

  function handleConfirmCanvasDestructiveAction() {
    const action = pendingCanvasDestructiveAction;

    if (!action || isWorking) {
      return;
    }

    setPendingCanvasDestructiveAction(null);

    if (action.kind === 'CLEAR_CANVAS') {
      void executeClearCanvas();
      return;
    }

    if (action.kind === 'DELETE_NODE') {
      void executeDeleteNode(action.nodeId);
      return;
    }

    void executeDeleteSelectedCanvasItems();
  }

  function hasPendingCanvasStyleSaves(): boolean {
    return (
      nodeStyleSaveTimeoutsRef.current.size > 0 ||
      nodeStyleSaveRequestRef.current.size > 0 ||
      splineStyleSaveTimeoutsRef.current.size > 0 ||
      splineStyleSaveRequestRef.current.size > 0
    );
  }

  function handleNodeVisualStyleChange(nodeId: string, visualStylePatch: RcaNodeVisualStyle) {
    if (!selectedIncident || !selectedSession || isReferenceProjectActive) {
      return;
    }

    const node = nodes.find((candidateNode) => candidateNode.id === nodeId);

    if (!node) {
      return;
    }

    if (!nodeStyleHistorySnapshotRef.current.has(nodeId)) {
      recordCanvasHistory(nodes);
      nodeStyleHistorySnapshotRef.current.add(nodeId);
    }

    const nextVisualStyle = {
      ...(pendingNodeVisualStylesRef.current.get(nodeId) || node.visualStyle || {}),
      ...visualStylePatch
    };

    pendingNodeVisualStylesRef.current.set(nodeId, nextVisualStyle);
    setNodes((currentNodes) => currentNodes.map((currentNode) => (
      currentNode.id === nodeId
        ? {
            ...currentNode,
            visualStyle: nextVisualStyle
          }
        : currentNode
    )));

    const existingTimeoutId = nodeStyleSaveTimeoutsRef.current.get(nodeId);

    if (existingTimeoutId !== undefined) {
      window.clearTimeout(existingTimeoutId);
    }

    const saveRequestId = (nodeStyleSaveRequestRef.current.get(nodeId) || 0) + 1;
    nodeStyleSaveRequestRef.current.set(nodeId, saveRequestId);
    setIsCanvasAutosaving(true);

    const incidentId = selectedIncident.id;
    const sessionId = selectedSession.id;
    const timeoutId = window.setTimeout(() => {
      nodeStyleSaveTimeoutsRef.current.delete(nodeId);
      const pendingVisualStyle = pendingNodeVisualStylesRef.current.get(nodeId);

      if (!pendingVisualStyle) {
        nodeStyleSaveRequestRef.current.delete(nodeId);
        setIsCanvasAutosaving(hasPendingCanvasStyleSaves());
        return;
      }

      const requestId = nodeStyleSaveRequestRef.current.get(nodeId) || saveRequestId;

      void updateCollaborativeRcaNode(incidentId, sessionId, nodeId, {
        visualStyle: pendingVisualStyle
      }).then((updatedNode) => {
        if (nodeStyleSaveRequestRef.current.get(nodeId) !== requestId) {
          return;
        }

        setNodes((currentNodes) => currentNodes.map((currentNode) => (
          currentNode.id === updatedNode.id
            ? {
                ...currentNode,
                visualStyle: updatedNode.visualStyle
              }
            : currentNode
        )));
      }).catch((error) => {
        if (nodeStyleSaveRequestRef.current.get(nodeId) === requestId) {
          setErrorMessage(getErrorMessage(error));
        }
      }).finally(() => {
        if (nodeStyleSaveRequestRef.current.get(nodeId) === requestId) {
          nodeStyleSaveRequestRef.current.delete(nodeId);
          pendingNodeVisualStylesRef.current.delete(nodeId);
          nodeStyleHistorySnapshotRef.current.delete(nodeId);
        }

        setIsCanvasAutosaving(hasPendingCanvasStyleSaves());
      });
    }, 180);

    nodeStyleSaveTimeoutsRef.current.set(nodeId, timeoutId);
  }

  function handleSplineEdgeStyleChange(nodeId: string, edgeStylePatch: RcaNodeEdgeStyle) {
    if (!selectedIncident || !selectedSession || isReferenceProjectActive) {
      return;
    }

    const node = nodes.find((candidateNode) => candidateNode.id === nodeId);

    if (!node) {
      return;
    }

    if (!splineStyleHistorySnapshotRef.current.has(nodeId)) {
      recordCanvasHistory(nodes);
      splineStyleHistorySnapshotRef.current.add(nodeId);
    }

    const nextEdgeStyle = {
      ...(pendingSplineEdgeStylesRef.current.get(nodeId) || node.edgeStyle || {}),
      ...edgeStylePatch
    };

    pendingSplineEdgeStylesRef.current.set(nodeId, nextEdgeStyle);
    setNodes((currentNodes) => currentNodes.map((currentNode) => (
      currentNode.id === nodeId
        ? {
            ...currentNode,
            edgeStyle: nextEdgeStyle
          }
        : currentNode
    )));

    const existingTimeoutId = splineStyleSaveTimeoutsRef.current.get(nodeId);

    if (existingTimeoutId !== undefined) {
      window.clearTimeout(existingTimeoutId);
    }

    const saveRequestId = (splineStyleSaveRequestRef.current.get(nodeId) || 0) + 1;
    splineStyleSaveRequestRef.current.set(nodeId, saveRequestId);
    setIsCanvasAutosaving(true);

    const incidentId = selectedIncident.id;
    const sessionId = selectedSession.id;
    const timeoutId = window.setTimeout(() => {
      splineStyleSaveTimeoutsRef.current.delete(nodeId);
      const pendingEdgeStyle = pendingSplineEdgeStylesRef.current.get(nodeId);

      if (!pendingEdgeStyle) {
        splineStyleSaveRequestRef.current.delete(nodeId);
        setIsCanvasAutosaving(hasPendingCanvasStyleSaves());
        return;
      }

      const requestId = splineStyleSaveRequestRef.current.get(nodeId) || saveRequestId;

      void updateCollaborativeRcaNode(incidentId, sessionId, nodeId, {
        edgeStyle: pendingEdgeStyle
      }).then((updatedNode) => {
        if (splineStyleSaveRequestRef.current.get(nodeId) !== requestId) {
          return;
        }

        setNodes((currentNodes) => currentNodes.map((currentNode) => (
          currentNode.id === updatedNode.id
            ? {
                ...currentNode,
                edgeStyle: updatedNode.edgeStyle
              }
            : currentNode
        )));
      }).catch((error) => {
        if (splineStyleSaveRequestRef.current.get(nodeId) === requestId) {
          setErrorMessage(getErrorMessage(error));
        }
      }).finally(() => {
        if (splineStyleSaveRequestRef.current.get(nodeId) === requestId) {
          splineStyleSaveRequestRef.current.delete(nodeId);
          pendingSplineEdgeStylesRef.current.delete(nodeId);
          splineStyleHistorySnapshotRef.current.delete(nodeId);
        }

        setIsCanvasAutosaving(hasPendingCanvasStyleSaves());
      });
    }, 180);

    splineStyleSaveTimeoutsRef.current.set(nodeId, timeoutId);
  }

  function handleOpenReferenceProject() {
    resetActiveCanvasState(null);
    setIsReferenceProjectActive(true);
    setIsIncidentShelfOpen(false);
    setIsCollaboratorInviteOpen(false);
    setWorkspaceView('canvas');
    closeSplineStyleEditor();
    fitVisibleProjectIntoView({ delay: 160, force: true, padding: 0.16 });
  }

  function handleOpenIncidentProject(incidentId: string) {
    resetActiveCanvasState(null);
    setIsReferenceProjectActive(false);
    setSelectedIncidentId(incidentId);
    setIsCollaboratorInviteOpen(false);
    setCollaboratorCandidates([]);
    setSelectedCollaborators([]);
    setCollaboratorSearchQuery('');
    setIsIncidentShelfOpen(false);
    setWorkspaceView('canvas');
    closeSplineStyleEditor();
  }

  function handleBackToDashboard() {
    resetActiveCanvasState(null);
    setWorkspaceView('dashboard');
    setAlignmentGuides([]);
    setIsIncidentShelfOpen(false);
    setIsIncidentLauncherOpen(false);
    setIsCollaboratorInviteOpen(false);
    setDeleteIncidentCandidate(null);
    closeSplineStyleEditor();
  }

  async function handleToggleCollaboratorInvite() {
    if (!selectedIncident || selectedIncident.accessRole !== 'OWNER' || isReferenceProjectActive) {
      return;
    }

    const shouldOpen = !isCollaboratorInviteOpen;
    setIsCollaboratorInviteOpen(shouldOpen);

    if (!shouldOpen || collaboratorCandidates.length || isLoadingCollaborators) {
      return;
    }

    setIsLoadingCollaborators(true);
    setErrorMessage('');

    try {
      const response = await listRcaCollaboratorCandidates(selectedIncident.id);
      setCollaboratorCandidates(response.users);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsCollaboratorInviteOpen(false);
    } finally {
      setIsLoadingCollaborators(false);
    }
  }

  function handleSelectCollaborator(user: RcaUserSummary) {
    setSelectedCollaborators((currentUsers) => (
      currentUsers.some((currentUser) => currentUser.uid === user.uid)
        ? currentUsers
        : [...currentUsers, user]
    ));
    setCollaboratorSearchQuery('');
  }

  function handleRemoveSelectedCollaborator(uid: string) {
    setSelectedCollaborators((currentUsers) => currentUsers.filter((user) => user.uid !== uid));
  }

  function handleCancelCollaboratorInvite() {
    setIsCollaboratorInviteOpen(false);
    setSelectedCollaborators([]);
    setCollaboratorSearchQuery('');
  }

  async function handleSendCollaboratorInvite() {
    if (!selectedIncident || !selectedCollaborators.length || isSendingCollaboratorInvite) {
      return;
    }

    setIsSendingCollaboratorInvite(true);
    setErrorMessage('');

    try {
      const response = await inviteRcaCollaborators(
        selectedIncident.id,
        selectedCollaborators.map((user) => user.uid)
      );

      setWorkspace((currentWorkspace) => currentWorkspace
        ? {
            ...currentWorkspace,
            incidents: currentWorkspace.incidents.map((incident) => (
              incident.id === response.incident.id
                ? normalizeRcaIncidentAccessForUser(response.incident, currentWorkspace.context.user.uid)
                : incident
            ))
          }
        : currentWorkspace
      );
      setCollaboratorCandidates((currentUsers) => currentUsers.filter((user) => (
        !selectedCollaborators.some((selectedUser) => selectedUser.uid === user.uid)
      )));
      setSelectedCollaborators([]);
      setCollaboratorSearchQuery('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSendingCollaboratorInvite(false);
    }
  }

  async function handleRemoveInvitedCollaborator(user: RcaUserSummary) {
    if (!selectedIncident || removingCollaboratorUid || selectedIncident.accessRole !== 'OWNER') {
      return;
    }

    setRemovingCollaboratorUid(user.uid);
    setErrorMessage('');

    try {
      const response = await removeRcaCollaborator(selectedIncident.id, user.uid);

      setWorkspace((currentWorkspace) => currentWorkspace
        ? {
            ...currentWorkspace,
            incidents: currentWorkspace.incidents.map((incident) => (
              incident.id === response.incident.id
                ? normalizeRcaIncidentAccessForUser(response.incident, currentWorkspace.context.user.uid)
                : incident
            ))
          }
        : currentWorkspace
      );
      setCollaboratorCandidates((currentUsers) => (
        currentUsers.some((candidate) => candidate.uid === response.removedUser.uid)
          ? currentUsers
          : [...currentUsers, response.removedUser].sort((first, second) => first.displayName.localeCompare(second.displayName))
      ));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setRemovingCollaboratorUid(null);
    }
  }

  function handleDeleteIncidentProject(incident: RcaIncident) {
    if (isWorking) {
      return;
    }

    setErrorMessage('');
    setDeleteIncidentCandidate(incident);
  }

  async function handleConfirmDeleteIncidentProject() {
    if (!deleteIncidentCandidate || isWorking) {
      return;
    }

    setIsWorking(true);
    setErrorMessage('');

    try {
      await deleteRcaIncident(deleteIncidentCandidate.id);
      const refreshedWorkspace = await listRcaIncidents();

      setWorkspace(refreshedWorkspace);

      if (selectedIncidentId === deleteIncidentCandidate.id) {
        setSelectedIncidentId(null);
        setSelectedSessionId(null);
        setSessions([]);
        resetActiveCanvasState(null);
      }

      setDeleteIncidentCandidate(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  function handleSelectReferenceStep(step: ReferenceRcaStep) {
    setReferenceStepId(step.id);
    setSelectedNodeId(step.focusNodeId);
    const focusNode = referenceNodes.find((node) => node.id === step.focusNodeId);

    if (focusNode) {
      const focusIndex = Math.max(0, referenceNodes.findIndex((node) => node.id === focusNode.id));
      const position = getNodePosition(focusNode, referenceNodes, focusIndex, referenceMethodology);
      window.setTimeout(() => {
        void reactFlow.setCenter(position.x + 144, position.y + 92, { duration: 560, zoom: 0.82 });
      }, 0);
    }
  }

  async function handleAutoArrangeCanvas() {
    if (!selectedSession || isWorking) {
      return;
    }

    setAlignmentGuides([]);

    if (isReferenceProjectActive) {
      const resetNodes = arrangeRcaCanvasNodes(referenceNodes, referenceMethodology, REFERENCE_RCA_PROJECT.nodeDetails);

      setReferenceNodes(resetNodes);
      fitVisibleProjectIntoView({ delay: 140, force: true, padding: 0.16 });
      return;
    }

    if (!selectedIncident) {
      return;
    }

    const arrangedNodes = sanitizeRcaCanvasNodes(arrangeRcaCanvasNodes(nodes, selectedSession.methodology));
    const historySnapshot = cloneRcaNodes(nodes);
    const arrangedNodeById = new Map(arrangedNodes.map((node) => [node.id, node]));
    const layoutPatch = buildRcaCanvasLayoutPatch(nodes, arrangedNodeById, selectedSession.methodology);

    if (arrangedNodes.length !== nodes.length || arrangedNodeById.size !== nodes.length) {
      setErrorMessage('Canvas rearrange was blocked because the layout result did not match the current canvas.');
      return;
    }

    if (areRcaNodeSnapshotsEqual(historySnapshot, arrangedNodes) || !layoutPatch.size) {
      fitVisibleProjectIntoView({ delay: 140, force: true, padding: 0.16 });
      return;
    }

    setIsWorking(true);
    setErrorMessage('');
    recordCanvasHistory(historySnapshot);
    setNodes((currentNodes) => applyRcaCanvasLayoutPatch(currentNodes, layoutPatch));

    try {
      const updatedNodes = await Promise.all([...layoutPatch].map(([nodeId, uiCoordinates]) => (
        updateCollaborativeRcaNode(selectedIncident.id, selectedSession.id, nodeId, {
          uiCoordinates
        })
      )));
      const updatedNodeById = new Map(updatedNodes.map((node) => [node.id, node]));

      setNodes((currentNodes) => currentNodes.map((node) => updatedNodeById.get(node.id) || node));
      fitVisibleProjectIntoView({ delay: 140, force: true, padding: 0.16 });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setNodes(historySnapshot);
    } finally {
      setIsWorking(false);
    }
  }

  async function applyCanvasHistorySnapshot(targetSnapshot: RcaCanvasHistorySnapshot) {
    if (!selectedIncident || !selectedSession || isReferenceProjectActive || isWorking) {
      return false;
    }

    const targetNodes = cloneRcaNodes(targetSnapshot);
    const currentNodes = cloneRcaNodes(nodes);
    const previousSelectedNodeId = selectedNodeId;
    const previousSelectedFlowNodeIds = new Set(selectedFlowNodeIds);
    const targetNodeById = new Map(targetNodes.map((node) => [node.id, node]));
    const currentNodeById = new Map(currentNodes.map((node) => [node.id, node]));
    const nodesToDelete = currentNodes.filter((node) => !targetNodeById.has(node.id));
    const nodesToUpdate = targetNodes.filter((node) => {
      const currentNode = currentNodeById.get(node.id);

      return !currentNode || !areRcaNodeSnapshotsEqual([currentNode], [node]);
    });

    clearPendingNodeStyleSaves();
    clearPendingSplineStyleSaves();
    setAlignmentGuides([]);
    setErrorMessage('');
    setIsWorking(true);
    setNodes(targetNodes);
    setSelectedNodeId((currentNodeId) => (
      currentNodeId && targetNodeById.has(currentNodeId) ? currentNodeId : null
    ));
    setSelectedFlowNodeIds((currentNodeIds) => (
      new Set([...currentNodeIds].filter((nodeId) => targetNodeById.has(nodeId)))
    ));

    try {
      await Promise.all([
        ...nodesToDelete.map((node) => deleteCollaborativeRcaNode(selectedIncident.id, selectedSession.id, node.id)),
        ...nodesToUpdate.map((node) => updateCollaborativeRcaNode(
          selectedIncident.id,
          selectedSession.id,
          node.id,
          buildRcaHistoryNodeInput(node)
        ))
      ]);
      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setNodes(currentNodes);
      setSelectedNodeId(previousSelectedNodeId);
      setSelectedFlowNodeIds(previousSelectedFlowNodeIds);
      return false;
    } finally {
      setIsWorking(false);
    }
  }

  function handleUndoCanvas() {
    if (isReferenceProjectActive || isWorking || !canvasUndoStack.length) {
      return;
    }

    const targetSnapshot = canvasUndoStack[canvasUndoStack.length - 1];
    const currentSnapshot = cloneRcaNodes(nodes);

    void applyCanvasHistorySnapshot(targetSnapshot).then((didApplyHistory) => {
      if (!didApplyHistory) {
        return;
      }

      setCanvasUndoStack((currentStack) => currentStack.slice(0, -1));
      setCanvasRedoStack((currentStack) => (
        [...currentStack, currentSnapshot].slice(-RCA_CANVAS_HISTORY_LIMIT)
      ));
      void recordCanvasActivity({
        action: 'UNDO',
        summary: 'Undid the last canvas action'
      });
    });
  }

  function handleRedoCanvas() {
    if (isReferenceProjectActive || isWorking || !canvasRedoStack.length) {
      return;
    }

    const targetSnapshot = canvasRedoStack[canvasRedoStack.length - 1];
    const currentSnapshot = cloneRcaNodes(nodes);

    void applyCanvasHistorySnapshot(targetSnapshot).then((didApplyHistory) => {
      if (!didApplyHistory) {
        return;
      }

      setCanvasRedoStack((currentStack) => currentStack.slice(0, -1));
      setCanvasUndoStack((currentStack) => (
        [...currentStack, currentSnapshot].slice(-RCA_CANVAS_HISTORY_LIMIT)
      ));
      void recordCanvasActivity({
        action: 'REDO',
        summary: 'Redid the last undone canvas action'
      });
    });
  }

  function handleDownloadAuditPackage() {
    downloadReferenceAuditPackage({
      ...REFERENCE_RCA_PROJECT,
      incident: referenceIncident
    }, referenceNodes);
  }

  const context = workspace?.context || null;
  contextRef.current = context;
  const methodology = selectedSession?.methodology || 'ISHIKAWA';
  const contextMenuTargetNode = canvasContextMenu?.targetNodeId
    ? visibleNodes.find((node) => node.id === canvasContextMenu.targetNodeId) || null
    : null;
  const contextMenuKind: RcaNodeContextMenuKind | null = contextMenuTargetNode?.nodeType === 'ISHIKAWA_CATEGORY'
    ? 'category'
    : contextMenuTargetNode?.nodeType === 'STICKY_NOTE'
      ? 'sticky'
      : contextMenuTargetNode && (isFishboneCauseNode(contextMenuTargetNode) || contextMenuTargetNode.nodeType === 'WHY')
        ? 'cause'
        : null;
  const splineEditorNode = splineStyleEditor
    ? visibleNodes.find((node) => node.id === splineStyleEditor.nodeId) || null
    : null;
  const contextMenuAddParentNodeId = contextMenuKind &&
    contextMenuTargetNode &&
    (selectedSession?.methodology === 'ISHIKAWA' || selectedSession?.methodology === '5_WHYS')
    ? contextMenuTargetNode.id
    : undefined;
  const hasIncidentCanvasNode = nodes.some((node) => getFiveWhysNodeRole(node) === 'INCIDENT');
  const canContextMenuAddNode = Boolean(
    !isReferenceProjectActive &&
    selectedIncident &&
    selectedSession &&
    hasIncidentCanvasNode &&
    (!canvasContextMenu?.targetNodeId || contextMenuKind)
  );
  const canContextMenuCreateIncidentNode = Boolean(
    !isReferenceProjectActive &&
    selectedIncident &&
    selectedSession &&
    !hasIncidentCanvasNode &&
    (!canvasContextMenu?.targetNodeId || contextMenuKind)
  );
  const canContextMenuDeleteNode = Boolean(
    !isReferenceProjectActive &&
    selectedIncident &&
    selectedSession &&
    (contextMenuKind === 'cause' || contextMenuKind === 'sticky')
  );
  const canContextMenuEditNode = Boolean(
    !isReferenceProjectActive &&
    selectedIncident &&
    selectedSession &&
    contextMenuKind
  );
  const contextMenuReportIncidentNode = isRcaIncidentReportNode(contextMenuTargetNode, visibleNodes)
    ? contextMenuTargetNode
    : selectedReportIncidentNode;
  const canContextMenuGenerateReport = Boolean(
    !isReferenceProjectActive &&
    selectedIncident &&
    selectedSession &&
    contextMenuReportIncidentNode
  );
  const styleEditorNode = nodeStyleEditor
    ? visibleNodes.find((node) => node.id === nodeStyleEditor.nodeId) || null
    : null;
  const canUndoCanvas = Boolean(
    workspaceView === 'canvas' &&
    !isReferenceProjectActive &&
    selectedIncident &&
    selectedSession &&
    canvasUndoStack.length &&
    !isWorking &&
    !isLoadingSession
  );
  const canRedoCanvas = Boolean(
    workspaceView === 'canvas' &&
    !isReferenceProjectActive &&
    selectedIncident &&
    selectedSession &&
    canvasRedoStack.length &&
    !isWorking &&
    !isLoadingSession
  );

  React.useEffect(() => {
    if (workspaceView !== 'canvas') {
      return undefined;
    }

    function handleCanvasToolKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        void handleDeleteSelectedCanvasItems();
        return;
      }

      if (key === '?' || (event.shiftKey && key === '/')) {
        event.preventDefault();
        closeCanvasContextMenu();
        setIsCanvasShortcutListOpen((isOpen) => !isOpen);
        return;
      }

      if (key === 'escape') {
        setIsCanvasShortcutListOpen(false);
        return;
      }

      if (key === 'v') {
        event.preventDefault();
        setCanvasInteractionMode('select');
        return;
      }

      if (key === 'h') {
        event.preventDefault();
        setCanvasInteractionMode('pan');
        return;
      }

      if (key === 'g') {
        event.preventDefault();
        setIsCanvasGridVisible((isVisible) => !isVisible);
        return;
      }

      if (key === 's') {
        event.preventDefault();
        setIsCanvasSnapEnabled((isEnabled) => !isEnabled);
        return;
      }

      if (key === 'd') {
        const selectedRealNodeId = [...selectedFlowNodeIds]
          .find((nodeId) => visibleNodes.some((node) => node.id === nodeId)) ||
          (selectedNodeId && visibleNodes.some((node) => node.id === selectedNodeId) ? selectedNodeId : null);

        if (selectedRealNodeId && !isWorking) {
          event.preventDefault();
          closeCanvasContextMenu();
          setInspectedNodeId(selectedRealNodeId);
          setSelectedNodeId(selectedRealNodeId);
          setSelectedFlowNodeIds(new Set([selectedRealNodeId]));
        }

        return;
      }

      if (key === 'e') {
        const selectedRealNodeId = [...selectedFlowNodeIds]
          .find((nodeId) => visibleNodes.some((node) => node.id === nodeId)) ||
          (selectedNodeId && visibleNodes.some((node) => node.id === selectedNodeId) ? selectedNodeId : null);

        if (selectedRealNodeId && !isWorking) {
          event.preventDefault();
          closeCanvasContextMenu();
          setInspectedNodeId(null);
          setSelectedNodeId(selectedRealNodeId);
          setSelectedFlowNodeIds(new Set([selectedRealNodeId]));
          openNodeStyleEditor(selectedRealNodeId);
        }

        return;
      }

      if (key === 'r') {
        event.preventDefault();

        if (event.shiftKey) {
          void handleRefreshCanvas();
        } else if (!isWorking) {
          void handleAutoArrangeCanvas();
        }

        return;
      }

      const methodologyOption = methodologyOptions.find((option) => option.shortcut.toLowerCase() === key);

      if (methodologyOption && selectedIncident && selectedSession && !isWorking) {
        event.preventDefault();
        void handleMethodologyChange(methodologyOption.value);
      }
    }

    window.addEventListener('keydown', handleCanvasToolKeyDown, { capture: true });

    return () => window.removeEventListener('keydown', handleCanvasToolKeyDown, { capture: true });
  }, [
    canContextMenuAddNode,
    closeCanvasContextMenu,
    handleDeleteSelectedCanvasItems,
    handleAddNode,
    handleAutoArrangeCanvas,
    handleMethodologyChange,
    handleRefreshCanvas,
    isWorking,
    openNodeStyleEditor,
    selectedIncident,
    selectedFlowNodeIds,
    selectedNodeId,
    selectedSession,
    visibleNodes,
    workspaceView
  ]);

  const summary = workspace?.summary || {
    activeInvestigations: 0,
    averageRpn: 0,
    closedInvestigations: 0,
    criticalIncidents: 0
  };

  React.useEffect(() => {
    if (workspaceView !== 'canvas' || isReferenceProjectActive) {
      return undefined;
    }

    function handleCanvasHistoryKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        handleRedoCanvas();
        return;
      }

      if (key === 'z') {
        event.preventDefault();
        handleUndoCanvas();
        return;
      }

      if (key === 'y') {
        event.preventDefault();
        handleRedoCanvas();
      }
    }

    window.addEventListener('keydown', handleCanvasHistoryKeyDown);

    return () => window.removeEventListener('keydown', handleCanvasHistoryKeyDown);
  }, [canvasRedoStack, canvasUndoStack, isReferenceProjectActive, isWorking, workspaceView]);

  return (
    <section
      className={`relative h-[calc(100svh-52px)] w-full overflow-hidden ${canvasThemeStyles.sectionClassName}`}
      ref={workspaceRootRef}
      style={{ backgroundColor: canvasThemeStyles.backgroundColor }}
    >
      <RcaCanvasToastStack
        isLoadingVisible={workspaceView === 'canvas' && isLoadingSession}
        isSavingVisible={isWorking || isTitleAutosaving || isCanvasAutosaving}
      />

      {workspaceView === 'dashboard' ? (
        <>
          <RcaProjectDashboard
            context={context}
            incidents={workspace?.incidents || []}
            isLoading={isLoading}
            onCreateProject={() => setIsIncidentLauncherOpen(true)}
            onDeleteIncident={(incident) => void handleDeleteIncidentProject(incident)}
            onOpenReferenceProject={handleOpenReferenceProject}
            onRefresh={() => void loadWorkspace()}
            onSelectIncident={handleOpenIncidentProject}
            summary={summary}
          />

          <RcaIncidentLauncher
            draft={incidentDraft}
            isOpen={isIncidentLauncherOpen}
            isWorking={isWorking}
            onClose={() => setIsIncidentLauncherOpen(false)}
            onCreateIncident={handleCreateIncident}
            onDraftChange={setIncidentDraft}
          />

          <RcaDeleteProjectDialog
            incident={deleteIncidentCandidate}
            isWorking={isWorking}
            onCancel={() => setDeleteIncidentCandidate(null)}
            onConfirm={() => void handleConfirmDeleteIncidentProject()}
          />
        </>
      ) : (
        <>
          {selectedIncident && selectedSession ? (
            <ReactFlow
              className="relative z-10 h-full w-full"
              autoPanOnConnect
              connectionLineStyle={RCA_CONNECTION_LINE_STYLE}
              connectionLineType={ConnectionLineType.Bezier}
              connectionMode={ConnectionMode.Strict}
              connectionRadius={44}
              edges={flowEdges}
              edgesReconnectable={canEditCanvasConnections}
              edgeTypes={edgeTypes}
              fitViewOptions={{ maxZoom: 0.78, minZoom: 0.25, padding: 0.14 }}
              isValidConnection={isValidRcaCanvasConnection}
              minZoom={0.25}
              nodeExtent={RCA_CANVAS_COORDINATE_EXTENT}
              nodes={flowNodes}
              nodesConnectable={canEditCanvasConnections}
              nodesDraggable={!isReferenceProjectActive && !isWorking}
              nodeTypes={nodeTypes}
              onConnect={handleCanvasConnect}
              multiSelectionKeyCode={['Meta', 'Control']}
              onEdgeClick={(event, edge) => {
                const isMultiSelect = event.metaKey || event.ctrlKey || event.shiftKey;

                setSelectedFlowEdgeIds((currentSelection) => {
                  if (!isMultiSelect) {
                    return new Set([edge.id]);
                  }

                  const nextSelection = new Set(currentSelection);

                  if (nextSelection.has(edge.id)) {
                    nextSelection.delete(edge.id);
                  } else {
                    nextSelection.add(edge.id);
                  }

                  return nextSelection;
                });
                if (!isMultiSelect) {
                  setSelectedFlowNodeIds(new Set());
                  setSelectedNodeId(null);
                }
                openSplineStyleEditor(event, edge);
              }}
              onNodeClick={(event, flowNode) => {
                closeCanvasContextMenu();
                closeNodeStyleEditor();
                closeSplineStyleEditor();

                const isMultiSelect = event.metaKey || event.ctrlKey || event.shiftKey;

                if (!isMultiSelect) {
                  setSelectedNodeId(flowNode.id);
                  setSelectedFlowNodeIds(new Set([flowNode.id]));
                  setSelectedFlowEdgeIds(new Set());
                  return;
                }

                setSelectedFlowNodeIds((currentSelection) => {
                  const nextSelection = new Set(currentSelection);

                  if (nextSelection.has(flowNode.id)) {
                    nextSelection.delete(flowNode.id);
                  } else {
                    nextSelection.add(flowNode.id);
                  }

                  setSelectedNodeId([...nextSelection].find((nodeId) => !isFishboneSpineFlowNodeId(nodeId)) || null);
                  setSelectedFlowEdgeIds(getSelectedRcaSplineEdgeIdsForNodeSelection(
                    visibleNodes,
                    selectedSession?.methodology || 'ISHIKAWA',
                    nextSelection
                  ));

                  return nextSelection;
                });
              }}
              onNodeContextMenu={(event, flowNode) => {
                const node = visibleNodes.find((candidateNode) => candidateNode.id === flowNode.id);
                const targetNodeId = node?.nodeType === 'ISHIKAWA_CATEGORY' || node?.nodeType === 'STICKY_NOTE' || node?.nodeType === 'WHY' || (node && isFishboneCauseNode(node))
                  ? node.id
                  : undefined;

                openCanvasContextMenu(event, targetNodeId, false);
              }}
              onNodeDragStart={handleNodeDragStart}
              onNodeDragStop={handleNodeDragStop}
              onEdgesChange={handleFlowEdgesChange}
              onNodesChange={handleFlowNodesChange}
              onPaneContextMenu={openCanvasContextMenu}
              onPaneClick={() => {
                closeCanvasContextMenu();
                closeNodeStyleEditor();
                closeSplineStyleEditor();
                setIsCanvasShortcutListOpen(false);
                setIsKnowledgeBaseOpen(false);
                setIsActivityLogOpen(false);
                setIsCollaboratorInviteOpen(false);
                setInspectedNodeId(null);
                setSelectedNodeId(null);
                setSelectedFlowNodeIds(new Set());
                setSelectedFlowEdgeIds(new Set());
              }}
              onReconnect={handleCanvasReconnect}
              onReconnectEnd={handleCanvasReconnectEnd}
              panOnDrag={canvasInteractionMode === 'pan'}
              proOptions={{ hideAttribution: true }}
              reconnectRadius={18}
              selectionMode={SelectionMode.Partial}
              selectionKeyCode={null}
              selectionOnDrag={canvasInteractionMode === 'select'}
              snapGrid={canvasSnapGrid}
              snapToGrid={isCanvasSnapEnabled}
              translateExtent={RCA_CANVAS_COORDINATE_EXTENT}
            >
              {isCanvasGridVisible ? (
                <Background
                  color={canvasThemeStyles.gridColor}
                  gap={canvasGridSize}
                  key={`${canvasTheme}-${canvasGridSize}`}
                  size={canvasGridDotSize}
                  variant={BackgroundVariant.Dots}
                />
              ) : null}
              <RcaCanvasGuide methodology={selectedSession.methodology} />
              <RcaAlignmentGuides guides={alignmentGuides} />
              <MiniMap
                className="!bottom-24 !right-6 !rounded-2xl !border !border-white/50 !bg-white/80 !shadow-xl !backdrop-blur-md max-lg:!hidden"
                maskColor="rgba(15, 23, 42, 0.08)"
                nodeColor={(node) => getMiniMapColor(((node.data as unknown) as RcaNodeCardData).node)}
                pannable
                zoomable
              />
              <Controls
                className="!bottom-24 !left-6 !rounded-2xl !border !border-white/50 !bg-white/85 !shadow-xl !backdrop-blur-md"
                showInteractive={false}
              >
                <RcaCanvasControlButtons
                  interactionMode={canvasInteractionMode}
                  isSnapEnabled={isCanvasSnapEnabled}
                  onInteractionModeChange={setCanvasInteractionMode}
                  onSnapToggle={() => setIsCanvasSnapEnabled((isEnabled) => !isEnabled)}
                />
              </Controls>
            </ReactFlow>
          ) : null}

          <RcaCanvasContextMenu
            canvasTheme={canvasTheme}
            canAddNode={canContextMenuAddNode}
            canCreateIncidentNode={canContextMenuCreateIncidentNode}
            canDeleteNode={canContextMenuDeleteNode}
            canEditNode={canContextMenuEditNode}
            canGenerateReport={canContextMenuGenerateReport}
            canRearrange={canRearrangeCanvas}
            contextMenu={canvasContextMenu}
            gridSize={canvasGridSize}
            isGridVisible={isCanvasGridVisible}
            isSnapEnabled={isCanvasSnapEnabled}
            isWorking={isWorking}
            methodology={methodology}
            nodeMenuKind={contextMenuKind}
            onAddNode={() => {
              const coordinates = canvasContextMenu
                ? { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY }
                : undefined;

              closeCanvasContextMenu();
              void handleAddNode({
                coordinates,
                nodeType: contextMenuKind === 'category' ? 'CAUSE' : undefined,
                parentNodeId: null,
                skipAutoArrange: Boolean(canvasContextMenu)
              });
            }}
            onAddFiveWhysNodeRole={(fiveWhysNodeRole) => {
              const coordinates = canvasContextMenu
                ? { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY }
                : undefined;

              closeCanvasContextMenu();
              void handleAddNode({
                coordinates,
                fiveWhysNodeRole,
                parentNodeId: null,
                skipAutoArrange: true
              });
            }}
            onAddSubCause={() => {
              const coordinates = canvasContextMenu
                ? { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY }
                : undefined;

              closeCanvasContextMenu();
              void handleAddNode({
                coordinates,
                nodeType: 'SUB_CAUSE',
                parentNodeId: contextMenuAddParentNodeId
              });
            }}
            onAddStickyNote={() => {
              const coordinates = canvasContextMenu
                ? { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY }
                : undefined;

              closeCanvasContextMenu();
              void handleAddNode({
                coordinates,
                nodeType: 'STICKY_NOTE',
                parentNodeId: null,
                skipAutoArrange: true
              });
            }}
            onClearCanvas={() => {
              closeCanvasContextMenu();
              handleClearCanvas();
            }}
            onCreateIncident={() => {
              const coordinates = canvasContextMenu
                ? { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY }
                : undefined;

              closeCanvasContextMenu();
              void handleAddNode({
                coordinates,
                fiveWhysNodeRole: 'INCIDENT',
                parentNodeId: null,
                skipAutoArrange: true
              });
            }}
            onDeleteNode={() => {
              const nodeId = canvasContextMenu?.targetNodeId;

              closeCanvasContextMenu();
              handleDeleteNode(nodeId);
            }}
            onCopyText={() => {
              const nodeId = canvasContextMenu?.targetNodeId;

              closeCanvasContextMenu();
              void handleCopyNodeText(nodeId);
            }}
            onEditNode={() => {
              const nodeId = canvasContextMenu?.targetNodeId;

              if (nodeId) {
                openNodeStyleEditor(nodeId);
                setSelectedNodeId(nodeId);
                setSelectedFlowNodeIds(new Set([nodeId]));
              }
            }}
            onNodeDetails={() => {
              const nodeId = canvasContextMenu?.targetNodeId;

              if (nodeId) {
                setInspectedNodeId(nodeId);
                setSelectedNodeId(nodeId);
                setSelectedFlowNodeIds(new Set([nodeId]));
              }

              closeCanvasContextMenu();
            }}
            onPasteText={() => {
              const nodeId = canvasContextMenu?.targetNodeId;

              closeCanvasContextMenu();
              void handlePasteNodeText(nodeId);
            }}
            onGridToggle={() => {
              setIsCanvasGridVisible((isVisible) => !isVisible);
              closeCanvasContextMenu();
            }}
            onGenerateReport={() => {
              if (contextMenuReportIncidentNode) {
                setReportIncidentNodeId(contextMenuReportIncidentNode.id);
              }

              closeCanvasContextMenu();
            }}
            onGridSizeChange={setCanvasGridSize}
            onMethodologyChange={(nextMethodology) => {
              closeCanvasContextMenu();
              void handleMethodologyChange(nextMethodology);
            }}
            onRearrange={() => {
              closeCanvasContextMenu();
              void handleAutoArrangeCanvas();
            }}
            onRefresh={() => {
              closeCanvasContextMenu();
              void handleRefreshCanvas();
            }}
            onShortcutListOpen={() => {
              closeCanvasContextMenu();
              setIsCanvasShortcutListOpen(true);
            }}
            onSnapToggle={() => {
              setIsCanvasSnapEnabled((isEnabled) => !isEnabled);
              closeCanvasContextMenu();
            }}
            onThemeChange={(nextTheme) => {
              setCanvasTheme(nextTheme);
              closeCanvasContextMenu();
            }}
          />

          <RcaNodeStyleToolbar
            editor={nodeStyleEditor}
            isWorking={isWorking}
            node={styleEditorNode}
            onChange={(nodeId, visualStylePatch) => void handleNodeVisualStyleChange(nodeId, visualStylePatch)}
          />

          <RcaCanvasShortcutPanel
            isOpen={isCanvasShortcutListOpen}
            onClose={() => setIsCanvasShortcutListOpen(false)}
          />

          <RcaSplineStyleToolbar
            editor={splineStyleEditor}
            isWorking={isWorking}
            node={splineEditorNode}
            onChange={(nodeId, edgeStylePatch) => void handleSplineEdgeStyleChange(nodeId, edgeStylePatch)}
          />

          <RcaWarRoomHeader
            context={context}
            incident={selectedIncident}
            incidents={workspace?.incidents || []}
            isIncidentShelfOpen={isIncidentShelfOpen}
            isLoading={isLoading}
            isReferenceProjectActive={isReferenceProjectActive}
            onIncidentTitleChange={(title) => handleIncidentTitleChange(title)}
            onOpenIncidentLauncher={() => setIsIncidentLauncherOpen(true)}
            onOpenReferenceProject={handleOpenReferenceProject}
            onRefreshIncidentQueue={() => void loadWorkspace()}
            onSelectIncident={handleOpenIncidentProject}
            onTitleSavingChange={setIsTitleAutosaving}
            onToggleIncidentShelf={() => setIsIncidentShelfOpen((isOpen) => !isOpen)}
            selectedIncidentId={selectedIncidentId}
            summary={summary}
          />

          <RcaCanvasBackButton
            canRedo={canRedoCanvas}
            canUndo={canUndoCanvas}
            canInviteCollaborators={Boolean(!isReferenceProjectActive && selectedIncident?.accessRole === 'OWNER')}
            isCollaboratorInviteOpen={isCollaboratorInviteOpen}
            isWorking={isWorking || isLoadingSession}
            onBackToDashboard={() => {
              closeCanvasContextMenu();
              handleBackToDashboard();
            }}
            onInviteCollaborators={() => void handleToggleCollaboratorInvite()}
            onRedo={handleRedoCanvas}
            onUndo={handleUndoCanvas}
          />

          <RcaKnowledgeBasePanel
            incident={isReferenceProjectActive ? null : selectedIncident}
            isOpen={isKnowledgeBaseOpen}
            nodes={visibleNodes}
            onAsk={(question) => askRcaKnowledgeBase({
              incidentId: !isReferenceProjectActive && selectedIncident ? selectedIncident.id : undefined,
              question,
              sessionId: !isReferenceProjectActive && selectedSession ? selectedSession.id : undefined
            })}
            onToggle={() => setIsKnowledgeBaseOpen((isOpen) => !isOpen)}
            selectedNode={selectedNode}
            selectedSplineCount={selectedFlowEdgeIds.size}
            session={isReferenceProjectActive ? null : selectedSession}
          />

          {!isReferenceProjectActive && selectedIncident?.accessRole === 'OWNER' ? (
            <RcaCollaboratorInvitePanel
              candidates={collaboratorCandidates}
              invitedUsers={selectedIncident.collaborators}
              isLoading={isLoadingCollaborators}
              isOpen={isCollaboratorInviteOpen}
              isRemovingUid={removingCollaboratorUid}
              isSending={isSendingCollaboratorInvite}
              onCancel={handleCancelCollaboratorInvite}
              onQueryChange={setCollaboratorSearchQuery}
              onRemoveInvited={(user) => void handleRemoveInvitedCollaborator(user)}
              onRemoveSelected={handleRemoveSelectedCollaborator}
              onSelect={handleSelectCollaborator}
              onSend={() => void handleSendCollaboratorInvite()}
              query={collaboratorSearchQuery}
              selectedUsers={selectedCollaborators}
            />
          ) : null}

          <RcaPresenceBar
            collaborators={selectedIncident?.collaborators || []}
            context={context}
            isOffset={isReferenceProjectActive}
            owner={selectedIncident?.owner || null}
            participants={realtimeParticipants}
            realtimeStatus={realtimeStatus}
          />

          {!isReferenceProjectActive && selectedIncident && selectedSession ? (
            <RcaActivityLogPanel
              isLoading={isLoadingActivityLogs}
              isOpen={isActivityLogOpen}
              logs={activityLogs}
              onToggle={() => setIsActivityLogOpen((isOpen) => !isOpen)}
            />
          ) : null}

          {isReferenceProjectActive && !selectedNode ? (
            <button
              aria-label="Download audit package"
              className="absolute right-5 top-5 z-[40] grid h-11 w-11 place-items-center rounded-full border border-emerald-200/70 bg-emerald-500 text-white shadow-2xl shadow-emerald-950/20 ring-1 ring-white/40 transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-emerald-950/30 active:scale-95 max-lg:right-4 max-lg:top-4"
              onClick={handleDownloadAuditPackage}
              title="Download audit package"
              type="button"
            >
              <Download aria-hidden="true" size={18} />
            </button>
          ) : null}

          {isReferenceProjectActive ? (
            <>
              <RcaReferenceJourneyRail
                activeStepId={referenceStepId}
                onSelectStep={handleSelectReferenceStep}
                steps={REFERENCE_RCA_PROJECT.steps}
              />
              <RcaLiveCursor />
            </>
          ) : null}

          <RcaCanvasToolbar
            activityLogCount={activityLogs.filter((log) => log.action !== 'NODE_MOVED').length}
            canAddFishbone={hasIncidentCanvasNode}
            canGenerateReport={Boolean(selectedReportIncidentNode)}
            isActivityLogOpen={isActivityLogOpen}
            isReferenceProject={isReferenceProjectActive}
            isWorking={isWorking}
            methodology={methodology}
            onAddNode={() => void handleAddFishboneStructure()}
            onAutoArrange={() => void handleAutoArrangeCanvas()}
            onCreateSession={() => void handleCreateSession()}
            onGenerateReport={() => {
              if (selectedReportIncidentNode) {
                setReportIncidentNodeId(selectedReportIncidentNode.id);
              }
            }}
            onToggleActivityLog={() => setIsActivityLogOpen((isOpen) => !isOpen)}
            onMethodologyChange={(nextMethodology) => void handleMethodologyChange(nextMethodology)}
            onOpenIncidentLauncher={() => setIsIncidentLauncherOpen(true)}
            session={selectedSession}
          />

          {reportIncidentNode && selectedIncident && selectedSession ? (
            <RcaIncidentReportModal
              incident={selectedIncident}
              incidentNode={reportIncidentNode}
              nodes={visibleNodes}
              onClose={() => setReportIncidentNodeId(null)}
              sessionId={selectedSession.id}
            />
          ) : null}

          <RcaIncidentLauncher
            draft={incidentDraft}
            isOpen={isIncidentLauncherOpen}
            isWorking={isWorking}
            onClose={() => setIsIncidentLauncherOpen(false)}
            onCreateIncident={handleCreateIncident}
            onDraftChange={setIncidentDraft}
          />

          <RcaCanvasDestructiveActionDialog
            action={pendingCanvasDestructiveAction}
            isWorking={isWorking}
            node={pendingCanvasDestructiveAction?.nodeId
              ? nodes.find((node) => node.id === pendingCanvasDestructiveAction.nodeId) || null
              : null}
            selectedEdgeCount={selectedFlowEdgeIds.size}
            selectedNodeCount={selectedFlowNodeIds.size}
            isCompleteFishboneStructureSelection={isCompleteFishboneStructureSelection(nodes, selectedFlowNodeIds)}
            totalNodeCount={nodes.length}
            onCancel={() => setPendingCanvasDestructiveAction(null)}
            onConfirm={handleConfirmCanvasDestructiveAction}
          />

          <RcaInspectorDrawer
            incidentId={isReferenceProjectActive ? null : selectedIncident?.id || null}
            isReferenceProject={isReferenceProjectActive}
            isRealtimeReady={realtimeStatus === 'subscribed'}
            isWorking={isWorking}
            methodology={selectedSession?.methodology || methodology}
            nodeDetail={inspectedNode ? REFERENCE_RCA_PROJECT.nodeDetails[inspectedNode.id] : undefined}
            node={inspectedNode}
            nodes={visibleNodes}
            onClose={() => {
              if (inspectedNode) {
                nodeEditHistorySnapshotRef.current.delete(inspectedNode.id);
              }

              setInspectedNodeId(null);
            }}
            onDelete={() => handleDeleteNode(inspectedNode?.id)}
            onLabelLiveChange={(nodeId, label) => {
              if (!selectedIncident || !selectedSession) {
                return;
              }

              rcaRealtimeClient.sendNodeActivity(selectedIncident.id, selectedSession.id, nodeId, 'editing');
              rcaRealtimeClient.sendNodeLiveLabel(selectedIncident.id, selectedSession.id, nodeId, label);
            }}
            onPreview={handleNodePreview}
            onSave={(input) => void handleNodeSave(input)}
            sessionId={isReferenceProjectActive ? null : selectedSession?.id || null}
          />
        </>
      )}
      <RcaRemovedAccessDialog
        notice={removedAccessNotice}
        onClose={() => setRemovedAccessNotice(null)}
      />
      <RcaAppErrorDialog
        message={errorMessage}
        onClose={() => setErrorMessage('')}
      />
    </section>
  );
}

function RcaProjectDashboard({
  context,
  incidents,
  isLoading,
  onCreateProject,
  onDeleteIncident,
  onOpenReferenceProject,
  onRefresh,
  onSelectIncident,
  summary
}: {
  context: RcaWorkspaceContext | null;
  incidents: RcaIncident[];
  isLoading: boolean;
  onCreateProject: () => void;
  onDeleteIncident: (incident: RcaIncident) => void;
  onOpenReferenceProject: () => void;
  onRefresh: () => void;
  onSelectIncident: (incidentId: string) => void;
  summary: RcaWorkspaceResponse['summary'];
}) {
  const companyName = context?.company.companyName || 'RCA workspace';
  const departmentName = context?.department.name || 'All departments';
  const referencePreviewNodes = React.useMemo(() => buildReferenceProjectNodes(), []);
  const [projectSearch, setProjectSearch] = React.useState('');
  const [projectPreviewNodesByIncidentId, setProjectPreviewNodesByIncidentId] = React.useState<Record<string, RcaNode[]>>({});
  const normalizedProjectSearch = projectSearch.trim().toLowerCase();
  const referenceSearchText = [
    REFERENCE_RCA_PROJECT.incident.title,
    'sealed project',
    'sealed',
    'die cut production line',
    'oven area',
    'reference project',
    'rpn 27'
  ].join(' ').toLowerCase();
  const shouldShowReferenceProject = !normalizedProjectSearch || referenceSearchText.includes(normalizedProjectSearch);
  const filteredIncidents = React.useMemo(() => {
    if (!normalizedProjectSearch) {
      return incidents;
    }

    return incidents.filter((incident) => {
      const searchableText = [
        incident.title || 'Untitled RCA project',
        incident.owner?.displayName,
        incident.assetId,
        formatStatus(incident.status),
        incident.activeSessionId ? 'Canvas ready' : 'Session needed',
        incident.accessRole,
        `rpn ${incident.rpnScore}`
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(normalizedProjectSearch);
    });
  }, [incidents, normalizedProjectSearch]);
  const hasProjectSearch = Boolean(normalizedProjectSearch);
  const hasProjectSearchResults = shouldShowReferenceProject || filteredIncidents.length > 0;

  React.useEffect(() => {
    let isCurrent = true;
    const incidentsNeedingPreview = incidents.filter((incident) => (
      incident.activeSessionId &&
      projectPreviewNodesByIncidentId[incident.id] === undefined
    ));

    if (!incidentsNeedingPreview.length) {
      return undefined;
    }

    void Promise.all(incidentsNeedingPreview.map(async (incident) => {
      if (!incident.activeSessionId) {
        return { incidentId: incident.id, nodes: [] };
      }

      try {
        const response = await listRcaNodes(incident.id, incident.activeSessionId);

        return {
          incidentId: incident.id,
          nodes: response.nodes.filter((node) => node.status !== 'DELETED')
        };
      } catch {
        return { incidentId: incident.id, nodes: [] };
      }
    })).then((previews) => {
      if (!isCurrent) {
        return;
      }

      setProjectPreviewNodesByIncidentId((currentPreviews) => {
        const nextPreviews = { ...currentPreviews };

        previews.forEach((preview) => {
          nextPreviews[preview.incidentId] = preview.nodes;
        });

        return nextPreviews;
      });
    });

    return () => {
      isCurrent = false;
    };
  }, [incidents, projectPreviewNodesByIncidentId]);

  return (
    <div className="rca-project-picker-page relative z-10 h-full overflow-auto px-6 py-6 max-lg:px-4">
      <div className="flex w-full max-w-none flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-[11px] font-normal uppercase tracking-[0.2em] text-cyan-700">RCA Projects</p>
          <label className="rca-project-search" aria-label="Search RCA projects">
            <Search aria-hidden="true" size={16} />
            <input
              onChange={(event) => setProjectSearch(event.target.value)}
              placeholder="Search projects, owners, assets, status"
              type="search"
              value={projectSearch}
            />
            {projectSearch ? (
              <button aria-label="Clear RCA project search" onClick={() => setProjectSearch('')} type="button">
                <X aria-hidden="true" size={14} />
              </button>
            ) : null}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-xs font-normal text-slate-700 shadow-sm shadow-slate-950/5 transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95"
              onClick={onRefresh}
              type="button"
            >
              <Clock3 aria-hidden="true" size={14} />
              {isLoading ? 'Refreshing' : 'Refresh'}
            </button>
            <button
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3.5 text-xs font-normal text-white shadow-lg shadow-cyan-950/10 transition hover:bg-cyan-500 active:scale-95"
              onClick={onCreateProject}
              type="button"
            >
              <Plus aria-hidden="true" size={14} />
              New project
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <h1 className="rca-project-picker-title text-slate-950">Select a project to open the canvas</h1>
          <p className="mt-1 text-xs text-slate-500">{companyName} / {departmentName}</p>
        </div>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
          {shouldShowReferenceProject ? (
            <RcaProjectCard
              assetLabel="Die Cut production line - oven area"
              dateLabel={formatAuditDate(REFERENCE_RCA_PROJECT.sealedAt)}
              eyebrow="Sealed project"
              onOpen={onOpenReferenceProject}
              rpnScore={REFERENCE_RCA_PROJECT.incident.rpnScore}
              statusLabel="Sealed"
              thumbnailNodes={referencePreviewNodes}
              thumbnailVariant="reference"
              title={REFERENCE_RCA_PROJECT.incident.title}
            />
          ) : null}

          {filteredIncidents.map((incident) => (
            <RcaProjectCard
              accessRole={incident.accessRole}
              assetLabel={incident.assetId || 'Asset not assigned'}
              dateLabel={incident.updatedAtIso || incident.createdAtIso ? formatAuditDate(incident.updatedAtIso || incident.createdAtIso || '') : 'No activity yet'}
              eyebrow={incident.activeSessionId ? 'Canvas ready' : 'Session needed'}
              key={incident.id}
              onDelete={incident.accessRole === 'OWNER' ? () => onDeleteIncident(incident) : undefined}
              onOpen={() => onSelectIncident(incident.id)}
              owner={incident.owner}
              rpnScore={incident.rpnScore}
              statusLabel={formatStatus(incident.status)}
              thumbnailNodes={projectPreviewNodesByIncidentId[incident.id]}
              thumbnailVariant="incident"
              title={incident.title || 'Untitled RCA project'}
            />
          ))}

          {isLoading && !incidents.length ? (
            [0, 1].map((index) => (
              <div
                className="min-h-[250px] rounded-xl border border-white/70 bg-white/70 p-2.5 shadow-md shadow-slate-950/5 ring-1 ring-slate-900/5"
                key={index}
              >
                <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
                <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))
          ) : null}
        </div>

        {hasProjectSearch && !isLoading && !hasProjectSearchResults ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/72 px-4 py-3 text-sm text-slate-500">
            No RCA projects match "{projectSearch.trim()}".
          </div>
        ) : null}

        {!isLoading && !hasProjectSearch && !incidents.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/72 px-4 py-3 text-sm text-slate-500">
            No additional RCA projects have been created yet.
          </div>
        ) : null}
      </div>
    </div>
  );

}

function RcaProjectCard({
  accessRole = 'OWNER',
  assetLabel,
  dateLabel,
  eyebrow,
  onDelete,
  onOpen,
  owner,
  rpnScore,
  statusLabel,
  thumbnailNodes,
  thumbnailVariant,
  title
}: {
  accessRole?: 'OWNER' | 'INVITED';
  assetLabel: string;
  dateLabel: string;
  eyebrow: string;
  onDelete?: () => void;
  onOpen: () => void;
  owner?: RcaUserSummary | null;
  rpnScore: number;
  statusLabel: string;
  thumbnailNodes?: RcaNode[];
  thumbnailVariant: 'incident' | 'reference';
  title: string;
}) {
  return (
    <article className="group relative min-h-[250px] rounded-xl border border-white/70 bg-white/88 p-2.5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-[0_18px_38px_rgba(14,116,144,0.13)]">
      {onDelete ? (
        <button
          aria-label={`Delete ${title}`}
          className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full border border-red-100 bg-white/92 text-red-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
          onClick={onDelete}
          title="Delete project"
          type="button"
        >
          <Trash2 aria-hidden="true" size={13} />
        </button>
      ) : null}
      <button className="flex h-full w-full flex-col text-left active:scale-[0.99]" onClick={onOpen} type="button">
        <RcaProjectThumbnail nodes={thumbnailNodes} rpnScore={rpnScore} variant={thumbnailVariant} />
        <div className="mt-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-normal uppercase tracking-[0.16em] text-cyan-700">{eyebrow}</p>
            <h2 className="mt-1 line-clamp-2 text-sm font-normal leading-4 text-slate-950">{title}</h2>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-normal ${getRpnClassName(rpnScore)}`}>
            {rpnScore}
          </span>
        </div>
        {owner ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
            <span className="inline-flex min-w-0 items-center gap-2">
              <RcaUserAvatar size="sm" user={owner} />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-normal text-slate-700">{owner.displayName}</span>
                <span className="block truncate text-[11px] text-slate-500">Owner</span>
              </span>
            </span>
            {accessRole === 'INVITED' ? (
              <span className="shrink-0 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-normal text-cyan-700 ring-1 ring-cyan-100">
                Invited
              </span>
            ) : null}
          </div>
        ) : accessRole === 'INVITED' ? (
          <div className="mt-3">
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-normal text-cyan-700 ring-1 ring-cyan-100">
              Invited
            </span>
          </div>
        ) : null}
        <div className="mt-auto grid gap-1.5 pt-2 text-[11px] text-slate-500">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{assetLabel}</span>
            <span className="shrink-0">{statusLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{dateLabel}</span>
            <span className="inline-flex items-center gap-1 font-normal text-cyan-700 transition group-hover:translate-x-0.5">
              Open canvas
              <MousePointer2 aria-hidden="true" size={12} />
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

function RcaDeleteProjectDialog({
  incident,
  isWorking,
  onCancel,
  onConfirm
}: {
  incident: RcaIncident | null;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    if (!incident) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isWorking) {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [incident, isWorking, onCancel]);

  if (!incident) {
    return null;
  }

  const title = incident.title || 'Untitled RCA project';

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button
        aria-label="Cancel delete project"
        className="absolute inset-0 cursor-default bg-slate-950/10"
        disabled={isWorking}
        onClick={onCancel}
        type="button"
      />
      <section
        aria-labelledby="delete-project-title"
        aria-modal="true"
        className="relative z-10 w-[min(460px,calc(100%-24px))] overflow-hidden rounded-[24px] border border-white/70 bg-white/95 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-900/5"
        role="dialog"
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <Trash2 aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Delete project</p>
            <h2 className="mt-1 text-lg font-semibold leading-6 text-slate-950" id="delete-project-title">
              Delete this RCA project?
            </h2>
          </div>
          <button
            aria-label="Close delete confirmation"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isWorking}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-5 text-slate-900">
            {title}
          </p>
          <p className="mt-3 text-sm leading-5 text-slate-600">
            This removes the project from the RCA dashboard. The sealed default project stays protected.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isWorking}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-lg shadow-red-950/15 transition hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isWorking}
            onClick={onConfirm}
            type="button"
          >
            <Trash2 aria-hidden="true" size={15} />
            {isWorking ? 'Deleting...' : 'Delete project'}
          </button>
        </div>
      </section>
    </div>
  );

}

function RcaCanvasDestructiveActionDialog({
  action,
  isCompleteFishboneStructureSelection,
  isWorking,
  node,
  onCancel,
  onConfirm,
  selectedEdgeCount,
  selectedNodeCount,
  totalNodeCount
}: {
  action: RcaCanvasDestructiveAction | null;
  isCompleteFishboneStructureSelection: boolean;
  isWorking: boolean;
  node: RcaNode | null;
  onCancel: () => void;
  onConfirm: () => void;
  selectedEdgeCount: number;
  selectedNodeCount: number;
  totalNodeCount: number;
}) {
  React.useEffect(() => {
    if (!action) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isWorking) {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action, isWorking, onCancel]);

  if (!action) {
    return null;
  }

  const copy = getRcaCanvasDestructiveActionCopy(
    action,
    node,
    selectedNodeCount,
    selectedEdgeCount,
    totalNodeCount,
    isCompleteFishboneStructureSelection
  );

  return (
    <div className="fixed inset-0 z-[135] grid place-items-center bg-transparent px-4" role="alertdialog" aria-modal="true" aria-labelledby="rca-destructive-action-title">
      <button
        aria-label="Cancel destructive canvas action"
        className="absolute inset-0 cursor-default"
        disabled={isWorking}
        onClick={onCancel}
        type="button"
      />
      <section className="rca-modal-pop relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_34px_90px_rgba(15,23,42,0.32),0_10px_28px_rgba(15,23,42,0.18),0_0_0_1px_rgba(255,255,255,0.8)] ring-1 ring-slate-900/5">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <AlertTriangle aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">{copy.eyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold leading-6 text-slate-950" id="rca-destructive-action-title">
              {copy.title}
            </h2>
          </div>
          <button
            aria-label="Close confirmation"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isWorking}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-900">
            {copy.summary}
          </p>
          <p className="mt-3 text-sm leading-5 text-slate-600">
            {copy.body}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isWorking}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-lg shadow-red-950/15 transition hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isWorking}
            onClick={onConfirm}
            type="button"
          >
            <Trash2 aria-hidden="true" size={15} />
            {isWorking ? 'Working...' : copy.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function getRcaCanvasDestructiveActionCopy(
  action: RcaCanvasDestructiveAction,
  node: RcaNode | null,
  selectedNodeCount: number,
  selectedEdgeCount: number,
  totalNodeCount: number,
  isCompleteFishboneStructureSelection: boolean
) {
  if (action.kind === 'CLEAR_CANVAS') {
    return {
      body: 'This removes the entire canvas for this RCA session, including the Fishbone structure, causes, sticky notes, evidence nodes, and all connections. Undo can restore the previous canvas state.',
      confirmLabel: 'Clear canvas',
      eyebrow: 'Clear canvas',
      summary: `${totalNodeCount} canvas item${totalNodeCount === 1 ? '' : 's'} will be removed.`,
      title: 'Clear everything from this canvas?'
    };
  }

  if (action.kind === 'DELETE_NODE') {
    const label = node?.label?.trim() || formatNodeType(node?.nodeType || 'CAUSE');

    return {
      body: 'This deletes the selected canvas item and its saved collaboration record. Undo can restore the previous canvas state.',
      confirmLabel: 'Delete item',
      eyebrow: 'Delete item',
      summary: label,
      title: 'Delete this canvas item?'
    };
  }

  return {
    body: isCompleteFishboneStructureSelection
      ? 'The complete Fishbone structure is selected, so this will remove the protected scaffold along with any selected canvas content. Undo can restore the previous canvas state.'
      : 'Selected nodes will be deleted. Selected splines will be detached from their connected child nodes. Undo can restore the previous canvas state.',
    confirmLabel: 'Delete selected',
    eyebrow: 'Delete selected',
    summary: `${selectedNodeCount} selected node${selectedNodeCount === 1 ? '' : 's'} and ${selectedEdgeCount} selected spline${selectedEdgeCount === 1 ? '' : 's'}.`,
    title: 'Delete selected canvas items?'
  };
}

function RcaAppErrorDialog({
  message,
  onClose
}: {
  message: string;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!message) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-transparent px-4" role="alertdialog" aria-modal="true" aria-labelledby="rca-error-title">
      <button
        aria-label="Close alert"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="rca-modal-pop relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_34px_90px_rgba(15,23,42,0.32),0_10px_28px_rgba(15,23,42,0.18),0_0_0_1px_rgba(255,255,255,0.8)] ring-1 ring-slate-900/5">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <AlertTriangle aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">RCA alert</p>
            <h2 className="mt-1 text-lg font-semibold leading-6 text-slate-950" id="rca-error-title">
              Something needs attention
            </h2>
          </div>
          <button
            aria-label="Close alert"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-5 text-slate-700">
            {message}
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
            onClick={onClose}
            type="button"
          >
            OK
          </button>
        </div>
      </section>
    </div>
  );
}

function RcaProjectThumbnail({
  nodes,
  rpnScore,
  variant
}: {
  nodes?: RcaNode[];
  rpnScore: number;
  variant: 'incident' | 'reference';
}) {
  const isCritical = rpnScore >= 25;
  const activeNodes = React.useMemo(() => (
    (nodes || []).filter((node) => node.status !== 'DELETED')
  ), [nodes]);

  return (
    <div className="relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 bg-[radial-gradient(rgba(100,116,139,0.22)_1px,transparent_1px)] [background-size:10px_10px]">
      {activeNodes.length ? (
        <RcaProjectCanvasSnapshot nodes={activeNodes} />
      ) : variant === 'reference' ? (
        <>
          <div className="absolute inset-x-5 top-1/2 h-px bg-cyan-500/45" />
          <div className="absolute right-5 top-[calc(50%-14px)] h-7 w-20 rounded-lg border border-cyan-200 bg-white shadow-sm" />
          <div className={`absolute right-7 top-[calc(50%-6px)] h-2 w-12 rounded-full ${isCritical ? 'bg-red-200' : 'bg-cyan-200'}`} />
          {[0, 1, 2].map((index) => (
            <div className="absolute h-px origin-right rotate-[-31deg] bg-cyan-500/55" key={`top-${index}`} style={{ right: 112 + index * 32, top: 42 + index * 10, width: 78 }} />
          ))}
          {[0, 1, 2].map((index) => (
            <div className="absolute h-px origin-right rotate-[31deg] bg-cyan-500/55" key={`bottom-${index}`} style={{ right: 112 + index * 32, top: 98 - index * 10, width: 78 }} />
          ))}
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              className="absolute h-7 w-16 rounded-lg border border-slate-200 bg-white shadow-sm"
              key={index}
              style={{
                left: 22 + (index % 3) * 78,
                top: index < 3 ? 18 + index * 8 : 88 - (index - 3) * 8
              }}
            />
          ))}
        </>
      ) : (
        <>
          <div className="absolute inset-x-5 top-1/2 h-px bg-cyan-500/45" />
          <div className="absolute right-5 top-[calc(50%-14px)] h-7 w-20 rounded-lg border border-cyan-200 bg-white shadow-sm" />
          <div className={`absolute right-7 top-[calc(50%-6px)] h-2 w-12 rounded-full ${isCritical ? 'bg-red-200' : 'bg-cyan-200'}`} />
          <div className="absolute left-6 top-7 h-8 w-24 rounded-lg border border-slate-200 bg-white shadow-sm" />
          <div className="absolute left-20 top-20 h-8 w-28 rounded-lg border border-slate-200 bg-white shadow-sm" />
          <div className="absolute left-40 top-48 hidden h-8 w-24 rounded-lg border border-slate-200 bg-white shadow-sm" />
          <div className="absolute left-[76px] top-[52px] h-10 w-px bg-cyan-500/45" />
          <div className="absolute left-[76px] top-[72px] h-px w-24 bg-cyan-500/45" />
        </>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full border border-white/70 bg-white/92 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 shadow-sm">
        <Gauge aria-hidden="true" size={10} />
        RPN {rpnScore}
      </div>
    </div>
  );
}

function RcaProjectCanvasSnapshot({ nodes }: { nodes: RcaNode[] }) {
  const snapshot = React.useMemo(() => buildRcaProjectCanvasSnapshot(nodes), [nodes]);

  if (!snapshot) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 ${snapshot.width} ${snapshot.height}`}
    >
      <defs>
        <marker
          id="rca-project-card-arrow"
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="7"
          refY="4"
          viewBox="0 0 8 8"
        >
          <path d="M0,1 L7,4 L0,7 Z" fill="#0284c7" opacity="0.72" />
        </marker>
      </defs>
      {snapshot.edges.map((edge) => (
        <path
          d={`M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX + edge.curveOffset} ${edge.sourceY}, ${edge.targetX - edge.curveOffset} ${edge.targetY}, ${edge.targetX} ${edge.targetY}`}
          fill="none"
          key={`${edge.sourceId}-${edge.targetId}`}
          markerEnd="url(#rca-project-card-arrow)"
          stroke={edge.color}
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      ))}
      {snapshot.nodes.map((node) => (
        <g key={node.id}>
          <rect
            fill={node.fill}
            height={node.height}
            rx={8}
            stroke={node.stroke}
            strokeWidth={1.2}
            width={node.width}
            x={node.x}
            y={node.y}
          />
          {node.labelBar ? (
            <rect
              fill={node.labelBar}
              height={7}
              rx={3.5}
              width={Math.min(58, Math.max(28, node.width * 0.38))}
              x={node.x + node.width - Math.min(72, node.width * 0.46)}
              y={node.y + 10}
            />
          ) : null}
          {node.isCategory ? (
            <circle cx={node.x + node.width / 2} cy={node.y - 2} fill="#0891b2" r={2.7} />
          ) : null}
        </g>
      ))}
    </svg>
  );
}

function RcaCanvasBackButton({
  canInviteCollaborators,
  canRedo,
  canUndo,
  isCollaboratorInviteOpen,
  isWorking,
  onBackToDashboard,
  onInviteCollaborators,
  onRedo,
  onUndo
}: {
  canInviteCollaborators: boolean;
  canRedo: boolean;
  canUndo: boolean;
  isCollaboratorInviteOpen: boolean;
  isWorking: boolean;
  onBackToDashboard: () => void;
  onInviteCollaborators: () => void;
  onRedo: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="absolute left-4 top-4 z-[55] inline-flex h-10 items-center gap-1 rounded-full border border-white/70 bg-white/86 p-1 text-slate-600 shadow-xl shadow-slate-900/12 ring-1 ring-slate-900/5 backdrop-blur-xl max-lg:left-3 max-lg:top-3">
      <button
        aria-label="Back to RCA dashboard"
        className="grid h-8 w-8 place-items-center rounded-full transition hover:-translate-y-0.5 hover:bg-white hover:text-cyan-700 active:scale-95"
        onClick={onBackToDashboard}
        title="Back to RCA dashboard"
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      <span className="h-5 w-px bg-slate-200" />
      <RcaHistoryControlButton
        disabled={!canUndo || isWorking}
        icon={Undo2}
        label="Undo"
        onClick={onUndo}
        shortcut="⌘Z"
      />
      <RcaHistoryControlButton
        disabled={!canRedo || isWorking}
        icon={Redo2}
        label="Redo"
        onClick={onRedo}
        shortcut="⌘⇧Z"
      />
      <span className="h-5 w-px bg-slate-200" />
      <button
        aria-label="Invite Colaborator"
        aria-pressed={isCollaboratorInviteOpen}
        className={`grid h-8 w-8 place-items-center rounded-full transition hover:-translate-y-0.5 hover:bg-white hover:text-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:bg-transparent disabled:hover:text-slate-600 ${
          isCollaboratorInviteOpen ? 'bg-cyan-50 text-cyan-700' : ''
        }`}
        disabled={!canInviteCollaborators || isWorking}
        onClick={onInviteCollaborators}
        title="Invite Colaborator"
        type="button"
      >
        <UserPlus aria-hidden="true" size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

function RcaHistoryControlButton({
  disabled,
  icon: Icon,
  label,
  onClick,
  shortcut
}: {
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  shortcut: string;
}) {
  return (
    <button
      aria-label={`${label} canvas action`}
      className="grid h-8 w-8 place-items-center rounded-full transition hover:-translate-y-0.5 hover:bg-white hover:text-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:bg-transparent disabled:hover:text-slate-600"
      disabled={disabled}
      onClick={onClick}
      title={`${label} (${shortcut})`}
      type="button"
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2} />
    </button>
  );
}

function RcaRemovedAccessDialog({
  notice,
  onClose
}: {
  notice: {
    incident: RcaIncident;
    removedAtIso: string;
    removedByName: string;
  } | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!notice) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notice, onClose]);

  if (!notice) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25 ring-1 ring-slate-900/5">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-600">Collaboration Access Removed</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">You were removed from this RCA project</h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-slate-600">
          <p>
            {notice.removedByName} removed your collaboration access. You have been returned to the RCA Projects page.
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="font-semibold text-slate-900">{notice.incident.title}</p>
            <p className="mt-1 text-xs text-slate-500">{notice.incident.assetId}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              Removed {formatAuditDate(notice.removedAtIso)}
            </p>
          </div>
        </div>
        <div className="border-t border-slate-100 px-5 py-4">
          <button
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]"
            onClick={onClose}
            type="button"
          >
            Return to RCA Projects
          </button>
        </div>
      </div>
    </div>
  );
}

function RcaCollaboratorInvitePanel({
  candidates,
  invitedUsers,
  isLoading,
  isOpen,
  isRemovingUid,
  isSending,
  onCancel,
  onQueryChange,
  onRemoveInvited,
  onRemoveSelected,
  onSelect,
  onSend,
  query,
  selectedUsers
}: {
  candidates: RcaUserSummary[];
  invitedUsers: RcaUserSummary[];
  isLoading: boolean;
  isOpen: boolean;
  isRemovingUid: string | null;
  isSending: boolean;
  onCancel: () => void;
  onQueryChange: (query: string) => void;
  onRemoveInvited: (user: RcaUserSummary) => void;
  onRemoveSelected: (uid: string) => void;
  onSelect: (user: RcaUserSummary) => void;
  onSend: () => void;
  query: string;
  selectedUsers: RcaUserSummary[];
}) {
  const selectedUserIds = new Set(selectedUsers.map((user) => user.uid));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCandidates = candidates.filter((user) => {
    if (selectedUserIds.has(user.uid)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return `${user.displayName} ${user.roleName} ${user.departmentName || ''}`.toLowerCase().includes(normalizedQuery);
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute left-4 top-16 z-[70] w-[360px] overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-slate-950/18 ring-1 ring-slate-900/5 backdrop-blur-xl max-sm:left-3 max-sm:right-3 max-sm:w-auto">
      <div className="border-b border-slate-100 p-3">
        <label className="block">
          <span className="sr-only">Search company users</span>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white focus:ring-4"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search users"
            value={query}
          />
        </label>

        <div className="mt-3 min-h-[42px]">
          {selectedUsers.length ? (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <button
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100"
                  key={user.uid}
                  onClick={() => onRemoveSelected(user.uid)}
                  title={`Remove ${user.displayName}`}
                  type="button"
                >
                  <RcaUserAvatar size="sm" user={user} />
                  <span className="max-w-[180px] truncate">{user.displayName}</span>
                  <X aria-hidden="true" size={12} />
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Select users to stage collaborators.
            </p>
          )}
        </div>

        <div className="mt-3 h-px bg-slate-200" />

        <button
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!selectedUsers.length || isSending}
          onClick={onSend}
          type="button"
        >
          <UserPlus aria-hidden="true" size={14} />
          {isSending ? 'Sending invite' : 'Send Invite'}
        </button>
      </div>

      <div className="border-b border-slate-100 px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Invited Users</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {invitedUsers.length}
          </span>
        </div>
        {invitedUsers.length ? (
          <div className="max-h-32 space-y-1 overflow-auto">
            {invitedUsers.map((user) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-2.5 py-2"
                key={user.uid}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <RcaUserAvatar size="sm" user={user} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-800">{user.displayName}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {user.roleName}{user.departmentName ? ` / ${user.departmentName}` : ''}
                    </span>
                  </span>
                </span>
                <button
                  aria-label={`Remove ${user.displayName} from RCA collaboration`}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-red-100 bg-white text-red-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(isRemovingUid)}
                  onClick={() => onRemoveInvited(user)}
                  title={`Remove ${user.displayName}`}
                  type="button"
                >
                  {isRemovingUid === user.uid ? (
                    <RefreshCw aria-hidden="true" className="animate-spin" size={13} />
                  ) : (
                    <X aria-hidden="true" size={13} />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            No users invited yet.
          </p>
        )}
      </div>

      <div className="max-h-[300px] overflow-auto p-2">
        {isLoading ? (
          <div className="px-3 py-6 text-center text-sm text-slate-500">Loading users...</div>
        ) : visibleCandidates.length ? (
          visibleCandidates.map((user) => (
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50 active:scale-[0.99]"
              key={user.uid}
              onClick={() => onSelect(user)}
              type="button"
            >
              <RcaUserAvatar user={user} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-950">{user.displayName}</span>
                <span className="block truncate text-xs text-slate-500">
                  {user.roleName}{user.departmentName ? ` / ${user.departmentName}` : ''}
                </span>
              </span>
            </button>
          ))
        ) : (
          <div className="px-3 py-6 text-center text-sm text-slate-500">
            No users found.
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 p-2">
        <button
          className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RcaUserAvatar({
  size = 'md',
  user
}: {
  size?: 'sm' | 'md' | 'lg';
  user: RcaUserSummary;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const dimensionClassName = size === 'lg'
    ? 'h-10 w-10 text-sm'
    : size === 'sm'
      ? 'h-6 w-6 text-[10px]'
      : 'h-9 w-9 text-xs';

  React.useEffect(() => {
    let isMounted = true;

    if (!user.profilePhotoUrl) {
      setObjectUrl(null);
      return undefined;
    }

    void getRcaAuthenticatedObjectUrl(user.profilePhotoUrl).then((nextObjectUrl) => {
      if (isMounted) {
        setObjectUrl(nextObjectUrl);
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
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-cyan-100 font-semibold text-cyan-800 ring-1 ring-white ${dimensionClassName}`}>
      {objectUrl ? (
        <img alt="" className="h-full w-full object-cover" src={objectUrl} />
      ) : (
        getInitials(user.displayName)
      )}
    </span>
  );
}

function RcaWarRoomHeader({
  context,
  incident,
  incidents,
  isReferenceProjectActive,
  isIncidentShelfOpen,
  isLoading,
  onIncidentTitleChange,
  onOpenReferenceProject,
  onOpenIncidentLauncher,
  onRefreshIncidentQueue,
  onSelectIncident,
  onTitleSavingChange,
  onToggleIncidentShelf,
  selectedIncidentId,
  summary
}: {
  context: RcaWorkspaceContext | null;
  incident: RcaIncident | null;
  incidents: RcaIncident[];
  isReferenceProjectActive: boolean;
  isIncidentShelfOpen: boolean;
  isLoading: boolean;
  onIncidentTitleChange: (title: string) => Promise<void> | void;
  onOpenReferenceProject: () => void;
  onOpenIncidentLauncher: () => void;
  onRefreshIncidentQueue: () => void;
  onSelectIncident: (incidentId: string) => void;
  onTitleSavingChange: (isSaving: boolean) => void;
  onToggleIncidentShelf: () => void;
  selectedIncidentId: string | null;
  summary: RcaWorkspaceResponse['summary'];
}) {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const incidentTitle = incident?.title || 'Untitled RCA project';
  const [titleDraft, setTitleDraft] = React.useState(incidentTitle);
  const [titleSaveState, setTitleSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const titleSaveRequestRef = React.useRef(0);

  React.useEffect(() => {
    setTitleDraft(incidentTitle);
    setTitleSaveState('idle');
  }, [incident?.id, incidentTitle]);

  const commitTitle = React.useCallback(async (nextTitle: string) => {
    const trimmedTitle = nextTitle.trim();

    if (!incident) {
      return;
    }

    if (!trimmedTitle) {
      setTitleDraft(incidentTitle);
      setTitleSaveState('idle');
      return;
    }

    if (trimmedTitle === incidentTitle) {
      setTitleDraft(incidentTitle);
      setTitleSaveState('idle');
      return;
    }

    const requestId = titleSaveRequestRef.current + 1;
    titleSaveRequestRef.current = requestId;
    setTitleSaveState('saving');

    try {
      await onIncidentTitleChange(trimmedTitle);

      if (titleSaveRequestRef.current === requestId) {
        setTitleDraft(trimmedTitle);
        setTitleSaveState('saved');
        window.setTimeout(() => {
          if (titleSaveRequestRef.current === requestId) {
            setTitleSaveState('idle');
          }
        }, 1200);
      }
    } catch {
      if (titleSaveRequestRef.current === requestId) {
        setTitleSaveState('error');
      }
    }
  }, [incident, incidentTitle, onIncidentTitleChange]);

  React.useEffect(() => {
    const trimmedTitle = titleDraft.trim();

    if (!incident || !trimmedTitle || trimmedTitle === incidentTitle) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      void commitTitle(titleDraft);
    }, 850);

    return () => window.clearTimeout(saveTimer);
  }, [commitTitle, incident, incidentTitle, titleDraft]);

  React.useEffect(() => {
    onTitleSavingChange(titleSaveState === 'saving');

    return () => onTitleSavingChange(false);
  }, [onTitleSavingChange, titleSaveState]);

  return (
    <>
      <div className={`absolute left-4 top-16 z-40 flex max-w-[min(680px,calc(100%-470px))] items-start gap-3 transition-[opacity,transform] duration-300 ease-out max-lg:left-3 max-lg:right-3 max-lg:top-16 max-lg:max-w-none ${
        isCollapsed ? 'pointer-events-none -translate-x-[calc(100%+28px)] opacity-0' : 'translate-x-0 opacity-100'
      }`}>
        <div className="w-[390px] max-w-[calc(100vw-32px)] max-lg:w-full max-lg:max-w-none">
          <section className="min-w-0 rounded-[22px] border border-white/60 bg-white/78 px-4 py-3 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    {isReferenceProjectActive ? <Flame aria-hidden="true" className="shrink-0" size={13} /> : <Bell aria-hidden="true" className="shrink-0" size={13} />}
                    <span className="truncate">
                      {incident
                        ? isReferenceProjectActive
                          ? `Sealed enterprise RCA project - RPN ${incident.rpnScore}`
                          : `New RCA incident - RPN ${incident.rpnScore}`
                        : 'RCA war room'}
                    </span>
                  </div>
                </div>
                <input
                  aria-label="RCA project title"
                  className={`mt-1 h-8 w-full rounded-xl border bg-white/0 px-0 text-base font-normal leading-tight tracking-normal text-slate-950 outline-none transition focus:border-cyan-200 focus:bg-white/75 focus:px-2 focus:ring-4 focus:ring-cyan-500/10 ${
                    titleSaveState === 'error' ? 'border-red-200 text-red-700' : 'border-transparent'
                  }`}
                  disabled={!incident}
                  maxLength={180}
                  onBlur={(event) => void commitTitle(event.currentTarget.value)}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setTitleDraft(incidentTitle);
                      event.currentTarget.blur();
                    }
                  }}
                  placeholder="Untitled RCA project"
                  title="Rename project"
                  value={titleDraft}
                />
              </div>
              <button
                aria-label="Minimize case summary"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95"
                onClick={() => setIsCollapsed(true)}
                title="Minimize case summary"
                type="button"
              >
                <PanelTopClose aria-hidden="true" size={16} />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex h-7 items-center gap-1 rounded-full bg-slate-950 px-2.5 font-semibold text-white">
                <Gauge aria-hidden="true" size={12} />
                {isReferenceProjectActive ? `RPN ${incident?.rpnScore || 27}` : `Avg RPN ${summary.averageRpn}`}
              </span>
              {isReferenceProjectActive ? (
                <span className="inline-flex h-7 items-center gap-1 rounded-full bg-emerald-50 px-2.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <PackageCheck aria-hidden="true" size={12} />
                  Audit package ready
                </span>
              ) : null}
              <span className="truncate">{context ? `${context.company.companyName} / ${context.department.name}` : 'Loading tenant workspace...'}</span>
              {incident ? <span className="truncate">{incident.assetId}</span> : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 active:scale-95 ${
                  isReferenceProjectActive
                    ? 'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-cyan-950/5'
                    : 'border-slate-200 bg-white/90 text-slate-700 hover:border-cyan-300 hover:text-cyan-700'
                }`}
                onClick={onOpenReferenceProject}
                type="button"
              >
                <Sparkles aria-hidden="true" size={15} />
                Fire case
              </button>
              <button
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-cyan-700 active:scale-95"
                onClick={onOpenIncidentLauncher}
                type="button"
              >
                <Plus aria-hidden="true" size={15} />
                Incident
              </button>
            </div>
          </section>

          {isIncidentShelfOpen ? (
            <RcaIncidentShelf
              incidents={incidents}
              isReferenceProjectActive={isReferenceProjectActive}
              isLoading={isLoading}
              onOpenReferenceProject={onOpenReferenceProject}
              onRefresh={onRefreshIncidentQueue}
              onSelectIncident={onSelectIncident}
              selectedIncidentId={selectedIncidentId}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            aria-expanded={isIncidentShelfOpen}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/60 bg-white/78 px-3 text-xs font-semibold text-slate-800 shadow-xl shadow-slate-900/10 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white active:scale-95"
            onClick={onToggleIncidentShelf}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" size={15} />
            Queue
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] leading-none text-white">{summary.criticalIncidents}</span>
            <ChevronDown aria-hidden="true" size={13} />
          </button>
          {incidents.length > 1 ? (
            <select
              className="h-9 max-w-40 rounded-full border border-white/60 bg-white/78 px-3 text-xs font-semibold text-slate-800 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none transition hover:bg-white"
              onChange={(event) => {
                if (event.target.value === REFERENCE_PROJECT_INCIDENT_ID) {
                  onOpenReferenceProject();
                  return;
                }

                onSelectIncident(event.target.value);
              }}
              value={isReferenceProjectActive ? REFERENCE_PROJECT_INCIDENT_ID : selectedIncidentId || ''}
            >
              <option value={REFERENCE_PROJECT_INCIDENT_ID}>Fire under oven audit project</option>
              {incidents.map((incidentOption) => (
                <option key={incidentOption.id} value={incidentOption.id}>
                  {incidentOption.title || incidentOption.assetId}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <button
        aria-label="Open case summary"
        className={`absolute left-0 top-24 z-50 flex h-40 w-10 flex-col items-center justify-center gap-2 rounded-r-2xl border border-cyan-500/30 bg-cyan-600 text-white shadow-2xl shadow-cyan-950/20 ring-1 ring-white/30 transition-[opacity,transform,box-shadow] duration-300 ease-out hover:bg-cyan-500 hover:shadow-cyan-950/30 active:scale-95 ${
          isCollapsed ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-5 opacity-0'
        }`}
        onClick={() => setIsCollapsed(false)}
        title="Open case summary"
        type="button"
      >
        <PanelTopOpen aria-hidden="true" size={16} />
        <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">Case summary</span>
      </button>
    </>
  );
}

function RcaPresenceBar({
  collaborators,
  context,
  isOffset = false,
  owner,
  participants,
  realtimeStatus
}: {
  collaborators: RcaUserSummary[];
  context: RcaWorkspaceContext | null;
  isOffset?: boolean;
  owner: RcaUserSummary | null;
  participants: RcaRealtimePresenceUser[];
  realtimeStatus: 'connecting' | 'connected' | 'subscribed' | 'disconnected';
}) {
  const ownerUser: RcaUserSummary = owner || {
    departmentName: context?.department.name || null,
    displayName: context?.user.displayName || 'Signed in user',
    profilePhotoCacheKey: null,
    profilePhotoUrl: null,
    roleName: context?.user.roleName || 'User',
    uid: context?.user.uid || 'current-user'
  };
  const displayName = ownerUser.displayName;
  const initials = getInitials(displayName);
  const activeUserIds = React.useMemo(() => new Set(participants.map((participant) => participant.uid)), [participants]);
  const visibleCollaborators = React.useMemo(() => {
    const usersByUid = new Map(collaborators.map((user) => [user.uid, user]));

    participants.forEach((participant) => {
      if (participant.uid !== ownerUser.uid && !usersByUid.has(participant.uid)) {
        usersByUid.set(participant.uid, participant);
      }
    });

    return [...usersByUid.values()];
  }, [collaborators, ownerUser.uid, participants]);
  const isOwnerActive = activeUserIds.has(ownerUser.uid);
  const statusLabel = realtimeStatus === 'subscribed'
    ? `${Math.max(participants.length, 1)} active`
    : realtimeStatus === 'connecting'
      ? 'Connecting'
      : realtimeStatus === 'connected'
        ? 'Joining'
        : 'Offline';

  return (
    <div className={`absolute top-5 z-40 flex items-center gap-3 rounded-3xl border border-white/50 bg-white/72 px-3 py-2 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur-xl transition-[right] duration-300 ease-out max-lg:hidden ${
      isOffset ? 'right-20' : 'right-5'
    }`}>
      <div className="flex items-start gap-2">
        <div className="group relative flex w-9 shrink-0 flex-col items-center gap-0.5">
          {ownerUser.profilePhotoUrl ? (
            <RcaUserAvatar user={ownerUser} />
          ) : (
            <div className={`grid h-9 w-9 place-items-center rounded-full border-2 bg-cyan-600 text-xs font-semibold text-white shadow-sm ${
              isOwnerActive ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-white'
            }`}>
              {initials}
            </div>
          )}
          {isOwnerActive ? <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" /> : null}
          <div className="pointer-events-none absolute left-1/2 top-12 z-[95] hidden w-48 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-xl shadow-slate-950/12 ring-1 ring-slate-900/5 group-hover:block">
            <span className="mb-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
              Owner
            </span>
            <p className="truncate text-xs font-semibold text-slate-950">{displayName}</p>
            <p className="mt-1 truncate text-[11px] text-slate-500">{ownerUser.departmentName || 'Unassigned department'}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{ownerUser.roleName || 'User'}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
              {isOwnerActive ? 'Active now' : 'Not active'}
            </p>
          </div>
        </div>
        {visibleCollaborators.map((user) => (
          <RcaInvitedCollaboratorAvatar
            isActive={activeUserIds.has(user.uid)}
            key={user.uid}
            user={user}
          />
        ))}
      </div>
      <div className="min-w-0">
        <div className={`flex items-center gap-1 text-xs font-semibold ${
          realtimeStatus === 'subscribed' ? 'text-emerald-700' : 'text-slate-500'
        }`}>
          <Users aria-hidden="true" size={13} />
          Live canvas
        </div>
        <p className="truncate text-xs text-slate-500">
          {visibleCollaborators.length ? `${statusLabel} • ${collaborators.length} invited` : statusLabel}
        </p>
      </div>
    </div>
  );
}

function RcaInvitedCollaboratorAvatar({
  isActive,
  user
}: {
  isActive: boolean;
  user: RcaUserSummary;
}) {
  return (
    <div className="group relative flex w-9 shrink-0 flex-col items-center gap-0.5">
      <RcaUserAvatar user={user} />
      {isActive ? <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" /> : null}
      <span className="max-w-9 truncate text-[9px] font-semibold leading-none text-slate-500">
        {getInitials(user.displayName)}
      </span>
      <div className="pointer-events-none absolute left-1/2 top-12 z-[95] hidden w-48 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-xl shadow-slate-950/12 ring-1 ring-slate-900/5 group-hover:block">
        <span className="mb-1 inline-flex rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-100">
          Invited
        </span>
        <p className="truncate text-xs font-semibold text-slate-950">{user.displayName}</p>
        <p className="mt-1 truncate text-[11px] text-slate-500">{user.departmentName || 'Unassigned department'}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{user.roleName}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
          {isActive ? 'Active now' : 'Not active'}
        </p>
      </div>
    </div>
  );
}

const RCA_KNOWLEDGE_SECTIONS = [
  {
    heading: 'Start Clean',
    items: [
      'Create one Incident node first. Treat it as the parent container for the entire RCA.',
      'Capture only verified facts in the Incident and Incident Details nodes.',
      'Use Containment before analysis so the issue is controlled while the team investigates.'
    ]
  },
  {
    heading: 'Build The Logic',
    items: [
      'Use Main View to organize the RCA around branches, causes, evidence, and action nodes.',
      'Connect nodes from output points to input points so the RCA trail is readable left-to-right or top-to-bottom.',
      'Use Sticky Notes for comments and coaching notes, not as evidence or final findings.'
    ]
  },
  {
    heading: 'Evidence Standard',
    items: [
      'Attach photos, records, measurements, logs, interviews, SOPs, batch data, and verification documents to the node they prove.',
      'Do not mark a root cause because it sounds likely. Mark it only when evidence supports it.',
      'Keep links traceable and readable by the RCA team.'
    ]
  },
  {
    heading: 'CAPA Closure',
    items: [
      'Corrective actions must fix the verified root cause.',
      'Preventive actions must reduce recurrence risk across the system.',
      'Close only after risk review, effectiveness verification, lessons learned, and approval are complete.'
    ]
  }
];

type RcaKnowledgePanelMode = 'answer' | 'guide' | 'selection';

function RcaKnowledgeBasePanel({
  incident,
  isOpen,
  nodes,
  onAsk,
  onToggle,
  selectedNode,
  selectedSplineCount,
  session
}: {
  incident: RcaIncident | null;
  isOpen: boolean;
  nodes: RcaNode[];
  onAsk: (question: string) => Promise<RcaKnowledgeAskResponse>;
  onToggle: () => void;
  selectedNode: RcaNode | null;
  selectedSplineCount: number;
  session: RcaSession | null;
}) {
  const [question, setQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState<RcaKnowledgeAskResponse | null>(null);
  const [panelMode, setPanelMode] = React.useState<RcaKnowledgePanelMode>('guide');
  const [panelWidth, setPanelWidth] = React.useState(RCA_KNOWLEDGE_PANEL_DEFAULT_WIDTH);
  const [isAsking, setIsAsking] = React.useState(false);
  const [askError, setAskError] = React.useState('');
  const canAsk = question.trim().length >= 3 && !isAsking;
  const selectedItemSummary = selectedNode
    ? getRcaKnowledgeSelectedNodeSummary(selectedNode, nodes)
    : selectedSplineCount > 0
      ? getRcaKnowledgeSelectedSplineSummary(selectedSplineCount)
      : null;
  const evidenceNodeCount = nodes.filter((node) => getFiveWhysNodeRole(node) === 'EVIDENCE').length;
  const rootCauseCount = nodes.filter((node) => node.isRootCause || getFiveWhysNodeRole(node) === 'ROOT_CAUSE').length;
  const capaNodeCount = nodes.filter((node) => {
    const role = getFiveWhysNodeRole(node);

    return role === 'CAPA' ||
      role === 'CORRECTIVE_ACTION' ||
      role === 'PREVENTIVE_ACTION' ||
      role === 'RISK_ASSESSMENT' ||
      role === 'EFFECTIVENESS' ||
      role === 'LESSONS_LEARNED' ||
      role === 'APPROVAL_CLOSURE';
  }).length;

  React.useEffect(() => {
    if (isOpen && selectedItemSummary) {
      setPanelMode('selection');
    }
  }, [isOpen, selectedItemSummary?.title, selectedItemSummary?.subtitle]);

  React.useEffect(() => {
    function handleResize() {
      setPanelWidth((currentWidth) => Math.min(currentWidth, getRcaKnowledgePanelMaxWidth()));
    }

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canAsk) {
      return;
    }

    const submittedQuestion = question.trim();

    setQuestion('');
    setIsAsking(true);
    setAskError('');

    try {
      const result = await onAsk(submittedQuestion);

      setAnswer(result);
      setPanelMode('answer');
    } catch (error) {
      setAskError(error instanceof Error ? error.message : 'RCA guidance is temporarily unavailable.');
    } finally {
      setIsAsking(false);
    }
  }

  function handleResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = panelWidth;

    function handlePointerMove(pointerEvent: PointerEvent) {
      const nextWidth = startWidth + pointerEvent.clientX - startX;

      setPanelWidth(clampRcaKnowledgePanelWidth(nextWidth));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label="Open RCA knowledge base"
        className={`absolute left-[184px] top-4 grid h-11 w-11 place-items-center rounded-2xl border border-white/60 bg-white/84 text-slate-700 shadow-2xl shadow-slate-900/12 ring-1 ring-slate-900/5 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:text-cyan-700 active:scale-95 max-lg:left-[176px] max-lg:top-3 ${
          isOpen ? 'z-[58] border-cyan-200 text-cyan-700 opacity-35' : 'z-[70]'
        }`}
        onClick={onToggle}
        title="RCA knowledge base"
        type="button"
      >
        <BookOpen aria-hidden="true" size={20} />
      </button>

      <aside
        aria-label="RCA knowledge base"
        className={`rca-knowledge-drawer fixed bottom-0 left-0 top-16 z-[69] flex max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-r-3xl border-r border-slate-200/80 bg-white/96 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-900/5 backdrop-blur-2xl ${
          isOpen
            ? 'rca-knowledge-drawer-open pointer-events-auto'
            : 'rca-knowledge-drawer-closed pointer-events-none'
        }`}
        style={{ width: panelWidth }}
      >
        <button
          aria-label="Resize RCA knowledge panel"
          className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-transparent transition hover:bg-cyan-400/20 active:bg-cyan-400/30"
          onPointerDown={handleResizeStart}
          type="button"
        />
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Knowledge Base</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-950">Node-based RCA guidance</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition active:scale-95 ${
                panelMode === 'guide'
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
              onClick={() => setPanelMode('guide')}
              type="button"
            >
              <BookOpen aria-hidden="true" size={14} />
              Guide
            </button>
            <button
              className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 active:scale-95"
              onClick={onToggle}
              type="button"
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
            {panelMode === 'answer' && answer ? (
              <RcaKnowledgeAnswerView answer={answer} />
            ) : panelMode === 'selection' && selectedItemSummary ? (
              <RcaKnowledgeSelectionView summary={selectedItemSummary} />
            ) : (
              <RcaKnowledgeGuideView
                capaNodeCount={capaNodeCount}
                evidenceNodeCount={evidenceNodeCount}
                incident={incident}
                nodes={nodes}
                rootCauseCount={rootCauseCount}
                session={session}
              />
            )}
          </div>

          <section className="border-t border-slate-200/80 bg-white/95 p-4 shadow-[0_-14px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-2">
              <Bot aria-hidden="true" className="text-cyan-700" size={18} />
              <h3 className="text-sm font-bold text-slate-950">Ask RCA AI</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Ask about RCA flow, node usage, evidence gaps, containment, root cause logic, CAPA, or closure readiness.
            </p>
            <form className="mt-3 flex items-end gap-2" onSubmit={handleSubmit}>
              <textarea
                className="min-h-24 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask how to structure this RCA, what evidence is missing, or how to close CAPA."
                value={question}
              />
              <button
                aria-label={isAsking ? 'Asking RCA AI' : 'Ask RCA AI'}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/16 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none active:scale-95"
                disabled={!canAsk}
                title={isAsking ? 'Asking RCA AI' : 'Ask RCA AI'}
                type="submit"
              >
                {isAsking ? <RefreshCw aria-hidden="true" className="animate-spin" size={16} /> : <Send aria-hidden="true" size={16} />}
              </button>
            </form>
            {askError ? (
              <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {askError}
              </div>
            ) : null}
          </section>
        </div>
      </aside>
    </>
  );
}

interface RcaKnowledgeSelectedItemSummary {
  details: string[];
  guidance: string[];
  subtitle: string;
  title: string;
}

function RcaKnowledgeGuideView({
  capaNodeCount,
  evidenceNodeCount,
  incident,
  nodes,
  rootCauseCount,
  session
}: {
  capaNodeCount: number;
  evidenceNodeCount: number;
  incident: RcaIncident | null;
  nodes: RcaNode[];
  rootCauseCount: number;
  session: RcaSession | null;
}) {
  return (
    <>
      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-slate-800">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100">
            <Workflow aria-hidden="true" size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-950">{incident?.title || 'RCA canvas guide'}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {session
                ? `${nodes.length} nodes, ${evidenceNodeCount} evidence nodes, ${rootCauseCount} root cause nodes, ${capaNodeCount} CAPA nodes.`
                : 'Open an RCA project to ask questions with live canvas context.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {RCA_KNOWLEDGE_SECTIONS.map((section) => (
          <section
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5"
            key={section.heading}
          >
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-700">{section.heading}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600">
              {section.items.map((item) => (
                <li className="flex gap-2" key={item}>
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-cyan-600" size={15} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function RcaKnowledgeAnswerView({
  answer
}: {
  answer: RcaKnowledgeAskResponse;
}) {
  return (
    <section className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 shadow-sm shadow-cyan-950/5">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 ring-1 ring-cyan-100">
          <Sparkles aria-hidden="true" size={12} />
          {answer.source === 'AI' ? 'AI Guidance' : 'System Guide'}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{answer.answer}</p>
    </section>
  );
}

function RcaKnowledgeSelectionView({
  summary
}: {
  summary: RcaKnowledgeSelectedItemSummary;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 ring-1 ring-cyan-100">
        <MousePointer2 aria-hidden="true" size={12} />
        Canvas Item
      </span>
      <h3 className="mt-3 text-base font-bold text-slate-950">{summary.title}</h3>
      <p className="mt-1 text-xs font-semibold text-slate-500">{summary.subtitle}</p>
      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">What It Does</h4>
        <ul className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
          {summary.details.map((detail) => (
            <li className="flex gap-2" key={detail}>
              <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-cyan-600" size={15} />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Best Practice</h4>
        <ul className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
          {summary.guidance.map((guidance) => (
            <li className="flex gap-2" key={guidance}>
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600" size={15} />
              <span>{guidance}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function getRcaKnowledgeSelectedSplineSummary(selectedSplineCount: number): RcaKnowledgeSelectedItemSummary {
  return {
    details: [
      'A spline represents the relationship between two RCA canvas items.',
      'It should connect from an output point to an input point so the investigation logic remains readable.',
      selectedSplineCount > 1
        ? `${selectedSplineCount} splines are currently selected and can be moved or deleted as a group.`
        : 'The selected spline can be styled, moved with selected items, detached, or reconnected where the RCA logic changes.'
    ],
    guidance: [
      'Keep connection direction intentional: parent evidence or logic should feed the child node.',
      'Avoid crossing splines when a small node movement can make the RCA easier to audit.',
      'Reconnect a spline instead of deleting and recreating when the relationship is still valid but points to the wrong item.'
    ],
    subtitle: selectedSplineCount > 1 ? 'Multiple selected splines' : 'Selected RCA connection',
    title: selectedSplineCount > 1 ? 'Selected Splines' : 'Selected Spline'
  };
}

function getRcaKnowledgeSelectedNodeSummary(
  node: RcaNode,
  nodes: RcaNode[]
): RcaKnowledgeSelectedItemSummary {
  const role = getFiveWhysNodeRole(node);
  const roleLabel = node.nodeType === 'STICKY_NOTE'
    ? 'Sticky Note'
    : node.nodeType === 'ISHIKAWA_CATEGORY'
      ? 'Fishbone Branch'
      : node.nodeType === 'FAULT_GATE'
        ? 'Fault Gate'
        : getFiveWhysRoleLabel(role);
  const childCount = nodes.filter((candidateNode) => candidateNode.parentNodeId === node.id).length;
  const evidenceCount = node.attachedEvidence.length;

  if (node.nodeType === 'STICKY_NOTE') {
    return {
      details: [
        'Sticky Notes are lightweight collaboration notes for comments, observations, and team reminders.',
        'They are not evidence by themselves and should not replace an Evidence node.',
        `This note currently has ${childCount} connected child item${childCount === 1 ? '' : 's'}.`
      ],
      guidance: [
        'Use a Sticky Note to coach the investigation or capture a temporary thought.',
        'Connect the note to the exact node it explains so collaborators understand its context.',
        'Convert important findings into formal RCA nodes before closure.'
      ],
      subtitle: node.label || 'Canvas note',
      title: roleLabel
    };
  }

  if (node.nodeType === 'ISHIKAWA_CATEGORY') {
    return {
      details: [
        'A Fishbone Branch groups possible causes by a consistent investigation category.',
        'Branch nodes protect the structure of the Fishbone and should not be deleted individually.',
        `This branch has ${childCount} connected item${childCount === 1 ? '' : 's'}.`
      ],
      guidance: [
        'Place related causes under the correct branch to keep the RCA audit trail organized.',
        'Move causes between branches when evidence shows they belong elsewhere.',
        'Use the full Fishbone structure or Clear Canvas flow when the entire structure must be removed.'
      ],
      subtitle: node.label || 'Fishbone structure branch',
      title: roleLabel
    };
  }

  if (role === 'INCIDENT') {
    return {
      details: [
        'The Incident node is the parent container for the RCA investigation.',
        'It should be created before all other RCA nodes.',
        `This incident node has ${childCount} connected item${childCount === 1 ? '' : 's'}.`
      ],
      guidance: [
        'Keep the incident statement factual and concise.',
        'Do not solve the problem in the Incident node. Use downstream nodes for containment, evidence, causes, and CAPA.',
        'Use Incident Details for the who, what, where, when, and impact fields.'
      ],
      subtitle: node.label || 'Parent RCA node',
      title: roleLabel
    };
  }

  if (role === 'EVIDENCE') {
    return {
      details: [
        'Evidence nodes hold objective proof for facts, causes, containment, or verification.',
        `This node has ${evidenceCount} attachment${evidenceCount === 1 ? '' : 's'}.`,
        'Evidence can include photos, links, records, interviews, measurements, SOPs, logs, and verification documents.'
      ],
      guidance: [
        'Attach evidence to the node it directly supports.',
        'Use clear file names and links so reviewers can verify the finding later.',
        'A root cause should not be confirmed without supporting evidence.'
      ],
      subtitle: node.label || 'Evidence record',
      title: roleLabel
    };
  }

  if (role === 'CAPA' || role === 'CORRECTIVE_ACTION' || role === 'PREVENTIVE_ACTION') {
    return {
      details: [
        `${roleLabel} captures the action plan that addresses RCA findings.`,
        'CAPA work should define ownership, due dates, verification, and completion evidence.',
        `This node has ${evidenceCount} attachment${evidenceCount === 1 ? '' : 's'}.`
      ],
      guidance: [
        'Separate corrective action from preventive action.',
        'Make each action specific, assigned, measurable, and verifiable.',
        'Do not close CAPA until effectiveness evidence confirms the issue was controlled.'
      ],
      subtitle: node.label || 'CAPA action node',
      title: roleLabel
    };
  }

  return {
    details: [
      `${roleLabel} is part of the RCA logic trail on the canvas.`,
      `It has ${childCount} connected child item${childCount === 1 ? '' : 's'} and ${evidenceCount} attachment${evidenceCount === 1 ? '' : 's'}.`,
      'Use the Node Details panel for structured fields and the canvas label for readable investigation flow.'
    ],
    guidance: [
      'Keep the text short enough for collaborators to scan on the canvas.',
      'Connect it to the related upstream and downstream nodes so the RCA is auditable.',
      'Use evidence and CAPA nodes to support final decisions instead of relying on assumptions.'
    ],
    subtitle: node.label || 'Selected RCA node',
    title: roleLabel
  };
}

function clampRcaSidePanelWidth(width: number, defaultWidth: number): number {
  return Math.min(
    Math.max(width, defaultWidth),
    getRcaSidePanelMaxWidth(defaultWidth)
  );
}

function getRcaSidePanelMaxWidth(defaultWidth: number): number {
  if (typeof window === 'undefined') {
    return defaultWidth;
  }

  return Math.max(
    defaultWidth,
    Math.min(window.innerWidth - 20, Math.round(window.innerWidth * 0.4))
  );
}

function clampRcaKnowledgePanelWidth(width: number): number {
  return clampRcaSidePanelWidth(width, RCA_KNOWLEDGE_PANEL_DEFAULT_WIDTH);
}

function getRcaKnowledgePanelMaxWidth(): number {
  return getRcaSidePanelMaxWidth(RCA_KNOWLEDGE_PANEL_DEFAULT_WIDTH);
}

function clampRcaInspectorPanelWidth(width: number): number {
  return clampRcaSidePanelWidth(width, RCA_INSPECTOR_PANEL_DEFAULT_WIDTH);
}

function getRcaInspectorPanelMaxWidth(): number {
  return getRcaSidePanelMaxWidth(RCA_INSPECTOR_PANEL_DEFAULT_WIDTH);
}

function clampRcaActivityPanelWidth(width: number): number {
  return clampRcaSidePanelWidth(width, RCA_ACTIVITY_PANEL_DEFAULT_WIDTH);
}

function getRcaActivityPanelMaxWidth(): number {
  return getRcaSidePanelMaxWidth(RCA_ACTIVITY_PANEL_DEFAULT_WIDTH);
}

function RcaActivityLogPanel({
  isLoading,
  isOpen,
  logs,
  onToggle
}: {
  isLoading: boolean;
  isOpen: boolean;
  logs: RcaActivityLog[];
  onToggle: () => void;
}) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('');
  const [startTimeFilter, setStartTimeFilter] = React.useState('');
  const [endTimeFilter, setEndTimeFilter] = React.useState('');
  const [panelWidth, setPanelWidth] = React.useState(RCA_ACTIVITY_PANEL_DEFAULT_WIDTH);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const auditableLogs = logs.filter((log) => log.action !== 'NODE_MOVED');
  const filteredLogs = auditableLogs.filter((log) => {
    const createdAt = log.createdAtIso ? new Date(log.createdAtIso) : null;

    if (dateFilter) {
      if (!createdAt || Number.isNaN(createdAt.getTime())) {
        return false;
      }

      const logDate = formatInputDate(createdAt);

      if (logDate !== dateFilter) {
        return false;
      }
    }

    if (startTimeFilter || endTimeFilter) {
      if (!createdAt || Number.isNaN(createdAt.getTime())) {
        return false;
      }

      const logMinutes = createdAt.getHours() * 60 + createdAt.getMinutes();

      if (startTimeFilter && logMinutes < timeInputToMinutes(startTimeFilter)) {
        return false;
      }

      if (endTimeFilter && logMinutes > timeInputToMinutes(endTimeFilter)) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      log.actor.displayName,
      log.actor.departmentName,
      log.actor.roleName,
      log.summary,
      log.labelSnapshot,
      log.previousValue,
      log.nextValue,
      getRcaActivityLogActionStyle(log.action).label
    ].some((value) => (value || '').toLowerCase().includes(normalizedQuery));
  });

  React.useEffect(() => {
    function handleResize() {
      setPanelWidth((currentWidth) => Math.min(currentWidth, getRcaActivityPanelMaxWidth()));
    }

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = panelWidth;

    function handlePointerMove(pointerEvent: PointerEvent) {
      const nextWidth = startWidth + startX - pointerEvent.clientX;

      setPanelWidth(clampRcaActivityPanelWidth(nextWidth));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  return (
    <>
      <aside
        className={`rca-activity-log-drawer fixed bottom-0 right-0 top-16 z-[72] flex max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-l-3xl border-l border-slate-200/80 bg-white/96 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-900/5 backdrop-blur-2xl ${
          isOpen
            ? 'rca-activity-log-drawer-open pointer-events-auto'
            : 'rca-activity-log-drawer-closed pointer-events-none'
        }`}
        aria-label="RCA activity log"
        style={{ width: panelWidth }}
      >
        <button
          aria-label="Resize RCA activity log"
          className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-transparent transition hover:bg-cyan-400/20 active:bg-cyan-400/30"
          onPointerDown={handleResizeStart}
          type="button"
        />
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Activity Log</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-950">RCA collaboration trail</h2>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 active:scale-95"
            onClick={onToggle}
            type="button"
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>

        <div className="border-b border-slate-200/80 bg-white/88 px-4 py-3">
          <label className="relative block">
            <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search user or activity"
              type="search"
              value={searchQuery}
            />
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <RcaDateFilterPicker label="Date" onChange={setDateFilter} value={dateFilter} />
            <RcaTimeFilterPicker label="From" onChange={setStartTimeFilter} value={startTimeFilter} />
            <RcaTimeFilterPicker label="To" onChange={setEndTimeFilter} value={endTimeFilter} />
          </div>
          {searchQuery || dateFilter || startTimeFilter || endTimeFilter ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-500">
                {filteredLogs.length} of {auditableLogs.length} shown
              </p>
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95"
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('');
                  setStartTimeFilter('');
                  setEndTimeFilter('');
                }}
                type="button"
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          {isLoading ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              Loading RCA activity...
            </div>
          ) : filteredLogs.length ? (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <RcaActivityLogItem key={log.id} log={log} />
              ))}
            </div>
          ) : auditableLogs.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No activity matches the current filters.
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No canvas activity has been recorded yet.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function RcaDateFilterPicker({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const selectedDate = parseInputDate(value);

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-700 outline-none transition hover:border-cyan-200 hover:bg-cyan-50/40 data-[state=open]:border-cyan-300 data-[state=open]:ring-4 data-[state=open]:ring-cyan-100"
            type="button"
          >
            <span className="truncate">{selectedDate ? formatDateFilterLabel(selectedDate) : 'Any date'}</span>
            <CalendarDays aria-hidden="true" className="shrink-0 text-slate-500" size={15} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            className="rca-date-picker-popover z-[120] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/18 ring-1 ring-slate-900/5"
            collisionPadding={14}
            sideOffset={8}
          >
            <DayPicker
              fixedWeeks
              mode="single"
              onSelect={(date) => {
                if (date) {
                  onChange(formatInputDate(date));
                }
              }}
              selected={selectedDate || undefined}
              showOutsideDays
            />
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <button
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={() => onChange('')}
                type="button"
              >
                Clear
              </button>
              <button
                className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
                onClick={() => onChange(formatInputDate(new Date()))}
                type="button"
              >
                Today
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function RcaTimeFilterPicker({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const options = React.useMemo(() => buildTimeFilterOptions(), []);

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-700 outline-none transition hover:border-cyan-200 hover:bg-cyan-50/40 data-[state=open]:border-cyan-300 data-[state=open]:ring-4 data-[state=open]:ring-cyan-100"
            type="button"
          >
            <span className="truncate">{value ? formatTimeFilterLabel(value) : 'Any time'}</span>
            <Clock3 aria-hidden="true" className="shrink-0 text-slate-500" size={15} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            className="z-[120] w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/18 ring-1 ring-slate-900/5"
            collisionPadding={14}
            sideOffset={8}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <p className="text-xs font-semibold text-slate-900">{label} time</p>
              <button
                className="rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={() => onChange('')}
                type="button"
              >
                Clear
              </button>
            </div>
            <div className="max-h-64 overflow-auto p-1.5">
              <button
                className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50"
                onClick={() => onChange(formatTimeInput(new Date()))}
                type="button"
              >
                Now
                <Clock3 aria-hidden="true" size={14} />
              </button>
              {options.map((option) => (
                <button
                  className={`block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                    value === option.value
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  key={option.value}
                  onClick={() => onChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function RcaActivityLogItem({ log }: { log: RcaActivityLog }) {
  const actionStyle = getRcaActivityLogActionStyle(log.action);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/5">
      <div className="flex items-start gap-3">
        <RcaUserAvatar user={log.actor} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{log.actor.displayName}</p>
              <p className="truncate text-[11px] text-slate-500">{log.actor.departmentName || 'Unassigned department'} / {log.actor.roleName}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${actionStyle.className}`}>
              {actionStyle.label}
            </span>
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-700">{log.summary}</p>
          {log.previousValue || log.nextValue ? (
            <div className="mt-2 grid gap-1.5">
              {log.previousValue ? (
                <div className="rounded-lg border border-red-100 bg-red-50/55 px-2 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-500">Before</p>
                  <p className="mt-0.5 max-h-40 overflow-auto whitespace-pre-line text-xs leading-4 text-slate-600">{log.previousValue}</p>
                </div>
              ) : null}
              {log.nextValue ? (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/55 px-2 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">After</p>
                  <p className="mt-0.5 max-h-40 overflow-auto whitespace-pre-line text-xs leading-4 text-slate-700">{log.nextValue}</p>
                </div>
              ) : null}
            </div>
          ) : log.labelSnapshot ? (
            <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs leading-4 text-slate-500">
              {log.labelSnapshot}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] font-medium text-slate-400">
            {log.createdAtIso ? formatAuditDate(log.createdAtIso) : 'Timestamp pending'}
          </p>
        </div>
      </div>
    </article>
  );
}

function getRcaActivityLogActionStyle(action: RcaActivityLogAction): { className: string; label: string } {
  if (action === 'NODE_CREATED') {
    return { className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100', label: 'Node added' };
  }

  if (action === 'NODE_DELETED') {
    return { className: 'bg-red-50 text-red-700 ring-1 ring-red-100', label: 'Node deleted' };
  }

  if (action === 'NODE_TEXT_UPDATED') {
    return { className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100', label: 'Text edited' };
  }

  if (action === 'SPLINE_CONNECTED') {
    return { className: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100', label: 'Spline connected' };
  }

  if (action === 'SPLINE_DISCONNECTED') {
    return { className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200', label: 'Spline detached' };
  }

  if (action === 'SPLINE_DELETED') {
    return { className: 'bg-red-50 text-red-700 ring-1 ring-red-100', label: 'Spline deleted' };
  }

  if (action === 'MULTI_DELETED') {
    return { className: 'bg-red-50 text-red-700 ring-1 ring-red-100', label: 'Multi-delete' };
  }

  if (action === 'UNDO') {
    return { className: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100', label: 'Undo' };
  }

  if (action === 'REDO') {
    return { className: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100', label: 'Redo' };
  }

  return { className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100', label: 'Edited' };
}

function RcaCanvasToastStack({
  isLoadingVisible,
  isSavingVisible
}: {
  isLoadingVisible: boolean;
  isSavingVisible: boolean;
}) {
  const shouldShowLoading = useMinimumVisibleDuration(isLoadingVisible, RCA_TOAST_MIN_VISIBLE_MS);
  const shouldShowSaving = useMinimumVisibleDuration(isSavingVisible, RCA_TOAST_MIN_VISIBLE_MS);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-5 z-[90] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {shouldShowSaving ? (
        <RcaCanvasToast tone="saving">
          Saving.........
        </RcaCanvasToast>
      ) : null}
      {shouldShowLoading ? (
        <RcaCanvasToast tone="loading">
          Loading RCA workspace...
        </RcaCanvasToast>
      ) : null}
    </div>
  );
}

function RcaCanvasToast({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: 'loading' | 'saving';
}) {
  const toneClassName = tone === 'saving'
    ? 'border-cyan-200/80 text-cyan-800 shadow-cyan-950/10'
    : 'border-slate-200/80 text-slate-700 shadow-slate-950/10';
  const dotClassName = tone === 'saving'
    ? 'bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.12)]'
    : 'bg-slate-400 shadow-[0_0_0_4px_rgba(100,116,139,0.12)]';

  return (
    <div
      className={`inline-flex h-9 translate-y-0 items-center gap-2 rounded-full border bg-white/92 px-4 text-xs font-semibold opacity-100 shadow-xl ring-1 ring-white/50 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out ${toneClassName}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClassName}`} />
      {children}
    </div>
  );
}

function RcaReferenceJourneyRail({
  activeStepId,
  onSelectStep,
  steps
}: {
  activeStepId: string;
  onSelectStep: (step: ReferenceRcaStep) => void;
  steps: ReferenceRcaStep[];
}) {
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  return (
    <>
      <aside
        aria-hidden={isCollapsed}
        className={`absolute right-5 top-24 z-30 w-[360px] rounded-3xl border border-white/60 bg-white/72 p-3 shadow-2xl shadow-slate-900/12 ring-1 ring-slate-900/5 backdrop-blur-xl transition-[opacity,transform] duration-300 ease-out max-xl:hidden ${
          isCollapsed ? 'pointer-events-none translate-x-[calc(100%+32px)] opacity-0' : 'translate-x-0 opacity-100'
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Project flow</p>
            <h2 className="text-sm font-semibold text-slate-950">Start to finish RCA</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Complete
            </span>
            <button
              aria-label="Minimize project flow"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95"
              onClick={() => setIsCollapsed(true)}
              title="Minimize project flow"
              type="button"
            >
              <PanelRightClose aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {steps.map((step, index) => {
            const isActive = step.id === activeStepId;

            return (
              <button
                className={`group w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] ${
                  isActive
                    ? 'border-cyan-300 bg-cyan-50 shadow-lg shadow-cyan-950/10'
                    : 'border-slate-200/80 bg-white/76 hover:bg-white'
                }`}
                key={step.id}
                onClick={() => onSelectStep(step)}
                type="button"
              >
                <div className="flex items-start gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    isActive ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-cyan-100'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">{step.label}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-4 text-slate-500">{step.description}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
      <button
        aria-label="Open project flow"
        className={`absolute right-0 top-28 z-40 flex h-40 w-10 flex-col items-center justify-center gap-2 rounded-l-2xl border border-cyan-500/30 bg-cyan-600 text-white shadow-2xl shadow-cyan-950/20 ring-1 ring-white/30 backdrop-blur-md transition-[opacity,transform,box-shadow] duration-300 ease-out hover:bg-cyan-500 hover:shadow-cyan-950/30 active:scale-95 max-xl:hidden ${
          isCollapsed ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-5 opacity-0'
        }`}
        onClick={() => setIsCollapsed(false)}
        title="Open project flow"
        type="button"
      >
        <PanelRightOpen aria-hidden="true" size={16} />
        <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">Project flow</span>
      </button>
    </>
  );
}

function RcaLiveCursor() {
  return (
    <div className="pointer-events-none absolute left-[72%] top-[42%] z-30 hidden animate-[rcaFloat_5s_ease-in-out_infinite] items-start gap-2 xl:flex">
      <MousePointer2 aria-hidden="true" className="fill-cyan-500 text-cyan-600 drop-shadow-lg" size={22} />
      <span className="rounded-full border border-cyan-100 bg-white/85 px-3 py-1 text-xs font-semibold text-cyan-700 shadow-lg backdrop-blur-md">
        QA Manager
      </span>
    </div>
  );
}

function RcaIncidentShelf({
  incidents,
  isReferenceProjectActive,
  isLoading,
  onOpenReferenceProject,
  onRefresh,
  onSelectIncident,
  selectedIncidentId
}: {
  incidents: RcaIncident[];
  isReferenceProjectActive: boolean;
  isLoading: boolean;
  onOpenReferenceProject: () => void;
  onRefresh: () => void;
  onSelectIncident: (incidentId: string) => void;
  selectedIncidentId: string | null;
}) {
  return (
    <aside className="mt-3 max-h-[min(440px,calc(100svh-300px))] w-full overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl shadow-slate-900/14 ring-1 ring-slate-900/5 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Incident queue</h2>
          <p className="text-xs text-slate-500">{isLoading ? 'Refreshing...' : `${incidents.length} investigations`}</p>
        </div>
        <button
          className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
          onClick={onRefresh}
          type="button"
        >
          Refresh
        </button>
      </div>
      <div className="max-h-[440px] space-y-2 overflow-auto p-3">
        <button
          className={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
            isReferenceProjectActive
              ? 'border-cyan-300 bg-cyan-50 ring-4 ring-cyan-500/10'
              : 'border-slate-200 bg-white/80 hover:bg-white'
          }`}
          onClick={onOpenReferenceProject}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
                Fire under oven audit project
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                Full sealed RCA with evidence, CAPA sync, e-signature, and audit package.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
              27
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="truncate">Die Cut production line - oven area</span>
            <span>Sealed</span>
          </div>
        </button>
        {incidents.length ? incidents.map((incident) => (
          <button
            className={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
              selectedIncidentId === incident.id
                ? 'border-cyan-300 bg-cyan-50 ring-4 ring-cyan-500/10'
                : 'border-slate-200 bg-white/80 hover:bg-white'
            }`}
            key={incident.id}
            onClick={() => onSelectIncident(incident.id)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{incident.title}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getRpnClassName(incident.rpnScore)}`}>
                {incident.rpnScore}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="truncate">{incident.assetId}</span>
              <span>{formatStatus(incident.status)}</span>
            </div>
          </button>
        )) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">
            No RCA incidents are open yet.
          </div>
        )}
      </div>
    </aside>
  );
}

function RcaIncidentLauncher({
  draft,
  isOpen,
  isWorking,
  onClose,
  onCreateIncident,
  onDraftChange
}: {
  draft: {
    title: string;
  };
  isOpen: boolean;
  isWorking: boolean;
  onClose: () => void;
  onCreateIncident: (event: React.FormEvent<HTMLFormElement>) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<{
    title: string;
  }>>;
}) {
  const [modalOffset, setModalOffset] = React.useState({ x: 0, y: 0 });
  const dragStateRef = React.useRef<{
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setModalOffset({ x: 0, y: 0 });
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) {
      return;
    }

    dragStateRef.current = {
      originX: modalOffset.x,
      originY: modalOffset.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setModalOffset({
      x: dragState.originX + event.clientX - dragState.startX,
      y: dragState.originY + event.clientY - dragState.startY
    });
  };
  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <>
      <button
        aria-label="Close incident launcher"
        className="fixed inset-0 z-50 cursor-default bg-transparent"
        onClick={onClose}
        type="button"
      />
      <form
        className="fixed left-1/2 top-1/2 z-[60] w-[min(560px,calc(100%-32px))] rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-900/5 backdrop-blur-xl will-change-transform"
        onSubmit={onCreateIncident}
        style={{ transform: `translate(-50%, -50%) translate3d(${modalOffset.x}px, ${modalOffset.y}px, 0)` }}
      >
        <div
          className="mb-5 flex touch-none select-none items-start justify-between gap-4 cursor-grab active:cursor-grabbing"
          onPointerCancel={handleDragEnd}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Initialize war room</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Create RCA project</h2>
            <p className="mt-1 text-sm text-slate-500">Create the project shell. Incident details are captured on the canvas.</p>
          </div>
          <button
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <div className="grid gap-3">
          <input
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4"
            maxLength={RCA_INCIDENT_TITLE_MAX_LENGTH}
            onChange={(event) => onDraftChange((currentDraft) => ({
              ...currentDraft,
              title: event.target.value.slice(0, RCA_INCIDENT_TITLE_MAX_LENGTH)
            }))}
            placeholder="Project title"
            required
            type="text"
            value={draft.title}
          />
          <button
            className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/16 transition hover:bg-cyan-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isWorking || !draft.title.trim()}
            type="submit"
          >
            <ShieldCheck aria-hidden="true" size={18} />
            Open war room
          </button>
        </div>
      </form>
    </>
  );
}

function RcaCanvasToolbar({
  activityLogCount,
  canAddFishbone,
  canGenerateReport,
  isActivityLogOpen,
  isReferenceProject,
  isWorking,
  methodology,
  onAddNode,
  onAutoArrange,
  onCreateSession,
  onGenerateReport,
  onToggleActivityLog,
  onMethodologyChange,
  onOpenIncidentLauncher,
  session
}: {
  activityLogCount: number;
  canAddFishbone: boolean;
  canGenerateReport: boolean;
  isActivityLogOpen: boolean;
  isReferenceProject: boolean;
  isWorking: boolean;
  methodology: RcaMethodology;
  onAddNode: () => void;
  onAutoArrange: () => void;
  onCreateSession: () => void;
  onGenerateReport: () => void;
  onToggleActivityLog: () => void;
  onMethodologyChange: (methodology: RcaMethodology) => void;
  onOpenIncidentLauncher: () => void;
  session: RcaSession | null;
}) {
  const [isToolbarMinimized, setIsToolbarMinimized] = React.useState(false);

  if (isToolbarMinimized) {
    return (
      <button
        aria-label="Show RCA toolbar"
        className="absolute bottom-6 left-1/2 z-50 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-slate-200/80 bg-white/95 text-slate-700 shadow-[0_16px_40px_rgba(15,23,42,0.18),0_3px_10px_rgba(14,165,233,0.12)] ring-1 ring-white/80 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200 hover:text-cyan-700 active:scale-95 max-lg:bottom-4"
        onClick={() => setIsToolbarMinimized(false)}
        title="Show RCA toolbar"
        type="button"
      >
        <PanelBottomOpen aria-hidden="true" size={15} strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-[15px] border border-slate-200/80 bg-white/95 p-1 shadow-[0_18px_52px_rgba(15,23,42,0.18),0_4px_16px_rgba(14,165,233,0.12)] ring-1 ring-white/80 backdrop-blur-xl max-lg:bottom-4 max-lg:w-[calc(100%-24px)] max-lg:overflow-x-auto">
      <button
        className="inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-[10px] px-2 text-[11px] font-medium leading-none text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 active:scale-95"
        onClick={onOpenIncidentLauncher}
        type="button"
      >
        <FilePlus2 aria-hidden="true" size={13} strokeWidth={1.85} />
        Incident
      </button>
      <span className="h-4 w-px bg-slate-200" />
      {methodologyOptions.map((option) => {
        const MethodIcon = option.icon;
        const isSelected = option.value === methodology;

        return (
          <button
            className={`inline-flex min-h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[11px] font-medium leading-none transition active:scale-95 ${
              isSelected
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-950/10'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
            disabled={!session || isWorking}
            key={option.value}
            onClick={() => onMethodologyChange(option.value)}
            title={`${option.shortcut} - ${option.label}`}
            type="button"
          >
            <MethodIcon aria-hidden="true" size={15} strokeWidth={2.05} />
            {option.label}
          </button>
        );
      })}
      <span className="h-4 w-px bg-slate-200" />
      <button
        className="inline-flex min-h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-cyan-200/80 bg-cyan-50/70 px-2 text-[11px] font-medium leading-none text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100/80 hover:text-cyan-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!session || isWorking}
        onClick={onAutoArrange}
        title="R - Rearrange canvas"
        type="button"
      >
        <AlignHorizontalSpaceBetween aria-hidden="true" size={15} strokeWidth={2.05} />
        Rearrange Canvas
      </button>
      <span className="h-4 w-px bg-slate-200" />
      {isReferenceProject ? (
        <span className="inline-flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-[10px] border border-emerald-200/80 bg-emerald-50/80 px-2 text-[11px] font-medium leading-none text-emerald-700">
          <BadgeCheck aria-hidden="true" size={13} strokeWidth={1.85} />
          Sealed
        </span>
      ) : session ? (
        <button
          className="inline-flex min-h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-cyan-600 px-2.5 text-[11px] font-medium leading-none text-white shadow-sm shadow-cyan-950/10 transition hover:bg-cyan-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isWorking || !canAddFishbone}
          onClick={onAddNode}
          title={canAddFishbone ? 'Add fishbone structure' : 'Create the Incident node first'}
          type="button"
        >
          <Plus aria-hidden="true" size={15} strokeWidth={2.05} />
          Fishbone
        </button>
      ) : (
        <button
          className="inline-flex min-h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-cyan-600 px-2.5 text-[11px] font-medium leading-none text-white shadow-sm shadow-cyan-950/10 transition hover:bg-cyan-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isWorking}
          onClick={onCreateSession}
          type="button"
        >
          <ShieldCheck aria-hidden="true" size={13} strokeWidth={1.85} />
          Start Session
        </button>
      )}
      <span className="h-4 w-px bg-slate-200" />
      <button
        aria-label="Generate RCA report"
        className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] transition active:scale-95 ${
          canGenerateReport
            ? 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 hover:bg-cyan-100 hover:text-cyan-800'
            : 'text-slate-300'
        } disabled:cursor-not-allowed disabled:opacity-55`}
        disabled={isWorking || !session || !canGenerateReport}
        onClick={onGenerateReport}
        title={canGenerateReport ? 'Generate RCA report' : 'Select the parent Incident node to generate an RCA report'}
        type="button"
      >
        <FileText aria-hidden="true" size={16} strokeWidth={2.05} />
      </button>
      <span className="h-4 w-px bg-slate-200" />
      <button
        aria-expanded={isActivityLogOpen}
        aria-label="Open RCA activity log"
        className={`relative grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] text-slate-500 transition hover:bg-slate-100 hover:text-cyan-700 active:scale-95 ${
          isActivityLogOpen ? 'bg-cyan-50 text-cyan-700' : ''
        }`}
        onClick={onToggleActivityLog}
        title="RCA activity log"
        type="button"
      >
        <ClipboardList aria-hidden="true" size={15} strokeWidth={1.9} />
        {activityLogCount ? (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-cyan-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {Math.min(activityLogCount, 99)}
          </span>
        ) : null}
      </button>
      <span className="h-4 w-px bg-slate-200" />
      <button
        aria-label="Minimize RCA toolbar"
        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 active:scale-95"
        onClick={() => setIsToolbarMinimized(true)}
        title="Minimize toolbar"
        type="button"
      >
        <PanelBottomClose aria-hidden="true" size={13} strokeWidth={1.85} />
      </button>
    </div>
  );
}

type RcaReportSection = {
  id: string;
  nodes: RcaNode[];
  subtitle: string;
  title: string;
};

const RCA_REPORT_MODAL_DEFAULT_WIDTH = 920;
const RCA_REPORT_MODAL_DEFAULT_HEIGHT = 760;
const RCA_REPORT_MODAL_MARGIN = 16;

function getRcaReportModalMaxSize(): { height: number; width: number } {
  if (typeof window === 'undefined') {
    return {
      height: RCA_REPORT_MODAL_DEFAULT_HEIGHT,
      width: RCA_REPORT_MODAL_DEFAULT_WIDTH
    };
  }

  return {
    height: Math.max(420, window.innerHeight - RCA_REPORT_MODAL_MARGIN * 2),
    width: Math.max(520, window.innerWidth - RCA_REPORT_MODAL_MARGIN * 2)
  };
}

function getInitialRcaReportModalGeometry(): {
  position: { x: number; y: number };
  size: { height: number; width: number };
} {
  const maxSize = getRcaReportModalMaxSize();
  const size = {
    height: Math.min(RCA_REPORT_MODAL_DEFAULT_HEIGHT, maxSize.height),
    width: Math.min(RCA_REPORT_MODAL_DEFAULT_WIDTH, maxSize.width)
  };

  if (typeof window === 'undefined') {
    return {
      position: { x: 72, y: 78 },
      size
    };
  }

  return {
    position: {
      x: Math.max(RCA_REPORT_MODAL_MARGIN, Math.round((window.innerWidth - size.width) / 2)),
      y: Math.max(RCA_REPORT_MODAL_MARGIN, Math.round((window.innerHeight - size.height) / 2))
    },
    size
  };
}

function clampRcaReportModalPosition(
  position: { x: number; y: number },
  size: { height: number; width: number }
): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return position;
  }

  return {
    x: Math.min(
      Math.max(RCA_REPORT_MODAL_MARGIN, position.x),
      Math.max(RCA_REPORT_MODAL_MARGIN, window.innerWidth - size.width - RCA_REPORT_MODAL_MARGIN)
    ),
    y: Math.min(
      Math.max(RCA_REPORT_MODAL_MARGIN, position.y),
      Math.max(RCA_REPORT_MODAL_MARGIN, window.innerHeight - size.height - RCA_REPORT_MODAL_MARGIN)
    )
  };
}

function RcaIncidentReportModal({
  incident,
  incidentNode,
  nodes,
  onClose,
  sessionId
}: {
  incident: RcaIncident;
  incidentNode: RcaNode;
  nodes: RcaNode[];
  onClose: () => void;
  sessionId: string;
}) {
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [exportStatus, setExportStatus] = React.useState<RcaReportExportFormat | null>(null);
  const [previewUrls, setPreviewUrls] = React.useState<Map<string, string>>(() => new Map());
  const objectUrlsRef = React.useRef<Set<string>>(new Set());
  const initialGeometryRef = React.useRef(getInitialRcaReportModalGeometry());
  const dragStartRef = React.useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const resizeStartRef = React.useRef<{
    direction: 'width' | 'height' | 'both';
    pointerX: number;
    pointerY: number;
    startHeight: number;
    startWidth: number;
  } | null>(null);
  const [position, setPosition] = React.useState(() => initialGeometryRef.current.position);
  const [size, setSize] = React.useState(() => initialGeometryRef.current.size);
  const reportNodes = React.useMemo(
    () => getRcaIncidentReportNodes(incidentNode, nodes),
    [incidentNode, nodes]
  );
  const reportSections = React.useMemo(
    () => buildRcaIncidentReportSections(reportNodes),
    [reportNodes]
  );
  const evidenceCount = reportNodes.reduce((count, node) => count + node.attachedEvidence.length, 0);
  const generatedAt = React.useMemo(() => new Date().toISOString(), []);

  React.useEffect(() => () => {
    objectUrlsRef.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    objectUrlsRef.current.clear();
  }, []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (isMaximized) {
          setIsMaximized(false);
          return;
        }

        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized, onClose]);

  React.useEffect(() => {
    let isCurrent = true;
    const photoEvidence = reportNodes
      .flatMap((node) => node.attachedEvidence)
      .filter((item) => isImageEvidence(item) && !previewUrls.has(getEvidenceKey(item)));

    if (!photoEvidence.length) {
      return undefined;
    }

    async function hydrateReportThumbnails() {
      const entries = await Promise.all(photoEvidence.map(async (item) => {
        if (isBrowserDisplayableImageUrl(item.fileUrl)) {
          return { key: getEvidenceKey(item), objectUrl: item.fileUrl, shouldRevoke: false };
        }

        if (!isRcaStoredEvidenceUrl(item.fileUrl)) {
          return null;
        }

        try {
          const blob = await downloadRcaEvidenceBlob(incident.id, sessionId, item.fileUrl);
          const objectUrl = URL.createObjectURL(blob);

          return { key: getEvidenceKey(item), objectUrl, shouldRevoke: true };
        } catch {
          return null;
        }
      }));

      if (!isCurrent) {
        entries.forEach((entry) => {
          if (entry?.shouldRevoke) {
            URL.revokeObjectURL(entry.objectUrl);
          }
        });
        return;
      }

      const nextPreviewUrls = new Map(previewUrls);
      let didHydrate = false;

      entries.forEach((entry) => {
        if (!entry) {
          return;
        }

        if (entry.shouldRevoke) {
          objectUrlsRef.current.add(entry.objectUrl);
        }

        nextPreviewUrls.set(entry.key, entry.objectUrl);
        didHydrate = true;
      });

      if (didHydrate) {
        setPreviewUrls(nextPreviewUrls);
      }
    }

    void hydrateReportThumbnails();

    return () => {
      isCurrent = false;
    };
  }, [incident.id, previewUrls, reportNodes, sessionId]);

  React.useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const resizeStart = resizeStartRef.current;

      if (resizeStart && !isMaximized) {
        const maxSize = getRcaReportModalMaxSize();
        const minSize = initialGeometryRef.current.size;
        const nextWidth = resizeStart.direction === 'width' || resizeStart.direction === 'both'
          ? resizeStart.startWidth + event.clientX - resizeStart.pointerX
          : resizeStart.startWidth;
        const nextHeight = resizeStart.direction === 'height' || resizeStart.direction === 'both'
          ? resizeStart.startHeight + event.clientY - resizeStart.pointerY
          : resizeStart.startHeight;
        const clampedSize = {
          height: Math.min(Math.max(minSize.height, nextHeight), maxSize.height),
          width: Math.min(Math.max(minSize.width, nextWidth), maxSize.width)
        };

        setSize(clampedSize);
        setPosition((currentPosition) => clampRcaReportModalPosition(currentPosition, clampedSize));
        return;
      }

      const dragStart = dragStartRef.current;

      if (!dragStart || isMaximized) {
        return;
      }

      const nextX = dragStart.startX + event.clientX - dragStart.pointerX;
      const nextY = dragStart.startY + event.clientY - dragStart.pointerY;

      setPosition({
        x: Math.min(Math.max(16, nextX), Math.max(16, window.innerWidth - size.width - 16)),
        y: Math.min(Math.max(16, nextY), Math.max(16, window.innerHeight - size.height - 16))
      });
    }

    function handleMouseUp() {
      dragStartRef.current = null;
      resizeStartRef.current = null;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMaximized, size.height, size.width]);

  React.useEffect(() => {
    function handleWindowResize() {
      const maxSize = getRcaReportModalMaxSize();
      const minSize = initialGeometryRef.current.size;
      const nextSize = {
        height: Math.min(Math.max(minSize.height, size.height), maxSize.height),
        width: Math.min(Math.max(minSize.width, size.width), maxSize.width)
      };

      setSize(nextSize);
      setPosition((currentPosition) => clampRcaReportModalPosition(currentPosition, nextSize));
    }

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [size.height, size.width]);

  async function handleOpenEvidence(item: RcaAttachedEvidence) {
    if (isLikelyUrl(item.fileUrl)) {
      window.open(item.fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!isRcaStoredEvidenceUrl(item.fileUrl)) {
      return;
    }

    const evidenceWindow = window.open('', '_blank');

    try {
      const blob = await downloadRcaEvidenceBlob(incident.id, sessionId, item.fileUrl);
      const objectUrl = URL.createObjectURL(blob);

      if (evidenceWindow) {
        evidenceWindow.opener = null;
        evidenceWindow.location.href = objectUrl;
      } else {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.download = item.fileName || 'evidence';
        link.click();
      }

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      evidenceWindow?.close();
    }
  }

  const modalStyle = isMaximized
    ? undefined
    : {
        height: size.height,
        left: position.x,
        top: position.y,
        width: size.width
      };
  const title = incidentNode.label.trim() || incident.title || 'RCA incident report';
  const exportPayload = React.useMemo(
    () => buildRcaReportExportPayload({
      evidenceCount,
      generatedAt,
      incident,
      incidentNode,
      reportNodes,
      reportSections
    }),
    [evidenceCount, generatedAt, incident, incidentNode, reportNodes, reportSections]
  );
  const startResize = (event: React.MouseEvent, direction: 'width' | 'height' | 'both') => {
    if (isMaximized || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    resizeStartRef.current = {
      direction,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startHeight: size.height,
      startWidth: size.width
    };
  };
  const handleExport = async (format: RcaReportExportFormat) => {
    setExportStatus(format);

    try {
      await exportRcaReport(exportPayload, format, previewUrls);
    } finally {
      setExportStatus(null);
    }
  };

  return createPortal(
    <section
      aria-label="RCA report preview"
      className={`fixed z-[130] flex flex-col overflow-hidden border border-slate-200 bg-white text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.28),0_8px_28px_rgba(14,165,233,0.12)] ring-1 ring-slate-950/5 ${
        isMaximized ? 'inset-4 rounded-3xl' : 'rounded-3xl'
      }`}
      role="dialog"
      style={modalStyle}
    >
      {!isMaximized ? (
        <>
          <div
            aria-hidden="true"
            className="absolute bottom-5 right-0 top-5 z-20 w-2 cursor-ew-resize bg-transparent transition hover:bg-cyan-400/20 active:bg-cyan-400/30"
            onMouseDown={(event) => startResize(event, 'width')}
          />
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-5 right-5 z-20 h-2 cursor-ns-resize bg-transparent transition hover:bg-cyan-400/20 active:bg-cyan-400/30"
            onMouseDown={(event) => startResize(event, 'height')}
          />
          <div
            aria-hidden="true"
            className="absolute bottom-0 right-0 z-30 h-5 w-5 cursor-nwse-resize rounded-tl-xl bg-transparent transition hover:bg-cyan-400/20 active:bg-cyan-400/30"
            onMouseDown={(event) => startResize(event, 'both')}
          />
        </>
      ) : null}

      <header
        className={`flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 ${
          isMaximized ? '' : 'cursor-move'
        }`}
        onMouseDown={(event) => {
          if (isMaximized || event.button !== 0) {
            return;
          }

          dragStartRef.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            startX: position.x,
            startY: position.y
          };
        }}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-cyan-700">RCA Report</p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 truncate text-xs text-slate-500">
            {incident.displayId || buildFriendlyRcaDisplayId('RCA', incident.id, incident.createdAtIso)} • {reportNodes.length} node{reportNodes.length === 1 ? '' : 's'} • {evidenceCount} evidence item{evidenceCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={Boolean(exportStatus)}
                onMouseDown={(event) => event.stopPropagation()}
                title="Export RCA report"
                type="button"
              >
                <FileDown aria-hidden="true" size={16} strokeWidth={2} />
                Export
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                className="z-[160] w-56 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 text-slate-700 shadow-[0_24px_64px_rgba(15,23,42,0.22)] ring-1 ring-slate-950/5 backdrop-blur-xl"
                onMouseDown={(event) => event.stopPropagation()}
                sideOffset={8}
              >
                <RcaReportExportMenuItem
                  disabled={Boolean(exportStatus)}
                  icon={FileText}
                  isLoading={exportStatus === 'word'}
                  label="MS Word"
                  onClick={() => void handleExport('word')}
                />
                <RcaReportExportMenuItem
                  disabled={Boolean(exportStatus)}
                  icon={FileText}
                  isLoading={exportStatus === 'pdf'}
                  label="PDF"
                  onClick={() => void handleExport('pdf')}
                />
                <RcaReportExportMenuItem
                  disabled={Boolean(exportStatus)}
                  icon={Presentation}
                  isLoading={exportStatus === 'powerpoint'}
                  label="PowerPoint"
                  onClick={() => void handleExport('powerpoint')}
                />
                <RcaReportExportMenuItem
                  disabled={Boolean(exportStatus)}
                  icon={FileSpreadsheet}
                  isLoading={exportStatus === 'excel'}
                  label="Excel"
                  onClick={() => void handleExport('excel')}
                />
                <Popover.Arrow className="fill-white" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95"
            onClick={() => setIsMaximized((currentValue) => !currentValue)}
            title={isMaximized ? 'Restore report' : 'Maximize report'}
            type="button"
          >
            {isMaximized ? <Minimize2 aria-hidden="true" size={17} /> : <Maximize2 aria-hidden="true" size={17} />}
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-red-200 hover:text-red-600 active:scale-95"
            onClick={onClose}
            title="Close report"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_34%,#f8fafc_100%)] px-5 py-5">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Project</p>
            <p className="mt-2 text-sm font-medium text-slate-950">{incident.title || 'Untitled RCA project'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Status</p>
            <p className="mt-2 text-sm font-medium text-slate-950">{formatStatus(incident.status || 'ACTIVE')}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Generated</p>
            <p className="mt-2 text-sm font-medium text-slate-950">{formatAuditDate(generatedAt)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {reportSections.map((section) => (
            <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_16px_44px_rgba(15,23,42,0.07)]" key={section.id}>
              <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-cyan-700">{section.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{section.subtitle}</p>
              </div>
              <div className="space-y-3 p-5">
                {section.nodes.map((node) => (
                  <RcaIncidentReportNodeCard
                    key={node.id}
                    node={node}
                    onOpenEvidence={handleOpenEvidence}
                    previewUrls={previewUrls}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-medium text-slate-500">
          Preview only. Export and approval workflows can be added after the RCA report structure is approved.
        </p>
        <button
          className="inline-flex min-h-[38px] items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 active:scale-95"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </footer>
    </section>,
    document.body
  );
}

type RcaReportExportFormat = 'excel' | 'pdf' | 'powerpoint' | 'word';

interface RcaReportExportEvidence {
  fileName: string;
  fileUrl: string;
  key: string;
  uploadedAt: string;
}

interface RcaReportExportNode {
  evidence: RcaReportExportEvidence[];
  fields: Array<{ label: string; value: string }>;
  id: string;
  status: string;
  title: string;
  type: string;
}

interface RcaReportExportSection {
  nodes: RcaReportExportNode[];
  subtitle: string;
  title: string;
}

interface RcaReportExportPayload {
  displayId: string;
  evidenceCount: number;
  fileBaseName: string;
  generatedAt: string;
  generatedAtLabel: string;
  incidentTitle: string;
  nodeCount: number;
  projectTitle: string;
  sections: RcaReportExportSection[];
  status: string;
}

function RcaReportExportMenuItem({
  disabled,
  icon: Icon,
  isLoading,
  label,
  onClick
}: {
  disabled: boolean;
  icon: LucideIcon;
  isLoading: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800 disabled:cursor-not-allowed disabled:opacity-55"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-50 text-cyan-700 ring-1 ring-slate-200">
        <Icon aria-hidden="true" size={16} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {isLoading ? <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-600" /> : null}
    </button>
  );
}

function buildRcaReportExportPayload({
  evidenceCount,
  generatedAt,
  incident,
  incidentNode,
  reportNodes,
  reportSections
}: {
  evidenceCount: number;
  generatedAt: string;
  incident: RcaIncident;
  incidentNode: RcaNode;
  reportNodes: RcaNode[];
  reportSections: RcaReportSection[];
}): RcaReportExportPayload {
  const incidentTitle = incidentNode.label.trim() || incident.title || 'RCA Incident Report';
  const displayId = incident.displayId || buildFriendlyRcaDisplayId('RCA', incident.id, incident.createdAtIso);

  return {
    displayId,
    evidenceCount,
    fileBaseName: sanitizeRcaExportFileName(`${displayId}-${incidentTitle}`),
    generatedAt,
    generatedAtLabel: formatAuditDate(generatedAt),
    incidentTitle,
    nodeCount: reportNodes.length,
    projectTitle: incident.title || 'Untitled RCA project',
    sections: reportSections.map((section) => ({
      nodes: section.nodes.map((node) => {
        const role = node.nodeType === 'WHY' ? getFiveWhysNodeRole(node) : null;
        const status = node.isRootCause ? 'Root Cause' : node.isSuspectedCause ? 'Suspect' : '';

        return {
          evidence: node.attachedEvidence.map((item) => ({
            fileName: item.fileName || 'Evidence file',
            fileUrl: isLikelyUrl(item.fileUrl) ? item.fileUrl : '',
            key: getEvidenceKey(item),
            uploadedAt: item.uploadedAtIso ? formatAuditDate(item.uploadedAtIso) : 'Attached evidence'
          })),
          fields: getRcaReportFieldEntries(node).map((entry) => ({
            label: entry.label,
            value: entry.value
          })),
          id: node.id,
          status,
          title: getRcaReportNodeTitle(node),
          type: role ? getFiveWhysRoleLabel(role) : formatNodeType(node.nodeType)
        };
      }),
      subtitle: section.subtitle,
      title: section.title
    })),
    status: formatStatus(incident.status || 'ACTIVE')
  };
}

async function exportRcaReport(
  payload: RcaReportExportPayload,
  format: RcaReportExportFormat,
  previewUrls: Map<string, string>
) {
  if (format === 'word') {
    await exportRcaReportToWord(payload);
    return;
  }

  if (format === 'pdf') {
    await exportRcaReportToPdf(payload, previewUrls);
    return;
  }

  if (format === 'powerpoint') {
    await exportRcaReportToPowerPoint(payload, previewUrls);
    return;
  }

  await exportRcaReportToExcel(payload);
}

async function exportRcaReportToWord(payload: RcaReportExportPayload) {
  const {
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType
  } = await import('docx');
  const border = {
    bottom: { color: 'E2E8F0', size: 1, style: BorderStyle.SINGLE },
    left: { color: 'E2E8F0', size: 1, style: BorderStyle.SINGLE },
    right: { color: 'E2E8F0', size: 1, style: BorderStyle.SINGLE },
    top: { color: 'E2E8F0', size: 1, style: BorderStyle.SINGLE }
  };
  const paragraphs = [
    new Paragraph({
      children: [new TextRun({ color: '0369A1', size: 18, text: 'RCA REPORT' })],
      spacing: { after: 120 }
    }),
    new Paragraph({
      children: [new TextRun({ bold: true, size: 30, text: payload.incidentTitle })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 }
    }),
    new Paragraph({
      children: [new TextRun({ color: '475569', size: 20, text: `${payload.displayId} • ${payload.nodeCount} nodes • ${payload.evidenceCount} evidence items` })],
      spacing: { after: 240 }
    }),
    buildDocxMetaTable(payload, { Table, TableCell, TableRow, TextRun, Paragraph, WidthType, border })
  ];

  payload.sections.forEach((section) => {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ bold: true, color: '0369A1', size: 22, text: section.title })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 80 }
      }),
      new Paragraph({
        children: [new TextRun({ color: '475569', size: 19, text: section.subtitle })],
        spacing: { after: 140 }
      })
    );

    section.nodes.forEach((node) => {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ bold: true, color: '0F172A', size: 21, text: `${node.type}: ${node.title}` })],
          spacing: { before: 80, after: 80 }
        })
      );

      if (node.fields.length) {
        paragraphs.push(buildDocxFieldsTable(node, { Table, TableCell, TableRow, TextRun, Paragraph, WidthType, border }));
      }

      if (node.evidence.length) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ bold: true, color: '0369A1', size: 18, text: 'Evidence' })],
          spacing: { before: 120, after: 40 }
        }));
        node.evidence.forEach((item) => {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ color: '334155', size: 18, text: `${item.fileName} • ${item.uploadedAt}${item.fileUrl ? ` • ${item.fileUrl}` : ''}` })],
            spacing: { after: 40 }
          }));
        });
      }
    });
  });

  const doc = new Document({
    sections: [{
      children: paragraphs,
      properties: {
        page: {
          margin: { bottom: 720, left: 720, right: 720, top: 720 }
        }
      }
    }]
  });
  const blob = await Packer.toBlob(doc);
  downloadRcaReportBlob(blob, `${payload.fileBaseName}.docx`);
}

function buildDocxMetaTable(
  payload: RcaReportExportPayload,
  docx: {
    Paragraph: any;
    Table: any;
    TableCell: any;
    TableRow: any;
    TextRun: any;
    WidthType: any;
    border: any;
  }
) {
  return new docx.Table({
    borders: docx.border,
    rows: [
      new docx.TableRow({
        children: [
          buildDocxCell('Project', payload.projectTitle, docx),
          buildDocxCell('Status', payload.status, docx),
          buildDocxCell('Generated', payload.generatedAtLabel, docx)
        ]
      })
    ],
    width: { size: 100, type: docx.WidthType.PERCENTAGE }
  });
}

function buildDocxFieldsTable(
  node: RcaReportExportNode,
  docx: {
    Paragraph: any;
    Table: any;
    TableCell: any;
    TableRow: any;
    TextRun: any;
    WidthType: any;
    border: any;
  }
) {
  const rows: any[] = [];

  for (let index = 0; index < node.fields.length; index += 2) {
    rows.push(new docx.TableRow({
      children: [
        buildDocxCell(node.fields[index].label, node.fields[index].value, docx),
        node.fields[index + 1]
          ? buildDocxCell(node.fields[index + 1].label, node.fields[index + 1].value, docx)
          : buildDocxCell('', '', docx)
      ]
    }));
  }

  return new docx.Table({
    borders: docx.border,
    rows,
    width: { size: 100, type: docx.WidthType.PERCENTAGE }
  });
}

function buildDocxCell(label: string, value: string, docx: { Paragraph: any; TableCell: any; TextRun: any }) {
  return new docx.TableCell({
    children: [
      new docx.Paragraph({
        children: [new docx.TextRun({ color: '64748B', size: 15, text: label.toUpperCase() })],
        spacing: { after: 60 }
      }),
      new docx.Paragraph({
        children: [new docx.TextRun({ color: '0F172A', size: 18, text: value || 'Not provided' })]
      })
    ],
    margins: { bottom: 140, left: 140, right: 140, top: 140 }
  });
}

async function exportRcaReportToPdf(payload: RcaReportExportPayload, previewUrls: Map<string, string>) {
  const { default: JsPDF } = await import('jspdf');
  const pdf = new JsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 42;
  let y = margin;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) {
      return;
    }

    pdf.addPage();
    y = margin;
  };
  const writeText = (text: string, x: number, width: number, options: { color?: [number, number, number]; size?: number; style?: 'bold' | 'normal' } = {}) => {
    pdf.setFont('helvetica', options.style || 'normal');
    pdf.setFontSize(options.size || 10);
    pdf.setTextColor(...(options.color || [15, 23, 42]));
    const lines = pdf.splitTextToSize(text || 'Not provided', width);
    pdf.text(lines, x, y);
    y += lines.length * ((options.size || 10) + 4);
  };

  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  writeText('RCA REPORT', margin, pageWidth - margin * 2, { color: [3, 105, 161], size: 9, style: 'bold' });
  y += 4;
  writeText(payload.incidentTitle, margin, pageWidth - margin * 2, { size: 18, style: 'bold' });
  writeText(`${payload.displayId} • ${payload.nodeCount} nodes • ${payload.evidenceCount} evidence items`, margin, pageWidth - margin * 2, { color: [71, 85, 105], size: 10 });
  y += 14;
  drawPdfMetaCards(pdf, payload, margin, y, pageWidth - margin * 2);
  y += 62;

  for (const section of payload.sections) {
    ensureSpace(80);
    y += 14;
    writeText(section.title, margin, pageWidth - margin * 2, { color: [3, 105, 161], size: 11, style: 'bold' });
    writeText(section.subtitle, margin, pageWidth - margin * 2, { color: [71, 85, 105], size: 9 });
    y += 6;

    for (const node of section.nodes) {
      ensureSpace(110);
      const cardTop = y;
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(margin, cardTop, pageWidth - margin * 2, 70, 10, 10, 'FD');
      y += 18;
      writeText(`${node.type}${node.status ? ` • ${node.status}` : ''}`, margin + 14, pageWidth - margin * 2 - 28, { color: [3, 105, 161], size: 8, style: 'bold' });
      writeText(node.title, margin + 14, pageWidth - margin * 2 - 28, { size: 10, style: 'bold' });
      y = Math.max(y + 8, cardTop + 76);

      node.fields.forEach((field) => {
        ensureSpace(34);
        writeText(`${field.label}: ${field.value}`, margin + 16, pageWidth - margin * 2 - 32, { color: [51, 65, 85], size: 9 });
      });

      if (node.evidence.length) {
        ensureSpace(38);
        writeText('Evidence', margin + 16, pageWidth - margin * 2 - 32, { color: [3, 105, 161], size: 9, style: 'bold' });
        for (const evidence of node.evidence) {
          ensureSpace(48);
          const previewUrl = previewUrls.get(evidence.key);

          if (previewUrl) {
            const imageData = await toImageDataUrl(previewUrl);

            if (imageData) {
              pdf.addImage(imageData, getPdfImageFormat(imageData), margin + 16, y - 4, 42, 32, undefined, 'FAST');
              writeText(`${evidence.fileName} • ${evidence.uploadedAt}`, margin + 66, pageWidth - margin * 2 - 82, { color: [51, 65, 85], size: 8 });
              y += 8;
              continue;
            }
          }

          writeText(`${evidence.fileName} • ${evidence.uploadedAt}`, margin + 20, pageWidth - margin * 2 - 40, { color: [51, 65, 85], size: 8 });
        }
      }
    }
  }

  pdf.save(`${payload.fileBaseName}.pdf`);
}

function drawPdfMetaCards(pdf: any, payload: RcaReportExportPayload, x: number, y: number, width: number) {
  const gap = 10;
  const cardWidth = (width - gap * 2) / 3;
  const cards = [
    ['Project', payload.projectTitle],
    ['Status', payload.status],
    ['Generated', payload.generatedAtLabel]
  ];

  cards.forEach(([label, value], index) => {
    const cardX = x + index * (cardWidth + gap);
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(cardX, y, cardWidth, 52, 10, 10, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label.toUpperCase(), cardX + 12, y + 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text(pdf.splitTextToSize(value, cardWidth - 24), cardX + 12, y + 34);
  });
}

async function exportRcaReportToPowerPoint(payload: RcaReportExportPayload, previewUrls: Map<string, string>) {
  const { default: pptxgen } = await import('pptxgenjs');
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Synzapp RCA';
  pptx.subject = payload.incidentTitle;
  pptx.title = payload.incidentTitle;
  pptx.company = 'Synzapp';
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos'
  };

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: 'F8FAFC' };
  titleSlide.addText('RCA REPORT', { x: 0.6, y: 0.55, w: 3, h: 0.25, fontSize: 10, bold: true, color: '0369A1' });
  titleSlide.addText(payload.incidentTitle, { x: 0.6, y: 0.95, w: 11.8, h: 0.7, fontSize: 24, bold: true, color: '0F172A', fit: 'shrink' });
  titleSlide.addText(`${payload.displayId} • ${payload.nodeCount} nodes • ${payload.evidenceCount} evidence items`, { x: 0.6, y: 1.75, w: 11, h: 0.3, fontSize: 11, color: '475569' });
  addPptMetaCard(titleSlide, 'Project', payload.projectTitle, 0.6, 2.45);
  addPptMetaCard(titleSlide, 'Status', payload.status, 4.6, 2.45);
  addPptMetaCard(titleSlide, 'Generated', payload.generatedAtLabel, 8.6, 2.45);

  for (const section of payload.sections) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };
    slide.addText(section.title, { x: 0.55, y: 0.42, w: 12.2, h: 0.34, fontSize: 13, bold: true, color: '0369A1' });
    slide.addText(section.subtitle, { x: 0.55, y: 0.82, w: 12, h: 0.3, fontSize: 10, color: '475569' });
    let y = 1.25;

    for (const node of section.nodes.slice(0, 4)) {
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.55, y, w: 12.2, h: 1.05, rectRadius: 0.08, fill: { color: 'FFFFFF' }, line: { color: 'E2E8F0', width: 1 } });
      slide.addText(node.type, { x: 0.78, y: y + 0.15, w: 2.1, h: 0.18, fontSize: 7.5, bold: true, color: '64748B' });
      slide.addText(node.title, { x: 0.78, y: y + 0.38, w: 5.1, h: 0.46, fontSize: 10.5, bold: true, color: '0F172A', fit: 'shrink' });
      const fields = node.fields.slice(0, 4).map((field) => `${field.label}: ${field.value}`).join('\n');
      slide.addText(fields || 'No structured fields recorded.', { x: 6.05, y: y + 0.18, w: 4.3, h: 0.66, fontSize: 7.8, color: '334155', fit: 'shrink', breakLine: false });
      const firstImageEvidence = node.evidence.find((item) => previewUrls.has(item.key));

      if (firstImageEvidence) {
        const imageData = await toImageDataUrl(previewUrls.get(firstImageEvidence.key) || '');

        if (imageData) {
          slide.addImage({ data: imageData, x: 10.55, y: y + 0.16, w: 1.75, h: 0.72 });
        }
      } else if (node.evidence.length) {
        slide.addText(`${node.evidence.length} evidence item${node.evidence.length === 1 ? '' : 's'}`, { x: 10.55, y: y + 0.38, w: 1.75, h: 0.24, fontSize: 8, color: '0369A1' });
      }

      y += 1.22;
    }

    if (section.nodes.length > 4) {
      slide.addText(`+ ${section.nodes.length - 4} additional item${section.nodes.length - 4 === 1 ? '' : 's'} in this section`, { x: 0.7, y: 6.35, w: 5, h: 0.24, fontSize: 9, color: '64748B' });
    }
  }

  await pptx.writeFile({ fileName: `${payload.fileBaseName}.pptx` });
}

function addPptMetaCard(slide: any, label: string, value: string, x: number, y: number) {
  slide.addShape('roundRect', { x, y, w: 3.45, h: 0.8, rectRadius: 0.08, fill: { color: 'FFFFFF' }, line: { color: 'E2E8F0', width: 1 } });
  slide.addText(label.toUpperCase(), { x: x + 0.18, y: y + 0.14, w: 3, h: 0.16, fontSize: 7.5, color: '64748B', bold: true });
  slide.addText(value, { x: x + 0.18, y: y + 0.4, w: 3.05, h: 0.24, fontSize: 10.5, color: '0F172A', fit: 'shrink' });
}

async function exportRcaReportToExcel(payload: RcaReportExportPayload) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    ['RCA Report', payload.incidentTitle],
    ['RCA ID', payload.displayId],
    ['Project', payload.projectTitle],
    ['Status', payload.status],
    ['Generated', payload.generatedAtLabel],
    ['Nodes', payload.nodeCount],
    ['Evidence items', payload.evidenceCount]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const nodeRows = payload.sections.flatMap((section) => section.nodes.map((node) => ({
    Section: section.title,
    Type: node.type,
    Title: node.title,
    Status: node.status,
    Fields: node.fields.map((field) => `${field.label}: ${field.value}`).join('\n'),
    Evidence: node.evidence.map((item) => `${item.fileName} (${item.uploadedAt})${item.fileUrl ? ` - ${item.fileUrl}` : ''}`).join('\n')
  })));
  const nodeSheet = XLSX.utils.json_to_sheet(nodeRows);
  nodeSheet['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 58 },
    { wch: 16 },
    { wch: 90 },
    { wch: 80 }
  ];
  XLSX.utils.book_append_sheet(workbook, nodeSheet, 'RCA Flow');

  const evidenceRows = payload.sections.flatMap((section) => section.nodes.flatMap((node) => node.evidence.map((item) => ({
    Section: section.title,
    NodeType: node.type,
    NodeTitle: node.title,
    FileName: item.fileName,
    AttachedAt: item.uploadedAt,
    Link: item.fileUrl
  }))));
  const evidenceSheet = XLSX.utils.json_to_sheet(evidenceRows.length ? evidenceRows : [{ Section: '', NodeType: '', NodeTitle: '', FileName: 'No evidence attached', AttachedAt: '', Link: '' }]);
  evidenceSheet['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 58 },
    { wch: 42 },
    { wch: 24 },
    { wch: 70 }
  ];
  XLSX.utils.book_append_sheet(workbook, evidenceSheet, 'Evidence');
  XLSX.writeFile(workbook, `${payload.fileBaseName}.xlsx`, { compression: true });
}

function downloadRcaReportBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function sanitizeRcaExportFileName(value: string) {
  const cleanValue = value
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

  return cleanValue || 'RCA-report';
}

async function toImageDataUrl(sourceUrl: string): Promise<string | null> {
  if (!sourceUrl) {
    return null;
  }

  try {
    const response = await fetch(sourceUrl);
    const blob = await response.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getPdfImageFormat(dataUrl: string): 'JPEG' | 'PNG' | 'WEBP' {
  if (/^data:image\/png/i.test(dataUrl)) {
    return 'PNG';
  }

  if (/^data:image\/webp/i.test(dataUrl)) {
    return 'WEBP';
  }

  return 'JPEG';
}

function RcaIncidentReportNodeCard({
  node,
  onOpenEvidence,
  previewUrls
}: {
  node: RcaNode;
  onOpenEvidence: (item: RcaAttachedEvidence) => void;
  previewUrls: Map<string, string>;
}) {
  const role = node.nodeType === 'WHY' ? getFiveWhysNodeRole(node) : null;
  const fieldEntries = getRcaReportFieldEntries(node);
  const title = getRcaReportNodeTitle(node);

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,0.055)]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
            {role ? getFiveWhysRoleLabel(role) : formatNodeType(node.nodeType)}
          </span>
          <h3 className="mt-2 whitespace-pre-wrap text-sm font-medium leading-5 text-slate-950">{title}</h3>
        </div>
        {node.isRootCause ? (
          <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-red-700">
            Root Cause
          </span>
        ) : node.isSuspectedCause ? (
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-700">
            Suspect
          </span>
        ) : null}
      </div>

      {fieldEntries.length ? (
        <dl className="mt-3 grid gap-2 md:grid-cols-2">
          {fieldEntries.map((entry) => (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5" key={entry.key}>
              <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">{entry.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-800">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {node.attachedEvidence.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-700">Evidence</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {node.attachedEvidence.map((item) => {
              const previewUrl = getEvidencePreviewUrl(item, previewUrls);

              return (
                <button
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md active:scale-[0.99]"
                  key={getEvidenceKey(item)}
                  onClick={() => onOpenEvidence(item)}
                  type="button"
                >
                  {previewUrl ? (
                    <img alt="" className="h-24 w-full bg-slate-100 object-cover" src={previewUrl} />
                  ) : (
                    <div className="grid h-24 place-items-center bg-slate-50 text-cyan-700">
                      {isLikelyUrl(item.fileUrl) ? <Link2 aria-hidden="true" size={22} /> : <FileLock2 aria-hidden="true" size={22} />}
                    </div>
                  )}
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-slate-950">{item.fileName || 'Evidence file'}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {item.uploadedAtIso ? formatAuditDate(item.uploadedAtIso) : 'Attached evidence'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function RcaCanvasControlButtons({
  interactionMode,
  isSnapEnabled,
  onInteractionModeChange,
  onSnapToggle
}: {
  interactionMode: RcaCanvasInteractionMode;
  isSnapEnabled: boolean;
  onInteractionModeChange: (mode: RcaCanvasInteractionMode) => void;
  onSnapToggle: () => void;
}) {
  const activeControlClassName = '!bg-cyan-600 !text-white';

  return (
    <>
      <ControlButton
        aria-label="Select nodes"
        aria-pressed={interactionMode === 'select'}
        className={interactionMode === 'select' ? activeControlClassName : undefined}
        onClick={() => onInteractionModeChange('select')}
        title="V - Select nodes"
        type="button"
      >
        <BoxSelect aria-hidden="true" size={20} strokeWidth={2.15} />
      </ControlButton>
      <ControlButton
        aria-label="Pan canvas"
        aria-pressed={interactionMode === 'pan'}
        className={interactionMode === 'pan' ? activeControlClassName : undefined}
        onClick={() => onInteractionModeChange('pan')}
        title="H - Pan canvas"
        type="button"
      >
        <HandGrab aria-hidden="true" size={20} strokeWidth={2.15} />
      </ControlButton>
      <ControlButton
        aria-label={isSnapEnabled ? 'Turn snapping off' : 'Turn snapping on'}
        aria-pressed={isSnapEnabled}
        className={isSnapEnabled ? activeControlClassName : undefined}
        onClick={onSnapToggle}
        title={`S - ${isSnapEnabled ? 'Turn grid snap off' : 'Turn grid snap on'}`}
        type="button"
      >
        <Magnet aria-hidden="true" size={20} strokeWidth={2.15} />
      </ControlButton>
    </>
  );
}

function RcaCanvasContextMenu({
  canvasTheme,
  canAddNode,
  canCreateIncidentNode,
  canDeleteNode,
  canEditNode,
  canGenerateReport,
  canRearrange,
  contextMenu,
  gridSize,
  isGridVisible,
  isSnapEnabled,
  isWorking,
  methodology,
  nodeMenuKind,
  onAddFiveWhysNodeRole,
  onAddNode,
  onAddSubCause,
  onAddStickyNote,
  onClearCanvas,
  onCreateIncident,
  onCopyText,
  onDeleteNode,
  onEditNode,
  onGenerateReport,
  onNodeDetails,
  onPasteText,
  onGridSizeChange,
  onGridToggle,
  onMethodologyChange,
  onRearrange,
  onRefresh,
  onShortcutListOpen,
  onSnapToggle,
  onThemeChange
}: {
  canvasTheme: RcaCanvasTheme;
  canAddNode: boolean;
  canCreateIncidentNode: boolean;
  canDeleteNode: boolean;
  canEditNode: boolean;
  canGenerateReport: boolean;
  canRearrange: boolean;
  contextMenu: RcaCanvasContextMenuState | null;
  gridSize: number;
  isGridVisible: boolean;
  isSnapEnabled: boolean;
  isWorking: boolean;
  methodology: RcaMethodology;
  nodeMenuKind: RcaNodeContextMenuKind | null;
  onAddFiveWhysNodeRole: (role: RcaFiveWhysNodeRole) => void;
  onAddNode: () => void;
  onAddSubCause: () => void;
  onAddStickyNote: () => void;
  onClearCanvas: () => void;
  onCreateIncident: () => void;
  onCopyText: () => void;
  onDeleteNode: () => void;
  onEditNode: () => void;
  onGenerateReport: () => void;
  onNodeDetails: () => void;
  onPasteText: () => void;
  onGridSizeChange: (size: number) => void;
  onGridToggle: () => void;
  onMethodologyChange: (methodology: RcaMethodology) => void;
  onRearrange: () => void;
  onRefresh: () => void;
  onShortcutListOpen: () => void;
  onSnapToggle: () => void;
  onThemeChange: (theme: RcaCanvasTheme) => void;
}) {
  const [isAddNodeSubmenuOpen, setIsAddNodeSubmenuOpen] = React.useState(false);
  const [isCapaSubmenuOpen, setIsCapaSubmenuOpen] = React.useState(false);

  React.useEffect(() => {
    setIsAddNodeSubmenuOpen(false);
    setIsCapaSubmenuOpen(false);
  }, [contextMenu?.targetNodeId, contextMenu?.x, contextMenu?.y]);

  if (!contextMenu) {
    return null;
  }

  const gridSizePercent = Math.round((gridSize / RCA_CANVAS_GRID_DEFAULT_SIZE) * 100);
  const submenuPlacementClassName = contextMenu.submenuPlacement === 'right'
    ? 'left-[calc(100%+6px)] origin-top-left'
    : 'right-[calc(100%+6px)] origin-top-right';
  const isNodeTargetMenu = Boolean(contextMenu.targetNodeId);
  const isEmptyCanvasPaneMenu = !contextMenu.targetNodeId && contextMenu.isCanvasPaneTarget;
  const isEditableNodeTarget = nodeMenuKind === 'cause' || nodeMenuKind === 'sticky';
  const shouldShowCopyText = isEditableNodeTarget;
  const shouldShowPasteText = isEditableNodeTarget && Boolean(contextMenu.hasClipboardText);

  return (
    <div
      className={`rca-context-menu absolute z-[90] rounded-xl border border-white/70 bg-white/95 p-1 text-slate-700 shadow-[0_20px_58px_rgba(15,23,42,0.2),0_4px_14px_rgba(14,165,233,0.12)] ring-1 ring-slate-900/5 backdrop-blur-xl ${
        isNodeTargetMenu ? 'w-[176px]' : 'w-[196px]'
      }`}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {nodeMenuKind === 'category' ? (
        <>
          <RcaContextMenuItem
            disabled={!canAddNode || isWorking}
            icon={Plus}
            label="Add Node"
            onClick={onAddNode}
          />
          <RcaContextMenuItem
            disabled={!canEditNode || isWorking}
            icon={Palette}
            label="Edit Node"
            onClick={onEditNode}
            shortcut="E"
          />
          <RcaContextMenuItem
            disabled={!canEditNode || isWorking}
            icon={PanelRightOpen}
            label="Node Details"
            onClick={onNodeDetails}
            shortcut="D"
          />
        </>
      ) : nodeMenuKind === 'cause' ? (
        <>
          <RcaContextMenuItem
            disabled={!canAddNode || isWorking}
            icon={GitBranch}
            label="Add Sub Cause"
            onClick={onAddSubCause}
          />
          <RcaContextMenuItem
            disabled={!canEditNode || isWorking}
            icon={Palette}
            label="Edit Node"
            onClick={onEditNode}
            shortcut="E"
          />
          <RcaContextMenuItem
            disabled={!canEditNode || isWorking}
            icon={PanelRightOpen}
            label="Node Details"
            onClick={onNodeDetails}
            shortcut="D"
          />
          {canGenerateReport ? (
            <RcaContextMenuItem
              disabled={isWorking}
              icon={FileText}
              label="Generate RCA Report"
              onClick={onGenerateReport}
            />
          ) : null}
          {shouldShowCopyText ? (
            <RcaContextMenuItem
              disabled={isWorking}
              icon={ClipboardCopy}
              label={contextMenu.hasSelectedText ? 'Copy Text' : 'Copy Node Text'}
              onClick={onCopyText}
            />
          ) : null}
          {shouldShowPasteText ? (
            <RcaContextMenuItem
              disabled={isWorking}
              icon={ClipboardPaste}
              label="Paste Text"
              onClick={onPasteText}
            />
          ) : null}
          <RcaContextMenuItem
            disabled={!canDeleteNode || isWorking}
            icon={Trash2}
            label="Delete Node"
            onClick={onDeleteNode}
            tone="danger"
          />
        </>
      ) : nodeMenuKind === 'sticky' ? (
        <>
          <RcaContextMenuItem
            disabled={!canEditNode || isWorking}
            icon={Palette}
            label="Edit Node"
            onClick={onEditNode}
            shortcut="E"
          />
          <RcaContextMenuItem
            disabled={!canEditNode || isWorking}
            icon={PanelRightOpen}
            label="Node Details"
            onClick={onNodeDetails}
            shortcut="D"
          />
          {shouldShowCopyText ? (
            <RcaContextMenuItem
              disabled={isWorking}
              icon={ClipboardCopy}
              label={contextMenu.hasSelectedText ? 'Copy Text' : 'Copy Note Text'}
              onClick={onCopyText}
            />
          ) : null}
          {shouldShowPasteText ? (
            <RcaContextMenuItem
              disabled={isWorking}
              icon={ClipboardPaste}
              label="Paste Text"
              onClick={onPasteText}
            />
          ) : null}
          <RcaContextMenuItem
            disabled={!canDeleteNode || isWorking}
            icon={Trash2}
            label="Delete Note"
            onClick={onDeleteNode}
            tone="danger"
          />
        </>
      ) : (
        <>
          <div className="group/add-node relative">
            <RcaContextMenuItem
              disabled={!canAddNode || isWorking}
              icon={Plus}
              label="Add Node"
              onClick={() => {
                setIsAddNodeSubmenuOpen((isOpen) => !isOpen);
                setIsCapaSubmenuOpen(false);
              }}
              rightSlot={<ChevronRight aria-hidden="true" size={11} strokeWidth={2} />}
              shortcut="N"
            />
            <div className={`${isAddNodeSubmenuOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-1 scale-95 opacity-0 group-hover/add-node:pointer-events-auto group-hover/add-node:translate-y-0 group-hover/add-node:scale-100 group-hover/add-node:opacity-100'} absolute top-0 z-[92] w-[218px] rounded-xl border border-white/70 bg-white/95 p-1 shadow-[0_18px_48px_rgba(15,23,42,0.17)] ring-1 ring-slate-900/5 backdrop-blur-xl transition duration-150 ease-out ${submenuPlacementClassName}`}>
              {RCA_ADD_NODE_ROLE_OPTIONS.map((option) => (
                <RcaContextMenuItem
                  disabled={!canAddNode || isWorking}
                  icon={option.icon}
                  key={option.value}
                  label={option.label}
                  onClick={() => onAddFiveWhysNodeRole(option.value)}
                />
              ))}
              <div className="group/capa-node relative">
                <RcaContextMenuItem
                  disabled={!canAddNode || isWorking}
                  icon={PackageCheck}
                  label="CAPA Stages"
                  onClick={() => setIsCapaSubmenuOpen((isOpen) => !isOpen)}
                  rightSlot={<ChevronRight aria-hidden="true" size={11} strokeWidth={2} />}
                />
                <div className={`${isCapaSubmenuOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-1 scale-95 opacity-0 group-hover/capa-node:pointer-events-auto group-hover/capa-node:translate-y-0 group-hover/capa-node:scale-100 group-hover/capa-node:opacity-100'} absolute top-0 z-[94] w-[218px] rounded-xl border border-white/70 bg-white/95 p-1 shadow-[0_18px_48px_rgba(15,23,42,0.17)] ring-1 ring-slate-900/5 backdrop-blur-xl transition duration-150 ease-out ${submenuPlacementClassName}`}>
                  {RCA_CAPA_NODE_ROLE_OPTIONS.map((option) => (
                    <RcaContextMenuItem
                      disabled={!canAddNode || isWorking}
                      icon={option.icon}
                      key={option.value}
                      label={option.label}
                      onClick={() => onAddFiveWhysNodeRole(option.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <RcaContextMenuItem
            disabled={!canAddNode || isWorking}
            icon={StickyNote}
            label="Sticky Note"
            onClick={onAddStickyNote}
          />
          <RcaContextMenuItem
            disabled={!canCreateIncidentNode || isWorking}
            icon={FilePlus2}
            label="Incident"
            onClick={onCreateIncident}
          />
          <RcaContextMenuItem
            disabled={!canGenerateReport || isWorking}
            icon={FileText}
            label="Generate RCA Report"
            onClick={onGenerateReport}
          />
          {methodologyOptions.map((option) => (
            <RcaContextMenuItem
              active={option.value === methodology}
              disabled={isWorking}
              icon={option.icon}
              key={option.value}
              label={option.label}
              onClick={() => onMethodologyChange(option.value)}
              rightSlot={option.value === methodology ? <CheckCircle2 aria-hidden="true" size={11} strokeWidth={2} /> : null}
              shortcut={option.shortcut}
            />
          ))}
          <div className="my-1 h-px bg-slate-200/80" />
          <RcaContextMenuItem
            disabled={!canRearrange || isWorking}
            icon={AlignHorizontalSpaceBetween}
            label="Rearrange Canvas"
            onClick={onRearrange}
            shortcut="R"
          />
          {isEmptyCanvasPaneMenu ? (
            <RcaContextMenuItem
              disabled={isWorking}
              icon={RefreshCw}
              label="Refresh Canvas"
              onClick={onRefresh}
              shortcut="Shift+R"
            />
          ) : null}
          <div className="group/settings relative">
            <RcaContextMenuItem
              icon={Settings2}
              label="Settings"
              rightSlot={<ChevronRight aria-hidden="true" size={11} strokeWidth={2} />}
            />
            <div className={`pointer-events-none absolute top-0 z-[92] w-[216px] translate-y-1 scale-95 rounded-xl border border-white/70 bg-white/95 p-1 opacity-0 shadow-[0_18px_48px_rgba(15,23,42,0.17)] ring-1 ring-slate-900/5 backdrop-blur-xl transition duration-150 ease-out group-hover/settings:pointer-events-auto group-hover/settings:translate-y-0 group-hover/settings:scale-100 group-hover/settings:opacity-100 ${submenuPlacementClassName}`}>
              <RcaContextMenuItem
                active={isGridVisible}
                icon={Grid2X2}
                label={isGridVisible ? 'Turn Grid off' : 'Turn Grid on'}
                onClick={onGridToggle}
                shortcut="G"
              />
              <div
                className="rounded-lg px-2 py-1.5"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-medium leading-none text-slate-600">
                  <span className={`inline-flex items-center gap-1.5 ${isGridVisible ? 'text-emerald-700' : ''}`}>
                    <Grid2X2 aria-hidden="true" size={11} strokeWidth={1.9} />
                    Grid size
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                    isGridVisible ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {gridSizePercent}%
                  </span>
                </div>
                <input
                  aria-label="Grid size"
                  aria-valuetext={`${gridSizePercent}%`}
                  className="block h-4 w-full accent-emerald-600"
                  max={RCA_CANVAS_GRID_MAX_SIZE}
                  min={RCA_CANVAS_GRID_MIN_SIZE}
                  onChange={(event) => onGridSizeChange(Number(event.target.value))}
                  step={RCA_CANVAS_GRID_STEP}
                  type="range"
                  value={gridSize}
                />
              </div>
              <div className="group/theme relative">
                <RcaContextMenuItem
                  icon={Palette}
                  label="Canvas theme"
                  rightSlot={<ChevronRight aria-hidden="true" size={11} strokeWidth={2} />}
                />
                <div className={`pointer-events-none absolute top-0 z-[94] w-[172px] translate-y-1 scale-95 rounded-xl border border-white/70 bg-white/95 p-1 opacity-0 shadow-[0_18px_48px_rgba(15,23,42,0.17)] ring-1 ring-slate-900/5 backdrop-blur-xl transition duration-150 ease-out group-hover/theme:pointer-events-auto group-hover/theme:translate-y-0 group-hover/theme:scale-100 group-hover/theme:opacity-100 ${submenuPlacementClassName}`}>
                  {RCA_CANVAS_THEME_OPTIONS.map((option) => (
                    <RcaContextMenuItem
                      active={option.value === canvasTheme}
                      icon={option.icon}
                      key={option.value}
                      label={option.label}
                      onClick={() => onThemeChange(option.value)}
                      rightSlot={option.value === canvasTheme ? <CheckCircle2 aria-hidden="true" size={11} strokeWidth={2} /> : null}
                    />
                  ))}
                </div>
              </div>
              <RcaContextMenuItem
                active={isSnapEnabled}
                icon={Magnet}
                label={isSnapEnabled ? 'Grid snap On' : 'Grid snap Off'}
                onClick={onSnapToggle}
                shortcut="S"
              />
              <div className="my-1 h-px bg-slate-200/80" />
              <RcaContextMenuItem
                disabled={isWorking}
                icon={Trash2}
                label="Clear Canvas"
                onClick={onClearCanvas}
                tone="danger"
              />
              <div className="my-1 h-px bg-slate-200/80" />
              <RcaContextMenuItem
                icon={ClipboardList}
                label="Shortcut list"
                onClick={onShortcutListOpen}
                shortcut="?"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RcaNodeStyleToolbar({
  editor,
  isWorking,
  node,
  onChange
}: {
  editor: RcaNodeStyleEditorState | null;
  isWorking: boolean;
  node: RcaNode | null;
  onChange: (nodeId: string, visualStylePatch: RcaNodeVisualStyle) => void;
}) {
  if (!editor || !node) {
    return null;
  }

  const visualStyle = getResolvedNodeVisualStyle(node);

  return (
    <div
      className="absolute z-[95] flex h-[46px] items-center gap-1.5 rounded-2xl border border-white/75 bg-white/95 p-1.5 text-slate-700 shadow-[0_16px_38px_rgba(15,23,42,0.18),0_3px_12px_rgba(14,165,233,0.12)] ring-1 ring-slate-900/5 backdrop-blur-xl"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{ left: editor.x, top: editor.y }}
    >
      <div className="flex h-9 items-center gap-1 rounded-xl bg-slate-50/90 px-1 ring-1 ring-slate-200/70" aria-label="Node style controls">
        <RcaStyleColorControl
          disabled={isWorking}
          icon={PaintBucket}
          label="Node fill color"
          onChange={(backgroundColor) => onChange(node.id, { backgroundColor })}
          value={visualStyle.backgroundColor}
        />
        <RcaStyleColorControl
          disabled={isWorking}
          icon={Square}
          label="Node border color"
          onChange={(borderColor) => onChange(node.id, { borderColor })}
          value={visualStyle.borderColor}
        />
      </div>
      <span className="h-7 w-px bg-slate-200" />
      <div className="flex h-9 items-center gap-1 rounded-xl bg-slate-50/90 px-1 ring-1 ring-slate-200/70" aria-label="Font controls">
        <Type aria-hidden="true" className="ml-1 text-slate-500" size={14} strokeWidth={1.9} />
        <select
          aria-label="Font type"
          className="h-8 w-[116px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium leading-none text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isWorking}
          onChange={(event) => onChange(node.id, { fontFamily: event.target.value })}
          value={visualStyle.fontFamily}
        >
          {RCA_NODE_FONT_FAMILY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          aria-label="Font size"
          className="h-8 w-[58px] rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-medium leading-none text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isWorking}
          onChange={(event) => onChange(node.id, { fontSize: Number(event.target.value) })}
          value={visualStyle.fontSize}
        >
          {RCA_NODE_FONT_SIZE_OPTIONS.map((fontSize) => (
            <option key={fontSize} value={fontSize}>{fontSize}</option>
          ))}
        </select>
        <RcaStyleColorControl
          disabled={isWorking}
          icon={Baseline}
          label="Font color"
          onChange={(textColor) => onChange(node.id, { textColor })}
          value={visualStyle.textColor}
        />
        <RcaStyleToggleControl
          active={visualStyle.isBold}
          disabled={isWorking}
          icon={Bold}
          label="Bold"
          onClick={() => onChange(node.id, { isBold: !visualStyle.isBold })}
        />
        <RcaStyleToggleControl
          active={visualStyle.isItalic}
          disabled={isWorking}
          icon={Italic}
          label="Italic"
          onClick={() => onChange(node.id, { isItalic: !visualStyle.isItalic })}
        />
        <RcaStyleToggleControl
          active={visualStyle.isUnderline}
          disabled={isWorking}
          icon={Underline}
          label="Underline"
          onClick={() => onChange(node.id, { isUnderline: !visualStyle.isUnderline })}
        />
      </div>
    </div>
  );
}

function RcaCanvasShortcutPanel({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [panelOffset, setPanelOffset] = React.useState({ x: 0, y: 0 });
  const [isDraggingPanel, setIsDraggingPanel] = React.useState(false);
  const dragStateRef = React.useRef<{
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPanelOffset({ x: 0, y: 0 });
      setIsDraggingPanel(false);
      dragStateRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) {
      return;
    }

    dragStateRef.current = {
      originX: panelOffset.x,
      originY: panelOffset.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    setIsDraggingPanel(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setPanelOffset({
      x: dragState.originX + event.clientX - dragState.startX,
      y: dragState.originY + event.clientY - dragState.startY
    });
  };
  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDraggingPanel(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={`absolute right-5 top-20 z-[95] w-[360px] max-w-[calc(100vw-40px)] overflow-hidden rounded-2xl border border-white/70 bg-white/96 text-slate-800 shadow-[0_26px_70px_rgba(15,23,42,0.22),0_6px_18px_rgba(14,165,233,0.12)] ring-1 ring-slate-900/5 backdrop-blur-xl will-change-transform ${
        isDraggingPanel ? 'transition-none' : 'transition-transform duration-200 ease-out'
      }`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{ transform: `translate3d(${panelOffset.x}px, ${panelOffset.y}px, 0)` }}
    >
      <div
        className="flex touch-none select-none items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-3 cursor-grab active:cursor-grabbing"
        onPointerCancel={handleDragEnd}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-700">Shortcuts</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">RCA canvas tools</h3>
        </div>
        <button
          aria-label="Close shortcut list"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95"
          onClick={onClose}
          title="Close shortcuts"
          type="button"
        >
          <X aria-hidden="true" size={15} strokeWidth={2} />
        </button>
      </div>
      <div className="max-h-[min(560px,calc(100svh-160px))] overflow-y-auto p-3">
        {RCA_CANVAS_SHORTCUT_GROUPS.map((group, groupIndex) => {
          const groupShortcuts = RCA_CANVAS_SHORTCUTS.filter((shortcut) => shortcut.group === group);

          return (
            <section className={groupIndex === 0 ? '' : 'mt-3'} key={group}>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{group}</p>
              <div className="space-y-1.5">
                {groupShortcuts.map((shortcut) => (
                  <div
                    className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2"
                    key={`${shortcut.group}-${shortcut.key}-${shortcut.action}`}
                  >
                    <kbd className="min-w-[72px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-[10px] font-bold leading-none text-slate-700 shadow-sm">
                      {shortcut.key}
                    </kbd>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-950">{shortcut.action}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{shortcut.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RcaSplineStyleToolbar({
  editor,
  isWorking,
  node,
  onChange
}: {
  editor: RcaSplineStyleEditorState | null;
  isWorking: boolean;
  node: RcaNode | null;
  onChange: (nodeId: string, edgeStylePatch: RcaNodeEdgeStyle) => void;
}) {
  if (!editor || !node) {
    return null;
  }

  const splineStyle = getResolvedRcaSplineStyle(node, RCA_DEFAULT_SPLINE_STYLE.color, RCA_DEFAULT_SPLINE_STYLE.weight);

  return (
    <div
      className="absolute z-[95] flex h-[46px] items-center gap-1.5 rounded-2xl border border-white/75 bg-white/95 p-1.5 text-slate-700 shadow-[0_16px_38px_rgba(15,23,42,0.18),0_3px_12px_rgba(14,165,233,0.12)] ring-1 ring-slate-900/5 backdrop-blur-xl"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{ left: editor.x, top: editor.y }}
    >
      <div className="flex h-9 items-center gap-1 rounded-xl bg-slate-50/90 px-1 ring-1 ring-slate-200/70" aria-label="Spline color and weight controls">
        <RcaStyleColorControl
          disabled={isWorking}
          icon={Palette}
          label="Spline color"
          onChange={(color) => onChange(node.id, { color })}
          value={splineStyle.color}
        />
        <select
          aria-label="Spline weight"
          className="h-8 w-[72px] rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-medium leading-none text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isWorking}
          onChange={(event) => onChange(node.id, { weight: Number(event.target.value) })}
          value={splineStyle.weight}
        >
          {RCA_SPLINE_WEIGHT_OPTIONS.map((weight) => (
            <option key={weight} value={weight}>{weight}px</option>
          ))}
        </select>
      </div>
      <span className="h-7 w-px bg-slate-200" />
      <div className="flex h-9 items-center gap-1 rounded-xl bg-slate-50/90 px-1 ring-1 ring-slate-200/70" aria-label="Spline line controls">
        <Route aria-hidden="true" className="ml-1 text-slate-500" size={14} strokeWidth={1.9} />
        <select
          aria-label="Spline line type"
          className="h-8 w-[118px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium leading-none text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isWorking}
          onChange={(event) => onChange(node.id, { lineType: event.target.value as RcaSplineLineType })}
          value={splineStyle.lineType}
        >
          {RCA_SPLINE_LINE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <span className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1" aria-label="Spline arrowhead controls">
          {RCA_SPLINE_ARROW_HEAD_OPTIONS.map((option) => (
            <RcaSplineArrowHeadButton
              active={splineStyle.arrowHead === option.value}
              arrowHead={option.value}
              color={splineStyle.color}
              disabled={isWorking}
              key={option.value}
              label={option.label}
              lineType={splineStyle.lineType}
              onClick={() => onChange(node.id, { arrowHead: option.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RcaSplineArrowHeadButton({
  active,
  arrowHead,
  color,
  disabled = false,
  label,
  lineType,
  onClick
}: {
  active: boolean;
  arrowHead: RcaSplineArrowHead;
  color: string;
  disabled?: boolean;
  label: string;
  lineType: RcaSplineLineType;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={`Spline arrowhead ${label}`}
      aria-pressed={active}
      className={`grid h-8 w-12 place-items-center rounded-lg border shadow-sm shadow-slate-950/5 transition ${
        active
          ? 'border-cyan-300 bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70'
          : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-700'
      } disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={label}
      type="button"
    >
      <RcaSplineArrowPreview arrowHead={arrowHead} color={color} lineType={lineType} />
    </button>
  );
}

function RcaSplineArrowPreview({
  arrowHead,
  color,
  lineType
}: {
  arrowHead: RcaSplineArrowHead;
  color: string;
  lineType: RcaSplineLineType;
}) {
  const dashArray = getRcaSplineDashArray(lineType, 2);

  return (
    <svg aria-hidden="true" className="h-4 w-9" viewBox="0 0 44 18">
      <line
        stroke={color}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        strokeWidth="2"
        x1="4"
        x2="30"
        y1="9"
        y2="9"
      />
      {arrowHead === 'OPEN' ? (
        <path d="M 28 4 L 38 9 L 28 14" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={RCA_SPLINE_ARROW_STROKE_WIDTH} />
      ) : (
        <path
          d="M 28 4 L 39 9 L 28 14 Z"
          fill={arrowHead === 'CLOSED_FILLED' ? color : '#ffffff'}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={RCA_SPLINE_ARROW_STROKE_WIDTH}
        />
      )}
    </svg>
  );
}

function RcaStyleColorControl({
  disabled = false,
  icon: Icon,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const normalizedValue = isValidHexColor(value) ? value : '#0284c7';
  const [draftHex, setDraftHex] = React.useState(normalizedValue);

  React.useEffect(() => {
    setDraftHex(normalizedValue);
  }, [normalizedValue]);

  const commitColor = (nextValue: string) => {
    const nextHex = nextValue.startsWith('#') ? nextValue : `#${nextValue}`;

    setDraftHex(nextHex);

    if (isValidHexColor(nextHex)) {
      onChange(nextHex);
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label={`${label} picker`}
          className={`relative grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm shadow-slate-950/5 transition ${
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-cyan-200 hover:text-cyan-700 active:scale-95'
          }`}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          title={label}
          type="button"
        >
          <Icon aria-hidden="true" size={14} strokeWidth={1.9} />
          <span
            aria-hidden="true"
            className="absolute bottom-1 h-0.5 w-5 rounded-full"
            style={{ backgroundColor: normalizedValue }}
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-[160] w-[244px] rounded-2xl border border-white/80 bg-white p-3 text-slate-800 shadow-[0_24px_60px_rgba(15,23,42,0.24),0_6px_18px_rgba(14,165,233,0.14)] ring-1 ring-slate-900/5"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          side="bottom"
          sideOffset={10}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700">{label}</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">Pick or enter a brand-safe color.</p>
            </div>
            <span className="h-8 w-8 shrink-0 rounded-full border border-slate-200 shadow-inner" style={{ backgroundColor: normalizedValue }} />
          </div>
          <HexColorPicker
            className="mt-3 !h-[150px] !w-full [&_.react-colorful__hue]:!h-3 [&_.react-colorful__hue]:!rounded-full [&_.react-colorful__pointer]:!h-4 [&_.react-colorful__pointer]:!w-4 [&_.react-colorful__pointer]:!border-2 [&_.react-colorful__saturation]:!rounded-xl"
            color={normalizedValue}
            onChange={commitColor}
          />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">#</span>
            <input
              aria-label={`${label} hex value`}
              className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs font-semibold uppercase text-slate-700 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-500/15"
              maxLength={7}
              onChange={(event) => commitColor(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              value={draftHex.replace('#', '').toUpperCase()}
            />
          </div>
          <div className="mt-3 grid grid-cols-8 gap-1.5" aria-label={`${label} preset colors`}>
            {RCA_STYLE_COLOR_SWATCHES.map((swatch) => (
              <button
                aria-label={`Use ${swatch}`}
                className={`h-6 w-6 rounded-full border shadow-sm transition hover:scale-110 ${
                  swatch.toLowerCase() === normalizedValue.toLowerCase()
                    ? 'border-slate-900 ring-2 ring-cyan-200'
                    : 'border-white ring-1 ring-slate-200'
                }`}
                key={swatch}
                onClick={(event) => {
                  event.stopPropagation();
                  commitColor(swatch);
                }}
                style={{ backgroundColor: swatch }}
                title={swatch}
                type="button"
              />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RcaStyleToggleControl({
  active,
  disabled = false,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-lg border text-slate-600 shadow-sm shadow-slate-950/5 transition ${
        active
          ? 'border-cyan-300 bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70'
          : 'border-slate-200 bg-white hover:border-cyan-200 hover:text-cyan-700'
      } disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
    </button>
  );
}

function RcaContextMenuItem({
  active = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
  rightSlot = null,
  shortcut,
  tone = 'default'
}: {
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  rightSlot?: React.ReactNode;
  shortcut?: string;
  tone?: 'danger' | 'default';
}) {
  const title = shortcut ? `${shortcut} - ${label}` : label;
  const defaultClassName = active
    ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-950/5 ring-1 ring-emerald-100'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 active:scale-[0.99]';
  const enabledClassName = tone === 'danger'
    ? 'text-red-600 hover:bg-red-50 hover:text-red-700 active:scale-[0.99]'
    : defaultClassName;

  return (
    <button
      className={`flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-[10px] font-medium leading-none transition ${
        disabled
          ? 'cursor-not-allowed text-slate-300'
          : enabledClassName
      }`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      title={title}
      type="button"
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-slate-50 text-current ring-1 ring-slate-200/70">
        <Icon aria-hidden="true" size={15} strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <kbd className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold leading-none text-slate-500 shadow-sm">
          {shortcut}
        </kbd>
      ) : null}
      {rightSlot ? <span className="shrink-0 text-current">{rightSlot}</span> : null}
    </button>
  );
}

function RcaFishboneSpineNode(props: NodeProps) {
  const data = props.data as unknown as RcaFishboneSpineData;

  return (
    <div
      aria-label="Select fishbone fault-gate spine"
      className={`relative h-full w-full cursor-grab rounded-full transition active:cursor-grabbing ${
        data.selected ? 'ring-4 ring-cyan-500/20' : ''
      }`}
      role="button"
      tabIndex={0}
      title="Fault-gate spine. Select and drag to move the fishbone centerline."
    >
      <div
        className={`absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition ${
          data.selected
            ? 'bg-cyan-700 shadow-[0_0_0_4px_rgba(14,165,233,0.18),0_4px_12px_rgba(15,23,42,0.18)]'
            : 'bg-cyan-600/90'
        }`}
      />
      {data.selected ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-600 shadow-md shadow-cyan-950/25" />
      ) : null}
    </div>
  );
}

function RcaNodeCard(props: NodeProps) {
  const data = props.data as unknown as RcaNodeCardData;
  const node = data.node;
  const updateNodeInternals = useUpdateNodeInternals();
  const detail = data.detail;
  const isCategory = node.nodeType === 'ISHIKAWA_CATEGORY';
  const isFaultGate = node.nodeType === 'FAULT_GATE';
  const isStickyNote = node.nodeType === 'STICKY_NOTE';
  const nodeIndex = Math.max(0, data.nodes.findIndex((candidateNode) => candidateNode.id === node.id));
  const fiveWhysNodeRole = node.nodeType === 'WHY'
    ? getFiveWhysDisplayRole(node, data.nodes, nodeIndex)
    : null;
  const fiveWhysBadgeLabel = fiveWhysNodeRole
    ? getFiveWhysNodeBadgeLabel(node, data.nodes, nodeIndex, fiveWhysNodeRole)
    : null;
  const activeActivity = data.activities[0] || null;
  const canInlineEditLabel = Boolean(
    !data.isReferenceProject &&
    !isCategory &&
    data.incidentId &&
    data.sessionId
  );
  const [isInlineEditing, setIsInlineEditing] = React.useState(false);
  const [inlineLabel, setInlineLabel] = React.useState(node.label);
  const [isInlineTextSynced, setIsInlineTextSynced] = React.useState(false);
  const inlineDocRef = React.useRef<Y.Doc | null>(null);
  const inlineTextRef = React.useRef<Y.Text | null>(null);
  const inlineTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const stickyNoteAuthorFirstName = node.createdBy ? getUserFirstName(node.createdBy.displayName) : 'User';
  const nodeSize = getRcaNodeSize(node, detail);
  const visualStyle = getResolvedNodeVisualStyle(node);
  const nodeVisualStyle: React.CSSProperties = {
    backgroundColor: node.visualStyle?.backgroundColor || undefined,
    borderColor: node.visualStyle?.borderColor || undefined,
    height: node.nodeType === 'STICKY_NOTE' ? nodeSize.height : undefined,
    minHeight: nodeSize.height,
    width: nodeSize.width
  };
  const labelVisualStyle: React.CSSProperties = {
    color: node.visualStyle?.textColor || undefined,
    fontFamily: getNodeFontFamilyCss(visualStyle.fontFamily),
    fontSize: `${visualStyle.fontSize}px`,
    fontStyle: visualStyle.isItalic ? 'italic' : undefined,
    fontWeight: visualStyle.isBold ? 700 : 400,
    textDecorationLine: visualStyle.isUnderline ? 'underline' : undefined,
    lineHeight: isStickyNote ? 1.3 : 1.22
  };
  const eyebrowVisualStyle: React.CSSProperties = {
    color: node.visualStyle?.textColor || undefined,
    fontFamily: getNodeFontFamilyCss(visualStyle.fontFamily)
  };
  const stateClassName = node.isRootCause
    ? 'border-l-4 border-l-red-500 border-y-red-100 border-r-red-100 bg-red-50/92 shadow-red-950/12'
    : isCategory
      ? 'border-cyan-200 bg-cyan-50/92 ring-1 ring-cyan-500/10'
      : isStickyNote
        ? data.selected
          ? 'border-amber-400 bg-amber-100/95 ring-4 ring-amber-500/20'
          : 'border-amber-300 bg-amber-100/95'
      : node.isSuspectedCause
        ? 'border-l-4 border-l-amber-400 border-y-amber-100 border-r-amber-100 bg-amber-50/80 shadow-amber-950/10'
        : data.selected
          ? 'border-cyan-300 bg-white ring-4 ring-cyan-500/15'
          : 'border-slate-200 bg-white/95';
  const selectedClassName = data.selected
    ? 'outline outline-[3px] outline-offset-2 outline-cyan-500 shadow-[0_0_0_7px_rgba(14,165,233,0.16),0_18px_38px_rgba(15,23,42,0.22)]'
    : '';
  const inputHandleClassName = data.selected
    ? '!h-3.5 !w-3.5 !border-[3px] !border-white !bg-cyan-600 !shadow-md !shadow-cyan-950/25'
    : '!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400';
  const outputHandleClassName = data.selected
    ? '!z-30 !h-3.5 !w-3.5 !border-[3px] !border-white !bg-cyan-600 !shadow-md !shadow-cyan-950/25'
    : '!z-30 !h-2.5 !w-2.5 !border-2 !border-white !bg-cyan-500';

  React.useLayoutEffect(() => {
    if (!isStickyNote) {
      return undefined;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      updateNodeInternals(node.id);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isStickyNote, node.id, nodeSize.height, nodeSize.width, updateNodeInternals]);

  React.useEffect(() => {
    if (!isInlineEditing) {
      setInlineLabel(node.label);
    }
  }, [isInlineEditing, node.label]);

  React.useEffect(() => {
    setIsInlineTextSynced(false);

    if (!isInlineEditing || !data.incidentId || !data.sessionId || !data.isRealtimeReady) {
      return undefined;
    }

    const doc = new Y.Doc();
    const text = doc.getText('label');

    inlineDocRef.current = doc;
    inlineTextRef.current = text;

    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') {
        return;
      }

      rcaRealtimeClient.sendNodeTextUpdate(data.incidentId!, data.sessionId!, node.id, update, text.toString());
    };
    const unsubscribe = rcaRealtimeClient.subscribe((event) => {
      if (
        (event.type === 'nodeTextSync' || event.type === 'nodeTextUpdate') &&
        event.nodeId === node.id &&
        event.incidentId === data.incidentId &&
        event.sessionId === data.sessionId &&
        event.update
      ) {
        Y.applyUpdate(doc, decodeRcaRealtimeUpdate(event.update), 'remote');
        setInlineLabel(text.toString());
        setIsInlineTextSynced(true);
      }
    });

    doc.on('update', handleUpdate);
    rcaRealtimeClient.sendNodeActivity(data.incidentId, data.sessionId, node.id, 'editing');
    rcaRealtimeClient.subscribeNodeText(data.incidentId, data.sessionId, node.id);

    window.setTimeout(() => {
      inlineTextareaRef.current?.focus();
      inlineTextareaRef.current?.setSelectionRange(inlineLabel.length, inlineLabel.length);
    }, 0);

    return () => {
      doc.off('update', handleUpdate);
      unsubscribe();
      rcaRealtimeClient.sendNodeActivity(data.incidentId!, data.sessionId!, node.id, 'idle');
      doc.destroy();
      inlineDocRef.current = null;
      inlineTextRef.current = null;
    };
  }, [data.incidentId, data.isRealtimeReady, data.sessionId, isInlineEditing, node.id]);

  function startInlineEditing(event: React.MouseEvent) {
    if (!canInlineEditLabel) {
      return;
    }

    event.stopPropagation();
    setInlineLabel(node.label);
    setIsInlineTextSynced(false);
    setIsInlineEditing(true);
  }

  function updateInlineLabel(value: string) {
    setInlineLabel(value);
    const text = inlineTextRef.current;

    if (!text) {
      return;
    }

    text.doc?.transact(() => {
      text.delete(0, text.length);
      text.insert(0, value);
    });
  }

  async function finishInlineEditing() {
    if (!isInlineEditing) {
      return;
    }

    const nextLabel = inlineLabel.trim();
    setIsInlineEditing(false);

    if (!nextLabel || nextLabel === node.label) {
      return;
    }

    try {
      await data.onLabelCommit(node.id, nextLabel);
    } catch {
      setInlineLabel(node.label);
    }
  }

  return (
    <div
      aria-label={`Open RCA node ${node.label || formatNodeType(node.nodeType)}`}
      className={`relative cursor-grab border shadow-md backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg active:cursor-grabbing ${
        isCategory
          ? 'min-h-[76px] w-56 rounded-2xl px-5 py-4'
          : isStickyNote
            ? 'overflow-visible rounded-sm p-2 shadow-lg'
          : isFaultGate
            ? 'min-h-28 w-72 rounded-xl p-4'
            : 'min-h-[132px] w-72 rounded-xl p-4'
      } ${stateClassName} ${selectedClassName}`}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
        }
      }}
      role="button"
      style={nodeVisualStyle}
      tabIndex={0}
    >
      {data.selected ? (
        <span className="pointer-events-none absolute -right-2 -top-2 z-40 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-cyan-600 px-1 text-[10px] font-black uppercase leading-none text-white shadow-lg shadow-cyan-950/25">
          Selected
        </span>
      ) : null}
      <Handle
        className={inputHandleClassName}
        id={RCA_TARGET_LEFT_HANDLE}
        position={Position.Left}
        type="target"
      />
      <Handle
        className={inputHandleClassName}
        id={RCA_TARGET_TOP_HANDLE}
        position={Position.Top}
        type="target"
      />
      <Handle
        className={outputHandleClassName}
        id={RCA_SOURCE_RIGHT_HANDLE}
        position={Position.Right}
        type="source"
      />
      <Handle
        className={outputHandleClassName}
        id={RCA_SOURCE_BOTTOM_HANDLE}
        position={Position.Bottom}
        type="source"
      />
      {isStickyNote ? (
        <>
          {node.createdBy ? (
            <div className="pointer-events-none absolute -left-5 -top-5 z-20 rounded-full bg-white p-1 shadow-lg shadow-amber-950/20 ring-2 ring-amber-300">
              <RcaUserAvatar size="lg" user={node.createdBy} />
            </div>
          ) : null}
          {activeActivity ? (
            <span className="pointer-events-none absolute -top-7 left-9 z-20 inline-flex max-w-[170px] items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 shadow-md shadow-emerald-950/10 ring-1 ring-emerald-100">
              <Users aria-hidden="true" size={12} />
              <span className="truncate">{activeActivity.user.displayName}</span>
              <span>{activeActivity.activity === 'moving' ? 'moving' : 'editing'}</span>
            </span>
          ) : null}
          {isInlineEditing ? (
            <div className="nodrag nopan nowheel flex min-h-[64px] w-full items-start gap-1 rounded-sm border border-amber-300/70 bg-amber-50/80 px-2.5 py-2 outline-none ring-4 ring-amber-400/15">
              <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-amber-950" style={labelVisualStyle}>
                {stickyNoteAuthorFirstName} :
              </span>
              <textarea
                className="nodrag nopan nowheel min-h-[48px] flex-1 resize-none border-0 bg-transparent p-0 text-sm text-amber-950 outline-none"
                disabled={data.isRealtimeReady && !isInlineTextSynced}
                onBlur={() => void finishInlineEditing()}
                onChange={(event) => updateInlineLabel(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onKeyDownCapture={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation();

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setInlineLabel(node.label);
                    setIsInlineEditing(false);
                  }

                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    void finishInlineEditing();
                  }
                }}
                onKeyUpCapture={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder="Write a note..."
                ref={inlineTextareaRef}
                rows={3}
                style={labelVisualStyle}
                value={inlineLabel}
              />
            </div>
          ) : (
            <div
              className="block min-h-[64px] whitespace-pre-wrap break-words rounded-sm px-2.5 py-2 text-sm text-amber-950 transition hover:bg-amber-50/70"
              onDoubleClick={startInlineEditing}
              style={labelVisualStyle}
            >
              <span className="font-semibold">{stickyNoteAuthorFirstName} : </span>
              {node.label || <span className="text-amber-800/55">Write a note...</span>}
            </div>
          )}
        </>
      ) : isCategory ? (
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700" style={eyebrowVisualStyle}>Branch</p>
          <p className="mt-1 break-words font-semibold uppercase tracking-[0.18em] text-cyan-950" style={labelVisualStyle}>{node.label}</p>
        </div>
      ) : (
        <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
          isCategory
            ? 'bg-cyan-600 text-white'
            : fiveWhysNodeRole === 'PROBLEM'
              ? 'bg-sky-100 text-sky-800'
            : fiveWhysNodeRole === 'CAPA'
              ? 'bg-emerald-100 text-emerald-800'
            : fiveWhysNodeRole
              ? 'bg-slate-100 text-slate-600'
            : node.isRootCause
              ? 'bg-red-600 text-white'
              : node.isSuspectedCause
                ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-600'
        }`}>
          {fiveWhysBadgeLabel
            ? fiveWhysBadgeLabel
            : node.isRootCause
            ? 'Verified root'
            : node.isSuspectedCause
              ? 'Suspect'
                : formatNodeType(node.nodeType)}
        </span>
        {activeActivity ? (
          <span className="inline-flex max-w-[150px] items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <Users aria-hidden="true" size={12} />
            <span className="truncate">{activeActivity.user.displayName}</span>
            <span>{activeActivity.activity === 'moving' ? 'moving' : 'editing'}</span>
          </span>
        ) : node.lockedBy ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
            <Lock aria-hidden="true" size={12} />
            Editing
          </span>
        ) : null}
      </div>
      {isInlineEditing ? (
        <textarea
          className="nodrag nopan nowheel min-h-[72px] w-full resize-none rounded-xl border border-cyan-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none ring-4 ring-cyan-500/10"
          disabled={data.isRealtimeReady && !isInlineTextSynced}
          onBlur={() => void finishInlineEditing()}
          onChange={(event) => updateInlineLabel(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDownCapture={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === 'Escape') {
              event.preventDefault();
              setInlineLabel(node.label);
              setIsInlineEditing(false);
            }

            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              void finishInlineEditing();
            }
          }}
          onKeyUpCapture={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          ref={inlineTextareaRef}
          rows={3}
          style={labelVisualStyle}
          value={inlineLabel}
        />
      ) : (
        <p
          className={`whitespace-pre-wrap break-words text-sm text-slate-900 ${
            canInlineEditLabel ? 'cursor-text rounded-lg transition hover:bg-cyan-50/70' : ''
          }`}
          onDoubleClick={startInlineEditing}
          style={labelVisualStyle}
        >
          {node.label || 'Click to describe this cause'}
        </p>
      )}
      {detail?.verification ? (
        <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-white/72 px-3 py-2 text-xs leading-4 text-slate-600 ring-1 ring-slate-200/70">
          {detail.verification}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <FileLock2 aria-hidden="true" size={13} />
          {node.attachedEvidence.length} evidence
        </span>
        {detail?.actions.length ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Wrench aria-hidden="true" size={13} />
            {detail.actions.length} CAPA
          </span>
        ) : null}
        {node.isRootCause ? (
          <span className="inline-flex items-center gap-1 text-red-600">
            <AlertTriangle aria-hidden="true" size={13} />
            Root cause
          </span>
        ) : node.isSuspectedCause ? (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <Gauge aria-hidden="true" size={13} />
            Suspect
          </span>
        ) : null}
      </div>
      </>
      )}
    </div>
  );
}

function RcaInspectorDrawer({
  incidentId,
  isReferenceProject = false,
  isRealtimeReady,
  isWorking,
  methodology,
  nodeDetail,
  node,
  nodes,
  onClose,
  onDelete,
  onLabelLiveChange,
  onPreview,
  onSave,
  sessionId
}: {
  incidentId: string | null;
  isReferenceProject?: boolean;
  isRealtimeReady: boolean;
  isWorking: boolean;
  methodology: RcaMethodology;
  nodeDetail?: ReferenceRcaNodeDetail;
  node: RcaNode | null;
  nodes: RcaNode[];
  onClose: () => void;
  onDelete: () => void;
  onLabelLiveChange: (nodeId: string, label: string) => void;
  onPreview: (input: RcaNodeEditInput) => void;
  onSave: (input: RcaNodeEditInput) => void;
  sessionId: string | null;
}) {
  const [draft, setDraft] = React.useState<RcaInspectorDraft>({
    attachedEvidence: [],
    detailFields: {},
    fiveWhysNodeRole: 'FIVE_WHYS',
    isRootCause: false,
    isSuspectedCause: false,
    label: '',
    nodeType: 'WHY' as RcaNodeType,
    parentNodeId: '',
    whyChain: []
  });
  const [displayNode, setDisplayNode] = React.useState<RcaNode | null>(null);
  const [displayNodeDetail, setDisplayNodeDetail] = React.useState<ReferenceRcaNodeDetail | undefined>(undefined);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const [panelWidth, setPanelWidth] = React.useState(RCA_INSPECTOR_PANEL_DEFAULT_WIDTH);
  const [evidencePreviewUrls, setEvidencePreviewUrls] = React.useState<Map<string, string>>(() => new Map());
  const [evidenceLinkDraft, setEvidenceLinkDraft] = React.useState('');
  const [selectedEvidencePhotoKey, setSelectedEvidencePhotoKey] = React.useState<string | null>(null);
  const [revealedFiveWhysCount, setRevealedFiveWhysCount] = React.useState(1);
  const labelLiveSaveTimeoutRef = React.useRef<number | null>(null);
  const evidenceInputRef = React.useRef<HTMLInputElement | null>(null);
  const evidenceObjectUrlsRef = React.useRef<Set<string>>(new Set());
  const migratedEvidenceKeysRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => () => {
    if (labelLiveSaveTimeoutRef.current !== null) {
      window.clearTimeout(labelLiveSaveTimeoutRef.current);
    }
  }, []);

  React.useEffect(() => {
    function handleResize() {
      setPanelWidth((currentWidth) => Math.min(currentWidth, getRcaInspectorPanelMaxWidth()));
    }

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => () => {
    evidenceObjectUrlsRef.current.forEach((objectUrl) => {
      if (objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    });
    evidenceObjectUrlsRef.current.clear();
  }, []);

  React.useEffect(() => {
    let isCurrent = true;

    async function hydrateStoredEvidencePreviews() {
      const missingEvidence = draft.attachedEvidence.filter((item) => (
        isImageEvidence(item) &&
        !evidencePreviewUrls.has(getEvidenceKey(item)) &&
        !isBrowserDisplayableImageUrl(item.fileUrl)
      ));

      if (!missingEvidence.length) {
        return;
      }

      const restoredEntries = await Promise.all(missingEvidence.map(async (item) => {
        let blob = await getStoredEvidencePreviewBlob(getEvidenceKey(item));

        if (!blob && incidentId && sessionId && isRcaStoredEvidenceUrl(item.fileUrl)) {
          try {
            blob = await downloadRcaEvidenceBlob(incidentId, sessionId, item.fileUrl);
            await storeEvidencePreviewBlob(getEvidenceKey(item), blob);
          } catch {
            blob = null;
          }
        }

        if (!blob) {
          return null;
        }

        return {
          key: getEvidenceKey(item),
          objectUrl: URL.createObjectURL(blob)
        };
      }));

      if (!isCurrent) {
        restoredEntries.forEach((entry) => {
          if (entry?.objectUrl) {
            URL.revokeObjectURL(entry.objectUrl);
          }
        });
        return;
      }

      const nextPreviewUrls = new Map(evidencePreviewUrls);
      let didRestorePreview = false;

      restoredEntries.forEach((entry) => {
        if (!entry) {
          return;
        }

        evidenceObjectUrlsRef.current.add(entry.objectUrl);
        nextPreviewUrls.set(entry.key, entry.objectUrl);
        didRestorePreview = true;
      });

      if (didRestorePreview) {
        setEvidencePreviewUrls(nextPreviewUrls);
      }
    }

    void hydrateStoredEvidencePreviews();

    return () => {
      isCurrent = false;
    };
  }, [draft.attachedEvidence, evidencePreviewUrls, incidentId, sessionId]);

  React.useEffect(() => {
    if (node) {
      const shouldAnimateOpen = !displayNode || !isPanelOpen;

      setDisplayNode(node);
      setDisplayNodeDetail(nodeDetail);

      if (shouldAnimateOpen) {
        setIsPanelOpen(false);

        let secondAnimationFrame = 0;
        const animationFrame = window.requestAnimationFrame(() => {
          secondAnimationFrame = window.requestAnimationFrame(() => {
            setIsPanelOpen(true);
          });
        });

        return () => {
          window.cancelAnimationFrame(animationFrame);
          window.cancelAnimationFrame(secondAnimationFrame);
        };
      }

      setIsPanelOpen(true);
      return undefined;
    }

    setIsPanelOpen(false);

    const closeTimer = window.setTimeout(() => {
      setDisplayNode(null);
      setDisplayNodeDetail(undefined);
    }, 320);

    return () => window.clearTimeout(closeTimer);
  }, [node, nodeDetail]);

  React.useEffect(() => {
    if (!displayNode) {
      return;
    }

    const displayNodeIndex = Math.max(0, nodes.findIndex((candidateNode) => candidateNode.id === displayNode.id));
    const fiveWhysNodeRole = getFiveWhysDisplayRole(displayNode, nodes, displayNodeIndex);

    const syncedDisplayNode = syncRootCauseTypeWithParentCategory(displayNode, nodes);
    const syncedDetailFields = { ...(syncedDisplayNode.detailFields || {}) };
    const primaryLabelFieldKey = syncedDisplayNode.nodeType === 'ISHIKAWA_CATEGORY' || syncedDisplayNode.nodeType !== 'WHY'
      ? null
      : getRcaPrimaryLabelFieldKey(fiveWhysNodeRole);
    const syncedPrimaryLabel = primaryLabelFieldKey
      ? (syncedDetailFields[primaryLabelFieldKey] || '').trim()
      : '';
    const syncedLabel = syncedPrimaryLabel || syncedDisplayNode.label || '';

    if (primaryLabelFieldKey && syncedLabel && syncedDetailFields[primaryLabelFieldKey] !== syncedLabel) {
      syncedDetailFields[primaryLabelFieldKey] = syncedLabel;
    }

    setDraft({
      attachedEvidence: syncedDisplayNode.attachedEvidence || [],
      detailFields: syncedDetailFields,
      fiveWhysNodeRole,
      isRootCause: Boolean(syncedDisplayNode.isRootCause),
      isSuspectedCause: Boolean(syncedDisplayNode.isSuspectedCause || syncedDisplayNode.isRootCause),
      label: syncedLabel,
      nodeType: syncedDisplayNode.nodeType || 'WHY',
      parentNodeId: syncedDisplayNode.parentNodeId || '',
      whyChain: normalizeFiveWhyDraft(syncedDisplayNode.whyChain)
    });
    setEvidenceLinkDraft('');
    setSelectedEvidencePhotoKey(null);
    setRevealedFiveWhysCount(getInitialFiveWhysRevealCount(displayNode.whyChain));
  }, [displayNode]);

  const updateDraft = React.useCallback((nextDraft: RcaInspectorDraft) => {
    setDraft(nextDraft);
    onPreview({
      attachedEvidence: nextDraft.attachedEvidence,
      detailFields: nextDraft.detailFields,
      fiveWhysNodeRole: nextDraft.fiveWhysNodeRole,
      isRootCause: nextDraft.isRootCause,
      isSuspectedCause: nextDraft.isSuspectedCause,
      label: nextDraft.label,
      nodeType: nextDraft.nodeType,
      parentNodeId: nextDraft.parentNodeId || null,
      whyChain: nextDraft.whyChain
    });
  }, [onPreview]);

  const persistDraft = React.useCallback((nextDraft: RcaInspectorDraft) => {
    updateDraft(nextDraft);
    onSave({
      attachedEvidence: nextDraft.attachedEvidence,
      detailFields: nextDraft.detailFields,
      fiveWhysNodeRole: nextDraft.fiveWhysNodeRole,
      isRootCause: nextDraft.isRootCause,
      isSuspectedCause: nextDraft.isSuspectedCause,
      label: nextDraft.label,
      nodeType: nextDraft.nodeType,
      parentNodeId: nextDraft.parentNodeId || null,
      whyChain: nextDraft.whyChain
    });
  }, [onSave, updateDraft]);

  React.useEffect(() => {
    if (!displayNode || !incidentId || !sessionId) {
      return undefined;
    }

    const legacyEvidence = draft.attachedEvidence.filter((item) => (
      isLegacyLocalEvidenceUrl(item.fileUrl) &&
      isImageEvidence(item) &&
      !migratedEvidenceKeysRef.current.has(getEvidenceKey(item))
    ));

    if (!legacyEvidence.length) {
      return undefined;
    }

    const activeIncidentId = incidentId;
    const activeSessionId = sessionId;
    let isCurrent = true;

    async function migrateLegacyEvidence() {
      const migratedEvidenceByKey = new Map<string, RcaAttachedEvidence>();
      const nextPreviewUrls = new Map(evidencePreviewUrls);

      for (const item of legacyEvidence) {
        const legacyKey = getEvidenceKey(item);
        migratedEvidenceKeysRef.current.add(legacyKey);

        try {
          const blob = await getStoredEvidencePreviewBlob(legacyKey);

          if (!blob || !isCurrent) {
            continue;
          }

          const evidence = await uploadRcaEvidenceFile(activeIncidentId, activeSessionId, {
            contentType: blob.type || inferEvidenceContentType(item.fileName),
            dataUrl: await blobToDataUrl(blob),
            fileHash: item.fileHash,
            fileName: item.fileName
          });

          if (!isCurrent) {
            continue;
          }

          migratedEvidenceByKey.set(legacyKey, evidence);
          await storeEvidencePreviewBlob(getEvidenceKey(evidence), blob);

          const existingPreviewUrl = evidencePreviewUrls.get(legacyKey);
          if (existingPreviewUrl) {
            nextPreviewUrls.set(getEvidenceKey(evidence), existingPreviewUrl);
            nextPreviewUrls.delete(legacyKey);
          } else {
            const objectUrl = URL.createObjectURL(blob);
            evidenceObjectUrlsRef.current.add(objectUrl);
            nextPreviewUrls.set(getEvidenceKey(evidence), objectUrl);
          }
        } catch {
          migratedEvidenceKeysRef.current.delete(legacyKey);
        }
      }

      if (!isCurrent || !migratedEvidenceByKey.size) {
        return;
      }

      setEvidencePreviewUrls(nextPreviewUrls);
      persistDraft({
        ...draft,
        attachedEvidence: draft.attachedEvidence.map((item) => (
          migratedEvidenceByKey.get(getEvidenceKey(item)) || item
        ))
      });
    }

    void migrateLegacyEvidence();

    return () => {
      isCurrent = false;
    };
  }, [displayNode, draft, evidencePreviewUrls, incidentId, persistDraft, sessionId]);

  if (!displayNode) {
    return null;
  }

  const inspectedNode = displayNode;
  const activeNodeDetail = displayNodeDetail;
  const hasOtherFaultGateNode = nodes.some((candidateNode) => (
    candidateNode.nodeType === 'FAULT_GATE' && candidateNode.id !== inspectedNode.id
  ));
  const availableNodeTypeOptions = nodeTypeOptions.filter((option) => (
    option.value !== 'FAULT_GATE' || !hasOtherFaultGateNode || inspectedNode.nodeType === 'FAULT_GATE'
  ));
  const isFiveWhysDetails = inspectedNode.nodeType === 'WHY' && Boolean(getFiveWhysNodeRole(inspectedNode));
  const childNodeIdsByParentId = new Map<string, string[]>();

  nodes.forEach((candidateNode) => {
    if (!candidateNode.parentNodeId) {
      return;
    }

    childNodeIdsByParentId.set(candidateNode.parentNodeId, [
      ...(childNodeIdsByParentId.get(candidateNode.parentNodeId) || []),
      candidateNode.id
    ]);
  });

  const descendantNodeIds = new Set<string>();
  const descendantQueue = [...(childNodeIdsByParentId.get(inspectedNode.id) || [])];

  while (descendantQueue.length) {
    const descendantId = descendantQueue.shift();

    if (!descendantId || descendantNodeIds.has(descendantId)) {
      continue;
    }

    descendantNodeIds.add(descendantId);
    descendantQueue.push(...(childNodeIdsByParentId.get(descendantId) || []));
  }

  const parentNodeOptions = nodes.filter((candidateNode) => {
    if (candidateNode.id === inspectedNode.id || descendantNodeIds.has(candidateNode.id)) {
      return false;
    }

    if (isFiveWhysDetails) {
      return candidateNode.nodeType === 'WHY' && Boolean(getFiveWhysNodeRole(candidateNode));
    }

    if (draft.nodeType === 'STICKY_NOTE') {
      return isStickyNoteConnectableTargetNode(candidateNode);
    }

    return candidateNode.nodeType !== 'STICKY_NOTE';
  });
  const directChildNodes = nodes
    .filter((candidateNode) => candidateNode.parentNodeId === inspectedNode.id)
    .sort((firstNode, secondNode) => {
      const firstPosition = getNodePosition(firstNode, nodes, Math.max(0, nodes.findIndex((node) => node.id === firstNode.id)), methodology);
      const secondPosition = getNodePosition(secondNode, nodes, Math.max(0, nodes.findIndex((node) => node.id === secondNode.id)), methodology);

      return firstPosition.y === secondPosition.y
        ? firstPosition.x - secondPosition.x
        : firstPosition.y - secondPosition.y;
    });
  const isFiveWhysFlowNode = isFiveWhysDetails && draft.fiveWhysNodeRole === 'FIVE_WHYS';
  const canConfirmRootCause = hasCompletedFiveWhys(draft.whyChain);
  const shouldShowEvidenceSection = isFiveWhysDetails && draft.fiveWhysNodeRole === 'EVIDENCE';
  const fiveWhyAnswers = normalizeFiveWhyDraft(draft.whyChain);
  const fiveWhysParentNode = draft.parentNodeId
    ? nodes.find((candidateNode) => candidateNode.id === draft.parentNodeId)
    : null;
  const fiveWhysQuestionSource = isFiveWhysFlowNode
    ? (fiveWhysParentNode?.label || draft.label || inspectedNode.label)
    : (draft.label || inspectedNode.label);
  const fiveWhyQuestions = buildFiveWhyQuestions(fiveWhysQuestionSource, fiveWhyAnswers);
  const activeFiveWhyIndex = Math.min(revealedFiveWhysCount - 1, 4);
  const roleDetailFields = isFiveWhysDetails
    ? RCA_NODE_DETAIL_SCHEMA[draft.fiveWhysNodeRole] || []
    : [];
  const primaryLabelFieldKey = draft.nodeType === 'ISHIKAWA_CATEGORY' || !isFiveWhysDetails
    ? null
    : getRcaPrimaryLabelFieldKey(draft.fiveWhysNodeRole);

  function queueLabelLiveSave(nextDraft: RcaInspectorDraft, label: string) {
    if (
      !displayNode ||
      !incidentId ||
      !sessionId ||
      !isRealtimeReady ||
      nextDraft.nodeType === 'ISHIKAWA_CATEGORY'
    ) {
      return;
    }

    onLabelLiveChange(displayNode.id, label);

    if (labelLiveSaveTimeoutRef.current !== null) {
      window.clearTimeout(labelLiveSaveTimeoutRef.current);
    }

    labelLiveSaveTimeoutRef.current = window.setTimeout(() => {
      labelLiveSaveTimeoutRef.current = null;
      onSave({
        attachedEvidence: nextDraft.attachedEvidence,
        detailFields: nextDraft.detailFields,
        fiveWhysNodeRole: nextDraft.fiveWhysNodeRole,
        isRootCause: nextDraft.isRootCause,
        isSuspectedCause: nextDraft.isSuspectedCause,
        label: nextDraft.label,
        nodeType: nextDraft.nodeType,
        parentNodeId: nextDraft.parentNodeId || null,
        whyChain: nextDraft.whyChain
      });
    }, 700);
  }

  function handleFiveWhysNodeRoleChange(fiveWhysNodeRole: RcaFiveWhysNodeRole) {
    updateDraft({
      ...draft,
      detailFields: buildDefaultRcaNodeDetailFields(fiveWhysNodeRole),
      fiveWhysNodeRole,
      isRootCause: false,
      isSuspectedCause: draft.isSuspectedCause,
      label: stripFiveWhysRolePrefix(draft.label),
      nodeType: 'WHY'
    });
  }

  function handleWhyChange(index: number, value: string) {
    const nextWhyChain = normalizeFiveWhyDraft(draft.whyChain);
    nextWhyChain[index] = value;

    updateDraft({
      ...draft,
      isRootCause: draft.isRootCause && hasCompletedFiveWhys(nextWhyChain) && draft.attachedEvidence.length > 0,
      isSuspectedCause: true,
      whyChain: nextWhyChain
    });
  }

  function handleDetailFieldChange(fieldKey: string, value: string) {
    const fieldDefinition = roleDetailFields.find((field) => field.key === fieldKey);
    const otherTextKey = getRcaOtherDetailFieldKey(fieldKey);
    const shouldClearOtherText = fieldDefinition?.type === 'select' &&
      hasRcaOtherOption(fieldDefinition) &&
      value !== 'Other';
    const nextDetailFields = {
      ...draft.detailFields,
      [fieldKey]: value
    };

    if (shouldClearOtherText) {
      delete nextDetailFields[otherTextKey];
    }

    const rootCauseCategoryNode = fieldKey === 'rootCauseType' && isRootCauseRoleNode(inspectedNode)
      ? findFishboneCategoryNodeByType(nodes, value)
      : null;
    const nextLabel = primaryLabelFieldKey === fieldKey && draft.nodeType !== 'ISHIKAWA_CATEGORY'
      ? value
      : draft.label;
    const nextDraft = {
      ...draft,
      detailFields: nextDetailFields,
      label: nextLabel,
      parentNodeId: rootCauseCategoryNode?.id || draft.parentNodeId
    };

    updateDraft(nextDraft);

    if (primaryLabelFieldKey === fieldKey) {
      queueLabelLiveSave(nextDraft, nextLabel);
    }
  }

  function handleParentNodeChange(parentNodeId: string) {
    const parentCategory = nodes.find((candidateNode) => candidateNode.id === parentNodeId);
    const rootCauseType = isRootCauseRoleNode(inspectedNode)
      ? getFishboneCategoryValueFromNode(parentCategory)
      : null;

    updateDraft({
      ...draft,
      detailFields: rootCauseType
        ? {
            ...draft.detailFields,
            rootCauseType
          }
        : draft.detailFields,
      parentNodeId
    });
  }

  function handleAddFiveWhysAnswer() {
    if (!fiveWhyAnswers[activeFiveWhyIndex]?.trim()) {
      return;
    }

    setRevealedFiveWhysCount((currentCount) => Math.min(5, currentCount + 1));
    persistDraft({
      ...draft,
      isSuspectedCause: true,
      whyChain: normalizeFiveWhyDraft(draft.whyChain)
    });
  }

  function handleConfirmFiveWhysRootCause() {
    if (!canConfirmRootCause) {
      return;
    }

    persistDraft({
      ...draft,
      isRootCause: true,
      isSuspectedCause: true,
      whyChain: normalizeFiveWhyDraft(draft.whyChain)
    });
  }

  function handleLabelDraftChange(label: string) {
    const nextDetailFields = primaryLabelFieldKey
      ? {
          ...draft.detailFields,
          [primaryLabelFieldKey]: label
        }
      : draft.detailFields;
    const nextDraft = { ...draft, detailFields: nextDetailFields, label };

    updateDraft(nextDraft);
    queueLabelLiveSave(nextDraft, label);
  }

  function handleLabelEditingFinished() {
    if (!displayNode || !incidentId || !sessionId || !isRealtimeReady) {
      return;
    }

    rcaRealtimeClient.sendNodeActivity(incidentId, sessionId, displayNode.id, 'idle');
  }

  async function handleEvidenceFiles(files: FileList | File[] | null) {
    const fileList = files ? Array.from(files) : [];

    if (!fileList.length) {
      return;
    }

    if (!incidentId || !sessionId) {
      return;
    }

    const nextPreviewUrls = new Map(evidencePreviewUrls);
    const builtEvidence: RcaAttachedEvidence[] = [];

    await Promise.all(fileList.map(async (file) => {
      const fileHash = await hashEvidenceFile(file);
      const isPreviewableImage = isPreviewableImageFile(file);
      let uploadBlob: Blob = file;
      let uploadContentType = file.type || 'application/octet-stream';
      let objectUrl: string | null = null;

      if (isPreviewableImage) {
        try {
          const preview = await buildEvidencePreview(file);
          uploadBlob = preview.blob;
          uploadContentType = preview.blob.type || uploadContentType || 'image/jpeg';
          objectUrl = URL.createObjectURL(preview.blob);
        } catch {
          // Keep the evidence attached even when the browser cannot decode a preview.
        }
      }

      const evidence = await uploadRcaEvidenceFile(incidentId, sessionId, {
        contentType: uploadContentType,
        dataUrl: await blobToDataUrl(uploadBlob),
        fileHash,
        fileName: file.name
      });

      builtEvidence.push(evidence);

      if (objectUrl) {
        await storeEvidencePreviewBlob(getEvidenceKey(evidence), uploadBlob);
        evidenceObjectUrlsRef.current.add(objectUrl);
        nextPreviewUrls.set(getEvidenceKey(evidence), objectUrl);
      }
    }));

    setEvidencePreviewUrls(nextPreviewUrls);

    persistDraft({
      ...draft,
      attachedEvidence: [...draft.attachedEvidence, ...builtEvidence],
      isSuspectedCause: true
    });
  }

  function handleEvidencePaste(event: React.ClipboardEvent<HTMLElement>) {
    const pastedFiles = Array.from(event.clipboardData.files || []);
    const pastedUrl = event.clipboardData.getData('text/plain').trim();

    if (pastedFiles.length) {
      event.preventDefault();
      void handleEvidenceFiles(pastedFiles);
      return;
    }

    if (isLikelyUrl(pastedUrl)) {
      event.preventDefault();
      addEvidenceLink(pastedUrl);
    }
  }

  function handleEvidenceDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();

    const droppedFiles = Array.from(event.dataTransfer.files || []);
    const droppedUrl = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');

    if (droppedFiles.length) {
      void handleEvidenceFiles(droppedFiles);
      return;
    }

    if (isLikelyUrl(droppedUrl.trim())) {
      addEvidenceLink(droppedUrl.trim());
    }
  }

  function addEvidenceLink(rawUrl = evidenceLinkDraft) {
    const normalizedUrl = normalizeEvidenceUrl(rawUrl);

    if (!normalizedUrl) {
      return;
    }

    const evidence = buildEvidenceFromLink(normalizedUrl);

    persistDraft({
      ...draft,
      attachedEvidence: [...draft.attachedEvidence, evidence],
      isSuspectedCause: true
    });
    setEvidenceLinkDraft('');
  }

  function handleEvidenceRename(item: RcaAttachedEvidence, fileName: string) {
    const normalizedFileName = fileName.trim().slice(0, 180);

    if (!normalizedFileName || normalizedFileName === item.fileName) {
      return;
    }

    persistDraft({
      ...draft,
      attachedEvidence: draft.attachedEvidence.map((candidate) => (
        getEvidenceKey(candidate) === getEvidenceKey(item)
          ? { ...candidate, fileName: normalizedFileName }
          : candidate
      ))
    });
  }

  function handleEvidenceRemove(item: RcaAttachedEvidence) {
    const evidenceKey = getEvidenceKey(item);
    const previewUrl = evidencePreviewUrls.get(evidenceKey);
    const nextPreviewUrls = new Map(evidencePreviewUrls);

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
      evidenceObjectUrlsRef.current.delete(previewUrl);
    }

    nextPreviewUrls.delete(evidenceKey);
    setEvidencePreviewUrls(nextPreviewUrls);
    void deleteStoredEvidencePreviewBlob(evidenceKey);

    if (selectedEvidencePhotoKey === evidenceKey) {
      setSelectedEvidencePhotoKey(null);
    }

    persistDraft({
      ...draft,
      attachedEvidence: draft.attachedEvidence.filter((candidate) => getEvidenceKey(candidate) !== evidenceKey),
      isRootCause: draft.isRootCause && draft.attachedEvidence.length > 1
    });
  }

  async function handleEvidenceOpenFile(item: RcaAttachedEvidence) {
    if (isLikelyUrl(item.fileUrl)) {
      window.open(item.fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!incidentId || !sessionId || !isRcaStoredEvidenceUrl(item.fileUrl)) {
      return;
    }

    const previewWindow = window.open('', '_blank');

    try {
      const blob = await downloadRcaEvidenceBlob(incidentId, sessionId, item.fileUrl);
      const objectUrl = URL.createObjectURL(blob);

      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.href = objectUrl;
      } else {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.rel = 'noreferrer';
        link.target = '_blank';
        link.download = item.fileName || 'evidence';
        link.click();
      }

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      previewWindow?.close();
    }
  }

  const evidencePhotoItems = draft.attachedEvidence
    .map((item) => ({
      item,
      previewUrl: getEvidencePreviewUrl(item, evidencePreviewUrls)
    }))
    .filter((entry) => Boolean(entry.previewUrl));
  const selectedEvidencePhotoIndex = evidencePhotoItems.findIndex((entry) => getEvidenceKey(entry.item) === selectedEvidencePhotoKey);
  const selectedEvidencePhoto = selectedEvidencePhotoIndex >= 0 ? evidencePhotoItems[selectedEvidencePhotoIndex] : null;
  const panelClassName = `fixed right-0 top-[52px] z-50 flex h-[calc(100svh-52px)] max-w-[calc(100vw-20px)] will-change-transform flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/12 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none max-lg:w-full ${
    isPanelOpen ? 'translate-x-0' : 'translate-x-[calc(100%+24px)]'
  }`;

  function handlePanelResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = panelWidth;

    function handlePointerMove(pointerEvent: PointerEvent) {
      const nextWidth = startWidth + startX - pointerEvent.clientX;

      setPanelWidth(clampRcaInspectorPanelWidth(nextWidth));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  if (isReferenceProject) {
    const evidence = activeNodeDetail?.evidence || inspectedNode.attachedEvidence.map((attachedEvidence) => ({
      capturedAt: attachedEvidence.uploadedAtIso || REFERENCE_RCA_PROJECT.sealedAt,
      fileHash: attachedEvidence.fileHash,
      fileName: attachedEvidence.fileName,
      kind: 'Evidence',
      source: attachedEvidence.fileUrl,
      uploadedBy: 'RCA team'
    }));
    const actions = activeNodeDetail?.actions || [];

    return (
      <aside className={panelClassName} style={{ width: panelWidth }}>
        <button
          aria-label="Resize node details panel"
          className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-transparent transition hover:bg-cyan-400/20 active:bg-cyan-400/30"
          onPointerDown={handlePanelResizeStart}
          type="button"
        />
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Node details</p>
              <h2 className="mt-1 text-lg font-semibold leading-6 text-slate-950">
                {getRcaNodePanelTitle(inspectedNode)}
              </h2>
            </div>
            <button
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 active:scale-95"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-5 text-slate-800">
            {inspectedNode.label || 'No description added yet.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-3 py-1 font-semibold text-cyan-700 ring-1 ring-cyan-100">
              <GitBranch aria-hidden="true" size={13} />
              {activeNodeDetail?.branch || formatNodeType(inspectedNode.nodeType)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-100">
              <FileLock2 aria-hidden="true" size={13} />
              {evidence.length ? 'Evidence attached' : 'No evidence attached'}
            </span>
            {inspectedNode.isRootCause ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700 ring-1 ring-red-100">
                <AlertTriangle aria-hidden="true" size={13} />
                Root cause
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto px-5 py-3">
          {activeNodeDetail?.verification ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Eye aria-hidden="true" size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Verification</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {activeNodeDetail.verification}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {activeNodeDetail?.whyChain?.length ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <ListChecks aria-hidden="true" className="text-cyan-700" size={17} />
                <h3 className="text-sm font-semibold text-slate-950">5 Whys chain</h3>
              </div>
              <div className="space-y-1.5">
                {activeNodeDetail.whyChain.map((why, index) => (
                  <div className="grid grid-cols-[26px_1fr] gap-2 rounded-xl bg-slate-50 px-3 py-2" key={why}>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-5 text-slate-700">{why}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <UploadCloud aria-hidden="true" className="text-cyan-700" size={17} />
              <h3 className="text-sm font-semibold text-slate-950">Evidence</h3>
            </div>
            {evidence.length ? (
              <div className="space-y-1.5">
                {evidence.map((item) => (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={`${item.fileName}-${item.capturedAt}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{item.fileName}</p>
                        <p className="mt-1 text-xs leading-4 text-slate-500">
                          {item.kind} / {item.source} / {item.uploadedBy}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatAuditDate(item.capturedAt)}</p>
                      </div>
                      <Camera aria-hidden="true" className="shrink-0 text-cyan-700" size={17} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                No evidence is attached to this node.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Wrench aria-hidden="true" className="text-emerald-700" size={17} />
              <h3 className="text-sm font-semibold text-slate-950">Corrective actions</h3>
            </div>
            {actions.length ? (
              <div className="space-y-1.5">
                {actions.map((action) => (
                  <div className="rounded-xl border border-slate-200 p-3" key={`${action.action}-${action.dueDate}`}>
                    <p className="text-sm font-semibold leading-5 text-slate-900">{action.action}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{action.owner}</span>
                      <span className="rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-700">{action.system}</span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{action.status}</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">Due {formatAuditDate(action.dueDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                No corrective action is linked to this node.
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-slate-200 px-5 py-3">
          <span className="min-w-0 text-xs leading-4 text-slate-500">
            Sealed {formatAuditDate(REFERENCE_RCA_PROJECT.sealedAt)} / {REFERENCE_RCA_PROJECT.signedBy}
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className={panelClassName} style={{ width: panelWidth }}>
      <button
        aria-label="Resize node details panel"
        className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-transparent transition hover:bg-cyan-400/20 active:bg-cyan-400/30"
        onPointerDown={handlePanelResizeStart}
        type="button"
      />
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-700">Node details</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {isFiveWhysDetails ? getFiveWhysRoleLabel(draft.fiveWhysNodeRole) : getRcaNodePanelTitle(inspectedNode)}
          </h2>
        </div>
        <button
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 active:scale-95"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Label</span>
          <textarea
            className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-5 text-slate-900 outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4"
            disabled={draft.nodeType === 'ISHIKAWA_CATEGORY'}
            onBlur={handleLabelEditingFinished}
            onChange={(event) => handleLabelDraftChange(event.target.value)}
            onFocus={() => {
              if (displayNode && incidentId && sessionId && isRealtimeReady && draft.nodeType !== 'ISHIKAWA_CATEGORY') {
                rcaRealtimeClient.sendNodeActivity(incidentId, sessionId, displayNode.id, 'editing');
              }
            }}
            placeholder={draft.nodeType === 'ISHIKAWA_CATEGORY' ? 'Category labels are managed by the RCA methodology.' : 'Describe the cause, symptom, or why statement'}
            value={draft.label}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Node type</span>
          {isFiveWhysDetails ? (
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-cyan-500/20 transition focus:border-cyan-400 focus:ring-4"
              onChange={(event) => handleFiveWhysNodeRoleChange(event.target.value as RcaFiveWhysNodeRole)}
              value={draft.fiveWhysNodeRole}
            >
              {RCA_FIVE_WHYS_NODE_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-cyan-500/20 transition focus:border-cyan-400 focus:ring-4"
              onChange={(event) => {
                const nodeType = event.target.value as RcaNodeType;

                updateDraft({
                  ...draft,
                  nodeType,
                  parentNodeId: nodeType === 'FAULT_GATE' && inspectedNode.nodeType !== 'FAULT_GATE'
                    ? ''
                    : draft.parentNodeId
                });
              }}
              value={draft.nodeType}
            >
              {availableNodeTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Parent node</span>
          <select
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-cyan-500/20 transition focus:border-cyan-400 focus:ring-4"
            disabled={draft.nodeType === 'FAULT_GATE'}
            onChange={(event) => handleParentNodeChange(event.target.value)}
            value={draft.parentNodeId}
          >
            <option value="">No parent</option>
            {parentNodeOptions.map((candidateNode) => (
              <option key={candidateNode.id} value={candidateNode.id}>
                {isFiveWhysDetails
                  ? `${getFiveWhysRoleLabel(getFiveWhysNodeRole(candidateNode))}: ${candidateNode.label || 'Untitled'}`
                  : candidateNode.label || formatNodeType(candidateNode.nodeType)}
              </option>
            ))}
          </select>
        </label>

        <RcaNodeChildrenField
          childrenNodes={directChildNodes}
          isFiveWhysDetails={isFiveWhysDetails}
          nodes={nodes}
        />

        {roleDetailFields.length ? (
          <RcaNodeDetailFieldsSection
            fields={roleDetailFields}
            onChange={handleDetailFieldChange}
            values={draft.detailFields}
          />
        ) : null}

        {isFiveWhysFlowNode ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks aria-hidden="true" className="text-cyan-700" size={17} />
                <h3 className="text-sm font-semibold text-slate-950">5 WHYS</h3>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                hasCompletedFiveWhys(draft.whyChain)
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
              }`}>
                {Math.min(5, fiveWhyAnswers.filter((answer) => answer.trim()).length)} / 5
              </span>
            </div>

            <div className="space-y-3">
              {fiveWhyAnswers.slice(0, revealedFiveWhysCount).map((answer, index) => {
                const isActiveStep = index === activeFiveWhyIndex;

                return (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={`five-whys-step-${index + 1}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 ring-1 ring-slate-200">
                        Why {index + 1}
                      </span>
                      {answer.trim() ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                          Answered
                        </span>
                      ) : null}
                    </div>
                    <p className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-semibold leading-5 text-cyan-950 ring-1 ring-cyan-100">
                      {fiveWhyQuestions[index]}
                    </p>
                    <textarea
                      className="mt-2 min-h-[72px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-900 outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4"
                      onChange={(event) => handleWhyChange(index, event.target.value)}
                      placeholder="Answer this why"
                      value={answer}
                    />
                    {isActiveStep ? (
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        {index < 4 ? (
                          <button
                            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 text-xs font-semibold text-white transition hover:bg-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!answer.trim()}
                            onClick={handleAddFiveWhysAnswer}
                            type="button"
                          >
                            <Plus aria-hidden="true" size={15} />
                            Add
                          </button>
                        ) : (
                          <>
                            <button
                              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95"
                              disabled={!answer.trim()}
                              onClick={handleAddFiveWhysAnswer}
                              type="button"
                            >
                              Extend
                            </button>
                            <div className="basis-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
                              If this Root Cause is resolved, does it fix the original issue?
                            </div>
                            <button
                              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!canConfirmRootCause}
                              onClick={handleConfirmFiveWhysRootCause}
                              type="button"
                            >
                              <CheckCircle2 aria-hidden="true" size={15} />
                              Confirm root Cause
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {shouldShowEvidenceSection ? (
        <section
          className="rounded-2xl border border-slate-200 bg-white p-3"
          onContextMenu={(event) => event.currentTarget.focus()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleEvidenceDrop}
          onPaste={handleEvidencePaste}
          tabIndex={0}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileLock2 aria-hidden="true" className="text-cyan-700" size={17} />
              <h3 className="text-sm font-semibold text-slate-950">Evidence</h3>
            </div>
            <button
              className="inline-flex min-h-[34px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 active:scale-95"
              onClick={() => evidenceInputRef.current?.click()}
              type="button"
            >
              <UploadCloud aria-hidden="true" size={15} />
              Attach
            </button>
            <input
              accept={RCA_EVIDENCE_FILE_ACCEPT}
              className="hidden"
              multiple
              onChange={(event) => {
                void handleEvidenceFiles(event.target.files);
                event.target.value = '';
              }}
              ref={evidenceInputRef}
              type="file"
            />
          </div>
          <div className="mb-3 rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/45 px-3 py-3 text-sm text-slate-600 outline-none ring-cyan-500/20 transition focus:ring-4">
            <p className="font-semibold text-slate-800">Drop files here, or right click and paste.</p>
            <p className="mt-1 text-xs leading-4 text-slate-500">
              Photos, iPhone images, documents, audio, and video can be attached. Links can be added below.
            </p>
          </div>
          {draft.attachedEvidence.length ? (
            <div className="grid grid-cols-2 gap-2">
              {draft.attachedEvidence.map((item) => (
                <RcaEvidenceAttachmentCard
                  item={item}
                  key={getEvidenceKey(item)}
                  onOpenFile={handleEvidenceOpenFile}
                  onPreview={(evidence) => setSelectedEvidencePhotoKey(getEvidenceKey(evidence))}
                  onRemove={handleEvidenceRemove}
                  onRename={handleEvidenceRename}
                  previewUrl={getEvidencePreviewUrl(item, evidencePreviewUrls)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
              No evidence attached yet.
            </div>
          )}
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Link2 aria-hidden="true" className="text-cyan-700" size={16} />
              <h4 className="text-sm font-semibold text-slate-950">Evidence link</h4>
            </div>
            <div className="flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4"
                onChange={(event) => setEvidenceLinkDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addEvidenceLink();
                  }
                }}
                placeholder="https://example.com/photo-or-record"
                value={evidenceLinkDraft}
              />
              <button
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!normalizeEvidenceUrl(evidenceLinkDraft)}
                onClick={() => addEvidenceLink()}
                type="button"
              >
                Add
              </button>
            </div>
          </div>
        </section>
        ) : null}

        {selectedEvidencePhoto ? (
          <RcaEvidencePhotoViewer
            currentIndex={selectedEvidencePhotoIndex}
            item={selectedEvidencePhoto.item}
            onClose={() => setSelectedEvidencePhotoKey(null)}
            onNext={() => {
              const nextIndex = (selectedEvidencePhotoIndex + 1) % evidencePhotoItems.length;
              setSelectedEvidencePhotoKey(getEvidenceKey(evidencePhotoItems[nextIndex].item));
            }}
            onPrevious={() => {
              const previousIndex = (selectedEvidencePhotoIndex - 1 + evidencePhotoItems.length) % evidencePhotoItems.length;
              setSelectedEvidencePhotoKey(getEvidenceKey(evidencePhotoItems[previousIndex].item));
            }}
            onOpenOriginal={handleEvidenceOpenFile}
            photoCount={evidencePhotoItems.length}
            previewUrl={selectedEvidencePhoto.previewUrl || ''}
          />
        ) : null}

      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
        <button
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-95"
          disabled={isWorking}
          onClick={onDelete}
          type="button"
        >
          Delete node
        </button>
        <button
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isWorking}
          onClick={() => onSave({
            attachedEvidence: draft.attachedEvidence,
            detailFields: draft.detailFields,
            fiveWhysNodeRole: draft.fiveWhysNodeRole,
            isRootCause: draft.isRootCause,
            isSuspectedCause: draft.isSuspectedCause,
            label: draft.label,
            nodeType: draft.nodeType,
            parentNodeId: draft.parentNodeId || null,
            whyChain: draft.whyChain
          })}
          type="button"
        >
          <CheckCircle2 aria-hidden="true" size={17} />
          Save node
        </button>
      </div>
    </aside>
  );
}

function RcaNodeChildrenField({
  childrenNodes,
  isFiveWhysDetails,
  nodes
}: {
  childrenNodes: RcaNode[];
  isFiveWhysDetails: boolean;
  nodes: RcaNode[];
}) {
  const summaryLabel = childrenNodes.length
    ? `${childrenNodes.length} child node${childrenNodes.length === 1 ? '' : 's'} connected`
    : 'No child nodes connected';

  return (
    <div className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">Child nodes</span>
      <details className="group rounded-xl border border-slate-200 bg-white text-sm text-slate-900 shadow-sm open:shadow-md">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 outline-none ring-cyan-500/20 transition hover:bg-slate-50 focus:border-cyan-400 focus:ring-4">
          <span className={childrenNodes.length ? 'truncate text-slate-900' : 'truncate text-slate-500'}>
            {summaryLabel}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="shrink-0 text-slate-400 transition group-open:rotate-180"
            size={16}
          />
        </summary>
        <div className="border-t border-slate-100 p-2">
          {childrenNodes.length ? (
            <div className="max-h-56 space-y-1 overflow-auto pr-1">
              {childrenNodes.map((childNode) => {
                const childNodeIndex = Math.max(0, nodes.findIndex((candidateNode) => candidateNode.id === childNode.id));
                const childTitle = childNode.label?.trim() || getRcaNodePanelTitle(childNode);
                const childTypeLabel = isFiveWhysDetails && childNode.nodeType === 'WHY'
                  ? getFiveWhysRoleLabel(getFiveWhysDisplayRole(childNode, nodes, childNodeIndex))
                  : getRcaNodePanelTitle(childNode);

                return (
                  <div
                    className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    key={childNode.id}
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-cyan-200 bg-cyan-50 text-cyan-700">
                      <CheckCircle2 aria-hidden="true" size={13} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {childTitle}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-slate-500">
                        {childTypeLabel}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              No nodes currently use this node as their parent. Connect a spline into another node or choose this node from a child&apos;s Parent node field.
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function RcaNodeDetailFieldsSection({
  fields,
  onChange,
  values
}: {
  fields: RcaNodeDetailFieldDefinition[];
  onChange: (fieldKey: string, value: string) => void;
  values: Record<string, string>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList aria-hidden="true" className="text-cyan-700" size={17} />
        <h3 className="text-sm font-semibold text-slate-950">RCA fields</h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {fields.map((field) => {
          const otherTextKey = getRcaOtherDetailFieldKey(field.key);
          const shouldShowOtherText = field.type === 'select' &&
            hasRcaOtherOption(field) &&
            values[field.key] === 'Other';

          return (
            <div className="grid gap-2" key={field.key}>
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                  <span>{field.label}</span>
                  {field.readOnly ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      System
                    </span>
                  ) : null}
                </span>
                {field.type === 'textarea' ? (
                  <textarea
                    className={`min-h-[82px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm leading-5 outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 ${
                      field.readOnly ? 'cursor-not-allowed bg-slate-50 font-semibold text-slate-600' : 'bg-white text-slate-900'
                    }`}
                    disabled={field.readOnly}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    value={values[field.key] || ''}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className={`h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-cyan-500/20 transition focus:border-cyan-400 focus:ring-4 ${
                      field.readOnly ? 'cursor-not-allowed bg-slate-50 font-semibold text-slate-600' : 'bg-white text-slate-900'
                    }`}
                    disabled={field.readOnly}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    value={values[field.key] || ''}
                  >
                    <option value="">Select...</option>
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : field.type === 'date' ? (
                  <RcaNodeDetailDatePicker
                    disabled={field.readOnly}
                    onChange={(value) => onChange(field.key, value)}
                    value={values[field.key] || ''}
                  />
                ) : field.type === 'time' ? (
                  <RcaNodeDetailTimePicker
                    disabled={field.readOnly}
                    onChange={(value) => onChange(field.key, value)}
                    value={values[field.key] || ''}
                  />
                ) : field.type === 'datetime-local' ? (
                  <RcaNodeDetailDateTimePicker
                    disabled={field.readOnly}
                    onChange={(value) => onChange(field.key, value)}
                    value={values[field.key] || ''}
                  />
                ) : (
                  <input
                    className={`h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 ${
                      field.readOnly ? 'cursor-not-allowed bg-slate-50 font-semibold text-slate-600' : 'bg-white text-slate-900'
                    }`}
                    disabled={field.readOnly}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    type={field.type}
                    value={values[field.key] || ''}
                  />
                )}
              </label>
              {shouldShowOtherText ? (
                <label className="block rounded-2xl border border-cyan-100 bg-cyan-50/50 p-2">
                  <span className="mb-1.5 block text-xs font-semibold text-cyan-800">
                    Actual {field.label}
                  </span>
                  <input
                    className="h-10 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm text-slate-900 outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4"
                    onChange={(event) => onChange(otherTextKey, event.target.value)}
                    placeholder={`Enter actual ${field.label.toLowerCase()}`}
                    value={values[otherTextKey] || ''}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RcaNodeDetailDatePicker({
  disabled,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const selectedDate = parseInputDate(value);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-left text-sm outline-none ring-cyan-500/20 transition focus:border-cyan-400 focus:ring-4 data-[state=open]:border-cyan-400 data-[state=open]:ring-4 data-[state=open]:ring-cyan-100 ${
            disabled
              ? 'cursor-not-allowed bg-slate-50 font-semibold text-slate-600'
              : 'bg-white text-slate-900 hover:border-cyan-200 hover:bg-cyan-50/30'
          }`}
          disabled={disabled}
          type="button"
        >
          <span className={selectedDate ? 'truncate' : 'truncate text-slate-400'}>
            {selectedDate ? formatDateFilterLabel(selectedDate) : 'mm/dd/yyyy'}
          </span>
          <CalendarDays aria-hidden="true" className="shrink-0 text-slate-500" size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="rca-date-picker-popover z-[130] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/18 ring-1 ring-slate-900/5"
          collisionPadding={14}
          sideOffset={8}
        >
          <DayPicker
            fixedWeeks
            mode="single"
            onSelect={(date) => {
              if (date) {
                onChange(formatInputDate(date));
              }
            }}
            selected={selectedDate || undefined}
            showOutsideDays
          />
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              onClick={() => onChange('')}
              type="button"
            >
              Clear
            </button>
            <button
              className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
              onClick={() => onChange(formatInputDate(new Date()))}
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

function RcaNodeDetailTimePicker({
  disabled,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const options = React.useMemo(() => buildTimeFilterOptions(), []);
  const isValidTime = isValidTimeInput(value);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-left text-sm outline-none ring-cyan-500/20 transition focus:border-cyan-400 focus:ring-4 data-[state=open]:border-cyan-400 data-[state=open]:ring-4 data-[state=open]:ring-cyan-100 ${
            disabled
              ? 'cursor-not-allowed bg-slate-50 font-semibold text-slate-600'
              : 'bg-white text-slate-900 hover:border-cyan-200 hover:bg-cyan-50/30'
          }`}
          disabled={disabled}
          type="button"
        >
          <span className={isValidTime ? 'truncate' : 'truncate text-slate-400'}>
            {isValidTime ? formatTimeFilterLabel(value) : '--:-- --'}
          </span>
          <Clock3 aria-hidden="true" className="shrink-0 text-slate-500" size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-[130] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/18 ring-1 ring-slate-900/5"
          collisionPadding={14}
          sideOffset={8}
        >
          <RcaNodeDetailTimeMenu
            onChange={onChange}
            options={options}
            value={isValidTime ? value : ''}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RcaNodeDetailDateTimePicker({
  disabled,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const options = React.useMemo(() => buildTimeFilterOptions(), []);
  const parsedValue = parseInputDateTime(value);
  const selectedDate = parsedValue?.date || null;
  const selectedTime = parsedValue?.time || '';

  function changeDate(date: Date | undefined) {
    if (!date) {
      return;
    }

    onChange(formatInputDateTime(date, selectedTime || formatTimeInput(new Date())));
  }

  function changeTime(time: string) {
    if (!time) {
      onChange('');
      return;
    }

    onChange(formatInputDateTime(selectedDate || new Date(), time));
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-left text-sm outline-none ring-cyan-500/20 transition focus:border-cyan-400 focus:ring-4 data-[state=open]:border-cyan-400 data-[state=open]:ring-4 data-[state=open]:ring-cyan-100 ${
            disabled
              ? 'cursor-not-allowed bg-slate-50 font-semibold text-slate-600'
              : 'bg-white text-slate-900 hover:border-cyan-200 hover:bg-cyan-50/30'
          }`}
          disabled={disabled}
          type="button"
        >
          <span className={parsedValue ? 'truncate' : 'truncate text-slate-400'}>
            {parsedValue ? formatDateTimeFilterLabel(parsedValue.date, parsedValue.time) : 'mm/dd/yyyy, --:-- --'}
          </span>
          <CalendarDays aria-hidden="true" className="shrink-0 text-slate-500" size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-[130] w-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/18 ring-1 ring-slate-900/5 max-[560px]:w-[calc(100vw-28px)]"
          collisionPadding={14}
          sideOffset={8}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_190px] gap-3 p-3 max-[560px]:grid-cols-1">
            <div>
              <DayPicker
                fixedWeeks
                mode="single"
                onSelect={changeDate}
                selected={selectedDate || undefined}
                showOutsideDays
              />
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                <button
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => onChange('')}
                  type="button"
                >
                  Clear
                </button>
                <button
                  className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
                  onClick={() => onChange(formatInputDateTime(new Date(), formatTimeInput(new Date())))}
                  type="button"
                >
                  Today
                </button>
              </div>
            </div>
            <RcaNodeDetailTimeMenu
              compact
              onChange={changeTime}
              options={options}
              value={selectedTime}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RcaNodeDetailTimeMenu({
  compact = false,
  onChange,
  options,
  value
}: {
  compact?: boolean;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div className={compact ? 'min-w-[190px] border-l border-slate-100 pl-3 max-[560px]:min-w-0 max-[560px]:border-l-0 max-[560px]:border-t max-[560px]:pl-0 max-[560px]:pt-3' : ''}>
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <p className="text-xs font-semibold text-slate-900">Time</p>
        <button
          className="rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          onClick={() => onChange('')}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="max-h-72 overflow-auto p-1.5">
        <button
          className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50"
          onClick={() => onChange(formatTimeInput(new Date()))}
          type="button"
        >
          Now
          <Clock3 aria-hidden="true" size={14} />
        </button>
        {options.map((option) => (
          <button
            className={`block w-full whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
              value === option.value
                ? 'bg-cyan-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RcaEvidenceAttachmentCard({
  item,
  onOpenFile,
  onPreview,
  onRemove,
  onRename,
  previewUrl
}: {
  item: RcaAttachedEvidence;
  onOpenFile: (item: RcaAttachedEvidence) => void;
  onPreview: (item: RcaAttachedEvidence) => void;
  onRemove: (item: RcaAttachedEvidence) => void;
  onRename: (item: RcaAttachedEvidence, fileName: string) => void;
  previewUrl: string | null;
}) {
  const isLink = isLikelyUrl(item.fileUrl);
  const [fileNameDraft, setFileNameDraft] = React.useState(item.fileName);

  React.useEffect(() => {
    setFileNameDraft(item.fileName);
  }, [item.fileName]);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/5">
      <button
        aria-label={`Remove ${item.fileName}`}
        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/70 bg-slate-950/75 text-white shadow-lg backdrop-blur transition hover:bg-red-600 active:scale-95"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item);
        }}
        type="button"
      >
        <X aria-hidden="true" size={14} />
      </button>
      {previewUrl ? (
        <button
          className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 text-left"
          onClick={() => onPreview(item)}
          type="button"
        >
          <img alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" src={previewUrl} />
          <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            View
          </span>
        </button>
      ) : (
        <button
          className="group relative grid aspect-[4/3] w-full place-items-center bg-slate-50 text-cyan-700 transition hover:bg-cyan-50"
          onClick={() => onOpenFile(item)}
          type="button"
        >
          {isLink ? <Link2 aria-hidden="true" size={24} /> : <FileLock2 aria-hidden="true" size={24} />}
          <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white opacity-95 backdrop-blur transition group-hover:bg-cyan-700">
            Open
          </span>
        </button>
      )}
      <div className="p-2.5">
        <input
          className="h-7 w-full rounded-lg border border-transparent bg-transparent px-1 text-xs font-semibold text-slate-950 outline-none transition hover:border-slate-200 hover:bg-slate-50 focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
          onBlur={() => onRename(item, fileNameDraft)}
          onChange={(event) => setFileNameDraft(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setFileNameDraft(item.fileName);
              event.currentTarget.blur();
            }
          }}
          title="Rename attachment"
          value={fileNameDraft}
        />
        <p className="mt-1 truncate text-[11px] text-slate-500">
          {item.uploadedAtIso ? formatAuditDate(item.uploadedAtIso) : 'Attached evidence'}
        </p>
        <button
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-100 active:scale-95"
          onClick={(event) => {
            event.stopPropagation();
            onOpenFile(item);
          }}
          type="button"
        >
          {isLink ? 'Open link' : 'Open file'}
          <ExternalLink aria-hidden="true" size={12} />
        </button>
      </div>
    </article>
  );
}

function RcaEvidencePhotoViewer({
  currentIndex,
  item,
  onClose,
  onNext,
  onOpenOriginal,
  onPrevious,
  photoCount,
  previewUrl
}: {
  currentIndex: number;
  item: RcaAttachedEvidence;
  onClose: () => void;
  onNext: () => void;
  onOpenOriginal: (item: RcaAttachedEvidence) => void;
  onPrevious: () => void;
  photoCount: number;
  previewUrl: string;
}) {
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [position, setPosition] = React.useState(() => ({
    x: typeof window === 'undefined' ? 80 : Math.max(16, window.innerWidth - 900),
    y: 84
  }));
  const dragStartRef = React.useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (isMaximized) {
          setIsMaximized(false);
          return;
        }

        onClose();
      }

      if (event.key === 'ArrowLeft') {
        onPrevious();
      }

      if (event.key === 'ArrowRight') {
        onNext();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized, onClose, onNext, onPrevious]);

  React.useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const dragStart = dragStartRef.current;

      if (!dragStart || isMaximized) {
        return;
      }

      const nextX = dragStart.startX + event.clientX - dragStart.pointerX;
      const nextY = dragStart.startY + event.clientY - dragStart.pointerY;
      const maxX = Math.max(16, window.innerWidth - 360);
      const maxY = Math.max(16, window.innerHeight - 220);

      setPosition({
        x: Math.min(Math.max(16, nextX), maxX),
        y: Math.min(Math.max(16, nextY), maxY)
      });
    }

    function handleMouseUp() {
      dragStartRef.current = null;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMaximized]);

  const viewerStyle = isMaximized
    ? undefined
    : {
        height: 'min(720px, calc(100svh - 112px))',
        left: position.x,
        top: position.y,
        width: 'min(860px, calc(100vw - 32px))'
      };

  const viewer = (
    <div
      className={`fixed z-[130] flex flex-col overflow-hidden border border-white/15 bg-slate-950 shadow-2xl shadow-slate-950/50 ${
        isMaximized
          ? 'inset-3 rounded-2xl'
          : 'rounded-xl'
      }`}
      role="dialog"
      aria-modal="false"
      style={viewerStyle}
    >
        <div
          className={`flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-white ${
            isMaximized ? '' : 'cursor-move'
          }`}
          onMouseDown={(event) => {
            if (isMaximized || event.button !== 0) {
              return;
            }

            dragStartRef.current = {
              pointerX: event.clientX,
              pointerY: event.clientY,
              startX: position.x,
              startY: position.y
            };
          }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Evidence photo</p>
            <h3 className="mt-1 truncate text-sm font-semibold">{item.fileName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              {currentIndex + 1} / {photoCount}
            </span>
            <button
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
              onClick={() => setIsMaximized((currentValue) => !currentValue)}
              title={isMaximized ? 'Restore viewer' : 'Maximize viewer'}
              type="button"
            >
              {isMaximized ? <Minimize2 aria-hidden="true" size={17} /> : <Maximize2 aria-hidden="true" size={17} />}
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <img alt="" className="h-full w-full object-contain" src={previewUrl} />
          {photoCount > 1 ? (
            <>
              <button
                className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/45 bg-slate-950/78 text-white shadow-[0_18px_38px_rgba(15,23,42,0.42),0_0_0_1px_rgba(15,23,42,0.2)] ring-1 ring-slate-950/20 backdrop-blur-md transition hover:bg-slate-900/90 active:scale-95"
                onClick={onPrevious}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={25} strokeWidth={2.8} />
              </button>
              <button
                className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/45 bg-slate-950/78 text-white shadow-[0_18px_38px_rgba(15,23,42,0.42),0_0_0_1px_rgba(15,23,42,0.2)] ring-1 ring-slate-950/20 backdrop-blur-md transition hover:bg-slate-900/90 active:scale-95"
                onClick={onNext}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={25} strokeWidth={2.8} />
              </button>
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
          <span className="truncate">{item.fileName}</span>
          <button
            className="shrink-0 font-semibold text-cyan-200 transition hover:text-cyan-100 active:scale-95"
            onClick={() => onOpenOriginal(item)}
            type="button"
          >
            Open original
          </button>
        </div>
    </div>
  );

  return createPortal(viewer, document.body);
}

function RcaAlignmentGuides({ guides }: { guides: RcaAlignmentGuide[] }) {
  if (!guides.length) {
    return null;
  }

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute inset-0 z-[2]">
        {guides.map((guide) => (
          <div
            className="absolute rounded-full bg-cyan-500/70 shadow-[0_0_0_1px_rgba(255,255,255,0.82),0_0_12px_rgba(14,165,233,0.4)]"
            key={guide.id}
            style={guide.orientation === 'vertical'
              ? {
                  height: Math.max(1, guide.end - guide.start),
                  left: guide.value,
                  top: guide.start,
                  width: 2
                }
              : {
                  height: 2,
                  left: guide.start,
                  top: guide.value,
                  width: Math.max(1, guide.end - guide.start)
                }}
          />
        ))}
      </div>
    </ViewportPortal>
  );
}

function RcaCanvasGuide({
  methodology
}: {
  methodology: RcaMethodology;
}) {
  if (methodology === 'ISHIKAWA' || methodology === '5_WHYS') {
    return null;
  }

  if (methodology === 'FAULT_TREE') {
    return (
      <div className="pointer-events-none absolute inset-0 z-[1]">
        <div className="absolute left-1/2 top-36 h-[calc(100%-260px)] w-px -translate-x-1/2 bg-slate-400/25" />
        <div className="absolute left-1/2 top-28 -translate-x-1/2 rounded-full border border-slate-300/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm backdrop-blur-md">
          Top event
        </div>
        <div className="absolute left-[24%] right-[24%] top-72 h-px bg-slate-400/25" />
      </div>
    );
  }

  return null;
}

function buildFlowNodes(
  nodes: RcaNode[],
  selectedNodeId: string | null,
  selectedNodeIds: Set<string>,
  methodology: RcaMethodology,
  onInspect: (nodeId: string) => void,
  nodeDetails: Record<string, ReferenceRcaNodeDetail> = {},
  isReferenceProject = false,
  incidentId: string | null = null,
  sessionId: string | null = null,
  isRealtimeReady = false,
  activities: RcaNodeActivity[] = [],
  measuredNodeSizes: Map<string, { height: number; width: number }> = new Map(),
  onLabelCommit: (nodeId: string, input: RcaNodeInput) => Promise<RcaNode> = async () => {
    throw new Error('RCA node editing is not available.');
  }
): RcaFlowNode[] {
  const flowNodes: RcaFlowNode[] = nodes.map((node, index) => {
    const detail = nodeDetails[node.id];
    const estimatedNodeSize = getRcaNodeSize(node, detail);
    const nodeSize = node.nodeType === 'STICKY_NOTE'
      ? estimatedNodeSize
      : measuredNodeSizes.get(node.id) || estimatedNodeSize;
    const isSelected = node.id === selectedNodeId || selectedNodeIds.has(node.id);

    return {
      data: {
        activities: activities.filter((activity) => activity.nodeId === node.id),
        detail,
        incidentId,
        isReferenceProject,
        isRealtimeReady,
        methodology,
        node,
        nodes,
        onInspect,
        onLabelCommit: (nodeId: string, label: string) => onLabelCommit(nodeId, { label }),
        selected: isSelected,
        sessionId
      },
      id: node.id,
      measured: {
        height: nodeSize.height,
        width: nodeSize.width
      },
      position: getNodePosition(node, nodes, index, methodology),
      selected: isSelected,
      sourcePosition: Position.Right,
      style: {
        height: node.nodeType === 'STICKY_NOTE' ? estimatedNodeSize.height : undefined,
        minHeight: estimatedNodeSize.height,
        width: estimatedNodeSize.width
      },
      targetPosition: Position.Left,
      type: 'rcaNode'
    };
  });

  const spineLayout = getFishboneSpineNodeLayout(nodes, methodology, nodeDetails);

  if (spineLayout) {
    flowNodes.push({
      data: {
        faultGateId: spineLayout.faultGateId,
        selected: selectedNodeIds.has(spineLayout.id)
      },
      draggable: !isReferenceProject,
      id: spineLayout.id,
      position: spineLayout.position,
      selectable: true,
      selected: selectedNodeIds.has(spineLayout.id),
      style: {
        height: RCA_FISHBONE_SPINE_CONTROL_HEIGHT,
        width: spineLayout.width
      },
      type: 'rcaFishboneSpine'
    });
  }

  return flowNodes;
}

function buildFlowEdges(
  nodes: RcaNode[],
  methodology: RcaMethodology,
  selectedEdgeIds: Set<string> = new Set()
): Edge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, RcaNode[]>();

  nodes.forEach((node) => {
    if (!node.parentNodeId || !nodeIds.has(node.parentNodeId)) {
      return;
    }

    const siblings = childrenByParent.get(node.parentNodeId) || [];
    siblings.push(node);
    childrenByParent.set(node.parentNodeId, siblings);
  });

  childrenByParent.forEach((siblings) => {
    siblings.sort((leftNode, rightNode) => {
      const leftPosition = getNodePosition(leftNode, nodes, nodes.indexOf(leftNode), methodology);
      const rightPosition = getNodePosition(rightNode, nodes, nodes.indexOf(rightNode), methodology);

      return leftPosition.y - rightPosition.y || leftPosition.x - rightPosition.x;
    });
  });

  const explicitEdges = nodes
    .filter((node) => node.parentNodeId && nodeIds.has(node.parentNodeId))
    .map((node) => {
      const parentNodeId = node.parentNodeId as string;
      const siblings = childrenByParent.get(parentNodeId) || [node];
      const siblingIndex = Math.max(0, siblings.findIndex((sibling) => sibling.id === node.id));

      if (node.nodeType === 'STICKY_NOTE') {
        const nodeIndex = nodes.findIndex((candidateNode) => candidateNode.id === node.id);
        const nodePosition = getNodePosition(node, nodes, Math.max(0, nodeIndex), methodology);
        const nodeSize = getRcaNodeSize(node);
        const targetNode = nodesById.get(parentNodeId);

        return buildEdge(
          node.id,
          parentNodeId,
          methodology,
          node,
          targetNode,
          siblingIndex,
          siblings.length,
          { x: nodePosition.x + nodeSize.width, y: nodePosition.y + nodeSize.height / 2 },
          {
            kind: 'sticky-annotation',
            selected: selectedEdgeIds.has(`${node.id}-${parentNodeId}`),
            sourceHandle: node.connectionHandles?.sourceHandle || RCA_SOURCE_RIGHT_HANDLE,
            targetHandle: node.connectionHandles?.targetHandle || getStickyNoteAnnotationTargetHandle(node, targetNode, nodes, methodology)
          }
        );
      }

      if (methodology === '5_WHYS') {
        return buildEdge(parentNodeId, node.id, methodology, nodesById.get(parentNodeId), node, 0, 1, undefined, {
          selected: selectedEdgeIds.has(`${parentNodeId}-${node.id}`),
          sourceHandle: node.connectionHandles?.sourceHandle || RCA_SOURCE_RIGHT_HANDLE,
          targetHandle: node.connectionHandles?.targetHandle || RCA_TARGET_LEFT_HANDLE
        });
      }

      if (isMainViewForwardFlowEdge(node, nodesById.get(parentNodeId))) {
        return buildEdge(parentNodeId, node.id, methodology, nodesById.get(parentNodeId), node, 0, 1, undefined, {
          selected: selectedEdgeIds.has(`${parentNodeId}-${node.id}`),
          sourceHandle: node.connectionHandles?.sourceHandle || RCA_SOURCE_RIGHT_HANDLE,
          targetHandle: node.connectionHandles?.targetHandle || RCA_TARGET_LEFT_HANDLE
        });
      }

      return buildEdge(node.id, parentNodeId, methodology, node, nodesById.get(parentNodeId), siblingIndex, siblings.length, undefined, {
        selected: selectedEdgeIds.has(`${node.id}-${parentNodeId}`),
        sourceHandle: node.connectionHandles?.sourceHandle || RCA_SOURCE_RIGHT_HANDLE,
        targetHandle: node.connectionHandles?.targetHandle || getTargetSideHandleId(node, nodesById.get(parentNodeId), nodes, methodology)
      });
    });

  return explicitEdges;
}

function getFishboneSpineNodeId(faultGateId: string): string {
  return `${RCA_FISHBONE_SPINE_NODE_ID_PREFIX}${faultGateId}`;
}

function isFishboneSpineFlowNodeId(nodeId: string): boolean {
  return nodeId.startsWith(RCA_FISHBONE_SPINE_NODE_ID_PREFIX);
}

function getFishboneSpineFaultGateId(nodeId: string): string {
  return nodeId.replace(RCA_FISHBONE_SPINE_NODE_ID_PREFIX, '');
}

function getSelectedRcaSplineEdgeIdsForNodeSelection(
  nodes: RcaNode[],
  methodology: RcaMethodology,
  selectedNodeIds: Set<string>
): Set<string> {
  const selectedRealNodeIds = new Set(selectedNodeIds);

  selectedNodeIds.forEach((nodeId) => {
    if (isFishboneSpineFlowNodeId(nodeId)) {
      selectedRealNodeIds.add(getFishboneSpineFaultGateId(nodeId));
    }
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const selectedEdgeIds = new Set<string>();

  nodes.forEach((node) => {
    if (!node.parentNodeId || !nodeIds.has(node.parentNodeId)) {
      return;
    }

    if (!selectedRealNodeIds.has(node.id) || !selectedRealNodeIds.has(node.parentNodeId)) {
      return;
    }

    if (methodology === '5_WHYS' || isMainViewForwardFlowEdge(node, nodes.find((candidateNode) => candidateNode.id === node.parentNodeId))) {
      selectedEdgeIds.add(`${node.parentNodeId}-${node.id}`);
      return;
    }

    selectedEdgeIds.add(`${node.id}-${node.parentNodeId}`);
  });

  return selectedEdgeIds;
}

function getSelectedRcaSplineChildNodeIds(
  nodes: RcaNode[],
  methodology: RcaMethodology,
  selectedEdgeIds: Set<string>
): string[] {
  if (!selectedEdgeIds.size) {
    return [];
  }

  const nodeIds = new Set(nodes.map((node) => node.id));

  return nodes
    .filter((node) => node.parentNodeId && nodeIds.has(node.parentNodeId))
    .filter((node) => selectedEdgeIds.has(getRcaSplineEdgeIdForNode(node, methodology, nodes)))
    .map((node) => node.id);
}

function getRcaSplineEdgeIdForNode(node: RcaNode, methodology: RcaMethodology, nodes: RcaNode[]): string {
  if (!node.parentNodeId) {
    return node.id;
  }

  const parentNode = nodes.find((candidateNode) => candidateNode.id === node.parentNodeId);

  return methodology === '5_WHYS' || isMainViewForwardFlowEdge(node, parentNode)
    ? `${node.parentNodeId}-${node.id}`
    : `${node.id}-${node.parentNodeId}`;
}

function getRcaSplineAuditDescriptions(
  nodes: RcaNode[],
  methodology: RcaMethodology,
  childNodeIds: string[]
): string[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return childNodeIds
    .map((childNodeId) => {
      const childNode = nodeById.get(childNodeId);
      const parentNode = childNode?.parentNodeId ? nodeById.get(childNode.parentNodeId) : null;

      if (!childNode || !parentNode) {
        return '';
      }

      const isForwardFlowEdge = methodology === '5_WHYS' || isMainViewForwardFlowEdge(childNode, parentNode);
      const sourceNode = isForwardFlowEdge ? parentNode : childNode;
      const targetNode = isForwardFlowEdge ? childNode : parentNode;

      return `${getRcaNodeAuditDescriptor(sourceNode)} output to ${getRcaNodeAuditDescriptor(targetNode)} input`;
    })
    .filter(Boolean);
}

function getRcaNodeAuditDescriptor(node: RcaNode): string {
  const role = node.nodeType === 'WHY' ? getFiveWhysNodeRole(node) : null;
  const nodeType = role ? getFiveWhysRoleLabel(role) : formatNodeType(node.nodeType);
  const primaryText = getRcaNodeAuditPrimaryText(node);

  return `${nodeType} node${primaryText ? ` (${primaryText})` : ''}`;
}

function getRcaNodeAuditPrimaryText(node: RcaNode): string {
  const label = node.label.trim();

  if (label) {
    return truncateRcaAuditText(label, 160);
  }

  const fields = node.detailFields || {};
  const role = node.nodeType === 'WHY' ? getFiveWhysNodeRole(node) : null;
  const preferredKeys = role === 'INCIDENT_DETAILS'
    ? ['whereDidItHappen', 'whenDidItHappen', 'whoWasInvolved', 'detailedDescription', 'whatHappened']
    : role === 'INCIDENT'
      ? ['incidentTitle', 'lineMachineProcess', 'areaLocation', 'dateOfIncident', 'incidentDescription']
      : role === 'PROBLEM'
        ? ['problemStatement', 'problemLocation', 'knownFacts']
        : [];
  const preferredValues = preferredKeys
    .map((key) => (fields[key] || '').trim())
    .filter(Boolean);

  if (preferredValues.length) {
    return truncateRcaAuditText(preferredValues.slice(0, 3).join(', '), 160);
  }

  const fallbackValue = Object.values(fields).find((value) => value.trim());

  return fallbackValue ? truncateRcaAuditText(fallbackValue, 160) : '';
}

function truncateRcaAuditText(value: string, maxLength: number): string {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();

  return normalizedValue.length > maxLength
    ? `${normalizedValue.slice(0, Math.max(0, maxLength - 1)).trim()}...`
    : normalizedValue;
}

function getFishboneSpineNodeLayout(
  nodes: RcaNode[],
  methodology: RcaMethodology,
  nodeDetails: Record<string, ReferenceRcaNodeDetail> = {}
): { faultGateId: string; id: string; position: { x: number; y: number }; width: number } | null {
  if (methodology !== 'ISHIKAWA') {
    return null;
  }

  const faultGate = getFishboneFaultGateNode(nodes);
  const categoryNodes = getOrderedFishboneCategoryNodes(nodes);

  if (!faultGate || !categoryNodes.length) {
    return null;
  }

  const faultGatePosition = getNodePosition(faultGate, nodes, Math.max(0, nodes.indexOf(faultGate)), methodology);
  const faultGateSize = getRcaNodeSize(faultGate, nodeDetails[faultGate.id]);
  const spineY = faultGatePosition.y + faultGateSize.height / 2;
  const categoryCenters = categoryNodes.map((categoryNode) => {
    const categoryPosition = getNodePosition(categoryNode, nodes, Math.max(0, nodes.indexOf(categoryNode)), methodology);
    const categorySize = getRcaNodeSize(categoryNode, nodeDetails[categoryNode.id]);

    return categoryPosition.x + categorySize.width / 2;
  });
  const startX = Math.min(...categoryCenters);
  const endX = faultGatePosition.x;

  return {
    faultGateId: faultGate.id,
    id: getFishboneSpineNodeId(faultGate.id),
    position: {
      x: Math.round(startX),
      y: Math.round(spineY - RCA_FISHBONE_SPINE_CONTROL_HEIGHT / 2)
    },
    width: Math.max(120, Math.round(endX - startX))
  };
}

function buildEdge(
  source: string,
  target: string,
  methodology: RcaMethodology,
  sourceNode?: RcaNode,
  targetNode?: RcaNode,
  siblingIndex = 0,
  siblingCount = 1,
  sourceAnchor?: { x: number; y: number },
  options: {
    kind?: RcaSplineEdgeData['kind'];
    selected?: boolean;
    sourceHandle?: string;
    targetHandle?: string;
  } = {}
): Edge {
  const isStickyAnnotationEdge = options.kind === 'sticky-annotation';
  const isRcaTreeEdge = methodology !== '5_WHYS';
  const isCategorySpineEdge = methodology === 'ISHIKAWA' &&
    sourceNode?.nodeType === 'ISHIKAWA_CATEGORY' &&
    targetNode?.nodeType === 'FAULT_GATE';
  const isMainViewForwardEdge = methodology === 'ISHIKAWA' &&
    isMainViewForwardFlowEdge(targetNode, sourceNode);
  const categorySpineY = isCategorySpineEdge && targetNode
    ? getNodePosition(targetNode, [targetNode], 0, methodology).y + getRcaNodeSize(targetNode).height / 2
    : RCA_FISHBONE_SPINE_Y;
  const isReconnectableRcaSpline = Boolean(
    !isCategorySpineEdge &&
    sourceNode &&
    targetNode &&
    (
      isStickyAnnotationEdge
        ? sourceNode.nodeType === 'STICKY_NOTE'
      : methodology === '5_WHYS'
        ? sourceNode.nodeType === 'WHY' && targetNode.nodeType === 'WHY'
        : isMainViewForwardEdge || isRcaConnectableChildNode(sourceNode)
    )
  );
  const strokeColor = isStickyAnnotationEdge ? '#f59e0b' : isRcaTreeEdge ? '#0284c7' : '#64748b';
  const defaultWeight = isStickyAnnotationEdge ? 2 : isRcaTreeEdge ? 2.4 : 2;
  const edgeOwnerNode = isStickyAnnotationEdge
    ? sourceNode
    : methodology === '5_WHYS' || isMainViewForwardEdge
      ? targetNode
      : sourceNode;
  const splineStyle = getResolvedRcaSplineStyle(edgeOwnerNode, strokeColor, defaultWeight);

  return {
    data: {
      ...(isCategorySpineEdge ? { kind: 'category-spine' as const, spineY: categorySpineY } : {}),
      ...(isStickyAnnotationEdge ? { kind: 'sticky-annotation' as const } : {}),
      ...(edgeOwnerNode ? { ownerNodeId: edgeOwnerNode.id } : {}),
      ...(sourceAnchor ? { sourceAnchor } : {}),
      splineStyle
    } satisfies RcaSplineEdgeData,
    deletable: false,
    id: `${source}-${target}`,
    interactionWidth: isReconnectableRcaSpline ? 32 : 22,
    reconnectable: isReconnectableRcaSpline,
    selectable: isReconnectableRcaSpline || isCategorySpineEdge,
    selected: Boolean(options.selected),
    sourceHandle: isCategorySpineEdge ? getCategorySpineSourceHandle(sourceNode, categorySpineY) : options.sourceHandle || RCA_SOURCE_RIGHT_HANDLE,
    source,
    style: {
      opacity: 0.92,
      stroke: splineStyle.color,
      strokeDasharray: getRcaSplineDashArray(splineStyle.lineType, splineStyle.weight),
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: splineStyle.weight,
      transition: 'opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease'
    },
    targetHandle: options.targetHandle || (isCategorySpineEdge
      ? RCA_TARGET_LEFT_HANDLE
      : RCA_TARGET_LEFT_HANDLE),
    target,
    type: 'rcaSpline'
  };
}

function getCategorySpineSourceHandle(sourceNode: RcaNode | undefined, spineY = RCA_FISHBONE_SPINE_Y): string {
  return RCA_SOURCE_BOTTOM_HANDLE;
}

function getStickyNoteAnnotationTargetHandle(
  stickyNode: RcaNode,
  targetNode: RcaNode | undefined,
  nodes: RcaNode[],
  methodology: RcaMethodology
): string {
  if (!targetNode) {
    return RCA_TARGET_LEFT_HANDLE;
  }

  const stickyIndex = Math.max(0, nodes.findIndex((candidateNode) => candidateNode.id === stickyNode.id));
  const targetIndex = Math.max(0, nodes.findIndex((candidateNode) => candidateNode.id === targetNode.id));
  const stickyPosition = getNodePosition(stickyNode, nodes, stickyIndex, methodology);
  const targetPosition = getNodePosition(targetNode, nodes, targetIndex, methodology);
  const stickySize = getRcaNodeSize(stickyNode);
  const targetSize = getRcaNodeSize(targetNode);
  const stickyCenter = {
    x: stickyPosition.x + stickySize.width / 2,
    y: stickyPosition.y + stickySize.height / 2
  };
  const targetCenter = {
    x: targetPosition.x + targetSize.width / 2,
    y: targetPosition.y + targetSize.height / 2
  };
  const deltaX = stickyCenter.x - targetCenter.x;
  const deltaY = stickyCenter.y - targetCenter.y;

  return Math.abs(deltaY) > Math.abs(deltaX) && stickyCenter.y < targetCenter.y
    ? RCA_TARGET_TOP_HANDLE
    : RCA_TARGET_LEFT_HANDLE;
}

function getTargetSideHandleId(
  sourceNode: RcaNode | undefined,
  targetNode: RcaNode | undefined,
  nodes: RcaNode[],
  methodology: RcaMethodology
): string {
  if (!sourceNode || !targetNode) {
    return RCA_TARGET_LEFT_HANDLE;
  }

  const sourceIndex = Math.max(0, nodes.findIndex((candidateNode) => candidateNode.id === sourceNode.id));
  const targetIndex = Math.max(0, nodes.findIndex((candidateNode) => candidateNode.id === targetNode.id));
  const sourcePosition = getNodePosition(sourceNode, nodes, sourceIndex, methodology);
  const targetPosition = getNodePosition(targetNode, nodes, targetIndex, methodology);
  const sourceSize = getRcaNodeSize(sourceNode);
  const targetSize = getRcaNodeSize(targetNode);
  const sourceCenter = {
    x: sourcePosition.x + sourceSize.width / 2,
    y: sourcePosition.y + sourceSize.height / 2
  };
  const targetCenter = {
    x: targetPosition.x + targetSize.width / 2,
    y: targetPosition.y + targetSize.height / 2
  };

  return Math.abs(sourceCenter.y - targetCenter.y) > Math.abs(sourceCenter.x - targetCenter.x) &&
    sourceCenter.y < targetCenter.y
    ? RCA_TARGET_TOP_HANDLE
    : RCA_TARGET_LEFT_HANDLE;
}

function getRcaSplineOwnerNodeId(edge: Pick<Edge, 'data' | 'source' | 'target'>, methodology: RcaMethodology): string {
  const edgeData = edge.data as RcaSplineEdgeData | undefined;

  if (typeof edgeData?.ownerNodeId === 'string' && edgeData.ownerNodeId) {
    return edgeData.ownerNodeId;
  }

  return methodology === '5_WHYS' ? edge.target : edge.source;
}

function getResolvedRcaSplineStyle(
  node: RcaNode | null | undefined,
  defaultColor = RCA_DEFAULT_SPLINE_STYLE.color,
  defaultWeight = RCA_DEFAULT_SPLINE_STYLE.weight
): RcaResolvedSplineStyle {
  const edgeColor = node?.edgeStyle?.color;

  return {
    arrowHead: getNormalizedRcaSplineArrowHead(node?.edgeStyle?.arrowHead),
    color: isValidHexColor(edgeColor) ? edgeColor : defaultColor,
    lineType: getNormalizedRcaSplineLineType(node?.edgeStyle?.lineType),
    weight: clampRcaSplineWeight(node?.edgeStyle?.weight ?? defaultWeight)
  };
}

function getNormalizedRcaSplineLineType(lineType: RcaSplineLineType | null | undefined): RcaSplineLineType {
  return RCA_SPLINE_LINE_TYPE_OPTIONS.some((option) => option.value === lineType) ? lineType as RcaSplineLineType : 'CONTINUOUS';
}

function getNormalizedRcaSplineArrowHead(arrowHead: RcaSplineArrowHead | null | undefined): RcaSplineArrowHead {
  return RCA_SPLINE_ARROW_HEAD_OPTIONS.some((option) => option.value === arrowHead) ? arrowHead as RcaSplineArrowHead : 'CLOSED_FILLED';
}

function clampRcaSplineWeight(weight: number): number {
  const boundedWeight = Math.max(RCA_SPLINE_WEIGHT_OPTIONS[0], Math.min(RCA_SPLINE_WEIGHT_OPTIONS[RCA_SPLINE_WEIGHT_OPTIONS.length - 1], weight));

  return RCA_SPLINE_WEIGHT_OPTIONS.reduce((closestWeight, candidateWeight) => (
    Math.abs(candidateWeight - boundedWeight) < Math.abs(closestWeight - boundedWeight)
      ? candidateWeight
      : closestWeight
  ), RCA_SPLINE_WEIGHT_OPTIONS[0]);
}

function getRcaSplineDashArray(lineType: RcaSplineLineType, weight: number): string | undefined {
  if (lineType === 'DASHED') {
    return `${Math.max(7, weight * 4)} ${Math.max(5, weight * 2.5)}`;
  }

  if (lineType === 'DOTTED') {
    return `0 ${Math.max(4, weight * 2.6)}`;
  }

  return undefined;
}

function getRcaSplineMarkerId(edgeId: string, splineStyle: RcaResolvedSplineStyle): string {
  return [
    'rca-spline-marker',
    edgeId,
    splineStyle.arrowHead,
    splineStyle.color.replace('#', ''),
    String(splineStyle.weight).replace('.', '-')
  ].join('-').replace(/[^A-Za-z0-9_-]/g, '-');
}

function getRcaSplineArrowBasePoint(targetX: number, targetY: number, targetPosition: Position) {
  const arrowDepth = RCA_SPLINE_ARROW_TIP_X - RCA_SPLINE_ARROW_BASE_X;

  switch (targetPosition) {
    case Position.Right:
      return { x: targetX + arrowDepth, y: targetY };
    case Position.Top:
      return { x: targetX, y: targetY - arrowDepth };
    case Position.Bottom:
      return { x: targetX, y: targetY + arrowDepth };
    case Position.Left:
    default:
      return { x: targetX - arrowDepth, y: targetY };
  }
}

function getRcaSplineArrowApproachPoint(basePoint: { x: number; y: number }, targetPosition: Position) {
  const approachLength = RCA_SPLINE_ARROW_MARKER_SIZE * 2;

  switch (targetPosition) {
    case Position.Right:
      return { x: basePoint.x + approachLength, y: basePoint.y };
    case Position.Top:
      return { x: basePoint.x, y: basePoint.y - approachLength };
    case Position.Bottom:
      return { x: basePoint.x, y: basePoint.y + approachLength };
    case Position.Left:
    default:
      return { x: basePoint.x - approachLength, y: basePoint.y };
  }
}

function isValidHexColor(color: string | null | undefined): color is string {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

function getRcaCanvasConnectionChange(
  connection: Edge | Connection,
  nodes: RcaNode[],
  methodology: RcaMethodology
): RcaCanvasConnectionChange | null {
  if (
    (methodology !== 'ISHIKAWA' && methodology !== '5_WHYS') ||
    !connection.source ||
    !connection.target ||
    connection.source === connection.target ||
    !isRcaSourceHandleId(connection.sourceHandle) ||
    !isRcaTargetHandleId(connection.targetHandle)
  ) {
    return null;
  }

  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);

  if (
    !sourceNode ||
    !targetNode
  ) {
    return null;
  }

  if (sourceNode.nodeType === 'STICKY_NOTE') {
    if (
      !isStickyNoteConnectableTargetNode(targetNode) ||
      wouldCreateRcaParentCycle(sourceNode.id, targetNode.id, nodes)
    ) {
      return null;
    }

    return {
      childNodeId: sourceNode.id,
      connectionHandles: {
        sourceHandle: getNormalizedRcaSourceHandleId(connection.sourceHandle),
        targetHandle: getNormalizedRcaTargetHandleId(connection.targetHandle)
      },
      nodeType: 'STICKY_NOTE',
      parentNodeId: targetNode.id
    };
  }

  if (methodology === '5_WHYS') {
    if (
      sourceNode.nodeType !== 'WHY' ||
      targetNode.nodeType !== 'WHY' ||
      wouldCreateRcaParentCycle(targetNode.id, sourceNode.id, nodes)
    ) {
      return null;
    }

    return {
      childNodeId: targetNode.id,
      connectionHandles: {
        sourceHandle: getNormalizedRcaSourceHandleId(connection.sourceHandle),
        targetHandle: getNormalizedRcaTargetHandleId(connection.targetHandle)
      },
      nodeType: 'WHY',
      parentNodeId: sourceNode.id
    };
  }

  if (sourceNode.nodeType === 'FAULT_GATE') {
    if (
      !isCapaDestinationNode(targetNode) ||
      wouldCreateRcaParentCycle(sourceNode.id, targetNode.id, nodes)
    ) {
      return null;
    }

    return {
      childNodeId: sourceNode.id,
      connectionHandles: {
        sourceHandle: getNormalizedRcaSourceHandleId(connection.sourceHandle),
        targetHandle: getNormalizedRcaTargetHandleId(connection.targetHandle)
      },
      nodeType: 'FAULT_GATE',
      parentNodeId: targetNode.id
    };
  }

  if (targetNode.nodeType === 'FAULT_GATE') {
    return null;
  }

  if (isEvidenceRoleNode(targetNode)) {
    return null;
  }

  if (isEvidenceRoleNode(sourceNode)) {
    if (
      !isRcaConnectableParentNode(targetNode) ||
      wouldCreateRcaParentCycle(sourceNode.id, targetNode.id, nodes)
    ) {
      return null;
    }

    return {
      childNodeId: sourceNode.id,
      connectionHandles: {
        sourceHandle: getNormalizedRcaSourceHandleId(connection.sourceHandle),
        targetHandle: getNormalizedRcaTargetHandleId(connection.targetHandle)
      },
      nodeType: sourceNode.nodeType,
      parentNodeId: targetNode.id
    };
  }

  if (isMainViewForwardFlowParentNode(sourceNode) && isMainViewForwardFlowChildNode(targetNode)) {
    if (wouldCreateRcaParentCycle(targetNode.id, sourceNode.id, nodes)) {
      return null;
    }

    return {
      childNodeId: targetNode.id,
      connectionHandles: {
        sourceHandle: getNormalizedRcaSourceHandleId(connection.sourceHandle),
        targetHandle: getNormalizedRcaTargetHandleId(connection.targetHandle)
      },
      nodeType: targetNode.nodeType,
      parentNodeId: sourceNode.id
    };
  }

  if (wouldCreateRcaParentCycle(sourceNode.id, targetNode.id, nodes)) {
    return null;
  }

  if (!isRcaConnectableChildNode(sourceNode) || !isRcaConnectableParentNode(targetNode)) {
    return null;
  }

  return {
    childNodeId: sourceNode.id,
    connectionHandles: {
      sourceHandle: getNormalizedRcaSourceHandleId(connection.sourceHandle),
      targetHandle: getNormalizedRcaTargetHandleId(connection.targetHandle)
    },
    nodeType: isFishboneCauseNode(sourceNode) && targetNode.nodeType === 'ISHIKAWA_CATEGORY'
      ? 'CAUSE'
      : sourceNode.nodeType,
    parentNodeId: targetNode.id
  };
}

function isRcaSourceHandleId(handleId: string | null | undefined): boolean {
  return !handleId || handleId === RCA_SOURCE_RIGHT_HANDLE || handleId === RCA_SOURCE_BOTTOM_HANDLE;
}

function isRcaTargetHandleId(handleId: string | null | undefined): boolean {
  return !handleId || handleId === RCA_TARGET_LEFT_HANDLE || handleId === RCA_TARGET_TOP_HANDLE;
}

function getNormalizedRcaSourceHandleId(handleId: string | null | undefined): string {
  return handleId === RCA_SOURCE_BOTTOM_HANDLE ? RCA_SOURCE_BOTTOM_HANDLE : RCA_SOURCE_RIGHT_HANDLE;
}

function getNormalizedRcaTargetHandleId(handleId: string | null | undefined): string {
  return handleId === RCA_TARGET_TOP_HANDLE ? RCA_TARGET_TOP_HANDLE : RCA_TARGET_LEFT_HANDLE;
}

function getRcaConnectionHandleSignature(connectionHandles: RcaNode['connectionHandles']): string {
  const normalizedHandles = getNormalizedRcaNodeConnectionHandles(connectionHandles);

  return `${normalizedHandles.sourceHandle || ''}:${normalizedHandles.targetHandle || ''}`;
}

function isRcaConnectableChildNode(node: RcaNode): boolean {
  return node.status !== 'DELETED' &&
    node.nodeType !== 'FAULT_GATE' &&
    node.nodeType !== 'ISHIKAWA_CATEGORY';
}

function isMainViewForwardFlowParentNode(node: RcaNode | undefined): boolean {
  if (!node || node.status === 'DELETED' || node.nodeType !== 'WHY') {
    return false;
  }

  const role = getFiveWhysNodeRole(node);

  return role === 'PROBLEM' || role === 'ROOT_CAUSE';
}

function isMainViewForwardFlowChildNode(node: RcaNode | undefined): boolean {
  if (!node || node.status === 'DELETED' || node.nodeType !== 'WHY') {
    return false;
  }

  const role = getFiveWhysNodeRole(node);

  return role !== 'PROBLEM' && role !== 'INCIDENT' && role !== 'EVIDENCE';
}

function isMainViewForwardFlowEdge(childNode: RcaNode | undefined, parentNode: RcaNode | undefined): boolean {
  return isMainViewForwardFlowParentNode(parentNode) && isMainViewForwardFlowChildNode(childNode);
}

function isEvidenceRoleNode(node: RcaNode | undefined): boolean {
  return Boolean(node && node.status !== 'DELETED' && node.nodeType === 'WHY' && getFiveWhysNodeRole(node) === 'EVIDENCE');
}

function isCapaDestinationNode(node: RcaNode): boolean {
  if (node.status === 'DELETED') {
    return false;
  }

  if (node.nodeType === 'WHY' && getFiveWhysNodeRole(node) === 'CAPA') {
    return true;
  }

  return /^capa\b/i.test((node.label || '').trim());
}

function isRcaConnectableParentNode(node: RcaNode): boolean {
  return node.status !== 'DELETED';
}

function isStickyNoteConnectableTargetNode(node: RcaNode): boolean {
  return node.status !== 'DELETED';
}

function wouldCreateRcaParentCycle(childNodeId: string, parentNodeId: string | null, nodes: RcaNode[]): boolean {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const visitedNodeIds = new Set<string>();
  let currentParentNodeId = parentNodeId;

  while (currentParentNodeId) {
    if (currentParentNodeId === childNodeId || visitedNodeIds.has(currentParentNodeId)) {
      return true;
    }

    visitedNodeIds.add(currentParentNodeId);
    currentParentNodeId = nodeById.get(currentParentNodeId)?.parentNodeId || null;
  }

  return false;
}

function RcaSplineEdge({
  data,
  id,
  interactionWidth,
  selected,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY
}: EdgeProps) {
  const edgeData = data as RcaSplineEdgeData | undefined;
  const splineStyle = edgeData?.splineStyle || RCA_DEFAULT_SPLINE_STYLE;
  const markerId = getRcaSplineMarkerId(id, splineStyle);
  const markerEnd = `url(#${markerId})`;
  const resolvedSourceX = edgeData?.sourceAnchor?.x ?? sourceX;
  const resolvedSourceY = edgeData?.sourceAnchor?.y ?? sourceY;
  const arrowBasePoint = getRcaSplineArrowBasePoint(targetX, targetY, targetPosition);
  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke: splineStyle.color,
    strokeDasharray: getRcaSplineDashArray(splineStyle.lineType, splineStyle.weight),
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: splineStyle.weight
  };
  const selectedEdgeHaloStyle: React.CSSProperties = {
    fill: 'none',
    opacity: selected ? 0.9 : 0,
    pointerEvents: 'none',
    stroke: '#0f172a',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: Math.max(8, splineStyle.weight + 6)
  };

  if (edgeData?.kind === 'category-spine' && typeof edgeData.spineY === 'number') {
    const spineY = edgeData.spineY;
    const arrowApproachPoint = getRcaSplineArrowApproachPoint(arrowBasePoint, targetPosition);
    const branchDirection = spineY >= resolvedSourceY ? 1 : -1;
    const branchControlOffset = Math.max(36, Math.abs(spineY - resolvedSourceY) * 0.52);
    const spineControlOffset = Math.max(120, Math.min(280, (arrowApproachPoint.x - resolvedSourceX) * 0.28));
    const edgePath = [
      `M ${resolvedSourceX},${resolvedSourceY}`,
      `C ${resolvedSourceX},${resolvedSourceY + branchDirection * branchControlOffset} ${resolvedSourceX},${spineY - branchDirection * 28} ${resolvedSourceX},${spineY}`,
      `C ${resolvedSourceX + spineControlOffset},${spineY} ${arrowApproachPoint.x - spineControlOffset},${spineY} ${arrowApproachPoint.x},${spineY}`,
      `L ${arrowApproachPoint.x},${arrowApproachPoint.y}`,
      `L ${arrowBasePoint.x},${arrowBasePoint.y}`
    ].join(' ');

    return (
      <>
        <RcaSplineArrowMarker id={markerId} splineStyle={splineStyle} />
        {selected ? (
          <BaseEdge
            id={`${id}-selection-halo`}
            interactionWidth={0}
            path={edgePath}
            style={selectedEdgeHaloStyle}
          />
        ) : null}
        <BaseEdge
          id={id}
          interactionWidth={interactionWidth ?? 22}
          markerEnd={markerEnd}
          path={edgePath}
          style={edgeStyle}
        />
      </>
    );
  }

  if (edgeData?.kind === 'sticky-annotation') {
    const arrowApproachPoint = getRcaSplineArrowApproachPoint(arrowBasePoint, targetPosition);
    const distanceX = Math.abs(arrowApproachPoint.x - resolvedSourceX);
    const distanceY = Math.abs(arrowApproachPoint.y - resolvedSourceY);
    const controlOffset = Math.max(48, Math.min(180, Math.max(distanceX, distanceY) * 0.32));
    const sourceDirection = resolvedSourceX <= arrowApproachPoint.x ? 1 : -1;
    const targetDirection = targetPosition === Position.Right ? 1 : targetPosition === Position.Left ? -1 : 0;
    const sourceControl = {
      x: resolvedSourceX + sourceDirection * controlOffset,
      y: resolvedSourceY
    };
    const targetControl = targetPosition === Position.Top || targetPosition === Position.Bottom
      ? {
          x: arrowApproachPoint.x,
          y: arrowApproachPoint.y + (targetPosition === Position.Bottom ? controlOffset : -controlOffset)
        }
      : {
          x: arrowApproachPoint.x + (targetDirection || -sourceDirection) * controlOffset,
          y: arrowApproachPoint.y
        };
    const edgePath = [
      `M ${resolvedSourceX},${resolvedSourceY}`,
      `C ${sourceControl.x},${sourceControl.y} ${targetControl.x},${targetControl.y} ${arrowApproachPoint.x},${arrowApproachPoint.y}`,
      `L ${arrowBasePoint.x},${arrowBasePoint.y}`
    ].join(' ');

    return (
      <>
        <RcaSplineArrowMarker id={markerId} splineStyle={splineStyle} />
        {selected ? (
          <BaseEdge
            id={`${id}-selection-halo`}
            interactionWidth={0}
            path={edgePath}
            style={selectedEdgeHaloStyle}
          />
        ) : null}
        <BaseEdge
          id={id}
          interactionWidth={interactionWidth ?? 32}
          markerEnd={markerEnd}
          path={edgePath}
          style={edgeStyle}
        />
      </>
    );
  }

  const [edgePath] = getBezierPath({
    curvature: 0.34,
    sourcePosition,
    sourceX: resolvedSourceX,
    sourceY: resolvedSourceY,
    targetPosition,
    targetX: arrowBasePoint.x,
    targetY: arrowBasePoint.y
  });

  return (
    <>
      <RcaSplineArrowMarker id={markerId} splineStyle={splineStyle} />
      {selected ? (
        <BaseEdge
          id={`${id}-selection-halo`}
          interactionWidth={0}
          path={edgePath}
          style={selectedEdgeHaloStyle}
        />
      ) : null}
      <BaseEdge
        id={id}
        interactionWidth={interactionWidth ?? 32}
        markerEnd={markerEnd}
        path={edgePath}
        style={edgeStyle}
      />
    </>
  );
}

function RcaSplineArrowMarker({
  id,
  splineStyle
}: {
  id: string;
  splineStyle: RcaResolvedSplineStyle;
}) {
  return (
    <defs>
      <marker
        id={id}
        markerHeight={RCA_SPLINE_ARROW_MARKER_SIZE}
        markerUnits="userSpaceOnUse"
        markerWidth={RCA_SPLINE_ARROW_MARKER_SIZE}
        orient="auto-start-reverse"
        overflow="visible"
        refX={RCA_SPLINE_ARROW_BASE_X}
        refY={RCA_SPLINE_ARROW_TIP_Y}
        viewBox={`0 0 ${RCA_SPLINE_ARROW_MARKER_SIZE} ${RCA_SPLINE_ARROW_MARKER_SIZE}`}
      >
        {splineStyle.arrowHead === 'OPEN' ? (
          <path
            d="M 4 3 L 12 7 L 4 11"
            fill="none"
            stroke={splineStyle.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={RCA_SPLINE_ARROW_STROKE_WIDTH}
          />
        ) : (
          <path
            d="M 4 3 L 12 7 L 4 11 Z"
            fill={splineStyle.arrowHead === 'CLOSED_FILLED' ? splineStyle.color : '#ffffff'}
            stroke={splineStyle.color}
            strokeLinejoin="round"
            strokeWidth={RCA_SPLINE_ARROW_STROKE_WIDTH}
          />
        )}
      </marker>
    </defs>
  );
}

function getSnappedRcaNodePosition(
  nodeId: string,
  position: { x: number; y: number },
  nodes: RcaNode[],
  methodology: RcaMethodology,
  excludedNodeIds: Set<string> = new Set(),
  gridSize = RCA_CANVAS_SNAP_GRID[0]
): { guides: RcaAlignmentGuide[]; position: { x: number; y: number } } {
  const movingNode = nodes.find((node) => node.id === nodeId);

  if (!movingNode) {
    return { guides: [], position };
  }

  const movingSize = getRcaNodeSize(movingNode);
  const gridPosition = {
    x: snapToCanvasGrid(position.x, gridSize),
    y: snapToCanvasGrid(position.y, gridSize)
  };
  const movingBox = getRcaNodeBox(gridPosition, movingSize);
  const candidates = nodes
    .filter((node) => node.id !== nodeId && !excludedNodeIds.has(node.id))
    .map((node, index) => {
      const nodePosition = getNodePosition(node, nodes, index, methodology);
      return {
        box: getRcaNodeBox(nodePosition, getRcaNodeSize(node)),
        node
      };
    });

  const verticalSnap = getBestAlignmentSnap(
    [
      { offset: 0, value: movingBox.left },
      { offset: movingSize.width / 2, value: movingBox.centerX },
      { offset: movingSize.width, value: movingBox.right }
    ],
    candidates.flatMap((candidate) => [
      { box: candidate.box, value: candidate.box.left },
      { box: candidate.box, value: candidate.box.centerX },
      { box: candidate.box, value: candidate.box.right }
    ])
  );
  const horizontalSnap = getBestAlignmentSnap(
    [
      { offset: 0, value: movingBox.top },
      { offset: movingSize.height / 2, value: movingBox.centerY },
      { offset: movingSize.height, value: movingBox.bottom }
    ],
    candidates.flatMap((candidate) => [
      { box: candidate.box, value: candidate.box.top },
      { box: candidate.box, value: candidate.box.centerY },
      { box: candidate.box, value: candidate.box.bottom }
    ])
  );
  const snappedPosition = {
    x: verticalSnap ? verticalSnap.value - verticalSnap.offset : gridPosition.x,
    y: horizontalSnap ? horizontalSnap.value - horizontalSnap.offset : gridPosition.y
  };
  const snappedBox = getRcaNodeBox(snappedPosition, movingSize);
  const guides: RcaAlignmentGuide[] = [];

  if (verticalSnap) {
    guides.push({
      end: Math.max(snappedBox.bottom, verticalSnap.box.bottom) + 80,
      id: `vertical-${verticalSnap.value}`,
      orientation: 'vertical',
      start: Math.min(snappedBox.top, verticalSnap.box.top) - 80,
      value: verticalSnap.value
    });
  }

  if (horizontalSnap) {
    guides.push({
      end: Math.max(snappedBox.right, horizontalSnap.box.right) + 80,
      id: `horizontal-${horizontalSnap.value}`,
      orientation: 'horizontal',
      start: Math.min(snappedBox.left, horizontalSnap.box.left) - 80,
      value: horizontalSnap.value
    });
  }

  return {
    guides,
    position: snappedPosition
  };
}

function snapToCanvasGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function getBestAlignmentSnap(
  movingAnchors: Array<{ offset: number; value: number }>,
  targetAnchors: Array<{ box: RcaNodeBox; value: number }>
): { box: RcaNodeBox; offset: number; value: number } | null {
  let bestSnap: { box: RcaNodeBox; distance: number; offset: number; value: number } | null = null;

  movingAnchors.forEach((movingAnchor) => {
    targetAnchors.forEach((targetAnchor) => {
      const distance = Math.abs(targetAnchor.value - movingAnchor.value);

      if (distance > RCA_ALIGNMENT_THRESHOLD || (bestSnap && distance >= bestSnap.distance)) {
        return;
      }

      bestSnap = {
        box: targetAnchor.box,
        distance,
        offset: movingAnchor.offset,
        value: targetAnchor.value
      };
    });
  });

  return bestSnap;
}

interface RcaNodeBox {
  bottom: number;
  centerX: number;
  centerY: number;
  left: number;
  right: number;
  top: number;
}

function getRcaNodeBox(
  position: { x: number; y: number },
  size: { height: number; width: number }
): RcaNodeBox {
  return {
    bottom: position.y + size.height,
    centerX: position.x + size.width / 2,
    centerY: position.y + size.height / 2,
    left: position.x,
    right: position.x + size.width,
    top: position.y
  };
}

function estimateWrappedLineCount(text: string, charsPerLine: number): number {
  const trimmedLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!trimmedLines.length) {
    return 1;
  }

  return trimmedLines.reduce((lineCount, line) => (
    lineCount + Math.max(1, Math.ceil(line.length / charsPerLine))
  ), 0);
}

function getRcaCauseFooterRows(node: RcaNode, detail?: ReferenceRcaNodeDetail): number {
  const evidenceBadgeWidth = node.attachedEvidence.length >= 10 ? 88 : 76;
  const actionBadgeWidth = detail?.actions.length ? 72 : 0;
  const rootCauseBadgeWidth = node.isRootCause ? 96 : 0;
  const suspectBadgeWidth = !node.isRootCause && node.isSuspectedCause ? 74 : 0;
  const visibleBadgeCount = 1 + (detail?.actions.length ? 1 : 0) + (node.isRootCause ? 1 : 0) +
    (!node.isRootCause && node.isSuspectedCause ? 1 : 0);
  const estimatedFooterWidth = evidenceBadgeWidth + actionBadgeWidth + rootCauseBadgeWidth + suspectBadgeWidth +
    Math.max(0, visibleBadgeCount - 1) * 8;

  return estimatedFooterWidth > 244 ? 2 : 1;
}

function getRcaNodeSize(node: RcaNode, detail?: ReferenceRcaNodeDetail): { height: number; width: number } {
  if (node.nodeType === 'STICKY_NOTE') {
    return getStickyNoteContentSize(node);
  }

  if (node.nodeType === 'ISHIKAWA_CATEGORY') {
    const categoryLabelLines = estimateWrappedLineCount(node.label || 'Branch', 18);
    const categoryHeight = 16 + 14 + Math.max(1, categoryLabelLines) * 20 + 16;

    return {
      height: Math.max(RCA_CATEGORY_NODE_HEIGHT, categoryHeight),
      width: RCA_CATEGORY_NODE_WIDTH
    };
  }

  const minimumHeight = node.nodeType === 'FAULT_GATE'
    ? RCA_FAULT_GATE_NODE_HEIGHT
    : RCA_CAUSE_NODE_HEIGHT;
  const width = node.nodeType === 'FAULT_GATE'
    ? RCA_FAULT_GATE_NODE_WIDTH
    : RCA_CAUSE_NODE_WIDTH;
  const labelCharsPerLine = node.nodeType === 'FAULT_GATE'
    ? RCA_FAULT_GATE_LABEL_CHARS_PER_LINE
    : RCA_CAUSE_LABEL_CHARS_PER_LINE;

  const labelLineCount = Math.max(
    node.nodeType === 'FAULT_GATE' ? 1 : 2,
    estimateWrappedLineCount(node.label || 'Click to describe this cause', labelCharsPerLine)
  );
  const labelHeight = labelLineCount * 20;
  const verificationHeight = detail?.verification
    ? 12 + estimateWrappedLineCount(detail.verification, RCA_CAUSE_DETAIL_CHARS_PER_LINE) * 16 + 16
    : 0;
  const footerRows = getRcaCauseFooterRows(node, detail);
  const footerHeight = 16 + (footerRows - 1) * 22;
  const estimatedCardHeight = 32 + 36 + labelHeight + verificationHeight + 16 + footerHeight;

  return {
    height: Math.max(minimumHeight, estimatedCardHeight),
    width
  };
}

function getStickyNoteContentSize(node: RcaNode): { height: number; width: number } {
  const visualStyle = getResolvedNodeVisualStyle(node);
  const fontSize = visualStyle.fontSize;
  const averageCharacterWidth = fontSize * 0.58;
  const lineHeight = Math.ceil(fontSize * 1.3);
  const authorPrefix = `${node.createdBy ? getUserFirstName(node.createdBy.displayName) : 'User'} : `;
  const text = `${authorPrefix}${node.label || 'Write a note...'}`;
  const lines = text.split(/\r?\n/);
  const longestLineLength = Math.max(
    authorPrefix.length,
    ...lines.map((line) => line.length)
  );
  const targetWidth = Math.max(
    RCA_STICKY_NOTE_MIN_WIDTH,
    Math.min(RCA_STICKY_NOTE_MAX_WIDTH, 54 + longestLineLength * averageCharacterWidth)
  );
  const contentWidth = Math.max(1, targetWidth - 42);
  const wrappedLineCount = estimateWrappedVisualLineCount(lines, contentWidth, averageCharacterWidth);
  const targetHeight = 44 + wrappedLineCount * lineHeight;

  return {
    height: Math.max(RCA_STICKY_NOTE_MIN_HEIGHT, Math.min(RCA_STICKY_NOTE_MAX_HEIGHT, Math.round(targetHeight))),
    width: Math.round(targetWidth)
  };
}

function estimateWrappedVisualLineCount(lines: string[], contentWidth: number, averageCharacterWidth: number): number {
  const maxCharactersPerLine = Math.max(8, Math.floor(contentWidth / averageCharacterWidth));

  return lines.reduce((totalLineCount, line) => {
    const words = line.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      return totalLineCount + 1;
    }

    let visualLines = 1;
    let currentLineLength = 0;

    words.forEach((word) => {
      const wordLength = word.length;
      const projectedLength = currentLineLength ? currentLineLength + 1 + wordLength : wordLength;

      if (projectedLength <= maxCharactersPerLine) {
        currentLineLength = projectedLength;
        return;
      }

      if (wordLength > maxCharactersPerLine) {
        visualLines += currentLineLength
          ? Math.ceil(wordLength / maxCharactersPerLine)
          : Math.max(0, Math.ceil(wordLength / maxCharactersPerLine) - 1);
        currentLineLength = wordLength % maxCharactersPerLine;
        return;
      }

      visualLines += 1;
      currentLineLength = wordLength;
    });

    return totalLineCount + visualLines;
  }, 0);
}

function getNodePosition(
  node: RcaNode,
  nodes: RcaNode[],
  index: number,
  methodology: RcaMethodology
): { x: number; y: number } {
  if (node.uiCoordinates?.layoutMethodology === methodology) {
    const x = sanitizeRcaCanvasCoordinate(node.uiCoordinates.x);
    const y = sanitizeRcaCanvasCoordinate(node.uiCoordinates.y);

    if (x !== null && y !== null) {
      return { x, y };
    }
  }

  if (methodology === '5_WHYS') {
    return getFiveWhysDefaultPosition(getFiveWhysLayoutIndex(node, nodes, index));
  }

  if (methodology === 'ISHIKAWA') {
    return getFishbonePosition(node, nodes, index);
  }

  return getFaultTreePosition(node, nodes, index);
}

function getFishbonePosition(node: RcaNode, nodes: RcaNode[], index: number): { x: number; y: number } {
  const roots = nodes.filter((candidateNode) => !candidateNode.parentNodeId);
  const rootIndex = Math.max(0, roots.findIndex((candidateNode) => candidateNode.id === node.id));

  if (!node.parentNodeId) {
    return {
      x: 180 + rootIndex * 330,
      y: rootIndex % 2 === 0 ? 170 : 430
    };
  }

  const siblings = nodes.filter((candidateNode) => candidateNode.parentNodeId === node.parentNodeId);
  const siblingIndex = Math.max(0, siblings.findIndex((candidateNode) => candidateNode.id === node.id));
  const parent = nodes.find((candidateNode) => candidateNode.id === node.parentNodeId);
  const parentIndex = Math.max(0, roots.findIndex((candidateNode) => candidateNode.id === parent?.id));

  return {
    x: 240 + parentIndex * 330 + siblingIndex * 80,
    y: parentIndex % 2 === 0 ? 30 - siblingIndex * 120 : 570 + siblingIndex * 120
  };
}

function getFaultTreePosition(node: RcaNode, nodes: RcaNode[], index: number): { x: number; y: number } {
  const tree = buildRcaNodeTree(nodes);
  const depthMap = new Map<string, number>();

  function walk(currentNodes: RcaNode[], depth: number) {
    currentNodes.forEach((currentNode) => {
      depthMap.set(currentNode.id, depth);
      const children = nodes.filter((candidateNode) => candidateNode.parentNodeId === currentNode.id);
      walk(children, depth + 1);
    });
  }

  walk(tree, 0);

  const depth = depthMap.get(node.id) || 0;
  const sameDepthNodes = nodes.filter((candidateNode) => (depthMap.get(candidateNode.id) || 0) === depth);
  const depthIndex = sameDepthNodes.findIndex((candidateNode) => candidateNode.id === node.id);

  return {
    x: 180 + Math.max(0, depthIndex) * 340,
    y: 140 + depth * 190
  };
}

function getDefaultNodeType(methodology: RcaMethodology): RcaNodeType {
  if (methodology === 'ISHIKAWA') {
    return 'CAUSE';
  }

  if (methodology === 'FAULT_TREE') {
    return 'FAULT_GATE';
  }

  return 'WHY';
}

function isFishboneCauseNode(node: RcaNode): boolean {
  return node.nodeType === 'CAUSE' || node.nodeType === 'SUB_CAUSE';
}

function isProtectedFishboneStructureNode(node: RcaNode): boolean {
  return node.nodeType === 'ISHIKAWA_CATEGORY' || node.nodeType === 'FAULT_GATE';
}

function isFaultGateCapaSplineOwner(node: RcaNode, nodes: RcaNode[]): boolean {
  if (node.nodeType !== 'FAULT_GATE' || !node.parentNodeId) {
    return false;
  }

  const parentNode = nodes.find((candidateNode) => candidateNode.id === node.parentNodeId);

  return Boolean(parentNode && isCapaDestinationNode(parentNode));
}

function getProtectedFishboneStructureDeleteMessage(node: RcaNode): string {
  if (node.nodeType === 'FAULT_GATE') {
    return 'The fault gate is part of the protected Fishbone structure. It cannot be deleted from the canvas. Edit its text or move it, but keep the structure intact.';
  }

  return 'Branch nodes are part of the protected Fishbone structure. They cannot be deleted from the canvas. Add, edit, move, or delete causes under a branch instead.';
}

function isCompleteFishboneStructureSelection(nodes: RcaNode[], selectedNodeIds: Set<string>): boolean {
  const faultGate = getFishboneFaultGateNode(nodes);
  const categoryNodes = getOrderedFishboneCategoryNodes(nodes);

  if (!faultGate || !categoryNodes.length) {
    return false;
  }

  const selectedDefaultCategoryNames = new Set(
    categoryNodes
      .filter((node) => selectedNodeIds.has(node.id))
      .map((node) => normalizeFishboneCategoryName(node.label))
  );
  const allDefaultBranchesSelected = RCA_DEFAULT_FISHBONE_CATEGORIES.every((category) => (
    selectedDefaultCategoryNames.has(normalizeFishboneCategoryName(category.label))
  ));
  const spineSelected = selectedNodeIds.has(getFishboneSpineNodeId(faultGate.id));

  return selectedNodeIds.has(faultGate.id) && spineSelected && allDefaultBranchesSelected;
}

function isRcaIncidentReportNode(node: RcaNode | null | undefined, nodes: RcaNode[] = []): node is RcaNode {
  if (!node || node.status === 'DELETED') {
    return false;
  }

  if (getStoredFiveWhysNodeRole(node) === 'INCIDENT') {
    return true;
  }

  if (getFiveWhysLegacyLabelRole(node) === 'INCIDENT') {
    return true;
  }

  if (node.nodeType === 'WHY') {
    const nodeIndex = Math.max(0, nodes.findIndex((candidateNode) => candidateNode.id === node.id));
    const displayRole = getFiveWhysDisplayRole(node, nodes, nodeIndex);

    if (displayRole === 'INCIDENT') {
      return true;
    }
  }

  return false;
}

function getRcaIncidentReportNodes(incidentNode: RcaNode, nodes: RcaNode[]): RcaNode[] {
  const activeNodes = nodes.filter((node) => node.status !== 'DELETED');
  const incidentNodes = activeNodes.filter((node) => isRcaIncidentReportNode(node, activeNodes));
  const reportNodes = incidentNodes.length <= 1
    ? activeNodes
    : getConnectedRcaReportComponent(incidentNode, activeNodes);

  return reportNodes.sort((leftNode, rightNode) => (
    getRcaReportSectionRank(leftNode) - getRcaReportSectionRank(rightNode) ||
    getNodePosition(leftNode, nodes, nodes.indexOf(leftNode), 'ISHIKAWA').y - getNodePosition(rightNode, nodes, nodes.indexOf(rightNode), 'ISHIKAWA').y ||
    getNodePosition(leftNode, nodes, nodes.indexOf(leftNode), 'ISHIKAWA').x - getNodePosition(rightNode, nodes, nodes.indexOf(rightNode), 'ISHIKAWA').x
  ));
}

function getConnectedRcaReportComponent(incidentNode: RcaNode, nodes: RcaNode[]): RcaNode[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacentNodeIdsByNodeId = new Map<string, Set<string>>();

  nodes.forEach((node) => {
    adjacentNodeIdsByNodeId.set(node.id, adjacentNodeIdsByNodeId.get(node.id) || new Set());

    if (!node.parentNodeId || !nodeById.has(node.parentNodeId)) {
      return;
    }

    const parentAdjacentNodeIds = adjacentNodeIdsByNodeId.get(node.parentNodeId) || new Set<string>();
    const childAdjacentNodeIds = adjacentNodeIdsByNodeId.get(node.id) || new Set<string>();

    parentAdjacentNodeIds.add(node.id);
    childAdjacentNodeIds.add(node.parentNodeId);
    adjacentNodeIdsByNodeId.set(node.parentNodeId, parentAdjacentNodeIds);
    adjacentNodeIdsByNodeId.set(node.id, childAdjacentNodeIds);
  });

  const reportNodeIds = new Set<string>([incidentNode.id]);
  const queue = [incidentNode.id];

  for (let index = 0; index < queue.length; index += 1) {
    const nodeId = queue[index];
    const adjacentNodeIds = adjacentNodeIdsByNodeId.get(nodeId) || new Set<string>();

    adjacentNodeIds.forEach((adjacentNodeId) => {
      if (reportNodeIds.has(adjacentNodeId)) {
        return;
      }

      reportNodeIds.add(adjacentNodeId);
      queue.push(adjacentNodeId);
    });
  }

  return nodes.filter((node) => reportNodeIds.has(node.id));
}

function buildRcaIncidentReportSections(reportNodes: RcaNode[]): RcaReportSection[] {
  const sections = [
    {
      id: 'incident',
      matcher: (node: RcaNode) => getFiveWhysNodeRoleSafe(node) === 'INCIDENT',
      subtitle: 'Parent incident and initial RCA scope.',
      title: '1. Incident'
    },
    {
      id: 'incident-details',
      matcher: (node: RcaNode) => getFiveWhysNodeRoleSafe(node) === 'INCIDENT_DETAILS',
      subtitle: 'Facts, location, timing, involved people, and detailed event context.',
      title: '2. Incident Details'
    },
    {
      id: 'containment',
      matcher: (node: RcaNode) => getFiveWhysNodeRoleSafe(node) === 'CONTAINMENT',
      subtitle: 'Immediate controls used to protect people, product, process, and customers.',
      title: '3. Containment'
    },
    {
      id: 'problem',
      matcher: (node: RcaNode) => getFiveWhysNodeRoleSafe(node) === 'PROBLEM',
      subtitle: 'Defined problem statement and confirmed known facts.',
      title: '4. Problem Definition'
    },
    {
      id: 'evidence',
      matcher: (node: RcaNode) => getFiveWhysNodeRoleSafe(node) === 'EVIDENCE',
      subtitle: 'Evidence nodes and supporting files or links attached to them.',
      title: '5. Evidence'
    },
    {
      id: 'fishbone',
      matcher: (node: RcaNode) => node.nodeType === 'ISHIKAWA_CATEGORY' || node.nodeType === 'CAUSE' || node.nodeType === 'SUB_CAUSE' || node.nodeType === 'FAULT_GATE',
      subtitle: 'Fishbone branches, fault gate, suspected causes, and connected cause statements.',
      title: '6. Fishbone & Cause Analysis'
    },
    {
      id: 'five-whys',
      matcher: (node: RcaNode) => ['FIVE_WHYS', 'ANSWER'].includes(getFiveWhysNodeRoleSafe(node) || ''),
      subtitle: '5 Whys reasoning and answer trail.',
      title: '7. 5 Whys'
    },
    {
      id: 'root-cause',
      matcher: (node: RcaNode) => getFiveWhysNodeRoleSafe(node) === 'ROOT_CAUSE' || node.isRootCause,
      subtitle: 'Validated root cause candidates and supporting rationale.',
      title: '8. Root Cause'
    },
    {
      id: 'capa',
      matcher: (node: RcaNode) => ['CAPA', 'CORRECTIVE_ACTION', 'PREVENTIVE_ACTION', 'RISK_ASSESSMENT', 'EFFECTIVENESS'].includes(getFiveWhysNodeRoleSafe(node) || ''),
      subtitle: 'Corrective and preventive action plan, risk review, and effectiveness checks.',
      title: '9. CAPA & Verification'
    },
    {
      id: 'closure',
      matcher: (node: RcaNode) => ['LESSONS_LEARNED', 'APPROVAL_CLOSURE'].includes(getFiveWhysNodeRoleSafe(node) || ''),
      subtitle: 'Lessons learned, closure review, approvals, and final recommendations.',
      title: '10. Closure'
    },
    {
      id: 'notes',
      matcher: (node: RcaNode) => node.nodeType === 'STICKY_NOTE',
      subtitle: 'Collaboration notes and comments added during the RCA.',
      title: '11. Notes'
    }
  ];
  const usedNodeIds = new Set<string>();
  const builtSections = sections.map((section) => {
    const sectionNodes = reportNodes.filter((node) => section.matcher(node));

    sectionNodes.forEach((node) => usedNodeIds.add(node.id));

    return {
      id: section.id,
      nodes: sectionNodes,
      subtitle: section.subtitle,
      title: section.title
    };
  });
  const otherNodes = reportNodes.filter((node) => !usedNodeIds.has(node.id));

  if (otherNodes.length) {
    builtSections.push({
      id: 'other',
      nodes: otherNodes,
      subtitle: 'Additional connected canvas items that do not belong to the standard RCA sections.',
      title: '12. Other Connected Items'
    });
  }

  return builtSections.filter((section) => section.nodes.length);
}

function getRcaReportSectionRank(node: RcaNode): number {
  const role = getFiveWhysNodeRoleSafe(node);

  if (role === 'INCIDENT') return 1;
  if (role === 'INCIDENT_DETAILS') return 2;
  if (role === 'CONTAINMENT') return 3;
  if (role === 'PROBLEM') return 4;
  if (role === 'EVIDENCE') return 5;
  if (node.nodeType === 'ISHIKAWA_CATEGORY' || node.nodeType === 'CAUSE' || node.nodeType === 'SUB_CAUSE' || node.nodeType === 'FAULT_GATE') return 6;
  if (role === 'FIVE_WHYS' || role === 'ANSWER') return 7;
  if (role === 'ROOT_CAUSE' || node.isRootCause) return 8;
  if (role === 'CAPA' || role === 'CORRECTIVE_ACTION' || role === 'PREVENTIVE_ACTION' || role === 'RISK_ASSESSMENT' || role === 'EFFECTIVENESS') return 9;
  if (role === 'LESSONS_LEARNED' || role === 'APPROVAL_CLOSURE') return 10;
  if (node.nodeType === 'STICKY_NOTE') return 11;

  return 12;
}

function getFiveWhysNodeRoleSafe(node: RcaNode): RcaFiveWhysNodeRole | null {
  return node.nodeType === 'WHY' ? getFiveWhysNodeRole(node) : null;
}

function getRcaReportNodeTitle(node: RcaNode): string {
  const primaryFieldKey = getRcaPrimaryLabelFieldKey(getFiveWhysNodeRoleSafe(node));
  const primaryValue = primaryFieldKey ? node.detailFields?.[primaryFieldKey]?.trim() : '';

  return primaryValue || stripFiveWhysRolePrefix(node.label || '') || getRcaNodePanelTitle(node);
}

function getRcaReportFieldEntries(node: RcaNode): Array<{ key: string; label: string; value: string }> {
  const role = getFiveWhysNodeRoleSafe(node);
  const schema = role ? RCA_NODE_DETAIL_SCHEMA[role] || [] : [];
  const fields = node.detailFields || {};
  const entries = schema
    .flatMap((field) => {
      const value = fields[field.key]?.trim();
      const otherValue = fields[getRcaOtherDetailFieldKey(field.key)]?.trim();
      const resolvedValue = value === 'Other' && otherValue ? otherValue : value;

      return resolvedValue
        ? [{ key: field.key, label: field.label, value: resolvedValue }]
        : [];
    });

  if (!entries.length && node.label.trim()) {
    return [{
      key: 'label',
      label: 'Canvas Label',
      value: stripFiveWhysRolePrefix(node.label)
    }];
  }

  return entries;
}

function getFiveWhysRoleLabel(role: RcaFiveWhysNodeRole): string {
  return RCA_FIVE_WHYS_NODE_ROLE_OPTIONS.find((option) => option.value === role)?.label || '5 Whys';
}

function getDefaultRcaNodeRoleLabel(role: RcaFiveWhysNodeRole, incident?: RcaIncident | null): string {
  if (role === 'INCIDENT') {
    return incident?.title?.trim() || 'Incident';
  }

  if (role === 'INCIDENT_DETAILS') {
    return 'Incident details';
  }

  if (role === 'CONTAINMENT') {
    return 'Containment';
  }

  if (role === 'EVIDENCE') {
    return 'Evidence';
  }

  if (role === 'PROBLEM') {
    return 'Problem statement';
  }

  if (role === 'FIVE_WHYS') {
    return '5 Whys';
  }

  if (role === 'ROOT_CAUSE') {
    return 'Root cause';
  }

  if (role === 'CORRECTIVE_ACTION') {
    return 'Corrective action';
  }

  if (role === 'PREVENTIVE_ACTION') {
    return 'Preventive action';
  }

  if (role === 'RISK_ASSESSMENT') {
    return 'Risk assessment';
  }

  if (role === 'EFFECTIVENESS') {
    return 'Effectiveness verification';
  }

  if (role === 'LESSONS_LEARNED') {
    return 'Lessons learned';
  }

  if (role === 'APPROVAL_CLOSURE') {
    return 'Approval & closure';
  }

  return getFiveWhysRoleLabel(role);
}

function buildDefaultRcaNodeDetailFields(
  role: RcaFiveWhysNodeRole,
  incident?: RcaIncident | null
): Record<string, string> {
  const defaults: Record<string, string> = {};
  const incidentDisplayId = incident?.displayId || (incident ? buildFriendlyRcaDisplayId('RCA', incident.id, incident.createdAtIso) : '');

  if (role === 'INCIDENT') {
    defaults.incidentId = incidentDisplayId;
    defaults.incidentTitle = incident?.title || '';
    defaults.department = incident?.departmentName || '';
    defaults.severityLevel = incident && incident.rpnScore >= 25 ? 'Critical' : '';
    defaults.incidentStatus = 'Draft';
  }

  if (role === 'PROBLEM') {
    defaults.problemStatement = incident?.title || '';
    defaults.problemStatus = 'Open';
  }

  if (role === 'CAPA') {
    defaults.capaId = incidentDisplayId.replace(/^RCA-/, 'CAPA-');
    defaults.capaStatus = 'Draft';
  }

  if (role === 'RISK_ASSESSMENT') {
    defaults.riskAssessmentId = incidentDisplayId.replace(/^RCA-/, 'RISK-');
  }

  if (role === 'EFFECTIVENESS') {
    defaults.verificationId = incidentDisplayId.replace(/^RCA-/, 'VER-');
  }

  if (role === 'APPROVAL_CLOSURE') {
    defaults.closureReviewId = incidentDisplayId.replace(/^RCA-/, 'CLOSE-');
  }

  return defaults;
}

function getRcaOtherDetailFieldKey(fieldKey: string): string {
  return `${fieldKey}OtherText`;
}

function hasRcaOtherOption(field: RcaNodeDetailFieldDefinition): boolean {
  return Boolean(field.options?.some((option) => option.trim().toLowerCase() === 'other'));
}

function buildFriendlyRcaDisplayId(prefix: string, id: string, createdAtIso?: string | null): string {
  const year = createdAtIso ? new Date(createdAtIso).getUTCFullYear() : new Date().getUTCFullYear();
  const suffix = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();

  return `${prefix}-${Number.isFinite(year) ? year : new Date().getUTCFullYear()}-${suffix || 'NEW'}`;
}

function getFiveWhysNodeBadgeLabel(
  node: RcaNode,
  nodes: RcaNode[],
  fallbackIndex: number,
  role: RcaFiveWhysNodeRole = getFiveWhysDisplayRole(node, nodes, fallbackIndex)
): string {
  return getFiveWhysRoleLabel(role);
}

function getFiveWhysNodeRole(node: RcaNode): RcaFiveWhysNodeRole {
  const storedRole = getStoredFiveWhysNodeRole(node);

  if (storedRole) {
    return storedRole;
  }

  return getFiveWhysLegacyLabelRole(node) || 'FIVE_WHYS';
}

function getStoredFiveWhysNodeRole(node: RcaNode): RcaFiveWhysNodeRole | null {
  return isFiveWhysNodeRole(node.fiveWhysRole) ? node.fiveWhysRole : null;
}

function isFiveWhysNodeRole(role: unknown): role is RcaFiveWhysNodeRole {
  return (
    role === 'INCIDENT' ||
    role === 'INCIDENT_DETAILS' ||
    role === 'CONTAINMENT' ||
    role === 'EVIDENCE' ||
    role === 'PROBLEM' ||
    role === 'FIVE_WHYS' ||
    role === 'ANSWER' ||
    role === 'ROOT_CAUSE' ||
    role === 'CORRECTIVE_ACTION' ||
    role === 'PREVENTIVE_ACTION' ||
    role === 'CAPA' ||
    role === 'RISK_ASSESSMENT' ||
    role === 'EFFECTIVENESS' ||
    role === 'LESSONS_LEARNED' ||
    role === 'APPROVAL_CLOSURE'
  );
}

function getFiveWhysLegacyLabelRole(node: RcaNode): RcaFiveWhysNodeRole | null {
  const label = (node.label || '').trim();

  if (/^incident\s*\/\s*problem statement\b/i.test(label)) {
    return 'PROBLEM';
  }

  if (/^incident\s+details\b/i.test(label)) {
    return 'INCIDENT_DETAILS';
  }

  if (/^incident\b/i.test(label)) {
    return 'INCIDENT';
  }

  if (/^containment\b/i.test(label)) {
    return 'CONTAINMENT';
  }

  if (/^evidence\b/i.test(label)) {
    return 'EVIDENCE';
  }

  if (/^answer\b/i.test(label)) {
    return 'ANSWER';
  }

  if (/^(verified\s+root\s+cause|root\s+cause)\b/i.test(label)) {
    return 'ROOT_CAUSE';
  }

  if (/^capa\b/i.test(label)) {
    return 'CAPA';
  }

  if (/^corrective\s+action\b/i.test(label)) {
    return 'CORRECTIVE_ACTION';
  }

  if (/^preventive\s+action\b/i.test(label)) {
    return 'PREVENTIVE_ACTION';
  }

  if (/^risk\s+assessment\b/i.test(label)) {
    return 'RISK_ASSESSMENT';
  }

  if (/^effectiveness\b/i.test(label)) {
    return 'EFFECTIVENESS';
  }

  if (/^lessons\s+learned\b/i.test(label)) {
    return 'LESSONS_LEARNED';
  }

  if (/^approval\s*&?\s*closure\b/i.test(label)) {
    return 'APPROVAL_CLOSURE';
  }

  if (/^(5\s*whys?|why\s*\d+)\b/i.test(label)) {
    return 'FIVE_WHYS';
  }

  return null;
}

function getFiveWhysDisplayRole(node: RcaNode, nodes: RcaNode[], fallbackIndex: number): RcaFiveWhysNodeRole {
  const storedRole = getStoredFiveWhysNodeRole(node);

  if (storedRole) {
    return storedRole;
  }

  const legacyRole = getFiveWhysLegacyLabelRole(node);

  if (legacyRole) {
    return legacyRole;
  }

  if (isFiveWhysProblemLayoutNode(node, nodes, fallbackIndex)) {
    return 'PROBLEM';
  }

  return inferFiveWhysRoleFromGraph(node, nodes, fallbackIndex) || 'FIVE_WHYS';
}

function inferFiveWhysRoleFromGraph(node: RcaNode, nodes: RcaNode[], fallbackIndex: number): RcaFiveWhysNodeRole | null {
  if (node.nodeType !== 'WHY') {
    return null;
  }

  const chainDepth = getFiveWhysChainDepth(node, nodes);

  if (chainDepth === 0) {
    return 'PROBLEM';
  }

  if (chainDepth === 2) {
    return 'CAPA';
  }

  if (chainDepth === 1) {
    return 'FIVE_WHYS';
  }

  const layoutIndex = getFiveWhysLayoutIndex(node, nodes, fallbackIndex);

  if (layoutIndex === 0) {
    return 'PROBLEM';
  }

  if (layoutIndex === 2) {
    return 'CAPA';
  }

  if (layoutIndex === 1) {
    return 'FIVE_WHYS';
  }

  return null;
}

function getFiveWhysChainDepth(node: RcaNode, nodes: RcaNode[]): number {
  let depth = 0;
  let parentNodeId = node.parentNodeId;
  const visitedNodeIds = new Set([node.id]);

  while (parentNodeId) {
    if (visitedNodeIds.has(parentNodeId)) {
      return -1;
    }

    const parentNode = nodes.find((candidateNode) => candidateNode.id === parentNodeId);

    if (!parentNode) {
      return -1;
    }

    visitedNodeIds.add(parentNode.id);
    depth += 1;
    parentNodeId = parentNode.parentNodeId;
  }

  return depth;
}

function stripFiveWhysRolePrefix(label: string): string {
  return label
    .replace(/^\s*(incident\s+details|incident\s*\/\s*problem statement|incident|problem\s+statement|problem\s+statment|containment|evidence|5\s*whys?|corrective\s+action|preventive\s+action|risk\s+assessment|effectiveness|lessons\s+learned|approval\s*&?\s*closure|verified\s+root\s+cause|root\s+cause|capa\s*\/\s*effectiveness verification|capa|answer|why\s*\d+)\s*[:\-]?\s*/i, '')
    .trim();
}

function getRcaNodePanelTitle(node: RcaNode): string {
  if (node.nodeType === 'WHY') {
    return getFiveWhysRoleLabel(getFiveWhysNodeRole(node));
  }

  return node.isRootCause ? 'Verified root cause' : formatNodeType(node.nodeType);
}

function isRootCauseRoleNode(node: RcaNode | null | undefined): node is RcaNode {
  return Boolean(node && node.nodeType === 'WHY' && getFiveWhysNodeRole(node) === 'ROOT_CAUSE');
}

function getFishboneCategoryValueFromNode(node: RcaNode | null | undefined): string | null {
  if (!node || node.nodeType !== 'ISHIKAWA_CATEGORY') {
    return null;
  }

  const normalizedLabel = normalizeFishboneCategoryName(node.label);

  return RCA_FISHBONE_CATEGORY_LABELS.find((categoryLabel) => (
    normalizeFishboneCategoryName(categoryLabel) === normalizedLabel
  )) || null;
}

function findFishboneCategoryNodeByType(nodes: RcaNode[], rootCauseType: string | null | undefined): RcaNode | null {
  const normalizedType = normalizeFishboneCategoryName(rootCauseType || '');

  if (!normalizedType) {
    return null;
  }

  return nodes.find((node) => (
    node.nodeType === 'ISHIKAWA_CATEGORY' &&
    normalizeFishboneCategoryName(node.label) === normalizedType
  )) || null;
}

function syncRootCauseTypeWithParentCategory(node: RcaNode, nodes: RcaNode[]): RcaNode {
  if (!isRootCauseRoleNode(node)) {
    return node;
  }

  const parentCategory = nodes.find((candidateNode) => candidateNode.id === node.parentNodeId);
  const rootCauseType = getFishboneCategoryValueFromNode(parentCategory);

  if (!rootCauseType || node.detailFields?.rootCauseType === rootCauseType) {
    return node;
  }

  return {
    ...node,
    detailFields: {
      ...(node.detailFields || {}),
      rootCauseType
    }
  };
}

function getResolvedNodeVisualStyle(node: RcaNode): RcaResolvedNodeVisualStyle {
  const defaults = node.nodeType === 'ISHIKAWA_CATEGORY'
    ? RCA_DEFAULT_CATEGORY_VISUAL_STYLE
    : node.nodeType === 'STICKY_NOTE'
      ? RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE
      : RCA_DEFAULT_CAUSE_VISUAL_STYLE;

  return {
    backgroundColor: node.visualStyle?.backgroundColor || defaults.backgroundColor,
    borderColor: node.visualStyle?.borderColor || defaults.borderColor,
    fontFamily: getNormalizedNodeFontFamily(node.visualStyle?.fontFamily || defaults.fontFamily),
    fontSize: clampRcaNodeFontSize(node.visualStyle?.fontSize || defaults.fontSize),
    isBold: Boolean(node.visualStyle?.isBold ?? defaults.isBold),
    isItalic: Boolean(node.visualStyle?.isItalic ?? defaults.isItalic),
    isUnderline: Boolean(node.visualStyle?.isUnderline ?? defaults.isUnderline),
    textColor: node.visualStyle?.textColor || defaults.textColor
  };
}

function clampRcaNodeFontSize(fontSize: number): number {
  const boundedSize = Math.max(RCA_NODE_FONT_SIZE_MIN, Math.min(RCA_NODE_FONT_SIZE_MAX, Math.round(fontSize)));

  return RCA_NODE_FONT_SIZE_OPTIONS.reduce((closestSize, candidateSize) => (
    Math.abs(candidateSize - boundedSize) < Math.abs(closestSize - boundedSize)
      ? candidateSize
      : closestSize
  ), RCA_NODE_FONT_SIZE_OPTIONS[0]);
}

function getNormalizedNodeFontFamily(fontFamily: string | null | undefined): string {
  const option = RCA_NODE_FONT_FAMILY_OPTIONS.find((candidateOption) => candidateOption.value === fontFamily);

  return option?.value || RCA_DEFAULT_NODE_FONT_FAMILY;
}

function getNodeFontFamilyCss(fontFamily: string): string {
  const option = RCA_NODE_FONT_FAMILY_OPTIONS.find((candidateOption) => candidateOption.value === fontFamily);

  return option?.css || RCA_NODE_FONT_FAMILY_OPTIONS[0].css;
}

function cloneRcaNode(node: RcaNode): RcaNode {
	  return {
	    ...node,
	    attachedEvidence: node.attachedEvidence.map((evidence) => ({ ...evidence })),
	    createdBy: node.createdBy ? { ...node.createdBy } : null,
	    dimensions: node.dimensions ? { ...node.dimensions } : undefined,
	    edgeStyle: node.edgeStyle ? { ...node.edgeStyle } : undefined,
	    uiCoordinates: { ...node.uiCoordinates },
	    visualStyle: node.visualStyle ? { ...node.visualStyle } : undefined,
    whyChain: [...node.whyChain]
  };
}

function cloneRcaNodes(nodes: RcaNode[]): RcaNode[] {
  return nodes.map(cloneRcaNode);
}

function mergeRcaCanvasNodes(currentNodes: RcaNode[], incomingNodes: RcaNode[]): RcaNode[] {
  if (!incomingNodes.length) {
    return currentNodes;
  }

  const incomingNodeById = new Map(incomingNodes.map((node) => [node.id, node]));
  const mergedNodes = currentNodes.map((node) => incomingNodeById.get(node.id) || node);
  const currentNodeIds = new Set(currentNodes.map((node) => node.id));

  incomingNodes.forEach((node) => {
    if (!currentNodeIds.has(node.id)) {
      mergedNodes.push(node);
    }
  });

  return mergedNodes;
}

function getRcaCanvasStateKey(incidentId: string, sessionId: string): string {
  return `${incidentId}:${sessionId}`;
}

function normalizeRcaIncidentAccessForUser(incident: RcaIncident, uid: string): RcaIncident {
  return {
    ...incident,
    accessRole: incident.createdByUid === uid ? 'OWNER' : 'INVITED'
  };
}

function buildRcaCanvasLayoutPatch(
  currentNodes: RcaNode[],
  arrangedNodeById: Map<string, RcaNode>,
  methodology: RcaMethodology
): Map<string, RcaNode['uiCoordinates']> {
  const layoutPatch = new Map<string, RcaNode['uiCoordinates']>();

  currentNodes.forEach((node) => {
    const arrangedNode = arrangedNodeById.get(node.id);

    if (!arrangedNode) {
      return;
    }

    const x = sanitizeRcaCanvasCoordinate(arrangedNode.uiCoordinates?.x);
    const y = sanitizeRcaCanvasCoordinate(arrangedNode.uiCoordinates?.y);

    if (x === null || y === null) {
      return;
    }

    const currentX = sanitizeRcaCanvasCoordinate(node.uiCoordinates?.x);
    const currentY = sanitizeRcaCanvasCoordinate(node.uiCoordinates?.y);

    if (
      currentX === x &&
      currentY === y &&
      node.uiCoordinates?.layoutMethodology === methodology
    ) {
      return;
    }

    layoutPatch.set(node.id, {
      layoutMethodology: methodology,
      x,
      y
    });
  });

  return layoutPatch;
}

function applyRcaCanvasLayoutPatch(
  currentNodes: RcaNode[],
  layoutPatch: Map<string, RcaNode['uiCoordinates']>
): RcaNode[] {
  return currentNodes.map((node) => {
    const uiCoordinates = layoutPatch.get(node.id);

    if (!uiCoordinates) {
      return node;
    }

    return {
      ...node,
      uiCoordinates
    };
  });
}

function ensureRcaCanvasHasLocalVisibleNodes(
  reactFlow: ReturnType<typeof useReactFlow>,
  rootElement: HTMLElement | null,
  nodes: RcaNode[],
  methodology: RcaMethodology,
  fallbackPoint: { x: number; y: number }
) {
  const bounds = rootElement?.getBoundingClientRect();

  if (!bounds || !nodes.length) {
    return;
  }

  const viewport = reactFlow.getViewport();
  const margin = 72;
  const hasVisibleNode = nodes.some((node, index) => {
    const position = getNodePosition(node, nodes, index, methodology);
    const size = getRcaNodeSize(node);
    const left = position.x * viewport.zoom + viewport.x;
    const top = position.y * viewport.zoom + viewport.y;
    const right = (position.x + size.width) * viewport.zoom + viewport.x;
    const bottom = (position.y + size.height) * viewport.zoom + viewport.y;

    return right >= margin &&
      bottom >= margin &&
      left <= bounds.width - margin &&
      top <= bounds.height - margin;
  });

  if (hasVisibleNode) {
    return;
  }

  void reactFlow.setCenter(fallbackPoint.x, fallbackPoint.y, {
    duration: 180,
    zoom: viewport.zoom
  });
}

function sanitizeRcaCanvasNodes(nodes: RcaNode[]): RcaNode[] {
  return nodes
    .map(sanitizeRcaCanvasNode)
    .filter((node): node is RcaNode => Boolean(node));
}

function normalizeRcaNodeDetailFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /^[a-zA-Z0-9_.-]{1,80}$/.test(key))
      .slice(0, 80)
      .map(([key, fieldValue]) => [key, String(fieldValue ?? '').slice(0, 1200)])
  );
}

function sanitizeRcaCanvasNode(node: RcaNode): RcaNode | null {
  const x = sanitizeRcaCanvasCoordinate(node.uiCoordinates?.x);
  const y = sanitizeRcaCanvasCoordinate(node.uiCoordinates?.y);

  if (x === null || y === null) {
    return null;
  }

  const isStickyNote = node.nodeType === 'STICKY_NOTE';
  const safeNodeType = isStickyNote ||
    node.nodeType === 'ISHIKAWA_CATEGORY' ||
    node.nodeType === 'CAUSE' ||
    node.nodeType === 'SUB_CAUSE' ||
    node.nodeType === 'FAULT_GATE' ||
    node.nodeType === 'WHY'
    ? node.nodeType
    : 'WHY';
  const stickyNoteContentSize = isStickyNote ? getStickyNoteContentSize(node) : null;

  return {
    ...node,
    attachedEvidence: Array.isArray(node.attachedEvidence) ? node.attachedEvidence : [],
    connectionHandles: normalizeRcaNodeConnectionHandles(node.connectionHandles),
    detailFields: normalizeRcaNodeDetailFields(node.detailFields),
    dimensions: stickyNoteContentSize || undefined,
    fiveWhysRole: safeNodeType === 'WHY' && isFiveWhysNodeRole(node.fiveWhysRole) ? node.fiveWhysRole : null,
    nodeType: safeNodeType,
    parentNodeId: node.parentNodeId,
    uiCoordinates: {
      ...node.uiCoordinates,
      x,
      y
    },
    visualStyle: isStickyNote && !node.visualStyle ? {
      backgroundColor: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.backgroundColor,
      borderColor: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.borderColor,
      fontFamily: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.fontFamily,
      fontSize: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.fontSize,
      isBold: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.isBold,
      isItalic: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.isItalic,
      isUnderline: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.isUnderline,
      textColor: RCA_DEFAULT_STICKY_NOTE_VISUAL_STYLE.textColor
    } : node.visualStyle,
    whyChain: Array.isArray(node.whyChain) ? node.whyChain : []
  };
}

function sanitizeRcaCanvasCoordinate(value: unknown): number | null {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(-RCA_CANVAS_COORDINATE_LIMIT, Math.min(RCA_CANVAS_COORDINATE_LIMIT, Math.round(numericValue)));
}

function normalizeRcaNodeConnectionHandles(value: unknown): RcaNode['connectionHandles'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const connectionHandles: RcaNode['connectionHandles'] = {};

  if (record.sourceHandle === RCA_SOURCE_RIGHT_HANDLE || record.sourceHandle === RCA_SOURCE_BOTTOM_HANDLE) {
    connectionHandles.sourceHandle = record.sourceHandle;
  }

  if (record.targetHandle === RCA_TARGET_LEFT_HANDLE || record.targetHandle === RCA_TARGET_TOP_HANDLE) {
    connectionHandles.targetHandle = record.targetHandle;
  }

  return connectionHandles;
}

function getNormalizedRcaNodeConnectionHandles(value: unknown): NonNullable<RcaNode['connectionHandles']> {
  return normalizeRcaNodeConnectionHandles(value) || {};
}

function buildRcaHistoryNodeInput(node: RcaNode): RcaNodeInput {
	  return {
	    attachedEvidence: node.attachedEvidence.map((evidence) => ({ ...evidence })),
	    connectionHandles: normalizeRcaNodeConnectionHandles(node.connectionHandles),
	    edgeStyle: node.edgeStyle ? { ...node.edgeStyle } : {},
	    isRootCause: node.isRootCause,
    isSuspectedCause: node.isSuspectedCause,
    label: node.label,
    nodeType: node.nodeType,
    parentNodeId: node.parentNodeId,
    status: 'ACTIVE',
    uiCoordinates: { ...node.uiCoordinates },
    visualStyle: node.visualStyle ? { ...node.visualStyle } : undefined,
    whyChain: [...node.whyChain]
  };
}

function areRcaNodeSnapshotsEqual(firstNodes: RcaNode[], secondNodes: RcaNode[]): boolean {
  return getRcaNodeSnapshotSignature(firstNodes) === getRcaNodeSnapshotSignature(secondNodes);
}

function getRcaNodeSnapshotSignature(nodes: RcaNode[]): string {
  return JSON.stringify([...nodes]
	    .map((node) => ({
	      attachedEvidence: node.attachedEvidence,
	      connectionHandles: normalizeRcaNodeConnectionHandles(node.connectionHandles),
	      edgeStyle: node.edgeStyle || {},
	      id: node.id,
      isRootCause: node.isRootCause,
      isSuspectedCause: node.isSuspectedCause,
      label: node.label,
      nodeType: node.nodeType,
      parentNodeId: node.parentNodeId,
      status: node.status,
      uiCoordinates: node.uiCoordinates,
      visualStyle: node.visualStyle || {},
      whyChain: node.whyChain
    }))
    .sort((firstNode, secondNode) => firstNode.id.localeCompare(secondNode.id)));
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

function getMiniMapColor(node: RcaNode): string {
  if (node.visualStyle?.backgroundColor) {
    return node.visualStyle.backgroundColor;
  }

  if (node.isRootCause) {
    return '#ef4444';
  }

  if (node.isSuspectedCause) {
    return '#f59e0b';
  }

  if (node.nodeType === 'ISHIKAWA_CATEGORY') {
    return '#0891b2';
  }

  return '#64748b';
}

function normalizeFiveWhyDraft(whyChain: string[] = []): string[] {
  return Array.from({ length: 5 }, (_, index) => whyChain[index] || '');
}

function getInitialFiveWhysRevealCount(whyChain: string[] = []): number {
  const answers = normalizeFiveWhyDraft(whyChain);
  const firstEmptyIndex = answers.findIndex((answer) => !answer.trim());

  if (firstEmptyIndex === -1) {
    return 5;
  }

  return Math.min(5, Math.max(1, firstEmptyIndex + 1));
}

function buildFiveWhyQuestions(causeLabel: string, whyChain: string[] = []): string[] {
  const answers = normalizeFiveWhyDraft(whyChain);

  return answers.map((_, index) => {
    const sourceText = index === 0 ? causeLabel : answers[index - 1];

    if (!sourceText?.trim()) {
      return index === 0
        ? 'Why the selected cause?'
        : `Answer Why ${index} to generate this question.`;
    }

    return buildFiveWhyQuestion(sourceText);
  });
}

function buildFiveWhyQuestion(sourceText: string): string {
  const subject = addFiveWhyDefiniteArticle(normalizeFiveWhyQuestionSubject(sourceText));

  return subject ? `Why ${subject}?` : 'Why the selected cause?';
}

function normalizeFiveWhyQuestionSubject(sourceText: string): string {
  let subject = sourceText
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'([{]+/, '')
    .replace(/[\s"'.,;:!?)}\]]+$/, '')
    .trim();

  for (let passIndex = 0; passIndex < 8; passIndex += 1) {
    const previousSubject = subject;

    RCA_FIVE_WHY_LEADING_CONNECTIVE_PATTERNS.forEach((pattern) => {
      subject = subject.replace(pattern, '').trim();
    });
    subject = subject
      .replace(/^[\s"'([{]+/, '')
      .replace(/[\s"'.,;:!?)}\]]+$/, '')
      .trim();

    if (subject === previousSubject) {
      break;
    }
  }

  return subject;
}

function addFiveWhyDefiniteArticle(subject: string): string {
  const normalizedSubject = subject
    .replace(/^(?:the|a|an)\s+/i, '')
    .trim();

  return normalizedSubject ? `the ${normalizedSubject}` : '';
}

function hasCompletedFiveWhys(whyChain: string[] = []): boolean {
  return normalizeFiveWhyDraft(whyChain).every((why) => why.trim().length > 0);
}

function buildEvidenceFromLink(url: string): RcaAttachedEvidence {
  const parsedUrl = new URL(url);
  const pathName = decodeURIComponent(parsedUrl.pathname.split('/').filter(Boolean).pop() || '');
  const fileName = pathName || parsedUrl.hostname;

  return {
    fileHash: `link-${hashString(url)}`,
    fileName,
    fileUrl: url,
    uploadedAtIso: new Date().toISOString()
  };
}

function buildRcaProjectCanvasSnapshot(nodes: RcaNode[]): {
  edges: Array<{
    color: string;
    curveOffset: number;
    sourceId: string;
    sourceX: number;
    sourceY: number;
    targetId: string;
    targetX: number;
    targetY: number;
  }>;
  height: number;
  nodes: Array<{
    fill: string;
    height: number;
    id: string;
    isCategory: boolean;
    labelBar: string | null;
    stroke: string;
    width: number;
    x: number;
    y: number;
  }>;
  width: number;
} | null {
  const activeNodes = nodes.filter((node) => (
    node.status !== 'DELETED' &&
    Number.isFinite(node.uiCoordinates?.x) &&
    Number.isFinite(node.uiCoordinates?.y)
  ));

  if (!activeNodes.length) {
    return null;
  }

  const viewport = { height: 132, width: 388 };
  const padding = 16;
  const nodeLayouts = activeNodes.map((node) => {
    const size = getRcaNodeSize(node);

    return {
      height: size.height,
      node,
      width: size.width,
      x: node.uiCoordinates.x,
      y: node.uiCoordinates.y
    };
  });
  const minX = Math.min(...nodeLayouts.map((layout) => layout.x));
  const minY = Math.min(...nodeLayouts.map((layout) => layout.y));
  const maxX = Math.max(...nodeLayouts.map((layout) => layout.x + layout.width));
  const maxY = Math.max(...nodeLayouts.map((layout) => layout.y + layout.height));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const scale = Math.min(
    (viewport.width - padding * 2) / contentWidth,
    (viewport.height - padding * 2) / contentHeight
  );
  const offsetX = (viewport.width - contentWidth * scale) / 2 - minX * scale;
  const offsetY = (viewport.height - contentHeight * scale) / 2 - minY * scale;
  const layoutsById = new Map(nodeLayouts.map((layout) => [layout.node.id, layout]));

  function scaleX(value: number): number {
    return value * scale + offsetX;
  }

  function scaleY(value: number): number {
    return value * scale + offsetY;
  }

  return {
    edges: activeNodes.flatMap((targetNode) => {
      if (!targetNode.parentNodeId) {
        return [];
      }

      const sourceLayout = layoutsById.get(targetNode.parentNodeId);
      const targetLayout = layoutsById.get(targetNode.id);

      if (!sourceLayout || !targetLayout) {
        return [];
      }

      const sourceX = scaleX(sourceLayout.x + sourceLayout.width);
      const sourceY = scaleY(sourceLayout.y + sourceLayout.height / 2);
      const targetX = scaleX(targetLayout.x);
      const targetY = scaleY(targetLayout.y + targetLayout.height / 2);

      return [{
        color: targetNode.isRootCause ? '#ef4444' : '#0284c7',
        curveOffset: Math.max(18, Math.min(62, Math.abs(targetX - sourceX) * 0.45)),
        sourceId: sourceLayout.node.id,
        sourceX,
        sourceY,
        targetId: targetNode.id,
        targetX,
        targetY
      }];
    }),
    height: viewport.height,
    nodes: nodeLayouts.map((layout) => {
      const visualStyle = getResolvedNodeVisualStyle(layout.node);
      const isCategory = layout.node.nodeType === 'ISHIKAWA_CATEGORY';
      const isStickyNote = layout.node.nodeType === 'STICKY_NOTE';
      const isFaultGate = layout.node.nodeType === 'FAULT_GATE';

      return {
        fill: isStickyNote
          ? '#fef3c7'
          : layout.node.isRootCause
            ? '#fff1f2'
            : isCategory
              ? '#ecfeff'
              : isFaultGate
                ? '#ffffff'
                : visualStyle.backgroundColor || '#ffffff',
        height: Math.max(10, layout.height * scale),
        id: layout.node.id,
        isCategory,
        labelBar: isFaultGate
          ? '#fecdd3'
          : layout.node.isRootCause
            ? '#fca5a5'
            : null,
        stroke: layout.node.isRootCause
          ? '#ef4444'
          : isCategory
            ? '#67e8f9'
            : isStickyNote
              ? '#f59e0b'
              : visualStyle.borderColor || '#cbd5e1',
        width: Math.max(18, layout.width * scale),
        x: scaleX(layout.x),
        y: scaleY(layout.y)
      };
    }),
    width: viewport.width
  };
}

async function buildEvidencePreview(file: File): Promise<{ blob: Blob }> {
  if (isHeicEvidenceFile(file)) {
    const { default: heic2any } = await import('heic2any');
    const convertedBlob = await heic2any({
      blob: file,
      quality: 0.86,
      toType: 'image/jpeg'
    });
    const previewBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    return { blob: previewBlob };
  }

  return { blob: file };
}

function isPreviewableImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
}

function isHeicEvidenceFile(file: File): boolean {
  return file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Evidence file could not be prepared for upload.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Evidence file could not be prepared for upload.'));
    };
    reader.readAsDataURL(blob);
  });
}

function openEvidencePreviewDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open('synzapp-rca-evidence-previews', 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore('previews');
    };
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

async function storeEvidencePreviewBlob(key: string, blob: Blob): Promise<void> {
  const database = await openEvidencePreviewDatabase();

  if (!database) {
    return;
  }

  await new Promise<void>((resolve) => {
    const transaction = database.transaction('previews', 'readwrite');
    transaction.objectStore('previews').put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  database.close();
}

async function getStoredEvidencePreviewBlob(key: string): Promise<Blob | null> {
  const database = await openEvidencePreviewDatabase();

  if (!database) {
    return null;
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    const transaction = database.transaction('previews', 'readonly');
    const request = transaction.objectStore('previews').get(key);

    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => resolve(null);
  });

  database.close();
  return blob;
}

async function deleteStoredEvidencePreviewBlob(key: string): Promise<void> {
  const database = await openEvidencePreviewDatabase();

  if (!database) {
    return;
  }

  await new Promise<void>((resolve) => {
    const transaction = database.transaction('previews', 'readwrite');
    transaction.objectStore('previews').delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  database.close();
}

function getEvidenceKey(item: RcaAttachedEvidence): string {
  return `${item.fileHash}:${item.fileUrl}`;
}

function getEvidencePreviewUrl(item: RcaAttachedEvidence, previewUrls: Map<string, string>): string | null {
  const previewUrl = previewUrls.get(getEvidenceKey(item));

  if (previewUrl) {
    return previewUrl;
  }

  if (isImageEvidence(item) && isBrowserDisplayableImageUrl(item.fileUrl)) {
    return item.fileUrl;
  }

  return null;
}

function isImageEvidence(item: RcaAttachedEvidence): boolean {
  return /\.(apng|avif|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(item.fileName) ||
    /\.(apng|avif|gif|heic|heif|jpe?g|png|svg|tiff?|webp)(\?|#|$)/i.test(item.fileUrl) ||
    item.fileUrl.startsWith('blob:') ||
    item.fileUrl.startsWith('data:image/');
}

function isRcaStoredEvidenceUrl(value: string): boolean {
  return /^rca-evidence:\/\/ev_[A-Fa-f0-9]{32}$/.test(value.trim());
}

function isLegacyLocalEvidenceUrl(value: string): boolean {
  return /^audit:\/\//i.test(value.trim());
}

function inferEvidenceContentType(fileName: string): string {
  if (/\.avif$/i.test(fileName)) {
    return 'image/avif';
  }

  if (/\.gif$/i.test(fileName)) {
    return 'image/gif';
  }

  if (/\.heic$/i.test(fileName)) {
    return 'image/jpeg';
  }

  if (/\.heif$/i.test(fileName)) {
    return 'image/jpeg';
  }

  if (/\.jpe?g$/i.test(fileName)) {
    return 'image/jpeg';
  }

  if (/\.png$/i.test(fileName)) {
    return 'image/png';
  }

  if (/\.webp$/i.test(fileName)) {
    return 'image/webp';
  }

  return 'application/octet-stream';
}

function normalizeEvidenceUrl(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue) && !/^https?:\/\//i.test(trimmedValue)) {
    return null;
  }

  const candidateUrl = /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;

  try {
    const parsedUrl = new URL(candidateUrl);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function isLikelyUrl(value: string): boolean {
  return Boolean(normalizeEvidenceUrl(value));
}

function isBrowserDisplayableImageUrl(value: string): boolean {
  return value.startsWith('blob:') ||
    value.startsWith('data:image/') ||
    /^https?:\/\//i.test(value);
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(16);
}

async function hashEvidenceFile(file: File): Promise<string> {
  if (window.crypto?.subtle) {
    const digest = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return window.crypto?.randomUUID?.() || `${Date.now()}-${file.name}`;
}

function getRpnClassName(rpnScore: number): string {
  if (rpnScore >= 100) {
    return 'bg-red-100 text-red-700';
  }

  if (rpnScore >= 25) {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-emerald-100 text-emerald-700';
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function formatNodeType(nodeType: RcaNodeType): string {
  return nodeType
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function downloadReferenceAuditPackage(project: ReferenceRcaProject, nodes: RcaNode[]) {
  const html = buildReferenceAuditPackageHtml(project, nodes);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = 'RCA-Audit-Package-Fire-Under-Oven.html';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function buildReferenceAuditPackageHtml(project: ReferenceRcaProject, nodes: RcaNode[]): string {
  const categoryNodes = nodes.filter((node) => node.nodeType === 'ISHIKAWA_CATEGORY');
  const evidence = Object.entries(project.nodeDetails).flatMap(([nodeId, detail]) => detail.evidence.map((item) => ({
    ...item,
    branch: detail.branch,
    nodeId,
    owner: detail.owner
  })));
  const actions = Object.values(project.nodeDetails).flatMap((detail) => detail.actions.map((action) => ({
    ...action,
    branch: detail.branch
  })));
  const rootCauses = nodes.filter((node) => node.isRootCause);
  const validatedNodes = [
    ...rootCauses,
    ...nodes.filter((node) => node.id === 'environment-negative-airflow')
  ];
  const extraEvidence = [
    {
      branch: 'Containment',
      capturedAt: '2026-06-29 08:46',
      fileHash: '67a0f93f926d9c9d1f88c6b3a46b67ef2ef54f324f9b9a58a2c8ab80d2c50b73',
      fileName: 'line-stop-and-lockout-photo.jpg',
      kind: 'Production line photograph',
      nodeId: 'event-fire-under-oven',
      owner: 'Production Supervisor',
      source: 'Supervisor mobile capture',
      uploadedBy: 'Production Supervisor'
    },
    {
      branch: 'Containment',
      capturedAt: '2026-06-29 08:52',
      fileHash: 'ad4e783fd4296e6cc2d5e9a2ac233e5f48dd4e18083ab7b879bb9c7c628277f1',
      fileName: 'quarantined-product-pallets-photo.jpg',
      kind: 'Affected product photograph',
      nodeId: 'event-fire-under-oven',
      owner: 'QA Manager',
      source: 'QA hold cage inspection',
      uploadedBy: 'QA Technician'
    },
    {
      branch: 'Food Safety',
      capturedAt: '2026-06-29 09:05',
      fileHash: 'd34180189fb6947b73e7c2f9ef4eaec1d186b0f6d55db76311dfd44525cc927a',
      fileName: 'metal-detector-verification-record.pdf',
      kind: 'Metal detector verification record',
      nodeId: 'event-fire-under-oven',
      owner: 'QA Manager',
      source: 'QMS line release record',
      uploadedBy: 'QA Manager'
    },
    {
      branch: 'Method',
      capturedAt: '2026-06-29 09:18',
      fileHash: '937c8c619d460c2dd7c78f1c9b769948e741bb38f02bf7a623e38b6bd776675a',
      fileName: 'pre-operational-inspection-sheet.pdf',
      kind: 'Pre-operational inspection sheet',
      nodeId: 'method-pm-under-oven-missing',
      owner: 'QA Manager',
      source: 'Synzapp LSW export',
      uploadedBy: 'Production Supervisor'
    },
    {
      branch: 'People',
      capturedAt: '2026-06-29 09:41',
      fileHash: '85ce40849125f6136c9b6ffbf858d297f9b81fa6a8efb984e020813ed75380bf',
      fileName: 'combustible-dust-training-roster.pdf',
      kind: 'Operator training record',
      nodeId: 'people-training-dust-risk',
      owner: 'Safety Lead',
      source: 'Learning management system',
      uploadedBy: 'Safety Lead'
    },
    {
      branch: 'Measurement',
      capturedAt: '2026-06-29 10:35',
      fileHash: 'af316c76536c32c2017b364bde92f7c384ab2696f11574a1b736acac441c0f2d',
      fileName: 'thermal-camera-calibration-certificate.pdf',
      kind: 'Calibration certificate',
      nodeId: 'measurement-thermal-route',
      owner: 'Reliability Engineer',
      source: 'Calibration management system',
      uploadedBy: 'Reliability Engineer'
    },
    {
      branch: 'Material',
      capturedAt: '2026-06-29 11:26',
      fileHash: 'fb03438718e4d2af12b9b95c3b558384d3530ae3778a7d331bcac27c5a1e9648',
      fileName: 'flour-particle-size-and-moisture-report.pdf',
      kind: 'Material analysis report',
      nodeId: 'material-particle-size',
      owner: 'QA Lab Manager',
      source: 'QA laboratory',
      uploadedBy: 'QA Technician'
    },
    {
      branch: 'CAPA',
      capturedAt: '2026-07-03 13:15',
      fileHash: '356e9cc24f9eb2b047ef3a025514f4921f5d0421f49d0dc93435b37a46e81399',
      fileName: 'before-after-under-oven-cleaning-evidence.jpg',
      kind: 'Before/after evidence',
      nodeId: 'method-pm-under-oven-missing',
      owner: 'Sanitation Lead',
      source: 'Synzapp CAPA completion upload',
      uploadedBy: 'Sanitation Lead'
    }
  ];
  const enterpriseEvidence = [...evidence, ...extraEvidence];
  const containmentActions = [
    ['Stop production and isolate the Die Cut line', 'Production Supervisor', '2026-06-29 08:42', 'Line stopped, access controlled, ignition area cooled'],
    ['Remove affected WIP and finished product from release path', 'QA Manager', '2026-06-29 08:52', '3 pallets placed on QA hold pending disposition'],
    ['Lockout oven underside access and inspect for residual heat', 'Maintenance Manager', '2026-06-29 08:57', 'LOTO applied, thermal scan uploaded'],
    ['Clean visible flour dust using approved combustible-dust method', 'Sanitation Lead', '2026-06-29 09:20', 'No compressed air used, waste bagged and labeled'],
    ['Perform food safety release checks including metal detector verification', 'QA Manager', '2026-06-29 09:05', 'Detector challenge passed before restart authorization']
  ];
  const teamCharter = [
    ['Plant Manager', 'Investigation lead', 'Owns decisions, escalation, daily war-room cadence, final e-signature'],
    ['QA Manager', 'Food safety and documentation owner', 'Owns product hold/release, evidence quality, QMS document control'],
    ['Maintenance Manager', 'Equipment owner', 'Owns oven seal inspection, work orders, PM strategy corrections'],
    ['Safety Lead', 'EHS owner', 'Owns combustible dust hazard evaluation and employee safety controls'],
    ['Process Engineer', 'Process owner', 'Owns flour application containment and changeover validation'],
    ['Sanitation Lead', 'Standard work owner', 'Owns LSW/pre-op checklist updates and cleaning verification']
  ];
  const dataCollectionPlan = [
    ['Equipment condition', 'Oven underside seal, guards, conveyor rub point, vacuum nozzle', 'Maintenance inspection, photos, thermal scan', 'Maintenance Manager', 'Complete'],
    ['Process behavior', 'Flour applicator dust plume, changeover state, line speed', 'Line observation and video review', 'Process Engineer', 'Complete'],
    ['Material characteristics', 'Flour particle size, moisture, combustible dust loading', 'Lab sample and chain of custody', 'QA Lab Manager', 'Complete'],
    ['People/system controls', 'Training, shift handoff, stop authority, LSW completion', 'Record review and interviews', 'Safety Lead', 'Complete'],
    ['Measurement controls', 'Thermal camera calibration, metal detector verification, dust thresholds', 'Calibration and QMS record review', 'QA Manager', 'Complete'],
    ['Environment', 'Airflow direction, humidity, access lighting', 'Smoke pencil test and facilities trend review', 'Facilities Engineer', 'Complete']
  ];
  const sipocRows = [
    ['Suppliers', 'Flour supplier, maintenance, sanitation, QA lab, production planning'],
    ['Inputs', 'Flour, Die Cut changeover settings, oven heat, sanitation standards, PM route, trained operators'],
    ['Process', 'Flour application, Die Cut forming, transfer to oven, bake, cool, metal detect, release'],
    ['Outputs', 'Safe released product, verified line clearance, controlled dust exposure, sealed RCA package'],
    ['Customers', 'Consumers, QA, operations, EHS, regulatory auditors, customer quality representatives']
  ];
  const causeVerificationMatrix = [
    ['Lower oven return-panel seal gap', 'Machine', 'Physical inspection, photo, thermal scan, PM history', 'Seal gap visible; heat signature aligned with accumulation zone; PM route omitted lower return seal', 'Validated root cause'],
    ['Under-oven inspection missing from PM and sanitation route', 'Method', 'Checklist review, gemba walk, pre-op record audit', 'No required under-oven cavity check or photo verification before incident', 'Validated root cause'],
    ['Flour applicator containment skirt escape', 'Material', 'Line observation, dust sample, changeover standard review', 'Dust plume observed after format change; sample confirmed fine flour', 'Validated contributing root cause'],
    ['Negative airflow toward oven underside', 'Environment', 'Smoke pencil test and facilities airflow review', 'Airflow pulled dust from Die Cut discharge toward oven lower cavity', 'Validated contributing condition'],
    ['Operator training gap', 'People', 'Training roster and interview review', 'Roster complete but training did not include hidden oven underside examples', 'System weakness, not direct root cause'],
    ['Conveyor rub point generated ignition heat', 'Machine', 'Inspection and thermal scan', 'Rub point minor and outside ignition location; no matching heat signature', 'Eliminated'],
    ['Humidity spike caused clumping', 'Environment', 'Humidity trend and residue review', 'Humidity helped adherence but did not explain dust source or ignition path', 'Contributing background only'],
    ['Metal detector failure', 'Measurement', 'Challenge test and calibration review', 'Detector passed before restart and is downstream from fire mechanism', 'Eliminated']
  ];
  const fiveWhyAnalyses = [
    ['Lower oven return-panel seal gap', project.nodeDetails['machine-seal-gap']?.whyChain || [], 'Validated root cause'],
    ['PM and sanitation route did not include under-oven cavity inspection', project.nodeDetails['method-pm-under-oven-missing']?.whyChain || [], 'Validated root cause'],
    ['Fine flour escaped Die Cut applicator', project.nodeDetails['material-flour-escape']?.whyChain || [], 'Validated contributing root cause'],
    ['Negative airflow pulled dust toward oven underside', [
      'Why did dust migrate under the oven? Airflow moved from the Die Cut discharge toward the lower oven cavity.',
      'Why was airflow moving that way? The discharge area was under negative draw compared with the oven underside.',
      'Why was the draw not corrected? Facilities balancing did not include this local transfer path.',
      'Why was the path not known? Smoke testing was performed during commissioning but not after layout changes.',
      'Why is this a contributing condition? It transported escaped flour to the ignition zone.'
    ], 'Validated contributing condition'],
    ['Operator did not stop the line for dust accumulation alone', [
      'Why was the line not stopped earlier? Dust accumulation was treated as cleanup delay rather than stop condition.',
      'Why was it treated that way? Stop authority examples focused on jams, injury risk, and product contamination.',
      'Why did examples miss combustible dust? Training was written for ingredient handling rooms, not this oven geometry.',
      'Why was training not updated? Near-miss learning was not routed to the training owner.',
      'Why is this not the root cause? The hazard existed because controls allowed dust to escape and accumulate.'
    ], 'System weakness, CAPA included'],
    ['Conveyor tracking rub point', [
      'Why was heat suspected? A rub mark was found near the transfer path.',
      'Why was it not causal? Thermal scan did not match the fire origin location.',
      'Why was rub present? Belt tracking drifted during a previous changeover.',
      'Why was it not detected? The drift was within current operating tolerance.',
      'Why eliminate it? Evidence showed no ignition temperature at the affected point.'
    ], 'Eliminated as primary cause'],
    ['Vacuum pickup nozzle misalignment', [
      'Why was capture reduced? Nozzle was not centered after changeover.',
      'Why did changeover miss it? Setup check confirmed product flow, not dust capture.',
      'Why was dust capture omitted? The process standard lacked a capture efficiency check.',
      'Why is it not standalone root cause? Dust still needed seal gap and airflow path to reach hot surfaces.',
      'Why retain it? It is a preventive action input for containment skirt validation.'
    ], 'Contributing process weakness'],
    ['Metal detector control failure', [
      'Why was detector considered? Any fire response requires product safety release review.',
      'Why did evidence not support it? Challenge tests passed before restart.',
      'Why was product still held? Hold protected consumers while contamination risk was assessed.',
      'Why release after verification? Detector, visual inspection, and QA disposition met release criteria.',
      'Why eliminate it? The detector did not contribute to dust accumulation or ignition.'
    ], 'Eliminated']
  ];
  const riskRows = [
    ['Initial event risk', '9', '3', '1', '27', 'RCA required; line stopped and containment active'],
    ['After containment', '9', '2', '1', '18', 'Restart allowed only with inspection, cleanout, and QA release'],
    ['After CAPA verification', '9', '1', '1', '9', 'Controls verified effective; residual severity remains high by hazard type']
  ];
  const preventiveActions = [
    ['Update PM asset strategy for lower oven return seals and wear limits', 'Maintenance Manager', 'SAP-PM-44201', 'Verified'],
    ['Add under-oven photo verification to daily sanitation LSW', 'Sanitation Lead', 'LSW-STD-2048', 'Verified'],
    ['Add dust capture validation to every Die Cut format changeover', 'Process Engineer', 'ENG-MOC-1187', 'In progress'],
    ['Add combustible dust stop-authority refresher to operator training', 'Safety Lead', 'EHS-ACT-3910', 'Verified'],
    ['Add airflow smoke test after facilities layout or exhaust changes', 'Facilities Engineer', 'MAX-WO-54018', 'Synced']
  ];
  const voeRows = [
    ['7-day check', 'No under-oven dust above visual threshold; photo evidence attached daily', '0 findings in first 7 days', 'Pass'],
    ['14-day check', 'Thermal scan route completed and no hot spots above baseline + 10 F', 'All readings within control band', 'Pass'],
    ['30-day check', 'No repeated sanitation deviations or dust near-miss tags on Die Cut line', 'Pending scheduled review on 2026-07-29', 'Scheduled'],
    ['90-day check', 'Audit PM route, training completion, and changeover capture validation', 'Not yet due', 'Scheduled']
  ];
  const lessonsLearned = [
    'Hidden equipment geometry must be included in combustible-dust cleaning standards, not assumed from adjacent line templates.',
    'Evidence must attach to the specific cause node it proves so auditors can follow the logic from symptom to CAPA.',
    'Near-miss dust cleanup data needs one enterprise trend owner across LSW, QMS, EHS, and maintenance systems.',
    'Restart decisions are faster when containment, food safety release, maintenance verification, and QA approval are visible in one sealed package.'
  ];
  const approvalRows = [
    ['Plant Manager', 'Final business owner', 'Approved and electronically signed', '2026-06-29 18:18'],
    ['QA Manager', 'Food safety and QMS owner', 'Approved evidence, release disposition, and document control', '2026-06-29 18:11'],
    ['Maintenance Manager', 'Equipment owner', 'Approved equipment correction and PM updates', '2026-06-29 17:54'],
    ['Safety Lead', 'EHS owner', 'Approved combustible dust corrective actions', '2026-06-29 17:49']
  ];
  const appendixRows = [
    ['A', 'Evidence locker index', 'Photos, videos, records, certificates, lab reports, CAPA uploads, and immutable hashes'],
    ['B', 'Process flow and SIPOC', 'Manufacturing process map, supplier-input-process-output-customer scope'],
    ['C', '6M Fishbone and verification matrix', 'Cause families, suspected causes, tests, decisions, eliminated causes'],
    ['D', 'CAPA tracker and VOE plan', 'Corrective actions, preventive actions, status, owners, due dates, effectiveness checks'],
    ['E', 'Management approval and audit seal', 'Approvals, e-signature record, package hash, sealed state']
  ];
  const paretoData = [
    { label: 'Missing under-oven inspection', value: 34 },
    { label: 'Seal gap / wear criteria', value: 27 },
    { label: 'Flour escape after changeover', value: 20 },
    { label: 'Airflow migration path', value: 10 },
    { label: 'Other eliminated causes', value: 9 }
  ];
  const trendData = [
    { label: 'W-5', value: 4 },
    { label: 'W-4', value: 5 },
    { label: 'W-3', value: 6 },
    { label: 'W-2', value: 8 },
    { label: 'W-1', value: 9 },
    { label: 'W+1', value: 1 },
    { label: 'W+2', value: 0 }
  ];
  const branchHtml = categoryNodes.map((category) => {
    const branchNodes = nodes.filter((node) => node.parentNodeId === category.id || nodes.some((candidate) => (
      candidate.parentNodeId === category.id && node.parentNodeId === candidate.id
    )));

    return `
      <section class="card">
        <h2>${escapeHtml(category.label)}</h2>
        <ul>
          ${branchNodes.map((node) => `<li><strong>${node.isRootCause ? 'ROOT CAUSE: ' : ''}</strong>${escapeHtml(node.label)}</li>`).join('')}
        </ul>
      </section>
    `;
  }).join('');
  const evidenceExhibitHtml = enterpriseEvidence.map((item, index) => `
    <article class="exhibit">
      <div class="exhibit-visual exhibit-${index % 4}">
        <span>${escapeHtml(item.kind)}</span>
      </div>
      <div>
        <strong>${escapeHtml(item.fileName)}</strong>
        <p>${escapeHtml(item.branch)} / ${escapeHtml(item.source)} / ${escapeHtml(item.uploadedBy)}</p>
        <small>SHA-256 ${escapeHtml(item.fileHash)}</small>
      </div>
    </article>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RCA Audit Package - Fire Under Oven</title>
  <style>
    :root {
      color: #172033;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      background: #eef3f7;
      margin: 0;
      padding: 36px;
    }
    .package {
      background: white;
      border: 1px solid #d8e1ea;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
      margin: 0 auto;
      max-width: 1120px;
      min-height: 100vh;
      padding: 42px;
      position: relative;
    }
    .section-break { break-before: page; }
    .watermark {
      color: rgba(15, 23, 42, 0.055);
      font-size: 104px;
      font-weight: 900;
      left: 50%;
      letter-spacing: 0.08em;
      position: fixed;
      top: 44%;
      transform: translate(-50%, -50%) rotate(-18deg);
      white-space: nowrap;
      z-index: 0;
    }
    .content { position: relative; z-index: 1; }
    h1 {
      color: #07111f;
      font-size: 34px;
      letter-spacing: -0.02em;
      line-height: 1.05;
      margin: 0 0 10px;
    }
    h3 {
      color: #1f2937;
      font-size: 14px;
      margin: 0 0 10px;
    }
    h2 {
      color: #0f172a;
      font-size: 18px;
      margin: 0 0 12px;
    }
    p, li {
      color: #334155;
      font-size: 14px;
      line-height: 1.55;
    }
    .eyebrow {
      color: #0f766e;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.16em;
      margin: 0 0 8px;
      text-transform: uppercase;
    }
    .meta {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin: 26px 0;
    }
    .pill, .metric {
      border: 1px solid #dbe5ef;
      border-radius: 14px;
      padding: 12px;
    }
    .metric span {
      color: #64748b;
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .metric strong {
      color: #0f172a;
      display: block;
      font-size: 16px;
      margin-top: 4px;
    }
    .toc {
      columns: 2;
      margin: 12px 0 0;
      padding-left: 20px;
    }
    .toc li { break-inside: avoid; font-size: 13px; }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .grid-three {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .card {
      background: rgba(248, 250, 252, 0.86);
      border: 1px solid #dbe5ef;
      border-radius: 8px;
      margin-bottom: 16px;
      padding: 18px;
    }
    .callout {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-left: 5px solid #ea580c;
      border-radius: 8px;
      padding: 16px;
    }
    .flow {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      margin-top: 14px;
    }
    .flow div {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      min-height: 62px;
      padding: 10px;
      position: relative;
    }
    .flow div:not(:last-child)::after {
      color: #64748b;
      content: ">";
      position: absolute;
      right: -9px;
      top: 22px;
      z-index: 2;
    }
    .flow .critical {
      border-color: #f97316;
      box-shadow: inset 0 0 0 2px rgba(249, 115, 22, 0.18);
    }
    .timeline-graphic {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(8, minmax(0, 1fr));
      margin-top: 14px;
    }
    .timeline-graphic div {
      border-top: 4px solid #0f766e;
      color: #334155;
      font-size: 11px;
      padding-top: 8px;
    }
    .bars { display: grid; gap: 10px; margin-top: 12px; }
    .bar-row {
      align-items: center;
      display: grid;
      gap: 10px;
      grid-template-columns: 210px 1fr 42px;
    }
    .bar-label, .bar-value {
      color: #334155;
      font-size: 12px;
    }
    .bar-track {
      background: #e2e8f0;
      border-radius: 999px;
      height: 12px;
      overflow: hidden;
    }
    .bar-fill {
      background: linear-gradient(90deg, #0f766e, #f97316);
      border-radius: 999px;
      height: 100%;
    }
    .trend {
      align-items: end;
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      height: 150px;
      margin-top: 18px;
    }
    .trend-column {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 6px;
      justify-content: end;
    }
    .trend-bar {
      background: #2563eb;
      border-radius: 6px 6px 0 0;
      min-height: 4px;
      width: 100%;
    }
    .trend-column span {
      color: #475569;
      font-size: 11px;
      font-weight: 700;
    }
    .exhibit-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .exhibit {
      border: 1px solid #dbe5ef;
      border-radius: 8px;
      display: grid;
      gap: 12px;
      grid-template-columns: 140px 1fr;
      padding: 10px;
    }
    .exhibit p {
      font-size: 12px;
      margin: 4px 0;
    }
    .exhibit small {
      color: #64748b;
      display: block;
      font-size: 10px;
      overflow-wrap: anywhere;
    }
    .exhibit-visual {
      align-items: end;
      background: linear-gradient(135deg, #dbeafe, #94a3b8);
      border-radius: 6px;
      display: flex;
      height: 96px;
      overflow: hidden;
      padding: 8px;
    }
    .exhibit-visual span {
      background: rgba(15, 23, 42, 0.72);
      border-radius: 4px;
      color: white;
      font-size: 10px;
      font-weight: 800;
      padding: 5px 6px;
      text-transform: uppercase;
    }
    .exhibit-1 { background: linear-gradient(135deg, #fef3c7, #64748b); }
    .exhibit-2 { background: linear-gradient(135deg, #dcfce7, #475569); }
    .exhibit-3 { background: linear-gradient(135deg, #fee2e2, #334155); }
    table {
      border-collapse: collapse;
      margin-top: 10px;
      width: 100%;
    }
    th, td {
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: #475569;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .hash {
      color: #475569;
      font-family: "Courier New", monospace;
      font-size: 11px;
      overflow-wrap: anywhere;
    }
    @media print {
      body { background: white; padding: 0; }
      .package { border: 0; box-shadow: none; }
      .section-break { break-before: page; }
    }
  </style>
</head>
<body>
  <div class="watermark">SEALED RCA</div>
  <main class="package">
    <div class="content">
      <h1>RCA Audit Package</h1>
      <p>${escapeHtml(project.problemStatement)}</p>
      <div class="meta">
        <div class="metric"><span>Incident</span><strong>${escapeHtml(project.incident.title)}</strong></div>
        <div class="metric"><span>Asset</span><strong>${escapeHtml(project.incident.assetId)}</strong></div>
        <div class="metric"><span>RPN</span><strong>${project.incident.rpnScore}</strong></div>
        <div class="metric"><span>Status</span><strong>Sealed / Closed</strong></div>
      </div>
      <section class="card">
        <p class="eyebrow">Synthetic enterprise demonstration package</p>
        <h2>Table of Contents</h2>
        <ol class="toc">
          <li>Executive Summary</li>
          <li>Problem Statement</li>
          <li>Containment Actions</li>
          <li>Enterprise Investigation Flow</li>
          <li>Team Charter</li>
          <li>Data Collection Plan</li>
          <li>Process Flow Diagram</li>
          <li>SIPOC</li>
          <li>6M Fishbone Analysis</li>
          <li>Cause Verification Matrix</li>
          <li>Detailed 5 Whys</li>
          <li>Evidence-Based Elimination</li>
          <li>Root Cause Validation</li>
          <li>Risk Assessment</li>
          <li>Corrective and Preventive Actions</li>
          <li>Complete CAPA</li>
          <li>Verification of Effectiveness</li>
          <li>Lessons Learned</li>
          <li>Management Approval</li>
          <li>Appendices</li>
        </ol>
      </section>
      <section class="card">
        <p class="eyebrow">1. Executive Summary</p>
        <h2>Executive Summary</h2>
        <p>The investigation determined that flour dust escaped from the Die Cut applicator, migrated through an unsealed lower oven return-panel path, accumulated in a hidden under-oven cavity, and contacted a hot surface. The event was contained immediately, affected product was placed on QA hold, and the RCA team validated three root causes plus one contributing environmental condition using attached evidence, 5 Whys, Fishbone analysis, maintenance records, lab data, and controlled restart checks.</p>
        <div class="grid-three">
          <div class="metric"><span>Primary Cause</span><strong>Oven lower seal gap</strong></div>
          <div class="metric"><span>System Cause</span><strong>Missing under-oven inspection</strong></div>
          <div class="metric"><span>CAPA State</span><strong>Synced / Verified</strong></div>
        </div>
      </section>
      <section class="card">
        <p class="eyebrow">2. Problem Statement</p>
        <h2>Problem Statement</h2>
        <p>${escapeHtml(project.problemStatement)}</p>
        <p>Operational impact included immediate line stoppage, product hold, sanitation recovery, maintenance inspection, QA release checks, and executive visibility because the hazard combined combustible dust, a hot surface, and a food manufacturing release decision.</p>
      </section>
      <section class="card">
        <p class="eyebrow">3. Containment Actions</p>
        <h2>Immediate Containment</h2>
        ${renderAuditTable(['Action', 'Owner', 'Time', 'Result'], containmentActions)}
      </section>
      <section class="card">
        <p class="eyebrow">4. Enterprise Investigation Flow</p>
        <h2>Investigation Flow</h2>
        <div class="timeline-graphic">
          ${project.timeline.map((item) => `<div><strong>${escapeHtml(item.at.slice(11) || item.at)}</strong><br />${escapeHtml(item.event)}</div>`).join('')}
        </div>
      </section>
      <div class="grid">
        <section class="card">
          <p class="eyebrow">5. Team Charter</p>
          <h2>Team Charter</h2>
          ${renderAuditTable(['Role', 'RCA Responsibility', 'Decision Rights'], teamCharter)}
        </section>
        <section class="card">
          <p class="eyebrow">6. Data Collection Plan</p>
          <h2>Data Collection Plan</h2>
          ${renderAuditTable(['Data Stream', 'Scope', 'Method', 'Owner', 'Status'], dataCollectionPlan)}
        </section>
      </div>
      <section class="card section-break">
        <p class="eyebrow">7. Process Flow Diagram</p>
        <h2>Process Flow Diagram</h2>
        <div class="flow">
          <div>Flour receiving and staging</div>
          <div>Applicator setup and changeover</div>
          <div class="critical">Die Cut forming and dust generation</div>
          <div class="critical">Transfer toward oven intake</div>
          <div class="critical">Oven bake and underside heat zone</div>
          <div>Cooling and packaging</div>
          <div>Metal detection and QA release</div>
        </div>
      </section>
      <section class="card">
        <p class="eyebrow">8. SIPOC</p>
        <h2>SIPOC</h2>
        ${renderAuditTable(['Element', 'Enterprise Scope'], sipocRows)}
      </section>
      <section class="card">
        <p class="eyebrow">9. 6M Fishbone Analysis</p>
        <h2>6M Fishbone Analysis</h2>
        <p>The 6M Fishbone branch set was built in the RCA canvas and sealed with the audit package. Root causes are marked in the branch lists below.</p>
      </section>
      <div class="grid">
        ${branchHtml}
      </div>
      <section class="card section-break">
        <p class="eyebrow">10. Cause Verification Matrix</p>
        <h2>Cause Verification Matrix</h2>
        ${renderAuditTable(['Suspected Cause', '6M', 'Verification Method', 'Evidence Result', 'Decision'], causeVerificationMatrix)}
      </section>
      <section class="card">
        <p class="eyebrow">11. Detailed 5 Whys</p>
        <h2>5 Whys For Every Suspected Cause Taken To Verification</h2>
        ${fiveWhyAnalyses.map(([cause, whys, disposition]) => `
          <article class="card">
            <h3>${escapeHtml(cause as string)}</h3>
            <ol>
              ${(whys as string[]).map((why) => `<li>${escapeHtml(why)}</li>`).join('')}
            </ol>
            <p><strong>Disposition:</strong> ${escapeHtml(disposition as string)}</p>
          </article>
        `).join('')}
      </section>
      <section class="card">
        <p class="eyebrow">12. Evidence-Based Elimination Process</p>
        <h2>Evidence-Based Elimination</h2>
        ${renderAuditTable(
          ['Cause Considered', 'Evidence Used', 'Elimination Logic'],
          [
            ['Conveyor rub point as ignition source', 'Thermal scan, equipment inspection photo, maintenance interview', 'Heat signature and location did not match fire origin; retained as maintenance follow-up only'],
            ['Metal detector failure', 'Detector challenge record and calibration review', 'Detector is downstream and passed verification; not part of dust accumulation or ignition mechanism'],
            ['Humidity as primary cause', 'Facilities humidity trend and residue inspection', 'Humidity affected adhesion but did not create dust source, migration path, or hot-surface contact'],
            ['Training noncompletion', 'Operator roster and LMS report', 'Training completion was current; content gap converted to preventive action']
          ]
        )}
      </section>
      <section class="card">
        <p class="eyebrow">13. Root Cause Validation</p>
        <h2>Root Cause Validation</h2>
        ${renderAuditTable(
          ['Validated Cause', 'Validation Evidence', 'CAPA Link'],
          validatedNodes.map((node) => [
            node.label,
            (project.nodeDetails[node.id]?.evidence || [])
              .map((item) => item.fileName)
              .join(', ') || 'Smoke pencil airflow test and facilities observation',
            (project.nodeDetails[node.id]?.actions || [])
              .map((action) => `${action.syncId} ${action.status}`)
              .join(', ') || 'MAX-WO-54018 SYNCED'
          ])
        )}
      </section>
      <div class="grid">
        <section class="card">
          <p class="eyebrow">14. Risk Assessment</p>
          <h2>Risk Assessment</h2>
          ${renderAuditTable(['State', 'Severity', 'Occurrence', 'Detection', 'RPN', 'Disposition'], riskRows)}
        </section>
        <section class="card">
          <p class="eyebrow">Charts</p>
          <h2>Pareto and Trend Charts</h2>
          <h3>Pareto of verified cause contribution</h3>
          <div class="bars">
            ${paretoData.map((item) => `
              <div class="bar-row">
                <span class="bar-label">${escapeHtml(item.label)}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${item.value}%"></span></span>
                <span class="bar-value">${item.value}%</span>
              </div>
            `).join('')}
          </div>
          <h3>Weekly dust finding trend</h3>
          <div class="trend">
            ${trendData.map((item) => `
              <div class="trend-column">
                <div class="trend-bar" style="height:${item.value * 14}px"></div>
                <span>${escapeHtml(item.label)}</span>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
      <section class="card section-break">
        <p class="eyebrow">15-16. Corrective Actions, Preventive Actions, and Complete CAPA</p>
        <h2>CAPA Tracking Sheet</h2>
        ${renderAuditTable(
          ['Branch', 'Action', 'Owner', 'System', 'External ID', 'Status / Due'],
          actions.map((action) => [
            action.branch,
            action.action,
            action.owner,
            action.system,
            action.syncId,
            `${action.status} by ${formatAuditDate(action.dueDate)}`
          ])
        )}
        <h2>Preventive Actions</h2>
        ${renderAuditTable(['Preventive Action', 'Owner', 'Tracker ID', 'Status'], preventiveActions)}
      </section>
      <section class="card">
        <p class="eyebrow">17. Verification of Effectiveness</p>
        <h2>VOE Plan</h2>
        ${renderAuditTable(['Checkpoint', 'Acceptance Criteria', 'Result', 'Status'], voeRows)}
      </section>
      <section class="card">
        <p class="eyebrow">18. Lessons Learned</p>
        <h2>Lessons Learned</h2>
        ${renderAuditList(lessonsLearned)}
      </section>
      <section class="card">
        <p class="eyebrow">19. Management Approval</p>
        <h2>Audit Seal</h2>
        <p><strong>Signed by:</strong> ${escapeHtml(project.signedBy)}</p>
        <p><strong>Sealed at:</strong> ${escapeHtml(formatAuditDate(project.sealedAt))}</p>
        <p><strong>Package hash:</strong> <span class="hash">${escapeHtml(project.auditHash)}</span></p>
        ${renderAuditTable(['Approver', 'Role', 'Approval', 'Date'], approvalRows)}
      </section>
      <section class="card">
        <p class="eyebrow">20. Appendices</p>
        <h2>Appendices</h2>
        ${renderAuditTable(['Appendix', 'Title', 'Contents'], appendixRows)}
      </section>
      <section class="card section-break">
        <p class="eyebrow">Appendix A</p>
        <h2>Evidence Locker Index</h2>
        <div class="callout">
          <p><strong>Note:</strong> This package contains realistic synthetic evidence records for the sealed RCA demonstration. Every record is linked to a branch, owner, source system, timestamp, and immutable SHA-256-style hash for audit flow validation.</p>
        </div>
        ${renderAuditTable(
          ['Branch', 'Evidence', 'Kind / Source', 'Owner', 'Captured', 'Hash'],
          enterpriseEvidence.map((item) => [
            item.branch,
            item.fileName,
            `${item.kind} / ${item.source}`,
            item.uploadedBy,
            formatAuditDate(item.capturedAt),
            item.fileHash
          ])
        )}
        <h2>Evidence Exhibit Preview</h2>
        <div class="exhibit-grid">
          ${evidenceExhibitHtml}
        </div>
      </section>
      <section class="card">
        <p class="eyebrow">Legacy Summary</p>
        <h2>Verified Root Causes</h2>
        <ul>
          ${rootCauses.map((node) => `<li>${escapeHtml(node.label)}</li>`).join('')}
        </ul>
      </section>
      <section class="card">
        <h2>Evidence Records</h2>
        <table>
          <thead><tr><th>Branch</th><th>Evidence</th><th>Owner</th><th>Captured</th></tr></thead>
          <tbody>
            ${evidence.map((item) => `
              <tr>
                <td>${escapeHtml(item.branch)}</td>
                <td>${escapeHtml(item.fileName)}<br />${escapeHtml(item.kind)} / ${escapeHtml(item.source)}</td>
                <td>${escapeHtml(item.uploadedBy)}</td>
                <td>${escapeHtml(formatAuditDate(item.capturedAt))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
      <section class="card">
        <h2>Corrective Actions</h2>
        <table>
          <thead><tr><th>Branch</th><th>Action</th><th>Owner</th><th>System</th><th>Status</th></tr></thead>
          <tbody>
            ${actions.map((action) => `
              <tr>
                <td>${escapeHtml(action.branch)}</td>
                <td>${escapeHtml(action.action)}</td>
                <td>${escapeHtml(action.owner)}</td>
                <td>${escapeHtml(action.system)}</td>
                <td>${escapeHtml(action.status)} by ${escapeHtml(formatAuditDate(action.dueDate))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
      <section class="card">
        <h2>Timeline</h2>
        <table>
          <thead><tr><th>Time</th><th>Event</th><th>Owner</th></tr></thead>
          <tbody>
            ${project.timeline.map((item) => `
              <tr>
                <td>${escapeHtml(item.at)}</td>
                <td>${escapeHtml(item.event)}</td>
                <td>${escapeHtml(item.owner)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    </div>
  </main>
</body>
</html>`;
}

function renderAuditList(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderAuditTable(headers: string[], rows: string[][]): string {
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAuditDate(value: string): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  };

  if (value.includes('T')) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function formatInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatInputDateTime(date: Date, time: string): string {
  const normalizedTime = isValidTimeInput(time) ? time : formatTimeInput(date);

  return `${formatInputDate(date)}T${normalizedTime}`;
}

function parseInputDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseInputDateTime(value: string): { date: Date; time: string } | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);

  if (!match) {
    return null;
  }

  const date = parseInputDate(match[1]);
  const time = match[2];

  if (!date || !isValidTimeInput(time)) {
    return null;
  }

  return { date, time };
}

function formatDateFilterLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short'
  }).format(date);
}

function formatTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isValidTimeInput(value: string): boolean {
  const [hoursValue, minutesValue] = value.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);

  return /^\d{2}:\d{2}$/.test(value) &&
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59;
}

function formatTimeFilterLabel(value: string): string {
  const [hoursValue, minutesValue] = value.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 'Any time';
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatDateTimeFilterLabel(date: Date, time: string): string {
  return `${new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)}, ${formatTimeFilterLabel(time)}`;
}

function buildTimeFilterOptions(): Array<{ label: string; value: string }> {
  const options: Array<{ label: string; value: string }> = [];

  for (let minutesFromStart = 0; minutesFromStart < 24 * 60; minutesFromStart += 15) {
    const date = new Date();

    date.setHours(Math.floor(minutesFromStart / 60), minutesFromStart % 60, 0, 0);
    options.push({
      label: formatTimeFilterLabel(formatTimeInput(date)),
      value: formatTimeInput(date)
    });
  }

  return options;
}

function timeInputToMinutes(value: string): number {
  const [hoursValue, minutesValue] = value.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'U';
}

function getUserFirstName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || 'User';
}

function getCurrentEditableSelectionText(): string {
  const activeElement = document.activeElement;

  if (
    (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) &&
    typeof activeElement.selectionStart === 'number' &&
    typeof activeElement.selectionEnd === 'number' &&
    activeElement.selectionEnd > activeElement.selectionStart
  ) {
    return activeElement.value.slice(activeElement.selectionStart, activeElement.selectionEnd);
  }

  return window.getSelection()?.toString() || '';
}

function isTextEditableRcaNode(node: RcaNode): boolean {
  return node.nodeType !== 'ISHIKAWA_CATEGORY';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
