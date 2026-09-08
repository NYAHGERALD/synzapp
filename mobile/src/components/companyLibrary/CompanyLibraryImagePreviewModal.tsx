import * as FileSystem from 'expo-file-system/legacy';
import Feather from '@expo/vector-icons/Feather';
import type { CompanyLibraryItem } from '../../services/companyLibraryApi';
import { CompanyLibraryShareButton, companyLibraryVideoPreviewDirectory } from '../../components/companyLibrary/CompanyLibraryPreviews';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { formatCompanyLibraryDate, getCompanyLibraryDisplayName, getCompanyLibraryExtension, getCompanyLibraryKind, getCompanyLibraryPhotoSource } from '../../services/companyLibraryDisplay';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The Library photo viewer.
 *
 * Lifted out of the chat screen unchanged.
 */

/**
 * Brings any Library file onto the device so it can be shared or saved.
 *
 * Library files sit behind an authenticated URL, so the share sheet cannot be
 * handed the remote address — it would have no way to fetch it.
 */
async function prepareCompanyLibraryFileShareUri(
  item: CompanyLibraryItem,
  fileHeaders?: Record<string, string>
): Promise<string | null> {
  const sourceUri = (item.fileUrl || '').trim();

  if (!sourceUri) {
    return null;
  }

  if (sourceUri.startsWith('file://')) {
    return sourceUri;
  }

  if (!/^https?:\/\//i.test(sourceUri) || !companyLibraryVideoPreviewDirectory) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(companyLibraryVideoPreviewDirectory, { intermediates: true })
    .catch(() => undefined);

  const safeId = (item.evidenceId || 'library_file').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96);
  const extension = (getCompanyLibraryExtension(item) || 'bin').slice(0, 8);
  const localUri = `${companyLibraryVideoPreviewDirectory}${safeId}.${extension}`;
  const existingFile = await FileSystem.getInfoAsync(localUri).catch(() => null);

  if (existingFile?.exists && (existingFile.size || 0) > 0) {
    return localUri;
  }

  const result = await FileSystem.downloadAsync(
    sourceUri,
    localUri,
    fileHeaders ? { headers: fileHeaders } : undefined
  );

  return result?.uri || null;
}

export function CompanyLibraryImagePreviewModal({
  fileHeaders,
  item,
  onClose
}: {
  fileHeaders?: Record<string, string>;
  item: CompanyLibraryItem | null;
  onClose: () => void;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();

  if (!item || getCompanyLibraryKind(item) !== 'photos' || !item.fileUrl) {
    return null;
  }

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
            accessibilityLabel="Close image"
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
            resolveLocalUri={() => prepareCompanyLibraryFileShareUri(item, fileHeaders)}
          />
        </View>
        <Image
          resizeMode="contain"
          source={getCompanyLibraryPhotoSource(item.fileUrl, fileHeaders)}
          style={[
            styles.companyLibraryPreviewImage,
            { backgroundColor: appTheme.colors.screen }
          ]}
        />
        <View style={[
          styles.companyLibraryPreviewFooter,
          {
            borderTopColor: appTheme.colors.divider,
            paddingBottom: Math.max(insets.bottom, 12)
          }
        ]}>
          <Text numberOfLines={1} style={[styles.companyLibraryPreviewFooterText, { color: appTheme.colors.muted }]}>
            Library photo
          </Text>
        </View>
      </View>
    </Modal>
  );
}
