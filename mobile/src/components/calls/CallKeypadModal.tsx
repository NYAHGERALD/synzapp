import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ChatContact } from '../../services/chatApi';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { getCallContactSubtitle } from '../../components/calls/ScheduleCallModal';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  callingCodesLongestFirst,
  formatInternationalInput,
  maxNationalDigitsForCallingCode
} from '../../services/phoneNumberInput';

/**
 * The dial pad.
 *
 * Lifted out of the chat screen unchanged.
 */

export interface CurrentUserDialIdentity {
  phoneFormatted: string;
  profilePhotoUrl: string | null;
  roleName: string;
}

type CallDialMatch =
  | {
      kind: 'contact';
      contact: ChatContact;
    }
  | {
      kind: 'self';
      self: CurrentUserDialIdentity;
    };

export function CallKeypadModal({
  contacts,
  currentUser,
  digits,
  isOpen,
  onAppendDigit,
  onAppendPlus,
  onBackspace,
  onClose,
  onStartCall,
  profilePhotoHeaders
}: {
  contacts: ChatContact[];
  currentUser: CurrentUserDialIdentity;
  digits: string;
  isOpen: boolean;
  onAppendDigit: (digit: string) => void;
  onAppendPlus: () => void;
  onBackspace: () => void;
  onClose: () => void;
  onStartCall: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const dialMatch = findCallDialMatch(contacts, digits, currentUser);
  const matchedName = dialMatch?.kind === 'self'
    ? 'You'
    : dialMatch?.contact.displayName || '';
  const matchedMeta = dialMatch?.kind === 'self'
    ? currentUser.phoneFormatted
    : dialMatch?.contact ? getCallContactSubtitle(dialMatch.contact) : '';
  const matchedProfilePhotoUrl = dialMatch?.kind === 'self'
    ? currentUser.profilePhotoUrl
    : dialMatch?.contact.profilePhotoUrl || null;
  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

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
        styles.callKeypadScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingBottom: Math.max(insets.bottom + 18, 28),
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.callKeypadHeader}>
          <Pressable
            accessibilityLabel="Close keypad"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.callKeypadHeaderIconButton, pressed && styles.callKeypadHeaderIconPressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={30} />
          </Pressable>
          <Pressable
            accessibilityLabel="Delete digit"
            accessibilityRole="button"
            disabled={!digits}
            onPress={onBackspace}
            style={({ pressed }) => [
              styles.callKeypadHeaderIconButton,
              !digits && styles.disabled,
              pressed && digits && styles.callKeypadHeaderIconPressed
            ]}
          >
            <Feather color={appTheme.colors.ink} name="delete" size={28} />
          </Pressable>
        </View>

        <View style={styles.callKeypadDisplay}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.callKeypadDigits, { color: appTheme.colors.ink }]}>
            {digits ? formatCallKeypadDigits(digits) : ' '}
          </Text>
          <Text style={[styles.callKeypadHint, { color: appTheme.colors.muted }]}>Company contacts only</Text>
          {dialMatch ? (
            <View style={[
              styles.callKeypadMatchedContact,
              {
                backgroundColor: appTheme.colors.surfaceElevated,
                borderColor: appTheme.colors.border
              }
            ]}>
              <ProfileAvatar
                headers={profilePhotoHeaders}
                name={matchedName}
                size={48}
                uri={matchedProfilePhotoUrl}
              />
              <View style={styles.callKeypadMatchedText}>
                <Text numberOfLines={1} style={[styles.callKeypadMatchedName, { color: appTheme.colors.ink }]}>
                  {matchedName}
                </Text>
                <Text numberOfLines={1} style={[styles.callKeypadMatchedMeta, { color: appTheme.colors.muted }]}>
                  {matchedMeta}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.callKeypadGrid}>
          {keypadRows.flatMap((row) => row.map((digit) => (
            <Pressable
              accessibilityLabel={`Dial ${digit}`}
              accessibilityRole="button"
              key={digit}
              onLongPress={digit === '0' ? onAppendPlus : undefined}
              onPress={() => onAppendDigit(digit)}
              pressRetentionOffset={12}
              style={({ pressed }) => [
                styles.callKeypadButton,
                { backgroundColor: appTheme.colors.surface },
                pressed && styles.callKeypadButtonPressed
              ]}
            >
              <Text style={[styles.callKeypadButtonText, { color: appTheme.colors.ink }]}>{digit}</Text>
              <Text style={[styles.callKeypadButtonLetters, { color: appTheme.colors.muted }]}>
                {getKeypadLetters(digit)}
              </Text>
            </Pressable>
          )))}
        </View>

        <Pressable
          accessibilityLabel="Start call"
          accessibilityRole="button"
          onPress={onStartCall}
          style={({ pressed }) => [
            styles.callKeypadStartButton,
            { backgroundColor: appTheme.colors.success },
            pressed && styles.callKeypadStartButtonPressed
          ]}
        >
          <Ionicons color="#FFFFFF" name="call" size={28} />
        </Pressable>
      </View>
    </Modal>
  );
}

