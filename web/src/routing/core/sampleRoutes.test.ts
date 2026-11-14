/// <reference types="node" />
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMeta, parseRoute } from '../../lib/loadData';
import { SAMPLE_META, sampleRoutes } from './sampleRoutes';

const dir = new URL('../../../public/data/mock/', import.meta.url);
const file = (name: string) => new URL(name, dir);
const serialize = (r: unknown) => JSON.stringify(r, null, 2) + '\n';

const { go, noGo } = sampleRoutes();

if (process.env.WRITE_MOCKS) {
  writeFileSync(file('route-go.geojson'), serialize(go));
  writeFileSync(file('route-no-go.geojson'), serialize(noGo));
}

describe('rotas de exemplo', () => {
  it('o terreno de exemplo usa o mesmo meta do mock do contrato', () => {
    const meta = parseMeta(JSON.parse(readFileSync(file('meta.json'), 'utf8')));
    expect({ bbox: SAMPLE_META.bbox, w: SAMPLE_META.width, h: SAMPLE_META.height, mx: SAMPLE_META.m_per_cell_x, my: SAMPLE_META.m_per_cell_y }).toEqual({
      bbox: meta.bbox,
      w: meta.width,
      h: meta.height,
      mx: meta.m_per_cell_x,
      my: meta.m_per_cell_y,
    });
  });

  it('a rota GO tem veredito GO e a NO-GO tem NO-GO com ponto de não retorno', () => {
    expect(go.properties.veredito).toBe('GO');
    expect(noGo.properties.veredito).toBe('NO-GO');
    const pnr = noGo.properties.ponto_nao_retorno;
    expect(pnr).toBeDefined();
    expect(pnr!).toBeGreaterThan(0);
    expect(pnr!).toBeLessThan(noGo.geometry.coordinates.length);
  });

  it('as duas rotas têm a mesma geometria (só muda o O₂ disponível)', () => {
    expect(noGo.geometry).toEqual(go.geometry);
    expect(go.properties.dist_m).toBeGreaterThan(5000);
  });

  it('os arquivos em public/data/mock estão em dia e passam no parser do contrato', () => {
    for (const [name, expected] of [['route-go.geojson', go], ['route-no-go.geojson', noGo]] as const) {
      expect(existsSync(file(name)), `${name} não existe; gere com WRITE_MOCKS=1 npm test -- sampleRoutes`).toBe(true);
      const onDisk = JSON.parse(readFileSync(file(name), 'utf8')) as unknown;
      expect(onDisk).toEqual(JSON.parse(serialize(expected)));
      parseRoute(onDisk);
    }
  });
});
