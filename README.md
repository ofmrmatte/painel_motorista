# Portal do Motorista

Aplicação web mobile-first para centralizar a comunicação entre operação administrativa e motoristas, com foco em pendências, pagamentos, documentos e contestações.

> Projeto de portfólio desenvolvido a partir de um fluxo operacional real. Credenciais, documentos financeiros e dados pessoais de motoristas não devem ser versionados neste repositório.

## Sobre o projeto

O Portal do Motorista foi criado para reduzir processos manuais e concentrar em uma única experiência mobile informações que antes dependiam de contatos e consultas separadas.

A aplicação permite autenticação do motorista, consulta de informações vinculadas ao seu cadastro e acompanhamento de tratativas administrativas de forma organizada e rastreável.

## Principais funcionalidades

- Login e fluxo de autenticação do motorista.
- Interface mobile-first e suporte a instalação como PWA.
- Consulta de pendências operacionais.
- Visualização de pagamentos e documentos relacionados.
- Abertura e acompanhamento de contestações.
- Histórico de mensagens e tratativas.
- Área de perfil do motorista.
- Integração com Supabase para dados e autenticação.
- Validação de entrada com Zod.
- APIs server-side para operações sensíveis.
- Layout responsivo adaptado a diferentes dispositivos móveis.

## Stack

### Aplicação
- Next.js 16
- React 19
- TypeScript
- CSS Modules / CSS responsivo
- Lucide React

### Back-end e dados
- Next.js Server APIs
- Supabase
- Zod

### Qualidade
- ESLint
- TypeScript type checking
- Vitest

### Deploy
- Vercel

## Estrutura do projeto

```text
app/          páginas, rotas e APIs
components/   autenticação, portal, pagamentos e contestações
lib/          regras e integrações
public/       assets e recursos da PWA
tests/        testes automatizados
```

## Componentes principais

- `driver-auth-form` — autenticação e primeiro acesso.
- `portal-app` — experiência principal do motorista.
- `payments-view` — visualização de pagamentos.
- `disputes-view` — abertura e acompanhamento de contestações.

## Execução local

Requisitos:

- Node.js 20+
- Projeto Supabase configurado

```bash
npm install
npm run dev
```

Crie `.env.local` com base em `.env.example` e utilize apenas credenciais do seu ambiente.

## Validação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Competências demonstradas

O projeto envolve levantamento de requisitos, modelagem de fluxos de usuário, desenvolvimento full stack, autenticação, APIs, integração com banco de dados, responsividade mobile, PWA, testes, debugging e deploy.

O desenvolvimento utiliza ferramentas de IA generativa como apoio à implementação, revisão, refatoração e testes, com definição de requisitos, regras operacionais e validação funcional conduzidas ao longo da evolução do produto.

## Segurança

- Não versione credenciais reais ou arquivos `.env.local`.
- Chaves com privilégios elevados devem permanecer exclusivamente no servidor.
- Não publique PDFs, dados financeiros, IDs reais ou informações pessoais de motoristas.
- Use dados fictícios ou anonimizados em demonstrações públicas.

## Autor

**Matheus Ferreira Folgado**  
GitHub: [@ofmrmatte](https://github.com/ofmrmatte)
