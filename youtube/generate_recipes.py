#!/usr/bin/env python3
"""
DEPRECATED: Use the TypeScript version instead:
  npm run pipeline:generate

This Python script is deprecated in favor of the TypeScript version at
pipeline/generate.ts which uses the same AI prompt as the admin viewer.

---

Generate structured recipe JSON files from video transcripts using OpenAI.
"""

import argparse
import gzip
import json
import os
import re
import sys
import time
from typing import Optional, Dict, List
import dotenv
from openai import OpenAI
import snowballstemmer
from rapidfuzz import fuzz
from extract_video import VideoExtractor

# Initialize stemmer
stemmer = snowballstemmer.stemmer('english')

# Common words to skip - too generic to be useful as search keywords
STOPWORDS = {
    # Generic verbs that match too broadly
    'form', 'place', 'put', 'add', 'make', 'take', 'get', 'use', 'set',
    'turn', 'let', 'give', 'keep', 'bring', 'start', 'try', 'want',
    # Common cooking terms that are too vague without context
    'top', 'side', 'bit', 'way', 'time', 'thing', 'part', 'end',
}

# Load environment variables
dotenv.load_dotenv()

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(SCRIPT_DIR, '..', 'data', 'youtube-cache')
RECIPES_DIR = os.path.join(CACHE_DIR, 'recipes')


def normalize_text(text: str) -> str:
    """Normalize text for searching: lowercase, remove punctuation, stem words."""
    # Lowercase
    text = text.lower()
    # Remove punctuation but keep spaces
    text = re.sub(r'[^\w\s]', ' ', text)
    # Stem each word
    words = text.split()
    stemmed = stemmer.stemWords(words)
    return ' '.join(stemmed)


def stem_keyword(keyword: str) -> str:
    """Stem a single keyword for matching."""
    words = keyword.lower().split()
    stemmed = stemmer.stemWords(words)
    return ' '.join(stemmed)


def parse_vtt_cues(vtt_content: str) -> List[Dict]:
    """
    Parse VTT content into a list of cues with timestamps and text.

    Returns list of: {"start_seconds": float, "text": str, "raw_text": str}
    """
    cues = []
    lines = vtt_content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Look for timestamp line (e.g., "00:00:05.279 --> 00:00:07.030")
        timestamp_match = re.match(r'(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})', line)
        if timestamp_match:
            start_time = timestamp_match.group(1)
            # Convert to seconds
            parts = start_time.split(':')
            start_seconds = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])

            # Get the text lines following the timestamp
            i += 1
            text_lines = []
            while i < len(lines) and lines[i].strip() and not re.match(r'\d{2}:\d{2}:\d{2}\.\d{3}', lines[i].strip()):
                text_lines.append(lines[i].strip())
                i += 1

            if text_lines:
                raw_text = ' '.join(text_lines)
                # Remove VTT formatting tags like <00:00:00.480><c>word</c>
                clean_text = re.sub(r'<[^>]+>', '', raw_text)
                clean_text = ' '.join(clean_text.split())  # Normalize whitespace

                if clean_text:
                    cues.append({
                        'start_seconds': start_seconds,
                        'text': clean_text,
                        'normalized': normalize_text(clean_text)
                    })
        else:
            i += 1

    return cues


