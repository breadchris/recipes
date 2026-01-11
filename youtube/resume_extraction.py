#!/usr/bin/env python3
"""
Resume extraction for videos that failed due to rate limiting.
"""

import gzip
import json
import os
import sys
from datetime import datetime, timedelta
from extract_video import VideoExtractor, Summarizer
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(SCRIPT_DIR, '..', 'data', 'youtube-cache')

def get_missing_videos(channel_handle: str, days_back: int = 180, all_videos: bool = False):
    """
    Get video IDs that don't have transcripts yet.

    Args:
        channel_handle: Channel handle (e.g., 'JKenjiLopezAlt')
        days_back: Number of days to look back (default: 180 = 6 months)
        all_videos: If True, check all videos regardless of date

    Returns:
        List of (video_id, upload_date, title) tuples for missing transcripts
    """
    cache_file = os.path.join(CACHE_DIR, f'channel_{channel_handle}.json.gz')

    if not os.path.isfile(cache_file):
        print(f'Error: Channel cache not found at {cache_file}', file=sys.stderr)
        return []

    # Load cached channel data
    with gzip.open(cache_file, 'rt', encoding='utf-8') as f:
        channel_data = json.load(f)

    # Calculate cutoff date (only used if not all_videos)
    cutoff_date = datetime.now() - timedelta(days=days_back)
    cutoff_str = cutoff_date.strftime('%Y%m%d')

    # Extract video entries
    entries = channel_data.get('entries', [])

    # Find videos without transcripts
    missing = []
    for entry in entries:
        if not entry or not entry.get('id'):
            continue

        video_id = entry.get('id')
        upload_date = entry.get('upload_date', '')

        # Filter by date (skip if --all flag is set)
        if not all_videos and upload_date < cutoff_str:
            continue

        # Check if transcript exists
        transcript_file = os.path.join(CACHE_DIR, f'{video_id}.vtt.gz')
        if not os.path.isfile(transcript_file):
            missing.append((
                video_id,
                upload_date,
                entry.get('title', 'Unknown')
            ))

    # Sort by upload date (oldest first to avoid hitting newest videos)
    missing.sort(key=lambda x: x[1])

    print(f'Found {len(missing)} videos missing transcripts', file=sys.stderr)

    return missing

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Resume extraction for videos that failed'
    )
    parser.add_argument(
        'channel',
        help='Channel handle (e.g., JKenjiLopezAlt)'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=180,
        help='Number of days to look back (default: 180 = 6 months)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Check all videos regardless of upload date'
    )
    parser.add_argument(
        '--delay',
        type=int,
        default=10,
        help='Delay in seconds between videos (default: 10)'
    )

    args = parser.parse_args()

    # Get missing videos
    missing = get_missing_videos(args.channel, args.days, all_videos=args.all)

    if not missing:
        print('No missing videos found!', file=sys.stderr)
        return

    # Initialize extractor
    extractor = VideoExtractor()

    # Process each video with delays
    success_count = 0
    error_count = 0

    for i, (video_id, upload_date, title) in enumerate(missing, 1):
        print(f'\n[{i}/{len(missing)}] {upload_date} - {title[:60]}', file=sys.stderr)
        print(f'  Video ID: {video_id}', file=sys.stderr)

        try:
            # Extract video info
            video_url = f'https://www.youtube.com/watch?v={video_id}'
            video_info = extractor.extract_video_info(video_url)

            if not video_info:
                print(f'  ✗ Failed to extract video info', file=sys.stderr)
                error_count += 1
                continue

            # Get captions
            caption_track = extractor.get_captions_by_priority(video_info)

            if not caption_track:
                print(f'  ✗ No captions available', file=sys.stderr)
                error_count += 1
                continue

            ext = caption_track['ext']
            print(f'  ✓ Using captions: {caption_track.get("name", "unknown")} ({ext})', file=sys.stderr)

            # Download captions
            caption_content = extractor.download_captions(video_id, caption_track)

            # Parse captions
            caption_text = extractor.parse_captions(ext, caption_content)
            print(f'  ✓ Transcript extracted ({len(caption_text)} chars)', file=sys.stderr)

            success_count += 1

            # Add delay between videos to avoid rate limiting
            if i < len(missing):
                print(f'  ⏸  Sleeping {args.delay}s to avoid rate limiting...', file=sys.stderr)
                time.sleep(args.delay)

        except Exception as e:
            print(f'  ✗ Error: {str(e)}', file=sys.stderr)
            error_count += 1

            # Add delay even on error
            if i < len(missing):
                print(f'  ⏸  Sleeping {args.delay}s before retry...', file=sys.stderr)
                time.sleep(args.delay)

    # Print summary
    print(f'\n{"="*60}', file=sys.stderr)
    print(f'SUMMARY', file=sys.stderr)
    print(f'{"="*60}', file=sys.stderr)
    print(f'Total missing: {len(missing)}', file=sys.stderr)
    print(f'Success: {success_count}', file=sys.stderr)
    print(f'Errors: {error_count}', file=sys.stderr)
    print(f'\nTranscripts saved to: {CACHE_DIR}/*.vtt.gz', file=sys.stderr)

if __name__ == '__main__':
    main()
