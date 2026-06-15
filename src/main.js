import './styles/main.scss';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import LockerScene from './components/LockerScene';
import SolarSystem from './components/SolarSystem'; // Switched from WorldScene
import { getStarTexture } from './utils/StarTexture';
import SpaceAmbientSynth from './utils/AudioSynth';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Initialize App
class App {
    constructor() {
        this.synth = new SpaceAmbientSynth();
        this.init();
    }

    init() {
        console.log('App Initializing...');

        // 1. Setup Lenis (Smooth Scroll)
        this.initLenis();

        // 2. Setup Three.js Scene
        this.initThree();

        // 3. Setup Events
        this.addEventListeners();

        // 4. Start Animation Loop
        this.tick();
    }

    initLenis() {
        this.lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            mouseMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
        });

        // Keep GSAP ScrollTrigger in sync with Lenis smooth scroll
        this.lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.lagSmoothing(0);

        // Stop scrolling during intro
        this.lenis.stop();
    }

    initThree() {
        this.canvas = document.querySelector('#gl');
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true // Allow CSS background to show through if scene is transparent
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505); // Start Dark

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000); // Increased far plane for space
        this.camera.position.z = 10;

        this.clock = new THREE.Clock();

        // GLOBAL STARS (Always Visible)
        this.createStars();

        // Initialize Scenes
        this.lockerScene = new LockerScene(this.scene, this.camera, this.renderer);

        // Initialize SolarSystem (Hidden initially)
        this.solarSystem = new SolarSystem(this.scene, this.camera);

        window.addEventListener('resize', this.onResize.bind(this));
    }

    createStars() {
        const starsGeo = new THREE.BufferGeometry();
        const count = 5000;
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // Full volume distribution for global background
            const r = 1000 * Math.cbrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);

            // Natural size variation
            sizes[i] = Math.random() * 2.0;
        }

        starsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        starsGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Use the generated soft texture
        const texture = getStarTexture();

        const starsMat = new THREE.PointsMaterial({
            color: 0xffffff,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8,
            map: texture,
            alphaTest: 0.01,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const starMesh = new THREE.Points(starsGeo, starsMat);
        this.scene.add(starMesh);
    }

    onIntroComplete() {
        // Enable Scrolling
        this.lenis.start();

        // Play space ambient music on click (user interaction has happened)
        if (this.synth && !this.synth.isPlaying) {
            this.synth.play();
            const soundToggle = document.getElementById('sound-toggle');
            if (soundToggle) {
                soundToggle.classList.remove('sound-muted');
                soundToggle.querySelector('.sound-text').textContent = 'SOUND ON';
            }
        }

        // Reveal Main Content Immediately
        const content = document.getElementById('content');
        if (content) {
            content.classList.remove('content-hidden');
            content.classList.add('content-visible');
        }

        // Enable Solar System Updates (Planets) but NO Camera Reset
        if (this.solarSystem) {
            this.solarSystem.visible = true;
            this.solarSystem.group.visible = true;
        }
    }

    addEventListeners() {
        // Intro Complete Event
        window.addEventListener('intro-complete', () => {
            this.onIntroComplete();
        });

        // Ambient Audio Controller Binding
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => {
                if (this.synth) {
                    if (this.synth.isPlaying) {
                        this.synth.pause();
                        soundToggle.classList.add('sound-muted');
                        soundToggle.querySelector('.sound-text').textContent = 'SOUND OFF';
                    } else {
                        this.synth.play();
                        soundToggle.classList.remove('sound-muted');
                        soundToggle.querySelector('.sound-text').textContent = 'SOUND ON';
                    }
                }
            });
        }

        // Cursor glow: track mouse position as CSS custom props
        window.addEventListener('pointermove', (e) => {
            document.documentElement.style.setProperty('--cursor-x', e.clientX + 'px');
            document.documentElement.style.setProperty('--cursor-y', e.clientY + 'px');
        });

        // Contact Form Event
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', this.onContactSubmit.bind(this));
        }

        // Initialize Tilt Effects for Cards
        // Initialize Tilt Effects for Cards
        import('./utils/TiltEffect.js').then(({ default: TiltEffect }) => {
            // General Cards
            document.querySelectorAll('.tilt-card:not(.profile-container)').forEach(card => {
                new TiltEffect(card, {
                    maxTilt: 10,
                    perspective: 1500,
                    scale: 1.02,
                    speed: 1200
                });
            });

            // Profile Photo (3D Interactive Card)
            const profile = document.querySelector('.profile-container');
            if (profile) {
                new TiltEffect(profile, {
                    maxTilt: 10,         // Subtle "Card" tilt (was 25)
                    perspective: 1200,   // Flatter/Realistic perspective
                    scale: 1.05,         // Gentle lift
                    speed: 1000,         // Apple standard speed
                    easing: "cubic-bezier(0.03, 0.98, 0.52, 0.99)" // Physical object damping
                });
            }
        });
    }

    async onContactSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'Sending...';
        btn.disabled = true;

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                btn.innerText = 'Message Sent!';
                btn.style.backgroundColor = '#00ff00';
                btn.style.color = '#000';
                e.target.reset();
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.backgroundColor = '';
                    btn.style.color = '';
                    btn.disabled = false;
                }, 3000);
            } else {
                throw new Error('Failed to send');
            }
        } catch (error) {
            console.error(error);
            btn.innerText = 'Error. Try again.';
            btn.style.backgroundColor = '#ff0000';
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.backgroundColor = '';
                btn.disabled = false;
            }, 3000);
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    _updatePlanetIndicator() {
        if (!this.solarSystem) return;
        const indicator = document.getElementById('planet-indicator');
        if (!indicator) return;

        const camZ = this.camera.position.z;
        let nearest = null;
        let minDist = Infinity;

        this.solarSystem.planets.forEach(p => {
            // Planet world Z = group.position.z + planetGroup.position.z
            const pWorldZ = this.solarSystem.group.position.z + p.zPos;
            const dist = Math.abs(camZ - pWorldZ);
            if (dist < minDist) { minDist = dist; nearest = p; }
        });

        if (nearest && minDist < 60) {
            indicator.querySelector('.planet-name').textContent = `⬤ Approaching ${nearest.name}`;
            indicator.classList.add('visible');
        } else {
            indicator.classList.remove('visible');
        }
    }

    tick(time) {
        if (this.lenis) this.lenis.raf(time);

        const elapsedTime = this.clock.getElapsedTime();

        if (this.lockerScene && this.lockerScene.isOpen === false) {
            // Intro phase — animate the ENTER button scene
            if (this.lockerScene.update) {
                this.lockerScene.update(elapsedTime);
            }
        } else if (this.solarSystem && this.solarSystem.visible) {
            // Update Solar System
            const scroll    = this.lenis ? this.lenis.animatedScroll : 0;
            const maxScroll = this.lenis ? document.body.scrollHeight - window.innerHeight : 1;

            this.solarSystem.update(elapsedTime, scroll, maxScroll);

            // Planet proximity indicator
            this._updatePlanetIndicator();

            // Dynamic Content Reveal Logic
            if (scroll > 100) {
                const content = document.getElementById('content');
                if (content && !content.classList.contains('content-visible')) {
                    content.classList.remove('content-hidden');
                    content.classList.add('content-visible');
                }
            }
        }

        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(this.tick.bind(this));
    }
}

new App();
