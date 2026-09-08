import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

/**
 * Calling: the overlay, keypad, history and scheduling.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const callStyles = StyleSheet.create({
  callsTab: {
    gap: 8,
    paddingTop: 1
  },
  callQuickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 10
  },
  callQuickAction: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    minHeight: 74
  },
  callQuickActionIcon: {
    alignItems: 'center',
    borderRadius: 22,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48
  },
  callQuickActionBadge: {
    alignItems: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -2,
    top: -2
  },
  callQuickActionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14
  },
  callQuickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16
  },
  callsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    paddingHorizontal: 6,
    paddingTop: 6
  },
  callHistoryRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 6,
    paddingVertical: 8
  },
  callHistoryDeleteButton: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26
  },
  callHistoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21
  },
  callHistorySubtitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minWidth: 0
  },
  callHistorySubtitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17
  },
  callHistoryMeta: {
    alignItems: 'flex-end',
    gap: 7,
    justifyContent: 'center',
    minWidth: 86
  },
  callHistoryTime: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17
  },
  callHistoryActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  callHistoryIconButton: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  callHistoryInfoButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  callOptionsRoot: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100
  },
  callOptionsBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  callOptionsPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 210,
    overflow: 'hidden',
    position: 'absolute',
    right: 14,
    shadowColor: '#000000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    top: 56
  },
  callOptionsRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14
  },
  callOptionsRowText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  callModalScreen: {
    flex: 1,
    paddingHorizontal: 12
  },
  callModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingBottom: 8
  },
  callModalHeaderTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center'
  },
  callModalHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
    textAlign: 'center'
  },
  callModalDoneButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    width: 46
  },
  callModalNextButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 62,
    paddingHorizontal: 14
  },
  callModalNextText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20
  },
  callModalList: {
    flex: 1
  },
  callModalSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    paddingHorizontal: 18,
    paddingTop: 14
  },
  callContactRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 66,
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  callContactTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21
  },
  callContactSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17
  },
  callContactRadio: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22
  },
  callContactCallIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  callKeypadScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 18
  },
  callKeypadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingBottom: 6,
    width: '100%'
  },
  callKeypadHeaderIconButton: {
    alignItems: 'center',
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    width: 54
  },
  callKeypadHeaderIconPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.93 }]
  },
  callKeypadDisplay: {
    alignItems: 'center',
    minHeight: 118,
    justifyContent: 'center',
    width: '100%'
  },
  callKeypadDigits: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
    maxWidth: '96%',
    textAlign: 'center'
  },
  callKeypadHint: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4
  },
  callKeypadMatchedContact: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    maxWidth: 330,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '88%'
  },
  callKeypadMatchedText: {
    flex: 1,
    minWidth: 0
  },
  callKeypadMatchedName: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22
  },
  callKeypadMatchedMeta: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2
  },
  callKeypadGrid: {
    alignContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
    maxWidth: 336
  },
  callKeypadButton: {
    alignItems: 'center',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80
  },
  callKeypadButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.92 }]
  },
  callKeypadButtonText: {
    fontSize: 36,
    fontWeight: '600',
    lineHeight: 40
  },
  callKeypadButtonLetters: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 14,
    minHeight: 14
  },
  callKeypadStartButton: {
    alignItems: 'center',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68
  },
  callKeypadStartButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.92 }]
  },
  callFavoritesHelper: {
    borderRadius: 18,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginVertical: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center'
  },
  scheduleCallContent: {
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: 12
  },
  scheduleCallCard: {
    borderRadius: 14,
    overflow: 'hidden'
  },
  scheduleCallTitleInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  scheduleCallDescriptionInput: {
    fontSize: 15,
    fontWeight: '400',
    minHeight: 86,
    paddingHorizontal: 16,
    paddingTop: 12,
    textAlignVertical: 'top'
  },
  scheduleCallCounter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    paddingBottom: 10,
    paddingHorizontal: 16
  },
  scheduleDateTimeRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 16
  },
  scheduleDateControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end'
  },
  scheduleAndroidDateButton: {
    borderRadius: 8,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  scheduleAndroidDateText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18
  },
  scheduleSwitchRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 16
  },
  scheduleSwitchTrack: {
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 2,
    width: 56
  },
  scheduleSwitchThumb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 28,
    shadowColor: '#000000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    width: 28
  },
  scheduleOptionRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 16
  },
  scheduleRowLabel: {
    flexShrink: 0,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  scheduleRowValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18
  },
  scheduleOptionValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  scheduleCallFootnote: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    paddingHorizontal: 12
  },
  scheduleSendCalendarRow: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 4,
    marginTop: 14,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  scheduleSendCalendarIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  scheduleSendCalendarTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21
  },
  scheduleSendCalendarSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 2
  },
  scheduledCallRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  scheduledCallIcon: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  callOverlayRoot: {
    backgroundColor: '#000000',
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 18
  },
  callRemoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000'
  },
  callOverlayPattern: {
    ...StyleSheet.absoluteFillObject
  },
  callPatternDot: {
    backgroundColor: '#134E4A',
    borderRadius: 18,
    height: 36,
    position: 'absolute',
    width: 36
  },
  callTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    zIndex: 2
  },
  callRoundButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  callSecureBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 168, 132, 0.15)',
    borderColor: 'rgba(94, 234, 212, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  callSecureBadgeText: {
    color: '#CCFBF1',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15
  },
  callIdentityArea: {
    alignItems: 'center',
    marginTop: 22,
    paddingHorizontal: 18,
    zIndex: 2
  },
  callTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    maxWidth: '100%',
    textAlign: 'center'
  },
  callStatus: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 2,
    textAlign: 'center'
  },
  callAvatarStage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 280,
    zIndex: 2
  },
  callAvatarHalo: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 168, 132, 0.1)',
    borderColor: 'rgba(94, 234, 212, 0.13)',
    borderRadius: 112,
    borderWidth: 1,
    height: 224,
    justifyContent: 'center',
    width: 224
  },
  callAvatarHaloInner: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 94,
    height: 188,
    justifyContent: 'center',
    width: 188
  },
  callLocalVideoWrap: {
    backgroundColor: '#050505',
    borderColor: 'rgba(94, 234, 212, 0.52)',
    borderRadius: 18,
    borderWidth: 2,
    bottom: 12,
    height: 156,
    overflow: 'hidden',
    position: 'absolute',
    right: 4,
    width: 112,
    zIndex: 3
  },
  callLocalVideo: {
    height: '100%',
    width: '100%'
  },
  callLocalVideoOff: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center'
  },
  callControlsDock: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 16, 16, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 34,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    justifyContent: 'center',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 11,
    zIndex: 2
  },
  callControlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52
  },
  callAnswerButton: {
    backgroundColor: '#00A884'
  },
  callEndButton: {
    backgroundColor: '#EF4444'
  },
  callEndIconFlip: {
    transform: [{ rotate: '135deg' }]
  },
});
