# Testes

## Ferramenta

**Vitest**: simples, rápido, sem configuração pesada.

```bash
npm install -D vitest
```

Scripts no `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

Testes ficam em `tests/` espelhando `src/`. Exemplo: `src/shared/format.js` tem `tests/shared/format.test.js`.

## O que testar (e o que não)

**Testar (prioridade alta):**
- `shared/format.js`: formatação de tempo (`94000 ms` vira `1:34`), casos de borda (0, negativo, horas).
- `shared/state.js`: transformar a resposta da API no estado da UI (nada tocando, podcast, faixa sem álbum, vários artistas).
- `shared/spotify.js`: URL, método e corpo de cada chamada; tratamento de 401, 429 e erro de rede.
- `main/auth.js`: geração do PKCE (`code_verifier`, `code_challenge`), montagem da URL de login, renovação do token.
- `renderer/progress.js`: cálculo da posição da barra a partir do último estado e do tempo decorrido.

**Não testar (custo maior que o ganho):**
- Aparência e animações em CSS.
- Código do Electron em si (criação de janela, bandeja).
- Chamadas reais à API do Spotify. Sempre usar mock.

## Regras

1. **Testes isolados e determinísticos.** Sem rede, sem relógio real, sem arquivos reais. Usar `vi.fn()` para `fetch` e `vi.useFakeTimers()` para tempo.
2. **Nome do teste descreve o comportamento:** `retorna estado vazio quando nada está tocando`, não `test1`.
3. **Padrão Arrange, Act, Assert**, uma ideia por teste.
4. **Um bug corrigido ganha um teste** que falhava antes da correção.
5. **Lógica nova começa pelo teste** quando possível: escrever o teste, ver falhar, implementar, ver passar.
6. Teste nunca depende da ordem de outro teste.

## Exemplo

```js
// tests/shared/format.test.js
import { describe, it, expect } from 'vitest';
import { msToClock } from '../../src/shared/format.js';

describe('msToClock', () => {
  it('formata minutos e segundos', () => {
    expect(msToClock(94000)).toBe('1:34');
  });

  it('completa segundos com zero à esquerda', () => {
    expect(msToClock(61000)).toBe('1:01');
  });

  it('retorna 0:00 para valor negativo ou inválido', () => {
    expect(msToClock(-5)).toBe('0:00');
    expect(msToClock(undefined)).toBe('0:00');
  });
});
```

```js
// tests/shared/spotify.test.js
import { describe, it, expect, vi } from 'vitest';
import { nextTrack } from '../../src/shared/spotify.js';

describe('nextTrack', () => {
  it('chama POST /me/player/next com o token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    await nextTrack({ token: 'abc', fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me/player/next',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer abc' }),
      })
    );
  });
});
```

Para isso funcionar, as funções de `shared/` recebem `fetch` como parâmetro (injeção de dependência), com `globalThis.fetch` como padrão.

## Cobertura

- Meta: **80%+ em `src/shared/` e `src/main/auth.js`**. Não perseguir 100%.
- Cobertura alta com teste ruim não vale nada. Preferir poucos testes que realmente verificam comportamento.

## Quando rodar

- Em `npm run test:watch` enquanto desenvolve.
- Antes de cada commit e de cada PR: `npm run lint && npm test`.
- Opcional: GitHub Actions rodando lint e testes em todo PR para `develop` e `main`.

## Checklist de PR

- [ ] Testes novos para a lógica nova
- [ ] Teste de regressão para o bug corrigido
- [ ] Todos os testes passando localmente
- [ ] Sem `.only` ou `.skip` esquecido
- [ ] Nenhum teste chamando a API real
