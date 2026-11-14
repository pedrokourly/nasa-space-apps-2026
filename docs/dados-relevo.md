# Dados de relevo de Jezero: DTM HiRISE de 1 m

Resultado do spike da issue #22. Todos os números da seção "O que o arquivo diz" foram **lidos do GeoTIFF** com `pipeline/inspect_dtm.py` (rasterio 1.5.2, GDAL 3.12.2), não supostos.

## Decisão

Usaremos o **DTM HiRISE de 1 m (Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic)** como fonte de relevo de Jezero, porque tem resolução de sobra para o grid de ~20 m do app, cobre o local de pouso da Perseverance e já vem em longitude −180 a 180.

## O que este arquivo é e o que não é

- **É** um DTM (mapa de altitude) de 1 m, gerado pelo USGS a partir de **pares estéreo de imagens da câmera HiRISE** (6 pares, 7 DTMs; ver "Completeness Report" na página do produto). Por isso a missão é MRO e o instrumento é HiRISE.
- **Não é** uma imagem: tem uma única banda, de altitude em metros. Não contém dado óptico, térmico nem espectral.
- **Não é dado MOLA.** O "MOLA" no nome (`MOLAtopography_DeltaGeoid`) parece indicar a referência vertical das altitudes (inferência, ver Ressalvas). O MOLA global tem centenas de metros por pixel; este arquivo tem 1 m.
- **A camada óptica HiRISE do mapa** (a imagem que o astronauta vê) vem dos **tiles do Mars Trek**, carregados sob demanda no Leaflet, não deste arquivo. Este `.tif` só alimenta o pipeline (`elevation.bin`, `slope.bin`) e o roteamento.

## Proveniência

