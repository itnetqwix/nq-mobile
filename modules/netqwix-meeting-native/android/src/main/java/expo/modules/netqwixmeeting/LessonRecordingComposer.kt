package expo.modules.netqwixmeeting

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

object LessonRecordingComposer {
  fun compose(
    framePaths: List<String>,
    audioPath: String?,
    frameDurationMs: Int
  ): String {
    val paths = framePaths
      .map { stripFilePrefix(it) }
      .filter { File(it).exists() }
    require(paths.size >= 2) { "At least two frames are required" }

    val bitmaps = paths.mapNotNull { decodeBitmap(it) }
    require(bitmaps.size >= 2) { "Could not decode frames" }

    val width = (bitmaps.first().width / 2) * 2
    val height = (bitmaps.first().height / 2) * 2
    val frameDurationUs = frameDurationMs.coerceAtLeast(250) * 1000L

    val videoFile = File.createTempFile("lesson-rec-v-", ".mp4")
    encodeVideo(bitmaps, width, height, frameDurationUs, videoFile)

    val audioClean = audioPath?.trim()?.let { stripFilePrefix(it) }?.takeIf { it.isNotEmpty() }
    val finalFile = if (audioClean != null && File(audioClean).exists()) {
      mergeAudio(videoFile, audioClean) ?: videoFile
    } else {
      videoFile
    }

    return "file://${finalFile.absolutePath}"
  }

  private fun encodeVideo(
    bitmaps: List<Bitmap>,
    width: Int,
    height: Int,
    frameDurationUs: Long,
    outFile: File
  ) {
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
      setInteger(MediaFormat.KEY_BIT_RATE, 2_500_000)
      setInteger(MediaFormat.KEY_FRAME_RATE, 30)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }

    val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    encoder.start()

    val muxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    var trackIndex = -1
    var muxerStarted = false
    val bufferInfo = MediaCodec.BufferInfo()
    var frameIndex = 0L

    for (bitmap in bitmaps) {
      val scaled = Bitmap.createScaledBitmap(bitmap, width, height, true)
      val yuv = bitmapToYuv420(scaled, width, height)
      if (scaled != bitmap) scaled.recycle()

      var inputIndex = encoder.dequeueInputBuffer(20_000)
      while (inputIndex < 0) {
        val drained = drainEncoder(encoder, muxer, bufferInfo, trackIndex, muxerStarted)
        if (drained.trackIndex >= 0) trackIndex = drained.trackIndex
        muxerStarted = muxerStarted || drained.started
        inputIndex = encoder.dequeueInputBuffer(20_000)
      }
      val inputBuffer = encoder.getInputBuffer(inputIndex)!!
      inputBuffer.clear()
      inputBuffer.put(yuv)
      val pts = frameIndex * frameDurationUs
      encoder.queueInputBuffer(inputIndex, 0, yuv.size, pts, 0)
      frameIndex++

      val drained = drainEncoder(encoder, muxer, bufferInfo, trackIndex, muxerStarted)
      if (drained.trackIndex >= 0) trackIndex = drained.trackIndex
      muxerStarted = muxerStarted || drained.started
    }

    val eosIndex = encoder.dequeueInputBuffer(20_000)
    if (eosIndex >= 0) {
      encoder.queueInputBuffer(
        eosIndex,
        0,
        0,
        frameIndex * frameDurationUs,
        MediaCodec.BUFFER_FLAG_END_OF_STREAM
      )
    }

    var sawEos = false
    while (!sawEos) {
      val drained = drainEncoder(encoder, muxer, bufferInfo, trackIndex, muxerStarted, allowEos = true)
      if (drained.trackIndex >= 0) trackIndex = drained.trackIndex
      muxerStarted = muxerStarted || drained.started
      sawEos = drained.sawEos
    }

