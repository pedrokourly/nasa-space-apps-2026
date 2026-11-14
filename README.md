# Martian Map · Jezero

Desenvolvimento e submissão do desafio "Interplanetary Survival Guide: Martian Map" (NASA Space Apps 2026).

Planejador de Marswalk para a cratera Jezero: mapa 2D em camadas de várias missões da NASA, rota segura sobre relevo real e visão 3D opcional. App 100% estático, sem backend.

**Demo:** a definir.

## Como rodar

```bash
cd web
npm install
npm run dev
```

Requer Node 20+ (testado com Node 24).

## Scripts (em `web/`)

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento do Vite |
| `npm run build` | Checagem de tipos (`tsc -b`) e build de produção em `web/dist` |
| `npm run lint` | Lint com oxlint |
| `npm run format` | Formata o código com Prettier |
| `npm test` | Testes com Vitest (`src/**/*.test.ts`) |
| `npm run preview` | Serve o build de produção localmente |

## Estrutura

```
web/                 # app Vite + React + TypeScript
  src/map/           # Leaflet, camadas, CRS de Marte
  src/routing/       # custo, A*, caminhada, O₂
  src/ui/            # painéis, cards, perfil de elevação
  src/state/         # estado global (Zustand)
  src/lib/           # utilitários (geo etc.)
  src/types/         # tipos do contrato de dados
  public/data/       # saída do pipeline (arquivos estáticos)
```

## Frentes

| Frente | Faz |
|---|---|
| Tech lead + Mapa 2D | Leaflet, camadas do Mars Trek, integração de tudo |
| Dados/GIS | Python: relevo, declividade, camadas, alvos |
| Roteamento | Função de custo, A*, tempo, O₂, retorno |
| 3D | CesiumJS com Cesium Mars |
| UI/painéis | Condições, cards, perfil de elevação, layout |
| Produto/pitch | Narrativa, conteúdo científico, vídeo, submissão, referências |

## Deploy e regra da `main`

Deploy runs on Cloudflare Pages, connected to `main` (preview per branch): root directory `web`, build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=22`.

**A `main` está sempre deployável:** nunca quebre a `main`; trabalhe em branch e abra PR pequeno. Veja as regras completas em [`AGENTS.md`](AGENTS.md).

## Licença

GPL-3.0 (veja `LICENSE`).
