package expo.modules.synzappofflineai

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.lang.reflect.InvocationTargetException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONArray

class SynzappOfflineAiModule : Module() {
  private val engineMutex = Mutex()
  private val generationMutex = Mutex()
  private var cachedEngine: Any? = null
  private var cachedModelPath: String? = null
  private var cachedMaxTokens: Int? = null
  private var cachedNeedsAudio = false
  private var cachedNeedsVision = false

  override fun definition() = ModuleDefinition {
    Name("SynzappOfflineAi")

    AsyncFunction<Boolean>("isAvailable") {
      true
    }

    AsyncFunction("extractDocumentText") Coroutine { uri: String, contentType: String?, fileName: String?, maxChars: Int? ->
      withContext(Dispatchers.Default) {
        extractDocumentText(
          uri = uri,
          contentType = contentType,
          fileName = fileName,
          maxChars = maxChars ?: DEFAULT_DOCUMENT_TEXT_MAX_CHARS
        )
      }
    }

    AsyncFunction("generate") Coroutine { modelPath: String, prompt: String, maxTokens: Int?, temperature: Double? ->
      withContext(Dispatchers.Default) {
        generateResponse(
          modelPath = modelPath,
          prompt = prompt,
          maxTokens = maxTokens ?: DEFAULT_MAX_TOKENS,
          temperature = temperature ?: DEFAULT_TEMPERATURE
        )
      }
    }

    AsyncFunction("generateWithAttachments") Coroutine { modelPath: String, prompt: String, attachmentsJson: String?, maxTokens: Int?, temperature: Double? ->
      withContext(Dispatchers.Default) {
        val attachments = parseAttachmentDescriptors(attachmentsJson)

        generateResponse(
          attachments = attachments,
          modelPath = modelPath,
          prompt = prompt,
          maxTokens = maxTokens ?: DEFAULT_MAX_TOKENS,
          temperature = temperature ?: DEFAULT_TEMPERATURE
        )
      }
    }

    OnDestroy {
      closeLiteRtLmInstance(cachedEngine)
      cachedEngine = null
      cachedModelPath = null
      cachedMaxTokens = null
      cachedNeedsAudio = false
      cachedNeedsVision = false
    }
  }

  private suspend fun extractDocumentText(
    uri: String,
    contentType: String?,
    fileName: String?,
    maxChars: Int
  ): Map<String, Any> {
    val normalizedPath = normalizeFilePath(uri)
    val file = File(normalizedPath)
    val safeMaxChars = maxChars
      .coerceAtLeast(1000)
      .coerceAtMost(DEFAULT_DOCUMENT_TEXT_MAX_CHARS)

    if (!file.exists() || !file.isFile) {
      return mapOf("text" to "", "source" to "missing", "pageCount" to 0)
    }

    return when {
      isPdfDocument(normalizedPath, contentType, fileName) -> recognizePdfText(file, safeMaxChars)
      isImageDocument(normalizedPath, contentType, fileName) -> recognizeImageText(file, safeMaxChars)
      else -> mapOf("text" to "", "source" to "unsupported", "pageCount" to 0)
    }
  }

  private suspend fun recognizeImageText(file: File, maxChars: Int): Map<String, Any> {
    val context = appContext.reactContext
      ?: throw SynzappOfflineAiException("Synzapp AI cannot read this document yet.")
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    return try {
      val image = InputImage.fromFilePath(context, Uri.fromFile(file))
      val result = recognizer.process(image).await()
      val text = normalizeExtractedDocumentText(result.text).take(maxChars)

      mapOf("text" to text, "source" to "image-ocr", "pageCount" to 1)
    } finally {
      recognizer.close()
    }
  }

  private suspend fun recognizePdfText(file: File, maxChars: Int): Map<String, Any> {
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    val extractedText = StringBuilder()
    var renderedPageCount = 0
    var pageCount = 0
    val fileDescriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)

