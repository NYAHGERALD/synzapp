const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Keeps company chat media out of Android's automatic backup.
 *
 * Chat media lives in filesDir, because expo-file-system refuses to write
 * outside the directories it scopes and a copy into no_backup fails outright.
 * Backup exclusion is therefore declared here rather than being a property of
 * where the files sit.
 *
 * The exclusion is the `<include>` list, not an `<exclude>` entry. Android backs
 * up only what is included, so listing sharedpref alone leaves every file under
 * files/ — all chat media — out of both cloud backup and device transfer. An
 * explicit `<exclude domain="file" path="SynzappMedia"/>` is not stronger; it is
 * invalid, and `lintVitalRelease` fails the build with "SynzappMedia is not in
 * an included path", because nothing in the file domain was included to exclude.
 *
 * These files override the ones expo-secure-store contributes. The rules are the
 * same, but owning the file is the point: the guarantee that company media never
 * reaches an employee's personal Google account should not rest on a third-party
 * library continuing to scope its backup to shared preferences.
 */
const BACKUP_RULES = `<?xml version="1.0" encoding="utf-8"?>

<!-- Auto Backup configuration for Android 11 and lower. -->
<full-backup-content>
  <include domain="sharedpref" path="."/>
  <exclude domain="sharedpref" path="SecureStore"/>
</full-backup-content>
`;

const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>

<!-- Auto Backup configuration for Android 12 and higher. -->
<data-extraction-rules>
  <cloud-backup>
    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore"/>
  </cloud-backup>
  <device-transfer>
    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore"/>
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withSynzappAndroidMediaBackupRules(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const xmlDirectory = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );

      fs.mkdirSync(xmlDirectory, { recursive: true });
      // Same file names as expo-secure-store's, so the app module's copies win
      // the resource merge and the manifest reference keeps resolving.
      fs.writeFileSync(path.join(xmlDirectory, 'secure_store_backup_rules.xml'), BACKUP_RULES);
      fs.writeFileSync(
        path.join(xmlDirectory, 'secure_store_data_extraction_rules.xml'),
        DATA_EXTRACTION_RULES
      );

      return modConfig;
    }
  ]);
};
