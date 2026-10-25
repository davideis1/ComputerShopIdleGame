Pod::Spec.new do |s|
  s.name           = 'MBGameCenter'
  s.version        = '1.0.0'
  s.summary        = 'Game Center sign-in and achievements for Mega Byte Computers'
  s.description    = 'Local Expo module: GameKit sign-in, achievement progress reports and the achievements dashboard.'
  s.license        = 'UNLICENSED'
  s.author         = 'davideis1'
  s.homepage       = 'https://computershopidlegame.davideis.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'GameKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
