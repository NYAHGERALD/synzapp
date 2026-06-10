const fs = require('fs');
const path = require('path');

const requiredFiles = [
  {
    file: 'google-services.json',
    platform: 'Android',
    appId: 'com.synzapp.mobile',
  },
  {
    file: 'GoogleService-Info.plist',
    platform: 'iOS',
    appId: 'com.synzapp.mobile',
  },
];

const missingFiles = requiredFiles.filter(({ file }) => !fs.existsSync(path.join(__dirname, '..', file)));

if (missingFiles.length > 0) {
  console.error('\nSynzapp native build preflight failed.\n');
  console.error('React Native Firebase needs the native Firebase app config files before EAS can read the Expo config.');
  console.error('Add these files to SYNZAPP/mobile:\n');

  for (const item of missingFiles) {
    console.error(`- ${item.file} (${item.platform} app: ${item.appId})`);
  }

  console.error('\nFirebase Console path: Project settings > General > Your apps');
  console.error('After adding the files, run the build command again.\n');
  process.exit(1);
}

console.log('Synzapp native build preflight passed.');
