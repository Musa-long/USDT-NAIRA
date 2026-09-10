let pwd = "";
function headers(){return {"Content-Type":"application/json","x-admin-password":pwd};}
async function login(){
  pwd=document.getElementById("password").value;
  const r=await fetch("/api/admin/settings",{headers:{"x-admin-password":pwd}});
  if(!r.ok){document.getElementById("loginError").textContent="Invalid password.";return;}
  document.getElementById("login").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  const s=await r.json();
  fillSettings(s); loadOrders();
}
function fillSettings(s){
  document.getElementById("rate").value=s.rate;
  document.getElementById("bankName").value=s.bank_name;
  document.getElementById("accountName").value=s.account_name;
  document.getElementById("accountNumber").value=s.account_number;
  document.getElementById("network").value=s.network;
}
async function saveSettings(){
  const body={
    rate:Number(document.getElementById("rate").value),
    bankName:document.getElementById("bankName").value,
    accountName:document.getElementById("accountName").value,
    accountNumber:document.getElementById("accountNumber").value,
    network:document.getElementById("network").value
  };
  const r=await fetch("/api/admin/settings",{method:"PUT",headers:headers(),body:JSON.stringify(body)});
  const d=await r.json();
  document.getElementById("saveMsg").textContent=r.ok?"Saved successfully.":(d.error||"Save failed.");
}
async function loadOrders(){
  const r=await fetch("/api/admin/orders",{headers:{"x-admin-password":pwd}});
  if(!r.ok)return;
  const orders=await r.json();
  document.getElementById("orders").innerHTML=orders.map(o=>`
    <tr><td>${o.order_ref}</td><td>₦${Number(o.naira_amount).toLocaleString()}</td>
    <td>${Number(o.usdt_amount).toFixed(6)}</td><td>${escapeHtml(o.wallet_address)}</td>
    <td><select onchange="changeStatus(${o.id},this.value)">
      ${["Awaiting Payment","Payment Received","USDT Sent","Completed","Cancelled"].map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}
    </select></td><td>${o.created_at}</td></tr>`).join("");
}
async function changeStatus(id,status){
  await fetch("/api/admin/orders/"+id,{method:"PATCH",headers:headers(),body:JSON.stringify({status})});
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
