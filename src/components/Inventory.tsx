import React, { useState } from 'react';
import { CONSTANTS } from '../utils/constants';
import { Item, EquippedItems } from '../utils/types';

// =============================================
// КОМПОНЕНТ ИНВЕНТАРЯ
// =============================================
interface InventoryProps {
    inventoryOpen: boolean;
    setInventoryOpen: (open: boolean) => void;
    inventoryItems: (Item | null)[];
    setInventoryItems: (items: (Item | null)[]) => void;
    equippedItems: EquippedItems;
    setEquippedItems: (items: EquippedItems) => void;
    applyPotionEffect: (potion: Item) => void;
}

export const Inventory: React.FC<InventoryProps> = ({
    inventoryOpen,
    setInventoryOpen,
    inventoryItems,
    setInventoryItems,
    equippedItems,
    setEquippedItems,
    applyPotionEffect
}) => {
    const [draggedItem, setDraggedItem] = useState<{ item: Item, index: number, fromEquipped: boolean } | null>(null);
    const [usePotionArea, setUsePotionArea] = useState(false);

    const handleDragStart = (index: number, fromEquipped: boolean = false) => {
        if (fromEquipped) {
            const itemType = index === -1 ? 'weapon' :
                index === -2 ? 'helmet' :
                    index === -3 ? 'armor' : 'boots';
            const item = equippedItems[itemType];
            if (item) {
                setDraggedItem({ item, index, fromEquipped: true });
            }
        } else {
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

        if (draggedItem.item.type === 'potion' && usePotionArea) {
            applyPotionEffect(draggedItem.item);
            const newInventory = [...inventoryItems];
            newInventory[draggedItem.index] = null;
            setInventoryItems(newInventory);
            setUsePotionArea(false);
            setDraggedItem(null);
            return;
        }

        if (draggedItem.fromEquipped && !isEquipmentSlot) {
            const itemType = draggedItem.item.type;
            const newEquippedItems = { ...equippedItems };
            const newInventory = [...inventoryItems];
            const emptySlotIndex = newInventory.findIndex(item => item === null);

            if (emptySlotIndex !== -1) {
                newInventory[emptySlotIndex] = draggedItem.item;
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
        else if (!draggedItem.fromEquipped && isEquipmentSlot) {
            let slotType: keyof EquippedItems;
            switch (targetIndex) {
                case -1: slotType = 'weapon'; break;
                case -2: slotType = 'helmet'; break;
                case -3: slotType = 'armor'; break;
                case -4: slotType = 'boots'; break;
                default: return;
            }

            if (draggedItem.item.type !== slotType) {
                setDraggedItem(null);
                setUsePotionArea(false);
                return;
            }

            const newEquippedItems = { ...equippedItems };
            const oldItem = newEquippedItems[slotType];
            const newInventory = [...inventoryItems];

            newEquippedItems[slotType] = draggedItem.item;
            newInventory[draggedItem.index] = oldItem;

            setEquippedItems(newEquippedItems);
            setInventoryItems(newInventory);
        }
        else if (!draggedItem.fromEquipped && !isEquipmentSlot) {
            const newInventory = [...inventoryItems];
            if (newInventory[targetIndex] !== null) {
                const temp = newInventory[targetIndex];
                newInventory[targetIndex] = draggedItem.item;
                newInventory[draggedItem.index] = temp;
            } else {
                newInventory[targetIndex] = draggedItem.item;
                newInventory[draggedItem.index] = null;
            }
            setInventoryItems(newInventory);
        }

        setUsePotionArea(false);
        setDraggedItem(null);
    };

    const handleDoubleClick = (index: number) => {
        const item = inventoryItems[index];
        if (!item) return;

        if (item.type === 'potion') {
            applyPotionEffect(item);
            const newInventory = [...inventoryItems];
            newInventory[index] = null;
            setInventoryItems(newInventory);
            return;
        }

        const slotType = item.type as keyof EquippedItems;
        const newEquippedItems = { ...equippedItems };
        const newInventory = [...inventoryItems];

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

    if (!inventoryOpen) return null;

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

            <div style={equippedSlotsStyle}>
                <div
                    style={{ ...slotStyle, gridColumn: '2 / 3' }}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(-2, true)}
                >
                    {equippedItems.helmet && (
                        <div draggable onDragStart={() => handleDragStart(-2, true)}>
                            {equippedItems.helmet.icon}
                        </div>
                    )}
                    <div style={slotLabelStyle}>Шлем</div>
                </div>

                <div
                    style={{ ...slotStyle, gridColumn: '2 / 3', gridRow: '2 / 3' }}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(-3, true)}
                >
                    {equippedItems.armor && (
                        <div draggable onDragStart={() => handleDragStart(-3, true)}>
                            {equippedItems.armor.icon}
                        </div>
                    )}
                    <div style={slotLabelStyle}>Броня</div>
                </div>

                <div
                    style={{ ...slotStyle, gridColumn: '2 / 3', gridRow: '3 / 3' }}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(-4, true)}
                >
                    {equippedItems.boots && (
                        <div draggable onDragStart={() => handleDragStart(-4, true)}>
                            {equippedItems.boots.icon}
                        </div>
                    )}
                    <div style={slotLabelStyle}>Ботинки</div>
                </div>
            </div>

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
                    {equippedItems.weapon && (
                        <div draggable onDragStart={() => handleDragStart(-1, true)}>
                            {equippedItems.weapon.icon}
                        </div>
                    )}
                    <div style={slotLabelStyle}>Оружие</div>
                </div>
            </div>

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
                    if (draggedItem?.item.type === 'potion') setUsePotionArea(true);
                }}
                onDragLeave={() => setUsePotionArea(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    if (draggedItem?.item.type === 'potion') handleDrop(-1, true);
                }}
                onClick={() => {
                    const potionIndex = inventoryItems.findIndex(item => item?.type === 'potion');
                    if (potionIndex !== -1) {
                        applyPotionEffect(inventoryItems[potionIndex]!);
                        const newInventory = [...inventoryItems];
                        newInventory[potionIndex] = null;
                        setInventoryItems(newInventory);
                    }
                }}
            >
                <span style={{ fontSize: '24px' }}>❤️</span>
                <div style={{ position: 'absolute', bottom: '2px', fontSize: '10px', color: '#8a5a2b' }}>
                    Исп. зелье
                </div>
            </div>

            <div style={inventorySlotsStyle}>
                {inventoryItems.map((item, index) => (
                    <div
                        key={index}
                        style={slotStyle}
                        draggable={!!item}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(index)}
                        onDoubleClick={() => handleDoubleClick(index)}
                    >
                        {item?.icon}
                    </div>
                ))}
            </div>

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