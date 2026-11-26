# 🛒 E-Commerce Order Management System

A full-stack order management platform built as a resume/portfolio project demonstrating production-quality backend engineering with Java/Spring Boot, PostgreSQL, Redis, RabbitMQ, Razorpay, and **Groq AI**.

🔗 **Live Repo:** https://github.com/HarshK25/OrderManagementProject

---

## Architecture

```
React (Vite + Nginx)
   │ HTTP/JSON + JWT
Spring Boot API (port 8080)
   ├── PostgreSQL  – business data (Flyway migrations)
   ├── Redis       – product cache + JWT blacklist on logout
   ├── RabbitMQ    – order expiry delay queue + email retry queues
   ├── Razorpay    – payment gateway + Gmail SMTP (Thymeleaf HTML emails)
   └── Groq AI     – product description generator + customer support chatbot
```

---

## Tech Stack

| Layer       | Technology                                                        |
|-------------|-------------------------------------------------------------------|
| Backend     | Java 21, Spring Boot 3.3.5, Maven, Spring Security (JWT)         |
| Database    | PostgreSQL 16, Flyway migrations, Spring Data JPA / Hibernate     |
| Cache       | Redis 7 (product cache, JWT blacklist on logout)                  |
| Messaging   | RabbitMQ 3.13 (delay queue, retry queues, DLQ)                   |
| Payments    | Razorpay test mode (HMAC-SHA256 signature verification)           |
| Email       | Gmail SMTP + Thymeleaf HTML templates                             |
| AI          | Groq API – `openai/gpt-oss-20b` (descriptions + chatbot)         |
| API Docs    | Swagger / SpringDoc OpenAPI 3                                     |
| Frontend    | React 18, Vite, React Router v6, Axios, plain CSS                 |
| Container   | Docker Compose (5 services: postgres, redis, rabbitmq, backend, frontend) |

---

## Features

### Core E-Commerce
- **JWT Auth** – access tokens (15 min) + refresh tokens (7 days) with rotation
- **Redis blacklist** – logout immediately invalidates access tokens
- **Product catalog** – pagination, filtering (category/price/search), sorting, Redis caching
- **Cart** – live pricing, stock warnings, quantity validation
- **Order lifecycle** – `PENDING_PAYMENT → PAID → SHIPPED → DELIVERED` or `CANCELLED/EXPIRED`
- **Atomic stock** – single `UPDATE ... WHERE stock >= qty` prevents overselling under concurrency
- **Payment expiry** – RabbitMQ delay queue expires unpaid orders after configurable window
- **Razorpay integration** – create order, Checkout popup, HMAC-SHA256 signature verification
- **Async emails** – topic exchange, 3-attempt retry with 10s/60s delay queues, DLQ
- **Admin panel** – product/category CRUD, stock adjustment, order status machine, user block/unblock

### ✨ AI Features (Groq API)

#### 1. AI Product Description Generator
- Admin clicks **"✨ AI Generate"** in the product form
- Enters optional keywords (e.g. "lightweight, waterproof")
- Groq generates a compelling, SEO-friendly product description in seconds
- Auto-fills the description field — editable before saving
- Endpoint: `POST /api/admin/ai/generate-description` (admin only)

#### 2. AI Customer Support Chatbot
- Floating **💬 chat bubble** visible on every page (bottom-right)
- Multi-turn conversation with memory (last 10 exchanges per session)
- Answers questions about: payments, orders, returns, cancellations, contact info
- Directs users to "My Orders" page for specific order tracking
- Provides support contact: 📞 +91 98765 43210 | ✉️ support@ordermanagement.com
- No login required — available to all visitors
- Endpoint: `POST /api/chat/message` (public)

---

## Order State Machine

```
PENDING_PAYMENT ──► PAID ──► SHIPPED ──► DELIVERED
       │              │
       ├──► CANCELLED ◄┘  (customer or admin; stock restored)
       └──► EXPIRED        (payment window elapsed; stock restored)
```

---

## Running Locally

### Prerequisites
- Docker Desktop, Java 21, Node 20

### Quick Start (Docker — recommended)
```bash
# 1. Copy and fill environment file
cp .env.example .env
# Edit .env with your RAZORPAY keys, Gmail credentials, Groq API key

# 2. Start everything
docker compose up --build

# App        → http://localhost
# API docs   → http://localhost:8080/swagger-ui.html
# RabbitMQ   → http://localhost:15672  (guest/guest)
```

