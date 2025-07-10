import { CONSTANTS } from "./constants";
import { Tile, Enemy, Character } from "./types";

// =============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================
export const tileToScreen = (x: number, y: number) => ({
    x: (x - y) * CONSTANTS.TILE_WIDTH / 2,
    y: (x + y) * CONSTANTS.TILE_HEIGHT / 2
});

export const screenToTile = (screenX: number, screenY: number) => ({
    x: Math.floor((screenX / (CONSTANTS.TILE_WIDTH / 2) + screenY / (CONSTANTS.TILE_HEIGHT / 2)) / 2),
    y: Math.floor((screenY / (CONSTANTS.TILE_HEIGHT / 2) - screenX / (CONSTANTS.TILE_WIDTH / 2)) / 2)
});

export const calculateDistance = (x1: number, y1: number, x2: number, y2: number) =>
    Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));

export const isAdjacentToEnemy = (charX: number, charY: number, enemyX: number, enemyY: number) =>
    (Math.abs(charX - enemyX) === 1 && charY === enemyY) ||
    (Math.abs(charY - enemyY) === 1 && charX === enemyX);

export const updateTilesOccupancy = (
    tilesList: Tile[],
    char: Character,
    enemiesList: Enemy[],
    itemsOnMap: { item: any, x: number, y: number }[]
) => {
    return tilesList.map(tile => {
        const occupied = tile.type === 'water' || tile.type === 'stone' ||
            (tile.x === char.x && tile.y === char.y) ||
            enemiesList.some(e => e.x === tile.x && e.y === tile.y) ||
            itemsOnMap.some(i => i.x === tile.x && i.y === tile.y);
        return { ...tile, occupied };
    });
};

export const findPath = (
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    tiles: Tile[],
    enemies: Enemy[],
    itemsOnMap: { item: any, x: number, y: number }[]
) => {
    const path: { x: number, y: number }[] = [];
    let currentX = startX, currentY = startY;
    const isTargetEnemy = enemies.some(e => e.x === targetX && e.y === targetY);
    const isTargetItem = itemsOnMap.some(i => i.x === targetX && i.y === targetY);

    while (currentX !== targetX || currentY !== targetY) {
        if (currentX !== targetX) {
            const nextX = currentX + (targetX > currentX ? 1 : -1);
            const tile = tiles.find(t => t.x === nextX && t.y === currentY);
            if (tile && !tile.occupied && !enemies.some(e => e.x === nextX && e.y === currentY)) {
                currentX = nextX;
                path.push({ x: currentX, y: currentY });
                if ((isTargetEnemy || isTargetItem) && nextX === targetX && currentY === targetY) break;
            } else break;
        }

        if (currentY !== targetY) {
            const nextY = currentY + (targetY > currentY ? 1 : -1);
            const tile = tiles.find(t => t.x === currentX && t.y === nextY);
            if (tile && !tile.occupied && !enemies.some(e => e.x === currentX && e.y === nextY)) {
                currentY = nextY;
                path.push({ x: currentX, y: currentY });
                if ((isTargetEnemy || isTargetItem) && currentX === targetX && nextY === targetY) break;
            } else break;
        }
    }
    return path;
};

export const getCharacterDirection = (currentX: number, currentY: number, nextX: number, nextY: number) => {
    const dx = nextX - currentX;
    const dy = nextY - currentY;

    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'right' : 'left';
    } else {
        return dy > 0 ? 'down' : 'up';
    }
};