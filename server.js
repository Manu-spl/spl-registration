const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const dotenv = require("dotenv");
dotenv.config();
const QRCode = require("qrcode");
const { db, nextRegId } = require("./db");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "spl-admin-2026";
const SESSION_SECRET = process.env.SESSION_SECRET || "spl-dev-secret";
const WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || "9122011699").replace(/\s/g, "");
const PAYMENT_NUMBER = (process.env.PAYMENT_NUMBER || "8709506180").replace(/\s/g, "");
const PAYMENT_UPI = (process.env.PAYMENT_UPI || `${PAYMENT_NUMBER}@ybl`).trim();
const REGISTRATION_FEE = Number(process.env.REGISTRATION_FEE || 300);

function paymentUpiUrl() {
  const q = new URLSearchParams({
    pa: PAYMENT_UPI,
    pn: "SPL Sakarauli Premier League",
    am: String(REGISTRATION_FEE),
    cu: "INR",
    tn: "SPL 2026 Player Registration",
  });
  return `upi://pay?${q.toString()}`;
}

const uploadsDir = process.env.DATA_DIR
  ? path.join(path.resolve(process.env.DATA_DIR), "uploads")
  : path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG or WEBP images are allowed"));
  },
});

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Admin login required" });
}

function maskAadhaar(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 4) return "XXXX-XXXX-XXXX";
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

