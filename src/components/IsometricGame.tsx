import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CONSTANTS, ITEMS } from '../utils/constants';
import { Tile, Enemy, Character, Item, EquippedItems, ItemOnMap } from '../utils/types';
import {
    tileToScreen,
    screenToTile,
    calculateDistance,
    isAdjacentToEnemy,
    updateTilesOccupancy,
    findPath,
    getCharacterDirection
} from '../utils/gameUtils';
import { CharacterStats } from './CharacterStats';
import { Inventory } from './Inventory';

// =============================================
// ОСНОВНОЙ КОМПОНЕНТ ИГРЫ
// =============================================
const IsometricGame: React.FC = () => {
    // =============================================
    // СОСТОЯНИЯ И REFS
    // =============================================
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredEnemy, setHoveredEnemy] = useState<{ x: number, y: number } | null>(null);
    const [tiles, setTiles] = useState<Tile[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [character, setCharacter] = useState<Character>({
        x: 5, y: 5, moving: false, targetX: null, targetY: null,
        path: [], health: 100, maxHealth: 100
    });
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [gameOver, setGameOver] = useState(false);
    const [lastDamageTime, setLastDamageTime] = useState(0);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [itemsOnMap, setItemsOnMap] = useState<ItemOnMap[]>([]);
    const [grassTexture, setGrassTexture] = useState<HTMLImageElement | null>(null);
    const [waterTexture, setWaterTexture] = useState<HTMLImageElement | null>(null);
    const [stoneTexture, setStoneTexture] = useState<HTMLImageElement | null>(null);
    const [rockTexture, setRockTexture] = useState<HTMLImageElement | null>(null);
    const [characterTextures, setCharacterTextures] = useState<{
        up: HTMLImageElement | null,
        down: HTMLImageElement | null,
        left: HTMLImageElement | null,
        right: HTMLImageElement | null,
    }>({ up: null, down: null, left: null, right: null });
    const [enemyTextures, setEnemyTextures] = useState<{
        up: HTMLImageElement | null,
        down: HTMLImageElement | null,
        left: HTMLImageElement | null,
        right: HTMLImageElement | null,
    }>({ up: null, down: null, left: null, right: null });
    const [enemyRedTextures, setEnemyRedTextures] = useState<{
        up: HTMLImageElement | null,
        down: HTMLImageElement | null,
        left: HTMLImageElement | null,
        right: HTMLImageElement | null,
    }>({ up: null, down: null, left: null, right: null });

    // Экипированные предметы
    const [equippedItems, setEquippedItems] = useState<EquippedItems>({
        helmet: null,
        armor: null,
        weapon: null,
        boots: null,
        potion: null
    });

    // Инвентарь (20 пустых слотов)
    const [inventoryItems, setInventoryItems] = useState<(Item | null)[]>(Array(20).fill(null));

    // Загрузка текстур
    useEffect(() => {
        const grassImg = new Image();
        grassImg.src = '/textures/grass.png';
        grassImg.onload = () => setGrassTexture(grassImg);

        const waterImg = new Image();
        waterImg.src = '/textures/water.png';
        waterImg.onload = () => setWaterTexture(waterImg);

        const stoneImg = new Image();
        stoneImg.src = '/textures/stone.png';
        stoneImg.onload = () => setStoneTexture(stoneImg);

        const rockImg = new Image();
        rockImg.src = '/textures/rock.png';
        rockImg.onload = () => setRockTexture(rockImg);

        const directionImg = (src: string) => {
            const img = new Image();
            img.src = src;
            return img;
        };

        setCharacterTextures({
            up: directionImg('/textures/char_up.png'),
            down: directionImg('/textures/char_down.png'),
            left: directionImg('/textures/char_left.png'),
            right: directionImg('/textures/char_right.png'),
        });

        setEnemyTextures({
            up: directionImg('/textures/enemy_up.png'),
            down: directionImg('/textures/enemy_down.png'),
            left: directionImg('/textures/enemy_left.png'),
            right: directionImg('/textures/enemy_right.png'),
        });

        setEnemyRedTextures({
            up: directionImg('/textures/enemy_up_red.png'),
            down: directionImg('/textures/enemy_down_red.png'),
            left: directionImg('/textures/enemy_left_red.png'),
            right: directionImg('/textures/enemy_right_red.png'),
        });
    }, []);

    // Функция применения эффекта зелья
    const applyPotionEffect = useCallback((potion: Item) => {
        setCharacter(prev => {
            const healthBonus = potion.effect.healthBonus || 0;
            const newHealth = Math.min(prev.maxHealth, prev.health + healthBonus);
            return { ...prev, health: newHealth };
        });
    }, []);

    // =============================================
    // ИНИЦИАЛИЗАЦИЯ ИГРЫ
    // =============================================
    useEffect(() => {
        // Создание карты
        const newTiles: Tile[] = Array.from({ length: CONSTANTS.MAP_WIDTH * CONSTANTS.MAP_HEIGHT }, (_, i) => {
            const x = i % CONSTANTS.MAP_WIDTH;
            const y = Math.floor(i / CONSTANTS.MAP_WIDTH);
            const rand = Math.random();
            const type = rand > 0.95 ? 'water' : rand > 0.9 ? 'stone' : 'grass';
            return { x, y, type, occupied: type === 'water' };
        });

        // Создание врагов
        const newEnemies: Enemy[] = [];
        const occupiedPositions = new Set<string>();

        while (newEnemies.length < CONSTANTS.ENEMY_COUNT) {
            let x: number, y: number;
            let attempts = 0;
            const maxAttempts = 100;

            do {
                x = Math.floor(Math.random() * CONSTANTS.MAP_WIDTH);
                y = Math.floor(Math.random() * CONSTANTS.MAP_HEIGHT);
                attempts++;
                if (attempts >= maxAttempts) break;
            } while (
                newTiles.some(t => t.x === x && t.y === y && t.occupied) ||
                calculateDistance(x, y, 5, 5) < 3 ||
                occupiedPositions.has(`${x},${y}`)
            );

            if (attempts < maxAttempts) {
                newEnemies.push({ x, y, health: 100, chasing: false });
                occupiedPositions.add(`${x},${y}`);
            }
        }

        setTiles(newTiles);
        setEnemies(newEnemies);
    }, []);

    // =============================================
    // ЭФФЕКТЫ ОБНОВЛЕНИЯ
    // =============================================
    useEffect(() => {
        // Обновление позиции камеры
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { x: charScreenX, y: charScreenY } = tileToScreen(character.x, character.y);
        setCameraOffset({
            x: canvas.width / 2 - charScreenX,
            y: canvas.height / 2 - (charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2)
        });
    }, [character.x, character.y, tileToScreen]);

    useEffect(() => {
        // Обновление занятости тайлов
        setTiles(prevTiles => updateTilesOccupancy(prevTiles, character, enemies, itemsOnMap));
    }, [character.x, character.y, enemies, itemsOnMap]);

    // =============================================
    // СИСТЕМА БОЯ
    // =============================================
    const attackEnemy = useCallback((enemyX: number, enemyY: number) => {
        // Рассчитываем бонусы атаки
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

            // Проверяем убийство врага
            const wasKilled = !newEnemies.some(e => e.x === enemyX && e.y === enemyY) &&
                prevEnemies.some(e => e.x === enemyX && e.y === enemyY);

            if (wasKilled) {
                const tile = tiles.find(t => t.x === enemyX && t.y === enemyY);
                const isWater = tile?.type === 'water';
                const hasItem = itemsOnMap.some(i => i.x === enemyX && i.y === enemyY);

                if (!hasItem && !isWater && Math.random() < CONSTANTS.ITEM_DROP_CHANCE) {
                    setItemsOnMap(prevItems => {
                        const itemAlreadyExists = prevItems.some(i => i.x === enemyX && i.y === enemyY);
                        if (!itemAlreadyExists) {
                            const randomItem: Item = ITEMS[Math.floor(Math.random() * ITEMS.length)] as Item;
                            return [...prevItems, { item: randomItem, x: enemyX, y: enemyY }];
                        }
                        return prevItems;
                    });
                }
            }

            return newEnemies;
        });
    }, [equippedItems.weapon, itemsOnMap, tiles]);

    // =============================================
    // СИСТЕМА ПЕРЕДВИЖЕНИЯ
    // =============================================
    // Движение персонажа
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

                // Проверяем подбор предмета
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

    // Движение врагов
    useEffect(() => {
        const moveEnemies = () => {
            setEnemies(prev => {
                const newEnemies = [...prev];
                const occupiedTiles = new Set<string>();

                // Отмечаем текущие позиции врагов
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

    // =============================================
    // СИСТЕМА УРОНА И СМЕРТИ
    // =============================================
    useEffect(() => {
        if (gameOver) return;
        const checkDamage = () => {
            const now = Date.now();
            if (now - lastDamageTime < CONSTANTS.DAMAGE_COOLDOWN) return;
            const adjacentEnemies = enemies.filter(e => isAdjacentToEnemy(character.x, character.y, e.x, e.y));
            if (adjacentEnemies.length > 0) {
                // Рассчитываем бонус защиты
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
    }, [cameraOffset, enemies, screenToTile, gameOver, inventoryOpen]);

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
                attackEnemy(tileX, tileY);
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
    }, [cameraOffset, character.x, character.y, enemies, isAdjacentToEnemy, attackEnemy, screenToTile, tiles, itemsOnMap, gameOver, inventoryOpen, inventoryItems]);

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

    // =============================================
    // СИСТЕМА ОТРИСОВКИ
    // =============================================
    // Отрисовка здоровья
    const drawHealthOrb = useCallback((ctx: CanvasRenderingContext2D) => {
        const healthPercentage = Math.min(1, character.health / character.maxHealth);

        const orbX = CONSTANTS.HEALTH_ORB_MARGIN + CONSTANTS.HEALTH_ORB_RADIUS;
        const orbY = CONSTANTS.CANVAS_HEIGHT - CONSTANTS.HEALTH_ORB_MARGIN - CONSTANTS.HEALTH_ORB_RADIUS;

        // Фон орбы здоровья
        const gradient = ctx.createRadialGradient(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.3, orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS);
        gradient.addColorStop(0, '#4a0000'); gradient.addColorStop(1, '#1a0000');
        ctx.beginPath(); ctx.arc(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = gradient; ctx.fill();

        // Индикатор здоровья
        ctx.beginPath(); ctx.moveTo(orbX, orbY);
        ctx.arc(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.9, Math.PI * 1.5, Math.PI * 1.5 + Math.PI * 2 * healthPercentage);
        ctx.closePath();
        const healthGradient = ctx.createRadialGradient(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.3, orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.9);
        healthGradient.addColorStop(0, '#ff0000'); healthGradient.addColorStop(1, '#800000');
        ctx.fillStyle = healthGradient; ctx.fill();

        // Обводка и текст
        ctx.beginPath(); ctx.arc(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${character.health}/${character.maxHealth}`, orbX, orbY);
    }, [character.health, character.maxHealth]);

    // Основной цикл отрисовки
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(cameraOffset.x, cameraOffset.y);

        // Отрисовка видимых тайлов
        tiles.filter(t => calculateDistance(t.x, t.y, character.x, character.y) <= CONSTANTS.RENDER_RADIUS)
            .forEach(tile => {
                const { x: screenX, y: screenY } = tileToScreen(tile.x, tile.y);

                if (tile.type === 'grass') {
                    ctx.beginPath();
                    ctx.moveTo(screenX, screenY);
                    ctx.lineTo(screenX + CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
                    ctx.lineTo(screenX, screenY + CONSTANTS.TILE_HEIGHT);
                    ctx.lineTo(screenX - CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
                    ctx.closePath();

                    ctx.save();
                    ctx.clip();

                    if (grassTexture) {
                        const pattern = ctx.createPattern(grassTexture, 'repeat');
                        if (pattern) {
                            ctx.fillStyle = pattern;
                            ctx.fillRect(
                                screenX - CONSTANTS.TILE_WIDTH,
                                screenY - CONSTANTS.TILE_HEIGHT,
                                CONSTANTS.TILE_WIDTH * 3,
                                CONSTANTS.TILE_HEIGHT * 3
                            );
                        }
                    } else {
                        ctx.fillStyle = '#5a8f3d';
                        ctx.fill();
                    }

                    ctx.restore();
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.stroke();
                } else if (tile.type === 'water') {
                    ctx.beginPath();
                    ctx.moveTo(screenX, screenY);
                    ctx.lineTo(screenX + CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
                    ctx.lineTo(screenX, screenY + CONSTANTS.TILE_HEIGHT);
                    ctx.lineTo(screenX - CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
                    ctx.closePath();

                    ctx.save();
                    ctx.clip();

                    if (waterTexture) {
                        const pattern = ctx.createPattern(waterTexture, 'repeat');
                        if (pattern) {
                            ctx.fillStyle = pattern;
                            ctx.fillRect(
                                screenX - CONSTANTS.TILE_WIDTH,
                                screenY - CONSTANTS.TILE_HEIGHT,
                                CONSTANTS.TILE_WIDTH * 3,
                                CONSTANTS.TILE_HEIGHT * 3
                            );
                        }
                    } else {
                        ctx.fillStyle = '#3a5a9a';
                        ctx.fill();
                    }

                    ctx.restore();
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.stroke();
                } else if (tile.type === 'stone') {
                    ctx.beginPath();
                    ctx.moveTo(screenX, screenY);
                    ctx.lineTo(screenX + CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
                    ctx.lineTo(screenX, screenY + CONSTANTS.TILE_HEIGHT);
                    ctx.lineTo(screenX - CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
                    ctx.closePath();

                    ctx.save();
                    ctx.clip();

                    if (stoneTexture) {
                        const pattern = ctx.createPattern(stoneTexture, 'repeat');
                        if (pattern) {
                            ctx.fillStyle = pattern;
                            ctx.fillRect(
                                screenX - CONSTANTS.TILE_WIDTH,
                                screenY - CONSTANTS.TILE_HEIGHT,
                                CONSTANTS.TILE_WIDTH * 3,
                                CONSTANTS.TILE_HEIGHT * 3
                            );
                        }
                    } else {
                        ctx.fillStyle = '#808080';
                        ctx.fill();
                    }

                    ctx.restore();
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.stroke();
                }
            });

        // Отрисовка предметов на карте
        itemsOnMap.filter(i => calculateDistance(i.x, i.y, character.x, character.y) <= CONSTANTS.RENDER_RADIUS)
            .forEach(item => {
                const { x: screenX, y: screenY } = tileToScreen(item.x, item.y);
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(item.item.icon, screenX, screenY + CONSTANTS.TILE_HEIGHT / 2);
            });

        // Отрисовка видимых врагов
        enemies.filter(e => calculateDistance(e.x, e.y, character.x, character.y) <= CONSTANTS.RENDER_RADIUS)
            .forEach(enemy => {
                const { x: screenX, y: screenY } = tileToScreen(enemy.x, enemy.y);
                const adjustedScreenY = screenY - CONSTANTS.ENEMY_HEIGHT / 2;
                // Определяем направление врага
                let enemyDirection = 'down';
                if (enemy.chasing) {
                    const dx = character.x - enemy.x;
                    const dy = character.y - enemy.y;

                    if (Math.abs(dx) > Math.abs(dy)) {
                        enemyDirection = dx > 0 ? 'right' : 'left';
                    } else {
                        enemyDirection = dy > 0 ? 'down' : 'up';
                    }
                }

                // Выбираем текстуру
                const isHovered = hoveredEnemy?.x === enemy.x && hoveredEnemy?.y === enemy.y;
                const currentEnemyTexture = isHovered
                    ? enemyRedTextures[enemyDirection as keyof typeof enemyRedTextures]
                    : enemyTextures[enemyDirection as keyof typeof enemyTextures];

                // Отрисовка врага
                if (currentEnemyTexture) {
                    ctx.drawImage(
                        currentEnemyTexture,
                        screenX - CONSTANTS.ENEMY_WIDTH / 2,
                        adjustedScreenY,
                        CONSTANTS.ENEMY_WIDTH,
                        CONSTANTS.ENEMY_HEIGHT
                    );
                } else {
                    if (isHovered) {
                        ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.moveTo(screenX, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
                        ctx.lineTo(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
                        ctx.lineTo(screenX, adjustedScreenY);
                        ctx.lineTo(screenX + CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
                        ctx.closePath(); ctx.stroke();
                    }
                    ctx.fillStyle = enemy.chasing ? '#ff0000' : '#8a2be2';
                    ctx.beginPath();
                    ctx.moveTo(screenX, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
                    ctx.lineTo(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
                    ctx.lineTo(screenX, adjustedScreenY);
                    ctx.lineTo(screenX + CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
                    ctx.closePath();
                    ctx.fill();
                }

                // Полоска здоровья
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY - 8, CONSTANTS.ENEMY_WIDTH, 5);
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY - 8, CONSTANTS.ENEMY_WIDTH * (enemy.health / 100), 5);
            });

        // Отрисовка персонажа
        if (!gameOver) {
            const { x: charScreenX, y: charScreenY } = tileToScreen(character.x, character.y);
            // Определяем направление
            let direction = 'down';
            if (character.moving && character.path.length > 0) {
                const nextStep = character.path[0];
                direction = getCharacterDirection(character.x, character.y, nextStep.x, nextStep.y);
            }
            const currentTexture = characterTextures[direction as keyof typeof characterTextures];

            if (currentTexture) {
                ctx.drawImage(
                    currentTexture,
                    charScreenX - CONSTANTS.CHARACTER_WIDTH / 2,
                    charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2,
                    CONSTANTS.CHARACTER_WIDTH,
                    CONSTANTS.CHARACTER_HEIGHT
                );
            } else {
                ctx.fillStyle = '#d43b3b';
                ctx.beginPath();
                ctx.moveTo(charScreenX, charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2 + CONSTANTS.CHARACTER_HEIGHT);
                ctx.lineTo(charScreenX - CONSTANTS.CHARACTER_WIDTH / 2, charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2 + CONSTANTS.CHARACTER_HEIGHT);
                ctx.lineTo(charScreenX, charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2);
                ctx.lineTo(charScreenX + CONSTANTS.CHARACTER_WIDTH / 2, charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2 + CONSTANTS.CHARACTER_HEIGHT);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Отрисовка камней
        tiles.filter(t => t.type === 'stone' && calculateDistance(t.x, t.y, character.x, character.y) <= CONSTANTS.RENDER_RADIUS)
            .forEach(tile => {
                const { x: screenX, y: screenY } = tileToScreen(tile.x, tile.y);
                if (rockTexture) {
                    const rectHeight = CONSTANTS.STONE_HEIGHT;
                    const rectWidth = CONSTANTS.STONE_WIDTH;
                    const rectY = screenY + CONSTANTS.TILE_HEIGHT / 1.35 - rectHeight;
                    const rectX = screenX - rectWidth / 2;
                    ctx.globalAlpha = 0.75;
                    ctx.drawImage(
                        rockTexture,
                        0, 0, rockTexture.width, rockTexture.height,
                        rectX, rectY, rectWidth, rectHeight
                    );
                    ctx.globalAlpha = 1.0;
                }
            });

        // Отрисовка цели и пути
        if (character.targetX !== null && character.targetY !== null) {
            const targetTile = tiles.find(t => t.x === character.targetX && t.y === character.targetY);
            if (targetTile && calculateDistance(targetTile.x, targetTile.y, character.x, character.y) <= CONSTANTS.RENDER_RADIUS) {
                const { x: screenX, y: screenY } = tileToScreen(targetTile.x, targetTile.y);
                ctx.strokeStyle = CONSTANTS.TARGET_HIGHLIGHT_COLOR; ctx.lineWidth = CONSTANTS.TARGET_HIGHLIGHT_WIDTH;
                ctx.beginPath(); ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX + CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
                ctx.lineTo(screenX, screenY + CONSTANTS.TILE_HEIGHT);
                ctx.lineTo(screenX - CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
                ctx.closePath(); ctx.stroke();
            }
        }

        // Отрисовка пути
        character.path.forEach(step => {
            if (calculateDistance(step.x, step.y, character.x, character.y) <= CONSTANTS.RENDER_RADIUS) {
                const { x: tileScreenX, y: tileScreenY } = tileToScreen(step.x, step.y);
                ctx.fillStyle = '#fff'; ctx.beginPath();
                ctx.arc(tileScreenX, tileScreenY + CONSTANTS.TILE_HEIGHT / 2, CONSTANTS.PATH_DOT_RADIUS, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.restore();
        drawHealthOrb(ctx);

        // Отрисовка экрана Game Over
        if (gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
            ctx.font = '24px Arial';
            ctx.fillText('Персонаж погиб', canvas.width / 2, canvas.height / 2 + 60);
        }
    }, [tiles, character, cameraOffset, enemies, hoveredEnemy, tileToScreen, drawHealthOrb, gameOver, itemsOnMap, grassTexture, waterTexture, stoneTexture, rockTexture, characterTextures, enemyTextures, enemyRedTextures]);

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

            {/* Показываем характеристики только когда открыт инвентарь */}
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
                applyPotionEffect={applyPotionEffect}
            />
        </div>
    );
};

export default IsometricGame;