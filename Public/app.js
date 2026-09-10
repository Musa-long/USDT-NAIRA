let currentRate = 0;

const nairaInput = document.getElementById("naira");
const walletInput = document.getElementById("wallet");
const usdtOutput = document.getElementById("usdt");
const rateEl = document.getElementById("rate");
const networkEl = document.getElementById("network");
const errorEl = document.getElementById("error");

function formatNaira(n) {
  return "₦" + Number(n).toLocaleString("en-NG", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function updateCalc() {
  const naira = Number(nairaInput.value || 0);
  usdtOutput.textContent = currentRate > 0 ? (naira / currentRate).toFixed(6) : "0.000000";
}
async function loadSettings() {
  const res = await fetch("/api/settings");
  const s = await res.json();
  currentRate = s.rate;
  rateEl.textContent = formatNaira(s.rate) + " / USDT";
  networkEl.textContent = s.network;
  updateCalc();
}
nairaInput.addEventListener("input", updateCalc);

document.getElementById("buyBtn").addEventListener("click", async () => {
  errorEl.textContent = "";
  const nairaAmount = Number(nairaInput.value);
  const walletAddress = walletInput.value.trim();

  if (!nairaAmount || nairaAmount <= 0) {
    errorEl.textContent = "Please enter a valid Naira amount.";
    return;
  }
  if (!walletAddress || walletAddress.length < 10) {
    errorEl.textContent = "Please enter your USDT wallet address.";
    return;
  }

  const btn = document.getElementById("buyBtn");
  btn.disabled = true;
  btn.textContent = "CREATING ORDER...";

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({nairaAmount, walletAddress})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not create order.");

    document.getElementById("orderRef").textContent = data.orderRef;
    document.getElementById("bankName").textContent = data.payment.bankName;
    document.getElementById("accountName").textContent = data.payment.accountName;
    document.getElementById("accountNumber").textContent = data.payment.accountNumber;
    document.getElementById("payAmount").textContent = formatNaira(data.nairaAmount);
    document.getElementById("payment").classList.remove("hidden");
    document.getElementById("payment").scrollIntoView({behavior:"smooth"});
  } catch (e) {
    errorEl.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "BUY USDT NOW";
  }
});

loadSettings();
