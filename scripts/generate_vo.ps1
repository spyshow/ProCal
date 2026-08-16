Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.Volume = 100
$outputPath = "D:\BackUp\programing_projects\ProCal\public\video_assets\voiceover.wav"
$s.SetOutputToWaveFile($outputPath)
$s.Speak("If you are still calculating building electrical distribution in spreadsheets, you are losing hours on every submission.")
$s.Dispose()
Write-Host "Audio generated at: $outputPath"
