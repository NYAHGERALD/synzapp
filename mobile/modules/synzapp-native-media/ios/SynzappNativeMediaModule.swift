import ExpoModulesCore
import AVFoundation
import CryptoKit
import Foundation
import Photos
import PhotosUI
import Security
import UniformTypeIdentifiers
import UIKit

public final class SynzappNativeMediaModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SynzappNativeMedia")

    Events("onSynzappNativeMediaPreparationEvent", "onSynzappNativeMediaTranscodeEvent")

    /// Where chat media is kept so it survives.
    ///
    /// Application Support is not purged by iOS the way Caches is, and is not
    /// visible in the Files app. It is excluded from iCloud and iTunes backups
    /// so an employee's personal backup never carries company media.
    AsyncFunction("getPersistentMediaDirectory") { () -> String? in
      guard var directory = try? FileManager.default.url(
        for: .applicationSupportDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      ).appendingPathComponent("SynzappMedia", isDirectory: true) else {
        return nil
      }

      do {
        try FileManager.default.createDirectory(
          at: directory,
          withIntermediateDirectories: true,
          attributes: nil
        )

        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        try directory.setResourceValues(resourceValues)
      } catch {
        // The directory still works if the backup flag could not be set; losing
        // persistence entirely would be the worse outcome.
        return directory.absoluteString
      }

      return directory.absoluteString
    }

    AsyncFunction("readVideoPoster") { (input: [String: Any]) -> [String: Any]? in
      SynzappVideoPoster.read(input)
    }

    AsyncFunction("isAvailable") { () -> Bool in
      true
    }

    AsyncFunction("getMediaPipelineCapabilities") { () -> [String: Any] in
      [
        "backgroundMultipartUploadWorkerAvailable": true,
        "killedAppSecretboxWorkerAvailable": false,
        "nativeAeadMediaEncryptionAvailable": true,
        "nativeAeadMediaEncryptionMode": "native-chacha20poly1305-chunked-v1",
        "reason": "Legacy Secretbox media remains JavaScript-compatible. New large media can use native versioned ChaCha20-Poly1305 chunk encryption without changing old media semantics.",
        "secretboxAlgorithm": "nacl-secretbox-xsalsa20-poly1305",
        "videoTranscodingAvailable": true
      ]
    }

    AsyncFunction("pickMediaAssets") { (input: [String: Any]?, promise: Promise) in
      DispatchQueue.main.async {
        SynzappNativeMediaPicker.shared.present(input: input ?? [:], promise: promise)
      }
    }

    AsyncFunction("prepareMediaAsset") { (input: [String: Any], promise: Promise) in
      SynzappNativeMediaAssetPreparer.shared.prepare(input: input) { [weak self] body in
        self?.sendEvent("onSynzappNativeMediaPreparationEvent", body)
      } promise: { result in
        switch result {
        case .success(let payload):
          promise.resolve(payload)
        case .failure(let error):
          promise.reject("prepare_failed", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cancelMediaAssetPreparation") { (input: [String: Any]) -> Bool in
      SynzappNativeMediaAssetPreparer.shared.cancel(input: input) { [weak self] body in
        self?.sendEvent("onSynzappNativeMediaPreparationEvent", body)
      }
    }

    AsyncFunction("encryptMediaFile") { (input: [String: Any], promise: Promise) in
      DispatchQueue.global(qos: .utility).async {
        do {
          let payload = try SynzappNativeMediaCrypto.shared.encrypt(input: input)
          promise.resolve(payload)
        } catch {
          promise.reject("encrypt_failed", error.localizedDescription)
        }
      }
    }

    AsyncFunction("decryptMediaFile") { (input: [String: Any], promise: Promise) in
      DispatchQueue.global(qos: .utility).async {
        do {
          let payload = try SynzappNativeMediaCrypto.shared.decrypt(input: input)
          promise.resolve(payload)
        } catch {
          promise.reject("decrypt_failed", error.localizedDescription)
        }
      }
    }

    AsyncFunction("transcodeVideo") { (input: [String: Any], promise: Promise) in
      SynzappNativeVideoTranscoder.shared.transcode(input: input) { [weak self] body in
        self?.sendEvent("onSynzappNativeMediaTranscodeEvent", body)
      } promise: { result in
        switch result {
        case .success(let payload):
          promise.resolve(payload)
        case .failure(let error):
          promise.reject("transcode_failed", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cancelVideoTranscode") { (input: [String: Any]) -> Bool in
      let requestId = (input["requestId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

      guard !requestId.isEmpty else {
        return false
      }

      return SynzappNativeVideoTranscoder.shared.cancel(requestId: requestId)
    }
  }
}

private final class SynzappNativeMediaPicker: NSObject, PHPickerViewControllerDelegate {
  static let shared = SynzappNativeMediaPicker()

  private var activePromise: Promise?

  func present(input: [String: Any], promise: Promise) {
    guard activePromise == nil else {
      promise.reject("picker_active", "A media picker is already open.")
      return
    }

    // PHPickerViewController itself needs no permission - it runs out of
    // process. But the picker results are only useful to us as asset
    // identifiers, and resolving those through PHAsset.fetchAssets DOES require
    // authorization. Presenting first meant the system prompt appeared *after*
    // the user had already chosen a video, the hydration came back empty, and
    // the picker had to be reopened - the library was effectively asked for
    // twice. Settle authorization up front, once, before anything is shown.
    resolvePhotoLibraryAuthorization { [weak self] status in
      guard let self else {
        promise.reject("picker_unavailable", "Synzapp could not open the media picker.")
        return
      }

      switch status {
      case .authorized, .limited:
        self.presentPicker(input: input, promise: promise)
      default:
        promise.reject(
          "photo_access_denied",
          "Synzapp needs access to your photos to send media. Turn on Photos access for Synzapp in Settings."
        )
      }
    }
  }

  /// Resolves the current photo-library authorization, prompting only when the
  /// user has never been asked. Always calls back on the main queue.
  private func resolvePhotoLibraryAuthorization(
    completion: @escaping (PHAuthorizationStatus) -> Void
  ) {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)

    guard status == .notDetermined else {
      DispatchQueue.main.async { completion(status) }
      return
    }

    PHPhotoLibrary.requestAuthorization(for: .readWrite) { nextStatus in
      DispatchQueue.main.async { completion(nextStatus) }
    }
  }

  /// Presents the picker once the app actually has somewhere to present from.
  ///
  /// Immediately after the system permission alert is dismissed there is a
  /// window where the top view controller is still transitioning, so presenting
  /// fails: the user granted access and was told Synzapp could not open the
  /// picker, then had to tap again. Waiting briefly for a settled presenter
  /// removes that second tap.
  private func presentPicker(input: [String: Any], promise: Promise, attempt: Int = 0) {
    let presenter = currentViewController()
    let isPresenterBusy = presenter?.presentedViewController != nil ||
      presenter?.isBeingDismissed == true ||
      presenter?.isBeingPresented == true

    guard let presenter, !isPresenterBusy else {
      // ~1.5s of retries at 100ms. Long enough for a dismissal animation,
      // short enough that a genuine failure still reports quickly.
      guard attempt < 15 else {
        promise.reject("presenter_unavailable", "Synzapp could not open the media picker.")
        return
      }

      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
        self?.presentPicker(input: input, promise: promise, attempt: attempt + 1)
      }
      return
    }

    activePromise = promise

    var configuration = PHPickerConfiguration(photoLibrary: .shared())
    configuration.filter = .any(of: [.images, .videos])
    configuration.preferredAssetRepresentationMode = .current
    configuration.selection = .ordered
    configuration.selectionLimit = normalizedLimit(input["limit"])

    let picker = PHPickerViewController(configuration: configuration)
    picker.delegate = self
    presenter.present(picker, animated: true) { [weak self] in
      // If the picker never actually appeared, release the slot. Leaving it
      // held is what made the next attempt report "a media picker is already
      // open" — a failure that then blocked every retry.
      guard let self, picker.viewIfLoaded?.window == nil else {
        return
      }

      if self.activePromise != nil {
        self.activePromise = nil
        promise.reject("presenter_unavailable", "Synzapp could not open the media picker.")
      }
    }
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)

    guard let promise = activePromise else {
      return
    }

    activePromise = nil

    if results.isEmpty {
      promise.resolve([
        "assets": [],
        "canceled": true
      ])
      return
    }

    hydrateAssets(results: results) { assets in
      promise.resolve([
        "assets": assets,
        "canceled": false
      ])
    }
  }

  private func hydrateAssets(results: [PHPickerResult], completion: @escaping ([[String: Any]]) -> Void) {
    let identifiers = results.compactMap { $0.assetIdentifier }

    guard !identifiers.isEmpty else {
      completion([])
      return
    }

    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: identifiers, options: nil)
    var assetByIdentifier: [String: PHAsset] = [:]

    fetchResult.enumerateObjects { asset, _, _ in
      assetByIdentifier[asset.localIdentifier] = asset
    }

    let group = DispatchGroup()
    var hydratedAssets = Array(repeating: [String: Any](), count: results.count)

    for (index, result) in results.enumerated() {
      guard
        let assetIdentifier = result.assetIdentifier,
        let asset = assetByIdentifier[assetIdentifier]
      else {
        continue
      }

      group.enter()
      buildAssetPayload(asset: asset, itemProvider: result.itemProvider) { payload in
        hydratedAssets[index] = payload
        group.leave()
      }
    }

    group.notify(queue: .main) {
      completion(hydratedAssets.filter { payload in
        guard let identifier = payload["assetIdentifier"] as? String else {
          return false
        }

        return !identifier.isEmpty
      })
    }
  }

  private func buildAssetPayload(
    asset: PHAsset,
    itemProvider: NSItemProvider,
    completion: @escaping ([String: Any]) -> Void
  ) {
    var payload: [String: Any] = [
      "assetIdentifier": asset.localIdentifier,
      "height": asset.pixelHeight,
      "kind": asset.mediaType == .video ? "video" : "image",
      "width": asset.pixelWidth
    ]

    if asset.mediaType == .video {
      payload["durationMs"] = max(0, Int(asset.duration * 1000))
    }

    if let resource = PHAssetResource.assetResources(for: asset).first {
      payload["contentType"] = mimeType(for: resource.uniformTypeIdentifier, mediaType: asset.mediaType)
      payload["fileName"] = resource.originalFilename
    } else {
      let fallbackType = itemProvider.registeredTypeIdentifiers.first ?? (
        asset.mediaType == .video ? UTType.movie.identifier : UTType.image.identifier
      )
      payload["contentType"] = mimeType(for: fallbackType, mediaType: asset.mediaType)
      payload["fileName"] = asset.mediaType == .video ? "video.mov" : "photo.jpg"
    }

    requestThumbnail(asset: asset) { thumbnailDataUrl in
      if let thumbnailDataUrl {
        payload["thumbnailDataUrl"] = thumbnailDataUrl
      }

      completion(payload)
    }
  }

  private func requestThumbnail(asset: PHAsset, completion: @escaping (String?) -> Void) {
    let options = PHImageRequestOptions()
    options.deliveryMode = .fastFormat
    options.isNetworkAccessAllowed = false
    options.resizeMode = .fast

    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: 420, height: 420),
      contentMode: .aspectFill,
      options: options
    ) { image, _ in
      guard let image, let data = image.jpegData(compressionQuality: 0.58) else {
        completion(nil)
        return
      }

      completion("data:image/jpeg;base64,\(data.base64EncodedString())")
    }
  }

  private func normalizedLimit(_ value: Any?) -> Int {
    guard let numericValue = value as? Int else {
      return 10
    }

    return max(1, min(numericValue, 10))
  }

  private func mimeType(for identifier: String, mediaType: PHAssetMediaType) -> String {
    if let mimeType = UTType(identifier)?.preferredMIMEType {
      return mimeType
    }

    return mediaType == .video ? "video/quicktime" : "image/jpeg"
  }

  private func currentViewController() -> UIViewController? {
    let activeScene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }

    let rootViewController = activeScene?.windows.first { $0.isKeyWindow }?.rootViewController

    return topViewController(from: rootViewController)
  }

  private func topViewController(from viewController: UIViewController?) -> UIViewController? {
    if let navigationController = viewController as? UINavigationController {
      return topViewController(from: navigationController.visibleViewController)
    }

    if let tabBarController = viewController as? UITabBarController {
      return topViewController(from: tabBarController.selectedViewController)
    }

    if let presentedViewController = viewController?.presentedViewController {
      return topViewController(from: presentedViewController)
    }

    return viewController
  }
}

