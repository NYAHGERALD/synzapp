/**
 * SCOPE: NOT PART OF SYNZAPP CHAT. DO NOT REFACTOR AS PART OF CHAT WORK.
 *
 * The Interpreter is a separate, working subsystem. It is deliberately excluded
 * from the chat decomposition in
 * SYNZAPP_ENTERPRISE_PARITY_AND_HARDENING_PLAN.md, including that plan's
 * "no file over 3,000 lines" target — that target applies to the chat surface,
 * not here.
 *
 * This file was split into separate modules once by mistake, on the reasoning
 * that the line target applied everywhere. It left the Interpreter unable to
 * compile and had to be reversed. There is no test coverage here to catch that
 * class of error, so size alone is never a reason to restructure this file.
 *
 * Changes here should come from Interpreter requirements, and nothing else.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ActionSheetIOS,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Defs, Line, LinearGradient, Stop } from 'react-native-svg';
import {
  setIsAudioActiveAsync,
  setAudioModeAsync,
  type AudioMode,
  useAudioPlayer,
  useAudioPlayerStatus
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import SynzappAudioSession from 'synzapp-audio-session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import {
  addInterpreterTranscriptSegment,
  createInterpreterMeeting,
  createInterpreterRealtimeSdpAnswer,
  createInterpreterSummary,
  createInterpreterSummaryAudio,
  createInterpreterTranslationReplayAudio,
  createInterpreterVoicePreviewAudio,
  deleteInterpreterMeeting,
  deleteInterpreterTranscriptSegments,
  endInterpreterMeeting,
  getInterpreterMeeting,
  InterpreterLanguage,
  InterpreterMeeting,
  InterpreterMeetingDetails,
  InterpreterParticipant,
  InterpreterSegmentAudio,
  InterpreterSummaryAudio,
  InterpreterMeetingType,
  InterpreterTranscriptAudioArtifact,
  InterpreterTranscriptLibraryItem,
  InterpreterVoiceProfile,
  InterpreterVoicePreviewAudio,
  listInterpreterTranscriptLibrary,
  listInterpreterMeetings,
  listInterpreterParticipants,
  lookupInterpreterApprovedKnowledge,
  prepareInterpreterTranscriptAudio,
  startInterpreterMeeting,
  updateInterpreterMeetingInvitations,
  updateInterpreterMeetingLanguages,
  updateInterpreterMeetingVoice
} from '../services/interpreterApi';
import {
  getInterpreterAudioReadiness,
  InterpreterAudioReadiness,
  InterpreterRemoteAudioActivity,
  InterpreterRealtimeMediaDevice,
  InterpreterRealtimeSession,
  InterpreterRealtimeStatus,
  listInterpreterRealtimeAudioDevices,
  requestInterpreterAudioReadiness,
  startInterpreterRealtimeSession
} from '../services/interpreterRealtime';
import { AppSwitch } from '../components/ui/AppSwitch';

interface InterpreterScreenProps {
  getIdToken: () => Promise<string>;
  onRoomActiveChange?: (isActive: boolean) => void;
}

export type InterpreterCreateDraft = {
  autoDetectSourceLanguage: boolean;
  interpreterVoiceId: string | null;
  invitedUserIds: string[];
  isScheduled: boolean;
  languageCodes: string[];
  meetingName: string;
  meetingType: InterpreterMeetingType;
  reminderEnabled: boolean;
  reminderFrequency: 'once' | 'daily' | 'weekly';
  reminderLeadMinutes: number | null;
  scheduledAtIso: string | null;
  sourceLanguageCode: string | null;
  timeFormat: '12h' | '24h';
};

export const DEFAULT_LANGUAGE_CODES = ['en-US', 'es-MX'];
export const DEFAULT_INTERPRETER_VOICE_ID = 'cedar';
export const FALLBACK_INTERPRETER_VOICES: InterpreterVoiceProfile[] = [
  { id: 'cedar', label: 'Cedar', description: 'Calm executive interpreter for workplace conversations.' },
  { id: 'marin', label: 'Marin', description: 'Clear multilingual facilitator for mixed teams.' },
  { id: 'coral', label: 'Coral', description: 'Warm natural interpreter for coaching and 1-on-1s.' },
  { id: 'sage', label: 'Sage', description: 'Measured enterprise voice for sensitive meetings.' },
  { id: 'verse', label: 'Verse', description: 'Expressive interpreter for training and standups.' },
  { id: 'ash', label: 'Ash', description: 'Neutral operations voice for daily production meetings.' },
  { id: 'shimmer', label: 'Shimmer', description: 'Smooth voice for service and people-focused conversations.' }
];
export const REMINDER_LEAD_MINUTES = [5, 10, 15, 30, 60, 120, 1440];
export const REMINDER_FREQUENCIES: Array<InterpreterCreateDraft['reminderFrequency']> = ['once', 'daily', 'weekly'];
const INTERPRETER_SPEAKER_AUDIO_MODE: AudioMode = {
  allowsBackgroundRecording: false,
  allowsRecording: false,
  interruptionMode: 'duckOthers',
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false
};
const INTERPRETER_LISTENING_AUDIO_MODE: AudioMode = {
  allowsBackgroundRecording: true,
  allowsRecording: true,
  interruptionMode: 'duckOthers',
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false
};
const INTERPRETER_SUMMARY_AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory || ''}synzapp-interpreter-summaries/`;
const INTERPRETER_SEGMENT_AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory || ''}synzapp-interpreter-segments/`;
export const INTERPRETER_TRANSCRIPT_AUDIO_SHARE_DIR = `${FileSystem.cacheDirectory || ''}synzapp-interpreter-transcript-audio/`;
const INTERPRETER_VOICE_PREVIEW_AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory || ''}synzapp-interpreter-voices/`;
export const INTERPRETER_MAX_RESPONSE_LANGUAGES = 4;
export const INTERPRETER_CONTROLLED_VOICE_SESSION_KEY = '__synzapp_controlled_voice__';
export const INTERPRETER_TRANSCRIPT_SAVE_SETTLE_MS = 900;
export const INTERPRETER_TRANSCRIPT_SAVE_POLL_MS = 180;
export const INTERPRETER_TRANSCRIPT_SAVE_MAX_WAIT_MS = 2200;
const INTERPRETER_CREATE_RECOVERY_REFRESH_MS = 7000;
export const INTERPRETER_TRANSCRIPT_AUDIO_PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];
export const INTERPRETER_TRANSCRIPT_LIBRARY_SUMMARY_VERSION_ID = 'saved-transcripts';
type InterpreterRealtimeSessionMode = 'controlled_voice' | 'translation' | 'voice_agent';

export type InterpreterMeetingCreatedDateFilter = 'all' | 'last_7_days' | 'last_30_days' | 'today';
export type InterpreterMeetingTypeFilter = 'ALL' | InterpreterMeetingType;

export type InterpreterMeetingListFilters = {
  createdDate: InterpreterMeetingCreatedDateFilter;
  meetingType: InterpreterMeetingTypeFilter;
  nameQuery: string;
};

export const DEFAULT_INTERPRETER_MEETING_FILTERS: InterpreterMeetingListFilters = {
  createdDate: 'all',
  meetingType: 'ALL',
  nameQuery: ''
};

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
export const ROOM_SETTINGS_ICON_NAME: IoniconName = Platform.OS === 'ios' ? 'options-outline' : 'settings-outline';

export type InterpreterLanguageSessionState = {
  status: InterpreterRealtimeStatus;
  transcript: string;
  translation: string;
  versionId?: string;
};

export type InterpreterLiveMode = 'idle' | 'connecting' | 'listening' | 'choosing' | 'responding';

export type InterpreterLiveVersionStatus = 'connecting' | 'listening' | 'ready' | 'responding' | 'stopped' | 'ended' | 'error';

export type InterpreterTranscriptLibraryFilter = 'all' | 'ready' | 'preparing' | 'needs_audio';

export type InterpreterTranscriptAudioPlayerContext = {
  artifact: InterpreterTranscriptAudioArtifact;
  audioKey: string;
  item: InterpreterTranscriptLibraryItem;
  languageCode: string;
  languageLabel: string;
};

export type InterpreterTranscriptAudioPlayerMode = 'expanded' | 'minimized';

export type InterpreterLiveVersion = {
  createdAtIso: string;
  endedAtIso?: string;
  selectedLanguageCode: string;
  sequence: number;
  sourceTranscript: string;
  status: InterpreterLiveVersionStatus;
  translationsByLanguage: Record<string, string>;
  versionId: string;
};

export type InterpreterLiveHistoryItem = {
  createdAtIso: string;
  languageCode: string;
  sourceText: string;
  translatedText: string;
  translationId?: string;
  versionId?: string;
};

export type InterpreterAudioSignalBadge = {
  backgroundColor: string;
  iconName: IoniconName;
  label: string;
  textColor: string;
};

type InterpreterNativeAudioSessionMode = 'idle' | 'media' | 'realtime';

let interpreterNativeAudioSessionMode: InterpreterNativeAudioSessionMode = 'idle';
/**
 * Set when playback takes the audio session away from the live interpreter.
 *
 * Playing a saved recording or a summary rebuilds the session as playback-only,
 * which tears down the microphone input WebRTC was capturing through. Turning
 * the track back on afterwards does not restore it — the input is gone, so the
 * screen says "Listening" while nothing is heard.
 *
 * The next listening turn has to rebuild the session rather than resume it.
 */
let interpreterLiveSessionNeedsRebuild = false;

export function markInterpreterLiveSessionForRebuild(): void {
  interpreterLiveSessionNeedsRebuild = true;
}

export function consumeInterpreterLiveSessionRebuildFlag(): boolean {
  const needsRebuild = interpreterLiveSessionNeedsRebuild;

  interpreterLiveSessionNeedsRebuild = false;

  return needsRebuild;
}
let interpreterWebRtcRouteActive = false;
let interpreterWebRtcRouteName: InterpreterAudioOutputRoute | null = null;
let interpreterWebRtcRouteAppliedAtMs = 0;

export type InterpreterAudioOutputRoute = 'bluetooth' | 'speaker' | 'system';

type InterpreterSummaryVersionMetadata = {
  versionId?: string | null;
  versionSequence?: number | null;
};

type InterpreterSummaryCreateResult = {
  summary: InterpreterMeetingDetails['summaries'][number];
  summaryAudioByLanguage?: Record<string, InterpreterSummaryAudio>;
};

export function InterpreterScreen({ getIdToken, onRoomActiveChange }: InterpreterScreenProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [meetings, setMeetings] = useState<InterpreterMeeting[]>([]);
  const [languages, setLanguages] = useState<InterpreterLanguage[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<InterpreterVoiceProfile[]>(FALLBACK_INTERPRETER_VOICES);
  const [participants, setParticipants] = useState<InterpreterParticipant[]>([]);
  const [selectedMeetingDetails, setSelectedMeetingDetails] = useState<InterpreterMeetingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [creatingMeetingLabel, setCreatingMeetingLabel] = useState<string | null>(null);
  const [isMeetingSearchOpen, setIsMeetingSearchOpen] = useState(false);
  const [meetingSearchQuery, setMeetingSearchQuery] = useState('');
  const [meetingFilters, setMeetingFilters] =
    useState<InterpreterMeetingListFilters>(DEFAULT_INTERPRETER_MEETING_FILTERS);
  const [isMeetingFilterOpen, setIsMeetingFilterOpen] = useState(false);
  const [isMeetingDeleteMode, setIsMeetingDeleteMode] = useState(false);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);
  const isRoomActive = Boolean(selectedMeetingDetails);
  const filteredMeetings = useMemo(
    () => meetings.filter((meeting) =>
      doesInterpreterMeetingMatchListControls(meeting, meetingFilters, meetingSearchQuery)
    ),
    [meetingFilters, meetingSearchQuery, meetings]
  );
  const filteredMeetingIds = useMemo(
    () => filteredMeetings.map((meeting) => meeting.meetingId),
    [filteredMeetings]
  );
  const selectedMeetingIdSet = useMemo(() => new Set(selectedMeetingIds), [selectedMeetingIds]);
  const isAllVisibleMeetingsSelected = Boolean(
    filteredMeetingIds.length && filteredMeetingIds.every((meetingId) => selectedMeetingIdSet.has(meetingId))
  );
  const hasActiveMeetingFilters = hasInterpreterMeetingListFilters(meetingFilters);
  const hasActiveMeetingSearch = Boolean(meetingSearchQuery.trim());

  const showInterpreterError = useCallback((message: string, title = 'Interpreter needs attention') => {
    Alert.alert(title, message);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);

    try {
      const idToken = await getIdToken();
      const result = await listInterpreterMeetings(idToken);
      const participantResult = await listInterpreterParticipants(idToken).catch((error) => {
        console.warn('Interpreter participant directory unavailable:', getErrorMessage(error));
        return { participants: [] };
      });

      setMeetings(result.meetings);
      setLanguages(result.supportedLanguages);
      setVoiceProfiles(result.supportedVoices?.length ? result.supportedVoices : FALLBACK_INTERPRETER_VOICES);
      setParticipants(participantResult.participants);
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken, showInterpreterError]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    onRoomActiveChange?.(isRoomActive);

    return () => {
      onRoomActiveChange?.(false);
    };
  }, [isRoomActive, onRoomActiveChange]);

  useEffect(() => {
    setSelectedMeetingIds((currentIds) => currentIds.filter((meetingId) => filteredMeetingIds.includes(meetingId)));
  }, [filteredMeetingIds]);

  async function handleCreateMeeting(input: InterpreterCreateDraft) {
    if (isCreatingMeeting) {
      return;
    }

    const meetingName = input.meetingName.trim();

    setIsCreatingMeeting(true);
    setCreatingMeetingLabel(meetingName);
    setIsCreateOpen(false);

    const recoveryRefreshId = setTimeout(() => {
      void loadWorkspace();
    }, INTERPRETER_CREATE_RECOVERY_REFRESH_MS);

    try {
      const idToken = await getIdToken();
      const result = await createInterpreterMeeting(idToken, {
        autoDetectSourceLanguage: input.autoDetectSourceLanguage,
        interpreterVoiceId: input.interpreterVoiceId,
        invitedUserIds: input.invitedUserIds,
        interpreterLanguageCodes: input.languageCodes,
        meetingName,
        meetingType: input.meetingType,
        reminderFrequency: input.isScheduled && input.reminderEnabled ? input.reminderFrequency : 'none',
        reminderLeadMinutes: input.isScheduled && input.reminderEnabled ? input.reminderLeadMinutes : null,
        scheduledAtIso: input.isScheduled && input.scheduledAtIso ? input.scheduledAtIso : null,
        sourceLanguageCode: input.autoDetectSourceLanguage ? null : input.sourceLanguageCode
      });

      setMeetings((currentMeetings) => {
        if (currentMeetings.some((meeting) => meeting.meetingId === result.meeting.meetingId)) {
          return currentMeetings.map((meeting) =>
            meeting.meetingId === result.meeting.meetingId ? result.meeting : meeting
          );
        }

        return [result.meeting, ...currentMeetings];
      });
      void loadWorkspace();
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      clearTimeout(recoveryRefreshId);
      setIsCreatingMeeting(false);
      setCreatingMeetingLabel(null);
    }
  }

  async function handleOpenMeeting(meetingId: string) {
    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const details = await getInterpreterMeeting(idToken, meetingId);

      setSelectedMeetingDetails(details);
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
      throw error;
    } finally {
      setIsBusy(false);
    }
  }

  function handleDeleteMeeting(meeting: InterpreterMeeting) {
    Alert.alert(
      'Delete interpreter session?',
      `${meeting.meetingName} will be removed from the interpreter workspace. Meeting memory and audit history stay retained by tenant policy.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void runDeleteMeeting(meeting),
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
  }

  async function runDeleteMeeting(meeting: InterpreterMeeting) {
    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      await deleteInterpreterMeeting(idToken, meeting.meetingId);
      setMeetings((currentMeetings) => currentMeetings.filter((currentMeeting) =>
        currentMeeting.meetingId !== meeting.meetingId
      ));
      setSelectedMeetingDetails((currentDetails) =>
        currentDetails?.meeting.meetingId === meeting.meetingId ? null : currentDetails
      );
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  function openInterpreterListOptions() {
    const searchOption = isMeetingSearchOpen ? 'Hide search' : 'Search';
    const filterOption = hasActiveMeetingFilters ? 'Edit filters' : 'Filter';
    const deleteOption = isMeetingDeleteMode ? 'Cancel delete mode' : 'Delete sessions';
    const cancelOption = 'Cancel';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 3,
          destructiveButtonIndex: isMeetingDeleteMode ? undefined : 2,
          disabledButtonIndices: meetings.length ? [] : [2],
          options: [searchOption, filterOption, deleteOption, cancelOption],
          title: 'Interpreter sessions'
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            setIsMeetingSearchOpen((currentValue) => !currentValue);
            return;
          }

          if (buttonIndex === 1) {
            setIsMeetingFilterOpen(true);
            return;
          }

          if (buttonIndex === 2) {
            toggleMeetingDeleteMode();
          }
        }
      );
      return;
    }

    Alert.alert('Interpreter sessions', 'Choose an action.', [
      { onPress: () => setIsMeetingSearchOpen((currentValue) => !currentValue), text: searchOption },
      { onPress: () => setIsMeetingFilterOpen(true), text: filterOption },
      { onPress: toggleMeetingDeleteMode, style: isMeetingDeleteMode ? 'default' : 'destructive', text: deleteOption },
      { style: 'cancel', text: cancelOption }
    ]);
  }

  function toggleMeetingDeleteMode() {
    if (!meetings.length) {
      Alert.alert('No interpreter sessions', 'There are no interpreter sessions to delete yet.');
      return;
    }

    setIsMeetingDeleteMode((currentValue) => {
      const nextValue = !currentValue;

      if (!nextValue) {
        setSelectedMeetingIds([]);
      }

      return nextValue;
    });
  }

  function toggleMeetingSelection(meetingId: string) {
    setSelectedMeetingIds((currentIds) =>
      currentIds.includes(meetingId)
        ? currentIds.filter((currentId) => currentId !== meetingId)
        : [...currentIds, meetingId]
    );
  }

  function toggleSelectAllVisibleMeetings() {
    if (isAllVisibleMeetingsSelected) {
      setSelectedMeetingIds((currentIds) =>
        currentIds.filter((meetingId) => !filteredMeetingIds.includes(meetingId))
      );
      return;
    }

    setSelectedMeetingIds((currentIds) => [...new Set([...currentIds, ...filteredMeetingIds])]);
  }

  function confirmDeleteSelectedMeetings() {
    if (!selectedMeetingIds.length || isBusy) {
      return;
    }

    Alert.alert(
      'Delete interpreter sessions?',
      `${selectedMeetingIds.length} interpreter session${selectedMeetingIds.length === 1 ? '' : 's'} will be removed from this list. Live sessions must be ended before they can be deleted.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void runDeleteSelectedMeetings(),
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
  }

  async function runDeleteSelectedMeetings() {
    const meetingIdsToDelete = [...selectedMeetingIds];

    if (!meetingIdsToDelete.length) {
      return;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const settledResults = await Promise.allSettled(
        meetingIdsToDelete.map((meetingId) => deleteInterpreterMeeting(idToken, meetingId))
      );
      const deletedMeetingIds = new Set<string>();
      const failedMessages: string[] = [];

      settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          deletedMeetingIds.add(meetingIdsToDelete[index]);
          return;
        }

        failedMessages.push(getErrorMessage(result.reason));
      });

      if (deletedMeetingIds.size) {
        setMeetings((currentMeetings) => currentMeetings.filter((meeting) => !deletedMeetingIds.has(meeting.meetingId)));
        setSelectedMeetingIds((currentIds) => currentIds.filter((meetingId) => !deletedMeetingIds.has(meetingId)));
        setSelectedMeetingDetails((currentDetails) =>
          currentDetails && deletedMeetingIds.has(currentDetails.meeting.meetingId) ? null : currentDetails
        );
      }

      if (!failedMessages.length) {
        setIsMeetingDeleteMode(false);
        setSelectedMeetingIds([]);
        return;
      }

      showInterpreterError([...new Set(failedMessages)].join('\n'), 'Some sessions could not be deleted');
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateRealtimeSdpAnswer(
    targetLanguageCode: string,
    offerSdp: string,
    sessionMode: InterpreterRealtimeSessionMode = 'controlled_voice'
  ) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return null;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const started = meeting.status === 'LIVE'
        ? { meeting }
        : await startInterpreterMeeting(idToken, meeting.meetingId);
      const realtime = await createInterpreterRealtimeSdpAnswer(idToken, meeting.meetingId, {
        offerSdp,
        targetLanguageCode,
        sessionMode
      });

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? {
            ...currentDetails,
            meeting: started.meeting
          }
        : currentDetails);
      setMeetings((currentMeetings) => currentMeetings.map((currentMeeting) =>
        currentMeeting.meetingId === started.meeting.meetingId ? started.meeting : currentMeeting
      ));

      return realtime.answerSdp;
    } catch (error) {
      throw error;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEndMeeting() {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await endInterpreterMeeting(idToken, meeting.meetingId);

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? { ...currentDetails, meeting: result.meeting }
        : currentDetails);
      setMeetings((currentMeetings) => currentMeetings.map((currentMeeting) =>
        currentMeeting.meetingId === result.meeting.meetingId ? result.meeting : currentMeeting
      ));
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpdateInvitations(invitedUserIds: string[]) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await updateInterpreterMeetingInvitations(idToken, meeting.meetingId, invitedUserIds);

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? { ...currentDetails, meeting: result.meeting }
        : currentDetails);
      setMeetings((currentMeetings) => currentMeetings.map((currentMeeting) =>
        currentMeeting.meetingId === result.meeting.meetingId ? result.meeting : currentMeeting
      ));
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpdateMeetingLanguages(interpreterLanguageCodes: string[]) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await updateInterpreterMeetingLanguages(idToken, meeting.meetingId, interpreterLanguageCodes);

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? { ...currentDetails, meeting: result.meeting }
        : currentDetails);
      setMeetings((currentMeetings) => currentMeetings.map((currentMeeting) =>
        currentMeeting.meetingId === result.meeting.meetingId ? result.meeting : currentMeeting
      ));
    } catch (error) {
      showInterpreterError(getErrorMessage(error), 'Interpreter languages need attention');
      throw error;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpdateMeetingVoice(interpreterVoiceId: string) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await updateInterpreterMeetingVoice(idToken, meeting.meetingId, interpreterVoiceId);

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? { ...currentDetails, meeting: result.meeting }
        : currentDetails);
      setMeetings((currentMeetings) => currentMeetings.map((currentMeeting) =>
        currentMeeting.meetingId === result.meeting.meetingId ? result.meeting : currentMeeting
      ));
    } catch (error) {
      showInterpreterError(getErrorMessage(error), 'Speaker selection needs attention');
      throw error;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateSummary(
    languageCodes: string[],
    transcriptText?: string | null,
    version?: InterpreterSummaryVersionMetadata
  ) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return null;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await createInterpreterSummary(
        idToken,
        meeting.meetingId,
        languageCodes,
        transcriptText,
        version
      );

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? {
            ...currentDetails,
            summaries: [result.summary, ...currentDetails.summaries]
          }
        : currentDetails);

      return result;
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  if (selectedMeetingDetails) {
    return (
      <InterpreterRoom
        details={selectedMeetingDetails}
        getIdToken={getIdToken}
        isBusy={isBusy}
        onBack={() => setSelectedMeetingDetails(null)}
        onCreateSummary={handleCreateSummary}
        onEndMeeting={handleEndMeeting}
        onError={showInterpreterError}
        onCreateRealtimeSdpAnswer={handleCreateRealtimeSdpAnswer}
        onUpdateLanguages={handleUpdateMeetingLanguages}
        onUpdateInvitations={handleUpdateInvitations}
        onUpdateVoice={handleUpdateMeetingVoice}
        languages={languages}
        participants={participants}
        voiceProfiles={voiceProfiles}
      />
    );
  }

  return (
    <View
      style={[
        styles.screen,
        styles.workspaceScreen,
        {
          paddingBottom: Math.max(insets.bottom + 106, 124),
          paddingTop: Math.max(insets.top + 2, 14)
        }
      ]}
    >
      <View style={styles.workspaceHeader}>
        <View style={styles.workspaceHeaderSpacer} />
        <Text style={styles.workspaceTitle}>Interpreter</Text>
        <Pressable
          accessibilityLabel="Interpreter session options"
          disabled={isBusy}
          onPress={openInterpreterListOptions}
          style={({ pressed }) => [
            styles.workspaceOptionsButton,
            (hasActiveMeetingFilters || hasActiveMeetingSearch || isMeetingDeleteMode) && styles.workspaceOptionsButtonActive,
            pressed && styles.pressed
          ]}
        >
          <Ionicons
            color={(hasActiveMeetingFilters || hasActiveMeetingSearch || isMeetingDeleteMode)
              ? appTheme.colors.primary
              : appTheme.colors.ink}
            name="ellipsis-horizontal"
            size={22}
          />
        </Pressable>
      </View>

      {isMeetingSearchOpen ? (
        <View style={styles.meetingSearchBar}>
          <Ionicons color={appTheme.colors.mutedStrong} name="search-outline" size={18} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setMeetingSearchQuery}
            placeholder="Search by name or meeting type"
            placeholderTextColor={appTheme.colors.mutedStrong}
            style={styles.meetingSearchInput}
            value={meetingSearchQuery}
          />
          {meetingSearchQuery.trim() ? (
            <Pressable
              accessibilityLabel="Clear interpreter search"
              hitSlop={8}
              onPress={() => setMeetingSearchQuery('')}
            >
              <Ionicons color={appTheme.colors.mutedStrong} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isMeetingDeleteMode ? (
        <View style={styles.meetingSelectionToolbar}>
          <TranscriptLibraryCheckbox
            isChecked={isAllVisibleMeetingsSelected}
            isDisabled={!filteredMeetingIds.length}
            label="Select all"
            onPress={toggleSelectAllVisibleMeetings}
            styles={styles}
          />
          {selectedMeetingIds.length ? (
            <Pressable
              disabled={isBusy}
              onPress={confirmDeleteSelectedMeetings}
              style={({ pressed }) => [
                styles.meetingBulkDeleteButton,
                isBusy && styles.disabledButton,
                pressed && styles.pressed
              ]}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons color="#fff" name="trash-outline" size={15} />
              )}
              <Text style={styles.meetingBulkDeleteText}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isCreatingMeeting && creatingMeetingLabel ? (
        <View style={styles.meetingCreatePendingCard}>
          <ActivityIndicator color={appTheme.colors.primary} size="small" />
          <View style={styles.meetingCreatePendingCopy}>
            <Text style={styles.meetingCreatePendingTitle}>{creatingMeetingLabel}</Text>
            <Text style={styles.meetingCreatePendingMeta}>Creating session...</Text>
          </View>
        </View>
      ) : null}

	      {meetings.length ? (
	        <ScrollView
	          alwaysBounceVertical={false}
	          bounces={false}
	          contentContainerStyle={styles.listContent}
	          directionalLockEnabled
	          overScrollMode="never"
	          showsVerticalScrollIndicator={false}
	        >
          {filteredMeetings.length ? filteredMeetings.map((meeting) => (
            <InterpreterMeetingSwipeRow
              key={meeting.meetingId}
              disabled={isBusy}
              isDeleteMode={isMeetingDeleteMode}
              isSelected={selectedMeetingIdSet.has(meeting.meetingId)}
              meeting={meeting}
              onDelete={handleDeleteMeeting}
              onOpen={handleOpenMeeting}
              onToggleSelected={toggleMeetingSelection}
            />
          )) : (
            <View style={styles.emptyState}>
              <Ionicons color={appTheme.colors.mutedStrong} name="search-outline" size={34} />
              <Text style={styles.emptyTitle}>No sessions match</Text>
              <Text style={styles.mutedText}>Adjust search or filters to see more interpreter sessions.</Text>
            </View>
          )}
        </ScrollView>
      ) : !isLoading ? (
        <View style={styles.emptyState}>
          <Ionicons color={appTheme.colors.mutedStrong} name="mic-circle-outline" size={40} />
          <Text style={styles.emptyTitle}>No interpreter meetings yet</Text>
          <Text style={styles.mutedText}>Create a controlled meeting before starting live interpretation.</Text>
        </View>
      ) : (
        <View style={styles.quietWorkspaceFill} />
      )}

      <Pressable
        accessibilityLabel="Create interpreter meeting"
        disabled={isCreatingMeeting}
        onPress={() => setIsCreateOpen(true)}
        style={({ pressed }) => [
          styles.floatingCreateButton,
          { bottom: 18 },
          isCreatingMeeting && styles.disabledButton,
          pressed && styles.pressed
        ]}
      >
        {isCreatingMeeting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons color="#fff" name="add" size={26} />
        )}
      </Pressable>

      <InterpreterCreateModal
        getIdToken={getIdToken}
        isBusy={isCreatingMeeting}
        isOpen={isCreateOpen}
        languages={languages}
        onClose={() => setIsCreateOpen(false)}
        onError={showInterpreterError}
        onSubmit={handleCreateMeeting}
        voiceProfiles={voiceProfiles}
      />
      <InterpreterMeetingFilterModal
        filters={meetingFilters}
        isOpen={isMeetingFilterOpen}
        onApply={(nextFilters) => {
          setMeetingFilters(nextFilters);
          setIsMeetingFilterOpen(false);
        }}
        onClose={() => setIsMeetingFilterOpen(false)}
        onReset={() => setMeetingFilters(DEFAULT_INTERPRETER_MEETING_FILTERS)}
      />
    </View>
  );
}

export interface InterpreterRoomProps {
  details: InterpreterMeetingDetails;
  getIdToken: () => Promise<string>;
  isBusy: boolean;
  onBack: () => void;
  onCreateSummary: (
    languageCodes: string[],
    transcriptText?: string | null,
    version?: InterpreterSummaryVersionMetadata
  ) => Promise<InterpreterSummaryCreateResult | null>;
  onEndMeeting: () => Promise<void>;
  onError: (message: string, title?: string) => void;
  onCreateRealtimeSdpAnswer: (
    targetLanguageCode: string,
    offerSdp: string,
    sessionMode?: InterpreterRealtimeSessionMode
  ) => Promise<string | null>;
  onUpdateLanguages: (interpreterLanguageCodes: string[]) => Promise<void>;
  onUpdateInvitations: (invitedUserIds: string[]) => Promise<void>;
  onUpdateVoice: (interpreterVoiceId: string) => Promise<void>;
  languages: InterpreterLanguage[];
  participants: InterpreterParticipant[];
  voiceProfiles: InterpreterVoiceProfile[];
}

export interface InterpreterMeetingSwipeRowProps {
  disabled: boolean;
  isDeleteMode: boolean;
  isSelected: boolean;
  meeting: InterpreterMeeting;
  onDelete: (meeting: InterpreterMeeting) => void;
  onOpen: (meetingId: string) => Promise<void>;
  onToggleSelected: (meetingId: string) => void;
}

const INTERPRETER_SESSION_DELETE_WIDTH = 132;
export const INTERPRETER_SESSION_DELETE_TRIGGER = 94;
export const INTERPRETER_SESSION_HORIZONTAL_SWIPE_START = 24;
export const INTERPRETER_SESSION_HORIZONTAL_LOCK_RATIO = 2.4;

export interface InterpreterCreateModalProps {
  getIdToken: () => Promise<string>;
  isBusy: boolean;
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onError: (message: string, title?: string) => void;
  onSubmit: (input: InterpreterCreateDraft) => Promise<void>;
  voiceProfiles: InterpreterVoiceProfile[];
}

export interface InterpreterMeetingFilterModalProps {
  filters: InterpreterMeetingListFilters;
  isOpen: boolean;
  onApply: (filters: InterpreterMeetingListFilters) => void;
  onClose: () => void;
  onReset: () => void;
}

export interface InterpreterLiveRoomModalProps {
  activeHistoryAudioKey: string | null;
  audioLevel: number;
  availableLanguages: InterpreterLanguage[];
  detectedSourceLanguageCode: string | null;
  details: InterpreterMeetingDetails;
  hasReplayableInterpretationAudio: boolean;
  historyItems: InterpreterLiveHistoryItem[];
  isHistoryAudioPlaying: boolean;
  isInterpretationAudioPlaying: boolean;
  isPreparingInterpretationAudio: boolean;
  isHistoryOpen: boolean;
  isOpen: boolean;
  isTranscriptOpen: boolean;
  languageSessionState: Record<string, InterpreterLanguageSessionState>;
  liveCleanTranscript: string;
  liveVersions: InterpreterLiveVersion[];
  liveMode: InterpreterLiveMode;
  liveStatus: InterpreterRealtimeStatus;
  liveTranscript: string;
  liveTranslation: string;
  onClose: () => void;
  onEnd: () => void;
  onHistoryClose: () => void;
  onListen: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenSummary: () => void;
  onOpenTranscript: () => void;
  onOpenTranscriptLibrary: () => void;
  onPlayHistoryItem: (item: InterpreterLiveHistoryItem) => void;
  onReplayInterpretationAudio: () => void;
  activeInputName: string;
  liveNotice: string | null;
  onRespond: () => void;
  onSelectVersion: (versionId: string) => void;
  onToggleMicrophone: () => void;
  onTranscriptClose: () => void;
  preparingHistoryAudioKey: string | null;
  respondingLanguageCode: string | null;
  remoteAudioActivity: InterpreterRemoteAudioActivity | null;
  remoteAudioBaseline: InterpreterRemoteAudioActivity | null;
  remoteAudioStreamUrls: Record<string, string>;
  selectedLanguageCode: string;
  selectedLiveVersionId: string | null;
  onSelectTargetLanguage: (languageCode: string) => void;
  settingsPanel: React.ReactNode;
  summaryPanel: React.ReactNode;
  summaryCount: number;
  transcriptLibraryCount: number;
  transcriptLibraryPanel: React.ReactNode;
  voiceProfile: InterpreterVoiceProfile;
}

interface TranscriptLibraryCheckboxProps {
  isChecked: boolean;
  isDisabled?: boolean;
  label?: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

export function TranscriptLibraryCheckbox({
  isChecked,
  isDisabled = false,
  label,
  onPress,
  styles
}: TranscriptLibraryCheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked, disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={10}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [
        styles.transcriptCheckboxTouch,
        isDisabled && styles.transcriptCheckboxDisabled,
        pressed && styles.pressed
      ]}
    >
      <View style={[styles.transcriptCheckboxBox, isChecked && styles.transcriptCheckboxBoxChecked]}>
        {isChecked ? (
          <Ionicons color="#fff" name="checkmark" size={15} />
        ) : null}
      </View>
      {label ? (
        <Text style={styles.transcriptCheckboxLabel}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

export interface InterpreterLiveOutputLanguagePickerProps {
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onSelectLanguage: (languageCode: string) => void;
  selectedLanguageCode: string;
}

export interface InterpreterTranscriptLibraryModalProps {
  activeAudioKey: string | null;
  audioPlayerContext: InterpreterTranscriptAudioPlayerContext | null;
  audioPlayerDuration: number;
  audioPlayerMode: InterpreterTranscriptAudioPlayerMode;
  audioPlayerPosition: number;
  activeSummaryAudioKey: string | null;
  availableLanguages: InterpreterLanguage[];
  creatingSummaryLanguageCode: string | null;
  filter: InterpreterTranscriptLibraryFilter;
  isBusy: boolean;
  isAudioLoaded: boolean;
  isAudioPlaying: boolean;
  isAudioSharing: boolean;
  isLoading: boolean;
  isOpen: boolean;
  isSummaryAudioPlaying: boolean;
  items: InterpreterTranscriptLibraryItem[];
  meeting: InterpreterMeeting;
  onAudioPlaybackRateChange: (rate: number) => void;
  onAudioPlayerClose: () => void;
  onAudioPlayerExpand: () => void;
  onAudioPlayerMinimize: () => void;
  onAudioSeek: (seconds: number) => void;
  onAudioShare: () => void;
  onAudioSkip: (deltaSeconds: number) => void;
  onAudioTogglePlayback: () => void;
  onClose: () => void;
  onCreateSummary: (languageCode: string) => Promise<InterpreterSummaryCreateResult | null>;
  onDeleteTranscripts: (segmentIds: string[]) => Promise<void>;
  onFilterChange: (filter: InterpreterTranscriptLibraryFilter) => void;
  onPlayAudio: (item: InterpreterTranscriptLibraryItem) => void;
  onPlaySummary: (
    summary: InterpreterMeetingDetails['summaries'][number],
    languageCode: string
  ) => void;
  onPrepareAudio: (item: InterpreterTranscriptLibraryItem) => void;
  onRefresh: () => void;
  onSelectLanguage: (segmentId: string, languageCode: string) => void;
  onSummaryLanguageChange: (languageCode: string) => void;
  playbackRate: number;
  preparingAudioKey: string | null;
  preparingSummaryAudioKey: string | null;
  selectedLanguageBySegment: Record<string, string>;
  selectedSummaryLanguageCode: string;
  selectedTargetLanguageCode: string;
  summaries: InterpreterMeetingDetails['summaries'];
  voiceId: string;
}

interface InterpreterTranscriptAudioMiniPlayerProps {
  context: InterpreterTranscriptAudioPlayerContext;
  isPlaying: boolean;
  onClose: () => void;
  onExpand: () => void;
  onTogglePlayback: () => void;
  position: number;
}

export function InterpreterTranscriptAudioMiniPlayer({
  context,
  isPlaying,
  onClose,
  onExpand,
  onTogglePlayback,
  position
}: InterpreterTranscriptAudioMiniPlayerProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const title = (context.item.cleanedText || context.item.text || 'Saved transcript').trim();

  return (
    <View style={styles.transcriptAudioMiniPlayer}>
      <Pressable onPress={onExpand} style={({ pressed }) => [styles.transcriptAudioMiniCopy, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.transcriptAudioMiniTitle}>
          {context.languageLabel}
        </Text>
        <Text numberOfLines={1} style={styles.transcriptAudioMiniSubtitle}>
          {formatAudioDuration(position)}  {title}
        </Text>
      </Pressable>
      <Pressable onPress={onTogglePlayback} style={({ pressed }) => [styles.transcriptAudioMiniButton, pressed && styles.pressed]}>
        <Ionicons color="#fff" name={isPlaying ? 'pause' : 'play'} size={18} />
      </Pressable>
      <Pressable onPress={onClose} style={({ pressed }) => [styles.transcriptAudioMiniCloseButton, pressed && styles.pressed]}>
        <Ionicons color={appTheme.colors.mutedStrong} name="close" size={18} />
      </Pressable>
    </View>
  );
}

export interface InterpreterTranscriptAudioPlayerModalProps {
  context: InterpreterTranscriptAudioPlayerContext;
  duration: number;
  isOpen: boolean;
  isLoaded: boolean;
  isPlaying: boolean;
  isSharing: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onSeek: (seconds: number) => void;
  onShare: () => void;
  onSkip: (deltaSeconds: number) => void;
  onTogglePlayback: () => void;
  playbackRate: number;
  position: number;
}

export interface InterpreterTranscriptSummaryModalProps {
  activeSummaryAudioKey: string | null;
  availableLanguages: InterpreterLanguage[];
  creatingLanguageCode: string | null;
  isAudioPlaying: boolean;
  isBusy: boolean;
  isOpen: boolean;
  items: InterpreterTranscriptLibraryItem[];
  onClose: () => void;
  onCreateSummary: (languageCode: string) => Promise<InterpreterSummaryCreateResult | null>;
  onPlaySummary: (
    summary: InterpreterMeetingDetails['summaries'][number],
    languageCode: string
  ) => void;
  onSelectLanguage: (languageCode: string) => void;
  preparingSummaryAudioKey: string | null;
  selectedLanguageCode: string;
  summaries: InterpreterMeetingDetails['summaries'];
}

export interface InterpreterTranscriptAudioLanguagePickerProps {
  eyebrow?: string;
  hint?: string;
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onSelectLanguage: (languageCode: string) => void;
  selectedLanguageCode: string;
  title?: string;
}

export function InterpreterRemoteAudioSink({
  streamUrl,
  styles
}: {
  streamUrl: string | null;
  styles: ReturnType<typeof createStyles>;
}) {
  const RTCView = getOptionalInterpreterRtcView();

  if (!RTCView || !streamUrl) {
    return null;
  }

  return (
    <RTCView
      objectFit="cover"
      pointerEvents="none"
      streamURL={streamUrl}
      style={styles.remoteInterpreterAudioSink}
    />
  );
}

export function hasInterpreterRemoteAudioSignal(
  activity: InterpreterRemoteAudioActivity | null,
  baseline: InterpreterRemoteAudioActivity | null
): boolean {
  if (!activity?.hasRemoteTrack) {
    return false;
  }

  if (typeof activity.audioLevel === 'number' && activity.audioLevel > 0.004) {
    return true;
  }

  const packetsReceived = typeof activity.packetsReceived === 'number' ? activity.packetsReceived : null;
  const baselinePackets = typeof baseline?.packetsReceived === 'number' ? baseline.packetsReceived : null;
  const packetDelta = packetsReceived !== null
    ? Math.max(0, packetsReceived - (baselinePackets ?? 0))
    : 0;

  if (packetDelta >= 4) {
    return true;
  }

  const bytesReceived = typeof activity.bytesReceived === 'number' ? activity.bytesReceived : null;
  const baselineBytes = typeof baseline?.bytesReceived === 'number' ? baseline.bytesReceived : null;
  const byteDelta = bytesReceived !== null
    ? Math.max(0, bytesReceived - (baselineBytes ?? 0))
    : 0;

  return byteDelta >= 2048;
}

export interface InterpreterRoomSettingsPanelProps {
  activePreviewKey: string | null;
  details: InterpreterMeetingDetails;
  isBusy: boolean;
  isOpen: boolean;
  onClose: () => void;
  onPreviewVoice: (voice: InterpreterVoiceProfile) => void;
  onUpdateVoice: (interpreterVoiceId: string) => Promise<void>;
  preparingPreviewKey: string | null;
  previewLanguageCode: string;
  selectedVoiceId: string;
  voices: InterpreterVoiceProfile[];
}

export interface InterpreterAudioSpectrumProps {
  audioLevel: number;
  compact?: boolean;
  isPlaying: boolean;
  isPreparingOutput: boolean;
  isListening: boolean;
  outputAudioLevel: number;
}

export interface InterpreterSummaryLanguageModalProps {
  activeAudioKey: string | null;
  isAudioPlaying: boolean;
  isBusy: boolean;
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onError: (message: string, title?: string) => void;
  onPlaySummary: (
    summary: InterpreterMeetingDetails['summaries'][number],
    languageCode: string
  ) => void;
  onSubmit: (languageCodes: string[]) => void;
  preparingAudioKey: string | null;
  presentation?: 'modal' | 'overlay';
  selectedVersion: InterpreterLiveVersion | null;
  summaries: InterpreterMeetingDetails['summaries'];
}

interface InterpreterInlineOptionProps {
  iconName: IoniconName;
  label: string;
  onPress: () => void;
  value: string;
}

function InterpreterInlineOption({ iconName, label, onPress, value }: InterpreterInlineOptionProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.inlineOption, pressed && styles.pressed]}
    >
      <Ionicons color={appTheme.colors.primary} name={iconName} size={18} />
      <View style={styles.selectionBody}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <Text style={styles.selectionTitle}>{value}</Text>
      </View>
      <Ionicons color={appTheme.colors.mutedStrong} name="chevron-down-outline" size={18} />
    </Pressable>
  );
}

export interface InterpreterVoicePickerModalProps {
  activePreviewKey: string | null;
  isOpen: boolean;
  onClose: () => void;
  onPreview: (voice: InterpreterVoiceProfile) => void;
  onSelect: (voiceId: string) => void;
  preparingPreviewKey: string | null;
  previewLanguageCode: string;
  selectedVoiceId: string;
  voices: InterpreterVoiceProfile[];
}

interface InterpreterOptionPickerOption {
  iconName: IoniconName;
  id: string;
  subtitle?: string;
  title: string;
}

interface InterpreterOptionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  options: InterpreterOptionPickerOption[];
  searchPlaceholder?: string;
  title: string;
}

function InterpreterOptionPickerModal({
  isOpen,
  onClose,
  onSelect,
  options,
  searchPlaceholder = 'Search',
  title
}: InterpreterOptionPickerModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return options;
    }

    return options.filter((option) =>
      option.title.toLowerCase().includes(query) ||
      option.subtitle?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <Pressable onPress={onClose} style={styles.pickerOverlay}>
        <Pressable style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="close" size={24} />
            </Pressable>
          </View>
          {options.length > 8 ? (
            <View style={styles.pickerSearchRow}>
              <Ionicons color={appTheme.colors.mutedStrong} name="search-outline" size={18} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setSearchQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={appTheme.colors.muted}
                style={styles.pickerSearchInput}
                value={searchQuery}
              />
            </View>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.pickerList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filteredOptions.length ? filteredOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onSelect(option.id)}
                style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
              >
                <View style={styles.pickerIcon}>
                  <Ionicons color={appTheme.colors.primary} name={option.iconName} size={19} />
                </View>
                <View style={styles.selectionBody}>
                  <Text style={styles.selectionTitle}>{option.title}</Text>
                  {option.subtitle ? <Text style={styles.mutedText}>{option.subtitle}</Text> : null}
                </View>
                <Ionicons color={appTheme.colors.mutedStrong} name="add-circle-outline" size={20} />
              </Pressable>
            )) : (
              <View style={styles.emptyPickerState}>
                <Ionicons color={appTheme.colors.mutedStrong} name={options.length ? 'search-outline' : 'checkmark-circle-outline'} size={28} />
                <Text style={styles.mutedText}>
                  {options.length ? 'No matching languages found.' : 'All available options have already been added.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ScheduleDateTimePickerModalProps {
  date: Date;
  is24Hour: boolean;
  isOpen: boolean;
  mode: 'date' | 'time';
  onCancel: () => void;
  onChange: (date: Date) => void;
  onConfirm: () => void;
}

export function ScheduleDateTimePickerModal({
  date,
  is24Hour,
  isOpen,
  mode,
  onCancel,
  onChange,
  onConfirm
}: ScheduleDateTimePickerModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'android') {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={isOpen}>
      <View style={styles.pickerOverlay}>
        <View style={[styles.datePickerSheet, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.secondaryTextButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryTextButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>{mode === 'date' ? 'Select date' : 'Select time'}</Text>
            <Pressable onPress={onConfirm} style={({ pressed }) => [styles.secondaryTextButton, pressed && styles.pressed]}>
              <Text style={styles.primaryTextButtonText}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            display="spinner"
            is24Hour={is24Hour}
            mode={mode}
            onChange={(_event, selectedDate) => {
              if (selectedDate) {
                onChange(selectedDate);
              }
            }}
            style={styles.iosDatePicker}
            value={date}
          />
        </View>
      </View>
    </Modal>
  );
}

function hasInterpreterMeetingListFilters(filters: InterpreterMeetingListFilters): boolean {
  return filters.createdDate !== 'all' ||
    filters.meetingType !== 'ALL' ||
    Boolean(filters.nameQuery.trim());
}

function doesInterpreterMeetingMatchListControls(
  meeting: InterpreterMeeting,
  filters: InterpreterMeetingListFilters,
  searchQuery: string
): boolean {
  const quickSearch = searchQuery.trim().toLocaleLowerCase();
  const filterNameQuery = filters.nameQuery.trim().toLocaleLowerCase();
  const meetingTypeLabel = formatMeetingType(meeting.meetingType).toLocaleLowerCase();
  const searchableText = `${meeting.meetingName} ${meetingTypeLabel}`.toLocaleLowerCase();

  if (quickSearch && !searchableText.includes(quickSearch)) {
    return false;
  }

  if (filterNameQuery && !meeting.meetingName.toLocaleLowerCase().includes(filterNameQuery)) {
    return false;
  }

  if (filters.meetingType !== 'ALL' && meeting.meetingType !== filters.meetingType) {
    return false;
  }

  return doesInterpreterMeetingMatchCreatedDateFilter(meeting, filters.createdDate);
}

function doesInterpreterMeetingMatchCreatedDateFilter(
  meeting: InterpreterMeeting,
  filter: InterpreterMeetingCreatedDateFilter
): boolean {
  if (filter === 'all') {
    return true;
  }

  const createdAtMs = Date.parse(meeting.createdAtIso);

  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (filter === 'today') {
    return createdAtMs >= todayStart;
  }

  const ageMs = Date.now() - createdAtMs;
  const maxAgeDays = filter === 'last_7_days' ? 7 : 30;

  return ageMs >= 0 && ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

export function mergeInterpreterRealtimeText(currentText: string, incomingText: string): string {
  const current = currentText.trim();
  const incoming = incomingText.trim();

  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  const normalizedCurrent = normalizeInterpreterCompareText(current);
  const normalizedIncoming = normalizeInterpreterCompareText(incoming);

  if (normalizedIncoming === normalizedCurrent) {
    return incoming.length > current.length ? incoming : current;
  }

  if (normalizedIncoming.includes(normalizedCurrent)) {
    return incoming;
  }

  if (normalizedCurrent.includes(normalizedIncoming)) {
    return current;
  }

  const overlapLength = getInterpreterTextOverlapLength(current, incoming);

  if (overlapLength > 0) {
    return `${current}${incoming.slice(overlapLength)}`.replace(/[ \t]{2,}/g, ' ').trim();
  }

  return `${current}\n${incoming}`.replace(/[ \t]{2,}/g, ' ').trim();
}

export function mergeInterpreterRealtimeTextCandidates(candidates: Array<string | null | undefined>): string {
  return candidates.reduce<string>((mergedText, candidate) =>
    mergeInterpreterRealtimeText(mergedText, candidate || ''), ''
  );
}

export function groupInterpreterSummariesByVersion(summaries: InterpreterMeetingDetails['summaries']) {
  const groups = new Map<string, {
    key: string;
    label: string;
    meta: string;
    sortValue: number;
    summaries: InterpreterMeetingDetails['summaries'];
  }>();

  summaries.forEach((summary) => {
    const sequence = typeof summary.versionSequence === 'number' ? summary.versionSequence : null;
    const key = summary.versionId || (sequence ? `sequence:${sequence}` : 'meeting');
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.summaries.push(summary);
      return;
    }

    groups.set(key, {
      key,
      label: sequence ? `Version ${sequence}` : 'Meeting summaries',
      meta: sequence
        ? 'Created from one live interpreter listening version.'
        : 'Created before version tracking or from the full meeting.',
      sortValue: sequence || 0,
      summaries: [summary]
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      summaries: [...group.summaries].sort((leftSummary, rightSummary) =>
        new Date(rightSummary.createdAtIso).getTime() - new Date(leftSummary.createdAtIso).getTime()
      )
    }))
    .sort((leftGroup, rightGroup) => rightGroup.sortValue - leftGroup.sortValue);
}

export function createInterpreterTextFingerprint(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .slice(-1600);
}

function areStringSetsEqual(firstValues: string[], secondValues: string[]): boolean {
  if (firstValues.length !== secondValues.length) {
    return false;
  }

  const firstSet = new Set(firstValues);

  return secondValues.every((value) => firstSet.has(value));
}

export function groupInterpreterHistory(
  details: InterpreterMeetingDetails,
  liveHistoryItems: InterpreterLiveHistoryItem[]
): Array<{ items: InterpreterLiveHistoryItem[]; language: InterpreterLanguage }> {
  const persistedItems: InterpreterLiveHistoryItem[] = details.translations.map((translation) => {
    const sourceSegment = details.transcripts.find((transcript) => transcript.segmentId === translation.sourceSegmentId);

    return {
      createdAtIso: translation.createdAtIso,
      languageCode: translation.targetLanguageCode,
      sourceText: sourceSegment?.text || '',
      translatedText: translation.translatedText,
      translationId: translation.translationId
    };
  });
  const allItems = [...liveHistoryItems, ...persistedItems]
    .filter((item) => item.languageCode)
    .sort((firstItem, secondItem) =>
      new Date(secondItem.createdAtIso).getTime() - new Date(firstItem.createdAtIso).getTime()
    );
  const languageMap = new Map<string, InterpreterLanguage>();

  details.meeting.interpreterLanguages.forEach((language) => languageMap.set(language.code, language));
  allItems.forEach((item) => {
    if (!languageMap.has(item.languageCode)) {
      languageMap.set(item.languageCode, {
        code: item.languageCode,
        label: getInterpreterLanguageLabel(details, item.languageCode)
      });
    }
  });

  return Array.from(languageMap.values())
    .map((language) => ({
      language,
      items: allItems.filter((item) => item.languageCode === language.code)
    }))
    .filter((group) => group.items.length);
}

export function mergeScheduleDate(currentDate: Date, nextDate: Date): Date {
  const mergedDate = new Date(currentDate);

  mergedDate.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());

  return mergedDate;
}

export function mergeScheduleTime(currentDate: Date, nextTime: Date): Date {
  const mergedDate = new Date(currentDate);

  mergedDate.setHours(nextTime.getHours(), nextTime.getMinutes(), 0, 0);

  return mergedDate;
}

export function doesTranscriptLibraryItemMatchFilter(
  item: InterpreterTranscriptLibraryItem,
  filter: InterpreterTranscriptLibraryFilter
): boolean {
  if (filter === 'all') {
    return true;
  }

  const statuses = item.audioArtifacts.map((artifact) => artifact.status);

  if (filter === 'ready') {
    return statuses.includes('ready');
  }

  if (filter === 'preparing') {
    return statuses.includes('queued') || statuses.includes('processing');
  }

  return !statuses.includes('ready') && !statuses.includes('queued') && !statuses.includes('processing');
}

export async function cacheInterpreterSummaryAudio(
  summaryId: string,
  audio: InterpreterSummaryAudio
): Promise<string> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Spoken summary playback is not available on this device.');
  }

  await FileSystem.makeDirectoryAsync(INTERPRETER_SUMMARY_AUDIO_CACHE_DIR, {
    intermediates: true
  }).catch(() => undefined);

  const safeSummaryId = summaryId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const safeLanguageCode = audio.languageCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  const fileUri = `${INTERPRETER_SUMMARY_AUDIO_CACHE_DIR}${safeSummaryId}-${safeLanguageCode}.mp3`;

  await FileSystem.writeAsStringAsync(fileUri, audio.audioBase64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return fileUri;
}

export async function cacheInterpreterSegmentAudio(
  meetingId: string,
  audio: InterpreterSegmentAudio
): Promise<string> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Spoken interpretation playback is not available on this device.');
  }

  if (audio.localUri) {
    return audio.localUri;
  }

  await FileSystem.makeDirectoryAsync(INTERPRETER_SEGMENT_AUDIO_CACHE_DIR, {
    intermediates: true
  }).catch(() => undefined);

  const safeMeetingId = meetingId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const safeTranslationId = audio.translationId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const safeLanguageCode = audio.languageCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  const fileUri = `${INTERPRETER_SEGMENT_AUDIO_CACHE_DIR}${safeMeetingId}-${safeTranslationId}-${safeLanguageCode}.mp3`;

  if (!audio.audioBase64) {
    const existingFile = await FileSystem.getInfoAsync(fileUri).catch(() => null);

    if (existingFile?.exists) {
      return fileUri;
    }

    throw new Error('Spoken interpretation audio is not available on this device yet.');
  }

  await FileSystem.writeAsStringAsync(fileUri, audio.audioBase64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return fileUri;
}

function createCachedInterpreterSegmentAudio(
  audio: InterpreterSegmentAudio,
  localUri: string
): InterpreterSegmentAudio {
  return {
    ...audio,
    audioBase64: '',
    localUri
  };
}

export function cleanInterpreterLiveTranscriptForDisplay(text: string): string {
  return text
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[^\s,.;:!?])/g, '$1 ')
    .replace(/\bi\b/g, 'I')
    .trim();
}

