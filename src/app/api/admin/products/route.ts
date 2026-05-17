import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getDbProducts, saveDbProduct } from '@/lib/catalog-db';
import type { Product } from '@/types/product';

export async function GET() {
  try {
    const products = await getDbProducts();
    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('API products GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products.' },
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
    if (!body.id || !body.slug || !body.name || !body.price || !body.image) {
      return NextResponse.json(
        { error: 'Missing required product fields (id, slug, name, price, image).' },
        { status: 400 }
      );
    }

    const product: Product = {
      id: String(body.id),
      slug: String(body.slug),
      name: String(body.name),
      collectionSlug: String(body.collectionSlug || 'chemical-uniform'),
      collectionName: String(body.collectionName || 'Chemical Uniform'),
      category: body.category || 'Tops',
      price: Number(body.price),
      compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : undefined,
      badge: body.badge || undefined,
      image: String(body.image),
      secondaryImage: String(body.secondaryImage || body.image),
      imageAlt: String(body.imageAlt || body.name),
      colors: Array.isArray(body.colors) ? body.colors : ['Obsidian Black'],
      colorHex: typeof body.colorHex === 'object' && body.colorHex ? body.colorHex : { 'Obsidian Black': '#090909' },
      variants: Array.isArray(body.variants) ? body.variants : [],
      description: String(body.description || ''),
      story: String(body.story || ''),
      details: Array.isArray(body.details) ? body.details : [],
      care: Array.isArray(body.care) ? body.care : [],
      material: String(body.material || '100% Cotton'),
      fit: String(body.fit || 'True to size'),
      rating: body.rating ? Number(body.rating) : 5.0,
      reviewCount: body.reviewCount ? Number(body.reviewCount) : 0,
      colorImages: typeof body.colorImages === 'object' && body.colorImages ? body.colorImages : {}
    };

    const success = await saveDbProduct(product);
    if (!success) {
      throw new Error('Database insert operation failed');
    }

    return NextResponse.json({
      success: true,
      message: 'Product saved successfully to Neon DB!',
      product
    });
  } catch (error: any) {
    console.error('API products POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save product.' },
      { status: 500 }
    );
  }
}
