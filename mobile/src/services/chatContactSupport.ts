import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalConversationRecord, PendingChatMessage } from '../services/localChatStore';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { ApprovedEmployee, EmployeeLifecycleAction } from '../services/adminApi';
import { BatchContactCandidate } from '../components/contacts/BatchContactModal';
import { ChatContact, ChatGroupMember, ChatMessage } from '../services/chatApi';
import { ChatItem } from '../components/groups/GroupInfoModal';
import { EmployeeAction, EmployeeListItem } from '../components/directory/EmployeeRow';
import { InviteContactDraft, formatPhoneNumberForInviteDisplay } from '../components/invites/InviteDraftPanel';
import { cacheChatGroupMemberPhotos, mapWithLimitedConcurrency } from '../services/chatMediaSupport';
import { formatEmployeeStatus } from '../components/settings/CompanyProfileSettings';
import { getCachedProfilePhotoUri } from '../services/profilePhotoCache';
import { getInitials, getMessageListPreview } from '../components/messages/MessageThread';
import { getTimestampMs, isClearedThroughTimestamp } from '../components/chatList/ChatRow';
import { normalizeNanpPhone, validateE164Phone } from '../components/calls/CallKeypadModal';
import { uniqueChatMessages } from '../services/chatMessageReconciliation';

/**
 * Building and reconciling the contact and employee lists.
 *
 * Lifted out of the chat screen unchanged.
 */

export const HIDDEN_DIRECT_CHAT_CONTACTS_KEY_PREFIX = 'synzapp:hidden-direct-chat-contacts:v1:';

export function isScheduleCallRecipientContact(contact: ChatContact): boolean {
  if (contact.isSpam || contact.spammedAt || contact.status === 'DELETED') {
    return false;
  }

  if (contact.chatType === 'GROUP') {
    return contact.status !== 'DELETED';
  }

  return contact.status !== 'INVITED' && contact.status !== 'DELETED';
}

export function isEmployeeLifecycleAction(action: EmployeeAction): action is EmployeeLifecycleAction {
  return action === 'DEACTIVATE' ||
    action === 'ARCHIVE' ||
    action === 'DELETE' ||
    action === 'ANONYMIZE' ||
    action === 'PERMANENT_DELETE' ||
    action === 'REMOVE_INVITE' ||
    action === 'REACTIVATE';
}

export function isDestructiveEmployeeAction(action: EmployeeAction): boolean {
  return action === 'DELETE' ||
    action === 'ANONYMIZE' ||
    action === 'PERMANENT_DELETE' ||
    action === 'REMOVE_INVITE' ||
    // Taking admin access away is the one that reads as removal. Giving it is
    // consequential but it is not the red button people are looking for.
    action === 'REMOVE_ORG_ADMIN';
}

export async function cacheApprovedEmployeePhotos(
  employees: ApprovedEmployee[],
  idToken: string
): Promise<ApprovedEmployee[]> {
  return mapWithLimitedConcurrency(employees, 4, async (employee) => ({
    ...employee,
    profilePhotoUrl: await getCachedProfilePhotoUri({
      cacheKey: employee.profilePhotoCacheKey,
      idToken,
      profilePhotoUrl: employee.profilePhotoUrl
    }) || employee.profilePhotoUrl
  }));
}

export async function cacheChatContactPhotos(
  contacts: ChatContact[],
  idToken: string
): Promise<ChatContact[]> {
  return mapWithLimitedConcurrency(contacts, 4, (contact) => cacheChatContactPhoto(contact, idToken));
}

export async function cacheChatContactPhoto(
  contact: ChatContact,
  idToken: string
): Promise<ChatContact> {
  const [profilePhotoUrl, members] = await Promise.all([
    getCachedProfilePhotoUri({
      cacheKey: contact.profilePhotoCacheKey,
      idToken,
      profilePhotoUrl: contact.profilePhotoUrl
    }),
    contact.members
      ? cacheChatGroupMemberPhotos(contact.members, idToken)
      : Promise.resolve(contact.members)
  ]);

  return {
    ...contact,
    members,
    profilePhotoUrl: profilePhotoUrl || contact.profilePhotoUrl
  };
}

