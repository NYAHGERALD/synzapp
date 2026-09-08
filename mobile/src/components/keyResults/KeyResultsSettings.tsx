import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FeatherIconName } from '../../types/featherIcon';
import { ActivityIndicator, Animated, Keyboard, Modal, PanResponder, Platform, Pressable, ScrollView, StatusBar as RNStatusBar, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { CompanyKeyResultsConfig, KeyResultGroup, KeyResultMetric, KeyResultUnit } from '../../services/adminApi';
import { KEY_RESULT_ROW_ACTION_WIDTH, styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListActionRow, ListSection } from '../ui/GroupedList';

/**
 * Key results settings.
 *
 * Not chat code. Lifted out of the chat screen unchanged.
 */

const KEY_RESULT_ROW_SWIPE_TRIGGER = 18;

const KEY_RESULT_UNIT_MODAL_HORIZONTAL_PADDING = 18;

const preferredKeyResultUnitIcons: FeatherIconName[] = [
  'hash',
  'dollar-sign',
  'bar-chart-2',
  'trending-up',
  'activity',
  'percent',
  'target',
  'calendar',
  'clock',
  'users',
  'briefcase',
  'shopping-cart',
  'truck',
  'package',
  'box',
  'award',
  'pie-chart',
  'layers',
  'zap',
  'check-circle',
  'arrow-up-right',
  'globe'
];

const keyResultUnitIconOptions: Array<{ icon: FeatherIconName; label: string }> = Array.from(new Set<FeatherIconName>([
  ...preferredKeyResultUnitIcons,
  ...(Object.keys(Feather.glyphMap) as FeatherIconName[])
])).map((icon) => ({
  icon,
  label: formatKeyResultIconLabel(icon)
}));

export function KeyResultsSettings({
  config,
  groupNameDraft,
  isKeyboardVisible,
  isLoading,
  isSaving,
  isSelecting,
  isUnitModalOpen,
  metricDrafts,
  onToggleSelected,
  selected,
  onAddGroup,
  onAddMetric,
  onAddUnit,
  onCloseUnitModal,
  onDeleteGroup,
  onDeleteMetric,
  onDeleteUnit,
  onGroupNameDraftChange,
  onSave,
  onSwipeActive,
  onSelectDraftUnit,
  onSelectMetricUnit,
  onUnitIconDraftChange,
  onUnitLabelDraftChange,
  onUnitSuffixDraftChange,
  onUpdateGroup,
  onUpdateMetric,
  onUpdateMetricDraft,
  unitIconDraft,
  unitLabelDraft,
  unitSuffixDraft
}: {
  config: CompanyKeyResultsConfig;
  groupNameDraft: string;
  isKeyboardVisible: boolean;
  isLoading: boolean;
  isSaving: boolean;
  /** Picking rows to delete. Started from the header menu. */
  isSelecting: boolean;
  isUnitModalOpen: boolean;
  metricDrafts: Record<string, { key: string; unitId: string; value: string }>;
  onToggleSelected: (key: string, entry: { groupId: string; metricId?: string }) => void;
  selected: Record<string, { groupId: string; metricId?: string }>;
  onAddGroup: () => void;
  onAddMetric: (groupId: string) => void;
  onAddUnit: () => void;
  onCloseUnitModal: () => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteMetric: (groupId: string, metricId: string) => void;
  onDeleteUnit: (unitId: string) => void;
  onGroupNameDraftChange: (value: string) => void;
  onSave: () => void;
  onSwipeActive?: (isActive: boolean) => void;
  onSelectDraftUnit: (groupId: string) => void;
  onSelectMetricUnit: (groupId: string, metricId: string) => void;
  onUnitIconDraftChange: (value: FeatherIconName) => void;
  onUnitLabelDraftChange: (value: string) => void;
  onUnitSuffixDraftChange: (value: string) => void;
  onUpdateGroup: (groupId: string, patch: Partial<KeyResultGroup>) => void;
  onUpdateMetric: (groupId: string, metricId: string, patch: Partial<KeyResultMetric>) => void;
  onUpdateMetricDraft: (groupId: string, patch: Partial<{ key: string; unitId: string; value: string }>) => void;
  unitIconDraft: FeatherIconName;
  unitLabelDraft: string;
  unitSuffixDraft: string;
}) {
  const appTheme = useAppTheme();
  const fallbackUnitId = config.units[0]?.unitId || 'unit_number';


  if (isLoading && config.groups.length === 0) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.keyResultsScreenShell}>
      <View style={styles.keyResultsSettingsContent}>
        <View style={styles.keyResultsAdminSection}>
          <Text style={[styles.keyResultsAdminTitle, { color: appTheme.colors.muted }]}>Names</Text>
          <View style={styles.keyResultsUnitDraftRow}>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={onGroupNameDraftChange}
              placeholder="MEGAMEX, DON MIGUEL..."
              placeholderTextColor={appTheme.colors.muted}
              style={[styles.keyResultsInlineInput, { color: appTheme.colors.ink }]}
              value={groupNameDraft}
            />
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onAddGroup}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={[styles.keyResultsAddText, { color: appTheme.colors.link }]}>Add</Text>
            </Pressable>
          </View>
        </View>

        {config.groups.map((group) => {
          const draft = metricDrafts[group.groupId] || { key: '', unitId: fallbackUnitId, value: '' };

          return (
            <View key={group.groupId} style={styles.keyResultsGroupEditor}>
                <View style={styles.keyResultsGroupHeader}>
                  {isSelecting ? (
                    <SelectBox
                      checked={Boolean(selected[group.groupId])}
                      label={`Select ${group.name || 'this name'} and everything in it`}
                      onPress={() => onToggleSelected(group.groupId, { groupId: group.groupId })}
                    />
                  ) : null}
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!isSelecting}
                    onChangeText={(value) => onUpdateGroup(group.groupId, { name: value })}
                    placeholder="Group name"
                    placeholderTextColor={appTheme.colors.muted}
                    style={[styles.keyResultsGroupInput, { color: appTheme.colors.ink }]}
                    value={group.name}
                  />
                </View>

                {group.metrics.map((metric, index) => {
                  const metricKey = `${group.groupId}:${metric.metricId}`;
                  // Older entries were saved with a unit chosen from a list.
                  // The suffix is shown after the value so nothing they set
                  // before disappears, and so the row reads the same as the
                  // LSW board and the Excel export render it.
                  const legacySuffix = getKeyResultUnit(config.units, metric.unitId)?.suffix?.trim() || '';

                  return (
                      <Pressable
                        disabled={!isSelecting}
                        key={metric.metricId}
                        onPress={() => onToggleSelected(metricKey, {
                          groupId: group.groupId,
                          metricId: metric.metricId
                        })}
                        style={styles.keyResultsMetricEditorRow}
                      >
                        {index > 0 ? (
                          <View style={[styles.keyResultsRowDivider, { backgroundColor: appTheme.colors.separator }]} />
                        ) : null}
                        {isSelecting ? (
                          <SelectBox
                            checked={Boolean(selected[metricKey])}
                            label={`Select ${metric.key || 'this key result'}`}
                            onPress={() => onToggleSelected(metricKey, {
                              groupId: group.groupId,
                              metricId: metric.metricId
                            })}
                          />
                        ) : null}
                        <TextInput
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={!isSelecting}
                          onChangeText={(value) => onUpdateMetric(group.groupId, metric.metricId, { key: value })}
                          placeholder="Key name"
                          placeholderTextColor={appTheme.colors.muted}
                          style={[styles.keyResultsMetricInput, { color: appTheme.colors.ink }]}
                          value={metric.key}
                        />
                        <TextInput
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!isSelecting}
                          onChangeText={(value) => onUpdateMetric(group.groupId, metric.metricId, { value })}
                          placeholder="Value"
                          placeholderTextColor={appTheme.colors.muted}
                          style={[styles.keyResultsValueInput, { color: appTheme.colors.ink }]}
                          value={metric.value}
                        />
                        {legacySuffix ? (
                          <Text style={[styles.keyResultsLegacyUnit, { color: appTheme.colors.muted }]}>
                            {legacySuffix}
                          </Text>
                        ) : null}
                      </Pressable>
                  );
                })}

                {isSelecting ? null : (
                <View style={styles.keyResultsMetricDraftRow}>
                  <View style={[styles.keyResultsRowDivider, { backgroundColor: appTheme.colors.separator }]} />
                  <TextInput
                    autoCapitalize="words"
                    autoCorrect={false}
                    onChangeText={(value) => onUpdateMetricDraft(group.groupId, { key: value })}
                    placeholder="Key name"
                    placeholderTextColor={appTheme.colors.muted}
                    style={[styles.keyResultsMetricInput, { color: appTheme.colors.ink }]}
                    value={draft.key}
                  />
                  {/* One free field. Type the number and whatever unit the
                      company actually uses: "$892 Million", "18/Month",
                      "4.931". A fixed list of units could never cover them. */}
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(value) => onUpdateMetricDraft(group.groupId, { value })}
                    placeholder="Value and unit"
                    placeholderTextColor={appTheme.colors.muted}
                    style={[styles.keyResultsValueInput, { color: appTheme.colors.ink }]}
                    value={draft.value}
                  />
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => onAddMetric(group.groupId)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text style={[styles.keyResultsAddText, { color: appTheme.colors.link }]}>Add</Text>
                  </Pressable>
                </View>
                )}
            </View>
          );
        })}

        <ListSection>
          <ListActionRow
            disabled={isSaving}
            label={isSaving ? 'Saving' : 'Save key results'}
            onPress={onSave}
          />
        </ListSection>
      </View>

      <KeyResultUnitSettingsModal
        config={config}
        isKeyboardVisible={isKeyboardVisible}
        isOpen={isUnitModalOpen}
        onAddUnit={onAddUnit}
        onClose={onCloseUnitModal}
        onDeleteUnit={onDeleteUnit}
        onUnitIconDraftChange={onUnitIconDraftChange}
        onUnitLabelDraftChange={onUnitLabelDraftChange}
        onUnitSuffixDraftChange={onUnitSuffixDraftChange}
        unitIconDraft={unitIconDraft}
        unitLabelDraft={unitLabelDraft}
        unitSuffixDraft={unitSuffixDraft}
      />
    </View>
  );
}

