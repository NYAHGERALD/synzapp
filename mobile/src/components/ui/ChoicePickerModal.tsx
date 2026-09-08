import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { type ChoiceOption, filterChoiceOptions } from '../../services/choicePicker';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Choosing one thing from a list that will not stay short.
 *
 * Written because teams and people are lists a company grows. Six of each fits
 * in a form; sixty does not, and the version of this screen that showed every
 * team inline was a form nobody could reach the bottom of. So the choice moves
 * to a screen of its own, at full height, with a search — the same shape
 * whether there are three names or three hundred.
 *
 * One component for both because a team and a person are the same decision to
 * the person making it, and two lists that drift apart is how one of them ends
 * up without a search box.
 */

export type { ChoiceOption };

export function ChoicePickerModal({
  emptyText,
  isLoading = false,
  noneLabel,
  onClose,
  onSelect,
  options,
  searchPlaceholder,
  selectedId,
  subtitle,
  title,
  visible
}: {
  emptyText: string;
  isLoading?: boolean;
  /** Offered when the choice is optional; absent makes it required. */
  noneLabel?: string;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  options: ChoiceOption[];
  searchPlaceholder: string;
  selectedId: string | null;
  subtitle?: string;
  title: string;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [search, setSearch] = useState('');
  const [isMounted, setIsMounted] = useState(visible);
  const progress = React.useRef(new Animated.Value(0)).current;
  const shown = useMemo(() => filterChoiceOptions(options, search), [options, search]);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      setSearch('');
      Animated.spring(progress, {
        friction: 11,
        tension: 62,
        toValue: 1,
        useNativeDriver: true
      }).start();

      return;
    }

    Animated.timing(progress, {
      duration: 190,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [progress, visible]);

  if (!isMounted) {
    return null;
  }

  const choose = (id: string | null) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal hardwareAccelerated onRequestClose={onClose} statusBarTranslucent transparent visible>
      <Animated.View
        style={[
          styles.root,
          {
            opacity: progress,
            paddingTop: insets.top,
            transform: [{
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })
            }]
          }
        ]}
      >
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable
            accessibilityLabel={`Close ${title}`}
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.mutedStrong} name="x" size={20} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Feather color={appTheme.colors.muted} name="search" size={18} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={appTheme.colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
        </View>

        <FlatList
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}
          data={shown}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(option) => option.id}
          ListEmptyComponent={isLoading ? (
            <ActivityIndicator color={appTheme.colors.primary} style={styles.loading} />
          ) : (
            // "Nothing matches" and "there is nothing" are different problems,
            // and saying the first when it is really the second sends somebody
            // back to the search box to fix something that was never wrong.
            <Text style={styles.empty}>
              {options.length ? 'Nothing matches that.' : emptyText}
            </Text>
          )}
          ListHeaderComponent={noneLabel && !search ? (
            <View style={styles.card}>
              <ChoiceRow
                isSelected={!selectedId}
                name={noneLabel}
                onPress={() => choose(null)}
                styles={styles}
              />
            </View>
          ) : null}
          renderItem={({ index, item }) => (
            <View style={[
              styles.card,
              index === 0 && styles.cardFirst,
              index > 0 && styles.cardJoined
            ]}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ChoiceRow
                isSelected={item.id === selectedId}
                meta={item.meta}
                name={item.name}
                onPress={() => choose(item.id)}
                styles={styles}
              />
            </View>
          )}
        />
      </Animated.View>
    </Modal>
  );
}

/**
 * One choice.
 *
 * The chosen one keeps its tick and goes quiet: dimmed, and not pressable. It
 * stays in place rather than moving to the top, because a list that reorders
 * itself under a thumb is a list people mis-tap. Tapping it again would do
 * nothing anyway, and a row that looks live but does nothing is worse than one
 * that plainly says it is already the answer.
 */
function ChoiceRow({
  isSelected,
  meta,
  name,
  onPress,
  styles
}: {
  isSelected: boolean;
  meta?: string;
  name: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityHint={isSelected ? 'Already chosen' : undefined}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled: isSelected }}
      disabled={isSelected}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text
          numberOfLines={1}
          style={[styles.rowName, isSelected && styles.chosenText]}
        >
          {name}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={[styles.rowMeta, isSelected && styles.chosenText]}>
            {meta}
          </Text>
        ) : null}
      </View>
      {isSelected ? <Feather color={appTheme.colors.link} name="check" size={19} /> : null}
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      backgroundColor: colors.groupedBackground,
      flex: 1
    },
    head: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12
    },
    headText: {
      flex: 1
    },
    title: {
      color: colors.ink,
      fontSize: 22,
      letterSpacing: -0.3
    },
    subtitle: {
      color: colors.muted,
      fontSize: 13.5,
      marginTop: 2
    },
    close: {
      alignItems: 'center',
      backgroundColor: colors.groupedCard,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      width: 34
    },
    search: {
      alignItems: 'center',
      backgroundColor: colors.groupedCard,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
      marginHorizontal: 16,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    searchInput: {
      color: colors.ink,
      flex: 1,
      fontSize: 16,
      padding: 0
    },
    list: {
      paddingHorizontal: 16
    },
    card: {
      backgroundColor: colors.groupedCard
    },
    cardFirst: {
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14
    },
    cardJoined: {
      borderRadius: 0
    },
    divider: {
      backgroundColor: colors.separator,
      height: StyleSheet.hairlineWidth,
      marginLeft: 16
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    rowText: {
      flex: 1
    },
    rowName: {
      color: colors.ink,
      fontSize: 16
    },
    rowMeta: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2
    },
    // Dimmed, not hidden. It is still the answer, and somebody scrolling back
    // to check what they picked needs to find it where they left it.
    chosenText: {
      color: colors.muted
    },
    loading: {
      paddingTop: 44
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
      paddingTop: 40,
      textAlign: 'center'
    },
    pressed: {
      opacity: 0.6
    }
  });
}
