#!/usr/bin/env python3
"""
Batch extract transcripts for videos from a channel, filtered by date.
"""

import argparse
import gzip
import json
import os
import sys
import time
from datetime import datetime, timedelta
from extract_video import VideoExtractor, Summarizer

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(SCRIPT_DIR, '..', 'data', 'youtube-cache')

def get_channel_videos(channel_handle: str, days_back: int = 180, all_videos: bool = False):
    """
    Get video IDs from cached channel data, optionally filtered by upload date.

    Args:
        channel_handle: Channel handle (e.g., 'JKenjiLopezAlt')
        days_back: Number of days to look back (default: 180 = 6 months)
        all_videos: If True, return all videos regardless of date

    Returns:
        List of (video_id, upload_date, title) tuples
    """
    cache_file = os.path.join(CACHE_DIR, f'channel_{channel_handle}.json.gz')

    if not os.path.isfile(cache_file):
        print(f'Error: Channel cache not found at {cache_file}', file=sys.stderr)
        print(f'Run: python fetch_youtube_metadata.py transcript --channel-url https://www.youtube.com/@{channel_handle}', file=sys.stderr)
        return []

    # Load cached channel data
    with gzip.open(cache_file, 'rt', encoding='utf-8') as f:
        channel_data = json.load(f)

    # Calculate cutoff date (only used if not all_videos)
    cutoff_date = datetime.now() - timedelta(days=days_back)
    cutoff_str = cutoff_date.strftime('%Y%m%d')

    # Extract video entries
    entries = channel_data.get('entries', [])

    # Filter by date and extract video info
    videos = []
    for entry in entries:
        if not entry or not entry.get('id'):
            continue

        upload_date = entry.get('upload_date', '')

        # Filter by date (skip if --all flag is set)
        if all_videos or upload_date >= cutoff_str:
            videos.append((
                entry.get('id'),
                upload_date,
                entry.get('title', 'Unknown')
            ))

    # Sort by upload date (newest first)
    videos.sort(key=lambda x: x[1], reverse=True)

    if all_videos:
        print(f'Found {len(videos)} total videos', file=sys.stderr)
    else:
        print(f'Found {len(videos)} videos from last {days_back} days (since {cutoff_str})', file=sys.stderr)

    return videos

