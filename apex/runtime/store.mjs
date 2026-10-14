import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class Store {
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id));`);
  }
  list(kind) { return this.db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC').all(kind).map(r => JSON.parse(r.body)); }
  get(kind, id) { const r = this.db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(kind, id); return r ? JSON.parse(r.body) : null; }
  put(kind, value) { this.db.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(kind, value.id, JSON.stringify(value)); return value; }
  remove(kind, id) { return this.db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind, id).changes > 0; }
  create(kind, body) { return this.put(kind, { ...body, id: randomUUID(), createdAt: new Date().toISOString() }); }
  close() { this.db.close(); }
}
