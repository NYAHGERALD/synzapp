import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

/**
 * The icon's box in the footer, and so the diameter of the selection circle.
 *
 * One number: the circle is drawn to fill this slot, so it cannot drift out of
 * step with the icon it is meant to fit around.
 */
const FOOTER_ICON_SLOT = 38;

/**
 * The bar's own side padding, shared with the moving highlight so both are
 * placed against one number rather than two that have to be kept in step.
 */
export const FOOTER_BAR_HORIZONTAL_PADDING = 7;

/**
 * Shared surfaces, layout scaffolding and anything used across more than one area.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const coreStyles = StyleSheet.create({
  screen: {
    // Overridden inline with the theme's grouped background. Kept here only
    // so the shape of the style is obvious; never white in practice.
    backgroundColor: '#F2F2F6',
    flex: 1,
    overflow: 'hidden',
    paddingBottom: 98,
    paddingTop: 8,
    position: 'relative'
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 15,
    // The round back button needs room, and the title below it needs air.
    marginBottom: 10,
    minHeight: 44,
    position: 'relative',
    zIndex: 70
  },
  topActionsLeftSpacer: {
    height: 44,
    width: 44
  },
  headerCenterTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '400',
    left: 62,
    letterSpacing: 0,
    lineHeight: 23,
    position: 'absolute',
    right: 62,
    textAlign: 'center'
  },
  mainNavigationButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginLeft: -3,
    width: 48
  },
  // The back icon gets the round button's shape and shadow, the same as the
  // options icon opposite it, so the two ends of the header match.
  mainNavigationButtonCircle: {
    backgroundColor: colors.groupedCard,
    borderRadius: 24,
    elevation: 4,
    marginLeft: 0,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 6
  },
  mainNavigationScreen: {
    flex: 1,
    paddingHorizontal: 16
  },
  mainNavigationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54
  },
  mainNavigationHeaderButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  mainNavigationHeaderSpacer: {
    height: 44,
    width: 44
  },
  mainNavigationTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 25,
    paddingHorizontal: 12,
    textAlign: 'center'
  },
  mainNavigationContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 0,
    paddingTop: 0
  },
  mainNavigationLink: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 4,
    paddingVertical: 10
  },
  mainNavigationLinkText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 22
  },
  rightActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18
  },
  rightActionsCompact: {
    gap: 0
  },
  topMenuButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  // The round icon button's shape and shadow, on the options icon. It is one of
  // the few things allowed a shadow, because it has to be findable above
  // whatever list it is sitting over. Same values as CircleIconButton, so the
  // two read as the same control.
  topMenuButtonCircle: {
    backgroundColor: colors.groupedCard,
    borderRadius: 22,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 6
  },
  iconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  youHeaderButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 3,
    height: 40,
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: 40
  },
  youContent: {
    paddingBottom: 32,
    paddingTop: 2
  },
  youLoading: {
    alignItems: 'center',
    minHeight: 240,
    justifyContent: 'center'
  },
  youHero: {
    alignItems: 'center',
    minHeight: 190,
    justifyContent: 'center',
    paddingBottom: 20,
    paddingTop: 12
  },
  youAvatarButton: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  youAvatarAddBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    bottom: 4,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 24
  },
  youAvatarAddText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 21
  },
  youName: {
    color: '#111827',
    fontSize: 25,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 32,
    marginTop: 14,
    maxWidth: '88%',
    textAlign: 'center'
  },
  youPhotoAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14
  },
  youPhotoActionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  youDetails: {
    paddingTop: 8
  },
  youSessionSection: {
    paddingTop: 18
  },
  youSessionLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1.1,
    lineHeight: 16,
    marginBottom: 2,
    textTransform: 'uppercase'
  },
  youSignOutRow: {
    alignItems: 'center',
    borderTopWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  youSignOutIcon: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  youSignOutCopy: {
    flex: 1,
    gap: 2
  },
  youSignOutTitle: {
    color: '#B91C1C',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  youSignOutText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  profileDetailRow: {
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  profileDetailLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    width: 120
  },
  profileDetailValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  backButton: {
    alignItems: 'flex-start',
    height: 34,
    justifyContent: 'center',
    width: 44
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 35
  },
  filterButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 44
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    marginHorizontal: 15,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 33,
    marginBottom: 14
  },
  noticeWrap: {
    marginBottom: 8,
    marginHorizontal: 15
  },
  /**
   * Where chat being on another phone is stated and undone.
   *
   * A rounded card, so white is allowed here. It sits in `noticeWrap`, which
   * already holds the 15 from the edge, so it adds none of its own.
   */
  mobileSeatNotice: {
    alignItems: 'center',
    backgroundColor: colors.groupedCard,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  mobileSeatNoticeText: {
    flex: 1,
    gap: 3
  },
  mobileSeatNoticeTitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  mobileSeatNoticeBody: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  mobileSeatNoticeAction: {
    fontSize: 15,
    fontWeight: '400'
  },
  tabScroll: {
    flex: 1,
    marginTop: 4
  },
  tabContent: {
    paddingBottom: 92,
    paddingHorizontal: 10
  },
  // Settings draws cards that already sit 15 from the edge.
  groupedTabContent: {
    paddingHorizontal: 0
  },
  fixedTabSurface: {
    flex: 1,
    marginTop: 4,
    minHeight: 0,
    paddingHorizontal: 10
  },
  fixedListTab: {
    flex: 1,
    minHeight: 0
  },
  fixedList: {
    flex: 1,
    minHeight: 0
  },
  // Room for the floating tab bar, which these lists scroll underneath. It
  // used to come from the page's own padding, but that also pushed the tab bar
  // up off the bottom of the screen.
  fixedListContent: {
    paddingBottom: 160
  },
  fixedListEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  olderMessageLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    paddingVertical: 6
  },
  emptyChatSecurityWrap: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6
  },
  // No card. It is a note about the conversation, not a thing in it, so it sits
  // on the chat's own background with nothing drawn around it.
  emptyChatSecurityCard: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    maxWidth: 330,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  emptyChatSecurityIcon: {
    alignItems: 'center',
    height: 17,
    justifyContent: 'center',
    marginTop: 1,
    width: 16
  },
  emptyChatSecurityText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center'
  },
  // On a line of its own, below. Trailing a link off the end of a paragraph
  // leaves it wherever the last line happens to break — which is how it ended
  // up as two orphaned words in the middle of nothing.
  emptyChatSecurityLink: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 2,
    textAlign: 'center'
  },
  threadSearchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    elevation: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 13,
    shadowColor: '#0F172A',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10
  },
  threadSearchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    minHeight: 38,
    paddingHorizontal: 0,
    paddingVertical: 8
  },
  scrollToLatestButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    elevation: 5,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    shadowColor: '#0F172A',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    width: 42,
    zIndex: 8
  },
  scrollToLatestBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 22,
    minWidth: 22,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -4,
    top: -8
  },
  scrollToLatestBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  bubbleReplyPreview: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    flexDirection: 'row',
    marginBottom: 5,
    minHeight: 44,
    minWidth: 132,
    overflow: 'hidden'
  },
  bubbleReplyPreviewMine: {
    backgroundColor: 'rgba(173, 238, 164, 0.72)'
  },
  bubbleReplyPreviewTheirs: {
    backgroundColor: '#F1F5F9'
  },
  bubbleReplyAccent: {
    width: 4
  },
  bubbleReplyAccentMine: {
    backgroundColor: '#F43F5E'
  },
  bubbleReplyAccentTheirs: {
    backgroundColor: colors.primary
  },
  bubbleReplyTextWrap: {
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  bubbleReplyAuthor: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  bubbleReplyText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  replyAuthorMine: {
    color: '#C026D3'
  },
  replyAuthorTheirs: {
    color: colors.primary
  },
  composerReplyPreview: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flexDirection: 'row',
    minHeight: 48,
    paddingLeft: 10,
    paddingRight: 5,
    paddingVertical: 7
  },
  composerReplyAccent: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: 9,
    width: 4
  },
  composerReplyTextWrap: {
    flex: 1,
    minWidth: 0
  },
  composerReplyAuthor: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  composerReplyText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  composerReplyCloseButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    marginLeft: 5,
    width: 34
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 23
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 16,
    minWidth: 21,
    paddingHorizontal: 5
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14
  },
  clearChatSheet: {
    backgroundColor: '#F4F6F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 22,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { height: -6, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  },
  clearChatDescription: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 12,
    marginHorizontal: 10,
    marginTop: -4,
    textAlign: 'center'
  },
  clearChatActionRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14
  },
  clearChatActionRowDisabled: {
    opacity: 0.48
  },
  clearChatActionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  clearChatActionIconDestructive: {
    backgroundColor: '#FEE2E2'
  },
  clearChatActionText: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21
  },
  clearChatActionTextDestructive: {
    color: '#DC2626'
  },
  clearChatActionSize: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: 96,
    textAlign: 'right'
  },
  themeSheet: {
    backgroundColor: '#F4F6F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { height: -6, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  },
  themeSheetDescription: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 12,
    marginHorizontal: 8,
    marginTop: -4,
    textAlign: 'center'
  },
  themeOptionRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  themeOptionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  themeOptionIconSelected: {
    backgroundColor: colors.primary
  },
  themeOptionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21
  },
  themeOptionDescription: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  textOnlyButton: {
    alignItems: 'center',
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  textOnlyButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  secondaryActionButton: {
    alignItems: 'center',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10
  },
  secondaryActionButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  primaryActionButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10
  },
  singleInviteActionButton: {
    flex: 0,
    minWidth: 132
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  batchModalScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 18
  },
  manualInviteOverlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28
  },
  manualInviteDialog: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    width: '100%'
  },
  manualInviteTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 4
  },
  batchModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38
  },
  batchModalTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 32,
    marginTop: 4
  },
  batchSelectedCount: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 8
  },
  manualInviteHelp: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 16
  },
  manualInviteInputBox: {
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 48,
    paddingHorizontal: 16
  },
  manualInviteInput: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '500',
    minHeight: 48,
    paddingHorizontal: 0
  },
  manualInviteActionRow: {
    flexDirection: 'row',
    gap: 10
  },
  manualInviteActionButton: {
    alignItems: 'center',
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14
  },
  manualInviteSecondaryText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19
  },
  manualInvitePrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19
  },
  batchDoneButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 16
  },
  batchDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  batchSearchBox: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderRadius: 23,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 6,
    minHeight: 46,
    paddingHorizontal: 14
  },
  batchSearchInput: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    minHeight: 46,
    paddingHorizontal: 0
  },
  batchLoading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  batchList: {
    flex: 1
  },
  batchListContent: {
    paddingBottom: 24
  },
  batchContactRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingVertical: 8
  },
  batchContactSelector: {
    alignItems: 'center',
    borderColor: '#A7B3C3',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22
  },
  batchContactSelectorActive: {
    borderColor: colors.primary
  },
  batchContactSelectorInner: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    height: 12,
    width: 12
  },
  addMembersSelectedPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    minHeight: 96,
    marginBottom: 12,
    paddingVertical: 10
  },
  addMembersSelectedContent: {
    gap: 14,
    paddingHorizontal: 8
  },
  addMembersSelectedChip: {
    alignItems: 'center',
    width: 66
  },
  addMembersSelectedName: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'center'
  },
  addMembersSectionTitle: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    paddingBottom: 4,
    paddingTop: 4
  },
  addToGroupAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  addToGroupAvatarDepartment: {
    backgroundColor: '#DBEAFE'
  },
  memberSelectCheck: {
    alignItems: 'center',
    borderColor: '#A7B3C3',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24
  },
  memberSelectCheckActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  notificationSettingsScreen: {
    backgroundColor: '#F4F6F8',
    flex: 1
  },
  notificationSettingsTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16
  },
  notificationSettingsHeaderText: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10
  },
  notificationSettingsTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center'
  },
  notificationSettingsSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 1,
    textAlign: 'center'
  },
  notificationSettingsContent: {
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  notificationSettingsSectionLabel: {
    color: '#64748B',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
    paddingHorizontal: 10
  },
  notificationSettingsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden'
  },
  notificationSettingsRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  notificationSettingsRowLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    minWidth: 0
  },
  notificationSettingsRowValueWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginLeft: 12,
    maxWidth: '52%'
  },
  notificationSettingsRowValue: {
    color: '#8B95A5',
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21,
    textAlign: 'right'
  },
  notificationSettingsLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 48,
    paddingTop: 16
  },
  notificationSettingsLoadingText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  transcriptLanguageScreen: {
    backgroundColor: '#F4F6F8',
    flex: 1
  },
  transcriptLanguageTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16
  },
  transcriptLanguageTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    paddingHorizontal: 10,
    textAlign: 'center'
  },
  transcriptLanguageSearchWrap: {
    paddingHorizontal: 14,
    paddingTop: 6
  },
  transcriptLanguageContent: {
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 18
  },
  transcriptLanguageNote: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  transcriptLanguageNoteText: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18
  },
  transcriptLanguageSectionWrap: {
    marginBottom: 18
  },
  transcriptLanguageSectionTitle: {
    color: '#64748B',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
    paddingHorizontal: 14
  },
  transcriptLanguageSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden'
  },
  transcriptLanguageRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  transcriptLanguageRowText: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21,
    minWidth: 0
  },
  transcriptLanguageEmpty: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    paddingVertical: 18,
    textAlign: 'center'
  },
  directContactDetailsScreen: {
    backgroundColor: '#F4F6F8',
    flex: 1
  },
  directContactDetailsTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 52,
    paddingHorizontal: 16
  },
  directContactDetailsContent: {
    paddingBottom: 32,
    paddingHorizontal: 14,
    paddingTop: 12
  },
  directContactDetailsHero: {
    alignItems: 'center',
    minHeight: 194,
    justifyContent: 'center',
    paddingBottom: 20
  },
  directContactDetailsName: {
    color: '#0B141A',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    marginTop: 14,
    maxWidth: 320,
    textAlign: 'center'
  },
  directContactDetailsRole: {
    color: '#8B95A5',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    marginTop: 2,
    textAlign: 'center'
  },
  directContactPhoneCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  directContactPhoneText: {
    flex: 1,
    minWidth: 0
  },
  directContactPhoneLabel: {
    color: '#8B95A5',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16
  },
  directContactPhoneNumber: {
    color: '#22C55E',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22
  },
  directContactPhoneActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  directContactActionButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  directContactDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 14
  },
  directContactAddGroupRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 52,
    paddingHorizontal: 16
  },
  directContactAddGroupText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21
  },
  batchEmpty: {
    color: '#8B95A5',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    paddingVertical: 18
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220
  },
  emptyTitle: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  organizationDeletionOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  organizationDeletionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    gap: 13,
    maxWidth: 420,
    padding: 22,
    position: 'relative',
    width: '100%'
  },
  organizationDeletionClose: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 14,
    width: 36,
    zIndex: 2
  },
  organizationDeletionIcon: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  organizationDeletionVerifiedIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  organizationDeletionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    paddingRight: 40
  },
  organizationDeletionBody: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20
  },
  organizationDeletionHint: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18
  },
  organizationDeletionError: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  organizationDeletionActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end'
  },
  organizationDeletionSecondaryButton: {
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 108,
    paddingHorizontal: 16
  },
  organizationDeletionSecondaryText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19
  },
  organizationDeletionDangerButton: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 132,
    paddingHorizontal: 18
  },
  organizationDeletionDangerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19
  },
  organizationDeletionProgressTrack: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
    width: '100%'
  },
  organizationDeletionProgressFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: '100%'
  },
  permissionSettingsList: {
    paddingTop: 4
  },
  permissionEmployeeSection: {
    borderBottomColor: '#D7DEE8',
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingTop: 4
  },
  permissionEmployeeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 60,
    paddingVertical: 8
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 58,
    paddingVertical: 7
  },
  permissionCheck: {
    alignItems: 'center',
    borderColor: '#A7B3C3',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20
  },
  permissionCheckActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  permissionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  permissionDescription: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  securityList: {
    gap: 22,
    paddingBottom: 32,
    paddingTop: 2
  },
  policyControlRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  policyControlText: {
    flex: 1,
    minWidth: 0
  },
  policyControlTitle: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  policyControlSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 3
  },
  policyValueAccessory: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  policyValuePill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 74,
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  policyValueText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center'
  },
  // A quiet label above a card, the size the platform uses, not a heading.
  securitySectionTitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: -15,
    marginLeft: 15
  },
  deviceRow: {
    alignItems: 'center',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 74,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  deviceIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  deviceStatusActive: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  deviceStatusRevoked: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  revokeDeviceButton: {
    alignItems: 'center',
    borderColor: '#FCA5A5',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  revokeDeviceText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  chevronText: {
    color: '#8B95A5',
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 30
  },
  loadingRow: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center'
  },
  recordList: {
    marginTop: 4
  },
  listRowDivider: {
    height: 1,
    marginLeft: 67,
    marginRight: 15
  },
  recordRow: {
    alignItems: 'center',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 15,
    paddingVertical: 9
  },
  recordInitial: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  recordInitialText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  profileAvatarShell: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  profileAvatarImage: {
    backgroundColor: '#E5E7EB'
  },
  profileAvatarFallback: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  profileAvatarInitials: {
    color: colors.primary,
    fontWeight: '400',
    textAlign: 'center'
  },
  emptySmall: {
    color: '#8B95A5',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    paddingVertical: 8
  },
  // One action in a header, as text. The round icon buttons carry navigation;
  // this carries the thing the screen is for.
  headerLinkAction: {
    fontSize: 16
  },

  askFloatingButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: '#FFFFFF',
    borderRadius: 31,
    borderWidth: 2,
    elevation: 12,
    height: 62,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    shadowColor: '#0F172A',
    shadowOffset: { height: 9, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: 62
  },
  askFloatingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20
  },
  recoveryKeyInput: {
    borderBottomColor: 'rgba(15, 118, 110, 0.28)',
    borderBottomWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    minHeight: 120,
    paddingHorizontal: 2,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  nativeOptionModalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  nativeOptionModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.36)'
  },
  nativeOptionModalPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    elevation: 24,
    maxHeight: '78%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: '100%'
  },
  nativeOptionModalHeader: {
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 22,
    paddingTop: 4
  },
  nativeOptionModalTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 26
  },
  nativeOptionList: {
    flexGrow: 0,
    maxHeight: 420
  },
  nativeOptionRow: {
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 22,
    paddingVertical: 10
  },
  nativeOptionRowText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  nativeOptionSeparator: {
    backgroundColor: '#E5E7EB',
    height: StyleSheet.hairlineWidth,
    marginLeft: 22
  },
  nativeOptionCancelButton: {
    alignItems: 'flex-end',
    borderTopColor: '#E5E7EB',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 22
  },
  nativeOptionCancelText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  nativeDateTimePromptRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  nativeDateTimePromptBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  nativeDateTimePromptPanel: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: '#000000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: '86%'
  },
  nativeDateTimePromptTitle: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 6,
    textAlign: 'center'
  },
  nativeDateTimePromptHint: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 14,
    textAlign: 'center'
  },
  nativeDateTimePromptPicker: {
    alignSelf: 'center',
    minHeight: 40
  },
  androidModalScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18
  },
  androidModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38
  },
  androidSaveButton: {
    alignItems: 'center',
    backgroundColor: '#4F6FEA',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 16
  },
  androidSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 26
  },
  qrIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    height: 21,
    width: 21
  },
  qrCell: {
    borderColor: '#64748B',
    borderRadius: 2,
    borderWidth: 1.5,
    height: 9,
    width: 9
  },
  filterIcon: {
    gap: 4,
    width: 22
  },
  filterLineWide: {
    backgroundColor: colors.primary,
    borderRadius: 1,
    height: 2,
    width: 22
  },
  filterLineMedium: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 1,
    height: 2,
    width: 16
  },
  filterLineSmall: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 1,
    height: 2,
    width: 9
  },
  footer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: '#E7EAF0',
    borderRadius: 34,
    borderWidth: 1,
    elevation: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 8,
    minHeight: 68,
    paddingHorizontal: FOOTER_BAR_HORIZONTAL_PADDING,
    paddingVertical: 6,
    position: 'absolute',
    right: 8,
    shadowColor: '#0F172A',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 22
  },
  footerTab: {
    alignItems: 'center',
    borderRadius: 28,
    flex: 1,
    justifyContent: 'center',
    minHeight: 60,
    minWidth: 0,
    // No overflow: 'hidden'. It used to clip the unread badge, which sits above
    // the icon's top-right corner and so is partly outside the tab by design.
    position: 'relative'
  },
  // The icon's own box, and what everything else is placed against: the
  // selection circle fills it exactly and the badge hangs off its corner.
  footerTabIconWrap: {
    alignItems: 'center',
    height: FOOTER_ICON_SLOT,
    justifyContent: 'center',
    position: 'relative',
    width: FOOTER_ICON_SLOT
  },
  // One highlight for the bar, placed and moved by FooterTabIndicator. It sits
  // between the bar's own vertical padding so it encloses the icon and the
  // label together, and it is the first child so every tab paints over it.
  footerTabIndicator: {
    // Almost to the edge of the bar, top and bottom. At the bar's own padding
    // it read as a small shape floating inside the bar rather than as the tab
    // itself being lit.
    bottom: 3,
    left: 0,
    position: 'absolute',
    top: 3
  },
  footerTabContent: {
    alignItems: 'center',
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,
    // Lifts the pair a little inside the tab, so the label has room beneath it
    // and does not sit on the bottom edge of the highlight.
    paddingBottom: 3,
    position: 'relative'
  },
  footerTabBadge: {
    alignItems: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 9,
    // Above the selection circle and the icon both. zIndex orders it on iOS,
    // elevation on Android, where a raised sibling wins regardless of zIndex.
    elevation: 4,
    justifyContent: 'center',
    minHeight: 17,
    minWidth: 17,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -7,
    top: -3,
    zIndex: 4
  },
  footerTabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12
  },
  footerTabText: {
    color: '#111827',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 13
  },
  footerTabTextActive: {
    color: '#4F46E5'
  },
  footerProfileAvatar: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 17,
    borderWidth: 2,
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 34
  },
  footerProfileAvatarActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5'
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.52
  }
});
