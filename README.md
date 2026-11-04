# My Spoti Player

Mini player personalizado do Spotify (Electron + HTML/CSS/JS puro). O app oficial do
Spotify continua tocando o áudio; este app é só o controle visual, via Web API.

> Controlar a reprodução pela Web API exige uma conta **Spotify Premium**.

## 1. Criar o app no Spotify e pegar o Client ID

1. Acesse o [Developer Dashboard](https://developer.spotify.com/dashboard) e crie um app.
2. Em **Redirect URIs**, adicione exatamente: `http://127.0.0.1:8888/callback`
3. Copie o **Client ID** do app.

## 2. Configurar

Copie o arquivo de exemplo e preencha o `clientId`:

```bash
cp config.example.json config.json
```

```json
{ "clientId": "seu_client_id_aqui" }
```

O `config.json` está no `.gitignore` e nunca vai para o Git.

## 3. Rodar

```bash
npm install
npm start
```

Depois de instalado, não precisa do terminal: dê dois cliques em `iniciar.vbs` (ou crie
um atalho para ele na área de trabalho / menu Iniciar).

Na primeira vez, clique em **Entrar com Spotify**: o navegador abre, você autoriza e o
app guarda o refresh token localmente (pasta de dados do usuário do Electron). Nas
próximas execuções o login é automático.

Mantenha o Spotify aberto (e tocando algo ao menos uma vez) para existir um dispositivo
ativo.

## Uso

- O app abre como uma **janelinha** com um cartão grande da capa (título e artista por cima),
  barra de progresso em **onda**, e botões redondos de anterior, play/pause e próxima. As
  cores do fundo e da onda **mudam sozinhas** conforme a capa da música.
- Arraste por qualquer área livre; redimensione pelas bordas. Posição e tamanho são lembrados.
- Passe o mouse sobre a janela para ver os botões do topo (modo mini, volume, copiar link,
  ocultar, fechar).
- O botão de **modo mini** transforma a janela numa **tag** em pílula (capa redonda, título,
  anterior/play/próxima e a onda de progresso na borda). Ela começa no topo e no centro da
  tela, mas pode ser arrastada para qualquer lugar (a posição também é lembrada). Um **clique**
  em qualquer área livre da tag volta para a janela.
- O **×** fecha o app e a **seta para baixo** oculta na bandeja. Pelo ícone da bandeja você mostra/oculta
  ou escolhe **Sair** (útil quando só a tag está visível).
- Clique na barra de progresso para pular para aquele ponto.

## Personalizar o visual

Todo o visual está em [`src/renderer/style.css`](src/renderer/style.css). O bloco `:root`
no topo concentra cores, raios, fontes, tamanhos e durações de animação (cada grupo está
comentado). O resto do arquivo só usa essas variáveis.

- **Cores:** `--theme-bg` e `--theme-accent` são trocadas pelo app a cada música (a partir da
  capa); o que não vem da capa fica em `--color-*`.
- **Onda de progresso:** são três camadas que sobem de uma linha reta e correm em
  velocidades diferentes. Mexa em `--wave-amp*` (altura), `--wave-tile-*` (largura das
  ondinhas), `--wave-speed-*` (velocidade) e `--wave-shape-*` (formato).
- **Animações de exemplo:** play/pause, troca de capa/texto, coração e troca entre janela e tag.

## Estrutura

```
src/main/       janela, bandeja, OAuth (PKCE), IPC
src/preload/    ponte segura (contextBridge) exposta como window.api
src/renderer/   index.html, style.css, renderer.js, ui.js, progress.js
src/shared/     Web API, estado da UI, formatação (sem Electron/DOM)
tests/          testes (Vitest)
docs/           guias do projeto (Git flow, estilo de código, testes)
```

## Comandos

| Comando              | O que faz       |
| -------------------- | --------------- |
| `npm start`          | Roda o app      |
| `npm run lint`       | ESLint          |
| `npm run format`     | Prettier        |
| `npm test`           | Testes          |
| `npm run test:watch` | Testes em watch |
