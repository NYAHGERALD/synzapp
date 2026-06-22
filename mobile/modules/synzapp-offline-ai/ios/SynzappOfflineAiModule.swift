import ExpoModulesCore
import Foundation
import PDFKit
import UIKit
import Vision

public final class SynzappOfflineAiModule: Module {
  private let engineStore = SynzappOfflineAiEngineStore()

  public func definition() -> ModuleDefinition {
    Name("SynzappOfflineAi")

    AsyncFunction("isAvailable") { () -> Bool in
      true
    }

    AsyncFunction("extractDocumentText") { (
      uri: String,
      contentType: String?,
      fileName: String?,
      maxChars: Int?
    ) async throws -> [String: Any] in
      try await Self.extractDocumentText(
        uri: uri,
        contentType: contentType,
        fileName: fileName,
        maxChars: maxChars ?? Self.defaultDocumentTextMaxChars
      )
    }

    AsyncFunction("generate") { (
      modelPath: String,
      prompt: String,
      maxTokens: Int?,
      temperature: Double?
    ) async throws -> [String: String] in
      let normalizedPath = Self.normalizeModelPath(modelPath)

      guard FileManager.default.fileExists(atPath: normalizedPath) else {
        throw SynzappOfflineAiError.modelNotFound
      }

      let safePrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)

      guard !safePrompt.isEmpty else {
        throw SynzappOfflineAiError.emptyPrompt
      }

      let engine = try await engineStore.engine(
        modelPath: normalizedPath,
        maxTokens: maxTokens ?? Self.defaultMaxTokens,
        needsAudio: false,
        needsVision: false
      )
      let samplerConfig = try SamplerConfig(
        topK: Self.defaultTopK,
        topP: Self.defaultTopP,
        temperature: Float(max(temperature ?? Self.defaultTemperature, 0)),
        seed: Self.defaultSeed
      )
      let conversationConfig = ConversationConfig(
        systemMessage: Message(Self.systemInstruction, role: .system),
        samplerConfig: samplerConfig
      )
      let conversation = try await engine.createConversation(with: conversationConfig)
      let response = try await conversation.sendMessage(Message(safePrompt))

      return ["text": response.toString.trimmingCharacters(in: .whitespacesAndNewlines)]
    }

    AsyncFunction("generateWithAttachments") { (
      modelPath: String,
      prompt: String,
      attachmentsJson: String?,
      maxTokens: Int?,
      temperature: Double?
    ) async throws -> [String: String] in
      let normalizedPath = Self.normalizeModelPath(modelPath)

      guard FileManager.default.fileExists(atPath: normalizedPath) else {
        throw SynzappOfflineAiError.modelNotFound
      }

      let safePrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)

      guard !safePrompt.isEmpty else {
        throw SynzappOfflineAiError.emptyPrompt
      }

      let attachments = Self.parseAttachments(attachmentsJson)
      let safeAttachments = attachments.compactMap { attachment -> SynzappOfflineAiAttachment? in
        let normalizedAttachmentPath = Self.normalizeModelPath(attachment.uri)

        guard FileManager.default.fileExists(atPath: normalizedAttachmentPath) else {
          return nil
        }

        return SynzappOfflineAiAttachment(kind: attachment.kind, uri: normalizedAttachmentPath)
      }
      let needsVision = safeAttachments.contains { $0.kind == "image" }
      let needsAudio = safeAttachments.contains { $0.kind == "audio" }
      let engine = try await engineStore.engine(
        modelPath: normalizedPath,
        maxTokens: maxTokens ?? Self.defaultMaxTokens,
        needsAudio: needsAudio,
        needsVision: needsVision
      )
      let samplerConfig = try SamplerConfig(
        topK: Self.defaultTopK,
        topP: Self.defaultTopP,
        temperature: Float(max(temperature ?? Self.defaultTemperature, 0)),
        seed: Self.defaultSeed
      )
      let conversationConfig = ConversationConfig(
        systemMessage: Message(Self.systemInstruction, role: .system),
        samplerConfig: samplerConfig
      )
      let conversation = try await engine.createConversation(with: conversationConfig)
      let contents = Self.buildContents(prompt: safePrompt, attachments: safeAttachments)
      let response = try await conversation.sendMessage(Message(contents: contents))

