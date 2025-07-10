import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CONSTANTS } from '../utils/constants';
import { Character, Item, ItemOnMap, EquippedItems } from '../utils/types';
import { screenToTile, calculateDistance, isAdjacentToEnemy, updateTilesOccupancy, findPath } from '../utils/gameUtils';
import { CharacterStats } from './CharacterStats';
import { Inventory } from './Inventory';
import { useTextures, useGameInitialization, useCameraSystem, usePotionSystem } from '../utils/gameHooks';
import { useMovementSystem, useEnemyMovementSystem, useCombatSystem, useAttackSystem } from './GameSystems';
import { renderGame } from './GameRender'

// =============================================
// ОСНОВНОЙ КОМПОНЕНТ ИГРЫ
// =============================================
const IsometricGame: React.FC = () => {
    // =============================================
    // СОСТОЯНИЯ И REFS
    // =============================================
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredEnemy, setHoveredEnemy] = useState<{ x: number, y: number } | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [lastDamageTime, setLastDamageTime] = useState(0);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [itemsOnMap, setItemsOnMap] = useState<ItemOnMap[]>([]);
    const [inventoryItems, setInventoryItems] = useState<(Item | null)[]>(Array(20).fill(null));
    const [equippedItems, setEquippedItems] = useState<EquippedItems>({
        helmet: null,
        armor: null,
        weapon: null,
        boots: null,
        potion: null
    });

    const [character, setCharacter] = useState<Character>({
        x: 5, y: 5, moving: false, targetX: null, targetY: null,
        path: [], health: 100, maxHealth: 100
    });

    // Инициализация систем
    const textures = useTextures();
    const { tiles, setTiles, enemies, setEnemies } = useGameInitialization();
    const { cameraOffset } = useCameraSystem(character, canvasRef);
    const { applyPotionEffect } = usePotionSystem();
    const { attackEnemy } = useAttackSystem(equippedItems, itemsOnMap, tiles);

    // Использование систем
    useMovementSystem(
        character,
        setCharacter,
        tiles,
        enemies,
        itemsOnMap,
        inventoryItems,
        setInventoryItems,
        setItemsOnMap,
        gameOver
    );

    useEnemyMovementSystem(enemies, setEnemies, character, tiles);
    useCombatSystem(
        enemies,
        character,
        setCharacter,
        setGameOver,
        lastDamageTime,
        setLastDamageTime,
        equippedItems,
        gameOver
    );

    // Обновление занятости тайлов
    useEffect(() => {
        setTiles(prevTiles => updateTilesOccupancy(prevTiles, character, enemies, itemsOnMap));
    }, [character.x, character.y, enemies, itemsOnMap]);

    // =============================================
    // ОБРАБОТЧИКИ СОБЫТИЙ
    // =============================================
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (gameOver || inventoryOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const { x: tileX, y: tileY } = screenToTile(
            e.clientX - rect.left - cameraOffset.x,
            e.clientY - rect.top - cameraOffset.y
        );
        setHoveredEnemy(enemies.find(e => e.x === tileX && e.y === tileY) ? { x: tileX, y: tileY } : null);
    }, [cameraOffset, enemies, gameOver, inventoryOpen]);

    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (gameOver || inventoryOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const { x: tileX, y: tileY } = screenToTile(
            e.clientX - rect.left - cameraOffset.x,
            e.clientY - rect.top - cameraOffset.y
        );

        if (tileX < 0 || tileX >= CONSTANTS.MAP_WIDTH || tileY < 0 || tileY >= CONSTANTS.MAP_HEIGHT) return;
        const clickedEnemy = enemies.find(e => e.x === tileX && e.y === tileY);
        const clickedTile = tiles.find(t => t.x === tileX && t.y === tileY);
        const clickedItem = itemsOnMap.find(i => i.x === tileX && i.y === tileY);
        if (!clickedTile) return;

        if (clickedEnemy) {
            if (isAdjacentToEnemy(character.x, character.y, tileX, tileY)) {
                attackEnemy(tileX, tileY, setEnemies, setItemsOnMap);
            } else {
                const path = findPath(character.x, character.y, tileX, tileY, tiles, enemies, itemsOnMap);
                if (path.length > 0) setCharacter(prev => ({
                    ...prev, moving: true, targetX: tileX, targetY: tileY, path
                }));
            }
        } else if (clickedItem) {
            if (calculateDistance(character.x, character.y, tileX, tileY) <= 1) {
                const emptySlotIndex = inventoryItems.findIndex(item => item === null);
                if (emptySlotIndex !== -1) {
                    const newInventory = [...inventoryItems];
                    newInventory[emptySlotIndex] = clickedItem.item;
                    setInventoryItems(newInventory);
                    setItemsOnMap(prev => prev.filter(i => !(i.x === tileX && i.y === tileY)));
                }
            } else {
                const path = findPath(character.x, character.y, tileX, tileY, tiles, enemies, itemsOnMap);
                if (path.length > 0) setCharacter(prev => ({
                    ...prev, moving: true, targetX: tileX, targetY: tileY, path
                }));
            }
        } else if (!clickedTile.occupied) {
            const path = findPath(character.x, character.y, tileX, tileY, tiles, enemies, itemsOnMap);
            if (path.length > 0) setCharacter(prev => ({
                ...prev, moving: true, targetX: tileX, targetY: tileY, path
            }));
        }
    }, [cameraOffset, character.x, character.y, enemies, tiles, itemsOnMap, gameOver, inventoryOpen, inventoryItems, attackEnemy]);

    // Обработчик клавиш
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'i') {
                setInventoryOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Основной цикл отрисовки
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        renderGame(
            ctx,
            canvas,
            tiles,
            character,
            cameraOffset,
            enemies,
            hoveredEnemy,
            itemsOnMap,
            gameOver,
            textures.grassTexture,
            textures.waterTexture,
            textures.stoneTexture,
            textures.rockTexture,
            textures.characterTextures,
            textures.enemyTextures,
            textures.enemyRedTextures
        );
    }, [tiles, character, cameraOffset, enemies, hoveredEnemy, itemsOnMap, gameOver, textures]);

    // =============================================
    // ОСНОВНОЙ РЕНДЕР КОМПОНЕНТА
    // =============================================
    return (
        <div style={{ textAlign: 'center', position: 'relative' }}>
            <h1>Diabloid</h1>
            <p>Нажми на тайл для перемещения или на врага для атаки. Нажми I для открытия инвентаря</p>
            <canvas
                ref={canvasRef}
                width={CONSTANTS.CANVAS_WIDTH}
                height={CONSTANTS.CANVAS_HEIGHT}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseOut={() => setHoveredEnemy(null)}
                style={{ border: '1px solid black', backgroundColor: '#222', cursor: gameOver ? 'default' : 'pointer' }}
            />
            {gameOver && <button onClick={() => window.location.reload()}>Начать заново</button>}

            {inventoryOpen && (
                <CharacterStats character={character} equippedItems={equippedItems} />
            )}

            <Inventory
                inventoryOpen={inventoryOpen}
                setInventoryOpen={setInventoryOpen}
                inventoryItems={inventoryItems}
                setInventoryItems={setInventoryItems}
                equippedItems={equippedItems}
                setEquippedItems={setEquippedItems}
                applyPotionEffect={(potion) => applyPotionEffect(potion, setCharacter)}
            />
        </div>
    );
};

export default IsometricGame;