import { ImageResponse } from '@vercel/og';
import { getVideoById } from '@/lib/dataLoader';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const video = await getVideoById(videoId);

    if (!video) {
      return new Response('Video not found', { status: 404 });
    }

  const recipe = video.recipes?.[0];
  const title = recipe?.title || video.title;
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  // Format time display
  const cookTime = recipe?.total_time_minutes || recipe?.cook_time_minutes;
  const timeDisplay = cookTime ? `${cookTime} min` : null;
  const servingsDisplay = recipe?.servings ? `${recipe.servings} servings` : null;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#000',
          position: 'relative',
        }}
      >
        {/* Background thumbnail */}
        <img
          src={thumbnailUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Badges */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {timeDisplay && (
              <div
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  color: '#fff',
                  fontSize: '20px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '18px' }}>⏱</span> {timeDisplay}
              </div>
            )}
            {servingsDisplay && (
              <div
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  color: '#fff',
                  fontSize: '20px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '18px' }}>👥</span> {servingsDisplay}
              </div>
            )}
            {recipe?.difficulty && (
              <div
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  color: '#fff',
                  fontSize: '20px',
                  fontWeight: 500,
                }}
              >
                {recipe.difficulty}
              </div>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              color: '#fff',
              fontSize: title.length > 60 ? '42px' : '52px',
              fontWeight: 700,
              lineHeight: 1.2,
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              maxHeight: title.length > 60 ? '101px' : '125px',
              overflow: 'hidden',
            }}
          >
            {title.length > 100 ? title.substring(0, 97) + '...' : title}
          </div>

          {/* Channel */}
          <div
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '24px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {video.channelName}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
  } catch (error) {
    console.error('OG image generation failed:', error);
    return new Response(
      `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    );
  }
}
