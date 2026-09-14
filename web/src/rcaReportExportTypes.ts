/**
 * The shapes an RCA report is exported from.
 *
 * Separated so the deck builder can be run and tested outside a browser,
 * without pulling in the workspace it is normally called from.
 */

export interface RcaReportExportEvidence {
  fileName: string;
  fileUrl: string;
  key: string;
  uploadedAt: string;
}

export interface RcaReportExportNode {
  evidence: RcaReportExportEvidence[];
  fields: Array<{ label: string; value: string }>;
  id: string;
  status: string;
  title: string;
  type: string;
}

export interface RcaReportExportSection {
  nodes: RcaReportExportNode[];
  subtitle: string;
  title: string;
}

export interface RcaReportExportPayload {
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
