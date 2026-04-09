const express = require("express");
const router = express.Router();

// Import controllers
const {requestWithdrawal,adminListWithdrawals,adminProcessWithdrawal,payDueAmount,getWithdrawalHistory} = require("../../controllers/Api/ewithdrawRequestDBController");

// 🟢 Delivery Boy: Create Withdrawal Request
router.post("/withdraw_request", requestWithdrawal);
router.post("/getWithdrawalHistory", getWithdrawalHistory);
router.post("/pay_due", payDueAmount);

// 🟡 Admin: List All Withdrawal Requests
router.get("/withdraw_list", adminListWithdrawals);

// 🔴 Admin: Approve or Reject Withdrawal
router.post("/withdraw_process", adminProcessWithdrawal);

module.exports = router;
