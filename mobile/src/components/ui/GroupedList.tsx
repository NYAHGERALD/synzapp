import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { FeatherIconName } from '../../types/featherIcon';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';
import { AppSwitch } from './AppSwitch';

/**
 * The grouped list the phone's own settings screens use.
 *
 * Cards on a tinted background, hairline dividers inset from the left, and
 * actions as tinted text rather than filled slabs. No shadows: depth here comes
 * from the card sitting on a darker ground, which is what makes a screen read
 * as calm rather than busy.
 *
 * Every colour is a theme token, so light and dark both work without a second
 * set of rules.
 */

export function ListSection({
  children,
  footer,
  title
}: {
  children: React.ReactNode;
  footer?: string;
  title?: string;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </View>
        ))}
      </View>
      {footer ? <Text style={styles.sectionFooter}>{footer}</Text> : null}
    </View>
  );
}

/** Label on the left, value on the right, the way a settings row reads. */
export function ListRow({
  label,
  value,
  valueColor
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * An action, as tinted text rather than a filled button.
 *
 * A screen with three filled slabs shouts; three tinted rows in one card read
 * as a list of things you may do, which is what they are.
 */
export function ListActionRow({
  destructive = false,
  disabled = false,
  icon,
  label,
  onPress
}: {
  destructive?: boolean;
  disabled?: boolean;
  icon?: FeatherIconName;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const tint = destructive ? appTheme.colors.destructive : appTheme.colors.link;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        pressed && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      {icon ? <Feather color={tint} name={icon} size={16} /> : null}
      <Text style={[styles.actionText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A row that opens something else.
 *
 * Icon, title, a line of explanation, and a chevron. The chevron is a real icon
 * rather than a typed character, so it lines up and scales with the text.
 */
export function ListNavRow({
  icon,
  onPress,
  subtitle,
  title
}: {
  icon?: FeatherIconName;
  onPress?: () => void;
  subtitle?: string;
  title: string;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && onPress && styles.pressed]}
    >
      {icon ? (
        <View style={styles.navIcon}>
          <Feather color={appTheme.colors.ink} name={icon} size={20} />
        </View>
      ) : null}
      <View style={styles.navText}>
        <Text style={styles.navTitle}>{title}</Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.navSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {onPress ? (
        <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
      ) : null}
    </Pressable>
  );
}

/**
 * A row carrying a switch.
 *
 * The switch sits on the right, where the platform puts it, and the whole row
 * is tappable so a gloved thumb does not have to find the control itself.
 */
export function ListSwitchRow({
  disabled = false,
  onValueChange,
  subtitle,
  title,
  value
}: {
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  subtitle?: string;
  title: string;
  value: boolean;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.navRow, pressed && !disabled && styles.pressed]}
    >
      <View style={styles.navText}>
        <Text style={styles.navTitle}>{title}</Text>
        {subtitle ? <Text style={styles.navSubtitle}>{subtitle}</Text> : null}
      </View>
      <AppSwitch disabled={disabled} onValueChange={onValueChange} value={value} />
    </Pressable>
  );
}

/** A row that is only text, for history and free wording. */
export function ListTextRow({ children }: { children: React.ReactNode }) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return <View style={styles.textRow}>{children}</View>;
}

export function createGroupedStyles(colors: AppColors) {
  return createStyles(colors);
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    section: {
      marginTop: 22
    },
    sectionTitle: {
      color: colors.muted,
      fontSize: 13,
      marginBottom: 7,
      marginLeft: 15
    },
    sectionFooter: {
      color: colors.muted,
      fontSize: 12.5,
      lineHeight: 17,
      marginHorizontal: 15,
      marginTop: 7
    },
    // No shadow anywhere. The card reads as raised because the page behind it
    // is darker, which is how the platform does it.
    card: {
      backgroundColor: colors.groupedCard,
      borderRadius: 22,
      marginHorizontal: 15,
      overflow: 'hidden'
    },
    // Inset by the same amount on both sides as the text inside the rows, so
    // the line sits inside the card rather than cutting across it edge to edge.
    divider: {
      backgroundColor: colors.separator,
      height: 1,
      marginHorizontal: 15
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 16,
      minHeight: 44,
      paddingHorizontal: 16,
      paddingVertical: 11
    },
    rowLabel: {
      color: colors.ink,
      fontSize: 15.5
    },
    rowValue: {
      color: colors.muted,
      flex: 1,
      fontSize: 15.5,
      textAlign: 'right'
    },
    actionRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 46,
      paddingHorizontal: 16,
      paddingVertical: 12
    },
    actionText: {
      fontSize: 16
    },
    navRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 54,
      paddingHorizontal: 16,
      paddingVertical: 11
    },
    navIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 26
    },
    navText: {
      flex: 1,
      minWidth: 0
    },
    navTitle: {
      color: colors.ink,
      fontSize: 16
    },
    navSubtitle: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2
    },
    textRow: {
      paddingHorizontal: 16,
      paddingVertical: 12
    },
    pressed: {
      backgroundColor: colors.groupedBackground
    },
    disabled: {
      opacity: 0.4
    }
  });
}
