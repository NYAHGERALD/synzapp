import Foundation

final class SynzappBackgroundTransfersManager: NSObject, URLSessionTaskDelegate, URLSessionDownloadDelegate {
  static let shared = SynzappBackgroundTransfersManager()

  private let defaults = UserDefaults.standard
  private let defaultsPrefix = "synzapp.backgroundTransfer.v1."
  private let queue = DispatchQueue(label: "com.synzapp.backgroundTransfers.state")
  private var eventHandler: (([String: Any]) -> Void)?
  private var taskMetadataByIdentifier: [Int: TransferMetadata] = [:]

  private lazy var session: URLSession = {
    let configuration = URLSessionConfiguration.background(withIdentifier: "com.synzapp.mobile.chatMediaTransfers")
    configuration.isDiscretionary = false
    configuration.sessionSendsLaunchEvents = true
    configuration.timeoutIntervalForRequest = 60
    configuration.timeoutIntervalForResource = 60 * 60
    configuration.waitsForConnectivity = true
    return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
  }()

  private override init() {
    super.init()
  }

  func setEventHandler(_ handler: @escaping ([String: Any]) -> Void) {
    queue.sync {
      eventHandler = handler
    }
  }

  func clearEventHandler() {
    queue.sync {
      eventHandler = nil
    }
  }

  func startUpload(input: [String: Any]) throws -> [String: Any] {
    guard let urlString = input["url"] as? String, let url = URL(string: urlString) else {
      throw TransferError.invalidUrl
    }
    guard let fileUri = input["fileUri"] as? String, let fileUrl = localFileUrl(from: fileUri) else {
      throw TransferError.invalidFile
    }

    let transferId = makeTransferId(prefix: "upload")
    var request = URLRequest(url: url)
    request.httpMethod = (input["method"] as? String)?.uppercased() ?? "PUT"
    applyHeaders(input["headers"], to: &request)

    let task = session.uploadTask(with: request, fromFile: fileUrl)
    let metadata = TransferMetadata(
      destinationUri: nil,
      fileUri: fileUri,
      taskIdentifier: task.taskIdentifier,
      transferId: transferId,
      transferType: "upload"
    )

    queue.sync {
      taskMetadataByIdentifier[task.taskIdentifier] = metadata
      save(snapshot: TransferSnapshot(metadata: metadata, bytesExpected: 0, bytesTransferred: 0, errorMessage: nil, status: "running"))
    }

    task.taskDescription = transferId
    task.resume()
    emit(snapshotFor: metadata, status: "running", bytesTransferred: 0, bytesExpected: 0, errorMessage: nil)

    return ["transferId": transferId]
  }

  func startDownload(input: [String: Any]) throws -> [String: Any] {
    guard let urlString = input["url"] as? String, let url = URL(string: urlString) else {
      throw TransferError.invalidUrl
    }
    guard let destinationUri = input["destinationUri"] as? String, localFileUrl(from: destinationUri) != nil else {
      throw TransferError.invalidDestination
    }

    let transferId = makeTransferId(prefix: "download")
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    applyHeaders(input["headers"], to: &request)

    let task = session.downloadTask(with: request)
    let metadata = TransferMetadata(
      destinationUri: destinationUri,
      fileUri: nil,
      taskIdentifier: task.taskIdentifier,
      transferId: transferId,
      transferType: "download"
    )

    queue.sync {
      taskMetadataByIdentifier[task.taskIdentifier] = metadata
      save(snapshot: TransferSnapshot(metadata: metadata, bytesExpected: 0, bytesTransferred: 0, errorMessage: nil, status: "running"))
    }

    task.taskDescription = transferId
    task.resume()
    emit(snapshotFor: metadata, status: "running", bytesTransferred: 0, bytesExpected: 0, errorMessage: nil)

    return ["transferId": transferId]
  }

  func getTransferStatus(transferId: String) -> [String: Any] {
    guard let snapshot = loadSnapshot(transferId: transferId) else {
      return [
        "bytesExpected": 0,
        "bytesTransferred": 0,
        "progress": 0,
        "status": "not_found",
        "transferId": transferId,
        "transferType": "download"
      ]
    }

    return snapshot.toEventBody()
  }