### Local Dev (without Docker)
```bash
# Start infrastructure only
docker compose up postgres redis rabbitmq -d

# Backend
cd backend
# Windows:
Get-Content ../.env | ForEach-Object { ... }   # load env vars
./mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev

# Frontend
cd frontend
npm install
npm run dev    # → http://localhost:5173
```

---

## Key Environment Variables

| Variable                 | Description                                |
|--------------------------|--------------------------------------------|
| `DB_NAME`                | PostgreSQL database name                   |
| `DB_USERNAME`            | PostgreSQL user                            |
| `DB_PASSWORD`            | PostgreSQL password                        |
| `JWT_SECRET`             | HS512 signing key (≥512-bit)               |
| `RAZORPAY_KEY_ID`        | Razorpay test key ID                       |
| `RAZORPAY_KEY_SECRET`    | Razorpay test key secret                   |
| `MAIL_USERNAME`          | Gmail address                              |
| `MAIL_PASSWORD`          | Gmail App Password (16 chars)              |
| `ADMIN_EMAIL`            | Seeded admin user email                    |
| `ADMIN_PASSWORD`         | Seeded admin user password                 |
| `PAYMENT_WINDOW_MINUTES` | Order expiry window (default: 15)          |
| `GROQ_API_KEY`           | Groq API key (free at console.groq.com)    |

---

## API Overview

| Group           | Endpoints                                                                      |
|-----------------|--------------------------------------------------------------------------------|
| Auth            | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`                     |
| Catalog         | `GET /api/products`, `GET /api/products/{id}`, `GET /api/categories`           |
| Admin catalog   | `POST/PUT/DELETE /api/admin/products`, `PATCH .../stock`                       |
| Cart            | `GET/POST/PUT/DELETE /api/cart/items`                                          |
| Orders          | `POST /api/orders`, `GET /api/orders/me`, `PATCH /api/orders/{id}/cancel`      |
| Payments        | `POST /api/payments/create/{orderId}`, `POST /api/payments/verify`             |
| Admin orders    | `GET /api/admin/orders`, `PATCH /api/admin/orders/{id}/status`                 |
| Admin users     | `GET /api/admin/users`, `PATCH /api/admin/users/{id}/block`                    |
| **AI — Admin**  | `POST /api/admin/ai/generate-description`                                      |
| **AI — Chat**   | `POST /api/chat/message`                                                       |

Full interactive docs: **http://localhost:8080/swagger-ui.html**

---

## Default Admin Credentials
```
Email:    admin@ordermanagement.com
Password: Admin@12345
```

---

## Design Decisions

**Why queue-level TTL for order expiry?**
Per-message TTL requires scanning the entire queue; queue-level TTL evicts at the head in O(1). It also avoids ordering issues where short-lived messages are stuck behind long-lived ones.

**Why publish to RabbitMQ after commit?**
Publishing inside the transaction can send a message for an order that rolls back. Publishing after commit via `@TransactionalEventListener(AFTER_COMMIT)` guarantees the consumer sees committed data.

**Why pessimistic locking in the expiry consumer?**
Two consumer instances could both receive the same expiry message. `SELECT … FOR UPDATE` serialises them; only the first sees `PENDING_PAYMENT` and expires the order.

**Why not Spring AI for the chatbot?**
The existing WebClient (spring-boot-starter-webflux) pattern was already proven working with Groq's OpenAI-compatible API. Using raw WebClient keeps dependencies minimal and gives full control over the request/response format and session memory.

---

## Roadmap

- [x] JWT Authentication & Authorization
- [x] Product Catalog with Redis Caching
- [x] Cart & Order Management
- [x] Razorpay Payment Integration
- [x] RabbitMQ Order Expiry & Email Queue
- [x] Admin Panel (Products, Orders, Users)
- [x] ✨ AI Product Description Generator (Groq)
- [x] 🤖 AI Customer Support Chatbot (Groq)
- [ ] Admin Analytics Dashboard
- [ ] Return & Refund Workflow
- [ ] Courier/tracking number integration
- [ ] Address book for repeat customers
