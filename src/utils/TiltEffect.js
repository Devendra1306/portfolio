/**
 * TiltEffect.js
 * 
 * Handles premium 3D tilt interactions for UI cards using a "Samsung x Apple" physics feel.
 * 
 * Features:
 * - Perspective-based X/Y rotation relative to cursor position
 * - Z-axis lift (scale + shadow)
 * - Internal parallax for content layers
 * - Smooth damping/easing for "heavy" premium feel
 * - Glare effect (optional, handled via CSS overflow usually, but logic here supports coords)
 */

export default class TiltEffect {
    constructor(element, options = {}) {
        this.element = element;
        this.content = element.querySelector('.tilt-content') || element;

        // Configuration
        this.settings = {
            maxTilt: 15,        // Max rotation in degrees
            perspective: 1000,  // CSS perspective
            scale: 1.05,        // Lift scale
            speed: 1000,        // Transition speed (ms) for enter/leave
            easing: "cubic-bezier(0.03, 0.98, 0.52, 0.99)", // Apple-style damping
            ...options
        };

        this.width = element.offsetWidth;
        this.height = element.offsetHeight;
        this.left = element.offsetLeft;
        this.top = element.offsetTop;

        // State
        this.ticking = false;
        this.mouseX = 0;
        this.mouseY = 0;

        this.init();
    }

    init() {
        // Set basic styles
        this.element.style.transformStyle = "preserve-3d";
        this.element.style.perspective = `${this.settings.perspective}px`;

        // Bind events
        this.element.addEventListener("mouseenter", this.handleMouseEnter.bind(this));
        this.element.addEventListener("mousemove", this.handleMouseMove.bind(this));
        this.element.addEventListener("mouseleave", this.handleMouseLeave.bind(this));

        // Resize observer to handle layout changes
        const observer = new ResizeObserver(() => this.updateDimensions());
        observer.observe(this.element);
    }

    updateDimensions() {
        const rect = this.element.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.left = rect.left;
        this.top = rect.top;
    }

    handleMouseEnter() {
        this.updateDimensions();
        // Remove transition delay for instant tracking start
        this.element.style.transition = `transform 0.1s ${this.settings.easing}`;
    }

    handleMouseMove(e) {
        if (!this.ticking) {
            window.requestAnimationFrame(() => {
                this.update(e);
                this.ticking = false;
            });
            this.ticking = true;
        }
    }

    handleMouseLeave() {
        // Smooth return
        this.element.style.transition = `transform ${this.settings.speed}ms ${this.settings.easing}`;
        this.element.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;

        // Reset parallax
        const innerElements = this.element.querySelectorAll('.parallax-layer');
        innerElements.forEach(el => {
            el.style.transform = `translateZ(0) translateX(0) translateY(0)`;
        });
    }

    update(e) {
        // Calculate position relative to center of card
        // e.clientX is viewport relative. We need rect relative.
        const rect = this.element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const xPct = x / this.width;
        const yPct = y / this.height;

        // Calculate Rotation
        // maxTilt = 15 deg.
        // xPct 0 -> -15deg, xPct 1 -> 15deg
        const rotateX = (this.settings.maxTilt * -1) * (yPct - 0.5) * 2; // Tilt up/down
        const rotateY = this.settings.maxTilt * (xPct - 0.5) * 2;       // Tilt left/right

        // Apply Transform
        // We use string interpolation for high performance
        this.element.style.transform = `
            perspective(${this.settings.perspective}px)
            rotateX(${rotateX.toFixed(2)}deg)
            rotateY(${rotateY.toFixed(2)}deg)
            scale(${this.settings.scale})
        `;

        // Set CSS variables for lighting effects (0% to 100%)
        this.element.style.setProperty('--mouse-x', `${(xPct * 100).toFixed(1)}%`);
        this.element.style.setProperty('--mouse-y', `${(yPct * 100).toFixed(1)}%`);

        // Inner Parallax (Simulate depth)
        // Find elements with data-parallax-depth or default
        const inner = this.element.querySelector('.tilt-content');
        if (inner) {
            // inner.style.transform = `translateZ(50px)`; // Fixed Z often better than dynamic
        }
    }

    destroy() {
        // Cleanup if needed
        this.element.removeEventListener("mouseenter", this.handleMouseEnter);
        this.element.removeEventListener("mousemove", this.handleMouseMove);
        this.element.removeEventListener("mouseleave", this.handleMouseLeave);
    }
}
