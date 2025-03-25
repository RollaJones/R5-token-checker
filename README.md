# R5 Secure Token Checker

The **R5 Secure Token Checker** is a web-based tool designed to help crypto traders and researchers evaluate the safety of newly launched Solana tokens in real-time. It provides early warnings on potential rug pulls, liquidity risks, suspicious wallet activity, and other red flags.

---

## Features

### Frontend (UI)
- Token safety dashboard
- Collapsible sections for:
  - Token history & sentiment
  - Liquidity & ownership
  - Audit & contract functions
  - Wallet activity
  - Holder data
  - Community reports & votes
- Token search bar (mint address)
- Wallet scanner input
- Responsive, dark-themed layout

### Backend (API)
- Node.js + Express API
- Integrates with **DexScreener API**
- Fetches real-time token data (name, liquidity, symbol)
- Analyzes for risk flags and generates a safety score

---

## Project Structure
R5-token-checker/ backend/ index.js routes/ # Main backend server L utils/ analyzeToken.js frontend/ scan.js # Risk analysis index.html script.js #JS to API route: POST /api/scan # Main UI logic L style.css connect to backend # Styling for the UI README.md

