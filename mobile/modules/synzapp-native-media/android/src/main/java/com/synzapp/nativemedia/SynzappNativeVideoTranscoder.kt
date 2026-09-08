package com.synzapp.nativemedia

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import java.io.File
import java.nio.ByteBuffer
import java.util.Collections
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class SynzappNativeVideoTranscodeException(message: String) : Exception(message)

/**
 * Compresses a picked video into a WhatsApp-sized H.264 + AAC MP4 before it
 * enters the encryption and upload pipeline.
 *
 * The pipeline used to upload the original camera bytes, which for a one-minute
 * 1080p60 clip is 90 MB - 400 MB. Downscaling and re-encoding first is what makes
 * the transfer feel instant.
 *
 * Video is decoded to a [TranscodeOutputSurface], drawn through a GL texture into
 * the encoder's input surface, and re-encoded. That surface path keeps the frames
 * on the GPU and avoids ever materialising raw YUV in Java. Audio is decoded to
 * PCM and re-encoded to AAC through byte buffers.
 */
class SynzappNativeVideoTranscoder(private val cacheDir: File) {

  private val cancelledRequests = Collections.synchronizedSet(mutableSetOf<String>())
  private val activeRequests = Collections.synchronizedSet(mutableSetOf<String>())

  fun cancel(requestId: String): Boolean {
    if (!activeRequests.contains(requestId)) {
      return false
    }

    cancelledRequests.add(requestId)
    return true
  }

  fun transcode(
    input: Map<String, Any?>,
    onEvent: (Map<String, Any?>) -> Unit
  ): Map<String, Any?> {
    val requestId = (input["requestId"] as? String)?.trim().orEmpty()

    if (requestId.isEmpty()) {
      throw SynzappNativeVideoTranscodeException("A transcode requestId is required.")
    }

    val sourceUri = (input["sourceUri"] as? String)?.trim().orEmpty()

    if (sourceUri.isEmpty()) {
      throw SynzappNativeVideoTranscodeException("A source video is required.")
    }

    val sourceFile = localFileFromUri(sourceUri)

    if (!sourceFile.exists()) {
      throw SynzappNativeVideoTranscodeException("This video is no longer available on this device.")
    }

    activeRequests.add(requestId)
    cancelledRequests.remove(requestId)

    try {
      return run(requestId, sourceUri, sourceFile, input, onEvent)
    } finally {
      activeRequests.remove(requestId)
      cancelledRequests.remove(requestId)
    }
  }

