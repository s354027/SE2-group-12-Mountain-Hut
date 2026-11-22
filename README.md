# SE2-group-12-Mountain-Hut
Mountain Hut Management System – A web application developed for the Software Engineering II course at Politecnico di Torino (2026/2027). Designed to support mountain hut operations by coordinating hikers, reservations, staff activities, and resource management through a centralized platform.
# MIT-License
The MIT License allows anyone to freely use, modify, distribute, and commercialize the software with minimal restrictions. It requires the original copyright notice and license to be preserved, ensuring recognition of the original authors and their ownership of the source code.

# Run with Docker

The application is distributed as a single Docker image containing the frontend, backend, database setup, and Mailpit development mail server.

No repository clone, Node.js installation, or manual database setup is required.

### Requirements

- Docker

### Pull the image

```bash
docker pull s293687/se2-group-12-mountain-hut:latest
```

### Run the application

```bash
docker run -d \
  --name mountain-hut \
  -p 3000:3000 \
  -p 8025:8025 \
  -v mountain-hut-data:/app/data \
  s293687/se2-group-12-mountain-hut:latest
```

On Windows PowerShell:

```powershell
docker run -d `
  --name mountain-hut `
  -p 3000:3000 `
  -p 8025:8025 `
  -v mountain-hut-data:/app/data `
  s293687/se2-group-12-mountain-hut:latest
```

The application will automatically:

- generate a persistent session secret;
- start the Mailpit mail server;
- apply database migrations;
- initialize the database with demo data on the first run;
- start the Mountain Hut application.

### Access

Application:

```text
http://localhost:3000
```

Mailpit web interface:

```text
http://localhost:8025
```

### Demo accounts

Hiker:

```text
hiker.demo@mountainhut.local
DemoHiker123
```

Employee:

```text
employee.demo@mountainhut.local
DemoEmployee123
```

Warden:

```text
warden.demo@mountainhut.local
DemoWarden123
```

### Stop the application

```bash
docker stop mountain-hut
```

### Start it again

```bash
docker start mountain-hut
```

Application data is persisted in the `mountain-hut-data` Docker volume.

To completely reset the application and recreate the demo database:

```bash
docker rm -f mountain-hut
docker volume rm mountain-hut-data
```

Then run the container again using the command above.