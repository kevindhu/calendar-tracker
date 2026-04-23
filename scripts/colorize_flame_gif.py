from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageSequence

INPUT_PATH = Path("public/cute_flame3.gif")
OUTPUTS = {
    "blue": {
        "path": Path("public/cute_flame3_blue.gif"),
        "hls": colorsys.rgb_to_hls(46 / 255, 170 / 255, 255 / 255),
    },
    "purple": {
        "path": Path("public/cute_flame3_purple.gif"),
        "hls": colorsys.rgb_to_hls(188 / 255, 74 / 255, 255 / 255),
    },
}

SATURATION = 0.9
CONTRAST = 1.12


def colorize_grayscale(gray_img: Image.Image, hue: float) -> Image.Image:
    pixels = gray_img.load()
    width, height = gray_img.size

    result = Image.new("RGB", (width, height))
    result_pixels = result.load()

    for y in range(height):
        for x in range(width):
            lightness = pixels[x, y] / 255.0
            r, g, b = colorsys.hls_to_rgb(hue, lightness, SATURATION)
            result_pixels[x, y] = (int(r * 255), int(g * 255), int(b * 255))

    return result


def colorize_frame(frame: Image.Image, hue: float) -> Image.Image:
    rgba = frame.convert("RGBA")
    alpha = rgba.getchannel("A")
    gray = rgba.convert("RGB").convert("L")
    result = colorize_grayscale(gray, hue)
    result = ImageEnhance.Contrast(result).enhance(CONTRAST)
    result.putalpha(alpha)
    return result


def convert_rgba_to_gif_frame(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    alpha = rgba.getchannel("A")
    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(rgba.convert("RGB"), mask=alpha)

    paletted = rgb.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    palette = paletted.getpalette()
    if palette is None:
        palette = []

    palette = palette[:768] + [0] * (768 - len(palette[:768]))
    transparent_index = 255
    palette[transparent_index * 3 : transparent_index * 3 + 3] = [0, 0, 0]
    paletted.putpalette(palette)

    pixel_indexes = bytearray(paletted.tobytes())
    alpha_values = alpha.tobytes()
    for index, alpha_value in enumerate(alpha_values):
        if alpha_value == 0:
            pixel_indexes[index] = transparent_index

    paletted.frombytes(bytes(pixel_indexes))
    paletted.info["transparency"] = transparent_index
    return paletted


def main() -> None:
    source = Image.open(INPUT_PATH)
    durations = [frame.info.get("duration", source.info.get("duration", 100)) for frame in ImageSequence.Iterator(source)]

    for name, config in OUTPUTS.items():
        hue = config["hls"][0]
        output_path = config["path"]
        frames = []

        for frame in ImageSequence.Iterator(source):
            colorized = colorize_frame(frame, hue)
            frames.append(convert_rgba_to_gif_frame(colorized))

        frames[0].save(
            output_path,
            format="GIF",
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=source.info.get("loop", 0),
            disposal=2,
            transparency=255,
            optimize=True,
        )
        print(f"[OK] Saved {name}: {output_path}")


if __name__ == "__main__":
    main()
