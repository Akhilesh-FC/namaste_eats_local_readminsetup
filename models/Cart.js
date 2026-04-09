const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // aapke DB config ka path

// Cart.js
module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define("Cart", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    restaurant_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
	variant_id : { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: "cart",
    createdAt: "created_at",
    updatedAt: "updated_at",
    timestamps: true
  });

  Cart.associate = (models) => {
    Cart.belongsTo(models.Product, { as: "product", foreignKey: "product_id" });
  };

  return Cart;
};


