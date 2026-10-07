/**
 * Sistema de Combate, Detecção de Colisão e Efeitos de Impacto
 * Gerencia colisões de golpes, projéteis, multiplicadores de combo,
 * timers de combo, efeitos de armas e registro de estatísticas de batalha.
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

        // Decaimento do combo do jogador
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

            // Bônus do item: Emblema Berserker (+30% de dano se HP < 35%)
            if (attacker.equippedItems && attacker.equippedItems.includes('emblema_berserker')) {
                if (attacker.hp / attacker.maxHp <= 0.35) {
                    rawDamage *= 1.30;
                }
            }

            // Aplicar multiplicador de combo se for o jogador atacando
            if (isPlayerAttacker) {
                this.comboCounter++;
                if (this.comboCounter > this.maxCombo) {
                    this.maxCombo = this.comboCounter;
                }
                this.comboTimer = 2.4; // 2.4 segundos para encadear o combo
                this.comboMultiplier = 1.0 + (this.comboCounter - 1) * 0.12;
                rawDamage *= this.comboMultiplier;

                // Efeito visual de combo
                this.triggerComboVisual(this.comboCounter, defender.x, defender.y - 100);

                // Efeito do item: Anel Sanguinário (Cura 4% da vida ao atingir combo de 4+ hits)
                if (attacker.equippedItems && attacker.equippedItems.includes('anel_vampirico') && this.comboCounter >= 4) {
                    const heal = Math.max(3, Math.round(attacker.maxHp * 0.04));
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                    particleSystem.addFloatingText(`+${heal} VAMP`, attacker.x, attacker.y - 70, { color: '#ff0055', fontSize: 16 });
                }
            }

            // Adicionar rastro de corte luminoso no local do impacto
            const cutColor = attacker.weapon ? attacker.weapon.color : '#00f0ff';
            particleSystem.addSlashArc(
                (attacker.x + defender.x) / 2,
                attacker.y - 45,
                38,
                -Math.PI / 3,
                Math.PI / 3,
                cutColor,
                4
            );

            // Tipo de ataque para cálculo de penetração de guarda
            const attackType = attacker.state === 'heavy' ? 'boss_heavy' : 'normal';
            const damageDealt = defender.takeDamage(Math.round(rawDamage), isCrit, attacker, attackType);

            if (damageDealt > 0) {
                // Efeitos passivos das armas
                if (attacker.weapon) {
                    // Adagas Peçonhentas: aplica veneno corrosivo
                    if (attacker.weapon.specialEffect === 'poison') {
                        defender.applyPoison(2.5, 7);
                    }
                    // Foice Espectral: lifesteal contínuo de 6% do dano
                    if (attacker.weapon.specialEffect === 'lifesteal') {
                        const healAmt = Math.max(1, Math.round(damageDealt * 0.06));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
                        particleSystem.addFloatingText(`+${healAmt} HP`, attacker.x, attacker.y - 65, { color: '#06d6a0', fontSize: 15 });
                    }
                    // Lança de Plasma: arco elétrico
                    if (attacker.weapon.specialEffect === 'lightning') {
                        particleSystem.addLightning(attacker.x, attacker.y - 42, defender.x, defender.y - 42, '#00f0ff');
                        audioSystem.playThunder();
                    }
                    // Martelo dos Titãs: impacto de esmagamento
                    if (attacker.weapon.specialEffect === 'crush' && attacker.state === 'heavy') {
                        particleSystem.addRockDebris(defender.x, defender.y, 6);
                        defender.vx = -defender.direction * 7;
                    }
                }
            }

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

            // Efeito gravitacional do vórtice (atrai o oponente)
            if (p.type === 'vortex') {
                const distToVortex = p.x - defender.x;
                defender.vx += Math.sign(distToVortex) * 1.5;
            }

            if (this.intersects(pBox, hurtbox)) {
                // Acertou projétil (ataque especial com chip damage através de bloqueio comum)
                const damageDealt = defender.takeDamage(p.damage, true, attacker, 'special');

                // Projéteis perfurantes como dimensão e vórtice persistem um pouco, outros explodem
                if (p.type !== 'vortex' && p.type !== 'dimension_cut') {
                    attacker.projectiles.splice(i, 1);
                }

                // Efeito sonoro de impacto elétrico se for plasma
                if (p.type === 'plasma_orb') {
                    audioSystem.playThunder();
                    particleSystem.addLightning(p.x, p.y, defender.x, defender.y - 40, '#4cc9f0');
                }

                if (isPlayerAttacker) {
                    this.comboCounter += 2;
                    if (this.comboCounter > this.maxCombo) this.maxCombo = this.comboCounter;
                    this.comboTimer = 2.4;
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

            if (hits >= 12) {
                label = `${hits} HITS! LENDÁRIO!`;
                color = '#ff0055';
                fontSize = 32;
                particleSystem.triggerShake(9, 0.35);
            } else if (hits >= 7) {
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
