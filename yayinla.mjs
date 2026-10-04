// @uzm.pd.kursadpolat — Instagram otomatik hikâye yayıncısı (resmi Graph API / Content Publishing)
// 300 video hikâye (Monster insta-story), günde 3: 08:30 / 13:00 / 21:00 TR. Takvim TAKVIM.md'de.
// Şablon: onlinekocun-instagram/story-yayin/yayinla.mjs
// Kullanım:
//   node yayinla.mjs --slot=0|1|2    → bugünün o slotundaki hikâyeyi paylaşır
//   node yayinla.mjs --slot=1 --kuru → paylaşmadan ne gideceğini yazar
//   node yayinla.mjs --id=s005       → belirli bir hikâyeyi paylaşır (elle)
//   --tarih=YYYY-MM-DD ile başka bir günü hesaplatabilirsin (test için)
// Ortam: IG_USER_ID, IG_TOKEN, MEDYA_URL. Durumsuz: içerik = gün farkı × 3 + slot − kayma.
import fs from 'node:fs';

// Mac'te elle çalıştırırken gizli ayarlar ~/.config/kursadpolat-ig/env dosyasından okunur
const ENV_DOSYA = `${process.env.HOME}/.config/kursadpolat-ig/env`;
if (fs.existsSync(ENV_DOSYA)) for (const s of fs.readFileSync(ENV_DOSYA, 'utf8').split('\n')) {
  const m = s.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const arg = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const AYAR = { dosya: 'kuyruk.json', gunluk: 3, baslangic: '2026-10-04', kayma: 0 };
const kuyruk = JSON.parse(fs.readFileSync(new URL('./' + AYAR.dosya, import.meta.url), 'utf8'));
const { IG_USER_ID, IG_TOKEN, MEDYA_URL } = process.env;
const GRAPH = 'https://graph.instagram.com/v23.0';

function bugunTR() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); }
function icerikSec() {
  if (arg.id) return kuyruk.find(s => s.id === arg.id) || (() => { throw new Error('içerik yok: ' + arg.id); })();
  const gun = Math.round((Date.parse(arg.tarih || bugunTR()) - Date.parse(AYAR.baslangic)) / 864e5);
  const i = gun * AYAR.gunluk + Number(arg.slot || 0) - AYAR.kayma;
  if (gun < 0 || i < 0) return null;
  if (i >= kuyruk.length) { console.log('Kuyruk bitti, paylaşılacak içerik kalmadı.'); process.exit(0); }
  return kuyruk[i];
}

async function api(yol, params, method = 'POST') {
  const u = new URL(`${GRAPH}/${yol}`);
  const body = new URLSearchParams({ ...params, access_token: process.env.IG_TOKEN });
  const r = method === 'GET' ? await fetch(u + '?' + body) : await fetch(u, { method, body });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`${yol}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return j;
}
const bekle = ms => new Promise(r => setTimeout(r, ms));
const url = k => `${(MEDYA_URL || '').replace(/\/$/, '')}/${k}`;

// Konteyner hazır olana kadar bekle (video işleme birkaç dakika sürebilir)
async function hazirBekle(id, sure = 60) {
  for (let n = 0; n < sure; n++) {
    const { status_code } = await api(id, { fields: 'status_code' }, 'GET');
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`konteyner ${status_code}: ${id}`);
    await bekle(5000);
  }
  throw new Error('konteyner zaman aşımı: ' + id);
}

// --otomatik: GitHub cron'u güvenilmez (çalışmaları geciktiriyor, bazen hiç başlatmıyor). Workflow her
// 30 dakikada bir çalışır; bugünün saati gelmiş ama yayinlanan.txt'de olmayan İLK slotu paylaşır.
// Böylece kaçan bir çalışma bir sonrakinde telafi edilir, aynı hikâye iki kez gitmez. Önceki günün
// kaçanları telafi edilmez (bayat olur), o slot atlanır.
const SAATLER = ['08:30', '13:00', '21:00'];
const DURUM = new URL('./yayinlanan.txt', import.meta.url);
if (arg.otomatik) {
  const simdi = new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 16);
  const yapilan = new Set(fs.existsSync(DURUM) ? fs.readFileSync(DURUM, 'utf8').split('\n').filter(Boolean) : []);
  let slot = -1;
  for (let i = 0; i < SAATLER.length && SAATLER[i] <= simdi; i++) {
    arg.slot = i; const c = icerikSec();
    if (c && !yapilan.has(c.id)) { slot = i; break; }
  }
  if (slot < 0) { console.log(`${bugunTR()} ${simdi}: bekleyen slot yok.`); process.exit(0); }
  arg.slot = slot;
}
const x = icerikSec();
if (!x) { console.log('Başlangıç tarihi gelmedi, atlandı.'); process.exit(0); }
console.log(`${arg.tarih || bugunTR()} slot ${arg.slot ?? '-'} → ${x.id} "${x.baslik}" [${x.kap}]`);
if (arg.kuru) { console.log('  ' + url(x.video)); process.exit(0); }
if (!IG_USER_ID || !IG_TOKEN || !MEDYA_URL) { console.error('IG_USER_ID / IG_TOKEN / MEDYA_URL eksik'); process.exit(1); }

// Uzun ömürlü token 60 gün yaşar. Bulutta: TOKEN_YENILE=1 ise yenile, yeni token'ı YENI_TOKEN_DOSYA'ya yaz
// (workflow onu şifreleyip repoya geri koyar). Mac'te: env dosyası 7 günden eskiyse yenile.
const yas = fs.existsSync(ENV_DOSYA) ? (Date.now() - fs.statSync(ENV_DOSYA).mtimeMs) / 864e5 : 0;
if (process.env.TOKEN_YENILE === '1' || yas > 7) {
  try {
    const r = await (await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${IG_TOKEN}`)).json();
    if (r.access_token) {
      if (process.env.YENI_TOKEN_DOSYA) fs.writeFileSync(process.env.YENI_TOKEN_DOSYA, r.access_token, { mode: 0o600 });
      else fs.writeFileSync(ENV_DOSYA, fs.readFileSync(ENV_DOSYA, 'utf8').replace(/^IG_TOKEN=.*$/m, `IG_TOKEN=${r.access_token}`), { mode: 0o600 });
      process.env.IG_TOKEN = r.access_token; console.log('  token yenilendi');
    }
  } catch (e) { console.log('  token yenilenemedi: ' + e.message); }
}

const { id } = await api(`${IG_USER_ID}/media`, { media_type: 'STORIES', video_url: url(x.video) });
await hazirBekle(id, 60);
console.log(`  ✓ ${x.id} → ${(await api(`${IG_USER_ID}/media_publish`, { creation_id: id })).id}`);
fs.appendFileSync(DURUM, x.id + '\n');
