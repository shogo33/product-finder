import fs from 'node:fs';

const JP_FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const AE_FILE = 'data/ugreen/aliexpress-store-catalog.json';
const OUT_JSON = 'data/ugreen/ugreen-aliexpress-matches.json';

// Order matters: longer/more-specific names first
const SERIES = [
  'Nexode Pro', 'Nexode Air', 'Nexode Mini', 'Nexode',
  'Revodok Pro', 'Revodok',
  'MagFlow Air', 'MagFlow',
  'Uno', 'Maxidok', 'DigiNest Pro', 'DigiNest', 'PowerRoam',
];

function lc(s) { return (s || '').toLowerCase(); }

function extractWatts(s) {
  const set = new Set();
  const re = /(\d{2,4})\s*[Ww](?![a-z])/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const v = parseInt(m[1], 10);
    if (v >= 5 && v <= 3000) set.add(v);
  }
  return set;
}

function extractMah(s) {
  const set = new Set();
  const re = /(\d{4,6})\s*mAh/gi;
  let m;
  while ((m = re.exec(s)) !== null) set.add(parseInt(m[1], 10));
  return set;
}

function extractInY(s) {
  const set = new Set();
  const re = /(\d{1,2})\s*[-\s]?in[-\s]?(\d{1,2})/gi;
  let m;
  while ((m = re.exec(s)) !== null) set.add(`${m[1]}-in-${m[2]}`);
  return set;
}

function extractSeries(s) {
  const found = new Set();
  const lower = lc(s);
  for (const ser of SERIES) {
    if (lower.includes(lc(ser))) {
      found.add(ser);
      // Once we match a longer name like "Nexode Pro", strip it so we don't double-count "Nexode"
      // (handled by ordering + early return per pass)
    }
  }
  // If both "Nexode Pro" and "Nexode" matched, keep only the more specific
  if (found.has('Nexode Pro') || found.has('Nexode Air') || found.has('Nexode Mini')) found.delete('Nexode');
  if (found.has('Revodok Pro')) found.delete('Revodok');
  if (found.has('MagFlow Air')) found.delete('MagFlow');
  if (found.has('DigiNest Pro')) found.delete('DigiNest');
  return found;
}

function extractCableLength(s) {
  const set = new Set();
  const re = /(\d+(?:\.\d+)?)\s*m\b/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const v = parseFloat(m[1]);
    if (v >= 0.5 && v <= 5) set.add(v);
  }
  return set;
}

function hasAny(s, words) {
  const t = lc(s);
  return words.some((w) => t.includes(lc(w)));
}

function categoryOf(text) {
  // Order matters: more specific first. "モバイルバッテリー" beats "MagSafe" beats "ワイヤレス".
  if (hasAny(text, ['ポータブル電源', 'power station', 'powerroam'])) return 'station';
  if (hasAny(text, ['ソーラー', 'solar panel'])) return 'solar';
  if (hasAny(text, ['sdカードリーダー', 'sdカード リーダー', 'card reader'])) return 'sdreader';
  if (hasAny(text, ['カーチャージャー', 'car charger', '車載'])) return 'carcharger';
  if (hasAny(text, ['モバイルバッテリー', 'power bank', 'powerbank', 'mobile battery'])) return 'powerbank';
  if (hasAny(text, ['ハブ', 'usb hub', ' hub ', 'ドッキングステーション', 'docking station', ' dock ', 'thunderbolt'])) return 'hub';
  if (hasAny(text, ['ワイヤレス充電', 'wireless charger', 'wireless charging', 'magsafe', 'qi2', 'qi充電'])) return 'wireless';
  if (hasAny(text, ['ケーブル', 'cable']) && !hasAny(text, ['ケーブル内蔵', 'with cable', '巻き取り'])) return 'cable';
  if (hasAny(text, ['充電器', 'チャージャー', 'charger'])) return 'charger';
  return 'other';
}

function isGenshin(text) {
  const t = lc(text);
  return t.includes('原神') || t.includes('genshin');
}

