import Feather from '@expo/vector-icons/Feather';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Group permissions.
 *
 * Lifted out of the chat screen unchanged.
 */

export function GroupPermissionsModal({
  isOpen,
  onBack,
  onSelectPermission,
  permissionMode
}: {
  isOpen: boolean;
  onBack: () => void;
  onSelectPermission: (value: 'ADMINS' | 'ALL_MEMBERS') => void;
  permissionMode: 'ADMINS' | 'ALL_MEMBERS';
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

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
        styles.newChatModalScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Back to group details"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Text style={[styles.backButtonText, { color: appTheme.colors.primary }]}>‹</Text>
          </Pressable>
          <Text style={[styles.newChatHeaderTitle, { color: appTheme.colors.ink }]}>Group permissions</Text>
          <View style={styles.newChatHeaderSpacer} />
        </View>

        <GroupPermissionOption
          description="Members can send messages and participate normally."
          isSelected={permissionMode === 'ALL_MEMBERS'}
          onPress={() => onSelectPermission('ALL_MEMBERS')}
          title="All members"
        />
        <GroupPermissionOption
          description="Admins control key group actions. Member messaging rules can be expanded later."
          isSelected={permissionMode === 'ADMINS'}
          onPress={() => onSelectPermission('ADMINS')}
          title="Admins only"
        />
      </View>
    </Modal>
  );
}

function GroupPermissionOption({
  description,
  isSelected,
  onPress,
  title
}: {
  description: string;
  isSelected: boolean;
  onPress: () => void;
  title: string;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.groupPermissionOption,
        {
          backgroundColor: appTheme.colors.screen,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && styles.pressed
      ]}
    >
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
      <View style={styles.chatText}>
        <Text style={[styles.groupPermissionTitle, { color: appTheme.colors.ink }]}>{title}</Text>
        <Text style={[styles.groupPermissionSubtitle, { color: appTheme.colors.muted }]}>{description}</Text>
      </View>
    </Pressable>
  );
}
