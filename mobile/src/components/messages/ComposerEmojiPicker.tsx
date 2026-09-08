import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { EMOJI_GROUPS, searchEmojiGroups } from '../../services/emojiCatalogue';
import { PressableScale, SheetPresentation } from './SheetPresentation';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Picking emoji to put in a message you are writing.
 *
 * The smiley beside the message box used to do nothing at all when the keyboard
 * was down — it was drawn, it could be pressed, and pressing it was silence.
 *
 * It behaves like a keyboard rather than a menu: **picking one does not close
 * it**, because people add two or three in a row and reopening a sheet between
 * each would be worse than not having it. That is why there is a backspace in
 * here too — with the keyboard hidden there is no other way to take back an
 * emoji you did not mean, and being unable to undo the last press is what makes
 * a picker feel like a trap.
 *
 * It shares its list and its look with the reaction picker, so the emoji you
 * react with and the emoji you type are the same emoji in the same order.
 */

export function ComposerEmojiPicker({
  onBackspace,
  onClose,
  onSelect,
  visible
}: {
  onBackspace: () => void;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const [search, setSearch] = useState('');
  const pickerGroups = useMemo(() => searchEmojiGroups(search, EMOJI_GROUPS), [search]);

  useEffect(() => {
    if (!visible) {
      setSearch('');
    }
  }, [visible]);

  return (
    // Just over half the screen, so the message being written stays in
    // sight above it — the whole point of an emoji panel is choosing one
    // for words already there.
    <SheetPresentation
      closeLabel="Close emoji"
      maxHeightPoints={560}
      maxHeightRatio={0.62}
      onClose={onClose}
      visible={visible}
    >
      <View style={styles.messageReactionPickerHeader}>
        <View style={styles.messageReactionPickerHeaderText}>
          <Text style={[styles.messageReactionPickerEyebrow, { color: appTheme.colors.primary }]}>
            Emoji
          </Text>
          <Text numberOfLines={1} style={[styles.messageReactionPickerTitle, { color: appTheme.colors.ink }]}>
            Tap to add to your message
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Delete last character"
          accessibilityRole="button"
          onPress={onBackspace}
          style={({ pressed }) => [
            styles.messageReactionPickerClose,
            {
              backgroundColor: appTheme.colors.surface,
              borderColor: appTheme.colors.border
            },
            pressed && styles.pressed
          ]}
        >
          <Feather color={appTheme.colors.mutedStrong} name="delete" size={20} />
        </Pressable>
        <Pressable
          accessibilityLabel="Close emoji"
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
          placeholder="Search emoji"
          placeholderTextColor={appTheme.colors.muted}
          returnKeyType="search"
          style={[styles.messageReactionPickerSearchInput, { color: appTheme.colors.ink }]}
          value={search}
        />
        {search ? (
          <Pressable
            accessibilityLabel="Clear emoji search"
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
                <PressableScale
                  accessibilityLabel={`Add ${option.keywords.split(' ')[0] || option.emoji}`}
                  key={`${group.title}-${option.emoji}-${index}`}
                  onPress={() => onSelect(option.emoji)}
                  style={[
                    styles.messageReactionPickerEmojiButton,
                    { backgroundColor: appTheme.colors.surface }
                  ]}
                >
                  <Text style={styles.messageReactionPickerEmojiText}>{option.emoji}</Text>
                </PressableScale>
              ))}
            </View>
          </View>
        )) : (
          <View style={[styles.messageReactionPickerEmpty, { borderColor: appTheme.colors.border }]}>
            <Text style={[styles.messageReactionPickerEmptyText, { color: appTheme.colors.mutedStrong }]}>
              No emoji found.
            </Text>
          </View>
        )}
      </ScrollView>
    </SheetPresentation>
  );
}