export function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export async function cacheInterpreterVoicePreviewAudio(audio: InterpreterVoicePreviewAudio): Promise<string> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Interpreter speaker preview is not available on this device.');
  }

  await FileSystem.makeDirectoryAsync(INTERPRETER_VOICE_PREVIEW_AUDIO_CACHE_DIR, {
    intermediates: true
  }).catch(() => undefined);

  const safeVoiceId = audio.voice.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const safeLanguageCode = audio.languageCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  const fileUri = `${INTERPRETER_VOICE_PREVIEW_AUDIO_CACHE_DIR}${safeVoiceId}-${safeLanguageCode}.mp3`;

  await FileSystem.writeAsStringAsync(fileUri, audio.audioBase64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return fileUri;
}

export function safePauseAudioPlayer(player: { pause: () => void }): void {
  try {
    player.pause();
  } catch {
    // The native audio object can be released during fast modal or route transitions.
  }
}

export async function prepareInterpreterSpeakerPlaybackMode(route: InterpreterAudioOutputRoute = 'system'): Promise<void> {
  await applyInterpreterNativeAudioRoute(route);

  // Interpreter listening uses a microphone/WebRTC session. Rebuild the native audio
  // session as playback-only before speaking so iOS uses the media route, not receiver audio.
  if (interpreterNativeAudioSessionMode !== 'media') {
    await setIsAudioActiveAsync(false).catch(() => undefined);
    await setAudioModeAsync(INTERPRETER_SPEAKER_AUDIO_MODE).catch(() => undefined);
    await setIsAudioActiveAsync(true).catch(() => undefined);
    interpreterNativeAudioSessionMode = 'media';
    // Rebuilding the session as playback-only removes the microphone input the
    // live interpreter was using. Record that, so the next listening turn
    // starts a fresh session instead of resuming a deaf one.
    markInterpreterLiveSessionForRebuild();
  }
}

export async function prepareInterpreterRealtimeSpeechMode(route: InterpreterAudioOutputRoute = 'system'): Promise<void> {
  // Live interpreter speech is the remote WebRTC audio track. Keep the active audio
  // session alive here; repeatedly resetting it while the remote track is speaking
  // makes iOS chop the stream into broken fragments.
  if (interpreterNativeAudioSessionMode !== 'realtime') {
    await setAudioModeAsync(INTERPRETER_LISTENING_AUDIO_MODE).catch(() => undefined);
    await setIsAudioActiveAsync(true).catch(() => undefined);
    interpreterNativeAudioSessionMode = 'realtime';
  }
  await applyInterpreterWebRtcAudioRoute(route);
}

export async function refreshInterpreterRealtimeAudioRoute(route: InterpreterAudioOutputRoute = 'system'): Promise<void> {
  await applyInterpreterWebRtcAudioRoute(route, true);
}

async function prepareInterpreterListeningAudioMode(route: InterpreterAudioOutputRoute = 'system'): Promise<void> {
  if (interpreterNativeAudioSessionMode !== 'realtime') {
    await setIsAudioActiveAsync(false).catch(() => undefined);
    await setAudioModeAsync(INTERPRETER_LISTENING_AUDIO_MODE).catch(() => undefined);
    await setIsAudioActiveAsync(true).catch(() => undefined);
    interpreterNativeAudioSessionMode = 'realtime';
  }
  await applyInterpreterWebRtcAudioRoute(route, true);
  setInterpreterNativeKeepAwake(true);
}

/**
 * Switches the audio session for the interpreter's own speech.
 *
 * The listening session asks iOS for Bluetooth input, which forces the
 * hands-free profile: mono and noticeably quieter. Nothing in JavaScript can
 * change that — disabling the microphone track is not the same as telling the
 * operating system the microphone is no longer wanted.
 *
 * This does tell it. While the interpreter speaks it declares playback only,
 * so a Bluetooth speaker uses the music profile and the response plays as
 * loudly as a saved recording through the same device.
 */
