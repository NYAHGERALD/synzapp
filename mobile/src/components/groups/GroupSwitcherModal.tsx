import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { TenantGroup } from '../../services/adminApi';
import { androidButtonRipple } from '../../components/chatUiPrimitives';
import { colors } from '../../theme/colors';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Switching between groups.
 *
 * Lifted out of the chat screen unchanged.
 */

export function GroupSwitcherModal({
  companyName,
  groups,
  isLoading,
  isOpen,
  onAddGroup,
  onClose,
  onOpenGroup,
  selectedGroupId
}: {
  companyName: string;
  groups: TenantGroup[];
  isLoading: boolean;
  isOpen: boolean;
  onAddGroup: () => void;
  onClose: () => void;
  onOpenGroup: (group: TenantGroup) => void;
  selectedGroupId: string | null;
}) {
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const visibleGroups = groups.filter((group) => !group.systemManaged || !group.isDepartmentDefault);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.newChatModalScreen, { paddingTop: modalTopPadding }]}>
        <View style={styles.newChatHeader}>
          <View style={styles.newChatHeaderSpacer} />
          <Text numberOfLines={1} style={styles.newChatHeaderTitle}>{companyName}</Text>
          <Pressable
            accessibilityLabel="Close groups"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="x" size={24} />
          </Pressable>
        </View>

        <Text style={styles.groupSwitcherSectionTitle}>Groups you're in</Text>

        {isLoading && !visibleGroups.length ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.groupSwitcherList}
          >
            {visibleGroups.map((group) => (
              <Pressable
                accessibilityLabel={`Open ${group.name}`}
                accessibilityRole="button"
                key={group.groupId}
                onPress={() => onOpenGroup(group)}
                style={({ pressed }) => [
                  styles.groupSwitcherRow,
                  selectedGroupId === group.groupId && styles.groupSwitcherRowActive,
                  pressed && styles.pressed
                ]}
              >
                <View style={styles.groupIcon}>
                  <Ionicons color={colors.primary} name="people" size={21} />
                </View>
                <View style={styles.chatText}>
                  <Text numberOfLines={1} style={styles.chatTitle}>{group.name}</Text>
                  <Text numberOfLines={1} style={styles.chatPreview}>{getGroupSubtitle(group)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.groupMeta}>
                  {group.memberCount === 1 ? '1 member' : `${group.memberCount} members`}
                </Text>
              </Pressable>
            ))}

            {!visibleGroups.length ? (
              <Text style={styles.batchEmpty}>No groups yet</Text>
            ) : null}
          </ScrollView>
        )}

        <Pressable
          accessibilityLabel="Add group"
          accessibilityRole="button"
          android_ripple={androidButtonRipple}
          onPress={onAddGroup}
          style={({ pressed }) => [styles.groupSwitcherAddButton, pressed && styles.pressed]}
        >
          <Feather color="#FFFFFF" name="plus" size={19} />
          <Text style={styles.groupSwitcherAddText}>Add group</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export function getGroupSubtitle(group: TenantGroup): string {
  if (group.isDepartmentDefault) {
    return group.departmentName ? `${group.departmentName} department` : 'Department group';
  }

  if (group.scope === 'DEPARTMENT') {
    return group.departmentName ? `${group.departmentName} group` : 'Department group';
  }

  return 'Company group';
}
