import Feather from '@expo/vector-icons/Feather';
import type { SynzappScheduledCall } from '../../services/localCallStore';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { formatScheduledCallDateTime } from '../../components/calls/CallHistoryRow';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Scheduled calls.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ScheduledCallsModal({
  calls,
  isOpen,
  onClose,
  onDelete
}: {
  calls: SynzappScheduledCall[];
  isOpen: boolean;
  onClose: () => void;
  onDelete: (callId: string) => void;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

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
            accessibilityLabel="Close scheduled calls"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.callModalHeaderTitle, { color: appTheme.colors.ink }]}>Scheduled calls</Text>
          <View style={styles.newChatHeaderSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.callModalList}>
          {calls.map((call) => (
            <View
              key={call.id}
              style={[
                styles.scheduledCallRow,
                { borderBottomColor: appTheme.colors.divider }
              ]}
            >
              <View style={[styles.scheduledCallIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
                <Feather color={appTheme.colors.primary} name={call.callType === 'video' ? 'video' : 'phone'} size={18} />
              </View>
              <View style={styles.chatText}>
                <Text numberOfLines={1} style={[styles.callHistoryTitle, { color: appTheme.colors.ink }]}>{call.title}</Text>
                <Text numberOfLines={1} style={[styles.callHistorySubtitle, { color: appTheme.colors.muted }]}>
                  {formatScheduledCallDateTime(call.startsAt)}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={`Delete ${call.title}`}
                accessibilityRole="button"
                onPress={() => onDelete(call.id)}
                style={({ pressed }) => [styles.callHistoryIconButton, pressed && styles.pressed]}
              >
                <Feather color={appTheme.colors.red} name="trash-2" size={18} />
              </Pressable>
            </View>
          ))}

          {!calls.length ? (
            <Text style={[styles.batchEmpty, { color: appTheme.colors.muted }]}>No scheduled calls yet</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
