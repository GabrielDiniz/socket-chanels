# **Painel de Chamada de Pacientes \- Backend Real-Time**

Backend robusto e escalável para sistemas de Digital Signage hospitalar, focado em alta performance, arquitetura orientada a eventos e multi-tenancy.

Este projeto implementa o servidor central de um sistema de chamadas de pacientes. Ele atua como um *hub* de ingestão de dados de sistemas externos (como Versa Saúde e NovoSGA), normaliza esses dados e os distribui em tempo real via WebSockets para os painéis de exibição (frontend).

## **🚀 Tecnologias e Arquitetura**

O projeto segue estritamente os **12-Factor App principles** e utiliza uma stack moderna:

* **Runtime:** Node.js (v24/LTS)  
* **Framework Web:** Express (integrado como Custom Server Next.js)  
* **Real-Time Engine:** Socket.IO  
* **Banco de Dados:** MySQL 8.0 (via Docker)  
* **ORM:** Prisma 7 (com @prisma/adapter-mariadb e driver mysql2 para conexão serverless-ready)  
* **Validação:** Zod  
* **Infraestrutura:** Docker & Docker Compose (Multi-stage builds)

## **📋 Funcionalidades**

* **Multi-Tenancy Dinâmico:** Suporte a múltiplos hospitais/clínicas e múltiplos canais (recepções/consultórios) no mesmo servidor.  
* **Autenticação por API Key:** Geração segura de tokens por canal registrado.  
* **Normalização de Dados:** Padrão *Strategy* para converter payloads de diferentes sistemas (Versa, SGA) em uma entidade canônica unificada.  
* **Resiliência:** Scripts de *wait-for-db* para garantir inicialização limpa e healthchecks robustos.  
* **API First:** Design focado em integração via Webhooks/REST.

## **🛠️ Como Rodar (Docker)**

A maneira recomendada de executar o projeto é via Docker Compose, que sobe o banco de dados e a API simultaneamente.

### **Pré-requisitos**

* Docker & Docker Compose instalados.

### **Passo a Passo**

1. **Clone o repositório e configure as variáveis:**  
   cp .env.example .env

   Certifique-se de que a DATABASE\_URL no .env aponte para o serviço do docker (db):  
   DATABASE\_URL=mysql://versa\_user:versa\_pass@db:3306/versa\_painel  
2. **Suba os containers:**  
   docker compose up \--build

   *O sistema irá:*  
   * Iniciar o MySQL 8\.  
   * Aguardar o healthcheck do banco.  
   * Rodar as migrações do Prisma (db push).  
   * Iniciar a API na porta 3000\.

## **🔌 Documentação da API**

### **1\. Registrar Novo Canal (Tenant)**

Antes de enviar chamadas, você deve registrar o ponto de exibição para obter uma chave de acesso.

* **Endpoint:** POST /api/v1/register  
* **Acesso:** Público (Idealmente protegido por firewall ou chave mestre em produção)

**Body:**

{  
  "system\_name": "Versa",  
  "tenant\_name": "Hospital Central",  
  "channel\_slug": "recepcao-terreo"   
}

**Resposta (Sucesso 201):**

{  
  "success": true,  
  "data": {  
    "apiKey": "f4a1...",  // \<--- GUARDE ESTA CHAVE  
    "channelSlug": "recepcao-terreo",  
    "details": "..."  
  }  
}

### **2\. Enviar Chamada (Ingestão)**

Endpoint utilizado pelos sistemas externos (Versa/SGA) para notificar uma nova chamada.

* **Endpoint:** POST /api/v1/chamada  
* **Headers:**  
  * Content-Type: application/json  
  * x-auth-token: SUA\_API\_KEY\_AQUI (Retornada no registro)

**Body (Exemplo Versa):**

{  
  "source\_system": "Versa",  
  "current\_call": {  
    "patient\_name": "João da Silva",  
    "destination": "Consultório 05",  
    "professional\_name": "Dr. House"  
  }  
}

**Body (Exemplo NovoSGA):**

{  
  "senha": { "format": "A001" },  
  "local": { "nome": "Guichê" },  
  "numeroLocal": 1,  
  "prioridade": { "peso": 1 }  
}

## **📡 WebSocket (Socket.IO)**

O frontend deve se conectar ao WebSocket para receber atualizações em tempo real.

* **Evento de Conexão:** join\_channel (enviar o channel\_slug).  
* **Evento de Escuta:** call\_update.

**Exemplo de Cliente (JS):**

const socket \= io('http://localhost:3000');

socket.on('connect', () \=\> {  
  // Entra na sala específica usando o slug registrado  
  socket.emit('join\_channel', 'recepcao-terreo');  
});

socket.on('call\_update', (data) \=\> {  
  console.log('Nova chamada:', data);  
  // { id: "...", name: "João", destination: "Sala 1", ... }  
});

## **🗄️ Estrutura do Banco de Dados (Prisma)**

O projeto utiliza o Prisma ORM. O esquema principal é:

**Tabela channels**

* id: UUID  
* api\_key: String (Unique)  
* system\_name: String  
* tenant\_name: String  
* channel\_slug: String (Unique \- usado como Room no Socket.IO)  
* created\_at: DateTime

## **🔧 Desenvolvimento Local**

Para rodar fora do Docker (apenas Node.js):

1. Instale as dependências: npm install  
2. Suba um banco MySQL localmente.  
3. Ajuste o .env para localhost.  
4. Gere o cliente Prisma: npx prisma generate  
5. Sincronize o banco: npx prisma db push  
6. Rode o servidor: npm run dev

## **📝 Notas sobre Prisma 7**

Este projeto utiliza a versão mais recente do Prisma (v7) com o adaptador de driver mysql2.

* A configuração do banco não reside mais no schema.prisma.  
* A conexão é gerenciada pelo arquivo prisma.config.js e injetada via src/server/config/prisma.ts.

Desenvolvido para alta disponibilidade e baixa latência.