# YouTube Data Extraction Pipeline

Python scripts for extracting video metadata, transcripts, and generating structured recipes from YouTube cooking channels.

## Prerequisites

- Python 3.13+
- OpenAI API key (for recipe generation)

## Setup

### 1. Create Virtual Environment

```bash
cd youtube
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or: venv\Scripts\activate  # On Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Scripts

### fetch_youtube_metadata.py
Parses `RECIPES.md` to extract channel/playlist URLs and fetches metadata using yt-dlp.

```bash
python fetch_youtube_metadata.py
```

### batch_extract_channels.py
Batch extracts transcripts for multiple pre-configured channels (10 videos each).

```bash
python batch_extract_channels.py
```

### batch_extract_channel.py
Extracts transcripts for a single channel, filtered by date.

```bash
python batch_extract_channel.py --channel JKenjiLopezAlt --days 180
python batch_extract_channel.py --channel JKenjiLopezAlt --days 180 --summarize
```

### extract_video.py
Core extraction module - downloads video captions and metadata for a single video.

```bash
python extract_video.py https://www.youtube.com/watch?v=VIDEO_ID
```

### resume_extraction.py
Resume failed video extractions (for rate-limited requests).

```bash
python resume_extraction.py --channel JKenjiLopezAlt
```

### generate_recipes.py
Generates structured recipe JSON from video transcripts using OpenAI.

```bash
python generate_recipes.py
python generate_recipes.py --video-id VIDEO_ID  # Single video
```

## Cache Structure

All cached data is stored in `../data/youtube-cache/`:

```
data/youtube-cache/
├── channel_{handle}.json.gz     # Channel metadata
├── {video_id}.json.gz           # Video metadata
├── {video_id}.vtt.gz            # Video transcript (WebVTT)
├── {video_id}.summaries.json.gz # AI-generated summaries
└── recipes/
    └── {video_id}/
        ├── current_version.txt
        └── versions/            # Versioned recipe JSON files
```

## Rate Limiting

The scripts include built-in rate limiting to avoid YouTube throttling:
- 2-5 second random delays between requests
- Exponential backoff for 429 errors
- Caching to prevent re-fetching

## Data Files

- `RECIPES.md` - List of cooking channels and playlists to process
- `www.youtube.com_cookies.txt` - Cookies file for authenticated requests
- `youtube_metadata.json` - Output from metadata fetching
