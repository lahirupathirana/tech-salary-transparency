# PayFloor — Tech Salary Transparency

A microservice-based salary transparency platform for tech professionals. Built for MSc coursework demonstrating modern cloud-native patterns: BFF gateway, service separation by concern, JWT auth, community moderation, and privacy-by-design (salary records are never linked to user emails).

---

## Architecture

```
                        ┌──────────────────────────┐
  browser ─── :80 ────► │  Frontend (React + Nginx)│
                        │  Nginx proxies /api/* ───┼──┐
                        └──────────────────────────┘  │
                                                      ▼
                                          ┌────────────────────┐
                                          │    BFF (Express)   │  :4000
                                          │  JWT verify, routes│
                                          └─┬──┬──┬──┬──┬──────┘
                                            │  │  │  │  │
                          ┌─────────────────┘  │  │  │  └──────────────────┐
                          ▼                    ▼  ▼  ▼                     ▼
                   ┌────────────┐    ┌──────────┐  ┌──────┐  ┌────────┐  ┌───────┐
                   │  identity  │    │ submission│  │ vote │  │ search │  │ stats │
                   │   :4001    │    │   :4002   │  │ :4003│  │  :4004 │  │ :4005 │
                   └─────┬──────┘    └─────┬─────┘  └──┬───┘  └───┬────┘  └──┬────┘
                         │                 │           │          │          │
                         └─────────────────┴───────────┴──────────┴──────────┘
                                                 │
                                                 ▼
                                      ┌─────────────────────┐
                                      │  PostgreSQL (:5432) │
                                      │  schemas: identity, │
                                      │  salary, community  │
                                      └─────────────────────┘
```

### Services

| Service             | Port | Responsibility                                                       |
| ------------------- | ---- | -------------------------------------------------------------------- |
| `frontend`          | 80   | React SPA; Nginx reverse-proxy to the BFF. **Only public ingress.**  |
| `bff`               | 4000 | Single entry point for the UI. JWT verification, aggregation, routing.|
| `identity`          | 4001 | Signup / login. Bcrypt password hashing. JWT issuance.               |
| `salary-submission` | 4002 | Accepts and validates submissions. **No email ever stored here.**    |
| `vote`              | 4003 | Up/down votes; promotes `PENDING` → `APPROVED` at threshold.         |
| `search`            | 4004 | Filtered lookups over `APPROVED` submissions.                        |
| `stats`             | 4005 | Averages, percentiles (`PERCENTILE_CONT`), distributions.            |
| `feedback`          | 4006 | Stores user feedback and feature requests for product improvements.  |
| `postgres`          | 5432 | Single instance; logical schemas `identity`, `salary`, `community`, `feedback`.  |

### Privacy design

Salary submissions **cannot** be joined to user emails at the database level:

* `identity.users` stores the email and password hash, plus an opaque UUID called `submitter_token`.
* `salary.submissions` stores an optional `submitter_token` (nullable) — and **no `user_id`, no email, no cross-schema foreign key**. When the user toggles "anonymise", the token is stripped before the record is written.
* JWTs use the `submitter_token` as `sub`; other services never learn the email.
* The BFF refuses to let a client pass an arbitrary `submitterToken` — it uses the one from the verified JWT.

### Community moderation flow

1. A logged-in user submits a salary → stored with `status = 'PENDING'`.
2. Other logged-in users up/down-vote. One vote per (submission, voter).
3. When `UP − DOWN ≥ APPROVAL_THRESHOLD` (default `3`), status atomically flips to `APPROVED` inside the same transaction.

---

## Prerequisites

* Docker Engine 24+ and Docker Compose v2 (`docker compose`, not `docker-compose`)
* 2 GB RAM minimum (4 GB recommended on EC2)

---

## Running locally

```bash
git clone <this-repo> tech-salary-transparency
cd tech-salary-transparency
cp .env.example .env
# Edit .env and set a strong JWT_SECRET and POSTGRES_PASSWORD
docker compose up --build -d
```

Then open:

