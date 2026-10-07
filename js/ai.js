/**
 * Sistema de Inteligência Artificial para Inimigos e Bosses Exclusivos
 * Controla os movimentos, ataques, combos, bloqueios, parries, esquivas e mecânicas específicas de cada Boss.
 * Suporta modos de dificuldade, treinamento e comportamentos táticos por arquétipo de chefão.
 */

class EnemyAI {
    constructor(difficulty = 'normal') {
        this.difficulty = difficulty; // 'easy', 'medium', 'hard', 'insane', 'treino_parado'
        this.bossType = 'standard'; // 'standard', 'muralha', 'ninja', 'ronin', 'valquiria', 'colossus', 'shadow', 'chronos'
        this.actionCooldown = 0;
        this.reactionTimer = 0;
        this.currentPlan = 'idle';
        this.planTimer = 0;
        this.comboStep = 0;
        this.bossOverdriveActive = false;
    }

    setDifficulty(diff, bossType = 'standard') {
        this.difficulty = diff || 'medium';
        this.bossType = bossType || 'standard';
        this.actionCooldown = 0;
        this.planTimer = 0;
        this.bossOverdriveActive = false;
    }

    getSettings() {
        switch (this.difficulty.toLowerCase()) {
            case 'easy':
            case 'facil':
                return {
                    reactionTime: 0.32,
                    attackChance: 0.55,
                    blockChance: 0.28,
                    dodgeChance: 0.20,
                    specialChance: 0.30,
                    retreatHpThreshold: 0.20,
                    comboSkill: 1
                };
            case 'hard':
            case 'dificil':
                return {
                    reactionTime: 0.10,
                    attackChance: 0.85,
                    blockChance: 0.72,
                    dodgeChance: 0.55,
                    specialChance: 0.75,
                    retreatHpThreshold: 0.35,
                    comboSkill: 3
                };
            case 'insane':
            case 'insano':
                return {
                    reactionTime: 0.05,
                    attackChance: 0.95,
                    blockChance: 0.86,
                    dodgeChance: 0.75,
                    specialChance: 0.90,
                    retreatHpThreshold: 0.40,
                    comboSkill: 3
                };
            case 'treino_parado':
                return {
                    reactionTime: 999,
                    attackChance: 0,
                    blockChance: 0,
                    dodgeChance: 0,
                    specialChance: 0,
                    retreatHpThreshold: 0,
                    comboSkill: 0
                };
            case 'medium':
            case 'medio':
            case 'normal':
            default:
                return {
                    reactionTime: 0.18,
                    attackChance: 0.72,
                    blockChance: 0.50,
                    dodgeChance: 0.36,
                    specialChance: 0.50,
                    retreatHpThreshold: 0.28,
                    comboSkill: 2
                };
        }
    }

