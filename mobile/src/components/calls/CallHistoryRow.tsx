import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SynzappCallHistoryEntry } from '../../services/localCallStore';
import { Alert, Pressable, Text, View } from 'react-native';
import { ChatContact } from '../../services/chatApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { formatChatListTime } from '../../components/contacts/ContactInfoModal';
import { formatScheduleDate, formatScheduleTime } from '../../components/chat/chatActionControls';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * A row in the call history.
 *
 * Lifted out of the chat screen unchanged.
 */

export function CallHistoryRow({
  contact,
  entry,
  isEditMode,
  onDelete,
  onStartCall,
  profilePhotoHeaders
}: {
  contact?: ChatContact;
  entry: SynzappCallHistoryEntry;
  isEditMode: boolean;
  onDelete: () => void;
  onStartCall: (contact: ChatContact) => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const isMissed = entry.status === 'missed' || entry.status === 'declined' || entry.status === 'failed';
  const statusIcon = entry.direction === 'outgoing' ? 'arrow-up-right' : entry.status === 'missed' ? 'phone-missed' : 'arrow-down-left';
  const callColor = isMissed ? appTheme.colors.red : appTheme.colors.muted;

  return (
    <View style={[
      styles.callHistoryRow,
      { borderBottomColor: appTheme.colors.separator }
    ]}>
      {isEditMode ? (
        <Pressable
          accessibilityLabel={`Remove ${entry.title} call`}
          accessibilityRole="button"
          onPress={onDelete}
          style={({ pressed }) => [styles.callHistoryDeleteButton, pressed && styles.pressed]}
        >
          <Feather color="#FFFFFF" name="minus" size={16} />
        </Pressable>
      ) : null}

      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={entry.title}
        size={46}
        uri={contact?.profilePhotoUrl || entry.profilePhotoUrl}
      />

      <View style={styles.chatText}>
        <Text
          numberOfLines={1}
          style={[
            styles.callHistoryTitle,
            { color: isMissed ? appTheme.colors.red : appTheme.colors.ink }
          ]}
        >
          {entry.title}
        </Text>
        <View style={styles.callHistorySubtitleRow}>
          <Feather color={callColor} name={statusIcon} size={13} />
          <Text numberOfLines={1} style={[styles.callHistorySubtitle, { color: callColor }]}>
            {getCallHistoryStatusLabel(entry)}
          </Text>
        </View>
      </View>

      <View style={styles.callHistoryMeta}>
        <Text numberOfLines={1} style={[styles.callHistoryTime, { color: appTheme.colors.muted }]}>
          {formatCallHistoryTime(entry.updatedAt || entry.createdAt)}
        </Text>
        <View style={styles.callHistoryActions}>
          <Pressable
            accessibilityLabel={`Call ${entry.title}`}
            accessibilityRole="button"
            disabled={!contact}
            onPress={contact ? () => onStartCall(contact) : undefined}
            style={({ pressed }) => [
              styles.callHistoryIconButton,
              { backgroundColor: appTheme.colors.surface },
              !contact && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <Ionicons color={appTheme.colors.primary} name={entry.mode === 'video' ? 'videocam' : 'call'} size={18} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Show ${entry.title} call details`}
            accessibilityRole="button"
            onPress={() => Alert.alert(entry.title, getCallHistoryDetailText(entry))}
            style={({ pressed }) => [
              styles.callHistoryInfoButton,
              pressed && styles.pressed
            ]}
          >
            <Feather color={appTheme.colors.mutedStrong} name="info" size={17} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function getCallHistoryStatusLabel(entry: SynzappCallHistoryEntry): string {
  const modeLabel = entry.mode === 'video' ? 'Video' : 'Audio';

  if (entry.status === 'answered' || entry.status === 'ended') {
    return `${entry.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} ${modeLabel}`;
  }

  if (entry.status === 'ringing') {
    return entry.direction === 'outgoing' ? `Outgoing ${modeLabel}` : `Incoming ${modeLabel}`;
  }

  if (entry.status === 'missed') {
    return 'Missed';
  }

  if (entry.status === 'declined') {
    return 'Declined';
  }

  if (entry.status === 'busy') {
    return 'Busy';
  }

  if (entry.status === 'failed') {
    return 'Failed';
  }

  return 'Canceled';
}

function getCallHistoryDetailText(entry: SynzappCallHistoryEntry): string {
  return [
    getCallHistoryStatusLabel(entry),
    `${entry.mode === 'video' ? 'Video' : 'Audio'} call`,
    formatScheduledCallDateTime(entry.createdAt)
  ].join('\n');
}

function formatCallHistoryTime(value: string): string {
  return formatChatListTime(value);
}

export function formatScheduledCallDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${formatScheduleDate(date)} at ${formatScheduleTime(date)}`;
}
