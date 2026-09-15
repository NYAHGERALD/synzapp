import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import {
  CHAT_ROW_LEFT_ACTION_WIDTH,
} from './metrics';

/**
 * Employees, contacts and invitations.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const directoryStyles = StyleSheet.create({
  employeeRowDivider: {
    bottom: 0,
    height: 1,
    left: 56,
    position: 'absolute',
    right: 0
  },
  directoryHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16
  },
  directoryTitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 6,
    marginLeft: 15
  },
  contactChatRow: {
    minHeight: 72,
    paddingVertical: 8
  },
  employeeAvatar: {
    backgroundColor: '#3F67EA'
  },
  employeePhoneAvatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  employeeSwipeShell: {
    backgroundColor: '#FFFFFF',
    minHeight: 58,
    overflow: 'hidden',
    position: 'relative'
  },
  employeeSwipeLeftActions: {
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    top: 0,
    width: CHAT_ROW_LEFT_ACTION_WIDTH
  },
  employeeSwipeRightActions: {
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 0,
    top: 0,
    width: CHAT_ROW_LEFT_ACTION_WIDTH
  },
  employeeSwipeReactivateAction: {
    backgroundColor: '#16A34A',
    width: CHAT_ROW_LEFT_ACTION_WIDTH
  },
  employeeSwipeRemoveAction: {
    backgroundColor: '#DC2626',
    width: CHAT_ROW_LEFT_ACTION_WIDTH
  },
  employeeRole: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    textAlign: 'right'
  },
  employeeMeta: {
    alignItems: 'flex-end',
    gap: 1,
    justifyContent: 'center',
    maxWidth: 96
  },
  employeeStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'right'
  },
  inviteDraft: {
    borderColor: '#E5E7EB',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginBottom: 12,
    padding: 12
  },
  inviteDraftHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 42
  },
  inviteDraftContactRow: {
    alignItems: 'center',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  inviteDraftAdminRow: {
    alignItems: 'center',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  inviteDraftAvatar: {
    alignItems: 'center',
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    height: 46,
    justifyContent: 'center',
    width: 46
  },
  inviteDraftAvatarText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20
  },
  inviteDraftActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 0
  },
  contactInfoTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 16
  },
  contactInfoHeaderTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    paddingHorizontal: 10,
    textAlign: 'center'
  },
  contactInfoHero: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10
  },
  contactInfoName: {
    color: '#0B141A',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    marginTop: 12,
    maxWidth: 320,
    textAlign: 'center'
  },
  contactInfoMeta: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 2,
    textAlign: 'center'
  },
  contactInfoPresence: {
    color: '#8B95A5',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 1,
    textAlign: 'center'
  },
  contactInfoActionGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  contactInfoCommonHeader: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  contactInfoCommonGroupRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  contactInfoCommonGroupSubtitle: {
    color: '#8B95A5',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
});
