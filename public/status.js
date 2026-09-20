const params = new URLSearchParams(location.search);
const mobileInput = document.getElementById("mobile");
const results = document.getElementById("results");
const flash = document.getElementById("flash");
if (params.get("mobile")) mobileInput.value = params.get("mobile");

function labelStatus(s) {
  if (s === "pending") return "Pending — admin UTR confirm karega";
  if (s === "confirmed") return "Confirmed";
  if (s === "rejected") return "Rejected";
  return s;
}

async function load(mobile) {
  flash.className = "flash hidden";
  results.innerHTML = "";
  const res = await fetch("/api/status?mobile=" + encodeURIComponent(mobile));
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Lookup fail");
  if (!json.players.length) {
    flash.className = "flash error";
    flash.textContent = "Is number par koi registration nahi mili.";
    return;
  }
  results.innerHTML = json.players
    .map(
      (p) => `<article class="card">
        <h3>${p.full_name}</h3>
        <p>Status: <strong>${labelStatus(p.status)}</strong></p>
        <p>Registration ID: <strong>${p.reg_id || "— (confirm ke baad milega)"}</strong></p>
        <p>UTR: ${p.utr || "—"}</p>
        <p>Submitted: ${new Date(p.submitted_at).toLocaleString("en-IN")}</p>
        ${p.confirmed_at ? `<p>Confirmed: ${new Date(p.confirmed_at).toLocaleString("en-IN")}</p>` : ""}
        ${p.reject_reason ? `<p>Reason: ${p.reject_reason}</p>` : ""}
      </article>`
    )
    .join("");
}

document.getElementById("lookup").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await load(mobileInput.value.trim());
    history.replaceState(null, "", "/status?mobile=" + encodeURIComponent(mobileInput.value.trim()));
  } catch (err) {
    flash.className = "flash error";
    flash.textContent = err.message;
  }
});

if (mobileInput.value.length === 10) {
  load(mobileInput.value).catch((err) => {
    flash.className = "flash error";
    flash.textContent = err.message;
  });
}
