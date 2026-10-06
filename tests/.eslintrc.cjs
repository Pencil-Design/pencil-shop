module.exports = {
  root: true,
  // These bridge tests use node:test, so do not enable Jest-specific rules.
  extends: ["@remix-run/eslint-config", "@remix-run/eslint-config/node", "prettier"],
};
