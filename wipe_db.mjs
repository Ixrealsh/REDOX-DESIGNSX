import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_VT24yNgoRpjh@ep-little-recipe-aou1985r-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

async function run() {
  console.log('Wiping existing mock products and collections from the database...');
  await sql`DELETE FROM products;`;
  await sql`DELETE FROM collections;`;
  await sql`DELETE FROM drops;`;
  await sql`DELETE FROM lookbooks;`;

  console.log('Inserting Premium 230gsm Heavyweight Blank Tee...');
  const variants = [
    { size: "S", color: "Obsidian Black", inventory: 2 },
    { size: "S", color: "Pastel Pink / Coral", inventory: 2 },
    { size: "S", color: "Mustard / Khaki Brown", inventory: 2 },
    { size: "S", color: "Burgundy / Maroon", inventory: 1 },
    { size: "S", color: "Off-White / Cream", inventory: 1 },
    { size: "M", color: "Off-White / Cream", inventory: 1 },
    { size: "L", color: "Off-White / Cream", inventory: 1 }
  ];

  await sql`
    INSERT INTO products (
      id, slug, name, collection_slug, collection_name, category, price, image, image_alt, colors, color_hex, variants, 
      description, story, details, care, material, fit, rating, review_count, color_images
    ) VALUES (
      'p_heavyweight_blank_001',
      'premium-230gsm-heavyweight-blank-tee',
      'Premium 230gsm Heavyweight Blank Tee',
      'core-blanks',
      'Core Blanks',
      'tops',
      85,
      '',
      'Premium 230gsm Heavyweight Blank Tee',
      '{"Obsidian Black", "Pastel Pink / Coral", "Mustard / Khaki Brown", "Burgundy / Maroon", "Off-White / Cream"}',
      '{"Obsidian Black": "#0F0F0F", "Pastel Pink / Coral": "#FFB2B2", "Mustard / Khaki Brown": "#C29B35", "Burgundy / Maroon": "#5C1D27", "Off-White / Cream": "#F0EDE5"}'::jsonb,
      ${JSON.stringify(variants)}::jsonb,
      'The definitive heavyweight blank. Engineered with 230gsm combed cotton for a structural, boxy drape that holds its shape. Zero branding. Pure form.',
      'Born from the frustration of fast-fashion blanks that lose shape after one wash. We sourced custom 230gsm cotton and engineered a structural block that balances streetwear tension with everyday utility. This is the foundation of the modern uniform.',
      '{"230gsm heavyweight combed cotton", "Boxy, slightly cropped structural fit", "Dropped shoulders", "Thick ribbed collar tight to the neck", "Garment dyed for rich, zero-fade color", "Pre-shrunk finish"}',
      '{"Machine wash cold inside out", "Do not tumble dry", "Lay flat to dry", "Do not iron directly on fabric texture"}',
      '100% Premium Heavyweight Cotton',
      'Oversized boxy fit. Take your true size for the intended structural drape, or size up for an exaggerated silhouette.',
      5.0,
      0,
      '{}'
    )
  `;
  console.log('Success! Your live database now only contains your custom product.');
}
run().catch(console.error);
