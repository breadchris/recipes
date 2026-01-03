#!/usr/bin/env python3
"""
Batch extract transcripts for multiple channels (10 videos per channel).
"""

import argparse
import gzip
import json
import os
import sys
import time
from typing import List, Tuple
from extract_video import VideoExtractor

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(SCRIPT_DIR, '..', 'data', 'youtube-cache')

# Channel URLs to process (excluding JKenjiLopezAlt - already done)
CHANNELS = [
    'https://www.youtube.com/@EthanChlebowski',
    'https://www.youtube.com/@bingingwithbabish',
    'https://www.youtube.com/@epicurious',
    'https://www.youtube.com/@AmericasTestKitchen',
    'https://www.youtube.com/@JoshuaWeissman',
    'https://www.youtube.com/@ChefJeanPierre',
]

def get_channel_handle(channel_url: str) -> str:
    """Extract channel handle from URL"""
    return channel_url.split('@')[1]

def get_channel_videos(channel_handle: str, limit: int = 10) -> List[Tuple[str, str, str]]:
    """Get video IDs from cached channel data"""
    cache_file = os.path.join(CACHE_DIR, f'channel_{channel_handle}.json.gz')

    if not os.path.isfile(cache_file):
        print(f'  ⚠ No cache file found for {channel_handle}', file=sys.stderr)
        return []

    try:
        with gzip.open(cache_file, 'rt', encoding='utf-8') as f:
            channel_data = json.load(f)
    except Exception as e:
        print(f'  ✗ Error loading cache: {e}', file=sys.stderr)
        return []

    # Get entries and limit to requested number
    entries = channel_data.get('entries', [])[:limit]

    videos = []
    for entry in entries:
        if entry and entry.get('id'):
            videos.append((
                entry.get('id'),
                entry.get('upload_date', ''),
                entry.get('title', 'Unknown')[:60]
            ))

    return videos

def main():
    parser = argparse.ArgumentParser(
        description='Batch extract transcripts for multiple channels'
    )
    parser.add_argument(
        '--videos-per-channel',
        type=int,
        default=10,
        help='Number of videos to process per channel (default: 10)'
    )
    parser.add_argument(
        '--delay',
        type=int,
        default=30,
        help='Delay in seconds between videos (default: 30)'
    )
    parser.add_argument(
        '--channels',
        nargs='+',
        help='Specific channel handles to process (optional)'
    )

    args = parser.parse_args()

    # Use specified channels or default list
    channels_to_process = CHANNELS
    if args.channels:
        channels_to_process = [f'https://www.youtube.com/@{ch}' if not ch.startswith('http') else ch
                               for ch in args.channels]

    print(f'Processing {len(channels_to_process)} channels', file=sys.stderr)
    print(f'Videos per channel: {args.videos_per_channel}', file=sys.stderr)
    print(f'Delay between videos: {args.delay}s', file=sys.stderr)
    print('', file=sys.stderr)

    # Initialize extractor
    extractor = VideoExtractor()

    # Track overall stats
    total_success = 0
    total_errors = 0
    total_skipped = 0

    for channel_idx, channel_url in enumerate(channels_to_process, 1):
        channel_handle = get_channel_handle(channel_url)

        print(f'[{channel_idx}/{len(channels_to_process)}] Channel: {channel_handle}', file=sys.stderr)
        print(f'=' * 60, file=sys.stderr)

        # Get videos for this channel
        videos = get_channel_videos(channel_handle, args.videos_per_channel)

        if not videos:
            print(f'  No videos found for {channel_handle}', file=sys.stderr)
            print('', file=sys.stderr)
            continue

        print(f'  Found {len(videos)} videos to process', file=sys.stderr)
        print('', file=sys.stderr)

        # Process each video
        for i, (video_id, upload_date, title) in enumerate(videos, 1):
            # Check if transcript already exists
            transcript_file = os.path.join(CACHE_DIR, f'{video_id}.vtt.gz')
            transcript_exists = os.path.isfile(transcript_file)
            metadata_file = os.path.join(CACHE_DIR, f'{video_id}.json.gz')
            metadata_exists = os.path.isfile(metadata_file)

            # Skip if both transcript and metadata exist
            if transcript_exists and metadata_exists:
                print(f'  [{i}/{len(videos)}] {video_id} - SKIP (exists)', file=sys.stderr)
                total_skipped += 1
                continue

            print(f'  [{i}/{len(videos)}] {video_id}', file=sys.stderr)
            print(f'    Title: {title}', file=sys.stderr)

            try:
                # Extract video info
                video_url = f'https://www.youtube.com/watch?v={video_id}'
                video_info = extractor.extract_video_info(video_url)

                if not video_info:
                    print(f'    ✗ Failed to extract video info', file=sys.stderr)
                    total_errors += 1
                    continue

                # Only extract captions if transcript doesn't exist
                if not transcript_exists:
                    # Get captions
                    caption_track = extractor.get_captions_by_priority(video_info)

                    if not caption_track:
                        print(f'    ✗ No captions available', file=sys.stderr)
                        total_errors += 1
                        continue

                    ext = caption_track['ext']
                    print(f'    ✓ Captions: {caption_track.get("name", "unknown")} ({ext})', file=sys.stderr)

                    # Download captions
                    caption_content = extractor.download_captions(video_id, caption_track)

                    # Parse captions
                    caption_text = extractor.parse_captions(ext, caption_content)
                    print(f'    ✓ Transcript extracted ({len(caption_text)} chars)', file=sys.stderr)
                    total_success += 1
                else:
                    print(f'    ✓ Transcript exists, fetching metadata only', file=sys.stderr)

                # Save video metadata for recipe generation (without caption URLs)
                metadata_file = os.path.join(CACHE_DIR, f'{video_id}.json.gz')
                if not os.path.isfile(metadata_file):
                    metadata_for_recipes = {
                        'id': video_info.get('id'),
                        'title': video_info.get('title'),
                        'fulltitle': video_info.get('fulltitle'),
                        'description': video_info.get('description'),
                        'upload_date': video_info.get('upload_date'),
                        'duration': video_info.get('duration'),
                        'channel': video_info.get('channel'),
                        'channel_id': video_info.get('channel_id'),
                    }
                    with gzip.open(metadata_file, 'wt', encoding='utf-8') as f:
                        json.dump(metadata_for_recipes, f, indent=2)
                    print(f'    ✓ Metadata saved', file=sys.stderr)

                # Add delay between videos
                if i < len(videos) or channel_idx < len(channels_to_process):
                    time.sleep(args.delay)

            except Exception as e:
                print(f'    ✗ Error: {str(e)}', file=sys.stderr)
                total_errors += 1
                time.sleep(args.delay)

        print('', file=sys.stderr)

    # Print final summary
    print('=' * 60, file=sys.stderr)
    print('FINAL SUMMARY', file=sys.stderr)
    print('=' * 60, file=sys.stderr)
    print(f'Channels processed: {len(channels_to_process)}', file=sys.stderr)
    print(f'Transcripts extracted: {total_success}', file=sys.stderr)
    print(f'Already existed: {total_skipped}', file=sys.stderr)
    print(f'Errors: {total_errors}', file=sys.stderr)
    print(f'\nTranscripts saved to: {CACHE_DIR}/*.vtt.gz', file=sys.stderr)

if __name__ == '__main__':
    main()
