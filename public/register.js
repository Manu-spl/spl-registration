function calcAge(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age -= 1;
  return String(age);
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
  const data = new FormData(form);
  data.set("declaration", form.declaration.checked ? "true" : "false");
  try {
    const res = await fetch("/api/register", { method: "POST", body: data });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Submit fail");
    flash.className = "flash ok";
    flash.textContent = json.message + " Status page par mobile se check karein.";
    form.reset();
    age.value = "";
    setTimeout(() => {
      window.location.href = "/status?mobile=" + encodeURIComponent(data.get("mobile"));
    }, 900);
  } catch (err) {
    flash.className = "flash error";
    flash.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});
