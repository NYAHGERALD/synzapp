import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import {
  MESSAGE_INPUT_MAX_HEIGHT,
  MESSAGE_INPUT_MIN_HEIGHT,
} from './metrics';

/**
 * Message bubbles, the thread and everything drawn inside a message.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const messageStyles = StyleSheet.create({
  messageHeader: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 0,
    flexDirection: 'row',
    gap: 9,
    marginHorizontal: -10,
    minHeight: 66,
    paddingHorizontal: 8
  },
  messageBackButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    height: 48,
    justifyContent: 'center',
    minWidth: 62,
    paddingHorizontal: 3
  },
  messageBackText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '400',
    lineHeight: 44
  },
  messageBackCountText: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    color: colors.primary,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 21,
    minWidth: 28,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 2,
    textAlign: 'center'
  },
  messageHeaderIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 54,
    minWidth: 0
  },
  messageHeaderText: {
    flex: 1,
    minWidth: 0
  },
  messageHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  messageHeaderPresence: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15,
    marginTop: -1
  },
  messageHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5
  },
  messageHeaderIcon: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    minWidth: 40
  },
  messageHeaderVideoIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 1,
    justifyContent: 'center',
    minWidth: 34
  },
  messageScreen: {
    backgroundColor: '#ECE5DD',
    flex: 1,
    marginHorizontal: -10,
    marginTop: 0,
    position: 'relative'
  },
  // Positioned, so the reply focus scrim can cover exactly the conversation
  // and leave the composer live beneath it.
  messageListWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative'
  },
  messageList: {
    flex: 1
  },
  messageListContent: {
    gap: 6,
    paddingBottom: 12,
    paddingHorizontal: 22,
    paddingTop: 12
  },
  messageListContentDeleting: {
    paddingBottom: 106
  },
  messageListContentSearching: {
    paddingBottom: 86,
    paddingTop: 76
  },
  messageDeleteFloatingWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 14
  },
  messageDeleteFloatingCard: {
    alignItems: 'center',
    backgroundColor: '#E11D48',
    borderRadius: 28,
    elevation: 9,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 128,
    paddingHorizontal: 23,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 16
  },
  messageDeleteFloatingCount: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
    minWidth: 18,
    textAlign: 'center'
  },
  messageDateRow: {
    alignItems: 'center',
    marginVertical: 7
  },
  messageDateText: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 8,
    color: '#475569',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  messageBubbleSelectableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 30,
    overflow: 'visible'
  },
  messageBubbleSelectableRowActive: {
    paddingLeft: 2
  },
  messageBubbleSelectableContent: {
    flex: 1,
    minWidth: 0,
    overflow: 'visible',
    position: 'relative'
  },
  messageBubbleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row'
  },
  messageBubbleRowMine: {
    justifyContent: 'flex-end'
  },
  messageBubbleRowTheirs: {
    justifyContent: 'flex-start'
  },
  messageBubbleRowWithReaction: {
    marginBottom: 14
  },
  messageBubbleMotionWrap: {
    maxWidth: '82%',
    minWidth: 104
  },
  messageBubbleMotionWrapWithGroupAvatar: {
    maxWidth: '74%'
  },
  messageMediaForwardButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    width: 36
  },
  messageMediaForwardButtonMine: {
    marginRight: 7
  },
  messageMediaForwardButtonTheirs: {
    marginLeft: 7
  },
  messageBubbleMotionWrapRich: {
    minWidth: 148
  },
  messageBubble: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'relative'
  },
  messageBubbleWithImage: {
    paddingHorizontal: 3,
    paddingTop: 3
  },
  messageSwipeReplyCue: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    top: 6,
    width: 32
  },
  messageSwipeReplyCueMine: {
    right: 10
  },
  messageSwipeReplyCueTheirs: {
    left: 10
  },
  messageBubblePressed: {
    opacity: 0.88
  },
  messageBubbleHighlighted: {
    borderColor: '#25D366',
    borderWidth: 1.5,
    shadowColor: '#25D366',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 7
  },
  messageBubbleMine: {
    backgroundColor: '#D9FDD3'
  },
  messageBubbleTheirs: {
    backgroundColor: '#FFFFFF'
  },
  messageBubbleTail: {
    bottom: 0,
    height: 0,
    position: 'absolute',
    width: 0
  },
  messageBubbleTailMine: {
    borderRightColor: 'transparent',
    borderRightWidth: 16,
    borderTopColor: '#D9FDD3',
    borderTopWidth: 20,
    right: -13
  },
  messageBubbleTailTheirs: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 16,
    borderTopColor: '#FFFFFF',
    borderTopWidth: 20,
    left: -13
  },
  messageBubbleText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  messageSearchHighlight: {
    backgroundColor: '#FDE68A',
    borderRadius: 3,
    color: '#713F12'
  },
  messageBubbleCaptionText: {
    paddingHorizontal: 6,
    paddingTop: 5
  },
  messageBubbleImage: {
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    height: '100%',
    width: '100%'
  },
  messageBubbleMediaFrame: {
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative'
  },
  messageAlbumFrame: {
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative'
  },
  messageAlbumTile: {
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'absolute'
  },
  messageAlbumVideoBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    borderRadius: 10,
    bottom: 6,
    flexDirection: 'row',
    gap: 4,
    left: 6,
    minHeight: 20,
    paddingHorizontal: 6,
    position: 'absolute'
  },
  messageAlbumVideoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  messageVideoPlayBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -28,
    marginTop: -28,
    position: 'absolute',
    top: '50%',
    width: 56
  },
  messageVideoDurationBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 12,
    bottom: 7,
    flexDirection: 'row',
    gap: 5,
    minHeight: 22,
    paddingHorizontal: 7,
    position: 'absolute',
    right: 7
  },
  messageVideoDurationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  messageAlbumMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    justifyContent: 'center'
  },
  messageAlbumMoreText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '400',
    lineHeight: 32
  },
  messageBubbleMediaPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    flex: 1,
    justifyContent: 'center'
  },
  messageAttachmentCard: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    minWidth: 206,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 8,
    position: 'relative'
  },
  messageAttachmentCardMine: {
    backgroundColor: 'rgba(173, 238, 164, 0.64)'
  },
  messageAttachmentCardTheirs: {
    backgroundColor: '#F1F5F9'
  },
  messageAttachmentIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 42
  },
  messageAttachmentThumbnail: {
    height: 38,
    width: 38
  },
  messageAttachmentText: {
    flex: 1,
    minWidth: 0
  },
  messageAttachmentName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  messageAttachmentMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 1
  },
  messageVoiceNoteCard: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    minWidth: 282,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  messageVoiceNotePlayButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  messageVoiceNotePlayButtonMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.86)'
  },
  messageVoiceNotePlayButtonTheirs: {
    backgroundColor: '#FFFFFF'
  },
  messageVoiceNoteBody: {
    flex: 1,
    minWidth: 0
  },
  messageVoiceWaveformRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    height: 28,
    minWidth: 0,
    width: '100%'
  },
  messageVoiceWaveformBar: {
    borderRadius: 2,
    width: 3
  },
  messageVoiceNoteMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 1
  },
  messageVoiceNoteMetaDot: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15
  },
  messageBubbleMetaRow: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2
  },
  messageBubbleTime: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15
  },
  messageBubbleStatus: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15
  },
  messageBubbleStatusDelivered: {
    color: '#F97316'
  },
  messageBubbleStatusQueued: {
    color: '#DC2626'
  },
  messageBubbleStatusRead: {
    color: '#2563EB'
  },
  messageReactionBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    bottom: -16,
    elevation: 2,
    minWidth: 28,
    paddingHorizontal: 7,
    paddingVertical: 2,
    position: 'absolute',
    shadowColor: '#0F172A',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 3
  },
  messageReactionBadgeMine: {
    right: 8
  },
  messageReactionBadgeTheirs: {
    left: 8
  },
  messageReactionText: {
    fontSize: 15,
    lineHeight: 19
  },
  messageActionOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    flex: 1
  },
  messageActionBlurBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  messageActionFastBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 250, 252, 0.58)'
  },
  messageActionDismiss: {
    ...StyleSheet.absoluteFillObject
  },
  messageActionContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  messageActionStack: {
    gap: 8,
    maxWidth: 288
  },
  messageActionStackMine: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end'
  },
  messageActionStackTheirs: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start'
  },
  messageReactionStrip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    elevation: 10,
    height: 46,
    maxWidth: '100%',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#0F172A',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  },
  messageReactionStripScroll: {
    flexGrow: 0,
    height: 32,
    maxHeight: 32
  },
  messageReactionStripContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 32
  },
  messageReactionButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  messageReactionButtonActive: {
    backgroundColor: '#E0F2FE'
  },
  messageReactionButtonPressed: {
    backgroundColor: '#DDF6EF'
  },
  messageReactionMoreButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  messageReactionButtonText: {
    fontSize: 24,
    lineHeight: 30
  },
  messageReactionPickerRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  messageReactionPickerBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  messageReactionPickerKeyboard: {
    justifyContent: 'flex-end'
  },
  messageReactionPickerSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    elevation: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#0F172A',
    shadowOffset: { height: -8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 22
  },
  messageReactionPickerHandle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 52
  },
  messageReactionPickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 14
  },
  messageReactionPickerHeaderText: {
    flex: 1
  },
  messageReactionPickerEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    lineHeight: 14,
    textTransform: 'uppercase'
  },
  messageReactionPickerTitle: {
    fontSize: 17,
    lineHeight: 22,
    marginTop: 3
  },
  messageReactionPickerClose: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  messageReactionPickerSearch: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14
  },
  messageReactionPickerSearchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    minHeight: 44,
    padding: 0
  },
  messageReactionPickerClear: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  messageReactionPickerContent: {
    paddingBottom: 4,
    paddingTop: 20
  },
  messageReactionPickerGroup: {
    marginBottom: 24
  },
  messageReactionPickerGroupTitle: {
    fontSize: 14,
    letterSpacing: 0.3,
    lineHeight: 18,
    marginBottom: 12
  },
  messageReactionPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  messageReactionPickerEmojiButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  messageReactionPickerEmojiText: {
    fontSize: 29,
    lineHeight: 34
  },
  messageReactionPickerEmpty: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 96,
    paddingHorizontal: 18
  },
  messageReactionPickerEmptyText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center'
  },
  messageActionPreviewCard: {
    alignSelf: 'stretch',
    borderRadius: 14,
    elevation: 6,
    maxWidth: 288,
    minWidth: 218,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 14
  },
  messageActionPreviewCardMine: {
    borderBottomRightRadius: 5
  },
  messageActionPreviewCardTheirs: {
    borderBottomLeftRadius: 5
  },
  messageActionPreviewAuthor: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  messageActionPreviewText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 2
  },
  messageActionMediaPreviewFrame: {
    alignSelf: 'stretch',
    backgroundColor: '#E2E8F0',
    borderRadius: 11,
    height: 132,
    marginBottom: 8,
    marginTop: 2,
    overflow: 'hidden',
    position: 'relative'
  },
  messageActionMediaPreviewImage: {
    height: '100%',
    width: '100%'
  },
  messageActionMediaPreviewPlaceholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  messageActionMediaPreviewPlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -24,
    marginTop: -24,
    position: 'absolute',
    top: '50%',
    width: 48
  },
  messageActionMediaPreviewBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    borderRadius: 12,
    bottom: 7,
    flexDirection: 'row',
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 7,
    position: 'absolute',
    right: 7
  },
  messageActionMediaPreviewBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  messageActionPreviewMeta: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
    marginTop: 4
  },
  messageActionMenu: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 22,
    elevation: 10,
    minWidth: 214,
    overflow: 'hidden',
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 20
  },
  messageActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    minHeight: 43,
    paddingHorizontal: 20
  },
  messageActionRowPressed: {
    backgroundColor: '#F8FAFC'
  },
  messageActionLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  messageActionLabelDestructive: {
    color: '#E11D48'
  },
  messageActionDivider: {
    backgroundColor: '#E2E8F0',
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    marginVertical: 6
  },
  messageComposer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7,
    paddingBottom: 8,
    paddingHorizontal: 14,
    paddingTop: 6
  },
  messageComposerMain: {
    flex: 1,
    gap: 0
  },
  messageComposerLibraryButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  messageInputBox: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    minHeight: 42,
    paddingHorizontal: 6
  },
  messageInputBoxWithReply: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0
  },
  messageInput: {
    color: colors.ink,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '400',
    maxHeight: MESSAGE_INPUT_MAX_HEIGHT,
    minHeight: MESSAGE_INPUT_MIN_HEIGHT,
    minWidth: 0,
    paddingVertical: 8,
    textAlignVertical: 'top'
  },
  messageComposerIconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 28
  },
  scheduleChoiceRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14
  },
  scheduleChoiceIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  scheduleChoiceLabel: {
    flex: 1,
    fontSize: 15.5
  },
  scheduledBanner: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 10
  },
  scheduledBannerText: {
    flex: 1,
    fontSize: 13.5
  },
  scheduledMessageRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingVertical: 14
  },
  scheduledMessagePreview: {
    fontSize: 15,
    lineHeight: 20
  },
  scheduledMessageFailure: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  scheduledMessageWhen: {
    fontSize: 13
  },
  scheduledMessageActions: {
    flexDirection: 'row',
    gap: 18,
    paddingTop: 2
  },
  scheduledMessageAction: {
    fontSize: 14.5
  },
  waitingMessagesRoot: {
    flex: 1
  },
  waitingMessagesHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 15,
    paddingTop: 8
  },
  waitingMessagesHeaderText: {
    flex: 1
  },
  waitingMessagesTitle: {
    fontSize: 22,
    letterSpacing: -0.3
  },
  waitingMessagesSubtitle: {
    fontSize: 13.5,
    marginTop: 2
  },
  waitingMessagesChipRow: {
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 8
  },
  waitingMessagesChip: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  waitingMessagesChipText: {
    fontSize: 13.5
  },
  waitingMessagesList: {
    paddingHorizontal: 15
  },
  waitingMessageRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14
  },
  waitingMessageText: {
    flex: 1
  },
  waitingMessageTitle: {
    fontSize: 15.5
  },
  waitingMessageMeta: {
    fontSize: 13,
    marginTop: 3
  },
  waitingMessageAction: {
    fontSize: 14.5
  },
  waitingMessagesState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48
  },
  waitingMessagesEmpty: {
    fontSize: 14.5,
    paddingHorizontal: 40,
    textAlign: 'center'
  },
  waitingMessagesLinkButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 15,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  waitingMessagesLinkText: {
    fontSize: 15
  },
  stopReasonBody: {
    gap: 12,
    paddingHorizontal: 15,
    paddingTop: 4
  },
  stopReasonNote: {
    fontSize: 14,
    lineHeight: 19
  },
  stopReasonInput: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15.5,
    minHeight: 96,
    padding: 14,
    textAlignVertical: 'top'
  },
  stopReasonConfirm: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14
  },
  stopReasonConfirmText: {
    fontSize: 15.5
  },
  stopReasonCancel: {
    alignItems: 'center',
    paddingVertical: 6
  },
  stopReasonCancelText: {
    fontSize: 15
  },
  messageSendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  messageListRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  messageListIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  messageListMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  messageListSender: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19
  },
  messageListTime: {
    color: '#8B95A5',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  messageListPreview: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 1
  },
  messageBubbleUnreadableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2
  },
  messageBubbleUnreadableText: {
    fontSize: 14,
    fontStyle: 'italic'
  },
});
