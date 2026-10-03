import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Render the upgraded RD monogram with room for Android's maskable crop. */
export async function renderPwaIcon(size: number) {
  const logo = await readFile(join(process.cwd(), 'public', 'assets', 'icons', 'redoxlogo.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: '#080808'
      }}
    >
      <div style={{ display: 'flex', position: 'relative', width: size, height: size * 0.57, overflow: 'hidden' }}>
        {/* The transparent source also contains a wordmark. The clipped region is the RD mark only. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="REDOXDESIGNX"
          height={size * 1.5 * 473 / 757}
          src={logoSrc}
          style={{ position: 'absolute', top: 0, left: -size * 0.25 }}
          width={size * 1.5}
        />
      </div>
    </div>,
    { width: size, height: size }
  );
}
