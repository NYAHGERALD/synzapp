import * as Calendar from 'expo-calendar';
import type { SynzappCallEndReason } from '../services/callApi';
import type { SynzappCallHistoryStatus } from '../services/localCallStore';
import { ActiveSynzappCall, SynzappCallDirection, SynzappCallStatus } from '../components/calls/SynzappCallOverlay';
import { ChatContact } from '../services/chatApi';
import { Platform } from 'react-native';
import { ScheduleCallDraft } from '../components/calls/ScheduleCallModal';
import { detectCallingCode, getMaxNationalDigitsForCallingCode } from '../components/calls/CallKeypadModal';

/**
 * Call signalling, scheduling and keypad rules.
 *
 * Lifted out of the chat screen unchanged.
 */

export function isFinalSynzappCallHistoryStatus(status: SynzappCallHistoryStatus): boolean {
  return status === 'answered' ||
    status === 'busy' ||
    status === 'canceled' ||
    status === 'declined' ||
    status === 'ended' ||
    status === 'failed' ||
    status === 'missed';
}

export function getSynzappCallHistoryStatusFromEndReason(
  reason: SynzappCallEndReason,
  direction: SynzappCallDirection,
  activeStatus: SynzappCallStatus
): SynzappCallHistoryStatus {
  if (reason === 'busy' || reason === 'declined' || reason === 'failed' || reason === 'missed') {
    return reason;
  }

  if (activeStatus === 'ringing') {
    return direction === 'incoming' ? 'missed' : 'canceled';
  }

  return 'ended';
}

export function createScheduleCallDraft(profileName: string | null): ScheduleCallDraft {
  const startsAt = roundDateToNextHalfHour(new Date(Date.now() + 30 * 60 * 1000));
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  const ownerName = profileName?.trim();

  return {
    calendarAddedAt: null,
    calendarEventId: null,
    callType: 'video',
    description: '',
    endsAt,
    id: `scheduled-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    includeEndTime: true,
    reminderMinutes: 15,
    requireApproval: false,
    startsAt,
    title: ownerName ? `${ownerName}'s call` : 'Synzapp call'
  };
}

export function normalizeScheduleCallDraft(draft: ScheduleCallDraft): ScheduleCallDraft {
  const startsAt = new Date(draft.startsAt);
  const minimumEndAt = new Date(startsAt.getTime() + 15 * 60 * 1000);
  const endsAt = draft.endsAt.getTime() <= startsAt.getTime() ? minimumEndAt : draft.endsAt;

  return {
    ...draft,
    description: draft.description.slice(0, 2048),
    endsAt,
    startsAt
  };
}

export function getScheduleCallValidationError(draft: ScheduleCallDraft): string | null {
  const title = draft.title.trim();
  const startsAt = new Date(draft.startsAt);
  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (!title) {
    return 'Add a short title before continuing.';
  }

  if (Number.isNaN(startsAt.getTime())) {
    return 'Choose a valid start time for this call.';
  }

  if (startsAt.getTime() < now.getTime() - 60 * 1000) {
    return 'Choose a future start time for this call.';
  }

  if (startsAt.getTime() > oneYearFromNow.getTime()) {
    return 'Scheduled calls can be created up to one year in advance.';
  }

  return null;
}

export function buildScheduleCallCalendarEventData(
  draft: ScheduleCallDraft,
  recipients: ChatContact[]
): Omit<Partial<Calendar.Event>, 'id'> {
  const title = draft.title.trim() || 'Synzapp call';
  const startsAt = new Date(draft.startsAt);
  const endsAt = draft.includeEndTime
    ? new Date(draft.endsAt)
    : new Date(startsAt.getTime() + 30 * 60 * 1000);
  const safeEndsAt = endsAt.getTime() > startsAt.getTime()
    ? endsAt
    : new Date(startsAt.getTime() + 30 * 60 * 1000);
  const timeZone = getDeviceTimeZone();
  const notes = buildScheduleCallCalendarNotes(draft, recipients);

  return {
    alarms: draft.reminderMinutes > 0
      ? [{ method: Calendar.AlarmMethod.DEFAULT, relativeOffset: -draft.reminderMinutes }]
      : [],
    endDate: safeEndsAt,
    endTimeZone: timeZone,
    notes,
    startDate: startsAt,
    timeZone,
    title
  };
}

