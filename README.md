# 🐾 VetPet Manager

Sistema de gestão para clínicas veterinárias — monorepo fullstack com NestJS (API) e Next.js (Web).

## Visão geral

- **11 módulos no backend:** auth, usuários, clientes, pets, agenda, prontuário, estoque, vendas, serviços, financeiro e relatórios
- **Páginas no frontend** (App Router do Next.js 14): login, dashboard, clientes, pets, agenda, estoque, vendas, financeiro, relatórios, configurações (usuários e serviços) e ficha do pet (com prontuário) já funcionais
- **TailwindCSS** para estilização do frontend
- **Docker Compose** para rodar o PostgreSQL localmente durante o desenvolvimento
- **npm workspaces** como gerenciador do monorepo

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **API** | NestJS + Prisma ORM |
| **Web** | Next.js 14 (App Router) + Tailwind CSS |
| **Banco de dados** | PostgreSQL 15 |
| **Package manager** | npm (workspaces) |
| **Infra local** | Docker Compose |

## Estrutura do Projeto

```
vetpet-manager/
├── back/           # NestJS + Prisma (porta 3001)
├── front/          # Next.js 14 (porta 3000)
├── packages/       # Pacotes compartilhados (tipos, utils, etc.)
├── docker-compose.yml
└── package.json
```

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9 (já vem com o Node.js)
- [Docker](https://www.docker.com/) e Docker Compose

## Instalação

### 1. Clone o repositório

```bash
git clone <repo-url>
cd vetpet-manager
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### 3. Suba o banco de dados

```bash
docker compose up -d
```

### 4. Instale as dependências

```bash
npm install
```

### 5. Execute as migrations do banco

```bash
npm run db:migrate
```

### 5.1. Popule dados iniciais (usuário admin, serviços, produtos)

```bash
npm run db:seed
# Login: admin@vetpet.com / admin123
```

> O `.env` precisa existir em `back/` (e `NEXT_PUBLIC_API_URL` em `front/.env.local`) — copie o `.env.example` para ambos.

### 6. Inicie o ambiente de desenvolvimento

```bash
npm run dev
```

## URLs de Acesso

| Serviço | URL |
|---------|-----|
| **Frontend (Web)** | http://localhost:3000 |
| **API (Backend)** | http://localhost:3001 |
| **API Docs (Swagger)** | http://localhost:3001/api/docs |
| **pgAdmin** | http://localhost:5050 |

### Credenciais pgAdmin
- **Email:** admin@vetpet.com
- **Senha:** admin123

### Credenciais PostgreSQL
- **Host:** localhost
- **Porta:** 5432
- **Usuário:** vetpet
- **Senha:** vetpet123
- **Banco:** vetpet_db

## Scripts Disponíveis

```bash
npm run dev          # Inicia API + Web em modo desenvolvimento
npm run build        # Build de produção (API e Web)
npm run start        # Inicia em modo produção
npm run lint         # Lint em todos os pacotes
npm run db:generate  # Gera o cliente Prisma
npm run db:migrate   # Executa as migrations
npm run db:studio    # Abre o Prisma Studio (interface visual do banco)
```

## Docker

```bash
# Subir serviços (Postgres + pgAdmin)
docker compose up -d

# Parar serviços
docker compose down

# Parar e remover volumes (apaga os dados)
docker compose down -v
```

## Licença

Projeto privado — LITOCODE © 2024
