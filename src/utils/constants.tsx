// =============================================
// КОНСТАНТЫ ИГРЫ И ПРЕДМЕТЫ
// =============================================
export const CONSTANTS = {
    TILE_WIDTH: 64, TILE_HEIGHT: 32, CHARACTER_WIDTH: 32, CHARACTER_HEIGHT: 48,
    ENEMY_WIDTH: 32, ENEMY_HEIGHT: 48, PATH_DOT_RADIUS: 2,
    TARGET_HIGHLIGHT_COLOR: '#ffff00', TARGET_HIGHLIGHT_WIDTH: 3,
    CANVAS_WIDTH: 800, CANVAS_HEIGHT: 600, MAP_WIDTH: 50, MAP_HEIGHT: 50,
    ENEMY_COUNT: 70, MOVE_INTERVAL: 200, ENEMY_CHASE_RADIUS: 4,
    ENEMY_MOVE_INTERVAL: 500, RENDER_RADIUS: 17, HEALTH_ORB_RADIUS: 40,
    HEALTH_ORB_MARGIN: 20, ENEMY_DAMAGE: 10, DAMAGE_COOLDOWN: 1000,
    INVENTORY_SLOT_SIZE: 50, STONE_WIDTH: 32, STONE_HEIGHT: 68,
    INVENTORY_PADDING: 10,
    ITEM_DROP_CHANCE: 0.3
};

export const ITEMS = [
    { id: 'sword1', name: 'Ржавый меч', icon: '🗡️', type: 'weapon', effect: { damageBonus: 10 } },
    { id: 'axe1', name: 'Топор воина', icon: '🪓', type: 'weapon', effect: { damageBonus: 15 } },
    { id: 'armor1', name: 'Кожаная броня', icon: '🧥', type: 'armor', effect: { defenseBonus: 5 } },
    { id: 'armor2', name: 'Кольчуга', icon: '🦺', type: 'armor', effect: { defenseBonus: 10 } },
    { id: 'helmet1', name: 'Кожаный шлем', icon: '⛑️', type: 'helmet', effect: { defenseBonus: 3 } },
    { id: 'helmet2', name: 'Рогатый шлем', icon: '🤠', type: 'helmet', effect: { defenseBonus: 5 } },
    { id: 'boots1', name: 'Кожаные ботинки', icon: '👞', type: 'boots', effect: { defenseBonus: 2 } },
    { id: 'boots2', name: 'Сапоги', icon: '👢', type: 'boots', effect: { defenseBonus: 4 } },
    { id: 'healthpotion1', name: 'Зелье здоровья', icon: '🧪', type: 'potion', effect: { healthBonus: 50 } }
];