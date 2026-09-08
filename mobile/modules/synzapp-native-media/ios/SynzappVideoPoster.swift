import AVFoundation
import UIKit

/// The still frame shown in a video bubble.
///
/// `maximumSize` makes the generator decode straight to the size wanted rather
/// than handing back a full resolution frame to be shrunk afterwards, and
/// `appliesPreferredTrackTransform` turns it while it is at it, so nothing
/// here has to reason about rotation at all.
///
/// iOS was never the slow one — this exists so both platforms read a poster the
/// same way, in one native call, instead of routing a camera frame through the
/// bridge and a file twice.
enum SynzappVideoPoster {

  static func read(_ input: [String: Any]) -> [String: Any]? {
    guard let sourceUri = (input["sourceUri"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
          !sourceUri.isEmpty,
          let url = URL(string: sourceUri) ?? URL(string: sourceUri.addingPercentEncoding(
            withAllowedCharacters: .urlQueryAllowed
          ) ?? "") else {
      return nil
    }

    let targetLongEdge = (input["targetLongEdge"] as? NSNumber)?.doubleValue ?? 360
    let quality = min(max((input["quality"] as? NSNumber)?.doubleValue ?? 0.54, 0.1), 1.0)
    let timeMs = (input["timeMs"] as? NSNumber)?.doubleValue ?? 500

    let asset = AVURLAsset(url: url)
    let generator = AVAssetImageGenerator(asset: asset)

    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(width: targetLongEdge, height: targetLongEdge)
    // A still is wanted, not an exact instant, and letting the generator take
    // the nearest keyframe is the difference between a seek and a decode.
    generator.requestedTimeToleranceBefore = CMTime(seconds: 1, preferredTimescale: 600)
    generator.requestedTimeToleranceAfter = CMTime(seconds: 1, preferredTimescale: 600)

    let requested = CMTime(seconds: timeMs / 1000, preferredTimescale: 600)

    guard let cgImage = try? generator.copyCGImage(at: requested, actualTime: nil) else {
      return nil
    }

    let image = UIImage(cgImage: cgImage)

    guard let data = image.jpegData(compressionQuality: CGFloat(quality)) else {
      return nil
    }

    return [
      "base64": data.base64EncodedString(),
      "height": Int(image.size.height),
      "width": Int(image.size.width)
    ]
  }
}
