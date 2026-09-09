// @capacitor/assets always insets BOTH the background and the foreground of
// the generated Android adaptive icon by 16.7%, even though only the
// foreground is supposed to have that safe-zone margin (see
// ionic-team/capacitor-assets AndroidAssetGenerator, which hardcodes the same
// <inset> template for both layers regardless of source). Left as-is, the
// background layer leaves a transparent ring around the icon on any launcher
// mask that doesn't crop that far in, so the icon renders with a visible
// blank/broken border. This script runs after `capacitor-assets generate` and
// rewrites the generated XML so the background fills edge-to-edge like a
// normal Android adaptive icon, while the foreground keeps its inset.
'use strict';
const fs = require('fs');
const path = require('path');

const RES_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const FILES = ['mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml'];

const FIXED_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.7%" />
    </foreground>
</adaptive-icon>
`;

let fixed = 0;
for (const relativePath of FILES) {
  const filePath = path.join(RES_DIR, relativePath);
  if (!fs.existsSync(filePath)) continue;
  fs.writeFileSync(filePath, FIXED_XML);
  fixed += 1;
}

if (fixed > 0) {
  console.log(`fix-adaptive-icon: removed the incorrect background inset from ${fixed} file(s)`);
} else {
  console.warn('fix-adaptive-icon: no adaptive icon XML found under android/app/src/main/res/mipmap-anydpi-v26 — did `capacitor-assets generate --android` run first?');
}
