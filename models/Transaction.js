// models/transaction.js
module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define(
    "Transaction",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      wallet_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      entity_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      entity_type: {
        type: DataTypes.ENUM("USER", "RESTAURANT", "DELIVERY_BOY", "ADMIN"),
        allowNull: false,
      },
      order_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      cf_order_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      payment_session_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      order_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM("CREDIT", "DEBIT"),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      payment_method: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      payment_response: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("SUCCESS", "FAILED", "PENDING"),
        defaultValue: "PENDING",
      },
		currency: {
		  type: DataTypes.STRING(10),
		  allowNull: true,
		},
		
		
		  transaction_source: {  
        type: DataTypes.STRING(50), // ORDER_PAYMENT, COMMISSION, REFUND
        allowNull: true,
      },

      reference_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },

      fee_type: { 
        type: DataTypes.STRING(50), // DELIVERY_FEE, COMMISSION, GST
        allowNull: true,
      },

      meta_data: { 
        type: DataTypes.JSON,
        allowNull: true,
      },

      running_balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },

      initiated_by: {
        type: DataTypes.ENUM("USER", "ADMIN", "SYSTEM"),
        defaultValue: "SYSTEM",
      },

    },
    {
      tableName: "transactions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Transaction;
};
		
		
