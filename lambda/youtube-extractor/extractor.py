"""
VideoExtractor class ported from youtube/extract_video.py for Lambda.

Key changes from original:
- Removed local file caching (using S3 in handler instead)
- Removed Summarizer class (not needed for metadata/transcript extraction)
- Added structured response format
- Added proxy support for avoiding YouTube rate limits
"""

import os
import re
import time
import logging
import traceback
from typing import Dict, Optional, Tuple, List

import yt_dlp
from yt_dlp.utils import YoutubeDLError
import requests
import webvtt

# Configure module logger
logger = logging.getLogger(__name__)


class ExtractionLog:
    """Collect detailed logs during extraction for debugging."""

    def __init__(self):
        self.steps = []
        self.yt_dlp_logs = []
        self.available_languages = {}
        self.error_details = None

    def add_step(self, step: str, details: str = None):
        entry = {"step": step}
        if details:
            entry["details"] = details
        self.steps.append(entry)
        logger.info(f"[STEP] {step}: {details or ''}")

    def add_ytdlp_log(self, msg: str):
        self.yt_dlp_logs.append(msg)
        logger.debug(f"[YT-DLP] {msg}")

    def set_available_languages(self, subtitles: Dict, auto_captions: Dict):
        self.available_languages = {
            "manual_subtitles": list(subtitles.keys()) if subtitles else [],
            "auto_captions": list(auto_captions.keys()) if auto_captions else [],
        }
        logger.info(f"[LANGUAGES] Manual: {self.available_languages['manual_subtitles']}")
        logger.info(f"[LANGUAGES] Auto: {self.available_languages['auto_captions']}")

    def set_error(self, error: Exception):
        self.error_details = {
            "type": type(error).__name__,
            "message": str(error),
            "traceback": traceback.format_exc(),
        }
        logger.error(f"[ERROR] {type(error).__name__}: {error}")
        logger.error(f"[TRACEBACK] {traceback.format_exc()}")

    def to_dict(self) -> Dict:
        return {
            "steps": self.steps,
            "yt_dlp_logs": self.yt_dlp_logs[-50:],  # Last 50 logs
            "available_languages": self.available_languages,
            "error_details": self.error_details,
        }


class YTDLPLogger:
    """Custom logger for yt-dlp to capture all output."""

    def __init__(self, extraction_log: ExtractionLog):
        self.extraction_log = extraction_log

    def debug(self, msg):
        if msg.startswith('[debug]'):
            self.extraction_log.add_ytdlp_log(f"DEBUG: {msg}")
        else:
            self.extraction_log.add_ytdlp_log(msg)

    def info(self, msg):
        self.extraction_log.add_ytdlp_log(f"INFO: {msg}")

    def warning(self, msg):
        self.extraction_log.add_ytdlp_log(f"WARNING: {msg}")

    def error(self, msg):
        self.extraction_log.add_ytdlp_log(f"ERROR: {msg}")


def validate_youtube_url(url: str) -> bool:
    """Validate that URL is a YouTube video."""
    try:
        yt_dlp.extractor.youtube.YoutubeIE.extract_id(url)
        return True
    except YoutubeDLError:
        return False


