const User = require("../../models/User");
const { Wallet,Transaction,sequelize,Order} = require("../../models");
const { AddonCharge } = require("../../models"); 
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const db = require("../../config/db"); // mysql connection
const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");



// Use env vars - set these in your .env file
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "TEST430329ae80e0f32e41a393d78b923034";
const CASHFREE_SECRET = process.env.CASHFREE_SECRET || "TESTaf195616268bd6202eeb3bf8dc458956e7192a85";
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
const CASHFREE_BASE = process.env.CASHFREE_BASE || "https://sandbox.cashfree.com/pg/orders";
// ✅ CREATE WALLET SESSION

const createWalletSession = async (req, res) => {
  try {
    const { entity_id, entity_type, amount, customer_email, customer_phone } = req.body;

    console.log("🟢 Incoming createWalletSession request:", req.body);

    if (!entity_id || !entity_type || !amount) {
      return res.status(400).json({
        status: false,
        message: "Missing fields (entity_id, entity_type, amount)"
      });
    }

    // generate unique IDs
    const orderId = "ORD_" + uuidv4().replace(/-/g, "").substring(0, 15);
    const paymentSessionId = "SESS_" + uuidv4().replace(/-/g, "").substring(0, 12);

    // Prepare payload for Cashfree
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
        notify_url:
          process.env.CASHFREE_NOTIFY_URL ||
          "https://root.namasteats.com/api/user/payment-callback",
        return_url:
          process.env.CASHFREE_RETURN_URL ||
          `https://root.namasteats.com/payment-success?order_id=${orderId}`,
      },
      payment_methods: "upi_intent",
    };

    // 🔹 Call Cashfree API
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

    // 🔹 STEP 1: Find existing wallet for this user
    let wallet = await Wallet.findOne({ where: { entity_id, entity_type } });

    if (!wallet) {
      console.log("🆕 Creating new wallet...");
      wallet = await Wallet.create({
        entity_id,
        entity_type,
        total_balance: parseFloat(amount),
        current_balance: parseFloat(amount),
      });
    } else {
      console.log("💰 Wallet already exists, updating balances...");
      // Add the amount to existing balances (top-up)
      const newTotal = parseFloat(wallet.total_balance || 0) + parseFloat(amount);
      const newCurrent = parseFloat(wallet.current_balance || 0) + parseFloat(amount);

      await wallet.update({
        total_balance: newTotal,
        current_balance: newCurrent,
      });
    }

    console.log("💰 Wallet found/created with ID:", wallet.id);

    // 🔹 STEP 2: Prevent duplicate transaction
    const txnOrderId = cfData.order_id || orderId;
    const existingTxn = await Transaction.findOne({
      where: { order_id: txnOrderId },
    });

    if (!existingTxn) {
      console.log("🧾 Creating new transaction...");
      await Transaction.create({
        wallet_id: wallet.id,
        entity_id,
        entity_type,
        order_id: txnOrderId,
        amount: parseFloat(amount),
        type: "CREDIT",
        description: "Wallet Top-up",
        status: "SUCCESS",
      });
    } else {
      console.log("⚠️ Transaction already exists, skipping insert.");
    }

    // 🔹 STEP 3: Update wallet with payment info
    await wallet.update({
      order_id: txnOrderId,
      cf_order_id: cfData.cf_order_id || null,
      payment_session_id: cfData.payment_session_id || null,
      order_status: cfData.order_status || "PENDING",
      payment_response: cfData || null,
    });

    console.log("🔁 Wallet updated with order info!");

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
    console.error("❌ Create wallet session error:", err.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};


