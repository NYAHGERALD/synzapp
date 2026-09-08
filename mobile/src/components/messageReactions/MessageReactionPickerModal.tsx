import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useState } from 'react';
import { ChatMessage } from '../../services/chatApi';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { EMOJI_GROUPS, searchEmojiGroups } from '../../services/emojiCatalogue';
import { getChatMessagePreview } from '../../services/chatMessagePreview';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The full reaction picker.
 *
 * Lifted out of the Admin chat screen unchanged.
 */

export function MessageReactionPickerModal({
  message,
  onClose,
  onSelect
}: {
  message: ChatMessage | null;
  onClose: () => void;
  onSelect: (message: ChatMessage, reaction: string) => void;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const pickerGroups = useMemo(() => searchEmojiGroups(search, EMOJI_GROUPS), [search]);

  useEffect(() => {
    if (!message) {
      setSearch('');
    }
  }, [message]);

  if (!message) {
    return null;
  }

  const preview = getChatMessagePreview(message) || 'Selected message';
  const sheetMaxHeight = Math.min(height - Math.max(insets.top, 18) - 16, 640);

  return (
    <Modal
      animationType="slide"
      hardwareAccelerated
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.messageReactionPickerRoot}>
        <Pressable
          accessibilityLabel="Close reaction picker"
          accessibilityRole="button"
          onPress={onClose}
          style={[
            styles.messageReactionPickerBackdrop,
            { backgroundColor: appTheme.colors.overlay }
          ]}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 8) : 0}
          pointerEvents="box-none"
          style={styles.messageReactionPickerKeyboard}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.messageReactionPickerSheet,
              {
                backgroundColor: appTheme.colors.screen,
                borderColor: appTheme.colors.border,
                maxHeight: sheetMaxHeight,
                paddingBottom: Math.max(insets.bottom, 18)
              }
            ]}
          >
            <View style={[styles.messageReactionPickerHandle, { backgroundColor: appTheme.colors.border }]} />
            <View style={styles.messageReactionPickerHeader}>
              <View style={styles.messageReactionPickerHeaderText}>
                <Text style={[styles.messageReactionPickerEyebrow, { color: appTheme.colors.primary }]}>
                  Reactions
                </Text>
                <Text numberOfLines={1} style={[styles.messageReactionPickerTitle, { color: appTheme.colors.ink }]}>
                  {preview}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close reactions"
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.messageReactionPickerClose,
                  {
                    backgroundColor: appTheme.colors.surface,
                    borderColor: appTheme.colors.border
                  },
                  pressed && styles.pressed
                ]}
              >
                <Feather color={appTheme.colors.mutedStrong} name="x" size={20} />
              </Pressable>
            </View>

            <View
              style={[
                styles.messageReactionPickerSearch,
                {
                  backgroundColor: appTheme.colors.input,
                  borderColor: appTheme.colors.border
                }
              ]}
            >
              <Feather color={appTheme.colors.muted} name="search" size={18} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                onChangeText={setSearch}
                placeholder="Search reactions"
                placeholderTextColor={appTheme.colors.muted}
                returnKeyType="search"
                style={[styles.messageReactionPickerSearchInput, { color: appTheme.colors.ink }]}
                value={search}
              />
              {search ? (
                <Pressable
                  accessibilityLabel="Clear reaction search"
                  accessibilityRole="button"
                  onPress={() => setSearch('')}
                  style={({ pressed }) => [
                    styles.messageReactionPickerClear,
                    pressed && styles.pressed
                  ]}
                >
                  <Feather color={appTheme.colors.muted} name="x" size={16} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              bounces={false}
              contentContainerStyle={styles.messageReactionPickerContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {pickerGroups.length ? pickerGroups.map((group) => (
                <View key={group.title} style={styles.messageReactionPickerGroup}>
                  <Text style={[styles.messageReactionPickerGroupTitle, { color: appTheme.colors.muted }]}>
                    {group.title}
                  </Text>
                  <View style={styles.messageReactionPickerGrid}>
                    {group.options.map((option, index) => (
                      <Pressable
                        accessibilityLabel={`React with ${option.keywords.split(' ')[0] || option.emoji}`}
                        accessibilityRole="button"
                        key={`${group.title}-${option.emoji}-${index}`}
                        onPress={() => onSelect(message, option.emoji)}
                        style={({ pressed }) => [
                          styles.messageReactionPickerEmojiButton,
                          { backgroundColor: appTheme.colors.surface },
                          pressed && {
                            backgroundColor: appTheme.colors.primarySoft,
                            transform: [{ scale: 0.96 }]
                          }
                        ]}
                      >
                        <Text style={styles.messageReactionPickerEmojiText}>{option.emoji}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )) : (
                <View style={[styles.messageReactionPickerEmpty, { borderColor: appTheme.colors.border }]}>
                  <Text style={[styles.messageReactionPickerEmptyText, { color: appTheme.colors.mutedStrong }]}>
                    No reactions found.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
