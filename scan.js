const express = require('express');
const router = express.Router();
const analyzeToken = require('../utils/analyzeToken');

router.post('/', async (req, res) => {
    const { mintAddress } = req.body;

    if (!mintAddress) {
        return res.status(400).json({ error: 'Mint address is required' });
    }

    try {
        const report = await analyzeToken(mintAddress);
        res.json(report);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to analyze token' });
    }
});

module.exports = router;