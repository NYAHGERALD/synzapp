import React from 'react';
import { Modal, Platform, ScrollView, Text, View } from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { ChatContact } from '../../services/chatApi';
import {
  ChatMemberSelectRow,
  MemberPickerHeader,
  SelectedMembersStrip,
  filterChatContacts,
  memberPickerStyles
} from '../../components/groups/GroupAddMembersModal';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { ListSection } from '../../components/ui/GroupedList';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Member selection, on the way to a new group.
 *
 * The same screen as adding to a group that already exists, and built from the
 * same pieces on purpose: the header, the strip of people picked so far and the
 * selectable row all come from `GroupAddMembersModal`. Two lists that drift
 * apart is how one of them ends up without a search box.
 */

export function AddMembersModal({
  contacts,
  isOpen,
  onBack,
  onNext,
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
  onBack: () => void;
  onNext: () => void;
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

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onBack}
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
          actionLabel="Next"
          canAct={selectedCount > 0}
          closeLabel="Close add members"
          isBusy={false}
          onAct={onNext}
          onClose={onBack}
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
              isBusy={false}
              members={selectedMembers}
              onRemoveMember={onRemoveMember}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ) : null}

          {filteredContacts.length ? (
            <ListSection title="Frequently contacted">
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
              {search.trim() ? 'No members found' : 'No organization members yet'}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
