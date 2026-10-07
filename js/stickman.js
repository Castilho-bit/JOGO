/**
 * Classe Fighter - Renderizador de Stickman Procedural, Física e Habilidades Únicas
 * Desenha stickmen diretamente no Canvas com proporções anatômicas, animações fluidas,
 * acessórios visuais para cada personagem, golpes exclusivos, sistema de defesa ativa (Parry)
 * e efeitos especiais de combate.
 */

class Fighter {
    constructor(config = {}) {
        this.isPlayer = config.isPlayer || false;
        this.name = config.name || 'Stickman';
        this.charId = config.charId || 'stickman';
        this.charData = CHARACTERS_DATA[this.charId] || CHARACTERS_DATA.stickman;

        this.x = config.x || 200;
        this.y = config.y || 440; // Posição do pé no chão
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

        // Atualizar com bônus de itens e armas
        this.recalculateStats();

        // Estados de animação e combate
        this.state = 'idle'; // idle, walk, jump, crouch, attack1, attack2, attack3, heavy, block, dodge, special, hurt, dead, win
        this.stateTimer = 0;
        this.animTime = 0;
        this.isGrounded = true;
        this.isCrouching = false;
        this.isBlocking = false;
        this.blockStartTime = 0;
        this.isInvulnerable = false;
        this.isSuperArmor = false;
        this.canCombo = false;
        this.comboChain = 0;
        this.attackHitChecked = false;

        // Status especiais
        this.poisonTimer = 0;
        this.poisonTickTimer = 0;
        this.poisonDmgPerSec = 0;

        // Dimensões do corpo
        this.height = 80;
        this.width = 30;
        this.groundY = 440;

        // Rastro de dash / sombra
        this.ghostTrails = [];

        // Projéteis e habilidades em voo
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

        // Somar itens equipados
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

    applyPoison(duration = 2.5, dmgPerSec = 6) {
        this.poisonTimer = Math.max(this.poisonTimer, duration);
        this.poisonDmgPerSec = dmgPerSec;
        this.poisonTickTimer = 0.5;
        particleSystem.addFloatingText('VENENO!', this.x, this.y - 75, { color: '#38b000', fontSize: 16 });
    }

    // Ações de combate
    move(dir) {
        if (this.state === 'dead' || this.state === 'hurt' || this.isBlocking || this.state === 'special' || this.state.startsWith('attack') || this.state === 'heavy') {
            return;
        }
        if (this.isCrouching) {
            this.vx = dir * (this.speed * 0.45);
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
        if (isDown && this.isGrounded && !this.state.startsWith('attack') && this.state !== 'special') {
            this.state = 'crouch';
        } else if (!isDown && this.state === 'crouch') {
            this.state = 'idle';
        }
    }

    block(isGuard) {
        if (this.state === 'dead' || this.state === 'hurt') return;

        if (isGuard && !this.isBlocking) {
            this.blockStartTime = performance.now() / 1000;
        }

        this.isBlocking = isGuard;
        if (isGuard && this.isGrounded) {
            this.state = 'block';
            this.vx = 0;
        } else if (!isGuard && this.state === 'block') {
            this.state = 'idle';
        }
    }

    stagger(duration = 0.6) {
        this.state = 'hurt';
        this.stateTimer = duration;
        this.vx = -this.direction * 5;
        this.vy = -2;
        this.isGrounded = false;
    }

    dodge() {
        if (this.state === 'dead' || this.state === 'dodge' || this.energy < 20) return;
        this.energy = Math.max(0, this.energy - 20);
        this.state = 'dodge';

        // Bônus do Manto Espectral
        const hasSpectralCape = this.equippedItems && this.equippedItems.includes('manto_fantasma');
        this.stateTimer = hasSpectralCape ? 0.36 : 0.28;
        this.isInvulnerable = true;
        const speedMult = hasSpectralCape ? 2.8 : 2.4;
        this.vx = this.direction * (this.speed * speedMult);

        audioSystem.playDodge();
        particleSystem.addDust(this.x, this.y, 8, this.direction);
    }

    attackLight() {
        if (this.state === 'dead' || this.state === 'hurt' || this.state === 'dodge' || this.isBlocking) return false;

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
        this.vx = this.direction * 4.5;

        // Titã Mecha tem super armor em ataque pesado
        if (this.charId === 'colossus') {
            this.isSuperArmor = true;
        }

        audioSystem.playSword();
        return true;
    }

    // ==========================================
    // HABILIDADES ESPECIAIS ÚNICAS POR PERSONAGEM
    // ==========================================
    useSpecial() {
        if (this.state === 'dead' || this.state === 'hurt' || this.state === 'dodge' || this.state === 'special') return false;
        if (this.energy < 75) return false;

        this.energy -= 75;

        switch (this.charId) {
            case 'guerreiro':
                return this.specialGuerreiro();
            case 'ninja':
                return this.specialNinja();
            case 'samurai':
                return this.specialSamurai();
            case 'mago':
                return this.specialMago();
            case 'valquiria':
                return this.specialValquiria();
            case 'colossus':
                return this.specialColossus();
            case 'shadow':
                return this.specialShadow();
            case 'chronos':
                return this.specialChronos();
            case 'stickman':
            default:
                return this.specialStickman();
        }
    }

    // 1. Stickman: Corte Sônico Cruzado (X-Slash)
    specialStickman() {
        this.state = 'special';
        this.stateTimer = 0.60;
        this.attackHitChecked = false;
        this.vx = this.direction * 2;
        this.vy = -5;
        this.isGrounded = false;
        audioSystem.playSpecial();

        setTimeout(() => {
            if (this.state === 'dead') return;
            // Projétil superior
            this.projectiles.push({
                type: 'sonic_cross',
                x: this.x + this.direction * 35,
                y: this.y - 50,
                vx: this.direction * 15,
                vy: -1.5,
                width: 32,
                height: 50,
                angle: 45,
                color: '#00f0ff',
                damage: Math.round(this.damage * 1.5),
                life: 1.1,
                owner: this
            });
            // Projétil inferior
            this.projectiles.push({
                type: 'sonic_cross',
                x: this.x + this.direction * 35,
                y: this.y - 40,
                vx: this.direction * 15,
                vy: 1.5,
                width: 32,
                height: 50,
                angle: -45,
                color: '#00f0ff',
                damage: Math.round(this.damage * 1.5),
                life: 1.1,
                owner: this
            });
            particleSystem.triggerShake(7, 0.25);
            particleSystem.addSpark(this.x + this.direction * 30, this.y - 45, 15, '#00f0ff', 6);
        }, 180);

        return true;
    }

    // 2. Guerreiro: Fúria Sísmica (Earth Slam)
    specialGuerreiro() {
        this.state = 'special';
        this.stateTimer = 0.70;
        this.attackHitChecked = false;
        this.vx = this.direction * 3;
        this.vy = -8;
        this.isGrounded = false;
        audioSystem.playSpecial();

        setTimeout(() => {
            if (this.state === 'dead') return;
            audioSystem.playSlam();
            particleSystem.triggerShake(10, 0.35);
            particleSystem.addShockwave(this.x + this.direction * 25, this.groundY, 110, '#ff3344', 6);
            particleSystem.addRockDebris(this.x + this.direction * 25, this.groundY, 12);

            // Onda de choque terrestre que corre pelo chão
            this.projectiles.push({
                type: 'earth_wave',
                x: this.x + this.direction * 30,
                y: this.groundY - 20,
                vx: this.direction * 13,
                vy: 0,
                width: 45,
                height: 45,
                color: '#ff3344',
                damage: Math.round(this.damage * 1.8),
                life: 0.9,
                owner: this
            });
        }, 250);

        return true;
    }

    // 3. Ninja: Dança Shinobi (Shurikens & Clone)
    specialNinja() {
        this.state = 'special';
        this.stateTimer = 0.55;
        this.attackHitChecked = false;
        audioSystem.playDodge();

        // Fumaça de substituição
        particleSystem.addShadowSmoke(this.x, this.y - 40, 12);
        this.x += this.direction * 60; // Arrancada rápida para reposicionar
        this.vx = 0;

        setTimeout(() => {
            if (this.state === 'dead') return;
            audioSystem.playSword();
            // Disparar 3 shurikens em leque
            const angles = [-3, 0, 3];
            angles.forEach(vy => {
                this.projectiles.push({
                    type: 'shuriken',
                    x: this.x + this.direction * 30,
                    y: this.y - 45,
                    vx: this.direction * 16,
                    vy: vy,
                    width: 22,
                    height: 22,
                    rotation: 0,
                    color: '#00e5ff',
                    damage: Math.round(this.damage * 0.9),
                    life: 1.0,
                    owner: this
                });
            });
            particleSystem.triggerShake(5, 0.2);
        }, 140);

        return true;
    }

    // 4. Samurai: Iaijutsu: Corte Dimensional
    specialSamurai() {
        this.state = 'special';
        this.stateTimer = 0.70;
        this.attackHitChecked = false;
        this.vx = 0;

        // Aura de concentração com som de lâmina embainhada
        audioSystem.playSword();
        particleSystem.addSpark(this.x, this.y - 40, 10, '#ffd166', 4);

        setTimeout(() => {
            if (this.state === 'dead') return;
            audioSystem.playCritical();
            particleSystem.triggerHitStop(0.08);
            particleSystem.triggerShake(9, 0.3);

            // Teleporte de corte rápido cruzando a tela
            const startX = this.x;
            this.x += this.direction * 220;
            this.vx = 0;

            // Arcos de corte dimensional ao longo do caminho
            for (let i = 0; i < 4; i++) {
                const cutX = startX + this.direction * (50 + i * 45);
                particleSystem.addSlashArc(cutX, this.y - 45, 35, 0, Math.PI * 2, '#ffb703', 4);
                particleSystem.addSpark(cutX, this.y - 45, 8, '#ffffff', 5);
            }

            // Projétil invisível de corte de tela para registrar colisão
            this.projectiles.push({
                type: 'dimension_cut',
                x: startX + this.direction * 110,
                y: this.y - 45,
                vx: this.direction * 6,
                vy: 0,
                width: 140,
                height: 70,
                color: '#ffb703',
                damage: Math.round(this.damage * 2.0),
                life: 0.25,
                owner: this
            });
        }, 220);

        return true;
    }

    // 5. Arcano (Mago): Tempestade de Plasma
    specialMago() {
        this.state = 'special';
        this.stateTimer = 0.75;
        this.attackHitChecked = false;
        this.vy = -4; // Levita levemente
        this.vx = 0;
        audioSystem.playThunder();

        setTimeout(() => {
            if (this.state === 'dead') return;
            particleSystem.triggerShake(7, 0.25);
            particleSystem.addShockwave(this.x, this.y - 45, 60, '#7209b7', 4);

            // 3 Orbes elétricos arcanos
            const orbHeights = [-18, 0, 18];
            orbHeights.forEach(offsetY => {
                this.projectiles.push({
                    type: 'plasma_orb',
                    x: this.x + this.direction * 35,
                    y: this.y - 45 + offsetY,
                    vx: this.direction * 13,
                    vy: offsetY * 0.08,
                    width: 24,
                    height: 24,
                    color: '#4cc9f0',
                    damage: Math.round(this.damage * 1.1),
                    life: 1.2,
                    owner: this
                });
            });
        }, 200);

        return true;
    }

    // 6. Valkyria: Mergulho Radiante (Lança da Luz)
    specialValquiria() {
        this.state = 'special';
        this.stateTimer = 0.85;
        this.attackHitChecked = false;
        this.vy = -16; // Alça voo para o topo da arena
        this.vx = this.direction * 3;
        this.isGrounded = false;
        audioSystem.playSpecial();

        setTimeout(() => {
            if (this.state === 'dead') return;
            // Mergulho em diagonal como raio solar
            this.vx = this.direction * 18;
            this.vy = 22;

            setTimeout(() => {
                if (this.state === 'dead') return;
                audioSystem.playThunder();
                particleSystem.triggerShake(10, 0.35);
                particleSystem.addShockwave(this.x, this.groundY, 130, '#ffe600', 6);
                particleSystem.addLightning(this.x, 0, this.x, this.groundY, '#ffe600');

                this.projectiles.push({
                    type: 'radiant_burst',
                    x: this.x + this.direction * 20,
                    y: this.groundY - 40,
                    vx: this.direction * 4,
                    vy: 0,
                    width: 90,
                    height: 80,
                    color: '#fee440',
                    damage: Math.round(this.damage * 2.1),
                    life: 0.3,
                    owner: this
                });
            }, 180);
        }, 220);

        return true;
    }

    // 7. Titã Goliath: Propulsão a Jato & Soco Demolidor
    specialColossus() {
        this.state = 'special';
        this.stateTimer = 0.70;
        this.attackHitChecked = false;
        this.isSuperArmor = true; // Super armadura inquebrável
        audioSystem.playSlam();

        // Chamas de foguete nas costas
        particleSystem.addFireTrail(this.x - this.direction * 20, this.y - 45, 8);
        this.vx = this.direction * 18; // Arrancada devastadora

        setTimeout(() => {
            if (this.state === 'dead') return;
            audioSystem.playImpact(true);
            particleSystem.triggerShake(9, 0.3);
            particleSystem.addShockwave(this.x + this.direction * 35, this.y - 45, 85, '#4361ee', 5);

            this.projectiles.push({
                type: 'kinetic_fist',
                x: this.x + this.direction * 30,
                y: this.y - 45,
                vx: this.direction * 8,
                vy: 0,
                width: 70,
                height: 60,
                color: '#ff0055',
                damage: Math.round(this.damage * 2.2),
                life: 0.35,
                owner: this
            });
        }, 160);

        return true;
    }

    // 8. Shadow: Vórtice da Singularidade (Buraco Negro)
    specialShadow() {
        this.state = 'special';
        this.stateTimer = 0.75;
        this.attackHitChecked = false;
        this.vx = 0;
        audioSystem.playTimeWarp();

        setTimeout(() => {
            if (this.state === 'dead') return;
            particleSystem.triggerShake(8, 0.3);
            particleSystem.addShadowSmoke(this.x + this.direction * 120, this.y - 45, 15);

            // Projétil gravitacional que suga o adversário
            this.projectiles.push({
                type: 'vortex',
                x: this.x + this.direction * 130,
                y: this.y - 45,
                vx: 0,
                vy: 0,
                width: 70,
                height: 70,
                color: '#c77dff',
                damage: Math.round(this.damage * 2.0),
                life: 1.4,
                owner: this
            });
        }, 180);

        return true;
    }

    // 9. Chronos: Distorção Temporal do Infinito (Personagem Secreto)
    specialChronos() {
        this.state = 'special';
        this.stateTimer = 0.90;
        this.attackHitChecked = false;
        this.vx = 0;
        audioSystem.playTimeWarp();
        particleSystem.triggerHitStop(0.12);
        particleSystem.triggerShake(10, 0.4);

        // Cúpula cósmica dourada e púrpura
        particleSystem.addShockwave(this.x, this.y - 45, 140, '#ffe600', 5);

        setTimeout(() => {
            if (this.state === 'dead') return;
            audioSystem.playCritical();

            // 3 Lâminas estelares prismáticas que cortam em trajetória estelar
            const starAngles = [-25, 0, 25];
            starAngles.forEach(deg => {
                const rad = (deg * Math.PI) / 180;
                this.projectiles.push({
                    type: 'chronos_blade',
                    x: this.x + this.direction * 40,
                    y: this.y - 45,
                    vx: Math.cos(rad) * this.direction * 16,
                    vy: Math.sin(rad) * 16,
                    width: 40,
                    height: 60,
                    color: '#ffd700',
                    damage: Math.round(this.damage * 2.4),
                    life: 1.2,
                    owner: this
                });
            });
        }, 220);

        return true;
    }

    takeDamage(amount, isCrit = false, attacker = null, attackType = 'normal') {
        if (this.state === 'dead' || this.isInvulnerable) return 0;

        let finalDmg = amount;

        // Redução por atributo base de defesa
        const defFactor = 100 / (100 + this.defense);
        finalDmg = Math.max(1, Math.round(finalDmg * defFactor));

        // ==========================================
        // SISTEMA DE DEFESA ATIVA (BLOQUEIO & PARRY)
        // ==========================================
        if (this.isBlocking) {
            const blockDuration = (performance.now() / 1000) - this.blockStartTime;

            // PARRY PERFEITO (Janela precisa de 0.24 segundos após ativar o bloqueio)
            if (blockDuration <= 0.24) {
                audioSystem.playParry();
                this.energy = Math.min(this.maxEnergy, this.energy + 28); // Recompensa de energia
                particleSystem.addShockwave(this.x + this.direction * 20, this.y - 45, 95, '#00f0ff', 6);
                particleSystem.addSpark(this.x + this.direction * 20, this.y - 45, 22, '#ffd700', 8);
                particleSystem.triggerShake(7, 0.22);
                particleSystem.triggerHitStop(0.08);
                particleSystem.addFloatingText('🛡️ PARRY PERFEITO!', this.x, this.y - 95, {
                    color: '#00f0ff',
                    fontSize: 24,
                    fontWeight: '900'
                });

                // Atordoa e desestabiliza o agressor se ele não possuir super armadura
                if (attacker && !attacker.isSuperArmor) {
                    attacker.stagger(0.70);
                    particleSystem.addFloatingText('DESESTABILIZADO!', attacker.x, attacker.y - 80, {
                        color: '#ffd166',
                        fontSize: 16
                    });
                }
                return 0; // ZERO dano tomado no Parry Perfeito!
            }

            // BLOQUEIO PADRÃO (Fora da janela de parry)
            let absorbPct = 0.85; // 85% de redução padrão (muito mais recompensador!)
            let isChip = false;

            // Ataques especiais ou chefes causam dano parcial de penetração (Chip Damage)
            if (attackType === 'special' || attackType === 'boss_heavy') {
                absorbPct = 0.65; // 35% de dano passa através do bloqueio
                isChip = true;
            }

            finalDmg = Math.max(1, Math.round(finalDmg * (1 - absorbPct)));
            audioSystem.playDefense();
            particleSystem.addSpark(this.x + this.direction * 15, this.y - 45, 14, '#00f0ff', 6);

            if (isChip) {
                particleSystem.addFloatingText(`GUARDA PERFURADA (-${finalDmg})`, this.x, this.y - 85, { color: '#ff9900', fontSize: 16 });
            } else {
                particleSystem.addFloatingText('BLOQUEADO!', this.x, this.y - 85, { color: '#00f0ff', fontSize: 16 });
            }

            // Efeito do Item: Broquel Espinhoso (Reflete 25% de volta ao agressor)
            if (this.equippedItems && this.equippedItems.includes('broquel_espinhos') && attacker) {
                const thornsDmg = Math.max(1, Math.round(amount * 0.25));
                attacker.takeDamage(thornsDmg, false, this, 'thorns');
                particleSystem.addFloatingText(`ESPINHOS -${thornsDmg}`, attacker.x, attacker.y - 75, { color: '#00f0ff', fontSize: 14 });
            }

            this.vx = -this.direction * 3;
            this.hp = Math.max(0, this.hp - finalDmg);
            if (this.hp <= 0) this.die();
            return finalDmg;
        }

        // ==========================================
        // GOLPE RECEBIDO SEM BLOQUEIO
        // ==========================================
        if (this.isSuperArmor && this.state !== 'dead') {
            this.hp = Math.max(0, this.hp - finalDmg);
            particleSystem.addFloatingText(`-${finalDmg} (ARMADURA)`, this.x, this.y - 80, { color: '#ff0055', fontSize: 18 });
            particleSystem.addSpark(this.x, this.y - 45, 10, '#ffffff', 4);
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

    getHurtbox() {
        const h = this.isCrouching ? this.height * 0.6 : this.height;
        return {
            x: this.x - this.width / 2,
            y: this.y - h,
            w: this.width,
            h: h
        };
    }

    getHitbox() {
        if (!this.state.startsWith('attack') && this.state !== 'heavy' && this.state !== 'special') {
            return null;
        }

        let reach = 50;
        let h = 40;
        let yOffset = 50;

        if (this.weapon) {
            reach += (this.weapon.bladeLength || 45) * 0.45;
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
            reach += 35;
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

        // Dano de veneno contínuo
        if (this.poisonTimer > 0 && this.state !== 'dead') {
            this.poisonTimer -= dt;
            this.poisonTickTimer -= dt;
            if (Math.random() < 0.4) {
                particleSystem.addPoisonBubbles(this.x, this.y - 40, 1);
            }
            if (this.poisonTickTimer <= 0) {
                this.poisonTickTimer = 0.5;
                const pDmg = Math.max(1, Math.round(this.poisonDmgPerSec * 0.5));
                this.hp = Math.max(0, this.hp - pDmg);
                particleSystem.addFloatingText(`-${pDmg}`, this.x, this.y - 65, { color: '#70e000', fontSize: 15 });
                if (this.hp <= 0) this.die();
            }
        }

        // Regeneração passiva de energia
        if (this.state !== 'dead') {
            let regenRate = 18;
            if (this.isBlocking) regenRate = 5;
            if (this.charId === 'ninja') regenRate = 28;
            if (this.charId === 'mago') regenRate = 30;

            // Bônus do item Reator Cinético (+45%)
            if (this.equippedItems && this.equippedItems.includes('reator_cinetico')) {
                regenRate *= 1.45;
            }

            this.energy = Math.min(this.maxEnergy, this.energy + regenRate * dt);
        }

        // Timer de estado
        if (this.stateTimer > 0) {
            this.stateTimer -= dt;

            if (this.state === 'attack1' && this.stateTimer < 0.12) this.canCombo = true;
            if (this.state === 'attack2' && this.stateTimer < 0.15) this.canCombo = true;

            // Rastro fantasma durante o dodge ou Chronos
            if (this.state === 'dodge' || this.charId === 'chronos') {
                if (Math.random() < 0.45) {
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
                if (this.state === 'special' || this.state === 'heavy') {
                    this.isSuperArmor = false;
                }
                if (this.state !== 'dead' && this.state !== 'win') {
                    this.state = this.isCrouching ? 'crouch' : 'idle';
                    this.canCombo = false;
                    this.attackHitChecked = false;
                }
            }
        }

        // Efeitos visuais contínuos da arma
        if (this.weapon && this.state !== 'dead') {
            const swordPos = this.getHandPosition();
            if (this.weapon.specialEffect === 'fire') {
                particleSystem.addFireTrail(swordPos.x + this.direction * 25, swordPos.y - 20, 1);
            } else if (this.weapon.specialEffect === 'shadow') {
                particleSystem.addShadowSmoke(swordPos.x + this.direction * 25, swordPos.y - 20, 1);
            } else if (this.weapon.specialEffect === 'poison') {
                particleSystem.addPoisonBubbles(swordPos.x + this.direction * 20, swordPos.y - 15, 1);
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
            p.y += p.vy;
            p.life -= dt;

            // Rastro de projétil
            if (p.type === 'plasma_orb' && Math.random() < 0.3) {
                particleSystem.addSpark(p.x, p.y, 2, '#4cc9f0', 2);
            }

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

        // Renderizar projéteis
        for (const p of this.projectiles) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 15;

            if (p.type === 'shuriken') {
                // Shuriken giratória
                p.rotation = (p.rotation || 0) + 0.35;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillRect(-p.width / 2, -p.height / 6, p.width, p.height / 3);
                ctx.fillRect(-p.height / 6, -p.width / 2, p.height / 3, p.width);
            } else if (p.type === 'vortex') {
                // Vórtice gravitacional pulsante
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.width / 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(199, 125, 255, 0.4)';
                ctx.fill();
                ctx.strokeStyle = '#c77dff';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else if (p.type === 'earth_wave') {
                // Onda de terra pontiaguda
                ctx.beginPath();
                ctx.moveTo(p.x - p.width / 2, p.y + p.height / 2);
                ctx.lineTo(p.x, p.y - p.height / 2);
                ctx.lineTo(p.x + p.width / 2, p.y + p.height / 2);
                ctx.closePath();
                ctx.fill();
            } else {
                // Projéteis sônicos e lâminas estelares
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.width, p.height / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.width * 0.4, p.height * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
            }

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

        // Auras especiais por personagem
        if (!isGhost) {
            if (this.charId === 'shadow') {
                ctx.shadowColor = '#c77dff';
                ctx.shadowBlur = 16;
            } else if (this.charId === 'chronos') {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 18;
            } else if (this.charId === 'valquiria') {
                ctx.shadowColor = '#f72585';
                ctx.shadowBlur = 12;
            } else {
                ctx.shadowColor = mainColor;
                ctx.shadowBlur = 6;
            }
        }

        // Parâmetros de postura
        let headY = y - 72;
        let hipY = y - 40;
        let torsoAngle = 0;
        let legL_KneeX = x - 6 * dir, legL_KneeY = y - 20, legL_FootX = x - 12 * dir, legL_FootY = y;
        let legR_KneeX = x + 6 * dir, legR_KneeY = y - 20, legR_FootX = x + 12 * dir, legR_FootY = y;
        let armL_ElbowX = x - 8 * dir, armL_ElbowY = y - 48, armL_HandX = x - 14 * dir, armL_HandY = y - 40;
        let armR_ElbowX = x + 10 * dir, armR_ElbowY = y - 48, armR_HandX = x + 16 * dir, armR_HandY = y - 42;
        let swordAngle = 0;

        // Posturas conforme o estado
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
            swordAngle = -80; // Espada erguida na vertical

            // Efeito de cúpula de escudo energético
            if (!isGhost) {
                ctx.save();
                ctx.strokeStyle = '#00f0ff';
                ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(x + 22 * dir, y - 45, 38, -Math.PI / 2.2, Math.PI / 2.2, dir < 0);
                ctx.stroke();
                ctx.fill();
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
            torsoAngle = 0.2 * dir;
            armR_HandX = x + 28 * dir;
            armR_HandY = y - 46;
            swordAngle = 10;
        } else if (this.state === 'attack2') {
            torsoAngle = -0.1 * dir;
            armR_HandX = x + 24 * dir;
            armR_HandY = y - 65;
            swordAngle = -55;
        } else if (this.state === 'attack3') {
            torsoAngle = 0.35 * dir;
            armR_HandX = x + 34 * dir;
            armR_HandY = y - 48;
            swordAngle = 25;
        } else if (this.state === 'heavy') {
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
            // Idle suave
            const idleSine = Math.sin(this.animTime * 4) * 2;
            headY += idleSine;
            hipY += idleSine * 0.5;
            swordAngle = 35 + idleSine * 3;
        }

        // Pernas
        ctx.beginPath();
        ctx.moveTo(x, hipY);
        ctx.lineTo(legL_KneeX, legL_KneeY);
        ctx.lineTo(legL_FootX, legL_FootY);
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

        // Braço esquerdo
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(armL_ElbowX, armL_ElbowY);
        ctx.lineTo(armL_HandX, armL_HandY);
        ctx.stroke();

        // Cabeça
        ctx.beginPath();
        ctx.arc(shoulderX, headY, 11, 0, Math.PI * 2);
        ctx.fill();

        // Acessórios estéticos únicos por personagem
        if (!isGhost) {
            this.drawCharacterAccessories(ctx, shoulderX, headY, dir, accentColor);
        }

        // Braço direito
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
            // Faixa de guerra vermelha com pontas ao vento
            ctx.fillStyle = '#ff0055';
            ctx.fillRect(hX - 11, hY - 3, 22, 5);
            ctx.beginPath();
            ctx.moveTo(hX - 10 * dir, hY - 1);
            ctx.lineTo(hX - 22 * dir, hY + 4 + Math.sin(this.animTime * 8) * 3);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ff0055';
            ctx.stroke();
        } else if (this.charId === 'ninja') {
            // Máscara shinobi e cachecol longo
            ctx.fillStyle = '#111827';
            ctx.fillRect(hX - 10, hY + 1, 20, 8);
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
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(hX + 4 * dir, hY - 1, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.charId === 'samurai') {
            // Chapéu Kasa cônico / Kabuto
            ctx.fillStyle = '#ffb703';
            ctx.beginPath();
            ctx.moveTo(hX - 18, hY - 4);
            ctx.lineTo(hX, hY - 16);
            ctx.lineTo(hX + 18, hY - 4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#d62828';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.charId === 'mago') {
            // Capuz arcano e runas orbitando
            ctx.fillStyle = '#7209b7';
            ctx.beginPath();
            ctx.moveTo(hX - 12, hY - 2);
            ctx.lineTo(hX, hY - 18);
            ctx.lineTo(hX + 12, hY - 2);
            ctx.closePath();
            ctx.fill();

            // 3 Orbes arcanos orbitando a cabeça
            for (let i = 0; i < 3; i++) {
                const orbAngle = this.animTime * 4 + (i * Math.PI * 2) / 3;
                const orbX = hX + Math.cos(orbAngle) * 18;
                const orbY = hY + Math.sin(orbAngle) * 10;
                ctx.fillStyle = '#4cc9f0';
                ctx.beginPath();
                ctx.arc(orbX, orbY, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (this.charId === 'valquiria') {
            // Asas holográficas radiantes batendo nas costas
            const wingFlap = Math.sin(this.animTime * 8) * 6;
            ctx.strokeStyle = '#fee440';
            ctx.fillStyle = 'rgba(247, 37, 133, 0.35)';
            ctx.lineWidth = 2.5;

            // Asa esquerda
            ctx.beginPath();
            ctx.moveTo(hX - 4 * dir, hY + 10);
            ctx.quadraticCurveTo(hX - 25 * dir, hY - 15 + wingFlap, hX - 35 * dir, hY + 5 + wingFlap);
            ctx.lineTo(hX - 8 * dir, hY + 16);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Diadema alado
            ctx.fillStyle = '#fee440';
            ctx.fillRect(hX - 8, hY - 10, 16, 4);
        } else if (this.charId === 'colossus') {
            // Ombreiras mecha reforçadas e visor com laser vermelho
            ctx.fillStyle = '#4361ee';
            ctx.fillRect(hX - 14 * dir, hY + 10, 12, 10);
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 2;
            ctx.strokeRect(hX - 14 * dir, hY + 10, 12, 10);

            // Visor vermelho
            ctx.fillStyle = '#ff0055';
            ctx.fillRect(hX + 2 * dir, hY - 2, 7, 3);
        } else if (this.charId === 'shadow') {
            // Olhos violeta cósmicos
            ctx.fillStyle = '#c77dff';
            ctx.shadowColor = '#c77dff';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(hX + 4 * dir, hY - 1, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.charId === 'chronos') {
            // Auréola cósmica de relógio celestial
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(hX, hY - 4, 18, 0, Math.PI * 2);
            ctx.stroke();

            // Ponteiros girando
            const ptrAngle = this.animTime * 3;
            ctx.beginPath();
            ctx.moveTo(hX, hY - 4);
            ctx.lineTo(hX + Math.cos(ptrAngle) * 14, hY - 4 + Math.sin(ptrAngle) * 14);
            ctx.stroke();

            // Olhos de constelação dourados
            ctx.fillStyle = '#ffffff';
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

        if (w.type === 'daggers') {
            // Adagas duplas curtas
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-6 * dir, 4);
            ctx.stroke();

            ctx.strokeStyle = w.color;
            ctx.lineWidth = bladeW;
            ctx.shadowColor = w.glowColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(bladeLen * dir, -bladeLen * 0.15);
            ctx.stroke();
        } else if (w.type === 'spear') {
            // Lança de longo alcance
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(-18 * dir, 6);
            ctx.lineTo(bladeLen * 0.7 * dir, -bladeLen * 0.1);
            ctx.stroke();

            // Ponta de plasma afiada
            ctx.strokeStyle = w.color;
            ctx.lineWidth = bladeW * 1.5;
            ctx.shadowColor = w.glowColor;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(bladeLen * 0.7 * dir, -bladeLen * 0.1);
            ctx.lineTo(bladeLen * dir, -bladeLen * 0.15);
            ctx.stroke();
        } else if (w.type === 'hammer') {
            // Martelo de guerra pesado
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-10 * dir, 8);
            ctx.lineTo(bladeLen * 0.8 * dir, -bladeLen * 0.15);
            ctx.stroke();

            // Cabeça maciça retangular do martelo
            ctx.fillStyle = w.color;
            ctx.strokeStyle = w.glowColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = w.glowColor;
            ctx.shadowBlur = 10;
            ctx.fillRect(bladeLen * 0.75 * dir - 8, -bladeLen * 0.15 - 14, 18, 28);
            ctx.strokeRect(bladeLen * 0.75 * dir - 8, -bladeLen * 0.15 - 14, 18, 28);
        } else if (w.type === 'scythe') {
            // Foice curva
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-14 * dir, 10);
            ctx.lineTo(bladeLen * 0.8 * dir, -bladeLen * 0.2);
            ctx.stroke();

            // Lâmina curvada para baixo
            ctx.strokeStyle = w.color;
            ctx.lineWidth = bladeW;
            ctx.shadowColor = w.glowColor;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(bladeLen * 0.8 * dir, -bladeLen * 0.2);
            ctx.quadraticCurveTo(
                (bladeLen + 15) * dir,
                -bladeLen * 0.5,
                (bladeLen - 5) * dir,
                -bladeLen * 0.7
            );
            ctx.stroke();
        } else {
            // Espadas padrão (Madeira, Ferro, Katana, Flamejante, Sombria, Cronos)
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-8 * dir, 6);
            ctx.stroke();

            // Guarda
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
            ctx.shadowBlur = w.specialEffect ? 14 : 6;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(bladeLen * dir, -bladeLen * 0.2);
            ctx.stroke();

            // Fio brilhante
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1, bladeW * 0.35);
            ctx.beginPath();
            ctx.moveTo(4 * dir, -1);
            ctx.lineTo((bladeLen - 4) * dir, -bladeLen * 0.2);
            ctx.stroke();
        }

        ctx.restore();
    }
}
