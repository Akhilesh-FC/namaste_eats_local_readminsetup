module.exports = (sequelize, DataTypes) => {
  const SubCategory = sequelize.define("SubCategory", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    icon: {
      type: DataTypes.STRING,
    },
    image: {
      type: DataTypes.STRING,
    },
    veg_type: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1,
    },
  }, {
    tableName: "sub_categories",
    createdAt: "created_at",
  	updatedAt: "updated_at",
    underscored: true,
  });
	
	
	/////start association
	SubCategory.associate = (models) => {
  SubCategory.belongsTo(models.Category, {
    foreignKey: "category_id",
    as: "category",
  });
};
///////end
	

  return SubCategory;
};

