import fs from 'fs';

function checkFile(f) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  let vsLine = -1, veLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('VOICE-START') && vsLine === -1) vsLine = i;
    if (lines[i].includes('VOICE-END') && veLine === -1) veLine = i;
  }
  if (vsLine === -1) { console.log(f + ': no VOICE section'); return; }

  let depthBefore = 0;
  for (let i = 0; i < vsLine; i++) {
    depthBefore += (lines[i].match(/<div/g)||[]).length - (lines[i].match(/<\/div>/g)||[]).length;
  }
  let vNet = 0;
  for (let i = vsLine; i <= veLine; i++) {
    const o = (lines[i].match(/<div/g)||[]).length;
    const c = (lines[i].match(/<\/div>/g)||[]).length;
    vNet += o - c;
  }

  // find container/main structure
  const containerLine = lines.findIndex(l => l.trim().startsWith('<div class="container">') || l.trim().startsWith('<main>'));
  const containerClose = lines.map((l,i) => ({l,i})).filter(x => x.l.includes('/container') || x.l.trim() === '</main>').map(x=>x.i);

  console.log(`\n=== ${f.split('/').pop()} ===`);
  console.log(`Container/main opens: line ${containerLine+1} → ${lines[containerLine]?.trim().slice(0,50)}`);
  console.log(`Container closes: line ${containerClose.join(', ')}`);
  console.log(`VOICE-START: line ${vsLine+1}, VOICE-END: line ${veLine+1}`);
  console.log(`Div depth before VOICE: ${depthBefore}`);
  console.log(`Net divs in VOICE block: ${vNet}`);
  console.log(`VOICE is INSIDE container: ${vsLine > containerLine && (containerClose.length === 0 || vsLine < Math.max(...containerClose))}`);
}

for (const slug of ['naturehike-tent-osusume', 'naturehike-sleeping-bag-osusume', 'naturehike-airmat-osusume']) {
  checkFile(`public/outdoor/${slug}.html`);
}
