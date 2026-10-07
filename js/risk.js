/**
 * Sistema de Risco (Mini-game de Sorte com Moedas Virtuais)
 * Três modalidades de risco selecionáveis pelo jogador:
 * - 2x Moedas: 10% de chance de ganhar (Retorno 2x)
 * - 5x Moedas: 5% de chance de ganhar (Retorno 5x)
 * - 50x Moedas: 1% de chance de ganhar (Retorno 50x)
 * Animação real de roleta com desaceleração e efeito sonoro de ticker.
 */

class RiskSystem {
    constructor() {
        this.tiers = {
            '2x': {
                id: '2x',
                name: 'Multiplicador 2x',
                badge: '🥈 DOBRO',
                winChance: 0.10, // 10%
                multiplier: 2,
                color: '#00f0ff',
                riskLabel: 'Moderado',
                loseChanceText: '90%'
            },
            '5x': {
                id: '5x',
                name: 'Multiplicador 5x',
                badge: '💎 5x OURO',
                winChance: 0.05, // 5%
                multiplier: 5,
                color: '#ffd166',
                riskLabel: 'Alto',
                loseChanceText: '95%'
            },
            '50x': {
                id: '50x',
                name: 'Jackpot 50x',
                badge: '👑 50x JACKPOT',
                winChance: 0.01, // 1%
                multiplier: 50,
                color: '#ff0055',
                riskLabel: 'Extremo',
                loseChanceText: '99%'
            }
        };

        this.currentTierKey = '2x';
        this.currentBet = 500;
        this.isSpinning = false;
    }

    getCurrentTier() {
        return this.tiers[this.currentTierKey] || this.tiers['2x'];
    }

    setTier(tierKey) {
        if (this.isSpinning || !this.tiers[tierKey]) return;
        this.currentTierKey = tierKey;
        this.updateUI();
    }

    setBet(amount) {
        if (this.isSpinning) return;
        this.currentBet = Math.max(10, Math.floor(amount));
        this.updateUI();
    }

