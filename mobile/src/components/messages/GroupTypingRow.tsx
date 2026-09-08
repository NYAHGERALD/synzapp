import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import type { ChatGroupMember } from '../../services/chatApi';
import { describeGroupTypingRow, type TypingParticipant } from '../../services/typingIndicator';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Who is writing, above the composer, in a group.
 *
 * Group chats only, and deliberately. In a one-to-one you already know who is
 * typing — a name and a face there would only repeat the header back at you.
 * In a group, the name is the whole point: three people are in the thread and
 * the useful fact is which of them is about to speak.
 *
 * It sits above the composer rather than in the message list so it never scrolls
 * away, and never becomes a bubble that looks like a message somebody sent.
 */

export function GroupTypingRow({
  members,
  participants,
  profilePhotoHeaders
}: {
  members: ChatGroupMember[];
  participants: TypingParticipant[];
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  // Re-read the clock on every render rather than once, so a notice whose
  // sender went quiet disappears on the next tick instead of at mount time.
  const row = describeGroupTypingRow({ nowMs: Date.now(), participants });

  if (!row) {
    return null;
  }

  return (
    <View style={[styles.row, { backgroundColor: appTheme.colors.chatBackground }]}>
      <View style={styles.faces}>
        {row.typists.map((typist, index) => (
          <TypingFace
            headers={profilePhotoHeaders}
            key={typist.uid}
            member={members.find((member) => member.uid === typist.uid)}
            name={typist.name}
            // Overlapped, so two faces cost barely more width than one.
            offset={index}
          />
        ))}
      </View>
      <Text numberOfLines={1} style={[styles.text, { color: appTheme.colors.muted }]}>
        {row.text}
      </Text>
      <TypingDots color={appTheme.colors.muted} />
    </View>
  );
}

function TypingFace({
  headers,
  member,
  name,
  offset
}: {
  headers?: Record<string, string>;
  member?: ChatGroupMember;
  name: string;
  offset: number;
}) {
  const appTheme = useAppTheme();
  const photoUrl = member?.profilePhotoUrl || null;
  // Built from the values rather than inline, because a new source object on
  // every render makes Android refetch the image and the initials flash
  // through underneath.
  const source = useMemo(
    () => (photoUrl ? { headers, uri: photoUrl } : null),
    [headers, photoUrl]
  );

  return (
    <View
      style={[
        styles.face,
        {
          backgroundColor: appTheme.colors.primarySoft,
          borderColor: appTheme.colors.chatBackground,
          marginLeft: offset ? -8 : 0
        }
      ]}
    >
      {source ? (
        <Image source={source} style={styles.faceImage} />
      ) : (
        <Text style={[styles.faceInitials, { color: appTheme.colors.primary }]}>
          {member?.initials || initialsFrom(name)}
        </Text>
      )}
    </View>
  );
}

/**
 * Three dots, rising in turn.
 *
 * The animation is the part that says "still happening". A static row of dots
 * reads as a message that failed to load.
 */
function TypingDots({ color }: { color: string }) {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = values.map((value, index) => Animated.loop(
      Animated.sequence([
        Animated.delay(index * 140),
        Animated.timing(value, {
          duration: 320,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(value, {
          duration: 320,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true
        }),
        Animated.delay((2 - index) * 140)
      ])
    ));

    animations.forEach((animation) => animation.start());

    return () => animations.forEach((animation) => animation.stop());
  }, [values]);

  return (
    <View style={styles.dots}>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{
                translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -3] })
              }]
            }
          ]}
        />
      ))}
    </View>
  );
}

function initialsFrom(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 6
  },
  faces: {
    flexDirection: 'row'
  },
  face: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 22
  },
  faceImage: {
    height: '100%',
    width: '100%'
  },
  faceInitials: {
    fontSize: 9
  },
  text: {
    flexShrink: 1,
    fontSize: 13
  },
  dots: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    height: 12
  },
  dot: {
    borderRadius: 2,
    height: 4,
    width: 4
  }
});
