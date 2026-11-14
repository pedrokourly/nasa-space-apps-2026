# Spike #2: tiles do Mars Trek no Leaflet (EPSG:4326)

Data do levantamento: 14/11/2026. Fonte: `WMTSCapabilities.xml` de cada produto em `https://trek.nasa.gov/tiles/Mars/EQ/<ID>/1.0.0/WMTSCapabilities.xml` e a API de catálogo do Trek (`https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems`). Página de prova: [`mars-trek-leaflet.html`](./mars-trek-leaflet.html) (abre direto por `file://`).

## Resultado

Funciona. Todas as camadas abaixo carregam no Leaflet 1.9.4 com `crs: L.CRS.EPSG4326`, **sem `zoomOffset` e sem `tms: true`**, usando `{z}/{y}/{x}`. Exceção: o CTX global (servido pela Esri) usa tiles de 512 px (ver abaixo).

Por quê encaixa: no Leaflet 1.9 o mundo em EPSG:4326 no zoom 0 tem 512 x 256 px (2 tiles de 256 de largura x 1 de altura), origem em lon −180 / lat 90 e `y` crescendo para o sul. É exatamente o `TileMatrixSet` `default028mm` do Trek: zoom 0 com `MatrixWidth=2`, `MatrixHeight=1`, `TopLeftCorner=-180 90`, tile 256x256. Logo `{y}` = `TileRow` (linha contada do norte) e `{x}` = `TileCol`.

## Camadas

Todas as coordenadas de cobertura vêm em **−180 a 180** (não 0–360), em lon/lat planetocêntrico/EQ (CRS `urn:ogc:def:crs:EPSG::104905`, "Mars 2000 sphere"). Raio de Marte, longitude e CRS seguem as "Armadilhas de Marte" do `AGENTS.md`.

| Camada | ID Trek | Missão / instrumento | Formato | Zoom (WMTS = Leaflet) | Cobertura (lon_min, lat_min, lon_max, lat_max) | Tile |
|---|---|---|---|---|---|---|
| MOLA color hillshade global | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | MGS / MOLA | jpg | 0–7 | −180, −89.9992, 179.9983, 90 | 256 |
| Viking MDIM 2.1 colorido (fallback) | `Mars_Viking_MDIM21_ClrMosaic_global_232m` | Viking / MDIM 2.1 | jpg | 0–7 | −180, −90, 180, 90 | 256 |
| THEMIS IR dia global | `THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018` | Mars Odyssey / THEMIS | png | 0–9 | −180, −65.0007, 179.9999, 65.0008 (só ±65° de latitude) | 256 |
| CTX global (MRO) | `CTX_beta01_uncontrolled_5m_Caltech` | MRO / CTX (mosaico beta01 Caltech, sem controle) | png | 0–11 (WMTS); no Leaflet com `tileSize:512` e `zoomOffset:-1` vira 1–12 | −180, −90, 180, 90 | **512** |
| CTX Jezero controlado, 6 m | `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` | MRO / CTX | png (RGBA) | 0–13 | 77.1605, 18.2110, 77.6992, 18.7212 | 256 |
| CTX Jezero preliminar (BlockAdj) | `Jezero_CTX_BlockAdj_dd` | MRO / CTX | png (RGBA) | 0–12 | 75.1538, 15.9058, 78.8717, 19.4453 | 256 |
| HiRISE Jezero ortho 25 cm | `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` | MRO / HiRISE | png (RGBA) | 0–17 | 77.2229, 18.3068, 77.5840, 18.6693 | 256 |

Observações sobre os zooms: o `WMTSCapabilities.xml` lista as `TileMatrix` até o zoom máximo, mas **não traz `TileMatrixLimits`**; o zoom máximo acima é o último `TileMatrix` listado e o zoom 14 do CTX Jezero (além do 13) devolve 404. Resolução aproximada no equador pelo raio de 3389,5 km: z7 ≈ 325 m/px, z9 ≈ 81 m/px, z13 ≈ 5 m/px, z17 ≈ 0,32 m/px (batendo com os produtos nativos de 463 m, 100 m, 6 m e 25 cm). Em lat 18,4° a escala leste-oeste é cerca de 0,95 desses valores.

