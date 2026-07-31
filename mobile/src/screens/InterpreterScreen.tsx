import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  setAudioModeAsync,
  type AudioMode,
  useAudioPlayer,
  useAudioPlayerStatus
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import {
  createInterpreterInterpretationAudio,
  createInterpreterMeeting,
  createInterpreterRealtimeClientSecret,
  createInterpreterSummary,
  createInterpreterSummaryAudio,
  createInterpreterTranslationReplayAudio,
  createInterpreterVoicePreviewAudio,
  deleteInterpreterMeeting,
  endInterpreterMeeting,
  exchangeInterpreterRealtimeSdpWithClientSecret,
  getInterpreterMeeting,
  InterpreterLanguage,
  InterpreterMeeting,
  InterpreterMeetingDetails,
  InterpreterParticipant,
  InterpreterSegmentAudio,
  InterpreterSummaryAudio,
  InterpreterMeetingType,
  InterpreterVoiceProfile,
  InterpreterVoicePreviewAudio,
  listInterpreterMeetings,
  listInterpreterParticipants,
  startInterpreterMeeting,
  updateInterpreterMeetingInvitations,
  updateInterpreterMeetingLanguages,
  updateInterpreterMeetingVoice
} from '../services/interpreterApi';
import {
  getInterpreterAudioReadiness,
  InterpreterAudioReadiness,
  InterpreterRealtimeSession,
  InterpreterRealtimeStatus,
  requestInterpreterAudioReadiness,
  startInterpreterRealtimeSession
} from '../services/interpreterRealtime';

interface InterpreterScreenProps {
  getIdToken: () => Promise<string>;
  onRoomActiveChange?: (isActive: boolean) => void;
}

