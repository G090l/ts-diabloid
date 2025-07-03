import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// Интерфейсы данных
interface Tile { x: number; y: number; type: 'grass' | 'stone' | 'water'; occupied: boolean; }
interface Enemy { x: number; y: number; health: number; chasing: boolean; }
interface Character { 
  x: number; y: number; moving: boolean; 
  targetX: number | null; targetY: number | null; 
  path: {x: number, y: number}[]; health: number; maxHealth: number; 
}

// Константы игры
const CONSTANTS = {
  TILE_WIDTH: 64, TILE_HEIGHT: 32, CHARACTER_WIDTH: 32, CHARACTER_HEIGHT: 48,
  ENEMY_WIDTH: 32, ENEMY_HEIGHT: 48, PATH_DOT_RADIUS: 2, 
  TARGET_HIGHLIGHT_COLOR: '#ffff00', TARGET_HIGHLIGHT_WIDTH: 3,
  CANVAS_WIDTH: 800, CANVAS_HEIGHT: 600, MAP_WIDTH: 50, MAP_HEIGHT: 50,
  ENEMY_COUNT: 70, MOVE_INTERVAL: 200, ENEMY_CHASE_RADIUS: 4,
  ENEMY_MOVE_INTERVAL: 500, RENDER_RADIUS: 17, HEALTH_ORB_RADIUS: 40,
  HEALTH_ORB_MARGIN: 20, ENEMY_DAMAGE: 10, DAMAGE_COOLDOWN: 1000
};

const IsometricGame: React.FC = () => {
  // Refs и состояния
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

  // Вспомогательные функции
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

  // Функции проверки и обновления состояния
  const isTileFreeForEnemy = useCallback((x: number, y: number) => {
  if (x < 0 || x >= CONSTANTS.MAP_WIDTH || y < 0 || y >= CONSTANTS.MAP_HEIGHT) return false;
  const tile = tiles.find(t => t.x === x && t.y === y);
  const isOccupiedByPlayer = character.x === x && character.y === y;
  return tile && !tile.occupied && !isOccupiedByPlayer;
}, [tiles, character.x, character.y]);

  const updateTilesOccupancy = useCallback((tilesList: Tile[], char: Character, enemiesList: Enemy[]) => {
    return tilesList.map(tile => {
      const occupied = tile.type === 'water' || 
        (tile.x === char.x && tile.y === char.y) ||
        enemiesList.some(e => e.x === tile.x && e.y === tile.y);
      return { ...tile, occupied };
    });
  }, []);

  // Инициализация игры
  useEffect(() => {
    // Создание карты
    const newTiles: Tile[] = Array.from({ length: CONSTANTS.MAP_WIDTH * CONSTANTS.MAP_HEIGHT }, (_, i) => {
      const x = i % CONSTANTS.MAP_WIDTH;
      const y = Math.floor(i / CONSTANTS.MAP_WIDTH);
      const type = Math.random() > 0.95 ? 'water' : 'grass';
      return { x, y, type, occupied: type === 'water' };
    });

    // Создание врагов
    const newEnemies = Array.from({ length: CONSTANTS.ENEMY_COUNT }, () => {
      let x: number, y: number;
      do {
        x = Math.floor(Math.random() * CONSTANTS.MAP_WIDTH);
        y = Math.floor(Math.random() * CONSTANTS.MAP_HEIGHT);
      } while (newTiles.some(t => t.x === x && t.y === y && t.occupied) || 
               calculateDistance(x, y, 5, 5) < 3);
      return { x, y, health: 100, chasing: false };
    });

    setTiles(newTiles);
    setEnemies(newEnemies);
  }, []);

  // Эффекты обновления
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
  }, [character.x, character.y, enemies, updateTilesOccupancy]);

  // Логика боя
  const isAdjacentToEnemy = useCallback((charX: number, charY: number, enemyX: number, enemyY: number) => 
    (Math.abs(charX - enemyX) === 1 && charY === enemyY) || 
    (Math.abs(charY - enemyY) === 1 && charX === enemyX), []);

  const attackEnemy = useCallback((enemyX: number, enemyY: number) => {
    setEnemies(prev => prev.map(e => 
      e.x === enemyX && e.y === enemyY ? 
        (e.health - 25 <= 0 ? null : { ...e, health: e.health - 25 }) : e
    ).filter(Boolean) as Enemy[]);
  }, []);

  // Поиск пути
  const findPath = useCallback((startX: number, startY: number, targetX: number, targetY: number) => {
    const path: {x: number, y: number}[] = [];
    let currentX = startX, currentY = startY;
    const isTargetEnemy = enemies.some(e => e.x === targetX && e.y === targetY);

    while (currentX !== targetX || currentY !== targetY) {
      if (currentX !== targetX) {
        const nextX = currentX + (targetX > currentX ? 1 : -1);
        const tile = tiles.find(t => t.x === nextX && t.y === currentY);
        if (tile && !tile.occupied && !enemies.some(e => e.x === nextX && e.y === currentY)) {
          currentX = nextX;
          path.push({x: currentX, y: currentY});
          if (isTargetEnemy && nextX === targetX && currentY === targetY) break;
        } else break;
      }

      if (currentY !== targetY) {
        const nextY = currentY + (targetY > currentY ? 1 : -1);
        const tile = tiles.find(t => t.x === currentX && t.y === nextY);
        if (tile && !tile.occupied && !enemies.some(e => e.x === currentX && e.y === nextY)) {
          currentY = nextY;
          path.push({x: currentX, y: currentY});
          if (isTargetEnemy && currentX === targetX && nextY === targetY) break;
        } else break;
      }
    }
    return path;
  }, [tiles, enemies]);

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
        return { ...prev, x: nextStep.x, y: nextStep.y, path: remainingPath };
      });
    }, CONSTANTS.MOVE_INTERVAL);
    return () => clearInterval(moveInterval);
  }, [character.moving, character.path, tiles, enemies, gameOver]);

  // Движение врагов
