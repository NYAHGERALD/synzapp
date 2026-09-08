import AVFoundation
import ExpoModulesCore
import Foundation

public final class SynzappAudioSessionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SynzappAudioSession")

    AsyncFunction("configureInterpreterRealtimeRoute") { (route: String) -> [String: Any] in
      try SynzappAudioSessionController.shared.configureInterpreterRealtimeRoute(route: route)
    }

    AsyncFunction("getCurrentRoute") { () -> [String: Any] in
      SynzappAudioSessionController.shared.currentRouteInfo()
    }

    AsyncFunction("configureInterpreterPlaybackRoute") { (route: String) -> [String: Any] in
      try SynzappAudioSessionController.shared.configureInterpreterPlaybackRoute(route: route)
    }

    AsyncFunction("releaseInterpreterRealtimeRoute") { () in
      try SynzappAudioSessionController.shared.releaseInterpreterRealtimeRoute()
    }
  }
}

private final class SynzappAudioSessionController {
  static let shared = SynzappAudioSessionController()

  private let session = AVAudioSession.sharedInstance()

  private init() {}

  /**
   The session used for a live interpreted meeting.

   **The phone's own microphone is used, never a Bluetooth one.** This is a
   deliberate trade, agreed with the product owner, and it is the only way to
   get full volume out of a Bluetooth speaker.

   A Bluetooth device cannot carry a microphone and high-quality audio at the
   same time. Asking for its microphone puts the whole session on the hands-free
   profile — mono, narrow-band, and markedly quieter — for everything, including
   the interpreter's replies. Declining it lets the device use the music profile,
   which is what makes a saved recording sound loud through the same speaker.

   `.allowBluetoothA2DP` alone gives high-quality output. Neither
   `.allowBluetoothHFP` nor `.allowBluetooth` is requested, because either would
   pull the session back to the quiet profile.

   The cost: somebody wearing a Bluetooth headset speaks toward the phone rather
   than into the headset. For an interpreter used with a phone on a table and a
   speaker for the room — the case this is built for — the phone's microphone is
   as good or better.
   */
  func configureInterpreterRealtimeRoute(route: String) throws -> [String: Any] {
    var options: AVAudioSession.CategoryOptions = [
      .allowAirPlay,
      .allowBluetoothA2DP
    ]

    if route == "speaker" {
      options.insert(.defaultToSpeaker)
    }

    // .videoChat rather than .voiceChat: voice chat is tuned for a telephone
    // call and narrows the output, which is the opposite of what is wanted for
    // a response played to a room.
    try session.setCategory(.playAndRecord, mode: .videoChat, options: options)
    try session.setActive(true)

    if route == "speaker" {
      try session.overrideOutputAudioPort(.speaker)
    } else {
      // No Bluetooth input preference. Requesting it here was what forced the
      // hands-free profile and made every response quiet.
      try session.overrideOutputAudioPort(.none)
      try preferBestWiredMicrophone()
    }

    return currentRouteInfo()
  }

  /**
   Chooses the microphone, in order of preference.

   1. A wired external microphone — a DJI Mic or similar, connected through the
      data port. These appear as USB audio devices and are almost always the
      best microphone present: closer to the speaker, and made for the job.
   2. A wired headset microphone.
   3. The phone's own microphone.

   **A Bluetooth microphone is never chosen.** That is the one option that would
   force the whole session onto the hands-free profile and make every response
   quiet through a Bluetooth speaker. A wired microphone has no such cost: it
   uses a separate path entirely, so the speaker keeps the music profile and
   full volume while the wired microphone captures.

   Which is why this order is worth keeping: it gives the best available
   microphone *and* the loudest output, where asking for the Bluetooth
   microphone gives a worse microphone and quieter output.
   */
  private func preferBestWiredMicrophone() throws {
    guard let inputs = session.availableInputs else {
      return
    }

    let preferredOrder: [AVAudioSession.Port] = [
      .usbAudio,
      .headsetMic,
      .lineIn,
      .builtInMic
    ]

    for portType in preferredOrder {
      if let match = inputs.first(where: { $0.portType == portType }) {
        try session.setPreferredInput(match)

        return
      }
    }
  }

  /**
   Configures the session for playing the interpreter's response.

   The listening session asks iOS for Bluetooth **input**, which forces the
   hands-free profile: mono, narrow-band and markedly quieter. That is a
   property of Bluetooth, not a setting — a device cannot carry a microphone
   and high-quality audio at the same time.

   While the interpreter speaks, no microphone is needed. Declaring that here —
   playback only, with the music profile and no hands-free option — lets the
   speaker switch to the profile that makes saved recordings sound loud through
   the same device.

   Safe because the interpreter is push-to-talk and never listens while
   speaking. `configureInterpreterRealtimeRoute` is called again before the next
   listening turn.
   */
  func configureInterpreterPlaybackRoute(route: String) throws -> [String: Any] {
    var options: AVAudioSession.CategoryOptions = [
      .allowAirPlay,
      .allowBluetoothA2DP
    ]

    if route == "speaker" {
      options.insert(.defaultToSpeaker)
    }

    // .playback with .spokenAudio: no input is requested, so the hands-free
    // profile is never selected. .spokenAudio also tells iOS this is speech
    // rather than music, which is how other apps are ducked politely.
    try session.setCategory(.playback, mode: .spokenAudio, options: options)
    try session.setActive(true)

    if route == "speaker" {
      try session.overrideOutputAudioPort(.speaker)
    } else {
      try session.overrideOutputAudioPort(.none)
    }

    return currentRouteInfo()
  }

  func releaseInterpreterRealtimeRoute() throws {
    try session.overrideOutputAudioPort(.none)
  }

  func currentRouteInfo() -> [String: Any] {
    [
      "category": session.category.rawValue,
      "inputName": session.currentRoute.inputs.first?.portName ?? "",
      "inputType": session.currentRoute.inputs.first?.portType.rawValue ?? "",
      "mode": session.mode.rawValue,
      "outputs": session.currentRoute.outputs.map { port in
        [
          "name": port.portName,
          "type": port.portType.rawValue,
          "uid": port.uid
        ]
      }
    ]
  }

}
