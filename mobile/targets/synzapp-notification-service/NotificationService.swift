import CryptoKit
import Foundation
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

    SynzappNotificationLogoAttachment.attach(to: bestAttemptContent)

    contentHandler(bestAttemptContent)
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler, let bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }
}

private enum SynzappNotificationLogoAttachment {
  private static let attachmentIdentifier = "synzapp-notification-logo"
  private static let resourceName = "notification-logo"
  private static let resourceExtension = "png"

  static func attach(to content: UNMutableNotificationContent) {
    guard let sourceUrl = logoResourceUrl() else {
      return
    }

    let temporaryUrl = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
      .appendingPathComponent("\(attachmentIdentifier)-\(UUID().uuidString).png")

    do {
      try FileManager.default.copyItem(at: sourceUrl, to: temporaryUrl)
      let attachment = try UNNotificationAttachment(
        identifier: attachmentIdentifier,
        url: temporaryUrl,
        options: nil
      )

      content.attachments = [attachment] + content.attachments
    } catch {
      return
    }
  }

  private static func logoResourceUrl() -> URL? {
    Bundle.main.url(forResource: resourceName, withExtension: resourceExtension) ??
      Bundle.main.url(
        forResource: resourceName,
        withExtension: resourceExtension,
        subdirectory: "assets"
      )
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
      stringField("notificationPreviewAlgorithm", in: userInfo) == expectedAlgorithm,
      stringField("notificationPreviewVersion", in: userInfo) == "1",
      let ciphertext = decodeBase64Field("notificationPreviewCiphertext", in: userInfo),
      let nonce = decodeBase64Field("notificationPreviewNonce", in: userInfo),
      let senderPublicKeyData = decodeBase64Field(
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

  private static func decodeBase64Field(_ key: String, in userInfo: [AnyHashable: Any]) -> Data? {
    guard let value = stringField(key, in: userInfo) else {
      return nil
    }

    return Data(base64Encoded: value)
  }

  private static func stringField(_ key: String, in userInfo: [AnyHashable: Any]) -> String? {
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
