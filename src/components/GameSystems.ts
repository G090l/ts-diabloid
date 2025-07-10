import { CONSTANTS, ITEMS } from '../utils/constants';
import { Tile, Enemy, Character, Item, ItemOnMap, EquippedItems } from '../utils/types';
import {
    tileToScreen,
    screenToTile,
    calculateDistance,
    isAdjacentToEnemy,
    updateTilesOccupancy,
    findPath,
    getCharacterDirection
} from '../utils/gameUtils';
import { useEffect, useState, useCallback } from 'react';
// =============================================
// СИСТЕМЫ ИГРЫ
// =============================================
export const useMovementSystem = (
    character: Character,
    setCharacter: React.Dispatch<React.SetStateAction<Character>>,
    tiles: Tile[],
    enemies: Enemy[],
    itemsOnMap: ItemOnMap[],
    inventoryItems: (Item | null)[],
    setInventoryItems: React.Dispatch<React.SetStateAction<(Item | null)[]>>,
    setItemsOnMap: React.Dispatch<React.SetStateAction<ItemOnMap[]>>,
    gameOver: boolean
) => {
    useEffect(() => {
        if (!character.moving || character.path.length === 0 || gameOver) return;
        const moveInterval = setInterval(() => {
            setCharacter(prev => {
                if (prev.path.length === 0) return { ...prev, moving: false, targetX: null, targetY: null, path: [] };
                const [nextStep, ...remainingPath] = prev.path;
                const tile = tiles.find(t => t.x === nextStep.x && t.y === nextStep.y);
                if (!tile || tile.occupied || enemies.some(e => e.x === nextStep.x && e.y === nextStep.y)) {
                    return { ...prev, moving: false, targetX: null, targetY: null, path: [] };
                }

                const pickedUpItemIndex = itemsOnMap.findIndex(i => i.x === nextStep.x && i.y === nextStep.y);
                if (pickedUpItemIndex !== -1) {
                    const pickedUpItem = itemsOnMap[pickedUpItemIndex];
                    const emptySlotIndex = inventoryItems.findIndex(item => item === null);
                    if (emptySlotIndex !== -1) {
                        const newInventory = [...inventoryItems];
                        newInventory[emptySlotIndex] = pickedUpItem.item;
                        setInventoryItems(newInventory);
                        setItemsOnMap(prev => prev.filter((_, i) => i !== pickedUpItemIndex));
                    }
                }

                return { ...prev, x: nextStep.x, y: nextStep.y, path: remainingPath };
            });
        }, CONSTANTS.MOVE_INTERVAL);
        return () => clearInterval(moveInterval);
    }, [character.moving, character.path, tiles, enemies, gameOver, itemsOnMap, inventoryItems]);
};

export const useEnemyMovementSystem = (
    enemies: Enemy[],
    setEnemies: React.Dispatch<React.SetStateAction<Enemy[]>>,
    character: Character,
    tiles: Tile[]
) => {
    useEffect(() => {
        const moveEnemies = () => {
            setEnemies(prev => {
                const newEnemies = [...prev];
                const occupiedTiles = new Set<string>();
                newEnemies.forEach(enemy => occupiedTiles.add(`${enemy.x},${enemy.y}`));

                return prev.map(enemy => {
                    const distance = calculateDistance(enemy.x, enemy.y, character.x, character.y);
                    if (distance > CONSTANTS.ENEMY_CHASE_RADIUS) return { ...enemy, chasing: false };

                    const directions = [
                        { dx: Math.sign(character.x - enemy.x), dy: 0 },
                        { dx: 0, dy: Math.sign(character.y - enemy.y) }
                    ].sort(() => Math.random() - 0.5);

                    for (const dir of directions) {
                        const newX = enemy.x + dir.dx, newY = enemy.y + dir.dy;
                        const tileKey = `${newX},${newY}`;

                        if (!occupiedTiles.has(tileKey)) {
                            const tile = tiles.find(t => t.x === newX && t.y === newY);
                            if (tile && !tile.occupied) {
                                occupiedTiles.delete(`${enemy.x},${enemy.y}`);
                                occupiedTiles.add(tileKey);
                                return { ...enemy, x: newX, y: newY, chasing: true };
                            }
                        }
                    }
                    return { ...enemy, chasing: false };
                });
            });
        };

        const interval = setInterval(moveEnemies, CONSTANTS.ENEMY_MOVE_INTERVAL);
        return () => clearInterval(interval);
    }, [character.x, character.y, tiles]);
};

