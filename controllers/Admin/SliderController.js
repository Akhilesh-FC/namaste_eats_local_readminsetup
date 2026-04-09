const db = require("../../config/db");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/sliders"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage }).single("image");
exports.upload = upload;

// List with pagination + search
exports.index = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : "";

    const where = search ? `WHERE title LIKE '%${search.replace(/'/g,"''")}%' OR description LIKE '%${search.replace(/'/g,"''")}%'` : "";

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM sliders ${where}`);
    const totalPages = Math.ceil(total / limit);

    const [sliders] = await db.query(
      `SELECT * FROM sliders ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
    );

    res.render("sliders/index", { sliders, currentPage: page, totalPages, search });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Store
exports.store = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).send("Upload failed: " + err.message);
    const { title, description } = req.body;
    if (!title) return res.status(400).send("Title required");
    const image = req.file ? `/uploads/sliders/${req.file.filename}` : null;
    await db.query(
      `INSERT INTO sliders (title, description, image, status, created_at, updated_at) VALUES (?,?,?,'active',NOW(),NOW())`,
      [title, description, image]
    );
    res.redirect("/sliders");
  });
};

// Update (AJAX)
exports.update = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.json({ success: false, message: "Upload failed" });
    const { id, title, description } = req.body;
    try {
      if (req.file) {
        const image = `/uploads/sliders/${req.file.filename}`;
        await db.query(
          `UPDATE sliders SET title=?, description=?, image=?, updated_at=NOW() WHERE id=?`,
          [title, description, image, id]
        );
      } else {
        await db.query(
          `UPDATE sliders SET title=?, description=?, updated_at=NOW() WHERE id=?`,
          [title, description, id]
        );
      }
      res.json({ success: true });
    } catch (e) {
      res.json({ success: false, message: e.message });
    }
  });
};

// Toggle status (AJAX)
exports.toggleStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const [[slider]] = await db.query("SELECT status FROM sliders WHERE id=?", [id]);
    if (!slider) return res.json({ success: false });
    const newStatus = slider.status === "active" ? "inactive" : "active";
    await db.query("UPDATE sliders SET status=?, updated_at=NOW() WHERE id=?", [newStatus, id]);
    res.json({ success: true, newStatus });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

// Delete (AJAX)
exports.delete = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM sliders WHERE id=?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};
