const { CASHFREE_CONFIG } = require("../config/cashFreeConfig");

const createOrder = async (req, res) => {
  try {
    const { amount, customer_id, customer_email, customer_phone } = req.body;

    const response = await fetch(CASHFREE_CONFIG.BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_CONFIG.APP_ID,
        "x-client-secret": CASHFREE_CONFIG.SECRET_KEY,
        "x-api-version": CASHFREE_CONFIG.API_VERSION,
      },
      body: JSON.stringify({
        order_id: "order_" + Date.now(),
        order_amount: amount || 100.0,
        order_currency: "INR",
        customer_details: {
          customer_id: customer_id || "cust_001",
          customer_email: customer_email || "test@example.com",
          customer_phone: customer_phone || "9999999999",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();

    res.json({
		status:200,
		message:"Payment and session id created successfuly",
		pg_res:{cf_order_id: data.cf_order_id,
      order_id: data.order_id,
      order_status: data.order_status,
      payment_session_id: data.payment_session_id,}
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createOrder };