def main():
    parser = argparse.ArgumentParser(
        description='Batch extract transcripts for channel videos'
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
        help='Extract all videos regardless of upload date'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Limit number of videos to process (for testing)'
    )
    parser.add_argument(
        '--no-summarize',
        action='store_true',
        help='Skip summarization (only extract transcripts)'
    )
    parser.add_argument(
        '--lambda',
        action='store_true',
        dest='use_lambda',
        help='Use AWS Lambda for extraction instead of direct scraping'
    )
    parser.add_argument(
        '--parallel',
        type=int,
        default=10,
        help='Number of parallel Lambda invocations (default: 10)'
    )

    args = parser.parse_args()

    # Get videos from channel
    videos = get_channel_videos(args.channel, args.days, all_videos=args.all)

    if not videos:
        print('No videos found matching criteria', file=sys.stderr)
        return

    # Apply limit if specified
    if args.limit:
        videos = videos[:args.limit]
        print(f'Limited to {len(videos)} videos', file=sys.stderr)

    # Process each video
    success_count = 0
    error_count = 0

    # Use Lambda extraction if requested
    if args.use_lambda:
        from extract_video import LambdaExtractor
        from concurrent.futures import ThreadPoolExecutor, as_completed

        extractor = LambdaExtractor()
        video_ids = [v[0] for v in videos]

        print(f'Invoking Lambda for {len(video_ids)} videos with {args.parallel} parallel workers...', file=sys.stderr)

        # Parallel invocations
        with ThreadPoolExecutor(max_workers=args.parallel) as executor:
            futures = {
                executor.submit(extractor.extract_video, vid): vid
                for vid in video_ids
            }

            for future in as_completed(futures):
                video_id = futures[future]
                try:
                    result = future.result()
                    if result.get('success'):
                        success_count += 1
                        print(f'  ✓ {video_id}', file=sys.stderr)
                    else:
                        error_count += 1
                        error_msg = result.get("message", "Unknown error")
                        error_type = result.get("error", "UNKNOWN")
                        print(f'  ✗ {video_id}: [{error_type}] {error_msg}', file=sys.stderr)

                        # Print detailed extraction log if available
                        extraction_log = result.get("extraction_log")
                        if extraction_log:
                            print(f'    Available languages:', file=sys.stderr)
                            langs = extraction_log.get("available_languages", {})
                            print(f'      Manual: {langs.get("manual_subtitles", [])}', file=sys.stderr)
                            print(f'      Auto: {langs.get("auto_captions", [])}', file=sys.stderr)
                            if extraction_log.get("error_details"):
                                err = extraction_log["error_details"]
                                print(f'    Error: {err.get("type")}: {err.get("message")}', file=sys.stderr)
                            # Print last few steps
                            steps = extraction_log.get("steps", [])[-5:]
                            if steps:
                                print(f'    Last steps:', file=sys.stderr)
                                for step in steps:
                                    print(f'      - {step.get("step")}: {step.get("details", "")}', file=sys.stderr)

                        # Print traceback if available
                        if result.get("traceback"):
                            print(f'    Traceback:', file=sys.stderr)
                            for line in result.get("traceback", "").split('\n')[:10]:
                                print(f'      {line}', file=sys.stderr)
                except Exception as e:
                    error_count += 1
                    print(f'  ✗ {video_id}: {type(e).__name__}: {e}', file=sys.stderr)

        # Sync from S3 to local
        print(f'\nSyncing from S3 to local cache...', file=sys.stderr)
        synced = extractor.sync_from_s3(video_ids)
        print(f'Synced {synced} videos to {CACHE_DIR}', file=sys.stderr)

        # Print summary
        print(f'\n{"="*60}', file=sys.stderr)
        print(f'SUMMARY (Lambda)', file=sys.stderr)
        print(f'{"="*60}', file=sys.stderr)
        print(f'Total videos: {len(videos)}', file=sys.stderr)
        print(f'Success: {success_count}', file=sys.stderr)
        print(f'Errors: {error_count}', file=sys.stderr)
        print(f'Synced to local: {synced}', file=sys.stderr)
        return

    # Initialize extractors for direct YouTube scraping
    extractor = VideoExtractor()
    summarizer = Summarizer() if not args.no_summarize else None

    for i, (video_id, upload_date, title) in enumerate(videos, 1):
        print(f'\n[{i}/{len(videos)}] {upload_date} - {title[:60]}', file=sys.stderr)
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

            # Summarize if requested
            if summarizer:
                summaries = summarizer.summarize(caption_text, video_info)
                print(f'  ✓ Summaries generated', file=sys.stderr)

            success_count += 1

            # Add delay between requests to avoid rate limiting
            if i < len(videos):
                print(f'  ⏱ Waiting 2.5 seconds before next video...', file=sys.stderr)
                time.sleep(2.5)

        except Exception as e:
            print(f'  ✗ Error: {str(e)}', file=sys.stderr)
            error_count += 1
            continue

    # Print summary
    print(f'\n{"="*60}', file=sys.stderr)
    print(f'SUMMARY', file=sys.stderr)
    print(f'{"="*60}', file=sys.stderr)
    print(f'Total videos: {len(videos)}', file=sys.stderr)
    print(f'Success: {success_count}', file=sys.stderr)
    print(f'Errors: {error_count}', file=sys.stderr)
    print(f'\nTranscripts saved to: {CACHE_DIR}/*.vtt.gz', file=sys.stderr)
    if not args.no_summarize:
        print(f'Summaries saved to: {CACHE_DIR}/*.summaries.json.gz', file=sys.stderr)

if __name__ == '__main__':
    main()
