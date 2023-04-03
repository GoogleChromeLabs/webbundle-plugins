// This is just a CommonJS wrapper for the default export to not to introduce a
// breaking change on how WebBundlePlugin is imported.
// For context, see:
// https://github.com/evanw/esbuild/issues/532#issuecomment-1019392638
const { WebBundlePlugin } = require('./lib/index.cjs');
module.exports = WebBundlePlugin;