export function mapApprovedEmployeeToListItem(
  employee: ApprovedEmployee,
  phoneDisplayOverride?: string
): EmployeeListItem {
  const phoneDisplay = getApprovedEmployeePhoneDisplay(employee, phoneDisplayOverride);
  const displayName = employee.displayName?.trim() || '';
  const hasRealDisplayName = Boolean(displayName && !isMaskedPhoneLabel(displayName));
  const name = hasRealDisplayName ? displayName : phoneDisplay;
  const baseRole = employee.role || 'EMPLOYEE';

  return {
    baseRole,
    department: employee.departmentName,
    employeeUid: employee.employeeUid,
    id: employee.approvedPhoneId,
    initials: getInitials(name),
    isPhoneOnly: !hasRealDisplayName,
    name,
    phoneFormatted: phoneDisplay,
    profilePhotoUrl: employee.profilePhotoUrl,
    role: baseRole === 'DEPT_ADMIN' ? `${employee.roleName} · Dept admin` : employee.roleName,
    roleId: employee.roleId,
    status: formatEmployeeStatus(employee.status),
    statusValue: employee.status
  };
}

export function buildStartableDirectChatContacts(
  currentContacts: ChatContact[],
  employees: ApprovedEmployee[],
  currentUid: string
): ChatContact[] {
  const contactById = new Map<string, ChatContact>();

  // First entry wins. Callers pass real conversations ahead of directory-only
  // colleagues, so an existing thread keeps its unread count and last message
  // instead of being flattened by the bare directory copy of the same person.
  currentContacts.forEach((contact) => {
    if ((contact.chatType || 'DIRECT') !== 'GROUP' && !contactById.has(contact.contactId)) {
      contactById.set(contact.contactId, contact);
    }
  });

  employees.forEach((employee) => {
    const contact = mapApprovedEmployeeToStartableChatContact(employee, currentUid);

    if (!contact || contactById.has(contact.contactId)) {
      return;
    }

    contactById.set(contact.contactId, contact);
  });

  return sortChatContacts([...contactById.values()]);
}

export async function loadPersistedHiddenDirectChatContactIds(scope: {
  ownerUid: string;
  tenantId: string;
}): Promise<string[]> {
  const storageKey = getHiddenDirectChatContactsStorageKey(scope);

  if (!storageKey) {
    return [];
  }

  const storedValue = await AsyncStorage.getItem(storageKey);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
          .map((contactId) => typeof contactId === 'string' ? contactId.trim() : '')
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export async function addPersistedHiddenDirectChatContactId(scope: {
  ownerUid: string;
  tenantId: string;
}, contactId: string): Promise<void> {
  const safeContactId = contactId.trim();
  const storageKey = getHiddenDirectChatContactsStorageKey(scope);

  if (!storageKey || !safeContactId) {
    return;
  }

  const currentContactIds = await loadPersistedHiddenDirectChatContactIds(scope);
  const nextContactIds = Array.from(new Set([...currentContactIds, safeContactId]));

  await AsyncStorage.setItem(storageKey, JSON.stringify(nextContactIds));
}

export async function removePersistedHiddenDirectChatContactId(scope: {
  ownerUid: string;
  tenantId: string;
}, contactId: string): Promise<void> {
  const safeContactId = contactId.trim();
  const storageKey = getHiddenDirectChatContactsStorageKey(scope);

  if (!storageKey || !safeContactId) {
    return;
  }

  const nextContactIds = (await loadPersistedHiddenDirectChatContactIds(scope))
    .filter((storedContactId) => storedContactId !== safeContactId);

  if (nextContactIds.length) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(nextContactIds));
    return;
  }

  await AsyncStorage.removeItem(storageKey);
}

export function getHiddenDirectChatContactsStorageKey(scope: {
  ownerUid: string;
  tenantId: string;
}): string {
  const ownerUid = scope.ownerUid.trim();
  const tenantId = scope.tenantId.trim();

  return ownerUid && tenantId
    ? `${HIDDEN_DIRECT_CHAT_CONTACTS_KEY_PREFIX}${encodeURIComponent(ownerUid)}:${encodeURIComponent(tenantId)}`
    : '';
}

