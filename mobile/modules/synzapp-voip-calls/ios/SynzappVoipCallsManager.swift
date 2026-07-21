import CallKit
import Foundation
import PushKit

final class SynzappVoipCallsManager: NSObject, CXProviderDelegate, PKPushRegistryDelegate {
  static let shared = SynzappVoipCallsManager()

  private let callController = CXCallController()
  private let lock = NSLock()
  private var callsByUUID: [UUID: [String: Any]] = [:]
  private var eventHandler: ((String, [String: Any?]) -> Void)?
  private var pendingEvents: [[String: Any?]] = []
  private var provider: CXProvider?
  private var pushRegistry: PKPushRegistry?
  private var token: String?
  private var uuidsByCallId: [String: UUID] = [:]

  private override init() {
    super.init()
  }

  func configure() {
    DispatchQueue.main.async {
      if self.provider == nil {
        let configuration = CXProviderConfiguration(localizedName: "Synzapp")
        configuration.includesCallsInRecents = true
        configuration.maximumCallGroups = 1
        configuration.maximumCallsPerCallGroup = 8
        configuration.supportedHandleTypes = [.generic]
        configuration.supportsVideo = true

        let provider = CXProvider(configuration: configuration)
        provider.setDelegate(self, queue: nil)
        self.provider = provider
      }
    }
  }

  func registerForVoipPushes() {
    DispatchQueue.main.async {
      if self.pushRegistry == nil {
        let registry = PKPushRegistry(queue: DispatchQueue.main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        self.pushRegistry = registry
      } else {
        self.pushRegistry?.desiredPushTypes = [.voIP]
      }
    }
  }

  func waitForVoipToken() async -> String? {
    registerForVoipPushes()

    for _ in 0..<40 {
      if let token = currentToken() {
        return token
      }

      try? await Task.sleep(nanoseconds: 125_000_000)
    }

    return currentToken()
  }

  func setEventHandler(_ handler: @escaping (String, [String: Any?]) -> Void) {
    lock.lock()
    eventHandler = handler
    let queuedEvents = pendingEvents
    pendingEvents = []
    lock.unlock()

    if let token = currentToken() {
      handler("onSynzappVoipToken", ["token": token])
    }

    queuedEvents.forEach { handler("onSynzappVoipCallEvent", $0) }
  }

  func clearEventHandler() {
    lock.lock()
    eventHandler = nil
    lock.unlock()
  }

  func drainPendingEvents() -> [[String: Any?]] {
    lock.lock()
    let events = pendingEvents
    pendingEvents = []
    lock.unlock()

    return events
  }

  func endCall(callId: String, reason: String?) {
    guard let uuid = uuid(for: callId) else {
      return
    }

    let action = CXEndCallAction(call: uuid)
    let transaction = CXTransaction(action: action)

    callController.request(transaction) { [weak self] error in
      if error != nil {
        self?.provider?.reportCall(with: uuid, endedAt: Date(), reason: self?.callEndedReason(reason) ?? .remoteEnded)
      }

      self?.removeCall(uuid: uuid)
    }
  }

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    guard type == .voIP else {
      return
    }

    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()

    lock.lock()
    self.token = token
    let handler = eventHandler
    lock.unlock()

    handler?("onSynzappVoipToken", ["token": token])
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    guard type == .voIP else {
      return
    }

    lock.lock()
    token = nil
    lock.unlock()
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }

    let data = normalizePayload(payload.dictionaryPayload)
    let eventType = data["type"] ?? "call.incoming"

    if eventType == "call.ended" {
      if let callId = data["callId"] {
        endCall(callId: callId, reason: data["reason"])
      }

      completion()
      return
    }

