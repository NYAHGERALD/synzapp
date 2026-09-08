import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import {
  KEY_RESULT_ROW_ACTION_WIDTH,
  LSW_DAILY_ROW_ACTION_WIDTH,
} from './metrics';

/**
 * The LSW workspace and key results.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const workspaceStyles = StyleSheet.create({
  lswScreen: {
    flex: 1
  },
  lswFixedHeader: {
    gap: 12,
    paddingBottom: 10,
    paddingHorizontal: 4,
    paddingTop: 2,
    zIndex: 2
  },
  lswScrollBody: {
    flex: 1
  },
  lswFloatingActionWrap: {
    alignItems: 'flex-end',
    bottom: 28,
    position: 'absolute',
    right: 22,
    zIndex: 5
  },
  lswFloatingMenu: {
    borderRadius: 14,
    borderWidth: 1,
    elevation: 9,
    marginBottom: 14,
    minWidth: 178,
    padding: 6,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16
  },
  lswFloatingMenuTail: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    bottom: -7,
    height: 14,
    position: 'absolute',
    right: 24,
    transform: [{ rotate: '45deg' }],
    width: 14
  },
  lswFloatingMenuItem: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 9,
    minHeight: 40,
    paddingHorizontal: 10
  },
  lswFloatingMenuText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  lswFloatingAddButton: {
    alignItems: 'center',
    borderRadius: 30,
    elevation: 8,
    height: 60,
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    width: 60
  },
  lswScreenContent: {
    gap: 14,
    paddingBottom: 110,
    paddingHorizontal: 4,
    paddingTop: 0
  },
  lswHeroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 54
  },
  lswWeekNavButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  lswWeekNavLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    textAlign: 'center'
  },
  lswErrorBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  lswErrorText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  lswReadOnlyBanner: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  lswReadOnlyText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  lswHeaderMenuWrap: {
    alignItems: 'flex-end',
    minHeight: 44,
    position: 'relative',
    width: 52,
    zIndex: 90
  },
  lswHeaderMenuButton: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  lswHeaderMenu: {
    borderRadius: 14,
    borderWidth: 1,
    elevation: 10,
    minWidth: 176,
    padding: 6,
    position: 'absolute',
    right: 0,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    top: 46
  },
  lswHeaderMenuItem: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38,
    paddingHorizontal: 10
  },
  lswHeaderMenuText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  lswSection: {
    gap: 10
  },
  lswSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 2
  },
  lswSectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 23
  },
  lswAddButton: {
    alignItems: 'center',
    borderRadius: 17,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 13
  },
  lswAddButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  lswFilterRow: {
    gap: 8,
    paddingRight: 8
  },
  lswFilterChip: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 13
  },
  lswFilterChipText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  lswRowCard: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  lswCheckWrap: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 32
  },
  lswCheckbox: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22
  },
  lswRowText: {
    flex: 1,
    minWidth: 0
  },
  lswRowTitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  lswCompletedText: {
    textDecorationLine: 'line-through'
  },
  lswRowMeta: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    marginTop: 2
  },
  lswRowNote: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    marginTop: 4
  },
  lswRowActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2
  },
  lswIconAction: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  lswWeekdayTabs: {
    flexDirection: 'row',
    gap: 4,
    width: '100%'
  },
  lswWeekdayTab: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 31,
    minWidth: 0,
    paddingHorizontal: 2
  },
  lswWeekdayTabText: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15
  },
  lswDailyRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 2,
    paddingVertical: 8
  },
  lswDailySwipeShell: {
    overflow: 'hidden',
    position: 'relative'
  },
  lswDailySwipeContent: {
    width: '100%'
  },
  lswDailySwipeRightActions: {
    alignItems: 'stretch',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: LSW_DAILY_ROW_ACTION_WIDTH
  },
  lswDailySwipeDeleteAction: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    width: LSW_DAILY_ROW_ACTION_WIDTH
  },
  lswDailyTextButton: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2
  },
  lswDailyCheckboxWrap: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 44
  },
  lswNativeCheckbox: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1.5,
    height: 23,
    justifyContent: 'center',
    width: 23
  },
  lswNativeCheckboxSaving: {
    opacity: 0.72
  },
  lswEmptyState: {
    alignItems: 'center',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 88,
    padding: 14
  },
  lswEmptyText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    textAlign: 'center'
  },
  keyResultsSettingsContent: {
    gap: 22,
    paddingBottom: 32,
    paddingTop: 2
  },
  keyResultsScreenShell: {
    position: 'relative'
  },
  keyResultsHeaderOptionsWrap: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    position: 'relative',
    justifyContent: 'flex-end',
    minWidth: 44,
    zIndex: 80
  },
  keyResultsHeaderOptionButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 7,
    height: 36,
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    width: 36,
    zIndex: 82
  },
  keyResultsUnitModalScreen: {
    flex: 1
  },
  keyResultsUnitModalContent: {
    gap: 14,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 12
  },
  keyResultsAdminSection: {
    gap: 7
  },
  keyResultsAdminTitle: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginLeft: 15
  },
  keyResultsPreviewTitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20
  },
  keyResultsAdminHint: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  keyResultsOptionsMenu: {
    borderRadius: 12,
    borderWidth: 1,
    elevation: 8,
    minWidth: 132,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    top: 42,
    zIndex: 83
  },
  keyResultsOptionsMenuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12
  },
  keyResultsOptionsMenuText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  keyResultsUnitDraftRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 15
  },
  keyResultsInlineInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE5EF',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    minHeight: 42,
    paddingHorizontal: 10
  },
  keyResultsIconPicker: {
    flexGrow: 0
  },
  keyResultsIconChoice: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
    minHeight: 38,
    paddingHorizontal: 10
  },
  keyResultsIconChoiceText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  keyResultsSmallButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 36,
    paddingHorizontal: 12
  },
  keyResultsSmallButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 36
  },
  keyResultsUnitList: {
    gap: 2
  },
  keyResultsSwipeShell: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%'
  },
  keyResultsSwipeStatic: {
    overflow: 'hidden'
  },
  keyResultsNativeSwipeShell: {
    overflow: 'hidden',
    width: '100%'
  },
  keyResultsNativeSwipeContent: {
    overflow: 'hidden'
  },
  keyResultsSwipeRightActions: {
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 0,
    top: 0,
    width: KEY_RESULT_ROW_ACTION_WIDTH
  },
  keyResultsSwipeAction: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 54,
    width: KEY_RESULT_ROW_ACTION_WIDTH
  },
  keyResultsSwipeActionText: {
    lineHeight: 16,
    marginTop: 0,
    maxWidth: KEY_RESULT_ROW_ACTION_WIDTH - 36
  },
  keyResultsSwipeContent: {
    overflow: 'hidden',
    width: '100%'
  },
  keyResultsUnitRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingVertical: 8
  },
  keyResultsUnitIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  keyResultsIconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  keyResultsAddInlineButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  keyResultsGroupEditor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 0,
    marginHorizontal: 15,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  keyResultsGroupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  keyResultsGroupInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 38,
    paddingHorizontal: 0
  },
  // The row draws no rule of its own: a border would span its full width and
  // reach the card edge. The divider is a separate inset line above it.
  keyResultsRowDivider: {
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  keyResultsSelectBox: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginRight: 4,
    width: 22
  },
  keyResultsAddText: {
    fontSize: 16,
    fontWeight: '400'
  },
  keyResultsLegacyUnit: {
    fontSize: 13,
    lineHeight: 18
  },
  keyResultsMetricEditorRow: {
    alignItems: 'center',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 6,
    minHeight: 46,
    paddingVertical: 5
  },
  keyResultsMetricDraftRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 46,
    paddingTop: 8
  },
  keyResultsMetricInput: {
    flex: 1.15,
    fontSize: 13,
    fontWeight: '400',
    minHeight: 38,
    paddingHorizontal: 2
  },
  keyResultsValueInput: {
    flex: 0.72,
    fontSize: 13,
    fontWeight: '400',
    minHeight: 38,
    paddingHorizontal: 2,
    textAlign: 'right'
  },
  keyResultsUnitSelect: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 8,
    width: 86
  },
  keyResultsUnitSelectText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  keyResultsPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    gap: 12,
    marginHorizontal: 15,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  keyResultsPreviewGroup: {
    gap: 8
  },
  keyResultsPreviewGroupTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
    lineHeight: 16,
    textTransform: 'uppercase'
  },
  keyResultsPreviewMetric: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 38,
    paddingVertical: 4
  },
  keyResultsPreviewMetricKey: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  keyResultsPreviewMetricValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    textAlign: 'right'
  },
});