export function mapApprovedEmployeeToStartableChatContact(
  employee: ApprovedEmployee,
  currentUid: string
): ChatContact | null {
  const contactId = employee.employeeUid?.trim();

  if (
    !contactId ||
    contactId === currentUid ||
    employee.status === 'DELETED' ||
    employee.status === 'ARCHIVED' ||
    employee.status === 'DEACTIVATED' ||
    employee.status === 'INVITED'
  ) {
    return null;
  }

  const displayName = getApprovedEmployeeDisplayLabel(employee);

  return {
    chatType: 'DIRECT',
    clearedAt: null,
    contactId,
    conversationId: buildLocalDirectChatPlaceholderId(currentUid, contactId),
    displayName,
    hasActiveDevice: true,
    initials: getInitials(displayName),
    isArchived: false,
    isFavorite: false,
    isPinned: false,
    isSpam: false,
    isOnline: false,
    lastMessageAt: null,
    lastSeenAt: null,
    phoneFormatted: employee.phoneFormatted || null,
    phoneMasked: employee.phoneMasked || null,
    preview: '',
    profilePhotoCacheKey: employee.profilePhotoCacheKey,
    profilePhotoUrl: employee.profilePhotoUrl,
    role: normalizeChatContactRole(employee.role),
    roleName: employee.roleName || getFallbackChatContactRoleName(employee.role),
    spammedAt: null,
    status: employee.status || 'ACTIVE',
    trashSegments: [],
    unreadCount: 0
  };
}

function buildLocalDirectChatPlaceholderId(currentUid: string, contactId: string): string {
  return `direct_local_${[currentUid, contactId].sort().join('_')}`;
}

export function normalizeChatContactRole(role: string): ChatContact['role'] {
  return role === 'ORG_ADMIN' || role === 'DEPT_ADMIN' || role === 'SYSTEM_ADMIN'
    ? role
    : 'EMPLOYEE';
}

export function getFallbackChatContactRoleName(role: string): string {
  if (role === 'ORG_ADMIN') {
    return 'Organization Admin';
  }

  if (role === 'DEPT_ADMIN') {
    return 'Department Admin';
  }

  if (role === 'SYSTEM_ADMIN') {
    return 'System Admin';
  }

  return 'Employee';
}

export function getApprovedEmployeeDisplayLabel(
  employee: ApprovedEmployee,
  phoneDisplayOverride?: string
): string {
  const phoneDisplay = getApprovedEmployeePhoneDisplay(employee, phoneDisplayOverride);
  const displayName = employee.displayName?.trim() || '';

  return displayName && !isMaskedPhoneLabel(displayName) ? displayName : phoneDisplay;
}

export function getApprovedEmployeePhoneDisplay(
  employee: ApprovedEmployee,
  phoneDisplayOverride?: string
): string {
  return phoneDisplayOverride ||
    employee.phoneFormatted ||
    employee.phoneMasked ||
    'Phone number';
}

export function buildInvitedEmployeePhoneDisplayMap(
  employees: ApprovedEmployee[],
  contacts: InviteContactDraft[]
): Record<string, string> {
  const usedContactIndexes = new Set<number>();
  const phoneDisplayByEmployeeId: Record<string, string> = {};

  employees.forEach((employee) => {
    const matchingContactIndex = contacts.findIndex((contact, index) => {
      if (usedContactIndexes.has(index)) {
        return false;
      }

      const formattedPhoneNumber = formatPhoneNumberForInviteDisplay(contact.phoneNumber);

      return (
        formattedPhoneNumber === employee.phoneFormatted ||
        maskLocalPhoneNumber(contact.phoneNumber) === employee.phoneMasked ||
        getPhoneLastFourDigits(contact.phoneNumber) === employee.phoneLast4
      );
    });

    if (matchingContactIndex < 0) {
      return;
    }

    usedContactIndexes.add(matchingContactIndex);
    phoneDisplayByEmployeeId[employee.approvedPhoneId] = formatPhoneNumberForInviteDisplay(
      contacts[matchingContactIndex].phoneNumber
    );
  });

  return phoneDisplayByEmployeeId;
}

export function isMaskedPhoneLabel(value: string): boolean {
  return value.includes('*');
}

