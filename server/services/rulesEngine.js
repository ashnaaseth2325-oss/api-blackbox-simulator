/**
 * Rules Engine — validates an API response against a user-defined rule set.
 *
 * Supported rules:
 *   expectedStatus      {number}    HTTP status must exactly match
 *   maxResponseTime     {number}    response time in ms must be ≤ this
 *   mustContain         {string[]}  each string must appear in the JSON body
 *   mustNotContain      {string[]}  each string must NOT appear in the JSON body
 *   requiredHeaders     {string[]}  each header name must be in the response
 *   minResponseSize     {number}    body byte size must be ≥ this
 *   maxResponseSize     {number}    body byte size must be ≤ this
 */

const validate = (result, rules) => {
  if (!rules || typeof rules !== "object" || Object.keys(rules).length === 0) {
    return null;
  }

  const failures = [];
  const bodyStr = JSON.stringify(result.data ?? "");

  if (rules.expectedStatus !== undefined) {
    if (result.statusCode !== Number(rules.expectedStatus)) {
      failures.push(
        `Expected status ${rules.expectedStatus}, got ${result.statusCode ?? "none"}`
      );
    }
  }

  if (rules.maxResponseTime !== undefined) {
    if (result.responseTime > Number(rules.maxResponseTime)) {
      failures.push(
        `Response time ${result.responseTime}ms exceeded limit of ${rules.maxResponseTime}ms`
      );
    }
  }

  if (Array.isArray(rules.mustContain)) {
    for (const term of rules.mustContain) {
      if (!bodyStr.includes(String(term))) {
        failures.push(`Response body missing required value: "${term}"`);
      }
    }
  }

  if (Array.isArray(rules.mustNotContain)) {
    for (const term of rules.mustNotContain) {
      if (bodyStr.includes(String(term))) {
        failures.push(`Response body contains forbidden value: "${term}"`);
      }
    }
  }

  if (Array.isArray(rules.requiredHeaders)) {
    const responseHeaders = result.responseHeaders || {};
    for (const header of rules.requiredHeaders) {
      if (!responseHeaders[header.toLowerCase()]) {
        failures.push(`Missing required response header: "${header}"`);
      }
    }
  }

  if (rules.minResponseSize !== undefined) {
    if ((result.responseSize ?? 0) < Number(rules.minResponseSize)) {
      failures.push(
        `Response size ${result.responseSize}B is below minimum of ${rules.minResponseSize}B`
      );
    }
  }

  if (rules.maxResponseSize !== undefined) {
    if ((result.responseSize ?? 0) > Number(rules.maxResponseSize)) {
      failures.push(
        `Response size ${result.responseSize}B exceeds maximum of ${rules.maxResponseSize}B`
      );
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    rulesChecked: Object.keys(rules).length,
  };
};

module.exports = { validate };