const DEFAULT_LANGUAGE_CODES = ['en-US', 'es-MX'];
const DEFAULT_INTERPRETER_VOICE_ID = 'cedar';
const FALLBACK_INTERPRETER_VOICES: InterpreterVoiceProfile[] = [
  { id: 'cedar', label: 'Cedar', description: 'Calm executive interpreter for workplace conversations.' },
  { id: 'marin', label: 'Marin', description: 'Clear multilingual facilitator for mixed teams.' },
  { id: 'coral', label: 'Coral', description: 'Warm natural interpreter for coaching and 1-on-1s.' },
  { id: 'sage', label: 'Sage', description: 'Measured enterprise voice for sensitive meetings.' },
  { id: 'verse', label: 'Verse', description: 'Expressive interpreter for training and standups.' },
  { id: 'ash', label: 'Ash', description: 'Neutral operations voice for daily production meetings.' },
  { id: 'nova', label: 'Nova', description: 'Bright modern voice for concise workplace updates.' },
  { id: 'shimmer', label: 'Shimmer', description: 'Smooth voice for service and people-focused conversations.' }
];
const REMINDER_LEAD_MINUTES = [5, 10, 15, 30, 60, 120, 1440];
const REMINDER_FREQUENCIES: Array<InterpreterCreateDraft['reminderFrequency']> = ['once', 'daily', 'weekly'];
const INTERPRETER_SUMMARY_AUDIO_MODE: AudioMode = {
  allowsBackgroundRecording: false,
  allowsRecording: false,
  interruptionMode: 'duckOthers',
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false
};
const INTERPRETER_SUMMARY_AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory || ''}synzapp-interpreter-summaries/`;
const INTERPRETER_SEGMENT_AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory || ''}synzapp-interpreter-segments/`;
const INTERPRETER_VOICE_PREVIEW_AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory || ''}synzapp-interpreter-voices/`;
const INTERPRETER_WARM_AUDIO_DEBOUNCE_MS = 1800;
const INTERPRETER_WARM_AUDIO_MIN_TEXT_LENGTH = 12;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const ROOM_SETTINGS_ICON_NAME: IoniconName = Platform.OS === 'ios' ? 'options-outline' : 'settings-outline';

type InterpreterLanguageSessionState = {
  status: InterpreterRealtimeStatus;
  transcript: string;
  translation: string;
};

type InterpreterLiveMode = 'idle' | 'connecting' | 'listening' | 'choosing' | 'responding' | 'interrupted';

type InterpreterLiveHistoryItem = {
  createdAtIso: string;
  languageCode: string;
  sourceText: string;
  translatedText: string;
  translationId?: string;
};

type InterpreterWarmAudioStatus = 'idle' | 'preparing' | 'ready' | 'error';

type InterpreterWarmAudioEntry = {
  audio?: InterpreterSegmentAudio;
  error?: string;
  preparedAtIso?: string;
  requestId: number;
  sourceFingerprint: string;
  status: InterpreterWarmAudioStatus;
  translatedFingerprint: string;
  voiceId: string;
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
  const isRoomActive = Boolean(selectedMeetingDetails);

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

  async function handleCreateMeeting(input: InterpreterCreateDraft) {
    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await createInterpreterMeeting(idToken, {
        autoDetectSourceLanguage: input.autoDetectSourceLanguage,
        interpreterVoiceId: input.interpreterVoiceId,
        invitedUserIds: input.invitedUserIds,
        interpreterLanguageCodes: input.languageCodes,
        meetingName: input.meetingName,
        meetingType: input.meetingType,
        reminderFrequency: input.isScheduled && input.reminderEnabled ? input.reminderFrequency : 'none',
        reminderLeadMinutes: input.isScheduled && input.reminderEnabled ? input.reminderLeadMinutes : null,
        scheduledAtIso: input.isScheduled && input.scheduledAtIso ? input.scheduledAtIso : null,
        sourceLanguageCode: input.autoDetectSourceLanguage ? null : input.sourceLanguageCode
      });

      setMeetings((currentMeetings) => [result.meeting, ...currentMeetings]);
      setIsCreateOpen(false);
      await handleOpenMeeting(result.meeting.meetingId);
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      setIsBusy(false);
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

  async function handleCreateRealtimeSdpAnswer(targetLanguageCode: string, offerSdp: string) {
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
      const realtime = await createInterpreterRealtimeClientSecret(idToken, meeting.meetingId, targetLanguageCode);
      const answerSdp = await exchangeInterpreterRealtimeSdpWithClientSecret(realtime.clientSecret, offerSdp);

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? {
            ...currentDetails,
            meeting: started.meeting
          }
        : currentDetails);
      setMeetings((currentMeetings) => currentMeetings.map((currentMeeting) =>
        currentMeeting.meetingId === started.meeting.meetingId ? started.meeting : currentMeeting
      ));

      return answerSdp;
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
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateSummary(languageCodes: string[]) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return null;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await createInterpreterSummary(idToken, meeting.meetingId, languageCodes);

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
        <Text style={styles.workspaceTitle}>Interpreter</Text>
      </View>

      {meetings.length ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {meetings.map((meeting) => (
            <InterpreterMeetingSwipeRow
              key={meeting.meetingId}
              disabled={isBusy}
              meeting={meeting}
              onDelete={handleDeleteMeeting}
              onOpen={handleOpenMeeting}
            />
          ))}
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
        onPress={() => setIsCreateOpen(true)}
        style={({ pressed }) => [
          styles.floatingCreateButton,
          { bottom: 18 },
          pressed && styles.pressed
        ]}
      >
        <Ionicons color="#fff" name="add" size={26} />
      </Pressable>

      <InterpreterCreateModal
        getIdToken={getIdToken}
        isBusy={isBusy}
        isOpen={isCreateOpen}
        languages={languages}
        onClose={() => setIsCreateOpen(false)}
        onError={showInterpreterError}
        participants={participants}
        onSubmit={handleCreateMeeting}
        voiceProfiles={voiceProfiles}
      />
    </View>
  );
}

interface InterpreterRoomProps {
  details: InterpreterMeetingDetails;
  getIdToken: () => Promise<string>;
  isBusy: boolean;
  onBack: () => void;
  onCreateSummary: (languageCodes: string[]) => Promise<InterpreterSummaryCreateResult | null>;
  onEndMeeting: () => Promise<void>;
  onError: (message: string, title?: string) => void;
  onCreateRealtimeSdpAnswer: (targetLanguageCode: string, offerSdp: string) => Promise<string | null>;
  onUpdateLanguages: (interpreterLanguageCodes: string[]) => Promise<void>;
  onUpdateInvitations: (invitedUserIds: string[]) => Promise<void>;
  onUpdateVoice: (interpreterVoiceId: string) => Promise<void>;
  languages: InterpreterLanguage[];
  participants: InterpreterParticipant[];
  voiceProfiles: InterpreterVoiceProfile[];
}

interface InterpreterMeetingSwipeRowProps {
  disabled: boolean;
  meeting: InterpreterMeeting;
  onDelete: (meeting: InterpreterMeeting) => void;
  onOpen: (meetingId: string) => Promise<void>;
}

const INTERPRETER_SESSION_DELETE_WIDTH = 88;
const INTERPRETER_SESSION_DELETE_TRIGGER = 48;

function InterpreterMeetingSwipeRow({
  disabled,
  meeting,
  onDelete,
  onOpen
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
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
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
    onPanResponderTerminate: closeRow,
    onShouldBlockNativeResponder: () => false
  }), [closeRow, openRow, translateX]);

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
          onPress={() => void onOpen(meeting.meetingId)}
          style={({ pressed }) => [styles.meetingRow, pressed && styles.pressed]}
        >
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
              {formatMeetingType(meeting.meetingType)} · {meeting.interpreterLanguages.map((language) => language.label).join(', ')}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: getStatusSoftColor(meeting.status, appTheme.colors) }]}>
            <Ionicons
              color={getStatusColor(meeting.status)}
              name={meeting.status === 'ENDED' ? 'checkmark-circle-outline' : 'pulse-outline'}
              size={13}
            />
            <Text style={[styles.statusPillText, { color: getStatusColor(meeting.status) }]}>
              {formatStatus(meeting.status)}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

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
  const [liveStatus, setLiveStatus] = useState<InterpreterRealtimeStatus>('closed');
  const [audioReadiness, setAudioReadiness] = useState<InterpreterAudioReadiness | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isLiveLanguageModalOpen, setIsLiveLanguageModalOpen] = useState(false);
  const [isLiveTranscriptOpen, setIsLiveTranscriptOpen] = useState(false);
  const [isLiveHistoryOpen, setIsLiveHistoryOpen] = useState(false);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [isExitingRoom, setIsExitingRoom] = useState(false);
  const [liveMode, setLiveMode] = useState<InterpreterLiveMode>('idle');
  const [wasInterpretationInterrupted, setWasInterpretationInterrupted] = useState(false);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(details.meeting.interpreterLanguages[0]?.code || 'en-US');
  const [respondingLanguageCode, setRespondingLanguageCode] = useState<string | null>(null);
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
  const [isPreparingSegmentAudio, setIsPreparingSegmentAudio] = useState(false);
  const [preparingHistoryAudioKey, setPreparingHistoryAudioKey] = useState<string | null>(null);
  const [roomVoicePreviewSourceUri, setRoomVoicePreviewSourceUri] = useState<string | null>(null);
  const [roomVoicePreviewCache, setRoomVoicePreviewCache] = useState<Record<string, string>>({});
  const [activeRoomVoicePreviewKey, setActiveRoomVoicePreviewKey] = useState<string | null>(null);
  const [pendingRoomVoicePreviewKey, setPendingRoomVoicePreviewKey] = useState<string | null>(null);
  const [preparingRoomVoicePreviewKey, setPreparingRoomVoicePreviewKey] = useState<string | null>(null);
  const realtimeSessionPoolRef = useRef<Record<string, InterpreterRealtimeSession>>({});
  const [languageSessionState, setLanguageSessionState] = useState<Record<string, InterpreterLanguageSessionState>>({});
  const warmAudioRequestSeqRef = useRef(0);
  const warmAudioDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmAudioInFlightRef = useRef<Record<string, string>>({});
  const [warmAudioByLanguage, setWarmAudioByLanguage] = useState<Record<string, InterpreterWarmAudioEntry>>({});
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
  const latestTranslation = [...details.translations].reverse()
    .find((translation) => translation.targetLanguageCode === selectedLanguageCode);
  const selectedLanguageSession = languageSessionState[selectedLanguageCode];
  const selectedVoiceId = details.meeting.interpreterVoiceId || DEFAULT_INTERPRETER_VOICE_ID;
  const selectedVoiceProfile = getInterpreterVoiceProfile(voiceProfiles, selectedVoiceId);
  const latestReplayItem = groupInterpreterHistory(details, liveInterpretationHistory)[0]?.items[0] || null;
  const latestReplayAudioKey = latestReplayItem
    ? getHistoryAudioKey(details.meeting.meetingId, latestReplayItem)
    : null;
  const activeSessionStatuses = Object.values(languageSessionState).map((state) => state.status);
  const isRealtimeActive = activeSessionStatuses.some(isActiveRealtimeStatus);
  const warmAudioSignal = useMemo(() =>
    Object.entries(languageSessionState)
      .map(([languageCode, session]) =>
        `${languageCode}:${createInterpreterTextFingerprint(session.transcript)}:${createInterpreterTextFingerprint(session.translation)}`
      )
      .join('|'),
  [languageSessionState]);
  useEffect(() => () => {
    if (warmAudioDebounceRef.current) {
      clearTimeout(warmAudioDebounceRef.current);
    }

    closeRealtimeSessionPool(false);
  }, []);

  useEffect(() => () => {
    safePauseAudioPlayer(summaryAudioPlayer);
  }, [summaryAudioPlayer]);

  useEffect(() => () => {
    safePauseAudioPlayer(segmentAudioPlayer);
  }, [segmentAudioPlayer]);

  useEffect(() => () => {
    safePauseAudioPlayer(roomVoicePreviewPlayer);
  }, [roomVoicePreviewPlayer]);

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
        await setAudioModeAsync(INTERPRETER_SUMMARY_AUDIO_MODE).catch(() => undefined);
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
    summaryAudioPlayer,
    summaryAudioSourceUri,
    summaryAudioStatus.isLoaded
  ]);

  useEffect(() => {
    if (segmentAudioStatus.didJustFinish) {
      setActiveSegmentAudioKey(null);
      setLiveStatus('ready');
      if (respondingLanguageCode) {
        updateLanguageSession(respondingLanguageCode, { status: 'ready' });
      }
    }
  }, [respondingLanguageCode, segmentAudioStatus.didJustFinish]);

  useEffect(() => {
    if (!pendingSegmentAudioKey || !segmentAudioSourceUri || !segmentAudioStatus.isLoaded) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await setAudioModeAsync(INTERPRETER_SUMMARY_AUDIO_MODE).catch(() => undefined);
        await segmentAudioPlayer.seekTo(0).catch(() => undefined);

        if (isCancelled) {
          return;
        }

        setActiveSegmentAudioKey(pendingSegmentAudioKey);
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
    if (!pendingRoomVoicePreviewKey || !roomVoicePreviewSourceUri || !roomVoicePreviewStatus.isLoaded) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await setAudioModeAsync(INTERPRETER_SUMMARY_AUDIO_MODE).catch(() => undefined);
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
    roomVoicePreviewStatus.isLoaded
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
    if (!details.meeting.interpreterLanguages.some((language) => language.code === selectedLanguageCode)) {
      setSelectedLanguageCode(details.meeting.interpreterLanguages[0]?.code || 'en-US');
    }
  }, [details.meeting.interpreterLanguages, selectedLanguageCode]);

  useEffect(() => {
    setLiveInterpretationHistory([]);
    setWarmAudioByLanguage({});
    warmAudioInFlightRef.current = {};
  }, [details.meeting.meetingId]);

  useEffect(() => {
    setLiveTranscript(selectedLanguageSession?.transcript || '');
    setLiveTranslation(selectedLanguageSession?.translation || '');
  }, [selectedLanguageSession?.transcript, selectedLanguageSession?.translation]);

  useEffect(() => {
    const statuses = Object.values(languageSessionState).map((state) => state.status);

    if (!statuses.length) {
      return;
    }

    if (statuses.some((status) => status === 'speaking')) {
      setLiveStatus('speaking');
      setLiveMode((currentMode) => currentMode === 'interrupted' ? currentMode : 'responding');
      return;
    }

    if (statuses.some((status) => status === 'listening' || status === 'ready')) {
      const isChoosingLanguage = statuses.every((status) => status === 'ready');

      setLiveStatus(isChoosingLanguage ? 'ready' : 'listening');
      setLiveMode((currentMode) => {
        if (currentMode === 'interrupted' || currentMode === 'choosing' || currentMode === 'responding') {
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

  useEffect(() => {
    if (warmAudioDebounceRef.current) {
      clearTimeout(warmAudioDebounceRef.current);
      warmAudioDebounceRef.current = null;
    }

    if (!isRealtimeActive || liveMode !== 'listening') {
      return;
    }

    warmAudioDebounceRef.current = setTimeout(() => {
      const targetLanguages = getSessionPoolLanguages(details.meeting, selectedLanguageCode);

      targetLanguages.forEach((language) => {
        void prepareWarmInterpretationAudio(language.code);
      });
      warmAudioDebounceRef.current = null;
    }, INTERPRETER_WARM_AUDIO_DEBOUNCE_MS);

    return () => {
      if (warmAudioDebounceRef.current) {
        clearTimeout(warmAudioDebounceRef.current);
        warmAudioDebounceRef.current = null;
      }
    };
  }, [
    details.meeting,
    isRealtimeActive,
    liveMode,
    selectedLanguageCode,
    selectedVoiceId,
    warmAudioSignal
  ]);

  async function startLiveInterpreter(languageCode = selectedLanguageCode) {
    closeRealtimeSessionPool();
    setLiveTranscript('');
    setLiveTranslation('');
    setAudioLevel(0);
    setSelectedLanguageCode(languageCode);
    setLiveStatus('connecting');
    setLiveMode('connecting');
    setWasInterpretationInterrupted(false);
    setRespondingLanguageCode(null);
    setIsLiveLanguageModalOpen(false);

    try {
      const targetLanguages = getSessionPoolLanguages(details.meeting, languageCode);

      if (!targetLanguages.length) {
        setLiveStatus('closed');
        onError('Choose at least one interpreter language before starting.');
        return;
      }

      setLanguageSessionState(Object.fromEntries(targetLanguages.map((language) => [
        language.code,
        { status: 'connecting' as InterpreterRealtimeStatus, transcript: '', translation: '' }
      ])));

      const sessionResults = await Promise.allSettled(targetLanguages.map(async (language) => {
        const session = await startInterpreterRealtimeSession({
          createAnswerSdp: async (offerSdp) => {
            const answerSdp = await onCreateRealtimeSdpAnswer(language.code, offerSdp);

            if (!answerSdp) {
              throw new Error(`${language.label} session could not be prepared.`);
            }

            return answerSdp;
          }
        }, {
          onError: (message) => onError(message),
          onAudioLevel: (level) => {
            if (language.code === languageCode) {
              setAudioLevel(level);
            }
          },
          onStatus: (status) => updateLanguageSession(language.code, { status }),
          onTranscript: (transcript) => {
            updateLanguageSession(language.code, { transcript });
            setLiveTranscript((currentTranscript) =>
              language.code === selectedLanguageCode || !realtimeSessionPoolRef.current[selectedLanguageCode]
                ? transcript
                : currentTranscript
            );
          },
          onTranslation: (translation) => {
            updateLanguageSession(language.code, { translation });
            setLiveTranslation((currentTranslation) =>
              language.code === selectedLanguageCode ? translation : currentTranslation
            );
          }
        });

        realtimeSessionPoolRef.current[language.code] = session;
      }));
      const failedCount = sessionResults.filter((result) => result.status === 'rejected').length;
      const startedCount = targetLanguages.length - failedCount;

      sessionResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          updateLanguageSession(targetLanguages[index].code, { status: 'error' });
        }
      });

      if (!startedCount) {
        const failureReason = sessionResults
          .find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason;
        closeRealtimeSessionPool();
        setLiveStatus('error');
        setLiveMode('idle');
        onError(getErrorMessage(failureReason) || 'The selected interpreter language session could not be started.');
        return;
      }

      setLiveStatus('listening');
      setLiveMode('listening');
    } catch (error) {
      setLiveStatus('error');
      setLiveMode('idle');
      onError(getErrorMessage(error));
    }
  }

  function stopLiveInterpreter() {
    closeRealtimeSessionPool();
    setLiveStatus('closed');
    setLiveMode('idle');
    setWasInterpretationInterrupted(false);
    setRespondingLanguageCode(null);
    setIsLiveLanguageModalOpen(false);
    setAudioLevel(0);
  }

  async function prepareWarmInterpretationAudio(languageCode: string) {
    const candidate = getWarmInterpretationInput(languageCode);

    if (!candidate) {
      return;
    }

    const requestKey = [
      languageCode,
      selectedVoiceId,
      candidate.sourceFingerprint,
      candidate.translatedFingerprint
    ].join(':');
    const currentWarmEntry = warmAudioByLanguage[languageCode];

    if (
      currentWarmEntry?.status === 'ready' &&
      currentWarmEntry.voiceId === selectedVoiceId &&
      currentWarmEntry.sourceFingerprint === candidate.sourceFingerprint &&
      currentWarmEntry.translatedFingerprint === candidate.translatedFingerprint
    ) {
      return;
    }

    if (warmAudioInFlightRef.current[languageCode] === requestKey) {
      return;
    }

    const requestId = warmAudioRequestSeqRef.current + 1;

    warmAudioRequestSeqRef.current = requestId;
    warmAudioInFlightRef.current[languageCode] = requestKey;
    setWarmAudioByLanguage((currentWarmAudio) => ({
      ...currentWarmAudio,
      [languageCode]: {
        requestId,
        sourceFingerprint: candidate.sourceFingerprint,
        status: 'preparing',
        translatedFingerprint: candidate.translatedFingerprint,
        voiceId: selectedVoiceId
      }
    }));

    try {
      const idToken = await getIdToken();
      const result = await createInterpreterInterpretationAudio(idToken, details.meeting.meetingId, {
        sourceText: candidate.sourceText,
        targetLanguageCode: languageCode,
        translatedText: candidate.translatedText || null,
        voiceId: selectedVoiceId
      });

      await cacheInterpreterSegmentAudioPayload(result.audio);
      setWarmAudioByLanguage((currentWarmAudio) => {
        const latestWarmEntry = currentWarmAudio[languageCode];

        if (latestWarmEntry?.requestId !== requestId) {
          return currentWarmAudio;
        }

        return {
          ...currentWarmAudio,
          [languageCode]: {
            audio: result.audio,
            preparedAtIso: new Date().toISOString(),
            requestId,
            sourceFingerprint: candidate.sourceFingerprint,
            status: 'ready',
            translatedFingerprint: candidate.translatedFingerprint,
            voiceId: selectedVoiceId
          }
        };
      });
    } catch (error) {
      setWarmAudioByLanguage((currentWarmAudio) => {
        const latestWarmEntry = currentWarmAudio[languageCode];

        if (latestWarmEntry?.requestId !== requestId) {
          return currentWarmAudio;
        }

        return {
          ...currentWarmAudio,
          [languageCode]: {
            error: getErrorMessage(error),
            requestId,
            sourceFingerprint: candidate.sourceFingerprint,
            status: 'error',
            translatedFingerprint: candidate.translatedFingerprint,
            voiceId: selectedVoiceId
          }
        };
      });
    } finally {
      if (warmAudioInFlightRef.current[languageCode] === requestKey) {
        delete warmAudioInFlightRef.current[languageCode];
      }
    }
  }

  async function respondInSelectedLanguage(languageCode = selectedLanguageCode) {
    const sourceText = getCapturedSourceText();
    const realtimeTranslation = getCapturedTranslationText(languageCode);

    if (!sourceText && !realtimeTranslation) {
      setLiveStatus('ready');
      setLiveMode('choosing');
      onError(
        'The interpreter received microphone signal, but no transcript was returned yet. Speak a little longer, then tap a response language again.',
        'Interpreter needs attention'
      );
      return;
    }

    const capturedSourceText = sourceText || realtimeTranslation;
    const capturedTranslatedText = realtimeTranslation;
    const warmAudio = getReadyWarmInterpretationAudio(languageCode, capturedSourceText, capturedTranslatedText);

    Object.values(realtimeSessionPoolRef.current).forEach((session) => session.pauseListening());
    safePauseAudioPlayer(summaryAudioPlayer);
    safePauseAudioPlayer(segmentAudioPlayer);
    setSelectedLanguageCode(languageCode);
    setRespondingLanguageCode(languageCode);
    setIsLiveLanguageModalOpen(false);
    setIsPreparingSegmentAudio(!warmAudio);
    setLiveStatus('speaking');
    setLiveMode('responding');
    updateLanguageSession(languageCode, {
      status: 'speaking',
      transcript: capturedSourceText,
      translation: capturedTranslatedText
    });

    try {
      const audio = warmAudio || await createFreshInterpreterSegmentAudio(
        languageCode,
        capturedSourceText,
        capturedTranslatedText
      );

      updateLanguageSession(languageCode, {
        status: 'speaking',
        transcript: audio.sourceText,
        translation: audio.translatedText
      });
      setLiveTranscript(audio.sourceText);
      setLiveTranslation(audio.translatedText);
      recordLiveInterpretation(
        languageCode,
        audio.sourceText,
        audio.translatedText,
        audio.translationId
      );

      await playInterpreterSegmentAudioPayload(audio);
    } catch (error) {
      setLiveStatus('ready');
      setLiveMode('choosing');
      updateLanguageSession(languageCode, { status: 'ready' });
      onError(getErrorMessage(error), 'Interpreter needs attention');
    } finally {
      setIsPreparingSegmentAudio(false);
    }
  }

  async function createFreshInterpreterSegmentAudio(
    languageCode: string,
    sourceText: string,
    translatedText: string
  ): Promise<InterpreterSegmentAudio> {
    const idToken = await getIdToken();
    const result = await createInterpreterInterpretationAudio(idToken, details.meeting.meetingId, {
      sourceText,
      targetLanguageCode: languageCode,
      translatedText: translatedText || null,
      voiceId: selectedVoiceId
    });

    await cacheInterpreterSegmentAudioPayload(result.audio);

    return result.audio;
  }

  function getReadyWarmInterpretationAudio(
    languageCode: string,
    sourceText: string,
    translatedText: string
  ): InterpreterSegmentAudio | null {
    const warmEntry = warmAudioByLanguage[languageCode];

    if (
      !warmEntry?.audio ||
      warmEntry.status !== 'ready' ||
      warmEntry.voiceId !== selectedVoiceId
    ) {
      return null;
    }

    const sourceFingerprint = createInterpreterTextFingerprint(sourceText);
    const translatedFingerprint = createInterpreterTextFingerprint(translatedText);

    if (
      warmEntry.sourceFingerprint !== sourceFingerprint ||
      warmEntry.translatedFingerprint !== translatedFingerprint
    ) {
      return null;
    }

    return warmEntry.audio;
  }

  function getWarmInterpretationInput(languageCode: string): {
    sourceFingerprint: string;
    sourceText: string;
    translatedFingerprint: string;
    translatedText: string;
  } | null {
    const sourceText = getCapturedSourceTranscriptText();
    const translatedText = getCapturedTranslationText(languageCode);
    const sourceOrFallbackText = sourceText || translatedText;

    if (sourceOrFallbackText.trim().length < INTERPRETER_WARM_AUDIO_MIN_TEXT_LENGTH) {
      return null;
    }

    return {
      sourceFingerprint: createInterpreterTextFingerprint(sourceOrFallbackText),
      sourceText: sourceOrFallbackText,
      translatedFingerprint: createInterpreterTextFingerprint(translatedText),
      translatedText
    };
  }

  function listenAgain() {
    safePauseAudioPlayer(segmentAudioPlayer);
    setActiveSegmentAudioKey(null);
    setIsPreparingSegmentAudio(false);
    setWasInterpretationInterrupted(liveMode === 'responding' && Boolean(liveTranslation.trim()));
    setIsLiveLanguageModalOpen(false);
    setAudioLevel(0);

    if (!Object.keys(realtimeSessionPoolRef.current).length) {
      void startLiveInterpreter(selectedLanguageCode);
      return;
    }

    Object.values(realtimeSessionPoolRef.current).forEach((session) => session.cancelResponse());
    setLiveMode('listening');
    setLiveStatus('listening');
  }

  function continueInterruptedInterpretation() {
    void respondInSelectedLanguage(selectedLanguageCode);
    setWasInterpretationInterrupted(false);
  }

  function useCurrentInterpretation(languageCode = selectedLanguageCode) {
    Object.values(realtimeSessionPoolRef.current).forEach((session) => session.cancelResponse());
    void respondInSelectedLanguage(languageCode);
    setWasInterpretationInterrupted(false);
  }

  function getCapturedSourceText(): string {
    const sourceTranscript = getCapturedSourceTranscriptText();

    if (sourceTranscript) {
      return sourceTranscript;
    }

    return [
      liveTranslation,
      ...Object.values(languageSessionState).map((session) => session.translation)
    ].find((text) => text?.trim())?.trim() || '';
  }

  function getCapturedSourceTranscriptText(): string {
    return [
      liveTranscript,
      languageSessionState[selectedLanguageCode]?.transcript,
      ...Object.values(languageSessionState).map((session) => session.transcript)
    ].find((text) => text?.trim())?.trim() || '';
  }

  function getCapturedTranslationText(languageCode: string): string {
    return [
      languageSessionState[languageCode]?.translation,
      languageCode === selectedLanguageCode ? liveTranslation : '',
      ...Object.entries(languageSessionState)
        .filter(([currentLanguageCode]) => currentLanguageCode === selectedLanguageCode)
        .map(([, session]) => session.translation)
    ].find((text) => text?.trim())?.trim() || '';
  }

  function recordLiveInterpretation(
    languageCode: string,
    sourceTextOverride?: string,
    translatedTextOverride?: string,
    translationId?: string
  ) {
    const session = languageSessionState[languageCode];
    const translatedText = translatedTextOverride || session?.translation || liveTranslation;
    const sourceText = sourceTextOverride || session?.transcript || liveTranscript;

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
        translationId
      }, ...currentHistory].slice(0, 80);
    });
  }

  function closeRealtimeSessionPool(resetState = true) {
    Object.values(realtimeSessionPoolRef.current).forEach((session) => session.close());
    realtimeSessionPoolRef.current = {};

    if (resetState) {
      setLanguageSessionState({});
    }
  }

  function updateLanguageSession(languageCode: string, patch: Partial<InterpreterLanguageSessionState>) {
    setLanguageSessionState((currentState) => ({
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
    if (!segmentAudioSourceUri || isPreparingSegmentAudio) {
      return;
    }

    try {
      if (segmentAudioStatus.playing) {
        safePauseAudioPlayer(segmentAudioPlayer);
        setActiveSegmentAudioKey(null);
        setLiveStatus('ready');
        return;
      }

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

  async function handlePlayInterpreterHistoryItem(item: InterpreterLiveHistoryItem) {
    if (!item.translationId) {
      onError('This interpretation does not have replay audio available yet.', 'Interpretation history needs attention');
      return;
    }

    const audioKey = getInterpreterSegmentAudioKey(details.meeting.meetingId, item.translationId, item.languageCode);

    if (activeSegmentAudioKey === audioKey && segmentAudioStatus.playing) {
      safePauseAudioPlayer(segmentAudioPlayer);
      setActiveSegmentAudioKey(null);
      setLiveStatus('ready');
      return;
    }

    try {
      setPreparingHistoryAudioKey(audioKey);
      setSelectedLanguageCode(item.languageCode);
      setRespondingLanguageCode(item.languageCode);

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

  async function handleSelectRoomVoice(interpreterVoiceId: string) {
    if (interpreterVoiceId === selectedVoiceId) {
      return;
    }

    await onUpdateVoice(interpreterVoiceId);
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

  async function leaveRoomAndEndSession() {
    if (isExitingRoom) {
      return;
    }

    setIsExitingRoom(true);
    stopLiveInterpreter();

    try {
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

  return (
    <View style={styles.roomHost}>
      <InterpreterLiveRoomModal
        audioLevel={audioLevel}
        activeHistoryAudioKey={activeSegmentAudioKey}
        details={details}
        hasReplayableInterpretationAudio={Boolean(segmentAudioSourceUri)}
        historyItems={liveInterpretationHistory}
        isHistoryAudioPlaying={segmentAudioStatus.playing}
        isInterpretationAudioPlaying={segmentAudioStatus.playing}
        isPreparingInterpretationAudio={isPreparingSegmentAudio || Boolean(pendingSegmentAudioKey)}
        isHistoryOpen={isLiveHistoryOpen}
        isLanguageModalOpen={isLiveLanguageModalOpen}
        isOpen
        isTranscriptOpen={isLiveTranscriptOpen}
        languageSessionState={languageSessionState}
        liveMode={liveMode}
        liveStatus={liveStatus}
        liveTranscript={liveTranscript}
        liveTranslation={liveTranslation}
        onClose={confirmLeaveRoom}
        onContinue={continueInterruptedInterpretation}
        onCurrent={() => useCurrentInterpretation(selectedLanguageCode)}
        onEnd={() => {
          stopLiveInterpreter();
          void onEndMeeting();
        }}
        onOpenHistory={() => setIsLiveHistoryOpen(true)}
        onOpenLanguageModal={() => setIsLiveLanguageModalOpen(true)}
        onOpenSettings={() => setIsRoomSettingsOpen(true)}
        onOpenSummary={() => setIsSummaryModalOpen(true)}
        onOpenTranscript={() => setIsLiveTranscriptOpen(true)}
        onReplayInterpretationAudio={() => void handleReplayInterpreterSegmentAudio()}
        onListen={listenAgain}
        onLanguageModalClose={() => setIsLiveLanguageModalOpen(false)}
        onRespond={respondInSelectedLanguage}
        onStart={() => void startLiveInterpreter()}
        onTranscriptClose={() => setIsLiveTranscriptOpen(false)}
        onHistoryClose={() => setIsLiveHistoryOpen(false)}
        onPlayHistoryItem={(item) => void handlePlayInterpreterHistoryItem(item)}
        preparingHistoryAudioKey={preparingHistoryAudioKey}
        respondingLanguageCode={respondingLanguageCode}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        settingsPanel={(
          <InterpreterRoomSettingsPanel
            activePreviewKey={activeRoomVoicePreviewKey}
            availableLanguages={languages}
            details={details}
            invitedUserIds={invitedUserIds}
            isBusy={isBusy}
            isOpen={isRoomSettingsOpen}
            onClose={() => setIsRoomSettingsOpen(false)}
            onError={onError}
            onPreviewVoice={(voice) => void handlePreviewRoomVoice(voice)}
            onSelectVoice={(voiceId) => void handleSelectRoomVoice(voiceId)}
            onUpdateInvitations={async (nextInvitedUserIds) => {
              await onUpdateInvitations(nextInvitedUserIds);
              setInvitedUserIds(nextInvitedUserIds);
            }}
            onUpdateLanguages={onUpdateLanguages}
            participants={participants}
            preparingPreviewKey={preparingRoomVoicePreviewKey}
            previewLanguageCode={details.meeting.interpreterLanguages[0]?.code || selectedLanguageCode || 'en-US'}
            selectedVoiceId={selectedVoiceId}
            voiceProfile={selectedVoiceProfile}
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
              const result = await onCreateSummary(languageCodes);

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
            presentation="overlay"
            summaries={details.summaries}
          />
        )}
        summaryCount={details.summaries.length}
        voiceProfile={selectedVoiceProfile}
        wasInterrupted={wasInterpretationInterrupted}
      />
    </View>
  );
}

interface InterpreterLiveRoomModalProps {
  activeHistoryAudioKey: string | null;
  audioLevel: number;
  details: InterpreterMeetingDetails;
  hasReplayableInterpretationAudio: boolean;
  historyItems: InterpreterLiveHistoryItem[];
  isHistoryAudioPlaying: boolean;
  isInterpretationAudioPlaying: boolean;
  isPreparingInterpretationAudio: boolean;
  isHistoryOpen: boolean;
  isLanguageModalOpen: boolean;
  isOpen: boolean;
  isTranscriptOpen: boolean;
  languageSessionState: Record<string, InterpreterLanguageSessionState>;
  liveMode: InterpreterLiveMode;
  liveStatus: InterpreterRealtimeStatus;
  liveTranscript: string;
  liveTranslation: string;
  onClose: () => void;
  onContinue: () => void;
  onCurrent: () => void;
  onEnd: () => void;
  onHistoryClose: () => void;
  onLanguageModalClose: () => void;
  onListen: () => void;
  onOpenHistory: () => void;
  onOpenLanguageModal: () => void;
  onOpenSettings: () => void;
  onOpenSummary: () => void;
  onOpenTranscript: () => void;
  onPlayHistoryItem: (item: InterpreterLiveHistoryItem) => void;
  onReplayInterpretationAudio: () => void;
  onRespond: (languageCode: string) => void | Promise<void>;
  onStart: () => void;
  onTranscriptClose: () => void;
  preparingHistoryAudioKey: string | null;
  respondingLanguageCode: string | null;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  settingsPanel: React.ReactNode;
  summaryPanel: React.ReactNode;
  summaryCount: number;
  voiceProfile: InterpreterVoiceProfile;
  wasInterrupted: boolean;
}

function InterpreterLiveRoomModal({
  activeHistoryAudioKey,
  audioLevel,
  details,
  hasReplayableInterpretationAudio,
  historyItems,
  isHistoryAudioPlaying,
  isInterpretationAudioPlaying,
  isPreparingInterpretationAudio,
  isHistoryOpen,
  isLanguageModalOpen,
  isOpen,
  isTranscriptOpen,
  languageSessionState,
  liveMode,
  liveStatus,
  liveTranscript,
  liveTranslation,
  onClose,
  onContinue,
  onCurrent,
  onEnd,
  onHistoryClose,
  onLanguageModalClose,
  onListen,
  onOpenHistory,
  onOpenLanguageModal,
  onOpenSettings,
  onOpenSummary,
  onOpenTranscript,
  onPlayHistoryItem,
  onReplayInterpretationAudio,
  onRespond,
  onStart,
  onTranscriptClose,
  preparingHistoryAudioKey,
  respondingLanguageCode,
  selectedLanguageCode,
  setSelectedLanguageCode,
  settingsPanel,
  summaryPanel,
  summaryCount,
  voiceProfile,
  wasInterrupted
}: InterpreterLiveRoomModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const selectedLanguage = details.meeting.interpreterLanguages.find((language) => language.code === selectedLanguageCode)
    || details.meeting.interpreterLanguages[0];
  const transcriptScrollRef = useRef<ScrollView | null>(null);
  const isActive = isActiveRealtimeStatus(liveStatus);
  const canChooseLanguage = isActive && (liveMode === 'listening' || liveMode === 'choosing' || liveMode === 'responding');
  const primaryActionLabel = getLivePrimaryActionLabel(liveMode, liveStatus);
  const primaryActionIcon: IoniconName = 'mic-outline';
  const isRealtimeResponseActive = liveMode === 'responding' &&
    !isPreparingInterpretationAudio &&
    !isInterpretationAudioPlaying;
  const canReplayInterpretationAudio = hasReplayableInterpretationAudio && Boolean(liveTranslation.trim());
  const handlePrimaryAction = () => {
    if (liveMode === 'listening') {
      return;
    }

    if (liveMode === 'responding') {
      onListen();
      return;
    }

    if (liveMode === 'choosing') {
      onOpenLanguageModal();
      return;
    }

    onStart();
  };

  useEffect(() => {
    if (!liveTranscript.trim() && !liveTranslation.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      transcriptScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [liveTranscript, liveTranslation]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={isOpen}>
      <View style={[styles.liveRoomScreen, { paddingBottom: Math.max(insets.bottom + 16, 28), paddingTop: Math.max(insets.top + 12, 26) }]}>
        <View style={styles.liveRoomHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
            <Ionicons color={appTheme.colors.ink} name="chevron-down" size={24} />
          </Pressable>
          <View style={styles.liveRoomTitleWrap}>
            <Text style={styles.liveRoomTitle}>{details.meeting.meetingName}</Text>
            <Text style={styles.liveRoomMeta}>
              {formatMeetingType(details.meeting.meetingType)} · {formatRealtimeStatus(liveStatus)}
            </Text>
          </View>
          <Pressable
            onPress={onOpenTranscript}
            style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.ink} name="document-text-outline" size={21} />
          </Pressable>
          <Pressable
            onPress={onOpenHistory}
            style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.ink} name="albums-outline" size={21} />
          </Pressable>
          <Pressable
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.ink} name={ROOM_SETTINGS_ICON_NAME} size={21} />
          </Pressable>
          <Pressable onPress={onEnd} style={({ pressed }) => [styles.liveEndButton, pressed && styles.pressed]}>
            <Text style={styles.liveEndButtonText}>End</Text>
          </Pressable>
        </View>

        <View style={styles.liveRoomStage}>
          <InterpreterAudioSpectrum
            audioLevel={audioLevel}
            isListening={liveMode === 'listening'}
          />
          <Pressable
            disabled={liveStatus === 'connecting' || liveMode === 'listening'}
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
          <Text style={styles.liveRoomStateText}>{getLiveModeDescription(liveMode, selectedLanguage?.label || 'selected language')}</Text>
        </View>

        <View style={styles.liveRoomLanguageArea}>
          <View style={styles.liveLanguageSummaryRow}>
            <View style={styles.liveLanguageSummaryCopy}>
              <Text style={styles.liveRoomSectionLabel}>Interpreter languages</Text>
              <Text style={styles.liveRoomLanguageSummaryText} numberOfLines={2}>
                {details.meeting.interpreterLanguages.map((language) => language.label).join(', ')}
              </Text>
              <Text style={styles.liveRoomVoiceText} numberOfLines={1}>
                Interpreter speaker: {voiceProfile.label}
              </Text>
            </View>
            <Pressable
              disabled={!canChooseLanguage}
              onPress={onOpenLanguageModal}
              style={({ pressed }) => [
                styles.liveLanguageChooseButton,
                !canChooseLanguage && styles.disabledButton,
                pressed && styles.pressed
              ]}
            >
              <Ionicons color={appTheme.colors.primary} name="language-outline" size={17} />
              <Text style={styles.liveLanguageChooseText}>Choose</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.liveLanguagePillScroll}
          >
            {details.meeting.interpreterLanguages.map((language) => {
              const isSelected = language.code === selectedLanguageCode;
              const isResponding = language.code === respondingLanguageCode && liveMode === 'responding';
              const sessionStatus = languageSessionState[language.code]?.status || 'closed';

              return (
                <Pressable
                  disabled={!canChooseLanguage || isPreparingInterpretationAudio}
                  key={language.code}
                  onPress={() => {
                    setSelectedLanguageCode(language.code);
                    void onRespond(language.code);
                  }}
                  style={({ pressed }) => [
                    styles.liveLanguageButton,
                    isSelected && styles.liveLanguageButtonActive,
                    isResponding && styles.liveLanguageButtonResponding,
                    (!canChooseLanguage || isPreparingInterpretationAudio) && styles.disabledButton,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={[
                    styles.liveLanguageStatus,
                    { backgroundColor: getRealtimeStatusColor(sessionStatus) }
                  ]} />
                  <Text style={[
                    styles.liveLanguageButtonText,
                    isSelected && styles.liveLanguageButtonTextActive,
                    isResponding && styles.liveLanguageButtonTextResponding
                  ]}>
                    {language.label}
                  </Text>
                  {isResponding ? (
                    <Text style={styles.liveLanguageRespondingText}>Speaking</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.liveRoomTranscriptArea}>
          <ScrollView
            contentContainerStyle={styles.liveRoomTranscriptContent}
            ref={transcriptScrollRef}
            showsVerticalScrollIndicator={false}
            style={styles.liveRoomTranscriptScroll}
          >
            <Text style={styles.liveRoomSectionLabel}>Detected speech</Text>
            <Text style={styles.liveRoomTranscriptText}>
              {liveTranscript || 'The transcript preview appears here while the interpreter listens.'}
            </Text>
            <View style={styles.liveRoomDivider} />
            <Text style={styles.liveRoomSectionLabel}>Current interpretation</Text>
            <Text style={styles.liveRoomTranslationText}>
              {liveTranslation || `Ready to interpret in ${selectedLanguage?.label || 'the selected language'}.`}
            </Text>
            {isPreparingInterpretationAudio || liveMode === 'responding' ? (
              <View style={styles.interpretationPlayerRow}>
                <Pressable
                  disabled={isPreparingInterpretationAudio || isRealtimeResponseActive || !canReplayInterpretationAudio}
                  onPress={onReplayInterpretationAudio}
                  style={({ pressed }) => [
                    styles.interpretationPlayerButton,
                    (isInterpretationAudioPlaying || isRealtimeResponseActive) && styles.interpretationPlayerButtonActive,
                    (isPreparingInterpretationAudio || (!isRealtimeResponseActive && !canReplayInterpretationAudio)) && styles.disabledButton,
                    pressed && styles.pressed
                  ]}
                >
                  {isPreparingInterpretationAudio ? (
                    <ActivityIndicator color={appTheme.colors.primary} size="small" />
                  ) : (
                    <Ionicons
                      color={isInterpretationAudioPlaying || isRealtimeResponseActive ? '#fff' : appTheme.colors.primary}
                      name={isRealtimeResponseActive ? 'volume-high-outline' : isInterpretationAudioPlaying ? 'pause' : 'play'}
                      size={16}
                    />
                  )}
                </Pressable>
                <View style={styles.interpretationPlayerCopy}>
                  <Text style={styles.interpretationPlayerTitle}>Spoken interpretation</Text>
                  <Text style={styles.interpretationPlayerMeta}>
                    {isPreparingInterpretationAudio
                      ? `Preparing ${selectedLanguage?.label || 'language'} audio`
                      : isRealtimeResponseActive
                        ? `Speaking live in ${selectedLanguage?.label || 'selected language'}`
                        : isInterpretationAudioPlaying
                          ? `Playing saved replay in ${selectedLanguage?.label || 'selected language'}`
                          : canReplayInterpretationAudio
                            ? `Replay ready in ${selectedLanguage?.label || 'selected language'}`
                            : 'Replay will appear when the archive is saved'}
                  </Text>
                </View>
                <Pressable
                  onPress={onOpenLanguageModal}
                  style={({ pressed }) => [styles.interpretationLanguageButton, pressed && styles.pressed]}
                >
                  <Ionicons color={appTheme.colors.primary} name="language-outline" size={17} />
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>

        {wasInterrupted ? (
          <View style={styles.liveRoomRecoveryRow}>
            <Pressable onPress={onContinue} style={({ pressed }) => [styles.liveSecondaryAction, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="play-forward-outline" size={18} />
              <Text style={styles.liveSecondaryActionText}>Continue</Text>
            </Pressable>
            <Pressable onPress={onCurrent} style={({ pressed }) => [styles.livePrimaryAction, pressed && styles.pressed]}>
              <Ionicons color="#fff" name="flash-outline" size={18} />
              <Text style={styles.livePrimaryActionText}>Current</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.liveRoomFooter}>
          <Text style={styles.liveFooterHint}>
            {getLiveFooterHint(liveMode)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Open meeting summaries"
          onPress={onOpenSummary}
          style={({ pressed }) => [
            styles.liveSummaryFab,
            { bottom: Math.max(insets.bottom + 64, 78) },
            pressed && styles.pressed
          ]}
        >
          <Ionicons color="#fff" name="reader-outline" size={21} />
          <View style={[
            styles.liveSummaryFabBadge,
            !summaryCount && styles.liveSummaryFabBadgeEmpty
          ]}>
            <Text style={styles.liveSummaryFabBadgeText}>{summaryCount > 9 ? '9+' : summaryCount}</Text>
          </View>
        </Pressable>
        <InterpreterResponseLanguageModal
          isOpen={isLanguageModalOpen}
          languages={details.meeting.interpreterLanguages}
          onClose={onLanguageModalClose}
          onSelect={(languageCode) => {
            setSelectedLanguageCode(languageCode);
            void onRespond(languageCode);
          }}
          respondingLanguageCode={respondingLanguageCode}
          selectedLanguageCode={selectedLanguageCode}
        />
        <InterpreterLiveTranscriptModal
          details={details}
          isOpen={isTranscriptOpen}
          liveTranscript={liveTranscript}
          onClose={onTranscriptClose}
        />
        <InterpreterInterpretationHistoryModal
          activeHistoryAudioKey={activeHistoryAudioKey}
          details={details}
          historyItems={historyItems}
          isHistoryAudioPlaying={isHistoryAudioPlaying}
          isOpen={isHistoryOpen}
          onClose={onHistoryClose}
          onPlayItem={onPlayHistoryItem}
          preparingHistoryAudioKey={preparingHistoryAudioKey}
        />
        {settingsPanel}
        {summaryPanel}
      </View>
    </Modal>
  );
}

interface InterpreterRoomSettingsPanelProps {
  activePreviewKey: string | null;
  availableLanguages: InterpreterLanguage[];
  details: InterpreterMeetingDetails;
  invitedUserIds: string[];
  isBusy: boolean;
  isOpen: boolean;
  onClose: () => void;
  onError: (message: string, title?: string) => void;
  onPreviewVoice: (voice: InterpreterVoiceProfile) => void;
  onSelectVoice: (voiceId: string) => void;
  onUpdateInvitations: (invitedUserIds: string[]) => Promise<void>;
  onUpdateLanguages: (interpreterLanguageCodes: string[]) => Promise<void>;
  participants: InterpreterParticipant[];
  preparingPreviewKey: string | null;
  previewLanguageCode: string;
  selectedVoiceId: string;
  voiceProfile: InterpreterVoiceProfile;
  voices: InterpreterVoiceProfile[];
}

function InterpreterRoomSettingsPanel({
  activePreviewKey,
  availableLanguages,
  details,
  invitedUserIds,
  isBusy,
  isOpen,
  onClose,
  onError,
  onPreviewVoice,
  onSelectVoice,
  onUpdateInvitations,
  onUpdateLanguages,
  participants,
  preparingPreviewKey,
  previewLanguageCode,
  selectedVoiceId,
  voiceProfile,
  voices
}: InterpreterRoomSettingsPanelProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const languages = availableLanguages.length ? availableLanguages : details.meeting.interpreterLanguages;
  const [draftLanguageCodes, setDraftLanguageCodes] = useState<string[]>(
    details.meeting.interpreterLanguages.map((language) => language.code)
  );
  const [draftInvitedUserIds, setDraftInvitedUserIds] = useState<string[]>(invitedUserIds);
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false);
  const [isParticipantPickerOpen, setIsParticipantPickerOpen] = useState(false);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const savedLanguageCodes = details.meeting.interpreterLanguages.map((language) => language.code);
  const hasLanguageChanges = !areStringSetsEqual(savedLanguageCodes, draftLanguageCodes);
  const hasAccessChanges = !areStringSetsEqual(invitedUserIds, draftInvitedUserIds);
  const canSave = (hasLanguageChanges || hasAccessChanges) && !isBusy;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftLanguageCodes(details.meeting.interpreterLanguages.map((language) => language.code));
    setDraftInvitedUserIds(invitedUserIds);
    setIsLanguagePickerOpen(false);
    setIsParticipantPickerOpen(false);
    setIsVoicePickerOpen(false);
  }, [details.meeting.interpreterLanguages, invitedUserIds, isOpen]);

  function addLanguage(languageCode: string) {
    setDraftLanguageCodes((currentCodes) =>
      currentCodes.includes(languageCode) ? currentCodes : [...currentCodes, languageCode]
    );
  }

  function removeLanguage(languageCode: string) {
    setDraftLanguageCodes((currentCodes) => {
      if (currentCodes.length <= 1) {
        onError('Keep at least one response language in the interpreter meeting.', 'Interpreter settings');
        return currentCodes;
      }

      return currentCodes.filter((currentCode) => currentCode !== languageCode);
    });
  }

  function addParticipant(uid: string) {
    setDraftInvitedUserIds((currentIds) =>
      currentIds.includes(uid) ? currentIds : [...currentIds, uid]
    );
  }

  function removeParticipant(uid: string) {
    setDraftInvitedUserIds((currentIds) => currentIds.filter((currentUid) => currentUid !== uid));
  }

  async function saveSettings() {
    if (!draftLanguageCodes.length) {
      onError('Add at least one response language.', 'Interpreter settings');
      return;
    }

    if (hasLanguageChanges) {
      await onUpdateLanguages(draftLanguageCodes);
    }

    if (hasAccessChanges) {
      await onUpdateInvitations(draftInvitedUserIds);
    }

    onClose();
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
          <Text style={styles.sectionLabel}>Respond languages</Text>
          <View style={styles.selectionList}>
            {draftLanguageCodes.map((languageCode) => {
              const language = languages.find((currentLanguage) => currentLanguage.code === languageCode) || {
                code: languageCode,
                label: languageCode
              };

              return (
                <Pressable
                  key={language.code}
                  onPress={() => removeLanguage(language.code)}
                  style={({ pressed }) => [styles.selectionRow, pressed && styles.pressed]}
                >
                  <Ionicons color={appTheme.colors.primary} name="language-outline" size={18} />
                  <Text style={styles.selectionTitle}>{language.label}</Text>
                  <Ionicons color={appTheme.colors.mutedStrong} name="remove-circle-outline" size={18} />
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setIsLanguagePickerOpen((currentValue) => !currentValue)}
              style={({ pressed }) => [styles.addSelectionRow, pressed && styles.pressed]}
            >
              <Ionicons color={appTheme.colors.primary} name={isLanguagePickerOpen ? 'chevron-up-outline' : 'add-circle-outline'} size={18} />
              <Text style={styles.addSelectionText}>Add respond language</Text>
            </Pressable>
            {isLanguagePickerOpen ? (
              <View style={styles.inlinePickerPanel}>
                {languages
                  .filter((language) => !draftLanguageCodes.includes(language.code))
                  .map((language) => (
                    <Pressable
                      key={language.code}
                      onPress={() => {
                        addLanguage(language.code);
                        setIsLanguagePickerOpen(false);
                      }}
                      style={({ pressed }) => [styles.inlinePickerRow, pressed && styles.pressed]}
                    >
                      <Ionicons color={appTheme.colors.primary} name="language-outline" size={18} />
                      <View style={styles.selectionBody}>
                        <Text style={styles.selectionTitle}>{language.label}</Text>
                        <Text style={styles.participantMeta}>{language.code}</Text>
                      </View>
                      <Ionicons color={appTheme.colors.mutedStrong} name="add-circle-outline" size={19} />
                    </Pressable>
                  ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionLabel}>Meeting access</Text>
          <View style={styles.selectionList}>
            {draftInvitedUserIds.map((uid) => {
              const participant = participants.find((currentParticipant) => currentParticipant.uid === uid);

              if (!participant) {
                return null;
              }

              return (
                <Pressable
                  key={participant.uid}
                  onPress={() => removeParticipant(participant.uid)}
                  style={({ pressed }) => [styles.selectionRow, pressed && styles.pressed]}
                >
                  <Ionicons color={appTheme.colors.primary} name="person-circle-outline" size={20} />
                  <View style={styles.selectionBody}>
                    <Text style={styles.participantName}>{participant.displayName}</Text>
                    <Text style={styles.participantMeta}>{participant.roleName || participant.departmentName || 'Company user'}</Text>
                  </View>
                  <Ionicons color={appTheme.colors.mutedStrong} name="remove-circle-outline" size={18} />
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setIsParticipantPickerOpen((currentValue) => !currentValue)}
              style={({ pressed }) => [styles.addSelectionRow, pressed && styles.pressed]}
            >
              <Ionicons color={appTheme.colors.primary} name={isParticipantPickerOpen ? 'chevron-up-outline' : 'person-add-outline'} size={18} />
              <Text style={styles.addSelectionText}>Add participant</Text>
            </Pressable>
            {isParticipantPickerOpen ? (
              <View style={styles.inlinePickerPanel}>
                {participants
                  .filter((participant) => !draftInvitedUserIds.includes(participant.uid))
                  .map((participant) => (
                    <Pressable
                      key={participant.uid}
                      onPress={() => {
                        addParticipant(participant.uid);
                        setIsParticipantPickerOpen(false);
                      }}
                      style={({ pressed }) => [styles.inlinePickerRow, pressed && styles.pressed]}
                    >
                      <Ionicons color={appTheme.colors.primary} name="person-circle-outline" size={20} />
                      <View style={styles.selectionBody}>
                        <Text style={styles.participantName}>{participant.displayName}</Text>
                        <Text style={styles.participantMeta}>{participant.roleName || participant.departmentName || 'Company user'}</Text>
                      </View>
                      <Ionicons color={appTheme.colors.mutedStrong} name="add-circle-outline" size={19} />
                    </Pressable>
                  ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionLabel}>Interpreter speaker</Text>
          <Pressable
            onPress={() => setIsVoicePickerOpen((currentValue) => !currentValue)}
            style={({ pressed }) => [styles.dropdownRow, pressed && styles.pressed]}
          >
            <Ionicons color={appTheme.colors.primary} name="volume-high-outline" size={19} />
            <View style={styles.selectionBody}>
              <Text style={styles.selectionTitle}>{voiceProfile.label}</Text>
              <Text style={styles.mutedText} numberOfLines={2}>{voiceProfile.description}</Text>
            </View>
            <Ionicons color={appTheme.colors.mutedStrong} name={isVoicePickerOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} />
          </Pressable>
          {isVoicePickerOpen ? (
            <View style={styles.inlinePickerPanel}>
              {voices.map((voice) => {
                const previewKey = getInterpreterVoicePreviewAudioKey(voice.id, previewLanguageCode);
                const isSelected = selectedVoiceId === voice.id;
                const isPreparingPreview = preparingPreviewKey === previewKey;
                const isPreviewPlaying = activePreviewKey === previewKey;

                return (
                  <Pressable
                    key={voice.id}
                    onPress={() => onSelectVoice(voice.id)}
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

interface InterpreterAudioSpectrumProps {
  audioLevel: number;
  isListening: boolean;
}

function InterpreterAudioSpectrum({ audioLevel, isListening }: InterpreterAudioSpectrumProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const bars = useMemo(() => [0.34, 0.56, 0.8, 0.62, 0.94, 0.72, 0.5, 0.86, 0.58, 0.76, 0.46, 0.66, 0.42, 0.6], []);
  const dots = useMemo(() => Array.from({ length: 18 }, (_, index) => ({
    color: ['#2dd4bf', '#60a5fa', '#a78bfa', '#f0abfc', '#34d399', '#22d3ee'][index % 6],
    index
  })), []);
  const normalizedLevel = isListening ? Math.max(0.1, Math.min(1, audioLevel || 0.16)) : 0.08;
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.18]
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 0.04]
  });
  const floatScale = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.03]
  });
  const orbGlowOpacity = Math.min(0.42, 0.16 + normalizedLevel * 0.28);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 980,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          duration: 0,
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          duration: 1100,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(float, {
          duration: 1100,
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );

    if (isListening) {
      animation.start();
      floatAnimation.start();
    } else {
      pulse.stopAnimation();
      float.stopAnimation();
      pulse.setValue(0);
      float.setValue(0);
    }

    return () => {
      animation.stop();
      floatAnimation.stop();
    };
  }, [float, isListening, pulse]);

  return (
    <View style={styles.audioSpectrumWrap}>
      <Animated.View style={[styles.audioOrbShell, { transform: [{ scale: floatScale }] }]}>
        <Animated.View
          style={[
            styles.audioOrbPulseRing,
            {
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }]
            }
          ]}
        />
        <View style={[styles.audioOrbOuterGlow, { opacity: orbGlowOpacity }]} />
        {dots.map((dot) => {
          const angle = (dot.index / dots.length) * Math.PI * 2;
          const radius = 72 + normalizedLevel * 18;
          const size = 5 + normalizedLevel * 8 * ((dot.index % 4) / 4 + 0.45);
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <View
              key={dot.index}
              style={[
                styles.audioOrbDot,
                {
                  backgroundColor: dot.color,
                  height: size,
                  opacity: isListening ? 0.32 + normalizedLevel * 0.55 : 0.12,
                  transform: [{ translateX: x }, { translateY: y }],
                  width: size
                }
              ]}
            />
          );
        })}
        <View style={styles.audioOrbGlass}>
          <View style={styles.audioOrbHighlight} />
          <Ionicons color="#fff" name={isListening ? 'mic' : 'mic-outline'} size={25} />
        </View>
      </Animated.View>
      <View style={styles.audioSpectrum}>
        {bars.map((bar, index) => {
          const height = 9 + Math.round(42 * Math.min(1, normalizedLevel * (0.48 + bar)));

          return (
            <View
              key={`${bar}-${index}`}
              style={[
                styles.audioSpectrumBar,
                {
                  height,
                  opacity: isListening ? 0.5 + normalizedLevel * 0.5 : 0.28
                }
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.audioSpectrumLabel}>
        {isListening ? 'Live microphone signal' : 'Microphone ready'}
      </Text>
    </View>
  );
}

interface InterpreterResponseLanguageModalProps {
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onSelect: (languageCode: string) => void;
  respondingLanguageCode: string | null;
  selectedLanguageCode: string;
}

function InterpreterResponseLanguageModal({
  isOpen,
  languages,
  onClose,
  onSelect,
  respondingLanguageCode,
  selectedLanguageCode
}: InterpreterResponseLanguageModalProps) {
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
              <Text style={styles.eyebrow}>INTERPRET NOW</Text>
              <Text style={styles.modalTitle}>Choose response language</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="close" size={24} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            The interpreter will pause listening and speak the latest captured speech in the selected language.
          </Text>
          <View style={styles.responseLanguageGrid}>
            {languages.map((language) => {
              const isSelected = language.code === selectedLanguageCode;
              const isResponding = language.code === respondingLanguageCode;

              return (
                <Pressable
                  key={language.code}
                  onPress={() => onSelect(language.code)}
                  style={({ pressed }) => [
                    styles.responseLanguageButton,
                    isSelected && styles.responseLanguageButtonSelected,
                    isResponding && styles.responseLanguageButtonResponding,
                    pressed && styles.pressed
                  ]}
                >
                  <Ionicons
                    color={isResponding ? '#fff' : isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                    name={isResponding ? 'volume-high-outline' : 'language-outline'}
                    size={20}
                  />
                  <View style={styles.selectionBody}>
                    <Text style={[
                      styles.responseLanguageTitle,
                      isResponding && styles.responseLanguageTitleResponding
                    ]}>
                      {language.label}
                    </Text>
                    <Text style={[
                      styles.responseLanguageMeta,
                      isResponding && styles.responseLanguageTitleResponding
                    ]}>
                      {isResponding ? 'Speaking now' : isSelected ? 'Current choice' : 'Tap to interpret'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface InterpreterLiveTranscriptModalProps {
  details: InterpreterMeetingDetails;
  isOpen: boolean;
  liveTranscript: string;
  onClose: () => void;
}

function InterpreterLiveTranscriptModal({
  details,
  isOpen,
  liveTranscript,
  onClose
}: InterpreterLiveTranscriptModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const transcriptRows = [
    ...(liveTranscript.trim()
      ? [{
          createdAtIso: new Date().toISOString(),
          text: liveTranscript
        }]
      : []),
    ...details.transcripts
  ];

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={isOpen}>
      <View style={[styles.liveDetailScreen, { paddingBottom: Math.max(insets.bottom + 16, 28), paddingTop: Math.max(insets.top + 12, 24) }]}>
        <View style={styles.liveRoomHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
            <Ionicons color={appTheme.colors.ink} name="chevron-down" size={24} />
          </Pressable>
          <View style={styles.liveRoomTitleWrap}>
            <Text style={styles.liveRoomTitle}>Transcript</Text>
            <Text style={styles.liveRoomMeta}>{details.meeting.meetingName}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.liveDetailList} showsVerticalScrollIndicator={false}>
          {transcriptRows.length ? transcriptRows.map((segment, index) => (
            <View key={segment.segmentId || `${segment.createdAtIso}-${index}`} style={styles.liveDetailRow}>
              <Text style={styles.liveDetailMeta}>{formatDateTime(segment.createdAtIso)}</Text>
              <Text style={styles.liveDetailText}>{segment.text}</Text>
            </View>
          )) : (
            <Text style={styles.mutedText}>Transcript appears here after the interpreter captures speech.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface InterpreterInterpretationHistoryModalProps {
  activeHistoryAudioKey: string | null;
  details: InterpreterMeetingDetails;
  historyItems: InterpreterLiveHistoryItem[];
  isHistoryAudioPlaying: boolean;
  isOpen: boolean;
  onClose: () => void;
  onPlayItem: (item: InterpreterLiveHistoryItem) => void;
  preparingHistoryAudioKey: string | null;
}

function InterpreterInterpretationHistoryModal({
  activeHistoryAudioKey,
  details,
  historyItems,
  isHistoryAudioPlaying,
  isOpen,
  onClose,
  onPlayItem,
  preparingHistoryAudioKey
}: InterpreterInterpretationHistoryModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const groupedHistory = groupInterpreterHistory(details, historyItems);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={isOpen}>
      <View style={[styles.liveDetailScreen, { paddingBottom: Math.max(insets.bottom + 16, 28), paddingTop: Math.max(insets.top + 12, 24) }]}>
        <View style={styles.liveRoomHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
            <Ionicons color={appTheme.colors.ink} name="chevron-down" size={24} />
          </Pressable>
          <View style={styles.liveRoomTitleWrap}>
            <Text style={styles.liveRoomTitle}>Interpretation history</Text>
            <Text style={styles.liveRoomMeta}>Grouped by meeting language</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.liveDetailList} showsVerticalScrollIndicator={false}>
          {groupedHistory.length ? groupedHistory.map((group) => (
            <View key={group.language.code} style={styles.historyLanguageGroup}>
              <Text style={styles.liveRoomSectionLabel}>{group.language.label}</Text>
              {group.items.map((item, index) => (
                <View key={`${item.createdAtIso}-${index}`} style={styles.liveDetailRow}>
                  <View style={styles.historyRowHeader}>
                    <Text style={styles.liveDetailMeta}>{formatDateTime(item.createdAtIso)}</Text>
                    <Pressable
                      disabled={!item.translationId || preparingHistoryAudioKey === getHistoryAudioKey(details.meeting.meetingId, item)}
                      onPress={() => onPlayItem(item)}
                      style={({ pressed }) => [
                        styles.historyPlayButton,
                        activeHistoryAudioKey === getHistoryAudioKey(details.meeting.meetingId, item) &&
                          isHistoryAudioPlaying &&
                          styles.historyPlayButtonActive,
                        pressed && styles.pressed
                      ]}
                    >
                      {preparingHistoryAudioKey === getHistoryAudioKey(details.meeting.meetingId, item) ? (
                        <ActivityIndicator color={appTheme.colors.primary} size="small" />
                      ) : (
                        <Ionicons
                          color={
                            activeHistoryAudioKey === getHistoryAudioKey(details.meeting.meetingId, item) &&
                              isHistoryAudioPlaying
                              ? '#fff'
                              : appTheme.colors.primary
                          }
                          name={
                            activeHistoryAudioKey === getHistoryAudioKey(details.meeting.meetingId, item) &&
                              isHistoryAudioPlaying
                              ? 'pause'
                              : 'play'
                          }
                          size={15}
                        />
                      )}
                    </Pressable>
                  </View>
                  {item.sourceText ? (
                    <Text style={styles.historySourceText}>{item.sourceText}</Text>
                  ) : null}
                  <Text style={styles.liveDetailText}>{item.translatedText || 'Interpretation audio was played live.'}</Text>
                </View>
              ))}
            </View>
          )) : (
            <View style={styles.liveDetailRow}>
              <Text style={styles.liveDetailText}>No interpretations have been played in this session yet.</Text>
              <Text style={styles.mutedText}>
                Interpretations will appear here by language after the meeting has spoken responses.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface InterpreterCreateDraft {
  autoDetectSourceLanguage: boolean;
  interpreterVoiceId: string;
  invitedUserIds: string[];
  isScheduled: boolean;
  languageCodes: string[];
  meetingName: string;
  meetingType: InterpreterMeetingType;
  reminderEnabled: boolean;
  reminderFrequency: 'daily' | 'none' | 'once' | 'weekly';
  reminderLeadMinutes: number | null;
  scheduledAtIso: string | null;
  sourceLanguageCode: string | null;
  timeFormat: '12h' | '24h';
}

interface InterpreterCreateModalProps {
  getIdToken: () => Promise<string>;
  isBusy: boolean;
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onError: (message: string, title?: string) => void;
  participants: InterpreterParticipant[];
  onSubmit: (draft: InterpreterCreateDraft) => Promise<void>;
  voiceProfiles: InterpreterVoiceProfile[];
}

function InterpreterCreateModal({
  getIdToken,
  isBusy,
  isOpen,
  languages,
  onClose,
  onError,
  participants,
  onSubmit,
  voiceProfiles
}: InterpreterCreateModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const availableLanguages = languages.length ? languages : [
    { code: 'en-US', label: 'English' },
    { code: 'es-MX', label: 'Spanish' }
  ];
  const [draft, setDraft] = useState<InterpreterCreateDraft>({
    autoDetectSourceLanguage: true,
    interpreterVoiceId: DEFAULT_INTERPRETER_VOICE_ID,
    invitedUserIds: [],
    isScheduled: false,
    languageCodes: DEFAULT_LANGUAGE_CODES,
    meetingName: '',
    meetingType: 'ONE_ON_ONE',
    reminderEnabled: false,
    reminderFrequency: 'none',
    reminderLeadMinutes: null,
    scheduledAtIso: null,
    sourceLanguageCode: null,
    timeFormat: '12h'
  });
  const [languagePickerMode, setLanguagePickerMode] = useState<'interpret' | 'source' | null>(null);
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [iosDatePickerMode, setIosDatePickerMode] = useState<'date' | 'time' | null>(null);
  const [iosPickerDate, setIosPickerDate] = useState<Date>(() => getDraftScheduleDate(null));
  const [voicePreviewSourceUri, setVoicePreviewSourceUri] = useState<string | null>(null);
  const [voicePreviewCache, setVoicePreviewCache] = useState<Record<string, string>>({});
  const [activeVoicePreviewKey, setActiveVoicePreviewKey] = useState<string | null>(null);
  const [pendingVoicePreviewKey, setPendingVoicePreviewKey] = useState<string | null>(null);
  const [preparingVoicePreviewKey, setPreparingVoicePreviewKey] = useState<string | null>(null);
  const voicePreviewPlayer = useAudioPlayer(voicePreviewSourceUri ? { uri: voicePreviewSourceUri } : null, {
    updateInterval: 250
  });
  const voicePreviewStatus = useAudioPlayerStatus(voicePreviewPlayer);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        autoDetectSourceLanguage: true,
        interpreterVoiceId: DEFAULT_INTERPRETER_VOICE_ID,
        invitedUserIds: [],
        isScheduled: false,
        languageCodes: DEFAULT_LANGUAGE_CODES,
        meetingName: '',
        meetingType: 'ONE_ON_ONE',
        reminderEnabled: false,
        reminderFrequency: 'none',
        reminderLeadMinutes: null,
        scheduledAtIso: null,
        sourceLanguageCode: null,
        timeFormat: '12h'
      });
      setLanguagePickerMode(null);
      setParticipantPickerOpen(false);
      setVoicePickerOpen(false);
      setIosDatePickerMode(null);
      setActiveVoicePreviewKey(null);
      setPendingVoicePreviewKey(null);
      setPreparingVoicePreviewKey(null);
      safePauseAudioPlayer(voicePreviewPlayer);
    }
  }, [isOpen]);

  useEffect(() => () => {
    safePauseAudioPlayer(voicePreviewPlayer);
  }, [voicePreviewPlayer]);

  useEffect(() => {
    if (voicePreviewStatus.didJustFinish) {
      setActiveVoicePreviewKey(null);
    }
  }, [voicePreviewStatus.didJustFinish]);

  useEffect(() => {
    if (!pendingVoicePreviewKey || !voicePreviewSourceUri || !voicePreviewStatus.isLoaded) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await setAudioModeAsync(INTERPRETER_SUMMARY_AUDIO_MODE).catch(() => undefined);
        await voicePreviewPlayer.seekTo(0).catch(() => undefined);

        if (isCancelled) {
          return;
        }

        setActiveVoicePreviewKey(pendingVoicePreviewKey);
        voicePreviewPlayer.play();
        setPendingVoicePreviewKey(null);
      } catch (error) {
        if (!isCancelled) {
          setPendingVoicePreviewKey(null);
          setActiveVoicePreviewKey(null);
          onError(getErrorMessage(error), 'Speaker preview needs attention');
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    onError,
    pendingVoicePreviewKey,
    voicePreviewPlayer,
    voicePreviewSourceUri,
    voicePreviewStatus.isLoaded
  ]);

  function toggleLanguage(code: string) {
    setDraft((currentDraft) => {
      if (currentDraft.languageCodes.includes(code)) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        languageCodes: [...currentDraft.languageCodes, code]
      };
    });
  }

  function removeInterpretLanguage(code: string) {
    setDraft((currentDraft) => {
      if (currentDraft.languageCodes.length <= 1) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        languageCodes: currentDraft.languageCodes.filter((languageCode) => languageCode !== code)
      };
    });
  }

  function addParticipant(uid: string) {
    setDraft((currentDraft) => {
      if (currentDraft.invitedUserIds.includes(uid)) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        invitedUserIds: [...currentDraft.invitedUserIds, uid]
      };
    });
  }

  function removeParticipant(uid: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      invitedUserIds: currentDraft.invitedUserIds.filter((currentUid) => currentUid !== uid)
    }));
  }

  function setScheduleDate(nextDate: Date) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      scheduledAtIso: mergeScheduleDate(getDraftScheduleDate(currentDraft.scheduledAtIso), nextDate).toISOString()
    }));
  }

  function setScheduleTime(nextTime: Date) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      scheduledAtIso: mergeScheduleTime(getDraftScheduleDate(currentDraft.scheduledAtIso), nextTime).toISOString()
    }));
  }

  function openNativeSchedulePicker(mode: 'date' | 'time') {
    const currentDate = getDraftScheduleDate(draft.scheduledAtIso);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: mode === 'date' ? 'calendar' : 'clock',
        is24Hour: draft.timeFormat === '24h',
        mode,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type !== 'set' || !selectedDate) {
            return;
          }

          if (mode === 'date') {
            setScheduleDate(selectedDate);
            return;
          }

          setScheduleTime(selectedDate);
        },
        value: currentDate
      });
      return;
    }

    setIosPickerDate(currentDate);
    setIosDatePickerMode(mode);
  }

  function confirmIosSchedulePicker() {
    if (iosDatePickerMode === 'date') {
      setScheduleDate(iosPickerDate);
    }

    if (iosDatePickerMode === 'time') {
      setScheduleTime(iosPickerDate);
    }

    setIosDatePickerMode(null);
  }

  function submit() {
    if (!draft.meetingName.trim()) {
      onError('Enter a meeting name.', 'Meeting needs attention');
      return;
    }

    if (!draft.languageCodes.length) {
      onError('Select at least one interpretation language.', 'Meeting needs attention');
      return;
    }

    void onSubmit(draft);
  }

  async function handlePreviewVoice(voice: InterpreterVoiceProfile) {
    const previewLanguageCode = draft.languageCodes[0] || 'en-US';
    const previewKey = getInterpreterVoicePreviewAudioKey(voice.id, previewLanguageCode);

    if (activeVoicePreviewKey === previewKey && voicePreviewStatus.playing) {
      safePauseAudioPlayer(voicePreviewPlayer);
      setActiveVoicePreviewKey(null);
      return;
    }

    try {
      setPreparingVoicePreviewKey(previewKey);

      const cachedUri = voicePreviewCache[previewKey];

      if (cachedUri) {
        setVoicePreviewSourceUri(cachedUri);
        setPendingVoicePreviewKey(previewKey);
        return;
      }

      const idToken = await getIdToken();
      const result = await createInterpreterVoicePreviewAudio(idToken, {
        languageCode: previewLanguageCode,
        voiceId: voice.id
      });
      const cachedPreviewUri = await cacheInterpreterVoicePreviewAudio(result.audio);

      setVoicePreviewCache((currentCache) => ({
        ...currentCache,
        [previewKey]: cachedPreviewUri
      }));
      setVoicePreviewSourceUri(cachedPreviewUri);
      setPendingVoicePreviewKey(previewKey);
    } catch (error) {
      onError(getErrorMessage(error), 'Speaker preview needs attention');
    } finally {
      setPreparingVoicePreviewKey(null);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 18, 28) }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>SECURE INTERPRETER</Text>
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
            <TextInput
              onChangeText={(meetingName) => setDraft((currentDraft) => ({ ...currentDraft, meetingName }))}
              placeholder="Meeting name"
              placeholderTextColor={appTheme.colors.muted}
              style={styles.input}
              value={draft.meetingName}
            />

            <Text style={styles.sectionLabel}>Meeting type</Text>
            <View style={styles.segmentedRow}>
              {(['ONE_ON_ONE', 'LEVEL_1', 'LEVEL_3'] as InterpreterMeetingType[]).map((meetingType) => (
                <Pressable
                  key={meetingType}
                  onPress={() => setDraft((currentDraft) => ({ ...currentDraft, meetingType }))}
                  style={[
                    styles.segmentButton,
                    draft.meetingType === meetingType && styles.segmentButtonActive
                  ]}
                >
                  <Text style={[
                    styles.segmentButtonText,
                    draft.meetingType === meetingType && styles.segmentButtonTextActive
                  ]}>
                    {formatMeetingType(meetingType)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setVoicePickerOpen(true)}
              style={({ pressed }) => [styles.dropdownRow, pressed && styles.pressed]}
            >
              <Ionicons color={appTheme.colors.primary} name="volume-high-outline" size={19} />
              <View style={styles.selectionBody}>
                <Text style={styles.sectionLabel}>Interpreter speaker</Text>
                <Text style={styles.selectionTitle}>
                  {getInterpreterVoiceProfile(voiceProfiles, draft.interpreterVoiceId).label}
                </Text>
                <Text style={styles.mutedText}>
                  {getInterpreterVoiceProfile(voiceProfiles, draft.interpreterVoiceId).description}
                </Text>
              </View>
              <Ionicons color={appTheme.colors.mutedStrong} name="chevron-down-outline" size={18} />
            </Pressable>

            <Text style={styles.sectionLabel}>Interpret to</Text>
            <View style={styles.selectionList}>
              {draft.languageCodes.map((languageCode) => {
                const language = availableLanguages.find((availableLanguage) => availableLanguage.code === languageCode) || {
                  code: languageCode,
                  label: languageCode
                };

                return (
                <Pressable
                  key={language.code}
                  onPress={() => removeInterpretLanguage(language.code)}
                  style={({ pressed }) => [styles.selectionRow, pressed && styles.pressed]}
                >
                  <Ionicons
                    color={appTheme.colors.primary}
                    name="language-outline"
                    size={18}
                  />
                  <Text style={styles.selectionTitle}>{language.label}</Text>
                  <Ionicons color={appTheme.colors.mutedStrong} name="close-circle-outline" size={18} />
                </Pressable>
                );
              })}
              <Pressable
                onPress={() => setLanguagePickerMode('interpret')}
                style={({ pressed }) => [styles.addSelectionRow, pressed && styles.pressed]}
              >
                <Ionicons color={appTheme.colors.primary} name="add-circle-outline" size={18} />
                <Text style={styles.addSelectionText}>Add language</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Meeting access</Text>
            <View style={styles.selectionList}>
              {draft.invitedUserIds.map((uid) => {
                const participant = participants.find((currentParticipant) => currentParticipant.uid === uid);

                if (!participant) {
                  return null;
                }

                return (
                  <Pressable
                    key={participant.uid}
                    onPress={() => removeParticipant(participant.uid)}
                    style={({ pressed }) => [styles.selectionRow, pressed && styles.pressed]}
                  >
                    <Ionicons color={appTheme.colors.primary} name="person-circle-outline" size={20} />
                    <View style={styles.selectionBody}>
                      <Text style={styles.participantName}>{participant.displayName}</Text>
                      <Text style={styles.participantMeta}>{participant.roleName || participant.departmentName || 'Company user'}</Text>
                    </View>
                    <Ionicons color={appTheme.colors.mutedStrong} name="close-circle-outline" size={18} />
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setParticipantPickerOpen(true)}
                style={({ pressed }) => [styles.addSelectionRow, pressed && styles.pressed]}
              >
                <Ionicons color={appTheme.colors.primary} name="person-add-outline" size={18} />
                <Text style={styles.addSelectionText}>Add participant</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setDraft((currentDraft) => ({
                ...currentDraft,
                autoDetectSourceLanguage: !currentDraft.autoDetectSourceLanguage,
                sourceLanguageCode: currentDraft.autoDetectSourceLanguage
                  ? currentDraft.sourceLanguageCode || 'en-US'
                  : null
              }))}
              style={styles.switchRow}
            >
              <View style={[styles.switchTrack, draft.autoDetectSourceLanguage && styles.switchTrackActive]}>
                <View style={[styles.switchKnob, draft.autoDetectSourceLanguage && styles.switchKnobActive]} />
              </View>
              <View>
                <Text style={styles.switchTitle}>Auto detect speaker language</Text>
                <Text style={styles.mutedText}>Recommended for diverse teams.</Text>
              </View>
            </Pressable>

            {!draft.autoDetectSourceLanguage ? (
              <Pressable
                onPress={() => setLanguagePickerMode('source')}
                style={({ pressed }) => [styles.dropdownRow, pressed && styles.pressed]}
              >
                <View style={styles.selectionBody}>
                  <Text style={styles.sectionLabel}>Speaker language</Text>
                  <Text style={styles.selectionTitle}>{getLanguageLabel(availableLanguages, draft.sourceLanguageCode || 'en-US')}</Text>
                </View>
                <Ionicons color={appTheme.colors.mutedStrong} name="chevron-down-outline" size={18} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setDraft((currentDraft) => ({
                ...currentDraft,
                isScheduled: !currentDraft.isScheduled,
                reminderEnabled: false,
                reminderFrequency: 'none',
                reminderLeadMinutes: null,
                scheduledAtIso: currentDraft.isScheduled ? null : new Date(Date.now() + 60 * 60_000).toISOString()
              }))}
              style={styles.switchRow}
            >
              <View style={[styles.switchTrack, draft.isScheduled && styles.switchTrackActive]}>
                <View style={[styles.switchKnob, draft.isScheduled && styles.switchKnobActive]} />
              </View>
              <View>
                <Text style={styles.switchTitle}>Schedule for later</Text>
                <Text style={styles.mutedText}>Use native date and time selection.</Text>
              </View>
            </Pressable>

            {draft.isScheduled ? (
              <View style={styles.schedulePanel}>
                <View style={styles.inlineFieldRow}>
                  <Pressable
                    onPress={() => openNativeSchedulePicker('date')}
                    style={({ pressed }) => [styles.dropdownRow, styles.inlineField, pressed && styles.pressed]}
                  >
                    <View style={styles.selectionBody}>
                      <Text style={styles.sectionLabel}>Date</Text>
                      <Text style={styles.selectionTitle}>{formatScheduleDate(draft.scheduledAtIso)}</Text>
                    </View>
                    <Ionicons color={appTheme.colors.primary} name="calendar-outline" size={18} />
                  </Pressable>
                  <Pressable
                    onPress={() => openNativeSchedulePicker('time')}
                    style={({ pressed }) => [styles.dropdownRow, styles.inlineField, pressed && styles.pressed]}
                  >
                    <View style={styles.selectionBody}>
                      <Text style={styles.sectionLabel}>Time</Text>
                      <Text style={styles.selectionTitle}>{formatScheduleTime(draft.scheduledAtIso, draft.timeFormat)}</Text>
                    </View>
                    <Ionicons color={appTheme.colors.primary} name="time-outline" size={18} />
                  </Pressable>
                </View>

                <View style={styles.segmentedRow}>
                  {(['12h', '24h'] as const).map((timeFormat) => (
                    <Pressable
                      key={timeFormat}
                      onPress={() => setDraft((currentDraft) => ({ ...currentDraft, timeFormat }))}
                      style={[
                        styles.segmentButton,
                        draft.timeFormat === timeFormat && styles.segmentButtonActive
                      ]}
                    >
                      <Text style={[
                        styles.segmentButtonText,
                        draft.timeFormat === timeFormat && styles.segmentButtonTextActive
                      ]}>
                        {timeFormat === '12h' ? '12 hour' : '24 hour'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={() => setDraft((currentDraft) => ({
                    ...currentDraft,
                    reminderEnabled: !currentDraft.reminderEnabled,
                    reminderFrequency: currentDraft.reminderEnabled ? 'none' : 'once',
                    reminderLeadMinutes: currentDraft.reminderEnabled ? null : 15
                  }))}
                  style={styles.switchRow}
                >
                  <View style={[styles.switchTrack, draft.reminderEnabled && styles.switchTrackActive]}>
                    <View style={[styles.switchKnob, draft.reminderEnabled && styles.switchKnobActive]} />
                  </View>
                  <View>
                    <Text style={styles.switchTitle}>Set reminder</Text>
                    <Text style={styles.mutedText}>Uses Synzapp push notification reminders.</Text>
                  </View>
                </Pressable>

                {draft.reminderEnabled ? (
                  <View style={styles.inlineFieldRow}>
                    <InterpreterInlineOption
                      iconName="notifications-outline"
                      label="Time frame"
                      onPress={() => setDraft((currentDraft) => ({
                        ...currentDraft,
                        reminderLeadMinutes: getNextReminderLeadMinutes(currentDraft.reminderLeadMinutes)
                      }))}
                      value={formatReminderLeadMinutes(draft.reminderLeadMinutes)}
                    />
                    <InterpreterInlineOption
                      iconName="repeat-outline"
                      label="Frequency"
                      onPress={() => setDraft((currentDraft) => ({
                        ...currentDraft,
                        reminderFrequency: getNextReminderFrequency(currentDraft.reminderFrequency)
                      }))}
                      value={formatReminderFrequency(draft.reminderFrequency)}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <Pressable
            disabled={isBusy}
            onPress={submit}
            style={({ pressed }) => [styles.primaryButtonWide, isBusy && styles.disabledButton, pressed && styles.pressed]}
          >
            {isBusy ? <ActivityIndicator color="#fff" /> : <Ionicons color="#fff" name="shield-checkmark-outline" size={20} />}
            <Text style={styles.primaryButtonText}>Create interpreter meeting</Text>
          </Pressable>
        </View>
      </View>
      <InterpreterOptionPickerModal
        isOpen={languagePickerMode !== null}
        onClose={() => setLanguagePickerMode(null)}
        options={(languagePickerMode === 'interpret'
          ? availableLanguages.filter((language) => !draft.languageCodes.includes(language.code))
          : availableLanguages
        ).map((language) => ({
          iconName: 'language-outline',
          id: language.code,
          subtitle: language.code,
          title: language.label
        }))}
        title={languagePickerMode === 'source' ? 'Speaker language' : 'Add interpretation language'}
        searchPlaceholder="Search language"
        onSelect={(languageCode) => {
          if (languagePickerMode === 'source') {
            setDraft((currentDraft) => ({ ...currentDraft, sourceLanguageCode: languageCode }));
          } else {
            toggleLanguage(languageCode);
          }

          setLanguagePickerMode(null);
        }}
      />
      <InterpreterOptionPickerModal
        isOpen={participantPickerOpen}
        onClose={() => setParticipantPickerOpen(false)}
        options={participants
          .filter((participant) => !draft.invitedUserIds.includes(participant.uid))
          .map((participant) => ({
            iconName: 'person-circle-outline',
            id: participant.uid,
            subtitle: participant.roleName || participant.departmentName || 'Company user',
            title: participant.displayName
          }))}
        title="Add meeting access"
        searchPlaceholder="Search people"
        onSelect={(participantUid) => {
          addParticipant(participantUid);
          setParticipantPickerOpen(false);
        }}
      />
      <InterpreterVoicePickerModal
        activePreviewKey={activeVoicePreviewKey}
        isOpen={voicePickerOpen}
        onClose={() => setVoicePickerOpen(false)}
        onPreview={(voice) => void handlePreviewVoice(voice)}
        onSelect={(voiceId) => {
          setDraft((currentDraft) => ({ ...currentDraft, interpreterVoiceId: voiceId }));
          setVoicePickerOpen(false);
        }}
        preparingPreviewKey={preparingVoicePreviewKey}
        previewLanguageCode={draft.languageCodes[0] || 'en-US'}
        selectedVoiceId={draft.interpreterVoiceId}
        voices={voiceProfiles.length ? voiceProfiles : FALLBACK_INTERPRETER_VOICES}
      />
      <ScheduleDateTimePickerModal
        date={iosPickerDate}
        isOpen={iosDatePickerMode !== null}
        is24Hour={draft.timeFormat === '24h'}
        mode={iosDatePickerMode || 'date'}
        onCancel={() => setIosDatePickerMode(null)}
        onChange={setIosPickerDate}
        onConfirm={confirmIosSchedulePicker}
      />
    </Modal>
  );
}

interface InterpreterSummaryLanguageModalProps {
  activeAudioKey: string | null;
  isBusy: boolean;
  isAudioPlaying: boolean;
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onError: (message: string, title?: string) => void;
  onPlaySummary: (
    summary: InterpreterMeetingDetails['summaries'][number],
    languageCode: string
  ) => void;
  onSubmit: (languageCodes: string[]) => Promise<void>;
  preparingAudioKey: string | null;
  presentation?: 'modal' | 'overlay';
  summaries: InterpreterMeetingDetails['summaries'];
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
              Choose the languages for a spoken, human-style recap of this meeting.
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
            {summaries.length ? summaries.map((summary) => (
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

interface InterpreterVoicePickerModalProps {
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

function ScheduleDateTimePickerModal({
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
      return 'Listening now';
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

function getRealtimeStatusDescription(status: InterpreterRealtimeStatus): string {
  switch (status) {
    case 'connecting':
      return 'Creating the encrypted live interpreter session.';
    case 'listening':
      return 'Speak naturally. Tap a response language when the speaker is finished.';
    case 'speaking':
      return 'Playing the interpretation in the selected language.';
    case 'ready':
      return 'Session is ready for a speaker.';
    case 'error':
      return 'The live session stopped before it could complete.';
    case 'closed':
    default:
      return 'Tap Listen when everyone in the meeting is ready.';
  }
}

function getLiveModeDescription(mode: InterpreterLiveMode, languageLabel: string): string {
  switch (mode) {
    case 'connecting':
      return 'Synzapp is opening the secure realtime interpreter session.';
    case 'listening':
      return 'The spectrum reacts to microphone input. Tap a language when it is time to speak.';
    case 'choosing':
      return 'Select the language your team should hear for the last listening segment.';
    case 'responding':
      return `The interpreter is speaking in ${languageLabel}. Tap Listen to return to the room.`;
    case 'interrupted':
      return 'Choose Continue to finish the prior interpretation, or Current for the latest speech.';
    case 'idle':
    default:
      return 'Tap Listen after microphone readiness and meeting access are correct.';
  }
}

function getLivePrimaryActionLabel(mode: InterpreterLiveMode, status: InterpreterRealtimeStatus): string {
  if (status === 'connecting' || mode === 'connecting') {
    return 'Preparing';
  }

  if (mode === 'listening') {
    return 'Listening...';
  }

  if (mode === 'choosing') {
    return 'Choose language';
  }

  return 'Listen';
}

function getLiveFooterHint(mode: InterpreterLiveMode): string {
  switch (mode) {
    case 'connecting':
      return 'Preparing the secure audio session.';
    case 'listening':
      return 'Tap a response language when the speaker finishes. Synzapp keeps the live session warm.';
    case 'choosing':
      return 'Choose a language to play the interpretation for the last captured speech.';
    case 'responding':
      return 'Tap Listen to return to microphone listening.';
    case 'interrupted':
      return 'Use Continue for the paused interpretation, or Current for the latest captured speech.';
    case 'idle':
    default:
      return 'Tap Listen to begin. Nothing is captured before Listen is active.';
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
  const realtimeLanguages = meeting.interpreterLanguages.filter((language) => language.realtimeTargetSupported);

  return [...realtimeLanguages].sort((leftLanguage, rightLanguage) => {
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

function createInterpreterTextFingerprint(text: string): string {
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

function groupInterpreterHistory(
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

function getDraftScheduleDate(scheduledAtIso: string | null): Date {
  if (!scheduledAtIso) {
    return new Date(Date.now() + 60 * 60_000);
  }

  const parsedDate = new Date(scheduledAtIso);

  return Number.isNaN(parsedDate.getTime()) ? new Date(Date.now() + 60 * 60_000) : parsedDate;
}

function mergeScheduleDate(currentDate: Date, nextDate: Date): Date {
  const mergedDate = new Date(currentDate);

  mergedDate.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());

  return mergedDate;
}

function mergeScheduleTime(currentDate: Date, nextTime: Date): Date {
  const mergedDate = new Date(currentDate);

  mergedDate.setHours(nextTime.getHours(), nextTime.getMinutes(), 0, 0);

  return mergedDate;
}

function getLanguageLabel(languages: InterpreterLanguage[], code: string): string {
  return languages.find((language) => language.code === code)?.label || code;
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

async function cacheInterpreterSummaryAudio(
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

async function cacheInterpreterSegmentAudio(
  meetingId: string,
  audio: InterpreterSegmentAudio
): Promise<string> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Spoken interpretation playback is not available on this device.');
  }

  await FileSystem.makeDirectoryAsync(INTERPRETER_SEGMENT_AUDIO_CACHE_DIR, {
    intermediates: true
  }).catch(() => undefined);

  const safeMeetingId = meetingId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const safeTranslationId = audio.translationId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const safeLanguageCode = audio.languageCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  const fileUri = `${INTERPRETER_SEGMENT_AUDIO_CACHE_DIR}${safeMeetingId}-${safeTranslationId}-${safeLanguageCode}.mp3`;

  await FileSystem.writeAsStringAsync(fileUri, audio.audioBase64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return fileUri;
}

async function cacheInterpreterVoicePreviewAudio(audio: InterpreterVoicePreviewAudio): Promise<string> {
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

function safePauseAudioPlayer(player: { pause: () => void }): void {
  try {
    player.pause();
  } catch {
    // The native audio object can be released during fast modal or route transitions.
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Interpreter could not complete that action.';
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
    listContent: {
      gap: 10,
      paddingBottom: 18
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
    audioOrbDot: {
      backgroundColor: '#d946ef',
      borderRadius: 999,
      left: 88,
      position: 'absolute',
      top: 88
    },
    audioOrbGlass: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 42,
      height: 84,
      justifyContent: 'center',
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { height: 14, width: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 26,
      width: 84
    },
    audioOrbHighlight: {
      backgroundColor: 'rgba(255,255,255,0.28)',
      borderRadius: 30,
      height: 58,
      left: 10,
      opacity: 0.42,
      position: 'absolute',
      top: 7,
      width: 34
    },
    audioOrbOuterGlow: {
      backgroundColor: colors.primarySoft,
      borderRadius: 72,
      height: 144,
      position: 'absolute',
      width: 144
    },
    audioOrbPulseRing: {
      backgroundColor: colors.primary,
      borderRadius: 76,
      height: 152,
      position: 'absolute',
      width: 152
    },
    audioOrbShell: {
      alignItems: 'center',
      height: 180,
      justifyContent: 'center',
      width: 180
    },
    audioSpectrumWrap: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    },
    audioSpectrum: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
      height: 52,
      justifyContent: 'center',
      width: 220
    },
    audioSpectrumBar: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      width: 8
    },
    audioSpectrumLabel: {
      color: colors.mutedStrong,
      fontSize: 12
    },
    liveCenterAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginBottom: 14,
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
    liveLanguageStatus: {
      borderRadius: 4,
      height: 8,
      width: 8
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
      flexDirection: 'row',
      gap: 10
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
      marginBottom: 14
    },
    liveRoomLanguageArea: {
      gap: 10,
      marginBottom: 10
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
      paddingHorizontal: 18
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
      minHeight: 270,
      paddingHorizontal: 12,
      paddingVertical: 14
    },
    liveRoomStateText: {
      color: colors.mutedStrong,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
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
      marginBottom: 16,
      minHeight: 150
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
      paddingVertical: 12
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
    roomTitle: {
      color: colors.ink,
      fontSize: 16
    },
    roomTitleWrap: {
      flex: 1,
      gap: 2
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
      justifyContent: 'center',
      marginBottom: 10,
      minHeight: 42
    },
    workspaceScreen: {
      backgroundColor: colors.screen
    },
    workspaceTitle: {
      color: colors.ink,
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
