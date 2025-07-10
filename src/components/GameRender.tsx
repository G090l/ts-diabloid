import { CONSTANTS } from '../utils/constants';
import { Tile, Enemy, Character, CharacterTextures, EnemyTextures, ItemOnMap } from '../utils/types';
import { tileToScreen, calculateDistance, getCharacterDirection } from '../utils/gameUtils';

// =============================================
// КОМПОНЕНТЫ ОТРИСОВКИ
// =============================================
export const drawHealthOrb = (ctx: CanvasRenderingContext2D, character: Character) => {
    const healthPercentage = Math.min(1, character.health / character.maxHealth);

    const orbX = CONSTANTS.HEALTH_ORB_MARGIN + CONSTANTS.HEALTH_ORB_RADIUS;
    const orbY = CONSTANTS.CANVAS_HEIGHT - CONSTANTS.HEALTH_ORB_MARGIN - CONSTANTS.HEALTH_ORB_RADIUS;

    const gradient = ctx.createRadialGradient(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.3, orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS);
    gradient.addColorStop(0, '#4a0000'); gradient.addColorStop(1, '#1a0000');
    ctx.beginPath(); ctx.arc(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = gradient; ctx.fill();

    ctx.beginPath(); ctx.moveTo(orbX, orbY);
    ctx.arc(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.9, Math.PI * 1.5, Math.PI * 1.5 + Math.PI * 2 * healthPercentage);
    ctx.closePath();
    const healthGradient = ctx.createRadialGradient(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.3, orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS * 0.9);
    healthGradient.addColorStop(0, '#ff0000'); healthGradient.addColorStop(1, '#800000');
    ctx.fillStyle = healthGradient; ctx.fill();

    ctx.beginPath(); ctx.arc(orbX, orbY, CONSTANTS.HEALTH_ORB_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${character.health}/${character.maxHealth}`, orbX, orbY);
};

export const renderGame = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    tiles: Tile[],
    character: Character,
    cameraOffset: { x: number; y: number },
    enemies: Enemy[],
    hoveredEnemy: { x: number; y: number } | null,
    itemsOnMap: ItemOnMap[],
    gameOver: boolean,
    grassTexture: HTMLImageElement | null,
    waterTexture: HTMLImageElement | null,
    stoneTexture: HTMLImageElement | null,
    rockTexture: HTMLImageElement | null,
    characterTextures: CharacterTextures,
    enemyTextures: EnemyTextures,
    enemyRedTextures: EnemyTextures
) => {
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

            const isHovered = hoveredEnemy?.x === enemy.x && hoveredEnemy?.y === enemy.y;
            const currentEnemyTexture = isHovered
                ? enemyRedTextures[enemyDirection as keyof typeof enemyRedTextures]
                : enemyTextures[enemyDirection as keyof typeof enemyTextures];

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

            ctx.fillStyle = '#ff0000';
            ctx.fillRect(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY - 8, CONSTANTS.ENEMY_WIDTH, 5);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(screenX - CONSTANTS.ENEMY_WIDTH / 2, adjustedScreenY - 8, CONSTANTS.ENEMY_WIDTH * (enemy.health / 100), 5);
        });

    // Отрисовка персонажа
    if (!gameOver) {
        const { x: charScreenX, y: charScreenY } = tileToScreen(character.x, character.y);
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
    drawHealthOrb(ctx, character);

    // Отрисовка экрана Game Over
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('Персонаж погиб', canvas.width / 2, canvas.height / 2 + 60);
    }
};