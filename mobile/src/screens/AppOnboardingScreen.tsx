import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Button } from '../components/Button';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';

interface AppOnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingPage {
  accent: string;
  body: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  points: string[];
  title: string;
}

const onboardingPages: OnboardingPage[] = [
  {
    accent: '#0F766E',
    body: 'Synzapp connects leaders, teams, action loops, and secure conversations in one controlled workspace.',
    detail: 'Built for work that needs ownership, evidence, and accountability.',
    icon: 'business-outline',
    points: ['Company workspace', 'Role-based access', 'Enterprise records'],
    title: 'Run your work from one trusted place'
  },
  {
    accent: '#2563EB',
    body: 'LSW, RCA, and RAILS work together so observations can become root-cause learning and verified action.',
    detail: 'Every step is designed to reduce missed handoffs.',
    icon: 'git-network-outline',
    points: ['Leaders Standard Work', 'Root Cause Analysis', 'Verified action loops'],
    title: 'Move from signal to action'
  },
  {
    accent: '#7C3AED',
    body: 'Evidence, call events, approvals, and activity history are handled with audit-ready controls.',
    detail: 'Managers see what changed, who changed it, and when it happened.',
    icon: 'shield-checkmark-outline',
    points: ['Evidence library', 'Secure calls', 'Audit trail'],
    title: 'Protect the process'
  },
  {
    accent: '#EA580C',
    body: 'The installed app talks directly to Synzapp cloud services. No local development server is needed for real testing builds.',
    detail: 'After onboarding, sign in with your verified phone number.',
    icon: 'cloud-done-outline',
    points: ['Render-backed API', 'Push notifications', 'Native mobile build'],
    title: 'Ready for real app use'
  }
];

export function AppOnboardingScreen({ onComplete }: AppOnboardingScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [pageIndex, setPageIndex] = useState(0);
  const page = onboardingPages[pageIndex];
  const isLastPage = pageIndex === onboardingPages.length - 1;

  function goNext() {
    if (isLastPage) {
      onComplete();
      return;
    }

    setPageIndex((currentPageIndex) => Math.min(currentPageIndex + 1, onboardingPages.length - 1));
  }

  function goBack() {
    setPageIndex((currentPageIndex) => Math.max(currentPageIndex - 1, 0));
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            resizeMode="contain"
            source={require('../../assets/Synzapp-Nav.png')}
            style={styles.logo}
          />
          <View>
            <Text style={styles.brandName}>Synzapp</Text>
            <Text style={styles.brandMeta}>Enterprise performance suite</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onComplete}
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.iconShell, { backgroundColor: `${page.accent}18` }]}>
            <View style={[styles.iconCore, { backgroundColor: page.accent }]}>
              <Ionicons color="#FFFFFF" name={page.icon} size={34} />
            </View>
          </View>

          <View style={styles.orbitOne} />
          <View style={styles.orbitTwo} />
          <View style={styles.orbitThree} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Enterprise onboarding</Text>
          <Text style={styles.title}>{page.title}</Text>
          <Text style={styles.body}>{page.body}</Text>
          <Text style={styles.detail}>{page.detail}</Text>
        </View>

        <View style={styles.points}>
          {page.points.map((point) => (
            <View key={point} style={styles.pointRow}>
              <View style={[styles.pointIcon, { borderColor: page.accent }]}>
                <Ionicons color={page.accent} name="checkmark" size={15} />
              </View>
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.progressRow}>
          {onboardingPages.map((item, index) => (
            <View
              key={item.title}
              style={[
                styles.progressDot,
                index === pageIndex && { backgroundColor: page.accent, width: 30 },
                index < pageIndex && { backgroundColor: theme.colors.success }
              ]}
            />
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            disabled={pageIndex === 0}
            onPress={goBack}
            style={({ pressed }) => [
              styles.backButton,
              pageIndex === 0 && styles.disabledButton,
              pressed && pageIndex !== 0 && styles.pressed
            ]}
          >
            <Ionicons color={theme.colors.mutedStrong} name="arrow-back" size={20} />
          </Pressable>

          <Button
            label={isLastPage ? 'Start sign in' : 'Continue'}
            onPress={goNext}
            style={styles.continueButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    actionRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12
    },
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      width: 58
    },
    body: {
      color: colors.mutedStrong,
      fontSize: 17,
      lineHeight: 25
    },
    brandMeta: {
      color: colors.muted,
      fontSize: 12,
      letterSpacing: 0,
      textTransform: 'uppercase'
    },
    brandName: {
      color: colors.ink,
      fontSize: 20,
      fontWeight: '500'
    },
    brandRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 22,
      paddingVertical: 18
    },
    continueButton: {
      borderRadius: 18,
      flex: 1
    },
    copy: {
      gap: 10,
      marginTop: 28
    },
    detail: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21
    },
    disabledButton: {
      opacity: 0.35
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      letterSpacing: 4,
      textTransform: 'uppercase'
    },
    footer: {
      backgroundColor: colors.background,
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      gap: 16,
      paddingHorizontal: 22,
      paddingVertical: 16
    },
    header: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14
    },
    hero: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 42,
      borderWidth: 1,
      height: 260,
      justifyContent: 'center',
      overflow: 'hidden',
      width: '100%'
    },
    iconCore: {
      alignItems: 'center',
      borderRadius: 28,
      height: 74,
      justifyContent: 'center',
      width: 74
    },
    iconShell: {
      alignItems: 'center',
      borderRadius: 46,
      height: 116,
      justifyContent: 'center',
      width: 116,
      zIndex: 2
    },
    logo: {
      height: 42,
      width: 42
    },
    orbitOne: {
      backgroundColor: colors.primarySoft,
      borderRadius: 88,
      height: 176,
      opacity: 0.75,
      position: 'absolute',
      right: -54,
      top: -44,
      width: 176
    },
    orbitThree: {
      backgroundColor: colors.successSoft,
      borderRadius: 70,
      bottom: -38,
      height: 140,
      opacity: 0.9,
      position: 'absolute',
      right: 52,
      width: 140
    },
    orbitTwo: {
      backgroundColor: colors.blueSoft,
      borderRadius: 80,
      bottom: -42,
      height: 160,
      left: -48,
      opacity: 0.85,
      position: 'absolute',
      width: 160
    },
    pointIcon: {
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      height: 24,
      justifyContent: 'center',
      width: 24
    },
    pointRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12
    },
    pointText: {
      color: colors.ink,
      flex: 1,
      fontSize: 15,
      lineHeight: 21
    },
    points: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 14,
      marginTop: 22,
      padding: 18
    },
    pressed: {
      opacity: 0.78
    },
    progressDot: {
      backgroundColor: colors.border,
      borderRadius: 5,
      height: 10,
      width: 10
    },
    progressRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center'
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1
    },
    skipButton: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 9
    },
    skipText: {
      color: colors.mutedStrong,
      fontSize: 14
    },
    title: {
      color: colors.ink,
      fontSize: 32,
      fontWeight: '500',
      letterSpacing: 0,
      lineHeight: 38
    }
  });
}
