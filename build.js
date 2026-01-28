const fs = require('fs-extra');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('html-minifier-terser');
const csso = require('csso');
const { glob } = require('glob');

const distDir = path.join(__dirname, 'dist');

async function build() {
    console.log('🚀 Starting Production Build...');

    // 1. Clean dist directory
    await fs.emptyDir(distDir);
    console.log('🧹 Cleaned dist/ directory.');

    // 2. Process JS Files (Obfuscation)
    const jsFiles = await glob('js/**/*.js');
    for (const file of jsFiles) {
        const content = await fs.readFile(file, 'utf8');
        console.log(`🔒 Obfuscating: ${file}`);

        const obfuscationResult = JavaScriptObfuscator.obfuscate(content, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            numbersToExpressions: true,
            simplify: true,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.75,
            splitStrings: true,
            unicodeEscapeSequence: false,
            renameGlobals: false,
            selfDefending: true,
            debugProtection: true,
            debugProtectionInterval: 4000
        });

        const targetPath = path.join(distDir, file);
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, obfuscationResult.getObfuscatedCode());
    }

    // 3. Process CSS Files (Minification)
    const cssFiles = await glob('css/**/*.css');
    for (const file of cssFiles) {
        const content = await fs.readFile(file, 'utf8');
        console.log(`🎨 Minifying CSS: ${file}`);
        const minifiedCss = csso.minify(content).css;

        const targetPath = path.join(distDir, file);
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, minifiedCss);
    }

    // 4. Process HTML Files (Minification)
    const htmlFiles = await glob('*.html');
    for (const file of htmlFiles) {
        let content = await fs.readFile(file, 'utf8');
        console.log(`🌐 Minifying HTML: ${file}`);

        // Inject cosmetic protection script before minifying
        const protectionScript = `
        <script>
            // Cosmetic Protection
            document.addEventListener('contextmenu', event => event.preventDefault());
            console.log('%c STOP! ', 'color: red; font-size: 40px; font-weight: bold; text-shadow: 2px 2px black;');
            console.log('%cThis is a browser feature intended for developers. If someone told you to copy-paste something here to enable a feature, it is a scam.', 'font-size: 16px;');
        </script>
        `;
        content = content.replace('</body>', `${protectionScript}</body>`);

        const minifiedHtml = await minify(content, {
            removeAttributeQuotes: true,
            collapseWhitespace: true,
            removeComments: true,
            minifyJS: true,
            minifyCSS: true
        });

        const targetPath = path.join(distDir, file);
        await fs.writeFile(targetPath, minifiedHtml);
    }

    // 5. Copy README/License if needed (Optional)
    // await fs.copy('README.md', path.join(distDir, 'README.md'));

    console.log('✅ Build Complete! Production assets are in dist/');
}

build().catch(err => {
    console.error('❌ Build Failed:', err);
    process.exit(1);
});
