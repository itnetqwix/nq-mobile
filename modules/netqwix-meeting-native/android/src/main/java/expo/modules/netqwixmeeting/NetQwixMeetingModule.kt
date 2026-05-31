package expo.modules.netqwixmeeting

import android.app.Activity
import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NetQwixMeetingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NetQwixMeeting")

    Function("isPipSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
    }

    AsyncFunction("enterPipMode") { width: Double, height: Double ->
      val activity: Activity = appContext.currentActivity
        ?: throw IllegalStateException("No activity available for PiP")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val w = width.toInt().coerceAtLeast(1)
        val h = height.toInt().coerceAtLeast(1)
        val params = PictureInPictureParams.Builder()
          .setAspectRatio(Rational(w, h))
          .build()
        activity.enterPictureInPictureMode(params)
      }
    }

    AsyncFunction("exitPipMode") {
      // User expands PiP to return; no explicit Android API required here.
    }

    AsyncFunction("composeLessonRecording") { framePaths: List<String>, audioPath: String?, frameDurationMs: Double ->
      LessonRecordingComposer.compose(
        framePaths = framePaths,
        audioPath = audioPath,
        frameDurationMs = frameDurationMs.toInt()
      )
    }
  }
}
