import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { ChatTranscriptLanguageCode, ChatTranscriptLanguageSetting } from '../../services/chatApi';
import { TranscriptLanguageOption, chatTranscriptLanguageOptions } from '../../components/contacts/ContactInfoModal';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { normalizeSearchQuery } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Transcript language selection.
 *
 * Lifted out of the chat screen unchanged.
 */

export function DirectChatTranscriptLanguageModal({
  chat,
  isLoading,
  isOpen,
  isSaving,
  onChangeSearch,
  onClose,
  onSelectLanguage,
  search,
  transcriptLanguage
}: {
  chat: ChatItem | null;
  isLoading: boolean;
  isOpen: boolean;
  isSaving: boolean;
  onChangeSearch: (value: string) => void;
  onClose: () => void;
  onSelectLanguage: (languageCode: ChatTranscriptLanguageCode) => void;
  search: string;
  transcriptLanguage: ChatTranscriptLanguageSetting | null;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  if (!chat || chat.chatType === 'GROUP') {
    return null;
  }

  const selectedLanguage = transcriptLanguage || getDefaultChatTranscriptLanguage(chat.contactId);
  const onDeviceLanguages = filterTranscriptLanguageOptions(
    chatTranscriptLanguageOptions.filter((option) => option.status === 'onDevice'),
    search
  );
  const availableLanguages = filterTranscriptLanguageOptions(
    chatTranscriptLanguageOptions.filter((option) => option.status === 'available'),
    search
  );
  const hasMatches = onDeviceLanguages.length > 0 || availableLanguages.length > 0;

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
        styles.transcriptLanguageScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.transcriptLanguageTopBar}>
          <Pressable
            accessibilityLabel="Back to contact info"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.groupInfoTopButton,
              { backgroundColor: appTheme.colors.surface },
              pressed && styles.pressed
            ]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={22} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.transcriptLanguageTitle, { color: appTheme.colors.ink }]}>Chat transcript language</Text>
          <View style={styles.groupInfoTopButtonSpacer} />
        </View>

        <View style={styles.transcriptLanguageSearchWrap}>
          <ChatSearchBar
            onChangeText={onChangeSearch}
            placeholder="Search"
            value={search}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.transcriptLanguageContent}
          keyboardDismissMode={getKeyboardDismissMode()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.transcriptLanguageNote, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <Text style={[styles.transcriptLanguageNoteText, { color: appTheme.colors.muted }]}>
              This language is for transcripts in this chat only. To change the language for all transcripts, go to Transcript language in Settings.
            </Text>
          </View>

          <TranscriptLanguageSection
            disabled={isSaving}
            languages={onDeviceLanguages}
            onSelectLanguage={onSelectLanguage}
            selectedLanguageCode={selectedLanguage.languageCode}
            title="On Device"
          />

          <TranscriptLanguageSection
            disabled={isSaving}
            languages={availableLanguages}
            onSelectLanguage={onSelectLanguage}
            selectedLanguageCode={selectedLanguage.languageCode}
            title="Available to download"
          />

          {!hasMatches ? (
            <Text style={[styles.transcriptLanguageEmpty, { color: appTheme.colors.muted }]}>No languages found</Text>
          ) : null}

          {isLoading || isSaving ? (
            <View style={styles.notificationSettingsLoadingRow}>
              <ActivityIndicator color={appTheme.colors.primary} />
              <Text style={[styles.notificationSettingsLoadingText, { color: appTheme.colors.muted }]}>
                {isSaving ? 'Saving language...' : 'Loading language...'}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function TranscriptLanguageSection({
  disabled,
  languages,
  onSelectLanguage,
  selectedLanguageCode,
  title
}: {
  disabled: boolean;
  languages: TranscriptLanguageOption[];
  onSelectLanguage: (languageCode: ChatTranscriptLanguageCode) => void;
  selectedLanguageCode: ChatTranscriptLanguageCode;
  title: string;
}) {
  const appTheme = useAppTheme();

  if (!languages.length) {
    return null;
  }

  return (
    <View style={styles.transcriptLanguageSectionWrap}>
      <Text style={[styles.transcriptLanguageSectionTitle, { color: appTheme.colors.muted }]}>{title}</Text>
      <View style={[styles.transcriptLanguageSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
        {languages.map((language) => (
          <TranscriptLanguageRow
            disabled={disabled}
            isSelected={language.code === selectedLanguageCode}
            key={language.code}
            language={language}
            onSelect={() => onSelectLanguage(language.code)}
          />
        ))}
      </View>
    </View>
  );
}

function TranscriptLanguageRow({
  disabled,
  isSelected,
  language,
  onSelect
}: {
  disabled: boolean;
  isSelected: boolean;
  language: TranscriptLanguageOption;
  onSelect: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={language.label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.transcriptLanguageRow,
        {
          backgroundColor: appTheme.colors.surfaceElevated,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <Text numberOfLines={1} style={[styles.transcriptLanguageRowText, { color: appTheme.colors.ink }]}>{language.label}</Text>
      {isSelected ? (
        <Feather color={appTheme.colors.success} name="check" size={20} />
      ) : null}
    </Pressable>
  );
}

export function getDefaultChatTranscriptLanguage(contactId: string): ChatTranscriptLanguageSetting {
  return {
    contactId,
    languageCode: 'en-US',
    updatedAt: null
  };
}

function filterTranscriptLanguageOptions(
  languages: TranscriptLanguageOption[],
  search: string
): TranscriptLanguageOption[] {
  const query = normalizeSearchQuery(search);

  if (!query) {
    return languages;
  }

  return languages.filter((language) =>
    normalizeSearchQuery(`${language.label} ${language.code}`).includes(query)
  );
}
