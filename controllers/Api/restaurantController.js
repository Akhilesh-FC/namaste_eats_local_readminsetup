const { QueryTypes } = require("sequelize");
const sequelize = require("../../config/db");
const admin = require("../../config/firebase.js");
const { Category,Order, SubCategory, Product, Restaurant, RestaurantOffer, RestaurantDocument, RestaurantRating, RestaurantTiming, ProductMedia, UnitType, ProductVariant,RestaurantFeedback ,User, Wallet,RestaurantSetting,WithdrawRequest,DeliveryBoy } = require("../../models");
const { AddonCharge } = require("../../models"); 
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const BASE_URL = process.env.BASE_URL;
const { fcm,firestore } = require("../../config/firebase"); // ✅ import fixed

const axios = require("axios"); // ✅ for internal API call


const formatUrl = (filePath) => {
  if (!filePath) return null;
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/${filePath.replace(/\\/g, "/")}`;
};


// === Multer setup ===
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/products";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Use original name but with timestamp to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Create upload instance
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024,
    files: 50
  }
});

// 🔐 COMMON NOTIFICATION FUNCTION (INDUSTRY LEVEL)
const notifyEntity = async ({ type, entity_id, title, message, data = {} }) => {
  try {
    let model = null;

    if (type === "USER") model = User;
    if (type === "RESTAURANT") model = Restaurant;
    if (type === "DELIVERY_BOY") model = DeliveryBoy;

    if (!model || !entity_id) return;

    const entity = await model.findOne({
      where: { id: entity_id },
      attributes: ["id", "fcm_token"], // ✅ name removed
    });

    if (!entity || !entity.fcm_token) {
      console.log(`⚠️ ${type} FCM token not found for ID ${entity_id}`);
      return;
    }

    const payload = {
      token: entity.fcm_token,
      notification: {
        title,
        body: message,
      },
      data: {
        type,
        ...data,
      },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    };

    await fcm.send(payload);
    console.log(`✅ Notification sent to ${type} ${entity_id}`);
  } catch (err) {
    console.error(`❌ Notification error [${type}]`, err.message);
  }
};




exports.restaurantWithdrawHistory = async (req, res) => {
  try {
    const { restaurant_id } = req.query;

    // ✅ Validation
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id is required",
      });
    }

    // ✅ Check restaurant exists
    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: ["id", "name"],
    });

    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Fetch withdraw requests (no include)
    const withdraws = await WithdrawRequest.findAll({
      where: { restaurant_id },
      order: [["id", "DESC"]],
      attributes: [
        "id",
        "wallet_id",
        "account_id",
        "amount",
        "status",
        "requested_at",
        "approved_at",
        "remarks",
      ],
    });

    if (!withdraws.length) {
      return res.status(200).json({
        status: 200,
        message: "No withdrawal history found",
        data: [],
      });
    }

    // ✅ Build response manually (no associations)
    const formatted = [];

    for (const w of withdraws) {
      // Fetch wallet info
      const wallet = await Wallet.findOne({
        where: { id: w.wallet_id },
        attributes: ["id", "current_balance", "total_balance"],
      });

      // Fetch account info
      const account = await RestaurantDocument.findOne({
        where: { id: w.account_id },
        attributes: ["id", "bank_owner_name", "bank_account_number", "ifsc_code"],
      });

      formatted.push({
        id: w.id,
        amount: w.amount,
        status: w.status,
        requested_at: w.requested_at,
        approved_at: w.approved_at,
        remarks: w.remarks,
        account: account
          ? {
              account_id: account.id,
              bank_name: account.bank_name,
              account_number: account.account_number,
              ifsc_code: account.ifsc_code,
            }
          : null,
        wallet: wallet
          ? {
              wallet_id: wallet.id,
              current_balance: wallet.current_balance,
              total_balance: wallet.total_balance,
            }
          : null,
      });
    }

    return res.status(200).json({
      status: 200,
      message: "Withdraw history fetched successfully",
      total_records: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("❌ Error fetching withdraw history:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



// Controller: restaurantController.js
exports.restaurantWithdraw = async (req, res) => {
  try {
    const { restaurant_id, amount, account_id } = req.body;

    // ✅ Basic validation
    if (!restaurant_id || !amount || !account_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id, amount, and account_id are required",
      });
    }

    // ✅ Check restaurant exists
    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: ["id", "name", "is_active"],
    });

    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Verify account_id belongs to restaurant
    const account = await RestaurantDocument.findOne({
      where: { restaurant_id, id: account_id },
    });

    if (!account) {
      return res.status(400).json({
        status: 400,
        message: "Invalid account_id for this restaurant",
      });
    }

    // ✅ Fetch wallet
    const wallet = await Wallet.findOne({
      where: { entity_id: restaurant_id, entity_type: "RESTAURANT" },
      attributes: ["id", "current_balance", "total_balance"],
    });

    if (!wallet) {
      return res.status(404).json({
        status: 404,
        message: "Wallet not found for this restaurant",
      });
    }

    // ✅ Check balance
    if (wallet.current_balance < amount) {
      return res.status(400).json({
        status: 400,
        message: "Insufficient wallet balance",
      });
    }

    // ✅ Use transaction to ensure data consistency
    const t = await sequelize.transaction();

    try {
      // ✅ Deduct the amount from wallet
      const newBalance = wallet.current_balance - amount;
      await Wallet.update(
        { current_balance: newBalance },
        { where: { id: wallet.id }, transaction: t }
      );

      // ✅ Create withdraw request (PENDING)
      const withdrawRequest = await WithdrawRequest.create(
        {
          restaurant_id,
          wallet_id: wallet.id,
          account_id,
          amount,
          status: "PENDING",
          requested_at: new Date(),
        },
        { transaction: t }
      );

      await t.commit();

      return res.status(200).json({
        status: 200,
        message: "Withdraw request submitted successfully",
        data: {
          withdraw_request: withdrawRequest,
          wallet_balance_after_deduction: newBalance,
        },
      });
    } catch (innerError) {
      await t.rollback();
      console.error("❌ Transaction rollback:", innerError);
      return res.status(500).json({
        status: 500,
        message: "Failed to process withdrawal",
        error: innerError.message,
      });
    }
  } catch (error) {
    console.error("❌ Error in restaurantWithdraw:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



exports.updateRestaurantStatus = async (req, res) => {
  try {
    const { restaurant_id, cod_available, is_active } = req.body; // POST se data lo

    // ✅ Check if restaurant_id diya gaya hai
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id is required",
      });
    }

    // ✅ Restaurant exist karta hai ya nahi
    const restaurant = await Restaurant.findOne({ where: { id: restaurant_id } });
    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Update ke liye object prepare karo
    const updateData = {};

    if (cod_available !== undefined && (cod_available === 0 || cod_available === 1)) {
      updateData.cod_available = cod_available;
    }

    if (is_active !== undefined && (is_active === 0 || is_active === 1)) {
      updateData.is_active = is_active;
    }

    // ✅ Agar kuch update nahi mila
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Please provide at least one valid field to update (cod_available or is_active)",
      });
    }

    // ✅ Update query
    await Restaurant.update(updateData, { where: { id: restaurant_id } });

    // ✅ Updated data fetch karo
    const updated = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: ["id", "cod_available", "is_active"],
    });

    return res.status(200).json({
      status: 200,
      message: "Restaurant status updated successfully",
      data: updated,
      info: {
        cod_meaning: "0 = COD Not Available, 1 = COD Available",
        active_meaning: "0 = Inactive, 1 = Active",
      },
    });
  } catch (error) {
    console.error("❌ Error updating restaurant status:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Create or update restaurant timings (single or multiple)
exports.updateRestaurantTimings = async (req, res) => {
  const { restaurant_id, timings } = req.body;

  try {
    // Basic validation
    if (!restaurant_id || !Array.isArray(timings) || timings.length === 0) {
      return res.status(400).json({
        status: false,
        message: "restaurant_id and timings array are required"
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      for (const t of timings) {
        const { day_of_week, open_time, close_time } = t;
        let { is_active } = t;

        if (!day_of_week) continue;

        // Force numeric 0 or 1 only
        is_active = Number(is_active) === 1 ? 1 : 0;

        // Try updating first
        const [result] = await sequelize.query(
          `UPDATE restaurant_timings
           SET open_time = :open_time,
               close_time = :close_time,
               is_active = :is_active,
               updated_at = NOW()
           WHERE restaurant_id = :restaurant_id
             AND day_of_week = :day_of_week`,
          {
            replacements: {
              restaurant_id,
              day_of_week,
              open_time,
              close_time,
              is_active
            },
            type: sequelize.QueryTypes.UPDATE,
            transaction
          }
        );

        // If no row was updated, insert new one
        if (result === 0) {
          await sequelize.query(
            `INSERT INTO restaurant_timings
               (restaurant_id, day_of_week, open_time, close_time, is_active, created_at, updated_at)
             VALUES
               (:restaurant_id, :day_of_week, :open_time, :close_time, :is_active, NOW(), NOW())`,
            {
              replacements: {
                restaurant_id,
                day_of_week,
                open_time,
                close_time,
                is_active
              },
              type: sequelize.QueryTypes.INSERT,
              transaction
            }
          );
        }
      }

      await transaction.commit();

      res.status(200).json({
        status: true,
        message: "Restaurant timings saved successfully"
      });
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction error:", err);
      res.status(500).json({
        status: false,
        message: "Failed to save restaurant timings"
      });
    }

  } catch (err) {
    console.error("Error saving restaurant timings:", err);
    res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};



// Get restaurant timings by restaurant_id
exports.getRestaurantTimings = async (req, res) => {
  const { restaurant_id } = req.params;

  try {
    if (!restaurant_id) {
      return res.status(400).json({
        status: false,
        message: "restaurant_id is required"
      });
    }

    const timings = await sequelize.query(
      `SELECT id, restaurant_id, day_of_week, open_time, close_time, is_active, created_at, updated_at
       FROM restaurant_timings
       WHERE restaurant_id = :restaurant_id
       ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')`,
      { replacements: { restaurant_id }, type: sequelize.QueryTypes.SELECT }
    );

    if (timings.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No timings found for this restaurant"
      });
    }

    res.status(200).json({
      status: true,
      restaurant_id,
      total_slots: timings.length,
      data: timings
    });
  } catch (err) {
    console.error("Error fetching restaurant timings:", err);
    res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};


