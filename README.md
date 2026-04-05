# Reynolds Flow Lab

Reynolds Flow Lab は、円柱後流を 3D 格子で計算し、断面スライスと volume preview を並べて観察するブラウザベースの学習用流体シミュレーターです。速度・粘性・円柱径・spanwise seed を変えながら、XY / XZ / YZ の断面ごとに wake の見え方がどう変わるかを確認できます。

## このプロジェクトで扱うこと

- 円柱まわり流れの 3D 体積格子シミュレーション
- Reynolds 数の変化と wake の見え方の比較
- XY / XZ / YZ 断面の切り替え
- volume preview による spanwise 方向の構造確認
- 円柱後方プローブの時系列観測

## このプロジェクトで扱わないこと

- 高忠実度な実務 CFD
- 格子独立性や収束性の厳密評価
- mode A / mode B の定量再現
- 実験値や高精度 DNS と一致させる用途

## 主な機能

- D3Q19 LBM による compact 3D solver
- 流入速度、粘性、円柱径、spanwise seed の操作
- XY / XZ / YZ slice の切り替え
- 速度、法線渦度、spanwise velocity の表示切り替え
- slice 上の流線オーバーレイ
- 3D wake preview の回転表示
- プローブ信号のチャート表示
- PNG 保存

## 使用技術

- Vanilla JavaScript (ES Modules)
- HTML / CSS
- Web Worker
- Canvas 2D
- Node.js の簡易ローカルサーバー
- Node built-in test runner

## ディレクトリ構成

```text
reynolds-flow-lab/
├─ docs/
│  ├─ physics-notes.md
│  ├─ validation.md
│  └─ limitations.md
├─ src/
│  ├─ main.js
│  ├─ styles.css
│  ├─ render/
│  │  ├─ fieldRenderer.js
│  │  ├─ probeChart.js
│  │  └─ volumeRenderer.js
│  ├─ simulation/
│  │  ├─ config.js
│  │  ├─ diagnostics.js
│  │  ├─ lbmSolver.js
│  │  └─ presets.js
│  ├─ ui/
│  │  └─ notes.js
│  └─ workers/
│     └─ simulationWorker.js
├─ tests/
│  ├─ presets.test.js
│  ├─ reynolds.test.js
│  └─ solverSanity.test.js
├─ tools/
│  └─ dev-server.js
├─ index.html
├─ package.json
└─ README.md
```

## セットアップ

```bash
npm install
npm start
```

起動後、`http://localhost:4173` を開いてください。

## テスト

```bash
npm test
```

## 使い方

1. プリセットを選び、基準となる wake の見え方を確認します。
2. XY / XZ / YZ を切り替えて、同じ時間の別断面を比べます。
3. `spanwise seed` を上げると、XZ / YZ と volume preview で 3D らしい揺らぎが見えやすくなります。
4. `uz` 表示に切り替えると、spanwise 方向の速度成分を確認できます。
5. プローブ信号では、円柱後方の横速度 `uy` の変動を追えます。

## 設計上の工夫

### 1. 2D の延長ではなく、3D 格子を別レイヤーとして実装

見た目だけ 3D 風にするのではなく、数値計算側を D3Q19 の体積格子に置き換えています。計算は worker 側で行い、UI 側には断面 slice と volume preview に必要なデータだけを返しています。

### 2. 断面表示を主役にして説明しやすくした

3D の流れは volume view だけだと読み取りづらくなるため、XY / XZ / YZ のスライスを主表示にしています。面接でも「この断面では何が見えているか」を説明しやすい構成です。

### 3. 低解像度でも spanwise 構造を観察しやすい seed を用意した

小さな体積格子でも 3D らしい違いを観察しやすいように、spanwise 方向の小さな摂動をパラメータ化しています。これにより、YZ / XZ 断面と volume preview の差を短時間で確認できます。

## 難しかった点とトレードオフ

- ブラウザ上で常時 3D 体積格子を回すため、格子サイズは控えめにしています。
- full volume を毎フレーム転送すると重くなるため、worker で slice と point cloud を生成してから UI に渡しています。
- 高 Reynolds 数を無理に狙うと安定性が落ちやすいため、教育用として見せやすい範囲に寄せています。

## 既知の制約

- 定量的な wake frequency 評価には向きません。
- 流入・流出境界は簡略化しています。
- spanwise 構造は小さな seed に依存します。
- 高精度 3D CFD と比べると解像度は低いです。

## 今後の改善案

- probe 信号の FFT を追加して周期性を見やすくする
- volume preview を orbit 操作対応にする
- 円柱以外の障害物形状を追加する
- CSV 出力でパラメータ比較をしやすくする