  func cancelTransfer(transferId: String) {
    session.getAllTasks { tasks in
      tasks
        .filter { $0.taskDescription == transferId }
        .forEach { $0.cancel() }
    }
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didSendBodyData bytesSent: Int64,
    totalBytesSent: Int64,
    totalBytesExpectedToSend: Int64
  ) {
    guard let metadata = metadata(for: task) else {
      return
    }

    emit(snapshotFor: metadata, status: "running", bytesTransferred: totalBytesSent, bytesExpected: totalBytesExpectedToSend, errorMessage: nil)
  }

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64,
    totalBytesExpectedToWrite: Int64
  ) {
    guard let metadata = metadata(for: downloadTask) else {
      return
    }

    emit(snapshotFor: metadata, status: "running", bytesTransferred: totalBytesWritten, bytesExpected: totalBytesExpectedToWrite, errorMessage: nil)
  }

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didFinishDownloadingTo location: URL
  ) {
    guard
      let metadata = metadata(for: downloadTask),
      let destinationUri = metadata.destinationUri,
      let destinationUrl = localFileUrl(from: destinationUri)
    else {
      return
    }

    do {
      try FileManager.default.createDirectory(
        at: destinationUrl.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      if FileManager.default.fileExists(atPath: destinationUrl.path) {
        try FileManager.default.removeItem(at: destinationUrl)
      }
      try FileManager.default.moveItem(at: location, to: destinationUrl)
    } catch {
      emit(snapshotFor: metadata, status: "failed", bytesTransferred: 0, bytesExpected: 0, errorMessage: error.localizedDescription)
    }
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didCompleteWithError error: Error?
  ) {
    guard let metadata = metadata(for: task) else {
      return
    }

    let response = task.response as? HTTPURLResponse
    let isHttpSuccess = response == nil || (200...299).contains(response?.statusCode ?? 0)
    let status = error == nil && isHttpSuccess ? "completed" : "failed"
    let message = error?.localizedDescription ?? (isHttpSuccess ? nil : "HTTP \(response?.statusCode ?? 0)")
    let transferred = max(task.countOfBytesSent, task.countOfBytesReceived, 0)
    let expected = max(task.countOfBytesExpectedToSend, task.countOfBytesExpectedToReceive, transferred)

    emit(snapshotFor: metadata, status: status, bytesTransferred: transferred, bytesExpected: expected, errorMessage: message)

    queue.sync {
      taskMetadataByIdentifier.removeValue(forKey: task.taskIdentifier)
    }
  }

  private func metadata(for task: URLSessionTask) -> TransferMetadata? {
    queue.sync {
      if let metadata = taskMetadataByIdentifier[task.taskIdentifier] {
        return metadata
      }

      guard let transferId = task.taskDescription, let snapshot = loadSnapshot(transferId: transferId) else {
        return nil
      }

      taskMetadataByIdentifier[task.taskIdentifier] = snapshot.metadata
      return snapshot.metadata
    }
  }

  private func emit(
    snapshotFor metadata: TransferMetadata,
    status: String,
    bytesTransferred: Int64,
    bytesExpected: Int64,
    errorMessage: String?
  ) {
    let safeExpected = bytesExpected > 0 ? bytesExpected : bytesTransferred
    let snapshot = TransferSnapshot(
      metadata: metadata,
      bytesExpected: safeExpected,
      bytesTransferred: bytesTransferred,
      errorMessage: errorMessage,
      status: status
    )

    queue.sync {
      save(snapshot: snapshot)
      eventHandler?(snapshot.toEventBody())
    }
  }

  private func applyHeaders(_ value: Any?, to request: inout URLRequest) {
    guard let headers = value as? [String: String] else {
      return
    }

    headers.forEach { key, value in
      request.setValue(value, forHTTPHeaderField: key)
    }
  }

  private func localFileUrl(from uri: String) -> URL? {
    if uri.hasPrefix("file://") {
      return URL(string: uri)
    }

    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }

    return nil
  }

  private func makeTransferId(prefix: String) -> String {
    "\(prefix)_\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.lowercased())"
  }

  private func defaultsKey(for transferId: String) -> String {
    "\(defaultsPrefix)\(transferId)"
  }

  private func save(snapshot: TransferSnapshot) {
    guard let data = try? JSONEncoder().encode(snapshot) else {
      return
    }

    defaults.set(data, forKey: defaultsKey(for: snapshot.metadata.transferId))
  }

  private func loadSnapshot(transferId: String) -> TransferSnapshot? {
    guard let data = defaults.data(forKey: defaultsKey(for: transferId)) else {
      return nil
    }

    return try? JSONDecoder().decode(TransferSnapshot.self, from: data)
  }
}

private struct TransferMetadata: Codable {
  let destinationUri: String?
  let fileUri: String?
  let taskIdentifier: Int
  let transferId: String
  let transferType: String
}

private struct TransferSnapshot: Codable {
  let metadata: TransferMetadata
  let bytesExpected: Int64
  let bytesTransferred: Int64
  let errorMessage: String?
  let status: String

  func toEventBody() -> [String: Any] {
    let progress = bytesExpected > 0
      ? min(max(Double(bytesTransferred) / Double(bytesExpected), 0), 1)
      : (status == "completed" ? 1 : 0)
    var body: [String: Any] = [
      "bytesExpected": max(bytesExpected, 0),
      "bytesTransferred": max(bytesTransferred, 0),
      "progress": progress,
      "status": status,
      "transferId": metadata.transferId,
      "transferType": metadata.transferType
    ]

    if let destinationUri = metadata.destinationUri {
      body["destinationUri"] = destinationUri
    }

    if let errorMessage = errorMessage {
      body["errorMessage"] = errorMessage
    }

    return body
  }
}

private enum TransferError: Error {
  case invalidDestination
  case invalidFile
  case invalidUrl
}
