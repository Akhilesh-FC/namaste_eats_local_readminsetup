module.exports = (req, res, next) => {
  if (req.session.admin && req.session.admin.id === 1) {
    return next();
  }

  req.session.error = "Please login to access dashboard.";
  return res.redirect("/admin/login");
};
