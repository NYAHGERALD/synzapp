import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import {
  addInterpreterTranscriptSegment,
  addInterpreterTranslationSegment,
  createInterpreterMeeting,
  createInterpreterRealtimeClientSecret,
  createInterpreterSummary,
  endInterpreterMeeting,
  getInterpreterMeeting,
  InterpreterLanguage,
  InterpreterMeeting,
  InterpreterMeetingDetails,
  InterpreterParticipant,
  InterpreterMeetingType,
  listInterpreterMeetings,
  listInterpreterParticipants,
  startInterpreterMeeting,
  updateInterpreterMeetingInvitations
} from '../services/interpreterApi';
import {
  getInterpreterAudioReadiness,
  getInterpreterRealtimeRuntimeReadiness,
  InterpreterAudioReadiness,
  InterpreterRealtimeSession,
  InterpreterRealtimeRuntimeReadiness,
  InterpreterRealtimeStatus,
  requestInterpreterAudioReadiness,
  startInterpreterRealtimeSession
} from '../services/interpreterRealtime';

interface InterpreterScreenProps {
  getIdToken: () => Promise<string>;
}

const DEFAULT_LANGUAGE_CODES = ['en-US', 'es-MX'];
const REMINDER_LEAD_MINUTES = [5, 10, 15, 30, 60, 120, 1440];
const REMINDER_FREQUENCIES: Array<InterpreterCreateDraft['reminderFrequency']> = ['once', 'daily', 'weekly'];

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type InterpreterLanguageSessionState = {
  status: InterpreterRealtimeStatus;
  transcript: string;
  translation: string;
};

type InterpreterLiveMode = 'idle' | 'connecting' | 'listening' | 'responding' | 'interrupted';

export function InterpreterScreen({ getIdToken }: InterpreterScreenProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [meetings, setMeetings] = useState<InterpreterMeeting[]>([]);
  const [languages, setLanguages] = useState<InterpreterLanguage[]>([]);
  const [participants, setParticipants] = useState<InterpreterParticipant[]>([]);
  const [selectedMeetingDetails, setSelectedMeetingDetails] = useState<InterpreterMeetingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

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

  async function handleCreateMeeting(input: InterpreterCreateDraft) {
    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await createInterpreterMeeting(idToken, {
        autoDetectSourceLanguage: input.autoDetectSourceLanguage,
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

  async function handlePrepareRealtimeSession(targetLanguageCode?: string | null) {
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
      const realtime = await createInterpreterRealtimeClientSecret(
        idToken,
        meeting.meetingId,
        targetLanguageCode || null
      );

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? {
            ...currentDetails,
            meeting: started.meeting
          }
        : currentDetails);
      setMeetings((currentMeetings) => currentMeetings.map((currentMeeting) =>
        currentMeeting.meetingId === started.meeting.meetingId ? started.meeting : currentMeeting
      ));

      return realtime;
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

  async function handleAddDemoTranscript(text: string, targetLanguageCode: string) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting || !text.trim()) {
      return;
    }

    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const segmentResult = await addInterpreterTranscriptSegment(idToken, meeting.meetingId, text.trim());
      const targetLanguage = meeting.interpreterLanguages.find((language) => language.code === targetLanguageCode);
      const translatedText = `${targetLanguage?.label || targetLanguageCode}: ${text.trim()}`;
      const translationResult = await addInterpreterTranslationSegment(idToken, meeting.meetingId, {
        sourceSegmentId: segmentResult.segment.segmentId || null,
        sourceText: text.trim(),
        targetLanguageCode,
        translatedText
      });

      setSelectedMeetingDetails((currentDetails) => currentDetails
        ? {
            ...currentDetails,
            transcripts: [...currentDetails.transcripts, segmentResult.segment],
            translations: [...currentDetails.translations, translationResult.translation]
          }
        : currentDetails);
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateSummary(languageCodes: string[]) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return;
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
    } catch (error) {
      showInterpreterError(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  if (selectedMeetingDetails) {
    return (
      <InterpreterRoom
        details={selectedMeetingDetails}
        isBusy={isBusy}
        onAddDemoTranscript={handleAddDemoTranscript}
        onBack={() => setSelectedMeetingDetails(null)}
        onCreateSummary={handleCreateSummary}
        onEndMeeting={handleEndMeeting}
        onError={showInterpreterError}
        onPrepareRealtimeSession={handlePrepareRealtimeSession}
        onUpdateInvitations={handleUpdateInvitations}
        participants={participants}
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom + 94, 112) }]}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons color={appTheme.colors.primary} name="language-outline" size={28} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>AI INTERPRETER</Text>
          <Text style={styles.title}>Live workplace interpreter</Text>
          <Text style={styles.subtitle}>
            Standalone voice interpretation for 1-on-1, Level 1, and Level 3 meetings.
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => setIsCreateOpen(true)}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Ionicons color="#fff" name="add" size={17} />
          <Text style={styles.primaryButtonText}>New meeting</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={appTheme.colors.primary} />
          <Text style={styles.mutedText}>Loading interpreter workspace...</Text>
        </View>
      ) : meetings.length ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {meetings.map((meeting) => (
            <Pressable
              key={meeting.meetingId}
              onPress={() => void handleOpenMeeting(meeting.meetingId)}
              style={({ pressed }) => [styles.meetingRow, pressed && styles.pressed]}
            >
              <View style={styles.meetingStatusIcon}>
                <Ionicons
                  color={getStatusColor(meeting.status)}
                  name={meeting.status === 'ENDED' ? 'checkmark-circle-outline' : 'radio-outline'}
                  size={22}
                />
              </View>
              <View style={styles.meetingBody}>
                <Text style={styles.meetingName}>{meeting.meetingName}</Text>
                <Text style={styles.meetingMeta}>
                  {formatMeetingType(meeting.meetingType)} · {meeting.interpreterLanguages.map((language) => language.label).join(', ')}
                </Text>
              </View>
              <Text style={[styles.statusPill, { color: getStatusColor(meeting.status) }]}>
                {formatStatus(meeting.status)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons color={appTheme.colors.mutedStrong} name="mic-circle-outline" size={40} />
          <Text style={styles.emptyTitle}>No interpreter meetings yet</Text>
          <Text style={styles.mutedText}>Create a controlled meeting before starting live interpretation.</Text>
        </View>
      )}

      <InterpreterCreateModal
        isBusy={isBusy}
        isOpen={isCreateOpen}
        languages={languages}
        onClose={() => setIsCreateOpen(false)}
        onError={showInterpreterError}
        participants={participants}
        onSubmit={handleCreateMeeting}
      />
    </View>
  );
}

