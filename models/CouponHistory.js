import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const CouponHistory = sequelize.define(
  "CouponHistory",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    coupon_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    order_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    discount_amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      defaultValue: 0,
    },

    status: {
      type: DataTypes.ENUM("SUCCESS", "FAILED"),
      defaultValue: "SUCCESS",
    },

    remarks: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "coupon_histories",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default CouponHistory;
