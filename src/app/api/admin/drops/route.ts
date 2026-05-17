import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getDbDrops, saveDbDrop } from '@/lib/catalog-db';
import type { Drop } from '@/types/product';

export async function GET() {
  try {
    const drops = await getDbDrops();
    return NextResponse.json({ success: true, drops });
  } catch (error: any) {
    console.error('API drops GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch drops.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured) {
    return NextResponse.json(
      { error: 'Database is not configured yet. Set DATABASE_URL in your .env file.' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    // Basic structural validation
    if (!body.slug || !body.name || !body.releaseDate || !body.image) {
      return NextResponse.json(
        { error: 'Missing required drop fields (slug, name, releaseDate, image).' },
        { status: 400 }
      );
    }

    const drop: Drop = {
      slug: String(body.slug),
      name: String(body.name),
      status: body.status || 'upcoming',
      releaseDate: String(body.releaseDate),
      itemCount: body.itemCount ? Number(body.itemCount) : 0,
      summary: String(body.summary || ''),
      image: String(body.image)
    };

    const success = await saveDbDrop(drop);
    if (!success) {
      throw new Error('Database insert operation failed');
    }

    return NextResponse.json({
      success: true,
      message: 'Drop saved successfully to Neon DB!',
      drop
    });
  } catch (error: any) {
    console.error('API drops POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save drop.' },
      { status: 500 }
    );
  }
}
