const { firestore, fcm } = require("../../config/firebase");
const { QueryTypes,Op } = require("sequelize");
const { sequelize } = require("../../models");
const { Order,Product,ProductVariant,Address, Restaurant,DeliveryBoy,DeliverySetting,Transaction,Wallet} = require("../../models");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const db = require("../../models"); // ya tumhara sequelize instance import karo
const jwt = require("jsonwebtoken"); // ✅ add this import

// ----------------- Distance Utility -----------------
 function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Use env vars - set these in your .env file
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "TEST430329ae80e0f32e41a393d78b923034";
const CASHFREE_SECRET = process.env.CASHFREE_SECRET || "TESTaf195616268bd6202eeb3bf8dc458956e7192a85";
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
const CASHFREE_BASE = process.env.CASHFREE_BASE || "https://sandbox.cashfree.com/pg/orders";

exports.createWalletSession_DB = async (req, res) => {
  try {
    const { entity_id, entity_type, amount, customer_email, customer_phone } = req.body;
    if (!entity_id || !entity_type || !amount) {
      return res.status(400).json({ status: false, message: "Missing fields (entity_id, entity_type, amount)" });
    }

    // generate unique ids
    const orderId = "ORD_" + uuidv4().replace(/-/g, "").substring(0, 15);
    const paymentSessionId = "SESS_" + uuidv4().replace(/-/g, "").substring(0, 12);

    // Prepare payload
    const payload = {
      order_id: orderId,
      order_amount: parseFloat(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: `cust_${entity_id}`,
        customer_phone: customer_phone || "9999999999",
        customer_email: customer_email || "test@example.com",
      },
      order_meta: {
        notify_url: process.env.CASHFREE_NOTIFY_URL || "https://root.namasteats.com/api/wallet/payment-callback",
        return_url: process.env.CASHFREE_RETURN_URL || `https://root.namasteats.com/payment-success?order_id=${orderId}`,
      },
      payment_methods: "upi_intent",
    };

    // Call Cashfree
    const response = await axios.post(CASHFREE_BASE, payload, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET,
      },
      timeout: 15000,
    });

    const cfData = response.data;

    // Save / ensure wallet row exists (create if not)
    let wallet = await Wallet.findOne({ where: { entity_id, entity_type } });
    if (!wallet) {
      wallet = await Wallet.create({
        entity_id,
        entity_type,
        total_balance: parseFloat(amount),
        current_balance: parseFloat(amount),
        status: "ACTIVE",
      });
    }

    // Save a pending transaction (if not already present)
    const txnOrderId = cfData.order_id || orderId;
    const existingTxn = await Transaction.findOne({ where: { order_id: txnOrderId } });
    if (!existingTxn) {
      await Transaction.create({
        entity_id,
        entity_type,
        order_id: txnOrderId,
        amount: parseFloat(amount),
        type: "CREDIT",
        description: "Wallet Top-up",
        status: "PENDING",
        // optional: store cf ids if returned
        // cf_order_id: cfData.cf_order_id || null,
        // payment_session_id: cfData.payment_session_id || null,
      });
    }

    // Update wallet with last order info (optional, useful)
    await wallet.update({
      order_id: txnOrderId,
      cf_order_id: cfData.cf_order_id || null,
      payment_session_id: cfData.payment_session_id || null,
      order_status: cfData.order_status || "PENDING",
      payment_response: cfData || null,
    });

    return res.status(200).json({
      status: true,
      message: "Payment session created successfully",
      data: {
        cf_order_id: cfData.cf_order_id,
        order_id: cfData.order_id || orderId,
        order_status: cfData.order_status,
        payment_session_id: cfData.payment_session_id,
      },
    });
  } catch (err) {
    console.error("Create wallet session error:", err.response?.data || err.message);
    return res.status(500).json({
      status: false,
      message: err.response?.data?.message || "Internal server error",
      error: err.response?.data || err.message,
    });
  }
};



