const path = require('path');

module.exports = {
    entry: './src/index.js', // Entry point for your application
    output: {
        filename: 'content.js', // Output file name
        path: path.resolve(__dirname), // Output directory
    },
    mode: 'production', // Use 'development' for debugging
};
