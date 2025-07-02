import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface Tile {
  x: number;
  y: number;
  type: 'grass' | 'stone' | 'water';
  occupied: boolean;
}

interface Enemy {
  x: number;
  y: number;
  health: number;
}

interface Character {
  x: number;
  y: number;
  moving: boolean;
  targetX: number | null;
  targetY: number | null;
  path: {x: number, y: number}[];
}

const CONSTANTS = {
  TILE_WIDTH: 64,
  TILE_HEIGHT: 32,
  CHARACTER_WIDTH: 32,
  CHARACTER_HEIGHT: 48,
  ENEMY_WIDTH: 32,
  ENEMY_HEIGHT: 48,
  PATH_DOT_RADIUS: 2,
  TARGET_HIGHLIGHT_COLOR: '#ffff00',
  TARGET_HIGHLIGHT_WIDTH: 3,
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  MAP_WIDTH: 50,
  MAP_HEIGHT: 50,
  ENEMY_COUNT: 70,
  MOVE_INTERVAL: 200
};

const IsometricGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredEnemy, setHoveredEnemy] = useState<{x: number, y: number} | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [character, setCharacter] = useState<Character>({
    x: 5,
    y: 5,
    moving: false,
    targetX: null,
    targetY: null,
    path: []
  });
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });

  const tileToScreen = useCallback((x: number, y: number) => ({
    x: (x - y) * CONSTANTS.TILE_WIDTH / 2,
    y: (x + y) * CONSTANTS.TILE_HEIGHT / 2
  }), []);

  const screenToTile = useCallback((screenX: number, screenY: number) => ({
    x: Math.floor((screenX / (CONSTANTS.TILE_WIDTH / 2) + screenY / (CONSTANTS.TILE_HEIGHT / 2)) / 2),
    y: Math.floor((screenY / (CONSTANTS.TILE_HEIGHT / 2) - screenX / (CONSTANTS.TILE_WIDTH / 2)) / 2)
  }), []);

  // Обновление занятости тайлов
  const updateTilesOccupancy = useCallback((tiles: Tile[], character: Character, enemies: Enemy[]) => {
    return tiles.map(tile => {
      const isOccupiedByCharacter = tile.x === character.x && tile.y === character.y;
      const isOccupiedByEnemy = enemies.some(enemy => enemy.x === tile.x && enemy.y === tile.y);
      const isWater = tile.type === 'water';
      
      return {
        ...tile,
        occupied: isOccupiedByCharacter || isOccupiedByEnemy || isWater
      };
    });
  }, []);

  // Инициализация карты и врагов
  useEffect(() => {
    const newTiles: Tile[] = [];
    for (let y = 0; y < CONSTANTS.MAP_HEIGHT; y++) {
      for (let x = 0; x < CONSTANTS.MAP_WIDTH; x++) {
        const type = Math.random() > 0.95 ? 'water' : 'grass';
        newTiles.push({ x, y, type, occupied: type === 'water' });
      }
    }
    
    const newEnemies: Enemy[] = [];
    for (let i = 0; i < CONSTANTS.ENEMY_COUNT; i++) {
      newEnemies.push({
        x: Math.floor(Math.random() * CONSTANTS.MAP_WIDTH),
        y: Math.floor(Math.random() * CONSTANTS.MAP_HEIGHT),
        health: 100
      });
    }
    
    // Обновляем занятость тайлов после создания врагов
    const updatedTiles = updateTilesOccupancy(newTiles, character, newEnemies);
    setTiles(updatedTiles);
    setEnemies(newEnemies);
  }, [updateTilesOccupancy]);

  // Обновление позиции камеры
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x: charScreenX, y: charScreenY } = tileToScreen(character.x, character.y);
    const adjustedCharScreenY = charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2;

    setCameraOffset({
      x: canvas.width / 2 - charScreenX,
      y: canvas.height / 2 - adjustedCharScreenY
    });
  }, [character.x, character.y, tileToScreen]);

  // Обновление занятости тайлов при изменении позиции персонажа или врагов
  useEffect(() => {
    setTiles(prevTiles => updateTilesOccupancy(prevTiles, character, enemies));
  }, [character.x, character.y, enemies, updateTilesOccupancy]);

  const isAdjacentToEnemy = useCallback((charX: number, charY: number, enemyX: number, enemyY: number) => {
    return (Math.abs(charX - enemyX) === 1 && charY === enemyY) || 
           (Math.abs(charY - enemyY) === 1 && charX === enemyX);
  }, []);

  const attackEnemy = useCallback((enemyX: number, enemyY: number) => {
    setEnemies(prevEnemies => prevEnemies.map(enemy => {
      if (enemy.x === enemyX && enemy.y === enemyY) {
        const newHealth = enemy.health - 25;
        return newHealth <= 0 ? null : { ...enemy, health: newHealth };
      }
      return enemy;
    }).filter(Boolean) as Enemy[]);
  }, []);

  const findPath = useCallback((startX: number, startY: number, targetX: number, targetY: number) => {
    const path: {x: number, y: number}[] = [];
    let currentX = startX;
    let currentY = startY;

    const isTargetEnemy = enemies.some(e => e.x === targetX && e.y === targetY);
    const stopBeforeTarget = isTargetEnemy;

    while (currentX !== targetX || currentY !== targetY) {
      if (currentX !== targetX) {
        const nextX = currentX + (targetX > currentX ? 1 : -1);
        const tile = tiles.find(t => t.x === nextX && t.y === currentY);
        
        if (tile && !tile.occupied) {
          currentX = nextX;
          path.push({x: currentX, y: currentY});
          if (stopBeforeTarget && nextX === targetX && currentY === targetY) break;
        } else break;
      }

      if (currentY !== targetY) {
        const nextY = currentY + (targetY > currentY ? 1 : -1);
        const tile = tiles.find(t => t.x === currentX && t.y === nextY);
        
        if (tile && !tile.occupied) {
          currentY = nextY;
          path.push({x: currentX, y: currentY});
          if (stopBeforeTarget && currentX === targetX && nextY === targetY) break;
        } else break;
      }
    }

    return path;
  }, [tiles, enemies]);

  useEffect(() => {
    if (!character.moving || character.path.length === 0) return;

    const moveInterval = setInterval(() => {
      setCharacter(prev => {
        if (prev.path.length === 0) {
          return { ...prev, moving: false, targetX: null, targetY: null, path: [] };
        }

        const [nextStep, ...remainingPath] = prev.path;
        const tile = tiles.find(t => t.x === nextStep.x && t.y === nextStep.y);
        
        if (!tile || tile.occupied) {
          return { ...prev, moving: false, targetX: null, targetY: null, path: [] };
        }

        return {
          ...prev,
          x: nextStep.x,
          y: nextStep.y,
          path: remainingPath
        };
      });
    }, CONSTANTS.MOVE_INTERVAL);

    return () => clearInterval(moveInterval);
  }, [character.moving, character.path, tiles]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - cameraOffset.x;
    const mouseY = e.clientY - rect.top - cameraOffset.y;

    const { x: tileX, y: tileY } = screenToTile(mouseX, mouseY);
    const enemyUnderCursor = enemies.find(e => e.x === tileX && e.y === tileY);
    setHoveredEnemy(enemyUnderCursor ? {x: tileX, y: tileY} : null);
  }, [cameraOffset, enemies, screenToTile]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - cameraOffset.x;
    const mouseY = e.clientY - rect.top - cameraOffset.y;

    const { x: tileX, y: tileY } = screenToTile(mouseX, mouseY);
    
    if (tileX < 0 || tileX >= CONSTANTS.MAP_WIDTH || tileY < 0 || tileY >= CONSTANTS.MAP_HEIGHT) return;

    const clickedEnemy = enemies.find(e => e.x === tileX && e.y === tileY);
    const clickedTile = tiles.find(t => t.x === tileX && t.y === tileY);
    
    if (!clickedTile) return;

    if (clickedEnemy) {
      if (isAdjacentToEnemy(character.x, character.y, tileX, tileY)) {
        attackEnemy(tileX, tileY);
      } else {
        const path = findPath(character.x, character.y, tileX, tileY);
        if (path.length > 0) {
          setCharacter(prev => ({
            ...prev,
            moving: true,
            targetX: tileX,
            targetY: tileY,
            path
          }));
        }
      }
    } else if (!clickedTile.occupied) {
      const path = findPath(character.x, character.y, tileX, tileY);
      if (path.length > 0) {
        setCharacter(prev => ({
          ...prev,
          moving: true,
          targetX: tileX,
          targetY: tileY,
          path
        }));
      }
    }
  }, [cameraOffset, character.x, character.y, enemies, isAdjacentToEnemy, attackEnemy, findPath, screenToTile, tiles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);

    tiles.forEach(tile => {
      const { x: screenX, y: screenY } = tileToScreen(tile.x, tile.y);
      
      let color;
      switch (tile.type) {
        case 'grass': color = '#5a8f3d'; break;
        case 'stone': color = '#7a7a7a'; break;
        case 'water': color = '#3a5a9a'; break;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX + CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
      ctx.lineTo(screenX, screenY + CONSTANTS.TILE_HEIGHT);
      ctx.lineTo(screenX - CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    enemies.forEach(enemy => {
      const { x: screenX, y: screenY } = tileToScreen(enemy.x, enemy.y);
      const adjustedScreenY = screenY - CONSTANTS.ENEMY_HEIGHT / 2;

      if (hoveredEnemy?.x === enemy.x && hoveredEnemy?.y === enemy.y) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenX, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
        ctx.lineTo(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
        ctx.lineTo(screenX, adjustedScreenY);
        ctx.lineTo(screenX + CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.fillStyle = '#8a2be2';
      ctx.beginPath();
      ctx.moveTo(screenX, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
      ctx.lineTo(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
      ctx.lineTo(screenX, adjustedScreenY);
      ctx.lineTo(screenX + CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY + CONSTANTS.ENEMY_HEIGHT);
      ctx.closePath();
      ctx.fill();

      const healthBarWidth = CONSTANTS.ENEMY_WIDTH;
      const healthBarX = screenX - CONSTANTS.ENEMY_WIDTH / 2;
      const healthBarY = adjustedScreenY - 8;

      ctx.fillStyle = '#ff0000';
      ctx.fillRect(healthBarX, healthBarY, healthBarWidth, 5);
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(healthBarX, healthBarY, healthBarWidth * (enemy.health / 100), 5);
    });

    if (character.targetX !== null && character.targetY !== null) {
      const targetTile = tiles.find(t => t.x === character.targetX && t.y === character.targetY);
      if (targetTile) {
        const { x: screenX, y: screenY } = tileToScreen(targetTile.x, targetTile.y);
        
        ctx.strokeStyle = CONSTANTS.TARGET_HIGHLIGHT_COLOR;
        ctx.lineWidth = CONSTANTS.TARGET_HIGHLIGHT_WIDTH;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
        ctx.lineTo(screenX, screenY + CONSTANTS.TILE_HEIGHT);
        ctx.lineTo(screenX - CONSTANTS.TILE_WIDTH / 2, screenY + CONSTANTS.TILE_HEIGHT / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }

    if (character.path.length > 0) {
      ctx.fillStyle = '#fff';
      character.path.forEach(step => {
        const { x: tileScreenX, y: tileScreenY } = tileToScreen(step.x, step.y);
        const centerY = tileScreenY + CONSTANTS.TILE_HEIGHT / 2;
        
        ctx.beginPath();
        ctx.arc(tileScreenX, centerY, CONSTANTS.PATH_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const { x: charScreenX, y: charScreenY } = tileToScreen(character.x, character.y);
    const adjustedCharScreenY = charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2;

    ctx.fillStyle = '#d43b3b';
    ctx.beginPath();
    ctx.moveTo(charScreenX, adjustedCharScreenY + CONSTANTS.CHARACTER_HEIGHT);
    ctx.lineTo(charScreenX - CONSTANTS.CHARACTER_WIDTH / 2, adjustedCharScreenY + CONSTANTS.CHARACTER_HEIGHT);
    ctx.lineTo(charScreenX, adjustedCharScreenY);
    ctx.lineTo(charScreenX + CONSTANTS.CHARACTER_WIDTH / 2, adjustedCharScreenY + CONSTANTS.CHARACTER_HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [tiles, character, cameraOffset, enemies, hoveredEnemy, tileToScreen]);

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
        style={{ border: '1px solid black', backgroundColor: '#222', cursor: 'pointer' }}
      />
    </div>
  );
};

export default IsometricGame;