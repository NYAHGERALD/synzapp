import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ArchiveBadgeMode, ArchiveInactiveDuration, ArchiveUnarchiveBehavior, ArchiveUnreadDisplayMode, ArchivedNotificationMode, ChatArchiveSettings } from '../../services/chatApi';
import { colors } from '../../theme/colors';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Archive settings.
 *
 * Lifted out of the chat screen unchanged.
 */

type ArchiveSettingsOption<T extends string> = {
  description?: string;
  label: string;
  value: T;
};

const archivedNotificationModeOptions: Array<ArchiveSettingsOption<ArchivedNotificationMode>> = [
  { label: 'All messages', value: 'ALL_MESSAGES' },
  { label: 'Mentions only', value: 'MENTIONS_ONLY' },
  { label: 'Direct replies only', value: 'DIRECT_REPLIES_ONLY' },
  { label: 'No notifications', value: 'NONE' }
];

const archiveUnreadDisplayOptions: Array<ArchiveSettingsOption<ArchiveUnreadDisplayMode>> = [
  { label: 'Show total unread count', value: 'TOTAL_UNREAD' },
  { label: 'Show mention count only', value: 'MENTIONS_ONLY' },
  { label: 'Hide unread count', value: 'HIDE' }
];

const archiveInactiveDurationOptions: Array<ArchiveSettingsOption<ArchiveInactiveDuration>> = [
  { label: 'Never', value: 'NEVER' },
  { label: 'After 7 days', value: 'AFTER_7_DAYS' },
  { label: 'After 30 days', value: 'AFTER_30_DAYS' },
  { label: 'After 90 days', value: 'AFTER_90_DAYS' },
  { label: 'Custom duration', value: 'CUSTOM' }
];

const archiveBadgeModeOptions: Array<ArchiveSettingsOption<ArchiveBadgeMode>> = [
  { label: 'Show unread count on Archive folder', value: 'UNREAD_COUNT' },
  { label: 'Show mention count only', value: 'MENTIONS_ONLY' },
  { label: 'Hide badge', value: 'HIDE' }
];

const archiveUnarchiveBehaviorOptions: Array<ArchiveSettingsOption<ArchiveUnarchiveBehavior>> = [
  { label: 'Manual only', value: 'MANUAL_ONLY' },
  { label: 'Unarchive on new message', value: 'NEW_MESSAGE' },
  { label: 'Unarchive on mention', value: 'MENTION' },
  { label: 'Unarchive on direct reply', value: 'DIRECT_REPLY' }
];

