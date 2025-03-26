const axios = require('axios');

async function analyzeToken(mintAddress) {
    const apiUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${mintAddress}`;

    try {
        const { data } = await axios.get(apiUrl);
        if (!data || !data.pair) {
            throw new Error('Token not found');
        }

        const pair = data.pair;

        const report = {
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            liquidityUSD: pair.liquidity.usd,
            holders: pair.pairCreatedAt,
            score: 0,
            flags: [],
        };

        if (pair.liquidity.usd > 10000) {
            report.score += 20;
        } else {
            report.flags.push('Low liquidity');
        }

        return report;
    } catch (err) {
        throw err;
    }
}

module.exports = analyzeToken;