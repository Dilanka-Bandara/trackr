# Local development fallback for the discontinued upstream binary images.
# Build the archived upstream source at an explicit revision; not a hosting recommendation.
FROM golang:1.24.8 AS build
RUN CGO_ENABLED=0 go install github.com/minio/minio@v0.0.0-20260212201848-7aac2a2c5b7c
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /go/bin/minio /usr/local/bin/minio
ENTRYPOINT ["minio"]
