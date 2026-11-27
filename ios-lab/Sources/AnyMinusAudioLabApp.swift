import SwiftUI
import AVFoundation
import UniformTypeIdentifiers

@main
struct AnyMinusAudioLabApp: App {
    var body: some Scene { WindowGroup { LabView() } }
}

struct LabView: View {
    @StateObject private var lab = AudioLab()
    @State private var importing = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Проверка звука при видеозаписи").font(.headline)
                    Text("Выберите локальную фонограмму. Сравните звук до включения микрофона, после подготовки камеры и во время записи.").font(.subheadline)
                    CameraPreview(session: lab.capture).frame(height: 280).clipped()
                    Button("Выбрать фонограмму") { importing = true }
                        .disabled(lab.busy || lab.armed)
                    Text(lab.trackName).font(.caption)
                    Picker("Аудиорежим", selection: $lab.measurement) {
                        Text("Default").tag(false)
                        Text("Measurement").tag(true)
                    }.pickerStyle(.segmented).disabled(lab.armed || lab.busy)
                    Toggle("Предпочитать микрофон iPhone", isOn: $lab.preferBuiltIn)
                        .disabled(lab.armed || lab.busy)
                    Button(lab.playing ? "Пауза" : "Воспроизвести") { lab.togglePlayback() }
                        .disabled(lab.busy || lab.trackURL == nil || lab.recording)
                    Button(lab.armed ? "Отключить камеру и микрофон" : "Подготовить камеру и микрофон") {
                        if lab.armed { lab.disarm() }
                        else { Task { await lab.arm() } }
                    }.disabled(lab.busy || lab.trackURL == nil || lab.recording)
                    Button(lab.recording ? "Остановить запись" : "Записать видео") {
                        if lab.recording { lab.stop() } else { lab.start() }
                    }.buttonStyle(.borderedProminent)
                    .disabled(lab.busy || !lab.armed || (!lab.playing && !lab.recording))
                    Text(lab.status).font(.footnote)
                    Text(lab.route).font(.system(.caption, design: .monospaced))
                    Button("Обновить данные аудиомаршрута") { lab.refreshRoute() }
                    if let raw = lab.rawVideo { ShareLink(item: raw) { Label("Поделиться исходной записью", systemImage: "square.and.arrow.up") } }
                    if let mixed = lab.mixedVideo { ShareLink(item: mixed) { Label("Поделиться видео с фонограммой", systemImage: "square.and.arrow.up") } }
                    Text("Тестовый микс добавляет исходную фонограмму к звуку микрофона. Синхронизация приблизительная; при воспроизведении через динамик возможен повторный захват музыки микрофоном.").font(.caption)
                }.padding()
            }.navigationTitle("AnyMinus iOS Lab")
        }.fileImporter(isPresented: $importing, allowedContentTypes: [.audio]) { result in
            switch result {
            case .success(let url): lab.importTrack(url)
            case .failure(let error): lab.status = error.localizedDescription
            }
        }
    }
}

private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var preview: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.preview.session = session
        view.preview.videoGravity = .resizeAspectFill
        return view
    }
    func updateUIView(_ uiView: PreviewView, context: Context) {}
}

@MainActor
final class AudioLab: NSObject, ObservableObject, AVCaptureFileOutputRecordingDelegate {
    let capture = AVCaptureSession()
    private let output = AVCaptureMovieFileOutput()
    private let queue = DispatchQueue(label: "anyminus.lab.capture")
    private var player: AVAudioPlayer?
    private var backingStart: TimeInterval = 0
    private var configured = false
    @Published var trackURL: URL?
    @Published var trackName = "Фонограмма не выбрана"
    @Published var measurement = false
    @Published var preferBuiltIn = true
    @Published var playing = false
    @Published var armed = false
    @Published var busy = false
    @Published var recording = false
    @Published var status = "Готово к тестированию"
    @Published var route = ""
    @Published var rawVideo: URL?
    @Published var mixedVideo: URL?

