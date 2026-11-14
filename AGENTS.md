# AGENTS.md — Martian Map (NASA Space Apps 2026)

Instruções para qualquer agente de IA (Claude Code, Codex, Copilot, Cursor etc.) e para quem chega no time. Leia inteiro antes de abrir issue, escrever código ou propor mudança de escopo.

---

## 1. Regra nº 1: formato obrigatório de issues

**Toda issue criada neste repositório — por pessoa ou por agente — segue exatamente o modelo abaixo. Sem exceção.** Uma issue fora do modelo deve ser reescrita antes de qualquer trabalho começar.

O corpo da issue tem **somente estas três seções, nesta ordem, com estes títulos**:

```markdown
# User story

Como <quem>, quero <o quê>, para <por quê>.

# Checklist

- [ ] <passo concreto de implementação>
- [ ] <passo concreto de implementação>
- [ ] <passo concreto de implementação>

# Critério de aceite

- <condição observável e verificável que prova que a issue está pronta>
- <condição observável e verificável que prova que a issue está pronta>
```

### O que cada seção pode (e não pode) ter

**# User story**
- Só o texto da história, em uma ou duas frases, no formato "Como …, quero …, para …".
- `<quem>` é uma persona real do produto: *astronauta*, *planejador da EVA*, *juiz do Space Apps*, *membro do time* (para tarefas internas, ex.: pipeline de dados).
- **Proibido:** story points, estimativa de horas, tamanho (P/M/G, T-shirt), prioridade, responsável, sprint, prazo, labels escritas no texto, "Contexto", "Notas", "Descrição técnica" ou qualquer outro campo. Nada além do texto.

**# Checklist**
- Lista de tarefas com `- [ ]`, cada uma pequena o bastante para virar um commit.
- Verbos no infinitivo e concretos: "Criar…", "Configurar…", "Exportar…", "Testar…".
- Cite arquivos do contrato de dados quando a tarefa os produz ou consome (`elevation.bin`, `targets.geojson`, rota GeoJSON…).
- Se depende de outra issue, escreva como item: `- [ ] Aguardar #12 (grid real de Jezero) ou usar mock no formato do contrato`.

**# Critério de aceite**
- Lista de condições **verificáveis por outra pessoa**, sem interpretação: o que se vê na tela, o que um teste comprova, que arquivo existe com que formato.
- Bom: "Clicar em dois pontos no mapa desenha uma linha em menos de 1 s e o painel mostra distância em metros usando raio de Marte (3389,5 km)."
- Ruim: "A rota funciona bem." / "Código limpo."
- Sempre que a issue toca dado da NASA, inclua o critério de proveniência: "A camada/painel mostra missão, instrumento e data do dado."

### Regras gerais de issue
- Título curto, no imperativo, em português: `Calcular declividade do DTM de Jezero`.
- Prioridade (Must/Should/Could) e frente (Mapa 2D, Dados/GIS, Roteamento, 3D, UI, Produto) vão **apenas como labels do GitHub**, nunca no corpo.
- Uma issue = uma entrega demonstrável. Se o checklist passa de ~8 itens, quebre em duas.
- Antes de criar, procure issue parecida (`gh issue list --search "<termo>"`) para não duplicar.
- Agentes: ao criar issue via `gh issue create` ou API, monte o corpo exatamente no modelo e confira as três seções antes de enviar. Não acrescente rodapé, assinatura ou seção extra.

### Exemplo completo

```markdown
# User story

Como astronauta planejando uma EVA em Jezero, quero ver o tempo e o O₂ gastos na rota que desenhei, para decidir se consigo voltar ao habitat com segurança.

# Checklist

- [ ] Implementar modelo de velocidade de caminhada em função da declividade
- [ ] Converter tempo de percurso em consumo de O₂ (kg)
- [ ] Calcular o ponto de não retorno ao longo da rota
- [ ] Incluir `tempo_s`, `o2_kg` e o índice do ponto de não retorno nas propriedades da rota GeoJSON
- [ ] Escrever testes sobre um grid inventado com resultado conhecido

# Critério de aceite

- `route(pontos)` devolve GeoJSON LineString com `dist_m`, `tempo_s` e `o2_kg` preenchidos
- Num grid plano de teste, dobrar a distância dobra o tempo e o O₂ (teste automatizado passando)
- Quando o O₂ necessário para voltar excede o disponível, a saída indica veredito NO-GO e a posição do ponto de não retorno
```

---

## 2. O projeto em uma página

