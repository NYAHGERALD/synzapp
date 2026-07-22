module.exports = ({ config }) => {
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const iosEntitlements = config.ios?.entitlements ?? {};

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      'expo-sqlite',
      'expo-video',
    ],
    ios: {
      ...config.ios,
      entitlements: {
        ...iosEntitlements,
        'aps-environment': isProductionBuild ? 'production' : 'development',
      },
      googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
    },
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  };
};
