import Feather from '@expo/vector-icons/Feather';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { formatByteCount } from '../../services/chatDisplayFormatting';
import { styles } from '../../screens/adminChatStyles';

/**
 * Clearing a conversation.
 *
 * Lifted out of the chat screen unchanged.
 */

export interface ClearChatSummary {
  mediaFileCount: number;
  mediaSizeBytes: number;
  messageCount: number;
  textSizeBytes: number;
  totalSizeBytes: number;
}

export function ClearChatModal({
  chat,
  isClearing,
  onClearMediaFiles,
  onClearMessages,
  onClose,
  summary
}: {
  chat: ChatItem | null;
  isClearing: boolean;
  onClearMediaFiles: (chat: ChatItem) => void;
  onClearMessages: (chat: ChatItem) => void;
  onClose: () => void;
  summary: ClearChatSummary;
}) {
  if (!chat) {
    return null;
  }

  const mediaLabel = summary.mediaFileCount === 0
    ? 'No media files on this device'
    : summary.mediaFileCount === 1
    ? 'Clear 1 media file'
    : summary.mediaFileCount > 1
      ? `Clear ${summary.mediaFileCount} media files`
      : 'Clear media files';
  const messageLabel = summary.messageCount === 1
    ? 'Clear 1 message'
    : summary.messageCount > 1
      ? `Clear ${summary.messageCount} messages`
      : 'Clear all messages';

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={styles.chatMoreRoot}>
        <Pressable
          accessibilityLabel="Close clear chat"
          accessibilityRole="button"
          disabled={isClearing}
          onPress={onClose}
          style={styles.chatMoreBackdrop}
        />
        <View style={styles.clearChatSheet}>
          <View style={styles.chatMoreHandle} />
          <View style={styles.chatMoreHeader}>
            <Text numberOfLines={1} style={styles.chatMoreTitle}>Clear chat</Text>
            <Pressable
              accessibilityLabel="Close clear chat"
              accessibilityRole="button"
              disabled={isClearing}
              onPress={onClose}
              style={({ pressed }) => [
                styles.chatMoreCloseButton,
                pressed && !isClearing && styles.pressed,
                isClearing && styles.disabled
              ]}
            >
              <Feather color={colors.ink} name="x" size={22} />
            </Pressable>
          </View>

          <Text numberOfLines={2} style={styles.clearChatDescription}>
            This only clears {chat.title} for your account. Other members keep their copy.
          </Text>

          <View style={styles.chatMoreActionGroup}>
            <ClearChatActionRow
              disabled={isClearing || summary.mediaSizeBytes <= 0}
              icon="image"
              label={mediaLabel}
              onPress={() => onClearMediaFiles(chat)}
              sizeLabel={formatByteCount(summary.mediaSizeBytes)}
            />
            <ClearChatActionRow
              destructive
              disabled={isClearing}
              icon="x-circle"
              label={messageLabel}
              onPress={() => onClearMessages(chat)}
              sizeLabel={formatByteCount(summary.totalSizeBytes)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ClearChatActionRow({
  destructive,
  disabled,
  icon,
  label,
  onPress,
  sizeLabel
}: {
  destructive?: boolean;
  disabled?: boolean;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  sizeLabel: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.clearChatActionRow,
        pressed && !disabled && styles.pressed,
        disabled && styles.clearChatActionRowDisabled
      ]}
    >
      <View style={[styles.clearChatActionIcon, destructive && styles.clearChatActionIconDestructive]}>
        <Feather color={destructive ? '#DC2626' : colors.primary} name={icon} size={20} />
      </View>
      <Text style={[styles.clearChatActionText, destructive && styles.clearChatActionTextDestructive]}>
        {label}
      </Text>
      <Text style={styles.clearChatActionSize}>{sizeLabel}</Text>
    </Pressable>
  );
}