| Campo | Valor |
|---|---|
| Missão | Mars Reconnaissance Orbiter (MRO), NASA |
| Instrumento | HiRISE (High Resolution Imaging Science Experiment) |
| Produto | Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic |
| Arquivo | `JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif` (1.839.545.409 bytes, ~1,8 GB) |
| Publicador | USGS Astrogeology Science Center |
| Data de publicação | 2020-07-24 |
| Período das imagens | 2006-01-01 a 2019-10-24 |
| DOI | [10.5066/P9REJ9JN](https://doi.org/10.5066/P9REJ9JN) |
| Página do produto | https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40 |
| Download | https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif (redireciona para o S3 do USGS) |
| Metadados | XML FGDC e PDS3 Label na página do produto |
| Restrições | Acesso: nenhuma. Uso: "Please cite authors" |

### Citação

- Fergason, R. L., Hare, T. M., Mayer, D. P., Galuszka, D. M., Redding, B. L., Smith, E. D., Shinaman, J. R., Cheng, Y., Otero, R. E., 2020, *Mars 2020 Terrain Relative Navigation Flight Product Generation: Digital Terrain Model and Orthorectified Image Mosaics*, 51st Lunar and Planetary Science Conference.
- McEwen, A. S. et al., 2007, *Mars Reconnaissance Orbiter's High Resolution Imaging Science Experiment (HiRISE)*, J. Geophys. Res. 112, E05S04, https://doi.org/10.1029/2005JE002605.
- USGS Astrogeology Science Center, 2020, Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, https://doi.org/10.5066/P9REJ9JN.

## O que o arquivo diz

| Item | Valor |
|---|---|
| Formato | GeoTIFF, 1 banda, `float32`, em faixas (uma linha por faixa, 85.600 bytes), sem overviews |
| Tamanho | 21.400 colunas × 21.488 linhas |
| Unidade do valor | metros (altitude) |
| nodata | `-3.4028226550889045e+38` (menor float32) |
| CRS | Equirectangular Mars 2000 Sphere IAU (`+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +R=3396190`) |
| Raio do corpo | **3.396.190 m** (esfera). O app usa 3.389,5 km em `src/lib/geo.ts` |
| Latitude | planetocêntrica |
| Convenção de longitude | **−180 a 180, positiva a leste** (confirmado no PDS3 Label). Em Jezero é ~77°E, então 0–360 e −180–180 coincidem |
| Origem do raster | linha 0 = norte (transform `1, 0, 4577366 / 0, -1, 1106618`) |
| bbox no CRS (m) | x 4.577.366 a 4.598.766; y 1.085.130 a 1.106.618 |
| bbox lon/lat | lon 77,2229° a 77,5840°E; lat 18,3068° a 18,6693°N |
| Extensão | 21,40 km (x) × 21,49 km (y) |
| Pixel no CRS | 1 m × 1 m |

### Metros reais por pixel

Na projeção Equirectangular com paralelo padrão 0, um pixel mede 1 m em y, mas encolhe em x com o cosseno da latitude:

| Latitude | x (m/pixel no solo) | y (m/pixel no solo) |
|---|---|---|
| 18,3068°N (borda sul) | 0,9494 | 1,0000 |
| 18,4881°N (centro) | 0,9484 | 1,0000 |
| 18,6693°N (borda norte) | 0,9474 | 1,0000 |

Os valores são distintos (x ≈ 0,948 m, y = 1,000 m, diferença de ~5%). O gradiente da declividade deve usar esses metros reais, não 1 m em ambos os eixos, senão a inclinação sai errada.

### Cobertura e nodata

Varredura completa do arquivo (459.843.200 pixels):

- **Válidos:** 303.990.958 (66,1%).
- **nodata:** 155.852.242 (**33,9%**). O recorte do mosaico não é retangular, então há buracos nas bordas.
- **Elevação válida:** de −2.665,37 m a −1.639,89 m.
- **Pixels válidos ocupam** as linhas 4 a 21.477 e as colunas 320 a 21.370.

O roteamento deve tratar nodata como **intransponível**, nunca como zero.

## Grid do app (issue #23)

Geometria fixada em `pipeline/jezero_grid.py` e gravada em `web/public/data/meta.json` (mesmo formato do mock de `web/public/data/mock/meta.json`, que o app já usa).

| Item | Valor |
|---|---|
| bbox `[minLon, minLat, maxLon, maxLat]` | `[77.36, 18.40, 77.50, 18.50]` |
| Tamanho do bbox (haversine, R = 3389,5 km) | 7,86 km (x) × 5,92 km (y), dentro da faixa de 5 a 15 km |
| Dentro da cobertura do DTM | Sim (lon 77,2229 a 77,5840; lat 18,3068 a 18,6693) |
| nodata do DTM dentro do bbox | 0,00% (leitura decimada) |
| Elevação no bbox | de −2.647 m a −2.392 m (amostra decimada) |
| Grade | 512 × 512 células |
| Metros por célula | x = 15,345 m, y = 11,554 m (R = 3389,5 km) |
| CRS | EPSG:4326 (lon/lat), linha 0 = norte |
| nodata gravado nos `.bin` | `-3.4028234663852886e+38` (menor float32, igual ao mock) |
| Longitude | −180 a 180, positiva a leste |

### Validação do bbox contra o traverse real da Perseverance

Comparação feita com as 708 paradas do rover publicadas pelo MMGIS/NASA (`https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json`, lido em memória, não versionado; campos `sol`, `lon`, `lat`, `elev_geoid`).

- **Local de pouso:** o primeiro waypoint (sol 13) está em 77,4509°E, 18,4446°N, o mesmo ponto do habitat do mock, dentro do bbox. Coordenadas conferem com Wikidata e com o NASA GISS Mars24 (Octavia E. Butler Landing).
- **Cobertura do traverse:** 313 das 708 paradas caem dentro do bbox, todas dos sóis 13 a 886 (piso da cratera e campanha na frente do delta). A partir do sol ~896 o rover sobe para oeste (lon < 77,36) e, do sol 1815 em diante, sai até da cobertura do DTM (lon < 77,2229). **O bbox não cobre o traverse completo, só a primeira parte.**
- **Delta:** um artigo do JGR (Sun et al., 2023, doi:10.1029/2022JE007613) situa o pouso a ~2 km da frente oeste do delta, ou seja, em torno de 77,41°E, dentro do bbox. A posição exata dos alvos reais será fixada na #28.
- **Altitude do DTM contra a do rover** (612 paradas com dado válido): diferença DTM − rover com mediana 0,00 m, média 0,57 m, desvio 1,41 m, percentis 5 e 95 de −0,09 e 4,11 m, máximo 5,37 m. Isso indica que o DTM usa a mesma referência vertical do rover e que o registro horizontal está bom. Não é uma declaração do USGS, é medida nossa.

**Por que mantivemos o bbox do mock.** Ele cai inteiro sobre dado válido do DTM e já contém os pontos dos alvos e da rota de mock (habitat em 77,4508°E 18,4447°N, frente do delta, margem de carbonatos). Trocar o bbox obrigaria a mexer em todos os mocks sem ganho. O `meta.json` real ficou igual ao mock, exceto pelo campo `source`.

**Por que grade lon/lat (EPSG:4326) e não grade métrica local.**
- O Mars Trek e o Leaflet do app usam EPSG:4326: a rota, os alvos e os overlays (como `slope.png`) ficam no mesmo sistema, sem reprojetar no navegador.
- O contrato e `web/src/types/contract.ts` já fixam `crs: "EPSG:4326"`; mudar exigiria alterar todas as frentes.
- O DTM de origem já é uma grade de lon/lat (Equirectangular com paralelo padrão 0): cada pixel mede o mesmo ângulo em x e y. Reamostrar para o grid do app é uma média de blocos, sem distorção.
- O custo é que a célula não é quadrada em metros (15,3 × 11,6 m). Isso é descrito por `m_per_cell_x` e `m_per_cell_y`; o roteamento e a declividade (#25) devem usar os dois valores, nunca um só.

**Atenção na reamostragem (#24).** Os 1 m do DTM ficam em x ≈ 0,948 m no solo e y = 1,000 m; o bbox ocupa ~8.300 × 5.917 pixels do DTM. A redução para 512 × 512 deve ser por média (`Resampling.average`), e o nodata do DTM (`-3.4028226550889045e+38`) deve ser convertido para o nodata do contrato.

**Raio.** Os metros por célula usam o raio do app (3389,5 km). Com o raio do DTM (3396,19 km) eles seriam ~0,2% maiores; a diferença não importa para a rota, mas não se deve misturar os dois raios no mesmo cálculo.

## elevation.bin (issue #24)

Gerado por `pipeline/export_elevation.py` a partir do DTM de 1 m, em `web/public/data/elevation.bin`.

| Item | Valor |
|---|---|
| Formato | Float32 little-endian, row-major, linha 0 = norte, 512 × 512 |
| Tamanho | 1.048.576 bytes (512 × 512 × 4) |
| Células válidas | 262.144 de 262.144 (nenhuma nodata dentro do bbox) |
| Elevação | mín −2.646,73 m, máx −2.392,54 m, média −2.537,21 m |
| Reprodutível | Duas execuções geram bytes idênticos |
| Leitura | `numpy.fromfile(..., dtype="<f4").reshape(512, 512)` |
| Proveniência | MRO, HiRISE, USGS Astrogeology, DOI 10.5066/P9REJ9JN (campo `source` do `meta.json`) |

**Como foi feito.** O script lê só a janela do DTM que cobre o bbox (cerca de 8.300 × 5.900 pixels, não o arquivo inteiro de 21.400 × 21.488) e reamostra por **média de blocos** (`Resampling.average`) para a grade de 512 × 512. Não há reprojeção: o DTM já é uma grade lon/lat (`x = R·lon`, `y = R·lat`, R = 3.396.190 m), com longitude −180 a 180.

**Regra de nodata.** O nodata do DTM (`-3.4028226550889045e+38`) vira o do contrato (`-3.4028234663852886e+38`, menor float32). Uma célula do grid é nodata se **qualquer** pixel de 1 m dentro dela era nodata, e nunca vira 0. Hoje isso não ocorre, mas vale para o bbox futuro.

**Validação.** Com as 313 paradas do rover dentro do bbox (MMGIS/NASA, `elev_geoid`):

| Comparação | Mediana | Desvio | Máx. \|dif\| |
|---|---|---|---|
| DTM de 1 m − altitude do rover | 0,00 m | 0,06 m | 0,43 m |
| `elevation.bin` − DTM de 1 m (mesmo ponto) | 0,02 m | 0,37 m | 2,14 m |
| `elevation.bin` − altitude do rover | 0,03 m | 0,37 m | 2,17 m |

A diferença do grid vem da média em células de 15 × 12 m sobre terreno inclinado, não de deslocamento. Para o alinhamento horizontal, sobrepus um hillshade do `elevation.bin` (azimute 315°, altitude 45°) aos tiles HiRISE de 25 cm do Mars Trek, com 50% de opacidade: as feições (bordas de crateras, escarpa do delta, montículos pequenos) aparecem nítidas, sem bordas duplicadas, e a escarpa do delta continua sem quebra através da borda do bbox. Um deslocamento de uma célula (~12 px no zoom usado) seria visível. A checagem visual foi feita por inspeção em uma página de teste fora do repositório; a validação sistemática contra o Mars Trek continua sendo a #32.

## slope.bin (issue #25)

Gerado por `pipeline/export_slope.py` a partir do `elevation.bin` e do `meta.json`, em `web/public/data/slope.bin`.

| Item | Valor |
|---|---|
| Formato | Float32 little-endian, row-major, linha 0 = norte, 512 × 512, em **graus** |
| Tamanho | 1.048.576 bytes, o mesmo grid do `elevation.bin` |
| Células válidas | 260.100 de 262.144; nodata: 2.044 (a borda de 1 célula do grid) |
| Declividade | mín 0,00°, máx 43,75°, média 3,59°, mediana 2,28° |
| Células acima de 10° / 15° / 25° | 6,74% / 2,94% / 0,46% |
| Proveniência | MRO, HiRISE, USGS Astrogeology, DOI 10.5066/P9REJ9JN (mesma do `elevation.bin`) |

**Método.** Declividade de Horn (a mesma do `gdaldem slope`): `dz/dx` e `dz/dy` por kernel 3 × 3 ponderado, com os metros reais por célula do `meta.json` (x = 15,345 m, y = 11,554 m), e `slope = degrees(arctan(hypot(dz/dx, dz/dy)))`. Usar o mesmo tamanho de célula nos dois eixos daria resposta errada, e um teste automatizado cobre isso (rampa de 10° em y com células de tamanhos diferentes devolve 10° com tolerância de 0,1°).

**Regra de nodata.** A célula só tem valor se as 9 células do kernel forem válidas. Uma célula nodata contamina as 8 vizinhas, e a **borda de 1 célula do grid fica nodata** (sem vizinhos), nunca 0. Hoje o `elevation.bin` não tem buracos, então só a borda é nodata.

**Suposição: escala da declividade.** A declividade sai do **grid de 512 × 512 (~15 × 12 m)**, não do DTM de 1 m. Motivo: é a escala do roteamento (o A* anda de célula em célula) e mantém `slope.bin` coerente com o `elevation.bin`. É uma suposição, não uma verdade física. Comparação nas mesmas 262.144 células (`pipeline/slope_scale_check.py`):

| Escala | Média | > 15° | > 25° | Correlação com o grid |
|---|---|---|---|---|
| A) grid de ~15 m (`slope.bin`) | 3,59° | 2,94% | 0,46% | n/a |
| B) DTM de 1 m, média por célula | 4,85° | 3,62% | 0,58% | 0,93 |
| C) DTM de 1 m, máximo por célula | 9,60° | 14,72% | 3,47% | 0,76 |

