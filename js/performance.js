// Performance profiling and monitoring

class PerformanceProfiler {
    constructor() {
        this.enabled = true;
        this.frameCount = 0;
        this.lastFPSUpdate = Date.now();
        this.fps = 60;
        this.frameTimes = [];
        this.maxFrameTimeHistory = 60; // Keep last 60 frames
        
        // Detailed profiling
        this.profiles = {
            update: { times: [], total: 0, count: 0, avg: 0 },
            render: { times: [], total: 0, count: 0, avg: 0 },
            pathfinding: { times: [], total: 0, count: 0, avg: 0 },
            ai: { times: [], total: 0, count: 0, avg: 0 },
        };
        
        this.currentProfile = null;
        this.profileStack = [];
    }

    startFrame() {
        if (!this.enabled) return;
        this.frameStartTime = performance.now();
    }

    endFrame() {
        if (!this.enabled || !this.frameStartTime) return;
        
        const frameTime = performance.now() - this.frameStartTime;
        this.frameTimes.push(frameTime);
        
        if (this.frameTimes.length > this.maxFrameTimeHistory) {
            this.frameTimes.shift();
        }

        // Update FPS every second
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFPSUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFPSUpdate = now;
        }
    }

    startProfile(name) {
        if (!this.enabled) return;
        
        if (this.currentProfile) {
            this.profileStack.push(this.currentProfile);
        }
        
        this.currentProfile = {
            name: name,
            startTime: performance.now(),
        };
    }

    endProfile(name) {
        if (!this.enabled || !this.currentProfile) return;
        
        const profile = this.currentProfile;
        if (profile.name !== name) {
            console.warn(`Profile mismatch: expected ${name}, got ${profile.name}`);
            return;
        }

        const duration = performance.now() - profile.startTime;
        
        if (this.profiles[name]) {
            const prof = this.profiles[name];
            prof.times.push(duration);
            prof.total += duration;
            prof.count++;
            
            if (prof.times.length > this.maxFrameTimeHistory) {
                const removed = prof.times.shift();
                prof.total -= removed;
            }
            
            prof.avg = prof.total / prof.count;
        }

        // Restore previous profile
        if (this.profileStack.length > 0) {
            this.currentProfile = this.profileStack.pop();
        } else {
            this.currentProfile = null;
        }
    }

    getStats() {
        const avgFrameTime = this.frameTimes.length > 0
            ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
            : 0;

        return {
            fps: this.fps,
            avgFrameTime: avgFrameTime.toFixed(2),
            frameTimeHistory: [...this.frameTimes],
            profiles: Object.fromEntries(
                Object.entries(this.profiles).map(([name, prof]) => [
                    name,
                    {
                        avg: prof.avg.toFixed(2),
                        count: prof.count,
                        last: prof.times.length > 0 ? prof.times[prof.times.length - 1].toFixed(2) : 0,
                    }
                ])
            ),
        };
    }

    reset() {
        this.frameCount = 0;
        this.frameTimes = [];
        for (const prof of Object.values(this.profiles)) {
            prof.times = [];
            prof.total = 0;
            prof.count = 0;
            prof.avg = 0;
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.reset();
        }
    }
}

// Global profiler instance
const profiler = new PerformanceProfiler();
