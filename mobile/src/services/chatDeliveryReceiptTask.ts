import * as TaskManager from 'expo-task-manager';
import { getAuth } from '@react-native-firebase/auth';
import { getSynzappApiBaseUrl } from './apiConfig';
import {
  readChatDeliveryReceiptTarget,
  readChatPushData,
  type ChatDeliveryReceiptTarget
} from './chatDeliveryReceipt';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

/**
 * Telling the server this phone has a message, even with the app shut.
 *
 * This is the half of "Delivered" that was missing. Delivery used to be
 * recorded in exactly two places, and **both needed the app to be running**:
 * opening a thread, and the live socket refreshing the chat list. So a message
 * to somebody whose app was closed stayed on one tick however well the push
 * worked.
 *
 * When a chat push arrives, Android starts a bare JavaScript context — no
 * screens, no React, nothing on show — runs this, and stops. That is why the
 * work here is small, why nothing throws, and why the logic that decides what a
 * push means lives in `chatDeliveryReceipt.ts` where it can be tested.
 *
 * **This is best effort, and it is meant to be.** It cannot always run: an app
 * the user force-stopped receives no pushes at all until it is opened again,
 * and battery saving delays the rest. When it does not run, the receipt is
 * simply made later, by the socket, the moment the app is next opened. The tick
 * is then **late rather than wrong**, which is what WhatsApp does when a phone
 * is switched off.
 *
 * There is no retry queue here on purpose. The app-open path already covers
 * every message this misses, so a queue would be a second mechanism for
 * something already handled, with its own storage to go stale.
 */

export const CHAT_DELIVERY_RECEIPT_TASK = 'synzapp-chat-delivery-receipt';

/**
 * How long to wait for the signed-in account to come back.
 *
 * A headless start has no session in memory; the native Firebase SDK restores
 * it from the keychain a moment later. Waiting is the difference between a
 * receipt being sent and being dropped, but the platform gives a background
 * task only seconds in total, so the wait is short and giving up is safe.
 */
const AUTH_RESTORE_TIMEOUT_MS = 4000;

TaskManager.defineTask(CHAT_DELIVERY_RECEIPT_TASK, async (body: unknown) => {
  const task = (body || {}) as { data?: unknown; error?: unknown };

  // Every step says what it did. A background task reports nothing by itself:
  // it runs with no screen, no user and no error surface, so without this the
  // only symptom of any fault in here is a notification that stays on its
  // placeholder and a tick that never turns over — which is indistinguishable
  // from the push never arriving.
  console.log('[SynzappPreview] task fired', JSON.stringify({
    hasData: Boolean(task.data),
    hasError: Boolean(task.error)
  }));

  if (task.error) {
    return;
  }

  const pushData = readChatPushData(task.data);
  const target = readChatDeliveryReceiptTarget(pushData);

  console.log('[SynzappPreview] payload read', JSON.stringify({
    foundChatData: Boolean(pushData),
    keys: pushData && typeof pushData === 'object'
      ? Object.keys(pushData as Record<string, unknown>).slice(0, 25)
      : [],
    target
  }));

  if (!target) {
    return;
  }

  // Nothing is watching in here. A thrown error is not reported anywhere and
  // the platform's only answer to one is to kill the task, so a failure is
  // swallowed and left for the app-open path to correct.
  //
  // Both jobs are started together rather than one after the other. Confirming
  // delivery and revealing the message are unrelated, and a background task is
  // given only seconds, so making the second wait on the first risks losing
  // both to a slow network.
  // Only the receipt. Revealing the message is done in the notification
  // service itself, in Kotlin, before the notification is ever drawn — which is
  // better than doing it here, because there is no placeholder to replace and
  // so nothing visibly changes a moment after it appears.
  const recorded = await sendChatDeliveryReceipt(target).catch((error) => String(error));

  console.log('[SynzappPreview] receipt', JSON.stringify({ recorded }));
});

/**
 * Records the receipt against this device.
 *
 * Exported so the app can use the same call while running, not only the
 * background task.
 */
export async function sendChatDeliveryReceipt(
  target: ChatDeliveryReceiptTarget
): Promise<boolean> {
  const idToken = await waitForIdToken();

  if (!idToken) {
    return false;
  }

  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);

  if (!deviceHeaders['X-Synzapp-Device-Id']) {
    return false;
  }

  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/chat/delivery-receipts`, {
    body: JSON.stringify({
      chatType: target.chatType,
      contactId: target.contactId
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...deviceHeaders
    },
    method: 'POST'
  });

  return response.ok;
}

/**
 * The signed-in account's token, waiting briefly for it to be restored.
 *
 * Returns null rather than waiting forever. A phone with nobody signed in has
 * nothing to acknowledge, and a background task that hangs is one the platform
 * kills and then trusts less next time.
 */
async function waitForIdToken(): Promise<string | null> {
  const auth = getAuth();

  if (auth.currentUser) {
    return auth.currentUser.getIdToken().catch(() => null);
  }

  const user = await new Promise<{ getIdToken: () => Promise<string> } | null>((resolve) => {
    let settled = false;
    const settle = (value: { getIdToken: () => Promise<string> } | null) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };

    const timer = setTimeout(() => settle(null), AUTH_RESTORE_TIMEOUT_MS);
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      if (nextUser) {
        settle(nextUser);
      }
    });
  });

  return user ? user.getIdToken().catch(() => null) : null;
}
