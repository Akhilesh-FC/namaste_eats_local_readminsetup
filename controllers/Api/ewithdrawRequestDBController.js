const sequelize = require("../../config/db");
const { QueryTypes } = require("sequelize");


const { Wallet, Transaction } = require("../../models");

//const WalletModel = require("../../models/Wallet")(sequelize, require("sequelize").DataTypes);
//const Account = require("../../models/Account")(sequelize, require("sequelize").DataTypes);
const ewithdraw_request_DB = require("../../models/ewithdraw_request_DB")(sequelize, require("sequelize").DataTypes);
const Account = require("../../models/Account"); // <-- ye line add kar

const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
//const {Transaction} =require("../../models"); 
//const { Order,Product,ProductVariant,Address, Restaurant,DeliveryBoy,DeliverySetting,Transaction,Wallet} = require("../../models");

// 🔹 Cashfree Config
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "TEST430329ae80e0f32e41a393d78b923034";
const CASHFREE_SECRET = process.env.CASHFREE_SECRET || "TESTaf195616268bd6202eeb3bf8dc458956e7192a85";
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
const CASHFREE_BASE = process.env.CASHFREE_BASE || "https://sandbox.cashfree.com/pg/orders";

exports.payDueAmount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { delivery_boy_id, pay_amount, customer_email, customer_phone } = req.body;

    if (!delivery_boy_id || pay_amount === undefined || pay_amount === null) {
      await t.rollback();
      return res.status(400).json({
        status: false,
        message: "delivery_boy_id and valid pay_amount are required",
      });
    }

    const payAmountNum = parseFloat(pay_amount);
    if (isNaN(payAmountNum) || payAmountNum <= 0) {
      await t.rollback();
      return res.status(400).json({
        status: false,
        message: "pay_amount must be a number greater than 0",
      });
    }

    console.log("🚀 payDueAmount called:", { delivery_boy_id, payAmountNum });

    // 🔒 Lock wallet
    let wallet = await sequelize.query(
      `SELECT * FROM wallets 
       WHERE entity_id = :entity_id AND entity_type = 'DELIVERY_BOY' 
       LIMIT 1 FOR UPDATE`,
      {
        replacements: { entity_id: delivery_boy_id },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (!wallet || wallet.length === 0) {
      console.log("🔍 Wallet not found, creating new one...");
      await sequelize.query(
        `INSERT INTO wallets 
         (entity_id, entity_type, total_balance, current_balance, last_transaction_amount, 
          status, currency, created_at, updated_at) 
         VALUES 
         (:entity_id, 'DELIVERY_BOY', 0.00, 0.00, 0.00, 'ACTIVE', 'INR', NOW(), NOW())`,
        { replacements: { entity_id: delivery_boy_id }, transaction: t }
      );
      wallet = await sequelize.query(
        `SELECT * FROM wallets 
         WHERE entity_id = :entity_id AND entity_type = 'DELIVERY_BOY' 
         LIMIT 1 FOR UPDATE`,
        { replacements: { entity_id: delivery_boy_id }, type: QueryTypes.SELECT, transaction: t }
      );
    }

    const walletData = wallet[0];

    // ✅ Calculate total COD collected (PENDING dues only)
    const totalCOD = await sequelize.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_cod
       FROM orders
       WHERE delivery_boy_id = :delivery_boy_id
         AND paymode = 'cod'
         AND order_status = 'DELIVERED'
         AND (due_status = 'PENDING' OR due_status IS NULL)`,
      {
        replacements: { delivery_boy_id },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const cod_collected = parseFloat(totalCOD[0].total_cod || 0);
    const wallet_balance = parseFloat(walletData.current_balance || 0);

    let wallet_deduction = 0;
    let remaining_to_pay = 0;

    if (wallet_balance >= payAmountNum) {
      wallet_deduction = payAmountNum;
      remaining_to_pay = 0;
    } else {
      wallet_deduction = parseFloat(wallet_balance.toFixed(2));
      remaining_to_pay = parseFloat((payAmountNum - wallet_balance).toFixed(2));
    }

    console.log("💰 Calculation:", {
      wallet_balance,
      wallet_deduction,
      remaining_to_pay,
      cod_collected,
    });

    // 🔻 Deduct from wallet
    if (wallet_deduction > 0) {
      const afterBalance = parseFloat((wallet_balance - wallet_deduction).toFixed(2));
      const walletTxnId = `PD-${Date.now()}-${delivery_boy_id}`;

      await sequelize.query(
        `UPDATE wallets 
         SET current_balance = :current_balance,
             last_transaction_amount = :last_transaction_amount,
             last_transaction_type = 'DEBIT',
             last_transaction_id = :last_transaction_id,
             last_transaction_time = NOW(),
             updated_at = NOW()
         WHERE id = :wallet_id`,
        {
          replacements: {
            wallet_id: walletData.id,
            current_balance: afterBalance,
            last_transaction_amount: wallet_deduction,
            last_transaction_id: walletTxnId,
          },
          transaction: t,
        }
      );

      await sequelize.query(
        `INSERT INTO transactions 
         (entity_id, entity_type, amount, type, description, status, 
          order_id, order_status, payment_method, created_at, updated_at)
         VALUES 
         (:entity_id, 'DELIVERY_BOY', :amount, 'DEBIT', :description, 'SUCCESS',
          :order_id, 'COMPLETED', 'WALLET', NOW(), NOW())`,
        {
          replacements: {
            entity_id: delivery_boy_id,
            amount: wallet_deduction,
            description: 'Due payment deducted from wallet',
            order_id: walletTxnId,
          },
          transaction: t,
        }
      );

      console.log("✅ Wallet transaction inserted successfully");

      // ✅ Update orders due_status -> PAID (if all dues cleared)
      await sequelize.query(
        `UPDATE orders 
         SET due_status = 'PAID'
         WHERE delivery_boy_id = :delivery_boy_id
           AND paymode = 'cod'
           AND order_status = 'DELIVERED'
           AND (due_status = 'PENDING' OR due_status IS NULL)`,
        { replacements: { delivery_boy_id }, transaction: t }
      );
    }

    // 💳 If partial -> Cashfree
    if (remaining_to_pay > 0) {
      const orderId = "ORD_" + uuidv4().replace(/-/g, "").substring(0, 15);

      const payload = {
        order_id: orderId,
        order_amount: remaining_to_pay,
        order_currency: "INR",
        customer_details: {
          customer_id: `cust_${delivery_boy_id}`,
          customer_email: customer_email || "test@example.com",
          customer_phone: customer_phone || "9999999999",
        },
        order_meta: {
          notify_url:
            process.env.CASHFREE_NOTIFY_URL ||
            "https://root.namasteats.com/api/wallet/payment-callback",
          return_url:
            process.env.CASHFREE_RETURN_URL ||
            `https://root.namasteats.com/payment-success?order_id=${orderId}`,
        },
        payment_methods: "upi_intent",
      };

      let cfData = {};
      try {
        const cfResponse = await axios.post(CASHFREE_BASE, payload, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-api-version": CASHFREE_API_VERSION,
            "x-client-id": CASHFREE_APP_ID,
            "x-client-secret": CASHFREE_SECRET,
          },
          timeout: 15000,
        });
        cfData = cfResponse.data || {};
      } catch (cfErr) {
        console.error("❌ Cashfree API error:", cfErr?.response?.data || cfErr.message);
        throw new Error("Cashfree order creation failed: " + (cfErr?.message || "unknown"));
      }

      const cf_order_id = cfData.cf_order_id || cfData.order_id || null;
      const order_id_from_cf = cfData.order_id || orderId;
      const payment_session_id = cfData.payment_session_id || null;
      const payment_link = cfData.payment_link || cfData.payment_url || null;

      await sequelize.query(
        `INSERT INTO transactions 
         (entity_id, entity_type, amount, type, description, status,
          order_id, cf_order_id, payment_session_id, order_status, payment_method, 
          payment_response, currency, created_at, updated_at)
         VALUES 
         (:entity_id, 'DELIVERY_BOY', :amount, 'DEBIT', :description, 'PENDING',
          :order_id, :cf_order_id, :payment_session_id, 'PENDING', 'CASHFREE',
          :payment_response, 'INR', NOW(), NOW())`,
        {
          replacements: {
            entity_id: delivery_boy_id,
            amount: remaining_to_pay,
            description: 'Due payment via Cashfree',
            order_id: order_id_from_cf,
            cf_order_id: cf_order_id,
            payment_session_id: payment_session_id,
            payment_response: JSON.stringify(cfData),
          },
          transaction: t,
        }
      );

      // ✅ Partial payment → update orders as PARTIAL
      await sequelize.query(
        `UPDATE orders 
         SET due_status = 'PARTIAL'
         WHERE delivery_boy_id = :delivery_boy_id
           AND paymode = 'cod'
           AND order_status = 'DELIVERED'
           AND (due_status = 'PENDING' OR due_status IS NULL)`,
        { replacements: { delivery_boy_id }, transaction: t }
      );

      await t.commit();
      return res.status(200).json({
        status: true,
        message: "Partial amount deducted from wallet. Pay remaining via Cashfree.",
        data: {
          wallet_deducted: wallet_deduction,
          remaining_to_pay,
          cashfree_order_id: cf_order_id,
          order_id: order_id_from_cf,
          payment_session_id,
          cf_redirect_url: payment_link,
        },
      });
    }

    // ✅ Fully paid from wallet
    await t.commit();
    console.log("✅ Transaction committed - Fully paid from wallet");

    return res.status(200).json({
      status: true,
      message: "Due amount paid fully from wallet.",
      data: {
        wallet_deducted: wallet_deduction,
        remaining_to_pay: 0,
      },
    });
  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
    try {
      await t.rollback();
    } catch (rbErr) {
      console.error("❌ Rollback failed:", rbErr.message);
    }
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message || String(error),
    });
  }
};


