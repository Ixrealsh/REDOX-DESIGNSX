import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdminSession } from '@/lib/admin-auth';

// Check if credentials exist before configuring
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isCloudinaryConfigured = Boolean(
  cloudName && 
  apiKey && 
  apiKey !== 'your_cloudinary_api_key_here' && 
  apiSecret && 
  apiSecret !== 'your_cloudinary_api_secret_here'
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
}

export async function POST(request: Request) {
  const authError = requireAdminSession();
  if (authError) return authError;

  if (!isCloudinaryConfigured) {
    return NextResponse.json(
      { error: 'Cloudinary credentials are not configured in your .env file.' },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file was provided.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed.' }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image is too large. Upload an image under 8MB.' }, { status: 400 });
    }

    // Convert file to standard Buffer for server-side streaming
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary using a promise to handle stream response
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'redox-apparel',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }] 
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary internal stream error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      uploadStream.end(buffer);
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height
    });
  } catch (error: any) {
    console.error('Cloudinary upload endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Image upload failed.' },
      { status: 500 }
    );
  }
}
