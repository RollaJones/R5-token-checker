const dotenv = require('dotenv');
dotenv.config(); // Load environment variables from .env file
console.log("HELIUS_KEY (from env):", process.env.HELIUS_KEY);

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

app.post('/api/scan', async (req, res) => {
  const { mintAddress } = req.body;
  console.log("🔍 scanToken called");

  if (!mintAddress) return res.status(400).json({ error: 'Missing address' });

  try {
    const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${mintAddress}`;
    console.log("🌐 Fetching from DexScreener:", url);
    const response = await fetch(url);
    const result = await response.json();
    const pair = result.pairs ? result.pairs[0] : null;

    if (!pair) return res.status(404).json({ error: 'Pair not found' });

    const base = pair.baseToken || {};
    const liquidity = pair.liquidity || {};
    const volume = pair.volume || {};
    const txns = pair.txns?.h24 || {};
    const createdAt = pair.pairCreatedAt || Date.now();
    const pairAddress = pair.pairAddress;

    // === SCORING & FLAGS ===
    const flags = [];
    let score = 50;

    // Liquidity Risk
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

    // LP Lock
    if (pair.liquidity?.locked) {
      score += 5;
    } else {
      score -= 10;
      flags.push("LP not locked");
    }

    // Ownership
    if (pair.liquidity?.renounced) {
      score += 10;
    } else {
      score -= 10;
      flags.push("Ownership not renounced");
    }

    // Volume
    if (volume.h24 > 100000) {
      score += 10;
    } else if (volume.h24 >= 25000) {
      score += 5;
    } else if (volume.h24 <= 10000) {
      score -= 5;
      flags.push("Low trading volume");
    }

    // Top Holder Risk
    const holders = []; // Placeholder for holder data
    const topHolderPercent = holders.length > 0 ? holders[0].percent : 0;
    if (topHolderPercent > 20) {
      score -= 10;
      flags.push(`Top holder owns ${topHolderPercent}%`);
    } else if (topHolderPercent > 10) {
      score -= 5;
    }

    // Audit / KYC
    if (pair.audit === 'Certik') score += 5;
    else {
      flags.push("No audit found");
    }

    if (pair.kyc === 'Verified') score += 5;
    else {
      flags.push("KYC not verified");
    }

    // Dev Wallet Activity
    if (pair.walletActivity === 'Clean') {
      score += 5;
    } else if (pair.walletActivity === 'Suspicious') {
      score -= 10;
      flags.push("Dev wallet suspicious");
    } else {
      flags.push("Dev wallet unknown");
    }

    // Token Age
    const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    if (daysOld < 2) {
      score -= 5;
      flags.push("New token");
    }

    // Final score logic
    score -= flags.length * 1.5;
    score = Math.max(0, Math.min(100, score));

    // Grade
    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 45) grade = 'D';

    const summary = generateSummary(base, liquidity, volume, txns, flags, mintAddress);

    res.json({
      name: base.name,
      symbol: base.symbol,
      score,
      grade,
      liquidityUSD: liquidity.usd,
      holders,
      audit: pair.audit || 'N/A',
      kyc: pair.kyc || 'N/A',
      blacklistFunction: pair.blacklistFunction || 'N/A',
      walletActivity: pair.walletActivity || 'Unknown',
      trustScore: pair.trustScore || 'N/A',
      scamReports: pair.scamReports || 'N/A',
      liquidityLock: pair.liquidity?.locked || false,
      pairCreatedAt: createdAt,
      flags,
      summary,
      pairAddress
    });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateSummary(base, liquidity, volume, txns, flags = [], mintAddress = "") {
  const name = base.name || 'Token';
  const symbol = base.symbol || 'SYM';
  const liqStr = `$${Number(liquidity.usd || 0).toLocaleString()}`;
  const volStr = `$${Number(volume.h24 || 0).toLocaleString()}`;
  const buyCount = txns.buys || 0;
  const sellCount = txns.sells || 0;
  const solscanLink = `🔍 <a href="https://solscan.io/token/${mintAddress}" target="_blank">View on Solscan</a>`;

  let summary = `${name} (${symbol}) has ${liqStr} liquidity and ${volStr} 24h volume. Buys: ${buyCount}, Sells: ${sellCount}.<br>${solscanLink}`;

  if (flags.length > 0) {
    summary += `<br><br><strong>⚠️ Red Flags:</strong> ${flags.join(', ')}`;
  }

  return summary;
}

app.listen(PORT, () => {
  console.log(`✅ R5 Secure Token Checker API running on port ${PORT}`);
});