export function mapChatContactToChatItem(contact: ChatContact): ChatItem {
  const visibleContact = applyClearedChatVisibility(contact);

  return {
    chatType: visibleContact.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
    clearedAt: visibleContact.clearedAt || null,
    contactId: visibleContact.contactId,
    conversationId: visibleContact.conversationId,
    hasActiveDevice: visibleContact.hasActiveDevice,
    id: `${visibleContact.chatType === 'GROUP' ? 'group' : 'contact'}-${visibleContact.contactId}`,
    initials: visibleContact.initials,
    isArchived: visibleContact.isArchived === true,
    isDepartmentDefault: visibleContact.isDepartmentDefault === true,
    isFavorite: visibleContact.isFavorite === true,
    isPinned: visibleContact.isPinned === true,
    isSpam: visibleContact.isSpam === true,
    isOnline: visibleContact.isOnline === true,
    lastMessageAt: visibleContact.lastMessageAt,
    lastSeenAt: visibleContact.lastSeenAt,
    memberCount: visibleContact.memberCount,
    members: visibleContact.members,
    memberPolicy: visibleContact.memberPolicy,
    phoneMasked: visibleContact.phoneMasked || null,
    profilePhotoCacheKey: visibleContact.profilePhotoCacheKey,
    preview: visibleContact.preview || '',
    profilePhotoUrl: visibleContact.profilePhotoUrl,
    role: visibleContact.role,
    roleName: visibleContact.roleName,
    spammedAt: visibleContact.spammedAt || null,
    status: visibleContact.status,
    title: visibleContact.displayName,
    trashSegments: visibleContact.trashSegments || [],
    unreadCount: visibleContact.unreadCount || 0
  };
}

export function mapChatItemToChatContact(chat: ChatItem): ChatContact {
  return {
    chatType: chat.chatType,
    clearedAt: chat.clearedAt || null,
    contactId: chat.contactId,
    conversationId: chat.conversationId,
    displayName: chat.title,
    hasActiveDevice: chat.hasActiveDevice,
    initials: chat.initials || getInitials(chat.title),
    isArchived: chat.isArchived === true,
    isDepartmentDefault: chat.isDepartmentDefault === true,
    isFavorite: chat.isFavorite === true,
    isPinned: chat.isPinned === true,
    isSpam: chat.isSpam === true,
    isOnline: chat.isOnline === true,
    lastMessageAt: chat.lastMessageAt,
    lastSeenAt: chat.lastSeenAt,
    memberCount: chat.memberCount,
    members: chat.members,
    memberPolicy: chat.memberPolicy,
    phoneMasked: chat.phoneMasked || null,
    preview: chat.preview || '',
    profilePhotoCacheKey: chat.profilePhotoCacheKey || null,
    profilePhotoUrl: chat.profilePhotoUrl || null,
    role: chat.role || 'EMPLOYEE',
    roleName: chat.roleName || '',
    spammedAt: chat.spammedAt || null,
    status: chat.status || 'ACTIVE',
    trashSegments: chat.trashSegments || [],
    unreadCount: chat.unreadCount || 0
  };
}

export function getCommonGroupContactsForDirectChat(
  chat: ChatItem | null,
  groupContacts: ChatContact[]
): ChatContact[] {
  if (!chat || chat.chatType === 'GROUP') {
    return [];
  }

  return groupContacts.filter((groupContact) =>
    (groupContact.members || []).some((member) => member.uid === chat.contactId)
  );
}

export function getAddableContactsForGroup(
  chat: ChatItem,
  directContacts: ChatContact[],
  currentUid: string
): ChatContact[] {
  const existingMemberIds = new Set((chat.members || [])
    .map((member) => member.uid)
    .filter(Boolean));

  existingMemberIds.add(currentUid);

  return directContacts.filter((contact) => !existingMemberIds.has(contact.contactId));
}

export function mapGroupMembersToSelectableContacts(
  members: ChatGroupMember[],
  directContacts: ChatContact[],
  currentUid: string
): ChatContact[] {
  const directContactById = new Map(directContacts.map((contact) => [contact.contactId, contact]));

  return members
    .filter((member) => member.uid && member.uid !== currentUid)
    .map((member) => {
      const directContact = directContactById.get(member.uid);
      const isOnline = directContact?.isOnline === true;

      return {
        chatType: 'DIRECT',
        contactId: member.uid,
        conversationId: directContact?.conversationId || member.uid,
        displayName: member.displayName,
        hasActiveDevice: directContact?.hasActiveDevice !== false,
        initials: member.initials,
        isOnline,
        lastMessageAt: null,
        lastSeenAt: directContact?.lastSeenAt || null,
        phoneMasked: directContact?.phoneMasked || null,
        preview: '',
        profilePhotoCacheKey: member.profilePhotoCacheKey || directContact?.profilePhotoCacheKey || null,
        profilePhotoUrl: member.profilePhotoUrl || directContact?.profilePhotoUrl || null,
        role: member.role,
        roleName: isOnline ? 'online' : member.roleName,
        status: 'ACTIVE',
        unreadCount: 0
      };
    });
}

