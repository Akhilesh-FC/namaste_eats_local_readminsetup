const sequelize = require("../../config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// ✅ Ensure upload folder exists
const uploadDir = path.join(__dirname, "../../public/uploads/category");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Multer setup for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

exports.upload = (req, res, next) => upload.single("image")(req, res, next);
exports.uploadMiddleware = (req, res, next) => upload.single("image")(req, res, next);

// ✅ List categories with pagination
exports.categories = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const offset = (page - 1) * limit;

    const [{ total }] = await sequelize.query(
      "SELECT COUNT(*) AS total FROM categories",
      { type: sequelize.QueryTypes.SELECT }
    );

    const categories = await sequelize.query(
      `SELECT id, name, description, icon, image, veg_type, status, created_at, updated_at
       FROM categories ORDER BY id DESC LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: sequelize.QueryTypes.SELECT }
    );

    const totalPages = Math.ceil(total / limit);
    res.render("categories/index", { title: "Categories", categories, page, totalPages });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// ✅ Create category (Full Image URL store)
exports.createCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    let imageUrl = null;

    // Agar image upload hui ho to full URL generate karo
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      imageUrl = `${baseUrl}/uploads/category/${req.file.filename}`;
    }

    const sql = `
      INSERT INTO categories (name, description,  status, image, created_at, updated_at)
      VALUES (:name, :description,  :status, :image, NOW(), NOW())
    `;
    await sequelize.query(sql, {
      replacements: { name, description, status, image: imageUrl },
      type: sequelize.QueryTypes.INSERT,
    });

    res.redirect("/categories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};



// ✅ Update category
exports.updateCategory = async (req, res) => {
  try {
    console.log('UPDATE BODY:', req.body);
    console.log('UPDATE FILE:', req.file);
    const { id, name, description, status } = req.body;
    let imageUrl = null;

    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      imageUrl = `${baseUrl}/uploads/category/${req.file.filename}`;
    }

    let sql = `UPDATE categories SET name=:name, description=:description, status=:status, updated_at=NOW()`;
    const replacements = { name, description, status, id };

    if (imageUrl) {
      sql += `, image=:image`;
      replacements.image = imageUrl;
    }

    sql += ` WHERE id=:id`;

    await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.UPDATE });
    console.log('UPDATE SUCCESS for id:', id);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Delete Category
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const [cat] = await sequelize.query(
      "SELECT image FROM categories WHERE id = :id LIMIT 1",
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    await sequelize.query(
      "DELETE FROM categories WHERE id = :id",
      { replacements: { id }, type: sequelize.QueryTypes.DELETE }
    );

    if (cat?.image) {
      try {
        const urlPath = new URL(cat.image).pathname;
        const filePath = path.join(__dirname, "../../public", urlPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Toggle Category Status
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current status
    const [category] = await sequelize.query(
      "SELECT status FROM categories WHERE id = :id",
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const newStatus = category.status == 1 ? 0 : 1;

    await sequelize.query(
      "UPDATE categories SET status = :status, updated_at = NOW() WHERE id = :id",
      { replacements: { id, status: newStatus }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({
      success: true,
      message: `Category ${newStatus == 1 ? "activated" : "deactivated"} successfully`,
      newStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};