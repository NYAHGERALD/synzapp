import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SynzappCallMode } from '../../services/callApi';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Scheduling a call and sending the invitation.
 *
 * Lifted out of the chat screen unchanged.
 */

export interface ScheduleCallDraft {
  callType: SynzappCallMode;
  calendarAddedAt?: string | null;
  calendarEventId?: string | null;
  description: string;
  endsAt: Date;
  id: string;
  includeEndTime: boolean;
  reminderMinutes: number;
  requireApproval: boolean;
  startsAt: Date;
  title: string;
}

export function CallContactRow({
  contact,
  isSelected = false,
  onPress,
  profilePhotoHeaders,
  trailing = 'call'
}: {
  contact: ChatContact;
  isSelected?: boolean;
  onPress: () => void;
  profilePhotoHeaders?: Record<string, string>;
  trailing?: 'call' | 'radio';
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={contact.displayName}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.callContactRow,
        { borderBottomColor: appTheme.colors.divider },
        pressed && styles.pressed
      ]}
    >
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={contact.displayName}
        size={44}
        uri={contact.profilePhotoUrl}
      />
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={[styles.callContactTitle, { color: appTheme.colors.ink }]}>{contact.displayName}</Text>
        <Text numberOfLines={1} style={[styles.callContactSubtitle, { color: appTheme.colors.muted }]}>
          {getCallContactSubtitle(contact)}
        </Text>
      </View>
      {trailing === 'radio' ? (
        <View style={[
          styles.callContactRadio,
          { borderColor: isSelected ? appTheme.colors.primary : appTheme.colors.border },
          isSelected && { backgroundColor: appTheme.colors.primary }
        ]}>
          {isSelected ? <Feather color="#FFFFFF" name="check" size={13} /> : null}
        </View>
      ) : (
        <View style={[styles.callContactCallIcon, { backgroundColor: appTheme.colors.surface }]}>
          <Ionicons color={appTheme.colors.primary} name="call" size={18} />
        </View>
      )}
    </Pressable>
  );
}

