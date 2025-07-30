# 24RC
ATC **24** **R**adar **C**lient. Losely based on **CRC** and **STARS**.
## Assets
All SVG files for maps and overlays should have 0,0 in game mapped to 0,0 in the SVG file. The
scale is 1px in the SVG file is 100 studs in game. This massively simplifies the addition of layers
in the code, for we don't have to worry about offsetting or scaling different layers from the
basemap. The resulting SVG files will have content outside the viewport, but this is unimportant as
the only context we care about these SVGs being rendered in is here.
