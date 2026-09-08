import Feather from '@expo/vector-icons/Feather';
import React, { useState } from 'react';
import { LswWorkspaceTab } from '../../components/lsw/LswWorkspaceScreen';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The LSW workspace tab menu.
 *
 * Lifted out of the chat screen unchanged.
 */

export const LSW_WORKSPACE_TABS: Array<[LswWorkspaceTab, string]> = [
  ['today', 'Today'],
  ['week', 'Week'],
  ['follow-ups', 'Follow Ups']
];

export function LswWorkspaceTabMenu({
  activeTab,
  onSelectTab
}: {
  activeTab: LswWorkspaceTab;
  onSelectTab: (tab: LswWorkspaceTab) => void;
}) {
  const appTheme = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.lswHeaderMenuWrap}>
      <Pressable
        accessibilityLabel="Open Leaders Standard Work sections"
        accessibilityRole="button"
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => [
          styles.lswHeaderMenuButton,
          {
            backgroundColor: appTheme.colors.surface,
            borderColor: appTheme.colors.border
          },
          pressed && styles.pressed
        ]}
      >
        <Feather color={appTheme.colors.primary} name="more-horizontal" size={21} />
      </Pressable>

      {isOpen ? (
        <View style={[
          styles.lswHeaderMenu,
          {
            backgroundColor: appTheme.colors.surfaceElevated,
            borderColor: appTheme.colors.border
          }
        ]}>
          {LSW_WORKSPACE_TABS.map(([tab, label]) => {
            const isSelected = activeTab === tab;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={tab}
                onPress={() => {
                  onSelectTab(tab);
                  setIsOpen(false);
                }}
                style={({ pressed }) => [
                  styles.lswHeaderMenuItem,
                  isSelected && { backgroundColor: appTheme.colors.primarySoft },
                  pressed && styles.pressed
                ]}
              >
                <Text style={[
                  styles.lswHeaderMenuText,
                  { color: isSelected ? appTheme.colors.primary : appTheme.colors.ink }
                ]}>
                  {label}
                </Text>
                {isSelected ? <Feather color={appTheme.colors.primary} name="check" size={15} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