### Templates prontos para `L.tileLayer`

```js
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ/';
const T = '/1.0.0/default/default028mm/{z}/{y}/{x}.';

// map = L.map('map', { crs: L.CRS.EPSG4326, center: [18.44, 77.45], zoom: 5 })

// MOLA (base)
L.tileLayer(TREK + 'Mars_MGS_MOLA_ClrShade_merge_global_463m' + T + 'jpg',
  { tileSize: 256, maxNativeZoom: 7 });

// Viking MDIM (fallback)
L.tileLayer(TREK + 'Mars_Viking_MDIM21_ClrMosaic_global_232m' + T + 'jpg',
  { tileSize: 256, maxNativeZoom: 7 });

// THEMIS IR dia
L.tileLayer(TREK + 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018' + T + 'png',
  { tileSize: 256, maxNativeZoom: 9, bounds: [[-65.0006576, -179.9999997], [65.0007535, 179.9998849]] });

// CTX Jezero controlado (bounds = [[sul, oeste], [norte, leste]] evita 404 fora da cobertura)
L.tileLayer(TREK + 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0' + T + 'png',
  { tileSize: 256, maxNativeZoom: 13, bounds: [[18.2110274, 77.1604655], [18.7211945, 77.6991776]] });

// CTX Jezero preliminar
L.tileLayer(TREK + 'Jezero_CTX_BlockAdj_dd' + T + 'png',
  { tileSize: 256, maxNativeZoom: 12, bounds: [[15.9058484, 75.1537692], [19.4453003, 78.8717121]] });

// HiRISE Jezero ortho
L.tileLayer(TREK + 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd' + T + 'png',
  { tileSize: 256, maxNativeZoom: 17, bounds: [[18.3067994, 77.2229331], [18.669315, 77.583964]] });

// CTX global: o Trek aponta para a Esri (ArcGIS), tiles de 512 px
L.tileLayer('https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}',
  { tileSize: 512, zoomOffset: -1, minZoom: 1, maxNativeZoom: 12 });
```

Atenção ao `maxNativeZoom` no CTX global: com `zoomOffset: -1`, `maxNativeZoom` é em zoom do Leaflet (12 = WMTS 11).

## Verificações do TileMatrixSet e do tile de Jezero

- `default028mm`, zoom 0: `MatrixWidth=2`, `MatrixHeight=1`, `TopLeftCorner=-180 90`, `TileWidth/Height=256` (512 no CTX global). Largura dobra a cada zoom (z7: 256 x 128).
- Fórmula para o tile que contém um ponto: `x = floor((lon+180)/360 * 2*2^z)`, `y = floor((90-lat)/180 * 2^z)`. Para o pouso da Perseverance (18.4447 N, 77.4508 E):
  - z7: x=183, y=50
  - z9: x=732, y=203
  - z12 (CTX preliminar): x=5858, y=1628
  - z13 (CTX Jezero): x=11716, y=3256
  - z17 (HiRISE): x=187469, y=52104
- Todos esses tiles foram baixados com `curl`: HTTP 200 e tamanho > 0 (de 3,4 KB a 110 KB), com `Content-Type` correto e magic bytes de PNG/JPEG. No z7 os produtos locais de Jezero devolvem tiles quase vazios (3–6 KB, RGBA), o que é esperado.
- Fora da cobertura ou além do zoom máximo o servidor devolve **404** (testado: HiRISE em lon 0/lat 0 e CTX Jezero no zoom 14). Por isso o exemplo usa `bounds`.

## CORS e chave

- `curl -sI -H "Origin: http://localhost:5173" <tile>` em `trek.nasa.gov` (MOLA jpg, HiRISE png, `WMTSCapabilities.xml`): **`Access-Control-Allow-Origin: *`**. O preflight `OPTIONS` também responde 200 com `Access-Control-Allow-Origin: *`.
- `astro.arcgis.com` (CTX global, Esri): `Access-Control-Allow-Origin: *`, `Cache-Control: max-age=2592000`.
- **Nenhum endpoint exigiu chave**: nem Trek nem Esri. `api.nasa.gov` não é usado.
- Os tiles funcionam em `<img>` normal; só seria necessário `crossOrigin` se formos ler pixels em canvas, e o CORS aberto já permite.