exports.cashfreeCallback_DB = async (req, res) => {
  const logFile = path.join(__dirname, "cashfree_webhook_log.txt");

  // Log incoming request
  const webhookData = JSON.stringify(req.body);
  const logEntry = `---- NEW WEBHOOK ----\n${new Date().toISOString()}\nPayload: ${webhookData}\n`;
  fs.appendFileSync(logFile, logEntry);

  try {
    const data = req.body?.data || {};
    const order = data.order || {};
    const payment = data.payment || {};

    const orderId = order.order_id || "";
    const paymentStatus = payment.payment_status || "SUCCESS";

    if (paymentStatus === "SUCCESS" && orderId) {
      console.log(`🔹 Payment SUCCESS for order_id: ${orderId}`);

      // 🔹 Find wallet by order_id
      const wallet = await Wallet.findOne({ where: { order_id: orderId } });

      if (!wallet) {
        console.log("⚠️ Wallet not found for this order_id!");
      } else {
        // 🔹 Update payment_status and order_status
        await wallet.update({
          payment_status: "SUCCESS",
          order_status: "SUCCESS",
        });

        console.log(`✅ Wallet updated! Wallet ID: ${wallet.id}, payment_status set to SUCCESS`);
      }
    } else {
      console.log(`⚠️ Payment status not SUCCESS or order_id missing: ${paymentStatus}`);
    }

  } catch (err) {
    console.error("❌ Payment callback processing error:", err.message);
  }

  res.status(200).send("Webhook received successfully");
};


