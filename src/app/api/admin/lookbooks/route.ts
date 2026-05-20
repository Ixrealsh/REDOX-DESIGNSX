import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getDbLookbooks, saveDbLookbook } from '@/lib/catalog-db';
import { requireAdminSession } from '@/lib/admin-auth';
import type { LookbookIssue } from '@/types/product';

export async function GET() {
  const authError = requireAdminSession();
  if (authError) return authError;

  try {
    const lookbooks = await getDbLookbooks();
    return NextResponse.json({ success: true, lookbooks });
  } catch (error: any) {
    console.error('API lookbooks GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch lookbooks.' },
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

    if (!body.slug || !body.title || !body.season || !body.dek || !body.image) {
      return NextResponse.json(
        { error: 'Missing required lookbook fields (slug, title, season, dek, image).' },
        { status: 400 }
      );
    }

    const lookbook: LookbookIssue = {
      slug: String(body.slug),
      title: String(body.title),
      season: String(body.season),
      dek: String(body.dek),
      image: String(body.image),
      featuredProductSlugs: Array.isArray(body.featuredProductSlugs) ? body.featuredProductSlugs : []
    };

    const success = await saveDbLookbook(lookbook);
    if (!success) {
      throw new Error('Database insert operation failed');
    }

    return NextResponse.json({
      success: true,
      message: 'Lookbook saved successfully to Neon DB!',
      lookbook
    });
  } catch (error: any) {
    console.error('API lookbooks POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save lookbook.' },
      { status: 500 }
    );
  }
}