  private fun run(
    requestId: String,
    sourceUri: String,
    sourceFile: File,
    input: Map<String, Any?>,
    onEvent: (Map<String, Any?>) -> Unit
  ): Map<String, Any?> {
    val metadata = readMetadata(sourceFile)
    val targetLongEdge = normalizedInt(input["targetLongEdge"], 848, 240, 3840)
    val videoBitrate = normalizedInt(input["videoBitrate"], 2_000_000, 200_000, 40_000_000)
    val audioBitrate = normalizedInt(input["audioBitrate"], 96_000, 32_000, 320_000)
    val frameRate = normalizedInt(input["frameRate"], 30, 15, 60)

    if (metadata.width < 1 || metadata.height < 1 || metadata.durationMs < 1) {
      throw SynzappNativeVideoTranscodeException("This video has no readable dimensions or duration.")
    }

    val sourceSizeBytes = sourceFile.length()
    // Upright, for reporting and for deciding how much to scale by.
    val target = targetRenderSize(metadata.width, metadata.height, targetLongEdge)
    val isSideways = metadata.rotationDegrees == 90 || metadata.rotationDegrees == 270
    // Encoded in the orientation the frames are actually stored in. The decoder
    // emits them that way, and the rotation is carried on the container instead
    // of being turned into pixels here. See the note on setOrientationHint.
    val encodedWidth = if (isSideways) target.second else target.first
    val encodedHeight = if (isSideways) target.first else target.second

    if (
      shouldSkipTranscode(
        sourceWidth = metadata.width,
        sourceHeight = metadata.height,
        targetWidth = target.first,
        targetHeight = target.second,
        sourceSizeBytes = sourceSizeBytes,
        durationMs = metadata.durationMs,
        videoBitrate = videoBitrate,
        audioBitrate = audioBitrate
      )
    ) {
      return mapOf(
        "durationMs" to metadata.durationMs,
        "fileUri" to sourceUri,
        "height" to metadata.height,
        "sizeBytes" to sourceSizeBytes,
        "transcoded" to false,
        "width" to metadata.width
      )
    }

    val outputFile = File(
      cacheDir,
      "transcoded_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(8)}.mp4"
    )
    outputFile.delete()

    try {
      encode(
        requestId = requestId,
        sourceFile = sourceFile,
        outputFile = outputFile,
        targetWidth = encodedWidth,
        targetHeight = encodedHeight,
        rotationDegrees = metadata.rotationDegrees,
        videoBitrate = videoBitrate,
        audioBitrate = audioBitrate,
        frameRate = frameRate,
        durationMs = metadata.durationMs,
        onEvent = onEvent
      )
    } catch (error: Throwable) {
      outputFile.delete()
      throw error
    }

    val outputSizeBytes = outputFile.length()

    // A transcode that produced a larger file is a loss. Keep the original.
    if (outputSizeBytes <= 0 || (sourceSizeBytes > 0 && outputSizeBytes >= sourceSizeBytes)) {
      outputFile.delete()
      return mapOf(
        "durationMs" to metadata.durationMs,
        "fileUri" to sourceUri,
        "height" to metadata.height,
        "sizeBytes" to sourceSizeBytes,
        "transcoded" to false,
        "width" to metadata.width
      )
    }

    onEvent(
      mapOf(
        "fileUri" to Uri.fromFile(outputFile).toString(),
        "progress" to 1.0,
        "requestId" to requestId,
        "status" to "completed"
      )
    )

    return mapOf(
      "durationMs" to metadata.durationMs,
      "fileUri" to Uri.fromFile(outputFile).toString(),
      "height" to target.second,
      "sizeBytes" to outputSizeBytes,
      "transcoded" to true,
      "width" to target.first
    )
  }

  private fun encode(
    requestId: String,
    sourceFile: File,
    outputFile: File,
    targetWidth: Int,
    targetHeight: Int,
    rotationDegrees: Int,
    videoBitrate: Int,
    audioBitrate: Int,
    frameRate: Int,
    durationMs: Long,
    onEvent: (Map<String, Any?>) -> Unit
  ) {
    val muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    val muxerState = MuxerState(muxer)

    // The rotation is carried here, on the container, exactly as the camera
    // wrote it on the original file.
    //
    // An earlier version turned the frames upright in the GL pass instead and
    // set this to zero. That fights the decoder: on devices whose
    // SurfaceTexture transform already carries the rotation, the frame is
    // turned twice and the sent video plays on its side while the original,
    // still sitting in the outbox, plays correctly. Rotating in the pass also
    // has to be right on every decoder, whereas an orientation hint is what
    // every camera writes and every player already honours.
    muxer.setOrientationHint(rotationDegrees)

    var videoStage: VideoStage? = null
    var audioStage: AudioStage? = null

    try {
      videoStage = VideoStage(
        sourceFile = sourceFile,
        targetWidth = targetWidth,
        targetHeight = targetHeight,
        // Zero: the frames are passed through in the orientation they are
        // stored in, and the muxer above records how to display them.
        rotationDegrees = 0,
        bitrate = videoBitrate,
        frameRate = frameRate,
        muxerState = muxerState
      )
      audioStage = AudioStage(
        sourceFile = sourceFile,
        bitrate = audioBitrate,
        muxerState = muxerState
      )

      if (!audioStage.isPresent) {
        audioStage.release()
        audioStage = null
      }

      // Both stages must have published their output format before the muxer can
      // start, otherwise MediaMuxer drops the track that registers late.
      muxerState.expectedTrackCount = if (audioStage == null) 1 else 2

      var lastReportedProgress = 0.0
      var lastVideoTimeUs = -1L

      while (true) {
        if (cancelledRequests.contains(requestId)) {
          throw SynzappNativeVideoTranscodeException("Video transcoding was cancelled.")
        }

        val videoBusy = videoStage.step()
        val audioBusy = audioStage?.step() ?: false

        if (!videoBusy && !audioBusy) {
          break
        }

        // The polls above are non-blocking, so a pass that moved no frame would
        // spin. One millisecond hands the CPU to the codec threads without
        // giving back the ten that each blocking dequeue used to cost.
        if (videoStage.lastPresentationTimeUs == lastVideoTimeUs) {
          runCatching { Thread.sleep(1) }
        }

        lastVideoTimeUs = videoStage.lastPresentationTimeUs

        val progress = min(
          max(videoStage.lastPresentationTimeUs / 1000.0 / max(durationMs, 1L), 0.0),
          0.99
        )

        if (progress - lastReportedProgress >= 0.02) {
          lastReportedProgress = progress
          onEvent(
            mapOf(
              "progress" to progress,
              "requestId" to requestId,
              "status" to "running"
            )
          )
        }
      }

      if (!videoStage.didWriteAnyFrame) {
        throw SynzappNativeVideoTranscodeException("No video frames could be compressed.")
      }
    } finally {
      videoStage?.release()
      audioStage?.release()
      muxerState.release()
    }
  }

