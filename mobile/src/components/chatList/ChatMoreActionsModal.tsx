import Feather from '@expo/vector-icons/Feather';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { Modal, Pressable, Text, View } from 'react-native';
import { canUseChatListActions } from '../../components/chatList/ChatRow';
import { colors } from '../../theme/colors';
import { styles } from '../../screens/adminChatStyles';

/**
 * The chat overflow menu.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ChatMoreActionsModal({
  chat,
  onArchive,
  onClear,
  onClose,
  onDelete,
  onOpenInfo,
  onToggleFavorite,
  onTogglePin
}: {
  chat: ChatItem | null;
  onArchive: (chat: ChatItem) => void;
  onClear: (chat: ChatItem) => void;
  onClose: () => void;
  onDelete: (chat: ChatItem) => void;
  onOpenInfo: (chat: ChatItem) => void;
  onToggleFavorite: (chat: ChatItem) => void;
  onTogglePin: (chat: ChatItem) => void;
}) {
  if (!chat) {
    return null;
  }

  const infoLabel = chat.chatType === 'GROUP' ? 'Group info' : 'Contact Info';
  const canUseLifecycleActions = canUseChatListActions(chat);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={styles.chatMoreRoot}>
        <Pressable
          accessibilityLabel="Close chat actions"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.chatMoreBackdrop}
        />
        <View style={styles.chatMoreSheet}>
          <View style={styles.chatMoreHandle} />
          <View style={styles.chatMoreHeader}>
            <Text numberOfLines={1} style={styles.chatMoreTitle}>{chat.title}</Text>
            <Pressable
              accessibilityLabel="Close chat actions"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.chatMoreCloseButton, pressed && styles.pressed]}
            >
              <Feather color={colors.ink} name="x" size={22} />
            </Pressable>
          </View>

          <View style={styles.chatMoreActionGroup}>
            <ChatMoreActionRow
              icon={chat.chatType === 'GROUP' ? 'users' : 'user'}
              label={infoLabel}
              onPress={() => onOpenInfo(chat)}
            />
            <ChatMoreActionRow
              icon="star"
              label={chat.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              onPress={() => onToggleFavorite(chat)}
            />
            <ChatMoreActionRow
              icon="map-pin"
              label={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
              onPress={() => onTogglePin(chat)}
            />
            {canUseLifecycleActions ? (
              <>
                <ChatMoreActionRow
                  icon={chat.isArchived ? 'inbox' : 'archive'}
                  label={chat.isArchived ? 'Unarchive chat' : 'Archive chat'}
                  onPress={() => {
                    onArchive(chat);
                    onClose();
                  }}
                />
                <ChatMoreActionRow
                  icon="trash"
                  label="Clear Chat"
                  onPress={() => onClear(chat)}
                />
                <ChatMoreActionRow
                  destructive
                  icon="trash-2"
                  label="Delete"
                  onPress={() => onDelete(chat)}
                />
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ChatMoreActionRow({
  destructive,
  icon,
  label,
  onPress
}: {
  destructive?: boolean;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chatMoreActionRow, pressed && styles.pressed]}
    >
      <View style={[styles.chatMoreActionIcon, destructive && styles.chatMoreActionIconDestructive]}>
        <Feather color={destructive ? '#DC2626' : colors.primary} name={icon} size={20} />
      </View>
      <Text style={[styles.chatMoreActionText, destructive && styles.chatMoreActionTextDestructive]}>
        {label}
      </Text>
    </Pressable>
  );
}