export function applyLocalChatPreview(contact: ChatContact, messages: ChatMessage[]): ChatContact {
  const visibleContact = applyClearedChatVisibility(contact);
  const localMessages = uniqueChatMessages(messages).filter((message) =>
    !isMessageHiddenByContactClear(visibleContact, message)
  );
  const latestMessage = localMessages.at(-1);
  const latestPreview = latestMessage ? getMessageListPreview(latestMessage) : '';

  if (!latestMessage && !latestPreview) {
    return visibleContact;
  }

  const lastMessageAt = latestMessage &&
    (!visibleContact.lastMessageAt || latestMessage.sentAt > visibleContact.lastMessageAt)
    ? latestMessage.sentAt
    : visibleContact.lastMessageAt;

  return {
    ...visibleContact,
    lastMessageAt,
    preview: latestPreview || visibleContact.preview
  };
}

export function applyLocalChatPreviewOrEmpty(contact: ChatContact, messages: ChatMessage[]): ChatContact {
  const visibleContact = applyLocalChatPreview(contact, messages);
  const localMessages = uniqueChatMessages(messages).filter((message) =>
    !isMessageHiddenByContactClear(visibleContact, message)
  );

  if (localMessages.length) {
    return visibleContact;
  }

  return {
    ...visibleContact,
    lastMessageAt: null,
    preview: '',
    unreadCount: 0
  };
}

export function buildLocalChatContactsFromCachedConversations(
  cachedConversations: LocalConversationRecord[],
  pendingMessages: PendingChatMessage[],
  allowedCachedGroupContactIds: Set<string>
): ChatContact[] {
  const cachedContacts = cachedConversations
    .map((conversation) => conversation.contact)
    .filter((contact): contact is ChatContact => {
      if (!contact?.contactId) {
        return false;
      }

      return (contact.chatType || 'DIRECT') !== 'GROUP' || allowedCachedGroupContactIds.has(contact.contactId);
    });

  if (!cachedContacts.length) {
    return [];
  }

  return applyLocalChatPreviewsToContacts(cachedContacts, cachedConversations, pendingMessages);
}

export function applyLocalChatPreviewsToContacts(
  contacts: ChatContact[],
  cachedConversations: LocalConversationRecord[],
  pendingMessages: PendingChatMessage[]
): ChatContact[] {
  const cachedConversationByContactId = new Map<string, LocalConversationRecord>();
  const pendingMessagesByContactId = new Map<string, ChatMessage[]>();

  cachedConversations.forEach((conversation) => {
    cachedConversationByContactId.set(conversation.contactId, conversation);
  });

  pendingMessages.forEach((pendingMessage) => {
    const currentMessages = pendingMessagesByContactId.get(pendingMessage.contactId) || [];

    pendingMessagesByContactId.set(pendingMessage.contactId, [...currentMessages, pendingMessage.message]);
  });

  return sortChatContacts(contacts.map((contact) => {
    const cachedConversation = cachedConversationByContactId.get(contact.contactId);
    const localMessages = [
      ...(cachedConversation?.messages || []),
      ...(pendingMessagesByContactId.get(contact.contactId) || [])
    ];

    if (cachedConversation?.hiddenMessageIds?.length && localMessages.length === 0) {
      return applyLocalChatPreviewOrEmpty(contact, localMessages);
    }

    return applyLocalChatPreview(contact, localMessages);
  }));
}

export function mergeLoadedChatContactsWithVisibleState(
  currentContacts: ChatContact[],
  loadedContacts: ChatContact[],
  options: { preserveMissing?: boolean } = {}
): ChatContact[] {
  const currentContactById = new Map(currentContacts.map((contact) => [contact.contactId, contact]));
  const nextContactById = options.preserveMissing === false
    ? new Map<string, ChatContact>()
    : new Map(currentContactById);

  loadedContacts.forEach((loadedContact) => {
    const currentContact = currentContactById.get(loadedContact.contactId);

    nextContactById.set(
      loadedContact.contactId,
      mergeChatContactVisibleState(currentContact, loadedContact)
    );
  });

  return sortChatContacts([...nextContactById.values()]);
}

