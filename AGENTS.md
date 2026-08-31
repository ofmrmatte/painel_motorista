# Portal do Motorista — regras do projeto

Este projeto é mobile-first e lida com dados operacionais, documentos e fluxos vinculados a motoristas. Preserve segurança, privacidade e comportamento entre dispositivos.

## Antes de editar

- Leia o `README.md` e siga o fluxo existente antes de refatorar.
- Em bugs, reproduza o problema no viewport afetado quando houver caminho seguro.
- Não mova regra de autorização para o cliente apenas para simplificar implementação.
- Mudanças que dependem da Inteligência ALC devem respeitar o contrato existente entre os dois sistemas.

## Segurança e dados

- Nunca versione IDs reais, PDFs, valores financeiros, dados pessoais, credenciais ou `.env.local`.
- Chaves privilegiadas do Supabase devem permanecer server-side.
- O motorista só pode acessar dados vinculados à própria identidade e ao escopo autorizado.
- Não remova validações Zod nem filtros de acesso para fazer uma tela carregar.

## Mobile e PWA

- Não crie correções específicas para um modelo de iPhone quando o problema é de viewport ou safe area.
- Use `env(safe-area-inset-*)` quando aplicável e valide também Android e desktop responsivo.
- Evite barras inferiores posicionadas por valores fixos que ignoram viewport dinâmica.
- Não introduza scroll na tela de login sem necessidade funcional.
- Mudanças de navegação ou PWA devem considerar modo standalone e browser normal.

## Fluxos sensíveis

- Data exibida em pendências deve representar a data do evento de negócio, não a data da renderização.
- Contestações, pagamentos e documentos devem preservar histórico e rastreabilidade.
- Falha de API deve produzir estado de erro claro; não substitua silenciosamente por dados fictícios.

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

O build pode exigir configuração de ambiente. Se não puder ser executado com segurança, reporte isso em vez de assumir sucesso.

Para mudança visual, a validação de código não substitui abrir a tela no viewport relevante.

## Entrega

Antes de concluir:

- revise o diff;
- valide o fluxo alterado;
- verifique regressões em navegação e responsividade próximas;
- rode os gates aplicáveis;
- informe qualquer teste não executado ou limitação de ambiente.
