# E-Commerce Order Management System: Lean Build Guide

A backend-focused plan with a ready-to-paste prompt for every step. Use the prompts with an AI coding assistant, one step at a time.

## 1. Project Scope

| Area | In scope | Out of scope |
| --- | --- | --- |
| Products | Name, description, flat category, price, discount percent, stock, one image URL | Variants, coupons |
| Cart and checkout | Cart in PostgreSQL; shipping address entered at checkout and saved on the order | Address book |
| Orders | Full status lifecycle and a status history timeline | Courier and tracking numbers |
| Authentication | JWT access token plus refresh token with simple rotation | Refresh-token reuse detection, login rate limiting |
| Payments | Razorpay create order and signature verification (webhook optional) | Automated refunds |
| Admin | Products, orders, users (view, search, block, unblock) | Dashboard statistics |
| Testing | Mockito unit tests plus one Testcontainers concurrency test | Full integration test suite |
| Frontend | Basic React with plain CSS | UI component library, state library |

The technologies this project covers: JWT and roles, JPA with PostgreSQL, pagination and filtering, atomic stock handling, the RabbitMQ delay queue with dead-letter exchange and idempotent consumers, async emails with retry queues and DLQ, Redis, Razorpay, Swagger, JUnit and Mockito, and Docker Compose.

## 2. Final Decisions

| Area | Decision |
| --- | --- |
| Database | PostgreSQL (update the resume line from MySQL) |
| Redis | Product caching and JWT access-token blacklist on logout |
| Payments | Razorpay test mode: create order, Checkout popup, signature verification (webhook optional) |
| Email | Real SMTP (Gmail App Password) |
| Payment window | 15 minutes, configurable (use 1 minute while testing) |
| Users | Admin can view, search, block and unblock. Access token plus refresh token with rotation |
| Order tracking | Shipping address plus status history timeline |
| Frontend | Basic React (JavaScript, Vite, React Router, Axios, plain CSS). Admin pages in the same app, role-protected |
| Docker | Compose runs frontend, backend, PostgreSQL, Redis, RabbitMQ |
| Your level | Intermediate Spring Boot, frontend beginner |

Assumptions I made (change if you disagree): Java 21, Spring Boot 3.x, Maven, Flyway migrations, package-by-feature layout, one currency (INR).

## 3. Architecture

```
React (Vite, served by Nginx in Docker)
   | HTTP/JSON + JWT
Spring Boot API: Controller -> Service -> Repository
   |-- PostgreSQL  (business data)
   |-- Redis       (product cache, token blacklist)
   |-- RabbitMQ    (order expiry delay queue, email events)
   |-- Razorpay    |-- Gmail SMTP
```

Backend packages: `auth`, `user`, `product`, `cart`, `order`, `payment`, `notification`, `common`, `config`.

## 4. Order Lifecycle

```
PENDING_PAYMENT -> PAID -> SHIPPED -> DELIVERED
      |-> CANCELLED (customer or admin, stock restored)
      |-> EXPIRED   (15 minutes unpaid, stock restored)
```

Rules:

- Place order: in one transaction, validate the cart, atomically reduce stock, save the order with `expires_at = now + 15 min`, write the first status history row and clear the cart. Publish the expiry message only after the transaction commits.
- Stock reduction uses one atomic statement: `UPDATE products SET stock = stock - :qty WHERE id = :id AND stock >= :qty`. If 0 rows change, return 409. Process products in ascending id order to avoid deadlocks.
- Expiry consumer: lock the order row (`SELECT ... FOR UPDATE`). Only if status is still PENDING\_PAYMENT, set EXPIRED and restore stock. Otherwise do nothing. This is the idempotency guard.
- Payment success: lock the order, accept only from PENDING\_PAYMENT, save the payment (unique `razorpay_payment_id`), set PAID.
- All status changes go through one state-machine method on the order.

## 5. Database Tables

- `users` (id, name, email unique, password\_hash, role, status ACTIVE/BLOCKED, created\_at)
- `refresh_tokens` (id, user\_id, token\_hash, expires\_at, revoked)
- `categories` (id, name unique)
- `products` (id, name, description, category\_id, price, discount\_percent, stock, image\_url, active, created\_at)
- `carts` (id, user\_id unique) and `cart_items` (id, cart\_id, product\_id, quantity, unique(cart\_id, product\_id))
- `orders` (id, order\_number unique, user\_id, status, subtotal, discount\_total, total, shipping\_name, shipping\_phone, shipping\_address, shipping\_city, shipping\_state, shipping\_pincode, expires\_at, created\_at)
- `order_items` (id, order\_id, product\_id, product\_name, unit\_price, quantity, line\_total) as price and name snapshots
- `order_status_history` (id, order\_id, from\_status, to\_status, note, changed\_by, changed\_at)
- `payments` (id, order\_id, razorpay\_order\_id, razorpay\_payment\_id unique, amount, status, created\_at)
- `processed_events` (event\_id primary key, processed\_at) for email idempotency