A escala A tende a **subestimar** degraus e rochas de poucos metros; o DTM de 1 m tem pixels com até 74,9° e 0,78% acima de 25°. A escala C é bem mais conservadora (34% das células acima de 10°), e poderia alimentar um modo "mais segura" no roteamento, mas exigiria outro arquivo. O limite de declividade intransponível continua sendo decisão do Roteamento.

**Sanidade com dado real.** Nas 310 paradas da Perseverance dentro do bbox com declividade válida, a declividade fica em média 3,92°, com máximo de 16,97° e nenhuma acima de 25°. Isso é coerente com um rover que evita terreno íngreme, mas não é uma validação forte: o grid inteiro também é suave (média 3,59°).

## Ressalvas

- **Datum vertical não declarado.** Nem o PDS3 Label nem o XML FGDC dizem qual é a superfície de referência de altitude, só "metros". O nome do produto (`MOLAtopography_DeltaGeoid`) sugere referência ao MOLA/geoide de Marte, mas isso é **inferência do nome**. Há porém evidência empírica de que o DTM concorda com a altitude `elev_geoid` publicada pela Perseverance (ver "Validação do bbox" abaixo). Para declividade e rota só importam diferenças de altitude, então não bloqueia o roteamento.
- **Faixa oeste de baixa qualidade.** O USGS avisa que o par estéreo "Jezero_CR" (borda da cratera, extremo oeste) tem problemas de paralaxe em y e deve ser usado com cautela. Fica fora da elipse de pouso.
- **Cobertura limitada.** O mosaico cobre ~21 × 21,5 km, não a cratera inteira. Os alvos e a rota da demo precisam cair dentro dele (conferir no #23).
- **Precisão.** O registro horizontal entre imagens é melhor que 3 m no percentil 99; o USGS informa um deslocamento vertical mediano de ~0,4 m em relação ao DTM CTX.
- **Raio diferente do app.** Converter lon/lat para metros no raster usa 3.396.190 m; distâncias do app continuam em 3.389,5 km. Não misturar os dois no mesmo cálculo.

## Alternativas consideradas

- **DTM da versão MSR 2024** (DOI [10.5066/P13CPYYU](https://doi.org/10.5066/P13CPYYU), data release de 05/02/2025, ~5,3 GB segundo a issue): **não avaliado**, porque este produto já atende.
- **DEM CTX de 20 m** (`jez_ctx_b_soc_008_dtm_molatopography_deltageoid_20m_eqc_latts0_lon0`, listado como produto relacionado na página do USGS): **não inspecionado**. É o plano B se o recorte de 21 km do HiRISE for pequeno para a rota.

## Como reproduzir

```bash
python -m venv pipeline/.venv
pipeline/.venv/Scripts/python -m pip install -r pipeline/requirements.txt
curl -L -C - -o data/raw/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif"
pipeline/.venv/Scripts/python pipeline/inspect_dtm.py
pipeline/.venv/Scripts/python pipeline/jezero_grid.py        # meta.json (#23)
pipeline/.venv/Scripts/python pipeline/export_elevation.py   # elevation.bin + meta.json (#24)
pipeline/.venv/Scripts/python pipeline/export_slope.py       # slope.bin (#25)
pipeline/.venv/Scripts/python pipeline/slope_scale_check.py  # compara escalas de declividade (opcional)
pipeline/.venv/Scripts/python -m pytest pipeline/tests
```

`data/raw/` e `*.tif` estão no `.gitignore`: o dado bruto não é versionado.
