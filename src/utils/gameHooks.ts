import { CONSTANTS } from '../utils/constants';
import { Tile, Enemy, Character, Item, CharacterTextures, EnemyTextures } from '../utils/types';
import { tileToScreen, calculateDistance } from '../utils/gameUtils';
import { useEffect, useState, useCallback } from 'react';
// =============================================
// КАСТОМНЫЕ ХУКИ
// =============================================
export const useTextures = () => {
    const [grassTexture, setGrassTexture] = useState<HTMLImageElement | null>(null);
    const [waterTexture, setWaterTexture] = useState<HTMLImageElement | null>(null);
    const [stoneTexture, setStoneTexture] = useState<HTMLImageElement | null>(null);
    const [rockTexture, setRockTexture] = useState<HTMLImageElement | null>(null);
    const [characterTextures, setCharacterTextures] = useState<CharacterTextures>({ up: null, down: null, left: null, right: null });
    const [enemyTextures, setEnemyTextures] = useState<EnemyTextures>({ up: null, down: null, left: null, right: null });
    const [enemyRedTextures, setEnemyRedTextures] = useState<EnemyTextures>({ up: null, down: null, left: null, right: null });

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

    return {
        grassTexture,
        waterTexture,
        stoneTexture,
        rockTexture,
        characterTextures,
        enemyTextures,
        enemyRedTextures
    };
};

export const useGameInitialization = () => {
    const [tiles, setTiles] = useState<Tile[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);

    useEffect(() => {
        const newTiles: Tile[] = Array.from({ length: CONSTANTS.MAP_WIDTH * CONSTANTS.MAP_HEIGHT }, (_, i) => {
            const x = i % CONSTANTS.MAP_WIDTH;
            const y = Math.floor(i / CONSTANTS.MAP_WIDTH);
            const rand = Math.random();
            const type = rand > 0.95 ? 'water' : rand > 0.9 ? 'stone' : 'grass';
            return { x, y, type, occupied: type === 'water' };
        });

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

    return { tiles, setTiles, enemies, setEnemies };
};

export const useCameraSystem = (
    character: Character,
    canvasRef: React.RefObject<HTMLCanvasElement | null>
) => {
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { x: charScreenX, y: charScreenY } = tileToScreen(character.x, character.y);
        setCameraOffset({
            x: canvas.width / 2 - charScreenX,
            y: canvas.height / 2 - (charScreenY - CONSTANTS.CHARACTER_HEIGHT / 2)
        });
    }, [character.x, character.y]);

    return { cameraOffset, setCameraOffset };
};

export const usePotionSystem = () => {
    const applyPotionEffect = useCallback((potion: Item, setCharacter: React.Dispatch<React.SetStateAction<Character>>) => {
        setCharacter(prev => {
            const healthBonus = potion.effect.healthBonus || 0;
            const newHealth = Math.min(prev.maxHealth, prev.health + healthBonus);
            return { ...prev, health: newHealth };
        });
    }, []);

    return { applyPotionEffect };
};