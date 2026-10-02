/**
 * Classe Fighter - Renderizador de Stickman Procedural e Física de Combate
 * Desenha os stickmen diretamente no Canvas usando linhas, círculos e polígonos,
 * suportando diferentes estilos de personagens, animações suaves e armas estilizadas.
 */

class Fighter {
    constructor(config = {}) {
        this.isPlayer = config.isPlayer || false;
        this.name = config.name || 'Stickman';
        this.charId = config.charId || 'stickman';
        this.charData = CHARACTERS_DATA[this.charId] || CHARACTERS_DATA.stickman;

        this.x = config.x || 200;
        this.y = config.y || 400; // Posição do pé no chão
        this.vx = 0;
        this.vy = 0;
        this.direction = config.direction || 1; // 1 = direita, -1 = esquerda

        // Atributos base
        this.maxHp = this.charData.baseHp;
        this.hp = this.maxHp;
        this.maxEnergy = this.charData.baseEnergy;
        this.energy = this.maxEnergy;
        this.damage = this.charData.baseDamage;
        this.speed = this.charData.baseSpeed;
        this.defense = this.charData.baseDefense;
        this.critChance = this.charData.critChance;

        // Equipamento
        this.weapon = WEAPONS_DATA[config.weaponId || 'madeira'] || WEAPONS_DATA.madeira;
        this.equippedItems = config.equippedItems || [];

        // Atualizar com os bônus
        this.recalculateStats();

        // Estados de animação e combate
        this.state = 'idle'; // idle, walk, jump, crouch, attack1, attack2, attack3, heavy, block, dodge, special, hurt, dead, win
        this.stateTimer = 0;
        this.animTime = 0;
        this.isGrounded = true;
        this.isCrouching = false;
        this.isBlocking = false;
        this.isInvulnerable = false;
        this.canCombo = false;
        this.comboChain = 0;
        this.attackHitChecked = false;

        // Dimensões do corpo
        this.height = 80;
        this.width = 30;
        this.groundY = 440; // Nível padrão do solo da arena

        // Rastro de dash / sombra
        this.ghostTrails = [];

        // Especial projétil
        this.projectiles = [];
    }

    recalculateStats() {
        this.charData = CHARACTERS_DATA[this.charId] || CHARACTERS_DATA.stickman;

        let totalHp = this.charData.baseHp;
        let totalDmg = this.charData.baseDamage + (this.weapon ? this.weapon.damage : 0);
        let totalSpeed = this.charData.baseSpeed;
        let totalDef = this.charData.baseDefense;
        let totalEnergy = this.charData.baseEnergy;
        let totalCrit = this.charData.critChance + (this.weapon ? this.weapon.critBonus : 0);

        // Somar itens
        for (const itemId of this.equippedItems) {
            const item = ITEMS_DATA[itemId];
            if (!item) continue;
            if (item.bonusHp) totalHp += item.bonusHp;
            if (item.bonusDef) totalDef += item.bonusDef;
            if (item.bonusEnergy) totalEnergy += item.bonusEnergy;
            if (item.bonusCrit) totalCrit += item.bonusCrit;
            if (item.bonusDamagePct) totalDmg *= (1 + item.bonusDamagePct);
            if (item.bonusSpeedPct) totalSpeed *= (1 + item.bonusSpeedPct);
        }

        const hpRatio = this.hp / this.maxHp;
        this.maxHp = Math.round(totalHp);
        this.hp = Math.min(this.maxHp, Math.round(this.maxHp * (isNaN(hpRatio) ? 1 : hpRatio)));
        if (this.hp <= 0 && this.state !== 'dead') this.hp = this.maxHp;

        this.maxEnergy = Math.round(totalEnergy);
        this.damage = Math.round(totalDmg);
        this.speed = totalSpeed;
        this.defense = Math.round(totalDef);
        this.critChance = totalCrit;
    }

    setWeapon(weaponId) {
        if (WEAPONS_DATA[weaponId]) {
            this.weapon = WEAPONS_DATA[weaponId];
            this.recalculateStats();
        }
    }