def search_vtt_for_keywords(vtt_content: str, keywords: List[str], fuzzy_threshold: int = 80) -> List[Dict]:
    """
    Search VTT transcript for keywords and return matches with timestamps and context.

    Args:
        vtt_content: Raw VTT file content
        keywords: List of keywords to search for
        fuzzy_threshold: Minimum fuzzy match score (0-100)

    Returns:
        List of matches: {"keyword": str, "timestamp_seconds": int, "context": str}
    """
    cues = parse_vtt_cues(vtt_content)
    matches = []

    # Track seen timestamps per keyword to deduplicate (within 3 second window)
    seen_timestamps = {}  # keyword -> list of timestamps

    for keyword in keywords:
        # Skip stopwords
        if keyword.lower() in STOPWORDS:
            continue

        stemmed_keyword = stem_keyword(keyword)
        keyword_words = stemmed_keyword.split()
        keyword_lower = keyword.lower()

        if keyword_lower not in seen_timestamps:
            seen_timestamps[keyword_lower] = []

        for i, cue in enumerate(cues):
            # Check if keyword appears in this cue
            found = False

            # First try exact stem match
            if len(keyword_words) == 1:
                # Single word - check if stem is in normalized text
                cue_words = cue['normalized'].split()
                for cue_word in cue_words:
                    if cue_word == stemmed_keyword:
                        found = True
                        break
                    # Also try fuzzy match on individual words
                    if fuzz.ratio(cue_word, stemmed_keyword) >= fuzzy_threshold:
                        found = True
                        break
            else:
                # Multi-word keyword - check if phrase appears
                if stemmed_keyword in cue['normalized']:
                    found = True
                else:
                    # Try fuzzy match on the whole phrase
                    if fuzz.partial_ratio(stemmed_keyword, cue['normalized']) >= fuzzy_threshold:
                        found = True

            if found:
                timestamp = int(cue['start_seconds'])

                # Deduplicate: skip if we already have a match within 3 seconds
                is_duplicate = any(
                    abs(timestamp - seen_ts) <= 3
                    for seen_ts in seen_timestamps[keyword_lower]
                )
                if is_duplicate:
                    continue

                seen_timestamps[keyword_lower].append(timestamp)

                # Build context from surrounding cues
                context_parts = []
                if i > 0:
                    context_parts.append(cues[i-1]['text'])
                context_parts.append(cue['text'])
                if i < len(cues) - 1:
                    context_parts.append(cues[i+1]['text'])

                context = ' '.join(context_parts)
                # Trim to ~50 chars around the keyword location if too long
                if len(context) > 100:
                    # Find keyword in context and extract surrounding text
                    idx = context.lower().find(keyword_lower)
                    if idx == -1:
                        # Keyword not found literally, just take first 100 chars
                        context = context[:100] + '...'
                    else:
                        start = max(0, idx - 40)
                        end = min(len(context), idx + len(keyword) + 40)
                        context = ('...' if start > 0 else '') + context[start:end] + ('...' if end < len(context) else '')

                matches.append({
                    'keyword': keyword,
                    'timestamp_seconds': timestamp,
                    'context': context
                })

    # Sort by timestamp
    matches.sort(key=lambda x: x['timestamp_seconds'])

    return matches


def ensure_recipes_dir():
    """Create recipes directory if it doesn't exist"""
    if not os.path.exists(RECIPES_DIR):
        os.makedirs(RECIPES_DIR, exist_ok=True)

def get_transcript_files():
    """Get list of all video IDs with transcripts (VTT or Lambda format)"""
    video_ids = set()
    for filename in os.listdir(CACHE_DIR):
        # Old format: separate .vtt.gz files
        if filename.endswith('.vtt.gz'):
            video_id = filename.replace('.vtt.gz', '')
            video_ids.add(video_id)
        # Lambda format: .json.gz with embedded transcript
        elif filename.endswith('.json.gz') and not filename.startswith('channel_'):
            video_id = filename.replace('.json.gz', '')
            # YouTube video IDs are 11 characters
            if len(video_id) == 11:
                # Check if it has embedded transcript
                try:
                    with gzip.open(os.path.join(CACHE_DIR, filename), 'rt', encoding='utf-8') as f:
                        data = json.load(f)
                        if data.get('transcript'):
                            video_ids.add(video_id)
                except:
                    pass
    return sorted(video_ids)

def load_video_metadata(video_id: str) -> Optional[Dict]:
    """Load video metadata from cache (handles both old and Lambda formats)"""
    metadata_file = os.path.join(CACHE_DIR, f'{video_id}.json.gz')

    if not os.path.isfile(metadata_file):
        print(f'  ⚠ No metadata file found for {video_id}', file=sys.stderr)
        return None

    try:
        with gzip.open(metadata_file, 'rt', encoding='utf-8') as f:
            data = json.load(f)
            # Lambda format: metadata nested under 'metadata' key
            if 'metadata' in data and isinstance(data['metadata'], dict):
                return data['metadata']
            # Old format: metadata at root
            return data
    except Exception as e:
        print(f'  ✗ Error loading metadata: {e}', file=sys.stderr)
        return None

