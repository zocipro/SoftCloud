const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const axes = ['x', 'y'];
const limits = { x: 22 * Math.PI / 180, y: 50 * Math.PI / 180 };
const reach = { x: 0.65, y: 1.15 };

// Autonomous motion and gesture physics have separate clocks and state.
export function createLogoMotion(reduced = false) {
    const offset = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };
    let dragging = false;
    let phase = 0;
    let releaseAge = 0;
    let motionScale = reduced ? 0.4 : 1;

    function cancel() {
        dragging = false;
        velocity.x = velocity.y = 0;
        Object.assign(target, offset);
        releaseAge = 0;
    }

    return {
        step(delta) {
            delta = clamp(delta, 0, 0.05);
            motionScale += ((reduced ? 0.4 : 1) - motionScale) * (1 - Math.exp(-3 * delta));
            phase += delta; // A drag never pauses or resets the autonomous trajectory.
            for (let remaining = delta; remaining > 1e-8;) {
                const dt = Math.min(remaining, 1 / 240);
                remaining -= dt;
                if (!dragging) releaseAge += dt;
                for (const axis of axes) {
                    const spring = dragging ? 170 : 1.8 * (1 - Math.exp(-releaseAge / 0.7));
                    const damping = dragging ? 25 : 1.8;
                    const goal = dragging ? target[axis] : 0;
                    velocity[axis] += ((goal - offset[axis]) * spring - velocity[axis] * damping) * dt;
                    offset[axis] += velocity[axis] * dt;
                }
            }
        },
        sample() {
            const idleX = -0.08 + motionScale * (Math.sin(phase * 0.7) * 0.07 + Math.sin(phase * 1.11) * 0.025);
            const idleY = -0.2 + motionScale * (Math.sin(phase * 0.48) * 0.22 + Math.sin(phase * 0.91) * 0.055);
            return {
                // Smooth compression keeps the front visible without a hard stop at the edge.
                x: limits.x * Math.tanh((idleX + offset.x) / limits.x),
                y: limits.y * Math.tanh((idleY + offset.y) / limits.y),
                z: -0.035 + Math.sin(phase * 0.55) * 0.055 * motionScale,
                floatX: Math.sin(phase * 0.49) * 0.035 * motionScale,
                floatY: Math.sin(phase * 0.83) * 0.12 * motionScale,
            };
        },
        begin() {
            cancel();
            dragging = true;
        },
        move(x, y) {
            for (const [axis, amount] of [['x', x], ['y', y]]) {
                if (!amount) continue;
                // Resist an outward pull progressively; an inward pull responds immediately.
                const resistance = target[axis] * amount > 0 ? 1 / (1 + (target[axis] / reach[axis]) ** 2 * 3) : 1;
                // Re-grabbing an inertial overshoot must not snap the target back inside reach.
                target[axis] = clamp(target[axis] + amount * resistance, Math.min(-reach[axis], target[axis]), Math.max(reach[axis], target[axis]));
            }
        },
        release(x, y) {
            dragging = false;
            releaseAge = 0;
            for (const [axis, speed] of [['x', x], ['y', y]]) {
                // Use the hand's recent speed, not the limited destination's displacement.
                velocity[axis] = speed === 0 ? 0 : clamp(speed * 0.8 + velocity[axis] * 0.2, -2.4, 2.4);
            }
        },
        nudge(x, y) {
            dragging = false;
            releaseAge = 0;
            velocity.x = clamp(velocity.x + x * 4, -2.4, 2.4);
            velocity.y = clamp(velocity.y + y * 4, -2.4, 2.4);
        },
        reset() {
            cancel();
            releaseAge = 2; // Ease back toward the current autonomous pose, without teleporting.
        },
        cancel,
        setReduced(value) { reduced = value; },
    };
}
