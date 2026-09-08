import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import {
  CHAT_ROW_LEFT_ACTION_WIDTH,
  CHAT_ROW_RIGHT_ACTION_WIDTH,
  SPAM_ROW_ACTION_WIDTH,
} from './metrics';

/**
 * The chat list, its rows, filters, archive, spam and search.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const chatStyles = StyleSheet.create({
  spamHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
    position: 'relative'
  },
  spamHeaderTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center'
  },
  spamHeaderDeleteButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 74,
    paddingHorizontal: 14
  },
  spamHeaderDeleteText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20
  },
  archiveHeaderWrap: {
    position: 'relative',
    zIndex: 20
  },
  archiveHeaderIconButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 44
  },
  archiveEditBackdrop: {
    bottom: -800,
    left: -10,
    position: 'absolute',
    right: -10,
    top: 44
  },
  archiveEditMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    minWidth: 214,
    overflow: 'hidden',
    position: 'absolute',
    right: 4,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    top: 44,
    zIndex: 25
  },
  archiveEditMenuRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14
  },
  archiveEditMenuText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20
  },
  chatSearchBox: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderColor: 'transparent',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    marginBottom: 8,
    paddingHorizontal: 14
  },
  chatSearchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    minHeight: 40,
    paddingVertical: 7
  },
  chatsControls: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    gap: 8,
    marginBottom: 2,
    paddingBottom: 8
  },
  spamScreen: {
    gap: 6,
    paddingTop: 2
  },
  archiveScreen: {
    gap: 6,
    paddingTop: 2
  },
  archiveDescription: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 5,
    textAlign: 'center'
  },
  archiveSelectableRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 76,
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  archiveRoundCheck: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20
  },
  archiveRoundCheckSelected: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E'
  },
  archiveSelectionBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 18
  },
  archiveSelectionAction: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12
  },
  archiveSelectionActionText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  archiveSelectionActionTextDestructive: {
    color: '#EF4444'
  },
  spamDescription: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 5,
    textAlign: 'center'
  },
  spamChatRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 76,
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  spamChatText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  spamChatSubtitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minWidth: 0
  },
  spamChatSubtitle: {
    color: '#8B95A5',
    flexShrink: 1,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 17
  },
  spamChatMeta: {
    alignItems: 'flex-end',
    gap: 5,
    justifyContent: 'center',
    minWidth: 62
  },
  spamSwipeShell: {
    backgroundColor: '#FFFFFF',
    minHeight: 76,
    overflow: 'hidden',
    position: 'relative'
  },
  spamSwipeLeftActions: {
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    top: 0,
    width: SPAM_ROW_ACTION_WIDTH
  },
  spamSwipeRightActions: {
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 0,
    top: 0,
    width: SPAM_ROW_ACTION_WIDTH
  },
  spamSwipeAction: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SPAM_ROW_ACTION_WIDTH
  },
  spamSwipePutBackAction: {
    backgroundColor: '#16A34A'
  },
  spamSwipeDeleteAction: {
    backgroundColor: '#DC2626'
  },
  chatFilterScroll: {
    marginHorizontal: -2
  },
  chatFilterContent: {
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    paddingVertical: 1
  },
  chatFilterChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE8',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 10
  },
  chatFilterChipActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#86EFAC'
  },
  chatFilterChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17
  },
  chatFilterChipTextActive: {
    color: '#047857'
  },
  chatFilterAddButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE8',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  chatsUtilityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 36,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  chatsUtilityIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  chatsUtilityText: {
    color: '#64748B',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  forwardSelectionHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -10,
    minHeight: 54,
    paddingHorizontal: 12
  },
  forwardSelectionTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0
  },
  forwardSelectionTitleText: {
    flex: 1,
    minWidth: 0
  },
  forwardSelectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  forwardSelectionSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  forwardSelectionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  forwardSelectionActionButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  forwardSelectionCloseButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  chatPrivacySheet: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    shadowColor: '#0F172A',
    shadowOffset: { height: -8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 22
  },
  chatPrivacyCloseButton: {
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 16,
    width: 44,
    zIndex: 2
  },
  chatPrivacyHero: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 96,
    justifyContent: 'center',
    marginTop: 8,
    position: 'relative',
    width: 116
  },
  chatPrivacyDevice: {
    alignItems: 'center',
    backgroundColor: '#E7F7F4',
    borderColor: 'rgba(15, 118, 110, 0.14)',
    borderRadius: 24,
    borderWidth: 1,
    height: 74,
    justifyContent: 'center',
    width: 92
  },
  chatPrivacyBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 3,
    bottom: 8,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    width: 32
  },
  chatPrivacyTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: 8,
    textAlign: 'center'
  },
  chatPrivacyBody: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: 12,
    textAlign: 'center'
  },
  chatPrivacyPointList: {
    gap: 12,
    marginTop: 22
  },
  chatPrivacyPointRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 32
  },
  chatPrivacyPointIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  chatPrivacyPointText: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20
  },
  chatPrivacyFooter: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 20,
    textAlign: 'center'
  },
  chatSearchHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    left: 12,
    position: 'absolute',
    right: 12,
    top: 10,
    zIndex: 12
  },
  chatSearchClearButton: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20
  },
  chatSearchHeaderCount: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    maxWidth: 42
  },
  chatSearchCloseButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 22,
    elevation: 5,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    width: 44
  },
  chatSearchFooterWrap: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 12
  },
  chatSearchFooter: {
    alignItems: 'center',
    backgroundColor: 'rgba(244, 246, 248, 0.96)',
    borderTopColor: 'rgba(203, 213, 225, 0.7)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 64,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 12,
    paddingTop: 8
  },
  chatSearchNavigationPill: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    flexDirection: 'row',
    height: 44,
    overflow: 'hidden'
  },
  chatSearchNavButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 42
  },
  chatSearchNavDivider: {
    backgroundColor: '#E5E7EB',
    height: 22,
    width: StyleSheet.hairlineWidth
  },
  chatSearchResultText: {
    color: '#64748B',
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    minWidth: 0
  },
  chatSearchFilterButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    height: 40,
    maxWidth: 112,
    paddingHorizontal: 10
  },
  chatSearchFilterButtonActive: {
    backgroundColor: colors.primary
  },
  chatSearchFilterText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    maxWidth: 72
  },
  chatSearchFilterTextActive: {
    color: '#FFFFFF'
  },
  chatSearchDateButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  chatSearchDateButtonActive: {
    backgroundColor: colors.primary
  },
  forwardSelectCircleButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 28
  },
  forwardSelectCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20
  },
  forwardSelectCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  forwardedMessageLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    marginBottom: 3
  },
  forwardedMessageLabel: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 17
  },
  chatRailsModalRoot: {
    flex: 1,
    justifyContent: 'center'
  },
  chatRailsModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  chatRailsModalKeyboard: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 18
  },
  chatRailsSheet: {
    alignSelf: 'center',
    borderRadius: 30,
    borderWidth: 1,
    elevation: 22,
    maxHeight: '84%',
    maxWidth: 356,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: '100%'
  },
  chatRailsSheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#CBD5E1',
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 52
  },
  chatRailsHeader: {
    alignItems: 'flex-start',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  chatRailsTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  chatRailsEyebrow: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2.4,
    lineHeight: 12
  },
  chatRailsTitle: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 25,
    marginTop: 3
  },
  chatRailsSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 2
  },
  chatRailsCloseButton: {
    alignItems: 'center',
    borderRadius: 19,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  chatRailsPreview: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  chatRailsPreviewLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.4,
    lineHeight: 13,
    marginBottom: 7
  },
  chatRailsPreviewText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21
  },
  chatRailsDialogContent: {
    paddingHorizontal: 16,
    paddingTop: 14
  },
  chatRailsFieldGroup: {
    gap: 6,
    marginBottom: 11
  },
  chatRailsFieldLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2,
    lineHeight: 12
  },
  chatRailsPickerRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12
  },
  chatRailsPickerTextBlock: {
    flex: 1,
    minWidth: 0
  },
  chatRailsPickerValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19
  },
  chatRailsPickerHint: {
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 15,
    marginTop: 2
  },
  chatRailsDropdown: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden'
  },
  chatRailsDropdownRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: 12
  },
  chatRailsDropdownText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19
  },
  chatRailsTwoColumnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  chatRailsColumn: {
    flex: 1,
    gap: 8,
    minWidth: 0
  },
  chatRailsReadOnlyField: {
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12
  },
  chatRailsReadOnlyText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19
  },
  chatRailsDatePickerPanel: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden'
  },
  chatRailsDatePickerDone: {
    alignItems: 'center',
    borderTopColor: '#E2E8F0',
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center'
  },
  chatRailsDatePickerDoneText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  chatRailsFooter: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  chatRailsPrimaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center'
  },
  chatRailsPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  chatLswModalRoot: {
    flex: 1,
    justifyContent: 'center'
  },
  chatLswModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  chatLswModalKeyboard: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 18
  },
  chatLswDialog: {
    alignSelf: 'center',
    borderRadius: 30,
    borderWidth: 1,
    elevation: 22,
    maxHeight: '84%',
    maxWidth: 356,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: '100%'
  },
  chatLswHeader: {
    alignItems: 'flex-start',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  chatLswHeaderText: {
    flex: 1,
    minWidth: 0
  },
  chatLswEyebrow: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2.4,
    lineHeight: 12
  },
  chatLswTitle: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 25,
    marginTop: 3
  },
  chatLswCloseButton: {
    alignItems: 'center',
    borderRadius: 19,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  chatLswDialogContent: {
    paddingHorizontal: 16,
    paddingTop: 14
  },
  chatActionEditablePreview: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 13,
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  chatActionEditableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7
  },
  chatActionEditableLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2,
    lineHeight: 12
  },
  chatActionEditableEditButton: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  chatActionEditableText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20
  },
  chatActionEditableInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  chatLswTwoColumnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 13
  },
  chatLswFieldGroup: {
    gap: 6,
    marginBottom: 11
  },
  chatLswFieldLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2,
    lineHeight: 12
  },
  chatLswDateControl: {
    flex: 1,
    gap: 6,
    minWidth: 0
  },
  chatLswPickerButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 13
  },
  chatLswPickerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18
  },
  chatLswNativeDateWrap: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    overflow: 'hidden',
    paddingHorizontal: 4
  },
  chatLswTextInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  chatLswTextArea: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingTop: 10
  },
  chatLswFooter: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  chatLswSecondaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46
  },
  chatLswSecondaryText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20
  },
  chatLswPrimaryButton: {
    alignItems: 'center',
    borderRadius: 17,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48
  },
  chatLswPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  chatSearchModalRoot: {
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    flex: 1,
    justifyContent: 'flex-end'
  },
  chatSearchModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  chatSearchModalSheet: {
    backgroundColor: '#F4F6F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '76%',
    minHeight: Platform.OS === 'android' ? 260 : 360,
    paddingBottom: 16,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { height: -6, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  },
  chatSearchModalHandle: {
    alignSelf: 'center',
    backgroundColor: '#A8B0BC',
    borderRadius: 2,
    height: 4,
    marginTop: 8,
    width: 42
  },
  chatSearchModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54
  },
  chatSearchModalTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center'
  },
  chatSearchModalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 40
  },
  chatSearchNativeDatePickerWrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 216,
    justifyContent: 'center',
    marginTop: 2,
    overflow: 'hidden'
  },
  chatSearchNativeDatePicker: {
    alignSelf: 'stretch',
    height: 216
  },
  chatSearchAndroidDateButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    minHeight: 62,
    paddingHorizontal: 14
  },
  chatSearchAndroidDateButtonIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  chatSearchAndroidDateButtonText: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23
  },
  chatSearchJumpDateButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 22,
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 16,
    maxWidth: 280,
    width: '84%'
  },
  chatSearchJumpDateText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  chatSearchPersonRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chatSearchPersonAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  chatSearchPersonName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  chatSearchPersonRole: {
    color: '#8B95A5',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  forwardRecipientOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    flex: 1,
    justifyContent: 'flex-start'
  },
  forwardRecipientBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  forwardRecipientSheet: {
    backgroundColor: '#F8FAFC',
    flex: 1,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  },
  forwardRecipientHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 0,
    paddingTop: 8
  },
  forwardRecipientTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center'
  },
  forwardRecipientCloseButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  forwardRecipientHeaderSpacer: {
    height: 44,
    width: 44
  },
  forwardRecipientSearchWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 46,
    paddingHorizontal: 13
  },
  forwardRecipientSearchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    paddingVertical: 8
  },
  forwardRecipientList: {
    flex: 1,
    marginTop: 14
  },
  forwardRecipientSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 15,
    overflow: 'hidden'
  },
  forwardRecipientSectionTitle: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4
  },
  forwardRecipientEmptyText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 18
  },
  forwardRecipientRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  forwardRecipientRowDisabled: {
    opacity: 0.56
  },
  forwardRecipientText: {
    flex: 1,
    minWidth: 0
  },
  forwardRecipientName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  forwardRecipientSubtitle: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  forwardRecipientCheck: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 13,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    width: 26
  },
  forwardRecipientCheckSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  forwardRecipientFooter: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderTopColor: '#E5E7EB',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginHorizontal: -14,
    paddingHorizontal: 18,
    paddingBottom: 0,
    paddingTop: 10
  },
  forwardRecipientCount: {
    color: '#64748B',
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  forwardRecipientSendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 118,
    paddingHorizontal: 16
  },
  forwardRecipientSendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  chatRow: {
    alignItems: 'center',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingVertical: 7
  },
  chatRowDivider: {
    bottom: 0,
    height: 1,
    left: 68,
    position: 'absolute',
    right: 0
  },
  chatSwipeShell: {
    backgroundColor: '#F2F2F6',
    minHeight: 72,
    overflow: 'hidden',
    position: 'relative'
  },
  chatSwipeContent: {
    backgroundColor: '#F2F2F6'
  },
  chatSwipeLeftActions: {
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    top: 0,
    width: CHAT_ROW_LEFT_ACTION_WIDTH
  },
  chatSwipeRightActions: {
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 0,
    top: 0,
    width: CHAT_ROW_RIGHT_ACTION_WIDTH
  },
  chatSwipeAction: {
    alignItems: 'center',
    justifyContent: 'center',
    width: CHAT_ROW_RIGHT_ACTION_WIDTH / 2
  },
  chatSwipeFavoriteAction: {
    backgroundColor: '#16A34A',
    width: CHAT_ROW_LEFT_ACTION_WIDTH / 2
  },
  chatSwipePinAction: {
    backgroundColor: '#737373',
    width: CHAT_ROW_LEFT_ACTION_WIDTH / 2
  },
  chatSwipeMoreAction: {
    backgroundColor: '#737373'
  },
  chatSwipeArchiveAction: {
    backgroundColor: colors.primary
  },
  chatSwipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 4
  },
  chatAvatar: {
    borderRadius: 24,
    height: 48,
    width: 48
  },
  chatText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  chatTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  chatTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minWidth: 0
  },
  chatListTitle: {
    flexShrink: 1,
    color: '#0B141A',
    fontWeight: '600'
  },
  chatPreview: {
    color: '#8B95A5',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap: 5,
    justifyContent: 'center',
    minWidth: 58
  },
  chatTime: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17,
    textAlign: 'right'
  },
  chatMoreRoot: {
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    flex: 1,
    justifyContent: 'flex-end'
  },
  chatMoreBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  chatMoreSheet: {
    backgroundColor: '#F4F6F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '56%',
    minHeight: 320,
    paddingBottom: 18,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { height: -6, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  },
  chatMoreHandle: {
    alignSelf: 'center',
    backgroundColor: '#A8B0BC',
    borderRadius: 2,
    height: 4,
    marginTop: 8,
    width: 42
  },
  chatMoreHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 4
  },
  chatMoreTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center'
  },
  chatMoreCloseButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 40
  },
  chatMoreActionGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden'
  },
  chatMoreActionRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14
  },
  chatMoreActionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  chatMoreActionIconDestructive: {
    backgroundColor: '#FEE2E2'
  },
  chatMoreActionText: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21
  },
  chatMoreActionTextDestructive: {
    color: '#DC2626'
  },
  archiveSettingsScreen: {
    backgroundColor: '#F4F6F8',
    flex: 1
  },
  archiveSettingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 14
  },
  archiveSettingsTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center'
  },
  archiveSettingsSaveButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 66,
    paddingHorizontal: 14
  },
  archiveSettingsSaveText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20
  },
  archiveSettingsContent: {
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 14,
    paddingTop: 10
  },
  archiveSettingsSection: {
    gap: 8
  },
  archiveSettingsSectionTitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    paddingHorizontal: 4
  },
  archiveSettingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden'
  },
  archiveSettingsRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14
  },
  archiveSettingsRowText: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20
  },
  archiveSettingsRadio: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20
  },
  archiveSettingsRadioSelected: {
    borderColor: '#22C55E'
  },
  archiveSettingsRadioDot: {
    backgroundColor: '#22C55E',
    borderRadius: 5,
    height: 10,
    width: 10
  },
  archiveSettingsCheckbox: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20
  },
  archiveSettingsCheckboxSelected: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E'
  },
  spamStatusSheet: {
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 28,
    shadowColor: '#0F172A',
    shadowOffset: { height: -6, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  },
  spamStatusCloseButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 14,
    width: 44
  },
  spamStatusAvatarWrap: {
    marginBottom: 14,
    marginTop: 8,
    position: 'relative'
  },
  spamStatusBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F4F6F8',
    borderRadius: 16,
    borderWidth: 2,
    bottom: -2,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: -8,
    width: 32
  },
  spamStatusTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    marginBottom: 18,
    maxWidth: 300,
    textAlign: 'center'
  },
  spamStatusInfoList: {
    gap: 14,
    marginBottom: 22,
    width: '100%'
  },
  spamStatusInfoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 8
  },
  spamStatusInfoText: {
    color: '#334155',
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  spamStatusOkButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 22,
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 10
  },
  spamStatusOkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20
  },
  spamStatusDeleteButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 42
  },
  spamStatusDeleteText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20
  },
  newChatModalScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 22 : 18
  },
  newChatHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    marginBottom: 8
  },
  newChatHeaderIconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  newChatHeaderTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center'
  },
  newChatHeaderSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center'
  },
  newChatCenteredTitleWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  newChatHeaderSpacer: {
    width: 40
  },
  newChatNextButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 14
  },
  newChatNextText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  newGroupEntry: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingVertical: 8
  },
  newGroupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  newGroupText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  newChatContactList: {
    flex: 1
  },
  newChatContactRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingVertical: 8
  },
  searchIcon: {
    height: 21,
    position: 'relative',
    width: 21
  },
  searchLens: {
    borderColor: colors.ink,
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    left: 1,
    position: 'absolute',
    top: 1,
    width: 14
  },
  searchHandle: {
    backgroundColor: colors.ink,
    borderRadius: 1,
    height: 8,
    position: 'absolute',
    right: 2,
    top: 14,
    transform: [{ rotate: '-45deg' }],
    width: 2
  },
});