def load_raw_vtt(video_id: str) -> Optional[str]:
    """Load raw VTT content from file (handles both VTT and Lambda formats)"""
    vtt_file = os.path.join(CACHE_DIR, f'{video_id}.vtt.gz')

    # Try loading from .vtt.gz file first
    if os.path.isfile(vtt_file):
        try:
            with gzip.open(vtt_file, 'rt', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f'  ✗ Error loading VTT: {e}', file=sys.stderr)

    # Try loading from Lambda format (embedded in .json.gz)
    json_file = os.path.join(CACHE_DIR, f'{video_id}.json.gz')
    if os.path.isfile(json_file):
        try:
            with gzip.open(json_file, 'rt', encoding='utf-8') as f:
                data = json.load(f)
                # Lambda format stores segments for VTT-like searching
                if data.get('transcript', {}).get('segments'):
                    # Convert segments to VTT format for keyword search
                    segments = data['transcript']['segments']
                    vtt_lines = ['WEBVTT', '']
                    for seg in segments:
                        start = seg.get('startTime', 0)
                        end = seg.get('endTime', start + 1)
                        text = seg.get('text', '')
                        # Format timestamps as HH:MM:SS.mmm
                        start_ts = f"{int(start//3600):02d}:{int((start%3600)//60):02d}:{start%60:06.3f}"
                        end_ts = f"{int(end//3600):02d}:{int((end%3600)//60):02d}:{end%60:06.3f}"
                        vtt_lines.append(f"{start_ts} --> {end_ts}")
                        vtt_lines.append(text)
                        vtt_lines.append('')
                    return '\n'.join(vtt_lines)
        except Exception as e:
            print(f'  ✗ Error loading VTT from JSON: {e}', file=sys.stderr)

    return None


def parse_transcript_text(video_id: str) -> Optional[str]:
    """Parse transcript to plain text (handles both VTT and Lambda formats)"""

    # First try Lambda format which already has plainText
    json_file = os.path.join(CACHE_DIR, f'{video_id}.json.gz')
    if os.path.isfile(json_file):
        try:
            with gzip.open(json_file, 'rt', encoding='utf-8') as f:
                data = json.load(f)
                if data.get('transcript', {}).get('plainText'):
                    return data['transcript']['plainText']
        except Exception as e:
            print(f'  ✗ Error loading plainText from JSON: {e}', file=sys.stderr)

    # Fall back to VTT parsing
    vtt_content = load_raw_vtt(video_id)

    if not vtt_content:
        print(f'  ✗ Transcript file not found', file=sys.stderr)
        return None

    try:
        # Parse using VideoExtractor
        extractor = VideoExtractor()
        text = extractor.parse_captions('vtt', vtt_content)

        return text
    except Exception as e:
        print(f'  ✗ Error parsing transcript: {e}', file=sys.stderr)
        return None


def add_video_references(recipe: Dict, vtt_content: str) -> Dict:
    """
    Post-process recipe to add video_references based on keyword search.

    For each instruction step, search the VTT for keywords and add
    video_references array with matches.
    """
    instructions = recipe.get('instructions', [])

    for instruction in instructions:
        keywords_obj = instruction.get('keywords', {})

        # Collect all keywords from ingredients, techniques, equipment
        all_keywords = []
        all_keywords.extend(keywords_obj.get('ingredients', []))
        all_keywords.extend(keywords_obj.get('techniques', []))
        all_keywords.extend(keywords_obj.get('equipment', []))

        if all_keywords:
            # Search VTT for these keywords
            matches = search_vtt_for_keywords(vtt_content, all_keywords)
            instruction['video_references'] = matches
        else:
            instruction['video_references'] = []

    return recipe


