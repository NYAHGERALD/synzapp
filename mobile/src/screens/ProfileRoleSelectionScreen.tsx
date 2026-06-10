import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { signOutOrgAdmin } from '../services/phoneAuth';
import { ProfileRoleSelection, VerifiedOrgAdmin } from '../types/auth';
import { colors } from '../theme/colors';

interface ProfileRoleSelectionScreenProps {
  verifiedAdmin: VerifiedOrgAdmin;
  onSelectRole: (role: ProfileRoleSelection) => void;
  onSignOut: () => void;
}

export function ProfileRoleSelectionScreen({
  verifiedAdmin,
  onSelectRole,
  onSignOut
}: ProfileRoleSelectionScreenProps) {
  async function handleSignOut() {
    await signOutOrgAdmin();
    onSignOut();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.brand}>
          <Image
            source={require('../../assets/Synzapp-Splash-screen.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.status}>Phone verified {verifiedAdmin.session.user.phoneMasked}</Text>
          <Text style={styles.title}>Who are you?</Text>
        </View>

        <View style={styles.options}>
          <RoleOption
            title="Organization Admin"
            description="Create and manage a company workspace."
            onPress={() => onSelectRole('ORG_ADMIN')}
          />
          <RoleOption
            title="Employee"
            description="Join a company workspace after approval."
            onPress={() => onSelectRole('EMPLOYEE')}
          />
        </View>

        <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface RoleOptionProps {
  title: string;
  description: string;
  onPress: () => void;
}

function RoleOption({ title, description, onPress }: RoleOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleOption,
        pressed && styles.pressed
      ]}
    >
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <Text style={styles.optionAction}>Select</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    minHeight: 720,
    overflow: 'hidden'
  },
  content: {
    flex: 1,
    gap: 24,
    justifyContent: 'center',
    paddingBottom: 34,
    paddingHorizontal: 34,
    paddingTop: 52
  },
  brand: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34
  },
  splashLogo: {
    height: 76,
    width: 230
  },
  header: {
    gap: 8
  },
  status: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 33
  },
  options: {
    gap: 12,
    marginTop: 6
  },
  roleOption: {
    alignItems: 'center',
    borderBottomColor: 'rgba(15, 118, 110, 0.35)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 2,
    paddingVertical: 10
  },
  optionText: {
    flex: 1,
    gap: 5
  },
  optionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 23
  },
  optionDescription: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  optionAction: {
    color: '#4F6FEA',
    fontSize: 16,
    fontWeight: '400'
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18
  },
  secondaryButtonText: {
    color: '#253244',
    fontSize: 16,
    fontWeight: '400'
  },
  pressed: {
    opacity: 0.78
  }
});
