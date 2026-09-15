/**
 * How large a realtime frame may be.
 *
 * All three WebSocket servers were constructed with `{ noServer: true }` and
 * nothing else, which leaves the `ws` default of **100 MiB** per frame — against
 * `express.json({ limit: '8mb' })` on the HTTP side. The sockets are also wired
 * to the upgrade event outside the Express chain, so neither `enforceDeviceBinding`
 * nor `verifyAppCheck` runs on them: they were the largest and least guarded
 * intake in the product.
 *
 * This number is deliberately generous rather than tight, because a limit that
 * breaks a real message is a limit somebody raises back to infinity. What each
 * socket actually carries:
 *
 *   - **Chat**: control frames only — authenticate, subscribe, typing,
 *     heartbeat. Message bodies never cross it. Kilobytes.
 *   - **Calls**: WebRTC signalling. An SDP offer with many ICE candidates is the
 *     biggest thing, and is tens of kilobytes.
 *   - **RCA**: node input, whose own schema allows 80 detail fields of 1200
 *     characters each. That is the real floor here, around a hundred kilobytes
 *     before JSON overhead.
 *
 * Half a megabyte clears all three with room to spare and is still two hundred
 * times smaller than the default it replaces.
 */
export const REALTIME_MAX_PAYLOAD_BYTES = 512 * 1024;
