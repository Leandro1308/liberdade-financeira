// backend/src/lib/db.js
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function readDB() {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function nowISO() {
  return new Date().toISOString();
}

function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

module.exports = {
  readDB,
  writeDB,
  nowISO,
  generateId
};
