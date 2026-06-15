export default class SpaceAmbientSynth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.oscillators = [];
        this.lfos = [];
    }

    init() {
        if (this.ctx) return;
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        
        this.ctx = new AudioContextClass();
        
        // Master Gain for volume/mute control
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Build drone nodes
        this._buildDrone();
    }

    _buildDrone() {
        // Detuned space chord: A1 (55Hz), A2 (110Hz), E3 (165Hz), A3 (220Hz)
        const freqs = [55, 110, 165, 220];
        
        // Master lowpass filter to make the synth warm and sub-heavy
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(280, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.5, this.ctx.currentTime);
        filter.connect(this.masterGain);

        // Slow LFO to sweep filter cutoff frequency (12-second cycle)
        const filterLFO = this.ctx.createOscillator();
        filterLFO.frequency.setValueAtTime(0.08, this.ctx.currentTime);
        const filterLFOGain = this.ctx.createGain();
        filterLFOGain.gain.setValueAtTime(120, this.ctx.currentTime);
        filterLFO.connect(filterLFOGain);
        filterLFOGain.connect(filter.frequency);
        filterLFO.start();
        this.lfos.push(filterLFO);

        // Delay effect loop for spaciousness
        const delay = this.ctx.createDelay(5.0);
        delay.delayTime.setValueAtTime(1.8, this.ctx.currentTime);
        const feedback = this.ctx.createGain();
        feedback.gain.setValueAtTime(0.55, this.ctx.currentTime); // 55% feedback
        
        filter.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        feedback.connect(this.masterGain);

        // Create detuned harmonics
        freqs.forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(f + (Math.random() - 0.5) * 0.4, this.ctx.currentTime);

            // Detuning LFO for slow chorus/beating
            const detuneLFO = this.ctx.createOscillator();
            detuneLFO.frequency.setValueAtTime(0.08 + idx * 0.04, this.ctx.currentTime);
            const detuneLFOGain = this.ctx.createGain();
            detuneLFOGain.gain.setValueAtTime(1.2, this.ctx.currentTime);
            detuneLFO.connect(detuneLFOGain);
            detuneLFOGain.connect(osc.frequency);
            detuneLFO.start();
            this.lfos.push(detuneLFO);

            // Swell volume slowly for each harmonic
            const oscGain = this.ctx.createGain();
            const baseVolume = idx === 0 ? 0.22 : 0.08 / idx;
            oscGain.gain.setValueAtTime(baseVolume, this.ctx.currentTime);

            const swellLFO = this.ctx.createOscillator();
            swellLFO.frequency.setValueAtTime(0.04 + Math.random() * 0.04, this.ctx.currentTime);
            const swellLFOGain = this.ctx.createGain();
            swellLFOGain.gain.setValueAtTime(baseVolume * 0.45, this.ctx.currentTime);
            swellLFO.connect(swellLFOGain);
            swellLFOGain.connect(oscGain.gain);
            swellLFO.start();
            this.lfos.push(swellLFO);

            osc.connect(oscGain);
            oscGain.connect(filter);
            osc.start();
            this.oscillators.push(osc);
        });

        // Add soft solar wind (filtered bandpass noise)
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2.0 - 1.0;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(380, this.ctx.currentTime);
        noiseFilter.Q.setValueAtTime(0.6, this.ctx.currentTime);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.02, this.ctx.currentTime);

        const noiseLFO = this.ctx.createOscillator();
        noiseLFO.frequency.setValueAtTime(0.03, this.ctx.currentTime);
        const noiseLFOGain = this.ctx.createGain();
        noiseLFOGain.gain.setValueAtTime(150, this.ctx.currentTime);
        noiseLFO.connect(noiseLFOGain);
        noiseLFOGain.connect(noiseFilter.frequency);
        noiseLFO.start();
        this.lfos.push(noiseLFO);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start();
    }

    play() {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        // Fade in master gain smoothly over 2 seconds
        this.masterGain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 2.0);
        this.isPlaying = true;
    }

    pause() {
        if (!this.ctx) return;
        // Fade out master gain smoothly over 1 second
        this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);
        this.isPlaying = false;
    }
}
