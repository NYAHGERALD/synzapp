import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { Pressable, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { androidIconRipple } from '../../components/chatUiPrimitives';
import { formatGroupOnlineCount } from '../../components/calls/GroupCallPeopleModal';
import { styles } from '../../screens/adminChatStyles';

/**
 * The chat header.
 *
 * Lifted out of the chat screen unchanged.
 */

export function MessageHeader({
  chat,
  messageCount,
  onlineCount,
  onBack,
  onOpenContactInfo,
  onOpenGroupCallOptions,
  onOpenGroupInfo,
  onOpenGroupPeoplePicker,
  onStartVideoCall,
  onStartVoiceCall,
  profilePhotoHeaders
}: {
  chat: ChatItem;
  messageCount: number;
  onlineCount: number;
  onBack: () => void;
  onOpenContactInfo: () => void;
  onOpenGroupCallOptions: () => void;
  onOpenGroupInfo: () => void;
  onOpenGroupPeoplePicker: () => void;
  onStartVideoCall: () => void;
  onStartVoiceCall: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const isGroupChat = chat.chatType === 'GROUP';
  const messageCountLabel = formatCompactCount(messageCount);
  const presenceText = chat.chatType === 'GROUP'
    ? formatGroupOnlineCount(onlineCount)
    : chat.isOnline
      ? 'online'
      : '';

  return (
    <View style={styles.messageHeader}>
      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel="Back to chats"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.messageBackButton, pressed && styles.pressed]}
      >
        <Text style={styles.messageBackText}>‹</Text>
        {messageCount > 0 ? (
          <Text
            accessibilityLabel={`${messageCount} messages in this chat`}
            numberOfLines={1}
            style={styles.messageBackCountText}
          >
            {messageCountLabel}
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityLabel={isGroupChat ? 'Open group info' : 'Open contact info'}
        accessibilityRole="button"
        onPress={isGroupChat ? onOpenGroupInfo : onOpenContactInfo}
        style={({ pressed }) => [
          styles.messageHeaderIdentity,
          pressed && styles.pressed
        ]}
      >
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={chat.title}
          size={46}
          uri={chat.profilePhotoUrl}
        />

        <View style={styles.messageHeaderText}>
          <Text numberOfLines={1} style={styles.messageHeaderTitle}>{chat.title}</Text>
          {presenceText ? (
            <Text numberOfLines={1} style={styles.messageHeaderPresence}>{presenceText}</Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.messageHeaderActions}>
        {isGroupChat ? (
          <Pressable
            android_ripple={androidIconRipple}
            accessibilityLabel="Select people"
            accessibilityRole="button"
            onPress={onOpenGroupPeoplePicker}
            style={({ pressed }) => [styles.messageHeaderIcon, pressed && styles.pressed]}
          >
            <Ionicons color="#FFFFFF" name="person-add" size={24} />
          </Pressable>
        ) : null}
        <Pressable
          android_ripple={androidIconRipple}
          accessibilityLabel={isGroupChat ? 'Open group call options' : 'Video call'}
          accessibilityRole="button"
          onPress={isGroupChat ? onOpenGroupCallOptions : onStartVideoCall}
          style={({ pressed }) => [styles.messageHeaderIcon, pressed && styles.pressed]}
        >
          <View style={styles.messageHeaderVideoIcon}>
            <Ionicons color="#FFFFFF" name="videocam" size={26} />
            {isGroupChat ? <Feather color="#FFFFFF" name="chevron-down" size={14} /> : null}
          </View>
        </Pressable>
        {!isGroupChat ? (
          <Pressable
            android_ripple={androidIconRipple}
            accessibilityLabel="Call"
            accessibilityRole="button"
            onPress={onStartVoiceCall}
            style={({ pressed }) => [styles.messageHeaderIcon, pressed && styles.pressed]}
          >
            <Ionicons color="#FFFFFF" name="call" size={25} />
          </Pressable>
        ) : null}
        <Pressable
          android_ripple={androidIconRipple}
          accessibilityLabel="More"
          accessibilityRole="button"
          onPress={isGroupChat ? onOpenGroupCallOptions : onOpenContactInfo}
          style={({ pressed }) => [styles.messageHeaderIcon, pressed && styles.pressed]}
        >
          <Ionicons color="#FFFFFF" name="ellipsis-vertical" size={27} />
        </Pressable>
      </View>
    </View>
  );
}

function formatCompactCount(value: number): string {
  const safeValue = Math.max(0, Math.floor(value));

  if (safeValue > 99) {
    return '99+';
  }

  return String(safeValue);
}