**Desafio:** "Interplanetary Survival Guide: Martian Map" (NASA Space Apps 2026, nível intermediário). Visão em camadas e integrada de um local em Marte, com dados de várias missões da NASA, para um astronauta planejar uma caminhada (Marswalk) e fazer ciência pelo caminho.

**Nossa proposta:** um planejador de Marswalk para a **cratera Jezero**, com mapa 2D em camadas de várias missões, rota segura calculada sobre relevo real e visão 3D opcional.

**Cenário único da demo:** o astronauta sai do ponto A (habitat), visita 3 ou 4 alvos científicos e precisa voltar antes do O₂ acabar. Tudo que construímos serve a essa história de 2 minutos.

O mapa precisa responder três perguntas:
1. **Rota e destinos** — por onde ir, para onde, quanto tempo e quanto esforço.
2. **Condições atuais** — clima, poeira, radiação, sempre com a data/sol do dado.
3. **Ciência pelo caminho** — o que vale a pena estudar na rota.

**Onde ganhamos** (features já são commodity entre os times):
- **Clareza da demo:** um juiz entende sem explicação.
- **Honestidade dos dados:** toda camada diz de qual missão veio e de quando é.
- **Polimento:** pouca coisa, bem feita, nenhuma tela quebrada.

### Calendário (horário local)
| Quando | Marco |
|---|---|
| Sáb 14/11, 9h | Contrato de dados fechado; esqueleto do app com mock |
| Sáb 14/11, 18h | Cada frente entrega sua parte (com mock se preciso) |
| Sáb 14/11, 20h | Integração + go/no-go da visão 3D |
| Dom 15/11, manhã | Trocar mocks por dados reais, polimento, testes |
| **Dom 15/11, 16h** | **Feature freeze: nada novo depois daqui, só correção e acabamento** |
| Dom 15/11, 21h | Submissão (prazo oficial 23:59 — miramos 21h) |

Agentes: considere a data atual. Depois do feature freeze, **recuse** propor ou implementar features novas; só correções, textos, vídeo e submissão.

---

## 3. Escopo do MVP

| Prioridade | Item |
|---|---|
| Must | Mapa 2D com 4+ camadas de 3+ missões, com etiqueta de proveniência |
| Must | Rota A* com custo por declividade, distância, tempo e perfil de elevação |
| Must | Orçamento de O₂ com ponto de não retorno e veredito GO / NO-GO |
| Must | Painel de condições com o último sol disponível (MEDA) |
| Must | Cards dos alvos científicos: por que ir lá e qual missão revelou |
| Must | Rota compartilhável pela URL (`#route=lon,lat;lon,lat`) |
| Should | Sobrevoo 3D da rota no Cesium, com modelo 3D |
| Could | Ordem ótima das paradas (caixeiro viajante por força bruta, ≤ 8 paradas) |
| Could | Modos de rota: mais curta, mais segura, mais ciência |
| Could | Salvar planos no `localStorage` e exportar/importar JSON |

**Must** = sem isso não submete. **Should** = importante, sobrevive sem. **Could** = se sobrar tempo.

**Fora do escopo** (não proponha): backend, banco de dados (SQLite, PostGIS, Supabase…), login, multiusuário, colaboração em tempo real, outras crateras além de Jezero, dados "ao vivo". Se uma feature não aparece no roteiro da demo, provavelmente é Could.

---

## 4. Stack e arquitetura

Tudo estático, **sem backend**. Fluxo de mão única: dados da NASA → pipeline Python (roda uma vez) → arquivos estáticos → navegador.

| Camada | Escolha | Observação |
|---|---|---|
| Frontend | Vite + React + TypeScript | SPA estática. Não migrar para Next.js sem decisão do time |
| Mapa 2D | Leaflet + tiles do NASA Mars Trek | CRS EPSG:4326 |
| Visão 3D | CesiumJS + Cesium Mars (Cesium ion) | Só modo globo 3D; terreno de 20 m em Jezero |
| Rota | A* em TypeScript num Web Worker | Grid ~512×512 (~20 m/célula) |
| Estado | Zustand ou Context do React | Rota atual, alvo selecionado, ponto em destaque no perfil |
| Dados | Python (rasterio + numpy) | Processa uma vez, gera arquivos leves |
| Armazenamento | Arquivos estáticos (GeoJSON, `.bin`, JSON) | Sem banco |
| Deploy | Vercel ou Netlify | Deploy automático desde a primeira hora; a demo fica sempre no ar |

**Não use Three.js** para o 3D (teríamos que construir terreno, LOD e projeção do zero). **Não adicione servidor** — se algo parece exigir um, gere um arquivo estático no pipeline.