## Como achar os IDs (para repetir)

- `https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems?rows=3000&start=0` devolve o catálogo inteiro (~1,5 MB de JSON, 225 `product`s). O parâmetro `q` é ignorado (a query é fixa no servidor), então filtramos localmente por `productLabel`, `title` e `bbox`. `productLabel` é o ID do tile. Filtrar por `bbox` contendo 18.44 N / 77.45 E revelou os produtos de Jezero.
- Os nomes que tentamos de cabeça (`Mars_MRO_CTX_mosaic_beta01_200ppd` e `Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v12`) deram **404**; os IDs reais estão na tabela.
- Listar o diretório `https://trek.nasa.gov/tiles/Mars/EQ/` dá 403.

## Observações e riscos

- **CTX global é servido pela Esri**, não pelo Trek, com tiles de 512 px e `zoomOffset`. É a única camada fora do padrão 256 px; é fácil errar o offset e deslocar um zoom (a imagem ainda aparece, só no zoom errado).
- **Escala do Leaflet usa raio da Terra.** `L.control.scale()` e `map.distance()` em 4326 usam R terrestre; a escala do spike serve só como referência visual. O app usa o haversine próprio com R = 3389,5 km.
- **Dois mosaicos CTX para Jezero**: o controlado de 6 m (cobertura pequena, ~0,5° x 0,5°, zoom 13) e o preliminar BlockAdj (mais largo, ~3,7° x 3,5°, zoom 12). Para a demo vale usar o controlado quando o zoom for alto e o preliminar/global como contexto; decisão do time.
- **PNG RGBA** nos produtos locais: cabem como overlay com opacidade; JPEG (MOLA, Viking) só como base.
- **THEMIS não cobre os polos** (±65°); irrelevante para Jezero.
- **Sem garantia de disponibilidade**: são servidores públicos da NASA/JPL (Trek) e Esri; não há SLA. Convém um fallback (Viking) e não depender de tile novo em tempo de demo.
- **Útil para o pipeline de Dados/GIS** (não faz parte deste spike): o catálogo tem `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0` (DEM CTX de 20 m), `JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40` (DEM HiRISE de 1 m) e `Perseverance_Traverse_Path` (bbox 77.3038, 18.4273, 77.4631, 18.4997). São IDs de tile no Trek; a obtenção dos rasters para processar é outra questão.
- **Proveniência (regra do `AGENTS.md`)**: a camada precisa mostrar missão, instrumento e data. O Trek não devolve data de aquisição no tile; as datas vêm do catálogo/metadados e precisam ser escritas à mão em `missions.json`. O HTML do spike só mostra a atribuição (missão/instrumento) no rodapé.

## O que NÃO foi possível confirmar

- **Alinhamento fino (±500 m).** Só olhamos o resultado no navegador: o marcador em 18.44 N / 77.45 E cai na região do delta/cratera de Jezero e as camadas carregam sobrepostas sem deslocamento grosseiro, mas **não medimos o offset** contra uma referência (por exemplo, o ponto de pouso da Perseverance ou crateras conhecidas). Precisa de conferência visual humana, alternando MOLA, CTX e HiRISE no mesmo ponto.
- **Qualidade visual** de cada camada (contraste, emendas do mosaico, transparência em volta do HiRISE/CTX) e a ordem ideal de empilhamento.
- **Termos de uso, atribuição exigida e limites de requisições** do Trek e da Esri (CTX global). Não encontramos limite documentado; não testamos carga.
- **Datas/sols e metadados de aquisição** de cada mosaico.
- **Comportamento em outros navegadores** e em Leaflet embutido no app Vite/React (o spike foi aberto uma vez em um navegador por `file://`).
- **Estabilidade a longo prazo** dos IDs (`..._first_dd`, `..._v2_oct2018` podem mudar).