    encoder.stop()
    encoder.release()
    if (muxerStarted) muxer.stop()
    muxer.release()
  }

  private data class DrainState(
    val trackIndex: Int,
    val started: Boolean,
    val sawEos: Boolean
  )

  private fun drainEncoder(
    encoder: MediaCodec,
    muxer: MediaMuxer,
    bufferInfo: MediaCodec.BufferInfo,
    trackIndex: Int,
    muxerStarted: Boolean,
    allowEos: Boolean = false
  ): DrainState {
    var idx = trackIndex
    var started = muxerStarted
    var sawEos = false
    while (true) {
      val outIndex = encoder.dequeueOutputBuffer(bufferInfo, 10_000)
      when {
        outIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> return DrainState(idx, started, sawEos)
        outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          if (!started) {
            idx = muxer.addTrack(encoder.outputFormat)
            muxer.start()
            started = true
          }
        }
        outIndex >= 0 -> {
          if (!started) {
            idx = muxer.addTrack(encoder.outputFormat)
            muxer.start()
            started = true
          }
          val encoded = encoder.getOutputBuffer(outIndex)!!
          if (bufferInfo.size > 0 && idx >= 0) {
            encoded.position(bufferInfo.offset)
            encoded.limit(bufferInfo.offset + bufferInfo.size)
            muxer.writeSampleData(idx, encoded, bufferInfo)
          }
          encoder.releaseOutputBuffer(outIndex, false)
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
            sawEos = true
            return DrainState(idx, started, true)
          }
        }
      }
      if (!allowEos) return DrainState(idx, started, sawEos)
    }
  }

  private fun mergeAudio(videoFile: File, audioPath: String): File? {
    return try {
      val out = File.createTempFile("lesson-rec-av-", ".mp4")
      val videoExtractor = MediaExtractor()
      videoExtractor.setDataSource(videoFile.absolutePath)

      val audioExtractor = MediaExtractor()
      audioExtractor.setDataSource(audioPath)

      val muxer = MediaMuxer(out.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      var videoTrack = -1
      var audioTrack = -1

      for (i in 0 until videoExtractor.trackCount) {
        val f = videoExtractor.getTrackFormat(i)
        if (f.getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true) {
          videoExtractor.selectTrack(i)
          videoTrack = muxer.addTrack(f)
          break
        }
      }

      for (i in 0 until audioExtractor.trackCount) {
        val f = audioExtractor.getTrackFormat(i)
        if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
          audioExtractor.selectTrack(i)
          audioTrack = muxer.addTrack(f)
          break
        }
      }

      if (videoTrack < 0) return null
      muxer.start()

      val buffer = ByteBuffer.allocate(1024 * 1024)
      val info = MediaCodec.BufferInfo()

      while (true) {
        info.offset = 0
        info.size = videoExtractor.readSampleData(buffer, 0)
        if (info.size < 0) break
        info.presentationTimeUs = videoExtractor.sampleTime
        info.flags = videoExtractor.sampleFlags
        muxer.writeSampleData(videoTrack, buffer, info)
        videoExtractor.advance()
      }

      if (audioTrack >= 0) {
        buffer.clear()
        while (true) {
          info.offset = 0
          info.size = audioExtractor.readSampleData(buffer, 0)
          if (info.size < 0) break
          info.presentationTimeUs = audioExtractor.sampleTime
          info.flags = audioExtractor.sampleFlags
          muxer.writeSampleData(audioTrack, buffer, info)
          audioExtractor.advance()
        }
      }

      muxer.stop()
      muxer.release()
      videoExtractor.release()
      audioExtractor.release()
      videoFile.delete()
      out
    } catch (_: Exception) {
      null
    }
  }

  private fun decodeBitmap(path: String): Bitmap? =
    try {
      BitmapFactory.decodeFile(path)
    } catch (_: Exception) {
      null
    }

  private fun bitmapToYuv420(bitmap: Bitmap, width: Int, height: Int): ByteArray {
    val argb = IntArray(width * height)
    bitmap.getPixels(argb, 0, width, 0, 0, width, height)
    val yuv = ByteArray(width * height * 3 / 2)
    var yIndex = 0
    var uvIndex = width * height
    for (j in 0 until height) {
      for (i in 0 until width) {
        val c = argb[j * width + i]
        val r = (c shr 16) and 0xff
        val g = (c shr 8) and 0xff
        val b = c and 0xff
        val y = ((66 * r + 129 * g + 25 * b + 128) shr 8) + 16
        yuv[yIndex++] = y.coerceIn(0, 255).toByte()
        if (j % 2 == 0 && i % 2 == 0) {
          val u = ((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128
          val v = ((112 * r - 94 * g - 18 * b + 128) shr 8) + 128
          yuv[uvIndex++] = u.coerceIn(0, 255).toByte()
          yuv[uvIndex++] = v.coerceIn(0, 255).toByte()
        }
      }
    }
    return yuv
  }

  private fun stripFilePrefix(path: String): String =
    if (path.startsWith("file://")) path.removePrefix("file://") else path
}