### Estrutura alvo do repositório
> Ajuste esta seção quando o esqueleto existir de fato.

```
web/                     # app Vite + React + TS
  src/map/               # Leaflet, camadas, CRS de Marte
  src/routing/           # função de custo, A*, caminhada, O₂, Web Worker
  src/three-d/           # CesiumJS
  src/ui/                # painéis, cards, perfil de elevação
  src/lib/geo.ts         # haversine com raio de Marte, conversões de longitude
  public/data/           # saída do pipeline (elevation.bin, slope.bin, meta.json, targets.geojson, missions.json)
pipeline/                # scripts Python de Dados/GIS
docs/                    # roteiro da demo, fontes e referências
```

---

## 5. Contrato de dados (fonte da verdade entre as frentes)

Cada frente trabalha com **mock exatamente neste formato** até o dado real chegar. Mudar o contrato exige avisar todas as frentes afetadas e atualizar esta seção no mesmo PR.

| Arquivo | Formato | Gera | Consome |
|---|---|---|---|
| `elevation.bin`, `slope.bin` | Grade Float32 little-endian, linha a linha (row-major) | Dados/GIS | Roteamento, 3D |
| `meta.json` | `bbox`, `width`, `height`, metros por célula, convenção de longitude, valor de nodata | Dados/GIS | Roteamento, Mapa 2D |
| `targets.geojson` | FeatureCollection de Points com `nome`, `por_que`, `missao` | Dados/GIS (+ textos de Produto) | Mapa 2D, UI, 3D |
| `missions.json` | Lista: `nome`, `instrumento`, `agencia`, `link` (+ descrição) | Produto/pitch | UI (proveniência) |
| Rota | GeoJSON LineString em lon/lat −180 a 180, propriedades `dist_m`, `tempo_s`, `o2_kg` e perfil de elevação | Roteamento | Mapa 2D, UI, 3D, URL |

Nomes de campo exatos (tipos em `web/src/types/contract.ts`; mocks em `web/public/data/mock/`):

- **Grade (`elevation.bin`, `slope.bin`):** Float32 little-endian, row-major, **linha 0 = norte**.
- **`meta.json`:** `bbox` `[minLon, minLat, maxLon, maxLat]` (−180 a 180), `width`, `height`, `m_per_cell_x`, `m_per_cell_y`, `lon_convention: "-180..180"`, `nodata`, `crs: "EPSG:4326"`, `row0: "north"`, `dtype: "float32le"`, `fonte?`.
- **`missions.json`:** lista de `{ id (ex.: "mro-hirise"), nome, instrumento, agencia, link, descricao? }`.
- **`targets.geojson`:** propriedades `id`, `nome`, `por_que`, `missao` (= `id` de `missions.json`), `mock?`.
- **Rota (Feature LineString):** propriedades `dist_m`, `tempo_s`, `o2_kg`, `perfil` (lista de `[dist_m, elev_m]`, último = `dist_m`), `veredito?` (`"GO"` | `"NO-GO"`), `ponto_nao_retorno?` (índice do vértice), `mock?`.

A rota em GeoJSON é o ponto de encontro de todas as frentes: o mesmo arquivo alimenta 2D, 3D, painéis e URL.

---

## 6. Armadilhas de Marte (leia antes de escrever código geoespacial)

- **Raio de Marte:** `map.distance()` do Leaflet usa o raio da Terra. Use sempre o haversine próprio com **R = 3389,5 km** (`src/lib/geo.ts`). Nunca use utilitário de distância de biblioteca terrestre sem trocar o raio.
- **Longitude:** dados de Marte aparecem em 0–360° ou −180–180°. **No contrato e no app, só −180 a 180.** Converta na borda (pipeline), nunca no meio do app.
- **CRS dos tiles:** o Mars Trek usa EPSG:4326 (lat/lon puro), não o Web Mercator padrão do Leaflet. Configure o CRS do mapa e confira a ordem das linhas de tiles — um erro aqui desloca tudo.
- **Unidades da declividade:** o gradiente precisa usar metros por pixel reais; senão a inclinação sai absurda.
- **Alinhamento:** toda camada raster (THEMIS, CRISM) é reamostrada para o grid do relevo. Valide sobrepondo ao Mars Trek; 500 m de deslocamento faz a rota desviar de crateras que não existem.
- **Nodata:** trate buracos no raster explicitamente (intransponível ou interpolado, nunca zero silencioso).
- **Cesium Mars:** só modo globo 3D (2D e Columbus View não funcionam); o elipsoide padrão precisa ser trocado pelo de Marte.

