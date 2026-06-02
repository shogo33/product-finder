import fs from 'node:fs';

const JP_FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const AMZ_FILE = 'data/ugreen/amazon-ugreen-catalog.json';
const AE_FILE = 'data/ugreen/aliexpress-store-catalog.json';
const ASIN_FILE = 'data/ugreen/ugreen-asin-list.json';
const OUT_JSON = 'data/ugreen/ugreen-aliexpress-matches.json';

const SERIES = [
  'Nexode Pro', 'Nexode Air', 'Nexode Mini', 'Nexode',
  'Revodok Pro', 'Revodok',
  'MagFlow Air', 'MagFlow',
  'Uno', 'Maxidok', 'DigiNest Pro', 'DigiNest', 'PowerRoam',
];

function lc(s) { return (s || '').toLowerCase(); }

function extractWatts(s) {
  const set = new Set();
  // Handle comma-separated thousands like "145 W", "25,000 mAh"
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
  // Amazon English titles use "25,000 mAh" — strip commas
  const cleaned = s.replace(/(\d),(\d)/g, '$1$2');
  const re = /(\d{4,6})\s*mAh/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) set.add(parseInt(m[1], 10));
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
    if (lower.includes(lc(ser))) found.add(ser);
  }
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

function extractPortCount(s) {
  // "3 Port", "3-port", "5ポート", "5 ポート"
  const set = new Set();
  const re = /(\d{1,2})\s*[-\s]?(?:port|ポート)/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const v = parseInt(m[1], 10);
    if (v >= 1 && v <= 20) set.add(v);
  }
  return set;
}

function hasAny(s, words) {
  const t = lc(s);
  return words.some((w) => t.includes(lc(w)));
}

function categoryOf(text) {
  if (hasAny(text, ['ポータブル電源', 'power station', 'powerroam'])) return 'station';
  if (hasAny(text, ['ソーラー', 'solar panel'])) return 'solar';
  if (hasAny(text, ['sdカードリーダー', 'sdカード リーダー', 'card reader'])) return 'sdreader';
  if (hasAny(text, ['カーチャージャー', 'car charger', '車載', 'cigarette socket'])) return 'carcharger';
  if (hasAny(text, ['モバイルバッテリー', 'power bank', 'powerbank', 'mobile battery'])) return 'powerbank';
  if (hasAny(text, ['ハブ', 'usb hub', ' hub ', 'ドッキングステーション', 'docking station', ' dock ', 'thunderbolt'])) return 'hub';
  if (hasAny(text, ['ワイヤレス充電', 'wireless charger', 'wireless charging', 'magsafe', 'qi2', 'qi充電'])) return 'wireless';
  if (hasAny(text, ['ケーブル', 'cable']) && !hasAny(text, ['ケーブル内蔵', 'with cable', '巻き取り', 'retractable'])) return 'cable';
  if (hasAny(text, ['充電器', 'チャージャー', 'charger'])) return 'charger';
  return 'other';
}

function isGenshin(text) {
  return /原神|genshin/i.test(text);
}

function buildJpSignature(jp, amzData) {
  // Combine JP text + Amazon details (title, features, attributes)
  const parts = [jp.title, jp.metaDescription || ''];
  if (jp.specs) {
    Object.entries(jp.specs).forEach(([k, v]) => parts.push(`${k}:${v}`));
  }
  if (amzData) {
    parts.push(amzData.title || '');
    parts.push((amzData.features || []).join(' '));
    parts.push(amzData.description || '');
    if (amzData.attributes) {
      amzData.attributes.forEach((a) => parts.push(`${a.key}:${a.value}`));
    }
    if (amzData.productOverview) {
      amzData.productOverview.forEach((o) => parts.push(`${o.key}:${o.value}`));
    }
  }
  return parts.join(' \n ');
}