export function ScheduleCallSendModal({
  contacts,
  draft,
  isAddingToCalendar,
  isOpen,
  onAddToCalendar,
  onBack,
  onChangeSearch,
  onClose,
  onSave,
  onToggleRecipient,
  profilePhotoHeaders,
  search,
  selectedRecipientIds
}: {
  contacts: ChatContact[];
  draft: ScheduleCallDraft;
  isAddingToCalendar: boolean;
  isOpen: boolean;
  onAddToCalendar: () => void;
  onBack: () => void;
  onChangeSearch: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onToggleRecipient: (contactId: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
  selectedRecipientIds: Record<string, boolean>;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const visibleContacts = filterCallContacts(contacts, search);
  const selectedCount = Object.values(selectedRecipientIds).filter(Boolean).length;
  const hasSearch = Boolean(search.trim());
  const primaryContacts = hasSearch ? visibleContacts : visibleContacts.slice(0, 6);
  const primaryContactIds = new Set(primaryContacts.map((contact) => contact.contactId));
  const secondaryContacts = hasSearch
    ? []
    : visibleContacts.filter((contact) => !primaryContactIds.has(contact.contactId));

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        styles.callModalScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.callModalHeader}>
          <Pressable
            accessibilityLabel="Back to schedule call details"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="chevron-left" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text numberOfLines={1} style={[styles.callModalHeaderTitle, { color: appTheme.colors.ink }]}>Send to</Text>
            <Text numberOfLines={1} style={[styles.callModalHeaderSubtitle, { color: appTheme.colors.muted }]}>
              {selectedCount}/{contacts.length}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Save scheduled call"
            accessibilityRole="button"
            onPress={onSave}
            style={({ pressed }) => [
              styles.callModalNextButton,
              { backgroundColor: appTheme.colors.surfaceElevated },
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.callModalNextText, { color: appTheme.colors.ink }]}>Save</Text>
          </Pressable>
        </View>

        <ChatSearchBar
          onChangeText={onChangeSearch}
          placeholder="Search name or number"
          value={search}
        />

        <ScrollView
          keyboardDismissMode={getKeyboardDismissMode()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.callModalList}
        >
          <Pressable
            accessibilityLabel="Add scheduled call to calendar"
            accessibilityRole="button"
            disabled={isAddingToCalendar}
            onPress={onAddToCalendar}
            style={({ pressed }) => [
              styles.scheduleSendCalendarRow,
              {
                backgroundColor: appTheme.colors.surfaceElevated,
                borderColor: appTheme.colors.border
              },
              pressed && !isAddingToCalendar && styles.pressed,
              isAddingToCalendar && styles.disabled
            ]}
          >
            <View style={[styles.scheduleSendCalendarIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
              <Feather color={appTheme.colors.primary} name="calendar" size={18} />
            </View>
            <View style={styles.chatText}>
              <Text numberOfLines={1} style={[styles.scheduleSendCalendarTitle, { color: appTheme.colors.ink }]}>
                Add to calendar
              </Text>
              <Text numberOfLines={1} style={[styles.scheduleSendCalendarSubtitle, { color: appTheme.colors.muted }]}>
                {draft.calendarAddedAt ? 'Added to this device calendar' : 'Open the native event editor'}
              </Text>
            </View>
            {isAddingToCalendar ? (
              <ActivityIndicator color={appTheme.colors.primary} size="small" />
            ) : draft.calendarAddedAt ? (
              <Feather color={appTheme.colors.success} name="check-circle" size={20} />
            ) : (
              <Feather color={appTheme.colors.muted} name="chevron-right" size={20} />
            )}
          </Pressable>

          <Text style={[styles.callModalSectionLabel, { color: appTheme.colors.muted }]}>
            {hasSearch ? 'Search results' : 'Frequently contacted'}
          </Text>
          {primaryContacts.map((contact) => (
            <CallContactRow
              contact={contact}
              isSelected={Boolean(selectedRecipientIds[contact.contactId])}
              key={contact.contactId}
              onPress={() => onToggleRecipient(contact.contactId)}
              profilePhotoHeaders={profilePhotoHeaders}
              trailing="radio"
            />
          ))}

          {secondaryContacts.length ? (
            <Text style={[styles.callModalSectionLabel, { color: appTheme.colors.muted }]}>Recent chats</Text>
          ) : null}
          {secondaryContacts.map((contact) => (
            <CallContactRow
              contact={contact}
              isSelected={Boolean(selectedRecipientIds[contact.contactId])}
              key={contact.contactId}
              onPress={() => onToggleRecipient(contact.contactId)}
              profilePhotoHeaders={profilePhotoHeaders}
              trailing="radio"
            />
          ))}

          {!visibleContacts.length ? (
            <Text style={[styles.batchEmpty, { color: appTheme.colors.muted }]}>
              {search.trim() ? 'No company contacts found' : 'No available company contacts yet'}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function filterCallContacts(contacts: ChatContact[], search: string): ChatContact[] {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return contacts;
  }

  const searchDigits = search.replace(/\D/g, '');

  return contacts.filter((contact) => (
    contact.displayName.toLowerCase().includes(normalizedSearch) ||
    (contact.roleName || contact.role || '').toLowerCase().includes(normalizedSearch) ||
    (contact.phoneFormatted || '').toLowerCase().includes(normalizedSearch) ||
    (contact.phoneMasked || '').toLowerCase().includes(normalizedSearch) ||
    (searchDigits ? getCallContactPhoneDigits(contact).some((digits) => digits.includes(searchDigits)) : false)
  ));
}

export function getCallContactSubtitle(contact: ChatContact): string {
  return [
    contact.roleName || contact.role || 'Company contact',
    contact.phoneFormatted || contact.phoneMasked || ''
  ].filter(Boolean).join(' · ');
}

function getCallContactPhoneDigits(contact: ChatContact): string[] {
  return [
    contact.phoneFormatted,
    contact.phoneMasked
  ]
    .map((value) => typeof value === 'string' ? value.replace(/\D/g, '') : '')
    .filter((value) => value.length >= 4);
}
