# Organização e código limpo

## Estrutura do projeto

```
src/
  main/
    main.js          # cria a janela, bandeja, IPC (só orquestra)
    auth.js          # OAuth PKCE, servidor de callback, refresh de token
    store.js         # salvar/ler posição da janela e tokens
  preload/
    preload.js       # contextBridge: expõe só o necessário ao renderer
  renderer/
    index.html
    style.css        # TODO o visual, via variáveis CSS
    renderer.js      # liga eventos da UI às ações
    ui.js            # funções que atualizam o DOM
    progress.js      # animação local da barra de progresso
  shared/
    spotify.js       # chamadas à Web API (sem Electron, sem DOM)
    format.js        # formatação de tempo, textos
    state.js         # normaliza a resposta da API para o estado da UI
tests/
docs/
config.example.json
```

Princípio: **separar o que depende de Electron/DOM do que é lógica pura.** Lógica pura (`shared/`) é fácil de testar e de reaproveitar.

## Regras de organização

- Um arquivo, uma responsabilidade. Se o arquivo passa de ~200 linhas, avaliar dividir.
- `main.js` não tem regra de negócio. Só cria janela e conecta módulos.
- Renderer nunca usa `require` nem Node direto: só fala com o main via `window.api` (definido no `preload.js`).
- `contextIsolation: true` e `nodeIntegration: false`. Sem exceção.
- Dependências apontam numa direção: `renderer` e `main` usam `shared`. `shared` não importa de nenhum dos dois.

## Código limpo

**Nomes**
- Nomes revelam intenção: `isTrackLiked`, `secondsToClock`, `refreshAccessToken`.
- Booleanos começam com `is`, `has`, `should`.
- Funções são verbos (`fetchPlayback`), dados são substantivos (`playbackState`).
- Código em inglês. Comentários e docs em português.
- Proibido: `data`, `temp`, `x`, `obj`, `handle2`, `doStuff`.

**Funções**
- Fazem uma coisa só e cabem numa tela (~20 linhas é um bom alvo).
- No máximo 3 parâmetros. Mais que isso, receber um objeto.
- Retorno antecipado (early return) em vez de `if` aninhado em vários níveis.
- Sem efeitos colaterais escondidos: se a função altera algo fora dela, o nome deve dizer isso.

**Constantes**
- Sem números e textos mágicos espalhados. Ex.: `POLL_INTERVAL_MS = 1500`, `SPOTIFY_API_BASE`, em um único lugar.

**Comentários**
- Comentar o **porquê**, não o **quê**. Se precisa explicar o que o código faz, melhor renomear ou quebrar a função.
- Sem código comentado. O Git guarda o histórico.
- `TODO` só com contexto: `// TODO: tratar 401 após o refresh falhar`.

**JavaScript**
- `const` por padrão, `let` quando precisa reatribuir, nunca `var`.
- `async/await` em vez de cadeias de `.then`.
- Todo `await` de rede dentro de `try/catch` com tratamento real (mensagem útil, estado de erro na UI), nunca `catch {}` vazio.
- Sem variáveis globais soltas. Estado em módulo, exportado por funções.
- Comparar com `===`.

**CSS**
- Cores, raios, fontes, espaçamentos e durações de animação como variáveis em `:root`.
- Classes por função (`.player__cover`, `.controls__btn--active`), seguindo BEM simples.
- Animações com `transform` e `opacity` (rodam na GPU e não travam). Evitar animar `width`, `height`, `top`, `left`.
- Respeitar `prefers-reduced-motion` desativando animações pesadas.

**Erros e estados**
- Toda tela tem estado de: carregando, vazio (nada tocando), erro e sucesso.
- Nunca deixar a UI "congelada": se a API falhar, mostrar o último estado conhecido e uma indicação discreta de erro.
- Tratar 401 (renovar token), 429 (respeitar `Retry-After`) e queda de rede.

## Ferramentas obrigatórias

- **ESLint** (`eslint:recommended`) para erros e más práticas.
- **Prettier** para formatação automática. Ninguém discute estilo, a ferramenta decide.
- Scripts no `package.json`: `lint`, `format`, `test`.
- Opcional: Husky + lint-staged para rodar lint e format no commit.

## Segurança

- Tokens guardados fora do repositório (pasta de dados do usuário do Electron).
- Nunca logar token, nem em `console.log` de depuração.
- Validar o `state` no callback do OAuth.
- CSP no `index.html`, sem carregar scripts remotos.

## Checklist antes do commit

- [ ] Nomes claros, sem `console.log` de sobra
- [ ] Nenhuma função fazendo mais de uma coisa
- [ ] Sem número ou texto mágico
- [ ] Erros tratados, sem `catch` vazio
- [ ] Sem código comentado
- [ ] `npm run lint` e `npm run format` limpos
