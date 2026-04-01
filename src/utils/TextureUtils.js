export const createNoiseTexture = (options = {}) => {
    const {
        width = 1024,
        height = 512,
        scale = 1,
        type = 'noise', // 'noise', 'banding', 'craters', 'earth', 'gas'
        color1 = '#ffffff',
        color2 = '#000000',
        detail = 50
    } = options;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Helper to hex to rgb
    const hexToRgb = (hex) => {
        const bigint = parseInt(hex.slice(1), 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);

    const idata = ctx.createImageData(width, height);
    const buffer = idata.data; // Uint8ClampedArray

    // Noise helpers
    const noise = (x, y, z = 0) => {
        return (Math.sin(x * scale) + Math.sin(y * scale) + Math.random()) / 3;
    };

    // Better Noise (Simplex-ish)
    // For performance we use simple trigonometric sums for "banding" and random for "noise"

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let n = 0;
            const normalizedY = y / height;
            const normalizedX = x / width;

            if (type === 'banding' || type === 'gas') {
                // Jupiter/Saturn Bands
                const phase = normalizedY * 10 * scale; // Number of bands
                // Add turbulence
                const turbulence = Math.sin(normalizedX * 10) * 0.05 + Math.sin(normalizedX * 20) * 0.02;
                n = (Math.sin(phase + turbulence * 5) + 1) / 2;

                // Add sub-noise
                n += (Math.random() - 0.5) * 0.1;
            } else if (type === 'craters') {
                // Base noise
                n = Math.random();
            } else if (type === 'earth') {
                // Continents (Perlin-ish threshold)
                // We simulate continents by combining low freq sine waves
                const nx = normalizedX * 5 * scale;
                const ny = normalizedY * 5 * scale;
                let val = Math.sin(nx) * Math.sin(ny)
                    + Math.sin(nx * 2 + 1) * Math.cos(ny * 2 + 2) * 0.5
                    + Math.sin(nx * 4) * 0.2;

                // Threshold for ocean vs land
                n = val > 0.2 ? 1 : 0; // 1 = Land, 0 = Ocean

                // Bluish ocean variation
                if (n === 0) n = 0.05 + Math.random() * 0.05;
                // Land variation
                if (n === 1) n = 0.8 + Math.random() * 0.2;
            } else {
                // Standard Noise
                n = Math.random();
            }

            // Clamp
            n = Math.max(0, Math.min(1, n));

            const idx = (y * width + x) * 4;
            buffer[idx] = c1[0] * n + c2[0] * (1 - n);     // R
            buffer[idx + 1] = c1[1] * n + c2[1] * (1 - n); // G
            buffer[idx + 2] = c1[2] * n + c2[2] * (1 - n); // B
            buffer[idx + 3] = 255; // Alpha
        }
    }

    ctx.putImageData(idata, 0, 0);

    // Context-based Overlays (Craters, Storms)
    if (type === 'craters') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let i = 0; i < detail; i++) {
            const cx = Math.random() * width;
            const cy = Math.random() * height;
            const r = Math.random() * 10 * scale;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (type === 'gas' && detail > 0) { // Storms (Red Spot)
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(200, 50, 50, 0.4)'; // Reddish

        const cx = width * 0.7;
        const cy = height * 0.6;
        const rx = 100 * scale;
        const ry = 50 * scale;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.filter = 'blur(10px)';
        ctx.fill();
        ctx.filter = 'none';
    }

    // Blur for smoothness (except rocky)
    if (type !== 'craters' && type !== 'earth') {
        // Simple distinct blur?
        // Canvas filter is easier but support varies in headless. 
        // We assume browser environment.
        // ctx.filter = 'blur(2px)';
        // ctx.drawImage(canvas, 0, 0); 
    }

    return canvas;
};
