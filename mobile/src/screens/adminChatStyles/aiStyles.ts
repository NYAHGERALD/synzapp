import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import {
  AI_HISTORY_ROW_ACTION_WIDTH,
} from './metrics';

/**
 * AI usage, credits and history.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const aiStyles = StyleSheet.create({
  aiScreen: {
    backgroundColor: '#F8FAFC',
    flex: 1,
    marginHorizontal: -10
  },
  aiHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 58,
    paddingHorizontal: 12
  },
  aiHeaderButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  aiHeaderTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0
  },
  aiHeaderTitleText: {
    flex: 1,
    minWidth: 0
  },
  aiHeaderTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22
  },
  aiHeaderSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  aiKeyboardAvoidingView: {
    flex: 1
  },
  aiScroll: {
    flex: 1
  },
  aiScrollContent: {
    gap: 16,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 26
  },
  aiHero: {
    alignItems: 'center',
    paddingHorizontal: 10
  },
  aiHeroMarkWrap: {
    alignItems: 'center',
    height: 124,
    justifyContent: 'center',
    position: 'relative',
    width: 124
  },
  aiHeroHalo: {
    backgroundColor: '#A78BFA',
    borderRadius: 58,
    height: 116,
    position: 'absolute',
    width: 116
  },
  aiGreeting: {
    color: '#0B141A',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 27,
    marginTop: 10,
    textAlign: 'center'
  },
  aiPrompt: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 340,
    textAlign: 'center'
  },
  aiEmptyHistory: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 520,
    paddingHorizontal: 10
  },
  aiStartChatButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 48,
    paddingHorizontal: 22
  },
  aiStartChatText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19
  },
  aiHistoryList: {
    paddingTop: 4
  },
  aiHistorySwipeShell: {
    minHeight: 72,
    overflow: 'hidden',
    position: 'relative'
  },
  aiHistorySwipeRightActions: {
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 0,
    top: 0,
    width: AI_HISTORY_ROW_ACTION_WIDTH
  },
  aiHistorySwipeAction: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    width: AI_HISTORY_ROW_ACTION_WIDTH
  },
  aiHistoryRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 4,
    paddingVertical: 10
  },
  aiHistoryIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48
  },
  aiHistoryText: {
    flex: 1,
    minWidth: 0
  },
  aiHistoryTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  aiHistoryTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
    minWidth: 0
  },
  aiHistoryTime: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16
  },
  aiHistoryPreview: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 3
  },
  aiThreadContent: {
    gap: 8,
    paddingBottom: 14,
    paddingHorizontal: 10,
    paddingTop: 12
  },
  aiThreadEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  aiChatBubbleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row'
  },
  aiChatBubbleRowMine: {
    justifyContent: 'flex-end'
  },
  aiChatBubbleRowTheirs: {
    justifyContent: 'flex-start'
  },
  aiChatBubble: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '82%',
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  aiChatBubbleMine: {
    borderTopRightRadius: 5
  },
  aiChatBubbleTheirs: {
    borderTopLeftRadius: 5
  },
  aiChatBubbleText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  aiChatBubbleMetaRow: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 3
  },
  aiChatBubbleTime: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14
  },
  aiChatBubbleSeen: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14
  },
  aiTypingBubble: {
    alignItems: 'center',
    borderRadius: 12,
    borderTopLeftRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '82%',
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  aiTypingText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18
  },
  aiOfflineStatusCard: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 70,
    paddingHorizontal: 13,
    paddingVertical: 12
  },
  aiOfflineStatusIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  aiOfflineStatusText: {
    flex: 1,
    minWidth: 0
  },
  aiOfflineStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20
  },
  aiOfflineStatusBody: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 2
  },
  aiSuggestionList: {
    gap: 10,
    maxWidth: 360,
    paddingTop: 6,
    width: '100%'
  },
  aiSuggestionRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  aiSuggestionText: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20
  },
  aiComposer: {
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderTopColor: '#E5E7EB',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 8,
    paddingTop: 8
  },
  aiInputBox: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  aiInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    maxHeight: 112,
    minHeight: 34,
    paddingHorizontal: 0,
    paddingVertical: 7,
    textAlignVertical: 'top'
  },
  aiComposerIconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    marginBottom: 1,
    width: 30
  },
  aiSendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginBottom: 1,
    width: 36
  },
  aiAttachmentTray: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 5,
    maxHeight: 74
  },
  aiAttachmentTrayContent: {
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  aiAttachmentChip: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 7,
    maxWidth: 230,
    minHeight: 46,
    paddingLeft: 10,
    paddingRight: 4
  },
  aiAttachmentChipText: {
    minWidth: 0,
    width: 132
  },
  aiAttachmentChipName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17
  },
  aiAttachmentChipMeta: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    marginTop: 1
  },
  aiAttachmentChipRemove: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 28
  },
  aiMessageAttachmentList: {
    gap: 6,
    marginBottom: 6
  },
  aiMessageAttachmentCard: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  aiMessageAttachmentText: {
    flex: 1,
    minWidth: 0
  },
  aiMessageAttachmentName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17
  },
  aiMessageAttachmentMeta: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    marginTop: 1
  },
  aiMark: {
    position: 'relative'
  },
  aiMarkPetal: {
    position: 'absolute'
  },
  aiMarkCenter: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(79, 70, 229, 0.18)',
    borderWidth: 1,
    position: 'absolute'
  },
  aiUsageScreen: {
    gap: 22,
    paddingBottom: 32,
    paddingTop: 2
  },
  aiUsageHero: {
    borderRadius: 22,
    borderWidth: 0,
    marginHorizontal: 15,
    padding: 16
  },
  aiUsageHeroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  aiUsageEyebrow: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 16
  },
  aiUsageSpend: {
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 36,
    marginTop: 4
  },
  aiUsageStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  aiUsageStatusText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0
  },
  aiUsageMeta: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10
  },
  aiUsageProgressTrack: {
    borderRadius: 999,
    height: 8,
    marginTop: 14,
    overflow: 'hidden'
  },
  aiUsageProgressFill: {
    borderRadius: 999,
    height: 8
  },
  aiUsageSection: {
    borderRadius: 22,
    borderWidth: 0,
    marginHorizontal: 15,
    overflow: 'hidden'
  },
  aiUsageUnavailableCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 0,
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 24
  },
  aiUsageUnavailableIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  aiUsageUnavailableTitle: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 22,
    textAlign: 'center'
  },
  aiUsageUnavailableText: {
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 280,
    textAlign: 'center'
  },
  aiUsageRefreshButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 18
  },
  aiUsageSectionTitle: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0,
    marginBottom: -14,
    marginLeft: 15,
    marginTop: 4
  },
  aiUsageToggleRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  aiUsageRowTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 20
  },
  aiUsageRowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  aiBudgetRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  aiBudgetInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'right'
  },
  aiUsageSaveButton: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    margin: 12,
    minHeight: 46
  },
  aiMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 15
  },
  aiMetricCard: {
    borderRadius: 18,
    borderWidth: 0,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 13
  },
  aiMetricValue: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 27
  },
  aiMetricLabel: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
});