private final class SynzappNativeMediaAssetPreparer {
  static let shared = SynzappNativeMediaAssetPreparer()

  private let queue = DispatchQueue(label: "com.synzapp.native-media.prepare", qos: .utility)
  private let activeLock = NSLock()
  private var activeCancelled = Set<String>()
  private var activeImageRequests: [String: PHImageRequestID] = [:]
  private var activeRequests: [String: PHAssetResourceDataRequestID] = [:]

  func prepare(
    input: [String: Any],
    eventHandler: @escaping ([String: Any]) -> Void,
    promise completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    guard let assetIdentifier = (input["assetIdentifier"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
          !assetIdentifier.isEmpty else {
      completion(.failure(SynzappNativeMediaError.invalidInput("assetIdentifier is required.")))
      return
    }

    emit(
      eventHandler,
      assetIdentifier: assetIdentifier,
      status: "running",
      progress: 0.01,
      message: "Preparing media."
    )

    queue.async {
      let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [assetIdentifier], options: nil)
      guard let asset = fetchResult.firstObject else {
        self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: "Selected media is no longer available.")
        completion(.failure(SynzappNativeMediaError.assetUnavailable))
        return
      }

      guard let resource = self.preferredResource(for: asset) else {
        self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: "Selected media could not be prepared.")
        completion(.failure(SynzappNativeMediaError.resourceUnavailable))
        return
      }

      do {
        let destinationUrl = try self.destinationUrl(assetIdentifier: assetIdentifier, resource: resource, input: input)
        try? FileManager.default.removeItem(at: destinationUrl)

        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true
        options.progressHandler = { progress in
          self.emit(
            eventHandler,
            assetIdentifier: assetIdentifier,
            status: "running",
            progress: max(0.02, min(0.98, progress)),
            message: "Downloading media."
          )
        }

        guard FileManager.default.createFile(atPath: destinationUrl.path, contents: nil, attributes: nil) else {
          self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: "Synzapp could not create a local media cache file.")
          completion(.failure(SynzappNativeMediaError.cacheUnavailable))
          return
        }

        let fileHandle: FileHandle
        do {
          fileHandle = try FileHandle(forWritingTo: destinationUrl)
        } catch {
          self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: error.localizedDescription)
          completion(.failure(error))
          return
        }

