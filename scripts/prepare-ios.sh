#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f dist/index.html
if [[ ! -d ios/App/App.xcodeproj ]]; then
  npx cap add ios --packagemanager SPM
fi
npx cap sync ios
python3 - <<'PY'
from pathlib import Path
import re, plistlib
root = Path("ios/App/App")
delegate = root / "AppDelegate.swift"
marker = "// ANYMINUS NATIVE MODULE (generated)"
base = delegate.read_text().split(marker)[0].rstrip()
lab = Path("ios-lab/Sources/AnyMinusAudioLabApp.swift").read_text()
lab, n = re.subn(r'@main\s+struct AnyMinusAudioLabApp: App \{.*?\n\}', '', lab, count=1, flags=re.S)
if n != 1:
    raise SystemExit("Native entrypoint not found")
bridge = Path("ios-hybrid/AudioLabPlugin.swift").read_text()
delegate.write_text(base + "\n\n" + marker + "\n" + lab + "\n" + bridge)
story = root / "Base.lproj/Main.storyboard"
text = story.read_text()
if 'customClass="CAPBridgeViewController"' in text:
    text, n = re.subn(r'customClass="CAPBridgeViewController"\s+customModule="Capacitor"', 'customClass="AnyMinusBridgeViewController" customModule="App" customModuleProvider="target"', text, count=1)
    if n != 1:
        raise SystemExit("Storyboard class not patched")
elif 'customClass="AnyMinusBridgeViewController"' not in text:
    raise SystemExit("Unexpected storyboard")
story.write_text(text)
plist = root / "Info.plist"
with plist.open("rb") as f: data = plistlib.load(f)
data["NSCameraUsageDescription"] = "Камера нужна для записи видеокараоке."
data["NSMicrophoneUsageDescription"] = "Микрофон нужен для записи голоса."
data["CFBundleDisplayName"] = "AnyMinus"
with plist.open("wb") as f: plistlib.dump(data, f)
PY
