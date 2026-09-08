import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef } from 'react';
import type { ChatMediaQualityMode } from '../../services/chatMediaApi';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LocalChatMediaInput } from '../../services/chatMediaApi';
import { formatByteCount } from '../../services/chatDisplayFormatting';
import { formatMediaDuration } from '../../services/chatMessagePreview';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The sheet shown before attachments are sent.
 *
 * Lifted out of the Admin chat screen unchanged. It owns the pending selection
 * and its captions, and hands back a list — it reads none of the screen's state,
 * which is what made it separable.
 */

export interface MediaReviewItem {
  id: string;
  media: LocalChatMediaInput;
}

function getLocalChatMediaPreviewUri(media: LocalChatMediaInput | null): string {
  if (!media) {
    return '';
  }

  return media.thumbnailDataUrl || (media.kind === 'image' ? media.uri : '');
}

export function MediaReviewModal({
  activeIndex,
  caption,
  contactName,
  isSending,
  items,
  onCancel,
  onCaptionChange,
  onQualityModeChange,
  onFlipItem,
  onRemoveItem,
  onSelectIndex,
  onSend,
  qualityMode
}: {
  activeIndex: number;
  caption: string;
  contactName: string;
  isSending: boolean;
  items: MediaReviewItem[];
  onCancel: () => void;
  onCaptionChange: (value: string) => void;
  onFlipItem?: (index: number) => void;
  onQualityModeChange: (value: ChatMediaQualityMode) => void;
  onRemoveItem: (index: number) => void;
  onSelectIndex: (index: number) => void;
  onSend: () => void;
  qualityMode: ChatMediaQualityMode;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const activeItem = items[activeIndex] || null;
  const captionInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const previewHeight = Math.max(280, height - insets.top - insets.bottom - 236);
  const activeMediaLabel = activeItem?.media.kind === 'video'
    ? 'Video'
    : activeItem?.media.kind === 'image'
      ? 'Photo'
      : 'Media';
  const previewControlBackground = appTheme.colors.surfaceElevated;
  const previewStageBackground = appTheme.isDark ? appTheme.colors.background : appTheme.colors.screen;
  const previewTintColor = appTheme.colors.ink;
  const previewMutedColor = appTheme.colors.muted;

  useEffect(() => {
    if (!items.length) {
      return;
    }

    scrollViewRef.current?.scrollTo({ animated: true, x: activeIndex * width, y: 0 });
  }, [activeIndex, items.length, width]);

  if (!items.length || !activeItem) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.mediaReviewRoot, { backgroundColor: previewStageBackground }]}
      >
        <View style={[
          styles.mediaReviewTopBar,
          {
            backgroundColor: appTheme.colors.screen,
            borderBottomColor: appTheme.colors.divider,
            paddingTop: Math.max(insets.top + 8, 20)
          }
        ]}>
          <Pressable
            accessibilityLabel="Close media preview"
            accessibilityRole="button"
            disabled={isSending}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.mediaReviewIconButton,
              {
                backgroundColor: previewControlBackground,
                borderColor: appTheme.colors.border,
                borderWidth: StyleSheet.hairlineWidth
              },
              pressed && !isSending && styles.pressed
            ]}
          >
            <Ionicons color={previewTintColor} name="close" size={24} />
          </Pressable>

          <View style={styles.mediaReviewTitleWrap}>
            <Text numberOfLines={1} style={[styles.mediaReviewTitle, { color: appTheme.colors.ink }]}>Preview</Text>
            <Text numberOfLines={1} style={[styles.mediaReviewSubtitle, { color: previewMutedColor }]}>
              {items.length > 1 ? `${items.length} selected` : activeMediaLabel}
            </Text>
          </View>

          <View style={styles.mediaReviewTools}>
            <Pressable
              accessibilityLabel={qualityMode === 'hd' ? 'Send media in standard quality' : 'Send media in HD quality'}
              accessibilityRole="switch"
              accessibilityState={{ checked: qualityMode === 'hd' }}
              onPress={() => onQualityModeChange(qualityMode === 'hd' ? 'standard' : 'hd')}
              style={({ pressed }) => [
                styles.mediaReviewQualityPill,
                {
                  backgroundColor: qualityMode === 'hd' ? appTheme.colors.primarySoft : previewControlBackground,
                  borderColor: qualityMode === 'hd' ? appTheme.colors.primary : appTheme.colors.border
                },
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.mediaReviewQualityText, { color: qualityMode === 'hd' ? appTheme.colors.primary : appTheme.colors.ink }]}>
                {qualityMode === 'hd' ? 'HD' : 'Standard'}
              </Text>
            </Pressable>
            {onFlipItem && activeItem?.media.kind === 'image' ? (
              <Pressable
                accessibilityLabel="Flip this photo left to right"
                accessibilityRole="button"
                onPress={() => onFlipItem(activeIndex)}
                style={({ pressed }) => [
                  styles.mediaReviewToolPill,
                  {
                    backgroundColor: previewControlBackground,
                    borderColor: appTheme.colors.border
                  },
                  pressed && styles.pressed
                ]}
              >
                <Feather color={appTheme.colors.ink} name="repeat" size={16} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="Add caption text"
              accessibilityRole="button"
              onPress={() => captionInputRef.current?.focus()}
              style={({ pressed }) => [
                styles.mediaReviewToolPill,
                {
                  backgroundColor: previewControlBackground,
                  borderColor: appTheme.colors.border,
                  borderWidth: StyleSheet.hairlineWidth
                },
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.mediaReviewToolText, { color: previewTintColor }]}>Aa</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Remove selected media"
              accessibilityRole="button"
              disabled={isSending}
              onPress={() => onRemoveItem(activeIndex)}
              style={({ pressed }) => [
                styles.mediaReviewToolPill,
                {
                  backgroundColor: previewControlBackground,
                  borderColor: appTheme.colors.border,
                  borderWidth: StyleSheet.hairlineWidth
                },
                pressed && !isSending && styles.pressed,
                isSending && styles.disabled
              ]}
            >
              <Feather color={appTheme.colors.destructive} name="trash-2" size={18} />
            </Pressable>
          </View>
        </View>

        <View style={[
          styles.mediaReviewThumbnailBand,
          {
            borderBottomColor: appTheme.colors.divider,
            borderTopColor: appTheme.colors.divider
          }
        ]}>
          <ScrollView
            contentContainerStyle={styles.mediaReviewThumbnailContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {items.map((item, index) => {
              const previewUri = getLocalChatMediaPreviewUri(item.media);

              return (
                <Pressable
                  accessibilityLabel={`Preview item ${index + 1}`}
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => onSelectIndex(index)}
                  style={[
                    styles.mediaReviewThumbnail,
                    index === activeIndex && styles.mediaReviewThumbnailActive
                  ]}
                >
                  {previewUri ? (
                  <Image
                    resizeMode="cover"
                    source={{ uri: previewUri }}
                    style={styles.mediaReviewThumbnailImage}
                  />
                  ) : (
                    <View style={[styles.mediaReviewThumbnailVideo, { backgroundColor: appTheme.colors.surface }]}>
                      <Feather color={appTheme.colors.primary} name="play" size={14} />
                    </View>
                  )}
                  {item.media.kind === 'video' ? (
                    <View style={styles.mediaReviewThumbnailPlayBadge}>
                      <Feather color="#FFFFFF" name="play" size={9} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
            onSelectIndex(nextIndex);
          }}
          pagingEnabled
          ref={scrollViewRef}
          showsHorizontalScrollIndicator={false}
          style={styles.mediaReviewPager}
        >
          {items.map((item, index) => {
            const previewUri = getLocalChatMediaPreviewUri(item.media);

            return (
              <View
                key={item.id}
                style={[
                  styles.mediaReviewSlide,
                  {
                    height: previewHeight,
                    width
                  }
                ]}
              >
              {previewUri ? (
                <Image
                  resizeMode="contain"
                  source={{ uri: previewUri }}
                  style={styles.mediaReviewPreviewImage}
                />
              ) : (
                <View style={[styles.mediaReviewVideoPreview, { backgroundColor: appTheme.colors.surface }]}>
                  <Ionicons color={appTheme.colors.primary} name="play-circle" size={78} />
                  <Text style={[styles.mediaReviewVideoMeta, { backgroundColor: appTheme.colors.surfaceElevated, color: appTheme.colors.ink }]}>
                    {formatMediaDuration(item.media.durationMs)} • {formatByteCount(item.media.sizeBytes)}
                  </Text>
                </View>
              )}
              {item.media.kind === 'video' && previewUri ? (
                <View style={styles.mediaReviewVideoPosterOverlay}>
                  <Text style={[styles.mediaReviewVideoMeta, { backgroundColor: appTheme.colors.surfaceElevated, color: appTheme.colors.ink }]}>
                    Video • {formatMediaDuration(item.media.durationMs)} • {formatByteCount(item.media.sizeBytes)}
                  </Text>
                </View>
              ) : null}

              {items.length > 1 ? (
                <Pressable
                  accessibilityLabel="Remove selected media"
                  accessibilityRole="button"
                  disabled={isSending}
                  onPress={() => onRemoveItem(index)}
                  style={({ pressed }) => [
                    styles.mediaReviewRemoveButton,
                    pressed && !isSending && styles.pressed
                  ]}
                >
                  <Feather color="#FFFFFF" name="trash-2" size={20} />
                </Pressable>
              ) : null}
            </View>
            );
          })}
        </ScrollView>

        <View style={[
          styles.mediaReviewFooter,
          {
            backgroundColor: appTheme.colors.screen,
            borderTopColor: appTheme.colors.divider,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingBottom: Math.max(insets.bottom + 10, 18)
          }
        ]}>
          <View style={[
            styles.mediaReviewCaptionRow,
            {
              backgroundColor: appTheme.colors.input,
              borderColor: appTheme.colors.border,
              borderWidth: StyleSheet.hairlineWidth
            }
          ]}>
            <Feather color={previewMutedColor} name="plus-square" size={18} />
            <TextInput
              autoCorrect
              multiline
              onChangeText={onCaptionChange}
              placeholder="Add a caption..."
              placeholderTextColor={previewMutedColor}
              ref={captionInputRef}
              style={[styles.mediaReviewCaptionInput, { color: appTheme.colors.ink }]}
              value={caption}
            />
            <Text style={[styles.mediaReviewInfoText, { color: previewMutedColor }]}>{activeIndex + 1}/{items.length}</Text>
          </View>

          <View style={styles.mediaReviewSendRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.mediaReviewRecipient,
                {
                  backgroundColor: appTheme.colors.surfaceElevated,
                  borderColor: appTheme.colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  color: appTheme.colors.ink
                }
              ]}
            >
              {contactName || 'Chat'}
            </Text>
            <Pressable
              accessibilityLabel="Send selected media"
              accessibilityRole="button"
              disabled={isSending}
              onPress={onSend}
              style={({ pressed }) => [
                styles.mediaReviewSendButton,
                pressed && !isSending && styles.pressed,
                isSending && styles.disabled
              ]}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  {items.length > 1 ? (
                    <View style={[styles.mediaReviewSendCount, { borderColor: appTheme.colors.screen }]}>
                      <Text style={styles.mediaReviewSendCountText}>{items.length}</Text>
                    </View>
                  ) : null}
                  <Ionicons color="#FFFFFF" name="send" size={22} />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
