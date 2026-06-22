Pod::Spec.new do |s|
  s.name           = 'SynzappVoipCalls'
  s.version        = '0.1.0'
  s.summary        = 'Synzapp iOS VoIP PushKit and CallKit bridge'
  s.description    = 'Native bridge for secure Synzapp incoming call delivery on iOS.'
  s.author         = 'Synzapp'
  s.homepage       = 'https://synzapp.com'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :path => '.' }
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
end
