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

## 地図の予約待機者と時間スライダー

予約して迎えを待つ人は、停留所のそばに青い人型アイコンと名前で表示する。未予約待機者はオレンジの人数表示。

時間スライダーで9:00〜12:00を1分単位で前後に移動できる。移動中は再生を止め、その時刻の車両・待機者・集計・ログを表示する。予定変更は巻き戻しても保持するが、過去で新しい変更を行った場合は、その時刻以降の未来を置き換えて再計算する。

`node timeline.test.cjs` で任意時刻への移動、巻き戻し、予定変更の保持、過去の編集による未来の再計算を検証する。

## GitHub Pages配信元の変更

Pagesは公開用ブランチ `gh-pages` のルート `/` を配信する。`demo` 内のファイルをそのまま公開用ブランチへ切り出すため、公開ブランチ直下に `index.html`、`app.js`、`engine.js`、`timeline.js`、`style.css` が置かれる。

更新時はソースと単一HTMLを再生成・テストしてmainへpush後、`git subtree split --prefix demo` の出力コミットを `gh-pages` ブランチへpushする。以前のmain:/docs設定は使用しない。
