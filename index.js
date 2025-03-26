const dotenv = require('dotenv');
dotenv.config(); // MUST come first to load env variables
console.log("HELIUS_KEY (from env):", process.env.HELIUS_KEY);

const express = require('express');
const cors = require('cors');
const scanRoutes = require('./routes/scan');

const app = express();
const PORT = process.env.PORT || 5000;

console.log("Detected PORT from environment:", PORT);

app.use(cors());
app.use(express.json());
app.use('/api/scan', scanRoutes);

app.listen(PORT, () => {
    console.log(`R5 Secure Token Checker API running on port ${PORT}`);
});
