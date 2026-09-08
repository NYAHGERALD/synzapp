import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { formatGroupOnlineCount } from '../../components/calls/GroupCallPeopleModal';
import { useAppTheme } from '../../theme/AppThemeProvider';

/** How much room the conversation leaves for the header it scrolls under. */
export const MESSAGE_HEADER_HEIGHT = 64;

/**
 * The chat header.
 *
 * A card that floats over the conversation rather than a bar painted across the
 * top of it: card white, a blue outline, fully rounded ends and a shadow under
 * it. It is taken out of the layout entirely and laid over the thread, so the
 * messages pass beneath it as they scroll — which is what makes it read as
 * floating rather than as a card that happens to sit above a list.
 *
 * The room it needs is given back through `MESSAGE_HEADER_HEIGHT`, which the
 * thread adds to the top of its own content so the first message is not born
 * underneath it.
 *
 * Everything inside is therefore ink and link blue. White on brand green was
 * the old bar's doing, and none of it would be legible on a white card.
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
  profilePhotoHeaders,
  topOffset = 0,
  typingText
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
  /**
   * Where the top of the card sits.
   *
   * It is out of the flow, and an absolutely positioned child does not inherit
   * its parent's top padding — so without this it lands at the very top of the
   * window and covers the status bar. The screen owns the number, because the
   * screen is what knows the device's top inset.
   */
  topOffset?: number;
  /** Shown in place of presence while somebody is writing. */
  typingText?: string | null;
}) {
  const appTheme = useAppTheme();
  const isGroupChat = chat.chatType === 'GROUP';
  const messageCountLabel = formatCompactCount(messageCount);
  // Typing wins over presence: that somebody is online is background, that they
  // are writing to you right now is the more useful of the two, and the line
  // only holds one.
  const presenceText = typingText
    || (chat.chatType === 'GROUP'
      ? formatGroupOnlineCount(onlineCount)
      : chat.isOnline
        ? 'online'
        : '');

  return (
    <View style={[
      headerStyles.card,
      {
        backgroundColor: appTheme.colors.groupedCard,
        borderColor: appTheme.colors.linkOutline,
        top: topOffset
      }
    ]}>
      <Pressable
        accessibilityLabel="Back to chats"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [headerStyles.backButton, pressed && headerStyles.pressed]}
      >
        <Feather color={appTheme.colors.link} name="chevron-left" size={26} />
        {messageCount > 0 ? (
          <Text
            accessibilityLabel={`${messageCount} messages in this chat`}
            numberOfLines={1}
            style={[
              headerStyles.backCount,
              {
                backgroundColor: appTheme.colors.primarySoft,
                color: appTheme.colors.link
              }
            ]}
          >
            {messageCountLabel}
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityLabel={isGroupChat ? 'Open group info' : 'Open contact info'}
        accessibilityRole="button"
        onPress={isGroupChat ? onOpenGroupInfo : onOpenContactInfo}
        style={({ pressed }) => [headerStyles.identity, pressed && headerStyles.pressed]}
      >
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={chat.title}
          size={42}
          uri={chat.profilePhotoUrl}
        />

        <View style={headerStyles.identityText}>
          <Text numberOfLines={1} style={[headerStyles.title, { color: appTheme.colors.ink }]}>
            {chat.title}
          </Text>
          {presenceText ? (
            <Text numberOfLines={1} style={[headerStyles.presence, { color: appTheme.colors.muted }]}>
              {presenceText}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={headerStyles.actions}>
        {isGroupChat ? (
          <HeaderIconButton
            icon="user-plus"
            label="Select people"
            onPress={onOpenGroupPeoplePicker}
          />
        ) : null}

        <Pressable
          accessibilityLabel={isGroupChat ? 'Open group call options' : 'Video call'}
          accessibilityRole="button"
          onPress={isGroupChat ? onOpenGroupCallOptions : onStartVideoCall}
          style={({ pressed }) => [headerStyles.iconButton, pressed && headerStyles.pressed]}
        >
          <View style={headerStyles.videoIcon}>
            <Feather color={appTheme.colors.link} name="video" size={21} />
            {isGroupChat ? (
              <Feather color={appTheme.colors.link} name="chevron-down" size={13} />
            ) : null}
          </View>
        </Pressable>

        {!isGroupChat ? (
          <HeaderIconButton icon="phone" label="Call" onPress={onStartVoiceCall} />
        ) : null}

        <HeaderIconButton
          icon="more-vertical"
          label="More"
          onPress={isGroupChat ? onOpenGroupCallOptions : onOpenContactInfo}
        />
      </View>
    </View>
  );
}

function HeaderIconButton({
  icon,
  label,
  onPress
}: {
  icon: 'more-vertical' | 'phone' | 'user-plus';
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [headerStyles.iconButton, pressed && headerStyles.pressed]}
    >
      <Feather color={appTheme.colors.link} name={icon} size={21} />
    </Pressable>
  );
}

function formatCompactCount(value: number): string {
  const safeValue = Math.max(0, Math.floor(value));

  if (safeValue > 99) {
    return '99+';
  }

  return String(safeValue);
}

const headerStyles = StyleSheet.create({
  /**
   * The one thing in the app allowed a shadow this heavy.
   *
   * It has to read as lying on top of a conversation that scrolls under it, and
   * the round icon button's lift is not enough at this size.
   */
  card: {
    alignItems: 'center',
    // Fully rounded ends, the same as the search field. Half the height, so it
    // stays a true pill however the sizes are tuned later.
    borderRadius: MESSAGE_HEADER_HEIGHT / 2,
    borderWidth: 1.5,
    elevation: 8,
    flexDirection: 'row',
    gap: 6,
    height: MESSAGE_HEADER_HEIGHT,
    // Out of the flow, so the conversation fills the screen and runs under it.
    left: 15,
    paddingHorizontal: 8,
    position: 'absolute',
    right: 15,
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    zIndex: 60
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    height: 46,
    justifyContent: 'center',
    paddingLeft: 2,
    paddingRight: 2
  },
  backCount: {
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 17,
    minWidth: 26,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center'
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 52,
    minWidth: 0
  },
  identityText: {
    flex: 1,
    minWidth: 0
  },
  title: {
    fontSize: 16,
    lineHeight: 21
  },
  presence: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 38
  },
  videoIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 1,
    justifyContent: 'center',
    minWidth: 32
  },
  pressed: {
    opacity: 0.6
  }
});
