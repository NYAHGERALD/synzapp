import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';

interface AppOnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingPage {
  accent: string;
  body: string;
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  metrics: Array<{
    label: string;
    value: string;
  }>;
  title: string;
}

const onboardingPages: OnboardingPage[] = [
  {
    accent: '#0F766E',
    body: 'Synzapp opens a secure company workspace where leaders, managers, and employees work from one verified operating system.',
    eyebrow: 'Secure Workspace',
    icon: 'shield-checkmark-outline',
    metrics: [
      { label: 'Tenant identity', value: 'Verified' },
      { label: 'Access model', value: 'Role-based' },
      { label: 'Workspace', value: 'Cloud-ready' }
    ],
    title: 'Start with trust before work begins'
  },
  {
    accent: '#2563EB',
    body: 'LSW captures the operating signal, RCA turns it into learning, and RAILS drives accountable action to closure.',
    eyebrow: 'Connected Flow',
    icon: 'git-network-outline',
    metrics: [
      { label: 'LSW', value: 'Observe' },
      { label: 'RCA', value: 'Analyze' },
      { label: 'RAILS', value: 'Control' }
    ],
    title: 'Move from signal to verified action'
  },
  {
    accent: '#7C3AED',
    body: 'Evidence, approvals, audit history, and controlled call events are kept together so managers know what changed and why.',
    eyebrow: 'Governed Evidence',
    icon: 'folder-open-outline',
    metrics: [
      { label: 'Evidence', value: 'Centralized' },
      { label: 'History', value: 'Audited' },
      { label: 'Calls', value: 'Native' }
    ],
    title: 'Protect every decision with context'
  },
  {
    accent: '#EA580C',
    body: 'This installed build talks directly to Synzapp cloud services. No QR code or local development server is required.',
    eyebrow: 'Production Path',
    icon: 'cloud-done-outline',
    metrics: [
      { label: 'API', value: 'Render' },
      { label: 'Push', value: 'Native' },
      { label: 'Login', value: 'Verified' }
    ],
    title: 'Ready to enter the real app'
  }
];

const preparationStages = [
  'Verifying secure app shell',
  'Preparing tenant controls',
  'Loading encrypted workspace',
  'Opening verified sign in'
];

