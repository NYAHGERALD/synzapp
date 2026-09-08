import { Alert } from 'react-native';
import type { Announcement } from './announcementApi';
import { describeAudience } from './announcementDisplay';

/**
 * Reading an announcement, in the platform's own alert.
 *
 * A system alert rather than a page: it sits over whatever the person was
 * doing, states the notice, and offers one button. The words and the button are
 * in the same box, so confirming still means the text was in front of them.
 *
 * The body is passed whole. Both platforms scroll a long alert message, and a
 * notice too long to read in one is a notice that should have been shorter.
 */
export function showAnnouncementAlert(input: {
  announcement: Announcement;
  onAcknowledge: () => Promise<void>;
  onError?: (message: string) => void;
}): void {
  const { announcement } = input;
  const isAcknowledged = announcement.myStatus === 'ACKNOWLEDGED';

  const body = announcement.bodyRemovedAtMs
    ? 'This notice was removed under your organization’s retention rule. The record of who confirmed it is kept.'
    : announcement.body;

  const message = [
    body,
    '',
    `From ${announcement.createdByName}`,
    `To ${describeAudience(announcement)}`,
    new Date(announcement.createdAtMs).toLocaleString()
  ].join('\n');

  if (!announcement.requiresAcknowledgement || isAcknowledged) {
    Alert.alert(announcement.subject, message, [{ style: 'cancel', text: 'Close' }]);

    return;
  }

  Alert.alert(
    announcement.subject,
    message,
    [
      // Closing without confirming is allowed. A notice that cannot be
      // dismissed is a notice that gets confirmed without being read.
      { style: 'cancel', text: 'Not now' },
      {
        onPress: () => {
          void input.onAcknowledge().catch((error: unknown) => {
            const text = error instanceof Error ? error.message : 'That could not be saved.';

            input.onError?.(text);
            Alert.alert('Not saved', text);
          });
        },
        text: 'Acknowledge'
      }
    ],
    { cancelable: true }
  );
}
