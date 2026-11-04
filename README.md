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

Na primeira vez, clique em **Entrar com Spotify**: o navegador abre, você autoriza e o
app guarda o refresh token localmente (pasta de dados do usuário do Electron). Nas
próximas execuções o login é automático.

Mantenha o Spotify aberto (e tocando algo ao menos uma vez) para existir um dispositivo
ativo.

## Uso

- Arraste a janela em qualquer área livre; redimensione pelas bordas.
- O **×** oculta o app na bandeja. Clique no ícone da bandeja para mostrar/ocultar, ou
  use o menu dele para **Sair**.
- A posição e o tamanho da janela são lembrados.
- Clique na barra de progresso para pular para aquele ponto.

## Personalizar o visual

Todo o visual está em [`src/renderer/style.css`](src/renderer/style.css). O bloco `:root`
no topo concentra cores, raios, fontes, tamanhos e durações de animação (cada grupo está
comentado). O resto do arquivo só usa essas variáveis. Há exemplos de animação no botão
play/pause, na troca de capa/texto e no coração de curtir.

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
