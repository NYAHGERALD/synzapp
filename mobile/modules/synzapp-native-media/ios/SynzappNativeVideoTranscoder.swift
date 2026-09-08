import AVFoundation
import Foundation
import UIKit

enum SynzappNativeVideoTranscodeError: LocalizedError {
  case invalidInput(String)
  case unsupportedSource(String)
  case failed(String)
  case cancelled

  var errorDescription: String? {
    switch self {
    case .invalidInput(let message):
      return message
    case .unsupportedSource(let message):
      return message
    case .failed(let message):
      return message
    case .cancelled:
      return "Video transcoding was cancelled."
    }
  }
}

/// Compresses a picked video into a WhatsApp-sized H.264 + AAC MP4 before it
/// enters the encryption and upload pipeline.
///
/// The pipeline used to upload the original camera bytes, which for a one-minute
/// 1080p60 clip is 90 MB - 400 MB. Every one of those bytes had to be encrypted,
/// uploaded, and downloaded again by the recipient. Downscaling and re-encoding
/// first is what makes the transfer feel instant.
///
/// Scaling and rotation are done through an AVMutableVideoComposition so the GPU
/// does the resampling and frames arrive upright at the render size. The frame
/// duration also caps the output frame rate, which alone halves a 60 fps source.
final class SynzappNativeVideoTranscoder {
  static let shared = SynzappNativeVideoTranscoder()

  private let lock = NSLock()
  private var cancelledRequests = Set<String>()
  private var activeRequests = Set<String>()
  private let queue = DispatchQueue(label: "com.synzapp.nativemedia.transcode", qos: .userInitiated)
  private let progressQueue = DispatchQueue(label: "com.synzapp.nativemedia.transcode.progress", qos: .utility)

  func transcode(
    input: [String: Any],
    onEvent: @escaping ([String: Any]) -> Void,
    promise: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    queue.async { [weak self] in
      guard let self else {
        promise(.failure(SynzappNativeVideoTranscodeError.failed("Transcoder is unavailable.")))
        return
      }

      do {
        let payload = try self.run(input: input, onEvent: onEvent)
        promise(.success(payload))
      } catch {
        promise(.failure(error))
      }
    }
  }

  func cancel(requestId: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }

    guard activeRequests.contains(requestId) else {
      return false
    }

