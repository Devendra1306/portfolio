import * as THREE from 'three';

/**
 * Generates a realistic soft star texture using an HTML5 Canvas.
 * Creates a radial gradient from white (center) to transparent (edges).
 * This avoids loading external images and provides a clean, soft look.
 */
export function getStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;

    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );

    // Core: White, bright
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    // Mid: Soft glow
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    // Edge: Fade to transparent
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color output
    return texture;
}
