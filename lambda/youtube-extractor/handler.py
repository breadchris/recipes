"""
AWS Lambda handler for YouTube video extraction.
Accepts a video URL, extracts metadata and transcripts, caches in S3.
"""

import json
import logging
import os
import gzip
import traceback
from typing import Dict, Any, Optional

import boto3
from botocore.exceptions import ClientError

from extractor import VideoExtractor, validate_youtube_url

# Configure logging - set to DEBUG for verbose output
log_level = os.environ.get("LOG_LEVEL", "DEBUG")
logger = logging.getLogger()
logger.setLevel(log_level)

# Also configure the extractor module logger
extractor_logger = logging.getLogger("extractor")
extractor_logger.setLevel(log_level)

# Initialize S3 client
s3 = boto3.client("s3")
BUCKET = os.environ.get("S3_BUCKET", "")
COOKIES_FILE = "/tmp/cookies.txt"

# Proxy configuration (Oxylabs)
PROXY_URL = os.environ.get("PROXY_URL", "")  # e.g. http://pr.oxylabs.io:7777
PROXY_USERNAME = os.environ.get("PROXY_USERNAME", "")
PROXY_PASSWORD = os.environ.get("PROXY_PASSWORD", "")


def get_proxy_url() -> str | None:
    """Build proxy URL with authentication if configured."""
    if not PROXY_URL:
        return None

    if PROXY_USERNAME and PROXY_PASSWORD:
        # Parse the proxy URL and insert credentials
        # Format: http://user:pass@host:port
        if "://" in PROXY_URL:
            scheme, rest = PROXY_URL.split("://", 1)
            return f"{scheme}://{PROXY_USERNAME}:{PROXY_PASSWORD}@{rest}"
        else:
            return f"http://{PROXY_USERNAME}:{PROXY_PASSWORD}@{PROXY_URL}"

    return PROXY_URL


def download_cookies():
    """Download cookies from S3 if available."""
    if os.path.exists(COOKIES_FILE):
        return COOKIES_FILE

    try:
        s3.download_file(BUCKET, "config/cookies.txt", COOKIES_FILE)
        logger.info("Downloaded cookies from S3")
        return COOKIES_FILE
    except ClientError as e:
        logger.warning(f"Could not download cookies: {e}")
        return None


class ExtractionError(Exception):
    """Custom error for extraction failures."""

    def __init__(self, code: str, message: str, status_code: int = 500):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def check_cache(video_id: str) -> Optional[Dict]:
    """Check if extraction result exists in S3 cache."""
    key = f"combined/{video_id}.json.gz"
    try:
        response = s3.get_object(Bucket=BUCKET, Key=key)
        content = gzip.decompress(response["Body"].read())
        return json.loads(content.decode("utf-8"))
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return None
        logger.warning(f"Cache check failed for {video_id}: {e}")
        return None
    except Exception as e:
        logger.warning(f"Cache check failed for {video_id}: {e}")
        return None


def save_to_cache(video_id: str, data: Dict) -> str:
    """Save extraction result to S3 cache."""
    key = f"combined/{video_id}.json.gz"
    compressed = gzip.compress(json.dumps(data).encode("utf-8"))
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=compressed,
        ContentType="application/json",
        ContentEncoding="gzip",
    )
    return key


def response(status_code: int, body: Dict) -> Dict:
    """Format Lambda response for API Gateway."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Main Lambda handler for YouTube extraction.

    Request body:
    {
        "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
        "options": {
            "skipCache": false
        }
    }

    Response:
    {
        "success": true,
        "videoId": "VIDEO_ID",
        "cached": false,
        "s3Key": "combined/VIDEO_ID.json.gz",
        "data": { ... }
    }
    """
    try:
        # Parse request
        body = json.loads(event.get("body", "{}"))
        video_url = body.get("videoUrl")
        options = body.get("options", {})

        # Validate URL
        if not video_url:
            raise ExtractionError("MISSING_URL", "videoUrl is required", 400)

        if not validate_youtube_url(video_url):
            raise ExtractionError("INVALID_URL", "Not a valid YouTube URL", 400)

        # Extract video ID
        from yt_dlp.extractor.youtube import YoutubeIE

        video_id = YoutubeIE.extract_id(video_url)
        logger.info(f"Processing video: {video_id}")

        # Check cache unless skip requested
        if not options.get("skipCache", False):
            cached = check_cache(video_id)
            if cached:
                logger.info(f"Cache hit for {video_id}")
                return response(
                    200,
                    {
                        "success": True,
                        "videoId": video_id,
                        "cached": True,
                        "s3Key": f"combined/{video_id}.json.gz",
                        "data": cached,
                    },
                )

        # Perform extraction
        logger.info(f"Extracting video: {video_id}")
        cookies_file = download_cookies()
        proxy_url = get_proxy_url()
        if proxy_url:
            logger.info("Using proxy for extraction")

        extractor = VideoExtractor(cookies_file=cookies_file, proxy=proxy_url, verbose=True)

        try:
            result = extractor.extract(video_url)
        except Exception as e:
            # Get extraction log even on failure
            extraction_log = extractor.get_extraction_log()
            logger.error(f"Extraction failed: {e}")
            logger.error(f"Extraction log: {json.dumps(extraction_log, indent=2)}")
            raise ExtractionError(
                "EXTRACTION_FAILED",
                str(e),
                500,
            )

        # Check for captions
        if not result.get("transcript"):
            extraction_log = result.get("extraction_log", extractor.get_extraction_log())
            logger.warning(f"No captions found. Extraction log: {json.dumps(extraction_log, indent=2)}")
            return response(
                404,
                {
                    "success": False,
                    "error": "NO_CAPTIONS",
                    "message": "No English captions available for this video",
                    "videoId": video_id,
                    "extraction_log": extraction_log,
                },
            )

        # Save to cache (exclude extraction_log from cached data to save space)
        cache_data = {
            "metadata": result["metadata"],
            "transcript": result["transcript"],
        }
        s3_key = save_to_cache(video_id, cache_data)
        logger.info(f"Saved to cache: {s3_key}")

        return response(
            200,
            {
                "success": True,
                "videoId": video_id,
                "cached": False,
                "s3Key": s3_key,
                "data": cache_data,
                "extraction_log": result.get("extraction_log"),
            },
        )

    except ExtractionError as e:
        logger.warning(f"Extraction error: {e.code} - {e.message}")
        return response(
            e.status_code,
            {
                "success": False,
                "error": e.code,
                "message": e.message,
            },
        )
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        full_traceback = traceback.format_exc()
        return response(
            500,
            {
                "success": False,
                "error": "INTERNAL_ERROR",
                "message": str(e),
                "error_type": type(e).__name__,
                "traceback": full_traceback,
            },
        )
