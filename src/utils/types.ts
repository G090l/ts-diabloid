// =============================================
// ИНТЕРФЕЙСЫ ДАННЫХ
// =============================================
export interface Tile {
    x: number;
    y: number;
    type: 'grass' | 'stone' | 'water';
    occupied: boolean;
}

export interface Enemy {
    x: number;
    y: number;
    health: number;
    chasing: boolean;
}

export interface Character {
    x: number;
    y: number;
    moving: boolean;
    targetX: number | null;
    targetY: number | null;
    path: { x: number; y: number }[];
    health: number;
    maxHealth: number;
}

export interface ItemEffect {
    healthBonus?: number;
    damageBonus?: number;
    defenseBonus?: number;
}

export type ItemType = 'weapon' | 'armor' | 'helmet' | 'boots' | 'potion';

export interface Item {
    id: string;
    name: string;
    icon: string;
    type: ItemType;
    effect: ItemEffect;
}

export interface ItemOnMap {
    item: Item;
    x: number;
    y: number;
}

export interface EquippedItems {
    helmet: Item | null;
    armor: Item | null;
    weapon: Item | null;
    boots: Item | null;
    potion: Item | null;
}