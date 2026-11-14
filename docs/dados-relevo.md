# Dados de relevo de Jezero: DTM HiRISE de 1 m

Resultado do spike da issue #22. Todos os números da seção "O que o arquivo diz" foram **lidos do GeoTIFF** com `pipeline/inspect_dtm.py` (rasterio 1.5.2, GDAL 3.12.2), não supostos.

## Decisão

Usaremos o **DTM HiRISE de 1 m (Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic)** como fonte de relevo de Jezero, porque tem resolução de sobra para o grid de ~20 m do app, cobre o local de pouso da Perseverance e já vem em longitude −180 a 180.

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

## Ressalvas

- **Datum vertical não confirmado.** Nem o PDS3 Label nem o XML FGDC dizem qual é a superfície de referência de altitude, só "metros". O nome do produto (`MOLAtopography_DeltaGeoid`) sugere referência ao MOLA/geoide de Marte, mas isso é **inferência**. Para declividade e rota só importam diferenças de altitude, então não bloqueia o roteamento; falta resolver se o painel exibir altitude absoluta.
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
```

`data/raw/` e `*.tif` estão no `.gitignore`: o dado bruto não é versionado.
