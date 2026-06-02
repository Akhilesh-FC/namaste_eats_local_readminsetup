// models/UnitType.js
module.exports = (sequelize, DataTypes) => {
  const UnitType = sequelize.define("UnitType", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,   // e.g. Kilogram, Litre, Gram, Piece
      allowNull: false,
    },
    short_code: {
      type: DataTypes.STRING,   // e.g. kg, l, g, ml, pc
      allowNull: false,
    },
  }, {
    tableName: "unit_types",
    timestamps: false,   // इस table में created_at, updated_at की जरूरत नहीं है
	createdAt: "created_at",
    updatedAt: "updated_at",
  });

  return UnitType;
};
