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

- O app abre como uma **cápsula** compacta, fixa no topo e no centro da tela: capa, título,
  linha de progresso e play/pause.
- **Clique na cápsula** para abrir o painel completo (capa grande, controles, volume,
  curtir, copiar link). O painel pode ser redimensionado pelas bordas e o tamanho é
  lembrado. Para voltar à cápsula, use a seta ^ no canto ou a tecla `Esc`.
- No painel, o **×** fecha o app e o **–** oculta na bandeja. Pelo ícone da bandeja você
  mostra/oculta ou escolhe **Sair** (é o jeito de fechar quando só a cápsula está visível).
- Clique na barra de progresso para pular para aquele ponto.

## Personalizar o visual

Todo o visual está em [`src/renderer/style.css`](src/renderer/style.css). O bloco `:root`
no topo concentra cores, raios, fontes, tamanhos e durações de animação (cada grupo está
comentado). O resto do arquivo só usa essas variáveis. O efeito de vidro (glass) usa as variáveis `--glass-*` e `--backdrop-*`. Há exemplos de
animação no botão play/pause, na troca de capa/texto, no coração de curtir e na troca
entre cápsula e painel.

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