function score(jpSig, jp, ae) {
  const aeTitle = ae.product_title || '';

  const jpW = extractWatts(jpSig);
  const aeW = extractWatts(aeTitle);
  const jpMah = extractMah(jpSig);
  const aeMah = extractMah(aeTitle);
  const jpIn = extractInY(jpSig);
  const aeIn = extractInY(aeTitle);
  const jpSer = extractSeries(jpSig);
  const aeSer = extractSeries(aeTitle);
  const jpLen = extractCableLength(jp.title || '');
  const aeLen = extractCableLength(aeTitle);
  const jpPorts = extractPortCount(jpSig);
  const aePorts = extractPortCount(aeTitle);

  const jpCat = categoryOf(jp.title + ' ' + (jp.productType || ''));
  const aeCat = categoryOf(aeTitle);

  let s = 0;
  const reasons = [];

  // Hard gate
  if (jpCat !== 'other' && aeCat !== 'other' && jpCat !== aeCat) {
    return { score: -100, reasons: [`!cat:${jpCat}vs${aeCat}`], category: { jp: jpCat, ae: aeCat } };
  }
  if (jpCat !== 'other' && aeCat === 'other') {
    s -= 15;
    reasons.push(`?cat(ae:other)`);
  }
  if (jpCat !== 'other' && aeCat === jpCat) {
    s += 20;
    reasons.push(`cat:${jpCat}`);
  }

  // Watts
  const aeWattCount = aeW.size;
  const wMatched = [...jpW].filter((w) => aeW.has(w));
  if (wMatched.length > 0) {
    if (aeWattCount >= 3) { s += 5; reasons.push(`W(weak):${wMatched.join(',')}`); }
    else { s += 35; reasons.push(`W:${wMatched.join(',')}`); }
  } else if (jpW.size > 0 && aeW.size > 0) {
    s -= 25;
    reasons.push(`!W`);
  }

  // mAh — biggest discriminator for power banks
  const mMatched = [...jpMah].filter((v) => aeMah.has(v));
  if (mMatched.length > 0) {
    s += 50;
    reasons.push(`mAh:${mMatched.join(',')}`);
  } else if (jpMah.size > 0 && aeMah.size > 0) {
    s -= 30;
    reasons.push(`!mAh:jp=${[...jpMah].join(',')}vs${[...aeMah].join(',')}`);
  }

  // X-in-Y
  const inMatched = [...jpIn].filter((v) => aeIn.has(v));
  if (inMatched.length > 0) {
    s += 35;
    reasons.push(`inY:${inMatched.join(',')}`);
  } else if (jpIn.size > 0 && aeIn.size > 0) {
    s -= 25;
    reasons.push(`!inY`);
  }

  // Series
  const sMatched = [...jpSer].filter((v) => aeSer.has(v));
  if (sMatched.length > 0) {
    s += 30;
    reasons.push(`ser:${sMatched.join(',')}`);
  } else if (jpSer.size > 0 && aeSer.size > 0) {
    s -= 25;
    reasons.push(`!ser`);
  }

  // Cable length
  const lMatched = [...jpLen].filter((v) => aeLen.has(v));
  if (lMatched.length > 0) {
    s += 10;
    reasons.push(`len:${lMatched.join('m,')}m`);
  }

  // Port count (Amazon English gives us "3 Port" cleanly)
  const pMatched = [...jpPorts].filter((v) => aePorts.has(v));
  if (pMatched.length > 0) {
    s += 15;
    reasons.push(`ports:${pMatched.join(',')}`);
  }

  // Genshin
  const jpGenshin = isGenshin(jpSig);
  const aeGenshin = isGenshin(aeTitle);
  if (jpGenshin && !aeGenshin) { s -= 50; reasons.push(`!genshin(jp-only)`); }
  else if (!jpGenshin && aeGenshin) { s -= 50; reasons.push(`!genshin(ae-only)`); }
  else if (jpGenshin && aeGenshin) { s += 40; reasons.push(`genshin`); }

  return { score: s, reasons, category: { jp: jpCat, ae: aeCat } };
}

