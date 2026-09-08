import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { androidIconRipple } from '../../components/chatUiPrimitives';
import { colors } from '../../theme/colors';
import { styles } from '../../screens/adminChatStyles';

/**
 * The archive header.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ArchiveHeader({
  isEditMenuOpen,
  isSelectionMode,
  onBack,
  onCloseEditMenu,
  onDoneSelection,
  onEditArchive,
  onSelectChats,
  onToggleEditMenu,
  selectedCount
}: {
  isEditMenuOpen: boolean;
  isSelectionMode: boolean;
  onBack: () => void;
  onCloseEditMenu: () => void;
  onDoneSelection: () => void;
  onEditArchive: () => void;
  onSelectChats: () => void;
  onToggleEditMenu: () => void;
  selectedCount: number;
}) {
  return (
    <View style={styles.archiveHeaderWrap}>
      <View style={styles.spamHeader}>
        <Pressable
          android_ripple={androidIconRipple}
          accessibilityLabel="Back to chats"
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>

        <Text numberOfLines={1} style={styles.spamHeaderTitle}>
          {isSelectionMode && selectedCount > 0 ? `${selectedCount} selected` : 'Archived'}
        </Text>

        {isSelectionMode ? (
          <Pressable
            accessibilityLabel="Done selecting archived chats"
            accessibilityRole="button"
            onPress={onDoneSelection}
            style={({ pressed }) => [styles.archiveHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="check" size={22} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Edit archive"
            accessibilityRole="button"
            onPress={onToggleEditMenu}
            style={({ pressed }) => [styles.spamHeaderDeleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.spamHeaderDeleteText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {isEditMenuOpen ? (
        <>
          <Pressable
            accessibilityLabel="Close archive edit menu"
            accessibilityRole="button"
            onPress={onCloseEditMenu}
            style={styles.archiveEditBackdrop}
          />
          <View style={styles.archiveEditMenu}>
            <ArchiveEditMenuRow
              icon="check-circle"
              label="Select chats"
              onPress={onSelectChats}
            />
            <ArchiveEditMenuRow
              icon="settings"
              label="Edit archive settings"
              onPress={onEditArchive}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

function ArchiveEditMenuRow({
  icon,
  label,
  onPress
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.archiveEditMenuRow, pressed && styles.pressed]}
    >
      <Feather color={colors.ink} name={icon} size={17} />
      <Text style={styles.archiveEditMenuText}>{label}</Text>
    </Pressable>
  );
}
