import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

/**
 * The Company Library and its previews.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const companyStyles = StyleSheet.create({
  companyLibraryScreen: {
    flex: 1,
    minHeight: 0
  },
  companyLibraryControls: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingBottom: 10
  },
  companyLibraryTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  companyLibrarySearchWrap: {
    flex: 1,
    minWidth: 0
  },
  companyLibraryRefreshButton: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  companyLibraryViewToggle: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 3,
    height: 44,
    padding: 4
  },
  companyLibraryViewToggleButton: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  companyLibraryChipRow: {
    gap: 8,
    paddingRight: 8
  },
  companyLibraryChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12
  },
  companyLibraryChipText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17
  },
  companyLibraryChipCount: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16
  },
  companyLibraryGridContent: {
    gap: 10,
    paddingBottom: 4,
    paddingTop: 12
  },
  companyLibraryListContent: {
    paddingBottom: 4,
    paddingTop: 8
  },
  companyLibraryGridRow: {
    gap: 10
  },
  companyLibraryCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    maxWidth: '48.8%',
    minHeight: 224,
    overflow: 'hidden'
  },
  companyLibraryThumbWrap: {
    height: 104,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  companyLibraryThumb: {
    height: '100%',
    width: '100%'
  },
  companyLibraryPreviewState: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  companyLibraryPreviewStateText: {
    fontSize: 14,
    textAlign: 'center'
  },
  companyLibraryPlayOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 999,
    bottom: 0,
    height: 40,
    justifyContent: 'center',
    left: 0,
    margin: 'auto',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40
  },
  companyLibraryCardBody: {
    gap: 5,
    padding: 12
  },
  companyLibraryCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19
  },
  companyLibraryCardMeta: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  companyLibraryBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 2
  },
  companyLibraryBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  companyLibraryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 12,
    textTransform: 'uppercase'
  },
  companyLibraryListRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    paddingHorizontal: 4,
    paddingVertical: 10
  },
  companyLibraryListThumbWrap: {
    borderRadius: 14,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 58
  },
  companyLibraryListThumb: {
    height: '100%',
    width: '100%'
  },
  companyLibraryListBody: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  companyLibraryListTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 0
  },
  companyLibraryListTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    minWidth: 0
  },
  companyLibraryListKind: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    lineHeight: 14,
    textTransform: 'uppercase'
  },
  companyLibraryListFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7
  },
  companyLibraryListPreviewCue: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  companyLibraryListPreviewText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 12,
    textTransform: 'uppercase'
  },
  companyLibraryPreviewScreen: {
    flex: 1
  },
  companyLibraryPreviewHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 88,
    paddingBottom: 12,
    paddingHorizontal: 16
  },
  companyLibraryPreviewButton: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  companyLibraryPreviewTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  companyLibraryPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21
  },
  companyLibraryPreviewMeta: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 2
  },
  companyLibraryPreviewHeaderSpacer: {
    width: 48
  },
  companyLibraryPreviewImage: {
    flex: 1,
    width: '100%'
  },
  companyLibraryPreviewFooter: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 12
  },
  companyLibraryPreviewFooterText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16
  },
  companyProfileForm: {
    paddingBottom: 32,
    paddingTop: 2
  },
  companyLogoRow: {
    alignItems: 'center',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  companyLogoBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56
  },
  companyLogoImage: {
    height: '100%',
    width: '100%'
  },
  companyCalendarYearRow: {
    alignItems: 'center',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  companyCalendarYearValue: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19,
    maxWidth: 150,
    textAlign: 'right'
  },
  companyCalendarPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  companyCalendarPickerBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    ...StyleSheet.absoluteFillObject
  },
  companyCalendarPickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 18,
    paddingHorizontal: 12,
    paddingTop: 8
  },
  companyCalendarPickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 50
  },
  companyCalendarPickerAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 72
  },
  companyCalendarPickerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center'
  },
  companyCalendarPickerCancelText: {
    fontSize: 16,
    fontWeight: '400'
  },
  companyCalendarPickerDoneText: {
    fontSize: 16,
    fontWeight: '500'
  },
  companyProfileMeta: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 6
  },
});
