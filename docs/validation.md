# Validation

このプロジェクトは、厳密な 3D CFD ベンチマークの再現を目的にしていません。その代わり、以下の確認を通じて「教育用の 3D wake visualizer として破綻していないか」を見ています。

## 実装上の確認

- obstacle mask が円柱中心を覆っていること
- solver を複数 step 進めても密度と速度が有限値のまま保たれること
- slice の取り出し結果が plane ごとに正しいサイズを返すこと
- spanwise 成分 `uz` が 0 に張り付かず、3D view に点群が現れること

## 表示上の確認

- XY 断面で後流の交互構造が見えること
- XZ / YZ 断面に切り替えると、z 方向を含む違う見え方になること
- volume preview が wake の下流側に現れること

## 何を validation していないか

- Strouhal 数の定量一致
- 実験値との厳密比較
- grid refinement / time-step refinement
- mode A / mode B の発生条件の再現

README と docs/limitations.md にも書いている通り、このプロジェクトは「3D を説明できる compact 実装」であり、「高忠実度 CFD の代替」ではありません。
