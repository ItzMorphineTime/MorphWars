# Sprite Asset Creation Guide

This guide provides detailed instructions for creating sprite assets for units and buildings in the game.

## 📁 File Structure

```
assets/
└── sprites/
    ├── units/
    │   ├── rifleman.png
    │   ├── rifleman_sheet.png
    │   ├── light_tank.png
    │   └── ...
    └── buildings/
        ├── power_plant.png
        ├── gun_turret_base.png
        ├── gun_turret_turret.png
        └── ...
```

## 🎨 Unit Sprites

### Dimensions

- **Infantry**: 32x32 pixels
- **Vehicles (Small)**: 32x32 or 48x48 pixels
- **Vehicles (Medium)**: 48x48 pixels
- **Vehicles (Large/Tanks)**: 64x64 pixels
- **Air Units**: 32x32 or 48x48 pixels
- **Naval Units**: 48x48 or 64x64 pixels

### Orientation

- Sprites should face **right** by default (0° rotation)
- The game will automatically rotate sprites based on unit movement/angle
- For pixel art style, you can create 8-direction sprites (optional)

### Color Requirements

- Use **neutral colors** for the base sprite
- Avoid pure white (#FFFFFF) or pure black (#000000) - these don't tint well
- Player colors are applied via tinting, so keep base colors muted
- Recommended base palette: grays, browns, muted blues/greens

### Animation Requirements

#### Single Sprite (No Animation)
- One static image
- Used for simple units or when animations aren't needed

#### Sprite Sheet (With Animation)
- Grid-based layout
- Frame dimensions must be consistent
- Recommended frame counts:
  - **Idle**: 1-2 frames (optional loop)
  - **Moving**: 3-6 frames (walk/run cycle)
  - **Attacking**: 2-4 frames (attack animation)
  - **Dying**: 3-5 frames (death animation, one-shot, no loop)

#### Sprite Sheet Layout Example

```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│  0  │  1  │  2  │  3  │  4  │  5  │  6  │  7  │  Row 0
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  8  │  9  │ 10  │ 11  │ 12  │ 13  │ 14  │ 15  │  Row 1
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘

Row 0: Idle (frame 0), Moving (frames 1-3), Attacking (frames 4-6), Dying (frame 7)
Row 1: Additional frames or alternate angles
```

**Configuration Example:**
```javascript
sheet: {
    path: 'assets/sprites/units/rifleman_sheet.png',
    type: 'grid',
    frameWidth: 32,
    frameHeight: 32,
    frames: {
        idle: { x: 0, y: 0, count: 1 },
        moving: { x: 1, y: 0, count: 3 },
        attacking: { x: 4, y: 0, count: 3 },
        dying: { x: 7, y: 0, count: 4 }
    }
}
```

### Naming Conventions

- Use lowercase with underscores: `rifleman.png`, `light_tank.png`
- Sprite sheets: `unit_name_sheet.png`
- Match the unit type name from `constants.js` when possible

## 🏗️ Building Sprites

### Dimensions

- **Small Buildings (1x1 tiles)**: 64x64 pixels
- **Medium Buildings (2x2 tiles)**: 96x96 or 128x128 pixels
- **Large Buildings (3x3+ tiles)**: 128x128 or 192x192 pixels
- **Turrets**: Base 64x64, Turret 32x32 or 48x48

### Orientation

- Most buildings face **up** (no rotation)
- Turrets have separate sprites that rotate independently
- Construction frames show building progress

### Color Requirements

- Same as units: neutral colors, avoid pure white/black
- Player color tinting applied automatically

### Special Cases

#### Turrets (Gun Turret, AA Turret)

Turrets require **two separate sprites**:

1. **Base Sprite** (`gun_turret_base.png`):
   - Static foundation/platform
   - Does not rotate
   - 64x64 pixels

2. **Turret Sprite** (`gun_turret_turret.png`):
   - Rotating weapon/turret
   - Rotates to face target
   - 32x32 or 48x48 pixels
   - Should be centered on rotation pivot

**Configuration Example:**
```javascript
sprite: {
    path: 'assets/sprites/buildings/gun_turret_base.png',
    size: { width: 64, height: 64 },
    turret: {
        path: 'assets/sprites/buildings/gun_turret_turret.png',
        pivot: { x: 32, y: 32 }, // Center of base
        size: { width: 32, height: 32 }
    }
}
```

#### Construction Animation

Buildings can have construction progress frames:

**Configuration Example:**
```javascript
sprite: {
    path: 'assets/sprites/buildings/power_plant.png',
    construction: {
        frames: 4, // Number of construction stages
        speed: 0.5 // Frame duration in seconds
    }
}
```

**Sprite Sheet Layout for Construction:**
```
┌─────┬─────┬─────┬─────┐
│  0  │  1  │  2  │  3  │  Construction frames (0% → 100%)
└─────┴─────┴─────┴─────┘
```

Frame 0: Foundation (0-25%)
Frame 1: Structure (25-50%)
Frame 2: Nearly Complete (50-75%)
Frame 3: Complete (75-100%)

### Naming Conventions

- Use lowercase with underscores: `power_plant.png`, `gun_turret_base.png`
- Match building type name from `constants.js`

## 🎨 Technical Specifications

### File Format

- **Format**: PNG (with transparency)
- **Color Mode**: RGBA (supports transparency)
- **Compression**: Use lossless compression
- **Optimization**: Consider using tools like `pngquant` or `optipng` to reduce file size

### Transparency

- Use transparent backgrounds (alpha channel)
- Avoid anti-aliasing on transparent edges unless necessary
- For pixel art, use 1-pixel transparency borders

### Export Settings

**Recommended Settings:**
- Bit depth: 32-bit (RGBA)
- Interlacing: None
- Compression: Maximum (lossless)

## 🎨 Player Color Tinting

The game applies player colors via tinting. To ensure good results:

1. **Avoid Pure Colors**: Don't use pure white/black in sprites
2. **Muted Base Colors**: Use desaturated colors as base
3. **Test Tinting**: Check how your sprite looks with different player colors:
   - Green (#00ff00)
   - Red (#ff0000)
   - Blue (#0000ff)
   - Yellow (#ffff00)

### Tinting Methods

The game supports multiple tinting methods (configured in sprite config):

- **multiply**: Darkens sprite, good for darker player colors
- **overlay**: Preserves highlights/shadows, balanced
- **color**: Replaces color while preserving luminance
- **screen**: Lightens sprite, good for lighter player colors

**Recommended**: `multiply` with intensity 0.3-0.4

## 📐 Sprite Sheet Best Practices

### Organization

1. **Group Related Frames**: Keep animation frames for same state together
2. **Consistent Spacing**: Use consistent frame sizes
3. **Power of 2**: Frame dimensions should be powers of 2 (16, 32, 64) for best performance
4. **Padding**: Add 1-2 pixel padding between frames to avoid bleeding

### Grid Layout

```
┌─────────────────────────────────────┐
│ Frame 0 │ Frame 1 │ Frame 2 │ ...  │  Row 0: Idle
├─────────────────────────────────────┤
│ Frame 4 │ Frame 5 │ Frame 6 │ ...  │  Row 1: Moving
├─────────────────────────────────────┤
│ Frame 8 │ Frame 9 │ Frame 10│ ... │  Row 2: Attacking
└─────────────────────────────────────┘
```

### Frame Naming in Config

Frames are referenced by state name and index:
- `idle` or `idle_0` (for single-frame idle)
- `moving_0`, `moving_1`, `moving_2` (for multi-frame moving)
- `attacking_0`, `attacking_1` (for multi-frame attacking)

## ✅ Quality Checklist

Before submitting sprites, verify:

- [ ] Correct dimensions (power of 2 recommended)
- [ ] Transparent background (no white/colored background)
- [ ] Neutral base colors (no pure white/black)
- [ ] Consistent style across all sprites
- [ ] Proper file naming (lowercase, underscores)
- [ ] Sprite sheets have consistent frame sizes
- [ ] Animation frames are properly aligned
- [ ] Turrets have separate base and turret sprites
- [ ] Construction frames show clear progress
- [ ] File size is reasonable (< 500KB per sprite, < 2MB per sheet)

## 🚀 Performance Tips

1. **Optimize File Size**: Use compression tools to reduce file size
2. **Reuse Assets**: Use sprite sheets instead of individual files when possible
3. **Limit Colors**: Reduce color palette for smaller file sizes
4. **Power of 2**: Use dimensions that are powers of 2 (16, 32, 64, 128)
5. **Batch Similar Units**: Group similar units in same sprite sheet

## 📝 Example Configurations

### Simple Unit (No Animation)
```javascript
sprite: {
    path: 'assets/sprites/units/rifleman.png',
    size: { width: 32, height: 32 },
    rotation: { enabled: true, useAngle: false },
    tinting: { enabled: true, method: 'multiply', intensity: 0.4 }
}
```

### Animated Unit (Sprite Sheet)
```javascript
sprite: {
    sheet: {
        path: 'assets/sprites/units/rifleman_sheet.png',
        type: 'grid',
        frameWidth: 32,
        frameHeight: 32,
        frames: {
            idle: { x: 0, y: 0, count: 1 },
            moving: { x: 1, y: 0, count: 3 },
            attacking: { x: 4, y: 0, count: 3 }
        }
    },
    rotation: { enabled: true },
    tinting: { enabled: true, method: 'multiply', intensity: 0.4 },
    animation: {
        idleSpeed: 0.2,
        movingSpeed: 0.15,
        attackingSpeed: 0.1
    }
}
```

### Building with Turret
```javascript
sprite: {
    path: 'assets/sprites/buildings/gun_turret_base.png',
    size: { width: 64, height: 64 },
    tinting: { enabled: true, method: 'multiply', intensity: 0.3 },
    turret: {
        path: 'assets/sprites/buildings/gun_turret_turret.png',
        pivot: { x: 32, y: 32 },
        size: { width: 32, height: 32 }
    }
}
```

## 🆘 Troubleshooting

### Sprite Not Appearing
- Check file path is correct
- Verify file exists in `assets/sprites/` directory
- Check browser console for loading errors

### Tinting Not Working
- Ensure `tinting.enabled: true` in config
- Check base sprite doesn't use pure white/black
- Try different tinting methods (`multiply`, `overlay`, `color`)

### Animation Not Playing
- Verify sprite sheet config is correct
- Check frame names match animation states
- Ensure `animation` speeds are configured

### Turret Not Rotating
- Verify `turret` config exists in building sprite config
- Check `pivot` point is correct (usually center)
- Ensure building has `targetEnemy` when attacking

## 📞 Support

For questions or issues:
1. Check this guide first
2. Review `CUSTOM_SPRITES.MD` for technical details
3. Check code comments in `js/spritemanager.js` and `js/spriterenderer.js`
4. Test with fallback rendering to verify game logic works

---

**Last Updated:** 2024-12-XX  
**Version:** 1.0