// 🟢 Delivery Boy: Create Withdrawal Request
exports.requestWithdrawal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { delivery_boy_id, amount, account_id, requested_by } = req.body;

    if (!delivery_boy_id || !amount || Number(amount) <= 0 || !account_id) {
      await t.rollback();
      return res.status(400).json({
        status: false,
        message: "delivery_boy_id, account_id and positive amount are required",
      });
    }

    // ✅ Check if account belongs to this delivery boy
    const account = await Account.findOne({
      where: {
        id: account_id,
        entity_type: "DELIVERY_BOY",
        entity_id: delivery_boy_id,
      },
      transaction: t,
    });

    if (!account) {
      await t.rollback();
      return res.status(404).json({
        status: false,
        message: "Invalid account. This account does not belong to the delivery boy.",
      });
    }

    // ✅ Fetch wallet for delivery boy
    const wallet = await WalletModel.findOne({
      where: { entity_id: delivery_boy_id, entity_type: "DELIVERY_BOY" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!wallet) {
      await t.rollback();
      return res.status(404).json({ status: false, message: "Wallet not found" });
    }

    const current = parseFloat(wallet.current_balance || 0);
    const reqAmt = parseFloat(amount);

    if (current < reqAmt) {
      await t.rollback();
      return res.status(400).json({ status: false, message: "Insufficient wallet balance" });
    }

    const beforeBalance = current;
    const afterBalance = +(current - reqAmt).toFixed(2);

    // 🟡 Create withdrawal request
    const newReq = await ewithdraw_request_DB.create(
      {
        delivery_boy_id,
        account_id,
        amount: reqAmt,
        requested_by: requested_by || null,
        wallet_snapshot_before: beforeBalance,
        wallet_snapshot_after: afterBalance,
        requested_at: new Date(),
        status: "PENDING",
      },
      { transaction: t }
    );

    // 🟠 Update wallet
    wallet.current_balance = afterBalance;
    if (typeof wallet.total_balance !== "undefined") {
      wallet.total_balance = +(parseFloat(wallet.total_balance || 0) - reqAmt).toFixed(2);
    }
    wallet.last_transaction_amount = reqAmt;
    wallet.last_transaction_type = "DEBIT";
    wallet.last_transaction_id = `WD-${newReq.id}-${Date.now()}`;
    await wallet.save({ transaction: t });

    await t.commit();

    return res.status(200).json({
      status: true,
      message: "Withdrawal request created successfully",
      data: {
        request_id: newReq.id,
        wallet_balance_after: afterBalance,
        account_verified: true,
      },
    });
  } catch (err) {
    await t.rollback();
    console.error("requestWithdrawal error:", err);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};



// 🟢 Delivery Boy: Get Withdrawal History
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const { delivery_boy_id } = req.body;

    if (!delivery_boy_id) {
      return res.status(400).json({
        status: false,
        message: "delivery_boy_id is required",
      });
    }

    // 🟡 Fetch all withdrawal requests for the delivery boy
    const history = await ewithdraw_request_DB.findAll({
      where: { delivery_boy_id },
      order: [["requested_at", "DESC"]],
      attributes: [
        "id",
        "amount",
        "status",
        "wallet_snapshot_before",
        "wallet_snapshot_after",
        "requested_at",
        "processed_at",
        
      ],
    });

    if (!history.length) {
      return res.status(404).json({
        status: false,
        message: "No withdrawal history found.",
        data: [],
      });
    }

    return res.status(200).json({
      status: true,
      message: "Withdrawal history fetched successfully",
      total_requests: history.length,
      data: history,
    });
  } catch (err) {
    console.error("getWithdrawalHistory error:", err);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};




