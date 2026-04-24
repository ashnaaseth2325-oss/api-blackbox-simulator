const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const testRoutes = require("./routes/testRoutes");
const historyRoutes = require("./routes/historyRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const insightsRoutes = require("./routes/insightsRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

connectDB();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.use("/test-api", testRoutes);
app.use("/history", historyRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/insights", insightsRoutes);

app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
