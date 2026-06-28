# データ下ごしらえ（実データ取り込み）

国土数値情報などの公式データを、乗りつぶしアトラス（`prototype/atlas/index.html`）に
読み込める **GeoJSON** に変換する手順です。

> ⚠️ この変換は**あなたの手元のPC**で実行してください。
> （開発環境はネットワーク制限があり、公式サイトからのダウンロードができないため）

重いGIS処理（Shapefile→GeoJSON変換・県境のディゾルブ・簡略化・Shift_JIS対応）は
実績ある CLI **[mapshaper](https://github.com/mbostock/mapshaper)** に任せ、
路線名の整理と路線色の付与だけ同梱の小スクリプトで行います。

---

## 0. 準備（1回だけ）

Node.js（18以上）が入っている前提で：

```bash
cd data-prep
npm install        # mapshaper が入る
```

---

## 1. 鉄道（塗りつぶしの本体）：国土数値情報 N02

### ダウンロード
- N02 鉄道データ: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2024.html
  （最新年度版を選択。全国版 zip でOK。無料・商用可／**出典明示が必要**）
- zip を解凍すると `N02-XX_RailroadSection.shp`（路線の線）と
  `N02-XX_Station.shp`（駅）などが入っています。**路線は RailroadSection** を使います。

### 変換（線路ポリライン → 色つき路線GeoJSON）

```bash
# 1) Shapefile → GeoJSON（Shift_JIS対応・15%に簡略化して軽量化）
npx mapshaper "N02-XX_RailroadSection.shp" encoding=shift-jis \
  -simplify 15% keep-shapes \
  -o rail-raw.geojson

# 2) 路線名(name)・事業者(operator)・路線色(color)を付与
node add-rail-meta.mjs rail-raw.geojson > rail.geojson
```

→ `rail.geojson` が完成。これをアトラスに読み込むと、全国の路線を塗れます。
（`-simplify` の数値を下げると更に軽く・粗く、上げると重く・精細になります）

---

## 2. 県境：国土数値情報 N03（行政区域）

### ダウンロード
- N03 行政区域: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2024.html
- 解凍すると市区町村ポリゴンの `N03-XX_XX.shp` があります。

### 変換（市区町村 → 都道府県の境界に統合）

```bash
# 都道府県名(N03_001)でディゾルブ＝市区町村をまとめて県単位の面にし、8%に簡略化
npx mapshaper "N03-XX_XX.shp" encoding=shift-jis \
  -dissolve2 N03_001 -each 'name=N03_001' \
  -simplify 8% keep-shapes \
  -o prefectures.geojson
```

→ `prefectures.geojson`（都道府県ポリゴン）が完成。アトラスに読み込むと県境が出ます。

> もっと手軽に済ませたい場合は、配布済みの「都道府県レベルGeoJSON」を入手して
> そのまま読み込んでもOKです（その場合 `-dissolve2` は不要）。

---

## 3. 温泉・観光スポット（任意）

スポットは **Point の GeoJSON** にすれば読み込めます。形式：

```json
{ "type":"FeatureCollection","features":[
  { "type":"Feature",
    "properties":{ "name":"草津温泉", "type":"o" },   // type: o=温泉, s=観光（省略可）
    "geometry":{ "type":"Point","coordinates":[138.59,36.62] } }
]}
```

- `name` に「温泉」「湯」が含まれる場合は自動で温泉(♨)扱いになります。
- 出典例：国土数値情報の観光資源（P12）など。自前のCSVをGeoJSON化してもOK。

---

## 4. アトラスに読み込む

`prototype/atlas/index.html` を開き、右下の **📁 GeoJSON** ボタン
（またはファイルをドラッグ＆ドロップ）で読み込みます。

- **線（LineString）** → 路線として表示・塗りつぶし対象に
- **面（Polygon）** → 県境として表示
- **点（Point）** → 温泉・観光スポットとして表示

3つは別々に読み込めて共存します（`rail.geojson` → `prefectures.geojson` → `spots.geojson` の順でドロップ）。

---

## 出典表示について（公開時）

- 国土数値情報 N02/N03 を使う場合、アプリ内に
  「出典：国土数値情報（鉄道データ／行政区域データ）（国土交通省）」＋取得年月日を明示してください。
  加工している場合は「加工」表示も必要です（詳細は `docs/cost-research.md`）。
