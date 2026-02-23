import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_DIR = path.join(__dirname, '..', 'models');
const MODEL_FILENAME = 'mistral-7b-instruct-v0.2.Q4_K_M.gguf';
const MODEL_URL = 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf?download=true';
const MODEL_PATH = path.join(MODEL_DIR, MODEL_FILENAME);

async function downloadModel() {
    if (!fs.existsSync(MODEL_DIR)) {
        fs.mkdirSync(MODEL_DIR, { recursive: true });
    }

    if (fs.existsSync(MODEL_PATH)) {
        console.log(`Model already exists at ${MODEL_PATH}`);
        const stats = fs.statSync(MODEL_PATH);
        console.log(`File size: ${(stats.size / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        return;
    }

    console.log(`Downloading Mistral-7B-Instruct-v0.2 Q4_K_M GGUF...`);
    console.log(`From: ${MODEL_URL}`);
    console.log(`To: ${MODEL_PATH}`);
    console.log(`This is a ~4.1GB file and may take a while depending on your internet connection.\n`);

    const file = fs.createWriteStream(MODEL_PATH);

    // Helper function to handle redirects
    function get(url) {
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                console.log(`Redirecting to: ${response.headers.location}`);
                get(response.headers.location);
                return;
            }

            if (response.statusCode !== 200) {
                console.error(`Failed to download model. Status Code: ${response.statusCode}`);
                file.close();
                fs.unlinkSync(MODEL_PATH); // Delete the empty/partial file
                return;
            }

            const totalBytes = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;
            let lastPercent = 0;

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                const percent = Math.round((downloadedBytes / totalBytes) * 100);

                if (percent > lastPercent) {
                    process.stdout.write(`\rProgress: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB)`);
                    lastPercent = percent;
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('\n\nDownload complete! The model is ready to use.');
            });

        }).on('error', (err) => {
            fs.unlinkSync(MODEL_PATH);
            console.error(`\nError downloading model: ${err.message}`);
        });
    }

    get(MODEL_URL);
}

downloadModel();
