const MAX_BYTES = 500 * 1024;

function calcAge(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age -= 1;
  return String(age);
}

async function compressUnder(file, maxEdge) {
  if (!file || !file.size) throw new Error("Image missing");
  const bmp = await createImageBitmap(file);
  let edge = Math.min(maxEdge, Math.max(bmp.width, bmp.height));
  let quality = 0.72;
  let blob = null;
  for (let i = 0; i < 14; i++) {
    const scale = edge / Math.max(bmp.width, bmp.height);
    const w = Math.max(1, Math.round(bmp.width * Math.min(1, scale)));
    const h = Math.max(1, Math.round(bmp.height * Math.min(1, scale)));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) break;
    if (quality > 0.42) quality -= 0.1;
    else edge = Math.max(320, Math.round(edge * 0.82));
  }
  bmp.close();
  if (!blob) throw new Error("Image compress fail");
  if (blob.size > MAX_BYTES) {
    throw new Error("Image 500KB se chhoti nahi ho paayi. Dusri photo try karein.");
  }
  const base = (file.name || "photo").replace(/\.[^.]+$/, "");
  return new File([blob], base + ".jpg", { type: "image/jpeg" });
}

const dob = document.getElementById("dob");
const age = document.getElementById("age");
dob.addEventListener("change", () => {
  age.value = calcAge(dob.value);
});

fetch("/api/config")
  .then((r) => r.json())
  .then((c) => {
    document.getElementById("fee").textContent = c.fee;
    document.querySelectorAll(".fee2").forEach((el) => {
      el.textContent = c.fee;
    });
    document.getElementById("payNum").textContent = c.paymentNumber;
    document.getElementById("payNum2").textContent = c.paymentNumber;
    document.getElementById("upiId").textContent = c.paymentUpi;
    document.getElementById("payQr").src = c.qrUrl + "?t=" + Date.now();
  })
  .catch(() => {});

const form = document.getElementById("regForm");
const flash = document.getElementById("flash");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  flash.className = "flash hidden";
  submitBtn.disabled = true;
  submitBtn.textContent = "Compressing photos…";
  try {
    const photoIn = form.photo.files[0];
    const shotIn = form.payment_screenshot.files[0];
    const photo = await compressUnder(photoIn, 800);
    const shot = await compressUnder(shotIn, 1000);
    const data = new FormData(form);
    data.set("declaration", form.declaration.checked ? "true" : "false");
    data.set("photo", photo);
    data.set("payment_screenshot", shot);
    submitBtn.textContent = "Submitting…";
    const res = await fetch("/api/register", { method: "POST", body: data });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Submit fail");
    flash.className = "flash ok";
    flash.textContent = json.message + " Status page par mobile se check karein.";
    const mobile = data.get("mobile");
    form.reset();
    age.value = "";
    setTimeout(() => {
      window.location.href = "/status?mobile=" + encodeURIComponent(mobile);
    }, 900);
  } catch (err) {
    flash.className = "flash error";
    flash.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit registration";
  }
});
