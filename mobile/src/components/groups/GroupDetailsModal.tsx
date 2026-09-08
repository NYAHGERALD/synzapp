import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ChatContact } from '../../services/chatApi';
import { Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Group details.
 *
 * Lifted out of the chat screen unchanged.
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
        styles.newChatModalScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Back to add members"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={[styles.newChatHeaderTitle, { color: appTheme.colors.ink }]}>New Group</Text>
          <Pressable
            accessibilityLabel="Create group"
            accessibilityRole="button"
            disabled={!canCreate}
            onPress={onCreate}
            style={({ pressed }) => [
              styles.newChatNextButton,
              pressed && canCreate && styles.pressed,
              !canCreate && styles.disabled
            ]}
          >
            <Text style={styles.newChatNextText}>Create</Text>
          </Pressable>
        </View>

        <View style={[styles.groupNameRow, { borderBottomColor: appTheme.colors.divider }]}>
          <Pressable
            accessibilityLabel="Add group photo"
            accessibilityRole="button"
            onPress={onPickPhoto}
            style={({ pressed }) => [
              styles.groupPhotoButton,
              { backgroundColor: appTheme.colors.primarySoft },
              pressed && styles.pressed
            ]}
          >
            {groupPhotoUri ? (
              <Image resizeMode="cover" source={{ uri: groupPhotoUri }} style={styles.groupPhotoImage} />
            ) : (
              <Ionicons color={appTheme.colors.primary} name="camera" size={23} />
            )}
          </Pressable>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={onChangeGroupName}
            placeholder="Group name"
            placeholderTextColor={appTheme.colors.muted}
            style={[styles.groupNameInput, { color: appTheme.colors.ink }]}
            value={groupName}
          />
        </View>

        <Pressable
          accessibilityLabel="Open group permissions"
          accessibilityRole="button"
          onPress={onOpenPermissions}
          style={({ pressed }) => [
            styles.groupPermissionRow,
            {
              backgroundColor: appTheme.colors.screen,
              borderBottomColor: appTheme.colors.divider
            },
            pressed && styles.pressed
          ]}
        >
          <View>
            <Text style={[styles.groupPermissionTitle, { color: appTheme.colors.ink }]}>Group permission</Text>
            <Text style={[styles.groupPermissionSubtitle, { color: appTheme.colors.muted }]}>
              {permissionMode === 'ALL_MEMBERS'
                ? 'All members can participate'
                : 'Only admins can manage key actions'}
            </Text>
          </View>
          <Feather color={appTheme.colors.muted} name="chevron-right" size={20} />
        </Pressable>

        <Text style={[styles.groupMembersTitle, { color: appTheme.colors.muted }]}>Members</Text>
        <ScrollView
          contentContainerStyle={styles.groupMembersContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {members.map((member) => (
            <View key={member.contactId} style={styles.groupMemberChip}>
              <View style={styles.groupMemberAvatarWrap}>
                <ProfileAvatar
                  headers={profilePhotoHeaders}
                  name={member.displayName}
                  size={54}
                  uri={member.profilePhotoUrl}
                />
                <Pressable
                  accessibilityLabel={`Remove ${member.displayName}`}
                  accessibilityRole="button"
                  onPress={() => onRemoveMember(member.contactId)}
                  style={({ pressed }) => [styles.groupMemberRemoveButton, pressed && styles.pressed]}
                >
                  <Feather color="#FFFFFF" name="x" size={13} />
                </Pressable>
              </View>
              <Text numberOfLines={2} style={[styles.groupMemberName, { color: appTheme.colors.ink }]}>{member.displayName}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