    private func activate(duplex: Bool) throws {
        let audio = AVAudioSession.sharedInstance()
        if duplex {
            try audio.setCategory(.playAndRecord, mode: measurement ? .measurement : .default,
                                  options: [.defaultToSpeaker, .allowBluetoothA2DP])
            try audio.setActive(true)
            if preferBuiltIn, let mic = audio.availableInputs?.first(where: { $0.portType == .builtInMic }) {
                try audio.setPreferredInput(mic)
            }
        } else {
            try audio.setCategory(.playback, mode: .default)
            try audio.setActive(true)
        }
        refreshRoute()
    }

    func refreshRoute() {
        let audio = AVAudioSession.sharedInstance()
        let inputs = audio.currentRoute.inputs.map { $0.portName }.joined(separator: ", ")
        let outputs = audio.currentRoute.outputs.map { $0.portName }.joined(separator: ", ")
        route = "Input: \(inputs)\nOutput: \(outputs)\nRate: \(audio.sampleRate) Hz · Mode: \(audio.mode.rawValue)"
    }

    func importTrack(_ source: URL) {
        guard !armed && !busy else { return }
        let access = source.startAccessingSecurityScopedResource()
        defer { if access { source.stopAccessingSecurityScopedResource() } }
        do {
            let local = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension(source.pathExtension)
            try FileManager.default.copyItem(at: source, to: local)
            let next = try AVAudioPlayer(contentsOf: local)
            next.numberOfLoops = -1
            player?.stop()
            player = next
            trackURL = local
            trackName = source.lastPathComponent
            playing = false
            status = "Фонограмма загружена"
        } catch { status = error.localizedDescription }
    }

    func togglePlayback() {
        guard let player else { return }
        if player.isPlaying { player.pause(); playing = false; return }
        do {
            try activate(duplex: armed)
            playing = player.play()
        } catch { status = error.localizedDescription }
    }

