import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
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

interface InterpreterAlertState {
  message: string;
  title: string;
}

type InterpreterLanguageSessionState = {
  status: InterpreterRealtimeStatus;
  transcript: string;
  translation: string;
};

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
  const [alertState, setAlertState] = useState<InterpreterAlertState | null>(null);

  const showInterpreterError = useCallback((message: string, title = 'Interpreter needs attention') => {
    setAlertState({ message, title });
  }, []);

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);

    try {
      const idToken = await getIdToken();
      const [result, participantResult] = await Promise.all([
        listInterpreterMeetings(idToken),
        listInterpreterParticipants(idToken)
      ]);

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
        reminderFrequency: input.isScheduled ? input.reminderFrequency : 'none',
        reminderLeadMinutes: input.isScheduled ? input.reminderLeadMinutes : null,
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
      showInterpreterError(getErrorMessage(error));
      return null;
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
      <>
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
      <InterpreterAlertModal
        message={alertState?.message || ''}
        onClose={() => setAlertState(null)}
        title={alertState?.title || 'Interpreter needs attention'}
        visible={Boolean(alertState)}
      />
      </>
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
          disabled={isLoading}
          onPress={() => void loadWorkspace()}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Ionicons color={appTheme.colors.ink} name="refresh-outline" size={18} />
          <Text style={styles.secondaryButtonText}>Refresh</Text>
        </Pressable>
        <Pressable
          onPress={() => setIsCreateOpen(true)}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Ionicons color="#fff" name="add" size={20} />
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
      <InterpreterAlertModal
        message={alertState?.message || ''}
        onClose={() => setAlertState(null)}
        title={alertState?.title || 'Interpreter needs attention'}
        visible={Boolean(alertState)}
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
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(details.meeting.interpreterLanguages[0]?.code || 'en-US');
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>(details.meeting.invitedUserIds || []);
  const realtimeSessionPoolRef = useRef<Record<string, InterpreterRealtimeSession>>({});
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
      return;
    }

    if (statuses.some((status) => status === 'listening' || status === 'ready')) {
      setLiveStatus('listening');
      return;
    }

    if (statuses.some((status) => status === 'connecting')) {
      setLiveStatus('connecting');
      return;
    }

    if (statuses.every((status) => status === 'error')) {
      setLiveStatus('error');
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
        closeRealtimeSessionPool();
        setLiveStatus('error');
        onError('No interpreter language sessions could be started.');
        return;
      }

      setLiveStatus('listening');
    } catch (error) {
      setLiveStatus('error');
      onError(getErrorMessage(error));
    }
  }

  function stopLiveInterpreter() {
    closeRealtimeSessionPool();
    setLiveStatus('closed');
  }

  function respondInSelectedLanguage() {
    realtimeSessionPoolRef.current[selectedLanguageCode]?.respond();
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
            onPress={respondInSelectedLanguage}
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
    </View>
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
  reminderFrequency: 'daily' | 'none' | 'once' | 'weekly';
  reminderLeadMinutes: number | null;
  scheduledAtIso: string | null;
  sourceLanguageCode: string | null;
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
    reminderFrequency: 'none',
    reminderLeadMinutes: null,
    scheduledAtIso: null,
    sourceLanguageCode: null
  });

  useEffect(() => {
    if (isOpen) {
      setDraft({
        autoDetectSourceLanguage: true,
        invitedUserIds: [],
        isScheduled: false,
        languageCodes: DEFAULT_LANGUAGE_CODES,
        meetingName: '',
        meetingType: 'ONE_ON_ONE',
        reminderFrequency: 'none',
        reminderLeadMinutes: null,
        scheduledAtIso: null,
        sourceLanguageCode: null
      });
    }
  }, [isOpen]);

  function toggleLanguage(code: string) {
    setDraft((currentDraft) => {
      const hasLanguage = currentDraft.languageCodes.includes(code);
      const languageCodes = hasLanguage
        ? currentDraft.languageCodes.filter((languageCode) => languageCode !== code)
        : [...currentDraft.languageCodes, code];

      return {
        ...currentDraft,
        languageCodes: languageCodes.includes('en-US') ? languageCodes : ['en-US', ...languageCodes]
      };
    });
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
            <View style={styles.languageGrid}>
              {availableLanguages.map((language) => (
                <Pressable
                  disabled={language.code === 'en-US'}
                  key={language.code}
                  onPress={() => toggleLanguage(language.code)}
                  style={[
                    styles.languageToggle,
                    draft.languageCodes.includes(language.code) && styles.languageToggleActive
                  ]}
                >
                  <Ionicons
                    color={draft.languageCodes.includes(language.code) ? appTheme.colors.primary : appTheme.colors.mutedStrong}
                    name={draft.languageCodes.includes(language.code) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                  />
                  <Text style={styles.languageToggleText}>{language.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Meeting access</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.participantScroller}>
              {participants.map((participant) => {
                const isSelected = draft.invitedUserIds.includes(participant.uid);

                return (
                  <Pressable
                    key={participant.uid}
                    onPress={() => setDraft((currentDraft) => ({
                      ...currentDraft,
                      invitedUserIds: currentDraft.invitedUserIds.includes(participant.uid)
                        ? currentDraft.invitedUserIds.filter((uid) => uid !== participant.uid)
                        : [...currentDraft.invitedUserIds, participant.uid]
                    }))}
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

            <Pressable
              onPress={() => setDraft((currentDraft) => ({
                ...currentDraft,
                autoDetectSourceLanguage: !currentDraft.autoDetectSourceLanguage
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

            <Pressable
              onPress={() => setDraft((currentDraft) => ({
                ...currentDraft,
                isScheduled: !currentDraft.isScheduled,
                reminderFrequency: currentDraft.isScheduled ? 'none' : 'once',
                reminderLeadMinutes: currentDraft.isScheduled ? null : 15,
                scheduledAtIso: currentDraft.isScheduled ? null : new Date(Date.now() + 60 * 60_000).toISOString()
              }))}
              style={styles.switchRow}
            >
              <View style={[styles.switchTrack, draft.isScheduled && styles.switchTrackActive]}>
                <View style={[styles.switchKnob, draft.isScheduled && styles.switchKnobActive]} />
              </View>
              <View>
                <Text style={styles.switchTitle}>Schedule for later</Text>
                <Text style={styles.mutedText}>Reminder metadata is stored with the meeting.</Text>
              </View>
            </Pressable>
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

interface InterpreterAlertModalProps {
  message: string;
  onClose: () => void;
  title: string;
  visible: boolean;
}

function InterpreterAlertModal({
  message,
  onClose,
  title,
  visible
}: InterpreterAlertModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.alertModalRoot}>
        <View style={styles.alertModalCard}>
          <View style={styles.alertIcon}>
            <Ionicons color="#dc2626" name="warning-outline" size={28} />
          </View>
          <View style={styles.alertContent}>
            <Text style={styles.alertEyebrow}>INTERPRETER</Text>
            <Text style={styles.alertTitle}>{title}</Text>
            <Text style={styles.alertMessage}>{message}</Text>
            <View style={styles.alertActions}>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.alertCloseButton, pressed && styles.pressed]}>
                <Text style={styles.alertCloseText}>Close</Text>
              </Pressable>
            </View>
          </View>
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Interpreter could not complete that action.';
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14
    },
    accessPanel: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: 12,
      marginBottom: 12,
      padding: 14
    },
    alertActions: {
      alignItems: 'flex-end',
      marginTop: 16
    },
    alertCloseButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 22
    },
    alertCloseText: {
      color: colors.ink,
      fontSize: 15
    },
    alertContent: {
      flex: 1
    },
    alertEyebrow: {
      color: '#b91c1c',
      fontSize: 11,
      letterSpacing: 1.4,
      marginBottom: 7
    },
    alertIcon: {
      alignItems: 'center',
      backgroundColor: '#fff1f2',
      borderColor: '#fecaca',
      borderRadius: 14,
      borderWidth: 1,
      height: 48,
      justifyContent: 'center',
      width: 48
    },
    alertMessage: {
      color: colors.mutedStrong,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8
    },
    alertModalCard: {
      backgroundColor: colors.card,
      borderColor: '#fecaca',
      borderRadius: 24,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 16,
      marginHorizontal: 24,
      padding: 20
    },
    alertModalRoot: {
      alignItems: 'center',
      backgroundColor: 'rgba(15,23,42,0.38)',
      flex: 1,
      justifyContent: 'center'
    },
    alertTitle: {
      color: colors.ink,
      fontSize: 19
    },
    disabledButton: {
      opacity: 0.58
    },
    deviceCheckButton: {
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      marginBottom: 12,
      padding: 12
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
    emptyState: {
      alignItems: 'center',
      gap: 10,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 48
    },
    emptyTitle: {
      color: colors.ink,
      fontSize: 18
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 28,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      marginBottom: 14,
      padding: 16
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 20,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      width: 54
    },
    heroText: {
      flex: 1,
      gap: 4
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
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
      backgroundColor: colors.card,
      borderColor: colors.primary,
      borderRadius: 28,
      borderWidth: 1,
      gap: 10,
      marginBottom: 12,
      padding: 18
    },
    livePulse: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 32,
      height: 64,
      justifyContent: 'center',
      width: 64
    },
    liveTitle: {
      color: colors.ink,
      fontSize: 19
    },
    liveStatusCard: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
      padding: 12
    },
    liveStatusTextWrap: {
      flex: 1,
      gap: 2
    },
    liveStatusTitle: {
      color: colors.ink,
      fontSize: 15
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      padding: 14
    },
    meetingStatusIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
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
      fontSize: 24
    },
    mutedText: {
      color: colors.mutedStrong,
      fontSize: 13,
      lineHeight: 19
    },
    operatorCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: 10,
      marginBottom: 12,
      padding: 14
    },
    pressed: {
      opacity: 0.76,
      transform: [{ scale: 0.99 }]
    },
    poolReadinessRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
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
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 18,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 14
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 15
    },
    primaryButtonWide: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 50,
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
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 12
    },
    roomHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14
    },
    roomTitle: {
      color: colors.ink,
      fontSize: 18
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
    statusPill: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
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
      borderColor: colors.border,
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
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
      fontSize: 24
    },
    translationCard: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 22,
      borderWidth: 1,
      gap: 10,
      marginBottom: 12,
      padding: 14
    },
    translationText: {
      color: colors.ink,
      fontSize: 18,
      lineHeight: 26
    },
    transcriptPreview: {
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderRadius: 16,
      borderWidth: 1,
      gap: 6,
      marginTop: 10,
      padding: 10
    }
  });
}
