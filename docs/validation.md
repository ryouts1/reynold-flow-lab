# Validation Notes

このファイルは「何を根拠にプリセットや説明文を置いたか」を簡単にまとめたメモです。厳密な検証レポートではなく、作品内の記述の根拠を確認しやすくするための補助資料として置いています。

## 参照した知見

### Reynolds 数と laminar / turbulent の基本整理

NASA Glenn Research Center の Boundary Layer 解説では、Reynolds 数が低いと laminar、高いと turbulent になりやすいことが説明されています。

- NASA Glenn Research Center, "Boundary Layer"
- https://www.grc.nasa.gov/www/k-12/BGP/boundlay.html

### 円柱後流の 3D instability の閾値

Barkley & Henderson (1996) では、円柱後流の 2D periodic wake が 3D perturbation に不安定になる臨界 Reynolds 数が `188.5 ± 1.0` と報告されています。README や UI の説明で「高 Re プリセットは 3D 遷移閾値の手前を見るための比較用」と書いている根拠はこの値です。

- Barkley, D. and Henderson, R. D. (1996)
- "Three-dimensional Floquet stability analysis of the wake of a circular cylinder"
- Journal of Fluid Mechanics
- https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/threedimensional-floquet-stability-analysis-of-the-wake-of-a-circular-cylinder/61575FBF0BC45054592D46382DEF30BB

## プリセットの置き方

### 低 Re

定常に近い後流を観察しやすいように、Re が 40 未満になる設定を置いています。完全な理想対称場ではありませんが、周期性が弱い状態を比較しやすくするための基準点です。

### 中 Re

交互渦放出が見えやすい帯域として、中くらいの Re を 1 つ置いています。プローブ信号もここで最も分かりやすく振れます。

### 高 Re

2D モデルの上限寄りとして、3D instability の臨界よりやや低い帯域を見る設定を置いています。これは「ここから先は 3D の議論が必要になる」という説明のための比較用です。

## ここでやっていないこと

- Strouhal 数の厳密計測
- 工学設計用途の高精度検証
- 格子独立性や時間刻み依存性の本格検証
- 3D DNS / LES / RANS との比較

作品の狙いは、教育用の 2D 可視化として筋の通った説明ができることにあります。
