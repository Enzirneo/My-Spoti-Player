# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com
[versionamento semântico](https://semver.org/lang/pt-BR/).

## [0.2.0] - 2026-11-06

### Adicionado

- **macOS:** o app controla o Spotify localmente por AppleScript, sem login, sem Client ID e
  sem Web API (#11). Nesse modo o botão de curtir fica desligado.
- **macOS:** `npm run package:mac` gera o `My Spoti Player.app`, com ícone e texto do pedido de
  permissão de Automação (#10).
- **Windows:** modo híbrido (#12). Estado do player, play, pause, próxima, anterior e seek vêm
  da sessão de mídia do sistema; a Web API só entra para capa, volume, shuffle, repeat e curtir.
  Cerca de 95% menos requisições.
- Freio de requisições (#9): teto de 25 pedidos por 30 s, bloqueio total depois de um 429
  (salvo em disco, sobrevive a reabrir o app) e backoff exponencial em erros de rede.
- Fade curto entre as janelas na troca entre os modos janela e cápsula (#15).

### Alterado

- Polling mais lento: 3 s tocando, 6 s pausado e 10 s ocioso (antes 1,5 s sempre) (#9).
- Num 429 sem `Retry-After` o app espera 30 s, em vez de 1 s (#9).
- README explica o modo macOS e o uso da API no Windows (#11, #12).
- Removida a animação `mode-enter` da troca de modo, que o fade entre as janelas substitui (#15).

### Corrigido

- Piscar e deformação na troca entre janela e cápsula (#15): a janela nova já abre com a música
  e a capa, sem as animações de troca de música, e a antiga deixou de se redesenhar no modo novo.
- O `.app` não leva mais o `config.json` de quem o gerou (#13).

## [0.1.0] - 2026-11-05

### Adicionado

- Mini player do Spotify em Electron: janela, login OAuth (PKCE), controles e polling (#1).
- Fechar o app no × e launcher sem terminal para Windows (#2).
- Leitura da música carregada no Spotify, retomada da sessão e correção do curtir (#3).
- Visual de vidro com cápsula compacta e painel expandido (#4).
- Launcher, leitura do Spotify e novo visual: tag, ondas, tema pela capa e ícone (#5).
- README descritivo com capturas e guia de uso (#7, #8).

[0.2.0]: https://github.com/Enzirneo/My-Spoti-Player/releases/tag/v0.2.0
[0.1.0]: https://github.com/Enzirneo/My-Spoti-Player/releases/tag/v0.1.0
