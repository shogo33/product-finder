/**
 * 多様なキーワードで大量商品を取得するバルクフェッチスクリプト
 * 使い方: node scripts/bulk-fetch.mjs
 * description_ja はスキップ（採用後に別途生成）、title_short は生成する
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const API_URL     = 'https://api-sg.aliexpress.com/sync';
const DATA_FILE   = path.resolve('data/products.json');

// ── キーワード定義 ──────────────────────────────────────────
// product_type = dedup の単位（「同じ目的の商品」グループ）
export const KEYWORD_LIST = [
  // イヤホン・ヘッドフォン（用途・装着方式が異なるので別 type）
  { keyword: 'TWS earbuds noise cancelling ANC',       tag: 'ガジェット',         type: 'カナル型イヤホン' },
  { keyword: 'bone conduction headphones sport',       tag: 'ガジェット',         type: '骨伝導ヘッドホン' },
  { keyword: 'open ear clip on headphones wireless',   tag: 'ガジェット',         type: 'オープンイヤーイヤホン' },
  // スマートウォッチ
  { keyword: 'smart watch fitness tracker health',     tag: 'ガジェット',         type: 'スマートウォッチ' },
  { keyword: 'smart band sleep monitor heart rate',    tag: 'ガジェット',         type: 'スマートウォッチ' },
  // スピーカー
  { keyword: 'bluetooth speaker waterproof portable',  tag: 'ガジェット',         type: 'Bluetoothスピーカー' },
  { keyword: 'mini bluetooth speaker outdoor',        tag: 'ガジェット',         type: 'Bluetoothスピーカー' },
  // 充電・電源
  { keyword: 'wireless charger fast charging pad',    tag: 'ガジェット',         type: 'ワイヤレス充電器' },
  { keyword: 'power bank 20000mah portable fast',     tag: 'ガジェット',         type: 'モバイルバッテリー' },
  { keyword: 'GaN USB-C charger 65W adapter',         tag: 'PC周辺機器',         type: 'USB充電アダプター' },
  // カメラ・映像
  { keyword: 'action camera 4K waterproof sport',     tag: 'ガジェット',         type: 'アクションカメラ' },
  { keyword: 'webcam HD 1080p streaming PC',          tag: 'PC周辺機器',         type: 'Webカメラ' },
  { keyword: 'ring light LED selfie photo',           tag: 'ガジェット',         type: 'リングライト' },
  // PC周辺機器
  { keyword: 'mechanical keyboard gaming RGB switch', tag: 'PC周辺機器',         type: 'キーボード' },
  { keyword: 'wireless gaming mouse ergonomic',       tag: 'PC周辺機器',         type: 'マウス' },
  { keyword: 'monitor stand riser desk organizer',    tag: 'PC周辺機器',         type: 'モニタースタンド' },
  { keyword: 'laptop cooling pad fan stand',          tag: 'PC周辺機器',         type: 'ノートPC冷却台' },
  { keyword: 'large gaming mouse pad desk mat',       tag: 'PC周辺機器',         type: 'マウスパッド' },
  { keyword: 'USB C docking station HDMI',            tag: 'PC周辺機器',         type: 'ドッキングステーション' },
  { keyword: 'HDMI cable 4K high speed',              tag: 'PC周辺機器',         type: 'HDMIケーブル' },
  // スマホアクセサリー
  { keyword: 'phone holder car mount magnetic',       tag: 'スマホアクセサリー',   type: 'スマホカーホルダー' },
  { keyword: 'selfie stick tripod bluetooth remote',  tag: 'スマホアクセサリー',   type: '自撮り棒' },
  { keyword: 'phone stand desk adjustable',           tag: 'スマホアクセサリー',   type: 'スマホスタンド' },
  // 照明・スマートホーム
  { keyword: 'LED strip light RGB smart room',        tag: 'スマートホーム',       type: 'LEDテープライト' },
  { keyword: 'smart desk lamp LED dimmable',          tag: 'スマートホーム',       type: 'デスクライト' },
  { keyword: 'smart plug WiFi timer outlet',          tag: 'スマートホーム',       type: 'スマートプラグ' },
  // プロジェクター (既存キーワードは除外)
  { keyword: 'mini projector outdoor camping',        tag: 'プロジェクター',       type: 'プロジェクター' },
  // フィットネス
  { keyword: 'resistance bands set gym workout',      tag: 'フィットネス',         type: 'トレーニングバンド' },
  { keyword: 'yoga mat thick non slip exercise',      tag: 'フィットネス',         type: 'ヨガマット' },
  { keyword: 'jump rope speed fitness crossfit',      tag: 'フィットネス',         type: '縄跳び' },
  { keyword: 'massage gun percussion muscle',         tag: 'フィットネス',         type: 'マッサージガン' },
  // キッチン・ホーム
  { keyword: 'electric mini kettle travel portable',  tag: 'キッチン',            type: '電気ケトル' },
  { keyword: 'food container storage set airtight',   tag: 'キッチン',            type: '食品保存容器' },
  { keyword: 'kitchen scale digital precise',         tag: 'キッチン',            type: 'キッチンスケール' },
  { keyword: 'silicone kitchen utensils set',         tag: 'キッチン',            type: 'キッチンツール' },
  // ボードゲーム（重複排除しない）
  { keyword: 'card game uno family adults',           tag: 'ボードゲーム',         type: 'カードゲーム' },
  { keyword: 'chess set wooden board game',           tag: 'ボードゲーム',         type: 'チェスセット' },
  { keyword: 'jigsaw puzzle 1000 pieces landscape',   tag: 'ボードゲーム',         type: 'ジグソーパズル' },
  { keyword: 'dice set polyhedral DND RPG',           tag: 'ボードゲーム',         type: 'ダイスセット' },
  { keyword: 'trading card protector sleeve binder',  tag: 'ボードゲーム',         type: 'カードスリーブ' },
  // その他ガジェット
  { keyword: 'portable fan USB rechargeable mini',    tag: 'ガジェット',           type: 'ポータブルファン' },
  { keyword: 'electric mosquito killer lamp indoor',  tag: 'ガジェット',           type: '虫除けライト' },
  { keyword: 'digital alarm clock LED bedroom',       tag: 'ガジェット',           type: '目覚まし時計' },
  { keyword: 'laser pointer pen presentation USB',    tag: 'PC周辺機器',           type: 'レーザーポインター' },
  { keyword: 'cable organizer management clip',       tag: 'PC周辺機器',           type: 'ケーブル整理' },
  { keyword: 'luggage tag travel accessories',          tag: 'トラベル',             type: 'ラゲッジタグ' },
  { keyword: 'travel adapter universal plug',           tag: 'トラベル',             type: '変換アダプター' },
  { keyword: 'packing cube travel organizer set',       tag: 'トラベル',             type: 'パッキングキューブ' },
  // ── 追加ジャンル ──────────────────────────────────────────────────────
  // ペット
  { keyword: 'dog toy interactive ball chew pet',       tag: 'ペット',               type: 'ペット用おもちゃ' },
  { keyword: 'cat scratcher tower climbing tree',       tag: 'ペット',               type: 'キャットタワー' },
  { keyword: 'pet grooming brush deshedding dog cat',   tag: 'ペット',               type: 'ペット用ブラシ' },
  { keyword: 'automatic pet feeder cat dog food bowl',  tag: 'ペット',               type: '自動給餌器' },
  // 美容・スキンケア
  { keyword: 'gua sha facial roller jade quartz stone', tag: '美容',                 type: 'グアシャローラー' },
  { keyword: 'electric face cleansing brush sonic',     tag: '美容',                 type: '電動洗顔ブラシ' },
  { keyword: 'hair removal epilator electric women',    tag: '美容',                 type: '脱毛器' },
  { keyword: 'nail art gel UV lamp kit beginner',       tag: '美容',                 type: 'ネイルキット' },
  { keyword: 'eyelash extension curler heated',         tag: '美容',                 type: 'まつ毛カーラー' },
  // アウトドア・キャンプ
  { keyword: 'LED camping lantern rechargeable foldable', tag: 'アウトドア',         type: 'キャンプランタン' },
  { keyword: 'folding camping chair portable lightweight', tag: 'アウトドア',        type: 'キャンプチェア' },
  { keyword: 'multi-tool pocket knife survival outdoor',  tag: 'アウトドア',         type: 'マルチツール' },
  { keyword: 'insulated water bottle stainless steel thermos', tag: 'アウトドア',    type: '水筒' },
  { keyword: 'camping hammock nylon outdoor ultralight',  tag: 'アウトドア',         type: 'ハンモック' },
  { keyword: 'headlamp LED rechargeable waterproof',      tag: 'アウトドア',         type: 'ヘッドランプ' },
  // カー用品
  { keyword: 'dashcam car recorder 4K dual camera',      tag: 'カー用品',            type: 'ドライブレコーダー' },
  { keyword: 'car vacuum cleaner portable handheld',      tag: 'カー用品',            type: 'カー掃除機' },
  { keyword: 'car air freshener aromatherapy vent clip',  tag: 'カー用品',            type: 'カーアロマ' },
  { keyword: 'car seat gap organizer storage pocket',     tag: 'カー用品',            type: 'カーシートポケット' },
  // キッズ・おもちゃ
  { keyword: 'building blocks LEGO compatible creative',  tag: 'キッズ',              type: 'ブロックおもちゃ' },
  { keyword: 'remote control car RC electric fast kids',  tag: 'キッズ',              type: 'ラジコンカー' },
  { keyword: 'magnetic drawing board kids educational',   tag: 'キッズ',              type: '磁気お絵かきボード' },
  { keyword: 'fidget toy sensory autism stress relief',   tag: 'キッズ',              type: 'フィジェットトイ' },
  // アート・クラフト
  { keyword: 'diamond painting kit full drill 5D DIY',    tag: 'アート・クラフト',     type: 'ダイヤモンドアート' },
  { keyword: 'resin mold silicone epoxy craft jewelry',   tag: 'アート・クラフト',     type: 'レジンモールド' },
  { keyword: 'watercolor paint set professional brush',   tag: 'アート・クラフト',     type: '水彩絵の具セット' },
  // ファッション小物
  { keyword: 'slim wallet minimalist card holder RFID',   tag: 'ファッション',         type: 'スリムウォレット' },
  { keyword: 'polarized sunglasses UV400 trendy',         tag: 'ファッション',         type: 'サングラス' },
  { keyword: 'quartz watch minimalist leather band men',  tag: 'ファッション',         type: 'クォーツ時計' },
  // 文具・オフィス
  { keyword: 'gel ink pen set colorful smooth writing',   tag: '文具',                 type: 'ゲルペンセット' },
  { keyword: 'A5 notebook journal dotted hardcover',      tag: '文具',                 type: 'ノート' },
  { keyword: 'sticky notes memo pad pastel assorted',     tag: '文具',                 type: '付箋セット' },
  // インテリア・植物
  { keyword: 'LED grow light plant indoor full spectrum', tag: 'インテリア',            type: '植物育成ライト' },
  { keyword: 'ceramic succulent planter pot minimalist',  tag: 'インテリア',            type: '植木鉢' },
  { keyword: 'neon sign LED wall decor room bedroom',     tag: 'インテリア',            type: 'ネオンサイン' },
  // 健康
  { keyword: 'pulse oximeter fingertip blood oxygen SpO2', tag: '健康',                type: 'パルスオキシメーター' },
  { keyword: 'massage ball foam roller deep tissue',       tag: '健康',                type: 'マッサージボール' },
  // 楽器
  { keyword: 'kalimba thumb piano 17 key mahogany',        tag: '楽器',                type: 'カリンバ' },
  { keyword: 'ukulele soprano beginner set tuner',          tag: '楽器',                type: 'ウクレレ' },
  { keyword: 'ocarina ceramic 12 hole flute music',         tag: '楽器',                type: 'オカリナ' },

  // ── 追加キーワード（プール拡大）────────────────────────────────────────
  // ガジェット追加
  { keyword: 'wireless sport earbuds IPX7 running',        tag: 'ガジェット',           type: 'スポーツイヤホン' },
  { keyword: 'mini drone foldable beginner camera',        tag: 'ガジェット',           type: 'ミニドローン' },
  { keyword: 'pocket thermal printer mini Bluetooth',      tag: 'ガジェット',           type: 'ポケットプリンター' },
  { keyword: 'digital photo frame WiFi cloud IPS',         tag: 'ガジェット',           type: 'デジタルフォトフレーム' },
  { keyword: 'galaxy star projector night light bedroom',  tag: 'ガジェット',           type: 'スタープロジェクター' },
  { keyword: 'electric toothbrush sonic USB rechargeable', tag: 'ガジェット',           type: '電動歯ブラシ' },
  { keyword: 'solar power bank outdoor waterproof',        tag: 'ガジェット',           type: 'ソーラーバッテリー' },
  { keyword: 'smart ring health NFC wearable',             tag: 'ガジェット',           type: 'スマートリング' },
  { keyword: 'air purifier desktop mini USB HEPA',         tag: 'ガジェット',           type: '卓上空気清浄機' },
  { keyword: 'electric hand warmer rechargeable pocket',   tag: 'ガジェット',           type: 'ハンドウォーマー' },

  // PC周辺機器追加
  { keyword: 'USB hub 7 port 3.0 compact multi',           tag: 'PC周辺機器',           type: 'USBハブ' },
  { keyword: 'drawing tablet pen graphics digital art',    tag: 'PC周辺機器',           type: 'ペンタブレット' },
  { keyword: 'ergonomic wrist rest keyboard mouse gel',    tag: 'PC周辺機器',           type: 'リストレスト' },
  { keyword: 'numeric keypad wireless USB slim',           tag: 'PC周辺機器',           type: 'テンキー' },
  { keyword: 'SD card reader USB-C micro adapter',         tag: 'PC周辺機器',           type: 'カードリーダー' },
  { keyword: 'microphone condenser USB podcast streaming', tag: 'PC周辺機器',           type: 'USBマイク' },
  { keyword: 'laptop stand foldable aluminium portable',   tag: 'PC周辺機器',           type: 'ノートPCスタンド' },
  { keyword: 'screen privacy filter anti spy laptop',      tag: 'PC周辺機器',           type: 'プライバシーフィルター' },

  // スマホアクセサリー追加
  { keyword: 'magsafe wallet card holder magnetic iPhone', tag: 'スマホアクセサリー',   type: 'マグセーフウォレット' },
  { keyword: 'phone lens kit wide macro fisheye clip',     tag: 'スマホアクセサリー',   type: 'スマホレンズキット' },
  { keyword: 'phone grip ring holder kickstand',           tag: 'スマホアクセサリー',   type: 'スマホリング' },
  { keyword: 'waterproof phone pouch bag swimming',        tag: 'スマホアクセサリー',   type: '防水スマホケース' },
  { keyword: 'tablet stand adjustable foldable desk',      tag: 'スマホアクセサリー',   type: 'タブレットスタンド' },
  { keyword: 'portable charger 10000mah slim lightweight', tag: 'スマホアクセサリー',   type: 'スリムバッテリー' },

  // スマートホーム追加
  { keyword: 'smart bulb E27 RGB WiFi color',              tag: 'スマートホーム',       type: 'スマート電球' },
  { keyword: 'mini WiFi security camera indoor 1080p',     tag: 'スマートホーム',       type: '防犯カメラ' },
  { keyword: 'smart temperature humidity sensor display',  tag: 'スマートホーム',       type: '温湿度計' },
  { keyword: 'smart IR remote control hub universal',      tag: 'スマートホーム',       type: '赤外線リモコン' },
  { keyword: 'robot vacuum cleaner mini automatic floor',  tag: 'スマートホーム',       type: 'ロボット掃除機' },
  { keyword: 'wireless doorbell smart video camera',       tag: 'スマートホーム',       type: 'スマートドアベル' },

  // プロジェクター追加
  { keyword: 'portable projector 1080p WiFi Android TV',  tag: 'プロジェクター',       type: 'Androidプロジェクター' },
  { keyword: 'mini projector pocket LED battery built-in', tag: 'プロジェクター',       type: 'バッテリー内蔵プロジェクター' },
  { keyword: 'home cinema projector 4K support HDR',       tag: 'プロジェクター',       type: 'ホームシネマプロジェクター' },

  // フィットネス追加
  { keyword: 'ab roller wheel core abdominal workout',     tag: 'フィットネス',         type: 'アブローラー' },
  { keyword: 'foam roller muscle recovery deep tissue',    tag: 'フィットネス',         type: 'フォームローラー' },
  { keyword: 'pull up bar doorframe home gym',             tag: 'フィットネス',         type: '懸垂バー' },
  { keyword: 'push up board rotating handles training',    tag: 'フィットネス',         type: 'プッシュアップボード' },
  { keyword: 'adjustable ankle wrist weights training',    tag: 'フィットネス',         type: 'アンクルウェイト' },
  { keyword: 'balance board wobble fitness trainer',       tag: 'フィットネス',         type: 'バランスボード' },
  { keyword: 'mini pedal exerciser desk cycling legs',     tag: 'フィットネス',         type: 'ペダルエクサ' },
  { keyword: 'gymnastics wheel balance yoga exercise',     tag: 'フィットネス',         type: 'ヨガホイール' },

  // キッチン追加
  { keyword: 'electric milk frother handheld coffee latte',tag: 'キッチン',             type: 'ミルクフォーマー' },
  { keyword: 'mini waffle maker electric non stick',       tag: 'キッチン',             type: 'ワッフルメーカー' },
  { keyword: 'digital meat thermometer instant BBQ probe', tag: 'キッチン',             type: '料理用温度計' },
  { keyword: 'oil sprayer mister bottle kitchen cooking',  tag: 'キッチン',             type: 'オイルスプレー' },
  { keyword: 'reusable silicone storage bags ziplock',     tag: 'キッチン',             type: 'シリコン保存袋' },
  { keyword: 'mandoline slicer vegetable cutter adjustable',tag: 'キッチン',            type: '野菜スライサー' },
  { keyword: 'cold brew coffee maker glass pitcher',       tag: 'キッチン',             type: 'コールドブリュー' },
  { keyword: 'spice rack organizer rotating lazy susan',   tag: 'キッチン',             type: 'スパイスラック' },

  // ボードゲーム追加
  { keyword: 'speed cube 3x3 magnetic Rubik puzzle',       tag: 'ボードゲーム',         type: 'スピードキューブ' },
  { keyword: 'playing cards waterproof plastic poker',     tag: 'ボードゲーム',         type: 'トランプ' },
  { keyword: 'mahjong set portable travel tiles',          tag: 'ボードゲーム',         type: '麻雀セット' },
  { keyword: 'party game adults drinking fun',             tag: 'ボードゲーム',         type: 'パーティーゲーム' },
  { keyword: 'domino set classic double tiles wooden',     tag: 'ボードゲーム',         type: 'ドミノセット' },
  { keyword: 'magnetic chess mini travel set folding',     tag: 'ボードゲーム',         type: 'マグネットチェス' },

  // トラベル追加
  { keyword: 'travel neck pillow memory foam support',     tag: 'トラベル',             type: 'ネックピロー' },
  { keyword: 'passport holder RFID wallet travel',         tag: 'トラベル',             type: 'パスポートケース' },
  { keyword: 'luggage scale digital portable weight',      tag: 'トラベル',             type: '荷物スケール' },
  { keyword: 'travel toiletry bag waterproof organizer',   tag: 'トラベル',             type: 'トイレタリーバッグ' },
  { keyword: 'sleep eye mask blackout travel rest',        tag: 'トラベル',             type: 'アイマスク' },
  { keyword: 'foldable travel duffel bag lightweight',     tag: 'トラベル',             type: '折りたたみバッグ' },

  // ペット追加
  { keyword: 'cat interactive toy automatic laser',        tag: 'ペット',               type: '猫用自動おもちゃ' },
  { keyword: 'dog harness vest reflective no pull',        tag: 'ペット',               type: 'ドッグハーネス' },
  { keyword: 'pet water fountain automatic filter cat',    tag: 'ペット',               type: 'ペット給水器' },
  { keyword: 'cat litter mat waterproof trapping',         tag: 'ペット',               type: 'トイレマット' },
  { keyword: 'pet nail grinder trimmer quiet electric',    tag: 'ペット',               type: 'ペット爪グラインダー' },
  { keyword: 'dog puzzle toy slow feeder enrichment',      tag: 'ペット',               type: '犬用知育玩具' },

  // アウトドア追加
  { keyword: 'trekking poles collapsible lightweight pair',tag: 'アウトドア',           type: 'トレッキングポール' },
  { keyword: 'waterproof dry bag swimming beach roll top', tag: 'アウトドア',           type: '防水ドライバッグ' },
  { keyword: 'fire starter flint steel striker survival', tag: 'アウトドア',           type: 'ファイヤースターター' },
  { keyword: 'monocular telescope compact high power zoom',tag: 'アウトドア',           type: '単眼鏡' },
  { keyword: 'camping cookware set lightweight pot pan',   tag: 'アウトドア',           type: 'キャンプ調理器具' },
  { keyword: 'fishing lure set spinner bait tackle',       tag: 'アウトドア',           type: '釣りルアーセット' },
  { keyword: 'portable camping stove gas burner outdoor',  tag: 'アウトドア',           type: 'キャンプストーブ' },
  { keyword: 'emergency mylar blanket thermal survival',   tag: 'アウトドア',           type: '緊急ブランケット' },

  // カー用品追加
  { keyword: 'car phone holder windshield suction magnetic',tag: 'カー用品',            type: 'カーフォンホルダー' },
  { keyword: 'car trunk organizer storage collapsible',    tag: 'カー用品',             type: 'トランクオーガナイザー' },
  { keyword: 'tire pressure gauge digital LCD car',        tag: 'カー用品',             type: 'タイヤ圧力計' },
  { keyword: 'windshield sunshade reflective foldable',    tag: 'カー用品',             type: 'サンシェード' },
  { keyword: 'car seat cushion lumbar support memory foam',tag: 'カー用品',             type: 'シートクッション' },
  { keyword: 'car emergency jump starter portable 12V',    tag: 'カー用品',             type: 'ジャンプスターター' },

  // キッズ追加
  { keyword: 'kinetic sand mold set colorful play dough', tag: 'キッズ',               type: 'カラーサンド' },
  { keyword: 'walkie talkie kids set outdoor long range',  tag: 'キッズ',               type: 'キッズトランシーバー' },
  { keyword: 'slime kit DIY glitter activator children',   tag: 'キッズ',               type: 'スライムキット' },
  { keyword: 'pop it fidget bubble push toy kids',         tag: 'キッズ',               type: 'プッシュポップ' },
  { keyword: 'star projector kids night light galaxy',     tag: 'キッズ',               type: '子供用プロジェクター' },
  { keyword: 'wooden montessori puzzle educational kids',  tag: 'キッズ',               type: 'モンテッソーリ玩具' },

  // アート・クラフト追加
  { keyword: 'acrylic paint set 24 colors artist canvas',  tag: 'アート・クラフト',     type: 'アクリル絵の具' },
  { keyword: 'cross stitch kit beginner counted pattern',   tag: 'アート・クラフト',     type: 'クロスステッチキット' },
  { keyword: 'calligraphy brush pen set hand lettering',    tag: 'アート・クラフト',     type: 'カリグラフィーペン' },
  { keyword: 'macrame cord cotton rope DIY wall art',       tag: 'アート・クラフト',     type: 'マクラメコード' },
  { keyword: 'origami paper set colorful pattern folding',  tag: 'アート・クラフト',     type: '折り紙セット' },

  // 文具追加
  { keyword: 'washi tape set decorative masking journal',   tag: '文具',                 type: 'マスキングテープ' },
  { keyword: 'fountain pen calligraphy smooth ink',         tag: '文具',                 type: '万年筆' },
  { keyword: 'highlighter set pastel dual tip marker',      tag: '文具',                 type: '蛍光ペンセット' },
  { keyword: 'weekly planner organizer undated notebook',   tag: '文具',                 type: 'プランナー手帳' },
  { keyword: 'mechanical pencil set 0.5mm drafting',        tag: '文具',                 type: 'シャープペンシルセット' },
  { keyword: 'desk organizer pen holder wood bamboo',       tag: '文具',                 type: 'デスクオーガナイザー' },

  // インテリア追加
  { keyword: 'fairy lights string LED warm bedroom decor',  tag: 'インテリア',           type: 'フェアリーライト' },
  { keyword: 'aromatherapy diffuser ultrasonic mist wood',  tag: 'インテリア',           type: 'アロマディフューザー' },
  { keyword: 'floating wall shelf display wood bracket',    tag: 'インテリア',           type: 'ウォールシェルフ' },
  { keyword: 'macrame wall hanging boho handmade decor',    tag: 'インテリア',           type: 'マクラメ壁飾り' },
  { keyword: 'candle holder decorative glass geometric',    tag: 'インテリア',           type: 'キャンドルホルダー' },
  { keyword: 'photo frame collage multi display wall',      tag: 'インテリア',           type: 'フォトフレーム' },

  // 健康追加
  { keyword: 'acupressure mat spike pillow back neck pain', tag: '健康',                 type: '鍼灸マット' },
  { keyword: 'eye massager heated vibration fatigue USB',   tag: '健康',                 type: 'アイマッサージャー' },
  { keyword: 'posture corrector back brace support belt',   tag: '健康',                 type: '姿勢矯正ベルト' },
  { keyword: 'neck massager electric pulse shoulder',       tag: '健康',                 type: '首肩マッサージャー' },
  { keyword: 'compression knee sleeve support brace sport', tag: '健康',                 type: 'サポーター' },

  // ── シール・トレンド ──────────────────────────────────────────────────
  // シール・ステッカー
  { keyword: 'sticker pack cute aesthetic decoration journal', tag: '文具',              type: 'シールセット' },
  { keyword: 'holographic sticker DIY laptop bottle',          tag: '文具',              type: 'ホログラムシール' },
  { keyword: 'washi sticker flake seal scrapbook',             tag: '文具',              type: 'フレークシール' },

  // トレンド・バイラル商品
  { keyword: 'Stanley tumbler insulated cup with handle',    tag: 'トラベル',             type: 'スタンレー型タンブラー' },
  { keyword: 'cable bite accessory cute animal charger',     tag: 'スマホアクセサリー',   type: 'ケーブルバイト' },
  { keyword: 'magnetic building tiles kids STEM education',  tag: 'キッズ',               type: 'マグネットブロック' },
  { keyword: 'mini keyboard wireless compact bluetooth',     tag: 'PC周辺機器',           type: 'コンパクトキーボード' },
  { keyword: 'transparent phone case aesthetic flower',      tag: 'スマホアクセサリー',   type: 'クリアスマホケース' },
  { keyword: 'sanrio inspired accessories cute character',   tag: 'スマホアクセサリー',   type: 'キャラクターグッズ' },
  { keyword: 'aesthetic desk setup accessories organizer',   tag: 'インテリア',           type: 'デスクアクセサリー' },
  { keyword: 'mini humidifier USB desktop quiet mist',       tag: 'ガジェット',           type: 'ミニ加湿器' },
  { keyword: 'portable blender mini USB smoothie cup',       tag: 'キッチン',             type: 'ポータブルブレンダー' },
  { keyword: 'sunset lamp projector LED rainbow prism',      tag: 'インテリア',           type: 'サンセットランプ' },
];

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function callApi(method, extra) {
  const params = { app_key: APP_KEY, method, sign_method: 'sha256', timestamp: String(Date.now()), ...extra };
  params.sign = sign(params);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastClaudeCall = 0;

async function generateShortTitle(title) {
  // レート制限対策: 1.5秒間隔を保つ
  const now = Date.now();
  const wait = 1500 - (now - lastClaudeCall);
  if (wait > 0) await sleep(wait);
  lastClaudeCall = Date.now();

  const client = new Anthropic({ apiKey: CLAUDE_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [{ role: 'user', content: `以下のAliExpress商品名を、日本語で20文字以内の簡潔な商品名に変換してください。ブランド名・製品番号があれば残し、スペック詳細・色・個数などは省略してください。商品名だけを出力し、説明や記号は一切不要です。\n\n商品名: ${title}` }]
  });
  return msg.content[0].text.trim();
}

// ── メイン ──────────────────────────────────────────────────
const existing    = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const existingIds = new Set(existing.map(p => String(p.product_id)));

let totalAdded = 0;

for (let i = 0; i < KEYWORD_LIST.length; i++) {
  const { keyword, tag, type } = KEYWORD_LIST[i];
  console.log(`\n[${i + 1}/${KEYWORD_LIST.length}] 「${keyword}」(${type}) 取得中...`);

  const json = await callApi('aliexpress.affiliate.product.query', {
    tracking_id: TRACKING_ID,
    keywords: keyword,
    target_currency: 'JPY',
    target_language: 'JA',
    page_size: '50',
    fields: 'product_id,product_title,target_sale_price,original_price,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume,commission_rate',
  });

  const raw = json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
  let added = 0;

  for (const p of raw) {
    const id = String(p.product_id);
    if (existingIds.has(id)) continue;

    const product = {
      product_id:          id,
      title:               p.product_title,
      title_short:         null,
      price_jpy:           p.target_sale_price,
      original_price_jpy:  p.original_price,
      image_url:           p.product_main_image_url,
      affiliate_link:      p.product_detail_url,
      evaluate_rate:       p.evaluate_rate,
      sales_count:         p.lastest_volume,
      commission_rate:     p.commission_rate ?? null,
      product_type:        type,
      keyword,
      tag,
      fetched_at:          new Date().toISOString(),
      description_ja:      null,
    };

    if (CLAUDE_KEY) {
      product.title_short = await generateShortTitle(p.product_title);
      process.stdout.write(` → ${product.title_short}`);
    }

    existing.push(product);
    existingIds.add(id);
    added++;
    totalAdded++;
    process.stdout.write('\n');
  }

  console.log(`  ✅ ${added}件追加（スキップ: ${raw.length - added}件）`);

  // 5キーワードごとに中間保存
  if ((i + 1) % 5 === 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`  💾 中間保存: 合計 ${existing.length}件`);
  }

  await new Promise(r => setTimeout(r, 600));
}

fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), 'utf8');
console.log(`\n✅ 完了: ${totalAdded}件追加（合計 ${existing.length}件）`);
