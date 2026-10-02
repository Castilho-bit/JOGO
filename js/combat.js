/**
 * Sistema de Combate e Detecção de Colisão
 * Gerencia colisões de golpes, projéteis, multiplicadores de combo,
 * timers de combo e registro de estatísticas de batalha.
 */

class CombatSystem {
    constructor() {
        this.comboCounter = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.comboMultiplier = 1.0;
        this.totalDamageDealt = 0;
        this.battleTime = 0;
        this.enemiesDefeated = 0;
    }

    reset() {
        this.comboCounter = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.comboMultiplier = 1.0;
        this.totalDamageDealt = 0;
        this.battleTime = 0;
    }

    resetCombo() {
        this.comboCounter = 0;
        this.comboMultiplier = 1.0;
        this.comboTimer = 0;
    }

    update(dt, player, enemy) {
        this.battleTime += dt;

        // Decaimento do combo do jogador se passar tempo sem acertar
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.resetCombo();
            }
        }

        // 1. Checar colisão de golpes do Jogador no Inimigo
        this.checkMeleeHit(player, enemy, true);

        // 2. Checar colisão de golpes do Inimigo no Jogador
        this.checkMeleeHit(enemy, player, false);

        // 3. Checar projéteis do Jogador
        this.checkProjectiles(player, enemy, true);

        // 4. Checar projéteis do Inimigo
        this.checkProjectiles(enemy, player, false);
    }

    checkMeleeHit(attacker, defender, isPlayerAttacker) {
        if (!attacker || !defender || attacker.state === 'dead' || defender.state === 'dead') return;
        if (attacker.attackHitChecked) return;

        const hitbox = attacker.getHitbox();
        if (!hitbox) return;

        const hurtbox = defender.getHurtbox();

        if (this.intersects(hitbox, hurtbox)) {
            attacker.attackHitChecked = true;

            // Determinar se é golpe crítico
            const isCrit = Math.random() < attacker.critChance;
            let rawDamage = attacker.damage;

            if (attacker.state === 'attack1') {
                rawDamage *= 1.0;
            } else if (attacker.state === 'attack2') {
                rawDamage *= 1.25;
            } else if (attacker.state === 'attack3') {
                rawDamage *= 1.6;
            } else if (attacker.state === 'heavy') {
                rawDamage *= 2.0;
            }

            if (isCrit) {
                rawDamage *= 1.75;
            }

            // Aplicar multiplicador de combo se for o jogador atacando
            if (isPlayerAttacker) {
                this.comboCounter++;
                if (this.comboCounter > this.maxCombo) {
                    this.maxCombo = this.comboCounter;
                }
                this.comboTimer = 2.2; // 2.2 segundos para estender o combo
                this.comboMultiplier = 1.0 + (this.comboCounter - 1) * 0.12;
                rawDamage *= this.comboMultiplier;

                // Efeito e chamada de combo visual
                this.triggerComboVisual(this.comboCounter, defender.x, defender.y - 100);
            }

            const damageDealt = defender.takeDamage(Math.round(rawDamage), isCrit, attacker);

            if (isPlayerAttacker) {
                this.totalDamageDealt += damageDealt;
            }
        }
    }

    checkProjectiles(attacker, defender, isPlayerAttacker) {
        if (!attacker || !defender || defender.state === 'dead') return;

        const hurtbox = defender.getHurtbox();

        for (let i = attacker.projectiles.length - 1; i >= 0; i--) {
            const p = attacker.projectiles[i];
            const pBox = { x: p.x - p.width / 2, y: p.y - p.height / 2, w: p.width, h: p.height };

            if (this.intersects(pBox, hurtbox)) {
                // Acertou projétil
                const damageDealt = defender.takeDamage(p.damage, true, attacker);
                attacker.projectiles.splice(i, 1);

                if (isPlayerAttacker) {
                    this.comboCounter += 2;
                    if (this.comboCounter > this.maxCombo) this.maxCombo = this.comboCounter;
                    this.comboTimer = 2.2;
                    this.comboMultiplier = 1.0 + (this.comboCounter - 1) * 0.12;
                    this.totalDamageDealt += damageDealt;
                    this.triggerComboVisual(this.comboCounter, defender.x, defender.y - 100);
                }
            }
        }
    }

    triggerComboVisual(hits, x, y) {
        if (hits >= 2) {
            let label = `${hits} HITS!`;
            let color = '#ffd166';
            let fontSize = 22;

            if (hits >= 10) {
                label = `${hits} HITS! LENDÁRIO!`;
                color = '#ff0055';
                fontSize = 32;
                particleSystem.triggerShake(9, 0.35);
            } else if (hits >= 6) {
                label = `${hits} HITS! BRUTAL!`;
                color = '#00f0ff';
                fontSize = 28;
                particleSystem.triggerShake(7, 0.25);
            } else if (hits >= 3) {
                label = `${hits} HITS!`;
                color = '#ffd166';
                fontSize = 24;
                particleSystem.triggerShake(5, 0.2);
            }

            particleSystem.addFloatingText(label, x, y, {
                color: color,
                fontSize: fontSize,
                fontWeight: '900',
                strokeColor: '#000000',
                strokeWidth: 4
            });
        }
    }

    intersects(r1, r2) {
        return !(
            r2.x > r1.x + r1.w ||
            r2.x + r2.w < r1.x ||
            r2.y > r1.y + r1.h ||
            r2.y + r2.h < r1.y
        );
    }
}
