/**
 * Sistema de Inteligência Artificial para Inimigos (Enemy AI)
 * Controla os movimentos, ataques, combos, bloqueios, esquivas e recuos do inimigo.
 * Suporta quatro níveis de dificuldade: Fácil, Normal, Difícil e Insano, além de modo Treino.
 */

class EnemyAI {
    constructor(difficulty = 'normal') {
        this.difficulty = difficulty; // 'facil', 'normal', 'dificil', 'insano', 'treino_parado', 'treino_ativo'
        this.actionCooldown = 0;
        this.reactionTimer = 0;
        this.currentPlan = 'idle';
        this.planTimer = 0;
        this.comboStep = 0;
    }

    setDifficulty(diff) {
        this.difficulty = diff;
        this.actionCooldown = 0;
        this.planTimer = 0;
    }

    getSettings() {
        switch (this.difficulty.toLowerCase()) {
            case 'easy':
            case 'facil':
                return {
                    reactionTime: 0.35,
                    attackChance: 0.50,
                    blockChance: 0.25,
                    dodgeChance: 0.20,
                    specialChance: 0.25,
                    retreatHpThreshold: 0.20,
                    comboSkill: 1
                };
            case 'hard':
            case 'dificil':
                return {
                    reactionTime: 0.10,
                    attackChance: 0.85,
                    blockChance: 0.70,
                    dodgeChance: 0.55,
                    specialChance: 0.70,
                    retreatHpThreshold: 0.35,
                    comboSkill: 3
                };
            case 'insane':
            case 'insano':
                return {
                    reactionTime: 0.04,
                    attackChance: 0.95,
                    blockChance: 0.88,
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
                    attackChance: 0.70,
                    blockChance: 0.48,
                    dodgeChance: 0.35,
                    specialChance: 0.45,
                    retreatHpThreshold: 0.28,
                    comboSkill: 2
                };
        }
    }

    update(dt, enemy, player) {
        if (!enemy || !player || enemy.state === 'dead' || player.state === 'dead') return;

        // Se for boneco de treino parado, regenerar HP para teste infinito
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

        // 1. REAÇÃO A ATAQUES DO JOGADOR (Defesa ou Esquiva)
        if (player.state.startsWith('attack') || player.state === 'heavy' || player.state === 'special') {
            const playerReach = 90;
            if (dist < playerReach && enemy.state !== 'hurt' && enemy.state !== 'dead') {
                if (Math.random() < settings.dodgeChance && enemy.energy >= 20 && enemy.state !== 'dodge') {
                    // Esquivar na direção contrária ou passar pelas costas
                    enemy.direction = -playerDirection;
                    enemy.dodge();
                    return;
                } else if (Math.random() < settings.blockChance && !enemy.isBlocking) {
                    enemy.block(true);
                    setTimeout(() => {
                        if (enemy && enemy.isBlocking) enemy.block(false);
                    }, 400);
                    return;
                }
            }
        }

        // Se estiver bloqueando e jogador parou de atacar, soltar bloqueio
        if (enemy.isBlocking && !player.state.startsWith('attack') && player.state !== 'heavy' && player.state !== 'special') {
            enemy.block(false);
        }

        if (this.actionCooldown > 0) return;

        // 2. RECUPERAÇÃO / RECUO QUANDO COM POUCA VIDA
        const hpPct = enemy.hp / enemy.maxHp;
        if (hpPct < settings.retreatHpThreshold && dist < 160 && Math.random() < 0.6) {
            // Recuar para o lado oposto
            enemy.move(-playerDirection);
            if (Math.random() < 0.25 && enemy.isGrounded) {
                enemy.jump();
            }
            this.actionCooldown = settings.reactionTime * 1.5;
            return;
        }

        // 3. USO DE ESPECIAL
        if (enemy.energy >= 75 && dist < 320 && Math.random() < settings.specialChance) {
            enemy.direction = playerDirection;
            const used = enemy.useSpecial();
            if (used) {
                this.actionCooldown = 0.8;
                return;
            }
        }

        // 4. DISTÂNCIA DE ATAQUE (Corpo a Corpo)
        const attackRange = 75;

        if (dist <= attackRange) {
            // No alcance de golpe!
            enemy.stopMoving();

            if (Math.random() < settings.attackChance) {
                // Golpe pesado se tiver energia
                if (enemy.energy >= 25 && Math.random() < 0.35) {
                    enemy.attackHeavy();
                    this.actionCooldown = 0.5;
                } else {
                    // Combo leve
                    enemy.attackLight();
                    this.comboStep = 1;
                    this.actionCooldown = settings.reactionTime;

                    // Possibilidade de continuar o combo
                    if (settings.comboSkill >= 2) {
                        setTimeout(() => {
                            if (enemy && enemy.state === 'attack1') {
                                enemy.attackLight();
                                if (settings.comboSkill >= 3) {
                                    setTimeout(() => {
                                        if (enemy && enemy.state === 'attack2') {
                                            enemy.attackLight();
                                        }
                                    }, 180);
                                }
                            }
                        }, 160);
                    }
                }
            } else if (Math.random() < 0.25 && enemy.isGrounded) {
                // Pular para confundir
                enemy.jump();
                this.actionCooldown = 0.3;
            } else if (Math.random() < 0.2) {
                // Agachar defensivo
                enemy.crouch(true);
                setTimeout(() => {
                    if (enemy) enemy.crouch(false);
                }, 300);
                this.actionCooldown = 0.35;
            }
        } else {
            // Fora de alcance: aproximar-se do jogador
            enemy.move(playerDirection);

            // Pular obstáculos ou para se aproximar rápido
            if (Math.random() < 0.08 && enemy.isGrounded) {
                enemy.jump();
            }

            this.actionCooldown = settings.reactionTime * 0.5;
        }
    }
}
