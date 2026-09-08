import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import type { ActionPersonChoice } from './CreateActionModal';
import {
  ACTION_REASSIGNMENT_REASONS,
  type ActionReassignmentReasonId,
  canSubmitReassignment
} from '../../services/actionReassignmentOptions';
import { ChoicePickerModal } from '../ui/ChoicePickerModal';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Handing an action to somebody else.
 *
 * The safety valve on a harder rule. Actions now carry a name, which is what
 * makes them get done — and a name that cannot be changed is what makes them
 * get stuck, because shifts end and people go on leave. So this is deliberately
 * two taps from the action itself.
 *
 * The reason is required and both people read it. Presets come first because a
 * required free-text box gets "n/a" typed into it; the text box is there for
 * the times a preset genuinely says nothing.
 */

export function ReassignActionModal({
  currentPersonName,
  currentPersonUid,
  isSaving,
  onClose,
  onReassign,
  people,
  visible
}: {
  currentPersonName: string | null;
  currentPersonUid: string | null;
  isSaving: boolean;
  onClose: () => void;
  onReassign: (input: {
    detail: string;
    nextPersonUid: string | null;
    reasonId: ActionReassignmentReasonId;
  }) => void;
  people: ActionPersonChoice[];
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [nextPersonUid, setNextPersonUid] = useState<string | null>(currentPersonUid);
  const [reasonId, setReasonId] = useState<ActionReassignmentReasonId | null>(null);
  const [detail, setDetail] = useState('');
  const [isPersonPickerOpen, setIsPersonPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setNextPersonUid(currentPersonUid);
      setReasonId(null);
      setDetail('');
      setIsPersonPickerOpen(false);
    }
  }, [currentPersonUid, visible]);

  const nextPerson = people.find((person) => person.uid === nextPersonUid) || null;
  const isChangingPerson = nextPersonUid !== currentPersonUid;
  const canSend = canSubmitReassignment({
    detail,
    isChangingPerson,
    nextPersonUid,
    reasonId
  }) && !isSaving;
  const personOptions = useMemo(() => people
    .filter((person) => person.uid !== currentPersonUid)
    .map((person) => ({
      id: person.uid,
      meta: person.departmentName,
      name: person.displayName
    })), [currentPersonUid, people]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View style={styles.sheet}>
        <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
          <Pressable
            accessibilityLabel="Cancel"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onClose}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.headCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headTitle}>Move this action</Text>
          <Pressable
            accessibilityLabel="Move this action"
            accessibilityRole="button"
            disabled={!canSend}
            onPress={() => {
              if (reasonId) {
                onReassign({ detail: detail.trim(), nextPersonUid, reasonId });
              }
            }}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            {isSaving ? (
              <ActivityIndicator color={appTheme.colors.link} />
            ) : (
              <Text style={[styles.headAction, !canSend && styles.dimmed]}>Move</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.grow}
        >
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Who has it now</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowValueMuted}>
                  {currentPersonName || 'Anyone on the team'}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Give it to</Text>
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => setIsPersonPickerOpen(true)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={[styles.rowValue, !isChangingPerson && styles.rowValuePlaceholder]}>
                  {nextPerson ? nextPerson.displayName : 'Anyone on the team'}
                </Text>
                <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
              </Pressable>
              {currentPersonUid ? (
                <>
                  <View style={styles.divider} />
                  {/* The 2am case: the person cannot do it and does not know who
                      is on shift. Better an honest queue than a guessed name. */}
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving || !nextPersonUid}
                    onPress={() => setNextPersonUid(null)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text style={[styles.rowAction, !nextPersonUid && styles.dimmed]}>
                      Hand it back to the whole team
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>Why</Text>
            <View style={styles.card}>
              {ACTION_REASSIGNMENT_REASONS.map((option, index) => (
                <React.Fragment key={option.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: option.id === reasonId }}
                    disabled={isSaving}
                    onPress={() => setReasonId(option.id)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text style={styles.rowValue}>{option.label}</Text>
                    {option.id === reasonId ? (
                      <Feather color={appTheme.colors.link} name="check" size={19} />
                    ) : null}
                  </Pressable>
                </React.Fragment>
              ))}
            </View>

            <View style={styles.detailWrap}>
              <TextInput
                editable={!isSaving}
                multiline
                onChangeText={setDetail}
                placeholder={reasonId === 'OTHER' ? 'Say what the reason is' : 'Add anything useful (optional)'}
                placeholderTextColor={appTheme.colors.muted}
                style={styles.detailInput}
                textAlignVertical="top"
                value={detail}
              />
            </View>
            <Text style={styles.footnote}>
              {currentPersonName || 'The team'} and whoever gets it will both see this reason.
              The move is kept in the action's history.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>

        <ChoicePickerModal
          emptyText="No people here yet."
          noneLabel="Anyone on the team"
          onClose={() => setIsPersonPickerOpen(false)}
          onSelect={setNextPersonUid}
          options={personOptions}
          searchPlaceholder="Search people"
          selectedId={nextPersonUid}
          subtitle="Whoever picks this up next."
          title="Give it to"
          visible={isPersonPickerOpen}
        />
      </View>
    </Modal>
  );
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
    headCancel: {
      color: colors.link,
      fontSize: 17
    },
    headAction: {
      color: colors.link,
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
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 50,
      paddingHorizontal: 16,
      paddingVertical: 13
    },
    rowValue: {
      color: colors.ink,
      flex: 1,
      fontSize: 16
    },
    rowValueMuted: {
      color: colors.muted,
      flex: 1,
      fontSize: 16
    },
    rowValuePlaceholder: {
      color: colors.link
    },
    rowAction: {
      color: colors.link,
      flex: 1,
      fontSize: 16
    },
    detailWrap: {
      backgroundColor: colors.groupedCard,
      borderRadius: 14,
      marginTop: 10,
      overflow: 'hidden'
    },
    detailInput: {
      color: colors.ink,
      fontSize: 16,
      lineHeight: 21,
      minHeight: 88,
      padding: 16
    },
    footnote: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 8,
      paddingHorizontal: 4
    },
    dimmed: {
      opacity: 0.4
    },
    pressed: {
      opacity: 0.6
    }
  });
}
