import AVKit
import ExpoModulesCore

public class NetQwixMeetingModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NetQwixMeeting")

    Function("isPipSupported") { () -> Bool in
      if #available(iOS 15.0, *) {
        return AVPictureInPictureController.isPictureInPictureSupported()
      }
      return false
    }

    AsyncFunction("enterPipMode") { (_ width: Double, _ height: Double) in
      // iOS lesson PiP is driven by react-native-webrtc `iosPIP` on MeetingIosPipHost.
    }

    AsyncFunction("exitPipMode") {
    }

    AsyncFunction("composeLessonRecording") { (
      framePaths: [String],
      audioPath: String?,
      frameDurationMs: Double
    ) -> String in
      let url = try LessonRecordingComposer.compose(
        framePaths: framePaths,
        audioPath: audioPath,
        frameDurationMs: Int(frameDurationMs)
      )
      return url.absoluteString
    }
  }
}