    setCharacter(charId) {
        if (CHARACTERS_DATA[charId]) {
            this.charId = charId;
            this.charData = CHARACTERS_DATA[charId];
            this.recalculateStats();
        }
    }

    // Ações de combate
    move(dir) {
        if (this.state === 'dead' || this.state === 'hurt' || this.isBlocking || this.state === 'special' || this.state.startsWith('attack') || this.state === 'heavy') {
            return;
        }
        if (this.isCrouching) {
            this.vx = dir * (this.speed * 0.4);
            return;
        }

        this.direction = dir;
        this.vx = dir * this.speed;
        if (this.isGrounded && this.state !== 'jump') {
            this.state = 'walk';
        }
    }

    stopMoving() {
        if (this.state === 'walk') {
            this.state = 'idle';
        }
        this.vx *= 0.5;
    }

    jump() {
        if (!this.isGrounded || this.state === 'dead' || this.state === 'hurt' || this.isBlocking) return;
        this.vy = -14;
        this.isGrounded = false;
        this.state = 'jump';
        particleSystem.addDust(this.x, this.y, 6, 0);
        audioSystem.playJump();
    }

    crouch(isDown) {
        if (this.state === 'dead' || this.state === 'hurt') return;
        this.isCrouching = isDown;
        if (isDown && this.isGrounded && !this.state.startsWith('attack')) {
            this.state = 'crouch';
        } else if (!isDown && this.state === 'crouch') {
            this.state = 'idle';
        }
    }

    block(isGuard) {
        if (this.state === 'dead' || this.state === 'hurt') return;
        this.isBlocking = isGuard;
        if (isGuard && this.isGrounded) {
            this.state = 'block';
            this.vx = 0;
        } else if (!isGuard && this.state === 'block') {
            this.state = 'idle';
        }
    }

    dodge() {
        if (this.state === 'dead' || this.state === 'dodge' || this.energy < 20) return;
        this.energy = Math.max(0, this.energy - 20);
        this.state = 'dodge';
        this.stateTimer = 0.28;
        this.isInvulnerable = true;
        this.vx = this.direction * (this.speed * 2.4);
        audioSystem.playDodge();
        particleSystem.addDust(this.x, this.y, 8, this.direction);
    }

    attackLight() {
        if (this.state === 'dead' || this.state === 'hurt' || this.state === 'dodge' || this.isBlocking) return false;

        // Se puder encadear combo
        if (this.state === 'attack1' && this.canCombo) {
            this.state = 'attack2';
            this.stateTimer = 0.22;
            this.attackHitChecked = false;
            this.canCombo = false;
            this.vx = this.direction * 3;
            audioSystem.playSword();
            return true;
        } else if (this.state === 'attack2' && this.canCombo) {
            this.state = 'attack3';
            this.stateTimer = 0.30;
            this.attackHitChecked = false;
            this.canCombo = false;
            this.vx = this.direction * 5;
            audioSystem.playSword();
            return true;
        } else if (!this.state.startsWith('attack') && this.state !== 'heavy' && this.state !== 'special') {
            this.state = 'attack1';
            this.stateTimer = 0.20;
            this.attackHitChecked = false;
            this.canCombo = false;
            this.comboChain = 1;
            this.vx = this.direction * 2;
            audioSystem.playSword();
            return true;
        }
        return false;
    }

    attackHeavy() {
        if (this.state === 'dead' || this.state === 'hurt' || this.state === 'dodge' || this.isBlocking || this.state.startsWith('attack') || this.state === 'heavy' || this.state === 'special') return false;
        if (this.energy < 25) return false;

        this.energy -= 25;
        this.state = 'heavy';
        this.stateTimer = 0.45;
        this.attackHitChecked = false;
        this.vx = this.direction * 4;
        audioSystem.playSword();
        return true;
    }

