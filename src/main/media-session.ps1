# Lê a sessão de mídia do Windows (a mesma dos controles de volume/mídia) do Spotify
# e imprime um JSON com título, artista, álbum, estado, posição e duração.
# Só leitura: não controla nada. Imprime "null" se não houver sessão do Spotify.
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

$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$props = Await ($session.TryGetMediaPropertiesAsync()) $propsType
$timeline = $session.GetTimelineProperties()

@{
  title      = $props.Title
  artist     = $props.Artist
  album      = $props.AlbumTitle
  isPlaying  = ($session.GetPlaybackInfo().PlaybackStatus -eq 'Playing')
  positionMs = [int]$timeline.Position.TotalMilliseconds
  durationMs = [int]($timeline.EndTime - $timeline.StartTime).TotalMilliseconds
} | ConvertTo-Json -Compress -Depth 4