  // MARK: - Muxer coordination

  private class MuxerState(val muxer: MediaMuxer) {
    var expectedTrackCount = 1
    private var addedTrackCount = 0
    private var started = false
    private var released = false
    @Volatile private var blockedAttempts = 0

    val isStarted: Boolean
      get() = started

    @Synchronized
    fun addTrack(format: MediaFormat): Int {
      val index = muxer.addTrack(format)
      addedTrackCount += 1

      if (addedTrackCount >= expectedTrackCount && !started) {
        muxer.start()
        started = true
      }

      return index
    }

    /**
     * Waits for every expected track to register, then reports whether the muxer
     * started. Returns false if the caller should back off and retry.
     *
     * The bounded wait is a deadlock guard: if the audio encoder never publishes
     * a format, the muxer starts with the video track alone rather than hanging
     * the send forever. A silent video beats a stuck one.
     */
    fun awaitStart(): Boolean {
      if (started) {
        return true
      }

      blockedAttempts += 1

      if (blockedAttempts < MAX_BLOCKED_ATTEMPTS) {
        return false
      }

      synchronized(this) {
        if (!started && addedTrackCount > 0) {
          muxer.start()
          started = true
        }
      }

      return started
    }

    @Synchronized
    fun writeSample(trackIndex: Int, buffer: ByteBuffer, info: MediaCodec.BufferInfo) {
      if (!started || trackIndex < 0) {
        return
      }

      muxer.writeSampleData(trackIndex, buffer, info)
    }

    @Synchronized
    fun release() {
      if (released) {
        return
      }

      released = true

      if (started) {
        runCatching { muxer.stop() }
      }

      runCatching { muxer.release() }
    }

    private companion object {
      const val MAX_BLOCKED_ATTEMPTS = 240
    }
  }

  // MARK: - Video

