import Capacitor
import UIKit
import SwiftUI

class AnyMinusBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AnyMinusAudioLabPlugin())
    }
}

@objc(AnyMinusAudioLabPlugin)
public class AnyMinusAudioLabPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AnyMinusAudioLabPlugin"
    public let jsName = "AnyMinusAudioLab"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "begin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "append", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]
    private var url: URL?
    private var handle: FileHandle?
    private var expected = 0
    private var written = 0
    private var showing = false
    private func clear() {
        try? handle?.close()
        handle = nil
        if let url { try? FileManager.default.removeItem(at: url) }
        url = nil
        expected = 0
        written = 0
    }
    @objc func begin(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.showing, self.url == nil, let bytes = call.getInt("bytes"), bytes >= 44, bytes <= 128 * 1024 * 1024 else {
                call.reject("Invalid or busy transfer"); return
            }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("wav")
            guard FileManager.default.createFile(atPath: url.path, contents: nil) else { call.reject("File unavailable"); return }
            do {
                self.url = url
                self.handle = try FileHandle(forWritingTo: url)
                self.expected = bytes
                call.resolve()
            } catch { self.clear(); call.reject("Cannot open local file") }
        }
    }
    @objc func append(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.showing, let handle = self.handle, let encoded = call.getString("data"),
                  encoded.utf8.count <= 100000, let bytes = Data(base64Encoded: encoded),
                  bytes.count > 0, self.written + bytes.count <= self.expected else {
                call.reject("Invalid audio chunk"); return
            }
            do { try handle.write(contentsOf: bytes); self.written += bytes.count; call.resolve() }
            catch { self.clear(); call.reject("Cannot write local file") }
        }
    }
    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.showing, let url = self.url, self.written == self.expected,
                  let parent = self.bridge?.viewController, parent.presentedViewController == nil else {
                call.reject("Audio not ready"); return
            }
            do { try self.handle?.close(); self.handle = nil }
            catch { self.clear(); call.reject("Cannot close local file"); return }
            let lab = AudioLab()
            lab.loadLocalTrack(url, name: String((call.getString("title") ?? "AnyMinus").prefix(200)))
            guard lab.trackURL != nil else { self.clear(); call.reject("Cannot decode native audio"); return }
            self.showing = true
            let view = LabView(lab: lab, onClose: {
                parent.dismiss(animated: true) {
                    self.showing = false
                    self.clear()
                    call.resolve()
                }
            })
            let host = UIHostingController(rootView: view)
            host.modalPresentationStyle = .fullScreen
            parent.present(host, animated: true)
        }
    }
    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if !self.showing { self.clear() }
            call.resolve()
        }
    }
}
