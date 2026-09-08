import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';

interface AppOnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingPage {
  /** Key into AppColors, so each page stays legible in both themes. */
  accentKey: 'primary' | 'blue' | 'amber' | 'success';
  body: string;
  highlights: string[];
  icon: keyof typeof Ionicons.glyphMap;
  /** Two supporting icons that orbit the main one. */
  satelliteIcons: [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap];
  title: string;
}

const onboardingPages: OnboardingPage[] = [
  {
    accentKey: 'primary',
    body: 'Message anyone at work, one to one or in a group. Send photos, videos, documents and voice notes, and switch to a voice or video call when talking is faster than typing.',
    highlights: ['Direct and group chats', 'Photos, files and voice notes', 'Voice and video calls'],
    icon: 'chatbubbles-outline',
    satelliteIcons: ['videocam-outline', 'mic-outline'],
    title: 'Your whole team, in one place'
  },
  {
    accentKey: 'blue',
    body: 'The Interpreter listens while you speak and translates as you go, so a conversation between two languages still feels like one conversation. The written version is yours to keep afterwards.',
    highlights: ['Live interpretation', 'Speak your own language', 'Transcript and summary'],
    icon: 'language-outline',
    satelliteIcons: ['ear-outline', 'document-text-outline'],
    title: 'Everyone speaks their own language'
  },
  {
    accentKey: 'amber',
    body: 'Record a meeting and get it back as a written record with a short summary. Whatever you share in chats and meetings goes to your company Library, so you can find it again months later.',
    highlights: ['Meeting recordings', 'Written summaries', 'Shared company Library'],
    icon: 'albums-outline',
    satelliteIcons: ['recording-outline', 'search-outline'],
    title: 'Every meeting, on the record'
  },
  {
    accentKey: 'success',
    body: 'Leaders Standard Work holds the routine you run each day and week. RAILS follows the actions that come out of it and shows you what is still open, who owns it, and when it is due.',
    highlights: ['Daily and weekly routine', 'Actions with clear owners', 'See what is still open'],
    icon: 'checkmark-done-outline',
    satelliteIcons: ['calendar-outline', 'trending-up-outline'],
    title: 'Nothing falls through'
  }
];

const preparationStages = [
  'Verifying secure app shell',
  'Preparing tenant controls',
  'Loading encrypted workspace',
  'Opening verified sign in'
];

/**
 * Swipe-through introduction shown once, on first install.
 *
 * There are no navigation buttons by design - the pages are moved by swiping,
 * and swiping past the last page enters the app. A short trailing spacer after
 * the final page gives that last swipe somewhere to travel on both platforms,
 * so the gesture does not depend on iOS bounce behaviour.
 */