interface InterpreterRoomProps {
  details: InterpreterMeetingDetails;
  isBusy: boolean;
  onAddDemoTranscript: (text: string, targetLanguageCode: string) => Promise<void>;
  onBack: () => void;
  onCreateSummary: (languageCodes: string[]) => Promise<void>;
  onEndMeeting: () => Promise<void>;
  onError: (message: string, title?: string) => void;
  onPrepareRealtimeSession: (targetLanguageCode?: string | null) => Promise<Awaited<ReturnType<typeof createInterpreterRealtimeClientSecret>> | null>;
  onUpdateInvitations: (invitedUserIds: string[]) => Promise<void>;
  participants: InterpreterParticipant[];
}

function InterpreterRoom({
  details,
  isBusy,
  onAddDemoTranscript,
  onBack,
  onCreateSummary,
  onEndMeeting,
  onError,
  onPrepareRealtimeSession,
  onUpdateInvitations,
  participants
}: InterpreterRoomProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [draftTranscript, setDraftTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveTranslation, setLiveTranslation] = useState('');
  const [liveStatus, setLiveStatus] = useState<InterpreterRealtimeStatus>('closed');
  const [audioReadiness, setAudioReadiness] = useState<InterpreterAudioReadiness | null>(null);
  const [runtimeReadiness, setRuntimeReadiness] = useState<InterpreterRealtimeRuntimeReadiness | null>(null);
  const [isCheckingRuntime, setIsCheckingRuntime] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isLiveRoomOpen, setIsLiveRoomOpen] = useState(false);
  const [liveMode, setLiveMode] = useState<InterpreterLiveMode>('idle');
  const [wasInterpretationInterrupted, setWasInterpretationInterrupted] = useState(false);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(details.meeting.interpreterLanguages[0]?.code || 'en-US');
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>(details.meeting.invitedUserIds || []);
  const realtimeSessionPoolRef = useRef<Record<string, InterpreterRealtimeSession>>({});
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [languageSessionState, setLanguageSessionState] = useState<Record<string, InterpreterLanguageSessionState>>({});
  const latestTranslation = [...details.translations].reverse()
    .find((translation) => translation.targetLanguageCode === selectedLanguageCode);
  const selectedLanguageSession = languageSessionState[selectedLanguageCode];
  const activeSessionStatuses = Object.values(languageSessionState).map((state) => state.status);
  const isRealtimeActive = activeSessionStatuses.some(isActiveRealtimeStatus);

  useEffect(() => () => {
    closeRealtimeSessionPool(false);
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          duration: 1150,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          duration: 450,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );

    if (isLiveRoomOpen && (liveMode === 'listening' || liveMode === 'connecting')) {
      animation.start();
    } else {
      animation.stop();
      pulseAnim.setValue(0);
    }

    return () => animation.stop();
  }, [isLiveRoomOpen, liveMode, pulseAnim]);

  useEffect(() => {
    let isMounted = true;

    void getInterpreterAudioReadiness().then((readiness) => {
      if (isMounted) {
        setAudioReadiness(readiness);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setInvitedUserIds(details.meeting.invitedUserIds || []);
  }, [details.meeting.invitedUserIds]);

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
      setLiveStatus('listening');
      setLiveMode((currentMode) => currentMode === 'interrupted' ? currentMode : 'listening');
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

  async function requestMicrophoneAccess() {
    const readiness = await requestInterpreterAudioReadiness();

    setAudioReadiness(readiness);
    setRuntimeReadiness(null);

    if (!readiness.granted) {
      onError('Allow microphone access in device settings before starting the live interpreter.');
    }
  }

  async function runDeviceReadinessCheck() {
    setIsCheckingRuntime(true);

    try {
      const readiness = await getInterpreterRealtimeRuntimeReadiness();

      setAudioReadiness(readiness.audio);
      setRuntimeReadiness(readiness);

      if (!readiness.canStart) {
        onError(readiness.message, 'Device readiness needs attention');
      }
    } catch (error) {
      onError(getErrorMessage(error), 'Device readiness needs attention');
    } finally {
      setIsCheckingRuntime(false);
    }
  }

  async function startLiveInterpreter() {
    closeRealtimeSessionPool();
    setLiveTranscript('');
    setLiveTranslation('');
    setLiveStatus('connecting');
    setLiveMode('connecting');
    setWasInterpretationInterrupted(false);
    setIsLiveRoomOpen(true);

    try {
      const targetLanguages = getSessionPoolLanguages(details.meeting, selectedLanguageCode);

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
        const realtime = await onPrepareRealtimeSession(language.code);

        if (!realtime) {
          throw new Error(`${language.label} session could not be prepared.`);
        }

        const session = await startInterpreterRealtimeSession(realtime, {
          onError: (message) => onError(message),
          onStatus: (status) => updateLanguageSession(language.code, { status }),
          onTranscript: (transcript) => {
            updateLanguageSession(language.code, { transcript });
            setLiveTranscript((currentTranscript) => language.code === selectedLanguageCode ? transcript : currentTranscript);
          },
          onTranslation: (translation) => {
            updateLanguageSession(language.code, { translation });
            setLiveTranslation((currentTranslation) => language.code === selectedLanguageCode ? translation : currentTranslation);
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
        onError(
          getErrorMessage(failureReason) || 'No interpreter language sessions could be started.'
        );
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
  }

  function respondInSelectedLanguage(languageCode = selectedLanguageCode) {
    setSelectedLanguageCode(languageCode);
    Object.entries(realtimeSessionPoolRef.current).forEach(([currentLanguageCode, session]) => {
      if (currentLanguageCode === languageCode) {
        session.respond();
      } else {
        session.pauseListening();
      }
    });
    setLiveMode('responding');
  }

  function listenAgain() {
    Object.values(realtimeSessionPoolRef.current).forEach((session) => session.cancelResponse());
    setWasInterpretationInterrupted(liveMode === 'responding');
    setLiveMode('listening');
    setLiveStatus('listening');
  }

  function continueInterruptedInterpretation() {
    respondInSelectedLanguage(selectedLanguageCode);
    setWasInterpretationInterrupted(false);
  }

  function useCurrentInterpretation(languageCode = selectedLanguageCode) {
    Object.values(realtimeSessionPoolRef.current).forEach((session) => session.cancelResponse());
    respondInSelectedLanguage(languageCode);
    setWasInterpretationInterrupted(false);
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

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom + 94, 112) }]}>
      <View style={styles.roomHeader}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons color={appTheme.colors.ink} name="chevron-back" size={24} />
        </Pressable>
        <View style={styles.roomTitleWrap}>
          <Text style={styles.roomTitle}>{details.meeting.meetingName}</Text>
          <Text style={styles.meetingMeta}>
            {formatMeetingType(details.meeting.meetingType)} · {formatStatus(details.meeting.status)}
          </Text>
        </View>
        <Pressable
          disabled={isBusy || details.meeting.status === 'ENDED'}
          onPress={() => void onEndMeeting()}
          style={({ pressed }) => [styles.endButton, pressed && styles.pressed]}
        >
          <Text style={styles.endButtonText}>End</Text>
        </Pressable>
      </View>

      <View style={styles.readinessRow}>
        <View style={styles.readinessCopy}>
          <Text style={styles.sectionLabel}>Microphone readiness</Text>
          <Text style={styles.mutedText}>
            {audioReadiness?.granted ? 'Microphone access is ready for live interpretation.' : 'Microphone access is required before listening.'}
          </Text>
        </View>
        <Pressable
          disabled={Boolean(audioReadiness?.granted)}
          onPress={() => void requestMicrophoneAccess()}
          style={({ pressed }) => [
            styles.permissionButton,
            audioReadiness?.granted && styles.permissionButtonReady,
            pressed && styles.pressed
          ]}
        >
          <Ionicons
            color={audioReadiness?.granted ? '#047857' : appTheme.colors.primary}
            name={audioReadiness?.granted ? 'checkmark-circle-outline' : 'mic-outline'}
            size={17}
          />
          <Text style={[
            styles.permissionButtonText,
            audioReadiness?.granted && styles.permissionButtonTextReady
          ]}>
            {audioReadiness?.granted ? 'Ready' : 'Allow'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.deviceCheckPanel}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.readinessCopy}>
            <Text style={styles.sectionLabel}>Device interpreter check</Text>
            <Text style={styles.mutedText}>
              {runtimeReadiness?.message || 'Run this before the real interpreting test on each device.'}
            </Text>
          </View>
          <Pressable
            disabled={isCheckingRuntime}
            onPress={() => void runDeviceReadinessCheck()}
            style={({ pressed }) => [
              styles.deviceCheckButton,
              runtimeReadiness?.canStart && styles.deviceCheckButtonReady,
              pressed && styles.pressed
            ]}
          >
            {isCheckingRuntime ? (
              <ActivityIndicator color={appTheme.colors.primary} />
            ) : (
              <Ionicons
                color={runtimeReadiness?.canStart ? '#047857' : appTheme.colors.primary}
                name={runtimeReadiness?.canStart ? 'shield-checkmark-outline' : 'pulse-outline'}
                size={17}
              />
            )}
            <Text style={[
              styles.deviceCheckButtonText,
              runtimeReadiness?.canStart && styles.deviceCheckButtonTextReady
            ]}>
              {runtimeReadiness?.canStart ? 'Ready' : 'Check'}
            </Text>
          </Pressable>
        </View>
        {runtimeReadiness ? (
          <View style={styles.diagnosticGrid}>
            <DiagnosticPill label="Microphone" ready={runtimeReadiness.audio.granted} />
            <DiagnosticPill label="WebRTC" ready={runtimeReadiness.webRtcRuntimeAvailable} />
            <DiagnosticPill label="Media capture" ready={runtimeReadiness.getUserMediaSupported} />
            <DiagnosticPill label="Peer session" ready={runtimeReadiness.peerConnectionSupported} />
          </View>
        ) : null}
      </View>

      <View style={styles.accessPanel}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionLabel}>Meeting access</Text>
            <Text style={styles.mutedText}>{invitedUserIds.length} invited participant{invitedUserIds.length === 1 ? '' : 's'} can open this interpreter meeting.</Text>
          </View>
          <Pressable
            disabled={isBusy}
            onPress={() => void onUpdateInvitations(invitedUserIds)}
            style={({ pressed }) => [styles.saveAccessButton, isBusy && styles.disabledButton, pressed && styles.pressed]}
          >
            <Text style={styles.saveAccessButtonText}>Save</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.participantScroller}>
          {participants.map((participant) => {
            const isSelected = invitedUserIds.includes(participant.uid);

            return (
              <Pressable
                key={participant.uid}
                onPress={() => {
                  setInvitedUserIds((currentIds) =>
                    currentIds.includes(participant.uid)
                      ? currentIds.filter((uid) => uid !== participant.uid)
                      : [...currentIds, participant.uid]
                  );
                }}
                style={[
                  styles.participantChip,
                  isSelected && styles.participantChipActive
                ]}
              >
                <Ionicons
                  color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                  name={isSelected ? 'checkmark-circle' : 'person-add-outline'}
                  size={17}
                />
                <View>
                  <Text style={styles.participantName}>{participant.displayName}</Text>
                  <Text style={styles.participantMeta}>{participant.roleName || participant.departmentName || 'Company user'}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.livePanel}>
        <View style={styles.livePulse}>
          <Ionicons color={appTheme.colors.primary} name="mic-outline" size={28} />
        </View>
        <Text style={styles.liveTitle}>Controlled interpreter room</Text>
        <Text style={styles.subtitle}>
          The interpreter listens only in this meeting. Chat messages and chat media are not connected to this feature.
        </Text>
        <View style={styles.liveStatusCard}>
          <View style={[styles.statusDot, { backgroundColor: getRealtimeStatusColor(liveStatus) }]} />
          <View style={styles.liveStatusTextWrap}>
            <Text style={styles.liveStatusTitle}>{formatRealtimeStatus(liveStatus)}</Text>
            <Text style={styles.mutedText}>{getRealtimeStatusDescription(liveStatus)}</Text>
          </View>
        </View>
        <Pressable
          disabled={isBusy || details.meeting.status === 'ENDED'}
          onPress={() => {
            if (isRealtimeActive) {
              stopLiveInterpreter();
              return;
            }

            void startLiveInterpreter();
          }}
          style={({ pressed }) => [styles.primaryButtonWide, pressed && styles.pressed]}
        >
          {isBusy || liveStatus === 'connecting' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons color="#fff" name={isRealtimeActive ? 'stop-circle-outline' : 'radio-outline'} size={20} />
          )}
          <Text style={styles.primaryButtonText}>{isRealtimeActive ? 'Stop interpreter' : 'Start live interpreter'}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.languageScroller}>
        {details.meeting.interpreterLanguages.map((language) => (
          <Pressable
            key={language.code}
            onPress={() => setSelectedLanguageCode(language.code)}
            style={[
              styles.languageChip,
              selectedLanguageCode === language.code && styles.languageChipActive
            ]}
          >
            <Text style={[
              styles.languageChipText,
              selectedLanguageCode === language.code && styles.languageChipTextActive
            ]}>
              {language.label}
            </Text>
            {languageSessionState[language.code] ? (
              <View style={[
                styles.languageStatusDot,
                { backgroundColor: getRealtimeStatusColor(languageSessionState[language.code].status) }
              ]} />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.translationCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Latest interpretation</Text>
          <Pressable
            disabled={!isRealtimeActive || details.meeting.status === 'ENDED'}
            onPress={() => respondInSelectedLanguage(selectedLanguageCode)}
            style={({ pressed }) => [
              styles.respondButton,
              (!isRealtimeActive || details.meeting.status === 'ENDED') && styles.disabledButton,
              pressed && styles.pressed
            ]}
          >
            <Ionicons color="#fff" name="volume-high-outline" size={17} />
            <Text style={styles.respondButtonText}>Respond</Text>
          </Pressable>
        </View>
        <Text style={styles.translationText}>
          {selectedLanguageSession?.translation || liveTranslation || latestTranslation?.translatedText || 'Tap a language when the speaker finishes. The live interpreter will speak in that language.'}
        </Text>
        {selectedLanguageSession?.transcript || liveTranscript ? (
          <View style={styles.transcriptPreview}>
            <Text style={styles.sectionLabel}>Detected speech</Text>
            <Text style={styles.mutedText}>{selectedLanguageSession?.transcript || liveTranscript}</Text>
          </View>
        ) : null}
        {isRealtimeActive ? (
          <View style={styles.poolReadinessRow}>
            <Ionicons color={appTheme.colors.primary} name="layers-outline" size={16} />
            <Text style={styles.poolReadinessText}>
              {getSessionPoolReadyCount(languageSessionState)} of {getSessionPoolLanguages(details.meeting, selectedLanguageCode).length} language sessions ready
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.operatorCard}>
        <Text style={styles.sectionLabel}>Meeting memory console</Text>
        <Text style={styles.mutedText}>
          Use this only for controlled notes or manual correction while live audio transcription is being validated.
        </Text>
        <TextInput
          multiline
          onChangeText={setDraftTranscript}
          placeholder="Type a sample sentence to verify meeting memory and language controls."
          placeholderTextColor={appTheme.colors.muted}
          style={styles.textArea}
          value={draftTranscript}
        />
        <Pressable
          disabled={isBusy || !draftTranscript.trim()}
          onPress={() => {
            void onAddDemoTranscript(draftTranscript, selectedLanguageCode).then(() => setDraftTranscript(''));
          }}
          style={({ pressed }) => [
            styles.secondaryButtonFull,
            (!draftTranscript.trim() || isBusy) && styles.disabledButton,
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.secondaryButtonText}>Record secure test segment</Text>
        </Pressable>
      </View>

      <View style={styles.operatorCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Meeting summary</Text>
          <Pressable
            disabled={isBusy}
            onPress={() => setIsSummaryModalOpen(true)}
            style={({ pressed }) => [styles.summaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.summaryButtonText}>Summarize</Text>
          </Pressable>
        </View>
        {details.summaries[0] ? (
          details.meeting.interpreterLanguages.map((language) => (
            <View key={language.code} style={styles.summaryBlock}>
              <Text style={styles.summaryLanguage}>{language.label}</Text>
              <Text style={styles.mutedText}>
                {details.summaries[0]?.summaryTextByLanguage?.[language.code] || 'No summary for this language yet.'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.mutedText}>No summary has been created yet.</Text>
        )}
      </View>
      <InterpreterSummaryLanguageModal
        isBusy={isBusy}
        isOpen={isSummaryModalOpen}
        languages={details.meeting.interpreterLanguages}
        onClose={() => setIsSummaryModalOpen(false)}
        onError={onError}
        onSubmit={async (languageCodes) => {
          await onCreateSummary(languageCodes);
          setIsSummaryModalOpen(false);
        }}
      />
      <InterpreterLiveRoomModal
        details={details}
        isOpen={isLiveRoomOpen}
        languageSessionState={languageSessionState}
        liveMode={liveMode}
        liveStatus={liveStatus}
        liveTranscript={liveTranscript}
        liveTranslation={liveTranslation}
        onClose={() => setIsLiveRoomOpen(false)}
        onContinue={continueInterruptedInterpretation}
        onCurrent={() => useCurrentInterpretation(selectedLanguageCode)}
        onEnd={() => {
          stopLiveInterpreter();
          setIsLiveRoomOpen(false);
        }}
        onListen={listenAgain}
        onRespond={respondInSelectedLanguage}
        onStart={() => void startLiveInterpreter()}
        pulseAnim={pulseAnim}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        wasInterrupted={wasInterpretationInterrupted}
      />
    </View>
  );
}

interface InterpreterLiveRoomModalProps {
  details: InterpreterMeetingDetails;
  isOpen: boolean;
  languageSessionState: Record<string, InterpreterLanguageSessionState>;
  liveMode: InterpreterLiveMode;
  liveStatus: InterpreterRealtimeStatus;
  liveTranscript: string;
  liveTranslation: string;
  onClose: () => void;
  onContinue: () => void;
  onCurrent: () => void;
  onEnd: () => void;
  onListen: () => void;
  onRespond: (languageCode: string) => void;
  onStart: () => void;
  pulseAnim: Animated.Value;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  wasInterrupted: boolean;
}

function InterpreterLiveRoomModal({
  details,
  isOpen,
  languageSessionState,
  liveMode,
  liveStatus,
  liveTranscript,
  liveTranslation,
  onClose,
  onContinue,
  onCurrent,
  onEnd,
  onListen,
  onRespond,
  onStart,
  pulseAnim,
  selectedLanguageCode,
  setSelectedLanguageCode,
  wasInterrupted
}: InterpreterLiveRoomModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const selectedLanguage = details.meeting.interpreterLanguages.find((language) => language.code === selectedLanguageCode)
    || details.meeting.interpreterLanguages[0];
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.32]
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.04]
  });
  const isActive = isActiveRealtimeStatus(liveStatus);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={isOpen}>
      <View style={[styles.liveRoomScreen, { paddingBottom: Math.max(insets.bottom + 16, 28), paddingTop: Math.max(insets.top + 12, 26) }]}>
        <View style={styles.liveRoomHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.liveIconButton, pressed && styles.pressed]}>
            <Ionicons color="#e5edf8" name="chevron-down" size={24} />
          </Pressable>
          <View style={styles.liveRoomTitleWrap}>
            <Text style={styles.liveRoomTitle}>{details.meeting.meetingName}</Text>
            <Text style={styles.liveRoomMeta}>
              {formatMeetingType(details.meeting.meetingType)} · {formatRealtimeStatus(liveStatus)}
            </Text>
          </View>
          <Pressable onPress={onEnd} style={({ pressed }) => [styles.liveEndButton, pressed && styles.pressed]}>
            <Text style={styles.liveEndButtonText}>End</Text>
          </Pressable>
        </View>

        <View style={styles.liveRoomPrivacyRow}>
          <Ionicons color="#5eead4" name="shield-checkmark-outline" size={17} />
          <Text style={styles.liveRoomPrivacyText}>Interpreter only. Chat messages and chat media are not connected.</Text>
        </View>

        <View style={styles.liveRoomStage}>
          <View style={styles.liveOrbWrap}>
            <Animated.View
              style={[
                styles.liveOrbPulse,
                { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }
              ]}
            />
            <View style={styles.liveOrb}>
              <Ionicons
                color="#ecfeff"
                name={liveMode === 'responding' ? 'volume-high-outline' : 'mic-outline'}
                size={42}
              />
            </View>
          </View>
          <Text style={styles.liveRoomStateTitle}>{getLiveModeTitle(liveMode)}</Text>
          <Text style={styles.liveRoomStateText}>{getLiveModeDescription(liveMode, selectedLanguage?.label || 'selected language')}</Text>
        </View>

        <View style={styles.liveRoomLanguageArea}>
          <Text style={styles.liveRoomSectionLabel}>Respond language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {details.meeting.interpreterLanguages.map((language) => {
              const isSelected = language.code === selectedLanguageCode;
              const sessionState = languageSessionState[language.code];

              return (
                <Pressable
                  key={language.code}
                  onPress={() => {
                    setSelectedLanguageCode(language.code);
                    if (isActive) {
                      onRespond(language.code);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.liveLanguageButton,
                    isSelected && styles.liveLanguageButtonActive,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={[styles.liveLanguageStatus, { backgroundColor: getRealtimeStatusColor(sessionState?.status || 'closed') }]} />
                  <Text style={[styles.liveLanguageButtonText, isSelected && styles.liveLanguageButtonTextActive]}>
                    {language.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.liveRoomTranscriptArea}>
          <Text style={styles.liveRoomSectionLabel}>Detected speech</Text>
          <Text style={styles.liveRoomTranscriptText}>
            {liveTranscript || 'The transcript preview appears here while the interpreter listens.'}
          </Text>
          <View style={styles.liveRoomDivider} />
          <Text style={styles.liveRoomSectionLabel}>Current interpretation</Text>
          <Text style={styles.liveRoomTranslationText}>
            {liveTranslation || `Ready to interpret in ${selectedLanguage?.label || 'the selected language'}.`}
          </Text>
        </View>

        {wasInterrupted ? (
          <View style={styles.liveRoomRecoveryRow}>
            <Pressable onPress={onContinue} style={({ pressed }) => [styles.liveSecondaryAction, pressed && styles.pressed]}>
              <Ionicons color="#e5edf8" name="play-forward-outline" size={18} />
              <Text style={styles.liveSecondaryActionText}>Continue</Text>
            </Pressable>
            <Pressable onPress={onCurrent} style={({ pressed }) => [styles.livePrimaryAction, pressed && styles.pressed]}>
              <Ionicons color="#06251f" name="flash-outline" size={18} />
              <Text style={styles.livePrimaryActionText}>Current</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.liveRoomFooter}>
          {isActive ? (
            <Pressable
              onPress={liveMode === 'responding' ? onListen : () => onRespond(selectedLanguageCode)}
              style={({ pressed }) => [
                liveMode === 'responding' ? styles.livePrimaryAction : styles.liveRespondAction,
                pressed && styles.pressed
              ]}
            >
              <Ionicons
                color={liveMode === 'responding' ? '#06251f' : '#fff'}
                name={liveMode === 'responding' ? 'mic-outline' : 'volume-high-outline'}
                size={20}
              />
              <Text style={liveMode === 'responding' ? styles.livePrimaryActionText : styles.liveRespondActionText}>
                {liveMode === 'responding' ? 'Listen' : `Respond in ${selectedLanguage?.label || 'language'}`}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={onStart} style={({ pressed }) => [styles.liveRespondAction, pressed && styles.pressed]}>
              <Ionicons color="#fff" name="radio-outline" size={20} />
              <Text style={styles.liveRespondActionText}>Start live interpreter</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

interface DiagnosticPillProps {
  label: string;
  ready: boolean;
}

function DiagnosticPill({ label, ready }: DiagnosticPillProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <View style={[
      styles.diagnosticPill,
      ready ? styles.diagnosticPillReady : styles.diagnosticPillBlocked
    ]}>
      <Ionicons
        color={ready ? '#047857' : '#b45309'}
        name={ready ? 'checkmark-circle-outline' : 'alert-circle-outline'}
        size={15}
      />
      <Text style={[
        styles.diagnosticPillText,
        ready ? styles.diagnosticPillTextReady : styles.diagnosticPillTextBlocked
      ]}>
        {label}
      </Text>
    </View>
  );
}

interface InterpreterCreateDraft {
  autoDetectSourceLanguage: boolean;
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
  isBusy: boolean;
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onError: (message: string, title?: string) => void;
  participants: InterpreterParticipant[];
  onSubmit: (draft: InterpreterCreateDraft) => Promise<void>;
}

function InterpreterCreateModal({
  isBusy,
  isOpen,
  languages,
  onClose,
  onError,
  participants,
  onSubmit
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
  const [iosDatePickerMode, setIosDatePickerMode] = useState<'date' | 'time' | null>(null);
  const [iosPickerDate, setIosPickerDate] = useState<Date>(() => getDraftScheduleDate(null));

  useEffect(() => {
    if (isOpen) {
      setDraft({
        autoDetectSourceLanguage: true,
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
      setIosDatePickerMode(null);
    }
  }, [isOpen]);

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

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
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
        onSelect={(participantUid) => {
          addParticipant(participantUid);
          setParticipantPickerOpen(false);
        }}
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
  isBusy: boolean;
  isOpen: boolean;
  languages: InterpreterLanguage[];
  onClose: () => void;
  onError: (message: string, title?: string) => void;
  onSubmit: (languageCodes: string[]) => Promise<void>;
}

function InterpreterSummaryLanguageModal({
  isBusy,
  isOpen,
  languages,
  onClose,
  onError,
  onSubmit
}: InterpreterSummaryLanguageModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [selectedLanguageCodes, setSelectedLanguageCodes] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedLanguageCodes(languages.map((language) => language.code));
    }
  }, [isOpen, languages]);

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

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 18, 28) }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>MEETING SUMMARY</Text>
              <Text style={styles.modalTitle}>Choose languages</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons color={appTheme.colors.ink} name="close" size={24} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            Synzapp will summarize only the selected languages using the secured meeting transcript memory.
          </Text>
          <View style={styles.summaryLanguageList}>
            {languages.map((language) => {
              const isSelected = selectedLanguageCodes.includes(language.code);

              return (
                <Pressable
                  key={language.code}
                  onPress={() => toggleLanguage(language.code)}
                  style={[
                    styles.summaryLanguageRow,
                    isSelected && styles.summaryLanguageRowSelected
                  ]}
                >
                  <View style={styles.summaryLanguageIcon}>
                    <Ionicons
                      color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                    />
                  </View>
                  <Text style={styles.summaryLanguageRowText}>{language.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            disabled={isBusy}
            onPress={submit}
            style={({ pressed }) => [styles.primaryButtonWide, isBusy && styles.disabledButton, pressed && styles.pressed]}
          >
            {isBusy ? <ActivityIndicator color="#fff" /> : <Ionicons color="#fff" name="document-text-outline" size={20} />}
            <Text style={styles.primaryButtonText}>Create summary</Text>
          </Pressable>
        </View>
      </View>
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
  title: string;
}

function InterpreterOptionPickerModal({
  isOpen,
  onClose,
  onSelect,
  options,
  title
}: InterpreterOptionPickerModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();

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
          <ScrollView contentContainerStyle={styles.pickerList} keyboardShouldPersistTaps="handled">
            {options.length ? options.map((option) => (
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
                <Ionicons color={appTheme.colors.mutedStrong} name="checkmark-circle-outline" size={28} />
                <Text style={styles.mutedText}>All available options have already been added.</Text>
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
      return 'Speak naturally, then tap Respond on the target language.';
    case 'speaking':
      return 'Playing the interpretation in the selected language.';
    case 'ready':
      return 'Session is ready for a speaker.';
    case 'error':
      return 'The live session stopped before it could complete.';
    case 'closed':
    default:
      return 'Start only when everyone in the meeting is ready.';
  }
}

function getLiveModeTitle(mode: InterpreterLiveMode): string {
  switch (mode) {
    case 'connecting':
      return 'Preparing the interpreter';
    case 'listening':
      return 'Listening to the conversation';
    case 'responding':
      return 'Interpreting now';
    case 'interrupted':
      return 'Interpretation paused';
    case 'idle':
    default:
      return 'Ready when your team is ready';
  }
}

function getLiveModeDescription(mode: InterpreterLiveMode, languageLabel: string): string {
  switch (mode) {
    case 'connecting':
      return 'Synzapp is opening secure realtime language lanes.';
    case 'listening':
      return 'Let the speaker finish, then tap a language to respond.';
    case 'responding':
      return `The interpreter is speaking in ${languageLabel}. Tap Listen to return to the room.`;
    case 'interrupted':
      return 'Choose Continue to finish the prior interpretation, or Current for the latest speech.';
    case 'idle':
    default:
      return 'Start only after microphone readiness and meeting access are correct.';
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
  if (meeting.meetingType === 'LEVEL_1' || meeting.meetingType === 'LEVEL_3') {
    return meeting.interpreterLanguages;
  }

  return meeting.interpreterLanguages.filter((language) => language.code === selectedLanguageCode);
}

function getSessionPoolReadyCount(sessionState: Record<string, InterpreterLanguageSessionState>): number {
  return Object.values(sessionState).filter((state) =>
    state.status === 'listening' || state.status === 'ready' || state.status === 'speaking'
  ).length;
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
    deviceCheckButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12
    },
    deviceCheckButtonReady: {
      backgroundColor: '#dcfce7',
      borderColor: '#86efac'
    },
    deviceCheckButtonText: {
      color: colors.primary,
      fontSize: 13
    },
    deviceCheckButtonTextReady: {
      color: '#047857'
    },
    deviceCheckPanel: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      gap: 10,
      marginBottom: 12,
      paddingBottom: 12
    },
    diagnosticGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    diagnosticPill: {
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    diagnosticPillBlocked: {
      backgroundColor: '#fffbeb',
      borderColor: '#fcd34d'
    },
    diagnosticPillReady: {
      backgroundColor: '#ecfdf5',
      borderColor: '#86efac'
    },
    diagnosticPillText: {
      fontSize: 12
    },
    diagnosticPillTextBlocked: {
      color: '#92400e'
    },
    diagnosticPillTextReady: {
      color: '#047857'
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
    languageChipText: {
      color: colors.ink,
      fontSize: 14
    },
    languageChipTextActive: {
      color: colors.primary
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
      paddingBottom: 12
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
    liveEndButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(248,113,113,0.12)',
      borderRadius: 999,
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 14
    },
    liveEndButtonText: {
      color: '#fecaca',
      fontSize: 13
    },
    liveIconButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(148,163,184,0.16)',
      borderRadius: 999,
      height: 42,
      justifyContent: 'center',
      width: 42
    },
    liveLanguageButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      marginRight: 8,
      minHeight: 38,
      paddingHorizontal: 13
    },
    liveLanguageButtonActive: {
      backgroundColor: '#ccfbf1'
    },
    liveLanguageButtonText: {
      color: '#dbeafe',
      fontSize: 13
    },
    liveLanguageButtonTextActive: {
      color: '#0f766e'
    },
    liveLanguageStatus: {
      borderRadius: 4,
      height: 8,
      width: 8
    },
    liveOrb: {
      alignItems: 'center',
      backgroundColor: '#0f766e',
      borderRadius: 42,
      height: 84,
      justifyContent: 'center',
      width: 84
    },
    liveOrbPulse: {
      backgroundColor: '#5eead4',
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
      backgroundColor: '#5eead4',
      borderRadius: 999,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 14
    },
    livePrimaryActionText: {
      color: '#06251f',
      fontSize: 14
    },
    liveRespondAction: {
      alignItems: 'center',
      backgroundColor: '#0f766e',
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
      backgroundColor: 'rgba(226,232,240,0.16)',
      height: 1,
      marginVertical: 12
    },
    liveRoomFooter: {
      flexDirection: 'row',
      gap: 10
    },
    liveRoomHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14
    },
    liveRoomLanguageArea: {
      gap: 10,
      marginBottom: 18
    },
    liveRoomMeta: {
      color: '#9fb0c7',
      fontSize: 12,
      marginTop: 2
    },
    liveRoomPrivacyRow: {
      alignItems: 'center',
      borderBottomColor: 'rgba(226,232,240,0.16)',
      borderBottomWidth: 1,
      borderTopColor: 'rgba(226,232,240,0.16)',
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 10
    },
    liveRoomPrivacyText: {
      color: '#cbd5e1',
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
      backgroundColor: '#020617',
      flex: 1,
      paddingHorizontal: 18
    },
    liveRoomSectionLabel: {
      color: '#5eead4',
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase'
    },
    liveRoomStage: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    liveRoomStateText: {
      color: '#bfd0e5',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
      textAlign: 'center'
    },
    liveRoomStateTitle: {
      color: '#f8fafc',
      fontSize: 21
    },
    liveRoomTitle: {
      color: '#f8fafc',
      fontSize: 17
    },
    liveRoomTitleWrap: {
      flex: 1
    },
    liveRoomTranscriptArea: {
      borderBottomColor: 'rgba(226,232,240,0.16)',
      borderBottomWidth: 1,
      borderTopColor: 'rgba(226,232,240,0.16)',
      borderTopWidth: 1,
      gap: 6,
      marginBottom: 16,
      paddingVertical: 14
    },
    liveRoomTranscriptText: {
      color: '#cbd5e1',
      fontSize: 14,
      lineHeight: 21
    },
    liveRoomTranslationText: {
      color: '#f8fafc',
      fontSize: 16,
      lineHeight: 23
    },
    liveSecondaryAction: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 999,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 14
    },
    liveSecondaryActionText: {
      color: '#e5edf8',
      fontSize: 14
    },
    meetingBody: {
      flex: 1,
      gap: 5
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
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 12
    },
    meetingStatusIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 18,
      height: 42,
      justifyContent: 'center',
      width: 42
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
    permissionButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12
    },
    permissionButtonReady: {
      backgroundColor: '#dcfce7',
      borderColor: '#86efac'
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
    roomHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14
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
    schedulePanel: {
      backgroundColor: colors.surface,
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      gap: 12,
      paddingTop: 12
    },
    statusPill: {
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      fontSize: 12,
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 6
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
