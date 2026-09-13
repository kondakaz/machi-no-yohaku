# まちの余白 — 予定＋潜在需要バスシミュレーター

共有サイト: https://kondakaz.github.io/machi-no-yohaku/

依存パッケージ不要の簡易HTMLサンプル。UIはHTML/CSS/JavaScriptとSVG、計算はブラウザ内。React/TypeScriptへの移行は本サンプルの範囲外。

## 起動

`demo/index.html` をブラウザで開く。またはプロジェクトルートで `node serve.cjs` を実行し http://127.0.0.1:4173 を開く。

## 1分デモ

1. Bを選び、シード42のまま再生。予測円と実際の待機人数の違いを見る。
2. 滞在中の登録者で「あと30分」を押し、出発時刻や未割当の表示を確認する。
3. 「A / B を最後まで比較」を押す。同じシードの変更なし予定をそれぞれ9時から12時まで再実行して比べる。
4. 別のシードでも比べ、Bの効果と走行距離のトレードオフを見る。

## Cloudflareでの構成

ブラウザ → Cloudflare Workers Static Assets → HTML/CSS/JavaScript。計算結果や入力はサーバーへ送らない。DB・ログイン・地図API・実行時LLMは不要。

`wrangler.jsonc` に静的配信設定を用意した。公開するときは人間がCloudflareにログインし、Wranglerを準備したうえでプロジェクトルートから `npx wrangler deploy` を実行する。認証情報をソースやチャットへ貼らない。本タスクでは公開操作を実行していない。

公式資料: https://developers.cloudflare.com/workers/static-assets/
設定: https://developers.cloudflare.com/workers/static-assets/binding/

Cloudflare PagesのDirect Uploadで `demo` の配信ファイルをアップロードする方法もある。
https://developers.cloudflare.com/pages/get-started/direct-upload/

## 実験条件

6地点、固定道路、2台各4席、登録者5人・未予約者5人、9〜12時。需要予測は仮定値であり学習済みAIではない。Bの優位を固定値で埋め込まない。比較の集計は現在の地図とは独立した、予定変更なしの2回の全期間実行。

AI支援: 計算エンジン、画面、テスト、説明文の実装。人間による審査観点・妥当性・実地域での有効性の検証は未実施。実施した自動テストとブラウザ確認は作業ログに記録する。

## 単一HTML版と検証結果

`output/bus-simulator.html` はCSS・JavaScriptをすべて内蔵し、その1ファイルをブラウザで開くだけで動く。再生成は `node package-demo.cjs`。

計算検証: `node demo/engine.test.cjs` および `node verify.cjs`。後者は30シード×A/Bの60通りで再現性、容量、道路移動、正しい目的地到着、全訪問先の滞在、延長後の帰着期限維持、12時停止を確認。前者で未予約追加時の既乗者到着保護と次の確定迎えも確認。

ブラウザ検証: ローカルHTTP版と単一HTMLのfile版で動作確認。比較ボタン・30分延長・最後まで進行を実操作で確認し、390px幅と1440px幅のスクリーンショットも確認。

シード42、変更なし: A=登録5/5・未予約0/5・109.8km、B=登録5/5・未予約4/5・154.8km。Bがより遠く走って4人多く運ぶ例。シード1ではAが未予約3人、Bが2人で、予測が必ず有利になるわけではない。

簡易化: 各車の次の迎え1件だけを確定し、その先は仮計画。全訪問・全車両を一括した厳密な挿入最適化は未実装。次の移動は到着＋滞在後に可能となる。厳密な輸送最適化の完成版ではなく、仕組みと比較操作を試すサンプル。

## GitHub Pagesの更新

`demo` のソースを編集し、`node package-demo.cjs` で単一HTMLと `docs/index.html` を再生成する。テスト後、変更をmainへpushすると、GitHub Pagesが `/docs` を公開する。アプリ内の「この実験の見方・操作ガイド」に1分の体験手順を掲載。