      return ["text": response.toString.trimmingCharacters(in: .whitespacesAndNewlines)]
    }
  }

  private static func extractDocumentText(
    uri: String,
    contentType: String?,
    fileName: String?,
    maxChars: Int
  ) async throws -> [String: Any] {
    let normalizedPath = normalizeModelPath(uri)
    let safeMaxChars = min(max(maxChars, 1000), defaultDocumentTextMaxChars)

    guard FileManager.default.fileExists(atPath: normalizedPath) else {
      return ["text": "", "source": "missing", "pageCount": 0]
    }

    if isPdfDocument(path: normalizedPath, contentType: contentType, fileName: fileName) {
      return try await extractPdfText(path: normalizedPath, maxChars: safeMaxChars)
    }

    if isImageDocument(path: normalizedPath, contentType: contentType, fileName: fileName) {
      return try await extractImageText(path: normalizedPath, maxChars: safeMaxChars)
    }

    return ["text": "", "source": "unsupported", "pageCount": 0]
  }

  private static func extractImageText(path: String, maxChars: Int) async throws -> [String: Any] {
    guard let cgImage = UIImage(contentsOfFile: path)?.cgImage else {
      return ["text": "", "source": "image-ocr", "pageCount": 1]
    }

    let text = try await recognizeText(in: cgImage, maxChars: maxChars)

    return ["text": text, "source": "image-ocr", "pageCount": 1]
  }

  private static func extractPdfText(path: String, maxChars: Int) async throws -> [String: Any] {
    guard let document = PDFDocument(url: URL(fileURLWithPath: path)) else {
      return ["text": "", "source": "pdf-ocr", "pageCount": 0]
    }

    let pageCount = document.pageCount
    let embeddedText = normalizeExtractedDocumentText(document.string ?? "")

    if !embeddedText.isEmpty {
      return [
        "text": String(embeddedText.prefix(maxChars)),
        "source": "pdf-text",
        "pageCount": pageCount
      ]
    }

    let pagesToRead = min(pageCount, defaultDocumentOcrPageLimit)
    var extractedText = ""

    for pageIndex in 0..<pagesToRead {
      guard extractedText.count < maxChars,
        let page = document.page(at: pageIndex),
        let pageImage = renderPdfPageForOcr(page)
      else {
        continue
      }

      let pageText = try await recognizeText(in: pageImage, maxChars: maxChars - extractedText.count)
      extractedText = appendDocumentTextWithLimit(extractedText, pageText, maxChars: maxChars)
    }

    return [
      "text": extractedText.trimmingCharacters(in: .whitespacesAndNewlines),
      "source": "pdf-ocr",
      "pageCount": pageCount
    ]
  }

  private static func renderPdfPageForOcr(_ page: PDFPage) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let rawWidth = max(bounds.width * CGFloat(pdfOcrScale), 1)
    let rawHeight = max(bounds.height * CGFloat(pdfOcrScale), 1)
    let largestEdge = max(rawWidth, rawHeight)
    let scaleDown: CGFloat

    if largestEdge > CGFloat(pdfOcrMaxBitmapEdge) {
      scaleDown = CGFloat(pdfOcrMaxBitmapEdge) / largestEdge
    } else {
      scaleDown = 1
    }
    let size = CGSize(
      width: max(floor(rawWidth * scaleDown), 1),
      height: max(floor(rawHeight * scaleDown), 1)
    )
    let format = UIGraphicsImageRendererFormat.default()
    format.opaque = true
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let image = renderer.image { context in
      UIColor.white.setFill()
      context.fill(CGRect(origin: .zero, size: size))
      context.cgContext.saveGState()
      context.cgContext.translateBy(x: 0, y: size.height)
      context.cgContext.scaleBy(x: size.width / bounds.width, y: -size.height / bounds.height)
      context.cgContext.translateBy(x: -bounds.origin.x, y: -bounds.origin.y)
      page.draw(with: .mediaBox, to: context.cgContext)
      context.cgContext.restoreGState()
    }

    return image.cgImage
  }

  private static func recognizeText(in cgImage: CGImage, maxChars: Int) async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.global(qos: .userInitiated).async {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        do {
          try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
          let observations = request.results ?? []
          let lines = observations.compactMap { observation in
            observation.topCandidates(1).first?.string
          }
          let text = normalizeExtractedDocumentText(lines.joined(separator: "\n"))

          continuation.resume(returning: String(text.prefix(maxChars)))
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private static func isPdfDocument(path: String, contentType: String?, fileName: String?) -> Bool {
    let safeContentType = contentType?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""

    return safeContentType == "application/pdf" ||
      hasFileExtension(path: path, fileName: fileName, fileExtension: "pdf")
  }

  private static func isImageDocument(path: String, contentType: String?, fileName: String?) -> Bool {
    let safeContentType = contentType?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
    let imageExtensions = ["bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "tif", "tiff", "webp"]

    return safeContentType.hasPrefix("image/") ||
      imageExtensions.contains { hasFileExtension(path: path, fileName: fileName, fileExtension: $0) }
  }

  private static func hasFileExtension(path: String, fileName: String?, fileExtension: String) -> Bool {
    let safeExtension = "." + fileExtension

    return path.lowercased().hasSuffix(safeExtension) ||
      (fileName?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasSuffix(safeExtension) ?? false)
  }

  private static func appendDocumentTextWithLimit(
    _ currentText: String,
    _ nextText: String,
    maxChars: Int
  ) -> String {
    let safeNextText = normalizeExtractedDocumentText(nextText)

    guard !safeNextText.isEmpty, currentText.count < maxChars else {
      return currentText
    }

    let separator = currentText.isEmpty ? "" : "\n\n"
    let remainingChars = maxChars - currentText.count - separator.count

    guard remainingChars > 0 else {
      return currentText
    }

    return currentText + separator + String(safeNextText.prefix(remainingChars))
  }

  private static func normalizeExtractedDocumentText(_ value: String) -> String {
    let noControlCharacters = value.unicodeScalars.map { scalar -> String in
      if scalar.value < 32 && scalar.value != 9 && scalar.value != 10 && scalar.value != 13 {
        return " "
      }

      return String(scalar)
    }.joined()

    return noControlCharacters
      .replacingOccurrences(of: "[ \\t]+\\n", with: "\n", options: .regularExpression)
      .replacingOccurrences(of: "\\n[ \\t]+", with: "\n", options: .regularExpression)
      .replacingOccurrences(of: "[ \\t]{2,}", with: " ", options: .regularExpression)
      .replacingOccurrences(of: "\\n{3,}", with: "\n\n", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func normalizeModelPath(_ modelPath: String) -> String {
    guard modelPath.hasPrefix("file://"), let url = URL(string: modelPath) else {
      return modelPath
    }

    return url.path
  }

  private static func parseAttachments(_ attachmentsJson: String?) -> [SynzappOfflineAiAttachment] {
    guard let attachmentsJson,
      !attachmentsJson.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      let data = attachmentsJson.data(using: .utf8),
      let attachments = try? JSONDecoder().decode([SynzappOfflineAiAttachment].self, from: data)
    else {
      return []
    }

    return attachments.filter { attachment in
      (attachment.kind == "image" || attachment.kind == "audio") &&
        !attachment.uri.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
  }

  private static func buildContents(
    prompt: String,
    attachments: [SynzappOfflineAiAttachment]
  ) -> [Content] {
    var contents = attachments.compactMap { attachment -> Content? in
      switch attachment.kind {
      case "image":
        return .imageFile(attachment.uri)
      case "audio":
        return .audioFile(attachment.uri)
      default:
        return nil
      }
    }

    contents.append(.text(prompt))

    return contents
  }

  private static let defaultMaxTokens = 512
  private static let defaultSeed = 0
  private static let defaultTemperature = 0.4
  private static let defaultTopK = 40
  private static let defaultTopP: Float = 0.95
  private static let defaultDocumentOcrPageLimit = 8
  private static let defaultDocumentTextMaxChars = 12000
  private static let pdfOcrMaxBitmapEdge = 2200
  private static let pdfOcrScale = 2
  private static let systemInstruction = "You are Synzapp AI, a private on-device workplace assistant. Be direct, practical, respectful, and security-conscious. Answer first with useful guidance. Do not ask a chain of clarifying questions before answering. If exact company policy is missing, give general workplace best-practice guidance tailored to the provided profile context and state your assumptions. Ask at most one short clarifying question at the end only when truly needed. Do not claim access to cloud data or organization data unless it was provided in the prompt."
}

private actor SynzappOfflineAiEngineStore {
  private var cachedEngine: Engine?
  private var cachedModelPath: String?
  private var cachedMaxTokens: Int?
  private var cachedNeedsAudio = false
  private var cachedNeedsVision = false

  func engine(
    modelPath: String,
    maxTokens: Int,
    needsAudio: Bool,
    needsVision: Bool
  ) async throws -> Engine {
    if let cachedEngine,
      cachedModelPath == modelPath,
      cachedMaxTokens == maxTokens,
      cachedNeedsAudio == needsAudio,
      cachedNeedsVision == needsVision,
      await cachedEngine.isInitialized()
    {
      return cachedEngine
    }

    if let cachedEngine {
      await cachedEngine.close()
    }

    let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.path
    let config = try EngineConfig(
      modelPath: modelPath,
      backend: .gpu,
      visionBackend: needsVision ? .gpu : nil,
      audioBackend: needsAudio ? .cpu() : nil,
      maxNumTokens: maxTokens,
      cacheDir: cacheDir
    )
    let nextEngine = Engine(engineConfig: config)
    try await nextEngine.initialize()

    cachedEngine = nextEngine
    cachedModelPath = modelPath
    cachedMaxTokens = maxTokens
    cachedNeedsAudio = needsAudio
    cachedNeedsVision = needsVision

    return nextEngine
  }
}

private struct SynzappOfflineAiAttachment: Codable {
  let kind: String
  let uri: String
}

private enum SynzappOfflineAiError: Error, LocalizedError {
  case emptyPrompt
  case modelNotFound

  var errorDescription: String? {
    switch self {
    case .emptyPrompt:
      return "Enter a prompt before asking Synzapp AI."
    case .modelNotFound:
      return "The offline AI model file was not found on this device."
    }
  }
}