def predict_step_times(instructions: List[Dict], video_duration: int) -> List[Dict]:
    """
    Predict start/end times for each instruction step based on video references.

    Algorithm (technique-first, no overlap):
    1. First pass: Calculate raw start times (prefer technique refs)
    2. Second pass: Interpolate missing times
    3. Third pass: Enforce sequential order, no overlap
    4. Ensure minimum 5 second duration per step

    Args:
        instructions: List of instruction dicts with video_references and keywords
        video_duration: Total video duration in seconds

    Returns:
        Instructions with added predicted_time field
    """
    MIN_STEP_DURATION = 5

    # First pass: calculate raw start times
    for instruction in instructions:
        refs = instruction.get('video_references', [])
        techniques = instruction.get('keywords', {}).get('techniques', [])

        raw_start = None

        if refs:
            # Try to find first technique reference
            technique_refs = [
                r for r in refs
                if r['keyword'].lower() in [t.lower() for t in techniques]
            ]

            if technique_refs:
                # Use first technique reference
                raw_start = min(r['timestamp_seconds'] for r in technique_refs)
            else:
                # Fall back to minimum timestamp
                raw_start = min(r['timestamp_seconds'] for r in refs)

        instruction['_raw_start'] = raw_start

    # Second pass: interpolate missing times
    # Find first and last known times for bounds
    known_times = [(i, inst['_raw_start']) for i, inst in enumerate(instructions) if inst['_raw_start'] is not None]

    if not known_times:
        # No references at all - distribute evenly across video
        step_duration = video_duration // max(len(instructions), 1)
        for i, instruction in enumerate(instructions):
            instruction['_raw_start'] = i * step_duration
    else:
        # Interpolate missing values
        for i, instruction in enumerate(instructions):
            if instruction['_raw_start'] is None:
                # Find nearest known times before and after
                prev_known = None
                next_known = None

                for idx, time in known_times:
                    if idx < i:
                        prev_known = (idx, time)
                    elif idx > i and next_known is None:
                        next_known = (idx, time)
                        break

                if prev_known and next_known:
                    # Linear interpolation
                    prev_idx, prev_time = prev_known
                    next_idx, next_time = next_known
                    ratio = (i - prev_idx) / (next_idx - prev_idx)
                    instruction['_raw_start'] = int(prev_time + ratio * (next_time - prev_time))
                elif prev_known:
                    # Extrapolate forward
                    prev_idx, prev_time = prev_known
                    # Estimate step duration from average
                    avg_duration = video_duration // len(instructions)
                    instruction['_raw_start'] = min(prev_time + avg_duration * (i - prev_idx), video_duration - MIN_STEP_DURATION)
                elif next_known:
                    # Extrapolate backward
                    next_idx, next_time = next_known
                    avg_duration = video_duration // len(instructions)
                    instruction['_raw_start'] = max(next_time - avg_duration * (next_idx - i), 0)

    # Third pass: enforce sequential order, no overlap
    # Sort by step number (they should already be in order)
    instructions.sort(key=lambda x: x.get('step', 0))

    for i, instruction in enumerate(instructions):
        # Ensure start is not before previous step's end
        if i > 0:
            prev_end = instructions[i-1].get('predicted_time', {}).get('end_seconds', 0)
            start = max(instruction['_raw_start'], prev_end)
        else:
            start = max(instruction['_raw_start'], 0)

        # Determine end time
        if i < len(instructions) - 1:
            # Next step's raw start, but ensure minimum duration
            next_start = instructions[i+1].get('_raw_start', video_duration)
            end = max(next_start, start + MIN_STEP_DURATION)
        else:
            # Last step - use video duration
            end = video_duration

        # Ensure minimum duration
        if end - start < MIN_STEP_DURATION:
            end = min(start + MIN_STEP_DURATION, video_duration)

        instruction['predicted_time'] = {
            'start_seconds': int(start),
            'end_seconds': int(end)
        }

    # Clean up temporary field
    for instruction in instructions:
        if '_raw_start' in instruction:
            del instruction['_raw_start']

    return instructions


