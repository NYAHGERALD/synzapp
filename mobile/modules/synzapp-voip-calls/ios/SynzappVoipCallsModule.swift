import ExpoModulesCore
import Foundation

public final class SynzappVoipCallsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SynzappVoipCalls")

    Events("onSynzappVoipToken", "onSynzappVoipCallEvent")

    OnStartObserving {
      SynzappVoipCallsManager.shared.setEventHandler { [weak self] eventName, body in
        self?.sendEvent(eventName, body)
      }
    }

    OnStopObserving {
      SynzappVoipCallsManager.shared.clearEventHandler()
    }

    AsyncFunction("isAvailable") { () -> Bool in
      true
    }

    AsyncFunction("getVoipToken") { () async -> String? in
      await SynzappVoipCallsManager.shared.waitForVoipToken()
    }

    AsyncFunction("getPendingEvents") { () -> [[String: Any?]] in
      SynzappVoipCallsManager.shared.drainPendingEvents()
    }

    AsyncFunction("endCall") { (callId: String, reason: String?) in
      SynzappVoipCallsManager.shared.endCall(callId: callId, reason: reason)
    }
  }
}
