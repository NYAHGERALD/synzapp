import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatMediaAttachment, ChatMessage } from '../../services/chatApi';
import {
  clampAudioSeconds,
  formatAudioSeconds,
  formatByteCount,
  formatMessageDateTime,
  getErrorMessage,
  getMediaPreviewUri,
  getMediaTransferLabel
} from '../../services/chatDisplayFormatting';
import { getMediaLocalUri } from '../../services/chatMessageReconciliation';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

/**
 * The full-screen media viewer.
 *
 * Lifted out of the Admin chat screen unchanged. It is one of the few parts of
 * that screen with a genuinely narrow contract — it is handed a list of
 * attachments and a set of callbacks, and owns nothing else — which is what made
 * it the next seam worth taking after the stylesheet.
 *
 * The album behaviour worth not losing: only the slide the user is actually on
 * plays. Every slide calling play() on mount is how an album of videos ended up
 * playing all of them at once.
 */

export interface MediaViewerState {
  activeIndex: number;
  items: ChatMediaAttachment[];
  sourceMessage: ChatMessage;
  title: string;
}

export function MediaViewerModal({
  onClose,
  onDelete,
  onEditPhoto,
  onForward,
  onInfo,
  onReply,
  onShare,
  onStar,
  starred,
  state
}: {
  onClose: () => void;
  onDelete: (message: ChatMessage) => void;
  onEditPhoto: (media: ChatMediaAttachment, message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onInfo: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onShare: (media: ChatMediaAttachment, message: ChatMessage) => void | Promise<void>;
  onStar: (message: ChatMessage) => void;
  starred: boolean;
  state: MediaViewerState | null;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(state?.activeIndex || 0);

  useEffect(() => {
    if (!state) {
      return;
    }

    setActiveIndex(state.activeIndex);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        animated: false,
        x: state.activeIndex * width,
        y: 0
      });
    }, 40);
  }, [state?.activeIndex, state?.items.length, width]);

  if (!state) {
    return null;
  }

  const activeMedia = state.items[activeIndex] || state.items[0];
  const viewerHeight = Math.max(260, height - insets.top - insets.bottom - 178);
  const sourceMessage = state.sourceMessage;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      transparent={false}
      visible
    >
      <View style={[styles.mediaViewerRoot, { backgroundColor: appTheme.colors.screen }]}>
        <View style={[
          styles.mediaViewerTopBar,
          {
            backgroundColor: appTheme.colors.screen,
            borderBottomColor: appTheme.colors.divider,
            paddingTop: Math.max(insets.top + 8, 20)
          }
        ]}>
          <Pressable
            accessibilityLabel="Close media viewer"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.mediaViewerCloseButton,
              {
                backgroundColor: appTheme.colors.surfaceElevated,
                borderColor: appTheme.colors.border,
                borderWidth: StyleSheet.hairlineWidth
              },
              pressed && styles.pressed
            ]}
          >
            <Ionicons color={appTheme.colors.ink} name="chevron-back" size={26} />
          </Pressable>
          <View style={styles.mediaViewerTitleWrap}>
            <Text numberOfLines={1} style={[styles.mediaViewerTitle, { color: appTheme.colors.ink }]}>{state.title}</Text>
            <Text numberOfLines={1} style={[styles.mediaViewerSubtitle, { color: appTheme.colors.muted }]}>
              {formatMessageDateTime(sourceMessage.sentAt)}
            </Text>
          </View>
          {activeMedia?.kind === 'image' ? (
            <Pressable
              accessibilityLabel="Edit photo"
              accessibilityRole="button"
              onPress={() => onEditPhoto(activeMedia, sourceMessage)}
              style={({ pressed }) => [
                styles.mediaViewerTopActionButton,
                {
                  backgroundColor: appTheme.colors.surfaceElevated,
                  borderColor: appTheme.colors.border,
                  borderWidth: StyleSheet.hairlineWidth
                },
                pressed && styles.pressed
              ]}
            >
              <Feather color={appTheme.colors.ink} name="edit-2" size={18} />
            </Pressable>
          ) : null}
          {activeMedia?.kind !== 'image' ? (
            <Pressable
              accessibilityLabel="Media information"
              accessibilityRole="button"
              onPress={() => onInfo(sourceMessage)}
              style={({ pressed }) => [
                styles.mediaViewerTopActionButton,
                {
                  backgroundColor: appTheme.colors.surfaceElevated,
                  borderColor: appTheme.colors.border,
                  borderWidth: StyleSheet.hairlineWidth
                },
                pressed && styles.pressed
              ]}
            >
              <Feather color={appTheme.colors.ink} name="more-horizontal" size={20} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));

            setActiveIndex(Math.max(0, Math.min(nextIndex, state.items.length - 1)));
          }}
          pagingEnabled
          ref={scrollViewRef}
          showsHorizontalScrollIndicator={false}
          style={styles.mediaViewerPager}
        >
          {state.items.map((media, index) => {
            const localUri = getMediaLocalUri(media);
            const previewUri = getMediaPreviewUri(media);

            return (
              <View
                key={`${media.mediaId || media.localUri || media.fileName}_${index}`}
                style={[
                  styles.mediaViewerSlide,
                  {
                    height: viewerHeight,
                    width
                  }
                ]}
              >
                {media.kind === 'video' && localUri ? (
                  <MediaViewerVideoSlide
                    fileName={media.fileName}
                    // Only the slide on screen plays. Every slide used to start
                    // itself on mount, so opening an album of videos played all
                    // of them at once with the audio overlapping.
                    isActive={index === activeIndex}
                    media={media}
                    posterUri={previewUri}
                    uri={localUri}
                  />
                ) : media.kind === 'image' && previewUri ? (
                  <Image
                    resizeMode="contain"
                    source={{ uri: previewUri }}
                    style={styles.mediaViewerImage}
                  />
                ) : media.kind === 'video' && previewUri ? (
                  <View style={styles.mediaViewerVideoPoster}>
                    <Image
                      resizeMode="contain"
                      source={{ uri: previewUri }}
                      style={styles.mediaViewerImage}
                    />
                    <View style={styles.mediaViewerVideoPosterOverlay}>
                      <Feather color="#FFFFFF" name="download" size={22} />
                      <Text style={styles.mediaViewerUnavailableText}>
                        Downloading secure video when opened
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.mediaViewerUnavailable}>
                    <Ionicons
                      color={appTheme.colors.primary}
                      name={media.kind === 'video' ? 'play-circle' : 'image-outline'}
                      size={78}
                    />
                    <Text style={[styles.mediaViewerUnavailableTitle, { color: appTheme.colors.ink }]}>
                      {media.kind === 'video' ? 'Video preview' : 'Media not available'}
                    </Text>
                    <Text style={[styles.mediaViewerUnavailableText, { color: appTheme.colors.muted }]}>
                      {getMediaTransferLabel(media) || formatByteCount(media.sizeBytes)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={[
          styles.mediaViewerFooter,
          {
            backgroundColor: appTheme.colors.screen,
            borderTopColor: appTheme.colors.divider,
            paddingBottom: Math.max(insets.bottom + 8, 14)
          }
        ]}>
          <ScrollView
            contentContainerStyle={styles.mediaViewerThumbnailContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {state.items.map((media, index) => {
              const previewUri = getMediaPreviewUri(media);

              return (
                <Pressable
                  accessibilityLabel={`View media item ${index + 1}`}
                  accessibilityRole="button"
                  key={`${media.mediaId || media.localUri || media.fileName}_thumb_${index}`}
                  onPress={() => {
                    setActiveIndex(index);
                    scrollViewRef.current?.scrollTo({
                      animated: true,
                      x: index * width,
                      y: 0
                    });
                  }}
                  style={[
                    styles.mediaViewerThumbnail,
                    index === activeIndex && styles.mediaViewerThumbnailActive
                  ]}
                >
                  {previewUri ? (
                    <Image
                      resizeMode="cover"
                      source={{ uri: previewUri }}
                      style={styles.mediaViewerThumbnailImage}
                    />
                  ) : (
                    <View style={[styles.mediaViewerThumbnailPlaceholder, { backgroundColor: appTheme.colors.surface }]}>
                      <Feather color={appTheme.colors.primary} name={media.kind === 'video' ? 'play' : 'image'} size={15} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          {activeMedia ? (
            <View style={styles.mediaViewerActionRow}>
              <MediaViewerActionButton icon="share" label="Share" onPress={() => onShare(activeMedia, sourceMessage)} />
              <MediaViewerActionButton icon="corner-up-right" label="Forward" onPress={() => onForward(sourceMessage)} />
              <MediaViewerActionButton icon="corner-up-left" label="Reply" onPress={() => onReply(sourceMessage)} />
              <MediaViewerActionButton icon="star" label={starred ? 'Unstar' : 'Star'} onPress={() => onStar(sourceMessage)} />
              <MediaViewerActionButton destructive icon="trash-2" label="Delete" onPress={() => onDelete(sourceMessage)} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function MediaViewerVideoSlide({
  fileName,
  isActive,
  media,
  posterUri,
  uri
}: {
  fileName: string;
  isActive: boolean;
  media: ChatMediaAttachment;
  posterUri: string;
  uri: string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const videoViewRef = useRef<VideoView | null>(null);
  const speeds = [1, 1.5, 2];
  const player = useVideoPlayer({
    metadata: {
      artwork: posterUri || undefined,
      title: fileName || 'Synzapp video'
    },
    uri
  }, (nextPlayer) => {
    nextPlayer.loop = false;
    nextPlayer.timeUpdateEventInterval = 0.25;
  });

  // Playback follows which slide is on screen. Swiping to a video starts it and
  // pauses the one left behind, which is what stops several soundtracks playing
  // over each other in an album.
  useEffect(() => {
    if (isActive) {
      player.play();
      return;
    }

    player.pause();
  }, [isActive, player]);
  const playingEvent = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const timeEvent = useEvent(player, 'timeUpdate', {
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    currentTime: player.currentTime
  });
  const sourceEvent = useEvent(player, 'sourceLoad', {
    availableAudioTracks: [],
    availableSubtitleTracks: [],
    availableVideoTracks: [],
    duration: Math.max((media.durationMs || 0) / 1000, 0),
    videoSource: null
  });
  const durationSeconds = Math.max(sourceEvent.duration || player.duration || (media.durationMs || 0) / 1000, 0);
  const currentSeconds = Math.min(Math.max(timeEvent.currentTime || player.currentTime || 0, 0), Math.max(durationSeconds, 0));
  const playbackProgress = durationSeconds > 0 ? currentSeconds / durationSeconds : 0;
  const remainingSeconds = Math.max(durationSeconds - currentSeconds, 0);
  // Playback rarely reports the exact final frame, so treat the last fraction of
  // a second as finished. Otherwise the button falls back to resuming a video
  // that has nothing left to resume.
  const hasReachedEnd = durationSeconds > 0 &&
    !playingEvent.isPlaying &&
    !player.playing &&
    remainingSeconds <= 0.25;

  function handleTogglePlayback() {
    if (playingEvent.isPlaying || player.playing) {
      player.pause();
      return;
    }

    // At the end there is nothing left to resume, so play again from the start.
    // Without this the play button looked available but did nothing, and the
    // only way to watch again was the separate Replay control.
    if (hasReachedEnd) {
      handleRestartPlayback();
      return;
    }

    player.play();
  }

  function handleRestartPlayback() {
    player.currentTime = 0;
    player.play();
  }

  function handleToggleSpeed() {
    const nextSpeedIndex = (speedIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextSpeedIndex];

    setSpeedIndex(nextSpeedIndex);
    player.playbackRate = nextSpeed;
  }

  function handleSeek(locationX: number) {
    if (durationSeconds <= 0 || trackWidth <= 0) {
      return;
    }

    player.currentTime = clampAudioSeconds(durationSeconds * Math.min(Math.max(locationX / trackWidth, 0), 1), durationSeconds);
  }

  async function handleEnterFullscreen() {
    try {
      await videoViewRef.current?.enterFullscreen();
    } catch (error) {
      Alert.alert('Fullscreen unavailable', getErrorMessage(error, 'Unable to open this video in fullscreen.'));
    }
  }

  async function handleStartPictureInPicture() {
    try {
      await videoViewRef.current?.startPictureInPicture();
    } catch (error) {
      Alert.alert('Picture in Picture unavailable', getErrorMessage(error, 'This device does not support Picture in Picture for this video.'));
    }
  }

  return (
    <View style={styles.mediaViewerVideoShell}>
      <View style={styles.mediaViewerVideoControlsTop}>
        <Text style={styles.mediaViewerVideoTimeText}>{formatAudioSeconds(currentSeconds)}</Text>
        <View
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => {
            event.stopPropagation?.();
            handleSeek(event.nativeEvent.locationX);
          }}
          onResponderMove={(event) => {
            event.stopPropagation?.();
            handleSeek(event.nativeEvent.locationX);
          }}
          onStartShouldSetResponder={() => true}
          style={styles.mediaViewerVideoTrackHitArea}
        >
          <View style={styles.mediaViewerVideoTrack}>
            <View style={[
              styles.mediaViewerVideoTrackFill,
              { width: `${Math.round(playbackProgress * 100)}%` }
            ]} />
            <View style={[
              styles.mediaViewerVideoTrackThumb,
              { left: `${Math.round(playbackProgress * 100)}%` }
            ]} />
          </View>
        </View>
        <Text style={styles.mediaViewerVideoTimeText}>-{formatAudioSeconds(remainingSeconds)}</Text>
        <Pressable
          accessibilityLabel="Change playback speed"
          accessibilityRole="button"
          onPress={handleToggleSpeed}
          style={({ pressed }) => [styles.mediaViewerSpeedButton, pressed && styles.pressed]}
        >
          <Text style={styles.mediaViewerSpeedText}>{speeds[speedIndex]}x</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Open full screen"
          accessibilityRole="button"
          onPress={() => void handleEnterFullscreen()}
          style={({ pressed }) => [styles.mediaViewerSpeedButton, pressed && styles.pressed]}
        >
          <Feather color="#0F172A" name="maximize" size={16} />
        </Pressable>
        <Pressable
          accessibilityLabel="Start Picture in Picture"
          accessibilityRole="button"
          onPress={() => void handleStartPictureInPicture()}
          style={({ pressed }) => [styles.mediaViewerSpeedButton, pressed && styles.pressed]}
        >
          <Feather color="#0F172A" name="copy" size={16} />
        </Pressable>
      </View>
      <View style={styles.mediaViewerVideoStage}>
        {posterUri ? (
          <Image
            blurRadius={playingEvent.isPlaying || player.playing ? 0 : 1}
            // Must match the VideoView's contentFit below. On "cover" a
            // landscape still in a tall stage is scaled up until it covers and
            // cropped to a narrow strip, which is what made a video look
            // stretched before it was played. The poster stands in for the
            // video, so it has to be framed like the video.
            resizeMode="contain"
            source={{ uri: posterUri }}
            style={[
              styles.mediaViewerVideoPosterImage,
              (playingEvent.isPlaying || player.playing) && styles.mediaViewerVideoPosterImageHidden
            ]}
          />
        ) : null}
        <VideoView
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={false}
          player={player}
          ref={videoViewRef}
          style={styles.mediaViewerVideo}
        />
        <Pressable
          accessibilityLabel={playingEvent.isPlaying || player.playing ? 'Pause video' : 'Play video'}
          accessibilityRole="button"
          onPress={handleTogglePlayback}
          style={({ pressed }) => [
            styles.mediaViewerVideoCenterButton,
            pressed && styles.pressed
          ]}
        >
          <Ionicons
            color="#0F172A"
            name={playingEvent.isPlaying || player.playing ? 'pause' : 'play'}
            size={32}
          />
        </Pressable>
        <View style={styles.mediaViewerVideoCaptionBar}>
          <Text numberOfLines={2} style={styles.mediaViewerVideoCaptionText}>
            {fileName || 'Synzapp video'}
          </Text>
          <Pressable
            accessibilityLabel="Reply to this video"
            accessibilityRole="button"
            onPress={handleRestartPlayback}
            style={({ pressed }) => [styles.mediaViewerVideoReplyPill, pressed && styles.pressed]}
          >
            <Feather color="#FFFFFF" name="rotate-ccw" size={15} />
            <Text style={styles.mediaViewerVideoReplyText}>Replay</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MediaViewerActionButton({
  destructive = false,
  icon,
  label,
  onPress
}: {
  destructive?: boolean;
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.mediaViewerActionButton, pressed && styles.pressed]}
    >
      <Feather color={destructive ? appTheme.colors.destructive : appTheme.colors.ink} name={icon} size={22} />
    </Pressable>
  );
}