// 🟡 Admin: List all withdrawal requests
exports.adminListWithdrawals = async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const whereCond = status ? `WHERE e.status = :status` : "";
    const offset = (page - 1) * limit;

    const rows = await sequelize.query(
      `
      SELECT e.*, w.current_balance AS wallet_balance_at_request
      FROM ewithdraw_request_DB e
      LEFT JOIN wallets w ON w.entity_id = e.delivery_boy_id AND w.entity_type = 'DELIVERY_BOY'
      ${whereCond}
      ORDER BY e.created_at DESC
      LIMIT :limit OFFSET :offset
      `,
      {
        replacements: { status, limit: Number(limit), offset: Number(offset) },
        type: QueryTypes.SELECT,
      }
    );

    return res.status(200).json({ status: true, data: rows });
  } catch (err) {
    console.error("adminListWithdrawals error:", err);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: err.message });
  }
};

// 🔴 Admin: Approve or Reject Withdrawal
exports.adminProcessWithdrawal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { request_id, action, processed_by, admin_note, transaction_id } = req.body;

    if (!request_id || !action) {
      await t.rollback();
      return res.status(400).json({ status: false, message: "request_id and action are required" });
    }

    const reqRow = await ewithdraw_request_DB.findOne({
      where: { id: request_id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!reqRow) {
      await t.rollback();
      return res.status(404).json({ status: false, message: "Withdrawal request not found" });
    }

    if (reqRow.status !== "PENDING") {
      await t.rollback();
      return res.status(400).json({ status: false, message: "Only pending requests can be processed" });
    }

    const wallet = await WalletModel.findOne({
      where: { entity_id: reqRow.delivery_boy_id, entity_type: "DELIVERY_BOY" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!wallet) {
      await t.rollback();
      return res.status(404).json({ status: false, message: "Wallet not found" });
    }

    if (action === "APPROVE") {
      reqRow.status = "APPROVED";
      reqRow.processed_by = processed_by || null;
      reqRow.transaction_id = transaction_id || null;
      reqRow.admin_note = admin_note || null;
      reqRow.processed_at = new Date();
      await reqRow.save({ transaction: t });

      await t.commit();
      return res.status(200).json({ status: true, message: "Withdrawal approved successfully" });
    } else if (action === "REJECT") {
      const amt = parseFloat(reqRow.amount || 0);
      const before = parseFloat(wallet.current_balance || 0);
      const after = +(before + amt).toFixed(2);

      wallet.current_balance = after;
      if (typeof wallet.total_balance !== "undefined") {
        wallet.total_balance = +(parseFloat(wallet.total_balance || 0) + amt).toFixed(2);
      }
      wallet.last_transaction_amount = amt;
      wallet.last_transaction_type = "CREDIT";
      wallet.last_transaction_id = `WD-RF-${reqRow.id}-${Date.now()}`;
      await wallet.save({ transaction: t });

      reqRow.status = "REJECTED";
      reqRow.processed_by = processed_by || null;
      reqRow.admin_note = admin_note || null;
      reqRow.processed_at = new Date();
      reqRow.wallet_snapshot_after = after;
      await reqRow.save({ transaction: t });

      await t.commit();
      return res.status(200).json({ status: true, message: "Withdrawal rejected and refunded to wallet" });
    } else {
      await t.rollback();
      return res.status(400).json({ status: false, message: "Invalid action, use APPROVE or REJECT" });
    }
  } catch (err) {
    await t.rollback();
    console.error("adminProcessWithdrawal error:", err);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: err.message });
  }
};
