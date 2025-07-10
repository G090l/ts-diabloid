import React from 'react';
import { EquippedItems, Item } from '../utils/types';

// =============================================
// КОМПОНЕНТ ХАРАКТЕРИСТИК ПЕРСОНАЖА
// =============================================
interface CharacterStatsProps {
    character: {
        health: number;
        maxHealth: number;
    };
    equippedItems: EquippedItems;
}

export const CharacterStats: React.FC<CharacterStatsProps> = ({
    character,
    equippedItems
}) => {
    const calculateBonuses = () => {
        let total = { healthBonus: 0, damageBonus: 0, defenseBonus: 0 };

        (Object.values(equippedItems) as (Item | null)[]).forEach(item => {
            if (item?.effect) {
                total.healthBonus += item.effect.healthBonus || 0;
                total.damageBonus += item.effect.damageBonus || 0;
                total.defenseBonus += item.effect.defenseBonus || 0;
            }
        });

        return total;
    };

    const bonuses = calculateBonuses();

    const statsStyle: React.CSSProperties = {
        position: 'fixed',
        top: '12.5%',
        left: '34.9%',
        transform: 'translate(-50%, 0)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '15px',
        borderRadius: '8px',
        color: '#e0e0e0',
        zIndex: 101,
        border: '2px solid #8a5a2b',
        minWidth: '180px',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
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