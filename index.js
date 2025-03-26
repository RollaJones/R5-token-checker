const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const scanRoutes = require('./routes/scan');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/scan', scanRoutes);

app.listen(PORT, () => {
    console.log(`R5 Secure Token Checker API running on port ${PORT}`);
});