import Feather from '@expo/vector-icons/Feather';
import {
  OrgAdminRoleAction,
  buildOrgAdminRoleOption,
  shouldOfferEmployeeLifecycleActions
} from '../../services/orgAdminRoleActions';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { CHAT_ROW_LEFT_ACTION_WIDTH, CHAT_ROW_SWIPE_TRIGGER, styles } from '../../screens/adminChatStyles';
import { EmployeeLifecycleAction } from '../../services/adminApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * An employee row in the company directory.
 *
 * Lifted out of the chat screen unchanged.
 */

export interface EmployeeListItem {
  baseRole: string;
  department: string;
  /** Null until they have signed in; an invite has no account behind it yet. */
  employeeUid?: string | null;
  id: string;
  initials: string;
  isPhoneOnly: boolean;
  name: string;
  phoneFormatted: string;
  profilePhotoUrl: string | null;
  role: string;
  roleId: string;
  status: string;
  statusValue: string;
}

export type EmployeeAction = EmployeeLifecycleAction
  | 'ASSIGN_DEPT_ADMIN'
  | 'REMOVE_DEPT_ADMIN'
  | 'CHANGE_ROLE'
  | OrgAdminRoleAction;

export interface EmployeeActionOption {
  action: EmployeeAction;
  confirmButton: string;
  confirmMessage: (employeeName: string) => string;
  confirmTitle: string;
  label: string;
  reason?: string;
  successMessage: (employeeName: string) => string;
  successTitle: string;
}

