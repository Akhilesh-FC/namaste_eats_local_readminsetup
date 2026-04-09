module.exports = (sequelize, DataTypes) => {
  const ProductMedia = sequelize.define(
    "ProductMedia",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("image", "video"), // ✅ column name "type"
        allowNull: false,
        defaultValue: "image",
      },
      file_url: {
        type: DataTypes.STRING, // ✅ column name "file_url"
        allowNull: false,
      },
    },
    {
      tableName: "product_media",
      timestamps: true, // ✅ created_at / updated_at handle karega
     createdAt: "created_at",     // Laravel ka column name
 	updatedAt: "updated_at",  
    }
  );

  return ProductMedia;
};