        let requestId = PHAssetResourceManager.default().requestData(
          for: resource,
          options: options,
          dataReceivedHandler: { data in
            fileHandle.write(data)
          },
          completionHandler: { error in
            try? fileHandle.close()

            if self.clearActiveRequest(assetIdentifier: assetIdentifier) {
              try? FileManager.default.removeItem(at: destinationUrl)
              completion(.failure(SynzappNativeMediaError.cancelled))
              return
            }

            if let error {
              try? FileManager.default.removeItem(at: destinationUrl)
              if asset.mediaType == .video {
                self.prepareVideoWithImageManager(
                  asset: asset,
                  assetIdentifier: assetIdentifier,
                  destinationUrl: destinationUrl,
                  eventHandler: eventHandler,
                  completion: completion
                )
              } else {
                self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: error.localizedDescription)
                completion(.failure(error))
              }
              return
            }

            self.completePreparedMedia(
              asset: asset,
              assetIdentifier: assetIdentifier,
              destinationUrl: destinationUrl,
              contentType: self.mimeType(for: resource.uniformTypeIdentifier, mediaType: asset.mediaType),
              eventHandler: eventHandler,
              completion: completion
            )
          }
        )

        self.setActiveRequest(assetIdentifier: assetIdentifier, requestId: requestId)
      } catch {
        self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: error.localizedDescription)
        completion(.failure(error))
      }
    }
  }

  func cancel(input: [String: Any], eventHandler: @escaping ([String: Any]) -> Void) -> Bool {
    guard let assetIdentifier = (input["assetIdentifier"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
          !assetIdentifier.isEmpty else {
      return false
    }

    activeLock.lock()
    let requestId = activeRequests[assetIdentifier]
    let imageRequestId = activeImageRequests[assetIdentifier]
    if requestId != nil {
      activeCancelled.insert(assetIdentifier)
    }
    if imageRequestId != nil {
      activeCancelled.insert(assetIdentifier)
    }
    activeLock.unlock()

    if let requestId {
      PHAssetResourceManager.default().cancelDataRequest(requestId)
    }
    if let imageRequestId {
      PHImageManager.default().cancelImageRequest(imageRequestId)
    }

    guard requestId != nil || imageRequestId != nil else {
      return false
    }

    emit(
      eventHandler,
      assetIdentifier: assetIdentifier,
      status: "cancelled",
      progress: 0,
      message: "Media preparation was cancelled."
    )

    return true
  }

  private func prepareVideoWithImageManager(
    asset: PHAsset,
    assetIdentifier: String,
    destinationUrl: URL,
    eventHandler: @escaping ([String: Any]) -> Void,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    emit(
      eventHandler,
      assetIdentifier: assetIdentifier,
      status: "running",
      progress: 0.03,
      message: "Downloading video."
    )

    let options = PHVideoRequestOptions()
    options.deliveryMode = .automatic
    options.isNetworkAccessAllowed = true
    options.version = .current
    options.progressHandler = { progress, _, _, _ in
      self.emit(
        eventHandler,
        assetIdentifier: assetIdentifier,
        status: "running",
        progress: max(0.03, min(0.92, progress * 0.92)),
        message: "Downloading video."
      )
    }

    let requestId = PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, info in
      let wasCancelled = self.clearActiveImageRequest(assetIdentifier: assetIdentifier)
      if wasCancelled {
        try? FileManager.default.removeItem(at: destinationUrl)
        completion(.failure(SynzappNativeMediaError.cancelled))
        return
      }

      if let error = info?[PHImageErrorKey] as? Error {
        try? FileManager.default.removeItem(at: destinationUrl)
        self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: error.localizedDescription)
        completion(.failure(error))
        return
      }

      guard let avAsset else {
        try? FileManager.default.removeItem(at: destinationUrl)
        self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: "iOS could not prepare this video from Photos.")
        completion(.failure(SynzappNativeMediaError.assetUnavailable))
        return
      }

      self.emit(
        eventHandler,
        assetIdentifier: assetIdentifier,
        status: "running",
        progress: 0.94,
        message: "Preparing video."
      )

      if let urlAsset = avAsset as? AVURLAsset {
        self.copyPreparedVideo(
          from: urlAsset.url,
          asset: asset,
          assetIdentifier: assetIdentifier,
          destinationUrl: destinationUrl,
          eventHandler: eventHandler,
          completion: completion
        )
        return
      }

      self.exportPreparedVideo(
        avAsset,
        asset: asset,
        assetIdentifier: assetIdentifier,
        destinationUrl: destinationUrl,
        eventHandler: eventHandler,
        completion: completion
      )
    }

    setActiveImageRequest(assetIdentifier: assetIdentifier, requestId: requestId)
  }

  private func copyPreparedVideo(
    from sourceUrl: URL,
    asset: PHAsset,
    assetIdentifier: String,
    destinationUrl: URL,
    eventHandler: @escaping ([String: Any]) -> Void,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    queue.async {
      do {
        try? FileManager.default.removeItem(at: destinationUrl)
        try FileManager.default.copyItem(at: sourceUrl, to: destinationUrl)
        self.completePreparedMedia(
          asset: asset,
          assetIdentifier: assetIdentifier,
          destinationUrl: destinationUrl,
          contentType: self.mimeType(for: UTType(filenameExtension: destinationUrl.pathExtension)?.identifier ?? UTType.movie.identifier, mediaType: .video),
          eventHandler: eventHandler,
          completion: completion
        )
      } catch {
        try? FileManager.default.removeItem(at: destinationUrl)
        self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: error.localizedDescription)
        completion(.failure(error))
      }
    }
  }

  private func exportPreparedVideo(
    _ avAsset: AVAsset,
    asset: PHAsset,
    assetIdentifier: String,
    destinationUrl: URL,
    eventHandler: @escaping ([String: Any]) -> Void,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    guard let exportSession = AVAssetExportSession(asset: avAsset, presetName: AVAssetExportPresetPassthrough) else {
      emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: "iOS could not create a video export session.")
      completion(.failure(SynzappNativeMediaError.resourceUnavailable))
      return
    }

    let outputUrl = destinationUrl.deletingPathExtension().appendingPathExtension("mov")
    try? FileManager.default.removeItem(at: outputUrl)

    exportSession.outputURL = outputUrl
    exportSession.outputFileType = .mov
    exportSession.shouldOptimizeForNetworkUse = true

    exportSession.exportAsynchronously {
      switch exportSession.status {
      case .completed:
        self.completePreparedMedia(
          asset: asset,
          assetIdentifier: assetIdentifier,
          destinationUrl: outputUrl,
          contentType: "video/quicktime",
          eventHandler: eventHandler,
          completion: completion
        )
      case .cancelled:
        try? FileManager.default.removeItem(at: outputUrl)
        completion(.failure(SynzappNativeMediaError.cancelled))
      default:
        try? FileManager.default.removeItem(at: outputUrl)
        let error = exportSession.error ?? SynzappNativeMediaError.resourceUnavailable
        self.emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: error.localizedDescription)
        completion(.failure(error))
      }
    }
  }

  /// The name a person should see for this asset.
  ///
  /// Prefers the original filename recorded by Photos. Falls back to the cache
  /// file name with the asset-identifier prefix stripped, and finally to a plain
  /// generic name - never a bare asset identifier.
  private func displayFileName(
    for asset: PHAsset,
    destinationUrl: URL,
    assetIdentifier: String
  ) -> String {
    let resources = PHAssetResource.assetResources(for: asset)
    let originalName = resources
      .first { !$0.originalFilename.trimmingCharacters(in: .whitespaces).isEmpty }?
      .originalFilename
      .trimmingCharacters(in: .whitespaces)

    if let originalName, !originalName.isEmpty {
      return originalName
    }

    let cacheName = destinationUrl.lastPathComponent
    let identifierPrefix = "\(sanitizedIdentifier(assetIdentifier))-"

    if cacheName.hasPrefix(identifierPrefix) {
      let stripped = String(cacheName.dropFirst(identifierPrefix.count))

      if !stripped.isEmpty {
        return stripped
      }
    }

    let fileExtension = destinationUrl.pathExtension
    let fallbackBase = asset.mediaType == .video ? "video" : "photo"

    return fileExtension.isEmpty ? fallbackBase : "\(fallbackBase).\(fileExtension)"
  }

  private func completePreparedMedia(
    asset: PHAsset,
    assetIdentifier: String,
    destinationUrl: URL,
    contentType: String,
    eventHandler: @escaping ([String: Any]) -> Void,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    do {
      let attributes = try FileManager.default.attributesOfItem(atPath: destinationUrl.path)
      let sizeBytes = attributes[.size] as? NSNumber
      let kind = asset.mediaType == .video ? "video" : "image"
      // The on-disk name carries the PHAsset identifier so cache entries stay
      // unique. That name must NOT be what the user sees - it leaks a raw asset
      // identifier into the chat bubble and the Library
      // ("05A54858-939C-...-L0-001-clip.mp4"). Report the original filename and
      // let the cache keep its own naming scheme.
      let fileName = displayFileName(
        for: asset,
        destinationUrl: destinationUrl,
        assetIdentifier: assetIdentifier
      )
      let payload: [String: Any] = [
        "assetIdentifier": assetIdentifier,
        "contentType": contentType,
        "fileName": fileName,
        "fileUri": destinationUrl.absoluteString,
        "height": asset.pixelHeight,
        "kind": kind,
        "sizeBytes": sizeBytes?.int64Value ?? 0,
        "width": asset.pixelWidth
      ]

      emit(
        eventHandler,
        assetIdentifier: assetIdentifier,
        status: "completed",
        progress: 1,
        fileUri: destinationUrl.absoluteString,
        fileName: fileName,
        contentType: contentType,
        sizeBytes: sizeBytes?.int64Value
      )
      completion(.success(payload))
    } catch {
      emitFailed(eventHandler, assetIdentifier: assetIdentifier, message: error.localizedDescription)
      completion(.failure(error))
    }
  }

  private func preferredResource(for asset: PHAsset) -> PHAssetResource? {
    let resources = PHAssetResource.assetResources(for: asset)
    if asset.mediaType == .video {
      return resources.first { $0.type == .video || $0.type == .fullSizeVideo } ?? resources.first
    }

    return resources.first { $0.type == .photo || $0.type == .fullSizePhoto } ?? resources.first
  }

  private func destinationUrl(
    assetIdentifier: String,
    resource: PHAssetResource,
    input: [String: Any]
  ) throws -> URL {
    let cacheRoot = try FileManager.default.url(
      for: .cachesDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    ).appendingPathComponent("SynzappNativeMedia", isDirectory: true)

    try FileManager.default.createDirectory(at: cacheRoot, withIntermediateDirectories: true, attributes: nil)

    let requestedName = (input["fileName"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    let baseName = requestedName?.isEmpty == false ? requestedName! : resource.originalFilename
    let identifierPrefix = sanitizedIdentifier(assetIdentifier)
    let fileName = "\(identifierPrefix)-\(sanitizedFileName(baseName, fallback: identifierPrefix))"

    return cacheRoot.appendingPathComponent(fileName, isDirectory: false)
  }

  private func setActiveRequest(assetIdentifier: String, requestId: PHAssetResourceDataRequestID) {
    activeLock.lock()
    activeCancelled.remove(assetIdentifier)
    activeRequests[assetIdentifier] = requestId
    activeLock.unlock()
  }

  private func clearActiveRequest(assetIdentifier: String) -> Bool {
    activeLock.lock()
    activeRequests.removeValue(forKey: assetIdentifier)
    let wasCancelled = activeCancelled.remove(assetIdentifier) != nil
    activeLock.unlock()
    return wasCancelled
  }

  private func setActiveImageRequest(assetIdentifier: String, requestId: PHImageRequestID) {
    activeLock.lock()
    activeCancelled.remove(assetIdentifier)
    activeImageRequests[assetIdentifier] = requestId
    activeLock.unlock()
  }

  private func clearActiveImageRequest(assetIdentifier: String) -> Bool {
    activeLock.lock()
    activeImageRequests.removeValue(forKey: assetIdentifier)
    let wasCancelled = activeCancelled.remove(assetIdentifier) != nil
    activeLock.unlock()
    return wasCancelled
  }

  private func sanitizedFileName(_ value: String, fallback: String) -> String {
    let sanitized = value
      .components(separatedBy: CharacterSet(charactersIn: "/:\\?%*|\"<>"))
      .joined(separator: "-")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    return sanitized.isEmpty ? fallback : sanitized
  }

  private func sanitizedIdentifier(_ value: String) -> String {
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
    let scalars = value.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" }
    let sanitized = String(scalars).trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    return sanitized.isEmpty ? UUID().uuidString : sanitized
  }

  private func mimeType(for identifier: String, mediaType: PHAssetMediaType) -> String {
    if let mimeType = UTType(identifier)?.preferredMIMEType {
      return mimeType
    }

    return mediaType == .video ? "video/quicktime" : "image/jpeg"
  }

  private func emit(
    _ eventHandler: @escaping ([String: Any]) -> Void,
    assetIdentifier: String,
    status: String,
    progress: Double,
    fileUri: String? = nil,
    fileName: String? = nil,
    contentType: String? = nil,
    sizeBytes: Int64? = nil,
    message: String? = nil
  ) {
    DispatchQueue.main.async {
      var body: [String: Any] = [
        "assetIdentifier": assetIdentifier,
        "progress": progress,
        "status": status
      ]

      if let fileUri {
        body["fileUri"] = fileUri
      }
      if let fileName {
        body["fileName"] = fileName
      }
      if let contentType {
        body["contentType"] = contentType
      }
      if let sizeBytes {
        body["sizeBytes"] = sizeBytes
      }
      if let message {
        body["message"] = message
      }

      eventHandler(body)
    }
  }

  private func emitFailed(
    _ eventHandler: @escaping ([String: Any]) -> Void,
    assetIdentifier: String,
    message: String
  ) {
    emit(
      eventHandler,
      assetIdentifier: assetIdentifier,
      status: "failed",
      progress: 0,
      message: message
    )
  }
}

private enum SynzappNativeMediaError: LocalizedError {
  case assetUnavailable
  case cacheUnavailable
  case cancelled
  case invalidInput(String)
  case resourceUnavailable

  var errorDescription: String? {
    switch self {
    case .assetUnavailable:
      return "Selected media is no longer available."
    case .cacheUnavailable:
      return "Synzapp could not create a local media cache file."
    case .cancelled:
      return "Media preparation was cancelled."
    case .invalidInput(let message):
      return message
    case .resourceUnavailable:
      return "Selected media could not be prepared."
    }
  }
}

private final class SynzappNativeMediaCrypto {
  static let shared = SynzappNativeMediaCrypto()

  private let mode = "native-chacha20poly1305-chunked-v1"
  private let tagLength = 16
  private let defaultChunkSize = 8 * 1024 * 1024

  func encrypt(input: [String: Any]) throws -> [String: Any] {
    let sourceUri = try stringValue(input["sourceUri"], name: "sourceUri")
    let sourceUrl = try fileUrl(from: sourceUri)
    let chunkSizeBytes = normalizedChunkSize(input["chunkSizeBytes"])
    let outputUrl = try cacheUrl(prefix: "native_aead_upload", fileName: input["fileName"] as? String, extensionName: "bin")
    let keyData = try randomData(count: 32)
    let key = SymmetricKey(data: keyData)
    let inputHandle = try FileHandle(forReadingFrom: sourceUrl)
    FileManager.default.createFile(atPath: outputUrl.path, contents: nil)
    let outputHandle = try FileHandle(forWritingTo: outputUrl)
    var partNonces: [String] = []
    var encryptedSizeBytes: Int64 = 0

    defer {
      try? inputHandle.close()
      try? outputHandle.close()
    }

    while true {
      autoreleasepool {
      }

      guard let plainData = try inputHandle.read(upToCount: chunkSizeBytes), !plainData.isEmpty else {
        break
      }

      let nonceData = try randomData(count: 12)
      let nonce = try ChaChaPoly.Nonce(data: nonceData)
      let sealedBox = try ChaChaPoly.seal(plainData, using: key, nonce: nonce)

      try outputHandle.write(contentsOf: sealedBox.ciphertext)
      try outputHandle.write(contentsOf: sealedBox.tag)
      partNonces.append(nonceData.base64EncodedString())
      encryptedSizeBytes += Int64(sealedBox.ciphertext.count + sealedBox.tag.count)
    }

    if partNonces.isEmpty {
      let nonceData = try randomData(count: 12)
      let nonce = try ChaChaPoly.Nonce(data: nonceData)
      let sealedBox = try ChaChaPoly.seal(Data(), using: key, nonce: nonce)
      try outputHandle.write(contentsOf: sealedBox.tag)
      partNonces.append(nonceData.base64EncodedString())
      encryptedSizeBytes += Int64(sealedBox.tag.count)
    }

    return [
      "chunkSizeBytes": chunkSizeBytes,
      "encryptedFileUri": outputUrl.absoluteString,
      "encryptedSizeBytes": encryptedSizeBytes,
      "encryptionMode": mode,
      "key": keyData.base64EncodedString(),
      "partCount": partNonces.count,
      "partNonces": partNonces
    ]
  }

  func decrypt(input: [String: Any]) throws -> [String: Any] {
    let encryptedFileUri = try stringValue(input["encryptedFileUri"], name: "encryptedFileUri")
    let encryptedFileUrl = try fileUrl(from: encryptedFileUri)
    let keyData = try Data(base64EncodedStrict: try stringValue(input["key"], name: "key"))
    let key = SymmetricKey(data: keyData)
    let chunkSizeBytes = normalizedChunkSize(input["chunkSizeBytes"])
    let originalSizeBytes = try int64Value(input["originalSizeBytes"], name: "originalSizeBytes")
    let partCount = try intValue(input["partCount"], name: "partCount")
    guard let partNonces = input["partNonces"] as? [String], partNonces.count == partCount else {
      throw SynzappNativeMediaCryptoError.invalidInput("partNonces must match partCount.")
    }

    let outputUrl = try cacheUrl(prefix: "native_aead_plain", fileName: input["fileName"] as? String, extensionName: nil)
    let inputHandle = try FileHandle(forReadingFrom: encryptedFileUrl)
    FileManager.default.createFile(atPath: outputUrl.path, contents: nil)
    let outputHandle = try FileHandle(forWritingTo: outputUrl)
    var remainingPlainBytes = originalSizeBytes

    defer {
      try? inputHandle.close()
      try? outputHandle.close()
    }

    for partIndex in 0..<partCount {
      let plainLength = Int(min(Int64(chunkSizeBytes), max(remainingPlainBytes, 0)))
      let encryptedLength = plainLength + tagLength
      let sealedData = try inputHandle.readExactly(count: encryptedLength)
      let ciphertext = sealedData.prefix(plainLength)
      let tag = sealedData.suffix(tagLength)
      let nonceData = try Data(base64EncodedStrict: partNonces[partIndex])
      let nonce = try ChaChaPoly.Nonce(data: nonceData)
      let sealedBox = try ChaChaPoly.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
      let plaintext = try ChaChaPoly.open(sealedBox, using: key)
      try outputHandle.write(contentsOf: plaintext)
      remainingPlainBytes -= Int64(plainLength)
    }

    let attributes = try FileManager.default.attributesOfItem(atPath: outputUrl.path)
    let sizeBytes = attributes[.size] as? Int64 ?? originalSizeBytes

    return [
      "fileUri": outputUrl.absoluteString,
      "sizeBytes": sizeBytes
    ]
  }

  private func normalizedChunkSize(_ value: Any?) -> Int {
    guard let number = value as? NSNumber else {
      return defaultChunkSize
    }

    return min(max(number.intValue, 512 * 1024), 32 * 1024 * 1024)
  }

  private func cacheUrl(prefix: String, fileName: String?, extensionName: String?) throws -> URL {
    let cacheRoot = try FileManager.default.url(
      for: .cachesDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    ).appendingPathComponent("SynzappNativeMedia", isDirectory: true)

    try FileManager.default.createDirectory(at: cacheRoot, withIntermediateDirectories: true, attributes: nil)

    let safeName = sanitizeFileName(fileName)
    let suffix = extensionName ?? fileExtension(from: safeName)
    let base = "\(prefix)_\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString)"
    let outputName = suffix.isEmpty ? base : "\(base).\(suffix)"

    return cacheRoot.appendingPathComponent(outputName, isDirectory: false)
  }

  private func fileUrl(from uri: String) throws -> URL {
    guard let url = URL(string: uri), url.isFileURL else {
      throw SynzappNativeMediaCryptoError.invalidInput("Only local file URIs are supported.")
    }

    return url
  }

  private func stringValue(_ value: Any?, name: String) throws -> String {
    guard let value = value as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw SynzappNativeMediaCryptoError.invalidInput("\(name) is required.")
    }

    return value
  }

  private func intValue(_ value: Any?, name: String) throws -> Int {
    guard let number = value as? NSNumber, number.intValue > 0 else {
      throw SynzappNativeMediaCryptoError.invalidInput("\(name) is required.")
    }

    return number.intValue
  }

  private func int64Value(_ value: Any?, name: String) throws -> Int64 {
    guard let number = value as? NSNumber, number.int64Value >= 0 else {
      throw SynzappNativeMediaCryptoError.invalidInput("\(name) is required.")
    }

    return number.int64Value
  }

  private func randomData(count: Int) throws -> Data {
    var data = Data(count: count)
    let status = data.withUnsafeMutableBytes { bytes in
      SecRandomCopyBytes(kSecRandomDefault, count, bytes.baseAddress!)
    }

    guard status == errSecSuccess else {
      throw SynzappNativeMediaCryptoError.cryptoUnavailable
    }

    return data
  }

  private func sanitizeFileName(_ value: String?) -> String {
    let fallback = "media"
    guard let value else {
      return fallback
    }

    let sanitized = value
      .components(separatedBy: CharacterSet(charactersIn: "/:\\?%*|\"<>"))
      .joined(separator: "-")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    return sanitized.isEmpty ? fallback : sanitized
  }

  private func fileExtension(from fileName: String) -> String {
    let ext = URL(fileURLWithPath: fileName).pathExtension
    return ext.range(of: #"^[A-Za-z0-9]{1,12}$"#, options: .regularExpression) != nil ? ext : "bin"
  }
}

private enum SynzappNativeMediaCryptoError: LocalizedError {
  case cryptoUnavailable
  case invalidInput(String)

  var errorDescription: String? {
    switch self {
    case .cryptoUnavailable:
      return "Native media encryption is not available."
    case .invalidInput(let message):
      return message
    }
  }
}

private extension Data {
  init(base64EncodedStrict value: String) throws {
    guard let data = Data(base64Encoded: value), !data.isEmpty else {
      throw SynzappNativeMediaCryptoError.invalidInput("Invalid base64 data.")
    }

    self = data
  }
}

private extension FileHandle {
  func readExactly(count: Int) throws -> Data {
    guard count >= 0 else {
      throw SynzappNativeMediaCryptoError.invalidInput("Invalid read length.")
    }

    if count == 0 {
      return Data()
    }

    guard let data = try read(upToCount: count), data.count == count else {
      throw SynzappNativeMediaCryptoError.invalidInput("Encrypted media is incomplete.")
    }

    return data
  }
}
