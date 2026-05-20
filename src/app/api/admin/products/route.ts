import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDbConfigured } from '@/lib/db';
import { deleteDbProduct, getDbProducts, saveDbProduct } from '@/lib/catalog-db';
import { requireAdminSession } from '@/lib/admin-auth';
import { isVariantInStock, normalizeVariantStock } from '@/lib/inventory';
import type { Product } from '@/types/product';

export async function GET() {
  const authError = requireAdminSession();
  if (authError) return authError;

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
    
    // Basic structural validation
    if (!body.id || !body.slug || !body.name || !body.price || !body.image) {
      return NextResponse.json(
        { error: 'Missing required product fields (id, slug, name, price, image).' },
        { status: 400 }
      );
    }

    const normalizedVariants = Array.isArray(body.variants) ? body.variants.map(normalizeVariantStock) : [];
    const hasSellableVariant = normalizedVariants.some(isVariantInStock);

    if (!hasSellableVariant) {
      return NextResponse.json(
        { error: 'Add at least one in-stock size before saving.' },
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
      variants: normalizedVariants,
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

    revalidatePath('/');
    revalidatePath('/shop');
    revalidatePath(`/products/${product.slug}`);

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

export async function DELETE(request: Request) {
  const authError = requireAdminSession();
  if (authError) return authError;

  if (!isDbConfigured) {
    return NextResponse.json(
      { error: 'Database is not configured yet. Set DATABASE_URL in your .env file.' },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId is required.' }, { status: 400 });
    }

    await deleteDbProduct(productId);
    revalidatePath('/');
    revalidatePath('/shop');
    return NextResponse.json({ success: true, message: 'Product deleted successfully.' });
  } catch (error: any) {
    console.error('API products DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete product.' },
      { status: 500 }
    );
  }
}
