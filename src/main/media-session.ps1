# Sessão de mídia do Windows (a mesma dos controles de volume/mídia) do Spotify.
#   -Action read (padrão): imprime um JSON com título, artista, álbum, estado, posição e
#     duração, ou "null" se não houver sessão do Spotify.
#   -Action play | pause | next | previous | seek: manda o comando e imprime "ok".
#     Sai com erro se o Spotify recusar, para o app tentar outro caminho.
param(
  [ValidateSet('read', 'play', 'pause', 'next', 'previous', 'seek')]
  [string]$Action = 'read',
  [long]$PositionMs = 0
)
$ErrorActionPreference = 'Stop'
# Garante acentos corretos na saida lida pelo Node.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($operation, $resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait(-1) | Out-Null
  $task.Result
}

[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]

$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$manager = Await ($managerType::RequestAsync()) $managerType
$session = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -like '*Spotify*' } | Select-Object -First 1
if (-not $session) { 'null'; exit 0 }

if ($Action -ne 'read') {
  $accepted = switch ($Action) {
    'play'     { Await ($session.TryPlayAsync()) ([bool]) }
    'pause'    { Await ($session.TryPauseAsync()) ([bool]) }
    'next'     { Await ($session.TrySkipNextAsync()) ([bool]) }
    'previous' { Await ($session.TrySkipPreviousAsync()) ([bool]) }
    # A API conta o tempo em "ticks" de 100 ns.
    'seek'     { Await ($session.TryChangePlaybackPositionAsync($PositionMs * 10000)) ([bool]) }
  }
  if (-not $accepted) { throw "Spotify recusou o comando $Action" }
  'ok'
  exit 0
}

$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$props = Await ($session.TryGetMediaPropertiesAsync()) $propsType
$timeline = $session.GetTimelineProperties()

$isPlaying = ($session.GetPlaybackInfo().PlaybackStatus -eq 'Playing')
$durationMs = [int]($timeline.EndTime - $timeline.StartTime).TotalMilliseconds
$positionMs = [int]$timeline.Position.TotalMilliseconds
# A posição é a do último aviso do Spotify; tocando, soma o tempo que passou desde então.
if ($isPlaying) {
  $elapsedMs = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalMilliseconds
  $positionMs = [int][Math]::Min([Math]::Max($positionMs + $elapsedMs, 0), $durationMs)
}

@{
  title      = $props.Title
  artist     = $props.Artist
  album      = $props.AlbumTitle
  isPlaying  = $isPlaying
  positionMs = $positionMs
  durationMs = $durationMs
} | ConvertTo-Json -Compress -Depth 4
