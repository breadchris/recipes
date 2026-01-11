FROM public.ecr.aws/lambda/python:3.11

# Install ffmpeg (needed by yt-dlp for some operations)
RUN yum install -y tar xz && \
    curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz && \
    tar xJf ffmpeg.tar.xz && \
    mv ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    mv ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ && \
    rm -rf ffmpeg-*-amd64-static ffmpeg.tar.xz && \
    yum clean all

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy function code and ensure proper permissions
COPY --chmod=644 *.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.lambda_handler"]
