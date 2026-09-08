import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import type { SynzappCallRecord } from '../../services/callApi';
import { Modal, Pressable, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The in-call overlay.
 *
 * Lifted out of the chat screen unchanged.
 */

export type SynzappCallDirection = 'incoming' | 'outgoing';

export type SynzappCallStatus = 'calling' | 'connecting' | 'connected' | 'ended' | 'ringing';

export interface ActiveSynzappCall {
  call: SynzappCallRecord;
  direction: SynzappCallDirection;
  isMuted: boolean;
  isNativePresented?: boolean;
  isSpeakerOn: boolean;
  isVideoEnabled: boolean;
  localStreamUrl: string | null;
  remoteStreamUrlsByUid: Record<string, string>;
  status: SynzappCallStatus;
}

export type WebRtcRuntime = {
  mediaDevices?: {
    getUserMedia?: (constraints: Record<string, unknown>) => Promise<any>;
  };
  RTCIceCandidate?: new (candidate: unknown) => any;
  RTCPeerConnection?: new (configuration: Record<string, unknown>) => any;
  RTCSessionDescription?: new (description: unknown) => any;
  RTCView?: React.ComponentType<any>;
};

export function SynzappCallOverlay({
  callState,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  profilePhotoHeaders
}: {
  callState: ActiveSynzappCall | null;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleVideo: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const insets = useSafeAreaInsets();

  if (!callState) {
    return null;
  }

  const remoteStreamUrls = Object.values(callState.remoteStreamUrlsByUid).filter(Boolean);
  const primaryRemoteStreamUrl = remoteStreamUrls[0] || null;
  const isVideoCall = callState.call.mode === 'video';
  const isIncomingRinging = callState.direction === 'incoming' && callState.status === 'ringing';
  const statusText = getSynzappCallStatusLabel(callState);
  const displayName = callState.direction === 'incoming'
    ? callState.call.callerName || callState.call.title
    : callState.call.title;

  return (
    <Modal
      animationType="fade"
      onRequestClose={isIncomingRinging ? onDecline : onEnd}
      presentationStyle="fullScreen"
      transparent={false}
      visible
    >
      <View style={[
        styles.callOverlayRoot,
        {
          paddingBottom: Math.max(insets.bottom, 12) + 10,
          paddingTop: Math.max(insets.top, 12) + 10
        }
      ]}>
        {isVideoCall && primaryRemoteStreamUrl ? (
          <SynzappCallVideoSurface
            mirror={false}
            streamUrl={primaryRemoteStreamUrl}
            style={styles.callRemoteVideo}
          />
        ) : null}

        <View style={styles.callOverlayPattern}>
          {Array.from({ length: 28 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.callPatternDot,
                {
                  left: `${(index * 37) % 100}%`,
                  opacity: 0.08 + ((index % 4) * 0.025),
                  top: `${(index * 19) % 100}%`,
                  transform: [{ rotate: `${index * 17}deg` }]
                }
              ]}
            />
          ))}
        </View>

        <View style={styles.callTopBar}>
          <Pressable
            accessibilityLabel="Minimize call"
            accessibilityRole="button"
            style={({ pressed }) => [styles.callRoundButton, pressed && styles.pressed]}
          >
            <Feather color="#E5E7EB" name="minimize-2" size={20} />
          </Pressable>

          <View style={styles.callSecureBadge}>
            <Feather color="#5EEAD4" name="shield" size={14} />
            <Text style={styles.callSecureBadgeText}>Synzapp secure call</Text>
          </View>

          <Pressable
            accessibilityLabel="Message during call"
            accessibilityRole="button"
            style={({ pressed }) => [styles.callRoundButton, pressed && styles.pressed]}
          >
            <Feather color="#E5E7EB" name="message-circle" size={20} />
          </Pressable>
        </View>

        <View style={styles.callIdentityArea}>
          <Text numberOfLines={1} style={styles.callTitle}>{displayName}</Text>
          <Text numberOfLines={1} style={styles.callStatus}>{statusText}</Text>
        </View>

        <View style={styles.callAvatarStage}>
          {isVideoCall && primaryRemoteStreamUrl ? null : (
            <View style={styles.callAvatarHalo}>
              <View style={styles.callAvatarHaloInner}>
                <ProfileAvatar
                  headers={profilePhotoHeaders}
                  name={displayName}
                  size={156}
                  uri={null}
                />
              </View>
            </View>
          )}

          {isVideoCall && callState.localStreamUrl ? (
            <View style={styles.callLocalVideoWrap}>
              <SynzappCallVideoSurface
                mirror
                streamUrl={callState.localStreamUrl}
                style={styles.callLocalVideo}
              />
              {!callState.isVideoEnabled ? (
                <View style={styles.callLocalVideoOff}>
                  <Feather color="#FFFFFF" name="video-off" size={18} />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.callControlsDock}>
          {isIncomingRinging ? (
            <>
              <Pressable
                accessibilityLabel="Decline Synzapp call"
                accessibilityRole="button"
                onPress={onDecline}
                style={({ pressed }) => [
                  styles.callControlButton,
                  styles.callEndButton,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons color="#FFFFFF" name="call" size={28} style={styles.callEndIconFlip} />
              </Pressable>
              <Pressable
                accessibilityLabel="Answer Synzapp call"
                accessibilityRole="button"
                onPress={onAnswer}
                style={({ pressed }) => [
                  styles.callControlButton,
                  styles.callAnswerButton,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons color="#FFFFFF" name={isVideoCall ? 'videocam' : 'call'} size={28} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                accessibilityLabel={callState.isVideoEnabled ? 'Turn video off' : 'Turn video on'}
                accessibilityRole="button"
                disabled={!isVideoCall}
                onPress={onToggleVideo}
                style={({ pressed }) => [
                  styles.callControlButton,
                  !isVideoCall && styles.disabled,
                  pressed && isVideoCall && styles.pressed
                ]}
              >
                <Ionicons color="#FFFFFF" name={callState.isVideoEnabled ? 'videocam' : 'videocam-off'} size={24} />
              </Pressable>
              <Pressable
                accessibilityLabel={callState.isSpeakerOn ? 'Turn speaker off' : 'Turn speaker on'}
                accessibilityRole="button"
                onPress={onToggleSpeaker}
                style={({ pressed }) => [styles.callControlButton, pressed && styles.pressed]}
              >
                <Ionicons color="#FFFFFF" name={callState.isSpeakerOn ? 'volume-high' : 'volume-medium'} size={25} />
              </Pressable>
              <Pressable
                accessibilityLabel={callState.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                accessibilityRole="button"
                onPress={onToggleMute}
                style={({ pressed }) => [styles.callControlButton, pressed && styles.pressed]}
              >
                <Ionicons color="#FFFFFF" name={callState.isMuted ? 'mic-off' : 'mic'} size={25} />
              </Pressable>
              <Pressable
                accessibilityLabel="End Synzapp call"
                accessibilityRole="button"
                onPress={onEnd}
                style={({ pressed }) => [
                  styles.callControlButton,
                  styles.callEndButton,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons color="#FFFFFF" name="call" size={28} style={styles.callEndIconFlip} />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SynzappCallVideoSurface({
  mirror,
  streamUrl,
  style
}: {
  mirror: boolean;
  streamUrl: string | null;
  style: any;
}) {
  const RTCView = getOptionalRtcView();

  if (!RTCView || !streamUrl) {
    return null;
  }

  return (
    <RTCView
      mirror={mirror}
      objectFit="cover"
      streamURL={streamUrl}
      style={style}
    />
  );
}

function getOptionalRtcView(): React.ComponentType<any> | null {
  try {
    const runtime = require('react-native-webrtc') as WebRtcRuntime;

    return runtime?.RTCView || null;
  } catch {
    return null;
  }
}

function getSynzappCallStatusLabel(callState: ActiveSynzappCall): string {
  if (callState.status === 'ringing') {
    return 'Incoming secure call...';
  }

  if (callState.status === 'calling') {
    return callState.call.mode === 'video' ? 'Video calling...' : 'Calling...';
  }

  if (callState.status === 'connecting') {
    return 'Connecting securely...';
  }

  if (callState.status === 'connected') {
    return callState.call.chatType === 'GROUP' ? 'Group call connected' : 'Call connected';
  }

  return 'Ending call...';
}
