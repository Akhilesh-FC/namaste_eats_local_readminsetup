const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Order = sequelize.define("Order", {
  order_id: { type: DataTypes.STRING, allowNull: true },
  cf_order_id: { type: DataTypes.STRING },
  payment_session_id: { type: DataTypes.STRING },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  restaurant_id: { type: DataTypes.STRING, allowNull: false }, // JSON string for multiple restaurants
  product_id: { type: DataTypes.STRING, allowNull: true }, 
	product_variant_id: { type: DataTypes.STRING, allowNull: true }, 
  product_quantity: { type: DataTypes.STRING, allowNull: true }, 
  amount: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  paymode: { type: DataTypes.ENUM("cod", "online"), allowNull: false },
  currency: { type: DataTypes.STRING, defaultValue: "INR" },
  order_status: { type: DataTypes.ENUM("PENDING", "ON THE WAY","DELIVERED"), allowNull: false, defaultValue: "PENDING" },
  payment_status: { type: DataTypes.ENUM("PENDING", "SUCCESS","REJECT"), allowNull: false, defaultValue: "PENDING" },
  charges: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  coupon_discount_amount: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  address_id: { type: DataTypes.STRING, allowNull: true },
  current_address: {type: DataTypes.STRING,allowNull: true },
 delivery_pin: { type: DataTypes.STRING, allowNull: true,},
  latitude: {type: DataTypes.FLOAT,allowNull: true},
  longitude: {type: DataTypes.FLOAT,allowNull: true},
	gst: {type: DataTypes.FLOAT,allowNull: true},
	delivery_charges: {type: DataTypes.FLOAT,allowNull: true},
	is_cod_paid: {type: DataTypes.TINYINT,defaultValue: 0,},
	delivery_boy_id: {type: DataTypes.INTEGER,allowNull: true,}
}, {
  tableName: "orders",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Order;
