import CryptoKit
import Foundation
import Intents
import UIKit
import os
import Security
import UserNotifications

/// Says what happened. An extension has no screen and no error surface, so
/// without this the only symptom of any fault is the app's own icon where a
/// face should be — which looks the same whatever the cause.
let synzappLog = Logger(subsystem: "com.synzapp.mobile", category: "notification")

final class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

    guard let bestAttemptContent else {
      contentHandler(request.content)
      return
    }

    if let previewText = NotificationPreviewDecryptor.decrypt(userInfo: request.content.userInfo) {
      bestAttemptContent.body = previewText
    }

    if let conversationIdentifier = NotificationPayloadReader.normalizedText(
      NotificationPayloadReader.stringField("conversationId", in: request.content.userInfo)
    ) {
      bestAttemptContent.threadIdentifier = conversationIdentifier
    }

    let type = NotificationPayloadReader.stringField("type", in: request.content.userInfo)

    // Actions are not conversations, and are deliberately not dressed as one.
    //
    // The face on the left of an iOS notification is available only through a
    // communication notification, which Apple provides for messages between
    // people. Using it for "an action was assigned" would be a misuse with two
    // real costs: App Review may refuse it, and iOS would file work alerts
    // under Communication, where Focus and the notification summary treat them
    // as messages from a person. So an action gets a thumbnail on the right
    // instead — less prominent, and honest.
    if type?.hasPrefix("ACTION_") == true {
      contentHandler(ActorThumbnail.applying(
        to: bestAttemptContent,
        userInfo: request.content.userInfo
      ))
      return
    }

    // The sender's face goes where the app icon normally sits, which iOS only
    // does for a **communication** notification. An attachment cannot do it:
    // that draws a thumbnail on the right and leaves the icon alone. So the
    // notice is re-issued as a message from a person, which is the same thing
    // WhatsApp and Telegram do and the only route Apple provides.
    contentHandler(SenderCommunicationIntent.applying(
      to: bestAttemptContent,
      userInfo: request.content.userInfo
    ))
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler, let bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }
}

private enum NotificationPreviewDecryptor {
  private static let expectedAlgorithm = "x25519-sha256-aes-256-gcm+synzapp-notification-preview-v1"
  private static let derivationLabel = "Synzapp notification preview v1"
  private static let aesGcmTagByteCount = 16
  private static let keychainAccessGroup = "F9M458TK87.com.synzapp.mobile.shared"
  /**
   Every identity is stored under a name beginning with this.

   It used to look for this exact name and nothing else, which is why iOS
   notifications never revealed their message: the app keeps an identity **per
   signed-in account** now, as `synzapp.deviceIdentity.v1.user.<uid>`, and the
   old single name has not been written since. The lookup failed silently, so
   the placeholder wording showed every time with nothing to say why.
   */
  private static let keychainAccountPrefix = "synzapp.deviceIdentity.v1"
  private static let keychainServices = [
    "synzapp.device.identity.v1:no-auth",
    "synzapp.device.identity.v1"
  ]

  static func decrypt(userInfo: [AnyHashable: Any]) -> String? {
    guard
      NotificationPayloadReader.stringField("notificationPreviewAlgorithm", in: userInfo) == expectedAlgorithm,
      NotificationPayloadReader.stringField("notificationPreviewVersion", in: userInfo) == "1",
      let ciphertext = NotificationPayloadReader.decodeBase64Field("notificationPreviewCiphertext", in: userInfo),
      let nonce = NotificationPayloadReader.decodeBase64Field("notificationPreviewNonce", in: userInfo),
      let senderPublicKeyData = NotificationPayloadReader.decodeBase64Field(
        "notificationPreviewSenderKeyAgreementPublicKey",
        in: userInfo
      ),
      ciphertext.count > aesGcmTagByteCount
    else {
      return nil
    }

    // Each identity on this phone is tried in turn. A preview is sealed for one
    // device, and AES-GCM refuses a wrong key rather than returning nonsense,
    // so the right identity proves itself and there is nothing to guess about
    // which account a notification belongs to.
    for identity in readStoredDeviceIdentities() {
      guard
        let privateKeyData = Data(base64Encoded: identity.keyAgreementPrivateKey),
        let recipientPublicKeyData = Data(base64Encoded: identity.keyAgreementPublicKey)
      else {
        continue
      }

      if let text = decrypt(
        ciphertext: ciphertext,
        nonce: nonce,
        privateKeyData: privateKeyData,
        recipientPublicKeyData: recipientPublicKeyData,
        senderPublicKeyData: senderPublicKeyData
      ) {
        return text
      }
    }

    return nil
  }

