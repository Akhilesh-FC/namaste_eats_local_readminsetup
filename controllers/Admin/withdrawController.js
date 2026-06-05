const sequelize = require("../../config/db");
const { QueryTypes } = require("sequelize");
const axios = require("axios");

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "TEST430329ae80e0f32e41a393d78b923034";
const CASHFREE_SECRET = process.env.CASHFREE_SECRET || "TESTaf195616268bd6202eeb3bf8dc458956e7192a85";
const CASHFREE_BASE   = "https://sandbox.cashfree.com/pg";
const CF_VERSION      = "2023-08-01";

// List all withdraw requests
exports.list = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page) || 1);
        const limit  = 10;
        const offset = (page - 1) * limit;
        const status = req.query.status || "";

        let where = "WHERE 1=1";
        const replacements = { limit, offset };
        if (status) { where += " AND wr.status = :status"; replacements.status = status; }

        const [{ total }] = await sequelize.query(
            `SELECT COUNT(*) AS total FROM withdraw_requests wr ${where}`,
            { replacements, type: QueryTypes.SELECT }
        );

        const requests = await sequelize.query(
            `SELECT wr.id, wr.amount, wr.status, wr.requested_at, wr.approved_at, wr.remarks,
                    r.name AS restaurant_name, r.mobile AS restaurant_mobile,
                    rd.bank_owner_name, rd.bank_account_number, rd.ifsc_code, rd.upi_id, rd.type AS payment_type,
                    w.current_balance
             FROM withdraw_requests wr
             LEFT JOIN restaurants r ON r.id = wr.restaurant_id
             LEFT JOIN restaurant_documents rd ON rd.id = wr.account_id
             LEFT JOIN wallets w ON w.id = wr.wallet_id
             ${where}
             ORDER BY wr.id DESC
             LIMIT :limit OFFSET :offset`,
            { replacements, type: QueryTypes.SELECT }
        );

        res.render("withdraw/index", {
            requests,
            page,
            totalPages: Math.ceil(total / limit),
            status,
            title: "Withdraw Requests"
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

// Approve — trigger Cashfree payout
exports.approve = async (req, res) => {
    const { id } = req.params;
    try {
        const [wr] = await sequelize.query(
            `SELECT wr.*, rd.bank_owner_name, rd.bank_account_number, rd.ifsc_code, rd.upi_id, rd.type AS payment_type,
                    r.name AS restaurant_name
             FROM withdraw_requests wr
             LEFT JOIN restaurant_documents rd ON rd.id = wr.account_id
             LEFT JOIN restaurants r ON r.id = wr.restaurant_id
             WHERE wr.id = :id AND wr.status = 'PENDING' LIMIT 1`,
            { replacements: { id }, type: QueryTypes.SELECT }
        );

        if (!wr) return res.json({ success: false, message: "Request not found or already processed" });

        // Build Cashfree payout payload
        const transferId = "WD_" + id + "_" + Date.now();
        const payload = {
            transfer_id: transferId,
            transfer_amount: parseFloat(wr.amount),
            transfer_currency: "INR",
            transfer_mode: wr.payment_type === "UPI" ? "upi" : "banktransfer",
            beneficiary_details: {
                beneficiary_id: "REST_" + wr.restaurant_id,
                beneficiary_name: wr.bank_owner_name || wr.restaurant_name,
                ...(wr.payment_type === "UPI"
                    ? { beneficiary_vpa: wr.upi_id }
                    : {
                        beneficiary_account_number: wr.bank_account_number,
                        beneficiary_ifsc: wr.ifsc_code,
                    }
                )
            }
        };

        // Call Cashfree
        const cfRes = await axios.post(`${CASHFREE_BASE}/payouts/transfers`, payload, {
            headers: {
                "x-client-id": CASHFREE_APP_ID,
                "x-client-secret": CASHFREE_SECRET,
                "x-api-version": CF_VERSION,
                "Content-Type": "application/json"
            },
            timeout: 15000
        });

        // Update DB
        await sequelize.query(
            `UPDATE withdraw_requests SET status='APPROVED', approved_at=NOW(), remarks=:remarks WHERE id=:id`,
            { replacements: { id, remarks: "CF Transfer ID: " + (cfRes.data?.transfer_id || transferId) }, type: QueryTypes.UPDATE }
        );

        return res.json({ success: true, message: "Approved & payout initiated" });
    } catch (err) {
        console.error("Approve error:", err.response?.data || err.message);
        return res.json({ success: false, message: err.response?.data?.message || err.message });
    }
};

// Reject — refund amount back to wallet
exports.reject = async (req, res) => {
    const { id } = req.params;
    const { remarks } = req.body;
    try {
        const [wr] = await sequelize.query(
            `SELECT * FROM withdraw_requests WHERE id = :id AND status = 'PENDING' LIMIT 1`,
            { replacements: { id }, type: QueryTypes.SELECT }
        );

        if (!wr) return res.json({ success: false, message: "Request not found or already processed" });

        // Refund amount back to wallet
        await sequelize.query(
            `UPDATE wallets SET current_balance = current_balance + :amount WHERE id = :wallet_id`,
            { replacements: { amount: wr.amount, wallet_id: wr.wallet_id }, type: QueryTypes.UPDATE }
        );

        // Update request status
        await sequelize.query(
            `UPDATE withdraw_requests SET status='REJECTED', approved_at=NOW(), remarks=:remarks WHERE id=:id`,
            { replacements: { id, remarks: remarks || "Rejected by admin" }, type: QueryTypes.UPDATE }
        );

        return res.json({ success: true, message: "Rejected & amount refunded to wallet" });
    } catch (err) {
        console.error("Reject error:", err.message);
        return res.json({ success: false, message: err.message });
    }
};