    try {
      val pdfRenderer = PdfRenderer(fileDescriptor)

      try {
        pageCount = pdfRenderer.pageCount
        val pagesToRead = minOf(pdfRenderer.pageCount, DEFAULT_DOCUMENT_OCR_PAGE_LIMIT)

        for (pageIndex in 0 until pagesToRead) {
          if (extractedText.length >= maxChars) {
            break
          }

          val page = pdfRenderer.openPage(pageIndex)

          try {
            val bitmap = renderPdfPageForOcr(page)

            try {
              val image = InputImage.fromBitmap(bitmap, 0)
              val result = recognizer.process(image).await()
              appendDocumentTextWithLimit(extractedText, result.text, maxChars)
              renderedPageCount += 1
            } finally {
              bitmap.recycle()
            }
          } finally {
            page.close()
          }
        }
      } finally {
        pdfRenderer.close()
      }
    } finally {
      fileDescriptor.close()
      recognizer.close()
    }

    return mapOf(
      "text" to extractedText.toString().trim(),
      "source" to "pdf-ocr",
      "pageCount" to if (pageCount > 0) pageCount else renderedPageCount
    )
  }

  private fun renderPdfPageForOcr(page: PdfRenderer.Page): Bitmap {
    val rawWidth = (page.width * PDF_OCR_SCALE).coerceAtLeast(1)
    val rawHeight = (page.height * PDF_OCR_SCALE).coerceAtLeast(1)
    val largestEdge = maxOf(rawWidth, rawHeight)
    val scaleDown = if (largestEdge > PDF_OCR_MAX_BITMAP_EDGE) {
      PDF_OCR_MAX_BITMAP_EDGE.toDouble() / largestEdge.toDouble()
    } else {
      1.0
    }
    val width = (rawWidth * scaleDown).toInt().coerceAtLeast(1)
    val height = (rawHeight * scaleDown).toInt().coerceAtLeast(1)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    canvas.drawColor(Color.WHITE)
    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

    return bitmap
  }

  private suspend fun generateResponse(
    attachments: List<SynzappOfflineAiAttachment> = emptyList(),
    modelPath: String,
    prompt: String,
    maxTokens: Int,
    temperature: Double
  ): Map<String, String> {
    return generationMutex.withLock {
      try {
        generateResponseLocked(
          attachments = attachments,
          modelPath = modelPath,
          prompt = prompt,
          maxTokens = maxTokens,
          temperature = temperature
        )
      } catch (error: SynzappOfflineAiException) {
        throw error
      } catch (error: InvocationTargetException) {
        throw toSynzappOfflineAiException(error)
      } catch (error: ReflectiveOperationException) {
        throw toSynzappOfflineAiException(error)
      }
    }
  }

  private suspend fun generateResponseLocked(
    attachments: List<SynzappOfflineAiAttachment> = emptyList(),
    modelPath: String,
    prompt: String,
    maxTokens: Int,
    temperature: Double
  ): Map<String, String> {
    val normalizedModelPath = normalizeModelPath(modelPath)
    val modelFile = File(normalizedModelPath)

    if (!modelFile.exists() || !modelFile.isFile) {
      throw SynzappOfflineAiException("The offline AI model file was not found on this device.")
    }

    val safePrompt = compactPromptForDevice(prompt.trim())
    val safeMaxTokens = maxOf(maxTokens, DEFAULT_MAX_TOKENS).coerceIn(MIN_MAX_TOKENS, MAX_MAX_TOKENS)

    if (safePrompt.isEmpty()) {
      throw SynzappOfflineAiException("Enter a prompt before asking Synzapp AI.")
    }

    val safeAttachments = attachments
      .map { it.copy(path = normalizeModelPath(it.path)) }
      .filter { attachment ->
        val file = File(attachment.path)
        file.exists() && file.isFile
      }
    val needsVision = safeAttachments.any { it.kind == "image" }
    val needsAudio = safeAttachments.any { it.kind == "audio" }
    val engine = getOrCreateEngine(
      maxTokens = safeMaxTokens,
      modelPath = normalizedModelPath,
      needsAudio = needsAudio,
      needsVision = needsVision
    )
    val samplerConfig = createLiteRtLmSamplerConfig(
      topK = DEFAULT_TOP_K,
      topP = DEFAULT_TOP_P,
      temperature = temperature.coerceAtLeast(0.0),
      seed = DEFAULT_SEED
    )
    val conversationConfig = createLiteRtLmConversationConfig(samplerConfig)
    val conversation = createLiteRtLmConversation(engine, conversationConfig)

    try {
      val response = if (safeAttachments.isEmpty()) {
        sendLiteRtLmTextMessage(conversation, safePrompt)
      } else {
        val contents = safeAttachments.mapNotNull { attachment ->
          when (attachment.kind) {
            "image" -> createLiteRtLmContent("ImageFile", attachment.path)
            "audio" -> createLiteRtLmContent("AudioFile", attachment.path)
            else -> null
          }
        } + createLiteRtLmContent("Text", safePrompt)

        sendLiteRtLmContentsMessage(conversation, createLiteRtLmContents(contents))
      }

      return mapOf("text" to response.toString().trim())
    } finally {
      closeLiteRtLmInstance(conversation)
      releaseCachedEngineAfterGeneration()
    }
  }

  private suspend fun getOrCreateEngine(
    modelPath: String,
    maxTokens: Int,
    needsAudio: Boolean,
    needsVision: Boolean
  ): Any {
    return engineMutex.withLock {
      val existingEngine = cachedEngine

      if (
        existingEngine != null &&
        cachedModelPath == modelPath &&
        cachedMaxTokens == maxTokens &&
        cachedNeedsAudio == needsAudio &&
        cachedNeedsVision == needsVision &&
        isLiteRtLmEngineInitialized(existingEngine)
      ) {
        return@withLock existingEngine
      }

      closeLiteRtLmInstance(cachedEngine)
      cachedEngine = null
      cachedModelPath = null
      cachedMaxTokens = null
      cachedNeedsAudio = false
      cachedNeedsVision = false

      val cacheDir = appContext.reactContext?.cacheDir?.absolutePath
      val engineConfig = createLiteRtLmEngineConfig(
        modelPath = modelPath,
        maxNumTokens = maxTokens,
        needsAudio = needsAudio,
        needsVision = needsVision,
        cacheDir = cacheDir
      )
      val nextEngine = createLiteRtLmEngine(engineConfig)
      initializeLiteRtLmEngine(nextEngine)

      cachedEngine = nextEngine
      cachedModelPath = modelPath
      cachedMaxTokens = maxTokens
      cachedNeedsAudio = needsAudio
      cachedNeedsVision = needsVision

      return@withLock nextEngine
    }
  }

  private fun createLiteRtLmEngineConfig(
    modelPath: String,
    maxNumTokens: Int,
    needsAudio: Boolean,
    needsVision: Boolean,
    cacheDir: String?
  ): Any {
    val backendClass = Class.forName("$LITERTLM_PACKAGE.Backend")
    val engineConfigClass = Class.forName("$LITERTLM_PACKAGE.EngineConfig")
    val constructor = engineConfigClass.getConstructor(
      String::class.java,
      backendClass,
      backendClass,
      backendClass,
      java.lang.Integer::class.java,
      java.lang.Integer::class.java,
      String::class.java
    )

    return constructor.newInstance(
      modelPath,
      createLiteRtLmBackend(TEXT_BACKEND),
      if (needsVision) createLiteRtLmBackend("GPU") else null,
      if (needsAudio) createLiteRtLmBackend("CPU") else null,
      java.lang.Integer.valueOf(maxNumTokens),
      if (needsVision) java.lang.Integer.valueOf(DEFAULT_MAX_IMAGES) else null,
      cacheDir
    )
  }

  private fun createLiteRtLmBackend(kind: String): Any {
    val backendClass = getLiteRtLmBackendClass(kind)

    return backendClass
      .getConstructor()
      .newInstance()
  }

  private fun createLiteRtLmEngine(engineConfig: Any): Any {
    val engineConfigClass = Class.forName("$LITERTLM_PACKAGE.EngineConfig")

    return Class.forName("$LITERTLM_PACKAGE.Engine")
      .getConstructor(engineConfigClass)
      .newInstance(engineConfig)
  }

  private fun initializeLiteRtLmEngine(engine: Any) {
    engine.javaClass.getMethod("initialize").invoke(engine)
  }

  private fun isLiteRtLmEngineInitialized(engine: Any): Boolean {
    return engine.javaClass.getMethod("isInitialized").invoke(engine) as? Boolean ?: false
  }

  private fun createLiteRtLmSamplerConfig(
    topK: Int,
    topP: Double,
    temperature: Double,
    seed: Int
  ): Any {
    return Class.forName("$LITERTLM_PACKAGE.SamplerConfig")
      .getConstructor(
        java.lang.Integer.TYPE,
        java.lang.Double.TYPE,
        java.lang.Double.TYPE,
        java.lang.Integer.TYPE
      )
      .newInstance(topK, topP, temperature, seed)
  }

  private fun createLiteRtLmConversationConfig(samplerConfig: Any): Any {
    val contentsClass = Class.forName("$LITERTLM_PACKAGE.Contents")
    val samplerConfigClass = Class.forName("$LITERTLM_PACKAGE.SamplerConfig")

    return Class.forName("$LITERTLM_PACKAGE.ConversationConfig")
      .getConstructor(
        contentsClass,
        java.util.List::class.java,
        java.util.List::class.java,
        samplerConfigClass
      )
      .newInstance(
        createLiteRtLmContentsFromText(SYNZAPP_SYSTEM_INSTRUCTION),
        emptyList<Any>(),
        emptyList<Any>(),
        samplerConfig
      )
  }

  private fun createLiteRtLmConversation(engine: Any, conversationConfig: Any): Any {
    val conversationConfigClass = Class.forName("$LITERTLM_PACKAGE.ConversationConfig")

    return engine.javaClass
      .getMethod("createConversation", conversationConfigClass)
      .invoke(engine, conversationConfig)
  }

  private fun sendLiteRtLmTextMessage(conversation: Any, prompt: String): Any {
    return conversation.javaClass
      .getMethod("sendMessage", String::class.java, java.util.Map::class.java)
      .invoke(conversation, prompt, emptyMap<String, Any>())
  }

  private fun sendLiteRtLmContentsMessage(conversation: Any, contents: Any): Any {
    val contentsClass = Class.forName("$LITERTLM_PACKAGE.Contents")

    return conversation.javaClass
      .getMethod("sendMessage", contentsClass, java.util.Map::class.java)
      .invoke(conversation, contents, emptyMap<String, Any>())
  }

  private fun createLiteRtLmContent(type: String, value: String): Any {
    return Class.forName(LITERTLM_PACKAGE + ".Content" + JVM_NESTED_CLASS_SEPARATOR + type)
      .getConstructor(String::class.java)
      .newInstance(value)
  }

  private fun createLiteRtLmContents(contents: List<Any>): Any {
    val companion = liteRtLmContentsCompanion()
    val contentClass = Class.forName("$LITERTLM_PACKAGE.Content")
    val contentArray = java.lang.reflect.Array.newInstance(contentClass, contents.size)

    contents.forEachIndexed { index, content ->
      java.lang.reflect.Array.set(contentArray, index, content)
    }

    return companion
      .javaClass
      .getMethod("of", contentArray.javaClass)
      .invoke(companion, contentArray)
  }

  private fun createLiteRtLmContentsFromText(text: String): Any {
    val companion = liteRtLmContentsCompanion()

    return companion
      .javaClass
      .getMethod("of", String::class.java)
      .invoke(companion, text)
  }

  private fun liteRtLmContentsCompanion(): Any {
    return Class.forName("$LITERTLM_PACKAGE.Contents")
      .getField("Companion")
      .get(null)
  }

  private fun getLiteRtLmBackendClass(kind: String): Class<*> {
    val safeKind = kind.trim()
    val candidates = when (safeKind.uppercase()) {
      "CPU" -> listOf("CPU", "Cpu")
      "GPU" -> listOf("GPU", "Gpu")
      else -> listOf(safeKind)
    }

    candidates.forEach { candidate ->
      val backendClass = runCatching {
        Class.forName(LITERTLM_PACKAGE + ".Backend" + JVM_NESTED_CLASS_SEPARATOR + candidate)
      }.getOrNull()

      if (backendClass != null) {
        return backendClass
      }
    }

    throw SynzappOfflineAiException("Synzapp AI cannot use the $safeKind device engine on this Android build.")
  }

  private fun toSynzappOfflineAiException(error: Throwable): SynzappOfflineAiException {
    val rootCause = unwrapInvocationCause(error)
    val detail = rootCause.message
      ?.trim()
      ?.takeIf { message -> message.isNotEmpty() }
      ?: rootCause.javaClass.simpleName

    return SynzappOfflineAiException("Synzapp AI could not complete this request. $detail")
  }

  private tailrec fun unwrapInvocationCause(error: Throwable): Throwable {
    val nextCause = if (error is InvocationTargetException) {
      error.targetException ?: error.cause
    } else {
      error.cause
    }

    return if (nextCause != null && nextCause !== error) {
      unwrapInvocationCause(nextCause)
    } else {
      error
    }
  }

  private fun closeLiteRtLmInstance(instance: Any?) {
    if (instance is AutoCloseable) {
      instance.close()
      return
    }

    instance?.javaClass?.methods
      ?.firstOrNull { method -> method.name == "close" && method.parameterTypes.isEmpty() }
      ?.invoke(instance)
  }

  private fun normalizeModelPath(modelPath: String): String {
    return if (modelPath.startsWith("file://")) {
      modelPath.removePrefix("file://")
    } else {
      modelPath
    }
  }

  private suspend fun releaseCachedEngineAfterGeneration() {
    if (!RELEASE_ENGINE_AFTER_GENERATION) {
      return
    }

    engineMutex.withLock {
      closeLiteRtLmInstance(cachedEngine)
      cachedEngine = null
      cachedModelPath = null
      cachedMaxTokens = null
      cachedNeedsAudio = false
      cachedNeedsVision = false
    }
  }

  private fun compactPromptForDevice(prompt: String): String {
    if (prompt.length <= DEFAULT_PROMPT_MAX_CHARS) {
      return prompt
    }

    val head = prompt.take(DEFAULT_PROMPT_HEAD_CHARS)
    val tail = prompt.takeLast(DEFAULT_PROMPT_TAIL_CHARS)

    return "$head\n\n[Earlier context shortened for device performance.]\n\n$tail"
  }

  private fun normalizeFilePath(uri: String): String {
    return if (uri.startsWith("file://")) {
      Uri.parse(uri).path ?: uri.removePrefix("file://")
    } else {
      uri
    }
  }

  private fun isPdfDocument(path: String, contentType: String?, fileName: String?): Boolean {
    val safeContentType = contentType?.trim()?.lowercase().orEmpty()

    return safeContentType == "application/pdf" ||
      hasFileExtension(path, fileName, "pdf")
  }

  private fun isImageDocument(path: String, contentType: String?, fileName: String?): Boolean {
    val safeContentType = contentType?.trim()?.lowercase().orEmpty()
    val imageExtensions = setOf("bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "tif", "tiff", "webp")

    return safeContentType.startsWith("image/") ||
      imageExtensions.any { extension -> hasFileExtension(path, fileName, extension) }
  }

  private fun hasFileExtension(path: String, fileName: String?, extension: String): Boolean {
    val safeExtension = ".$extension"

    return path.lowercase().endsWith(safeExtension) ||
      fileName?.trim()?.lowercase()?.endsWith(safeExtension) == true
  }

  private fun appendDocumentTextWithLimit(builder: StringBuilder, value: String, maxChars: Int) {
    val safeValue = normalizeExtractedDocumentText(value)

    if (safeValue.isBlank() || builder.length >= maxChars) {
      return
    }

    if (builder.isNotEmpty()) {
      builder.append("\n\n")
    }

    val remainingChars = maxChars - builder.length

    if (remainingChars > 0) {
      builder.append(safeValue.take(remainingChars))
    }
  }

  private fun normalizeExtractedDocumentText(value: String): String {
    return value
      .replace(Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]"), " ")
      .replace(Regex("[ \\t]+\\n"), "\n")
      .replace(Regex("\\n[ \\t]+"), "\n")
      .replace(Regex("[ \\t]{2,}"), " ")
      .replace(Regex("\\n{3,}"), "\n\n")
      .trim()
  }

  private fun parseAttachmentDescriptors(attachmentsJson: String?): List<SynzappOfflineAiAttachment> {
    if (attachmentsJson.isNullOrBlank()) {
      return emptyList()
    }

    val attachments = mutableListOf<SynzappOfflineAiAttachment>()
    val jsonArray = JSONArray(attachmentsJson)

    for (index in 0 until jsonArray.length()) {
      val item = jsonArray.optJSONObject(index) ?: continue
      val kind = item.optString("kind").trim().lowercase()
      val uri = item.optString("uri").trim()

      if ((kind != "image" && kind != "audio") || uri.isBlank()) {
        continue
      }

      attachments.add(
        SynzappOfflineAiAttachment(
          kind = kind,
          path = uri
        )
      )
    }

    return attachments
  }

  companion object {
    private const val DEFAULT_MAX_TOKENS = 1024
    private const val MAX_MAX_TOKENS = 1536
    private const val MIN_MAX_TOKENS = 512
    private const val DEFAULT_PROMPT_HEAD_CHARS = 2600
    private const val DEFAULT_PROMPT_MAX_CHARS = 7600
    private const val DEFAULT_PROMPT_TAIL_CHARS = 4600
    private const val DEFAULT_SEED = 0
    private const val DEFAULT_TEMPERATURE = 0.4
    private const val DEFAULT_TOP_K = 40
    private const val DEFAULT_TOP_P = 0.95
    private const val DEFAULT_MAX_IMAGES = 6
    private const val DEFAULT_DOCUMENT_OCR_PAGE_LIMIT = 8
    private const val DEFAULT_DOCUMENT_TEXT_MAX_CHARS = 12000
    private const val JVM_NESTED_CLASS_SEPARATOR = '$'
    private const val LITERTLM_PACKAGE = "com.google.ai.edge.litertlm"
    private const val PDF_OCR_MAX_BITMAP_EDGE = 2200
    private const val PDF_OCR_SCALE = 2
    private const val RELEASE_ENGINE_AFTER_GENERATION = true
    private const val TEXT_BACKEND = "GPU"
    private const val SYNZAPP_SYSTEM_INSTRUCTION = "You are Synzapp AI, a private on-device workplace assistant. Be direct, practical, respectful, and security-conscious. Answer first with useful guidance. Do not ask a chain of clarifying questions before answering. If exact company policy is missing, give general workplace best-practice guidance tailored to the provided profile context and state your assumptions. Ask at most one short clarifying question at the end only when truly needed. Do not claim access to cloud data or organization data unless it was provided in the prompt."
  }
}

data class SynzappOfflineAiAttachment(
  val kind: String,
  val path: String
)

class SynzappOfflineAiException(message: String) : CodedException(message)