export function EmployeeRow({
  canManageUsers,
  employee,
  isUpdatingLifecycle,
  onPermanentlyRemoveDeleted,
  onReactivateDeleted,
  onSelect,
  profilePhotoHeaders,
  viewerUid
}: {
  canManageUsers: boolean;
  employee: EmployeeListItem;
  isUpdatingLifecycle: boolean;
  onPermanentlyRemoveDeleted: () => void;
  onReactivateDeleted: () => void;
  onSelect: () => void;
  profilePhotoHeaders?: Record<string, string>;
  /** So a row can tell it belongs to the person looking at it. */
  viewerUid?: string | null;
}) {
  const appTheme = useAppTheme();
  const hasActions = canManageUsers && getEmployeeActionOptions(employee, viewerUid).length > 0;
  const statusValue = employee.statusValue.toUpperCase();
  /**
   * Never for an organization admin. Their one action is stepping down, and the
   * swipe actions look up a lifecycle option by name — for an admin there is
   * none, so the gesture would reveal a button that silently does nothing.
   */
  const canSwipeLifecycle = shouldOfferEmployeeLifecycleActions(employee.baseRole);
  const canSwipeReactivate = hasActions &&
    canSwipeLifecycle &&
    !isUpdatingLifecycle &&
    statusValue === 'DELETED';
  const canSwipeRemove = hasActions &&
    canSwipeLifecycle &&
    !isUpdatingLifecycle &&
    (statusValue === 'DELETED' || statusValue === 'INVITED');
  const canSwipe = canSwipeReactivate || canSwipeRemove;
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);

  const closeSwipe = () => {
    offsetRef.current = 0;
    Animated.spring(translateX, {
      damping: 20,
      mass: 0.75,
      stiffness: 170,
      toValue: 0,
      useNativeDriver: true
    }).start();
  };

  const snapSwipe = (toValue: number) => {
    offsetRef.current = toValue;
    Animated.spring(translateX, {
      damping: 20,
      mass: 0.75,
      stiffness: 170,
      toValue,
      useNativeDriver: true
    }).start();
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) =>
      canSwipe &&
      Math.abs(gestureState.dx) > 4 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.08,
    onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
      canSwipe &&
      Math.abs(gestureState.dx) > 6 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.08,
    onPanResponderGrant: () => {
      translateX.stopAnimation((value) => {
        offsetRef.current = value;
      });
    },
    onPanResponderMove: (_event, gestureState) => {
      const minValue = canSwipeRemove ? -CHAT_ROW_LEFT_ACTION_WIDTH : 0;
      const maxValue = canSwipeReactivate ? CHAT_ROW_LEFT_ACTION_WIDTH : 0;
      const nextValue = Math.max(
        minValue,
        Math.min(maxValue, offsetRef.current + gestureState.dx)
      );

      translateX.setValue(nextValue);
    },
    onPanResponderRelease: (_event, gestureState) => {
      const intendedDelete = canSwipeRemove &&
        (gestureState.dx <= -CHAT_ROW_SWIPE_TRIGGER || gestureState.vx <= -0.18);
      const intendedReactivate = canSwipeReactivate &&
        (gestureState.dx >= CHAT_ROW_SWIPE_TRIGGER || gestureState.vx >= 0.18);

      if (intendedDelete) {
        snapSwipe(-CHAT_ROW_LEFT_ACTION_WIDTH);
        return;
      }

      if (intendedReactivate) {
        snapSwipe(CHAT_ROW_LEFT_ACTION_WIDTH);
        return;
      }

      closeSwipe();
    },
    onPanResponderTerminate: closeSwipe,
    onPanResponderTerminationRequest: () => false,
    onStartShouldSetPanResponder: () => false
  }), [canSwipe, canSwipeReactivate, canSwipeRemove, translateX]);

  useEffect(() => {
    closeSwipe();
  }, [employee.id, employee.statusValue]);

  const runSwipeAction = (action: () => void) => {
    closeSwipe();
    action();
  };

  return (
    <View style={[
      styles.employeeSwipeShell,
      { backgroundColor: appTheme.colors.groupedBackground }
    ]}>
      {canSwipeReactivate ? (
        <View style={styles.employeeSwipeLeftActions}>
          <Pressable
            accessibilityLabel={`Reactivate ${employee.name}`}
            accessibilityRole="button"
            onPress={() => runSwipeAction(onReactivateDeleted)}
            style={({ pressed }) => [
              styles.chatSwipeAction,
              styles.employeeSwipeReactivateAction,
              pressed && styles.pressed
            ]}
          >
            <Feather color="#FFFFFF" name="rotate-ccw" size={21} />
            <Text style={styles.chatSwipeActionText}>Reactivate</Text>
          </Pressable>
        </View>
      ) : null}

      {canSwipeRemove ? (
        <View style={styles.employeeSwipeRightActions}>
          <Pressable
            accessibilityLabel={statusValue === 'INVITED' ? `Remove invite for ${employee.name}` : `Permanently remove ${employee.name}`}
            accessibilityRole="button"
            onPress={() => runSwipeAction(onPermanentlyRemoveDeleted)}
            style={({ pressed }) => [
              styles.chatSwipeAction,
              styles.employeeSwipeRemoveAction,
              pressed && styles.pressed
            ]}
          >
            <Feather color="#FFFFFF" name="trash-2" size={21} />
            <Text style={styles.chatSwipeActionText}>Remove</Text>
          </Pressable>
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.chatSwipeContent,
          { backgroundColor: appTheme.colors.groupedBackground },
          { transform: [{ translateX }] }
        ]}
        {...(canSwipe ? panResponder.panHandlers : {})}
      >
        <Pressable
          accessibilityRole={hasActions ? 'button' : undefined}
          disabled={!hasActions || isUpdatingLifecycle}
          onPress={() => {
            if (offsetRef.current !== 0) {
              closeSwipe();
              return;
            }

            onSelect();
          }}
          style={({ pressed }) => [
            styles.chatRow,
            { backgroundColor: appTheme.colors.groupedBackground },
            pressed && hasActions && !isUpdatingLifecycle && styles.pressed,
            isUpdatingLifecycle && styles.disabled
          ]}
        >
          {employee.isPhoneOnly && !employee.profilePhotoUrl ? (
            <View style={[
              styles.employeePhoneAvatar,
              { backgroundColor: appTheme.colors.primarySoft }
            ]}>
              <Feather color={appTheme.colors.primary} name="phone" size={19} />
            </View>
          ) : (
            <ProfileAvatar
              headers={profilePhotoHeaders}
              name={employee.name}
              size={44}
              uri={employee.profilePhotoUrl}
            />
          )}
          <View style={styles.chatText}>
            <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{employee.name}</Text>
            <Text style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{employee.department}</Text>
          </View>
          <View style={[styles.employeeRowDivider, { backgroundColor: appTheme.colors.separator }]} />
          <View style={styles.employeeMeta}>
            <Text numberOfLines={1} style={[styles.employeeRole, { color: appTheme.colors.muted }]}>{employee.role}</Text>
            <Text numberOfLines={1} style={[styles.employeeStatus, { color: appTheme.colors.primary }]}>{employee.status}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function getEmployeeActionOptions(
  employee: EmployeeListItem,
  viewerUid?: string | null
): EmployeeActionOption[] {
  const status = employee.statusValue.toUpperCase();
  const changeRoleOption: EmployeeActionOption = {
    action: 'CHANGE_ROLE',
    confirmButton: 'Change',
    confirmMessage: (employeeName) =>
      `${employeeName}'s company role and role permissions will be updated.`,
    confirmTitle: 'Change role?',
    label: 'Change role',
    successMessage: (employeeName) => `${employeeName}'s role has been updated.`,
    successTitle: 'Role updated'
  };
  const departmentAdminOption: EmployeeActionOption = employee.baseRole === 'DEPT_ADMIN'
    ? {
        action: 'REMOVE_DEPT_ADMIN',
        confirmButton: 'Remove',
        confirmMessage: (employeeName) =>
          `${employeeName} will remain an employee, but will no longer be marked as a department admin.`,
        confirmTitle: 'Remove department admin?',
        label: 'Remove Dept Admin',
        successMessage: (employeeName) => `${employeeName} is no longer marked as a department admin.`,
        successTitle: 'Department admin removed'
      }
    : {
        action: 'ASSIGN_DEPT_ADMIN',
        confirmButton: 'Assign',
        confirmMessage: (employeeName) =>
          `${employeeName} will be marked as a department admin for their assigned department.`,
        confirmTitle: 'Assign department admin?',
        label: 'Assign Dept Admin',
        successMessage: (employeeName) => `${employeeName} is now marked as a department admin.`,
        successTitle: 'Department admin assigned'
      };
  const deactivateOption: EmployeeActionOption = {
    action: 'DEACTIVATE',
    confirmButton: 'Deactivate',
    confirmMessage: (employeeName) =>
      `${employeeName} will lose access to this organization and all registered devices will be revoked.`,
    confirmTitle: 'Deactivate employee?',
    label: status === 'INVITED' ? 'Cancel invite' : 'Deactivate',
    reason: status === 'INVITED' ? 'Invite cancelled by organization admin' : 'Deactivated by organization admin',
    successMessage: (employeeName) => `${employeeName} no longer has active access.`,
    successTitle: status === 'INVITED' ? 'Invite cancelled' : 'Employee deactivated'
  };
  const archiveOption: EmployeeActionOption = {
    action: 'ARCHIVE',
    confirmButton: 'Archive',
    confirmMessage: (employeeName) =>
      `${employeeName} will be archived and blocked from future organization access.`,
    confirmTitle: 'Archive employee?',
    label: 'Archive',
    reason: 'Archived by organization admin',
    successMessage: (employeeName) => `${employeeName} has been archived.`,
    successTitle: 'Employee archived'
  };
  const reactivateOption: EmployeeActionOption = {
    action: 'REACTIVATE',
    confirmButton: 'Reactivate',
    confirmMessage: (employeeName) =>
      `${employeeName} will regain organization access after phone verification. Devices manually revoked by an admin remain blocked.`,
    confirmTitle: 'Reactivate employee?',
    label: 'Reactivate',
    reason: 'Reactivated by organization admin',
    successMessage: (employeeName) => `${employeeName} can sign in again after phone verification.`,
    successTitle: 'Employee reactivated'
  };
  const deleteOption: EmployeeActionOption = {
    action: 'DELETE',
    confirmButton: 'Delete',
    confirmMessage: (employeeName) =>
      `${employeeName} will be deleted from active employee access. Their devices will be revoked, but the record can still be reactivated or permanently removed later.`,
    confirmTitle: 'Delete employee?',
    label: 'Delete',
    reason: 'Deleted by organization admin',
    successMessage: (employeeName) => `${employeeName} has been deleted from active access.`,
    successTitle: 'Employee deleted'
  };
  const permanentDeleteOption: EmployeeActionOption = {
    action: 'PERMANENT_DELETE',
    confirmButton: 'Remove',
    confirmMessage: (employeeName) =>
      `${employeeName} will be permanently removed from the employee directory. This clears the approval record for this phone number and cannot be undone.`,
    confirmTitle: 'Permanently remove employee?',
    label: 'Permanently remove',
    reason: 'Permanently removed by organization admin',
    successMessage: (employeeName) => `${employeeName} has been permanently removed.`,
    successTitle: 'Employee removed'
  };
  const removeInviteOption: EmployeeActionOption = {
    action: 'REMOVE_INVITE',
    confirmButton: 'Remove',
    confirmMessage: (employeeName) =>
      `${employeeName}'s pending invite will be removed from this organization. This clears the phone number so it can be invited correctly later.`,
    confirmTitle: 'Remove invite?',
    label: 'Remove invite',
    reason: 'Invite removed by organization admin',
    successMessage: (employeeName) => `${employeeName}'s invite has been removed.`,
    successTitle: 'Invite removed'
  };

  /**
   * An organization admin gets one action and no others. Every remaining action
   * in this list is refused by the server for an ORG_ADMIN record, so offering
   * them produced a menu where nothing worked.
   */
  const orgAdminOption = buildOrgAdminRoleOption({
    baseRole: employee.baseRole,
    status,
    targetUid: employee.employeeUid,
    viewerUid
  });

  if (!shouldOfferEmployeeLifecycleActions(employee.baseRole)) {
    return orgAdminOption ? [orgAdminOption] : [];
  }

  if (status === 'ACTIVE') {
    return [
      changeRoleOption,
      departmentAdminOption,
      ...(orgAdminOption ? [orgAdminOption] : []),
      deactivateOption,
      archiveOption,
      deleteOption
    ];
  }

  if (status === 'INVITED') {
    return [
      changeRoleOption,
      departmentAdminOption,
      ...(orgAdminOption ? [orgAdminOption] : []),
      removeInviteOption
    ];
  }

  if (status === 'DEACTIVATED' || status === 'SUSPENDED') {
    return [reactivateOption, archiveOption, deleteOption];
  }

  if (status === 'ARCHIVED') {
    return [reactivateOption, deleteOption];
  }

  if (status === 'DELETED') {
    return [reactivateOption, permanentDeleteOption];
  }

  return [];
}
