# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build — Maven + JDK 21
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /workspace

# Copy dependency manifests first to exploit Docker layer cache
COPY pom.xml .
COPY .mvn/ .mvn/
COPY mvnw .

RUN chmod +x mvnw && \
    ./mvnw dependency:go-offline -q

# Copy source and build (skip tests here — run them in CI separately)
COPY src/ src/

RUN ./mvnw package -DskipTests -q

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime — slim JRE 21, non-root user
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy the fat JAR from the builder stage
COPY --from=builder /workspace/target/*.jar app.jar

# Ensure the jar is owned by the non-root user
RUN chown appuser:appgroup app.jar

USER appuser

# JVM tuning for containerised environments
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

# The application binds to port 8080
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
