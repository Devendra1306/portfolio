import * as THREE from 'three';
import gsap from 'gsap';

export default class LockerScene {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.isOpen = false;
        this.isHovering = false;

        // Group to hold intro elements
        this.lockerGroup = new THREE.Group();
        this.scene.add(this.lockerGroup);

        this.init();
        this.addEventListeners();
    }

    init() {
        // 1. "ENTER" Text Label (Floating in Space)
        this.createOpenLabel();

        // Position Group
        this.lockerGroup.position.set(0, 0, 0);

        // Add Lights (Persisted for potential scene ambiance, though originally for ship)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(this.ambientLight);

        this.pointLight = new THREE.PointLight(0xffffff, 1);
        this.pointLight.position.set(5, 5, 5);
        this.scene.add(this.pointLight);
    }

    createOpenLabel() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 256;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = '900 100px "Arial", sans-serif';
        context.shadowColor = "rgba(0, 255, 255, 0.9)";
        context.shadowBlur = 30;
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('ENTER', canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const labelGeo = new THREE.PlaneGeometry(3.0, 1.5); // Big Hitbox
        const labelMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthTest: false // Ensure it renders on top if needed, but in space it's fine
        });

        this.openLabel = new THREE.Mesh(labelGeo, labelMat);
        this.openLabel.position.set(0, 0, 0); // Center
        this.lockerGroup.add(this.openLabel);
        this.openLabel.userData = { isInteractable: true };

        // Pulse Animation
        gsap.to(this.openLabel.scale, {
            x: 1.05, y: 1.05,
            duration: 2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut"
        });
    }

    addEventListeners() {
        window.addEventListener('pointermove', this.onPointerMove.bind(this));
        window.addEventListener('click', this.onClick.bind(this));
        window.forceOpenLocker = () => this.openLocker();
    }

    onPointerMove(event) {
        if (this.isOpen) return;

        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

        this.checkIntersection();
    }

    checkIntersection() {
        if (!this.openLabel) return;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects([this.openLabel]);

        if (intersects.length > 0) {
            document.body.style.cursor = 'pointer';
            this.isHovering = true;
            gsap.to(this.openLabel.scale, { x: 1.15, y: 1.15, duration: 0.3, overwrite: 'auto' });

            // Optional: Add glow or color shift on hover if desired, but sticking to existing logic
            // The user said "Keep: Hover animations"
        } else {
            document.body.style.cursor = 'default';
            this.isHovering = false;
            gsap.to(this.openLabel.scale, { x: 1.05, y: 1.05, duration: 0.3, overwrite: 'auto' });
        }
    }

    onClick() {
        if (this.isHovering && !this.isOpen) {
            this.openLocker();
        }
    }

    openLocker() {
        this.isOpen = true;
        document.body.style.cursor = 'default';
        console.log('Opening Portfolio...');

        // Fade out Label and transition
        gsap.to(this.openLabel.scale, { x: 0.1, y: 0.1, duration: 0.5 });
        gsap.to(this.openLabel.material, {
            opacity: 0,
            duration: 0.5,
            onComplete: () => {
                this.onSequenceComplete();
            }
        });
    }

    onSequenceComplete() {
        console.log("Intro Complete.");
        const event = new CustomEvent('intro-complete');
        window.dispatchEvent(event);
    }
}
