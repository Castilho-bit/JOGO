/**
 * Sistema de Salvamento (localStorage) e Gerenciamento de UI / Loja / Inventário
 */

class SaveSystem {
    constructor() {
        this.STORAGE_KEY = 'stickman_fighter_save_v1';
        this.defaultData = {
            coins: 1500, // Saldo inicial generoso para permitir compras e testes
            xp: 0,
            level: 1,
            wins: 0,
            losses: 0,
            unlockedCharacters: ['stickman'],
            selectedCharacter: 'stickman',
            unlockedWeapons: ['madeira'],
            equippedWeapon: 'madeira',
            unlockedItems: [],
            equippedItems: [],
            keybindings: {
                left: ['KeyA', 'ArrowLeft'],
                right: ['KeyD', 'ArrowRight'],
                jump: ['KeyW', 'ArrowUp'],
                crouch: ['KeyS', 'ArrowDown'],
                attack: ['KeyJ'],
                heavy: ['KeyK'],
                defend: ['KeyL'],
                dodge: ['Space'],
                special: ['KeyE']
            },
            volume: 0.7,
            muted: false
        };
        this.data = this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...this.defaultData, ...parsed };
            }
        } catch (e) {
            console.error("Erro ao carregar save:", e);
        }
        return JSON.parse(JSON.stringify(this.defaultData));
    }

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            this.updateHeaderStats();
        } catch (e) {
            console.error("Erro ao salvar dados:", e);
        }
    }

    reset() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        this.save();
    }

    addCoins(amount) {
        this.data.coins = Math.max(0, this.data.coins + amount);
        this.save();
        if (amount > 0) audioSystem.playCoins();
        return this.data.coins;
    }

    addXP(amount) {
        this.data.xp += amount;
        const requiredXp = this.getXpForNextLevel();
        if (this.data.xp >= requiredXp) {
            this.data.xp -= requiredXp;
            this.data.level++;
            audioSystem.playBuy();
            particleSystem.addConfetti(window.innerWidth / 2, window.innerHeight / 2, 80);
            alert(`⭐ SUBIU DE NÍVEL! Você alcançou o Nível ${this.data.level}! Atributos e itens liberados!`);
        }
        this.save();
    }

    getXpForNextLevel() {
        // Curva de XP balanceada: Nível 1 precisa de 920 XP, Nível 2 ~1.940 XP, Nível 3 ~3.080 XP
        return 800 + (this.data.level - 1) * 750 + Math.floor(Math.pow(this.data.level, 1.7) * 120);
    }

    recordBattleResult(won) {
        if (won) {
            this.data.wins++;
        } else {
            this.data.losses++;
        }
        this.save();
    }

    updateHeaderStats() {
        const coinEls = document.querySelectorAll('.val-coins');
        const levelEls = document.querySelectorAll('.val-level');
        const winEls = document.querySelectorAll('.val-wins');
        const lossEls = document.querySelectorAll('.val-losses');
        const xpBar = document.getElementById('header-xp-fill');
        const xpText = document.getElementById('header-xp-text');

        coinEls.forEach(el => el.innerText = this.data.coins.toLocaleString('pt-BR'));
        levelEls.forEach(el => el.innerText = this.data.level);
        winEls.forEach(el => el.innerText = this.data.wins);
        lossEls.forEach(el => el.innerText = this.data.losses);

        if (xpBar && xpText) {
            const req = this.getXpForNextLevel();
            const pct = Math.min(100, Math.round((this.data.xp / req) * 100));
            xpBar.style.width = `${pct}%`;
            xpText.innerText = `${this.data.xp} / ${req} XP (${pct}%)`;
        }
    }
}

/**
 * Gerenciador de Entradas (Teclado e Controles Virtuais Touch)
 */
class InputManager {
    constructor(saveSystem) {
        this.saveSystem = saveSystem;
        this.keysDown = {};
        this.actionListeners = {};

        this.initKeyboard();
        this.initTouchControls();
    }

    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            // Evitar scroll com espaço ou setas
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
            this.keysDown[e.code] = true;
            this.emitAction(this.getActionFromKey(e.code), true);
        });

        window.addEventListener('keyup', (e) => {
            this.keysDown[e.code] = false;
            this.emitAction(this.getActionFromKey(e.code), false);
        });
    }

    getActionFromKey(code) {
        const binds = this.saveSystem.data.keybindings;
        for (const [action, keys] of Object.entries(binds)) {
            if (keys.includes(code)) return action;
        }
        return null;
    }

    isActionActive(action) {
        const binds = this.saveSystem.data.keybindings[action] || [];
        return binds.some(k => this.keysDown[k]);
    }

    resetKeys() {
        this.keysDown = {};
    }

    onAction(action, callback) {
        if (!this.actionListeners[action]) this.actionListeners[action] = [];
        this.actionListeners[action].push(callback);
    }

    emitAction(action, isPressed) {
        if (!action || !this.actionListeners[action]) return;
        this.actionListeners[action].forEach(cb => cb(isPressed));
    }

    initTouchControls() {
        const touchMappings = [
            { id: 'btn-touch-left', action: 'left' },
            { id: 'btn-touch-right', action: 'right' },
            { id: 'btn-touch-jump', action: 'jump' },
            { id: 'btn-touch-crouch', action: 'crouch' },
            { id: 'btn-touch-attack', action: 'attack' },
            { id: 'btn-touch-heavy', action: 'heavy' },
            { id: 'btn-touch-defend', action: 'defend' },
            { id: 'btn-touch-dodge', action: 'dodge' },
            { id: 'btn-touch-special', action: 'special' }
        ];

        touchMappings.forEach(({ id, action }) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const startAction = (e) => {
                e.preventDefault();
                audioSystem.ensureContext();
                this.keysDown[action] = true;
                this.emitAction(action, true);
                btn.classList.add('active');
            };

            const endAction = (e) => {
                e.preventDefault();
                this.keysDown[action] = false;
                this.emitAction(action, false);
                btn.classList.remove('active');
            };

            btn.addEventListener('touchstart', startAction, { passive: false });
            btn.addEventListener('touchend', endAction, { passive: false });
            btn.addEventListener('mousedown', startAction);
            btn.addEventListener('mouseup', endAction);
            btn.addEventListener('mouseleave', endAction);
        });
    }
}