export async function applyInterpreterSpeechAudioSession(
  route: InterpreterAudioOutputRoute
): Promise<void> {
  const configure = SynzappAudioSession?.configureInterpreterPlaybackRoute;

  if (typeof configure !== 'function') {
    // Optional chaining hid this once already: the app was tested against a
    // binary built before this native function existed, so the call did
    // nothing at all and looked like the fix had failed. A missing native
    // function means the app needs rebuilding, and that must be visible.
    console.warn(
      '[SynzappInterpreter] configureInterpreterPlaybackRoute is missing from the native module. '
      + 'The app needs a native rebuild — Bluetooth playback will stay on the quieter profile.'
    );

    return;
  }

  try {
    const routeInfo = await configure(route);

    console.log('[SynzappInterpreter] speech audio session', JSON.stringify(routeInfo));
  } catch (error) {
    console.warn(
      '[SynzappInterpreter] could not switch to the playback audio session',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function applyInterpreterNativeAudioRoute(route: InterpreterAudioOutputRoute): Promise<void> {
  const inCallManager = getOptionalInterpreterInCallManagerRuntime();
  void route;

  if (!inCallManager) {
    return;
  }

  try {
    // Do not use InCallManager's speakerphone/earpiece controls for interpreter speech.
    // On iOS those APIs switch to PlayAndRecord/VoiceChat and can force receiver audio.
    if (interpreterWebRtcRouteActive) {
      inCallManager.stop?.();
      interpreterWebRtcRouteActive = false;
      interpreterWebRtcRouteName = null;
      interpreterWebRtcRouteAppliedAtMs = 0;
    }
    inCallManager.setKeepScreenOn?.(true);
  } catch {
    // Audio route APIs vary by device and OS. Interpreter speech is still kept in Expo media playback mode.
  }
}

async function applyInterpreterWebRtcAudioRoute(route: InterpreterAudioOutputRoute, force = false): Promise<void> {
  const inCallManager = getOptionalInterpreterInCallManagerRuntime();

  if (!inCallManager) {
    return;
  }

  try {
    const now = Date.now();

    if (!force && interpreterWebRtcRouteActive && interpreterWebRtcRouteName === route) {
      return;
    }

    // Interpreter speech is shared-room audio, not private receiver audio. Start
    // after Expo audio mode is active so native route changes are not immediately
    // overwritten by the JS audio session update.
    if (!interpreterWebRtcRouteActive || force) {
      inCallManager.start?.({ auto: false, media: 'video' });
    }
    inCallManager.setKeepScreenOn?.(true);
    interpreterWebRtcRouteActive = true;
    interpreterWebRtcRouteName = route;
    interpreterWebRtcRouteAppliedAtMs = now;

    if (route === 'bluetooth') {
      // Let the OS keep the selected external route. This preserves Bluetooth
      // when the user has explicitly chosen it in interpreter settings.
      inCallManager.setForceSpeakerphoneOn?.(null);
      await chooseInterpreterAudioRoute(inCallManager, 'BLUETOOTH');
      await configureInterpreterNativeRealtimeRoute(route);
      return;
    }

    if (route === 'speaker') {
      // Explicit speaker mode is shared media-style output.
      inCallManager.setForceSpeakerphoneOn?.(true);
      inCallManager.setSpeakerphoneOn?.(true);
      await chooseInterpreterAudioRoute(inCallManager, 'SPEAKER_PHONE');
      await configureInterpreterNativeRealtimeRoute(route);
      return;
    }

    if (route === 'system') {
      // System route must respect iOS external audio selection, including
      // Bluetooth. Do not force speakerphone here.
      inCallManager.setForceSpeakerphoneOn?.(null);
      await configureInterpreterNativeRealtimeRoute(route);
      return;
    }
  } catch {
    // WebRTC route controls are native best-effort; the mounted remote stream still remains active.
  }
}

/**
 * The microphone the audio session settled on.
 *
 * Shown in the live room so somebody using an external microphone can see it is
 * actually being used, rather than assuming. A wired microphone that silently
 * failed to engage looks exactly like one that is working.
 */
let interpreterActiveInputName = '';

export function getInterpreterActiveInputName(): string {
  return interpreterActiveInputName;
}

async function configureInterpreterNativeRealtimeRoute(route: InterpreterAudioOutputRoute): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    const routeInfo = await SynzappAudioSession?.configureInterpreterRealtimeRoute?.(route);

    interpreterActiveInputName = routeInfo?.inputName || '';
  } catch {
    // The custom iOS bridge is best-effort. WebRTC remains active if the route
    // cannot be reconfigured on a particular OS/device combination.
  }
}

async function chooseInterpreterAudioRoute(inCallManager: any, routeName: string): Promise<void> {
  try {
    await inCallManager.chooseAudioRoute?.(routeName);
  } catch {
    // Route selection is not available on every native platform.
  }
}

export function setInterpreterNativeKeepAwake(isAwake: boolean) {
  const inCallManager = getOptionalInterpreterInCallManagerRuntime();

  try {
    inCallManager?.setKeepScreenOn?.(isAwake);
    if (isAwake) {
      inCallManager?.turnScreenOn?.();
    }
  } catch {
    // Keep-awake is best-effort on devices that expose the native route manager.
  }
}

export function releaseInterpreterNativeAudioRoute() {
  const inCallManager = getOptionalInterpreterInCallManagerRuntime();

  try {
    inCallManager?.setKeepScreenOn?.(false);
    inCallManager?.stop?.();
    void SynzappAudioSession?.releaseInterpreterRealtimeRoute?.().catch(() => undefined);
    interpreterNativeAudioSessionMode = 'idle';
    interpreterWebRtcRouteActive = false;
    interpreterWebRtcRouteName = null;
    interpreterWebRtcRouteAppliedAtMs = 0;
  } catch {
    // Native route release should never block closing the interpreter room.
  }
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
      marginBottom: 14
    },
    accessPanel: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      gap: 12,
      marginBottom: 12,
      paddingBottom: 12
    },
    disabledButton: {
      opacity: 0.58
    },
    dropdownRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 58,
      paddingHorizontal: 4,
      paddingVertical: 10
    },
    floatingCreateButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 28,
      elevation: 8,
      height: 56,
      justifyContent: 'center',
      position: 'absolute',
      right: 22,
      shadowColor: colors.primary,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      width: 56,
      zIndex: 20
    },
    endButton: {
      alignItems: 'center',
      borderColor: '#fecaca',
      borderRadius: 18,
      borderWidth: 1,
      minHeight: 38,
      paddingHorizontal: 16,
      justifyContent: 'center'
    },
    endButtonText: {
      color: '#b91c1c',
      fontSize: 14
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 11,
      letterSpacing: 2
    },
    hero: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
      paddingBottom: 14
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 18,
      height: 46,
      justifyContent: 'center',
      width: 46
    },
    heroText: {
      flex: 1,
      gap: 4
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      height: 42,
      justifyContent: 'center',
      width: 42
    },
    input: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 50,
      paddingHorizontal: 14
    },
    inlineHintText: {
      color: colors.mutedStrong,
      flexShrink: 1,
      fontSize: 12,
      textAlign: 'right'
    },
    languageChip: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginRight: 8,
      paddingHorizontal: 16,
      paddingVertical: 10
    },
    languageChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    languageChipResponding: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    languageChipText: {
      color: colors.ink,
      fontSize: 14
    },
    languageChipTextActive: {
      color: colors.primary
    },
    languageChipTextResponding: {
      color: '#fff'
    },
    languageStatusDot: {
      borderRadius: 5,
      height: 10,
      width: 10
    },
    languageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    languageScroller: {
      flexGrow: 0,
      marginBottom: 12
    },
    languageToggle: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    languageToggleActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    languageToggleText: {
      color: colors.ink,
      fontSize: 14
    },
    circularAudioPulse: {
      borderWidth: 9,
      position: 'absolute'
    },
    circularAudioShell: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    },
    circularAudioWrap: {
      alignItems: 'center',
      marginBottom: 8
    },
    circularAudioWrapCompact: {
      marginBottom: 6
    },
    remoteInterpreterAudioSink: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
      opacity: 0.01
    },
    interpretationLanguageButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 34,
      justifyContent: 'center',
      width: 34
    },
    interpretationPlayerButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 36,
      justifyContent: 'center',
      width: 36
    },
    interpretationPlayerButtonActive: {
      backgroundColor: colors.primary
    },
    interpretationPlayerCopy: {
      flex: 1,
      gap: 2
    },
    interpretationPlayerDock: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 18,
      elevation: 10,
      flexDirection: 'row',
      gap: 10,
      marginBottom: 0,
      paddingHorizontal: 12,
      paddingVertical: 10,
      shadowColor: colors.ink,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 18
    },
    interpretationPlayerMeta: {
      color: colors.mutedStrong,
      fontSize: 12
    },
    interpretationPlayerRow: {
      alignItems: 'center',
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
      paddingTop: 12
    },
    interpretationPlayerTitle: {
      color: colors.ink,
      fontSize: 14
    },
    latestReplayRow: {
      alignItems: 'center',
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      paddingTop: 12
    },
    historyLanguageGroup: {
      gap: 6,
      marginBottom: 10
    },
    historyRowHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between'
    },
    historyPlayButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 34,
      justifyContent: 'center',
      width: 34
    },
    historyPlayButtonActive: {
      backgroundColor: colors.primary
    },
    historySourceText: {
      color: colors.mutedStrong,
      fontSize: 13,
      lineHeight: 19
    },
    modalContent: {
      gap: 14,
      paddingBottom: 16
    },
    modalHandle: {
      alignSelf: 'center',
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 4,
      marginBottom: 14,
      width: 44
    },
    modalHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14
    },
    modalOverlay: {
      backgroundColor: 'rgba(15,23,42,0.38)',
      flex: 1,
      justifyContent: 'flex-end'
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      maxHeight: '92%',
      padding: 18
    },
    modalTitle: {
      color: colors.ink,
      fontSize: 20
    },
    mutedText: {
      color: colors.mutedStrong,
      fontSize: 13,
      lineHeight: 19
    },
    operatorCard: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      gap: 10,
      marginBottom: 12,
      paddingBottom: 12
    },
    pressed: {
      opacity: 0.76,
      transform: [{ scale: 0.99 }]
    },
    poolReadinessRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    poolReadinessText: {
      color: colors.primary,
      fontSize: 12
    },
    permissionStatusPill: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12
    },
    permissionButtonReady: {
      backgroundColor: '#dcfce7'
    },
    permissionButtonText: {
      color: colors.primary,
      fontSize: 13
    },
    permissionButtonTextReady: {
      color: '#047857'
    },
    participantChip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginRight: 8,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    participantChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    participantMeta: {
      color: colors.mutedStrong,
      fontSize: 11,
      marginTop: 2,
      maxWidth: 140
    },
    participantName: {
      color: colors.ink,
      fontSize: 13,
      maxWidth: 140
    },
    participantScroller: {
      flexGrow: 0
    },
    pickerIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 18,
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    pickerList: {
      paddingBottom: 12
    },
    pickerOverlay: {
      backgroundColor: 'rgba(15,23,42,0.34)',
      flex: 1,
      justifyContent: 'flex-end'
    },
    pickerRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 64,
      paddingVertical: 10
    },
    pickerSearchInput: {
      color: colors.ink,
      flex: 1,
      fontSize: 15,
      minHeight: 42,
      paddingVertical: 0
    },
    pickerSearchRow: {
      alignItems: 'center',
      backgroundColor: colors.input,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
      paddingHorizontal: 14
    },
    pickerSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      maxHeight: '72%',
      paddingHorizontal: 18,
      paddingTop: 12
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 16
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 14
    },
    primaryButtonWide: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 14
    },
    respondButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 12
    },
    respondButtonText: {
      color: '#fff',
      fontSize: 13
    },
    readinessCopy: {
      flex: 1,
      gap: 3
    },
    readinessRow: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingBottom: 12
    },
    responseLanguageGrid: {
      gap: 8,
      marginTop: 16
    },
    responseLanguageButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 58,
      paddingVertical: 10
    },
    responseLanguageButtonSelected: {
      backgroundColor: colors.primarySoft
    },
    responseLanguageButtonResponding: {
      backgroundColor: colors.primary,
      borderBottomColor: colors.primary
    },
    responseLanguageTitle: {
      color: colors.ink,
      fontSize: 15
    },
    responseLanguageMeta: {
      color: colors.mutedStrong,
      fontSize: 12
    },
    responseLanguageTitleResponding: {
      color: '#fff'
    },
    datePickerSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 18,
      paddingTop: 18
    },
    iosDatePicker: {
      alignSelf: 'stretch'
    },
    screen: {
      backgroundColor: colors.surface,
      flex: 1,
      padding: 14
    },
    workspaceHeader: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 10,
      minHeight: 42
    },
    workspaceHeaderSpacer: {
      width: 42
    },
    workspaceOptionsButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 999,
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    workspaceOptionsButtonActive: {
      backgroundColor: colors.primarySoft
    },
    workspaceScreen: {
      backgroundColor: colors.screen
    },
    workspaceTitle: {
      color: colors.ink,
      flex: 1,
      fontSize: 20,
      lineHeight: 26,
      textAlign: 'center'
    },
    settingsContent: {
      gap: 18,
      paddingBottom: 24
    },
    settingsSaveButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 36,
      minWidth: 70,
      paddingHorizontal: 14
    },
    settingsSaveButtonText: {
      color: '#fff',
      fontSize: 13
    },
    settingsSection: {
      gap: 9
    },
    saveAccessButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 14
    },
    saveAccessButtonText: {
      color: colors.primary,
      fontSize: 13
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 14
    },
    secondaryButtonFull: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 14
    },
    secondaryButtonText: {
      color: colors.ink,
      fontSize: 15
    },
    secondaryTextButton: {
      alignItems: 'center',
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 36,
      minWidth: 68,
      paddingHorizontal: 8
    },
    secondaryTextButtonText: {
      color: colors.mutedStrong,
      fontSize: 14
    },
    sectionHeaderRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between'
    },
    sectionLabel: {
      color: colors.mutedStrong,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    selectionBody: {
      flex: 1,
      gap: 2
    },
    selectionList: {
      backgroundColor: colors.surface,
      borderTopColor: colors.divider,
      borderTopWidth: 1
    },
    selectionRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 54,
      paddingHorizontal: 4,
      paddingVertical: 9
    },
    selectionTitle: {
      color: colors.ink,
      flexShrink: 1,
      fontSize: 14,
      lineHeight: 19
    },
    selectionLimitText: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 4,
      paddingVertical: 9
    },
    addSelectionRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 4
    },
    addSelectionText: {
      color: colors.primary,
      fontSize: 14
    },
    inlineField: {
      flex: 1,
      minWidth: 0
    },
    inlineFieldRow: {
      flexDirection: 'row',
      gap: 10
    },
    inlinePickerPanel: {
      backgroundColor: colors.surface,
      borderTopColor: colors.divider,
      borderTopWidth: 1
    },
    inlinePickerRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 56,
      paddingHorizontal: 4,
      paddingVertical: 9
    },
    inlinePickerRowSelected: {
      backgroundColor: colors.primarySoft
    },
    inlinePickerEmptyRow: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 10
    },
    inlineOption: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 58,
      paddingVertical: 10
    },
    primaryTextButtonText: {
      color: colors.primary,
      fontSize: 14
    },
    quietWorkspaceFill: {
      flex: 1
    },
    schedulePanel: {
      backgroundColor: colors.surface,
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      gap: 12,
      paddingTop: 12
    },
    statusPill: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    statusPillText: {
      fontSize: 12
    },
    statusDot: {
      borderRadius: 6,
      height: 12,
      width: 12
    },
    subtitle: {
      color: colors.mutedStrong,
      fontSize: 14,
      lineHeight: 20
    },
    switchKnob: {
      backgroundColor: colors.card,
      borderRadius: 12,
      height: 24,
      transform: [{ translateX: 2 }],
      width: 24
    },
    switchKnobActive: {
      transform: [{ translateX: 22 }]
    },
    switchRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      padding: 12
    },
    switchTitle: {
      color: colors.ink,
      fontSize: 14
    },
    switchTrack: {
      backgroundColor: colors.border,
      borderRadius: 16,
      height: 28,
      justifyContent: 'center',
      width: 50
    },
    switchTrackActive: {
      backgroundColor: colors.primary
    },
    textArea: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 15,
      minHeight: 92,
      padding: 12,
      textAlignVertical: 'top'
    },
    title: {
      color: colors.ink,
      fontSize: 18
    },
    translationCard: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      gap: 10,
      marginBottom: 12,
      paddingBottom: 12
    },
    translationText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 22
    },
    emptyState: {
      alignItems: 'center',
      gap: 10,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 48
    },
    emptyPickerState: {
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 28
    },
    emptyTitle: {
      color: colors.ink,
      fontSize: 16
    },
    filterChip: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 14
    },
    filterChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9
    },
    filterChipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    filterChipText: {
      color: colors.ink,
      fontSize: 13
    },
    filterChipTextSelected: {
      color: colors.primary
    },
    listContent: {
      gap: 10,
      paddingBottom: 18
    },
    meetingBody: {
      flex: 1,
      gap: 5
    },
    meetingAvatar: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40
    },
    meetingAvatarBadge: {
      alignItems: 'center',
      borderColor: colors.screen,
      borderRadius: 9,
      borderWidth: 2,
      bottom: -1,
      height: 18,
      justifyContent: 'center',
      position: 'absolute',
      right: -2,
      width: 18
    },
    meetingAvatarWrap: {
      height: 44,
      justifyContent: 'center',
      width: 46
    },
    meetingMeta: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17
    },
    meetingName: {
      color: colors.ink,
      fontSize: 16
    },
    meetingRow: {
      alignItems: 'center',
      backgroundColor: colors.screen,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 70,
      paddingHorizontal: 2,
      paddingVertical: 12
    },
    meetingRowSelected: {
      backgroundColor: colors.primarySoft
    },
    meetingDeleteAction: {
      alignItems: 'center',
      backgroundColor: colors.red,
      gap: 4,
      height: '100%',
      justifyContent: 'center',
      width: INTERPRETER_SESSION_DELETE_WIDTH
    },
    meetingDeleteText: {
      color: '#fff',
      fontSize: 12
    },
    meetingSwipeActions: {
      alignItems: 'stretch',
      bottom: 0,
      justifyContent: 'center',
      position: 'absolute',
      right: 0,
      top: 0
    },
    meetingSwipeContent: {
      backgroundColor: colors.screen
    },
    meetingSwipeShell: {
      backgroundColor: colors.red,
      overflow: 'hidden'
    },
    meetingBulkDeleteButton: {
      alignItems: 'center',
      backgroundColor: colors.red,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 13
    },
    meetingBulkDeleteText: {
      color: '#fff',
      fontSize: 13
    },
    meetingCreatePendingCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      marginBottom: 10,
      minHeight: 62,
      paddingHorizontal: 14,
      shadowColor: '#0f172a',
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 12
    },
    meetingCreatePendingCopy: {
      flex: 1,
      minWidth: 0
    },
    meetingCreatePendingMeta: {
      color: colors.mutedStrong,
      fontSize: 12,
      marginTop: 3
    },
    meetingCreatePendingTitle: {
      color: colors.ink,
      fontSize: 15
    },
    meetingFilterActions: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      marginTop: 18
    },
    meetingFilterSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      gap: 16,
      padding: 18
    },
    meetingSearchBar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 9,
      marginBottom: 10,
      minHeight: 44,
      paddingHorizontal: 14,
      shadowColor: '#0f172a',
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 12
    },
    meetingSearchInput: {
      color: colors.ink,
      flex: 1,
      fontSize: 15,
      minWidth: 0,
      paddingVertical: 0
    },
    meetingSelectionToolbar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
      minHeight: 48,
      paddingHorizontal: 12
    },
    createSessionButton: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 42,
      minWidth: 170,
      paddingHorizontal: 24
    },
    audioRouteStatusBlock: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      borderTopColor: colors.divider,
      borderTopWidth: 1
    },
    audioRouteStatusRow: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 62,
      paddingHorizontal: 4,
      paddingVertical: 10
    },
    audioRouteStatusIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 36,
      justifyContent: 'center',
      width: 36
    },
    audioRouteRefreshButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 34,
      justifyContent: 'center',
      width: 34
    },
    audioDeviceRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 56,
      paddingHorizontal: 4,
      paddingVertical: 9
    },
    livePanel: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      gap: 10,
      marginBottom: 12,
      paddingBottom: 14
    },
    livePulse: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 24,
      height: 48,
      justifyContent: 'center',
      width: 48
    },
    liveTitle: {
      color: colors.ink,
      fontSize: 16
    },
    liveStatusCard: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
      paddingBottom: 12
    },
    liveStatusTextWrap: {
      flex: 1,
      gap: 2
    },
    liveStatusTitle: {
      color: colors.ink,
      fontSize: 15
    },
    liveQuickActionsRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: 10
    },
    liveQuickAction: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: 12
    },
    liveQuickActionText: {
      color: colors.primary,
      fontSize: 13
    },
    roomVoiceRow: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 11,
      paddingBottom: 12,
      paddingTop: 2
    },
    roomVoiceIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 36,
      justifyContent: 'center',
      width: 36
    },
    liveEndButton: {
      alignItems: 'center',
      backgroundColor: colors.redSoft,
      borderRadius: 999,
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 14
    },
    liveEndButtonText: {
      color: colors.red,
      fontSize: 13
    },
    liveIconButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    liveHeaderCountBadge: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderColor: colors.surface,
      borderRadius: 999,
      borderWidth: 2,
      minWidth: 18,
      paddingHorizontal: 4,
      position: 'absolute',
      right: -3,
      top: -3
    },
    liveHeaderCountBadgeText: {
      color: '#fff',
      fontSize: 10,
      lineHeight: 14
    },
    liveCenterAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginBottom: 6,
      minHeight: 44,
      minWidth: 158,
      paddingHorizontal: 22
    },
    liveCenterActionListening: {
      backgroundColor: colors.primary
    },
    liveCenterActionText: {
      color: '#fff',
      fontSize: 15
    },
    liveStatusBadge: {
      alignItems: 'center',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    liveStatusBadgeText: {
      fontSize: 12,
      letterSpacing: 0.5,
      textTransform: 'uppercase'
    },
    liveLanguageRouteCard: {
      alignItems: 'stretch',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 9,
      maxWidth: 360,
      overflow: 'hidden',
      width: '100%'
    },
    liveLanguageRouteDivider: {
      backgroundColor: colors.divider,
      width: 1
    },
    liveLanguageRouteLabel: {
      color: colors.mutedStrong,
      fontSize: 10,
      letterSpacing: 1.1,
      textTransform: 'uppercase'
    },
    liveLanguageRouteOption: {
      flex: 1,
      gap: 4,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    liveLanguageRoutePressable: {
      backgroundColor: colors.surfaceElevated
    },
    liveLanguageRouteOptionDisabled: {
      opacity: 0.58
    },
    liveLanguageRouteValue: {
      color: colors.ink,
      flexShrink: 1,
      fontSize: 14
    },
    liveLanguageRouteValueMuted: {
      color: colors.mutedStrong
    },
    liveLanguageRouteValueRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
      minWidth: 0
    },
    liveLanguagePillScroll: {
      marginTop: 12
    },
    liveLanguageButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      marginRight: 8,
      minHeight: 38,
      paddingHorizontal: 13
    },
    liveLanguageButtonActive: {
      backgroundColor: colors.primarySoft
    },
    liveLanguageButtonResponding: {
      backgroundColor: colors.primary
    },
    liveLanguageButtonText: {
      color: colors.mutedStrong,
      fontSize: 13
    },
    liveLanguageButtonTextActive: {
      color: colors.primary
    },
    liveLanguageButtonTextResponding: {
      color: '#fff'
    },
    liveLanguageRespondingText: {
      color: '#fff',
      fontSize: 11,
      opacity: 0.86
    },
    liveLanguageReadyText: {
      color: colors.success,
      fontSize: 11,
      opacity: 0.88
    },
    liveLanguageBufferingText: {
      color: colors.mutedStrong,
      fontSize: 11,
      opacity: 0.82
    },
    liveLanguageStatus: {
      borderRadius: 4,
      height: 8,
      width: 8
    },
    liveLanguagePickerBackdrop: {
      alignItems: 'center',
      backgroundColor: 'rgba(8, 15, 31, 0.42)',
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 12
    },
    liveLanguagePickerSheet: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      maxHeight: '86%',
      paddingHorizontal: 16,
      shadowColor: colors.ink,
      shadowOffset: { height: -10, width: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 26,
      width: '100%'
    },
    liveLanguagePickerHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12
    },
    liveLanguagePickerTitleWrap: {
      flex: 1,
      gap: 4
    },
    liveLanguagePickerTitle: {
      color: colors.ink,
      fontSize: 18
    },
    liveLanguagePickerHint: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17
    },
    liveLanguageSearchBox: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 12
    },
    liveLanguageSearchInput: {
      color: colors.ink,
      flex: 1,
      fontSize: 15,
      minHeight: 44,
      paddingVertical: 0
    },
    liveLanguagePickerList: {
      gap: 8,
      paddingTop: 12
    },
    liveLanguagePickerRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.divider,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 58,
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    liveLanguagePickerRowSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    liveLanguagePickerRowCopy: {
      flex: 1,
      minWidth: 0
    },
    liveLanguagePickerRowTitle: {
      color: colors.ink,
      fontSize: 15
    },
    liveLanguagePickerRowMeta: {
      color: colors.mutedStrong,
      fontSize: 11,
      marginTop: 2
    },
    liveLanguageCapabilityPill: {
      backgroundColor: colors.amberSoft,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4
    },
    liveLanguageCapabilityPillValidated: {
      backgroundColor: colors.successSoft
    },
    liveLanguageCapabilityText: {
      color: colors.amber,
      fontSize: 10,
      letterSpacing: 0.3,
      textTransform: 'uppercase'
    },
    liveLanguageCapabilityTextValidated: {
      color: colors.success
    },
    liveLanguagePickerEmpty: {
      alignItems: 'center',
      paddingVertical: 20
    },
    liveLanguageSummaryRow: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingBottom: 14
    },
    liveLanguageSummaryCopy: {
      flex: 1,
      gap: 4
    },
    liveRoomLanguageSummaryText: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20
    },
    liveLanguageChooseButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 13
    },
    liveLanguageChooseText: {
      color: colors.primary,
      fontSize: 13
    },
    liveListenAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 46,
      paddingHorizontal: 14
    },
    liveListenActionActive: {
      opacity: 0.78
    },
    liveOrb: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 42,
      height: 84,
      justifyContent: 'center',
      width: 84
    },
    liveOrbPulse: {
      backgroundColor: colors.primary,
      borderRadius: 68,
      height: 136,
      position: 'absolute',
      width: 136
    },
    liveOrbWrap: {
      alignItems: 'center',
      height: 146,
      justifyContent: 'center',
      width: 146
    },
    livePrimaryAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 14
    },
    livePrimaryActionText: {
      color: '#fff',
      fontSize: 14
    },
    liveRoomNoticeText: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 6,
      paddingHorizontal: 24,
      textAlign: 'center'
    },
    liveRespondAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 46,
      paddingHorizontal: 14
    },
    liveRespondActionText: {
      color: '#fff',
      fontSize: 14
    },
    liveRoomDivider: {
      backgroundColor: colors.divider,
      height: 1,
      marginVertical: 12
    },
    liveRoomFooter: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      shadowColor: colors.ink,
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 12
    },
    liveFooterHint: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: 12,
      lineHeight: 18
    },
    liveSummaryFab: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      elevation: 8,
      height: 52,
      justifyContent: 'center',
      position: 'absolute',
      right: 20,
      shadowColor: colors.primary,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      width: 52,
      zIndex: 24
    },
    liveFloatingFooter: {
      gap: 8,
      left: 18,
      position: 'absolute',
      right: 18,
      zIndex: 22
    },
    liveSummaryFabBadge: {
      alignItems: 'center',
      backgroundColor: colors.success,
      borderRadius: 999,
      minWidth: 18,
      paddingHorizontal: 5,
      paddingVertical: 2,
      position: 'absolute',
      right: -3,
      top: -4
    },
    liveSummaryFabBadgeEmpty: {
      backgroundColor: colors.muted
    },
    liveSummaryFabBadgeText: {
      color: '#fff',
      fontSize: 10
    },
    liveRoomHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      marginBottom: 7
    },
    liveRoomLanguageArea: {
      gap: 10,
      marginBottom: 10
    },
    liveVersionArea: {
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      gap: 6,
      marginBottom: 8,
      paddingBottom: 8
    },
    liveVersionHeaderRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between'
    },
    liveVersionHint: {
      color: colors.muted,
      flexShrink: 1,
      fontSize: 11,
      textAlign: 'right'
    },
    liveVersionRail: {
      flexGrow: 0
    },
    liveVersionPill: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      marginRight: 7,
      minHeight: 30,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    liveVersionPillActive: {
      backgroundColor: colors.primarySoft
    },
    liveVersionPillTitle: {
      color: colors.mutedStrong,
      fontSize: 13
    },
    liveVersionPillTitleActive: {
      color: colors.primary
    },
    liveVersionPillMeta: {
      color: colors.muted,
      fontSize: 11
    },
    liveRoomMeta: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2
    },
    liveRoomPrivacyRow: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 10
    },
    liveRoomPrivacyText: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: 12,
      lineHeight: 17
    },
    liveRoomRecoveryRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10
    },
    liveRoomScreen: {
      backgroundColor: colors.screen,
      flex: 1,
      paddingHorizontal: 16
    },
    liveRoomSectionLabel: {
      color: colors.primary,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase'
    },
    liveRoomStage: {
      alignItems: 'center',
      flexShrink: 0,
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4
    },
    liveRoomStateText: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
      textAlign: 'center'
    },
    liveRoomStateTitle: {
      color: colors.ink,
      fontSize: 18
    },
    liveRoomTitle: {
      color: colors.ink,
      fontSize: 17
    },
    liveRoomTitleWrap: {
      flex: 1
    },
    liveRoomVoiceText: {
      color: colors.mutedStrong,
      fontSize: 12
    },
    liveDetailScreen: {
      backgroundColor: colors.screen,
      flex: 1,
      paddingHorizontal: 18
    },
    liveDetailList: {
      paddingBottom: 28
    },
    liveDetailRow: {
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      gap: 6,
      paddingVertical: 14
    },
    liveDetailMeta: {
      color: colors.mutedStrong,
      fontSize: 12
    },
    liveDetailText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 22
    },
    liveRoomTranscriptArea: {
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      flex: 1,
      gap: 6,
      marginBottom: 10,
      minHeight: 96
    },
    liveRoomTranscriptContent: {
      paddingVertical: 14
    },
    liveRoomTranscriptScroll: {
      flex: 1
    },
    liveRoomTranscriptText: {
      color: colors.mutedStrong,
      fontSize: 14,
      lineHeight: 21
    },
    liveRoomTranslationText: {
      color: colors.ink,
      fontSize: 16,
      lineHeight: 23
    },
    liveTranslationPanel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      flex: 1,
      minHeight: 236,
      overflow: 'hidden',
      shadowColor: colors.ink,
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 20
    },
    liveTranslationHeader: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    liveTranslationTitleWrap: {
      flex: 1,
      minWidth: 0
    },
    liveTranslationRouteText: {
      color: colors.ink,
      fontSize: 14,
      marginTop: 3
    },
    liveTranslationStatusChip: {
      alignItems: 'center',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    liveTranslationStatusText: {
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase'
    },
    liveTranslationScroll: {
      flex: 1
    },
    liveTranslationContent: {
      gap: 10,
      padding: 12,
      paddingBottom: 16
    },
    liveTranslationCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.divider,
      borderRadius: 16,
      borderWidth: 1,
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 11
    },
    liveTranslationCardPrimary: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    liveTranslationCardHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7
    },
    liveTranslationLabel: {
      color: colors.ink,
      fontSize: 13
    },
    liveTranslationBodyText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 22
    },
    liveTranslationPlaceholder: {
      color: colors.mutedStrong
    },
    liveTranslationFooterNote: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 2
    },
    liveSecondaryAction: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 14
    },
    liveSecondaryActionText: {
      color: colors.ink,
      fontSize: 14
    },
    voicePickerRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 72,
      paddingVertical: 12
    },
    voicePickerRowSelected: {
      backgroundColor: colors.primarySoft
    },
    voiceAvatar: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 18,
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    voicePreviewButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    voicePreviewButtonActive: {
      backgroundColor: colors.primary
    },
    roomHeader: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginBottom: 8,
      paddingBottom: 10
    },
    roomContent: {
      paddingBottom: 22
    },
    roomHost: {
      backgroundColor: colors.screen,
      flex: 1
    },
    roomSettingsOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.screen,
      elevation: 30,
      paddingHorizontal: 18,
      zIndex: 30
    },
    roomScreen: {
      paddingBottom: 12
    },
    roomTitle: {
      color: colors.ink,
      fontSize: 16
    },
    roomTitleWrap: {
      flex: 1,
      gap: 2
    },
    transcriptLibraryScreen: {
      backgroundColor: colors.background,
      flex: 1,
      paddingHorizontal: 16
    },
    transcriptLibraryOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
      elevation: 50,
      paddingHorizontal: 16,
      zIndex: 50
    },
    transcriptLibraryHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14
    },
    transcriptLibraryTitleWrap: {
      flex: 1,
      gap: 3
    },
    transcriptLibraryTitleWrapCentered: {
      alignItems: 'center',
      flex: 1,
      minWidth: 0
    },
    transcriptLibraryTitle: {
      color: colors.ink,
      fontSize: 18
    },
    transcriptLibraryTitleCentered: {
      color: colors.ink,
      fontSize: 18,
      textAlign: 'center'
    },
    transcriptLibraryHint: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17
    },
    transcriptLibraryList: {
      gap: 12,
      paddingBottom: 24
    },
    transcriptLibraryListWithPlayer: {
      paddingBottom: 268
    },
    transcriptLibraryListWithMiniPlayer: {
      paddingTop: 10
    },
    transcriptLibraryToolbar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    transcriptLibraryToolbarCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0
    },
    transcriptLibraryToolbarTitle: {
      color: colors.ink,
      fontSize: 14
    },
    transcriptLibraryToolbarMeta: {
      color: colors.mutedStrong,
      fontSize: 11
    },
    transcriptLibrarySelectionActions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      gap: 8
    },
    transcriptLibraryToolbarActions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      gap: 8
    },
    transcriptLibraryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 12,
      padding: 14,
      shadowColor: colors.ink,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 18
    },
    transcriptLibraryCardSelectable: {
      borderColor: colors.primarySoft
    },
    transcriptLibraryCardSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    transcriptLibraryCardHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between'
    },
    transcriptLibraryCardTitleWrap: {
      flex: 1,
      gap: 3
    },
    transcriptLibraryCardTitle: {
      color: colors.ink,
      fontSize: 15
    },
    transcriptLibraryCardMeta: {
      color: colors.mutedStrong,
      fontSize: 12
    },
    transcriptLibraryBodyText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 22
    },
    transcriptStatusPill: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5
    },
    transcriptStatusPillText: {
      fontSize: 11,
      textTransform: 'uppercase'
    },
    transcriptSpokenPreview: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 5,
      padding: 10
    },
    transcriptSpokenPreviewLabel: {
      color: colors.primary,
      fontSize: 10,
      letterSpacing: 1.1,
      textTransform: 'uppercase'
    },
    transcriptSpokenPreviewText: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20
    },
    transcriptLibraryActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10
    },
    transcriptLanguageButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      minHeight: 42,
      paddingHorizontal: 12
    },
    transcriptLanguageButtonText: {
      color: colors.ink,
      flex: 1,
      fontSize: 13
    },
    transcriptPrepareButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: 42,
      minWidth: 136,
      paddingHorizontal: 14
    },
    transcriptPrepareButtonDisabled: {
      opacity: 0.58
    },
    transcriptPrepareButtonText: {
      color: colors.primary,
      fontSize: 13
    },
    transcriptPrepareButtonTextReady: {
      color: colors.success
    },
    transcriptPlayButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: 42,
      minWidth: 116,
      paddingHorizontal: 14
    },
    transcriptPlayButtonDisabled: {
      backgroundColor: colors.mutedStrong
    },
    transcriptPlayButtonText: {
      color: '#fff',
      fontSize: 13
    },
    transcriptLibraryError: {
      color: colors.red,
      fontSize: 12,
      lineHeight: 17
    },
    transcriptCheckboxTouch: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      minHeight: 30
    },
    transcriptCheckboxDisabled: {
      opacity: 0.45
    },
    transcriptCheckboxBox: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 7,
      borderWidth: 1.5,
      height: 23,
      justifyContent: 'center',
      width: 23
    },
    transcriptCheckboxBoxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    transcriptCheckboxLabel: {
      color: colors.ink,
      fontSize: 13
    },
    transcriptDeleteButton: {
      alignItems: 'center',
      backgroundColor: colors.red,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 13
    },
    transcriptDeleteButtonDisabled: {
      opacity: 0.65
    },
    transcriptDeleteButtonText: {
      color: '#fff',
      fontSize: 13
    },
    transcriptRefreshButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      flexDirection: 'row',
      flexShrink: 0,
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 12
    },
    transcriptRefreshButtonText: {
      color: colors.primary,
      fontSize: 13
    },
    transcriptSummaryButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      flexShrink: 0,
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 12
    },
    transcriptSummaryButtonDisabled: {
      opacity: 0.48
    },
    transcriptSummaryButtonText: {
      color: colors.primary,
      fontSize: 13
    },
    transcriptAudioMiniPlayer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 9,
      marginBottom: 2,
      paddingHorizontal: 10,
      paddingVertical: 9,
      shadowColor: colors.ink,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 18
    },
    transcriptAudioMiniCopy: {
      flex: 1,
      gap: 1,
      minWidth: 0
    },
    transcriptAudioMiniEyebrow: {
      color: colors.primary,
      fontSize: 9,
      letterSpacing: 1.1,
      textTransform: 'uppercase'
    },
    transcriptAudioMiniTitle: {
      color: colors.ink,
      fontSize: 14
    },
    transcriptAudioMiniSubtitle: {
      color: colors.mutedStrong,
      fontSize: 11
    },
    transcriptAudioMiniButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 34,
      justifyContent: 'center',
      width: 34
    },
    transcriptAudioMiniCloseButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 32,
      justifyContent: 'center',
      width: 32
    },
    transcriptAudioFullScreen: {
      backgroundColor: colors.background,
      flex: 1,
      paddingHorizontal: 16
    },
    transcriptAudioFullHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12
    },
    transcriptAudioFullShareButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 42,
      justifyContent: 'center',
      width: 42
    },
    transcriptAudioFullTitleWrap: {
      alignItems: 'center',
      flex: 1,
      gap: 2,
      minWidth: 0
    },
    transcriptAudioSwipeHandleWrap: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: 14
    },
    transcriptAudioSwipeHandle: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 5,
      width: 52
    },
    transcriptAudioSwipeHint: {
      color: colors.mutedStrong,
      fontSize: 11
    },
    transcriptAudioFullContent: {
      flexGrow: 1,
      paddingBottom: 18
    },
    transcriptAudioTranscriptCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 10,
      padding: 16
    },
    transcriptAudioTranscriptLabel: {
      color: colors.primary,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase'
    },
    transcriptAudioTranscriptText: {
      color: colors.ink,
      fontSize: 17,
      lineHeight: 26
    },
    transcriptAudioFullControls: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 12,
      padding: 15,
      shadowColor: colors.ink,
      shadowOffset: { height: -8, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 18
    },
    transcriptAudioFullControlRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'center'
    },
    transcriptAudioFullPlayPauseButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 60,
      justifyContent: 'center',
      width: 60
    },
    transcriptAudioPlayerDock: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      elevation: 24,
      gap: 10,
      left: 14,
      padding: 14,
      position: 'absolute',
      right: 14,
      shadowColor: colors.ink,
      shadowOffset: { height: 12, width: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      zIndex: 65
    },
    transcriptAudioPlayerHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10
    },
    transcriptAudioPlayerTitleWrap: {
      flex: 1,
      gap: 2,
      minWidth: 0
    },
    transcriptAudioPlayerEyebrow: {
      color: colors.primary,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase'
    },
    transcriptAudioPlayerTitle: {
      color: colors.ink,
      fontSize: 16
    },
    transcriptAudioPlayerSubtitle: {
      color: colors.mutedStrong,
      fontSize: 12
    },
    transcriptAudioPlayerCloseButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 32,
      justifyContent: 'center',
      width: 32
    },
    transcriptAudioProgressTrack: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 9,
      justifyContent: 'center',
      marginTop: 2,
      overflow: 'visible'
    },
    transcriptAudioProgressFill: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 9
    },
    transcriptAudioProgressThumb: {
      backgroundColor: '#fff',
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 2,
      height: 18,
      marginLeft: -9,
      position: 'absolute',
      width: 18
    },
    transcriptAudioTimeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between'
    },
    transcriptAudioTimeText: {
      color: colors.mutedStrong,
      fontSize: 11
    },
    transcriptAudioControlRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 9
    },
    transcriptAudioCircleButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 2,
      height: 40,
      justifyContent: 'center',
      width: 48
    },
    transcriptAudioPlayPauseButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 48,
      justifyContent: 'center',
      width: 48
    },
    transcriptAudioShareButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 12
    },
    transcriptAudioButtonDisabled: {
      opacity: 0.48
    },
    transcriptAudioTinyText: {
      color: colors.ink,
      fontSize: 11
    },
    transcriptAudioShareButtonText: {
      color: colors.primary,
      fontSize: 13
    },
    transcriptAudioRateRow: {
      flexDirection: 'row',
      gap: 7
    },
    transcriptAudioRateButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      minHeight: 30,
      justifyContent: 'center'
    },
    transcriptAudioRateButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    transcriptAudioRateButtonText: {
      color: colors.mutedStrong,
      fontSize: 12
    },
    transcriptAudioRateButtonTextSelected: {
      color: '#fff'
    },
    transcriptLibraryEmpty: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 8,
      padding: 24
    },
    transcriptLibraryEmptyTitle: {
      color: colors.ink,
      fontSize: 16
    },
    transcriptLibraryEmptyText: {
      color: colors.mutedStrong,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center'
    },
    transcriptSummaryScreen: {
      backgroundColor: colors.background,
      flex: 1,
      paddingHorizontal: 16
    },
    transcriptSummaryHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14
    },
    transcriptSummaryTitleWrap: {
      flex: 1,
      gap: 3,
      minWidth: 0
    },
    transcriptSummaryCreateCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: 12,
      marginBottom: 12,
      padding: 14,
      shadowColor: colors.ink,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 18
    },
    transcriptSummaryCreateHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 11
    },
    transcriptSummaryCountPill: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 42,
      justifyContent: 'center',
      width: 42
    },
    transcriptSummaryCountText: {
      color: colors.primary,
      fontSize: 17
    },
    transcriptSummaryCreateCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0
    },
    transcriptSummaryCreateTitle: {
      color: colors.ink,
      fontSize: 15
    },
    transcriptSummaryCreateMeta: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17
    },
    transcriptSummaryLanguageButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 12
    },
    transcriptSummaryLanguageCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0
    },
    transcriptSummaryLanguageLabel: {
      color: colors.mutedStrong,
      fontSize: 10,
      letterSpacing: 1.1,
      textTransform: 'uppercase'
    },
    transcriptSummaryLanguageValue: {
      color: colors.ink,
      fontSize: 15
    },
    transcriptSummaryCreateButton: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 16
    },
    transcriptSummaryCreateButtonDisabled: {
      backgroundColor: colors.mutedStrong,
      opacity: 0.68
    },
    transcriptSummaryCreateButtonText: {
      color: '#fff',
      fontSize: 14
    },
    transcriptSummaryList: {
      gap: 12,
      paddingBottom: 24
    },
    transcriptSummarySavedCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      padding: 14
    },
    transcriptSummaryLanguageCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.divider,
      borderRadius: 16,
      borderWidth: 1,
      gap: 10,
      padding: 12
    },
    transcriptSummaryLanguageCardHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10
    },
    transcriptSummaryLanguageIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 34,
      justifyContent: 'center',
      width: 34
    },
    transcriptSummaryLanguageCardCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0
    },
    transcriptSummarySavedLanguage: {
      color: colors.ink,
      fontSize: 14
    },
    transcriptSummarySavedMeta: {
      color: colors.mutedStrong,
      fontSize: 11
    },
    transcriptSummaryPlayButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 36,
      justifyContent: 'center',
      width: 36
    },
    transcriptSummaryPlayButtonActive: {
      backgroundColor: colors.primary
    },
    transcriptSummaryPlayButtonDisabled: {
      opacity: 0.58
    },
    transcriptSummarySavedText: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 21
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 8
    },
    segmentButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      minHeight: 46,
      justifyContent: 'center',
      paddingHorizontal: 10
    },
    segmentButtonActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    segmentButtonText: {
      color: colors.ink,
      fontSize: 13
    },
    segmentButtonTextActive: {
      color: colors.primary
    },
    summaryBlock: {
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      gap: 4,
      paddingTop: 10
    },
    summaryActionRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between'
    },
    summaryButton: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    summaryButtonText: {
      color: colors.primary,
      fontSize: 13
    },
    summaryLanguage: {
      color: colors.ink,
      fontSize: 14
    },
    summaryPlayButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 12
    },
    summaryPlayButtonActive: {
      backgroundColor: colors.primary
    },
    summaryPlayButtonText: {
      color: colors.primary,
      fontSize: 12
    },
    summaryPlayButtonTextActive: {
      color: '#fff'
    },
    summaryLanguageIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderRadius: 16,
      borderWidth: 1,
      height: 34,
      justifyContent: 'center',
      width: 34
    },
    summaryLanguageList: {
      gap: 9,
      marginBottom: 16,
      marginTop: 16
    },
    summaryLanguageRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 56,
      paddingHorizontal: 12
    },
    summaryLanguageRowSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    summaryLanguageRowText: {
      color: colors.ink,
      fontSize: 15
    },
    summarySectionContent: {
      paddingBottom: 30
    },
    summarySectionBlock: {
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      gap: 12,
      paddingBottom: 16,
      paddingTop: 12
    },
    summarySectionHint: {
      color: colors.mutedStrong,
      fontSize: 13,
      lineHeight: 19
    },
    summaryLanguageChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    summaryLanguageChip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 7,
      minHeight: 36,
      paddingHorizontal: 12
    },
    summaryLanguageChipSelected: {
      backgroundColor: colors.primarySoft
    },
    summaryLanguageChipText: {
      color: colors.mutedStrong,
      fontSize: 13
    },
    summaryLanguageChipTextSelected: {
      color: colors.primary
    },
    summaryCreateButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 7,
      minHeight: 38,
      paddingHorizontal: 14
    },
    summaryCreateButtonText: {
      color: '#fff',
      fontSize: 13
    },
    summaryHistoryHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between'
    },
    summaryCountPill: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      minWidth: 30,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    summaryCountPillText: {
      color: colors.primary,
      fontSize: 12
    },
    summaryVersionGroup: {
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      gap: 10,
      paddingTop: 12
    },
    summaryVersionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between'
    },
    summaryVersionCopy: {
      flex: 1,
      gap: 2
    },
    summaryVersionTitle: {
      color: colors.ink,
      fontSize: 14
    },
    summaryVersionMeta: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17
    },
    summaryVersionCountPill: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      justifyContent: 'center',
      minWidth: 28,
      paddingHorizontal: 9,
      paddingVertical: 5
    },
    summaryVersionCountText: {
      color: colors.primary,
      fontSize: 12
    },
    summaryHistoryRow: {
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      gap: 8,
      paddingTop: 12
    },
    summaryHistoryLanguageRow: {
      alignItems: 'center',
      backgroundColor: colors.screen,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      minHeight: 62,
      paddingHorizontal: 2,
      paddingVertical: 6
    },
    summaryHistoryLanguageRowActive: {
      backgroundColor: colors.primarySoft
    },
    summaryHistoryPlayButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 36,
      justifyContent: 'center',
      width: 36
    },
    summaryHistoryPlayButtonActive: {
      backgroundColor: colors.primary
    },
    summaryHistoryCopy: {
      flex: 1,
      gap: 3
    },
    summaryHistoryLanguageText: {
      color: colors.ink,
      fontSize: 14
    },
    summaryHistoryPreviewText: {
      color: colors.mutedStrong,
      fontSize: 12,
      lineHeight: 17
    },
    summaryEmptyRow: {
      alignItems: 'center',
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingTop: 14
    },
    transcriptPreview: {
      backgroundColor: colors.surface,
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      gap: 6,
      marginTop: 10,
      padding: 10
    }
  });
}


/**
 * Formatting and derivation helpers for the Interpreter screen.
 *
 * Pure functions that were defined inside the screen file. Moving them out is
 * what brings that file under the size limit, and each is now reachable from a
 * test.
 */

function formatMeetingType(type: InterpreterMeetingType): string {
  if (type === 'ONE_ON_ONE') {
    return '1-on-1';
  }

  if (type === 'LEVEL_1') {
    return 'Level 1';
  }

  return 'Level 3';
}

function formatStatus(status: InterpreterMeeting['status']): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatInterpreterMeetingDisplayStatus(meeting: InterpreterMeeting): string {
  if (meeting.status === 'SCHEDULED') {
    return 'Not started';
  }

  return formatStatus(meeting.status);
}

function getInterpreterMeetingStatusIcon(status: InterpreterMeeting['status']): IoniconName {
  if (status === 'ENDED') {
    return 'checkmark-circle-outline';
  }

  if (status === 'LIVE') {
    return 'pulse-outline';
  }

  return 'time-outline';
}

function formatInterpreterMeetingRowMeta(meeting: InterpreterMeeting): string {
  const meetingType = formatMeetingType(meeting.meetingType);

  if (!meeting.scheduledAtIso) {
    return meetingType;
  }

  return `${meetingType} · ${formatInterpreterMeetingDateTime(meeting.scheduledAtIso)}`;
}

function formatInterpreterMeetingDateTime(isoValue: string): string {
  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return 'Scheduled';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short'
  }).format(date);
}

function formatInterpreterMeetingCreatedDateFilter(filter: InterpreterMeetingCreatedDateFilter): string {
  if (filter === 'today') {
    return 'Today';
  }

  if (filter === 'last_7_days') {
    return 'Last 7 days';
  }

  if (filter === 'last_30_days') {
    return 'Last 30 days';
  }

  return 'Any date';
}

function getStatusColor(status: InterpreterMeeting['status']): string {
  if (status === 'LIVE') {
    return '#07816f';
  }

  if (status === 'ENDED') {
    return '#64748b';
  }

  return '#2563eb';
}

function getStatusSoftColor(status: InterpreterMeeting['status'], colors: AppColors): string {
  if (status === 'LIVE') {
    return colors.primarySoft;
  }

  if (status === 'ENDED') {
    return colors.surfaceElevated;
  }

  return colors.blueSoft;
}

function formatRealtimeStatus(status: InterpreterRealtimeStatus): string {
  switch (status) {
    case 'connecting':
      return 'Preparing secure audio';
    case 'listening':
      return 'Listening only';
    case 'speaking':
      return 'Interpreter responding';
    case 'ready':
      return 'Ready';
    case 'error':
      return 'Needs attention';
    case 'closed':
    default:
      return 'Interpreter idle';
  }
}

function formatLiveVersionStatus(status: InterpreterLiveVersionStatus, readyLanguageCount: number): string {
  if (readyLanguageCount > 0) {
    return `${readyLanguageCount} ready`;
  }

  switch (status) {
    case 'connecting':
      return 'Starting';
    case 'listening':
      return 'Listening';
    case 'responding':
      return 'Speaking';
    case 'stopped':
      return 'Stopped';
    case 'ended':
      return 'Ended';
    case 'error':
      return 'Needs attention';
    case 'ready':
    default:
      return 'Ready';
  }
}

function getInterpreterTextOverlapLength(currentText: string, incomingText: string): number {
  const maxOverlap = Math.min(currentText.length, incomingText.length, 200);

  for (let length = maxOverlap; length >= 20; length -= 1) {
    const currentSuffix = normalizeInterpreterCompareText(currentText.slice(-length));
    const incomingPrefix = normalizeInterpreterCompareText(incomingText.slice(0, length));

    if (currentSuffix && currentSuffix === incomingPrefix) {
      return length;
    }
  }

  return 0;
}

