// models/ProductVariant.js
module.exports = (sequelize, DataTypes) => {
  const ProductVariant = sequelize.define("ProductVariant", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
	  
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    unit_type_id: {
      type: DataTypes.INTEGER,   // FK → unit_types table
      allowNull: true,
    },
    quantity: {
      type: DataTypes.FLOAT,     // e.g. 1, 2, 500, 1000
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    is_available: {
      type: DataTypes.TINYINT, // 1 = available, 0 = not available
      defaultValue: 1,
    },
  }, {
    tableName: "product_variants",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  });

  return ProductVariant;
};
