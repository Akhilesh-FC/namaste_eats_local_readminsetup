//const { DataTypes } = require("sequelize");
//const sequelize = require("../config/db"); // aapke DB config ka path


// models/AddonCharge.js
module.exports = (sequelize, DataTypes) => {
  const AddonCharge = sequelize.define("AddonCharge", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    base_delivery_charge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
	  admin_charge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
	 comment: "percenatge",
    },
    base_delivery_distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Base distance in KM",
    },
    addon_charge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Extra charge after base distance",
    },
    estimated_distance_per_km: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Estimated delivery time e.g. 3 min",
    },
    is_active: {
      type: DataTypes.TINYINT,
      defaultValue: 1,
      comment: "1 = Active, 0 = Inactive",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: "addon_charges",   // ✅ Table ka naam same rakhna
    timestamps: true,             // created_at, updated_at enable
    createdAt: "created_at",      // DB ke column se match karna
    updatedAt: "updated_at",
  });

  return AddonCharge;
};