export const useCombatSystem = (
    enemies: Enemy[],
    character: Character,
    setCharacter: React.Dispatch<React.SetStateAction<Character>>,
    setGameOver: React.Dispatch<React.SetStateAction<boolean>>,
    lastDamageTime: number,
    setLastDamageTime: React.Dispatch<React.SetStateAction<number>>,
    equippedItems: EquippedItems,
    gameOver: boolean
) => {
    useEffect(() => {
        if (gameOver) return;
        const checkDamage = () => {
            const now = Date.now();
            if (now - lastDamageTime < CONSTANTS.DAMAGE_COOLDOWN) return;
            const adjacentEnemies = enemies.filter(e => isAdjacentToEnemy(character.x, character.y, e.x, e.y));
            if (adjacentEnemies.length > 0) {
                let defenseBonus = 0;
                if (equippedItems.armor) defenseBonus += equippedItems.armor.effect.defenseBonus || 0;
                if (equippedItems.helmet) defenseBonus += equippedItems.helmet.effect.defenseBonus || 0;
                if (equippedItems.boots) defenseBonus += equippedItems.boots.effect.defenseBonus || 0;

                const damage = Math.max(1, CONSTANTS.ENEMY_DAMAGE - defenseBonus);

                setCharacter(prev => {
                    const newHealth = Math.max(0, prev.health - damage);
                    if (newHealth <= 0) setGameOver(true);
                    return { ...prev, health: newHealth };
                });
                setLastDamageTime(now);
            }
        };
        const interval = setInterval(checkDamage, 100);
        return () => clearInterval(interval);
    }, [enemies, character.x, character.y, lastDamageTime, gameOver, equippedItems]);
};

export const useAttackSystem = (
    equippedItems: EquippedItems,
    itemsOnMap: ItemOnMap[],
    tiles: Tile[]
) => {
    const attackEnemy = useCallback((enemyX: number, enemyY: number, setEnemies: React.Dispatch<React.SetStateAction<Enemy[]>>, setItemsOnMap: React.Dispatch<React.SetStateAction<ItemOnMap[]>>) => {
        let damageBonus = 0;
        if (equippedItems.weapon) {
            damageBonus = equippedItems.weapon.effect.damageBonus || 0;
        }
        const damage = 25 + damageBonus;

        setEnemies(prevEnemies => {
            const newEnemies = prevEnemies.map(e =>
                e.x === enemyX && e.y === enemyY ?
                    (e.health - damage <= 0 ? null : { ...e, health: e.health - damage }) : e
            ).filter(Boolean) as Enemy[];

            const wasKilled = !newEnemies.some(e => e.x === enemyX && e.y === enemyY) &&
                prevEnemies.some(e => e.x === enemyX && e.y === enemyY);

            if (wasKilled) {
                const tile = tiles.find(t => t.x === enemyX && t.y === enemyY);
                const isWater = tile?.type === 'water';
                const hasItem = itemsOnMap.some(i => i.x === enemyX && i.y === enemyY);

                if (!hasItem && !isWater && Math.random() < CONSTANTS.ITEM_DROP_CHANCE) {
                    setItemsOnMap(prev => {
                        const itemAlreadyExists = prev.some(i => i.x === enemyX && i.y === enemyY);
                        if (!itemAlreadyExists) {
                            const randomItem: Item = ITEMS[Math.floor(Math.random() * ITEMS.length)] as Item;
                            return [...prev, { item: randomItem, x: enemyX, y: enemyY }];
                        }
                        return prev;
                    });
                }
            }

            return newEnemies;
        });
    }, [equippedItems.weapon, itemsOnMap, tiles]);

    return { attackEnemy };
};