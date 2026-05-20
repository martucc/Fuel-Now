from PIL import Image, ImageDraw
import os

def create_lightning_images():
    canvas_size = 512
    # Create the standard square icon (black background, white lightning bolt)
    standard_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 255))
    draw_std = ImageDraw.Draw(standard_img)
    
    # Original SVG points of the lightning bolt
    points = [
        (25.95, 44.94),
        (23.93, 33.94),
        (21.66, 31.68),
        (10.29, 31.68),
        (17.77, 21.21),
        (15.93, 17.63),
        (1.24, 17.63),
        (10.01, 0.47),
        (38.91, 0.47),
        (31.43, 10.94),
        (33.27, 14.52),
        (44.65, 14.52),
    ]
    
    # Bounding box of the lightning bolt
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    
    w = max_x - min_x
    h = max_y - min_y
    
    # Target size of the bolt in the 512x512 canvas (approx 340px height)
    target_h = 340.0
    scale = target_h / h
    target_w = w * scale
    
    # Translate and scale to center
    offset_x = (canvas_size - target_w) / 2.0
    offset_y = (canvas_size - target_h) / 2.0
    
    scaled_points = []
    for x, y in points:
        sx = offset_x + (x - min_x) * scale
        sy = offset_y + (y - min_y) * scale
        scaled_points.append((sx, sy))
        
    # Draw the white lightning bolt
    draw_std.polygon(scaled_points, fill=(255, 255, 255, 255))
    
    # Save standard PWA/Android image
    logo_path = r"C:\Users\2005n\martucc-fuel-apk\logo_black_white_lightning.png"
    standard_img.save(logo_path, "PNG")
    print(f"Generated logo at: {logo_path}")

    # Now let's generate the adaptive foreground icon (transparent background, white lightning bolt centered)
    # The adaptive foreground needs to fit in a 108dp canvas where the safe-zone logo is ~72dp.
    # In a 512x512 canvas, we scale it to ~300px to sit beautifully within safe bounds.
    foreground_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw_fg = ImageDraw.Draw(foreground_img)
    
    target_h_fg = 290.0
    scale_fg = target_h_fg / h
    target_w_fg = w * scale_fg
    
    offset_x_fg = (canvas_size - target_w_fg) / 2.0
    offset_y_fg = (canvas_size - target_h_fg) / 2.0
    
    scaled_points_fg = []
    for x, y in points:
        sx = offset_x_fg + (x - min_x) * scale_fg
        sy = offset_y_fg + (y - min_y) * scale_fg
        scaled_points_fg.append((sx, sy))
        
    draw_fg.polygon(scaled_points_fg, fill=(255, 255, 255, 255))
    fg_logo_path = r"C:\Users\2005n\martucc-fuel-apk\logo_fg_white_lightning.png"
    foreground_img.save(fg_logo_path, "PNG")
    print(f"Generated foreground logo at: {fg_logo_path}")

if __name__ == "__main__":
    create_lightning_images()
