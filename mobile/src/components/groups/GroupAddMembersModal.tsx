import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { CircleIconButton } from '../../components/ui/CircleIconButton';
import { ListSection } from '../../components/ui/GroupedList';
import { ProfileAvatar, normalizeSearchQuery } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Adding members to a group.
 *
 * The app's grouped list: a tinted page, the people in a rounded card with
 * hairlines between them, and the one action as text in the header rather than
 * a filled slab in the corner.
 *
 * Whoever is already picked sits in a card of its own between the search and
 * the list, so a long scroll never leaves somebody wondering who they have.
 *
 * Full screen on Android, so the navigation bar is this screen's own problem;
 * see `resolveScreenBottomInset`.
 */

export function GroupAddMembersModal({
  contacts,
  isOpen,
  isSaving,
  onCancel,
  onConfirm,
  onRemoveMember,
  onSearchChange,
  onToggleMember,
  profilePhotoHeaders,
  search,
  selectedCount,
  selectedMemberIds,
  selectedMembers
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onRemoveMember: (contactId: string) => void;
  onSearchChange: (value: string) => void;
  onToggleMember: (contactId: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
  selectedCount: number;
  selectedMemberIds: Record<string, boolean>;
  selectedMembers: ChatContact[];
}) {
  const appTheme = useAppTheme();
  const filteredContacts = filterChatContacts(contacts, search);
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });
  const canAdd = selectedCount > 0 && !isSaving;

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
        <MemberPickerHeader
          actionLabel="Add"
          canAct={canAdd}
          closeLabel="Close add members"
          isBusy={isSaving}
          onAct={onConfirm}
          onClose={onCancel}
          selectedCount={selectedCount}
          title="Add members"
        />

        <View style={memberPickerStyles.searchWrap}>
          <ChatSearchBar
            onChangeText={onSearchChange}
            placeholder="Search name or number"
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
          {selectedMembers.length ? (
            <SelectedMembersStrip
              isBusy={isSaving}
              members={selectedMembers}
              onRemoveMember={onRemoveMember}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ) : null}

          {filteredContacts.length ? (
            <ListSection title="Available members">
              {filteredContacts.map((contact) => (
                <ChatMemberSelectRow
                  contact={contact}
                  insideCard
                  isSelected={Boolean(selectedMemberIds[contact.contactId])}
                  key={contact.contactId}
                  onToggle={() => onToggleMember(contact.contactId)}
                  profilePhotoHeaders={profilePhotoHeaders}
                />
              ))}
            </ListSection>
          ) : (
            <Text style={[memberPickerStyles.empty, { color: appTheme.colors.muted }]}>
              {search.trim() ? 'No members found' : 'Everyone available is already in this group.'}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * The header both member pickers share.
 *
 * The one action is text beside the round close button, which is where this app
 * puts a screen's action. A filled slab in the corner of a picker competes with
 * the list, and the brand green is not a button colour.
 */
export function MemberPickerHeader({
  actionLabel,
  canAct,
  closeLabel,
  isBusy,
  onAct,
  onClose,
  selectedCount,
  subtitle,
  title
}: {
  actionLabel: string;
  canAct: boolean;
  closeLabel: string;
  isBusy: boolean;
  onAct: () => void;
  onClose: () => void;
  selectedCount: number;
  /** Replaces "N selected" where a screen counts against a limit instead. */
  subtitle?: string;
  title: string;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={memberPickerStyles.header}>
      <CircleIconButton action="close" disabled={isBusy} label={closeLabel} onPress={onClose} />

      <View style={memberPickerStyles.headerText}>
        <Text numberOfLines={1} style={[memberPickerStyles.headerTitle, { color: appTheme.colors.ink }]}>
          {title}
        </Text>
        {subtitle || selectedCount > 0 ? (
          <Text numberOfLines={1} style={[memberPickerStyles.headerSubtitle, { color: appTheme.colors.muted }]}>
            {subtitle || `${selectedCount} selected`}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel={actionLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAct }}
        disabled={!canAct}
        hitSlop={8}
        onPress={onAct}
        style={({ pressed }) => [
          memberPickerStyles.headerAction,
          pressed && canAct && memberPickerStyles.pressed,
          !canAct && memberPickerStyles.disabled
        ]}
      >
        {isBusy ? (
          <ActivityIndicator color={appTheme.colors.link} size="small" />
        ) : (
          <Text style={[memberPickerStyles.headerActionText, { color: appTheme.colors.link }]}>
            {actionLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

/** Everybody picked so far, in a card of their own. */
export function SelectedMembersStrip({
  isBusy,
  members,
  onRemoveMember,
  profilePhotoHeaders
}: {
  isBusy: boolean;
  members: ChatContact[];
  onRemoveMember: (contactId: string) => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();

  return (
    <ListSection>
      <ScrollView
        contentContainerStyle={memberPickerStyles.selectedContent}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {members.map((member) => (
          <View key={member.contactId} style={memberPickerStyles.selectedChip}>
            <View style={styles.groupMemberAvatarWrap}>
              <ProfileAvatar
                headers={profilePhotoHeaders}
                name={member.displayName}
                size={48}
                uri={member.profilePhotoUrl}
              />
              <Pressable
                accessibilityLabel={`Remove ${member.displayName}`}
                accessibilityRole="button"
                disabled={isBusy}
                hitSlop={6}
                onPress={() => onRemoveMember(member.contactId)}
                style={({ pressed }) => [
                  styles.groupMemberRemoveButton,
                  { borderColor: appTheme.colors.groupedCard },
                  pressed && !isBusy && memberPickerStyles.pressed
                ]}
              >
                <Feather color="#FFFFFF" name="x" size={13} />
              </Pressable>
            </View>
            <Text numberOfLines={2} style={[memberPickerStyles.selectedName, { color: appTheme.colors.ink }]}>
              {member.displayName}
            </Text>
          </View>
        ))}
      </ScrollView>
    </ListSection>
  );
}

export function ChatMemberSelectRow({
  contact,
  insideCard = false,
  isSelected,
  onToggle,
  profilePhotoHeaders
}: {
  contact: ChatContact;
  /**
   * Draws the row for a rounded card: no colour and no rule of its own, since
   * the card supplies both.
   *
   * Opt in, so the screens still drawing this row on a plain white page keep
   * exactly the look they have.
   */
  insideCard?: boolean;
  isSelected: boolean;
  onToggle: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  // A tick is an answer, not a brand mark. Inside a card it takes the app's
  // action blue, the same as every other picker.
  const tickColor = insideCard ? appTheme.colors.link : appTheme.colors.primary;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.newChatContactRow,
        insideCard
          ? memberPickerStyles.cardRow
          : {
            backgroundColor: appTheme.colors.screen,
            borderBottomColor: appTheme.colors.divider
          },
        pressed && (insideCard
          ? { backgroundColor: appTheme.colors.groupedBackground }
          : styles.pressed)
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
      <View style={[
        styles.memberSelectCheck,
        {
          backgroundColor: isSelected ? tickColor : 'transparent',
          borderColor: isSelected ? tickColor : appTheme.colors.muted
        }
      ]}>
        {isSelected ? <Feather color="#FFFFFF" name="check" size={14} /> : null}
      </View>
    </Pressable>
  );
}

export function filterChatContacts(contacts: ChatContact[], search: string): ChatContact[] {
  const query = normalizeSearchQuery(search);

  if (!query) {
    return contacts;
  }

  return contacts.filter((contact) =>
    normalizeSearchQuery(`${contact.displayName} ${contact.roleName} ${contact.phoneMasked || ''}`).includes(query)
  );
}

export const memberPickerStyles = StyleSheet.create({
  screen: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 15
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center'
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
    textAlign: 'center'
  },
  headerAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44
  },
  headerActionText: {
    fontSize: 16,
    lineHeight: 21
  },
  // Room around the field for its shadow to fall into.
  searchWrap: {
    paddingBottom: 2,
    paddingHorizontal: 15,
    paddingTop: 10
  },
  list: {
    flex: 1
  },
  content: {
    paddingTop: 2
  },
  selectedContent: {
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  selectedChip: {
    alignItems: 'center',
    width: 66
  },
  selectedName: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'center'
  },
  // The card draws the colour and the rules; the row only holds its padding.
  cardRow: {
    borderBottomWidth: 0,
    paddingHorizontal: 16
  },
  empty: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 15,
    paddingVertical: 24,
    textAlign: 'center'
  },
  pressed: {
    opacity: 0.6
  },
  disabled: {
    opacity: 0.35
  }
});