export function buildScheduleCallCalendarNotes(draft: ScheduleCallDraft, recipients: ChatContact[]): string {
  const details = [
    'Synzapp scheduled workplace call.',
    `Call type: ${draft.callType === 'video' ? 'Video' : 'Voice'}`,
    draft.requireApproval ? 'Approval is required to join.' : 'Approved participants can join from Synzapp.',
    recipients.length ? `Recipients: ${recipients.map((contact) => contact.displayName).join(', ')}` : '',
    draft.description.trim()
  ].filter(Boolean);

  return details.join('\n\n');
}

export function getDeviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function roundDateToNextHalfHour(date: Date): Date {
  const nextDate = new Date(date);
  const minutes = nextDate.getMinutes();
  const roundedMinutes = minutes <= 30 ? 30 : 60;

  nextDate.setMinutes(roundedMinutes, 0, 0);

  return nextDate;
}

export function getNextCallKeypadInput(currentValue: string, nextValue: string): string {
  if (nextValue === '+') {
    return addPlusToCallKeypadInput(currentValue);
  }

  if (!/^\d$/.test(nextValue)) {
    return currentValue.length >= 24 ? currentValue : `${currentValue}${nextValue}`;
  }

  return limitCallKeypadInput(`${currentValue}${nextValue}`);
}

export function addPlusToCallKeypadInput(value: string): string {
  if (value.startsWith('+')) {
    return value;
  }

  return `+${value.replace(/\+/g, '')}`;
}

export function limitCallKeypadInput(value: string): string {
  if (/[#*]/.test(value)) {
    return value.slice(0, 24);
  }

  const hasPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');

  if (!hasPlus) {
    return digits.startsWith('1')
      ? digits.slice(0, 11)
      : digits.slice(0, 10);
  }

  const callingCode = detectCallingCode(digits);
  const maxDigits = callingCode
    ? callingCode.length + getMaxNationalDigitsForCallingCode(callingCode)
    : 15;
  const limitedDigits = digits.slice(0, Math.min(maxDigits, 15));

  return `${hasPlus ? '+' : ''}${limitedDigits}`;
}

export function createSynzappCallId(): string {
  const segment = (length: number) => Array.from({ length }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  return `${segment(8)}-${segment(4)}-4${segment(3)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${segment(3)}-${segment(12)}`;
}

export function getOptionalCallKeepRuntime(): any | null {
  if (Platform.OS === 'android') {
    return null;
  }

  try {
    const module = require('react-native-callkeep');

    return module?.default || module;
  } catch {
    return null;
  }
}

export function getOptionalInCallManagerRuntime(): any | null {
  try {
    const module = require('react-native-incall-manager');

    return module?.default || module;
  } catch {
    return null;
  }
}

export function shouldRenderSynzappCallOverlay(callState: ActiveSynzappCall | null): boolean {
  if (!callState) {
    return false;
  }

  return !(
    Platform.OS === 'ios' &&
    callState.direction === 'incoming' &&
    callState.status === 'ringing' &&
    callState.isNativePresented
  );
}

export function serializeSynzappCallSignalPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if ('toJSON' in payload && typeof (payload as { toJSON?: () => unknown }).toJSON === 'function') {
    return (payload as { toJSON: () => unknown }).toJSON();
  }

  return payload;
}

export function getNativeCallKeepEndReason(RNCallKeep: any, reason: SynzappCallEndReason): number {
  const endReasons = RNCallKeep?.CONSTANTS?.END_CALL_REASONS || {};

  if (reason === 'missed') {
    return endReasons.MISSED || endReasons.UNANSWERED || 6;
  }

  if (reason === 'failed') {
    return endReasons.FAILED || 1;
  }

  if (reason === 'declined' || reason === 'busy') {
    return endReasons.DECLINED_ELSEWHERE || endReasons.REMOTE_ENDED || 2;
  }

  return endReasons.REMOTE_ENDED || 2;
}

export function partitionCallSignals<T>(
  items: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const matchingItems: T[] = [];
  const remainingItems: T[] = [];

  items.forEach((item) => {
    if (predicate(item)) {
      matchingItems.push(item);
    } else {
      remainingItems.push(item);
    }
  });

  return [matchingItems, remainingItems];
}
