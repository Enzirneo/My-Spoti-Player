# Git Flow

Versão enxuta do Git Flow, adequada a um projeto pessoal pequeno.

## Branches

| Branch | Função | Regra |
|---|---|---|
| `main` | Versão estável, pronta para uso | Só recebe merge de `develop` (release) ou `hotfix/*` |
| `develop` | Integração do trabalho em andamento | Só recebe merge de `feature/*`, `fix/*` e `refactor/*` |
| `feature/<nome>` | Funcionalidade nova | Sai de `develop`, volta para `develop` |
| `fix/<nome>` | Correção de bug | Sai de `develop`, volta para `develop` |
| `refactor/<nome>` | Reorganização sem mudar comportamento | Sai de `develop`, volta para `develop` |
| `hotfix/<nome>` | Bug urgente em `main` | Sai de `main`, volta para `main` **e** `develop` |
| `release/<versão>` | Preparação de versão (opcional) | Sai de `develop`, volta para `main` e `develop` |

Nomes de branch: minúsculas, hífen, curtos e descritivos.
Exemplos: `feature/volume-slider`, `fix/token-refresh`, `refactor/split-spotify-api`.

## Fluxo de uma tarefa

```bash
git checkout develop
git pull
git checkout -b feature/volume-slider

# trabalhar em commits pequenos
git add -p
git commit -m "feat(player): adiciona slider de volume"

git push -u origin feature/volume-slider
# abrir PR para develop
```

Antes de abrir o PR:
1. `npm run lint` e `npm test` passando.
2. Atualizar com `develop` (`git rebase develop`) e resolver conflitos.
3. Revisar o próprio diff (`git diff develop`) procurando sobras: `console.log`, código comentado, arquivos soltos.

## Commits: Conventional Commits

Formato: `tipo(escopo): descrição no imperativo, em minúsculas, sem ponto final`

| Tipo | Quando usar |
|---|---|
| `feat` | Funcionalidade nova |
| `fix` | Correção de bug |
| `refactor` | Mudança interna sem alterar comportamento |
| `style` | Só formatação (espaços, ponto e vírgula) |
| `test` | Criar ou ajustar testes |
| `docs` | Documentação |
| `chore` | Config, dependências, scripts |
| `perf` | Melhoria de desempenho |

Exemplos bons:
- `feat(auth): renova access token automaticamente`
- `fix(progress): corrige salto da barra ao trocar de música`
- `test(spotify): cobre erro 429 com retry`

Exemplos ruins: `ajustes`, `fix`, `mudanças no player`, `wip`.

Regras:
- Um assunto por commit. Se a mensagem precisa de "e", provavelmente são dois commits.
- Título com até 72 caracteres. Detalhes, se precisar, no corpo.
- Nunca commitar código quebrado (lint ou testes falhando).

## Pull Requests

Mesmo trabalhando sozinho, usar PR: dá histórico e um ponto de revisão.

Template da descrição:

```
## O que mudou
(1 a 3 linhas)

## Por quê
(problema que resolve)

## Como testar
(passos objetivos)

## Checklist
- [ ] lint passando
- [ ] testes passando
- [ ] testes novos para lógica nova
- [ ] sem segredos no diff
```

Merge: usar **squash merge** em `feature/*`, `fix/*` e `refactor/*` para manter o `develop` legível. Apagar a branch depois do merge.

## Versionamento e releases

- Versão semântica: `MAJOR.MINOR.PATCH` (`1.2.0`).
- Release: merge de `develop` em `main`, criar a tag `v1.2.0`.
- Manter um `CHANGELOG.md` com o que entrou em cada versão.

## O que nunca vai para o Git

- `config.json` real, tokens, refresh token, `.env`
- `node_modules/`, `dist/`, `out/`
- Arquivos do sistema (`Thumbs.db`) e de editor (`.vscode/` pessoal)

Conferir o `.gitignore` antes do primeiro commit.
