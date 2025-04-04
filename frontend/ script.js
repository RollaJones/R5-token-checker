// Global arrays to store search results
let tokenReports = []; // Reports from Token ID searches
let pairReports = [];  // Reports from Pair ID searches
let unifiedReports = []; // Merged reports

// Merge reports (for unified view)
function mergeReports(tokenReport, pairReport) {
  const unified = {};
  unified.name = tokenReport.name || pairReport.name;
  unified.tokenMintAddress = tokenReport.tokenMintAddress || pairReport.tokenMintAddress;
  unified.mintAddress = tokenReport.mintAddress || pairReport.mintAddress;
  unified.symbol = pairReport.symbol || tokenReport.symbol || '';
  if (tokenReport.score !== 'N/A' && pairReport.score !== 'N/A') {
    unified.score = ((Number(tokenReport.score) + Number(pairReport.score)) / 2).toFixed(0);
  } else {
    unified.score = tokenReport.score !== 'N/A' ? tokenReport.score : pairReport.score;
  }
  unified.summary = (tokenReport.summary || '') + '<br><br>' + (pairReport.summary || '');
  unified.audit = tokenReport.audit || pairReport.audit || 'N/A';
  unified.kyc = tokenReport.kyc || pairReport.kyc || 'N/A';
  unified.liquidityLock = pairReport.liquidityLock || tokenReport.liquidityLock || {};
  // Merge holders by address
  const holdersMap = {};
  (tokenReport.holders || []).concat(pairReport.holders || []).forEach(h => {
    holdersMap[h.address] = h;
  });
  unified.holders = Object.values(holdersMap);
  unified.walletActivity = pairReport.walletActivity || tokenReport.walletActivity || 'Unavailable';
  unified.trustScore = pairReport.trustScore || tokenReport.trustScore || 'N/A';
  unified.scamReports = pairReport.scamReports || tokenReport.scamReports || 'N/A';
  unified.flags = tokenReport.flags || pairReport.flags || [];
  unified.riskSummary = tokenReport.riskSummary || pairReport.riskSummary || '';
  unified.riskBreakdown = tokenReport.riskBreakdown || pairReport.riskBreakdown || [];
  // Additional fields
  unified.contractInfo = tokenReport.contractInfo || {};
  unified.ownership = tokenReport.ownership || {};
  unified.liquidity = tokenReport.liquidity || {};
  unified.trading = tokenReport.trading || {};
  unified.external = tokenReport.external || {};
  unified.finalSummary = tokenReport.finalSummary || pairReport.finalSummary || '';
  return unified;
}

// Update dropdown menus for previous searches
function updateDropdowns() {
  const tokenSelect = document.getElementById('tokenSearchSelect');
  const pairSelect = document.getElementById('pairSearchSelect');
  const unifiedSelect = document.getElementById('unifiedSearchSelect');
  tokenSelect.options.length = 1;
  pairSelect.options.length = 1;
  unifiedSelect.options.length = 1;
  tokenReports.forEach((report, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.text = report.name + ' (' + report.tokenMintAddress + ')';
    tokenSelect.appendChild(option);
  });
  pairReports.forEach((report, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.text = report.name + ' (' + report.tokenMintAddress + ')';
    pairSelect.appendChild(option);
  });
  unifiedReports = [];
  const tokenByMint = {};
  tokenReports.forEach(report => { tokenByMint[report.tokenMintAddress] = report; });
  pairReports.forEach(report => {
    if (tokenByMint[report.tokenMintAddress]) {
      unifiedReports.push(mergeReports(tokenByMint[report.tokenMintAddress], report));
    }
  });
  unifiedReports.forEach((report, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.text = report.name + ' (' + report.tokenMintAddress + ')';
    unifiedSelect.appendChild(option);
  });
}