  private static func decrypt(
    ciphertext: Data,
    nonce: Data,
    privateKeyData: Data,
    recipientPublicKeyData: Data,
    senderPublicKeyData: Data
  ) -> String? {
    do {
      let privateKey = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKeyData)
      let senderPublicKey = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: senderPublicKeyData)
      let sharedSecret = try privateKey.sharedSecretFromKeyAgreement(with: senderPublicKey)
      let sharedSecretData = sharedSecret.withUnsafeBytes { rawBuffer in
        Data(rawBuffer)
      }
      var keyMaterial = Data(derivationLabel.utf8)

      keyMaterial.append(sharedSecretData)
      keyMaterial.append(senderPublicKeyData)
      keyMaterial.append(recipientPublicKeyData)

      let keyDigest = SHA256.hash(data: keyMaterial)
      let symmetricKey = SymmetricKey(data: keyDigest)
      let ciphertextBytes = ciphertext.prefix(ciphertext.count - aesGcmTagByteCount)
      let tagBytes = ciphertext.suffix(aesGcmTagByteCount)
      let sealedBox = try AES.GCM.SealedBox(
        nonce: AES.GCM.Nonce(data: nonce),
        ciphertext: Data(ciphertextBytes),
        tag: Data(tagBytes)
      )
      let plaintext = try AES.GCM.open(sealedBox, using: symmetricKey)
      let payload = try JSONDecoder().decode(NotificationPreviewPayload.self, from: plaintext)
      let text = payload.text.trimmingCharacters(in: .whitespacesAndNewlines)

      return payload.version == 1 && !text.isEmpty ? text : nil
    } catch {
      return nil
    }
  }

  /// Every device identity this phone holds, whichever account wrote it.
  private static func readStoredDeviceIdentities() -> [StoredDeviceIdentity] {
    var identities: [StoredDeviceIdentity] = []
    var seen = Set<Data>()

    for service in keychainServices {
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccessGroup as String: keychainAccessGroup,
        kSecAttrService as String: service,
        kSecMatchLimit as String: kSecMatchLimitAll,
        kSecReturnAttributes as String: kCFBooleanTrue as Any,
        kSecReturnData as String: kCFBooleanTrue as Any
      ]
      var items: CFTypeRef?

      guard
        SecItemCopyMatching(query as CFDictionary, &items) == errSecSuccess,
        let entries = items as? [[String: Any]]
      else {
        continue
      }

      for entry in entries {
        guard
          accountName(entry).hasPrefix(keychainAccountPrefix),
          let data = entry[kSecValueData as String] as? Data,
          seen.insert(data).inserted,
          let identity = try? JSONDecoder().decode(StoredDeviceIdentity.self, from: data)
        else {
          continue
        }

        identities.append(identity)
      }
    }

    return identities
  }

  /// The account is written as raw bytes rather than a string, so both are read.
  private static func accountName(_ entry: [String: Any]) -> String {
    if let data = entry[kSecAttrAccount as String] as? Data {
      return String(data: data, encoding: .utf8) ?? ""
    }

    return entry[kSecAttrAccount as String] as? String ?? ""
  }

}

/**
 Re-issues a chat notice as a message from a person.

 iOS shows a sender's picture in place of the app icon only when a notification
 is tied to an `INSendMessageIntent` describing who sent it. Donating that
 intent and then updating the content is what promotes an ordinary notification
 into a communication one; it also groups by conversation and lets the notice
 take part in Focus and Communication Limits, the way a real messaging app does.

 Needs three things beyond this code, and quietly does nothing without them: the
 Communication Notifications entitlement on the app, `INSendMessageIntent` in
 the app's `NSUserActivityTypes`, and the same in this extension's
 `IntentsSupported`.
 */
private enum SenderCommunicationIntent {
  /// Up to two letters on the brand's soft tint, matching the chat list.
  private static func initialsImage(name: String) -> INImage? {
    let side: CGFloat = 128
    let text = initials(for: name)
    let image = UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { context in
      UIColor(red: 0xDD / 255, green: 0xF6 / 255, blue: 0xF1 / 255, alpha: 1).setFill()
      context.cgContext.fillEllipse(in: CGRect(x: 0, y: 0, width: side, height: side))

      let attributes: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: side * 0.4, weight: .regular),
        .foregroundColor: UIColor(red: 0x0F / 255, green: 0x76 / 255, blue: 0x6E / 255, alpha: 1)
      ]
      let measured = text.size(withAttributes: attributes)

