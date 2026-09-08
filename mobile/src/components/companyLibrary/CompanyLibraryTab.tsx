import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import type { CompanyLibraryItem } from '../../services/companyLibraryApi';
import type { ImageSourcePropType } from 'react-native';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChatSearchBar, androidButtonRipple, androidIconRipple, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { CompanyLibraryKindFilter, companyLibraryDocumentThumbnailSources, formatCompanyLibraryDate, getCompanyLibraryDisplayName, getCompanyLibraryExtension, getCompanyLibraryKind, getCompanyLibraryKindLabel, getCompanyLibraryPhotoSource, normalizeCompanyLibraryBucketValue } from '../../services/companyLibraryDisplay';
import { TenantGroup } from '../../services/adminApi';
import { formatByteCount } from '../../services/chatDisplayFormatting';
import { getCachedCompanyLibraryVideoThumbnail, getCompanyLibraryVideoThumbnail, subscribeCompanyLibraryVideoThumbnail } from '../../services/companyLibraryVideoThumbnails';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The Company Library tab.
 *
 * Lifted out of the chat screen unchanged. Its display helpers went to
 * `services/companyLibraryDisplay.ts` first, because the preview modals that
 * stay behind need them too.
 */

type CompanyLibraryScopeFilter =
  | 'company'
  | 'associated'
  | 'chats'
  | 'rails'
  | 'rca'
  | `department:${string}`
  | `group:${string}`;

export type CompanyLibraryViewMode = 'grid' | 'list';

interface CompanyLibraryBucket {
  count: number;
  key: CompanyLibraryScopeFilter;
  label: string;
}

