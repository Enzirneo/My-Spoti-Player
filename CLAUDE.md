# CLAUDE.md

Mini player personalizado do Spotify (Electron + HTML/CSS/JS puro, sem frameworks).
O Spotify oficial toca o áudio; este app é só o controle visual via Web API.

## Leia antes de mexer no código
- `docs/GIT_FLOW.md`: branches, commits e PRs
- `docs/CODE_STYLE.md`: organização e código limpo
- `docs/TESTING.md`: como e o que testar

## Regras inegociáveis
1. Nunca commitar direto em `main` ou `develop`. Sempre usar branch + PR.
2. Commits seguem Conventional Commits (`feat:`, `fix:`, `refactor:`...).
3. Antes de dar uma tarefa como pronta, rodar `npm run lint` e `npm test`. Os dois devem passar.
4. Toda lógica nova que não depende de Electron/DOM precisa de teste.
5. Segredos (tokens, refresh token) nunca vão para o Git. O `config.json` real fica no `.gitignore`; versionar apenas o `config.example.json`.
6. Mudanças pequenas e focadas. Um assunto por commit, um assunto por PR.
7. Sem dependências novas sem justificar no PR. O projeto deve continuar enxuto.
8. Todo o visual fica em `style.css` com variáveis CSS. Não colocar estilo fixo no JS.

## Comandos
- `npm start`: roda o app
- `npm run lint`: ESLint
- `npm run format`: Prettier
- `npm test`: testes
- `npm run test:watch`: testes em modo observação

## Como trabalhar nas tarefas
1. Entender o pedido e, se houver ambiguidade real, perguntar antes de codar.
2. Criar a branch correta (ver `docs/GIT_FLOW.md`).
3. Escrever o teste primeiro quando for lógica (ver `docs/TESTING.md`).
4. Implementar o mínimo que resolve.
5. Rodar lint e testes.
6. Commitar em passos pequenos e abrir o PR com a descrição padrão.
7. Ao final, resumir em poucas linhas: o que mudou, como testar, o que ficou pendente.

## Ambiente
Máquina Windows. O projeto, o cache do npm e quaisquer caches de dev ficam no disco E: (o C: é pequeno).
