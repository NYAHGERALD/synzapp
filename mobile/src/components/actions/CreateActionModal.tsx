import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';
import type { ActionPriority } from '../../services/actionApi';
import { describePriority, priorityColor } from '../../services/actionDisplay';
import { CircleIconButton } from '../ui/CircleIconButton';
import {
  MAX_ATTACHMENTS,
  describeTooLarge,
  isTooLarge,
  pickActionMedia,
  takeActionPhoto,
  type PickedActionMedia
} from '../../services/actionAttachments';
import { AppSwitch } from '../ui/AppSwitch';
import { ChoicePickerModal } from '../ui/ChoicePickerModal';

export interface ActionGroupChoice {
  departmentId: string | null;
  groupId: string;
  memberCount: number;
  name: string;
}

export interface ActionPersonChoice {
  departmentId: string | null;
  departmentName: string;
  displayName: string;
  uid: string;
}

export interface CreateActionDraft {
  attachments: PickedActionMedia[];
  dueAtMs: number | null;
  priority: ActionPriority;
  responsibleGroupId: string | null;
  responsiblePersonUid: string | null;
  title: string;
}

const PRIORITIES: ActionPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// Android needs this switched on before any layout animation will run.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Short and soft. Anything longer reads as the screen being slow. */
function animateNext() {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );
}

/**
 * Turning a message into an action.
 *
 * Full height, because choosing who owns a fault is not a one-tap decision and
 * a cramped sheet is where people pick the first name they see.
 *
 * Two rules shape this screen:
 *
 *  - **The group is required, the person is optional.** An action owned by one
 *    name dies when that person is off sick. The group always sees it.
 *  - **The person is told this becomes a company record**, in plain words,
 *    before they send. The chat it came from is sealed; this is not.
 */
