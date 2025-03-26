const axios = require('axios');

async function analyzeToken(mintAddress) {
    const dexURL = `https://api.dexscreener.com/latest/dex/pairs/solana/${mintAddress}`;
    console.log("Trying DexScreener:", dexURL);

    try {
        const response = await axios.get(dexURL);
        const data = response.data;

        console.log("DexScreener response:", JSON.stringify(data, null, 2));

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
        const response = await axios.get(birdeyeURL, {
            headers: { 'x-chain': 'solana' }
        });
        const data = response.data;

        console.log("Birdeye response:", JSON.stringify(data, null, 2));

        if (data && (data.name || data.symbol)) {
            return {
                name: data.name || 'Unknown',
                symbol: data.symbol || '???',
                liquidityUSD: data.liquidity?.usd || 0,
                holders: data.holders || 0,
                score: data.liquidity?.usd > 10000 ? 20 : 0,
                flags: data.liquidity?.usd > 10000 ? [] : ['Low liquidity'],
                source: 'Birdeye'
            };
        }
    } catch (err) {
        console.error("Birdeye error:", err.message);
    }

    // Final fallback
    return {
        status: "Token not found on DexScreener or Birdeye. It may not be active or indexed yet.",
        success: false
    };
}

module.exports = analyzeToken;
