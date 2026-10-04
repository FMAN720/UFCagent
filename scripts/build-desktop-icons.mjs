import fs from 'node:fs/promises';
import sharp from 'sharp';

const directory = new URL('../assets/desktop/', import.meta.url);
const original = await fs.readFile(new URL('ufc-original.svg', directory), 'utf8');
// Preserve the official vector contours and aspect ratio; only change the fill.
const paths = [...original.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m => m[1]);
if (paths.length !== 4 || paths.some(d => !/^[\d\s.,A-Za-z+-]+$/.test(d))) throw Error('Unexpected UFC source SVG');
const sizes = [16, 24, 32, 48, 64, 128, 256];
const previews = [];
for (const [name, color] of [['white', '#ffffff'], ['red', '#d20a0a']]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><svg x="8" y="86.45" width="240" height="83.1" viewBox="0 0 1675 580">${paths.map(d => `<path fill="${color}" d="${d}"/>`).join('')}</svg></svg>`;
  await fs.writeFile(new URL(`ufc-${name}.svg`, directory), svg);
  const images = await Promise.all(sizes.map(size => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  for (let i = 0; i < sizes.length; i++) {
    const pos = 6 + i * 16;
    header[pos] = sizes[i] === 256 ? 0 : sizes[i]; header[pos + 1] = header[pos];
    header.writeUInt16LE(1, pos + 4); header.writeUInt16LE(32, pos + 6);
    header.writeUInt32LE(images[i].length, pos + 8); header.writeUInt32LE(offset, pos + 12);
    offset += images[i].length;
  }
  await fs.writeFile(new URL(`ufc-${name}.ico`, directory), Buffer.concat([header, ...images]));
  await fs.writeFile(new URL(`ufc-${name}.png`, directory), images.at(-1));
  previews.push({ input: images.at(-1), left: name === 'white' ? 0 : 256, top: 0 });
  console.log(`ufc-${name}.ico: ${sizes.join(', ')} px`);
}
await fs.mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../artifacts/ufc-icons-preview.png', import.meta.url), await sharp({ create: { width: 512, height: 256, channels: 4, background: '#1b1d22' } }).composite(previews).png().toBuffer());