    useSpecial() {
        if (this.state === 'dead' || this.state === 'hurt' || this.state === 'dodge' || this.state === 'special') return false;
        if (this.energy < 75) return false;

        this.energy -= 75;
        this.state = 'special';
        this.stateTimer = 0.65;
        this.attackHitChecked = false;
        this.vx = 0;
        audioSystem.playSpecial();

        // Criar projétil de corte sônico após leve delay
        setTimeout(() => {
            if (this.state !== 'dead') {
                this.spawnSonicWave();
            }
        }, 220);

        return true;
    }

    spawnSonicWave() {
        const isShadow = this.charId === 'shadow' || (this.weapon && this.weapon.id === 'sombria');
        const isFire = this.weapon && this.weapon.id === 'flamejante';
        let waveColor = '#00f0ff';
        if (isShadow) waveColor = '#c77dff';
        if (isFire) waveColor = '#ff5400';

        this.projectiles.push({
            x: this.x + this.direction * 40,
            y: this.y - 45,
            vx: this.direction * 14,
            width: 25,
            height: 60,
            color: waveColor,
            damage: Math.round(this.damage * 1.6),
            life: 1.2,
            owner: this
        });
        particleSystem.triggerShake(7, 0.25);
    }

    takeDamage(amount, isCrit = false, attacker = null) {
        if (this.state === 'dead' || this.isInvulnerable) return 0;

        let finalDmg = amount;

        // Redução por defesa (fórmula padrão com amortecimento)
        const defFactor = 100 / (100 + this.defense);
        finalDmg = Math.max(1, Math.round(finalDmg * defFactor));

        if (this.isBlocking) {
            finalDmg = Math.max(1, Math.round(finalDmg * 0.25)); // 75% absorvido
            audioSystem.playDefense();
            particleSystem.addSpark(this.x + this.direction * 15, this.y - 45, 12, '#00f0ff', 6);
            particleSystem.addFloatingText('BLOQUEADO!', this.x, this.y - 85, { color: '#00f0ff', fontSize: 16 });
            this.vx = -this.direction * 3;
            this.hp = Math.max(0, this.hp - finalDmg);
            if (this.hp <= 0) this.die();
            return finalDmg;
        }

        this.hp = Math.max(0, this.hp - finalDmg);

        if (isCrit) {
            audioSystem.playCritical();
            particleSystem.triggerShake(8, 0.3);
            particleSystem.addFloatingText(`-${finalDmg} CRÍTICO!`, this.x, this.y - 80, { color: '#ff0055', fontSize: 24, fontWeight: '900' });
            particleSystem.addBlood(this.x, this.y - 45, 18, -this.direction);
            particleSystem.addSpark(this.x, this.y - 45, 15, '#ffcc00', 7);
        } else {
            audioSystem.playImpact(amount > 30);
            particleSystem.triggerShake(amount > 30 ? 5 : 3, 0.18);
            particleSystem.addFloatingText(`-${finalDmg}`, this.x, this.y - 75, { color: '#ffd166', fontSize: 18 });
            particleSystem.addBlood(this.x, this.y - 45, 8, -this.direction);
            particleSystem.addSpark(this.x, this.y - 45, 8, '#ffffff', 4);
        }

        if (this.hp <= 0) {
            this.die();
        } else {
            this.state = 'hurt';
            this.stateTimer = 0.22;
            this.vx = -this.direction * 4;
            this.vy = -2;
            this.isGrounded = false;
        }

        return finalDmg;
    }

    die() {
        this.hp = 0;
        this.state = 'dead';
        this.stateTimer = 3.0;
        this.vx = -this.direction * 5;
        this.vy = -6;
        this.isGrounded = false;
        audioSystem.playDefeat();
        particleSystem.triggerShake(10, 0.4);
        particleSystem.addBlood(this.x, this.y - 40, 25, -this.direction);
    }

    win() {
        this.state = 'win';
        this.vx = 0;
        this.vy = 0;
    }

