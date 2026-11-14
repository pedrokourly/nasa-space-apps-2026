# CLAUDE.md

As regras completas do projeto estão em `AGENTS.md` e valem integralmente para o Claude Code:

@AGENTS.md

---

## Reforço para o Claude Code

### Issues: o modelo é inegociável

Sempre que for criar, sugerir ou reescrever uma issue (via `gh issue create`, MCP do GitHub ou texto para o usuário colar), o corpo tem **exatamente** estas três seções, nesta ordem, e nada mais:

```markdown
# User story

Como <quem>, quero <o quê>, para <por quê>.

# Checklist

- [ ] <passo concreto>

# Critério de aceite

- <condição verificável>
```

- **User story é só o texto.** Nada de story points, estimativa, tamanho, prioridade, responsável, prazo ou campos extras.
- Prioridade (Must/Should/Could) e frente vão como **labels do GitHub**, nunca no corpo.
- Sem seções adicionais ("Contexto", "Notas", "Detalhes técnicos"), sem rodapé, sem assinatura de ferramenta no corpo da issue.
- Se o usuário pedir uma issue em outro formato, aponte esta regra e entregue no modelo; só fuja dele se o usuário pedir explicitamente para ignorar a regra.
- Antes de enviar, confira: três títulos `# User story`, `# Checklist`, `# Critério de aceite`; checklist com `- [ ]`; critérios verificáveis por outra pessoa.

### Antes de agir

- Confira a data atual contra o calendário do `AGENTS.md`. Depois de **dom 15/11 às 16h (feature freeze)**, não proponha nem implemente feature nova.
- Ao propor trabalho, diga se é Must, Should ou Could. Se não é Must e ainda há Must aberto, aponte isso.
- Recuse caminhos fora do escopo (backend, banco, login, Three.js, Next.js com SSR) e explique o porquê em uma linha.
- Qualquer código geoespacial: releia a seção "Armadilhas de Marte" (raio 3389,5 km, longitude −180 a 180, EPSG:4326).
- Mudança no contrato de dados atualiza a seção 5 do `AGENTS.md` no mesmo PR.

### Commits e PRs

- Mensagens em português, no imperativo, referenciando a issue (`Closes #N`).
- O corpo do PR mostra como verificar cada critério de aceite da issue.
- Não faça commit, push ou abra PR sem o usuário pedir.
