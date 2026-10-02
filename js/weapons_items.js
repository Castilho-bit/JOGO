/**
 * Banco de Dados de Armas, Itens e Personagens
 * Contém atributos, custos, tipos e regras de cálculo de status.
 */

const CHARACTERS_DATA = {
    stickman: {
        id: 'stickman',
        name: 'Stickman',
        title: 'O Iniciante Determinado',
        desc: 'Equilibrado em todos os aspectos. Perfeito para dominar as técnicas básicas de combate.',
        baseHp: 100,
        baseDamage: 15,
        baseSpeed: 6.0,
        baseDefense: 5,
        baseEnergy: 100,
        critChance: 0.05,
        price: 0,
        color: '#ffffff',
        accentColor: '#00f0ff',
        unlocked: true,
        style: 'standard'
    },
    guerreiro: {
        id: 'guerreiro',
        name: 'Guerreiro',
        title: 'Muralha de Ferro',
        desc: 'Grande vigor e defesa bruta. Aguenta golpes severos enquanto revida com punhos pesados.',
        baseHp: 150,
        baseDamage: 22,
        baseSpeed: 5.0,
        baseDefense: 16,
        baseEnergy: 90,
        critChance: 0.08,
        price: 3000,
        color: '#ff3344',
        accentColor: '#ff8800',
        unlocked: false,
        style: 'warrior'
    },
    ninja: {
        id: 'ninja',
        name: 'Ninja',
        title: 'Vento Silencioso',
        desc: 'Velocidade estonteante e rápida regeneração de energia. Especialista em esquivas e ataques múltiplos.',
        baseHp: 90,
        baseDamage: 18,
        baseSpeed: 8.5,
        baseDefense: 4,
        baseEnergy: 130,
        critChance: 0.15,
        price: 6000,
        color: '#00e5ff',
        accentColor: '#1d3557',
        unlocked: false,
        style: 'ninja'
    },
    samurai: {
        id: 'samurai',
        name: 'Samurai',
        title: 'Lâmina Honrada',
        desc: 'Domínio magistral do corte. Possui alto poder de ataque e equilíbrio entre velocidade e robustez.',
        baseHp: 120,
        baseDamage: 28,
        baseSpeed: 6.8,
        baseDefense: 9,
        baseEnergy: 110,
        critChance: 0.12,
        price: 12000,
        color: '#ffb703',
        accentColor: '#d62828',
        unlocked: false,
        style: 'samurai'
    },
    shadow: {
        id: 'shadow',
        name: 'Shadow',
        title: 'Entidade do Vazio',
        desc: 'Guerreiro forjado nas trevas com poder cósmico. Seus golpes cortam o tecido do espaço.',
        baseHp: 135,
        baseDamage: 35,
        baseSpeed: 7.8,
        baseDefense: 12,
        baseEnergy: 150,
        critChance: 0.20,
        price: 30000,
        color: '#c77dff',
        accentColor: '#7b2cbf',
        unlocked: false,
        style: 'shadow'
    }
};

const WEAPONS_DATA = {
    madeira: {
        id: 'madeira',
        name: 'Espada de Madeira',
        type: 'sword',
        desc: 'Espada de treino feita de carvalho denso. Leve e fácil de manejar.',
        damage: 10,
        speed: 10,
        critBonus: 0,
        price: 0,
        color: '#b08968',
        glowColor: '#7f5539',
        bladeLength: 42,
        bladeWidth: 4,
        unlocked: true
    },
    ferro: {
        id: 'ferro',
        name: 'Espada de Ferro',
        type: 'sword',
        desc: 'Forjada em aço temperado com fio afiado e cabo reforçado.',
        damage: 25,
        speed: 8,
        critBonus: 0.03,
        price: 1000,
        color: '#d6d6d6',
        glowColor: '#a8dadc',
        bladeLength: 48,
        bladeWidth: 5,
        unlocked: false
    },
    katana: {
        id: 'katana',
        name: 'Katana',
        type: 'sword',
        desc: 'Lâmina curvada tradicional com corte milimétrico e velocidade superior.',
        damage: 40,
        speed: 12,
        critBonus: 0.08,
        price: 5000,
        color: '#f8f9fa',
        glowColor: '#00f0ff',
        bladeLength: 52,
        bladeWidth: 3.5,
        unlocked: false
    },
    flamejante: {
        id: 'flamejante',
        name: 'Espada Flamejante',
        type: 'sword',
        desc: 'Emite labaredas ardentes e queima os oponentes com calor infernal.',
        damage: 70,
        speed: 10,
        critBonus: 0.12,
        price: 20000,
        color: '#ff5400',
        glowColor: '#ff0055',
        specialEffect: 'fire',
        bladeLength: 54,
        bladeWidth: 6,
        unlocked: false
    },
    sombria: {
        id: 'sombria',
        name: 'Espada Sombria',
        type: 'sword',
        desc: 'Forjada no abismo das trevas. Absorve a luz ambiente e desintegra defesas.',
        damage: 100,
        speed: 9,
        critBonus: 0.18,
        price: 50000,
        color: '#10002b',
        glowColor: '#9d4edd',
        specialEffect: 'shadow',
        bladeLength: 56,
        bladeWidth: 6.5,
        unlocked: false
    }
};

const ITEMS_DATA = {
    luvas_guerreiro: {
        id: 'luvas_guerreiro',
        name: 'Luvas do Guerreiro',
        slot: 'gloves',
        desc: 'Aumenta a firmeza dos punhos, concedendo +10% de dano total.',
        bonusDamagePct: 0.10,
        price: 800,
        icon: '🥊',
        unlocked: false
    },
    botas_ninja: {
        id: 'botas_ninja',
        name: 'Botas Ninja',
        slot: 'boots',
        desc: 'Solas silenciosas que aumentam em +15% a velocidade de movimento.',
        bonusSpeedPct: 0.15,
        price: 1200,
        icon: '🥷',
        unlocked: false
    },
    amuleto_sombrio: {
        id: 'amuleto_sombrio',
        name: 'Amuleto Sombrio',
        slot: 'amulet',
        desc: 'Pedra mística que canaliza energia obscura, concedendo +5% de chance de crítico.',
        bonusCrit: 0.05,
        price: 2500,
        icon: '🔮',
        unlocked: false
    },
    armadura_placas: {
        id: 'armadura_placas',
        name: 'Armadura de Placas',
        slot: 'armor',
        desc: 'Proteção metálica peitoral que concede +30 de Vida máxima e +10 de Defesa.',
        bonusHp: 30,
        bonusDef: 10,
        price: 3500,
        icon: '🛡️',
        unlocked: false
    },
    capacete_imperial: {
        id: 'capacete_imperial',
        name: 'Capacete Imperial',
        slot: 'helmet',
        desc: 'Elmo nobre que melhora o foco e fôlego, concedendo +20 de Vida e +20 de Energia.',
        bonusHp: 20,
        bonusEnergy: 20,
        price: 2000,
        icon: '🪖',
        unlocked: false
    }
};
