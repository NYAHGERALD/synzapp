import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';

/**
 * Which notices the list is showing.
 *
 * Two views, and only one can be on, so this is a choice rather than a pair of
 * buttons: the one in force keeps a tick. It lives behind the options button
 * because the list itself is what people came for, and a permanent switch above
 * it spent a row of the screen on a decision most people make once.
 *
 * It drops from the **left**, under the button that opened it, with a tail
 * pointing back at it. A menu that appears in the opposite corner from the
 * thing you pressed leaves people wondering what they just did.
 */

export type NoticesView = 'FOR_ME' | 'SENT';

const VIEW_OPTIONS: { label: string; value: NoticesView }[] = [
  { label: 'Sent', value: 'SENT' },
  { label: 'For me', value: 'FOR_ME' }
];

export function NoticesOptionsMenu({
  isOpen,
  onChangeView,
  onClose,
  topOffset,
  view
}: {
  isOpen: boolean;
  onChangeView: (view: NoticesView) => void;
  onClose: () => void;
  /** Where the header sits, so the menu hangs just under its button. */
  topOffset: number;
  view: NoticesView;
}) {
  const appTheme = useAppTheme();

  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <Pressable
        accessibilityLabel="Close options"
        accessibilityRole="button"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="box-none" style={[menuStyles.anchor, { top: topOffset }]}>
        {/* A small square turned on its corner. Two of its sides are covered by
            the panel below, which leaves a triangle pointing at the button. */}
        <View style={[
          menuStyles.tail,
          {
            backgroundColor: appTheme.colors.groupedCard,
            borderColor: appTheme.colors.border
          }
        ]} />

        <View style={[
          menuStyles.panel,
          {
            backgroundColor: appTheme.colors.groupedCard,
            borderColor: appTheme.colors.border
          }
        ]}>
          {VIEW_OPTIONS.map((option, index) => (
            <View key={option.value}>
              {index > 0 ? (
                <View style={[menuStyles.divider, { backgroundColor: appTheme.colors.separator }]} />
              ) : null}
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: view === option.value }}
                onPress={() => onChangeView(option.value)}
                style={({ pressed }) => [
                  menuStyles.row,
                  pressed && { backgroundColor: appTheme.colors.groupedBackground }
                ]}
              >
                <Text style={[menuStyles.rowText, { color: appTheme.colors.ink }]}>
                  {option.label}
                </Text>
                {view === option.value ? (
                  <Feather color={appTheme.colors.link} name="check" size={19} />
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const menuStyles = StyleSheet.create({
  // Held against the left edge, under the button that opened it.
  anchor: {
    alignItems: 'flex-start',
    left: 18,
    position: 'absolute'
  },
  tail: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 14,
    marginLeft: 14,
    // Turned on its corner, then pushed down so the panel covers its lower half
    // and only the point above the panel is left showing.
    marginBottom: -7,
    transform: [{ rotate: '45deg' }],
    width: 14
  },
  panel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    minWidth: 190,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18
  },
  divider: {
    height: 1,
    marginHorizontal: 14
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16
  },
  rowText: {
    fontSize: 15.5,
    lineHeight: 20
  }
});
