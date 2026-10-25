import ExpoModulesCore
import GameKit

/// Game Center for the app: sign the local player in, report achievement progress, open the achievements dashboard.
/// Achievement ids must match the ones set up in App Store Connect (see docs/store/game-center.md).
public final class GameCenterModule: Module {
  private var started = false
  private var waiting: [Promise] = []

  public func definition() -> ModuleDefinition {
    Name("MBGameCenter")
    Events("onAuthChange")

    Function("isAuthenticated") { GKLocalPlayer.local.isAuthenticated }

    // Signs the player in, once per launch. Resolves after Game Center's first answer (signed in, cancelled
    // or unavailable); later changes, such as signing out in Settings, arrive as onAuthChange.
    AsyncFunction("authenticate") { (promise: Promise) in
      if self.started && self.waiting.isEmpty { promise.resolve(self.playerState(nil)); return }
      self.waiting.append(promise)
      if self.started { return }
      self.started = true
      // The module lives as long as the app, so the handler can hold it.
      GKLocalPlayer.local.authenticateHandler = { vc, error in
        if let vc {
          // Not signed in yet: Game Center hands us its sign-in sheet; the handler runs again when it closes.
          self.appContext?.utilities?.currentViewController()?.present(vc, animated: true)
          return
        }
        let state = self.playerState(error)
        self.sendEvent("onAuthChange", state)
        let w = self.waiting
        self.waiting = []
        w.forEach { $0.resolve(state) }
      }
    }.runOnQueue(.main)

    // progress: achievement id -> percent complete (0-100). Game Center keeps the highest value it has seen.
    // The game shows its own trophy toast, so Game Center's banner stays off.
    AsyncFunction("report") { (progress: [String: Any]) async throws in
      guard GKLocalPlayer.local.isAuthenticated, !progress.isEmpty else { return }
      let list: [GKAchievement] = progress.compactMap { id, value in
        guard let pct = (value as? NSNumber)?.doubleValue else { return nil }
        let a = GKAchievement(identifier: id)
        a.percentComplete = min(100, max(0, pct))
        a.showsCompletionBanner = false
        return a
      }
      try await GKAchievement.report(list)
    }

    // Signed proof of who the player is, for "Sign in with Game Center" (verified by api/auth_gamecenter.php).
    // Apple signs teamPlayerID + bundle id + timestamp + salt; the server checks it against Apple's certificate.
    AsyncFunction("identityProof") { () async -> [String: Any] in
      let p = GKLocalPlayer.local
      guard p.isAuthenticated else { return ["error": "not_signed_in"] }
      do {
        let (url, signature, salt, timestamp) = try await p.fetchItemsForIdentityVerificationSignature()
        return [
          "playerId": p.teamPlayerID,
          "bundleId": Bundle.main.bundleIdentifier ?? "",
          "publicKeyUrl": url.absoluteString,
          "signature": signature.base64EncodedString(),
          "salt": salt.base64EncodedString(),
          "timestamp": String(timestamp),
          "name": p.displayName,
        ]
      } catch {
        return ["error": error.localizedDescription]
      }
    }

    AsyncFunction("showAchievements") { () -> Bool in
      guard GKLocalPlayer.local.isAuthenticated else { return false }
      GKAccessPoint.shared.trigger(state: .achievements) {}
      return true
    }.runOnQueue(.main)
  }

  private func playerState(_ error: Error?) -> [String: Any] {
    let p = GKLocalPlayer.local
    var out: [String: Any] = ["authenticated": p.isAuthenticated]
    if p.isAuthenticated { out["name"] = p.displayName }
    if let error { out["error"] = error.localizedDescription }
    return out
  }
}
