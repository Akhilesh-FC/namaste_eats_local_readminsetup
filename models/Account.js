// models/Account.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Account = sequelize.define('Account', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'ID of restaurant/user/delivery_boy',
  },
  entity_type: {
    type: DataTypes.ENUM('RESTAURANT', 'USER', 'DELIVERY_BOY'),
    allowNull: false,
    comment: 'Type of entity',
  },
  account_holder_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Name on bank account',
  },
  account_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Bank account number',
  },
  ifsc_code: {
    type: DataTypes.STRING(11),
    allowNull: false,
    comment: 'IFSC code',
  },
  bank_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Bank name',
  },
  branch_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Branch name',
  },
  account_type: {
    type: DataTypes.ENUM('SAVINGS', 'CURRENT'),
    defaultValue: 'SAVINGS',
    comment: 'Account type',
  },
  upi_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'UPI ID for payments',
  },
  pan_number: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'PAN card number (for restaurants)',
  },
  gstin: {
    type: DataTypes.STRING(15),
    allowNull: true,
    comment: 'GST number (for restaurants)',
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Verification status',
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Verification timestamp',
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION'),
    defaultValue: 'PENDING_VERIFICATION',
    comment: 'Account status',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Additional notes/remarks',
  },
}, {
  tableName: 'accounts',
  timestamps: true,
  createdAt: "created_at", // Laravel convention
  updatedAt: "updated_at",
  indexes: [
    {
      unique: true,
      fields: ['entity_id', 'entity_type'],
      name: 'unique_entity_account'
    },
    {
      fields: ['entity_type'],
      name: 'idx_entity_type'
    },
    {
      fields: ['status'],
      name: 'idx_status'
    }
  ]
});

module.exports = Account;

