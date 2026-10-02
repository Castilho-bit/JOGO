/**
 * Sistema de Partículas e Efeitos Visuais
 * Suporta faíscas, sangue estilizado, poeira de chão, fogo, fumaça sombria,
 * arcos de golpe (slash arcs), textos flutuantes de dano e screen shake.
 */
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.floatingTexts = [];
        this.slashArcs = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
    }

    reset() {
        this.particles = [];
        this.floatingTexts = [];
        this.slashArcs = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
    }

    triggerShake(intensity = 6, duration = 0.25) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeTime = Math.max(this.shakeTime, duration);
    }

    getShakeOffset() {
        if (this.shakeTime <= 0) return { x: 0, y: 0 };
        const factor = this.shakeIntensity * (this.shakeTime / 0.3);
        const x = (Math.random() - 0.5) * factor * 2;
        const y = (Math.random() - 0.5) * factor * 2;
        return { x, y };
    }

    addSpark(x, y, count = 12, color = '#ffd700', spreadSpeed = 5) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 0.7 + 0.3) * spreadSpeed;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                radius: Math.random() * 2.5 + 1.5,
                color: color,
                alpha: 1,
                decay: Math.random() * 0.03 + 0.02,
                gravity: 0.18,
                friction: 0.94
            });
        }
    }

    addBlood(x, y, count = 10, dir = 1) {
        for (let i = 0; i < count; i++) {
            const angle = dir > 0 ? (Math.random() * Math.PI - Math.PI / 2) : (Math.random() * Math.PI + Math.PI / 2);
            const speed = Math.random() * 5 + 2;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed + dir * 2,
                vy: Math.sin(angle) * speed - 2,
                radius: Math.random() * 3 + 2,
                color: Math.random() > 0.3 ? '#ff0044' : '#990022',
                alpha: 0.9,
                decay: Math.random() * 0.025 + 0.015,
                gravity: 0.22,
                friction: 0.96
            });
        }
    }

    addDust(x, y, count = 6, dir = 0) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 16,
                y: y + (Math.random() - 0.5) * 4,
                vx: (dir * -1) * (Math.random() * 2 + 1) + (Math.random() - 0.5) * 1.5,
                vy: -(Math.random() * 1.5 + 0.5),
                radius: Math.random() * 3 + 2,
                color: '#8b9bb4',
                alpha: 0.5,
                decay: 0.03,
                gravity: -0.01,
                friction: 0.92
            });
        }
    }

    addFireTrail(x, y, count = 3) {
        for (let i = 0; i < count; i++) {
            const colors = ['#ff3300', '#ff8800', '#ffee00', '#ffffff'];
            this.particles.push({
                x: x + (Math.random() - 0.5) * 8,
                y: y + (Math.random() - 0.5) * 8,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -(Math.random() * 2 + 1),
                radius: Math.random() * 3.5 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 0.9,
                decay: 0.04,
                gravity: -0.05,
                friction: 0.95
            });
        }
    }

    addShadowSmoke(x, y, count = 3) {
        for (let i = 0; i < count; i++) {
            const colors = ['#7b2cbf', '#3c096c', '#10002b', '#c77dff'];
            this.particles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 1.2,
                vy: -(Math.random() * 1.8 + 0.4),
                radius: Math.random() * 4 + 2.5,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 0.8,
                decay: 0.03,
                gravity: -0.03,
                friction: 0.96
            });
        }
    }

    addSlashArc(x, y, radius, startAngle, endAngle, color = '#00f0ff', width = 5) {
        this.slashArcs.push({
            x,
            y,
            radius,
            startAngle,
            endAngle,
            color,
            width,
            alpha: 1,
            decay: 0.12
        });
    }

    addFloatingText(text, x, y, options = {}) {
        this.floatingTexts.push({
            text,
            x,
            y,
            vy: -2.5,
            vx: (Math.random() - 0.5) * 1.2,
            alpha: 1,
            color: options.color || '#ffffff',
            fontSize: options.fontSize || 20,
            fontWeight: options.fontWeight || 'bold',
            strokeColor: options.strokeColor || '#000000',
            strokeWidth: options.strokeWidth || 3,
            decay: options.decay || 0.02,
            scale: 1.4
        });
    }

    addConfetti(x, y, count = 60) {
        const colors = ['#ff0055', '#00f0ff', '#ffd166', '#06d6a0', '#9d4edd', '#ffffff'];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                radius: Math.random() * 4 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                decay: Math.random() * 0.015 + 0.008,
                gravity: 0.2,
                friction: 0.98,
                isConfetti: true,
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 15
            });
        }
    }

    update(dt = 0.016) {
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            if (this.shakeTime <= 0) {
                this.shakeIntensity = 0;
            }
        }

        // Atualizar partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= p.friction;
            p.vy = p.vy * p.friction + p.gravity;
            p.alpha -= p.decay;

            if (p.isConfetti) {
                p.rotation += p.vRot;
            }

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Atualizar arcos de corte
        for (let i = this.slashArcs.length - 1; i >= 0; i--) {
            const arc = this.slashArcs[i];
            arc.alpha -= arc.decay;
            if (arc.alpha <= 0) {
                this.slashArcs.splice(i, 1);
            }
        }

        // Atualizar textos flutuantes
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.x += ft.vx;
            ft.y += ft.vy;
            ft.vy *= 0.96;
            ft.alpha -= ft.decay;
            if (ft.scale > 1) {
                ft.scale -= 0.05;
                if (ft.scale < 1) ft.scale = 1;
            }
            if (ft.alpha <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    render(ctx) {
        ctx.save();

        // Renderizar arcos de corte
        for (const arc of this.slashArcs) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, arc.alpha);
            ctx.strokeStyle = arc.color;
            ctx.lineWidth = arc.width;
            ctx.lineCap = 'round';
            ctx.shadowColor = arc.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(arc.x, arc.y, arc.radius, arc.startAngle, arc.endAngle);
            ctx.stroke();
            ctx.restore();
        }

        // Renderizar partículas
        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);

            if (p.isConfetti) {
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.radius, -p.radius / 2, p.radius * 2, p.radius);
            } else {
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Renderizar textos flutuantes
        for (const ft of this.floatingTexts) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.alpha);
            ctx.font = `${ft.fontWeight} ${Math.round(ft.fontSize * ft.scale)}px 'Outfit', 'Segoe UI', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Contorno
            ctx.strokeStyle = ft.strokeColor;
            ctx.lineWidth = ft.strokeWidth * ft.scale;
            ctx.strokeText(ft.text, ft.x, ft.y);

            // Preenchimento
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);

            ctx.restore();
        }

        ctx.restore();
    }
}

// Instância global
const particleSystem = new ParticleSystem();