export function AppOnboardingScreen({ onComplete }: AppOnboardingScreenProps) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const scrollX = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const hasCompletedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const lastPageOffset = width * (onboardingPages.length - 1);
  const exitThreshold = lastPageOffset + Math.max(width * 0.12, 52);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, {
        duration: 5200,
        easing: Easing.inOut(Easing.sin),
        isInteraction: false,
        toValue: 1,
        useNativeDriver: true
      })
    );

    loop.start();

    return () => loop.stop();
  }, [drift]);

  useEffect(() => {
    const subscription = scrollX.addListener(({ value }) => {
      const nextIndex = Math.round(value / Math.max(width, 1));

      setActiveIndex((currentIndex) =>
        nextIndex !== currentIndex && nextIndex >= 0 && nextIndex < onboardingPages.length
          ? nextIndex
          : currentIndex
      );

      // Pulled past the last page - that gesture is how the intro is finished.
      if (value >= exitThreshold && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onComplete();
      }
    });

    return () => scrollX.removeListener(subscription);
  }, [exitThreshold, onComplete, scrollX, width]);

  // Plain JS scroll callbacks, which always fire. The animated listener above
  // drives the same logic during the gesture; this is what guarantees a fast
  // flick still lands, and keeps the page indicator honest even if the animated
  // value is being driven entirely on the UI thread.
  function handleScrollSettled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetX = event.nativeEvent.contentOffset.x;
    const settledIndex = Math.round(offsetX / Math.max(width, 1));

    if (settledIndex >= 0 && settledIndex < onboardingPages.length) {
      setActiveIndex(settledIndex);
    }

    if (offsetX >= exitThreshold && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brandBar}>
        <Image
          resizeMode="contain"
          source={require('../../assets/Synzapp-Nav.png')}
          style={styles.brandLogo}
        />
        <Text style={styles.brandName}>Synzapp</Text>
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ width: width * onboardingPages.length + width * 0.35 }}
        horizontal
        onMomentumScrollEnd={handleScrollSettled}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={handleScrollSettled}
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
      >
        {onboardingPages.map((page, index) => (
          <OnboardingSlide
            drift={drift}
            index={index}
            key={page.title}
            page={page}
            scrollX={scrollX}
            width={width}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {onboardingPages.map((page, index) => (
            <ProgressDot
              index={index}
              key={page.title}
              scrollX={scrollX}
              width={width}
            />
          ))}
        </View>

        <SwipeHint
          drift={drift}
          isLastPage={activeIndex === onboardingPages.length - 1}
        />
      </View>
    </SafeAreaView>
  );
}

function OnboardingSlide({
  drift,
  index,
  page,
  scrollX,
  width
}: {
  drift: Animated.Value;
  index: number;
  page: OnboardingPage;
  scrollX: Animated.Value;
  width: number;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const accent = theme.colors[page.accentKey];
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  // The artwork trails the swipe and the words lead it. That small difference in
  // speed is what gives the pages depth instead of a flat slide.
  const artStyle = {
    opacity: scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp'
    }),
    transform: [
      {
        scale: scrollX.interpolate({
          inputRange,
          outputRange: [0.82, 1, 0.82],
          extrapolate: 'clamp'
        })
      },
      {
        translateX: scrollX.interpolate({
          inputRange,
          outputRange: [width * 0.22, 0, -width * 0.22],
          extrapolate: 'clamp'
        })
      }
    ]
  };
  const copyStyle = {
    opacity: scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp'
    }),
    transform: [
      {
        translateX: scrollX.interpolate({
          inputRange,
          outputRange: [width * 0.42, 0, -width * 0.42],
          extrapolate: 'clamp'
        })
      }
    ]
  };

  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.artWrap, artStyle]}>
        <SlideArtwork accent={accent} drift={drift} page={page} />
      </Animated.View>

      <Animated.View style={[styles.copyWrap, copyStyle]}>
        <Text style={styles.slideTitle}>{page.title}</Text>
        <Text style={styles.slideBody}>{page.body}</Text>

        <View style={styles.highlights}>
          {page.highlights.map((highlight) => (
            <View key={highlight} style={styles.highlightRow}>
              <View style={[styles.highlightDot, { backgroundColor: accent }]} />
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function SlideArtwork({
  accent,
  drift,
  page
}: {
  accent: string;
  drift: Animated.Value;
  page: OnboardingPage;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const floatStyle = (distance: number, delay: number) => ({
    transform: [
      {
        translateY: drift.interpolate({
          inputRange: [0, 0.25 + delay, 0.5 + delay, 0.75 + delay, 1],
          outputRange: [0, -distance, 0, distance, 0],
          extrapolate: 'clamp'
        })
      }
    ]
  });

  return (
    <View style={styles.art}>
      <Animated.View style={[styles.artHalo, { borderColor: accent }, floatStyle(6, 0)]} />
      <Animated.View style={[styles.artCore, { backgroundColor: accent }, floatStyle(10, 0)]}>
        <Ionicons color={theme.colors.screen} name={page.icon} size={48} />
      </Animated.View>

      <Animated.View style={[styles.artChip, styles.artChipLeft, floatStyle(8, 0.12)]}>
        <Ionicons color={accent} name={page.satelliteIcons[0]} size={20} />
      </Animated.View>
      <Animated.View style={[styles.artChip, styles.artChipRight, floatStyle(7, 0.24)]}>
        <Ionicons color={accent} name={page.satelliteIcons[1]} size={20} />
      </Animated.View>
    </View>
  );
}

function ProgressDot({
  index,
  scrollX,
  width
}: {
  index: number;
  scrollX: Animated.Value;
  width: number;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  // Width is a layout property and cannot be driven natively, so the active dot
  // stretches with scaleX instead. The scroll position drives this value on the
  // UI thread; interpolating it into `width` would throw at runtime.
  return (
    <View style={styles.dotSlot}>
      <Animated.View
        style={[
          styles.dot,
          {
            opacity: scrollX.interpolate({
              inputRange,
              outputRange: [0.28, 1, 0.28],
              extrapolate: 'clamp'
            }),
            transform: [
              {
                scaleX: scrollX.interpolate({
                  inputRange,
                  outputRange: [0.27, 1, 0.27],
                  extrapolate: 'clamp'
                })
              }
            ]
          }
        ]}
      />
    </View>
  );
}

function SwipeHint({
  drift,
  isLastPage
}: {
  drift: Animated.Value;
  isLastPage: boolean;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const nudgeStyle = {
    transform: [
      {
        translateX: drift.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, 5, 0, 5, 0]
        })
      }
    ]
  };

  return (
    <Animated.View style={[styles.swipeHint, nudgeStyle]}>
      <Text style={styles.swipeHintText}>
        {isLastPage ? 'Swipe to get started' : 'Swipe to continue'}
      </Text>
      <Ionicons color={theme.colors.muted} name="chevron-forward" size={15} />
    </Animated.View>
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
        isInteraction: false,
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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    art: {
      alignItems: 'center',
      height: 210,
      justifyContent: 'center',
      width: 210
    },
    artChip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      height: 52,
      justifyContent: 'center',
      position: 'absolute',
      width: 52
    },
    artChipLeft: {
      bottom: 24,
      left: 2
    },
    artChipRight: {
      right: 4,
      top: 26
    },
    artCore: {
      alignItems: 'center',
      borderRadius: 42,
      height: 124,
      justifyContent: 'center',
      width: 124
    },
    artHalo: {
      borderRadius: 88,
      borderWidth: StyleSheet.hairlineWidth,
      height: 176,
      opacity: 0.34,
      position: 'absolute',
      width: 176
    },
    artWrap: {
      alignItems: 'center',
      justifyContent: 'center'
    },
    brandBar: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 9,
      paddingHorizontal: 28,
      paddingTop: 14
    },
    brandLogo: {
      height: 26,
      width: 26
    },
    brandName: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.2
    },
    copyWrap: {
      gap: 12,
      width: '100%'
    },
    dot: {
      backgroundColor: colors.primary,
      borderRadius: 4,
      height: 7,
      width: 26
    },
    dotSlot: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 26
    },
    dots: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center'
    },
    footer: {
      alignItems: 'center',
      gap: 18,
      paddingBottom: 26,
      paddingTop: 6
    },
    highlightDot: {
      borderRadius: 3,
      height: 6,
      width: 6
    },
    highlightRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 11
    },
    highlightText: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: 14.5,
      fontWeight: '500'
    },
    highlights: {
      gap: 11,
      paddingTop: 6
    },
    pager: {
      flex: 1
    },
    prepContent: {
      alignItems: 'center',
      flex: 1,
      gap: 12,
      justifyContent: 'center',
      paddingHorizontal: 30
    },
    prepDeck: {
      alignItems: 'center',
      height: 168,
      justifyContent: 'center',
      marginBottom: 18,
      width: 232
    },
    prepDescription: {
      color: colors.muted,
      fontSize: 14.5,
      lineHeight: 21,
      paddingHorizontal: 6,
      textAlign: 'center'
    },
    prepEyebrow: {
      color: colors.primary,
      fontSize: 11.5,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase'
    },
    prepLayerBack: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      height: 132,
      position: 'absolute',
      top: 0,
      transform: [{ scale: 0.86 }],
      width: 208
    },
    prepLayerFront: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      height: 132,
      justifyContent: 'center',
      overflow: 'hidden',
      width: 208
    },
    prepLayerMiddle: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      height: 132,
      position: 'absolute',
      top: 8,
      transform: [{ scale: 0.93 }],
      width: 208
    },
    prepLogo: {
      height: 56,
      width: 56
    },
    prepScanner: {
      backgroundColor: colors.primary,
      bottom: 0,
      opacity: 0.24,
      position: 'absolute',
      top: 0,
      width: 46
    },
    prepScreen: {
      backgroundColor: colors.background,
      flex: 1
    },
    prepStageIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      height: 24,
      justifyContent: 'center',
      width: 24
    },
    prepStageIconActive: {
      borderColor: colors.primary
    },
    prepStageIconComplete: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    prepStageRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 11
    },
    prepStageText: {
      color: colors.muted,
      fontSize: 13.5
    },
    prepStageTextActive: {
      color: colors.ink,
      fontWeight: '600'
    },
    prepStages: {
      alignSelf: 'stretch',
      gap: 12,
      paddingTop: 22
    },
    prepTitle: {
      color: colors.ink,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center'
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1
    },
    slide: {
      alignItems: 'center',
      gap: 34,
      height: '100%',
      justifyContent: 'center',
      paddingHorizontal: 30
    },
    slideBody: {
      color: colors.muted,
      fontSize: 15.5,
      lineHeight: 24
    },
    slideTitle: {
      color: colors.ink,
      fontSize: 27,
      fontWeight: '700',
      letterSpacing: -0.4,
      lineHeight: 34
    },
    swipeHint: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5
    },
    swipeHintText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '500'
    }
  });
}
