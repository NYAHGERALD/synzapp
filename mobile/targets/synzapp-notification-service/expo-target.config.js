/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  appleTeamId: config.ios.appleTeamId,
  bundleIdentifier: '.notification-service',
  deploymentTarget: '15.1',
  displayName: 'SynzappNotificationService',
  entitlements: {
    'keychain-access-groups': [
      '$(AppIdentifierPrefix)com.synzapp.mobile.shared'
    ]
  },
  frameworks: [
    'CryptoKit',
    'Security',
    'UserNotifications'
  ],
  name: 'SynzappNotificationService',
  type: 'notification-service'
});
