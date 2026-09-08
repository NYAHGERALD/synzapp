package com.synzapp.nativemedia

import android.graphics.Bitmap
import android.graphics.Matrix
import android.media.MediaMetadataRetriever
import android.os.Build
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * The still frame shown in a video bubble, read the way the platform means it
 * to be read.
 *
 * This used to be done from JavaScript: ask for a frame, get a full resolution
 * JPEG written to disk, read that back, decode it whole, turn it, shrink it,
 * encode it again. Measured on a Galaxy S23 FE with a minute of 4K, that was
 * 1.5 seconds to read the frame and 2.3 more to shrink it, so the poster
 * arrived seconds after the bubble.
 *
 * `getScaledFrameAtTime` decodes straight to the size wanted, so the full
 * resolution frame is never materialised at all. Turning happens on the small
 * bitmap, where it is free. One call, no files, no round trip through the
 * bridge.
 *
 * WhatsApp and Telegram do not even do this much: they run their own camera and
 * keep a frame from the viewfinder, so a recording already has its poster
 * before the file is closed. This is the right way to do it for a video that
 * has to be read from disk, which is still the case for anything chosen from
 * the library.
 */
object SynzappVideoPoster {

  fun read(input: Map<String, Any?>): Map<String, Any?>? {
    val sourceUri = (input["sourceUri"] as? String)?.trim().orEmpty()
    val targetLongEdge = (input["targetLongEdge"] as? Number)?.toInt() ?: 360
    val quality = ((input["quality"] as? Number)?.toDouble() ?: 0.54).coerceIn(0.1, 1.0)
    val timeMs = (input["timeMs"] as? Number)?.toLong() ?: 500L

    if (sourceUri.isEmpty()) {
      return null
    }

    val path = sourceUri.removePrefix("file://").let { java.net.URLDecoder.decode(it, "UTF-8") }

    if (!File(path).exists()) {
      return null
    }

    val retriever = MediaMetadataRetriever()

    try {
      retriever.setDataSource(path)

      val rotation = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
        ?.toIntOrNull()
        ?: 0
      val storedWidth = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
        ?.toIntOrNull()
        ?: 0
      val storedHeight = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
        ?.toIntOrNull()
        ?: 0

      // Asked for at the size wanted rather than shrunk afterwards. The frame
      // is scaled against its stored shape; a quarter turn swaps the sides back
      // when it is applied below.
      val scaled = scaledFrame(
        retriever = retriever,
        timeUs = timeMs * 1000,
        storedWidth = storedWidth,
        storedHeight = storedHeight,
        targetLongEdge = targetLongEdge
      ) ?: return null

      // `getFrameAtTime` hands back the frame as stored on some devices and
      // already turned on others, so the shapes are compared rather than the
      // flag trusted. Same rule as resolvePosterRotationDegrees, and the same
      // reason: the flag alone is right on only half of handsets.
      val isVideoUpright = if (rotation == 90 || rotation == 270) {
        storedWidth > storedHeight
      } else {
        storedHeight > storedWidth
      }
      val upright = if (scaled.height > scaled.width == isVideoUpright) {
        scaled
      } else {
        turn(scaled, if (rotation == 90 || rotation == 270) rotation else 90)
      }

      val stream = ByteArrayOutputStream()

      upright.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt(), stream)

      val bytes = stream.toByteArray()
      val result = mapOf(
        "base64" to Base64.encodeToString(bytes, Base64.NO_WRAP),
        "height" to upright.height,
        "width" to upright.width
      )

      if (upright !== scaled) {
        upright.recycle()
      }

      scaled.recycle()

      return result
    } catch (error: Throwable) {
      return null
    } finally {
      runCatching { retriever.release() }
    }
  }

  private fun scaledFrame(
    retriever: MediaMetadataRetriever,
    timeUs: Long,
    storedWidth: Int,
    storedHeight: Int,
    targetLongEdge: Int
  ): Bitmap? {
    val longest = maxOf(storedWidth, storedHeight)
    val scale = if (longest > 0) minOf(targetLongEdge.toDouble() / longest, 1.0) else 1.0
    val width = maxOf(2, (storedWidth * scale).toInt())
    val height = maxOf(2, (storedHeight * scale).toInt())

    // Scaled decoding arrived in Oreo MR1. Below it, the full frame is the only
    // option, which is what this exists to avoid but is still correct.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1 && longest > 0) {
      val scaledFrame = runCatching {
        retriever.getScaledFrameAtTime(
          timeUs,
          MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
          width,
          height
        )
      }.getOrNull()

      if (scaledFrame != null) {
        return scaledFrame
      }
    }

    return runCatching {
      retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
    }.getOrNull()
  }

  /** Free on a thumbnail, ruinous on a camera frame, which is why it is last. */
  private fun turn(bitmap: Bitmap, degrees: Int): Bitmap {
    val matrix = Matrix().apply { postRotate(degrees.toFloat()) }

    return runCatching {
      Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }.getOrDefault(bitmap)
  }
}
