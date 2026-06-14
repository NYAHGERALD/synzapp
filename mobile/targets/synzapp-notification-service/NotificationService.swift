import CryptoKit
import Foundation
import Intents
import Security
import UserNotifications

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

    if #available(iOS 15.0, *) {
      contentHandler(CommunicationNotificationContentBuilder.enrich(
        bestAttemptContent,
        userInfo: request.content.userInfo
      ))
      return
    }

    contentHandler(bestAttemptContent)
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
  private static let keychainAccount = "synzapp.deviceIdentity.v1"
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

    guard
      let identity = readStoredDeviceIdentity(),
      let privateKeyData = Data(base64Encoded: identity.keyAgreementPrivateKey),
      let recipientPublicKeyData = Data(base64Encoded: identity.keyAgreementPublicKey)
    else {
      return nil
    }

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

  private static func readStoredDeviceIdentity() -> StoredDeviceIdentity? {
    let encodedKey = Data(keychainAccount.utf8)

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

      guard status == errSecSuccess, let data = item as? Data else {
        continue
      }

      return try? JSONDecoder().decode(StoredDeviceIdentity.self, from: data)
    }

    return nil
  }

}

@available(iOS 15.0, *)
private enum CommunicationNotificationContentBuilder {
  static func enrich(
    _ content: UNMutableNotificationContent,
    userInfo: [AnyHashable: Any]
  ) -> UNNotificationContent {
    guard NotificationPayloadReader.stringField("type", in: userInfo) == "chat.message" else {
      return content
    }

    let senderName = normalizedText(
      NotificationPayloadReader.stringField("notificationSenderDisplayName", in: userInfo)
        ?? NotificationPayloadReader.stringField("notificationTitle", in: userInfo)
        ?? content.title
    )

    guard !senderName.isEmpty else {
      return content
    }

    let senderIdentifier = normalizedText(
      NotificationPayloadReader.stringField("notificationSenderUid", in: userInfo)
        ?? NotificationPayloadReader.stringField("senderUid", in: userInfo)
        ?? NotificationPayloadReader.stringField("contactId", in: userInfo)
        ?? senderName
    )
    let conversationIdentifier = normalizedText(
      NotificationPayloadReader.stringField("conversationId", in: userInfo)
        ?? NotificationPayloadReader.stringField("contactId", in: userInfo)
        ?? senderIdentifier
    )
    let senderImage = NotificationAvatarStore.image(
      cacheKey: NotificationPayloadReader.stringField("notificationSenderProfilePhotoCacheKey", in: userInfo)
    ) ?? NotificationAvatarStore.image(
      cacheKey: NotificationPayloadReader.stringField("notificationSenderFallbackProfilePhotoCacheKey", in: userInfo)
    )
    let sender = INPerson(
      personHandle: INPersonHandle(value: senderIdentifier, type: .unknown),
      nameComponents: nil,
      displayName: senderName,
      image: senderImage,
      contactIdentifier: senderIdentifier,
      customIdentifier: senderIdentifier,
      isMe: false,
      suggestionType: .none
    )
    let recipient = INPerson(
      personHandle: INPersonHandle(value: "synzapp-current-user", type: .unknown),
      nameComponents: nil,
      displayName: nil,
      image: nil,
      contactIdentifier: nil,
      customIdentifier: "synzapp-current-user",
      isMe: true,
      suggestionType: .none
    )
    let intent = INSendMessageIntent(
      recipients: [recipient],
      outgoingMessageType: .outgoingMessageText,
      content: content.body,
      speakableGroupName: nil,
      conversationIdentifier: conversationIdentifier,
      serviceName: "Synzapp",
      sender: sender,
      attachments: nil
    )
    let interaction = INInteraction(intent: intent, response: nil)

    if let senderImage = senderImage {
      intent.setImage(senderImage, forParameterNamed: \.sender)
    }

    interaction.direction = .incoming
    interaction.donate(completion: nil)

    do {
      let enrichedContent = try content.updating(from: intent)

      guard let mutableContent = enrichedContent.mutableCopy() as? UNMutableNotificationContent else {
        return enrichedContent
      }

      mutableContent.threadIdentifier = conversationIdentifier
      mutableContent.userInfo = content.userInfo
      mutableContent.badge = content.badge
      mutableContent.sound = content.sound

      return mutableContent
    } catch {
      content.threadIdentifier = conversationIdentifier
      return content
    }
  }

  private static func normalizedText(_ value: String?) -> String {
    return (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
  }
}

@available(iOS 15.0, *)
private enum NotificationAvatarStore {
  private static let keychainAccessGroup = "F9M458TK87.com.synzapp.mobile.shared"
  private static let keychainAccountPrefix = "synzapp.notificationAvatar.v1:"
  private static let keychainServices = [
    "synzapp.notification.avatar.v1:no-auth",
    "synzapp.notification.avatar.v1"
  ]
  private static let maximumAvatarByteCount = 64 * 1024

  static func image(cacheKey: String?) -> INImage? {
    let safeCacheKey = (cacheKey ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

    guard !safeCacheKey.isEmpty else {
      return nil
    }

    let encodedKey = Data("\(keychainAccountPrefix)\(safeCacheKey)".utf8)

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

      return INImage(imageData: avatarData)
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
