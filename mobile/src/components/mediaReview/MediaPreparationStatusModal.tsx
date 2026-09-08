import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { IPhonePhotoPreparationProgress } from '../../services/chatAttachmentPicker';
import { styles } from '../../screens/adminChatStyles';

/**
 * Media preparation status.
 *
 * Lifted out of the chat screen unchanged.
 */

export function MediaPreparationStatusModal({
  progress
}: {
  progress: IPhonePhotoPreparationProgress | null;
}) {
  const isPreparing = Boolean(progress);
  const clampedProgress = Math.max(0.05, Math.min(progress?.progress || 0, 1));

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      statusBarTranslucent
      transparent
      visible={isPreparing}
    >
      <View style={styles.mediaPreparationModalRoot}>
        <View accessibilityViewIsModal style={styles.mediaPreparationCard}>
          <View style={[styles.mediaPreparationIcon, styles.mediaPreparationIconActive]}>
            <ActivityIndicator color="#0F766E" size="small" />
          </View>
          <View style={styles.mediaPreparationContent}>
            <Text style={styles.mediaPreparationEyebrow}>
              Preparing media
            </Text>
            <Text style={styles.mediaPreparationTitle}>
              Preparing secure copy
            </Text>
            <Text style={styles.mediaPreparationBody}>
              {`${progress?.fileName || 'Media'} is being prepared for secure sending.`}
            </Text>
            <View style={styles.mediaPreparationProgressBlock}>
              <View style={styles.mediaPreparationProgressTrack}>
                <View style={[
                  styles.mediaPreparationProgressFill,
                  { width: `${Math.round(clampedProgress * 100)}%` }
                ]} />
              </View>
              <Text style={styles.mediaPreparationProgressText}>{Math.round(clampedProgress * 100)}%</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
