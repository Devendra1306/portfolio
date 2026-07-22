import createGlobe from 'cobe';

export default class GlobeScene {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.phi = 1.8; // Start rotated toward India
        this.globe = null;
        this._init();

        // Pointer drag to rotate
        this._dragging = false;
        this._lastX = 0;
        this.canvas.addEventListener('pointerdown', (e) => {
            this._dragging = true;
            this._lastX = e.clientX;
        });
        window.addEventListener('pointerup', () => { this._dragging = false; });
        window.addEventListener('pointermove', (e) => {
            if (!this._dragging) return;
            const delta = e.clientX - this._lastX;
            this.phi += delta * 0.005;
            this._lastX = e.clientX;
        });

        window.addEventListener('resize', this._onResize.bind(this));
    }

    _getSize() {
        const parent = this.canvas.parentElement;
        const size = parent ? Math.min(parent.offsetWidth, 300) : 260;
        return Math.max(size, 200);
    }

    _init() {
        if (this.globe) {
            this.globe.destroy();
            this.globe = null;
        }

        const size = this._getSize();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.canvas.style.width = `${size}px`;
        this.canvas.style.height = `${size}px`;

        let phi = this.phi;
        this.globe = createGlobe(this.canvas, {
            devicePixelRatio: dpr,
            width: size * dpr,
            height: size * dpr,
            phi: phi,
            theta: 0.25,
            dark: 0.85,
            diffuse: 2.2,
            scale: 1.0,
            mapSamples: 16000,
            mapBrightness: 10,
            // Visible dark navy base
            baseColor: [0.1, 0.15, 0.4],
            // Bright galaxy blue glow
            glowColor: [0.0, 0.85, 1.0],
            // Gold markers
            markerColor: [0.97, 0.77, 0.31],
            markers: [
                // Eluru, Andhra Pradesh (home)
                { location: [16.71, 81.09], size: 0.07 },
                // Hyderabad (JNTUK region)
                { location: [17.38, 78.47], size: 0.05 },
            ],
            onRender: (state) => {
                if (!this._dragging) {
                    phi += 0.004;
                }
                state.phi = phi;
                this.phi = phi;
            },
        });
    }

    _onResize() {
        this._init();
    }

    destroy() {
        if (this.globe) {
            this.globe.destroy();
        }
        window.removeEventListener('resize', this._onResize.bind(this));
    }
}
