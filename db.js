const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

require("dotenv").config();

const dataRoot = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "data");
fs.mkdirSync(dataRoot, { recursive: true });

const db = new DatabaseSync(path.join(dataRoot, "spl.db"));
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reg_id TEXT UNIQUE,
    full_name TEXT NOT NULL,
    dob TEXT NOT NULL,
    age INTEGER NOT NULL,
    address TEXT NOT NULL,
    district TEXT NOT NULL,
    block TEXT NOT NULL,
    village_town TEXT NOT NULL,
    mobile TEXT NOT NULL,
    alternate_no TEXT,
    email TEXT,
    aadhaar TEXT NOT NULL,
    photo_path TEXT NOT NULL,
    main_sport TEXT NOT NULL,
    playing_role TEXT NOT NULL,
    club_name TEXT,
    utr TEXT NOT NULL,
    payment_screenshot_path TEXT NOT NULL,
    signature_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    submitted_at TEXT NOT NULL,
    confirmed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
  CREATE INDEX IF NOT EXISTS idx_players_mobile ON players(mobile);
  CREATE INDEX IF NOT EXISTS idx_players_utr ON players(utr);
`);

function nextRegId() {
  const row = db
    .prepare(
      `SELECT MAX(CAST(substr(reg_id, 10) AS INTEGER)) AS n
       FROM players WHERE reg_id IS NOT NULL`
    )
    .get();
  const n = Number(row && row.n ? row.n : 0) + 1;
  return `SPL-2026-${String(n).padStart(4, "0")}`;
}

module.exports = { db, nextRegId };
