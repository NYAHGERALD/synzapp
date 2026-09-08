import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, Text, View } from 'react-native';
import { androidButtonRipple } from '../../components/chatUiPrimitives';
import { formatGroupOnlineCount } from '../../components/calls/GroupCallPeopleModal';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Group call options.
 *
 * Lifted out of the chat screen unchanged.
 */

export type GroupCallOption = 'schedule' | 'selectPeople' | 'sendLink' | 'video' | 'voice';

export function GroupCallOptionsModal({
  groupName,
  isOpen,
  onClose,
  onSelect,
  onlineCount
}: {
  groupName: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (option: GroupCallOption) => void;
  onlineCount: number;
}) {
  const appTheme = useAppTheme();
  const options: Array<{ icon: keyof typeof Feather.glyphMap; id: GroupCallOption; label: string }> = [
    { icon: 'phone', id: 'voice', label: 'Voice call' },
    { icon: 'video', id: 'video', label: 'Video call' },
    { icon: 'check-circle', id: 'selectPeople', label: 'Select people' },
    { icon: 'link', id: 'sendLink', label: 'Send call link' },
    { icon: 'calendar', id: 'schedule', label: 'Schedule call' }
  ];

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={isOpen}
    >
      <View style={styles.groupCallOptionsRoot}>
        <Pressable
          accessibilityLabel="Close group call options"
          accessibilityRole="button"
          onPress={onClose}
          style={[
            styles.groupCallOptionsBackdrop,
            { backgroundColor: appTheme.colors.overlay }
          ]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.groupCallOptionsPanel,
            {
              backgroundColor: appTheme.colors.surfaceElevated,
              borderColor: appTheme.colors.border
            }
          ]}
        >
          <View style={[styles.groupCallOptionsHeader, { borderBottomColor: appTheme.colors.divider }]}>
            <Text numberOfLines={1} style={[styles.groupCallOptionsTitle, { color: appTheme.colors.ink }]}>
              {groupName}
            </Text>
            <Text style={[styles.groupCallOptionsSubtitle, { color: appTheme.colors.muted }]}>
              {formatGroupOnlineCount(onlineCount)}
            </Text>
          </View>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              android_ripple={androidButtonRipple}
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [styles.groupCallOptionRow, pressed && styles.pressed]}
            >
              <Feather color={appTheme.colors.mutedStrong} name={option.icon} size={20} />
              <Text style={[styles.groupCallOptionText, { color: appTheme.colors.ink }]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
