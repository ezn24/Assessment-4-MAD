$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$portableJdk = Join-Path (Split-Path $repoRoot -Parent) ".tools\jdk-17"

function Get-JavaMajor($javaExe) {
  $versionOutput = & $javaExe -version 2>&1
  $line = ($versionOutput | Select-Object -First 1).ToString()
  if ($line -match '"(\d+)') {
    return [int]$Matches[1]
  }
  return 0
}

if (Test-Path (Join-Path $portableJdk "bin\java.exe")) {
  $env:JAVA_HOME = $portableJdk
} elseif ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  $major = Get-JavaMajor (Join-Path $env:JAVA_HOME "bin\java.exe")
  if ($major -lt 17) {
    throw "JAVA_HOME must point to JDK 17 or newer. Current JAVA_HOME is $env:JAVA_HOME (Java $major)."
  }
} else {
  $javaCmd = Get-Command java -ErrorAction SilentlyContinue
  if (!$javaCmd -or (Get-JavaMajor $javaCmd.Source) -lt 17) {
    throw "JDK 17 or newer is required for local Android builds. Install JDK 17+ or place it at $portableJdk."
  }
  $env:JAVA_HOME = (Split-Path (Split-Path $javaCmd.Source))
}

$env:PATH = "$(Join-Path $env:JAVA_HOME "bin");$env:PATH"
$env:NODE_ENV = "production"

Push-Location (Join-Path $repoRoot "android")
try {
  .\gradlew.bat assembleRelease
} finally {
  Pop-Location
}
