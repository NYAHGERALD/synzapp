import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { AppThemePreference, useAppTheme } from '../../theme/AppThemeProvider';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { styles } from '../../screens/adminChatStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How the app should look on this device.
 *
 * Three choices, so the marker is a **tick**, not a switch. A switch settles a
 * two-way setting, where turning one off plainly means the other; among three
 * it says nothing — turning Light off does not say whether System or Dark was
 * meant. This is a selection from a list, which is the exception written into
 * section 6 of SYNZAPP_APP_STYLE.md, and it keeps its tick.
 *
 * The sheet reaches the foot of the screen, so it pays the bottom inset
 * itself — on Android the navigation bar, and nothing on iOS, where the app
 * root has already moved everything clear of the home indicator.
 */

export function ThemePreferenceModal({
  currentPreference,
  onClose,
  onSelect,
  visible
}: {
  currentPreference: AppThemePreference;
  onClose: () => void;
  onSelect: (preference: AppThemePreference) => void;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });
  const options: Array<{
    description: string;
    icon: 'moon' | 'smartphone' | 'sun';
    label: string;
    value: AppThemePreference;
  }> = [
    {
      description: 'Follow the phone or tablet display setting.',
      icon: 'smartphone',
      label: 'System',
      value: 'system'
    },
    {
      description: 'Use the bright Synzapp interface.',
      icon: 'sun',
      label: 'Light',
      value: 'light'
    },
    {
      description: 'Use the low-light Synzapp interface.',
      icon: 'moon',
      label: 'Dark',
      value: 'dark'
    }
  ];

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.chatMoreRoot}>
        <Pressable
          accessibilityLabel="Close appearance settings"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.chatMoreBackdrop}
        />
        <View style={[
          themeStyles.sheet,
          {
            backgroundColor: appTheme.colors.groupedBackground,
            // Both platforms, one number: the navigation bar on Android and
            // nothing on iOS, where the root SafeAreaView already paid it.
            paddingBottom: Math.max(20, screenBottomInset + 16)
          }
        ]}>
          <View style={styles.chatMoreHandle} />
          <View style={styles.chatMoreHeader}>
            <Text numberOfLines={1} style={[themeStyles.title, { color: appTheme.colors.ink }]}>
              Appearance
            </Text>
            <Pressable
              accessibilityLabel="Close appearance settings"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.chatMoreCloseButton,
                { backgroundColor: appTheme.colors.groupedCard },
                pressed && styles.pressed
              ]}
            >
              <Feather color={appTheme.colors.ink} name="x" size={22} />
            </Pressable>
          </View>

          <Text style={[themeStyles.description, { color: appTheme.colors.muted }]}>
            Choose how Synzapp should match this device.
          </Text>

          <View style={[themeStyles.card, { backgroundColor: appTheme.colors.groupedCard }]}>
            {options.map((option, index) => {
              const isSelected = currentPreference === option.value;

              return (
                <View key={option.value}>
                  {index > 0 ? (
                    <View style={[
                      themeStyles.divider,
                      { backgroundColor: appTheme.colors.separator }
                    ]} />
                  ) : null}
                  <Pressable
                    accessibilityLabel={`Use ${option.label} appearance`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => onSelect(option.value)}
                    style={({ pressed }) => [
                      themeStyles.row,
                      pressed && { backgroundColor: appTheme.colors.groupedBackground }
                    ]}
                  >
                    <View style={themeStyles.rowIcon}>
                      <Feather color={appTheme.colors.ink} name={option.icon} size={20} />
                    </View>
                    <View style={themeStyles.rowText}>
                      <Text style={[themeStyles.rowTitle, { color: appTheme.colors.ink }]}>
                        {option.label}
                      </Text>
                      <Text style={[themeStyles.rowDescription, { color: appTheme.colors.muted }]}>
                        {option.description}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Feather color={appTheme.colors.link} name="check" size={19} />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const themeStyles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 15,
    paddingTop: 8
  },
  title: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22
  },
  description: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 14,
    marginLeft: 1
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden'
  },
  divider: {
    height: 1,
    marginHorizontal: 15
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  rowIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 26
  },
  rowText: {
    flex: 1,
    minWidth: 0
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 21
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  }
});
