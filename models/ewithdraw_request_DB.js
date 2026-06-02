// models/ewithdraw_request_DB.js
module.exports = (sequelize, DataTypes) => {
  const ewithdraw_request_DB = sequelize.define(
    "ewithdraw_request_DB",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      delivery_boy_id: { type: DataTypes.INTEGER, allowNull: false },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      status: {
        type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
        defaultValue: "PENDING",
      },
      requested_by: { type: DataTypes.STRING(100), allowNull: true },
      admin_note: { type: DataTypes.TEXT, allowNull: true },
      processed_by: { type: DataTypes.STRING(100), allowNull: true },
      transaction_id: { type: DataTypes.STRING(150), allowNull: true },
      requested_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      processed_at: { type: DataTypes.DATE, allowNull: true },
      wallet_snapshot_before: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      wallet_snapshot_after: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    },
    {
      tableName: "ewithdraw_request_DB",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return ewithdraw_request_DB;
};
