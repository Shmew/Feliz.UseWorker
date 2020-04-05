const path = require("path");

module.exports = {
    allFiles: true,
    entry: path.join(__dirname, "App.fsproj"),
    outDir: path.join(__dirname, "../dist"),
};