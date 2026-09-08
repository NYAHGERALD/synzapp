import Feather from '@expo/vector-icons/Feather';
import { AppThemePreference, useAppTheme } from '../../theme/AppThemeProvider';
import { Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';

/**
 * Theme selection.
 *
 * Lifted out of the chat screen unchanged.
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
  const options: Array<{
    description: string;
    icon: keyof typeof Feather.glyphMap;
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
          styles.themeSheet,
          { backgroundColor: appTheme.colors.surface }
        ]}>
          <View style={styles.chatMoreHandle} />
          <View style={styles.chatMoreHeader}>
            <Text numberOfLines={1} style={[styles.chatMoreTitle, { color: appTheme.colors.ink }]}>Appearance</Text>
            <Pressable
              accessibilityLabel="Close appearance settings"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.chatMoreCloseButton,
                { backgroundColor: appTheme.colors.surfaceElevated },
                pressed && styles.pressed
              ]}
            >
              <Feather color={appTheme.colors.ink} name="x" size={22} />
            </Pressable>
          </View>

          <Text style={[styles.themeSheetDescription, { color: appTheme.colors.muted }]}>
            Choose how Synzapp should match this device.
          </Text>

          <View style={[styles.chatMoreActionGroup, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            {options.map((option) => {
              const isSelected = currentPreference === option.value;

              return (
                <Pressable
                  accessibilityLabel={`Use ${option.label} appearance`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={({ pressed }) => [
                    styles.themeOptionRow,
                    { borderBottomColor: appTheme.colors.divider },
                    pressed && styles.pressed
                  ]}
                >
                  <View style={[
                    styles.themeOptionIcon,
                    { backgroundColor: appTheme.colors.primarySoft },
                    isSelected && styles.themeOptionIconSelected
                  ]}>
                    <Feather color={isSelected ? '#FFFFFF' : appTheme.colors.primary} name={option.icon} size={20} />
                  </View>
                  <View style={styles.chatText}>
                    <Text style={[styles.themeOptionTitle, { color: appTheme.colors.ink }]}>{option.label}</Text>
                    <Text style={[styles.themeOptionDescription, { color: appTheme.colors.muted }]}>{option.description}</Text>
                  </View>
                  <View style={[styles.archiveSettingsRadio, isSelected && styles.archiveSettingsRadioSelected]}>
                    {isSelected ? <View style={styles.archiveSettingsRadioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