    cancelledRequests.insert(requestId)
    return true
  }

  // MARK: - Pipeline

  private func run(
    input: [String: Any],
    onEvent: @escaping ([String: Any]) -> Void
  ) throws -> [String: Any] {
    let requestId = (input["requestId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

    guard !requestId.isEmpty else {
      throw SynzappNativeVideoTranscodeError.invalidInput("A transcode requestId is required.")
    }

    guard let sourceUri = input["sourceUri"] as? String,
          let sourceUrl = URL(string: sourceUri),
          sourceUrl.isFileURL else {
      throw SynzappNativeVideoTranscodeError.invalidInput("Only local file URIs can be transcoded.")
    }

    beginRequest(requestId)
    defer { endRequest(requestId) }

    let asset = AVURLAsset(url: sourceUrl, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])

    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      throw SynzappNativeVideoTranscodeError.unsupportedSource("This file has no video track.")
    }

    let durationSeconds = CMTimeGetSeconds(asset.duration)

    guard durationSeconds.isFinite, durationSeconds > 0 else {
      throw SynzappNativeVideoTranscodeError.unsupportedSource("This video has no readable duration.")
    }

    let targetLongEdge = normalizedInt(input["targetLongEdge"], fallback: 848, minimum: 240, maximum: 3840)
    let targetVideoBitrate = normalizedInt(input["videoBitrate"], fallback: 2_000_000, minimum: 200_000, maximum: 40_000_000)
    let targetAudioBitrate = normalizedInt(input["audioBitrate"], fallback: 96_000, minimum: 32_000, maximum: 320_000)
    // frameRate is accepted for contract compatibility but the export preset
    // decides the output frame rate.

    let orientedSize = orientedNaturalSize(of: videoTrack)

    guard orientedSize.width >= 1, orientedSize.height >= 1 else {
      throw SynzappNativeVideoTranscodeError.unsupportedSource("This video has no readable dimensions.")
    }

    let sourceSizeBytes = fileSizeBytes(at: sourceUrl)
    let renderSize = targetRenderSize(for: orientedSize, longEdge: targetLongEdge)

    // Skip work that would not pay for itself. Re-encoding a clip that is
    // already small enough costs time and quality for no transfer benefit, and
    // can even make the file bigger.
    if shouldSkipTranscode(
      orientedSize: orientedSize,
      renderSize: renderSize,
      sourceSizeBytes: sourceSizeBytes,
      durationSeconds: durationSeconds,
      targetVideoBitrate: targetVideoBitrate,
      targetAudioBitrate: targetAudioBitrate
    ) {
      return [
        "durationMs": Int(durationSeconds * 1000),
        "fileUri": sourceUri,
        "height": Int(orientedSize.height),
        "sizeBytes": sourceSizeBytes,
        "transcoded": false,
        "width": Int(orientedSize.width)
      ]
    }

    let outputUrl = try makeOutputUrl(fileName: input["fileName"] as? String)
    try? FileManager.default.removeItem(at: outputUrl)

    do {
      try encode(
        asset: asset,
        outputUrl: outputUrl,
        presetName: exportPresetName(for: targetLongEdge),
        requestId: requestId,
        durationSeconds: durationSeconds,
        onEvent: onEvent
      )
    } catch {
      try? FileManager.default.removeItem(at: outputUrl)
      throw error
    }

    let outputSizeBytes = fileSizeBytes(at: outputUrl)

    // A transcode that produced a larger file is a loss. Keep the original.
    if sourceSizeBytes > 0, outputSizeBytes >= sourceSizeBytes {
      try? FileManager.default.removeItem(at: outputUrl)
      return [
        "durationMs": Int(durationSeconds * 1000),
        "fileUri": sourceUri,
        "height": Int(orientedSize.height),
        "sizeBytes": sourceSizeBytes,
        "transcoded": false,
        "width": Int(orientedSize.width)
      ]
    }

    emit(onEvent, requestId: requestId, progress: 1, status: "completed", fileUri: outputUrl.absoluteString)

    return [
      "durationMs": Int(durationSeconds * 1000),
      "fileUri": outputUrl.absoluteString,
      "height": Int(renderSize.height),
      "sizeBytes": outputSizeBytes,
      "transcoded": true,
      "width": Int(renderSize.width)
    ]
  }

  /// Compresses through AVAssetExportSession.
  ///
  /// This is Apple's hardware-accelerated export path. An earlier version drove
  /// AVAssetReader/AVAssetWriter through an AVMutableVideoComposition to get
  /// exact bitrate and frame-rate control, but routing every frame through the
  /// compositor is dramatically slower - it turned a few seconds of compression
  /// into around a minute of the send sitting in "preparing". The preset gives
  /// up fine-grained control and buys back the speed, which is the trade that
  /// matters here.
  private func encode(
    asset: AVURLAsset,
    outputUrl: URL,
    presetName: String,
    requestId: String,
    durationSeconds: Double,
    onEvent: @escaping ([String: Any]) -> Void
  ) throws {
    guard let exportSession = AVAssetExportSession(asset: asset, presetName: presetName) else {
      throw SynzappNativeVideoTranscodeError.unsupportedSource("This video cannot be compressed on this device.")
    }

    exportSession.outputURL = outputUrl
    exportSession.outputFileType = .mp4
    exportSession.shouldOptimizeForNetworkUse = true

    let group = DispatchGroup()
    group.enter()

    // Progress is polled rather than observed; AVAssetExportSession has no
    // callback for it.
    let progressTimer = DispatchSource.makeTimerSource(queue: progressQueue)
    progressTimer.schedule(deadline: .now() + 0.15, repeating: 0.15)
    progressTimer.setEventHandler { [weak self] in
      guard let self else { return }

      if self.isCancelled(requestId) {
        exportSession.cancelExport()
        return
      }

      self.emit(
        onEvent,
        requestId: requestId,
        progress: min(max(Double(exportSession.progress), 0), 0.99),
        status: "running",
        fileUri: nil
      )
    }
    progressTimer.resume()

    exportSession.exportAsynchronously {
      group.leave()
    }

    group.wait()
    progressTimer.cancel()

    switch exportSession.status {
    case .completed:
      return
    case .cancelled:
      throw SynzappNativeVideoTranscodeError.cancelled
    default:
      throw SynzappNativeVideoTranscodeError.failed(
        exportSession.error?.localizedDescription ?? "Video compression failed."
      )
    }
  }

  /// Picks the closest export preset for the requested long edge.
  private func exportPresetName(for longEdge: Int) -> String {
    if longEdge <= 560 {
      return AVAssetExportPreset640x480
    }

    if longEdge <= 1000 {
      return AVAssetExportPreset960x540
    }

    if longEdge <= 1500 {
      return AVAssetExportPreset1280x720
    }

    return AVAssetExportPreset1920x1080
  }

  // MARK: - Sizing

  private func orientedNaturalSize(of track: AVAssetTrack) -> CGSize {
    let transformed = track.naturalSize.applying(track.preferredTransform)

    return CGSize(width: abs(transformed.width).rounded(), height: abs(transformed.height).rounded())
  }

  private func targetRenderSize(for orientedSize: CGSize, longEdge: Int) -> CGSize {
    let longestSide = max(orientedSize.width, orientedSize.height)
    let scale = min(CGFloat(longEdge) / max(longestSide, 1), 1)

    // H.264 requires even dimensions.
    let width = max(2, (orientedSize.width * scale / 2).rounded() * 2)
    let height = max(2, (orientedSize.height * scale / 2).rounded() * 2)

    return CGSize(width: width, height: height)
  }

  private func shouldSkipTranscode(
    orientedSize: CGSize,
    renderSize: CGSize,
    sourceSizeBytes: Int,
    durationSeconds: Double,
    targetVideoBitrate: Int,
    targetAudioBitrate: Int
  ) -> Bool {
    guard sourceSizeBytes > 0 else {
      return false
    }

    // Anything this small already transfers quickly.
    if sourceSizeBytes <= 2 * 1024 * 1024 {
      return true
    }

    let projectedBytes = Double(targetVideoBitrate + targetAudioBitrate) / 8 * durationSeconds
    let isAlreadySmallEnough = Double(sourceSizeBytes) <= projectedBytes * 1.15
    let isAlreadyDownscaled = renderSize.width >= orientedSize.width && renderSize.height >= orientedSize.height

    return isAlreadySmallEnough && isAlreadyDownscaled
  }

  // MARK: - Output

  private func makeOutputUrl(fileName: String?) throws -> URL {
    let cacheRoot = try FileManager.default.url(
      for: .cachesDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    ).appendingPathComponent("SynzappNativeMedia", isDirectory: true)

    try FileManager.default.createDirectory(at: cacheRoot, withIntermediateDirectories: true, attributes: nil)

    let requested = (fileName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let base = requested.isEmpty
      ? "video"
      : (requested as NSString).deletingPathExtension
    let safeBase = base
      .replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "_", options: .regularExpression)
      .prefix(64)
    let unique = "\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.prefix(8))"

    return cacheRoot.appendingPathComponent("transcoded_\(unique)_\(safeBase).mp4", isDirectory: false)
  }

  private func fileSizeBytes(at url: URL) -> Int {
    let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)

    return (attributes?[.size] as? NSNumber)?.intValue ?? 0
  }

  // MARK: - Request lifecycle

  private func beginRequest(_ requestId: String) {
    lock.lock()
    cancelledRequests.remove(requestId)
    activeRequests.insert(requestId)
    lock.unlock()
  }

  private func endRequest(_ requestId: String) {
    lock.lock()
    activeRequests.remove(requestId)
    cancelledRequests.remove(requestId)
    lock.unlock()
  }

  private func isCancelled(_ requestId: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }

    return cancelledRequests.contains(requestId)
  }

  private func emit(
    _ onEvent: @escaping ([String: Any]) -> Void,
    requestId: String,
    progress: Double,
    status: String,
    fileUri: String?
  ) {
    var body: [String: Any] = [
      "progress": progress,
      "requestId": requestId,
      "status": status
    ]

    if let fileUri {
      body["fileUri"] = fileUri
    }

    onEvent(body)
  }

  private func normalizedInt(_ value: Any?, fallback: Int, minimum: Int, maximum: Int) -> Int {
    guard let number = value as? NSNumber else {
      return fallback
    }

    return min(max(number.intValue, minimum), maximum)
  }
}