export function findCallDialMatch(
  contacts: ChatContact[],
  dialInput: string,
  currentUser: CurrentUserDialIdentity
): CallDialMatch | null {
  const normalizedDialInput = normalizeCallDialInput(dialInput);

  if (!normalizedDialInput) {
    return null;
  }

  const selfPhone = normalizeCallDialInput(currentUser.phoneFormatted);

  if (selfPhone === normalizedDialInput) {
    return {
      kind: 'self',
      self: currentUser
    };
  }

  const contact = findRegisteredCallContactForDialInput(contacts, normalizedDialInput);

  return contact
    ? {
        contact,
        kind: 'contact'
      }
    : null;
}

function findRegisteredCallContactForDialInput(contacts: ChatContact[], dialInput: string): ChatContact | null {
  const normalizedDialInput = normalizeCallDialInput(dialInput);

  if (!normalizedDialInput) {
    return null;
  }

  const dialDigits = normalizedDialInput.replace(/\D/g, '');

  return contacts.find((contact) =>
    getCallContactPhoneCandidates(contact).some((candidate) =>
      isMatchingDialPhoneCandidate(candidate, normalizedDialInput, dialDigits)
    )
  ) || null;
}

function isMatchingDialPhoneCandidate(
  candidate: string,
  normalizedDialInput: string,
  dialDigits: string
): boolean {
  const candidateDigits = candidate.replace(/\D/g, '');

  if (!candidateDigits || candidateDigits.length < 7) {
    return false;
  }

  if (candidateDigits === dialDigits) {
    return true;
  }

  const normalizedCandidate = normalizeCallDialInput(candidate);

  return Boolean(
    normalizedCandidate &&
    (
      normalizedCandidate === normalizedDialInput ||
      normalizedCandidate.replace(/\D/g, '') === dialDigits
    )
  );
}

function getCallContactPhoneCandidates(contact: ChatContact): string[] {
  return [
    contact.phoneFormatted,
    contact.phoneMasked
  ]
    .map((value) => typeof value === 'string' ? normalizeCallDialInput(value) : null)
    .filter((value): value is string => Boolean(value));
}

function formatCallKeypadDigits(value: string): string {
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return hasPlus ? '+' : value;
  }

  if ((!hasPlus && digits.length <= 10) || digits.startsWith('1')) {
    return formatManualInvitePhoneNumberInput(`${hasPlus ? '+' : ''}${digits}`);
  }

  return `${hasPlus ? '+' : ''}${chunkPhoneDigits(digits, 3).join(' ')}`;
}

function normalizeCallDialInput(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue || /[#*]/.test(trimmedValue)) {
    return null;
  }

  return normalizeManualInvitePhoneNumber(trimmedValue);
}

function getKeypadLetters(digit: string): string {
  const lettersByDigit: Record<string, string> = {
    '2': 'A B C',
    '3': 'D E F',
    '4': 'G H I',
    '5': 'J K L',
    '6': 'M N O',
    '7': 'P Q R S',
    '8': 'T U V',
    '9': 'W X Y Z',
    '0': '+'
  };

  return lettersByDigit[digit] || '';
}