function normalizeInterpreterCompareText(value: string): string {
  return value
    .replace(/[.,!?;:"'`()[\]{}<>/\\|_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function getRealtimeStatusDescription(status: InterpreterRealtimeStatus): string {
  switch (status) {
    case 'connecting':
      return 'Creating the encrypted live interpreter session.';
    case 'listening':
      return 'Listening only. Tap Respond when the speaker is done.';
    case 'speaking':
      return 'The voice agent is responding.';
    case 'ready':
      return 'Session is ready for a speaker.';
    case 'error':
      return 'The live session stopped before it could complete.';
    case 'closed':
    default:
      return 'Tap Listen when everyone in the meeting is ready.';
  }
}

function getLiveModeDescription(mode: InterpreterLiveMode): string {
  switch (mode) {
    case 'connecting':
      return 'Opening the secure interpreter session.';
    case 'listening':
      return 'Listening only. Tap Respond when you want the AI to speak.';
    case 'choosing':
      return 'Tap Listen to start the next turn.';
    case 'responding':
      return 'AI is speaking. Tap Listen to interrupt and start a new turn.';
    case 'idle':
    default:
      return 'Tap Listen to start the live voice session.';
  }
}

function getLivePrimaryActionLabel(
  mode: InterpreterLiveMode,
  status: InterpreterRealtimeStatus
): string {
  if (status === 'connecting' || mode === 'connecting') {
    return 'Preparing';
  }

  if (mode === 'listening') {
    return 'Respond';
  }

  if (mode === 'responding') {
    return 'Listen';
  }

  if (mode === 'choosing') {
    return 'Listen';
  }

  return 'Listen';
}

function getInterpreterAudioSignalBadge({
  colors,
  isPlaying,
  isPreparing,
  liveMode,
  liveStatus
}: {
  colors: AppColors;
  isPlaying: boolean;
  isPreparing: boolean;
  liveMode: InterpreterLiveMode;
  liveStatus: InterpreterRealtimeStatus;
}): InterpreterAudioSignalBadge {
  if (isPlaying || liveStatus === 'speaking' || liveMode === 'responding') {
    return {
      backgroundColor: colors.primarySoft,
      iconName: 'volume-high-outline',
      label: 'AI speaking',
      textColor: colors.primary
    };
  }

  if (isPreparing) {
    return {
      backgroundColor: '#fef3c7',
      iconName: 'sync-outline',
      label: 'Preparing',
      textColor: '#92400e'
    };
  }

  if (liveStatus === 'connecting' || liveMode === 'connecting') {
    return {
      backgroundColor: '#fef3c7',
      iconName: 'radio-outline',
      label: 'Opening audio',
      textColor: '#92400e'
    };
  }

  if (liveMode === 'listening') {
    return {
      backgroundColor: '#dcfce7',
      iconName: 'ear-outline',
      label: 'Listening',
      textColor: '#047857'
    };
  }

  if (liveStatus === 'error') {
    return {
      backgroundColor: '#fee2e2',
      iconName: 'warning-outline',
      label: 'Needs attention',
      textColor: '#b91c1c'
    };
  }

  return {
    backgroundColor: colors.surfaceElevated,
    iconName: 'mic-off-outline',
    label: 'Ready',
    textColor: colors.mutedStrong
  };
}

function getLiveFooterHint(mode: InterpreterLiveMode): string {
  switch (mode) {
    case 'connecting':
      return 'Opening secure audio.';
    case 'listening':
      return 'Speech is being captured and saved for this meeting.';
    case 'choosing':
      return 'Tap Listen to continue.';
    case 'responding':
      return 'AI audio is playing through the live session.';
    case 'idle':
    default:
      return 'Tap Listen to start live speech and transcription.';
  }
}

function getRealtimeStatusColor(status: InterpreterRealtimeStatus): string {
  switch (status) {
    case 'connecting':
      return '#f59e0b';
    case 'listening':
      return '#10b981';
    case 'speaking':
      return '#2563eb';
    case 'error':
      return '#dc2626';
    case 'ready':
      return '#0f766e';
    case 'closed':
    default:
      return '#94a3b8';
  }
}

function isActiveRealtimeStatus(status: InterpreterRealtimeStatus): boolean {
  return status === 'connecting' || status === 'listening' || status === 'speaking' || status === 'ready';
}

function getSessionPoolLanguages(
  meeting: InterpreterMeeting,
  selectedLanguageCode: string
): InterpreterLanguage[] {
  return sortInterpreterLanguagesForPriority(meeting.interpreterLanguages, selectedLanguageCode)
    .slice(0, INTERPRETER_MAX_RESPONSE_LANGUAGES);
}

function sortInterpreterLanguagesForPriority(
  languages: InterpreterLanguage[],
  selectedLanguageCode: string
): InterpreterLanguage[] {
  return [...languages].sort((leftLanguage, rightLanguage) => {
    if (leftLanguage.code === selectedLanguageCode) {
      return -1;
    }

    if (rightLanguage.code === selectedLanguageCode) {
      return 1;
    }

    if (leftLanguage.code === 'en-US') {
      return -1;
    }

    if (rightLanguage.code === 'en-US') {
      return 1;
    }

    return leftLanguage.label.localeCompare(rightLanguage.label);
  });
}

function formatInterpreterAudioOutputRoute(route: InterpreterAudioOutputRoute): string {
  if (route === 'bluetooth') {
    return 'Bluetooth or external output';
  }

  if (route === 'system') {
    return 'Device media output';
  }

  return 'Phone loudspeaker';
}

function getInterpreterAudioOutputRouteHint(route: InterpreterAudioOutputRoute): string {
  if (route === 'bluetooth') {
    return 'Use the connected Bluetooth or external route selected by the device.';
  }

  if (route === 'system') {
    return 'Use the same output route as music and videos, including Bluetooth.';
  }

  return 'Use media playback and keep interpreter speech away from the earpiece.';
}

function getInterpreterAudioOutputRouteIcon(route: InterpreterAudioOutputRoute): IoniconName {
  if (route === 'bluetooth') {
    return 'bluetooth-outline';
  }

  if (route === 'system') {
    return 'phone-portrait-outline';
  }

  return 'volume-high-outline';
}

function getInterpreterDetectedAudioDevices(
  inputDevices: InterpreterRealtimeMediaDevice[],
  outputDevices: InterpreterRealtimeMediaDevice[]
): InterpreterRealtimeMediaDevice[] {
  const allDevices = [...outputDevices, ...inputDevices];
  const externalDevices = allDevices.filter(isInterpreterExternalAudioDevice);
  const builtInDevices = allDevices.filter((device) => !isInterpreterExternalAudioDevice(device));
  const prioritizedDevices = externalDevices.length ? [...externalDevices, ...builtInDevices.slice(0, 2)] : builtInDevices.slice(0, 4);

  return prioritizedDevices.filter((device, index, devices) =>
    devices.findIndex((currentDevice) => currentDevice.kind === device.kind && currentDevice.deviceId === device.deviceId) === index
  );
}

function getInterpreterAudioDeviceStatus(
  inputDevices: InterpreterRealtimeMediaDevice[],
  outputDevices: InterpreterRealtimeMediaDevice[]
): { detail: string; iconName: IoniconName; title: string } {
  const externalInputs = inputDevices.filter(isInterpreterExternalAudioDevice);
  const externalOutputs = outputDevices.filter(isInterpreterExternalAudioDevice);
  const firstInputName = externalInputs[0] ? getInterpreterAudioDeviceDisplayName(externalInputs[0]) : '';
  const firstOutputName = externalOutputs[0] ? getInterpreterAudioDeviceDisplayName(externalOutputs[0]) : '';

  if (externalInputs.length && externalOutputs.length) {
    return {
      detail: firstInputName === firstOutputName
        ? `${firstInputName} is visible as both microphone and speaker.`
        : `${firstOutputName} is visible for output; ${firstInputName} is visible for microphone input.`,
      iconName: 'bluetooth-outline',
      title: 'External speaker and microphone detected'
    };
  }

  if (externalOutputs.length) {
    return {
      detail: `${firstOutputName} is visible as an external speaker. A paired microphone is not exposed by the OS runtime.`,
      iconName: 'volume-high-outline',
      title: 'External speaker detected'
    };
  }

  if (externalInputs.length) {
    return {
      detail: `${firstInputName} is visible as an external microphone. Speaker output will follow the selected media route.`,
      iconName: 'mic-outline',
      title: 'External microphone detected'
    };
  }

  return {
    detail: 'No Bluetooth, USB, or third-party audio route is visible. Synzapp will use the phone media output and microphone.',
    iconName: 'phone-portrait-outline',
    title: 'No external audio device detected'
  };
}

function getInterpreterAudioDeviceDisplayName(device: InterpreterRealtimeMediaDevice): string {
  const label = device.label.trim();

  if (!label || /^audio output \d+$/i.test(label)) {
    return 'System audio output';
  }

  if (/^microphone \d+$/i.test(label)) {
    return 'System microphone';
  }

  return label;
}

function getInterpreterAudioDeviceMetadata(device: InterpreterRealtimeMediaDevice, hasPairedRoute: boolean): string {
  const roleLabel = device.kind === 'audioinput' ? 'Microphone input' : 'Speaker output';
  const connectionLabel = isInterpreterExternalAudioDevice(device) ? 'External device' : 'Built-in or OS-selected route';
  const pairLabel = hasPairedRoute
    ? device.kind === 'audioinput'
      ? 'matching speaker visible'
      : 'matching microphone visible'
    : device.kind === 'audioinput'
      ? 'matching speaker not exposed'
      : 'matching microphone not exposed';

  return `${roleLabel} · ${connectionLabel} · ${pairLabel}`;
}

function getInterpreterAudioDeviceIcon(device: InterpreterRealtimeMediaDevice): IoniconName {
  const label = normalizeInterpreterAudioDeviceLabel(device.label);

  if (label.includes('bluetooth') || label.includes('airpod') || label.includes('headset') || label.includes('headphone') || label.includes('earbud') || label.includes('buds')) {
    return 'bluetooth-outline';
  }

  if (label.includes('usb') || label.includes('external') || label.includes('dock') || label.includes('interface')) {
    return 'hardware-chip-outline';
  }

  return device.kind === 'audioinput' ? 'mic-outline' : 'volume-high-outline';
}

function isInterpreterExternalAudioDevice(device: InterpreterRealtimeMediaDevice): boolean {
  const label = normalizeInterpreterAudioDeviceLabel(device.label);

  if (!label || /^audio output \d+$/.test(label) || /^microphone \d+$/.test(label)) {
    return false;
  }

  const builtInMarkers = [
    'built in',
    'built-in',
    'default',
    'iphone',
    'ipad',
    'receiver',
    'speakerphone',
    'phone microphone',
    'system audio',
    'system microphone'
  ];

  if (builtInMarkers.some((marker) => label.includes(marker))) {
    return false;
  }

  const externalMarkers = [
    'airpod',
    'anker',
    'beats',
    'bluetooth',
    'bose',
    'car audio',
    'dock',
    'earbud',
    'external',
    'headphone',
    'headset',
    'interface',
    'jabra',
    'jbl',
    'pixel buds',
    'rode',
    'shure',
    'sony',
    'usb',
    'yeti'
  ];

  return externalMarkers.some((marker) => label.includes(marker));
}

function normalizeInterpreterAudioDeviceLabel(label: string): string {
  return label.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function getInterpreterAudioInputLabel(
  devices: InterpreterRealtimeMediaDevice[],
  deviceId: string | null
): string {
  if (!deviceId) {
    return 'Automatic microphone';
  }

  const device = devices.find((currentDevice) => currentDevice.deviceId === deviceId);

  return device ? getInterpreterAudioDeviceDisplayName(device) : 'Selected microphone';
}

function getInterpreterAudioInputHint(device: InterpreterRealtimeMediaDevice): string {
  const label = normalizeInterpreterAudioDeviceLabel(device.label);

  if (label.includes('bluetooth') || label.includes('airpod') || label.includes('headset')) {
    return 'External audio device with microphone support when the OS route allows it.';
  }

  if (label.includes('usb') || label.includes('external')) {
    return 'Third-party microphone exposed by the mobile OS.';
  }

  return 'Microphone reported by the native audio runtime.';
}

function getInterpreterAudioInputIcon(device: InterpreterRealtimeMediaDevice): IoniconName {
  return getInterpreterAudioDeviceIcon(device);
}

function formatDateTime(dateIso: string): string {
  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getInterpreterLanguageLabel(details: InterpreterMeetingDetails, languageCode: string): string {
  return details.meeting.interpreterLanguages.find((language) => language.code === languageCode)?.label
    || languageCode;
}

function getDraftScheduleDate(scheduledAtIso: string | null): Date {
  if (!scheduledAtIso) {
    return new Date(Date.now() + 60 * 60_000);
  }

  const parsedDate = new Date(scheduledAtIso);

  return Number.isNaN(parsedDate.getTime()) ? new Date(Date.now() + 60 * 60_000) : parsedDate;
}

function getLanguageLabel(languages: InterpreterLanguage[], code: string): string {
  return languages.find((language) => language.code === code)?.label || code;
}

function getControlledLiveLanguageCapability(language: InterpreterLanguage): {
  kind: 'validated' | 'gpt-live';
  label: string;
} {
  return language.realtimeTargetSupported
    ? { kind: 'validated', label: 'Validated voice' }
    : { kind: 'gpt-live', label: 'GPT Live' };
}

function getInterpreterVoiceProfile(
  voiceProfiles: InterpreterVoiceProfile[],
  voiceId?: string | null
): InterpreterVoiceProfile {
  const fallbackProfiles = voiceProfiles.length ? voiceProfiles : FALLBACK_INTERPRETER_VOICES;
  const requestedVoiceId = voiceId || DEFAULT_INTERPRETER_VOICE_ID;

  return fallbackProfiles.find((voice) => voice.id === requestedVoiceId) ||
    fallbackProfiles.find((voice) => voice.id === DEFAULT_INTERPRETER_VOICE_ID) ||
    FALLBACK_INTERPRETER_VOICES[0];
}

function formatScheduleDate(scheduledAtIso: string | null): string {
  const date = getDraftScheduleDate(scheduledAtIso);

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function formatScheduleTime(
  scheduledAtIso: string | null,
  timeFormat: InterpreterCreateDraft['timeFormat']
): string {
  const date = getDraftScheduleDate(scheduledAtIso);

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    hour12: timeFormat === '12h',
    minute: '2-digit'
  }).format(date);
}

function getNextReminderLeadMinutes(currentLeadMinutes: number | null): number {
  const currentIndex = REMINDER_LEAD_MINUTES.findIndex((leadMinutes) => leadMinutes === currentLeadMinutes);
  const nextIndex = currentIndex < 0 ? 2 : (currentIndex + 1) % REMINDER_LEAD_MINUTES.length;

  return REMINDER_LEAD_MINUTES[nextIndex];
}

function formatReminderLeadMinutes(leadMinutes: number | null): string {
  if (!leadMinutes) {
    return 'No reminder';
  }

  if (leadMinutes < 60) {
    return `${leadMinutes} min before`;
  }

  if (leadMinutes === 60) {
    return '1 hour before';
  }

  if (leadMinutes === 1440) {
    return '1 day before';
  }

  return `${leadMinutes / 60} hours before`;
}

function getNextReminderFrequency(
  currentFrequency: InterpreterCreateDraft['reminderFrequency']
): InterpreterCreateDraft['reminderFrequency'] {
  const currentIndex = REMINDER_FREQUENCIES.findIndex((frequency) => frequency === currentFrequency);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % REMINDER_FREQUENCIES.length;

  return REMINDER_FREQUENCIES[nextIndex];
}

function formatReminderFrequency(frequency: InterpreterCreateDraft['reminderFrequency']): string {
  if (frequency === 'daily') {
    return 'Daily';
  }

  if (frequency === 'weekly') {
    return 'Weekly';
  }

  if (frequency === 'once') {
    return 'Once';
  }

  return 'None';
}

function getInterpreterSummaryAudioKey(summaryId: string, languageCode: string): string {
  return `${summaryId}:${languageCode}`;
}

function getInterpreterSegmentAudioKey(
  meetingId: string,
  translationId: string,
  languageCode: string
): string {
  return `${meetingId}:${translationId}:${languageCode}`;
}

function getHistoryAudioKey(meetingId: string, item: InterpreterLiveHistoryItem): string | null {
  return item.translationId ? getInterpreterSegmentAudioKey(meetingId, item.translationId, item.languageCode) : null;
}

function getInterpreterVoicePreviewAudioKey(voiceId: string, languageCode: string): string {
  return `${voiceId}:${languageCode}`;
}

function getInterpreterTranscriptAudioKey(segmentId: string, languageCode: string, voiceId: string): string {
  return `${segmentId}:${languageCode}:${voiceId}`;
}

function sortTranscriptLibraryItems(items: InterpreterTranscriptLibraryItem[]): InterpreterTranscriptLibraryItem[] {
  return [...items].sort((left, right) => {
    const leftDate = left.createdAtIso || '';
    const rightDate = right.createdAtIso || '';

    return rightDate.localeCompare(leftDate);
  });
}

function getCleanedTranscriptLibraryItems(items: InterpreterTranscriptLibraryItem[]): InterpreterTranscriptLibraryItem[] {
  return items.filter((item) => Boolean(item.segmentId && item.cleanedText?.trim()));
}

function buildTranscriptLibrarySummarySourceText(items: InterpreterTranscriptLibraryItem[]): string {
  return getCleanedTranscriptLibraryItems(items)
    .sort((leftItem, rightItem) => (leftItem.createdAtIso || '').localeCompare(rightItem.createdAtIso || ''))
    .map((item, index) => {
      const timestamp = formatTranscriptLibraryTimestamp(item.createdAtIso);
      const transcriptText = (item.cleanedText || '').trim();

      return [`Saved transcript ${index + 1}`, timestamp, transcriptText].join('\n');
    })
    .join('\n\n')
    .trim();
}

function getTranscriptLibraryFilterLabel(filter: InterpreterTranscriptLibraryFilter): string {
  switch (filter) {
    case 'ready':
      return 'Ready read-aloud audio';
    case 'preparing':
      return 'Preparing read-aloud audio';
    case 'needs_audio':
      return 'Needs read-aloud audio';
    case 'all':
    default:
      return 'All saved transcripts';
  }
}

function getTranscriptAudioArtifactForLanguage(
  item: InterpreterTranscriptLibraryItem,
  languageCode: string,
  voiceId: string
): InterpreterTranscriptAudioArtifact | null {
  return [...item.audioArtifacts]
    .filter((artifact) => artifact.languageCode === languageCode && artifact.voice === voiceId)
    .sort((left, right) => (right.updatedAtIso || '').localeCompare(left.updatedAtIso || ''))[0] || null;
}

function getTranscriptArtifactStatusLabel(artifact: InterpreterTranscriptAudioArtifact | null): string {
  if (!artifact) {
    return 'Not prepared';
  }

  if (artifact.status === 'ready') {
    return 'Ready';
  }

  if (artifact.status === 'processing') {
    return 'Preparing';
  }

  if (artifact.status === 'failed') {
    return 'Retry needed';
  }

  return 'Queued';
}

function getTranscriptArtifactStatusIcon(artifact: InterpreterTranscriptAudioArtifact | null): IoniconName {
  if (!artifact) {
    return 'time-outline';
  }

  if (artifact.status === 'ready') {
    return 'checkmark-circle-outline';
  }

  if (artifact.status === 'failed') {
    return 'alert-circle-outline';
  }

  return 'hourglass-outline';
}

function getTranscriptArtifactStatusColor(
  artifact: InterpreterTranscriptAudioArtifact | null,
  colors: AppColors
): string {
  if (artifact?.status === 'ready') {
    return colors.success;
  }

  if (artifact?.status === 'failed') {
    return colors.red;
  }

  if (artifact?.status === 'processing' || artifact?.status === 'queued') {
    return colors.amber;
  }

  return colors.mutedStrong;
}

function formatTranscriptLibraryTimestamp(createdAtIso: string): string {
  const date = new Date(createdAtIso);

  if (Number.isNaN(date.getTime())) {
    return 'Saved transcript';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatAudioDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const roundedSeconds = Math.floor(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function sanitizeFileNamePart(value: string, fallback: string): string {
  const safeValue = value
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return safeValue || fallback;
}

async function getLocalTranscriptAudioShareUri(
  meetingName: string,
  context: InterpreterTranscriptAudioPlayerContext,
  shareCache: Record<string, string>
): Promise<string> {
  const cachedUri = shareCache[context.audioKey];

  if (cachedUri) {
    const cachedInfo = await FileSystem.getInfoAsync(cachedUri).catch(() => null);

    if (cachedInfo?.exists) {
      return cachedUri;
    }
  }

  if (!context.artifact.downloadUrl) {
    throw new Error('Prepared transcript audio is not available yet.');
  }

  if (context.artifact.downloadUrl.startsWith('file://')) {
    return context.artifact.downloadUrl;
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('Audio sharing is not available on this device.');
  }

  await FileSystem.makeDirectoryAsync(INTERPRETER_TRANSCRIPT_AUDIO_SHARE_DIR, {
    intermediates: true
  }).catch(() => undefined);

  const safeMeetingName = sanitizeFileNamePart(meetingName, 'meeting');
  const safeSegmentId = sanitizeFileNamePart(context.item.segmentId || context.artifact.segmentId, 'transcript');
  const safeLanguageCode = sanitizeFileNamePart(context.languageCode, 'language');
  const safeVoice = sanitizeFileNamePart(context.artifact.voice, 'voice');
  const fileUri = `${INTERPRETER_TRANSCRIPT_AUDIO_SHARE_DIR}${safeMeetingName}-${safeSegmentId}-${safeLanguageCode}-${safeVoice}.mp3`;
  const existingFile = await FileSystem.getInfoAsync(fileUri).catch(() => null);

  if (existingFile?.exists) {
    return fileUri;
  }

  await FileSystem.downloadAsync(context.artifact.downloadUrl, fileUri);

  return fileUri;
}

function normalizeInterpreterManualResponseText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function getOptionalInterpreterInCallManagerRuntime(): any | null {
  try {
    const module = require('react-native-incall-manager');

    return module?.default || module;
  } catch {
    return null;
  }
}

function getOptionalInterpreterRtcView(): React.ComponentType<any> | null {
  try {
    const runtime = require('react-native-webrtc') as { RTCView?: React.ComponentType<any> };

    return runtime?.RTCView || null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Interpreter could not complete that action.';
}

/**
 * The Interpreter screen's modals and panels.
 *
 * Lifted out unchanged. Each is handed its state and callbacks and owns nothing
 * else, which is what made them separable from the room itself.
 */

function InterpreterTranscriptLibraryModal({
  activeAudioKey,
  audioPlayerContext,
  audioPlayerDuration,
  audioPlayerMode,
  audioPlayerPosition,
  activeSummaryAudioKey,
  availableLanguages,
  creatingSummaryLanguageCode,
  filter,
  isBusy,
  isAudioLoaded,
  isAudioPlaying,
  isAudioSharing,
  isLoading,
  isOpen,
  isSummaryAudioPlaying,
  items,
  meeting,
  onAudioPlaybackRateChange,
  onAudioPlayerClose,
  onAudioPlayerExpand,
  onAudioPlayerMinimize,
  onAudioSeek,
  onAudioShare,
  onAudioSkip,
  onAudioTogglePlayback,
  onClose,
  onCreateSummary,
  onDeleteTranscripts,
  onFilterChange,
  onPlayAudio,
  onPlaySummary,
  onPrepareAudio,
  onRefresh,
  onSelectLanguage,
  onSummaryLanguageChange,
  playbackRate,
  preparingAudioKey,
  preparingSummaryAudioKey,
  selectedLanguageBySegment,
  selectedSummaryLanguageCode,
  selectedTargetLanguageCode,
  summaries,
  voiceId
}: InterpreterTranscriptLibraryModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [languagePickerSegmentId, setLanguagePickerSegmentId] = useState<string | null>(null);
  const [isTranscriptSummaryPanelOpen, setIsTranscriptSummaryPanelOpen] = useState(false);
  const sortedLanguages = useMemo(() =>
    [...availableLanguages].sort((first, second) => first.label.localeCompare(second.label)),
    [availableLanguages]
  );
  const transcriptLibrarySummaries = useMemo(() =>
    summaries
      .filter((summary) => summary.versionId === INTERPRETER_TRANSCRIPT_LIBRARY_SUMMARY_VERSION_ID)
      .sort((leftSummary, rightSummary) =>
        new Date(rightSummary.createdAtIso).getTime() - new Date(leftSummary.createdAtIso).getTime()
      ),
    [summaries]
  );
  const pickerItem = languagePickerSegmentId
    ? items.find((item) => item.segmentId === languagePickerSegmentId) || null
    : null;
  const selectedPickerLanguageCode = pickerItem?.segmentId
    ? selectedLanguageBySegment[pickerItem.segmentId] || selectedTargetLanguageCode || 'en-US'
    : selectedTargetLanguageCode || 'en-US';
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isDeletingTranscripts, setIsDeletingTranscripts] = useState(false);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const filteredItems = useMemo(() =>
    items.filter((item) => doesTranscriptLibraryItemMatchFilter(item, filter)),
    [filter, items]
  );
  const selectableSegmentIds = useMemo(() =>
    filteredItems
      .map((item) => item.segmentId)
      .filter((segmentId): segmentId is string => Boolean(segmentId)),
    [filteredItems]
  );
  const selectedSegmentIdSet = useMemo(() => new Set(selectedSegmentIds), [selectedSegmentIds]);
  const isAllVisibleSelected = Boolean(
    selectableSegmentIds.length &&
    selectableSegmentIds.every((segmentId) => selectedSegmentIdSet.has(segmentId))
  );
  const selectedCount = selectedSegmentIds.length;

  useEffect(() => {
    if (!isOpen) {
      setIsDeleteMode(false);
      setSelectedSegmentIds([]);
      setLanguagePickerSegmentId(null);
      setIsTranscriptSummaryPanelOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedSegmentIds((currentIds) => currentIds.filter((segmentId) => selectableSegmentIds.includes(segmentId)));
  }, [selectableSegmentIds]);

  function enterDeleteMode() {
    if (!items.length) {
      Alert.alert('No saved transcripts', 'There are no saved transcripts to delete yet.');
      return;
    }

    setIsDeleteMode(true);
    setSelectedSegmentIds([]);
  }

  function openOptionsMenu() {
    const deleteOption = 'Delete transcripts';
    const filterOption = 'Filter transcripts';
    const cancelOption = 'Cancel';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 2,
          destructiveButtonIndex: 0,
          disabledButtonIndices: items.length ? [] : [0],
          options: [deleteOption, filterOption, cancelOption],
          title: 'Transcripts'
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            enterDeleteMode();
          }

          if (buttonIndex === 1) {
            openFilterMenu();
          }
        }
      );
      return;
    }

    Alert.alert('Transcripts', undefined, [
      { onPress: enterDeleteMode, style: 'destructive', text: deleteOption },
      { onPress: openFilterMenu, text: filterOption },
      { style: 'cancel', text: cancelOption }
    ]);
  }

  function openFilterMenu() {
    const filterOptions: Array<{ filter: InterpreterTranscriptLibraryFilter; label: string }> = [
      { filter: 'all', label: 'All transcripts' },
      { filter: 'ready', label: 'Ready read-aloud audio' },
      { filter: 'preparing', label: 'Preparing read-aloud audio' },
      { filter: 'needs_audio', label: 'Needs read-aloud audio' }
    ];
    const labels = filterOptions.map((option) => option.label);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: labels.length,
          options: [...labels, 'Cancel'],
          title: 'Filter transcripts'
        },
        (buttonIndex) => {
          const selectedOption = filterOptions[buttonIndex];

          if (selectedOption) {
            onFilterChange(selectedOption.filter);
            setSelectedSegmentIds([]);
          }
        }
      );
      return;
    }

    Alert.alert('Filter transcripts', undefined, [
      ...filterOptions.map((option) => ({
        onPress: () => {
          onFilterChange(option.filter);
          setSelectedSegmentIds([]);
        },
        text: option.label
      })),
      { style: 'cancel', text: 'Cancel' }
    ]);
  }

  function toggleTranscriptSelection(segmentId: string) {
    setSelectedSegmentIds((currentIds) =>
      currentIds.includes(segmentId)
        ? currentIds.filter((currentId) => currentId !== segmentId)
        : [...currentIds, segmentId]
    );
  }

  function toggleSelectAllVisible() {
    if (isAllVisibleSelected) {
      setSelectedSegmentIds((currentIds) =>
        currentIds.filter((segmentId) => !selectableSegmentIds.includes(segmentId))
      );
      return;
    }

    setSelectedSegmentIds((currentIds) => [...new Set([...currentIds, ...selectableSegmentIds])]);
  }

  function confirmDeleteSelectedTranscripts() {
    if (!selectedCount || isDeletingTranscripts) {
      return;
    }

    Alert.alert(
      'Delete saved transcripts?',
      `${selectedCount} saved transcript${selectedCount === 1 ? '' : 's'} and prepared read-aloud audio will be deleted. This cannot be undone.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: async () => {
            try {
              setIsDeletingTranscripts(true);
              await onDeleteTranscripts(selectedSegmentIds);
              setSelectedSegmentIds([]);
              setIsDeleteMode(false);
            } finally {
              setIsDeletingTranscripts(false);
            }
          },
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
  }

  if (!isOpen) {
    return null;
  }

  return (
    <View
      style={[
        styles.transcriptLibraryOverlay,
        {
          paddingBottom: Math.max(insets.bottom + 12, 20),
          paddingTop: Math.max(insets.top + 10, 20)
        }
      ]}
    >
        <View style={styles.transcriptLibraryHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
            <Ionicons color={appTheme.colors.ink} name="chevron-back" size={23} />
          </Pressable>
          <View style={styles.transcriptLibraryTitleWrapCentered}>
            <Text numberOfLines={1} style={styles.transcriptLibraryTitleCentered}>{meeting.meetingName}</Text>
          </View>
          <Pressable
            disabled={isDeletingTranscripts}
            onPress={openOptionsMenu}
            style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.ink} name="ellipsis-horizontal" size={22} />
          </Pressable>
        </View>

        <View style={styles.transcriptLibraryToolbar}>
          <View style={styles.transcriptLibraryToolbarCopy}>
            <Text style={styles.transcriptLibraryToolbarTitle}>
              {isDeleteMode ? `${selectedCount} selected` : getTranscriptLibraryFilterLabel(filter)}
            </Text>
            <Text style={styles.transcriptLibraryToolbarMeta}>
              {filteredItems.length} of {items.length} saved transcript{items.length === 1 ? '' : 's'}
            </Text>
          </View>
          {isDeleteMode ? (
            <View style={styles.transcriptLibrarySelectionActions}>
              <TranscriptLibraryCheckbox
                isChecked={isAllVisibleSelected}
                isDisabled={!selectableSegmentIds.length}
                label="Select all"
                onPress={toggleSelectAllVisible}
                styles={styles}
              />
              {selectedCount ? (
                <Pressable
                  disabled={isDeletingTranscripts}
                  onPress={confirmDeleteSelectedTranscripts}
                  style={({ pressed }) => [
                    styles.transcriptDeleteButton,
                    isDeletingTranscripts && styles.transcriptDeleteButtonDisabled,
                    pressed && styles.pressed
                  ]}
                >
                  {isDeletingTranscripts ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons color="#fff" name="trash-outline" size={15} />
                  )}
                  <Text style={styles.transcriptDeleteButtonText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.transcriptLibraryToolbarActions}>
              <Pressable
                disabled={!items.length}
                onPress={() => setIsTranscriptSummaryPanelOpen(true)}
                style={({ pressed }) => [
                  styles.transcriptSummaryButton,
                  !items.length && styles.transcriptSummaryButtonDisabled,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons color={appTheme.colors.primary} name="sparkles-outline" size={16} />
                <Text style={styles.transcriptSummaryButtonText}>Summary</Text>
              </Pressable>
              <Pressable
                disabled={isLoading}
                onPress={onRefresh}
                style={({ pressed }) => [styles.transcriptRefreshButton, pressed && styles.pressed]}
              >
                {isLoading ? (
                  <ActivityIndicator color={appTheme.colors.primary} size="small" />
                ) : (
                  <Ionicons color={appTheme.colors.primary} name="refresh" size={16} />
                )}
                <Text style={styles.transcriptRefreshButtonText}>Refresh</Text>
              </Pressable>
            </View>
          )}
        </View>

        {audioPlayerContext && audioPlayerMode === 'minimized' ? (
          <InterpreterTranscriptAudioMiniPlayer
            context={audioPlayerContext}
            isPlaying={isAudioPlaying}
            onClose={onAudioPlayerClose}
            onExpand={onAudioPlayerExpand}
            onTogglePlayback={onAudioTogglePlayback}
            position={audioPlayerPosition}
          />
        ) : null}

        <ScrollView
          contentContainerStyle={[
            styles.transcriptLibraryList,
            audioPlayerContext && audioPlayerMode === 'minimized' && styles.transcriptLibraryListWithMiniPlayer
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.length ? filteredItems.map((item) => {
            const segmentId = item.segmentId || '';
            const languageCode = selectedLanguageBySegment[segmentId] || selectedTargetLanguageCode || 'en-US';
            const language = sortedLanguages.find((currentLanguage) => currentLanguage.code === languageCode)
              || sortedLanguages[0]
              || { code: 'en-US', label: 'English' };
            const audioKey = getInterpreterTranscriptAudioKey(segmentId, language.code, voiceId);
            const artifact = getTranscriptAudioArtifactForLanguage(item, language.code, voiceId);
            const isPreparing = preparingAudioKey === audioKey ||
              artifact?.status === 'queued' ||
              artifact?.status === 'processing';
            const isPlayingThisItem = activeAudioKey === audioKey && isAudioPlaying;
            const transcriptText = (item.cleanedText || item.text || '').trim();
            const isSelected = Boolean(segmentId && selectedSegmentIdSet.has(segmentId));

            return (
              <Pressable
                accessibilityRole={isDeleteMode ? 'checkbox' : undefined}
                accessibilityState={isDeleteMode ? { checked: isSelected, disabled: !segmentId } : undefined}
                disabled={!isDeleteMode || !segmentId}
                key={segmentId || item.createdAtIso}
                onPress={() => segmentId && toggleTranscriptSelection(segmentId)}
                style={({ pressed }) => [
                  styles.transcriptLibraryCard,
                  isDeleteMode && styles.transcriptLibraryCardSelectable,
                  isSelected && styles.transcriptLibraryCardSelected,
                  pressed && styles.pressed
                ]}
              >
                <View style={styles.transcriptLibraryCardHeader}>
                  {isDeleteMode ? (
                    <TranscriptLibraryCheckbox
                      isChecked={isSelected}
                      isDisabled={!segmentId}
                      onPress={() => segmentId && toggleTranscriptSelection(segmentId)}
                      styles={styles}
                    />
                  ) : null}
                  <View style={styles.transcriptLibraryCardTitleWrap}>
                    <Text style={styles.transcriptLibraryCardTitle}>Clean transcript</Text>
                    <Text style={styles.transcriptLibraryCardMeta}>
                      {formatTranscriptLibraryTimestamp(item.createdAtIso)}
                    </Text>
                  </View>
                  <View style={styles.transcriptStatusPill}>
                    <Ionicons
                      color={getTranscriptArtifactStatusColor(artifact, appTheme.colors)}
                      name={getTranscriptArtifactStatusIcon(artifact)}
                      size={13}
                    />
                    <Text
                      style={[
                        styles.transcriptStatusPillText,
                        { color: getTranscriptArtifactStatusColor(artifact, appTheme.colors) }
                      ]}
                    >
                      {getTranscriptArtifactStatusLabel(artifact)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.transcriptLibraryBodyText}>{transcriptText}</Text>

                {artifact?.spokenText ? (
                  <View style={styles.transcriptSpokenPreview}>
                    <Text style={styles.transcriptSpokenPreviewLabel}>Prepared read-aloud text</Text>
                    <Text style={styles.transcriptSpokenPreviewText}>{artifact.spokenText}</Text>
                  </View>
                ) : null}

                <View style={styles.transcriptLibraryActions}>
                  <Pressable
                    disabled={!segmentId || isDeleteMode}
                    onPress={() => setLanguagePickerSegmentId(segmentId)}
                    style={({ pressed }) => [styles.transcriptLanguageButton, pressed && styles.pressed]}
                  >
                    <Ionicons color={appTheme.colors.primary} name="language-outline" size={16} />
                    <Text numberOfLines={1} style={styles.transcriptLanguageButtonText}>
                      {language.label}
                    </Text>
                    <Ionicons color={appTheme.colors.mutedStrong} name="chevron-down" size={15} />
                  </Pressable>
                  <Pressable
                    disabled={!segmentId || isPreparing || isDeleteMode}
                    onPress={() => onPrepareAudio(item)}
                    style={({ pressed }) => [
                      styles.transcriptPrepareButton,
                      (!segmentId || isPreparing || isDeleteMode) && styles.transcriptPrepareButtonDisabled,
                      pressed && styles.pressed
                    ]}
                  >
                    {isPreparing ? (
                      <ActivityIndicator color={appTheme.colors.primary} size="small" />
                    ) : (
                      <Ionicons
                        color={artifact?.status === 'ready' ? appTheme.colors.success : appTheme.colors.primary}
                        name={artifact?.status === 'ready' ? 'checkmark-circle-outline' : 'cloud-download-outline'}
                        size={16}
                      />
                    )}
                    <Text
                      style={[
                        styles.transcriptPrepareButtonText,
                        artifact?.status === 'ready' && styles.transcriptPrepareButtonTextReady
                      ]}
                    >
                      {isPreparing ? 'Preparing' : artifact?.status === 'ready' ? 'Prepared' : 'Prepare Audio'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={!segmentId || isPreparing || isDeleteMode}
                    onPress={() => onPlayAudio(item)}
                    style={({ pressed }) => [
                      styles.transcriptPlayButton,
                      (!segmentId || isPreparing || isDeleteMode) && styles.transcriptPlayButtonDisabled,
                      pressed && styles.pressed
                    ]}
                  >
                    {isPreparing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Ionicons color="#fff" name={isPlayingThisItem ? 'pause' : 'play'} size={17} />
                    )}
                    <Text style={styles.transcriptPlayButtonText}>
                      {isPreparing ? 'Preparing' : isPlayingThisItem ? 'Pause' : 'Play'}
                    </Text>
                  </Pressable>
                </View>

                {artifact?.status === 'failed' && artifact.errorMessage ? (
                  <Text style={styles.transcriptLibraryError}>{artifact.errorMessage}</Text>
                ) : null}
              </Pressable>
            );
          }) : (
            <View style={styles.transcriptLibraryEmpty}>
              <Ionicons color={appTheme.colors.mutedStrong} name="document-text-outline" size={28} />
              <Text style={styles.transcriptLibraryEmptyTitle}>No saved transcripts yet</Text>
              <Text style={styles.transcriptLibraryEmptyText}>
                {items.length
                  ? 'No saved transcripts match the current filter.'
                  : 'Use Listen and Respond in the live room. Each cleaned transcript will appear here after it is saved.'}
              </Text>
            </View>
          )}
        </ScrollView>

        <InterpreterTranscriptAudioLanguagePicker
          isOpen={Boolean(pickerItem)}
          languages={sortedLanguages}
          onClose={() => setLanguagePickerSegmentId(null)}
          onSelectLanguage={(languageCode) => {
            if (pickerItem?.segmentId) {
              onSelectLanguage(pickerItem.segmentId, languageCode);
            }
            setLanguagePickerSegmentId(null);
          }}
          selectedLanguageCode={selectedPickerLanguageCode}
        />
        {audioPlayerContext ? (
          <InterpreterTranscriptAudioPlayerModal
            context={audioPlayerContext}
            duration={audioPlayerDuration}
            isOpen={audioPlayerMode === 'expanded'}
            isLoaded={isAudioLoaded}
            isPlaying={isAudioPlaying}
            isSharing={isAudioSharing}
            onClose={onAudioPlayerClose}
            onMinimize={onAudioPlayerMinimize}
            onPlaybackRateChange={onAudioPlaybackRateChange}
            onSeek={onAudioSeek}
            onShare={onAudioShare}
            onSkip={onAudioSkip}
            onTogglePlayback={onAudioTogglePlayback}
            playbackRate={playbackRate}
            position={audioPlayerPosition}
          />
        ) : null}
        <InterpreterTranscriptSummaryModal
          activeSummaryAudioKey={activeSummaryAudioKey}
          availableLanguages={sortedLanguages}
          creatingLanguageCode={creatingSummaryLanguageCode}
          isAudioPlaying={isSummaryAudioPlaying}
          isBusy={isBusy}
          isOpen={isTranscriptSummaryPanelOpen}
          items={items}
          onClose={() => setIsTranscriptSummaryPanelOpen(false)}
          onCreateSummary={onCreateSummary}
          onPlaySummary={onPlaySummary}
          onSelectLanguage={onSummaryLanguageChange}
          preparingSummaryAudioKey={preparingSummaryAudioKey}
          selectedLanguageCode={selectedSummaryLanguageCode}
          summaries={transcriptLibrarySummaries}
        />
      </View>
  );
}

function InterpreterLiveRoomModal({
  activeHistoryAudioKey,
  audioLevel,
  availableLanguages,
  detectedSourceLanguageCode,
  details,
  hasReplayableInterpretationAudio,
  historyItems,
  isHistoryAudioPlaying,
  isInterpretationAudioPlaying,
  isPreparingInterpretationAudio,
  isHistoryOpen,
  isOpen,
  isTranscriptOpen,
  languageSessionState,
  liveCleanTranscript,
  liveVersions,
  liveMode,
  liveStatus,
  liveTranscript,
  liveTranslation,
  onClose,
  onEnd,
  onHistoryClose,
  onListen,
  onOpenHistory,
  onOpenSettings,
  onOpenSummary,
  onOpenTranscript,
  onOpenTranscriptLibrary,
  onPlayHistoryItem,
  onReplayInterpretationAudio,
  activeInputName,
  liveNotice,
  onRespond,
  onSelectVersion,
  onToggleMicrophone,
  onTranscriptClose,
  preparingHistoryAudioKey,
  respondingLanguageCode,
  remoteAudioActivity,
  remoteAudioBaseline,
  remoteAudioStreamUrls,
  selectedLanguageCode,
  selectedLiveVersionId,
  onSelectTargetLanguage,
  settingsPanel,
  summaryPanel,
  summaryCount,
  transcriptLibraryCount,
  transcriptLibraryPanel,
  voiceProfile
}: InterpreterLiveRoomModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [isTargetLanguagePickerOpen, setIsTargetLanguagePickerOpen] = useState(false);
  const liveSelectableLanguages = availableLanguages.length ? availableLanguages : details.meeting.interpreterLanguages;
  const selectedLanguage = liveSelectableLanguages.find((language) => language.code === selectedLanguageCode)
    || liveSelectableLanguages[0];
  const detectedSourceLanguageLabel = detectedSourceLanguageCode
    ? getLanguageLabel(liveSelectableLanguages, detectedSourceLanguageCode)
    : null;
  const transcriptScrollRef = useRef<ScrollView | null>(null);
  const audioSignalBadge = getInterpreterAudioSignalBadge({
    colors: appTheme.colors,
    isPlaying: isInterpretationAudioPlaying,
    isPreparing: isPreparingInterpretationAudio,
    liveMode,
    liveStatus
  });
  const primaryActionLabel = getLivePrimaryActionLabel(liveMode, liveStatus);
  const primaryActionIcon: IoniconName = liveMode === 'listening'
    ? 'volume-high-outline'
    : 'mic-outline';
  const controlledVoiceRemoteStreamUrl =
    remoteAudioStreamUrls[INTERPRETER_CONTROLLED_VOICE_SESSION_KEY] || null;
  const cleanedTranscriptText = liveCleanTranscript.trim();
  const selectedOutputLanguageLabel = selectedLanguage?.label || 'English';
  const liveTranslationRouteText = `${detectedSourceLanguageLabel || 'Auto detect'} to ${selectedOutputLanguageLabel}`;
  const canChangeTargetLanguage = liveStatus !== 'connecting' && liveMode !== 'responding';
  const shouldShowSignalBadge =
    isInterpretationAudioPlaying ||
    isPreparingInterpretationAudio ||
    liveMode === 'connecting' ||
    liveMode === 'listening' ||
    liveMode === 'responding' ||
    liveStatus === 'connecting' ||
    liveStatus === 'error';
  const roomMetaText = shouldShowSignalBadge
    ? `${formatMeetingType(details.meeting.meetingType)} · ${audioSignalBadge.label}`
    : formatMeetingType(details.meeting.meetingType);
  const hasLiveRemoteAudioSignal = hasInterpreterRemoteAudioSignal(remoteAudioActivity, remoteAudioBaseline);
  const isControlledResponseActive = liveMode === 'responding' || liveStatus === 'speaking';
  const remoteAudioLevel = typeof remoteAudioActivity?.audioLevel === 'number'
    ? remoteAudioActivity.audioLevel
    : hasLiveRemoteAudioSignal
      ? 0.42
      : isControlledResponseActive
        ? 0.32
      : 0;
  // The WebRTC stats used for remote audio level can briefly dip even while iOS
  // is audibly playing the GPT Live response. Keep the visualizer active for
  // the controlled response state, and use stats only as the motion intensity.
  const isAudioVisualizerPlaying =
    isInterpretationAudioPlaying || isControlledResponseActive;
  const handlePrimaryAction = () => {
    if (liveStatus === 'connecting' || liveMode === 'connecting') {
      return;
    }

    if (liveMode === 'listening') {
      onRespond();
      return;
    }

    onToggleMicrophone();
  };

  useEffect(() => {
    if (!liveTranscript.trim() && !liveCleanTranscript.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      transcriptScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [liveCleanTranscript, liveTranscript]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={isOpen}>
      <View
        style={[
          styles.liveRoomScreen,
          {
            paddingBottom: Math.max(insets.bottom + 12, 18),
            paddingTop: Math.max(insets.top + 6, 18)
          }
        ]}
      >
        {controlledVoiceRemoteStreamUrl ? (
          <InterpreterRemoteAudioSink
            streamUrl={controlledVoiceRemoteStreamUrl}
            styles={styles}
          />
        ) : null}
        <View style={styles.liveRoomHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
            <Ionicons color={appTheme.colors.ink} name="chevron-down" size={24} />
          </Pressable>
          <View style={styles.liveRoomTitleWrap}>
            <Text style={styles.liveRoomTitle}>{details.meeting.meetingName}</Text>
            <Text style={styles.liveRoomMeta}>
              {roomMetaText}
            </Text>
          </View>
          <Pressable
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.ink} name={ROOM_SETTINGS_ICON_NAME} size={21} />
          </Pressable>
          <Pressable
            hitSlop={10}
            onPress={onOpenTranscriptLibrary}
            style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.ink} name="library-outline" size={21} />
            {transcriptLibraryCount > 0 ? (
              <View style={styles.liveHeaderCountBadge}>
                <Text style={styles.liveHeaderCountBadgeText}>{Math.min(transcriptLibraryCount, 99)}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={onEnd} style={({ pressed }) => [styles.liveEndButton, pressed && styles.pressed]}>
            <Text style={styles.liveEndButtonText}>End</Text>
          </Pressable>
        </View>

        <View style={styles.liveRoomStage}>
          {shouldShowSignalBadge ? (
            <View style={[styles.liveStatusBadge, { backgroundColor: audioSignalBadge.backgroundColor }]}>
              <Ionicons color={audioSignalBadge.textColor} name={audioSignalBadge.iconName} size={14} />
              <Text style={[styles.liveStatusBadgeText, { color: audioSignalBadge.textColor }]}>
                {audioSignalBadge.label}
              </Text>
            </View>
          ) : null}
          <View style={styles.liveLanguageRouteCard}>
            <View style={styles.liveLanguageRouteOption}>
              <Text style={styles.liveLanguageRouteLabel}>Input</Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.liveLanguageRouteValue,
                  !detectedSourceLanguageLabel && styles.liveLanguageRouteValueMuted
                ]}
              >
                {detectedSourceLanguageLabel || (liveMode === 'listening' ? 'Auto-detecting' : 'Auto detect')}
              </Text>
            </View>
            <View style={styles.liveLanguageRouteDivider} />
            <Pressable
              disabled={!canChangeTargetLanguage}
              onPress={() => setIsTargetLanguagePickerOpen(true)}
              style={({ pressed }) => [
                styles.liveLanguageRouteOption,
                styles.liveLanguageRoutePressable,
                !canChangeTargetLanguage && styles.liveLanguageRouteOptionDisabled,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.liveLanguageRouteLabel}>Output</Text>
              <View style={styles.liveLanguageRouteValueRow}>
                <Text numberOfLines={1} style={styles.liveLanguageRouteValue}>
                  {selectedOutputLanguageLabel}
                </Text>
                <Ionicons
                  color={canChangeTargetLanguage ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                  name="chevron-down"
                  size={16}
                />
              </View>
            </Pressable>
          </View>
          <InterpreterAudioSpectrum
            audioLevel={audioLevel}
            compact
            isPlaying={isAudioVisualizerPlaying}
            isPreparingOutput={liveMode === 'responding' && !isAudioVisualizerPlaying}
            isListening={liveMode === 'listening'}
            outputAudioLevel={remoteAudioLevel}
          />
          <Pressable
            disabled={liveStatus === 'connecting'}
            onPress={handlePrimaryAction}
            style={({ pressed }) => [
              styles.liveCenterAction,
              liveMode === 'listening' && styles.liveCenterActionListening,
              pressed && styles.pressed
            ]}
          >
            {liveStatus === 'connecting' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons color="#fff" name={primaryActionIcon} size={24} />
            )}
          <Text style={styles.liveCenterActionText}>{primaryActionLabel}</Text>
          </Pressable>
          <Text style={styles.liveRoomStateText}>{getLiveModeDescription(liveMode)}</Text>
          {/* A passing hint, styled as guidance rather than as a failure. An
              interpreter that shows an error banner mid-meeting makes people
              stop trusting it, and they stop using it in front of customers. */}
          {liveNotice ? (
            <Text style={styles.liveRoomNoticeText}>{liveNotice}</Text>
          ) : null}
          {/* Only shown for an external microphone. Naming the phone's own
              would be noise; naming a DJI Mic confirms it actually engaged. */}
          {activeInputName && !/iphone|built-?in/i.test(activeInputName) ? (
            <Text style={styles.liveRoomNoticeText}>Microphone: {activeInputName}</Text>
          ) : null}
        </View>

        <View style={styles.liveTranslationPanel}>
          <ScrollView
            ref={transcriptScrollRef}
            contentContainerStyle={styles.liveTranslationContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.liveTranslationScroll}
          >
            <View style={[styles.liveTranslationCard, styles.liveTranslationCardPrimary]}>
              <View style={styles.liveTranslationCardHeader}>
                <Ionicons color={appTheme.colors.primary} name="sparkles-outline" size={15} />
                <Text style={styles.liveTranslationLabel}>Clean transcription</Text>
              </View>
              <Text numberOfLines={1} style={styles.liveTranslationRouteText}>
                {liveTranslationRouteText}
              </Text>
              <Text
                style={[
                  styles.liveTranslationBodyText,
                  !cleanedTranscriptText && styles.liveTranslationPlaceholder
                ]}
              >
                {cleanedTranscriptText || 'A readable transcript will be saved after speech is captured.'}
              </Text>
            </View>
            <Text style={styles.liveTranslationFooterNote}>
              {getLiveFooterHint(liveMode)}
            </Text>
          </ScrollView>
        </View>
        <InterpreterLiveOutputLanguagePicker
          isOpen={isTargetLanguagePickerOpen}
          languages={liveSelectableLanguages}
          onClose={() => setIsTargetLanguagePickerOpen(false)}
          onSelectLanguage={(languageCode) => {
            onSelectTargetLanguage(languageCode);
            setIsTargetLanguagePickerOpen(false);
          }}
          selectedLanguageCode={selectedLanguageCode}
        />
        {settingsPanel}
        {transcriptLibraryPanel}
      </View>
    </Modal>
  );
}

function InterpreterCreateModal({
  isBusy,
  isOpen,
  languages,
  onClose,
  onError,
  onSubmit,
  voiceProfiles
}: InterpreterCreateModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const fallbackLanguages = languages.length ? languages : [
    { code: 'en-US', label: 'English' },
    { code: 'es-MX', label: 'Spanish' }
  ];
  const defaultLanguageCodes = DEFAULT_LANGUAGE_CODES.filter((code) =>
    fallbackLanguages.some((language) => language.code === code)
  );
  const [draft, setDraft] = useState<InterpreterCreateDraft>(() => ({
    autoDetectSourceLanguage: true,
    interpreterVoiceId: DEFAULT_INTERPRETER_VOICE_ID,
    invitedUserIds: [],
    isScheduled: false,
    languageCodes: defaultLanguageCodes.length ? defaultLanguageCodes : [fallbackLanguages[0]?.code || 'en-US'],
    meetingName: '',
    meetingType: 'ONE_ON_ONE',
    reminderEnabled: false,
    reminderFrequency: 'once',
    reminderLeadMinutes: 15,
    scheduledAtIso: null,
    sourceLanguageCode: 'en-US',
    timeFormat: '12h'
  }));
  const selectedVoice = getInterpreterVoiceProfile(voiceProfiles, draft.interpreterVoiceId);
  const scheduledDate = getDraftScheduleDate(draft.scheduledAtIso);
  const [schedulePickerMode, setSchedulePickerMode] = useState<'date' | 'time' | null>(null);
  const [schedulePickerDraftDate, setSchedulePickerDraftDate] = useState<Date>(scheduledDate);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      interpreterVoiceId: currentDraft.interpreterVoiceId || DEFAULT_INTERPRETER_VOICE_ID,
      languageCodes: currentDraft.languageCodes.length
        ? currentDraft.languageCodes.filter((code) => fallbackLanguages.some((language) => language.code === code))
        : defaultLanguageCodes.length
          ? defaultLanguageCodes
          : [fallbackLanguages[0]?.code || 'en-US']
    }));
  }, [defaultLanguageCodes, fallbackLanguages, isOpen]);

  function patchDraft(patch: Partial<InterpreterCreateDraft>) {
    setDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  function updateScheduleDate(nextDate: Date) {
    patchDraft({
      scheduledAtIso: mergeScheduleDate(scheduledDate, nextDate).toISOString()
    });
  }

  function updateScheduleTime(nextTime: Date) {
    patchDraft({
      scheduledAtIso: mergeScheduleTime(scheduledDate, nextTime).toISOString()
    });
  }

  function setScheduleEnabled(isScheduled: boolean) {
    patchDraft({
      isScheduled,
      scheduledAtIso: isScheduled ? draft.scheduledAtIso || getDraftScheduleDate(null).toISOString() : null
    });
  }

  function openSchedulePicker(mode: 'date' | 'time') {
    const pickerDate = getDraftScheduleDate(draft.scheduledAtIso);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        is24Hour: draft.timeFormat === '24h',
        mode,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'dismissed' || !selectedDate) {
            return;
          }

          if (mode === 'date') {
            updateScheduleDate(selectedDate);
            return;
          }

          updateScheduleTime(selectedDate);
        },
        value: pickerDate
      });
      return;
    }

    setSchedulePickerDraftDate(pickerDate);
    setSchedulePickerMode(mode);
  }

  function confirmSchedulePicker() {
    if (!schedulePickerMode) {
      return;
    }

    if (schedulePickerMode === 'date') {
      updateScheduleDate(schedulePickerDraftDate);
    } else {
      updateScheduleTime(schedulePickerDraftDate);
    }

    setSchedulePickerMode(null);
  }

  async function submit() {
    const meetingName = draft.meetingName.trim();

    if (!meetingName) {
      onError('Add a meeting name before creating the interpreter session.', 'Interpreter session needs a name');
      return;
    }

    const languageCodes = draft.languageCodes.length
      ? draft.languageCodes
      : defaultLanguageCodes.length
        ? defaultLanguageCodes
        : [fallbackLanguages[0]?.code || 'en-US'];

    await onSubmit({
      ...draft,
      autoDetectSourceLanguage: true,
      invitedUserIds: [],
      languageCodes,
      meetingName,
      sourceLanguageCode: null
    });
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <Pressable onPress={onClose} style={styles.modalOverlay}>
        <Pressable style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>INTERPRETER SESSION</Text>
              <Text style={styles.modalTitle}>Create meeting</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="close" size={24} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.settingsSection}>
              <Text style={styles.sectionLabel}>Meeting name</Text>
              <TextInput
                onChangeText={(meetingName) => patchDraft({ meetingName })}
                placeholder="Team meeting, coaching, handoff..."
                placeholderTextColor={appTheme.colors.muted}
                style={styles.input}
                value={draft.meetingName}
              />
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionLabel}>Meeting type</Text>
              <View style={styles.segmentedRow}>
                {(['ONE_ON_ONE', 'LEVEL_1', 'LEVEL_3'] as InterpreterMeetingType[]).map((meetingType) => {
                  const isSelected = draft.meetingType === meetingType;

                  return (
                    <Pressable
                      key={meetingType}
                      onPress={() => patchDraft({ meetingType })}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        isSelected && styles.segmentButtonActive,
                        pressed && styles.pressed
                      ]}
                    >
                      <Text style={[styles.segmentButtonText, isSelected && styles.languageChipTextActive]}>
                        {formatMeetingType(meetingType)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionLabel}>Interpreter speaker</Text>
              <Text style={styles.selectionTitle}>{selectedVoice.label}</Text>
              <View style={styles.languageGrid}>
                {(voiceProfiles.length ? voiceProfiles : FALLBACK_INTERPRETER_VOICES).map((voice) => {
                  const isSelected = draft.interpreterVoiceId === voice.id;

                  return (
                    <Pressable
                      key={voice.id}
                      onPress={() => patchDraft({ interpreterVoiceId: voice.id })}
                      style={({ pressed }) => [
                        styles.languageToggle,
                        isSelected && styles.languageToggleActive,
                        pressed && styles.pressed
                      ]}
                    >
                      <Ionicons
                        color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                        name={isSelected ? 'checkmark-circle' : 'mic-outline'}
                        size={17}
                      />
                      <Text style={[styles.languageToggleText, isSelected && styles.languageChipTextActive]}>
                        {voice.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.settingsSection}>
              <View style={styles.inlineOption}>
                <Ionicons color={appTheme.colors.primary} name={draft.isScheduled ? 'calendar' : 'calendar-outline'} size={18} />
                <View style={styles.selectionBody}>
                  <Text style={styles.sectionLabel}>Schedule</Text>
                  <Text style={styles.selectionTitle}>{draft.isScheduled ? 'Scheduled meeting' : 'Start when opened'}</Text>
                </View>
                <AppSwitch
                  onValueChange={setScheduleEnabled}
                  value={draft.isScheduled}
                />
              </View>
              {draft.isScheduled ? (
                <View style={styles.segmentedRow}>
                  <Pressable onPress={() => openSchedulePicker('date')} style={styles.secondaryButton}>
                    <Ionicons color={appTheme.colors.primary} name="calendar-outline" size={17} />
                    <Text style={styles.secondaryButtonText}>{formatScheduleDate(draft.scheduledAtIso)}</Text>
                  </Pressable>
                  <Pressable onPress={() => openSchedulePicker('time')} style={styles.secondaryButton}>
                    <Ionicons color={appTheme.colors.primary} name="time-outline" size={17} />
                    <Text style={styles.secondaryButtonText}>{formatScheduleTime(draft.scheduledAtIso, draft.timeFormat)}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <Pressable
              disabled={isBusy}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.createSessionButton,
                isBusy && styles.disabledButton,
                pressed && styles.pressed
              ]}
            >
              {isBusy ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.summaryCreateButtonText}>Create session</Text>
            </Pressable>
          </ScrollView>
          <ScheduleDateTimePickerModal
            date={schedulePickerDraftDate}
            is24Hour={draft.timeFormat === '24h'}
            isOpen={Boolean(schedulePickerMode)}
            mode={schedulePickerMode || 'date'}
            onCancel={() => setSchedulePickerMode(null)}
            onChange={setSchedulePickerDraftDate}
            onConfirm={confirmSchedulePicker}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InterpreterTranscriptAudioPlayerModal({
  context,
  duration,
  isOpen,
  isLoaded,
  isPlaying,
  isSharing,
  onClose,
  onMinimize,
  onPlaybackRateChange,
  onSeek,
  onShare,
  onSkip,
  onTogglePlayback,
  playbackRate,
  position
}: InterpreterTranscriptAudioPlayerModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;
  const safeDuration = duration > 0 ? duration : 0;
  const safePosition = Math.max(0, Math.min(position || 0, safeDuration || position || 0));
  const progress = safeDuration ? Math.max(0, Math.min(safePosition / safeDuration, 1)) : 0;
  const title = (context.item.cleanedText || context.item.text || 'Saved transcript').trim();
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
    onMoveShouldSetPanResponderCapture: (_, gestureState) =>
      gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        translateY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (
        (Math.abs(gestureState.dy) < 8 && Math.abs(gestureState.dx) < 8) ||
        gestureState.dy > 86 ||
        gestureState.vy > 1.2
      ) {
        translateY.setValue(0);
        onMinimize();
        return;
      }

      Animated.spring(translateY, {
        friction: 8,
        tension: 90,
        toValue: 0,
        useNativeDriver: true
      }).start();
    }
  }), [onMinimize, translateY]);

  useEffect(() => {
    if (isOpen) {
      translateY.setValue(0);
    }
  }, [isOpen, translateY]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="slide" onRequestClose={onMinimize} visible={isOpen}>
      <Animated.View
        style={[
          styles.transcriptAudioFullScreen,
          {
            paddingBottom: Math.max(insets.bottom + 20, 30),
            paddingTop: Math.max(insets.top + 12, 22),
            transform: [{ translateY }]
          }
        ]}
      >
        <View style={styles.transcriptAudioFullHeader}>
          <Pressable
            disabled={!isLoaded || isSharing}
            onPress={onShare}
            style={({ pressed }) => [
              styles.transcriptAudioFullShareButton,
              (!isLoaded || isSharing) && styles.transcriptAudioButtonDisabled,
              pressed && styles.pressed
            ]}
          >
            {isSharing ? (
              <ActivityIndicator color={appTheme.colors.primary} size="small" />
            ) : (
              <Ionicons color={appTheme.colors.primary} name="share-outline" size={20} />
            )}
          </Pressable>
          <View style={styles.transcriptAudioFullTitleWrap}>
            <Text numberOfLines={1} style={styles.transcriptAudioPlayerTitle}>
              {context.languageLabel}
            </Text>
            <Text numberOfLines={1} style={styles.transcriptAudioPlayerSubtitle}>
              {formatAudioDuration(safePosition)} of {formatAudioDuration(safeDuration)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.transcriptAudioPlayerCloseButton, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.mutedStrong} name="close" size={19} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Minimize audio player"
          hitSlop={{ bottom: 12, left: 32, right: 32, top: 12 }}
          onPress={onMinimize}
          style={({ pressed }) => [
            styles.transcriptAudioSwipeHandleWrap,
            pressed && styles.pressed
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.transcriptAudioSwipeHandle} />
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.transcriptAudioFullContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.transcriptAudioTranscriptCard}>
            <Text style={styles.transcriptAudioTranscriptLabel}>Transcript</Text>
            <Text style={styles.transcriptAudioTranscriptText}>{title}</Text>
          </View>
        </ScrollView>

        <View style={styles.transcriptAudioFullControls}>
          <Pressable
            disabled={!isLoaded || !safeDuration}
            onLayout={(event) => setProgressTrackWidth(event.nativeEvent.layout.width)}
            onPress={(event) => {
              if (!isLoaded || !safeDuration || !progressTrackWidth) {
                return;
              }

              onSeek((event.nativeEvent.locationX / progressTrackWidth) * safeDuration);
            }}
            style={styles.transcriptAudioProgressTrack}
          >
            <View style={[styles.transcriptAudioProgressFill, { width: `${progress * 100}%` }]} />
            <View
              style={[
                styles.transcriptAudioProgressThumb,
                { left: `${progress * 100}%` }
              ]}
            />
          </Pressable>

          <View style={styles.transcriptAudioTimeRow}>
            <Text style={styles.transcriptAudioTimeText}>{formatAudioDuration(safePosition)}</Text>
            <Text style={styles.transcriptAudioTimeText}>{formatAudioDuration(safeDuration)}</Text>
          </View>

          <View style={styles.transcriptAudioFullControlRow}>
            <Pressable
              disabled={!isLoaded}
              onPress={() => onSkip(-10)}
              style={({ pressed }) => [
                styles.transcriptAudioCircleButton,
                !isLoaded && styles.transcriptAudioButtonDisabled,
                pressed && styles.pressed
              ]}
            >
              <Ionicons color={appTheme.colors.ink} name="play-back" size={18} />
              <Text style={styles.transcriptAudioTinyText}>10</Text>
            </Pressable>
            <Pressable
              disabled={!isLoaded}
              onPress={onTogglePlayback}
              style={({ pressed }) => [
                styles.transcriptAudioFullPlayPauseButton,
                !isLoaded && styles.transcriptAudioButtonDisabled,
                pressed && styles.pressed
              ]}
            >
              <Ionicons color="#fff" name={isPlaying ? 'pause' : 'play'} size={27} />
            </Pressable>
            <Pressable
              disabled={!isLoaded}
              onPress={() => onSkip(10)}
              style={({ pressed }) => [
                styles.transcriptAudioCircleButton,
                !isLoaded && styles.transcriptAudioButtonDisabled,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.transcriptAudioTinyText}>10</Text>
              <Ionicons color={appTheme.colors.ink} name="play-forward" size={18} />
            </Pressable>
          </View>

          <View style={styles.transcriptAudioRateRow}>
            {INTERPRETER_TRANSCRIPT_AUDIO_PLAYBACK_RATES.map((rate) => {
              const isSelected = playbackRate === rate;

              return (
                <Pressable
                  key={rate}
                  onPress={() => onPlaybackRateChange(rate)}
                  style={({ pressed }) => [
                    styles.transcriptAudioRateButton,
                    isSelected && styles.transcriptAudioRateButtonSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <Text
                    style={[
                      styles.transcriptAudioRateButtonText,
                      isSelected && styles.transcriptAudioRateButtonTextSelected
                    ]}
                  >
                    {rate}x
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

function InterpreterSummaryLanguageModal({
  activeAudioKey,
  isBusy,
  isAudioPlaying,
  isOpen,
  languages,
  onClose,
  onError,
  onPlaySummary,
  onSubmit,
  preparingAudioKey,
  presentation = 'modal',
  selectedVersion,
  summaries
}: InterpreterSummaryLanguageModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [selectedLanguageCodes, setSelectedLanguageCodes] = useState<string[]>([]);
  const availableLanguages = useMemo(() => languages.length ? languages : [
    { code: 'en-US', label: 'English' },
    { code: 'es-MX', label: 'Spanish' }
  ], [languages]);
  const groupedSummaries = useMemo(() => groupInterpreterSummariesByVersion(summaries), [summaries]);

  useEffect(() => {
    if (isOpen) {
      setSelectedLanguageCodes(availableLanguages.map((language) => language.code));
    }
  }, [availableLanguages, isOpen]);

  function toggleLanguage(languageCode: string) {
    setSelectedLanguageCodes((currentCodes) =>
      currentCodes.includes(languageCode)
        ? currentCodes.filter((currentCode) => currentCode !== languageCode)
        : [...currentCodes, languageCode]
    );
  }

  function submit() {
    if (!selectedLanguageCodes.length) {
      onError('Select at least one language for the meeting summary.', 'Summary needs attention');
      return;
    }

    void onSubmit(selectedLanguageCodes);
  }

  if (!isOpen) {
    return null;
  }

  const content = (
      <View
        style={[
          presentation === 'overlay' ? styles.roomSettingsOverlay : styles.liveDetailScreen,
          { paddingBottom: Math.max(insets.bottom + 14, 24), paddingTop: Math.max(insets.top + 10, 22) }
        ]}
      >
        <View style={styles.liveRoomHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
            <Ionicons color={appTheme.colors.ink} name="chevron-down" size={24} />
          </Pressable>
          <View style={styles.liveRoomTitleWrap}>
            <Text style={styles.liveRoomTitle}>Meeting summary</Text>
            <Text style={styles.liveRoomMeta}>Create and replay spoken summaries</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.summarySectionContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summarySectionBlock}>
            <Text style={styles.liveRoomSectionLabel}>Summary language</Text>
            <Text style={styles.summarySectionHint}>
              {selectedVersion
                ? `Choose languages for a spoken recap of Version ${selectedVersion.sequence}.`
                : 'Choose languages for a spoken, human-style recap of this meeting.'}
            </Text>
            <View style={styles.summaryLanguageChipWrap}>
              {availableLanguages.map((language) => {
                const isSelected = selectedLanguageCodes.includes(language.code);

                return (
                  <Pressable
                    key={language.code}
                    onPress={() => toggleLanguage(language.code)}
                    style={[
                      styles.summaryLanguageChip,
                      isSelected && styles.summaryLanguageChipSelected
                    ]}
                  >
                    <Ionicons
                      color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={17}
                    />
                    <Text
                      style={[
                        styles.summaryLanguageChipText,
                        isSelected && styles.summaryLanguageChipTextSelected
                      ]}
                    >
                      {language.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              disabled={isBusy}
              onPress={submit}
              style={({ pressed }) => [
                styles.summaryCreateButton,
                isBusy && styles.disabledButton,
                pressed && styles.pressed
              ]}
            >
              {isBusy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons color="#fff" name="sparkles-outline" size={17} />}
              <Text style={styles.summaryCreateButtonText}>Create spoken summary</Text>
            </Pressable>
          </View>

          <View style={styles.summarySectionBlock}>
            <View style={styles.summaryHistoryHeader}>
              <View>
                <Text style={styles.liveRoomSectionLabel}>Saved voice summaries</Text>
                <Text style={styles.summarySectionHint}>
                  Reopen any saved recap and play it in the meeting language.
                </Text>
              </View>
              <View style={styles.summaryCountPill}>
                <Text style={styles.summaryCountPillText}>{summaries.length}</Text>
              </View>
            </View>
            {groupedSummaries.length ? groupedSummaries.map((group) => (
              <View key={group.key} style={styles.summaryVersionGroup}>
                <View style={styles.summaryVersionHeader}>
                  <View style={styles.summaryVersionCopy}>
                    <Text style={styles.summaryVersionTitle}>{group.label}</Text>
                    <Text style={styles.summaryVersionMeta}>{group.meta}</Text>
                  </View>
                  <View style={styles.summaryVersionCountPill}>
                    <Text style={styles.summaryVersionCountText}>{group.summaries.length}</Text>
                  </View>
                </View>
                {group.summaries.map((summary) => (
                  <View key={summary.summaryId} style={styles.summaryHistoryRow}>
                    <Text style={styles.liveDetailMeta}>{formatDateTime(summary.createdAtIso)}</Text>
                    {summary.languageCodes.map((languageCode) => {
                      const audioKey = getInterpreterSummaryAudioKey(summary.summaryId, languageCode);
                      const languageLabel = getLanguageLabel(availableLanguages, languageCode);
                      const isActive = activeAudioKey === audioKey && isAudioPlaying;
                      const isPreparing = preparingAudioKey === audioKey;
                      const previewText = summary.summaryTextByLanguage[languageCode] || '';

                      return (
                        <Pressable
                          disabled={isPreparing}
                          key={`${summary.summaryId}-${languageCode}`}
                          onPress={() => onPlaySummary(summary, languageCode)}
                          style={({ pressed }) => [
                            styles.summaryHistoryLanguageRow,
                            isActive && styles.summaryHistoryLanguageRowActive,
                            pressed && styles.pressed
                          ]}
                        >
                          <View style={[
                            styles.summaryHistoryPlayButton,
                            isActive && styles.summaryHistoryPlayButtonActive
                          ]}>
                            {isPreparing ? (
                              <ActivityIndicator color={appTheme.colors.primary} size="small" />
                            ) : (
                              <Ionicons
                                color={isActive ? '#fff' : appTheme.colors.primary}
                                name={isActive ? 'pause' : 'play'}
                                size={14}
                              />
                            )}
                          </View>
                          <View style={styles.summaryHistoryCopy}>
                            <Text style={styles.summaryHistoryLanguageText}>{languageLabel}</Text>
                            <Text numberOfLines={2} style={styles.summaryHistoryPreviewText}>
                              {previewText || 'Summary text is saved for this language.'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )) : (
              <View style={styles.summaryEmptyRow}>
                <Ionicons color={appTheme.colors.primary} name="reader-outline" size={22} />
                <Text style={styles.summarySectionHint}>
                  Saved spoken summaries appear here after you create one.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
  );

  if (presentation === 'overlay') {
    return content;
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={isOpen}>
      {content}
    </Modal>
  );
}

function InterpreterTranscriptSummaryModal({
  activeSummaryAudioKey,
  availableLanguages,
  creatingLanguageCode,
  isAudioPlaying,
  isBusy,
  isOpen,
  items,
  onClose,
  onCreateSummary,
  onPlaySummary,
  onSelectLanguage,
  preparingSummaryAudioKey,
  selectedLanguageCode,
  summaries
}: InterpreterTranscriptSummaryModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false);
  const selectedLanguage = availableLanguages.find((language) => language.code === selectedLanguageCode)
    || availableLanguages[0]
    || { code: 'en-US', label: 'English' };
  const sourceTranscriptCount = getCleanedTranscriptLibraryItems(items).length;
  const canCreateSummary = sourceTranscriptCount > 0 && !isBusy && !creatingLanguageCode;

  useEffect(() => {
    if (!isOpen) {
      setIsLanguagePickerOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={isOpen}>
      <View
        style={[
          styles.transcriptSummaryScreen,
          { paddingBottom: Math.max(insets.bottom + 14, 24), paddingTop: Math.max(insets.top + 12, 22) }
        ]}
      >
        <View style={styles.transcriptSummaryHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
            <Ionicons color={appTheme.colors.ink} name="chevron-back" size={23} />
          </Pressable>
          <View style={styles.transcriptSummaryTitleWrap}>
            <Text style={styles.liveRoomSectionLabel}>Saved transcript summary</Text>
            <Text style={styles.transcriptLibraryTitle}>All saved transcripts</Text>
            <Text style={styles.transcriptLibraryHint}>
              Summaries are saved by language and can be replayed as audio.
            </Text>
          </View>
        </View>

        <View style={styles.transcriptSummaryCreateCard}>
          <View style={styles.transcriptSummaryCreateHeader}>
            <View style={styles.transcriptSummaryCountPill}>
              <Text style={styles.transcriptSummaryCountText}>{sourceTranscriptCount}</Text>
            </View>
            <View style={styles.transcriptSummaryCreateCopy}>
              <Text style={styles.transcriptSummaryCreateTitle}>Clean transcripts ready</Text>
              <Text style={styles.transcriptSummaryCreateMeta}>
                The summary uses saved cleaned transcripts in the order they were captured.
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setIsLanguagePickerOpen(true)}
            style={({ pressed }) => [styles.transcriptSummaryLanguageButton, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.primary} name="language-outline" size={18} />
            <View style={styles.transcriptSummaryLanguageCopy}>
              <Text style={styles.transcriptSummaryLanguageLabel}>Summary language</Text>
              <Text style={styles.transcriptSummaryLanguageValue}>{selectedLanguage.label}</Text>
            </View>
            <Ionicons color={appTheme.colors.mutedStrong} name="chevron-down" size={17} />
          </Pressable>
          <Pressable
            disabled={!canCreateSummary}
            onPress={() => void onCreateSummary(selectedLanguage.code)}
            style={({ pressed }) => [
              styles.transcriptSummaryCreateButton,
              !canCreateSummary && styles.transcriptSummaryCreateButtonDisabled,
              pressed && styles.pressed
            ]}
          >
            {creatingLanguageCode === selectedLanguage.code ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons color="#fff" name="sparkles-outline" size={17} />
            )}
            <Text style={styles.transcriptSummaryCreateButtonText}>
              {creatingLanguageCode === selectedLanguage.code ? 'Creating summary' : 'Create summary'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.transcriptSummaryList}
          showsVerticalScrollIndicator={false}
        >
          {summaries.length ? summaries.map((summary) => (
            <View key={summary.summaryId} style={styles.transcriptSummarySavedCard}>
              <Text style={styles.transcriptLibraryCardMeta}>{formatTranscriptLibraryTimestamp(summary.createdAtIso)}</Text>
              {summary.languageCodes.map((languageCode) => {
                const audioKey = getInterpreterSummaryAudioKey(summary.summaryId, languageCode);
                const languageLabel = getLanguageLabel(availableLanguages, languageCode);
                const previewText = summary.summaryTextByLanguage[languageCode] || '';
                const isActive = activeSummaryAudioKey === audioKey && isAudioPlaying;
                const isPreparing = preparingSummaryAudioKey === audioKey;

                return (
                  <View key={`${summary.summaryId}-${languageCode}`} style={styles.transcriptSummaryLanguageCard}>
                    <View style={styles.transcriptSummaryLanguageCardHeader}>
                      <View style={styles.transcriptSummaryLanguageIcon}>
                        <Ionicons color={appTheme.colors.primary} name="reader-outline" size={18} />
                      </View>
                      <View style={styles.transcriptSummaryLanguageCardCopy}>
                        <Text style={styles.transcriptSummarySavedLanguage}>{languageLabel}</Text>
                        <Text style={styles.transcriptSummarySavedMeta}>Saved summary with read-aloud audio</Text>
                      </View>
                      <Pressable
                        disabled={isPreparing}
                        onPress={() => onPlaySummary(summary, languageCode)}
                        style={({ pressed }) => [
                          styles.transcriptSummaryPlayButton,
                          isActive && styles.transcriptSummaryPlayButtonActive,
                          isPreparing && styles.transcriptSummaryPlayButtonDisabled,
                          pressed && styles.pressed
                        ]}
                      >
                        {isPreparing ? (
                          <ActivityIndicator color={appTheme.colors.primary} size="small" />
                        ) : (
                          <Ionicons color={isActive ? '#fff' : appTheme.colors.primary} name={isActive ? 'pause' : 'play'} size={16} />
                        )}
                      </Pressable>
                    </View>
                    <Text style={styles.transcriptSummarySavedText}>{previewText}</Text>
                  </View>
                );
              })}
            </View>
          )) : (
            <View style={styles.transcriptLibraryEmpty}>
              <Ionicons color={appTheme.colors.primary} name="sparkles-outline" size={28} />
              <Text style={styles.transcriptLibraryEmptyTitle}>No saved summaries yet</Text>
              <Text style={styles.transcriptLibraryEmptyText}>
                Choose a language and create a summary from the cleaned transcripts saved in this meeting.
              </Text>
            </View>
          )}
        </ScrollView>

        <InterpreterTranscriptAudioLanguagePicker
          eyebrow="Summary language"
          hint="The saved transcript summary will be written and prepared as audio in this language."
          isOpen={isLanguagePickerOpen}
          languages={availableLanguages}
          onClose={() => setIsLanguagePickerOpen(false)}
          onSelectLanguage={(languageCode) => {
            onSelectLanguage(languageCode);
            setIsLanguagePickerOpen(false);
          }}
          selectedLanguageCode={selectedLanguage.code}
          title="Choose summary language"
        />
      </View>
    </Modal>
  );
}

function InterpreterMeetingFilterModal({
  filters,
  isOpen,
  onApply,
  onClose,
  onReset
}: InterpreterMeetingFilterModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [draftFilters, setDraftFilters] = useState<InterpreterMeetingListFilters>(filters);

  useEffect(() => {
    if (isOpen) {
      setDraftFilters(filters);
    }
  }, [filters, isOpen]);

  function patchDraft(patch: Partial<InterpreterMeetingListFilters>) {
    setDraftFilters((currentFilters) => ({ ...currentFilters, ...patch }));
  }

  function resetFilters() {
    setDraftFilters(DEFAULT_INTERPRETER_MEETING_FILTERS);
    onReset();
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <Pressable onPress={onClose} style={styles.modalOverlay}>
        <Pressable style={[styles.meetingFilterSheet, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>FILTER</Text>
              <Text style={styles.modalTitle}>Interpreter sessions</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionLabel}>Name contains</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(nameQuery) => patchDraft({ nameQuery })}
              placeholder="Meeting name"
              placeholderTextColor={appTheme.colors.mutedStrong}
              style={styles.input}
              value={draftFilters.nameQuery}
            />
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionLabel}>Meeting type</Text>
            <View style={styles.filterChipRow}>
              {(['ALL', 'ONE_ON_ONE', 'LEVEL_1', 'LEVEL_3'] as InterpreterMeetingTypeFilter[]).map((meetingType) => {
                const isSelected = draftFilters.meetingType === meetingType;

                return (
                  <Pressable
                    key={meetingType}
                    onPress={() => patchDraft({ meetingType })}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isSelected && styles.filterChipSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                      {meetingType === 'ALL' ? 'All' : formatMeetingType(meetingType)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionLabel}>Date created</Text>
            <View style={styles.filterChipRow}>
              {(['all', 'today', 'last_7_days', 'last_30_days'] as InterpreterMeetingCreatedDateFilter[]).map((createdDate) => {
                const isSelected = draftFilters.createdDate === createdDate;

                return (
                  <Pressable
                    key={createdDate}
                    onPress={() => patchDraft({ createdDate })}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isSelected && styles.filterChipSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                      {formatInterpreterMeetingCreatedDateFilter(createdDate)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.meetingFilterActions}>
            <Pressable
              onPress={resetFilters}
              style={({ pressed }) => [styles.secondaryButtonFull, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => onApply(draftFilters)}
              style={({ pressed }) => [styles.createSessionButton, pressed && styles.pressed]}
            >
              <Text style={styles.summaryCreateButtonText}>Apply filters</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InterpreterTranscriptAudioLanguagePicker({
  eyebrow = 'Read aloud language',
  hint = 'The saved transcript is translated for this playback only.',
  isOpen,
  languages,
  onClose,
  onSelectLanguage,
  selectedLanguageCode,
  title = 'Choose playback language'
}: InterpreterTranscriptAudioLanguagePickerProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const filteredLanguages = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return languages;
    }

    return languages.filter((language) =>
      language.label.toLocaleLowerCase().includes(normalizedQuery) ||
      language.code.toLocaleLowerCase().includes(normalizedQuery)
    );
  }, [languages, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.liveLanguagePickerBackdrop}>
        <View
          style={[
            styles.liveLanguagePickerSheet,
            { paddingBottom: Math.max(insets.bottom + 12, 22), paddingTop: Math.max(insets.top + 12, 22) }
          ]}
        >
          <View style={styles.liveLanguagePickerHeader}>
            <View style={styles.liveLanguagePickerTitleWrap}>
              <Text style={styles.liveRoomSectionLabel}>{eyebrow}</Text>
              <Text style={styles.liveLanguagePickerTitle}>{title}</Text>
              <Text style={styles.liveLanguagePickerHint}>
                {hint}
              </Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.liveLanguageSearchBox}>
            <Ionicons color={appTheme.colors.mutedStrong} name="search-outline" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search language"
              placeholderTextColor={appTheme.colors.mutedStrong}
              style={styles.liveLanguageSearchInput}
              value={query}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.liveLanguagePickerList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filteredLanguages.map((language) => {
              const isSelected = language.code === selectedLanguageCode;

              return (
                <Pressable
                  key={language.code}
                  onPress={() => onSelectLanguage(language.code)}
                  style={({ pressed }) => [
                    styles.liveLanguagePickerRow,
                    isSelected && styles.liveLanguagePickerRowSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={styles.liveLanguagePickerRowCopy}>
                    <Text style={styles.liveLanguagePickerRowTitle}>{language.label}</Text>
                    <Text style={styles.liveLanguagePickerRowMeta}>{language.code}</Text>
                  </View>
                  <Ionicons
                    color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                  />
                </Pressable>
              );
            })}
            {!filteredLanguages.length ? (
              <View style={styles.liveLanguagePickerEmpty}>
                <Text style={styles.liveLanguagePickerHint}>No language matches that search.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InterpreterVoicePickerModal({
  activePreviewKey,
  isOpen,
  onClose,
  onPreview,
  onSelect,
  preparingPreviewKey,
  previewLanguageCode,
  selectedVoiceId,
  voices
}: InterpreterVoicePickerModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <Pressable onPress={onClose} style={styles.pickerOverlay}>
        <Pressable style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>INTERPRETER SPEAKER</Text>
              <Text style={styles.modalTitle}>Choose voice</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="close" size={24} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            Preview each interpreter speaker before assigning it to the meeting.
          </Text>
          <ScrollView
            contentContainerStyle={styles.pickerList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {voices.map((voice) => {
              const previewKey = getInterpreterVoicePreviewAudioKey(voice.id, previewLanguageCode);
              const isSelected = selectedVoiceId === voice.id;
              const isPreparingPreview = preparingPreviewKey === previewKey;
              const isPreviewPlaying = activePreviewKey === previewKey;

              return (
                <Pressable
                  key={voice.id}
                  onPress={() => onSelect(voice.id)}
                  style={({ pressed }) => [
                    styles.voicePickerRow,
                    isSelected && styles.voicePickerRowSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={styles.voiceAvatar}>
                    <Ionicons
                      color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                      name={isSelected ? 'checkmark-circle' : 'mic-outline'}
                      size={20}
                    />
                  </View>
                  <View style={styles.selectionBody}>
                    <Text style={styles.selectionTitle}>{voice.label}</Text>
                    <Text style={styles.mutedText}>{voice.description}</Text>
                  </View>
                  <Pressable
                    disabled={Boolean(isPreparingPreview)}
                    onPress={(event) => {
                      event.stopPropagation();
                      onPreview(voice);
                    }}
                    style={({ pressed }) => [
                      styles.voicePreviewButton,
                      isPreviewPlaying && styles.voicePreviewButtonActive,
                      pressed && styles.pressed
                    ]}
                  >
                    {isPreparingPreview ? (
                      <ActivityIndicator color={appTheme.colors.primary} size="small" />
                    ) : (
                      <Ionicons
                        color={isPreviewPlaying ? '#fff' : appTheme.colors.primary}
                        name={isPreviewPlaying ? 'pause' : 'play'}
                        size={17}
                      />
                    )}
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InterpreterLiveOutputLanguagePicker({
  isOpen,
  languages,
  onClose,
  onSelectLanguage,
  selectedLanguageCode
}: InterpreterLiveOutputLanguagePickerProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const sortedLanguages = useMemo(() =>
    [...languages].sort((first, second) => first.label.localeCompare(second.label)),
    [languages]
  );
  const filteredLanguages = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return sortedLanguages;
    }

    return sortedLanguages.filter((language) =>
      language.label.toLocaleLowerCase().includes(normalizedQuery) ||
      language.code.toLocaleLowerCase().includes(normalizedQuery)
    );
  }, [query, sortedLanguages]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.liveLanguagePickerBackdrop}>
        <View
          style={[
            styles.liveLanguagePickerSheet,
            { paddingBottom: Math.max(insets.bottom + 12, 22), paddingTop: Math.max(insets.top + 12, 22) }
          ]}
        >
          <View style={styles.liveLanguagePickerHeader}>
            <View style={styles.liveLanguagePickerTitleWrap}>
              <Text style={styles.liveRoomSectionLabel}>Output language</Text>
              <Text style={styles.liveLanguagePickerTitle}>Translate spoken response to</Text>
              <Text style={styles.liveLanguagePickerHint}>
                The selected language is used the next time you tap Respond.
              </Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.liveLanguageSearchBox}>
            <Ionicons color={appTheme.colors.mutedStrong} name="search-outline" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search language"
              placeholderTextColor={appTheme.colors.mutedStrong}
              style={styles.liveLanguageSearchInput}
              value={query}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.liveLanguagePickerList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filteredLanguages.map((language) => {
              const isSelected = language.code === selectedLanguageCode;
              const capability = getControlledLiveLanguageCapability(language);

              return (
                <Pressable
                  key={language.code}
                  onPress={() => onSelectLanguage(language.code)}
                  style={({ pressed }) => [
                    styles.liveLanguagePickerRow,
                    isSelected && styles.liveLanguagePickerRowSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={styles.liveLanguagePickerRowCopy}>
                    <Text style={styles.liveLanguagePickerRowTitle}>{language.label}</Text>
                    <Text style={styles.liveLanguagePickerRowMeta}>{language.code}</Text>
                  </View>
                  <View
                    style={[
                      styles.liveLanguageCapabilityPill,
                      capability.kind === 'validated' && styles.liveLanguageCapabilityPillValidated
                    ]}
                  >
                    <Text
                      style={[
                        styles.liveLanguageCapabilityText,
                        capability.kind === 'validated' && styles.liveLanguageCapabilityTextValidated
                      ]}
                    >
                      {capability.label}
                    </Text>
                  </View>
                  <Ionicons
                    color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                  />
                </Pressable>
              );
            })}
            {!filteredLanguages.length ? (
              <View style={styles.liveLanguagePickerEmpty}>
                <Text style={styles.liveLanguagePickerHint}>No language matches that search.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InterpreterAudioSpectrum({
  audioLevel,
  compact = false,
  isPlaying,
  isPreparingOutput,
  isListening,
  outputAudioLevel
}: InterpreterAudioSpectrumProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const ringPulse = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState(0);
  const radialBars = useMemo(() =>
    Array.from({ length: compact ? 148 : 188 }, (_, index) => {
      const seed = ((index * 37) % 29) / 29;
      const secondarySeed = ((index * 17) % 23) / 23;

      return {
        index,
        seed,
        secondarySeed
      };
    }),
    [compact]
  );
  const isActive = isListening || isPlaying;
  const sourceLevel = isListening ? audioLevel : isPlaying ? outputAudioLevel : 0;
  const normalizedLevel = isActive
    ? Math.max(isPlaying ? 0.2 : 0.1, Math.min(1, sourceLevel || (isPlaying ? 0.34 : 0.14)))
    : 0.035;
  const pulseScale = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.06]
  });
  const pulseOpacity = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.02]
  });
  const shellSize = compact ? 182 : 242;
  const center = shellSize / 2;
  const innerRadius = compact ? 54 : 72;
  const guideRadius = compact ? 50 : 66;
  const baseBarLength = compact ? 10 : 14;
  const maxBarLength = compact ? 26 : 38;
  const ringGradientId = compact ? 'synzapp-audio-ring-compact' : 'synzapp-audio-ring';
  const isPreparing = isPreparingOutput && !isActive;
  const ringStartColor = isPlaying ? '#a78bfa' : '#99f6e4';
  const ringMiddleColor = isPlaying ? '#38bdf8' : '#2dd4bf';
  const ringEndColor = isPlaying ? '#22c55e' : appTheme.colors.primary;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          duration: 980,
          // Decorative. A looping animation that holds an interaction handle
          // stalls anything waiting on InteractionManager for as long as it
          // runs, which has already cost this app unsent messages.
          isInteraction: false,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(ringPulse, {
          duration: 0,
          isInteraction: false,
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );

    if (isActive || isPreparing) {
      animation.start();
    } else {
      ringPulse.stopAnimation();
      ringPulse.setValue(0);
    }

    return () => {
      animation.stop();
    };
  }, [isActive, isPreparing, ringPulse]);

  useEffect(() => {
    if (!isActive && !isPreparing) {
      setPhase(0);
      return undefined;
    }

    const intervalId = setInterval(() => {
      setPhase((currentPhase) => currentPhase + 1);
    }, isPreparing ? 140 : 70);

    return () => clearInterval(intervalId);
  }, [isActive, isPreparing]);

  return (
    <View style={[styles.circularAudioWrap, compact && styles.circularAudioWrapCompact]}>
      <Animated.View
        style={[
          styles.circularAudioShell,
          { height: shellSize, width: shellSize }
        ]}
      >
        <Animated.View
          style={[
            styles.circularAudioPulse,
            {
              borderColor: isPlaying ? '#a78bfa' : appTheme.colors.primary,
              borderRadius: shellSize / 2,
              height: shellSize,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
              width: shellSize
            }
          ]}
        />
        <Svg height={shellSize} width={shellSize}>
          <Defs>
            <LinearGradient id={ringGradientId} x1="0%" x2="100%" y1="0%" y2="100%">
              <Stop offset="0%" stopColor={ringStartColor} stopOpacity={isActive ? 0.94 : 0.2} />
              <Stop offset="52%" stopColor={ringMiddleColor} stopOpacity={isActive ? 1 : 0.28} />
              <Stop offset="100%" stopColor={ringEndColor} stopOpacity={isActive ? 0.94 : 0.2} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={center}
            cy={center}
            fill="none"
            opacity={isActive ? 0.28 : isPreparing ? 0.2 : 0.12}
            r={guideRadius}
            stroke={isPlaying ? '#a78bfa' : appTheme.colors.primary}
            strokeWidth={compact ? 1.4 : 1.8}
          />
          <Circle
            cx={center}
            cy={center}
            fill="none"
            opacity={isActive ? 0.34 : isPreparing ? 0.2 : 0.12}
            r={innerRadius}
            stroke={`url(#${ringGradientId})`}
            strokeWidth={compact ? 1.1 : 1.4}
          />
          {radialBars.map((bar) => {
            const angle = (bar.index / radialBars.length) * Math.PI * 2 - Math.PI / 2;
            const wave = Math.sin((phase * 0.34) + (bar.index * 0.42));
            const counterWave = Math.cos((phase * 0.18) + (bar.index * 0.19));
            const preparingLift = isPreparing ? 0.1 + bar.seed * 0.08 : 0;
            const shapedLevel = normalizedLevel * (0.52 + bar.seed * 0.5) + preparingLift;
            const reactiveLift = isActive
              ? Math.max(0, wave) * (0.16 + normalizedLevel * 0.36)
              : isPreparing
                ? Math.max(0, wave) * 0.08
                : 0;
            const lineLength = baseBarLength + maxBarLength * Math.min(
              1,
              shapedLevel + reactiveLift + Math.max(0, counterWave) * bar.secondarySeed * 0.1
            );
            const startRadius = innerRadius + (isActive ? Math.max(0, wave) * 2 : 0);
            const endRadius = Math.min(center - 4, startRadius + lineLength);
            const x1 = center + Math.cos(angle) * startRadius;
            const y1 = center + Math.sin(angle) * startRadius;
            const x2 = center + Math.cos(angle) * endRadius;
            const y2 = center + Math.sin(angle) * endRadius;

            return (
              <Line
                key={bar.index}
                opacity={isActive ? 0.64 + normalizedLevel * 0.34 : isPreparing ? 0.34 : 0.16}
                stroke={`url(#${ringGradientId})`}
                strokeLinecap="round"
                strokeWidth={compact ? 1.15 : 1.45}
                x1={x1}
                x2={x2}
                y1={y1}
                y2={y2}
              />
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}

function InterpreterMeetingSwipeRow({
  disabled,
  isDeleteMode,
  isSelected,
  meeting,
  onDelete,
  onOpen,
  onToggleSelected
}: InterpreterMeetingSwipeRowProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const translateX = useRef(new Animated.Value(0)).current;
  const openOffsetRef = useRef(0);

  const closeRow = useCallback(() => {
    openOffsetRef.current = 0;
    Animated.spring(translateX, {
      damping: 22,
      mass: 0.7,
      stiffness: 190,
      toValue: 0,
      useNativeDriver: true
    }).start();
  }, [translateX]);

  const openRow = useCallback(() => {
    openOffsetRef.current = -INTERPRETER_SESSION_DELETE_WIDTH;
    Animated.spring(translateX, {
      damping: 22,
      mass: 0.7,
      stiffness: 190,
      toValue: -INTERPRETER_SESSION_DELETE_WIDTH,
      useNativeDriver: true
    }).start();
  }, [translateX]);

	  const panResponder = useMemo(() => PanResponder.create({
	    onMoveShouldSetPanResponderCapture: () => false,
	    onStartShouldSetPanResponder: () => false,
	    onStartShouldSetPanResponderCapture: () => false,
	    onMoveShouldSetPanResponder: (_event, gesture) => {
	      if (isDeleteMode) {
	        return false;
	      }

	      const horizontalDistance = Math.abs(gesture.dx);
	      const verticalDistance = Math.abs(gesture.dy);

	      return horizontalDistance > INTERPRETER_SESSION_HORIZONTAL_SWIPE_START
	        && horizontalDistance > verticalDistance * INTERPRETER_SESSION_HORIZONTAL_LOCK_RATIO;
	    },
	    onPanResponderMove: (_event, gesture) => {
	      const nextOffset = Math.max(
	        -INTERPRETER_SESSION_DELETE_WIDTH,
	        Math.min(0, openOffsetRef.current + gesture.dx)
	      );

	      translateX.setValue(nextOffset);
	    },
	    onPanResponderRelease: (_event, gesture) => {
	      if (openOffsetRef.current + gesture.dx < -INTERPRETER_SESSION_DELETE_TRIGGER) {
	        openRow();
	      } else {
	        closeRow();
	      }
	    },
	    onPanResponderTerminationRequest: () => true,
	    onPanResponderTerminate: closeRow,
	    onShouldBlockNativeResponder: () => false
	  }), [closeRow, isDeleteMode, openRow, translateX]);

  return (
    <View style={styles.meetingSwipeShell}>
      <View style={styles.meetingSwipeActions}>
        <Pressable
          disabled={disabled}
          onPress={() => {
            closeRow();
            onDelete(meeting);
          }}
          style={({ pressed }) => [styles.meetingDeleteAction, pressed && styles.pressed]}
        >
          <Ionicons color="#fff" name="trash-outline" size={18} />
          <Text style={styles.meetingDeleteText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.meetingSwipeContent, { transform: [{ translateX }] }]}
      >
        <Pressable
          disabled={disabled}
          onPress={() => {
            if (isDeleteMode) {
              onToggleSelected(meeting.meetingId);
              return;
            }

            void onOpen(meeting.meetingId);
          }}
          style={({ pressed }) => [
            styles.meetingRow,
            isSelected && styles.meetingRowSelected,
            pressed && styles.pressed
          ]}
        >
          {isDeleteMode ? (
            <TranscriptLibraryCheckbox
              isChecked={isSelected}
              onPress={() => onToggleSelected(meeting.meetingId)}
              styles={styles}
            />
          ) : null}
          <View style={styles.meetingAvatarWrap}>
            <View style={styles.meetingAvatar}>
              <Ionicons color={appTheme.colors.primary} name="language-outline" size={21} />
            </View>
            <View style={[styles.meetingAvatarBadge, { backgroundColor: getStatusColor(meeting.status) }]}>
              <Ionicons
                color="#fff"
                name={meeting.status === 'ENDED' ? 'checkmark' : 'radio'}
                size={11}
              />
            </View>
          </View>
          <View style={styles.meetingBody}>
            <Text style={styles.meetingName}>{meeting.meetingName}</Text>
            <Text style={styles.meetingMeta}>
              {formatInterpreterMeetingRowMeta(meeting)}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: getStatusSoftColor(meeting.status, appTheme.colors) }]}>
            <Ionicons
              color={getStatusColor(meeting.status)}
              name={getInterpreterMeetingStatusIcon(meeting.status)}
              size={13}
            />
            <Text style={[styles.statusPillText, { color: getStatusColor(meeting.status) }]}>
              {formatInterpreterMeetingDisplayStatus(meeting)}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function InterpreterRoomSettingsPanel({
  activePreviewKey,
  details,
  isBusy,
  isOpen,
  onClose,
  onPreviewVoice,
  onUpdateVoice,
  preparingPreviewKey,
  previewLanguageCode,
  selectedVoiceId,
  voices
}: InterpreterRoomSettingsPanelProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [draftVoiceId, setDraftVoiceId] = useState(selectedVoiceId);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const draftVoiceProfile = getInterpreterVoiceProfile(voices, draftVoiceId);
  const hasVoiceChanges = selectedVoiceId !== draftVoiceId;
  const canSave = hasVoiceChanges && !isBusy;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftVoiceId(selectedVoiceId);
    setIsVoicePickerOpen(false);
  }, [isOpen, selectedVoiceId]);

  async function saveSettings() {
    try {
      if (hasVoiceChanges) {
        await onUpdateVoice(draftVoiceId);
      }

      Alert.alert(
        'Interpreter settings saved',
        'The interpreter speaker was updated.'
      );
      onClose();
    } catch {
      // Parent update handlers already show the specific native error modal.
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <View style={[styles.roomSettingsOverlay, { paddingBottom: Math.max(insets.bottom + 16, 28), paddingTop: Math.max(insets.top + 12, 24) }]}>
      <View style={styles.liveRoomHeader}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
          <Ionicons color={appTheme.colors.ink} name="chevron-back" size={23} />
        </Pressable>
        <View style={styles.liveRoomTitleWrap}>
          <Text style={styles.liveRoomTitle}>Interpreter settings</Text>
          <Text style={styles.liveRoomMeta}>{details.meeting.meetingName}</Text>
        </View>
        <Pressable
          disabled={!canSave}
          onPress={() => void saveSettings()}
          style={({ pressed }) => [styles.settingsSaveButton, !canSave && styles.disabledButton, pressed && styles.pressed]}
        >
          {isBusy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.settingsSaveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.settingsContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.settingsSection}>
          <Text style={styles.sectionLabel}>Interpreter speaker</Text>
          <Pressable
            onPress={() => setIsVoicePickerOpen((currentValue) => !currentValue)}
            style={({ pressed }) => [styles.dropdownRow, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.primary} name="volume-high-outline" size={19} />
            <View style={styles.selectionBody}>
              <Text style={styles.selectionTitle}>{draftVoiceProfile.label}</Text>
              <Text style={styles.mutedText} numberOfLines={2}>{draftVoiceProfile.description}</Text>
            </View>
            <Ionicons color={appTheme.colors.mutedStrong} name={isVoicePickerOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} />
          </Pressable>
          {isVoicePickerOpen ? (
            <View style={styles.inlinePickerPanel}>
              {voices.map((voice) => {
                const previewKey = getInterpreterVoicePreviewAudioKey(voice.id, previewLanguageCode);
                const isSelected = draftVoiceId === voice.id;
                const isPreparingPreview = preparingPreviewKey === previewKey;
                const isPreviewPlaying = activePreviewKey === previewKey;

                return (
                  <Pressable
                    key={voice.id}
                    onPress={() => {
                      setDraftVoiceId(voice.id);
                      setIsVoicePickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.inlinePickerRow,
                      isSelected && styles.inlinePickerRowSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    <Ionicons color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong} name={isSelected ? 'checkmark-circle-outline' : 'mic-outline'} size={20} />
                    <View style={styles.selectionBody}>
                      <Text style={styles.selectionTitle}>{voice.label}</Text>
                      <Text style={styles.mutedText}>{voice.description}</Text>
                    </View>
                    <Pressable
                      disabled={Boolean(isPreparingPreview)}
                      onPress={(event) => {
                        event.stopPropagation();
                        onPreviewVoice(voice);
                      }}
                      style={({ pressed }) => [
                        styles.voicePreviewButton,
                        isPreviewPlaying && styles.voicePreviewButtonActive,
                        pressed && styles.pressed
                      ]}
                    >
                      {isPreparingPreview ? (
                        <ActivityIndicator color={appTheme.colors.primary} size="small" />
                      ) : (
                        <Ionicons color={isPreviewPlaying ? '#fff' : appTheme.colors.primary} name={isPreviewPlaying ? 'pause' : 'play'} size={17} />
                      )}
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * The live interpreter room.
 *
 * Lifted out unchanged — the largest single component on the screen, and the
 * only part of it that owns live session state.
 */

function InterpreterRoom({
  details,
  getIdToken,
  isBusy,
  onBack,
  onCreateSummary,
  onEndMeeting,
  onError,
  onCreateRealtimeSdpAnswer,
  onUpdateLanguages,
  onUpdateInvitations,
  onUpdateVoice,
  languages,
  participants,
  voiceProfiles
}: InterpreterRoomProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveTranslation, setLiveTranslation] = useState('');
  const [liveCleanTranscript, setLiveCleanTranscript] = useState('');
  const [liveStatus, setLiveStatus] = useState<InterpreterRealtimeStatus>('closed');
  const [audioReadiness, setAudioReadiness] = useState<InterpreterAudioReadiness | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isLiveTranscriptOpen, setIsLiveTranscriptOpen] = useState(false);
  const [isLiveHistoryOpen, setIsLiveHistoryOpen] = useState(false);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [isExitingRoom, setIsExitingRoom] = useState(false);
  const [liveMode, setLiveMode] = useState<InterpreterLiveMode>('idle');
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(details.meeting.interpreterLanguages[0]?.code || 'en-US');
  const [detectedSourceLanguageCode, setDetectedSourceLanguageCode] = useState<string | null>(null);
  const [respondingLanguageCode, setRespondingLanguageCode] = useState<string | null>(null);
  const [selectedAudioInputDeviceId, setSelectedAudioInputDeviceId] = useState<string | null>(null);
  const [selectedAudioOutputRoute, setSelectedAudioOutputRoute] = useState<InterpreterAudioOutputRoute>('system');
  const [interpreterAudioDevices, setInterpreterAudioDevices] = useState<InterpreterRealtimeMediaDevice[]>([]);
  const [remoteInterpreterStreamUrl, setRemoteInterpreterStreamUrl] = useState<string | null>(null);
  const [remoteInterpreterStreamUrls, setRemoteInterpreterStreamUrls] = useState<Record<string, string>>({});
  const [remoteAudioActivity, setRemoteAudioActivity] = useState<InterpreterRemoteAudioActivity | null>(null);
  const [liveResponseAudioBaseline, setLiveResponseAudioBaseline] = useState<InterpreterRemoteAudioActivity | null>(null);
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>(details.meeting.invitedUserIds || []);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveInterpretationHistory, setLiveInterpretationHistory] = useState<InterpreterLiveHistoryItem[]>([]);
  const [summaryAudioSourceUri, setSummaryAudioSourceUri] = useState<string | null>(null);
  const [summaryAudioCache, setSummaryAudioCache] = useState<Record<string, string>>({});
  const [activeSummaryAudioKey, setActiveSummaryAudioKey] = useState<string | null>(null);
  const [pendingSummaryAudioKey, setPendingSummaryAudioKey] = useState<string | null>(null);
  const [preparingSummaryAudioKey, setPreparingSummaryAudioKey] = useState<string | null>(null);
  const [segmentAudioSourceUri, setSegmentAudioSourceUri] = useState<string | null>(null);
  const [segmentAudioCache, setSegmentAudioCache] = useState<Record<string, string>>({});
  const [activeSegmentAudioKey, setActiveSegmentAudioKey] = useState<string | null>(null);
  const [pendingSegmentAudioKey, setPendingSegmentAudioKey] = useState<string | null>(null);
  const [preparingHistoryAudioKey, setPreparingHistoryAudioKey] = useState<string | null>(null);
  const [roomVoicePreviewSourceUri, setRoomVoicePreviewSourceUri] = useState<string | null>(null);
  const [roomVoicePreviewCache, setRoomVoicePreviewCache] = useState<Record<string, string>>({});
  const [activeRoomVoicePreviewKey, setActiveRoomVoicePreviewKey] = useState<string | null>(null);
  const [pendingRoomVoicePreviewKey, setPendingRoomVoicePreviewKey] = useState<string | null>(null);
  const [preparingRoomVoicePreviewKey, setPreparingRoomVoicePreviewKey] = useState<string | null>(null);
  const [isTranscriptLibraryOpen, setIsTranscriptLibraryOpen] = useState(false);
  const [transcriptLibraryItems, setTranscriptLibraryItems] = useState<InterpreterTranscriptLibraryItem[]>([]);
  const [isTranscriptLibraryLoading, setIsTranscriptLibraryLoading] = useState(false);
  const [transcriptLibraryFilter, setTranscriptLibraryFilter] = useState<InterpreterTranscriptLibraryFilter>('all');
  const [transcriptAudioLanguageBySegment, setTranscriptAudioLanguageBySegment] = useState<Record<string, string>>({});
  const [transcriptAudioSourceUri, setTranscriptAudioSourceUri] = useState<string | null>(null);
  const [activeTranscriptAudioKey, setActiveTranscriptAudioKey] = useState<string | null>(null);
  const [pendingTranscriptAudioKey, setPendingTranscriptAudioKey] = useState<string | null>(null);
  const [preparingTranscriptAudioKey, setPreparingTranscriptAudioKey] = useState<string | null>(null);
  const [transcriptAudioPlayerContext, setTranscriptAudioPlayerContext] =
    useState<InterpreterTranscriptAudioPlayerContext | null>(null);
  const [transcriptAudioPlayerMode, setTranscriptAudioPlayerMode] =
    useState<InterpreterTranscriptAudioPlayerMode>('expanded');
  const [transcriptAudioPlaybackRate, setTranscriptAudioPlaybackRate] = useState(1);
  const [sharingTranscriptAudioKey, setSharingTranscriptAudioKey] = useState<string | null>(null);
  const [transcriptAudioShareCache, setTranscriptAudioShareCache] = useState<Record<string, string>>({});
  const [isTranscriptSummaryOpen, setIsTranscriptSummaryOpen] = useState(false);
  const [transcriptSummaryLanguageCode, setTranscriptSummaryLanguageCode] = useState(
    details.meeting.interpreterLanguages[0]?.code || selectedLanguageCode || 'en-US'
  );
  const [creatingTranscriptSummaryLanguageCode, setCreatingTranscriptSummaryLanguageCode] = useState<string | null>(null);
  const liveVersionSeqRef = useRef(0);
  const activeLiveVersionIdRef = useRef<string | null>(null);
  const [liveVersions, setLiveVersions] = useState<InterpreterLiveVersion[]>([]);
  const [selectedLiveVersionId, setSelectedLiveVersionId] = useState<string | null>(null);
  const realtimeSessionPoolRef = useRef<Record<string, InterpreterRealtimeSession>>({});
  const remoteAudioActivityRef = useRef<InterpreterRemoteAudioActivity | null>(null);
  const remoteInterpreterStreamUrlRef = useRef<string | null>(null);
  const remoteInterpreterStreamUrlsRef = useRef<Record<string, string>>({});
  const selectedLanguageCodeRef = useRef(selectedLanguageCode);
  const respondingLanguageCodeRef = useRef<string | null>(null);
  const shouldStartFreshListeningTurnRef = useRef(false);
  /** A passing hint under the live controls. Never an error banner. */
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  /** The microphone in use, shown when it is an external one. */
  const [activeInputName, setActiveInputName] = useState('');
  const isStartingLiveResponseRef = useRef(false);
  const [languageSessionState, setLanguageSessionState] = useState<Record<string, InterpreterLanguageSessionState>>({});
  const liveVersionsRef = useRef<InterpreterLiveVersion[]>([]);
  const languageSessionStateRef = useRef<Record<string, InterpreterLanguageSessionState>>({});
  const currentPlayingSegmentKeyRef = useRef<string | null>(null);
  const handledFinishedSegmentKeyRef = useRef<string | null>(null);
  const segmentPlaybackProgressRef = useRef<{
    audioKey: string;
    currentTime: number;
    updatedAtMs: number;
  } | null>(null);
  const summaryAudioPlayer = useAudioPlayer(summaryAudioSourceUri ? { uri: summaryAudioSourceUri } : null, {
    updateInterval: 250
  });
  const summaryAudioStatus = useAudioPlayerStatus(summaryAudioPlayer);
  const segmentAudioPlayer = useAudioPlayer(segmentAudioSourceUri ? { uri: segmentAudioSourceUri } : null, {
    updateInterval: 250
  });
  const segmentAudioStatus = useAudioPlayerStatus(segmentAudioPlayer);
  const roomVoicePreviewPlayer = useAudioPlayer(roomVoicePreviewSourceUri ? { uri: roomVoicePreviewSourceUri } : null, {
    updateInterval: 250
  });
  const roomVoicePreviewStatus = useAudioPlayerStatus(roomVoicePreviewPlayer);
  const transcriptAudioPlayer = useAudioPlayer(transcriptAudioSourceUri ? { uri: transcriptAudioSourceUri } : null, {
    updateInterval: 250
  });
  const transcriptAudioStatus = useAudioPlayerStatus(transcriptAudioPlayer);
  const latestTranslation = [...details.translations].reverse()
    .find((translation) => translation.targetLanguageCode === selectedLanguageCode);
  const selectedLanguageSession = languageSessionState[selectedLanguageCode];
  const selectedVoiceId = details.meeting.interpreterVoiceId || DEFAULT_INTERPRETER_VOICE_ID;
  const selectedVoiceProfile = getInterpreterVoiceProfile(voiceProfiles, selectedVoiceId);
  const liveLanguageCatalog = languages.length ? languages : details.meeting.interpreterLanguages;
  const latestReplayItem = groupInterpreterHistory(details, liveInterpretationHistory)[0]?.items[0] || null;
  const latestReplayAudioKey = latestReplayItem
    ? getHistoryAudioKey(details.meeting.meetingId, latestReplayItem)
    : null;
  const activeSessionStatuses = Object.values(languageSessionState).map((state) => state.status);
  const isRealtimeActive = activeSessionStatuses.some(isActiveRealtimeStatus);
  const liveTranscriptRef = useRef('');
  const liveTranslationRef = useRef('');
  const savedTranscriptFingerprintByVersionRef = useRef<Record<string, string>>({});
  const latestSourceTranscriptByVersionRef = useRef<Record<string, string>>({});
  const transcriptPersistTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function setLiveVersionsSnapshot(
    updater: InterpreterLiveVersion[] | ((currentVersions: InterpreterLiveVersion[]) => InterpreterLiveVersion[])
  ) {
    const nextVersions = typeof updater === 'function'
      ? updater(liveVersionsRef.current)
      : updater;

    liveVersionsRef.current = nextVersions;
    setLiveVersions(nextVersions);
  }

  function setLanguageSessionStateSnapshot(
    updater: Record<string, InterpreterLanguageSessionState> |
      ((currentState: Record<string, InterpreterLanguageSessionState>) => Record<string, InterpreterLanguageSessionState>)
  ) {
    const nextState = typeof updater === 'function'
      ? updater(languageSessionStateRef.current)
      : updater;

    languageSessionStateRef.current = nextState;
    setLanguageSessionState(nextState);
  }

  function setLiveTranscriptSnapshot(transcript: string) {
    liveTranscriptRef.current = transcript;
    setLiveTranscript(transcript);
    setLiveCleanTranscript(cleanInterpreterLiveTranscriptForDisplay(transcript));
  }

  function setLiveTranslationSnapshot(translation: string) {
    liveTranslationRef.current = translation;
    setLiveTranslation(translation);
  }

  // Guardrail: the controlled GPT Live gate must stay independent from saved
  // transcript playback. This ref keeps the final source transcript for each
  // manual turn so the library/audio path never saves an early partial snapshot.
  function rememberLiveSourceTranscript(versionId: string | null | undefined, transcript: string): string {
    const incomingTranscript = transcript.trim();

    if (!versionId || !incomingTranscript) {
      return incomingTranscript;
    }

    const currentTranscript = latestSourceTranscriptByVersionRef.current[versionId] || '';
    const nextTranscript = mergeInterpreterRealtimeText(currentTranscript, incomingTranscript);

    latestSourceTranscriptByVersionRef.current = {
      ...latestSourceTranscriptByVersionRef.current,
      [versionId]: nextTranscript
    };
    return nextTranscript;
  }

  function clearTranscriptPersistTimer(versionId: string | null | undefined) {
    if (!versionId) {
      return;
    }

    const timer = transcriptPersistTimersRef.current[versionId];

    if (timer) {
      clearTimeout(timer);
    }

    const nextTimers = { ...transcriptPersistTimersRef.current };

    delete nextTimers[versionId];
    transcriptPersistTimersRef.current = nextTimers;
  }

  function clearTranscriptPersistTimers() {
    Object.values(transcriptPersistTimersRef.current).forEach((timer) => clearTimeout(timer));
    transcriptPersistTimersRef.current = {};
  }

  function setSelectedLanguageSnapshot(languageCode: string) {
    selectedLanguageCodeRef.current = languageCode;
    setSelectedLanguageCode(languageCode);
  }

  function setRespondingLanguageSnapshot(languageCode: string | null) {
    respondingLanguageCodeRef.current = languageCode;
    setRespondingLanguageCode(languageCode);
  }

  function getActiveLiveTargetLanguageCode(fallbackLanguageCode = selectedLanguageCodeRef.current) {
    return respondingLanguageCodeRef.current || selectedLanguageCodeRef.current || fallbackLanguageCode;
  }

  useEffect(() => {
    selectedLanguageCodeRef.current = selectedLanguageCode;
  }, [selectedLanguageCode]);

  useEffect(() => {
    if (!remoteInterpreterStreamUrl || (liveMode !== 'listening' && liveMode !== 'responding')) {
      return;
    }

    void prepareInterpreterRealtimeSpeechMode(selectedAudioOutputRoute);
  }, [liveMode, remoteInterpreterStreamUrl, selectedAudioOutputRoute]);

  useEffect(() => () => {
    clearTranscriptPersistTimers();
    closeRealtimeSessionPool(false);
  }, []);

  useEffect(() => {
    setInterpreterNativeKeepAwake(true);
    void refreshInterpreterAudioDevices();

    return () => {
      setInterpreterNativeKeepAwake(false);
      releaseInterpreterNativeAudioRoute();
    };
  }, []);

  async function refreshInterpreterAudioDevices() {
    const devices = await listInterpreterRealtimeAudioDevices().catch(() => []);

    setInterpreterAudioDevices(devices);
  }

  useEffect(() => () => {
    safePauseAudioPlayer(summaryAudioPlayer);
  }, [summaryAudioPlayer]);

  useEffect(() => () => {
    safePauseAudioPlayer(segmentAudioPlayer);
  }, [segmentAudioPlayer]);

  useEffect(() => () => {
    safePauseAudioPlayer(roomVoicePreviewPlayer);
  }, [roomVoicePreviewPlayer]);

  useEffect(() => () => {
    safePauseAudioPlayer(transcriptAudioPlayer);
  }, [transcriptAudioPlayer]);

  useEffect(() => {
    if (summaryAudioStatus.didJustFinish) {
      setActiveSummaryAudioKey(null);
    }
  }, [summaryAudioStatus.didJustFinish]);

  useEffect(() => {
    if (!pendingSummaryAudioKey || !summaryAudioSourceUri || !summaryAudioStatus.isLoaded) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        pauseAppOwnedAudioExcept('summary');
        await prepareInterpreterSpeakerPlaybackMode(selectedAudioOutputRoute);
        await summaryAudioPlayer.seekTo(0).catch(() => undefined);

        if (isCancelled) {
          return;
        }

        setActiveSummaryAudioKey(pendingSummaryAudioKey);
        summaryAudioPlayer.play();
        setPendingSummaryAudioKey(null);
      } catch (error) {
        if (!isCancelled) {
          setPendingSummaryAudioKey(null);
          setActiveSummaryAudioKey(null);
          onError(getErrorMessage(error), 'Spoken summary needs attention');
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    onError,
    pendingSummaryAudioKey,
    selectedAudioOutputRoute,
    summaryAudioPlayer,
    summaryAudioSourceUri,
    summaryAudioStatus.isLoaded
  ]);

  useEffect(() => {
    if (segmentAudioStatus.didJustFinish) {
      handleSegmentAudioFinished();
    }
  }, [segmentAudioStatus.didJustFinish]);

  useEffect(() => {
    const audioKey = currentPlayingSegmentKeyRef.current;

    if (!audioKey || pendingSegmentAudioKey || handledFinishedSegmentKeyRef.current === audioKey) {
      return;
    }

    const currentTime = Number(segmentAudioStatus.currentTime || 0);
    const duration = Number(segmentAudioStatus.duration || 0);
    const hasReachedEnd = duration > 0 && currentTime >= Math.max(0, duration - 0.28);

    if (!segmentAudioStatus.playing) {
      if (hasReachedEnd) {
        handleSegmentAudioFinished();
      }
      return;
    }

    const previousProgress = segmentPlaybackProgressRef.current;

    if (
      !previousProgress ||
      previousProgress.audioKey !== audioKey ||
      currentTime > previousProgress.currentTime + 0.04
    ) {
      segmentPlaybackProgressRef.current = {
        audioKey,
        currentTime,
        updatedAtMs: Date.now()
      };
      return;
    }

    const hasStalledNearEnd = hasReachedEnd && Date.now() - previousProgress.updatedAtMs > 900;
    const hasStalledWithoutBuffering =
      currentTime > 0.35 &&
      !segmentAudioStatus.isBuffering &&
      Date.now() - previousProgress.updatedAtMs > 3200;

    if (hasStalledNearEnd || hasStalledWithoutBuffering) {
      handleSegmentAudioFinished();
    }
  }, [
    pendingSegmentAudioKey,
    segmentAudioStatus.currentTime,
    segmentAudioStatus.duration,
    segmentAudioStatus.isBuffering,
    segmentAudioStatus.playing
  ]);

  useEffect(() => {
    if (!pendingSegmentAudioKey || !segmentAudioSourceUri || !segmentAudioStatus.isLoaded) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        pauseAppOwnedAudioExcept('segment');
        await prepareInterpreterSpeakerPlaybackMode(selectedAudioOutputRoute);
        await segmentAudioPlayer.seekTo(0).catch(() => undefined);

        if (isCancelled) {
          return;
        }

        setActiveSegmentAudioKey(pendingSegmentAudioKey);
        currentPlayingSegmentKeyRef.current = pendingSegmentAudioKey;
        handledFinishedSegmentKeyRef.current = null;
        segmentPlaybackProgressRef.current = {
          audioKey: pendingSegmentAudioKey,
          currentTime: 0,
          updatedAtMs: Date.now()
        };
        setLiveStatus('speaking');
        setLiveMode('responding');
        segmentAudioPlayer.play();
        setPendingSegmentAudioKey(null);
      } catch (error) {
        if (!isCancelled) {
          setPendingSegmentAudioKey(null);
          setActiveSegmentAudioKey(null);
          setLiveStatus('ready');
          setLiveMode('choosing');
          if (respondingLanguageCode) {
            updateLanguageSession(respondingLanguageCode, { status: 'ready' });
          }
          onError(getErrorMessage(error), 'Interpreter playback needs attention');
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    onError,
    pendingSegmentAudioKey,
    respondingLanguageCode,
    selectedAudioOutputRoute,
    segmentAudioPlayer,
    segmentAudioSourceUri,
    segmentAudioStatus.isLoaded
  ]);

  useEffect(() => {
    if (roomVoicePreviewStatus.didJustFinish) {
      setActiveRoomVoicePreviewKey(null);
    }
  }, [roomVoicePreviewStatus.didJustFinish]);

  useEffect(() => {
    if (transcriptAudioStatus.didJustFinish) {
      setActiveTranscriptAudioKey(null);
    }
  }, [transcriptAudioStatus.didJustFinish]);

  useEffect(() => {
    if (!transcriptAudioStatus.isLoaded) {
      return;
    }

    try {
      transcriptAudioPlayer.setPlaybackRate(transcriptAudioPlaybackRate);
    } catch {
      // Saved transcript playback is optional and must never interrupt the live interpreter room.
    }
  }, [transcriptAudioPlaybackRate, transcriptAudioPlayer, transcriptAudioStatus.isLoaded]);

  useEffect(() => {
    if (!pendingRoomVoicePreviewKey || !roomVoicePreviewSourceUri || !roomVoicePreviewStatus.isLoaded) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        pauseAppOwnedAudioExcept('voicePreview');
        await prepareInterpreterSpeakerPlaybackMode(selectedAudioOutputRoute);
        await roomVoicePreviewPlayer.seekTo(0).catch(() => undefined);

        if (isCancelled) {
          return;
        }

        setActiveRoomVoicePreviewKey(pendingRoomVoicePreviewKey);
        roomVoicePreviewPlayer.play();
        setPendingRoomVoicePreviewKey(null);
      } catch (error) {
        if (!isCancelled) {
          setPendingRoomVoicePreviewKey(null);
          setActiveRoomVoicePreviewKey(null);
          onError(getErrorMessage(error), 'Speaker preview needs attention');
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    onError,
    pendingRoomVoicePreviewKey,
    roomVoicePreviewPlayer,
    roomVoicePreviewSourceUri,
    roomVoicePreviewStatus.isLoaded,
    selectedAudioOutputRoute
  ]);

  useEffect(() => {
    if (!pendingTranscriptAudioKey || !transcriptAudioSourceUri || !transcriptAudioStatus.isLoaded) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        pauseAppOwnedAudioExcept('transcript');
        await prepareInterpreterSpeakerPlaybackMode(selectedAudioOutputRoute);
        await transcriptAudioPlayer.seekTo(0).catch(() => undefined);
        transcriptAudioPlayer.setPlaybackRate(transcriptAudioPlaybackRate);

        if (isCancelled) {
          return;
        }

        setActiveTranscriptAudioKey(pendingTranscriptAudioKey);
        transcriptAudioPlayer.play();
        setPendingTranscriptAudioKey(null);
      } catch (error) {
        if (!isCancelled) {
          setPendingTranscriptAudioKey(null);
          setActiveTranscriptAudioKey(null);
          onError(getErrorMessage(error), 'Transcript audio needs attention');
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    onError,
    pendingTranscriptAudioKey,
    selectedAudioOutputRoute,
    transcriptAudioPlayer,
    transcriptAudioPlaybackRate,
    transcriptAudioSourceUri,
    transcriptAudioStatus.isLoaded
  ]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const readiness = await getInterpreterAudioReadiness();

        if (!isMounted) {
          return;
        }

        if (readiness.granted) {
          setAudioReadiness(readiness);
          return;
        }

        const requestedReadiness = await requestInterpreterAudioReadiness();

        if (isMounted) {
          setAudioReadiness(requestedReadiness);
        }
      } catch (error) {
        if (isMounted) {
          onError(getErrorMessage(error), 'Microphone needs attention');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [onError]);

  useEffect(() => {
    setInvitedUserIds(details.meeting.invitedUserIds || []);
  }, [details.meeting.invitedUserIds]);

  useEffect(() => {
    if (!liveLanguageCatalog.some((language) => language.code === selectedLanguageCode)) {
      setSelectedLanguageSnapshot(liveLanguageCatalog[0]?.code || 'en-US');
    }
  }, [liveLanguageCatalog, selectedLanguageCode]);

  useEffect(() => {
    setLiveInterpretationHistory([]);
    setDetectedSourceLanguageCode(null);
    resetInterpreterReplayAudio();
    activeLiveVersionIdRef.current = null;
    liveVersionSeqRef.current = 0;
    setLiveVersionsSnapshot([]);
    setSelectedLiveVersionId(null);
    setLiveTranscriptSnapshot('');
    setLiveCleanTranscript('');
    setLiveTranslationSnapshot('');
    savedTranscriptFingerprintByVersionRef.current = {};
    latestSourceTranscriptByVersionRef.current = {};
    clearTranscriptPersistTimers();
  }, [details.meeting.meetingId]);

  useEffect(() => {
    const selectedVersion = liveVersions.find((version) => version.versionId === selectedLiveVersionId);

    if (selectedVersion) {
      setLiveTranscriptSnapshot(getCapturedSourceTranscriptText(selectedVersion.versionId));
      setLiveTranslationSnapshot(selectedVersion.translationsByLanguage[selectedLanguageCode] || selectedLanguageSession?.translation || '');
      return;
    }

    setLiveTranscriptSnapshot(selectedLanguageSession?.transcript || '');
    setLiveTranslationSnapshot(selectedLanguageSession?.translation || '');
  }, [
    liveVersions,
    selectedLanguageCode,
    selectedLanguageSession?.transcript,
    selectedLanguageSession?.translation,
    selectedLiveVersionId
  ]);

  useEffect(() => {
    const statuses = Object.values(languageSessionState).map((state) => state.status);

    if (!statuses.length) {
      return;
    }

    if (statuses.some((status) => status === 'speaking')) {
      setLiveStatus('speaking');
      setLiveMode('responding');
      return;
    }

    if (statuses.some((status) => status === 'listening' || status === 'ready')) {
      const isChoosingLanguage = statuses.every((status) => status === 'ready');

      setLiveStatus(isChoosingLanguage ? 'ready' : 'listening');
      setLiveMode((currentMode) => {
        if (currentMode === 'choosing' || currentMode === 'responding') {
          return currentMode;
        }

        return isChoosingLanguage ? 'choosing' : 'listening';
      });
      return;
    }

    if (statuses.some((status) => status === 'connecting')) {
      setLiveStatus('connecting');
      setLiveMode('connecting');
      return;
    }

    if (statuses.every((status) => status === 'error')) {
      setLiveStatus('error');
      setLiveMode('idle');
    }
  }, [languageSessionState]);

  function createNextLiveVersion(languageCode: string): InterpreterLiveVersion {
    const sequence = liveVersionSeqRef.current + 1;
    const versionId = `ilv_${Date.now()}_${sequence}`;

    liveVersionSeqRef.current = sequence;

    return {
      createdAtIso: new Date().toISOString(),
      selectedLanguageCode: languageCode,
      sequence,
      sourceTranscript: '',
      status: 'connecting',
      translationsByLanguage: {},
      versionId
    };
  }

  function updateLiveVersion(
    versionId: string | null,
    updater: (version: InterpreterLiveVersion) => InterpreterLiveVersion
  ) {
    if (!versionId) {
      return;
    }

    setLiveVersionsSnapshot((currentVersions) =>
      currentVersions.map((version) => version.versionId === versionId ? updater(version) : version)
    );
  }

  function getSelectedVersionId() {
    if (
      (liveMode === 'connecting' || liveMode === 'listening' || liveMode === 'responding') &&
      activeLiveVersionIdRef.current
    ) {
      return activeLiveVersionIdRef.current;
    }

    return selectedLiveVersionId || activeLiveVersionIdRef.current || liveVersionsRef.current[0]?.versionId || null;
  }

  function getSelectedLiveVersion(): InterpreterLiveVersion | null {
    const versionId = getSelectedVersionId();

    return versionId
      ? getLiveVersionById(versionId)
      : null;
  }

  function getLiveVersionById(versionId: string): InterpreterLiveVersion | null {
    return liveVersionsRef.current.find((currentVersion) => currentVersion.versionId === versionId) || null;
  }

  function getLiveVersionSequence(versionId: string) {
    const version = getLiveVersionById(versionId);

    if (version) {
      return version.sequence;
    }

    const parsedSequence = Number(versionId.split('_').pop());

    return Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : null;
  }

  function createControlledLiveTurn(languageCode: string): string {
    const liveVersion = createNextLiveVersion(languageCode);
    const nextVersion = {
      ...liveVersion,
      status: 'listening' as const
    };

    activeLiveVersionIdRef.current = nextVersion.versionId;
    setSelectedLiveVersionId(nextVersion.versionId);
    latestSourceTranscriptByVersionRef.current = {
      ...latestSourceTranscriptByVersionRef.current,
      [nextVersion.versionId]: ''
    };
    setLiveVersionsSnapshot((currentVersions) => [nextVersion, ...currentVersions]);
    setLiveTranscriptSnapshot('');
    setLiveTranslationSnapshot('');
    updateLanguageSession(languageCode, {
      status: 'listening',
      transcript: '',
      translation: '',
      versionId: nextVersion.versionId
    });

    return nextVersion.versionId;
  }

  function selectLiveTargetLanguage(languageCode: string) {
    if (!liveLanguageCatalog.some((language) => language.code === languageCode)) {
      return;
    }

    setSelectedLanguageSnapshot(languageCode);

    const versionId = activeLiveVersionIdRef.current || selectedLiveVersionId;

    if (versionId && liveMode !== 'responding') {
      updateLiveVersion(versionId, (version) => ({
        ...version,
        selectedLanguageCode: languageCode
      }));
    }
  }

  // Protected architecture: this controlled GPT Live room is working and must
  // remain a manual Listen -> Respond gate. Do not replace it with segmented
  // TTS, automatic Realtime responses, or saved-transcript playback logic. New
  // transcript library/audio features must run beside this flow, not inside it.
  async function startLiveInterpreter(languageCode = selectedLanguageCodeRef.current) {
    // A new session takes the audio input back, so any pending rebuild marker
    // is spent. Without this, the first listening turn of a fresh session would
    // rebuild something that was only just built.
    consumeInterpreterLiveSessionRebuildFlag();

    const previousVersionId = activeLiveVersionIdRef.current || selectedLiveVersionId;
    const previousTranscript = previousVersionId
      ? getCapturedSourceTranscriptText(previousVersionId).trim()
      : '';

    if (previousVersionId && previousTranscript) {
      void persistCurrentLiveTranscript(previousVersionId, {
        sourceTextOverride: previousTranscript,
        waitForStableSnapshot: true
      });
    }

    closeRealtimeSessionPool();
    const liveVersion = createNextLiveVersion(languageCode);

    activeLiveVersionIdRef.current = liveVersion.versionId;
    setSelectedLiveVersionId(liveVersion.versionId);
    latestSourceTranscriptByVersionRef.current = {
      ...latestSourceTranscriptByVersionRef.current,
      [liveVersion.versionId]: ''
    };
    setLiveVersionsSnapshot((currentVersions) => [liveVersion, ...currentVersions]);
    setLiveTranscriptSnapshot('');
    setLiveTranslationSnapshot('');
    setAudioLevel(0);
    setRemoteInterpreterStreamUrl(null);
    remoteInterpreterStreamUrlRef.current = null;
    setRemoteInterpreterStreamUrls({});
    remoteInterpreterStreamUrlsRef.current = {};
    setRemoteAudioActivity(null);
    remoteAudioActivityRef.current = null;
    setLiveResponseAudioBaseline(null);
    setDetectedSourceLanguageCode(null);
    setSelectedLanguageSnapshot(languageCode);
    setLiveStatus('connecting');
    setLiveMode('connecting');
    shouldStartFreshListeningTurnRef.current = false;
    setRespondingLanguageSnapshot(null);

    try {
      await prepareInterpreterRealtimeSpeechMode(selectedAudioOutputRoute);
      setLanguageSessionStateSnapshot({
        [languageCode]: {
          status: 'connecting',
          transcript: '',
          translation: '',
          versionId: liveVersion.versionId
        }
      });

      const voiceSession = await startInterpreterRealtimeSession({
        audioInputDeviceId: selectedAudioInputDeviceId,
        createAnswerSdp: async (offerSdp) => {
          const answerSdp = await onCreateRealtimeSdpAnswer(languageCode, offerSdp, 'controlled_voice');

          if (!answerSdp) {
            throw new Error('The controlled GPT Live interpreter session could not be prepared.');
          }

          return answerSdp;
        },
        initialRemoteAudioVolume: 1,
        sessionMode: 'controlled_voice'
      }, {
        onError: (message) => {
          const callbackVersionId = activeLiveVersionIdRef.current || liveVersion.versionId;
          const targetLanguageCode = getActiveLiveTargetLanguageCode(languageCode);

          updateLanguageSession(targetLanguageCode, { status: 'error', versionId: callbackVersionId });
          onError(message);
        },
        /**
         * Guidance, not a fault.
         *
         * Deliberately does not mark the language session as errored. A session
         * flagged in error stays flagged, so a moment of tapping Respond too
         * early used to leave the meeting looking broken for the rest of its
         * life.
         */
        onNotice: (message) => {
          setLiveNotice(message);
        },
        onKnowledgeToolCall: async (input) => {
          const idToken = await getIdToken();

          return lookupInterpreterApprovedKnowledge(idToken, details.meeting.meetingId, {
            query: input.query,
            targetLanguageCode: input.targetLanguageCode || selectedLanguageCodeRef.current
          });
        },
        onAudioLevel: (level) => {
          setAudioLevel(level);
        },
        onDetectedLanguage: (languageCode) => {
          setDetectedSourceLanguageCode(languageCode);
        },
        onRemoteAudioActivity: (activity) => {
          remoteAudioActivityRef.current = activity;
          setRemoteAudioActivity(activity);
        },
        onRemoteStreamUrl: (streamUrl) => {
          setRemoteInterpreterStreamUrls((currentUrls) => {
            const nextUrls = { ...currentUrls };

            if (streamUrl) {
              nextUrls[INTERPRETER_CONTROLLED_VOICE_SESSION_KEY] = streamUrl;
            } else {
              delete nextUrls[INTERPRETER_CONTROLLED_VOICE_SESSION_KEY];
            }

            remoteInterpreterStreamUrlsRef.current = nextUrls;
            return nextUrls;
          });
          remoteInterpreterStreamUrlRef.current = streamUrl;
          setRemoteInterpreterStreamUrl(streamUrl);
        },
        onResponseComplete: () => {
          const callbackVersionId = activeLiveVersionIdRef.current || liveVersion.versionId;
          const targetLanguageCode = getActiveLiveTargetLanguageCode(languageCode);

          updateLanguageSession(targetLanguageCode, { status: 'ready', versionId: callbackVersionId });
          updateLiveVersion(callbackVersionId, (version) => ({ ...version, status: 'ready' }));
          setLiveStatus('ready');
          setLiveMode('choosing');
          setRespondingLanguageSnapshot(null);
          setLiveResponseAudioBaseline(null);
          setAudioLevel(0);
        },
        onStatus: (status) => {
          const callbackVersionId = activeLiveVersionIdRef.current || liveVersion.versionId;
          const targetLanguageCode = getActiveLiveTargetLanguageCode(languageCode);

          updateLanguageSession(targetLanguageCode, { status, versionId: callbackVersionId });

          if (status === 'speaking') {
            setLiveStatus('speaking');
            setLiveMode('responding');
            updateLiveVersion(callbackVersionId, (version) => ({ ...version, status: 'responding' }));
            return;
          }

          if (status === 'listening') {
            setLiveStatus('listening');
            setLiveMode('listening');
            updateLiveVersion(callbackVersionId, (version) => ({ ...version, status: 'listening' }));
            return;
          }

          if (status === 'ready') {
            setLiveStatus('ready');
            setLiveMode('choosing');
            setAudioLevel(0);
            updateLiveVersion(callbackVersionId, (version) => ({ ...version, status: 'ready' }));
            return;
          }

          if (status === 'connecting') {
            setLiveStatus('connecting');
            setLiveMode('connecting');
            updateLiveVersion(callbackVersionId, (version) => ({ ...version, status: 'connecting' }));
          }
        },
        onTranscript: (transcript) => {
          const callbackVersionId = activeLiveVersionIdRef.current || liveVersion.versionId;
          const targetLanguageCode = getActiveLiveTargetLanguageCode(languageCode);

          if (!callbackVersionId) {
            return;
          }

          const nextTranscript = rememberLiveSourceTranscript(callbackVersionId, transcript);
          setLiveTranscriptSnapshot(nextTranscript);
          updateLanguageSession(targetLanguageCode, {
            status: 'listening',
            transcript: nextTranscript,
            versionId: callbackVersionId
          });
          updateLiveVersion(callbackVersionId, (version) => ({
            ...version,
            sourceTranscript: nextTranscript
          }));
        },
        onTranslation: (translation) => {
          const callbackVersionId = activeLiveVersionIdRef.current || liveVersion.versionId;
          const targetLanguageCode = getActiveLiveTargetLanguageCode(languageCode);

          setLiveTranslationSnapshot(translation);
          updateLanguageSession(targetLanguageCode, {
            status: 'speaking',
            translation,
            versionId: callbackVersionId
          });
          updateLiveVersion(callbackVersionId, (version) => ({
            ...version,
            selectedLanguageCode: targetLanguageCode,
            translationsByLanguage: {
              ...version.translationsByLanguage,
              [targetLanguageCode]: translation
            }
          }));
        }
      });

      await refreshInterpreterRealtimeAudioRoute(selectedAudioOutputRoute);

      realtimeSessionPoolRef.current = {
        [INTERPRETER_CONTROLLED_VOICE_SESSION_KEY]: voiceSession
      };

      setLiveStatus('listening');
      setLiveMode('listening');
      updateLiveVersion(liveVersion.versionId, (version) => ({ ...version, status: 'listening' }));
    } catch (error) {
      setLiveStatus('error');
      setLiveMode('idle');
      updateLiveVersion(liveVersion.versionId, (version) => ({ ...version, endedAtIso: new Date().toISOString(), status: 'error' }));
      onError(getErrorMessage(error));
    }
  }

  async function toggleLiveMicrophoneGate() {
    if (liveStatus === 'connecting' || liveMode === 'connecting') {
      return;
    }

    const activeVoiceSession = realtimeSessionPoolRef.current[INTERPRETER_CONTROLLED_VOICE_SESSION_KEY] || null;

    if (!activeVoiceSession) {
      await startLiveInterpreter(selectedLanguageCodeRef.current);
      return;
    }

    const activeVersionId = activeLiveVersionIdRef.current;
    const languageCode = selectedLanguageCodeRef.current;
    let listeningVersionId = activeVersionId;

    if (liveMode === 'listening') {
      void respondToCapturedLiveSpeech();
      return;
    }

    if (liveMode === 'responding') {
      activeVoiceSession.cancelResponse();
      setLiveResponseAudioBaseline(null);
    }

    // Rebuild when the microphone input has been taken away — after a saved
    // recording or a summary played, which reconfigures the audio session as
    // playback-only. Resuming in that state shows "Listening" and hears
    // nothing, because the input WebRTC was capturing through no longer exists.
    if (shouldStartFreshListeningTurnRef.current || consumeInterpreterLiveSessionRebuildFlag()) {
      shouldStartFreshListeningTurnRef.current = false;
      setLiveNotice('Reconnecting the microphone…');
      closeRealtimeSessionPool(false);
      activeLiveVersionIdRef.current = null;
      await startLiveInterpreter(languageCode);
      setLiveNotice(null);
      return;
    }

    if (activeVersionId && getCapturedSourceTranscriptText(activeVersionId).trim()) {
      void persistCurrentLiveTranscript(activeVersionId, {
        sourceTextOverride: getCapturedSourceTranscriptText(activeVersionId),
        waitForStableSnapshot: true
      });
      listeningVersionId = createControlledLiveTurn(languageCode);
    }

    await prepareInterpreterRealtimeSpeechMode(selectedAudioOutputRoute);
    setLiveTranscriptSnapshot('');
    setLiveTranslationSnapshot('');
    activeVoiceSession.resumeListening();

    // Re-applied **after** resuming, not before.
    //
    // resumeListening re-enables the microphone tracks, and WebRTC re-applies
    // its own audio session at that moment — which asks for a Bluetooth
    // microphone and drops the speaker back to the quiet hands-free profile.
    // Configuring before the resume was therefore undone immediately: the
    // first turn of a session sounded right and every turn after it did not.
    await refreshInterpreterRealtimeAudioRoute(selectedAudioOutputRoute);
    shouldStartFreshListeningTurnRef.current = false;
    setLiveNotice(null);
    setActiveInputName(getInterpreterActiveInputName());
    setLiveStatus('listening');
    setLiveMode('listening');
    updateLanguageSession(languageCode, {
      status: 'listening',
      transcript: '',
      translation: '',
      versionId: listeningVersionId || undefined
    });
    if (listeningVersionId) {
      updateLiveVersion(listeningVersionId, (version) => ({ ...version, status: 'listening' }));
    }
  }

  async function respondToCapturedLiveSpeech() {
    if (liveStatus === 'connecting' || liveMode !== 'listening' || isStartingLiveResponseRef.current) {
      return;
    }

    isStartingLiveResponseRef.current = true;

    try {
      const activeVoiceSession = realtimeSessionPoolRef.current[INTERPRETER_CONTROLLED_VOICE_SESSION_KEY] || null;

      if (!activeVoiceSession) {
        // Reconnect rather than stopping the meeting to tell somebody the
        // connection dropped. A live interpreter that hands the problem back to
        // the person using it is one they stop trusting in front of a customer.
        setLiveNotice('Reconnecting the interpreter…');

        try {
          await startLiveInterpreter(selectedLanguageCodeRef.current);
          setLiveNotice('Reconnected. Speak, then tap Respond.');
        } catch (reconnectError) {
          onError(getErrorMessage(reconnectError), 'Interpreter needs attention');
        }

        return;
      }

      const activeVersionId = activeLiveVersionIdRef.current;
      const languageCode = selectedLanguageCodeRef.current;
      const targetLanguage = liveLanguageCatalog.find((language) => language.code === languageCode)
        || details.meeting.interpreterLanguages.find((language) => language.code === languageCode)
        || details.meeting.interpreterLanguages[0];
      const targetLanguageLabel = targetLanguage?.label || 'English';
      const sourceText = getCapturedSourceTranscriptText(activeVersionId).trim();

      // No audio-session switch here any more. The listening session no longer
      // requests a Bluetooth microphone, so the speaker is already on the music
      // profile for the whole meeting. Switching sessions mid-call was both
      // unnecessary and a risk: WebRTC owns the session and re-applies its own
      // settings, so the change did nothing and could have interrupted capture.
      setLiveNotice(null);

      const didStartResponse = activeVoiceSession.respond({
        allowLatestAudioFallback: true,
        meetingName: details.meeting.meetingName,
        sourceText,
        targetLanguageCode: languageCode,
        targetLanguageLabel
      });

      if (!didStartResponse) {
        // The session already explained why, through onNotice or onError. The
        // point here is that the mode is left alone, so the speaker can simply
        // carry on talking and tap Respond again.
        return;
      }

      setRespondingLanguageSnapshot(languageCode);
      setLiveStatus('speaking');
      setLiveMode('responding');
      setLiveResponseAudioBaseline(remoteAudioActivityRef.current);
      updateLanguageSession(languageCode, { status: 'speaking', versionId: activeVersionId || undefined });
      if (activeVersionId) {
        updateLiveVersion(activeVersionId, (version) => ({
          ...version,
          selectedLanguageCode: languageCode,
          status: 'responding'
        }));
        scheduleStableTranscriptPersist(activeVersionId);
      }
    } finally {
      isStartingLiveResponseRef.current = false;
    }
  }

  function stopCurrentLiveVersion() {
    const activeVersionId = activeLiveVersionIdRef.current;

    void persistCurrentLiveTranscript(activeVersionId, {
      sourceTextOverride: getCapturedSourceTranscriptText(activeVersionId),
      waitForStableSnapshot: true
    });
    closeRealtimeSessionPool();
    activeLiveVersionIdRef.current = null;
    shouldStartFreshListeningTurnRef.current = false;
    if (activeVersionId) {
      const hasCapturedSpeech = Boolean(getCapturedSourceTranscriptText(activeVersionId).trim());
      updateLiveVersion(activeVersionId, (version) => ({
        ...version,
        endedAtIso: version.endedAtIso || new Date().toISOString(),
        status: hasCapturedSpeech ? 'ready' : 'stopped'
      }));
      setSelectedLiveVersionId(activeVersionId);
    }
    setLiveStatus('ready');
    setLiveMode('choosing');
    setRespondingLanguageSnapshot(null);
    setAudioLevel(0);
    setRemoteInterpreterStreamUrl(null);
    remoteInterpreterStreamUrlRef.current = null;
    setRemoteInterpreterStreamUrls({});
    remoteInterpreterStreamUrlsRef.current = {};
    setRemoteAudioActivity(null);
    remoteAudioActivityRef.current = null;
    setLiveResponseAudioBaseline(null);
    setDetectedSourceLanguageCode(null);
  }

  function resetLiveInterpreterRoom() {
    const activeVersionId = activeLiveVersionIdRef.current || selectedLiveVersionId;

    void persistCurrentLiveTranscript(activeVersionId, {
      sourceTextOverride: getCapturedSourceTranscriptText(activeVersionId),
      waitForStableSnapshot: true
    });
    closeRealtimeSessionPool();
    activeLiveVersionIdRef.current = null;
    setLiveStatus('closed');
    setLiveMode('idle');
    shouldStartFreshListeningTurnRef.current = false;
    setRespondingLanguageSnapshot(null);
    setAudioLevel(0);
    setRemoteInterpreterStreamUrl(null);
    remoteInterpreterStreamUrlRef.current = null;
    setRemoteInterpreterStreamUrls({});
    remoteInterpreterStreamUrlsRef.current = {};
    setRemoteAudioActivity(null);
    remoteAudioActivityRef.current = null;
    setLiveResponseAudioBaseline(null);
    setDetectedSourceLanguageCode(null);
    resetInterpreterReplayAudio();
    setLiveVersionsSnapshot([]);
    setSelectedLiveVersionId(null);
    setLiveTranscriptSnapshot('');
    setLiveCleanTranscript('');
    setLiveTranslationSnapshot('');
    liveVersionSeqRef.current = 0;
  }

  function resetInterpreterReplayAudio() {
    currentPlayingSegmentKeyRef.current = null;
    handledFinishedSegmentKeyRef.current = null;
    segmentPlaybackProgressRef.current = null;
    setActiveSegmentAudioKey(null);
    setPendingSegmentAudioKey(null);
    setSegmentAudioSourceUri(null);
  }

  function handleSegmentAudioFinished() {
    currentPlayingSegmentKeyRef.current = null;
    handledFinishedSegmentKeyRef.current = null;
    segmentPlaybackProgressRef.current = null;
    setActiveSegmentAudioKey(null);
    setPendingSegmentAudioKey(null);

    if (liveMode === 'responding') {
      setLiveStatus('ready');
      setLiveMode('choosing');
    }
  }

  async function listenAgain() {
    safePauseAudioPlayer(segmentAudioPlayer);
    resetInterpreterReplayAudio();
    setAudioLevel(0);
    await startLiveInterpreter(selectedLanguageCodeRef.current);
  }

  function getCapturedSourceText(): string {
    const sourceTranscript = getCapturedSourceTranscriptText();

    if (sourceTranscript) {
      return sourceTranscript;
    }

    return [
      liveTranslationRef.current,
      liveTranslation,
      ...Object.values(languageSessionStateRef.current).map((session) => session.translation)
    ].find((text) => text?.trim())?.trim() || '';
  }

  function getCapturedSourceTranscriptText(versionId = getSelectedVersionId()): string {
    const version = liveVersionsRef.current.find((currentVersion) => currentVersion.versionId === versionId);
    const activeVersionLiveTranscript = versionId && activeLiveVersionIdRef.current === versionId
      ? liveTranscriptRef.current
      : '';
    const rememberedVersionTranscript = versionId
      ? latestSourceTranscriptByVersionRef.current[versionId] || ''
      : '';
    const versionSessionTranscriptLines = versionId
      ? Object.values(languageSessionStateRef.current)
        .filter((session) => session.versionId === versionId)
        .map((session) => session.transcript)
      : [];

    if (versionId && version) {
      return mergeInterpreterRealtimeTextCandidates([
        activeVersionLiveTranscript,
        rememberedVersionTranscript,
        version.sourceTranscript,
        ...versionSessionTranscriptLines
      ]);
    }

    return mergeInterpreterRealtimeTextCandidates([
      liveTranscriptRef.current,
      rememberedVersionTranscript,
      version?.sourceTranscript,
      liveTranscript,
      languageSessionStateRef.current[selectedLanguageCode]?.transcript,
      ...Object.values(languageSessionStateRef.current).map((session) => session.transcript)
    ]);
  }

  function getCapturedTranslationText(languageCode: string): string {
    return [
      languageSessionStateRef.current[languageCode]?.translation,
      languageCode === selectedLanguageCode ? liveTranslationRef.current : '',
      languageCode === selectedLanguageCode ? liveTranslation : '',
      ...Object.entries(languageSessionStateRef.current)
        .filter(([currentLanguageCode]) => currentLanguageCode === languageCode)
        .map(([, session]) => session.translation)
    ].find((text) => text?.trim())?.trim() || '';
  }

  function getSummaryTranscriptSnapshotText(versionId = getSelectedVersionId()): string {
    const selectedVersion = versionId
      ? liveVersionsRef.current.find((currentVersion) => currentVersion.versionId === versionId) || null
      : null;
    const versionHistorySourceLines = versionId
      ? liveInterpretationHistory
        .filter((item) => item.versionId === versionId)
        .map((item) => item.sourceText)
      : [];
    const persistedVersionSourceLines = versionId
      ? details.translations
        .filter((translation) => translation.versionId === versionId)
        .map((translation) => translation.sourceText)
      : [];
    const liveVersionLines = selectedVersion
      ? [
          selectedVersion.sourceTranscript,
          ...versionHistorySourceLines,
          ...persistedVersionSourceLines,
          activeLiveVersionIdRef.current === selectedVersion.versionId ? liveTranscriptRef.current : ''
        ]
      : [];
    const meetingVersionLines = !selectedVersion
      ? [
          ...[...liveVersionsRef.current]
            .sort((firstVersion, secondVersion) => firstVersion.sequence - secondVersion.sequence)
            .map((version) => version.sourceTranscript?.trim()
              ? `Live version ${version.sequence}\n${version.sourceTranscript.trim()}`
              : ''
            ),
          ...details.transcripts.map((segment) => segment.text),
          ...details.translations.map((translation) => translation.sourceText),
          liveTranscriptRef.current,
          liveTranscript,
          ...Object.values(languageSessionStateRef.current).map((session) => session.transcript),
          ...liveInterpretationHistory.map((item) => item.sourceText)
        ]
      : [];
    const lines = [
      ...liveVersionLines,
      ...meetingVersionLines
    ]
      .map((text) => text?.trim())
      .filter((text): text is string => Boolean(text));
    const seen = new Set<string>();

    return lines
      .filter((line) => {
        const normalizedLine = line.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

        if (!normalizedLine || seen.has(normalizedLine)) {
          return false;
        }

        seen.add(normalizedLine);
        return true;
      })
      .join('\n')
      .slice(-120_000)
      .trim();
  }

  function recordLiveInterpretation(
    languageCode: string,
    sourceTextOverride?: string,
    translatedTextOverride?: string,
    translationId?: string,
    versionId?: string
  ) {
    const session = languageSessionStateRef.current[languageCode];
    const translatedText = translatedTextOverride || session?.translation || liveTranslationRef.current || liveTranslation;
    const sourceText = sourceTextOverride || session?.transcript || liveTranscriptRef.current || liveTranscript;

    if (!translatedText.trim() && !sourceText.trim()) {
      return;
    }

    setLiveInterpretationHistory((currentHistory) => {
      const lastItem = currentHistory[0];

      if (
        lastItem &&
        lastItem.languageCode === languageCode &&
        lastItem.sourceText === sourceText &&
        lastItem.translatedText === translatedText
      ) {
        return currentHistory;
      }

      return [{
        createdAtIso: new Date().toISOString(),
        languageCode,
        sourceText,
        translatedText,
        translationId,
        versionId
      }, ...currentHistory];
    });
  }

  function scheduleStableTranscriptPersist(versionId: string | null | undefined, delayMs = INTERPRETER_TRANSCRIPT_SAVE_SETTLE_MS) {
    if (!versionId) {
      return;
    }

    clearTranscriptPersistTimer(versionId);
    const timer = setTimeout(() => {
      clearTranscriptPersistTimer(versionId);
      void persistCurrentLiveTranscript(versionId, { waitForStableSnapshot: true });
    }, delayMs);

    transcriptPersistTimersRef.current = {
      ...transcriptPersistTimersRef.current,
      [versionId]: timer
    };
  }

  async function getStableCapturedSourceTranscriptText(
    versionId: string | null | undefined,
    sourceTextOverride?: string | null
  ): Promise<string> {
    let bestText = mergeInterpreterRealtimeTextCandidates([
      sourceTextOverride || '',
      getCapturedSourceTranscriptText(versionId)
    ]).trim();
    let bestFingerprint = createInterpreterTextFingerprint(bestText);
    let stableSinceMs = Date.now();
    const startedAtMs = Date.now();

    while (Date.now() - startedAtMs < INTERPRETER_TRANSCRIPT_SAVE_MAX_WAIT_MS) {
      await wait(INTERPRETER_TRANSCRIPT_SAVE_POLL_MS);

      const nextText = mergeInterpreterRealtimeTextCandidates([
        bestText,
        getCapturedSourceTranscriptText(versionId)
      ]).trim();
      const nextFingerprint = createInterpreterTextFingerprint(nextText);

      if (nextFingerprint !== bestFingerprint) {
        bestText = nextText;
        bestFingerprint = nextFingerprint;
        stableSinceMs = Date.now();
        continue;
      }

      if (Date.now() - stableSinceMs >= INTERPRETER_TRANSCRIPT_SAVE_SETTLE_MS) {
        break;
      }
    }

    return bestText;
  }

  async function persistCurrentLiveTranscript(
    versionId = activeLiveVersionIdRef.current || selectedLiveVersionId,
    options: { sourceTextOverride?: string | null; waitForStableSnapshot?: boolean } = {}
  ) {
    const rawText = options.waitForStableSnapshot
      ? await getStableCapturedSourceTranscriptText(versionId, options.sourceTextOverride)
      : mergeInterpreterRealtimeTextCandidates([
          options.sourceTextOverride || '',
          getCapturedSourceTranscriptText(versionId)
        ]).trim();

    if (!rawText) {
      return;
    }

    if (versionId) {
      rememberLiveSourceTranscript(versionId, rawText);
    }

    const cleanedText = cleanInterpreterLiveTranscriptForDisplay(rawText);
    const transcriptFingerprint = createInterpreterTextFingerprint(`${rawText}\n${cleanedText}`);
    const transcriptKey = versionId || 'meeting';

    if (savedTranscriptFingerprintByVersionRef.current[transcriptKey] === transcriptFingerprint) {
      return;
    }

    savedTranscriptFingerprintByVersionRef.current = {
      ...savedTranscriptFingerprintByVersionRef.current,
      [transcriptKey]: transcriptFingerprint
    };

    try {
      const idToken = await getIdToken();

      const result = await addInterpreterTranscriptSegment(
        idToken,
        details.meeting.meetingId,
        rawText,
        detectedSourceLanguageCode,
        cleanedText,
        versionId,
        selectedLanguageCodeRef.current
      );

      mergeTranscriptLibraryItem(result.segment, result.audioArtifact || null);
    } catch (error) {
      console.warn('Interpreter live transcript save failed:', getErrorMessage(error));
    }
  }

  function mergeTranscriptLibraryItem(
    segment: InterpreterMeetingDetails['transcripts'][number],
    audioArtifact: InterpreterTranscriptAudioArtifact | null
  ) {
    if (!segment.segmentId || !segment.cleanedText?.trim()) {
      return;
    }

    const nextItem: InterpreterTranscriptLibraryItem = {
      ...segment,
      audioArtifacts: audioArtifact ? [audioArtifact] : [],
      meetingId: details.meeting.meetingId,
      tenantId: details.meeting.tenantId
    };

    setTranscriptLibraryItems((currentItems) => {
      const withoutCurrent = currentItems.filter((item) => item.segmentId !== segment.segmentId);

      return sortTranscriptLibraryItems([nextItem, ...withoutCurrent]);
    });
  }

  async function loadTranscriptLibrary() {
    if (isTranscriptLibraryLoading) {
      return;
    }

    try {
      setIsTranscriptLibraryLoading(true);
      const idToken = await getIdToken();
      const result = await listInterpreterTranscriptLibrary(idToken, details.meeting.meetingId);

      setTranscriptLibraryItems(sortTranscriptLibraryItems(getCleanedTranscriptLibraryItems(result.transcripts)));
    } catch (error) {
      onError(getErrorMessage(error), 'Transcript library needs attention');
    } finally {
      setIsTranscriptLibraryLoading(false);
    }
  }

  function openTranscriptLibrary() {
    setIsTranscriptLibraryOpen(true);
    void loadTranscriptLibrary();
  }

  useEffect(() => {
    setIsTranscriptLibraryOpen(false);
    setTranscriptLibraryItems([]);
    setTranscriptLibraryFilter('all');
    setTranscriptAudioLanguageBySegment({});
    setTranscriptAudioSourceUri(null);
    setActiveTranscriptAudioKey(null);
    setPendingTranscriptAudioKey(null);
    setPreparingTranscriptAudioKey(null);
    setTranscriptAudioPlayerContext(null);
    setTranscriptAudioPlayerMode('expanded');
    setIsTranscriptSummaryOpen(false);
    setTranscriptSummaryLanguageCode(details.meeting.interpreterLanguages[0]?.code || selectedLanguageCode || 'en-US');
    setCreatingTranscriptSummaryLanguageCode(null);
    void loadTranscriptLibrary();
  }, [details.meeting.meetingId]);

  function setTranscriptAudioLanguage(segmentId: string, languageCode: string) {
    setTranscriptAudioLanguageBySegment((currentLanguages) => ({
      ...currentLanguages,
      [segmentId]: languageCode
    }));
  }

  function pauseAppOwnedAudioExcept(owner: 'segment' | 'summary' | 'transcript' | 'voicePreview') {
    if (owner !== 'segment') {
      safePauseAudioPlayer(segmentAudioPlayer);
      currentPlayingSegmentKeyRef.current = null;
      handledFinishedSegmentKeyRef.current = null;
      segmentPlaybackProgressRef.current = null;
      setActiveSegmentAudioKey(null);
      setPendingSegmentAudioKey(null);
    }

    if (owner !== 'summary') {
      safePauseAudioPlayer(summaryAudioPlayer);
      setActiveSummaryAudioKey(null);
      setPendingSummaryAudioKey(null);
    }

    if (owner !== 'transcript') {
      safePauseAudioPlayer(transcriptAudioPlayer);
      setActiveTranscriptAudioKey(null);
      setPendingTranscriptAudioKey(null);
    }

    if (owner !== 'voicePreview') {
      safePauseAudioPlayer(roomVoicePreviewPlayer);
      setActiveRoomVoicePreviewKey(null);
      setPendingRoomVoicePreviewKey(null);
    }
  }

  async function handleDeleteTranscriptSegments(segmentIds: string[]) {
    if (!segmentIds.length) {
      return;
    }

    try {
      safePauseAudioPlayer(transcriptAudioPlayer);
      setActiveTranscriptAudioKey(null);
      setPendingTranscriptAudioKey(null);
      setTranscriptAudioSourceUri(null);
      setTranscriptAudioPlayerContext((currentContext) =>
        currentContext?.item.segmentId && segmentIds.includes(currentContext.item.segmentId)
          ? null
          : currentContext
      );
      const idToken = await getIdToken();
      const result = await deleteInterpreterTranscriptSegments(idToken, details.meeting.meetingId, segmentIds);
      const deletedSegmentIds = new Set(result.deletedSegmentIds);

      setTranscriptLibraryItems((currentItems) =>
        currentItems.filter((item) => !item.segmentId || !deletedSegmentIds.has(item.segmentId))
      );
      await loadTranscriptLibrary();
    } catch (error) {
      onError(getErrorMessage(error), 'Saved transcript delete needs attention');
      throw error;
    }
  }

  function updateTranscriptAudioArtifact(audioArtifact: InterpreterTranscriptAudioArtifact) {
    setTranscriptLibraryItems((currentItems) => currentItems.map((item) => {
      if (item.segmentId !== audioArtifact.segmentId) {
        return item;
      }

      const otherArtifacts = item.audioArtifacts.filter((artifact) => artifact.artifactId !== audioArtifact.artifactId);

      return {
        ...item,
        audioArtifacts: [audioArtifact, ...otherArtifacts]
      };
    }));
  }

  function getSelectedTranscriptAudioLanguage(item: InterpreterTranscriptLibraryItem): {
    audioKey: string;
    languageCode: string;
    languageLabel: string;
  } | null {
    if (!item.segmentId) {
      return null;
    }

    const languageCode = transcriptAudioLanguageBySegment[item.segmentId] || selectedLanguageCode || 'en-US';
    const audioKey = getInterpreterTranscriptAudioKey(item.segmentId, languageCode, selectedVoiceId);
    const languageLabel = getLanguageLabel(liveLanguageCatalog, languageCode);

    return {
      audioKey,
      languageCode,
      languageLabel
    };
  }

  function openTranscriptAudioPlayer(
    item: InterpreterTranscriptLibraryItem,
    audioArtifact: InterpreterTranscriptAudioArtifact,
    languageCode: string,
    audioKey: string
  ) {
    setTranscriptAudioPlayerContext({
      artifact: audioArtifact,
      audioKey,
      item,
      languageCode,
      languageLabel: audioArtifact.languageLabel || getLanguageLabel(liveLanguageCatalog, languageCode)
    });
    setTranscriptAudioPlayerMode('expanded');
    setTranscriptAudioSourceUri(audioArtifact.downloadUrl || null);
    setPendingTranscriptAudioKey(audioKey);
  }

  async function prepareTranscriptAudioForSavedItem(
    item: InterpreterTranscriptLibraryItem,
    mode: 'prepare' | 'play'
  ) {
    const selectedAudio = getSelectedTranscriptAudioLanguage(item);

    if (!item.segmentId || !selectedAudio) {
      onError('This saved transcript cannot be prepared yet.', 'Transcript audio needs attention');
      return;
    }

    const { audioKey, languageCode } = selectedAudio;
    const existingArtifact = getTranscriptAudioArtifactForLanguage(item, languageCode, selectedVoiceId);

    if (existingArtifact?.status === 'ready' && existingArtifact.downloadUrl) {
      if (mode === 'play') {
        openTranscriptAudioPlayer(item, existingArtifact, languageCode, audioKey);
      }

      return;
    }

    try {
      setPreparingTranscriptAudioKey(audioKey);

      const idToken = await getIdToken();
      const result = await prepareInterpreterTranscriptAudio(
        idToken,
        details.meeting.meetingId,
        item.segmentId,
        {
          languageCode,
          voiceId: selectedVoiceId
        }
      );

      updateTranscriptAudioArtifact(result.audioArtifact);

      if (result.audioArtifact.status !== 'ready' || !result.audioArtifact.downloadUrl) {
        if (mode === 'play') {
          onError('Transcript audio is still being prepared. Please try again in a moment.', 'Transcript audio needs attention');
        }

        return;
      }

      if (mode === 'play') {
        openTranscriptAudioPlayer(item, result.audioArtifact, languageCode, audioKey);
      }
    } catch (error) {
      onError(getErrorMessage(error), 'Transcript audio needs attention');
    } finally {
      setPreparingTranscriptAudioKey(null);
    }
  }

  async function handlePrepareTranscriptAudio(item: InterpreterTranscriptLibraryItem) {
    await prepareTranscriptAudioForSavedItem(item, 'prepare');
  }

  async function handlePlayTranscriptAudio(item: InterpreterTranscriptLibraryItem) {
    const selectedAudio = getSelectedTranscriptAudioLanguage(item);

    if (!item.segmentId || !selectedAudio) {
      onError('This saved transcript cannot be played yet.', 'Transcript audio needs attention');
      return;
    }

    const { audioKey } = selectedAudio;

    if (transcriptAudioPlayerContext?.audioKey === audioKey && transcriptAudioSourceUri && transcriptAudioStatus.isLoaded) {
      if (transcriptAudioStatus.playing) {
        safePauseAudioPlayer(transcriptAudioPlayer);
        setActiveTranscriptAudioKey(null);
        return;
      }

      try {
        pauseAppOwnedAudioExcept('transcript');
        await prepareInterpreterSpeakerPlaybackMode(selectedAudioOutputRoute);

        if (
          transcriptAudioStatus.duration > 0 &&
          transcriptAudioStatus.currentTime >= transcriptAudioStatus.duration - 0.25
        ) {
          await transcriptAudioPlayer.seekTo(0).catch(() => undefined);
        }

        transcriptAudioPlayer.setPlaybackRate(transcriptAudioPlaybackRate);
        setActiveTranscriptAudioKey(audioKey);
        transcriptAudioPlayer.play();
      } catch (error) {
        onError(getErrorMessage(error), 'Transcript audio needs attention');
      }

      return;
    }

    await prepareTranscriptAudioForSavedItem(item, 'play');
  }

  function closeTranscriptAudioPlayer() {
    safePauseAudioPlayer(transcriptAudioPlayer);
    setActiveTranscriptAudioKey(null);
    setPendingTranscriptAudioKey(null);
    setTranscriptAudioSourceUri(null);
    setTranscriptAudioPlayerContext(null);
    setTranscriptAudioPlayerMode('expanded');
  }

  function minimizeTranscriptAudioPlayer() {
    if (transcriptAudioPlayerContext) {
      setTranscriptAudioPlayerMode('minimized');
    }
  }

  function expandTranscriptAudioPlayer() {
    if (transcriptAudioPlayerContext) {
      setTranscriptAudioPlayerMode('expanded');
    }
  }

  async function seekTranscriptAudio(seconds: number) {
    if (!transcriptAudioStatus.isLoaded) {
      return;
    }

    const duration = transcriptAudioStatus.duration > 0 ? transcriptAudioStatus.duration : seconds;
    const nextSeconds = Math.max(0, Math.min(seconds, duration));

    await transcriptAudioPlayer.seekTo(nextSeconds).catch((error) => {
      onError(getErrorMessage(error), 'Transcript audio needs attention');
    });
  }

  async function skipTranscriptAudio(deltaSeconds: number) {
    await seekTranscriptAudio((transcriptAudioStatus.currentTime || 0) + deltaSeconds);
  }

  async function sharePreparedTranscriptAudio() {
    const playerContext = transcriptAudioPlayerContext;

    if (!playerContext?.artifact.downloadUrl) {
      onError('Prepare the transcript audio before sharing it.', 'Transcript audio needs attention');
      return;
    }

    try {
      setSharingTranscriptAudioKey(playerContext.audioKey);

      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (!isSharingAvailable) {
        throw new Error('Native sharing is not available on this device.');
      }

      const cachedUri = await getLocalTranscriptAudioShareUri(
        details.meeting.meetingName,
        playerContext,
        transcriptAudioShareCache
      );

      setTranscriptAudioShareCache((currentCache) => ({
        ...currentCache,
        [playerContext.audioKey]: cachedUri
      }));

      await Sharing.shareAsync(cachedUri, {
        dialogTitle: 'Share transcript audio',
        mimeType: playerContext.artifact.contentType || 'audio/mpeg',
        UTI: 'public.mp3'
      });
    } catch (error) {
      onError(getErrorMessage(error), 'Transcript audio share needs attention');
    } finally {
      setSharingTranscriptAudioKey(null);
    }
  }

  function changeTranscriptAudioPlaybackRate(rate: number) {
    setTranscriptAudioPlaybackRate(rate);

    try {
      transcriptAudioPlayer.setPlaybackRate(rate);
    } catch {
      // The next loaded audio effect will apply the selected speed.
    }
  }

  async function toggleTranscriptAudioPlayback() {
    const playerContext = transcriptAudioPlayerContext;

    if (!playerContext) {
      return;
    }

    if (transcriptAudioStatus.playing) {
      safePauseAudioPlayer(transcriptAudioPlayer);
      setActiveTranscriptAudioKey(null);
      return;
    }

    await handlePlayTranscriptAudio(playerContext.item);
  }

  function closeRealtimeSessionPool(resetState = true) {
    Object.values(realtimeSessionPoolRef.current).forEach((session) => session.close());
    realtimeSessionPoolRef.current = {};
    setRemoteInterpreterStreamUrl(null);
    remoteInterpreterStreamUrlRef.current = null;
    setRemoteInterpreterStreamUrls({});
    remoteInterpreterStreamUrlsRef.current = {};

    if (resetState) {
      setLanguageSessionStateSnapshot({});
    }
  }

  function updateLanguageSession(languageCode: string, patch: Partial<InterpreterLanguageSessionState>) {
    setLanguageSessionStateSnapshot((currentState) => ({
      ...currentState,
      [languageCode]: {
        status: currentState[languageCode]?.status || 'closed',
        transcript: currentState[languageCode]?.transcript || '',
        translation: currentState[languageCode]?.translation || '',
        ...patch
      }
    }));
  }

  async function playInterpreterSummaryAudioPayload(
    summaryId: string,
    audio: InterpreterSummaryAudio
  ) {
    const audioKey = getInterpreterSummaryAudioKey(summaryId, audio.languageCode);
    const cachedUri = summaryAudioCache[audioKey] || await cacheInterpreterSummaryAudio(summaryId, audio);

    setSummaryAudioCache((currentCache) => ({
      ...currentCache,
      [audioKey]: cachedUri
    }));

    setSummaryAudioSourceUri(cachedUri);
    setPendingSummaryAudioKey(audioKey);
  }

  async function playInterpreterSegmentAudioPayload(audio: InterpreterSegmentAudio) {
    const cachedUri = await cacheInterpreterSegmentAudioPayload(audio);

    setSegmentAudioSourceUri(cachedUri);
    setPendingSegmentAudioKey(getInterpreterSegmentAudioKey(details.meeting.meetingId, audio.translationId, audio.languageCode));
    setLiveStatus('speaking');
    setLiveMode('responding');
  }

  async function cacheInterpreterSegmentAudioPayload(audio: InterpreterSegmentAudio) {
    const audioKey = getInterpreterSegmentAudioKey(details.meeting.meetingId, audio.translationId, audio.languageCode);
    const cachedUri = segmentAudioCache[audioKey] || await cacheInterpreterSegmentAudio(details.meeting.meetingId, audio);

    setSegmentAudioCache((currentCache) => ({
      ...currentCache,
      [audioKey]: cachedUri
    }));

    return cachedUri;
  }

  async function handleReplayInterpreterSegmentAudio() {
    if (!segmentAudioSourceUri) {
      return;
    }

    try {
      if (segmentAudioStatus.playing) {
        safePauseAudioPlayer(segmentAudioPlayer);
        currentPlayingSegmentKeyRef.current = null;
        handledFinishedSegmentKeyRef.current = null;
        segmentPlaybackProgressRef.current = null;
        setActiveSegmentAudioKey(null);
        setLiveStatus('ready');
        return;
      }

      currentPlayingSegmentKeyRef.current = null;
      handledFinishedSegmentKeyRef.current = null;
      segmentPlaybackProgressRef.current = null;
      setPendingSegmentAudioKey(activeSegmentAudioKey || `current:${respondingLanguageCode || selectedLanguageCode}`);
      setLiveStatus('speaking');
      setLiveMode('responding');
    } catch (error) {
      onError(getErrorMessage(error), 'Interpreter playback needs attention');
    }
  }

  async function handlePlayInterpreterSummary(
    summary: InterpreterMeetingDetails['summaries'][number],
    languageCode: string
  ) {
    const audioKey = getInterpreterSummaryAudioKey(summary.summaryId, languageCode);

    if (activeSummaryAudioKey === audioKey && summaryAudioStatus.playing) {
      safePauseAudioPlayer(summaryAudioPlayer);
      setActiveSummaryAudioKey(null);
      return;
    }

    try {
      setPreparingSummaryAudioKey(audioKey);

      const cachedUri = summaryAudioCache[audioKey];

      if (cachedUri) {
        setSummaryAudioSourceUri(cachedUri);
        setPendingSummaryAudioKey(audioKey);
        return;
      }

      const idToken = await getIdToken();
      const result = await createInterpreterSummaryAudio(
        idToken,
        details.meeting.meetingId,
        summary.summaryId,
        languageCode,
        selectedVoiceId
      );

      await playInterpreterSummaryAudioPayload(summary.summaryId, result.audio);
    } catch (error) {
      onError(getErrorMessage(error), 'Spoken summary needs attention');
    } finally {
      setPreparingSummaryAudioKey(null);
    }
  }

  async function cacheInterpreterSummaryAudioByLanguage(
    summaryId: string,
    audioByLanguage?: Record<string, InterpreterSummaryAudio>
  ) {
    const audioEntries = Object.entries(audioByLanguage || {});

    if (!audioEntries.length) {
      return;
    }

    const cachedEntries = await Promise.all(audioEntries.map(async ([languageCode, audio]) => {
      const audioKey = getInterpreterSummaryAudioKey(summaryId, languageCode);
      const cachedUri = await cacheInterpreterSummaryAudio(summaryId, audio);

      return [audioKey, cachedUri] as const;
    }));

    setSummaryAudioCache((currentCache) => ({
      ...currentCache,
      ...Object.fromEntries(cachedEntries)
    }));
  }

  async function handleCreateTranscriptLibrarySummary(languageCode: string) {
    const transcriptText = buildTranscriptLibrarySummarySourceText(transcriptLibraryItems);

    if (!transcriptText) {
      onError('There are no saved cleaned transcripts to summarize yet.', 'Saved transcript summary');
      return null;
    }

    try {
      setCreatingTranscriptSummaryLanguageCode(languageCode);
      const result = await onCreateSummary(
        [languageCode],
        transcriptText,
        {
          versionId: INTERPRETER_TRANSCRIPT_LIBRARY_SUMMARY_VERSION_ID,
          versionSequence: null
        }
      );

      if (result?.summary) {
        await cacheInterpreterSummaryAudioByLanguage(result.summary.summaryId, result.summaryAudioByLanguage);
      }

      return result;
    } finally {
      setCreatingTranscriptSummaryLanguageCode(null);
    }
  }

  async function handlePlayInterpreterHistoryItem(item: InterpreterLiveHistoryItem) {
    if (!item.translationId) {
      onError('This interpretation does not have replay audio available yet.', 'Interpretation history needs attention');
      return;
    }

    const audioKey = getInterpreterSegmentAudioKey(details.meeting.meetingId, item.translationId, item.languageCode);

    if (activeSegmentAudioKey === audioKey && segmentAudioStatus.playing) {
      safePauseAudioPlayer(segmentAudioPlayer);
      currentPlayingSegmentKeyRef.current = null;
      handledFinishedSegmentKeyRef.current = null;
      segmentPlaybackProgressRef.current = null;
      setActiveSegmentAudioKey(null);
      setLiveStatus('ready');
      return;
    }

    try {
      currentPlayingSegmentKeyRef.current = null;
      handledFinishedSegmentKeyRef.current = null;
      segmentPlaybackProgressRef.current = null;
      setPreparingHistoryAudioKey(audioKey);
      setSelectedLanguageSnapshot(item.languageCode);
      setRespondingLanguageSnapshot(item.languageCode);

      const cachedUri = segmentAudioCache[audioKey];

      if (cachedUri) {
        setSegmentAudioSourceUri(cachedUri);
        setPendingSegmentAudioKey(audioKey);
        return;
      }

      const idToken = await getIdToken();
      const result = await createInterpreterTranslationReplayAudio(
        idToken,
        details.meeting.meetingId,
        item.translationId,
        selectedVoiceId
      );

      await playInterpreterSegmentAudioPayload(result.audio);
    } catch (error) {
      onError(getErrorMessage(error), 'Interpretation history needs attention');
    } finally {
      setPreparingHistoryAudioKey(null);
    }
  }

  async function handlePreviewRoomVoice(voice: InterpreterVoiceProfile) {
    const previewLanguageCode = details.meeting.interpreterLanguages[0]?.code || selectedLanguageCode || 'en-US';
    const previewKey = getInterpreterVoicePreviewAudioKey(voice.id, previewLanguageCode);

    if (activeRoomVoicePreviewKey === previewKey && roomVoicePreviewStatus.playing) {
      safePauseAudioPlayer(roomVoicePreviewPlayer);
      setActiveRoomVoicePreviewKey(null);
      return;
    }

    try {
      setPreparingRoomVoicePreviewKey(previewKey);

      const cachedUri = roomVoicePreviewCache[previewKey];

      if (cachedUri) {
        setRoomVoicePreviewSourceUri(cachedUri);
        setPendingRoomVoicePreviewKey(previewKey);
        return;
      }

      const idToken = await getIdToken();
      const result = await createInterpreterVoicePreviewAudio(idToken, {
        languageCode: previewLanguageCode,
        voiceId: voice.id
      });
      const cachedPreviewUri = await cacheInterpreterVoicePreviewAudio(result.audio);

      setRoomVoicePreviewCache((currentCache) => ({
        ...currentCache,
        [previewKey]: cachedPreviewUri
      }));
      setRoomVoicePreviewSourceUri(cachedPreviewUri);
      setPendingRoomVoicePreviewKey(previewKey);
    } catch (error) {
      onError(getErrorMessage(error), 'Speaker preview needs attention');
    } finally {
      setPreparingRoomVoicePreviewKey(null);
    }
  }

  function confirmLeaveRoom() {
    Alert.alert(
      'End interpreter session?',
      'Going back will end this live interpreter session.',
      [
        { style: 'cancel', text: 'Stay' },
        {
          onPress: () => void leaveRoomAndEndSession(),
          style: 'destructive',
          text: 'End session'
        }
      ]
    );
  }

  function confirmEndRoom() {
    Alert.alert(
      'End interpreter session?',
      'This will stop live interpreting for this meeting. Saved summaries and history remain available.',
      [
        { style: 'cancel', text: 'Keep open' },
        {
          onPress: () => void leaveRoomAndEndSession(),
          style: 'destructive',
          text: 'End session'
        }
      ]
    );
  }

  async function leaveRoomAndEndSession() {
    if (isExitingRoom) {
      return;
    }

    setIsExitingRoom(true);

    try {
      await persistCurrentLiveTranscript();
      resetLiveInterpreterRoom();

      if (details.meeting.status !== 'ENDED') {
        await onEndMeeting();
      }

      onBack();
    } catch (error) {
      onError(getErrorMessage(error), 'Interpreter needs attention');
    } finally {
      setIsExitingRoom(false);
    }
  }

  async function updateInterpreterAudioRouteSettings(input: {
    audioInputDeviceId: string | null;
    audioOutputRoute: InterpreterAudioOutputRoute;
  }) {
    setSelectedAudioInputDeviceId(input.audioInputDeviceId);
    setSelectedAudioOutputRoute(input.audioOutputRoute);
    if (isRealtimeActive || liveMode === 'listening' || liveMode === 'responding') {
      await prepareInterpreterRealtimeSpeechMode(input.audioOutputRoute);
    } else {
      await applyInterpreterNativeAudioRoute(input.audioOutputRoute);
    }
    await refreshInterpreterAudioDevices();
  }

  const isSegmentAudioActivelyPlaying = segmentAudioStatus.playing;

  return (
    <View style={styles.roomHost}>
      <InterpreterLiveRoomModal
        audioLevel={audioLevel}
        activeHistoryAudioKey={activeSegmentAudioKey}
        availableLanguages={liveLanguageCatalog}
        detectedSourceLanguageCode={detectedSourceLanguageCode}
        details={details}
        hasReplayableInterpretationAudio={Boolean(segmentAudioSourceUri)}
        historyItems={liveInterpretationHistory}
        isHistoryAudioPlaying={isSegmentAudioActivelyPlaying}
        isInterpretationAudioPlaying={isSegmentAudioActivelyPlaying}
        isPreparingInterpretationAudio={false}
        isHistoryOpen={isLiveHistoryOpen}
        isOpen
        isTranscriptOpen={isLiveTranscriptOpen}
        languageSessionState={languageSessionState}
        liveCleanTranscript={liveCleanTranscript}
        liveVersions={liveVersions}
        liveMode={liveMode}
        liveStatus={liveStatus}
        liveTranscript={liveTranscript}
        liveTranslation={liveTranslation}
        onClose={confirmLeaveRoom}
        onEnd={confirmEndRoom}
        onOpenHistory={() => setIsLiveHistoryOpen(true)}
        onOpenSettings={() => setIsRoomSettingsOpen(true)}
        onOpenSummary={() => setIsSummaryModalOpen(true)}
        onOpenTranscript={() => setIsLiveTranscriptOpen(true)}
        onOpenTranscriptLibrary={openTranscriptLibrary}
        onReplayInterpretationAudio={() => void handleReplayInterpreterSegmentAudio()}
        activeInputName={activeInputName}
        liveNotice={liveNotice}
        onRespond={respondToCapturedLiveSpeech}
        onListen={listenAgain}
        onSelectVersion={(versionId) => {
          setSelectedLiveVersionId(versionId);
          const version = liveVersions.find((currentVersion) => currentVersion.versionId === versionId);
          if (version) {
            setLiveTranscriptSnapshot(getCapturedSourceTranscriptText(versionId));
            const languageCode = version.selectedLanguageCode || selectedLanguageCode;
            setSelectedLanguageSnapshot(languageCode);
            setLiveTranslationSnapshot(version.translationsByLanguage[languageCode] || '');
          }
        }}
        onToggleMicrophone={() => void toggleLiveMicrophoneGate()}
        onTranscriptClose={() => setIsLiveTranscriptOpen(false)}
        onHistoryClose={() => setIsLiveHistoryOpen(false)}
        onPlayHistoryItem={(item) => void handlePlayInterpreterHistoryItem(item)}
        preparingHistoryAudioKey={preparingHistoryAudioKey}
        respondingLanguageCode={respondingLanguageCode}
        remoteAudioActivity={remoteAudioActivity}
        remoteAudioBaseline={liveResponseAudioBaseline}
        remoteAudioStreamUrls={remoteInterpreterStreamUrls}
        selectedLanguageCode={selectedLanguageCode}
        selectedLiveVersionId={selectedLiveVersionId}
        onSelectTargetLanguage={selectLiveTargetLanguage}
        settingsPanel={(
          <InterpreterRoomSettingsPanel
            activePreviewKey={activeRoomVoicePreviewKey}
            details={details}
            isBusy={isBusy}
            isOpen={isRoomSettingsOpen}
            onClose={() => setIsRoomSettingsOpen(false)}
            onPreviewVoice={(voice) => void handlePreviewRoomVoice(voice)}
            onUpdateVoice={onUpdateVoice}
            preparingPreviewKey={preparingRoomVoicePreviewKey}
            previewLanguageCode={details.meeting.interpreterLanguages[0]?.code || selectedLanguageCode || 'en-US'}
            selectedVoiceId={selectedVoiceId}
            voices={voiceProfiles.length ? voiceProfiles : FALLBACK_INTERPRETER_VOICES}
          />
        )}
        summaryPanel={(
          <InterpreterSummaryLanguageModal
            activeAudioKey={activeSummaryAudioKey}
            isBusy={isBusy}
            isAudioPlaying={summaryAudioStatus.playing}
            isOpen={isSummaryModalOpen}
            languages={details.meeting.interpreterLanguages}
            onClose={() => setIsSummaryModalOpen(false)}
            onError={onError}
            onPlaySummary={(summary, languageCode) => void handlePlayInterpreterSummary(summary, languageCode)}
            onSubmit={async (languageCodes) => {
              const selectedVersionForSummary = getSelectedLiveVersion();
              const result = await onCreateSummary(
                languageCodes,
                getSummaryTranscriptSnapshotText(selectedVersionForSummary?.versionId || null),
                {
                  versionId: selectedVersionForSummary?.versionId || null,
                  versionSequence: selectedVersionForSummary?.sequence || null
                }
              );

              if (!result) {
                return;
              }

              const firstAudio = languageCodes
                .map((languageCode) => result.summaryAudioByLanguage?.[languageCode])
                .find((audio): audio is InterpreterSummaryAudio => Boolean(audio));

              if (firstAudio) {
                await playInterpreterSummaryAudioPayload(result.summary.summaryId, firstAudio);
                return;
              }

              const replayLanguageCode = languageCodes.find((languageCode) =>
                result.summary.languageCodes.includes(languageCode)
              );

              if (replayLanguageCode) {
                await handlePlayInterpreterSummary(result.summary, replayLanguageCode);
              }
            }}
            preparingAudioKey={preparingSummaryAudioKey}
            selectedVersion={getSelectedLiveVersion()}
            summaries={details.summaries}
          />
        )}
        summaryCount={details.summaries.length}
        transcriptLibraryCount={transcriptLibraryItems.length}
        transcriptLibraryPanel={(
          <InterpreterTranscriptLibraryModal
            activeAudioKey={activeTranscriptAudioKey}
            audioPlayerContext={transcriptAudioPlayerContext}
            audioPlayerDuration={transcriptAudioStatus.duration}
            audioPlayerMode={transcriptAudioPlayerMode}
            audioPlayerPosition={transcriptAudioStatus.currentTime}
            activeSummaryAudioKey={activeSummaryAudioKey}
            availableLanguages={liveLanguageCatalog}
            creatingSummaryLanguageCode={creatingTranscriptSummaryLanguageCode}
            isBusy={isBusy}
            isAudioPlaying={transcriptAudioStatus.playing}
            isAudioSharing={Boolean(
              transcriptAudioPlayerContext && sharingTranscriptAudioKey === transcriptAudioPlayerContext.audioKey
            )}
            isAudioLoaded={transcriptAudioStatus.isLoaded}
            isSummaryAudioPlaying={summaryAudioStatus.playing}
            filter={transcriptLibraryFilter}
            isLoading={isTranscriptLibraryLoading}
            isOpen={isTranscriptLibraryOpen}
            items={transcriptLibraryItems}
            meeting={details.meeting}
            onAudioPlaybackRateChange={changeTranscriptAudioPlaybackRate}
            onAudioPlayerClose={closeTranscriptAudioPlayer}
            onAudioPlayerExpand={expandTranscriptAudioPlayer}
            onAudioPlayerMinimize={minimizeTranscriptAudioPlayer}
            onAudioSeek={seekTranscriptAudio}
            onAudioShare={() => void sharePreparedTranscriptAudio()}
            onAudioSkip={skipTranscriptAudio}
            onAudioTogglePlayback={() => void toggleTranscriptAudioPlayback()}
            onClose={() => setIsTranscriptLibraryOpen(false)}
            onCreateSummary={(languageCode) => handleCreateTranscriptLibrarySummary(languageCode)}
            onDeleteTranscripts={(segmentIds) => handleDeleteTranscriptSegments(segmentIds)}
            onFilterChange={setTranscriptLibraryFilter}
            onPlaySummary={(summary, languageCode) => void handlePlayInterpreterSummary(summary, languageCode)}
            onPrepareAudio={(item) => void handlePrepareTranscriptAudio(item)}
            onRefresh={loadTranscriptLibrary}
            onPlayAudio={(item) => void handlePlayTranscriptAudio(item)}
            onSelectLanguage={setTranscriptAudioLanguage}
            onSummaryLanguageChange={setTranscriptSummaryLanguageCode}
            playbackRate={transcriptAudioPlaybackRate}
            preparingAudioKey={preparingTranscriptAudioKey}
            preparingSummaryAudioKey={preparingSummaryAudioKey}
            selectedLanguageBySegment={transcriptAudioLanguageBySegment}
            selectedSummaryLanguageCode={transcriptSummaryLanguageCode}
            selectedTargetLanguageCode={selectedLanguageCode}
            summaries={details.summaries}
            voiceId={selectedVoiceId}
          />
        )}
        voiceProfile={selectedVoiceProfile}
      />
    </View>
  );
}