export function CompanyLibraryTab({
  currentUid,
  departmentName,
  fileHeaders,
  groups,
  isLoading,
  items,
  onOpenPreview,
  onRefresh,
  onSearchChange,
  search,
  viewMode
}: {
  currentUid: string;
  departmentName: string;
  fileHeaders?: Record<string, string>;
  groups: TenantGroup[];
  isLoading: boolean;
  items: CompanyLibraryItem[];
  onOpenPreview: (item: CompanyLibraryItem) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  search: string;
  /**
   * Owned by the screen, not here, because the control that changes it now sits
   * in the header beside the back button — where a screen's controls belong,
   * and where it leaves the search field the whole width.
   */
  viewMode: CompanyLibraryViewMode;
}) {
  const appTheme = useAppTheme();
  const [scopeFilter, setScopeFilter] = useState<CompanyLibraryScopeFilter>('company');
  const [kindFilter, setKindFilter] = useState<CompanyLibraryKindFilter>('all');
  const libraryBuckets = useMemo(
    () => buildCompanyLibraryBuckets({
      currentUid,
      departmentName,
      groups,
      items
    }),
    [currentUid, departmentName, groups, items]
  );
  const activeBucket = useMemo(
    () => libraryBuckets.find((bucket) => bucket.key === scopeFilter) || libraryBuckets[0],
    [libraryBuckets, scopeFilter]
  );
  useEffect(() => {
    if (!libraryBuckets.some((bucket) => bucket.key === scopeFilter)) {
      setScopeFilter('company');
    }
  }, [libraryBuckets, scopeFilter]);
  const scopedItems = useMemo(
    () => items.filter((item) => isCompanyLibraryItemInBucket({
      bucketKey: scopeFilter,
      currentUid,
      departmentName,
      item
    })),
    [currentUid, departmentName, items, scopeFilter]
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return scopedItems.filter((item) => {
      const matchesKind = kindFilter === 'all' || getCompanyLibraryKind(item) === kindFilter;
      const searchableText = [
        item.label,
        item.fileName,
        item.note,
        item.sourceArea,
        item.sourceLabel,
        item.uploadedByName,
        item.uploadedByDepartmentName,
        getCompanyLibraryKindLabel(getCompanyLibraryKind(item))
      ].filter(Boolean).join(' ').toLowerCase();

      return matchesKind && (!query || searchableText.includes(query));
    });
  }, [kindFilter, scopedItems, search]);

  return (
    <View style={styles.companyLibraryScreen}>
      <View style={[
        styles.companyLibraryControls,
        { borderBottomColor: appTheme.colors.divider }
      ]}>
        {/* The whole width. The view toggle and refresh moved up to the header
            row, which is where a screen's controls belong and what lets this
            field match every other search field in the app. */}
        <View style={libraryStyles.searchWrap}>
          <ChatSearchBar
            onChangeText={onSearchChange}
            placeholder="Search Library"
            value={search}
          />
        </View>

        <View style={[libraryStyles.filterCard, { backgroundColor: appTheme.colors.groupedCard }]}>
          <ScrollView
            contentContainerStyle={libraryStyles.filterContent}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            {libraryBuckets.map((bucket) => (
              <CompanyLibraryFilterLink
                count={bucket.count}
                isActive={scopeFilter === bucket.key}
                key={bucket.key}
                label={bucket.label}
                onPress={() => setScopeFilter(bucket.key)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={[libraryStyles.filterCard, { backgroundColor: appTheme.colors.groupedCard }]}>
          <ScrollView
            contentContainerStyle={libraryStyles.filterContent}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            {(['all', 'documents', 'photos', 'videos', 'audio', 'other'] as CompanyLibraryKindFilter[]).map((kind) => (
              <CompanyLibraryFilterLink
                count={kind === 'all' ? scopedItems.length : scopedItems.filter((item) => getCompanyLibraryKind(item) === kind).length}
                isActive={kindFilter === kind}
                key={kind}
                label={kind === 'all' ? 'All' : getCompanyLibraryKindLabel(kind)}
                onPress={() => setKindFilter(kind)}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      <FlatList
        alwaysBounceVertical={false}
        bounces={false}
        columnWrapperStyle={viewMode === 'grid' ? styles.companyLibraryGridRow : undefined}
        contentContainerStyle={[
          viewMode === 'grid' ? styles.companyLibraryGridContent : styles.companyLibraryListContent,
          !filteredItems.length && styles.fixedListEmptyContent
        ]}
        data={filteredItems}
        key={viewMode}
        keyExtractor={(item) => item.evidenceId}
        keyboardDismissMode={getKeyboardDismissMode()}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={appTheme.colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: appTheme.colors.muted }]}>
                {search.trim()
                  ? 'No Library items found'
                  : `No Library items in ${activeBucket?.label || 'this section'} yet`}
              </Text>
            </View>
          )
        }
        numColumns={viewMode === 'grid' ? 2 : 1}
        overScrollMode="never"
        renderItem={({ item }) => viewMode === 'grid' ? (
            <CompanyLibraryCard
              fileHeaders={fileHeaders}
              item={item}
              onOpenPreview={() => onOpenPreview(item)}
            />
          ) : (
            <CompanyLibraryListRow
              fileHeaders={fileHeaders}
              item={item}
              onOpenPreview={() => onOpenPreview(item)}
            />
          )}
        showsVerticalScrollIndicator={false}
        style={styles.fixedList}
      />
    </View>
  );
}

/**
 * The Library's own controls, for the header row beside the back button.
 *
 * Grid or list, and a way to fetch again. They used to sit next to the search
 * field and take a third of its width; a search box people cannot type a whole
 * word into is a search box nobody uses.
 */
export function CompanyLibraryHeaderActions({
  isLoading,
  mode,
  onChangeMode,
  onRefresh
}: {
  isLoading: boolean;
  mode: CompanyLibraryViewMode;
  onChangeMode: (mode: CompanyLibraryViewMode) => void;
  onRefresh: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={libraryStyles.headerActions}>
      <View style={[libraryStyles.viewToggle, { backgroundColor: appTheme.colors.groupedCard }]}>
        {(['grid', 'list'] as CompanyLibraryViewMode[]).map((nextMode) => {
          const isActive = mode === nextMode;

          return (
            <Pressable
              accessibilityLabel={`Show Library as ${nextMode}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={nextMode}
              onPress={() => onChangeMode(nextMode)}
              style={({ pressed }) => [
                libraryStyles.viewToggleButton,
                isActive && { backgroundColor: appTheme.colors.primarySoft },
                pressed && libraryStyles.pressed
              ]}
            >
              <Feather
                color={isActive ? appTheme.colors.link : appTheme.colors.muted}
                name={nextMode === 'grid' ? 'grid' : 'list'}
                size={17}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityLabel="Refresh Library"
        accessibilityRole="button"
        disabled={isLoading}
        hitSlop={6}
        onPress={onRefresh}
        style={({ pressed }) => [
          libraryStyles.refreshButton,
          pressed && !isLoading && libraryStyles.pressed,
          isLoading && libraryStyles.disabled
        ]}
      >
        {isLoading ? (
          <ActivityIndicator color={appTheme.colors.link} size="small" />
        ) : (
          <Feather color={appTheme.colors.link} name="refresh-cw" size={19} />
        )}
      </Pressable>
    </View>
  );
}

/**
 * One filter, as a text link.
 *
 * The one in force is the app's link blue with a rule under it; the rest are
 * quiet. An outlined pill per filter, twice over, was two rows of buttons above
 * the thing they filter.
 */
function CompanyLibraryFilterLink({
  count,
  isActive,
  label,
  onPress
}: {
  count?: number;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();
  const labelText = typeof count === 'number' ? `${label} ${count}` : label;

  return (
    <Pressable
      accessibilityLabel={labelText}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [libraryStyles.filterLink, pressed && libraryStyles.pressed]}
    >
      <Text
        numberOfLines={1}
        style={[
          libraryStyles.filterLinkText,
          { color: isActive ? appTheme.colors.link : appTheme.colors.muted }
        ]}
      >
        {labelText}
      </Text>
      <View style={[
        libraryStyles.filterUnderline,
        { backgroundColor: isActive ? appTheme.colors.link : 'transparent' }
      ]} />
    </Pressable>
  );
}

function CompanyLibraryChip({
  count,
  isActive,
  label,
  onPress
}: {
  count?: number;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={androidButtonRipple}
      onPress={onPress}
      style={({ pressed }) => [
        styles.companyLibraryChip,
        {
          backgroundColor: isActive ? appTheme.colors.primarySoft : appTheme.colors.surfaceElevated,
          borderColor: isActive ? appTheme.colors.primary : appTheme.colors.border
        },
        pressed && styles.pressed
      ]}
    >
      <Text style={[
        styles.companyLibraryChipText,
        { color: isActive ? appTheme.colors.primary : appTheme.colors.ink }
      ]}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <Text style={[
          styles.companyLibraryChipCount,
          { color: isActive ? appTheme.colors.primary : appTheme.colors.muted }
        ]}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Loads a poster frame for a Library video row.
 *
 * Returns null for anything that is not a video, and while the frame is still
 * being produced, so callers fall back to the generic file icon.
 */
function useCompanyLibraryVideoPoster(
  item: CompanyLibraryItem,
  fileHeaders?: Record<string, string>
): string | null {
  const isVideo = getCompanyLibraryKind(item) === 'videos' && Boolean(item.fileUrl);
  const [posterUri, setPosterUri] = useState<string | null>(() =>
    isVideo ? getCachedCompanyLibraryVideoThumbnail(item.evidenceId) : null
  );

  useEffect(() => {
    if (!isVideo) {
      setPosterUri(null);
      return;
    }

    let isActive = true;

    void getCompanyLibraryVideoThumbnail({
      evidenceId: item.evidenceId,
      fileUrl: item.fileUrl,
      headers: fileHeaders
    }).then((nextPosterUri) => {
      if (isActive) {
        setPosterUri(nextPosterUri);
      }
    });

    const unsubscribe = subscribeCompanyLibraryVideoThumbnail(item.evidenceId, (nextPosterUri) => {
      if (isActive) {
        setPosterUri(nextPosterUri);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [fileHeaders, isVideo, item.evidenceId, item.fileUrl]);

  return posterUri;
}

function CompanyLibraryCard({
  fileHeaders,
  item,
  onOpenPreview
}: {
  fileHeaders?: Record<string, string>;
  item: CompanyLibraryItem;
  onOpenPreview: () => void;
}) {
  const appTheme = useAppTheme();
  const kind = getCompanyLibraryKind(item);
  const isPhoto = kind === 'photos' && Boolean(item.fileUrl);
  const isAudio = kind === 'audio' && Boolean(item.fileUrl);
  const isVideo = kind === 'videos' && Boolean(item.fileUrl);
  const canOpen = isPhoto || isAudio || isVideo;
  const videoPosterUri = useCompanyLibraryVideoPoster(item, fileHeaders);
  const posterUri = isVideo ? item.thumbnailUrl || videoPosterUri : null;
  const imageSource = posterUri
    ? getCompanyLibraryPhotoSource(posterUri, fileHeaders)
    : getCompanyLibraryImageSource(item, fileHeaders);
  const hasCoverImage = isPhoto || Boolean(posterUri);
  const dateLabel = formatCompanyLibraryDate(item.uploadedAtIso);
  const ownerLabel = item.uploadedByName || item.uploadedByDepartmentName || '';

  return (
    <Pressable
      accessibilityRole={hasCoverImage ? 'imagebutton' : 'button'}
      android_ripple={androidButtonRipple}
      disabled={!canOpen}
      onPress={onOpenPreview}
      style={({ pressed }) => [
        styles.companyLibraryCard,
        {
          backgroundColor: appTheme.colors.surfaceElevated,
          borderColor: appTheme.colors.border
        },
        pressed && canOpen && styles.pressed
      ]}
    >
      <View style={[
        styles.companyLibraryThumbWrap,
        { backgroundColor: appTheme.colors.surface }
      ]}>
        <Image
          resizeMode={hasCoverImage ? 'cover' : 'contain'}
          source={imageSource}
          style={styles.companyLibraryThumb}
        />
        {isVideo ? (
          <View style={styles.companyLibraryPlayOverlay}>
            <Ionicons color="#FFFFFF" name="play" size={20} />
          </View>
        ) : null}
      </View>
      <View style={styles.companyLibraryCardBody}>
        <Text numberOfLines={2} style={[styles.companyLibraryCardTitle, { color: appTheme.colors.ink }]}>
          {getCompanyLibraryDisplayName(item)}
        </Text>
        <Text numberOfLines={1} style={[styles.companyLibraryCardMeta, { color: appTheme.colors.muted }]}>
          {getCompanyLibraryKindLabel(kind)} • {formatByteCount(item.fileSizeBytes || 0)}
        </Text>
        {ownerLabel || dateLabel ? (
          <Text numberOfLines={1} style={[styles.companyLibraryCardMeta, { color: appTheme.colors.muted }]}>
            {[ownerLabel, dateLabel].filter(Boolean).join(' • ')}
          </Text>
        ) : null}
        <View style={styles.companyLibraryBadgeRow}>
          <View style={[
            styles.companyLibraryBadge,
            {
              backgroundColor: item.visibility === 'public' ? appTheme.colors.successSoft : appTheme.colors.blueSoft
            }
          ]}>
            <Text style={[
              styles.companyLibraryBadgeText,
              { color: item.visibility === 'public' ? appTheme.colors.success : appTheme.colors.blue }
            ]}>
              {item.visibility === 'public' ? 'Company' : 'Associated'}
            </Text>
          </View>
          {canOpen ? (
            <View style={[
              styles.companyLibraryBadge,
              { backgroundColor: appTheme.colors.primarySoft }
            ]}>
              <Text style={[styles.companyLibraryBadgeText, { color: appTheme.colors.primary }]}>
                {isAudio || isVideo ? 'Play' : 'Preview'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function CompanyLibraryListRow({
  fileHeaders,
  item,
  onOpenPreview
}: {
  fileHeaders?: Record<string, string>;
  item: CompanyLibraryItem;
  onOpenPreview: () => void;
}) {
  const appTheme = useAppTheme();
  const kind = getCompanyLibraryKind(item);
  const isPhoto = kind === 'photos' && Boolean(item.fileUrl);
  const isAudio = kind === 'audio' && Boolean(item.fileUrl);
  const isVideo = kind === 'videos' && Boolean(item.fileUrl);
  const canOpen = isPhoto || isAudio || isVideo;
  const videoPosterUri = useCompanyLibraryVideoPoster(item, fileHeaders);
  const posterUri = isVideo ? item.thumbnailUrl || videoPosterUri : null;
  const imageSource = posterUri
    ? getCompanyLibraryPhotoSource(posterUri, fileHeaders)
    : getCompanyLibraryImageSource(item, fileHeaders);
  const hasCoverImage = isPhoto || Boolean(posterUri);
  const dateLabel = formatCompanyLibraryDate(item.uploadedAtIso);
  const ownerLabel = item.uploadedByName || item.uploadedByDepartmentName || '';

  return (
    <Pressable
      accessibilityRole={hasCoverImage ? 'imagebutton' : 'button'}
      android_ripple={androidButtonRipple}
      disabled={!canOpen}
      onPress={onOpenPreview}
      style={({ pressed }) => [
        styles.companyLibraryListRow,
        {
          backgroundColor: appTheme.colors.surfaceElevated,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && canOpen && styles.pressed
      ]}
    >
      <View style={[
        styles.companyLibraryListThumbWrap,
        { backgroundColor: appTheme.colors.surface }
      ]}>
        <Image
          resizeMode={hasCoverImage ? 'cover' : 'contain'}
          source={imageSource}
          style={styles.companyLibraryListThumb}
        />
        {isVideo ? (
          <View style={styles.companyLibraryPlayOverlay}>
            <Ionicons color="#FFFFFF" name="play" size={14} />
          </View>
        ) : null}
      </View>
      <View style={styles.companyLibraryListBody}>
        <View style={styles.companyLibraryListTitleRow}>
          <Text numberOfLines={1} style={[styles.companyLibraryListTitle, { color: appTheme.colors.ink }]}>
            {getCompanyLibraryDisplayName(item)}
          </Text>
          <Text numberOfLines={1} style={[styles.companyLibraryListKind, { color: appTheme.colors.primary }]}>
            {getCompanyLibraryKindLabel(kind)}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.companyLibraryCardMeta, { color: appTheme.colors.muted }]}>
          {[formatByteCount(item.fileSizeBytes || 0), ownerLabel, dateLabel].filter(Boolean).join(' • ')}
        </Text>
        <View style={styles.companyLibraryListFooter}>
          <View style={[
            styles.companyLibraryBadge,
            {
              backgroundColor: item.visibility === 'public' ? appTheme.colors.successSoft : appTheme.colors.blueSoft
            }
          ]}>
            <Text style={[
              styles.companyLibraryBadgeText,
              { color: item.visibility === 'public' ? appTheme.colors.success : appTheme.colors.blue }
            ]}>
              {item.visibility === 'public' ? 'Company' : 'Associated'}
            </Text>
          </View>
          {canOpen ? (
            <View style={[
              styles.companyLibraryListPreviewCue,
              { backgroundColor: appTheme.colors.primarySoft }
            ]}>
              <Feather color={appTheme.colors.primary} name={isAudio || isVideo ? 'play-circle' : 'eye'} size={13} />
              <Text style={[styles.companyLibraryListPreviewText, { color: appTheme.colors.primary }]}>
                {isAudio || isVideo ? 'Play' : 'Preview'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function isCompanyLibraryItemAssociatedWithUser(item: CompanyLibraryItem, currentUid: string): boolean {
  return item.visibility === 'private' || Boolean(currentUid && item.uploadedByUid === currentUid);
}

function buildCompanyLibraryBuckets({
  currentUid,
  departmentName,
  groups,
  items
}: {
  currentUid: string;
  departmentName: string;
  groups: TenantGroup[];
  items: CompanyLibraryItem[];
}): CompanyLibraryBucket[] {
  const departmentBucketKey = departmentName
    ? getCompanyLibraryDepartmentBucketKey(departmentName)
    : null;
  const uniqueGroups = groups
    .filter((group) => group.status !== 'ARCHIVED')
    .filter((group, index, source) => source.findIndex((entry) => entry.groupId === group.groupId) === index);
  const baseBuckets: Array<Omit<CompanyLibraryBucket, 'count'>> = [
    { key: 'company', label: 'Company' },
    { key: 'associated', label: 'Associated with me' },
    { key: 'chats', label: 'Chats' },
    ...uniqueGroups.map((group) => ({
      key: getCompanyLibraryGroupBucketKey(group.groupId),
      label: group.name || 'Group'
    })),
    ...(departmentBucketKey ? [{ key: departmentBucketKey, label: departmentName }] : []),
    { key: 'rails', label: 'RAILS' },
    { key: 'rca', label: 'RCA' }
  ];

  return baseBuckets.map((bucket) => ({
    ...bucket,
    count: items.filter((item) => isCompanyLibraryItemInBucket({
      bucketKey: bucket.key,
      currentUid,
      departmentName,
      item
    })).length
  }));
}

function isCompanyLibraryItemInBucket({
  bucketKey,
  currentUid,
  departmentName,
  item
}: {
  bucketKey: CompanyLibraryScopeFilter;
  currentUid: string;
  departmentName: string;
  item: CompanyLibraryItem;
}): boolean {
  const sourceArea = getCompanyLibrarySourceArea(item);
  const sourceId = normalizeCompanyLibraryBucketValue(item.sourceId || '');
  const sourceLabel = normalizeCompanyLibraryBucketValue(item.sourceLabel || '');
  const scopes = getCompanyLibraryNormalizedScopes(item);

  if (bucketKey === 'company') {
    return item.visibility === 'public' || scopes.includes('company');
  }

  if (bucketKey === 'associated') {
    return isCompanyLibraryItemAssociatedWithUser(item, currentUid) || scopes.includes('associated');
  }

  if (bucketKey === 'chats') {
    return sourceArea === 'chat' || sourceArea === 'chats' || scopes.includes('chat') || scopes.includes('chats');
  }

  if (bucketKey === 'rails') {
    return sourceArea
      ? sourceArea === 'rails' || scopes.includes('rails')
      : true;
  }

  if (bucketKey === 'rca') {
    return sourceArea === 'rca' || scopes.includes('rca');
  }

  if (bucketKey.startsWith('department:')) {
    const selectedDepartment = bucketKey.replace('department:', '');
    const uploaderDepartment = normalizeCompanyLibraryBucketValue(item.uploadedByDepartmentName || '');
    const currentDepartment = normalizeCompanyLibraryBucketValue(departmentName);

    return sourceArea === 'department' && (sourceId === selectedDepartment || sourceLabel === selectedDepartment) ||
      uploaderDepartment === selectedDepartment ||
      currentDepartment === selectedDepartment && scopes.includes('department');
  }

  if (bucketKey.startsWith('group:')) {
    const selectedGroup = bucketKey.replace('group:', '');

    return sourceArea === 'group' && (sourceId === selectedGroup || sourceLabel === selectedGroup) ||
      scopes.includes(`group:${selectedGroup}`) ||
      scopes.includes(selectedGroup);
  }

  return false;
}

function getCompanyLibraryDepartmentBucketKey(departmentName: string): CompanyLibraryScopeFilter {
  return `department:${normalizeCompanyLibraryBucketValue(departmentName)}` as CompanyLibraryScopeFilter;
}

function getCompanyLibraryGroupBucketKey(groupId: string): CompanyLibraryScopeFilter {
  return `group:${normalizeCompanyLibraryBucketValue(groupId)}` as CompanyLibraryScopeFilter;
}

function getCompanyLibrarySourceArea(item: CompanyLibraryItem): string {
  return normalizeCompanyLibraryBucketValue(item.sourceArea || '');
}

function getCompanyLibraryNormalizedScopes(item: CompanyLibraryItem): string[] {
  return item.libraryScopes.map(normalizeCompanyLibraryBucketValue).filter(Boolean);
}

function getCompanyLibraryImageSource(
  item: CompanyLibraryItem,
  fileHeaders?: Record<string, string>
): ImageSourcePropType {
  const kind = getCompanyLibraryKind(item);

  if (kind === 'photos' && item.fileUrl) {
    return getCompanyLibraryPhotoSource(item.fileUrl, fileHeaders);
  }

  const extension = getCompanyLibraryExtension(item);

  return companyLibraryDocumentThumbnailSources[extension] ||
    companyLibraryDocumentThumbnailSources.document;
}

const libraryStyles = StyleSheet.create({
  // The tab surface already pays 10, and a card sits 15 from the screen edge.
  searchWrap: {
    marginHorizontal: 5
  },
  filterCard: {
    borderRadius: 22,
    marginHorizontal: 5,
    overflow: 'hidden'
  },
  filterContent: {
    alignItems: 'stretch',
    paddingHorizontal: 2
  },
  filterLink: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  filterLinkText: {
    fontSize: 14,
    lineHeight: 19
  },
  filterUnderline: {
    alignSelf: 'stretch',
    borderRadius: 1,
    height: 2,
    marginTop: 6
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  viewToggle: {
    alignItems: 'center',
    borderRadius: 19,
    flexDirection: 'row',
    gap: 2,
    padding: 3
  },
  viewToggleButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 36
  },
  refreshButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  pressed: {
    opacity: 0.6
  },
  disabled: {
    opacity: 0.4
  }
});
