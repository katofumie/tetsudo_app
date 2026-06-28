#!/usr/bin/env node
// 鉄道GeoJSON(国土数値情報N02をmapshaperでGeoJSON化したもの)に
// name(路線名)/operator(事業者)/color(路線名から決定的に決まる色) を付与する後処理。
//
// 使い方:
//   node add-rail-meta.mjs rail-raw.geojson > rail.geojson
//
// 入力プロパティの想定: N02_003=路線名, N02_004=運営会社(年度により異なる場合あり)。
// 別名(name/路線名/operator等)にもフォールバックする。

import { readFileSync } from 'node:fs';

const inPath = process.argv[2];
if (!inPath) {
  console.error('usage: node add-rail-meta.mjs <rail-raw.geojson> > rail.geojson');
  process.exit(1);
}

// 文字列から決定的に色を決める(同じ路線名は常に同じ色)
function colorFor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return hslToHex(h % 360, 58, 50);
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

const gj = JSON.parse(readFileSync(inPath, 'utf8'));
const inFeats = gj.type === 'FeatureCollection' ? (gj.features || [])
              : gj.type === 'Feature' ? [gj] : [];

const feats = inFeats
  .filter(f => f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'))
  .map(f => {
    const p = f.properties || {};
    const name = p.N02_003 || p['路線名'] || p.name || '';
    const operator = p.N02_004 || p['運営会社'] || p.operator || '';
    return {
      type: 'Feature',
      properties: { name, operator, color: colorFor(name || operator || 'rail') },
      geometry: f.geometry,
    };
  });

process.stdout.write(JSON.stringify({ type: 'FeatureCollection', features: feats }));
process.stderr.write(`\n[add-rail-meta] ${feats.length} 区間を出力しました。\n`);
