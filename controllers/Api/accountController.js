// controllers/accountController.js
const Account = require('../../models/Account');
const User = require("../../models/User");
const { Op } = require("sequelize");



// 🗑️ Delete Account API
const deleteAccount = async (req, res) => {
  try {
    const { entity_id, entity_type } = req.body;

    // ✅ Validation
    if (!entity_id || !entity_type) {
      return res.status(400).json({
        status: false,
        message: "entity_id and entity_type are required",
      });
    }

    // ✅ Validate entity_type
    if (!['RESTAURANT', 'USER', 'DELIVERY_BOY'].includes(entity_type)) {
      return res.status(400).json({
        status: false,
        message: "Invalid entity_type. Must be RESTAURANT, USER, or DELIVERY_BOY",
      });
    }

    // ✅ Find account
    const account = await Account.findOne({
      where: { entity_id, entity_type },
    });

    if (!account) {
      return res.status(404).json({
        status: false,
        message: "Account not found",
      });
    }

    // ✅ Delete the account
    await account.destroy();

    return res.status(200).json({
      status: true,
      message: "Account deleted successfully",
    });

  } catch (error) {
    console.error("Account deletion error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



// Create or Update Account
const createOrUpdateAccount = async (req, res) => {
  try {
    const {
      entity_id,
      entity_type,
      account_holder_name,
      account_number,
      ifsc_code,
      bank_name,
      //branch_name,
      //account_type,
     // upi_id,
      //pan_number,
     // gstin
    } = req.body;

    // Validation
    if (!entity_id || !entity_type || !account_holder_name || !account_number || !ifsc_code) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields"
      });
    }

    // Validate entity_type
    if (!['RESTAURANT', 'USER', 'DELIVERY_BOY'].includes(entity_type)) {
      return res.status(400).json({
        status: false,
        message: "Invalid entity_type. Must be RESTAURANT, USER, or DELIVERY_BOY"
      });
    }

    // Check if account already exists
    let account = await Account.findOne({
      where: { entity_id, entity_type }
    });

    if (account) {
      // Update existing account
      await account.update({
        account_holder_name,
        account_number,
        ifsc_code,
        bank_name,
       // branch_name,
       // account_type,
        //upi_id,
       // pan_number,
       // gstin,
        status: 'ACTIVE'
      });

      return res.status(200).json({
        status: true,
        message: "Account updated successfully",
        data: account
      });
    } else {
      // Create new account
      account = await Account.create({
        entity_id,
        entity_type,
        account_holder_name,
        account_number,
        ifsc_code,
        bank_name,
        //branch_name,
        //account_type: account_type || 'SAVINGS',
       // upi_id,
       // pan_number,
       // gstin,
        status: 'ACTIVE',
        is_verified: false
      });

      return res.status(201).json({
        status: true,
        message: "Account created successfully",
        data: account
      });
    }
  } catch (error) {
    console.error("Account creation error:", error.message);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        status: false,
        message: "Account number already exists"
      });
    }

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get Account Details
const getAccount = async (req, res) => {
  try {
    const { entity_id, entity_type } = req.params;

    if (!entity_id || !entity_type) {
      return res.status(400).json({
        status: false,
        message: "Missing entity_id or entity_type"
      });
    }

    const account = await Account.findOne({
      where: { entity_id, entity_type }
    });

    if (!account) {
      return res.status(404).json({
        status: false,
        message: "Account not found"
      });
    }

    return res.status(200).json({
      status: true,
      data: account
    });
  } catch (error) {
    console.error("Get account error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Verify Account (Admin only)
const verifyAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_verified, notes } = req.body;

    const account = await Account.findByPk(id);

    if (!account) {
      return res.status(404).json({
        status: false,
        message: "Account not found"
      });
    }

    await account.update({
      is_verified,
      verified_at: is_verified ? new Date() : null,
      status: is_verified ? 'ACTIVE' : 'PENDING_VERIFICATION',
      notes
    });

    return res.status(200).json({
      status: true,
      message: "Account verification updated",
      data: account
    });
  } catch (error) {
    console.error("Verify account error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get All Accounts (Admin only - with filters)
const getAllAccounts = async (req, res) => {
  try {
    const { entity_type, status, is_verified } = req.query;

    const where = {};
    if (entity_type) where.entity_type = entity_type;
    if (status) where.status = status;
    if (is_verified !== undefined) where.is_verified = is_verified === 'true';

    const accounts = await Account.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      status: true,
      count: accounts.length,
      data: accounts
    });
  } catch (error) {
    console.error("Get all accounts error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


module.exports = {
  createOrUpdateAccount,
  getAccount,
  verifyAccount,
  getAllAccounts,
  deleteAccount
};
