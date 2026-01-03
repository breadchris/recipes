#!/usr/bin/env python3
"""
Extract YouTube channel, playlist, and video metadata from RECIPES.md

This script:
1. Parses RECIPES.md to find channel URLs and playlist URLs
2. Uses yt-dlp to fetch full metadata for each
3. Caches results to avoid re-fetching
4. Outputs a structured JSON file with normalized relationships
"""

import argparse
import gzip
import json
import os
import random
import re
import requests
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple
import yt_dlp
from yt_dlp.utils import YoutubeDLError

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Cache directory for metadata
CACHE_DIR = os.path.join(SCRIPT_DIR, '..', 'data', 'youtube-cache')
RECIPES_FILE = os.path.join(SCRIPT_DIR, 'RECIPES.md')
OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'youtube_metadata.json')
LOG_FILE = os.path.join(SCRIPT_DIR, 'youtube_metadata.log')
COOKIES_FILE = os.path.join(SCRIPT_DIR, 'www.youtube.com_cookies.txt')

# Rate limiting configuration (to avoid YouTube throttling)
DELAY_MIN_SECONDS = 2  # Minimum delay between requests
DELAY_MAX_SECONDS = 5  # Maximum delay between requests

# Track errors and stats
ERROR_LOG = []
STATS = {
    'channels_attempted': 0,
    'channels_success': 0,
    'channels_cached': 0,
    'channels_failed': 0,
    'playlists_attempted': 0,
    'playlists_success': 0,
    'playlists_cached': 0,
    'playlists_failed': 0,
    'videos_fetched': 0,
}

def log_message(message: str, level: str = 'INFO'):
    """Log message to both stderr and log file"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    formatted = f'[{timestamp}] [{level}] {message}'
    print(formatted, file=sys.stderr)
    with open(LOG_FILE, 'a') as f:
        f.write(formatted + '\n')

def sleep_with_jitter(skip: bool = False):
    """
    Sleep for a random duration to avoid rate limiting

    Args:
        skip: If True, don't sleep (used for last item in a loop)
    """
    if skip:
        return

    delay = random.uniform(DELAY_MIN_SECONDS, DELAY_MAX_SECONDS)
    log_message(f'  ⏸  Sleeping {delay:.1f}s to avoid rate limiting...')
    time.sleep(delay)

def ensure_cache_dir():
    """Create cache directory if it doesn't exist"""
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR, exist_ok=True)
    if not os.path.isdir(CACHE_DIR):
        raise ValueError(f'{CACHE_DIR} is not a directory')

