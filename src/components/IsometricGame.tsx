import React, { useEffect, useRef, useState } from 'react';

interface Tile {
  x: number;
  y: number;
  type: 'grass' | 'stone' | 'water';
}

interface Character {
  x: number;
  y: number;
  moving: boolean;
  targetX: number | null;
  targetY: number | null;
  path: {x: number, y: number}[];
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const CHARACTER_WIDTH = 32;
const CHARACTER_HEIGHT = 48;
const PATH_DOT_RADIUS = 2; // Радиус точек пути
const TARGET_HIGHLIGHT_COLOR = '#ffff00'; // Жёлтый цвет для выделения
const TARGET_HIGHLIGHT_WIDTH = 3; // Толщина обводки

const IsometricGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [character, setCharacter] = useState<Character>({
    x: 5,
    y: 5,
    moving: false,
    targetX: null,
    targetY: null,
    path: []
  });
  const [mapSize] = useState({ width: 10, height: 10 });

  // Инициализация карты
  useEffect(() => {
    const newTiles: Tile[] = [];
    for (let y = 0; y < mapSize.height; y++) {
      for (let x = 0; x < mapSize.width; x++) {
        let type: 'grass' | 'stone' | 'water' = 'grass';
        if (Math.random() > 0.95) type = 'water';
        
        newTiles.push({ x, y, type });
      }
    }
    setTiles(newTiles);
  }, [mapSize]);

  // Поиск пути
  const findPath = (startX: number, startY: number, targetX: number, targetY: number) => {
    const path: {x: number, y: number}[] = [];
    let currentX = startX;
    let currentY = startY;

    while (currentX !== targetX || currentY !== targetY) {
      if (currentX !== targetX) {
        const nextX = currentX + (targetX > currentX ? 1 : -1);
        const tile = tiles.find(t => t.x === nextX && t.y === currentY);
        if (tile && tile.type !== 'water') {
          currentX = nextX;
          path.push({x: currentX, y: currentY});
        } else {
          break;
        }
      }

      if (currentY !== targetY) {
        const nextY = currentY + (targetY > currentY ? 1 : -1);
        const tile = tiles.find(t => t.x === currentX && t.y === nextY);
        if (tile && tile.type !== 'water') {
          currentY = nextY;
          path.push({x: currentX, y: currentY});
        } else {
          break;
        }
      }
    }

    return path;
  };

  // Обработка движения
  useEffect(() => {
    if (!character.moving || character.path.length === 0) return;

    const moveInterval = setInterval(() => {
      setCharacter(prev => {
        if (prev.path.length === 0) {
          return { ...prev, moving: false, targetX: null, targetY: null, path: [] };
        }

        const [nextStep, ...remainingPath] = prev.path;
        const nextTile = tiles.find(t => t.x === nextStep.x && t.y === nextStep.y);
        if (nextTile?.type === 'water') {
          return { ...prev, moving: false, targetX: null, targetY: null, path: [] };
        }

        return {
          ...prev,
          x: nextStep.x,
          y: nextStep.y,
          path: remainingPath
        };
      });
    }, 200);

    return () => clearInterval(moveInterval);
  }, [character.moving, character.path, tiles]);

  // Отрисовка
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем тайлы
    tiles.forEach(tile => {
      const screenX = (tile.x - tile.y) * TILE_WIDTH / 2 + canvas.width / 2;
      const screenY = (tile.x + tile.y) * TILE_HEIGHT / 2;

      let color;
      switch (tile.type) {
        case 'grass': color = '#5a8f3d'; break;
        case 'stone': color = '#7a7a7a'; break;
        case 'water': color = '#3a5a9a'; break;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
      ctx.lineTo(screenX, screenY + TILE_HEIGHT);
      ctx.lineTo(screenX - TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Выделяем целевой тайл (если есть)
    if (character.targetX !== null && character.targetY !== null) {
      const targetTile = tiles.find(t => 
        t.x === character.targetX && t.y === character.targetY
      );
      
      if (targetTile) {
        const screenX = (targetTile.x - targetTile.y) * TILE_WIDTH / 2 + canvas.width / 2;
        const screenY = (targetTile.x + targetTile.y) * TILE_HEIGHT / 2;

        ctx.strokeStyle = TARGET_HIGHLIGHT_COLOR;
        ctx.lineWidth = TARGET_HIGHLIGHT_WIDTH;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
        ctx.lineTo(screenX, screenY + TILE_HEIGHT);
        ctx.lineTo(screenX - TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Рисуем точки пути
    if (character.path.length > 0) {
      ctx.fillStyle = '#fff'; //Цвет для точек пути
      
      character.path.forEach(step => {
        const tileScreenX = (step.x - step.y) * TILE_WIDTH / 2 + canvas.width / 2;
        const tileScreenY = (step.x + step.y) * TILE_HEIGHT / 2;
        
        // Центр тайла
        const centerX = tileScreenX;
        const centerY = tileScreenY + TILE_HEIGHT / 2;
        
        // Рисуем точку
        ctx.beginPath();
        ctx.arc(centerX, centerY, PATH_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });

    }

    // Рисуем персонажа
    const charScreenX = (character.x - character.y) * TILE_WIDTH / 2 + canvas.width / 2;
    const charScreenY = (character.x + character.y) * TILE_HEIGHT / 2 - CHARACTER_HEIGHT / 2;

    ctx.fillStyle = '#d43b3b';
    ctx.beginPath();
    ctx.moveTo(charScreenX, charScreenY + CHARACTER_HEIGHT);
    ctx.lineTo(charScreenX - CHARACTER_WIDTH / 2, charScreenY + CHARACTER_HEIGHT);
    ctx.lineTo(charScreenX, charScreenY);
    ctx.lineTo(charScreenX + CHARACTER_WIDTH / 2, charScreenY + CHARACTER_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }, [tiles, character]);

  // Обработка кликов
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const relativeX = mouseX - canvas.width / 2;
    const relativeY = mouseY;

    const tileX = Math.floor((relativeX / (TILE_WIDTH / 2) + relativeY / (TILE_HEIGHT / 2)) / 2);
    const tileY = Math.floor((relativeY / (TILE_HEIGHT / 2) - relativeX / (TILE_WIDTH / 2)) / 2);

    if (tileX >= 0 && tileX < mapSize.width && tileY >= 0 && tileY < mapSize.height) {
      const clickedTile = tiles.find(t => t.x === tileX && t.y === tileY);
      
      if (clickedTile && clickedTile.type !== 'water') {
        const path = findPath(character.x, character.y, tileX, tileY);
        
        if (path.length > 0) {
          setCharacter(prev => ({
            ...prev,
            moving: true,
            targetX: tileX,
            targetY: tileY,
            path: path
          }));
        }
      }
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Diabloid</h1>
      <p>Нажми на тайл для перемещения (персонаж не ходит по воде)</p>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={handleCanvasClick}
        style={{ border: '1px solid black', backgroundColor: '#222' }}
      />
    </div>
  );
};

export default IsometricGame;