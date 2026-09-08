import * as ExpoSharing from 'expo-sharing';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import type { AudioAttachmentPreviewState } from '../../services/chatAudioPlayback';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, Share, Text, View } from 'react-native';
import { CHAT_AUDIO_PLAYBACK_MODE, getAudioAttachmentUniformTypeIdentifier, prepareChatAudioAttachmentShareUri, safePauseAudioPlayer, safePlayAudioPlayer, safeReplaceAudioPlayerSource } from '../../services/chatAudioPlayback';
import { clampAudioSeconds, formatAudioSeconds, formatByteCount, getErrorMessage } from '../../services/chatDisplayFormatting';
import { getAudioSeekSeconds, getReadableFileExtension } from '../../services/chatMessagePreview';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The full-screen player for an audio attachment.
 *
 * Lifted out of the Admin chat screen unchanged.
 */

export function AudioAttachmentPreviewModal({
  onClose,
  state
}: {
  onClose: () => void;
  state: AudioAttachmentPreviewState | null;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [sourceUri, setSourceUri] = useState(state?.localUri || '');
  const [isSharingAudio, setIsSharingAudio] = useState(false);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const player = useAudioPlayer(state?.localUri ? { uri: state.localUri } : null, {
    keepAudioSessionActive: true,
    updateInterval: 250
  });
  const status = useAudioPlayerStatus(player);
  const playbackProgress = status.duration > 0
    ? Math.max(0, Math.min(status.currentTime / status.duration, 1))
    : 0;
  const currentLabel = status.currentTime > 0 ? formatAudioSeconds(status.currentTime) : '0:00';
  const durationLabel = status.duration > 0 ? formatAudioSeconds(status.duration) : '--:--';

  useEffect(() => {
    const nextUri = state?.localUri || '';

    setSourceUri(nextUri);

    if (!nextUri) {
      safePauseAudioPlayer(player);
      return;
    }

    try {
      safeReplaceAudioPlayerSource(player, nextUri);
    } catch {
      return;
    }

    const timer = setTimeout(() => {
      try {
        void setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
        safePlayAudioPlayer(player);
      } catch {
        // The user can still press play if the native player needs another moment to load.
      }
    }, 180);

    return () => {
      clearTimeout(timer);
    };
  }, [player, state?.localUri]);

  useEffect(() => () => {
    safePauseAudioPlayer(player);
  }, [player]);

  if (!state) {
    return null;
  }

  function handleTogglePlayback() {
    if (!sourceUri) {
      return;
    }

    try {
      if (status.playing) {
        safePauseAudioPlayer(player);
        return;
      }

      if (status.didJustFinish) {
        void player.seekTo(0).catch(() => undefined);
      } else if (status.duration > 0 && status.currentTime >= status.duration - 0.08) {
        void player.seekTo(0).catch(() => undefined);
      }

      void setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
      safePlayAudioPlayer(player);
    } catch (error) {
      Alert.alert('Audio unavailable', getErrorMessage(error, 'Unable to play this audio.'));
    }
  }

  function handleSeekPreviewAudio(locationX: number) {
    if (!status.duration || timelineWidth <= 0) {
      return;
    }

    void player.seekTo(getAudioSeekSeconds(locationX, timelineWidth, status.duration)).catch(() => undefined);
  }

  function handleSkipPreviewAudio(seconds: number) {
    if (!status.duration) {
      return;
    }

    const nextSeconds = clampAudioSeconds(status.currentTime + seconds, status.duration);

    void player.seekTo(nextSeconds).catch(() => undefined);
  }

  async function handleSharePreviewAudio() {
    if (!state || !sourceUri || isSharingAudio) {
      return;
    }

    try {
      setIsSharingAudio(true);
      const isAvailable = await ExpoSharing.isAvailableAsync();

      if (!isAvailable) {
        throw new Error('Native sharing is not available on this device.');
      }

      const shareUri = await prepareChatAudioAttachmentShareUri(state, sourceUri);

      await ExpoSharing.shareAsync(shareUri, {
        dialogTitle: 'Synzapp Audio Track',
        mimeType: state.contentType || 'audio/mpeg',
        UTI: getAudioAttachmentUniformTypeIdentifier(state.contentType, state.fileName)
      });
    } catch (error) {
      Alert.alert('Share unavailable', getErrorMessage(error, 'Unable to share this audio.'));
    } finally {
      setIsSharingAudio(false);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      transparent={false}
      visible
    >
      <View style={[
        styles.audioPreviewRoot,
        {
          backgroundColor: appTheme.colors.screen,
          paddingBottom: Math.max(insets.bottom + 20, 34),
          paddingTop: Math.max(insets.top + 14, 28)
        }
      ]}>
        <View style={styles.audioPreviewHeader}>
          <Pressable
            accessibilityLabel="Close audio player"
            accessibilityRole="button"
            onPress={onClose}
	            style={({ pressed }) => [
	              styles.audioPreviewCloseButton,
	              {
	                backgroundColor: appTheme.colors.surfaceElevated,
	                borderColor: appTheme.colors.border
	              },
	              pressed && styles.pressed
	            ]}
          >
            <Ionicons color={appTheme.colors.ink} name="close" size={24} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.audioPreviewHeaderTitle, { color: appTheme.colors.ink }]}>Audio</Text>
          <Pressable
            accessibilityLabel="Share audio"
            accessibilityRole="button"
            disabled={!sourceUri || isSharingAudio}
            onPress={() => {
              void handleSharePreviewAudio();
            }}
	            style={({ pressed }) => [
	              styles.audioPreviewShareButton,
	              {
	                backgroundColor: appTheme.colors.surfaceElevated,
	                borderColor: appTheme.colors.border
	              },
	              (!sourceUri || isSharingAudio) && styles.audioPreviewShareButtonDisabled,
	              pressed && styles.pressed
	            ]}
          >
            {isSharingAudio ? (
              <ActivityIndicator color={appTheme.colors.ink} size="small" />
            ) : (
              <Ionicons color={appTheme.colors.ink} name="share-outline" size={23} />
            )}
          </Pressable>
        </View>

        <View style={styles.audioPreviewContent}>
          <View style={[styles.audioPreviewFileIcon, { backgroundColor: appTheme.colors.primary }]}>
            <Feather color="#FFFFFF" name="music" size={32} />
          </View>
          <Text numberOfLines={2} style={[styles.audioPreviewFileName, { color: appTheme.colors.ink }]}>
            {state.fileName || 'Audio attachment'}
          </Text>
          <Text numberOfLines={1} style={[styles.audioPreviewFileMeta, { color: appTheme.colors.muted }]}>
            {getReadableFileExtension(state.fileName) || 'Audio'} • {formatByteCount(state.sizeBytes)}
          </Text>

          <View style={styles.audioPreviewPlayer}>
            <Pressable
              accessibilityLabel="Go back 10 seconds"
              accessibilityRole="button"
              onPress={() => handleSkipPreviewAudio(-10)}
	              style={({ pressed }) => [
	                styles.audioPreviewSkipButton,
	                {
	                  backgroundColor: appTheme.colors.surfaceElevated,
	                  borderColor: appTheme.colors.border
	                },
	                pressed && styles.pressed
	              ]}
            >
              <Ionicons color={appTheme.colors.primary} name="play-back" size={24} />
              <Text style={[styles.audioPreviewSkipText, { color: appTheme.colors.primary }]}>10</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={status.playing ? 'Pause audio' : 'Play audio'}
              accessibilityRole="button"
              onPress={handleTogglePlayback}
              style={({ pressed }) => [
                styles.audioPreviewPlayButton,
                { backgroundColor: appTheme.colors.primary },
                pressed && styles.pressed
              ]}
            >
              <Ionicons color="#FFFFFF" name={status.playing ? 'pause' : 'play'} size={30} />
            </Pressable>
            <Pressable
              accessibilityLabel="Go forward 10 seconds"
              accessibilityRole="button"
              onPress={() => handleSkipPreviewAudio(10)}
	              style={({ pressed }) => [
	                styles.audioPreviewSkipButton,
	                {
	                  backgroundColor: appTheme.colors.surfaceElevated,
	                  borderColor: appTheme.colors.border
	                },
	                pressed && styles.pressed
	              ]}
            >
              <Ionicons color={appTheme.colors.primary} name="play-forward" size={24} />
              <Text style={[styles.audioPreviewSkipText, { color: appTheme.colors.primary }]}>10</Text>
            </Pressable>
          </View>
          <View style={styles.audioPreviewTimelineWrap}>
            <View
              onLayout={(event) => setTimelineWidth(event.nativeEvent.layout.width)}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(event) => {
                event.stopPropagation?.();
                handleSeekPreviewAudio(event.nativeEvent.locationX);
              }}
              onResponderMove={(event) => {
                event.stopPropagation?.();
                handleSeekPreviewAudio(event.nativeEvent.locationX);
              }}
              onStartShouldSetResponder={() => true}
              style={styles.audioPreviewTrackHitArea}
            >
              <View style={[styles.audioPreviewTrack, { backgroundColor: appTheme.colors.border }]}>
                <View
                  style={[
                    styles.audioPreviewTrackFill,
                    {
                      backgroundColor: appTheme.colors.primary,
                      width: `${Math.round(playbackProgress * 100)}%`
                    }
                  ]}
                />
                <View
                  style={[
                    styles.audioPreviewTrackThumb,
                    {
                      backgroundColor: appTheme.colors.surfaceElevated,
                      borderColor: appTheme.colors.primary,
                      left: `${Math.round(playbackProgress * 100)}%`
                    }
                  ]}
                />
              </View>
            </View>
            <View style={styles.audioPreviewTimeRow}>
              <Text style={[styles.audioPreviewTimeText, { color: appTheme.colors.muted }]}>{currentLabel}</Text>
              <Text style={[styles.audioPreviewTimeText, { color: appTheme.colors.muted }]}>{durationLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