    // Caixa de colisão do corpo
    getHurtbox() {
        const h = this.isCrouching ? this.height * 0.6 : this.height;
        return {
            x: this.x - this.width / 2,
            y: this.y - h,
            w: this.width,
            h: h
        };
    }

    // Caixa de colisão do golpe atual
    getHitbox() {
        if (!this.state.startsWith('attack') && this.state !== 'heavy' && this.state !== 'special') {
            return null;
        }

        let reach = 50;
        let h = 40;
        let yOffset = 50;

        if (this.weapon) {
            reach += this.weapon.bladeLength * 0.4;
        }

        if (this.state === 'attack1') {
            reach += 10;
        } else if (this.state === 'attack2') {
            reach += 15;
            h = 50;
        } else if (this.state === 'attack3') {
            reach += 25;
            h = 60;
        } else if (this.state === 'heavy') {
            reach += 30;
            h = 70;
            yOffset = 35;
        }

        return {
            x: this.direction > 0 ? this.x : this.x - reach,
            y: this.y - yOffset,
            w: reach,
            h: h
        };
    }

    update(dt = 0.016, arenaWidth = 960) {
        this.animTime += dt;

        // Regeneração passiva de energia
        if (this.state !== 'dead') {
            let regenRate = 18;
            if (this.isBlocking) regenRate = 5;
            if (this.charId === 'ninja') regenRate = 26;
            this.energy = Math.min(this.maxEnergy, this.energy + regenRate * dt);
        }

        // Timer de estado
        if (this.stateTimer > 0) {
            this.stateTimer -= dt;

            // Janela de cancelamento de combo
            if (this.state === 'attack1' && this.stateTimer < 0.12) this.canCombo = true;
            if (this.state === 'attack2' && this.stateTimer < 0.15) this.canCombo = true;

            // Rastro fantasma durante o dodge
            if (this.state === 'dodge') {
                if (Math.random() < 0.4) {
                    this.ghostTrails.push({
                        x: this.x,
                        y: this.y,
                        direction: this.direction,
                        state: this.state,
                        color: this.charData.color,
                        alpha: 0.6
                    });
                }
            }

            if (this.stateTimer <= 0) {
                if (this.state === 'dodge') {
                    this.isInvulnerable = false;
                }
                if (this.state !== 'dead' && this.state !== 'win') {
                    this.state = this.isCrouching ? 'crouch' : 'idle';
                    this.canCombo = false;
                    this.attackHitChecked = false;
                }
            }
        }

        // Efeitos contínuos da arma (fogo ou sombra)
        if (this.weapon && this.state !== 'dead') {
            const swordPos = this.getHandPosition();
            if (this.weapon.specialEffect === 'fire') {
                particleSystem.addFireTrail(swordPos.x + this.direction * 25, swordPos.y - 20, 1);
            } else if (this.weapon.specialEffect === 'shadow') {
                particleSystem.addShadowSmoke(swordPos.x + this.direction * 25, swordPos.y - 20, 1);
            }
        }

        // Física
        if (!this.isGrounded) {
            this.vy += 0.7; // Gravidade
        }

        this.x += this.vx;
        this.y += this.vy;

        // Fricção no chão
        if (this.isGrounded) {
            this.vx *= 0.82;
            if (Math.abs(this.vx) < 0.1) this.vx = 0;
        }

        // Colisão com o solo
        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.vy = 0;
            if (!this.isGrounded) {
                this.isGrounded = true;
                if (this.state === 'jump') {
                    this.state = 'idle';
                    particleSystem.addDust(this.x, this.y, 4, 0);
                }
            }
        }

        // Limites da arena
        const margin = 30;
        if (this.x < margin) {
            this.x = margin;
            this.vx = 0;
        } else if (this.x > arenaWidth - margin) {
            this.x = arenaWidth - margin;
            this.vx = 0;
        }

