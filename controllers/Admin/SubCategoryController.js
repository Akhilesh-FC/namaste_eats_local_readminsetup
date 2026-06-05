const sequelize = require("../../config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sharp = require("sharp");

const uploadDir = path.join(__dirname, "../../public/uploads/subcategories");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const BASE_URL = "https://root.namasteats.com";

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

// List + Pagination
exports.subCategories = async (req, res) => {
  try {
    const page   = parseInt(req.query.page) || 1;
    const limit  = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : "";

    const categories = await sequelize.query(
      `SELECT id, name FROM categories WHERE status = 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const where = search ? "WHERE s.name LIKE :s OR c.name LIKE :s" : "";
    const replacements = search ? { s: `%${search}%`, limit, offset } : { limit, offset };

    const totalCountResult = await sequelize.query(
      `SELECT COUNT(*) as count FROM sub_categories s LEFT JOIN categories c ON s.category_id = c.id ${where}`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );
    const totalPages = Math.ceil(totalCountResult[0].count / limit);

    const subCategories = await sequelize.query(
      `SELECT s.id, s.category_id, c.name AS category_name, s.name, s.description, s.icon, s.image, s.status, s.created_at, s.updated_at
       FROM sub_categories s
       LEFT JOIN categories c ON s.category_id = c.id
       ${where}
       ORDER BY s.id DESC LIMIT :limit OFFSET :offset`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    if (req.xhr) return res.json({ subCategories, totalPages, currentPage: page });

    res.render("subcategories/index", { title: "Sub Categories", categories, subCategories, totalPages, currentPage: page, search });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Create subcategory
exports.createSubCategory = async (req, res) => {
  try {
    const { category_id, name, description, status } = req.body;

    if (!req.file) return res.status(400).send("Image is required");

    const image = `${BASE_URL}/uploads/subcategories/${req.file.filename}`;

    await sequelize.query(
      `INSERT INTO sub_categories (category_id, name, description, status, image, created_at, updated_at) VALUES (:category_id, :name, :description, :status, :image, NOW(), NOW())`,
      { replacements: { category_id, name, description, status, image }, type: sequelize.QueryTypes.INSERT }
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
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result[0]);
  } catch (err) {
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
      sql += `, image=:image`;
      replacements.image = `${BASE_URL}/uploads/subcategories/${req.file.filename}`;
    }

    sql += ` WHERE id=:id`;
    await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.UPDATE });
    res.json({ success: true });
  } catch (err) {
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

    if (subcat?.image) {
      try {
        const urlPath = new URL(subcat.image).pathname;
        const filePath = path.join(__dirname, "../../public", urlPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Toggle Subcategory Status
exports.toggleSubCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const [subcategory] = await sequelize.query(
      "SELECT status FROM sub_categories WHERE id = :id",
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    if (!subcategory) return res.status(404).json({ success: false, message: "Subcategory not found" });

    const newStatus = subcategory.status == 1 ? 0 : 1;
    await sequelize.query(
      "UPDATE sub_categories SET status = :status, updated_at = NOW() WHERE id = :id",
      { replacements: { id, status: newStatus }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({ success: true, newStatus, message: `Subcategory ${newStatus ? "activated" : "deactivated"} successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
