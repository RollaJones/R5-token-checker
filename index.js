import dotenv from 'dotenv';
dotenv.config();
console.log("HELIUS_KEY (from env):", process.env.HELIUS_KEY);

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

const voteFile = path.join(__dirname, 'votes.json');
let voteData = fs.existsSync(voteFile) ? JSON.parse(fs.readFileSync(voteFile, 'utf-8')) : {};
function saveVotes() {
  fs.writeFileSync(voteFile, JSON.stringify(voteData, null, 2));
}

// === Helius Holders ===
async function fetchHoldersFromHelius(mintAddress) {
  const url = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}`;
  const body = {
    jsonrpc: '2.0',
    id: 'r5-check',
    method: 'getTokenLargestAccounts',
    params: [mintAddress]
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    const valueList = data.result?.value || [];
    const total = valueList.reduce((sum, acct) => sum + Number(acct.amount), 0);
    return valueList.map(acct => ({
      address: acct.address,
      percent: total ? ((Number(acct.amount) / total) * 100).toFixed(2) : 0
    }));
  } catch (err) {
    console.error("❌ Error fetching from Helius:", err);
    return [];
  }
}

// === Solscan Ownership Checker ===
async function fetchSolscanOwnership(mint) {
  try {
    const res = await fetch(`https://public-api.solscan.io/token/meta?tokenAddress=${mint}`);
    const text = await res.text();
    const meta = JSON.parse(text || '{}');
    console.log("🧠 Solscan token meta:", meta);
    const owner = meta?.owner;
    return !owner || owner === '11111111111111111111111111111111';
  } catch (e) {
    console.warn("⚠️ Solscan ownership fallback failed:", e.message);
    return null;
  }
}

// === RugCheck LP (TVL) Checker ===
async function fetchRugCheckLP(mint) {
  try {
    const res = await fetch(`https://api.rugcheck.xyz/v1/token/${mint}`);
    const data = await res.json();
    console.log("🔒 RugCheck LP lock:", data);
    if (typeof data.is_locked === 'boolean') {
      return {
        locked: data.is_locked,
        until: data.locked_until ? new Date(data.locked_until * 1000).toISOString() : null
      };
    }
  } catch (e) {
    console.warn("⚠️ RugCheck LP fallback failed:", e.message);
  }
  return { locked: null, until: null };
}

function generateSummary(base, liquidity, volume, txns, flags = [], mintAddress = "") {
  const name = base.name || 'Token';
  const symbol = base.symbol || 'SYM';
  const liqStr = `$${Number(liquidity.usd || 0).toLocaleString()}`;
  const volStr = `$${Number(volume.h24 || 0).toLocaleString()}`;
  const buyCount = txns.buys || 0;
  const sellCount = txns.sells || 0;
  const solscanLink = `🔍 <a href="https://solscan.io/account/${mintAddress}" target="_blank">View on Solscan</a>`;
  const chartLink = `📊 <a href="https://dexscreener.com/solana/${mintAddress}" target="_blank">View Chart</a>`;
  let summary = `${name} (${symbol}) has ${liqStr} liquidity and ${volStr} 24h volume. Buys: ${buyCount}, Sells: ${sellCount}.<br>${solscanLink}  |  ${chartLink}`;
  if (flags.length > 0) {
    summary += `<br><br><strong>⚠️ Red Flags:</strong> ${flags.join(', ')}`;
  }
  return summary;
}

app.post('/api/scan', async (req, res) => {
  const { mintAddress } = req.body;
  if (!mintAddress) return res.status(400).json({ error: 'Missing address' });

  try {
    const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${mintAddress}`;
    const response = await fetch(url);
    const result = await response.json();
    const pair = result.pair;
    if (!pair) return res.status(404).json({ error: 'Pair not found' });

    const base = pair.baseToken || {};
    const liquidity = pair.liquidity || {};
    const volume = pair.volume || {};
    const txns = pair.txns?.h24 || {};
    const createdAt = pair.pairCreatedAt || Date.now();

    const rug = await fetchRugCheckLP(mintAddress);
    const ownershipStatus = await fetchSolscanOwnership(base.address);
    const holders = await fetchHoldersFromHelius(base.address);

    const summary = generateSummary(base, liquidity, volume, txns, [], mintAddress);

    res.json({
      name: base.name,
      symbol: base.symbol,
      summary,
      holders,
      liquidityLock: rug,
      ownershipStatus,
      mintAddress
    });
  } catch (err) {
    console.error("❌ Error in scan:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ R5 Secure Token Checker API running on port ${PORT}`);
});