---

## 7. Regras de dados e honestidade

- **Proveniência sempre visível:** toda camada, painel e card mostra missão, instrumento e data/sol do dado, lido de `missions.json`.
- **Nada de "ao vivo":** escreva "último dado disponível, sol X". Dados do MEDA podem ser um JSON montado à mão com alguns sóis, desde que a fonte seja citada.
- **Todo dado tem fonte citada** em `docs/` (ou README) — dados, bibliotecas, modelos 3D, imagens, inclusive os abertos e gratuitos. Quem não cita pode perder a premiação.
- **Não invente valores científicos** (consumo de O₂, velocidades, limites de declividade) sem marcar como suposição e registrar a referência ou a hipótese usada.
- **Licença:** o repositório é GPL-3.0 (`LICENSE`). Todo conteúdo original é open source. Não adicione dependência ou asset com licença incompatível.

---

## 8. As seis frentes

| Frente | Faz | Entrega até sáb 18h |
|---|---|---|
| Tech lead + Mapa 2D | Leaflet, camadas do Mars Trek, integração de tudo | Mapa com camadas reais, alvos mock clicáveis e rota mock desenhada |
| Dados/GIS | Python: relevo, declividade, camadas, alvos | Grid real de Jezero (`elevation.bin`, `slope.bin`, `meta.json`) + `targets.geojson` (+ `slope.png` se der) |
| Roteamento | Função de custo, A*, tempo, O₂, retorno | `route(pontos) → GeoJSON` testada sobre grid inventado |
| 3D | CesiumJS com Cesium Mars | Jezero em 3D com rota mock desenhada sobre o relevo |
| UI/painéis | Condições, cards, perfil de elevação, layout | Painéis com dados mock e perfil sincronizado com o mapa |
| Produto/pitch | Narrativa, conteúdo científico, vídeo, submissão, referências | Roteiro da demo, textos dos alvos, `missions.json`, lista de fontes |

Princípios:
- **A função de custo é do Roteamento**, não de Dados. Dados entrega camadas cruas; Roteamento decide pesos (ex.: > 25° intransponível, areia custa 2×). Modos de rota = trocar a função, sem refazer arquivo.
- **Integração contínua:** cada frente pluga no app assim que tem algo rodando com mock. Não deixar integração para sábado 20h.
- **3D tem go/no-go às 20h de sábado:** se Jezero em 3D com a rota não estiver de pé, a frente congela e a pessoa ajuda na UI.

---

## 9. Como trabalhar no código

- **Branch principal sempre funcionando e publicada.** Nunca quebre a `main`; trabalhe em branch e abra PR pequeno.
- **Commits e PRs referenciam a issue** (`Closes #N`) e cumprem o critério de aceite dela. O PR descreve como verificar cada critério.
- **TypeScript estrito**; sem `any` em código de contrato de dados (tipos de rota, meta, targets).
- **Roteamento é lógica pura e testável** isoladamente com grid inventado; não acople a React/Leaflet.
- **Cálculo pesado fora da thread principal** (Web Worker). A tela nunca congela.
- **Leaflet e Cesium só no navegador** — não introduza SSR.
- **Não versione dado bruto da NASA** (GeoTIFFs de gigabytes). Versione o script do pipeline e os arquivos leves gerados.
- **Segredos:** o token do Cesium ion vem de variável de ambiente (`VITE_CESIUM_ION_TOKEN`), nunca commitado.
- Textos da interface, issues, commits e docs em **português**; o vídeo e a página de submissão seguem o idioma confirmado com o evento local (na dúvida, inglês).

---

## 10. Glossário mínimo

- **Marswalk / EVA:** caminhada do astronauta fora do habitat.
- **Sol:** dia marciano (~24h39min).
- **Ponto de não retorno:** ponto da rota a partir do qual o O₂ restante não basta para voltar.
- **DTM/DEM:** raster onde cada pixel é altitude. **Declividade (slope):** inclinação por pixel.
- **Grid de custo:** grade onde cada célula diz quanto custa passar; o A* anda por ela.
- **Proveniência:** missão, instrumento e data de cada dado.
- **Mock:** dado falso no formato do contrato, usado até o real ficar pronto.
- **Feature freeze:** a partir dali, só correção e acabamento.

Missões e instrumentos usados: MRO (HiRISE, CTX, CRISM), Mars Odyssey (THEMIS), MGS (MOLA), Mars Express (HRSC), Perseverance (MEDA, traverse e amostras), Curiosity (REMS, RAD). Portais: NASA Mars Trek, PDS, USGS Astrogeology.