export function mergeChatContactVisibleState(
  currentContact: ChatContact | undefined,
  nextContact: ChatContact
): ChatContact {
  const currentVisibleContact = currentContact ? applyClearedChatVisibility(currentContact) : undefined;
  const mergedContact = applyClearedChatVisibility(mergeChatContactCachedPhoto(currentVisibleContact, nextContact));

  if (!currentVisibleContact) {
    return mergedContact;
  }

  if (isChatContactClearedThroughLastMessage(mergedContact)) {
    return mergedContact;
  }

  if (
    isChatContactClearedThroughLastMessage(currentVisibleContact) &&
    isNextContactStillCoveredByClear(currentVisibleContact, mergedContact)
  ) {
    return {
      ...mergedContact,
      clearedAt: currentVisibleContact.clearedAt || mergedContact.clearedAt,
      lastMessageAt: null,
      preview: '',
      unreadCount: 0
    };
  }

  const currentPreview = currentVisibleContact.preview?.trim() || '';
  const nextPreview = mergedContact.preview?.trim() || '';

  if (
    currentVisibleContact.lastMessageAt &&
    (!mergedContact.lastMessageAt || currentVisibleContact.lastMessageAt > mergedContact.lastMessageAt)
  ) {
    return {
      ...mergedContact,
      lastMessageAt: currentVisibleContact.lastMessageAt,
      preview: currentVisibleContact.preview,
      unreadCount: currentVisibleContact.unreadCount
    };
  }

  if (
    currentPreview &&
    currentVisibleContact.lastMessageAt &&
    mergedContact.lastMessageAt &&
    currentVisibleContact.lastMessageAt >= mergedContact.lastMessageAt
  ) {
    return {
      ...mergedContact,
      preview: currentVisibleContact.preview
    };
  }

  if (!currentPreview) {
    return mergedContact;
  }

  if (!nextPreview) {
    return {
      ...mergedContact,
      preview: currentVisibleContact.preview
    };
  }

  return mergedContact;
}

function applyClearedChatVisibility(contact: ChatContact): ChatContact {
  if (!isChatContactClearedThroughLastMessage(contact)) {
    return contact;
  }

  return {
    ...contact,
    lastMessageAt: null,
    preview: '',
    unreadCount: 0
  };
}

export function isChatContactClearedThroughLastMessage(contact: Pick<ChatContact, 'clearedAt' | 'lastMessageAt'>): boolean {
  return isClearedThroughTimestamp(contact.clearedAt || null, contact.lastMessageAt || null);
}

export function isMessageHiddenByContactClear(contact: Pick<ChatContact, 'clearedAt'>, message: ChatMessage): boolean {
  const clearedAtMs = getTimestampMs(contact.clearedAt || null);
  const messageSentAtMs = getTimestampMs(message.sentAt);

  return clearedAtMs !== null && messageSentAtMs !== null && messageSentAtMs <= clearedAtMs;
}

export function isNextContactStillCoveredByClear(currentContact: ChatContact, nextContact: ChatContact): boolean {
  const clearedAtMs = getTimestampMs(currentContact.clearedAt || null);
  const nextLastMessageAtMs = getTimestampMs(nextContact.lastMessageAt || null);

  return clearedAtMs !== null && (nextLastMessageAtMs === null || nextLastMessageAtMs <= clearedAtMs);
}

export function mergeChatContactCachedPhoto(
  currentContact: ChatContact | undefined,
  nextContact: ChatContact
): ChatContact {
  if (
    currentContact?.profilePhotoCacheKey &&
    currentContact.profilePhotoCacheKey === nextContact.profilePhotoCacheKey &&
    currentContact.profilePhotoUrl?.startsWith('file:')
  ) {
    return {
      ...nextContact,
      profilePhotoUrl: currentContact.profilePhotoUrl
    };
  }

  return nextContact;
}

export function upsertChatContact(currentContacts: ChatContact[], nextContact: ChatContact): ChatContact[] {
  const contactById = new Map<string, ChatContact>();

  currentContacts.forEach((contact) => {
    contactById.set(contact.contactId, contact);
  });
  contactById.set(
    nextContact.contactId,
    mergeChatContactVisibleState(contactById.get(nextContact.contactId), nextContact)
  );

  return sortChatContacts([...contactById.values()]);
}

export function sortChatContacts(contacts: ChatContact[]): ChatContact[] {
  return [...contacts].sort(compareChatContacts);
}

export function areChatContactListsEqual(firstContacts: ChatContact[], secondContacts: ChatContact[]): boolean {
  if (firstContacts.length !== secondContacts.length) {
    return false;
  }

  return firstContacts.every((firstContact, index) =>
    getChatContactListFingerprint(firstContact) === getChatContactListFingerprint(secondContacts[index])
  );
}

