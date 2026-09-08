/**
 * Deciding when a device registration has stopped being a real device.
 *
 * Every message is sealed once per registered device of every recipient. A
 * registration is therefore a standing instruction to keep making copies, and
 * nothing ever withdrew it. A phone that was wiped, sold, or reinstalled before
 * its identity could survive an uninstall left its registration behind, still
 * marked active, still collecting a sealed copy of every message its owner is
 * ever sent — copies no key in the world can open.
 *
 * The registration also stays in the owner's device list and in the admin's,
 * where it looks exactly like a phone somebody is carrying. Three rows reading
 * "Android device" for one handset is not a list anybody can act on, which
 * makes the revoke button beside them worth less than it looks.
 *
 * So a registration expires. WhatsApp does this to linked devices at fourteen
 * days and Signal prunes on the same principle; the device that comes back
 * simply registers again and is live from that moment. That is the whole idea:
 * **retirement is a lifecycle event, not a security one**, and it is undone by
 * opening the app.
 *
 * Two rules keep it from doing harm:
 *
 * - **A device with no history is never dormant.** Missing timestamps are a
 *   reason to leave a registration alone, not to retire it.
 * - **A person is never left with no devices.** If every registration somebody
 *   owns is past the window, they all stay. Somebody back from two months away
 *   is quiet, not gone, and retiring their last device would mean messages sent
 *   to them had nowhere to go at all.
 *
 * Nothing here reads or writes anything, so the rule can be argued with in a
 * test rather than in production.
 */

/** What Firestore hands back for a timestamp, and what a plain test passes in. */
export interface DeviceActivityTimestamp {
  seconds?: number;
  toMillis?: () => number;
}

export interface DormancyCandidate {
  createdAt?: DeviceActivityTimestamp | null;
  deviceId?: string;
  lastSeenAt?: DeviceActivityTimestamp | null;
  status?: string;
  uid?: string;
}

export interface DormancyWindow {
  nowMs: number;
  retirementDays: number;
}

/**
 * Long enough that ordinary absence is not mistaken for a dead handset.
 *
 * WhatsApp's fourteen days is for a companion device whose messages the phone
 * still holds. Here the registration is somebody's phone, and a retired one
 * misses whatever is sent while it is retired, because the sender never made it
 * a copy. Six and a half weeks clears annual leave, parental leave's first
 * stretch and a long secondment, and still retires a handset that was replaced
 * inside the same quarter.
 */
export const DEFAULT_DORMANT_DEVICE_RETIREMENT_DAYS = 45;

/**
 * Floors and ceilings on what an operator may set.
 *
 * A week is the shortest window that cannot be crossed by a holiday, and a year
 * is the point past which retirement has stopped meaning anything.
 */
export const MIN_DORMANT_DEVICE_RETIREMENT_DAYS = 7;
export const MAX_DORMANT_DEVICE_RETIREMENT_DAYS = 365;

/**
 * Not `REVOKED`, deliberately.
 *
 * Revoked means a person decided this device should not be trusted, and it must
 * stay refused until that person changes their mind. Retired means nobody
 * decided anything and the device merely went quiet. Keeping them apart is what
 * lets a returning phone register itself back to life without quietly undoing
 * somebody's security decision.
 */
export const RETIRED_DEVICE_STATUS = 'RETIRED';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The operator's window, or the default when there isn't a usable one.
 *
 * Anything unset, malformed or out of bounds falls back rather than throwing:
 * this is read on the path that sends a message, and a bad number in a settings
 * document must not be able to stop a company talking to itself.
 */
export function normalizeDormantDeviceRetirementDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_DORMANT_DEVICE_RETIREMENT_DAYS;
  }

  const wholeDays = Math.floor(value);

  if (wholeDays < MIN_DORMANT_DEVICE_RETIREMENT_DAYS || wholeDays > MAX_DORMANT_DEVICE_RETIREMENT_DAYS) {
    return DEFAULT_DORMANT_DEVICE_RETIREMENT_DAYS;
  }

  return wholeDays;
}

/**
 * When this device was last known to exist.
 *
 * `lastSeenAt` is stamped on every authenticated request the device makes, so
 * it is the honest answer. Registration day stands in for a device that
 * registered and was never heard from again — a real case, and one worth
 * retiring. Null means there is nothing to judge by.
 */
export function readDeviceActivityMs(device: DormancyCandidate): number | null {
  return readTimestampMs(device.lastSeenAt) ?? readTimestampMs(device.createdAt);
}

/**
 * Whether this one registration is past its window.
 *
 * Only an active registration can be dormant. One already revoked or retired is
 * out of the fan-out for its own reasons and is not reconsidered here.
 */
export function isDormantDevice(device: DormancyCandidate, window: DormancyWindow): boolean {
  if ((device.status || 'ACTIVE') !== 'ACTIVE') {
    return false;
  }

  const activityMs = readDeviceActivityMs(device);

  if (activityMs === null) {
    return false;
  }

  const retirementDays = normalizeDormantDeviceRetirementDays(window.retirementDays);

  return window.nowMs - activityMs > retirementDays * MILLISECONDS_PER_DAY;
}

/**
 * Splits registrations into the ones worth sealing a copy for and the ones to
 * retire, **owner by owner**.
 *
 * Grouping by owner is the point. A group message gathers the devices of
 * everybody in it, and judging that whole list at once would let one colleague
 * who opened the app this morning satisfy the "never leave nobody a device"
 * rule on behalf of a colleague who has been away since spring.
 */
export function partitionDormantDevices<T extends DormancyCandidate>(
  devices: T[],
  window: DormancyWindow
): { dormant: T[]; live: T[] } {
  const byOwner = new Map<string, T[]>();

  for (const device of devices) {
    // A registration with no owner on it is judged alone, so that a record too
    // broken to attribute can never be spared by somebody else's activity.
    const ownerKey = device.uid || `device:${device.deviceId || ''}`;
    const owned = byOwner.get(ownerKey);

    if (owned) {
      owned.push(device);
    } else {
      byOwner.set(ownerKey, [device]);
    }
  }

  const dormant: T[] = [];
  const live: T[] = [];

  for (const owned of byOwner.values()) {
    const ownerDormant = owned.filter((device) => isDormantDevice(device, window));

    // Everything this person owns has gone quiet. They are not gone, they are
    // away, and taking their last device would leave the next message sent to
    // them with nowhere to be delivered.
    if (ownerDormant.length === owned.length) {
      live.push(...owned);
      continue;
    }

    for (const device of owned) {
      if (ownerDormant.includes(device)) {
        dormant.push(device);
      } else {
        live.push(device);
      }
    }
  }

  return { dormant, live };
}

function readTimestampMs(timestamp?: DeviceActivityTimestamp | null): number | null {
  if (!timestamp) {
    return null;
  }

  const milliseconds = typeof timestamp.toMillis === 'function'
    ? timestamp.toMillis()
    : (timestamp.seconds || 0) * 1000;

  return Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : null;
}
