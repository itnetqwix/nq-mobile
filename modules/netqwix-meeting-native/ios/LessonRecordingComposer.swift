import AVFoundation
import UIKit

enum LessonRecordingComposerError: Error {
  case noFrames
  case writerFailed(String)
  case imageLoadFailed
}

enum LessonRecordingComposer {
  /// Builds an H.264 MP4 from PNG/JPEG frame files; optionally muxes an M4A/AAC audio track.
  static func compose(
    framePaths: [String],
    audioPath: String?,
    frameDurationMs: Int
  ) throws -> URL {
    let cleaned = framePaths
      .map { stripFilePrefix($0) }
      .filter { FileManager.default.fileExists(atPath: $0) }
    guard cleaned.count >= 2 else {
      throw LessonRecordingComposerError.noFrames
    }

    var images: [UIImage] = []
    for path in cleaned {
      guard let img = UIImage(contentsOfFile: path) else {
        throw LessonRecordingComposerError.imageLoadFailed
      }
      images.append(img)
    }

    guard let first = images.first else {
      throw LessonRecordingComposerError.noFrames
    }

    let width = Int(first.size.width.rounded())
    let height = Int(first.size.height.rounded())
    let evenW = width % 2 == 0 ? width : width + 1
    let evenH = height % 2 == 0 ? height : height + 1

    let videoOnlyURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("lesson-rec-\(UUID().uuidString).mp4")

    try writeVideo(images: images, width: evenW, height: evenH, frameDurationMs: frameDurationMs, outputURL: videoOnlyURL)

    if let audio = audioPath {
      let withAudio = audio.trimmingCharacters(in: .whitespacesAndNewlines)
      if !withAudio.isEmpty {
        let audioFile = stripFilePrefix(withAudio)
        if FileManager.default.fileExists(atPath: audioFile) {
          return try mergeAudio(videoURL: videoOnlyURL, audioPath: audioFile)
        }
      }
    }

    return videoOnlyURL
  }

  private static func writeVideo(
    images: [UIImage],
    width: Int,
    height: Int,
    frameDurationMs: Int,
    outputURL: URL
  ) throws {
    try? FileManager.default.removeItem(at: outputURL)

    let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
    let videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
    ]
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    input.expectsMediaDataInRealTime = false

    let attrs: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
    ]
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: attrs
    )

    guard writer.canAdd(input) else {
      throw LessonRecordingComposerError.writerFailed("Cannot add video input")
    }
    writer.add(input)

    guard writer.startWriting() else {
      throw LessonRecordingComposerError.writerFailed(writer.error?.localizedDescription ?? "startWriting")
    }
    writer.startSession(atSourceTime: .zero)

    let duration = max(frameDurationMs, 250)
    var frameIndex: Int64 = 0

    for image in images {
      while !input.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.005)
      }
      guard let buffer = pixelBuffer(from: image, width: width, height: height) else {
        continue
      }
      let presentationTime = CMTime(value: frameIndex * Int64(duration), timescale: 1000)
      if !adaptor.append(buffer, withPresentationTime: presentationTime) {
        throw LessonRecordingComposerError.writerFailed("append frame failed")
      }
      frameIndex += 1
    }

    input.markAsFinished()
    let group = DispatchGroup()
    var finishError: Error?
    writer.finishWriting {
      if writer.status != .completed {
        finishError = writer.error ?? LessonRecordingComposerError.writerFailed("finishWriting")
      }
      group.leave()
    }
    group.enter()
    group.wait()
    if let finishError {
      throw finishError
    }
  }

  private static func mergeAudio(videoURL: URL, audioPath: String) throws -> URL {
    let composition = AVMutableComposition()
    let videoAsset = AVURLAsset(url: videoURL)
    let audioAsset = AVURLAsset(url: URL(fileURLWithPath: audioPath))

    guard
      let videoTrack = videoAsset.tracks(withMediaType: .video).first,
      let audioTrack = audioAsset.tracks(withMediaType: .audio).first
    else {
      return videoURL
    }

    let compVideo = composition.addMutableTrack(
      withMediaType: .video,
      preferredTrackID: kCMPersistentTrackID_Invalid
    )
    let compAudio = composition.addMutableTrack(
      withMediaType: .audio,
      preferredTrackID: kCMPersistentTrackID_Invalid
    )

    let videoDuration = videoAsset.duration
    let audioDuration = audioAsset.duration
    let duration = CMTimeMinimum(videoDuration, audioDuration)

    try compVideo?.insertTimeRange(
      CMTimeRange(start: .zero, duration: videoDuration),
      of: videoTrack,
      at: .zero
    )
    try compAudio?.insertTimeRange(
      CMTimeRange(start: .zero, duration: duration),
      of: audioTrack,
      at: .zero
    )

    let outURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("lesson-rec-audio-\(UUID().uuidString).mp4")

    guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      return videoURL
    }
    export.outputURL = outURL
    export.outputFileType = .mp4

    let group = DispatchGroup()
    var exportError: Error?
    group.enter()
    export.exportAsynchronously {
      if export.status != .completed {
        exportError = export.error
      }
      group.leave()
    }
    group.wait()

    try? FileManager.default.removeItem(at: videoURL)
    if exportError != nil {
      return videoURL
    }
    return outURL
  }

  private static func pixelBuffer(from image: UIImage, width: Int, height: Int) -> CVPixelBuffer? {
    var buffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_32ARGB,
      nil,
      &buffer
    )
    guard status == kCVReturnSuccess, let pixelBuffer = buffer else { return nil }

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    guard let context = CGContext(
      data: CVPixelBufferGetBaseAddress(pixelBuffer),
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    ) else {
      return nil
    }

    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    let rect = aspectFitRect(imageSize: image.size, targetWidth: width, targetHeight: height)
    if let cg = image.cgImage {
      context.draw(cg, in: rect)
    }
    return pixelBuffer
  }

  private static func aspectFitRect(imageSize: CGSize, targetWidth: Int, targetHeight: Int) -> CGRect {
    let target = CGSize(width: targetWidth, height: targetHeight)
    let scale = min(target.width / imageSize.width, target.height / imageSize.height)
    let w = imageSize.width * scale
    let h = imageSize.height * scale
    let x = (target.width - w) / 2
    let y = (target.height - h) / 2
    return CGRect(x: x, y: y, width: w, height: h)
  }

  private static func stripFilePrefix(_ path: String) -> String {
    if path.hasPrefix("file://") {
      return String(path.dropFirst(7))
    }
    return path
  }
}