  private inner class VideoStage(
    sourceFile: File,
    targetWidth: Int,
    targetHeight: Int,
    rotationDegrees: Int,
    bitrate: Int,
    frameRate: Int,
    private val muxerState: MuxerState
  ) {
    private val extractor = MediaExtractor()
    private val decoder: MediaCodec
    private val encoder: MediaCodec
    private val inputSurface: TranscodeInputSurface
    private val outputSurface: TranscodeOutputSurface
    private val bufferInfo = MediaCodec.BufferInfo()
    private val pendingBufferInfo = MediaCodec.BufferInfo()

    private var trackIndex = -1
    private var decoderDone = false
    private var extractorDone = false
    private var encoderDone = false
    private var pendingOutputIndex = -1

    var lastPresentationTimeUs = 0L
      private set
    var didWriteAnyFrame = false
      private set

    init {
      extractor.setDataSource(sourceFile.absolutePath)
      val sourceTrack = selectTrack(extractor, "video/")
        ?: throw SynzappNativeVideoTranscodeException("This file has no video track.")
      extractor.selectTrack(sourceTrack)
      val sourceFormat = extractor.getTrackFormat(sourceTrack)

      val encoderFormat = MediaFormat.createVideoFormat(
        MediaFormat.MIMETYPE_VIDEO_AVC,
        targetWidth,
        targetHeight
      ).apply {
        setInteger(
          MediaFormat.KEY_COLOR_FORMAT,
          MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface
        )
        setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
        setInteger(MediaFormat.KEY_FRAME_RATE, frameRate)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
      }

      encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
      encoder.configure(encoderFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      inputSurface = TranscodeInputSurface(encoder.createInputSurface())
      encoder.start()

      outputSurface = TranscodeOutputSurface(inputSurface, targetWidth, targetHeight, rotationDegrees)

      val decoderMime = sourceFormat.getString(MediaFormat.KEY_MIME)
        ?: throw SynzappNativeVideoTranscodeException("This video track has no readable format.")
      decoder = MediaCodec.createDecoderByType(decoderMime)

      // Take the decision away from the decoder.
      //
      // MediaExtractor puts KEY_ROTATION in the track format, and Android's own
      // documentation says a video decoder *may or may not* honour it. So on
      // one handset the frames arrive already turned upright and on the next
      // they arrive in the orientation they were stored in, from identical
      // code and an identical file. Whichever of those the pipeline is written
      // for, the other half of devices comes out sideways, which is exactly why
      // this kept looking fixed and then was not.
      //
      // Pinning it to zero means the decoder never rotates, on any device, so
      // the frames below are always in the stored orientation and the muxer's
      // orientation hint is the single place that describes how to display
      // them. iOS never had this problem because AVAssetExportSession owns the
      // whole pipeline and the question never arises.
      sourceFormat.setInteger(MediaFormat.KEY_ROTATION, 0)
      decoder.configure(sourceFormat, outputSurface.surface, null, 0)
      decoder.start()
    }

    /** Returns true while there is still work to do. */
    fun step(): Boolean {
      if (encoderDone) {
        return false
      }

      feedDecoder()
      drainDecoderToEncoder()
      drainEncoder()

      return !encoderDone
    }

    private fun feedDecoder() {
      if (extractorDone) {
        return
      }

      val inputIndex = decoder.dequeueInputBuffer(TIMEOUT_US)

      if (inputIndex < 0) {
        return
      }

      val buffer = decoder.getInputBuffer(inputIndex) ?: return
      val sampleSize = extractor.readSampleData(buffer, 0)

      if (sampleSize < 0) {
        extractorDone = true
        decoder.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
        return
      }

      decoder.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
      extractor.advance()
    }

    private fun drainDecoderToEncoder() {
      if (decoderDone) {
        return
      }

      val outputIndex = decoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)

      // Every negative index is an informational status (try-again, format
      // changed) rather than a buffer. The getOutputBuffer API makes them all
      // no-ops here.
      if (outputIndex < 0) {
        return
      }

      val shouldRender = bufferInfo.size > 0
      decoder.releaseOutputBuffer(outputIndex, shouldRender)

      if (shouldRender) {
        outputSurface.awaitNewFrame()
        outputSurface.drawFrame()
        inputSurface.setPresentationTime(bufferInfo.presentationTimeUs * 1000)
        inputSurface.swapBuffers()
        lastPresentationTimeUs = bufferInfo.presentationTimeUs
      }

      if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
        decoderDone = true
        encoder.signalEndOfInputStream()
      }
    }

    private fun drainEncoder() {
      // A frame held back while waiting for the muxer to start must be flushed
      // before anything new is dequeued, or its buffer index is lost for good.
      if (pendingOutputIndex >= 0) {
        if (!muxerState.awaitStart()) {
          return
        }

        writeEncodedBuffer(pendingOutputIndex, pendingBufferInfo)

        val wasEndOfStream = pendingBufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
        pendingOutputIndex = -1

        if (wasEndOfStream) {
          encoderDone = true
          return
        }
      }

      while (true) {
        val outputIndex = encoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)

        if (outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
          return
        }

        if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          if (trackIndex < 0) {
            trackIndex = muxerState.addTrack(encoder.outputFormat)
          }
          continue
        }

        if (outputIndex < 0) {
          continue
        }

        val isCodecConfig = bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
        val hasPayload = bufferInfo.size > 0 && !isCodecConfig

