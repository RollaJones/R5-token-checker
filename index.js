const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const scanRoutes = require('./routes/scan');

dotenv.config();
const app = express();

// Use only the port provided by Railway
const PORT = process.env.PORT;

console.log("Detected PORT from environment:", PORT);

app.use(cors());
app.use(express.json());
app.use('/api/scan', scanRoutes);

app.listen(PORT, () => {
    console.log(`R5 Secure Token Checker API running on port ${PORT}`);
});
