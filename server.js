const { Database } = require('bun:sqlite');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);
const dataDirectory = path.resolve(process.env.DATA_DIR || '/data');
const sessionCookie = 'kavita_session';
const sessions = new Map();
fs.mkdirSync(dataDirectory, { recursive: true });
const database = new Database(path.join(dataDirectory, 'uploader.sqlite'));
database.run('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL)');

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function passwordMatches(password, storedHash) {
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

const configuredUsername = process.env.AUTH_USERNAME;
const configuredPassword = process.env.AUTH_PASSWORD;
if (configuredUsername && configuredPassword && !database.query('SELECT 1 FROM users LIMIT 1').get()) {
  database.query('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(configuredUsername, passwordHash(configuredPassword));
}

function safePathPart(value, fallback = 'root') {
  const name = path.basename(String(value || '').trim());
  return name === '.' || name === '..' || !name ? fallback : name;
}

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const library = safePathPart(req.body.library, '');
    // Create a folder named after the book (without extension)
    const bookFolderName = safePathPart(path.parse(file.originalname).name, 'book');
    const uploadPath = path.join(dataDirectory, ...(library ? [library] : []), bookFolderName);
    
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Keep the original filename
    cb(null, path.basename(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

app.use(express.static('public'));
app.use(express.json());

function requireAuth(req, res, next) {
  const token = req.headers.cookie?.match(/(?:^|; )kavita_session=([^;]+)/)?.[1];
  if (token && sessions.has(token)) return next();
  return res.status(401).json({ error: 'Please log in first.' });
}

app.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const user = database.query('SELECT password_hash FROM users WHERE username = ?').get(username);
  if (!user || !passwordMatches(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, username);
  res.setHeader('Set-Cookie', `${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/`);
  return res.json({ username });
});

app.post('/logout', (req, res) => {
  const token = req.headers.cookie?.match(/(?:^|; )kavita_session=([^;]+)/)?.[1];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${sessionCookie}=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/`);
  return res.status(204).end();
});

app.get('/session', (req, res) => {
  const token = req.headers.cookie?.match(/(?:^|; )kavita_session=([^;]+)/)?.[1];
  return res.json({ username: token ? sessions.get(token) || null : null });
});

// Get list of existing libraries (top-level directories in /data)
app.get('/libraries', requireAuth, (req, res) => {
  try {
    const uploadPath = dataDirectory;
    if (!fs.existsSync(uploadPath)) {
      return res.json([]);
    }
    const dirs = fs.readdirSync(uploadPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    res.json(dirs);
  } catch (err) {
    console.error('Failed to read libraries:', err);
    res.status(500).json({ error: 'Failed to read libraries' });
  }
});

// Endpoint for uploading books
app.post('/upload', requireAuth, upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No files were uploaded.');
  }
  
  console.info(`Uploaded ${req.files.length} file(s) to library "${req.body.library || 'root'}"`);
  res.status(200).json({ 
    message: 'Files uploaded successfully!', 
    files: req.files.map(f => f.originalname),
    library: req.body.library || 'root'
  });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Each file must be smaller than 500 MB.' });
  }
  if (error) {
    console.error('Upload failed:', error);
    return res.status(500).json({ error: 'The upload could not be completed.' });
  }
  return next();
});

app.listen(port, '0.0.0.0', () => {
  console.info(`Kavita Uploader listening on port ${port}; data directory: ${dataDirectory}`);
});
