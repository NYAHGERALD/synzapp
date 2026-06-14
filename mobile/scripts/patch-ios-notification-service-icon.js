const fs = require('fs');
const path = require('path');
const { XcodeProject } = require('@bacons/xcode');
const xcodeParse = require('@bacons/xcode/json');

const projectRoot = path.resolve(__dirname, '..');
const projectFile = path.join(projectRoot, 'ios', 'Synzapp.xcodeproj', 'project.pbxproj');
const extensionBundleIdentifier = 'com.synzapp.mobile.notification-service';
const extensionProductName = 'SynzappNotificationService';
const appIconName = 'AppIcon';

if (!fs.existsSync(projectFile)) {
  if (process.env.EAS_BUILD_PLATFORM === 'ios') {
    console.error(`Synzapp iOS notification icon patch failed: missing ${path.relative(projectRoot, projectFile)}.`);
    process.exit(1);
  }

  console.log('Synzapp iOS notification icon patch skipped: native iOS project was not generated.');
  process.exit(0);
}

const project = XcodeProject.open(projectFile);
const targets = project.rootObject.props.targets.filter((target) => {
  if (!target.props || target.props.productName !== extensionProductName) {
    return false;
  }

  return target.getDefaultBuildSetting('PRODUCT_BUNDLE_IDENTIFIER') === extensionBundleIdentifier;
});

if (targets.length !== 1) {
  console.error(
    `Synzapp iOS notification icon patch failed: expected 1 ${extensionBundleIdentifier} target, found ${targets.length}.`
  );
  process.exit(1);
}

const [notificationServiceTarget] = targets;
notificationServiceTarget.setBuildSetting('ASSETCATALOG_COMPILER_APPICON_NAME', appIconName);

fs.writeFileSync(projectFile, xcodeParse.build(project.toJSON()));
console.log(`Synzapp iOS notification service icon patched to use ${appIconName}.`);
