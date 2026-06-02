module.exports = (sequelize, DataTypes) => {
  const Wallet = sequelize.define(
    "Wallet",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      entity_id: { type: DataTypes.INTEGER, allowNull: false },
      entity_type: {
        type: DataTypes.ENUM("USER", "RESTAURANT", "DELIVERY_BOY", "ADMIN"),
        allowNull: false,
      },
      total_balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      current_balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      last_transaction_id: { type: DataTypes.STRING(100), allowNull: true },
      last_transaction_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      last_transaction_type: {
        type: DataTypes.ENUM("CREDIT", "DEBIT"),
        allowNull: true,
      },
      cf_order_id: { type: DataTypes.STRING(100), allowNull: true },
      order_id: { type: DataTypes.STRING(100), allowNull: true },
      payment_session_id: { type: DataTypes.STRING(255), allowNull: true },
      order_status: { type: DataTypes.STRING(50), allowNull: true },
      payment_response: { type: DataTypes.JSON, allowNull: true },
    
	  
	  //status: { type: DataTypes.INTEGER, defaultValue: 1 },
		//status: { type: DataTypes.STRING(20), defaultValue: "ACTIVE" },
		status: {
  type: DataTypes.ENUM("ACTIVE", "INACTIVE", "BLOCKED"),
  defaultValue: "ACTIVE"
},


payment_status: { type: DataTypes.STRING(50), allowNull: true },
metadata: { type: DataTypes.JSON, allowNull: true },
remarks: { type: DataTypes.STRING(255), allowNull: true },
currency: { type: DataTypes.STRING(10), allowNull: true },
last_transaction_time: { type: DataTypes.DATE, allowNull: true },
payment_method: { type: DataTypes.STRING(100), allowNull: true },

	  },
    {
      tableName: "wallets",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Wallet;
};
