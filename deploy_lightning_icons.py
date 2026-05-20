from PIL import Image
import os

source_logo = r"C:\Users\2005n\martucc-fuel-apk\logo_black_white_lightning.png"
source_fg = r"C:\Users\2005n\martucc-fuel-apk\logo_fg_white_lightning.png"
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
with Image.open(source_logo) as img:
    img = img.convert("RGBA")
    for relative_path, size in web_icons:
        target_path = os.path.join(apk_dir, relative_path)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(target_path, "PNG")
        print(f"Saved: {relative_path} ({size}x{size})")

# 2. Resize and save Android mipmap icons (standard and round)
android_res_dir = os.path.join(apk_dir, "android", "app", "src", "main", "res")
launcher_configs = [
    ("mipmap-mdpi", 48),
    ("mipmap-hdpi", 72),
    ("mipmap-xhdpi", 96),
    ("mipmap-xxhdpi", 144),
    ("mipmap-xxxhdpi", 192),
]

print("\n--- Generating Android Launcher Icons (Standard & Round) ---")
with Image.open(source_logo) as img:
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
        
        # Save round
        round_path = os.path.join(folder_path, "ic_launcher_round.png")
        resized_standard.save(round_path, "PNG")
        print(f"Saved: {folder}/ic_launcher_round.png ({size}x{size})")

# 3. Resize and save Android adaptive foreground icons
# Direct resize of the pre-padded logo_fg_white_lightning.png to canvas size
foreground_configs = [
    ("mipmap-mdpi", 108),
    ("mipmap-hdpi", 162),
    ("mipmap-xhdpi", 216),
    ("mipmap-xxhdpi", 324),
    ("mipmap-xxxhdpi", 432),
]

print("\n--- Generating Android Launcher Icons (Adaptive Foreground) ---")
with Image.open(source_fg) as img:
    img = img.convert("RGBA")
    for folder, canvas_size in foreground_configs:
        folder_path = os.path.join(android_res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        resized_fg = img.resize((canvas_size, canvas_size), Image.Resampling.LANCZOS)
        foreground_path = os.path.join(folder_path, "ic_launcher_foreground.png")
        resized_fg.save(foreground_path, "PNG")
        print(f"Saved: {folder}/ic_launcher_foreground.png ({canvas_size}x{canvas_size})")

print("\nAll launcher and web icons updated to Black + White Lightning successfully!")
