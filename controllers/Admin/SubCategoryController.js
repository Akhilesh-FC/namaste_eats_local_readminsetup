const sequelize = require("../../config/db");
const path = require("path");
const multer = require("multer");

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/subcategories");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });
exports.upload = (req, res, next) => upload.single("image")(req, res, next);
exports.uploadMiddleware = (req, res, next) => upload.single("image")(req, res, next);

// List + Pagination
exports.subCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const categories = await sequelize.query(
      `SELECT id, name FROM categories WHERE status = 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const totalCountResult = await sequelize.query(
      `SELECT COUNT(*) as count FROM sub_categories`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const totalCount = totalCountResult[0].count;
    const totalPages = Math.ceil(totalCount / limit);

    const subCategories = await sequelize.query(
      `SELECT s.id, s.category_id, c.name AS category_name, s.name, s.description, s.icon, s.image,  s.status, s.created_at, s.updated_at
       FROM sub_categories s
       LEFT JOIN categories c ON s.category_id = c.id
       ORDER BY s.id DESC
       LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: sequelize.QueryTypes.SELECT }
    );

    if (req.xhr) {
      return res.json({ subCategories, totalPages, currentPage: page });
    }

    res.render("subcategories/index", {
      title: "Sub Categories",
      categories,
      subCategories,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Create subcategory
exports.createSubCategory = async (req, res) => {
  try {
    const { category_id, name, description, status } = req.body;

    if (!req.file) {
      return res.status(400).send("Image is required");
    }

    const image = `https://root.namasteats.com/uploads/subcategories/${req.file.filename}`;

    await sequelize.query(
      `INSERT INTO sub_categories (category_id, name, description,  status, image, created_at, updated_at)
       VALUES (:category_id, :name, :description,  :status, :image, NOW(), NOW())`,
      { replacements: { category_id, name, description,  status, image }, type: sequelize.QueryTypes.INSERT }
    );

    res.redirect("/subcategories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};



// Get single subcategory
exports.getSubCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sequelize.query(
      `SELECT * FROM sub_categories WHERE id = :id LIMIT 1`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if(result.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update subcategory
exports.updateSubCategory = async (req, res) => {
  const { id } = req.params;
  const { category_id, name, description, status } = req.body;

  try {
    let sql = `UPDATE sub_categories SET category_id=:category_id, name=:name, description=:description, status=:status, updated_at=NOW()`;
    const replacements = { category_id, name, description, status, id };

    if (req.file) {
      const imageUrl = `https://root.namasteats.com/uploads/subcategories/${req.file.filename}`;
      sql += `, image=:image`;
      replacements.image = imageUrl;
    }

    sql += ` WHERE id=:id`;
    await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.UPDATE });
    res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete subcategory
exports.deleteSubCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const [subcat] = await sequelize.query(
      `SELECT image FROM sub_categories WHERE id=:id LIMIT 1`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    await sequelize.query(
      `DELETE FROM sub_categories WHERE id=:id`,
      { replacements: { id }, type: sequelize.QueryTypes.DELETE }
    );

    // Delete image file from folder
    if (subcat?.image) {
      try {
        const urlPath = new URL(subcat.image).pathname; // e.g. /uploads/subcategories/xyz.png
        const filePath = path.join(__dirname, "../../public", urlPath);
        if (require("fs").existsSync(filePath)) require("fs").unlinkSync(filePath);
      } catch (_) {}
    }

    res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};



// ✅ Toggle Subcategory Status
exports.toggleSubCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [subcategory] = await sequelize.query(
      "SELECT status FROM sub_categories WHERE id = :id",
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    if (!subcategory) {
      return res.status(404).json({ success: false, message: "Subcategory not found" });
    }

    const newStatus = subcategory.status == 1 ? 0 : 1;

    await sequelize.query(
      "UPDATE sub_categories SET status = :status, updated_at = NOW() WHERE id = :id",
      { replacements: { id, status: newStatus }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({
      success: true,
      newStatus,
      message: `Subcategory ${newStatus ? "activated" : "deactivated"} successfully.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};