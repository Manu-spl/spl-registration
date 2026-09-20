const loginBox = document.getElementById("loginBox");
const dash = document.getElementById("dash");
const list = document.getElementById("list");
const logoutBtn = document.getElementById("logoutBtn");
const loginFlash = document.getElementById("loginFlash");
let currentStatus = "pending";

function showFlash(el, msg, ok) {
  el.className = ok ? "flash ok" : "flash error";
  el.textContent = msg;
}

async function checkMe() {
  const res = await fetch("/api/admin/me");
  const json = await res.json();
  if (json.isAdmin) {
    loginBox.classList.add("hidden");
    loginBox.setAttribute("hidden", "");
    dash.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    await loadPlayers();
  }
}

async function loadPlayers() {
  const res = await fetch("/api/admin/players?status=" + currentStatus);
  if (res.status === 401) {
    dash.classList.add("hidden");
    loginBox.classList.remove("hidden");
    return;
  }
  const json = await res.json();
  if (!json.players.length) {
    list.innerHTML = `<div class="card">Is tab mein koi player nahi hai.</div>`;
    return;
  }
  list.innerHTML = json.players
    .map((p) => {
      const actions =
        p.status === "pending"
          ? `<button class="btn btn-green" data-act="confirm" data-id="${p.id}">UTR Confirm</button>
             <button class="btn btn-red" data-act="reject" data-id="${p.id}">Reject</button>`
          : p.reg_id
            ? `<p>Reg ID: <strong>${p.reg_id}</strong></p>`
            : "";
      return `<article class="card player-card">
        <img src="${p.photo_url}" alt="photo" />
        <div>
          <h3>${p.full_name} · ${p.age} yrs</h3>
          <p>${p.playing_role} · ${p.main_sport}</p>
          <p>Mobile: ${p.mobile}${p.alternate_no ? " / " + p.alternate_no : ""}</p>
          <p>${p.village_town}, ${p.block}, ${p.district}</p>
          <p>${p.address}</p>
          <p>Aadhaar: ${p.aadhaar}</p>
          <p>UTR: <strong>${p.utr}</strong> · ₹300</p>
          <p>Club: ${p.club_name || "—"} · Sign: ${p.signature_name}</p>
          <p class="muted">Submitted ${new Date(p.submitted_at).toLocaleString("en-IN")}</p>
          ${p.reject_reason ? `<p>Reject: ${p.reject_reason}</p>` : ""}
          <div class="shots">
            <a href="${p.payment_url}" target="_blank"><img src="${p.payment_url}" alt="payment" /></a>
          </div>
        </div>
        <div>${actions}</div>
      </article>`;
    })
    .join("");
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  loginFlash.className = "flash hidden";
  const password = document.getElementById("password").value;
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const json = await res.json();
  if (!res.ok) return showFlash(loginFlash, json.error, false);
  await checkMe();
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  location.reload();
});

document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatus = btn.dataset.status;
    loadPlayers();
  });
});

list.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === "confirm") {
    if (!confirm("UTR verify ho gaya? Registration confirm karein?")) return;
    const res = await fetch("/api/admin/players/" + id + "/confirm", { method: "POST" });
    const json = await res.json();
    if (!res.ok) return alert(json.error);
    alert("Confirmed: " + json.reg_id);
  }
  if (btn.dataset.act === "reject") {
    const reason = prompt("Reject reason (optional)", "UTR match nahi hua");
    if (reason === null) return;
    const res = await fetch("/api/admin/players/" + id + "/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error);
  }
  loadPlayers();
});

document.getElementById("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("loginBtn").click();
});

checkMe();
