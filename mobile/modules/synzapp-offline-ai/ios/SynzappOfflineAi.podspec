require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'SynzappOfflineAi'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'Synzapp'
  s.homepage       = 'https://synzapp.com'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.prepare_command = 'bash prepare_litertlm_ios.sh'
  s.vendored_frameworks = 'Frameworks/CLiteRTLM.xcframework'
  s.preserve_paths = 'Frameworks/CLiteRTLM.xcframework'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'OTHER_LDFLAGS' => '$(inherited) -all_load'
  }
  s.user_target_xcconfig = {
    'OTHER_LDFLAGS' => '$(inherited) -all_load'
  }

  s.source_files = [
    'SynzappOfflineAiModule.swift',
    'LiteRTLMSource/*.swift'
  ]
end
