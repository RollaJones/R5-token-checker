const dotenv = require('dotenv');
dotenv.config();
console.log("HELIUS_KEY (from env):", process.env.HELIUS_KEY);

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch').default;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// === Vote Storage Setup ===
const voteFile = path.join(__dirname, 'votes.json');
let voteData = fs.existsSync(voteFile)
  ? JSON.parse(fs.readFileSync(voteFile, 'utf-8'))
  : {};

function saveVotes() {
  fs.writeFileSync(voteFile, JSON.stringify(voteData, null, 2));
}

// === Helper Function: Helius Top Holders Fetch ===
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
    console.error("Error fetching from Helius:", err);
    return [];
  }
}

// === Helper Function: Generate Summary ===
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

// === RugCheck Integration using Python Wrapper ===
async function fetchRugcheckData(mintAddress) {
  try {
    // Adjust the command if needed (use "python3" if that is your environment)
    const output = execSync(`python rugcheck_wrapper.py ${mintAddress}`, { encoding: 'utf-8' });
    const data = JSON.parse(output);
    if (data.error) {
      console.error("RugCheck error:", data.error);
      return null;
    }
    return data;
  } catch (e) {
    console.error("Error fetching RugCheck data:", e);
    return null;
  }
}

// === Updated Token Scan Endpoint ===
app.post('/api/scan', async (req, res) => {
  const { mintAddress, searchType = 'Pair' } = req.body;
  if (!mintAddress) return res.status(400).json({ error: 'Missing address' });

  try {
    let report = {};
    if (searchType === 'Token') {
      // --- Token ID Integration (RugCheck + Solscan) ---
      let rugcheckData = await fetchRugcheckData(mintAddress);
      if (!rugcheckData) {
        rugcheckData = { score: 'N/A', audit: 'N/A', kyc: 'N/A', tokenMeta: {} };
      }
      
      let solscanData = {};
      try {
        const solscanUrl = `https://public-api.solscan.io/token/${mintAddress}`;
        const solscanResponse = await fetch(solscanUrl, { headers: { "Accept": "application/json" } });
        const text = await solscanResponse.text();
        solscanData = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error("Solscan error:", e);
      }
      
      const lockStatus = solscanData.locked;
      const renounced = solscanData.isRenounced;
      const holders = solscanData.holders || [];
      const solscanDescription = solscanData.description || 'No description available.';
      
      const score = rugcheckData.score;
      const name = solscanData.name || (rugcheckData.tokenMeta && rugcheckData.tokenMeta.name) || 'Token';
      const audit = rugcheckData.audit || 'N/A';
      const kyc = rugcheckData.kyc || 'N/A';

      // Process risk summary and breakdown from RugCheck data
      let riskSummary = "";
      let riskBreakdown = [];
      if (rugcheckData.risks && Array.isArray(rugcheckData.risks)) {
        riskBreakdown = rugcheckData.risks.map(risk => ({
          metric: risk.name,
          condition: risk.value || "",
          scoreAdjustment: risk.score,
          explanation: risk.description || ""
        }));
        riskSummary = `Risk Summary: ${rugcheckData.risks.map(risk => `${risk.name} (Score: ${risk.score})`).join(", ")}`;
      }
      
      report = {
        // Basic Info
        name,
        score,
        summary: `RugCheck Score: ${score}. ${solscanDescription}`,
        audit,
        kyc,
        mintAddress,
        tokenMintAddress: mintAddress,
        description: solscanDescription,
        // Data from Solscan and RugCheck
        liquidityLock: { locked: lockStatus, renounced: renounced },
        holders,
        walletActivity: solscanData.walletActivity || 'Unavailable – refer to Solscan owner section',
        trustScore: solscanData.trustScore || 'N/A',
        scamReports: solscanData.scamReports || 'N/A',
        flags: solscanData.flags || [],
        // Risk Data
        riskSummary,
        riskBreakdown,
        // Raw data objects for debugging / full data view
        rugcheckData,
        solscanData,
        // Include token metadata if available
        tokenMeta: rugcheckData.tokenMeta || {}
      };
    } else {
      // --- Pair ID Integration (Dexscreener + Helius) ---
      const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${mintAddress}`;
      const response = await fetch(url);
      const result = await response.json();
      const pair = result.pair;
      if (!pair) return res.status(404).json({ error: 'Pair not found' });

      const base = pair.baseToken || {};
      const liquidity = pair.liquidity || {};
      const volume = pair.volume || {};
      const txns = pair.txns?.h24 || {};
      const lockInfo = result.liquidityLock || {};
      const createdAt = pair.pairCreatedAt || Date.now();

      const tokenMintAddress = base.address;
      const holders = await fetchHoldersFromHelius(tokenMintAddress);
      const flags = [];
      let score = 50;

      if (liquidity.usd > 20000) score += 10;
      else if (liquidity.usd >= 10000) {
        score += 3;
        flags.push("Moderate liquidity");
      } else if (liquidity.usd > 5000) {
        score -= 2;
        flags.push("Low liquidity");
      } else {
        score -= 10;
        flags.push("Very low liquidity");
      }

      if (lockInfo.locked) score += 5;
      else {
        score -= 10;
        flags.push("LP not locked");
      }
      if (lockInfo.renounced) score += 10;
      else {
        score -= 10;
        flags.push("Ownership not renounced");
      }

      if (volume.h24 > 100000) score += 10;
      else if (volume.h24 >= 25000) score += 5;
      else if (volume.h24 <= 10000) {
        score -= 5;
        flags.push("Low trading volume");
      }

      const topHolderPercent = holders[0]?.percent;
      if (topHolderPercent > 20) {
        score -= 10;
        flags.push(`Top holder owns ${topHolderPercent}%`);
      } else if (topHolderPercent > 10) score -= 5;

      const audit = result.audit || 'N/A';
      const kyc = result.kyc || 'N/A';
      if (audit === 'N/A') flags.push("No audit found");
      if (kyc === 'N/A' || kyc === 'Not Verified') flags.push("KYC not verified");

      let walletActivity = result.walletActivity || 'Unavailable – refer to Solscan owner section';
      if (walletActivity === 'Clean') score += 5;
      else if (walletActivity === 'Suspicious') {
        score -= 10;
        flags.push("Dev wallet suspicious");
      } else if (!walletActivity || walletActivity === 'Unknown') {
        flags.push("Dev wallet unknown");
      }

      const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      if (daysOld < 2) {
        score -= 5;
        flags.push("New token");
      }

      score -= flags.length * 1.5;
      score = Math.max(0, Math.min(100, score));

      const summary = generateSummary(base, liquidity, volume, txns, flags, tokenMintAddress);

      report = {
        name: base.name,
        symbol: base.symbol,
        score,
        liquidityUSD: liquidity.usd,
        volumeH24: volume.h24,
        txns,
        holders,
        audit,
        kyc,
        blacklistFunction: result.blacklistFunction || 'N/A',
        walletActivity,
        trustScore: result.trustScore || 'N/A',
        scamReports: result.scamReports || 'N/A',
        liquidityLock: lockInfo,
        pairCreatedAt: createdAt,
        flags,
        summary,
        mintAddress,
        tokenMintAddress,
        description: `Liquidity: $${liquidity.usd} | Volume 24h: $${volume.h24}`,
        // For pair integration, risk fields are not computed
        riskSummary: '',
        riskBreakdown: [],
        // Include full raw data from dexscreener (and other pair-related info)
        dexscreenerData: result
      };
    }
    res.json(report);
  } catch (err) {
    console.error("Error in scan:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// === Vote Submission Endpoint ===
app.post('/api/vote', (req, res) => {
  const { mintAddress, vote, comment } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!mintAddress || !vote) {
    return res.status(400).json({ success: false, message: "Missing vote or token." });
  }

  voteData[mintAddress] = voteData[mintAddress] || { votes: [], ips: {} };
  if (voteData[mintAddress].ips[ip]) {
    return res.status(403).json({ success: false, message: "Already voted." });
  }

  const cleanComment = String(comment || '').replace(/</g, "&lt;").substring(0, 200);
  voteData[mintAddress].votes.unshift({ vote, comment: cleanComment, ip, timestamp: Date.now() });
  voteData[mintAddress].ips[ip] = true;

  voteData[mintAddress].votes = voteData[mintAddress].votes.slice(0, 50);
  saveVotes();

  const recent = voteData[mintAddress].votes.slice(0, 5).map(v => ({ vote: v.vote, comment: v.comment }));
  res.json({ success: true, comments: recent });
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
