# SE2-group-12-Mountain-Hut
Mountain Hut Management System – A web application developed for the Software Engineering II course at Politecnico di Torino (2026/2027). Designed to support mountain hut operations by coordinating hikers, reservations, staff activities, and resource management through a centralized platform.
# MIT-License
The MIT License allows anyone to freely use, modify, distribute, and commercialize the software with minimal restrictions. It requires the original copyright notice and license to be preserved, ensuring recognition of the original authors and their ownership of the source code.
# Docker
The application can be started using Docker Compose
## Start the application
```bash
docker compose -f backend/docker-compose.yml up --build
```
after starting the container, run:
```bash
docker compose -f backend/docker-compose.yml exec backend npm run db:seed
```
Stop the application:
```bash
docker compose -f backend/docker-compose.yml down
```
To also remove the persisted Docker volumes:
```bash
docker compose -f backend/docker-compose.yml down -v
```