// Display a report in all category sections
function displayReport(type) {
  let report;
  if (type === 'token') {
    const index = document.getElementById('tokenSearchSelect').value;
    if (index === "") return;
    report = tokenReports[index];
  } else if (type === 'pair') {
    const index = document.getElementById('pairSearchSelect').value;
    if (index === "") return;
    report = pairReports[index];
  } else if (type === 'unified') {
    const index = document.getElementById('unifiedSearchSelect').value;
    if (index === "") return;
    report = unifiedReports[index];
  }
  if (!report) return;
  console.log("Displaying report:", report);
  
  // Update Main Title and Overall Score
  document.getElementById('reportTitle').textContent = report.name + ' Safety Report';
  document.querySelector('#scoreCard strong').textContent = report.score || 'N/A';
  
  // Risk Assessment Section
  if (report.riskSummary) {
    document.getElementById('riskSummaryCard').style.display = 'block';
    document.getElementById('riskSummaryText').textContent = `Overall Score: ${report.score} → ${report.riskSummary}`;
  } else {
    document.getElementById('riskSummaryCard').style.display = 'none';
  }
  
  // Token Summary (including RugCheck summary if present)
  let fullSummary = report.summary || 'No summary available.';
  if (report.rugcheck_summary) {
    fullSummary += `<br><br>RugCheck Score: ${report.rugcheck_score} - ${report.rugcheck_summary}`;
  }
  document.getElementById('tokenSummary').innerHTML = fullSummary;
  
  // --- Display Contract Information ---
  const contract = report.contractInfo || {};
  document.getElementById('contractAddress').textContent = `Contract Address: ${contract.address || report.tokenMintAddress || 'N/A'}`;
  document.getElementById('tokenNameSymbol').textContent = `Token Name & Symbol: ${contract.name || report.name || 'N/A'} (${contract.symbol || report.symbol || 'N/A'})`;
  document.getElementById('totalSupply').textContent = `Total Supply: ${contract.totalSupply || 'N/A'}`;
  document.getElementById('decimals').textContent = `Decimals: ${contract.decimals || 'N/A'}`;
  document.getElementById('tokenType').textContent = `Token Type: ${contract.tokenType || 'N/A'}`;
  document.getElementById('contractAge').textContent = `Contract Age: ${contract.age || 'N/A'}`;
  
  // --- Ownership & Governance ---
  const ownership = report.ownership || {};
  document.getElementById('ownershipStatusData').textContent = `Ownership Status: ${ownership.status || 'N/A'}`;
  document.getElementById('adminPrivileges').textContent = `Admin Privileges: ${ownership.admin || 'N/A'}`;
  
  // --- Liquidity Pool Analysis ---
  const liquidity = report.liquidity || {};
  document.getElementById('liquidityAmount').textContent = `Liquidity Amount (USD): ${liquidity.amount || 'N/A'}`;
  document.getElementById('lpLockStatus').textContent = `Liquidity Lock Status: ${liquidity.locked ? 'Locked' : 'Not Locked'}`;
  document.getElementById('liquidityPair').textContent = `Liquidity Pair: ${liquidity.pair || 'N/A'}`;
  document.getElementById('liquidityOwnership').textContent = `Ownership of Liquidity: ${liquidity.ownership || 'N/A'}`;
  
  // --- Trading Volume & Transaction Analysis ---
  const trading = report.trading || {};
  document.getElementById('volume24h').textContent = `24h Volume: ${trading.volume || 'N/A'}`;
  document.getElementById('buySellRatio').textContent = `Buy/Sell Ratio: ${trading.buySellRatio || 'N/A'}`;
  document.getElementById('numHolders').textContent = `Number of Holders: ${trading.holders || 'N/A'}`;
  document.getElementById('numTransactions').textContent = `Number of Transactions: ${trading.txns || 'N/A'}`;
  document.getElementById('newWalletActivity').textContent = `New Wallet Activity: ${trading.newWallet || 'N/A'}`;
  
  // --- Holder Distribution Analysis ---
  const holderList = document.getElementById('holderList');
  if (report.holders && report.holders.length) {
    holderList.innerHTML = report.holders.map((h, i) =>
      `<li>Wallet ${i + 1}: ${h.percent}% - ${h.address.slice(0, 4)}...${h.address.slice(-4)}</li>`
    ).join('');
  } else {
    holderList.innerHTML = '<li>No holder data found.</li>';
  }
  
  // --- Code Audit & KYC Audit Status ---
  document.getElementById('auditStatusData').textContent = `Audit: ${report.audit || 'N/A'}`;
  document.getElementById('kycStatusData').textContent = `KYC Status: ${report.kyc || 'N/A'}`;
  
  // --- Blacklist Functions & Permissions ---
  document.getElementById('blacklistFunction').textContent = `Blacklist Function: ${report.blacklistStatus || 'N/A'}`;
  document.getElementById('mintingFunction').textContent = `Minting Function: ${report.mintingFunction || 'N/A'}`;
  document.getElementById('burningFunction').textContent = `Burning Function: ${report.burningFunction || 'N/A'}`;
  
  // --- External & Community Data ---
  const external = report.external || {};
  document.getElementById('socialMedia').textContent = `Social Media Presence: ${external.socialMedia || 'N/A'}`;
  document.getElementById('communityVoting').textContent = `Community Voting: ${external.communityVoting || 'N/A'}`;
  document.getElementById('userReports').textContent = `User Reports: ${external.userReports || 'N/A'}`;
  document.getElementById('scamReportsData').textContent = `Recent Scam Reports: ${report.scamReports || 'N/A'}`;
  
  // --- Risk Breakdown Table ---
  const riskTableBody = document.getElementById('riskBreakdownTable').getElementsByTagName('tbody')[0];
  riskTableBody.innerHTML = '';
  if (report.riskBreakdown && report.riskBreakdown.length) {
    report.riskBreakdown.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `<td style="border:1px solid #333; padding:5px;">${item.metric || 'N/A'}</td>
                       <td style="border:1px solid #333; padding:5px;">${item.condition || 'N/A'}</td>
                       <td style="border:1px solid #333; padding:5px;">${item.scoreAdjustment || 'N/A'}</td>
                       <td style="border:1px solid #333; padding:5px;">${item.explanation || 'N/A'}</td>`;
      riskTableBody.appendChild(row);
    });
  } else {
    riskTableBody.innerHTML = '<tr><td colspan="4" style="border:1px solid #333; padding:5px;">No risk breakdown available.</td></tr>';
  }
  
  // --- Final Summary & Recommendations ---
  document.getElementById('finalSummary').textContent = report.finalSummary || 'No recommendations available.';
}

