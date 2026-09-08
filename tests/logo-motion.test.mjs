import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogoMotion } from '../assets/logo-motion.js';

function advance(motion, seconds, hz = 120) {
    for (let remaining = seconds; remaining > 1e-8;) {
        const dt = Math.min(remaining, 1 / hz);
        motion.step(dt);
        remaining -= dt;
        const pose = motion.sample();
        assert(Number.isFinite(pose.x) && Number.isFinite(pose.y));
        assert(Math.abs(pose.x) <= 22 * Math.PI / 180);
        assert(Math.abs(pose.y) <= 50 * Math.PI / 180);
        assert(Math.cos(pose.x) * Math.cos(pose.y) > 0.59);
    }
}

for (const reduced of [false, true]) {
    test(`autonomous movement remains visible, including while held (reduced=${reduced})`, () => {
        const motion = createLogoMotion(reduced);
        const start = motion.sample();
        motion.begin();
        advance(motion, 2);
        const end = motion.sample();
        assert(end.y - start.y > 0.08, 'holding the model must not freeze its own motion');
        assert(end.floatY - start.floatY > 0.04);
    });

    test(`flick coasts visibly in its release direction, then returns to the independent idle path (reduced=${reduced})`, () => {
        const motion = createLogoMotion(reduced);
        const idle = createLogoMotion(reduced);
        advance(motion, 2); advance(idle, 2);
        motion.begin();
        const beforeInput = motion.sample();
        motion.move(0.08, 0.25);
        assert.deepEqual(motion.sample(), beforeInput, 'pointer input must not teleport the model');
        advance(motion, 0.1); advance(idle, 0.1);
        motion.release(0.9, 2);
        const released = motion.sample();
        advance(motion, 0.4); advance(idle, 0.4);
        assert(motion.sample().y - released.y > 0.2, 'a flick needs visible travel after release');
        assert(motion.sample().x - released.x > 0.08, 'vertical flicks need inertia too');
        advance(motion, 10); advance(idle, 10);
        assert(Math.abs(motion.sample().x - idle.sample().x) < 0.002);
        assert(Math.abs(motion.sample().y - idle.sample().y) < 0.002);
    });
}

test('fast outward drags approach the boundary smoothly, never expose the rear, and reverse', () => {
    const motion = createLogoMotion();
    motion.begin(); motion.move(100, 100); advance(motion, 1);
    const edge = motion.sample();
    motion.release(2.4, 2.4);
    advance(motion, 0.1);
    assert(motion.sample().y > edge.y, 'release speed must survive an outward drag at the soft boundary');
    advance(motion, 3);
    motion.begin(); motion.move(-100, -100); advance(motion, 0.6);
    assert(motion.sample().x < 0 && motion.sample().y < 0);
    motion.release(-2.4, -2.4); advance(motion, 10);
});

test('60 Hz and 120 Hz produce the same inertial path', () => {
    const samples = [60, 120].map(hz => {
        const motion = createLogoMotion();
        advance(motion, 1, hz);
        motion.begin(); motion.move(0.1, 0.3); advance(motion, 0.2, hz);
        motion.release(0.8, 1.8); advance(motion, 0.5, hz);
        return motion.sample();
    });
    for (const key of Object.keys(samples[0])) assert(Math.abs(samples[0][key] - samples[1][key]) < 0.001);
});

test('re-grabbing an inertial overshoot does not pull either axis abruptly inward', () => {
    const dragged = createLogoMotion();
    const held = createLogoMotion();
    for (const motion of [dragged, held]) {
        motion.begin(); motion.move(100, 100); advance(motion, 1);
        motion.release(2.4, 2.4); advance(motion, 0.25); motion.begin();
    }
    dragged.move(0, 0.01);
    advance(dragged, 0.2); advance(held, 0.2);
    assert(Math.abs(dragged.sample().x - held.sample().x) < 0.00001, 'the untouched axis must stay continuous');
    assert(dragged.sample().y >= held.sample().y - 0.00001, 'an outward pull must not drive the model inward');
});

test('cancellation, re-grabbing and preference changes do not jump the pose', () => {
    const motion = createLogoMotion();
    motion.begin(); motion.move(0.1, 0.3); advance(motion, 0.2); motion.release(1, 2); advance(motion, 0.1);
    const before = motion.sample();
    motion.cancel(); assert.deepEqual(motion.sample(), before);
    motion.begin(); assert.deepEqual(motion.sample(), before);
    motion.setReduced(true); assert.deepEqual(motion.sample(), before);
    motion.release(0, 0); advance(motion, 0.5);
    const settled = motion.sample();
    motion.reset(); assert.deepEqual(motion.sample(), settled);
    advance(motion, 8);
});