def parse_recipes_md(file_path: str, limit: Optional[int] = None) -> Tuple[List[str], List[str]]:
    """
    Parse RECIPES.md to extract channel URLs and playlist URLs

    Args:
        file_path: Path to RECIPES.md
        limit: Optional limit on number of channels to process (for testing)

    Returns:
        Tuple of (channel_urls, playlist_urls)
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract channel URLs (e.g., https://www.youtube.com/@ChannelName or @ChannelName/videos)
    channel_pattern = r'https://www\.youtube\.com/@[\w-]+'
    channel_urls = list(dict.fromkeys(re.findall(channel_pattern, content)))

    if limit:
        channel_urls = channel_urls[:limit]

    # Extract playlist URLs from {{video(...)}} macros
    # Pattern: {{video(https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID)}}
    # or: {{video(https://www.youtube.com/playlist?list=PLAYLIST_ID)}}
    playlist_pattern = r'\{\{video\((https://www\.youtube\.com/[^)]+)\)\}\}'
    video_urls = re.findall(playlist_pattern, content)

    playlist_urls = []
    for url in video_urls:
        # Extract playlist ID from various URL formats
        list_match = re.search(r'[?&]list=([\w-]+)', url)
        if list_match:
            playlist_id = list_match.group(1)
            playlist_urls.append(f'https://www.youtube.com/playlist?list={playlist_id}')
        elif '/playlist?' in url:
            playlist_urls.append(url)

    # Deduplicate playlists while preserving order
    playlist_urls = list(dict.fromkeys(playlist_urls))

    log_message(f'Found {len(channel_urls)} unique channels')
    log_message(f'Found {len(playlist_urls)} unique playlists')

    return channel_urls, playlist_urls

def get_cached_metadata(cache_key: str) -> Optional[Dict]:
    """
    Retrieve cached metadata if it exists

    Args:
        cache_key: Unique identifier (channel_id, playlist_id, or video_id)

    Returns:
        Cached metadata dict or None
    """
    cache_file = os.path.join(CACHE_DIR, f'{cache_key}.json.gz')

    if os.path.isfile(cache_file):
        try:
            with gzip.open(cache_file, 'rt', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'Warning: Failed to load cache for {cache_key}: {e}', file=sys.stderr)
            return None

    return None

def save_metadata_cache(cache_key: str, metadata: Dict):
    """
    Save metadata to cache

    Args:
        cache_key: Unique identifier
        metadata: Metadata dictionary to cache
    """
    cache_file = os.path.join(CACHE_DIR, f'{cache_key}.json.gz')

    try:
        with gzip.open(cache_file, 'wt', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f'Warning: Failed to save cache for {cache_key}: {e}', file=sys.stderr)

class YouTubeMetadataExtractor:
    """Extract metadata from YouTube using yt-dlp"""

    def __init__(self):
        ensure_cache_dir()

        self.ydl_opts = {
            'quiet': True,
            'no_warnings': False,
            'skip_download': True,
            'extract_flat': False,  # Get full metadata
            'format': 'worst',  # Don't try to get best quality, we're not downloading anyway
            'ignore_no_formats_error': True,  # Ignore format errors since we only want metadata
            # Rate limiting - crucial for avoiding YouTube throttling
            'sleep_interval': 2,  # Sleep 2 seconds after each video extraction
            'max_sleep_interval': 5,  # Random sleep between 2-5 seconds
            'sleep_interval_requests': 1,  # 1 second between API requests
            # Browser-like headers to avoid bot detection
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Sec-Fetch-Mode': 'navigate',
            },
            # Extractor args to bypass some YouTube restrictions
            'extractor_args': {
                'youtube': {
                    'player_client': ['web'],  # Only use web client (android doesn't support cookies)
                    'player_skip': ['configs'],
                }
            }
        }

        # Add cookies file if it exists
        if os.path.exists(COOKIES_FILE):
            self.ydl_opts['cookiefile'] = COOKIES_FILE
            log_message(f'Using cookies from: {COOKIES_FILE}')

    def extract_channel_info(self, channel_url: str) -> Optional[Dict]:
        """
        Extract channel metadata

        Args:
            channel_url: YouTube channel URL

        Returns:
            Channel metadata dict or None on error
        """
        # Extract channel handle from URL
        match = re.search(r'@([\w-]+)', channel_url)
        if not match:
            print(f'Error: Could not extract channel handle from {channel_url}', file=sys.stderr)
            return None

        channel_handle = match.group(1)

        # Check cache first
        cached = get_cached_metadata(f'channel_{channel_handle}')
        if cached:
            log_message(f'  ✓ Using cached data for @{channel_handle}')
            STATS['channels_cached'] += 1
            return cached

        log_message(f'  → Fetching from YouTube: @{channel_handle}...')

        try:
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                # Use /videos page to get channel info
                info = ydl.extract_info(f'{channel_url}/videos', download=False)

                if info:
                    # Save to cache
                    save_metadata_cache(f'channel_{channel_handle}', info)
                    subscriber_count = info.get('channel_follower_count') or info.get('subscriber_count', 0)
                    log_message(f'  ✓ Success: @{channel_handle} ({subscriber_count:,} subscribers)')
                    STATS['channels_success'] += 1
                    return info
                else:
                    error_msg = f'No info returned for {channel_url}'
                    log_message(f'  ✗ Failed: {error_msg}', 'WARNING')
                    ERROR_LOG.append({'type': 'channel', 'url': channel_url, 'error': error_msg})
                    STATS['channels_failed'] += 1
                    return None

        except YoutubeDLError as e:
            error_msg = str(e)
            log_message(f'  ✗ Failed: @{channel_handle} - {error_msg}', 'ERROR')
            ERROR_LOG.append({'type': 'channel', 'url': channel_url, 'error': error_msg})
            STATS['channels_failed'] += 1
            return None

    def extract_playlist_info(self, playlist_url: str) -> Optional[Dict]:
        """
        Extract playlist metadata and all video IDs

        Args:
            playlist_url: YouTube playlist URL

        Returns:
            Playlist metadata dict or None on error
        """
        # Extract playlist ID from URL
        match = re.search(r'list=([\w-]+)', playlist_url)
        if not match:
            print(f'Error: Could not extract playlist ID from {playlist_url}', file=sys.stderr)
            return None

        playlist_id = match.group(1)

        # Check cache first
        cached = get_cached_metadata(f'playlist_{playlist_id}')
        if cached:
            video_count = len(cached.get('entries', []))
            log_message(f'  ✓ Using cached data for playlist {playlist_id} ({video_count} videos)')
            STATS['playlists_cached'] += 1
            return cached

        log_message(f'  → Fetching from YouTube: playlist {playlist_id}...')

        try:
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(playlist_url, download=False)

                if info:
                    # Save to cache
                    save_metadata_cache(f'playlist_{playlist_id}', info)
                    video_count = len(info.get('entries', []))
                    log_message(f'  ✓ Success: {playlist_id} - "{info.get("title", "Unknown")}" ({video_count} videos)')
                    STATS['playlists_success'] += 1
                    return info
                else:
                    error_msg = f'No info returned for {playlist_url}'
                    log_message(f'  ✗ Failed: {error_msg}', 'WARNING')
                    ERROR_LOG.append({'type': 'playlist', 'url': playlist_url, 'error': error_msg})
                    STATS['playlists_failed'] += 1
                    return None

        except YoutubeDLError as e:
            error_msg = str(e)
            log_message(f'  ✗ Failed: playlist {playlist_id} - {error_msg}', 'ERROR')
            ERROR_LOG.append({'type': 'playlist', 'url': playlist_url, 'error': error_msg})
            STATS['playlists_failed'] += 1
            return None

    def extract_video_info(self, video_id: str) -> Optional[Dict]:
        """
        Extract video metadata

        Args:
            video_id: YouTube video ID

        Returns:
            Video metadata dict or None on error
        """
        # Check cache first
        cached = get_cached_metadata(f'video_{video_id}')
        if cached:
            STATS['videos_fetched'] += 1
            return cached

        try:
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)

                if info:
                    # Save to cache
                    save_metadata_cache(f'video_{video_id}', info)
                    STATS['videos_fetched'] += 1
                    # Note: yt-dlp handles rate limiting via sleep_interval config
                    return info
                else:
                    return None

        except YoutubeDLError as e:
            return None

    def extract_transcript(self, video_id: str, langs: List[str] = None) -> Optional[Dict]:
        """
        Extract transcript/captions for a video

        Args:
            video_id: YouTube video ID
            langs: List of language codes to extract (default: ['en'])

        Returns:
            Transcript data dict or None on error
        """
        if langs is None:
            langs = ['en']

        # Check cache first
        cached = get_cached_metadata(f'transcript_{video_id}')
        if cached:
            log_message(f'  ✓ Using cached transcript for {video_id}')
            return cached

        log_message(f'  → Fetching transcript for {video_id}...')

        try:
            # Configure yt-dlp for transcript extraction
            transcript_opts = self.ydl_opts.copy()
            transcript_opts.update({
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitlesformat': 'json3',
                'subtitleslangs': langs,
            })

            with yt_dlp.YoutubeDL(transcript_opts) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)

                if not info:
                    log_message(f'  ✗ Failed to get video info for {video_id}', 'ERROR')
                    return None

                transcript_data = {
                    'video_id': video_id,
                    'title': info.get('title'),
                    'duration': info.get('duration'),
                    'manual_subtitles': {},
                    'automatic_captions': {},
                    'fetched_at': datetime.now().isoformat()
                }

                # Fetch manual subtitles
                for lang, formats in info.get('subtitles', {}).items():
                    json3_format = next((f for f in formats if f['ext'] == 'json3'), None)
                    if json3_format:
                        try:
                            response = requests.get(json3_format['url'], timeout=30)
                            response.raise_for_status()
                            transcript_data['manual_subtitles'][lang] = response.json()
                            log_message(f'    ✓ Manual subtitles [{lang}]')
                        except Exception as e:
                            log_message(f'    ✗ Failed to fetch manual subtitles [{lang}]: {e}', 'WARNING')

                # Fetch auto-generated captions
                for lang, formats in info.get('automatic_captions', {}).items():
                    json3_format = next((f for f in formats if f['ext'] == 'json3'), None)
                    if json3_format:
                        try:
                            response = requests.get(json3_format['url'], timeout=30)
                            response.raise_for_status()
                            transcript_data['automatic_captions'][lang] = response.json()
                            log_message(f'    ✓ Auto-generated captions [{lang}]')
                        except Exception as e:
                            log_message(f'    ✗ Failed to fetch auto captions [{lang}]: {e}', 'WARNING')

                # Check if we got any transcripts
                if not transcript_data['manual_subtitles'] and not transcript_data['automatic_captions']:
                    log_message(f'  ✗ No transcripts available for {video_id}', 'WARNING')
                    return None

                # Save to cache
                save_metadata_cache(f'transcript_{video_id}', transcript_data)
                log_message(f'  ✓ Success: {video_id}')

                return transcript_data

        except YoutubeDLError as e:
            log_message(f'  ✗ Failed: {video_id} - {str(e)}', 'ERROR')
            return None
        except Exception as e:
            log_message(f'  ✗ Unexpected error for {video_id}: {str(e)}', 'ERROR')
            return None

def build_structured_output(
    channels_info: List[Dict],
    playlists_info: List[Dict],
    extractor: YouTubeMetadataExtractor
) -> Dict:
    """
    Build the final structured JSON output

    Args:
        channels_info: List of channel metadata dicts
        playlists_info: List of playlist metadata dicts
        extractor: YouTubeMetadataExtractor instance for fetching video metadata

    Returns:
        Structured output dictionary
    """
    output = {
        'channels': {},
        'playlists': {},
        'videos': []
    }

    # Track videos we've already added to avoid duplicates
    video_ids_added: Set[str] = set()

    # Track which playlists each video belongs to
    video_to_playlists: Dict[str, List[str]] = {}

    # Process channels
    for channel_info in channels_info:
        if not channel_info:
            continue

        channel_id = channel_info.get('channel_id') or channel_info.get('id')
        if not channel_id:
            continue

        output['channels'][channel_id] = {
            'id': channel_id,
            'name': channel_info.get('channel') or channel_info.get('uploader') or channel_info.get('title', ''),
            'url': channel_info.get('channel_url', ''),
            'description': channel_info.get('description', ''),
            'subscriber_count': channel_info.get('channel_follower_count') or channel_info.get('subscriber_count'),
            'video_count': channel_info.get('playlist_count'),
        }

    # Process playlists
    for playlist_info in playlists_info:
        if not playlist_info:
            continue

        playlist_id = playlist_info.get('id')
        if not playlist_id:
            continue

        channel_id = playlist_info.get('channel_id') or playlist_info.get('uploader_id')

        output['playlists'][playlist_id] = {
            'id': playlist_id,
            'title': playlist_info.get('title', ''),
            'channel_id': channel_id,
            'url': playlist_info.get('webpage_url', ''),
            'video_count': len(playlist_info.get('entries', [])),
            'description': playlist_info.get('description', ''),
        }

        # Process videos in this playlist
        entries = playlist_info.get('entries', [])
        log_message(f'  Processing {len(entries)} videos from playlist {playlist_id}...')

        for entry in entries:
            if not entry:
                continue

            video_id = entry.get('id')
            if not video_id:
                continue

            # Track playlist membership
            if video_id not in video_to_playlists:
                video_to_playlists[video_id] = []
            video_to_playlists[video_id].append(playlist_id)

            # Skip if we've already added this video
            if video_id in video_ids_added:
                continue

            # Get full video metadata (may be cached)
            video_info = extractor.extract_video_info(video_id)
            if not video_info:
                continue

            video_channel_id = video_info.get('channel_id') or video_info.get('uploader_id')

            output['videos'].append({
                'id': video_id,
                'title': video_info.get('title', ''),
                'channel_id': video_channel_id,
                'playlist_ids': [],  # Will be filled in later
                'url': video_info.get('webpage_url', ''),
                'description': video_info.get('description', ''),
                'duration': video_info.get('duration'),
                'upload_date': video_info.get('upload_date', ''),
                'view_count': video_info.get('view_count'),
                'like_count': video_info.get('like_count'),
                'comment_count': video_info.get('comment_count'),
                'thumbnail': video_info.get('thumbnail', ''),
            })

            video_ids_added.add(video_id)

    # Update playlist_ids for each video
    for video in output['videos']:
        video_id = video['id']
        video['playlist_ids'] = video_to_playlists.get(video_id, [])

    return output

def main():
    parser = argparse.ArgumentParser(
        description='Extract YouTube metadata and transcripts'
    )
    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Metadata subcommand (existing functionality)
    metadata_parser = subparsers.add_parser(
        'metadata',
        help='Extract video/channel/playlist metadata from RECIPES.md'
    )
    metadata_parser.add_argument(
        '--limit',
        type=int,
        help='Limit number of channels to process (for testing)',
        default=None
    )
    metadata_parser.add_argument(
        '--output',
        '-o',
        help='Output file path',
        default=OUTPUT_FILE
    )

    # Transcript subcommand (new functionality)
    transcript_parser = subparsers.add_parser(
        'transcript',
        help='Extract video transcripts (captions/subtitles)'
    )
    transcript_parser.add_argument(
        '--video-id',
        help='Extract transcript for specific video ID'
    )
    transcript_parser.add_argument(
        '--channel-url',
        help='Extract transcripts for all videos in a channel'
    )
    transcript_parser.add_argument(
        '--playlist-url',
        help='Extract transcripts for all videos in a playlist'
    )
    transcript_parser.add_argument(
        '--langs',
        default='en',
        help='Comma-separated language codes (default: en)'
    )

    args = parser.parse_args()

    # Default to metadata command if no subcommand specified
    if args.command is None:
        args.command = 'metadata'
        args.limit = None
        args.output = OUTPUT_FILE

    # Clear log file at start
    with open(LOG_FILE, 'w') as f:
        f.write(f'=== YouTube Data Extraction Started at {datetime.now()} ===\n\n')

    # Route to appropriate handler based on subcommand
    if args.command == 'transcript':
        handle_transcript_command(args)
    else:  # metadata command
        handle_metadata_command(args)

def handle_metadata_command(args):
    """Handle the metadata subcommand"""
    log_message('='*60)
    log_message('Starting YouTube metadata extraction')
    log_message('='*60)

    # Parse RECIPES.md
    channel_urls, playlist_urls = parse_recipes_md(RECIPES_FILE, limit=args.limit)

    # Initialize extractor
    extractor = YouTubeMetadataExtractor()

    # Extract channel metadata
    log_message('')
    log_message('='*60)
    log_message('PHASE 1: Extracting Channel Metadata')
    log_message('='*60)
    channels_info = []
    for i, url in enumerate(channel_urls, 1):
        log_message(f'[{i}/{len(channel_urls)}] Processing channel: {url}')
        STATS['channels_attempted'] += 1
        info = extractor.extract_channel_info(url)
        if info:
            channels_info.append(info)
        # Add delay between requests (skip for last item)
        sleep_with_jitter(skip=(i == len(channel_urls)))

    # Extract playlist metadata
    log_message('')
    log_message('='*60)
    log_message('PHASE 2: Extracting Playlist Metadata')
    log_message('='*60)
    playlists_info = []
    for i, url in enumerate(playlist_urls, 1):
        log_message(f'[{i}/{len(playlist_urls)}] Processing playlist: {url}')
        STATS['playlists_attempted'] += 1
        info = extractor.extract_playlist_info(url)
        if info:
            playlists_info.append(info)
        # Add delay between requests (skip for last item)
        sleep_with_jitter(skip=(i == len(playlist_urls)))

    # Build structured output
    log_message('')
    log_message('='*60)
    log_message('PHASE 3: Building Structured Output')
    log_message('='*60)
    output = build_structured_output(channels_info, playlists_info, extractor)

    # Write output file
    log_message(f'Writing output to {args.output}...')
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # Print summary
    log_message('')
    log_message('='*60)
    log_message('FINAL SUMMARY')
    log_message('='*60)
    log_message(f'Output file: {args.output}')
    log_message('')
    log_message('Channels:')
    log_message(f'  Attempted: {STATS["channels_attempted"]}')
    log_message(f'  Success:   {STATS["channels_success"]} (fetched)')
    log_message(f'  Cached:    {STATS["channels_cached"]} (reused)')
    log_message(f'  Failed:    {STATS["channels_failed"]}')
    log_message(f'  Total:     {len(output["channels"])}')
    log_message('')
    log_message('Playlists:')
    log_message(f'  Attempted: {STATS["playlists_attempted"]}')
    log_message(f'  Success:   {STATS["playlists_success"]} (fetched)')
    log_message(f'  Cached:    {STATS["playlists_cached"]} (reused)')
    log_message(f'  Failed:    {STATS["playlists_failed"]}')
    log_message(f'  Total:     {len(output["playlists"])}')
    log_message('')
    log_message(f'Videos:      {len(output["videos"])} ({STATS["videos_fetched"]} metadata requests)')

    # Print errors if any
    if ERROR_LOG:
        log_message('')
        log_message('='*60)
        log_message(f'ERRORS ({len(ERROR_LOG)} total)')
        log_message('='*60)
        for error in ERROR_LOG[:10]:  # Show first 10 errors
            log_message(f'  {error["type"]}: {error["url"]}', 'ERROR')
            log_message(f'    → {error["error"]}', 'ERROR')
        if len(ERROR_LOG) > 10:
            log_message(f'  ... and {len(ERROR_LOG) - 10} more errors (see log file)', 'ERROR')

    log_message('')
    log_message('='*60)
    log_message(f'Extraction completed at {datetime.now()}')
    log_message(f'Full log saved to: {LOG_FILE}')
    log_message('='*60)

def handle_transcript_command(args):
    """Handle the transcript subcommand"""
    log_message('='*60)
    log_message('Starting YouTube transcript extraction')
    log_message('='*60)

    # Parse language list
    langs = [lang.strip() for lang in args.langs.split(',')]
    log_message(f'Languages: {", ".join(langs)}')

    # Initialize extractor
    extractor = YouTubeMetadataExtractor()

    video_ids = []

    # Determine what to extract
    if args.video_id:
        log_message(f'Mode: Single video')
        log_message(f'Video ID: {args.video_id}')
        video_ids = [args.video_id]

    elif args.channel_url:
        log_message(f'Mode: Channel')
        log_message(f'Channel URL: {args.channel_url}')
        log_message('')
        log_message('Step 1: Extracting channel metadata...')

        # Get channel info to find all videos
        channel_info = extractor.extract_channel_info(args.channel_url)
        if not channel_info:
            log_message('Failed to extract channel metadata', 'ERROR')
            return

        # Extract video IDs from channel entries
        entries = channel_info.get('entries', [])
        video_ids = [entry.get('id') for entry in entries if entry and entry.get('id')]
        log_message(f'Found {len(video_ids)} videos in channel')

    elif args.playlist_url:
        log_message(f'Mode: Playlist')
        log_message(f'Playlist URL: {args.playlist_url}')
        log_message('')
        log_message('Step 1: Extracting playlist metadata...')

        # Get playlist info to find all videos
        playlist_info = extractor.extract_playlist_info(args.playlist_url)
        if not playlist_info:
            log_message('Failed to extract playlist metadata', 'ERROR')
            return

        # Extract video IDs from playlist entries
        entries = playlist_info.get('entries', [])
        video_ids = [entry.get('id') for entry in entries if entry and entry.get('id')]
        log_message(f'Found {len(video_ids)} videos in playlist')

    else:
        log_message('Error: Must specify --video-id, --channel-url, or --playlist-url', 'ERROR')
        return

    # Extract transcripts
    log_message('')
    log_message('='*60)
    log_message(f'Extracting Transcripts ({len(video_ids)} videos)')
    log_message('='*60)

    transcripts = []
    success_count = 0
    failed_count = 0
    cached_count = 0

    for i, video_id in enumerate(video_ids, 1):
        log_message(f'[{i}/{len(video_ids)}] Processing video: {video_id}')

        # Check if already cached
        cached = get_cached_metadata(f'transcript_{video_id}')
        if cached:
            cached_count += 1
            transcripts.append(cached)
        else:
            # Extract transcript
            transcript = extractor.extract_transcript(video_id, langs=langs)
            if transcript:
                success_count += 1
                transcripts.append(transcript)
            else:
                failed_count += 1

        # Add delay between requests (skip for last item)
        sleep_with_jitter(skip=(i == len(video_ids)))

    # Print summary
    log_message('')
    log_message('='*60)
    log_message('FINAL SUMMARY')
    log_message('='*60)
    log_message(f'Total videos: {len(video_ids)}')
    log_message(f'  Success:    {success_count} (fetched)')
    log_message(f'  Cached:     {cached_count} (reused)')
    log_message(f'  Failed:     {failed_count}')
    log_message('')
    log_message(f'Transcripts saved to: {CACHE_DIR}/transcript_*.json.gz')
    log_message('')
    log_message('='*60)
    log_message(f'Extraction completed at {datetime.now()}')
    log_message(f'Full log saved to: {LOG_FILE}')
    log_message('='*60)

if __name__ == '__main__':
    main()