function toggleContent(element) {
  const content = element.nextElementSibling;
  content.style.display = content.style.display === "block" ? "none" : "block";
}

// Adjustable Risk Assessment Calculation
function calculateRiskAssessment(data) {
  let riskScore = 50; // Base score
  if (data.liquidity && data.liquidity.amount < 20000) riskScore -= 20;
  if (data.liquidity && !data.liquidity.locked) riskScore -= 30;
  if (data.ownership && data.ownership.status !== 'Renounced') riskScore -= 20;
  if (data.trading && data.trading.volume < 10000) riskScore -= 15;
  if (data.riskBreakdown && data.riskBreakdown.length) {
    riskScore -= data.riskBreakdown.length * 5;
  }
  riskScore = Math.max(0, Math.min(100, riskScore));
  return riskScore;
}

async function scanToken() {
  const mint = document.getElementById('mintInput').value.trim();
  const searchType = document.getElementById('searchType').value;
  if (!mint) return alert('❌ Please enter a mint or pair address.');
  try {
    const response = await fetch('http://localhost:5000/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mintAddress: mint, searchType })
    });
    const data = await response.json();
    console.log("Data received from scan:", data);
    
    // Compute risk assessment and add final summary
    const computedRisk = calculateRiskAssessment(data);
    data.finalSummary = `Based on the collected data, the overall risk score is ${computedRisk}.`;
    data.riskSummary = `Overall Score: ${data.score} (Risk level: ${computedRisk < 60 ? 'High Risk' : 'Moderate/Low Risk'})`;
    
    // Save result based on search type
    if (searchType === 'Token') {
      tokenReports.push(data);
    } else {
      pairReports.push(data);
    }
    updateDropdowns();
    // Immediately display the new report (convert type to lowercase)
    displayReport(searchType.toLowerCase());
  } catch (err) {
    console.error("Error scanning token:", err);
    alert("❌ Error scanning token. Check console for details.");
  }
}

async function submitVote() {
  if (window.hasVoted) return alert("You’ve already voted on this token.");
  const mint = document.getElementById('mintInput').value.trim();
  const vote = document.querySelector('input[name="voteOption"]:checked')?.value;
  const comment = document.getElementById('voteComment').value.trim();
  if (!vote) return alert("Please select a vote option.");
  try {
    const res = await fetch('http://localhost:5000/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mintAddress: mint, vote, comment })
    });
    const result = await res.json();
    if (result.success) {
      window.hasVoted = true;
      const recentComments = result.comments || [];
      document.getElementById('voteResults').style.display = 'block';
      document.getElementById('recentComments').innerHTML = recentComments
        .map(c => `<li><strong>${c.vote}</strong>: ${c.comment}</li>`)
        .join('');
    } else {
      alert('❌ Failed to submit vote.');
    }
  } catch (err) {
    console.error("Error submitting vote:", err);
    alert("❌ Error submitting vote. Check console for details.");
  }
}

document.getElementById("scanBtn").addEventListener("click", scanToken);
