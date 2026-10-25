package expo.modules.mbplaygames

import android.app.Activity
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Google Play Games Services for the app: signed-in state (Play Games signs the player in automatically at launch),
 * achievement progress, the achievements screen, and a server auth code the backend exchanges for the player's id.
 * Everything resolves with a plain value or { error } instead of throwing, so JS never has to guard against it.
 */
class PlayGamesModule : Module() {
  private val activity: Activity? get() = appContext.currentActivity

  override fun definition() = ModuleDefinition {
    Name("MBPlayGames")

    OnCreate {
      // starts Play Games' automatic sign-in; a bad project id must never take the app down
      try { appContext.reactContext?.let { PlayGamesSdk.initialize(it) } } catch (_: Throwable) { }
    }

    // Is the player signed in to Play Games on this device? With their display name when so.
    AsyncFunction("authenticate") { signInFirst: Boolean, promise: Promise ->
      val a = activity
      if (a == null) { promise.resolve(mapOf("authenticated" to false, "error" to "no_activity")); return@AsyncFunction }
      val client = PlayGames.getGamesSignInClient(a)
      val task = if (signInFirst) client.signIn() else client.isAuthenticated()
      task.addOnCompleteListener { t ->
        if (!(t.isSuccessful && t.result.isAuthenticated)) {
          promise.resolve(mapOf("authenticated" to false, "error" to (t.exception?.message ?: "")))
          return@addOnCompleteListener
        }
        PlayGames.getPlayersClient(a).currentPlayer.addOnCompleteListener { pt ->
          promise.resolve(mapOf("authenticated" to true, "name" to (if (pt.isSuccessful) pt.result.displayName else "")))
        }
      }
    }

    // percent per achievement id (the Play Console ids); achievements are incremental with 100 steps, so 100 unlocks
    AsyncFunction("report") { percent: Map<String, Int>, promise: Promise ->
      val a = activity
      if (a == null) { promise.resolve(false); return@AsyncFunction }
      try {
        val c = PlayGames.getAchievementsClient(a)
        percent.forEach { (id, n) -> if (n > 0) c.setSteps(id, minOf(100, n)) }
        promise.resolve(true)
      } catch (e: Throwable) { promise.resolve(false) }
    }

    AsyncFunction("showAchievements") { promise: Promise ->
      val a = activity
      if (a == null) { promise.resolve(false); return@AsyncFunction }
      PlayGames.getAchievementsClient(a).achievementsIntent
        .addOnSuccessListener { i -> a.startActivityForResult(i, RC_ACHIEVEMENTS); promise.resolve(true) }
        .addOnFailureListener { promise.resolve(false) }
    }

    // single-use code for the game server (the backend exchanges it with Google); webClientId = the OAuth *web* client
    AsyncFunction("serverAuthCode") { webClientId: String, promise: Promise ->
      val a = activity
      if (a == null) { promise.resolve(mapOf("error" to "no_activity")); return@AsyncFunction }
      PlayGames.getGamesSignInClient(a).requestServerSideAccess(webClientId, false)
        .addOnCompleteListener { t ->
          promise.resolve(if (t.isSuccessful) mapOf("code" to t.result) else mapOf("error" to (t.exception?.message ?: "failed")))
        }
    }
  }

  companion object { private const val RC_ACHIEVEMENTS = 9003 }
}
