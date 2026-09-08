import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CircleIconButton } from '../ui/CircleIconButton';

export interface ActionMediaItem {
  attachmentId: string;
  kind: 'image' | 'video';
  url: string;
}

/**
 * Photos and video on an action, opened in the app.
 *
 * They used to open in the browser, which drops somebody out of Synzapp to
 * look at a picture their colleague attached, and hands a signed URL to
 * whatever browser is default on that phone. This keeps both inside the app.
 *
 * Deliberately not the chat media viewer. That one is built around a chat
 * message and carries reply, forward, star and delete; an action attachment is
 * none of those things, and faking a message to reuse it would be worse than
 * a small screen that does one job.
 */
export function ActionMediaViewer({
  items,
  onClose,
  startIndex = 0,
  visible
}: {
  items: ActionMediaItem[];
  onClose: () => void;
  startIndex?: number;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setIndex(startIndex);
    // After the pager has laid out, or the jump lands on the wrong page.
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ animated: false, x: startIndex * width, y: 0 });
    }, 0);

    return () => clearTimeout(timer);
  }, [startIndex, visible, width]);

  const current = items[index];

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.backdrop}>
        <ScrollView
          horizontal
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);

            if (next !== index) {
              setIndex(next);
            }
          }}
          pagingEnabled
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
        >
          {items.map((item) => (
            <View key={item.attachmentId} style={{ height, width }}>
              {item.kind === 'video' ? (
                <ActionVideo isActive={current?.attachmentId === item.attachmentId} url={item.url} />
              ) : (
                <Image
                  resizeMode="contain"
                  source={{ uri: item.url }}
                  style={{ height, width }}
                />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
          <CircleIconButton action="close" onPress={onClose} />
          {items.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>{index + 1} of {items.length}</Text>
            </View>
          ) : null}
        </View>

        {/* Tapping the background closes, the way a photo viewer should.
            Placed behind the pager so it never eats a swipe. */}
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.tapToClose}
        />
      </View>
    </Modal>
  );
}

function ActionVideo({ isActive, url }: { isActive: boolean; url: string }) {
  const { height, width } = useWindowDimensions();
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    // Only the clip on screen plays. Without this, swiping past three videos
    // leaves three of them running at once.
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      allowsFullscreen
      nativeControls
      player={player}
      style={{ height, width }}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000000',
    flex: 1
  },
  pager: {
    flex: 1
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2
  },
  counter: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 13.5
  },
  tapToClose: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 0
  }
});
