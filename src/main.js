import './styles/main.scss';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import LockerScene from './components/LockerScene';
import SolarSystem from './components/SolarSystem';
import GlobeScene from './components/GlobeScene';
import { getStarTexture } from './utils/StarTexture';
import spaceAudio from './utils/SpaceAudio.js';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Initialize App
class App {
    constructor() {
        this.init();
    }

    init() {
        console.log('App Initializing...');
        this.isMobile = window.innerWidth <= 768;
        this.mouseX = 0;
        this.mouseY = 0;

        // 1. Setup Lenis (Smooth Scroll)
        this.initLenis();

        // 2. Setup Three.js Scene
        this.initThree();

        // 3. Setup Events
        this.addEventListeners();

        // 3.5. Setup Spotlight Tracker
        this.initSpotlightTracking();

        // 4. Start Animation Loop
        this.tick();
    }

    initSpotlightTracking() {
        document.body.addEventListener('mousemove', (e) => {
            const card = e.target.closest('.tilt-card');
            if (card) {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mx', `${x}px`);
                card.style.setProperty('--my', `${y}px`);
            }
        });
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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
        const count = this.isMobile ? 1500 : 5000;
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

        // Reveal Main Content
        const content = document.getElementById('content');
        if (content) {
            content.classList.remove('content-hidden');
            content.classList.add('content-visible');
        }

        // Enable Solar System
        if (this.solarSystem) {
            this.solarSystem.visible = true;
            this.solarSystem.group.visible = true;
        }

        // Boot cinematic motion system
        this.initMotionSystem();
    }

