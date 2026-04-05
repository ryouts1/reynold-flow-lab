# Reynolds Flow Lab

Reynolds Flow Lab は、円柱まわりの 2D 流れをブラウザ上で観察するための小規模シミュレーターです。流入速度、粘性、円柱径を変えながら Reynolds 数を確認し、低 Re の後流、周期的な渦放出、3D 遷移閾値の手前での見え方を比較できます。

このリポジトリの主目的は、厳密な工学解析を行うことではなく、Reynolds 数と後流パターンの関係を定性的に説明できる UI と計算コアを、ひとつの完成した作品としてまとめることです。

## このプロジェクトで見せたいこと

- 数式ベースのテーマを、触って理解できる UI に落とし込む力
- 描画と計算を分けたシンプルな構成
- 速度場、渦度、プローブ信号を組み合わせた観察設計
- 「何が再現できて、何は再現していないか」を README / docs で明示する説明力

## できること

- 円柱後流の 2D シミュレーション
- 流入速度、粘性、円柱径、更新回数の調整
- 速度表示 / 渦度表示の切り替え
- 流線オーバーレイ
- Reynolds 数のリアルタイム表示
- 円柱後方プローブの信号表示
- 3 種類の比較用プリセット
- PNG スナップショット保存

## 使っている技術

- Vanilla JavaScript (ES Modules)
- HTML / CSS
- Web Worker
- D2Q9 Lattice Boltzmann Method
- Node.js built-in test runner (`node --test`)
- 依存ライブラリなし

外部依存を置かずに完結するようにしているので、ローカルでそのまま開いて確認しやすい構成です。

## ディレクトリ構成

```text
reynolds-flow-lab/
├─ docs/
│  ├─ limitations.md
│  ├─ physics-notes.md
│  └─ validation.md
├─ src/
│  ├─ main.js
│  ├─ styles.css
│  ├─ render/
│  │  ├─ fieldRenderer.js
│  │  └─ probeChart.js
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

## 実行方法

### 1. ローカルサーバーを起動

```bash
npm start
```

初期設定では `http://localhost:4173` で開けます。

### 2. テスト実行

```bash
npm test
```

### 3. サーバーを使わず確認したい場合

`index.html` を直接開くと、ブラウザによっては Worker の読み込み制約に当たる場合があります。基本はローカルサーバー経由での確認を前提にしています。

## 操作メモ

- まずは `中 Re: 周期渦放出` プリセットで再生すると、交互渦放出とプローブ信号の振動が見えやすいです。
- `低 Re` に切り替えると、後流の揺れが弱くなります。
- `高 Re` は 2D モデルとしては上限寄りで、3D 遷移閾値の手前を比較する目的で置いています。
- スライダーを動かすと自動で再初期化されます。

## 設計上の整理

### 計算コア

計算は D2Q9 LBM の簡略実装です。矩形格子上に一様流を入れ、円柱セルには bounce-back を適用しています。上端・下端は周期境界、左端は簡易な流入境界、右端は単純な外挿にしています。なお、完全な左右対称解に固定されないよう、流入境界にはごく小さな時間依存擾乱を入れています。

### 描画

描画はメインスレッド、計算は Worker 側に分けています。毎フレーム、Worker から `ux`, `uy`, `vorticity` を受け取り、Canvas に速度または渦度を描いています。流線はメインスレッド側で速度場をサンプリングして重ねています。

### 観測

見た目だけで終わらせないために、円柱後方にプローブを置いて `uy` の時系列を表示しています。周期渦放出が出る設定では、この信号がほぼ周期的に振れます。

## 制約

- 2D の教育用モデルです
- 高 Re での 3D 不安定化や完全な乱流は扱っていません
- 境界条件は可視化向けに簡略化しています
- 定量精度より、パラメータ比較と現象理解を優先しています

詳しくは `docs/limitations.md` を参照してください。

## テスト方針

- Reynolds 数の計算式が崩れていないか
- プリセットの整合性が保たれているか
- 初期化直後と数十ステップ後に NaN や異常密度が出ていないか

厳密な CFD 検証テストではなく、作品として壊れていないことを確認する最低限の sanity check を置いています。

## 参考メモ

- 低 Re では laminar、高 Re では turbulent になりやすいという Reynolds 数の基本整理は NASA Glenn の解説を参照しています。
- 円柱後流の 3D instability の臨界 Re ≈ 188.5 付近については Barkley & Henderson (1996) を参照しています。

具体的なリンクと補足は `docs/validation.md` にまとめています。