const paymentCallback = async (req, res) => {
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



// CASHFREE PAYMENT CALLBACK
const cashfreeCallback = async (req, res) => {
  try {
    const { order_id, order_status, order_amount, cf_order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ status: false, message: "order_id missing" });
    }

    // STEP 1: Find Wallet
    const wallet = await Wallet.findOne({ where: { order_id } });

    if (!wallet) {
      return res.status(404).json({ status: false, message: "Wallet entry not found" });
    }

    // STEP 2: Check Existing Transaction (idempotent)
    let transaction = await Transaction.findOne({ where: { order_id } });

    // If already processed, skip
    if (transaction && (transaction.status === "SUCCESS" || transaction.status === "FAILED")) {
      return res.status(200).json({
        status: true,
        message: "Payment already processed",
      });
    }

    // STEP 3: Create Transaction if not exists
    if (!transaction) {
      transaction = await Transaction.create({
        wallet_id: wallet.id,
        entity_id: wallet.entity_id,
        entity_type: wallet.entity_type,
        order_id,
        amount: order_amount,
        type: "CREDIT",
        status: order_status,
        cf_order_id,
        description: "Wallet Top-up",
      });
    } else {
      transaction.status = order_status;
      transaction.cf_order_id = cf_order_id;
      await transaction.save();
    }

    // STEP 4: Update wallet info
    wallet.order_status = order_status;
    wallet.payment_status = order_status;
    wallet.last_transaction_id = order_id;
    wallet.last_transaction_amount = order_amount;
    wallet.cf_order_id = cf_order_id;

    // STEP 5: Add money ONLY on SUCCESS
    if (order_status === "SUCCESS") {
      wallet.current_balance += parseFloat(order_amount);
      wallet.total_balance += parseFloat(order_amount);
    }

    await wallet.save();

    return res.status(200).json({
      status: true,
      message: "Payment processed successfully",
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Error processing callback",
    });
  }
};


// GET WALLET TRANSACTION HISTORY (user_id only)
const getWalletTransactionHistory = async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // STEP 1: Find wallet of USER
    const wallet = await Wallet.findOne({
      where: {
        entity_id: user_id,
        entity_type: "USER"
      }
    });

    if (!wallet) {
      return res.status(404).json({
        status: false,
        message: "No wallet found for this user",
      });
    }

    // STEP 2: Fetch CREDIT transaction history
    const transactions = await Transaction.findAll({
      where: {
        wallet_id: wallet.id,
        type: ["CREDIT", "DEBIT"] 
      },
      order: [["id", "DESC"]],
      attributes: [
        "id",
        "order_id",
        "amount",
        "type",
        "status",
        "created_at"
      ]
    });

    return res.status(200).json({
      status: true,
      message: "Transaction history fetched successfully",
      data: {
        wallet_id: wallet.id,
        current_balance: wallet.current_balance,
        total_transactions: transactions.length,
        transactions
      }
    });

  } catch (error) {
    console.error("Transaction History Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};


const sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    // ✅ Validation
    if (!mobile || mobile.length !== 10) {
      return res.status(200).json({
        status: false,
        field: "mobile",
        message: "Valid 10 digit mobile required"
      });
    }

    const MERCHANT_KEY = "e280cfc2e0db83480de11bb607ef7ce72f8b98f3420cb984";

    const url = `https://indopay.cloud/otp/newsend_otp.php?merchant_key=${MERCHANT_KEY}&mobile_no=${mobile}&digit=4`;

    await axios.get(url);

    return res.status(200).json({
      status: true,
      message: "OTP sent successfully"
    });

  } catch (error) {
    console.log("sendOtp error:", error.message);

    return res.status(500).json({
      status: false,
      message: error.message
    });
  }
};


const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    // ✅ Validation
    if (!mobile) {
      return res.status(200).json({
        status: false,
        field: "mobile",
        message: "Mobile is required"
      });
    }

    if (!otp) {
      return res.status(200).json({
        status: false,
        field: "otp",
        message: "OTP is required"
      });
    }

    if (mobile.length !== 10) {
      return res.status(200).json({
        status: false,
        field: "mobile",
        message: "Invalid mobile number"
      });
    }

    const MERCHANT_KEY = "e280cfc2e0db83480de11bb607ef7ce72f8b98f3420cb984";

    const url = `https://indopay.cloud/otp/verifyotp.php?merchant_key=${MERCHANT_KEY}&mobile=${mobile}&otp=${otp}`;

    const response = await axios.get(url);

    console.log("OTP RESPONSE:", response.data);

    // ✅ Success check (same logic)
    const otpSuccess =
      response.data?.status == "success" ||
      response.data?.status == "true" ||
      response.data?.success == true ||
      response.data?.error == "200" ||
      response.data?.msg?.includes("Successfully");

    if (!otpSuccess) {
      return res.status(200).json({
        status: false,
        message: "Invalid OTP",
        data: response.data
      });
    }

    return res.status(200).json({
      status: true,
      message: "OTP verified successfully"
    });

  } catch (error) {
    console.log("verifyOtp error:", error.response?.data || error.message);

    return res.status(500).json({
      status: false,
      message: error.response?.data || error.message
    });
  }
};



