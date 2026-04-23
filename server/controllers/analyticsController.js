const analyticsService = require("../services/analyticsService");

const getAnalytics = async (req, res) => {
  try {
    const [stats, perEndpoint, trend] = await Promise.all([
      analyticsService.getGlobalStats(),
      analyticsService.getPerEndpointStats(),
      analyticsService.getTrendData(),
    ]);

    if (!stats) {
      return res.json({
        success: true,
        data: {
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          successRate: "0.0",
          perEndpoint: [],
          trend: [],
        },
      });
    }

    return res.json({
      success: true,
      data: {
        totalTests: stats.totalTests,
        passedTests: stats.passedTests,
        failedTests: stats.failedTests,
        avgResponseTime: Math.round(stats.avgResponseTime || 0),
        minResponseTime: stats.minResponseTime || 0,
        maxResponseTime: stats.maxResponseTime || 0,
        successRate: ((stats.passedTests / stats.totalTests) * 100).toFixed(1),
        perEndpoint,
        trend,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to compute analytics",
      details: err.message,
    });
  }
};

module.exports = { getAnalytics };