        // Atualizar rastros fantasmas
        for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
            const g = this.ghostTrails[i];
            g.alpha -= 0.05;
            if (g.alpha <= 0) {
                this.ghostTrails.splice(i, 1);
            }
        }

        // Atualizar projéteis
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.life -= dt;
            if (p.life <= 0 || p.x < 0 || p.x > arenaWidth) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    getHandPosition() {
        return {
            x: this.x + this.direction * 14,
            y: this.y - 42
        };
    }

    // Renderização no Canvas
    render(ctx) {
        ctx.save();

        // Sombra suave no chão
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        const shadowScale = Math.max(0.4, 1 - (this.groundY - this.y) / 150);
        ctx.beginPath();
        ctx.ellipse(this.x, this.groundY, 26 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Renderizar fantasmas de dash
        for (const g of this.ghostTrails) {
            ctx.save();
            ctx.globalAlpha = g.alpha * 0.4;
            this.drawStickmanSkeleton(ctx, g.x, g.y, g.direction, true, g.color);
            ctx.restore();
        }

        // Projéteis sônicos
        for (const p of this.projectiles) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.width, p.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Núcleo branco brilhante
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.width * 0.4, p.height * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Desenhar Stickman Principal
        this.drawStickmanSkeleton(ctx, this.x, this.y, this.direction, false);

        ctx.restore();
    }

    drawStickmanSkeleton(ctx, x, y, dir, isGhost = false, overrideColor = null) {
        ctx.save();

        const mainColor = overrideColor || this.charData.color || '#ffffff';
        const accentColor = this.charData.accentColor || '#00f0ff';

        ctx.strokeStyle = mainColor;
        ctx.fillStyle = mainColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Aura especial para Shadow
        if (this.charId === 'shadow' && !isGhost) {
            ctx.shadowColor = '#c77dff';
            ctx.shadowBlur = 14;
        } else if (!isGhost) {
            ctx.shadowColor = mainColor;
            ctx.shadowBlur = 6;
        }

        // Parâmetros de postura conforme o estado
        let headY = y - 72;
        let hipY = y - 40;
        let torsoAngle = 0;
        let legL_KneeX = x - 6 * dir, legL_KneeY = y - 20, legL_FootX = x - 12 * dir, legL_FootY = y;
        let legR_KneeX = x + 6 * dir, legR_KneeY = y - 20, legR_FootX = x + 12 * dir, legR_FootY = y;
        let armL_ElbowX = x - 8 * dir, armL_ElbowY = y - 48, armL_HandX = x - 14 * dir, armL_HandY = y - 40;
        let armR_ElbowX = x + 10 * dir, armR_ElbowY = y - 48, armR_HandX = x + 16 * dir, armR_HandY = y - 42;
        let swordAngle = 0; // Graus de rotação da espada

        // Animação de caminhada
        if (this.state === 'walk') {
            const walkCycle = Math.sin(this.animTime * 14);
            const bounce = Math.abs(Math.cos(this.animTime * 14)) * 3;
            hipY -= bounce;
            headY -= bounce;
            legL_FootX = x + walkCycle * 16 * dir;
            legR_FootX = x - walkCycle * 16 * dir;
            armL_HandX = x - walkCycle * 14 * dir;
            armR_HandX = x + walkCycle * 14 * dir;
            swordAngle = 20 + walkCycle * 15;
        } else if (this.state === 'jump') {
            legL_KneeY = y - 30;
            legR_KneeY = y - 28;
            legL_FootY = y - 10;
            legR_FootY = y - 8;
            armR_HandY = y - 60;
            armL_HandY = y - 55;
            swordAngle = -45;
        } else if (this.state === 'crouch') {
            headY = y - 48;
            hipY = y - 26;
            legL_KneeX = x - 14 * dir;
            legL_KneeY = y - 10;
            legR_KneeX = x + 12 * dir;
            legR_KneeY = y - 10;
            armR_HandY = y - 25;
            swordAngle = 60;
        } else if (this.state === 'block') {
            torsoAngle = -0.15 * dir;
            armR_ElbowX = x + 12 * dir;
            armR_ElbowY = y - 50;
            armR_HandX = x + 18 * dir;
            armR_HandY = y - 52;
            swordAngle = -80; // Espada erguida na vertical bloqueando

            // Efeito de escudo de energia
            if (!isGhost) {
                ctx.save();
                ctx.strokeStyle = '#00f0ff';
                ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(x + 22 * dir, y - 45, 36, -Math.PI / 2.2, Math.PI / 2.2, dir < 0);
                ctx.stroke();
                ctx.restore();
            }
        } else if (this.state === 'dodge') {
            torsoAngle = 0.45 * dir;
            headY = y - 55;
            hipY = y - 32;
            armR_HandX = x - 15 * dir;
            armR_HandY = y - 30;
            swordAngle = 110;
        } else if (this.state === 'attack1') {
            // Golpe rápido horizontal
            torsoAngle = 0.2 * dir;
            armR_ElbowX = x + 16 * dir;
            armR_ElbowY = y - 52;
            armR_HandX = x + 28 * dir;
            armR_HandY = y - 46;
            swordAngle = 10;
        } else if (this.state === 'attack2') {
            // Golpe diagonal ascendente
            torsoAngle = -0.1 * dir;
            armR_HandX = x + 24 * dir;
            armR_HandY = y - 65;
            swordAngle = -55;
        } else if (this.state === 'attack3') {
            // Giro devastador
            torsoAngle = 0.35 * dir;
            armR_HandX = x + 34 * dir;
            armR_HandY = y - 48;
            swordAngle = 25;
        } else if (this.state === 'heavy') {
            // Golpe aéreo pesado para baixo
            torsoAngle = 0.3 * dir;
            armR_HandX = x + 26 * dir;
            armR_HandY = y - 32;
            swordAngle = 80;
        } else if (this.state === 'special') {
            torsoAngle = -0.2 * dir;
            armR_HandX = x + 30 * dir;
            armR_HandY = y - 50;
            swordAngle = 0;
        } else if (this.state === 'hurt') {
            torsoAngle = -0.35 * dir;
            headY = y - 68;
            armR_HandX = x - 10 * dir;
            armR_HandY = y - 55;
            swordAngle = -100;
        } else if (this.state === 'dead') {
            headY = y - 10;
            hipY = y - 6;
            torsoAngle = 1.5;
            legL_FootX = x - 30;
            legR_FootX = x - 15;
            armR_HandX = x + 20;
            armR_HandY = y - 5;
            swordAngle = 90;
        } else if (this.state === 'win') {
            armR_HandX = x + 8 * dir;
            armR_HandY = y - 85;
            armL_HandX = x - 8 * dir;
            armL_HandY = y - 85;
            swordAngle = -90;
        } else {
            // Idle bobbing
            const idleSine = Math.sin(this.animTime * 4) * 2;
            headY += idleSine;
            hipY += idleSine * 0.5;
            swordAngle = 35 + idleSine * 3;
        }

        // --- DESENHO DO ESQUELETO ---

        // Pernas (trás e frente)
        ctx.beginPath();
        // Perna trás
        ctx.moveTo(x, hipY);
        ctx.lineTo(legL_KneeX, legL_KneeY);
        ctx.lineTo(legL_FootX, legL_FootY);
        // Perna frente
        ctx.moveTo(x, hipY);
        ctx.lineTo(legR_KneeX, legR_KneeY);
        ctx.lineTo(legR_FootX, legR_FootY);
        ctx.stroke();

        // Tronco
        ctx.beginPath();
        ctx.moveTo(x, hipY);
        const shoulderX = x + Math.sin(torsoAngle) * 20;
        const shoulderY = headY + 14;
        ctx.lineTo(shoulderX, shoulderY);
        ctx.stroke();

        // Braço esquerdo (fundo)
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(armL_ElbowX, armL_ElbowY);
        ctx.lineTo(armL_HandX, armL_HandY);
        ctx.stroke();

        // Cabeça
        ctx.beginPath();
        ctx.arc(shoulderX, headY, 11, 0, Math.PI * 2);
        ctx.fill();

        // Detalhes cosméticos por personagem
        if (!isGhost) {
            this.drawCharacterAccessories(ctx, shoulderX, headY, dir, accentColor);
        }

        // Braço direito (frente - empunha a arma)
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(armR_ElbowX, armR_ElbowY);
        ctx.lineTo(armR_HandX, armR_HandY);
        ctx.stroke();

        // Espada empunhada na mão direita
        if (this.weapon && this.state !== 'dead') {
            this.drawWeapon(ctx, armR_HandX, armR_HandY, swordAngle, dir);
        }

        ctx.restore();
    }

    drawCharacterAccessories(ctx, hX, hY, dir, accentColor) {
        ctx.save();

        if (this.charId === 'guerreiro') {
            // Faixa de guerra vermelha na testa
            ctx.fillStyle = '#ff0055';
            ctx.fillRect(hX - 11, hY - 3, 22, 5);
            // Pontas da faixa voando atrás
            ctx.beginPath();
            ctx.moveTo(hX - 10 * dir, hY - 1);
            ctx.lineTo(hX - 22 * dir, hY + 4 + Math.sin(this.animTime * 8) * 3);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ff0055';
            ctx.stroke();
        } else if (this.charId === 'ninja') {
            // Máscara shinobi com cachecol longo esvoaçante
            ctx.fillStyle = '#111827';
            ctx.fillRect(hX - 10, hY + 1, 20, 8);
            // Cachecol longo
            ctx.beginPath();
            ctx.moveTo(hX - 6 * dir, hY + 6);
            ctx.quadraticCurveTo(
                hX - 20 * dir,
                hY + 12 + Math.sin(this.animTime * 10) * 6,
                hX - 35 * dir,
                hY + 6 + Math.cos(this.animTime * 8) * 6
            );
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 4;
            ctx.stroke();
            // Olho brilhante
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(hX + 4 * dir, hY - 1, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.charId === 'samurai') {
            // Chapéu de palha Kasa / Elmo Kabuto
            ctx.fillStyle = '#ffb703';
            ctx.beginPath();
            ctx.moveTo(hX - 18, hY - 4);
            ctx.lineTo(hX, hY - 16);
            ctx.lineTo(hX + 18, hY - 4);
            ctx.closePath();
            ctx.fill();
            // Ornamento dourado
            ctx.strokeStyle = '#d62828';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.charId === 'shadow') {
            // Olhos cósmicos roxos cintilantes
            ctx.fillStyle = '#c77dff';
            ctx.shadowColor = '#c77dff';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(hX + 4 * dir, hY - 1, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Stickman padrão: olho cibernético sutil
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(hX + 4 * dir, hY - 1, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawWeapon(ctx, hX, hY, angleDeg, dir) {
        ctx.save();
        ctx.translate(hX, hY);

        const rad = (angleDeg * Math.PI) / 180;
        ctx.rotate(dir > 0 ? rad : -rad);

        const w = this.weapon;
        const bladeLen = w.bladeLength || 45;
        const bladeW = w.bladeWidth || 4;

        // Cabo / Empunhadura
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8 * dir, 6);
        ctx.stroke();

        // Guarda / Tsuba
        ctx.strokeStyle = w.glowColor || '#ffd700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-4, -6);
        ctx.lineTo(-4, 6);
        ctx.stroke();

        // Lâmina
        ctx.strokeStyle = w.color;
        ctx.lineWidth = bladeW;
        ctx.shadowColor = w.glowColor;
        ctx.shadowBlur = w.specialEffect ? 12 : 6;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(bladeLen * dir, -bladeLen * 0.2);
        ctx.stroke();

        // Fio brilhante / Detalhe na lâmina
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, bladeW * 0.35);
        ctx.beginPath();
        ctx.moveTo(4 * dir, -1);
        ctx.lineTo((bladeLen - 4) * dir, -bladeLen * 0.2);
        ctx.stroke();

        ctx.restore();
    }
}