exports.updateOrderStatus_new = async (req, res) => {
  try {
    const { restaurant_id, order_id, is_accept } = req.body;

    if (!restaurant_id || !order_id || !is_accept?.trim()) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id, order_id, and is_accept are required",
      });
    }

    const allowedStatus = [
      "PREPARING",
      "ORDER_ACCEPT",
      "CANCELLED",
      "DELIVERED",
      "READY_TO_PICKUP",
      "ON_THE_WAY",
      "PENDING",
      "ASSIGN_TO_DELIVERY_BOY",
      "DELIVERED_BY_PIN",
      "REFUND_INITIATE",
      "REFUND_SUCCESSFULL",
      "ORDER_REQUEST_TO_DB",
      "ORDER_ACCEPT_BY_DB",
      "REACH_PICKUP_POINT",
      "REACH_DROP_POINT",
      "ON_THE_WAY_FOR_RESTRO",
    ];

    const newStatus = is_accept.toUpperCase();

    if (!allowedStatus.includes(newStatus)) {
      return res.status(400).json({
        status: 400,
        message: `Invalid order status`,
      });
    }

    const order = await Order.findOne({
      where: { order_id, restaurant_id },
      attributes: [
        "id",
        "order_id",
        "user_id",
        "restaurant_id",
        "order_status",
        "paymode",
        "is_cod_paid",
        "delivery_boy_id",
      ],
    });

    if (!order) {
      return res.status(404).json({
        status: 404,
        message: "Order not found",
      });
    }

    // 🔹 Update status
    await Order.update(
      { order_status: newStatus },
      { where: { order_id, restaurant_id } }
    );

    // 🔹 COD auto paid
    if (newStatus === "DELIVERED" && order.paymode === "cod") {
      await Order.update(
        { is_cod_paid: 1 },
        { where: { order_id, restaurant_id } }
      );
    }

    // 🔹 Fetch delivery boy from Firebase (Assign time)
    let deliveryBoyId = order.delivery_boy_id;

    if (["ASSIGN_TO_DELIVERY_BOY", "ORDER_ACCEPT_BY_DB"].includes(newStatus)) {
      const snap = await firestore
        .collection("orders")
        .doc(order_id.toString())
        .get();

      if (snap.exists) {
        const data = snap.data();
        deliveryBoyId = data.deliveryPartnerId;

        if (deliveryBoyId) {
          await Order.update(
            { delivery_boy_id: deliveryBoyId },
            { where: { order_id } }
          );
        }
      }
    }

    // 🔔 NOTIFICATIONS (INDUSTRY FLOW)
    switch (newStatus) {
      case "ORDER_REQUEST_TO_DB":
        await notifyEntity({
          type: "RESTAURANT",
          entity_id: order.restaurant_id,
          title: "🍔 New Order Received",
          message: "You have received a new order.",
          data: { order_id },
        });
        break;

      case "ORDER_ACCEPT":
        await notifyEntity({
          type: "USER",
          entity_id: order.user_id,
          title: "✅ Order Accepted",
          message: "Restaurant has accepted your order.",
          data: { order_id },
        });
        break;

      case "ORDER_ACCEPT_BY_DB":
      case "ASSIGN_TO_DELIVERY_BOY":
        await notifyEntity({
          type: "DELIVERY_BOY",
          entity_id: deliveryBoyId,
          title: "🛵 New Delivery Assigned",
          message: "A new order has been assigned to you.",
          data: { order_id },
        });
        break;

      case "READY_TO_PICKUP":
        await notifyEntity({
          type: "DELIVERY_BOY",
          entity_id: deliveryBoyId,
          title: "📦 Ready to Pickup",
          message: "Order is ready. Please reach the restaurant.",
          data: { order_id },
        });
        break;

      case "ON_THE_WAY":
        await notifyEntity({
          type: "USER",
          entity_id: order.user_id,
          title: "🚗 On the Way",
          message: "Your order is on the way.",
          data: { order_id },
        });
        break;

      case "DELIVERED":
        await notifyEntity({
          type: "USER",
          entity_id: order.user_id,
          title: "🎉 Delivered",
          message: "Your order has been delivered successfully.",
          data: { order_id },
        });
        break;

      case "CANCELLED":
        await notifyEntity({
          type: "USER",
          entity_id: order.user_id,
          title: "❌ Order Cancelled",
          message: "Your order was cancelled.",
          data: { order_id },
        });

        await notifyEntity({
          type: "RESTAURANT",
          entity_id: order.restaurant_id,
          title: "⚠️ Order Cancelled",
          message: "Order was cancelled by the user.",
          data: { order_id },
        });
        break;
    }

    return res.status(200).json({
      status: 200,
      message: `Order status updated to ${newStatus}`,
    });
  } catch (err) {
    console.error("❌ updateOrderStatus error:", err);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { restaurant_id, order_id, is_accept } = req.body;

    // 🔹 Validate input
    if (!restaurant_id || !order_id || !is_accept) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id, order_id, and is_accept are required",
      });
    }

    // 🔹 Allowed statuses
    const allowedStatus = [
      "PREPARING", "ORDER_ACCEPT", "CANCELLED", "DELIVERED", "READY_TO_PICKUP",
      "ON_THE_WAY", "PENDING", "ASSIGN_TO_DELIVERY_BOY", "DELIVERED_BY_PIN",
      "REFUND_INITIATE", "REFUND_SUCCESSFULL", "ORDER_REQUEST_TO_DB",
      "ORDER_ACCEPT_BY_DB", "REACH_PICKUP_POINT", "REACH_DROP_POINT",
      "ON_THE_WAY_FOR_RESTRO"
    ];

    const newStatus = is_accept.toUpperCase();

    if (!allowedStatus.includes(newStatus)) {
      return res.status(400).json({
        status: 400,
        message: `Invalid order status. Allowed values are: ${allowedStatus.join(", ")}`,
      });
    }

    // 🔹 Find the order
    const order = await Order.findOne({
      where: { order_id, restaurant_id },
      attributes: [
        "id", "order_id", "user_id", "restaurant_id", "order_status",
        "paymode", "is_cod_paid", "delivery_boy_id"
      ],
    });

    if (!order) {
      return res.status(404).json({
        status: 404,
        message: "Order not found for this restaurant",
      });
    }

    // 🔹 Update order status
    await Order.update({ order_status: newStatus }, { where: { order_id, restaurant_id } });
    console.log(`✅ Order ${order_id} updated to ${newStatus}`);

    // 🟢 COD auto-payment update
    if (newStatus === "DELIVERED" && order.paymode === "cod") {
      await Order.update({ is_cod_paid: 1 }, { where: { order_id, restaurant_id } });
      console.log(`💰 COD marked as paid for order ${order_id}`);
    }

    // 🟢 If delivery boy assigned from Firebase
    if (["ASSIGN_TO_DELIVERY_BOY", "ORDER_ACCEPT_BY_DB"].includes(newStatus)) {
      try {
        const orderRef = firestore.collection("orders").doc(order_id.toString());
        const orderSnap = await orderRef.get();

        if (orderSnap.exists) {
          const orderData = orderSnap.data();
          const deliveryPartnerId = orderData.deliveryPartnerId || orderData.delivery_boy_id;

          if (deliveryPartnerId) {
            await Order.update({ delivery_boy_id: deliveryPartnerId }, { where: { order_id } });
            console.log(`🚴 Delivery boy ${deliveryPartnerId} assigned to order ${order_id}`);
          } else {
            console.log(`⚠️ No delivery partner ID found in Firebase for order ${order_id}`);
          }
        }
      } catch (fbErr) {
        console.error("❌ Firebase delivery ID fetch error:", fbErr.message);
      }
    }

    // 🔹 Fetch all relevant FCM tokens
    const [userData, restaurantData, deliveryBoyData] = await Promise.all([
      User.findOne({ where: { id: order.user_id }, attributes: ["id", "name", "fcm_token"] }),
      Restaurant.findOne({ where: { id: order.restaurant_id }, attributes: ["id", "name", "fcm_token"] }),
      order.delivery_boy_id
        ? DeliveryBoy.findOne({ where: { id: order.delivery_boy_id }, attributes: ["id", "name", "fcm_token"] })
        : null,
    ]);

    // 🔹 Helper function for sending FCM
    const sendFCM = async (token, title, body) => {
      if (!token) return;
      const message = {
        notification: { title, body },
        token,
      };
      try {
        await fcm.send(message);
        console.log(`✅ Notification sent: ${title}`);
      } catch (err) {
        console.error(`❌ FCM send error: ${err.message}`);
      }
    };

    // 🔹 Send notifications based on status
    switch (newStatus) {
      // ---- To Restaurant ----
      case "ORDER_REQUEST_TO_DB":
        await sendFCM(
          restaurantData?.fcm_token,
          "🍔 New Order Received",
          "A new order has been placed. Please accept it."
        );
        break;

      // ---- To User ----
      case "ORDER_ACCEPT":
        await sendFCM(
          userData?.fcm_token,
          "✅ Order Accepted",
          "Your order has been accepted by the restaurant."
        );
        break;

      // ---- To Delivery Boy ----
      case "PREPARING":
        await sendFCM(
          deliveryBoyData?.fcm_token,
          "👨‍🍳 Order Preparing",
          "Restaurant is preparing the order. Get ready for pickup."
        );
        break;

      // ---- To Delivery Boy ----
      case "READY_TO_PICKUP":
        await sendFCM(
          deliveryBoyData?.fcm_token,
          "🚀 Ready to Pickup",
          "Your order is ready to be picked up from the restaurant."
        );
        break;

      // ---- To User ----
      case "ON_THE_WAY":
        await sendFCM(
          userData?.fcm_token,
          "🚗 On the Way",
          "Your food is on the way to you!"
        );
        break;

      // ---- To User ----
      case "DELIVERED":
        await sendFCM(
          userData?.fcm_token,
          "🎉 Order Delivered",
          "Your order has been delivered successfully!"
        );
        break;

      // ---- To User + Restaurant ----
      case "CANCELLED":
        await sendFCM(
          userData?.fcm_token,
          "❌ Order Cancelled",
          "Your order has been cancelled."
        );
        await sendFCM(
          restaurantData?.fcm_token,
          "⚠️ Order Cancelled",
          "User cancelled the order."
        );
        break;
    }

    // 🔹 Internal API call for delivery boys
    if (newStatus === "READY_TO_PICKUP") {
      try {
        const response = await axios.post("https://root.namasteats.com/api/deliveryboy/test-push-orders", {
          order_id,
          restaurant_id,
        });
        console.log("✅ test-push-orders API triggered:", response.data);
      } catch (pushErr) {
        console.error("❌ test-push-orders API error:", pushErr.message);
      }
    }

    return res.status(200).json({
      status: 200,
      message: `Order status updated to ${newStatus} successfully`,
    });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



