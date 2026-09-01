const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('src/modules', function(filePath) {
    if (filePath.endsWith('.schema.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content.replace(/z\.object\s*\(/g, 'z.strictObject(');
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Updated', filePath);
        }
    }
});
