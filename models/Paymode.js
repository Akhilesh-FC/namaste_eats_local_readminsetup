const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // aapke DB config ka path

module.exports = (sequelize, DataTypes) => {
  const Paymode = sequelize.define(
    "Paymode",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      paymode_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      icon: {
        type: DataTypes.STRING,
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      }
    },
    {
      tableName: "paymodes",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  );

  return Paymode;
};
