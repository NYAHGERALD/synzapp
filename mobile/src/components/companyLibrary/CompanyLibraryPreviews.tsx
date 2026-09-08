import * as ExpoSharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useState } from 'react';
import type { CompanyLibraryItem } from '../../services/companyLibraryApi';
import { ActivityIndicator, Alert, Modal, Pressable, Share, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { cacheCompanyLibraryVideoThumbnailFromFile } from '../../services/companyLibraryVideoThumbnails';
import { formatByteCount, getErrorMessage } from '../../services/chatDisplayFormatting';
import { formatCompanyLibraryDate, getCompanyLibraryDisplayName } from '../../services/companyLibraryDisplay';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Company Library preview modals.
 *
 * Lifted out of the chat screen unchanged.
 */

export const companyLibraryVideoPreviewDirectory = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}Synzapp/LibraryVideo/`
  : '';

/**
 * Share control for the Library viewers.
 *
 * Sharing hands the system a file, so the caller supplies a resolver that
 * produces one. A video already has its file on disk — it was fetched to play —
 * so sharing is immediate; a photo is fetched on demand.
 */
export function CompanyLibraryShareButton({
  contentType,
  fileName,
  resolveLocalUri
}: {
  contentType?: string | null;
  fileName: string;
  resolveLocalUri: () => Promise<string | null>;
}) {
  const appTheme = useAppTheme();
  const [isSharing, setIsSharing] = useState(false);

  async function handleShare() {
    if (isSharing) {
      return;
    }

    try {
      setIsSharing(true);

      if (!await ExpoSharing.isAvailableAsync()) {
        throw new Error('Sharing is not available on this device.');
      }

      const localUri = await resolveLocalUri();

      if (!localUri) {
        throw new Error('This file is still being prepared. Try again in a moment.');
      }

      await ExpoSharing.shareAsync(localUri, {
        dialogTitle: fileName,
        mimeType: contentType || undefined
      });
    } catch (error) {
      Alert.alert('Share unavailable', getErrorMessage(error, 'Unable to share this file.'));
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <Pressable
      accessibilityLabel={`Share ${fileName}`}
      accessibilityRole="button"
      disabled={isSharing}
      onPress={handleShare}
      style={({ pressed }) => [
        styles.companyLibraryPreviewButton,
        {
          backgroundColor: appTheme.colors.surfaceElevated,
          borderColor: appTheme.colors.border
        },
        pressed && styles.pressed,
        isSharing && styles.disabled
      ]}
    >
      {isSharing ? (
        <ActivityIndicator color={appTheme.colors.ink} size="small" />
      ) : (
        <Feather color={appTheme.colors.ink} name="share" size={20} />
      )}
    </Pressable>
  );
}

export function CompanyLibraryVideoPreviewContent({
  fileHeaders,
  item,
  onClose
}: {
  fileHeaders?: Record<string, string>;
  item: CompanyLibraryItem;
  onClose: () => void;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Fetch the bytes before asking the player for them; a Library URL needs an
  // Authorization header the native player will not send.
  useEffect(() => {
    let isActive = true;

    setLocalUri(null);
    setDownloadError(null);
    setDownloadProgress(0);

    void prepareCompanyLibraryVideoPreviewUri(item, fileHeaders, (progress) => {
      if (isActive) {
        setDownloadProgress(progress);
      }
    })
      .then((uri) => {
        if (isActive) {
          setLocalUri(uri);
          // The list has no poster for this video until it has been on the
          // device once. Now that it is, remember one.
          void cacheCompanyLibraryVideoThumbnailFromFile(item.evidenceId, uri);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setDownloadError(getErrorMessage(error, 'This Library video could not be opened.'));
        }
      });

    return () => {
      isActive = false;
    };
  }, [fileHeaders, item]);

  const player = useVideoPlayer(localUri ? { uri: localUri } : null, (nextPlayer) => {
    nextPlayer.loop = false;
    nextPlayer.play();
  });

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      transparent={false}
      visible
    >
      <View style={[styles.companyLibraryPreviewScreen, { backgroundColor: appTheme.colors.screen }]}>
        <View style={[
          styles.companyLibraryPreviewHeader,
          {
            borderBottomColor: appTheme.colors.divider,
            paddingTop: Math.max(insets.top + 10, 24)
          }
        ]}>
          <Pressable
            accessibilityLabel="Close video"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.companyLibraryPreviewButton,
              {
                backgroundColor: appTheme.colors.surfaceElevated,
                borderColor: appTheme.colors.border
              },
              pressed && styles.pressed
            ]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.companyLibraryPreviewTitleWrap}>
            <Text numberOfLines={1} style={[styles.companyLibraryPreviewTitle, { color: appTheme.colors.ink }]}>
              {getCompanyLibraryDisplayName(item)}
            </Text>
            <Text numberOfLines={1} style={[styles.companyLibraryPreviewMeta, { color: appTheme.colors.muted }]}>
              {[item.uploadedByName, formatCompanyLibraryDate(item.uploadedAtIso)].filter(Boolean).join(' • ')}
            </Text>
          </View>
          <CompanyLibraryShareButton
            contentType={item.contentType}
            fileName={getCompanyLibraryDisplayName(item)}
            resolveLocalUri={async () => localUri}
          />
        </View>
        {downloadError ? (
          <View style={[styles.companyLibraryPreviewImage, styles.companyLibraryPreviewState]}>
            <Feather color={appTheme.colors.muted} name="alert-circle" size={26} />
            <Text style={[styles.companyLibraryPreviewStateText, { color: appTheme.colors.muted }]}>
              {downloadError}
            </Text>
          </View>
        ) : !localUri ? (
          <View style={[styles.companyLibraryPreviewImage, styles.companyLibraryPreviewState]}>
            <ActivityIndicator color={appTheme.colors.primary} />
            <Text style={[styles.companyLibraryPreviewStateText, { color: appTheme.colors.muted }]}>
              {downloadProgress > 0
                ? `Preparing video — ${Math.round(downloadProgress * 100)}%`
                : 'Preparing video…'}
            </Text>
          </View>
        ) : (
          <VideoView
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
            nativeControls
            player={player}
            style={[
              styles.companyLibraryPreviewImage,
              { backgroundColor: appTheme.colors.screen }
            ]}
          />
        )}
        <View style={[
          styles.companyLibraryPreviewFooter,
          {
            borderTopColor: appTheme.colors.divider,
            paddingBottom: Math.max(insets.bottom, 12)
          }
        ]}>
          <Text numberOfLines={1} style={[styles.companyLibraryPreviewFooterText, { color: appTheme.colors.muted }]}>
            Library video • {formatByteCount(item.fileSizeBytes || 0)}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Brings a Library video onto the device so it can actually be played.
 *
 * Library files live behind an authenticated URL, and neither the video player
 * nor the thumbnail generator passes an Authorization header down to the native
 * media stack — the player just fails to load. Fetching the bytes first and
 * playing from disk is the same approach Library audio already uses, and it is
 * why audio worked while video showed a broken-file marker.
 */
async function prepareCompanyLibraryVideoPreviewUri(
  item: CompanyLibraryItem,
  fileHeaders?: Record<string, string>,
  onProgress?: (progress: number) => void
): Promise<string> {
  const sourceUri = (item.fileUrl || '').trim();

  if (!sourceUri) {
    throw new Error('This Library video is not available.');
  }

  if (sourceUri.startsWith('file://') || sourceUri.startsWith('data:')) {
    return sourceUri;
  }

  if (!/^https?:\/\//i.test(sourceUri)) {
    return sourceUri;
  }

  if (!companyLibraryVideoPreviewDirectory) {
    throw new Error('Video playback is not available on this device.');
  }

  await FileSystem.makeDirectoryAsync(companyLibraryVideoPreviewDirectory, { intermediates: true })
    .catch(() => undefined);

  const localUri = `${companyLibraryVideoPreviewDirectory}${buildSafeCompanyLibraryVideoPreviewFileName(item)}`;
  const existingFile = await FileSystem.getInfoAsync(localUri).catch(() => null);

  if (existingFile?.exists && (existingFile.size || 0) > 0) {
    return localUri;
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    sourceUri,
    localUri,
    fileHeaders ? { headers: fileHeaders } : undefined,
    (progress) => {
      const total = progress.totalBytesExpectedToWrite || item.fileSizeBytes || 0;

      if (total > 0) {
        onProgress?.(Math.min(Math.max(progress.totalBytesWritten / total, 0), 1));
      }
    }
  );

  const result = await downloadResumable.downloadAsync();

  if (!result?.uri) {
    throw new Error('This Library video could not be downloaded.');
  }

  return result.uri;
}

function buildSafeCompanyLibraryVideoPreviewFileName(item: CompanyLibraryItem): string {
  const safeId = (item.evidenceId || 'library_video').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96);

  return `${safeId}.mp4`;
}