export function CreateActionModal({
  groups,
  isLoadingChoices,
  isSaving,
  onClose,
  onCreate,
  people,
  sourceChatName,
  sourceMessageText,
  visible
}: {
  groups: ActionGroupChoice[];
  /** Whether the teams and people lists are still being fetched. */
  isLoadingChoices: boolean;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (draft: CreateActionDraft) => void;
  people: ActionPersonChoice[];
  sourceChatName: string;
  sourceMessageText: string;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [title, setTitle] = useState(sourceMessageText);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [personUid, setPersonUid] = useState<string | null>(null);
  // Whether an owner has actually been decided, as opposed to not looked at.
  // Both answers are valid — a name, or the whole team — but neither is the
  // default. An action that nobody chose an owner for is an action nobody picks
  // up, and "everyone's job is nobody's job" is how work goes quietly missing.
  const [hasChosenOwner, setHasChosenOwner] = useState(false);
  const [priority, setPriority] = useState<ActionPriority>('MEDIUM');
  const [hasDueDate, setHasDueDate] = useState(false);
  // A real date rather than a number of days. "In 14 days" is never the date
  // somebody actually meant, and it is the sort of thing people accept because
  // it is the only option offered.
  const [dueAt, setDueAt] = useState(() => defaultDueDate());
  const [isIosDuePickerOpen, setIsIosDuePickerOpen] = useState(false);
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const [isPersonPickerOpen, setIsPersonPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState<PickedActionMedia[]>([]);

  useEffect(() => {
    if (visible) {
      setTitle(sourceMessageText);
      setGroupId(null);
      setPersonUid(null);
      setHasChosenOwner(false);
      setPriority('MEDIUM');
      setHasDueDate(false);
      setDueAt(defaultDueDate());
      setIsIosDuePickerOpen(false);
      setAttachments([]);
    }
  }, [sourceMessageText, visible]);

  const selectedGroup = groups.find((group) => group.groupId === groupId) || null;
  const selectedPerson = people.find((person) => person.uid === personUid) || null;

  const groupOptions = useMemo(() => groups.map((group) => ({
    id: group.groupId,
    meta: group.memberCount === 1 ? '1 person' : `${group.memberCount} people`,
    name: group.name
  })), [groups]);

  /**
   * People, with the chosen team's department first.
   *
   * That is normally who is meant, and the rest stay reachable rather than
   * hidden — an action given to the wrong person because the right one was
   * three screens down is worse than a longer list.
   */
  const personOptions = useMemo(() => {
    const ordered = selectedGroup?.departmentId
      ? [...people].sort((left, right) => {
        const leftMatches = left.departmentId === selectedGroup.departmentId ? 0 : 1;
        const rightMatches = right.departmentId === selectedGroup.departmentId ? 0 : 1;

        return leftMatches - rightMatches;
      })
      : people;

    return ordered.map((person) => ({
      id: person.uid,
      meta: person.departmentName,
      name: person.displayName
    }));
  }, [people, selectedGroup]);

  /**
   * Adds what was picked, refusing anything over the limit here rather than
   * after the person has waited for it to upload.
   */
  const addMedia = async (source: Promise<PickedActionMedia[]>) => {
    try {
      const picked = await source;
      const tooBig = picked.filter(isTooLarge);
      const usable = picked.filter((item) => !isTooLarge(item));

      if (tooBig.length) {
        Alert.alert('Too large', tooBig.map(describeTooLarge).join('\n'));
      }

      animateNext();
      setAttachments((current) => [...current, ...usable].slice(0, MAX_ATTACHMENTS));
    } catch (error) {
      Alert.alert(
        'Cannot open',
        error instanceof Error ? error.message : 'That could not be opened.'
      );
    }
  };

  const canSend = Boolean(title.trim().length >= 2 && groupId && hasChosenOwner) && !isSaving;

  function openDuePicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'calendar',
        minimumDate: new Date(),
        mode: 'date',
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            setDueAt(selectedDate);
          }
        },
        value: dueAt
      });

      return;
    }

    setIsIosDuePickerOpen((current) => !current);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View style={styles.sheet}>
        <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
          <CircleIconButton action="close" disabled={isSaving} label="Cancel" onPress={onClose} />
          <Text style={styles.headTitle}>Create Action</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!canSend}
            onPress={() => onCreate({
              attachments,
              dueAtMs: hasDueDate ? endOfDay(dueAt).getTime() : null,
              priority,
              responsibleGroupId: groupId,
              responsiblePersonUid: personUid,
              title: title.trim()
            })}
          >
            {isSaving ? (
              <ActivityIndicator color={appTheme.colors.link} />
            ) : (
              <Text style={[styles.headAction, !canSend && styles.dimmed]}>Create</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={styles.grow}
        >
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>What needs doing</Text>
          <View style={styles.card}>
            <TextInput
              editable={!isSaving}
              multiline
              onChangeText={setTitle}
              placeholder="Describe the problem"
              placeholderTextColor={appTheme.colors.muted}
              style={styles.titleInput}
              textAlignVertical="top"
              value={title}
            />
          </View>
          <Text style={styles.footnote}>
            Taken from the message in {sourceChatName || 'this chat'}. You can change it.
          </Text>

          <Text style={styles.sectionTitle}>Who is responsible</Text>
          <View style={styles.card}>
            {/* A link, not a list. Teams are something a company keeps adding
                to, and the version that showed every one of them inline was a
                form nobody could reach the bottom of. */}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => setIsGroupPickerOpen(true)}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.linkLabel}>Team</Text>
                <Text numberOfLines={1} style={selectedGroup ? styles.linkValue : styles.linkValueEmpty}>
                  {selectedGroup ? selectedGroup.name : 'Choose a team'}
                </Text>
              </View>
              <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => setIsPersonPickerOpen(true)}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.linkLabel}>Who will do it</Text>
                <Text numberOfLines={1} style={hasChosenOwner ? styles.linkValue : styles.linkValueEmpty}>
                  {hasChosenOwner
                    ? (selectedPerson ? selectedPerson.displayName : 'Anyone on the team')
                    : 'Choose someone'}
                </Text>
              </View>
              <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
            </Pressable>
          </View>
          <Text style={styles.footnote}>
            Both are needed. Naming someone is what gets an action picked up — and
            if you truly do not know who is on shift, choose "Anyone on the team"
            rather than guessing. A department admin can move it later, and both
            people will see why.
          </Text>

          <Text style={styles.sectionTitle}>How urgent</Text>
          <View style={styles.card}>
            {PRIORITIES.map((value, index) => (
              <React.Fragment key={value}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: value === priority }}
                  disabled={isSaving}
                  onPress={() => setPriority(value)}
                  style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
                >
                  <View style={styles.priorityDot}>
                    <View style={[
                      styles.priorityDotInner,
                      { backgroundColor: priorityColor(value, appTheme.isDark) }
                    ]} />
                  </View>
                  <Text style={styles.rowName}>{describePriority(value)}</Text>
                  <View style={styles.rowText} />
                  {value === priority ? (
                    <Feather color={appTheme.colors.link} name="check" size={19} />
                  ) : null}
                </Pressable>
              </React.Fragment>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Photos or video</Text>
          {attachments.length ? (
            <View style={styles.thumbs}>
              {attachments.map((item, index) => (
                <View key={`${item.uri}-${index}`} style={styles.thumbWrap}>
                  <Image source={{ uri: item.uri }} style={styles.thumb} />
                  {item.kind === 'video' ? (
                    <View style={styles.videoBadge}>
                      <Feather color="#FFFFFF" name="video" size={11} />
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityLabel={`Remove ${item.fileName}`}
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() => {
                      animateNext();
                      setAttachments(
                        (current) => current.filter((_, position) => position !== index)
                      );
                    }}
                    style={styles.thumbRemove}
                  >
                    <Feather color="#FFFFFF" name="x" size={12} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving || attachments.length >= MAX_ATTACHMENTS}
              onPress={() => void addMedia(pickActionMedia(MAX_ATTACHMENTS - attachments.length))}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Feather color={appTheme.colors.link} name="image" size={19} />
              <Text style={styles.linkAction}>Choose photos</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              disabled={isSaving || attachments.length >= MAX_ATTACHMENTS}
              onPress={() => void addMedia(takeActionPhoto())}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Feather color={appTheme.colors.link} name="camera" size={19} />
              <Text style={styles.linkAction}>Take a photo</Text>
            </Pressable>
          </View>
          <Text style={styles.footnote}>
            Optional. A photo of the fault saves the next person a walk.
          </Text>

          <Text style={styles.sectionTitle}>Give it a date</Text>
          <View style={styles.card}>
            <View style={styles.linkRow}>
              <Text style={styles.rowName}>Due date</Text>
              <View style={styles.rowText} />
              <AppSwitch
                disabled={isSaving}
                onValueChange={(next) => {
                  animateNext();
                  setHasDueDate(next);
                }}
                value={hasDueDate}
              />
            </View>
            {hasDueDate ? (
              <>
                <View style={styles.divider} />
                {/* The phone's own picker, not a row of guesses. "In 14 days"
                    is never the date somebody actually meant. */}
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={openDuePicker}
                  style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
                >
                  <Feather color={appTheme.colors.link} name="calendar" size={19} />
                  <Text style={styles.linkAction}>{formatDueDate(dueAt)}</Text>
                </Pressable>
                {isIosDuePickerOpen ? (
                  <View style={styles.inlinePicker}>
                    <DateTimePicker
                      display="inline"
                      minimumDate={new Date()}
                      mode="date"
                      onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
                        if (selectedDate) {
                          setDueAt(selectedDate);
                        }
                      }}
                      value={dueAt}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
          <Text style={styles.footnote}>
            Optional. A date is what makes something show up as late.
          </Text>

          {/* Said plainly, before sending, not buried in settings. The chat this
              came from is sealed; the action is not. */}
          <View style={styles.notice}>
            <Feather color={appTheme.colors.mutedStrong} name="info" size={15} />
            <Text style={styles.noticeText}>
              This becomes a company record. Your organization can see it, keep it,
              and include it in an audit.
            </Text>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>

        <ChoicePickerModal
          emptyText="No teams here yet."
          isLoading={isLoadingChoices}
          onClose={() => setIsGroupPickerOpen(false)}
          onSelect={(id) => setGroupId(id)}
          options={groupOptions}
          searchPlaceholder="Search teams"
          selectedId={groupId}
          subtitle="The team that owns the fix."
          title="Who is responsible"
          visible={isGroupPickerOpen}
        />

        <ChoicePickerModal
          emptyText="No people here yet."
          isLoading={isLoadingChoices}
          noneLabel="Anyone on the team"
          onClose={() => setIsPersonPickerOpen(false)}
          onSelect={(id) => {
            setPersonUid(id);
            setHasChosenOwner(true);
          }}
          options={personOptions}
          searchPlaceholder="Search people"
          selectedId={personUid}
          subtitle="Name someone, or hand it to the whole team."
          title="Who will do it"
          visible={isPersonPickerOpen}
        />
      </View>
    </Modal>
  );
}

/**
 * Tomorrow, which is what most actions are given.
 *
 * Only a starting point for the picker — the person chooses the real date.
 */
function defaultDueDate(): Date {
  const at = new Date();

  at.setDate(at.getDate() + 1);

  return at;
}

/**
 * The end of the chosen day.
 *
 * A due date means "by the end of that day", not "by the moment I happened to
 * be looking at the picker". Storing the instant of selection makes something
 * late from lunchtime onwards for no reason anybody could explain.
 */
function endOfDay(at: Date): Date {
  const end = new Date(at.getTime());

  end.setHours(23, 59, 59, 999);

  return end;
}

function formatDueDate(at: Date): string {
  return at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: at.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  });
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.groupedBackground,
      flex: 1
    },
    grow: {
      flex: 1
    },
    // The header carries no line and no card of its own. A separator there
    // makes it read as a bar bolted onto the page rather than the top of it.
    head: {
      alignItems: 'center',
      backgroundColor: colors.groupedBackground,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    headTitle: {
      color: colors.ink,
      fontSize: 17
    },
    body: {
      paddingHorizontal: 16,
      paddingTop: 4
    },
    sectionTitle: {
      color: colors.mutedStrong,
      fontSize: 13,
      letterSpacing: 0.2,
      marginBottom: 8,
      marginTop: 22,
      paddingHorizontal: 4
    },
    card: {
      backgroundColor: colors.groupedCard,
      borderRadius: 14,
      overflow: 'hidden'
    },
    divider: {
      backgroundColor: colors.separator,
      height: StyleSheet.hairlineWidth,
      marginLeft: 16
    },
    footnote: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 8,
      paddingHorizontal: 4
    },
    titleInput: {
      color: colors.ink,
      fontSize: 16.5,
      lineHeight: 22,
      minHeight: 92,
      padding: 16
    },
    linkRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 13
    },
    rowText: {
      flex: 1
    },
    rowName: {
      color: colors.ink,
      fontSize: 16
    },
    linkLabel: {
      color: colors.muted,
      fontSize: 12.5
    },
    linkValue: {
      color: colors.ink,
      fontSize: 16,
      marginTop: 2
    },
    linkValueEmpty: {
      color: colors.link,
      fontSize: 16,
      marginTop: 2
    },
    // Text, in the link colour. Nothing on this screen is a filled button.
    linkAction: {
      color: colors.link,
      flex: 1,
      fontSize: 16
    },
    priorityDot: {
      alignItems: 'center',
      height: 20,
      justifyContent: 'center',
      width: 20
    },
    priorityDotInner: {
      borderRadius: 5,
      height: 10,
      width: 10
    },
    inlinePicker: {
      alignItems: 'center',
      paddingBottom: 8
    },
    thumbs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 10
    },
    thumbWrap: {
      height: 74,
      width: 74
    },
    thumb: {
      borderRadius: 12,
      height: 74,
      width: 74
    },
    videoBadge: {
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 9,
      bottom: 5,
      left: 5,
      padding: 3,
      position: 'absolute'
    },
    thumbRemove: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      position: 'absolute',
      right: -4,
      top: -4,
      width: 20
    },
    notice: {
      alignItems: 'flex-start',
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 10,
      marginTop: 24,
      padding: 14
    },
    noticeText: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: 13.5,
      lineHeight: 19
    },
    // Text, not a filled circle. Nothing on this screen is a solid button, and
    // the confirm action is the one that most invites becoming one.
    headAction: {
      color: colors.link,
      fontSize: 17,
      paddingHorizontal: 4,
      paddingVertical: 6
    },
    dimmed: {
      opacity: 0.4
    },
    pressed: {
      opacity: 0.6
    }
  });
}