def extract_recipe_with_ai(video_metadata: Dict, transcript_text: str, client: OpenAI) -> Optional[Dict]:
    """Use OpenAI to extract structured recipe from transcript"""

    video_id = video_metadata.get('id')
    title = video_metadata.get('fulltitle', 'Unknown')
    description = video_metadata.get('description', '')
    video_url = video_metadata.get('webpage_url', '')
    upload_date = video_metadata.get('upload_date', '')
    duration = video_metadata.get('duration', 0)

    # Create structured prompt
    prompt = f"""Extract a structured recipe from this cooking video transcript.

Video Title: {title}
Video URL: {video_url}
Upload Date: {upload_date}
Description: {description[:200]}

Please analyze the transcript and extract:
1. Recipe title (use video title if appropriate, or extract the dish name)
2. Complete ingredient list with quantities and units
3. Step-by-step instructions with keywords for each step
4. Prep time, cook time, total time (estimate from video)
5. Servings/yield
6. Tags (cuisine type, meal type, dietary restrictions, etc.)
7. Difficulty level (easy/medium/hard)
8. Required equipment

For each instruction step, identify keywords that would help find that step in the video:
- ingredients: ingredient names referenced in that step
- techniques: cooking techniques used (e.g., sear, fold, whisk, chop, simmer)
- equipment: equipment used in that step

If this video does NOT contain a recipe (e.g., it's an interview, Q&A, or non-cooking content), respond with {{"has_recipe": false}}.

Return ONLY a valid JSON object with this exact structure (use snake_case for all keys):
{{
  "has_recipe": true,
  "title": "Recipe Name",
  "description": "Brief description of the dish",
  "video_id": "{video_id}",
  "video_url": "{video_url}",
  "upload_date": "{upload_date}",
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "total_time_minutes": 45,
  "servings": 4,
  "yield": "4 servings",
  "difficulty": "medium",
  "cuisine_type": ["american", "comfort food"],
  "meal_type": ["dinner", "main course"],
  "dietary_tags": ["can be vegetarian", "gluten-free option"],
  "ingredients": [
    {{
      "item": "ingredient name",
      "quantity": "2",
      "unit": "cups",
      "notes": "optional preparation notes"
    }}
  ],
  "instructions": [
    {{
      "step": 1,
      "text": "Detailed instruction text",
      "keywords": {{
        "ingredients": ["ingredient1", "ingredient2"],
        "techniques": ["sear", "fold"],
        "equipment": ["skillet"]
      }}
    }}
  ],
  "equipment": ["skillet", "mixing bowl", "whisk"],
  "tags": ["quick", "weeknight", "family-friendly"],
  "tips": ["Optional cooking tips or variations"]
}}

Transcript:
{transcript_text}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert recipe extractor. Extract structured recipe data from cooking video transcripts. Always use snake_case for JSON keys per the project's JSON naming convention."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        recipe_json = json.loads(response.choices[0].message.content)

        # Check if video has a recipe
        if not recipe_json.get('has_recipe', True):
            return None

        return recipe_json

    except Exception as e:
        print(f'  ✗ OpenAI API error: {e}', file=sys.stderr)
        return None

def save_recipe(video_id: str, recipe_data: Dict):
    """Save recipe JSON to file"""
    recipe_file = os.path.join(RECIPES_DIR, f'{video_id}_recipe.json')

    try:
        with open(recipe_file, 'w', encoding='utf-8') as f:
            json.dump(recipe_data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f'  ✗ Error saving recipe: {e}', file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(
        description='Generate recipes from video transcripts using AI'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Limit number of videos to process (for testing)'
    )
    parser.add_argument(
        '--skip-existing',
        action='store_true',
        help='Skip videos that already have recipe files'
    )
    parser.add_argument(
        '--channel',
        type=str,
        help='Filter by channel name (partial match)'
    )

    args = parser.parse_args()

    # Initialize
    ensure_recipes_dir()
    client = OpenAI()

    # Get all transcript files
    video_ids = get_transcript_files()

    # Filter by channel if specified
    if args.channel:
        print(f'Filtering by channel: {args.channel}', file=sys.stderr)
        filtered_ids = []
        for video_id in video_ids:
            metadata = load_video_metadata(video_id)
            if metadata:
                channel = metadata.get('channel', '')
                if args.channel.lower() in channel.lower():
                    filtered_ids.append(video_id)
        video_ids = filtered_ids
        print(f'Found {len(video_ids)} videos from channel matching "{args.channel}"', file=sys.stderr)

    if args.limit:
        video_ids = video_ids[:args.limit]

    print(f'Found {len(video_ids)} transcripts to process', file=sys.stderr)
    print('', file=sys.stderr)

    # Process each video
    success_count = 0
    no_recipe_count = 0
    error_count = 0
    skipped_count = 0

    for i, video_id in enumerate(video_ids, 1):
        recipe_file = os.path.join(RECIPES_DIR, f'{video_id}_recipe.json')

        # Skip if recipe already exists
        if args.skip_existing and os.path.isfile(recipe_file):
            print(f'[{i}/{len(video_ids)}] {video_id}', file=sys.stderr)
            print(f'  ⊙ Recipe already exists, skipping', file=sys.stderr)
            skipped_count += 1
            continue

        print(f'[{i}/{len(video_ids)}] {video_id}', file=sys.stderr)

        # Load video metadata
        metadata = load_video_metadata(video_id)
        if not metadata:
            error_count += 1
            continue

        title = metadata.get('fulltitle', 'Unknown')[:60]
        print(f'  Title: {title}', file=sys.stderr)

        # Parse transcript
        transcript = parse_transcript_text(video_id)
        if not transcript:
            error_count += 1
            continue

        print(f'  ✓ Transcript loaded ({len(transcript)} chars)', file=sys.stderr)

        # Extract recipe with AI
        print(f'  → Extracting recipe with OpenAI...', file=sys.stderr)
        recipe = extract_recipe_with_ai(metadata, transcript, client)

        if recipe is None:
            print(f'  ⊘ No recipe found in this video', file=sys.stderr)
            no_recipe_count += 1
            continue

        # Post-process: search VTT for keywords and add video_references
        print(f'  → Searching transcript for keywords...', file=sys.stderr)
        vtt_content = load_raw_vtt(video_id)
        if vtt_content:
            recipe = add_video_references(recipe, vtt_content)
            # Count total video references found
            total_refs = sum(len(inst.get('video_references', [])) for inst in recipe.get('instructions', []))
            print(f'  ✓ Found {total_refs} video references', file=sys.stderr)

            # Predict step start/end times
            print(f'  → Predicting step times...', file=sys.stderr)
            video_duration = metadata.get('duration', 0)
            if video_duration and recipe.get('instructions'):
                recipe['instructions'] = predict_step_times(recipe['instructions'], video_duration)
                print(f'  ✓ Predicted times for {len(recipe["instructions"])} steps', file=sys.stderr)

        # Save recipe
        if save_recipe(video_id, recipe):
            print(f'  ✓ Recipe saved: {recipe.get("title", "Unknown")}', file=sys.stderr)
            success_count += 1
        else:
            error_count += 1

        # Small delay to avoid rate limiting
        if i < len(video_ids):
            time.sleep(1)

        print('', file=sys.stderr)

    # Print summary
    print('='*60, file=sys.stderr)
    print('SUMMARY', file=sys.stderr)
    print('='*60, file=sys.stderr)
    print(f'Total videos processed: {len(video_ids)}', file=sys.stderr)
    print(f'Recipes generated: {success_count}', file=sys.stderr)
    print(f'No recipe content: {no_recipe_count}', file=sys.stderr)
    print(f'Skipped (existing): {skipped_count}', file=sys.stderr)
    print(f'Errors: {error_count}', file=sys.stderr)
    print(f'\nRecipes saved to: {RECIPES_DIR}/', file=sys.stderr)

if __name__ == '__main__':
    main()
