import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import {
  COUNTRY_DIAL_CODES,
  flagForCountry,
  searchCountries,
  type CountryDialCode
} from '../../services/countryDialCodes';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';

/**
 * Choosing a country from all of them.
 *
 * This replaces an action sheet, which was workable for the four countries that
 * used to be offered and is unusable for two hundred and forty: an action sheet
 * has no search, and on Android it is a dialog that cannot scroll that far.
 *
 * Search matches the name, the ISO code and the dialling code, because somebody
 * who knows their country is "+44" should not have to remember how Synzapp
 * spells it.
 */
export function CountryPickerModal({
  onClose,
  onSelect,
  selectedCode,
  visible
}: {
  onClose: () => void;
  onSelect: (country: CountryDialCode) => void;
  selectedCode: string;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCountries(query), [query]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={styles.screen}>
        <View style={[styles.head, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={22} />
          </Pressable>
          <Text style={styles.title}>Country</Text>
          <View style={styles.headSpacer} />
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search by name or code"
          placeholderTextColor={appTheme.colors.muted}
          style={styles.search}
          value={query}
        />

        <FlatList
          data={results}
          // Every row is the same height, so the list can jump straight to an
          // offset instead of measuring its way down two hundred of them.
          getItemLayout={(_, index) => ({ index, length: ROW_HEIGHT, offset: ROW_HEIGHT * index })}
          initialNumToRender={16}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.code}
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing matches “{query.trim()}”.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: item.code === selectedCode }}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.flag}>{flagForCountry(item.code)}</Text>
              <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
              <Text style={styles.dial}>{item.dialCode}</Text>
              {item.code === selectedCode ? (
                <Feather color={appTheme.colors.link} name="check" size={19} />
              ) : null}
            </Pressable>
          )}
          style={styles.list}
        />
      </View>
    </Modal>
  );
}

/** Fixed, so the list can be measured rather than laid out. */
const ROW_HEIGHT = 56;

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.groupedBackground,
      flex: 1
    },
    head: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 10,
      paddingHorizontal: 15
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: colors.groupedCard,
      borderRadius: 22,
      elevation: 4,
      height: 44,
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { height: 2, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      width: 44
    },
    headSpacer: {
      height: 44,
      width: 44
    },
    title: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '500'
    },
    search: {
      backgroundColor: colors.groupedCard,
      borderRadius: 14,
      color: colors.ink,
      fontSize: 16,
      marginHorizontal: 15,
      marginVertical: 8,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    list: {
      flex: 1
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      height: ROW_HEIGHT,
      paddingHorizontal: 15
    },
    flag: {
      fontSize: 24
    },
    name: {
      color: colors.ink,
      flex: 1,
      fontSize: 16,
      minWidth: 0
    },
    dial: {
      color: colors.muted,
      fontSize: 15,
      fontVariant: ['tabular-nums']
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
      paddingVertical: 40,
      textAlign: 'center'
    },
    pressed: {
      opacity: 0.7
    }
  });
}