    addEventListeners() {
        // Global mouse tracking for Intro Parallax
        if (!this.isMobile) {
            window.addEventListener('mousemove', (e) => {
                const x = (e.clientX / window.innerWidth) * 2 - 1;
                const y = -(e.clientY / window.innerHeight) * 2 + 1;
                this.mouseX = x;
                this.mouseY = y;
            });
        }

        // Intro Complete Event
        window.addEventListener('intro-complete', () => {
            this.onIntroComplete();
        });

        // Sound Toggle Event
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => {
                spaceAudio.toggle();
            });
        }

        // Contact Form Event
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', this.onContactSubmit.bind(this));
        }

        // Navigation Header Mobile Menu toggle
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const navLinksContainer = document.querySelector('.nav-links');

        if (mobileToggle && navLinksContainer) {
            mobileToggle.addEventListener('click', () => {
                mobileToggle.classList.toggle('active');
                navLinksContainer.classList.toggle('active');
            });

            // Close mobile menu when clicking a link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    mobileToggle.classList.remove('active');
                    navLinksContainer.classList.remove('active');
                });
            });
        }

        // Custom smooth scrolling handling for anchor links to work beautifully with Lenis
        document.querySelectorAll('.nav-link, .nav-logo').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = anchor.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    if (this.lenis) {
                        this.lenis.scrollTo(targetElement, { offset: 0, duration: 1.2 });
                    } else {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });

        // Initialize Tilt Effects for Cards
        if (!this.isMobile) {
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
                        maxTilt: 10,
                        perspective: 1200,
                        scale: 1.05,
                        speed: 1000,
                        easing: "cubic-bezier(0.03, 0.98, 0.52, 0.99)"
                    });
                }
            });
        }

        // Upgraded Magnetic Buttons using GSAP quickTo
        if (!this.isMobile) {
            const magnetics = document.querySelectorAll('[data-magnetic]');
            magnetics.forEach((elem) => {
                const xTo = gsap.quickTo(elem, 'x', { duration: 0.45, ease: 'power3.out' });
                const yTo = gsap.quickTo(elem, 'y', { duration: 0.45, ease: 'power3.out' });

                elem.addEventListener('pointermove', (e) => {
                    const rect = elem.getBoundingClientRect();
                    const x = (e.clientX - rect.left - rect.width / 2) * 0.28;
                    const y = (e.clientY - rect.top - rect.height / 2) * 0.28;
                    xTo(x);
                    yTo(y);
                });

                elem.addEventListener('pointerleave', () => {
                    xTo(0);
                    yTo(0);
                });
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CINEMATIC MOTION SYSTEM
    // ─────────────────────────────────────────────────────────────────
    initMotionSystem() {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Mark html for CSS visibility rules
        document.documentElement.classList.add('has-motion');

        // Wire Lenis → ScrollTrigger
        if (this.lenis) {
            this.lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => this.lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        }

        gsap.defaults({ ease: 'power3.out', duration: 0.85 });

        this._initTextReveals(reduceMotion);
        this._initScrollReveals(reduceMotion);
        this._initHorizontalCarousel(reduceMotion);
        this._initScrollTimeline(reduceMotion);
        this._initGlobe();

        window.addEventListener('load', () => ScrollTrigger.refresh());
        setTimeout(() => ScrollTrigger.refresh(), 600);
    }

    // Word-split text reveals
    _splitWords(element) {
        if (element.dataset.motionSplit === 'true') return;
        const text = element.textContent || '';
        const parts = text.split(/(\s+)/);
        element.textContent = '';
        element.setAttribute('aria-label', text.trim());
        let index = 0;
        parts.forEach((part) => {
            if (!part.trim()) { element.appendChild(document.createTextNode(part)); return; }
            const mask = document.createElement('span');
            const word = document.createElement('span');
            mask.className = 'motion-word-mask';
            mask.setAttribute('aria-hidden', 'true');
            word.className = 'motion-word';
            word.textContent = part;
            word.style.setProperty('--word-index', index);
            mask.appendChild(word);
            element.appendChild(mask);
            index += 1;
        });
        element.dataset.motionSplit = 'true';
    }

    _initTextReveals(reduceMotion) {
        if (reduceMotion) {
            gsap.set('[data-motion-text]', { autoAlpha: 1, clearProps: 'all' });
            return;
        }
        gsap.utils.toArray('[data-motion-text="words"]').forEach((el) => {
            this._splitWords(el);
            const words = el.querySelectorAll('.motion-word');
            gsap.set(el, { autoAlpha: 1 });
            gsap.fromTo(words,
                { yPercent: 110, autoAlpha: 0, filter: 'blur(6px)' },
                {
                    yPercent: 0, autoAlpha: 1, filter: 'blur(0px)',
                    duration: 0.9, ease: 'power4.out', stagger: 0.055,
                    scrollTrigger: { trigger: el, start: 'top 82%', once: true },
                }
            );
        });
    }

    _initScrollReveals(reduceMotion) {
        const presets = {
            'fade-up':    { from: { y: 32, autoAlpha: 0 },              to: { y: 0, autoAlpha: 1 } },
            'blur-in':    { from: { y: 18, autoAlpha: 0, filter: 'blur(10px)' }, to: { y: 0, autoAlpha: 1, filter: 'blur(0px)' } },
            'scale':      { from: { scale: 0.92, autoAlpha: 0 },         to: { scale: 1, autoAlpha: 1 } },
            'slide-left': { from: { x: 48, autoAlpha: 0 },              to: { x: 0, autoAlpha: 1 } },
        };

        if (reduceMotion) {
            gsap.set('[data-reveal], [data-reveal-item]', { autoAlpha: 1, clearProps: 'all' });
            return;
        }

        // Staggered reveal groups
        gsap.utils.toArray('[data-reveal-group]').forEach((group) => {
            const items = group.querySelectorAll('[data-reveal-item]');
            gsap.set(group, { autoAlpha: 1 });
            gsap.fromTo(items,
                { y: 36, autoAlpha: 0, filter: 'blur(8px)' },
                {
                    y: 0, autoAlpha: 1, filter: 'blur(0px)',
                    duration: 0.95, ease: 'power4.out', stagger: 0.075,
                    scrollTrigger: { trigger: group, start: 'top 82%', once: true },
                }
            );
        });

        // Individual reveals
        gsap.utils.toArray('[data-reveal]:not([data-reveal-item])').forEach((el) => {
            const preset = presets[el.dataset.reveal] || presets['fade-up'];
            gsap.set(el, { autoAlpha: 1 });
            gsap.fromTo(el, preset.from, {
                ...preset.to,
                duration: 0.9, ease: 'power4.out',
                delay: Number(el.dataset.revealDelay || 0),
                scrollTrigger: { trigger: el, start: 'top 84%', once: true },
            });
        });
    }

    _initHorizontalCarousel(reduceMotion) {
        const stage = document.getElementById('coverflow-stage');
        const cards = Array.from(document.querySelectorAll('.coverflow-card'));
        const prevBtn = document.getElementById('coverflow-prev');
        const nextBtn = document.getElementById('coverflow-next');
        const dotsContainer = document.getElementById('coverflow-dots');
        if (!stage || cards.length === 0) return;

        let activeIndex = 0;
        const total = cards.length;

        // Build Dots
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
            cards.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.className = `dot ${i === 0 ? 'active' : ''}`;
                dot.addEventListener('click', () => updateCoverflow(i));
                dotsContainer.appendChild(dot);
            });
        }

        const updateCoverflow = (newIndex) => {
            activeIndex = (newIndex + total) % total;
            const prevIndex = (activeIndex - 1 + total) % total;
            const nextIndex = (activeIndex + 1) % total;

            cards.forEach((card, i) => {
                card.classList.remove('active', 'prev-card', 'next-card');

                if (i === activeIndex) {
                    card.classList.add('active');
                } else if (i === prevIndex) {
                    card.classList.add('prev-card');
                } else if (i === nextIndex) {
                    card.classList.add('next-card');
                }
            });

            // Update Dots
            if (dotsContainer) {
                const dots = dotsContainer.querySelectorAll('.dot');
                dots.forEach((dot, i) => {
                    dot.classList.toggle('active', i === activeIndex);
                });
            }
        };

        // Attach Card Click Events for direct selection
        cards.forEach((card, i) => {
            card.addEventListener('click', (e) => {
                // If clicking link inside, allow navigation
                if (e.target.closest('a')) return;
                if (i !== activeIndex) {
                    updateCoverflow(i);
                }
            });
        });

        // Prev / Next Buttons
        if (prevBtn) prevBtn.addEventListener('click', () => updateCoverflow(activeIndex - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => updateCoverflow(activeIndex + 1));

        // Touch Swipe Gesture Handling
        let touchStartX = 0;
        stage.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        stage.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchStartX - touchEndX;
            if (Math.abs(diffX) > 40) {
                if (diffX > 0) {
                    updateCoverflow(activeIndex + 1);
                } else {
                    updateCoverflow(activeIndex - 1);
                }
            }
        }, { passive: true });

        // Initial setup
        updateCoverflow(0);
    }

    _initScrollTimeline(reduceMotion) {
        const shell = document.querySelector('[data-scroll-timeline]');
        const lineFill = document.getElementById('edu-line-fill');
        const dots = document.querySelectorAll('.tl-dot');
        if (!shell || !lineFill) return;

        const lineBase = shell.querySelector('.tl-line-base');
        const items = shell.querySelectorAll('[data-tl-item]');

        if (reduceMotion) {
            lineFill.style.transform = 'scaleY(1)';
            dots.forEach(d => d.classList.add('active'));
            return;
        }

        const updateTimeline = () => {
            const lineRect = lineBase.getBoundingClientRect();
            const lineStart = lineRect.top;
            const lineEnd = lineRect.bottom;
            const anchor = window.innerHeight * 0.55;

            const progress = Math.min(1, Math.max(0,
                (anchor - lineStart) / (lineEnd - lineStart)
            ));
            lineFill.style.transform = `scaleY(${progress})`;
            lineFill.style.height = '100%';

            // Activate dots
            items.forEach((item, i) => {
                const dot = dots[i];
                if (!dot) return;
                const itemRect = item.getBoundingClientRect();
                if (itemRect.top < anchor) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        };

        window.addEventListener('scroll', updateTimeline, { passive: true });
        if (this.lenis) this.lenis.on('scroll', updateTimeline);
        updateTimeline();
    }

    _initGlobe() {
        const canvas = document.getElementById('globe-canvas');
        if (!canvas) return;
        try {
            this.globe = new GlobeScene('globe-canvas');
        } catch (e) {
            console.warn('Globe init skipped:', e);
        }
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
        this.isMobile = window.innerWidth <= 768;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));

        if (this.lockerScene) {
            this.lockerScene.resize(this.isMobile);
        }

        if (this.solarSystem) {
            this.solarSystem.resize();
        }
    }

    tick(time) {
        if (this.lenis) this.lenis.raf(time);

        const elapsedTime = this.clock.getElapsedTime();

        // Dynamic Nav header scroll state toggling
        const scroll = this.lenis ? this.lenis.animatedScroll : window.scrollY;
        const navHeader = document.getElementById('nav-header');
        if (navHeader) {
            if (scroll > 50) {
                navHeader.classList.add('scrolled');
            } else {
                navHeader.classList.remove('scrolled');
            }
        }

        if (this.lockerScene && this.lockerScene.isOpen === false) {
            // Intro phase — animate the ENTER button scene
            if (this.lockerScene.update) {
                this.lockerScene.update(elapsedTime);
            }

            // Intro phase - animate stars slowly before warp
            const starMesh = this.scene.children.find(obj => obj.type === 'Points' && !obj.userData?.isNebula);
            if (starMesh) starMesh.rotation.y = elapsedTime * 0.02;

            // Parallax on camera
            if (!this.isMobile) {
                this.camera.position.x += (this.mouseX * 0.5 - this.camera.position.x) * 0.05;
                this.camera.position.y += (this.mouseY * 0.5 - this.camera.position.y) * 0.05;
                this.camera.lookAt(0, 0, 0); // Keep focused forward
            }
        } else if (this.solarSystem && this.solarSystem.visible) {
            // Update Solar System
            const scroll = this.lenis ? this.lenis.animatedScroll : 0;
            const maxScroll = this.lenis ? document.body.scrollHeight - window.innerHeight : 1;

            this.solarSystem.update(elapsedTime, scroll, maxScroll);

            // Dynamic Content Reveal Logic
            // If we are deep in space (near end of scroll), maybe ensure content overlay is visible
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
