export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { destinationZip, destinationCity, destinationState, totalWeightKg, totalVolumeCbm } = req.body;
    
    // Walio API Key provided by user
    const apiKey = process.env.WALIO_API_KEY || "wl_pk_BM7Y5H5F4FW3VzgCg59qn30snMK42FRK";
    
    // Decide endpoint: Courier for light packages (< 70kg), Land LTL for heavy packages
    const isCourier = (totalWeightKg || 5) < 70;
    const endpoint = isCourier ? 'courier' : 'land';
    const url = `https://walio.ai/api/v1/rates/${endpoint}`;
    
    let shippingCost = 0;
    let carrier = isCourier ? "Walio Courier Service" : "Walio Land Freight";
    let transitDays = 3;
    let apiSuccess = false;
    
    // Attempt to contact Walio API
    try {
      const payload = {
        origin: {
          zip: "33166", // Miami warehouse zip
          city: "Doral",
          state: "FL",
          country: "US"
        },
        destination: {
          zip: destinationZip || "33101",
          city: destinationCity || "Miami",
          state: destinationState || "FL",
          country: "US"
        },
        cargo: {
          weight_kg: totalWeightKg || 10,
          volume_cbm: totalVolumeCbm || 0.05
        }
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        shippingCost = data.price || data.total || data.rate || data.amount || 0;
        carrier = data.carrier || (isCourier ? "UPS Ground" : "R&L Carriers");
        transitDays = data.transit_days || data.days || 3;
        apiSuccess = true;
      } else {
        console.warn(`Walio API returned status ${response.status}: ${await response.text()}`);
      }
    } catch (e) {
      console.error("Error contacting Walio API:", e);
    }
    
    // Fallback Shipping Calculation in case API is down or Key is inactive
    if (!apiSuccess || shippingCost === 0) {
      const state = (destinationState || "FL").toUpperCase();
      let distanceMultiplier = 1.0;
      if (state === "FL") distanceMultiplier = 0.5; // Same state
      else if (["GA", "AL", "SC", "NC"].includes(state)) distanceMultiplier = 1.0; // Nearby Southeast
      else if (["TX", "NY", "PA", "IL"].includes(state)) distanceMultiplier = 1.8; // East Coast/Midwest
      else distanceMultiplier = 2.5; // West Coast
      
      const weight = totalWeightKg || 10;
      if (isCourier) {
        shippingCost = 15.0 + (weight * 0.8 * distanceMultiplier);
        carrier = "FedEx Home Delivery (Simulated)";
        transitDays = Math.max(2, Math.round(3 * distanceMultiplier));
      } else {
        shippingCost = 120.0 + (weight * 0.4 * distanceMultiplier);
        carrier = "SAIA LTL Freight (Simulated)";
        transitDays = Math.max(3, Math.round(4 * distanceMultiplier));
      }
    }
    
    // Round to 2 decimals
    shippingCost = parseFloat(shippingCost.toFixed(2));
    
    return res.status(200).json({
      shippingCost,
      carrier,
      transitDays,
      apiUsed: apiSuccess ? "Walio Live API" : "Walio Fallback Engine"
    });
  } catch (error) {
    console.error("Shipping calculate error:", error);
    return res.status(500).json({ error: "Failed to calculate shipping" });
  }
}