export function formatManualInvitePhoneNumberInput(rawPhoneNumber: string): string {
  const hasExplicitPlus = rawPhoneNumber.trim().startsWith('+');
  const digits = rawPhoneNumber.replace(/\D/g, '');

  if (!digits) {
    return hasExplicitPlus ? '+' : '';
  }

  if (!hasExplicitPlus && (digits.length <= 10 || (digits.length === 11 && digits.startsWith('1')))) {
    return formatNanpPhoneInput((digits.length === 11 ? digits.slice(1) : digits).slice(0, 10));
  }

  const callingCode = detectCallingCode(digits);
  const nationalDigits = limitNationalPhoneDigits(
    callingCode,
    digits.slice(callingCode.length)
  );

  if (callingCode === '1') {
    return formatNanpPhoneInput(nationalDigits);
  }

  return formatGenericPhoneInput(callingCode, nationalDigits);
}

export function detectCallingCode(digits: string): string {
  const callingCode = callingCodesLongestFirst().find((code) => digits.startsWith(code));

  if (callingCode) {
    return callingCode;
  }

  return digits.slice(0, Math.min(3, digits.length));
}

function formatNanpPhoneInput(nationalDigits: string): string {
  const areaCode = nationalDigits.slice(0, 3);
  const prefix = nationalDigits.slice(3, 6);
  const lineNumber = nationalDigits.slice(6, 10);
  const remainingDigits = nationalDigits.slice(10);
  let formattedPhoneNumber = '+1';

  if (areaCode) {
    formattedPhoneNumber += areaCode.length === 3 ? ` (${areaCode})` : ` (${areaCode}`;
  }

  if (prefix) {
    formattedPhoneNumber += ` ${prefix}`;
  }

  if (lineNumber) {
    formattedPhoneNumber += ` ${lineNumber}`;
  }

  if (remainingDigits) {
    formattedPhoneNumber += ` ${chunkPhoneDigits(remainingDigits, 4).join(' ')}`;
  }

  return formattedPhoneNumber;
}

/**
 * Grouped as that country groups it, not in threes.
 *
 * Threes is right for some countries and wrong for most: a French number reads
 * `6 12 34 56 78`, a British one `7911 123456`. A number grouped oddly reads as
 * a number typed wrongly.
 */
function formatGenericPhoneInput(callingCode: string, nationalDigits: string): string {
  if (!nationalDigits) {
    return `+${callingCode}`;
  }

  return formatInternationalInput(`+${callingCode}${nationalDigits}`);
}

function limitNationalPhoneDigits(callingCode: string, nationalDigits: string): string {
  return nationalDigits.slice(0, getMaxNationalDigitsForCallingCode(callingCode));
}

/**
 * Answered by libphonenumber rather than by a table kept here.
 *
 * The table this replaces disagreed with the reference in sixty-nine of its
 * hundred and sixty-six entries and had nothing at all for forty more calling
 * codes, where it fell back to "fifteen minus the calling code" — a guess that
 * is right almost nowhere. Nearly every disagreement was too short, so the
 * number was quietly truncated: a German mobile was cut at eleven digits when
 * fifteen are legal, and the invite went to a number nobody owns.
 */
export function getMaxNationalDigitsForCallingCode(callingCode: string): number {
  return maxNationalDigitsForCallingCode(callingCode);
}

function chunkPhoneDigits(digits: string, size: number): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < digits.length; index += size) {
    chunks.push(digits.slice(index, index + size));
  }

  return chunks;
}

export function normalizeManualInvitePhoneNumber(rawPhoneNumber: string): string | null {
  const trimmedPhoneNumber = rawPhoneNumber.trim();

  if (!trimmedPhoneNumber) {
    return null;
  }

  const digits = trimmedPhoneNumber.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (trimmedPhoneNumber.startsWith('+')) {
    return validateE164Phone(`+${digits}`);
  }

  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return normalizeNanpPhone(digits);
  }

  return validateE164Phone(`+${digits}`);
}

export function normalizeNanpPhone(digits: string): string | null {
  if (digits.length === 10) {
    return validateE164Phone(`+1${digits}`);
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return validateE164Phone(`+${digits}`);
  }

  return null;
}

export function validateE164Phone(phoneNumber: string): string | null {
  return /^\+[1-9]\d{6,14}$/.test(phoneNumber) ? phoneNumber : null;
}
