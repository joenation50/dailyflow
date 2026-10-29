const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'dailyflow.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const initSql = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'work',
    date TEXT,
    recurrence TEXT NOT NULL DEFAULT 'none',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`;

db.exec(initSql);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dailyflow-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use(express.static(__dirname));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

app.get('/api/session', (req, res) => {
  if (!req.session.user) {
    return res.json({ user: null });
  }

  return res.json({ user: req.session.user });
});

app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare(`
    INSERT INTO users (id, email, password_hash)
    VALUES (?, ?, ?)
  `).run(userId, normalizedEmail, passwordHash);

  req.session.user = { id: userId, email: normalizedEmail };
  return res.status(201).json({ user: req.session.user, message: 'Account created successfully' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  req.session.user = { id: user.id, email: user.email };
  return res.json({ user: req.session.user, message: 'Logged in successfully' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

app.get('/api/tasks', requireAuth, (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
  return res.json({ tasks });
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { title, priority, category, date, recurrence } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Task title is required' });
  }

  const task = {
    id: randomUUID(),
    user_id: req.session.user.id,
    title: title.trim(),
    priority: priority || 'medium',
    category: category || 'work',
    date: date || null,
    recurrence: recurrence || 'none',
    completed: 0
  };

  db.prepare(`
    INSERT INTO tasks (id, user_id, title, priority, category, date, recurrence, completed)
    VALUES (@id, @user_id, @title, @priority, @category, @date, @recurrence, @completed)
  `).run(task);

  return res.status(201).json({ task, message: 'Task added' });
});

app.patch('/api/tasks/:id', requireAuth, (req, res) => {
  const taskId = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, req.session.user.id);

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  const payload = req.body || {};
  const updates = {
    completed: payload.completed !== undefined ? (payload.completed ? 1 : 0) : task.completed,
    title: payload.title || task.title,
    priority: payload.priority || task.priority,
    category: payload.category || task.category,
    date: payload.date !== undefined ? payload.date : task.date,
    recurrence: payload.recurrence || task.recurrence
  };

  db.prepare(`
    UPDATE tasks
    SET title = @title,
        priority = @priority,
        category = @category,
        date = @date,
        recurrence = @recurrence,
        completed = @completed
    WHERE id = @id AND user_id = @user_id
  `).run({
    ...updates,
    id: taskId,
    user_id: req.session.user.id
  });

  return res.json({ message: 'Task updated' });
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.session.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ message: 'Task not found' });
  }

  return res.json({ message: 'Task deleted' });
});

app.get('/api/notes', requireAuth, (req, res) => {
  const notes = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
  return res.json({ notes });
});

app.post('/api/notes', requireAuth, (req, res) => {
  const { text } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Note text is required' });
  }

  const note = {
    id: randomUUID(),
    user_id: req.session.user.id,
    text: text.trim()
  };

  db.prepare('INSERT INTO notes (id, user_id, text) VALUES (@id, @user_id, @text)').run(note);
  return res.status(201).json({ note, message: 'Note added' });
});

app.delete('/api/notes/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.session.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ message: 'Note not found' });
  }

  return res.json({ message: 'Note deleted' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`DailyFlow is running on http://localhost:${PORT}`);
});