exports.getDeliveryBoyTransactionHistory = async (req, res) => {
  try {
    const { delivery_boy_id } = req.body;

    if (!delivery_boy_id) {
      return res.status(400).json({
        status: false,
        message: "delivery_boy_id is required",
      });
    }

    // 🟢 1️⃣ COD Collection (unique order_id wise)
    const codCollection = await sequelize.query(
      `
      SELECT 
        o.order_id,
        SUM(o.amount) AS amount,
        SUM(o.charges) AS charges,
        DATE(o.updated_at) AS collected_on
      FROM orders o
      WHERE o.delivery_boy_id = :delivery_boy_id
        AND o.paymode = 'cod'
        AND o.order_status = 'DELIVERED'
      GROUP BY o.order_id, DATE(o.updated_at)
      ORDER BY o.updated_at DESC
      `,
      {
        replacements: { delivery_boy_id },
        type: QueryTypes.SELECT,
      }
    );

    const total_cod_collected = codCollection.reduce(
      (sum, row) => sum + parseFloat(row.amount || 0),
      0
    );
    const total_admin_deduction = codCollection.reduce(
      (sum, row) => sum + parseFloat(row.charges || 0),
      0
    );

    // 🟢 2️⃣ Withdrawal Details
    const withdrawals = await sequelize.query(
      `
      SELECT 
        id, 
        amount, 
        status, 
        DATE(requested_at) AS requested_at
      FROM ewithdraw_request_DB
      WHERE delivery_boy_id = :delivery_boy_id
      ORDER BY requested_at DESC
      `,
      {
        replacements: { delivery_boy_id },
        type: QueryTypes.SELECT,
      }
    );

    const total_withdrawn = withdrawals.reduce(
      (sum, w) => sum + parseFloat(w.amount || 0),
      0
    );

    // 🟢 3️⃣ Due Payments (Wallet DEBIT transactions)
    const duePayments = await sequelize.query(
      `
      SELECT 
        id,
        last_transaction_amount AS amount_paid,
        last_transaction_type,
        DATE(updated_at) AS paid_on
      FROM wallets
      WHERE entity_id = :delivery_boy_id
        AND entity_type = 'DELIVERY_BOY'
        AND last_transaction_type = 'DEBIT'
      ORDER BY updated_at DESC
      `,
      {
        replacements: { delivery_boy_id },
        type: QueryTypes.SELECT,
      }
    );

    const total_due_paid = duePayments.reduce(
      (sum, d) => sum + parseFloat(d.amount_paid || 0),
      0
    );

    // ✅ Final Response
    return res.status(200).json({
      status: true,
      message: "Transaction summary fetched successfully",
      data: {
        summary: {
          total_cod_collected,
          total_withdrawn,
          total_due_paid,
          total_admin_deduction,
        },
        details: {
          cod_collection: codCollection,
          withdrawals: withdrawals,
          due_payments: duePayments,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error in getDeliveryBoyTransactionSummary:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.getDeliveryBoyWalletSummary = async (req, res) => {
  try {
    const { delivery_boy_id } = req.body;

    if (!delivery_boy_id) {
      return res.status(400).json({ status: false, message: "delivery_boy_id is required" });
    }

    // 🟢 1️⃣ Fetch wallet details
    const wallet = await sequelize.query(
      `
      SELECT id, entity_id, entity_type, total_balance, current_balance,
             last_transaction_amount, last_transaction_type, updated_at
      FROM wallets
      WHERE entity_id = :delivery_boy_id AND entity_type = 'DELIVERY_BOY'
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      { replacements: { delivery_boy_id }, type: QueryTypes.SELECT }
    );

    const wallet_balance = wallet.length ? parseFloat(wallet[0].current_balance || 0) : 0;

    // 🟡 2️⃣ Due amount = all delivered COD orders with PENDING due_status
    const dueResult = await sequelize.query(
      `
      SELECT COALESCE(SUM(amount),0) AS due_amount
      FROM orders
      WHERE delivery_boy_id = :delivery_boy_id
        AND paymode = 'cod'
        AND order_status = 'DELIVERED'
        AND due_status = 'PENDING'
      `,
      { replacements: { delivery_boy_id }, type: QueryTypes.SELECT }
    );

    const due_amount = parseFloat(dueResult[0].due_amount || 0);

    // 🟢 3️⃣ Total earning from all delivered orders (for display only)
    const totalDelivered = await sequelize.query(
      `
      SELECT order_id, MAX(delivery_charges) AS delivery_charges
      FROM orders
      WHERE delivery_boy_id = :delivery_boy_id
        AND order_status = 'DELIVERED'
        AND delivery_charges IS NOT NULL
        AND delivery_charges > 0
      GROUP BY order_id
      `,
      { replacements: { delivery_boy_id }, type: QueryTypes.SELECT }
    );

    const total_earning = totalDelivered.reduce(
      (sum, d) => sum + parseFloat(d.delivery_charges || 0),
      0
    );
    const total_deliveries_count = totalDelivered.length;

    // 🟢 4️⃣ Find new unpaid delivery charges (not yet credited to wallet)
    const unpaidDelivered = await sequelize.query(
      `
      SELECT order_id, MAX(delivery_charges) AS delivery_charges
      FROM orders
      WHERE delivery_boy_id = :delivery_boy_id
        AND order_status = 'DELIVERED'
        AND due_status = 'PAID'         -- only if due is cleared
        AND IFNULL(is_delivery_charge_paid, 0) = 0
        AND delivery_charges IS NOT NULL
        AND delivery_charges > 0
      GROUP BY order_id
      `,
      { replacements: { delivery_boy_id }, type: QueryTypes.SELECT }
    );

    const newEarning = unpaidDelivered.reduce(
      (sum, d) => sum + parseFloat(d.delivery_charges || 0),
      0
    );

    // 🟢 5️⃣ Update wallet if new earning found
    if (newEarning > 0) {
      const newCurrentBalance = wallet_balance + newEarning;

      await sequelize.query(
        `
        UPDATE wallets
        SET total_balance = IFNULL(total_balance,0) + :earning,
            current_balance = :new_balance,
            last_transaction_amount = :earning,
            last_transaction_type = 'CREDIT',
            updated_at = NOW()
        WHERE entity_id = :delivery_boy_id AND entity_type = 'DELIVERY_BOY'
        `,
        {
          replacements: { earning: newEarning, new_balance: newCurrentBalance, delivery_boy_id },
          type: QueryTypes.UPDATE,
        }
      );

      // Mark these orders as delivery charge paid
      const orderIds = unpaidDelivered.map(d => d.order_id);
      if (orderIds.length) {
        await sequelize.query(
          `
          UPDATE orders
          SET is_delivery_charge_paid = 1
          WHERE order_id IN (:orderIds)
            AND delivery_boy_id = :delivery_boy_id
          `,
          {
            replacements: { orderIds, delivery_boy_id },
            type: QueryTypes.UPDATE,
          }
        );
      }
    }

    // 🟢 6️⃣ Wallet transaction history (recent)
    const transaction_history = await sequelize.query(
      `
      SELECT id, entity_id, entity_type, amount, type, description, status,
             payment_method, created_at
      FROM transactions
      WHERE entity_id = :delivery_boy_id AND entity_type = 'DELIVERY_BOY'
      ORDER BY created_at DESC
      LIMIT 50
      `,
      { replacements: { delivery_boy_id }, type: QueryTypes.SELECT }
    );

    // 🟢 7️⃣ Final Response
    return res.status(200).json({
      status: true,
      message: "Delivery boy wallet summary fetched successfully",
      data: {
        delivery_boy_id,
        wallet_balance: wallet_balance + newEarning, // updated wallet
        total_earning,                               // total all-time
        total_deliveries_count,
        due_amount,
        transaction_history,
      },
    });
  } catch (error) {
    console.error("❌ Error in getDeliveryBoyWalletSummary:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getDeliveryBoyOrders = async (req, res) => {
  try {
    const { delivery_boy_id } = req.body;

    if (!delivery_boy_id) {
      return res.status(400).json({
        status: false,
        message: "delivery_boy_id is required",
      });
    }

    // 🔹 Fetch orders assigned to this delivery boy
    const orders = await sequelize.query(
      `
      SELECT 
        o.id AS order_primary_id,
        o.order_id,
        o.user_id,
        o.restaurant_id,
        o.delivery_boy_id,
        o.order_status,
		o.paymode,
        o.amount,
        o.delivery_charges,
        o.gst,
        o.created_at,
        o.updated_at,
        o.product_id,
        o.product_variant_id,
        o.product_quantity,
        p.name AS product_name,
        p.description AS product_description,
        p.thumbnail_image AS product_image,
        v.name AS variant_name,
        v.price AS variant_price,
        v.quantity AS variant_quantity
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN product_variants v ON o.product_variant_id = v.id
      WHERE o.delivery_boy_id = :delivery_boy_id
      ORDER BY o.created_at DESC
      `,
      {
        replacements: { delivery_boy_id },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No orders found for this delivery boy",
      });
    }

    // 🔹 Group orders by order_id
    const groupedOrders = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayDeliveries = new Set();
    let totalDeliveries = new Set();
    let todayEarning = 0;
    let totalEarning = 0;
    const processedOrderIds = new Set();

    for (const item of orders) {
      // Group by order_id
      if (!groupedOrders[item.order_id]) {
        groupedOrders[item.order_id] = {
          order_id: item.order_id,
          user_id: item.user_id,
          restaurant_id: item.restaurant_id,
          delivery_boy_id: item.delivery_boy_id,
          order_status: item.order_status,
          amount: parseFloat(item.amount),
          delivery_charges: parseFloat(item.delivery_charges || 0),
          gst: parseFloat(item.gst || 0),
			  paymode: item.paymode, // 🔹 Added paymode here
          created_at: item.created_at,
          updated_at: item.updated_at,
          products: [],
          restaurant: null, // 🔹 restaurant details placeholder
        };
      }

      groupedOrders[item.order_id].products.push({
        product_id: item.product_id,
        product_name: item.product_name,
        product_description: item.product_description,
        product_image: item.product_image,
        variant_id: item.product_variant_id,
        variant_name: item.variant_name,
        variant_price: parseFloat(item.variant_price || 0),
        variant_quantity: parseFloat(item.variant_quantity || 0),
        quantity: parseFloat(item.product_quantity || 0),
      });

      // 🔹 Stats calculation (only DELIVERED orders)
      if (item.order_status === "DELIVERED") {
        totalDeliveries.add(item.order_id);
        const orderDate = new Date(item.updated_at);
        if (orderDate >= today) todayDeliveries.add(item.order_id);

        if (!processedOrderIds.has(item.order_id)) {
          const earning = parseFloat(item.delivery_charges || 0);
          totalEarning += earning;
          if (orderDate >= today) todayEarning += earning;
          processedOrderIds.add(item.order_id);
        }
      }
    }

    // 🔹 Fetch restaurant details for all unique restaurant_ids in orders
    const restaurantIds = [...new Set(orders.map(o => o.restaurant_id))];
    const restaurants = await sequelize.query(
      `SELECT * FROM restaurants WHERE id IN (:restaurantIds)`,
      {
        replacements: { restaurantIds },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // 🔹 Map restaurant data to orders
    for (const order of Object.values(groupedOrders)) {
      const restaurant = restaurants.find(r => r.id.toString() === order.restaurant_id.toString());
      order.restaurant = restaurant || null;
    }

    // 🔹 Convert grouped object to array
    const finalOrders = Object.values(groupedOrders);

    return res.status(200).json({
      status: true,
      message: "Orders fetched successfully",
      data: finalOrders,
      stats: {
        today_deliveries_count: todayDeliveries.size,
        today_earning: todayEarning,
        total_deliveries_count: totalDeliveries.size,
        total_earning: totalEarning,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching delivery boy orders:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.testPushOrders = async (req, res) => {
  try {
    const snapshot = await firestore.collection("delivery_partners").get();
    const partners = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data?.user_status?.isOnline && data?.user_status?.current_status === "idle") {
        partners.push({
          id: data?.profile?.id || doc.id,
          name: data?.profile?.name || "Unknown",
          phone: data?.profile?.phone || "Unknown",
          lat: data?.location_data?.lat,
          lon: data?.location_data?.lon,
          fcm_token: data?.fcm_token || null,
          vehicle: data?.vehicle_details || null,
          rating: data?.rating || 0,
        });
      }
    });

    if (!partners.length) {
      return res.json({ status: false, message: "No idle partners online" });
    }

    const orders = await sequelize.query(
      `SELECT id, order_id, user_id, restaurant_id, product_id, product_variant_id, product_quantity, amount, paymode, order_status, current_address, delivery_pin, latitude, longitude 
       FROM orders 
       WHERE order_status IN ('READY_TO_PICKUP','ORDER_ACCEPT')`,
      { type: QueryTypes.SELECT }
    );

    if (!orders.length) {
      return res.json({ status: false, message: "No ready orders found" });
    }

    const ordersById = orders.reduce((acc, row) => {
      const oid = String(row.order_id);
      if (!acc[oid]) acc[oid] = [];
      acc[oid].push(row);
      return acc;
    }, {});

    for (const [orderId, orderRows] of Object.entries(ordersById)) {
      try {
        const sample = orderRows[0];

        // 🔹 Restaurant fetch
        const [rest] = await sequelize.query(
          `SELECT * FROM restaurants WHERE id = :id`,
          { replacements: { id: sample.restaurant_id }, type: QueryTypes.SELECT }
        );
        if (!rest) continue;

        // 🔹 Address fetch
        const addresses = await sequelize.query(
          `SELECT * FROM addresses WHERE user_id = :user_id`,
          { replacements: { user_id: sample.user_id }, type: QueryTypes.SELECT }
        );

        // 🔹 Items + total
        const items = [];
        let totalAmount = 0;

        for (const row of orderRows) {
          const [product] = row.product_id
            ? await sequelize.query(`SELECT * FROM products WHERE id = :id`, {
                replacements: { id: row.product_id },
                type: QueryTypes.SELECT,
              })
            : [null];

          const [variant] = row.product_variant_id
            ? await sequelize.query(`SELECT * FROM product_variants WHERE id = :id`, {
                replacements: { id: row.product_variant_id },
                type: QueryTypes.SELECT,
              })
            : [null];

          totalAmount += Number(row.amount || 0);

          items.push({
            order_row_id: row.id,
            quantity: row.product_quantity,
            amount: row.amount,
            product,
            variant,
          });
        }

        // 🔹 Calculate nearest partner
        const partnersWithDistance = partners
          .map((p) => ({
            ...p,
            distanceKm: getDistanceInKm(
              parseFloat(rest.latitude || 0),
              parseFloat(rest.longitude || 0),
              parseFloat(p.lat || 0),
              parseFloat(p.lon || 0)
            ),
          }))
          .filter((p) => !isNaN(p.distanceKm))
          .sort((a, b) => a.distanceKm - b.distanceKm);

        const nearest = partnersWithDistance[0] || null;

        // ✅ FINAL FIRESTORE DATA (clean structure, no duplicate fields)
        const fullData = {
          order_id: orderId,
          order_status: sample.order_status || "READY_TO_PICKUP",
          total_items: Number(items.length),
          total_amount: Number(totalAmount.toFixed(2)),
          restaurant: rest || {},
          addresses: addresses || [],
          items,
          partners: partnersWithDistance.map((p) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
            lat: p.lat,
            lon: p.lon,
            fcm_token: p.fcm_token,
            distanceKm: p.distanceKm.toFixed(2),
            vehicle: p.vehicle,
            rating: p.rating,
          })),
          nearestPartner: nearest
            ? {
                id: nearest.id,
                name: nearest.name,
                phone: nearest.phone,
                distanceKm: nearest.distanceKm.toFixed(2),
              }
            : null,
          order_meta: {
            paymode: sample.paymode,
            current_address: sample.current_address,
            delivery_pin: sample.delivery_pin,
          },

          // ✅ unified consistent fields
          pendingAssignment: true, // boolean
          pending_assignments: [], // array (kept for compatibility, empty)
          waitingForDeliveryPartner: true, // boolean
          waiting_for_delivery_partners: false, // kept false for backend checks
          pushed_at: new Date().toISOString(),
          timestamp: Date.now(),
        };

        // 🔹 Firestore push with UNIQUE document ID per order push
        await firestore
          .collection("orders")
         // .doc(`${orderId}_${Date.now()}`) // unique doc ID (fix overwrite)
		   .doc(orderId)
          .set(fullData)
          .catch((err) =>
            console.error(`❌ Firestore push failed for order ${orderId}:`, err.message)
          );
      } catch (innerErr) {
        console.error(`❌ Error processing order ${orderId}:`, innerErr.message);
      }
    }

    return res.json({
      status: true,
      message: "✅ All orders pushed successfully with consistent structure",
      partners: partners.length,
    });
  } catch (err) {
    console.error("🔥 testPushOrders error:", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};


// ----------------- API: Notify nearest partners for accepted orders -----------------
 exports.notifyNearestPartners = async (req, res) => {
  try {
    const TOP_N = req.body.topN ? Number(req.body.topN) : 3;

    console.log("🚀 Fetching delivery partners from Firestore...");
    const partnersSnapshot = await firestore.collection("delivery_partners").get();

    const activePartners = [];
    partnersSnapshot.forEach((doc) => {
      const p = doc.data();
      const lat = p?.location_data?.lat;
      const lon = p?.location_data?.lon;
      const isOnline = p?.user_status?.isOnline;
      const status = p?.user_status?.current_status;

      if (isOnline && status === "idle" && lat && lon) {
        activePartners.push({
          id: doc.id,
          name: p?.profile?.name || "Unknown",
          phone: p?.profile?.phone || "Unknown",
          lat,
          lon,
          fcm_token: p?.fcm_token || null,
        });
      }
    });

    if (!activePartners.length) {
      return res.status(200).json({ status: false, message: "No active idle delivery boys found." });
    }

    console.log(`🟢 Active Delivery Boys: ${activePartners.length}`);

    // 🔹 Fetch all accepted orders
    const acceptedOrders = await Order.findAll({
      where: { status: "ORDER_ACCEPT" },
      include: [{ model: Restaurant, attributes: ["id", "name", "latitude", "longitude"] }],
    });

    if (!acceptedOrders.length) {
      return res.status(200).json({ status: false, message: "No accepted orders found." });
    }

    console.log(`📦 Orders to process: ${acceptedOrders.length}`);

    const firebasePushes = [];
    const notifications = [];

    for (const order of acceptedOrders) {
      const rest = order.Restaurant;
      if (!rest?.latitude || !rest?.longitude) continue;

      // Calculate distance from each partner
      const nearbyPartners = activePartners
        .map((p) => ({
          ...p,
          distanceKm: getDistanceInKm(rest.latitude, rest.longitude, p.lat, p.lon),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, TOP_N);

      console.log(`🏪 Order #${order.id}: Nearest ${nearbyPartners.length} delivery boys found.`);

      for (const partner of nearbyPartners) {
        // Send FCM Notification
        if (partner.fcm_token) {
          const msg = {
            notification: {
              title: "New Order Available",
              body: `Order #${order.id} is ready at ${rest.name}. Distance: ${partner.distanceKm.toFixed(2)} km`,
            },
            token: partner.fcm_token,
            data: {
              orderId: String(order.id),
              restaurantId: String(rest.id),
              type: "ORDER_AVAILABLE",
            },
          };

          try {
            await fcm.send(msg);
            notifications.push({ orderId: order.id, partnerId: partner.id, distance: partner.distanceKm });
            console.log(`📩 Notification sent to ${partner.name}`);
          } catch (err) {
            console.error("❌ FCM Send Error:", err);
          }
        }

        // Push data to Firestore /orders
        const orderDoc = {
          order_id: order.id,
          restaurant: {
            id: rest.id,
            name: rest.name,
            lat: rest.latitude,
            lon: rest.longitude,
          },
          delivery_partner: {
            id: partner.id,
            name: partner.name,
            phone: partner.phone,
            distanceKm: partner.distanceKm,
          },
          created_at: new Date(),
          status: "pending_accept",
        };

        try {
          await firestore.collection("orders").add(orderDoc);
          firebasePushes.push(orderDoc);
        } catch (err) {
          console.error("❌ Firestore Push Error:", err);
        }
      }
    }

    return res.status(200).json({
      status: true,
      message: "Notifications sent and Firebase updated",
      total_notifications: notifications.length,
      total_pushed_to_firebase: firebasePushes.length,
    });
  } catch (error) {
    console.error("notifyNearestPartners error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};


exports.getDeliveryBoySettings = async (req, res) => {
  try {
    const settings = await DeliverySetting.findAll({
      attributes: ["id", "title", "slug", "content"],
      where: { status: 1 },
      order: [["id", "ASC"]],
    });

    if (!settings || settings.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No settings found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Delivery boy settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    console.error("❌ getDeliveryBoySettings error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// 🟢 Change Password (Plain Text)
exports.changePassword = async (req, res) => {
  try {
    const { delivery_boy_id, old_password, new_password, confirm_password } = req.body;

    // ✅ Validate input
    if (!delivery_boy_id || !old_password || !new_password || !confirm_password) {
      return res.status(400).json({
        status: false,
        message: "delivery_boy_id, old_password, new_password, and confirm_password are required",
      });
    }

    // ✅ Check new and confirm password match
    if (new_password !== confirm_password) {
      return res.status(400).json({
        status: false,
        message: "New password and confirm password do not match",
      });
    }

    // ✅ Find delivery boy
    const user = await DeliveryBoy.findByPk(delivery_boy_id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "Delivery boy not found",
      });
    }

    // ✅ Check old password (normal text match)
    if (user.password !== old_password) {
      return res.status(400).json({
        status: false,
        message: "Old password is incorrect",
      });
    }

    // ✅ Update password directly (no hashing)
    await DeliveryBoy.update(
      { password: new_password },
      { where: { id: delivery_boy_id } }
    );

    return res.status(200).json({
      status: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ changePassword error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// 🟢 View Delivery Boy Profile
exports.viewProfile = async (req, res) => {
  try {
    const { delivery_boy_id } = req.body;

    // Validation check
    if (!delivery_boy_id) {
      return res.status(400).json({
        status: false,
        message: "delivery_boy_id is required",
      });
    }

    // Find user by ID
    const user = await DeliveryBoy.findByPk(delivery_boy_id, {
      attributes: { exclude: ["password"] },
    });

    // If user not found
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "Delivery boy not found",
      });
    }

    // Convert to JSON
    const data = user.toJSON();

    // Attach full URL for profile picture if exists
    if (data.profile_picture) {
      data.profile_picture = data.profile_picture.startsWith("http")
        ? data.profile_picture
        : BASE_URL.replace(/\/$/, "") + "/" + data.profile_picture.replace(/^\/+/, "");
    }
	  
	   // 🪙 Fetch wallet balances
    const wallet = await Wallet.findOne({
      where: {
        entity_id: delivery_boy_id,
        entity_type: "DELIVERY_BOY",
      },
      attributes: ["current_balance", "total_balance"],
    });

    // Attach wallet data (if exists)
    if (wallet) {
      data.current_balance = wallet.current_balance;
      data.total_balance = wallet.total_balance;
    } else {
      data.current_balance = 0;
      data.total_balance = 0;
    }


    // Success response
    return res.status(200).json({
      status: true,
      message: "Profile fetched successfully",
      data,
    });
  } catch (error) {
    console.error("❌ viewProfile error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ✅ Update Delivery Boy Profile
exports.updateDeliveryBoyProfile = async (req, res) => {
  try {
    const { id } = req.body; // 🟢 delivery boy id from request body

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Delivery boy ID is required",
      });
    }

    // 🔍 find user
    const deliveryBoy = await DeliveryBoy.findByPk(id);
    if (!deliveryBoy) {
      return res.status(404).json({
        status: false,
        message: "Delivery boy not found",
      });
    }

    // 🟢 Prepare update object
    const updateData = {};
    const { first_name, last_name, email, mobile_number, address } = req.body;

    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;
    if (email) updateData.email = email;
    if (address) updateData.address = address;
    if (mobile_number) updateData.mobile_number = mobile_number;

    // 🟢 Handle new profile picture upload
    if (req.files?.profile_picture?.[0]) {
      const baseUrl = "https://root.namasteats.com/";
      const filePath = req.files.profile_picture[0].path.replace(/\\/g, "/");

      // ✅ Ensure it starts with uploads/
      const cleanPath = filePath.startsWith("uploads/")
        ? filePath
        : `uploads/${filePath}`;

      updateData.profile_picture = baseUrl + cleanPath;
    }

    // ✅ Update record
    await DeliveryBoy.update(updateData, { where: { id } });

    // ✅ Get updated data
    const updatedBoy = await DeliveryBoy.findByPk(id, {
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      status: true,
      message: "Profile updated successfully",
      data: updatedBoy,
    });
  } catch (error) {
    console.error("❌ updateDeliveryBoyProfile error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.registerDeliveryBoy = async (req, res) => {
  try {
    console.log("📩 Headers:", req.headers); // Debug

    const fcm_token =
      req.headers["fcm_token"] ||
      req.headers["fcm-token"] ||
      req.headers["Fcm-Token"] ||
      req.headers["Fcm_token"] ||
      req.headers["Fcm_Token"] ||
      req.headers["FcmToken"] ||
      req.headers["fcmtoken"] ||
      null;

    console.log("📲 FCM Token Received:", fcm_token);

    const {
      first_name,
      last_name,
      mobile_number,
      email,
      password,
      confirm_password,
      address,
      //earning_type,
     // working_area,
      vehicle_type,
      identity_type,
      identity_number,
      driving_license_number,
    } = req.body;

    const requiredFields = {
      first_name,
      last_name,
      mobile_number,
      email,
      password,
      address,
      confirm_password,
      //earning_type,
      //working_area,
      vehicle_type,
      identity_type,
      identity_number,
      driving_license_number,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value || value === "") {
        return res.status(400).json({
          status: false,
          message: `${key.replace(/_/g, " ")} is required`,
        });
      }
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        status: false,
        message: "Password and confirm password do not match",
      });
    }

    const existing = await DeliveryBoy.findOne({
      where: { mobile_number },
    });
    if (existing) {
      return res.status(400).json({
        status: false,
        message: "Mobile number already registered",
      });
    }

    // 🟢 Base URL
    const baseUrl = "https://root.namasteats.com/";

    // 🖼️ Handle file paths and prepend base URL if files exist
    const profile_picture = req.files?.profile_picture?.[0]
      ? baseUrl + req.files.profile_picture[0].path.replace(/\\/g, "/")
      : null;

    const identity_image = req.files?.identity_image?.[0]
      ? baseUrl + req.files.identity_image[0].path.replace(/\\/g, "/")
      : null;

    const driving_license_image = req.files?.driving_license_image?.[0]
      ? baseUrl + req.files.driving_license_image[0].path.replace(/\\/g, "/")
      : null;

    // ✅ Create record
    const deliveryBoy = await DeliveryBoy.create({
      first_name,
      last_name,
      mobile_number,
      email,
      password,
      address,
      profile_picture,
      //earning_type,
      //working_area,
      vehicle_type,
      identity_type,
      identity_number,
      identity_image,
      driving_license_number,
      driving_license_image,
      fcm_token,
      status: 0,
    });
	  
	  await Wallet.create({
		  entity_id: deliveryBoy.id,
		  entity_type: "DELIVERY_BOY",
		  total_balance: 0,
		  current_balance: 0,
		});
	  
    return res.status(201).json({
      status: true,
      message: "Delivery boy registered successfully",
      data: deliveryBoy,
    });
  } catch (error) {
    console.error("❌ registerDeliveryBoy error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};



// ✅ Login Delivery Boy (with full validation + FCM token update)
exports.loginDeliveryBoy = async (req, res) => {
  try {
    const { mobile_number, password, fcm_token } = req.body;

    // 1️⃣ Basic validation
    if (!mobile_number) {
      return res.status(400).json({
        status: false,
        message: "Mobile number is required",
      });
    }
    if (!password) {
      return res.status(400).json({
        status: false,
        message: "Password is required",
      });
    }

    // 2️⃣ Check if mobile number exists
    const user = await DeliveryBoy.findOne({ where: { mobile_number } });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "Mobile number not registered, please register first",
      });
    }

    // 3️⃣ Check password (plain, since not hashed)
    if (user.password !== password) {
      return res.status(400).json({
        status: false,
        message: "Invalid password",
      });
    }

    // 4️⃣ Update FCM token if provided
    if (fcm_token && fcm_token.trim() !== "") {
      await DeliveryBoy.update({ fcm_token }, { where: { id: user.id } });
    }

    // 5️⃣ Create JWT token
    const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret_here";
    const token = jwt.sign(
      { id: user.id, mobile_number: user.mobile_number, role: "delivery_boy" },
      jwtSecret,
      { expiresIn: "7d" }
    );

    // 6️⃣ Prepare user data (without password)
    const userData = user.toJSON ? user.toJSON() : { ...user };
    delete userData.password;
    userData.fcm_token = fcm_token || user.fcm_token;

    // ✅ Success response
    return res.status(200).json({
      status: true,
      message: "Login successful",
      data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    console.error("❌ loginDeliveryBoy error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ✅ Simple Forgot Password (No OTP, No JWT, No FCM)
exports.deliveryBoyForgotPassword = async (req, res) => {
  try {
    const { mobile_number, new_password } = req.body;

    // Basic validation
    if (!mobile_number) {
      return res.status(400).json({
        status: false,
        message: "Mobile number is required",
      });
    }

    if (!new_password) {
      return res.status(400).json({
        status: false,
        message: "New password is required",
      });
    }

    // Check if user exists
    const user = await DeliveryBoy.findOne({ where: { mobile_number } });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "Mobile number not registered",
      });
    }

    // Update password (plain text as per your project)
    await DeliveryBoy.update(
      { password: new_password },
      { where: { id: user.id } }
    );

    return res.status(200).json({
      status: true,
      message: "Password updated successfully",
    });

  } catch (error) {
    console.error("❌ deliveryBoyForgotPassword error:", error);

    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