// ✅ Register API with fcm_token required
const register = async (req, res) => {
  try {
    const { name, email, mobile_no } = req.body;

    // Step 1: FCM token from headers
    const fcmToken = req.headers["fcm_token"] || req.headers["fcm-token"];
    if (!fcmToken) {
      return res.status(200).json({
        status: false,
        field: "fcm_token",
        message: "FCM token is required",
        user_id: null
      });
    }

    // ✅ Name required
    if (!name) {
      return res.status(200).json({
        status: false,
        field: "name",
        message: "Name is required",
        user_id: null
      });
    }

    // ✅ Check unique constraints
    if (mobile_no) {
      const existingMobile = await User.findOne({ where: { mobile_no } });
      if (existingMobile) {
        return res.status(200).json({
          status: false,
          field: "mobile_no",
          message: "Mobile number already exists",
          user_id: null
        });
      }
    }

    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(200).json({
          status: false,
          field: "email",
          message: "Email already exists",
          user_id: null
        });
      }
    }

    // ✅ Create user (with fcm_token)
    const user = await User.create({
      name,
      email: email || null,
      mobile_no: mobile_no || null,
      fcm_token: fcmToken
    });
	  
	  
	// ⭐⭐⭐ AUTO CREATE USER WALLET ⭐⭐⭐
    await Wallet.create({
      entity_id: user.id,
      entity_type: "USER",
      total_balance: 0,
      current_balance: 0,
      status: 1,
      currency: "INR"
    });	  


    // ✅ Response same format
    return res.status(200).json({
      status: true,
      message: "Registration successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile_no: user.mobile_no,
        fcm_token: user.fcm_token
      }
    });

  } catch (error) {
    console.log("register error", error);
    return res.status(500).json({
      status: false,
      message: error.message,
      user_id: null
    });
  }
};

// Login
const login = async (req, res) => {
	console.log("req.params", req.params);
  try {
    const { mobile_no, email } = req.body;
	  //console.log("req.body", req.body)

    // Step 1: Validation (either mobile_no or email required)
    if (!mobile_no && !email) {
      return res.status(200).json({
        status: false,
        field: "mobile_no / email",
        message: "Either mobile_no or email is required",
        login_status: 0,
        user_id: null
      });
    }
//console.log("yaha tk pahuh gye h ")
    // Step 2: FCM token from headers
	  const fcmToken =
  req.headers["fcm_token"] || req.headers["fcm-token"];

	  console.log("fcmTokenfcmToken",fcmToken)
    if (!fcmToken) {
      return res.status(200).json({
        status: false,
        field: "fcm_token",
        message: "FCM token is required in h",
        login_status: 0,
        user_id: null
      });
    }

    let user;
    if (mobile_no) {
      user = await User.findOne({ where: { mobile_no } });
    }
    if (!user && email) {
      user = await User.findOne({ where: { email } });
    }

   
    if (user) {
      await user.update({ fcm_token: fcmToken });

      return res.status(200).json({
        status: true,
        message: "Login successful",
        fcm_token: user.fcm_token,
        login_status: 1,
        user_id: user.id
      });
    } else {
      
      return res.status(200).json({
        status: false,
        message: "User not registered",
        login_status: 0,
        user_id: null
      });
    }

  } catch (error) {
	  console.log("error",error)
    return res.status(500).json({
      status: false,
      message: error.message,
      login_status: 0,
      user_id: null
    });
  }
};



const profile = async (req, res) => {
  try {
    const { id: userId } = req.params;
    if (!userId) {
      return res.json({ status: false, message: "User ID is required" });
    }

    const users = await db.query(
      "SELECT * FROM users WHERE id = ?",
      { replacements: [userId], type: db.QueryTypes.SELECT }
    );

    if (!users.length) {
      return res.json({ status: false, message: "User not found" });
    }

    let user = users[0];

    const wallet = await Wallet.findOne({
      where: { entity_id: userId, entity_type: "USER" },
      attributes: ["total_balance", "current_balance", "status"],
    });

    user.total_balance = wallet ? wallet.total_balance : "0.00";
    user.current_balance = wallet
      ? (wallet.current_balance < 0 ? "0.00" : wallet.current_balance)
      : "0.00";
    return res.json({
      status: true,
      message: "User profile fetched successfully",
      data: user,
    });
  } catch (err) {
    console.error("Profile API Error:", err);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: err.message,
    });
  }
};

