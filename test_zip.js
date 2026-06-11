const https = require('https');
const fs = require('fs');
const extract = require('extract-zip');
const path = require('path');

const url = 'https://github.com/dennyun/CobbleSaS/releases/download/v1.0.0/modpack.zip';
const dest = path.join(__dirname, 'modpack.zip');

https.get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
            const file = fs.createWriteStream(dest);
            res2.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    console.log('Downloaded. Extracting...');
                    extract(dest, { dir: path.join(__dirname, 'extracted') }).then(() => {
                        console.log('Extracted. Checking options.txt');
                        if (fs.existsSync(path.join(__dirname, 'extracted', 'options.txt'))) {
                            const content = fs.readFileSync(path.join(__dirname, 'extracted', 'options.txt'), 'utf8');
                            const lines = content.split('\n');
                            for (const line of lines) {
                                if (line.includes('resourcePacks')) {
                                    console.log(line);
                                }
                            }
                        } else {
                            console.log('options.txt NOT FOUND!');
                        }
                    });
                });
            });
        });
    }
});
