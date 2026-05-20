from PIL import Image
import os

source = r"C:\Users\2005n\.gemini\antigravity\brain\675ff208-14e3-4d96-9720-acd1bdf54dfd\martucc_fuel_logo_1779233351600.png"
apk_dir = r"C:\Users\2005n\martucc-fuel-apk"

# 1. Resize and save PWA web icons
web_icons = [
    ("public/favicon.png", 64),
    ("public/icon-192.png", 192),
    ("public/icon-512.png", 512),
    ("public/icon-192x192.png", 192),
    ("public/icon-512x512.png", 512),
]

print("--- Generating PWA Icons ---")
with Image.open(source) as img:
    # Ensure source image is RGBA
    img = img.convert("RGBA")
    
    for relative_path, size in web_icons:
        target_path = os.path.join(apk_dir, relative_path)
        # Create folder if it doesn't exist
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(target_path, "PNG")
        print(f"Saved: {relative_path} ({size}x{size})")

# 2. Resize and save Android mipmap icons
android_res_dir = os.path.join(apk_dir, "android", "app", "src", "main", "res")

# Target mipmap folders and launcher sizes
launcher_configs = [
    ("mipmap-mdpi", 48),
    ("mipmap-hdpi", 72),
    ("mipmap-xhdpi", 96),
    ("mipmap-xxhdpi", 144),
    ("mipmap-xxxhdpi", 192),
]

print("\n--- Generating Android Launcher Icons (Standard & Round) ---")
with Image.open(source) as img:
    img = img.convert("RGBA")
    
    for folder, size in launcher_configs:
        folder_path = os.path.join(android_res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # Standard launcher icon
        resized_standard = img.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save standard
        standard_path = os.path.join(folder_path, "ic_launcher.png")
        resized_standard.save(standard_path, "PNG")
        print(f"Saved: {folder}/ic_launcher.png ({size}x{size})")
        
        # Save round (we can save the same premium square-rounded icon, or apply a circular mask)
        # Standard launcher has its own rounded mask on modern androids, but we will write it to round too.
        round_path = os.path.join(folder_path, "ic_launcher_round.png")
        resized_standard.save(round_path, "PNG")
        print(f"Saved: {folder}/ic_launcher_round.png ({size}x{size})")

# 3. Resize and save Android adaptive foreground icons (with safe zone padding)
# Foreground size = 108dp. Safe zone logo size ~ 72dp.
foreground_configs = [
    ("mipmap-mdpi", 108, 76),
    ("mipmap-hdpi", 162, 114),
    ("mipmap-xhdpi", 216, 152),
    ("mipmap-xxhdpi", 324, 228),
    ("mipmap-xxxhdpi", 432, 304),
]

print("\n--- Generating Android Launcher Icons (Adaptive Foreground with Margins) ---")
with Image.open(source) as img:
    img = img.convert("RGBA")
    
    for folder, canvas_size, logo_size in foreground_configs:
        folder_path = os.path.join(android_res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # Create a transparent background canvas
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        
        # Resize logo
        resized_logo = img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        
        # Paste centered
        offset = (canvas_size - logo_size) // 2
        canvas.paste(resized_logo, (offset, offset), resized_logo)
        
        # Save foreground
        foreground_path = os.path.join(folder_path, "ic_launcher_foreground.png")
        canvas.save(foreground_path, "PNG")
        print(f"Saved: {folder}/ic_launcher_foreground.png ({canvas_size}x{canvas_size}, logo centered at {logo_size}x{logo_size})")

print("\nAll launcher and web icons updated successfully!")
