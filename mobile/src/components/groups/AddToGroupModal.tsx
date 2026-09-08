import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { AddableChatGroup } from '../../services/chatApi';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { normalizeSearchQuery } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Adding a contact to a group.
 *
 * Lifted out of the chat screen unchanged.
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
        styles.newChatModalScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Close select groups"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onCancel}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && !isSaving && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text style={[styles.newChatHeaderTitle, { color: appTheme.colors.ink }]}>Select groups</Text>
            <Text style={[styles.newChatHeaderSubtitle, { color: appTheme.colors.muted }]}>{selectedCount}/10</Text>
          </View>
          <Pressable
            accessibilityLabel={`Add ${contactName} to selected groups`}
            accessibilityRole="button"
            disabled={!canAdd}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.newChatNextButton,
              pressed && canAdd && styles.pressed,
              !canAdd && styles.disabled
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.newChatNextText}>Add</Text>
            )}
          </Pressable>
        </View>

        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search"
          value={search}
        />

        {isLoading && !groups.length ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            keyboardDismissMode={getKeyboardDismissMode()}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.newChatContactList}
          >
            {filteredGroups.map((group) => (
              <AddToGroupRow
                group={group}
                isDisabled={isSaving}
                isSelected={Boolean(selectedGroupIds[group.groupId])}
                key={group.groupId}
                onToggle={() => onToggleGroup(group.groupId)}
              />
            ))}

            {!filteredGroups.length ? (
              <Text style={[styles.batchEmpty, { color: appTheme.colors.muted }]}>
                {search.trim() ? 'No groups found' : `${contactName} can already access every available group.`}
              </Text>
            ) : null}
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
        {
          backgroundColor: appTheme.colors.screen,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && !isDisabled && styles.pressed
      ]}
    >
      <View style={[
        styles.addToGroupAvatar,
        group.isDepartmentDefault && styles.addToGroupAvatarDepartment,
        { backgroundColor: appTheme.colors.primarySoft }
      ]}>
        <Ionicons color={appTheme.colors.primary} name={group.isDepartmentDefault ? 'people' : 'chatbubbles'} size={21} />
      </View>
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{group.name}</Text>
        <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{getAddableGroupSubtitle(group)}</Text>
      </View>
      <View style={[
        styles.memberSelectCheck,
        {
          borderColor: isSelected ? appTheme.colors.primary : appTheme.colors.muted
        },
        isSelected && styles.memberSelectCheckActive,
        isSelected && { backgroundColor: appTheme.colors.primary }
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
