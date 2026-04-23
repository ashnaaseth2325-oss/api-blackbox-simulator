const express = require("express");
const { runTests } = require("../controllers/testController");

const router = express.Router();

router.post("/", runTests);

module.exports = router;