function main() {
  const jpProducts = JSON.parse(fs.readFileSync(JP_FILE, 'utf8'));
  const amzProducts = JSON.parse(fs.readFileSync(AMZ_FILE, 'utf8'));
  const aeProducts = JSON.parse(fs.readFileSync(AE_FILE, 'utf8'));
  const asinList = JSON.parse(fs.readFileSync(ASIN_FILE, 'utf8'));

  // Map handle → ASIN → Amazon data
  const asinByHandle = new Map(asinList.map((a) => [a.handle, a.asin]));
  const amzByAsin = new Map(amzProducts.map((p) => [p.asin, p]));

  console.log(`JP: ${jpProducts.length}, AE catalog: ${aeProducts.length}, Amazon UGREEN: ${amzProducts.length}`);
  const withAmazon = jpProducts.filter((jp) => amzByAsin.has(asinByHandle.get(jp.handle))).length;
  console.log(`JP products enriched with Amazon data: ${withAmazon}\n`);

  const HIGH = 85;
  const MEDIUM = 50;

  // Step 1: For each JP product, compute scored list against all AE candidates
  const candidates = jpProducts.map((jp) => {
    const asin = asinByHandle.get(jp.handle);
    const amzData = asin ? amzByAsin.get(asin) : null;
    const jpSig = buildJpSignature(jp, amzData);
    const scored = aeProducts.map((ae) => {
      const r = score(jpSig, jp, ae);
      return { ae, ...r };
    }).filter((s) => s.score >= MEDIUM).sort((a, b) => b.score - a.score);
    return {
      jp,
      asin,
      amzData,
      jpCategory: scored[0]?.category?.jp || 'other',
      scored,
    };
  });

  // Step 2: Greedy 1-to-1 assignment, highest-score first
  const pairs = [];
  candidates.forEach((c) => {
    c.scored.forEach((s) => {
      pairs.push({ jpHandle: c.jp.handle, aePid: String(s.ae.product_id), score: s.score, reasons: s.reasons, ae: s.ae });
    });
  });
  pairs.sort((a, b) => b.score - a.score);

  const usedJp = new Set();
  const usedAe = new Set();
  const assigned = new Map(); // jpHandle -> chosen pair

  for (const p of pairs) {
    if (usedJp.has(p.jpHandle) || usedAe.has(p.aePid)) continue;
    usedJp.add(p.jpHandle);
    usedAe.add(p.aePid);
    assigned.set(p.jpHandle, p);
  }

  // Step 3: Build final match list
  const matches = candidates.map((c) => {
    const chosen = assigned.get(c.jp.handle);
    let confidence = 'low';
    if (chosen) {
      if (chosen.score >= HIGH) confidence = 'high';
      else if (chosen.score >= MEDIUM) confidence = 'medium';
    }
    return {
      handle: c.jp.handle,
      jpTitle: c.jp.title,
      jpCategory: c.jpCategory,
      asin: c.asin || null,
      amazonEnglishTitle: c.amzData?.title || null,
      bestMatch: chosen ? {
        product_id: chosen.ae.product_id,
        title: chosen.ae.product_title,
        url: chosen.ae.product_detail_url,
        promotion_link: chosen.ae.promotion_link,
        score: chosen.score,
        reasons: chosen.reasons,
      } : null,
      confidence,
      alternativesConsidered: c.scored.length,
    };
  });

  fs.writeFileSync(OUT_JSON, JSON.stringify(matches, null, 2));

  const counts = { high: 0, medium: 0, low: 0 };
  matches.forEach((m) => counts[m.confidence]++);
  console.log('=== Confidence breakdown ===');
  console.log(`  high  : ${counts.high} (score>=${HIGH})`);
  console.log(`  medium: ${counts.medium} (score>=${MEDIUM})`);
  console.log(`  low   : ${counts.low}`);
  console.log(`\nSaved to ${OUT_JSON}`);

  console.log('\n=== HIGH matches ===');
  matches.filter((m) => m.confidence === 'high').forEach((m) => {
    console.log(`\n[${m.bestMatch.score}] ${m.handle}`);
    console.log(`  JP: ${m.jpTitle.slice(0, 80)}`);
    if (m.amazonEnglishTitle) console.log(`  AMZ: ${m.amazonEnglishTitle.slice(0, 80)}`);
    console.log(`  AE: ${m.bestMatch.title.slice(0, 80)}`);
    console.log(`  ${m.bestMatch.reasons.join(' | ')}`);
  });
}

main();
