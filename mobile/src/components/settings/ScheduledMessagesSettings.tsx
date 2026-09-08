import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScheduledMessagePolicy } from '../../services/adminApi';
import { PressableScale } from '../messages/SheetPresentation';
import { ListSection, ListSwitchRow } from '../ui/GroupedList';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Messages waiting to be sent across the organization.
 *
 * An administrator can see that one is waiting, from whom, to whom and when —
 * and can stop it. **They cannot read it.** That is not a matter of this screen
 * choosing not to display the words: the endpoint behind it returns a record
 * that has no field for them, so there is nothing here to show even by mistake.
 * It matters because the compliance archive is one of every message's readers,
 * so handing an admin the sealed text would be handing them something they
 * could genuinely open — days before its author had committed to sending it.
 *
 * Seeing and stopping are one setting, not two. A company that turns visibility
 * off leaves its people in sole control of their own unsent messages, and an
 * admin then cannot cancel either — a half-setting would be worse than none.
 */

export function ScheduledMessagesSettings({
  isLoading,
  isSavingPolicy,
  onOpenWaitingMessages,
  onUpdatePolicy,
  policy,
  scheduledMessageCount
}: {
  isLoading: boolean;
  isSavingPolicy: boolean;
  onOpenWaitingMessages: () => void;
  onUpdatePolicy: (policy: Pick<ScheduledMessagePolicy, 'adminVisibilityEnabled' | 'enabled'>) => void;
  policy: ScheduledMessagePolicy | null;
  scheduledMessageCount: number;
}) {
  const appTheme = useAppTheme();

  if (isLoading) {
    return (
      <View style={localStyles.state}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={localStyles.page} showsVerticalScrollIndicator={false}>
      <ListSection
        footer={`People can schedule a message up to ${policy?.maxDaysAhead ?? 30} days ahead, and hold ${policy?.maxPendingPerUser ?? 20} at a time.`}
        title="Scheduled messages"
      >
        <ListSwitchRow
          disabled={isSavingPolicy || !policy}
          onValueChange={(enabled) => {
            if (policy) {
              onUpdatePolicy({ adminVisibilityEnabled: policy.adminVisibilityEnabled, enabled });
            }
          }}
          subtitle="Lets people write a message now and have it sent at a time they choose."
          title="Allow scheduling"
          value={policy?.enabled ?? true}
        />
        <ListSwitchRow
          disabled={isSavingPolicy || !policy || !policy.enabled}
          onValueChange={(adminVisibilityEnabled) => {
            if (policy) {
              onUpdatePolicy({ adminVisibilityEnabled, enabled: policy.enabled });
            }
          }}
          subtitle="Admins see who has a message waiting and can stop it. They never see what it says."
          title="Admins can see and stop them"
          value={policy?.adminVisibilityEnabled ?? true}
        />
      </ListSection>

      {policy && !policy.adminVisibilityEnabled ? (
        <ListSection>
          <View style={localStyles.notice}>
            <Feather color={appTheme.colors.muted} name="eye-off" size={16} />
            <Text style={[localStyles.noticeText, { color: appTheme.colors.mutedStrong }]}>
              Your organization has turned this off. People manage their own scheduled messages.
            </Text>
          </View>
        </ListSection>
      ) : (
        <View>
          {/* A link rather than a list. A company of thirty has a list you
              read; one of three hundred across a dozen teams has a queue you
              search, and that belongs on a screen of its own. */}
          <PressableScale
            accessibilityLabel="See waiting messages"
            onPress={onOpenWaitingMessages}
            style={[
              styles.waitingMessagesLinkButton,
              { backgroundColor: appTheme.colors.primarySoft, borderColor: appTheme.colors.primary }
            ]}
          >
            <Feather color={appTheme.colors.primary} name="clock" size={16} />
            <Text style={[styles.waitingMessagesLinkText, { color: appTheme.colors.primary }]}>
              See waiting messages{scheduledMessageCount ? ` (${scheduledMessageCount})` : ''}
            </Text>
            <Feather color={appTheme.colors.primary} name="chevron-right" size={16} />
          </PressableScale>
          <Text style={[localStyles.linkNote, { color: appTheme.colors.muted }]}>
            You can see who has a message waiting and stop it. You cannot read what it says.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  notice: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 16
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19
  },
  linkNote: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 17,
    paddingTop: 8
  },
  page: {
    gap: 8,
    paddingBottom: 32,
    paddingTop: 8
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13
  },
  rowAction: {
    fontSize: 14.5
  },
  rowMeta: {
    fontSize: 13,
    marginTop: 2
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    fontSize: 15.5
  },
  state: {
    alignItems: 'center',
    paddingVertical: 40
  }
});
