const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Coupon = sequelize.define("Coupon", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  coupon_code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  discount_percentage: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: false
  },
  validity: {
    type: DataTypes.DATE,
    allowNull: false
  },
  min_availability: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },
  title_description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  type: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: "coupons",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Coupon;
