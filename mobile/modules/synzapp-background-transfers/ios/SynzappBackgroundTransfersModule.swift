import ExpoModulesCore
import Foundation

public final class SynzappBackgroundTransfersModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SynzappBackgroundTransfers")

    Events("onSynzappBackgroundTransferEvent")

    OnStartObserving {
      SynzappBackgroundTransfersManager.shared.setEventHandler { [weak self] body in
        self?.sendEvent("onSynzappBackgroundTransferEvent", body)
      }
    }

    OnStopObserving {
      SynzappBackgroundTransfersManager.shared.clearEventHandler()
    }

    AsyncFunction("isAvailable") { () -> Bool in
      true
    }

    AsyncFunction("startUploadFile") { (input: [String: Any]) throws -> [String: Any] in
      try SynzappBackgroundTransfersManager.shared.startUpload(input: input)
    }

    AsyncFunction("startDownloadFile") { (input: [String: Any]) throws -> [String: Any] in
      try SynzappBackgroundTransfersManager.shared.startDownload(input: input)
    }

    AsyncFunction("getTransferStatus") { (transferId: String) -> [String: Any] in
      SynzappBackgroundTransfersManager.shared.getTransferStatus(transferId: transferId)
    }

    AsyncFunction("cancelTransfer") { (transferId: String) in
      SynzappBackgroundTransfersManager.shared.cancelTransfer(transferId: transferId)
    }
  }
}
