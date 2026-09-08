import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { CircleIconButton, CircleIconSpacer } from '../../components/ui/CircleIconButton';
import { ListSection } from '../../components/ui/GroupedList';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { filterChatContacts, memberPickerStyles } from '../../components/groups/GroupAddMembersModal';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Starting a new chat.
 *
 * The app's grouped list, and the same shape as the three pickers it sits
 * beside: a tinted page, a floating search field, and rounded cards with
 * hairlines between their rows.
 *
 * Starting a group and picking a person are two different decisions, so they
 * get two cards rather than one list with an odd row on top.
 *
 * Full screen on Android, so the navigation bar is this screen's own problem;
 * see `resolveScreenBottomInset`.
 */

export function NewChatModal({
  contacts,
  isOpen,
  onCancel,
  onOpenAddMembers,
  onOpenContact,
  onSearchChange,
  profilePhotoHeaders,
  search
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  onCancel: () => void;
  onOpenAddMembers: () => void;
  onOpenContact: (contact: ChatContact) => void;
  onSearchChange: (value: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
}) {
  const appTheme = useAppTheme();
  const filteredContacts = filterChatContacts(contacts, search);
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        memberPickerStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={memberPickerStyles.header}>
          <CircleIconButton action="close" label="Close new chat" onPress={onCancel} />
          <View style={memberPickerStyles.headerText}>
            <Text numberOfLines={1} style={[memberPickerStyles.headerTitle, { color: appTheme.colors.ink }]}>
              New chat
            </Text>
          </View>
          <CircleIconSpacer />
        </View>

        <View style={memberPickerStyles.searchWrap}>
          <ChatSearchBar
            onChangeText={onSearchChange}
            placeholder="Search name"
            value={search}
          />
        </View>

        <ScrollView
          contentContainerStyle={[
            memberPickerStyles.content,
            { paddingBottom: Math.max(28, screenBottomInset + 24) }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={memberPickerStyles.list}
        >
          {/* Hidden once somebody is searching. They are looking for a person
              by name, and this row can never be the answer. */}
          {!search.trim() ? (
            <ListSection>
              <Pressable
                accessibilityLabel="Create new group"
                accessibilityRole="button"
                onPress={onOpenAddMembers}
                style={({ pressed }) => [
                  newChatStyles.groupRow,
                  pressed && { backgroundColor: appTheme.colors.groupedBackground }
                ]}
              >
                <View style={[newChatStyles.groupIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
                  <Feather color={appTheme.colors.primary} name="users" size={20} />
                </View>
                <Text style={[newChatStyles.groupText, { color: appTheme.colors.ink }]}>New group</Text>
                <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
              </Pressable>
            </ListSection>
          ) : null}

          {filteredContacts.length ? (
            <ListSection title="People">
              {filteredContacts.map((contact) => (
                <ChatContactPickRow
                  contact={contact}
                  key={contact.contactId}
                  onPress={() => onOpenContact(contact)}
                  profilePhotoHeaders={profilePhotoHeaders}
                />
              ))}
            </ListSection>
          ) : (
            <Text style={[memberPickerStyles.empty, { color: appTheme.colors.muted }]}>
              {search.trim() ? 'No contacts found' : 'No organization contacts yet'}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ChatContactPickRow({
  contact,
  onPress,
  profilePhotoHeaders
}: {
  contact: ChatContact;
  onPress: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.newChatContactRow,
        memberPickerStyles.cardRow,
        pressed && { backgroundColor: appTheme.colors.groupedBackground }
      ]}
    >
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={contact.displayName}
        size={48}
        uri={contact.profilePhotoUrl}
      />
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{contact.displayName}</Text>
        <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{contact.roleName}</Text>
      </View>
      <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
    </Pressable>
  );
}

const newChatStyles = StyleSheet.create({
  groupRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  // Tinted, not filled. A solid disc with a white glyph reads as a button, and
  // this is the same identity mark a group carries everywhere else.
  groupIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  groupText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    minWidth: 0
  }
});