    func arm() async {
        guard !busy && !armed else { return }
        busy = true
        defer { busy = false }
        guard await AVCaptureDevice.requestAccess(for: .video),
              await AVCaptureDevice.requestAccess(for: .audio) else {
            status = "Разрешите камеру и микрофон в настройках iPhone."
            return
        }
        let resume = player?.isPlaying == true
        player?.pause()
        do {
            try activate(duplex: true)
            if !configured {
                capture.beginConfiguration()
                defer { capture.commitConfiguration() }
                capture.automaticallyConfiguresApplicationAudioSession = false
                capture.sessionPreset = .high
                guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
                      let mic = AVCaptureDevice.default(for: .audio) else { throw LabError.unavailable }
                let cameraInput = try AVCaptureDeviceInput(device: camera)
                let audioInput = try AVCaptureDeviceInput(device: mic)
                guard capture.canAddInput(cameraInput), capture.canAddInput(audioInput), capture.canAddOutput(output) else { throw LabError.unavailable }
                capture.addInput(cameraInput)
                capture.addInput(audioInput)
                capture.addOutput(output)
                if let connection = output.connection(with: .video), connection.isVideoOrientationSupported {
                    connection.videoOrientation = .portrait
                }
                configured = true
            }
            let session = capture
            await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                queue.async { session.startRunning(); continuation.resume() }
            }
            armed = capture.isRunning
            status = armed ? "Камера и микрофон активны" : "Камера не запустилась"
        } catch {
            status = error.localizedDescription
            try? activate(duplex: false)
        }
        if !armed { try? activate(duplex: false) }
        if resume { playing = player?.play() == true }
        refreshRoute()
    }

    func disarm() {
        guard !recording && !busy else { return }
        busy = true
        let session = capture
        queue.async { [weak self] in
            session.stopRunning()
            Task { @MainActor in
                guard let self else { return }
                self.armed = false
                let resume = self.player?.isPlaying == true
                self.player?.pause()
                do { try self.activate(duplex: false); self.status = "Микрофон отключён" }
                catch { self.status = error.localizedDescription }
                if resume { self.playing = self.player?.play() == true }
                self.busy = false
            }
        }
    }

    func start() {
        guard armed, playing, !recording, !busy else { return }
        rawVideo = nil
        mixedVideo = nil
        busy = true
        backingStart = player?.currentTime ?? 0
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("mov")
        output.startRecording(to: url, recordingDelegate: self)
        status = "Запуск записи..."
    }

    func stop() {
        guard recording && !busy else { return }
        busy = true
        output.stopRecording()
        status = "Сохранение..."
    }

    nonisolated func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        Task { @MainActor in
            self.backingStart = self.player?.currentTime ?? self.backingStart
            self.recording = true
            self.busy = false
            self.status = "Идёт запись. Проверьте качество и громкость музыки."
            self.refreshRoute()
        }
    }

    nonisolated func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        Task { @MainActor in
            self.recording = false
            self.player?.pause()
            self.playing = false
            let nsError = error as NSError?
            guard error == nil || nsError?.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool == true else {
                self.status = error?.localizedDescription ?? "Ошибка записи"
                self.busy = false
                return
            }
            self.rawVideo = outputFileURL
            self.status = "Исходное видео сохранено. Подготовка тестового микса."
            do { try await self.exportMix(video: outputFileURL) }
            catch { self.status = "Исходник сохранён; микс: \(error.localizedDescription)" }
            self.busy = false
        }
    }

    private func exportMix(video: URL) async throws {
        guard let trackURL else { throw LabError.unavailable }
        let videoAsset = AVURLAsset(url: video)
        let musicAsset = AVURLAsset(url: trackURL)
        let composition = AVMutableComposition()
        let duration = try await videoAsset.load(.duration)
        for kind in [AVMediaType.video, .audio] {
            guard let source = try await videoAsset.loadTracks(withMediaType: kind).first,
                  let destination = composition.addMutableTrack(withMediaType: kind, preferredTrackID: kCMPersistentTrackID_Invalid) else { continue }
            let range = try await source.load(.timeRange)
            try destination.insertTimeRange(range, of: source, at: range.start)
            if kind == .video { destination.preferredTransform = try await source.load(.preferredTransform) }
        }
        guard let music = try await musicAsset.loadTracks(withMediaType: .audio).first,
              let backing = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw LabError.unavailable }
        let musicRange = try await music.load(.timeRange)
        let total = musicRange.duration.seconds
        guard total.isFinite && total > 0 && duration.seconds.isFinite && duration.seconds > 0 else { throw LabError.unavailable }
        var offset = backingStart.truncatingRemainder(dividingBy: total)
        var cursor = CMTime.zero
        while CMTimeCompare(cursor, duration) < 0 {
            let length = min(total - offset, (duration - cursor).seconds)
            let span = CMTime(seconds: length, preferredTimescale: 60000)
            if CMTimeCompare(span, .zero) <= 0 { break }
            let start = musicRange.start + CMTime(seconds: offset, preferredTimescale: 60000)
            try backing.insertTimeRange(CMTimeRange(start: start, duration: span), of: music, at: cursor)
            cursor = cursor + span
            offset = 0
        }
        let mix = AVMutableAudioMix()
        mix.inputParameters = composition.tracks(withMediaType: .audio).map { track in
            let parameter = AVMutableAudioMixInputParameters(track: track)
            parameter.setVolume(track.trackID == backing.trackID ? 0.6 : 0.8, at: .zero)
            return parameter
        }
        guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else { throw LabError.unavailable }
        let destination = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("mp4")
        exporter.outputURL = destination
        exporter.outputFileType = .mp4
        exporter.audioMix = mix
        await exporter.export()
        guard exporter.status == .completed else { throw exporter.error ?? LabError.unavailable }
        mixedVideo = destination
        status = "Видео и тестовый микс готовы."
    }
}

private enum LabError: LocalizedError {
    case unavailable
    var errorDescription: String? { "Не удалось подготовить аудио или видео." }
}
