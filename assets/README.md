# Assets do Cobblemon Launcher

Coloque aqui os seguintes arquivos:

- `icon.png`   — Logo do servidor (512x512, PNG)
- `icon.ico`   — Ícone para Windows (gerado com https://convertio.co/)
- `icon.icns`  — Ícone para macOS
- `icon-small.png` — Ícone pequeno para a titlebar (32x32)
- `bg.png`     — Imagem de fundo do launcher (900x514 recomendado)

## Como gerar icon.ico e icon.icns a partir do icon.png

Use o site: https://convertio.co/png-ico/

Ou via terminal:
```bash
# Windows (com ImageMagick)
magick icon.png -resize 256x256 icon.ico

# macOS
iconutil -c icns icon.iconset
```
