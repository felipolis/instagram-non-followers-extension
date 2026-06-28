# Instagram — Não Segue de Volta

> Extensão MV3 para Chrome, Brave, Edge e outros navegadores baseados em Chromium
> que compara **quem você segue** no Instagram com **quem te segue de volta** —
> tudo localmente, sem senha e sem servidor.

![Manifest](https://img.shields.io/badge/Manifest-V3-blue)
![Version](https://img.shields.io/badge/version-3.0.0-7c4dff)
![License](https://img.shields.io/badge/license-MIT-22c55e)

_[English summary below.](#english-summary)_

---

## ✨ Recursos

- **Duas análises em abas:**
  - **Não seguem de volta** — perfis que você segue e não te seguem.
  - **Você não segue** — perfis que te seguem e você ainda não segue de volta.
- **Resumo** com totais de seguindo, seguidores, mútuos e não retribuídos.
- **Cartões completos:** foto, nome, selo de verificado e indicador de perfil privado.
- **Lista de ignorados:** marque contas que você quer manter (marcas, famosos…);
  elas somem da lista de não seguidores e ficam salvas entre análises.
- **Busca** por @usuário ou nome dentro dos resultados.
- **Persistência:** a última análise é salva localmente e restaurada ao reabrir,
  com a indicação de "há quanto tempo" foi feita.
- **Barra de progresso** por página carregada e tratamento de _rate limit_.
- **Exportação:** copiar lista, baixar **CSV** ou **JSON**.
- **Bilíngue:** Português (padrão) e Inglês, via `_locales`.

## 🔒 Privacidade

A extensão **não pede senha**, **não usa servidor** e **não tem host permissions**.
Ela usa apenas `activeTab` + `scripting`: o código só roda na aba do Instagram
**quando você clica no ícone**, reaproveitando a sua sessão já autenticada para
chamar a própria API web do Instagram. Os resultados ficam apenas em
`chrome.storage.local`, no seu navegador.

## 📦 Instalação (modo desenvolvedor)

1. Baixe/clone este repositório (ou gere o ZIP com `npm run package`).
2. Abra `chrome://extensions` (ou `brave://extensions`, `edge://extensions`).
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta do projeto.

> A extensão roda direto, sem build. As ferramentas de `npm` abaixo são apenas
> para desenvolvimento e empacotamento.

## 🚀 Como usar

1. Entre no Instagram pelo navegador.
2. Abra **o seu próprio perfil** (a página principal do perfil).
3. Clique no ícone da extensão e em **Analisar agora**.
4. Acompanhe o progresso e navegue pelas abas. Use a busca, ignore contas e
   exporte como quiser.

## 🧱 Estrutura do projeto

```
.
├── manifest.json            # Manifesto MV3 (nome/descrição localizados)
├── _locales/                # Traduções (pt_BR padrão, en)
│   ├── pt_BR/messages.json
│   └── en/messages.json
├── icons/                   # icon.svg (fonte) + PNGs 16/32/48/128
├── src/
│   ├── content.js           # Coleta via API web do Instagram (injetado sob demanda)
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js             # Controlador da UI
│   └── lib/
│       ├── i18n.js          # Wrapper de chrome.i18n
│       ├── format.js        # Formatação de número/tempo por locale
│       └── storage.js       # Acesso a chrome.storage.local
└── scripts/
    └── package.mjs          # Gera dist/*.zip para publicação
```

## 🛠️ Desenvolvimento

```bash
npm install          # instala as ferramentas de desenvolvimento
npm run lint         # ESLint
npm run format       # Prettier (escrita)
npm run check        # format:check + lint
npm run icons        # regenera os PNGs a partir de icons/icon.svg
npm run package      # gera dist/instagram-nao-segue-de-volta-vX.Y.Z.zip
```

## ⚙️ Como funciona

O `content.js` é injetado na aba ativa quando você clica em **Analisar**. Ele:

1. confirma que você está no seu próprio perfil (compara o `ds_user_id` do cookie
   com o ID do perfil aberto);
2. pagina `GET /api/v1/friendships/{id}/following` e `.../followers` (100 por
   página, via `max_id`), com pequenas pausas aleatórias e _backoff_ em caso de
   _rate limit_;
3. compara as listas por ID e calcula não seguidores, fãs e mútuos;
4. envia o progresso/resultado para o popup e salva em `chrome.storage.local`.

## ⚠️ Limitações

- Depende dos endpoints e cabeçalhos atuais do Instagram Web. Se o Instagram
  mudar a API interna ou bloquear as requisições, pode ser necessário ajustar o
  código.
- Contas muito grandes demoram mais e podem sofrer _rate limit_ temporário.
- Este projeto não é afiliado ao Instagram/Meta. Use de acordo com os Termos de
  Uso do Instagram, por sua conta e risco.

## 📄 Licença

[MIT](LICENSE) © Felipe Archanjo. Veja também o [CHANGELOG](CHANGELOG.md).

---

## English summary

Chrome/Chromium **Manifest V3** extension that compares who you follow on
Instagram with who follows you back — **100% locally, no password, no server, no
host permissions** (only `activeTab` + `scripting`). It shows non-followers and
"fans" in separate tabs with avatars, verified/private badges, an ignore list,
search, local persistence, and CSV/JSON export. UI available in Portuguese
(default) and English.

Load it unpacked from `chrome://extensions` (Developer mode → _Load unpacked_),
open your own Instagram profile, and click **Analyze now**. For development:
`npm install`, then `npm run lint` / `npm run package`.