const updateProfileformdata = async (req, res) => {
  try {
    console.log("📥 Incoming Body:", req.body);
    console.log("📸 Incoming File:", req.file);

    const {
      user_id,
      name,
      email,
      mobile,
      dob,
      anniversary,
      gender,
    } = req.body;

    // -------------------------
    // VALIDATION SECTION
    // -------------------------
    if (!user_id) {
      return res.json({
        status: false,
        message: "User ID is required",
      });
    }

    if (email && !email.includes("@")) {
      return res.json({
        status: false,
        message: "Invalid email format",
      });
    }

    if (mobile && mobile.length < 10) {
      return res.json({
        status: false,
        message: "Mobile number must be at least 10 digits",
      });
    }

    // -------------------------
    // USER EXIST CHECK
    // -------------------------
    const rows = await db.query("SELECT * FROM users WHERE id = ?", {
      replacements: [user_id],
      type: db.QueryTypes.SELECT,
    });

    if (!rows || rows.length === 0) {
      return res.json({ status: false, message: "User not found" });
    }

    let user = rows[0];
    let profileImageUrl = user.profile_image;

    const BASE_URL = process.env.BASE_URL || "https://root.namasteats.com";

    // -------------------------
    // PROFILE IMAGE HANDLING (FORM-DATA)
    // -------------------------
    if (req.file) {

      const uploadDir = path.join(__dirname, "../../public/uploads/profile");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // DELETE OLD IMAGE
      if (user.profile_image) {
        const relativePath = user.profile_image
          .replace(BASE_URL, "")
          .replace(/^\/+/, "");
        const oldPath = path.join(__dirname, "../../public", relativePath);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const ext = path.extname(req.file.originalname) || ".png";

      const fileName = `profile_${Date.now()}_${Math.floor(
        Math.random() * 10000
      )}${ext}`;

      fs.writeFileSync(
        path.join(uploadDir, fileName),
        req.file.buffer
      );

      profileImageUrl = `${BASE_URL}/uploads/profile/${fileName}`;
    }

    // -------------------------
    // DYNAMIC UPDATE FIELDS
    // -------------------------
    const fields = [];
    const values = [];

    if (name?.trim()) {
      fields.push("name=?");
      values.push(name.trim());
    }

    if (email?.trim()) {
      fields.push("email=?");
      values.push(email.trim());
    }

    if (mobile) {
      fields.push("mobile=?");
      values.push(mobile);
    }

    if (dob) {
      fields.push("dob=?");
      values.push(dob);
    }

    if (anniversary) {
      fields.push("anniversary=?");
      values.push(anniversary);
    }

    if (gender) {
      fields.push("gender=?");
      values.push(gender);
    }

    if (req.file) {
      fields.push("profile_image=?");
      values.push(profileImageUrl);
    }

    if (fields.length === 0) {
      return res.json({
        status: false,
        message: "No fields to update",
      });
    }

    values.push(user_id);

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id=?`;

    console.log("🔍 UPDATE SQL:", sql);
    console.log("🔍 VALUES:", values);

    await db.query(sql, { replacements: values });

    const updatedUser = await db.query(
      "SELECT * FROM users WHERE id = ?",
      {
        replacements: [user_id],
        type: db.QueryTypes.SELECT,
      }
    );

    return res.json({
      status: true,
      message: "Profile updated successfully",
      data: updatedUser[0],
    });

  } catch (err) {
    console.error("❌ Update Profile Error:", err);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: err.message,
    });
  }
};


const updateProfile = async (req, res) => {
  try {
    console.log("📥 Incoming Body:", req.body);

    const {
      user_id,
      name,
      email,
      mobile,
      dob,
      anniversary,
      gender,
      profile_image,
    } = req.body;

    // -------------------------
    // VALIDATION SECTION
    // -------------------------
    if (!user_id) {
      return res.json({
        status: false,
        message: "User ID is required",
      });
    }

    // Email validation
    if (email && !email.includes("@")) {
      return res.json({
        status: false,
        message: "Invalid email format",
      });
    }

    // Mobile validation - flexible for country codes
    if (mobile && mobile.length < 10) {
      return res.json({
        status: false,
        message: "Mobile number must be at least 10 digits",
      });
    }

    // -------------------------
    // USER EXIST CHECK
    // -------------------------
    const rows = await db.query("SELECT * FROM users WHERE id = ?", {
      replacements: [user_id],
      type: db.QueryTypes.SELECT,
    });

    if (!rows || rows.length === 0) {
      return res.json({ status: false, message: "User not found" });
    }

    let user = rows[0];
    let profileImageUrl = user.profile_image;

    // Dynamic base URL from .env
    const BASE_URL = process.env.BASE_URL || "https://root.namasteats.com";

    // -------------------------
    // PROFILE IMAGE HANDLING
    // -------------------------
  if (profile_image && profile_image.startsWith("data:image")) {

  const base64Data = profile_image.replace(/^data:image\/\w+;base64,/, "");
  const sizeInBytes = (base64Data.length * 3) / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.json({
      status: false,
      message: "Image size must be under 5MB",
    });
  }

  const uploadDir = path.join(__dirname, "../../public/uploads/profile");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // DELETE OLD IMAGE
  if (user.profile_image) {
    const relativePath = user.profile_image
      .replace(BASE_URL, "")
      .replace(/^\/+/, "");
    const oldPath = path.join(__dirname, "../../public", relativePath);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const matches = profile_image.match(/^data:image\/(\w+);base64,/);
  const ext = matches ? matches[1] : "png";

  const fileName = `profile_${Date.now()}_${Math.floor(
    Math.random() * 10000
  )}.${ext}`;

  fs.writeFileSync(
    path.join(uploadDir, fileName),
    Buffer.from(base64Data, "base64")
  );

  profileImageUrl = `${BASE_URL}/uploads/profile/${fileName}`;
}


    // -------------------------
    // DYNAMIC FIELDS TO UPDATE
    // -------------------------
    const fields = [];
    const values = [];

    if (name !== undefined && name !== null && name.trim() !== "") {
      fields.push("name=?");
      values.push(name.trim());
    }
    if (email !== undefined && email !== null && email.trim() !== "") {
      fields.push("email=?");
      values.push(email.trim());
    }
    if (mobile !== undefined && mobile !== null) {
      fields.push("mobile=?");
      values.push(mobile);
    }
    if (dob !== undefined && dob !== null) {
      fields.push("dob=?");
      values.push(dob);
    }
    if (anniversary !== undefined && anniversary !== null) {
      fields.push("anniversary=?");
      values.push(anniversary);
    }
    if (gender !== undefined && gender !== null) {
      fields.push("gender=?");
      values.push(gender);
    }

    // Update profile image when new base64 provided
    if (profile_image && profile_image.startsWith("data:image")) {
      fields.push("profile_image=?");
      values.push(profileImageUrl);
    }

    if (fields.length === 0) {
      return res.json({
        status: false,
        message: "No fields to update",
      });
    }

    values.push(user_id);

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id=?`;

    console.log("🔍 UPDATE SQL:", sql);
    console.log("🔍 VALUES:", values);

    const updateResult = await db.query(sql, { replacements: values });
    
    console.log("✅ Update Result:", updateResult);

    // Fetch updated user
    const updatedUserRows = await db.query("SELECT * FROM users WHERE id = ?", {
      replacements: [user_id],
      type: db.QueryTypes.SELECT,
    });

    return res.json({
      status: true,
      message: "Profile updated successfully",
      data: updatedUserRows[0],
    });

  } catch (err) {
    console.error("❌ Update Profile Error:", err);

    return res.status(500).json({
      status: false,
      message: "Server error",
      error: err.message,
    });
  }
};

const getCashfreeStatus = async (req, res) => {
  try {
    const { user_id, order_id } = req.query;

    if (!user_id || !order_id) {
      return res.status(400).json({
        status: false,
        message: "user_id and order_id are required",
      });
    }

    // 🔍 TABLE me cf_order_id + user_id se search karna hai
    const order = await Order.findOne({
      where: { 
        cf_order_id: order_id,   // cf_order_id match
        user_id: user_id         // user_id match
      }
    });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found for this user",
      });
    }

    // 🔥 Return only required fields
    return res.status(200).json({
      status: true,
      message: "Payment status fetched successfully",
      data: {
        order_id: order.cf_order_id,        // return cf order id
        payment_status: order.payment_status,
        order_status: order.order_status,
        amount: order.amount
      }
    });

  } catch (err) {
    console.error("Payment status API error:", err.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};


module.exports = {  login, register, profile, updateProfile,updateProfileformdata,createWalletSession,cashfreeCallback,paymentCallback ,getWalletTransactionHistory  ,getCashfreeStatus,verifyOtp,sendOtp };

