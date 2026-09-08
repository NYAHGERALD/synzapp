import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { TenantDepartment, TenantRole } from '../../services/adminApi';
import { formatManualInvitePhoneNumberInput } from '../../components/calls/CallKeypadModal';
import { getInitials } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The invitation draft.
 *
 * Lifted out of the chat screen unchanged.
 */

export type InviteMode = 'single' | 'batch' | 'manual';

export interface InviteContactDraft {
  displayName?: string;
  phoneNumber: string;
}

export interface InviteDraft {
  contacts: InviteContactDraft[];
  department: TenantDepartment;
  mode: InviteMode;
  role: TenantRole;
}

export function InviteDraftPanel({
  draft,
  isPickingContact,
  isSavingInvite,
  onAddContact,
  onCancel,
  onSend
}: {
  draft: InviteDraft;
  isPickingContact: boolean;
  isSavingInvite: boolean;
  onAddContact: () => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const appTheme = useAppTheme();
  const contactCount = draft.contacts.length;
  const actionDisabled = isPickingContact || isSavingInvite;
  const isBatchMode = draft.mode === 'batch';

  return (
    <View style={[
      styles.inviteDraft,
      {
        backgroundColor: appTheme.colors.surfaceElevated,
        borderColor: appTheme.colors.border
      }
    ]}>
      <View style={styles.inviteDraftHeader}>
        <View style={styles.chatText}>
          <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>
            {isBatchMode
              ? contactCount === 1
                ? 'Batch import - 1 selected'
                : `Batch import - ${contactCount} selected`
              : 'Ready to invite'}
          </Text>
          <Text style={[styles.chatPreview, { color: appTheme.colors.muted }]}>
            {draft.department.name} - {draft.role.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={actionDisabled}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.textOnlyButton,
            pressed && !actionDisabled && styles.pressed,
            actionDisabled && styles.disabled
          ]}
        >
          <Text style={[styles.textOnlyButtonText, { color: appTheme.colors.muted }]}>Cancel</Text>
        </Pressable>
      </View>

      {draft.contacts.map((contact) => (
        <InviteDraftContactRow contact={contact} key={contact.phoneNumber} />
      ))}

      <View style={styles.inviteDraftActions}>
        {isBatchMode ? (
          <Pressable
            accessibilityRole="button"
            disabled={actionDisabled}
            onPress={onAddContact}
            style={({ pressed }) => [
              styles.secondaryActionButton,
              { borderColor: appTheme.colors.border },
              pressed && !actionDisabled && styles.pressed,
              actionDisabled && styles.disabled
            ]}
          >
            <Text style={[styles.secondaryActionButtonText, { color: appTheme.colors.ink }]}>
              {isPickingContact ? 'Opening contacts' : 'Add another contact'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={actionDisabled || contactCount === 0}
          onPress={onSend}
          style={({ pressed }) => [
            styles.primaryActionButton,
            { backgroundColor: appTheme.colors.primary },
            !isBatchMode && styles.singleInviteActionButton,
            pressed && !actionDisabled && contactCount > 0 && styles.pressed,
            (actionDisabled || contactCount === 0) && styles.disabled
          ]}
        >
          <Text style={styles.primaryActionButtonText}>
            {isSavingInvite ? 'Sending' : contactCount === 1 ? 'Send invite' : 'Send invites'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InviteDraftContactRow({ contact }: { contact: InviteContactDraft }) {
  const appTheme = useAppTheme();
  const formattedPhoneNumber = formatPhoneNumberForInviteDisplay(contact.phoneNumber);
  const hasDisplayName = Boolean(contact.displayName?.trim());
  const name = hasDisplayName ? contact.displayName?.trim() || formattedPhoneNumber : formattedPhoneNumber;
  const subtitle = hasDisplayName ? formattedPhoneNumber : 'Phone invite';

  return (
    <View style={[
      styles.inviteDraftContactRow,
      { backgroundColor: appTheme.colors.surface }
    ]}>
      <View style={[
        styles.inviteDraftAvatar,
        {
          backgroundColor: appTheme.colors.primarySoft,
          borderColor: appTheme.colors.primary
        }
      ]}>
        {hasDisplayName ? (
          <Text style={[styles.inviteDraftAvatarText, { color: appTheme.colors.primary }]}>
            {getInitials(name)}
          </Text>
        ) : (
          <Feather color={appTheme.colors.primary} name="phone" size={18} />
        )}
      </View>
      <View style={styles.chatText}>
        <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{name}</Text>
        <Text style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function formatPhoneNumberForInviteDisplay(phoneNumber: string): string {
  return formatManualInvitePhoneNumberInput(phoneNumber);
}
