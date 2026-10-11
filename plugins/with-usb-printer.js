const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withUsbPrinter(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest["uses-permission"] ??= [];
    if (!manifest["uses-permission"].some((permission) => permission.$["android:name"] === "android.permission.USB_PERMISSION")) {
      manifest["uses-permission"].push({ $: { "android:name": "android.permission.USB_PERMISSION" } });
    }
    manifest["uses-feature"] ??= [];
    if (!manifest["uses-feature"].some((feature) => feature.$["android:name"] === "android.hardware.usb.host")) {
      manifest["uses-feature"].push({ $: { "android:name": "android.hardware.usb.host", "android:required": "false" } });
    }
    return mod;
  });
};
