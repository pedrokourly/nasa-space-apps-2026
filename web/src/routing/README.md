# Roteamento

## Estrutura

- `core/`: lógica pura (grid, custo, A*, métricas). **Proibido** importar React, Leaflet, DOM ou APIs de Worker; roda no navegador, no Worker e no Node.
- `api.ts`, `client.ts`, `route.worker.ts`, `useRouting.ts`, `RouteController.tsx`: cola com o app (Worker, descarte de pedidos antigos, React). Mantida pelo Mapa 2D; o ponto de plug do `route()` real é `routeImpl` em `route.worker.ts`.
- Distância: sempre `haversine` de `src/lib/mars-geo.ts` (R = 3389,5 km).

## Formato do grid (premissas até o Dados/GIS confirmar)

Base: `Meta` em `src/types/contract.ts` e a seção 5 do `AGENTS.md`.

| Item | Premissa |
|---|---|
| `elevation.bin` | Float32 little-endian, row-major, metros |
| `slope.bin` | Float32 little-endian, row-major, **graus** (premissa) |
| Linha 0 | Borda norte (`meta.row0 = 'north'`) |
| Longitude | −180 a 180 |
| Célula | Amostra de área: o centro de (col, row) fica meia célula para dentro do `bbox` |
| Sem dado | `meta.nodata` ou `NaN`; nunca tratado como zero |
| Areia | Camada opcional `sand` (1 = areia). **Não está no contrato**; depende do Dados/GIS |

Perguntas abertas para o Dados/GIS: ordem dos bytes e nodata confirmados? Declividade em graus? Haverá camada de areia? `bbox` é `[lonMin, latMin, lonMax, latMax]`? Só o loader (dados reais) conhece o formato dos `.bin`; o restante usa `Grid` (`core/grid.ts`).

## Testes

```bash
cd web && npm test
```

## Modelo de custo (S1)

`core/cost.ts` (perfil em `DEFAULT_PROFILE`) e `core/astar.ts`.

| Regra | Valor | Origem |
|---|---|---|
| Declividade >= 25° | intransponível | Plano inicial do time (suposição de projeto) |
| Célula sem dado (elevação ou declividade) | intransponível | Regra do `AGENTS.md`: nodata nunca vira zero |
| Areia | custo × 2 | Plano inicial do time (suposição de projeto) |
| Termo de declividade | fator = 1 + 2 · (slope / 25°)² | **Hipótese nossa**, sem referência científica; calibrar com dados reais |

- Custo do passo = metros do passo × média dos fatores das duas células. Todo fator é >= 1, então a distância reta em metros é uma heurística admissível e o A* é ótimo.
- 8 vizinhos; a diagonal só é permitida se as duas células ortogonais ao lado estão livres (não corta quina de obstáculo).
- `findPathDijkstra` é a referência usada nos testes para conferir o A*.
- Modos de rota (curta, segura) serão outro `CostProfile`, sem mudar arquivos de dados.

## Métricas e `route()` (S2)

`core/walk.ts` e `core/route.ts`. `route(grid, pontos, opções)` devolve o GeoJSON do contrato (`Route`); `createRouter(grid, opções)` devolve `(pontos) => Route`, a forma que o Worker usa (`RouteFn`, S3).

| Item | Valor | Origem |
|---|---|---|
| Velocidade por inclinação | Tobler (1993), normalizada: plano = `speedFlatMS` | Referência publicada; usa o gradiente com sinal entre vértices |
| Velocidade no plano | 1,0 m/s | **Suposição** (astronauta de traje) |
| Consumo de O₂ no plano | 0,1 kg/h | **Suposição** (mesmo valor do mock do Mapa 2D) |
| Acréscimo de O₂ ao subir | × (1 + 4 · gradiente) | **Suposição** |
| O₂ disponível na saída | 1,0 kg (opção `o2_disponivel_kg`) | **Suposição**, ~10 h no plano |
| Gravidade de Marte (0,38 g) | não modelada | Simplificação |

- Os vértices são centros de célula; a distância usa `haversine` (R = 3389,5 km).
- **Veredito:** GO se o O₂ do trajeto, mais o da volta pelo mesmo caminho quando o último ponto não é o primeiro, cabe no disponível. Para circuito (habitat → alvos → habitat) basta o do trajeto.
- **Ponto de não retorno** (`ponto_nao_retorno`, índice do vértice): primeiro vértice em que o O₂ já gasto somado ao da volta pelo mesmo caminho passa do disponível; ausente se isso nunca acontece. O retorno ótimo é do S5.
- Erros: `OutOfGridError` (ponto fora do grid), `NoPathError` (sem caminho), `Error` (menos de 2 pontos).
- O O₂ disponível **não** vai na rota (o contrato não tem o campo). Se a UI precisar mostrar a margem, é mudança de contrato (atualizar a seção 5 do `AGENTS.md` no mesmo PR).

### Rotas de exemplo

`public/data/mock/route-go.geojson` e `route-no-go.geojson`: mesmo trajeto (habitat, 3 alvos mock, habitat) sobre terreno inventado com o bbox do mock, uma com O₂ padrão (GO) e outra com 0,2 kg (NO-GO, com `ponto_nao_retorno`). Marcadas `mock: true`. Regerar: `WRITE_MOCKS=1 npm test -- sampleRoutes`.
