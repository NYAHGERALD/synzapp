import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { EmployeeListItem, EmployeeRow } from '../../components/directory/EmployeeRow';
import { InviteDraft, InviteDraftPanel } from '../../components/invites/InviteDraftPanel';
import { describeEmployeesEmptyState } from '../../services/employeesDirectoryCopy';
import { getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The employees directory tab.
 *
 * Lifted out of the chat screen unchanged.
 */

export function EmployeesTab({
  canInviteEmployees,
  canManageUsers,
  departmentName,
  employees,
  isDepartmentScoped,
  inviteDraft,
  isLoading,
  isUpdatingLifecycle,
  isPickingContact,
  isSavingInvite,
  onAddContact,
  onCancelDraft,
  onPermanentlyRemoveDeletedEmployee,
  onReactivateDeletedEmployee,
  onSelectEmployee,
  onSendDraft,
  profilePhotoHeaders
}: {
  canInviteEmployees: boolean;
  canManageUsers: boolean;
  departmentName: string | null;
  employees: EmployeeListItem[];
  /** A department admin only ever sees their own department, minus themselves. */
  isDepartmentScoped: boolean;
  inviteDraft: InviteDraft | null;
  isLoading: boolean;
  isUpdatingLifecycle: boolean;
  isPickingContact: boolean;
  isSavingInvite: boolean;
  onAddContact: () => void;
  onCancelDraft: () => void;
  onPermanentlyRemoveDeletedEmployee: (employee: EmployeeListItem) => void;
  onReactivateDeletedEmployee: (employee: EmployeeListItem) => void;
  onSelectEmployee: (employee: EmployeeListItem) => void;
  onSendDraft: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const emptyState = describeEmployeesEmptyState({
    canInviteEmployees,
    departmentName,
    isDepartmentScoped
  });

  return (
    <View style={styles.fixedListTab}>
      {inviteDraft ? (
        <InviteDraftPanel
          draft={inviteDraft}
          isPickingContact={isPickingContact}
          isSavingInvite={isSavingInvite}
          onAddContact={onAddContact}
          onCancel={onCancelDraft}
          onSend={onSendDraft}
        />
      ) : null}

      <FlatList
        alwaysBounceVertical={false}
        bounces={false}
        contentContainerStyle={[
          styles.fixedListContent,
          !employees.length && styles.fixedListEmptyContent
        ]}
        data={employees}
        keyExtractor={(employee) => employee.id}
        keyboardDismissMode={getKeyboardDismissMode()}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={appTheme.colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: appTheme.colors.muted }]}>
                {emptyState.title}
              </Text>
              <Text style={[employeesTabStyles.emptyMessage, { color: appTheme.colors.muted }]}>
                {emptyState.message}
              </Text>
            </View>
          )
        }
        overScrollMode="never"
        renderItem={({ item: employee }) => (
          <EmployeeRow
            canManageUsers={canManageUsers}
            employee={employee}
            isUpdatingLifecycle={isUpdatingLifecycle}
            onPermanentlyRemoveDeleted={() => onPermanentlyRemoveDeletedEmployee(employee)}
            onReactivateDeleted={() => onReactivateDeletedEmployee(employee)}
            onSelect={() => onSelectEmployee(employee)}
            profilePhotoHeaders={profilePhotoHeaders}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.fixedList}
      />
    </View>
  );
}

const employeesTabStyles = StyleSheet.create({
  emptyMessage: {
    fontSize: 14,
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 300,
    textAlign: 'center'
  }
});