export function getChatContactListFingerprint(contact: ChatContact): string {
  return JSON.stringify({
    chatType: contact.chatType || 'DIRECT',
    clearedAt: contact.clearedAt || null,
    contactId: contact.contactId,
    conversationId: contact.conversationId,
    displayName: contact.displayName,
    hasActiveDevice: contact.hasActiveDevice,
    initials: contact.initials,
    isArchived: contact.isArchived === true,
    isDepartmentDefault: contact.isDepartmentDefault === true,
    isFavorite: contact.isFavorite === true,
    isPinned: contact.isPinned === true,
    isSpam: contact.isSpam === true,
    isOnline: contact.isOnline === true,
    lastMessageAt: contact.lastMessageAt || null,
    lastSeenAt: contact.lastSeenAt || null,
    memberCount: contact.memberCount || 0,
    memberPolicy: contact.memberPolicy || null,
    members: (contact.members || [])
      .map((member) => ({
        displayName: member.displayName,
        initials: member.initials,
        profilePhotoCacheKey: member.profilePhotoCacheKey || null,
        profilePhotoUrl: member.profilePhotoUrl || null,
        role: member.role,
        roleName: member.roleName,
        uid: member.uid
      }))
      .sort((first, second) => first.uid.localeCompare(second.uid)),
    messagePermissionMode: contact.messagePermissionMode || null,
    phoneFormatted: contact.phoneFormatted || null,
    phoneMasked: contact.phoneMasked || null,
    permanentlyDeletedAt: contact.permanentlyDeletedAt || null,
    preview: contact.preview,
    profilePhotoCacheKey: contact.profilePhotoCacheKey || null,
    profilePhotoUrl: contact.profilePhotoUrl || null,
    role: contact.role,
    roleName: contact.roleName,
    spammedAt: contact.spammedAt || null,
    status: contact.status,
    trashSegments: (contact.trashSegments || []).map((segment) => ({
      deletedAtMs: segment.deletedAtMs,
      endAtMs: segment.endAtMs,
      expiresAtMs: segment.expiresAtMs,
      segmentId: segment.segmentId,
      startAtMs: segment.startAtMs
    })),
    unreadCount: contact.unreadCount || 0
  });
}

export function compareChatContacts(first: ChatContact, second: ChatContact): number {
  if (first.isPinned === true && second.isPinned !== true) {
    return -1;
  }

  if (second.isPinned === true && first.isPinned !== true) {
    return 1;
  }

  if (first.lastMessageAt && second.lastMessageAt) {
    return second.lastMessageAt.localeCompare(first.lastMessageAt);
  }

  if (first.lastMessageAt) {
    return -1;
  }

  if (second.lastMessageAt) {
    return 1;
  }

  return first.displayName.localeCompare(second.displayName);
}

export function sortApprovedEmployees(employees: ApprovedEmployee[]): ApprovedEmployee[] {
  return [...employees].sort((first, second) => {
    const firstName = first.displayName || first.phoneMasked;
    const secondName = second.displayName || second.phoneMasked;

    return firstName.localeCompare(secondName);
  });
}

export function upsertApprovedEmployees(
  currentEmployees: ApprovedEmployee[],
  nextEmployees: ApprovedEmployee[]
): ApprovedEmployee[] {
  const employeeById = new Map<string, ApprovedEmployee>();

  currentEmployees.forEach((employee) => {
    employeeById.set(employee.approvedPhoneId, employee);
  });

  nextEmployees.forEach((employee) => {
    employeeById.set(employee.approvedPhoneId, employee);
  });

  return [...employeeById.values()];
}

export function getContactDisplayName(contact: Contacts.ExistingContact): string | undefined {
  const displayName = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  return displayName.trim() || undefined;
}

export async function getContactWithPhoneNumbers(
  contact: Contacts.ExistingContact
): Promise<Contacts.ExistingContact> {
  if (contact.phoneNumbers?.length) {
    return contact;
  }

  const contactWithPhoneNumbers = await Contacts.getContactByIdAsync(contact.id, [
    Contacts.Fields.Name,
    Contacts.Fields.FirstName,
    Contacts.Fields.LastName,
    Contacts.Fields.PhoneNumbers
  ]);

  return contactWithPhoneNumbers || contact;
}