    update(dt, enemy, player) {
        if (!enemy || !player || enemy.state === 'dead' || player.state === 'dead') return;

        // Boneco de treino parado
        if (this.difficulty === 'treino_parado') {
            if (enemy.hp < enemy.maxHp * 0.4) {
                enemy.hp = enemy.maxHp;
            }
            enemy.vx = 0;
            return;
        }

        const settings = this.getSettings();
        this.actionCooldown -= dt;
        this.planTimer -= dt;

        const dx = player.x - enemy.x;
        const dist = Math.abs(dx);
        const playerDirection = dx > 0 ? 1 : -1;

        // Virar para o jogador se não estiver executando golpe travado
        if (!enemy.state.startsWith('attack') && enemy.state !== 'heavy' && enemy.state !== 'dodge' && enemy.state !== 'special') {
            enemy.direction = playerDirection;
        }

        // ==========================================
        // MECÂNICA DE FASE 2 / OVERDRIVE PARA BOSSES
        // ==========================================
        const hpPct = enemy.hp / enemy.maxHp;
        if ((this.bossType === 'chronos' || this.bossType === 'shadow' || this.bossType === 'colossus') && hpPct <= 0.50 && !this.bossOverdriveActive) {
            this.bossOverdriveActive = true;
            particleSystem.triggerShake(9, 0.4);
            audioSystem.playThunder();
            particleSystem.addShockwave(enemy.x, enemy.y - 45, 120, '#ffd700', 5);
            particleSystem.addFloatingText('🔥 FÚRIA ATIVADA! (FASE 2)', enemy.x, enemy.y - 95, {
                color: '#ff0055',
                fontSize: 22,
                fontWeight: '900'
            });
            enemy.speed *= 1.15;
            enemy.damage = Math.round(enemy.damage * 1.20);
        }

        // ==========================================
        // 1. REAÇÃO A ATAQUES DO JOGADOR (Defesa / Parry / Esquiva)
        // ==========================================
        if (player.state.startsWith('attack') || player.state === 'heavy' || player.state === 'special') {
            const playerReach = 95;
            if (dist < playerReach && enemy.state !== 'hurt' && enemy.state !== 'dead') {
                // Boss Ninja ou Chronos esquiva com grande probabilidade
                const isEvasiveBoss = this.bossType === 'ninja' || this.bossType === 'chronos';
                const dodgeProb = isEvasiveBoss ? 0.65 : settings.dodgeChance;

                if (Math.random() < dodgeProb && enemy.energy >= 20 && enemy.state !== 'dodge') {
                    enemy.direction = -playerDirection;
                    enemy.dodge();
                    return;
                } else if (Math.random() < settings.blockChance && !enemy.isBlocking) {
                    enemy.block(true);
                    setTimeout(() => {
                        if (enemy && enemy.isBlocking) enemy.block(false);
                    }, 380);
                    return;
                }
            }
        }

        // Soltar bloqueio se jogador parou de atacar
        if (enemy.isBlocking && !player.state.startsWith('attack') && player.state !== 'heavy' && player.state !== 'special') {
            enemy.block(false);
        }

        if (this.actionCooldown > 0) return;

        // ==========================================
        // 2. COMPORTAMENTOS ÚNICOS POR BOSS
        // ==========================================

        // BOSS 1: VALKYRIA NEON (Mestre Aéreo)
        if (this.bossType === 'valquiria' && enemy.energy >= 75) {
            if (dist > 140 && dist < 360 && Math.random() < 0.70) {
                enemy.direction = playerDirection;
                enemy.useSpecial();
                this.actionCooldown = 1.0;
                return;
            }
        }

        // BOSS 2: TITÃ COLOSSUS (Super Armadura e Impacto Sísmico)
        if (this.bossType === 'colossus') {
            if (dist < 100 && enemy.energy >= 25 && Math.random() < 0.60) {
                // Soco pesado com super armadura
                enemy.direction = playerDirection;
                enemy.attackHeavy();
                this.actionCooldown = 0.65;
                return;
            } else if (dist > 180 && enemy.energy >= 75 && Math.random() < 0.50) {
                // Arrancada com propulsores a jato
                enemy.direction = playerDirection;
                enemy.useSpecial();
                this.actionCooldown = 0.9;
                return;
            }
        }

        // BOSS 3: LORDE DO VAZIO (Teleporte das Trevas e Vórtice)
        if (this.bossType === 'shadow') {
            if (dist < 120 && Math.random() < 0.45 && enemy.energy >= 20) {
                // Desaparece e reaparece nas costas do jogador
                particleSystem.addShadowSmoke(enemy.x, enemy.y - 40, 10);
                enemy.x = player.x - playerDirection * 80;
                enemy.direction = playerDirection;
                audioSystem.playDodge();
                this.actionCooldown = 0.3;
                return;
            } else if (dist > 150 && enemy.energy >= 75 && Math.random() < 0.65) {
                enemy.direction = playerDirection;
                enemy.useSpecial();
                this.actionCooldown = 0.95;
                return;
            }
        }

        // BOSS FINAL: CHRONOS (Distorção Temporal & Cortes Prismáticos)
        if (this.bossType === 'chronos') {
            if (enemy.energy >= 75 && Math.random() < 0.65) {
                enemy.direction = playerDirection;
                enemy.useSpecial();
                this.actionCooldown = 1.1;
                return;
            } else if (dist > 200 && Math.random() < 0.50) {
                // Flash dash para fechar distância instantaneamente
                particleSystem.addSpark(enemy.x, enemy.y - 40, 10, '#ffd700', 5);
                enemy.x += playerDirection * 120;
                this.actionCooldown = 0.25;
                return;
            }
        }

        // ==========================================
        // 3. USO PADRÃO DE ESPECIAL PARA OUTROS OPONENTES
        // ==========================================
        if (enemy.energy >= 75 && dist < 320 && Math.random() < settings.specialChance) {
            enemy.direction = playerDirection;
            const used = enemy.useSpecial();
            if (used) {
                this.actionCooldown = 0.85;
                return;
            }
        }

        // ==========================================
        // 4. DISTÂNCIA DE ATAQUE CORPO A CORPO
        // ==========================================
        const attackRange = 78 + (enemy.weapon ? (enemy.weapon.bladeLength || 45) * 0.3 : 0);

        if (dist <= attackRange) {
            enemy.stopMoving();

            if (Math.random() < settings.attackChance) {
                // Golpe pesado
                if (enemy.energy >= 25 && Math.random() < 0.38) {
                    enemy.attackHeavy();
                    this.actionCooldown = 0.52;
                } else {
                    // Combo rápido
                    enemy.attackLight();
                    this.comboStep = 1;
                    this.actionCooldown = settings.reactionTime;

                    if (settings.comboSkill >= 2) {
                        setTimeout(() => {
                            if (enemy && enemy.state === 'attack1') {
                                enemy.attackLight();
                                if (settings.comboSkill >= 3) {
                                    setTimeout(() => {
                                        if (enemy && enemy.state === 'attack2') {
                                            enemy.attackLight();
                                        }
                                    }, 170);
                                }
                            }
                        }, 150);
                    }
                }
            } else if (Math.random() < 0.25 && enemy.isGrounded) {
                enemy.jump();
                this.actionCooldown = 0.3;
            } else if (Math.random() < 0.2) {
                enemy.crouch(true);
                setTimeout(() => {
                    if (enemy) enemy.crouch(false);
                }, 280);
                this.actionCooldown = 0.35;
            }
        } else {
            // Fora de alcance: aproximação
            enemy.move(playerDirection);

            if (Math.random() < 0.08 && enemy.isGrounded) {
                enemy.jump();
            }

            this.actionCooldown = settings.reactionTime * 0.5;
        }
    }
}
