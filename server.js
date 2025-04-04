// server.js
const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the "public" folder.
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Existing endpoints for your app would be here (if any).

/**
 * New endpoint: /rugcheck/:tokenId
 * Calls the Python wrapper and returns its output as JSON.
 */
app.get('/rugcheck/:tokenId', (req, res) => {
  const tokenId = req.params.tokenId;
  // Build the command string. (Adjust the command if necessary.)
  const command = `python rugcheck_wrapper.py ${tokenId}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python wrapper: ${error}`);
      return res.status(500).json({ error: 'Error fetching rug checker data' });
    }
    try {
      const data = JSON.parse(stdout);
      res.json(data);
    } catch (parseError) {
      console.error(`Error parsing JSON output: ${parseError}`);
      res.status(500).json({ error: 'Error parsing rug checker data' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
