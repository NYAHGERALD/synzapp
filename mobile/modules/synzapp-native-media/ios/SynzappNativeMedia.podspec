Pod::Spec.new do |s|
  s.name           = 'SynzappNativeMedia'
  s.version        = '0.1.0'
  s.summary        = 'Synzapp native media asset intake bridge'
  s.description    = 'Native Photos and media picker bridge for Synzapp chat media.'
  s.author         = 'Synzapp'
  s.homepage       = 'https://synzapp.com'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.0' }
  s.source         = { :path => '.' }
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
end
