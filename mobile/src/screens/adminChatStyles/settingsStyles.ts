import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

/**
 * Settings screens, guided setup and RAILS surfaces.
 *
 * Part of the Admin chat stylesheet, split by area. The pieces are plain
 * pieces are registered separately and merged, so every `styles.x` reference
 * resolves exactly as it did when they lived in one object.
 */
export const settingsStyles = StyleSheet.create({
  settingsList: {
    gap: 14,
    paddingTop: 6
  },
  backupSettings: {
    paddingBottom: 32,
    paddingTop: 2
  },
  guidedSetupOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120
  },
  guidedSetupScrimSvg: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute'
  },
  guidedSetupConnectorSvg: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
    zIndex: 1
  },
  guidedSetupTarget: {
    alignItems: 'center',
    borderWidth: 1.5,
    elevation: 8,
    justifyContent: 'center',
    position: 'absolute',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    zIndex: 2
  },
  guidedSetupGlow: {
    ...StyleSheet.absoluteFillObject
  },
  guidedSetupPulse: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5
  },
  guidedSetupHint: {
    borderRadius: 18,
    borderWidth: 1,
    elevation: 14,
    overflow: 'hidden',
    padding: 14,
    position: 'absolute',
    shadowColor: '#0F172A',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    zIndex: 3
  },
  guidedSetupHintHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  guidedSetupProgress: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    textTransform: 'uppercase'
  },
  guidedSetupSkipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 52
  },
  guidedSetupSkipText: {
    fontSize: 13,
    fontWeight: '500'
  },
  guidedSetupTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginBottom: 6
  },
  guidedSetupBody: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 12
  },
  guidedSetupPrimaryButton: {
    alignItems: 'center',
    borderRadius: 13,
    justifyContent: 'center',
    minHeight: 42
  },
  guidedSetupPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  settingsSaveButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 148,
    paddingHorizontal: 16
  },
  settingsSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  settingsListItem: {
    alignItems: 'center',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  settingsListCard: {
    borderRadius: 22,
    borderWidth: 0,
    overflow: 'hidden'
  },
  // Kept as a wrapper so callers do not have to change, but flat now. House
  // style: a card is raised because the page behind it is darker, not because
  // it casts a shadow.
  settingsListCardShadow: {
    borderRadius: 22,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0,
    shadowRadius: 7
  },
  settingsListIcon: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 28
  },
  settingsListIconText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  settingsInputBox: {
    borderBottomWidth: 0,
    minHeight: 48,
    justifyContent: 'center'
  },
  settingsInput: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    minHeight: 48,
    paddingHorizontal: 16
  },
});
