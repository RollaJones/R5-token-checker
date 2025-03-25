
function fetchTokenData() {
    const mint = document.getElementById('mintInput').value.trim();
    const apiUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${mint}`;

    fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
            const pair = data.pairs[0];
            if (pair) {
                document.getElementById('tokenName').textContent = pair.baseToken.name;
                document.getElementById('tokenSymbol').textContent = pair.baseToken.symbol;
                document.getElementById('tokenPrice').textContent = parseFloat(pair.priceUsd).toFixed(4);
                document.getElementById('tokenLiquidity').textContent = pair.liquidity.usd;
                document.getElementById('tokenVolume').textContent = pair.volume.h24;
                document.getElementById('tokenLastTrade').textContent = new Date(pair.updatedAt).toLocaleString();
                document.getElementById('tokenResult').style.display = 'block';
            } else {
                alert("Token data not found. Make sure this is a valid mint address.");
            }
        })
        .catch(err => {
            console.error(err);
            alert("Failed to fetch token data.");
        });
}
