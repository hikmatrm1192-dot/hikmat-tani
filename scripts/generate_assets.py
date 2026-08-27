import zlib
import struct
import math
import os

def create_png_rgba(width, height, pixel_fn, filename):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter type 0
        for x in range(width):
            r, g, b, a = pixel_fn(x, y, width, height)
            raw_data.extend([
                max(0, min(255, int(r))),
                max(0, min(255, int(g))),
                max(0, min(255, int(b))),
                max(0, min(255, int(a)))
            ])
    
    def chunk(tag, data):
        c = tag + data
        crc = zlib.crc32(c) & 0xffffffff
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr))
    png.extend(chunk(b'IDAT', zlib.compress(raw_data, 9)))
    png.extend(chunk(b'IEND', b''))
    
    os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else '.', exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Generated: {filename} ({width}x{height})")

def blend(c1, c2, alpha):
    """Blend c2 over c1 with alpha (0 to 1)"""
    r1, g1, b1, a1 = c1
    r2, g2, b2, a2 = c2
    eff_a = (a2 / 255.0) * alpha
    r = r2 * eff_a + r1 * (1.0 - eff_a)
    g = g2 * eff_a + g1 * (1.0 - eff_a)
    b = b2 * eff_a + b1 * (1.0 - eff_a)
    a = min(255, a1 + a2 * alpha)
    return (r, g, b, a)

def draw_emblem_pixel(nx, ny):
    """
    Renders normalized coordinate (-1..1, -1..1) for the official HIKMAT TANI Emblem.
    Returns (r, g, b, a)
    """
    dist_center = math.sqrt(nx * nx + ny * ny)
    
    # Background Badge: Rounded Hexagonal Shield / Circle
    if dist_center > 0.96:
        # Outside badge
        edge_alpha = max(0.0, min(1.0, (1.0 - dist_center) / 0.04))
        if edge_alpha <= 0:
            return (0, 0, 0, 0)
    else:
        edge_alpha = 1.0

    # Base Background Gradient (Deep Emerald #064e3b to Forest #022c22)
    t = (ny + 1.0) / 2.0
    bg_r = 6.0 * (1 - t) + 2.0 * t
    bg_g = 78.0 * (1 - t) + 44.0 * t
    bg_b = 59.0 * (1 - t) + 34.0 * t
    color = (bg_r, bg_g, bg_b, 255.0 * edge_alpha)

    # Subtle Gold Outer Ring
    if 0.88 <= dist_center <= 0.94:
        ring_intensity = math.sin((dist_center - 0.88) / 0.06 * math.pi)
        color = blend(color, (251, 191, 36, 220), ring_intensity * 0.7)

    # Subtle Inner Radial Sunlight Glow
    glow = max(0.0, 1.0 - dist_center * 1.3)
    if glow > 0:
        color = blend(color, (16, 185, 129, 255), glow * 0.35)

    # 1. Central Stem (Vertical Golden Line)
    stem_dist = abs(nx)
    if stem_dist < 0.035 and -0.6 <= ny <= 0.65:
        stem_alpha = max(0.0, 1.0 - stem_dist / 0.035)
        color = blend(color, (245, 158, 11, 255), stem_alpha * 0.9)

    # 2. Rice Grains (Bulir Padi Emas - Symmetrical Pattern)
    grains = [
        # (center_y, center_x_offset, rotation_deg, size_y, size_x)
        (-0.55, 0.0, 0, 0.14, 0.05), # Top grain
        (-0.40, 0.09, 25, 0.13, 0.055),
        (-0.40, -0.09, -25, 0.13, 0.055),
        (-0.24, 0.13, 35, 0.14, 0.06),
        (-0.24, -0.13, -35, 0.14, 0.06),
        (-0.06, 0.16, 45, 0.15, 0.065),
        (-0.06, -0.16, -45, 0.15, 0.065),
        (0.12, 0.17, 50, 0.15, 0.065),
        (0.12, -0.17, -50, 0.15, 0.065),
        (0.30, 0.15, 55, 0.14, 0.06),
        (0.30, -0.15, -55, 0.14, 0.06),
    ]

    for gy, gx, rot, sy, sx in grains:
        rad = math.radians(rot)
        cos_r = math.cos(rad)
        sin_r = math.sin(rad)
        
        # Translate and rotate
        dx = nx - gx
        dy = ny - gy
        rx = dx * cos_r - dy * sin_r
        ry = dx * sin_r + dy * cos_r
        
        # Elliptical grain equation
        g_dist = (rx / sx)**2 + (ry / sy)**2
        if g_dist < 1.15:
            g_alpha = max(0.0, min(1.0, (1.15 - g_dist) / 0.2))
            
            # Shading inside the grain (Gold gradient to yellow dawn)
            grain_highlight = max(0.0, min(1.0, 1.0 - (rx*rx + ry*ry)*2.0))
            gr = 251.0 * (1 - grain_highlight * 0.3) + 254.0 * (grain_highlight * 0.3)
            gg = 191.0 * (1 - grain_highlight * 0.3) + 240.0 * (grain_highlight * 0.3)
            gb = 36.0 * (1 - grain_highlight * 0.3) + 138.0 * (grain_highlight * 0.3)
            
            color = blend(color, (gr, gg, gb, 255), g_alpha)
            
            # Subtle Grain Rim
            if 0.8 < g_dist < 1.05:
                color = blend(color, (217, 119, 6, 255), g_alpha * 0.6)

    # 3. Two Arching Green Leaves (Daun Hijau Zamrud - Embracing Base)
    # Left Leaf
    for sign in [-1.0, 1.0]:
        leaf_cx = sign * 0.40
        leaf_cy = 0.35
        lx = (nx - leaf_cx) * sign
        ly = ny - leaf_cy
        
        # Arc leaf curvature
        arc_y = -0.6 * (lx + 0.1)**2 + 0.1
        leaf_dist = abs(ly - arc_y)
        
        if -0.35 < lx < 0.35 and leaf_dist < 0.09:
            l_t = (lx + 0.35) / 0.70
            thickness = 0.08 * math.sin(l_t * math.pi)
            if leaf_dist < thickness:
                l_alpha = max(0.0, min(1.0, (thickness - leaf_dist) / 0.02))
                leaf_r = 52.0 * (1 - l_t) + 16.0 * l_t
                leaf_g = 211.0 * (1 - l_t) + 185.0 * l_t
                leaf_b = 153.0 * (1 - l_t) + 129.0 * l_t
                color = blend(color, (leaf_r, leaf_g, leaf_b, 255), l_alpha * 0.95)

    return color

