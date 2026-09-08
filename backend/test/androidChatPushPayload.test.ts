import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withAndroidNotificationDisplayKeys } from '../src/services/notificationService.ts';

/**
 * What Android needs in a chat push before it will show anything.
 *
 * Chat pushes are sent data-only on purpose, so that our code runs even with
 * the app shut and can record delivery. The price is that nothing appears
 * unless the payload describes it, and for a long time it did not: the facts
 * were all there under names of our own, so Expo's receiver — which reads
 * `title`, `message`, `channelId` and `badge` and nothing else — built a
 * notification with no title and no text.
 */

const EXISTING = {
  chatType: 'DIRECT',
  contactId: 'sender-uid',
  conversationId: 'conv-1',
  envelopeId: 'env-1',
  sentAt: '2026-09-06T21:00:00.000Z',
  type: 'chat.message'
};

describe('the Android chat push payload', () => {
  it('carries the four keys the receiver actually reads', () => {
    const data = withAndroidNotificationDisplayKeys(EXISTING, {
      badgeCount: 3,
      message: 'New message',
      title: 'Gerald Nyan'
    });

    assert.equal(data.title, 'Gerald Nyan');
    assert.equal(data.message, 'New message');
    assert.equal(data.channelId, 'chat-messages');
    assert.equal(data.badge, '3');
  });

  it('never adds a body key, which would break the app it is meant to reach', () => {
    // Expo treats a JSON `body` as "sent by Expo's own service", and then stops
    // filling `content.data` — which is exactly what the app's foreground
    // handler reads. Adding one fixes the tray and breaks the app.
    const data = withAndroidNotificationDisplayKeys(EXISTING, {
      badgeCount: 1,
      message: 'New message',
      title: 'Gerald Nyan'
    });

    assert.equal('body' in data, false);
  });

  it('keeps every field the app already relies on', () => {
    const data = withAndroidNotificationDisplayKeys(EXISTING, {
      badgeCount: 0,
      message: 'New message',
      title: 'Gerald Nyan'
    });

    for (const [key, value] of Object.entries(EXISTING)) {
      assert.equal(data[key], value, `${key} was lost`);
    }
  });

  it('keeps the two fields the delivery receipt is built from', () => {
    // A shut phone confirms delivery from these, read flat off the data map.
    const data = withAndroidNotificationDisplayKeys(EXISTING, {
      badgeCount: 0,
      message: 'New message',
      title: 'Gerald Nyan'
    });

    assert.equal(data.type, 'chat.message');
    assert.equal(data.contactId, 'sender-uid');
  });

  it('sends the badge as a string, because a push payload holds only strings', () => {
    const data = withAndroidNotificationDisplayKeys(EXISTING, {
      badgeCount: 12,
      message: 'New message',
      title: 'Gerald Nyan'
    });

    assert.equal(typeof data.badge, 'string');
  });

  it('names the channel the app creates, not a generic one', () => {
    const data = withAndroidNotificationDisplayKeys(EXISTING, {
      badgeCount: 0,
      message: 'New encrypted message',
      title: 'Gerald Nyan'
    });

    // Must match CHAT_MESSAGES_CHANNEL_ID in the app, or the notice lands on
    // Expo's fallback channel where nobody can recognise or tune it.
    assert.equal(data.channelId, 'chat-messages');
  });
});
