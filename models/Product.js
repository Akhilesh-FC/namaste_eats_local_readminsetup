// models/Product.js
module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define("Product", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    category_id: { type: DataTypes.INTEGER, allowNull: false },
	sub_category_id: { type: DataTypes.INTEGER, allowNull: false },
    restaurant_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
	veg_type: { type: DataTypes.ENUM('veg', 'non-veg'), allowNull: false },
    thumbnail_image: { type: DataTypes.STRING },
    status: { type: DataTypes.TINYINT, defaultValue: 1 },
  }, 
	{
    tableName: "products",
    timestamps: true,
	createdAt: "created_at",    
 	updatedAt: "updated_at",     
  });
	
	  Product.associate = (models) => {
    Product.hasMany(models.ProductVariant, { as: "variants", foreignKey: "product_id" });
  };

  return Product;
};