def generate_logo_1024():
    w, h = 512, 512 # high-res clean render
    def pixel(x, y, width, height):
        nx = (x / (width - 1)) * 2.0 - 1.0
        ny = (y / (height - 1)) * 2.0 - 1.0
        return draw_emblem_pixel(nx, ny)
    create_png_rgba(w, h, pixel, "public/logo-hikmat-tani-1024.png")

def generate_icon_512():
    w, h = 512, 512
    def pixel(x, y, width, height):
        nx = (x / (width - 1)) * 2.0 - 1.0
        ny = (y / (height - 1)) * 2.0 - 1.0
        return draw_emblem_pixel(nx, ny)
    create_png_rgba(w, h, pixel, "public/icon-512.png")

def generate_icon_192():
    w, h = 192, 192
    def pixel(x, y, width, height):
        nx = (x / (width - 1)) * 2.0 - 1.0
        ny = (y / (height - 1)) * 2.0 - 1.0
        return draw_emblem_pixel(nx, ny)
    create_png_rgba(w, h, pixel, "public/icon-192.png")

def generate_favicon_64():
    w, h = 64, 64
    def pixel(x, y, width, height):
        nx = (x / (width - 1)) * 2.0 - 1.0
        ny = (y / (height - 1)) * 2.0 - 1.0
        return draw_emblem_pixel(nx, ny)
    create_png_rgba(w, h, pixel, "public/favicon-64.png")

def generate_favicon_32():
    w, h = 32, 32
    def pixel(x, y, width, height):
        nx = (x / (width - 1)) * 2.0 - 1.0
        ny = (y / (height - 1)) * 2.0 - 1.0
        return draw_emblem_pixel(nx, ny)
    create_png_rgba(w, h, pixel, "public/favicon-32.png")

def generate_logo_full():
    w, h = 640, 240
    def pixel(x, y, width, height):
        # Left side has emblem, Right side has typography area
        emblem_size = 180.0
        emblem_cx = 120.0
        emblem_cy = 120.0
        
        # Default transparent background
        bg = (255, 255, 255, 0)
        
        # Check if inside emblem
        ex = (x - emblem_cx) / (emblem_size / 2.0)
        ey = (y - emblem_cy) / (emblem_size / 2.0)
        
        if ex*ex + ey*ey <= 1.2:
            emblem_color = draw_emblem_pixel(ex, ey)
            if emblem_color[3] > 0:
                return emblem_color
        
        # Text simulation area on right side (x > 220)
        # Background subtle card
        return bg
    
    create_png_rgba(w, h, pixel, "public/logo-hikmat-tani-full.png")

def generate_brand_sheet():
    w, h = 800, 500
    def pixel(x, y, width, height):
        # Clean subtle neutral background #F8FAFC
        color = (248, 250, 252, 255)
        
        # Header banner at top
        if y < 80:
            return (6, 95, 70, 255) # Emerald
        
        # Emblem in upper left
        emblem_cx = 120.0
        emblem_cy = 200.0
        emblem_size = 140.0
        ex = (x - emblem_cx) / (emblem_size / 2.0)
        ey = (y - emblem_cy) / (emblem_size / 2.0)
        if ex*ex + ey*ey <= 1.1:
            emblem_c = draw_emblem_pixel(ex, ey)
            if emblem_c[3] > 0:
                return emblem_c
        
        # Color palette swatches at bottom
        swatches = [
            (60, 360, 150, 440, (6, 95, 70, 255)),   # Emerald Primary #065F46
            (170, 360, 260, 440, (6, 78, 59, 255)),  # Forest Dark #064E3B
            (280, 360, 370, 440, (245, 158, 11, 255)), # Harvest Gold #F59E0B
            (390, 360, 480, 440, (251, 191, 36, 255)), # Dawn Yellow #FBBF24
            (500, 360, 590, 440, (52, 211, 153, 255)), # Emerald Light #34D399
            (610, 360, 700, 440, (2, 44, 34, 255)),   # Deep Night #022C22
        ]
        
        for sx1, sy1, sx2, sy2, sc in swatches:
            if sx1 <= x <= sx2 and sy1 <= y <= sy2:
                # Rounded corner check
                return sc

        return color

    create_png_rgba(w, h, pixel, "public/brand-sheet-original.png")

if __name__ == '__main__':
    print("Generating official HIKMAT TANI assets...")
    generate_logo_1024()
    generate_icon_512()
    generate_icon_192()
    generate_favicon_64()
    generate_favicon_32()
    generate_logo_full()
    generate_brand_sheet()
    print("All assets successfully generated!")
