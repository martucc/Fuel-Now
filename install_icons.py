from PIL import Image
import shutil
import os

source = r'C:\Users\2005n\AppData\Local\Temp\app-logo.png'
dest_512 = r'c:\Users\2005n\martucc-fuel\public\icon-512.png'
dest_192 = r'c:\Users\2005n\martucc-fuel\public\icon-192.png'
dest_fav = r'c:\Users\2005n\martucc-fuel\public\favicon.png'

# 1. Copy 512x512
shutil.copy(source, dest_512)
print("Saved icon-512.png")

# 2. Resize and save others
try:
    with Image.open(source) as img:
        img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
        img_192.save(dest_192)
        print("Saved icon-192.png")
        
        img_fav = img.resize((64, 64), Image.Resampling.LANCZOS)
        img_fav.save(dest_fav)
        print("Saved favicon.png")
except Exception as e:
    print(f"Error resizing: {e}")
