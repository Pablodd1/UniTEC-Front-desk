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
    const { subtotal, shippingCost, total, customerName, customerEmail, cartItems } = req.body;
    
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    
    if (stripeKey) {
      // Create a real Stripe Checkout Session via Direct HTTP Request (lightweight, no SDK needed)
      const params = new URLSearchParams();
      params.append('payment_method_types[0]', 'card');
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][product_data][name]', 'UNITEC USA DESIGN - Checkout');
      params.append('line_items[0][price_data][product_data][description]', `Products Subtotal: $${subtotal} + Shipping: $${shippingCost}`);
      params.append('line_items[0][price_data][unit_amount]', Math.round(total * 100).toString());
      params.append('line_items[0][quantity]', '1');
      params.append('mode', 'payment');
      
      const origin = req.headers.origin || 'http://localhost:5173';
      params.append('success_url', `${origin}/?payment=success`);
      params.append('cancel_url', `${origin}/?payment=cancel`);
      
      if (customerEmail) {
        params.append('customer_email', customerEmail);
      }
      
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      
      if (response.ok) {
        const session = await response.json();
        return res.status(200).json({ paymentLink: session.url, isMock: false });
      } else {
        console.error("Stripe API error:", await response.text());
      }
    }
    
    // Fallback: Generate a simulated Stripe checkout link pointing to our client-side simulation hash route
    const origin = req.headers.origin || 'http://localhost:5173';
    const mockSessionId = `cs_test_${Math.random().toString(36).substring(2, 15)}`;
    const checkoutUrl = `${origin}/#payment-simulation?sessionId=${mockSessionId}&amount=${total}&name=${encodeURIComponent(customerName || '')}&email=${encodeURIComponent(customerEmail || '')}`;
    
    return res.status(200).json({
      paymentLink: checkoutUrl,
      isMock: true
    });
  } catch (error) {
    console.error("Stripe create link error:", error);
    return res.status(500).json({ error: "Failed to create payment link" });
  }
}