export function ArchiveSettingsModal({
  isLoading,
  isOpen,
  isSaving,
  onClose,
  onSave,
  settings
}: {
  isLoading: boolean;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (settings: ChatArchiveSettings) => void;
  settings: ChatArchiveSettings;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ChatArchiveSettings>(settings);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
    }
  }, [isOpen, settings]);

  const updateDraft = (patch: Partial<ChatArchiveSettings>) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...patch
    }));
  };

  const updateSmartRule = (key: keyof ChatArchiveSettings['smartRules']) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      smartRules: {
        ...currentDraft.smartRules,
        [key]: !currentDraft.smartRules[key]
      }
    }));
  };

  const selectUnarchiveBehavior = (value: ArchiveUnarchiveBehavior) => {
    updateDraft({
      keepArchivedWhenNewMessagesArrive: value !== 'NEW_MESSAGE',
      unarchiveBehavior: value
    });
  };

  const selectKeepArchived = (shouldKeep: boolean) => {
    updateDraft({
      keepArchivedWhenNewMessagesArrive: shouldKeep,
      unarchiveBehavior: shouldKeep ? 'MANUAL_ONLY' : 'NEW_MESSAGE'
    });
  };

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.archiveSettingsScreen, { paddingTop: getFullScreenModalTopPadding(insets.top) }]}>
        <View style={styles.archiveSettingsHeader}>
          <Pressable
            accessibilityLabel="Close archive settings"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onClose}
            style={({ pressed }) => [styles.backButton, pressed && !isSaving && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.archiveSettingsTitle}>Archive settings</Text>
          <Pressable
            accessibilityLabel="Save archive settings"
            accessibilityRole="button"
            disabled={isSaving || isLoading}
            onPress={() => onSave(draft)}
            style={({ pressed }) => [
              styles.archiveSettingsSaveButton,
              pressed && !isSaving && !isLoading && styles.pressed,
              (isSaving || isLoading) && styles.disabled
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.archiveSettingsSaveText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.archiveSettingsContent}
          showsVerticalScrollIndicator={false}
        >
          <ArchiveSettingsSection title="Keep Archived When New Messages Arrive">
            <ArchiveOptionRow
              isSelected={draft.keepArchivedWhenNewMessagesArrive}
              label="On"
              onPress={() => selectKeepArchived(true)}
            />
            <ArchiveOptionRow
              isSelected={!draft.keepArchivedWhenNewMessagesArrive}
              label="Off (Automatically unarchive)"
              onPress={() => selectKeepArchived(false)}
            />
          </ArchiveSettingsSection>

          <ArchiveSettingsSection title="Notifications for Archived Chats">
            {archivedNotificationModeOptions.map((option) => (
              <ArchiveOptionRow
                isSelected={draft.archivedNotificationMode === option.value}
                key={option.value}
                label={option.label}
                onPress={() => updateDraft({ archivedNotificationMode: option.value })}
              />
            ))}
          </ArchiveSettingsSection>

          <ArchiveSettingsSection title="Unread Count Display">
            {archiveUnreadDisplayOptions.map((option) => (
              <ArchiveOptionRow
                isSelected={draft.unreadDisplayMode === option.value}
                key={option.value}
                label={option.label}
                onPress={() => updateDraft({ unreadDisplayMode: option.value })}
              />
            ))}
          </ArchiveSettingsSection>

          <ArchiveSettingsSection title="Auto Archive Inactive Chats">
            {archiveInactiveDurationOptions.map((option) => (
              <ArchiveOptionRow
                isSelected={draft.autoArchiveInactive === option.value}
                key={option.value}
                label={option.label}
                onPress={() => updateDraft({
                  autoArchiveInactive: option.value,
                  customAutoArchiveDays: option.value === 'CUSTOM' ? draft.customAutoArchiveDays || 30 : null
                })}
              />
            ))}
          </ArchiveSettingsSection>

          <ArchiveSettingsSection title="Archive Badge Settings">
            {archiveBadgeModeOptions.map((option) => (
              <ArchiveOptionRow
                isSelected={draft.archiveBadgeMode === option.value}
                key={option.value}
                label={option.label}
                onPress={() => updateDraft({ archiveBadgeMode: option.value })}
              />
            ))}
          </ArchiveSettingsSection>

          <ArchiveSettingsSection title="Smart Archive Rules">
            <ArchiveToggleRow
              isChecked={draft.smartRules.archiveInactiveChats}
              label="Archive inactive chats automatically"
              onPress={() => updateSmartRule('archiveInactiveChats')}
            />
            <ArchiveToggleRow
              isChecked={draft.smartRules.archiveClosedProjectGroups}
              label="Archive closed project groups"
              onPress={() => updateSmartRule('archiveClosedProjectGroups')}
            />
            <ArchiveToggleRow
              isChecked={draft.smartRules.archiveDepartedEmployeeChats}
              label="Archive chats from departed employees"
              onPress={() => updateSmartRule('archiveDepartedEmployeeChats')}
            />
            <ArchiveToggleRow
              isChecked={draft.smartRules.archiveMutedGroupsAfterTime}
              label="Archive muted groups after specified time"
              onPress={() => updateSmartRule('archiveMutedGroupsAfterTime')}
            />
          </ArchiveSettingsSection>

          <ArchiveSettingsSection title="Unarchive Behavior">
            {archiveUnarchiveBehaviorOptions.map((option) => (
              <ArchiveOptionRow
                isSelected={draft.unarchiveBehavior === option.value}
                key={option.value}
                label={option.label}
                onPress={() => selectUnarchiveBehavior(option.value)}
              />
            ))}
          </ArchiveSettingsSection>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ArchiveSettingsSection({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.archiveSettingsSection}>
      <Text style={styles.archiveSettingsSectionTitle}>{title}</Text>
      <View style={styles.archiveSettingsGroup}>
        {children}
      </View>
    </View>
  );
}

function ArchiveOptionRow({
  isSelected,
  label,
  onPress
}: {
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.archiveSettingsRow, pressed && styles.pressed]}
    >
      <Text style={styles.archiveSettingsRowText}>{label}</Text>
      <View style={[styles.archiveSettingsRadio, isSelected && styles.archiveSettingsRadioSelected]}>
        {isSelected ? <View style={styles.archiveSettingsRadioDot} /> : null}
      </View>
    </Pressable>
  );
}

function ArchiveToggleRow({
  isChecked,
  label,
  onPress
}: {
  isChecked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.archiveSettingsRow, pressed && styles.pressed]}
    >
      <Text style={styles.archiveSettingsRowText}>{label}</Text>
      <View style={[styles.archiveSettingsCheckbox, isChecked && styles.archiveSettingsCheckboxSelected]}>
        {isChecked ? <Feather color="#FFFFFF" name="check" size={14} /> : null}
      </View>
    </Pressable>
  );
}
