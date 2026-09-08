import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

/**
 * Media bubbles, viewers, the review sheet, the photo editor and audio.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const mediaStyles = StyleSheet.create({
  mediaReviewRoot: {
    backgroundColor: '#050505',
    flex: 1
  },
  mediaReviewTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 14
  },
  mediaReviewIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  mediaReviewTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  mediaReviewTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  mediaReviewSubtitle: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  mediaReviewTools: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  mediaReviewToolPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    minWidth: 36,
    paddingHorizontal: 10
  },
  mediaReviewQualityPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    minWidth: 74,
    paddingHorizontal: 12
  },
  mediaReviewQualityPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF'
  },
  mediaReviewQualityText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  mediaReviewQualityTextActive: {
    color: '#0F172A'
  },
  mediaReviewToolText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20
  },
  mediaReviewThumbnailBand: {
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 58
  },
  mediaReviewThumbnailContent: {
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  mediaReviewThumbnail: {
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 2,
    height: 44,
    overflow: 'hidden',
    width: 44
  },
  mediaReviewThumbnailActive: {
    borderColor: '#25D366'
  },
  mediaReviewThumbnailImage: {
    height: '100%',
    width: '100%'
  },
  mediaReviewThumbnailVideo: {
    alignItems: 'center',
    backgroundColor: '#1F2937',
    flex: 1,
    justifyContent: 'center'
  },
  mediaReviewThumbnailPlayBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 8,
    bottom: 3,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: 3,
    width: 16
  },
  mediaReviewPager: {
    flex: 1
  },
  mediaReviewSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  mediaReviewPreviewImage: {
    height: '100%',
    width: '100%'
  },
  mediaReviewVideoPreview: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    height: '92%',
    justifyContent: 'center',
    width: '92%'
  },
  mediaReviewVideoPosterOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingBottom: 14,
    paddingHorizontal: 14,
    pointerEvents: 'none'
  },
  mediaReviewVideoPlayButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 7,
    width: 64
  },
  mediaReviewVideoMeta: {
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    borderRadius: 13,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  mediaReviewRemoveButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    borderRadius: 19,
    bottom: 14,
    height: 38,
    justifyContent: 'center',
    left: 18,
    position: 'absolute',
    width: 38
  },
  mediaReviewFooter: {
    backgroundColor: '#050505',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10
  },
  mediaReviewCaptionRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 19,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 4
  },
  mediaReviewCaptionInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    maxHeight: 92,
    minHeight: 34,
    paddingHorizontal: 0,
    paddingVertical: 6,
    textAlignVertical: 'top'
  },
  mediaReviewInfoText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  mediaReviewSendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between'
  },
  mediaReviewRecipient: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  mediaReviewSendButton: {
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44
  },
  mediaReviewSendCount: {
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderColor: '#050505',
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -4,
    minWidth: 18,
    paddingHorizontal: 3
  },
  mediaReviewSendCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 13
  },
  mediaViewerRoot: {
    backgroundColor: '#0F172A',
    flex: 1
  },
  mediaViewerTopBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 12
  },
  mediaViewerCloseButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  mediaViewerTopActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  mediaViewerTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  mediaViewerTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  mediaViewerSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  mediaViewerPager: {
    flex: 1
  },
  mediaViewerSlide: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  mediaViewerImage: {
    height: '100%',
    width: '100%'
  },
  mediaViewerVideo: {
    height: '100%',
    width: '100%'
  },
  mediaViewerVideoShell: {
    backgroundColor: '#020617',
    height: '100%',
    width: '100%'
  },
  mediaViewerVideoControlsTop: {
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.98)',
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 8
  },
  mediaViewerVideoTimeText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    minWidth: 38,
    textAlign: 'center'
  },
  mediaViewerVideoTrackHitArea: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    minWidth: 80
  },
  mediaViewerVideoTrack: {
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    borderRadius: 2,
    height: 4,
    position: 'relative'
  },
  mediaViewerVideoTrackFill: {
    backgroundColor: colors.primary,
    borderRadius: 2,
    height: 4
  },
  mediaViewerVideoTrackThumb: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
    borderRadius: 7,
    borderWidth: 1.5,
    height: 14,
    marginLeft: -7,
    position: 'absolute',
    top: -5,
    width: 14
  },
  mediaViewerSpeedButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    minWidth: 34,
    paddingHorizontal: 5
  },
  mediaViewerSpeedText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  mediaViewerVideoStage: {
    flex: 1,
    position: 'relative'
  },
  mediaViewerVideoPosterImage: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    opacity: 0.82,
    width: '100%'
  },
  mediaViewerVideoPosterImageHidden: {
    opacity: 0
  },
  mediaViewerVideoCenterButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    borderRadius: 33,
    height: 66,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -33,
    marginTop: -33,
    position: 'absolute',
    top: '50%',
    width: 66
  },
  mediaViewerVideoCaptionBar: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    left: 0,
    minHeight: 58,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    position: 'absolute',
    right: 0
  },
  mediaViewerVideoCaptionText: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  mediaViewerVideoReplyPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.64)',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 11
  },
  mediaViewerVideoReplyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  mediaViewerVideoPoster: {
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
    width: '100%'
  },
  mediaViewerVideoPosterOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.42)',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 28
  },
  mediaViewerUnavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28
  },
  mediaViewerUnavailableTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center'
  },
  mediaViewerUnavailableText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 4,
    textAlign: 'center'
  },
  mediaViewerFooter: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8
  },
  mediaViewerThumbnailContent: {
    alignItems: 'center',
    gap: 7
  },
  mediaViewerThumbnail: {
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 2,
    height: 48,
    overflow: 'hidden',
    width: 48
  },
  mediaViewerThumbnailActive: {
    borderColor: '#25D366'
  },
  mediaViewerThumbnailImage: {
    height: '100%',
    width: '100%'
  },
  mediaViewerThumbnailPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#1F2937',
    flex: 1,
    justifyContent: 'center'
  },
  mediaViewerMeta: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center'
  },
  mediaViewerActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: 44
  },
  mediaViewerActionButton: {
    alignItems: 'center',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 44
  },
  sentPhotoCropShade: {
    backgroundColor: 'rgba(2, 6, 23, 0.36)',
    position: 'absolute'
  },
  sentPhotoCropBox: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    borderRadius: 2,
    borderStyle: 'dashed',
    borderWidth: 1.4,
    position: 'absolute'
  },
  sentPhotoStickerRow: {
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    maxHeight: 56
  },
  sentPhotoStickerRowContent: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  sentPhotoStickerOption: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  sentPhotoStickerOptionActive: {
    backgroundColor: '#FFFFFF'
  },
  sentPhotoStickerOptionText: {
    fontSize: 22,
    lineHeight: 27
  },
  sentPhotoColorDot: {
    borderColor: 'rgba(255, 255, 255, 0.38)',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    width: 28
  },
  sentPhotoColorDotActive: {
    borderColor: '#FFFFFF',
    borderWidth: 3
  },
  audioPreviewRoot: {
    flex: 1,
    paddingHorizontal: 18
  },
  audioPreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44
  },
  audioPreviewCloseButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  audioPreviewHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center'
  },
  audioPreviewShareButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  audioPreviewShareButtonDisabled: {
    opacity: 0.45
  },
  audioPreviewContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 54
  },
  audioPreviewFileIcon: {
    alignItems: 'center',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    marginBottom: 18,
    width: 68
  },
  audioPreviewFileName: {
    fontSize: 21,
    fontWeight: '400',
    lineHeight: 27,
    marginBottom: 7,
    maxWidth: 310,
    textAlign: 'center'
  },
  audioPreviewFileMeta: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 34,
    textAlign: 'center'
  },
  audioPreviewPlayer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    maxWidth: 390,
    width: '100%'
  },
  audioPreviewSkipButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  audioPreviewSkipText: {
    fontSize: 9,
    fontWeight: '400',
    lineHeight: 10,
    marginTop: -3
  },
  audioPreviewPlayButton: {
    alignItems: 'center',
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60
  },
  audioPreviewTimelineWrap: {
    marginTop: 24,
    maxWidth: 390,
    width: '100%'
  },
  audioPreviewTrackHitArea: {
    justifyContent: 'center',
    minHeight: 28,
    width: '100%'
  },
  audioPreviewTrack: {
    borderRadius: 4,
    height: 6,
    overflow: 'hidden'
  },
  audioPreviewTrackFill: {
    borderRadius: 4,
    height: '100%'
  },
  audioPreviewTrackThumb: {
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    marginLeft: -8,
    marginTop: -5,
    position: 'absolute',
    top: '50%',
    width: 16
  },
  audioPreviewTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  audioPreviewTimeText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  voiceRecordingBox: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 9,
    minHeight: 42,
    paddingHorizontal: 8
  },
  voiceRecordingCancelButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 32
  },
  voiceRecordingDot: {
    backgroundColor: '#EF4444',
    borderRadius: 5,
    height: 10,
    width: 10
  },
  voiceRecordingText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    minWidth: 44
  },
  voiceRecordingHint: {
    color: '#64748B',
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  voiceRecordingSendButton: {
    backgroundColor: '#0F766E'
  },
  mediaPreparationModalRoot: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22
  },
  mediaPreparationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(15, 118, 110, 0.18)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    maxWidth: 520,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 34,
    width: '100%'
  },
  mediaPreparationIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50
  },
  mediaPreparationIconActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#99F6E4'
  },
  mediaPreparationIconError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  mediaPreparationContent: {
    flex: 1,
    gap: 8
  },
  mediaPreparationEyebrow: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.4,
    lineHeight: 15,
    textTransform: 'uppercase'
  },
  mediaPreparationTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24
  },
  mediaPreparationBody: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20
  },
  mediaPreparationProgressBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  mediaPreparationProgressTrack: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    flex: 1,
    height: 8,
    overflow: 'hidden'
  },
  mediaPreparationProgressFill: {
    backgroundColor: '#0F766E',
    borderRadius: 999,
    height: '100%'
  },
  mediaPreparationProgressText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    minWidth: 34,
    textAlign: 'right'
  },
  mediaPreparationButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 92,
    paddingHorizontal: 18
  },
  mediaPreparationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
});