export function AppOnboardingScreen({ onComplete }: AppOnboardingScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [pageIndex, setPageIndex] = useState(0);
  const transition = useRef(new Animated.Value(1)).current;
  const motion = useRef(new Animated.Value(0)).current;
  const page = onboardingPages[pageIndex];
  const isLastPage = pageIndex === onboardingPages.length - 1;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(motion, {
        duration: 5200,
        easing: Easing.inOut(Easing.sin),
        toValue: 1,
        useNativeDriver: true
      })
    );

    loop.start();

    return () => loop.stop();
  }, [motion]);

  function changePage(nextPageIndex: number) {
    Animated.timing(transition, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      toValue: 0,
      useNativeDriver: true
    }).start(() => {
      setPageIndex(nextPageIndex);
      Animated.spring(transition, {
        damping: 16,
        mass: 0.8,
        stiffness: 140,
        toValue: 1,
        useNativeDriver: true
      }).start();
    });
  }

  function goNext() {
    if (isLastPage) {
      onComplete();
      return;
    }

    changePage(pageIndex + 1);
  }

  function goBack() {
    if (pageIndex > 0) {
      changePage(pageIndex - 1);
    }
  }

  const animatedContentStyle = {
    opacity: transition,
    transform: [
      {
        translateY: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0]
        })
      },
      {
        scale: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1]
        })
      }
    ]
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <Image
            resizeMode="contain"
            source={require('../../assets/Synzapp-Nav.png')}
            style={styles.logo}
          />
          <View style={styles.brandCopy}>
            <Text style={styles.brandTitle}>Synzapp</Text>
            <Text style={styles.brandSubtitle}>Enterprise performance suite</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onComplete}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <Text style={styles.textButtonLabel}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Animated.View style={[styles.stage, animatedContentStyle]}>
          <EnterpriseMotionStage accent={page.accent} motion={motion} page={page} />
        </Animated.View>

        <Animated.View style={[styles.copy, animatedContentStyle]}>
          <Text style={[styles.eyebrow, { color: page.accent }]}>{page.eyebrow}</Text>
          <Text style={styles.title}>{page.title}</Text>
          <Text style={styles.description}>{page.body}</Text>
        </Animated.View>

        <Animated.View style={[styles.metrics, animatedContentStyle]}>
          {page.metrics.map((metric) => (
            <View key={metric.label} style={styles.metricItem}>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.progressTrack}>
          {onboardingPages.map((item, index) => (
            <View
              key={item.title}
              style={[
                styles.progressSegment,
                index <= pageIndex && { backgroundColor: page.accent }
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={pageIndex === 0}
            onPress={goBack}
            style={({ pressed }) => [
              styles.iconButton,
              pageIndex === 0 && styles.disabled,
              pressed && pageIndex !== 0 && styles.pressed
            ]}
          >
            <Ionicons color={theme.colors.mutedStrong} name="chevron-back" size={22} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={goNext}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: page.accent },
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.primaryButtonLabel}>{isLastPage ? 'Start secure sign in' : 'Continue'}</Text>
            <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export function SecureLoginPreparationScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const pulse = useRef(new Animated.Value(0)).current;
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        duration: 2600,
        easing: Easing.inOut(Easing.sin),
        toValue: 1,
        useNativeDriver: true
      })
    );
    const interval = setInterval(() => {
      setActiveStage((currentStage) => (currentStage + 1) % preparationStages.length);
    }, 1200);

    loop.start();

    return () => {
      clearInterval(interval);
      loop.stop();
    };
  }, [pulse]);

  const deckStyle = {
    transform: [
      {
        translateY: pulse.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -10, 0]
        })
      },
      {
        rotateX: pulse.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['0deg', '5deg', '0deg']
        })
      }
    ]
  };

  return (
    <SafeAreaView style={styles.prepScreen}>
      <View style={styles.prepContent}>
        <Animated.View style={[styles.prepDeck, deckStyle]}>
          <View style={styles.prepLayerBack} />
          <View style={styles.prepLayerMiddle} />
          <View style={styles.prepLayerFront}>
            <Image
              resizeMode="contain"
              source={require('../../assets/Synzapp-Nav.png')}
              style={styles.prepLogo}
            />
            <Animated.View
              style={[
                styles.prepScanner,
                {
                  transform: [
                    {
                      translateX: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-112, 112]
                      })
                    }
                  ]
                }
              ]}
            />
          </View>
        </Animated.View>

        <Text style={styles.prepEyebrow}>Secure launch</Text>
        <Text style={styles.prepTitle}>Preparing your sign in</Text>
        <Text style={styles.prepDescription}>
          Synzapp is checking the app shell, tenant controls, and secure workspace before opening login.
        </Text>

        <View style={styles.prepStages}>
          {preparationStages.map((stage, index) => {
            const isComplete = index < activeStage;
            const isActive = index === activeStage;

            return (
              <View key={stage} style={styles.prepStageRow}>
                <View style={[
                  styles.prepStageIcon,
                  isComplete && styles.prepStageIconComplete,
                  isActive && styles.prepStageIconActive
                ]}>
                  <Ionicons
                    color={isComplete ? '#FFFFFF' : isActive ? theme.colors.primary : theme.colors.muted}
                    name={isComplete ? 'checkmark' : 'ellipse-outline'}
                    size={15}
                  />
                </View>
                <Text style={[styles.prepStageText, isActive && styles.prepStageTextActive]}>{stage}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function EnterpriseMotionStage({
  accent,
  motion,
  page
}: {
  accent: string;
  motion: Animated.Value;
  page: OnboardingPage;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const scanStyle = {
    opacity: motion.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.28, 0.82, 0.28]
    }),
    transform: [
      {
        translateX: motion.interpolate({
          inputRange: [0, 1],
          outputRange: [-140, 140]
        })
      }
    ]
  };
  const deckStyle = {
    transform: [
      { perspective: 900 },
      {
        rotateY: motion.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['-5deg', '5deg', '-5deg']
        })
      },
      {
        rotateX: motion.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['4deg', '-3deg', '4deg']
        })
      }
    ]
  };

  return (
    <Animated.View style={[styles.motionDeck, deckStyle]}>
      <View style={styles.motionHeader}>
        <Image
          resizeMode="contain"
          source={require('../../assets/Synzapp-Nav.png')}
          style={styles.motionLogo}
        />
        <View style={styles.motionTitleGroup}>
          <Text style={styles.motionTitle}>Synzapp command layer</Text>
          <Text style={styles.motionMeta}>Live enterprise readiness</Text>
        </View>
        <View style={[styles.motionStatus, { backgroundColor: `${accent}18` }]}>
          <Ionicons color={accent} name={page.icon} size={17} />
        </View>
      </View>

      <View style={styles.pipeline}>
        {['LSW', 'RCA', 'RAILS'].map((item, index) => (
          <React.Fragment key={item}>
            <View style={[styles.pipelineNode, index === page.metrics.length - 1 && { borderColor: accent }]}>
              <Text style={styles.pipelineText}>{item}</Text>
            </View>
            {index < 2 ? <View style={[styles.pipelineLine, { backgroundColor: accent }]} /> : null}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.readinessPanel}>
        {page.metrics.map((metric, index) => (
          <View key={metric.label} style={styles.readinessRow}>
            <View style={[styles.readinessMarker, { backgroundColor: index === 0 ? accent : theme.colors.border }]} />
            <View style={styles.readinessCopy}>
              <Text style={styles.readinessValue}>{metric.value}</Text>
              <Text style={styles.readinessLabel}>{metric.label}</Text>
            </View>
          </View>
        ))}
      </View>

      <Animated.View style={[styles.scanLine, { backgroundColor: accent }, scanStyle]} />
    </Animated.View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 22,
      paddingVertical: 18
    },
    brand: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 1,
      gap: 12
    },
    brandCopy: {
      flexShrink: 1
    },
    brandSubtitle: {
      color: colors.muted,
      fontSize: 12,
      letterSpacing: 0,
      textTransform: 'uppercase'
    },
    brandTitle: {
      color: colors.ink,
      fontSize: 20,
      fontWeight: '400'
    },
    copy: {
      gap: 10,
      marginTop: 26
    },
    description: {
      color: colors.mutedStrong,
      fontSize: 17,
      lineHeight: 25
    },
    disabled: {
      opacity: 0.34
    },
    eyebrow: {
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
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      width: 58
    },
    logo: {
      height: 42,
      width: 42
    },
    metricItem: {
      flex: 1,
      gap: 4,
      minWidth: 0
    },
    metricLabel: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 16
    },
    metricValue: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20
    },
    metrics: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      marginTop: 22,
      padding: 16,
      shadowColor: '#0F172A',
      shadowOffset: { height: 16, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 28
    },
    motionDeck: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 34,
      borderWidth: 1,
      minHeight: 292,
      overflow: 'hidden',
      padding: 18,
      shadowColor: '#0F172A',
      shadowOffset: { height: 26, width: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 36
    },
    motionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12
    },
    motionLogo: {
      height: 42,
      width: 42
    },
    motionMeta: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 16
    },
    motionStatus: {
      alignItems: 'center',
      borderRadius: 16,
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    motionTitle: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20
    },
    motionTitleGroup: {
      flex: 1
    },
    pipeline: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 28
    },
    pipelineLine: {
      height: 2,
      opacity: 0.7,
      width: 28
    },
    pipelineNode: {
      alignItems: 'center',
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      paddingHorizontal: 18
    },
    pipelineText: {
      color: colors.ink,
      fontSize: 13,
      letterSpacing: 1.5
    },
    prepContent: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24
    },
    prepDeck: {
      alignSelf: 'center',
      height: 186,
      marginBottom: 34,
      width: 250
    },
    prepDescription: {
      color: colors.mutedStrong,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 10,
      textAlign: 'center'
    },
    prepEyebrow: {
      color: colors.primary,
      fontSize: 12,
      letterSpacing: 4,
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    prepLayerBack: {
      backgroundColor: colors.blueSoft,
      borderColor: colors.border,
      borderRadius: 32,
      borderWidth: 1,
      bottom: 10,
      left: 38,
      position: 'absolute',
      right: 8,
      top: 34,
      transform: [{ rotate: '5deg' }]
    },
    prepLayerFront: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 34,
      borderWidth: 1,
      bottom: 22,
      justifyContent: 'center',
      left: 20,
      overflow: 'hidden',
      position: 'absolute',
      right: 20,
      top: 12
    },
    prepLayerMiddle: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: 32,
      borderWidth: 1,
      bottom: 24,
      left: 10,
      position: 'absolute',
      right: 28,
      top: 24,
      transform: [{ rotate: '-6deg' }]
    },
    prepLogo: {
      height: 78,
      width: 128
    },
    prepScanner: {
      bottom: 0,
      opacity: 0.46,
      position: 'absolute',
      top: 0,
      width: 34
    },
    prepScreen: {
      backgroundColor: colors.background,
      flex: 1
    },
    prepStageIcon: {
      alignItems: 'center',
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 13,
      borderWidth: 1,
      height: 26,
      justifyContent: 'center',
      width: 26
    },
    prepStageIconActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    prepStageIconComplete: {
      backgroundColor: colors.success,
      borderColor: colors.success
    },
    prepStageRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12
    },
    prepStageText: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: 14,
      lineHeight: 20
    },
    prepStageTextActive: {
      color: colors.ink
    },
    prepStages: {
      alignSelf: 'stretch',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 14,
      marginTop: 28,
      padding: 18
    },
    prepTitle: {
      color: colors.ink,
      fontSize: 30,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 36,
      marginTop: 8,
      textAlign: 'center'
    },
    pressed: {
      opacity: 0.78
    },
    primaryButton: {
      alignItems: 'center',
      borderRadius: 18,
      flex: 1,
      flexDirection: 'row',
      gap: 10,
      height: 54,
      justifyContent: 'center',
      paddingHorizontal: 18
    },
    primaryButtonLabel: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '400'
    },
    progressSegment: {
      backgroundColor: colors.border,
      borderRadius: 4,
      flex: 1,
      height: 7
    },
    progressTrack: {
      flexDirection: 'row',
      gap: 7
    },
    readinessCopy: {
      flex: 1
    },
    readinessLabel: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 16
    },
    readinessMarker: {
      borderRadius: 5,
      height: 10,
      marginTop: 5,
      width: 10
    },
    readinessPanel: {
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: 12,
      marginTop: 26,
      padding: 16
    },
    readinessRow: {
      flexDirection: 'row',
      gap: 10
    },
    readinessValue: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 19
    },
    scanLine: {
      bottom: 0,
      opacity: 0.5,
      position: 'absolute',
      top: 0,
      width: 28
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1
    },
    stage: {
      minHeight: 292
    },
    textButton: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 9
    },
    textButtonLabel: {
      color: colors.mutedStrong,
      fontSize: 14
    },
    title: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 40
    },
    topBar: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14
    }
  });
}
