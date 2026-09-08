package com.synzapp.nativemedia

import android.graphics.SurfaceTexture
import android.os.Handler
import android.os.HandlerThread
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.Matrix
import android.view.Surface
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * EGL context wrapping the video encoder's input surface.
 *
 * Everything the transcoder draws lands here and is handed straight to the
 * encoder, so decoded frames never have to be pulled into Java memory.
 */
class TranscodeInputSurface(private val surface: Surface) {
  private var display: EGLDisplay = EGL14.EGL_NO_DISPLAY
  private var context: EGLContext = EGL14.EGL_NO_CONTEXT
  private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE

  init {
    setupEgl()
    makeCurrent()
  }

  private fun setupEgl() {
    display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)

    if (display === EGL14.EGL_NO_DISPLAY) {
      throw SynzappNativeVideoTranscodeException("Unable to open a GPU display for compression.")
    }

    val version = IntArray(2)

    if (!EGL14.eglInitialize(display, version, 0, version, 1)) {
      display = EGL14.EGL_NO_DISPLAY
      throw SynzappNativeVideoTranscodeException("Unable to initialize the GPU for compression.")
    }

    val attributes = intArrayOf(
      EGL14.EGL_RED_SIZE, 8,
      EGL14.EGL_GREEN_SIZE, 8,
      EGL14.EGL_BLUE_SIZE, 8,
      EGL14.EGL_ALPHA_SIZE, 8,
      EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
      EGL_RECORDABLE_ANDROID, 1,
      EGL14.EGL_NONE
    )
    val configs = arrayOfNulls<EGLConfig>(1)
    val configCount = IntArray(1)

    if (!EGL14.eglChooseConfig(display, attributes, 0, configs, 0, 1, configCount, 0) ||
      configCount[0] <= 0
    ) {
      throw SynzappNativeVideoTranscodeException("No compatible GPU configuration for compression.")
    }

    context = EGL14.eglCreateContext(
      display,
      configs[0],
      EGL14.EGL_NO_CONTEXT,
      intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE),
      0
    )

    if (context === EGL14.EGL_NO_CONTEXT) {
      throw SynzappNativeVideoTranscodeException("Unable to create a GPU context for compression.")
    }

    eglSurface = EGL14.eglCreateWindowSurface(
      display,
      configs[0],
      surface,
      intArrayOf(EGL14.EGL_NONE),
      0
    )

    if (eglSurface === EGL14.EGL_NO_SURFACE) {
      throw SynzappNativeVideoTranscodeException("Unable to create a GPU surface for compression.")
    }
  }

  fun makeCurrent() {
    if (!EGL14.eglMakeCurrent(display, eglSurface, eglSurface, context)) {
      throw SynzappNativeVideoTranscodeException("Unable to bind the GPU context for compression.")
    }
  }

  fun setPresentationTime(nanoseconds: Long) {
    EGLExt.eglPresentationTimeANDROID(display, eglSurface, nanoseconds)
  }

  fun swapBuffers(): Boolean = EGL14.eglSwapBuffers(display, eglSurface)

  fun release() {
    if (display !== EGL14.EGL_NO_DISPLAY) {
      EGL14.eglMakeCurrent(
        display,
        EGL14.EGL_NO_SURFACE,
        EGL14.EGL_NO_SURFACE,
        EGL14.EGL_NO_CONTEXT
      )

      if (eglSurface !== EGL14.EGL_NO_SURFACE) {
        EGL14.eglDestroySurface(display, eglSurface)
      }

      if (context !== EGL14.EGL_NO_CONTEXT) {
        EGL14.eglDestroyContext(display, context)
      }

      EGL14.eglReleaseThread()
      EGL14.eglTerminate(display)
    }

    display = EGL14.EGL_NO_DISPLAY
    context = EGL14.EGL_NO_CONTEXT
    eglSurface = EGL14.EGL_NO_SURFACE
    surface.release()
  }

  private companion object {
    const val EGL_RECORDABLE_ANDROID = 0x3142
  }
}

/**
 * The decoder's output target.
 *
 * The decoder renders each frame into an external OES texture. [drawFrame] then
 * draws that texture, rotated upright and scaled to the encoder's dimensions,
 * into the encoder input surface's EGL context. Doing the rotation here is why
 * the output container's orientation hint is reset to zero.
 */
