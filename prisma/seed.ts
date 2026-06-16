import { db } from '@/lib/db';

async function seedProviders() {
  // Seed image provider
  const existingImage = await db.storyboardProvider.findFirst({
    where: { type: 'image', is_default: true },
  });

  if (!existingImage) {
    await db.storyboardProvider.create({
      data: {
        type: 'image',
        name: 'Z-Image Local',
        provider: 'openai_image_compatible',
        base_url: 'http://127.0.0.1:9100',
        endpoint: '/v1/images/generations',
        model: 'z-image-turbo',
        api_key: 'local',
        timeout_seconds: 600,
        is_default: true,
        is_active: true,
      },
    });
    console.log('Created default image provider: Z-Image Local');
  }

  // Seed video provider (WAN)
  const existingVideoWan = await db.storyboardProvider.findFirst({
    where: { type: 'video', is_default: true },
  });

  if (!existingVideoWan) {
    await db.storyboardProvider.create({
      data: {
        type: 'video',
        name: 'WAN Local',
        provider: 'openai_video_compatible',
        base_url: 'http://127.0.0.1:9201',
        endpoint: '/v1/videos/generations',
        model: 'wan-i2v',
        api_key: 'local',
        timeout_seconds: 1800,
        is_default: true,
        is_active: true,
      },
    });
    console.log('Created default video provider: WAN Local');
  }

  // Seed video provider (LTX fallback)
  const existingVideoLtx = await db.storyboardProvider.findFirst({
    where: { name: 'LTX Local' },
  });

  if (!existingVideoLtx) {
    await db.storyboardProvider.create({
      data: {
        type: 'video',
        name: 'LTX Local',
        provider: 'openai_video_compatible',
        base_url: 'http://127.0.0.1:9200',
        endpoint: '/v1/videos/generations',
        model: 'ltx-i2v',
        api_key: 'local',
        timeout_seconds: 1800,
        is_default: false,
        is_active: true,
      },
    });
    console.log('Created fallback video provider: LTX Local');
  }

  console.log('Seed completed!');
}

seedProviders()
  .catch(console.error)
  .finally(() => db.$disconnect());
