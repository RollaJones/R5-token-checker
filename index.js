const dotenv = require('dotenv');
dotenv.config();
console.log("HELIUS_KEY (from env):", process.env.HELIUS_KEY);

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

const voteFile = path.join(__dirname, 'votes.json');
let voteData = fs.existsSync(voteFile) ? JSON.parse(fs.readFileSync(voteFile, 'utf-8')) : {};
function saveVotes() {
  fs.writeFileSync(voteFile, JSON.stringify(voteData, null, 2));
}

// Helper function to fetch data from Helius
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.errors) {
      console.error("Helius API Error:", data.errors);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}
// === Fetch Top Holders ===
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

// === Solscan Ownership + LP Lock Fallback ===
async function fetchSolscanFallback(mint, lpTokenAddr) {
  const headers = { accept: 'application/json' };
  const baseURL = 'https://public-api.solscan.io';

  let renounced = null;
  let lpLocked = null;

  try {
    const tokenMeta = await fetch(`${baseURL}/token/meta?tokenAddress=${mint}`, { headers });
    const meta = await tokenMeta.json();
    renounced = !meta?.owner || meta.owner === '11111111111111111111111111111111';

    if (lpTokenAddr) {
      const holdersRes = await fetch(`${baseURL}/token/holders?tokenAddress=${lpTokenAddr}&limit=10`, { headers });
      const holderData = await holdersRes.json();
      const firstHolder = holderData?.data?.[0];

      if (firstHolder) {
        const addr = firstHolder.owner;
        lpLocked = addr === '11111111111111111111111111111111' || addr.includes('lock') || addr.includes('burn');
      }
    }
  } catch (e) {
    console.warn("⚠️ Solscan fallback failed:", e.message);
  }

  return { renounced, lpLocked };
}

// Function to get token metadata from Helius
async function getMetadata(mintAddress) {
  const url = `https://api.helius.xyz/v0/tokens/metadata?mint=${mintAddress}&api-key=${process.env.HELIUS_KEY}`;
  return fetchData(url);
}

// Function to get Raydium pool information.
async function getRaydiumPool(mintAddress) {
  // 1.  You'll need a way to map from a mint address to a Raydium pool.  This is complex.
  //     For this example, I'm going to use a hardcoded value.  In a real application, you'd
  //     need a lookup table, or a way to query the Raydium program.
  const poolAddress = "8HoQjkc4WvPQtLdWtAFjJYjZk5oPdjM3na9t9iZKwT4o";  // Example Pool - Bonk/USDC
  if (!poolAddress) {
    return { error: "No Raydium pool found for this mint address." };
  }
  const url = `https://api.helius.xyz/v0/account-info?account=${poolAddress}&api-key=${process.env.HELIUS_KEY}`;
  const response = await fetch(url);
  const accountInfo = await response.json();

  if (!accountInfo) {
    return { error: "Failed to fetch account info" };
  }

  if (accountInfo.error) {
    console.error("Helius API error:", accountInfo.error);
    return { error: "Helius API error: " + accountInfo.error.message };
  }
  const parsedData = accountInfo.result.data.parsed;

  if (!parsedData) {
    return { error: "Failed to parse account data." };
  }
  return parsedData;
}

// === Token Scan Endpoint ===
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

    const rawLockInfo = result.liquidityLock || {};
    let liquidityLock = {
      locked: rawLockInfo.locked ?? null,
      until: rawLockInfo.until ?? null,
      renounced: rawLockInfo.renounced ?? null
    };

    // 🔁 Solscan fallback if needed
    if (liquidityLock.locked === null || liquidityLock.renounced === null) {
      const fallback = await fetchSolscanFallback(base.address, pair.lpToken?.address);
      if (liquidityLock.locked === null) liquidityLock.locked = fallback.lpLocked;
      if (liquidityLock.renounced === null) liquidityLock.renounced = fallback.renounced;
    }
    const holders = await fetchHoldersFromHelius(base.address);
    const metadata = await getMetadata(mintAddress);  // Fetch metadata
    const raydiumPoolData = await getRaydiumPool(mintAddress); //get raydium data

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

    if (liquidityLock.locked === true) score += 5;
    else if (liquidityLock.locked === false) {
      score -= 10;
      flags.push("LP not locked");
    } else {
      flags.push("LP lock status unknown");
    }

    if (liquidityLock.renounced === true) score += 10;
    else if (liquidityLock.renounced === false) {
      score -= 10;
      flags.push("Ownership not renounced");
    } else {
      flags.push("Ownership status unknown");
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

    let ownership = 'Ownership data unavailable';
    if (metadata && metadata.onChainData) {
      ownership = {
        creator: metadata.onChainData.data.creators[0]?.address,
        updateAuthority: metadata.onChainData.updateAuthority
      };
    }

    let liquidityDetails = 'Liquidity data unavailable';
    if (raydiumPoolData && !raydiumPoolData.error) {
      const tokenA = "USDC"; // These would normally come from the pool data
      const tokenB = "BONK";
      const liquidityA = raydiumPoolData.tokenAmountA;
      const liquidityB = raydiumPoolData.tokenAmountB;
      liquidityDetails = {
        liquidityA: {
          token: tokenA,
          amount: liquidityA
        },
        liquidityB: {
          token: tokenB,
          amount: liquidityB
        }
      };
    } else if (raydiumPoolData?.error) {
      liquidityDetails = raydiumPoolData.error;
    }

    const summary = generateSummary(base, liquidity, volume, txns, flags, mintAddress);

    res.json({
      name: base.name,
      symbol: base.symbol,
      score,
      liquidityUSD: liquidity.usd,
      holders,
      audit,
      kyc,
      blacklistFunction: result.blacklistFunction || 'N/A',
      walletActivity,
      trustScore: result.trustScore || 'N/A',
      scamReports: result.scamReports || 'N/A',
      liquidityLock,
      pairCreatedAt: createdAt,
      flags,
      summary,
      mintAddress,
      ownership: ownership, // Include ownership data in the response
      liquidityDetails: liquidityDetails // Include liquidity details
    });
  } catch (err) {
    console.error("❌ Error in scan:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// === Vote System (unchanged) ===
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

function generateSummary(base, liquidity, volume, txns, flags = [], mintAddress = "") {
  const name = base.name || 'Token';
  const symbol = base.symbol || 'SYM';
  const liqStr = `$${Number(liquidity.usd || 0).toLocaleString()}`;
  const volStr = `$${Number(volume.h24 || 0).toLocaleString()}`;
  const buyCount = txns.buys || 0;
  const sellCount = txns.sells || 0;

  const solscanLink = `🔍 <a href="https://solscan.io/account/${mintAddress}" target="_blank">View on Solscan</a>`;
  const chartLink = `📊 <a href="https://dexscreener.com/solana/${mintAddress}" target="_blank">View Chart</a>`;
  let summary = `${name} (${symbol}) has ${liqStr} liquidity and ${volStr} 24h volume. Buys: ${buyCount}, Sells: ${sellCount}.<br>${solscanLink}  |  ${chartLink}`;

  if (flags.length > 0) {
    summary += `<br><br><strong>⚠️ Red Flags:</strong> ${flags.join(', ')}`;
  }

  return summary;
}

app.listen(PORT, () => {
  console.log(`✅ R5 Secure Token Checker API running on port ${PORT}`);
});