    reportIncomingCall(data: data, completion: completion)
  }

  func providerDidReset(_ provider: CXProvider) {
    lock.lock()
    callsByUUID.removeAll()
    uuidsByCallId.removeAll()
    lock.unlock()
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    let body = eventBody(type: "answer", uuid: action.callUUID)
    enqueueCallEvent(body)
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    let body = eventBody(type: "end", uuid: action.callUUID)
    enqueueCallEvent(body)
    removeCall(uuid: action.callUUID)
    action.fulfill()
  }

  private func reportIncomingCall(data: [String: String], completion: @escaping () -> Void) {
    configure()

    let callId = data["callId"] ?? UUID().uuidString
    let uuid = UUID(uuidString: callId) ?? UUID()
    let callerName = nonEmpty(data["callerName"]) ?? nonEmpty(data["title"]) ?? "Synzapp"
    let title = nonEmpty(data["title"]) ?? callerName
    let mode = data["mode"] == "video" ? "video" : "voice"
    let call: [String: Any] = [
      "callId": callId,
      "callerName": callerName,
      "callerUid": data["callerUid"] ?? "",
      "chatType": data["chatType"] == "GROUP" ? "GROUP" : "DIRECT",
      "contactId": data["contactId"] ?? "",
      "createdAt": data["createdAt"] ?? ISO8601DateFormatter().string(from: Date()),
      "mode": mode,
      "participantUids": parseParticipantUids(data["participantUids"]),
      "tenantId": data["tenantId"] ?? "",
      "title": title
    ]

    lock.lock()
    callsByUUID[uuid] = call
    uuidsByCallId[callId] = uuid
    lock.unlock()

    let update = CXCallUpdate()
    update.hasVideo = mode == "video"
    update.localizedCallerName = callerName
    update.remoteHandle = CXHandle(type: .generic, value: callerName)
    update.supportsDTMF = false
    update.supportsGrouping = false
    update.supportsHolding = false
    update.supportsUngrouping = false

    DispatchQueue.main.async {
      let provider = self.provider ?? CXProvider(configuration: CXProviderConfiguration(localizedName: "Synzapp"))
      self.provider = provider
      provider.setDelegate(self, queue: nil)
      provider.reportNewIncomingCall(with: uuid, update: update) { error in
        if error == nil {
          self.enqueueCallEvent([
            "call": call,
            "nativeDisplayed": true,
            "type": "incoming"
          ])
        } else {
          self.enqueueCallEvent([
            "call": call,
            "callId": callId,
            "errorMessage": error?.localizedDescription ?? "CallKit rejected the incoming Synzapp call.",
            "nativeDisplayed": false,
            "type": "failed"
          ])
          self.removeCall(uuid: uuid)
        }

        completion()
      }
    }
  }

  private func enqueueCallEvent(_ body: [String: Any?]) {
    lock.lock()
    if let handler = eventHandler {
      lock.unlock()
      handler("onSynzappVoipCallEvent", body)
      return
    }

    pendingEvents.append(body)
    lock.unlock()
  }

  private func eventBody(type: String, uuid: UUID) -> [String: Any?] {
    lock.lock()
    let call = callsByUUID[uuid]
    lock.unlock()

    return [
      "call": call,
      "callId": call?["callId"] as? String ?? uuid.uuidString,
      "nativeDisplayed": true,
      "type": type
    ]
  }

  private func currentToken() -> String? {
    lock.lock()
    let token = token
    lock.unlock()

    return token
  }

  private func uuid(for callId: String) -> UUID? {
    lock.lock()
    let uuid = uuidsByCallId[callId] ?? UUID(uuidString: callId)
    lock.unlock()

    return uuid
  }

  private func removeCall(uuid: UUID) {
    lock.lock()
    if let callId = callsByUUID[uuid]?["callId"] as? String {
      uuidsByCallId.removeValue(forKey: callId)
    }
    callsByUUID.removeValue(forKey: uuid)
    lock.unlock()
  }

  private func callEndedReason(_ reason: String?) -> CXCallEndedReason {
    switch reason {
    case "declined", "busy":
      return .declinedElsewhere
    case "missed":
      return .unanswered
    case "failed":
      return .failed
    default:
      return .remoteEnded
    }
  }

  private func normalizePayload(_ payload: [AnyHashable: Any]) -> [String: String] {
    var data: [String: String] = [:]

    payload.forEach { key, value in
      guard let key = key as? String else {
        return
      }

      if let stringValue = value as? String {
        data[key] = stringValue
      } else if let boolValue = value as? Bool {
        data[key] = boolValue ? "true" : "false"
      } else if let numberValue = value as? NSNumber {
        data[key] = numberValue.stringValue
      } else if JSONSerialization.isValidJSONObject(value),
        let jsonData = try? JSONSerialization.data(withJSONObject: value),
        let jsonString = String(data: jsonData, encoding: .utf8) {
        data[key] = jsonString
      }
    }

    return data
  }

  private func parseParticipantUids(_ value: String?) -> [String] {
    guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      return []
    }

    if let data = value.data(using: .utf8),
      let array = try? JSONSerialization.jsonObject(with: data) as? [String] {
      return array.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    return value
      .split(separator: ",")
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }

  private func nonEmpty(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }

    return value
  }
}
