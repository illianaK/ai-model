const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Define targets for the exact models you want inside the native APK
const MODELS = [
    {
        name: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
        url: 'https://huggingface.co'
    },
    {
        name: 'llama-3.2-3b-instruct-q4_k_m.gguf',
        url: 'https://huggingface.co'
    }
];

const assetsDir = path.join(__dirname, 'app', 'src', 'main', 'assets');

// Helper function to stream files natively over HTTPS directly into the source folders
function downloadModel(model) {
    const targetPath = path.join(assetsDir, model.name);
    
    if (fs.existsSync(targetPath)) {
        console.log(`✅ ${model.name} already exists in assets. Skipping download.`);
        return Promise.resolve();
    }

    console.log(`📥 Downloading ${model.name} natively (this may take a few minutes)...`);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(targetPath);
        https.get(model.url, (response) => {
            // Handle HTTP 302 Redirects common on Hugging Face
            if (response.statusCode === 302 || response.statusCode === 301) {
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            }
        }).on('error', (err) => {
            fs.unlink(targetPath, () => {}); 
            reject(err);
        });
    });
}

async function runBuildPipeline() {
    try {
        // Ensure assets directory exists natively
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }

        // 1. Download model binaries into the package layout
        for (const model of MODELS) {
            await downloadModel(model);
        }

        console.log('🏗️ Both models packaged. Starting native Android compilation...');

        // 2. Execute the native Android Gradle system compiler 
        // Generates the production APK natively using local SDK tools
        const isWindows = process.platform === 'win32';
        const gradleCmd = isWindows ? 'gradlew.bat assembleRelease' : './gradlew assembleRelease';
        
        console.log(`Executing: ${gradleCmd}`);
        execSync(gradleCmd, { stdio: 'inherit' });

        console.log('🎉 Compilation complete! Find your offline read/write APK at:');
        console.log('./app/build/outputs/apk/release/app-release.apk');

    } catch (error) {
        console.error('❌ Build script failed:', error);
    }
}

runBuildPipeline();
