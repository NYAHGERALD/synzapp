import ExpoModulesCore
import UIKit

public final class SynzappVoipCallsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    SynzappVoipCallsManager.shared.configure()
    SynzappVoipCallsManager.shared.registerForVoipPushes()

    return false
  }
}
