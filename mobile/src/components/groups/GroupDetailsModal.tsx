import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ChatContact } from '../../services/chatApi';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { CircleIconButton } from '../../components/ui/CircleIconButton';
import { ListNavRow, ListSection } from '../../components/ui/GroupedList';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Naming a new group, and choosing how it is run.
 *
 * The last step before a group exists: a name, a picture, who may do what, and
 * the people already picked. Create sits in the header as a word rather than a
 * filled slab, which is where this app puts a screen's one action.
 */

export function GroupDetailsModal({
  groupName,
  groupPhotoUri,
  isOpen,
  members,
  onBack,
  onChangeGroupName,
  onCreate,
  onOpenPermissions,
  onPickPhoto,
  onRemoveMember,
  permissionMode,
  profilePhotoHeaders
}: {
  groupName: string;
  groupPhotoUri: string | null;
  isOpen: boolean;
  members: ChatContact[];
  onBack: () => void;
  onChangeGroupName: (value: string) => void;
  onCreate: () => void;
  onOpenPermissions: () => void;
  onPickPhoto: () => void;
  onRemoveMember: (contactId: string) => void;
  permissionMode: 'ADMINS' | 'ALL_MEMBERS';
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const canCreate = groupName.trim().length > 0 && members.length > 0;
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onBack}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        detailsStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={detailsStyles.header}>
          <CircleIconButton action="back" label="Back to add members" onPress={onBack} />
          <Text numberOfLines={1} style={[detailsStyles.headerTitle, { color: appTheme.colors.ink }]}>
            New group
          </Text>
          <Pressable
            accessibilityLabel="Create group"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCreate }}
            disabled={!canCreate}
            hitSlop={8}
            onPress={onCreate}
            style={({ pressed }) => [
              detailsStyles.headerAction,
              pressed && canCreate && detailsStyles.pressed,
              !canCreate && detailsStyles.disabled
            ]}
          >
            <Text style={[detailsStyles.headerActionText, { color: appTheme.colors.link }]}>
              Create
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            detailsStyles.content,
            { paddingBottom: Math.max(28, screenBottomInset + 24) }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* The picture and the name are one decision, so they share a row.
              The circle is tinted rather than filled: it stands in for a
              photograph the group does not have yet. */}
          <ListSection>
            <View style={detailsStyles.nameRow}>
              <Pressable
                accessibilityLabel="Add group photo"
                accessibilityRole="button"
                onPress={onPickPhoto}
                style={({ pressed }) => [
                  detailsStyles.photoButton,
                  { backgroundColor: appTheme.colors.primarySoft },
                  pressed && detailsStyles.pressed
                ]}
              >
                {groupPhotoUri ? (
                  <Image resizeMode="cover" source={{ uri: groupPhotoUri }} style={detailsStyles.photoImage} />
                ) : (
                  <Feather color={appTheme.colors.primary} name="camera" size={21} />
                )}
              </Pressable>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={onChangeGroupName}
                placeholder="Group name"
                placeholderTextColor={appTheme.colors.muted}
                style={[detailsStyles.nameInput, { color: appTheme.colors.ink }]}
                value={groupName}
              />
            </View>
          </ListSection>

          <ListSection>
            <ListNavRow
              icon="shield"
              onPress={onOpenPermissions}
              subtitle={permissionMode === 'ALL_MEMBERS'
                ? 'All members can participate'
                : 'Only admins can manage key actions'}
              title="Group permission"
            />
          </ListSection>

          <ListSection title={formatChosenMemberCount(members.length)}>
            <ScrollView
              contentContainerStyle={detailsStyles.membersContent}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {members.map((member) => (
                <View key={member.contactId} style={detailsStyles.memberChip}>
                  <View style={styles.groupMemberAvatarWrap}>
                    <ProfileAvatar
                      headers={profilePhotoHeaders}
                      name={member.displayName}
                      size={52}
                      uri={member.profilePhotoUrl}
                    />
                    <Pressable
                      accessibilityLabel={`Remove ${member.displayName}`}
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() => onRemoveMember(member.contactId)}
                      style={({ pressed }) => [
                        styles.groupMemberRemoveButton,
                        { borderColor: appTheme.colors.groupedCard },
                        pressed && detailsStyles.pressed
                      ]}
                    >
                      <Feather color="#FFFFFF" name="x" size={13} />
                    </Pressable>
                  </View>
                  <Text numberOfLines={2} style={[detailsStyles.memberName, { color: appTheme.colors.ink }]}>
                    {member.displayName}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </ListSection>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Says how many, so the card's heading is worth the line it takes. */
function formatChosenMemberCount(memberCount: number): string {
  return memberCount === 1 ? '1 member' : `${memberCount} members`;
}

const detailsStyles = StyleSheet.create({
  screen: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 15
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center'
  },
  headerAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44
  },
  headerActionText: {
    fontSize: 16,
    lineHeight: 21
  },
  content: {
    paddingTop: 2
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  photoButton: {
    alignItems: 'center',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52
  },
  photoImage: {
    height: '100%',
    width: '100%'
  },
  nameInput: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    minWidth: 0,
    paddingVertical: 6
  },
  membersContent: {
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  memberChip: {
    alignItems: 'center',
    width: 68
  },
  memberName: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'center'
  },
  pressed: {
    opacity: 0.6
  },
  disabled: {
    opacity: 0.35
  }
});
