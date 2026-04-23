const axios = require("axios");

const TIMEOUT_MS = 5000;
const PREVIEW_LIMIT = 1500;

const classifyError = (err) => {
  if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
    return { type: "timeout", message: `Request timed out after ${TIMEOUT_MS}ms` };
  }
  if (err.code === "ECONNREFUSED") {
    return { type: "network", message: "Connection refused — server unreachable" };
  }
  if (err.code === "ENOTFOUND") {
    return { type: "network", message: "Host not found — check the URL" };
  }
  if (err.code === "ERR_INVALID_URL") {
    return { type: "invalid_url", message: "Malformed URL" };
  }
  if (err.response?.status >= 500) {
    return { type: "server_error", message: err.message };
  }
  return { type: "unknown", message: err.message };
};

const buildPreview = (data) => {
  if (data === null || data === undefined) return null;
  const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return str.length > PREVIEW_LIMIT
    ? str.slice(0, PREVIEW_LIMIT) + "\n\n... [truncated]"
    : str;
};

const executeRequest = async (method, url, data, headers) => {
  const start = Date.now();
  try {
    const config = {
      method,
      url,
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      timeout: TIMEOUT_MS,
      validateStatus: () => true, // never throw on HTTP error status
    };

    if (["POST", "PUT"].includes(method) && data !== undefined) {
      config.data = data;
    }

    const response = await axios(config);
    const responseTime = Date.now() - start;

    let responseBody;
    try {
      responseBody =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;
    } catch {
      responseBody = response.data;
    }

    const responseSize = JSON.stringify(response.data ?? "").length;

    // Normalise headers to plain object (axios can return special header objects)
    const responseHeaders = Object.fromEntries(
      Object.entries(response.headers || {}).map(([k, v]) => [k, String(v)])
    );

    return {
      success: true,
      statusCode: response.status,
      responseTime,
      responseSize,
      data: responseBody,
      dataPreview: buildPreview(responseBody),
      responseHeaders,
      errorType: null,
      error: null,
    };
  } catch (err) {
    const responseTime = Date.now() - start;
    const { type, message } = classifyError(err);
    return {
      success: false,
      statusCode: null,
      responseTime,
      responseSize: 0,
      data: null,
      dataPreview: null,
      responseHeaders: {},
      errorType: type,
      error: message,
    };
  }
};

module.exports = { executeRequest, TIMEOUT_MS };
