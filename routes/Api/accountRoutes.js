// ============================================
// routes/accountRoutes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  createOrUpdateAccount,getAccount,verifyAccount,getAllAccounts,deleteAccount} = require('../../controllers/Api/accountController');

// Public routes
router.post('/account', createOrUpdateAccount);
router.get('/:entity_type/:entity_id', getAccount);

// Admin routes (add auth middleware)
router.get('/accounts', getAllAccounts); // List all accounts
router.patch('/account/verify/:id', verifyAccount); // Verify account
router.delete('/account_delete', deleteAccount); // Delete account
//router.delete("/account", deleteAccount);

module.exports = router;
