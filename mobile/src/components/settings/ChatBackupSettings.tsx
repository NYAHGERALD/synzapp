import { ActivityIndicator, Text, View } from 'react-native';
import {
  ChatBackupPolicy,
  type ChatBackupRestoreStatus
} from '../../services/chatBackup';
import {
  describeLastBackup,
  describeRestoreState
} from '../../services/chatBackupDisplay';
import { SettingsListItem } from '../../components/offlineSettings/OfflineChatSettings';
import { ListSection, ListSwitchRow } from '../ui/GroupedList';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Encrypted chat backup settings.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ChatBackupSettings({
  backupError,
  canManagePolicy,
  lastBackupAtMs,
  restoreRequestStatus,
  isLoadingPolicy,
  isSavingPolicy,
  isSyncing,
  onBackupNow,
  onUpdatePolicy,
  onRestore,
  policy
}: {
  /** The last failure, so a backup that stopped working says so. */
  backupError: string | null;
  canManagePolicy: boolean;
  isLoadingPolicy: boolean;
  isSavingPolicy: boolean;
  isSyncing: boolean;
  /** When this device last uploaded, so "backed up" is a fact and not a promise. */
  lastBackupAtMs: number | null;
  onBackupNow: () => void;
  onUpdatePolicy: (policy: Pick<ChatBackupPolicy, 'encryptedBackupsEnabled' | 'selfRestoreEnabled'>) => void;
  onRestore: () => void;
  policy: ChatBackupPolicy;
  /** Where this device's request stands, if it has had to ask. */
  restoreRequestStatus: ChatBackupRestoreStatus | null;
}) {
  const appTheme = useAppTheme();
  const lastBackupLabel = describeLastBackup(lastBackupAtMs);
  const isRestorePending = restoreRequestStatus === 'pending';
  const restoreSubtitle = describeRestoreState(restoreRequestStatus, policy.selfRestoreEnabled);

  if (isLoadingPolicy) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  const backupStatus = policy.encryptedBackupsEnabled ? 'Enabled by organization' : 'Disabled by organization';
  const restoreStatus = policy.selfRestoreEnabled
    ? 'Recovery-key restore allowed'
    : 'Restore requires organization approval';

  return (
    <View style={styles.backupSettings}>
      <ListSection
        footer="Set for everyone in the organization. Only an admin can change it."
        title="Organization policy"
      >
        <SettingsListItem
          subtitle={backupStatus}
          title="Encrypted chat backup"
        />
        <SettingsListItem
          subtitle={restoreStatus}
          title="Self-service restore"
        />
        {/* Switches, not rows that read like labels.
            These were `Enable backup` / `Enable self restore` with a subtitle,
            which look exactly like the two status rows above them and left an
            admin unable to tell that anything here was theirs to change. A
            switch says what it is and shows its current state at a glance.
            The second is disabled until backups are on, because a restore has
            to have something to restore from. */}
        {canManagePolicy ? (
          <ListSwitchRow
            disabled={isSavingPolicy}
            onValueChange={(nextEnabled) => onUpdatePolicy({
              encryptedBackupsEnabled: nextEnabled,
              selfRestoreEnabled: nextEnabled ? policy.selfRestoreEnabled : false
            })}
            subtitle="Lets a device restore its history after the app is reinstalled"
            title="Encrypted backups"
            value={policy.encryptedBackupsEnabled}
          />
        ) : null}
        {canManagePolicy ? (
          <ListSwitchRow
            disabled={isSavingPolicy || !policy.encryptedBackupsEnabled}
            onValueChange={(nextEnabled) => onUpdatePolicy({
              encryptedBackupsEnabled: true,
              selfRestoreEnabled: nextEnabled
            })}
            subtitle={policy.encryptedBackupsEnabled
              ? 'Restore with a recovery key, without waiting for an admin'
              : 'Turn on encrypted backups first'}
            title="Self-service restore"
            value={policy.selfRestoreEnabled}
          />
        ) : null}
      </ListSection>

      <ListSection title="This device">
        {/* What this device's own history is doing.
            An employee is not a key custodian, so there is no key here to copy.
            The backup key is escrowed to the organization and wrapped by Cloud
            KMS; getting history back on a new device is an approval, not a
            secret somebody has to have kept. */}
        <SettingsListItem
          onPress={policy.encryptedBackupsEnabled ? onBackupNow : undefined}
          subtitle={
            !policy.encryptedBackupsEnabled
              ? 'Disabled by organization'
              : isSyncing
                ? 'Backing up now'
                : backupError || lastBackupLabel
          }
          title="Back up now"
        />
        <SettingsListItem
          onPress={policy.encryptedBackupsEnabled && !isRestorePending ? onRestore : undefined}
          subtitle={
            !policy.encryptedBackupsEnabled
              ? 'Disabled by organization'
              : restoreSubtitle
          }
          title="Restore my chats"
        />
      </ListSection>
    </View>
  );
}