| What                 | URL                               |
| -------------------- | --------------------------------- |
| Frontend             | [http://localhost](http://localhost)             |
| BFF (for debugging)  | [http://localhost:4000/health](http://localhost:4000/health) |

To tear down (keeping the database volume):

```bash
docker compose down
```

To wipe everything including the DB:

```bash
docker compose down -v
```

---

## Deploying to AWS EC2

### 1. Launch an instance

* AMI: **Ubuntu 22.04 LTS** (or Amazon Linux 2023)
* Size: **t3.small** minimum (`t3.medium` recommended — Node builds are memory-hungry)
* Storage: 20 GB gp3
* Security group:

  | Port | Source           | Purpose                       |
  | ---- | ---------------- | ----------------------------- |
  | 22   | Your IP          | SSH                           |
  | 80   | `0.0.0.0/0`      | Public web traffic            |
  | 4000 | Your IP *(opt.)* | Direct BFF access for testing |

### 2. Install Docker on the instance

SSH in and run:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
# Log out and back in so the group change takes effect
```

Verify: `docker --version && docker compose version`

### 3. Copy the project to the instance

From your local machine:

```bash
scp -i your-key.pem -r tech-salary-transparency ubuntu@<EC2_PUBLIC_IP>:~/
```

Or clone from git on the instance itself:

```bash
git clone <repo-url> tech-salary-transparency
```

### 4. Configure environment

On the instance:

```bash
cd ~/tech-salary-transparency
cp .env.example .env
# Generate a real JWT secret:
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48)|" .env
# Set a DB password:
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')|" .env
```

### 5. Launch

```bash
docker compose up --build -d
docker compose ps     # all services should be "running / healthy"
docker compose logs -f bff   # tail the BFF for verification
```

Browse to `http://<EC2_PUBLIC_IP>` — you should see the PayFloor landing page populated with seed data.

### 6. (Optional) Put a domain + TLS in front

The simplest path is an **AWS Application Load Balancer** with an ACM certificate terminating HTTPS and forwarding HTTP to the instance on port 80. Alternatively, run Caddy or Certbot/Nginx on the host.

### 7. Operations

| Task              | Command                                           |
| ----------------- | ------------------------------------------------- |
| View all logs     | `docker compose logs -f`                          |
| Restart one svc   | `docker compose restart bff`                      |
| Rebuild one svc   | `docker compose up -d --build vote`               |
| DB shell          | `docker compose exec postgres psql -U tst_user tst_db` |
| Backup DB         | `docker compose exec postgres pg_dump -U tst_user tst_db > backup.sql` |
| Update code       | `git pull && docker compose up -d --build`        |

---

## Project layout

```
tech-salary-transparency/
├── docker-compose.yml
├── .env.example
├── README.md
├── database/
│   └── init/
│       └── 01-schema.sql           # schemas + seed data (runs on first boot)
├── frontend/
│   ├── Dockerfile                  # multi-stage: Node build → Nginx
│   ├── nginx.conf                  # serves SPA + proxies /api/* to BFF
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── context/AuthContext.jsx
│       ├── lib/api.js              # the ONLY file that knows the BFF URL
│       └── pages/
│           ├── LandingPage.jsx
│           ├── SearchPage.jsx
│           ├── SubmitPage.jsx
│           ├── StatsPage.jsx
│           ├── LoginPage.jsx
│           └── SignupPage.jsx
└── services/
    ├── bff/
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/index.js
    ├── identity/
    ├── salary-submission/
    ├── vote/
    ├── search/
    └── stats/
        ├── Dockerfile              # (same pattern for every service)
        ├── package.json
        └── src/index.js
```

Every backend service uses the same multi-stage Dockerfile pattern:
1. `deps` stage — `npm install --omit=dev` against `package.json` only (maximises layer cache)
2. `runtime` stage — copies `node_modules` and source, switches to a non-root `app` user, runs `node src/index.js`

---

## API reference (BFF)

All frontend requests go through `/api/*` (Nginx proxies to the BFF on `:4000`).

### Public

| Method | Path                       | Notes                                    |
| ------ | -------------------------- | ---------------------------------------- |
| POST   | `/auth/signup`             | `{ email, password, displayName? }`      |
| POST   | `/auth/login`              | `{ email, password }` → `{ token, user }`|
| GET    | `/search?...`              | filters: `company`, `role`, `level`, `location`, `minSalary`, `maxSalary`, `minExp`, `maxExp`, `currency`, `limit`, `offset` |
| GET    | `/search/facets`           | dropdown values for the UI               |
| GET    | `/feed?...`                | `/search` + vote summary per row         |
| GET    | `/stats/overview`          | totals, averages, median                 |
| GET    | `/stats/by-company?limit=10` | top N companies by avg TC              |
| GET    | `/stats/by-level?company=Google` | level breakdown                    |
| GET    | `/stats/distribution?bucket=25000` | histogram                        |
| GET    | `/stats/percentiles?role=...&company=...` | p25 / p50 / p75 / p90       |

### Authenticated (Bearer JWT required)

| Method | Path                 | Body                                           |
| ------ | -------------------- | ---------------------------------------------- |
| GET    | `/auth/me`           | —                                              |
| POST   | `/submissions`       | `{ company, roleTitle, level, location?, yearsExperience, baseSalary, bonus?, equity?, currency?, anonymize? }` |
| POST   | `/votes`             | `{ submissionId, value: 'UP' \| 'DOWN' }`      |

---

## Configuration reference (`.env`)

| Variable              | Default               | Purpose                                    |
| --------------------- | --------------------- | ------------------------------------------ |
| `POSTGRES_USER`       | `tst_user`            | DB user                                    |
| `POSTGRES_PASSWORD`   | *(must set)*          | DB password                                |
| `POSTGRES_DB`         | `tst_db`              | DB name                                    |
| `JWT_SECRET`          | *(must set)*          | HMAC secret shared between identity & BFF  |
| `JWT_EXPIRES_IN`      | `12h`                 | Token lifetime                             |
| `BCRYPT_ROUNDS`       | `10`                  | Cost factor for password hashing           |
| `APPROVAL_THRESHOLD`  | `3`                   | Net up-votes needed to auto-approve        |

---

## Security notes

* Passwords are hashed with bcrypt (cost `10` by default — raise for production).
* JWT secret must be rotated before any public launch; revoke old tokens by invalidating the secret (all sessions end).
* Only the frontend container (`:80`) and BFF (`:4000`, for debugging — optional) are published to the host. Identity, submission, vote, search, stats, and Postgres are reachable **only** on the internal Docker network.
* SQL is fully parameterised across all services.
* The frontend enforces its "BFF only" contract structurally: the base URL (`/api`) is baked in at build time and Nginx is the only routing layer the browser ever touches.
* For production, add: rate limiting on `/auth/*` and `/votes`, a web application firewall, TLS via ALB + ACM, and a VPC with private subnets for Postgres.

---

## License

MSc coursework project — provided as-is for educational purposes.
