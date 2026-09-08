Pod::Spec.new do |s|
  s.name           = 'SynzappBackgroundTransfers'
  s.version        = '0.1.0'
  s.summary        = 'Synzapp native background media transfer bridge'
  s.description    = 'Native URLSession background transfers for encrypted Synzapp chat media.'
  s.author         = 'Synzapp'
  s.homepage       = 'https://synzapp.com'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :path => '.' }
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
end
