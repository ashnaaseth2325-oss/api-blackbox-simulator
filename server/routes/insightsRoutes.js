const express = require("express");
const { getInsights } = require("../controllers/insightsController");

const router = express.Router();

router.get("/", getInsights);

module.exports = router;