    updateUI() {
        const tier = this.getCurrentTier();
        const betInput = document.getElementById('risk-bet-input');
        const betDisplay = document.getElementById('risk-bet-display');
        const winPayout = document.getElementById('risk-payout-display');
        const chanceDisplay = document.getElementById('risk-chance-label');
        const loseDisplay = document.getElementById('risk-lose-label');
        const tierTitle = document.getElementById('risk-tier-title');

        if (betInput) betInput.value = this.currentBet;
        if (betDisplay) betDisplay.innerText = this.currentBet.toLocaleString('pt-BR');
        if (winPayout) winPayout.innerText = (this.currentBet * tier.multiplier).toLocaleString('pt-BR');
        if (chanceDisplay) chanceDisplay.innerText = `${Math.round(tier.winChance * 100)}%`;
        if (loseDisplay) loseDisplay.innerText = tier.loseChanceText;
        if (tierTitle) tierTitle.innerText = `${tier.name} (${Math.round(tier.winChance * 100)}% de Chance)`;

        // Atualizar estado ativo dos botões de tier
        document.querySelectorAll('.btn-risk-tier').forEach(btn => {
            const t = btn.getAttribute('data-tier');
            if (t === this.currentTierKey) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Garantir visualização inicial centralizada na fita
        if (!this.isSpinning) {
            this.initPreviewStrip();
        }
    }

    initPreviewStrip() {
        const reelStrip = document.getElementById('risk-reel-strip');
        if (!reelStrip) return;

        const tier = this.getCurrentTier();
        this.buildRouletteStrip(reelStrip, false, tier);

        const slotWidth = 130;
        const slotMargin = 5;
        const slotPitch = slotWidth + (slotMargin * 2); // 140px
        const previewIndex = 2; // Exibe um slot demonstrativo inicial sob a seta
        const targetCenter = previewIndex * slotPitch + slotMargin + (slotWidth / 2);
        const containerWidth = reelStrip.parentElement ? reelStrip.parentElement.clientWidth : 600;
        const targetOffset = targetCenter - (containerWidth / 2);

        reelStrip.style.transition = 'none';
        reelStrip.style.transform = `translateX(-${targetOffset}px)`;
    }

    promptConfirmBet(saveSystem) {
        if (this.isSpinning) return;

        const coins = saveSystem.data.coins;
        const tier = this.getCurrentTier();

        if (this.currentBet <= 0) {
            alert("O valor da aposta deve ser maior que zero!");
            return;
        }
        if (this.currentBet > coins) {
            alert(`Saldo insuficiente! Você possui ${coins.toLocaleString('pt-BR')} Skill Coins.`);
            return;
        }

        // Preencher e exibir modal de confirmação
        const modal = document.getElementById('risk-confirm-modal');
        const textCoins = document.getElementById('risk-modal-coins');
        const textWinVal = document.getElementById('risk-modal-win-val');
        const textRateWin = document.getElementById('risk-modal-win-rate');
        const textRateLose = document.getElementById('risk-modal-lose-rate');
        const textTierName = document.getElementById('risk-modal-tier-name');

        if (textCoins) textCoins.innerText = this.currentBet.toLocaleString('pt-BR');
        if (textWinVal) textWinVal.innerText = (this.currentBet * tier.multiplier).toLocaleString('pt-BR');
        if (textRateWin) textRateWin.innerText = `${Math.round(tier.winChance * 100)}%`;
        if (textRateLose) textRateLose.innerText = tier.loseChanceText;
        if (textTierName) textTierName.innerText = tier.name;

        if (modal) modal.classList.remove('hidden');
    }

    cancelConfirm() {
        const modal = document.getElementById('risk-confirm-modal');
        if (modal) modal.classList.add('hidden');
    }

    executeSpin(saveSystem, onFinish) {
        const modal = document.getElementById('risk-confirm-modal');
        if (modal) modal.classList.add('hidden');

        if (this.isSpinning) return;
        const coins = saveSystem.data.coins;
        const tier = this.getCurrentTier();

        if (this.currentBet > coins || this.currentBet <= 0) return;

        // Deduzir aposta
        saveSystem.addCoins(-this.currentBet);
        this.isSpinning = true;

        const statusBox = document.getElementById('risk-status-text');
        const reelStrip = document.getElementById('risk-reel-strip');
        const betControls = document.getElementById('risk-controls-box');

        if (betControls) betControls.classList.add('disabled-action');

        // Determinar antecipadamente o resultado lógico com a probabilidade real
        const roll = Math.random(); // [0.0, 1.0)
        const won = roll < tier.winChance;

        // Construir a fita da roleta com itens (garantindo que o item 28 é exatamente o resultado lógico)
        const targetIndex = 28;
        if (reelStrip) {
            this.buildRouletteStrip(reelStrip, won, tier, targetIndex);
        }

        // Animação da Roleta Girando
        if (statusBox) {
            statusBox.innerHTML = `<span class="countdown-pulse">ROLETANDO... BOA SORTE!</span>`;
        }

        // Efeito sonoro contínuo de roleta acelerando e desacelerando
        let tickCount = 0;
        let tickDelay = 60;
        const playTicks = () => {
            if (!this.isSpinning) return;
            audioSystem.playRiskTick();
            tickCount++;
            if (tickCount < 26) {
                tickDelay += 12; // desaceleração
                setTimeout(playTicks, tickDelay);
            }
        };
        setTimeout(playTicks, 100);

        // Disparar animação CSS na fita da roleta com alinhamento 100% exato sob a seta
        if (reelStrip) {
            reelStrip.style.transition = 'none';
            reelStrip.style.transform = 'translateX(0px)';
            // Forçar reflow
            void reelStrip.offsetWidth;

            // Cada slot tem 130px de largura com margem de 5px de cada lado (passo total = 140px)
            const slotWidth = 130;
            const slotMargin = 5;
            const slotPitch = slotWidth + (slotMargin * 2); // 140px
            const containerWidth = reelStrip.parentElement ? reelStrip.parentElement.clientWidth : 600;

            // Posição central do slot de destino a partir do início da fita
            const targetCenter = targetIndex * slotPitch + slotMargin + (slotWidth / 2);
            // Deslocamento para colocar exatamente o centro do slot sob o centro do container (onde a seta fixa está)
            const targetOffset = targetCenter - (containerWidth / 2);

            reelStrip.style.transition = 'transform 4.5s cubic-bezier(0.12, 0.8, 0.2, 1)';
            reelStrip.style.transform = `translateX(-${targetOffset}px)`;
        }

        // Conclusão do Sorteio sincronizada com a parada exata sob a seta
        setTimeout(() => {
            if (won) {
                const prize = this.currentBet * tier.multiplier;
                saveSystem.addCoins(prize);
                audioSystem.playRiskWon();

                if (statusBox) {
                    statusBox.innerHTML = `
                        <div class="result-win-box">
                            <h2 class="neon-gold-title">🎉 VOCÊ GANHOU!</h2>
                            <p class="win-prize-text">+${prize.toLocaleString('pt-BR')} SKILL COINS!</p>
                            <span class="sub-alert">${tier.name} Conquistado com Sucesso!</span>
                        </div>
                    `;
                }

                particleSystem.addConfetti(window.innerWidth / 2, window.innerHeight / 2, 120);
            } else {
                audioSystem.playRiskLost();
                if (statusBox) {
                    statusBox.innerHTML = `
                        <div class="result-lose-box">
                            <h2 class="neon-red-title">💀 NÃO FOI DESSA VEZ!</h2>
                            <p class="lose-subtext">-${this.currentBet.toLocaleString('pt-BR')} Skill Coins</p>
                            <span class="sub-alert">Chance nesta rodada: ${Math.round(tier.winChance * 100)}% de ganho</span>
                        </div>
                    `;
                }
            }

            this.isSpinning = false;
            if (betControls) betControls.classList.remove('disabled-action');
            if (onFinish) onFinish(won);
        }, 4700);
    }

    buildRouletteStrip(stripEl, isWin, tier, targetIndex = 28) {
        stripEl.innerHTML = '';
        const totalItems = 45;

        const dummySymbols = [
            { text: '💀 PERDEU', color: '#ff0055', isWin: false },
            { text: '🥈 2x', color: '#00f0ff', isWin: false },
            { text: '💀 PERDEU', color: '#ff0055', isWin: false },
            { text: '💎 5x', color: '#ffd166', isWin: false },
            { text: '💀 PERDEU', color: '#ff0055', isWin: false },
            { text: '👑 50x', color: '#ff0055', isWin: false },
            { text: '💀 PERDEU', color: '#ff0055', isWin: false }
        ];

        for (let i = 0; i < totalItems; i++) {
            const item = document.createElement('div');
            item.className = 'roulette-slot';

            if (i === targetIndex) {
                // Slot de destino final que para exatamente sob a seta indicadora
                if (isWin) {
                    item.className += ' slot-jackpot';
                    item.innerHTML = `<span class="slot-badge">${tier.badge}</span><strong>GANHOU!</strong>`;
                    item.style.borderColor = tier.color;
                } else {
                    item.className += ' slot-loss';
                    item.innerHTML = `<span class="slot-badge">💀</span><strong>PERDEU</strong>`;
                }
            } else {
                const sample = dummySymbols[i % dummySymbols.length];
                item.innerHTML = `<span class="slot-badge">${sample.text}</span>`;
            }

            stripEl.appendChild(item);
        }
    }
}
