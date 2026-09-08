import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildCapturedChatMedia,
  describeRecordingLength,
  type CapturedChatMedia
} from '../../services/chatCameraCapture';

/**
 * The camera, inside the app.
 *
 * Handing the job to the system picker is what made recording a video slow and
 * its poster late. The picker copies the recording out of the camera before it
 * returns, and it returns nothing but a file, so the still frame in the bubble
 * had to be dug back out of that file: parse the container, seek, decode a
 * frame. Measured on a Galaxy S23 FE that was several seconds, and no amount of
 * tuning moved it, because the work should never have been done at all.
 *
 * WhatsApp, Telegram and Teams all run their own camera for this reason. When
 * the shutter is held, the frame already on screen is kept, and it becomes the
 * poster the moment recording starts. Nothing is extracted, nothing is copied,
 * and the orientation and which lens took it are known rather than guessed.
 *
 * Tap for a photo, hold to record, which is the gesture people already know.
 */
export function ChatCameraModal({
  onCancel,
  onCaptured,
  visible
}: {
  onCancel: () => void;
  onCaptured: (media: CapturedChatMedia) => void;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);

  const cameraRef = useRef<CameraView | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const didStartRecordingRef = useRef(false);
  // The frame taken the instant recording begins. This is the poster, and it
  // costs nothing because the camera is already showing it.
  const posterRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef(0);
  const facingRef = useRef<'back' | 'front'>('back');

  facingRef.current = facing;

  const hasPermission = cameraPermission?.granted === true;
  const styles = useMemo(() => createStyles(), []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (!cameraPermission?.granted) {
      void requestCameraPermission();
    }

    if (!microphonePermission?.granted) {
      void requestMicrophonePermission();
    }
  }, [
    cameraPermission?.granted,
    microphonePermission?.granted,
    requestCameraPermission,
    requestMicrophonePermission,
    visible
  ]);

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!visible) {
      clearTimers();
      isRecordingRef.current = false;
      didStartRecordingRef.current = false;
      posterRef.current = null;
      setIsRecording(false);
      setIsBusy(false);
      setRecordedSeconds(0);
      setIsTorchOn(false);
    }
  }, [clearTimers, visible]);

  const takePhoto = useCallback(async () => {
    const camera = cameraRef.current;

    if (!camera || isBusy) {
      return;
    }

    setIsBusy(true);

    try {
      const picture = await camera.takePictureAsync({ quality: 0.9, skipProcessing: false });

      if (picture?.uri) {
        onCaptured(buildCapturedChatMedia({
          capturedAtMs: Date.now(),
          facing: facingRef.current,
          height: picture.height,
          kind: 'image',
          uri: picture.uri,
          width: picture.width
        }));
      }
    } catch {
      // A capture that fails leaves the camera open rather than closing on an
      // error nobody can act on.
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onCaptured]);

  const startRecording = useCallback(async () => {
    const camera = cameraRef.current;

    if (!camera || isRecordingRef.current) {
      return;
    }

    isRecordingRef.current = true;
    didStartRecordingRef.current = true;
    recordingStartedAtRef.current = Date.now();
    setIsRecording(true);
    setRecordedSeconds(0);

    tickTimerRef.current = setInterval(() => {
      setRecordedSeconds((current) => current + 1);
    }, 1000);

    // The poster, taken from the frame on screen before a single byte of video
    // is written. This is the whole reason the camera lives in the app.
    void camera
      .takePictureAsync({ base64: true, quality: 0.5, skipProcessing: true })
      .then((picture) => {
        posterRef.current = picture?.base64
          ? `data:image/jpeg;base64,${picture.base64}`
          : null;
      })
      .catch(() => {
        posterRef.current = null;
      });

    try {
      const recording = await camera.recordAsync({ maxDuration: 600 });

      clearTimers();
      isRecordingRef.current = false;
      setIsRecording(false);

      if (recording?.uri) {
        onCaptured(buildCapturedChatMedia({
          capturedAtMs: Date.now(),
          durationMs: Math.max(0, Date.now() - recordingStartedAtRef.current),
          facing: facingRef.current,
          kind: 'video',
          posterDataUrl: posterRef.current,
          uri: recording.uri
        }));
      }
    } catch {
      clearTimers();
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [clearTimers, onCaptured]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) {
      return;
    }

    cameraRef.current?.stopRecording();
  }, []);

  const handlePressIn = useCallback(() => {
    didStartRecordingRef.current = false;

    // Held rather than tapped means a video. A third of a second is long enough
    // that an ordinary tap never starts one, and short enough that a hold does
    // not feel ignored.
    holdTimerRef.current = setTimeout(() => {
      void startRecording();
    }, 320);
  }, [startRecording]);

  const handlePressOut = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isRecordingRef.current) {
      stopRecording();
      return;
    }

    if (!didStartRecordingRef.current) {
      void takePhoto();
    }
  }, [stopRecording, takePhoto]);

  return (
    <Modal animationType="slide" onRequestClose={onCancel} statusBarTranslucent visible={visible}>
      <View style={styles.screen}>
        {hasPermission ? (
          <CameraView
            facing={facing}
            enableTorch={isTorchOn}
            mode="video"
            // The preview is mirrored for a front camera the way a mirror is,
            // but what is written to the file is not. Knowing the lens is what
            // lets the picture be corrected without asking anybody.
            mirror={false}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            videoQuality="1080p"
          />
        ) : (
          <View style={styles.permission}>
            <Ionicons color="#FFFFFF" name="camera-outline" size={40} />
            <Text style={styles.permissionText}>
              {cameraPermission
                ? 'Synzapp needs the camera to take photos and record video.'
                : 'Checking the camera…'}
            </Text>
            {cameraPermission && !cameraPermission.granted ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void requestCameraPermission()}
                style={({ pressed }) => [styles.permissionAction, pressed && styles.pressed]}
              >
                <Text style={styles.permissionActionText}>Allow camera</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <Pressable
            accessibilityLabel="Close camera"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onCancel}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Ionicons color="#FFFFFF" name="close" size={24} />
          </Pressable>

          {isRecording ? (
            <View style={styles.recordingPill}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{describeRecordingLength(recordedSeconds)}</Text>
            </View>
          ) : (
            <View style={styles.topSpacer} />
          )}

          <Pressable
            accessibilityLabel={isTorchOn ? 'Turn the light off' : 'Turn the light on'}
            accessibilityRole="button"
            disabled={facing === 'front'}
            hitSlop={10}
            onPress={() => setIsTorchOn((current) => !current)}
            style={({ pressed }) => [
              styles.roundButton,
              facing === 'front' && styles.roundButtonDisabled,
              pressed && styles.pressed
            ]}
          >
            <Ionicons color="#FFFFFF" name={isTorchOn ? 'flash' : 'flash-off'} size={22} />
          </Pressable>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
          <Text style={styles.hint}>
            {isRecording ? 'Release to send' : 'Tap for a photo, hold to record'}
          </Text>

          <View style={styles.controls}>
            <View style={styles.controlSpacer} />

            <Pressable
              accessibilityHint="Tap to take a photo, hold to record a video"
              accessibilityLabel="Shutter"
              accessibilityRole="button"
              disabled={!hasPermission}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={styles.shutterTarget}
            >
              <View style={[styles.shutterRing, isRecording && styles.shutterRingRecording]}>
                {isBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={[styles.shutterCore, isRecording && styles.shutterCoreRecording]} />
                )}
              </View>
            </Pressable>

            <View style={styles.controlSpacer}>
              <Pressable
                accessibilityLabel="Switch camera"
                accessibilityRole="button"
                disabled={isRecording}
                hitSlop={10}
                onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
                style={({ pressed }) => [
                  styles.roundButton,
                  isRecording && styles.roundButtonDisabled,
                  pressed && styles.pressed
                ]}
              >
                <Feather color="#FFFFFF" name="refresh-cw" size={21} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: {
      backgroundColor: '#000000',
      flex: 1
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      left: 0,
      paddingHorizontal: 16,
      position: 'absolute',
      right: 0,
      top: 0
    },
    topSpacer: {
      height: 44,
      width: 44
    },
    roundButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44
    },
    roundButtonDisabled: {
      opacity: 0.4
    },
    recordingPill: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      borderRadius: 16,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 7
    },
    recordingDot: {
      backgroundColor: '#FF3B30',
      borderRadius: 5,
      height: 10,
      width: 10
    },
    recordingText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      fontWeight: '500'
    },
    bottomBar: {
      bottom: 0,
      left: 0,
      paddingHorizontal: 24,
      position: 'absolute',
      right: 0
    },
    hint: {
      color: 'rgba(255, 255, 255, 0.82)',
      fontSize: 13.5,
      marginBottom: 16,
      textAlign: 'center'
    },
    controls: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between'
    },
    controlSpacer: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      width: 44
    },
    shutterTarget: {
      alignItems: 'center',
      justifyContent: 'center'
    },
    shutterRing: {
      alignItems: 'center',
      borderColor: '#FFFFFF',
      borderRadius: 41,
      borderWidth: 4,
      height: 82,
      justifyContent: 'center',
      width: 82
    },
    shutterRingRecording: {
      borderColor: '#FF3B30'
    },
    shutterCore: {
      backgroundColor: '#FFFFFF',
      borderRadius: 32,
      height: 64,
      width: 64
    },
    shutterCoreRecording: {
      backgroundColor: '#FF3B30',
      borderRadius: 8,
      height: 34,
      width: 34
    },
    permission: {
      alignItems: 'center',
      flex: 1,
      gap: 16,
      justifyContent: 'center',
      paddingHorizontal: 40
    },
    permissionText: {
      color: '#FFFFFF',
      fontSize: 15,
      lineHeight: 21,
      textAlign: 'center'
    },
    permissionActionText: {
      color: '#0A84FF',
      fontSize: 16,
      fontWeight: '500'
    },
    permissionAction: {
      paddingVertical: 8
    },
    pressed: {
      opacity: 0.7
    }
  });
}
