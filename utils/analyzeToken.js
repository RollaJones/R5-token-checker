const axios = require('axios');

async function analyzeToken(mintAddress) {
    // Try DexScreener first
    const dexURL = `https://api.dexscreener.com/latest/dex/pairs/solana/${mintAddress}`;
    console.log("Trying DexScreener:", dexURL);

    try {
        const { data } = await axios.get(dexURL);
        if (data && data.pair) {
            const pair = data.pair;
            return {
                name: pair.baseToken.name,
                symbol: pair.baseToken.symbol,
                liquidityUSD: pair.liquidity.usd,
                holders: pair.pairCreatedAt,
                score: pair.liquidity.usd > 10000 ? 20 : 0,
                flags: pair.liquidity.usd > 10000 ? [] : ['Low liquidity'],
                source: 'DexScreener'
            };
        }
    } catch (err) {
        console.error("DexScreener error:", err.message);
    }

    // Fallback to Birdeye
    const birdeyeURL = `https://public-api.birdeye.so/public/token/${mintAddress}`;
    console.log("Falling back to Birdeye:", birdeyeURL);

    try {
        const { data } = await axios.get(birdeyeURL, {
            headers: { 'x-chain': 'solana' }
        });

        return {
            name: data.name || 'Unknown',
            symbol: data.symbol || '???',
            liquidityUSD: data.liquidity?.usd || 0,
            holders: data.holders || 0,
            score: data.liquidity?.usd > 10000 ? 20 : 0,
            flags: data.liquidity?.usd > 10000 ? [] : ['Low liquidity'],
            source: 'Birdeye'
        };

    } catch (err) {
        console.error("Birdeye error:", err.message);
        return { error: "Token not found on DexScreener or Birdeye." };
    }
}

module.exports = analyzeToken;
