import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ChatContact } from '../../services/chatApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Picking who a message is forwarded to.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ForwardRecipientModal({
  contacts,
  isForwarding,
  isOpen,
  onCancel,
  onConfirm,
  onToggleRecipient,
  profilePhotoHeaders,
  selectedCount,
  selectedRecipientIds
}: {
  contacts: ChatContact[];
  isForwarding: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onToggleRecipient: (contactId: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  selectedCount: number;
  selectedRecipientIds: Record<string, boolean>;
}) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const safeQuery = query.trim().toLowerCase();
  const filteredContacts = safeQuery
    ? contacts.filter((contact) => [
        contact.displayName,
        contact.preview,
        contact.chatType
      ].some((value) => (value || '').toLowerCase().includes(safeQuery)))
    : contacts;
  const frequentContacts = safeQuery ? filteredContacts : filteredContacts.slice(0, 6);
  const recentContacts = safeQuery ? [] : filteredContacts.slice(6);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function renderContact(contact: ChatContact) {
    const isSelected = Boolean(selectedRecipientIds[contact.contactId]);

    return (
      <Pressable
        accessibilityLabel={`Forward to ${contact.displayName}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected, disabled: !contact.hasActiveDevice }}
        disabled={!contact.hasActiveDevice || isForwarding}
        key={contact.contactId}
        onPress={() => onToggleRecipient(contact.contactId)}
        style={({ pressed }) => [
          styles.forwardRecipientRow,
          !contact.hasActiveDevice && styles.forwardRecipientRowDisabled,
          pressed && contact.hasActiveDevice && styles.pressed
        ]}
      >
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={contact.displayName}
          size={42}
          uri={contact.profilePhotoUrl}
        />

        <View style={styles.forwardRecipientText}>
          <Text numberOfLines={1} style={styles.forwardRecipientName}>{contact.displayName}</Text>
          <Text numberOfLines={1} style={styles.forwardRecipientSubtitle}>
            {contact.hasActiveDevice ? contact.preview || 'Available' : 'Secure device not ready'}
          </Text>
        </View>

        <View style={[
          styles.forwardRecipientCheck,
          isSelected && styles.forwardRecipientCheckSelected
        ]}>
          {isSelected ? (
            <Feather color="#FFFFFF" name="check" size={15} />
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Modal animationType="slide" presentationStyle="overFullScreen" transparent visible onRequestClose={onCancel}>
      <View style={styles.forwardRecipientOverlay}>
        <View style={[
          styles.forwardRecipientSheet,
          {
            paddingBottom: Math.max(insets.bottom, 10),
            paddingTop: Math.max(insets.top, 10)
          }
        ]}>
          <View style={styles.forwardRecipientHeader}>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.forwardRecipientCloseButton, pressed && styles.pressed]}
            >
              <Feather color="#0F172A" name="x" size={24} />
            </Pressable>
            <Text style={styles.forwardRecipientTitle}>Send to</Text>
            <View style={styles.forwardRecipientHeaderSpacer} />
          </View>

          <View style={styles.forwardRecipientSearchWrap}>
            <Feather color="#64748B" name="search" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#8B95A5"
              style={styles.forwardRecipientSearchInput}
              value={query}
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.forwardRecipientList}
          >
            {safeQuery ? (
              <View style={styles.forwardRecipientSection}>
                <Text style={styles.forwardRecipientSectionTitle}>Search results</Text>
                {filteredContacts.length ? filteredContacts.map(renderContact) : (
                  <Text style={styles.forwardRecipientEmptyText}>No matching chats</Text>
                )}
              </View>
            ) : (
              <>
                <View style={styles.forwardRecipientSection}>
                  <Text style={styles.forwardRecipientSectionTitle}>Frequently contacted</Text>
                  {frequentContacts.map(renderContact)}
                </View>
                {recentContacts.length ? (
                  <View style={styles.forwardRecipientSection}>
                    <Text style={styles.forwardRecipientSectionTitle}>Recent chats</Text>
                    {recentContacts.map(renderContact)}
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          <View style={styles.forwardRecipientFooter}>
            <Text style={styles.forwardRecipientCount}>
              {selectedCount ? `${selectedCount} selected` : 'Select up to 5 chats'}
            </Text>
            <Pressable
              accessibilityLabel="Forward messages"
              accessibilityRole="button"
              disabled={!selectedCount || isForwarding}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.forwardRecipientSendButton,
                (!selectedCount || isForwarding) && styles.disabled,
                pressed && Boolean(selectedCount) && !isForwarding && styles.pressed
              ]}
            >
              {isForwarding ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather color="#FFFFFF" name="corner-up-right" size={17} />
                  <Text style={styles.forwardRecipientSendText}>Forward</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