function score(jp, ae) {
  const jpFull = `${jp.title} ${jp.metaDescription || ''} ${Object.entries(jp.specs || {}).map(([k, v]) => k + ':' + v).join(' ')}`;
  const aeTitle = ae.product_title || '';

  const jpW = extractWatts(jpFull);
  const aeW = extractWatts(aeTitle);
  const jpMah = extractMah(jpFull);
  const aeMah = extractMah(aeTitle);
  const jpIn = extractInY(jpFull);
  const aeIn = extractInY(aeTitle);
  const jpSer = extractSeries(jpFull);
  const aeSer = extractSeries(aeTitle);
  const jpLen = extractCableLength(jp.title || '');
  const aeLen = extractCableLength(aeTitle);

  const jpCat = categoryOf(jp.title + ' ' + (jp.productType || ''));
  const aeCat = categoryOf(aeTitle);

  let s = 0;
  const reasons = [];

  // === Hard gate: category mismatch is a deal-breaker ===
  if (jpCat !== 'other' && aeCat !== 'other' && jpCat !== aeCat) {
    return { score: -100, reasons: [`!cat:${jpCat}vs${aeCat}`], category: { jp: jpCat, ae: aeCat } };
  }
  if (jpCat !== 'other' && aeCat === 'other') {
    // JP has clear cat but AE is "other" -- likely unrelated. Soft penalty.
    s -= 15;
    reasons.push(`?cat(ae:other)`);
  }
  if (jpCat !== 'other' && aeCat === jpCat) {
    s += 20;
    reasons.push(`cat:${jpCat}`);
  }

  // === Wattage match (with multi-watt listing detection) ===
  // If AE lists 3+ different watts (like "45W/30W/25W/20W"), it's a multi-variant listing -- cap score
  const aeWattCount = aeW.size;
  const wMatched = [...jpW].filter((w) => aeW.has(w));
  if (wMatched.length > 0) {
    if (aeWattCount >= 3) {
      s += 5; // weak match — generic multi-watt listing
      reasons.push(`W(weak):${wMatched.join(',')}`);
    } else {
      s += 35;
      reasons.push(`W:${wMatched.join(',')}`);
    }
  } else if (jpW.size > 0 && aeW.size > 0) {
    s -= 25;
    reasons.push(`!W:jp=${[...jpW].join(',')}vs.ae=${[...aeW].join(',')}`);
  }

  // === mAh capacity ===
  const mMatched = [...jpMah].filter((v) => aeMah.has(v));
  if (mMatched.length > 0) {
    s += 40;
    reasons.push(`mAh:${mMatched.join(',')}`);
  } else if (jpMah.size > 0 && aeMah.size > 0) {
    s -= 25;
    reasons.push(`!mAh`);
  }

  // === X-in-Y ===
  const inMatched = [...jpIn].filter((v) => aeIn.has(v));
  if (inMatched.length > 0) {
    s += 35;
    reasons.push(`inY:${inMatched.join(',')}`);
  } else if (jpIn.size > 0 && aeIn.size > 0) {
    s -= 25;
    reasons.push(`!inY`);
  }

  // === Series ===
  const sMatched = [...jpSer].filter((v) => aeSer.has(v));
  if (sMatched.length > 0) {
    s += 30;
    reasons.push(`ser:${sMatched.join(',')}`);
  } else if (jpSer.size > 0 && aeSer.size > 0) {
    // Both have series but different — that's a mismatch (e.g., Nexode Pro vs Uno)
    s -= 25;
    reasons.push(`!ser`);
  }

  // === Cable length ===
  const lMatched = [...jpLen].filter((v) => aeLen.has(v));
  if (lMatched.length > 0) {
    s += 10;
    reasons.push(`len:${lMatched.join('m,')}m`);
  }

  // === Genshin Impact special handling ===
  // JP Genshin product must match Genshin AE product (and vice versa)
  const jpGenshin = isGenshin(jpFull);
  const aeGenshin = isGenshin(aeTitle);
  if (jpGenshin && !aeGenshin) {
    s -= 50;
    reasons.push(`!genshin(jp-only)`);
  } else if (!jpGenshin && aeGenshin) {
    s -= 50;
    reasons.push(`!genshin(ae-only)`);
  } else if (jpGenshin && aeGenshin) {
    s += 40;
    reasons.push(`genshin`);
  }

  return { score: s, reasons, category: { jp: jpCat, ae: aeCat } };
}

function main() {
  const jpProducts = JSON.parse(fs.readFileSync(JP_FILE, 'utf8'));
  const aeProducts = JSON.parse(fs.readFileSync(AE_FILE, 'utf8'));

  console.log(`JP: ${jpProducts.length}, AE catalog: ${aeProducts.length}\n`);

  const HIGH = 90;
  const MEDIUM = 50;

  const matches = jpProducts.map((jp) => {
    const scored = aeProducts.map((ae) => {
      const r = score(jp, ae);
      return { ae, ...r };
    }).sort((a, b) => b.score - a.score);

    const top = scored[0];
    const runner = scored[1];

    let confidence;
    if (top.score >= HIGH) confidence = 'high';
    else if (top.score >= MEDIUM) confidence = 'medium';
    else confidence = 'low';

    return {
      handle: jp.handle,
      jpTitle: jp.title,
      jpCategory: top.category?.jp,
      bestMatch: confidence === 'low' ? null : {
        product_id: top.ae.product_id,
        title: top.ae.product_title,
        url: top.ae.product_detail_url,
        promotion_link: top.ae.promotion_link,
        score: top.score,
        reasons: top.reasons,
      },
      confidence,
      runnerUp: confidence !== 'low' && runner ? {
        title: runner.ae.product_title?.slice(0, 100),
        score: runner.score,
      } : null,
    };
  });

  fs.writeFileSync(OUT_JSON, JSON.stringify(matches, null, 2));

  const counts = { high: 0, medium: 0, low: 0 };
  matches.forEach((m) => counts[m.confidence]++);
  console.log('=== Confidence breakdown ===');
  console.log(`  high  : ${counts.high} (score>=${HIGH})`);
  console.log(`  medium: ${counts.medium} (score>=${MEDIUM})`);
  console.log(`  low   : ${counts.low} (no match assigned)`);
  console.log(`\nSaved to ${OUT_JSON}`);

  console.log('\n=== HIGH matches ===');
  matches.filter((m) => m.confidence === 'high').forEach((m) => {
    console.log(`\n[${m.bestMatch.score}] ${m.handle}`);
    console.log(`  JP: ${m.jpTitle.slice(0, 90)}`);
    console.log(`  AE: ${m.bestMatch.title.slice(0, 90)}`);
    console.log(`  ${m.bestMatch.reasons.join(' | ')}`);
  });

  console.log('\n=== MEDIUM matches (first 15) ===');
  matches.filter((m) => m.confidence === 'medium').slice(0, 15).forEach((m) => {
    console.log(`\n[${m.bestMatch.score}] ${m.handle}`);
    console.log(`  JP: ${m.jpTitle.slice(0, 90)}`);
    console.log(`  AE: ${m.bestMatch.title.slice(0, 90)}`);
    console.log(`  ${m.bestMatch.reasons.join(' | ')}`);
  });

  console.log('\n=== Sample LOW (no match) ===');
  matches.filter((m) => m.confidence === 'low').slice(0, 10).forEach((m) => {
    console.log(` - [${m.jpCategory}] ${m.handle} | ${m.jpTitle.slice(0, 70)}`);
  });
}

main();
