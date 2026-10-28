FROM alpine:latest

# Install runtimes & compilers for JavaScript, Python, C++, and Java
RUN apk add --no-cache nodejs python3 g++ openjdk17-jdk bash musl-dev

# Create isolated non-root execution identity
RUN adduser -D -u 1001 -s /bin/bash runner

# Working directory
WORKDIR /home/runner/workspace
RUN chown -R runner:runner /home/runner

USER runner