function ageFromDob(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function publicConfig(_req, res) {
  res.json({
    whatsapp: WHATSAPP_NUMBER,
    paymentNumber: PAYMENT_NUMBER,
    paymentUpi: PAYMENT_UPI,
    fee: REGISTRATION_FEE,
    qrUrl: "/api/payment-qr",
    year: 2026,
  });
}

app.get("/api/config", publicConfig);

app.get("/api/payment-qr", async (_req, res) => {
  try {
    const png = await QRCode.toBuffer(paymentUpiUrl(), {
      type: "png",
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    });
    res.set("Cache-Control", "public, max-age=300");
    res.type("png").send(png);
  } catch (err) {
    res.status(500).json({ error: "QR generate nahi hua" });
  }
});

app.get("/api/status", (req, res) => {
  const mobile = digitsOnly(req.query.mobile);
  if (mobile.length !== 10) {
    return res.status(400).json({ error: "10 digit mobile number chahiye" });
  }
  const rows = db
    .prepare(
      `SELECT id, reg_id, full_name, mobile, status, reject_reason, submitted_at, confirmed_at, utr
       FROM players WHERE mobile = ? ORDER BY id DESC`
    )
    .all(mobile);
  res.json({
    players: rows.map((row) => ({
      ...row,
      utr: row.utr ? `${row.utr.slice(0, 4)}…${row.utr.slice(-4)}` : null,
    })),
  });
});

app.post(
  "/api/register",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "payment_screenshot", maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files || {};
    const photo = files.photo && files.photo[0];
    const shot = files.payment_screenshot && files.payment_screenshot[0];
    const body = req.body || {};

    const cleanup = () => {
      for (const f of [photo, shot]) {
        if (f && f.path) fs.unlink(f.path, () => {});
      }
    };

    try {
      const full_name = String(body.full_name || "").trim();
      const dob = String(body.dob || "").trim();
      const address = String(body.address || "").trim();
      const district = String(body.district || "").trim();
      const block = String(body.block || "").trim();
      const village_town = String(body.village_town || "").trim();
      const mobile = digitsOnly(body.mobile);
      const alternate_no = digitsOnly(body.alternate_no);
      const email = String(body.email || "").trim();
      const aadhaar = digitsOnly(body.aadhaar);
      const main_sport = String(body.main_sport || "").trim();
      const playing_role = String(body.playing_role || "").trim();
      const club_name = String(body.club_name || "").trim();
      const utr = String(body.utr || "").trim().toUpperCase();
      const signature_name = String(body.signature_name || "").trim();
      const declared = body.declaration === "on" || body.declaration === "true" || body.declaration === "1";

      const sports = ["Cricket", "Tennis Ball Cricket"];
      const roles = ["Batsman", "Bowler", "All Rounder", "Wicket Keeper", "Others"];

      if (!full_name) throw new Error("Player ka full name required hai");
      if (!dob) throw new Error("Date of birth required hai");
      const age = ageFromDob(dob);
      if (age == null || age < 8 || age > 80) throw new Error("Valid date of birth daalein");
      if (!address) throw new Error("Address required hai");
      if (!district) throw new Error("District required hai");
      if (!block) throw new Error("Block required hai");
      if (!village_town) throw new Error("Village / Town required hai");
      if (mobile.length !== 10) throw new Error("Valid 10 digit mobile number daalein");
      if (alternate_no && alternate_no.length !== 10) throw new Error("Alternate number 10 digit hona chahiye");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email daalein");
      if (aadhaar.length !== 12) throw new Error("Aadhaar 12 digit hona chahiye");
      if (!sports.includes(main_sport)) throw new Error("Main sport select karein");
      if (!roles.includes(playing_role)) throw new Error("Playing role select karein");
      if (!utr || utr.length < 8) throw new Error("Valid UTR / UPI transaction ID daalein");
      if (!declared) throw new Error("Declaration accept karni zaroori hai");
      if (!signature_name) throw new Error("Signature ke liye apna naam type karein");
      if (!photo) throw new Error("Passport size photo upload karein");
      if (!shot) throw new Error("Payment screenshot upload karein");

      const existingUtr = db
        .prepare(
          `SELECT id FROM players WHERE utr = ? AND status IN ('pending', 'confirmed') LIMIT 1`
        )
        .get(utr);
      if (existingUtr) throw new Error("Yeh UTR pehle se registered hai");

      const existingMobile = db
        .prepare(
          `SELECT id, status FROM players WHERE mobile = ? AND status IN ('pending', 'confirmed') LIMIT 1`
        )
        .get(mobile);
      if (existingMobile) {
        throw new Error(
          existingMobile.status === "pending"
            ? "Is mobile par pehle se pending registration hai. Status page check karein."
            : "Is mobile par registration already confirmed hai."
        );
      }

      const submitted_at = new Date().toISOString();
      const info = db
        .prepare(
          `INSERT INTO players (
            full_name, dob, age, address, district, block, village_town,
            mobile, alternate_no, email, aadhaar, photo_path, main_sport,
            playing_role, club_name, utr, payment_screenshot_path, signature_name,
            status, submitted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
        )
        .run(
          full_name,
          dob,
          age,
          address,
          district,
          block,
          village_town,
          mobile,
          alternate_no || null,
          email || null,
          aadhaar,
          path.basename(photo.path),
          main_sport,
          playing_role,
          club_name || null,
          utr,
          path.basename(shot.path),
          signature_name,
          submitted_at
        );

      res.json({
        ok: true,
        id: info.lastInsertRowid,
        status: "pending",
        message: "Form submit ho gaya. Admin UTR confirm karega.",
      });
    } catch (err) {
      cleanup();
      res.status(400).json({ error: err.message || "Registration fail hui" });
    }
  }
);

app.post("/api/admin/login", (req, res) => {
  const password = String((req.body && req.body.password) || "");
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Galat password" });
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/admin/me", (req, res) => {
  res.json({ isAdmin: Boolean(req.session && req.session.isAdmin) });
});

app.get("/api/admin/players", requireAdmin, (req, res) => {
  const status = String(req.query.status || "pending");
  const allowed = ["pending", "confirmed", "rejected"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const rows = db
    .prepare(`SELECT * FROM players WHERE status = ? ORDER BY id DESC`)
    .all(status);

  res.json({
    players: rows.map((p) => ({
      ...p,
      aadhaar: maskAadhaar(p.aadhaar),
      photo_url: `/api/admin/file/${p.photo_path}`,
      payment_url: `/api/admin/file/${p.payment_screenshot_path}`,
    })),
  });
});

app.get("/api/admin/file/:name", requireAdmin, (req, res) => {
  const name = path.basename(req.params.name);
  const filePath = path.join(uploadsDir, name);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

app.post("/api/admin/players/:id/confirm", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
  if (!player) return res.status(404).json({ error: "Player nahi mila" });
  if (player.status !== "pending") {
    return res.status(400).json({ error: "Sirf pending registration confirm ho sakti hai" });
  }
  const utrClash = db
    .prepare(
      `SELECT id FROM players WHERE utr = ? AND status = 'confirmed' AND id != ? LIMIT 1`
    )
    .get(player.utr, id);
  if (utrClash) return res.status(400).json({ error: "Yeh UTR already confirmed player ke naam par hai" });

  db.exec("BEGIN");
  try {
    const reg_id = nextRegId();
    db.prepare(
      `UPDATE players SET status = 'confirmed', reg_id = ?, confirmed_at = ?, reject_reason = NULL WHERE id = ?`
    ).run(reg_id, new Date().toISOString(), id);
    db.exec("COMMIT");
    res.json({ ok: true, reg_id });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch (_e) {
      /* ignore */
    }
    res.status(500).json({ error: err.message || "Confirm fail hua" });
  }
});

app.post("/api/admin/players/:id/reject", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const reason = String((req.body && req.body.reason) || "").trim();
  const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
  if (!player) return res.status(404).json({ error: "Player nahi mila" });
  if (player.status !== "pending") {
    return res.status(400).json({ error: "Sirf pending registration reject ho sakti hai" });
  }
  db.prepare(
    `UPDATE players SET status = 'rejected', reject_reason = ? WHERE id = ?`
  ).run(reason || "UTR / details verify nahi hue", id);
  res.json({ ok: true });
});

app.get("/register", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});
app.get("/status", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "status.html"));
});
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: "File upload error: " + err.message });
  }
  if (err) return res.status(400).json({ error: err.message || "Request fail hui" });
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SPL registration: http://0.0.0.0:${PORT}`);
});