function KeyResultUnitSettingsModal({
  config,
  isKeyboardVisible,
  isOpen,
  onAddUnit,
  onClose,
  onDeleteUnit,
  onUnitIconDraftChange,
  onUnitLabelDraftChange,
  onUnitSuffixDraftChange,
  unitIconDraft,
  unitLabelDraft,
  unitSuffixDraft
}: {
  config: CompanyKeyResultsConfig;
  isKeyboardVisible: boolean;
  isOpen: boolean;
  onAddUnit: () => void;
  onClose: () => void;
  onDeleteUnit: (unitId: string) => void;
  onUnitIconDraftChange: (value: FeatherIconName) => void;
  onUnitLabelDraftChange: (value: string) => void;
  onUnitSuffixDraftChange: (value: string) => void;
  unitIconDraft: FeatherIconName;
  unitLabelDraft: string;
  unitSuffixDraft: string;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const [isUnitScrollEnabled, setIsUnitScrollEnabled] = useState(true);
  const handleUnitSwipeActive = useCallback((isActive: boolean) => {
    setIsUnitScrollEnabled(!isActive);
  }, []);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        styles.keyResultsUnitModalScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.callModalHeader}>
          <Pressable
            accessibilityLabel="Back to key result names"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Text style={[styles.backButtonText, { color: appTheme.colors.primary }]}>‹</Text>
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text numberOfLines={1} style={[styles.callModalHeaderTitle, { color: appTheme.colors.ink }]}>Value units</Text>
            <Text numberOfLines={1} style={[styles.callModalHeaderSubtitle, { color: appTheme.colors.muted }]}>
              {config.units.length === 1 ? '1 unit' : `${config.units.length} units`}
            </Text>
          </View>
          {isKeyboardVisible ? (
            <Pressable
              accessibilityLabel="Hide keyboard"
              accessibilityRole="button"
              onPress={() => Keyboard.dismiss()}
              style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
            >
              <Feather name="chevron-down" color={appTheme.colors.primary} size={22} />
            </Pressable>
          ) : (
            <View style={styles.newChatHeaderSpacer} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.keyResultsUnitModalContent}
          directionalLockEnabled
          keyboardShouldPersistTaps="handled"
          scrollEnabled={isUnitScrollEnabled}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.keyResultsAdminSection}>
            <View style={styles.keyResultsUnitDraftRow}>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={onUnitLabelDraftChange}
                placeholder="Unit name"
                placeholderTextColor={appTheme.colors.muted}
                style={[styles.keyResultsInlineInput, { color: appTheme.colors.ink }]}
                value={unitLabelDraft}
              />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={onUnitSuffixDraftChange}
                placeholder="Suffix"
                placeholderTextColor={appTheme.colors.muted}
                style={[styles.keyResultsInlineInput, { color: appTheme.colors.ink }]}
                value={unitSuffixDraft}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.keyResultsIconPicker}>
              {keyResultUnitIconOptions.map((option) => {
                const isSelected = unitIconDraft === option.icon;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.icon}
                    onPress={() => onUnitIconDraftChange(option.icon)}
                    style={({ pressed }) => [
                      styles.keyResultsIconChoice,
                      {
                        backgroundColor: isSelected ? appTheme.colors.primarySoft : appTheme.colors.screen,
                        borderColor: isSelected ? appTheme.colors.primary : appTheme.colors.divider
                      },
                      pressed && styles.pressed
                    ]}
                  >
                    <Feather name={option.icon} color={isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong} size={18} />
                    <Text style={[styles.keyResultsIconChoiceText, { color: isSelected ? appTheme.colors.primary : appTheme.colors.muted }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable accessibilityRole="button" onPress={onAddUnit} style={({ pressed }) => [styles.keyResultsSmallButton, pressed && styles.pressed]}>
              <Text style={styles.keyResultsSmallButtonText}>Add unit</Text>
            </Pressable>
          </View>

          <View style={styles.keyResultsUnitList}>
            {config.units.map((unit) => (
              <KeyResultUnitRow
                canDelete
                key={unit.unitId}
                onDelete={() => onDeleteUnit(unit.unitId)}
                onSwipeActive={handleUnitSwipeActive}
                unit={unit}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function KeyResultUnitRow({
  canDelete,
  onDelete,
  onSwipeActive,
  unit
}: {
  canDelete: boolean;
  onDelete: () => void;
  onSwipeActive?: (isActive: boolean) => void;
  unit: KeyResultUnit;
}) {
  const appTheme = useAppTheme();
  const { width } = useWindowDimensions();
  const rowScrollRef = useRef<ScrollView>(null);
  const rowWidth = Math.max(
    260,
    width - (KEY_RESULT_UNIT_MODAL_HORIZONTAL_PADDING * 2)
  );
  const unitRow = (
    <View style={[styles.keyResultsUnitRow, { borderBottomColor: appTheme.colors.divider }]}>
      <View style={[styles.keyResultsUnitIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
        <Feather name={getSafeKeyResultIcon(unit.icon)} color={appTheme.colors.primary} size={16} />
      </View>
      <View style={styles.chatText}>
        <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{unit.label}</Text>
        <Text style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{unit.suffix || 'No suffix'}</Text>
      </View>
    </View>
  );

  if (!canDelete) {
    return unitRow;
  }

  return (
    <ScrollView
      bounces={false}
      decelerationRate="fast"
      horizontal
      keyboardShouldPersistTaps="handled"
      onMomentumScrollEnd={() => onSwipeActive?.(false)}
      onScrollBeginDrag={() => onSwipeActive?.(true)}
      onScrollEndDrag={() => onSwipeActive?.(false)}
      overScrollMode="never"
      ref={rowScrollRef}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      snapToEnd={false}
      snapToInterval={KEY_RESULT_ROW_ACTION_WIDTH}
      style={[styles.keyResultsNativeSwipeShell, { backgroundColor: appTheme.colors.screen }]}
    >
      <View style={[
        styles.keyResultsNativeSwipeContent,
        {
          backgroundColor: appTheme.colors.screen,
          width: rowWidth
        }
      ]}>
        {unitRow}
      </View>
      <Pressable
        accessibilityLabel={`Delete ${unit.label}`}
        accessibilityRole="button"
        onPress={() => {
          onSwipeActive?.(false);
          rowScrollRef.current?.scrollTo({ animated: true, x: 0, y: 0 });
          onDelete();
        }}
        style={({ pressed }) => [
          styles.keyResultsSwipeAction,
          pressed && styles.pressed
        ]}
      >
        <Feather color="#FFFFFF" name="trash-2" size={19} />
        <Text numberOfLines={1} style={[styles.chatSwipeActionText, styles.keyResultsSwipeActionText]}>Delete</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * The tick beside a row while picking things to delete.
 *
 * A circle rather than a square, which is what the platform draws for a
 * selection you can undo, and filled in the link colour so it reads as a
 * choice rather than a warning.
 */
function SelectBox({
  checked,
  label,
  onPress
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.keyResultsSelectBox,
        {
          backgroundColor: checked ? appTheme.colors.link : 'transparent',
          borderColor: checked ? appTheme.colors.link : appTheme.colors.separator
        },
        pressed && styles.pressed
      ]}
    >
      {checked ? <Feather color="#FFFFFF" name="check" size={13} /> : null}
    </Pressable>
  );
}

function getKeyResultUnit(units: KeyResultUnit[], unitId: string | undefined): KeyResultUnit | null {
  return units.find((unit) => unit.unitId === unitId) || units[0] || null;
}

function formatKeyResultIconLabel(icon: string): string {
  return icon.split('-').map((part) => (
    part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ''
  )).join(' ');
}

function getSafeKeyResultIcon(icon: string | undefined): FeatherIconName {
  return keyResultUnitIconOptions.some((option) => option.icon === icon)
    ? icon as FeatherIconName
    : 'hash';
}

export function getFullScreenModalTopPadding(topInset: number): number {
  const androidStatusBarHeight = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;
  const deviceTopInset = Math.max(topInset, androidStatusBarHeight);

  return Platform.OS === 'android'
    ? Math.max(deviceTopInset + 10, 38)
    : Math.max(deviceTopInset + 8, 22);
}

export function getNativeFullHeightModalPresentationStyle(): 'fullScreen' | 'pageSheet' {
  return Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen';
}