useEffect(() => {
  const moveEnemies = () => {
    setEnemies(prev => {
      // Создаем копию врагов для проверки занятости тайлов
      const newEnemies = [...prev];
      const occupiedTiles = new Set<string>();
      
      // Сначала помечаем все текущие позиции врагов как занятые
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
          
          // Проверяем, свободен ли тайл и не занят ли он другими врагами в этом же ходе
          if (!occupiedTiles.has(tileKey) && isTileFreeForEnemy(newX, newY)) {
            // Помечаем старую позицию как свободную и новую как занятую
            occupiedTiles.delete(`${enemy.x},${enemy.y}`);
            occupiedTiles.add(tileKey);
            return { ...enemy, x: newX, y: newY, chasing: true };
          }
        }
        return { ...enemy, chasing: false };
      });
    });
  };
  
  const interval = setInterval(moveEnemies, CONSTANTS.ENEMY_MOVE_INTERVAL);
  return () => clearInterval(interval);
}, [character.x, character.y, isTileFreeForEnemy]);

  // Нанесение урона персонажу
  useEffect(() => {
    if (gameOver) return;
    const checkDamage = () => {
      const now = Date.now();
      if (now - lastDamageTime < CONSTANTS.DAMAGE_COOLDOWN) return;
      const adjacentEnemies = enemies.filter(e => isAdjacentToEnemy(character.x, character.y, e.x, e.y));
      if (adjacentEnemies.length > 0) {
        setCharacter(prev => {
          const newHealth = Math.max(0, prev.health - CONSTANTS.ENEMY_DAMAGE);
          if (newHealth <= 0) setGameOver(true);
          return { ...prev, health: newHealth };
        });
        setLastDamageTime(now);
      }
    };
    const interval = setInterval(checkDamage, 100);
    return () => clearInterval(interval);
  }, [enemies, character.x, character.y, isAdjacentToEnemy, lastDamageTime, gameOver]);

  // Обработчики событий
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x: tileX, y: tileY } = screenToTile(
      e.clientX - rect.left - cameraOffset.x,
      e.clientY - rect.top - cameraOffset.y
    );
    setHoveredEnemy(enemies.find(e => e.x === tileX && e.y === tileY) ? {x: tileX, y: tileY} : null);
  }, [cameraOffset, enemies, screenToTile, gameOver]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver) return;
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
    } else if (!clickedTile.occupied) {
      const path = findPath(character.x, character.y, tileX, tileY);
      if (path.length > 0) setCharacter(prev => ({
        ...prev, moving: true, targetX: tileX, targetY: tileY, path
      }));
    }
  }, [cameraOffset, character.x, character.y, enemies, isAdjacentToEnemy, attackEnemy, findPath, screenToTile, tiles, gameOver]);

  // Отрисовка элементов игры
  const drawHealthOrb = useCallback((ctx: CanvasRenderingContext2D) => {
    const orbX = CONSTANTS.HEALTH_ORB_MARGIN + CONSTANTS.HEALTH_ORB_RADIUS;
    const orbY = CONSTANTS.CANVAS_HEIGHT - CONSTANTS.HEALTH_ORB_MARGIN - CONSTANTS.HEALTH_ORB_RADIUS;
    
    // Фон орбы здоровья
    const gradient = ctx.createRadialGradient(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.3, orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS);
    gradient.addColorStop(0, '#4a0000'); gradient.addColorStop(1, '#1a0000');
    ctx.beginPath(); ctx.arc(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = gradient; ctx.fill();

    // Индикатор здоровья
    const healthPercentage = character.health / character.maxHealth;
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
    ctx.save(); ctx.translate(cameraOffset.x, cameraOffset.y);

    // Отрисовка видимых тайлов
    tiles.filter(t => calculateDistance(t.x, t.y, character.x, character.y) <= CONSTANTS.RENDER_RADIUS)
      .forEach(tile => {
        const { x: screenX, y: screenY } = tileToScreen(tile.x, tile.y);
        ctx.fillStyle = tile.type === 'grass' ? '#5a8f3d' : tile.type === 'stone' ? '#7a7a7a' : '#3a5a9a';
        ctx.beginPath(); ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
        ctx.lineTo(screenX, screenY + CONSTANTS.TILE_HEIGHT); 
        ctx.lineTo(screenX - CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
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
  }, [tiles, character, cameraOffset, enemies, hoveredEnemy, tileToScreen, drawHealthOrb, gameOver]);

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Diabloid</h1>
      <p>Нажми на тайл для перемещения или на врага для атаки</p>
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
    </div>
  );
};

export default IsometricGame;