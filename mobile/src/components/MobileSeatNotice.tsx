import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { describeHeldMobileSeatNotice, type MobileSeatHolder } from '../services/mobileSeatConflict';
import { styles } from '../screens/adminChatStyles';
import { useAppTheme } from '../theme/AppThemeProvider';

/**
 * Stands where chat would be, when chat is on another phone.
 *
 * Saying not now used to raise one popup and leave nothing behind, so the person
 * sat in an app whose chat quietly failed with no way to change their mind short
 * of restarting it. This stays until they either move chat over or sign out.
 *
 * Wording lives in the service; this only draws it.
 */
export function MobileSeatNotice({
  onMoveChatHere,
  seat
}: {
  onMoveChatHere: () => void;
  seat: MobileSeatHolder;
}) {
  const appTheme = useAppTheme();
  const notice = describeHeldMobileSeatNotice(seat, Date.now());

  return (
    <View style={styles.mobileSeatNotice}>
      <View style={styles.mobileSeatNoticeText}>
        <Text style={[styles.mobileSeatNoticeTitle, { color: appTheme.colors.ink }]}>
          {notice.title}
        </Text>
        <Text style={[styles.mobileSeatNoticeBody, { color: appTheme.colors.mutedStrong }]}>
          {notice.body}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onMoveChatHere}>
        <Text style={[styles.mobileSeatNoticeAction, { color: appTheme.colors.link }]}>
          {notice.action}
        </Text>
      </Pressable>
    </View>
  );
}
