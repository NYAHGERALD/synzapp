import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { ChatTranscriptLanguageCode, ChatTranscriptLanguageSetting } from '../../services/chatApi';
import { CircleIconButton, CircleIconSpacer } from '../../components/ui/CircleIconButton';
import { ListSection } from '../../components/ui/GroupedList';
import { TranscriptLanguageOption, chatTranscriptLanguageOptions } from '../../components/contacts/ContactInfoModal';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { normalizeSearchQuery } from '../../components/messages/MessageThread';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Transcript language selection.
 *
 * The app's grouped list: a tinted page, rounded cards, hairline dividers, and
 * quiet section labels rather than headings that shout. The two groups are the
 * only thing that matters on the screen — what this phone can already do, and
 * what it would have to fetch — so they are what the cards separate.
 *
 * The search field stays above the scroll rather than in it. Twenty-three
 * languages is more than a screen, and a search box that scrolls away is one
 * nobody can reach by the time they want it.
 *
 * Full screen on Android, so the navigation bar is this screen's own problem;
 * see `resolveScreenBottomInset`.
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
  // The keyboard does open here, but it opens over a list that scrolls, not
  // over anything pinned to the bottom, so this is only ever asked for the
  // navigation bar. Clamped all the same.
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });

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
        languageStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={languageStyles.header}>
          <CircleIconButton action="close" label="Back to contact info" onPress={onClose} />
          <Text numberOfLines={1} style={[languageStyles.headerTitle, { color: appTheme.colors.ink }]}>
            Chat transcript language
          </Text>
          <CircleIconSpacer />
        </View>

        <View style={languageStyles.searchWrap}>
          <ChatSearchBar
            onChangeText={onChangeSearch}
            placeholder="Search"
            value={search}
          />
        </View>

        <ScrollView
          contentContainerStyle={[
            languageStyles.content,
            { paddingBottom: Math.max(28, screenBottomInset + 24) }
          ]}
          keyboardDismissMode={getKeyboardDismissMode()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Explanatory text, on the page rather than in a card. A white slab
              holding nothing but grey words reads as something to act on. */}
          <Text style={[languageStyles.note, { color: appTheme.colors.muted }]}>
            This language is for transcripts in this chat only. To change the language
            for all transcripts, go to Transcript language in Settings.
          </Text>

          <TranscriptLanguageSection
            disabled={isSaving}
            languages={onDeviceLanguages}
            onSelectLanguage={onSelectLanguage}
            selectedLanguageCode={selectedLanguage.languageCode}
            title="On device"
          />

          <TranscriptLanguageSection
            disabled={isSaving}
            languages={availableLanguages}
            onSelectLanguage={onSelectLanguage}
            selectedLanguageCode={selectedLanguage.languageCode}
            title="Available to download"
          />

          {!hasMatches ? (
            <Text style={[languageStyles.empty, { color: appTheme.colors.muted }]}>No languages found</Text>
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
  if (!languages.length) {
    return null;
  }

  return (
    <ListSection title={title}>
      {languages.map((language) => (
        <TranscriptLanguageRow
          disabled={disabled}
          isSelected={language.code === selectedLanguageCode}
          key={language.code}
          language={language}
          onSelect={() => onSelectLanguage(language.code)}
        />
      ))}
    </ListSection>
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
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled }}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => [
        languageStyles.row,
        pressed && { backgroundColor: appTheme.colors.groupedBackground },
        disabled && languageStyles.disabled
      ]}
    >
      <Text numberOfLines={1} style={[languageStyles.rowText, { color: appTheme.colors.ink }]}>
        {language.label}
      </Text>
      {isSelected ? (
        <Feather color={appTheme.colors.link} name="check" size={19} />
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

const languageStyles = StyleSheet.create({
  screen: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingHorizontal: 10,
    textAlign: 'center'
  },
  // Room around the field for its shadow to fall into. Crowded against the
  // header above or the first card below, the lift stops reading as one.
  searchWrap: {
    paddingBottom: 4,
    paddingHorizontal: 15,
    paddingTop: 10
  },
  content: {
    paddingTop: 6
  },
  note: {
    fontSize: 13.5,
    lineHeight: 19,
    marginHorizontal: 15
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    minWidth: 0
  },
  empty: {
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 18,
    textAlign: 'center'
  },
  disabled: {
    opacity: 0.4
  }
});
