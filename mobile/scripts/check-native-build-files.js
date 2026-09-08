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

/**
 * Image assets whose extension does not match their actual contents.
 *
 * iOS sniffs image data and renders these regardless, so a mislabelled file can
 * sit in the repo indefinitely without anyone noticing. Android's resource
 * compiler trusts the extension and fails the whole build with only
 * "file failed to compile" to go on — three WebP files named .png cost a full
 * release build to diagnose, which is why this check exists.
 */
const IMAGE_SIGNATURES = [
  { format: 'png', test: (head) => head.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { format: 'jpeg', test: (head) => head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff },
  { format: 'webp', test: (head) => head.slice(0, 4).toString() === 'RIFF' && head.slice(8, 12).toString() === 'WEBP' },
  { format: 'gif', test: (head) => head.slice(0, 4).toString() === 'GIF8' }
];

function readImageFormat(filePath) {
  const handle = fs.openSync(filePath, 'r');
  const head = Buffer.alloc(16);

  try {
    fs.readSync(handle, head, 0, 16, 0);
  } finally {
    fs.closeSync(handle);
  }

  return IMAGE_SIGNATURES.find((signature) => signature.test(head))?.format || 'unknown';
}

function collectMislabelledImages(directory, found = []) {
  if (!fs.existsSync(directory)) {
    return found;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collectMislabelledImages(entryPath, found);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase().replace('.', '');

    if (!['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
      continue;
    }

    const expected = extension === 'jpg' ? 'jpeg' : extension;
    const actual = readImageFormat(entryPath);

    if (actual !== expected) {
      found.push({ actual, extension, file: path.relative(path.join(__dirname, '..'), entryPath) });
    }
  }

  return found;
}

const mislabelledImages = collectMislabelledImages(path.join(__dirname, '..', 'assets'));

if (mislabelledImages.length > 0) {
  console.error('\nSynzapp native build preflight failed.\n');
  console.error('These image assets do not contain the format their file extension claims.');
  console.error("Android's resource compiler rejects them, and the build error does not name the cause:\n");

  for (const item of mislabelledImages) {
    console.error(`- ${item.file} (.${item.extension} but actually ${item.actual})`);
  }

  console.error('\nConvert each file to match its extension, for example:');
  console.error('  sips -s format png <file> --out <file>\n');
  process.exit(1);
}

console.log('Synzapp native build preflight passed.');