        // The muxer only starts once every expected track has registered its
        // format. Writing payload frames before then drops them, including the
        // opening keyframe, which produces an unplayable file. Hold the buffer
        // and its metadata and flush it on a later pass instead.
        if (hasPayload && !muxerState.isStarted) {
          pendingOutputIndex = outputIndex
          pendingBufferInfo.set(
            bufferInfo.offset,
            bufferInfo.size,
            bufferInfo.presentationTimeUs,
            bufferInfo.flags
          )
          return
        }

        writeEncodedBuffer(outputIndex, bufferInfo)

        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
          encoderDone = true
          return
        }
      }
    }

    private fun writeEncodedBuffer(outputIndex: Int, info: MediaCodec.BufferInfo) {
      val encodedBuffer = encoder.getOutputBuffer(outputIndex)
      val isCodecConfig = info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0

      if (encodedBuffer != null && info.size > 0 && !isCodecConfig && muxerState.isStarted) {
        encodedBuffer.position(info.offset)
        encodedBuffer.limit(info.offset + info.size)
        muxerState.writeSample(trackIndex, encodedBuffer, info)
        didWriteAnyFrame = true
      }

      encoder.releaseOutputBuffer(outputIndex, false)
    }

    fun release() {
      runCatching { decoder.stop() }
      runCatching { decoder.release() }
      runCatching { encoder.stop() }
      runCatching { encoder.release() }
      runCatching { outputSurface.release() }
      runCatching { inputSurface.release() }
      runCatching { extractor.release() }
    }
  }

  // MARK: - Audio

  private inner class AudioStage(
    sourceFile: File,
    bitrate: Int,
    private val muxerState: MuxerState
  ) {
    private val extractor = MediaExtractor()
    private var decoder: MediaCodec? = null
    private var encoder: MediaCodec? = null
    private val decoderInfo = MediaCodec.BufferInfo()
    private val encoderInfo = MediaCodec.BufferInfo()
    private val pendingInfo = MediaCodec.BufferInfo()

    private var trackIndex = -1
    private var pendingOutputIndex = -1
    private var extractorDone = false
    private var decoderDone = false
    private var encoderDone = true

    val isPresent: Boolean

    init {
      extractor.setDataSource(sourceFile.absolutePath)
      val sourceTrack = selectTrack(extractor, "audio/")

      if (sourceTrack == null) {
        isPresent = false
      } else {
        extractor.selectTrack(sourceTrack)
        val sourceFormat = extractor.getTrackFormat(sourceTrack)
        val sampleRate = runCatching { sourceFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE) }
          .getOrDefault(44_100)
        val channelCount = runCatching { sourceFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT) }
          .getOrDefault(2)
          .coerceIn(1, 2)
        val decoderMime = sourceFormat.getString(MediaFormat.KEY_MIME)

        if (decoderMime == null) {
          isPresent = false
        } else {
          val encoderFormat = MediaFormat.createAudioFormat(
            MediaFormat.MIMETYPE_AUDIO_AAC,
            sampleRate,
            channelCount
          ).apply {
            setInteger(
              MediaFormat.KEY_AAC_PROFILE,
              MediaCodecInfo.CodecProfileLevel.AACObjectLC
            )
            setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
          }

          encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC).apply {
            configure(encoderFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            start()
          }
          decoder = MediaCodec.createDecoderByType(decoderMime).apply {
            configure(sourceFormat, null, null, 0)
            start()
          }
          encoderDone = false
          isPresent = true
        }
      }
    }

    /** Returns true while there is still work to do. */
    fun step(): Boolean {
      val decoder = this.decoder ?: return false
      val encoder = this.encoder ?: return false

      if (encoderDone) {
        return false
      }

      feedDecoder(decoder)
      drainDecoderToEncoder(decoder, encoder)
      drainEncoder(encoder)

      return !encoderDone
    }

    private fun feedDecoder(decoder: MediaCodec) {
      if (extractorDone) {
        return
      }

      val inputIndex = decoder.dequeueInputBuffer(TIMEOUT_US)

      if (inputIndex < 0) {
        return
      }

      val buffer = decoder.getInputBuffer(inputIndex) ?: return
      val sampleSize = extractor.readSampleData(buffer, 0)

      if (sampleSize < 0) {
        extractorDone = true
        decoder.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
        return
      }

      decoder.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
      extractor.advance()
    }

    private fun drainDecoderToEncoder(decoder: MediaCodec, encoder: MediaCodec) {
      if (decoderDone) {
        return
      }

      val outputIndex = decoder.dequeueOutputBuffer(decoderInfo, TIMEOUT_US)

      if (outputIndex < 0) {
        return
      }

      val decodedBuffer = decoder.getOutputBuffer(outputIndex)
      val isEndOfStream = decoderInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0

      if (decodedBuffer != null && decoderInfo.size > 0) {
        val encoderInputIndex = encoder.dequeueInputBuffer(TIMEOUT_US)

        if (encoderInputIndex >= 0) {
          val encoderBuffer = encoder.getInputBuffer(encoderInputIndex)

          if (encoderBuffer != null) {
            decodedBuffer.position(decoderInfo.offset)
            decodedBuffer.limit(decoderInfo.offset + decoderInfo.size)
            encoderBuffer.clear()
            encoderBuffer.put(decodedBuffer)
            encoder.queueInputBuffer(
              encoderInputIndex,
              0,
              decoderInfo.size,
              decoderInfo.presentationTimeUs,
              0
            )
          } else {
            encoder.queueInputBuffer(encoderInputIndex, 0, 0, decoderInfo.presentationTimeUs, 0)
          }
        }
      }

      decoder.releaseOutputBuffer(outputIndex, false)

      if (isEndOfStream) {
        decoderDone = true
        val encoderInputIndex = encoder.dequeueInputBuffer(TIMEOUT_US * 10)

        if (encoderInputIndex >= 0) {
          encoder.queueInputBuffer(
            encoderInputIndex,
            0,
            0,
            decoderInfo.presentationTimeUs,
            MediaCodec.BUFFER_FLAG_END_OF_STREAM
          )
        }
      }
    }

    private fun drainEncoder(encoder: MediaCodec) {
      // Same hold-back as the video stage: a frame kept back while the muxer is
      // still collecting track formats must be flushed before anything new is
      // dequeued, or its buffer index is lost.
      if (pendingOutputIndex >= 0) {
        if (!muxerState.awaitStart()) {
          return
        }

        writeEncodedBuffer(encoder, pendingOutputIndex, pendingInfo)

        val wasEndOfStream = pendingInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
        pendingOutputIndex = -1

        if (wasEndOfStream) {
          encoderDone = true
          return
        }
      }

      while (true) {
        val outputIndex = encoder.dequeueOutputBuffer(encoderInfo, TIMEOUT_US)

        if (outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
          return
        }

        if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          if (trackIndex < 0) {
            trackIndex = muxerState.addTrack(encoder.outputFormat)
          }
          continue
        }

        if (outputIndex < 0) {
          continue
        }

        val isCodecConfig = encoderInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0

        if (encoderInfo.size > 0 && !isCodecConfig && !muxerState.isStarted) {
          pendingOutputIndex = outputIndex
          pendingInfo.set(
            encoderInfo.offset,
            encoderInfo.size,
            encoderInfo.presentationTimeUs,
            encoderInfo.flags
          )
          return
        }

        writeEncodedBuffer(encoder, outputIndex, encoderInfo)

        if (encoderInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
          encoderDone = true
          return
        }
      }
    }

    private fun writeEncodedBuffer(encoder: MediaCodec, outputIndex: Int, info: MediaCodec.BufferInfo) {
      val encodedBuffer = encoder.getOutputBuffer(outputIndex)
      val isCodecConfig = info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0

      if (encodedBuffer != null && info.size > 0 && !isCodecConfig && muxerState.isStarted) {
        encodedBuffer.position(info.offset)
        encodedBuffer.limit(info.offset + info.size)
        muxerState.writeSample(trackIndex, encodedBuffer, info)
      }

      encoder.releaseOutputBuffer(outputIndex, false)
    }

    fun release() {
      decoder?.let {
        runCatching { it.stop() }
        runCatching { it.release() }
      }
      encoder?.let {
        runCatching { it.stop() }
        runCatching { it.release() }
      }
      runCatching { extractor.release() }
    }
  }

  // MARK: - Sizing and metadata

  private data class VideoMetadata(
    val durationMs: Long,
    val height: Int,
    val rotationDegrees: Int,
    val width: Int
  )

  private fun readMetadata(file: File): VideoMetadata {
    val retriever = MediaMetadataRetriever()

    try {
      retriever.setDataSource(file.absolutePath)

      val rotation = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
        ?.toIntOrNull()
        ?: 0
      val rawWidth = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
        ?.toIntOrNull()
        ?: 0
      val rawHeight = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
        ?.toIntOrNull()
        ?: 0
      val durationMs = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        ?.toLongOrNull()
        ?: 0L
      val normalizedRotation = ((rotation % 360) + 360) % 360
      val isSideways = normalizedRotation == 90 || normalizedRotation == 270

      return VideoMetadata(
        durationMs = durationMs,
        height = if (isSideways) rawWidth else rawHeight,
        rotationDegrees = normalizedRotation,
        width = if (isSideways) rawHeight else rawWidth
      )
    } finally {
      runCatching { retriever.release() }
    }
  }

  /** Returns the even-dimensioned upright target size. H.264 requires even values. */
  private fun targetRenderSize(width: Int, height: Int, longEdge: Int): Pair<Int, Int> {
    val longestSide = max(width, height)
    val scale = min(longEdge.toDouble() / max(longestSide, 1).toDouble(), 1.0)

    return Pair(
      max(2, ((width * scale) / 2).roundToInt() * 2),
      max(2, ((height * scale) / 2).roundToInt() * 2)
    )
  }

  private fun shouldSkipTranscode(
    sourceWidth: Int,
    sourceHeight: Int,
    targetWidth: Int,
    targetHeight: Int,
    sourceSizeBytes: Long,
    durationMs: Long,
    videoBitrate: Int,
    audioBitrate: Int
  ): Boolean {
    if (sourceSizeBytes <= 0) {
      return false
    }

    // Anything this small already transfers quickly.
    if (sourceSizeBytes <= 2L * 1024 * 1024) {
      return true
    }

    val projectedBytes = (videoBitrate + audioBitrate).toDouble() / 8.0 * (durationMs / 1000.0)
    val isAlreadySmallEnough = sourceSizeBytes <= projectedBytes * 1.15
    val isAlreadyDownscaled = targetWidth >= sourceWidth && targetHeight >= sourceHeight

    return isAlreadySmallEnough && isAlreadyDownscaled
  }

  private fun selectTrack(extractor: MediaExtractor, mimePrefix: String): Int? {
    for (index in 0 until extractor.trackCount) {
      val mime = extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)

      if (mime != null && mime.startsWith(mimePrefix)) {
        return index
      }
    }

    return null
  }

  private fun localFileFromUri(uri: String): File {
    val parsed = Uri.parse(uri)
    val path = if (parsed.scheme == "file") parsed.path else uri

    return File(requireNotNull(path) { "Only local file URIs can be transcoded." })
  }

  private fun normalizedInt(value: Any?, fallback: Int, minimum: Int, maximum: Int): Int {
    val number = when (value) {
      is Number -> value.toInt()
      is String -> value.toIntOrNull()
      else -> null
    } ?: return fallback

    return min(max(number, minimum), maximum)
  }

  private companion object {
    /**
     * Polls do not block.
     *
     * Every `dequeue` used to wait up to ten milliseconds, and one step made
     * three of them for video and four more for audio. `drainEncoder` pays one
     * in full on every pass, because the loop only stops once the encoder
     * answers TRY_AGAIN_LATER, and that answer only comes after the wait.
     *
     * Measured on a Galaxy S23 FE that was about 47ms a frame, and 37 seconds
     * to compress 26 seconds of video on Qualcomm hardware that should manage
     * many times real time. The pipeline was not working, it was asleep.
     *
     * Zero takes whatever is ready and moves on. The loop below sleeps a single
     * millisecond when a pass moved nothing, so an idle moment still yields the
     * CPU to the codec threads rather than spinning on them.
     */
    const val TIMEOUT_US = 0L
  }
}