class VideoExtractor:
    """Extract YouTube video metadata and transcripts."""

    def __init__(
        self,
        cookies_file: Optional[str] = None,
        proxy: Optional[str] = None,
        verbose: bool = True,
    ):
        self.proxy = proxy  # Store proxy for use in requests
        self.extraction_log = ExtractionLog()

        # Create custom logger for yt-dlp
        self.ytdlp_logger = YTDLPLogger(self.extraction_log)

        self.ydl_opts = {
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": ["en", "en-US", "en-CA", "en-GB", "en-AU"],
            "skip_download": True,
            "no-playlist": True,
            "sleep_interval": 1,
            "max_sleep_interval": 3,
            "sleep_interval_requests": 0.5,
            # Verbose logging
            "quiet": not verbose,
            "no_warnings": not verbose,
            "verbose": verbose,
            "logger": self.ytdlp_logger,
        }

        self.extraction_log.add_step("init", f"verbose={verbose}, proxy={'yes' if proxy else 'no'}")

        # Add cookies if provided
        if cookies_file and os.path.exists(cookies_file):
            self.ydl_opts["cookiefile"] = cookies_file
            self.extraction_log.add_step("cookies", f"Using cookies file: {cookies_file}")
        else:
            self.extraction_log.add_step("cookies", "No cookies file")

        # Add proxy if provided (format: http://user:pass@host:port)
        if proxy:
            self.ydl_opts["proxy"] = proxy
            # Mask password in log
            masked_proxy = re.sub(r':[^:@]+@', ':***@', proxy) if '@' in proxy else proxy
            self.extraction_log.add_step("proxy", f"Using proxy: {masked_proxy}")

    def get_captions_by_priority(self, info: Dict) -> Optional[Dict]:
        """
        Get captions based on priority order:
        1. Manual subtitles (en-US, en-CA, en-*)
        2. Automatic captions (en-orig, en-US, en-CA, en)

        Returns caption dict with fields: ext, url, name
        """
        subtitle_priorities = ["en-US", "en-CA", "en", "en-GB", "en-AU"]
        auto_caption_priorities = ["en-orig", "en-US", "en-CA", "en", "en-GB", "en-AU"]
        format_priorities = ["vtt", "srt", "ttml"]

        # Log available languages
        self.extraction_log.set_available_languages(
            info.get("subtitles", {}),
            info.get("automatic_captions", {}),
        )

        caption_track = None
        selected_lang = None
        caption_source = None

        # Check manual subtitles first
        if info.get("subtitles"):
            self.extraction_log.add_step("check_manual_subtitles", f"Available: {list(info['subtitles'].keys())}")
            for lang in subtitle_priorities:
                if lang in info["subtitles"]:
                    caption_track = info["subtitles"][lang]
                    selected_lang = lang
                    caption_source = "manual"
                    self.extraction_log.add_step("found_manual_subtitle", f"Language: {lang}")
                    break
            else:
                # Try any en-* variant
                for lang in info["subtitles"].keys():
                    if lang.startswith("en-") or lang.startswith("en_"):
                        caption_track = info["subtitles"][lang]
                        selected_lang = lang
                        caption_source = "manual"
                        self.extraction_log.add_step("found_manual_subtitle_fallback", f"Language: {lang}")
                        break
        else:
            self.extraction_log.add_step("check_manual_subtitles", "None available")

        # Check automatic captions
        if not caption_track and info.get("automatic_captions"):
            self.extraction_log.add_step("check_auto_captions", f"Available: {list(info['automatic_captions'].keys())}")
            for lang in auto_caption_priorities:
                if lang in info["automatic_captions"]:
                    caption_track = info["automatic_captions"][lang]
                    selected_lang = lang
                    caption_source = "auto"
                    self.extraction_log.add_step("found_auto_caption", f"Language: {lang}")
                    break
            else:
                # Try any en-* variant
                for lang in info["automatic_captions"].keys():
                    if lang.startswith("en-") or lang.startswith("en_"):
                        caption_track = info["automatic_captions"][lang]
                        selected_lang = lang
                        caption_source = "auto"
                        self.extraction_log.add_step("found_auto_caption_fallback", f"Language: {lang}")
                        break
        elif not caption_track:
            self.extraction_log.add_step("check_auto_captions", "None available")

        if not caption_track:
            self.extraction_log.add_step("no_captions_found", "No English captions available")
            return None

        # Find preferred format
        self.extraction_log.add_step("find_format", f"Looking for formats in caption track, source={caption_source}, lang={selected_lang}")
        for fmt in format_priorities:
            for track in caption_track:
                if track.get("protocol") == "m3u8_native":
                    continue
                if track.get("ext") == fmt:
                    self.extraction_log.add_step("selected_format", f"Format: {fmt}, URL: {track.get('url', '')[:100]}...")
                    return track

        self.extraction_log.add_step("no_format_found", f"No suitable format found in track")
        return None

    def download_captions(self, caption_obj: Dict) -> str:
        """Download caption content with retry logic for rate limiting."""
        url = caption_obj["url"]
        max_retries = 3
        retry_delay = 5

        self.extraction_log.add_step("download_captions_start", f"URL: {url[:100]}...")

        # Build proxies dict for requests if proxy is configured
        proxies = None
        if self.proxy:
            proxies = {"http": self.proxy, "https": self.proxy}
            self.extraction_log.add_step("download_using_proxy", "Proxy configured for caption download")

        for attempt in range(max_retries):
            try:
                self.extraction_log.add_step("download_attempt", f"Attempt {attempt + 1}/{max_retries}")
                response = requests.get(url, timeout=30, proxies=proxies)
                response.raise_for_status()
                self.extraction_log.add_step("download_success", f"Downloaded {len(response.text)} chars")
                return response.text
            except requests.exceptions.HTTPError as e:
                self.extraction_log.add_step("download_http_error", f"Status: {e.response.status_code}, Attempt: {attempt + 1}")
                if e.response.status_code == 429:
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (2**attempt)
                        self.extraction_log.add_step("download_rate_limited", f"Waiting {wait_time}s before retry")
                        time.sleep(wait_time)
                        continue
                self.extraction_log.set_error(e)
                raise
            except Exception as e:
                self.extraction_log.add_step("download_error", f"Error: {type(e).__name__}: {e}")
                self.extraction_log.set_error(e)
                raise

        raise Exception("Failed to download captions after retries")

    def _timestamp_to_seconds(self, timestamp: str) -> float:
        """Convert WebVTT timestamp to seconds."""
        parts = timestamp.split(":")
        hours = float(parts[0])
        minutes = float(parts[1])
        seconds = float(parts[2])
        return hours * 3600 + minutes * 60 + seconds

    def _seconds_to_timestamp(self, total_seconds: float) -> str:
        """Convert seconds to WebVTT timestamp."""
        hours = int(total_seconds // 3600)
        remaining = total_seconds % 3600
        minutes = int(remaining // 60)
        seconds = remaining % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}"

    def _ts_to_secs(self, timestamp):
        """Convert webvtt Caption timestamp to seconds."""
        return timestamp.in_seconds() + (timestamp.milliseconds / 1000)

    def _dedupe_yt_captions(self, subs_iter):
        """
        Deduplicate YouTube's overlapping auto-captions.
        Adapted from https://github.com/bindestriche/srt_fix
        """
        previous_subtitle = None

        for subtitle in subs_iter:
            if previous_subtitle is None:
                previous_subtitle = subtitle
                continue

            subtitle.text = subtitle.text.strip()
            if len(subtitle.text) == 0:
                continue

            # Skip very short duplicates
            if (
                self._ts_to_secs(subtitle.start_time)
                - self._ts_to_secs(subtitle.end_time)
                < 0.15
                and subtitle.text in previous_subtitle.text
            ):
                previous_subtitle.end = subtitle.end
                continue

            current_lines = subtitle.text.split("\n")
            last_lines = previous_subtitle.text.split("\n")

            singleword = False

            if current_lines[0] == last_lines[-1]:
                if len(last_lines) == 1:
                    if len(last_lines[0].split(" ")) < 2 and len(last_lines[0]) > 2:
                        singleword = True
                        subtitle.text = (
                            current_lines[0] + " " + "\n".join(current_lines[1:])
                        )
                    else:
                        subtitle.text = "\n".join(current_lines[1:])
                else:
                    subtitle.text = "\n".join(current_lines[1:])
            else:
                if len(subtitle.text.split(" ")) <= 2:
                    previous_subtitle.end = subtitle.end
                    title_text = subtitle.text
                    if title_text[0] != " ":
                        title_text = " " + title_text
                    previous_subtitle.text += title_text
                    continue

            if self._ts_to_secs(subtitle.start_time) <= self._ts_to_secs(
                previous_subtitle.end_time
            ):
                new_time = max(self._ts_to_secs(subtitle.start_time) - 0.001, 0)
                previous_subtitle.end = self._seconds_to_timestamp(new_time)
            if self._ts_to_secs(subtitle.start_time) >= self._ts_to_secs(
                subtitle.end_time
            ):
                subtitle.start, subtitle.end = subtitle.end, subtitle.start

            if not singleword:
                yield previous_subtitle
            previous_subtitle = subtitle

        if previous_subtitle:
            yield previous_subtitle

    def parse_captions(self, ext: str, content: str) -> Tuple[str, List[Dict]]:
        """
        Parse caption content.

        Returns:
            Tuple of (plain_text, segments)
        """
        if ext != "vtt":
            raise ValueError(f"Unsupported caption format: {ext}")

        captions = webvtt.from_string(content)
        segments = []
        result = ""

        # Deduplicate YouTube's overlapping auto-captions
        captions_list = list(self._dedupe_yt_captions(captions))

        for i, caption in enumerate(captions_list):
            current_text = caption.text.replace("\n", " ").strip()

            start_time = self._timestamp_to_seconds(caption.start)
            end_time = self._timestamp_to_seconds(caption.end)

            segments.append(
                {"startTime": start_time, "endTime": end_time, "text": current_text}
            )

            if i > 0:
                prev_end = self._timestamp_to_seconds(captions_list[i - 1].end)
                time_diff = start_time - prev_end

                if time_diff >= 2:
                    result += "\n\n"
                elif time_diff >= 1:
                    result += "\n"
                else:
                    result += " "

            result += current_text

        # Clean up multiple spaces
        result = " ".join(re.split(" +", result))

        return result, segments

    def extract(self, url: str) -> Dict:
        """
        Main extraction method.

        Returns structured data with metadata and transcript.
        """
        self.extraction_log.add_step("extract_start", f"URL: {url}")

        try:
            self.extraction_log.add_step("yt_dlp_extract_info", "Starting yt-dlp extraction")
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                video_info = ydl.extract_info(url, download=False)
            self.extraction_log.add_step("yt_dlp_extract_info_done", f"Got video info for ID: {video_info.get('id', 'unknown')}")
        except Exception as e:
            self.extraction_log.add_step("yt_dlp_extract_info_error", f"{type(e).__name__}: {e}")
            self.extraction_log.set_error(e)
            raise

        if not video_info:
            self.extraction_log.add_step("no_video_info", "yt-dlp returned None")
            raise ValueError("Failed to extract video information")

        # Log video info
        self.extraction_log.add_step("video_info", f"Title: {video_info.get('title', 'unknown')[:50]}, Duration: {video_info.get('duration', 0)}s")

        # Check video availability
        if video_info.get("is_live"):
            self.extraction_log.add_step("video_is_live", "Video is a live stream")
        if video_info.get("age_limit", 0) > 0:
            self.extraction_log.add_step("age_restricted", f"Age limit: {video_info.get('age_limit')}")
        if video_info.get("availability"):
            self.extraction_log.add_step("availability", f"Availability: {video_info.get('availability')}")

        # Get captions
        self.extraction_log.add_step("get_captions", "Looking for captions")
        caption_track = self.get_captions_by_priority(video_info)

        transcript = None
        if caption_track:
            self.extraction_log.add_step("captions_found", f"Caption ext: {caption_track.get('ext')}")
            caption_content = self.download_captions(caption_track)

            self.extraction_log.add_step("parse_captions", f"Parsing {len(caption_content)} chars of captions")
            plain_text, segments = self.parse_captions(
                caption_track["ext"], caption_content
            )
            self.extraction_log.add_step("parse_captions_done", f"Got {len(segments)} segments, {len(plain_text)} chars plain text")

            # Determine if manual or auto-generated
            caption_type = "auto-generated"
            if video_info.get("subtitles"):
                for lang in ["en-US", "en-CA", "en", "en-GB", "en-AU"]:
                    if lang in video_info["subtitles"]:
                        caption_type = "manual"
                        break

            transcript = {
                "language": caption_track.get("name", "English"),
                "type": caption_type,
                "segments": segments,
                "plainText": plain_text,
            }
            self.extraction_log.add_step("transcript_built", f"Type: {caption_type}")
        else:
            self.extraction_log.add_step("no_captions", "No suitable captions found")

        self.extraction_log.add_step("extract_complete", "Extraction finished successfully")

        # Build response
        return {
            "metadata": {
                "id": video_info["id"],
                "title": video_info.get("title", ""),
                "description": video_info.get("description", ""),
                "duration": video_info.get("duration", 0),
                "upload_date": video_info.get("upload_date", ""),
                "channel": video_info.get("channel", ""),
                "channel_id": video_info.get("channel_id", ""),
                "view_count": video_info.get("view_count", 0),
                "thumbnails": self._get_best_thumbnails(
                    video_info.get("thumbnails", [])
                ),
            },
            "transcript": transcript,
            "extraction_log": self.extraction_log.to_dict(),
        }

    def get_extraction_log(self) -> Dict:
        """Get the extraction log for debugging."""
        return self.extraction_log.to_dict()

    def _get_best_thumbnails(self, thumbnails: List[Dict]) -> List[Dict]:
        """Get best quality thumbnails."""
        if not thumbnails:
            return []

        # Filter to YouTube thumbnail URLs
        yt_thumbnails = [
            t for t in thumbnails if t.get("url", "").find("i.ytimg.com/vi") != -1
        ]

        if not yt_thumbnails:
            return thumbnails[:3]

        # Sort by resolution (largest first)
        sorted_thumbs = sorted(
            yt_thumbnails,
            key=lambda t: (t.get("width", 0) * t.get("height", 0)),
            reverse=True,
        )

        return sorted_thumbs[:3]