exports.getAllRestaurantSettings = async (req, res) => {
  try {
    const settings = await RestaurantSetting.findAll({
      where: { status: "active" },
      attributes: ["id", "title", "slug", "content", "status"],
      order: [["id", "ASC"]],
    });

    return res.status(200).json({
      status: true,
      message: "Restaurant settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    console.error("❌ Error fetching settings:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.getRestaurantAddress = async (req, res) => {
  try {
    const id = req.params.id || req.query.id;

    if (!id) {
      return res.status(400).json({
        status: 400,
        message: 'restaurant id is required (provide as /restaurant/:id or ?id=)',
      });
    }

    const restaurant = await Restaurant.findOne({ where: { id } });
    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: 'Restaurant not found',
        data: null,
      });
    }

    const documents = await RestaurantDocument.findAll({ where: { restaurant_id: id } });
    const timings = await RestaurantTiming.findAll({ where: { restaurant_id: id } });

    return res.status(200).json({
      status: 200,
      message: 'Restaurant data fetched successfully',
      data: {
        restaurant,
        documents,
        timings,
      },
    });
  } catch (error) {
    console.error('Error fetching restaurant data:', error);
    return res.status(500).json({
      status: 500,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

exports.getRestaurantAccountDetails = async (req, res) => {
  try {
    const { restaurant_id } = req.query; // or req.body if you’re sending in POST

    // ✅ Validation
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id is required",
      });
    }

    // ✅ Step 1: Check if restaurant exists
    const restaurantExists = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: ["id", "name"],
    });

    if (!restaurantExists) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found in restaurants table",
      });
    }

    // ✅ Step 2: Check if restaurant documents exist
    const document = await RestaurantDocument.findOne({
      where: { restaurant_id },
      attributes: [
        "id",
        "restaurant_id",
        "pan",
        "gst",
        "bank_owner_name",
        "ifsc_code",
        "bank_account_number",
        "fssai_certificate_number",
        "ifsc",
        "upi_id",
        "type",
        "created_at",
        "updated_at",
      ],
    });

    if (!document) {
      return res.status(404).json({
        status: 404,
        message: "No account/document details found for this restaurant",
      });
    }

    // ✅ Step 3: Return success
    return res.status(200).json({
      status: 200,
      message: "Restaurant account details fetched successfully",
      data: document,
    });
  } catch (error) {
    console.error("❌ Error fetching restaurant account details:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};




// ✅ Get All Order Statuses API
exports.getOrderStatuses = async (req, res) => {
  try {
    const statuses = [
     "PREPARING",
      "ORDER_ACCEPT",
      "CANCELLED",
      "DELIVERED",
      "READY_TO_PICKUP",
      "ON_THE_WAY",
      "PENDING",
      "ASSIGN_TO_DELIVERY_BOY",
      "DELIVERED_BY_PIN",
      "REFUND_INITIATE",
      "REFUND_SUCCESSFULL",
	  "ORDER_REQUEST_TO_DB",
	  "ORDER_ACCEPT_BY_DB",
	  "REACH_PICKUP_POINT",
	  "REACH_DROP_POINT",
	  "ON_THE_WAY_FOR_RESTRO"
    ];

    return res.status(200).json({
      status: 200,
      message: "Order statuses fetched successfully",
      data: statuses
    });

  } catch (error) {
    console.error("Error fetching order statuses:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.updateRestaurantAddress = async (req, res) => {
  try {
    const { restaurant_id, address,city,shop_no, shop_floor,pincode, latitude, longitude } = req.body;

    // 1️⃣ Validate restaurant_id
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id is required",
      });
    }

    // 2️⃣ Check if restaurant exists
    const restaurant = await sequelize.query(
      `SELECT id FROM restaurants WHERE id = :restaurant_id`,
      {
        replacements: { restaurant_id },
        type: QueryTypes.SELECT,
      }
    );

    if (!restaurant || restaurant.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // 3️⃣ Ensure at least one field to update
    if (!address && !city && !shop_no && !shop_floor && !pincode && !latitude && !longitude) {
      return res.status(400).json({
        status: 400,
        message: "Please provide at least one field to update (address,city,shop_no,shop_floor, pincode, latitude, or longitude)",
      });
    }

    // 4️⃣ Build dynamic update query
    let updateFields = [];
    let replacements = { restaurant_id };

    if (address) {
      updateFields.push("address = :address");
      replacements.address = address;
    }
	  if (city) {
      updateFields.push("city = :city");
      replacements.city = city;
    }
	  if (shop_no) {
      updateFields.push("shop_no = :shop_no");
      replacements.shop_no = shop_no;
    }
	  if (shop_floor) {
      updateFields.push("shop_floor = :shop_floor");
      replacements.shop_floor = shop_floor;
    }
    if (pincode) {
      updateFields.push("pincode = :pincode");
      replacements.pincode = pincode;
    }
    if (latitude) {
      updateFields.push("latitude = :latitude");
      replacements.latitude = latitude;
    }
    if (longitude) {
      updateFields.push("longitude = :longitude");
      replacements.longitude = longitude;
    }

    const updateQuery = `
      UPDATE restaurants 
      SET ${updateFields.join(", ")}, updated_at = NOW() 
      WHERE id = :restaurant_id
    `;

    // 5️⃣ Execute the update
    await sequelize.query(updateQuery, {
      replacements,
      type: QueryTypes.UPDATE,
    });

    return res.status(200).json({
      status: 200,
      message: "Restaurant address updated successfully",
    });

  } catch (error) {
    console.error("Error updating restaurant address:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



// ✅ Add Restaurant Offer API
exports.addRestaurantOffer = async (req, res) => {
  try {
    const {
      restaurant_id,
      title,
      description,
      discount_percent,
      max_discount,
      valid_till
    } = req.body;

    if (!restaurant_id || !title || !description || !discount_percent || !max_discount || !valid_till) {
      return res.status(400).json({
        status: 400,
        message: "All fields are required",
      });
    }

    // ✅ Check restaurant exists
    const [restaurant] = await sequelize.query(
      "SELECT id FROM restaurants WHERE id = ?",
      { replacements: [restaurant_id], type: QueryTypes.SELECT }
    );

    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Check if offer already exists
    const [existingOffer] = await sequelize.query(
      "SELECT id FROM restaurant_offers WHERE restaurant_id = ?",
      { replacements: [restaurant_id], type: QueryTypes.SELECT }
    );

    if (existingOffer) {
      return res.status(400).json({
        status: 400,
        message: "An offer already exists for this restaurant",
      });
    }

    // ✅ Insert new offer
    const [insertResult] = await sequelize.query(
      `INSERT INTO restaurant_offers 
        (restaurant_id, title, description, discount_percent, max_discount, valid_till, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      {
        replacements: [
          restaurant_id,
          title,
          description,
          discount_percent,
          max_discount,
          valid_till,
        ],
        type: QueryTypes.INSERT,
      }
    );

    return res.status(201).json({
      status: 201,
      message: "Offer added successfully",
      offer_id: insertResult,
    });

  } catch (error) {
    console.error("❌ Error adding restaurant offer:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


// ✅ View Restaurant Offer API
exports.viewRestaurantOffer = async (req, res) => {
  try {
    const { restaurant_id } = req.body; // You can also use req.params if you prefer

    // ✅ Validation
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "Restaurant ID is required",
      });
    }

    // ✅ Check if restaurant exists
    const [restaurant] = await sequelize.query(
      "SELECT id, name FROM restaurants WHERE id = ?",
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Fetch all offers for this restaurant
    const offers = await sequelize.query(
      `SELECT 
          id,
          title,
          description,
          discount_percent,
          max_discount,
          valid_till,
          created_at,
          updated_at
        FROM restaurant_offers
        WHERE restaurant_id = ?
        ORDER BY id DESC`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    // ✅ If no offers found
    if (!offers.length) {
      return res.status(200).json({
        status: 200,
        message: "No offers found for this restaurant",
        data: [],
      });
    }

    // ✅ Return success
    return res.status(200).json({
      status: 200,
      message: "Restaurant offers fetched successfully",
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
      },
      offers: offers,
    });

  } catch (error) {
    console.error("❌ Error fetching restaurant offers:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.deleteBankDetails = async (req, res) => {
  try {
    const { restaurant_id } = req.body; // ✅ restaurant_id from body

    // ✅ Validation
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id is required",
      });
    }

    // ✅ Check if restaurant exists
    const [restaurant] = await sequelize.query(
      `SELECT id FROM restaurants WHERE id = ?`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Check if bank/UPI details exist
    const [record] = await sequelize.query(
      `SELECT id FROM restaurant_documents WHERE restaurant_id = ?`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    if (!record) {
      return res.status(404).json({
        status: 404,
        message: "No bank or UPI details found for this restaurant",
      });
    }

    // ✅ Delete record(s)
    await sequelize.query(
      `DELETE FROM restaurant_documents WHERE restaurant_id = ?`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.DELETE,
      }
    );

    return res.status(200).json({
      status: 200,
      message: "Bank / UPI details deleted successfully for this restaurant",
    });

  } catch (error) {
    console.error("❌ Error deleting record:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.viewBankDetails = async (req, res) => {
  try {
    const { restaurant_id } = req.body;

    // ✅ Validation
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id is required",
      });
    }

    // ✅ Check if restaurant exists
    const [restaurant] = await sequelize.query(
      `SELECT id FROM restaurants WHERE id = ?`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Fetch bank / UPI details
    const details = await sequelize.query(
      `SELECT id, restaurant_id, pan, gst, bank_owner_name, ifsc_code, bank_account_number, 
              fssai_certificate_number, created_at, updated_at, upi_id, type 
       FROM restaurant_documents 
       WHERE restaurant_id = ?`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    // ✅ If no records found
    if (details.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "No bank or UPI details found for this restaurant",
      });
    }

    // ✅ Success response
    return res.status(200).json({
      status: 200,
      message: "Restaurant bank/UPI details fetched successfully",
      data: details,
    });
  } catch (error) {
    console.error("❌ Error fetching bank details:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.addBankDetails = async (req, res) => {
  try {
    const {
      restaurant_id,
      bank_owner_name,
      bank_account_number,
      ifsc_code,
      upi_id,
      type,
    } = req.body;

    // ✅ Validation
    if (!restaurant_id || !type) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id and type are required",
      });
    }

    const typeUpper = type.toUpperCase();

    // ✅ Check if restaurant exists
    const [restaurant] = await sequelize.query(
      `SELECT id FROM restaurants WHERE id = ?`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Check for existing BANK and UPI entries
    const existingBank = await sequelize.query(
      `SELECT id FROM restaurant_documents WHERE restaurant_id = ? AND type = 'BANK'`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    const existingUpi = await sequelize.query(
      `SELECT id FROM restaurant_documents WHERE restaurant_id = ? AND type = 'UPI'`,
      {
        replacements: [restaurant_id],
        type: QueryTypes.SELECT,
      }
    );

    // ✅ Prevent duplicate of same type
    if (typeUpper === "BANK" && existingBank.length > 0) {
      return res.status(400).json({
        status: 400,
        message: "BANK details already exist for this restaurant.",
      });
    }

    if (typeUpper === "UPI" && existingUpi.length > 0) {
      return res.status(400).json({
        status: 400,
        message: "UPI details already exist for this restaurant.",
      });
    }

    // ✅ Prepare insert query
    let query = "";
    let replacements = [];

    if (typeUpper === "UPI") {
      if (!upi_id) {
        return res.status(400).json({
          status: 400,
          message: "upi_id is required for UPI type",
        });
      }

      // ✅ Even if BANK exists, allow new entry for UPI
      query = `INSERT INTO restaurant_documents 
               (restaurant_id, upi_id, type, created_at, updated_at)
               VALUES (?, ?, ?, NOW(), NOW())`;
      replacements = [restaurant_id, upi_id, typeUpper];
    } else if (typeUpper === "BANK") {
      if (!bank_owner_name || !bank_account_number || !ifsc_code) {
        return res.status(400).json({
          status: 400,
          message: "bank_owner_name, bank_account_number, and ifsc_code are required for BANK type",
        });
      }

      query = `INSERT INTO restaurant_documents 
               (restaurant_id, bank_owner_name, bank_account_number, ifsc_code, type, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, NOW(), NOW())`;
      replacements = [
        restaurant_id,
        bank_owner_name,
        bank_account_number,
        ifsc_code,
        typeUpper,
      ];
    } else {
      return res.status(400).json({
        status: 400,
        message: "Invalid type. Allowed values are 'UPI' or 'BANK'.",
      });
    }

    // ✅ Execute Insert
    const [result] = await sequelize.query(query, {
      replacements,
      type: QueryTypes.INSERT,
    });

    return res.status(201).json({
      status: 201,
      message: `${typeUpper} details added successfully.`,
      inserted_id: result,
    });
  } catch (error) {
    console.error("❌ Error adding bank details:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.addRestaurantFeedback = async (req, res) => {
  try {
    const { restaurant_id, review, rating } = req.body;

    // ✅ Validation
    if (!restaurant_id || !rating) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id and rating are required",
      });
    }

    // ✅ Save feedback
    const feedback = await RestaurantFeedback.create({
      restaurant_id,
      review,
      rating,
    });

    return res.status(201).json({
      status: 201,
      message: "Feedback added successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("❌ Error adding feedback:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.getRestaurantOrdersSummary = async (req, res) => {
  try {
    const { restaurant_id } = req.query;

    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id is required",
      });
    }

    // ✅ Fetch all orders for this restaurant
    const orders = await Order.findAll({
      where: { restaurant_id },
      attributes: [
        "order_id",
        "product_id",
        "order_status",
        "amount",
        "product_quantity",
        "created_at",
        "user_id",
        "restaurant_id",
        "current_address",
      ],
      order: [["created_at", "DESC"]],
    });

    if (!orders.length) {
      return res.status(200).json({
        status: 200,
        message: "No orders found for this restaurant",
        data: {
          new_order_request_count: 0,
          preparing_count: 0,
          ready_to_pickup_count: 0,
          past_orders_count: 0,
          cancelled_orders_count: 0,
		  assign_to_delivery_boy_count: 0,
          sales: 0,
          new_order_request: [],
          preparing: [],
          ready_to_pickup: [],
          past_orders: [],
          cancelled_orders: [],
		  assign_to_delivery_boy: [],
        },
      });
    }

   const enrichedOrders = await Promise.all(
  orders.map(async (order) => {
    const product = await Product.findOne({
      where: { id: order.product_id },
      attributes: ["name", "veg_type","thumbnail_image"],
    });

    // ✅ Get all variants for this product
    const variants = await ProductVariant.findAll({
      where: { product_id: order.product_id },
      attributes: ["name", "price"],
    });

    // ✅ Match variant name and price correctly
    let variant_name = null;
    let variant_price = null;

    if (variants && variants.length > 0) {
      // Match by price-per-quantity logic
      for (const v of variants) {
        if (
          Number(v.price) ===
          Number(order.amount) / Number(order.product_quantity)
        ) {
          variant_name = v.name;
          variant_price = v.price;
          break;
        }
      }

      // fallback agar match na mile
      if (!variant_name) {
        variant_name = variants[0].name;
        variant_price = variants[0].price;
      }
    }

    const user = await User.findOne({
      where: { id: order.user_id },
      attributes: ["name", "mobile_no"],
    });

    const restaurant = await Restaurant.findOne({
      where: { id: order.restaurant_id },
      attributes: ["cooking_time"],
    });

    return {
      order_id: order.order_id,
      product_id: order.product_id,
      product_name: product ? product.name : null,
      veg_type: product ? product.veg_type : null,
	  product_image: product ? product.thumbnail_image : null, // ✅ added here
      variant_name: variant_name,
      variant_price: variant_price,
      product_quantity: order.product_quantity,
      order_status: order.order_status?.toUpperCase() || "PENDING",
      amount: Number(order.amount) || 0,
      created_at: order.created_at,
      current_address: order.current_address || null,
      user_name: user ? user.name : null,
      user_mobile: user ? user.mobile_no : null,
      cooking_time: restaurant ? restaurant.cooking_time : null,
    };
  })
);

    // ✅ Group by order_id
    const groupedOrdersMap = new Map();
    for (const order of enrichedOrders) {
      if (!groupedOrdersMap.has(order.order_id)) {
        groupedOrdersMap.set(order.order_id, {
          order_id: order.order_id,
          user_name: order.user_name,
          user_mobile: order.user_mobile,
          current_address: order.current_address,
          cooking_time: order.cooking_time,
          created_at: order.created_at,
          amount: 0,
          products: [],
          order_status: order.order_status,
        });
      }

      const group = groupedOrdersMap.get(order.order_id);
      group.products.push({
        product_id: order.product_id,
        product_name: order.product_name,
        veg_type: order.veg_type,
		product_image: order.product_image, // ✅ added image here
        variant_name: order.variant_name,
        variant_price: order.variant_price,
        product_quantity: order.product_quantity,
        product_status: order.order_status,
      });

      group.amount += order.amount;
    }

    const groupedOrders = Array.from(groupedOrdersMap.values());

    // ✅ Categorize Orders
    const new_order_request = [];
    const preparing = [];
    const ready_to_pickup = [];
    const past_orders = [];
    const cancelled_orders = [];
    const assign_to_delivery_boy = [];
    let totalSales = 0;

    for (const order of groupedOrders) {
  const statuses = order.products.map((p) => p.product_status?.toUpperCase() || "PENDING");

  if (statuses.every((s) => s === "CANCELLED")) {
    order.order_status = "CANCELLED";
    cancelled_orders.push(order);
  } 
  else if (statuses.every((s) => s === "DELIVERED")) {
    order.order_status = "DELIVERED";
    past_orders.push(order);
    totalSales += order.amount;
  } 
  else if (statuses.some((s) => s === "READY_TO_PICKUP")) {
    order.order_status = "READY_TO_PICKUP";
    ready_to_pickup.push(order);
  } 
  else if (statuses.some((s) => s === "ON_THE_WAY") || statuses.some((s) => s === "ASSIGN_TO_DELIVERY_BOY")) {
    order.order_status = "ASSIGN_TO_DELIVERY_BOY";
    assign_to_delivery_boy.push(order);
  } 
  else if (statuses.some((s) => s === "ORDER_ACCEPT" || s === "PREPARING")) {
    order.order_status = "ORDER_ACCEPT";
    preparing.push(order);
  } 
  else if (statuses.some((s) => s === "PENDING")) {
    order.order_status = "PENDING";
    new_order_request.push(order);
  }
}

    // ✅ Final Response
    return res.status(200).json({
      status: 200,
      message: "Restaurant order summary fetched successfully",
      data: {
        new_order_request_count: new_order_request.length,
        preparing_count: preparing.length,
        ready_to_pickup_count: ready_to_pickup.length,
        past_orders_count: past_orders.length,
        cancelled_orders_count: cancelled_orders.length,
        sales: totalSales,

        new_order_request,
        preparing,
        ready_to_pickup,
        past_orders,
        cancelled_orders,
		assign_to_delivery_boy, // ✅ added,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching order summary:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.updateProducts = async (req, res) => {
  try {
    console.log("📦 FORM DATA:", req.body);

    const { restaurant_id, products } = req.body;

    if (!restaurant_id) {
      return res.status(400).json({
        status: false,
        message: "restaurant_id is required",
      });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Products array is required and cannot be empty",
      });
    }

    const updatedProducts = [];

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const {
        id,
        name,
        description,
        price,
        veg_type,
        thumbnail_image,
        product_media,
        product_variants,
      } = prod;

      // ✅ Validation per product
      if (!id) {
        return res.status(400).json({
          status: false,
          message: `Product at index ${i} is missing 'id'`,
        });
      }
      if (!name || name.trim() === "") {
        return res.status(400).json({
          status: false,
          message: `Product at index ${i} is missing 'name'`,
        });
      }
      if (price === undefined || isNaN(price)) {
        return res.status(400).json({
          status: false,
          message: `Product at index ${i} has invalid 'price'`,
        });
      }
      if (!veg_type || veg_type.trim() === "") {
        return res.status(400).json({
          status: false,
          message: `Product at index ${i} is missing 'veg_type'`,
        });
      }

      // Variants validation
      if (Array.isArray(product_variants)) {
        for (let j = 0; j < product_variants.length; j++) {
          const variant = product_variants[j];
          if (!variant.variant_name || variant.variant_name.trim() === "") {
            return res.status(400).json({
              status: false,
              message: `Product at index ${i}, variant at index ${j} is missing 'variant_name'`,
            });
          }
          if (variant.price === undefined || isNaN(variant.price)) {
            return res.status(400).json({
              status: false,
              message: `Product at index ${i}, variant at index ${j} has invalid 'price'`,
            });
          }
        }
      }

      // ✅ Update product
      await Product.update(
        { name, description, price, veg_type, thumbnail_image },
        { where: { id, restaurant_id } }
      );

      // ✅ Update media
      await ProductMedia.destroy({ where: { product_id: id } });
      if (Array.isArray(product_media)) {
        for (const mediaUrl of product_media) {
          await ProductMedia.create({
            product_id: id,
            type: "image",
            file_url: mediaUrl,
          });
        }
      }

      // ✅ Update variants
      await ProductVariant.destroy({ where: { product_id: id } });
      if (Array.isArray(product_variants)) {
        for (const variant of product_variants) {
          await ProductVariant.create({
            product_id: id,
            name: variant.variant_name,
            price: variant.price,
          });
        }
      }

      // ✅ Push updated product to response
      updatedProducts.push({
        id,
        name,
        description,
        price,
        veg_type,
        thumbnail_image,
        product_media: product_media || [],
        product_variants: product_variants || [],
      });
    }

    return res.status(200).json({
      status: true,
      message: "Products and variants updated successfully",
      data: updatedProducts,
    });
  } catch (error) {
    console.error("❌ Update Products Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.restaurant_list = async (req, res) => {
  try {
    const { restaurant_id } = req.query;

    if (!restaurant_id) {
      return res.status(400).json({
        status: false,
        message: "restaurant_id is required",
      });
    }

    // ✅ Find restaurant
    const restaurant = await Restaurant.findOne({ where: { id: restaurant_id } });
    if (!restaurant) {
      return res.status(404).json({
        status: false,
        message: "Restaurant not found",
      });
    }

    // ✅ Fetch all products for restaurant
    const products = await Product.findAll({
      where: { restaurant_id },
    });

    const productIds = products.map((p) => p.id);

    // ✅ Fetch product media
    const productMedia = await ProductMedia.findAll({
      where: { product_id: productIds.length ? productIds : [0] },
    });

    // ✅ Fetch product variants
    const productVariants = await ProductVariant.findAll({
      where: { product_id: productIds.length ? productIds : [0] },
    });

    // ✅ Fetch restaurant documents
    const restaurantDocs = await RestaurantDocument.findAll({
      where: { restaurant_id },
    });

    // ✅ Helper (direct DB value)
    const formatURL = (url) => (url ? url.replace(/\\/g, "/") : null);

    // ✅ Group product media by product_id
    const mediaGrouped = {};
    productMedia.forEach((m) => {
      const pid = m.product_id;
      if (!mediaGrouped[pid]) mediaGrouped[pid] = [];
      mediaGrouped[pid].push(formatURL(m.file_url));
    });

    // ✅ Group product variants by product_id
    const variantsGrouped = {};
    productVariants.forEach((v) => {
      const pid = v.product_id;
      if (!variantsGrouped[pid]) variantsGrouped[pid] = [];
      variantsGrouped[pid].push({
        variant_name: v.name,
        price: v.price,
      });
    });

    // ✅ Merge all data into product
    const formattedProducts = products.map((p) => ({
      ...p.dataValues,
      thumbnail_image: formatURL(p.thumbnail_image),
      product_media: mediaGrouped[p.id] || [],
      product_variants: variantsGrouped[p.id] || [], // 👈 Add variant list
    }));

    // ✅ Format documents
    const formattedDocs = restaurantDocs.map((d) => ({
      ...d.dataValues,
    }));

    // ✅ Final Response
    return res.status(200).json({
      status: true,
      message: "All restaurant-related data fetched successfully",
      data: {
        products: formattedProducts,
        restaurant_documents: formattedDocs,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching restaurant data:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.updateRestaurantProfile = async (req, res) => {
  try {
    // 🔹 Upload folder
    const uploadPath = "uploads/restaurants";
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

    // 🔹 Multer setup
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, uploadPath);
      },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
      },
    });

    const upload = multer({
      storage: storage,
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed!"), false);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }).single("image");

    // 🔹 Handle upload
    upload(req, res, async function (err) {
      if (err) {
        return res.status(400).json({
          status: 400,
          message: "Image upload failed",
          error: err.message,
        });
      }

      const { restaurant_id, mobile, email } = req.body;

      // ✅ Validation
      if (!restaurant_id) {
        return res.status(400).json({
          status: 400,
          message: "restaurant_id is required",
        });
      }

      if (!mobile && !email && !req.file) {
        return res.status(400).json({
          status: 400,
          message: "At least one field (mobile, email, or image) is required to update",
        });
      }

      // ✅ Check if restaurant exists
      const restaurant = await Restaurant.findOne({ where: { id: restaurant_id } });
      if (!restaurant) {
        return res.status(404).json({
          status: 404,
          message: "Restaurant not found",
        });
      }

      // ✅ Prepare update data
      const updateData = {};
      if (mobile) updateData.mobile = mobile;
      if (email) updateData.email = email;

      // ✅ Handle image update
      if (req.file) {
        const fileUrl = `${BASE_URL}/uploads/restaurants/${req.file.filename}`;

        // 🔥 delete old image if exists
        if (restaurant.image) {
          const oldFile = restaurant.image.replace(`${BASE_URL}/`, "");
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }

        updateData.image = fileUrl; // ✅ Full URL stored in DB
      }

      // ✅ Update restaurant
      await Restaurant.update(updateData, { where: { id: restaurant_id } });

      // ✅ Get updated restaurant
      const updatedRestaurant = await Restaurant.findOne({
        where: { id: restaurant_id },
        attributes: [
          "id",
          "name",
          "email",
          "mobile",
          "owner_name",
          "owner_mobile",
          "is_active",
          "image",
        ],
      });

      return res.status(200).json({
        status: 200,
        message: "Restaurant profile updated successfully",
        data: updatedRestaurant,
      });
    });
  } catch (error) {
    console.error("❌ Error updating restaurant profile:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.getRestaurantProfile = async (req, res) => {
  try {
    const { restaurant_id } = req.query; // ✅ GET ke liye query params se id lo

    // ✅ Validation
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        message: "restaurant_id is required",
      });
    }

    // ✅ Restaurant data fetch
    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: [
        "id",
        "name",
        "image",
        "mobile",
        "email",
        "owner_name",
        "owner_mobile",
		"cod_available",
        "is_active",
        "address",
		"city",
		"shop_no",
		"shop_floor",
        "pincode",
        "latitude",
        "longitude",
      ],
    });

    if (!restaurant) {
      return res.status(404).json({
        status: 404,
        message: "Restaurant not found",
      });
    }

    // ✅ Wallet details fetch
    const wallet = await Wallet.findOne({
      where: {
        entity_id: restaurant_id,
        entity_type: "RESTAURANT",
      },
      attributes: ["total_balance", "current_balance", "status"],
    });
	  
	   // ✅ AddonCharge details fetch
    const addonCharge = await AddonCharge.findOne({
      attributes: [
        "id",
        "base_delivery_charge",
        "admin_charge",
        "base_delivery_distance",
        "addon_charge",
        "estimated_distance_per_km",
        "is_active",
        "created_at",
        "updated_at",
      ],
      where: { is_active: 1 },
    });

    // ✅ Format response
    const formattedData = {
      id: restaurant.id,
      name: restaurant.name,
      email: restaurant.email,
      //image: restaurant.image? `${BASE_URL}${restaurant.image.replace(/\\/g, "/")}`: null,
		image: restaurant.image ? restaurant.image : null,

      mobile: restaurant.mobile,
      owner_name: restaurant.owner_name,
	  cod_available: restaurant.cod_available,   ///0 not avilaable, 1 -avilabel
      owner_mobile: restaurant.owner_mobile,
      is_active: restaurant.is_active,
      address: restaurant.address,
		 shop_no: restaurant.shop_no,
		 shop_floor: restaurant.shop_floor,
      pincode: restaurant.pincode,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,

      // ✅ Wallet info
      wallet: wallet
        ? {
            total_balance: wallet.total_balance,
            current_balance:
              wallet.current_balance < 0 ? 0 : wallet.current_balance, // avoid negative
            status: wallet.status,
          }
        : {
            total_balance: 0,
            current_balance: 0,
            status: "INACTIVE",
          },
		
		 addon_charges: addonCharge ? addonCharge : {},
    };

    return res.status(200).json({
      status: 200,
      message: "Restaurant profile fetched successfully",
      data: formattedData,
    });
  } catch (error) {
    console.error("❌ Error fetching restaurant profile:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.checkRestaurantVerification = async (req, res) => {
  try {
    const { restaurant_id } = req.body;

    if (!restaurant_id) {
      return res.status(400).json({
        status: false,
        message: "restaurant_id is required",
      });
    }

    // ✅ Check restaurant in DB
    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: ["id", "step_id", "is_active", "name"], // optional fields
    });

    if (!restaurant) {
      return res.status(404).json({
        status: false,
        message: "Restaurant not found",
      });
    }

    // ✅ Check condition: step_id = 4 and is_active = 1
    if (Number(restaurant.step_id) === 4 && Number(restaurant.is_active) === 1) {
      return res.status(200).json({
        status: true,
        message: "✅ Restaurant is verified successfully.",
        data: {
          restaurant_id: restaurant.id,
          step_id: restaurant.step_id,
          is_active: restaurant.is_active,
          name: restaurant.name,
        },
      });
    } else {
      return res.status(200).json({
        status: false,
        message: "❌ Restaurant is not verified yet.",
        data: {
          restaurant_id: restaurant.id,
          step_id: restaurant.step_id,
          is_active: restaurant.is_active,
          name: restaurant.name,
        },
      });
    }
  } catch (error) {
    console.error("❌ checkRestaurantVerification error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.menuSetupStepId3 = async (req, res) => {
  try {
    const {
      restaurant_id,
      category_id,
      sub_category_id,
      name,
      description,
      price,
      veg_type,
      unit_variants, // 👈 e.g. [{"name":"Half","price":150},{"name":"Full","price":250}]
    } = req.body;

    // ✅ Required field check
    const requiredFields = {
      restaurant_id,
      category_id,
      sub_category_id,
      name,
      description,
      price,
      veg_type,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value || value === "") {
        return res.status(400).json({
          status: false,
          message: `${key.replace(/_/g, " ")} is required`,
        });
      }
    }

   // ✅ Extract thumbnail image (fieldname = "image")
const imageFile = req.files.find(f => f.fieldname === "image");
const thumbnail_image = imageFile
  ? `${BASE_URL}${imageFile.path.replace(/\\/g, "/")}`
  : null;

// ✅ Multiple images (fieldnames like "images[0]", "images[1]", ...)
const galleryImages = req.files.filter(f => f.fieldname.startsWith("images["));


    // ✅ Create main product entry
    const newProduct = await Product.create({
      restaurant_id,
      category_id,
      sub_category_id,
      name,
      description,
      price,
      veg_type,
      thumbnail_image,
      //step_id: 3,
    });

    // ✅ Store gallery images
    if (galleryImages.length > 0) {
      for (const img of galleryImages) {
        await ProductMedia.create({
          product_id: newProduct.id,
          type: "image",
          file_url: `${BASE_URL}${img.path.replace(/\\/g, "/")}`,
        });
      }
    }

    // ✅ Parse & save product variants
    let parsedVariants = [];
    if (unit_variants) {
      try {
        parsedVariants =
          typeof unit_variants === "string"
            ? JSON.parse(unit_variants)
            : unit_variants;
      } catch (e) {
        console.error("Error parsing unit_variants:", e);
      }
    }

    if (Array.isArray(parsedVariants) && parsedVariants.length > 0) {
      for (const variant of parsedVariants) {
        if (variant.name && variant.price) {
          await ProductVariant.create({
            product_id: newProduct.id,
            name: variant.name.trim(),
            price: parseFloat(variant.price),
          });
        } else {
          console.warn("⚠️ Skipping invalid variant:", variant);
        }
      }
    }

    // ✅ Update restaurant step_id to 3
    await Restaurant.update(
      { step_id: 3 },
      { where: { id: restaurant_id } }
    );

    // ✅ Send success response
    return res.status(201).json({
      status: true,
      message: "✅ Product and all variants added successfully",
      data: {
        product_id: newProduct.id,
        restaurant_id,
        step_id: 3,
        name,
        price,
        veg_type,
        variants_added: parsedVariants.length,
      },
    });
  } catch (error) {
    console.error("❌ menuSetupStepId3 error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getUnitTypes = async (req, res) => {
  try {
    const units = await UnitType.findAll({
      attributes: ["id", "name", "short_code"],
      where: {},          // agar filter chahiye to yahan add karo
      order: [["id", "ASC"]],
      raw: true,
    });

    return res.status(200).json({
      status: true,
      message: "Unit types fetched successfully",
      data: units,
    });
  } catch (error) {
    console.error("❌ getUnitTypes error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};



exports.getCategoriesWithSubCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { status: 1 },
      attributes: ["id", "name", "description", "icon", "image", "veg_type", "status"],
      include: [
        {
          model: SubCategory,
          as: "sub_categories", // ✅ must match alias in model
          where: { status: 1 },
          required: false,
          attributes: ["id", "category_id", "name", "description", "icon", "image", "veg_type", "status"],
        },
      ],
      order: [["id", "ASC"]],
    });

    return res.status(200).json({
      status: true,
      message: "Categories with subcategories fetched successfully",
      data: categories,
    });
  } catch (error) {
    console.error("❌ getCategoriesWithSubCategories error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.updateRestaurantWorkingDays = async (req, res) => {
  try {
    const { restaurant_id, day_of_week, open_time, close_time, is_active } = req.body;

    // ✅ Required field validation
    if (!restaurant_id || !day_of_week) {
      return res.status(400).json({
        status: false,
        message: "restaurant_id and day_of_week are required",
      });
    }

    // ✅ Check if restaurant exists
    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
    });

    if (!restaurant) {
      return res.status(404).json({
        status: false,
        message: "Restaurant not found",
      });
    }

    // ✅ Check if timing record already exists for that restaurant/day
    let timing = await RestaurantTiming.findOne({
      where: { restaurant_id, day_of_week },
    });

    if (timing) {
      // ✅ Update existing timing record
      await timing.update({
        open_time,
        close_time,
        is_active,
      });
    } else {
      // ✅ Create new timing entry
      timing = await RestaurantTiming.create({
        restaurant_id,
        day_of_week,
        open_time,
        close_time,
        is_active,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Working day timing updated successfully",
      data: timing,
    });
  } catch (error) {
    console.error("❌ updateRestaurantWorkingDays error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.restaurantInformationStepId1 = async (req, res) => {
  try {
    const {
      restaurant_id,
      owner_name,
      name,
      restaurant_title,
      latitude,
      longitude,
      address,
		shop_no,
		shop_floor,
		city,
      pincode,
      veg_type,
      email,
      mobile,
      cooking_time,
      cod_available,
      working_days, // array of objects (JSON string from frontend)
    } = req.body;

    // ✅ Required fields check
    const requiredFields = {
      restaurant_id,
      owner_name,
      name,
      restaurant_title,
      address,
		//shoap_no,
		//shoap_floor,
      latitude,
      longitude,
      pincode,
      veg_type,
      email,
      mobile,
      cooking_time,
      cod_available,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value || value === "") {
        return res.status(400).json({
          status: false,
          message: `${key.replace(/_/g, " ")} is required`,
        });
      }
    }

    // ✅ Check if restaurant exists
    const restaurant = await Restaurant.findOne({ where: { id: restaurant_id } });
    if (!restaurant) {
      return res.status(404).json({
        status: false,
        message: "Restaurant not found",
      });
    }

    // ✅ Handle uploaded files (image + video)
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    // ✅ Prepare update data with BASE_URL
    const updatedData = {
      owner_name,
      name,
      restaurant_title,
      address,
		shop_no,
		shop_floor,
		city,
      latitude,
      longitude,
      pincode,
      veg_type,
      email,
      mobile,
      cooking_time,
      cod_available,
      step_id: 1,
    };

    if (imageFile) updatedData.image = formatUrl(imageFile.path);
    if (videoFile) updatedData.video = formatUrl(videoFile.path);

    // ✅ Update restaurant info
    await restaurant.update(updatedData);

    // ✅ Parse working_days (if string from frontend)
    let workingDaysParsed = [];
    if (typeof working_days === "string") {
      try {
        workingDaysParsed = JSON.parse(working_days);
      } catch {
        workingDaysParsed = [];
      }
    } else if (Array.isArray(working_days)) {
      workingDaysParsed = working_days;
    }

    // ✅ Insert / update working days
    if (workingDaysParsed.length > 0) {
      for (const day of workingDaysParsed) {
        const { day_of_week, open_time, close_time, is_active = 1 } = day;
        if (!day_of_week || !open_time || !close_time) continue;

        const existingDay = await RestaurantTiming.findOne({
          where: { restaurant_id, day_of_week },
        });

        if (existingDay) {
          await existingDay.update({ open_time, close_time, is_active });
        } else {
          await RestaurantTiming.create({
            restaurant_id,
            day_of_week,
            open_time,
            close_time,
            is_active,
          });
        }
      }
    }

    // ✅ Final success response
    return res.status(201).json({
      status: true,
      message: "Restaurant information, timings, and media uploaded successfully",
      data: {
        restaurant_id,
        owner_name,
        name,
        restaurant_title,
        address,
		  shop_no,
		  shop_floor,
		  city,
        latitude,
        longitude,
        pincode,
        veg_type,
        email,
        mobile,
        cooking_time,
        cod_available,
        image: imageFile ? formatUrl(imageFile.path) : restaurant.image ? formatUrl(restaurant.image) : null,
        video: videoFile ? formatUrl(videoFile.path) : restaurant.video ? formatUrl(restaurant.video) : null,
        working_days: workingDaysParsed,
        step_id: 1,
      },
    });
  } catch (error) {
    console.error("❌ restaurantInformationStepId1 error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};



exports.addRestaurantDocumentStepId2 = async (req, res) => {
  try {
    const {
      restaurant_id,
      pan,
      gst,
      bank_owner_name,
      ifsc_code,
      bank_account_number,
      fssai_certificate_number,
    } = req.body;

    // ✅ Required fields check
    const requiredFields = {
      restaurant_id,
      pan,
      gst,
      bank_owner_name,
      ifsc_code,
      bank_account_number,
      fssai_certificate_number,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).json({
          status: false,
          message: `${key.replace(/_/g, " ")} is required`,
        });
      }
    }

    // ✅ Check if restaurant exists
    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
    });

    if (!restaurant) {
      return res.status(404).json({
        status: false,
        message: "Restaurant not found",
      });
    }

    // ✅ Insert documents into restaurant_documents
    const document = await RestaurantDocument.create({
      restaurant_id,
      pan,
      gst,
      bank_owner_name,
      ifsc_code,
      bank_account_number,
      fssai_certificate_number,
    });

     // ✅ Update restaurant table → mark process as complete + step_id = 2
    await restaurant.update({ is_process: 1, step_id: 2 });
	  
    return res.status(201).json({
      status: true,
      message: "Documents uploaded successfully",
      step_id: 2, // ✅ returning step_id in response
      data: document,
    });
  } catch (error) {
    console.error("❌ uploadRestaurantDocuments error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.registerOrLoginRestaurant = async (req, res) => {
  try {
    const { mobile, name } = req.body;
    const fcm_token = req.headers["fcm_token"] || req.headers["fcm-token"];

    // ✅ FCM token required validation
    if (!fcm_token || fcm_token.trim() === "") {
      return res.status(400).json({
        status: false,
        message: "FCM token is required in header",
      });
    }

    // ✅ Mobile number validation
    if (!mobile) {
      return res.status(400).json({
        status: false,
        message: "Mobile number is required",
      });
    }

    // ✅ Check if restaurant already exists
    let restaurant = await Restaurant.findOne({ where: { mobile } });

    if (restaurant) {
      // ✅ Already registered → Login
      await Restaurant.update({ fcm_token }, { where: { id: restaurant.id } });
      restaurant.fcm_token = fcm_token;

      // Remove `id`, only return `res_id`
      const { id, ...restData } = restaurant.toJSON();

      return res.status(200).json({
        status: true,
        code: 201,
        message: "Login successful",
        data: {
          ...restData,
          res_id: restaurant.id, // ✅ only res_id shown
        },
        login_status: 1,
      });
    }

    // ✅ Agar name nahi diya gaya → pehle user ko message dena
    if (!name || name.trim() === "") {
      return res.status(404).json({
        status: false,
        message:
          "Your mobile number is not registered, please register first by providing your name.",
        login_status: 0,
      });
    }

    // ✅ Register new restaurant
    const newRestaurant = await Restaurant.create({
      name,
      mobile,
      fcm_token,
      is_active: 0,
      step_id: 0,
      login_status: 1,
    });
	  
	  // ---------------------------------------------------------
    // ✅ CREATE WALLET AUTOMATICALLY FOR THIS RESTAURANT
    // ---------------------------------------------------------
    await Wallet.create({
      entity_id: newRestaurant.id,
      entity_type: "RESTAURANT",
      total_balance: 0,
      current_balance: 0,
      status: 1,
    });

    // Remove `id`, only return `res_id`
    const { id, ...restNewData } = newRestaurant.toJSON();

    return res.status(201).json({
      status: true,
      code: 202,
      message: "Registration successful (inactive by default)",
      data: {
        ...restNewData,
        res_id: newRestaurant.id, // ✅ only res_id shown
      },
    });
  } catch (error) {
    console.error("❌ registerOrLoginRestaurant error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// GET /api/restaurants/:id/products
exports.restaurantProducts = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: false, message: "Restaurant ID is required" });
    }

    // ✅ Restaurant ke sath products aur associations
    const restaurant = await Restaurant.findOne({
      where: { id, is_active: 1 },
      attributes: ["id", "name", "restaurant_title", "veg_type", "address", "rating", "cooking_time", "distance"],
      include: [
        {
          model: Product,
          as: "products",
          attributes: ["id", "name", "description", "price", "thumbnail_image", "veg_type", "status"],
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name", "description", "icon", "image", "veg_type"],
            },
            {
              model: ProductMedia,
              as: "media",
              attributes: ["id", "type", "file_url"],
            }
          ]
        },
        {
          model: RestaurantOffer,
          as: "offers",
          attributes: ["id", "title", "description", "discount_percent", "valid_till"]
        },
        {
          model: RestaurantRating,
          as: "ratings",
          attributes: ["id", "user_id", "rating", "review"]
        },
        {
          model: RestaurantTiming,
          as: "timings",
          attributes: ["id", "day_of_week", "open_time", "close_time"]
        }
      ]
    });

    if (!restaurant) {
      return res.status(400).json({ status: false, message: "Restaurant not found" });
    }

    // ✅ Response format
    return res.json({
      status: true,
      message: "Restaurant with products fetched successfully!",
      data: restaurant
    });

  } catch (error) {
    console.error("Restaurant Products API Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


// ✅ Get restaurant with details + recommended products + offers, ratings, timings
exports.getRestaurantProducts = async (req, res) => {
  try {
    const { restaurant_id } = req.body; // 🔄 ab body se id lenge

    if (!restaurant_id) {
      return res.status(400).json({
        status: false,
        message: "Restaurant ID is required",
      });
    }

    // ✅ Restaurant + products + offers + timings + product_variants + unit_types
    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: ["id", "name", "distance", "address", "image","cod_available", "veg_type","is_active","video", "rating", "cooking_time", "latitude","longitude"], // ✅ delivery_time added

      include: [
        {
          model: Product,
          as: "products",
          attributes: ["id", "name", "price","veg_type","description", "thumbnail_image"],

          include: [
            {
              model: ProductVariant,
              as: "variants",
              attributes: ["id", "name", "quantity", "price", "is_available"],

              include: [
                {
                  model: UnitType,
                  as: "unitType",
                  attributes: ["id", "name", "short_code"],
                },
              ],
            },
          ],
        },
        {
          model: RestaurantOffer,
          as: "offers",
          attributes: ["id", "title", "description", "discount_percent", "valid_till"],
        },
        {
          model: RestaurantTiming,
          as: "timings",
          attributes: ["id", "day_of_week", "open_time", "close_time"],
        },
      ],
    });

    if (!restaurant) {
      return res.status(404).json({
        status: false,
        message: "Restaurant not found",
      });
    }

    // ✅ Response format
    res.json({
      status: true,
      message: "Restaurant details with products + variants fetched successfully",
      data: {
        restaurant_details: {
          res_id: restaurant.id,
          name: restaurant.name,
          distance: restaurant.distance,
          address: restaurant.address,
          image: restaurant.image,
			 cod_available: restaurant.cod_available,
			 is_active: restaurant.is_active,
		  veg_type: restaurant.veg_type,
          video: restaurant.video,
          rating: restaurant.rating,
          cooking_time: restaurant.cooking_time, // ✅ Added here
		  latitude: restaurant.latitude, // ✅ Added here
		  longitude: restaurant.longitude, // ✅ Added here
          offers: restaurant.offers,
          timings: restaurant.timings,
		  res_pro_title: "Rated for you", // ✅ Restaurant case
        },
        recommended_for_you: {
          title: "Recommended For You", // ✅ Title block added
          products: restaurant.products.map((prod) => ({
            p_id: prod.id,
            name: prod.name,
			veg_type:prod.veg_type,
            description: prod.description,
			price:prod.price,
            image: prod.thumbnail_image,
			  res_pro_title: "Dish", // ✅ Restaurant case
            variants: prod.variants.map((variant) => ({
              v_id: variant.id,
              name: variant.name,
              quantity: variant.quantity,
              price: variant.price,
              is_available: variant.is_available,
              unit_type: variant.unitType
                ? {
                    id: variant.unitType.id,
                    name: variant.unitType.name,
                    short_code: variant.unitType.short_code,
                  }
                : null,
            })),
          })),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error in getRestaurantProducts:", error);
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};
