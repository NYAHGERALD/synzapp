import { DirectoryFilter } from '../../components/settings/DirectorySettings';
import { Pressable, Text, View } from 'react-native';
import { androidIconRipple } from '../../components/chatUiPrimitives';
import { styles } from '../../screens/adminChatStyles';
import { CircleIconButton } from '../ui/CircleIconButton';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The directory header.
 *
 * Lifted out of the chat screen unchanged.
 */

export function DirectoryHeader({
  filter,
  onAdd,
  onBack,
  onFilter
}: {
  filter: DirectoryFilter;
  onAdd: () => void;
  onBack: () => void;
  onFilter: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.topActions}>
      <CircleIconButton action="back" label="Back to settings" onPress={onBack} />

      <View style={styles.directoryHeaderActions}>
        <Pressable
          android_ripple={androidIconRipple}
          accessibilityLabel={`Show ${filter === 'Departments' ? 'roles' : 'departments'}`}
          accessibilityRole="button"
          onPress={onFilter}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
        >
          <FilterIcon />
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onAdd}>
          <Text style={[styles.headerLinkAction, { color: appTheme.colors.link }]}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FilterIcon() {
  return (
    <View style={styles.filterIcon}>
      <View style={styles.filterLineWide} />
      <View style={styles.filterLineMedium} />
      <View style={styles.filterLineSmall} />
    </View>
  );
}
