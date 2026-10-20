# 🛍️ E-Commerce Order Management System

A full-stack order management platform built as a resume/interview project demonstrating production-quality backend engineering with Java/Spring Boot, PostgreSQL, Redis, RabbitMQ, and Razorpay.

---

## Architecture

```
React (Vite + Nginx)
   │ HTTP/JSON + JWT
Spring Boot API (port 8080)
   ├── PostgreSQL  — business data (Flyway migrations)
   ├── Redis       — product cache + JWT blacklist on logout
   ├── RabbitMQ    — order expiry delay queue + email retry queues
   └── Razorpay    ── Gmail SMTP (HTML email via Thymeleaf)
```

## Tech Stack

| Layer       | Technology                                               |
|-------------|----------------------------------------------------------|
| Backend     | Java 21, Spring Boot 3.3, Maven, Spring Security (JWT)  |
| Database    | PostgreSQL 16, Flyway migrations, Spring Data JPA        |
| Cache       | Redis 7 (product cache, token blacklist)                 |
| Messaging   | RabbitMQ 3.13 (delay queue, retry queues, DLQ)           |
| Payments    | Razorpay test mode (HMAC-SHA256 signature verification)  |
| Email       | Gmail SMTP + Thymeleaf HTML templates                    |
| API Docs    | Swagger / SpringDoc OpenAPI                              |
| Testing     | JUnit 5, Mockito, Testcontainers                         |
| Frontend    | React 18, Vite, React Router, Axios, plain CSS           |
| Container   | Docker Compose (all 5 services)                          |

## Features

- **JWT Auth** — access tokens (15 min) + refresh tokens (7 days) with simple rotation
- **Redis blacklist** — logout immediately invalidates access tokens
- **Product catalog** — pagination, filtering (category/price/search), sorting, Redis caching
- **Cart** — live pricing, stock warnings, quantity validation
- **Order lifecycle** — `PENDING_PAYMENT → PAID → SHIPPED → DELIVERED` or `CANCELLED/EXPIRED`
- **Atomic stock** — single `UPDATE ... WHERE stock >= qty` prevents overselling under concurrency
- **Payment expiry** — RabbitMQ delay queue (queue-level TTL) expires unpaid orders after configurable window
- **Razorpay integration** — create order, Checkout popup, HMAC-SHA256 signature verification
- **Async emails** — topic exchange, 3-attempt retry with 10s/60s delay queues, DLQ
- **Admin panel** — product/category CRUD, stock adjustment, order status machine, user block/unblock

## Order State Machine

```
PENDING_PAYMENT ──► PAID ──► SHIPPED ──► DELIVERED
       │              │
       ├──► CANCELLED ◄┘  (customer or admin; stock restored)
       └──► EXPIRED        (payment window elapsed; stock restored)
```

## Running Locally (Quick Start)

### Prerequisites
- Docker Desktop, Java 21 (for local dev), Node 20 (for frontend dev)

### 1. Copy environment file
```bash
cp .env.example .env
# Edit .env — fill in RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, MAIL_USERNAME, MAIL_PASSWORD
```

### 2. Start infrastructure
```bash
docker compose up postgres redis rabbitmq -d
```

### 3. Run backend
```bash
cd backend
SPRING_PROFILES_ACTIVE=dev ./mvnw spring-boot:run
```

### 4. Run frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 5. Full Docker (production-like)
```bash
docker compose up --build
# App → http://localhost
# API → http://localhost:8080/swagger-ui.html
# RabbitMQ UI → http://localhost:15672  (guest/guest)
```

## Key Environment Variables

| Variable                  | Description                          |
|---------------------------|--------------------------------------|
| `DB_NAME`                 | PostgreSQL database name             |
| `DB_USERNAME`             | PostgreSQL user                      |
| `DB_PASSWORD`             | PostgreSQL password                  |
| `JWT_SECRET`              | HS512 signing key (≥512-bit)         |
| `RAZORPAY_KEY_ID`         | Razorpay test key ID                 |
| `RAZORPAY_KEY_SECRET`     | Razorpay test key secret             |
| `MAIL_USERNAME`           | Gmail address                        |
| `MAIL_PASSWORD`           | Gmail App Password (16 chars)        |
| `ADMIN_EMAIL`             | Seeded admin user email              |
| `ADMIN_PASSWORD`          | Seeded admin user password           |
| `PAYMENT_WINDOW_MINUTES`  | Order expiry window (default: 15)    |

## API Overview

| Group          | Endpoints                                                                 |
|----------------|---------------------------------------------------------------------------|
| Auth           | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`                |
| Catalog        | `GET /api/products`, `GET /api/products/{id}`, `GET /api/categories`      |
| Admin catalog  | `POST/PUT/DELETE /api/admin/products`, `PATCH /api/admin/products/{id}/stock` |
| Cart           | `GET/POST/PUT/DELETE /api/cart/items`                                     |
| Orders         | `POST /api/orders`, `GET /api/orders/me`, `PATCH /api/orders/{id}/cancel` |
| Payments       | `POST /api/payments/create/{orderId}`, `POST /api/payments/verify`        |
| Admin orders   | `GET /api/admin/orders`, `PATCH /api/admin/orders/{id}/status`            |
| Admin users    | `GET /api/admin/users`, `PATCH /api/admin/users/{id}/block|unblock`       |

Full interactive docs: **http://localhost:8080/swagger-ui.html**

## Design Decisions

**Why queue-level TTL for order expiry?**
Per-message TTL requires scanning the entire queue; queue-level TTL evicts at the head in O(1). It also avoids ordering issues where short-lived messages are stuck behind long-lived ones.

**Why publish to RabbitMQ after commit?**
Publishing inside the transaction can send a message for an order that rolls back. Publishing after commit via `@TransactionalEventListener(AFTER_COMMIT)` guarantees the consumer sees committed data.

**Why pessimistic locking in the expiry consumer?**
Two consumer instances (or a broker restart causing redelivery) could both receive the same expiry message. `SELECT … FOR UPDATE` serialises them; only the first sees `PENDING_PAYMENT` and expires the order. The second sees `EXPIRED` and does nothing.

**Why not cache stock in Redis?**
Stock changes on every order placement and expiry. Stale cached stock would show wrong availability and could still lead to over-selling if the cache isn't invalidated atomically with the stock decrement.

## Future Improvements

- Courier/tracking number integration
- Automated Razorpay refunds on expiry
- Address book for repeat customers
- Email template branding improvements
- Frontend state management (Zustand/React Query)
- Full integration test suite with Testcontainers
