const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) console.warn("WARNING: DATABASE_URL is not set.");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDb() {
  if (!DATABASE_URL) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      rate NUMERIC NOT NULL DEFAULT 1500,
      bank_name TEXT NOT NULL DEFAULT 'Your Bank',
      account_name TEXT NOT NULL DEFAULT 'Your Business Name',
      account_number TEXT NOT NULL DEFAULT '0000000000',
      network TEXT NOT NULL DEFAULT 'TRC20',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_ref TEXT UNIQUE NOT NULL,
      naira_amount NUMERIC NOT NULL,
      usdt_amount NUMERIC NOT NULL,
      wallet_address TEXT NOT NULL,
      rate NUMERIC NOT NULL,
      status TEXT NOT NULL DEFAULT 'Awaiting Payment',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO settings (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function settings() {
  const r=await pool.query("SELECT rate,bank_name,account_name,account_number,network,updated_at FROM settings WHERE id=1");
  return r.rows[0];
}

app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

function auth(req,res,next){
  if(!ADMIN_PASSWORD || req.headers["x-admin-password"] !== ADMIN_PASSWORD)
    return res.status(401).json({error:"Unauthorized"});
  next();
}

app.get("/api/settings",async(req,res)=>{
  try { res.json(await settings()); }
  catch(e){ console.error(e); res.status(500).json({error:"Database unavailable"}); }
});

app.post("/api/orders",async(req,res)=>{
  try{
    const naira=Number(req.body.nairaAmount);
    const wallet=String(req.body.walletAddress||"").trim();
    const s=await settings();
    if(!Number.isFinite(naira)||naira<=0) return res.status(400).json({error:"Enter a valid Naira amount."});
    if(wallet.length<10) return res.status(400).json({error:"Enter a valid USDT wallet address."});
    const rate=Number(s.rate);
    if(!Number.isFinite(rate)||rate<=0) return res.status(500).json({error:"Exchange rate is not configured."});
    const usdt=Number((naira/rate).toFixed(6));
    const ref="USDT-"+Date.now().toString(36).toUpperCase();
    const r=await pool.query(
      `INSERT INTO orders(order_ref,naira_amount,usdt_amount,wallet_address,rate)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,order_ref,naira_amount,usdt_amount,wallet_address,rate,status,created_at`,
      [ref,naira,usdt,wallet,rate]
    );
    res.json({orderRef:ref,nairaAmount:naira,usdtAmount:usdt,rate,payment:{
      bankName:s.bank_name,accountName:s.account_name,accountNumber:s.account_number,network:s.network
    }});
  }catch(e){ console.error(e); res.status(500).json({error:"Could not create order."}); }
});

app.get("/api/admin/settings",auth,async(req,res)=>{
  try{res.json(await settings())}catch(e){res.status(500).json({error:"Database unavailable"})}
});

app.put("/api/admin/settings",auth,async(req,res)=>{
  try{
    const rate=Number(req.body.rate);
    const bankName=String(req.body.bankName||"").trim();
    const accountName=String(req.body.accountName||"").trim();
    const accountNumber=String(req.body.accountNumber||"").trim();
    const network=String(req.body.network||"TRC20").trim();
    if(!Number.isFinite(rate)||rate<=0)return res.status(400).json({error:"Rate must be greater than zero."});
    if(!bankName||!accountName||!accountNumber)return res.status(400).json({error:"Complete payment details."});
    await pool.query(
      `UPDATE settings SET rate=$1,bank_name=$2,account_name=$3,account_number=$4,network=$5,updated_at=NOW() WHERE id=1`,
      [rate,bankName,accountName,accountNumber,network]
    );
    res.json(await settings());
  }catch(e){console.error(e);res.status(500).json({error:"Could not save settings."})}
});

app.get("/api/admin/orders",auth,async(req,res)=>{
  try{
    const r=await pool.query(`SELECT id,order_ref,naira_amount,usdt_amount,wallet_address,rate,status,created_at FROM orders ORDER BY created_at DESC LIMIT 200`);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:"Could not load orders."})}
});

app.patch("/api/admin/orders/:id",auth,async(req,res)=>{
  try{
    const allowed=["Awaiting Payment","Payment Received","USDT Sent","Completed","Cancelled"];
    const status=String(req.body.status||"");
    if(!allowed.includes(status))return res.status(400).json({error:"Invalid status."});
    const r=await pool.query("UPDATE orders SET status=$1 WHERE id=$2 RETURNING id", [status,Number(req.params.id)]);
    if(!r.rowCount)return res.status(404).json({error:"Order not found."});
    res.json({ok:true});
  }catch(e){res.status(500).json({error:"Could not update order."})}
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

initDb().then(()=>{
  app.listen(PORT,"0.0.0.0",()=>console.log(`USDT exchange running on port ${PORT}`));
}).catch(e=>{
  console.error("Database initialization failed:",e);
  process.exit(1);
});
