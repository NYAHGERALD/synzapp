import { getSynzappApiBaseUrl } from './config';
import {
  getAppCheckHeader,
  getSynzappFirebaseAuth
} from './firebase';

export interface LswContext {
  calendar: {
    startDate: string;
    startDateLabel: string;
    startDay: number;
    startMonth: number;
    startYear: number;
    weekOneStartsOn: string;
  };
  company: {
    companyName: string;
    tenantId: string;
  };
  department: {
    departmentId: string | null;
    name: string;
    status: string;
  };
  storageScope: {
    departmentId: string | null;
    tenantId: string;
    weekKey: string;
  };
  user: {
    displayName: string;
    role: string;
    roleName: string;
    uid: string;
  };
  week: {
    currentWeek: number;
    currentYear: number;
    isCurrentWeek: boolean;
    previewRows: LswWeekPreviewRow[];
    selectedWeek: number;
    selectedYear: number;
    todayIso: string;
    todayLabel: string;
    totalWeeksInYear: number;
    weekBeginning: string;
    weekBeginningLabel: string;
    weekEnding: string;
    weekEndingLabel: string;
  };
}

export interface LswWeekPreviewRow {
  endDate: string;
  endDateLabel: string;
  startDate: string;
  startDateLabel: string;
  week: number;
}

interface LswContextOptions {
  week?: number;
  year?: number;
}

export async function getLswContext(options: LswContextOptions = {}): Promise<LswContext> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const params = new URLSearchParams();

  if (typeof options.week === 'number') {
    params.set('week', String(options.week));
  }

  if (typeof options.year === 'number') {
    params.set('year', String(options.year));
  }

  const queryString = params.toString();
  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;

  try {
    response = await fetch(`${getSynzappApiBaseUrl()}/api/lsw/context${queryString ? `?${queryString}` : ''}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...await getAppCheckHeader()
      },
      method: 'GET',
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The LSW workspace took too long to load. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'The LSW workspace could not be loaded.'));
  }

  const body = await response.json() as { context?: LswContext };

  if (!body.context) {
    throw new Error('The LSW workspace could not be loaded.');
  }

  return body.context;
}

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
