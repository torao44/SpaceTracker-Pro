# 🛰️ SpaceTracker Pro (v1.5.2)

[![Version](https://img.shields.io/badge/version-1.5.2-blue.svg)](https://github.com/torao44/SpaceTracker-Pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green.svg)](https://github.com/torao44/SpaceTracker-Pro)

国際宇宙ステーション（ISS）のリアルタイム軌道追跡、スマートフォンを夜空にかざして位置を特定する**空向けARナビゲーション**、今夜見える星座のリアルタイム天体シミュレーション、最新ロケット打上げスケジュール、月齢・日の出入り・流星群情報を集約した次世代の天文・宇宙観測Webアプリケーションです。

---

## 🌟 主な機能 (Key Features)

### 1. 🛰️ ISS リアルタイム追跡 & 肉眼観測予報
- **リアルタイム軌道マップ**: 秒単位で更新されるISSの現在位置（緯度・経度）、対地速度（約27,600 km/h）、軌道高度（約420 km）。
- **現在搭乗中の宇宙飛行士**: ISSに滞在しているクルーの一覧、役職、国籍、宇宙滞在日数の詳細モーダル表示。
- **現在地の肉眼可視パス予報**: GPS現在地から肉眼で見えるISSの通過予定（日時、最大仰角、出現・消滅方位、観測条件スコア）を自動算出。
- **通過カウントダウン**: 次回ISSが頭上を通過する瞬間までのリアルタイムタイマー。

### 2. 📱 スマホ空向け ARナビゲーション (v1.5.2 最新センサーエンジン)
スマートフォンを空に向けるだけで、カメラ実景映像または夜空HUD上にISSや星座の正確な位置をオーバーレイ表示します。
- **3D回転ベクトル演算**: 背面カメラ光軸の3次元幾何投影により、iOS・Androidのどちらでも正確な方位・仰角（地平線0°〜天頂90°）を追随。
- **真北（True North）& 磁気偏角自動補正**: 地磁気の偏角（日本各地の約-7.5°西偏）を自動補正。
- **能動的キャリブレーションUI**: ワンタップで「◀ 90° 西へ」「90° 東へ ▶」「🧭 今の向きを北にする」「±5° 微調整」ができる補正パネルを搭載。
- **ダイナミック・ソナー誘導**: ターゲット（ISS・星座）に近づくほど音程が高くなり、間隔が早くなる近接ソナー音と振動（ハプティクス）フィードバック。
- **LIVEリアルタイム追従モード**: ISSが上空を通過中の間、動くISSの位置をリアルタイムに追尾。

### 3. ✨ 今日の夜空・リアルタイム星座ARナビ
- **天文学的リアルタイム位置計算**: 観測日時と現在地（緯度・経度）から、恒星・星座の赤経・赤緯を方位角・高度角にリアルタイム変換。
- **全天星座マップ（天球図ドーム）**: 中心を天頂、外周を地平線とした見やすい天球図レーダー。
- **時間シミュレーター**: 「今夜 20:00」「今夜 23:00」など、時間を進めて昇ってくる星座を事前確認。
- **主要星座カタログ**: オリオン座、おおぐま座（北斗七星）、カシオペヤ座、はくちょう座（夏の大三角）などの星と星座線をARで探索可能。

### 4. 🚀 ロケット打上げスケジュール & カウントダウン
- SpaceX（Falcon 9 / Starship）、NASA、JAXA、ESAなどの最新打ち上げスケジュール。
- 次回打ち上げのT-マイナスカウントダウンヒーローバナー。
- 機関別（SpaceX / NASA / JAXA / すべて）のワンタップフィルタリング。

### 5. 🌕 天体観測環境・月齢・太陽データ
- **月齢（Moon Age） & 月相ビジュアル**: リアルタイムな月齢計算、月相名（新月、上弦、満月、下弦など）、輝面比率。
- **日の出・日の入り・薄明時刻**: 当日の日の出・日の入り時刻と日没カウントダウン、ゴールデンアワー・ブルーアワー情報。
- **Starlink衛星隊列可視予報**: Heavens-Aboveと連携し、トレイン通過予定をワンクリック確認。
- **主要流星群カレンダー**: ペルセウス座流星群、ふたご座流星群などの年間極大時期と1時間あたり出現数（ZHR）。

---

## 🛠️ 技術スタック (Tech Stack)

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (カスタムデザインシステム / レスポンシブ)
- **AR / Sensors**: W3C DeviceOrientation API (`deviceorientationabsolute`), `webkitCompassHeading`, WebRTC Camera Stream (`getUserMedia`), Web Audio API (動的オシレーター合成音)
- **Astronomy Math**: 
  - SGP4 / TLE 衛星軌道力学
  - 天体赤道座標系 (RA/Dec) ➔ 地平座標系 (Az/Alt) 座標変換
  - IGRF 世界磁気モデル近似（磁気偏角補正）
- **APIs**:
  - Open Notify API / Where the ISS at? (ISS位置・軌道情報)
  - Launch Library 2 (The Space Devs - ロケット打上げ情報)
  - Open-Meteo & Heavens-Above (天文薄明・可視予報)
- **PWA**: Service Worker キャッシュ (`Cache-First` / `Network-First` ハイブリッド), Web App Manifest

---

## 📂 プロジェクト構成 (Directory Structure)

```text
SpaceTracker-Pro/
├── index.html        # メインUI・天球図・ARナビゲーションモーダル
├── app.js            # コアロジック、軌道計算、ARセンサーエンジン、天文学計算
├── style.css         # スタイリング、グラスモフィズム、HUDデザイン
├── manifest.json     # PWA設定ファイル（アイコン、テーマカラー、表示モード）
├── sw.js             # Service Worker（オフラインキャッシュ制御）
├── wrangler.jsonc    # Cloudflare Pages / Workers 設定
└── README.md         # プロジェクト説明書
```

---

## 🚀 インストール & デプロイ方法 (Getting Started)

### ローカルでの動作確認
本プロジェクトは外部ビルドツール不要のピュアWebスタックで構築されているため、静的ファイルサーバーがあれば即座に起動できます。

```bash
# リポジトリのクローン
git clone https://github.com/torao44/SpaceTracker-Pro.git
cd SpaceTracker-Pro

# ローカルサーバーの起動 (例: Python 3)
python3 -m http.server 8080

# または npx serve
npx serve .
```

ブラウザで `http://localhost:8080` を開きます。
> ※ AR機能やカメラ・センサー（DeviceOrientation）は、ブラウザのセキュリティ仕様上 **HTTPS環境** または **`localhost`** でのみ動作します。

### Cloudflare Pages へのデプロイ
1. Cloudflare ダッシュボードから **「Workers & Pages」>「Create application」>「Pages」** を選択。
2. GitHubリポジトリ `torao44/SpaceTracker-Pro` を連携。
3. ビルド設定:
   - **Framework preset**: None
   - **Build command**: (空白)
   - **Build output directory**: `/`
4. **「Save and Deploy」** をクリックするだけで、高速CDN経由で世界中に配信されます。

---

## 📱 スマートフォンでのAR使用上のヒント

1. **センサーの許可**:
   - iPhone（iOS Safari）では、AR画面表示時に「【ここをタップ】センサーを許可して星空と連動」というボタンが表示されます。タップして許可してください。
2. **コンパスの8の字キャリブレーション**:
   - スマホの電子コンパスは周囲の金属やスマホケースの磁石に影響を受ける場合があります。方角が不安定な場合は、スマホを持った手で空中に「8の字（∞）」を2〜3回大きく描いてください。
3. **90度ズレ・方位オフセット補正**:
   - 画面上部の **「🧭 方位補正」** ボタンから、ワンタップで「90° 西へ」「90° 東へ」回転させたり、「今の向きを北にする」を設定できます。設定は自動保存されます。

---

## 📄 ライセンス (License)

本プロジェクトは [MIT License](LICENSE) のもとで公開されています。
個人利用、教育利用、改変、再配布が自由に可能です。

---

## 🪐 データ提供元 (Credits & Attributions)

- **ISS Telemetry**: [Where the ISS at?](https://wheretheiss.at/) / [Open Notify](http://open-notify.org/)
- **Rocket Launches**: [The Space Devs (Launch Library 2)](https://thespacedevs.com/)
- **Satellite Passes**: [Heavens-Above](https://www.heavens-above.com/)
- **Icons & Fonts**: Google Fonts (Space Grotesk, Inter)
