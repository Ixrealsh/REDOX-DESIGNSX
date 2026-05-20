import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getDbCollections, saveDbCollection } from '@/lib/catalog-db';
import { requireAdminSession } from '@/lib/admin-auth';
import type { Collection } from '@/types/product';

export async function GET() {
  const authError = requireAdminSession();
  if (authError) return authError;

  try {
    const collections = await getDbCollections();
    return NextResponse.json({ success: true, collections });
  } catch (error: any) {
    console.error('API collections GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch collections.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = requireAdminSession();
  if (authError) return authError;

  if (!isDbConfigured) {
    return NextResponse.json(
      { error: 'Database is not configured yet. Set DATABASE_URL in your .env file.' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    if (!body.slug || !body.name || !body.tagline || !body.description || !body.image) {
      return NextResponse.json(
        { error: 'Missing required collection fields (slug, name, tagline, description, image).' },
        { status: 400 }
      );
    }

    const collection: Collection = {
      slug: String(body.slug),
      name: String(body.name),
      tagline: String(body.tagline),
      description: String(body.description),
      image: String(body.image),
      productSlugs: Array.isArray(body.productSlugs) ? body.productSlugs : []
    };

    const success = await saveDbCollection(collection);
    if (!success) {
      throw new Error('Database insert operation failed');
    }

    return NextResponse.json({
      success: true,
      message: 'Collection saved successfully to Neon DB!',
      collection
    });
  } catch (error: any) {
    console.error('API collections POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save collection.' },
      { status: 500 }
    );
  }
}
