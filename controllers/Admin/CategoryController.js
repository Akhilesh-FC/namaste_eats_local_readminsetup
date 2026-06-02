const sequelize = require("../../config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sharp = require("sharp");

const uploadDir = path.join(__dirname, "../../public/uploads/category");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const _multer = multer({ storage: multer.memoryStorage() });

const convertToWebp = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const filename = Date.now() + ".webp";
    const outPath = path.join(uploadDir, filename);
    await sharp(req.file.buffer).webp({ quality: 80 }).toFile(outPath);
    req.file.filename = filename;
    req.file.path = outPath;
    next();
  } catch (e) { next(e); }
};

exports.upload = [_multer.single("image"), convertToWebp];
exports.uploadMiddleware = [_multer.single("image"), convertToWebp];

// List categories with pagination
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

    res.render("categories/index", { title: "Categories", categories, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Create category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    let imageUrl = null;

    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      imageUrl = `${baseUrl}/uploads/category/${req.file.filename}`;
    }

    await sequelize.query(
      `INSERT INTO categories (name, description, status, image, created_at, updated_at) VALUES (:name, :description, :status, :image, NOW(), NOW())`,
      { replacements: { name, description, status, image: imageUrl }, type: sequelize.QueryTypes.INSERT }
    );

    res.redirect("/categories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
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
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete Category
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

// Toggle Category Status
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [category] = await sequelize.query(
      "SELECT status FROM categories WHERE id = :id",
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    const newStatus = category.status == 1 ? 0 : 1;
    await sequelize.query(
      "UPDATE categories SET status = :status, updated_at = NOW() WHERE id = :id",
      { replacements: { id, status: newStatus }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({ success: true, message: `Category ${newStatus == 1 ? "activated" : "deactivated"} successfully`, newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
