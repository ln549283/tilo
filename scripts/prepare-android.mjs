import fs from 'node:fs';

const buildNumber = Number(process.env.BUILD_NUMBER || 1);
const versionName = process.env.APP_VERSION || '1.0.0';
const admobAppId = process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713';

const gradlePath = 'android/app/build.gradle';
const variablesPath = 'android/variables.gradle';
const manifestPath = 'android/app/src/main/AndroidManifest.xml';

for (const path of [gradlePath, variablesPath, manifestPath]) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing ${path}. Run "npx cap add android" first.`);
  }
}

let variables = fs.readFileSync(variablesPath, 'utf8')
  .replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36')
  .replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36');
fs.writeFileSync(variablesPath, variables);

let gradle = fs.readFileSync(gradlePath, 'utf8')
  .replace(/versionCode\s+\d+/, `versionCode ${buildNumber}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

if (!gradle.includes('CM_KEYSTORE_PATH')) {
  gradle = gradle.replace(
    '    buildTypes {',
    `    signingConfigs {
        release {
            if (System.getenv()["CI"] && System.getenv()["CM_KEYSTORE_PATH"]) {
                storeFile file(System.getenv()["CM_KEYSTORE_PATH"])
                storePassword System.getenv()["CM_KEYSTORE_PASSWORD"]
                keyAlias System.getenv()["CM_KEY_ALIAS"]
                keyPassword System.getenv()["CM_KEY_PASSWORD"]
            }
        }
    }

    buildTypes {`
  );

  gradle = gradle.replace(
    '        release {\n            minifyEnabled',
    '        release {\n            if (System.getenv()["CI"] && System.getenv()["CM_KEYSTORE_PATH"]) {\n                signingConfig signingConfigs.release\n            }\n            minifyEnabled'
  );
}
fs.writeFileSync(gradlePath, gradle);

let manifest = fs.readFileSync(manifestPath, 'utf8');

if (!manifest.includes('com.google.android.gms.ads.APPLICATION_ID')) {
  manifest = manifest.replace(
    '</application>',
    `        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="${admobAppId}" />
    </application>`
  );
} else {
  manifest = manifest.replace(
    /(<meta-data\s+android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s+android:value=")[^"]+("\s*\/>)/m,
    `$1${admobAppId}$2`
  );
}

if (!manifest.includes('android:screenOrientation="portrait"')) {
  manifest = manifest.replace(
    'android:exported="true">',
    'android:exported="true"\n            android:screenOrientation="portrait">'
  );
}

fs.writeFileSync(manifestPath, manifest);

console.log(`Android prepared: API 36, version ${versionName} (${buildNumber}), portrait, AdMob configured.`);
