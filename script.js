/**
 * Script Principal do Jogo de Luta Stickman
 * Conecta todos os sistemas: Game, Player, Enemy, Combat, Shop, Inventory, Risk, Audio, Save.
 */

class Game {
    constructor() {
        this.saveSystem = new SaveSystem();
        this.inputManager = new InputManager(this.saveSystem);
        this.combatSystem = new CombatSystem();
        this.riskSystem = new RiskSystem();
        this.ai = new EnemyAI('normal');

        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.menuCanvas = document.getElementById('menu-stickman-canvas');
        this.menuCtx = this.menuCanvas ? this.menuCanvas.getContext('2d') : null;

        // Dimensões do campo de batalha
        this.width = 960;
        this.height = 540;

        // Estado do jogo: 'menu', 'battle', 'shop', 'inventory', 'risk', 'settings', 'victory', 'defeat'
        this.state = 'menu';
        this.gameMode = 'story'; // 'story', 'arena', 'training'
        this.storyStage = 1;
        this.arenaWave = 1;
        this.arenaDifficulty = 'easy'; // 'easy', 'medium', 'hard' (Dificuldades exclusivas da Arena)
        this.battleEnded = false;

        // Lutadores
        this.player = null;
        this.enemy = null;
        this.menuStickman = null;

        // Timers e Controle de Loop
        this.lastTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.trainingDummyMode = 'parado'; // 'parado' ou 'ativo'

        this.init();
    }

    init() {
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());

        // Inicializar Stickman do Menu
        this.initMenuStickman();

        // Inicializar eventos de UI
        this.setupUIEvents();

        // Atualizar estatísticas do cabeçalho
        this.saveSystem.updateHeaderStats();

        // Renderizar loja e inventário iniciais
        this.renderShop();
        this.renderInventory();
        this.renderKeybindsSettings();

