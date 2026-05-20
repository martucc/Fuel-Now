import os
import shutil
from PIL import Image

pwa_public_dir = r"C:\Users\2005n\martucc-fuel\public"
apk_public_dir = r"C:\Users\2005n\martucc-fuel-apk\public"
apk_res_dir = r"C:\Users\2005n\martucc-fuel-apk\android\app\src\main\res"

print("--- Restoring original PWA web icons to APK project ---")
files_to_copy = [
    "favicon.png",
    "favicon.svg",
    "icon-192.png",
    "icon-512.png",
    "icon-192x192.png",
    "icon-512x512.png",
    "icon-maskable.png",
    "icon.svg",
    "icons.svg"
]

for filename in files_to_copy:
    src_file = os.path.join(pwa_public_dir, filename)
    dest_file = os.path.join(apk_public_dir, filename)
    if os.path.exists(src_file):
        shutil.copy2(src_file, dest_file)
        print(f"Copied: {filename} from PWA to APK public directory")
    else:
        print(f"Warning: {filename} not found in PWA public directory")

source_logo = os.path.join(pwa_public_dir, "icon-512.png")
if not os.path.exists(source_logo):
    source_logo = os.path.join(pwa_public_dir, "icon-maskable.png")

if not os.path.exists(source_logo):
    print("Error: Source PWA logo not found!")
    exit(1)

print(f"\nUsing source PWA logo for Android launcher: {source_logo}")

# Standard and Round launcher configurations
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
        folder_path = os.path.join(apk_res_dir, folder)
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

# Adaptive foreground configurations (foreground centered inside canvas)
foreground_configs = [
    ("mipmap-mdpi", 108, 76),
    ("mipmap-hdpi", 162, 114),
    ("mipmap-xhdpi", 216, 152),
    ("mipmap-xxhdpi", 324, 228),
    ("mipmap-xxxhdpi", 432, 304),
]

print("\n--- Generating Android Launcher Icons (Adaptive Foreground) ---")
with Image.open(source_logo) as img:
    img = img.convert("RGBA")
    for folder, canvas_size, logo_size in foreground_configs:
        folder_path = os.path.join(apk_res_dir, folder)
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

print("\nAll launcher and web icons updated to original PWA logo successfully!")
