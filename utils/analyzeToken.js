const axios = require('axios');

async function analyzeToken(mintAddress) {
    const dexURL = `https://api.dexscreener.com/latest/dex/pairs/solana/${mintAddress}`;
    const birdeyeURL = `https://public-api.birdeye.so/public/token/${mintAddress}`;
    const heliusTxURL = `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${process.env.HELIUS_KEY}`;

    let dexData = null;
    let birdeyeData = null;
    let heliusTxData = null;
    let heliusError = null;

    // --- Try DexScreener ---
    console.log("Trying DexScreener:", dexURL);
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
        console.error("DexScreener error:", err.message);
    }

    // --- Try Birdeye ---
    console.log("Falling back to Birdeye:", birdeyeURL);
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
        console.error("Birdeye error:", err.message);
    }

    // --- Final Fallback: Helius (check if token is used on-chain) ---
    console.log("Checking Helius transaction history:", heliusTxURL);
    try {
        const { data } = await axios.get(heliusTxURL);
        console.log("Helius TX response:", JSON.stringify(data?.[0] || {}, null, 2));

        if (Array.isArray(data) && data.length > 0) {
            return {
                status: "Token not found on Dex or Birdeye, but is active on-chain.",
                recentTransactions: data.length,
                source: "Helius",
                success: true
            };
        }

        heliusTxData = data;
    } catch (err) {
        heliusError = err.message;
        console.error("Helius error:", err.message);
    }

    // --- Final fallback if all fail ---
    return {
        status: "Token not found on DexScreener, Birdeye, or Helius.",
        debug: true,
        success: false,
        dexscreener: {
            url: dexURL,
            response: dexData
        },
        birdeye: {
            url: birdeyeURL,
            response: birdeyeData
        },
        helius: {
            url: heliusTxURL,
            response: heliusTxData,
            error: heliusError
        }
    };
}

module.exports = analyzeToken;