        // Iniciar loop principal
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    resizeCanvases() {
        if (this.canvas) {
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        if (this.menuCanvas) {
            this.menuCanvas.width = 400;
            this.menuCanvas.height = 360;
        }
    }

    initMenuStickman() {
        const charId = this.saveSystem.data.selectedCharacter || 'stickman';
        const weaponId = this.saveSystem.data.equippedWeapon || 'madeira';
        this.menuStickman = new Fighter({
            isPlayer: true,
            charId: charId,
            weaponId: weaponId,
            x: 200,
            y: 280,
            direction: 1
        });
        this.menuStickman.groundY = 280;
    }

    setupUIEvents() {
        // Áudio resume ao clicar em qualquer lugar
        window.addEventListener('click', () => {
            audioSystem.ensureContext();
        }, { once: true });

        // Navegação de Telas
        document.querySelectorAll('[data-screen]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                audioSystem.playClick();
                const target = btn.getAttribute('data-screen');
                this.switchScreen(target);
            });
        });

        // Botão de atalho para Arena no Menu Principal
        const btnMenuArena = document.getElementById('btn-menu-arena');
        if (btnMenuArena) {
            btnMenuArena.addEventListener('click', () => {
                audioSystem.playClick();
                this.switchScreen('modes');
                const arenaCard = document.getElementById('mode-card-arena');
                if (arenaCard) {
                    arenaCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }

        // Botão de Treinamento no Menu Principal (Inicia treino diretamente)
        const btnMenuTraining = document.getElementById('btn-menu-training');
        if (btnMenuTraining) {
            btnMenuTraining.addEventListener('click', () => {
                audioSystem.playClick();
                this.startBattle('training');
            });
        }

        // Seletor de Dificuldade da Arena (Easy, Medium, Hard)
        document.querySelectorAll('.btn-arena-diff, .btn-diff-choice').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                audioSystem.playClick();
                document.querySelectorAll('.btn-arena-diff, .btn-diff-choice').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.arenaDifficulty = btn.getAttribute('data-diff') || 'easy';
                const descEl = document.getElementById('arena-diff-desc') || document.getElementById('diff-desc-feature');
                if (descEl) {
                    if (this.arenaDifficulty === 'easy') {
                        descEl.innerText = '🟢 Fácil: Inimigos mais acessíveis (+100 XP, +250 Coins/onda)';
                    } else if (this.arenaDifficulty === 'medium') {
                        descEl.innerText = '🟡 Médio: Desafio equilibrado e técnico (+150 XP, +350 Coins/onda)';
                    } else {
                        descEl.innerText = '🔴 Difícil: Inimigos ferozes, esquivas e dano elevado (+220 XP, +500 Coins/onda)';
                    }
                }
            });
        });

        // Botões de Iniciar Batalha
        const btnPlayStory = document.getElementById('btn-play-story');
        if (btnPlayStory) {
            btnPlayStory.addEventListener('click', () => {
                audioSystem.playClick();
                this.startBattle('story', this.storyStage);
            });
        }

        const btnPlayArena = document.getElementById('btn-play-arena');
        if (btnPlayArena) {
            btnPlayArena.addEventListener('click', () => {
                audioSystem.playClick();
                this.arenaWave = 1;
                this.startBattle('arena', 1, this.arenaDifficulty);
            });
        }

        const btnPlayTraining = document.getElementById('btn-play-training');
        if (btnPlayTraining) {
            btnPlayTraining.addEventListener('click', () => {
                audioSystem.playClick();
                this.startBattle('training');
            });
        }

        // Treinamento: Alternar IA do Dummy
        const btnToggleDummy = document.getElementById('btn-toggle-dummy');
        if (btnToggleDummy) {
            btnToggleDummy.addEventListener('click', () => {
                audioSystem.playClick();
                if (this.trainingDummyMode === 'parado') {
                    this.trainingDummyMode = 'ativo';
                    btnToggleDummy.innerText = 'Modo Dummy: IA BÁSICA (Ativo)';
                    this.ai.setDifficulty('facil');
                } else {
                    this.trainingDummyMode = 'parado';
                    btnToggleDummy.innerText = 'Modo Dummy: PARADO';
                    this.ai.setDifficulty('treino_parado');
                }
            });
        }

        // Botões da Tela de Vitória
        const btnVictoryContinue = document.getElementById('btn-victory-continue');
        if (btnVictoryContinue) {
            btnVictoryContinue.addEventListener('click', () => {
                audioSystem.playClick();
                const modal = document.getElementById('modal-victory');
                if (modal) modal.classList.add('hidden');
                this.battleEnded = false;

                if (this.gameMode === 'story') {
                    if (this.storyStage < 8) {
                        this.storyStage++;
                        this.startBattle('story', this.storyStage);
                    } else {
                        // Derrotou Chronos no estágio 8!
                        this.checkSecretCharacterUnlock();
                    }
                } else if (this.gameMode === 'arena') {
                    this.arenaWave++;
                    this.startBattle('arena', this.arenaWave, this.arenaDifficulty);
                } else {
                    this.switchScreen('menu');
                }
            });
        }

        // Botões do Modal de Desbloqueio do Personagem Secreto (Chronos)
        const btnSecretEquip = document.getElementById('btn-secret-equip-now');
        if (btnSecretEquip) {
            btnSecretEquip.addEventListener('click', () => {
                audioSystem.playBuy();
                const secretModal = document.getElementById('modal-secret-unlock');
                if (secretModal) secretModal.classList.add('hidden');
                this.saveSystem.data.selectedCharacter = 'chronos';
                this.saveSystem.save();
                this.initMenuStickman();
                this.switchScreen('menu');
            });
        }

        const btnSecretClose = document.getElementById('btn-secret-close');
        if (btnSecretClose) {
            btnSecretClose.addEventListener('click', () => {
                audioSystem.playClick();
                const secretModal = document.getElementById('modal-secret-unlock');
                if (secretModal) secretModal.classList.add('hidden');
                this.switchScreen('menu');
            });
        }

        const btnVictoryRetry = document.getElementById('btn-victory-retry');
        if (btnVictoryRetry) {
            btnVictoryRetry.addEventListener('click', () => {
                audioSystem.playClick();
                const modal = document.getElementById('modal-victory');
                if (modal) modal.classList.add('hidden');
                this.battleEnded = false;
                this.startBattle(this.gameMode, this.gameMode === 'arena' ? this.arenaWave : this.storyStage, this.arenaDifficulty);
            });
        }

        const btnVictoryMenu = document.getElementById('btn-victory-menu');
        if (btnVictoryMenu) {
            btnVictoryMenu.addEventListener('click', () => {
                audioSystem.playClick();
                const modal = document.getElementById('modal-victory');
                if (modal) modal.classList.add('hidden');
                this.battleEnded = false;
                this.switchScreen('menu');
            });
        }

        // Botões da Tela de Derrota / Reviver
        const handleReviveAction = () => {
            audioSystem.playClick();
            this.revivePlayer();
        };

        const btnDefeatRevive = document.getElementById('btn-defeat-revive');
        if (btnDefeatRevive) {
            btnDefeatRevive.addEventListener('click', handleReviveAction);
        }

        const btnDefeatRetry = document.getElementById('btn-defeat-retry');
        if (btnDefeatRetry) {
            btnDefeatRetry.addEventListener('click', handleReviveAction);
        }

        const btnDefeatMenu = document.getElementById('btn-defeat-menu');
        if (btnDefeatMenu) {
            btnDefeatMenu.addEventListener('click', () => {
                audioSystem.playClick();
                const modal = document.getElementById('modal-defeat');
                if (modal) modal.classList.add('hidden');
                this.battleEnded = false;
                this.switchScreen('menu');
            });
        }

        // Pausa no combate
        const btnPause = document.getElementById('btn-battle-pause');
        if (btnPause) {
            btnPause.addEventListener('click', () => {
                audioSystem.playClick();
                this.isPaused = !this.isPaused;
                btnPause.innerText = this.isPaused ? '▶️' : '⏸️';
            });
        }

        const btnLeaveBattle = document.getElementById('btn-battle-quit');
        if (btnLeaveBattle) {
            btnLeaveBattle.addEventListener('click', () => {
                audioSystem.playClick();
                if (confirm("Deseja sair da batalha atual e voltar ao menu?")) {
                    this.isPaused = false;
                    this.battleEnded = false;
                    this.switchScreen('menu');
                }
            });
        }

        // Controles de Risco
        this.setupRiskEvents();

        // Controles de Configurações e Reset
        this.setupSettingsEvents();

        // Categorias da Loja
        document.querySelectorAll('.shop-tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                audioSystem.playClick();
                document.querySelectorAll('.shop-tab-btn').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const category = tab.getAttribute('data-tab');
                this.renderShop(category);
            });
        });
    }

    setupRiskEvents() {
        // Seletor de Tiers de Risco (2x, 5x, 50x)
        document.querySelectorAll('.btn-risk-tier').forEach(btn => {
            btn.addEventListener('click', () => {
                audioSystem.playClick();
                const tier = btn.getAttribute('data-tier');
                this.riskSystem.setTier(tier);
            });
        });

        // Botões pré-definidos de aposta
        document.querySelectorAll('.btn-bet-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                audioSystem.playClick();
                const val = btn.getAttribute('data-bet');
                if (val === 'max') {
                    this.riskSystem.setBet(this.saveSystem.data.coins);
                } else {
                    this.riskSystem.setBet(parseInt(val, 10));
                }
            });
        });

        const betInput = document.getElementById('risk-bet-input');
        if (betInput) {
            betInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 0;
                this.riskSystem.setBet(val);
            });
        }

        const btnSpin = document.getElementById('btn-risk-spin');
        if (btnSpin) {
            btnSpin.addEventListener('click', () => {
                audioSystem.playClick();
                this.riskSystem.promptConfirmBet(this.saveSystem);
            });
        }

        const btnConfirmYes = document.getElementById('btn-risk-confirm-yes');
        if (btnConfirmYes) {
            btnConfirmYes.addEventListener('click', () => {
                audioSystem.playClick();
                this.riskSystem.executeSpin(this.saveSystem, (won) => {
                    this.saveSystem.updateHeaderStats();
                    this.riskSystem.updateUI();
                });
            });
        }

        const btnConfirmNo = document.getElementById('btn-risk-confirm-no');
        if (btnConfirmNo) {
            btnConfirmNo.addEventListener('click', () => {
                audioSystem.playClick();
                this.riskSystem.cancelConfirm();
            });
        }
    }

    setupSettingsEvents() {
        const volumeSlider = document.getElementById('setting-volume');
        if (volumeSlider) {
            volumeSlider.value = this.saveSystem.data.volume;
            volumeSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.saveSystem.data.volume = val;
                audioSystem.setVolume(val);
                this.saveSystem.save();
            });
        }

        const btnMute = document.getElementById('btn-toggle-sound');
        if (btnMute) {
            btnMute.addEventListener('click', () => {
                const enabled = audioSystem.toggleMute();
                this.saveSystem.data.muted = !enabled;
                btnMute.innerText = enabled ? '🔊 Som: Ativado' : '🔇 Som: Mudo';
                this.saveSystem.save();
            });
        }

        const btnResetProgress = document.getElementById('btn-reset-progress');
        if (btnResetProgress) {
            btnResetProgress.addEventListener('click', () => {
                const ok = confirm("⚠️ ATENÇÃO: Tem certeza que deseja resetar todo o progresso do jogo? Isso apagará todas as moedas, armas e personagens desbloqueados!");
                if (ok) {
                    this.saveSystem.reset();
                    alert("Progresso reiniciado com sucesso!");
                    this.initMenuStickman();
                    this.renderShop();
                    this.renderInventory();
                    this.saveSystem.updateHeaderStats();
                    this.switchScreen('menu');
                }
            });
        }
    }

    switchScreen(screenName) {
        this.state = screenName;

        // Ocultar todos os modais para evitar telas sobrepostas
        document.querySelectorAll('.game-modal-backdrop').forEach(el => el.classList.add('hidden'));

        // Se sair da batalha, despausar e resetar flags
        if (screenName !== 'battle') {
            this.isPaused = false;
            this.battleEnded = false;
        }

        // Limpar teclas pressionadas para evitar travamentos
        if (this.inputManager) {
            this.inputManager.resetKeys();
        }

        // Ocultar todas as telas
        document.querySelectorAll('.game-screen').forEach(el => el.classList.remove('active'));

        // Exibir tela alvo
        const target = document.getElementById(`screen-${screenName}`);
        if (target) {
            target.classList.add('active');
        }

        // Se voltar para o menu, reatualizar o stickman do menu
        if (screenName === 'menu') {
            this.initMenuStickman();
            this.saveSystem.updateHeaderStats();
        } else if (screenName === 'risk') {
            this.riskSystem.updateUI();
        } else if (screenName === 'inventory') {
            this.renderInventory();
        } else if (screenName === 'shop') {
            this.renderShop();
        } else if (screenName === 'settings') {
            this.renderKeybindsSettings();
        }
    }

    // Inicialização da Batalha
    startBattle(mode = 'arena', stageOrWave = 1, difficulty = null) {
        this.gameMode = mode;
        this.isPaused = false;
        this.battleEnded = false;

        // Garantir que todos os modais fiquem fechados
        document.querySelectorAll('.game-modal-backdrop').forEach(el => el.classList.add('hidden'));

        // Resetar teclas
        if (this.inputManager) {
            this.inputManager.resetKeys();
        }

        particleSystem.reset();
        this.combatSystem.reset();

        const pCharId = this.saveSystem.data.selectedCharacter || 'stickman';
        const pWeaponId = this.saveSystem.data.equippedWeapon || 'madeira';
        const pItems = this.saveSystem.data.equippedItems || [];

        // Criar Jogador com HP e Energia 100% restaurados
        this.player = new Fighter({
            isPlayer: true,
            name: 'Jogador',
            charId: pCharId,
            weaponId: pWeaponId,
            equippedItems: pItems,
            x: 220,
            y: 440,
            direction: 1
        });

        // Configurar Inimigo conforme modo e estágio
        let enemyConfig = {
            charId: 'stickman',
            weaponId: 'madeira',
            name: 'Inimigo',
            difficulty: 'medium',
            bonusHp: 0,
            bonusDmg: 0,
            bonusDef: 0,
            bonusSpeed: 0
        };

        if (mode === 'story') {
            this.storyStage = typeof stageOrWave === 'number' ? stageOrWave : 1;
            if (this.storyStage === 1) {
                enemyConfig = {
                    charId: 'stickman',
                    weaponId: 'ferro',
                    name: 'Recruta Novato (Agressivo)',
                    difficulty: 'medium',
                    bossType: 'standard',
                    bonusHp: 25,
                    bonusDmg: 5
                };
            } else if (this.storyStage === 2) {
                enemyConfig = {
                    charId: 'guerreiro',
                    weaponId: 'martelo_titan',
                    name: 'Guarda de Ferro (Muralha)',
                    difficulty: 'hard',
                    bossType: 'muralha',
                    bonusHp: 75,
                    bonusDmg: 9,
                    bonusDef: 12
                };
            } else if (this.storyStage === 3) {
                enemyConfig = {
                    charId: 'ninja',
                    weaponId: 'adagas_veneno',
                    name: 'Ninja das Sombras (Vento Silencioso)',
                    difficulty: 'hard',
                    bossType: 'ninja',
                    bonusHp: 70,
                    bonusDmg: 14,
                    bonusSpeed: 1.5
                };
            } else if (this.storyStage === 4) {
                enemyConfig = {
                    charId: 'samurai',
                    weaponId: 'flamejante',
                    name: 'Mestre Ronin (Lâmina Flamejante)',
                    difficulty: 'hard',
                    bossType: 'ronin',
                    bonusHp: 110,
                    bonusDmg: 20,
                    bonusDef: 6
                };
            } else if (this.storyStage === 5) {
                // NOVO BOSS 1: Sentinela Celeste
                enemyConfig = {
                    charId: 'valquiria',
                    weaponId: 'lanca_plasma',
                    name: 'Valkyria Neon (Sentinela Celeste - BOSS)',
                    difficulty: 'hard',
                    bossType: 'valquiria',
                    bonusHp: 145,
                    bonusDmg: 24,
                    bonusSpeed: 1.8
                };
            } else if (this.storyStage === 6) {
                // NOVO BOSS 2: Demolidor Mecha
                enemyConfig = {
                    charId: 'colossus',
                    weaponId: 'martelo_titan',
                    name: 'Titã Goliath (Demolidor Mecha - BOSS)',
                    difficulty: 'insane',
                    bossType: 'colossus',
                    bonusHp: 210,
                    bonusDmg: 30,
                    bonusDef: 18
                };
            } else if (this.storyStage === 7) {
                // NOVO BOSS 3: Flagelo Dimensional
                enemyConfig = {
                    charId: 'shadow',
                    weaponId: 'foice_espectral',
                    name: 'Lorde do Vazio (Flagelo Cósmico - BOSS)',
                    difficulty: 'insane',
                    bossType: 'shadow',
                    bonusHp: 240,
                    bonusDmg: 34,
                    bonusDef: 14,
                    bonusSpeed: 1.0
                };
            } else {
                // GRANDE BOSS FINAL: Chronos
                enemyConfig = {
                    charId: 'chronos',
                    weaponId: 'espada_cronos',
                    name: 'Chronos (Soberano do Tempo - BOSS FINAL)',
                    difficulty: 'insane',
                    bossType: 'chronos',
                    bonusHp: 320,
                    bonusDmg: 42,
                    bonusDef: 18,
                    bonusSpeed: 1.4
                };
            }
        } else if (mode === 'arena') {
            this.arenaWave = typeof stageOrWave === 'number' ? stageOrWave : 1;
            if (difficulty) {
                this.arenaDifficulty = difficulty;
            }

            const chars = ['stickman', 'guerreiro', 'ninja', 'samurai', 'mago', 'valquiria', 'colossus', 'shadow'];
            const weapons = ['madeira', 'ferro', 'adagas_veneno', 'katana', 'lanca_plasma', 'flamejante', 'martelo_titan', 'foice_espectral', 'sombria'];
            const charIdx = Math.min(chars.length - 1, Math.floor((this.arenaWave - 1) / 2));
            const wepIdx = Math.min(weapons.length - 1, Math.floor((this.arenaWave - 1) / 2));

            const diff = this.arenaDifficulty || 'easy';
            let aiDiff = 'medium';
            let hpPerWave = 20;
            let dmgPerWave = 3;
            let defBonus = 0;
            let speedBonus = 0;

            if (diff === 'easy') {
                aiDiff = this.arenaWave <= 2 ? 'easy' : 'medium';
                hpPerWave = 15;
                dmgPerWave = 2;
                defBonus = Math.floor(this.arenaWave * 0.5);
            } else if (diff === 'medium') {
                aiDiff = this.arenaWave <= 2 ? 'medium' : 'hard';
                hpPerWave = 25;
                dmgPerWave = 4;
                defBonus = Math.floor(this.arenaWave * 1.5);
            } else { // hard
                aiDiff = this.arenaWave <= 1 ? 'hard' : 'insane';
                hpPerWave = 40;
                dmgPerWave = 7;
                defBonus = this.arenaWave * 3;
                speedBonus = 0.5;
            }

            const diffNames = { easy: 'FÁCIL', medium: 'MÉDIO', hard: 'DIFÍCIL' };
            enemyConfig = {
                charId: chars[charIdx],
                weaponId: weapons[wepIdx],
                name: `Gladiador Onda ${this.arenaWave} (${diffNames[diff] || 'FÁCIL'})`,
                difficulty: aiDiff,
                bossType: 'standard',
                bonusHp: this.arenaWave * hpPerWave,
                bonusDmg: this.arenaWave * dmgPerWave,
                bonusDef: defBonus,
                bonusSpeed: speedBonus
            };
        } else if (mode === 'training') {
            enemyConfig = {
                charId: 'stickman',
                weaponId: 'madeira',
                name: 'Boneco de Treino',
                difficulty: this.trainingDummyMode === 'parado' ? 'treino_parado' : 'medium',
                bossType: 'standard'
            };
        }

        this.enemy = new Fighter({
            isPlayer: false,
            name: enemyConfig.name,
            charId: enemyConfig.charId,
            weaponId: enemyConfig.weaponId,
            x: 740,
            y: 440,
            direction: -1
        });

        // Aplicar bônus de status no oponente
        if (enemyConfig.bonusHp) {
            this.enemy.maxHp += enemyConfig.bonusHp;
            this.enemy.hp = this.enemy.maxHp;
        }
        if (enemyConfig.bonusDmg) {
            this.enemy.damage += enemyConfig.bonusDmg;
        }
        if (enemyConfig.bonusDef) {
            this.enemy.defense += enemyConfig.bonusDef;
        }
        if (enemyConfig.bonusSpeed) {
            this.enemy.speed += enemyConfig.bonusSpeed;
        }

        // Configurar IA com arquétipo de boss
        this.ai.setDifficulty(enemyConfig.difficulty, enemyConfig.bossType || 'standard');

        // Atualizar HUD
        this.updateHUDStaticInfo();

        // Mostrar tela de batalha
        this.switchScreen('battle');
        const trainingControls = document.getElementById('battle-training-controls');
        if (trainingControls) {
            trainingControls.style.display = mode === 'training' ? 'flex' : 'none';
        }
    }

    updateHUDStaticInfo() {
        const pName = document.getElementById('hud-player-name');
        const pWeapon = document.getElementById('hud-player-weapon');
        const eName = document.getElementById('hud-enemy-name');
        const eWeapon = document.getElementById('hud-enemy-weapon');
        const modeBadge = document.getElementById('hud-mode-badge');

        if (pName && this.player) pName.innerText = this.player.charData.name;
        if (pWeapon && this.player) pWeapon.innerText = this.player.weapon.name;
        if (eName && this.enemy) eName.innerText = this.enemy.name;
        if (eWeapon && this.enemy) eWeapon.innerText = this.enemy.weapon.name;

        if (modeBadge) {
            if (this.gameMode === 'story') {
                modeBadge.innerText = `MODO HISTÓRIA - FASE ${this.storyStage} / 8`;
            } else if (this.gameMode === 'arena') {
                const diffMap = { easy: 'FÁCIL', medium: 'MÉDIO', hard: 'DIFÍCIL' };
                modeBadge.innerText = `MODO ARENA [${diffMap[this.arenaDifficulty] || 'FÁCIL'}] - ONDA ${this.arenaWave}`;
            } else {
                modeBadge.innerText = `MODO TREINAMENTO`;
            }
        }
    }

    // Processamento de entradas do Jogador
    handlePlayerInput() {
        if (!this.player || this.player.state === 'dead' || this.isPaused) return;

        // Movimento horizontal
        if (this.inputManager.isActionActive('left')) {
            this.player.move(-1);
        } else if (this.inputManager.isActionActive('right')) {
            this.player.move(1);
        } else {
            this.player.stopMoving();
        }

        // Pulo
        if (this.inputManager.isActionActive('jump')) {
            this.player.jump();
        }

        // Agachar
        this.player.crouch(this.inputManager.isActionActive('crouch'));

        // Bloqueio
        this.player.block(this.inputManager.isActionActive('defend'));

        // Esquiva
        if (this.inputManager.isActionActive('dodge')) {
            this.player.dodge();
        }

        // Ataques
        if (this.inputManager.isActionActive('attack')) {
            this.player.attackLight();
        }
        if (this.inputManager.isActionActive('heavy')) {
            this.player.attackHeavy();
        }
        if (this.inputManager.isActionActive('special')) {
            this.player.useSpecial();
        }
    }

    // Loop do Jogo
    gameLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
        this.lastTime = timestamp;

        if (this.state === 'battle' && !this.isPaused) {
            this.updateBattle(dt);
            this.renderBattle();
        } else if (this.state === 'menu') {
            this.renderMenuBackground(dt);
        }

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    updateBattle(dt) {
        this.handlePlayerInput();

        // Atualizar IA do inimigo
        this.ai.update(dt, this.enemy, this.player);

        // Atualizar física dos lutadores
        this.player.update(dt, this.width);
        this.enemy.update(dt, this.width);

        // Atualizar sistema de combate (colisões, danos, combos)
        this.combatSystem.update(dt, this.player, this.enemy);

        // Atualizar partículas e textos flutuantes
        particleSystem.update(dt);

        // Atualizar barras de HUD
        this.updateHUDDynamic();

        // Checar fim de batalha (apenas uma vez por batalha)
        if (!this.battleEnded) {
            if (this.player.state === 'dead' && this.player.stateTimer <= 1.5) {
                this.battleEnded = true;
                this.handleDefeat();
            } else if (this.enemy.state === 'dead' && this.enemy.stateTimer <= 1.5) {
                this.battleEnded = true;
                this.handleVictory();
            }
        }
    }

    updateHUDDynamic() {
        if (!this.player || !this.enemy) return;

        // Vida do Jogador
        const pHpFill = document.getElementById('hud-player-hp-fill');
        const pHpText = document.getElementById('hud-player-hp-text');
        const pEnergyFill = document.getElementById('hud-player-energy-fill');
        const pEnergyText = document.getElementById('hud-player-energy-text');

        const pHpPct = Math.max(0, Math.min(100, (this.player.hp / this.player.maxHp) * 100));
        const pEnergyPct = Math.max(0, Math.min(100, (this.player.energy / this.player.maxEnergy) * 100));

        if (pHpFill) pHpFill.style.width = `${pHpPct}%`;
        if (pHpText) pHpText.innerText = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
        if (pEnergyFill) pEnergyFill.style.width = `${pEnergyPct}%`;
        if (pEnergyText) pEnergyText.innerText = `${Math.ceil(this.player.energy)} / ${this.player.maxEnergy}`;

        // Vida do Inimigo
        const eHpFill = document.getElementById('hud-enemy-hp-fill');
        const eHpText = document.getElementById('hud-enemy-hp-text');
        const eHpPct = Math.max(0, Math.min(100, (this.enemy.hp / this.enemy.maxHp) * 100));

        if (eHpFill) eHpFill.style.width = `${eHpPct}%`;
        if (eHpText) eHpText.innerText = `${Math.ceil(this.enemy.hp)} / ${this.enemy.maxHp}`;

        // Timer de batalha
        const timerEl = document.getElementById('hud-battle-timer');
        if (timerEl) {
            const mins = Math.floor(this.combatSystem.battleTime / 60);
            const secs = Math.floor(this.combatSystem.battleTime % 60);
            timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        // Combo HUD
        const comboBox = document.getElementById('hud-combo-container');
        const comboCount = document.getElementById('hud-combo-count');
        const comboMult = document.getElementById('hud-combo-multiplier');

        if (this.combatSystem.comboCounter >= 2) {
            if (comboBox) comboBox.classList.add('visible');
            if (comboCount) comboCount.innerText = `${this.combatSystem.comboCounter} HITS`;
            if (comboMult) comboMult.innerText = `${this.combatSystem.comboMultiplier.toFixed(1)}x`;
        } else {
            if (comboBox) comboBox.classList.remove('visible');
        }
    }

    renderBattle() {
        const ctx = this.ctx;
        const shake = particleSystem.getShakeOffset();

        ctx.save();
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.translate(shake.x, shake.y);

        // Cenário estilizado estilo Dojo Cyberpunk / Arena de Combate
        this.drawArenaBackground(ctx);

        // Desenhar lutadores
        this.player.render(ctx);
        this.enemy.render(ctx);

        // Desenhar partículas, faíscas, sangue e textos
        particleSystem.render(ctx);

        ctx.restore();
    }

    drawArenaBackground(ctx) {
        // Céu escuro gradiente
        const gradSky = ctx.createLinearGradient(0, 0, 0, this.height);
        gradSky.addColorStop(0, '#07080d');
        gradSky.addColorStop(0.65, '#121420');
        gradSky.addColorStop(1, '#050608');
        ctx.fillStyle = gradSky;
        ctx.fillRect(0, 0, this.width, this.height);

        // Grade cibernética no fundo
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < this.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 440);
            ctx.stroke();
        }
        for (let y = 0; y < 440; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // Holofotes / Luzes volumétricas
        const spot1 = ctx.createRadialGradient(250, 0, 10, 250, 440, 380);
        spot1.addColorStop(0, 'rgba(0, 240, 255, 0.12)');
        spot1.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = spot1;
        ctx.fillRect(0, 0, this.width, 440);

        const spot2 = ctx.createRadialGradient(710, 0, 10, 710, 440, 380);
        spot2.addColorStop(0, 'rgba(255, 0, 85, 0.12)');
        spot2.addColorStop(1, 'rgba(255, 0, 85, 0)');
        ctx.fillStyle = spot2;
        ctx.fillRect(0, 0, this.width, 440);

        // Piso da Arena com brilho neon
        const gradFloor = ctx.createLinearGradient(0, 440, 0, this.height);
        gradFloor.addColorStop(0, '#10121a');
        gradFloor.addColorStop(1, '#08090d');
        ctx.fillStyle = gradFloor;
        ctx.fillRect(0, 440, this.width, this.height - 440);

        // Linha neon do solo
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 440);
        ctx.lineTo(this.width, 440);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Pilares de neon nas bordas da arena
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 120, 8, 320);
        ctx.strokeRect(this.width - 28, 120, 8, 320);
    }

    renderMenuBackground(dt) {
        if (!this.menuCtx || !this.menuStickman) return;
        const ctx = this.menuCtx;
        ctx.clearRect(0, 0, 400, 360);

        // Gradiente do palco do menu
        const grad = ctx.createRadialGradient(200, 260, 20, 200, 260, 180);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, 360);

        // Chão
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, 280);
        ctx.lineTo(360, 280);
        ctx.stroke();

        // Animação de golpes demonstrativos ocasionais
        this.menuStickman.animTime += dt;
        if (Math.sin(this.menuStickman.animTime * 2) > 0.95 && this.menuStickman.state === 'idle') {
            this.menuStickman.attackLight();
        }

        this.menuStickman.update(dt, 400);
        this.menuStickman.render(ctx);
    }

    handleVictory() {
        this.player.win();
        audioSystem.playVictory();
        this.saveSystem.recordBattleResult(true);

        // Recompensas balanceadas e ampliadas de XP e Moedas
        let earnedCoins = 450;
        let earnedXp = 120;

        if (this.gameMode === 'story') {
            const storyCoins = [450, 750, 1100, 1600, 2300, 3200, 4500, 7000];
            const storyXp = [120, 180, 250, 350, 480, 650, 850, 1500];
            earnedCoins = storyCoins[this.storyStage - 1] || 1000;
            earnedXp = storyXp[this.storyStage - 1] || 350;
        } else if (this.gameMode === 'arena') {
            const diff = this.arenaDifficulty || 'easy';
            const mult = diff === 'easy' ? 1.0 : diff === 'medium' ? 1.45 : 2.1;
            earnedCoins = Math.round(220 * this.arenaWave * mult);
            if (this.arenaWave % 3 === 0) {
                earnedCoins += 500; // Bônus de marco de sobrevivência na Arena
            }
            earnedXp = Math.round(65 * this.arenaWave * mult);
        } else if (this.gameMode === 'training') {
            earnedCoins = 0;
            earnedXp = 0;
        }

        // Bônus adicional de combo
        let comboBonusCoins = 0;
        if (this.combatSystem.maxCombo >= 15) {
            comboBonusCoins = 600;
        } else if (this.combatSystem.maxCombo >= 10) {
            comboBonusCoins = 350;
        } else if (this.combatSystem.maxCombo >= 5) {
            comboBonusCoins = 150;
        }

        // Bônus de maestria por preservar a vida (HP >= 70%)
        let flawlessBonusCoins = 0;
        if (this.player && (this.player.hp / this.player.maxHp) >= 0.70 && this.gameMode !== 'training') {
            flawlessBonusCoins = 300;
        }

        const totalEarnedCoins = earnedCoins + comboBonusCoins + flawlessBonusCoins;

        this.saveSystem.addCoins(totalEarnedCoins);
        this.saveSystem.addXP(earnedXp);

        // Preencher modal de vitória
        const modal = document.getElementById('modal-victory');
        const textCoins = document.getElementById('victory-coins');
        const textXp = document.getElementById('victory-xp');
        const textDmg = document.getElementById('victory-damage');
        const textCombo = document.getElementById('victory-max-combo');
        const textTime = document.getElementById('victory-time');

        let bonusNote = '';
        if (comboBonusCoins > 0 || flawlessBonusCoins > 0) {
            bonusNote = ` (Bônus: +${comboBonusCoins + flawlessBonusCoins})`;
        }

        if (textCoins) textCoins.innerText = `+${totalEarnedCoins.toLocaleString('pt-BR')} Skill Coins${bonusNote}`;
        if (textXp) textXp.innerText = `+${earnedXp.toLocaleString('pt-BR')} XP`;
        if (textDmg) textDmg.innerText = this.combatSystem.totalDamageDealt;
        if (textCombo) textCombo.innerText = `${this.combatSystem.maxCombo} HITS`;

        const mins = Math.floor(this.combatSystem.battleTime / 60);
        const secs = Math.floor(this.combatSystem.battleTime % 60);
        if (textTime) textTime.innerText = `${mins}m ${secs}s`;

        particleSystem.addConfetti(window.innerWidth / 2, window.innerHeight / 2, 80);

        if (modal) modal.classList.remove('hidden');
    }

    checkSecretCharacterUnlock() {
        if (!this.saveSystem.data.unlockedCharacters.includes('chronos')) {
            this.saveSystem.data.unlockedCharacters.push('chronos');
            this.saveSystem.save();
        }

        const secretModal = document.getElementById('modal-secret-unlock');
        if (secretModal) {
            secretModal.classList.remove('hidden');
            audioSystem.playSecretUnlock();
            particleSystem.addConfetti(window.innerWidth / 2, window.innerHeight / 2, 120);
            particleSystem.triggerShake(8, 0.4);
        } else {
            alert("🏆 PARABÉNS! Você derrotou Chronos e desbloqueou o Personagem Secreto: Chronos, o Soberano do Tempo!");
            this.switchScreen('menu');
        }
    }

    handleDefeat() {
        audioSystem.playDefeat();
        this.saveSystem.recordBattleResult(false);

        const modal = document.getElementById('modal-defeat');
        const textTitle = document.getElementById('defeat-modal-title');
        const textSub = document.getElementById('defeat-modal-sub');
        const textDmg = document.getElementById('defeat-damage');
        const textCombo = document.getElementById('defeat-max-combo');
        const textTime = document.getElementById('defeat-time');
        const textCoins = document.getElementById('defeat-current-coins');

        if (textTitle) textTitle.innerText = "VOCÊ CAIU!";
        if (textSub) {
            if (this.gameMode === 'arena') {
                textSub.innerText = "Reviver reiniciará a Arena a partir da Onda 1.";
            } else if (this.gameMode === 'story') {
                textSub.innerText = `Reviver reiniciará a Fase ${this.storyStage}.`;
            } else {
                textSub.innerText = "Reviver restaurará sua vida para continuar lutando.";
            }
        }

        if (textDmg) textDmg.innerText = this.combatSystem.totalDamageDealt;
        if (textCombo) textCombo.innerText = `${this.combatSystem.maxCombo} HITS`;
        if (textCoins) textCoins.innerText = this.saveSystem.data.coins.toLocaleString('pt-BR');

        const mins = Math.floor(this.combatSystem.battleTime / 60);
        const secs = Math.floor(this.combatSystem.battleTime % 60);
        if (textTime) textTime.innerText = `${mins}m ${secs}s`;

        if (modal) modal.classList.remove('hidden');
    }

    revivePlayer() {
        // Fechar modal de derrota/reviver imediatamente
        const modal = document.getElementById('modal-defeat');
        if (modal) modal.classList.add('hidden');

        this.battleEnded = false;
        this.isPaused = false;

        if (this.inputManager) {
            this.inputManager.resetKeys();
        }

        if (this.gameMode === 'arena') {
            // REGRA OBRIGATÓRIA: Na Arena, reviver sempre reseta o progresso e volta para a Onda 1
            this.arenaWave = 1;
            this.startBattle('arena', 1, this.arenaDifficulty);
        } else if (this.gameMode === 'story') {
            this.startBattle('story', this.storyStage);
        } else {
            this.startBattle(this.gameMode);
        }

        audioSystem.playBuy();
        if (this.player) {
            particleSystem.addSpark(this.player.x, this.player.y - 40, 25, '#00f0ff', 7);
            particleSystem.addFloatingText('⚡ GUERREIRO REVIVIDO!', this.player.x, this.player.y - 85, {
                color: '#00f0ff',
                fontSize: 22,
                fontWeight: '900'
            });
        }
    }

    // Renderização da Loja
    renderShop(category = 'weapons') {
        const container = document.getElementById('shop-items-grid');
        if (!container) return;
        container.innerHTML = '';

        if (category === 'weapons') {
            const perksMap = {
                poison: { label: '🧪 Neurotoxina (Veneno)', cls: 'perk-poison' },
                crush: { label: '🛡️ Quebra-Guarda & Impacto', cls: 'perk-crush' },
                lightning: { label: '⚡ Descarga Elétrica', cls: 'perk-lightning' },
                lifesteal: { label: '💚 Vampirismo (6% HP)', cls: 'perk-lifesteal' },
                prism: { label: '✨ Lâmina Estelar (28% Crit)', cls: 'perk-prism' },
                fire: { label: '🔥 Labaredas Incandescentes', cls: 'perk-fire' },
                shadow: { label: '🌑 Penetração do Vazio', cls: 'perk-shadow' }
            };

            for (const [id, w] of Object.entries(WEAPONS_DATA)) {
                const isUnlocked = this.saveSystem.data.unlockedWeapons.includes(id);
                const isEquipped = this.saveSystem.data.equippedWeapon === id;

                let perkHtml = '';
                if (w.specialEffect && perksMap[w.specialEffect]) {
                    const p = perksMap[w.specialEffect];
                    perkHtml = `<div class="weapon-perk-badge ${p.cls}">${p.label}</div>`;
                }

                const card = document.createElement('div');
                card.className = `shop-card ${isEquipped ? 'equipped' : ''}`;
                card.innerHTML = `
                    <div class="shop-card-icon" style="color:${w.color}; text-shadow: 0 0 10px ${w.glowColor}">🗡️</div>
                    <h3 class="shop-card-title">${w.name}</h3>
                    ${perkHtml}
                    <p class="shop-card-desc">${w.desc}</p>
                    <div class="shop-stats-row">
                        <span>⚔️ Dano: <strong>${w.damage}</strong></span>
                        <span>⚡ Vel: <strong>${w.speed}</strong></span>
                        <span>🎯 Crítico: <strong>+${Math.round(w.critBonus * 100)}%</strong></span>
                    </div>
                    <div class="shop-price-tag">
                        ${w.price === 0 ? 'GRÁTIS' : `🪙 ${w.price.toLocaleString('pt-BR')}`}
                    </div>
                    <button class="btn-shop-action ${isEquipped ? 'btn-active' : ''}">
                        ${isEquipped ? 'EQUIPADA' : isUnlocked ? 'EQUIPAR' : 'COMPRAR'}
                    </button>
                `;

                const btn = card.querySelector('.btn-shop-action');
                btn.addEventListener('click', () => {
                    audioSystem.playClick();
                    if (isEquipped) return;
                    if (isUnlocked) {
                        this.saveSystem.data.equippedWeapon = id;
                        this.saveSystem.save();
                        this.renderShop('weapons');
                        this.renderInventory();
                    } else {
                        if (this.saveSystem.data.coins >= w.price) {
                            this.saveSystem.addCoins(-w.price);
                            this.saveSystem.data.unlockedWeapons.push(id);
                            this.saveSystem.data.equippedWeapon = id;
                            this.saveSystem.save();
                            audioSystem.playBuy();
                            particleSystem.addConfetti(window.innerWidth / 2, window.innerHeight / 2, 40);
                            this.renderShop('weapons');
                            this.renderInventory();
                        } else {
                            alert("Saldo insuficiente de Skill Coins!");
                        }
                    }
                });

                container.appendChild(card);
            }
        } else if (category === 'items') {
            for (const [id, item] of Object.entries(ITEMS_DATA)) {
                const isUnlocked = this.saveSystem.data.unlockedItems.includes(id);
                const isEquipped = this.saveSystem.data.equippedItems.includes(id);

                const card = document.createElement('div');
                card.className = `shop-card ${isEquipped ? 'equipped' : ''}`;
                card.innerHTML = `
                    <div class="shop-card-icon">${item.icon}</div>
                    <h3 class="shop-card-title">${item.name}</h3>
                    <p class="shop-card-desc">${item.desc}</p>
                    <div class="shop-price-tag">🪙 ${item.price.toLocaleString('pt-BR')}</div>
                    <button class="btn-shop-action ${isEquipped ? 'btn-active' : ''}">
                        ${isEquipped ? 'EQUIPADO' : isUnlocked ? 'EQUIPAR' : 'COMPRAR'}
                    </button>
                `;

                const btn = card.querySelector('.btn-shop-action');
                btn.addEventListener('click', () => {
                    audioSystem.playClick();
                    if (isUnlocked) {
                        if (isEquipped) {
                            this.saveSystem.data.equippedItems = this.saveSystem.data.equippedItems.filter(i => i !== id);
                        } else {
                            this.saveSystem.data.equippedItems.push(id);
                        }
                        this.saveSystem.save();
                        this.renderShop('items');
                        this.renderInventory();
                    } else {
                        if (this.saveSystem.data.coins >= item.price) {
                            this.saveSystem.addCoins(-item.price);
                            this.saveSystem.data.unlockedItems.push(id);
                            this.saveSystem.data.equippedItems.push(id);
                            this.saveSystem.save();
                            audioSystem.playBuy();
                            particleSystem.addConfetti(window.innerWidth / 2, window.innerHeight / 2, 40);
                            this.renderShop('items');
                            this.renderInventory();
                        } else {
                            alert("Saldo insuficiente de Skill Coins!");
                        }
                    }
                });

                container.appendChild(card);
            }
        } else if (category === 'characters') {
            for (const [id, char] of Object.entries(CHARACTERS_DATA)) {
                const isUnlocked = this.saveSystem.data.unlockedCharacters.includes(id);
                const isEquipped = this.saveSystem.data.selectedCharacter === id;
                const isSecretLocked = char.isSecret && !isUnlocked;

                const skillBadge = char.skillName ? `<div class="shop-char-skill-badge">🌀 Especial: <strong>${char.skillName}</strong></div>` : '';
                const skillDesc = char.skillDesc ? `<p class="shop-char-skill-desc">${char.skillDesc}</p>` : '';
                const secretHint = isSecretLocked ? `<div class="secret-char-hint">${char.secretUnlockHint}</div>` : '';

                const card = document.createElement('div');
                card.className = `shop-card ${isEquipped ? 'equipped' : ''} ${isSecretLocked ? 'secret-locked-card' : ''}`;
                card.innerHTML = `
                    <div class="shop-card-icon" style="color:${char.color}; text-shadow:0 0 10px ${char.accentColor}">🥋</div>
                    <h3 class="shop-card-title">${char.name}</h3>
                    <span class="shop-card-subtitle">${char.title}</span>
                    ${skillBadge}
                    ${skillDesc}
                    ${secretHint}
                    <p class="shop-card-desc">${char.desc}</p>
                    <div class="shop-stats-row">
                        <span>❤️ HP: <strong>${char.baseHp}</strong></span>
                        <span>⚔️ Dano: <strong>${char.baseDamage}</strong></span>
                        <span>⚡ Vel: <strong>${char.baseSpeed}</strong></span>
                        <span>🛡️ Def: <strong>${char.baseDefense}</strong></span>
                    </div>
                    <div class="shop-price-tag">${isSecretLocked ? '🏆 RECOMPENSA SECRETA' : char.price === 0 ? 'INICIAL' : `🪙 ${char.price.toLocaleString('pt-BR')}`}</div>
                    <button class="btn-shop-action ${isEquipped ? 'btn-active' : ''} ${isSecretLocked ? 'btn-disabled' : ''}" ${isSecretLocked ? 'disabled' : ''}>
                        ${isEquipped ? 'SELECIONADO' : isUnlocked ? 'SELECIONAR' : isSecretLocked ? 'BLOQUEADO' : 'DESBLOQUEAR'}
                    </button>
                `;

                const btn = card.querySelector('.btn-shop-action');
                btn.addEventListener('click', () => {
                    audioSystem.playClick();
                    if (isEquipped || isSecretLocked) return;
                    if (isUnlocked) {
                        this.saveSystem.data.selectedCharacter = id;
                        this.saveSystem.save();
                        this.initMenuStickman();
                        this.renderShop('characters');
                        this.renderInventory();
                    } else {
                        if (this.saveSystem.data.coins >= char.price) {
                            this.saveSystem.addCoins(-char.price);
                            this.saveSystem.data.unlockedCharacters.push(id);
                            this.saveSystem.data.selectedCharacter = id;
                            this.saveSystem.save();
                            audioSystem.playBuy();
                            particleSystem.addConfetti(window.innerWidth / 2, window.innerHeight / 2, 40);
                            this.initMenuStickman();
                            this.renderShop('characters');
                            this.renderInventory();
                        } else {
                            alert("Saldo insuficiente de Skill Coins!");
                        }
                    }
                });

                container.appendChild(card);
            }
        }
    }

    // Renderização do Inventário
    renderInventory() {
        // Obter lutador com os equipamentos atuais para calcular atributos
        const charId = this.saveSystem.data.selectedCharacter || 'stickman';
        const weaponId = this.saveSystem.data.equippedWeapon || 'madeira';
        const equippedItems = this.saveSystem.data.equippedItems || [];

        const tempFighter = new Fighter({
            charId: charId,
            weaponId: weaponId,
            equippedItems: equippedItems
        });

        // Atualizar painel de atributos
        const elHp = document.getElementById('inv-stat-hp');
        const elDmg = document.getElementById('inv-stat-dmg');
        const elSpeed = document.getElementById('inv-stat-speed');
        const elDef = document.getElementById('inv-stat-def');
        const elEnergy = document.getElementById('inv-stat-energy');
        const elCrit = document.getElementById('inv-stat-crit');

        if (elHp) elHp.innerText = tempFighter.maxHp;
        if (elDmg) elDmg.innerText = tempFighter.damage;
        if (elSpeed) elSpeed.innerText = tempFighter.speed.toFixed(1);
        if (elDef) elDef.innerText = tempFighter.defense;
        if (elEnergy) elEnergy.innerText = tempFighter.maxEnergy;
        if (elCrit) elCrit.innerText = `${Math.round(tempFighter.critChance * 100)}%`;

        // Renderizar slots equipados
        const invCharName = document.getElementById('inv-char-name');
        const invWeaponName = document.getElementById('inv-weapon-name');
        if (invCharName) invCharName.innerText = tempFighter.charData.name;
        if (invWeaponName) invWeaponName.innerText = tempFighter.weapon.name;

        // Lista de itens do inventário
        const itemsList = document.getElementById('inv-items-list');
        if (itemsList) {
            itemsList.innerHTML = '';
            for (const [id, item] of Object.entries(ITEMS_DATA)) {
                const isUnlocked = this.saveSystem.data.unlockedItems.includes(id);
                if (!isUnlocked) continue;

                const isEquipped = equippedItems.includes(id);
                const row = document.createElement('div');
                row.className = `inv-item-row ${isEquipped ? 'equipped' : ''}`;
                row.innerHTML = `
                    <span class="inv-item-icon">${item.icon}</span>
                    <div class="inv-item-info">
                        <strong>${item.name}</strong>
                        <small>${item.desc}</small>
                    </div>
                    <button class="btn-inv-toggle ${isEquipped ? 'btn-unequip' : 'btn-equip'}">
                        ${isEquipped ? 'DESEQUIPAR' : 'EQUIPAR'}
                    </button>
                `;

                row.querySelector('button').addEventListener('click', () => {
                    audioSystem.playClick();
                    if (isEquipped) {
                        this.saveSystem.data.equippedItems = this.saveSystem.data.equippedItems.filter(i => i !== id);
                    } else {
                        this.saveSystem.data.equippedItems.push(id);
                    }
                    this.saveSystem.save();
                    this.renderInventory();
                });

                itemsList.appendChild(row);
            }

            if (itemsList.children.length === 0) {
                itemsList.innerHTML = '<p class="empty-state">Nenhum item comprado ainda. Visite a Loja para desbloquear acessórios!</p>';
            }
        }
    }

    renderKeybindsSettings() {
        const container = document.getElementById('settings-keybinds-list');
        if (!container) return;
        container.innerHTML = '';

        const actionLabels = {
            left: 'Mover Esquerda',
            right: 'Mover Direita',
            jump: 'Pular',
            crouch: 'Agachar',
            attack: 'Ataque Normal',
            heavy: 'Ataque Forte',
            defend: 'Defender / Bloquear',
            dodge: 'Esquivar / Dash',
            special: 'Habilidade Especial'
        };

        for (const [action, keys] of Object.entries(this.saveSystem.data.keybindings)) {
            const row = document.createElement('div');
            row.className = 'keybind-row';
            row.innerHTML = `
                <span class="keybind-action-name">${actionLabels[action] || action}</span>
                <button class="btn-keybind-val">${keys.join(' / ')}</button>
            `;

            const btn = row.querySelector('.btn-keybind-val');
            btn.addEventListener('click', () => {
                btn.innerText = 'Pressione uma tecla...';
                btn.classList.add('waiting');

                const keyHandler = (e) => {
                    e.preventDefault();
                    window.removeEventListener('keydown', keyHandler);
                    btn.classList.remove('waiting');
                    this.saveSystem.data.keybindings[action] = [e.code];
                    this.saveSystem.save();
                    this.renderKeybindsSettings();
                    audioSystem.playBuy();
                };
                window.addEventListener('keydown', keyHandler);
            });

            container.appendChild(row);
        }
    }
}

// Inicialização robusta independente do estado de carregamento do DOM
function initStickmanGame() {
    if (!window.game) {
        window.game = new Game();
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initStickmanGame);
} else {
    initStickmanGame();
}
