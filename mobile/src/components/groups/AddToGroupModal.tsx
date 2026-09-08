import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { AddableChatGroup } from '../../services/chatApi';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { ListSection } from '../../components/ui/GroupedList';
import { MemberPickerHeader, memberPickerStyles } from '../../components/groups/GroupAddMembersModal';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { normalizeSearchQuery } from '../../components/messages/MessageThread';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Adding a contact to a group.
 *
 * The third of the three pickers, and built from the same pieces as the other
 * two: the header comes from `GroupAddMembersModal`, the groups sit in a
 * rounded card with hairlines between them, and the page behind is the tinted
 * ground the rest of the app uses.
 *
 * Full screen on Android, so the navigation bar is this screen's own problem;
 * see `resolveScreenBottomInset`.
 */

export function AddToGroupModal({
  contactName,
  groups,
  isLoading,
  isOpen,
  isSaving,
  onCancel,
  onConfirm,
  onSearchChange,
  onToggleGroup,
  search,
  selectedCount,
  selectedGroupIds
}: {
  contactName: string;
  groups: AddableChatGroup[];
  isLoading: boolean;
  isOpen: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSearchChange: (value: string) => void;
  onToggleGroup: (groupId: string) => void;
  search: string;
  selectedCount: number;
  selectedGroupIds: Record<string, boolean>;
}) {
  const appTheme = useAppTheme();
  const filteredGroups = filterAddableChatGroups(groups, search);
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
          closeLabel="Close select groups"
          isBusy={isSaving}
          onAct={onConfirm}
          onClose={onCancel}
          selectedCount={selectedCount}
          subtitle={`${selectedCount}/10`}
          title="Select groups"
        />

        <View style={memberPickerStyles.searchWrap}>
          <ChatSearchBar
            onChangeText={onSearchChange}
            placeholder="Search"
            value={search}
          />
        </View>

        {isLoading && !groups.length ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              memberPickerStyles.content,
              { paddingBottom: Math.max(28, screenBottomInset + 24) }
            ]}
            keyboardDismissMode={getKeyboardDismissMode()}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={memberPickerStyles.list}
          >
            {filteredGroups.length ? (
              <ListSection>
                {filteredGroups.map((group) => (
                  <AddToGroupRow
                    group={group}
                    isDisabled={isSaving}
                    isSelected={Boolean(selectedGroupIds[group.groupId])}
                    key={group.groupId}
                    onToggle={() => onToggleGroup(group.groupId)}
                  />
                ))}
              </ListSection>
            ) : (
              <Text style={[memberPickerStyles.empty, { color: appTheme.colors.muted }]}>
                {search.trim() ? 'No groups found' : `${contactName} can already access every available group.`}
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function AddToGroupRow({
  group,
  isDisabled,
  isSelected,
  onToggle
}: {
  group: AddableChatGroup;
  isDisabled: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={`Select ${group.name}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.newChatContactRow,
        memberPickerStyles.cardRow,
        pressed && !isDisabled && { backgroundColor: appTheme.colors.groupedBackground }
      ]}
    >
      {/* The circle stands in for a photograph the group does not have, so it
          keeps its tint. It is an identity mark, not a button. */}
      <View style={[
        styles.addToGroupAvatar,
        group.isDepartmentDefault && styles.addToGroupAvatarDepartment,
        { backgroundColor: appTheme.colors.primarySoft }
      ]}>
        <Feather
          color={appTheme.colors.primary}
          name={group.isDepartmentDefault ? 'users' : 'message-circle'}
          size={20}
        />
      </View>
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{group.name}</Text>
        <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>
          {getAddableGroupSubtitle(group)}
        </Text>
      </View>
      <View style={[
        styles.memberSelectCheck,
        {
          backgroundColor: isSelected ? appTheme.colors.link : 'transparent',
          borderColor: isSelected ? appTheme.colors.link : appTheme.colors.muted
        }
      ]}>
        {isSelected ? <Feather color="#FFFFFF" name="check" size={14} /> : null}
      </View>
    </Pressable>
  );
}

function getAddableGroupSubtitle(group: AddableChatGroup): string {
  if (group.isDepartmentDefault) {
    return group.departmentName ? `${group.departmentName} department` : 'Department group';
  }

  const memberCount = group.memberCount === 1 ? '1 member' : `${group.memberCount} members`;

  if (group.scope === 'DEPARTMENT' && group.departmentName) {
    return `${group.departmentName} - ${memberCount}`;
  }

  return memberCount;
}

function filterAddableChatGroups(groups: AddableChatGroup[], search: string): AddableChatGroup[] {
  const query = normalizeSearchQuery(search);

  if (!query) {
    return groups;
  }

  return groups.filter((group) =>
    normalizeSearchQuery(`${group.name} ${group.departmentName || ''} ${group.description || ''}`).includes(query)
  );
}
