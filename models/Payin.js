module.exports = (sequelize, DataTypes) => {
  const Payin = sequelize.define("Payin", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    restaurant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("SUCCESS", "FAILED", "PENDING"),
      defaultValue: "PENDING",
    },
  }, {
    tableName: "payins",
    timestamps: true,
	createdAt: "created_at",    
 	updatedAt: "updated_at",
  });

  return Payin;
};
