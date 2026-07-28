import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  InterpreterMeetingType,
  listInterpreterMeetings,
  startInterpreterMeeting
} from '../services/interpreterApi';

interface InterpreterScreenProps {
  getIdToken: () => Promise<string>;
}

const DEFAULT_LANGUAGE_CODES = ['en-US', 'es-MX'];

export function InterpreterScreen({ getIdToken }: InterpreterScreenProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [meetings, setMeetings] = useState<InterpreterMeeting[]>([]);
  const [languages, setLanguages] = useState<InterpreterLanguage[]>([]);
  const [selectedMeetingDetails, setSelectedMeetingDetails] = useState<InterpreterMeetingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);

    try {
      const idToken = await getIdToken();
      const result = await listInterpreterMeetings(idToken);

      setMeetings(result.meetings);
      setLanguages(result.supportedLanguages);
    } catch (error) {
      Alert.alert('Interpreter needs attention', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleCreateMeeting(input: InterpreterCreateDraft) {
    setIsBusy(true);

    try {
      const idToken = await getIdToken();
      const result = await createInterpreterMeeting(idToken, {
        autoDetectSourceLanguage: input.autoDetectSourceLanguage,
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
      Alert.alert('Interpreter needs attention', getErrorMessage(error));
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
      Alert.alert('Interpreter needs attention', getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStartListening(targetLanguageCode?: string | null) {
    const meeting = selectedMeetingDetails?.meeting;

    if (!meeting) {
      return;
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
      Alert.alert(
        'Interpreter ready',
        `Secure realtime session prepared with ${realtime.model}. The next device build will wire microphone streaming into this session.`
      );
    } catch (error) {
      Alert.alert('Interpreter needs attention', getErrorMessage(error));
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
      Alert.alert('Interpreter needs attention', getErrorMessage(error));
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
      Alert.alert('Interpreter needs attention', getErrorMessage(error));
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
      Alert.alert('Interpreter needs attention', getErrorMessage(error));
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
        onStartListening={handleStartListening}
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
  onStartListening: (targetLanguageCode?: string | null) => Promise<void>;
}

function InterpreterRoom({
  details,
  isBusy,
  onAddDemoTranscript,
  onBack,
  onCreateSummary,
  onEndMeeting,
  onStartListening
}: InterpreterRoomProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [draftTranscript, setDraftTranscript] = useState('');
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(details.meeting.interpreterLanguages[0]?.code || 'en-US');
  const latestTranslation = [...details.translations].reverse()
    .find((translation) => translation.targetLanguageCode === selectedLanguageCode);

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

      <View style={styles.livePanel}>
        <View style={styles.livePulse}>
          <Ionicons color={appTheme.colors.primary} name="mic-outline" size={28} />
        </View>
        <Text style={styles.liveTitle}>Controlled interpreter room</Text>
        <Text style={styles.subtitle}>
          The interpreter listens only in this meeting. Chat messages and chat media are not connected to this feature.
        </Text>
        <Pressable
          disabled={isBusy || details.meeting.status === 'ENDED'}
          onPress={() => void onStartListening(selectedLanguageCode)}
          style={({ pressed }) => [styles.primaryButtonWide, pressed && styles.pressed]}
        >
          {isBusy ? <ActivityIndicator color="#fff" /> : <Ionicons color="#fff" name="radio-outline" size={20} />}
          <Text style={styles.primaryButtonText}>Prepare live interpreter</Text>
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
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.translationCard}>
        <Text style={styles.sectionLabel}>Latest interpretation</Text>
        <Text style={styles.translationText}>
          {latestTranslation?.translatedText || 'Tap a language when the speaker finishes. The live interpreter will speak in that language.'}
        </Text>
      </View>

      <View style={styles.operatorCard}>
        <Text style={styles.sectionLabel}>Operator test console</Text>
        <Text style={styles.mutedText}>
          This console records transcript and translation records through the secured backend while native audio is being wired.
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
            onPress={() => void onCreateSummary(details.meeting.interpreterLanguages.map((language) => language.code))}
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
    </View>
  );
}

interface InterpreterCreateDraft {
  autoDetectSourceLanguage: boolean;
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
  onSubmit: (draft: InterpreterCreateDraft) => Promise<void>;
}

function InterpreterCreateModal({
  isBusy,
  isOpen,
  languages,
  onClose,
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
      Alert.alert('Meeting needs attention', 'Enter a meeting name.');
      return;
    }

    if (!draft.languageCodes.length) {
      Alert.alert('Meeting needs attention', 'Select at least one interpretation language.');
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
    disabledButton: {
      opacity: 0.58
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
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
    }
  });
}