      text.draw(
        at: CGPoint(x: (side - measured.width) / 2, y: (side - measured.height) / 2),
        withAttributes: attributes
      )
    }

    return image.pngData().map { INImage(imageData: $0) }
  }

  /// The same two-letter rule the app uses everywhere else.
  private static func initials(for name: String) -> String {
    let letters = name
      .split(whereSeparator: { $0.isWhitespace })
      .compactMap { part in part.first(where: { $0.isLetter }) ?? part.first }
      .prefix(2)
      .map(String.init)
      .joined()
      .uppercased()

    return letters.isEmpty ? "?" : letters
  }

  static func applying(
    to content: UNMutableNotificationContent,
    userInfo: [AnyHashable: Any]
  ) -> UNNotificationContent {
    guard
      NotificationPayloadReader.stringField("type", in: userInfo) == "chat.message",
      let senderName = NotificationPayloadReader.normalizedText(content.title)
    else {
      return content
    }

    let senderIdentifier = NotificationPayloadReader.normalizedText(
      NotificationPayloadReader.stringField("senderUid", in: userInfo)
    ) ?? senderName
    let conversationIdentifier = NotificationPayloadReader.normalizedText(
      NotificationPayloadReader.stringField("conversationId", in: userInfo)
    ) ?? senderIdentifier
    // The photo when there is one, otherwise the person's initials drawn the
    // way the app draws them. Given no image at all iOS falls back to the app's
    // own icon, which says nothing about who wrote the message.
    let avatar = NotificationAvatarAttachmentStore.avatarImage(userInfo: userInfo)
      ?? initialsImage(name: senderName)

    synzappLog.log("avatar \(avatar == nil ? "missing" : "found", privacy: .public)")

    var nameComponents = PersonNameComponents()

    nameComponents.nickname = senderName

    let sender = INPerson(
      personHandle: INPersonHandle(value: senderIdentifier, type: .unknown),
      nameComponents: nameComponents,
      displayName: senderName,
      image: avatar,
      contactIdentifier: nil,
      customIdentifier: senderIdentifier,
      isMe: false,
      suggestionType: .none
    )
    let recipient = INPerson(
      personHandle: INPersonHandle(value: "me", type: .unknown),
      nameComponents: nil,
      displayName: nil,
      image: nil,
      contactIdentifier: nil,
      customIdentifier: nil,
      isMe: true,
      suggestionType: .none
    )
    let intent = INSendMessageIntent(
      recipients: [recipient],
      outgoingMessageType: .outgoingMessageText,
      content: content.body,
      speakableGroupName: nil,
      conversationIdentifier: conversationIdentifier,
      serviceName: nil,
      sender: sender,
      attachments: nil
    )

    if let avatar {
      intent.setImage(avatar, forParameterNamed: \.sender)
    }

    let interaction = INInteraction(intent: intent, response: nil)

    interaction.direction = .incoming
    interaction.donate(completion: nil)

    // If the system refuses the intent — an older iOS, or the entitlement not
    // granted — the notice still shows, just with the app's own icon. A
    // missing picture is not worth losing the message over.
    do {
      let updated = try content.updating(from: intent)

      synzappLog.log("intent applied")

      return updated
    } catch {
      synzappLog.error("intent refused: \(error.localizedDescription, privacy: .public)")

      return content
    }
  }
}

private enum NotificationAvatarAttachmentStore {
  private static let keychainAccessGroup = "F9M458TK87.com.synzapp.mobile.shared"
  private static let keychainAccountPrefix = "synzapp.notificationAvatar.v1."
  private static let keychainServices = [
    "synzapp.notification.avatar.v1:no-auth",
    "synzapp.notification.avatar.v1"
  ]
  private static let maximumAvatarByteCount = 64 * 1024

  /// The sender's face, for the communication intent to carry.
  static func avatarImage(userInfo: [AnyHashable: Any]) -> INImage? {
    guard NotificationPayloadReader.stringField("type", in: userInfo) == "chat.message" else {
      return nil
    }

    return actorAvatarData(userInfo: userInfo).map { INImage(imageData: $0) }
  }