class TranscodeOutputSurface(
  private val inputSurface: TranscodeInputSurface,
  private val targetWidth: Int,
  private val targetHeight: Int,
  rotationDegrees: Int
) : SurfaceTexture.OnFrameAvailableListener {

  private val frameLock = Object()
  private var frameAvailable = false

  /**
   * The thread that is told a decoded frame has landed.
   *
   * `setOnFrameAvailableListener` without a handler delivers the callback on
   * the thread that created the SurfaceTexture **if that thread has a Looper,
   * and on the main thread otherwise**. Transcoding runs on a plain background
   * thread, which has no Looper, so every frame was being announced through the
   * main thread — the one React Native is drawing the app on.
   *
   * The transcode then waits for that announcement before it can draw, so each
   * frame cost a main-thread scheduling slot. Measured on a Galaxy S23 FE that
   * was 38 seconds to compress 26 seconds of video, roughly 48ms a frame, from
   * hardware codecs that should manage many times real time.
   *
   * A thread of its own removes the main thread from the loop entirely.
   */
  private val frameThread = HandlerThread("SynzappTranscodeFrames").apply { start() }

  private val textureId: Int
  private val surfaceTexture: SurfaceTexture
  val surface: Surface

  private val program: Int
  private val positionHandle: Int
  private val textureCoordinateHandle: Int
  private val textureMatrixHandle: Int
  private val rotationMatrixHandle: Int

  private val vertexBuffer: FloatBuffer
  private val textureCoordinateBuffer: FloatBuffer
  private val textureMatrix = FloatArray(16)
  private val rotationMatrix = FloatArray(16)

  init {
    inputSurface.makeCurrent()

    program = buildProgram()
    positionHandle = GLES20.glGetAttribLocation(program, "aPosition")
    textureCoordinateHandle = GLES20.glGetAttribLocation(program, "aTextureCoordinate")
    textureMatrixHandle = GLES20.glGetUniformLocation(program, "uTextureMatrix")
    rotationMatrixHandle = GLES20.glGetUniformLocation(program, "uRotationMatrix")

    vertexBuffer = floatBufferOf(
      floatArrayOf(
        -1f, -1f,
        1f, -1f,
        -1f, 1f,
        1f, 1f
      )
    )
    textureCoordinateBuffer = floatBufferOf(
      floatArrayOf(
        0f, 0f,
        1f, 0f,
        0f, 1f,
        1f, 1f
      )
    )

    Matrix.setIdentityM(rotationMatrix, 0)

    // Left at zero by the transcoder now: frames are passed through in the
    // orientation they are stored in and the muxer records how to display them,
    // the same way the camera wrote the original. Turning them here fought
    // decoders whose SurfaceTexture transform already carries the rotation, and
    // the frame came out turned twice.
    if (rotationDegrees != 0) {
      Matrix.rotateM(rotationMatrix, 0, -rotationDegrees.toFloat(), 0f, 0f, 1f)
    }

    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    textureId = textures[0]

    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
    GLES20.glTexParameteri(
      GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
      GLES20.GL_TEXTURE_MIN_FILTER,
      GLES20.GL_LINEAR
    )
    GLES20.glTexParameteri(
      GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
      GLES20.GL_TEXTURE_MAG_FILTER,
      GLES20.GL_LINEAR
    )
    GLES20.glTexParameteri(
      GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
      GLES20.GL_TEXTURE_WRAP_S,
      GLES20.GL_CLAMP_TO_EDGE
    )
    GLES20.glTexParameteri(
      GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
      GLES20.GL_TEXTURE_WRAP_T,
      GLES20.GL_CLAMP_TO_EDGE
    )

    surfaceTexture = SurfaceTexture(textureId)
    surfaceTexture.setOnFrameAvailableListener(this, Handler(frameThread.looper))
    surface = Surface(surfaceTexture)
  }

  override fun onFrameAvailable(texture: SurfaceTexture) {
    synchronized(frameLock) {
      frameAvailable = true
      frameLock.notifyAll()
    }
  }

  fun awaitNewFrame() {
    synchronized(frameLock) {
      val deadline = System.currentTimeMillis() + FRAME_WAIT_TIMEOUT_MS

      while (!frameAvailable) {
        val remaining = deadline - System.currentTimeMillis()

        if (remaining <= 0) {
          // Dropping a frame is far better than hanging the send forever.
          return
        }

        runCatching { frameLock.wait(remaining) }
      }

      frameAvailable = false
    }

    surfaceTexture.updateTexImage()
    surfaceTexture.getTransformMatrix(textureMatrix)
  }

  fun drawFrame() {
    inputSurface.makeCurrent()

    GLES20.glViewport(0, 0, targetWidth, targetHeight)
    GLES20.glClearColor(0f, 0f, 0f, 1f)
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)

    GLES20.glUseProgram(program)

    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)

    GLES20.glUniformMatrix4fv(textureMatrixHandle, 1, false, textureMatrix, 0)
    GLES20.glUniformMatrix4fv(rotationMatrixHandle, 1, false, rotationMatrix, 0)

    vertexBuffer.position(0)
    GLES20.glEnableVertexAttribArray(positionHandle)
    GLES20.glVertexAttribPointer(positionHandle, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer)

    textureCoordinateBuffer.position(0)
    GLES20.glEnableVertexAttribArray(textureCoordinateHandle)
    GLES20.glVertexAttribPointer(
      textureCoordinateHandle,
      2,
      GLES20.GL_FLOAT,
      false,
      0,
      textureCoordinateBuffer
    )

    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

    GLES20.glDisableVertexAttribArray(positionHandle)
    GLES20.glDisableVertexAttribArray(textureCoordinateHandle)
  }

  fun release() {
    // Stops the listener before the texture it reports on goes away.
    runCatching { surfaceTexture.setOnFrameAvailableListener(null) }
    runCatching { frameThread.quitSafely() }
    runCatching { surface.release() }
    runCatching { surfaceTexture.release() }
    runCatching { GLES20.glDeleteProgram(program) }
    runCatching { GLES20.glDeleteTextures(1, intArrayOf(textureId), 0) }
  }

  private fun buildProgram(): Int {
    val vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER)
    val fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER)
    val program = GLES20.glCreateProgram()

    if (program == 0) {
      throw SynzappNativeVideoTranscodeException("Unable to create the GPU program for compression.")
    }

    GLES20.glAttachShader(program, vertexShader)
    GLES20.glAttachShader(program, fragmentShader)
    GLES20.glLinkProgram(program)

    val linkStatus = IntArray(1)
    GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, linkStatus, 0)

    GLES20.glDeleteShader(vertexShader)
    GLES20.glDeleteShader(fragmentShader)

    if (linkStatus[0] != GLES20.GL_TRUE) {
      val log = GLES20.glGetProgramInfoLog(program)
      GLES20.glDeleteProgram(program)
      throw SynzappNativeVideoTranscodeException("Unable to link the GPU program for compression: $log")
    }

    return program
  }

  private fun compileShader(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type)
    GLES20.glShaderSource(shader, source)
    GLES20.glCompileShader(shader)

    val compileStatus = IntArray(1)
    GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compileStatus, 0)

    if (compileStatus[0] != GLES20.GL_TRUE) {
      val log = GLES20.glGetShaderInfoLog(shader)
      GLES20.glDeleteShader(shader)
      throw SynzappNativeVideoTranscodeException("Unable to compile the GPU shader for compression: $log")
    }

    return shader
  }

  private fun floatBufferOf(values: FloatArray): FloatBuffer =
    ByteBuffer
      .allocateDirect(values.size * 4)
      .order(ByteOrder.nativeOrder())
      .asFloatBuffer()
      .apply {
        put(values)
        position(0)
      }

  private companion object {
    const val FRAME_WAIT_TIMEOUT_MS = 2_500L

    const val VERTEX_SHADER = """
      attribute vec4 aPosition;
      attribute vec4 aTextureCoordinate;
      uniform mat4 uTextureMatrix;
      uniform mat4 uRotationMatrix;
      varying vec2 vTextureCoordinate;
      void main() {
        gl_Position = uRotationMatrix * aPosition;
        vTextureCoordinate = (uTextureMatrix * aTextureCoordinate).xy;
      }
    """

    const val FRAGMENT_SHADER = """
      #extension GL_OES_EGL_image_external : require
      precision mediump float;
      varying vec2 vTextureCoordinate;
      uniform samplerExternalOES sTexture;
      void main() {
        gl_FragColor = texture2D(sTexture, vTextureCoordinate);
      }
    """
  }
}
