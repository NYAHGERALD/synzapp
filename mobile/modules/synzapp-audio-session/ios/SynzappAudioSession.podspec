Pod::Spec.new do |s|
  s.name           = 'SynzappAudioSession'
  s.version        = '0.1.0'
  s.summary        = 'Synzapp native audio session helpers'
  s.description    = 'Native audio session route helpers for Synzapp live interpreter audio.'
  s.author         = 'Synzapp'
  s.homepage       = 'https://synzapp.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
