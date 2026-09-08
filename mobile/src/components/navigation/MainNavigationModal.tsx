import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { CircleIconButton, CircleIconSpacer } from '../../components/ui/CircleIconButton';
import { ListSection } from '../../components/ui/GroupedList';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import {
  type MainNavigationKey,
  describeAdminContactHeading,
  describeAdminContactSubtitle,
  describeOwnIdentityLines,
  listMainNavigationItems
} from '../../services/mainNavigationDetails';
import type { CurrentUserProfile } from '../../services/profileApi';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The main menu.
 *
 * It answers three things without anybody having to ask a colleague: who you
 * are here, where you can go, and who to ask. Then it offers the one way out.
 *
 * Identity is first because it is what everything under it is scoped by — the
 * sections you are shown and the admin you are given both follow from it.
 * Log out is last and alone: never beside a link a thumb is already aiming at.
 *
 * See SYNZAPP_MAIN_MENU_PLAN.md.
 */

export const mainNavigationLinks = [
  'ACTIONS',
  'RECORD MEETING',
  'LEADERS STANDARD WORK',
  'INTERPRETER',
  'LIBRARY'
] as const;

export function MainNavigationModal({
  isOpen,
  links,
  onClose,
  onOpenAdminChat,
  onSelect,
  onSignOut,
  profile,
  profilePhotoHeaders
}: {
  isOpen: boolean;
  links: readonly MainNavigationKey[];
  onClose: () => void;
  /** Absent when that person cannot be reached, which leaves the row inert. */
  onOpenAdminChat?: (contactId: string) => void;
  onSelect: (label: MainNavigationKey) => void;
  onSignOut?: () => void;
  profile: CurrentUserProfile | null;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });
  const items = listMainNavigationItems(links);
  const admin = profile?.departmentAdmin || null;
  const identityLines = profile
    ? describeOwnIdentityLines({
      departmentName: profile.departmentName,
      phoneFormatted: profile.phoneFormatted,
      roleName: profile.roleName
    })
    : [];

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        menuStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={menuStyles.header}>
          <CircleIconButton action="close" label="Close main navigation" onPress={onClose} />
          {/* The company's name, not the product's. Somebody in two tenants
              needs to know which one they are looking at; the app's own name
              is the one fact on this screen they already have. */}
          <Text numberOfLines={1} style={[menuStyles.headerTitle, { color: appTheme.colors.ink }]}>
            {profile?.companyName || 'Synzapp'}
          </Text>
          <CircleIconSpacer />
        </View>

        {/* A plain view, not a scroll. The menu is a fixed set of things and
            reads better as one screen than as something to be explored. */}
        <View style={menuStyles.content}>
          {profile ? (
            <ListSection>
              <View style={menuStyles.identityRow}>
                <View style={menuStyles.identityText}>
                  {/* Nothing here is cut off. A job title and a department can
                      run long together, and "Supervisor · Department Admin · B…"
                      hides the one word that says which department. */}
                  <Text style={[menuStyles.identityName, { color: appTheme.colors.ink }]}>
                    {profile.displayName}
                  </Text>
                  {identityLines.map((line) => (
                    <Text
                      key={line}
                      style={[menuStyles.identityMeta, { color: appTheme.colors.muted }]}
                    >
                      {line}
                    </Text>
                  ))}
                </View>

                <ProfileAvatar
                  headers={profilePhotoHeaders}
                  name={profile.displayName}
                  size={72}
                  uri={profile.profilePhotoUrl}
                />
              </View>
            </ListSection>
          ) : null}

          <ListSection>
            {items.map((item) => (
              <Pressable
                accessibilityLabel={`Open ${item.label}`}
                accessibilityRole="button"
                key={item.key}
                onPress={() => onSelect(item.key)}
                style={({ pressed }) => [
                  menuStyles.navRow,
                  pressed && { backgroundColor: appTheme.colors.groupedBackground }
                ]}
              >
                <View style={menuStyles.navIcon}>
                  <Feather color={appTheme.colors.ink} name={item.icon} size={20} />
                </View>
                <Text numberOfLines={1} style={[menuStyles.navLabel, { color: appTheme.colors.ink }]}>
                  {item.label}
                </Text>
                <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
              </Pressable>
            ))}
          </ListSection>

          {/* Drawn only when there is somebody to name. A card headed "Your
              department admin" with nothing under it is worse than no card. */}
          {admin ? (
            <ListSection title={describeAdminContactHeading(admin.scope)}>
              <Pressable
                accessibilityHint={onOpenAdminChat ? 'Opens a chat with them' : undefined}
                accessibilityLabel={`${admin.displayName}, ${admin.roleName}`}
                accessibilityRole={onOpenAdminChat ? 'button' : 'text'}
                disabled={!onOpenAdminChat}
                onPress={() => onOpenAdminChat?.(admin.contactId)}
                style={({ pressed }) => [
                  menuStyles.adminRow,
                  pressed && onOpenAdminChat && { backgroundColor: appTheme.colors.groupedBackground }
                ]}
              >
                <ProfileAvatar
                  headers={profilePhotoHeaders}
                  name={admin.displayName}
                  size={48}
                  uri={admin.profilePhotoUrl}
                />
                <View style={menuStyles.adminText}>
                  <Text numberOfLines={1} style={[menuStyles.adminName, { color: appTheme.colors.ink }]}>
                    {admin.displayName}
                  </Text>
                  <Text numberOfLines={1} style={[menuStyles.adminMeta, { color: appTheme.colors.muted }]}>
                    {describeAdminContactSubtitle({
                      otherAdminCount: admin.otherAdminCount,
                      roleName: admin.roleName
                    })}
                  </Text>
                  {admin.phoneFormatted ? (
                    <Text numberOfLines={1} style={[menuStyles.adminMeta, { color: appTheme.colors.muted }]}>
                      {admin.phoneFormatted}
                    </Text>
                  ) : null}
                </View>
                {onOpenAdminChat ? (
                  <Feather color={appTheme.colors.link} name="message-square" size={19} />
                ) : null}
              </Pressable>
            </ListSection>
          ) : null}

          {onSignOut ? (
            <ListSection>
              <Pressable
                accessibilityLabel="Log out"
                accessibilityRole="button"
                onPress={onSignOut}
                style={({ pressed }) => [
                  menuStyles.signOutRow,
                  pressed && { backgroundColor: appTheme.colors.groupedBackground }
                ]}
              >
                <Feather color={appTheme.colors.destructive} name="log-out" size={18} />
                <Text style={[menuStyles.signOutText, { color: appTheme.colors.destructive }]}>
                  Log out
                </Text>
              </Pressable>
            </ListSection>
          ) : null}
        </View>

        {/* Held against the foot of the screen rather than following the
            content, so it reads as the company's mark on the page and never
            competes with the things above it. */}
        {profile?.companyAddress ? (
          <Text
            numberOfLines={2}
            style={[
              menuStyles.address,
              {
                color: appTheme.colors.muted,
                paddingBottom: Math.max(16, screenBottomInset + 12)
              }
            ]}
          >
            {profile.companyAddress}
          </Text>
        ) : (
          <View style={{ height: Math.max(16, screenBottomInset + 12) }} />
        )}
      </View>
    </Modal>
  );
}

const menuStyles = StyleSheet.create({
  screen: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingHorizontal: 10,
    textAlign: 'center'
  },
  content: {
    flex: 1,
    paddingTop: 2
  },
  address: {
    fontSize: 11.5,
    lineHeight: 16,
    paddingHorizontal: 24,
    paddingTop: 8,
    textAlign: 'center'
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  identityText: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  identityName: {
    fontSize: 22,
    lineHeight: 28
  },
  identityMeta: {
    fontSize: 14.5,
    lineHeight: 20
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
  navLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    minWidth: 0
  },
  adminRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  adminText: {
    flex: 1,
    minWidth: 0
  },
  adminName: {
    fontSize: 16,
    lineHeight: 21
  },
  adminMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1
  },
  signOutRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  signOutText: {
    fontSize: 16,
    lineHeight: 21
  }
});