  /**
   * The photo bytes this notification names, whatever kind of notification it is.
   *
   * Split out from `avatarImage` so an action notification can use the same
   * cache without also inheriting the chat-only guard above — the guard is what
   * keeps a work alert from being dressed as a message from a person.
   */
  static func actorAvatarData(userInfo: [AnyHashable: Any]) -> Data? {
    let primaryCacheKey = NotificationPayloadReader.normalizedText(
      NotificationPayloadReader.stringField("notificationSenderProfilePhotoCacheKey", in: userInfo)
    )
    let fallbackCacheKey = NotificationPayloadReader.normalizedText(
      NotificationPayloadReader.stringField("notificationSenderFallbackProfilePhotoCacheKey", in: userInfo)
    )

    return primaryCacheKey.flatMap { avatarData(cacheKey: $0) }
      ?? fallbackCacheKey.flatMap { avatarData(cacheKey: $0) }
  }

  private static func avatarData(cacheKey: String) -> Data? {
    let encodedKey = Data("\(keychainAccountPrefix)\(cacheKey)".utf8)

    synzappLog.log("avatar key \(cacheKey, privacy: .public)")

    for service in keychainServices {
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccessGroup as String: keychainAccessGroup,
        kSecAttrAccount as String: encodedKey,
        kSecAttrGeneric as String: encodedKey,
        kSecAttrService as String: service,
        kSecMatchLimit as String: kSecMatchLimitOne,
        kSecReturnData as String: kCFBooleanTrue as Any
      ]
      var item: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &item)

      synzappLog.log("keychain \(service, privacy: .public) status \(status, privacy: .public)")

      guard
        status == errSecSuccess,
        let data = item as? Data,
        let storedAvatar = try? JSONDecoder().decode(StoredNotificationAvatar.self, from: data),
        storedAvatar.version == 1,
        let avatarData = Data(base64Encoded: storedAvatar.base64, options: .ignoreUnknownCharacters),
        avatarData.count <= maximumAvatarByteCount
      else {
        continue
      }

      return avatarData
    }

    return nil
  }

}

private enum NotificationPayloadReader {
  static func decodeBase64Field(_ key: String, in userInfo: [AnyHashable: Any]) -> Data? {
    guard let value = stringField(key, in: userInfo) else {
      return nil
    }

    return Data(base64Encoded: value)
  }

  static func stringField(_ key: String, in userInfo: [AnyHashable: Any]) -> String? {
    if let value = userInfo[key] as? String {
      return value
    }

    for containerKey in ["data", "body", "payload"] {
      guard let container = userInfo[containerKey] as? [AnyHashable: Any] else {
        continue
      }

      if let value = container[key] as? String {
        return value
      }
    }

    return nil
  }

  static func normalizedText(_ value: String?) -> String? {
    let text = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

    return text.isEmpty ? nil : text
  }
}

private struct StoredDeviceIdentity: Decodable {
  let keyAgreementPrivateKey: String
  let keyAgreementPublicKey: String
}

private struct NotificationPreviewPayload: Decodable {
  let text: String
  let version: Int
}

private struct StoredNotificationAvatar: Decodable {
  let base64: String
  let mimeType: String?
  let version: Int
}

/**
 * The photo of whoever caused an action notification, as a thumbnail.
 *
 * The image is already on this phone — the app caches profile photos into the
 * shared keychain — so nothing is downloaded here and nothing private travels
 * in a payload. It is written to a temporary file because that is the only
 * thing `UNNotificationAttachment` accepts.
 *
 * Every failure returns the notification unchanged. A missing photo, a full
 * disk, a key this phone has never seen: none of them is a reason for somebody
 * not to be told about their work.
 */
private enum ActorThumbnail {
  static func applying(
    to content: UNMutableNotificationContent,
    userInfo: [AnyHashable: Any]
  ) -> UNNotificationContent {
    guard
      let data = NotificationAvatarAttachmentStore.actorAvatarData(userInfo: userInfo),
      let attachment = attachment(from: data)
    else {
      return content
    }

    content.attachments = [attachment]

    return content
  }

  private static func attachment(from data: Data) -> UNNotificationAttachment? {
    let directory = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
      .appendingPathComponent(UUID().uuidString, isDirectory: true)

    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

      let fileURL = directory.appendingPathComponent("actor.jpg")

      try data.write(to: fileURL)

      return try UNNotificationAttachment(identifier: "actor", url: fileURL, options: nil)
    } catch {
      return nil
    }
  }
}
