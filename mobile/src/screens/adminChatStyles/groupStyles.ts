import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

/**
 * Groups, membership and permissions.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const groupStyles = StyleSheet.create({
  groupMessageAvatarFallback: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  groupMessageAvatarImage: {
    alignSelf: 'flex-end',
    backgroundColor: '#D7DEE8',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    width: 28
  },
  groupMessageAvatarLeft: {
    marginRight: 6
  },
  groupMessageAvatarRight: {
    marginLeft: 6
  },
  groupMessageAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13
  },
  groupCallOptionsRoot: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 56 : 78
  },
  groupCallOptionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.16)'
  },
  groupCallOptionsPanel: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    elevation: 18,
    minWidth: 238,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20
  },
  groupCallOptionsHeader: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  groupCallOptionsTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    maxWidth: 220
  },
  groupCallOptionsSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 1
  },
  groupCallOptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  groupCallOptionText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupSwitcherSectionTitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 4,
    marginTop: 10
  },
  groupSwitcherList: {
    flex: 1
  },
  groupSwitcherRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 64,
    paddingVertical: 8
  },
  groupSwitcherRowActive: {
    backgroundColor: '#F0FDFA'
  },
  groupSwitcherAddButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    marginBottom: Platform.OS === 'android' ? 18 : 10,
    marginTop: 12
  },
  groupSwitcherAddText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupInfoScreen: {
    backgroundColor: '#F4F6F8',
    flex: 1
  },
  groupInfoTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 16
  },
  groupInfoTopButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  groupInfoTopButtonSpacer: {
    height: 40,
    width: 40
  },
  groupInfoEditButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 56,
    paddingHorizontal: 12
  },
  groupInfoEditText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  groupInfoContent: {
    gap: 12,
    paddingBottom: 28,
    paddingHorizontal: 12,
    paddingTop: 2
  },
  groupInfoHero: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 2
  },
  groupInfoAvatarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 104,
    minWidth: 104
  },
  groupInfoAvatarBadge: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 2,
    bottom: 6,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 34
  },
  groupInfoTitle: {
    color: '#0B141A',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    marginTop: 12,
    maxWidth: 320,
    textAlign: 'center'
  },
  groupInfoCompany: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center'
  },
  groupInfoMemberCount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
    textAlign: 'center'
  },
  groupInfoDescription: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 320,
    textAlign: 'center'
  },
  groupInfoActionGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  groupInfoActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 72,
    minWidth: 0,
    paddingHorizontal: 4
  },
  groupInfoActionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center'
  },
  groupInfoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden'
  },
  groupInfoSettingRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  groupInfoSettingIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  groupInfoSettingLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupInfoSettingValue: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  groupInfoMembersHeader: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 14
  },
  groupInfoMembersTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22
  },
  groupInfoMemberSearchButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  groupInfoMemberRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  groupInfoMemberName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupInfoMemberSubtitle: {
    color: '#8B95A5',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  groupInfoMemberBadge: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    maxWidth: 58,
    textAlign: 'right'
  },
  groupInfoExitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  groupInfoExitText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupNameRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(15, 118, 110, 0.28)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 70,
    marginTop: 8,
    paddingBottom: 8
  },
  groupPhotoButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52
  },
  groupPhotoImage: {
    height: '100%',
    width: '100%'
  },
  groupNameInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    minHeight: 48,
    paddingVertical: 8
  },
  groupPermissionRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: 10
  },
  groupPermissionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupPermissionSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    maxWidth: 275
  },
  groupPermissionOption: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingVertical: 10
  },
  groupMembersTitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 16
  },
  groupMembersContent: {
    gap: 12,
    paddingTop: 12,
    paddingBottom: 16
  },
  groupMemberChip: {
    alignItems: 'center',
    width: 72
  },
  groupMemberAvatarWrap: {
    position: 'relative'
  },
  groupMemberRemoveButton: {
    alignItems: 'center',
    backgroundColor: '#64748B',
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 20
  },
  groupMemberName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 6,
    textAlign: 'center'
  },
  groupList: {
    paddingTop: 4
  },
  groupRow: {
    alignItems: 'center',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 15,
    paddingVertical: 9
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  groupMeta: {
    color: '#8B95A5',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    maxWidth: 78,
    textAlign: 'right'
  },
  groupScopeLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 8
  },
});
