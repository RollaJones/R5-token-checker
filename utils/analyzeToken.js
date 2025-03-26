const axios = require('axios');

async function analyzeToken(mintAddress) {
    const dexURL = `https://api.dexscreener.com/latest/dex/pairs/solana/${mintAddress}`;
    const birdeyeURL = `https://public-api.birdeye.so/public/token/${mintAddress}`;

    console.log("Trying DexScreener:", dexURL);

    let dexData = null;
    let dexError = null;

    try {
        const { data } = await axios.get(dexURL);
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

        dexData = data;
    } catch (err) {
        dexError = err.message;
        console.error("DexScreener error:", err.message);
    }

    console.log("Falling back to Birdeye:", birdeyeURL);

    let birdeyeData = null;
    let birdeyeError = null;

    try {
        const { data } = await axios.get(birdeyeURL, {
            headers: { 'x-chain': 'solana' }
        });

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

        birdeyeData = data;
    } catch (err) {
        birdeyeError = err.message;
        console.error("Birdeye error:", err.message);
    }

    // Fallback debug return
    return {
        status: "Token not found on DexScreener or Birdeye. It may not be active or indexed yet.",
        debug: true,
        dexscreener: {
            url: dexURL,
            error: dexError,
            response: dexData
        },
        birdeye: {
            url: birdeyeURL,
            error: birdeyeError,
            response: birdeyeData
        },
        success: false
    };
}

module.exports = analyzeToken;
