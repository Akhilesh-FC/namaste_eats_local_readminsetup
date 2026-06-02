module.exports = (sequelize, DataTypes) => {
	//console.log('sequelize',sequelize)
  const Category = sequelize.define("Category", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    icon: DataTypes.STRING,
    image: DataTypes.STRING,
    veg_type: DataTypes.STRING,
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1,
    },
  }, {
    tableName: "categories",
    timestamps: true,
    createdAt: "created_at",   // Laravel column
    updatedAt: "updated_at",   // Laravel column
  });
	
	
	// ✅ Define association here
  Category.associate = (models) => {
    Category.hasMany(models.SubCategory, {
      foreignKey: "category_id",
      as: "subcategories",
    });
  };
	////end association
	

  return Category;
};
