import { NextResponse } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { products, drops, collections, lookbooks } from '@/data/catalog';
import { requireAdminSession } from '@/lib/admin-auth';

export async function POST() {
  const authError = requireAdminSession();
  if (authError) return authError;

  if (!isDbConfigured) {
    return NextResponse.json(
      { error: 'Database is not configured yet. Set DATABASE_URL in your .env file.' },
      { status: 400 }
    );
  }

  try {
    // 1. Create Products Table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        collection_slug VARCHAR(255) NOT NULL,
        collection_name VARCHAR(255) NOT NULL,
        category VARCHAR(150) NOT NULL,
        price NUMERIC NOT NULL,
        badge VARCHAR(100),
        image TEXT NOT NULL,
        secondary_image TEXT,
        image_alt TEXT NOT NULL,
        colors TEXT[] NOT NULL,
        color_hex JSONB NOT NULL,
        variants JSONB NOT NULL,
        description TEXT NOT NULL,
        story TEXT NOT NULL,
        details TEXT[] NOT NULL,
        care TEXT[] NOT NULL,
        material VARCHAR(255) NOT NULL,
        fit VARCHAR(255) NOT NULL,
        rating NUMERIC NOT NULL,
        review_count INTEGER NOT NULL,
        color_images JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 2. Create Drops Table
    await sql`
      CREATE TABLE IF NOT EXISTS drops (
        slug VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(100) NOT NULL,
        release_date TIMESTAMP WITH TIME ZONE NOT NULL,
        item_count INTEGER NOT NULL,
        summary TEXT NOT NULL,
        image TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 3. Create Waitlist Table
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        drop_slug VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 4. Create Collections Table
    await sql`
      CREATE TABLE IF NOT EXISTS collections (
        slug VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tagline VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        image TEXT NOT NULL,
        product_slugs TEXT[] NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 5. Create Lookbooks Table
    await sql`
      CREATE TABLE IF NOT EXISTS lookbooks (
        slug VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        season VARCHAR(255) NOT NULL,
        dek TEXT NOT NULL,
        image TEXT NOT NULL,
        featured_product_slugs TEXT[] NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 5.5 Create Orders Table
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        product_id VARCHAR(100) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_slug VARCHAR(255) NOT NULL,
        selected_color VARCHAR(100) NOT NULL,
        selected_size VARCHAR(50) NOT NULL,
        price NUMERIC NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(100) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        shipping_address TEXT NOT NULL,
        shipping_city VARCHAR(255) NOT NULL,
        payment_method VARCHAR(100) NOT NULL,
        momo_network VARCHAR(100),
        momo_number VARCHAR(100),
        status VARCHAR(100) DEFAULT 'Pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Return clean success response (No demo seeding - completely clean live canvas!)
    return NextResponse.json({
      success: true,
      message: 'Neon Postgres DB schemas initialized cleanly. Ready for live catalog inputs!',
      stats: {
        seededProducts: 0,
        seededDrops: 0,
        seededCollections: 0,
        seededLookbooks: 0
      }
    });
  } catch (error: any) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize database.' },
      { status: 500 }
    );
  }
}
