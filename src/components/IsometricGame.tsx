import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// =============================================
// ИНТЕРФЕЙСЫ ДАННЫХ
// =============================================
interface Tile { x: number; y: number; type: 'grass' | 'stone' | 'water'; occupied: boolean; }
interface Enemy { x: number; y: number; health: number; chasing: boolean; }
interface Character { 
  x: number; y: number; moving: boolean; 
  targetX: number | null; targetY: number | null; 
  path: {x: number, y: number}[]; health: number; maxHealth: number; 
}

interface ItemEffect {
  healthBonus?: number;
  damageBonus?: number;
  defenseBonus?: number;
}

interface Item {
  id: string;
  name: string;
  icon: string;
  type: 'weapon' | 'armor' | 'helmet' | 'boots' | 'potion';
  effect: ItemEffect;
}

// =============================================
// КОНСТАНТЫ ИГРЫ
// =============================================
const CONSTANTS = {
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

// Предопределенные предметы с эффектами
const ITEMS: Item[] = [
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

// =============================================
// ОСНОВНОЙ КОМПОНЕНТ ИГРЫ
// =============================================
const IsometricGame: React.FC = () => {
  // =============================================
  // СОСТОЯНИЯ И REFS
  // =============================================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredEnemy, setHoveredEnemy] = useState<{x: number, y: number} | null>(null);
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
  const [itemsOnMap, setItemsOnMap] = useState<{item: Item, x: number, y: number}[]>([]);
  const [draggedItem, setDraggedItem] = useState<{item: Item, index: number, fromEquipped: boolean} | null>(null);
  const [usePotionArea, setUsePotionArea] = useState(false);
  const [grassTexture, setGrassTexture] = useState<HTMLImageElement | null>(null);
  const [waterTexture, setWaterTexture] = useState<HTMLImageElement | null>(null);
  const [stoneTexture, setStoneTexture] = useState<HTMLImageElement | null>(null);
  const [rockTexture, setRockTexture] = useState<HTMLImageElement | null>(null);

  // Экипированные предметы
  const [equippedItems, setEquippedItems] = useState({
    helmet: null as Item | null,
    armor: null as Item | null,
    weapon: null as Item | null,
    boots: null as Item | null,
    potion: null as Item | null
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
  }, []);

  // =============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // =============================================
  const tileToScreen = useCallback((x: number, y: number) => ({
    x: (x - y) * CONSTANTS.TILE_WIDTH / 2,
    y: (x + y) * CONSTANTS.TILE_HEIGHT / 2
  }), []);

  const screenToTile = useCallback((screenX: number, screenY: number) => ({
    x: Math.floor((screenX / (CONSTANTS.TILE_WIDTH / 2) + screenY / (CONSTANTS.TILE_HEIGHT / 2)) / 2),
    y: Math.floor((screenY / (CONSTANTS.TILE_HEIGHT / 2) - screenX / (CONSTANTS.TILE_WIDTH / 2)) / 2)
  }), []);

  const calculateDistance = (x1: number, y1: number, x2: number, y2: number) => 
    Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));

  // =============================================
  // ФУНКЦИИ ПРОВЕРКИ И ОБНОВЛЕНИЯ СОСТОЯНИЯ
  // =============================================
  
  const updateTilesOccupancy = useCallback((tilesList: Tile[], char: Character, enemiesList: Enemy[]) => {
    return tilesList.map(tile => {
      const occupied = tile.type === 'water' || tile.type === 'stone' ||
        (tile.x === char.x && tile.y === char.y) ||
        enemiesList.some(e => e.x === tile.x && e.y === tile.y) ||
        itemsOnMap.some(i => i.x === tile.x && i.y === tile.y);
      return { ...tile, occupied };
    });
  }, [itemsOnMap]);

  // =============================================
  // СИСТЕМА ЭКИПИРОВКИ И ХАРАКТЕРИСТИК
  // =============================================
  const calculateBonuses = useCallback(() => {
    let total = { healthBonus: 0, damageBonus: 0, defenseBonus: 0 };
    
    Object.values(equippedItems).forEach(item => {
      if (item) {
        total.healthBonus += item.effect.healthBonus || 0;
        total.damageBonus += item.effect.damageBonus || 0;
        total.defenseBonus += item.effect.defenseBonus || 0;
      }
    });
    
    return total;
  }, [equippedItems]);

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

    // Создание врагов с проверкой уникальности позиций
    const newEnemies: Enemy[] = [];
    const occupiedPositions = new Set<string>();
    
    while (newEnemies.length < CONSTANTS.ENEMY_COUNT) {
      let x: number, y: number;
      let attempts = 0;
      const maxAttempts = 100; // Защита от бесконечного цикла
      
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
    setTiles(prevTiles => updateTilesOccupancy(prevTiles, character, enemies));
  }, [character.x, character.y, enemies, itemsOnMap, updateTilesOccupancy]);

  // =============================================
  // СИСТЕМА БОЯ
  // =============================================
  const isAdjacentToEnemy = useCallback((charX: number, charY: number, enemyX: number, enemyY: number) => 
    (Math.abs(charX - enemyX) === 1 && charY === enemyY) || 
    (Math.abs(charY - enemyY) === 1 && charX === enemyX), []);

  const attackEnemy = useCallback((enemyX: number, enemyY: number) => {
    const bonuses = calculateBonuses();
    const damage = 25 + (bonuses.damageBonus || 0);
    
    setEnemies(prevEnemies => {
      const newEnemies = prevEnemies.map(e => 
        e.x === enemyX && e.y === enemyY ? 
          (e.health - damage <= 0 ? null : { ...e, health: e.health - damage }) : e
      ).filter(Boolean) as Enemy[];
      
      // Проверяем, был ли убит враг
      const wasKilled = !newEnemies.some(e => e.x === enemyX && e.y === enemyY) && 
                       prevEnemies.some(e => e.x === enemyX && e.y === enemyY);
      
      if (wasKilled) {
        // Получаем текущее состояние тайла
        const tile = tiles.find(t => t.x === enemyX && t.y === enemyY);
        const isWater = tile?.type === 'water';
        
        // Проверяем наличие предмета на этой клетке в текущем состоянии
        const hasItem = itemsOnMap.some(i => i.x === enemyX && i.y === enemyY);
        
        // Если клетка свободна и не вода, и выпал предмет
        if (!hasItem && !isWater && Math.random() < CONSTANTS.ITEM_DROP_CHANCE) {
          // Используем функциональное обновление для гарантии актуального состояния
          setItemsOnMap(prevItems => {
            // Дополнительная проверка на случай, если предмет появился между рендерами
            const itemAlreadyExists = prevItems.some(i => i.x === enemyX && i.y === enemyY);
            if (!itemAlreadyExists) {
              const randomItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
              return [...prevItems, { item: randomItem, x: enemyX, y: enemyY }];
            }
            return prevItems;
          });
        }
      }
      
      return newEnemies;
    });
  }, [calculateBonuses, itemsOnMap, tiles]);

  // =============================================
  // СИСТЕМА ПЕРЕДВИЖЕНИЯ
  // =============================================
  // Поиск пути
  const findPath = useCallback((startX: number, startY: number, targetX: number, targetY: number) => {
    const path: {x: number, y: number}[] = [];
    let currentX = startX, currentY = startY;
    const isTargetEnemy = enemies.some(e => e.x === targetX && e.y === targetY);
    const isTargetItem = itemsOnMap.some(i => i.x === targetX && i.y === targetY);

    while (currentX !== targetX || currentY !== targetY) {
      if (currentX !== targetX) {
        const nextX = currentX + (targetX > currentX ? 1 : -1);
        const tile = tiles.find(t => t.x === nextX && t.y === currentY);
        if (tile && !tile.occupied && !enemies.some(e => e.x === nextX && e.y === currentY)) {
          currentX = nextX;
          path.push({x: currentX, y: currentY});
          if ((isTargetEnemy || isTargetItem) && nextX === targetX && currentY === targetY) break;
        } else break;
      }

      if (currentY !== targetY) {
        const nextY = currentY + (targetY > currentY ? 1 : -1);
        const tile = tiles.find(t => t.x === currentX && t.y === nextY);
        if (tile && !tile.occupied && !enemies.some(e => e.x === currentX && e.y === nextY)) {
          currentY = nextY;
          path.push({x: currentX, y: currentY});
          if ((isTargetEnemy || isTargetItem) && currentX === targetX && nextY === targetY) break;
        } else break;
      }
    }
    return path;
  }, [tiles, enemies, itemsOnMap]);

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
        
        // Проверяем, подобрали ли предмет
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
        
        // Сначала отмечаем текущие позиции врагов как занятые
        newEnemies.forEach(enemy => {
          occupiedTiles.add(`${enemy.x},${enemy.y}`);
        });

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
        const bonuses = calculateBonuses();
        const damage = Math.max(1, CONSTANTS.ENEMY_DAMAGE - (bonuses.defenseBonus || 0));
        
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
  }, [enemies, character.x, character.y, isAdjacentToEnemy, lastDamageTime, gameOver, calculateBonuses]);

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
    setHoveredEnemy(enemies.find(e => e.x === tileX && e.y === tileY) ? {x: tileX, y: tileY} : null);
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
        const path = findPath(character.x, character.y, tileX, tileY);
        if (path.length > 0) setCharacter(prev => ({
          ...prev, moving: true, targetX: tileX, targetY: tileY, path
        }));
      }
    } else if (clickedItem) {
      // Если кликнули на предмет и он рядом - подбираем
      if (calculateDistance(character.x, character.y, tileX, tileY) <= 1) {
        const emptySlotIndex = inventoryItems.findIndex(item => item === null);
        if (emptySlotIndex !== -1) {
          const newInventory = [...inventoryItems];
          newInventory[emptySlotIndex] = clickedItem.item;
          setInventoryItems(newInventory);
          setItemsOnMap(prev => prev.filter(i => !(i.x === tileX && i.y === tileY)));
        }
      } else {
        // Иначе идем к предмету
        const path = findPath(character.x, character.y, tileX, tileY);
        if (path.length > 0) setCharacter(prev => ({
          ...prev, moving: true, targetX: tileX, targetY: tileY, path
        }));
      }
    } else if (!clickedTile.occupied) {
      const path = findPath(character.x, character.y, tileX, tileY);
      if (path.length > 0) setCharacter(prev => ({
        ...prev, moving: true, targetX: tileX, targetY: tileY, path
      }));
    }
  }, [cameraOffset, character.x, character.y, enemies, isAdjacentToEnemy, attackEnemy, findPath, screenToTile, tiles, itemsOnMap, gameOver, inventoryOpen, inventoryItems]);

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
  // СИСТЕМА ИНВЕНТАРЯ И ЭКИПИРОВКИ
  // =============================================
  // Drag and Drop для инвентаря
  const handleDragStart = (index: number, fromEquipped: boolean = false) => {
    if (fromEquipped) {
      // Перетаскивание из слота экипировки
      const itemType = index === -1 ? 'weapon' : 
                      index === -2 ? 'helmet' : 
                      index === -3 ? 'armor' : 'boots';
      const item = equippedItems[itemType];
      if (item) {
        setDraggedItem({ item, index, fromEquipped: true });
      }
    } else {
      // Перетаскивание из инвентаря
      if (index >= 0 && inventoryItems[index] !== null) {
        setDraggedItem({ item: inventoryItems[index]!, index, fromEquipped: false });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number, isEquipmentSlot: boolean = false) => {
    if (!draggedItem) return;

    // Если это зелье и его кладут в область использования
    if (draggedItem.item.type === 'potion' && usePotionArea) {
        applyPotionEffect(draggedItem.item);
        // Удаляем зелье из инвентаря
        const newInventory = [...inventoryItems];
        newInventory[draggedItem.index] = null;
        setInventoryItems(newInventory);
        setUsePotionArea(false);
        setDraggedItem(null);
        return;
    }

    // Если перетаскиваем из экипировки в инвентарь
    if (draggedItem.fromEquipped && !isEquipmentSlot) {
        const itemType = draggedItem.item.type;
        const newEquippedItems = { ...equippedItems };
        const newInventory = [...inventoryItems];
        
        // Находим первый пустой слот
        const emptySlotIndex = newInventory.findIndex(item => item === null);
        if (emptySlotIndex !== -1) {
            newInventory[emptySlotIndex] = draggedItem.item;
            
            // Определяем, из какого слота экипировки снимаем предмет
            switch (itemType) {
                case 'weapon': newEquippedItems.weapon = null; break;
                case 'helmet': newEquippedItems.helmet = null; break;
                case 'armor': newEquippedItems.armor = null; break;
                case 'boots': newEquippedItems.boots = null; break;
            }
            
            setEquippedItems(newEquippedItems);
            setInventoryItems(newInventory);
        }
    }
    // Если перетаскиваем из инвентаря в экипировку
    else if (!draggedItem.fromEquipped && isEquipmentSlot) {
        // Определяем тип слота экипировки
        let slotType: keyof typeof equippedItems;
        switch (targetIndex) {
            case -1: slotType = 'weapon'; break;
            case -2: slotType = 'helmet'; break;
            case -3: slotType = 'armor'; break;
            case -4: slotType = 'boots'; break;
            default: slotType = 'potion'; break;
        }

        // Проверяем, можно ли экипировать этот предмет в данный слот
        if (draggedItem.item.type !== slotType) {
            // Неправильный тип предмета для этого слота - отменяем действие
            setDraggedItem(null);
            setUsePotionArea(false);
            return;
        }

        // Меняем местами предметы
        const newEquippedItems = { ...equippedItems };
        const oldItem = newEquippedItems[slotType];
        const newInventory = [...inventoryItems];
        
        newEquippedItems[slotType] = draggedItem.item;
        newInventory[draggedItem.index] = oldItem;
        
        setEquippedItems(newEquippedItems);
        setInventoryItems(newInventory);
    }
    // Если перетаскиваем внутри инвентаря
    else if (!draggedItem.fromEquipped && !isEquipmentSlot) {
        const newInventory = [...inventoryItems];
        if (newInventory[targetIndex] !== null) {
            // Меняем местами предметы
            const temp = newInventory[targetIndex];
            newInventory[targetIndex] = draggedItem.item;
            newInventory[draggedItem.index] = temp;
        } else {
            // Перемещаем предмет в пустой слот
            newInventory[targetIndex] = draggedItem.item;
            newInventory[draggedItem.index] = null;
        }
        setInventoryItems(newInventory);
    }
    
    setUsePotionArea(false);
    setDraggedItem(null);
};

  // Обработчик двойного клика по предмету в инвентаре
  const handleDoubleClick = (index: number) => {
  const item = inventoryItems[index];
  if (!item) return;

  // Если это зелье - используем его
  if (item.type === 'potion') {
    applyPotionEffect(item);
    // Удаляем зелье из инвентаря
    const newInventory = [...inventoryItems];
    newInventory[index] = null;
    setInventoryItems(newInventory);
    return;
  }

  // Для других предметов - пытаемся экипировать
  const slotType = item.type as keyof typeof equippedItems;
  const newEquippedItems = { ...equippedItems };
  const newInventory = [...inventoryItems];

  // Если слот уже занят - меняем местами
  if (newEquippedItems[slotType]) {
    const oldItem = newEquippedItems[slotType];
    newInventory[index] = oldItem;
  } else {
    newInventory[index] = null;
  }

  newEquippedItems[slotType] = item;
  
  setEquippedItems(newEquippedItems);
  setInventoryItems(newInventory);
};

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
          // Рисуем траву с текстурой
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
          // Рисуем воду с текстурой
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
          // Рисуем камни с текстурой
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
      
        // Подсветка при наведении
        if (hoveredEnemy?.x === enemy.x && hoveredEnemy?.y === enemy.y) {
          ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(screenX, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
          ctx.lineTo(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
          ctx.lineTo(screenX, adjustedScreenY); 
          ctx.lineTo(screenX + CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
          ctx.closePath(); ctx.stroke();
        }
      
        // Тело врага
        ctx.fillStyle = enemy.chasing ? '#ff0000' : '#8a2be2';
        ctx.beginPath(); ctx.moveTo(screenX, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
        ctx.lineTo(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
        ctx.lineTo(screenX, adjustedScreenY); 
        ctx.lineTo(screenX + CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
        ctx.closePath(); ctx.fill();
      
        // Полоска здоровья
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY - 8, CONSTANTS.ENEMY_WIDTH, 5);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY - 8, CONSTANTS.ENEMY_WIDTH * (enemy.health / 100), 5);
      });
    
    // Отрисовка персонажа
    if (!gameOver) {
      const { x: charScreenX, y: charScreenY } = tileToScreen(character.x, character.y);
      ctx.fillStyle = '#d43b3b'; ctx.beginPath();
      ctx.moveTo(charScreenX, charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2 + CONSTANTS.CHARACTER_HEIGHT);
      ctx.lineTo(charScreenX - CONSTANTS.CHARACTER_WIDTH / 2, charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2 + CONSTANTS.CHARACTER_HEIGHT);
      ctx.lineTo(charScreenX, charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2); 
      ctx.lineTo(charScreenX + CONSTANTS.CHARACTER_WIDTH / 2, charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2 + CONSTANTS.CHARACTER_HEIGHT);
      ctx.closePath(); ctx.fill();
    }
  
    // Отрисовка серых прямоугольников на камнях (после всего остального)
    tiles.filter(t => t.type === 'stone' && calculateDistance(t.x, t.y, character.x, character.y) <= CONSTANTS.RENDER_RADIUS)
      .forEach(tile => {
        const { x: screenX, y: screenY } = tileToScreen(tile.x, tile.y);
        // Рисуем текстуру камня с прозрачностью
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
  }, [tiles, character, cameraOffset, enemies, hoveredEnemy, tileToScreen, drawHealthOrb, gameOver, itemsOnMap]);
  // =============================================
  // РЕНДЕР ИНТЕРФЕЙСА
  // =============================================
  // Рендер характеристик персонажа
  const renderCharacterStats = () => {
    if (!inventoryOpen) return null;
    
    const bonuses = calculateBonuses();
    const statsStyle: React.CSSProperties = {
      position: 'absolute',
      top: '27.5%',
      left: '34%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '10px',
      borderRadius: '5px',
      color: 'white',
      zIndex: 101,
      border: '1px solid #8a5a2b',
      minWidth: '150px'
    };

    return (
      <div style={statsStyle}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>Характеристики</h3>
        <p>Здоровье: {character.health}</p>
        <p>Атака: +{bonuses.damageBonus || 0}</p>
        <p>Защита: +{bonuses.defenseBonus || 0}</p>
      </div>
    );
  };

  // Рендер инвентаря в стиле Diablo
  const renderInventory = () => {
    if (!inventoryOpen) return null;

    const inventoryStyle: React.CSSProperties = {
      position: 'absolute',
      top: '57%',
      left: '63.5%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      border: '2px solid #8a5a2b',
      borderRadius: '10px',
      padding: CONSTANTS.INVENTORY_PADDING,
      zIndex: 100,
      width: `${CONSTANTS.INVENTORY_SLOT_SIZE * 4 + CONSTANTS.INVENTORY_PADDING * 5}px`,
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    };

    const slotStyle: React.CSSProperties = {
      width: CONSTANTS.INVENTORY_SLOT_SIZE,
      height: CONSTANTS.INVENTORY_SLOT_SIZE,
      border: '1px solid #8a5a2b',
      backgroundColor: 'rgba(70, 70, 70, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '24px',
      cursor: 'pointer',
      position: 'relative'
    };

    const equippedSlotsStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: CONSTANTS.INVENTORY_PADDING,
      marginBottom: CONSTANTS.INVENTORY_PADDING
    };

    const inventorySlotsStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: CONSTANTS.INVENTORY_PADDING
    };

    const slotLabelStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: '2px',
      fontSize: '10px',
      color: '#8a5a2b'
    };

    return (
      <div style={inventoryStyle}>
        <h2 style={{ marginTop: 0, marginBottom: CONSTANTS.INVENTORY_PADDING }}>Инвентарь</h2>
        
        {/* Слоты экипировки */}
        <div style={equippedSlotsStyle}>
          {/* Шлем */}
          <div 
            style={{ ...slotStyle, gridColumn: '2 / 3' }}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(-2, true)}
          >
            {equippedItems.helmet ? (
              <div 
                draggable
                onDragStart={() => handleDragStart(-2, true)}
              >
                {equippedItems.helmet.icon}
              </div>
            ) : ''}
            <div style={slotLabelStyle}>Шлем</div>
          </div>
          
          {/* Броня */}
          <div 
            style={{ ...slotStyle, gridColumn: '2 / 3', gridRow: '2 / 3' }}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(-3, true)}
          >
            {equippedItems.armor ? (
              <div 
                draggable
                onDragStart={() => handleDragStart(-3, true)}
              >
                {equippedItems.armor.icon}
              </div>
            ) : ''}
            <div style={slotLabelStyle}>Броня</div>
          </div>
          
          {/* Ботинки */}
          <div 
            style={{ ...slotStyle, gridColumn: '2 / 3', gridRow: '3 / 3' }}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(-4, true)}
          >
            {equippedItems.boots ? (
              <div 
                draggable
                onDragStart={() => handleDragStart(-4, true)}
              >
                {equippedItems.boots.icon}
              </div>
            ) : ''}
            <div style={slotLabelStyle}>Ботинки</div>
          </div>
        </div>
        
        {/* Оружие */}
        <div 
          style={{ 
            position: 'absolute',
            left: CONSTANTS.INVENTORY_PADDING,
            top: `${CONSTANTS.INVENTORY_SLOT_SIZE * 2 + CONSTANTS.INVENTORY_PADDING * 4}px`
          }}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(-1, true)}
        >
          <div style={slotStyle}>
            {equippedItems.weapon ? (
              <div 
                draggable
                onDragStart={() => handleDragStart(-1, true)}
              >
                {equippedItems.weapon.icon}
              </div>
            ) : ''}
            <div style={slotLabelStyle}>Оружие</div>
          </div>
        </div>
        
        {/* Область для использования зелий */}
        <div 
          style={{
            position: 'absolute',
            right: CONSTANTS.INVENTORY_PADDING,
            top: `${CONSTANTS.INVENTORY_SLOT_SIZE * 2 + CONSTANTS.INVENTORY_PADDING * 4}px`,
            width: CONSTANTS.INVENTORY_SLOT_SIZE,
            height: CONSTANTS.INVENTORY_SLOT_SIZE,
            border: '1px dashed #8a5a2b',
            backgroundColor: usePotionArea ? 'rgba(139, 0, 0, 0.5)' : 'rgba(0, 100, 0, 0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedItem?.item.type === 'potion') {
              setUsePotionArea(true);
            }
          }}
          onDragLeave={() => setUsePotionArea(false)}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedItem?.item.type === 'potion') {
              handleDrop(-1, true); // Используем специальный индекс для области использования
            }
          }}
          onClick={() => {
            // Поиск первого зелья в инвентаре
            const potionIndex = inventoryItems.findIndex(
              item => item?.type === 'potion'
            );
            if (potionIndex !== -1) {
              const potion = inventoryItems[potionIndex]!;
              applyPotionEffect(potion);
              const newInventory = [...inventoryItems];
              newInventory[potionIndex] = null;
              setInventoryItems(newInventory);
            }
          }}
        >
          <span style={{ fontSize: '24px' }}>❤️</span>
          <div style={{
            position: 'absolute',
            bottom: '2px',
            fontSize: '10px',
            color: '#8a5a2b'
          }}>
            Исп. зелье
          </div>
        </div>
        
        {/* Основной инвентарь */}
        <div style={inventorySlotsStyle}>
          {inventoryItems.map((item, index) => (
            <div 
              key={index}
              style={slotStyle}
              draggable={!!item}
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              onDoubleClick={() => handleDoubleClick(index)} // Добавляем обработчик двойного клика
            >
              {item ? item.icon : ''}
            </div>
          ))}
        </div>
        
        {/* Кнопка закрытия */}
        <button 
          onClick={() => setInventoryOpen(false)}
          style={{
            marginTop: CONSTANTS.INVENTORY_PADDING,
            padding: '8px 16px',
            backgroundColor: '#8a5a2b',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Закрыть (I)
        </button>
      </div>
    );
  };

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
      {renderCharacterStats()}
      {renderInventory()}
    </div>
  );
};

export default IsometricGame;