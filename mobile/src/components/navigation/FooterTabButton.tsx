import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Animated, Pressable, Text, View } from 'react-native';
import { CurrentUserProfile } from '../../services/profileApi';
import { FooterTab } from '../../components/guidedSetup/GuidedSetupCoachOverlay';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * A bottom navigation tab.
 *
 * Lifted out of the chat screen unchanged.
 */

export function FooterTabButton({
  active,
  badgeCount = 0,
  minHeight,
  onLayout,
  onPress,
  profile,
  profilePhotoHeaders,
  tab
}: {
  active: boolean;
  badgeCount?: number;
  minHeight: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  onPress: () => void;
  profile: CurrentUserProfile | null;
  profilePhotoHeaders?: Record<string, string>;
  tab: FooterTab;
}) {
  const appTheme = useAppTheme();
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(activeProgress, {
      damping: 16,
      mass: 0.82,
      stiffness: 190,
      toValue: active ? 1 : 0,
      useNativeDriver: true
    }).start();
  }, [active, activeProgress]);

  const pillScale = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1]
  });
  const pillOpacity = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });
  const contentScale = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04]
  });

  return (
    <Pressable
      accessibilityLabel={tab}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onLayout={onLayout}
      onPress={onPress}
      style={({ pressed }) => [
        styles.footerTab,
        { minHeight },
        pressed && styles.pressed
      ]}
    >
      <Animated.View style={[
        styles.footerTabContent,
        { transform: [{ scale: contentScale }] }
      ]}>
        <View style={styles.footerTabIconWrap}>
          {/* Fills the icon's box exactly, so it reads as a ring around the
              icon rather than a slab behind the whole tab. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.footerTabActivePill,
              {
                backgroundColor: appTheme.colors.footerActive,
                opacity: pillOpacity,
                transform: [{ scale: pillScale }]
              }
            ]}
          />
          <FooterIcon
            active={active}
            profile={profile}
            profilePhotoHeaders={profilePhotoHeaders}
            tab={tab}
          />
          {/* Last, and raised, so the selection circle can never cover it. */}
          {badgeCount > 0 ? (
            <View style={styles.footerTabBadge}>
              <Text style={styles.footerTabBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
            </View>
          ) : null}
        </View>
        {/* One line always. "Announcements" is wider than a sixth of the screen
            at this size, and wrapping it cut the word in half. It shrinks to
            fit instead of being abbreviated, so the label still says what the
            tab is. */}
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          style={[
            styles.footerTabText,
            active && styles.footerTabTextActive,
            { color: active ? appTheme.colors.primary : appTheme.colors.ink }
          ]}
        >
          {tab}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function FooterIcon({
  active,
  profile,
  profilePhotoHeaders,
  tab
}: {
  active: boolean;
  profile: CurrentUserProfile | null;
  profilePhotoHeaders?: Record<string, string>;
  tab: FooterTab;
}) {
  const appTheme = useAppTheme();
  const iconColor = active ? appTheme.colors.primary : appTheme.colors.mutedStrong;

  if (tab === 'You') {
    return (
      <View style={[
        styles.footerProfileAvatar,
        active && styles.footerProfileAvatarActive,
        active && {
          backgroundColor: appTheme.colors.primarySoft,
          borderColor: appTheme.colors.primary
        }
      ]}>
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={profile?.displayName || 'You'}
          size={24}
          uri={profile?.profilePhotoUrl}
        />
      </View>
    );
  }

  if (tab === 'Employees') {
    return <Ionicons color={iconColor} name={active ? 'people' : 'people-outline'} size={22} />;
  }

  if (tab === 'Interpreter') {
    return <Ionicons color={iconColor} name={active ? 'language' : 'language-outline'} size={22} />;
  }

  if (tab === 'Calls') {
    return <Ionicons color={iconColor} name={active ? 'call' : 'call-outline'} size={22} />;
  }

  if (tab === 'Announcements') {
    return <Ionicons color={iconColor} name={active ? 'megaphone' : 'megaphone-outline'} size={22} />;
  }

  if (tab === 'Groups') {
    return <Ionicons color={iconColor} name={active ? 'albums' : 'albums-outline'} size={22} />;
  }

  if (tab === 'Settings') {
    return <Ionicons color={iconColor} name={active ? 'settings' : 'settings-outline'} size={22} />;
  }

  return <Ionicons color={iconColor} name={active ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={22} />;
}