export async function loadBatchContactCandidates(): Promise<BatchContactCandidate[]> {
  const contactsAvailable = await Contacts.isAvailableAsync();

  if (!contactsAvailable) {
    throw new Error('Contacts are not available on this device.');
  }

  const permission = await Contacts.requestPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Contact permission is required for batch import.');
  }

  const response = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
      Contacts.Fields.PhoneNumbers
    ],
    pageSize: 5000
  });
  const candidateByPhoneNumber = new Map<string, BatchContactCandidate>();

  response.data.forEach((contact) => {
    const displayName = getContactDisplayName(contact) || 'Unnamed contact';

    (contact.phoneNumbers || []).forEach((phoneNumber, index) => {
      const normalizedPhoneNumber = normalizeContactPhoneNumber(phoneNumber);

      if (!normalizedPhoneNumber || candidateByPhoneNumber.has(normalizedPhoneNumber)) {
        return;
      }

      const phoneMasked = maskLocalPhoneNumber(normalizedPhoneNumber);
      const label = phoneNumber.label ? `${phoneNumber.label}: ` : '';

      candidateByPhoneNumber.set(normalizedPhoneNumber, {
        displayName,
        id: `${contact.id}-${phoneNumber.id || index}-${normalizedPhoneNumber}`,
        phoneMasked,
        phoneNumber: normalizedPhoneNumber,
        subtitle: `${label}${phoneMasked}`
      });
    });
  });

  return [...candidateByPhoneNumber.values()].sort((first, second) =>
    first.displayName.localeCompare(second.displayName)
  );
}

export function normalizeContactPhoneNumber(phoneNumber: Contacts.PhoneNumber): string | null {
  const rawPhoneNumber = (phoneNumber.number || phoneNumber.digits || '').trim();

  if (!rawPhoneNumber) {
    return null;
  }

  const digits = rawPhoneNumber.replace(/\D/g, '');

  if (rawPhoneNumber.startsWith('+')) {
    return validateE164Phone(`+${digits}`);
  }

  const countryCode = phoneNumber.countryCode?.toLowerCase();

  if (countryCode === 'us' || countryCode === 'ca') {
    return normalizeNanpPhone(digits);
  }

  if (countryCode === 'mx') {
    return normalizeCountryPhone(digits, '52', 10);
  }

  if (countryCode === 'gb' || countryCode === 'uk') {
    const ukDigits = digits.startsWith('44')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;

    return validateE164Phone(`+44${ukDigits}`);
  }

  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return normalizeNanpPhone(digits);
  }

  return null;
}

export function normalizeCountryPhone(digits: string, dialCode: string, nationalLength: number): string | null {
  if (digits.length === nationalLength) {
    return validateE164Phone(`+${dialCode}${digits}`);
  }

  if (digits.startsWith(dialCode)) {
    return validateE164Phone(`+${digits}`);
  }

  return null;
}

export function maskLocalPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  const lastFourDigits = digits.slice(-4);

  return lastFourDigits ? `*****${lastFourDigits}` : '*****';
}

export function getPhoneLastFourDigits(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '').slice(-4);
}

export function selectPhoneNumber(
  contactName: string,
  phoneNumbers: Contacts.PhoneNumber[]
): Promise<Contacts.PhoneNumber | null> {
  return selectNativeOption(
    `Select number for ${contactName}`,
    phoneNumbers,
    formatPhoneNumberOption
  );
}

export function formatPhoneNumberOption(phoneNumber: Contacts.PhoneNumber): string {
  const label = phoneNumber.label ? `${phoneNumber.label}: ` : '';
  return `${label}${phoneNumber.number || phoneNumber.digits || 'Phone'}`;
}

function selectNativeOption<T>(
  title: string,
  options: T[],
  getLabel: (option: T) => string
): Promise<T | null> {
  return new Promise((resolve) => {
    let hasResolved = false;
    const resolveOnce = (value: T | null) => {
      if (hasResolved) {
        return;
      }

      hasResolved = true;
      resolve(value);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: options.length,
          options: [...options.map(getLabel), 'Cancel'],
          title
        },
        (buttonIndex) => {
          if (buttonIndex === options.length) {
            resolveOnce(null);
            return;
          }

          resolveOnce(options[buttonIndex] || null);
        }
      );
      return;
    }

    Alert.alert(
      title,
      undefined,
      [
        ...options.map((option) => ({
          onPress: () => resolveOnce(option),
          text: getLabel(option)
        })),
        {
          onPress: () => resolveOnce(null),
          style: 'cancel' as const,
          text: 'Cancel'
        }
      ],
      { onDismiss: () => resolveOnce(null) }
    );
  });
}
