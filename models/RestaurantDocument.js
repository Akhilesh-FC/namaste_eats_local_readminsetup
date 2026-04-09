module.exports = (sequelize, DataTypes) => {
  const RestaurantDocument = sequelize.define(
    "RestaurantDocument",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      restaurant_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      pan: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      gst: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      bank_owner_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      ifsc_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      bank_account_number: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      fssai_certificate_number: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "restaurant_documents",
		timestamps: true,
     createdAt: "created_at",     // Laravel ka column name
  	updatedAt: "updated_at",     // Laravel ka column name
    }
  );

  return RestaurantDocument;
};