## 6. API Endpoints

**Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh` (public); `POST /api/auth/logout` (authenticated)

**Catalog (public):** `GET /api/products` (page, size, sort, category, minPrice, maxPrice, q), `GET /api/products/{id}`, `GET /api/categories`

**Admin catalog:** `POST/PUT/DELETE /api/admin/products`, `PATCH /api/admin/products/{id}/stock`, `POST/PUT/DELETE /api/admin/categories`

**Cart (customer):** `GET /api/cart`, `POST /api/cart/items`, `PUT /api/cart/items/{id}`, `DELETE /api/cart/items/{id}`

**Orders (customer):** `POST /api/orders` (body has the shipping address), `GET /api/orders`, `GET /api/orders/{id}`, `GET /api/orders/{id}/tracking`, `POST /api/orders/{id}/cancel`

**Payments:** `POST /api/payments/create/{orderId}`, `POST /api/payments/verify`, optional `POST /api/payments/webhook`

**Admin orders and users:** `GET /api/admin/orders` (filter by status), `GET /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status`, `GET /api/admin/users`, `PATCH /api/admin/users/{id}/block`, `PATCH /api/admin/users/{id}/unblock`

## 7. Before You Start (Step 0, you do this)

- Install JDK 21, Maven, Node 20+, Docker Desktop, Git, IntelliJ IDEA, Postman.
- Create a Razorpay account and copy the **test** Key ID and Key Secret.
- Gmail: turn on 2-step verification, then create a 16-character App Password. Never use your real password.
- Create a GitHub repository with two folders: `backend` and `frontend`.

## 8. How to Use the Prompts

1. Start every new chat with the **Master Context Prompt**.
2. Paste one step prompt at a time and finish its Done-when check before moving on.
3. Commit to Git after every step.
4. When something breaks, paste the full error and the file involved, and ask for the cause to be explained.

### Master Context Prompt (paste first, every time)

```
I am building a full-stack E-Commerce Order Management System for my resume and interviews. It is mainly a BACKEND project. I am an intermediate Spring Boot developer and a complete beginner in frontend, so keep the frontend basic.
Backend stack: Java 21, Spring Boot 3, Maven, Spring Security with JWT (access + refresh tokens with simple rotation), Spring Data JPA/Hibernate, PostgreSQL, Flyway, Redis (product caching and JWT access-token blacklist on logout), RabbitMQ (delay queue using queue-level message TTL + dead-letter exchange for 15-minute order expiry; topic exchange with retry queues and a DLQ for emails), Razorpay test mode, Gmail SMTP, Swagger/OpenAPI, JUnit 5 + Mockito, Docker Compose.
Frontend: basic React (JavaScript, Vite, React Router, Axios, plain CSS only, no UI library, no state library).
Roles: ADMIN, CUSTOMER. Package-by-feature: auth, user, product, cart, order, payment, notification, common, config.
Order statuses: PENDING_PAYMENT -> PAID -> SHIPPED -> DELIVERED, or CANCELLED / EXPIRED. Stock is stored on the product. Stock is reduced atomically on order placement and restored on cancel or expiry. All consumers and payment handlers must be idempotent. There are no variants, coupons, address book or courier details.
Rules for you: do not assume anything unclear, ask me first. Give complete files with the file path above each one. Briefly explain important design choices. End each answer with a Done-when checklist I can verify.
```

## 9. Backend Steps and Prompts

### Phase A: Foundation

**Step 1: Scaffold and infrastructure**

```
Step 1. Create the Spring Boot 3 / Java 21 Maven project in the `backend` folder with dependencies: web, validation, data-jpa, security, postgresql, flyway, data-redis, amqp, mail, thymeleaf, actuator, lombok, springdoc-openapi, jjwt, and test dependencies including Testcontainers. Create the package-by-feature structure. Create a root `docker-compose.yml` with PostgreSQL, Redis and RabbitMQ (with management UI) and healthchecks. Add `application.yml` with dev and prod profiles reading every secret from environment variables, a `.env.example`, and a `.gitignore`. Explain how to run it and open the RabbitMQ UI.
```

Done when: the app starts, connects to all three services, and `/actuator/health` returns UP.

**Step 2: Schema and entities**

```
Step 2. Using the tables in my plan (users, refresh_tokens, categories, products, carts, cart_items, orders, order_items, order_status_history, payments, processed_events), write Flyway migration V1 with correct types, foreign keys, unique constraints and indexes (product filtering, orders by user and status). Then write the JPA entities with enums (Role, UserStatus, OrderStatus), relationships and a BaseEntity with createdAt/updatedAt. Use BigDecimal numeric(12,2) for money. Show a text ER diagram and explain relationship and fetch type choices.
```

Done when: Flyway applies cleanly and `ddl-auto=validate` passes.

**Step 3: Common layer and exception handling**

```
Step 3. Build the `common` package: a consistent error response (timestamp, status, code, message, path, field errors), custom exceptions (ResourceNotFound, BadRequest, Conflict, InsufficientStock, InvalidStateTransition, AccountBlocked), a @RestControllerAdvice handling validation, 401/403 and unexpected errors, and a generic paged-response DTO. Explain how each exception maps to an HTTP status.
```

Done when: invalid input returns clean JSON, never a stack trace.

### Phase B: Security

**Step 4: Authentication (JWT, refresh token, Redis blacklist)**

```
Step 4. Implement register, login, refresh and logout. Use BCrypt, access tokens (15 min, with jti and role claims) and refresh tokens (7 days) stored hashed in the refresh_tokens table. On refresh, revoke the old token and issue a new pair (simple rotation). On logout, blacklist the access token jti in Redis with a TTL equal to its remaining life and revoke the refresh token. Add a JwtAuthenticationFilter that rejects blacklisted tokens and loads the user so BLOCKED users are rejected. Configure SecurityFilterChain: stateless, CORS for http://localhost:5173, method security, /api/admin/** needs ADMIN. Seed one admin user at startup from env variables. Explain the token flow with a sequence diagram.
```

Done when: register, login, refresh and logout work in Postman, a logged-out token gets 401, and a customer gets 403 on an admin endpoint.

**Step 5: User administration**

```
Step 5. Implement admin user management: paginated list with search by name or email, block and unblock. Blocking must revoke the user's refresh tokens, and a blocked user must be rejected on the very next request even with an unexpired access token. Add GET /api/users/me. Include DTOs, validation and a Mockito service test.
```

Done when: a blocked user's existing token stops working immediately.

### Phase C: Catalog and Cart

**Step 6: Categories and products (admin)**

```
Step 6. Implement admin CRUD for categories and products (name, description, category, price, discount_percent 0-90, stock, image_url, active). Use soft delete through the active flag. Add a PATCH endpoint to adjust stock. Put the effective-price calculation (price minus discount percent) in one place. Use DTOs with validation.
```

Done when: an admin can create categories and products in Swagger.

**Step 7: Public browsing and Redis caching**

```
Step 7. Implement the public product listing with pagination, sorting (price, newest, name), and filtering by category, min/max price and search text, using JPA Specifications. Add product detail and category list endpoints. Add Redis caching (Spring Cache, JSON serialization, TTL) for product detail and the category list, with eviction when an admin changes them. Explain why stock levels should not be cached and how to confirm a cache hit.
```

Done when: the second detail request is served from Redis and an admin edit evicts it.

**Step 8: Cart**

```
Step 8. Implement the customer cart in PostgreSQL: view (live price after discount, line totals, grand total, stock warnings), add item, update quantity, remove item. Reject quantity above available stock. Enforce ownership so a customer can never touch another customer's cart. Add DTOs, validation and service tests.
```

Done when: totals are correct and ownership checks work.

### Phase D: Orders and Messaging

**Step 9: Place order and stock consistency**

```
Step 9. Implement POST /api/orders with the shipping address in the request body. In ONE @Transactional method: load the cart, reject if empty, reduce stock with the atomic conditional UPDATE (ascending product id order), compute prices on the server, save the order with snapshot data, items, expires_at = now + payment window from config, the first order_status_history row, and clear the cart. Generate a readable order number. Then write ONE Testcontainers concurrency test where many threads try to buy the last unit and only one succeeds. Explain why the atomic UPDATE beats read-then-write, and when I would use pessimistic or optimistic locking.
```

Done when: the concurrency test passes and stock never goes negative.

**Step 10: RabbitMQ delay queue for expiry**

```
Step 10. Implement automatic order expiry using a RabbitMQ delay queue: queue `order.expiry.delay` with x-message-ttl equal to the payment window, no consumers, and x-dead-letter-exchange / routing key to `order.expiry.process.queue`. Publish the order id AFTER the order transaction commits (TransactionSynchronization or @TransactionalEventListener AFTER_COMMIT). Write the consumer: lock the order row, and only if status is PENDING_PAYMENT set EXPIRED, restore stock and write status history; otherwise do nothing. Use manual acks and a DLQ for poison messages. Explain why I use a queue-level TTL instead of per-message TTL, and how this compares with the delayed-message plugin and a @Scheduled job. Show how to test with a 1-minute window.
```

Done when: an unpaid order expires and stock returns, and delivering the same message twice restores stock only once.

**Step 11: Razorpay payments**

```
Step 11. Integrate Razorpay test mode with the official Java SDK. Part A: POST /api/payments/create/{orderId} (only for the caller's non-expired PENDING_PAYMENT order; create a Razorpay order in paise, store razorpay_order_id, return key id, amount and razorpay order id for the frontend Checkout) and POST /api/payments/verify (verify the HMAC SHA256 signature of razorpay_order_id|razorpay_payment_id with the key secret). Make verify idempotent: unique razorpay_payment_id, lock the order row, only move PENDING_PAYMENT to PAID, ignore duplicates. Handle the edge case of a payment arriving after the order is EXPIRED by logging it clearly, and explain how refunds would work. Keep keys in env variables. Part B (OPTIONAL, do last): POST /api/payments/webhook verifying X-Razorpay-Signature against the raw body, handling payment.captured idempotently.
```

Done when: a test card payment marks the order PAID exactly once.

**Step 12: Order lifecycle, tracking and admin orders**

```
Step 12. Implement one state-machine method on Order (allowed transitions map) used by every status change. Implement: customer cancel (PENDING_PAYMENT or PAID before shipping; restore stock), customer order list and detail, GET /api/orders/{id}/tracking (shipping address, current status, expires_at for the countdown, and the status history timeline), and admin endpoints: paginated order list filtered by status, order detail, and status update (PAID->SHIPPED, SHIPPED->DELIVERED). Every change writes order_status_history with who changed it. Add Mockito tests for every legal and illegal transition.
```

Done when: illegal transitions return 409 and the timeline shows every change.

**Step 13: Async emails**

```
Step 13. Implement async notifications. Publish order events (order.placed, order.paid, order.shipped, order.delivered, order.cancelled, order.expired) to a topic exchange `order.events` AFTER COMMIT. Create an email queue bound to `order.*`. Send HTML emails with Thymeleaf templates through Gmail SMTP (credentials from env). Add retry: on failure route to retry queues with TTL (10s, then 60s) back to the main queue, count attempts in a header, and after 3 attempts move the message to `order.events.dlq`. Make sending idempotent with the processed_events table. Explain the exchange, queue and binding layout with a diagram.
```

Done when: placing and paying an order sends real emails without slowing the API, and a forced SMTP failure ends in the DLQ after retries.

### Phase E: Quality and Backend Docker

**Step 14: Swagger, tests, Dockerfile**

```
Step 14. Configure Swagger/OpenAPI with JWT bearer authentication and tags. Review the Mockito unit tests for auth, cart, order and payment services and fill gaps. Write a multi-stage Dockerfile for the backend (Maven build, slim JRE 21, non-root user) and add the backend to docker-compose with an env file and healthcheck. Report service-layer coverage.
```

Done when: `docker compose up` starts the backend with its dependencies and all tests pass.

## 10. Frontend Steps and Prompts (Basic React)

**Step 15: Frontend foundation and login**

```
Step 15. I am a complete frontend beginner. First explain in plain words how a React app talks to my API (components, props, state, useState, useEffect, routing). Then set up the `frontend` folder with Vite + React (JavaScript), React Router and Axios only, with plain CSS (one global stylesheet, clean and simple). Folder structure: api, components, pages, context, routes. Build: an Axios instance with base URL from env; an AuthContext keeping access and refresh tokens in localStorage; an interceptor that attaches the token and, on 401, tries the refresh endpoint once, retries, or logs out; ProtectedRoute and AdminRoute; a simple navbar (links, cart link, login/logout); Login and Register pages with basic error messages. Explain every file briefly.
```

Done when: I can register, log in and log out, and protected routes redirect to login.

**Step 16: Products and cart pages**

```
Step 16. Build basic pages with simple, readable styling: Product List (search box, category dropdown, price range, sort, pagination buttons), Product Detail (image, price with discount, stock status, add to cart), and Cart (quantity update, remove, total). Show loading and error messages. Use useState and useEffect with Axios only. Explain each new concept you use.
```

Done when: I can browse, filter and add items to the cart.

**Step 17: Checkout, payment and orders**

```
Step 17. Build: Checkout page (shipping address form and order summary, place order); a Payment step that loads the Razorpay Checkout script, calls create payment, opens the popup and posts the result to /api/payments/verify, then shows a success or failure message; My Orders list with a status label; Order Tracking page with a simple vertical status timeline from the history, the shipping address, and a live countdown for PENDING_PAYMENT orders based on expires_at with a Pay Now button; a Cancel button with a confirm prompt.
```

Done when: a full purchase with a Razorpay test card works from the browser, and an unpaid order shows Expired after the window.

**Step 18: Admin pages**

```
Step 18. Build three simple admin pages under /admin (role-protected) using plain tables and forms: Products (list, create, edit, update stock, with category selection and a small form to add categories), Orders (list with status filter, status update buttons that only show valid next statuses), and Users (list, search, block and unblock buttons).
```

Done when: an admin can manage products, orders and users from the UI.

**Step 19: Frontend Docker and final compose**

```
Step 19. Write a multi-stage Dockerfile for the frontend (Node build, Nginx serve) with an nginx.conf that falls back to index.html for React Router and proxies /api to the backend. Update docker-compose so one command starts frontend, backend, PostgreSQL, Redis and RabbitMQ with healthchecks, depends_on conditions and volumes. Adjust CORS and environment variables for containers. Add a short README section for running locally and with Docker.
```

Done when: `docker compose up --build` gives a working store at http://localhost.

**Step 20: README and resume**

```
Step 20. Write a professional README (overview, architecture diagram, tech stack, features, order state diagram, how to run, environment variables, API overview, design decisions, future improvements). Update my resume project section to match what was actually built (PostgreSQL, Redis, Razorpay, React) in my existing bullet format: outcome, how it is measured, and implementation. Suggest a 3-minute demo script.
```

## 11. Interview Preparation

Use this prompt after the build:

```
I built the project described above. Act as a senior interviewer. Ask me one question at a time about: the delay queue and dead-letter exchange, idempotent consumers, preventing overselling under concurrency (atomic update vs pessimistic vs optimistic locking), why publishing after commit matters, JWT refresh rotation and logout blacklisting, Redis caching and invalidation, Razorpay signature verification, RabbitMQ retry and DLQ design, N+1 queries, and Docker Compose. After each answer, give feedback and a stronger model answer.
```

Core ideas to explain confidently:

- **Delay queue:** a queue with a TTL and no consumer. When a message expires, RabbitMQ dead-letters it to another exchange and queue where the real consumer listens.
- **Idempotency:** the same message may arrive twice. A status check under a row lock inside a transaction makes the second run do nothing, and unique keys back it up.
- **Stock consistency:** one atomic conditional UPDATE means two buyers can never take the last unit.
- **Publish after commit:** publishing earlier lets a consumer run before the order exists, or leaves a message for an order that rolled back.
- **Redis blacklist:** access tokens are stateless, so logout needs server memory. A key whose TTL matches the token's remaining life cleans itself up.

## 12. Suggested Timeline

| Week | Steps |
| --- | --- |
| 1 | 0 to 5 (setup, schema, security) |
| 2 | 6 to 9 (catalog, cart, order placement) |
| 3 | 10 to 14 (delay queue, Razorpay, lifecycle, emails, Docker) |
| 4 | 15 to 20 (basic React, final Docker, README, interview prep) |

## 13. Common Mistakes to Avoid

- Reading stock, checking it in Java and then saving. This oversells under concurrency, so use the atomic UPDATE.
- Publishing to RabbitMQ before the transaction commits.
- Trusting prices sent from the frontend. Always recompute on the server.
- Trusting the Razorpay success callback without verifying the signature.
- Committing keys or the Gmail App Password to Git.
- Returning JPA entities from controllers. Return DTOs.
- Restoring stock without first checking the current order status.
