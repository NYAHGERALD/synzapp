import Feather from '@expo/vector-icons/Feather';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatTrashSegment } from '../../services/chatApi';
import { Modal, Pressable, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { colors } from '../../theme/colors';
import { formatChatListTime } from '../../components/contacts/ContactInfoModal';
import { getActiveTrashSegments, getTrashExpiryLabel } from '../../components/chatList/SpamChatRow';
import { styles } from '../../screens/adminChatStyles';

/**
 * Spam status controls.
 *
 * Lifted out of the chat screen unchanged.
 */

export function SpamChatStatusModal({
  chat,
  isDeleting,
  onClose,
  onDelete,
  onOpenSegment,
  profilePhotoHeaders
}: {
  chat: ChatItem | null;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: (chat: ChatItem) => void;
  onOpenSegment: (chat: ChatItem, trashSegment: ChatTrashSegment | null) => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  if (!chat) {
    return null;
  }

  const trashSegments = getActiveTrashSegments(chat);
  const legacyTrashSegment = trashSegments.length
    ? null
    : {
        deletedAt: chat.spammedAt || chat.lastMessageAt || new Date().toISOString(),
        deletedAtMs: Date.parse(chat.spammedAt || chat.lastMessageAt || new Date().toISOString()) || Date.now(),
        endAtMs: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAtMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
        segmentId: '',
        startAtMs: null
      } satisfies ChatTrashSegment;
  const visibleSegments = trashSegments.length ? trashSegments : legacyTrashSegment ? [legacyTrashSegment] : [];

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={styles.chatMoreRoot}>
        <Pressable
          accessibilityLabel="Close Trash details"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.chatMoreBackdrop}
        />
        <View style={styles.spamStatusSheet}>
          <Pressable
            accessibilityLabel="Close Trash details"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.spamStatusCloseButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="x" size={24} />
          </Pressable>

          <View style={styles.spamStatusAvatarWrap}>
            <ProfileAvatar
              headers={profilePhotoHeaders}
              name={chat.title}
              size={70}
              uri={chat.profilePhotoUrl}
            />
            <View style={styles.spamStatusBadge}>
              <Feather color="#DC2626" name="slash" size={18} />
            </View>
          </View>

          <Text numberOfLines={2} style={styles.spamStatusTitle}>
            {chat.title}
          </Text>

          <View style={styles.spamStatusInfoList}>
            {visibleSegments.map((segment, index) => (
              <Pressable
                accessibilityLabel={`Open deleted history ${index + 1}`}
                accessibilityRole="button"
                key={segment.segmentId || `legacy_${index}`}
                onPress={() => onOpenSegment(chat, segment.segmentId ? segment : null)}
                style={({ pressed }) => [styles.spamStatusInfoRow, pressed && styles.pressed]}
              >
                <Feather color="#64748B" name="clock" size={18} />
                <View style={styles.chatText}>
                  <Text style={styles.spamStatusInfoText}>
                    {formatTrashSegmentTitle(segment, index)}
                  </Text>
                  <Text style={styles.spamChatSubtitle}>
                    {getTrashExpiryLabel(segment.expiresAtMs)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityLabel={`Open latest Trash history for ${chat.title}`}
            accessibilityRole="button"
            onPress={() => onOpenSegment(chat, visibleSegments[0]?.segmentId ? visibleSegments[0] : null)}
            style={({ pressed }) => [styles.spamStatusOkButton, pressed && styles.pressed]}
          >
            <Text style={styles.spamStatusOkText}>View history</Text>
          </Pressable>

          <Pressable
            accessibilityLabel={`Permanently delete ${chat.title}`}
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={() => onDelete(chat)}
            style={({ pressed }) => [
              styles.spamStatusDeleteButton,
              pressed && !isDeleting && styles.pressed,
              isDeleting && styles.disabled
            ]}
          >
            <Text style={styles.spamStatusDeleteText}>
              {isDeleting ? 'Deleting...' : chat.chatType === 'GROUP' ? 'Delete group' : 'Delete chat'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatTrashSegmentTitle(segment: ChatTrashSegment, index: number): string {
  const deletedDate = new Date(segment.deletedAtMs);
  const dateLabel = Number.isFinite(deletedDate.getTime())
    ? formatChatListTime(deletedDate.toISOString())
    : `Deleted history ${index + 1}`;

  return `Deleted ${dateLabel}`;
}
