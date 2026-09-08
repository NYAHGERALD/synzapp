import { requireOptionalNativeModule } from 'expo-modules-core';

export type SynzappInterpreterAudioRoute = 'bluetooth' | 'speaker' | 'system';

export interface SynzappAudioRoutePort {
  name: string;
  type: string;
  uid: string;
}

export interface SynzappAudioSessionRouteInfo {
  category: string;
  /** The microphone actually in use, e.g. "DJI Mic" or "iPhone Microphone". */
  inputName?: string;
  /** Its kind, e.g. "USBAudio", "MicrophoneBuiltIn". */
  inputType?: string;
  mode: string;
  outputs: SynzappAudioRoutePort[];
}

export interface SynzappAudioSessionModule {
  /**
   * The session used while listening. Asks for Bluetooth input, which means a
   * Bluetooth device uses the hands-free profile — quieter by necessity,
   * because it is carrying a microphone at the same time.
   */
  configureInterpreterRealtimeRoute?: (
    route: SynzappInterpreterAudioRoute
  ) => Promise<SynzappAudioSessionRouteInfo>;
  /**
   * The session used while the interpreter speaks. Requests no input, so a
   * Bluetooth device can use the music profile and play the response at the
   * same volume as a saved recording.
   */
  configureInterpreterPlaybackRoute?: (
    route: SynzappInterpreterAudioRoute
  ) => Promise<SynzappAudioSessionRouteInfo>;
  getCurrentRoute?: () => Promise<SynzappAudioSessionRouteInfo>;
  releaseInterpreterRealtimeRoute?: () => Promise<void>;
}

export default requireOptionalNativeModule<SynzappAudioSessionModule>('SynzappAudioSession');
