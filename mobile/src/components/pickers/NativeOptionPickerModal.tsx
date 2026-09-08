import { FlatList, Modal, Platform, Pressable, Text, View } from 'react-native';
import { androidButtonRipple } from '../../components/chatUiPrimitives';
import { styles } from '../../screens/adminChatStyles';

/**
 * The option picker.
 *
 * Lifted out of the chat screen unchanged.
 */

interface NativeOptionPickerOption {
  id: string;
  label: string;
}

export interface NativeOptionPickerState {
  onSelect: (index: number | null) => void;
  options: NativeOptionPickerOption[];
  title: string;
}

export function NativeOptionPickerModal({ picker }: { picker: NativeOptionPickerState | null }) {
  if (Platform.OS === 'ios' || !picker) {
    return null;
  }

  const handleCancel = () => picker.onSelect(null);

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={handleCancel}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.nativeOptionModalRoot}>
        <Pressable
          accessibilityLabel="Close options"
          accessibilityRole="button"
          onPress={handleCancel}
          style={styles.nativeOptionModalBackdrop}
        />
        <View accessibilityViewIsModal style={styles.nativeOptionModalPanel}>
          <View style={styles.nativeOptionModalHeader}>
            <Text style={styles.nativeOptionModalTitle}>{picker.title}</Text>
          </View>
          <FlatList
            data={picker.options}
            ItemSeparatorComponent={() => <View style={styles.nativeOptionSeparator} />}
            keyExtractor={(option) => option.id}
            renderItem={({ index, item }) => (
              <Pressable
                accessibilityRole="button"
                android_ripple={androidButtonRipple}
                onPress={() => picker.onSelect(index)}
                style={({ pressed }) => [
                  styles.nativeOptionRow,
                  pressed && styles.pressed
                ]}
              >
                <Text numberOfLines={2} style={styles.nativeOptionRowText}>{item.label}</Text>
              </Pressable>
            )}
            showsVerticalScrollIndicator
            style={styles.nativeOptionList}
          />
          <Pressable
            accessibilityRole="button"
            android_ripple={androidButtonRipple}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.nativeOptionCancelButton,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.nativeOptionCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
